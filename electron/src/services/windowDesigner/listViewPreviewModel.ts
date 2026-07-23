import type { LingControl } from './types';
import type { ListViewColumnAlignment } from './listViewCollectionModel';

export type ListViewPreviewMode = 'icon' | 'smallIcon' | 'list' | 'details';

export interface ListViewPreviewColumn {
  title: string;
  width: number;
  image: number;
  alignment: ListViewColumnAlignment;
}

export interface ListViewPreviewRow {
  id: string;
  cells: string[];
  image: number;
}

export interface ListViewPreviewModel {
  mode: ListViewPreviewMode;
  gridLines: boolean;
  multiple: boolean;
  columns: ListViewPreviewColumn[];
  rows: ListViewPreviewRow[];
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => typeof item === 'string' ? { title: item } : item)
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function labelOf(record: Record<string, unknown>): string {
  return String(record.title ?? record.label ?? record.name ?? record.text ?? record.id ?? '');
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : fallback;
}

function normalizeMode(value: unknown): ListViewPreviewMode {
  return value === 'icon' || value === 'smallIcon' || value === 'list' || value === 'details'
    ? value
    : 'details';
}

function normalizeAlignment(value: unknown): ListViewColumnAlignment {
  return value === 'center' || value === 'right' ? value : 'left';
}

export function createListViewPreviewModel(control: LingControl): ListViewPreviewModel {
  const properties = control.properties || {};
  const configuredColumns = asRecords(properties.columns);
  const columns = (configuredColumns.length > 0 ? configuredColumns : [{ title: '内容', width: 140, image: -1 }])
    .map(column => ({
      title: labelOf(column),
      width: finiteNumber(column.width, 140),
      image: finiteNumber(column.image, -1),
      alignment: normalizeAlignment(column.alignment)
    }));

  const rows = asRecords(properties.items).map((row, index) => {
    const configuredCells = Array.isArray(row.cells)
      ? row.cells.map(cell => String(cell ?? ''))
      : [];
    const fallbackLabel = labelOf(row);
    return {
      id: String(row.id ?? `row${index + 1}`),
      cells: configuredCells.length > 0 ? configuredCells : [fallbackLabel],
      image: finiteNumber(row.image, -1)
    };
  });

  return {
    mode: normalizeMode(properties.view),
    gridLines: properties.gridLines !== false,
    multiple: properties.multiple === true,
    columns,
    rows
  };
}
