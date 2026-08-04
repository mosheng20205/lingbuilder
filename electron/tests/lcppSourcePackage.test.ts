import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  createLcppSourcePackageService,
  LCPP_GENERATOR_CAPABILITIES,
  LCPP_SOURCE_PACKAGE_KIND,
  resolveProjectSourcePackagePath
} from '../electron/lcppSourcePackageService';
import { DesktopWorkspaceService } from '../electron/workspaceService';
import { createSolutionService, DEFAULT_PROJECT_ID } from '../src/services/solution/solutionService';

test('LCPP 源码包导出路径统一落在工作区根目录 exports', () => {
  const workspace = path.join('C:', 'LingBuilder', '示例工作区');
  assert.equal(
    resolveProjectSourcePackagePath(workspace, path.join('Downloads', '分享示例.lcpppkg'), '备用名称'),
    path.join(workspace, 'exports', '分享示例.lcpppkg')
  );
  assert.equal(
    resolveProjectSourcePackagePath(workspace, path.join('其他目录', '没有扩展名'), '备用名称'),
    path.join(workspace, 'exports', '没有扩展名.lcpppkg')
  );
});

test('LCPP 源码包一键导出后可在独立目录完整导入', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-package-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'build-configuration.json'), JSON.stringify({
    schemaVersion: 1,
    mode: 'Release',
    architecture: 'x64'
  }, null, 2), 'utf8');
  const sourcePath = path.join(workspace, 'src', 'MainWindow.lcpp');
  const source = '包 分享示例\n使用 Win32窗口基础模块\n\n类 MainWindow : 窗口\n  事件 _MainWindow_创建完毕()\n    调试输出("你好，源码分享")\n  结束\n结束类\n';
  await fs.writeFile(sourcePath, source, 'utf8');
  await fs.mkdir(path.join(workspace, 'assets'), { recursive: true });
  await fs.writeFile(path.join(workspace, 'assets', '说明.txt'), '资源内容', 'utf8');
  await fs.writeFile(path.join(workspace, 'src', '.env'), 'API_KEY=secret', 'utf8');
  const unrelatedSdkRoot = path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.cef3.sdk');
  await fs.mkdir(unrelatedSdkRoot, { recursive: true });
  await fs.writeFile(path.join(unrelatedSdkRoot, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'lingbuilder.cef3.sdk',
    name: '未使用的 CEF3 SDK',
    version: '1.0.0',
    category: '界面',
    description: '未启用 CEF3 浏览器时不应进入源码包。'
  }, null, 2), 'utf8');

  const packagePath = path.join(root, '带括号的导出目录 (分享)', '分享示例.lcpppkg');
  const service = createLcppSourcePackageService(workspace);
  const exported = await service.exportProject(DEFAULT_PROJECT_ID, packagePath, '0.2.0-test');
  assert.equal(exported.ok, true);
  assert.equal(exported.lcppFileCount, 3);
  assert.ok(exported.manifest.excludedSensitiveFiles.includes('src/.env'));
  assert.ok(!exported.manifest.bundledSupportModuleIds.includes('lingbuilder.cef3.sdk'));
  assert.ok((await fs.stat(packagePath)).isFile());

  const preview = await service.inspectPackage(packagePath);
  assert.equal(preview.manifest.kind, LCPP_SOURCE_PACKAGE_KIND);
  assert.equal(preview.manifest.minimumGeneratorVersion, '0.2.5');
  assert.deepEqual(preview.manifest.requiredCapabilities, []);
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
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'build-configuration.json'), 'utf8')), {
    schemaVersion: 1,
    mode: 'Release',
    architecture: 'x64'
  });
  assert.ok(await exists(imported.solutionEntryPath));
});

test('LCPP 源码包会记录 ListView 高级 API 所需生成器能力', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-capability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '包 ListView能力示例',
    '使用 Win32窗口基础模块',
    '使用 Win32高级控件模块',
    '',
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        列表视图_添加列("列表", "名称", 120, "left")',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');

  const packagePath = path.join(root, 'listview-capability.lcpppkg');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.deepEqual(exported.manifest.requiredCapabilities, [LCPP_GENERATOR_CAPABILITIES.listViewAdvancedApi]);
  const preview = await createLcppSourcePackageService(workspace).inspectPackage(packagePath);
  assert.deepEqual(preview.manifest.requiredCapabilities, [LCPP_GENERATOR_CAPABILITIES.listViewAdvancedApi]);
});

test('LCPP 源码包会记录 ListView 类型化行所需生成器能力', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-listview-structured-capability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '包 ListView类型化行示例',
    '使用 Win32窗口基础模块',
    '使用 Win32高级控件模块',
    '',
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        列表视图_添加行(列表, 列表视图_创建行("名称", "状态"))',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');

  const exported = await createLcppSourcePackageService(workspace).exportProject(
    DEFAULT_PROJECT_ID,
    path.join(root, 'listview-structured-capability.lcpppkg')
  );
  assert.equal(exported.manifest.minimumGeneratorVersion, '0.2.7');
  assert.deepEqual(exported.manifest.requiredCapabilities, [LCPP_GENERATOR_CAPABILITIES.listViewStructuredRows]);
});

test('LCPP 源码包会记录 DataGrid v1 所需生成器能力', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-datagrid-capability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        表格_添加行("订单表格", "order-1")',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');

  const packagePath = path.join(root, 'datagrid-capability.lcpppkg');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.equal(exported.manifest.minimumGeneratorVersion, '0.2.5');
  assert.deepEqual(exported.manifest.requiredCapabilities, [LCPP_GENERATOR_CAPABILITIES.dataGridV1]);
});

test('LCPP 源码包使用 EdgeView v1 命令时声明 safe-api.v1 和 0.2.7', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-edgeview-capability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        EdgeView脚本_执行异步("浏览器1", "document.title", &浏览器1_JS完成)',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');
  const packagePath = path.join(root, 'edgeview-capability.lcpppkg');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.equal(exported.manifest.minimumGeneratorVersion, '0.2.7');
  assert.deepEqual(exported.manifest.requiredCapabilities, [LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV1]);
});

test('LCPP 源码包使用 EdgeView v2 命令时声明 safe-api.v2 和 0.2.7', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-edgeview-v2-capability-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        EdgeView工作线程_枚举异步("浏览器1", 2, &浏览器1_线程完成)',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, path.join(root, 'edgeview-v2.lcpppkg'));
  assert.equal(exported.manifest.minimumGeneratorVersion, '0.2.7');
  assert.ok(exported.manifest.requiredCapabilities.includes(LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV2));
});

test('LCPP 源码包和项目构建会排除源码目录中误创建的嵌套工作区', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-nested-workspace-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  const solutionService = createSolutionService(workspace);
  const solution = await solutionService.getSolution();
  const project = solutionService.getProject(solution, DEFAULT_PROJECT_ID);
  const nestedRoot = path.join(workspace, 'src');
  await fs.mkdir(path.join(nestedRoot, '.lingbuilder'), { recursive: true });
  await fs.mkdir(path.join(nestedRoot, 'src'), { recursive: true });
  await fs.mkdir(path.join(nestedRoot, 'config'), { recursive: true });
  await fs.writeFile(path.join(nestedRoot, '.lingbuilder', 'solution.json'), JSON.stringify({ schemaVersion: 2 }), 'utf8');
  await fs.writeFile(path.join(nestedRoot, '未命名解决方案.lbsln'), JSON.stringify({ kind: 'lingbuilder-solution' }), 'utf8');
  await fs.writeFile(path.join(nestedRoot, 'src', 'MainWindow.lcpp'), '类 MainWindow\n结束类\n', 'utf8');
  await fs.writeFile(path.join(nestedRoot, 'config', 'config.ini'), '[project]\nname=nested\n', 'utf8');

  const projectFiles = await solutionService.readProjectFiles(project);
  assert.ok(projectFiles['src/MainWindow.lcpp']);
  assert.ok(!projectFiles['src/src/MainWindow.lcpp']);
  assert.ok(!projectFiles['src/.lingbuilder/solution.json']);

  const packagePath = path.join(root, 'nested-filtered.lcpppkg');
  const service = createLcppSourcePackageService(workspace);
  const exported = await service.exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.equal(exported.lcppFileCount, 3);
  assert.ok(exported.warnings.some(warning => warning.includes('嵌套 LingBuilder 工作区')));
  assert.ok(!exported.manifest.files.some(file => file.path.startsWith('src/src/')));
  assert.ok(!exported.manifest.files.some(file => file.path.startsWith('src/.lingbuilder/')));

  const imported = await service.importPackage(packagePath, path.join(root, 'imports'));
  await assert.rejects(fs.access(path.join(imported.workspacePath, 'src', 'src', 'MainWindow.lcpp')));
  await assert.rejects(fs.access(path.join(imported.workspacePath, 'src', '.lingbuilder', 'solution.json')));
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
    minLingBuilderVersion: '0.2.9',
    category: '其他',
    description: '验证源码包可携带第三方模块。'
  }, null, 2), 'utf8');
  const supportModuleRoot = path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk');
  await fs.mkdir(supportModuleRoot, { recursive: true });
  await fs.writeFile(path.join(supportModuleRoot, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'lingbuilder.fbro.sdk',
    name: 'FBro 测试 SDK',
    version: '1.0.0',
    category: '界面',
    description: '启用 FBro 浏览器时应随源码包携带。'
  }, null, 2), 'utf8');
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.fbro.browser', moduleId],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0', 'lingbuilder.fbro.browser': '1.0.0', [moduleId]: '1.2.3' }
  }, null, 2), 'utf8');

  const service = createLcppSourcePackageService(workspace);
  const packagePath = path.join(root, 'module-demo.lcpppkg');
  const exported = await service.exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.equal(exported.manifest.minimumGeneratorVersion, '0.2.9');
  assert.ok(exported.manifest.modules.some(module => module.id === moduleId && module.bundled));
  assert.ok(exported.manifest.bundledSupportModuleIds.includes('lingbuilder.fbro.sdk'));
  const imported = await service.importPackage(packagePath, path.join(root, 'imports'));
  assert.ok(await exists(path.join(imported.workspacePath, '.lingbuilder', 'modules', moduleId, 'lingbuilder.module.json')));
  assert.ok(await exists(path.join(imported.workspacePath, '.lingbuilder', 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json')));
  const refs = JSON.parse(await fs.readFile(path.join(imported.workspacePath, '.lingbuilder', 'project-modules.json'), 'utf8'));
  assert.ok(refs.enabledModuleIds.includes(moduleId));
  assert.equal(refs.pinnedVersions[moduleId], '1.2.3');
});

test('通用密码学源码包自动携带只读密码学 SDK', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-crypto-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        调试输出(哈希_SHA256文本("LingBuilder"))',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.crypto.hash'],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0', 'lingbuilder.crypto.hash': '1.0.0' }
  }, null, 2), 'utf8');
  const sdkRoot = path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.crypto.sdk');
  await fs.mkdir(sdkRoot, { recursive: true });
  await fs.writeFile(path.join(sdkRoot, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'lingbuilder.crypto.sdk',
    name: '密码学测试 SDK',
    version: '1.0.0',
    category: '系统',
    description: '测试密码学消费者的源码包资产携带。'
  }, null, 2), 'utf8');

  const packagePath = path.join(root, 'crypto-demo.lcpppkg');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.ok(exported.manifest.bundledSupportModuleIds.includes('lingbuilder.crypto.sdk'));
});

test('OpenCV 源码包自动携带只读 x64 SDK', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-opencv-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = path.join(root, 'workspace');
  await fs.mkdir(workspace, { recursive: true });
  await createSolutionService(workspace).getSolution();
  await fs.writeFile(path.join(workspace, 'src', 'MainWindow.lcpp'), [
    '类 MainWindow : 窗体',
    '    事件 _MainWindow_创建完毕()',
    '        调试输出(OpenCV_取版本())',
    '    结束',
    '结束类',
    ''
  ].join('\n'), 'utf8');
  await fs.writeFile(path.join(workspace, '.lingbuilder', 'project-modules.json'), JSON.stringify({
    schemaVersion: 1,
    enabledModuleIds: ['lingbuilder.win32.basic', 'lingbuilder.opencv'],
    pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0', 'lingbuilder.opencv': '1.0.0' }
  }, null, 2), 'utf8');
  const sdkRoot = path.join(workspace, '.lingbuilder', 'modules', 'lingbuilder.opencv.sdk');
  await fs.mkdir(sdkRoot, { recursive: true });
  await fs.writeFile(path.join(sdkRoot, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'lingbuilder.opencv.sdk',
    name: 'OpenCV 测试 SDK',
    version: '4.14.0+bridge.1',
    category: '图像',
    description: '测试 OpenCV 消费模块的源码包资产携带。'
  }, null, 2), 'utf8');
  const packagePath = path.join(root, 'opencv-demo.lcpppkg');
  const exported = await createLcppSourcePackageService(workspace).exportProject(DEFAULT_PROJECT_ID, packagePath);
  assert.ok(exported.manifest.bundledSupportModuleIds.includes('lingbuilder.opencv.sdk'));
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
