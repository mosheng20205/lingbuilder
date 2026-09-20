import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { LingControlType } from '../src/services/windowDesigner/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { getEventsForType } from '../src/services/windowDesigner/windowDesignerService';
import {
  WIN32_CONTROL_DEFINITIONS,
  getWin32ControlDefinition,
  supportsNativeControlFocusEvents
} from '../src/services/windowDesigner/win32ControlRegistry';

const CURRENT_WIN32_MODULE_IDS = new Set([
  'lingbuilder.win32.basic',
  'lingbuilder.win32.common-controls'
]);

test('基础与高级可视控件只暴露运行时可靠支持的通用事件', () => {
  const mouseEventNames = ['MouseDown', 'MouseEnter', 'MouseLeave'];
  const focusEventNames = ['GotFocus', 'LostFocus'];
  const specializedEventOnlyTypes = new Set(['ColorPicker', 'VideoPlayer']);
  const currentVisualControls = WIN32_CONTROL_DEFINITIONS.filter(definition => (
    !definition.legacyOnly
    && definition.isVisual !== false
    && CURRENT_WIN32_MODULE_IDS.has(definition.moduleId)
    && !specializedEventOnlyTypes.has(definition.type)
  ));

  currentVisualControls.forEach(definition => {
    const registeredEventNames = definition.events.map(event => event.name);
    const panelEventNames = getEventsForType(definition.type as LingControlType).map(event => event.name);
    mouseEventNames.forEach(eventName => {
      assert.ok(registeredEventNames.includes(eventName), `${definition.type} 缺少通用事件 ${eventName}`);
      assert.ok(panelEventNames.includes(eventName), `${definition.type} 事件面板缺少 ${eventName}`);
    });
    focusEventNames.forEach(eventName => {
      assert.equal(registeredEventNames.includes(eventName), supportsNativeControlFocusEvents(definition.type), `${definition.type} 的 ${eventName} 暴露状态不正确`);
      assert.equal(panelEventNames.includes(eventName), supportsNativeControlFocusEvents(definition.type), `${definition.type} 事件面板的 ${eventName} 暴露状态不正确`);
    });
  });

  (['Label', 'Image', 'AnimatedImage'] satisfies LingControlType[]).forEach(type => {
    assert.ok(getEventsForType(type).some(event => event.name === 'Click'), `${type} 必须显示被单击事件`);
  });
});

test('基础与高级模块清单完整复制注册表属性和事件', () => {
  CURRENT_WIN32_MODULE_IDS.forEach(moduleId => {
    const manifest = BUILTIN_MODULES.find(module => module.id === moduleId);
    assert.ok(manifest);
    const contributions = manifest.contributes?.designerControls || [];
    WIN32_CONTROL_DEFINITIONS
      .filter(definition => definition.moduleId === moduleId && !definition.legacyOnly)
      .forEach(definition => {
        const contribution = contributions.find(control => control.type === definition.type);
        assert.ok(contribution, `${moduleId} 缺少 ${definition.type} 贡献`);
        assert.deepEqual(contribution.properties, definition.properties);
        assert.deepEqual(
          contribution.events?.map(event => event.name),
          definition.events.map(event => event.name)
        );
      });
  });
});

test('高级非可视资源清单使用实际持久化属性键', () => {
  const propertyKeys = (type: string) => getWin32ControlDefinition(type)?.properties.map(property => property.key) || [];

  assert.deepEqual(propertyKeys('ToolTip'), ['text', 'targetControlId', 'initialDelay']);
  assert.deepEqual(propertyKeys('FileDialog'), ['ownerWindowId', 'triggerControlId', 'dropTargetId', 'title', 'filter', 'multiple', 'allowDrop']);
  assert.deepEqual(propertyKeys('ContextMenu'), ['ownerWindowId', 'targetControlId', 'items']);
  assert.deepEqual(propertyKeys('PopupMenu'), ['ownerWindowId', 'items']);
  assert.deepEqual(propertyKeys('PropertySheet'), ['title', 'pages']);
  // CEF3 无头资源的持久化键必须与 EdgeView 无头同口径（instanceId / proxyServer / autoStart），
  // 视口宽高是 CEF OSR 专有；改名或漏键会让生成期与已保存项目对不上。
  assert.deepEqual(propertyKeys('CefHeadlessBrowser'), ['ownerWindowId', 'instanceId', 'url', 'cacheDir', 'proxyServer', 'viewWidth', 'viewHeight', 'autoStart']);
  assert.deepEqual(getEventsForType('CefHeadlessBrowser'), [], '一期不派发事件，不得声明事件');
  assert.equal(getEventsForType('PropertySheet')[0]?.name, 'Applied');
});

test('属性页应用事件使用统一的一键创建与打开入口', async () => {
  const source = await fs.readFile(new URL('../src/components/WpfDesigner.tsx', import.meta.url), 'utf8');
  assert.match(source, /openPropertySheetAppliedEvent/u);
  assert.match(source, /eventName: 'Applied'/u);
  assert.match(source, /创建并打开.*属性页应用事件处理器/u);
  assert.doesNotMatch(source, /<input aria-label="属性页应用事件处理器"/u);
});

test('专用绘制控件不会截断已经公开的通用事件', () => {
  const generated = generateLingCppNativeWin32Project({
    schemaVersion: 2,
    id: 'common-event-runtime',
    name: '通用事件运行时',
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
  }, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  const subclassStart = cpp.indexOf('static LRESULT CALLBACK ControlSubclassProc(');
  const branch = (type: string, nextType: string) => {
    const start = cpp.indexOf(`if (IsType(*control, L"${type}"))`, subclassStart);
    const end = cpp.indexOf(`if (IsType(*control, L"${nextType}")`, start + 1);
    assert.ok(start >= 0 && end > start, `未找到 ${type} 的原生消息分支`);
    return cpp.slice(start, end);
  };

  assert.match(branch('HotKey', 'IPAddress'), /message == WM_SETFOCUS\) self->DispatchLingEvent\(\*control, L"GotFocus"\)/u);
  assert.match(branch('DateTimePicker', 'SysLink'), /message == WM_LBUTTONDOWN\) self->DispatchLingEvent\(\*control, L"MouseDown"\)/u);
  assert.match(branch('DateTimePicker', 'SysLink'), /DispatchLingEvent\(\*control, L"MouseEnter"\)/u);
  assert.match(branch('TabControl', 'ComboBox'), /message == WM_KILLFOCUS\) self->DispatchLingEvent\(\*control, L"LostFocus"\)/u);
});

test('平面滚动条在自身窗口过程处理标准滚动条消息', async () => {
  const source = await fs.readFile(new URL('../src/services/windowDesigner/lingCppWin32Project.ts', import.meta.url), 'utf8');
  assert.match(source, /IsType\(\*control, L"FlatScrollBar"\) && \(message == WM_HSCROLL \|\| message == WM_VSCROLL\)/u);
  assert.match(source, /FlatSB_SetScrollPos\(hwnd, bar, position, TRUE\);\s*self->DispatchLingEvent\(\*control, L"ValueChanged"\)/u);
});

test('日期属性使用原生日期时间输入并按显示格式生成 SYSTEMTIME', async () => {
  const definition = getWin32ControlDefinition('DateTimePicker');
  assert.equal(definition?.properties.find(property => property.key === 'value')?.type, 'date');

  const designerSource = await fs.readFile(new URL('../src/components/WpfDesigner.tsx', import.meta.url), 'utf8');
  assert.match(designerSource, /definition\.type === 'date'/u);
  assert.match(designerSource, /type=\{timeMode \? 'time' : 'date'\}/u);
  assert.match(designerSource, /step=\{timeMode \? 1 : undefined\}/u);

  const generated = generateLingCppNativeWin32Project({
    schemaVersion: 2,
    id: 'date-time-property',
    name: '日期时间属性',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口',
      width: 640, height: 480, background: '#202028', description: '',
      controls: [{
        id: 'time', type: 'DateTimePicker', name: '时间选择器', content: '',
        x: 20, y: 20, width: 180, height: 40, fontSize: 12,
        background: '#FFFFFF', foreground: '#202020', isEnabled: true, visibility: 'Visible',
        properties: { value: '14:05:09', format: 'time', customFormat: '', calendarHeight: 300 }
      }]
    }]
  }, { lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类' });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /ParseDateTimeValue\(const wchar_t\* value, const wchar_t\* format, SYSTEMTIME& result\)/u);
  assert.match(cpp, /wcscmp\(format, L"time"\) == 0/u);
  assert.match(cpp, /L"DateTimePicker", L"时间选择器"[^\n]+L"14:05:09"[^\n]+L"time"/u);
  assert.match(cpp, /ParseDateTimeValue\(control\.data, control\.option1, date\)/u);
});

test('属性面板枚举值保留稳定英文键但全部显示中文标签', () => {
  WIN32_CONTROL_DEFINITIONS
    .filter(definition => !definition.legacyOnly)
    .flatMap(definition => definition.properties.map(property => ({ definition, property })))
    .filter(({ property }) => property.type === 'enum')
    .forEach(({ definition, property }) => {
      property.options?.forEach(item => {
        if (/^[a-z][a-z0-9]*$/iu.test(item.value)) {
          assert.notEqual(item.label, item.value, `${definition.type}.${property.key}.${item.value} 仍显示英文标签`);
          assert.match(item.label, /[\u3400-\u9fff]/u, `${definition.type}.${property.key}.${item.value} 缺少中文标签`);
        }
      });
    });
});
