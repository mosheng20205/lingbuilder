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
import type { LingWindowProject } from '../src/services/windowDesigner/types';

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
    assert.equal(tools.tools.length, 23);
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.file.read'));
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.project.create'));
    for (const moduleName of ['lingbuilder.module.scaffold', 'lingbuilder.module.writeFiles', 'lingbuilder.module.validate', 'lingbuilder.module.pack', 'lingbuilder.module.installPreview', 'lingbuilder.module.install']) {
      assert.ok(tools.tools.some(tool => tool.name === moduleName), `缺少 MCP 模块工具：${moduleName}`);
    }
    const scaffoldTool = tools.tools.find(tool => tool.name === 'lingbuilder.module.scaffold');
    assert.ok((scaffoldTool?.inputSchema as any)?.properties?.id, 'module.scaffold 必须要求模块 ID');
    const moduleInstallTool = tools.tools.find(tool => tool.name === 'lingbuilder.module.install');
    const moduleInstallRequired = (moduleInstallTool?.inputSchema as any)?.required || [];
    assert.ok(moduleInstallRequired.includes('previewId') && moduleInstallRequired.includes('projectId'), 'module.install 必须要求 previewId 与 projectId');
    const projectCreateTool = tools.tools.find(tool => tool.name === 'lingbuilder.project.create');
    assert.ok((projectCreateTool?.inputSchema as any)?.properties?.templateId?.enum?.includes('new-emoji-fbro-browser-shell'));
    assert.ok((projectCreateTool?.inputSchema as any)?.properties?.templateId?.enum?.includes('sqlite-crud-window'));
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.module.info'), '缺少 lingbuilder.module.info 工具');
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.build.stop'), '缺少 lingbuilder.build.stop 工具');
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.run.wait'), '缺少 lingbuilder.run.wait 工具');
    assert.ok(tools.tools.some(tool => tool.name === 'lingbuilder.run.log'), '缺少 lingbuilder.run.log 工具');
    assert.ok(String(client.getInstructions() || '').includes('lingbuilder.project.create'), 'MCP 服务器必须提供窗口应用工作流 instructions');
    assert.match(String(client.getInstructions() || ''), /功能库/u, 'instructions 必须引导外部 AI 按功能库拆分代码，避免单文件大杂烩');
    assert.match(String(client.getInstructions() || ''), /designerInventory/u, 'instructions 必须告知外部 AI 组件表来自 designerInventory');
    assert.match(String(client.getInstructions() || ''), /codeOrganization/u, 'instructions 必须告知外部 AI 拆分时机以 codeOrganization 为准');
    assert.match(String(client.getInstructions() || ''), /功能代码/u, 'instructions 必须把“功能代码/功能性代码”口语映射为功能库');
    assert.match(String(client.getInstructions() || ''), /lingcpp-designer-controls-empty/u, 'instructions 必须告知“看不到任何组件”的根因诊断');
    assert.match(String(client.getInstructions() || ''), /EdgeView_创建无头实例/u, 'instructions 必须告知 EdgeView 隐窗伪无头形态与截图边界');
    assert.match(String(client.getInstructions() || ''), /CDP_启动浏览器/u, 'instructions 必须告知 CDP 真无头形态与回收/错误读取口径');
    assert.match(String(tools.tools.find(tool => tool.name === 'lingbuilder.edit.propose')?.description || ''), /功能代码/u, 'edit.propose 必须声明功能代码=功能库文件，避免降级成本地函数');
    const diagnosticsToolMeta = tools.tools.find(tool => tool.name === 'lingbuilder.lingcpp.diagnostics');
    assert.match(String(diagnosticsToolMeta?.description || ''), /designerInventory/u, 'diagnostics 工具描述必须声明组件表视图');
    assert.match(String(diagnosticsToolMeta?.description || ''), /codeOrganization/u, 'diagnostics 工具描述必须声明代码组织视图');
    assert.match(String(tools.tools.find(tool => tool.name === 'lingbuilder.edit.propose')?.description || ''), /designerInventory/u, 'edit.propose 必须引导外部 AI 先查组件表再写控件引用');
    const editTool = tools.tools.find(tool => tool.name === 'lingbuilder.edit.propose');
    const editProperties = (editTool?.inputSchema as any)?.properties || {};
    assert.ok(editProperties.workspaceFiles, 'MCP edit.propose must accept current multi-file contents');
    assert.ok(editProperties.files, 'MCP edit.propose must require complete updated file drafts');
    const diagnosticsTool = tools.tools.find(tool => tool.name === 'lingbuilder.lingcpp.diagnostics');
    assert.ok((diagnosticsTool?.inputSchema as any)?.properties?.designerProject, 'MCP diagnostics must accept the designer model');
    const buildTool = tools.tools.find(tool => tool.name === 'lingbuilder.build.run');
    assert.match(String((buildTool?.description || '')), /推荐只传 projectId/u);
    assert.match(String((buildTool?.description || '')), /磁盘设计器模型/u);
    assert.ok((buildTool?.inputSchema as any)?.properties?.projectId, 'MCP build.run 必须接受 projectId');
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

function createModuleToolManifest(id: string): Record<string, unknown> {
  return {
    schemaVersion: 2,
    id,
    name: '桥接测试模块',
    version: '1.0.0',
    category: '其他',
    description: 'AI Bridge 模块工具端到端验证。',
    contributes: {
      commands: [{ name: '桥接命令', signature: '桥接命令()', description: '测试命令。', insertText: '桥接命令()', returnType: '空' }],
      docs: [{ title: '使用说明', path: 'docs/usage.md' }],
      examples: [{ title: '示例', path: 'examples/demo.lcpp' }]
    },
    targets: [{
      id: 'windows-msvc-win32',
      platform: 'windows',
      arch: 'win32',
      toolchain: 'msvc',
      includeDirs: ['include'],
      headers: ['include/bridge.h'],
      libs: [],
      runtimeFiles: []
    }],
    bindings: { commands: [{ command: '桥接命令', runtimeName: '桥接命令', returnType: 'void' }] }
  };
}

async function writeSolutionFixture(root: string, projectIds: string[]): Promise<void> {
  await fs.mkdir(path.join(root, '.lingbuilder'), { recursive: true });
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 1,
    id: 'test-solution',
    name: '桥接测试解决方案',
    startupProjectId: projectIds[0],
    projects: projectIds.map(projectId => ({
      id: projectId,
      name: projectId,
      type: 'visual-cpp',
      sourceRoot: `src/${projectId}`,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`
    }))
  }, null, 2), 'utf8');
}

test('AI Bridge 模块工具在只读/预览未批准模式下拒绝写入', async () => {
  const readonlyRoot = await createTempWorkspace();
  const readonlyService = new AiBridgeService(createOptions(readonlyRoot, 'readonly', 'readonly-token'));
  const previewRoot = await createTempWorkspace();
  const previewService = new AiBridgeService(createOptions(previewRoot, 'preview', 'preview-token'));
  try {
    await assert.rejects(() => readonlyService.scaffoldModule({ id: 'bridge.perm.module' }), /只读模式/u);
    await assert.rejects(() => previewService.scaffoldModule({ id: 'bridge.perm.module' }), /预览确认模式/u);
    await assert.rejects(
      () => previewService.writeModuleFiles({ files: [{ path: 'lingbuilder.module.json', content: '{}' }] }),
      /预览确认模式/u
    );
    await assert.rejects(
      () => previewService.packModule({ moduleDir: '.lingbuilder/module-build/bridge.perm.module' }),
      /预览确认模式/u
    );
    await assert.rejects(
      () => previewService.installModule({ previewId: 'missing-preview-id', projectId: 'demo-project', approved: true }),
      /未找到项目|安装预览不存在或已经失效/u
    );
    await assert.rejects(() => fs.stat(path.join(readonlyRoot, '.lingbuilder', 'module-build')), { code: 'ENOENT' });
    await assert.rejects(() => fs.stat(path.join(previewRoot, '.lingbuilder', 'module-build')), { code: 'ENOENT' });
  } finally {
    await readonlyService.shutdown();
    await previewService.shutdown();
  }
});

test('AI Bridge 模块工具拒绝越界路径', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'yolo', 'yolo-token'));
  try {
    await assert.rejects(
      () => service.writeModuleFiles({
        files: [{ path: 'lingbuilder.module.json', content: JSON.stringify({ id: 'bridge.escape.module' }) }],
        outDir: '../outside',
        approved: true
      }),
      /越界|module-build/u
    );
    await assert.rejects(
      () => service.writeModuleFiles({
        files: [{ path: 'lingbuilder.module.json', content: JSON.stringify({ id: 'bridge.escape.module' }) }],
        outDir: 'generated/cpp/escape',
        approved: true
      }),
      /module-build/u
    );
    await assert.rejects(
      () => service.validateModule({ modulePath: '.lingbuilder/modules/lingbuilder.threading' }),
      /module-build/u
    );
    await assert.rejects(
      () => service.previewModuleInstall({ packagePath: 'generated/cpp/demo.lbmod' }),
      /module-packages/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge 模块工具支持生成→写入→校验→打包→预览→安装全链', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview', 'chain-token'));
  try {
    const scaffold = await service.scaffoldModule({ id: 'bridge.e2e.module', name: '桥接测试模块', approved: true });
    assert.equal(scaffold.ok, true);
    assert.equal(scaffold.manifest.id, 'bridge.e2e.module');

    const written = await service.writeModuleFiles({
      files: [
        { path: 'lingbuilder.module.json', content: JSON.stringify(createModuleToolManifest('bridge.e2e.module'), null, 2) },
        { path: 'docs/usage.md', content: '# 桥接测试模块\n\n## 使用说明\n\n调用 桥接命令() 完成验证。' },
        { path: 'examples/demo.lcpp', content: '桥接命令()' },
        { path: 'include/bridge.h', content: '#pragma once\n\nvoid 桥接命令();\n' }
      ],
      approved: true
    });
    assert.equal(written.moduleId, 'bridge.e2e.module');
    assert.equal(written.diagnostics.length, 0);
    assert.equal(written.overwrittenExisting, true);

    const validated = await service.validateModule({ modulePath: '.lingbuilder/module-build/bridge.e2e.module' });
    assert.equal(validated.ok, true);
    assert.equal(validated.diagnostics.length, 0);

    const packed = await service.packModule({ moduleDir: '.lingbuilder/module-build/bridge.e2e.module', approved: true });
    assert.equal(packed.targetPath, '.lingbuilder/module-packages/bridge.e2e.module.lbmod');
    assert.equal(await exists(path.join(workspaceRoot, '.lingbuilder', 'module-packages', 'bridge.e2e.module.lbmod')), true);

    const preview = await service.previewModuleInstall({ packagePath: '.lingbuilder/module-packages/bridge.e2e.module.lbmod' });
    assert.equal(preview.preview.canInstall, true);
    assert.ok(preview.preview.previewId);

    await writeSolutionFixture(workspaceRoot, ['demo-project']);
    const installed = await service.installModule({
      previewId: preview.preview.previewId,
      projectId: 'demo-project',
      approved: true
    });
    assert.equal(installed.ok, true);
    assert.equal(installed.enableForProject, true);
    assert.equal(await exists(path.join(workspaceRoot, '.lingbuilder', 'modules', 'bridge.e2e.module', 'lingbuilder.module.json')), true);

    const auditLog = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-log.jsonl'), 'utf8');
    assert.match(auditLog, /"action":"module\.scaffold"/u);
    assert.match(auditLog, /"action":"module\.writeFiles"/u);
    assert.match(auditLog, /"action":"module\.pack"/u);
    assert.match(auditLog, /"action":"module\.install"/u);
  } finally {
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

test('AI Bridge project creation inherits the workspace module manifest when omitted', async () => {
  const workspaceRoot = await createTempWorkspace();
  await fs.mkdir(path.join(workspaceRoot, '.lingbuilder'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'],
    pinnedVersions: {
      'lingbuilder.win32.basic': '1.0.0',
      'lingbuilder.win32.common-controls': '1.0.0'
    }
  }, null, 2), 'utf8');

  const previewService = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const request = {
    name: '继承模块项目',
    projectId: 'inherit-modules',
    templateId: 'hello-window' as const,
    openInWorkbench: false
  };
  const preview = await previewService.createProject(request);
  assert.equal(preview.applied, false);
  assert.equal(preview.preview.modules.selection, 'global-default');
  assert.ok(preview.preview.modules.requestedModuleIds.includes('lingbuilder.win32.common-controls'));
  assert.equal(preview.preview.modules.projectModuleFile, '.lingbuilder/projects/inherit-modules/project-modules.json');
  assert.ok(preview.preview.files.some(file => file.relativePath === preview.preview.modules.projectModuleFile
    && file.content.includes('lingbuilder.win32.common-controls')));
  await previewService.shutdown();

  const writeService = new AiBridgeService({ ...createOptions(workspaceRoot, 'yolo'), token: 'inherit-modules-token' });
  const created = await writeService.createProject({ ...request, approved: true });
  assert.equal(created.applied, true);
  const projectModulePath = path.join(workspaceRoot, '.lingbuilder', 'projects', 'inherit-modules', 'project-modules.json');
  const saved = JSON.parse(await fs.readFile(projectModulePath, 'utf8')) as { enabledModuleIds: string[] };
  assert.ok(saved.enabledModuleIds.includes('lingbuilder.win32.common-controls'));
  const modules = await writeService.listModules('inherit-modules');
  assert.ok(modules.enabledModules.some(module => module.id === 'lingbuilder.win32.common-controls'));
  assert.ok(modules.availableModules.every(module => typeof module === 'string'), '未启用模块必须是一行紧凑摘要');
  assert.ok(String(modules.hint).includes('lingbuilder.module.info'));

  const undone = await writeService.undoProjectCreate(created.result!.receipt.receiptId, true);
  assert.equal(undone.projectId, 'inherit-modules');
  assert.equal(await exists(projectModulePath), false);

  const explicitBasic = await writeService.createProject({
    ...request,
    projectId: 'explicit-basic',
    enabledModuleIds: [],
    approved: true
  });
  const explicitPath = path.join(workspaceRoot, '.lingbuilder', 'projects', 'explicit-basic', 'project-modules.json');
  const explicitSaved = JSON.parse(await fs.readFile(explicitPath, 'utf8')) as { enabledModuleIds: string[] };
  assert.deepEqual(explicitSaved.enabledModuleIds, ['lingbuilder.win32.basic']);
  assert.equal(explicitBasic.result?.modules.selection, 'explicit');
  await writeService.undoProjectCreate(explicitBasic.result!.receipt.receiptId, true);
  assert.equal(await exists(explicitPath), false);
  await writeService.shutdown();
});

test('AI Bridge DLL project creation keeps the LCPP source but omits a window designer model', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const preview = await service.createProject({
    name: 'AI DLL 项目',
    projectId: 'ai-dll',
    templateId: 'windows-dll',
    openInWorkbench: false
  });
  assert.equal(preview.applied, false);
  assert.equal(preview.preview.project.type, 'windows-dll');
  assert.equal(preview.preview.designerProject, undefined);
  assert.equal(preview.preview.navigation.filePath, 'src/ai-dll/DllApi.lcpp');
  assert.ok(preview.preview.files.some(file => file.relativePath === 'src/ai-dll/DllApi.lcpp' && file.kind === 'source'));
  await service.shutdown();
});

test('AI Bridge browser shell template previews defaults, creates atomically, and supports undo', async () => {
  const workspaceRoot = await createTempWorkspace();
  await installTestModule(workspaceRoot, {
    schemaVersion: 2,
    id: 'lingbuilder.new_emoji.ui',
    name: 'new_emoji 原生界面库',
    version: '2.0.0',
    minLingBuilderVersion: '0.3.0',
    category: '界面',
    description: 'AI Bridge 浏览器外壳模板测试用 new_emoji 模块。',
    contributes: { docs: [{ title: '测试文档', path: 'docs/README.md' }] }
  }, 'docs/README.md');
  await installTestModule(workspaceRoot, {
    schemaVersion: 2,
    id: 'lingbuilder.fbro.sdk',
    name: 'FBro SDK',
    version: '135.0.21.2.1.0',
    category: '界面',
    description: 'AI Bridge 浏览器外壳模板测试用只读 SDK 资产模块。'
  });

  const request = {
    name: 'AI 浏览器外壳',
    projectId: 'ai-browser-shell',
    templateId: 'new-emoji-fbro-browser-shell' as const,
    openInWorkbench: false
  };
  const previewService = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const templates = await previewService.listProjectTemplates();
  assert.ok(templates.templates.some(template => template.id === request.templateId));
  const preview = await previewService.createProject(request);
  assert.equal(preview.applied, false);
  assert.equal(preview.preview.modules.selection, 'template-default');
  assert.deepEqual(preview.preview.modules.requestedModuleIds, [
    'lingbuilder.win32.basic',
    'lingbuilder.new_emoji.ui',
    'lingbuilder.fbro.browser',
    'lingbuilder.fbro.sdk',
    'lingbuilder.new_emoji.fbro-shell'
  ]);
  assert.equal(preview.preview.project.buildProperties?.architecture, 'x64');
  const mainWindow = preview.preview.designerProject.windows[0];
  assert.equal(mainWindow.width, 1180);
  assert.equal(mainWindow.height, 760);
  assert.equal(mainWindow.designerBackend, 'new-emoji');
  assert.equal(mainWindow.windowFrame?.preset, 'browserShell');
  assert.equal(mainWindow.windowFrame?.flags, 0x3f);
  const sourcePreview = preview.preview.files.find(file => file.relativePath.endsWith('/MainWindow.lcpp'));
  assert.match(sourcePreview?.content || '', /浏览器外壳_创建\(浏览器标签页, 浏览器页面占位, &浏览器状态改变\)/u);
  assert.match(sourcePreview?.content || '', /Ctrl键按下 并且 键码 == 76/u);
  assert.equal(await exists(path.join(workspaceRoot, 'src', request.projectId)), false);
  assert.equal(await exists(path.join(workspaceRoot, '.lingbuilder', 'projects', request.projectId)), false);
  await previewService.shutdown();

  const writeService = new AiBridgeService({ ...createOptions(workspaceRoot, 'yolo'), token: 'browser-shell-create-token' });
  const created = await writeService.createProject({ ...request, approved: true });
  assert.equal(created.applied, true);
  const moduleManifestPath = path.join(workspaceRoot, '.lingbuilder', 'projects', request.projectId, 'project-modules.json');
  const savedModules = JSON.parse(await fs.readFile(moduleManifestPath, 'utf8')) as { enabledModuleIds: string[] };
  assert.ok(savedModules.enabledModuleIds.includes('lingbuilder.new_emoji.fbro-shell'));
  assert.ok(savedModules.enabledModuleIds.includes('lingbuilder.fbro.sdk'));
  assert.ok(await exists(path.join(workspaceRoot, 'src', request.projectId, 'MainWindow.lcpp')));
  assert.ok(await exists(path.join(workspaceRoot, '.lingbuilder', 'projects', request.projectId, 'window-designer.json')));

  const undone = await writeService.undoProjectCreate(created.result!.receipt.receiptId, true);
  assert.equal(undone.projectId, request.projectId);
  assert.equal(await exists(path.join(workspaceRoot, 'src', request.projectId)), false);
  assert.equal(await exists(path.join(workspaceRoot, '.lingbuilder', 'projects', request.projectId)), false);
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

test('AI Bridge accepts synchronized multi-file drafts for source and designer files', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/main.lcpp';
  const designerPath = '.lingbuilder/projects/demo/window-designer.json';
  const sourceCode = '类 Main\n结束类\n';
  const designerProject: LingWindowProject = {
    schemaVersion: 2 as const,
    id: 'demo',
    name: '演示项目',
    resources: [],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 420, height: 280,
      background: '#ffffff', description: '', controls: [{
        id: 'progress', type: 'ProgressBar', name: '加载进度', content: '25', width: 260, height: 20,
        x: 20, y: 30, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { minimum: 0, maximum: 100, value: 25, marquee: false }
      }]
    }]
  };
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: 'demo', name: '演示项目', sourceRoot: 'src' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const nextDesignerProject = JSON.parse(JSON.stringify(designerProject)) as LingWindowProject;
  nextDesignerProject.windows[0].controls[0].content = '75';
  nextDesignerProject.windows[0].controls[0].properties.value = 75;
  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    projectId: 'demo',
    instruction: '同步更新中文源码和窗口设计器模型',
    designerProject,
    updatedDesignerProject: nextDesignerProject,
    workspaceFiles: [
      { filePath: sourcePath, sourceCode }
    ],
    files: [
      { filePath: sourcePath, updatedSource: `${sourceCode}// 已同步\n` }
    ]
  });
  const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
  assert.equal(applied.appliedFiles.length, 2);
  assert.match(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), /已同步/u);
  const persisted = JSON.parse(await fs.readFile(path.join(workspaceRoot, designerPath), 'utf8'));
  assert.equal(persisted.windows[0].controls[0].properties.value, 75);
});

test('AI Bridge rejects raw designer file drafts that bypass the validated designer channel', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/main.lcpp';
  const designerPath = '.lingbuilder/projects/demo/window-designer.json';
  const sourceCode = '类 Main\n结束类\n';
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: 'demo', name: '演示项目', sourceRoot: 'src' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const designerRawSource = '{"id":"demo","windows":[]}\n';
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), designerRawSource, 'utf8');
  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    projectId: 'demo',
    instruction: '补充注释',
    workspaceFiles: [
      { filePath: sourcePath, sourceCode },
      { filePath: designerPath, sourceCode: designerRawSource }
    ],
    files: [
      { filePath: sourcePath, updatedSource: `${sourceCode}// 已同步\n` },
      { filePath: designerPath, updatedSource: '{"id":"demo","windows":[{"id":"main-window"}]}\n' }
    ]
  });
  await assert.rejects(
    () => service.applyEdit({ proposalId: proposal.proposal.id, approved: true }),
    /不能通过普通文件草稿写入/u
  );
  assert.equal(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), sourceCode);
});

test('AI Bridge rejects designer edits for projects outside the solution', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/orphan/Main.lcpp';
  const sourceCode = '类 Main\n结束类\n';
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const designerProject: LingWindowProject = {
    schemaVersion: 2 as const,
    id: 'orphan',
    name: '未注册项目',
    resources: [],
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 420, height: 280,
      background: '#ffffff', description: '', controls: []
    }]
  };
  await assert.rejects(
    () => service.proposeEdit({
      filePath: sourcePath,
      projectId: 'orphan',
      instruction: '更新布局',
      designerProject,
      updatedDesignerProject: designerProject,
      workspaceFiles: [{ filePath: sourcePath, sourceCode }],
      files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 已同步\n` }]
    }),
    /未在解决方案（.lingbuilder\/solution.json）中注册/u
  );
});

test('AI Bridge applies source and validated designer model atomically', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/demo/Main.lcpp';
  const designerPath = '.lingbuilder/projects/demo/window-designer.json';
  const sourceCode = '类 Main\n结束类\n';
  const designerProject: LingWindowProject = {
    schemaVersion: 2 as const,
    id: 'demo',
    name: '演示项目',
    resources: [],
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '演示', width: 420, height: 280,
      background: '#ffffff', description: '', controls: [{
        id: 'progress', type: 'ProgressBar', name: '加载进度', content: '25', width: 260, height: 20,
        x: 20, y: 30, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { minimum: 0, maximum: 100, value: 25, marquee: false }
      }]
    }]
  };
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), JSON.stringify(designerProject, null, 2) + '\n', 'utf8');
  await registerSolutionProject(workspaceRoot, { id: 'demo', name: '演示项目' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const nextDesignerProject = JSON.parse(JSON.stringify(designerProject));
  nextDesignerProject.windows[0].controls[0].content = '75';
  nextDesignerProject.windows[0].controls[0].properties.value = 75;
  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    projectId: 'demo',
    instruction: '把加载进度改为 75%，同时更新窗口布局模型',
    designerProject,
    updatedDesignerProject: nextDesignerProject,
    workspaceFiles: [{ filePath: sourcePath, sourceCode }],
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 已同步\n` }]
  });
  const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
  assert.equal(applied.appliedFiles.length, 2);
  assert.match(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), /已同步/u);
  const persisted = JSON.parse(await fs.readFile(path.join(workspaceRoot, designerPath), 'utf8'));
  assert.equal(persisted.windows[0].controls[0].properties.value, 75);
  assert.equal(persisted.windows[0].controls[0].content, '75');
  await service.shutdown();
});

test('AI Bridge rejects a designer model changed after proposal creation', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/demo/Main.lcpp';
  const designerPath = '.lingbuilder/projects/demo/window-designer.json';
  const sourceCode = '类 Main\n结束类\n';
  const designerProject: LingWindowProject = {
    schemaVersion: 2 as const,
    id: 'demo',
    name: '竞态测试项目',
    resources: [],
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 420, height: 280,
      background: '#ffffff', description: '', controls: [{
        id: 'progress', type: 'ProgressBar', name: '加载进度', content: '25', width: 260, height: 20,
        x: 20, y: 30, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: { minimum: 0, maximum: 100, value: 25, marquee: false }
      }]
    }]
  };
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), JSON.stringify(designerProject, null, 2) + '\n', 'utf8');
  await registerSolutionProject(workspaceRoot, { id: 'demo', name: '竞态测试项目' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const nextDesignerProject = JSON.parse(JSON.stringify(designerProject)) as LingWindowProject;
  nextDesignerProject.windows[0].controls[0].content = '75';
  nextDesignerProject.windows[0].controls[0].properties.value = 75;
  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    projectId: 'demo',
    instruction: '把加载进度改为 75%，同时更新窗口布局模型',
    designerProject,
    updatedDesignerProject: nextDesignerProject,
    workspaceFiles: [{ filePath: sourcePath, sourceCode }],
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 已同步\n` }]
  });

  const externallyChanged = JSON.parse(JSON.stringify(designerProject)) as LingWindowProject;
  externallyChanged.windows[0].controls[0].x = 88;
  await fs.writeFile(path.join(workspaceRoot, designerPath), JSON.stringify(externallyChanged, null, 2) + '\n', 'utf8');
  await assert.rejects(
    () => service.applyEdit({ proposalId: proposal.proposal.id, approved: true }),
    /窗口设计器模型在 AI 提案生成后已发生变化/u
  );
  assert.equal(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), sourceCode);

  await fs.writeFile(path.join(workspaceRoot, designerPath), JSON.stringify(designerProject, null, 2) + '\n', 'utf8');
  const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
  assert.equal(applied.ok, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(workspaceRoot, designerPath), 'utf8')).windows[0].controls[0].properties.value, 75);
  assert.match(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), /已同步/u);
  await service.shutdown();
});

test('AI Bridge gates apply and preview when source references controls missing from the designer model', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'gate-project';
  const sourcePath = 'src/gate-project/Main.lcpp';
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  const emptyModel = createDesignerFallbackProject(projectId, '门禁项目');
  emptyModel.windows[0].controls = [];
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), CONTROL_REF_SOURCE, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(emptyModel, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '门禁项目' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'yolo', 'control-gate-token'));
  try {
    // propose 保持宽松（caller-draft 允许纯源码草稿）
    const sourceOnly = await service.proposeEdit({
      filePath: sourcePath, projectId, instruction: '调整输出文案',
      files: [{ filePath: sourcePath, updatedSource: `${CONTROL_REF_SOURCE}// 门禁验证\n` }]
    });
    assert.ok(sourceOnly.proposal.id);
    // apply 被控件引用门禁阻断，并给出 updatedDesignerProject 修复路径
    await assert.rejects(
      () => service.applyEdit({ proposalId: sourceOnly.proposal.id, approved: true }),
      /lingbuilder\.edit\.apply 被阻止[\s\S]*不存在的控件[\s\S]*updatedDesignerProject/u
    );
    // native.preview 同口径阻断
    await assert.rejects(
      () => service.nativePreview({ projectId }),
      /lingbuilder\.native\.preview 被阻止[\s\S]*输出结果/u
    );
    // 带 updatedDesignerProject 补齐控件后：提案 + 应用成功，磁盘模型含控件
    const withControl = createDesignerFallbackProject(projectId, '门禁项目');
    const fixed = await service.proposeEdit({
      filePath: sourcePath, projectId, instruction: '补齐控件并调整布局',
      updatedDesignerProject: withControl,
      files: [{ filePath: sourcePath, updatedSource: CONTROL_REF_SOURCE }]
    });
    const applied = await service.applyEdit({ proposalId: fixed.proposal.id, approved: true });
    assert.equal(applied.ok, true);
    const persisted = JSON.parse(await fs.readFile(path.join(workspaceRoot, designerPath), 'utf8'));
    assert.equal(persisted.windows[0].controls.some((control: { name: string }) => control.name === '输出结果'), true);
    // 补齐后预览不再被门禁阻断
    const preview = await service.nativePreview({ projectId });
    assert.equal(preview.ok, true);
  } finally {
    await service.shutdown();
  }
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
});

test('AI Bridge modules.list returns slim summaries and module.info returns full command docs', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    const list = await service.listModules();
    assert.equal(list.ok, true);
    assert.ok(list.availableModules.length > 0);
    assert.ok(list.availableModules.every(module => typeof module === 'string'),
      '未启用模块只能是一行紧凑摘要，完整 manifest 会撑爆外部 AI 上下文');
    assert.ok(list.enabledModules.every(module => typeof module.commandCount === 'number' && !('manifest' in module)));
    assert.ok(String(list.hint).includes('lingbuilder.module.info'));

    const info = await service.getModuleInfo({ moduleId: 'lingbuilder.database.sqlite' });
    assert.equal(info.ok, true);
    assert.equal(info.id, 'lingbuilder.database.sqlite');
    const openCommand = info.commands.find(command => command.name === 'SQLite_打开连接');
    assert.ok(openCommand, 'module.info 必须返回 SQLite_打开连接 的完整说明');
    assert.match(openCommand.signature, /数据库路径/u);
    assert.ok(openCommand.parameters.length >= 3);
    assert.ok(openCommand.parameters.every(parameter => parameter.description.length > 0));

    const filtered = await service.getModuleInfo({ moduleId: 'lingbuilder.database.sqlite', query: '绑定' });
    assert.ok(filtered.commands.length > 0);
    assert.ok(filtered.commands.length < info.commands.length);
    assert.ok(filtered.commands.every(command => command.name.includes('绑定') || command.description.includes('绑定')));

    await assert.rejects(
      service.getModuleInfo({ moduleId: '' }),
      /必须提供要查询的 moduleId/u
    );
    await assert.rejects(
      service.getModuleInfo({ moduleId: 'lingbuilder.not.exists' }),
      /未找到模块/u
    );
  } finally {
    await service.shutdown();
  }
});

/** module.info 的界面开发视图子集；只声明本用例关心的字段。 */
interface ModuleInfoUiViews {
  designerControlsTotal: number;
  designerControls: Array<{
    namespacedType: string;
    createCommand?: string;
    lingCppType?: string;
    propertyCount: number;
    documentation?: string;
    nativeDocumentation?: string;
  }>;
  componentGuide?: { path: string; nativePath: string; absolutePath: string; truncated: boolean; content: string };
  designerControlMatched: number;
  designerControlDetails: Array<{
    type: string;
    events: Array<{ handlerPattern: string }>;
    properties: Array<{ key: string }>;
    codeCreation: { createCommand: string };
    documentation?: string;
    nativeDocumentation?: string;
  }>;
  commands: Array<Record<string, unknown>>;
  demoProject: { commandCount: number; sourceRoot: string; generatedAt: string; stale: boolean };
  uiExamples: Array<{ title: string }>;
  uiExample: { title: string; content: string; truncated: boolean };
}

test('lingbuilder.module.info exposes designer control palette, demo invocations and ui recipes', async () => {
  // 需要真实工作区：控件调色板取自已安装模块清单，配方与逐命令真实调用取自 examples/ 语料。
  const service = new AiBridgeService(createOptions(path.resolve('..'), 'readonly', 'module-info-token'));
  try {
    const table = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      query: 'NE表格_设置列'
    }) as unknown as ModuleInfoUiViews;
    assert.ok(table.designerControlsTotal >= 90, 'new_emoji 必须返回整套控件概览');
    assert.ok(table.designerControls.length <= 120, '控件概览必须守住响应体量红线');
    const tableEntry = table.designerControls.find(item => item.namespacedType === 'lingbuilder.new_emoji.ui/Table');
    assert.ok(tableEntry);
    assert.equal(tableEntry.createCommand, '控件_创建NE表格');
    assert.equal(tableEntry.lingCppType, 'NE表格');
    assert.equal(tableEntry.propertyCount > 10, true);
    // 演示语料（2026-08-07，3784 命令）早于该命令入账：不得伪造示例，只按缺失处理并由 demoProject 说明新鲜度。
    assert.equal(table.commands.some(command => command.name === 'NE表格_设置列'), true);
    assert.equal('demoExample' in table.commands[0], false);
    assert.equal(table.demoProject.stale, true);
    assert.match(table.demoProject.generatedAt, /^\d{4}-\d{2}-\d{2}$/u);
    assert.ok(table.demoProject.commandCount > 3000);
    assert.ok(table.demoProject.sourceRoot.includes('examples/module-demos'));
    assert.ok(table.uiExamples.some(item => item.title === '表格增删改与双击编辑'));

    const window = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      query: 'NE_创建窗口'
    }) as unknown as ModuleInfoUiViews;
    const createdWindow = window.commands.find(command => command.name === 'NE_创建窗口');
    assert.ok(createdWindow);
    assert.equal(String(createdWindow.demoExample).startsWith('NE_创建窗口('), true,
      'demoExample 必须是演示语料里的真实调用行，参数顺序可直接照抄');

    const button = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      control: '按钮'
    }) as unknown as ModuleInfoUiViews;
    assert.equal(button.designerControlMatched >= 1, true);
    const buttonDetail = button.designerControlDetails.find(item => item.type === 'Button');
    assert.ok(buttonDetail, 'control 过滤必须返回按钮控件的完整契约');
    assert.ok(buttonDetail.events.some(event => event.handlerPattern === '_{controlName}_被点击'));
    assert.equal(buttonDetail.codeCreation.createCommand, '控件_创建NE按钮');
    assert.ok(buttonDetail.properties.some(property => property.key === 'variant'));

    // 组件卡：概览带路径，唯一命中时直接回正文，多个命中时不批量塞内容。
    const panelEntry = tableEntry;
    assert.match(String(panelEntry.documentation || ''), /^lingbuilder-components\/.+\.md$/u);
    assert.match(String(panelEntry.nativeDocumentation || ''), /^components\/.+\.md$/u);
    assert.equal(button.designerControlMatched, 2, '按钮 应同时命中 Button 与 IconButton');
    assert.equal(button.componentGuide, undefined, '命中多个控件时不得内联组件卡正文');

    const single = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      control: 'NE按钮'
    }) as unknown as ModuleInfoUiViews;
    assert.equal(single.designerControlMatched, 1);
    assert.ok(single.componentGuide, 'control 唯一命中时必须回组件卡正文');
    assert.match(single.componentGuide!.content, /控件_创建NE按钮/u);
    assert.match(single.componentGuide!.content, /惯用要点与红线/u);
    assert.equal(single.componentGuide!.truncated, false);
    assert.equal(single.componentGuide!.path, 'lingbuilder-components/button.md');
    assert.match(single.componentGuide!.nativePath, /^components\/button\.md$/u);

    const multi = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      control: 'NE'
    }) as unknown as ModuleInfoUiViews;
    assert.equal(multi.designerControlMatched > 1, true);
    assert.equal(multi.componentGuide, undefined, '命中多个控件时不得把多份组件卡内联进响应');
    assert.ok(multi.designerControlDetails.every(item => typeof item.documentation === 'string' && item.documentation.length > 0));

    const recipe = await service.getModuleInfo({
      moduleId: 'lingbuilder.new_emoji.ui',
      example: '窗口骨架'
    }) as unknown as ModuleInfoUiViews;
    assert.equal(recipe.uiExample.title, '窗口骨架与代码创建控件');
    assert.match(recipe.uiExample.content, /控件_创建NE文本/u);
    assert.equal(recipe.uiExample.truncated, false);

    await assert.rejects(
      service.getModuleInfo({ moduleId: 'lingbuilder.new_emoji.ui', control: '不存在的控件' }),
      /设计器控件中没有任何项匹配/u
    );
    await assert.rejects(
      service.getModuleInfo({ moduleId: 'lingbuilder.new_emoji.ui', example: '不存在的配方' }),
      /未找到匹配/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge sqlite-crud template creates a complete project with clean diagnostics', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'yolo', 'sqlite-crud-token'));
  try {
    const created = await service.createProject({
      name: '会员管理',
      projectId: 'member-crud',
      templateId: 'sqlite-crud-window',
      openInWorkbench: false,
      approved: true
    });
    assert.equal(created.applied, true);
    const designer = created.result?.designerProject;
    assert.ok(designer, 'sqlite-crud-window 必须返回设计器模型');
    const controls = designer.windows[0].controls;
    assert.ok(controls.some(control => control.type === 'ListView' && control.name === '会员列表'));
    assert.ok(controls.some(control => control.name === '新增按钮' && control.events?.Click === '_新增按钮_被单击'));
    const savedModules = JSON.parse(await fs.readFile(
      path.join(workspaceRoot, '.lingbuilder', 'projects', 'member-crud', 'project-modules.json'), 'utf8'
    )) as { enabledModuleIds: string[] };
    assert.ok(savedModules.enabledModuleIds.includes('lingbuilder.database.sqlite'));

    const sourcePath = created.result!.navigation.filePath;
    assert.equal(sourcePath, 'src/member-crud/MainWindow.lcpp');
    const sourceOnDisk = await fs.readFile(path.join(workspaceRoot, 'src', 'member-crud', 'MainWindow.lcpp'), 'utf8');
    assert.match(sourceOnDisk, /SQLite_打开连接/u);
    assert.match(sourceOnDisk, /列表视图_添加行/u);

    const diagnostics = await service.getLingCppDiagnostics({ filePath: sourcePath, projectId: 'member-crud' });
    const errors = diagnostics.diagnostics.filter(diagnostic => diagnostic.level === 'error');
    assert.equal(errors.length, 0, `模板源码不应有错误诊断：${JSON.stringify(diagnostics.diagnostics)}`);
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge edit.propose auto-reads workspace files and supports creating new files', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'yolo', 'auto-workspace-token'));
  try {
    await fs.mkdir(path.join(workspaceRoot, 'src', 'auto-edit'), { recursive: true });
    const existingRelative = 'src/auto-edit/MainWindow.lcpp';
    const existingSource = '类 MainWindow\n    事件 创建完毕()\n        调试输出("起点")\n    结束\n结束类\n';
    await fs.writeFile(path.join(workspaceRoot, existingRelative), existingSource, 'utf8');

    // 不传 workspaceFiles：服务端自动读盘；新文件按空基准创建。
    const newFileRelative = 'src/auto-edit/会员数据类型.lcpp';
    const proposal = await service.proposeEdit({
      filePath: existingRelative,
      instruction: '新增数据类型文件并调整主源码',
      files: [
        { filePath: existingRelative, updatedSource: `${existingSource}// 已由 AI 更新\n` },
        { filePath: newFileRelative, updatedSource: '版本 1\n\n类型 会员信息\n' }
      ]
    });
    const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
    assert.equal(applied.ok, true);
    const newFileOnDisk = await fs.readFile(path.join(workspaceRoot, newFileRelative), 'utf8');
    assert.match(newFileOnDisk, /会员信息/u);
    const existingOnDisk = await fs.readFile(path.join(workspaceRoot, existingRelative), 'utf8');
    assert.match(existingOnDisk, /已由 AI 更新/u);
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge edit.propose rejects draft files without a workspace baseline instead of dropping them', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'main.lcpp'), '类 Main\n结束类\n', 'utf8');
    await assert.rejects(
      service.proposeEdit({
        filePath: 'src/main.lcpp',
        instruction: '尝试修改一个未提供基准的文件',
        workspaceFiles: [{ filePath: 'src/main.lcpp', sourceCode: '类 Main\n结束类\n' }],
        files: [{ filePath: 'src/other.lcpp', updatedSource: '类 Other\n结束类\n' }]
      }),
      /没有对应的当前工作区内容/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge external-AI proposals stay source-only even with layout keywords in the instruction', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    const source = [
      '类 Main',
      '    事件 创建完毕()',
      '        调试输出("起点")',
      '    结束',
      '结束类'
    ].join('\n');
    await fs.writeFile(path.join(workspaceRoot, 'src', 'main.lcpp'), source, 'utf8');
    // 指令包含「控件」等布局词，但外部 AI 只改源码：不得被「涉及布局但缺设计器模型」误拦。
    const proposal = await service.proposeEdit({
      filePath: 'src/main.lcpp',
      instruction: '修复控件引用文案并补充调试输出',
      files: [{ filePath: 'src/main.lcpp', updatedSource: `${source}// 控件引用说明已补充\n` }]
    });
    assert.ok(proposal.proposal.id);
    assert.equal(proposal.proposal.designerChanged, false);
    const applied = await service.applyEdit({ proposalId: proposal.proposal.id, approved: true });
    assert.equal(applied.ok, true);
    assert.equal(applied.appliedFiles.length, 1);
    assert.ok(applied.appliedFiles[0].bytes > 0, 'apply 响应携带文件元数据');
    assert.match(applied.message || '', /已应用/u);
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge run control tools respond gracefully without a running process', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    const stopped = await service.stopRun('no-such-project');
    assert.equal(stopped.found, false);
    const waited = await service.waitForRun('no-such-project', 1);
    assert.equal(waited.found, false);
    const log = await service.readRunLog('no-such-project');
    assert.equal(log.ok, false);
    assert.match(log.message, /还没有受控运行记录/u);
    await assert.rejects(
      service.stopRun(''),
      /必须提供要停止运行的项目 ID/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge diagnostics point external AI to the module that provides an unknown type', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    const sourceCode = [
      '类 Main',
      '    事件 创建完毕()',
      '        局部 SQLite连接 数据库 = 0',
      '    结束',
      '结束类'
    ].join('\n');
    const result = await service.getLingCppDiagnostics({
      filePath: 'src/main.lcpp',
      sourceCode
    });
    const unknown = result.diagnostics.find(d => d.level === 'error' && d.message.includes('使用了未知类型') && d.message.includes('SQLite连接'));
    assert.ok(unknown, '未知类型必须报错');
    assert.match(unknown.suggestion, /lingbuilder\.database\.sqlite/u, '建议必须指明提供该类型的模块 ID');
    assert.match(unknown.suggestion, /project-modules\.json/u, '建议必须给出启用路径');
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge diagnostics preserve typed runtime control reference errors', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const sourceCode = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        局部 编辑框 输入框 = 通过标记文本获取编辑框("输入")',
    '        按钮_绑定被单击(输入框, &处理点击)',
    '    结束',
    '    事件 处理点击()',
    '    结束',
    '结束类'
  ].join('\n');
  const result = await service.getLingCppDiagnostics({
    filePath: 'src/MainWindow.lcpp',
    sourceCode,
    designerProject: {
      schemaVersion: 2,
      id: 'ai-runtime-control-project',
      name: 'AI 运行时控件诊断',
      windows: [{
        id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
        width: 640, height: 480, background: '#ffffff', description: '', controls: []
      }]
    }
  });
  assert.ok(result.diagnostics.some(diagnostic => (
    diagnostic.id.startsWith('lingcpp-control-reference-type-')
    && diagnostic.message.includes('编辑框')
    && diagnostic.message.includes('不能用于参数')
  )), JSON.stringify(result.diagnostics));
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

function createDesignerFallbackProject(projectId: string, name: string): LingWindowProject {
  return {
    schemaVersion: 2 as const,
    id: projectId,
    name,
    resources: [],
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{
        id: 'btn-status', type: 'Button', name: '输出结果', content: '待命', width: 120, height: 32,
        x: 20, y: 30, fontSize: 12, background: '#ffffff', foreground: '#000000', isEnabled: true, visibility: 'Visible',
        properties: {}
      }]
    }]
  };
}

const CONTROL_REF_SOURCE = '类 MainWindow\n    事件 创建完毕()\n        控件_设置文本(输出结果, "完成")\n    结束\n结束类\n';

test('AI Bridge diagnostics fall back to the workspace designer model by projectId', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'designer-fallback-project';
  const sourceRoot = `src/${projectId}`;
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(createDesignerFallbackProject(projectId, '设计器回退项目'), null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '设计器回退项目' });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), CONTROL_REF_SOURCE, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/main.lcpp`, sourceCode: CONTROL_REF_SOURCE });
  assert.equal(result.designerContext.source, 'workspace');
  assert.equal(result.designerContext.persisted, true);
  assert.equal(result.designerContext.controlReferencesChecked, true);
  assert.equal(
    result.diagnostics.some(diagnostic => diagnostic.id.startsWith('lingcpp-control-reference-')),
    false,
    JSON.stringify(result.diagnostics)
  );
});

test('AI Bridge diagnostics return the designer control inventory and code organization report', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'inventory-project';
  const sourceRoot = `src/${projectId}`;
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  const model = createDesignerFallbackProject(projectId, '组件清单项目');
  model.windows[0].controls = [
    ...model.windows[0].controls,
    { ...model.windows[0].controls[0], id: 'btn-hidden', name: '隐藏按钮', content: '看不见', visibility: 'Collapsed' }
  ];
  model.resources = [{ id: 'img-1', type: 'ImageList', name: '图标列表', imageWidth: 16, imageHeight: 16, images: [] }];
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '组件清单项目' });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), CONTROL_REF_SOURCE, 'utf8');
  const librarySource = '功能库 Cookie导出\n公开:\n  空 导出()\n    调试输出("导出完成")\n  结束\n结束功能库\n';
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'Cookie导出.lcpp'), librarySource, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/main.lcpp`, sourceCode: CONTROL_REF_SOURCE });
  await service.shutdown();

  const inventory = result.designerInventory;
  assert.ok(inventory, '窗口项目诊断必须返回 designerInventory');
  assert.equal(inventory.source, 'workspace');
  assert.equal(inventory.windowCount, 1);
  assert.equal(inventory.controlCount, 2);
  const window = inventory.windows[0];
  assert.equal(window.className, 'MainWindow');
  assert.deepEqual(window.controls.map(control => control.name), ['输出结果', '隐藏按钮']);
  assert.equal(window.controls[0].type, 'Button');
  assert.equal(window.controls[0].visible, true);
  assert.equal(window.hiddenControlCount, 1, 'Collapsed 控件必须被计入，供外部 AI 回答「组件为什么没显示」');
  assert.ok(window.sourceEventHandlers.includes('创建完毕'), '源码事件处理器必须与窗口类对齐返回');
  assert.ok(inventory.nonVisualResources.some(resource => resource.name === '图标列表' && resource.type === 'ImageList'));
  assert.match(inventory.summary, /1 个 visibility=Collapsed/u);

  const organization = result.codeOrganization;
  assert.equal(organization.windowProject, true);
  const mainFile = organization.files.find(file => file.filePath === `${sourceRoot}/main.lcpp`);
  assert.equal(mainFile?.kind, 'window-main');
  assert.ok((mainFile?.lineCount ?? 0) >= 4);

  const libraryFile = organization.files.find(file => file.filePath === `${sourceRoot}/Cookie导出.lcpp`);
  assert.equal(libraryFile?.kind, 'function-library');
  assert.equal(organization.functionLibraries.length, 1);
  assert.equal(organization.functionLibraries[0]?.name, 'Cookie导出');
  assert.deepEqual(organization.functionLibraries[0]?.publicMethods, ['导出']);
  assert.equal(organization.functionLibraries[0]?.filePath, `${sourceRoot}/Cookie导出.lcpp`, '功能库路径必须保留磁盘真实大小写，供外部 AI 直接引用');
  assert.match(organization.summary, /代码组织良好/u);
});

test('AI Bridge diagnostics name the empty designer model as the reason no components show', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'empty-canvas-project';
  const sourceRoot = `src/${projectId}`;
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  const emptyModel = createDesignerFallbackProject(projectId, '画布空白项目');
  emptyModel.windows[0].controls = [];
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(emptyModel, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '画布空白项目' });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  const plainSource = '类 MainWindow\n    事件 创建完毕()\n        调试输出("启动")\n    结束\n结束类\n';
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), plainSource, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/main.lcpp`, sourceCode: plainSource });

  const empty = result.diagnostics.find(diagnostic => diagnostic.id === 'lingcpp-designer-controls-empty');
  assert.ok(empty, `模型有窗口但 0 控件必须点名根因：${JSON.stringify(result.diagnostics)}`);
  assert.equal(empty.level, 'warning', '只给 warning，不得阻断构建');
  assert.match(empty.message, /画布是空白/u);
  assert.match(empty.suggestion, /updatedDesignerProject/u);
  assert.match(result.designerInventory.summary, /没有任何组件/u);
  assert.equal(result.designerInventory.windows[0].controlCount, 0);
  await service.shutdown();

  // 有控件的模型不得出现该诊断（上一用例已覆盖 inventory 内容）
  const filledRoot = await createTempWorkspace();
  const filledService = new AiBridgeService(createOptions(filledRoot, 'preview'));
  const filledPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(filledRoot, filledPath)), { recursive: true });
  await fs.writeFile(path.join(filledRoot, filledPath), `${JSON.stringify(createDesignerFallbackProject(projectId, '画布空白项目'), null, 2)}\n`, 'utf8');
  await registerSolutionProject(filledRoot, { id: projectId, name: '画布空白项目' });
  const filledResult = await filledService.getLingCppDiagnostics({ projectId, filePath: 'src/main.lcpp', sourceCode: plainSource });
  assert.equal(
    filledResult.diagnostics.some(diagnostic => diagnostic.id === 'lingcpp-designer-controls-empty'),
    false,
    JSON.stringify(filledResult.diagnostics)
  );
  await filledService.shutdown();
});

test('AI Bridge diagnostics prescribe a function-library split for oversized single window files', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'oversized-project';
  const sourceRoot = `src/${projectId}`;
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(createDesignerFallbackProject(projectId, '超大单文件项目'), null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '超大单文件项目' });
  const padding = Array.from({ length: 320 }, (_unused, index) => `        // 说明 ${index}`).join('\n');
  const oversizedSource = `类 MainWindow\n    事件 创建完毕()\n${padding}\n    结束\n结束类\n`;
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'MainWindow.lcpp'), oversizedSource, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/MainWindow.lcpp`, sourceCode: oversizedSource });
  await service.shutdown();

  const suggestion = result.diagnostics.find(diagnostic => diagnostic.id === 'lingcpp-code-organization-split-suggestion');
  assert.ok(suggestion, `超大单文件必须给出拆分处方：${JSON.stringify(result.diagnostics)}`);
  assert.equal(suggestion.level, 'info', '未超重的拆分建议只能是 info，不得阻断构建');
  assert.match(suggestion.message, /功能库/u);
  assert.match(suggestion.suggestion, /结束功能库/u);
  assert.match(suggestion.suggestion, /功能库 文本工具/u, '处方必须给可粘贴的功能库骨架');
  assert.match(suggestion.suggestion, /公开:/u, '骨架必须标出公开段（跨文件限定调用只暴露公开功能）');
  assert.ok(suggestion.suggestion.includes(`${sourceRoot}/`), '处方应给出与本项目源码目录一致的目标文件路径');
  assert.match(suggestion.message, /功能代码/u, '处方必须把用户的“功能代码”口语映射到功能库术语');
  assert.equal(result.codeOrganization.largestFile?.kind, 'window-main');
  assert.ok((result.codeOrganization.largestFile?.lineCount ?? 0) >= 300);
});

test('AI Bridge diagnostics keep code organization silent for small and non-window projects', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'small-project';
  const sourceRoot = `src/${projectId}`;
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(createDesignerFallbackProject(projectId, '小项目'), null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '小项目' });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), CONTROL_REF_SOURCE, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const small = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/main.lcpp`, sourceCode: CONTROL_REF_SOURCE });
  assert.equal(
    small.diagnostics.some(diagnostic => diagnostic.id === 'lingcpp-code-organization-split-suggestion'),
    false,
    JSON.stringify(small.diagnostics)
  );
  assert.match(small.codeOrganization.summary, /尚未需要拆分/u);

  const outside = await service.getLingCppDiagnostics({ projectId: 'not-registered', filePath: 'src/other/main.lcpp', sourceCode: CONTROL_REF_SOURCE });
  assert.equal(outside.designerInventory, undefined, '未注册项目没有设计器上下文，不得伪造组件表');
  assert.equal(outside.codeOrganization.windowProject, false);
  assert.equal(
    outside.diagnostics.some(diagnostic => diagnostic.id === 'lingcpp-code-organization-split-suggestion'),
    false,
    '非窗口项目不得施加功能库拆分建议'
  );
  await service.shutdown();
});

test('AI Bridge diagnostics surface a missing workspace designer model and keep honest control errors', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'designer-missing-project';
  const sourceRoot = `src/${projectId}`;
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '设计器缺失项目' });
  await fs.mkdir(path.join(workspaceRoot, sourceRoot), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourceRoot, 'main.lcpp'), CONTROL_REF_SOURCE, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId, filePath: `${sourceRoot}/main.lcpp`, sourceCode: CONTROL_REF_SOURCE });
  assert.equal(result.designerContext.source, 'workspace');
  assert.equal(result.designerContext.persisted, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.id === 'lingcpp-designer-model-missing'), JSON.stringify(result.diagnostics));
  assert.ok(
    result.diagnostics.some(diagnostic => diagnostic.id.startsWith('lingcpp-control-reference-missing')),
    '设计器文件缺失时控件引用仍应如实报错'
  );
});

test('AI Bridge diagnostics skip designer control errors for projects outside the solution', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/unknown-project/main.lcpp';
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const result = await service.getLingCppDiagnostics({ projectId: 'unknown-project', filePath: sourcePath, sourceCode: CONTROL_REF_SOURCE });
  assert.equal(result.designerContext.source, 'none');
  assert.equal(result.designerContext.controlReferencesChecked, false);
  assert.ok(result.diagnostics.some(diagnostic => diagnostic.id === 'lingcpp-designer-context-missing'), JSON.stringify(result.diagnostics));
  assert.equal(
    result.diagnostics.some(diagnostic => diagnostic.id.startsWith('lingcpp-control-reference-')),
    false,
    JSON.stringify(result.diagnostics)
  );
});

test('AI Bridge native preview warns when the passed designer model diverges from disk', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'designer-drift-project';
  const designerProject = createDesignerFallbackProject(projectId, '漂移项目');
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '漂移项目' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const synced = await service.nativePreview({ project: JSON.parse(JSON.stringify(designerProject)) as LingWindowProject });
  assert.equal(synced.ok, true);
  assert.equal(synced.logs.some(line => line.includes('不一致')), false, JSON.stringify(synced.logs));

  const drifted = JSON.parse(JSON.stringify(designerProject)) as LingWindowProject;
  drifted.windows[0].controls[0].x = 66;
  const result = await service.nativePreview({ project: drifted });
  assert.equal(result.ok, true);
  assert.ok(result.logs.some(line => line.includes('不一致')), JSON.stringify(result.logs));
  assert.ok(result.logs.some(line => line.includes('updatedDesignerProject') || line.includes('重新读取')), JSON.stringify(result.logs));
});

test('AI Bridge designer comparisons are key-order insensitive and drift detection uses the disk baseline', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/demo/Main.lcpp';
  const designerPath = '.lingbuilder/projects/demo/window-designer.json';
  const sourceCode = '类 Main\n结束类\n';
  const designerProject = createDesignerFallbackProject('demo', '键序测试项目');
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), sourceCode, 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: 'demo', name: '键序测试项目' });

  // 深度打乱键序（含嵌套对象）但内容等价：磁盘文件按原顺序写入，caller 模型按乱序键传入。
  const shuffleKeys = <T extends object>(value: T): T => {
    if (Array.isArray(value)) return value.map(item => (item && typeof item === 'object' ? shuffleKeys(item as object) : item)) as unknown as T;
    const keys = Object.keys(value).reverse();
    return Object.fromEntries(keys.map(key => [key, (value as Record<string, unknown>)[key]])) as T;
  };
  const shuffledCallerModel = shuffleKeys(JSON.parse(JSON.stringify(designerProject)));

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const nextDesignerProject = shuffleKeys(JSON.parse(JSON.stringify(designerProject)));
  nextDesignerProject.windows[0].controls[0].content = '75';
  (nextDesignerProject.windows[0].controls[0] as { properties?: Record<string, unknown> }).properties!.value = 75;
  const proposal = await service.proposeEdit({
    filePath: sourcePath,
    projectId: 'demo',
    instruction: '把加载进度改为 75%，同时更新窗口布局模型',
    designerProject: shuffledCallerModel as LingWindowProject,
    updatedDesignerProject: nextDesignerProject as LingWindowProject,
    files: [{ filePath: sourcePath, updatedSource: `${sourceCode}// 键序等价\n` }]
  });
  // 旧实现（JSON.stringify 顺序敏感）在这里必然抛「与磁盘版本不一致」；深比较后必须放行。
  const applied = await service.applyEdit({
    proposalId: proposal.proposal.id,
    approved: true,
    designerProject: shuffleKeys(JSON.parse(JSON.stringify(designerProject))) as LingWindowProject
  });
  assert.equal(applied.ok, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(workspaceRoot, designerPath), 'utf8')).windows[0].controls[0].properties.value, 75);
  await service.shutdown();
});

test('AI Bridge edit.propose supports updatedLines and line-range edits with inline size guard', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/inc/Main.lcpp';
  const lines = ['类 Main', '    事件 创建完毕()', '        调试输出("起点")', '    结束', '结束类'];
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), `${lines.join('\n')}\n`, 'utf8');

  const service = new AiBridgeService(createOptions(workspaceRoot, 'yolo', 'incremental-token'));
  try {
    // updatedLines：整文件按行数组，无需 \n 转义。
    const byLines = await service.proposeEdit({
      filePath: sourcePath,
      instruction: '按行数组重写源码',
      files: [{ filePath: sourcePath, updatedLines: [...lines, '// 按行追加'] }]
    });
    await service.applyEdit({ proposalId: byLines.proposal.id, approved: true });
    // updatedLines 按 \n 拼接、不额外追加行尾换行；需要尾随换行时由调用方以空行结尾表达。
    assert.equal(await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8'), [...lines, '// 按行追加'].join('\n'));

    // edits：行级增量替换（第 3 行替换为两行）。
    const byEdits = await service.proposeEdit({
      filePath: sourcePath,
      instruction: '替换调试输出行',
      files: [{ filePath: sourcePath, edits: [{ startLine: 3, endLine: 3, newText: '        调试输出("第一行")\n        调试输出("第二行")' }] }]
    });
    await service.applyEdit({ proposalId: byEdits.proposal.id, approved: true });
    const afterEdit = await fs.readFile(path.join(workspaceRoot, sourcePath), 'utf8');
    assert.match(afterEdit, /第一行[\s\S]*第二行/u);
    assert.match(afterEdit, /按行追加/u);

    // 三选一约束与体积护栏。
    await assert.rejects(
      () => service.proposeEdit({ filePath: sourcePath, instruction: '缺内容', files: [{ filePath: sourcePath }] }),
      /必须且只能提供 updatedSource、updatedLines、edits 之一/u
    );
    await assert.rejects(
      () => service.proposeEdit({ filePath: sourcePath, instruction: '超大内联', files: [{ filePath: sourcePath, updatedSource: '甲'.repeat(200_000) }] }),
      /256 KB 内联上限；请改用 updatedLines/u
    );
    await assert.rejects(
      () => service.proposeEdit({ filePath: sourcePath, instruction: '越界增量', files: [{ filePath: sourcePath, edits: [{ startLine: 999, newText: 'x' }] }] }),
      /超出当前文件行数/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge rejects non-object designer model shapes with a guiding schema error', async () => {
  const workspaceRoot = await createTempWorkspace();
  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    await fs.mkdir(path.join(workspaceRoot, 'src'), { recursive: true });
    await fs.writeFile(path.join(workspaceRoot, 'src', 'main.lcpp'), '类 Main\n结束类\n', 'utf8');
    await assert.rejects(
      () => service.proposeEdit({
        filePath: 'src/main.lcpp',
        instruction: '尝试把设计器模型作为字符串传入',
        designerProject: JSON.stringify(createDesignerFallbackProject('demo', '字符串模型')) as unknown as LingWindowProject,
        files: [{ filePath: 'src/main.lcpp', updatedSource: '类 Main\n结束类\n// x\n' }]
      }),
      /designerProject 必须是 JSON object，收到 string/u
    );
  } finally {
    await service.shutdown();
  }
});

test('AI Bridge build and preview tools resolve the designer model from projectId and fail with guidance when both inputs are missing', async () => {
  const workspaceRoot = await createTempWorkspace();
  const projectId = 'project-id-preview';
  const designerProject = createDesignerFallbackProject(projectId, '按 ID 预览');
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '按 ID 预览' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  const preview = await service.nativePreview({ projectId });
  assert.equal(preview.ok, true);
  assert.equal(preview.logs.some(line => line.includes('不一致')), false, JSON.stringify(preview.logs));

  await assert.rejects(() => service.nativePreview({}), /需要 project（完整设计器模型）或 projectId/u);
  await assert.rejects(() => service.buildRun({}), /需要 project（完整设计器模型）或 projectId/u);
  await assert.rejects(() => service.nativePreview({ projectId: 'ghost' }), /未在解决方案/u);
  await service.shutdown();
});

test('AI Bridge designer deletion guard error tells the caller how to unlock deletion', async () => {
  const workspaceRoot = await createTempWorkspace();
  const sourcePath = 'src/del/Main.lcpp';
  const projectId = 'del-guard';
  const designerProject = createDesignerFallbackProject(projectId, '删除守卫');
  const designerPath = `.lingbuilder/projects/${projectId}/window-designer.json`;
  await fs.mkdir(path.dirname(path.join(workspaceRoot, sourcePath)), { recursive: true });
  await fs.mkdir(path.dirname(path.join(workspaceRoot, designerPath)), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, sourcePath), '类 Main\n结束类\n', 'utf8');
  await fs.writeFile(path.join(workspaceRoot, designerPath), `${JSON.stringify(designerProject, null, 2)}\n`, 'utf8');
  await registerSolutionProject(workspaceRoot, { id: projectId, name: '删除守卫' });

  const service = new AiBridgeService(createOptions(workspaceRoot, 'preview'));
  try {
    const removed = JSON.parse(JSON.stringify(designerProject)) as LingWindowProject;
    removed.windows[0].controls = [];
    await assert.rejects(
      () => service.proposeEdit({
        filePath: sourcePath,
        projectId,
        instruction: '调整窗口布局',
        updatedDesignerProject: removed,
        files: [{ filePath: sourcePath, updatedSource: '类 Main\n结束类\n// x\n' }]
      }),
      /请在 instruction 中明确写出「删除\/移除\/去掉\/清除」/u
    );
  } finally {
    await service.shutdown();
  }
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

/** 在测试工作区 solution.json 中注册项目：设计器模型与 .lingbuilder/projects/<id>/ 写入只允许已注册项目。 */
async function registerSolutionProject(
  workspaceRoot: string,
  project: { id: string; name?: string; sourceRoot?: string }
): Promise<void> {
  const solutionPath = path.join(workspaceRoot, '.lingbuilder', 'solution.json');
  let solution: Record<string, unknown> = {
    schemaVersion: 2,
    id: 'ai-bridge-test-solution',
    name: 'AI Bridge 测试解决方案',
    startupProjectId: project.id,
    projects: [] as unknown[]
  };
  try {
    solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as Record<string, unknown>;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
  }
  const projects = Array.isArray(solution.projects) ? [...solution.projects as Record<string, unknown>[]] : [];
  const sourceRoot = project.sourceRoot ?? `src/${project.id}`;
  projects.push({
    id: project.id,
    name: project.name ?? project.id,
    type: 'visual-cpp',
    sourceRoot,
    configRoot: `config/${project.id}`,
    designerPath: `.lingbuilder/projects/${project.id}/window-designer.json`
  });
  solution.projects = projects;
  if (!solution.startupProjectId) solution.startupProjectId = project.id;
  await fs.mkdir(path.dirname(solutionPath), { recursive: true });
  await fs.writeFile(solutionPath, `${JSON.stringify(solution, null, 2)}\n`, 'utf8');
}

async function installTestModule(
  workspaceRoot: string,
  manifest: Record<string, unknown>,
  documentationPath?: string
): Promise<void> {
  const moduleRoot = path.join(workspaceRoot, '.lingbuilder', 'modules', String(manifest.id));
  await fs.mkdir(moduleRoot, { recursive: true });
  await fs.writeFile(path.join(moduleRoot, 'lingbuilder.module.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  if (documentationPath) {
    const target = path.join(moduleRoot, ...documentationPath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, '# 测试模块文档\n', 'utf8');
  }
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
