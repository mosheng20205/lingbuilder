import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService, LCPP_SOURCE_PACKAGE_KIND } from '../electron/lcppSourcePackageService';
import { DesktopWorkspaceService } from '../electron/workspaceService';
import { createSolutionService, DEFAULT_PROJECT_ID } from '../src/services/solution/solutionService';

test('LCPP 源码包一键导出后可在独立目录完整导入', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  const sourcePath = path.join(workspace, 'src', 'MainWindow.lcpp');
  const source = '包 分享示例\n使用 Win32窗口基础模块\n\n类 MainWindow : 窗口\n  事件 _MainWindow_创建完毕()\n    调试输出("你好，源码分享")\n  结束\n结束类\n';
  await fs.writeFile(sourcePath, source, 'utf8');
  await fs.mkdir(path.join(workspace, 'assets'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'assets', '说明.txt'), '资源内容', 'utf8');
  await fs.writeFile(path.join(workspace, 'src', '.env'), 'API_KEY=secret', 'utf8');

  const packagePath = path.join(root, '带括号的导出目录 (分享)', '分享示例.lcpppkg');
  const service = createLcppSourcePackageService(workspace);
  const exported = await service.exportProject(DEFAULT_PROJECT_ID, packagePath, '0.2.0-test');
  assert.equal(exported.ok, true);
  assert.equal(exported.lcppFileCount, 3);
  assert.ok(exported.manifest.excludedSensitiveFiles.includes('src/.env'));
  assert.ok((await fs.stat(packagePath)).isFile());

  const preview = await service.inspectPackage(packagePath);
  assert.equal(preview.manifest.kind, LCPP_SOURCE_PACKAGE_KIND);
  assert.equal(preview.manifest.startupProjectId, DEFAULT_PROJECT_ID);
  assert.equal(preview.packageSha256.length, 64);

  const imported = await service.importPackage(packagePath, path.join(root, 'imports'));
  assert.equal(await fs.readFile(path.join(imported.workspacePath, 'src', 'MainWindow.lcpp'), 'utf8'), source);
  assert.ok(await exists(path.join(imported.workspacePath, 'src', '项目全局变量.lcpp')));
  assert.ok(await exists(path.join(imported.workspacePath, 'src', '项目数据类型.lcpp')));
  assert.equal(await fs.readFile(path.join(imported.workspacePath, 'assets', '说明.txt'), 'utf8'), '资源内容');
  await assert.rejects(fs.access(path.join(imported.workspacePath, 'src', '.env')));
  assert.ok(await exists(path.join(imported.workspacePath, '.lingbuilder', 'window-designer.json')));
  assert.ok(await exists(path.join(imported.workspacePath, '.lingbuilder', 'project-modules.json')));
  assert.ok(await exists(imported.solutionEntryPath));
});

test('LCPP 源码包隔离携带已启用的第三方模块', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-module-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  const moduleId = 'example.share.module';
  const moduleRoot = path.join(workspace, '.lingbuilder', 'modules', moduleId);
  await fs.mkdir(moduleRoot, { recursive: true });
  await fs.writeFile(path.join(moduleRoot, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: moduleId,
    name: '分享测试模块',
    version: '1.2.3',
    category: '其他',
    description: '验证源码包可携带第三方模块。'
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', moduleId],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0', [moduleId]: '1.2.3' }
  }, null, 2), 'utf8');

  const service = createLcppSourcePackageService(workspace);
  const packagePath = path.join(root, 'module-demo.lcpppkg');
  const exported = await service.exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.ok(exported.manifest.modules.some(module => module.id === moduleId && module.bundled));
  const imported = await service.importPackage(packagePath, path.join(root, 'imports'));
  assert.ok(await exists(path.join(imported.workspacePath, '.lingbuilder', 'modules', moduleId, 'lingbuilder.module.json')));
  const refs = JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'project-modules.json'), 'utf8'));
  assert.ok(refs.enabledModuleIds.includes(moduleId));
  assert.equal(refs.pinnedVersions[moduleId], '1.2.3');
});

test('双击关联的 .lcpppkg 会导入并解析为可直接打开的工作区', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-associated-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'author-workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  const packagePath = path.join(root, '双击打开.lcpppkg');
  await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);

  const desktop = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', packagePath],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData'),
    profile: 'packaged'
  });
  const importedWorkspace = await desktop.resolveInitialWorkspace();
  assert.ok(importedWorkspace.startsWith(path.join(root, 'Documents', 'LingBuilder', '已导入源码')));
  assert.ok(await exists(path.join(importedWorkspace, 'src', 'MainWindow.lcpp')));
  assert.ok(await exists(path.join(importedWorkspace, '.lingbuilder', 'source-package-import.json')));
});

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}
