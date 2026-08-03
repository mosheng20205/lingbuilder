import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { AiBridgeService, type AiBridgeProcessManager } from '../src/services/aiBridge/aiBridgeService';
import { createProjectBuildCoordinator } from '../src/services/tasks/projectBuildCoordinator';
import { createAiBridgeRouter } from '../src/services/aiBridge/httpRoutes';
import { createAiBridgeMcpHttpGateway } from '../src/services/aiBridge/mcpServer';
import { AiBridgeServerOptions } from '../src/services/aiBridge/types';
import {
  isServerSessionAuthorized,
  resolveServerRuntimeConfig
} from '../src/services/server/serverRuntime';
import { WorkspacePathPolicy } from '../src/services/workspace/workspacePathPolicy';
import { decodeTextFile, encodeTextFile } from '../src/services/files/textFileService';

test('AI Bridge HTTP rejects missing or invalid token', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview', 'secret-token'));
  const app = express();
  app.use(express.json());
  app.use('/api/ai-bridge', createAiBridgeRouter(service, 'secret-token'));
  const server = await listen(app);
  try {
    const baseUrl = `http://127.0.0.1:${server.port}/api/ai-bridge`;
    const unauthorized = await fetch(`${baseUrl}/health`);
    assert.equal(unauthorized.status, 401);
    const queryToken = await fetch(`${baseUrl}/health?token=secret-token`);
    assert.equal(queryToken.status, 401);
    const bodyToken = await fetch(`${baseUrl}/files/read`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'secret-token', filePath: 'README.md' })
    });
    assert.equal(bodyToken.status, 401);

    const authorized = await fetch(`${baseUrl}/health`, {
      headers: { authorization: 'Bearer secret-token' }
    });
    assert.equal(authorized.status, 200);
    const body = await authorized.json() as { ok: boolean; permission: string };
    assert.equal(body.ok, true);
    assert.equal(body.permission, 'preview');
  } finally {
    await server.close();
  }
});

test('AI Bridge router requires a non-empty independent token', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview', ''));
  assert.throws(
    () => createAiBridgeRouter(service, ''),
    /非空独立 token/
  );
});

test('AI Bridge MCP uses the official SDK and strict tool schemas', async () => {
  const source = await fs.readFile(new URL('../src/services/aiBridge/mcpServer.ts', import.meta.url), 'utf8');
  assert.match(source, /@modelcontextprotocol\/sdk\/server/u);
  assert.match(source, /additionalProperties:\s*false/u);
  assert.match(source, /CallToolRequestSchema/u);
});

test('AI Bridge shared MCP HTTP authenticates clients, exposes tools, and reports activity', async () => {
  const workspaceRoot = await createTempWorkspace();
  await fs.writeFile(path.join(workspaceRoot, 'README.md'), 'LingBuilder MCP shared transport', 'utf8');
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview', 'shared-mcp-secret-token'));
  const gateway = createAiBridgeMcpHttpGateway(service, 'shared-mcp-secret-token');
  const app = express();
  app.use(express.json());
  app.use('/api/ai-bridge/mcp', gateway.router);
  const server = await listen(app);
  const endpoint = `http://127.0.0.1:${server.port}/api/ai-bridge/mcp`;
  try {
    assert.equal((await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status, 401);
    const client = new Client({ name: 'lingbuilder-test-client', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { headers: { Authorization: 'Bearer shared-mcp-secret-token' } }
    });
    await client.connect(transport);
    const tools = await client.listTools();
    assert.equal(tools.tools.length, 13);
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.file.read'));
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.project.create'));
    const result = await client.callTool({ name: 'lingbuilder.file.read', arguments: { filePath: 'README.md' } });
    assert.match(JSON.stringify(result), /LingBuilder MCP shared transport/u);
    const statusResponse = await fetch(`${endpoint}/status`, { headers: { Authorization: 'Bearer shared-mcp-secret-token' } });
    assert.equal(statusResponse.status, 200);
    const status = await statusResponse.json() as { activeClients: number; recentActivity: Array<{ tool?: string; ok: boolean }> };
    assert.equal(status.activeClients, 1);
    assert.ok(status.recentActivity.some(item => item.tool === 'lingbuilder.file.read' && item.ok));
    await client.close();
  } finally {
    await gateway.close();
    await server.close();
    await service.shutdown();
  }
});

test('AI Bridge project creation previews, enables modules, writes navigation, and supports guarded undo', async () => {
  const workspaceRoot = await createTempWorkspace();
  const previewService = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const preview = await previewService.createProject({
    name: 'AI 问候项目',
    projectId: 'ai-hello',
    templateId: 'hello-window',
    enabledModuleIds: ['lingbuilder.win32.common-controls']
  });
  assert.equal(preview.applied, false);
  assert.equal(preview.preview.project.id, 'ai-hello');
  assert.equal(await exists(path.join(workspaceRoot, 'src', 'ai-hello')), false);
  await previewService.shutdown();

  const writeService = new AiBridgeService({ ...createOptions(workspaceRoot, 'yolo'), token: 'project-create-test-token' });
  const created = await writeService.createProject({
    name: 'AI 问候项目',
    projectId: 'ai-hello',
    templateId: 'hello-window',
    enabledModuleIds: ['lingbuilder.win32.common-controls'],
    approved: true
  });
  assert.equal(created.applied, true);
  assert.equal(created.result?.project.id, 'ai-hello');
  assert.ok(await exists(path.join(workspaceRoot, 'src', 'ai-hello', 'MainWindow.lcpp')));
  assert.ok(await exists(path.join(workspaceRoot, '.lingbuilder', 'projects', 'ai-hello', 'project-modules.json')));
  assert.ok(await exists(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge', 'workbench-navigation.json')));
  const receiptId = created.result?.receipt.receiptId;
  assert.ok(receiptId);
  const undone = await writeService.undoProjectCreate(receiptId!, true);
  assert.equal(undone.projectId, 'ai-hello');
  assert.equal(await exists(path.join(workspaceRoot, 'src', 'ai-hello')), false);
  await writeService.shutdown();
});

test('AI Bridge refuses project creation undo after generated files change', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService({ ...createOptions(workspaceRoot, 'yolo'), token: 'project-create-conflict-token' });
  const created = await service.createProject({ name: '不可撤销项目', projectId: 'undo-conflict', approved: true });
  await fs.appendFile(path.join(workspaceRoot, 'src', 'undo-conflict', 'MainWindow.lcpp'), '\n调试输出("用户修改")\n', 'utf8');
  await assert.rejects(() => service.undoProjectCreate(created.result!.receipt.receiptId, true), /文件已经被修改/u);
  await service.shutdown();
});

test('AI Bridge rejects workspace path traversal', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  await assert.rejects(
    () => service.readFile('../outside.md'),
    /路径越界/
  );
});

test('workspace path policy blocks link escape and AI Bridge does not traverse links', async t => {
  const workspaceRoot = await createTempWorkspace();
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-outside-'));
  await fs.writeFile(path.join(outsideRoot, 'secret.md'), 'outside secret', 'utf8');
  const linkPath = path.join(workspaceRoot, 'linked-outside');
  try {
    await fs.symlink(outsideRoot, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error: any) {
    if (error?.code === 'EPERM' || error?.code === 'EACCES') {
      t.skip('当前环境不允许创建符号链接或目录联接。');
      return;
    }
    throw error;
  }

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  await assert.rejects(
    () => service.readFile('linked-outside/secret.md'),
    /符号链接|目录联接/
  );
  await fs.writeFile(path.join(workspaceRoot, 'inside.md'), 'inside content', 'utf8');
  try {
    await fs.symlink(path.join(workspaceRoot, 'inside.md'), path.join(workspaceRoot, 'inside-link.md'), 'file');
    await assert.rejects(
      () => service.readFile('inside-link.md'),
      /符号链接|目录联接/
    );
  } catch (error: any) {
    if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    t.diagnostic('当前环境不允许创建文件符号链接；目录联接回归仍已执行。');
  }
  const tree = await service.listWorkspaceTree();
  assert.equal(tree.some(entry => entry.name === 'linked-outside'), false);
  assert.equal(tree.some(entry => entry.name === 'inside-link.md'), false);
  await assert.rejects(
    () => service.searchFiles({ query: 'secret', include: ['linked-outside'] }),
    /符号链接|目录联接/
  );

  const policy = new WorkspacePathPolicy(workspaceRoot);
  await assert.rejects(
    () => policy.resolveForWrite('linked-outside/new.lcpp'),
    /符号链接|目录联接/
  );
  await fs.mkdir(path.join(workspaceRoot, 'safe-output'), { recursive: true });
  await fs.symlink(outsideRoot, path.join(workspaceRoot, 'safe-output', 'nested-link'), process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(
    () => policy.resolveDirectoryForWrite('safe-output'),
    /符号链接|目录联接/
  );

  const auditLog = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-log.jsonl'), 'utf8');
  assert.match(auditLog, /"action":"file.read"/u);
  assert.match(auditLog, /"ok":false/u);
});

test('renderer server runtime is loopback-only and requires a session token outside explicit dev mode', () => {
  const workspaceRoot = path.resolve(os.tmpdir(), 'lingbuilder-server-workspace');
  const rulebookPath = path.join(workspaceRoot, 'LingBuilder AI 规则手册.md');
  const base = {
    NODE_ENV: 'production',
    LINGBUILDER_WORKSPACE_ROOT: workspaceRoot,
    RULEBOOK_PATH: rulebookPath,
    STATIC_ROOT: path.join(workspaceRoot, 'dist'),
    LINGBUILDER_USER_SETTINGS_PATH: path.join(workspaceRoot, 'profile', 'settings.json'),
    SESSION_TOKEN: 'renderer-secret',
    HOST: '127.0.0.1',
    PORT: '0'
  } as NodeJS.ProcessEnv;
  const config = resolveServerRuntimeConfig(base);
  assert.equal(config.port, 0);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.userSettingsPath, path.join(workspaceRoot, 'profile', 'settings.json'));
  assert.equal(isServerSessionAuthorized(config, ''), false);
  assert.equal(isServerSessionAuthorized(config, 'wrong'), false);
  assert.equal(isServerSessionAuthorized(config, 'renderer-secret'), true);

  assert.throws(
    () => resolveServerRuntimeConfig({ ...base, HOST: '0.0.0.0' }),
    /只允许监听/
  );
  assert.throws(
    () => resolveServerRuntimeConfig({ ...base, SESSION_TOKEN: '' }),
    /SESSION_TOKEN/
  );
  assert.throws(
    () => resolveServerRuntimeConfig({
      ...base,
      LINGBUILDER_AI_BRIDGE_ENABLED: 'true',
      LINGBUILDER_AI_BRIDGE_TOKEN: ''
    }),
    /AI Bridge.*token/i
  );

  const devConfig = resolveServerRuntimeConfig({
    ...base,
    NODE_ENV: 'development',
    SESSION_TOKEN: '',
    LINGBUILDER_DEV_NO_AUTH: 'true'
  });
  assert.equal(devConfig.devNoAuth, true);
  assert.equal(isServerSessionAuthorized(devConfig, ''), true);
});

test('renderer server enforces auth and exposes safe modules, files, process, and environment APIs', { timeout: 45_000 }, async () => {
  const workspaceRoot = await createTempWorkspace();
  const staticRoot = path.join(workspaceRoot, 'static');
  const rulebookPath = path.join(workspaceRoot, 'rulebook.md');
  const userSettingsPath = path.join(workspaceRoot, 'profile', 'settings.json');
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-http-outside-'));
  const forbiddenOutput = path.join(outsideRoot, 'should-not-exist');
  await fs.mkdir(staticRoot, { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'config'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, 'external-cmake'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, 'external-cmake', 'CMakeLists.txt'), 'project(ApiImported)\n', 'utf8');
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>LingBuilder Test</title>', 'utf8');
  await fs.writeFile(rulebookPath, '# test rulebook', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, 'src', 'rename-me.lcpp'), '类 重命名测试\n结束类\n', 'utf8');
  const workspaceSearchPath = path.join(workspaceRoot, 'src', 'workspace-search-route.lcpp');
  const workspaceSearchOriginal = '类 专用搜索路由词\n    调试输出("专用搜索路由词")\n结束类\n';
  await fs.writeFile(workspaceSearchPath, workspaceSearchOriginal, 'utf8');
  const legacyEPath = path.join(workspaceRoot, 'src', 'legacy.e');
  const upperLingCppPath = path.join(workspaceRoot, 'src', 'UPPER.LCPP');
  await fs.writeFile(legacyEPath, '类 旧格式源码\n结束类\n', 'utf8');
  await fs.writeFile(upperLingCppPath, '类 大写扩展源码\n结束类\n', 'utf8');
  const formatRoundTripPath = path.join(workspaceRoot, 'src', 'format-roundtrip.lcpp');
  await fs.writeFile(
    formatRoundTripPath,
    encodeTextFile('类 编码往返\n结束类\n', { encoding: 'utf16be', eol: 'crlf' })
  );

  const testDebugAdapter = path.resolve(process.cwd(), '..', '.tools', 'LLVM', 'bin', 'lldb-dap.exe');
  const hasTestDebugAdapter = await exists(testDebugAdapter);
  const child = spawn(process.execPath, ['--import', 'tsx', path.resolve(process.cwd(), 'server.ts')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      LINGBUILDER_WORKSPACE_ROOT: workspaceRoot,
      STATIC_ROOT: staticRoot,
      RULEBOOK_PATH: rulebookPath,
      LINGBUILDER_USER_SETTINGS_PATH: userSettingsPath,
      SESSION_TOKEN: 'renderer-session-test',
      ...(hasTestDebugAdapter ? { LINGBUILDER_DEBUG_ADAPTER: testDebugAdapter } : {}),
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let stderr = '';
  child.stderr?.on('data', chunk => { stderr += String(chunk); });
  try {
    const ready = await waitForRendererReady(child, () => stderr);
    const unauthorized = await fetch(`${ready.origin}/api/health`);
    assert.equal(unauthorized.status, 401);
    const unauthorizedEnvironment = await fetch(`${ready.origin}/api/environment/check`);
    assert.equal(unauthorizedEnvironment.status, 401);
    const unauthorizedConfiguration = await fetch(`${ready.origin}/api/configuration`);
    assert.equal(unauthorizedConfiguration.status, 401);
    assert.equal((await fetch(`${ready.origin}/api/tasks`)).status, 401);
    assert.equal((await fetch(`${ready.origin}/api/terminal/sessions`)).status, 401);
    assert.equal((await fetch(`${ready.origin}/api/debug/session`)).status, 401);
    assert.equal((await fetch(`${ready.origin}/api/debug/inspection`)).status, 401);
    assert.equal((await fetch(`${ready.origin}/api/lsp/status`)).status, 401);
    const unauthorizedWorkspaceSearch = await fetch(`${ready.origin}/api/workspace-search/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '专用搜索路由词', scope: 'workspace' })
    });
    assert.equal(unauthorizedWorkspaceSearch.status, 401);

    const headers = {
      'content-type': 'application/json',
      'x-lingbuilder-session': 'renderer-session-test'
    };
    const authorized = await fetch(`${ready.origin}/api/health`, { headers });
    assert.equal(authorized.status, 200);
    const terminalCreateResponse = await fetch(`${ready.origin}/api/terminal/sessions`, {
      method: 'POST', headers, body: JSON.stringify({ profile: process.platform === 'win32' ? 'cmd' : 'shell', cwd: '.', cols: 90, rows: 25, env: { LINGBUILDER_TERMINAL_TEST: '真实终端' } })
    });
    assert.equal(terminalCreateResponse.status, 201, await terminalCreateResponse.clone().text());
    const terminalSession = (await terminalCreateResponse.json()).session;
    assert.equal(terminalSession.cols, 90); assert.equal(terminalSession.rows, 25);
    const terminalInput = process.platform === 'win32' ? 'echo %LINGBUILDER_TERMINAL_TEST%\r' : 'echo "$LINGBUILDER_TERMINAL_TEST"\n';
    assert.equal((await fetch(`${ready.origin}/api/terminal/sessions/${terminalSession.id}/input`, { method: 'POST', headers, body: JSON.stringify({ data: terminalInput }) })).status, 200);
    let terminalSnapshot: any;
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const list = await (await fetch(`${ready.origin}/api/terminal/sessions`, { headers })).json();
      terminalSnapshot = list.sessions.find((session: any) => session.id === terminalSession.id);
      if (terminalSnapshot?.buffer.includes('真实终端')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.match(terminalSnapshot?.buffer || '', /真实终端/u);
    const resizedTerminal = await fetch(`${ready.origin}/api/terminal/sessions/${terminalSession.id}/resize`, { method: 'POST', headers, body: JSON.stringify({ cols: 110, rows: 35 }) });
    assert.equal(resizedTerminal.status, 200); assert.equal((await resizedTerminal.json()).session.cols, 110);
    assert.equal((await fetch(`${ready.origin}/api/terminal/sessions/${terminalSession.id}`, { method: 'DELETE', headers })).status, 200);
    const buildConfigurationResponse = await fetch(`${ready.origin}/api/build-configuration`, { method: 'PUT', headers, body: JSON.stringify({ mode: 'Release', architecture: 'x64' }) });
    assert.equal(buildConfigurationResponse.status, 200);
    assert.deepEqual((await buildConfigurationResponse.json()).configuration, { schemaVersion: 1, mode: 'Release', architecture: 'x64' });
    assert.deepEqual(JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'build-configuration.json'), 'utf8')), { schemaVersion: 1, mode: 'Release', architecture: 'x64' });
    const debugSessionResponse = await fetch(`${ready.origin}/api/debug/session`, { headers });
    assert.equal(debugSessionResponse.status, 200); assert.equal((await debugSessionResponse.json()).session, null);
    const releaseDebugResponse = await fetch(`${ready.origin}/api/debug/start`, { method: 'POST', headers, body: JSON.stringify({ projectId: 'lingbuilder-ui-project', breakpoints: [] }) });
    assert.equal(releaseDebugResponse.status, 400); assert.match((await releaseDebugResponse.json()).error, /Debug/u);
    assert.equal((await fetch(`${ready.origin}/api/debug/next`, { method: 'POST', headers })).status, 400);
    assert.equal((await fetch(`${ready.origin}/api/debug/inspection`, { headers })).status, 400);
    if (hasTestDebugAdapter) {
      const debugConfigurationResponse = await fetch(`${ready.origin}/api/build-configuration`, { method: 'PUT', headers, body: JSON.stringify({ mode: 'Debug', architecture: 'x64' }) });
      assert.equal(debugConfigurationResponse.status, 200);
      const nativeDebugStart = await fetch(`${ready.origin}/api/debug/start`, { method: 'POST', headers, body: JSON.stringify({ projectId: 'lingbuilder-ui-project', breakpoints: [], stopAtEntry: true }) });
      assert.equal(nativeDebugStart.status, 200, await nativeDebugStart.clone().text());
      let nativeDebugSession = (await nativeDebugStart.json()).session;
      for (let attempt = 0; attempt < 80 && nativeDebugSession?.state !== 'stopped'; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
        nativeDebugSession = (await (await fetch(`${ready.origin}/api/debug/session`, { headers })).json()).session;
      }
      assert.equal(nativeDebugSession?.state, 'stopped');
      const inspectionResponse = await fetch(`${ready.origin}/api/debug/inspection`, { headers });
      assert.equal(inspectionResponse.status, 200, await inspectionResponse.clone().text());
      const inspection = (await inspectionResponse.json()).inspection;
      assert.ok(inspection.threads.length >= 1); assert.ok(inspection.stackFrames.length >= 1); assert.ok(inspection.scopes.length >= 1);
      const evaluateResponse = await fetch(`${ready.origin}/api/debug/evaluate`, { method: 'POST', headers, body: JSON.stringify({ expression: '1 + 2', frameId: inspection.frameId }) });
      assert.equal(evaluateResponse.status, 200, await evaluateResponse.clone().text()); assert.match((await evaluateResponse.json()).evaluation.result, /3/u);
      const expandable = inspection.scopes.flatMap((scope: any) => scope.variables).find((variable: any) => variable.variablesReference > 0);
      if (expandable) assert.equal((await fetch(`${ready.origin}/api/debug/variables/${expandable.variablesReference}`, { headers })).status, 200);
      assert.equal((await fetch(`${ready.origin}/api/debug/next`, { method: 'POST', headers })).status, 200);
      assert.equal((await fetch(`${ready.origin}/api/debug/stop`, { method: 'POST', headers })).status, 200);
    }
    const importedProjectResponse = await fetch(`${ready.origin}/api/solution/import`, { method: 'POST', headers, body: JSON.stringify({ projectFile: 'external-cmake/CMakeLists.txt' }) });
    assert.equal(importedProjectResponse.status, 200, await importedProjectResponse.clone().text());
    const importedProject = (await importedProjectResponse.json()).project;
    assert.equal(importedProject.type, 'external-cmake');
    const importedPropertiesResponse = await fetch(`${ready.origin}/api/solution/projects/${encodeURIComponent(importedProject.id)}`, {
      method: 'PATCH', headers, body: JSON.stringify({ buildProperties: { configuration: 'Release', architecture: 'x64', additionalArguments: ['-DAPI_TEST=ON'] } })
    });
    assert.equal(importedPropertiesResponse.status, 200);
    for (const projectId of ['dependency-core', 'dependency-app']) {
      const created = await fetch(`${ready.origin}/api/solution/projects`, { method: 'POST', headers, body: JSON.stringify({ name: projectId, projectId }) });
      assert.equal(created.status, 200, await created.clone().text());
    }
    const referenceResponse = await fetch(`${ready.origin}/api/solution/projects/dependency-app`, {
      method: 'PATCH', headers, body: JSON.stringify({ references: ['dependency-core'], startupProjectIds: ['dependency-app', 'dependency-core'] })
    });
    assert.equal(referenceResponse.status, 200);
    const referenceSolution = (await referenceResponse.json()).solution;
    assert.deepEqual(referenceSolution.projects.find((project: any) => project.id === 'dependency-app').references, ['dependency-core']);
    assert.deepEqual(referenceSolution.startupProjectIds, ['dependency-app', 'dependency-core']);
    const cycleResponse = await fetch(`${ready.origin}/api/solution/projects/dependency-core`, {
      method: 'PATCH', headers, body: JSON.stringify({ references: ['dependency-app'] })
    });
    assert.equal(cycleResponse.status, 400);
    const cleanTaskResponse = await fetch(`${ready.origin}/api/solution/clean`, { method: 'POST', headers, body: '{}' });
    assert.equal(cleanTaskResponse.status, 200, await cleanTaskResponse.clone().text());
    const cleanTask = await cleanTaskResponse.json();
    assert.equal(typeof cleanTask.taskId, 'string');
    const taskListResponse = await fetch(`${ready.origin}/api/tasks`, { headers });
    assert.equal(taskListResponse.status, 200);
    const taskList = await taskListResponse.json();
    assert.equal(taskList.tasks.find((task: any) => task.id === cleanTask.taskId)?.state, 'succeeded');
    const lspStatusResponse = await fetch(`${ready.origin}/api/lsp/status`, { headers });
    assert.equal(lspStatusResponse.status, 200);
    assert.equal((await lspStatusResponse.json()).status.state, 'stopped');
    const invalidLspDocument = await fetch(`${ready.origin}/api/lsp/documents`, {
      method: 'PUT', headers, body: JSON.stringify({ filePath: 'src/not-cpp.txt', text: 'text' })
    });
    assert.equal(invalidLspDocument.status, 400);
    const rejectedLspMethod = await fetch(`${ready.origin}/api/lsp/request`, {
      method: 'POST', headers, body: JSON.stringify({ method: 'workspace/executeCommand' })
    });
    assert.equal(rejectedLspMethod.status, 400);
    const emptyRefactorPreview = await fetch(`${ready.origin}/api/lsp/refactor/preview`, {
      method: 'POST', headers, body: JSON.stringify({ kind: 'codeAction', edit: { changes: {} } })
    });
    assert.equal(emptyRefactorPreview.status, 400);

    const invalidWorkspaceSearch = await fetch(`${ready.origin}/api/workspace-search/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query: '', scope: 'workspace' })
    });
    assert.equal(invalidWorkspaceSearch.status, 400);
    const invalidWorkspaceSearchBody = await invalidWorkspaceSearch.json();
    assert.equal(invalidWorkspaceSearchBody.ok, false);
    assert.equal(invalidWorkspaceSearchBody.code, 'INVALID_REQUEST');
    assert.match(invalidWorkspaceSearchBody.error, /搜索内容不能为空/u);

    const workspaceQueryResponse = await fetch(`${ready.origin}/api/workspace-search/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: '专用搜索路由词',
        scope: 'file',
        filePath: 'src/workspace-search-route.lcpp',
        matchCase: true
      })
    });
    assert.equal(workspaceQueryResponse.status, 200, await workspaceQueryResponse.clone().text());
    const workspaceQuery = await workspaceQueryResponse.json();
    assert.equal(workspaceQuery.ok, true);
    assert.equal(workspaceQuery.matches.length, 2);

    const workspacePreviewResponse = await fetch(`${ready.origin}/api/workspace-search/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        queryId: workspaceQuery.queryId,
        replacement: '已替换路由词'
      })
    });
    assert.equal(workspacePreviewResponse.status, 200, await workspacePreviewResponse.clone().text());
    const workspacePreview = await workspacePreviewResponse.json();
    assert.equal(workspacePreview.ok, true);
    assert.equal(workspacePreview.replacementCount, 2);
    assert.match(workspacePreview.files[0].after, /已替换路由词/u);
    assert.equal(await fs.readFile(workspaceSearchPath, 'utf8'), workspaceSearchOriginal);

    const workspaceApplyResponse = await fetch(`${ready.origin}/api/workspace-search/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ previewId: workspacePreview.previewId })
    });
    assert.equal(workspaceApplyResponse.status, 200, await workspaceApplyResponse.clone().text());
    const workspaceApply = await workspaceApplyResponse.json();
    assert.equal(workspaceApply.ok, true);
    assert.equal(workspaceApply.replacementCount, 2);
    assert.match(await fs.readFile(workspaceSearchPath, 'utf8'), /已替换路由词/u);

    const workspaceRollbackResponse = await fetch(`${ready.origin}/api/workspace-search/rollback`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ transactionId: workspaceApply.transactionId })
    });
    assert.equal(workspaceRollbackResponse.status, 200, await workspaceRollbackResponse.clone().text());
    const workspaceRollback = await workspaceRollbackResponse.json();
    assert.equal(workspaceRollback.ok, true);
    assert.deepEqual(workspaceRollback.restoredFiles, ['src/workspace-search-route.lcpp']);
    assert.equal(await fs.readFile(workspaceSearchPath, 'utf8'), workspaceSearchOriginal);

    const staleWorkspaceQueryResponse = await fetch(`${ready.origin}/api/workspace-search/query`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: '专用搜索路由词',
        scope: 'file',
        filePath: 'src/workspace-search-route.lcpp'
      })
    });
    assert.equal(staleWorkspaceQueryResponse.status, 200, await staleWorkspaceQueryResponse.clone().text());
    const staleWorkspaceQuery = await staleWorkspaceQueryResponse.json();
    const staleWorkspacePreviewResponse = await fetch(`${ready.origin}/api/workspace-search/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ queryId: staleWorkspaceQuery.queryId, replacement: '冲突路由词' })
    });
    assert.equal(staleWorkspacePreviewResponse.status, 200, await staleWorkspacePreviewResponse.clone().text());
    const staleWorkspacePreview = await staleWorkspacePreviewResponse.json();
    await fs.writeFile(workspaceSearchPath, '类 外部修改\n结束类\n', 'utf8');
    const staleWorkspaceApplyResponse = await fetch(`${ready.origin}/api/workspace-search/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ previewId: staleWorkspacePreview.previewId })
    });
    assert.equal(staleWorkspaceApplyResponse.status, 409);
    const staleWorkspaceApply = await staleWorkspaceApplyResponse.json();
    assert.equal(staleWorkspaceApply.ok, false);
    assert.equal(staleWorkspaceApply.code, 'FILE_CHANGED');
    assert.match(staleWorkspaceApply.error, /文件在预览后被修改|已在搜索后被修改/u);
    assert.equal(await fs.readFile(workspaceSearchPath, 'utf8'), '类 外部修改\n结束类\n');
    await fs.writeFile(workspaceSearchPath, workspaceSearchOriginal, 'utf8');

    const projectFilesResponse = await fetch(
      `${ready.origin}/api/window-designer/files?projectId=lingbuilder-ui-project`,
      { headers }
    );
    assert.equal(projectFilesResponse.status, 200, await projectFilesResponse.clone().text());
    const projectFiles = await projectFilesResponse.json();
    assert.equal(projectFiles.files['src/format-roundtrip.lcpp'], '类 编码往返\n结束类\n');
    assert.deepEqual(projectFiles.fileFormats['src/format-roundtrip.lcpp'], {
      encoding: 'utf16be',
      eol: 'crlf'
    });
    assert.equal(projectFiles.files['src/legacy.e'], '类 旧格式源码\n结束类\n');
    assert.equal(projectFiles.files['src/UPPER.LCPP'], '类 大写扩展源码\n结束类\n');

    const saveProjectFilesResponse = await fetch(`${ready.origin}/api/window-designer/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: 'lingbuilder-ui-project',
        files: {
          'src/format-roundtrip.lcpp': '类 已转换编码\n结束类\n',
          'src/legacy.e': '类 已保存旧格式源码\n结束类\n',
          'src/UPPER.LCPP': '类 已保存大写扩展源码\n结束类\n'
        },
        fileFormats: {
          'src/format-roundtrip.lcpp': { encoding: 'utf8bom', eol: 'crlf' },
          'src/legacy.e': { encoding: 'utf8', eol: 'lf' },
          'src/UPPER.LCPP': { encoding: 'utf8bom', eol: 'lf' }
        }
      })
    });
    assert.equal(saveProjectFilesResponse.status, 200, await saveProjectFilesResponse.clone().text());
    const savedFormat = decodeTextFile(await fs.readFile(formatRoundTripPath));
    assert.equal(savedFormat.content, '类 已转换编码\n结束类\n');
    assert.deepEqual(savedFormat.format, { encoding: 'utf8bom', eol: 'crlf' });
    assert.equal((await fs.readFile(legacyEPath, 'utf8')), '类 已保存旧格式源码\n结束类\n');
    assert.deepEqual(decodeTextFile(await fs.readFile(upperLingCppPath)).format, {
      encoding: 'utf8bom',
      eol: 'lf'
    });

    const invalidProjectFormatResponse = await fetch(`${ready.origin}/api/window-designer/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: 'lingbuilder-ui-project',
        files: {
          'src/legacy.e': '该文件也不能部分写入',
          'src/format-roundtrip.lcpp': '不会写入'
        },
        fileFormats: { 'src/format-roundtrip.lcpp': { encoding: 'gbk', eol: 'lf' } }
      })
    });
    assert.equal(invalidProjectFormatResponse.status, 400);
    assert.match((await invalidProjectFormatResponse.json()).error, /不支持的文本编码/u);
    assert.equal((await fs.readFile(legacyEPath, 'utf8')), '类 已保存旧格式源码\n结束类\n');

    const rejectedProjectExtensionResponse = await fetch(`${ready.origin}/api/window-designer/files`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: 'lingbuilder-ui-project',
        files: { 'src/unsupported.exe': '不能静默跳过' }
      })
    });
    assert.equal(rejectedProjectExtensionResponse.status, 400);
    assert.match((await rejectedProjectExtensionResponse.json()).error, /不支持保存该项目文件类型/u);

    const linkedProjectDirectory = path.join(workspaceRoot, 'src', 'linked-outside');
    const outsideLinkedFile = path.join(outsideRoot, 'escape.lcpp');
    await fs.writeFile(outsideLinkedFile, '外部原内容', 'utf8');
    let linkedProjectDirectoryCreated = false;
    try {
      await fs.symlink(
        outsideRoot,
        linkedProjectDirectory,
        process.platform === 'win32' ? 'junction' : 'dir'
      );
      linkedProjectDirectoryCreated = true;
    } catch (error: any) {
      if (error?.code !== 'EPERM' && error?.code !== 'EACCES') throw error;
    }
    if (linkedProjectDirectoryCreated) {
      const linkedProjectWriteResponse = await fetch(`${ready.origin}/api/window-designer/files`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          projectId: 'lingbuilder-ui-project',
          files: { 'src/linked-outside/escape.lcpp': '不得写到工作区外' }
        })
      });
      assert.equal(linkedProjectWriteResponse.status, 400);
      assert.match((await linkedProjectWriteResponse.json()).error, /符号链接|目录联接/u);
      assert.equal(await fs.readFile(outsideLinkedFile, 'utf8'), '外部原内容');
    }

    const configurationResponse = await fetch(`${ready.origin}/api/configuration`, { headers });
    assert.equal(configurationResponse.status, 200, await configurationResponse.clone().text());
    const initialConfiguration = await configurationResponse.json();
    assert.equal(initialConfiguration.ok, true);
    assert.ok(initialConfiguration.settings.length >= 9, '配置 API 应至少返回既有核心设置，新增设置不应破坏集成测试。');
    assert.equal(
      initialConfiguration.settings.find((item: any) => item.metadata.key === 'files.autoSave')?.inspection.value,
      'off'
    );
    assert.equal(
      initialConfiguration.settings.find((item: any) => item.metadata.key === 'files.autoSaveDelay')?.inspection.value,
      1200
    );
    const updatedConfigurationResponse = await fetch(`${ready.origin}/api/configuration`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ key: 'editor.fontSize', target: 'user', value: 17 })
    });
    assert.equal(updatedConfigurationResponse.status, 200, await updatedConfigurationResponse.clone().text());
    const updatedConfiguration = await updatedConfigurationResponse.json();
    assert.equal(
      updatedConfiguration.settings.find((item: any) => item.metadata.key === 'editor.fontSize')?.inspection.value,
      17
    );
    assert.equal((JSON.parse(await fs.readFile(userSettingsPath, 'utf8'))).values['editor.fontSize'], 17);

    const workspaceThemeResponse = await fetch(`${ready.origin}/api/configuration`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ key: 'workbench.colorTheme', target: 'workspace', value: 'light' })
    });
    assert.equal(workspaceThemeResponse.status, 200, await workspaceThemeResponse.clone().text());
    const workspaceSettingsPath = path.join(workspaceRoot, '.lingbuilder', 'settings.json');
    assert.equal((JSON.parse(await fs.readFile(workspaceSettingsPath, 'utf8'))).values['workbench.colorTheme'], 'light');

    const invalidFontResponse = await fetch(`${ready.origin}/api/configuration`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ key: 'editor.fontSize', target: 'user', value: 99 })
    });
    assert.equal(invalidFontResponse.status, 400);
    assert.match((await invalidFontResponse.json()).error, /不能大于 24/u);

    const unsafeShortcutResponse = await fetch(`${ready.origin}/api/configuration`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        key: 'keyboard.shortcuts',
        target: 'user',
        value: { 'workbench.action.build.run': 'A' }
      })
    });
    assert.equal(unsafeShortcutResponse.status, 400);
    assert.match((await unsafeShortcutResponse.json()).error, /文字输入|全局快捷键/u);

    const resetThemeResponse = await fetch(
      `${ready.origin}/api/configuration/${encodeURIComponent('workbench.colorTheme')}?target=workspace`,
      { method: 'DELETE', headers }
    );
    assert.equal(resetThemeResponse.status, 200, await resetThemeResponse.clone().text());
    const resetTheme = await resetThemeResponse.json();
    assert.equal(
      resetTheme.settings.find((item: any) => item.metadata.key === 'workbench.colorTheme')?.inspection.source,
      'default'
    );

    const environmentResponse = await fetch(`${ready.origin}/api/environment/check`, { headers });
    assert.equal(environmentResponse.status, 200, await environmentResponse.clone().text());
    const environmentResult = await environmentResponse.json();
    assert.equal(environmentResult.ok, true);
    assert.equal(typeof environmentResult.ready, 'boolean');
    assert.equal(typeof environmentResult.cppCompilerAvailable, 'boolean');
    assert.equal(typeof environmentResult.msvcBuildReady, 'boolean');
    assert.equal(environmentResult.checks.length, 8);
    for (const check of environmentResult.checks) {
      assert.equal(typeof check.id, 'string');
      assert.equal(typeof check.label, 'string');
      assert.equal(typeof check.required, 'boolean');
      assert.equal(typeof check.available, 'boolean');
      assert.equal(typeof check.detail, 'string');
    }
    const compilerChecks = environmentResult.checks.filter((check: any) => ['msvc', 'gpp', 'clangpp'].includes(check.id));
    assert.equal(compilerChecks.length, 3);
    assert.equal(compilerChecks.find((check: any) => check.id === 'msvc')?.required, true);
    assert.equal(compilerChecks.find((check: any) => check.id === 'gpp')?.required, false);
    assert.equal(compilerChecks.find((check: any) => check.id === 'clangpp')?.required, false);
    const msvcAvailable = compilerChecks.find((check: any) => check.id === 'msvc')?.available === true;
    const windowsSdkAvailable = environmentResult.checks.find((check: any) => check.id === 'windowsSdk')?.available === true;
    assert.equal(environmentResult.ready, environmentResult.msvcBuildReady);
    if (environmentResult.ready) assert.equal(msvcAvailable && windowsSdkAvailable, true);

    const environmentRepairStatusResponse = await fetch(`${ready.origin}/api/environment/repair/status`, { headers });
    assert.equal(environmentRepairStatusResponse.status, 200, await environmentRepairStatusResponse.clone().text());
    const environmentRepairStatus = await environmentRepairStatusResponse.json();
    assert.equal(environmentRepairStatus.ok, true);
    assert.equal(environmentRepairStatus.repair.state, 'idle');
    assert.equal(environmentRepairStatus.repair.active, false);

    const invalidEnvironmentRepairResponse = await fetch(`${ready.origin}/api/environment/repair/start`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ target: 'arbitrary-shell' })
    });
    assert.equal(invalidEnvironmentRepairResponse.status, 400);

    const bridge = await fetch(`${ready.origin}/api/ai-bridge/health?token=renderer-session-test`);
    assert.equal(bridge.status, 404);

    const forbiddenModulePath = await fetch(`${ready.origin}/api/modules/developer/template`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ outDir: forbiddenOutput })
    });
    assert.ok(forbiddenModulePath.status >= 400);
    assert.equal(await exists(forbiddenOutput), false);

    const allowedModulePath = await fetch(`${ready.origin}/api/modules/developer/template`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ outDir: '.lingbuilder/module-build/http-test-module', id: 'test.http.module' })
    });
    assert.equal(allowedModulePath.status, 200, await allowedModulePath.text());

    const missingProject = await fetch(`${ready.origin}/api/modules/project`, { headers });
    assert.ok(missingProject.status >= 400);
    const validProject = await fetch(`${ready.origin}/api/modules/project?projectId=lingbuilder-ui-project`, { headers });
    assert.equal(validProject.status, 200, await validProject.text());

    const renamedFile = await fetch(`${ready.origin}/api/window-designer/files/rename`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: 'lingbuilder-ui-project',
        sourcePath: 'src/rename-me.lcpp',
        targetPath: 'src/renamed.lcpp'
      })
    });
    assert.equal(renamedFile.status, 200, await renamedFile.text());
    assert.equal(await exists(path.join(workspaceRoot, 'src', 'rename-me.lcpp')), false);
    assert.equal(await fs.readFile(path.join(workspaceRoot, 'src', 'renamed.lcpp'), 'utf8'), '类 重命名测试\n结束类\n');

    const rejectedDelete = await fetch(`${ready.origin}/api/window-designer/files/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId: 'lingbuilder-ui-project', filePath: '../outside.lcpp' })
    });
    assert.ok(rejectedDelete.status >= 400);

    const deletedFile = await fetch(`${ready.origin}/api/window-designer/files/delete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId: 'lingbuilder-ui-project', filePath: 'src/renamed.lcpp' })
    });
    assert.equal(deletedFile.status, 200, await deletedFile.text());
    assert.equal(await exists(path.join(workspaceRoot, 'src', 'renamed.lcpp')), false);

    const emptyRunStatus = await fetch(
      `${ready.origin}/api/window-designer/run-status?projectId=lingbuilder-ui-project`,
      { headers }
    );
    assert.equal(emptyRunStatus.status, 200, await emptyRunStatus.clone().text());
    assert.equal((await emptyRunStatus.json()).status, null);

    const removedProjectRunStatus = await fetch(
      `${ready.origin}/api/window-designer/run-status?projectId=already-removed-project`,
      { headers }
    );
    assert.equal(removedProjectRunStatus.status, 200, await removedProjectRunStatus.clone().text());
    assert.equal((await removedProjectRunStatus.json()).status, null);

    const stopWithoutProcess = await fetch(`${ready.origin}/api/window-designer/stop`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projectId: 'lingbuilder-ui-project' })
    });
    assert.equal(stopWithoutProcess.status, 200, await stopWithoutProcess.clone().text());
    assert.equal((await stopWithoutProcess.json()).stopped, false);

    const stopAllWithoutProcess = await fetch(`${ready.origin}/api/window-designer/stop`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ all: true })
    });
    assert.equal(stopAllWithoutProcess.status, 200, await stopAllWithoutProcess.clone().text());
    assert.equal((await stopAllWithoutProcess.json()).stoppedCount, 0);
  } finally {
    await stopChild(child);
  }
});

test('AI Bridge permission modes gate edit apply', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/main.lcpp';
  const sourceCode = '类 Main\n结束类\n';
  await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');

  const previewService = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const previewProposal = await previewService.proposeEdit({
    filePath: sourcePath,
    sourceCode,
    instruction: '添加一条注释',
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 外部 AI 已提供完整文件草稿\n` }]
  });
  await assert.rejects(
    () => previewService.applyEdit({ proposalId: previewProposal.proposal.id }),
    /预览确认模式/
  );
  const deniedAudit = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-log.jsonl'), 'utf8');
  assert.match(deniedAudit, /"action":"edit.apply"/u);
  assert.match(deniedAudit, /"ok":false/u);

  const applied = await previewService.applyEdit({
    proposalId: previewProposal.proposal.id,
    approved: true
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.appliedFiles.length, 1);

  const readonlyService = new AiBridgeService(createOptions(workspaceRoot, 'readonly'));
  const readonlyProposal = await readonlyService.proposeEdit({
    filePath: sourcePath,
    sourceCode,
    instruction: '添加一条注释',
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 只读模式草稿\n` }]
  });
  await assert.rejects(
    () => readonlyService.applyEdit({ proposalId: readonlyProposal.proposal.id, approved: true }),
    /只读模式/
  );
});

test('standalone AI Bridge refuses fake local edit proposals when no planner or full draft is provided', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  await assert.rejects(() => service.proposeEdit({ filePath: 'src/main.lcpp', sourceCode: '类 Main\n结束类\n', instruction: '添加功能' }), /未配置系统 AI planner/u);
});

test('AI Bridge reads and applies edits without corrupting UTF-16 or CRLF files', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/编码测试.lcpp';
  const absolutePath = path.join(workspaceRoot, sourcePath);
  const sourceCode = '类 编码测试\n    事件 创建完毕()\n    结束\n结束类\n';
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, encodeTextFile(sourceCode, { encoding: 'utf16le', eol: 'crlf' }));

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const read = await service.readFile(sourcePath);
  assert.equal(read.content, sourceCode);
  assert.deepEqual(read.format, { encoding: 'utf16le', eol: 'crlf' });

  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    instruction: '补充编码安全说明',
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 外部 AI 编码安全说明\n` }]
  });
  const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
  assert.equal(applied.ok, true);

  const persistedBytes = await fs.readFile(absolutePath);
  const persisted = decodeTextFile(persistedBytes);
  assert.deepEqual(persisted.format, { encoding: 'utf16le', eol: 'crlf' });
  assert.match(persisted.content, /外部 AI 编码安全说明/u);
  assert.match(persistedBytes.subarray(2).toString('utf16le'), /\r\n/u);
});

test('AI Bridge diagnostics and modules use LingCpp module context', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const diagnostics = await service.getLingCppDiagnostics({
    filePath: 'src/main.lcpp',
    sourceCode: '类 Main\n    事件 _按钮1_被单击()\n        未启用模块命令()\n结束类\n'
  });
  assert.equal(diagnostics.ok, true);
  assert.ok(Array.isArray(diagnostics.diagnostics));
  assert.equal(typeof diagnostics.moduleContextSummary, 'string');

  const modules = await service.listModules();
  assert.equal(modules.ok, true);
  assert.ok(Array.isArray(modules.availableModules));
  assert.equal(typeof modules.summary, 'string');
});

test('AI Bridge diagnostics load project constants from the fixed symbol file', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'constants-project';
  const sourceRoot = `src/${projectId}`;
  await fs.mkdir(path.join(workspaceRoot, '.lingbuilder'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'constants-solution',
    name: '项目常量测试',
    startupProjectId: projectId,
    projects: [{
      id: projectId,
      name: '项目常量测试',
      type: 'visual-cpp',
      sourceRoot,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`
    }]
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, '项目全局变量.lcpp'), '常量 整数型 最大重试次数 = 3\n', 'utf8');
  const sourceCode = '类 Main\n    事件 创建完毕()\n        最大重试次数 = 4\n    结束\n结束类\n';
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), sourceCode, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({
    projectId,
    filePath: `${sourceRoot}/main.lcpp`,
    sourceCode
  });
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.message.includes('最大重试次数') && diagnostic.message.includes('不能重新赋值')));
});

test('AI Bridge diagnostics load project data types while checking the fixed globals file', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'typed-globals-project';
  const sourceRoot = `src/${projectId}`;
  await fs.mkdir(path.join(workspaceRoot, '.lingbuilder'), { recursive: true });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'typed-globals-solution',
    name: '自定义类型全局变量测试',
    startupProjectId: projectId,
    projects: [{
      id: projectId,
      name: '自定义类型全局变量测试',
      type: 'visual-cpp',
      sourceRoot,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`
    }]
  }, null, 2), 'utf8');
  await fs.writeFile(
    path.join(workspaceRoot, sourceRoot, '项目数据类型.lcpp'),
    '数据类型 用户信息\n    文本型 姓名 = ""\n结束数据类型\n',
    'utf8'
  );
  const globalsPath = `${sourceRoot}/项目全局变量.lcpp`;
  const globalsSource = '全局 用户信息 当前用户\n';
  await fs.writeFile(path.join(workspaceRoot, globalsPath), globalsSource, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: globalsPath });

  assert.equal(
    result.diagnostics.some(diagnostic => diagnostic.message.includes('未知类型 用户信息')),
    false,
    JSON.stringify(result.diagnostics)
  );
});

test('AI Bridge native export writes Visual Studio project files', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.nativeExport({
    approved: true,
    project: {
      id: 'vs-export-demo',
      name: 'VS 导出演示',
      windows: [
        {
          id: 'main-window',
          fileName: 'MainWindow.xml',
          className: 'MainWindow',
          title: '主窗口',
          width: 640,
          height: 480,
          background: '#202020',
          description: '主窗口',
          controls: []
        }
      ]
    },
    activeWindowId: 'main-window',
    lingCppSourceCode: '类 MainWindow\n结束类\n',
    lingCppSourceFilePath: 'src/MainWindow.lcpp'
  });

  assert.equal(result.ok, true);
  assert.ok(result.visualStudioProject.solutionPath.endsWith('vs-export-demo.sln'));
  assert.ok(await exists(result.visualStudioProject.solutionPath));
  assert.ok(await exists(result.visualStudioProject.projectPath));
  assert.ok(await exists(result.visualStudioProject.filtersPath));
});

test('AI Bridge stopRuns and shutdown stop every managed run', async () => {
  const workspaceRoot = await createTempWorkspace();
  let stopCalls = 0;
  const processManager: AiBridgeProcessManager = {
    async start() {
      throw new Error('本测试不应启动进程。');
    },
    async stop(projectId) {
      return { projectId, found: false, stopped: false, forced: false, message: '没有受控运行进程。' };
    },
    async stopAll() {
      stopCalls += 1;
      return {
        total: 1,
        stopped: 1,
        forced: 0,
        results: [],
        message: '已停止 1/1 个受控运行进程。'
      };
    }
  };
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'), {
    managedProcessService: processManager
  });

  const stopped = await service.stopRuns();
  assert.equal(stopped.stopped, 1);
  const shutdown = await service.shutdown();
  assert.equal(shutdown.message, '已停止 1/1 个受控运行进程。');
  assert.equal(stopCalls, 2);
});

test('embedded AI Bridge can share the renderer build coordinator and rejects cross-entry races', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sharedCoordinator = createProjectBuildCoordinator();
  const rendererLease = sharedCoordinator.begin('shared-project');
  let stopCalls = 0;
  const processManager: AiBridgeProcessManager = {
    async start() {
      throw new Error('跨入口互斥时不应启动进程。');
    },
    async stop(projectId) {
      stopCalls += 1;
      return { projectId, found: false, stopped: false, forced: false, message: '没有受控运行进程。' };
    },
    async stopAll() {
      return { total: 0, stopped: 0, forced: 0, results: [], message: '没有受控运行进程。' };
    }
  };
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'), {
    managedProcessService: processManager,
    projectBuildCoordinator: sharedCoordinator
  });

  try {
    const result = await service.buildRun({
      approved: true,
      project: {
        id: 'shared-project',
        name: '跨入口互斥测试',
        windows: [{
          id: 'main-window',
          fileName: 'MainWindow.xml',
          className: 'MainWindow',
          title: '主窗口',
          width: 640,
          height: 480,
          background: '#202020',
          description: '主窗口',
          controls: []
        }]
      },
      run: true
    });
    assert.equal(result.ok, false);
    assert.equal(result.stage, 'busy');
    assert.equal(stopCalls, 0, '未取得共享租约时不能停止或覆盖另一入口的运行状态');
  } finally {
    rendererLease.finish();
  }

  const collisionLease = sharedCoordinator.begin('collision_project');
  try {
    const collisionResult = await service.buildRun({
      approved: true,
      project: {
        id: 'collision:project',
        name: '规范化 ID 互斥测试',
        windows: [{
          id: 'main-window',
          fileName: 'MainWindow.xml',
          className: 'MainWindow',
          title: '主窗口',
          width: 640,
          height: 480,
          background: '#202020',
          description: '主窗口',
          controls: []
        }]
      },
      run: true
    });
    assert.equal(collisionResult.stage, 'busy');
  } finally {
    collisionLease.finish();
  }

  const pendingBuild = service.buildRun({
    approved: true,
    project: {
      id: 'pending-shared-project',
      name: '跨入口停止代次测试',
      windows: [{
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: '主窗口',
        width: 640,
        height: 480,
        background: '#202020',
        description: '主窗口',
        controls: []
      }]
    },
    run: true
  });
  sharedCoordinator.cancelAll('user');
  const cancelledPendingBuild = await pendingBuild;
  assert.equal(cancelledPendingBuild.stage, 'cancelled');
  assert.equal(stopCalls, 0, '停止代次应在项目查找/权限等待后建租约前拒绝迟到任务');
});

test('AI Bridge build.run reports managed process start failure instead of false success', async () => {
  const workspaceRoot = await createTempWorkspace();
  const lifecycleEvents: string[] = [];
  const startCalls: Array<{
    projectId: string;
    command: string;
    detached: boolean | undefined;
    logFilePath: string | undefined;
  }> = [];
  const processManager: AiBridgeProcessManager = {
    async start(projectId, command, options) {
      lifecycleEvents.push('start');
      startCalls.push({
        projectId,
        command,
        detached: options.detached,
        logFilePath: options.logFilePath
      });
      throw new Error('模拟运行窗口启动失败');
    },
    async stop(projectId) {
      lifecycleEvents.push('stop-before-build');
      return { projectId, found: false, stopped: false, forced: false, message: '没有受控运行进程。' };
    },
    async stopAll() {
      return {
        total: 0,
        stopped: 0,
        forced: 0,
        results: [],
        message: '当前没有需要停止的受控运行进程。'
      };
    }
  };
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'), {
    managedProcessService: processManager,
    detectCompiler: async () => ({ kind: 'msvc', command: 'fake-cl' }),
    compileWin32Preview: async () => {
      lifecycleEvents.push('compile');
      return { ok: true, logs: ['模拟编译成功。'] };
    }
  });

  const result = await service.buildRun({
    approved: true,
    project: {
      id: 'managed-run-failure',
      name: '受控运行失败测试',
      windows: [{
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: '主窗口',
        width: 640,
        height: 480,
        background: '#202020',
        description: '主窗口',
        controls: []
      }]
    },
    activeWindowId: 'main-window',
    lingCppSourceCode: '类 MainWindow\n结束类\n',
    run: true
  });

  assert.equal(result.ok, false);
  assert.equal(result.stage, 'run-start');
  assert.match(result.logs.join('\n'), /模拟运行窗口启动失败/u);
  assert.equal(startCalls.length, 1);
  assert.equal(startCalls[0]?.projectId, 'managed-run-failure');
  assert.equal(startCalls[0]?.detached, false);
  assert.ok(startCalls[0]?.command.endsWith('LingBuilderPreview.exe'));
  assert.ok(startCalls[0]?.logFilePath?.endsWith('run.log'));
  assert.deepEqual(lifecycleEvents, ['stop-before-build', 'compile', 'start']);

  const auditLog = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-log.jsonl'), 'utf8');
  assert.match(auditLog, /"action":"build.run"/u);
  assert.match(auditLog, /"ok":false/u);
  assert.match(auditLog, /run-start/u);
});

test('AI Bridge shutdown waits for an in-flight compile and prevents a late process start', async () => {
  const workspaceRoot = await createTempWorkspace();
  const compileStarted = createDeferred<void>();
  const releaseCompile = createDeferred<void>();
  const lifecycleEvents: string[] = [];
  let stopAllCalls = 0;
  const processManager: AiBridgeProcessManager = {
    async start() {
      lifecycleEvents.push('unexpected-start');
      throw new Error('取消后的任务不应启动进程。');
    },
    async stop(projectId) {
      lifecycleEvents.push('stop-before-build');
      return { projectId, found: false, stopped: false, forced: false, message: '没有受控运行进程。' };
    },
    async stopAll() {
      lifecycleEvents.push('stop-all');
      stopAllCalls += 1;
      return {
        total: 0,
        stopped: 0,
        forced: 0,
        results: [],
        message: '当前没有需要停止的受控运行进程。'
      };
    }
  };
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'), {
    managedProcessService: processManager,
    detectCompiler: async () => ({ kind: 'msvc', command: 'fake-cl' }),
    compileWin32Preview: async () => {
      lifecycleEvents.push('compile-start');
      compileStarted.resolve();
      await releaseCompile.promise;
      lifecycleEvents.push('compile-finish');
      return { ok: true, logs: ['模拟编译成功。'] };
    }
  });

  const buildPromise = service.buildRun({
    approved: true,
    project: {
      id: 'shutdown-during-build',
      name: '关服竞态测试',
      windows: [{
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: '主窗口',
        width: 640,
        height: 480,
        background: '#202020',
        description: '主窗口',
        controls: []
      }]
    },
    activeWindowId: 'main-window',
    lingCppSourceCode: '类 MainWindow\n结束类\n',
    run: true
  });
  await compileStarted.promise;
  const shutdownPromise = service.shutdown();
  await Promise.resolve();
  assert.equal(stopAllCalls, 0, '在途编译未退出前不应提前完成最终进程快照');

  releaseCompile.resolve();
  const [buildResult, shutdownResult] = await Promise.all([buildPromise, shutdownPromise]);
  assert.equal(buildResult.ok, false);
  assert.equal(buildResult.stage, 'cancelled');
  assert.equal(shutdownResult.stopped, 0);
  assert.equal(stopAllCalls, 1);
  assert.deepEqual(lifecycleEvents, [
    'stop-before-build',
    'compile-start',
    'compile-finish',
    'stop-all'
  ]);

  const rejectedAfterShutdown = await service.buildRun({
    approved: true,
    project: {
      id: 'after-shutdown',
      name: '关闭后拒绝测试',
      windows: [{
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: '主窗口',
        width: 640,
        height: 480,
        background: '#202020',
        description: '主窗口',
        controls: []
      }]
    },
    run: true
  });
  assert.equal(rejectedAfterShutdown.stage, 'cancelled');
});

test('AI Bridge CLI handles SIGTERM by shutting down managed runs', { timeout: 15_000 }, async () => {
  const workspaceRoot = await createTempWorkspace();
  const signalPreload = `data:text/javascript,${encodeURIComponent([
    'const timer = setInterval(() => {',
    "  if (process.listenerCount('SIGTERM') > 0) {",
    '    clearInterval(timer);',
    "    process.emit('SIGTERM', 'SIGTERM');",
    '  }',
    '}, 10);'
  ].join('\n'))}`;
  const child = spawn(
    process.execPath,
    [
      '--import',
      signalPreload,
      '--import',
      'tsx',
      path.resolve(process.cwd(), 'src/cli.ts'),
      'ai-server',
      '--workspace',
      workspaceRoot,
      '--port',
      '0',
      '--token',
      'cli-shutdown-test'
    ],
    {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe']
    }
  );
  let output = '';
  child.stdout?.on('data', chunk => { output += String(chunk); });
  child.stderr?.on('data', chunk => { output += String(chunk); });

  try {
    const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(resolve => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
    await waitForChildOutput(child, () => output, /LingBuilder AI Bridge listening/u);
    const exit = await exitPromise;
    assert.equal(exit.code, 143, `CLI 退出异常：${output}`);
    assert.equal(exit.signal, null);
    assert.match(output, /正在停止 AI Bridge 及其受控运行进程/u);
    assert.match(output, /当前没有需要停止的受控运行进程/u);
  } finally {
    await stopChild(child);
  }
});

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-bridge-'));
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForChildOutput(
  child: ReturnType<typeof spawn>,
  getOutput: () => string,
  pattern: RegExp
): Promise<void> {
  if (pattern.test(getOutput())) return;
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => finish(new Error(`等待 CLI 输出超时：\n${getOutput()}`)), 10_000);
    const onData = () => {
      if (pattern.test(getOutput())) finish();
    };
    const onExit = (code: number | null) => finish(new Error(`CLI 在就绪前退出（${code}）：\n${getOutput()}`));
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      child.stdout?.off('data', onData);
      child.stderr?.off('data', onData);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve();
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.once('exit', onExit);
  });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function createOptions(
  workspaceRoot: string,
  permission: AiBridgeServerOptions['permission'],
  token = 'test-token'
): AiBridgeServerOptions {
  return {
    workspaceRoot,
    host: '127.0.0.1',
    port: 0,
    token,
    permission,
    allowRemote: false,
    enableMcp: false
  };
}

async function waitForRendererReady(
  child: ReturnType<typeof spawn>,
  getStderr: () => string
): Promise<{ origin: string; host: string; port: number }> {
  return await new Promise((resolve, reject) => {
    const stdout = child.stdout;
    if (!stdout) {
      reject(new Error('renderer server stdout is unavailable'));
      return;
    }
    let buffer = '';
    const timeout = setTimeout(() => finish(new Error(`renderer server ready timeout\n${getStderr()}`)), 15_000);
    const onData = (chunk: Buffer | string) => {
      buffer += String(chunk);
      const line = buffer.split(/\r?\n/u).find(value => value.startsWith('LINGBUILDER_SERVER_READY '));
      if (!line) return;
      try {
        const info = JSON.parse(line.slice('LINGBUILDER_SERVER_READY '.length)) as { origin: string; host: string; port: number };
        finish(undefined, info);
      } catch (error) {
        finish(error instanceof Error ? error : new Error(String(error)));
      }
    };
    const onExit = (code: number | null) => finish(new Error(`renderer server exited with ${code}\n${getStderr()}`));
    const finish = (error?: Error, info?: { origin: string; host: string; port: number }) => {
      clearTimeout(timeout);
      stdout.off('data', onData);
      child.off('exit', onExit);
      if (error) reject(error);
      else resolve(info as { origin: string; host: string; port: number });
    };
    stdout.on('data', onData);
    child.once('exit', onExit);
  });
}

async function stopChild(child: ReturnType<typeof spawn>): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    const timeout = setTimeout(resolve, 5_000);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.kill('SIGTERM');
  });
}

async function listen(app: express.Express): Promise<{ port: number; close: () => Promise<void> }> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Failed to listen');
  return {
    port: address.port,
    close: () => new Promise(resolve => server.close(() => resolve()))
  };
}
