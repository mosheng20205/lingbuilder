import assert from 'node:assert/strict';
import test from 'node:test';
import './dataGrid.test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ListViewDesignerPreview from '../src/components/ListViewDesignerPreview';
import HeaderDesignerPreview from '../src/components/HeaderDesignerPreview';
import TabControlDesignerPreview from '../src/components/TabControlDesignerPreview';
import ListViewCollectionDialog from '../src/components/ListViewCollectionDialog';
import ToolbarButtonsDialog from '../src/components/ToolbarButtonsDialog';
import StatusBarPartsDialog from '../src/components/StatusBarPartsDialog';
import TabControlPagesDialog from '../src/components/TabControlPagesDialog';
import MenuBarItemsDialog from '../src/components/MenuBarItemsDialog';
import TreeViewCollectionDialog from '../src/components/TreeViewCollectionDialog';
import NewEmojiDesignerControlPreview, { toNewEmojiCssColor } from '../src/components/NewEmojiDesignerControlPreview';
import {
  CREATABLE_DESIGNER_CONTROL_TYPES,
  StatusBarDesignerPreview,
  TrackBarDesignerPreview,
  hasDedicatedControlPreview,
  parseStringListPropertyText
} from '../src/components/WpfDesigner';
import {
  buildControlHierarchy,
  canReparentControls,
  canReparentControl,
  getEffectiveControlState,
  getControlDescendantIds,
  normalizeControlHierarchy,
  orderControlsForDesignerPainting,
  reparentControl,
  reparentControls
} from '../src/services/windowDesigner/controlHierarchy';
import {
  createBlankWindow,
  getDesignerWindowContentOffset,
  getEventsForType,
  getPrimaryDesignerEventBinding,
  getPrimaryEventNameForType,
  getLingWindowSourceFilePath,
  getWindowDesignerAutosaveKey,
  generateWindowXml,
  hasDesignerWindowMenu,
  normalizeWindowDesignerState,
  readWindowDesignerState,
  saveWindowDesignerState
} from '../src/services/windowDesigner/windowDesignerService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { generateNativeWin32Project } from '../src/services/windowDesigner/nativeWin32Project';
import { writeGeneratedProjectFiles } from '../src/services/windowDesigner/generatedProjectFileService';
import { LingControl, LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';
import { WIN32_CONTROL_DEFINITIONS, createDefaultControlProperties, getCreatableWin32ControlDefinitions, getWin32ControlsForModule } from '../src/services/windowDesigner/win32ControlRegistry';
import { captureDesignerHotKey } from '../src/services/windowDesigner/hotKeyProperty';
import { findControlTagConflict, normalizeControlTagInteger, normalizeControlTagText, normalizeWindowControlTags } from '../src/services/windowDesigner/controlTagService';
import {
  createControlToolboxGroups,
  getControlToolboxModuleDisabledMessage,
  readControlToolboxExpansionState,
  saveControlToolboxExpansionState
} from '../src/services/windowDesigner/controlToolboxModel';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { LIST_VIEW_ADVANCED_API } from '../src/services/modules/listViewApiCatalog';
import { EDGEVIEW_BROWSER_EVENTS } from '../src/services/modules/edgeViewBrowserEvents';
import type { InstalledModule } from '../src/services/modules/types';
import { getWindowEventHandlerName, WINDOW_EVENT_CATEGORIES, WINDOW_EVENT_DEFINITIONS } from '../src/services/windowDesigner/windowEventRegistry';
import { upgradeLegacyWindowEventHandlerSignature } from '../src/services/windowDesigner/windowEventHandlerMigration';
import {
  formatModuleDesignerEventParameters,
  upgradeLegacyModuleDesignerEventHandlerSignature
} from '../src/services/modules/moduleDesignerEventService';
import {
  getNewEmojiThemePreview,
  getNewEmojiUnsupportedControlDiagnostics,
  isNewEmojiTextInputControl
} from '../src/services/windowDesigner/newEmojiDesignerAdapter';
import {
  collectLingCppCommandCalls,
  getNativeUiBackendCommandContract,
  getUiBackendCommandDiagnostics,
  listNativeUiBackendCommandContracts,
  NEW_EMOJI_UI_BACKEND_ID,
  NEW_EMOJI_WIN32_BASIC_COMMANDS,
  NEW_EMOJI_WIN32_MENU_COMMANDS,
  registerNativeUiBackendCommandContract
} from '../src/services/windowDesigner/uiBackendCommandContract';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { createListViewPreviewModel } from '../src/services/windowDesigner/listViewPreviewModel';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { createSolutionService } from '../src/services/solution/solutionService';
import {
  createWindowsExecutableIconService,
  WINDOWS_EXECUTABLE_ICON_FILE,
  WINDOWS_EXECUTABLE_RESOURCE_FILE
} from '../src/services/windowDesigner/windowsExecutableIconService';
import { fetchDesignerImagePreviewBlob, getDesignerImagePreviewSource } from '../src/services/windowDesigner/designerAssetClient';
import {
  appendListViewColumn,
  applyListViewCellMatrix,
  moveListViewColumn,
  normalizeListViewColumns,
  normalizeListViewRows,
  parseListViewTabularText,
  removeListViewColumn,
  replaceListViewRowsFromMatrix
} from '../src/services/windowDesigner/listViewCollectionModel';
import {
  appendToolbarButton,
  duplicateToolbarButton,
  moveToolbarButton,
  normalizeToolbarButtons,
  removeToolbarButton
} from '../src/services/windowDesigner/toolbarButtonCollectionModel';
import {
  appendStatusBarPart,
  duplicateStatusBarPart,
  moveStatusBarPart,
  normalizeStatusBarParts,
  removeStatusBarPart
} from '../src/services/windowDesigner/statusBarPartCollectionModel';
import {
  appendTabControlPage,
  duplicateTabControlPage,
  getControlTabSlot,
  getTabContainerContentOffset,
  getSelectedTabPage,
  getTabControlPages,
  isControlOnSelectedTab,
  isNewEmojiTabsControl,
  isTabControlHeaderHidden,
  isTabContainerControl,
  moveTabControlPage,
  normalizeTabControlPages,
  removeTabControlPage
} from '../src/services/windowDesigner/tabControlModel';
import {
  appendTreeViewNode,
  deleteTreeViewNode,
  duplicateTreeViewNode,
  flattenTreeViewNodes,
  moveTreeViewNode,
  normalizeTreeViewNodes,
  reparentTreeViewNode,
  updateTreeViewNode
} from '../src/services/windowDesigner/treeViewCollectionModel';
import { CONTROL_FONT_FAMILY_OPTIONS, DEFAULT_CONTROL_FONT_FAMILY, getControlFontCssStyle } from '../src/services/windowDesigner/controlFont';
import {
  parseMenuBarItems,
  serializeMenuBarItems,
  validateMenuBarItems
} from '../src/services/windowDesigner/menuBarItemsModel';

test('窗口源码路径跟随当前解决方案项目源码根目录', () => {
  assert.equal(
    getLingWindowSourceFilePath('src/datagrid-api-demo', 'Window2.xml', '自定义窗体2'),
    'src/datagrid-api-demo/自定义窗体2.lcpp'
  );
  assert.equal(
    getLingWindowSourceFilePath('examples\\demo\\src\\', 'Window3.xml', '自定义窗体3'),
    'examples/demo/src/自定义窗体3.lcpp'
  );
  assert.equal(getLingWindowSourceFilePath('.', '工具窗口.xml'), '工具窗口.lcpp');
});

test('工具栏按钮集合模型支持规范化、新增、复制、排序和删除', () => {
  const normalized = normalizeToolbarButtons([
    { id: 8, title: '保存', image: -1, style: 'button' },
    { id: '9', title: '选项', image: 2, style: 'dropdown' },
    { id: 10, title: '', image: -1, style: 'unknown' }
  ]);
  assert.deepEqual(normalized.map(button => [button.id, button.title, button.image, button.style]), [
    [8, '保存', -1, 'button'],
    [9, '选项', 2, 'dropdown'],
    [10, '', -1, 'button']
  ]);
  const appended = appendToolbarButton(normalized);
  assert.equal(appended.at(-1)?.id, 1);
  const duplicated = duplicateToolbarButton(appended, 0);
  assert.equal(duplicated[1].title, '保存 副本');
  assert.equal(new Set(duplicated.map(button => button.id)).size, duplicated.length);
  assert.equal(moveToolbarButton(duplicated, 1, 0)[0].title, '保存 副本');
  assert.equal(removeToolbarButton(duplicated, 1).length, duplicated.length - 1);
});

test('工具栏按钮弹窗显示完整字段、操作和窄屏布局', () => {
  const markup = renderToStaticMarkup(React.createElement(ToolbarButtonsDialog, {
    controlName: '主工具栏',
    value: [{ id: 1, title: '新建', image: -1, style: 'button' }],
    hasImageList: true,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(markup, /编辑工具栏按钮/u);
  assert.match(markup, /新增按钮/u);
  assert.match(markup, /命令 ID/u);
  assert.match(markup, /图片编号/u);
  assert.match(markup, /普通按钮/u);
  assert.match(markup, /复制第 1 个工具栏按钮/u);
  assert.match(markup, /md:hidden/u);
  assert.match(markup, /工具栏_最后命令\(\)/u);
});

test('状态栏分区集合模型支持规范化、新增、复制、排序和删除', () => {
  const normalized = normalizeStatusBarParts([
    { title: '就绪', width: 120 },
    { label: '行 1，列 1', width: '180' }
  ]);
  assert.deepEqual(normalized, [
    { title: '就绪', width: 120 },
    { title: '行 1，列 1', width: 180 }
  ]);
  assert.deepEqual(normalizeStatusBarParts(['UTF-8']), [{ title: 'UTF-8', width: 120 }]);
  const appended = appendStatusBarPart(normalized);
  assert.equal(appended.at(-1)?.title, '分区 3');
  const duplicated = duplicateStatusBarPart(appended, 0);
  assert.equal(duplicated[1].title, '就绪 副本');
  assert.equal(moveStatusBarPart(duplicated, 1, 0)[0].title, '就绪 副本');
  assert.equal(removeStatusBarPart(duplicated, 1).length, duplicated.length - 1);
});

test('滑块和状态栏使用贴近 Win32 运行时的专用设计器预览', () => {
  const trackBar = {
    ...createControl('track-preview', undefined, 'TrackBar'),
    properties: { minimum: 0, maximum: 100, value: 50, tickFrequency: 10 }
  };
  const trackMarkup = renderToStaticMarkup(React.createElement(TrackBarDesignerPreview, { control: trackBar, isEnabled: true }));
  assert.equal(hasDedicatedControlPreview('TrackBar'), true);
  assert.match(trackMarkup, /滑块预览，当前值 50/u);
  assert.equal((trackMarkup.match(/top-\[58%\]/gu) || []).length, 11, '0 到 100、间隔 10 应显示 11 个刻度');
  assert.match(trackMarkup, /\* 0\.5/u, '滑块位置应由当前值映射到轨道中点');

  const statusBar = {
    ...createControl('status-preview', undefined, 'StatusBar'),
    foreground: '#FFFFFF',
    properties: {
      textAlign: 'center',
      parts: [{ title: '状态111', width: 120 }, { title: '状态222', width: 120 }, { title: '状态333', width: 120 }]
    }
  };
  const statusMarkup = renderToStaticMarkup(React.createElement(StatusBarDesignerPreview, { control: statusBar, isEnabled: true }));
  assert.match(statusMarkup, /状态栏预览，共 3 个分区/u);
  assert.match(statusMarkup, /flex-basis:120px/u);
  assert.match(statusMarkup, /flex-basis:0/u, 'Win32 的最后一个状态栏分区使用 -1，应填满剩余宽度而不是保留固定宽度');
  assert.match(statusMarkup, /rgba\(255, 255, 255, 0\.22\)/u, '设计器分隔线应与原生 owner-draw 的前景色混合规则一致');
});

test('状态栏分区弹窗显示完整字段、操作和窄屏布局', () => {
  const markup = renderToStaticMarkup(React.createElement(StatusBarPartsDialog, {
    controlName: '主状态栏',
    value: [{ title: '就绪', width: 120 }],
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(markup, /编辑状态栏分区/u);
  assert.match(markup, /新增分区/u);
  assert.match(markup, /文字/u);
  assert.match(markup, /宽度/u);
  assert.match(markup, /复制第 1 个状态栏分区/u);
  assert.match(markup, /md:hidden/u);
});

test('选项卡标签页集合模型支持规范化、新增、复制、排序和安全删除', () => {
  const normalized = normalizeTabControlPages([
    { id: 'general', title: '常规', image: -1 },
    { id: 'advanced', label: '高级', image: '2' }
  ]);
  assert.deepEqual(normalized, [
    { id: 'general', title: '常规', image: -1, icon: '', closable: true, disabled: false, pinned: false, loading: false, muted: false, alerting: false },
    { id: 'advanced', title: '高级', image: 2, icon: '', closable: true, disabled: false, pinned: false, loading: false, muted: false, alerting: false }
  ]);
  const appended = appendTabControlPage(normalized);
  assert.equal(appended.at(-1)?.id, 'page1');
  const duplicated = duplicateTabControlPage(appended, 0);
  assert.equal(duplicated[1].title, '常规 副本');
  assert.equal(new Set(duplicated.map(page => page.id)).size, duplicated.length);
  assert.equal(moveTabControlPage(duplicated, 1, 0)[0].title, '常规 副本');
  assert.equal(removeTabControlPage(duplicated, 1).length, duplicated.length - 1);
  assert.equal(removeTabControlPage([normalized[0]], 0).length, 1);
});

test('选项卡标签页弹窗显示完整字段、操作和窄屏布局', () => {
  const markup = renderToStaticMarkup(React.createElement(TabControlPagesDialog, {
    controlName: '主选项卡',
    value: [{ id: 'general', title: '常规', image: -1 }],
    hasImageList: true,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(markup, /编辑标签页/u);
  assert.match(markup, /新增标签页/u);
  assert.match(markup, /页面 ID/u);
  assert.match(markup, /图片编号/u);
  assert.match(markup, /复制第 1 个标签页/u);
  assert.match(markup, /md:hidden/u);
  assert.match(markup, /至少保留一个标签页/u);
  assert.match(markup, /aria-label="删除第 1 个标签页"[^>]*disabled/u);
});

test('窗口菜单栏集合模型兼容旧的逗号存储格式', () => {
  const items = parseMenuBarItems(' 文件, 编辑,  帮助 ');
  assert.deepEqual(items, ['文件', '编辑', '帮助']);
  assert.equal(serializeMenuBarItems(items), '文件, 编辑, 帮助');
  assert.equal(validateMenuBarItems(items), null);
  assert.match(validateMenuBarItems(['文件,导入']) || '', /英文逗号/u);
});

test('窗口菜单栏只保留旧项目兼容，不再提供新增入口', () => {
  assert.equal(CREATABLE_DESIGNER_CONTROL_TYPES.map(String).includes('MenuBar'), false);
  assert.ok(CREATABLE_DESIGNER_CONTROL_TYPES.includes('ToolBar'));
});

test('控件工具箱按注册模块分为基础、高级、浏览器和 New_Emoji', () => {
  const normalGroups = createControlToolboxGroups(CREATABLE_DESIGNER_CONTROL_TYPES, false);
  assert.deepEqual(normalGroups.map(group => group.id), ['basic', 'advanced', 'browser', 'new-emoji']);
  assert.ok(normalGroups.find(group => group.id === 'basic')?.controlTypes.includes('Button'));
  assert.ok(normalGroups.find(group => group.id === 'advanced')?.controlTypes.includes('ListView'));
  assert.ok(normalGroups.find(group => group.id === 'browser')?.controlTypes.includes('EdgeBrowser'));
  assert.ok(normalGroups.find(group => group.id === 'browser')?.controlTypes.includes('CefBrowser'));
  assert.deepEqual(normalGroups.find(group => group.id === 'new-emoji')?.controlTypes, []);

  const newEmojiGroups = createControlToolboxGroups(CREATABLE_DESIGNER_CONTROL_TYPES, true);
  assert.ok(newEmojiGroups.find(group => group.id === 'new-emoji')?.controlTypes.includes('Button'));
  assert.ok(!newEmojiGroups.find(group => group.id === 'basic')?.controlTypes.includes('Button'));
  assert.ok(newEmojiGroups.find(group => group.id === 'basic')?.controlTypes.includes('ComboBox'));
});

test('控件工具箱的未启用提示使用中文分组名而非内部模块 ID', () => {
  assert.equal(
    getControlToolboxModuleDisabledMessage('lingbuilder.win32.common-controls'),
    '需要启用高级控件模块'
  );
  assert.equal(
    getControlToolboxModuleDisabledMessage('unknown.module'),
    '当前项目未启用此控件所需模块'
  );
});

test('控件工具箱展开状态按项目保存并安全回退默认值', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); }
  };
  const initial = readControlToolboxExpansionState('project-a', storage);
  assert.equal(initial.basic, true);
  assert.equal(initial.advanced, false);
  saveControlToolboxExpansionState('project-a', { ...initial, advanced: true }, storage);
  assert.equal(readControlToolboxExpansionState('project-a', storage).advanced, true);
  assert.equal(readControlToolboxExpansionState('project-b', storage).advanced, false);
});

test('窗口菜单栏属性使用独立集合编辑弹窗', () => {
  const markup = renderToStaticMarkup(React.createElement(MenuBarItemsDialog, {
    controlName: '窗口菜单栏',
    value: '文件, 编辑, 帮助',
    isDarkMode: true,
    onSave: () => undefined,
    onClose: () => undefined
  }));
  assert.match(markup, /编辑菜单项/u);
  assert.match(markup, /3 个菜单项/u);
  assert.match(markup, /保存修改/u);
});

test('调试输出支持英文逗号分隔的任意数量异构参数', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'variadic-debug-output',
    name: '多参数调试输出',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', controls: [] }]
  };
  const source = `类 主窗口
    事件 创建完毕()
        调试输出("当前选择项", 控件_取选择项("列表框_tab"), 真, 3)
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /调试输出\(L"当前选择项", 控件_取选择项\(L"列表框_tab"\), true, 3\);/u);
  assert.match(cpp, /template <typename\.\.\. Args> void 调试输出\(const Args&\.\.\. args\)/u);
  assert.match(cpp, /if \(!first\) output \+= L", ";/u);
});

test('空窗口使用与 ControlSpec 同步的类型安全占位项', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'empty-window-control-spec',
    name: '空窗口占位测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: []
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口\n结束类\n'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  const placeholder = cpp.split('\n').find(line => line.includes('{ 0, 0, L"Label", L"", L""')) || '';

  assert.match(placeholder, /12, L"Microsoft YaHei UI", false, false, false/u);
  assert.doesNotMatch(placeholder, /12, 0, 0, RGB/u);
  assert.match(cpp, /g_controls_0, 0,/u);
});

test('F5 生成文件落盘会创建嵌套的 LCPP 源码目录', async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-generated-files-'));
  try {
    const relativePath = 'lcpp-sources/src/cef3-2/MainWindow.lcpp';
    await writeGeneratedProjectFiles(outputRoot, [{ relativePath, content: '类 主窗口\n结束类\n' }]);
    assert.equal(await fs.readFile(path.join(outputRoot, relativePath), 'utf8'), '类 主窗口\n结束类\n');
    await assert.rejects(
      writeGeneratedProjectFiles(outputRoot, [{ relativePath: '../outside.lcpp', content: '' }]),
      /生成文件路径不安全/u
    );
  } finally {
    await fs.rm(outputRoot, { recursive: true, force: true });
  }
});

test('普通空窗口不会尝试初始化未使用的 CEF3 运行时', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'empty-window-no-cef-log',
    name: '空窗口 CEF 日志测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: []
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口\n结束类\n'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  const createFunction = cpp.slice(cpp.indexOf('int CEF3_创建(const wchar_t* controlName)'), cpp.indexOf('int CEF3_创建单个'));

  assert.ok(createFunction.indexOf('if (!hasTarget) return 0;') < createFunction.indexOf('#if LINGBUILDER_CEF3_AVAILABLE'));
  assert.match(createFunction, /IsType\(control, L"CefBrowser"\)/u);
});

test('普通 Win32 运行窗口只执行一次标准显示且不切换置顶或延迟抢焦点', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'stable-window-activation',
    name: '窗口启动稳定性测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: []
    }]
  };
  const lingCpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口\n结束类\n'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  const openWindow = lingCpp.slice(lingCpp.indexOf('HWND Open('), lingCpp.indexOf('void AttachPropertyPage'));
  const legacyCpp = generateNativeWin32Project(project).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(openWindow, /SetWindowPos\(hwnd_, nullptr,[\s\S]*ShowWindow\(hwnd_, showCommand\);\s*UpdateWindow\(hwnd_\);/u);
  assert.doesNotMatch(openWindow, /HWND_(?:TOPMOST|NOTOPMOST)|SetForegroundWindow|BringWindowToTop|SetFocus|SetTimer/u);
  assert.doesNotMatch(lingCpp, /0x4C42/u);
  assert.match(legacyCpp, /ShowWindow\(hwnd, showCommand\);\s*UpdateWindow\(hwnd\);\s*return hwnd;/u);
  assert.doesNotMatch(legacyCpp, /HWND_(?:TOPMOST|NOTOPMOST)|SetForegroundWindow\(hwnd\)|BringWindowToTop\(hwnd\)|SetFocus\(hwnd\)/u);
});

function createControl(id: string, parentId?: string, type: LingControl['type'] = 'Button'): LingControl {
  return {
    id,
    parentId,
    type,
    name: id,
    content: id,
    width: 100,
    height: 30,
    x: 0,
    y: 0,
    fontSize: 12,
    background: 'transparent',
    foreground: '#ffffff',
    isEnabled: true,
    visibility: 'Visible'
  };
}

test('控件标记保持可空、文本精确匹配且整数 0 与负数有效', () => {
  assert.equal(normalizeControlTagText('  确认  '), '确认');
  assert.equal(normalizeControlTagText('   '), undefined);
  assert.equal(normalizeControlTagInteger(0), 0);
  assert.equal(normalizeControlTagInteger(-1001), -1001);
  assert.equal(normalizeControlTagInteger(2147483648), undefined);

  const first = { ...createControl('first'), name: '按钮一', tagText: '确认', tagInteger: 0 };
  const duplicate = { ...createControl('duplicate'), name: '按钮二', tagText: '确认', tagInteger: 0 };
  const otherType = { ...createControl('other', undefined, 'TextBox'), name: '编辑框一', tagText: '确认', tagInteger: 0 };
  assert.equal(findControlTagConflict([first, duplicate, otherType], duplicate.id, 'text', duplicate.tagText)?.controlId, first.id);
  assert.equal(findControlTagConflict([first, duplicate, otherType], otherType.id, 'text', otherType.tagText), undefined);
  const normalized = normalizeWindowControlTags([first, duplicate, otherType]);
  assert.equal(normalized.controls[0].tagInteger, 0);
  assert.equal(normalized.controls[1].tagText, undefined);
  assert.equal(normalized.controls[1].tagInteger, undefined);
  assert.equal(normalized.controls[2].tagText, '确认');
  assert.equal(normalized.warnings.length, 2);
});

test('设计器状态持久化标记且旧项目不升级 schema', () => {
  const tagged = { ...createControl('tagged'), tagText: '  确认  ', tagInteger: -1 };
  const legacy = createControl('legacy', undefined, 'TextBox');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'tag-project',
    name: '标记项目',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#fff', description: '', controls: [tagged, legacy] }]
  };
  const state = normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: 'tagged' });
  assert.equal(state.project.schemaVersion, 2);
  assert.equal(state.project.windows[0].controls[0].tagText, '确认');
  assert.equal(state.project.windows[0].controls[0].tagInteger, -1);
  assert.equal(Object.hasOwn(state.project.windows[0].controls[1], 'tagText'), false);
  const xml = generateWindowXml(state.project.windows[0]);
  assert.match(xml, /标记文本="确认"/u);
  assert.match(xml, /标记整数="-1"/u);
});

test('控件字体属性迁移、下拉选项、预览和 Win32 生成保持一致', () => {
  const legacyControl = createControl('legacy-label', undefined, 'Label');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'font-project',
    name: '字体项目',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [legacyControl]
    }]
  };
  const migrated = normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: legacyControl.id });
  const migratedControl = migrated.project.windows[0].controls[0];
  assert.equal(migratedControl.fontFamily, DEFAULT_CONTROL_FONT_FAMILY);
  assert.equal(migratedControl.fontBold, false);
  assert.equal(migratedControl.fontItalic, false);
  assert.equal(migratedControl.fontUnderline, false);
  assert.ok(CONTROL_FONT_FAMILY_OPTIONS.some(option => option.value === 'Microsoft YaHei UI' && option.label === '微软雅黑 UI'));

  const styledControl: LingControl = {
    ...migratedControl,
    fontFamily: 'KaiTi',
    fontSize: 18,
    fontBold: true,
    fontItalic: true,
    fontUnderline: true
  };
  assert.deepEqual(getControlFontCssStyle(styledControl), {
    fontFamily: '"KaiTi", sans-serif', fontSize: '18px', fontWeight: 700, fontStyle: 'italic', textDecoration: 'underline'
  });
  const cpp = generateLingCppNativeWin32Project({ ...project, windows: [{ ...project.windows[0], controls: [styledControl] }] }, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /CreateControlFont\(const wchar_t\* family, int cssPx, bool bold, bool italic, bool underline/u);
  assert.match(cpp, /bold \? FW_BOLD : FW_NORMAL/u);
  assert.match(cpp, /italic \? TRUE : FALSE, underline \? TRUE : FALSE/u);
  assert.match(cpp, /L"KaiTi", true, true, true/u);
});

test('IP 地址框在设计器和原生运行时应用颜色、垂直对齐与边框', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'IPAddress');
  assert.ok(definition);
  const properties = new Map(definition.properties.map(property => [property.key, property]));
  assert.deepEqual(properties.get('verticalAlign')?.options?.map(option => [option.value, option.label]), [
    ['top', '顶部对齐'], ['center', '居中'], ['bottom', '底部对齐']
  ]);
  assert.equal(properties.get('verticalAlign')?.defaultValue, 'center');
  assert.deepEqual(
    [properties.get('borderWidth')?.defaultValue, properties.get('borderWidth')?.min, properties.get('borderWidth')?.max],
    [1, 0, 8]
  );
  assert.equal(properties.get('borderColor')?.defaultValue, '#64748B');
  assert.deepEqual(createDefaultControlProperties('IPAddress'), {
    address: '127.0.0.1', verticalAlign: 'center', borderWidth: 1, borderColor: '#64748B', toolTip: '', toolTipDelay: 500
  });
  const ipAddress = {
    ...createControl('ip-address', undefined, 'IPAddress'),
    content: '192.168.1.8',
    background: '#123456',
    foreground: '#FEDCBA',
    properties: { address: '192.168.1.8', verticalAlign: 'bottom', borderWidth: 3, borderColor: '#0EA5E9' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'ip-address-colors',
    name: 'IP 地址框颜色',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [ipAddress]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"IPAddress"[^\n]+RGB\(18, 52, 86\), false, RGB\(254, 220, 186\)/u);
  assert.match(cpp, /IsType\(\*control, L"IPAddress"\)[\s\S]+message == WM_CTLCOLOREDIT/u);
  assert.match(cpp, /SetTextColor\(hdc, control->foreground\);[\s\S]+SetBkColor\(hdc, control->background\);/u);
  assert.match(cpp, /void PaintIPAddressChrome\(HWND hwnd, HDC hdc/u);
  assert.match(cpp, /CombineRgn\(backgroundRegion, backgroundRegion, fieldRegion, RGN_DIFF\)/u);
  assert.match(cpp, /DrawTextW\(hdc, L"\.", 1, &separatorRect/u);
  assert.match(cpp, /L"IPAddress"[^\n]+3, RGB\(14, 165, 233\)[^\n]+L"bottom"/u);
  assert.match(cpp, /void LayoutIPAddressFields\(HWND hwnd/u);
  assert.match(cpp, /TextEquals\(control.option1, L"bottom"\)/u);
  assert.match(cpp, /void LayoutIPAddressControl\(const ControlSpec& control, RuntimeControl& runtime\)/u);
  assert.match(cpp, /static LRESULT CALLBACK IPAddressFrameSubclassProc/u);
  assert.match(cpp, /CreateSolidBrush\(control->listBorderColor\)/u);
  assert.match(cpp, /InflateRect\(&contentRect, -borderWidth, -borderWidth\)/u);
  assert.match(cpp, /IsType\(control, L"IPAddress"\) \? IPAddressFrameSubclassProc/u);
  assert.match(cpp, /LayoutIPAddressControl\(control, runtime\)/u);
  assert.match(cpp, /message == WM_SIZE \|\| message == WM_SETFONT/u);
  assert.match(cpp, /self->PaintIPAddressChrome\(hwnd, hdc, \*control, \*runtime\)/u);
});

test('超链接控件点击或按回车时打开已配置的链接并继续分发事件', () => {
  const hyperlink = {
    ...createControl('hyperlink', undefined, 'SysLink'),
    content: '打开官网',
    properties: { url: 'https://lingbuilder.example/docs' },
    events: { Click: '_hyperlink_被单击' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'hyperlink-navigation',
    name: '超链接导航',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [hyperlink]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"SysLink"[^\n]+L"https:\/\/lingbuilder\.example\/docs"/u);
  assert.match(cpp, /header->code == NM_CLICK \|\| header->code == NM_RETURN/u);
  assert.match(cpp, /link && link->item\.szUrl\[0\] \? link->item\.szUrl : control->data/u);
  assert.match(cpp, /ShellExecuteW\(hwnd_, L"open", target, nullptr, nullptr, SW_SHOWNORMAL\);/u);
  const hyperlinkHandler = cpp.indexOf('header->code == NM_CLICK || header->code == NM_RETURN');
  assert.ok(cpp.indexOf('ShellExecuteW(hwnd_, L"open", target', hyperlinkHandler) < cpp.indexOf('DispatchLingEvent(*control, L"Click");', hyperlinkHandler));
});

test('图片选择资源复制到项目 assets 并可同步到构建与导出目录', async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-designer-assets-'));
  try {
    const sourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-image-source-'));
    const source = path.join(sourceDirectory, '封面.png');
    const iconSource = path.join(sourceDirectory, '应用.ico');
    const animationSource = path.join(sourceDirectory, '加载动画.avi');
    await fs.writeFile(source, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await fs.writeFile(iconSource, Buffer.from([0x00, 0x00, 0x01, 0x00]));
    await fs.writeFile(animationSource, Buffer.from('RIFF-AVI '));
    const service = createDesignerAssetService(workspace);
    const projectRef = {
      id: 'demo', name: '演示', type: 'visual-cpp' as const,
      sourceRoot: 'src/demo', configRoot: 'config/demo', designerPath: '.lingbuilder/projects/demo/window-designer.json'
    };

    const imported = await service.importImage(projectRef, source);
    assert.equal(imported.relativePath, 'assets/demo/封面.png');
    assert.deepEqual((await service.readImage(projectRef, imported.relativePath)).bytes, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const importedIcon = await service.importImage(projectRef, iconSource);
    assert.equal(importedIcon.relativePath, 'assets/demo/应用.ico');
    assert.equal((await service.readImage(projectRef, importedIcon.relativePath)).mimeType, 'image/x-icon');
    const importedAnimation = await service.importAnimation(projectRef, animationSource);
    assert.equal(importedAnimation.relativePath, 'assets/demo/加载动画.avi');
    await assert.rejects(() => service.importAnimation(projectRef, source), /仅支持 AVI/u);
    const listedImages = await service.listProjectImages(projectRef);
    assert.equal(listedImages.length, 2);
    assert.deepEqual(
      new Set(listedImages.map(image => image.relativePath)),
      new Set(['assets/demo/封面.png', 'assets/demo/应用.ico'])
    );
    assert.ok(listedImages.every(image => image.size === 4));

    const buildDir = path.join(workspace, '.lingbuilder-build', 'demo', 'bin');
    const exportDir = path.join(workspace, 'generated', 'cpp', 'demo');
    await service.copyProjectAssets(projectRef, [buildDir, exportDir]);
    assert.deepEqual(await fs.readFile(path.join(buildDir, 'assets', 'demo', '封面.png')), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    assert.deepEqual(await fs.readFile(path.join(exportDir, 'assets', 'demo', '封面.png')), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    assert.deepEqual(await fs.readFile(path.join(buildDir, 'assets', 'demo', '应用.ico')), Buffer.from([0x00, 0x00, 0x01, 0x00]));
    assert.deepEqual(await fs.readFile(path.join(buildDir, 'assets', 'demo', '加载动画.avi')), Buffer.from('RIFF-AVI '));
    assert.match(getDesignerImagePreviewSource('demo', imported.relativePath), /^\/api\/window-designer\/assets\/content\?/u);
    assert.equal(getDesignerImagePreviewSource('demo', 'https://example.com/cover.png'), 'https://example.com/cover.png');

    await fs.rm(sourceDirectory, { recursive: true, force: true });
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test('图片资源预览先通过受控 fetch 读取 Blob 并保留服务端错误', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  let requestedUrl = '';
  globalThis.fetch = (async (input: string | URL | Request) => {
    requestedUrl = String(input);
    return new Response(Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
      status: 200,
      headers: { 'Content-Type': 'image/png; charset=binary' }
    });
  }) as typeof fetch;
  const blob = await fetchDesignerImagePreviewBlob('demo', 'assets/demo/封面.png');
  assert.equal(blob.type, 'image/png;charset=binary');
  assert.equal(blob.size, 4);
  assert.match(requestedUrl, /^\/api\/window-designer\/assets\/content\?/u);

  globalThis.fetch = (async () => new Response(JSON.stringify({ error: 'LingBuilder 本地会话无效或缺失。' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  })) as typeof fetch;
  await assert.rejects(
    () => fetchDesignerImagePreviewBlob('demo', 'assets/demo/封面.png'),
    /本地会话无效或缺失/u
  );
});

test('设计器标题区偏移只在真实菜单存在时增加菜单栏高度', () => {
  const withoutMenu = { menuItems: undefined };
  const withMenu = { menuItems: '文件, 编辑' };
  const blankMenu = { menuItems: ' ,  ' };

  assert.equal(hasDesignerWindowMenu(withoutMenu), false);
  assert.equal(hasDesignerWindowMenu(blankMenu), false);
  assert.equal(getDesignerWindowContentOffset(withoutMenu), 28);
  assert.equal(getDesignerWindowContentOffset(blankMenu), 28);
  assert.equal(hasDesignerWindowMenu(withMenu), true);
  assert.equal(getDesignerWindowContentOffset(withMenu), 52);
});

test('双击默认事件保留自定义处理器且菜单项稳定使用 Select', () => {
  const window: LingWindowModel = {
    id: 'main',
    fileName: '主窗口.xml',
    className: '主窗口',
    title: '主窗口',
    width: 640,
    height: 480,
    background: '#202028',
    description: '',
    controls: [],
    menuItems: '文件',
    menuEvents: { Item_0: '_主窗口_打开自定义菜单' }
  };
  const button = {
    ...createControl('confirm'),
    name: '确认按钮',
    events: { Click: '_确认按钮_保存自定义数据' }
  };
  const menuItem = {
    ...createControl('__window_menu_item_0__'),
    type: 'MenuItem' as LingControl['type'],
    name: '文件',
    events: { Select: '_不应覆盖窗口菜单绑定' }
  };

  assert.deepEqual(getPrimaryDesignerEventBinding(button, window), {
    eventName: 'Click',
    handlerName: '_确认按钮_保存自定义数据'
  });
  assert.deepEqual(getPrimaryDesignerEventBinding(button, window, {
    type: 'Button',
    label: '按钮 Button',
    defaultProps: {},
    events: [{
      name: 'Clicked',
      aliases: ['Click'],
      label: '被点击',
      handlerPattern: '_{controlName}_被点击',
      runtimeCommand: 'EU_SetElementClickCallback'
    }]
  }), {
    eventName: 'Clicked',
    handlerName: '_确认按钮_保存自定义数据'
  });
  assert.equal(getPrimaryEventNameForType(menuItem.type), 'Select');
  assert.equal(getEventsForType(menuItem.type)[0]?.name, 'Select');
  assert.deepEqual(getPrimaryDesignerEventBinding(menuItem, window), {
    eventName: 'Select',
    handlerName: '_主窗口_打开自定义菜单',
    menuEventKey: 'Item_0'
  });
});

test('窗口事件注册表完整覆盖常用和高级事件', () => {
  assert.equal(WINDOW_EVENT_DEFINITIONS.length, 18);
  assert.equal(new Set(WINDOW_EVENT_DEFINITIONS.map(item => item.name)).size, 18);
  assert.deepEqual(WINDOW_EVENT_CATEGORIES, ['生命周期', '布局与状态', '焦点与键盘', '系统与拖放']);
  assert.equal(WINDOW_EVENT_DEFINITIONS.filter(item => item.batch === 'common').length, 8);
  assert.equal(WINDOW_EVENT_DEFINITIONS.filter(item => item.batch === 'advanced').length, 10);
  assert.equal(getWindowEventHandlerName('主窗口', 'FileDropped'), '_主窗口_文件被拖入');
});

test('窗口参数化事件统一生成强类型签名并传递 Win32 运行时参数', () => {
  const events = {
    KeyDown: '_主窗口_按键被按下',
    KeyUp: '_主窗口_按键被放开',
    TextInput: '_主窗口_字符被输入',
    DpiChanged: '_主窗口_DPI被改变',
    FileDropped: '_主窗口_文件被拖入'
  };
  const source = [
    '类 主窗口 : 公开 窗体',
    '    事件 _主窗口_按键被按下(整数型 键码，逻辑型 Ctrl键按下，逻辑型 Shift键按下，逻辑型 Alt键按下)',
    '        调试输出(键码)',
    '    结束',
    '    事件 _主窗口_按键被放开(整数型 键码，逻辑型 Ctrl键按下，逻辑型 Shift键按下，逻辑型 Alt键按下)',
    '        调试输出(键码)',
    '    结束',
    '    事件 _主窗口_字符被输入(文本型 字符)',
    '        调试输出(字符)',
    '    结束',
    '    事件 _主窗口_DPI被改变(整数型 新DPI)',
    '        调试输出(新DPI)',
    '    结束',
    '    事件 _主窗口_文件被拖入(文本型[] 文件集合)',
    '        调试输出(窗口_取拖入文件数量())',
    '    结束',
    '结束类'
  ].join('\n');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'window-event-parameters',
    name: '窗口事件参数',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: [], events
    }]
  };
  const diagnostics = getLingCppSemanticDiagnostics(source, project);
  assert.equal(diagnostics.filter(item => item.level === 'error').length, 0, diagnostics.map(item => item.message).join('\n'));
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /void 主窗口_按键被按下\(int 键码 = \{\}, bool Ctrl键按下 = \{\}, bool Shift键按下 = \{\}, bool Alt键按下 = \{\}/u);
  assert.match(cpp, /void 主窗口_按键被放开\(int 键码 = \{\}, bool Ctrl键按下 = \{\}, bool Shift键按下 = \{\}, bool Alt键按下 = \{\}/u);
  assert.match(cpp, /void 主窗口_字符被输入\(std::wstring 字符 = \{\}/u);
  assert.match(cpp, /void 主窗口_DPI被改变\(int 新DPI = \{\}/u);
  assert.match(cpp, /void 主窗口_文件被拖入\(std::vector<std::wstring> 文件集合 = \{\}/u);
  assert.match(cpp, /主窗口_按键被按下\(eventKeyCode_, eventCtrlDown_, eventShiftDown_, eventAltDown_\)/u);
  assert.match(cpp, /主窗口_按键被放开\(eventKeyCode_, eventCtrlDown_, eventShiftDown_, eventAltDown_\)/u);
  assert.match(cpp, /主窗口_字符被输入\(eventCharacter_\)/u);
  assert.match(cpp, /主窗口_DPI被改变\(static_cast<int>\(dpi_\)\)/u);
  assert.match(cpp, /主窗口_文件被拖入\(droppedFiles_\)/u);
  assert.match(cpp, /调试输出\(键码\);/u);
  assert.doesNotMatch(cpp, /调试输出\(LingCppWideArg\(键码\)\);/u);

  const mismatch = getLingCppSemanticDiagnostics([
    '类 主窗口',
    '    事件 _主窗口_按键被按下(文本型 键码)',
    '    结束',
    '结束类'
  ].join('\n'), project);
  assert.ok(mismatch.some(item => item.id.includes('lingcpp-window-event-parameters')));
});

test('从设计器打开旧无参窗口事件时升级为注册表强类型签名', () => {
  const legacy = [
    '类 MainWindow',
    '    事件 _MainWindow_按键被按下()',
    '        调试输出("按下")',
    '    结束',
    '结束类'
  ].join('\r\n');
  const upgraded = upgradeLegacyWindowEventHandlerSignature(legacy, '_MainWindow_按键被按下', 'KeyDown');
  assert.equal(upgraded.changed, true);
  assert.match(upgraded.content, /事件 _MainWindow_按键被按下\(整数型 键码，逻辑型 Ctrl键按下，逻辑型 Shift键按下，逻辑型 Alt键按下\)/u);
  assert.ok(upgraded.content.includes('\r\n'), '迁移必须保留原换行格式');

  const alreadyTyped = upgradeLegacyWindowEventHandlerSignature(upgraded.content, '_MainWindow_按键被按下', 'KeyDown');
  assert.equal(alreadyTyped.changed, false);
  assert.equal(alreadyTyped.content, upgraded.content);

  const mismatched = legacy.replace('按键被按下()', '按键被按下(文本型 自定义参数)');
  assert.equal(upgradeLegacyWindowEventHandlerSignature(mismatched, '_MainWindow_按键被按下', 'KeyDown').changed, false);
  assert.equal(upgradeLegacyWindowEventHandlerSignature(legacy, '_MainWindow_按键被按下', 'Loaded').changed, false);
});

test('模块设计器事件参数统一格式化并安全升级旧无参处理器', () => {
  const parameters = [
    { name: '行号', type: 'int' as const },
    { name: '列号', type: 'int' as const },
    { name: '文本', type: 'wideString' as const }
  ];
  assert.equal(formatModuleDesignerEventParameters(parameters), '整数型 行号，整数型 列号，文本型 文本');

  const legacy = [
    '类 MainWindow',
    '    事件 _表格1_单元格编辑()',
    '        调试输出("编辑")',
    '    结束',
    '结束类'
  ].join('\n');
  const upgraded = upgradeLegacyModuleDesignerEventHandlerSignature(legacy, '_表格1_单元格编辑', parameters);
  assert.equal(upgraded.changed, true);
  assert.match(upgraded.content, /事件 _表格1_单元格编辑\(整数型 行号，整数型 列号，文本型 文本\)/u);

  const custom = legacy.replace('单元格编辑()', '单元格编辑(整数型 自定义)');
  assert.equal(upgradeLegacyModuleDesignerEventHandlerSignature(custom, '_表格1_单元格编辑', parameters).changed, false);
});

test('布局组件树按 parentId 构建父子层级并保留原始顺序', () => {
  const controls = [
    createControl('group', undefined, 'Grid'),
    createControl('input', 'group', 'TextBox'),
    createControl('button', 'group'),
    createControl('root-button')
  ];

  const tree = buildControlHierarchy(controls);
  assert.deepEqual(tree.map(node => node.control.id), ['group', 'root-button']);
  assert.deepEqual(tree[0].children.map(node => node.control.id), ['input', 'button']);
  assert.deepEqual([...getControlDescendantIds(controls, 'group')], ['input', 'button']);
  assert.equal(normalizeControlHierarchy(controls), controls, '合法层级应保持引用稳定，避免自动保存重复通知');
});

test('设计画布始终先绘制父容器再绘制嵌套选项卡', () => {
  const controls = [
    { ...createControl('inner-tab', 'outer-tab', 'TabControl'), containerSlot: 'page1' },
    createControl('root-button'),
    createControl('outer-tab', undefined, 'TabControl'),
    createControl('inner-label', 'inner-tab', 'Label'),
    createControl('outer-label', 'outer-tab', 'Label')
  ];

  assert.deepEqual(
    orderControlsForDesignerPainting(controls).map(control => control.id),
    ['root-button', 'outer-tab', 'inner-tab', 'inner-label', 'outer-label']
  );
});

test('无效父级和循环父级会安全降级到窗口根级', () => {
  const normalized = normalizeControlHierarchy([
    createControl('first', 'second'),
    createControl('second', 'first'),
    createControl('orphan', 'missing')
  ]);

  assert.equal(normalized[0].parentId, undefined);
  assert.equal(normalized[1].parentId, undefined);
  assert.equal(normalized[2].parentId, undefined);
});

test('布局树拖拽换父级支持容器和窗口根级并拒绝循环层级', () => {
  const controls = [
    createControl('outer', undefined, 'Grid'),
    createControl('inner', 'outer', 'GroupBox'),
    createControl('scroll', 'inner', 'ScrollBar'),
    createControl('other', undefined, 'Grid')
  ];

  assert.equal(canReparentControl(controls, 'scroll', 'other'), true);
  const movedToOther = reparentControl(controls, 'scroll', 'other');
  assert.equal(movedToOther.find(control => control.id === 'scroll')?.parentId, 'other');
  assert.equal(canReparentControl(movedToOther, 'scroll'), true);
  const movedToRoot = reparentControl(movedToOther, 'scroll');
  assert.equal(movedToRoot.find(control => control.id === 'scroll')?.parentId, undefined);

  assert.equal(canReparentControl(controls, 'outer', 'inner'), false, '父控件不能拖入自己的后代');
  assert.equal(canReparentControl(controls, 'inner', 'inner'), false, '控件不能成为自己的父级');
  assert.equal(canReparentControl(controls, 'scroll', 'missing'), false, '目标父级必须存在');
  assert.equal(reparentControl(controls, 'outer', 'inner'), controls, '非法操作应保持原数组引用');
});

test('布局树批量拖拽保持多选控件的内部父子结构', () => {
  const controls = [
    createControl('source', undefined, 'Grid'),
    createControl('parent', 'source', 'GroupBox'),
    createControl('child', 'parent', 'Button'),
    createControl('sibling', 'source', 'Label'),
    createControl('target', undefined, 'Grid')
  ];

  assert.equal(canReparentControls(controls, ['parent', 'child', 'sibling'], 'target'), true);
  const moved = reparentControls(controls, ['parent', 'child', 'sibling'], 'target');
  assert.equal(moved.find(control => control.id === 'parent')?.parentId, 'target');
  assert.equal(moved.find(control => control.id === 'sibling')?.parentId, 'target');
  assert.equal(moved.find(control => control.id === 'child')?.parentId, 'parent', '选中的后代不应被打散到目标容器');

  assert.equal(canReparentControls(controls, ['parent', 'target'], 'child'), false, '批量移动必须原子拒绝循环父级');
  assert.equal(reparentControls(controls, ['parent', 'target'], 'child'), controls);
});

test('父容器的可见和启用状态由所有后代继承', () => {
  const controls = [
    { ...createControl('hidden-group', undefined, 'GroupBox'), visibility: 'Collapsed' as const },
    createControl('hidden-combo', 'hidden-group', 'ComboBox'),
    { ...createControl('disabled-group', undefined, 'GroupBox'), isEnabled: false },
    createControl('disabled-button', 'disabled-group', 'Button')
  ];

  assert.deepEqual(getEffectiveControlState(controls, 'hidden-combo'), { visible: false, enabled: true });
  assert.deepEqual(getEffectiveControlState(controls, 'disabled-button'), { visible: true, enabled: false });

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'inherited-container-state',
    name: '父容器状态继承',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"GroupBox", L"hidden-group"[^\n]+536870912/u);
  const inheritedHiddenChild = cpp.split('\n').find(line => line.includes('L"ComboBox", L"hidden-combo"')) || '';
  assert.ok(inheritedHiddenChild, '隐藏父容器中的子控件仍必须生成独立 HWND');
  assert.doesNotMatch(inheritedHiddenChild, /, 536870912, L"/u, '子控件应由父 HWND 继承隐藏，不能永久清除自身 WS_VISIBLE');
  assert.match(cpp, /CF_HIDDEN = 1u << 29/u);
  assert.match(cpp, /if \(control\.flags & CF_HIDDEN\) frameStyle &= ~WS_VISIBLE/u);
  assert.match(cpp, /bool 控件_设置可见\(const wchar_t\* controlName, bool visible\)/u);
  assert.match(cpp, /bool 控件_设置位置大小\(const wchar_t\* controlName, int x, int y, int width, int height\)/u);
  assert.match(cpp, /MoveWindow\(target, x, y, width, height, TRUE\)/u);
  assert.match(cpp, /ShowWindow\(runtime->frameHwnd, visible \? SW_SHOW : SW_HIDE\);\s*ShowWindow\(runtime->hwnd, visible \? SW_SHOW : SW_HIDE\)/u);
  assert.match(cpp, /L"Button", L"disabled-button"[^\n]+false/u);
});

test('布局 XML 保留父级控件标识供工程迁移和检查', () => {
  const windowModel: LingWindowModel = {
    id: 'main',
    fileName: 'MainWindow.xml',
    className: '主窗口',
    title: '主窗口',
    width: 640,
    height: 480,
    background: '#ffffff',
    description: '',
    controls: [createControl('group', undefined, 'Grid'), createControl('child', 'group')]
  };

  assert.match(generateWindowXml(windowModel), /父级控件="group"/);
});

test('Win32 控件注册表与基础/高级模块贡献保持一致', () => {
  const allRegisteredTypes = WIN32_CONTROL_DEFINITIONS.map(definition => definition.type);
  const registeredTypes = WIN32_CONTROL_DEFINITIONS
    .filter(definition => !definition.legacyOnly && (definition.moduleId === 'lingbuilder.win32.basic' || definition.moduleId === 'lingbuilder.win32.common-controls'))
    .map(definition => definition.type);
  assert.equal(new Set(allRegisteredTypes).size, allRegisteredTypes.length, '控件 type 必须唯一');
  const contributedTypes = BUILTIN_MODULES
    .filter(module => module.id === 'lingbuilder.win32.basic' || module.id === 'lingbuilder.win32.common-controls')
    .flatMap(module => module.contributes?.designerControls || [])
    .map(control => control.type);
  assert.deepEqual(new Set(contributedTypes), new Set(registeredTypes));
  WIN32_CONTROL_DEFINITIONS.forEach(definition => {
    assert.ok(definition.nativeAdapter, `${definition.type} 必须声明原生适配器`);
    assert.equal(new Set(definition.events.map(event => event.name)).size, definition.events.length, `${definition.type} 事件不能重复`);
    assert.equal(new Set(definition.properties.map(property => property.key)).size, definition.properties.length, `${definition.type} 属性不能重复`);
  });
  const legacyGrid = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Grid');
  assert.equal(legacyGrid?.legacyOnly, true, '网格容器只允许旧项目继续读取，不能再作为模块新增控件贡献');
  assert.ok(!contributedTypes.includes('Grid'));
  const legacyPager = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Pager');
  assert.equal(legacyPager?.legacyOnly, true, '分页容器只允许旧项目继续读取，不能再作为模块新增控件贡献');
  assert.ok(!contributedTypes.includes('Pager'));
});

test('EdgeView 模块贡献可创建、可拖动的设计器浏览器占位', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'EdgeBrowser');
  assert.ok(definition);
  assert.equal(definition.moduleId, 'lingbuilder.edgeview');
  assert.equal(definition.nativeAdapter, 'edgeview-browser');
  assert.equal(definition.isVisual, true);
  assert.equal(hasDedicatedControlPreview('EdgeBrowser'), true);
  assert.equal(hasDedicatedControlPreview('FBroBrowser'), true);
  assert.ok(CREATABLE_DESIGNER_CONTROL_TYPES.includes('EdgeBrowser'));
  const manifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.edgeview');
  const contribution = manifest?.contributes?.designerControls?.find(control => control.type === 'EdgeBrowser');
  assert.equal(contribution?.label, 'Edge浏览器');
  assert.equal(contribution?.events?.length, EDGEVIEW_BROWSER_EVENTS.length);
  assert.ok(contribution?.events?.some(event => event.name === 'Environment.BrowserProcessExited'));
  assert.ok(contribution?.events?.some(event => event.name === 'Frame.WebMessageReceived'));
  assert.ok(contribution?.events?.some(event => event.name === 'DevToolsProtocolEventReceived'));
});

test('动态图像控件使用项目 GIF 资源并按帧延时生成 Win32 播放运行时', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'AnimatedImage');
  assert.ok(definition);
  assert.equal(definition.label, '动态图像控件');
  assert.equal(definition.moduleId, 'lingbuilder.win32.basic');
  assert.equal(hasDedicatedControlPreview('AnimatedImage'), true, '专属 GIF 预览存在时不得再渲染通用控件占位框');
  assert.deepEqual(
    ['gifSource', 'stretch', 'autoPlay', 'loop'].map(key => [key, definition.properties.find(property => property.key === key)?.defaultValue]),
    [['gifSource', ''], ['stretch', 'uniform'], ['autoPlay', true], ['loop', true]]
  );

  const animatedImage = {
    ...createControl('animated-logo', undefined, 'AnimatedImage'),
    name: '动态徽标',
    width: 180,
    height: 140,
    background: '#112233',
    properties: { gifSource: 'assets/demo/loading.gif', stretch: 'uniformToFill', autoPlay: true, loop: false },
    events: { Finished: '_动态徽标_播放完毕' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'animated-image-project',
    name: 'GIF 播放测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [animatedImage]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n事件 _动态徽标_播放完毕()\n结束\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"AnimatedImage"[^\r\n]+L"assets\/demo\/loading\.gif"/u);
  assert.match(cpp, /InitializeAnimatedImage\(const ControlSpec& control, RuntimeControl& runtime\)/u);
  assert.match(cpp, /GetPropertyItemSize\(0x5100\)/u);
  assert.match(cpp, /runtime\.animatedFrameDelays\[index\] = std::max\(20u, delays\[index\] \* 10u\)/u);
  assert.match(cpp, /AdvanceAnimatedImage\(static_cast<UINT_PTR>\(wParam\)\)/u);
  assert.match(cpp, /DispatchLingEvent\(\*control, L"Finished"\)/u);
});

test('项目集合编辑器允许用回车继续输入下一项', () => {
  assert.deepEqual(parseStringListPropertyText('第一项\n'), ['第一项']);
  assert.deepEqual(parseStringListPropertyText('第一项\n第二项'), ['第一项', '第二项']);
  assert.deepEqual(parseStringListPropertyText('第一项\r\n第二项'), ['第一项', '第二项']);
});

test('Win32 列表框使用设计器边框和渐变圆角选中样式', () => {
  const listBoxDefinition = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ListBox');
  assert.ok(listBoxDefinition);
  const listBoxProperties = new Map(listBoxDefinition.properties.map(property => [property.key, property.defaultValue]));
  assert.deepEqual(
    ['itemHeight', 'itemSpacing', 'contentPadding', 'scrollBarVisibility', 'scrollBarWidth', 'scrollBarTrackColor', 'scrollBarThumbColor', 'showBorder', 'borderWidth', 'borderColor', 'selectionStartColor', 'selectionEndColor', 'selectionBorderColor', 'selectionCornerRadius']
      .map(key => [key, listBoxProperties.get(key)]),
    [
      ['itemHeight', 28],
      ['itemSpacing', 0],
      ['contentPadding', 4],
      ['scrollBarVisibility', 'auto'],
      ['scrollBarWidth', 8],
      ['scrollBarTrackColor', '#172033'],
      ['scrollBarThumbColor', '#0E7490'],
      ['showBorder', true],
      ['borderWidth', 1],
      ['borderColor', '#334155'],
      ['selectionStartColor', '#7C3AED'],
      ['selectionEndColor', '#0891B2'],
      ['selectionBorderColor', '#38BDF8'],
      ['selectionCornerRadius', 4]
    ]
  );
  assert.deepEqual(
    listBoxDefinition.properties.find(property => property.key === 'scrollBarVisibility')?.options?.map(option => [option.value, option.label]),
    [['auto', '自动'], ['visible', '始终显示'], ['hidden', '隐藏']]
  );
  const listBox = {
    ...createControl('list-box', undefined, 'ListBox'),
    background: '#0F172A',
    foreground: '#E2E8F0',
    properties: {
      items: ['第一项', '第二项'], selectedIndex: 0, sorted: false, multiple: false, itemHeight: 32, itemSpacing: 5, contentPadding: 6,
      scrollBarVisibility: 'visible', scrollBarWidth: 12, scrollBarTrackColor: '#111827', scrollBarThumbColor: '#06B6D4',
      showBorder: true, borderWidth: 3, borderColor: '#475569', selectionStartColor: '#6D28D9',
      selectionEndColor: '#0E7490', selectionBorderColor: '#67E8F9', selectionCornerRadius: 7
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'list-box-colors',
    name: '列表框颜色',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#1F2937', description: '', controls: [listBox]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"ListBox"[^\n]+, 3, RGB\(71, 85, 105\), RGB\(109, 40, 217\), RGB\(14, 116, 144\), RGB\(103, 232, 249\), 7, 32, 5, 28, 6, 1, 12, RGB\(17, 24, 39\), RGB\(6, 182, 212\)[^\n]+RGB\(15, 23, 42\), (?:true|false), RGB\(226, 232, 240\)/u);
  assert.match(cpp, /LBS_OWNERDRAWFIXED \| LBS_HASSTRINGS/u);
  assert.doesNotMatch(cpp, /WS_TABSTOP \| WS_VSCROLL \| LBS_NOTIFY/u);
  assert.match(cpp, /ListBoxFrameSubclassProc/u);
  assert.match(cpp, /PaintOwnerListBox/u);
  assert.match(cpp, /Gdiplus::LinearGradientBrush selectionBrush/u);
  assert.match(cpp, /AddRoundedRectanglePath\(path, bounds, static_cast<float>\(ScaleForDpi\(control->listSelectionCornerRadius/u);
  assert.match(cpp, /case WM_CTLCOLORLISTBOX:/u);
  assert.match(cpp, /if \(message == WM_CTLCOLORLISTBOX\)[^}]+SendMessageW\(self->hwnd_, message, wParam, lParam\)/u);
  assert.match(cpp, /SetTextColor\(hdc, control->foreground\)/u);
  assert.match(cpp, /SetBkColor\(hdc, control->background\)/u);
  assert.match(cpp, /LB_SETITEMHEIGHT, 0, ScaleForDpi\(control\.listItemHeight \+ control\.listItemSpacing, dpi_\)/u);
  assert.match(cpp, /ScaleForDpi\(control->listItemSpacing, dpi_\)/u);
  assert.match(cpp, /ScaleForDpi\(control\.listContentPadding, dpi_\)/u);
  assert.match(cpp, /ShouldShowListBoxScrollBar/u);
  assert.match(cpp, /PaintListBoxScrollBar/u);
  assert.match(cpp, /ScrollListBoxByWheel/u);
  assert.match(cpp, /GET_WHEEL_DELTA_WPARAM\(wParam\)/u);
  assert.match(cpp, /SPI_GETWHEELSCROLLLINES/u);
  assert.match(cpp, /if \(topIndex == currentTopIndex\) return;/u);
  assert.match(cpp, /if \(nextTopIndex == currentTopIndex\) return;/u);
  assert.doesNotMatch(cpp, /if \(message == WM_MOUSEWHEEL\) \{\s*LRESULT result = SendMessageW\(runtime->hwnd, message/u);
  assert.match(cpp, /LB_SETTOPINDEX/u);
  assert.match(cpp, /L'\\0'/u);
  assert.equal(cpp.includes('\0'), false, '生成的 C++ 源码不能包含 NUL 字节');

  const borderlessCpp = generateLingCppNativeWin32Project({
    ...project,
    windows: [{ ...project.windows[0], controls: [{
      ...listBox,
      properties: { ...listBox.properties, showBorder: false }
    }] }]
  }, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(borderlessCpp, /L"ListBox"[^\n]+, 0, RGB\(71, 85, 105\)/u);
});

test('Win32 分组框沿用文字颜色并支持标题对齐和边框外观', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'GroupBox');
  assert.ok(definition);
  const properties = new Map(definition.properties.map(property => [property.key, property]));
  assert.equal(properties.get('titleAlign')?.defaultValue, 'left');
  assert.deepEqual(properties.get('titleAlign')?.options?.map(option => [option.value, option.label]), [
    ['left', '居左'], ['center', '居中'], ['right', '居右']
  ]);
  assert.equal(properties.get('showBorder')?.defaultValue, true);
  assert.equal(properties.get('borderWidth')?.defaultValue, 1);
  assert.equal(properties.get('borderWidth')?.min, 0);
  assert.equal(properties.get('borderWidth')?.max, 8);
  assert.equal(properties.get('borderColor')?.defaultValue, '#64748B');

  const groupBox = {
    ...createControl('group-box', undefined, 'GroupBox'),
    content: '自定义分组',
    background: '#1F2937',
    foreground: '#F97316',
    properties: { titleAlign: 'center', showBorder: true, borderWidth: 3, borderColor: '#22D3EE' }
  } satisfies LingControl;
  const hiddenBorderGroupBox = {
    ...createControl('group-box-no-border', undefined, 'GroupBox'),
    content: '无边框分组',
    properties: { titleAlign: 'right', showBorder: false, borderWidth: 8, borderColor: '#EF4444' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'group-box-appearance',
    name: '分组框外观',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#111827', description: '', controls: [groupBox, hiddenBorderGroupBox]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"GroupBox"[^\n]+, 3, RGB\(34, 211, 238\)[^\n]+RGB\(31, 41, 55\), false, RGB\(249, 115, 22\)/u);
  assert.match(cpp, /L"GroupBox"[^\n]+, 0, RGB\(239, 68, 68\)/u);
  assert.match(cpp, /L"GroupBox"[^\n]+L"center"/u);
  assert.match(cpp, /L"GroupBox"[^\n]+L"right"/u);
  assert.match(cpp, /void PaintGroupBox\(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime\)/u);
  assert.match(cpp, /SetTextColor\(hdc, IsWindowEnabled\(hwnd\) \? control\.foreground/u);
  assert.match(cpp, /CreatePen\(PS_SOLID, borderWidth, control\.listBorderColor\)/u);
  assert.match(cpp, /TextEquals\(control\.option1, L"center"\)/u);
  assert.match(cpp, /TextEquals\(control\.option1, L"right"\)/u);
  assert.match(cpp, /if \(IsType\(\*control, L"GroupBox"\)\)/u);
  assert.match(cpp, /IsType\(control, L"GroupBox"\)[\s\S]+className = L"STATIC";[\s\S]+style \|= SS_NOTIFY \| WS_CLIPCHILDREN \| WS_CLIPSIBLINGS;[\s\S]+exStyle \|= WS_EX_CONTROLPARENT;/u);
  assert.doesNotMatch(cpp, /style \|= BS_GROUPBOX/u);
});

test('分组框转发嵌套组合框的自绘、颜色和选择消息', () => {
  const groupBox = {
    ...createControl('group-box', undefined, 'GroupBox'),
    content: '分组1',
    properties: { ...createDefaultControlProperties('GroupBox'), titleAlign: 'left' }
  } satisfies LingControl;
  const comboBox = {
    ...createControl('combo-box', 'group-box', 'ComboBox'),
    content: '选择项',
    properties: {
      ...createDefaultControlProperties('ComboBox'),
      items: ['选择项', '选项1', '选项2'],
      selectedIndex: 0,
      editable: false
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'nested-combo-box',
    name: '分组框嵌套组合框',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#111827', description: '', controls: [groupBox, comboBox]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /\{ 1002, 1001, L"ComboBox"/u);
  const forwardingStart = cpp.indexOf('if (IsType(*control, L"GroupBox") && (');
  const forwardingEnd = cpp.indexOf(')) {', forwardingStart);
  assert.ok(forwardingStart >= 0 && forwardingEnd > forwardingStart);
  const forwardingBranch = cpp.slice(forwardingStart, forwardingEnd);
  assert.match(forwardingBranch, /message == WM_COMMAND/u);
  assert.match(forwardingBranch, /message == WM_DRAWITEM/u);
  assert.match(forwardingBranch, /message == WM_MEASUREITEM/u);
  assert.match(forwardingBranch, /message == WM_CTLCOLORLISTBOX/u);
  assert.match(cpp, /return SendMessageW\(self->hwnd_, message, wParam, lParam\);/u);
  assert.match(cpp, /PaintOwnerComboBox\(item\)/u);
});

test('Win32 组合框分离收起高度和下拉高度并使用暗色自绘', () => {
  const comboDefinition = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ComboBox');
  assert.ok(comboDefinition);
  assert.equal(comboDefinition.defaultProps.height, 40);
  const comboProperties = new Map(comboDefinition.properties.map(property => [property.key, property.defaultValue]));
  assert.equal(comboProperties.get('dropDownHeight'), 160);
  assert.equal(comboProperties.get('itemHeight'), 28);

  const combo = {
    ...createControl('combo-box', undefined, 'ComboBox'),
    content: '选择项',
    width: 160,
    height: 40,
    background: '#1E1E24',
    foreground: '#FFFFFF',
    properties: {
      items: ['选择项', '选项1', '选项2'], selectedIndex: 0, dropDownHeight: 180, itemHeight: 30,
      sorted: false, editable: false, borderColor: '#334155', selectionStartColor: '#7C3AED',
      selectionEndColor: '#0891B2', selectionBorderColor: '#38BDF8'
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'combo-box-appearance',
    name: '组合框外观',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#1F2937', description: '', controls: [combo]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /style \|= \(control\.flags & CF_EDITABLE\) \? CBS_DROPDOWN : CBS_DROPDOWNLIST/u);
  assert.match(cpp, /style \|= CBS_OWNERDRAWFIXED \| CBS_HASSTRINGS/u);
  assert.match(cpp, /PaintOwnerComboBox/u);
  assert.match(cpp, /PaintCollapsedComboBox/u);
  assert.match(cpp, /if \(message == WM_ERASEBKGND\) return 1/u);
  assert.match(cpp, /if \(message == WM_NCPAINT\) return 0/u);
  assert.match(cpp, /HDC hdc = BeginPaint\(hwnd, &paint\)[^}]+PaintCollapsedComboBox\(hwnd, hdc, \*control\)/u);
  assert.match(cpp, /collapsedRect\.bottom = std::min\([\s\S]+collapsedRect\.top \+ ScaleForDpi\(control\.height, dpi_\)/u);
  assert.match(cpp, /IntersectClipRect\(hdc, collapsedRect\.left, collapsedRect\.top, collapsedRect\.right, collapsedRect\.bottom\)/u);
  assert.match(cpp, /FillRect\(hdc, &collapsedRect, surroundingBrush\)/u);
  assert.match(cpp, /if \(savedDc\) RestoreDC\(hdc, savedDc\)/u);
  assert.match(cpp, /DrawAntiAliasedRoundedRectangle\(hdc, collapsedRect, radius, background, border, true\)/u);
  assert.doesNotMatch(cpp, /DrawAntiAliasedRoundedRectangle\(hdc, clientRect, radius, background, border, true\)/u);
  assert.match(cpp, /DrawTextW\(hdc, selectedText\.c_str\(\)/u);
  assert.match(cpp, /arrowGraphics\.SetSmoothingMode\(Gdiplus::SmoothingModeAntiAlias\)/u);
  assert.match(cpp, /arrowGraphics\.DrawLines\(&arrowPen, arrowPoints, 3\)/u);
  assert.match(cpp, /childHeight = controlHeight \+ ScaleForDpi\(dropDownHeight, dpi_\)/u);
  assert.match(cpp, /CB_SETITEMHEIGHT, static_cast<WPARAM>\(-1\)/u);
  assert.match(cpp, /CB_SETITEMHEIGHT, 0, ScaleForDpi\(control\.listItemHeight, dpi_\)/u);
  assert.match(cpp, /L"ComboBox"[^\n]+L"", L"180", 0, 100/u);
});

test('Win32 增强组合框应用模型颜色并允许设置下拉列表高度', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'ComboBoxEx');
  assert.ok(definition);
  const properties = new Map(definition.properties.map(property => [property.key, property]));
  assert.equal(properties.get('dropDownHeight')?.defaultValue, 160);
  assert.equal(properties.get('dropDownHeight')?.min, 40);
  assert.equal(properties.get('dropDownHeight')?.max, 600);

  const legacyCombo = {
    ...createControl('legacy-enhanced-combo', undefined, 'ComboBoxEx'),
    properties: { items: ['旧项目'], selectedIndex: 0, imageListId: '' }
  } satisfies LingControl;
  const migrated = normalizeWindowDesignerState({
    project: {
      schemaVersion: 2,
      id: 'legacy-enhanced-combo',
      name: '旧增强组合框',
      windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#1F2937', description: '', controls: [legacyCombo] }]
    },
    activeWindowId: 'main'
  });
  assert.equal(migrated.project.windows[0].controls[0].properties?.dropDownHeight, 160);

  const combo = {
    ...createControl('enhanced-combo', undefined, 'ComboBoxEx'),
    background: '#112233',
    foreground: '#DDEEFF',
    properties: {
      ...createDefaultControlProperties('ComboBoxEx'),
      items: ['第一项', '第二项'],
      selectedIndex: 1,
      dropDownHeight: 260
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'enhanced-combo-appearance',
    name: '增强组合框外观',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#1F2937', description: '', controls: [combo]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"ComboBoxEx"[^\n]+RGB\(17, 34, 51\), false, RGB\(221, 238, 255\)[^\n]+L"", L"260"/u);
  assert.match(cpp, /IsType\(control, L"ComboBox"\) \|\| IsType\(control, L"ComboBoxEx"\)/u);
  assert.match(cpp, /PaintOwnerComboBoxEx/u);
  assert.match(cpp, /CBEM_GETCOMBOCONTROL/u);
  assert.match(cpp, /CBEM_GETIMAGELIST/u);
  assert.match(cpp, /message == WM_CTLCOLORLISTBOX \|\| message == WM_CTLCOLOREDIT \|\| message == WM_CTLCOLORSTATIC/u);
  assert.match(cpp, /SetTextColor\(hdc, control->foreground\)/u);
  assert.match(cpp, /SetBkColor\(hdc, control->background\)/u);
});

test('启用 new_emoji 后设计器模型生成真实原生窗口和基础控件', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-project',
    name: 'new_emoji 项目',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'new_emoji 主窗口',
      width: 720, height: 480, background: '#111827', description: '',
      controls: [
        { ...createControl('container', undefined, 'Grid'), x: 20, y: 20, width: 500, height: 300, isEnabled: false },
        { ...createControl('label', 'container', 'Label'), name: '说明文本', content: '欢迎使用 👋', x: 40, y: 45, fontFamily: 'KaiTi', fontSize: 18, fontBold: true },
        { ...createControl('radio', 'container', 'RadioButton'), name: '主题选项', content: '深色主题', x: 40, y: 90, properties: { checked: true } },
        { ...createControl('list', 'container', 'ListBox'), name: '功能列表', content: '功能', x: 40, y: 130, properties: { items: ['新建项目', '打开项目'], selectedIndex: 1 } },
        { ...createControl('image', 'container', 'Image'), name: '封面图', content: '项目封面', x: 260, y: 130, properties: { imageSource: 'assets/cover.png', stretch: 'uniformToFill' } },
        { ...createControl('upload', 'container', 'Upload'), name: '文件上传', content: '上传附件', x: 40, y: 190, properties: { tip: '选择资料', initialFiles: ['readme.txt'], multiple: false, autoUpload: true, styleMode: '6', showFileList: true, showTip: true, showActions: true, dropEnabled: false, limit: 2, maxSizeKb: 2048, accept: '.txt' }, events: { FilesSelected: '_文件上传_文件已选择', UploadAction: '_文件上传_上传操作' } },
        { ...createControl('drag-upload', 'container', 'DragUpload'), name: '拖拽上传', content: '拖入图片', x: 260, y: 190, properties: { tip: '拖入图片文件', initialFiles: [], multiple: true, styleMode: '5', dropEnabled: true, accept: '.png;.jpg' } },
        { ...createControl('unsupported', undefined, 'ComboBox'), name: '旧下拉框', x: 40, y: 140 },
        { ...createControl('hidden-container', undefined, 'Grid'), visibility: 'Collapsed' },
        { ...createControl('hidden-label', 'hidden-container', 'Label'), content: '不应生成的隐藏子控件' },
        { ...createControl('editor', undefined, 'TextBox'), name: '主输入框', designerType: 'lingbuilder.new_emoji.ui/EditBox', content: '', x: 40, y: 360 }
      ]
    }]
  };
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2, id: 'lingbuilder.new_emoji.ui', name: 'new_emoji 原生界面库', version: '1.0.0',
      category: '界面', description: '测试模块',
      targets: [
        { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['include'], libs: ['lib/Win32/new_emoji.lib'] },
        { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', includeDirs: ['include'], libs: ['lib/x64/new_emoji.lib'] }
      ]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui', isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n    事件 创建完毕()\n        主输入框.内容 = "new_emoji 已创建"\n        调试输出(主输入框.内容)\n    结束\n    事件 _文件上传_文件已选择()\n        调试输出(NE_取最近上传选择文件())\n    结束\n    事件 _文件上传_上传操作()\n        调试输出("上传动作")\n    结束\n结束类',
    enabledModules: [newEmojiModule]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /#include "new_emoji_bridge\.h"/);
  assert.match(cpp, /#ifndef DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2/u);
  assert.match(cpp, /static void EnableNewEmojiDpiAwareness\(\)/u);
  assert.match(cpp, /GetProcAddress\(user32, "SetProcessDpiAwarenessContext"\)/u);
  assert.match(cpp, /GetProcAddress\(user32, "SetProcessDPIAware"\)/u);
  assert.doesNotMatch(cpp, /SetProcessDPIAware\(\);/u);
  assert.ok(
    cpp.indexOf('EnableNewEmojiDpiAwareness();') >= 0
      && cpp.indexOf('EnableNewEmojiDpiAwareness();') < cpp.indexOf('CoInitializeEx'),
    'new_emoji 必须在 COM 和窗口创建前启用每显示器 DPI 感知'
  );
  assert.match(cpp, /NE_创建深色窗口\(L"new_emoji 主窗口"/);
  assert.match(cpp, /LoadImageW\(nullptr, L"lingbuilder-newemoji-window\.ico", IMAGE_ICON/u);
  assert.match(cpp, /SendMessageW\(g_newEmojiWindow, WM_SETICON, ICON_BIG/u);
  assert.match(cpp, /NE_创建容器\(/);
  assert.match(cpp, /NE_创建文本\([^\n]+欢迎使用 👋/);
  assert.match(cpp, /NE_设置元素字体\(g_newEmojiWindow, ne_element_2, L"KaiTi", 18\)/u);
  assert.match(cpp, /LB_NE_RegisterElement\(ne_element_10, L"EditBox", L"EditBox", 0, L"主输入框"/u);
  assert.match(cpp, /static std::wstring 控件_取文本\(const wchar_t\* controlName\)/u);
  assert.match(cpp, /EU_GetElementText\(g_newEmojiWindow, element->id, nullptr, 0\)/u);
  assert.match(cpp, /static bool 控件_设置文本\(const wchar_t\* controlName, const std::wstring& text\)/u);
  assert.match(cpp, /EU_SetElementText\(g_newEmojiWindow, element->id,/u);
  assert.match(cpp, /控件_设置文本\(L"主输入框", L"new_emoji 已创建"\);/u);
  assert.match(cpp, /调试输出\(控件_取文本\(L"主输入框"\)\);/u);
  assert.match(cpp, /NE_设置元素状态\(g_newEmojiWindow, ne_element_2, 1, 0/u);
  assert.match(cpp, /NE_创建单选框\([^\n]+L"深色主题", 1/);
  assert.match(cpp, /NE_创建列表框\([^\n]+L"功能", L"新建项目\|打开项目", 1/);
  assert.match(cpp, /NE_创建图片\([^\n]+L"assets\/cover\.png", L"项目封面", 1/);
  assert.match(cpp, /NE_创建上传\([^\n]+L"上传附件", L"选择资料", L"readme\.txt"/u);
  assert.match(cpp, /NE_设置上传选项\([^\n]+, 0, 1, 6, 1, 1, 1, 0, 2, 2048, L"\.txt"/u);
  assert.match(cpp, /NE_设置上传选项\([^\n]+, 1, 0, 5, 1, 1, 1, 1/u);
  assert.match(cpp, /static void __stdcall LB_UploadSelect_/u);
  assert.match(cpp, /NE_设置上传事件\([^\n]+LB_UploadSelect_[^\n]+LB_UploadAction_/u);
  assert.match(cpp, /NE_显示并激活窗口\(g_newEmojiWindow\);/u);
  assert.match(cpp, /NE_运行消息循环\(\)/);
  assert.match(cpp, /std::string output\(static_cast<size_t>\(size\), '\\0'\);/u);
  assert.equal(cpp.includes('\0'), false, 'new_emoji 生成的 C++ 源码不能包含 NUL 字节');
  assert.match(cpp, /#if defined\(_WIN64\)\s+#pragma comment\(lib, "modules\/lingbuilder\.new_emoji\.ui\/lib\/x64\/new_emoji\.lib"\)\s+#else\s+#pragma comment\(lib, "modules\/lingbuilder\.new_emoji\.ui\/lib\/Win32\/new_emoji\.lib"\)\s+#endif/u);
  assert.match(cpp, /不应生成的隐藏子控件/u);
  assert.match(cpp, /NE_设置元素状态\(g_newEmojiWindow, ne_element_8, 0,/u);
  assert.match(cpp, /if \(ne_element_10 > 0\) NE_设置元素焦点\(g_newEmojiWindow, ne_element_10\);/u);
  assert.ok(cpp.indexOf('NE_设置元素焦点') < cpp.indexOf('new_emoji 已创建'), '初始焦点应在创建完毕处理器之前设置，处理器仍可覆盖焦点');
  assert.ok(cpp.indexOf('new_emoji 已创建') < cpp.indexOf('NE_显示并激活窗口'), '创建完毕处理器执行完成后才应显示并激活窗口');
  assert.ok(cpp.indexOf('NE_显示并激活窗口') < cpp.indexOf('NE_运行消息循环'), '窗口必须在进入消息循环前显示并激活');
  assert.doesNotMatch(cpp, /class LingWindowBase/);
  assert.ok(generated.diagnostics.some(item => item.includes('旧下拉框') && item.includes('暂不支持')));
  assert.ok(generated.diagnostics.some(item => item.includes('说明文本') && item.includes('仅支持字体名称和字号')));
});

test('new_emoji 93 项目录生成类型化运行时创建和标记查找 C++', async () => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'module-build', 'lingbuilder.new_emoji.ui');
  const manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  const newEmojiModule: InstalledModule = {
    manifest,
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-runtime-control-project',
    name: 'new_emoji 运行时控件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '运行时控件',
      width: 640, height: 420, background: '#ffffff', description: '', designerBackend: 'new-emoji',
      controls: [{
        ...createControl('button', undefined, 'Button'),
        name: '静态按钮',
        designerType: 'lingbuilder.new_emoji.ui/Button',
        content: '静态',
        tagText: '静态确认',
        tagInteger: 0
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [newEmojiModule],
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 创建完毕()',
      '        局部 NE按钮 动态按钮 = 控件_创建NE按钮(当前窗口, 20, 20, 120, 36, "确定", "确认", -7)',
      '        局部 NE按钮 查找按钮 = 通过标记文本获取NE按钮("确认")',
      '        动态按钮.内容 = "动态确认"',
      '        调试输出(动态按钮.内容)',
      '        控件_设置启用(动态按钮, 真)',
      '        NE按钮_绑定被点击(动态按钮, &动态按钮被点击)',
      '        控件_是否有效(查找按钮)',
      '    结束',
      '    事件 动态按钮被点击()',
      '        调试输出("new_emoji 动态点击")',
      '    结束',
      '结束类'
    ].join('\n')
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.deepEqual(generated.blockingDiagnostics, []);
  assert.equal((cpp.match(/static LingControlRef 控件_创建NE/gu) || []).length, 93);
  assert.equal((cpp.match(/static LingControlRef 通过标记文本获取NE/gu) || []).length, 93);
  assert.equal((cpp.match(/static LingControlRef 通过标记整数获取NE/gu) || []).length, 93);
  assert.match(cpp, /LB_NE_RegisterElement\(ne_element_1, L"Button", L"NE按钮", 0, L"静态按钮", L"静态确认", 0, false\)/u);
  assert.match(cpp, /LingControlRef 动态按钮 = 控件_创建NE按钮\(0, 20, 20, 120, 36, L"确定", L"确认", -7\)/u);
  assert.match(cpp, /LingControlRef 查找按钮 = 通过标记文本获取NE按钮\(L"确认"\)/u);
  assert.match(cpp, /控件_设置文本\(LingCppControlWideName\(动态按钮\), L"动态确认"\);/u);
  assert.match(cpp, /调试输出\(控件_取文本\(LingCppControlWideName\(动态按钮\)\)\);/u);
  assert.match(cpp, /控件_设置启用\(LingCppControlWideName\(动态按钮\), true\);/u);
  assert.match(cpp, /NE按钮_绑定被点击\(LingCppControlStableId\(动态按钮\), L"动态按钮被点击"\);/u);
  assert.match(cpp, /LB_NE_SetRuntimeEventHandler\(elementId, L"NE按钮", L"Clicked", handlerName\)/u);
  assert.match(cpp, /EU_SetElementClickCallback\(g_newEmojiWindow, elementId, LB_NE_RuntimeEvent_/u);
  assert.match(cpp, /if \(lb_handler == L"动态按钮被点击"\)[\s\S]*调试输出\(L"new_emoji 动态点击"\)/u);
  assert.match(cpp, /控件_是否有效\(LingCppControlStableId\(查找按钮\)\);/u);
  assert.match(cpp, /LB_NE_ValidateCreateParent\(parentId\)/u);
  assert.match(cpp, /LB_NE_CanRegister\(L"NE按钮", tagText, tagInteger\)/u);
  assert.match(cpp, /return LB_NE_RegisterElement\(elementId, L"Button", L"NE按钮"/u);
  assert.match(cpp, /static void LB_NE_InvalidateControls\(\)/u);
});

test('new_emoji 命名空间列表框保留静态项目并跳过会清空数据的空可选 setter', () => {
  const textSetter = (command: string, propertyKey: string) => ({
    command,
    parameters: [
      { name: 'hwnd', type: 'HWND' },
      { name: 'element_id', type: 'int' },
      { name: 'items_bytes', type: 'const unsigned char*', propertyKey },
      { name: 'items_len', type: 'int', lengthOf: propertyKey }
    ],
    propertyKeys: [propertyKey]
  });
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '列表框生成测试模块',
      contributes: {
        designerControls: [{
          type: 'ListBox',
          namespacedType: 'lingbuilder.new_emoji.ui/ListBox',
          label: '列表框 ListBox',
          defaultProps: {},
          runtime: {
            createCommand: 'EU_CreateListBox',
            createParameters: [
              { name: 'hwnd', type: 'HWND' },
              { name: 'parent_id', type: 'int' },
              { name: 'title_bytes', type: 'const unsigned char*' },
              { name: 'title_len', type: 'int' },
              { name: 'items_bytes', type: 'const unsigned char*' },
              { name: 'items_len', type: 'int' },
              { name: 'x', type: 'int' },
              { name: 'y', type: 'int' },
              { name: 'w', type: 'int' },
              { name: 'h', type: 'int' }
            ],
            propertySetters: [
              textSetter('EU_SetListBoxItems', 'items'),
              textSetter('EU_SetListBoxItemsEx', 'listBoxItemsEx'),
              {
                command: 'EU_SetListBoxSelectedIndex',
                parameters: [
                  { name: 'hwnd', type: 'HWND' },
                  { name: 'element_id', type: 'int' },
                  { name: 'index', type: 'int', propertyKey: 'selectedIndex' }
                ],
                propertyKeys: ['selectedIndex']
              },
              textSetter('EU_SetListBoxSelectedKeys', 'selectedKeys'),
              {
                command: 'EU_SetListBoxVirtualItemCount',
                parameters: [
                  { name: 'hwnd', type: 'HWND' },
                  { name: 'element_id', type: 'int' },
                  { name: 'count', type: 'int', propertyKey: 'virtualItemCount' }
                ],
                propertyKeys: ['virtualItemCount']
              }
            ]
          }
        }]
      }
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const listBox = {
    ...createControl('catalog-listbox', undefined, 'ListBox'),
    name: '任务列表',
    content: '列表框',
    designerType: 'lingbuilder.new_emoji.ui/ListBox',
    properties: {
      title: '任务列表 📋',
      items: ['整理需求 📋', '设计界面 🎨', '导出项目 🚀'],
      listBoxItemsEx: [],
      selectedIndex: 0,
      selectedKeys: [],
      virtualItemCount: 0
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-listbox-project',
    name: 'new_emoji 列表框',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '列表框测试',
      width: 640, height: 420, background: '#111827', description: '', designerBackend: 'new-emoji', controls: [listBox]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n结束类',
    enabledModules: [newEmojiModule]
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /LB_NE_ToUtf8\(L"整理需求 📋\|设计界面 🎨\|导出项目 🚀"\)/u);
  assert.match(cpp, /EU_CreateListBox\(/u);
  assert.match(cpp, /EU_SetListBoxItems\(/u);
  assert.match(cpp, /EU_SetListBoxSelectedIndex\([^\n]+, 0\);/u);
  assert.doesNotMatch(cpp, /EU_SetListBoxItemsEx\(/u);
  assert.doesNotMatch(cpp, /EU_SetListBoxSelectedKeys\(/u);
  assert.doesNotMatch(cpp, /EU_SetListBoxVirtualItemCount\(/u);
});

test('new_emoji 图标设计器百分比按 valueScale 转换为原生倍率', () => {
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '图标缩放单位测试模块',
      contributes: {
        designerControls: [{
          type: 'Icon',
          namespacedType: 'lingbuilder.new_emoji.ui/Icon',
          label: '图标 Icon',
          defaultProps: { content: '图标', scale: 100, rotation: 0 },
          runtime: {
            createCommand: 'EU_CreateIcon',
            createParameters: [
              { name: 'hwnd', type: 'HWND' },
              { name: 'parent_id', type: 'int' },
              { name: 'text_bytes', type: 'const unsigned char*' },
              { name: 'text_len', type: 'int' },
              { name: 'x', type: 'int' },
              { name: 'y', type: 'int' },
              { name: 'w', type: 'int' },
              { name: 'h', type: 'int' }
            ],
            propertySetters: [{
              command: 'EU_SetIconOptions',
              parameters: [
                { name: 'hwnd', type: 'HWND' },
                { name: 'element_id', type: 'int' },
                { name: 'scale', type: 'float', propertyKey: 'scale', valueScale: 0.01 },
                { name: 'rotation_degrees', type: 'float', propertyKey: 'rotation' }
              ],
              propertyKeys: ['scale', 'rotation']
            }]
          }
        }]
      },
      targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const icon = {
    ...createControl('icon', undefined, 'Label'),
    name: '图标',
    content: '图标内容',
    designerType: 'lingbuilder.new_emoji.ui/Icon',
    properties: { scale: 100, rotation: 0 }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-icon-scale-project',
    name: 'new_emoji 图标缩放',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '图标缩放测试',
      width: 640, height: 420, background: '#111827', description: '', designerBackend: 'new-emoji', controls: [icon]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n结束类',
    enabledModules: [newEmojiModule]
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /EU_SetIconOptions\(g_newEmojiWindow, ne_element_1, 1, 0\);/u);
  assert.doesNotMatch(cpp, /EU_SetIconOptions\([^\n]+, 100, 0\);/u);
});

test('new_emoji 隐藏的 Notification、Message 和 MessageBox 不在窗口初始化阶段创建或显示', () => {
  const notificationCreateParameters = [
    { name: 'hwnd', type: 'HWND' },
    { name: 'parent_id', type: 'int' },
    { name: 'title_bytes', type: 'const unsigned char*' },
    { name: 'title_len', type: 'int' },
    { name: 'body_bytes', type: 'const unsigned char*' },
    { name: 'body_len', type: 'int' },
    { name: 'notify_type', type: 'int', propertyKey: 'messageType' },
    { name: 'closable', type: 'int' },
    { name: 'x', type: 'int' },
    { name: 'y', type: 'int' },
    { name: 'w', type: 'int' },
    { name: 'h', type: 'int' }
  ];
  const messageCreateParameters = [
    { name: 'hwnd', type: 'HWND' },
    { name: 'text_bytes', type: 'const unsigned char*' },
    { name: 'text_len', type: 'int' },
    { name: 'message_type', type: 'int', propertyKey: 'messageType' },
    { name: 'closable', type: 'int' },
    { name: 'center', type: 'int' },
    { name: 'rich', type: 'int' },
    { name: 'duration_ms', type: 'int', propertyKey: 'duration' },
    { name: 'offset', type: 'int' }
  ];
  const messageBoxCreateParameters = [
    { name: 'hwnd', type: 'HWND' },
    { name: 'title_bytes', type: 'const unsigned char*' },
    { name: 'title_len', type: 'int' },
    { name: 'text_bytes', type: 'const unsigned char*', propertyKey: 'body' },
    { name: 'text_len', type: 'int', propertyKey: 'body' },
    { name: 'confirm_bytes', type: 'const unsigned char*' },
    { name: 'confirm_len', type: 'int' },
    { name: 'cancel_bytes', type: 'const unsigned char*' },
    { name: 'cancel_len', type: 'int' },
    { name: 'box_type', type: 'int', propertyKey: 'messageType' },
    { name: 'show_cancel', type: 'int' },
    { name: 'center', type: 'int' },
    { name: 'rich', type: 'int' },
    { name: 'distinguish_cancel_and_close', type: 'int' },
    { name: 'cb', type: 'MessageBoxExCallback' }
  ];
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '瞬时弹层生成测试模块',
      contributes: {
        designerControls: [{
          type: 'Notification',
          namespacedType: 'lingbuilder.new_emoji.ui/Notification',
          label: '通知 Notification',
          defaultProps: {},
          runtime: { createCommand: 'EU_CreateNotification', createParameters: notificationCreateParameters }
        }, {
          type: 'Message',
          namespacedType: 'lingbuilder.new_emoji.ui/Message',
          label: '消息提示 Message',
          defaultProps: {},
          runtime: { createCommand: 'EU_ShowMessage', createParameters: messageCreateParameters }
        }, {
          type: 'MessageBox',
          namespacedType: 'lingbuilder.new_emoji.ui/MessageBox',
          label: '消息框 MessageBox',
          defaultProps: {},
          runtime: { createCommand: 'EU_ShowMessageBoxEx', createParameters: messageBoxCreateParameters }
        }]
      },
      targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const startupMessage = {
    ...createControl('startup-message', undefined, 'Label'),
    name: '启动消息',
    content: '启动时显示',
    designerType: 'lingbuilder.new_emoji.ui/Message',
    properties: { messageType: 0, closable: false, center: false, rich: false, duration: 3000, offset: 20 }
  } satisfies LingControl;
  const deferredMessage = {
    ...startupMessage,
    id: 'deferred-message',
    name: '点击消息',
    content: '点击后显示',
    visibility: 'Collapsed' as const
  } satisfies LingControl;
  const deferredNotification = {
    ...createControl('deferred-notification', undefined, 'Label'),
    name: '点击通知',
    content: '点击后通知',
    designerType: 'lingbuilder.new_emoji.ui/Notification',
    visibility: 'Collapsed' as const,
    properties: { title: '通知', body: ['操作已完成'], messageType: 0, closable: true, duration: 3000 }
  } satisfies LingControl;
  const deferredMessageBox = {
    ...createControl('deferred-message-box', undefined, 'Label'),
    name: '点击消息框',
    content: '点击后确认',
    designerType: 'lingbuilder.new_emoji.ui/MessageBox',
    visibility: 'Collapsed' as const,
    properties: { title: '确认', body: ['是否继续'], confirm: '确定', cancel: '取消', messageType: 0, showCancel: true, center: false, rich: false, distinguishCancelAndClose: false }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-deferred-popup-project',
    name: 'new_emoji 延迟弹层',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '延迟弹层测试',
      width: 640, height: 420, background: '#111827', description: '', designerBackend: 'new-emoji',
      controls: [startupMessage, deferredNotification, deferredMessage, deferredMessageBox]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n结束类',
    enabledModules: [newEmojiModule]
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.equal((cpp.match(/EU_ShowMessage\(/gu) || []).length, 1);
  assert.doesNotMatch(cpp, /EU_CreateNotification\(/u);
  assert.doesNotMatch(cpp, /EU_ShowMessageBoxEx\(/u);
  assert.match(cpp, /LB_NE_RegisterElement\([^\n]+L"启动消息"/u);
  assert.doesNotMatch(cpp, /LB_NE_RegisterElement\([^\n]+L"点击通知"/u);
  assert.doesNotMatch(cpp, /LB_NE_RegisterElement\([^\n]+L"点击消息"/u);
  assert.doesNotMatch(cpp, /LB_NE_RegisterElement\([^\n]+L"点击消息框"/u);
});

test('new_emoji 09–16 标签页为六类浮层和消息组件提供同页按钮', async () => {
  const project = JSON.parse(await fs.readFile(
    new URL('../../.lingbuilder/projects/new-emoji-92-tabs-validation/window-designer.json', import.meta.url),
    'utf8'
  )) as LingWindowProject;
  const source = await fs.readFile(
    new URL('../../src/new-emoji-92-tabs-validation/MainWindow.lcpp', import.meta.url),
    'utf8'
  );
  const controls = project.windows[0]?.controls || [];
  const expectedButtons = new Map([
    ['演示弹窗按钮', '_按钮03_被点击'],
    ['演示抽屉按钮', '_图标按钮90_被点击'],
    ['演示通知按钮', '_演示通知按钮_被点击'],
    ['演示消息提示按钮', '_演示消息提示按钮_被点击'],
    ['演示消息框按钮', '_演示消息框按钮_被点击'],
    ['演示信息框按钮', '_演示信息框按钮_被点击']
  ]);

  for (const [name, handler] of expectedButtons) {
    const control = controls.find(item => item.name === name);
    assert.ok(control, `缺少 09–16 演示按钮：${name}`);
    assert.equal(control.designerType, 'lingbuilder.new_emoji.ui/Button');
    assert.equal(control.parentId, 'ne92-tabs-root');
    assert.equal(control.containerSlot, 'validation-page-02');
    assert.equal(control.events?.Clicked, handler);
    assert.match(source, new RegExp(`事件 ${handler.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\(\\)`, 'u'));
  }

  for (const name of ['通知13', '消息提示14', '消息框15']) {
    assert.equal(controls.find(item => item.name === name)?.visibility, 'Collapsed');
  }
});

test('new_emoji Table 示例绑定鼠标进入和参数化单元格动作并输出到 IDE 日志', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  let manifest: InstalledModule['manifest'];
  try {
    manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过 Table 事件生成回归测试。');
    return;
  }
  const basicModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const installed: InstalledModule = {
    manifest,
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project = JSON.parse(await fs.readFile(
    new URL('../../.lingbuilder/projects/new-emoji-92-tabs-validation/window-designer.json', import.meta.url),
    'utf8'
  )) as LingWindowProject;
  const source = await fs.readFile(
    new URL('../../src/new-emoji-92-tabs-validation/MainWindow.lcpp', import.meta.url),
    'utf8'
  );
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: project.windows[0]?.id,
    enabledModules: [basicModule, installed],
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /case 1:[\s\S]*调试输出\(L"表格06鼠标移入"\)/u);
  assert.match(cpp, /EU_SetElementMouseCallback\(g_newEmojiWindow, ne_element_7, LB_NE_Event_/u);
  assert.match(cpp, /int 行号 = lb_row;\s+int 列号 = lb_col;\s+int 动作 = lb_action;\s+int 值 = lb_value;/u);
  assert.match(cpp, /EU_SetTableCellActionCallback\(g_newEmojiWindow, ne_element_7, LB_NE_Event_/u);
  assert.match(cpp, /std::printf\("\[调试输出\] %s\\n", utf8\.data\(\)\);/u);
  assert.doesNotMatch(cpp, /^#include "new_emoji_bridge\.h"$/mu);
  assert.match(cpp, /#include "modules\/lingbuilder\.new_emoji\.ui\/include\/new_emoji_bridge\.h"/u);
});

test('new_emoji ListBox 所有事件生成真实参数并映射原生回调 ABI', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  let manifest: InstalledModule['manifest'];
  try {
    manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过 ListBox 事件参数生成回归测试。');
    return;
  }
  const listBox = manifest.contributes?.designerControls?.find(control => control.type === 'ListBox');
  assert.ok(listBox);
  const basicModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const installed: InstalledModule = {
    manifest,
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-listbox-events',
    name: 'NewEmoji 列表框事件参数',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '列表框事件',
      width: 640, height: 480, background: '#202028', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'listbox', type: listBox.previewType as LingControl['type'], designerType: listBox.namespacedType, name: '列表框1', content: '列表框',
        x: 20, y: 20, width: 360, height: 260, fontSize: 14, background: '#202028', foreground: '#FFFFFF',
        isEnabled: true, visibility: 'Visible', properties: { ...listBox.defaultProps } as LingControl['properties'],
        events: {
          SelectionChanged: '_列表框1_选择变化',
          ItemClicked: '_列表框1_项目点击',
          ItemDoubleClicked: '_列表框1_项目双击',
          Edit: '_列表框1_项目编辑',
          Reorder: '_列表框1_项目重排',
          ContextMenu: '_列表框1_项目右键菜单',
          MouseDown: '_列表框1_鼠标按下',
          GotFocus: '_列表框1_获得焦点'
        }
      }]
    }]
  };
  const source = [
    '类 MainWindow : 公开 窗体',
    '  事件 _列表框1_选择变化(文本型 选中键列表)',
    '  结束',
    '  事件 _列表框1_项目点击(整数型 项目索引, 整数型 起始位置, 整数型 结束位置)',
    '  结束',
    '  事件 _列表框1_项目双击(整数型 项目索引, 整数型 触发方式, 整数型 附加值)',
    '  结束',
    '  事件 _列表框1_项目编辑(整数型 项目索引, 整数型 编辑字段, 整数型 动作, 文本型 文本)',
    '  结束',
    '  事件 _列表框1_项目重排(整数型 原索引, 整数型 新索引, 整数型 数量)',
    '  结束',
    '  事件 _列表框1_项目右键菜单(整数型 项目索引, 整数型 横坐标, 整数型 纵坐标)',
    '  结束',
    '  事件 _列表框1_鼠标按下(整数型 横坐标, 整数型 纵坐标, 整数型 鼠标按钮)',
    '  结束',
    '  事件 _列表框1_获得焦点()',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    enabledModules: [basicModule, installed],
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /std::wstring 选中键列表 = LB_NE_FromUtf8\(lb_utf8, lb_utf8_length\);/u);
  assert.match(cpp, /int 项目索引 = lb_value;\s+int 起始位置 = lb_range_start;\s+int 结束位置 = lb_range_end;/u);
  assert.match(cpp, /int 项目索引 = lb_value;\s+int 触发方式 = lb_range_start;\s+int 附加值 = lb_range_end;/u);
  assert.match(cpp, /int 项目索引 = lb_index;\s+int 编辑字段 = lb_field;\s+int 动作 = lb_action;\s+std::wstring 文本 = LB_NE_FromUtf8\(lb_utf8, lb_utf8_length\);/u);
  assert.match(cpp, /int 原索引 = lb_from_index;\s+int 新索引 = lb_to_index;\s+int 数量 = lb_count;/u);
  assert.match(cpp, /int 项目索引 = lb_value;\s+int 横坐标 = lb_range_start;\s+int 纵坐标 = lb_range_end;/u);
  assert.match(cpp, /EU_SetListBoxChangeCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetListBoxItemClickCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetListBoxItemDoubleClickCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetListBoxEditCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetListBoxReorderCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
  assert.match(cpp, /EU_SetListBoxContextMenuCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
});

test('new_emoji Tabs 选择变化事件生成真实参数并映射原生回调 ABI', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  let manifest: InstalledModule['manifest'];
  try {
    manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过 Tabs 事件参数生成回归测试。');
    return;
  }
  const tabs = manifest.contributes?.designerControls?.find(control => control.type === 'Tabs');
  assert.ok(tabs);
  const selectionChanged = tabs.events?.find(event => event.name === 'SelectionChanged');
  assert.deepEqual(
    selectionChanged?.parameters?.map(parameter => [parameter.name, parameter.type]),
    [['选中索引', 'int'], ['项目数量', 'int'], ['动作', 'int']]
  );
  const basicModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const installed: InstalledModule = {
    manifest,
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-tabs-events',
    name: 'NewEmoji 标签页事件参数',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '标签页事件参数',
      width: 640, height: 480, background: '#202028', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'tabs', type: tabs.previewType as LingControl['type'], designerType: tabs.namespacedType, name: '标签页1', content: '标签页',
        x: 20, y: 20, width: 420, height: 220, fontSize: 14, background: '#202028', foreground: '#FFFFFF',
        isEnabled: true, visibility: 'Visible', properties: { ...tabs.defaultProps } as LingControl['properties'],
        events: { SelectionChanged: '_标签页1_选择变化' }
      }]
    }]
  };
  const source = [
    '类 MainWindow : 公开 窗体',
    '  事件 _标签页1_选择变化(整数型 选中索引, 整数型 项目数量, 整数型 动作)',
    '    调试输出(选中索引)',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    enabledModules: [basicModule, installed],
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(generated.blockingDiagnostics.length, 0);
  assert.match(cpp, /int 选中索引 = lb_value;\s+int 项目数量 = lb_range_start;\s+int 动作 = lb_range_end;/u);
  assert.match(cpp, /EU_SetTabsChangeCallback\(g_newEmojiWindow, ne_element_1, LB_NE_Event_/u);
});

test('new_emoji tabs defer page binding until page controls are created', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  let manifest: unknown;
  try {
    manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8'));
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过标签页原生生成回归测试。');
    return;
  }

  const project = JSON.parse(await fs.readFile(
    new URL('../../.lingbuilder/projects/new-emoji-92-tabs-validation/window-designer.json', import.meta.url),
    'utf8'
  )) as LingWindowProject;
  const source = await fs.readFile(
    new URL('../../src/new-emoji-92-tabs-validation/MainWindow.lcpp', import.meta.url),
    'utf8'
  );
  const basicModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const newEmojiModule: InstalledModule = {
    manifest: manifest as InstalledModule['manifest'],
    installPath: moduleRoot,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: source,
    enabledModules: [basicModule, newEmojiModule]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const controls = project.windows[0]?.controls || [];
  const tabs = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/Tabs');
  assert.ok(tabs, '验证项目必须包含主 Tabs 控件');
  const tabsMarker = cpp.split('\n').find(line => line.includes(`LB_NE_RegisterElement(`) && line.includes(`L"${tabs.name}"`));
  const tabsVariable = tabsMarker?.match(/LB_NE_RegisterElement\((ne_element_\d+),/u)?.[1];
  assert.ok(tabsVariable, '生成代码必须登记主 Tabs 控件变量');
  assert.match(cpp, new RegExp(`EU_SetTabsHeaderVisible\\(g_newEmojiWindow, ${tabsVariable}, 1\\)`));

  const page3Children = controls.filter(control => control.containerSlot === 'validation-page-03');
  const lastGeneratedPage3Child = [...page3Children].reverse().find(control =>
    cpp.split('\n').some(line => line.includes('LB_NE_RegisterElement(') && line.includes(`L"${control.name}"`))
  );
  assert.ok(lastGeneratedPage3Child, '17-24 页面至少应生成一个子控件');
  const lastChildMarker = cpp.split('\n').find(line => line.includes('LB_NE_RegisterElement(') && line.includes(`L"${lastGeneratedPage3Child.name}"`))!;
  const lastChildIndex = cpp.indexOf(lastChildMarker);
  const pageBindingIndex = cpp.indexOf(`EU_SetTabsPageElements(g_newEmojiWindow, ${tabsVariable},`);
  assert.ok(lastChildIndex >= 0 && pageBindingIndex > lastChildIndex, '标签页绑定必须晚于 17-24 页子控件创建');
  const configuredActiveIndex = Number(tabs.properties?.activeIndex ?? tabs.properties?.selectedIndex ?? 0);
  if (configuredActiveIndex > 0) {
    assert.match(cpp, new RegExp(`EU_SetTabsActive\\(g_newEmojiWindow, ${tabsVariable}, ${configuredActiveIndex}\\)`));
  } else {
    assert.doesNotMatch(cpp, new RegExp(`EU_SetTabsActive\\(g_newEmojiWindow, ${tabsVariable}, 2\\)`));
  }

  const container = controls.find(control =>
    control.containerSlot === 'validation-page-03' && control.designerType === 'lingbuilder.new_emoji.ui/Container'
  );
  assert.ok(container, '17-24 页面必须包含 Container 控件');
  const containerMarker = cpp.split('\n').find(line => line.includes('LB_NE_RegisterElement(') && line.includes(`L"${container.name}"`))!;
  const containerMarkerIndex = cpp.indexOf(containerMarker);
  const containerLayoutIndex = cpp.indexOf(`EU_SetPanelLayout(g_newEmojiWindow,`, containerMarkerIndex);
  assert.ok(containerMarkerIndex >= 0 && containerLayoutIndex > containerMarkerIndex, 'Container 创建后必须显式关闭 fill_parent 布局');
  assert.match(cpp.slice(containerLayoutIndex, containerLayoutIndex + 90), /EU_SetPanelLayout\(g_newEmojiWindow, ne_element_\d+, 0, 0\);/u);

  const byName = new Map(controls.map(control => [control.name, control]));
  assert.equal(byName.get('容器20')?.parentId, 'tabs-ne92-23-main');
  assert.equal(byName.get('链接17')?.parentId, 'tabs-ne92-20-container');
  assert.equal(byName.get('图标18')?.parentId, 'tabs-ne92-20-container');
  assert.equal(byName.get('间距19')?.parentId, 'tabs-ne92-20-container');
  const transparentLayout = byName.get('布局25');
  assert.equal(transparentLayout?.properties?.backgroundColor, 'transparent');
  const transparentLayoutMarker = transparentLayout
    ? cpp.indexOf(cpp.split('\n').find(line => line.includes('LB_NE_RegisterElement(') && line.includes(`L"${transparentLayout.name}"`)) || '')
    : -1;
  assert.ok(transparentLayoutMarker >= 0, '透明 Layout 必须进入生成的元素注册表');
  assert.match(cpp.slice(transparentLayoutMarker, transparentLayoutMarker + 700), /EU_SetElementColor\(g_newEmojiWindow, ne_element_\d+, 0x00000000u, 0xFFF8FAFCu\);/u);
  assert.deepEqual(
    ['页眉21', '侧边栏22', '主要区域23', '页脚24'].map(name => byName.get(name)?.properties?.backgroundColor),
    ['#FF151B2A', '#FF172033', '#FF111827', '#FF151B2A']
  );
  assert.match(cpp, /EU_CreateMain\(g_newEmojiWindow, ne_tab_page_1_3,[^\n]+259, 96, 897, 350\);/u);
  assert.match(cpp, /EU_CreateContainer\(g_newEmojiWindow, ne_element_\d+, 381, 32, 480, 250\);/u);
  assert.match(cpp, /EU_SetContainerLayout\(g_newEmojiWindow, ne_element_\d+, 1, 2, 12\);/u);
  assert.match(cpp, /EU_CreateLink\(g_newEmojiWindow, ne_element_\d+, [^\n]+, 0, 0, 480, 44\);/u);
  assert.match(cpp, /EU_CreateIcon\(g_newEmojiWindow, ne_element_\d+, [^\n]+, 0, 56, 480, 146\);/u);
  assert.match(cpp, /EU_CreateSpace\(g_newEmojiWindow, ne_element_\d+, 0, 214, 480, 16\);/u);
});

test('UI 后端命令契约可注册扩展并准确扫描源码调用', () => {
  const backendId = 'test-ui-backend-contract';
  registerNativeUiBackendCommandContract({
    backendId,
    displayName: '测试 UI 后端',
    supportsCommand: ({ commandName }) => commandName === '信息框',
    formatUnsupportedDiagnostic: (call, context) => `${context.commandName}@${call.line}`
  });

  assert.equal(getNativeUiBackendCommandContract(backendId)?.displayName, '测试 UI 后端');
  assert.ok(listNativeUiBackendCommandContracts().some(contract => contract.backendId === NEW_EMOJI_UI_BACKEND_ID));

  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        调试输出("字符串内的 窗口_取消关闭() 不应识别")',
    '        // 窗口_取消关闭()',
    '        信息框("正常调用", 64, "提示")',
    '        窗口_取消关闭()',
    '    结束',
    '结束类'
  ].join('\n');
  assert.deepEqual(
    collectLingCppCommandCalls(parseLingCpp(source).program, ['信息框', '窗口_取消关闭']),
    [{ name: '信息框', line: 5 }, { name: '窗口_取消关闭', line: 6 }]
  );
  assert.match(
    getUiBackendCommandDiagnostics('missing-ui-backend', parseLingCpp(source).program, [])[0]!,
    /未注册 UI 后端.*已阻止/u
  );

  const unknownBackendProject: LingWindowProject = {
    schemaVersion: 2,
    id: 'unknown-backend-project',
    name: '未知后端',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '未知后端',
      width: 640, height: 420, background: '#202020', description: '', designerBackend: 'future-ui', controls: []
    }]
  };
  const unknownBackend = generateLingCppNativeWin32Project(unknownBackendProject, { lingCppSourceCode: '类 MainWindow\n结束类' });
  assert.ok(unknownBackend.blockingDiagnostics.some(item => item.includes('未注册 UI 后端')));
  assert.ok(unknownBackend.blockingDiagnostics.some(item => item.includes('尚未注册原生 C++ 布局生成器')));
});

test('new_emoji 契约覆盖可移植 Win32 基础命令和完整窗口事件上下文', () => {
  const basicManifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.basic')!;
  const basicModule: InstalledModule = {
    manifest: basicManifest,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2,
      id: 'lingbuilder.new_emoji.ui',
      name: 'new_emoji 原生界面库',
      version: '1.0.0',
      category: '界面',
      description: '测试模块',
      targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui',
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const supportedSource = '类 MainWindow\n    事件 创建完毕()\n        调试输出(控件_取文本("编辑框1"))\n    结束\n结束类';
  const closingSource = '类 MainWindow\n    事件 关闭前()\n        窗口_取消关闭()\n    结束\n结束类';

  assert.deepEqual(
    getUiBackendCommandDiagnostics(NEW_EMOJI_UI_BACKEND_ID, parseLingCpp(supportedSource).program, [basicModule]),
    []
  );
  assert.deepEqual(
    getUiBackendCommandDiagnostics(NEW_EMOJI_UI_BACKEND_ID, parseLingCpp(closingSource).program, [basicModule]),
    []
  );

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-contract-project',
    name: 'new_emoji 命令契约',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '契约测试',
      width: 640, height: 420, background: '#111827', description: '', designerBackend: 'new-emoji', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n结束类',
    enabledModules: [basicModule, newEmojiModule]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  const bindingNames = new Set((basicManifest.bindings?.commands || []).map(binding => binding.command));
  for (const commandName of NEW_EMOJI_WIN32_BASIC_COMMANDS) {
    assert.ok(bindingNames.has(commandName), `契约命令必须存在于 Win32 基础模块 binding：${commandName}`);
    assert.ok(cpp.includes(`${commandName}(`), `new_emoji 运行时必须实现契约命令：${commandName}`);
  }

  const textModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.std.text')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const portable = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n    事件 创建完毕()\n        调试输出(文本_取长度("abc"))\n    结束\n结束类',
    enabledModules: [basicModule, textModule, newEmojiModule]
  });
  const portableCpp = portable.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.doesNotMatch(portable.blockingDiagnostics.join('\n'), /文本_取长度/u);
  assert.match(portableCpp, /int 文本_取长度\(const wchar_t\* text\)/u);
  assert.match(portableCpp, /调试输出\(文本_取长度\(L"abc"\)\);/u);

  const commonControlsModule: InstalledModule = {
    manifest: BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.common-controls')!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const blocked = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n    事件 创建完毕()\n        列表视图_添加行("列表1", "名称\\t状态")\n    结束\n结束类',
    enabledModules: [basicModule, commonControlsModule, newEmojiModule]
  });
  assert.ok(blocked.blockingDiagnostics.some(item => item.includes('列表视图_添加行') && item.includes('生成 C++ 前阻止构建')));

  const menuProject: LingWindowProject = {
    ...project,
    resources: [{
      id: 'instance-menu', type: 'PopupMenu', name: '实例菜单', ownerWindowId: 'main', targetControlId: 'main',
      items: [{ id: 'open', label: '打开', selectedHandler: '_菜单_打开' }]
    }]
  };
  const menuSource = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        弹出菜单_显示(实例菜单)',
    '    结束',
    '    事件 _菜单_打开()',
    '        调试输出("打开")',
    '    结束',
    '结束类'
  ].join('\n');
  const menuGenerated = generateLingCppNativeWin32Project(menuProject, {
    lingCppSourceCode: menuSource,
    enabledModules: [basicModule, commonControlsModule, newEmojiModule]
  });
  const menuCpp = menuGenerated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.deepEqual(menuGenerated.blockingDiagnostics, []);
  assert.deepEqual([...NEW_EMOJI_WIN32_MENU_COMMANDS], ['上下文菜单_显示', '弹出菜单_显示', '弹出菜单_在坐标显示', '菜单_取最后项目']);
  assert.match(menuCpp, /TrackPopupMenuEx\(menu, TPM_RETURNCMD \| TPM_RIGHTBUTTON/u);
  assert.match(menuCpp, /弹出菜单_显示\(L"实例菜单"\)/u);
  assert.match(menuCpp, /if \(handler == L"_菜单_打开"\)[\s\S]*调试输出\(L"打开"\)/u);
});

test('new_emoji 原生 EU binding 均衔接到导出头文件', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  try {
    await fs.access(path.join(moduleRoot, 'lingbuilder.module.json'));
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过本机模块包完整性审计。');
    return;
  }
  const manifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as {
    contributes?: { commands?: Array<{ name: string; visibility?: string }> };
    bindings?: { commands?: Array<{ command: string; runtimeName: string }> };
  };
  const headers = await Promise.all([
    fs.readFile(path.join(moduleRoot, 'include', 'new_emoji_bridge.h'), 'utf8'),
    fs.readFile(path.join(moduleRoot, 'include', 'exports.h'), 'utf8')
  ]);
  const declarations = headers.join('\n');
  const bindings = manifest.bindings?.commands || [];
  assert.ok(bindings.length > 1500, `应审计全量 new_emoji 命令，当前仅 ${bindings.length} 条`);
  const nativeCommandNames = new Set((manifest.contributes?.commands || [])
    .filter(command => command.visibility === 'advanced')
    .map(command => command.name));
  const nativeBindings = bindings.filter(binding => nativeCommandNames.has(binding.command));
  assert.equal(nativeBindings.length, 1618);
  const missing = nativeBindings.filter(binding => !declarations.includes(`${binding.runtimeName}(`));
  assert.deepEqual(missing, [], `以下 binding 未在模块头文件声明：${missing.map(item => item.command).join('、')}`);
});

test('new_emoji 设计器预览使用与原生库一致的明暗主题令牌', () => {
  const dark = getNewEmojiThemePreview('#111827');
  assert.equal(dark.mode, 'dark');
  assert.equal(dark.panelBackground, '#1E1E2E');
  assert.equal(dark.buttonBackground, '#45475A');
  assert.equal(dark.editBackground, '#313244');
  assert.equal(dark.focusBorder, '#89B4FA');

  const light = getNewEmojiThemePreview('#FFFFFF');
  assert.equal(light.mode, 'light');
  assert.equal(light.panelBackground, '#EFF1F5');
  assert.equal(light.buttonBackground, '#CCD0DA');
  assert.equal(light.editBackground, '#E6E9EF');
  assert.equal(light.focusBorder, '#1E66F5');

  assert.equal(isNewEmojiTextInputControl({ ...createControl('input', undefined, 'TextBox'), designerType: 'lingbuilder.new_emoji.ui/Input' }), true);
  assert.equal(isNewEmojiTextInputControl({ ...createControl('edit', undefined, 'TextBox'), designerType: 'lingbuilder.new_emoji.ui/EditBox' }), true);
  assert.equal(isNewEmojiTextInputControl(createControl('button', undefined, 'Button')), false);
});

test('new_emoji 模块贡献控件不会因兼容 Win32 类型产生不支持误报', () => {
  const namespacedTabs = {
    ...createControl('模块标签页', undefined, 'TabControl'),
    designerType: 'lingbuilder.new_emoji.ui/Tabs'
  };
  const unsupportedLegacy = createControl('未知旧控件', undefined, 'TabControl');
  const windowModel: LingWindowModel = {
    id: 'main',
    fileName: 'MainWindow.xml',
    className: '主窗口',
    title: '主窗口',
    width: 640,
    height: 480,
    background: '#1E1E2E',
    description: '',
    controls: [namespacedTabs, unsupportedLegacy]
  };

  assert.deepEqual(getNewEmojiUnsupportedControlDiagnostics(windowModel), [
    'new_emoji 设计器暂不支持控件“未知旧控件”(TabControl)；该控件不会被伪装成 Win32 控件生成。'
  ]);
});

test('Win32 工具箱移除上传外观控件并注册非可视文件对话框', () => {
  const upload = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Upload');
  const dragUpload = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'DragUpload');
  const fileDialog = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'FileDialog');
  assert.equal(upload, undefined);
  assert.equal(dragUpload, undefined);
  assert.ok(fileDialog);
  assert.equal(fileDialog.isVisual, false);
  assert.equal(fileDialog.moduleId, 'lingbuilder.win32.common-controls');
  assert.equal(fileDialog.nativeAdapter, 'file-dialog-resource');
  assert.deepEqual(fileDialog.events.map(event => event.name), ['FilesSelected', 'FilesDropped', 'Cancelled']);
  assert.ok(fileDialog.properties.some(property => property.key === 'multiple'));
  assert.ok(fileDialog.properties.some(property => property.key === 'allowDrop'));
});

test('Rebar 从新建入口移除但保留旧项目兼容定义', () => {
  const legacyRebar = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ReBar');
  assert.ok(legacyRebar);
  assert.equal(legacyRebar.legacyOnly, true);
  assert.equal(legacyRebar.isContainer, true);
  assert.equal(getCreatableWin32ControlDefinitions().some(definition => definition.type === 'ReBar'), false);
  assert.equal(getWin32ControlsForModule('lingbuilder.win32.common-controls').some(definition => definition.type === 'ReBar'), false);
});

test('非可视文件对话框绑定按钮和拖放目标并生成统一结果事件', () => {
  const button = { ...createControl('choose', undefined, 'Button'), name: '选择附件按钮', events: { Click: '选择附件按钮_被单击' } };
  const picture = { ...createControl('picture', undefined, 'Image'), name: '附件图片框' };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'file-dialog-resource',
    name: '文件对话框资源',
    resources: [{
      id: 'file-dialog-1', type: 'FileDialog', name: '文件对话框1', ownerWindowId: 'main',
      triggerControlId: 'choose', dropTargetId: 'picture', title: '选择附件', filter: '图片|*.png;*.jpg|所有文件|*.*',
      multiple: true, allowDrop: true, filesSelectedHandler: '文件对话框1_文件已选择',
      filesDroppedHandler: '文件对话框1_文件被拖入', cancelledHandler: '文件对话框1_选择被取消'
    }],
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '文件选择', width: 640, height: 420, background: '#202028', description: '', controls: [button, picture] }]
  };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 文件对话框1_文件已选择()
        调试输出(文件对话框_取文件(文件对话框1, 0))
    结束
    事件 文件对话框1_文件被拖入()
        调试输出(文件对话框_取文件数量(文件对话框1))
    结束
    事件 文件对话框1_选择被取消()
        调试输出("已取消")
    结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /FileDialogSpec g_fileDialogs/);
  assert.match(cpp, /L"file-dialog-1", L"文件对话框1", 0, 1001, 1002, true, true/u);
  assert.match(cpp, /HandleFileDialogTrigger\(control->id\)/);
  assert.match(cpp, /HandleFileDialogDrop\(dropPoint, droppedFiles_\)/);
  assert.match(cpp, /PtInRect\(&bounds, dropPoint\)/);
  assert.match(cpp, /UpdateFileDialogImageTarget\(dialog, accepted\)/);
  assert.match(cpp, /UpdateFileDialogImageTarget\(spec, files\)/);
  assert.match(cpp, /FOS_ALLOWMULTISELECT/);
  assert.match(cpp, /FilesSelected/);
  assert.match(cpp, /FilesDropped/);
  assert.match(cpp, /文件对话框_取文件\(L"文件对话框1", 0\)/u);
  assert.ok(!generated.diagnostics.some(diagnostic => diagnostic.includes('文件对话框')));
});

test('上下文菜单与弹出菜单作为非可视资源生成右键绑定、主动显示命令和项目事件', () => {
  const button = { ...createControl('menu-target', undefined, 'Button'), name: '菜单按钮' };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'menu-resource-project',
    name: '菜单资源项目',
    resources: [
      {
        id: 'context-menu-1', type: 'ContextMenu', name: '上下文菜单1', ownerWindowId: 'main', targetControlId: 'menu-target',
        items: [
          { id: 'open', label: '打开', enabled: true, selectedHandler: '上下文菜单1_打开被选择' },
          { id: 'separator-1', label: '', separator: true },
          { id: 'locked', label: '锁定', enabled: false, checked: true }
        ]
      },
      {
        id: 'popup-menu-1', type: 'PopupMenu', name: '弹出菜单1', ownerWindowId: 'main', targetControlId: '',
        items: [{ id: 'refresh', label: '刷新', enabled: true, selectedHandler: '弹出菜单1_刷新被选择' }]
      }
    ],
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '菜单', width: 640, height: 420, background: '#202028', description: '', controls: [button] }]
  };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 上下文菜单1_打开被选择()
        调试输出(菜单_取最后项目("上下文菜单1"))
    结束
    事件 弹出菜单1_刷新被选择()
        弹出菜单_在坐标显示("弹出菜单1", 取鼠标水平位置(), 取鼠标垂直位置())
    结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /MenuResourceSpec g_menuResources/);
  assert.match(cpp, /L"context-menu-1", L"上下文菜单1", 0, 1001, true/u);
  assert.match(cpp, /L"popup-menu-1", L"弹出菜单1", 0, 0, false/u);
  assert.match(cpp, /case WM_CONTEXTMENU/);
  assert.match(cpp, /message == WM_CONTEXTMENU && self->HandleContextMenu\(hwnd, lParam\)/);
  assert.match(cpp, /WM_CTLCOLORSCROLLBAR \|\| message == WM_CONTEXTMENU/);
  assert.match(cpp, /TrackPopupMenuEx\(menu, TPM_RETURNCMD \| TPM_RIGHTBUTTON/);
  assert.match(cpp, /AppendMenuW\(menu, MF_SEPARATOR/);
  assert.match(cpp, /上下文菜单_显示/);
  assert.match(cpp, /int 取鼠标水平位置\(\) const/u);
  assert.match(cpp, /int 取鼠标垂直位置\(\) const/u);
  assert.match(cpp, /弹出菜单_在坐标显示\(L"弹出菜单1", 取鼠标水平位置\(\), 取鼠标垂直位置\(\)\)/u);
  assert.match(cpp, /POINT point = \{ x, y \};\s+return ShowMenuResource\(\*menu, point\);/u);
  assert.doesNotMatch(cpp, /POINT point = \{ x, y \}; ClientToScreen\(hwnd_, &point\);/u);
  assert.match(cpp, /菜单_取最后项目\(L"上下文菜单1"\)/u);
  assert.match(cpp, /TextEquals\(eventName, L"open"\).*上下文菜单1_打开被选择/u);
  assert.ok(!generated.diagnostics.some(diagnostic => diagnostic.includes('菜单“')));
});

test('视频播放器注册 Media Foundation 属性、命令和原生播放生命周期', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'VideoPlayer');
  assert.ok(definition);
  assert.equal(definition.nativeAdapter, 'media-foundation-video');
  assert.deepEqual(definition.events.map(event => event.name), ['MediaOpened', 'PlaybackEnded', 'Error']);
  assert.deepEqual(definition.requiredLibraries, ['mfplat.lib', 'mfplay.lib', 'mfuuid.lib']);
  assert.equal(createDefaultControlProperties('VideoPlayer').volume, 100);

  const video = {
    ...createControl('video', undefined, 'VideoPlayer'),
    name: '视频播放器1',
    properties: { videoSource: 'assets/demo.mp4', autoPlay: true, loop: true, volume: 72 },
    events: { MediaOpened: '视频播放器1_媒体已打开', PlaybackEnded: '视频播放器1_播放完毕', Error: '视频播放器1_播放错误' }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'video-player-project',
    name: '视频播放器项目',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '视频播放', width: 760, height: 520, background: '#202028', description: '', controls: [video] }]
  };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 视频播放器1_媒体已打开()
        视频播放器_设置音量("视频播放器1", 80)
    结束
    事件 视频播放器1_播放完毕()
        调试输出("播放完毕")
    结束
    事件 视频播放器1_播放错误()
        调试输出("视频播放失败")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /#include <mfplay\.h>/);
  assert.match(cpp, /#pragma comment\(lib, "mfplay\.lib"\)/);
  assert.match(cpp, /MFPCreateMediaPlayer\(mediaUrl/);
  assert.match(cpp, /L"assets\/demo\.mp4"/);
  assert.match(cpp, /视频播放器_设置音量\(L"视频播放器1", 80\)/u);
  assert.match(cpp, /DispatchLingEvent\(\*control, L"PlaybackEnded"\)/);
  assert.match(cpp, /MFStartup\(MF_VERSION\)/);
  assert.match(cpp, /MFShutdown\(\)/);
});

test('动画控件使用 Media Foundation 播放现代编码 AVI 并保留完成与循环语义', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'Animation');
  assert.ok(definition);
  assert.equal(definition.nativeAdapter, 'media-foundation-animation');
  assert.equal(definition.nativeClass, 'STATIC');
  assert.deepEqual(definition.requiredLibraries, ['mfplat.lib', 'mfplay.lib', 'mfuuid.lib']);

  const animation = {
    ...createControl('animation', undefined, 'Animation'),
    name: '动画控件1',
    properties: { aviSource: 'assets/demo-h264.avi', autoPlay: true, loop: true },
    events: { Finished: '动画控件1_播放完毕' }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'animation-project',
    name: '动画项目',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '动画播放', width: 640, height: 480, background: '#202028', description: '', controls: [animation] }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n    事件 动画控件1_播放完毕()\n        调试输出("播放完毕")\n    结束\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"Animation"[^\n]+L"assets\/demo-h264\.avi"[^\n]+24576/u);
  assert.match(cpp, /IsType\(control, L"Animation"\) \|\| IsType\(control, L"VideoPlayer"\)/u);
  assert.match(cpp, /InitializeVideoPlayer\(runtimeControls_\.back\(\), control, control\.data/u);
  assert.doesNotMatch(cpp, /Animate_Open\(child, control\.data\)/u);
  assert.match(cpp, /if \(animation\) DispatchLingEvent\(\*control, L"Finished"\)/u);
  assert.match(cpp, /SetPosition\(MFP_POSITIONTYPE_100NS/u);
  assert.match(cpp, /AVI 播放失败/u);
  assert.match(cpp, /OutputDebugStringW\(L"LingBuilder：动画控件无法播放 AVI，请检查文件是否损坏或系统是否具备对应解码器。\\n"\);/u);
  assert.doesNotMatch(cpp, /OutputDebugStringW\(L"[^"\r\n]*[\r\n]+[^"\r\n]*"\);/u);
});

test('原生 Win32 上传控件生成文件选择、格式过滤、文件列表和拖放处理且不依赖 new_emoji', () => {
  const upload = { ...createControl('upload', undefined, 'Upload'), name: '附件上传', width: 360, height: 220, properties: { multiple: true, accept: '.pdf,.doc,.xls,.zip,.png,.jpg,.jgp', showFileList: true, showTip: true, showActions: true, limit: 12, maxSizeKb: 20480 }, events: { FilesSelected: '附件上传_文件已选择', UploadAction: '附件上传_上传操作' } };
  const dragUpload = { ...createControl('drag-upload', undefined, 'DragUpload'), name: '拖拽附件', x: 380, width: 360, height: 220, properties: { multiple: true, accept: '.pdf,.doc,.xls,.zip,.png,.jpg,.jgp', showFileList: true, showTip: true, showActions: true, dropEnabled: true }, events: { FilesSelected: '拖拽附件_文件已选择', UploadAction: '拖拽附件_上传操作' } };
  const project: LingWindowProject = { schemaVersion: 2, id: 'native-upload', name: '原生上传', windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '原生上传', width: 780, height: 520, background: '#202028', description: '', controls: [upload, dragUpload] }] };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 附件上传_文件已选择()
        调试输出(上传_取文件("附件上传", 0))
    结束
    事件 附件上传_上传操作()
        调试输出("开始上传")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /CLSID_FileOpenDialog/);
  assert.match(cpp, /FOS_ALLOWMULTISELECT/);
  assert.match(cpp, /WM_DROPFILES/);
  assert.match(cpp, /IsUploadControl/);
  assert.match(cpp, /上传_取文件\(L"附件上传", 0\)/u);
  assert.match(cpp, /L"\.pdf,\.doc,\.xls,\.zip,\.png,\.jpg,\.jgp"/u);
  assert.doesNotMatch(cpp, /new_emoji_bridge|NE_创建上传|new_emoji\.dll/u);
});

test('编辑框垂直对齐默认居中并提供顶部、居中、底部选项', () => {
  const textBox = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'TextBox');
  assert.ok(textBox);
  const verticalAlign = textBox.properties.find(property => property.key === 'verticalAlign');
  assert.ok(verticalAlign);
  assert.equal(verticalAlign.type, 'enum');
  assert.equal(verticalAlign.defaultValue, 'center');
  assert.deepEqual(verticalAlign.options?.map(option => option.value), ['top', 'center', 'bottom']);
  assert.equal(createDefaultControlProperties('TextBox').verticalAlign, 'center');

  const textAlign = textBox.properties.find(property => property.key === 'textAlign');
  assert.ok(textAlign);
  assert.deepEqual(textAlign.options, [
    { value: 'left', label: '左对齐' },
    { value: 'center', label: '居中' },
    { value: 'right', label: '右对齐' }
  ]);

  const scrollBars = textBox.properties.find(property => property.key === 'scrollBars');
  assert.deepEqual(scrollBars?.options, [
    { value: 'none', label: '无' },
    { value: 'horizontal', label: '水平' },
    { value: 'vertical', label: '垂直' },
    { value: 'both', label: '水平和垂直' }
  ]);
});

test('按钮圆角属性允许输入 0 到 100，并默认使用 6 像素', () => {
  const button = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Button');
  assert.ok(button);
  const cornerRadius = button.properties.find(property => property.key === 'cornerRadius');
  assert.ok(cornerRadius);
  assert.equal(cornerRadius.type, 'number');
  assert.equal(cornerRadius.label, '圆角大小');
  assert.equal(cornerRadius.defaultValue, 6);
  assert.equal(cornerRadius.min, 0);
  assert.equal(cornerRadius.max, 100);
  assert.equal(createDefaultControlProperties('Button').cornerRadius, 6);
});

test('圆角按钮使用实际父容器背景清理四角而不是固定使用主窗口背景', () => {
  const tab = {
    ...createControl('tabs', undefined, 'TabControl'),
    properties: { tabs: [{ id: 'page1', title: '标签页1' }], selectedIndex: 0, imageListId: '' }
  } satisfies LingControl;
  const button = {
    ...createControl('rounded-button', 'tabs', 'Button'),
    containerSlot: 'page1',
    background: '#0E84D4',
    properties: { ...createDefaultControlProperties('Button'), cornerRadius: 12 }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'rounded-button-tab-page',
    name: '选项卡圆角按钮',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#2B3139', description: '', controls: [tab, button]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /COLORREF ResolveControlSurroundingColor\(const ControlSpec& control, HWND controlHwnd\) const/u);
  assert.match(cpp, /return tabControl \? ResolveTabBackground\(\*tabControl\) : GetSysColor\(COLOR_WINDOW\);/u);
  assert.match(cpp, /COLORREF surrounding = ResolveControlSurroundingColor\(\*control, item->hwndItem\);/u);
  assert.match(cpp, /HBRUSH cornerBrush = CreateSolidBrush\(surrounding\);/u);
  assert.doesNotMatch(cpp, /HBRUSH cornerBrush = CreateSolidBrush\(spec_\.background\);/u);
});

test('ListView 设计器预览实时消费列、行、模式和网格线属性', () => {
  const listView = {
    ...createControl('records', undefined, 'ListView'),
    properties: {
      columns: [
        { title: '序号', width: 80, image: -1, alignment: 'center' },
        { title: '名称', width: 160, image: 2, alignment: 'right' }
      ],
      items: [
        { id: '1', cells: ['1', 'LingBuilder'], image: 3 },
        { id: '2', cells: ['2', '中文 IDE'], image: -1 }
      ],
      view: 'details',
      gridLines: true,
      multiple: true,
      borderColor: '#123456',
      borderWidth: 3,
      headerHeight: 34,
      itemHeight: 32
    }
  } satisfies LingControl;

  assert.deepEqual(createListViewPreviewModel(listView), {
    mode: 'details',
    gridLines: true,
    multiple: true,
    borderColor: '#123456',
    borderWidth: 3,
    headerHeight: 34,
    itemHeight: 32,
    columns: [
      { title: '序号', width: 80, image: -1, alignment: 'center' },
      { title: '名称', width: 160, image: 2, alignment: 'right' }
    ],
    rows: [
      { id: '1', cells: ['1', 'LingBuilder'], image: 3 },
      { id: '2', cells: ['2', '中文 IDE'], image: -1 }
    ]
  });

  const markup = renderToStaticMarkup(React.createElement(ListViewDesignerPreview, { control: listView }));
  assert.match(markup, /data-list-view-preview="details"/u);
  assert.match(markup, />序号</u);
  assert.match(markup, />名称</u);
  assert.match(markup, />LingBuilder</u);
  assert.match(markup, />中文 IDE</u);
  assert.match(markup, /border:3px solid #123456/u);
  assert.match(markup, /height:34px/u);
  assert.match(markup, /height:32px/u);
});

test('Header 每列文字对齐同步到设计器预览', () => {
  const header = {
    ...createControl('header-preview', undefined, 'Header'),
    properties: {
      columns: [
        { title: '左列', width: 80, image: -1, alignment: 'left' },
        { title: '中列', width: 90, image: -1, alignment: 'center' },
        { title: '右列', width: 100, image: -1, alignment: 'right' }
      ],
      imageListId: ''
    }
  } satisfies LingControl;
  const markup = renderToStaticMarkup(React.createElement(HeaderDesignerPreview, { control: header }));
  assert.match(markup, /justify-start text-left/u);
  assert.match(markup, /justify-center text-center/u);
  assert.match(markup, /justify-end text-right/u);
});

test('选项卡设计器预览使用控件文字颜色和背景颜色', () => {
  const tabControl = {
    ...createControl('tabs', undefined, 'TabControl'),
    width: 360,
    height: 240,
    background: '#1e1e24',
    foreground: '#ffffff',
    properties: {
      tabs: [
        { id: 'general', title: '常规' },
        { id: 'advanced', title: '高级' }
      ],
      selectedIndex: 1
    }
  } satisfies LingControl;

  const markup = renderToStaticMarkup(React.createElement(TabControlDesignerPreview, { control: tabControl }));
  assert.match(markup, /data-tab-control-preview="win32"/u);
  assert.match(markup, />常规</u);
  assert.match(markup, /aria-selected="true"[^>]*>.*高级/u);
  assert.match(markup, /role="tabpanel" aria-label="高级"/u);
  assert.match(markup, /background-color:#1e1e24/u);
  assert.match(markup, /color:#ffffff/u);
  assert.match(markup, /inset 0 -2px #f59e0b/u);
  assert.match(markup, /max-w-\[220px\]/u);
  assert.doesNotMatch(markup, /bg-white/u);

  const hiddenMarkup = renderToStaticMarkup(React.createElement(TabControlDesignerPreview, {
    control: { ...tabControl, properties: { ...tabControl.properties, hideHeader: true } }
  }));
  assert.match(hiddenMarkup, /data-tab-header-hidden="true"/u);
  assert.match(hiddenMarkup, /data-tab-header-hidden="true" class="min-h-0 flex-1"/u);
  assert.doesNotMatch(hiddenMarkup, /data-tab-header-hidden="true" class="[^"]*\bborder\b/u);
  assert.doesNotMatch(hiddenMarkup, /role="tablist"/u);
  assert.doesNotMatch(hiddenMarkup, />常规</u);
});

test('new_emoji Tabs 兼容旧 Grid 预览并提供稳定的独立页面槽位', () => {
  const validationPageTitles = ['01–08', '09–16', '17–24', '25–32', '33–40', '41–48', '49–56', '57–64', '65–72', '73–80', '81–88', '89–92'];
  const tabs = {
    ...createControl('new-emoji-tabs', undefined, 'Grid'),
    designerType: 'lingbuilder.new_emoji.ui/Tabs',
    width: 360,
    height: 160,
    background: 'transparent',
    foreground: '#F8FAFC',
    properties: {
      items: validationPageTitles,
      activeIndex: 1,
      headerAlign: '1',
      headerVisible: true,
      contentVisible: false
    }
  } satisfies LingControl;
  const firstPageChild = { ...createControl('page-one', tabs.id, 'Button'), containerSlot: 'page1' };
  const secondPageChild = { ...createControl('page-two', tabs.id, 'Button'), containerSlot: 'page2' };

  assert.equal(isNewEmojiTabsControl(tabs), true);
  assert.equal(isTabContainerControl(tabs), true);
  assert.deepEqual(getTabControlPages(tabs).map(page => page.title), validationPageTitles);
  assert.equal(getSelectedTabPage(tabs)?.id, 'page2');
  assert.equal(isControlOnSelectedTab([tabs, firstPageChild, secondPageChild], firstPageChild.id), false);
  assert.equal(isControlOnSelectedTab([tabs, firstPageChild, secondPageChild], secondPageChild.id), true);

  const markup = renderToStaticMarkup(React.createElement(TabControlDesignerPreview, { control: tabs }));
  assert.match(markup, /data-tab-control-preview="new-emoji"/u);
  assert.match(markup, />01–08</u);
  assert.match(markup, /aria-selected="true"[^>]*>.*09–16/u);
  assert.match(markup, />89–92</u);
  assert.match(markup, /data-tab-header-align="1"/u);
  assert.match(markup, /width:72px/u);
  assert.match(markup, /justify-content:center/u);
  assert.match(markup, /data-tab-content-container="true"/u);
  assert.match(markup, /background-color:#242941/u);

  const hiddenTabs = { ...tabs, properties: { ...tabs.properties, headerVisible: false } };
  const hiddenMarkup = renderToStaticMarkup(React.createElement(TabControlDesignerPreview, { control: hiddenTabs }));
  assert.equal(isTabControlHeaderHidden(hiddenTabs), true);
  assert.deepEqual(getTabContainerContentOffset(hiddenTabs), { x: 0, y: 0 });
  assert.match(hiddenMarkup, /data-tab-header-hidden="true"/u);
  assert.doesNotMatch(hiddenMarkup, /role="tablist"/u);
  assert.doesNotMatch(hiddenMarkup, />01–08</u);
});

test('new_emoji 17–24 预览按原生属性渲染而不伪造示意内容', () => {
  const theme = getNewEmojiThemePreview('#242941');
  const renderPreview = (kind: string, overrides: Partial<LingControl> = {}) => renderToStaticMarkup(React.createElement(NewEmojiDesignerControlPreview, {
    control: {
      ...createControl(`preview-${kind}`, undefined, 'Label'),
      designerType: `lingbuilder.new_emoji.ui/${kind}`,
      ...overrides
    },
    isEnabled: true,
    theme
  }));

  assert.equal(toNewEmojiCssColor('#80FF0000', 'transparent'), 'rgba(255, 0, 0, 0.502)');
  const linkMarkup = renderPreview('Link', { content: '链接', foreground: '#FFF8FAFC', properties: { suffixIcon: '' } });
  assert.match(linkMarkup, />链接</u);
  assert.doesNotMatch(linkMarkup, /↗/u);

  const iconMarkup = renderPreview('Icon', { content: '图标', foreground: '#FFF8FAFC', properties: { rotation: 12 } });
  assert.match(iconMarkup, />图标</u);
  assert.doesNotMatch(iconMarkup, /✦/u);

  const spaceMarkup = renderToStaticMarkup(React.createElement(NewEmojiDesignerControlPreview, {
    control: { ...createControl('preview-space'), designerType: 'lingbuilder.new_emoji.ui/Space', content: '间距' },
    isEnabled: true,
    isSelected: false,
    theme
  }));
  assert.match(spaceMarkup, /data-new-emoji-space-helper="hidden"/u);
  assert.doesNotMatch(spaceMarkup, /16px|运行时不可见/u);

  const selectedSpaceMarkup = renderToStaticMarkup(React.createElement(NewEmojiDesignerControlPreview, {
    control: { ...createControl('preview-space-selected'), designerType: 'lingbuilder.new_emoji.ui/Space', content: '间距' },
    isEnabled: true,
    isSelected: true,
    theme
  }));
  assert.match(selectedSpaceMarkup, /间距 · 运行时不可见/u);

  const containerMarkup = renderPreview('Container', {
    background: 'transparent',
    foreground: '#FFF8FAFC',
    properties: { backgroundColor: '#FFF8FAFC', borderColor: '#FFE2E8F0' }
  });
  assert.match(containerMarkup, /background-color:#F8FAFC/u);
  assert.match(containerMarkup, /border:1px solid #E2E8F0/u);
  assert.doesNotMatch(containerMarkup, /Container · 内容承载区|bg-violet|bg-cyan/u);

  const transparentLayoutMarkup = renderPreview('Layout', {
    background: 'transparent',
    foreground: '#FFF8FAFC',
    properties: { backgroundColor: 'transparent', orientation: '0', gap: 12, stretch: false, align: '0', wrap: false }
  });
  assert.match(transparentLayoutMarkup, /background-color:transparent/u);

  const whiteLayoutMarkup = renderPreview('Layout', {
    background: 'transparent',
    foreground: '#FFF8FAFC',
    properties: { backgroundColor: '#FFFFFFFF', orientation: '0', gap: 12, stretch: false, align: '0', wrap: false }
  });
  assert.match(whiteLayoutMarkup, /background-color:#FFFFFF/u);

  const headerMarkup = renderPreview('Header', {
    content: '页眉',
    foreground: '#FFF8FAFC',
    properties: { title: '页眉区域 ⬆️', align: '1', backgroundColor: '#FFB3C0D1' }
  });
  assert.match(headerMarkup, />页眉区域 ⬆️</u);
  assert.match(headerMarkup, /background-color:#B3C0D1/u);
  assert.doesNotMatch(headerMarkup, /首页|文档|关于/u);

  for (const kind of ['Aside', 'Main', 'Footer']) {
    const markup = renderPreview(kind, {
      content: kind,
      foreground: '#FFF8FAFC',
      properties: { title: `${kind} 标题`, align: '0', backgroundColor: '#FFE9EEF3' }
    });
    assert.match(markup, new RegExp(`>${kind} 标题<`, 'u'));
    assert.doesNotMatch(markup, /导航一|导航二|导航三|© LingBuilder|帮助 · 隐私 · 关于/u);
  }

  const richListMarkup = renderPreview('RichList', {
    content: '富列表',
    properties: {
      title: '构建任务',
      itemsJson: ['{"items":[{"key":"build","data":{"title":"编译 IDE"}},{"key":"test","data":{"title":"运行测试"}}]}']
    }
  });
  assert.match(richListMarkup, />构建任务</u);
  assert.match(richListMarkup, />2 项</u);
  assert.match(richListMarkup, />编译 IDE</u);
  assert.match(richListMarkup, />运行测试</u);
  assert.match(richListMarkup, />打开</u);
  assert.doesNotMatch(richListMarkup, /富列表项目/u);
});

test('选项卡注册隐藏表头属性且默认保持显示', () => {
  const tabControl = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'TabControl');
  const hideHeader = tabControl?.properties.find(property => property.key === 'hideHeader');
  assert.ok(hideHeader);
  assert.equal(hideHeader.label, '隐藏表头');
  assert.equal(hideHeader.type, 'boolean');
  assert.equal(hideHeader.defaultValue, false);
  assert.equal(createDefaultControlProperties('TabControl').hideHeader, false);
});

test('选项卡页面槽位决定设计器子控件可见性并兼容旧的无槽位控件', () => {
  const tab = {
    ...createControl('tabs', undefined, 'TabControl'),
    properties: {
      tabs: [{ id: 'page1', title: '标签页 1' }, { id: 'page2', title: '标签页 2' }],
      selectedIndex: 1
    }
  } satisfies LingControl;
  const legacyChild = createControl('legacy', 'tabs', 'Label');
  const pageTwoChild = { ...createControl('page-two', 'tabs', 'Button'), containerSlot: 'page2' };
  const nestedChild = createControl('nested', 'page-two', 'Label');
  const controls = [tab, legacyChild, pageTwoChild, nestedChild];

  assert.deepEqual(getTabControlPages(tab).map(page => page.title), ['标签页 1', '标签页 2']);
  assert.equal(getSelectedTabPage(tab)?.id, 'page2');
  assert.equal(getControlTabSlot(legacyChild, tab), 'page1');
  assert.equal(isControlOnSelectedTab(controls, 'legacy'), false);
  assert.equal(isControlOnSelectedTab(controls, 'page-two'), true);
  assert.equal(isControlOnSelectedTab(controls, 'nested'), true);

  const moved = reparentControl(controls, 'legacy', 'tabs', 'page2');
  assert.equal(moved.find(control => control.id === 'legacy')?.containerSlot, 'page2');
  assert.equal(isControlOnSelectedTab(moved, 'legacy'), true);
});

test('ListView 集合编辑模型保持列和每行单元格同步', () => {
  const columns = normalizeListViewColumns([
    { title: '序号', width: 80, image: -1, alignment: 'center' },
    { title: '标题', width: 160, image: -1, alignment: 'right' }
  ]);
  assert.deepEqual(columns.map(column => column.alignment), ['center', 'right']);
  const rows = normalizeListViewRows([
    { id: 'row1', cells: ['1', '第一条'], image: -1 },
    { id: 'row2', cells: ['2', '第二条'], image: -1 }
  ]);

  const appended = appendListViewColumn(columns, rows);
  assert.deepEqual(appended.columns.map(column => column.title), ['序号', '标题', '列 3']);
  assert.deepEqual(appended.rows.map(row => row.cells), [['1', '第一条', ''], ['2', '第二条', '']]);

  const moved = moveListViewColumn(appended.columns, appended.rows, 2, 0);
  assert.deepEqual(moved.columns.map(column => column.title), ['列 3', '序号', '标题']);
  assert.deepEqual(moved.columns.map(column => column.alignment), ['left', 'center', 'right']);
  assert.deepEqual(moved.rows.map(row => row.cells), [['', '1', '第一条'], ['', '2', '第二条']]);

  const removed = removeListViewColumn(moved.columns, moved.rows, 1);
  assert.deepEqual(removed.columns.map(column => column.title), ['列 3', '标题']);
  assert.deepEqual(removed.columns.map(column => column.alignment), ['left', 'right']);
  assert.deepEqual(removed.rows.map(row => row.cells), [['', '第一条'], ['', '第二条']]);

  const legacyShortRows = normalizeListViewRows([{ id: 'row1', cells: ['唯一值'], image: -1 }]);
  const movedLegacy = moveListViewColumn(columns, legacyShortRows, 1, 0);
  assert.deepEqual(movedLegacy.rows[0].cells, ['', '唯一值'], '旧项目缺少的单元格应先补空再移动列');
});

test('TreeView 集合编辑模型支持子树增删复制、排序和换父级', () => {
  let nodes = normalizeTreeViewNodes([
    { id: 'root', title: '根节点', expanded: true, children: [{ id: 'child', title: '子节点' }] },
    { id: 'second', title: '第二根节点' }
  ]);
  assert.deepEqual(flattenTreeViewNodes(nodes).map(item => [item.node.id, item.parentId, item.depth]), [
    ['root', undefined, 0], ['child', 'root', 1], ['second', undefined, 0]
  ]);
  assert.equal(nodes[0].expanded, true);
  assert.equal(nodes[0].children[0].expanded, false, '旧节点未声明展开状态时应默认折叠');

  const appended = appendTreeViewNode(nodes, 'child');
  nodes = updateTreeViewNode(appended.nodes, appended.nodeId, { title: '孙节点' });
  assert.equal(flattenTreeViewNodes(nodes).find(item => item.node.id === appended.nodeId)?.node.title, '孙节点');

  const duplicate = duplicateTreeViewNode(nodes, 'root');
  nodes = duplicate.nodes;
  assert.ok(duplicate.nodeId);
  assert.equal(flattenTreeViewNodes(nodes).filter(item => item.node.title === '子节点').length, 2);
  assert.equal(new Set(flattenTreeViewNodes(nodes).map(item => item.node.id)).size, flattenTreeViewNodes(nodes).length);

  nodes = moveTreeViewNode(nodes, 'second', -1);
  assert.equal(nodes[1].id, 'second', '同级上移一次应越过前一个兄弟节点');
  nodes = reparentTreeViewNode(nodes, 'second', 'child');
  assert.equal(flattenTreeViewNodes(nodes).find(item => item.node.id === 'second')?.parentId, 'child');
  assert.deepEqual(reparentTreeViewNode(nodes, 'root', appended.nodeId), nodes, '不能把父节点移动到自己的后代中');

  nodes = deleteTreeViewNode(nodes, 'root');
  assert.equal(flattenTreeViewNodes(nodes).some(item => item.node.id === 'child'), false, '删除父节点必须同时删除整棵子树');
});

test('TreeView 节点编辑器显示并恢复默认展开属性', () => {
  const markup = renderToStaticMarkup(React.createElement(TreeViewCollectionDialog, {
    controlName: '树形视图1',
    value: [{ id: 'root', title: '根节点', expanded: true, children: [{ id: 'child', title: '子节点' }] }],
    showImages: false,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(markup, />默认展开节点</u);
  assert.match(markup, /type="checkbox"[^>]*checked=""/u);
});

test('TreeView 注册边框与节点间距属性并提供稳定默认值', () => {
  const treeView = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'TreeView');
  const properties = Object.fromEntries((treeView?.properties || []).map(property => [property.key, property]));
  assert.deepEqual(
    ['borderWidth', 'borderColor', 'nodeSpacing', 'nodePadding'].map(key => properties[key]?.defaultValue),
    [1, '#64748B', 2, 3]
  );
  assert.deepEqual([properties.borderWidth?.min, properties.borderWidth?.max], [0, 8]);
  assert.deepEqual([properties.nodeSpacing?.min, properties.nodeSpacing?.max], [0, 24]);
  assert.deepEqual([properties.nodePadding?.min, properties.nodePadding?.max], [0, 24]);
});

test('ListView 视图模式使用中文标签并保留稳定的原生枚举值', () => {
  const listView = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ListView');
  const view = listView?.properties.find(property => property.key === 'view');
  assert.deepEqual(view?.options, [
    { value: 'icon', label: '大图标' },
    { value: 'smallIcon', label: '小图标' },
    { value: 'list', label: '列表' },
    { value: 'details', label: '详细信息' }
  ]);
  const properties = new Map(listView?.properties.map(property => [property.key, property]));
  assert.equal(properties.get('borderColor')?.defaultValue, '#64748B');
  assert.deepEqual(
    ['borderWidth', 'headerHeight', 'itemHeight'].map(key => {
      const property = properties.get(key);
      return [key, property?.defaultValue, property?.min, property?.max];
    }),
    [
      ['borderWidth', 1, 0, 8],
      ['headerHeight', 28, 16, 96],
      ['itemHeight', 28, 16, 96]
    ]
  );
});

test('ListView 表格粘贴支持 Excel TSV、追加行和替换数据', () => {
  const matrix = parseListViewTabularText('1\t第一条\r\n2\t第二条\r\n');
  assert.deepEqual(matrix, [['1', '第一条'], ['2', '第二条']]);
  assert.deepEqual(parseListViewTabularText('3,\"标题,包含逗号\"\r\n'), [['3', '标题,包含逗号']]);

  const existing = normalizeListViewRows([{ id: 'row1', cells: ['', ''], image: -1 }]);
  const pasted = applyListViewCellMatrix(existing, 2, 0, 0, matrix);
  assert.deepEqual(pasted.map(row => row.cells), [['1', '第一条'], ['2', '第二条']]);
  assert.equal(new Set(pasted.map(row => row.id)).size, 2);

  const replaced = replaceListViewRowsFromMatrix(pasted, 2, [['3', '第三条']]);
  assert.deepEqual(replaced.map(row => row.cells), [['3', '第三条']]);
  assert.equal(replaced[0].id, 'row1', '替换数据时应尽量保留已有内部行标识');
});

test('ListView 数据编辑窗口按真实列生成单元格且隐藏行 ID 输入', () => {
  const markup = renderToStaticMarkup(React.createElement(ListViewCollectionDialog, {
    kind: 'rows',
    controlName: '数据列表',
    columnsValue: [{ title: '序号', width: 80, image: -1 }, { title: '标题', width: 160, image: -1 }],
    rowsValue: [{ id: 'internal-row-1', cells: ['1', '第一条'], image: -1 }],
    showImages: false,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));

  assert.match(markup, /编辑 ListView 数据/u);
  assert.match(markup, /批量粘贴/u);
  assert.match(markup, /第 1 行，序号/u);
  assert.match(markup, /第 1 行，标题/u);
  assert.match(markup, /value="第一条"/u);
  assert.doesNotMatch(markup, /internal-row-1/u);

  const columnMarkup = renderToStaticMarkup(React.createElement(ListViewCollectionDialog, {
    kind: 'columns',
    controlName: '数据列表',
    columnsValue: [
      { title: '序号', width: 80, image: -1, alignment: 'center' },
      { title: '金额', width: 160, image: -1, alignment: 'right' }
    ],
    rowsValue: [],
    showImages: false,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(columnMarkup, /第 1 列对齐方式/u);
  assert.match(columnMarkup, /第 2 列对齐方式/u);
  assert.match(columnMarkup, /<option value="center" selected="">居中<\/option>/u);
  assert.match(columnMarkup, /<option value="right" selected="">右对齐<\/option>/u);
  assert.doesNotMatch(columnMarkup, /第 1 列对齐方式" disabled/u);

  const headerColumnMarkup = renderToStaticMarkup(React.createElement(ListViewCollectionDialog, {
    kind: 'columns',
    columnOwner: 'header',
    controlName: '主表头',
    columnsValue: [{ title: '标题', width: 120, image: -1, alignment: 'left' }],
    rowsValue: [],
    showImages: false,
    isDarkMode: true,
    onChange: () => undefined,
    onClose: () => undefined
  }));
  assert.match(headerColumnMarkup, /编辑表头列/u);
  assert.match(headerColumnMarkup, /主表头/u);
  assert.match(headerColumnMarkup, />1 列</u);
  assert.doesNotMatch(headerColumnMarkup, /1 列 · 0 行/u);
});

test('无版本设计器项目迁移为 v2 并保留旧字段', () => {
  const legacyProject: LingWindowProject = {
    id: 'legacy', name: '旧项目', windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [{ ...createControl('progress', undefined, 'ProgressBar'), content: '38' }]
    }]
  };
  const state = normalizeWindowDesignerState({ project: legacyProject, activeWindowId: 'main', selectedControlId: 'progress' });
  assert.equal(state.project.schemaVersion, 2);
  assert.equal(state.project.windows[0].controls[0].content, '38');
  assert.equal(state.project.windows[0].controls[0].properties?.value, 38);
  assert.equal(state.project.windows[0].titleBarBackground, '#2D2D30');
  assert.equal(state.project.windows[0].titleBarForeground, '#CBD5E1');
  assert.equal(state.project.windows[0].menuBackground, '#ffffff');
  assert.equal(state.project.windows[0].menuForeground, '#000000');
  assert.equal(state.project.windows[0].menuFontFamily, 'Microsoft YaHei UI');
  assert.equal(state.project.windows[0].menuFontSize, 11);
  assert.equal(state.project.windows[0].menuFontBold, false);
  assert.equal(state.project.windows[0].cornerStyle, 'rounded');
  assert.equal(state.project.windows[0].iconStyle, 'lingbuilder');
  assert.equal(state.project.windows[0].resizable, true);
  assert.equal(state.project.windows[0].maximizable, true);
  assert.match(generateWindowXml(state.project.windows[0]), /标题栏颜色="#2D2D30"/u);
  assert.match(generateWindowXml(state.project.windows[0]), /窗口圆角="rounded"/u);
  assert.match(generateWindowXml(state.project.windows[0]), /禁止拖拽调整大小="否"/u);
  assert.match(generateWindowXml(state.project.windows[0]), /禁止窗口最大化="否"/u);
});

test('new_emoji 命名空间控件迁移时补齐窗口设计后端', () => {
  const project: LingWindowProject = {
    id: 'legacy-new-emoji', name: '旧 new_emoji 项目', windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#1f2937', description: '', controls: [{
        ...createControl('editor', undefined, 'TextBox'),
        designerType: 'lingbuilder.new_emoji.ui/EditBox'
      }]
    }]
  };
  const state = normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: null });
  assert.equal(state.project.windows[0].designerBackend, 'new-emoji');
});

test('窗口设计器自动保存缓存按 projectId 隔离并兼容旧键迁移', () => {
  const values = new Map<string, string>();
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); }
      },
      dispatchEvent: () => true
    }
  });
  try {
    const createProject = (id: string, controlId: string): LingWindowProject => ({
      schemaVersion: 2,
      id,
      name: id,
      resources: [],
      windows: [{
        id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: id, width: 640, height: 480,
        background: '#1f2937', description: '', controls: [createControl(controlId, undefined, 'Button')]
      }]
    });
    const first = createProject('project-a', 'button-a');
    const second = createProject('project-b', 'button-b');
    saveWindowDesignerState({ project: first, activeWindowId: 'main', selectedControlId: 'button-a' });
    saveWindowDesignerState({ project: second, activeWindowId: 'main', selectedControlId: 'button-b' });

    assert.equal(readWindowDesignerState('project-a').project.windows[0].controls[0].id, 'button-a');
    assert.equal(readWindowDesignerState('project-b').project.windows[0].controls[0].id, 'button-b');
    assert.ok(values.has(getWindowDesignerAutosaveKey('project-a')));
    assert.ok(values.has(getWindowDesignerAutosaveKey('project-b')));
  } finally {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});

test('窗口大小与最大化限制进入布局 XML 和 Win32 样式', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'fixed-window',
    name: '固定窗口',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '固定窗口', width: 640, height: 480,
      background: '#202028', description: '', resizable: false, maximizable: false, controls: []
    }]
  };
  const window = project.windows[0];
  const xml = generateWindowXml(window);
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(xml, /禁止拖拽调整大小="是"/u);
  assert.match(xml, /禁止窗口最大化="是"/u);
  // resizable=false 无 borderStyle 的旧项目由生成器迁移为 normal-fixed(2)，样式计算统一走边框辅助函数
  assert.match(cpp, /DWORD windowStyle = LB_WindowBorderStyleToDwStyle\(spec_\.borderStyle, spec_\.maximizable\) \| WS_CLIPCHILDREN \| WS_CLIPSIBLINGS;/u);
  assert.match(cpp, /if \(borderStyle != 0 && !maximizable\) style &= ~WS_MAXIMIZEBOX;/u);
  assert.match(cpp, /CW_USEDEFAULT, CW_USEDEFAULT, false, false, 2, false, g_controls_0/u);
});

test('窗口外观与 ListView 深色配色进入同一份 Win32 生成结果', () => {
  const listView = {
    ...createControl('list', undefined, 'ListView'),
    background: 'transparent',
    foreground: '#E2E8F0',
    properties: {
      columns: [{ title: '名称', width: 160, image: -1, alignment: 'left' }],
      items: [{ id: 'row1', cells: ['LingBuilder'], image: -1 }],
      view: 'details',
      gridLines: true,
      multiple: false,
      imageListId: ''
    }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'window-appearance',
    name: '窗口外观',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '外观窗口', width: 640, height: 480,
      background: '#1F2937', titleBarBackground: '#123456', titleBarForeground: '#FEDCBA', menuBackground: '#4a148c', menuForeground: '#E2E8F0',
      cornerStyle: 'small-rounded', iconStyle: 'lingbuilder', description: '', controls: [listView]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /DwmSetWindowAttributeFunction/u);
  assert.match(cpp, /const DWORD captionColor = 35/u);
  assert.match(cpp, /const DWORD textColor = 36/u);
  assert.doesNotMatch(cpp, /ApplyFallbackWindowRegion/u);
  assert.doesNotMatch(cpp, /usesFallbackWindowRegion_/u);
  assert.match(cpp, /CreateLingBuilderWindowIcon/u);
  assert.match(cpp, /WM_SETICON/u);
  assert.match(cpp, /RGB\(18, 52, 86\), RGB\(254, 220, 186\), 3, L"lingbuilder"/u);
  assert.match(cpp, /MIM_BACKGROUND/u);
  assert.match(cpp, /MF_POPUP \| MF_OWNERDRAW/u);
  assert.match(cpp, /SetTextColor\(item->hDC, spec_\.menuForeground\)/u);
  assert.match(cpp, /MF_OWNERDRAW, 50000 \+ index/u);
  assert.match(cpp, /case WM_NCPAINT/u);
  assert.match(cpp, /PaintMenuBarBackground/u);
  assert.match(cpp, /ClientToScreen\(hwnd_, &clientOrigin\)/u);
  assert.match(cpp, /barRect\.bottom = std::max\(barRect\.bottom, clientOrigin\.y - windowRect\.top\)/u);
  assert.match(cpp, /L"", RGB\(74, 20, 140\), RGB\(226, 232, 240\), L"Microsoft YaHei UI", 11, false, false, false, L""/u);
  assert.match(cpp, /SelectObject\(item->hDC, menuFont_\)/u);
  assert.match(cpp, /SelectObject\(hdc, menuFont_\)/u);
  assert.match(cpp, /L"ListView"[^\n]+RGB\(15, 23, 42\), true, RGB\(226, 232, 240\)/u);
  assert.match(cpp, /ListView_SetBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextColor\(child, control\.foreground\)/u);
  assert.match(cpp, /PaintListViewHeader/u);
  assert.match(cpp, /CDRF_NOTIFYPOSTPAINT/u);
  assert.match(cpp, /Header_GetItemRect/u);
  assert.match(cpp, /CDRF_SKIPDEFAULT/u);
});

test('自定义 ICO 路径进入设计器结构与 Win32 大小图标加载链路', () => {
  const window: LingWindowModel = {
    id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '自定义图标窗口', width: 640, height: 480,
    background: '#1F2937', iconStyle: 'custom', iconPath: 'assets/demo/应用.ico', description: '', controls: []
  };
  const project: LingWindowProject = { schemaVersion: 2, id: 'demo', name: '图标项目', windows: [window] };
  const result = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' });
  const cpp = result.files.find(file => file.relativePath === 'main.cpp')!.content;
  const resource = result.files.find(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)?.content || '';

  assert.equal(result.diagnostics.some(message => message.includes('自定义图标必须')), false);
  assert.match(generateWindowXml(window), /窗口图标="custom" 窗口图标文件="assets\/demo\/应用\.ico"/u);
  assert.match(cpp, /L"custom", L"assets\/demo\/应用\.ico"/u);
  assert.match(cpp, /LoadImageW\(nullptr, spec_\.iconPath, IMAGE_ICON/u);
  assert.match(cpp, /SM_CXICON/u);
  assert.match(cpp, /SM_CXSMICON/u);
  assert.match(resource, /IDI_LINGBUILDER_APP ICON "resources\/lingbuilder-app\.ico"/u);

  const unsafeResult = generateLingCppNativeWin32Project({
    ...project,
    windows: [{ ...window, iconPath: 'C:\\Users\\demo\\应用.ico' }]
  }, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' });
  assert.ok(unsafeResult.diagnostics.some(message => message.includes('assets 目录内的相对 ICO 路径')));
  assert.ok(unsafeResult.blockingDiagnostics.some(message => message.includes('assets 目录内的相对 ICO 路径')));
  assert.equal(unsafeResult.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE), false);
  assert.doesNotMatch(unsafeResult.files.find(file => file.relativePath === 'main.cpp')!.content, /C:\\\\Users/u);
});

test('LingBuilder 默认窗口图标生成 EXE 资源并物化为可移植 ICO', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-exe-icon-'));
  const bundledIcon = fileURLToPath(new URL('../../image/lingbuilder-ide-icon-v2.ico', import.meta.url));
  const projectRef = {
    id: 'demo', name: '图标项目', type: 'visual-cpp' as const, sourceRoot: 'src/demo', configRoot: 'config/demo',
    designerPath: '.lingbuilder/projects/demo/window-designer.json', isDefault: false
  };
  const window: LingWindowModel = {
    id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '默认图标窗口', width: 640, height: 480,
    background: '#1F2937', iconStyle: 'lingbuilder', description: '', controls: []
  };
  const generated = generateLingCppNativeWin32Project(
    { schemaVersion: 2, id: projectRef.id, name: projectRef.name, windows: [window] },
    { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }
  );
  const resource = generated.files.find(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE);
  assert.ok(resource);

  const outputRoot = path.join(root, 'generated');
  const service = createWindowsExecutableIconService(root, createDesignerAssetService(root), bundledIcon);
  const materialized = await service.materialize(projectRef, generated.selectedWindow, [outputRoot]);
  const target = path.join(outputRoot, WINDOWS_EXECUTABLE_ICON_FILE);
  assert.equal(materialized.source, 'lingbuilder');
  assert.equal(materialized.fingerprint.length, 64);
  assert.deepEqual(await fs.readFile(target), await fs.readFile(bundledIcon));

  const customIconPath = path.join(root, 'assets', 'demo', '应用.ico');
  await fs.mkdir(path.dirname(customIconPath), { recursive: true });
  await fs.copyFile(bundledIcon, customIconPath);
  const customOutputRoot = path.join(root, 'custom-generated');
  const customIcon = await service.materialize(projectRef, {
    ...window,
    iconStyle: 'custom',
    iconPath: 'assets/demo/应用.ico'
  }, [customOutputRoot]);
  assert.equal(customIcon.source, 'custom');
  assert.deepEqual(
    await fs.readFile(path.join(customOutputRoot, WINDOWS_EXECUTABLE_ICON_FILE)),
    await fs.readFile(customIconPath)
  );

  const noIcon = await service.materialize(projectRef, { ...window, iconStyle: 'none' }, [outputRoot]);
  assert.equal(noIcon.source, 'none');
  await assert.rejects(() => fs.stat(target), /ENOENT/u);
});

test('标签页中的透明标签在 Win32 运行时继承实际父容器背景', () => {
  const tabControl = {
    ...createControl('tabs', undefined, 'TabControl'),
    name: '选项卡1',
    width: 360,
    height: 240,
    background: 'transparent',
    properties: { tabs: [{ id: 'page1', title: '标签页 1' }], selectedIndex: 0 }
  } satisfies LingControl;
  const label = {
    ...createControl('label', 'tabs', 'Label'),
    name: '标签2',
    content: '新文本标签',
    x: 24,
    y: 52,
    width: 180,
    height: 32,
    background: 'transparent',
    foreground: '#000000',
    containerSlot: 'page1'
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'transparent-label',
    name: '透明标签',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '透明标签', width: 640, height: 480,
      background: '#1E1E24', description: '', controls: [tabControl, label]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /bool backgroundTransparent;/u);
  assert.match(cpp, /L"Label", L"标签2", L"新文本标签"[^\n]+RGB\(30, 30, 36\), true, RGB\(0, 0, 0\), true/u);
  assert.match(cpp, /HBRUSH ResolveControlSurroundingBrush\(const ControlSpec& control, HWND controlHwnd\) const/u);
  assert.match(cpp, /const RuntimeControl\* FindRuntimeControl\(int id\) const/u);
  assert.match(cpp, /const RuntimeControl\* parent = FindRuntimeControl\(control\.parentId\);/u);
  assert.match(cpp, /if \(!tabControl \|\| tabControl->backgroundTransparent\) return GetSysColorBrush\(COLOR_WINDOW\);/u);
  assert.match(cpp, /return tabControl \? ResolveTabBackground\(\*tabControl\) : GetSysColor\(COLOR_WINDOW\);/u);
  assert.match(cpp, /message == WM_CTLCOLORSTATIC && control->backgroundTransparent/u);
  assert.match(cpp, /IsType\(\*control, L"Label"\) \|\| IsType\(\*control, L"SysLink"\)/u);
  assert.match(cpp, /SetBkMode\(hdc, TRANSPARENT\);/u);
  assert.match(cpp, /ResolveControlSurroundingBrush\(\*control, child\)/u);
});

test('副窗口和嵌套容器中的透明超链接跟随实际父级背景', () => {
  const rootLink = {
    ...createControl('root-link', undefined, 'SysLink'),
    name: '副窗口链接',
    content: '打开帮助',
    background: 'transparent',
    properties: { url: 'https://lingbuilder.example/help' }
  } satisfies LingControl;
  const container = {
    ...createControl('container', undefined, 'Grid'),
    name: '链接容器',
    background: '#334455'
  } satisfies LingControl;
  const nestedLink = {
    ...createControl('nested-link', 'container', 'SysLink'),
    name: '容器链接',
    content: '容器链接',
    background: 'transparent',
    properties: { url: 'https://lingbuilder.example/container' }
  } satisfies LingControl;
  const tabs = {
    ...createControl('tabs', undefined, 'TabControl'),
    name: '链接选项卡',
    background: '#112233',
    properties: { tabs: [{ id: 'page1', title: '链接页' }], selectedIndex: 0 }
  } satisfies LingControl;
  const tabLink = {
    ...createControl('tab-link', 'tabs', 'SysLink'),
    name: '选项卡链接',
    content: '选项卡链接',
    background: 'transparent',
    containerSlot: 'page1',
    properties: { url: 'https://lingbuilder.example/tab' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'transparent-syslink',
    name: '透明超链接',
    windows: [
      { id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#1E1E24', description: '', controls: [] },
      { id: 'secondary', fileName: 'SecondaryWindow.xml', className: '副窗口', title: '副窗口', width: 560, height: 420, background: '#556677', description: '', controls: [rootLink, container, nestedLink, tabs, tabLink] }
    ]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'secondary',
    lingCppSourceCode: '类 副窗口 : 公开 窗体\n结束类',
    lingCppSourceFilePath: 'src/SecondaryWindow.lcpp'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"SysLink", L"副窗口链接", L"打开帮助"[^\n]+RGB\(85, 102, 119\), true/u);
  assert.match(cpp, /if \(control\.backgroundTransparent\) style \|= LWS_TRANSPARENT;/u);
  assert.match(cpp, /void PaintTransparentSysLink\(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime\)/u);
  assert.match(cpp, /FillRect\(hdc, &clientRect, ResolveControlSurroundingBrush\(control, hwnd\)\);/u);
  assert.match(cpp, /IsType\(\*control, L"SysLink"\) && control->backgroundTransparent/u);
  assert.match(cpp, /self->PaintTransparentSysLink\(hwnd, hdc, \*control, \*runtime\);/u);
  assert.match(cpp, /self->PaintTransparentSysLink\(hwnd, reinterpret_cast<HDC>\(wParam\), \*control, \*runtime\);/u);
  assert.match(cpp, /IsType\(\*control, L"Label"\) \|\| IsType\(\*control, L"SysLink"\)/u);
  assert.match(cpp, /return spec_\.background;/u);
  assert.match(cpp, /if \(!parent->backgroundTransparent\) return parent->background;/u);
  assert.match(cpp, /return tabControl \? ResolveTabBackground\(\*tabControl\) : GetSysColor\(COLOR_WINDOW\);/u);
  assert.match(cpp, /ResolveControlSurroundingBrush\(\*control, child\)/u);
});

test('透明复选框和单选框的 Win32 自绘背景继承实际父容器', () => {
  const tabControl = {
    ...createControl('tabs', undefined, 'TabControl'),
    name: '选项卡1',
    width: 360,
    height: 240,
    background: '#112233',
    properties: { tabs: [{ id: 'page1', title: '标签页 1' }], selectedIndex: 0 }
  } satisfies LingControl;
  const transparentCheckBox = {
    ...createControl('check', 'tabs', 'CheckBox'),
    name: '透明复选框',
    content: '透明复选框',
    background: 'transparent',
    containerSlot: 'page1'
  } satisfies LingControl;
  const transparentRadioButton = {
    ...createControl('radio', 'tabs', 'RadioButton'),
    name: '透明单选框',
    content: '透明单选框',
    background: 'transparent',
    containerSlot: 'page1'
  } satisfies LingControl;
  const solidCheckBox = {
    ...createControl('solid-check', 'tabs', 'CheckBox'),
    name: '实色复选框',
    content: '实色复选框',
    background: '#445566',
    containerSlot: 'page1'
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'transparent-selection-controls',
    name: '透明选择控件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '透明选择控件', width: 640, height: 480,
      background: '#1E1E24', description: '', controls: [tabControl, transparentCheckBox, transparentRadioButton, solidCheckBox]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"CheckBox", L"透明复选框", L"透明复选框"[^\n]+true, RGB/u);
  assert.match(cpp, /L"RadioButton", L"透明单选框", L"透明单选框"[^\n]+true, RGB/u);
  assert.match(cpp, /L"CheckBox", L"实色复选框", L"实色复选框"[^\n]+RGB\(68, 85, 102\), false, RGB/u);
  assert.match(cpp, /COLORREF rowBackground = control->backgroundTransparent \? surrounding : control->background;/u);
  assert.match(cpp, /if \(!control->backgroundTransparent\) rowBackground = background;/u);
  assert.match(cpp, /return ResolveControlSurroundingColor\(\*parent, parentRuntime \? parentRuntime->hwnd : nullptr\);/u);
  assert.match(cpp, /return ResolveControlSurroundingBrush\(\*parentSpec, parent \? parent->hwnd : nullptr\);/u);
});

test('窗口本身的空选择和虚拟菜单选择在规范化后保持不变', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'selection',
    name: '选择测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [createControl('first')]
    }]
  };

  assert.equal(normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: null }).selectedControlId, null);
  assert.equal(normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: '__window_menu_bar__' }).selectedControlId, '__window_menu_bar__');
  assert.equal(normalizeWindowDesignerState({ project, activeWindowId: 'main', selectedControlId: 'missing' }).selectedControlId, 'first');
});

test('高级控件生成真实 Win32 类、专属数据和多事件通知', () => {
  const controls: LingControl[] = [
    { ...createControl('list', undefined, 'ListView'), properties: { columns: [{ title: '名称', width: 160, alignment: 'center' }, { title: '状态', width: 90, alignment: 'right' }], items: [{ id: 'row1', cells: ['服务', '运行中'], image: 0 }], view: 'details', gridLines: true, multiple: false, borderColor: '#123456', borderWidth: 3, headerHeight: 34, itemHeight: 32, imageListId: 'main-icons' }, events: { SelectionChanged: '_列表_选择项被改变', DoubleClick: '_列表_被双击' } },
    { ...createControl('tree', undefined, 'TreeView'), properties: { nodes: [{ id: 'root', title: '根节点', expanded: true, children: [{ id: 'child', title: '子节点' }] }], borderWidth: 3, borderColor: '#123456', nodeSpacing: 7, nodePadding: 5, showLines: true, checkBoxes: true, imageListId: 'main-icons' }, events: { Expanded: '_树_节点被展开' } },
    { ...createControl('header', undefined, 'Header'), background: '#111111', foreground: '#FFFFFF', properties: { columns: [{ title: '编号', width: 120, image: -1, alignment: 'left' }, { title: '名称', width: 160, image: -1, alignment: 'center' }, { title: '状态', width: 100, image: -1, alignment: 'right' }], imageListId: '' } },
    { ...createControl('date', undefined, 'DateTimePicker'), background: '#123456', foreground: '#FEDCBA', properties: createDefaultControlProperties('DateTimePicker') },
    { ...createControl('calendar', undefined, 'MonthCalendar'), background: '#102030', foreground: '#E0D0C0', properties: createDefaultControlProperties('MonthCalendar') }
  ];
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'advanced', name: '高级控件', resources: [{ id: 'main-icons', type: 'ImageList', name: '主图标', imageWidth: 20, imageHeight: 20, images: ['assets/ok.png'] }], windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 800, height: 600,
      background: '#202028', description: '', controls, menuItems: ''
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /WC_LISTVIEWW/);
  assert.match(cpp, /WC_TREEVIEWW/);
  assert.match(cpp, /DATETIMEPICK_CLASSW/);
  assert.match(cpp, /MONTHCAL_CLASSW/);
  assert.match(cpp, /HDS_BUTTONS \| HDS_HOTTRACK \| HDS_HORZ \| CCS_NOPARENTALIGN \| CCS_NOMOVEY \| CCS_NORESIZE/u);
  assert.match(cpp, /L"Header"[^\n]+RGB\(17, 17, 17\), false, RGB\(255, 255, 255\)/u);
  assert.match(cpp, /DecodeControlRecords\(control.data, 4\)/u);
  assert.match(cpp, /rows\[index\]\[3\] == L"center" \? HDF_CENTER : rows\[index\]\[3\] == L"right" \? HDF_RIGHT : HDF_LEFT/u);
  assert.match(cpp, /6:center/u);
  assert.match(cpp, /5:right/u);
  assert.match(cpp, /LRESULT PaintStandaloneHeader/u);
  assert.match(cpp, /PaintHeader\(control, draw, false\)/u);
  assert.match(cpp, /IsType\(\*control, L"Header"\) && header->code == NM_CUSTOMDRAW/u);
  assert.match(cpp, /draw->uItemState & CDIS_SELECTED/u);
  assert.match(cpp, /draw->uItemState & CDIS_HOT/u);
  assert.match(cpp, /OffsetRect\(&textRect, ScaleForDpi\(1, dpi_\), ScaleForDpi\(1, dpi_\)\)/u);
  assert.match(cpp, /SetTextColor\(draw->hdc, textColor\)/u);
  assert.match(cpp, /L"DateTimePicker"[^\n]+RGB\(18, 52, 86\), false, RGB\(254, 220, 186\)/u);
  assert.match(cpp, /L"MonthCalendar"[^\n]+RGB\(16, 32, 48\), false, RGB\(224, 208, 192\)/u);
  assert.match(cpp, /void ApplyMonthCalendarColors\(HWND calendar, const ControlSpec& control\)/u);
  assert.match(cpp, /SetWindowTheme\(calendar, L"", L""\)/u);
  assert.match(cpp, /MCM_SETCOLOR, MCSC_MONTHBK, static_cast<LPARAM>\(control.background\)/u);
  assert.match(cpp, /MCM_SETCOLOR, MCSC_TITLETEXT, static_cast<LPARAM>\(control.foreground\)/u);
  assert.match(cpp, /void PaintDateTimePicker\(HWND hwnd, HDC hdc, const ControlSpec& control, RuntimeControl& runtime\)/u);
  assert.match(cpp, /DrawTextW\(hdc, text, -1, &textRect, DT_LEFT \| DT_VCENTER \| DT_SINGLELINE \| DT_END_ELLIPSIS \| DT_NOPREFIX\)/u);
  assert.match(cpp, /IsType\(\*control, L"DateTimePicker"\) && header->code == DTN_DROPDOWN/u);
  assert.match(cpp, /ApplyDateTimePickerCalendarAppearance\(header->hwndFrom, \*control\)/u);
  assert.match(cpp, /PostMessageW\(hwnd_, WM_LINGBUILDER_LAYOUT_DATE_PICKER, static_cast<WPARAM>\(control->id\), 0\)/u);
  assert.match(cpp, /MCM_GETMINREQRECT/u);
  assert.match(cpp, /MCM_GETMAXTODAYWIDTH/u);
  assert.match(cpp, /HWND dropDown = GetParent\(calendar\)/u);
  assert.match(cpp, /GetWindowInfo\(dropDown, &dropDownInfo\)/u);
  assert.match(cpp, /AdjustWindowRectEx\(&requiredDropDown, dropDownInfo\.dwStyle, FALSE, dropDownInfo\.dwExStyle\)/u);
  assert.match(cpp, /std::clamp\(\s*static_cast<int>\(dropDownRect\.left\)/u);
  assert.match(cpp, /SetWindowPos\(dropDown, HWND_TOP, x, y, dropDownWidth, dropDownHeight,/u);
  assert.match(cpp, /SetWindowPos\(calendar, nullptr, padding, padding, calendarWidth, calendarHeight,/u);
  assert.match(cpp, /SelectionChanged=_列表_选择项被改变\\nDoubleClick=_列表_被双击/);
  assert.match(cpp, /case WM_NOTIFY/);
  assert.match(cpp, /DecodeControlRecords/);
  assert.match(cpp, /ListView_InsertColumn/);
  assert.match(cpp, /ListView_SetItemText/);
  assert.match(cpp, /LVCF_FMT/);
  assert.match(cpp, /LVCFMT_CENTER/);
  assert.match(cpp, /LVCFMT_RIGHT/);
  assert.match(cpp, /6:center/);
  assert.match(cpp, /5:right/);
  assert.match(cpp, /L"ListView"[^\n]+, 3, RGB\(18, 52, 86\)[^\n]+, 32, 0, 34, 4[^\n]+RGB\(15, 23, 42\), true, RGB/u);
  assert.match(cpp, /ListViewFrameSubclassProc/u);
  assert.match(cpp, /LayoutListViewControl/u);
  assert.match(cpp, /ListViewHeaderHeightSubclassProc/u);
  assert.match(cpp, /message == HDM_LAYOUT/u);
  assert.match(cpp, /CreateListViewSizingImageList/u);
  assert.match(cpp, /ImageList_Create\(std::max\(1, width\), std::max\(1, height\)/u);
  assert.match(cpp, /bool alignFirstColumn/u);
  assert.match(cpp, /ListView_DeleteColumn\(child, 0\)/u);
  assert.match(cpp, /TreeView_InsertItem/);
  assert.match(cpp, /insertedItems\[row\[0\]\]/);
  assert.match(cpp, /TreeView_Expand\(child, inserted->second, TVE_EXPAND\)/);
  assert.match(cpp, /4:root0:3:\u6839\u8282\u70b92:-11:1/u);
  assert.match(cpp, /TVM_SETBKCOLOR/);
  assert.match(cpp, /TVM_SETTEXTCOLOR/);
  assert.match(cpp, /TVM_SETLINECOLOR/);
  assert.match(cpp, /TreeViewFrameSubclassProc/);
  assert.match(cpp, /LayoutTreeViewControl/);
  assert.match(cpp, /TVM_SETITEMHEIGHT/);
  assert.match(cpp, /TVM_SETINDENT/);
  assert.match(cpp, /L"TreeView"[^\n]+3, RGB\(18, 52, 86\), 7, 5/u);
  assert.doesNotMatch(cpp, /TVS_HASBUTTONS \| WS_BORDER/u);
  assert.doesNotMatch(cpp, /className = WC_TREEVIEWW;[\s\S]{0,240}WS_EX_CLIENTEDGE/u);
  assert.match(cpp, /ImageList_Create/);
  assert.match(cpp, /ImageList_Add/);
  assert.match(cpp, /L"main-icons"/);
  assert.match(cpp, /L"13:assets\/ok\.png"/);
  assert.match(cpp, /BS_OWNERDRAW/);
  assert.match(cpp, /PBM_SETBARCOLOR/);
  assert.doesNotMatch(cpp, /0x4C42/);
  assert.doesNotMatch(cpp, /关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件/);
  assert.ok(generated.diagnostics.some(diagnostic => diagnostic.includes('lingbuilder.win32.common-controls') && diagnostic.includes('未静默降级')));
});

test('日期选择器和月历提供不会裁切内容的可调高度', () => {
  const picker = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'DateTimePicker');
  const calendar = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'MonthCalendar');
  assert.ok(picker);
  assert.ok(calendar);
  assert.equal(picker.defaultProps.height, 40);
  assert.equal(calendar.defaultProps.width, 300);
  assert.equal(calendar.defaultProps.height, 300);
  const calendarHeight = picker.properties.find(property => property.key === 'calendarHeight');
  assert.equal(calendarHeight?.label, '下拉月历高度');
  assert.equal(calendarHeight?.defaultValue, 300);
  assert.equal(calendarHeight?.min, 200);
  assert.equal(calendarHeight?.max, undefined);

  const date = {
    ...createControl('date-height', undefined, 'DateTimePicker'),
    properties: { ...createDefaultControlProperties('DateTimePicker'), calendarHeight: 1200 }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'date-height',
    name: '日期高度',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#1F2937', description: '', controls: [date]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /L"DateTimePicker"[^\n]+L"1200"/u);
  assert.match(cpp, /requestedHeight = ScaleForDpi\(std::max\(200, _wtoi\(control\.data2\)\), dpi_\)/u);
  assert.match(cpp, /case WM_LINGBUILDER_LAYOUT_DATE_PICKER/u);
  assert.match(cpp, /ApplyDateTimePickerCalendarAppearance\(runtime->hwnd, \*control\)/u);

  const legacyState = normalizeWindowDesignerState({
    project: {
      schemaVersion: 2,
      id: 'legacy-date-size',
      name: '旧日期尺寸',
      windows: [{
        id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
        background: '#1F2937', description: '', controls: [
          { ...createControl('legacy-picker', undefined, 'DateTimePicker'), width: 180, height: 30, properties: { value: '', format: 'shortDate', customFormat: '' } },
          { ...createControl('legacy-calendar', undefined, 'MonthCalendar'), width: 250, height: 190, properties: { value: '', multiSelect: false } }
        ]
      }]
    },
    activeWindowId: 'main'
  });
  const [migratedPicker, migratedCalendar] = legacyState.project.windows[0].controls;
  assert.equal(migratedPicker.height, 40);
  assert.equal(migratedPicker.properties?.calendarHeight, 300);
  assert.deepEqual([migratedCalendar.width, migratedCalendar.height], [300, 300]);
});

test('选项卡容器槽位、隐藏表头、Rebar、Pager 和 UpDown 生成真实父子控件联动', () => {
  const tab = { ...createControl('tabs', undefined, 'TabControl'), background: '#123456', foreground: '#fedcba', properties: { tabs: [{ id: 'general', title: '常规' }, { id: 'advanced', title: '高级' }], selectedIndex: 0, hideHeader: true } };
  const tabChild = { ...createControl('tab-child', 'tabs', 'Button'), containerSlot: 'advanced' };
  const rebar = { ...createControl('rebar', undefined, 'ReBar'), properties: { autoBindChildren: true, locked: true, showGrippers: false, fixedHeight: true, showBandBorders: true, bands: [{ id: 'main-band', title: '主工具栏', childControl: 'toolbar', width: 260, minWidth: 80, height: 30, breakLine: true, resizable: false }] }, events: { BandDragStarted: '_Rebar_带区开始拖动', BandDragEnded: '_Rebar_带区结束拖动', HeightChanged: '_Rebar_高度被改变', LayoutChanged: '_Rebar_布局被改变' } };
  const toolbar = { ...createControl('toolbar', 'rebar', 'ToolBar'), properties: { buttons: [{ id: 101, title: '新建', style: 'button' }] } };
  const pager = createControl('pager', undefined, 'Pager');
  const pagerChild = createControl('pager-child', 'pager', 'Button');
  const edit = createControl('number-edit', undefined, 'TextBox');
  const upDown = { ...createControl('spinner', undefined, 'UpDown'), properties: { minimum: 0, maximum: 10, value: 2, buddyControl: 'number-edit' } };
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'containers', name: '容器联动', resources: [], windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 800, height: 600,
      background: '#202028', description: '', controls: [tab, tabChild, rebar, toolbar, pager, pagerChild, edit, upDown], menuItems: ''
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /UpdateTabChildren/);
  assert.match(cpp, /struct RuntimeTabPage/u);
  assert.match(cpp, /if \(!runtimeControls_\.back\(\)\.hideTabHeader\) TabCtrl_AdjustRect\(child, FALSE, &pageRect\)/u);
  assert.match(cpp, /WS_EX_CONTROLPARENT/u);
  assert.match(cpp, /FindTabPage\(parentSpec->id, control\.containerSlot\)/u);
  assert.match(cpp, /RuntimeTabPage\* activePage = nullptr/u);
  assert.match(cpp, /else ShowWindow\(page\.hwnd, SW_HIDE\)/u);
  assert.match(cpp, /SetWindowPos\(activePage->hwnd, HWND_TOP/u);
  assert.match(cpp, /RDW_INVALIDATE \| RDW_ERASE \| RDW_FRAME \| RDW_ALLCHILDREN \| RDW_UPDATENOW/u);
  assert.match(cpp, /TBSTYLE_FLAT \| TBSTYLE_TOOLTIPS \| (?:CCS_NODIVIDER \| )?CCS_NOPARENTALIGN \| CCS_NOMOVEY \| CCS_NORESIZE/u);
  assert.match(cpp, /style \|= CCS_NODIVIDER \| CCS_NOPARENTALIGN \| CCS_NOMOVEY \| CCS_NORESIZE/u);
  assert.match(cpp, /if \(!fixedHeight\) style \|= RBS_VARHEIGHT/u);
  assert.match(cpp, /TB_AUTOSIZE[\s\S]{0,180}SetWindowPos\(child, nullptr, childX, childY, childWidth, childHeight/u);
  assert.match(cpp, /message == WM_DRAWITEM \|\| message == WM_MEASUREITEM/u);
  assert.match(cpp, /SendMessageW\(self->hwnd_, message, wParam, lParam\)/u);
  assert.match(cpp, /PaintTabControl/u);
  assert.match(cpp, /CF_HIDE_TAB_HEADER = 1u << 28/u);
  assert.match(cpp, /if \(runtime\.hideTabHeader\)/u);
  assert.match(cpp, /ResolveTabBackground/u);
  assert.match(cpp, /PaintTabPage/u);
  assert.match(cpp, /if \(control && \(!tabRuntime \|\| !tabRuntime->hideTabHeader\)\)/u);
  assert.match(cpp, /COLORREF accent = RGB\(245, 158, 11\);/u);
  assert.match(cpp, /TCM_SETPADDING/u);
  assert.match(cpp, /UpdateTabHeaderMinimumWidth/u);
  assert.match(cpp, /GetTextExtentPoint32W/u);
  assert.match(cpp, /TCM_SETMINTABWIDTH/u);
  assert.match(cpp, /textSize\.cx \+ TabHeaderHorizontalPadding\(\) \* 2/u);
  assert.match(cpp, /if \(inserted >= 0\) UpdateTabHeaderMinimumWidth\(\*control, \*runtime\)/u);
  assert.ok(
    cpp.indexOf('TCM_SETPADDING') < cpp.indexOf('TabCtrl_InsertItem(child, index, &item)'),
    '应先应用 DPI 内边距，再插入标签并测量最终最小宽度'
  );
  assert.doesNotMatch(cpp, /TCS_OWNERDRAWFIXED/u);
  assert.doesNotMatch(cpp, /TCM_SETITEMSIZE/u);
  assert.doesNotMatch(cpp, /PaintOwnerTab/u);
  assert.doesNotMatch(cpp, /dividerPen/u, '标签页之间不应绘制竖向分隔线');
  assert.match(cpp, /WS_CHILD \| WS_CLIPCHILDREN \| WS_CLIPSIBLINGS \| SS_NOTIFY/u);
  assert.match(cpp, /L"TabControl"[^\n]+RGB\(18, 52, 86\), false, RGB\(254, 220, 186\)/u);
  assert.match(cpp, /L"TabControl"[^\n]+268435456/u);
  assert.match(cpp, /L"advanced"/);
  assert.match(cpp, /RB_INSERTBANDW/);
  assert.match(cpp, /RBBS_NOGRIPPER/u);
  assert.match(cpp, /RBBS_BREAK/u);
  assert.match(cpp, /RBBS_FIXEDSIZE/u);
  assert.match(cpp, /RBS_FIXEDORDER/u);
  assert.match(cpp, /RBS_BANDBORDERS/u);
  assert.match(cpp, /RBN_BEGINDRAG/u);
  assert.match(cpp, /RBN_ENDDRAG/u);
  assert.match(cpp, /RBN_HEIGHTCHANGE/u);
  assert.match(cpp, /RBN_LAYOUTCHANGED/u);
  assert.match(cpp, /BandDragStarted=_Rebar_带区开始拖动/u);
  assert.match(cpp, /PGM_SETCHILD/);
  assert.match(cpp, /UDM_SETBUDDY/);
});

test('旧项目分页容器不再允许新增但保留中文属性和原生生成兼容', () => {
  const pagerDefinition = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Pager');
  assert.ok(pagerDefinition);
  assert.equal(pagerDefinition.legacyOnly, true);
  const orientation = pagerDefinition.properties.find(property => property.key === 'orientation');
  assert.deepEqual(orientation?.options, [
    { value: 'horizontal', label: '水平' },
    { value: 'vertical', label: '垂直' }
  ]);
  assert.equal(createDefaultControlProperties('Pager').orientation, 'horizontal');

  const verticalPager = {
    ...createControl('vertical-pager', undefined, 'Pager'),
    properties: { orientation: 'vertical' }
  } satisfies LingControl;
  const child = { ...createControl('pager-child', 'vertical-pager', 'Button'), height: 320 };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'vertical-pager',
    name: '垂直分页容器',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: [verticalPager, child]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /L"Pager"[^\n]+L"vertical"/u);
  assert.match(cpp, /if \(TextEquals\(control\.option1, L"vertical"\)\) style \|= PGS_VERT/u);
  assert.match(cpp, /PGM_SETCHILD/u);
  assert.match(cpp, /PGN_CALCSIZE/u);
  assert.match(cpp, /PGN_SCROLL/u);
});

test('UpDown 在设计器中使用可识别的上下按钮预览', async () => {
  assert.equal(hasDedicatedControlPreview('UpDown'), true);
  const source = await fs.readFile(path.resolve(import.meta.dirname, '../src/components/UpDownDesignerPreview.tsx'), 'utf8');
  assert.match(source, /aria-label="数值调节器预览"/u);
  assert.match(source, /M1 5 5 1l4 4Z/u);
  assert.match(source, /m1 1 4 4 4-4Z/u);
});

test('图像列表资源拒绝重复 ID、不安全路径和失效控件引用', () => {
  const list = { ...createControl('list', undefined, 'ListView'), properties: { imageListId: 'missing', columns: [], items: [] } };
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'invalid-resources', name: '失效资源', resources: [
      { id: 'icons', type: 'ImageList', name: '图标一', imageWidth: 16, imageHeight: 16, images: ['../secret.png'] },
      { id: 'icons', type: 'ImageList', name: '图标二', imageWidth: 0, imageHeight: 16, images: ['C:/outside.png'] }
    ], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', controls: [list] }]
  };
  const diagnostics = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).diagnostics.join('\n');
  assert.match(diagnostics, /资源 ID“icons”重复/u);
  assert.match(diagnostics, /不安全资源路径/u);
  assert.match(diagnostics, /图片尺寸必须大于 0/u);
  assert.match(diagnostics, /不存在的图像列表“missing”/u);
});

test('系统对话框、查找替换、工具栏命令和真实文本打印保留可读取结果', () => {
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'dialogs', name: '系统对话框', resources: [], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', controls: [] }]
  };
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /SetFileTypes/);
  assert.match(cpp, /ERROR_CANCELLED/);
  assert.match(cpp, /系统对话框_状态/u);
  assert.match(cpp, /RegisterWindowMessageW\(FINDMSGSTRINGW\)/);
  assert.match(cpp, /查找替换_动作/u);
  assert.match(cpp, /工具栏_最后命令/u);
  assert.match(cpp, /StartDocW/);
  assert.match(cpp, /StartPage/);
  assert.match(cpp, /DrawTextW/);
  assert.match(cpp, /页面设置_左边距/u);
});

test('外壳控件使用独立工具栏命令、可着色对齐状态栏分区、Pager 尺寸和 RichEdit RTF 流', () => {
  const toolbar = { ...createControl('toolbar', undefined, 'ToolBar'), background: '#111111', foreground: '#FFFFFF', properties: { buttons: [{ id: 701, title: '保存', style: 'button', image: -1 }] } };
  const richDefinition = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'RichEdit');
  assert.deepEqual(richDefinition?.properties.find(property => property.key === 'scrollBars')?.options, [
    { value: 'none', label: '无' },
    { value: 'horizontal', label: '水平' },
    { value: 'vertical', label: '垂直' },
    { value: 'both', label: '水平和垂直' }
  ]);
  const statusDefinition = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'StatusBar');
  assert.ok(statusDefinition);
  const statusTextAlign = statusDefinition.properties.find(property => property.key === 'textAlign');
  assert.deepEqual(statusTextAlign, {
    key: 'textAlign',
    label: '文字对齐方式',
    type: 'enum',
    defaultValue: 'left',
    options: [
      { value: 'left', label: '居左' },
      { value: 'center', label: '居中' },
      { value: 'right', label: '居右' }
    ]
  });
  const status = { ...createControl('status', undefined, 'StatusBar'), background: 'transparent', foreground: '#AABBCC', properties: { textAlign: 'center', parts: [{ title: '就绪', width: 120 }, { title: 'UTF-8', width: 80 }] } };
  const pager = createControl('pager', undefined, 'Pager');
  const pagerChild = createControl('pager-child', 'pager', 'Button');
  const rich = { ...createControl('rich', undefined, 'RichEdit'), background: 'transparent', foreground: '#12AB34', properties: { multiline: true, wordWrap: true, readOnly: false, scrollBars: 'vertical', rtfText: '{\\rtf1\\ansi\\b 加粗\\b0}', toolTip: '富文本提示', toolTipDelay: 250 } };
  const project: LingWindowProject = { schemaVersion: 2, id: 'shell-controls', name: '外壳控件', resources: [], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 800, height: 600, background: '#202028', description: '', controls: [toolbar, status, pager, pagerChild, rich] }] };
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /toolbarCommandOwners_/);
  assert.match(cpp, /toolbarCommandValues_/);
  assert.match(cpp, /TBSTYLE_FLAT \| TBSTYLE_TOOLTIPS \| CCS_NODIVIDER \| CCS_NOPARENTALIGN \| CCS_NOMOVEY \| CCS_NORESIZE/u);
  assert.match(cpp, /SetWindowTheme\(child, L"", L""\);[\s\S]{0,220}CCM_SETBKCOLOR[\s\S]{0,180}control\.background/u);
  assert.doesNotMatch(cpp, /TB_SETBKCOLOR|TB_SETTEXTCOLOR/u);
  assert.match(cpp, /LRESULT PaintToolBar\([\s\S]+NMTBCUSTOMDRAW[\s\S]+TBCDRF_USECDCOLORS/u);
  assert.match(cpp, /IsType\(\*control, L"ToolBar"\) && header->code == NM_CUSTOMDRAW[\s\S]+PaintToolBar/u);
  assert.match(cpp, /L"ToolBar", L"toolbar"[^\n]+RGB\(17, 17, 17\), false, RGB\(255, 255, 255\)/u);
  assert.match(cpp, /状态栏_最后分区/u);
  assert.match(cpp, /NMMOUSE/);
  assert.match(cpp, /SB_SETBKCOLOR/);
  assert.match(cpp, /SBT_OWNERDRAW/);
  assert.match(cpp, /PaintOwnerStatusBar/);
  assert.match(cpp, /RGB\(170, 187, 204\)/);
  assert.match(cpp, /ResolveControlSurroundingColor\(control, child\)/);
  assert.match(cpp, /\(control->flags & CF_ALIGN_CENTER\) \? DT_CENTER/);
  assert.match(cpp, /L"StatusBar", L"status".*1048576/u);
  assert.match(cpp, /PGN_CALCSIZE/);
  assert.match(cpp, /EM_STREAMIN/);
  assert.match(cpp, /StreamRichEditData/);
  assert.match(cpp, /EM_SETBKGNDCOLOR/);
  assert.match(cpp, /control\.backgroundTransparent[\s\S]{0,120}ResolveControlSurroundingColor\(control, child\)/);
  assert.match(cpp, /CHARFORMAT2W richEditFormat/);
  assert.match(cpp, /EM_SETCHARFORMAT, SCF_ALL/);
  assert.match(cpp, /EM_SETCHARFORMAT, SCF_DEFAULT/);
  assert.match(cpp, /L"RichEdit", L"rich"[^\n]+RGB\(18, 171, 52\)/u);
  assert.match(cpp, /TTM_SETDELAYTIME/);
  assert.match(cpp, /L"\{\\\\rtf1/u);
});

test('ToolTip 与 PropertySheet 作为非可视资源生成附加行为和顶层属性页窗口', () => {
  const button = createControl('target-button', undefined, 'Button');
  const pageButton = { ...createControl('page-button', undefined, 'Button'), name: '属性页按钮', content: '页面按钮' };
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'nonvisual', name: '非可视资源', resources: [
      { id: 'tip-1', type: 'ToolTip', name: '按钮提示', targetControlId: 'target-button', text: '点击保存', initialDelay: 180 },
      { id: 'sheet-1', type: 'PropertySheet', name: '设置属性页', title: '应用设置', appliedHandler: '_设置属性页_属性被应用', pages: [{ id: 'general', title: '常规', content: '常规设置内容', sourceWindowId: 'page-template' }, { id: 'advanced', title: '高级', content: '高级设置内容' }] }
    ], windows: [
      { id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', controls: [button] },
      { id: 'page-template', fileName: 'PropertyPage.xml', className: '属性页模板', title: '属性页模板', width: 420, height: 280, background: '#202028', description: '', controls: [pageButton] }
    ]
  };
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n    事件 _设置属性页_属性被应用()\n        调试输出("已应用")\n    结束\n结束类' });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /L"点击保存", 180/);
  assert.match(cpp, /PropertySheetSpec/);
  assert.match(cpp, /BuildPropertySheetTemplate/);
  assert.match(cpp, /GeneratedPropertySheetPageProc/);
  assert.match(cpp, /PropertySheetW/);
  assert.match(cpp, /AttachPropertyPage/);
  assert.match(cpp, /CreateWindowObject\(sourceWindowIndex\)/);
  assert.match(cpp, /属性页_显示/u);
  assert.match(cpp, /DispatchDesignerResourceEvent/);
  assert.match(cpp, /设置属性页_属性被应用/u);
  assert.match(cpp, /L"sheet-1"/);
  assert.equal(generated.diagnostics.length > 0 && generated.diagnostics.some(item => item.includes('属性页资源不存在')), false);
});

test('.lcpp 控件属性读写和集合命令通过模块 binding 确定性生成', () => {
  const button = { ...createControl('save-button', undefined, 'Button'), name: '保存按钮' };
  const pageIndexInput = { ...createControl('page-index', undefined, 'TextBox'), name: '编辑框_表头', content: '0' };
  const list = { ...createControl('data-list', undefined, 'ListView'), name: '数据列表', properties: { columns: [{ title: '名称' }, { title: '状态' }], items: [] } };
  const tree = { ...createControl('data-tree', undefined, 'TreeView'), name: '数据树', properties: { nodes: [] } };
  const tab = { ...createControl('pages', undefined, 'TabControl'), name: '页面选项卡', properties: { tabs: [] } };
  const project: LingWindowProject = { schemaVersion: 2, id: 'runtime-api', name: '运行属性 API', resources: [], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', events: { Loaded: '_主窗口_创建完毕' }, controls: [button, pageIndexInput, list, tree, tab] }] };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 _主窗口_创建完毕()
        控件_设置文本("保存按钮", "立即保存")
        控件_设置文本("保存按钮", 到文本(123))
        控件_设置文本("保存按钮", 格式化文本("姓名：{}，年龄：{}，状态：{}", "小林", 18, 真))
        调试输出(格式化文本("花括号：{{}}，缺少：{} {}", "已替换"))
        编辑框_表头.内容 = "1"
        控件_设置启用("保存按钮", 真)
        页面选项卡.设置选择项(到整数(编辑框_表头.内容))
        列表视图_添加行("数据列表", "服务\\t运行")
        树形框_添加节点("数据树", "", "根节点")
        选项卡_添加页("页面选项卡", "新增页")
        选项卡_设置隐藏表头("页面选项卡", 真)
        选项卡_取隐藏表头("页面选项卡")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /控件_设置文本\(L"保存按钮", L"立即保存"\)/u);
  assert.match(cpp, /控件_设置文本\(L"保存按钮", 到文本\(123\)\)/u);
  assert.match(cpp, /LingCppTextValue 到文本\(int value\) const/u);
  assert.match(cpp, /LingCppTextValue 到文本\(bool value\) const/u);
  assert.match(cpp, /控件_设置文本\(L"保存按钮", 格式化文本\(L"姓名：\{\}，年龄：\{\}，状态：\{\}", L"小林", 18, true\)\)/u);
  assert.match(cpp, /调试输出\(格式化文本\(L"花括号：\{\{\}\}，缺少：\{\} \{\}", L"已替换"\)\)/u);
  assert.match(cpp, /template <typename\.\.\. Args> LingCppTextValue 格式化文本\(const std::wstring& format, const Args&\.\.\. args\) const/u);
  assert.match(cpp, /else output \+= L"\{\}"/u);
  assert.match(cpp, /控件_设置文本\(L"编辑框_表头", L"1"\)/u);
  assert.match(cpp, /控件_设置启用\(L"保存按钮", true\)/u);
  assert.match(cpp, /控件_设置选择项\(L"页面选项卡", 到整数\(控件_取文本\(L"编辑框_表头"\)\)\)/u);
  assert.match(cpp, /int 到整数\(const std::wstring& value\) const/u);
  assert.match(cpp, /列表视图_添加行\(L"数据列表", L"服务/u);
  assert.match(cpp, /树形框_添加节点\(L"数据树", L"", L"根节点"\)/u);
  assert.match(cpp, /选项卡_添加页\(L"页面选项卡", L"新增页"\)/u);
  assert.match(cpp, /选项卡_设置隐藏表头\(L"页面选项卡", true\)/u);
  assert.match(cpp, /选项卡_取隐藏表头\(L"页面选项卡"\)/u);
  assert.match(cpp, /runtime->hideTabHeader = hidden/u);
  assert.match(cpp, /TabCtrl_AdjustRect\(runtime->hwnd, FALSE, &pageRect\)/u);
  assert.match(cpp, /const wchar_t\* name;/);
  assert.match(cpp, /return DefWindowProcW\(hwnd, message, wParam, lParam\);/);
});

test('ListView 完整数据接口、批量更新和 OWNERDATA 虚拟模式确定性生成', () => {
  const normalList = {
    ...createControl('normal-list', undefined, 'ListView'),
    name: '普通列表',
    properties: { columns: [{ title: '序号' }, { title: '名称' }, { title: '长度' }, { title: '项数' }], items: [], virtualMode: false }
  };
  const virtualList = {
    ...createControl('virtual-list', undefined, 'ListView'),
    name: '虚拟列表',
    properties: { columns: [{ title: '序号' }, { title: '名称' }, { title: '长度' }, { title: '项数' }], items: [], virtualMode: true }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'listview-api-demo',
    name: 'ListView 完整接口',
    resources: [],
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'ListView 完整接口', width: 900, height: 620, background: '#202028', description: '', controls: [normalList, virtualList] }]
  };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const commonControlsManifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.common-controls')!;
  const listViewCommands = [
    '列表视图_创建行', '列表视图_创建行集合', '列表视图_添加行', '列表视图_插入行', '列表视图_删除行', '列表视图_设置单元格', '列表视图_取单元格',
    '列表视图_取行数', '列表视图_批量添加行', '列表视图_开始批量更新', '列表视图_结束批量更新', '列表视图_排序',
    '列表视图_取最后单击列', '列表视图_取虚拟模式', '列表视图_设置虚拟行数', '列表视图_设置虚拟行'
  ];
  for (const commandName of listViewCommands) {
    assert.ok(commonControlsManifest.contributes?.commands?.some(command => command.name === commandName), `${commandName} 必须提供补全贡献`);
    assert.ok(commonControlsManifest.bindings?.commands?.some(command => command.command === commandName), `${commandName} 必须提供确定性 C++ binding`);
  }
  for (const advanced of LIST_VIEW_ADVANCED_API) {
    assert.ok(commonControlsManifest.contributes?.commands?.some(command => command.name === advanced.name), `${advanced.name} 必须提供补全贡献`);
    assert.ok(commonControlsManifest.bindings?.commands?.some(command => command.command === advanced.name), `${advanced.name} 必须提供确定性 C++ binding`);
  }
  const listViewRowType = commonControlsManifest.contributes?.types?.find(type => type.name === '列表视图行');
  const listViewRowsType = commonControlsManifest.contributes?.types?.find(type => type.name === '列表视图行集合');
  assert.deepEqual([listViewRowType?.kind, listViewRowType?.elementType], ['array', '文本型']);
  assert.deepEqual([listViewRowsType?.kind, listViewRowsType?.elementType], ['array', '列表视图行']);
  assert.match(
    commonControlsManifest.contributes?.commands?.find(command => command.name === '列表视图_添加行')?.insertText || '',
    /列表视图_创建行/u
  );
  const virtualMode = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'ListView')?.properties.find(property => property.key === 'virtualMode');
  assert.equal(virtualMode?.defaultValue, false);
  const source = `类 MainWindow : 公开 窗体
    事件 _MainWindow_创建完毕()
        局部 整数型 i = 1
        局部 文本型 文本序号 = ""
        局部 列表视图行 类型化行 = 列表视图_创建行("3", "丙", 3, 真)
        局部 列表视图行集合 类型化行集合 = 列表视图_创建行集合(列表视图_创建行("4", "丁", 4, 假), 列表视图_创建行("5", "戊", 5, 真))
        文本序号 = 到文本(i)
        控件_清空项目("普通列表")
        列表视图_添加行("普通列表", 文本序号+"\\t代码段\\t128\\t5")
        列表视图_添加行("普通列表", 类型化行)
        列表视图_插入行("普通列表", 0, "0\\t表头\\t0\\t0")
        列表视图_插入行("普通列表", 1, 列表视图_创建行("插入", "结构化", 0, 真))
        列表视图_设置单元格("普通列表", 0, 1, "已修改")
        列表视图_取单元格("普通列表", 0, 1)
        列表视图_取行数("普通列表")
        列表视图_删除行("普通列表", 0)
        列表视图_开始批量更新("普通列表")
        列表视图_批量添加行("普通列表", "1\\t甲\\t1\\t1\\n2\\t乙\\t2\\t2")
        列表视图_批量添加行("普通列表", 类型化行集合)
        列表视图_结束批量更新("普通列表")
        列表视图_排序("普通列表", 1, 真)
        列表视图_取最后单击列("普通列表")
        列表视图_取虚拟模式("虚拟列表")
        列表视图_设置虚拟行数("虚拟列表", 15000)
        列表视图_设置虚拟行("虚拟列表", 0, "1\\t代码段\\t128\\t5")
        列表视图_设置虚拟行("虚拟列表", 1, 列表视图_创建行("2", "数组行", 64, 真))
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /LVS_OWNERDATA/u);
  assert.match(cpp, /LVN_GETDISPINFOW/u);
  assert.match(cpp, /ListView_SetItemCountEx/u);
  assert.match(cpp, /WM_SETREDRAW/u);
  assert.match(cpp, /列表视图_设置单元格\(L"普通列表", 0, 1, L"已修改"\)/u);
  assert.match(cpp, /列表视图_设置虚拟行数\(L"虚拟列表", 15000\)/u);
  assert.match(cpp, /列表视图_设置虚拟行\(L"虚拟列表", 0, L"1\\t代码段\\t128\\t5"\)/u);
  assert.match(cpp, /std::vector<std::wstring> 类型化行 = 列表视图_创建行\(L"3", L"丙", 3, true\);/u);
  assert.match(cpp, /std::vector<std::vector<std::wstring>> 类型化行集合 = 列表视图_创建行集合/u);
  assert.match(cpp, /列表视图_添加行\(L"普通列表", 类型化行\)/u);
  assert.match(cpp, /列表视图_插入行\(L"普通列表", 1, 列表视图_创建行\(L"插入", L"结构化", 0, true\)\)/u);
  assert.match(cpp, /列表视图_批量添加行\(L"普通列表", 类型化行集合\)/u);
  assert.match(cpp, /列表视图_设置虚拟行\(L"虚拟列表", 1, 列表视图_创建行\(L"2", L"数组行", 64, true\)\)/u);
  assert.match(cpp, /列表视图_添加行\(const wchar_t\* controlName, const std::vector<std::wstring>& cells\)/u);
  assert.match(cpp, /列表视图_批量添加行\(const wchar_t\* controlName, const std::vector<std::vector<std::wstring>>& rows\)/u);
  assert.match(cpp, /LingCppTextValue operator\+\(const wchar_t\* value\) const/u);
  assert.match(cpp, /列表视图_添加行\(const wchar_t\* controlName, const std::wstring& tabSeparatedCells\)/u);
  assert.match(cpp, /列表视图_添加行\(L"普通列表", 文本序号\+L"\\t代码段\\t128\\t5"\)/u);
  for (const advanced of LIST_VIEW_ADVANCED_API) assert.ok(cpp.includes(`${advanced.name}(`), `运行时缺少 ${advanced.name}`);
});

test('工作区 ListView 全方法示例可直接生成并用于源码包分享', async () => {
  const project = JSON.parse(await fs.readFile(path.resolve('..', '.lingbuilder', 'projects', 'listview-api-demo', 'window-designer.json'), 'utf8')) as LingWindowProject;
  const source = await fs.readFile(path.resolve('..', 'src', 'listview-api-demo', 'MainWindow.lcpp'), 'utf8');
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /std::vector<std::wstring> 行数据\{\};/u);
  assert.match(cpp, /std::vector<std::vector<std::wstring>> 导入行 = 列表视图_创建行集合/u);
  assert.match(cpp, /行数据\s*=\s*列表视图_创建行\(文本序号, L"代码段", 128, 5\)/u);
  assert.match(cpp, /列表视图_添加行\(L"普通列表", 行数据\)/u);
  assert.match(cpp, /列表视图_批量添加行\(L"普通列表", 导入行\)/u);
  assert.match(cpp, /列表视图_设置虚拟行数\(L"虚拟列表", 15000\)/u);
  assert.match(cpp, /列表视图_设置虚拟行\(L"虚拟列表", i-1, 列表视图_创建行\(文本序号, L"代码段", 128, 5\)\)/u);
  assert.match(cpp, /LVS_OWNERDATA/u);
  assert.ok(project.windows[0].controls.some(control => control.name === '读取单元格按钮'));
  assert.match(source, /_读取单元格按钮_被单击\(\)/u);
  assert.match(source, /列表视图_取单元格\(普通列表, 选中行, 1\)/u);
  assert.match(cpp, /信息框\(L"第 "\+到文本\(选中行\+1\)\+L" 行、第 2 列的值："\+单元格内容, 64, L"读取单元格"\)/u);
  assert.ok(project.windows[0].controls.some(control => control.name === '读取选中行按钮'));
  assert.equal(project.windows[0].controls.find(control => control.name === '普通列表')?.properties?.multiple, true);
  assert.match(source, /选中行 = 控件_取选择项\(普通列表\)/u);
  assert.match(source, /选中行数 = 列表视图_取选中行数\(普通列表\)/u);
  assert.match(source, /首个选中行 = 列表视图_取下一个选中行\(普通列表, -1\)/u);
  assert.match(cpp, /选中行文本\s*=\s*到文本\(选中行\)/u);
  assert.match(cpp, /选中行数文本\s*=\s*到文本\(选中行数\)/u);
  assert.match(cpp, /首个选中行文本\s*=\s*到文本\(首个选中行\)/u);
  assert.match(cpp, /信息框\(L"控件_取选择项："\+选中行文本/u);
  assert.match(cpp, /int 信息框\(const std::wstring& text, UINT flags, const std::wstring& title\)/u);
  assert.match(cpp, /int 信息框\(const std::wstring& text, UINT flags, const wchar_t\* title\)/u);
  for (const advanced of LIST_VIEW_ADVANCED_API) assert.ok(source.includes(`${advanced.name}(`), `示例源码缺少 ${advanced.name}`);
});

test('.lcpp 图片框设置图片方法确定性生成 Win32 运行时调用', () => {
  const image = { ...createControl('preview-image', undefined, 'Image'), name: '图片框1', properties: { imageSource: '', stretch: 'uniform' } };
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'runtime-image-api', name: '图片运行时 API', resources: [],
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', events: { Loaded: '_主窗口_创建完毕' }, controls: [image] }]
  };
  const enabledModules = ['lingbuilder.win32.basic'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 _主窗口_创建完毕()
        图片框1.设置图片("assets/示例.png")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /控件_设置图片\(L"图片框1", L"assets\/示例\.png"\)/u);
  assert.match(cpp, /bool 控件_设置图片\(const wchar_t\* controlName, const std::wstring& imagePath\)/u);
  assert.match(cpp, /LoadWicBitmap\(imagePath\.c_str\(\)/u);
  assert.match(cpp, /STM_SETIMAGE, IMAGE_BITMAP/u);
  assert.match(cpp, /style \|= SS_BITMAP \| SS_CENTERIMAGE \| SS_NOTIFY;/u);
  assert.match(cpp, /if \(!control\.data \|\| !control\.data\[0\]\) style \|= WS_BORDER;/u);
  assert.doesNotMatch(cpp, /style \|= control\.data && control\.data\[0\] \? \(SS_BITMAP/u);
});

test('窗口创建完毕事件支持自定义处理器绑定并进入生成结果', () => {
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'window-event', name: '窗口事件', windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#ffffff', description: '', controls: [], events: { Loaded: '_主窗口_初始化界面' }
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n    事件 _主窗口_初始化界面()\n        调试输出("初始化")\n    结束\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /主窗口_初始化界面\(\);/u);
});

test('窗口第一批和第二批事件生成统一 Win32 分发与上下文运行时', () => {
  const events = Object.fromEntries(WINDOW_EVENT_DEFINITIONS.map(definition => [
    definition.name,
    getWindowEventHandlerName('主窗口', definition.name)
  ]));
  const sourceEvents = WINDOW_EVENT_DEFINITIONS.map(definition => [
    `    事件 ${events[definition.name]}()`,
    `        调试输出("${definition.label}")`,
    '    结束'
  ].join('\n')).join('\n');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'window-events-complete',
    name: '完整窗口事件',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480,
      background: '#202028', description: '', controls: [], events
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: `类 主窗口 : 公开 窗体\n${sourceEvents}\n结束类`
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /const wchar_t\* events;/u);
  assert.match(cpp, /Closing=_主窗口_关闭前/u);
  assert.match(cpp, /DispatchWindowEvent\(L"Closing"\)/u);
  assert.match(cpp, /DispatchWindowEvent\(L"SizeChanged"\)/u);
  assert.match(cpp, /DispatchWindowEvent\(L"SizeChanged"\);[\s\S]{0,180}RedrawWindow\(hwnd_, nullptr, nullptr,[\s\S]{0,120}RDW_INVALIDATE \| RDW_ERASE \| RDW_ALLCHILDREN \| RDW_UPDATENOW/u);
  assert.match(cpp, /DispatchWindowEvent\(nextState == 1 \? L"Minimized" : nextState == 2 \? L"Maximized" : L"Restored"\)/u);
  assert.match(cpp, /PreTranslateKeyboardMessage/u);
  assert.match(cpp, /messageOwner->PreTranslateKeyboardMessage\(message\)/u);
  assert.match(cpp, /case WM_DPICHANGED/u);
  assert.match(cpp, /case WM_DROPFILES/u);
  assert.match(cpp, /DragAcceptFiles\(hwnd_, TRUE\)/u);
  assert.match(cpp, /bool 窗口_取消关闭\(\)/u);
  assert.match(cpp, /const wchar_t\* 窗口_取拖入文件\(int index\) const/u);
  assert.match(cpp, /void 主窗口_文件被拖入\(\)/u);
});

test('new_emoji FBro browser shell template generates one real HWND host per tab with shared status dispatch', async t => {
  const moduleRoot = path.resolve('..', '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  let newEmojiManifest: InstalledModule['manifest'];
  try {
    newEmojiManifest = JSON.parse(await fs.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8')) as InstalledModule['manifest'];
  } catch {
    t.skip('当前环境未安装 new_emoji 模块，跳过浏览器外壳生成回归测试。');
    return;
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-browser-shell-'));
  const preview = await createSolutionService(root).previewCreateProject({
    name: '浏览器外壳', projectId: 'browser-shell', templateId: 'new-emoji-fbro-browser-shell'
  });
  const source = preview.files.find(file => file.relativePath.endsWith('.lcpp'))?.content || '';
  const builtinIds = new Set([
    'lingbuilder.win32.basic',
    'lingbuilder.fbro.browser',
    'lingbuilder.fbro.sdk',
    'lingbuilder.new_emoji.fbro-shell'
  ]);
  const enabledModules: InstalledModule[] = BUILTIN_MODULES
    .filter(module => builtinIds.has(module.id))
    .map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  enabledModules.push({ manifest: newEmojiManifest, installPath: moduleRoot, isInstalled: true, isEnabledForProject: true, diagnostics: [] });

  const generated = generateLingCppNativeWin32Project(preview.designerProject, {
    activeWindowId: 'main-window',
    enabledModules,
    lingCppSourceFilePath: 'src/browser-shell/MainWindow.lcpp',
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.deepEqual(generated.blockingDiagnostics, []);
  assert.doesNotMatch(generated.diagnostics.join('\n'), /需要启用模块 lingbuilder\.win32\.common-controls/u);
  assert.match(cpp, /NE_创建自定义框架窗口\([^;]+, 63\)/u);
  assert.match(cpp, /EU_SetChromeThemePreset\(g_newEmojiWindow, 1\)/u);
  assert.match(cpp, /EU_SetThemeToken\(g_newEmojiWindow, reinterpret_cast<const unsigned char\*>\(token\)/u);
  assert.match(cpp, /EU_SetTabsChromeMetrics\(g_newEmojiWindow, ne_element_[0-9]+, 96, 220, 46, 32, 0\)/u);
  assert.match(cpp, /EU_SetContainerLayout\(g_newEmojiWindow, ne_element_[0-9]+, 0, 0, 0\)/u);
  assert.match(cpp, /EU_SetElementPopup\(g_newEmojiWindow, ne_element_[0-9]+, ne_element_[0-9]+, 1\)/u);
  assert.match(cpp, /static void LB_NE_UpdateBrowserShellHitRegions\(\)/u);
  assert.match(cpp, /struct LB_NE_FbroShellState/u);
  assert.match(cpp, /EU_SetTabsCloseCallback\([^;]+LB_NE_BrowserShellTabsClosed\)/u);
  assert.match(cpp, /EU_SetTabsAddCallback\([^;]+LB_NE_BrowserShellTabsAdded\)/u);
  assert.match(cpp, /EU_SetTabsReorderCallback\([^;]+LB_NE_BrowserShellTabsReordered\)/u);
  assert.match(cpp, /LB_FBro_CreateEx\(browser\.host/u);
  assert.match(cpp, /static bool LB_NE_GetElementWindowBounds\(int elementId, int\* x, int\* y, int\* width, int\* height\)/u);
  assert.match(cpp, /LB_NE_GetElementWindowBounds\(g_newEmojiFbroShell\.viewportElementId/u);
  assert.match(cpp, /LB_NE_RegisterElement\(ne_tab_page_[0-9]+_[0-9]+, L"TabsPage", L"TabsPage"/u);
  assert.match(cpp, /LB_NE_CreateBrowserShellCompanionHost/u);
  assert.match(cpp, /CreateWindowExW\(\s*WS_EX_TOOLWINDOW,[\s\S]*?WS_POPUP \| WS_CLIPCHILDREN \| WS_CLIPSIBLINGS/u);
  assert.match(cpp, /ClientToScreen\(g_newEmojiWindow, &origin\)/u);
  assert.match(cpp, /syncBrowserShellBoundsAfterMessage = message == WM_MOVE \|\| message == WM_SIZE\s*\|\| message == WM_DPICHANGED/u);
  assert.match(cpp, /LB_NE_HasOpenBrowserShellOverlay/u);
  assert.match(cpp, /EU_GetPopupOpen\(g_newEmojiWindow, element->id\) > 0/u);
  assert.match(cpp, /LB_NE_BROWSER_SHELL_DEFAULT_URL\[\] = L"https:\/\/www\.baidu\.com"/u);
  assert.match(cpp, /浏览器外壳_新建标签页\(stableId, LB_NE_BROWSER_SHELL_DEFAULT_URL, L"新标签页"\)/u);
  assert.match(cpp, /PostMessageW\(g_newEmojiWindow, WM_LINGBUILDER_NE_BROWSER_SHELL_LAYOUT, 0, 0\)/u);
  assert.match(cpp, /case WM_LINGBUILDER_NE_BROWSER_SHELL_LAYOUT:[\s\S]*?LB_NE_UpdateBrowserShellHitRegions\(\);[\s\S]*?return 0;/u);
  assert.match(cpp, /case WM_NCHITTEST:[\s\S]*?originalHit != HTCLIENT[\s\S]*?LB_NE_IsBrowserShellDragPoint\(clientPoint\) \? HTCAPTION : originalHit/u);
  assert.match(cpp, /EU_GetElementBounds\(g_newEmojiWindow, lbHitControl[0-9]+->id[\s\S]*?return false;/u);
  assert.match(cpp, /IsWindowVisible\(g_newEmojiWindow\) && !IsIconic\(g_newEmojiWindow\)/u);
  assert.match(cpp, /browser\.shellManaged && LB_NE_IsBrowserShellStateEvent\(packet->eventCode\)/u);
  assert.doesNotMatch(cpp, /HWND host = CreateWindowExW\(0, L"STATIC", L"", WS_CHILD[\s\S]{0,250}browser\.shellManaged = true/u);
  assert.match(cpp, /static HWND LB_NE_CreateBrowserShellCompanionHost[\s\S]*?POINT origin\{scale\(x\), scale\(y\)\}/u);
  assert.match(cpp, /static void LB_NE_BrowserShellStatus_1\(int lb_tab_index, const std::wstring& lb_address, const std::wstring& lb_title, bool lb_loading\)/u);
  assert.match(cpp, /int 标签索引 = lb_tab_index;\s+std::wstring 地址 = lb_address;\s+std::wstring 标题 = lb_title;\s+bool 加载中 = lb_loading;/u);
  assert.match(cpp, /static void 重排浏览器布局\(\);/u);
  assert.match(cpp, /static void 重排浏览器布局\(\) \{[\s\S]*窗口_取事件宽度\(\)/u);
  assert.match(cpp, /int 标签区宽度 = 0;[\s\S]*?标签区宽度 = 窗口宽度-300;[\s\S]*?标签控件宽度 = 标签数量\*标签宽度;[\s\S]*?控件_设置位置大小\(L"浏览器标签页", 16, 4, 标签控件宽度, 34\)/u);
  assert.doesNotMatch(cpp, /LB_NE_FbroDynamicHandler_/u);
  assert.equal((cpp.match(/static bool 窗口_取是否激活\(\)/gu) || []).length, 1);
  assert.match(cpp, /int 键码 = g_neWindowEventKeyCode;\s+bool Ctrl键按下 = g_neWindowEventCtrl;/u);
  assert.match(cpp, /EU_SetBrowserViewportPlaceholder/u);
  assert.match(cpp, /static bool 浏览器外壳_新建独立实例/u);
  assert.match(cpp, /browser\.processMode = LING_FBRO_PROCESS_EMBEDDED/u);
  assert.match(cpp, /#include <LingBuilderFbroProcessRuntime\.hpp>/u);
  assert.match(cpp, /const int fbroHostExitCode = LB_FBroProcess_RunHostIfRequested\(instance\);/u);
  assert.match(cpp, /LingFbroProcessController::Instance\(\)\.Start\(config, false\)/u);
  assert.match(cpp, /LingFbroProcessController::Instance\(\)\.Notify\(browser->processInstanceId, method, payload\)/u);
  assert.doesNotMatch(cpp, /LB_NE_FbroProcessRequest\(&browser, visible \? L"show" : L"hide"/u);
  assert.match(cpp, /static bool 浏览器外壳_绑定实例列表/u);
  assert.match(cpp, /EU_SetRichListItems\(g_newEmojiWindow, g_newEmojiFbroShell\.richListElementId/u);
  assert.match(cpp, /static bool 浏览器外壳_选择列表键/u);
  assert.match(cpp, /static bool 浏览器外壳_按配置重建当前/u);
  assert.match(cpp, /LB_NE_FbroProcessText\(browser, L"getCookies"/u);
});

test('原生生成优先按当前源码文件选择窗口并忽略过期设计器活动窗口', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'multi-window-source-selection',
    name: '多窗口源码选择',
    windows: [
      {
        id: 'main',
        fileName: 'MainWindow.xml',
        className: '主窗口',
        title: '主窗口',
        width: 640,
        height: 480,
        background: '#202028',
        description: '',
        controls: []
      },
      {
        id: 'settings',
        fileName: 'SettingsWindow.xml',
        className: '设置窗口',
        title: '设置窗口',
        width: 520,
        height: 360,
        background: '#202028',
        description: '',
        controls: []
      }
    ]
  };

  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    lingCppSourceFilePath: 'src/设置窗口.lcpp',
    lingCppSourceCode: '类 设置窗口 : 公开 窗体\n结束类'
  });

  assert.equal(generated.selectedWindow.id, 'settings');
  assert.ok(generated.diagnostics.some(item => /忽略过期的设计器窗口“主窗口”/u.test(item)));
});

test('原生生成明确报告当前源码与设计器窗口类不一致', () => {
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'source-class-mismatch',
    name: '源码类校验',
    windows: [{
      id: 'main',
      fileName: 'MainWindow.xml',
      className: '主窗口',
      title: '主窗口',
      width: 640,
      height: 480,
      background: '#202028',
      description: '',
      controls: []
    }]
  };

  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main',
    lingCppSourceFilePath: 'src/其他窗口.lcpp',
    lingCppSourceCode: '类 其他窗口 : 公开 窗体\n结束类'
  });

  assert.ok(generated.diagnostics.some(item =>
    /当前源码未定义设计器窗口类“主窗口”/u.test(item)
  ));
});

test('热键属性捕获与 Win32 默认热键格式保持一致', () => {
  const hotKeyDefinition = WIN32_CONTROL_DEFINITIONS
    .find(definition => definition.type === 'HotKey')
    ?.properties.find(property => property.key === 'hotKey');
  assert.equal(hotKeyDefinition?.type, 'hotkey');

  assert.deepEqual(captureDesignerHotKey({
    key: 'K', code: 'KeyK', ctrlKey: true, altKey: true, shiftKey: true, metaKey: false
  }), { kind: 'capture', value: 'Ctrl+Alt+Shift+K' });
  assert.deepEqual(captureDesignerHotKey({
    key: 'F12', code: 'F12', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false
  }), { kind: 'capture', value: 'F12' });
  assert.deepEqual(captureDesignerHotKey({
    key: '!', code: 'Digit1', ctrlKey: true, altKey: false, shiftKey: true, metaKey: false
  }), { kind: 'capture', value: 'Ctrl+Shift+1' });
  assert.deepEqual(captureDesignerHotKey({
    key: 'Delete', code: 'Delete', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false
  }), { kind: 'clear' });
  assert.equal(captureDesignerHotKey({
    key: 'Enter', code: 'Enter', ctrlKey: true, altKey: false, shiftKey: false, metaKey: false
  }).kind, 'unsupported');
});

test('热键输入框的文字色和透明背景进入 Win32 父容器绘制链路', () => {
  const group = { ...createControl('group', undefined, 'GroupBox'), background: '#445566' };
  const hotKey = {
    ...createControl('hotkey', 'group', 'HotKey'),
    foreground: '#12AB34',
    background: 'transparent',
    properties: { hotKey: 'Ctrl+K' }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'transparent-hotkey',
    name: '透明热键',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口',
      width: 640, height: 480, background: '#202028', description: '', controls: [group, hotKey]
    }]
  };

  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"HotKey"[^\n]+true, RGB\(18, 171, 52\)/u);
  assert.match(cpp, /\(message == WM_CTLCOLOREDIT \|\| message == WM_CTLCOLORSTATIC\) && IsType\(\*control, L"HotKey"\)/u);
  assert.match(cpp, /SetTextColor\(hdc, control->foreground\)/u);
  assert.match(cpp, /SetBkColor\(hdc, ResolveControlSurroundingColor\(\*control, child\)\)/u);
  assert.match(cpp, /ResolveControlSurroundingBrush\(\*control, child\)/u);
  assert.match(cpp, /std::wstring FormatHotKeyDisplay\(HWND hwnd\) const/u);
  assert.match(cpp, /SendMessageW\(hwnd, HKM_GETHOTKEY, 0, 0\)/u);
  assert.match(cpp, /void PaintHotKeyControl\(HWND hwnd, HDC providedHdc/u);
  assert.match(cpp, /control\.backgroundTransparent\s*\? ResolveControlSurroundingColor\(control, hwnd\)/u);
  assert.match(cpp, /SetTextColor\(hdc, foreground\)/u);
  assert.match(cpp, /std::max\(0, static_cast<int>\(rect\.bottom - rect\.top - metrics\.tmHeight\) \/ 2\)/u);
  assert.match(cpp, /IsType\(\*control, L"HotKey"\)[\s\S]+message == WM_PAINT[\s\S]+PaintHotKeyControl/u);
});

test('颜色选择器支持可视入口和隐藏后由其他事件按名称打开', () => {
  const definition = WIN32_CONTROL_DEFINITIONS.find(item => item.type === 'ColorPicker');
  assert.ok(definition);
  assert.equal(definition.moduleId, 'lingbuilder.win32.common-controls');
  assert.equal(definition.isVisual, true);
  assert.equal(definition.properties.find(property => property.key === 'currentColor')?.type, 'color');
  assert.deepEqual(definition.events.map(event => event.name), ['ColorChanged', 'Opened', 'Confirmed', 'Cancelled', 'Closed']);
  assert.equal(hasDedicatedControlPreview('ColorPicker'), true);

  const picker = {
    ...createControl('颜色选择器1', undefined, 'ColorPicker'),
    visibility: 'Collapsed' as const,
    properties: {
      ...createDefaultControlProperties('ColorPicker'),
      currentColor: '#3366CC',
      dialogTitle: '选择主题颜色',
      showColorText: true,
    },
    events: { ColorChanged: '_颜色选择器1_颜色被改变' }
  } satisfies LingControl;
  const button = {
    ...createControl('选择颜色按钮', undefined, 'Button'),
    events: { Click: '_选择颜色按钮_被单击' }
  } satisfies LingControl;
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'color-picker',
    name: '颜色选择器测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口',
      width: 640, height: 480, background: '#202028', description: '', controls: [picker, button]
    }]
  };
  const source = `类 主窗口 : 公开 窗体
    事件 _选择颜色按钮_被单击()
        颜色选择器_打开("颜色选择器1")
    结束
    事件 _颜色选择器1_颜色被改变()
        调试输出(颜色选择器_取颜色("颜色选择器1"))
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source })
    .files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /L"ColorPicker", L"颜色选择器1"/u);
  assert.match(cpp, /L"选择主题颜色"/u);
  assert.match(cpp, /CF_HIDDEN = 1u << 29/u);
  assert.match(cpp, /DWORD style = WS_CHILD \| WS_VISIBLE;[\s\S]{0,100}if \(control\.flags & CF_HIDDEN\) style &= ~WS_VISIBLE/u);
  assert.match(cpp, /bool 颜色选择器_打开\(const wchar_t\* controlName\)/u);
  assert.match(cpp, /ShowModernColorPickerDialog\(hwnd_, control->option1, runtime->colorValue, selected\)/u);
  assert.match(cpp, /ModernPaintColorPicker/u);
  assert.match(cpp, /case WM_ERASEBKGND:\s*return 1;/u);
  assert.match(cpp, /CreateCompatibleBitmap\(hdc,[\s\S]{0,300}BitBlt\(hdc,/u);
  assert.match(cpp, /ModernCenterHexEdit\(\*state\)/u);
  assert.match(cpp, /WS_POPUP \| WS_CAPTION \| WS_SYSMENU \| WS_CLIPCHILDREN/u);
  assert.match(cpp, /DispatchLingEvent\(\*control, L"ColorChanged"\)/u);
  assert.match(cpp, /颜色选择器_打开\(L"颜色选择器1"\);/u);
  assert.match(cpp, /调试输出\(颜色选择器_取颜色\(L"颜色选择器1"\)\);/u);

  const row = cpp.split('\n').find(line => line.includes('L"ColorPicker", L"颜色选择器1"')) || '';
  assert.match(row, /, 1610612736, L"", false, 0, L"ColorChanged=/u);
});

test('格式化文本完整能力演示项目覆盖四组选项卡并可生成原生工程', async () => {
  const source = await fs.readFile(new URL('../../src/format-text-api-demo/MainWindow.lcpp', import.meta.url), 'utf8');
  const project = JSON.parse(
    await fs.readFile(new URL('../../.lingbuilder/projects/format-text-api-demo/window-designer.json', import.meta.url), 'utf8')
  ) as LingWindowProject;
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({
    manifest: BUILTIN_MODULES.find(module => module.id === id)!,
    installPath: 'builtin',
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));

  const tabControl = project.windows[0]?.controls.find(control => control.type === 'TabControl');
  const tabs = tabControl?.properties?.tabs;
  assert.ok(tabControl);
  assert.equal(Array.isArray(tabs) ? tabs.length : 0, 4);
  assert.deepEqual(
    project.windows[0]?.controls
      .filter(control => control.parentId === tabControl.id)
      .reduce<Record<string, number>>((counts, control) => {
        const slot = control.containerSlot || '';
        counts[slot] = (counts[slot] || 0) + 1;
        return counts;
      }, {}),
    { 'page-basic': 8, 'page-types': 4, 'page-edge': 9, 'page-app': 10 }
  );

  assert.match(source, /格式化文本\("你好，\{\}！你今年 \{\} 岁/u);
  assert.match(source, /文本=\{\} \| 整数=\{\} \| 长整数=\{\} \| 小数=\{\} \| 双精度=\{\} \| 真值=\{\} \| 假值=\{\}/u);
  assert.match(source, /对象外观：\{\{/u);
  assert.match(source, /不足：\{\} \/ \{\} \/ \{\}/u);
  assert.match(source, /多余：\{\}/u);
  assert.match(source, /这段模板没有占位符，会保持原样/u);
  assert.match(source, /外层消息：\[\{\}\]/u);
  assert.match(source, /信息框\(格式化文本/u);
  assert.match(source, /调试输出\(格式化文本/u);

  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/format-text-api-demo/MainWindow.lcpp',
    enabledModules
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.deepEqual(generated.blockingDiagnostics, []);
  assert.match(cpp, /WC_TABCONTROL/u);
  assert.match(cpp, /template <typename\.\.\. Args> LingCppTextValue 格式化文本/u);
  assert.match(cpp, /信息框\(格式化文本\(L"当前订单摘要/u);
  assert.match(cpp, /调试输出\(格式化文本\(L"\[格式化日志\]/u);
});

test('multiline TextBox text updates keep the latest log line visible', () => {
  const multiline = {
    ...createControl('log-box', undefined, 'TextBox'),
    name: 'log-box',
    properties: { multiline: true, readOnly: true, scrollBars: 'vertical' }
  };
  const singleLine = {
    ...createControl('single-line', undefined, 'TextBox'),
    name: 'single-line',
    properties: { multiline: false, readOnly: false, scrollBars: 'none' }
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'multiline-text-setter',
    name: 'multiline text setter',
    resources: [],
    windows: [{
      id: 'main',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'multiline text setter',
      width: 640,
      height: 480,
      background: '#202028',
      description: '',
      controls: [multiline, singleLine]
    }]
  };
  const cpp = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: 'class MainWindow: public window\nend class'
  }).files.find(file => file.relativePath === 'main.cpp')!.content;

  assert.match(cpp, /const ControlSpec\* control = FindControl\(runtime->id\);[\s\S]+?if \(updated && control && IsType\(\*control, L"TextBox"\) && \(control->flags & CF_MULTILINE\)\)/u);
  assert.match(cpp, /SendMessageW\(runtime->hwnd, EM_SETSEL, static_cast<WPARAM>\(-1\), static_cast<LPARAM>\(-1\)\);/u);
  assert.match(cpp, /SendMessageW\(runtime->hwnd, EM_SCROLLCARET, 0, 0\);/u);
  assert.equal((cpp.match(/EM_SCROLLCARET/g) || []).length, 1);
  assert.match(cpp, /L"TextBox", L"log-box"[^\n]+4/u);
  assert.match(cpp, /L"TextBox", L"single-line"[^\n]+0/u);
});

test('窗口边框样式：旧项目按 resizable 迁移并可派生', () => {
  // createBlankWindow 新建窗口默认携带 borderStyle，旧项目模拟对象需显式清除该字段才能命中迁移路径
  const legacyFixedWindow: LingWindowModel = {
    ...createBlankWindow(0),
    borderStyle: undefined,
    resizable: false
  };
  const legacyResizableWindow: LingWindowModel = {
    ...createBlankWindow(1),
    borderStyle: undefined,
    resizable: true
  };
  const migratedFixed = normalizeWindowDesignerState({ project: { id: 'p1', name: 'P1', windows: [legacyFixedWindow] }, activeWindowId: legacyFixedWindow.id, selectedControlId: null });
  const migratedResizable = normalizeWindowDesignerState({ project: { id: 'p2', name: 'P2', windows: [legacyResizableWindow] }, activeWindowId: legacyResizableWindow.id, selectedControlId: null });
  assert.equal(migratedFixed.project.windows[0].borderStyle, 'normal-fixed');
  assert.equal(migratedFixed.project.windows[0].resizable, false);
  assert.equal(migratedResizable.project.windows[0].borderStyle, 'normal-resizable');
  assert.equal(migratedResizable.project.windows[0].resizable, true);

  const migratedNone = normalizeWindowDesignerState({ project: { id: 'p3', name: 'P3', windows: [{ ...createBlankWindow(0), borderStyle: 'none', borderlessDraggable: true }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(migratedNone.project.windows[0].borderStyle, 'none');
  assert.equal(migratedNone.project.windows[0].borderlessDraggable, true);
  assert.equal(migratedNone.project.windows[0].resizable, false);

  // p4：先构造已规范化窗口再注入矛盾 resizable，二次 normalize 时唯一能触发回填的就是 resizable 派生检测
  const normalizedOnce = normalizeWindowDesignerState({ project: { id: 'p4a', name: 'P4A', windows: [{ ...createBlankWindow(0), borderStyle: 'thin-title-fixed' }] }, activeWindowId: '', selectedControlId: null });
  const normalizedWindow = normalizedOnce.project.windows[0];
  const migratedThinFixed = normalizeWindowDesignerState({ project: { id: 'p4', name: 'P4', windows: [{ ...normalizedWindow, resizable: true }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(migratedThinFixed.project.windows[0].resizable, false);
});

test('窗口边框样式：新建窗口默认普通可调边框，无边框时画布内容偏移不含标题栏', () => {
  const blank = createBlankWindow(0);
  assert.equal(blank.borderStyle, 'normal-resizable');
  assert.equal(blank.borderlessDraggable, false);
  assert.ok(getDesignerWindowContentOffset({ ...blank, menuItems: '' }) >= 28);
  assert.equal(getDesignerWindowContentOffset({ ...blank, borderStyle: 'none', menuItems: '' }), 0);
  assert.ok(getDesignerWindowContentOffset({ ...blank, borderStyle: 'none', menuItems: '文件, 编辑' }) > 0);
});

test('画布内容偏移：窄标题边框按窄标题栏高度计算', () => {
  const blank = createBlankWindow(0);
  assert.equal(getDesignerWindowContentOffset({ ...blank, borderStyle: 'thin-title-fixed', menuItems: '' }), 20);
  assert.equal(getDesignerWindowContentOffset({ ...blank, borderStyle: 'thin-title-resizable', menuItems: '' }), 20);
});

test('lingCpp 生成器：边框样式进入 WindowSpec 与 C++ 样式辅助函数', () => {
  const baseWindow: LingWindowModel = {
    ...createBlankWindow(0),
    controls: []
  };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'bp', name: '边框项目', windows: [window] });
  const result = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'none', borderlessDraggable: true }));
  const mainCpp = result.files.find(file => file.relativePath.endsWith('.cpp'))!;
  assert.ok(mainCpp.content.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(mainCpp.content.includes('LB_WindowBorderStyleToDwExStyle'));
  assert.ok(mainCpp.content.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(mainCpp.content.includes('WM_NCLBUTTONDOWN, HTCAPTION'));
  assert.ok(mainCpp.content.includes('if (spec_.borderStyle != 0)'));
  // Issue 1：Open() 内两处 AdjustWindowRectForDpiValue 均需传 windowExStyle（与 WM_DPICHANGED 路径一致）
  assert.equal((mainCpp.content.match(/AdjustWindowRectForDpiValue\(&\w+, windowStyle, hasMenu, windowExStyle, dpi_\);/g) || []).length, 2);
  // Issue 2：无边框 + 默认位置的级联回落块存在（CW_USEDEFAULT 对 WS_POPUP 无效会坍缩到 (0,0)）
  assert.ok(mainCpp.content.includes('spec_.borderStyle == 0 && (windowX == CW_USEDEFAULT'));
  // Minor 2：resizable 由 borderStyle 派生（none → false）
  assert.ok(mainCpp.content.includes('false, true, 0, true, g_controls_'));
});

test('lingCpp 生成器：固定/窄标题边框映射与序列化字段', () => {
  const baseWindow: LingWindowModel = {
    ...createBlankWindow(0),
    controls: []
  };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'bp2', name: '边框项目2', windows: [window] });
  const fixedResult = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'normal-fixed' }));
  const fixedCpp = fixedResult.files.find(file => file.relativePath.endsWith('.cpp'))!;
  assert.ok(fixedCpp.content.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));

  const thinResult = generateLingCppNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'thin-title-fixed' }));
  const thinCpp = thinResult.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  assert.ok(thinCpp.includes('WS_EX_TOOLWINDOW'));
  // WindowSpec 序列化：resizable 由 thin-title-fixed 派生为 false，边框编号 4，拖动布尔默认 false
  assert.ok(thinCpp.includes('false, true, 4, false, g_controls_'));
});

test('normalize 规范化 borderlessDraggable 残留值', () => {
  const firstPass = normalizeWindowDesignerState({ project: { id: 'pd1', name: 'PD1', windows: [{ ...createBlankWindow(0), borderStyle: 'none' }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(firstPass.project.windows[0].borderlessDraggable, false);
  const staleTrue = normalizeWindowDesignerState({ project: { id: 'pd2', name: 'PD2', windows: [{ ...firstPass.project.windows[0], borderStyle: 'normal-fixed', borderlessDraggable: true }] }, activeWindowId: '', selectedControlId: null });
  assert.equal(staleTrue.project.windows[0].borderlessDraggable, false);
});

test('native 生成器：边框样式映射到窗口样式、拖动与序列化', () => {
  const baseWindow: LingWindowModel = { ...createBlankWindow(0), controls: [] };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'np', name: '边框项目', windows: [window] });
  const result = generateNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'none', borderlessDraggable: true }));
  const cpp = result.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  assert.ok(cpp.includes('LB_WindowBorderStyleToDwStyle'));
  assert.ok(cpp.includes('LB_WindowBorderStyleToDwExStyle'));
  assert.ok(cpp.includes('WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX'));
  assert.ok(cpp.includes('WM_NCLBUTTONDOWN, HTCAPTION'));
  assert.ok(cpp.includes('AdjustWindowRectEx(&rect, windowStyle, TRUE, windowExStyle)'));
  assert.ok(cpp.includes('spec.borderStyle == 0'));
  // 位置回落块存在性锚定（CW_USEDEFAULT 对 WS_POPUP 无效，cascadeSeed 级联防窗体坍缩到 (0,0)）
  assert.ok(cpp.includes('cascadeSeed'));
  // 序列化锚定断言（前导 underline 布尔 + 四值 + 行尾）：resizable 派生(none→false), maximizable 默认 true, 编号 0, 拖动 true
  assert.ok(cpp.includes('false, false, true, 0, true }'));
});

test('native 生成器：固定边框与旧项目迁移', () => {
  const baseWindow: LingWindowModel = { ...createBlankWindow(0), controls: [] };
  const projectOf = (window: LingWindowModel): LingWindowProject => ({ id: 'np2', name: '边框项目2', windows: [window] });
  const fixed = generateNativeWin32Project(projectOf({ ...baseWindow, borderStyle: 'normal-fixed' }));
  const fixedCpp = fixed.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  assert.ok(fixedCpp.includes('WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME'));
  // 旧项目（无 borderStyle + resizable: false）生成器端迁移为 normal-fixed（编号 2）；maximizable 保持默认 true
  const legacy = generateNativeWin32Project(projectOf({ ...baseWindow, borderStyle: undefined, resizable: false }));
  const legacyCpp = legacy.files.find(file => file.relativePath.endsWith('.cpp'))!.content;
  // 序列化锚定断言（前导 underline 布尔 + 四值 + 行尾）：迁移为 normal-fixed 后 resizable 派生 false，maximizable 默认 true，编号 2，拖动默认 false
  assert.ok(legacyCpp.includes('false, false, true, 2, false }'));
});
