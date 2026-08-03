import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ClipboardPaste,
  Columns3,
  Copy,
  Plus,
  Rows3,
  Trash2,
  X
} from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import type {
  DataGridCellValue,
  DataGridButtonDefinition,
  DataGridColumn,
  DataGridColumnType,
  DataGridModel,
  DataGridOption,
  DataGridRow
} from '../services/windowDesigner/dataGridModel';
import {
  coerceDataGridCellValue,
  moveDataGridColumn,
  normalizeDataGridColumns,
  normalizeDataGridRows,
  parseDataGridDelimited,
  removeDataGridColumn
} from '../services/windowDesigner/dataGridModel';
import type { LingControl } from '../services/windowDesigner/types';

type TableEditorTab = 'columns' | 'rows';

const TABLE_COLUMN_TYPES: Array<{ value: DataGridColumnType; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'integer', label: '整数' },
  { value: 'decimal', label: '小数' },
  { value: 'date', label: '日期' },
  { value: 'checkbox', label: '选择框' },
  { value: 'switch', label: '开关' },
  { value: 'image', label: '图片（当前后端不支持）' },
  { value: 'combo', label: '组合框' },
  { value: 'buttons', label: '按钮组' },
  { value: 'progress', label: '进度条' }
];

const DATA_PROPERTY_KEYS = ['columns', 'rows', 'tableColumnsEx', 'tableRowsEx'] as const;

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickCollection(properties: Readonly<Record<string, Win32ControlPropertyValue>>, keys: readonly string[]): unknown[] {
  let fallback: unknown[] = [];
  for (const key of keys) {
    const value = properties[key];
    if (!Array.isArray(value)) continue;
    if (fallback.length === 0) fallback = value;
    if (value.length > 0) return value;
  }
  return fallback;
}

function parseTableText(text: string): string[][] {
  const normalized = text.replace(/\r\n?/gu, '\n');
  if (!normalized.trim()) return [];
  const delimiter = normalized.includes('\t') ? '\t' : normalized.includes(',') ? ',' : null;
  const rows = delimiter
    ? parseDataGridDelimited(normalized, delimiter)
    : normalized.split('\n').map(line => [line]);
  return rows.filter(row => row.some(cell => cell.length > 0));
}

function normalizeTableColumns(value: unknown): DataGridColumn[] {
  const normalized = asArray(value).map(item => typeof item === 'string' ? { title: item } : item);
  return normalizeDataGridColumns(normalized as Win32ControlPropertyValue);
}

function normalizeTableRows(value: unknown, columns: DataGridColumn[]): DataGridRow[] {
  const rows = asArray(value);
  if (rows.some(item => typeof item === 'string')) {
    const matrix = parseTableText(rows.map(item => String(item ?? '')).join('\n'));
    return normalizeDataGridRows(matrix.map((cells, index) => ({ key: `row${index + 1}`, cells })), columns);
  }
  return normalizeDataGridRows(value as Win32ControlPropertyValue, columns);
}

function createColumn(columns: DataGridColumn[]): DataGridColumn {
  let index = columns.length + 1;
  while (columns.some(column => column.id === `column${index}`)) index += 1;
  return normalizeDataGridColumns([{ id: `column${index}`, title: `列 ${index}`, type: 'text', width: 140 }])[0]!;
}

function createRowKey(rows: DataGridRow[]): string {
  let index = rows.length + 1;
  while (rows.some(row => row.key === `row${index}`)) index += 1;
  return `row${index}`;
}

function createRow(rows: DataGridRow[], columns: DataGridColumn[], source?: readonly DataGridCellValue[]): DataGridRow {
  return {
    key: createRowKey(rows),
    enabled: true,
    cells: Object.fromEntries(columns.map((column, index) => [
      column.id,
      source?.[index] === undefined ? coerceDataGridCellValue(column, '') : coerceDataGridCellValue(column, source[index])
    ]))
  };
}

function tableColumnType(type: DataGridColumnType): string {
  return type;
}

function parseOptions(text: string): DataGridOption[] {
  return text.split(/\r?\n/u)
    .map(line => line.split('\t'))
    .filter(parts => parts[0]?.trim())
    .map(parts => ({ value: parts[0]!.trim(), label: (parts[1] || parts[0]!).trim() }));
}

function optionsText(options?: DataGridOption[]): string {
  return (options || []).map(option => `${option.value}\t${option.label}`).join('\n');
}

function parseButtons(text: string): DataGridButtonDefinition[] {
  return text.split(/\r?\n/u)
    .map(line => line.split('\t'))
    .filter(parts => parts[0]?.trim())
    .map(parts => ({
      id: parts[0]!.trim(),
      text: (parts[1] || parts[0]!).trim(),
      style: parts[2] === 'primary' || parts[2] === 'danger' ? parts[2] : 'normal',
      enabled: true,
      visible: true
    }));
}

function buttonsText(buttons?: DataGridButtonDefinition[]): string {
  return (buttons || []).map(button => `${button.id}\t${button.text}\t${button.style}`).join('\n');
}

function NewEmojiTableCellEditor({
  column,
  row,
  rowIndex,
  columnIndex,
  inputClass,
  onChange,
  onKeyDown,
  onPaste
}: {
  column: DataGridColumn;
  row: DataGridRow;
  rowIndex: number;
  columnIndex: number;
  inputClass: string;
  onChange: (value: unknown) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
  onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => void;
}) {
  const value = row.cells[column.id];
  const cellLabel = `第 ${rowIndex + 1} 行 ${column.title || column.id}`;
  const cellId = `${rowIndex}-${columnIndex}`;
  if (column.type === 'checkbox' && column.threeState) {
    return <select data-new-emoji-table-cell={cellId} aria-label={cellLabel} value={value === null ? 'null' : value ? 'true' : 'false'} onChange={event => onChange(event.target.value === 'null' ? null : event.target.value === 'true')} className={inputClass}>
      <option value="null">未设置</option>
      <option value="false">未选中</option>
      <option value="true">已选中</option>
    </select>;
  }
  if (column.type === 'checkbox' || column.type === 'switch') {
    return <label className="flex h-8 items-center justify-center" title={cellLabel}>
      <input data-new-emoji-table-cell={cellId} aria-label={cellLabel} type="checkbox" checked={value === true} onChange={event => onChange(event.target.checked)} onKeyDown={onKeyDown} className="h-4 w-4 accent-cyan-500" />
    </label>;
  }
  if (column.type === 'combo') {
    return <select data-new-emoji-table-cell={cellId} aria-label={cellLabel} value={String(value ?? '')} onChange={event => onChange(event.target.value)} onKeyDown={onKeyDown} className={inputClass}>
      <option value="">未选择</option>
      {(column.options || []).map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>;
  }
  if (column.type === 'buttons') {
    return <div data-new-emoji-table-cell={cellId} aria-label={cellLabel} className="flex min-h-8 items-center gap-1 overflow-hidden text-[10px] text-slate-500" title="按钮定义请在列配置中编辑">
      {column.buttons?.length ? column.buttons.map(button => <span key={button.id} className="truncate">{button.text}</span>) : <span>未定义按钮</span>}
    </div>;
  }
  return <input data-new-emoji-table-cell={cellId} aria-label={cellLabel} type={column.type === 'integer' || column.type === 'decimal' || column.type === 'progress' ? 'number' : column.type === 'date' ? 'date' : 'text'} value={String(value ?? '')} onChange={event => onChange(event.target.value)} onKeyDown={onKeyDown} onPaste={onPaste} className={inputClass} />;
}

export function serializeNewEmojiTableProperties(model: Pick<DataGridModel, 'columns' | 'rows'>): Record<string, Win32ControlPropertyValue> {
  const columns = model.columns.map(column => ({
    id: column.id,
    title: column.title,
    type: tableColumnType(column.type),
    width: column.width,
    alignment: column.alignment,
    minWidth: column.minWidth,
    maxWidth: column.maxWidth,
    readOnly: column.readOnly,
    visible: column.visible,
    frozen: column.frozen,
    sortable: column.sortable,
    filterable: column.filterable,
    required: column.required,
    format: column.format,
    ...(column.threeState !== undefined ? { threeState: column.threeState } : {}),
    ...(column.onText ? { onText: column.onText } : {}),
    ...(column.offText ? { offText: column.offText } : {}),
    ...(column.progressMinimum !== undefined ? { progressMinimum: column.progressMinimum } : {}),
    ...(column.progressMaximum !== undefined ? { progressMaximum: column.progressMaximum } : {}),
    ...(column.progressShowText !== undefined ? { progressShowText: column.progressShowText } : {}),
    ...(column.allowCustomInput !== undefined ? { allowCustomInput: column.allowCustomInput } : {}),
    ...(column.imageMode ? { imageMode: column.imageMode } : {}),
    ...(column.options?.length ? { options: column.options } : {}),
    ...(column.buttons?.length ? { buttons: column.buttons } : {}),
    ...(column.numericMinimum !== undefined ? { numericMinimum: column.numericMinimum } : {}),
    ...(column.numericMaximum !== undefined ? { numericMaximum: column.numericMaximum } : {}),
    ...(column.textPattern ? { textPattern: column.textPattern } : {})
  }));
  const rows = model.rows.map(row => ({
    id: row.key,
    enabled: row.enabled,
    cells: model.columns.map(column => row.cells[column.id] === null ? '' : String(row.cells[column.id] ?? ''))
  }));
  const basicColumns = model.columns.map(column => column.title);
  const basicRows = rows.map(row => row.cells.join('\t'));
  return {
    dataGridSchemaVersion: 1,
    dataGridColumns: model.columns as unknown as Win32ControlPropertyValue,
    dataGridRows: model.rows as unknown as Win32ControlPropertyValue,
    columns: basicColumns,
    rows: basicRows,
    tableColumnsEx: columns as unknown as Win32ControlPropertyValue,
    tableRowsEx: rows as unknown as Win32ControlPropertyValue
  };
}

export default function NewEmojiTableEditorDialog({
  control,
  isDarkMode,
  onSave,
  onClose
}: {
  control: LingControl;
  isDarkMode: boolean;
  onSave: (properties: Record<string, Win32ControlPropertyValue>) => void;
  onClose: () => void;
}) {
  const properties = control.properties || {};
  const initialModel = useMemo<DataGridModel>(() => {
    const columns = normalizeTableColumns(pickCollection(properties, ['dataGridColumns', 'tableColumnsEx', 'columns']));
    const rows = normalizeTableRows(pickCollection(properties, ['dataGridRows', 'tableRowsEx', 'rows', 'items']), columns);
    return { dataGridSchemaVersion: 1, columns, rows, selectionMode: 'row', emptyText: String(properties.emptyText ?? '暂无数据'), virtualMode: false, virtualRowCount: 0 };
  }, [properties]);
  const [tab, setTab] = useState<TableEditorTab>('columns');
  const [model, setModel] = useState<DataGridModel>(initialModel);
  const [selectedColumnId, setSelectedColumnId] = useState(initialModel.columns[0]?.id || '');
  const [showBatchPaste, setShowBatchPaste] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (model.columns.some(column => column.id === selectedColumnId)) return;
    setSelectedColumnId(model.columns[0]?.id || '');
  }, [model.columns, selectedColumnId]);

  const inputClass = `h-8 w-full min-w-0 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const buttonClass = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 ${
    isDarkMode ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
  }`;
  const surfaceClass = isDarkMode ? 'border-[#3b3b44] bg-[#202026]' : 'border-slate-200 bg-white';

  const updateColumn = (id: string, fields: Partial<DataGridColumn>) => {
    setModel(current => ({ ...current, columns: current.columns.map(column => column.id === id ? { ...column, ...fields } : column) }));
  };

  const renameColumn = (id: string, nextId: string) => {
    const normalized = nextId.trim();
    if (!normalized || (normalized !== id && model.columns.some(column => column.id === normalized))) return;
    if (selectedColumnId === id) setSelectedColumnId(normalized);
    setModel(current => ({
      ...current,
      columns: current.columns.map(column => column.id === id ? { ...column, id: normalized } : column),
      rows: current.rows.map(row => {
        const cells = { ...row.cells, [normalized]: row.cells[id] ?? '' };
        delete cells[id];
        return { ...row, cells };
      })
    }));
  };

  const addColumn = () => {
    const column = createColumn(model.columns);
    setSelectedColumnId(column.id);
    setModel(current => ({
      ...current,
      columns: [...current.columns, column],
      rows: current.rows.map(row => ({ ...row, cells: { ...row.cells, [column.id]: '' } }))
    }));
    setNotice(`已新增第 ${model.columns.length + 1} 列。`);
  };

  const moveColumn = (from: number, to: number) => setModel(current => moveDataGridColumn(current, from, to));

  const deleteColumn = (id: string) => {
    const removedIndex = model.columns.findIndex(column => column.id === id);
    const nextColumns = model.columns.filter(column => column.id !== id);
    if (selectedColumnId === id) setSelectedColumnId(nextColumns[Math.min(removedIndex, nextColumns.length - 1)]?.id || '');
    setModel(current => removeDataGridColumn(current, id));
    setNotice('已删除列，并同步移除每行对应单元格。');
  };

  const addRow = (afterIndex?: number, source?: readonly DataGridCellValue[]) => {
    setModel(current => {
      const row = createRow(current.rows, current.columns, source);
      const rows = afterIndex === undefined
        ? [...current.rows, row]
        : [...current.rows.slice(0, afterIndex + 1), row, ...current.rows.slice(afterIndex + 1)];
      return { ...current, rows };
    });
    setNotice(`已新增行。`);
  };

  const duplicateRow = (index: number) => {
    setModel(current => {
      const source = current.rows[index];
      if (!source) return current;
      const duplicate = createRow(current.rows, current.columns, current.columns.map(column => source.cells[column.id] ?? ''));
      duplicate.enabled = source.enabled;
      return { ...current, rows: [...current.rows.slice(0, index + 1), duplicate, ...current.rows.slice(index + 1)] };
    });
    setNotice(`已复制第 ${index + 1} 行。`);
  };

  const updateRow = (key: string, fields: Partial<DataGridRow>) => setModel(current => ({ ...current, rows: current.rows.map(row => row.key === key ? { ...row, ...fields } : row) }));
  const updateCell = (key: string, column: DataGridColumn, value: unknown) => setModel(current => ({
    ...current,
    rows: current.rows.map(row => row.key === key ? { ...row, cells: { ...row.cells, [column.id]: coerceDataGridCellValue(column, value) } } : row)
  }));
  const renameRow = (key: string, nextKey: string) => {
    const normalized = nextKey.trim();
    if (!normalized || (normalized !== key && model.rows.some(row => row.key === normalized))) {
      setNotice('行键不能为空，也不能与其他行重复。');
      return;
    }
    setModel(current => ({ ...current, rows: current.rows.map(row => row.key === key ? { ...row, key: normalized } : row) }));
  };
  const moveRow = (from: number, to: number) => setModel(current => {
    if (from < 0 || to < 0 || from >= current.rows.length || to >= current.rows.length) return current;
    const rows = [...current.rows];
    const [row] = rows.splice(from, 1);
    rows.splice(to, 0, row!);
    return { ...current, rows };
  });
  const deleteRow = (key: string) => {
    setModel(current => ({ ...current, rows: current.rows.filter(row => row.key !== key) }));
    setNotice('已删除行。');
  };

  const applyMatrix = (startRow: number, startColumn: number, matrix: string[][]) => setModel(current => {
    const rows = current.rows.map(row => ({ ...row, cells: { ...row.cells } }));
    matrix.forEach((sourceRow, rowOffset) => {
      const rowIndex = startRow + rowOffset;
      while (rows.length <= rowIndex) rows.push(createRow(rows, current.columns));
      const target = rows[rowIndex]!;
      sourceRow.forEach((cell, columnOffset) => {
        const column = current.columns[startColumn + columnOffset];
        if (column) target.cells[column.id] = coerceDataGridCellValue(column, cell);
      });
    });
    return { ...current, rows };
  });

  const handleCellPaste = (event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => {
    const matrix = parseTableText(event.clipboardData.getData('text/plain'));
    const isTablePaste = matrix.length > 1 || (matrix[0]?.length || 0) > 1;
    if (!isTablePaste) return;
    event.preventDefault();
    applyMatrix(rowIndex, columnIndex, matrix);
    setNotice(`已粘贴 ${matrix.length} 行数据。`);
  };

  const applyBatchPaste = (mode: 'replace' | 'append') => {
    const matrix = parseTableText(batchText);
    if (matrix.length === 0) {
      setNotice('请先粘贴 Excel、CSV 或制表符分隔的数据。');
      return;
    }
    if (mode === 'replace') {
      setModel(current => ({ ...current, rows: matrix.map(cells => createRow([], current.columns, cells)) }));
    } else {
      applyMatrix(model.rows.length, 0, matrix);
    }
    setBatchText('');
    setShowBatchPaste(false);
    setNotice(`已${mode === 'replace' ? '替换' : '追加'} ${matrix.length} 行数据。`);
  };

  const focusCell = (rowIndex: number, columnIndex: number) => {
    requestAnimationFrame(() => {
      const selector = `[data-new-emoji-table-cell="${rowIndex}-${columnIndex}"]`;
      const input = dialogRef.current?.querySelector<HTMLElement>(selector);
      input?.focus();
    });
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLElement>, rowIndex: number, columnIndex: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const nextRow = rowIndex + (event.shiftKey ? -1 : 1);
    if (nextRow >= 0 && nextRow < model.rows.length) {
      focusCell(nextRow, columnIndex);
    } else if (!event.shiftKey) {
      addRow();
      focusCell(model.rows.length, columnIndex);
    }
  };

  const columnCountLabel = `${model.columns.length} 列`;
  const rowCountLabel = `${model.rows.length} 行`;
  const selectedColumn = model.columns.find(column => column.id === selectedColumnId);

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`编辑 new_emoji 表格 ${control.name}`} className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <Columns3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold sm:text-base">编辑 new_emoji 表格 · {control.name}</h2><p className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>列和行使用结构化数据保存；基础属性与高级属性会同步更新，避免手写 JSON 或 Tab 字符串。</p></div>
          <button type="button" onClick={onClose} aria-label="关闭 new_emoji 表格编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <div className={`flex rounded border p-0.5 ${isDarkMode ? 'border-[#454550] bg-[#24242b]' : 'border-slate-300 bg-slate-100'}`} role="tablist" aria-label="表格编辑区域">
            <button type="button" role="tab" aria-selected={tab === 'columns'} onClick={() => setTab('columns')} className={`${buttonClass} border-0 ${tab === 'columns' ? 'bg-cyan-600 text-white' : 'bg-transparent'}`}><Columns3 className="h-3.5 w-3.5" />列配置 <span className="font-mono text-[10px] opacity-75">{model.columns.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'rows'} onClick={() => setTab('rows')} className={`${buttonClass} border-0 ${tab === 'rows' ? 'bg-cyan-600 text-white' : 'bg-transparent'}`}><Rows3 className="h-3.5 w-3.5" />行数据 <span className="font-mono text-[10px] opacity-75">{model.rows.length}</span></button>
          </div>
          {tab === 'columns' ? <button type="button" onClick={addColumn} className={buttonClass}><Plus className="h-3.5 w-3.5" />新增列</button> : <><button type="button" disabled={model.columns.length === 0} onClick={() => addRow()} className={buttonClass}><Plus className="h-3.5 w-3.5" />新增行</button><button type="button" disabled={model.columns.length === 0} aria-expanded={showBatchPaste} onClick={() => setShowBatchPaste(value => !value)} className={buttonClass}><ClipboardPaste className="h-3.5 w-3.5" />批量粘贴</button></>}
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{columnCountLabel} · {rowCountLabel}</span>
        </div>

        {tab === 'rows' && showBatchPaste && <section className={`shrink-0 border-b p-3 sm:px-5 ${isDarkMode ? 'border-[#35353e] bg-cyan-500/5' : 'border-slate-200 bg-cyan-50'}`} aria-label="批量粘贴表格数据"><textarea value={batchText} onChange={event => setBatchText(event.target.value)} rows={4} autoFocus placeholder="从 Excel 复制后粘贴到这里，每行一条记录" aria-label="批量粘贴内容" className={`${inputClass} h-24 resize-y py-2 font-mono`} /><div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => applyBatchPaste('replace')} className={buttonClass}>替换全部行</button><button type="button" onClick={() => applyBatchPaste('append')} className={buttonClass}>追加到末尾</button><span className="text-[10px] text-slate-500">支持 Excel、CSV、TSV；超出列数的单元格会被忽略。</span></div></section>}

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {tab === 'columns' ? (
            model.columns.length === 0 ? <div className={`flex min-h-52 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><Columns3 className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有列</p><p className="mt-1 text-xs">先新增列，再录入行数据；每列都有稳定 ID，后续代码调用不受标题改名影响。</p><button type="button" onClick={addColumn} className={`${buttonClass} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一列</button></div> : <div className="overflow-x-auto rounded border"><table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-xs"><thead className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><tr><th className="w-12 border-b p-2">列</th><th className="w-36 border-b p-2">ID（代码标识）</th><th className="min-w-40 border-b p-2">标题</th><th className="w-32 border-b p-2">类型</th><th className="w-28 border-b p-2">宽度（px）</th><th className="w-28 border-b p-2">对齐</th><th className="w-36 border-b p-2 text-right">操作</th></tr></thead><tbody>{model.columns.map((column, index) => <tr key={column.id} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}><td className="border-b p-2 font-mono text-slate-500">{index + 1}</td><td className="border-b p-2"><input aria-label={`第 ${index + 1} 列 ID`} defaultValue={column.id} onBlur={event => renameColumn(column.id, event.target.value)} title="代码中访问该列时使用的稳定标识" className={inputClass} /></td><td className="border-b p-2"><input aria-label={`第 ${index + 1} 列标题`} value={column.title} onChange={event => updateColumn(column.id, { title: event.target.value })} className={inputClass} /></td><td className="border-b p-2"><select aria-label={`第 ${index + 1} 列类型`} value={column.type} onChange={event => updateColumn(column.id, { type: event.target.value as DataGridColumnType })} className={inputClass}>{TABLE_COLUMN_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></td><td className="border-b p-2"><input aria-label={`第 ${index + 1} 列宽度`} type="number" min={32} max={2000} value={column.width} onChange={event => updateColumn(column.id, { width: Math.min(2000, Math.max(32, Number(event.target.value) || 32)) })} className={inputClass} /></td><td className="border-b p-2"><select aria-label={`第 ${index + 1} 列对齐`} value={column.alignment} onChange={event => updateColumn(column.id, { alignment: event.target.value as DataGridColumn['alignment'] })} className={inputClass}><option value="left">居左</option><option value="center">居中</option><option value="right">居右</option></select></td><td className="border-b p-2"><div className="flex justify-end gap-0.5"><button type="button" aria-label={`左移第 ${index + 1} 列`} title="左移" disabled={index === 0} onClick={() => moveColumn(index, index - 1)} className={iconButton}><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" aria-label={`右移第 ${index + 1} 列`} title="右移" disabled={index === model.columns.length - 1} onClick={() => moveColumn(index, index + 1)} className={iconButton}><ArrowRight className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${index + 1} 列`} title="删除列及对应单元格" disabled={model.columns.length === 1} onClick={() => deleteColumn(column.id)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>
          ) : model.columns.length === 0 ? (
            <div role="alert" className={`rounded border border-amber-500/40 bg-amber-500/10 p-5 text-center text-sm ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>请先在“列配置”中新增至少一列。</div>
          ) : model.rows.length === 0 ? (
            <div className={`flex min-h-52 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><Rows3 className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有行数据</p><p className="mt-1 text-xs">新增一行逐格填写，或使用批量粘贴导入 Excel 数据。</p><button type="button" onClick={() => addRow()} className={`${buttonClass} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一行</button></div>
          ) : (
            <div className="overflow-x-auto rounded border"><table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-xs"><thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}`}><tr><th className="w-36 border-b p-2">行键（稳定 ID）</th><th className="w-14 border-b p-2 text-center">启用</th>{model.columns.map(column => <th key={column.id} className="min-w-36 border-b p-2">{column.title || column.id}<span className="ml-1 font-mono text-[9px] text-slate-500">{column.id}</span></th>)}<th className="w-36 border-b p-2 text-right">操作</th></tr></thead><tbody>{model.rows.map((row, rowIndex) => <tr key={row.key} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}><td className="border-b p-1"><input aria-label={`第 ${rowIndex + 1} 行键`} defaultValue={row.key} onBlur={event => renameRow(row.key, event.target.value)} className={inputClass} /></td><td className="border-b p-2 text-center"><input type="checkbox" checked={row.enabled} onChange={event => updateRow(row.key, { enabled: event.target.checked })} aria-label={`启用第 ${rowIndex + 1} 行`} className="h-4 w-4 accent-cyan-500" /></td>{model.columns.map((column, columnIndex) => <td key={column.id} className="border-b p-1"><NewEmojiTableCellEditor column={column} row={row} rowIndex={rowIndex} columnIndex={columnIndex} inputClass={inputClass} onChange={value => updateCell(row.key, column, value)} onKeyDown={event => handleCellKeyDown(event, rowIndex, columnIndex)} onPaste={event => handleCellPaste(event, rowIndex, columnIndex)} /></td>)}<td className="border-b p-1"><div className="flex justify-end gap-0.5"><button type="button" aria-label={`复制第 ${rowIndex + 1} 行`} title="复制行" onClick={() => duplicateRow(rowIndex)} className={iconButton}><Copy className="h-3.5 w-3.5" /></button><button type="button" aria-label={`上移第 ${rowIndex + 1} 行`} title="上移" disabled={rowIndex === 0} onClick={() => moveRow(rowIndex, rowIndex - 1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label={`下移第 ${rowIndex + 1} 行`} title="下移" disabled={rowIndex === model.rows.length - 1} onClick={() => moveRow(rowIndex, rowIndex + 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${rowIndex + 1} 行`} title="删除行" onClick={() => deleteRow(row.key)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>)}</tbody></table></div>
          )}
          {tab === 'columns' && selectedColumn && <section aria-label="当前列的高级配置" className={`mt-4 rounded border p-3 ${surfaceClass}`}>
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-xs">列专属配置</strong>
              <label className="ml-auto flex min-w-0 items-center gap-2 text-xs">
                <span className="shrink-0 text-slate-500">当前列</span>
                <select aria-label="选择要配置的列" value={selectedColumn.id} onChange={event => setSelectedColumnId(event.target.value)} className={`${inputClass} w-auto min-w-40`}>
                  {model.columns.map(column => <option key={column.id} value={column.id}>{column.title || column.id}（{column.id}）</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500">
              {(['readOnly', 'visible', 'frozen', 'sortable', 'filterable', 'required'] as const).map(key => <label key={key} className="flex items-center gap-1.5">
                <input type="checkbox" checked={selectedColumn[key]} onChange={event => updateColumn(selectedColumn.id, { [key]: event.target.checked } as Partial<DataGridColumn>)} className="accent-cyan-500" />
                {{ readOnly: '只读', visible: '显示', frozen: '冻结', sortable: '排序', filterable: '筛选', required: '必填' }[key]}
              </label>)}
            </div>
            {selectedColumn.type === 'combo' && <div className="mt-3">
              <label className="block text-[11px] text-slate-500">组合框选项（每行：稳定值[TAB]显示文字）</label>
              <textarea aria-label={`${selectedColumn.title}组合框选项`} value={optionsText(selectedColumn.options)} onChange={event => updateColumn(selectedColumn.id, { options: parseOptions(event.target.value), allowCustomInput: selectedColumn.allowCustomInput })} rows={4} placeholder="ready\t准备好" className={`${inputClass} mt-1 h-auto resize-y py-2 font-mono`} />
              <label className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={selectedColumn.allowCustomInput === true} onChange={event => updateColumn(selectedColumn.id, { allowCustomInput: event.target.checked })} className="accent-cyan-500" />允许输入选项之外的值</label>
            </div>}
            {selectedColumn.type === 'buttons' && <div className="mt-3">
              <label className="block text-[11px] text-slate-500">按钮组（每行：按钮 ID[TAB]文字[TAB]normal|primary|danger）</label>
              <textarea aria-label={`${selectedColumn.title}按钮定义`} value={buttonsText(selectedColumn.buttons)} onChange={event => updateColumn(selectedColumn.id, { buttons: parseButtons(event.target.value) })} rows={4} placeholder="view\t查看\tprimary" className={`${inputClass} mt-1 h-auto resize-y py-2 font-mono`} />
            </div>}
            {selectedColumn.type === 'switch' && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-slate-500">开启文字<input aria-label={`${selectedColumn.title}开启文字`} value={selectedColumn.onText || ''} onChange={event => updateColumn(selectedColumn.id, { onText: event.target.value })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[11px] text-slate-500">关闭文字<input aria-label={`${selectedColumn.title}关闭文字`} value={selectedColumn.offText || ''} onChange={event => updateColumn(selectedColumn.id, { offText: event.target.value })} className={`${inputClass} mt-1`} /></label>
            </div>}
            {selectedColumn.type === 'progress' && <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label className="text-[11px] text-slate-500">最小值<input aria-label={`${selectedColumn.title}进度最小值`} type="number" value={selectedColumn.progressMinimum ?? 0} onChange={event => updateColumn(selectedColumn.id, { progressMinimum: Number(event.target.value) || 0 })} className={`${inputClass} mt-1`} /></label>
              <label className="text-[11px] text-slate-500">最大值<input aria-label={`${selectedColumn.title}进度最大值`} type="number" value={selectedColumn.progressMaximum ?? 100} onChange={event => updateColumn(selectedColumn.id, { progressMaximum: Number(event.target.value) || 100 })} className={`${inputClass} mt-1`} /></label>
              <label className="flex items-end gap-1.5 pb-1 text-[11px] text-slate-500"><input type="checkbox" checked={selectedColumn.progressShowText !== false} onChange={event => updateColumn(selectedColumn.id, { progressShowText: event.target.checked })} className="accent-cyan-500" />显示进度文字</label>
            </div>}
            {selectedColumn.type === 'checkbox' && <label className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={selectedColumn.threeState === true} onChange={event => updateColumn(selectedColumn.id, { threeState: event.target.checked })} className="accent-cyan-500" />允许三态（未设置 / 未选中 / 已选中）</label>}
          </section>}
        </main>

        {notice && <div role="status" className={`shrink-0 border-t px-3 py-2 text-[10px] ${isDarkMode ? 'border-[#35353e] bg-amber-500/5 text-amber-300' : 'border-slate-200 bg-amber-50 text-amber-800'}`}>{notice}</div>}
        <footer className={`flex shrink-0 justify-end gap-2 border-t px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}><button type="button" className={buttonClass} onClick={onClose}>取消</button><button type="button" className={`${buttonClass} border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500`} onClick={() => onSave(serializeNewEmojiTableProperties(model))}>保存表格</button></footer>
      </div>
    </div>
  );
}

export function getNewEmojiTableEditorData(control: LingControl): { columns: number; rows: number } {
  const properties = control.properties || {};
  const rawColumns = pickCollection(properties, ['dataGridColumns', 'tableColumnsEx', 'columns']);
  const columns = normalizeTableColumns(rawColumns).length;
  const rawRows = pickCollection(properties, ['dataGridRows', 'tableRowsEx', 'rows', 'items']);
  const rows = normalizeTableRows(rawRows, normalizeTableColumns(rawColumns)).length;
  return { columns, rows };
}

export function isNewEmojiTableDataProperty(key: string): boolean {
  return (DATA_PROPERTY_KEYS as readonly string[]).includes(key);
}
