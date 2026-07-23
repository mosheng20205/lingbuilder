import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export type ListViewColumnAlignment = 'left' | 'center' | 'right';

export interface ListViewEditableColumn extends Record<string, unknown> {
  title: string;
  width: number;
  image: number;
  alignment: ListViewColumnAlignment;
}

export interface ListViewEditableRow extends Record<string, unknown> {
  id: string;
  cells: string[];
  image: number;
}

function asRecords(value: Win32ControlPropertyValue | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === 'string' ? { title: item } : item)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function labelOf(record: Record<string, unknown>): string {
  return String(record.title ?? record.label ?? record.name ?? record.text ?? '');
}

function normalizeAlignment(value: unknown): ListViewColumnAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function normalizeListViewColumns(value: Win32ControlPropertyValue | undefined): ListViewEditableColumn[] {
  return asRecords(value).map(column => ({
    ...column,
    title: labelOf(column),
    width: Math.max(24, finiteNumber(column.width, 120)),
    image: finiteNumber(column.image, -1),
    alignment: normalizeAlignment(column.alignment)
  }));
}

export function normalizeListViewRows(value: Win32ControlPropertyValue | undefined): ListViewEditableRow[] {
  const usedIds = new Set<string>();
  return asRecords(value).map((row, index) => {
    let id = String(row.id ?? `row${index + 1}`);
    let suffix = index + 1;
    while (usedIds.has(id)) {
      suffix += 1;
      id = `row${suffix}`;
    }
    usedIds.add(id);
    return {
      ...row,
      id,
      cells: Array.isArray(row.cells) ? row.cells.map(cell => String(cell ?? '')) : [labelOf(row)],
      image: finiteNumber(row.image, -1)
    };
  });
}

export function createListViewColumn(index: number): ListViewEditableColumn {
  return { title: `列 ${index + 1}`, width: 120, image: -1, alignment: 'left' };
}

export function createListViewRow(
  rows: ListViewEditableRow[],
  columnCount: number,
  cells: string[] = []
): ListViewEditableRow {
  let suffix = rows.length + 1;
  const ids = new Set(rows.map(row => row.id));
  while (ids.has(`row${suffix}`)) suffix += 1;
  return {
    id: `row${suffix}`,
    cells: Array.from({ length: Math.max(0, columnCount) }, (_, index) => cells[index] ?? ''),
    image: -1
  };
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function padCells(cells: string[], columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, index) => cells[index] ?? '');
}

export function moveListViewColumn(
  columns: ListViewEditableColumn[],
  rows: ListViewEditableRow[],
  from: number,
  to: number
): { columns: ListViewEditableColumn[]; rows: ListViewEditableRow[] } {
  return {
    columns: moveItem(columns, from, to),
    rows: rows.map(row => ({ ...row, cells: moveItem(padCells(row.cells, columns.length), from, to) }))
  };
}

export function removeListViewColumn(
  columns: ListViewEditableColumn[],
  rows: ListViewEditableRow[],
  index: number
): { columns: ListViewEditableColumn[]; rows: ListViewEditableRow[] } {
  if (index < 0 || index >= columns.length) return { columns, rows };
  return {
    columns: columns.filter((_, columnIndex) => columnIndex !== index),
    rows: rows.map(row => ({
      ...row,
      cells: padCells(row.cells, columns.length).filter((_, columnIndex) => columnIndex !== index)
    }))
  };
}

export function appendListViewColumn(
  columns: ListViewEditableColumn[],
  rows: ListViewEditableRow[]
): { columns: ListViewEditableColumn[]; rows: ListViewEditableRow[] } {
  return {
    columns: [...columns, createListViewColumn(columns.length)],
    rows: rows.map(row => ({ ...row, cells: [...padCells(row.cells, columns.length), ''] }))
  };
}

export function parseListViewTabularText(text: string): string[][] {
  const normalized = text.replace(/\r\n?/g, '\n');
  if (!normalized) return [];
  if (normalized.includes('\t')) {
    const lines = normalized.split('\n');
    while (lines.length > 0 && lines.at(-1) === '') lines.pop();
    return lines.map(line => line.split('\t'));
  }
  if (normalized.includes(',')) {
    const rows: string[][] = [];
    let row: string[] = [];
    let cell = '';
    let quoted = false;
    for (let index = 0; index < normalized.length; index += 1) {
      const character = normalized[index];
      if (character === '"') {
        if (quoted && normalized[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = !quoted;
        }
      } else if (character === ',' && !quoted) {
        row.push(cell);
        cell = '';
      } else if (character === '\n' && !quoted) {
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
      } else {
        cell += character;
      }
    }
    row.push(cell);
    rows.push(row);
    while (rows.length > 0 && rows.at(-1)?.every(value => value === '')) rows.pop();
    return rows;
  }
  const lines = normalized.split('\n');
  while (lines.length > 0 && lines.at(-1) === '') lines.pop();
  return lines.map(line => [line]);
}

export function applyListViewCellMatrix(
  rows: ListViewEditableRow[],
  columnCount: number,
  startRow: number,
  startColumn: number,
  matrix: string[][]
): ListViewEditableRow[] {
  if (columnCount <= 0 || matrix.length === 0) return rows;
  const next = rows.map(row => ({ ...row, cells: [...row.cells] }));

  matrix.forEach((sourceRow, rowOffset) => {
    const rowIndex = startRow + rowOffset;
    while (next.length <= rowIndex) next.push(createListViewRow(next, columnCount));
    const target = next[rowIndex];
    const cells = Array.from({ length: columnCount }, (_, index) => target.cells[index] ?? '');
    sourceRow.forEach((cell, columnOffset) => {
      const columnIndex = startColumn + columnOffset;
      if (columnIndex < columnCount) cells[columnIndex] = cell;
    });
    next[rowIndex] = { ...target, cells };
  });

  return next;
}

export function replaceListViewRowsFromMatrix(
  rows: ListViewEditableRow[],
  columnCount: number,
  matrix: string[][]
): ListViewEditableRow[] {
  if (columnCount <= 0) return rows;
  const usedIds = new Set<string>();
  return matrix.map((cells, index) => {
    let id = rows[index]?.id || `row${index + 1}`;
    let suffix = index + 1;
    while (usedIds.has(id)) {
      suffix += 1;
      id = `row${suffix}`;
    }
    usedIds.add(id);
    return {
      id,
      cells: Array.from({ length: columnCount }, (_, columnIndex) => cells[columnIndex] ?? ''),
      image: rows[index]?.image ?? -1
    };
  });
}
