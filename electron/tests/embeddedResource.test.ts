import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import {
  EMBEDDED_RESOURCE_ID_BASE,
  EMBEDDED_RESOURCE_LIMIT,
  buildEmbeddedResourceRcLines,
  getEmbeddedResourceSpecs,
  validateEmbeddedResources
} from '../src/services/windowDesigner/embeddedResourceService';
import { EMBEDDED_RESOURCE_MODULE_ID, generateEmbeddedResourceRuntime } from '../src/services/windowDesigner/embeddedResourceRuntime';
import { migrateLegacyEmbeddedFiles } from '../src/services/windowDesigner/embeddedResourceMigration';
import { generateWindowsExecutableResourceFile } from '../src/services/windowDesigner/windowsExecutableIconService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';

const project = (resources: LingWindowProject['embeddedResources']): LingWindowProject => ({
  schemaVersion: 2,
  id: 'embed-check',
  name: '内嵌资源检查',
  windows: [{
    id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '检查',
    width: 480, height: 240, background: '#202028', description: '检查', controls: []
  }],
  embeddedResources: resources
});

test('内嵌资源：规格、rc 行与运行期映射表按逻辑名生成', () => {
  const model = project([
    { name: 'resources/说明.txt', file: 'src/resources/说明.txt' },
    { name: 'resources/素材.zip', file: 'src/resources/素材.zip', extract: true }
  ]);
  const specs = getEmbeddedResourceSpecs(model);
  assert.equal(specs.length, 2);
  assert.equal(specs[0].resourceId, EMBEDDED_RESOURCE_ID_BASE);
  assert.equal(specs[1].resourceId, EMBEDDED_RESOURCE_ID_BASE + 1);
  // 源文件进 rc 前被复制成 ASCII 归档名：中文路径/中文名不会流进 rc.exe。
  assert.equal(specs[0].resourceFileName, 'resources/res-0001.txt');
  assert.equal(specs[1].resourceFileName, 'resources/res-0002.zip');
  assert.equal(specs[1].extract, true);

  const rcLines = buildEmbeddedResourceRcLines(specs);
  assert.ok(rcLines[0].startsWith(`#define ID_RCDATA_LINGBUILDER_RESOURCE_${EMBEDDED_RESOURCE_ID_BASE} `));
  assert.match(rcLines[1], /RCDATA "resources\\\\res-0001\.txt"/u);

  const module = {
    manifest: BUILTIN_MODULES.find(item => item.id === EMBEDDED_RESOURCE_MODULE_ID)!,
    installPath: `builtin://${EMBEDDED_RESOURCE_MODULE_ID}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const runtime = generateEmbeddedResourceRuntime([module], specs, 'embed-check');
  assert.match(runtime, /2301u, false, L"resources\/说明\.txt"/u, '映射表必须带上逻辑名与资源号');
  assert.match(runtime, /2302u, true, L"resources\/素材\.zip"/u);
  assert.match(runtime, /FindResourceW/u);
  assert.match(runtime, /资源_取字节集/u);
  assert.match(runtime, /资源_释放到临时目录/u);
  assert.match(runtime, /lingbuilder-embedded/u);
  // 未启用模块时不发射运行时（命令不可用，避免生成悬空调用）。
  assert.equal(generateEmbeddedResourceRuntime([], specs, 'embed-check'), '');
});

test('内嵌资源：路径与条数守卫给出中文诊断，模块清单与文档登记齐全', async () => {
  assert.ok(validateEmbeddedResources(project([{ name: 'a.txt', file: '../外.txt' }])).some(item => item.includes('工作区内')));
  assert.ok(validateEmbeddedResources(project([{ name: 'a.txt', file: 'src/没有扩展名' }])).some(item => item.includes('扩展名')));
  assert.ok(validateEmbeddedResources(project([
    { name: 'same.txt', file: 'src/a.txt' },
    { name: 'same.txt', file: 'src/b.txt' }
  ])).some(item => item.includes('重复')));
  const tooMany = Array.from({ length: EMBEDDED_RESOURCE_LIMIT + 1 }, (_, index) => ({ name: `f${index}.txt`, file: `src/f${index}.txt` }));
  assert.ok(validateEmbeddedResources(project(tooMany)).some(item => item.includes('上限')));
  assert.deepEqual(validateEmbeddedResources(project([{ name: '资源/说明.txt', file: 'src/资源/说明.txt' }])), []);

  const manifest = BUILTIN_MODULES.find(item => item.id === EMBEDDED_RESOURCE_MODULE_ID);
  assert.ok(manifest, '内置模块注册表必须包含内嵌资源模块');
  assert.deepEqual(manifest!.bindings?.commands?.map(binding => binding.command), manifest!.contributes?.commands?.map(command => command.name));
  const docs = manifest!.contributes?.docs || [];
  assert.ok(docs.length >= 1, '必须登记至少一份文档');
  const { readFile } = await import('node:fs/promises');
  const content = await readFile(new URL(`../${docs[0].path}`, import.meta.url), 'utf8');
  assert.match(content, /资源_取字节集/u, '模块文档必须覆盖命令用法');
});

test('内嵌资源导入：复制进项目源码根 resources、重名去冲突、文件夹保留相对路径', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-embed-ws-'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-embed-src-'));
  const outsideSecond = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-embed-src2-'));
  try {
    const service = new DesignerAssetService(workspace);
    const project: LingBuilderSolutionProject = {
      id: 'embed-import', name: '内嵌资源导入', type: 'visual-cpp', sourceRoot: 'src', configRoot: 'config',
      designerPath: '.lingbuilder/projects/embed-import/window-designer.json'
    };
    await fs.mkdir(path.join(outside, 'www', 'css'), { recursive: true });
    await fs.writeFile(path.join(outside, 'logo.png'), Buffer.from([1, 2, 3, 4]));
    await fs.writeFile(path.join(outside, '说明.txt'), '内嵌资源演示', 'utf8');
    await fs.writeFile(path.join(outside, 'a!b.txt'), '非法字符文件名', 'utf8');
    await fs.writeFile(path.join(outside, '没有扩展名'), 'x', 'utf8');
    await fs.writeFile(path.join(outside, 'www', 'index.html'), '<html>内嵌</html>', 'utf8');
    await fs.writeFile(path.join(outside, 'www', 'css', 'app.css'), 'body{}', 'utf8');
    await fs.writeFile(path.join(outsideSecond, 'logo.png'), Buffer.from([9, 9, 9, 9, 9]));

    const files = await service.importEmbeddedResourceFiles(project, [
      path.join(outside, 'logo.png'),
      path.join(outside, '说明.txt'),
      path.join(outside, 'a!b.txt'),
      path.join(outside, '没有扩展名')
    ]);
    assert.deepEqual(files.entries.map(entry => entry.name), ['resources/logo.png', 'resources/说明.txt', 'resources/a-b.txt']);
    assert.deepEqual(files.entries.map(entry => entry.file), ['src/resources/logo.png', 'src/resources/说明.txt', 'src/resources/a-b.txt']);
    assert.deepEqual(await fs.readFile(path.join(workspace, 'src', 'resources', 'logo.png')), Buffer.from([1, 2, 3, 4]));
    assert.equal(await fs.readFile(path.join(workspace, 'src', 'resources', '说明.txt'), 'utf8'), '内嵌资源演示');
    // 同上但不同内容 → 自动去冲突成 -2，不覆盖已有文件。
    const again = await service.importEmbeddedResourceFiles(project, [path.join(outsideSecond, 'logo.png')]);
    assert.deepEqual(again.entries.map(entry => entry.name), ['resources/logo-2.png']);
    assert.deepEqual(await fs.readFile(path.join(workspace, 'src', 'resources', 'logo-2.png')), Buffer.from([9, 9, 9, 9, 9]));
    assert.deepEqual(await fs.readFile(path.join(workspace, 'src', 'resources', 'logo.png')), Buffer.from([1, 2, 3, 4]));
    // 相同内容重复导入 → 复用同一个文件，不产生 -3。
    const same = await service.importEmbeddedResourceFiles(project, [path.join(outside, 'logo.png')]);
    assert.deepEqual(same.entries.map(entry => entry.name), ['resources/logo.png']);
    // 文件名里不能进逻辑名的字符被替换成连字符，并作为说明回给用户；无扩展名文件直接跳过。
    assert.ok(files.notes.some(note => note.includes('a!b.txt')), '非法字符改名必须给出中文说明');
    assert.equal(await fs.readFile(path.join(workspace, 'src', 'resources', 'a-b.txt'), 'utf8'), '非法字符文件名');
    assert.equal(files.skipped.length, 1);
    assert.ok(files.skipped[0].reason.includes('扩展名'));

    // 文件夹导入：递归展开、文件夹名作为顶层目录、保留文件夹内的相对路径，跳过无扩展名文件。
    const folder = await service.importEmbeddedResourceFolder(project, outside);
    const folderName = path.basename(outside);
    assert.deepEqual(folder.entries.map(entry => entry.name).sort(), [
      `resources/${folderName}/a-b.txt`,
      `resources/${folderName}/logo.png`,
      `resources/${folderName}/www/css/app.css`,
      `resources/${folderName}/www/index.html`,
      `resources/${folderName}/说明.txt`
    ].sort());
    assert.equal(await fs.readFile(path.join(workspace, 'src', 'resources', folderName, 'www', 'index.html'), 'utf8'), '<html>内嵌</html>');
    assert.equal(await fs.readFile(path.join(workspace, 'src', 'resources', folderName, 'www', 'css', 'app.css'), 'utf8'), 'body{}');
    assert.ok(folder.skipped.some(item => item.reason.includes('扩展名')), '文件夹里的无扩展名文件也应被跳过');
    assert.equal(service.getProjectResourceRoot({ ...project, sourceRoot: '.' }), 'resources');

    // 扫描工作区内目录：只读、不复制，逻辑名取工作区相对路径原样。
    await fs.mkdir(path.join(workspace, 'assets'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'assets', '图标.ico'), Buffer.from([0, 0, 1, 0]), 'utf8');
    await fs.writeFile(path.join(workspace, 'assets', 'README'), 'no extension', 'utf8');
    const scanned = await service.scanEmbeddedResourceDirectory('assets');
    assert.deepEqual(scanned.files, ['assets/图标.ico']);
    assert.equal(scanned.skipped.length, 1);
    await assert.rejects(() => service.scanEmbeddedResourceDirectory('../'), /工作区|相对路径/u);
  } finally {
    await Promise.all([
      fs.rm(workspace, { recursive: true, force: true }),
      fs.rm(outside, { recursive: true, force: true }),
      fs.rm(outsideSecond, { recursive: true, force: true })
    ]);
  }
});

test('旧内嵌文件迁移：转成项目内嵌资源（启动释放）并给出弃用诊断', () => {
  const legacy: LingWindowProject = {
    schemaVersion: 2,
    id: 'legacy-embedded-files',
    name: '旧内嵌文件项目',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
      width: 640, height: 480, background: '#ffffff', description: '旧内嵌文件', controls: [],
      iconStyle: 'none',
      embeddedFiles: [
        { file: 'src/资源/说明.txt', extractName: '说明.txt' },
        { file: 'src/资源/素材.zip' }
      ]
    }]
  };
  const migration = migrateLegacyEmbeddedFiles(legacy);
  assert.deepEqual(migration.migrated.map(entry => entry.name), ['说明.txt', '素材.zip']);
  assert.deepEqual(migration.project.embeddedResources?.map(entry => entry.file), ['src/资源/说明.txt', 'src/资源/素材.zip']);
  assert.ok(migration.project.embeddedResources?.every(entry => entry.extract === true), '迁移后必须按原语义启动释放');
  assert.equal(migration.project.windows[0].embeddedFiles, undefined, '迁移后不再保留旧字段');
  assert.ok(migration.deprecation.some(text => text.includes('embeddedFiles')), '必须给出弃用中文诊断');
  assert.deepEqual(migration.diagnostics, []);

  // 幂等：同一份模型再迁移一次不产生新条目，也不再报弃用。
  const again = migrateLegacyEmbeddedFiles(migration.project);
  assert.equal(again.project.embeddedResources?.length, 2);
  assert.deepEqual(again.deprecation, []);
  assert.deepEqual(again.migrated, []);

  // 逻辑名冲突不静默覆盖已有清单，并给出阻断级中文诊断。
  const conflict = migrateLegacyEmbeddedFiles({
    ...legacy,
    embeddedResources: [{ name: '说明.txt', file: 'src/其他.txt' }]
  });
  assert.equal(conflict.project.embeddedResources?.length, 2, '冲突条目不得覆盖已有内嵌资源');
  assert.equal(conflict.project.embeddedResources?.[0].file, 'src/其他.txt', '已有条目必须原样保留');
  assert.deepEqual(conflict.migrated.map(entry => entry.name), ['素材.zip'], '只有不冲突的条目被迁移');
  assert.ok(conflict.diagnostics.some(text => text.includes('冲突')));

  // 释放名不合法时退回源文件基名（旧字段的释放名限制比逻辑名更严）。
  const fallback = migrateLegacyEmbeddedFiles({
    ...legacy,
    windows: [{ ...legacy.windows[0], embeddedFiles: [{ file: 'src/资源/中文名.txt', extractName: '中文名.txt' }] }]
  });
  assert.deepEqual(fallback.migrated.map(entry => entry.name), ['中文名.txt']);
});

test('旧内嵌文件与窗口图标解耦：图标选「不显示」也照常进 rc，并在启动时释放', () => {
  const window: LingWindowModel = {
    id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '主窗口',
    width: 640, height: 480, background: '#ffffff', description: '耦合检查', controls: [],
    iconStyle: 'none',
    embeddedFiles: [{ file: 'src/resources/bundle.zip', extractName: 'bundle.zip' }]
  };
  const rc = generateWindowsExecutableResourceFile(window);
  assert.ok(rc, '图标关闭时也必须生成 rc：内嵌文件不能随图标一起被静默丢弃');
  assert.match(rc!.content, /ID_RCDATA_LINGBUILDER_EMBEDDED_2001 RCDATA "resources\/lingbuilder-embedded-1\.bin"/u);
  assert.doesNotMatch(rc!.content, /IDI_LINGBUILDER_APP/u);

  const project: LingWindowProject = {
    schemaVersion: 2, id: 'legacy-startup-release', name: '旧内嵌文件启动释放',
    windows: [{ ...window }]
  };
  const module = {
    manifest: BUILTIN_MODULES.find(item => item.id === EMBEDDED_RESOURCE_MODULE_ID)!,
    installPath: `builtin://${EMBEDDED_RESOURCE_MODULE_ID}`,
    isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n结束类\n',
    enabledModules: [module]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /2301u, true, L"bundle\.zip"/u, '迁移后的资源必须以 2301 起打进 rc 表');
  assert.match(cpp, /LB_EmbeddedResourceReleaseExtracted\(\);/, 'wWinMain 必须调用启动释放');
  assert.doesNotMatch(cpp, /LingBuilder_释放内嵌资源文件/u, '旧释放函数已随迁移下线');
  assert.ok(generated.diagnostics.some(text => text.includes('embeddedFiles')), '构建诊断必须提示旧字段已弃用');
  assert.ok(!generated.blockingDiagnostics.some(text => text.includes('embeddedFiles')), '弃用提示不应阻断构建');
  const layout = generated.files.find(file => file.relativePath === 'layout.json')!.content;
  assert.match(layout, /"embeddedResources"/u, '生成的设计器模型快照必须已是迁移后的新清单');
  assert.doesNotMatch(layout, /"embeddedFiles"/u);
});

test('设计器内嵌资源面板与配置对话框：动作经宿主分发，并复用同一份中文校验', async () => {
  const editor = await fs.readFile(new URL('../src/components/EmbeddedResourceEditor.tsx', import.meta.url), 'utf8');
  assert.match(editor, /onSelectFiles/u, '面板把需要工作区/本机能力的动作交给宿主');
  assert.match(editor, /onSelectFolder/u);
  assert.match(editor, /onScanDirectory/u);
  assert.match(editor, /onEnableModule/u);
  assert.match(editor, /validateEmbeddedResources/u, '面板必须复用服务端同一份校验');
  assert.match(editor, /选择文件夹…/u);
  assert.match(editor, /启动释放/u);
  assert.doesNotMatch(editor, /from 'node:fs/u, 'renderer 组件不得直接使用 fs');

  // 设计器宿主：把四个动作分发到 designer.embeddedResources.* 命令（命令系统仍是唯一入口）。
  const designer = await fs.readFile(new URL('../src/components/WpfDesigner.tsx', import.meta.url), 'utf8');
  for (const commandId of ['designer.embeddedResources.addFiles', 'designer.embeddedResources.addFolder', 'designer.embeddedResources.addDirectory', 'designer.embeddedResources.enableModule']) {
    assert.ok(designer.includes(commandId), `设计器宿主必须分发 ${commandId}`);
  }
  assert.match(designer, /executeDesignerCommandOrThrow/u);
  assert.match(designer, /embeddedResourceModuleEnabled=\{enabledDesignerModules\.has\(EMBEDDED_RESOURCE_MODULE_ID\)\}/u);
  assert.match(designer, /selectAndImportEmbeddedResourceFiles/u);
  assert.match(designer, /embeddedResourceActions/u, '增改口径必须与对话框共用同一实现');

  // 「配置项目内嵌资源」对话框：解决方案资源管理器入口用它，不再切到设计器。
  const dialog = await fs.readFile(new URL('../src/components/EmbeddedResourcesDialog.tsx', import.meta.url), 'utf8');
  assert.match(dialog, /selectAndImportEmbeddedResourceFiles/u);
  assert.match(dialog, /enableEmbeddedResourceModule/u);
  assert.match(dialog, /appendEmbeddedResources/u);
  assert.doesNotMatch(dialog, /from 'node:fs/u, '对话框不得直接使用 fs');
  const sidebar = await fs.readFile(new URL('../src/components/Sidebar.tsx', import.meta.url), 'utf8');
  assert.match(sidebar, /内嵌资源/u);
  assert.match(sidebar, /onConfigureEmbeddedResources/u);
  assert.doesNotMatch(sidebar, /requestDesignerNavigation/u, '资源组不再改为跳转设计器');
  const app = await fs.readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.match(app, /workbench\.action\.project\.configureEmbeddedResources/u, '配置入口必须注册为命令');
  assert.match(app, /saveWindowDesignerState/u, '对话框保存必须走设计器状态通道');
});

test('内嵌资源条目右键菜单：菜单贡献走 MenuService，复制/打开动作走 CommandService', async () => {
  const { createCommandService } = await import('../src/services/commands/commandService');
  const { MenuService } = await import('../src/services/menus/menuService');
  const { SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU } = await import('../src/services/menus/types');
  const {
    CONFIGURE_EMBEDDED_RESOURCES_COMMAND,
    COPY_EMBEDDED_RESOURCE_NAME_COMMAND,
    COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND,
    OPEN_EMBEDDED_RESOURCE_SOURCE_COMMAND,
    registerSolutionExplorerMenu
  } = await import('../src/services/solution/solutionExplorerMenu');
  const { isEmbeddedResourceSourceOpenable } = await import('../src/services/windowDesigner/embeddedResourceActions');

  const commands = createCommandService();
  const received: Array<{ commandId: string; payload: unknown }> = [];
  for (const id of [COPY_EMBEDDED_RESOURCE_NAME_COMMAND, COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND, OPEN_EMBEDDED_RESOURCE_SOURCE_COMMAND, CONFIGURE_EMBEDDED_RESOURCES_COMMAND]) {
    commands.registerCommand({ id, title: id, handler: (_context: unknown, payload: unknown) => { received.push({ commandId: id, payload }); return true; } });
  }
  const menus = new MenuService(commands);
  const registration = registerSolutionExplorerMenu(menus);
  try {
    // 文本类素材（.txt/.csv/.md…）才能「打开源文件」；二进制资源只给复制与配置。
    assert.equal(isEmbeddedResourceSourceOpenable('src/resources/说明.txt'), true);
    assert.equal(isEmbeddedResourceSourceOpenable('src/resources/表格/数据.csv'), true);
    assert.equal(isEmbeddedResourceSourceOpenable('src/resources/包.zip'), false);
    assert.equal(isEmbeddedResourceSourceOpenable('src/resources/图片/logo.png'), false);

    const textContext = { 'workspace.open': true, 'embeddedResource.name': '说明.txt', 'embeddedResource.file': 'src/resources/说明.txt', 'embeddedResource.openable': true };
    const textItems = menus.resolveMenu(SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU, textContext, { includeDisabled: true });
    assert.deepEqual(textItems.filter(item => item.kind === 'command').map(item => item.command.id), [
      OPEN_EMBEDDED_RESOURCE_SOURCE_COMMAND,
      COPY_EMBEDDED_RESOURCE_NAME_COMMAND,
      COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND,
      CONFIGURE_EMBEDDED_RESOURCES_COMMAND
    ]);

    const binaryContext = { ...textContext, 'embeddedResource.name': 'resources/包.zip', 'embeddedResource.file': 'src/resources/包.zip', 'embeddedResource.openable': false };
    const binaryItems = menus.resolveMenu(SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU, binaryContext, { includeDisabled: true });
    assert.deepEqual(binaryItems.filter(item => item.kind === 'command').map(item => item.command.id), [
      COPY_EMBEDDED_RESOURCE_NAME_COMMAND,
      COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND,
      CONFIGURE_EMBEDDED_RESOURCES_COMMAND
    ]);

    // 动作必须经 CommandService 执行，并把逻辑名/源文件作为载荷传下去。
    const payload = { name: 'resources/包.zip', file: 'src/resources/包.zip' };
    await commands.executeCommand(COPY_EMBEDDED_RESOURCE_NAME_COMMAND, binaryContext, payload);
    assert.deepEqual(received, [{ commandId: COPY_EMBEDDED_RESOURCE_NAME_COMMAND, payload }]);
  } finally {
    registration.dispose();
  }
  assert.deepEqual(menus.resolveMenu(SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU, { 'workspace.open': true, 'embeddedResource.openable': true }, { includeDisabled: true }), []);
});
