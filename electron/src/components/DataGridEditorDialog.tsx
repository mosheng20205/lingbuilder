import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';
import DataGridDesignerPreview from './DataGridDesignerPreview';
import type { LingControl } from '../services/windowDesigner/types';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  DATA_GRID_SCHEMA_VERSION,
  moveDataGridColumn,
  normalizeDataGridColumns,
  normalizeDataGridModel,
  removeDataGridColumn,
  type DataGridButtonDefinition,
  type DataGridAlignment,
  type DataGridCellValue,
  type DataGridColumn,
  type DataGridColumnType,
  type DataGridImageMode,
  type DataGridModel,
  type DataGridOption
} from '../services/windowDesigner/dataGridModel';

const COLUMN_TYPES: Array<{ value: DataGridColumnType; label: string }> = [
  { value: 'text', label: '文本' }, { value: 'integer', label: '整数' }, { value: 'decimal', label: '小数' },
  { value: 'date', label: '日期' }, { value: 'checkbox', label: '选择框' }, { value: 'switch', label: 'Switch' },
  { value: 'image', label: '图片' }, { value: 'progress', label: '进度条' }, { value: 'combo', label: '组合框' }, { value: 'buttons', label: '按钮组' }
];

const IMAGE_MODES: Array<{ value: DataGridImageMode; label: string }> = [
  { value: 'tile', label: '平铺' },
  { value: 'contain', label: '等比缩放（完整显示）' },
  { value: 'cover', label: '等比缩放（铺满裁剪）' },
  { value: 'center', label: '原始大小居中' },
  { value: 'stretch', label: '拉伸填充' }
];

const createColumn = (columns: DataGridColumn[]): DataGridColumn => {
  let index = columns.length + 1;
  while (columns.some(column => column.id === `column${index}`)) index += 1;
  return normalizeDataGridColumns([{ id: `column${index}`, title: `列 ${index}`, type: 'text', width: 140 }])[0];
};

const createRowKey = (model: DataGridModel) => {
  let index = model.rows.length + 1;
  while (model.rows.some(row => row.key === `row${index}`)) index += 1;
  return `row${index}`;
};

function parseOptions(text: string): DataGridOption[] {
  return text.split(/\r?\n/u).map(line => line.split('\t')).filter(parts => parts[0]?.trim()).map(parts => ({ value: parts[0].trim(), label: (parts[1] ?? parts[0]).trim() }));
}

function optionsText(options?: DataGridOption[]) {
  return (options || []).map(option => `${option.value}\t${option.label}`).join('\n');
}

function parseButtons(text: string): DataGridButtonDefinition[] {
  return text.split(/\r?\n/u).map(line => line.split('\t')).filter(parts => parts[0]?.trim()).map(parts => ({
    id: parts[0].trim(), text: (parts[1] || parts[0]).trim(),
    style: parts[2] === 'primary' || parts[2] === 'danger' ? parts[2] : 'normal', enabled: true, visible: true
  }));
}

function buttonsText(buttons?: DataGridButtonDefinition[]) {
  return (buttons || []).map(button => `${button.id}\t${button.text}\t${button.style}`).join('\n');
}

export default function DataGridEditorDialog({ control, isDarkMode, onSave, onClose }: {
  control: LingControl;
  isDarkMode: boolean;
  onSave: (properties: Record<string, Win32ControlPropertyValue>) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'columns' | 'rows' | 'cells'>('columns');
  const [model, setModel] = useState(() => normalizeDataGridModel({
    columns: control.properties?.dataGridColumns as any,
    rows: control.properties?.dataGridRows as any,
    selectionMode: control.properties?.selectionMode as any,
    emptyText: control.properties?.emptyText as any,
    virtualMode: control.properties?.virtualMode as any,
    virtualRowCount: control.properties?.virtualRowCount as any
  }));
  const [selectedRowKey, setSelectedRowKey] = useState(model.rows[0]?.key || '');
  const [selectedColumnId, setSelectedColumnId] = useState(model.columns[0]?.id || '');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [onClose]);

  const previewControl = useMemo<LingControl>(() => ({ ...control, properties: {
    ...(control.properties || {}), dataGridSchemaVersion: DATA_GRID_SCHEMA_VERSION,
    dataGridColumns: model.columns as unknown as Win32ControlPropertyValue,
    dataGridRows: model.rows as unknown as Win32ControlPropertyValue,
    selectionMode: model.selectionMode, emptyText: model.emptyText,
    virtualMode: model.virtualMode, virtualRowCount: model.virtualRowCount
  } }), [control, model]);
  const inputClass = `h-8 min-w-0 rounded border px-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500 ${isDarkMode ? 'border-[#44444d] bg-[#17171c] text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`;
  const buttonClass = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs ${isDarkMode ? 'border-[#484852] bg-[#292930] text-slate-200 hover:bg-[#35353d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`;

  const updateColumn = (id: string, fields: Partial<DataGridColumn>) => setModel(current => ({ ...current, columns: current.columns.map(column => column.id === id ? { ...column, ...fields } : column) }));
  const renameColumn = (id: string, nextId: string) => setModel(current => {
    const normalized = nextId.trim();
    if (!normalized || (normalized !== id && current.columns.some(column => column.id === normalized))) return current;
    return {
      ...current,
      columns: current.columns.map(column => column.id === id ? { ...column, id: normalized } : column),
      rows: current.rows.map(row => {
        const cells = { ...row.cells, [normalized]: row.cells[id] ?? '' };
        delete cells[id];
        const cellOverrides = { ...(row.cellOverrides || {}) };
        if (cellOverrides[id]) { cellOverrides[normalized] = cellOverrides[id]; delete cellOverrides[id]; }
        return { ...row, cells, cellOverrides };
      })
    };
  });
  const addRow = () => setModel(current => {
    const key = createRowKey(current);
    return { ...current, rows: [...current.rows, { key, enabled: true, cells: Object.fromEntries(current.columns.map(column => [column.id, column.type === 'checkbox' && column.threeState ? null : column.type === 'checkbox' || column.type === 'switch' ? false : column.type === 'integer' || column.type === 'decimal' || column.type === 'progress' ? 0 : ''])) }] };
  });
  const updateCell = (rowKey: string, columnId: string, value: DataGridCellValue) => setModel(current => ({ ...current, rows: current.rows.map(row => row.key === rowKey ? { ...row, cells: { ...row.cells, [columnId]: value } } : row) }));
  const selectedRow = model.rows.find(row => row.key === selectedRowKey);
  const selectedColumn = model.columns.find(column => column.id === selectedColumnId);
  const selectedOverride = selectedRow?.cellOverrides?.[selectedColumnId] || {};
  const updateOverride = (fields: Record<string, unknown>) => setModel(current => ({ ...current, rows: current.rows.map(row => row.key === selectedRowKey ? { ...row, cellOverrides: { ...(row.cellOverrides || {}), [selectedColumnId]: { ...(row.cellOverrides?.[selectedColumnId] || {}), ...fields } } } : row) }));

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3" role="presentation">
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`编辑数据表格 ${control.name}`} className={`flex max-h-[94vh] w-[min(1180px,96vw)] flex-col overflow-hidden rounded-xl border shadow-2xl ${isDarkMode ? 'border-[#44444d] bg-[#202027] text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}>
      <header className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}><div><h2 className="text-sm font-semibold">数据表格结构化编辑器</h2><p className="text-[10px] text-slate-500">{control.name} · schema v1 · 行键 + 列 ID</p></div><button type="button" aria-label="关闭数据表格编辑器" onClick={onClose} className="ml-auto rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button></header>
      <div className="flex flex-wrap gap-1 border-b px-4 pt-2"><button className={`${buttonClass} ${tab === 'columns' ? 'border-cyan-500 text-cyan-400' : ''}`} onClick={() => setTab('columns')}>列配置</button><button className={`${buttonClass} ${tab === 'rows' ? 'border-cyan-500 text-cyan-400' : ''}`} onClick={() => setTab('rows')}>初始数据</button><button className={`${buttonClass} ${tab === 'cells' ? 'border-cyan-500 text-cyan-400' : ''}`} onClick={() => setTab('cells')}>单元格配置</button></div>
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-auto p-4">
          {tab === 'columns' && <div className="space-y-3">
            <div className={`rounded-lg border px-3 py-2 text-[11px] leading-5 ${isDarkMode ? 'border-cyan-900/60 bg-cyan-950/20 text-slate-300' : 'border-cyan-200 bg-cyan-50 text-slate-600'}`}>
              <strong className={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}>填写说明：</strong>
              列 ID 是代码访问单元格时使用的唯一稳定标识；列标题是运行时表头显示的文字。鼠标悬停字段可查看详细说明。
            </div>
            <div className={`sticky top-0 z-10 hidden grid-cols-[105px_minmax(115px,1fr)_105px_82px_88px_auto] gap-2 rounded-lg border px-3 py-2 text-[10px] font-medium sm:grid ${isDarkMode ? 'border-[#3b3b44] bg-[#292930] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              <span title="列 ID：代码中通过表格_命令访问该列的唯一标识，建议保存后保持稳定。">列 ID（代码标识）</span>
              <span title="列标题：显示在数据表格表头中的中文名称，可以随时修改。">列标题（显示名称）</span>
              <span title="列类型：决定单元格的数据类型、绘制方式和编辑器。">列类型</span>
              <span title="列宽度：运行时列的初始宽度，单位为像素，最小 32。">列宽度（px）</span>
              <span title="列对齐：控制表头和单元格内容的水平位置，默认居中。">列对齐</span>
              <span title="调整列的先后顺序，或删除当前列。">顺序 / 删除</span>
            </div>
            {model.columns.map((column, columnIndex) => <div key={column.id} className={`rounded-lg border p-3 ${isDarkMode ? 'border-[#3b3b44]' : 'border-slate-200'}`}>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[105px_minmax(115px,1fr)_105px_82px_88px_auto]">
                <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">列 ID（代码标识）</span><input aria-label={`第 ${columnIndex + 1} 列 ID`} title="代码中通过表格_命令访问该列的唯一标识，建议保存后保持稳定。" defaultValue={column.id} onBlur={event => renameColumn(column.id, event.target.value)} className={`${inputClass} w-full`} /></label>
                <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">列标题（显示名称）</span><input aria-label={`第 ${columnIndex + 1} 列标题`} title="显示在数据表格表头中的中文名称，可以随时修改。" value={column.title} onChange={event => updateColumn(column.id, { title: event.target.value })} className={`${inputClass} w-full`} /></label>
                <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">列类型</span><select aria-label={`第 ${columnIndex + 1} 列类型`} title="决定单元格的数据类型、绘制方式和编辑器。" value={column.type} onChange={event => updateColumn(column.id, { type: event.target.value as DataGridColumnType })} className={`${inputClass} w-full`}>{COLUMN_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
                <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">列宽度（px）</span><input aria-label={`第 ${columnIndex + 1} 列宽度`} title="运行时列的初始宽度，单位为像素，最小 32。" type="number" min={32} value={column.width} onChange={event => updateColumn(column.id, { width: Math.max(32, Number(event.target.value) || 32) })} className={`${inputClass} w-full`} /></label>
                <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">列对齐</span><select aria-label={`第 ${columnIndex + 1} 列对齐`} title="控制表头和单元格内容的水平位置，默认居中。" value={column.alignment} onChange={event => updateColumn(column.id, { alignment: event.target.value as DataGridAlignment })} className={`${inputClass} w-full`}><option value="left">居左</option><option value="center">居中</option><option value="right">居右</option></select></label>
                <div className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">顺序 / 删除</span><div className="flex gap-1"><button type="button" aria-label={`上移第 ${columnIndex + 1} 列`} title="向上移动一列" className={buttonClass} disabled={columnIndex === 0} onClick={() => setModel(current => moveDataGridColumn(current, columnIndex, columnIndex - 1))}><ArrowUp className="h-3 w-3" /></button><button type="button" aria-label={`下移第 ${columnIndex + 1} 列`} title="向下移动一列" className={buttonClass} disabled={columnIndex === model.columns.length - 1} onClick={() => setModel(current => moveDataGridColumn(current, columnIndex, columnIndex + 1))}><ArrowDown className="h-3 w-3" /></button><button type="button" aria-label={`删除第 ${columnIndex + 1} 列`} title="删除当前列及其单元格数据" className={`${buttonClass} text-red-400`} onClick={() => setModel(current => removeDataGridColumn(current, column.id))}><Trash2 className="h-3 w-3" /></button></div></div>
              </div>
              <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-slate-500">{(['readOnly', 'visible', 'frozen', 'sortable', 'filterable', 'required'] as const).map(key => <label key={key} className="flex items-center gap-1"><input type="checkbox" checked={column[key]} onChange={event => updateColumn(column.id, { [key]: event.target.checked })} />{{ readOnly: '只读', visible: '显示', frozen: '冻结', sortable: '排序', filterable: '筛选', required: '必填' }[key]}</label>)}</div>
              {column.type === 'combo' && <textarea aria-label={`${column.title}组合框选项`} value={optionsText(column.options)} onChange={event => updateColumn(column.id, { options: parseOptions(event.target.value) })} rows={3} placeholder={'每行：稳定值<Tab>显示文字'} className={`${inputClass} mt-2 h-auto w-full py-2 font-mono`} />}
              {column.type === 'buttons' && <textarea aria-label={`${column.title}按钮定义`} value={buttonsText(column.buttons)} onChange={event => updateColumn(column.id, { buttons: parseButtons(event.target.value) })} rows={3} placeholder={'每行：按钮ID<Tab>文字<Tab>normal|primary|danger'} className={`${inputClass} mt-2 h-auto w-full py-2 font-mono`} />}
              {column.type === 'switch' && <div className="mt-2 grid grid-cols-2 gap-2"><input value={column.onText} onChange={event => updateColumn(column.id, { onText: event.target.value })} placeholder="开启文字" className={inputClass} /><input value={column.offText} onChange={event => updateColumn(column.id, { offText: event.target.value })} placeholder="关闭文字" className={inputClass} /></div>}
              {column.type === 'image' && <label className="mt-2 block text-xs"><span className="mb-1 block text-slate-500">图片显示方式</span><select aria-label={`${column.title}图片显示方式`} value={column.imageMode || 'contain'} onChange={event => updateColumn(column.id, { imageMode: event.target.value as DataGridImageMode })} className={`${inputClass} w-full`}>{IMAGE_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>}
              {column.type === 'progress' && <div className="mt-2 grid grid-cols-3 gap-2"><input type="number" value={column.progressMinimum} onChange={event => updateColumn(column.id, { progressMinimum: Number(event.target.value) })} className={inputClass} /><input type="number" value={column.progressMaximum} onChange={event => updateColumn(column.id, { progressMaximum: Number(event.target.value) })} className={inputClass} /><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={column.progressShowText !== false} onChange={event => updateColumn(column.id, { progressShowText: event.target.checked })} />显示进度文字</label></div>}
              {column.type === 'checkbox' && <label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={column.threeState === true} onChange={event => updateColumn(column.id, { threeState: event.target.checked })} />允许三态（null）</label>}
            </div>)}
            <button className={buttonClass} onClick={() => setModel(current => ({ ...current, columns: [...current.columns, createColumn(current.columns)] }))}><Plus className="h-3 w-3" />新增列</button>
          </div>}
          {tab === 'rows' && <div className="space-y-3"><div className="overflow-auto rounded border border-slate-500/30"><table className="min-w-full border-collapse text-xs"><thead><tr><th className="p-2 text-left">行键</th><th className="p-2">启用</th>{model.columns.map(column => <th key={column.id} className="min-w-28 p-2 text-left">{column.title}</th>)}<th /></tr></thead><tbody>{model.rows.map(row => <tr key={row.key} className="border-t border-slate-500/20"><td className="p-1"><input value={row.key} onChange={event => setModel(current => ({ ...current, rows: current.rows.map(item => item.key === row.key ? { ...item, key: event.target.value } : item) }))} className={inputClass} /></td><td className="p-2 text-center"><input type="checkbox" checked={row.enabled} onChange={event => setModel(current => ({ ...current, rows: current.rows.map(item => item.key === row.key ? { ...item, enabled: event.target.checked } : item) }))} /></td>{model.columns.map(column => <td key={column.id} className="p-1">{column.type === 'checkbox' || column.type === 'switch' ? <input type="checkbox" checked={row.cells[column.id] === true} onChange={event => updateCell(row.key, column.id, event.target.checked)} /> : column.type === 'combo' ? <select value={String(row.cells[column.id] ?? '')} onChange={event => updateCell(row.key, column.id, event.target.value)} className={inputClass}><option value="" />{column.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : column.type === 'buttons' ? <span className="text-[10px] text-slate-500">{column.buttons?.map(button => button.text).join(' / ') || '未定义按钮'}</span> : <input type={column.type === 'integer' || column.type === 'decimal' || column.type === 'progress' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={String(row.cells[column.id] ?? '')} placeholder={column.type === 'image' ? '项目图片路径' : ''} onChange={event => updateCell(row.key, column.id, column.type === 'integer' || column.type === 'decimal' || column.type === 'progress' ? Number(event.target.value) : event.target.value)} className={inputClass} />}</td>)}<td className="p-1"><button className={`${buttonClass} text-red-400`} onClick={() => setModel(current => ({ ...current, rows: current.rows.filter(item => item.key !== row.key) }))}><Trash2 className="h-3 w-3" /></button></td></tr>)}</tbody></table></div><button className={buttonClass} onClick={addRow}><Plus className="h-3 w-3" />新增行</button></div>}
          {tab === 'cells' && <div className="space-y-4"><div className="grid grid-cols-2 gap-2"><select value={selectedRowKey} onChange={event => setSelectedRowKey(event.target.value)} className={inputClass}><option value="">选择行</option>{model.rows.map(row => <option key={row.key} value={row.key}>{row.key}</option>)}</select><select value={selectedColumnId} onChange={event => setSelectedColumnId(event.target.value)} className={inputClass}><option value="">选择列</option>{model.columns.map(column => <option key={column.id} value={column.id}>{column.title}（{column.id}）</option>)}</select></div>{selectedRow && selectedColumn ? <div className={`space-y-3 rounded border p-4 ${isDarkMode ? 'border-[#3b3b44]' : 'border-slate-200'}`}><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={selectedOverride.readOnly === true} onChange={event => updateOverride({ readOnly: event.target.checked })} />单元格只读</label>{selectedColumn.type === 'image' && <label className="block text-xs"><span className="mb-1 block text-slate-500">覆盖本单元格的图片显示方式</span><select value={selectedOverride.imageMode || selectedColumn.imageMode || 'contain'} onChange={event => updateOverride({ imageMode: event.target.value as DataGridImageMode })} className={`${inputClass} w-full`}>{IMAGE_MODES.map(mode => <option key={mode.value} value={mode.value}>{mode.label}</option>)}</select></label>}{selectedColumn.type === 'progress' && <select value={selectedOverride.progressState || 'normal'} onChange={event => updateOverride({ progressState: event.target.value })} className={inputClass}>{['normal', 'success', 'warning', 'error', 'paused', 'indeterminate'].map(value => <option key={value}>{value}</option>)}</select>}{selectedColumn.type === 'combo' && <textarea value={optionsText(selectedOverride.options)} onChange={event => updateOverride({ options: parseOptions(event.target.value) })} rows={5} placeholder="单元格级选项：值<Tab>文字" className={`${inputClass} h-auto w-full py-2 font-mono`} />}{selectedColumn.type === 'buttons' && <div className="space-y-2">{selectedColumn.buttons?.map(button => { const state = selectedOverride.buttonStates?.[button.id] || {}; return <div key={button.id} className="grid grid-cols-[100px_1fr_auto_auto] items-center gap-2"><span className="font-mono text-xs">{button.id}</span><input value={state.text ?? button.text} onChange={event => updateOverride({ buttonStates: { ...(selectedOverride.buttonStates || {}), [button.id]: { ...state, text: event.target.value } } })} className={inputClass} /><label className="text-[10px]"><input type="checkbox" checked={state.visible ?? true} onChange={event => updateOverride({ buttonStates: { ...(selectedOverride.buttonStates || {}), [button.id]: { ...state, visible: event.target.checked } } })} />显示</label><label className="text-[10px]"><input type="checkbox" checked={state.enabled ?? true} onChange={event => updateOverride({ buttonStates: { ...(selectedOverride.buttonStates || {}), [button.id]: { ...state, enabled: event.target.checked } } })} />启用</label></div>; })}</div>}</div> : <p className="text-xs text-slate-500">先选择行和列。</p>}</div>}
        </section>
        <aside className={`border-t p-4 lg:border-l lg:border-t-0 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}><div className="mb-2 text-xs font-semibold">实时预览</div><div className="h-[310px] overflow-hidden rounded border border-slate-500/30"><DataGridDesignerPreview control={previewControl} /></div><div className="mt-3 grid grid-cols-2 gap-2"><select value={model.selectionMode} onChange={event => setModel(current => ({ ...current, selectionMode: event.target.value as DataGridModel['selectionMode'] }))} className={inputClass}><option value="none">不选择</option><option value="cell">单元格</option><option value="row">单行</option><option value="multiRow">多行</option><option value="range">区域</option></select><input value={model.emptyText} onChange={event => setModel(current => ({ ...current, emptyText: event.target.value }))} className={inputClass} /></div><label className="mt-3 flex items-center gap-2 text-xs"><input type="checkbox" checked={model.virtualMode} onChange={event => setModel(current => ({ ...current, virtualMode: event.target.checked }))} />虚拟数据模式</label></aside>
      </main>
      <footer className={`flex justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}><button className={buttonClass} onClick={onClose}>取消</button><button className={`${buttonClass} border-cyan-500 bg-cyan-600 text-white`} onClick={() => onSave({ dataGridSchemaVersion: DATA_GRID_SCHEMA_VERSION, dataGridColumns: model.columns as unknown as Win32ControlPropertyValue, dataGridRows: model.rows as unknown as Win32ControlPropertyValue, selectionMode: model.selectionMode, emptyText: model.emptyText, virtualMode: model.virtualMode, virtualRowCount: model.virtualRowCount })}>保存表格</button></footer>
    </div>
  </div>;
}
