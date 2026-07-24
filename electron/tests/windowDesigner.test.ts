import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ListViewDesignerPreview from '../src/components/ListViewDesignerPreview';
import TabControlDesignerPreview from '../src/components/TabControlDesignerPreview';
import ListViewCollectionDialog from '../src/components/ListViewCollectionDialog';
import { parseStringListPropertyText } from '../src/components/WpfDesigner';
import {
  buildControlHierarchy,
  canReparentControl,
  getEffectiveControlState,
  getControlDescendantIds,
  normalizeControlHierarchy,
  reparentControl
} from '../src/services/windowDesigner/controlHierarchy';
import {
  getDesignerWindowContentOffset,
  getEventsForType,
  getPrimaryDesignerEventBinding,
  getPrimaryEventNameForType,
  generateWindowXml,
  hasDesignerWindowMenu,
  normalizeWindowDesignerState
} from '../src/services/windowDesigner/windowDesignerService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingControl, LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';
import { WIN32_CONTROL_DEFINITIONS, createDefaultControlProperties } from '../src/services/windowDesigner/win32ControlRegistry';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { getWindowEventHandlerName, WINDOW_EVENT_CATEGORIES, WINDOW_EVENT_DEFINITIONS } from '../src/services/windowDesigner/windowEventRegistry';
import { createListViewPreviewModel } from '../src/services/windowDesigner/listViewPreviewModel';
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
  getControlTabSlot,
  getSelectedTabPage,
  getTabControlPages,
  isControlOnSelectedTab
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

  assert.doesNotMatch(cpp, /hidden-group|hidden-combo/u);
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
    .filter(definition => definition.moduleId === 'lingbuilder.win32.basic' || definition.moduleId === 'lingbuilder.win32.common-controls')
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
    ['itemHeight', 'contentPadding', 'scrollBarVisibility', 'scrollBarWidth', 'scrollBarTrackColor', 'scrollBarThumbColor', 'borderWidth', 'borderColor', 'selectionStartColor', 'selectionEndColor', 'selectionBorderColor', 'selectionCornerRadius']
      .map(key => [key, listBoxProperties.get(key)]),
    [
      ['itemHeight', 28],
      ['contentPadding', 4],
      ['scrollBarVisibility', 'auto'],
      ['scrollBarWidth', 8],
      ['scrollBarTrackColor', '#172033'],
      ['scrollBarThumbColor', '#0E7490'],
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
      items: ['第一项', '第二项'], selectedIndex: 0, sorted: false, multiple: false, itemHeight: 32, contentPadding: 6,
      scrollBarVisibility: 'visible', scrollBarWidth: 12, scrollBarTrackColor: '#111827', scrollBarThumbColor: '#06B6D4',
      borderWidth: 3, borderColor: '#475569', selectionStartColor: '#6D28D9',
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

  assert.match(cpp, /L"ListBox"[^\n]+, 3, RGB\(71, 85, 105\), RGB\(109, 40, 217\), RGB\(14, 116, 144\), RGB\(103, 232, 249\), 7, 32, 28, 6, 1, 12, RGB\(17, 24, 39\), RGB\(6, 182, 212\)[^\n]+RGB\(15, 23, 42\), (?:true|false), RGB\(226, 232, 240\)/u);
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
  assert.match(cpp, /LB_SETITEMHEIGHT, 0, ScaleForDpi\(control\.listItemHeight, dpi_\)/u);
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
  assert.match(cpp, /PaintOwnerComboBox\(reinterpret_cast<DRAWITEMSTRUCT\*>\(lParam\)\)/u);
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
        { ...createControl('label', 'container', 'Label'), name: '说明文本', content: '欢迎使用 👋', x: 40, y: 45 },
        { ...createControl('radio', 'container', 'RadioButton'), name: '主题选项', content: '深色主题', x: 40, y: 90, properties: { checked: true } },
        { ...createControl('list', 'container', 'ListBox'), name: '功能列表', content: '功能', x: 40, y: 130, properties: { items: ['新建项目', '打开项目'], selectedIndex: 1 } },
        { ...createControl('image', 'container', 'Image'), name: '封面图', content: '项目封面', x: 260, y: 130, properties: { imageSource: 'assets/cover.png', stretch: 'uniformToFill' } },
        { ...createControl('upload', 'container', 'Upload'), name: '文件上传', content: '上传附件', x: 40, y: 190, properties: { tip: '选择资料', initialFiles: ['readme.txt'], multiple: false, autoUpload: true, styleMode: '6', showFileList: true, showTip: true, showActions: true, dropEnabled: false, limit: 2, maxSizeKb: 2048, accept: '.txt' }, events: { FilesSelected: '_文件上传_文件已选择', UploadAction: '_文件上传_上传操作' } },
        { ...createControl('drag-upload', 'container', 'DragUpload'), name: '拖拽上传', content: '拖入图片', x: 260, y: 190, properties: { tip: '拖入图片文件', initialFiles: [], multiple: true, styleMode: '5', dropEnabled: true, accept: '.png;.jpg' } },
        { ...createControl('unsupported', undefined, 'ComboBox'), name: '旧下拉框', x: 40, y: 140 },
        { ...createControl('hidden-container', undefined, 'Grid'), visibility: 'Collapsed' },
        { ...createControl('hidden-label', 'hidden-container', 'Label'), content: '不应生成的隐藏子控件' }
      ]
    }]
  };
  const newEmojiModule: InstalledModule = {
    manifest: {
      schemaVersion: 2, id: 'lingbuilder.new_emoji.ui', name: 'new_emoji 原生界面库', version: '1.0.0',
      category: '界面', description: '测试模块',
      targets: [{ id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', includeDirs: ['include'] }]
    },
    installPath: 'C:/modules/lingbuilder.new_emoji.ui', isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: '类 MainWindow\n    事件 创建完毕()\n        调试输出("new_emoji 已创建")\n    结束\n    事件 _文件上传_文件已选择()\n        调试输出(NE_取最近上传选择文件())\n    结束\n    事件 _文件上传_上传操作()\n        调试输出("上传动作")\n    结束\n结束类',
    enabledModules: [newEmojiModule]
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';

  assert.match(cpp, /#include "new_emoji_bridge\.h"/);
  assert.match(cpp, /NE_创建深色窗口\(L"new_emoji 主窗口"/);
  assert.match(cpp, /NE_创建容器\(/);
  assert.match(cpp, /NE_创建文本\([^\n]+欢迎使用 👋/);
  assert.match(cpp, /NE_设置元素状态\(g_newEmojiWindow, ne_element_2, 1, 0/u);
  assert.match(cpp, /NE_创建单选框\([^\n]+L"深色主题", 1/);
  assert.match(cpp, /NE_创建列表框\([^\n]+L"功能", L"新建项目\|打开项目", 1/);
  assert.match(cpp, /NE_创建图片\([^\n]+L"assets\/cover\.png", L"项目封面", 1/);
  assert.match(cpp, /NE_创建上传\([^\n]+L"上传附件", L"选择资料", L"readme\.txt"/u);
  assert.match(cpp, /NE_设置上传选项\([^\n]+, 0, 1, 6, 1, 1, 1, 0, 2, 2048, L"\.txt"/u);
  assert.match(cpp, /NE_设置上传选项\([^\n]+, 1, 0, 5, 1, 1, 1, 1/u);
  assert.match(cpp, /static void __stdcall LB_UploadSelect_/u);
  assert.match(cpp, /NE_设置上传事件\([^\n]+LB_UploadSelect_[^\n]+LB_UploadAction_/u);
  assert.match(cpp, /NE_运行消息循环\(\)/);
  assert.doesNotMatch(cpp, /不应生成的隐藏子控件/u);
  assert.doesNotMatch(cpp, /class LingWindowBase/);
  assert.ok(generated.diagnostics.some(item => item.includes('旧下拉框') && item.includes('暂不支持')));
});

test('上传与拖拽上传控件注册完整属性和事件', () => {
  const upload = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'Upload');
  const dragUpload = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'DragUpload');
  assert.ok(upload);
  assert.ok(dragUpload);
  assert.equal(upload.moduleId, 'lingbuilder.win32.common-controls');
  assert.equal(upload.nativeAdapter, 'win32-upload');
  assert.equal(dragUpload.moduleId, 'lingbuilder.win32.common-controls');
  assert.equal(dragUpload.properties.find(property => property.key === 'dropEnabled')?.defaultValue, true);
  assert.deepEqual(upload.events.map(event => event.name), ['FilesSelected', 'UploadAction']);
  assert.ok(upload.properties.some(property => property.key === 'accept'));
  assert.ok(upload.properties.some(property => property.key === 'maxSizeKb'));
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
  assert.doesNotMatch(hiddenMarkup, /role="tablist"/u);
  assert.doesNotMatch(hiddenMarkup, />常规</u);
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
    { id: 'root', title: '根节点', children: [{ id: 'child', title: '子节点' }] },
    { id: 'second', title: '第二根节点' }
  ]);
  assert.deepEqual(flattenTreeViewNodes(nodes).map(item => [item.node.id, item.parentId, item.depth]), [
    ['root', undefined, 0], ['child', 'root', 1], ['second', undefined, 0]
  ]);

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
  assert.equal(state.project.windows[0].cornerStyle, 'rounded');
  assert.equal(state.project.windows[0].iconStyle, 'lingbuilder');
  assert.match(generateWindowXml(state.project.windows[0]), /标题栏颜色="#2D2D30"/u);
  assert.match(generateWindowXml(state.project.windows[0]), /窗口圆角="rounded"/u);
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
      background: '#1F2937', titleBarBackground: '#123456', titleBarForeground: '#FEDCBA',
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
  assert.match(cpp, /L"ListView"[^\n]+RGB\(15, 23, 42\), true, RGB\(226, 232, 240\)/u);
  assert.match(cpp, /ListView_SetBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextColor\(child, control\.foreground\)/u);
  assert.match(cpp, /PaintListViewHeader/u);
  assert.match(cpp, /CDRF_NOTIFYPOSTPAINT/u);
  assert.match(cpp, /Header_GetItemRect/u);
  assert.match(cpp, /CDRF_SKIPDEFAULT/u);
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
  assert.match(cpp, /message == WM_CTLCOLORSTATIC && control->backgroundTransparent && IsType\(\*control, L"Label"\)/u);
  assert.match(cpp, /SetBkMode\(hdc, TRANSPARENT\);/u);
  assert.match(cpp, /ResolveControlSurroundingBrush\(\*control, child\)/u);
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
    { ...createControl('tree', undefined, 'TreeView'), properties: { nodes: [{ id: 'root', title: '根节点', children: [{ id: 'child', title: '子节点' }] }], borderWidth: 3, borderColor: '#123456', nodeSpacing: 7, nodePadding: 5, showLines: true, checkBoxes: true, imageListId: 'main-icons' }, events: { Expanded: '_树_节点被展开' } },
    { ...createControl('date', undefined, 'DateTimePicker'), properties: createDefaultControlProperties('DateTimePicker') }
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
  assert.match(cpp, /L"ListView"[^\n]+, 3, RGB\(18, 52, 86\)[^\n]+, 32, 34, 4[^\n]+RGB\(15, 23, 42\), true, RGB/u);
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
  assert.match(cpp, /SetTimer\(hwnd_, 0x4C42, 900/);
  assert.doesNotMatch(cpp, /关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件/);
  assert.ok(generated.diagnostics.some(diagnostic => diagnostic.includes('lingbuilder.win32.common-controls') && diagnostic.includes('未静默降级')));
});

test('选项卡容器槽位、隐藏表头、Rebar、Pager 和 UpDown 生成真实父子控件联动', () => {
  const tab = { ...createControl('tabs', undefined, 'TabControl'), background: '#123456', foreground: '#fedcba', properties: { tabs: [{ id: 'general', title: '常规' }, { id: 'advanced', title: '高级' }], selectedIndex: 0, hideHeader: true } };
  const tabChild = { ...createControl('tab-child', 'tabs', 'Button'), containerSlot: 'advanced' };
  const rebar = { ...createControl('rebar', undefined, 'ReBar'), properties: { bands: [{ id: 'main-band', title: '主工具栏', childControl: 'toolbar', width: 260 }] } };
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
  assert.match(cpp, /if \(!\(control\.flags & CF_HIDE_TAB_HEADER\)\) TabCtrl_AdjustRect\(child, FALSE, &pageRect\)/u);
  assert.match(cpp, /WS_EX_CONTROLPARENT/u);
  assert.match(cpp, /FindTabPage\(parentSpec->id, control\.containerSlot\)/u);
  assert.match(cpp, /ShowWindow\(page\.hwnd, page\.slot == activeSlot \? SW_SHOW : SW_HIDE\)/u);
  assert.match(cpp, /message == WM_DRAWITEM \|\| message == WM_MEASUREITEM/u);
  assert.match(cpp, /SendMessageW\(self->hwnd_, message, wParam, lParam\)/u);
  assert.match(cpp, /PaintTabControl/u);
  assert.match(cpp, /CF_HIDE_TAB_HEADER = 1u << 28/u);
  assert.match(cpp, /if \(control\.flags & CF_HIDE_TAB_HEADER\)/u);
  assert.match(cpp, /ResolveTabBackground/u);
  assert.match(cpp, /PaintTabPage/u);
  assert.match(cpp, /COLORREF accent = RGB\(245, 158, 11\);/u);
  assert.match(cpp, /TCM_SETPADDING/u);
  assert.doesNotMatch(cpp, /TCS_OWNERDRAWFIXED/u);
  assert.doesNotMatch(cpp, /TCM_SETITEMSIZE/u);
  assert.doesNotMatch(cpp, /PaintOwnerTab/u);
  assert.match(cpp, /WS_CHILD \| WS_CLIPCHILDREN \| WS_CLIPSIBLINGS \| SS_NOTIFY/u);
  assert.match(cpp, /L"TabControl"[^\n]+RGB\(18, 52, 86\), false, RGB\(254, 220, 186\)/u);
  assert.match(cpp, /L"TabControl"[^\n]+268435456/u);
  assert.match(cpp, /L"advanced"/);
  assert.match(cpp, /RB_INSERTBANDW/);
  assert.match(cpp, /PGM_SETCHILD/);
  assert.match(cpp, /UDM_SETBUDDY/);
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

test('外壳控件使用独立工具栏命令、状态栏分区、Pager 尺寸和 RichEdit RTF 流', () => {
  const toolbar = { ...createControl('toolbar', undefined, 'ToolBar'), properties: { buttons: [{ id: 701, title: '保存', style: 'button', image: -1 }] } };
  const status = { ...createControl('status', undefined, 'StatusBar'), properties: { parts: [{ title: '就绪', width: 120 }, { title: 'UTF-8', width: 80 }] } };
  const pager = createControl('pager', undefined, 'Pager');
  const pagerChild = createControl('pager-child', 'pager', 'Button');
  const rich = { ...createControl('rich', undefined, 'RichEdit'), properties: { multiline: true, wordWrap: true, readOnly: false, scrollBars: 'vertical', rtfText: '{\\rtf1\\ansi\\b 加粗\\b0}', toolTip: '富文本提示', toolTipDelay: 250 } };
  const project: LingWindowProject = { schemaVersion: 2, id: 'shell-controls', name: '外壳控件', resources: [], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 800, height: 600, background: '#202028', description: '', controls: [toolbar, status, pager, pagerChild, rich] }] };
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /toolbarCommandOwners_/);
  assert.match(cpp, /toolbarCommandValues_/);
  assert.match(cpp, /状态栏_最后分区/u);
  assert.match(cpp, /NMMOUSE/);
  assert.match(cpp, /PGN_CALCSIZE/);
  assert.match(cpp, /EM_STREAMIN/);
  assert.match(cpp, /StreamRichEditData/);
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
        编辑框_表头.内容 = "1"
        控件_设置启用("保存按钮", 真)
        页面选项卡.设置选择项(到整数(编辑框_表头.内容))
        列表视图_添加行("数据列表", "服务\\t运行")
        树形框_添加节点("数据树", "", "根节点")
        选项卡_添加页("页面选项卡", "新增页")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /控件_设置文本\(L"保存按钮", L"立即保存"\)/u);
  assert.match(cpp, /控件_设置文本\(L"编辑框_表头", L"1"\)/u);
  assert.match(cpp, /控件_设置启用\(L"保存按钮", true\)/u);
  assert.match(cpp, /控件_设置选择项\(L"页面选项卡", 到整数\(控件_取文本\(L"编辑框_表头"\)\)\)/u);
  assert.match(cpp, /int 到整数\(const std::wstring& value\) const/u);
  assert.match(cpp, /列表视图_添加行\(L"数据列表", L"服务/u);
  assert.match(cpp, /树形框_添加节点\(L"数据树", L"", L"根节点"\)/u);
  assert.match(cpp, /选项卡_添加页\(L"页面选项卡", L"新增页"\)/u);
  assert.match(cpp, /const wchar_t\* name;/);
  assert.match(cpp, /return DefWindowProcW\(hwnd, message, wParam, lParam\);/);
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
