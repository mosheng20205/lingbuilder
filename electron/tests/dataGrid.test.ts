import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DataGridDesignerPreview from '../src/components/DataGridDesignerPreview';
import DataGridEditorDialog from '../src/components/DataGridEditorDialog';
import NewEmojiTableEditorDialog, { getNewEmojiTableEditorData, serializeNewEmojiTableProperties } from '../src/components/NewEmojiTableEditorDialog';
import NewEmojiDesignerControlPreview from '../src/components/NewEmojiDesignerControlPreview';
import { getNewEmojiThemePreview } from '../src/services/windowDesigner/newEmojiDesignerAdapter';
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

test('new_emoji Table editor exposes structured columns, typed cells and batch import', () => {
  const control: LingControl = {
    id: 'new-emoji-table-editor', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '订单表格', content: '', x: 0, y: 0, width: 520, height: 260,
    fontSize: 12, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
    properties: {
      columns: ['名称', '状态'],
      rows: ['待处理\t订单 A'],
      tableColumnsEx: [
        { id: 'status', title: '状态', type: 'combo', width: 140, options: [{ value: 'pending', label: '待处理' }] },
        { id: 'name', title: '名称', type: 'text', width: 180 }
      ],
      tableRowsEx: [{ id: 'order-a', enabled: true, cells: ['pending', '订单 A'] }]
    }
  };
  const markup = renderToStaticMarkup(React.createElement(NewEmojiTableEditorDialog, {
    control, isDarkMode: true, onSave: () => undefined, onClose: () => undefined
  }));
  assert.match(markup, /列配置/u);
  assert.match(markup, /行数据/u);
  assert.match(markup, /列专属配置/u);
  assert.match(markup, /组合框选项/u);
  assert.match(markup, /待处理/u);
  assert.deepEqual(getNewEmojiTableEditorData(control), { columns: 2, rows: 1 });
});

test('new_emoji Table designer preview renders structured columns, rows and alignment live', () => {
  const control: LingControl = {
    id: 'new-emoji-table-preview', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '表格1', content: '', x: 0, y: 0, width: 540, height: 280,
    fontSize: 12, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
    properties: {
      dataGridColumns: [
        { id: 'column1', title: '列 1', type: 'text', width: 140, alignment: 'center' },
        { id: 'column2', title: '列 2', type: 'text', width: 120, alignment: 'right' },
        { id: 'hidden', title: '隐藏列', type: 'text', width: 100, visible: false }
      ],
      dataGridRows: [
        { key: 'r1', enabled: true, cells: { column1: '单元格 A1', column2: '单元格 B1', hidden: 'x' } },
        { key: 'r2', enabled: false, cells: { column1: '单元格 A2', column2: '单元格 B2', hidden: 'x' } }
      ]
    }
  };
  const markup = renderToStaticMarkup(React.createElement(NewEmojiDesignerControlPreview, {
    control, isEnabled: true, theme: getNewEmojiThemePreview('#242941')
  }));
  assert.match(markup, /data-new-emoji-preview="Table"/u);
  // 列标题、列宽与对齐直接来自结构化属性（历史缺陷：画布只渲染硬编码演示数据）。
  assert.match(markup, /列 1/u);
  assert.match(markup, /width:140px/u);
  assert.match(markup, /text-align:center/u);
  assert.match(markup, /text-align:right/u);
  assert.match(markup, /单元格 A1/u);
  assert.match(markup, /单元格 B2/u);
  // 不可见列与旧演示占位都不出现。
  assert.doesNotMatch(markup, /隐藏列/u);
  assert.doesNotMatch(markup, /示例项目/u);
});

test('new_emoji 十个数据型预览实时消费设计器属性而不渲染硬编码演示', () => {
  const renderWith = (kind: string, properties: Record<string, unknown>) => renderToStaticMarkup(React.createElement(NewEmojiDesignerControlPreview, {
    control: {
      id: `pv-${kind}`, type: 'Label', designerType: `lingbuilder.new_emoji.ui/${kind}`, name: kind, content: '',
      x: 0, y: 0, width: 320, height: 200, fontSize: 12, background: '#202028', foreground: '#F8FAFC',
      isEnabled: true, visibility: 'Visible', properties
    } as unknown as LingControl,
    isEnabled: true, theme: getNewEmojiThemePreview('#242941')
  }));
  // 数据集合类：items/points/steps 按运行时同口径解析并渲染。
  assert.match(renderWith('Tree', { items: ['根节点\t0', '子节点\t1'], selectedIndex: 1 }), /子节点/);
  assert.match(renderWith('Timeline', { items: ['需求评审', '开发完成'] }), /需求评审/);
  assert.match(renderWith('LineChart', { points: ['一月\t12', '二月\t30'], title: '销量' }), /销量/);
  assert.match(renderWith('Descriptions', { items: ['版本=2.0.0'], title: '信息' }), /2\.0\.0/);
  assert.match(renderWith('Mentions', { value: '请 @王五 审核', trigger: '@', open: true, suggestions: ['王五'] }), /王五/);
  assert.match(renderWith('Cascader', { options: ['省 / 市'], selected: '浙江 / 杭州' }), /浙江 \/ 杭州/);
  assert.match(renderWith('Anchor', { items: ['第一章', '第二章'], activeIndex: 1 }), /第二章/);
  assert.match(renderWith('Affix', { title: '固定标题', body: ['说明文字'] }), /固定标题/);
  assert.match(renderWith('Tour', { steps: ['创建项目', '配置模块'], activeIndex: 1 }), /配置模块/);
  assert.match(renderWith('Tour', { steps: ['创建项目'], activeIndex: 0 }), /1\/1/);
  // 布尔/数值类属性驱动预览形态。
  assert.match(renderWith('Skeleton', { rows: 3 }), /animate-pulse/u);
  assert.doesNotMatch(renderWith('Skeleton', { rows: 3, animated: false }), /animate-pulse/u);
  // 旧硬编码演示数据不再出现。
  assert.doesNotMatch(renderWith('Timeline', { items: ['需求评审'] }), /构建成功/u);
  assert.doesNotMatch(renderWith('Descriptions', { items: ['版本=2.0.0'] }), /New Emoji/u);
});

test('new_emoji Table serialization keeps typed advanced column metadata and legacy runtime fields', () => {
  const model = normalizeDataGridModel({
    columns: [{
      id: 'status', title: '状态', type: 'combo', width: 140, options: [{ value: 'ready to ship', label: '待发货' }],
      allowCustomInput: true, visible: true, sortable: true, filterable: true, required: true
    }] as any,
    rows: [{ key: 'order-1', enabled: false, cells: { status: 'ready to ship' } }] as any
  });
  const properties = serializeNewEmojiTableProperties(model);
  const columns = properties.tableColumnsEx as any[];
  const rows = properties.tableRowsEx as any[];
  assert.equal((properties.columns as string[])[0], '状态');
  assert.equal((properties.rows as string[])[0], 'ready to ship');
  assert.equal(columns[0].id, 'status');
  assert.equal(columns[0].allowCustomInput, true);
  assert.deepEqual(columns[0].options, [{ value: 'ready to ship', label: '待发货' }]);
  assert.deepEqual(rows[0], { id: 'order-1', enabled: false, cells: ['ready to ship'] });
});

test('new_emoji Table generator forwards structured data through the Ex kv protocol', async () => {
  const workspaceRoot = path.resolve('..');
  const manifestPath = path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const table = manifest.contributes.designerControls.find((item: { namespacedType?: string }) => item.namespacedType === 'lingbuilder.new_emoji.ui/Table');
  assert.ok(table);
  const installedModule: InstalledModule = {
    manifest,
    installPath: path.dirname(manifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-table-fallback',
    name: 'new_emoji Table fallback',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 420, background: '#202028', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'table', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '订单表格', content: '表格', x: 20, y: 20, width: 460, height: 240,
        fontSize: 12, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
        properties: {
          ...table.defaultProps,
          columns: [], rows: [], tableColumnsEx: [], tableRowsEx: [],
          dataGridColumns: [{ id: 'name', title: '名称', type: 'text', width: 160 }, { id: 'status', title: '状态', type: 'text', width: 120 }],
          dataGridRows: [{ key: 'order-1', enabled: true, cells: { name: '订单 A', status: '待处理' } }]
        }, events: {}
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [installedModule],
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /EU_CreateTable\(g_newEmojiWindow/u);
  // 结构化列/行必须完整翻译为 Ex kv 协议（列对齐、宽度一并下发），而不是只发基础标题文本。
  assert.match(cpp, /EU_SetTableColumnsEx\(g_newEmojiWindow/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"title=名称\\tkey=name\\twidth=160\\talign=center\\tsortable=1\\tfilterable=1\\ntitle=状态/u);
  assert.match(cpp, /EU_SetTableRowsEx\(g_newEmojiWindow/u);
  assert.match(cpp, /LB_NE_ToUtf8\(L"key=order-1\\tc0=订单 A\\tc1=待处理"/u);
  // 基础 EU_SetTableData 只含标题与 Tab 行文本，会被 Ex 覆盖，结构化数据存在时不再生成。
  assert.doesNotMatch(cpp, /EU_SetTableData\(g_newEmojiWindow/u);
});

test('new_emoji Table Ex kv protocol carries alignment, frozen, type, hidden and escaping', async () => {
  const workspaceRoot = path.resolve('..');
  const manifestPath = path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const table = manifest.contributes.designerControls.find((item: { namespacedType?: string }) => item.namespacedType === 'lingbuilder.new_emoji.ui/Table');
  assert.ok(table);
  const installedModule: InstalledModule = {
    manifest,
    installPath: path.dirname(manifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-table-kv-protocol',
    name: 'new_emoji Table kv protocol',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 420, background: '#202028', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'table', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '演示表格', content: '表格', x: 20, y: 20, width: 460, height: 240,
        fontSize: 12, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
        properties: {
          ...table.defaultProps,
          tableColumnsEx: [], tableRowsEx: [],
          dataGridColumns: [
            { id: 'name', title: '名称', type: 'text', width: 160, alignment: 'left', readOnly: true },
            { id: 'value', title: '数值', type: 'integer', width: 90, alignment: 'right' },
            { id: 'status', title: '状态', type: 'checkbox', width: 80, alignment: 'center', frozen: true },
            { id: 'action', title: '操作', type: 'buttons', width: 120, alignment: 'center', buttons: [{ id: 'view', text: '查看', style: 'primary' }] },
            { id: 'ghost', title: '隐藏列', type: 'text', width: 80, visible: false }
          ],
          dataGridRows: [{ key: 'r1', enabled: false, cells: { name: 'A\tB', value: 12, status: true, action: '', ghost: '隐藏' } }]
        }, events: {}
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [installedModule],
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // 列对齐显式下发（运行时文本列默认居左）；冻结映射 fixed=left；选择框映射 type=selection。
  assert.match(cpp, /title=名称\\tkey=name\\twidth=160\\talign=left\\tsortable=1/u);
  assert.match(cpp, /title=数值\\tkey=value\\twidth=90\\talign=right/u);
  assert.match(cpp, /title=状态\\tkey=status\\twidth=80\\talign=center\\tfixed=left\\ttype=selection/u);
  // 不可见列不进入协议，行单元格按可见列重新编号；按钮组单元格回退为列定义按钮文字。
  // 单元格中的真实制表符先经 kv 转义（\t）再经 C++ 字面量转义（\\t），源码里是两个反斜杠。
  assert.doesNotMatch(cpp, /隐藏列/u);
  assert.match(cpp, /key=r1\\tdisabled=1\\tc0=A\\\\tB\\tc1=12\\tc2=1\\tc3=查看/u);
  // 「只读」列映射为双击编辑关闭（按可见列序号）。
  assert.match(cpp, /EU_SetTableColumnDoubleClickEdit\(g_newEmojiWindow, [A-Za-z0-9_]+, 0, 0\)/u);
});

test('new_emoji Table keeps legacy string Ex data compatible', async () => {
  const workspaceRoot = path.resolve('..');
  const manifestPath = path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  const table = manifest.contributes.designerControls.find((item: { namespacedType?: string }) => item.namespacedType === 'lingbuilder.new_emoji.ui/Table');
  assert.ok(table);
  const installedModule: InstalledModule = {
    manifest,
    installPath: path.dirname(manifestPath),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-table-legacy-ex',
    name: 'new_emoji Table legacy Ex',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: '主窗口', title: '主窗口', width: 640, height: 420, background: '#202028', description: '', designerBackend: 'new-emoji',
      controls: [{
        id: 'table', type: 'Grid', designerType: 'lingbuilder.new_emoji.ui/Table', name: '旧表格', content: '表格', x: 20, y: 20, width: 460, height: 240,
        fontSize: 12, background: '#202028', foreground: '#F8FAFC', isEnabled: true, visibility: 'Visible',
        properties: {
          ...table.defaultProps,
          columns: ['名称'], rows: ['订单 A'], tableColumnsEx: ['名称'], tableRowsEx: ['订单 A']
        }, events: {}
      }]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [installedModule],
    lingCppSourceCode: '类 主窗口 : 公开 窗体\n结束类'
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.match(cpp, /EU_SetTableColumnsEx\(g_newEmojiWindow/u);
  assert.match(cpp, /EU_SetTableRowsEx\(g_newEmojiWindow/u);
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
        { id: 'selected', title: '选择', type: 'checkbox', width: 70, frozen: true },
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
  assert.match(cpp, /if\(column\.frozen\)\{RECT frozenRect=\{x,top,x\+width,top\+rowHeight\};FillRect\(memory,&frozenRect,rowBrush\);\}/u);
  assert.match(cpp, /if\(column\.frozen\)\{RECT frozenRect=\{x,0,x\+width,header\};FillRect\(memory,&frozenRect,headerBrush\);\}/u);
  assert.match(cpp, /DataGridFillRoundedRect/u);
  assert.match(cpp, /SmoothingModeAntiAlias/u);
  assert.match(cpp, /barHeight=std::max\(1,std::min\(ScaleForDpi\(16,dpi_\)/u);
  assert.match(cpp, /DrawTextW\(memory,value\.c_str\(\),-1,&rect,DT_CENTER\|DT_SINGLELINE\|DT_VCENTER\|DT_NOPREFIX\)/u);
  assert.doesNotMatch(cpp, /DrawTextW\(memory,value\.c_str\(\),-1,&bar/u);
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
  assert.match(cpp, /GetTextExtentPoint32W\(target,text\.c_str\(\)/u);
  assert.match(cpp, /DataGridLayoutButtons\(memory,buttons,buttonCell\)/u);
  assert.match(cpp, /DataGridButtonAt\(runtime,row,column,mouseX,mouseY,rect\)/u);
  assert.doesNotMatch(cpp, /std::min\(80,std::max\(42,static_cast<int>\(button\.text\.size\(\)\)\*12\+16\)\)/u);
  assert.match(cpp, /buttonRadius=ScaleForDpi\(4,dpi_\)/u);
  assert.match(cpp, /DataGridFillRoundedRect\(memory,buttonRect,buttonRadius,buttonBackground\)/u);
  assert.match(cpp, /DataGridStrokeRoundedRect\(memory,buttonRect,buttonRadius,buttonBorder\)/u);
  assert.match(cpp, /DataGridFillRoundedRect\(memory,more,buttonRadius,RGB\(51,65,85\)\)/u);
  assert.match(cpp, /DataGridStrokeRoundedRect\(memory,more,buttonRadius,RGB\(100,116,139\)\)/u);
  assert.doesNotMatch(cpp, /FillRect\(memory,&buttonRect/u);
  assert.doesNotMatch(cpp, /FrameRect\(memory,&buttonRect/u);
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
