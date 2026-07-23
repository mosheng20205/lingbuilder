import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ListViewDesignerPreview from '../src/components/ListViewDesignerPreview';
import ListViewCollectionDialog from '../src/components/ListViewCollectionDialog';
import {
  buildControlHierarchy,
  getControlDescendantIds,
  normalizeControlHierarchy
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
  const registeredTypes = WIN32_CONTROL_DEFINITIONS.map(definition => definition.type);
  assert.equal(new Set(registeredTypes).size, registeredTypes.length, '控件 type 必须唯一');
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

test('编辑框垂直对齐默认居中并提供顶部、居中、底部选项', () => {
  const textBox = WIN32_CONTROL_DEFINITIONS.find(definition => definition.type === 'TextBox');
  assert.ok(textBox);
  const verticalAlign = textBox.properties.find(property => property.key === 'verticalAlign');
  assert.ok(verticalAlign);
  assert.equal(verticalAlign.type, 'enum');
  assert.equal(verticalAlign.defaultValue, 'center');
  assert.deepEqual(verticalAlign.options?.map(option => option.value), ['top', 'center', 'bottom']);
  assert.equal(createDefaultControlProperties('TextBox').verticalAlign, 'center');
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
      multiple: true
    }
  } satisfies LingControl;

  assert.deepEqual(createListViewPreviewModel(listView), {
    mode: 'details',
    gridLines: true,
    multiple: true,
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
  assert.match(cpp, /L"ListView"[^\n]+RGB\(15, 23, 42\), RGB\(226, 232, 240\)/u);
  assert.match(cpp, /ListView_SetBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextBkColor\(child, control\.background\)/u);
  assert.match(cpp, /ListView_SetTextColor\(child, control\.foreground\)/u);
  assert.match(cpp, /PaintListViewHeader/u);
  assert.match(cpp, /CDRF_NOTIFYPOSTPAINT/u);
  assert.match(cpp, /Header_GetItemRect/u);
  assert.match(cpp, /CDRF_SKIPDEFAULT/u);
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
    { ...createControl('list', undefined, 'ListView'), properties: { columns: [{ title: '名称', width: 160, alignment: 'center' }, { title: '状态', width: 90, alignment: 'right' }], items: [{ id: 'row1', cells: ['服务', '运行中'], image: 0 }], view: 'details', gridLines: true, multiple: false, imageListId: 'main-icons' }, events: { SelectionChanged: '_列表_选择项被改变', DoubleClick: '_列表_被双击' } },
    { ...createControl('tree', undefined, 'TreeView'), properties: { nodes: [{ id: 'root', title: '根节点', children: [{ id: 'child', title: '子节点' }] }], showLines: true, checkBoxes: true, imageListId: 'main-icons' }, events: { Expanded: '_树_节点被展开' } },
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
  assert.match(cpp, /bool alignFirstColumn/u);
  assert.match(cpp, /ListView_DeleteColumn\(child, 0\)/u);
  assert.match(cpp, /TreeView_InsertItem/);
  assert.match(cpp, /insertedItems\[row\[0\]\]/);
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

test('选项卡容器槽位、Rebar、Pager 和 UpDown 生成真实父子控件联动', () => {
  const tab = { ...createControl('tabs', undefined, 'TabControl'), properties: { tabs: [{ id: 'general', title: '常规' }, { id: 'advanced', title: '高级' }], selectedIndex: 0 } };
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
  const list = { ...createControl('data-list', undefined, 'ListView'), name: '数据列表', properties: { columns: [{ title: '名称' }, { title: '状态' }], items: [] } };
  const tree = { ...createControl('data-tree', undefined, 'TreeView'), name: '数据树', properties: { nodes: [] } };
  const tab = { ...createControl('pages', undefined, 'TabControl'), name: '页面选项卡', properties: { tabs: [] } };
  const project: LingWindowProject = { schemaVersion: 2, id: 'runtime-api', name: '运行属性 API', resources: [], windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '', events: { Loaded: '_主窗口_创建完毕' }, controls: [button, list, tree, tab] }] };
  const enabledModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(id => ({ manifest: BUILTIN_MODULES.find(module => module.id === id)!, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const source = `类 主窗口 : 公开 窗体
    事件 _主窗口_创建完毕()
        控件_设置文本("保存按钮", "立即保存")
        控件_设置启用("保存按钮", 真)
        控件_设置选择项("数据列表", 0)
        列表视图_添加行("数据列表", "服务\\t运行")
        树形框_添加节点("数据树", "", "根节点")
        选项卡_添加页("页面选项卡", "新增页")
    结束
结束类`;
  const cpp = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules }).files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /控件_设置文本\(L"保存按钮", L"立即保存"\)/u);
  assert.match(cpp, /控件_设置启用\(L"保存按钮", true\)/u);
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
