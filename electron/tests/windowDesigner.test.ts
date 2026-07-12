import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildControlHierarchy,
  getControlDescendantIds,
  normalizeControlHierarchy
} from '../src/services/windowDesigner/controlHierarchy';
import { generateWindowXml, normalizeWindowDesignerState } from '../src/services/windowDesigner/windowDesignerService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingControl, LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';
import { WIN32_CONTROL_DEFINITIONS, createDefaultControlProperties } from '../src/services/windowDesigner/win32ControlRegistry';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';

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
    { ...createControl('list', undefined, 'ListView'), properties: { columns: [{ title: '名称', width: 160 }, { title: '状态', width: 90 }], items: [{ id: 'row1', cells: ['服务', '运行中'], image: 0 }], view: 'details', gridLines: true, multiple: false, imageListId: 'main-icons' }, events: { SelectionChanged: '_列表_选择项被改变', DoubleClick: '_列表_被双击' } },
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
