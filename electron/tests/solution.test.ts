import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createSolutionService, DEFAULT_PROJECT_ID, SOLUTION_PROJECT_TEMPLATES } from '../src/services/solution/solutionService';
import { getSolutionProjectDirectory } from '../src/services/solution/solutionClient';
import { normalizeStartupProjects, topologicalProjectOrder } from '../src/services/solution/projectDependencyGraph';

test('solution service creates a default solution for an empty workspace', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);

  const solution = await service.getSolution();

  assert.equal(solution.schemaVersion, 2);
  assert.equal(solution.startupProjectId, DEFAULT_PROJECT_ID);
  assert.equal(solution.projects.length, 1);
  assert.equal(solution.projects[0].id, DEFAULT_PROJECT_ID);
  assert.equal(solution.name, '未命名解决方案');
  assert.equal(solution.projects[0].name, '新建项目');
  assert.equal(solution.projects[0].sourceRoot, 'src');
  assert.ok(await exists(path.join(root, '.lingbuilder', 'solution.json')));
  assert.ok(await exists(path.join(root, 'src', 'MainWindow.lcpp')));
  const entryPath = path.join(root, '未命名解决方案.lbsln');
  assert.ok(await exists(entryPath));
  const entry = JSON.parse(await fs.readFile(entryPath, 'utf8'));
  assert.equal(entry.kind, 'lingbuilder-solution');
  assert.equal(entry.solutionFile, '.lingbuilder/solution.json');
  assert.deepEqual(entry.startupProjectIds, [DEFAULT_PROJECT_ID]);
  assert.deepEqual(solution.folders, []);
});

test('solution project directory resolves visual and external project locations', () => {
  assert.equal(getSolutionProjectDirectory({
    id: 'ui', name: 'UI', type: 'visual-cpp', sourceRoot: 'src/ui', configRoot: 'config/ui', designerPath: '.lingbuilder/projects/ui/window-designer.json'
  }), 'src/ui');
  assert.equal(getSolutionProjectDirectory({
    id: 'native', name: 'Native', type: 'external-msbuild', sourceRoot: '.', configRoot: '.', designerPath: '', projectFile: 'native/app.vcxproj'
  }), 'native');
});

test('solution references persist, dependencies build first, cycles are rejected, and delete prunes references', async () => {
  const root = await createTempWorkspace(); const service = createSolutionService(root);
  await service.createProject({ name: 'Core', projectId: 'core' });
  await service.createProject({ name: 'App', projectId: 'app' });
  let solution = await service.updateProject('app', { references: ['core'] });
  assert.deepEqual(service.getBuildOrder(solution, ['app']).map(project => project.id), ['core', 'app']);
  let entry = JSON.parse(await fs.readFile(path.join(root, '未命名解决方案.lbsln'), 'utf8'));
  assert.deepEqual(entry.projects.find((project: { id: string }) => project.id === 'app').references, ['core']);
  await assert.rejects(service.updateProject('core', { references: ['app'] }), /循环/u);
  solution = (await service.deleteProject('core', { deleteFiles: false })).solution;
  assert.deepEqual(solution.projects.find(project => project.id === 'app')?.references, []);
  entry = JSON.parse(await fs.readFile(path.join(root, '未命名解决方案.lbsln'), 'utf8'));
  assert.equal(entry.projects.some((project: { id: string }) => project.id === 'core'), false);
});

test('solution migrates v1 startup state and supports multiple startup projects', async () => {
  const root = await createTempWorkspace();
  await fs.mkdir(path.join(root, '.lingbuilder'), { recursive: true });
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), JSON.stringify({
    schemaVersion: 1, id: 'old', name: 'old', startupProjectId: 'a', projects: [
      { id: 'a', name: 'A', type: 'visual-cpp', sourceRoot: 'src/a', configRoot: 'config/a', designerPath: '.lingbuilder/a.json' },
      { id: 'b', name: 'B', type: 'visual-cpp', sourceRoot: 'src/b', configRoot: 'config/b', designerPath: '.lingbuilder/b.json' }
    ]
  }));
  const service = createSolutionService(root);
  const migratedSolutions = await Promise.all([
    service.getSolution(),
    createSolutionService(root).getSolution(),
    createSolutionService(root).getSolution()
  ]);
  let solution = migratedSolutions[0];
  assert.ok(migratedSolutions.every(item => item.schemaVersion === 2));
  assert.deepEqual(solution.startupProjectIds, ['a']);
  assert.equal(JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'solution.json'), 'utf8')).schemaVersion, 2);
  solution = await service.updateProject('a', { startupProjectIds: ['a', 'b'] });
  assert.deepEqual(solution.startupProjectIds, ['a', 'b']);
  assert.deepEqual(normalizeStartupProjects(solution.projects, ['missing', 'b', 'b'], 'a'), ['b']);
});

test('dependency graph includes transitive dependencies once and gives actionable cycle paths', () => {
  const projects = [{ id: 'ui', references: ['service', 'common'] }, { id: 'service', references: ['common'] }, { id: 'common', references: [] }];
  assert.deepEqual(topologicalProjectOrder(projects, ['ui']), ['common', 'service', 'ui']);
  assert.throws(() => topologicalProjectOrder([{ id: 'a', references: ['b'] }, { id: 'b', references: ['a'] }]), /a -> b -> a/u);
});

test('solution imports external project metadata and persists property updates', async () => {
  const root = await createTempWorkspace(); await fs.mkdir(path.join(root, 'native'), { recursive: true });
  await fs.writeFile(path.join(root, 'native', 'CMakeLists.txt'), 'project(NativeTool)');
  const service = createSolutionService(root);
  const imported = await service.importExternalProject('native/CMakeLists.txt');
  assert.equal(imported.project.type, 'external-cmake');
  const solution = await service.updateProject(imported.project.id, { buildProperties: { configuration: 'Release', architecture: 'x64', additionalArguments: ['-DENABLE_TEST=ON'] } });
  assert.equal(solution.projects.find(project => project.id === imported.project.id)?.buildProperties?.architecture, 'x64');
  await assert.rejects(service.updateProject(imported.project.id, { buildProperties: { configuration: 'Debug', architecture: 'x64', additionalArguments: ['bad\narg'] } }), /参数无效/u);
});

test('solution service creates project files and designer model', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);

  const result = await service.createProject({ name: '测试项目', projectId: 'demo-app' });

  assert.equal(result.project.id, 'demo-app');
  assert.equal(result.solution.projects.length, 2);
  assert.ok(await exists(path.join(root, 'src', 'demo-app', 'MainWindow.lcpp')));
  assert.ok(await exists(path.join(root, 'config', 'demo-app', 'config.ini')));
  assert.ok(await exists(path.join(root, '.lingbuilder', 'projects', 'demo-app', 'window-designer.json')));
});

test('solution project templates produce deterministic designer and source files without a preview write', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  const preview = await service.previewCreateProject({ name: '问候项目', projectId: 'hello-app', templateId: 'hello-window', windowTitle: '问候窗口' });

  assert.equal(preview.project.id, 'hello-app');
  assert.equal(preview.designerProject.windows[0].title, '问候窗口');
  assert.equal(preview.designerProject.windows[0].controls[1].events?.Click, '_问候按钮_被单击');
  assert.match(preview.files.find(file => file.relativePath.endsWith('.lcpp'))?.content || '', /你好，LingBuilder/u);
  assert.equal(await exists(path.join(root, 'src', 'hello-app')), false);

  const created = await service.createProject({ name: '问候项目', projectId: 'hello-app', templateId: 'hello-window', windowTitle: '问候窗口' });
  const designer = JSON.parse(await fs.readFile(path.join(root, created.project.designerPath), 'utf8'));
  assert.equal(designer.windows[0].controls.length, 2);
  assert.match(await fs.readFile(path.join(root, 'src', 'hello-app', 'MainWindow.lcpp'), 'utf8'), /信息框/u);
});

test('new_emoji FBro browser shell template previews x64 frame, controls, handlers and shortcuts without writing', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  const preview = await service.previewCreateProject({
    name: '浏览器外壳',
    projectId: 'browser-shell',
    templateId: 'new-emoji-fbro-browser-shell'
  });
  const window = preview.designerProject.windows[0];
  const source = preview.files.find(file => file.relativePath.endsWith('.lcpp'))?.content || '';
  const template = SOLUTION_PROJECT_TEMPLATES.find(item => item.id === 'new-emoji-fbro-browser-shell');

  assert.equal(preview.project.buildProperties?.architecture, 'x64');
  assert.equal(window.width, 1180);
  assert.equal(window.height, 760);
  assert.equal(window.designerBackend, 'new-emoji');
  assert.deepEqual(window.windowFrame, {
    preset: 'browserShell',
    flags: 0x3f,
    resizeBorder: { left: 6, top: 6, right: 6, bottom: 6 },
    cornerRadius: 10
  });
  assert.deepEqual(template?.moduleIds, [
    'lingbuilder.win32.basic',
    'lingbuilder.new_emoji.ui',
    'lingbuilder.fbro.browser',
    'lingbuilder.fbro.sdk',
    'lingbuilder.new_emoji.fbro-shell'
  ]);
  for (const type of ['Container', 'Panel', 'Tabs', 'Omnibox', 'IconButton', 'Menu', 'Popover', 'BrowserViewport']) {
    assert.ok(window.controls.some(control => control.designerType === `lingbuilder.new_emoji.ui/${type}`), `模板缺少 ${type}`);
  }
  assert.equal(window.controls.length, 24);
  assert.equal(window.controls.filter(control => control.designerType === 'lingbuilder.new_emoji.ui/Menu').length, 6);
  assert.equal(window.controls.filter(control => control.designerType === 'lingbuilder.new_emoji.ui/Popover').length, 2);
  assert.equal(window.controls.find(control => control.id === 'browser-root')?.properties?.flowEnabled, false);
  const tabs = window.controls.find(control => control.id === 'browser-tabs');
  assert.equal(tabs?.properties?.addable, false);
  assert.equal(tabs?.properties?.chromeMode, true);
  assert.equal(tabs?.properties?.chromeMinWidth, 96);
  assert.equal(tabs?.properties?.chromeMaxWidth, 220);
  assert.equal(tabs?.width, 220);
  const omnibox = window.controls.find(control => control.id === 'browser-omnibox');
  assert.equal(omnibox?.properties?.value, 'https://www.baidu.com');
  const omniboxMenu = window.controls.find(control => control.id === 'omnibox-menu');
  const viewportMenu = window.controls.find(control => control.id === 'viewport-menu');
  assert.equal(omniboxMenu?.properties?.anchorElementId, 'browser-omnibox');
  assert.equal(omniboxMenu?.properties?.popupTrigger, 'right_click');
  assert.equal(viewportMenu?.properties?.anchorElementId, 'browser-viewport');
  assert.equal(viewportMenu?.properties?.popupTrigger, 'right_click');
  assert.match(source, /浏览器外壳_创建\(浏览器标签页, 浏览器页面占位, &浏览器状态改变\)/u);
  assert.match(source, /浏览器外壳_新建标签页\("home", "https:\/\/www\.baidu\.com", "新标签页"\)/u);
  assert.doesNotMatch(source, /https?:\/\/(?:127\.0\.0\.1|localhost)/iu);
  assert.match(source, /浏览器外壳_取标签页数量\(\)/u);
  assert.match(source, /局部 整数型 标签控件宽度 = 0/u);
  assert.match(source, /标签区宽度 = 窗口宽度 - 300/u);
  assert.match(source, /标签控件宽度 = 标签数量 \* 标签宽度/u);
  assert.match(source, /控件_设置位置大小\(浏览器标签页, 16, 4, 标签控件宽度, 34\)/u);
  assert.match(source, /控件_设置位置大小\(新建标签按钮, 新建标签横坐标, 5, 30, 30\)/u);
  assert.match(source, /事件 _网页菜单_命令\(整数型 项目索引，文本型 菜单路径，文本型 命令\)/u);
  assert.match(source, /事件 浏览器状态改变\(整数型 标签索引，文本型 地址，文本型 标题，逻辑型 加载中\)/u);
  assert.match(source, /Ctrl键按下 并且 键码 == 76/u);
  assert.match(source, /Ctrl键按下 并且 键码 == 84/u);
  assert.match(source, /Alt键按下 并且 键码 == 37/u);
  assert.equal(await exists(path.join(root, 'src', 'browser-shell')), false);
});

test('solution folders persist logical project grouping without moving project files', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.getSolution();
  const createdProject = await service.createProject({ name: '工具项目', projectId: 'tools' });
  const createdFolder = await service.createFolder({ name: '工具集合' });

  const grouped = await service.updateProject(createdProject.project.id, { solutionFolderId: createdFolder.folder.id });

  assert.equal(grouped.projects.find(project => project.id === 'tools')?.solutionFolderId, createdFolder.folder.id);
  assert.ok(await exists(path.join(root, 'src', 'tools', 'MainWindow.lcpp')));
  const persisted = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'solution.json'), 'utf8'));
  assert.equal(persisted.folders[0].name, '工具集合');
  assert.equal(persisted.projects.find((project: { id: string }) => project.id === 'tools').solutionFolderId, createdFolder.folder.id);
  const entry = JSON.parse(await fs.readFile(path.join(root, '未命名解决方案.lbsln'), 'utf8'));
  assert.equal(entry.folders[0].name, '工具集合');
  assert.equal(entry.projects.find((project: { id: string }) => project.id === 'tools').solutionFolderId, createdFolder.folder.id);

  const returnedToRoot = await service.updateProject('tools', { solutionFolderId: null });
  assert.equal(returnedToRoot.projects.find(project => project.id === 'tools')?.solutionFolderId, undefined);
  await assert.rejects(service.updateProject('tools', { solutionFolderId: 'missing-folder' }), /未找到解决方案文件夹/u);
});

test('project rename persists the display name while preserving identity and disk paths', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.getSolution();
  await service.createProject({ name: '另一个项目', projectId: 'other' });

  const renamed = await service.updateProject(DEFAULT_PROJECT_ID, { name: '中文工具项目' });
  const project = renamed.projects.find(item => item.id === DEFAULT_PROJECT_ID);

  assert.equal(project?.name, '中文工具项目');
  assert.equal(project?.id, DEFAULT_PROJECT_ID);
  assert.equal(project?.sourceRoot, 'src');
  assert.ok(await exists(path.join(root, 'src', 'MainWindow.lcpp')));
  const persisted = JSON.parse(await fs.readFile(path.join(root, '.lingbuilder', 'solution.json'), 'utf8'));
  assert.equal(persisted.projects.find((item: { id: string }) => item.id === DEFAULT_PROJECT_ID).name, '中文工具项目');
  const entry = JSON.parse(await fs.readFile(path.join(root, '未命名解决方案.lbsln'), 'utf8'));
  assert.equal(entry.projects.find((item: { id: string }) => item.id === DEFAULT_PROJECT_ID).name, '中文工具项目');
  await assert.rejects(service.updateProject(DEFAULT_PROJECT_ID, { name: '   ' }), /不能为空/u);
  await assert.rejects(service.updateProject(DEFAULT_PROJECT_ID, { name: '另一个项目' }), /已存在/u);
});

test('solution service removes references or files while preserving last project', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.createProject({ name: '删除演示', projectId: 'delete-demo' });

  const removedReference = await service.deleteProject('delete-demo', { deleteFiles: false });
  assert.equal(removedReference.solution.projects.some(project => project.id === 'delete-demo'), false);
  assert.ok(await exists(path.join(root, 'src', 'delete-demo', 'MainWindow.lcpp')));

  await service.createProject({ name: '删除文件演示', projectId: 'delete-files-demo' });
  const removedFiles = await service.deleteProject('delete-files-demo', { deleteFiles: true });
  assert.equal(removedFiles.solution.projects.some(project => project.id === 'delete-files-demo'), false);
  assert.equal(await exists(path.join(root, 'src', 'delete-files-demo')), false);

  await assert.rejects(
    () => service.deleteProject(DEFAULT_PROJECT_ID, { deleteFiles: false }),
    /至少需要保留一个项目/
  );
});

test('solution clean removes build outputs and preserves generated exports', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.createProject({ name: '清理演示', projectId: 'clean-demo' });
  const buildDir = path.join(root, '.lingbuilder-build', 'clean-demo');
  const exportDir = path.join(root, 'generated', 'cpp', 'clean-demo');
  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(path.join(buildDir, 'temp.obj'), 'obj', 'utf8');
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, 'clean-demo.sln'), 'sln', 'utf8');

  const result = await service.cleanProjects(['clean-demo']);

  assert.equal(result.ok, true);
  assert.equal(await exists(buildDir), false);
  assert.ok(await exists(path.join(exportDir, 'clean-demo.sln')));
});

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-solution-'));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
