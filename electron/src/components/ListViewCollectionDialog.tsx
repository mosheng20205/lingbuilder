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
import {
  appendListViewColumn,
  applyListViewCellMatrix,
  createListViewRow,
  moveListViewColumn,
  normalizeListViewColumns,
  normalizeListViewRows,
  parseListViewTabularText,
  removeListViewColumn,
  replaceListViewRowsFromMatrix,
  type ListViewEditableColumn,
  type ListViewEditableRow
} from '../services/windowDesigner/listViewCollectionModel';

export type ListViewCollectionEditorKind = 'columns' | 'rows';

export interface ListViewCollectionDialogProps {
  kind: ListViewCollectionEditorKind;
  controlName: string;
  columnsValue: Win32ControlPropertyValue | undefined;
  rowsValue: Win32ControlPropertyValue | undefined;
  showImages: boolean;
  isDarkMode: boolean;
  onChange: (columns: ListViewEditableColumn[], rows: ListViewEditableRow[]) => void;
  onClose: () => void;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

interface ColumnWidthInputProps {
  columnIndex: number;
  value: number;
  className: string;
  onCommit: (value: number) => void;
}

function ColumnWidthInput({ columnIndex, value, className, onCommit }: ColumnWidthInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commitDraft = (nextDraft: string, finalize = false) => {
    setDraft(nextDraft);
    if (nextDraft.trim() === '') {
      if (finalize) setDraft(String(value));
      return;
    }

    const parsed = Number(nextDraft);
    if (!Number.isFinite(parsed)) {
      if (finalize) setDraft(String(value));
      return;
    }

    const integer = Math.trunc(parsed);
    if (!finalize && (integer < 24 || integer > 2000)) return;
    const normalized = Math.min(2000, Math.max(24, integer));
    setDraft(String(normalized));
    if (normalized !== value) onCommit(normalized);
  };

  return (
    <input
      aria-label={`第 ${columnIndex + 1} 列宽度`}
      type="number"
      min={24}
      max={2000}
      value={draft}
      onChange={event => commitDraft(event.target.value)}
      onBlur={() => commitDraft(draft, true)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commitDraft(draft, true);
          event.currentTarget.select();
        }
      }}
      className={className}
    />
  );
}

export default function ListViewCollectionDialog({
  kind,
  controlName,
  columnsValue,
  rowsValue,
  showImages,
  isDarkMode,
  onChange,
  onClose
}: ListViewCollectionDialogProps) {
  const columns = useMemo(() => normalizeListViewColumns(columnsValue), [columnsValue]);
  const rows = useMemo(() => normalizeListViewRows(rowsValue), [rowsValue]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [showBatchPaste, setShowBatchPaste] = useState(false);
  const [batchText, setBatchText] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    firstButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const inputClass = `h-8 w-full min-w-0 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode
      ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const secondaryButton = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 ${
    isDarkMode
      ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
  }`;

  const updateColumn = (index: number, fields: Partial<ListViewEditableColumn>) => {
    onChange(columns.map((column, columnIndex) => columnIndex === index ? { ...column, ...fields } : column), rows);
  };

  const addColumn = () => {
    const next = appendListViewColumn(columns, rows);
    onChange(next.columns, next.rows);
    setNotice(`已新增第 ${next.columns.length} 列。`);
  };

  const moveColumn = (from: number, to: number) => {
    const next = moveListViewColumn(columns, rows, from, to);
    onChange(next.columns, next.rows);
  };

  const deleteColumn = (index: number) => {
    const next = removeListViewColumn(columns, rows, index);
    onChange(next.columns, next.rows);
    setNotice('已删除列，并同步移除每行对应单元格。');
  };

  const updateRowCell = (rowIndex: number, columnIndex: number, value: string) => {
    onChange(columns, rows.map((row, index) => {
      if (index !== rowIndex) return row;
      const cells = Array.from({ length: columns.length }, (_, cellIndex) => row.cells[cellIndex] ?? '');
      cells[columnIndex] = value;
      return { ...row, cells };
    }));
  };

  const addRow = (cells: string[] = [], afterIndex?: number) => {
    const row = createListViewRow(rows, columns.length, cells);
    const nextRows = afterIndex === undefined
      ? [...rows, row]
      : [...rows.slice(0, afterIndex + 1), row, ...rows.slice(afterIndex + 1)];
    onChange(columns, nextRows);
    setNotice(`已新增第 ${nextRows.length} 行。`);
    return nextRows.indexOf(row);
  };

  const duplicateRow = (index: number) => {
    const source = rows[index];
    const duplicate = { ...createListViewRow(rows, columns.length, source.cells), image: source.image };
    const nextRows = [...rows.slice(0, index + 1), duplicate, ...rows.slice(index + 1)];
    onChange(columns, nextRows);
    const newIndex = index + 1;
    setNotice(`已复制第 ${index + 1} 行到第 ${newIndex + 1} 行。`);
  };

  const moveRow = (from: number, to: number) => onChange(columns, moveItem(rows, from, to));
  const deleteRow = (index: number) => {
    onChange(columns, rows.filter((_, rowIndex) => rowIndex !== index));
    setNotice(`已删除第 ${index + 1} 行。`);
  };

  const focusCell = (rowIndex: number, columnIndex: number) => {
    requestAnimationFrame(() => {
      const selector = `[data-list-view-cell="${rowIndex}-${columnIndex}"]`;
      const candidates = dialogRef.current?.querySelectorAll<HTMLInputElement>(selector);
      Array.from(candidates || []).find(input => input.offsetParent !== null)?.focus();
    });
  };

  const handleCellKeyDown = (event: React.KeyboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const direction = event.shiftKey ? -1 : 1;
    const nextRowIndex = rowIndex + direction;
    if (nextRowIndex >= 0 && nextRowIndex < rows.length) {
      focusCell(nextRowIndex, columnIndex);
      return;
    }
    if (direction > 0) {
      const createdIndex = addRow();
      focusCell(createdIndex, columnIndex);
    }
  };

  const handleCellPaste = (event: React.ClipboardEvent<HTMLInputElement>, rowIndex: number, columnIndex: number) => {
    const matrix = parseListViewTabularText(event.clipboardData.getData('text/plain'));
    const isTablePaste = matrix.length > 1 || (matrix[0]?.length || 0) > 1;
    if (!isTablePaste) return;
    event.preventDefault();
    onChange(columns, applyListViewCellMatrix(rows, columns.length, rowIndex, columnIndex, matrix));
    setNotice(`已从当前单元格粘贴 ${matrix.length} 行、${Math.max(...matrix.map(row => row.length))} 列数据。`);
  };

  const applyBatchPaste = (mode: 'replace' | 'append') => {
    const matrix = parseListViewTabularText(batchText);
    if (matrix.length === 0) {
      setNotice('请先粘贴 Excel、CSV 或制表符分隔的数据。');
      return;
    }
    const nextRows = mode === 'replace'
      ? replaceListViewRowsFromMatrix(rows, columns.length, matrix)
      : applyListViewCellMatrix(rows, columns.length, rows.length, 0, matrix);
    onChange(columns, nextRows);
    setNotice(`${mode === 'replace' ? '已替换' : '已追加'} ${matrix.length} 行数据；超出当前列数的单元格已忽略。`);
    setBatchText('');
    setShowBatchPaste(false);
  };

  const title = kind === 'columns' ? '编辑 ListView 列' : '编辑 ListView 数据';
  const description = kind === 'columns'
    ? '列顺序、宽度和对齐会立即同步到设计画布与生成的原生程序。'
    : '每个输入框对应一个真实单元格。Tab 横向移动，Enter 纵向移动；可直接粘贴 Excel 的多行多列区域。';

  const renderRowActions = (index: number) => (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" aria-label={`复制第 ${index + 1} 行`} title="复制行" onClick={() => duplicateRow(index)} className={iconButton}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`上移第 ${index + 1} 行`} title="上移" disabled={index === 0} onClick={() => moveRow(index, index - 1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`下移第 ${index + 1} 行`} title="下移" disabled={index === rows.length - 1} onClick={() => moveRow(index, index + 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`删除第 ${index + 1} 行`} title="删除行" onClick={() => deleteRow(index)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5"
      role="presentation"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="list-view-collection-title"
        aria-describedby="list-view-collection-description"
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${
          isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'
        }`}
      >
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          {kind === 'columns' ? <Columns3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" /> : <Rows3 className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />}
          <div className="min-w-0 flex-1">
            <h2 id="list-view-collection-title" className="truncate text-sm font-bold sm:text-base">{title} · {controlName}</h2>
            <p id="list-view-collection-description" className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>
          </div>
          <button ref={firstButtonRef} type="button" onClick={onClose} aria-label="关闭 ListView 集合编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          {kind === 'columns' ? (
            <button type="button" onClick={addColumn} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增列</button>
          ) : (
            <>
              <button type="button" disabled={columns.length === 0} onClick={() => addRow()} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增行</button>
              <button type="button" disabled={columns.length === 0} aria-expanded={showBatchPaste} onClick={() => setShowBatchPaste(value => !value)} className={secondaryButton}><ClipboardPaste className="h-3.5 w-3.5" />批量粘贴</button>
            </>
          )}
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{columns.length} 列 · {rows.length} 行</span>
        </div>

        {kind === 'rows' && showBatchPaste && (
          <section className={`shrink-0 border-b p-3 sm:px-5 ${isDarkMode ? 'border-[#35353e] bg-cyan-500/5' : 'border-slate-200 bg-cyan-50'}`} aria-label="批量粘贴表格数据">
            <textarea
              value={batchText}
              onChange={event => setBatchText(event.target.value)}
              rows={4}
              autoFocus
              placeholder={'从 Excel 复制后粘贴到这里，例如：\n1<Tab>第一条标题\n2<Tab>第二条标题'}
              aria-label="批量粘贴内容"
              className={`${inputClass} h-24 resize-y py-2 font-mono`}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => applyBatchPaste('replace')} className={secondaryButton}>替换全部行</button>
              <button type="button" onClick={() => applyBatchPaste('append')} className={secondaryButton}>追加到末尾</button>
              <span className={`text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>支持 Excel、CSV 和 TSV；每一行对应一个行项目。</span>
            </div>
          </section>
        )}

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {kind === 'columns' ? (
            columns.length === 0 ? (
              <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
                <Columns3 className="mb-2 h-7 w-7" />
                <p className="text-sm font-semibold">还没有列</p>
                <p className="mt-1 text-xs">先新增列，再编辑对应的行数据。</p>
                <button type="button" onClick={addColumn} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一列</button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[780px] border-separate border-spacing-0 text-left text-xs">
                    <thead><tr className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><th className="w-14 border-b p-2">列</th><th className="border-b p-2">标题</th><th className="w-36 border-b p-2">宽度</th><th className="w-32 border-b p-2">对齐</th>{showImages && <th className="w-32 border-b p-2">图片编号</th>}<th className="w-36 border-b p-2 text-right">操作</th></tr></thead>
                    <tbody>{columns.map((column, index) => (
                      <tr key={index} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-100/60'}>
                        <td className="border-b p-2 font-mono text-slate-500">{index + 1}</td>
                        <td className="border-b p-2"><input aria-label={`第 ${index + 1} 列标题`} value={column.title} onChange={event => updateColumn(index, { title: event.target.value })} className={inputClass} /></td>
                        <td className="border-b p-2"><ColumnWidthInput columnIndex={index} value={column.width} onCommit={width => updateColumn(index, { width })} className={inputClass} /></td>
                        <td className="border-b p-2">
                          <select
                            aria-label={`第 ${index + 1} 列对齐方式`}
                            value={column.alignment}
                            onChange={event => updateColumn(index, { alignment: event.target.value as ListViewEditableColumn['alignment'] })}
                            className={inputClass}
                          >
                            <option value="left">左对齐</option>
                            <option value="center">居中</option>
                            <option value="right">右对齐</option>
                          </select>
                        </td>
                        {showImages && <td className="border-b p-2"><input aria-label={`第 ${index + 1} 列图片编号`} type="number" min={-1} value={column.image} onChange={event => updateColumn(index, { image: Number(event.target.value) || 0 })} className={inputClass} /></td>}
                        <td className="border-b p-2"><div className="flex justify-end gap-0.5"><button type="button" aria-label={`左移第 ${index + 1} 列`} disabled={index === 0} onClick={() => moveColumn(index, index - 1)} className={iconButton}><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" aria-label={`右移第 ${index + 1} 列`} disabled={index === columns.length - 1} onClick={() => moveColumn(index, index + 1)} className={iconButton}><ArrowRight className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${index + 1} 列`} disabled={columns.length === 1} onClick={() => deleteColumn(index)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
                <div className="space-y-2 md:hidden">{columns.map((column, index) => (
                  <section key={index} className={`rounded border p-3 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
                    <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">第 {index + 1} 列</span><div className="flex"><button type="button" aria-label={`左移第 ${index + 1} 列`} disabled={index === 0} onClick={() => moveColumn(index, index - 1)} className={iconButton}><ArrowLeft className="h-3.5 w-3.5" /></button><button type="button" aria-label={`右移第 ${index + 1} 列`} disabled={index === columns.length - 1} onClick={() => moveColumn(index, index + 1)} className={iconButton}><ArrowRight className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${index + 1} 列`} disabled={columns.length === 1} onClick={() => deleteColumn(index)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></div>
                    <label className="mb-2 block text-[10px] text-slate-500">标题<input value={column.title} onChange={event => updateColumn(index, { title: event.target.value })} className={`${inputClass} mt-1`} /></label>
                    <label className="block text-[10px] text-slate-500">宽度<ColumnWidthInput columnIndex={index} value={column.width} onCommit={width => updateColumn(index, { width })} className={`${inputClass} mt-1`} /></label>
                    <label className="mt-2 block text-[10px] text-slate-500">
                      对齐方式
                      <select
                        value={column.alignment}
                        onChange={event => updateColumn(index, { alignment: event.target.value as ListViewEditableColumn['alignment'] })}
                        className={`${inputClass} mt-1`}
                      >
                        <option value="left">左对齐</option>
                        <option value="center">居中</option>
                        <option value="right">右对齐</option>
                      </select>
                    </label>
                    {showImages && <label className="mt-2 block text-[10px] text-slate-500">图片编号<input type="number" min={-1} value={column.image} onChange={event => updateColumn(index, { image: Number(event.target.value) || 0 })} className={`${inputClass} mt-1`} /></label>}
                  </section>
                ))}</div>
              </>
            )
          ) : columns.length === 0 ? (
            <div role="alert" className={`rounded border border-amber-500/40 bg-amber-500/10 p-5 text-center text-sm ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>请先关闭此窗口并使用“编辑列”至少创建一列。</div>
          ) : rows.length === 0 ? (
            <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
              <Rows3 className="mb-2 h-7 w-7" />
              <p className="text-sm font-semibold">还没有行数据</p>
              <p className="mt-1 text-xs">新增一行逐格填写，或者直接批量粘贴 Excel 数据。</p>
              <button type="button" onClick={() => addRow()} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一行</button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="border-separate border-spacing-0 text-left text-xs" style={{ minWidth: `${Math.max(720, columns.reduce((sum, column) => sum + Math.max(120, column.width), 0) + (showImages ? 190 : 130))}px` }}>
                  <thead><tr className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><th className="sticky left-0 z-10 w-12 border-b p-2 text-center">行</th>{columns.map((column, index) => <th key={index} className="border-b p-2" style={{ width: `${Math.max(120, column.width)}px` }}>{column.title || `列 ${index + 1}`}</th>)}{showImages && <th className="w-24 border-b p-2">图片</th>}<th className="sticky right-0 z-10 w-32 border-b p-2 text-right">操作</th></tr></thead>
                  <tbody>{rows.map((row, rowIndex) => (
                    <tr key={row.id} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-100/60'}>
                      <td className={`sticky left-0 z-10 border-b p-2 text-center font-mono text-slate-500 ${isDarkMode ? 'bg-[#18181d]' : 'bg-slate-50'}`}>{rowIndex + 1}</td>
                      {columns.map((column, columnIndex) => <td key={columnIndex} className="border-b p-1.5"><input data-list-view-cell={`${rowIndex}-${columnIndex}`} aria-label={`第 ${rowIndex + 1} 行，${column.title || `第 ${columnIndex + 1} 列`}`} value={row.cells[columnIndex] ?? ''} onChange={event => updateRowCell(rowIndex, columnIndex, event.target.value)} onKeyDown={event => handleCellKeyDown(event, rowIndex, columnIndex)} onPaste={event => handleCellPaste(event, rowIndex, columnIndex)} className={inputClass} /></td>)}
                      {showImages && <td className="border-b p-1.5"><input aria-label={`第 ${rowIndex + 1} 行图片编号`} type="number" min={-1} value={row.image} onChange={event => onChange(columns, rows.map((item, index) => index === rowIndex ? { ...item, image: Number(event.target.value) || 0 } : item))} className={inputClass} /></td>}
                      <td className={`sticky right-0 z-10 border-b p-1.5 ${isDarkMode ? 'bg-[#18181d]' : 'bg-slate-50'}`}>{renderRowActions(rowIndex)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{rows.map((row, rowIndex) => (
                <section key={row.id} className={`rounded border p-3 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
                  <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold">第 {rowIndex + 1} 行</span>{renderRowActions(rowIndex)}</div>
                  <div className="space-y-2">{columns.map((column, columnIndex) => <label key={columnIndex} className="block text-[10px] text-slate-500">{column.title || `列 ${columnIndex + 1}`}<input data-list-view-cell={`${rowIndex}-${columnIndex}`} value={row.cells[columnIndex] ?? ''} onChange={event => updateRowCell(rowIndex, columnIndex, event.target.value)} onKeyDown={event => handleCellKeyDown(event, rowIndex, columnIndex)} onPaste={event => handleCellPaste(event, rowIndex, columnIndex)} className={`${inputClass} mt-1`} /></label>)}{showImages && <label className="block text-[10px] text-slate-500">图片编号<input type="number" min={-1} value={row.image} onChange={event => onChange(columns, rows.map((item, index) => index === rowIndex ? { ...item, image: Number(event.target.value) || 0 } : item))} className={`${inputClass} mt-1`} /></label>}</div>
                </section>
              ))}</div>
            </>
          )}
        </main>

        <footer className={`flex min-h-11 shrink-0 items-center gap-2 border-t px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
          <span role="status" aria-live="polite" className={`min-w-0 flex-1 truncate text-[10px] sm:text-xs ${notice ? 'text-emerald-500' : isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{notice || '更改会立即同步到中间设计画布；行 ID 由系统自动维护。'}</span>
          <button type="button" onClick={onClose} className={`${secondaryButton} shrink-0`}>完成</button>
        </footer>
      </div>
    </div>
  );
}
