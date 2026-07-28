import React from 'react';
import { normalizeListViewColumns } from '../services/windowDesigner/listViewCollectionModel';
import type { LingControl } from '../services/windowDesigner/types';

function alignmentClass(alignment: 'left' | 'center' | 'right'): string {
  if (alignment === 'center') return 'justify-center text-center';
  if (alignment === 'right') return 'justify-end text-right';
  return 'justify-start text-left';
}

export default function HeaderDesignerPreview({ control }: { control: LingControl }) {
  const columns = normalizeListViewColumns(control.properties?.columns);
  const visibleColumns = columns.length > 0
    ? columns
    : [{ title: '表头', width: Math.max(1, control.width), image: -1, alignment: 'left' as const }];

  return (
    <div
      role="row"
      aria-label={`${control.name} 表头预览`}
      className="flex h-full w-full min-w-0 overflow-hidden border-b border-r"
      style={{
        backgroundColor: control.background === 'transparent' ? 'transparent' : control.background,
        borderColor: control.foreground,
        color: control.foreground,
        opacity: control.isEnabled ? 1 : 0.5
      }}
    >
      {visibleColumns.map((column, index) => (
        <div
          key={index}
          role="columnheader"
          className={`flex h-full min-w-0 shrink-0 items-center overflow-hidden border-l px-1.5 ${alignmentClass(column.alignment)}`}
          style={{ width: `${Math.max(1, column.width)}px`, borderColor: control.foreground }}
        >
          <span className="truncate">{column.title || `列 ${index + 1}`}</span>
        </div>
      ))}
    </div>
  );
}
