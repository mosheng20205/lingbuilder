import React from 'react';
import type { LingControl } from '../services/windowDesigner/types';
import {
  normalizeDataGridModel,
  type DataGridColumn,
  type DataGridRow
} from '../services/windowDesigner/dataGridModel';
import { getControlFontCssStyle } from '../services/windowDesigner/controlFont';

function alignmentClass(alignment: DataGridColumn['alignment']): string {
  if (alignment === 'right') return 'justify-end text-right';
  if (alignment === 'left') return 'justify-start text-left';
  return 'justify-center text-center';
}

function displayValue(column: DataGridColumn, row: DataGridRow): React.ReactNode {
  const value = row.cells[column.id];
  if (column.type === 'checkbox') {
    const checked = value === true;
    const mixed = value === null;
    return <span className={`inline-flex h-4 w-4 items-center justify-center rounded border ${checked || mixed ? 'border-cyan-400 bg-cyan-500/25 text-cyan-200' : 'border-slate-500'}`}>{mixed ? '—' : checked ? '✓' : ''}</span>;
  }
  if (column.type === 'switch') {
    const checked = value === true;
    return <span className={`inline-flex h-5 min-w-10 items-center rounded-full px-0.5 ${checked ? 'justify-end bg-emerald-500' : 'justify-start bg-slate-600'}`}><span className="h-4 w-4 rounded-full bg-white shadow" /><span className="sr-only">{checked ? column.onText : column.offText}</span></span>;
  }
  if (column.type === 'image') {
    return value ? <span className="flex h-7 w-9 items-center justify-center overflow-hidden rounded border border-slate-500/40 bg-slate-700/40 text-[8px] text-slate-300">图片</span> : <span className="text-slate-500">—</span>;
  }
  if (column.type === 'progress') {
    const minimum = column.progressMinimum ?? 0;
    const maximum = column.progressMaximum ?? 100;
    const numeric = typeof value === 'number' ? value : Number(value) || minimum;
    const ratio = Math.max(0, Math.min(1, (numeric - minimum) / Math.max(1, maximum - minimum)));
    const state = row.cellOverrides?.[column.id]?.progressState || 'normal';
    const color = state === 'success' ? '#22c55e' : state === 'warning' ? '#f59e0b' : state === 'error' ? '#ef4444' : state === 'paused' ? '#a855f7' : '#0ea5e9';
    return <span className="relative block h-4 w-full overflow-hidden rounded bg-slate-700/70"><span className="absolute inset-y-0 left-0" style={{ width: `${ratio * 100}%`, backgroundColor: color }} />{column.progressShowText !== false && <span className="relative block text-center text-[9px] leading-4 text-white">{numeric}</span>}</span>;
  }
  if (column.type === 'combo') {
    const option = column.options?.find(item => item.value === String(value));
    return <span className="flex w-full items-center justify-between gap-1"><span className="truncate">{option?.label ?? String(value ?? '')}</span><span className="text-[8px] text-slate-400">▼</span></span>;
  }
  if (column.type === 'buttons') {
    const buttons = (column.buttons || []).filter(button => button.visible !== false);
    return <span className="flex min-w-0 gap-1 overflow-hidden">{buttons.slice(0, 2).map(button => <span key={button.id} className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] ${button.style === 'danger' ? 'border-red-400/50 text-red-300' : button.style === 'primary' ? 'border-cyan-400/50 text-cyan-300' : 'border-slate-500/60 text-slate-300'}`}>{button.text}</span>)}{buttons.length > 2 && <span className="shrink-0 rounded border border-slate-500/60 px-1.5 py-0.5 text-[9px]">更多</span>}</span>;
  }
  return <span className="truncate">{String(value ?? '')}</span>;
}

export default function DataGridDesignerPreview({ control }: { control: LingControl }) {
  const model = normalizeDataGridModel({
    columns: control.properties?.dataGridColumns as any,
    rows: control.properties?.dataGridRows as any,
    selectionMode: control.properties?.selectionMode as any,
    emptyText: control.properties?.emptyText as any,
    virtualMode: control.properties?.virtualMode as any,
    virtualRowCount: control.properties?.virtualRowCount as any
  });
  const visibleColumns = model.columns.filter(column => column.visible);
  const template = visibleColumns.map(column => `${Math.max(column.minWidth, Math.min(column.maxWidth, column.width))}px`).join(' ');
  const tableWidth = visibleColumns.reduce((sum, column) => sum + column.width, 0);
  const headerHeight = Math.max(20, Number(control.properties?.headerHeight) || 32);
  const rowHeight = Math.max(20, Number(control.properties?.itemHeight) || 32);
  const rows = model.virtualMode && model.rows.length === 0
    ? Array.from({ length: Math.min(4, model.virtualRowCount) }, (_, index) => ({ key: `virtual-${index}`, enabled: true, cells: Object.fromEntries(visibleColumns.map(column => [column.id, '…'])) }))
    : model.rows;
  return (
    <div
      data-data-grid-preview="true"
      className="h-full w-full overflow-hidden"
      style={{ ...getControlFontCssStyle(control), background: control.background, color: control.foreground, opacity: control.isEnabled ? 1 : 0.55, border: `${Number(control.properties?.borderWidth ?? 1)}px solid ${String(control.properties?.borderColor || '#475569')}` }}
    >
      <div style={{ minWidth: '100%', width: `${Math.max(control.width, tableWidth)}px` }}>
        <div className="grid bg-slate-500/25 font-semibold shadow-[inset_0_-1px_0_rgba(148,163,184,.45)]" style={{ gridTemplateColumns: template, height: headerHeight }}>
          {visibleColumns.map(column => <div key={column.id} data-column-alignment={column.alignment} className={`flex min-w-0 items-center border-r border-slate-500/25 px-2 ${alignmentClass(column.alignment)}`}><span className="inline-flex min-w-0 items-center gap-1"><span className="truncate">{column.title}</span>{column.sortable && <span className="shrink-0 text-[8px] text-slate-400">↕</span>}</span></div>)}
        </div>
        {rows.length ? rows.map((row, rowIndex) => <div key={row.key} className={`grid ${rowIndex % 2 ? 'bg-white/[0.035]' : ''}`} style={{ gridTemplateColumns: template, minHeight: rowHeight }}>
          {visibleColumns.map(column => <div key={`${row.key}:${column.id}`} data-cell-alignment={column.alignment} className={`flex min-w-0 items-center border-b border-r border-slate-500/20 px-2 ${alignmentClass(column.alignment)}`} style={{ height: rowHeight }}>{displayValue(column, row)}</div>)}
        </div>) : <div className="flex items-center justify-center text-slate-500" style={{ height: Math.max(64, rowHeight * 2) }}>{model.emptyText}</div>}
      </div>
    </div>
  );
}
