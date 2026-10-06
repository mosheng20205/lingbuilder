import test from 'node:test';
import assert from 'node:assert/strict';

import type { CppFile } from '../src/types';
import {
  applyProjectFileDelete,
  applyProjectFileRename,
  filterProjectSaveableFiles,
  isIdeManagedWorkspacePath,
  isModuleInternalPath,
  isPathInsideProjectScope,
  isProjectSaveableFilePath
} from '../src/services/workspace/projectFileState';

test('project file rename preserves the latest unsaved editor contents and tab selection', () => {
  const source = createFile('src/旧名称.lcpp', '尚未保存的新内容', true);
  const other = createFile('src/其他.lcpp', '其他内容');

  const result = applyProjectFileRename({
    files: [source, other],
    openTabs: [source.path, other.path],
    activeFilePath: source.path
  }, source.path, 'src/新名称.lcpp', 'lingcpp');

  assert.equal(result.files[0].path, 'src/新名称.lcpp');
  assert.equal(result.files[0].translatedContent, '尚未保存的新内容');
  assert.equal(result.files[0].isModified, true);
  assert.deepEqual(result.openTabs, ['src/新名称.lcpp', other.path]);
  assert.equal(result.activeFilePath, 'src/新名称.lcpp');
});

test('project file delete selects the neighboring surviving tab', () => {
  const files = ['a.lcpp', 'b.lcpp', 'c.lcpp'].map(name => createFile(`src/${name}`, name));
  const result = applyProjectFileDelete({
    files,
    openTabs: files.map(file => file.path),
    activeFilePath: files[1].path
  }, files[1].path);

  assert.deepEqual(result.files.map(file => file.path), ['src/a.lcpp', 'src/c.lcpp']);
  assert.deepEqual(result.openTabs, ['src/a.lcpp', 'src/c.lcpp']);
  assert.equal(result.activeFilePath, 'src/c.lcpp');
});

test('project file delete supports an empty state for the future TextModel host', () => {
  const file = createFile('src/only.lcpp', 'only');
  const result = applyProjectFileDelete({
    files: [file],
    openTabs: [file.path],
    activeFilePath: file.path
  }, file.path);

  assert.deepEqual(result.files, []);
  assert.deepEqual(result.openTabs, []);
  assert.equal(result.activeFilePath, null);
});

function createFile(path: string, content: string, isModified = false): CppFile {
  return {
    path,
    name: path.split('/').pop() || path,
    language: 'lingcpp',
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    originalContent: isModified ? '磁盘旧内容' : content,
    translatedContent: content,
    strings: [],
    isModified
  };
}

test('module internal paths (install dir and upgrade staging) are excluded from save payloads', () => {
  assert.equal(isModuleInternalPath('.lingbuilder/modules/lingbuilder.new_emoji.ui/docs/README.md'), true);
  assert.equal(isModuleInternalPath('.lingbuilder/modules/.lingbuilder.new_emoji.ui.next-24200/docs/components/affix.md'), true);
  assert.equal(isModuleInternalPath('.lingbuilder/modules\\lingbuilder.sunnynet\\README.md'), true);
  assert.equal(isModuleInternalPath('.lingbuilder/modules'), true);
  assert.equal(isModuleInternalPath('.lingbuilder/modules-cache/x.txt'), false);
  assert.equal(isModuleInternalPath('.lingbuilder/window-designer.json'), false);
  assert.equal(isModuleInternalPath('src/MainWindow.lcpp'), false);

  const files = [
    { path: 'src/MainWindow.lcpp' },
    { path: '.lingbuilder/modules/.lingbuilder.new_emoji.ui.next-24200/docs/components/affix.md' },
    { path: 'config/config.ini' }
  ];
  const split = filterProjectSaveableFiles(files, { sourceRoot: 'src', configRoot: 'config' });
  assert.deepEqual(split.kept.map(file => file.path), ['src/MainWindow.lcpp', 'config/config.ini']);
  assert.equal(split.dropped, 1);
});

test('pre-build save filter mirrors the server gate (scope, extensions, traversal, modules)', () => {
  const scope = { sourceRoot: 'src', configRoot: 'config/process-proxy-workbench', isDefault: false };
  // 作用域内保留
  assert.equal(isProjectSaveableFilePath('src/MainWindow.lcpp', scope), true);
  assert.equal(isProjectSaveableFilePath('config/process-proxy-workbench/config.ini', scope), true);
  assert.equal(isProjectSaveableFilePath('src\\子目录\\源码.lcpp', scope), true);
  // 作用域外全部剔除（真机 0.8.9 报错来源：独立工作区根的模块清单/说明文档）
  assert.equal(isProjectSaveableFilePath('.lingbuilder/project-modules.json', scope), false);
  assert.equal(isProjectSaveableFilePath('.lingbuilder/window-designer.json', scope), false);
  assert.equal(isProjectSaveableFilePath('README.md', scope), false);
  assert.equal(isProjectSaveableFilePath('bin/进程代理工作台.exe', scope), false);
  assert.equal(isProjectSaveableFilePath('assets/截图-主界面.png', scope), false);
  // 越界与类型
  assert.equal(isProjectSaveableFilePath('src/../../evil.lcpp', scope), false);
  assert.equal(isProjectSaveableFilePath('src/图片.png', scope), false);

  // 默认项目兼容 src/、config/
  const defaultScope = { sourceRoot: 'src', configRoot: 'config', isDefault: true };
  assert.equal(isProjectSaveableFilePath('src/未命名.lcpp', defaultScope), true);
  assert.equal(isProjectSaveableFilePath('config/config.ini', defaultScope), true);
  assert.equal(isProjectSaveableFilePath('docs/说明.md', defaultScope), false);

  // 独立解决方案 sourceRoot='.' 按项目根处理（与 resolveLingCppProjectSources 同语义）：
  // 根下文本文件可保存，模块内部与越界仍拒绝
  const rootScope = { sourceRoot: '.', configRoot: '.', isDefault: false };
  assert.equal(isPathInsideProjectScope('src/MainWindow.lcpp', rootScope), true);
  assert.equal(isPathInsideProjectScope('.lingbuilder/project-modules.json', rootScope), true);
  assert.equal(isProjectSaveableFilePath('src/MainWindow.lcpp', rootScope), true);
  // IDE 管理目录整树退出可保存范围（真机 2026-10-03：configRoot='.' 项目把模块升级快照里
  // 6.6MB 的 lingbuilder.module.json 等整包 POST，HTTP 413 取消 F5）：
  assert.equal(isProjectSaveableFilePath('.lingbuilder/project-modules.json', rootScope), false);
  assert.equal(isProjectSaveableFilePath('.lingbuilder/modules/lingbuilder.new_emoji.ui/README.md', rootScope), false);
  assert.equal(isProjectSaveableFilePath('../outside.lcpp', rootScope), false);
  // 构建源码快照同口径：打开过的模块示例 .lcpp 不得混进 lingCppSources
  //（真机 0.8.11：lingbuilder.demo.mathdll/examples/最小示例.lcpp 触发「项目源码路径不属于当前项目源码目录」）
  assert.equal(isProjectSaveableFilePath('.lingbuilder/modules/lingbuilder.demo.mathdll/examples/最小示例.lcpp', rootScope), false);
  const standaloneSrcScope = { sourceRoot: 'src', configRoot: '.', isDefault: false };
  assert.equal(isProjectSaveableFilePath('src/MainWindow.lcpp', standaloneSrcScope), true);
  assert.equal(isProjectSaveableFilePath('.lingbuilder/modules/lingbuilder.demo.mathdll/examples/最小示例.lcpp', standaloneSrcScope), false);

  // 模块升级自愈快照目录（.lingbuilder/module-snapshots/<id>-<时间戳>）与生成/构建产物：
  // 白名单扩展名命中但属于 IDE 管理目录，进程代理工作台 413 的直接元凶
  const proxyScope = { sourceRoot: 'src', configRoot: '.', isDefault: false };
  assert.equal(isProjectSaveableFilePath('.lingbuilder/module-snapshots/lingbuilder.new_emoji.ui-1791011819447/lingbuilder.module.json', proxyScope), false);
  assert.equal(isProjectSaveableFilePath('.lingbuilder/module-snapshots/lingbuilder.new_emoji.ui-1791011819447/docs/new_emoji-api.json', proxyScope), false);
  assert.equal(isProjectSaveableFilePath('generated/cpp/process-proxy-workbench/main.cpp', proxyScope), false);
  assert.equal(isProjectSaveableFilePath('.lingbuilder-build/incremental-build-cache.json', proxyScope), false);
  assert.equal(isIdeManagedWorkspacePath('.lingbuilder/window-designer.json'), true);
  assert.equal(isIdeManagedWorkspacePath('lingbuilder.demo.textkit/模块.lcpp'), false);

  // 批量过滤带样例路径
  const mixed = [
    { path: 'src/MainWindow.lcpp' },
    { path: '.lingbuilder/project-modules.json' },
    { path: 'README.md' },
    { path: 'src/项目数据类型.lcpp' }
  ];
  const result = filterProjectSaveableFiles(mixed, scope);
  assert.deepEqual(result.kept.map(file => file.path), ['src/MainWindow.lcpp', 'src/项目数据类型.lcpp']);
  assert.equal(result.dropped, 2);
  assert.deepEqual(result.droppedPaths, ['.lingbuilder/project-modules.json', 'README.md']);

  // 排除名单：designerPath 经请求体 project 字段单独保存，绝不能同时出现在 files[]
  //（真机 0.8.10：configRoot="." 时设计器模型文件过作用域，与 project 字段同目标写两次，
  //  服务端持久层"同一文件不能在一次保存中写入多次"整单拒绝）
  const standaloneScope = { sourceRoot: 'src', configRoot: '.', isDefault: false };
  // designerPath 典型位于 .lingbuilder/ 下：IDE 管理目录整树排除后直接落不进 files[]，
  // 模型经请求体 project 字段整份保存；排除名单保留给 designerPath 不在 .lingbuilder/
  // 下的项目（如 designer/<id>.json），继续防同目标双写。
  assert.equal(isProjectSaveableFilePath('.lingbuilder/window-designer.json', standaloneScope), false);
  assert.equal(isProjectSaveableFilePath('designer/window-designer.json', standaloneScope, ['designer/window-designer.json']), false);
  const withDesigner = [
    { path: 'src/MainWindow.lcpp' },
    { path: '.lingbuilder/window-designer.json' }
  ];
  const designerSplit = filterProjectSaveableFiles(withDesigner, standaloneScope, ['.lingbuilder/window-designer.json']);
  assert.deepEqual(designerSplit.kept.map(file => file.path), ['src/MainWindow.lcpp']);
  assert.equal(designerSplit.dropped, 1);
});
