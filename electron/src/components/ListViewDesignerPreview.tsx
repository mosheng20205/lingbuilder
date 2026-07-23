import React from 'react';
import type { LingControl } from '../services/windowDesigner/types';
import { createListViewPreviewModel } from '../services/windowDesigner/listViewPreviewModel';

export interface ListViewDesignerPreviewProps {
  control: LingControl;
}

function alignmentClass(alignment: 'left' | 'center' | 'right'): string {
  if (alignment === 'center') return 'justify-center text-center';
  if (alignment === 'right') return 'justify-end text-right';
  return 'justify-start text-left';
}

function PreviewImage({ image, compact = false }: { image: number; compact?: boolean }) {
  if (image < 0) return null;
  const size = compact ? 10 : 14;
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-sm border border-sky-400/40 bg-sky-500/15 font-mono text-sky-300"
      style={{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.max(6, size - 5)}px` }}
    >
      {image}
    </span>
  );
}

export default function ListViewDesignerPreview({ control }: ListViewDesignerPreviewProps) {
  const model = createListViewPreviewModel(control);
  const fontSize = Math.max(9, control.fontSize);
  const background = control.background === 'transparent' ? 'rgba(15, 23, 42, 0.9)' : control.background;
  const foreground = control.foreground || '#e2e8f0';
  const borderStyle = `${model.borderWidth}px solid ${model.borderColor}`;

  if (model.mode !== 'details') {
    const iconMode = model.mode === 'icon';
    const smallIconMode = model.mode === 'smallIcon';
    return (
      <div
        data-list-view-preview={model.mode}
        className={`h-full w-full overflow-hidden p-1 ${
          iconMode ? 'grid content-start grid-cols-[repeat(auto-fill,minmax(72px,1fr))] gap-1' : 'flex flex-col content-start gap-0.5'
        }`}
        style={{ backgroundColor: background, color: foreground, fontSize: `${fontSize}px`, opacity: control.isEnabled ? 1 : 0.5, border: borderStyle }}
      >
        {model.rows.length > 0 ? model.rows.map(row => (
          <div
            key={row.id}
            className={`flex min-w-0 items-center rounded px-1 ${
              iconMode ? 'h-16 flex-col justify-center gap-1 text-center' : 'justify-start gap-1.5'
            } ${model.gridLines ? 'border border-slate-500/35' : ''}`}
            style={{ minHeight: iconMode ? undefined : `${model.itemHeight}px` }}
          >
            <PreviewImage image={row.image} compact={smallIconMode || model.mode === 'list'} />
            <span className="max-w-full truncate">{row.cells.filter(Boolean).join('　') || row.id}</span>
          </div>
        )) : (
          <span className="col-span-full self-center justify-self-center px-2 py-1 text-slate-400">暂无行项目</span>
        )}
      </div>
    );
  }

  const columnWidths = model.columns.map(column => Math.max(36, column.width));
  const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const gridTemplateColumns = columnWidths.map(width => `${width}px`).join(' ');
  const cellBorderClass = model.gridLines ? 'border-r border-b border-slate-500/45' : '';

  return (
    <div
      data-list-view-preview="details"
      className="h-full w-full overflow-hidden"
      style={{ backgroundColor: background, color: foreground, fontSize: `${fontSize}px`, opacity: control.isEnabled ? 1 : 0.5, border: borderStyle }}
    >
      <div style={{ width: `${Math.max(control.width, tableWidth)}px`, minWidth: '100%' }}>
        <div
          role="row"
          className="grid bg-slate-500/25 font-semibold shadow-[inset_0_-1px_0_rgba(148,163,184,0.5)]"
          style={{ gridTemplateColumns, height: `${model.headerHeight}px` }}
        >
          {model.columns.map((column, index) => (
            <div key={`${column.title}-${index}`} role="columnheader" className={`flex min-w-0 items-center gap-1 px-1.5 ${alignmentClass(column.alignment)} ${cellBorderClass}`}>
              <PreviewImage image={column.image} compact />
              <span className="truncate">{column.title || `列 ${index + 1}`}</span>
            </div>
          ))}
        </div>

        {model.rows.length > 0 ? model.rows.map((row, rowIndex) => (
          <div
            key={row.id}
            role="row"
            className={`grid ${rowIndex % 2 === 1 ? 'bg-slate-400/5' : ''}`}
            style={{ gridTemplateColumns, height: `${model.itemHeight}px` }}
          >
            {model.columns.map((column, columnIndex) => (
              <div key={`${row.id}-${columnIndex}`} role="cell" className={`flex min-w-0 items-center gap-1 px-1.5 ${alignmentClass(column.alignment)} ${cellBorderClass}`}>
                {columnIndex === 0 && <PreviewImage image={row.image} compact />}
                <span className="truncate">{row.cells[columnIndex] ?? ''}</span>
              </div>
            ))}
          </div>
        )) : (
          <div className="flex items-center justify-center px-2 text-slate-400" style={{ height: `${model.itemHeight * 2}px` }}>
            暂无行项目
          </div>
        )}
      </div>
    </div>
  );
}
