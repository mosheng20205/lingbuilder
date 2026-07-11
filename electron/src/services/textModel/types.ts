export interface TextModelIdentity {
  workspaceId: string;
  projectId: string;
  filePath: string;
}

export interface TextPosition {
  /** One-based line number, matching Monaco's public position contract. */
  line: number;
  /** One-based UTF-16 column, matching Monaco's public position contract. */
  column: number;
}

/**
 * Selection direction is preserved: `anchor` is where selection started and
 * `active` is the moving/caret end. Reverse selections must not be reordered.
 */
export interface TextSelection {
  anchor: TextPosition;
  active: TextPosition;
}

export type SerializablePrimitive = string | number | boolean | null;
export type SerializableValue =
  | SerializablePrimitive
  | SerializableValue[]
  | { [key: string]: SerializableValue };

/**
 * Renderer-neutral editor state. `opaque` may contain Monaco's own serialized
 * view state while the normalized fields remain available to other surfaces.
 */
export interface TextEditorViewState {
  cursor: TextPosition;
  selection: TextSelection;
  scrollTop: number;
  scrollLeft: number;
  opaque?: SerializableValue;
}

export interface TextEditorStatus {
  modelId: string;
  surface: string;
  line: number;
  column: number;
  selectionLength: number;
  canUndo: boolean;
  canRedo: boolean;
  readOnly: boolean;
  positionAvailable?: boolean;
}

export interface TextModelGeneration {
  modelId: string;
  generation: number;
}

export interface TextModelRecord<TModel = unknown, THistory = unknown> {
  readonly modelId: string;
  readonly uri: string;
  readonly identity: TextModelIdentity;
  readonly generation: number;
  readonly model?: TModel;
  readonly history?: THistory;
}

export interface EnsureTextModelOptions<TModel = unknown, THistory = unknown> {
  model?: TModel;
  history?: THistory;
}

export interface TextModelServiceOptions<TModel = unknown, THistory = unknown> {
  disposeModel?: (model: TModel) => void;
  disposeHistory?: (history: THistory) => void;
}

export function normalizeTextModelIdentity(identity: TextModelIdentity): TextModelIdentity {
  const workspaceId = requireIdentityPart(identity.workspaceId, '工作区标识');
  const projectId = requireIdentityPart(identity.projectId, '项目标识');
  const filePath = normalizeTextModelFilePath(identity.filePath);
  if (!filePath) throw new Error('文件路径不能为空。');
  return { workspaceId, projectId, filePath };
}

export function normalizeTextModelFilePath(filePath: string): string {
  const source = requireIdentityPart(filePath, '文件路径').replace(/\\/gu, '/');
  const driveMatch = source.match(/^([a-z]):/iu);
  const drive = driveMatch ? `${driveMatch[1].toLowerCase()}:` : '';
  const withoutDrive = drive ? source.slice(driveMatch![0].length) : source;
  const absolute = withoutDrive.startsWith('/');
  const segments: string[] = [];

  for (const segment of withoutDrive.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') {
      if (segments.length > 0 && segments[segments.length - 1] !== '..') {
        segments.pop();
      } else if (!absolute) {
        segments.push(segment);
      }
      continue;
    }
    segments.push(segment);
  }

  const body = segments.join('/');
  if (drive) return `${drive}${absolute ? '/' : ''}${body}`;
  return `${absolute ? '/' : ''}${body}` || (absolute ? '/' : '');
}

export function textModelIdentityKey(identity: TextModelIdentity): string {
  const normalized = normalizeTextModelIdentity(identity);
  return JSON.stringify([normalized.workspaceId, normalized.projectId, normalized.filePath]);
}

/**
 * Produces a deterministic, non-reversible URI. Workspace and file-system
 * paths never appear in the URI, including percent-encoded form.
 */
export function createTextModelUri(identity: TextModelIdentity): string {
  const normalized = normalizeTextModelIdentity(identity);
  return [
    'lingbuilder://model',
    stableFingerprint(normalized.workspaceId),
    stableFingerprint(normalized.projectId),
    stableFingerprint(normalized.filePath)
  ].join('/');
}

export function createTextModelId(identity: TextModelIdentity): string {
  return `text-model-${stableFingerprint(textModelIdentityKey(identity))}`;
}

export function cloneTextEditorViewState(state: TextEditorViewState): TextEditorViewState {
  return {
    cursor: clonePosition(state.cursor),
    selection: {
      anchor: clonePosition(state.selection.anchor),
      active: clonePosition(state.selection.active)
    },
    scrollTop: finiteNonNegative(state.scrollTop),
    scrollLeft: finiteNonNegative(state.scrollLeft),
    ...(state.opaque === undefined ? {} : { opaque: cloneSerializableValue(state.opaque) })
  };
}

export function cloneSerializableValue(value: SerializableValue): SerializableValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('可序列化状态不能包含 NaN 或无穷大。');
    return value;
  }
  if (Array.isArray(value)) return value.map(item => cloneSerializableValue(item));
  if (!isPlainObject(value)) throw new Error('只能保存可序列化的编辑器视图状态。');
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneSerializableValue(item)])
  );
}

export function toSerializableValue(value: unknown): SerializableValue | undefined {
  try {
    return cloneUnknownSerializableValue(value, new Set<object>());
  } catch {
    return undefined;
  }
}

export function clampTextPosition(position: TextPosition, content: string): TextPosition {
  const lines = splitTextLines(content);
  const line = clampInteger(position.line, 1, lines.length);
  const column = clampInteger(position.column, 1, lines[line - 1].length + 1);
  return { line, column };
}

export function clampTextSelection(selection: TextSelection, content: string): TextSelection {
  return {
    anchor: clampTextPosition(selection.anchor, content),
    active: clampTextPosition(selection.active, content)
  };
}

export function clampTextEditorViewState(
  state: TextEditorViewState,
  content: string
): TextEditorViewState {
  const cloned = cloneTextEditorViewState(state);
  return {
    ...cloned,
    cursor: clampTextPosition(cloned.cursor, content),
    selection: clampTextSelection(cloned.selection, content)
  };
}

function requireIdentityPart(value: string, label: string): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized) throw new Error(`${label}不能为空。`);
  return normalized;
}

function clonePosition(position: TextPosition): TextPosition {
  return {
    line: positiveInteger(position.line),
    column: positiveInteger(position.column)
  };
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function finiteNonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function splitTextLines(content: string): string[] {
  const lines = String(content).split(/\r\n|\r|\n/u);
  return lines.length > 0 ? lines : [''];
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  const integer = Number.isFinite(value) ? Math.trunc(value) : minimum;
  return Math.min(maximum, Math.max(minimum, integer));
}

function isPlainObject(value: unknown): value is Record<string, SerializableValue> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneUnknownSerializableValue(value: unknown, seen: Set<object>): SerializableValue {
  if (value === null) return null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-finite number');
    return value;
  }
  if (!value || typeof value !== 'object') throw new Error('unsupported value');
  if (seen.has(value)) throw new Error('cyclic value');
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map(item => cloneUnknownSerializableValue(item, seen));
    }
    if (!isPlainObject(value)) throw new Error('unsupported object');
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, item]) => (
        item === undefined
          ? []
          : [[key, cloneUnknownSerializableValue(item, seen)]]
      ))
    );
  } finally {
    seen.delete(value);
  }
}

/** FNV-1a 64-bit with two independent seeds; deterministic in browser/Node. */
function stableFingerprint(value: string): string {
  const bytes = new TextEncoder().encode(value);
  const first = fnv1a64(bytes, 0xcbf29ce484222325n);
  const second = fnv1a64(bytes, 0x84222325cbf29cen);
  return `${first.toString(36).padStart(13, '0')}${second.toString(36).padStart(13, '0')}`;
}

function fnv1a64(bytes: Uint8Array, seed: bigint): bigint {
  const mask = 0xffffffffffffffffn;
  let hash = seed & mask;
  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * 0x100000001b3n) & mask;
  }
  return hash;
}
