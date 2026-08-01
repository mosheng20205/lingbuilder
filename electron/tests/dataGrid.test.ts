import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DataGridDesignerPreview from '../src/components/DataGridDesignerPreview';
import DataGridEditorDialog from '../src/components/DataGridEditorDialog';
import { DATA_GRID_API, DATA_GRID_BINDINGS, DATA_GRID_COMMANDS } from '../src/services/modules/dataGridApiCatalog';
import {
  encodeDataGridDelimited,
  migrateLegacyNewEmojiTableProperties,
  moveDataGridColumn,
  normalizeDataGridModel,
  parseDataGridDelimited,
  removeDataGridColumn
} from '../src/services/windowDesigner/dataGridModel';
import { createDefaultControlProperties, getWin32ControlDefinition } from '../src/services/windowDesigner/win32ControlRegistry';
import { createControlToolboxGroups } from '../src/services/windowDesigner/controlToolboxModel';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { getNewEmojiUnsupportedControlDiagnostics } from '../src/services/windowDesigner/newEmojiDesignerAdapter';
import { getUiBackendCommandDiagnostics, NEW_EMOJI_UI_BACKEND_ID } from '../src/services/windowDesigner/uiBackendCommandContract';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingControl, LingWindowModel, LingWindowProject } from '../src/services/windowDesigner/types';

test('DataGrid model normalizes stable ids, typed cells and column mutations', () => {
  const model = normalizeDataGridModel({
    columns: [
      { id: 'value', title: '整数', type: 'integer', width: 80 },
      { id: 'value', title: '开关', type: 'switch', width: 90 },
      { id: 'progress', title: '进度', type: 'progress', width: 120, progressMinimum: 10, progressMaximum: 20 }
    ] as any,
    rows: [{ key: 'order-1', cells: { value: '42', value_2: '真', progress: 100 } }] as any
  });
  assert.deepEqual(model.columns.map(column => column.id), ['value', 'value_2', 'progress']);
  assert.deepEqual(model.columns.map(column => column.alignment), ['center', 'center', 'center']);
  assert.equal(model.rows[0].cells.value, 42);
  assert.equal(model.rows[0].cells.value_2, true);
  assert.equal(model.rows[0].cells.progress, 20);
  const moved = moveDataGridColumn(model, 2, 0);
  assert.equal(moved.columns[0].id, 'progress');
  const removed = removeDataGridColumn(moved, 'value_2');
  assert.equal(Object.hasOwn(removed.rows[0].cells, 'value_2'), false);
});

test('DataGrid CSV and TSV codecs preserve quotes, separators, newlines and backslashes', () => {
  const rows = [['名称', '说明'], ['A,1', '双引号"与实际\n换行\n以及\\路径'], ['制表', 'a\tb']];
  assert.deepEqual(parseDataGridDelimited(encodeDataGridDelimited(rows, ','), ','), rows);
  assert.deepEqual(parseDataGridDelimited(encodeDataGridDelimited(rows, '\t'), '\t'), rows);
});

test('legacy new_emoji Table migration only adds unified edit model', () => {
  const properties = migrateLegacyNewEmojiTableProperties({
    tableColumnsEx: [{ id: 'name', title: '名称', type: 'Text', width: 160 }, { id: 'enabled', title: '启用', type: 'Switch' }, { id: 'action', title: '操作', type: 'Buttons' }],
    tableRowsEx: [{ id: 'row-a', cells: ['订单 A'] }],
    originalRuntimeFlag: 'keep'
  });
  assert.equal(properties.dataGridSchemaVersion, 1);
  assert.equal((properties.dataGridColumns as any[])[0].id, 'name');
  assert.deepEqual((properties.dataGridColumns as any[]).map(column => column.type), ['text', 'switch', 'buttons']);
  assert.equal((properties.dataGridRows as any[])[0].key, 'row-a');
  assert.equal(properties.originalRuntimeFlag, 'keep');
});

test('combo stable values are preserved instead of being rewritten as identifiers', () => {
  const model = normalizeDataGridModel({ columns: [{ id: 'status', title: '状态', type: 'combo', width: 120, options: [{ value: 'ready to ship', label: '待发货' }] }] as any });
  assert.equal(model.columns[0].options?.[0].value, 'ready to ship');
});

test('image modes preserve tile and keep contain as the compatible default', () => {
  const model = normalizeDataGridModel({ columns: [
    { id: 'tile', title: '平铺图', type: 'image', imageMode: 'tile' },
    { id: 'default', title: '默认图', type: 'image' }
  ] as any });
  assert.equal(model.columns[0].imageMode, 'tile');
  assert.equal(model.columns[1].imageMode, 'contain');
});

test('DataGrid catalog keeps contributions, bindings and member metadata aligned', () => {
  assert.equal(DATA_GRID_API.length, 92);
  assert.deepEqual(DATA_GRID_COMMANDS.map(item => item.name), DATA_GRID_BINDINGS.map(item => item.command));
  assert.equal(new Set(DATA_GRID_API.map(item => item.name)).size, DATA_GRID_API.length);
  DATA_GRID_API.forEach(item => {
    assert.equal(item.parameters[0].name, '控件名');
    assert.equal(item.parameters[0].type, 'controlRef');
  });
  ['表格_取进度状态', '表格_取行是否选中', '表格_导入Excel', '表格_导出Excel'].forEach(name => assert.ok(DATA_GRID_API.some(item => item.name === name), `缺少接口：${name}`));
});

test('DataGrid appears in advanced toolbox and preview renders special cells', () => {
  const definition = getWin32ControlDefinition('DataGrid');
  assert.equal(definition?.nativeClass, 'LingBuilderDataGrid');
  assert.equal(definition?.properties.find(item => item.key === 'dataGridColumns')?.type, 'dataGridColumns');
  const groups = createControlToolboxGroups(['DataGrid'], false);
  assert.deepEqual(groups.find(group => group.id === 'advanced')?.controlTypes, ['DataGrid']);
  const control: LingControl = {
    id: 'grid', type: 'DataGrid', name: '订单表格', content: '', x: 0, y: 0, width: 600, height: 280,
    fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible',
    properties: {
      ...createDefaultControlProperties('DataGrid'),
      dataGridColumns: [
        { id: 'enabled', title: '启用', type: 'switch', width: 90 },
        { id: 'progress', title: '进度', type: 'progress', width: 140 },
        { id: 'action', title: '操作', type: 'buttons', width: 190, buttons: [{ id: 'view', text: '查看', style: 'primary' }, { id: 'delete', text: '删除', style: 'danger' }] }
      ],
      dataGridRows: [{ key: 'order-1', enabled: true, cells: { enabled: true, progress: 65, action: '' } }]
    }
  };
  const markup = renderToStaticMarkup(React.createElement(DataGridDesignerPreview, { control }));
  assert.match(markup, /data-data-grid-preview="true"/u);
  assert.match(markup, /data-column-alignment="center"/u);
  assert.match(markup, /data-cell-alignment="center"/u);
  assert.match(markup, /查看/u);
  assert.match(markup, /65/u);
});

test('DataGrid column editor visibly explains its top fields and actions', () => {
  const control: LingControl = {
    id: 'grid-editor', type: 'DataGrid', name: '订单表格', content: '', x: 0, y: 0, width: 600, height: 280,
    fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible',
    properties: {
      ...createDefaultControlProperties('DataGrid'),
      dataGridColumns: [{ id: 'picture', title: '图片', type: 'image', width: 120, imageMode: 'tile' }]
    }
  };
  const markup = renderToStaticMarkup(React.createElement(DataGridEditorDialog, {
    control, isDarkMode: true, onSave: () => undefined, onClose: () => undefined
  }));
  assert.match(markup, /填写说明/u);
  assert.match(markup, /列 ID（代码标识）/u);
  assert.match(markup, /列标题（显示名称）/u);
  assert.match(markup, /列宽度（px）/u);
  assert.match(markup, /列对齐/u);
  assert.match(markup, /第 1 列对齐/u);
  assert.match(markup, /<option value="left">居左<\/option><option value="center" selected="">居中<\/option><option value="right">居右<\/option>/u);
  assert.match(markup, /代码中通过表格_命令访问该列的唯一标识/u);
  assert.match(markup, /aria-label="上移第 1 列"/u);
  assert.match(markup, /title="删除当前列及其单元格数据"/u);
  assert.match(markup, /图片显示方式/u);
  assert.match(markup, /<option value="tile" selected="">平铺<\/option>/u);
  assert.match(markup, /等比缩放（完整显示）/u);
  assert.match(markup, /拉伸填充/u);
});

test('Win32 generator emits independent DataGrid HWND, virtualization, editors and all API symbols', () => {
  const grid: LingControl = {
    id: 'grid', type: 'DataGrid', name: '订单表格', content: '', x: 20, y: 20, width: 620, height: 300,
    fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Collapsed',
    properties: {
      ...createDefaultControlProperties('DataGrid'),
      dataGridColumns: [
        { id: 'selected', title: '选择', type: 'checkbox', width: 70 },
        { id: 'picture', title: '图片', type: 'image', width: 90 },
        { id: 'progress', title: '进度', type: 'progress', width: 130 },
        { id: 'action', title: '操作', type: 'buttons', width: 180, buttons: [{ id: 'view', text: '查看', style: 'primary' }] }
      ], dataGridRows: []
    },
    events: { CellButtonClick: '_订单表格_单元格按钮被单击' }
  };
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'datagrid-smoke', name: 'DataGrid smoke',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 760, height: 520, background: '#202028', description: '', controls: [grid] }]
  };
  const source = '类 主窗口 : 公开 窗体\n事件 _订单表格_单元格按钮被单击()\n调试输出(表格_取事件按钮ID("订单表格"))\n结束\n结束类';
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  assert.match(cpp, /RegisterLingBuilderDataGridClass/u);
  assert.match(cpp, /className = L"LingBuilderDataGrid"/u);
  assert.match(cpp, /CreateCompatibleBitmap/u);
  assert.match(cpp, /ResolveRuntimeAssetPath/u);
  assert.match(cpp, /DataGridFillRoundedRect/u);
  assert.match(cpp, /SmoothingModeAntiAlias/u);
  assert.match(cpp, /DataGridFillEllipse/u);
  assert.match(cpp, /DataGridPaintBitmap/u);
  assert.match(cpp, /mode==L"tile"/u);
  assert.match(cpp, /DataGridComboLabel/u);
  assert.match(cpp, /CB_SHOWDROPDOWN/u);
  assert.match(cpp, /CBS_OWNERDRAWFIXED/u);
  assert.match(cpp, /DataGridPaintComboItem/u);
  assert.match(cpp, /hoverRowKey/u);
  assert.match(cpp, /UpdateDataGridHover/u);
  assert.match(cpp, /TrackMouseEvent/u);
  assert.match(cpp, /FrameRect\(memory,&buttonRect/u);
  assert.match(cpp, /RGB\(248,250,252\)/u);
  assert.match(cpp, /notification == CBN_SELCHANGE|HIWORD\(wParam\)==CBN_SELCHANGE/u);
  assert.match(cpp, /L"ComboChanged"/u);
  assert.match(cpp, /DataGridTextAlignment\(column\.alignment\)/u);
  assert.match(cpp, /style\|=ES_CENTER/u);
  assert.match(cpp, /bool 表格_设置列对齐\(/u);
  assert.match(cpp, /first=std::max\(0,state\.scrollY/u);
  assert.match(cpp, /CreateWindowExW\(WS_EX_CLIENTEDGE,className/u);
  assert.match(cpp, /CLSID_Shell/u);
  assert.match(cpp, /spreadsheetml\/2006\/main/u);
  assert.match(cpp, /bool 表格_导入Excel\(/u);
  assert.match(cpp, /bool 表格_导出Excel\(/u);
  assert.match(cpp, /const wchar_t\* 表格_取进度状态\(/u);
  assert.match(cpp, /bool 表格_取行是否选中\(/u);
  DATA_GRID_API.forEach(item => assert.ok(cpp.includes(`${item.name}(`), `缺少 C++ 符号：${item.name}`));
});

test('new_emoji backend blocks Win32 DataGrid commands before generation', () => {
  const commonManifest = BUILTIN_MODULES.find(module => module.id === 'lingbuilder.win32.common-controls')!;
  const installed: InstalledModule = { manifest: commonManifest, installPath: 'builtin', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  const diagnostics = getUiBackendCommandDiagnostics(
    NEW_EMOJI_UI_BACKEND_ID,
    parseLingCpp('类 主窗口\n事件 测试()\n表格_取行数("订单表格")\n结束\n结束类').program,
    [installed]
  );
  assert.equal(diagnostics.length, 1);
  assert.match(diagnostics[0], /new_emoji 后端不支持命令“表格_取行数”/u);
});

test('legacy new_emoji Table with image columns is blocked before generation', () => {
  const window: LingWindowModel = {
    id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 480, background: '#202028', description: '',
    controls: [{ id: 'table', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '旧表格', content: '', x: 0, y: 0, width: 400, height: 220, fontSize: 12, background: '#fff', foreground: '#000', isEnabled: true, visibility: 'Visible', properties: { dataGridColumns: [{ id: 'picture', title: '图片', type: 'image', width: 100 }] } }]
  };
  assert.match(getNewEmojiUnsupportedControlDiagnostics(window).join('\n'), /不支持图片单元格/u);
});

test('workspace DataGrid demo covers every API and event and generates native C++', async () => {
  const workspaceRoot = path.resolve('..');
  const source = await fs.readFile(path.join(workspaceRoot, 'src', 'datagrid-api-demo', 'MainWindow.lcpp'), 'utf8');
  const project = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'projects', 'datagrid-api-demo', 'window-designer.json'), 'utf8')) as LingWindowProject;
  const solution = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), 'utf8')) as { projects: Array<{ id: string }> };
  assert.ok(solution.projects.some(item => item.id === 'datagrid-api-demo'));
  const calledCommands = new Set([...source.matchAll(/表格_[\p{L}\p{N}_]+\s*\(/gu)].map(match => match[0].replace(/\s*\($/u, '')));
  assert.deepEqual(DATA_GRID_API.map(item => item.name).filter(name => !calledCommands.has(name)), []);
  const dataGridEvents = getWin32ControlDefinition('DataGrid')!.events.slice(0, 16).map(event => event.name).sort();
  const boundEvents = project.windows.flatMap(window => window.controls.filter(control => control.type === 'DataGrid').flatMap(control => Object.keys(control.events || {}))).sort();
  assert.deepEqual([...new Set(boundEvents)].sort(), dataGridEvents);
  const enabledModules: InstalledModule[] = BUILTIN_MODULES
    .filter(module => module.id === 'lingbuilder.win32.basic' || module.id === 'lingbuilder.win32.common-controls')
    .map(manifest => ({ manifest, installPath: `builtin://${manifest.id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] }));
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')!.content;
  DATA_GRID_API.forEach(item => assert.ok(cpp.includes(`${item.name}(`), `示例生成结果缺少 ${item.name}`));
  assert.match(cpp, /LingCppWideArg\(虚拟行键\)/u);
  assert.match(cpp, /1000000/u);
  assert.match(cpp, /VirtualDataRequested/u);
  const controls = project.windows.flatMap(window => window.controls);
  const tabs = controls.find(control => control.type === 'TabControl' && control.name === '接口分类选项卡');
  assert.equal(Array.isArray(tabs?.properties?.tabs) ? tabs.properties.tabs.length : 0, 9);
  const apiButtons = controls.filter(control => control.type === 'Button' && control.id.startsWith('api-button-'));
  assert.equal(apiButtons.length, 86);
  assert.doesNotMatch(source, /运行全部/u);
  for (const button of apiButtons) {
    const handler = button.events?.Click;
    assert.ok(handler, `${button.name} 缺少单击处理器`);
    const escaped = handler!.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const method = source.match(new RegExp(`事件\\s+${escaped}\\(\\)([\\s\\S]*?)\\n\\s*结束`, 'u'))?.[1] || '';
    assert.equal([...method.matchAll(/表格_[\p{L}\p{N}_]+\s*\(/gu)].length, 1, `${button.name} 必须只调用一条 DataGrid 命令`);
  }
});
