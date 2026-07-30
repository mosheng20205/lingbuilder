import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export const DATA_GRID_SCHEMA_VERSION = 1 as const;

export type DataGridColumnType =
  | 'text' | 'integer' | 'decimal' | 'date'
  | 'checkbox' | 'switch' | 'image' | 'progress' | 'combo' | 'buttons';
export type DataGridAlignment = 'left' | 'center' | 'right';
export type DataGridSelectionMode = 'none' | 'cell' | 'row' | 'multiRow' | 'range';
export type DataGridImageMode = 'tile' | 'contain' | 'cover' | 'center' | 'stretch';
export type DataGridProgressState = 'normal' | 'success' | 'warning' | 'error' | 'paused' | 'indeterminate';
export type DataGridButtonStyle = 'normal' | 'primary' | 'danger';
export type DataGridCellValue = string | number | boolean | null;

export interface DataGridOption {
  value: string;
  label: string;
}

export interface DataGridButtonDefinition {
  id: string;
  text: string;
  style: DataGridButtonStyle;
  icon?: string;
  tooltip?: string;
  visible?: boolean;
  enabled?: boolean;
}

export interface DataGridColumn {
  id: string;
  title: string;
  type: DataGridColumnType;
  width: number;
  minWidth: number;
  maxWidth: number;
  alignment: DataGridAlignment;
  readOnly: boolean;
  visible: boolean;
  frozen: boolean;
  sortable: boolean;
  filterable: boolean;
  required: boolean;
  format: string;
  threeState?: boolean;
  onText?: string;
  offText?: string;
  imageMode?: DataGridImageMode;
  progressMinimum?: number;
  progressMaximum?: number;
  progressShowText?: boolean;
  allowCustomInput?: boolean;
  options?: DataGridOption[];
  buttons?: DataGridButtonDefinition[];
  numericMinimum?: number;
  numericMaximum?: number;
  textPattern?: string;
}

export interface DataGridCellOverride {
  readOnly?: boolean;
  options?: DataGridOption[];
  imageMode?: DataGridImageMode;
  progressState?: DataGridProgressState;
  buttonStates?: Record<string, Partial<Pick<DataGridButtonDefinition, 'text' | 'style' | 'visible' | 'enabled'>>>;
}

export interface DataGridRow {
  key: string;
  cells: Record<string, DataGridCellValue>;
  enabled: boolean;
  cellOverrides?: Record<string, DataGridCellOverride>;
}

export interface DataGridModel {
  dataGridSchemaVersion: typeof DATA_GRID_SCHEMA_VERSION;
  columns: DataGridColumn[];
  rows: DataGridRow[];
  selectionMode: DataGridSelectionMode;
  emptyText: string;
  virtualMode: boolean;
  virtualRowCount: number;
}

const COLUMN_TYPES = new Set<DataGridColumnType>([
  'text', 'integer', 'decimal', 'date', 'checkbox', 'switch', 'image', 'progress', 'combo', 'buttons'
]);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const asString = (value: unknown, fallback = ''): string => typeof value === 'string' ? value : fallback;
const asBoolean = (value: unknown, fallback: boolean): boolean => typeof value === 'boolean' ? value : fallback;
const asNumber = (value: unknown, fallback: number): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const stableId = (candidate: unknown, prefix: string, index: number, used: Set<string>): string => {
  const base = asString(candidate).trim().replace(/[^\p{L}\p{N}_-]+/gu, '_') || `${prefix}${index + 1}`;
  let result = base;
  let suffix = 2;
  while (used.has(result)) result = `${base}_${suffix++}`;
  used.add(result);
  return result;
};

function normalizeOptions(value: unknown): DataGridOption[] {
  const used = new Set<string>();
  return asArray(value).flatMap((item, index) => {
    const record = asRecord(item);
    const rawValue = (record ? asString(record.value ?? record.id) : asString(item)).trim() || `option${index + 1}`;
    let optionValue = rawValue;
    let suffix = 2;
    while (used.has(optionValue)) optionValue = `${rawValue}_${suffix++}`;
    used.add(optionValue);
    return [{ value: optionValue, label: record ? asString(record.label ?? record.text, optionValue) : rawValue }];
  });
}

const LEGACY_NEW_EMOJI_COLUMN_TYPES: Record<string, DataGridColumnType> = {
  text: 'text', index: 'integer', selection: 'checkbox', checkbox: 'checkbox',
  switch: 'switch', combo: 'combo', select: 'combo', button: 'buttons', buttons: 'buttons',
  progress: 'progress', image: 'image', date: 'date', integer: 'integer', decimal: 'decimal',
  expand: 'text', status: 'text', tag: 'text', popovertag: 'text'
};

function normalizeLegacyNewEmojiColumn(item: unknown, index: number): unknown {
  const record = asRecord(item);
  if (!record) return item;
  const legacyType = asString(record.type ?? record.kind ?? record.cellType).toLocaleLowerCase();
  const type = LEGACY_NEW_EMOJI_COLUMN_TYPES[legacyType] || 'text';
  const title = record.title ?? record.label ?? record.name;
  const buttons = type === 'buttons' && !Array.isArray(record.buttons)
    ? [{ id: `button${index + 1}`, text: asString(record.buttonText ?? title, '按钮') }]
    : record.buttons;
  return { ...record, type, title, buttons };
}

function normalizeButtons(value: unknown): DataGridButtonDefinition[] {
  const used = new Set<string>();
  return asArray(value).map((item, index) => {
    const record = asRecord(item) || {};
    const style = asString(record.style) as DataGridButtonStyle;
    const id = stableId(record.id, 'button', index, used);
    return {
      id,
      text: asString(record.text ?? record.label, `按钮${index + 1}`),
      style: style === 'primary' || style === 'danger' ? style : 'normal',
      icon: asString(record.icon) || undefined,
      tooltip: asString(record.tooltip) || undefined,
      visible: asBoolean(record.visible, true),
      enabled: asBoolean(record.enabled, true)
    };
  });
}

export function createDefaultDataGridColumns(): DataGridColumn[] {
  return normalizeDataGridColumns([
    { id: 'name', title: '名称', type: 'text', width: 180 },
    { id: 'status', title: '状态', type: 'text', width: 140 }
  ]);
}

export function normalizeDataGridColumns(value: unknown): DataGridColumn[] {
  const used = new Set<string>();
  return asArray(value).map((item, index) => {
    const record = asRecord(item) || {};
    const typeCandidate = asString(record.type) as DataGridColumnType;
    const type = COLUMN_TYPES.has(typeCandidate) ? typeCandidate : 'text';
    const width = clamp(Math.round(asNumber(record.width, 140)), 32, 4000);
    const minWidth = clamp(Math.round(asNumber(record.minWidth, 32)), 16, width);
    const maxWidth = clamp(Math.round(asNumber(record.maxWidth, Math.max(width, 600))), width, 8000);
    const alignmentCandidate = asString(record.alignment) as DataGridAlignment;
    return {
      id: stableId(record.id ?? record.key, 'column', index, used),
      title: asString(record.title ?? record.label, `列 ${index + 1}`),
      type,
      width,
      minWidth,
      maxWidth,
      alignment: alignmentCandidate === 'left' || alignmentCandidate === 'right' ? alignmentCandidate : 'center',
      readOnly: asBoolean(record.readOnly, false),
      visible: asBoolean(record.visible, true),
      frozen: asBoolean(record.frozen, false),
      sortable: asBoolean(record.sortable, true),
      filterable: asBoolean(record.filterable, true),
      required: asBoolean(record.required, false),
      format: asString(record.format),
      threeState: asBoolean(record.threeState, false),
      onText: asString(record.onText, '开启'),
      offText: asString(record.offText, '关闭'),
      imageMode: ['tile', 'cover', 'center', 'stretch'].includes(asString(record.imageMode)) ? asString(record.imageMode) as DataGridImageMode : 'contain',
      progressMinimum: asNumber(record.progressMinimum, 0),
      progressMaximum: asNumber(record.progressMaximum, 100),
      progressShowText: asBoolean(record.progressShowText, true),
      allowCustomInput: asBoolean(record.allowCustomInput, false),
      options: normalizeOptions(record.options),
      buttons: normalizeButtons(record.buttons),
      ...(Number.isFinite(Number(record.numericMinimum)) ? { numericMinimum: Number(record.numericMinimum) } : {}),
      ...(Number.isFinite(Number(record.numericMaximum)) ? { numericMaximum: Number(record.numericMaximum) } : {}),
      ...(asString(record.textPattern) ? { textPattern: asString(record.textPattern) } : {})
    };
  });
}

export function coerceDataGridCellValue(column: DataGridColumn, value: unknown): DataGridCellValue {
  if (value === null && column.type === 'checkbox' && column.threeState) return null;
  if (column.type === 'checkbox' || column.type === 'switch') {
    if (typeof value === 'boolean') return value;
    const normalized = asString(value).trim().toLocaleLowerCase();
    return ['1', 'true', 'yes', '是', '真', '开启', '选中'].includes(normalized);
  }
  if (column.type === 'integer') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  if (column.type === 'decimal' || column.type === 'progress') {
    const parsed = Number(value);
    const numeric = Number.isFinite(parsed) ? parsed : 0;
    if (column.type !== 'progress') return numeric;
    return clamp(numeric, column.progressMinimum ?? 0, column.progressMaximum ?? 100);
  }
  return value === null || value === undefined ? '' : String(value);
}

export function normalizeDataGridRows(value: unknown, columns: DataGridColumn[]): DataGridRow[] {
  const used = new Set<string>();
  return asArray(value).map((item, index) => {
    const record = asRecord(item) || {};
    const rawCells = asRecord(record.cells) || {};
    const legacyCells = asArray(record.cells);
    const cells = Object.fromEntries(columns.map((column, columnIndex) => [
      column.id,
      coerceDataGridCellValue(column, rawCells[column.id] ?? legacyCells[columnIndex] ?? '')
    ]));
    return {
      key: stableId(record.key ?? record.id, 'row', index, used),
      cells,
      enabled: asBoolean(record.enabled, true),
      ...(asRecord(record.cellOverrides) ? { cellOverrides: record.cellOverrides as Record<string, DataGridCellOverride> } : {})
    };
  });
}

export function normalizeDataGridModel(value?: Partial<DataGridModel> | null): DataGridModel {
  const columns = normalizeDataGridColumns(value?.columns);
  const selectionMode = value?.selectionMode;
  return {
    dataGridSchemaVersion: DATA_GRID_SCHEMA_VERSION,
    columns: columns.length > 0 ? columns : createDefaultDataGridColumns(),
    rows: normalizeDataGridRows(value?.rows, columns.length > 0 ? columns : createDefaultDataGridColumns()),
    selectionMode: selectionMode === 'none' || selectionMode === 'row' || selectionMode === 'multiRow' || selectionMode === 'range' ? selectionMode : 'cell',
    emptyText: asString(value?.emptyText, '暂无数据'),
    virtualMode: asBoolean(value?.virtualMode, false),
    virtualRowCount: Math.max(0, Math.trunc(asNumber(value?.virtualRowCount, 0)))
  };
}

/** 只迁移编辑模型；调用方必须保留旧控件的 designerType、后端和生成适配器。 */
export function migrateLegacyNewEmojiTableProperties(properties: Record<string, unknown>): Record<string, unknown> {
  if (properties.dataGridSchemaVersion === DATA_GRID_SCHEMA_VERSION) return properties;
  const rawColumns = asArray(properties.tableColumnsEx).length ? properties.tableColumnsEx : properties.columns;
  const columns = normalizeDataGridColumns(asArray(rawColumns).map(normalizeLegacyNewEmojiColumn));
  const rawRows = asArray(properties.tableRowsEx).length ? properties.tableRowsEx : properties.rows ?? properties.items;
  const rows = normalizeDataGridRows(rawRows, columns);
  return { ...properties, dataGridSchemaVersion: DATA_GRID_SCHEMA_VERSION, dataGridColumns: columns, dataGridRows: rows };
}

export function removeDataGridColumn(model: DataGridModel, columnId: string): DataGridModel {
  const columns = model.columns.filter(column => column.id !== columnId);
  return {
    ...model,
    columns,
    rows: model.rows.map(row => {
      const cells = { ...row.cells };
      const cellOverrides = { ...(row.cellOverrides || {}) };
      delete cells[columnId];
      delete cellOverrides[columnId];
      return { ...row, cells, ...(Object.keys(cellOverrides).length ? { cellOverrides } : { cellOverrides: undefined }) };
    })
  };
}

export function moveDataGridColumn(model: DataGridModel, from: number, to: number): DataGridModel {
  if (from < 0 || to < 0 || from >= model.columns.length || to >= model.columns.length || from === to) return model;
  const columns = [...model.columns];
  const [column] = columns.splice(from, 1);
  columns.splice(to, 0, column);
  return { ...model, columns };
}

export function parseDataGridDelimited(text: string, delimiter: ',' | '\t'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (!quoted && char === delimiter) { row.push(cell); cell = ''; continue; }
    if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.length > 1 || row[0] || rows.length === 0) rows.push(row);
  return rows;
}

export function encodeDataGridDelimited(rows: readonly (readonly unknown[])[], delimiter: ',' | '\t'): string {
  return rows.map(row => row.map(value => {
    const text = value === null || value === undefined ? '' : String(value);
    return /["\r\n,\t\\]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
  }).join(delimiter)).join('\r\n');
}

export function dataGridModelToPropertyValues(model: DataGridModel): {
  dataGridSchemaVersion: number;
  dataGridColumns: Win32ControlPropertyValue;
  dataGridRows: Win32ControlPropertyValue;
} {
  return {
    dataGridSchemaVersion: model.dataGridSchemaVersion,
    dataGridColumns: model.columns as unknown as Win32ControlPropertyValue,
    dataGridRows: model.rows as unknown as Win32ControlPropertyValue
  };
}
