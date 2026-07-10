import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import express from 'express';

import { AiBridgeService } from '../src/services/aiBridge/aiBridgeService';
import { createAiBridgeRouter } from '../src/services/aiBridge/httpRoutes';
import { AiBridgeServerOptions } from '../src/services/aiBridge/types';
import {
  isServerSessionAuthorized,
  resolveServerRuntimeConfig
} from '../src/services/server/serverRuntime';
import { WorkspacePathPolicy } from '../src/services/workspace/workspacePathPolicy';

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
    SESSION_TOKEN: 'renderer-secret',
    HOST: '127.0.0.1',
    PORT: '0'
  } as NodeJS.ProcessEnv;
  const config = resolveServerRuntimeConfig(base);
  assert.equal(config.port, 0);
  assert.equal(config.host, '127.0.0.1');
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

test('renderer server enforces session auth, keeps embedded bridge disabled and restricts module HTTP paths', { timeout: 20_000 }, async () => {
  const workspaceRoot = await createTempWorkspace();
  const staticRoot = path.join(workspaceRoot, 'static');
  const rulebookPath = path.join(workspaceRoot, 'rulebook.md');
  const outsideRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-module-http-outside-'));
  const forbiddenOutput = path.join(outsideRoot, 'should-not-exist');
  await fs.mkdir(staticRoot, { recursive: true });
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>LingBuilder Test</title>', 'utf8');
  await fs.writeFile(rulebookPath, '# test rulebook', 'utf8');

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
      SESSION_TOKEN: 'renderer-session-test',
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

    const headers = {
      'content-type': 'application/json',
      'x-lingbuilder-session': 'renderer-session-test'
    };
    const authorized = await fetch(`${ready.origin}/api/health`, { headers });
    assert.equal(authorized.status, 200);

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
    instruction: '添加一条注释'
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
    instruction: '添加一条注释'
  });
  await assert.rejects(
    () => readonlyService.applyEdit({ proposalId: readonlyProposal.proposal.id, approved: true }),
    /只读模式/
  );
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

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-bridge-'));
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
