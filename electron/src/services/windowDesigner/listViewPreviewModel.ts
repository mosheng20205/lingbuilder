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
  borderColor: string;
  borderWidth: number;
  headerHeight: number;
  itemHeight: number;
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

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value) ? value : fallback;
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
    borderColor: color(properties.borderColor, '#64748B'),
    borderWidth: boundedNumber(properties.borderWidth, 1, 0, 8),
    headerHeight: boundedNumber(properties.headerHeight, 28, 16, 96),
    itemHeight: boundedNumber(properties.itemHeight, 28, 16, 96),
    columns,
    rows
  };
}
