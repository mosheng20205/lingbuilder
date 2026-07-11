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
    { ...createControl('list', undefined, 'ListView'), properties: { columns: [{ title: '名称' }, { title: '状态' }], items: [], view: 'details', gridLines: true, multiple: false }, events: { SelectionChanged: '_列表_选择项被改变', DoubleClick: '_列表_被双击' } },
    { ...createControl('tree', undefined, 'TreeView'), properties: { nodes: [{ title: '根节点', children: [{ title: '子节点' }] }], showLines: true, checkBoxes: true }, events: { Expanded: '_树_节点被展开' } },
    { ...createControl('date', undefined, 'DateTimePicker'), properties: createDefaultControlProperties('DateTimePicker') }
  ];
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'advanced', name: '高级控件', windows: [{
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
  assert.match(cpp, /L"名称\\n状态"/);
  assert.ok(generated.diagnostics.some(diagnostic => diagnostic.includes('lingbuilder.win32.common-controls') && diagnostic.includes('未静默降级')));
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
