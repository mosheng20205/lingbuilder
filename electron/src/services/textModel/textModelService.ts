import {
  cloneTextEditorViewState,
  createTextModelId,
  createTextModelUri,
  EnsureTextModelOptions,
  normalizeTextModelIdentity,
  TextEditorViewState,
  TextModelGeneration,
  TextModelIdentity,
  textModelIdentityKey,
  TextModelRecord,
  TextModelServiceOptions
} from './types';

interface MutableTextModelRecord<TModel, THistory> {
  modelId: string;
  uri: string;
  identity: TextModelIdentity;
  identityKey: string;
  generation: number;
  model?: TModel;
  history?: THistory;
}

/**
 * Owns renderer-session model identity and lifecycle without importing Monaco.
 * Monaco models/history are opaque attachments, so the service remains fully
 * testable in Node and can later be reused by a different editor host.
 */
export class TextModelService<TModel = unknown, THistory = unknown> {
  private readonly recordsByIdentity = new Map<string, MutableTextModelRecord<TModel, THistory>>();
  private readonly recordsById = new Map<string, MutableTextModelRecord<TModel, THistory>>();
  private readonly viewStates = new Map<string, Map<string, TextEditorViewState>>();
  private readonly allocatedModelIds = new Set<string>();
  private generationSequence = 0;

  constructor(private readonly options: TextModelServiceOptions<TModel, THistory> = {}) {}

  ensure(
    identity: TextModelIdentity,
    attachments: EnsureTextModelOptions<TModel, THistory> = {}
  ): TextModelRecord<TModel, THistory> {
    const normalizedIdentity = normalizeTextModelIdentity(identity);
    const identityKey = textModelIdentityKey(normalizedIdentity);
    const existing = this.recordsByIdentity.get(identityKey);
    if (existing) {
      if (existing.model === undefined && attachments.model !== undefined) existing.model = attachments.model;
      if (existing.history === undefined && attachments.history !== undefined) existing.history = attachments.history;
      return this.snapshot(existing);
    }

    const baseModelId = createTextModelId(normalizedIdentity);
    const baseUri = createTextModelUri(normalizedIdentity);
    const { modelId, uri } = this.allocateIdentity(baseModelId, baseUri);

    const record: MutableTextModelRecord<TModel, THistory> = {
      modelId,
      uri,
      identity: normalizedIdentity,
      identityKey,
      generation: ++this.generationSequence,
      ...(attachments.model === undefined ? {} : { model: attachments.model }),
      ...(attachments.history === undefined ? {} : { history: attachments.history })
    };
    this.allocatedModelIds.add(modelId);
    this.recordsByIdentity.set(identityKey, record);
    this.recordsById.set(record.modelId, record);
    return this.snapshot(record);
  }

  get(identity: TextModelIdentity): TextModelRecord<TModel, THistory> | undefined {
    const record = this.recordsByIdentity.get(textModelIdentityKey(identity));
    return record ? this.snapshot(record) : undefined;
  }

  getById(modelId: string): TextModelRecord<TModel, THistory> | undefined {
    const record = this.recordsById.get(modelId);
    return record ? this.snapshot(record) : undefined;
  }

  list(): TextModelRecord<TModel, THistory>[] {
    return Array.from(this.recordsById.values(), record => this.snapshot(record));
  }

  generation(identity: TextModelIdentity): TextModelGeneration {
    const record = this.requireRecord(identity);
    return { modelId: record.modelId, generation: record.generation };
  }

  /** Invalidates already-started asynchronous work without replacing the model. */
  nextGeneration(identity: TextModelIdentity): TextModelGeneration {
    const record = this.requireRecord(identity);
    record.generation = ++this.generationSequence;
    return { modelId: record.modelId, generation: record.generation };
  }

  isCurrent(token: TextModelGeneration): boolean {
    const record = this.recordsById.get(token.modelId);
    return Boolean(record && record.generation === token.generation);
  }

  runIfCurrent(
    token: TextModelGeneration,
    callback: (record: TextModelRecord<TModel, THistory>) => void
  ): boolean {
    const record = this.recordsById.get(token.modelId);
    if (!record || record.generation !== token.generation) return false;
    callback(this.snapshot(record));
    return true;
  }

  attachModelIfCurrent(token: TextModelGeneration, model: TModel): boolean {
    const record = this.recordsById.get(token.modelId);
    if (!record || record.generation !== token.generation) return false;
    if (record.model !== undefined && record.model !== model) this.disposeAttachedModel(record.model);
    record.model = model;
    return true;
  }

  attachHistoryIfCurrent(token: TextModelGeneration, history: THistory): boolean {
    const record = this.recordsById.get(token.modelId);
    if (!record || record.generation !== token.generation) return false;
    if (record.history !== undefined && record.history !== history) this.disposeAttachedHistory(record.history);
    record.history = history;
    return true;
  }

  rename(source: TextModelIdentity, target: TextModelIdentity): TextModelRecord<TModel, THistory> {
    const sourceKey = textModelIdentityKey(source);
    const record = this.recordsByIdentity.get(sourceKey);
    if (!record) throw new Error('找不到要重命名的文本模型。');

    const normalizedTarget = normalizeTextModelIdentity(target);
    const targetKey = textModelIdentityKey(normalizedTarget);
    const targetRecord = this.recordsByIdentity.get(targetKey);
    if (targetRecord && targetRecord !== record) throw new Error('目标文本模型已存在。');
    if (sourceKey === targetKey) return this.snapshot(record);

    this.recordsByIdentity.delete(sourceKey);
    record.identity = normalizedTarget;
    record.identityKey = targetKey;
    // modelId/URI/generation and opaque model/history deliberately remain stable.
    this.recordsByIdentity.set(targetKey, record);
    return this.snapshot(record);
  }

  dispose(identity: TextModelIdentity): boolean {
    const key = textModelIdentityKey(identity);
    const record = this.recordsByIdentity.get(key);
    if (!record) return false;
    this.disposeRecord(record);
    return true;
  }

  disposeWorkspace(workspaceId: string): number {
    const normalizedWorkspaceId = normalizeTextModelIdentity({
      workspaceId,
      projectId: '__workspace_probe__',
      filePath: '__workspace_probe__'
    }).workspaceId;
    const matches = Array.from(this.recordsById.values())
      .filter(record => record.identity.workspaceId === normalizedWorkspaceId);
    matches.forEach(record => this.disposeRecord(record));
    return matches.length;
  }

  disposeAll(): number {
    const records = Array.from(this.recordsById.values());
    records.forEach(record => this.disposeRecord(record));
    return records.length;
  }

  saveViewState(
    identity: TextModelIdentity,
    surface: string,
    state: TextEditorViewState
  ): void {
    const record = this.requireRecord(identity);
    this.saveViewStateForRecord(record, surface, state);
  }

  saveViewStateIfCurrent(
    token: TextModelGeneration,
    surface: string,
    state: TextEditorViewState
  ): boolean {
    const record = this.recordsById.get(token.modelId);
    if (!record || record.generation !== token.generation) return false;
    this.saveViewStateForRecord(record, surface, state);
    return true;
  }

  getViewState(identity: TextModelIdentity, surface: string): TextEditorViewState | undefined {
    const record = this.recordsByIdentity.get(textModelIdentityKey(identity));
    if (!record) return undefined;
    const state = this.viewStates.get(record.modelId)?.get(requireSurface(surface));
    return state ? cloneTextEditorViewState(state) : undefined;
  }

  clearViewState(identity: TextModelIdentity, surface?: string): boolean {
    const record = this.recordsByIdentity.get(textModelIdentityKey(identity));
    if (!record) return false;
    if (surface === undefined) return this.viewStates.delete(record.modelId);
    const states = this.viewStates.get(record.modelId);
    if (!states) return false;
    const removed = states.delete(requireSurface(surface));
    if (states.size === 0) this.viewStates.delete(record.modelId);
    return removed;
  }

  private saveViewStateForRecord(
    record: MutableTextModelRecord<TModel, THistory>,
    surface: string,
    state: TextEditorViewState
  ): void {
    const surfaceKey = requireSurface(surface);
    const states = this.viewStates.get(record.modelId) || new Map<string, TextEditorViewState>();
    states.set(surfaceKey, cloneTextEditorViewState(state));
    this.viewStates.set(record.modelId, states);
  }

  private requireRecord(identity: TextModelIdentity): MutableTextModelRecord<TModel, THistory> {
    const record = this.recordsByIdentity.get(textModelIdentityKey(identity));
    if (!record) throw new Error('文本模型尚未注册。');
    return record;
  }

  private disposeRecord(record: MutableTextModelRecord<TModel, THistory>): void {
    this.recordsByIdentity.delete(record.identityKey);
    this.recordsById.delete(record.modelId);
    this.viewStates.delete(record.modelId);
    if (record.model !== undefined) this.disposeAttachedModel(record.model);
    if (record.history !== undefined) this.disposeAttachedHistory(record.history);
    record.model = undefined;
    record.history = undefined;
    record.generation = ++this.generationSequence;
  }

  private disposeAttachedModel(model: TModel): void {
    this.options.disposeModel?.(model);
  }

  private disposeAttachedHistory(history: THistory): void {
    this.options.disposeHistory?.(history);
  }

  private snapshot(record: MutableTextModelRecord<TModel, THistory>): TextModelRecord<TModel, THistory> {
    return {
      modelId: record.modelId,
      uri: record.uri,
      identity: { ...record.identity },
      generation: record.generation,
      ...(record.model === undefined ? {} : { model: record.model }),
      ...(record.history === undefined ? {} : { history: record.history })
    };
  }

  /**
   * A rename intentionally retains the original ID/URI. If a new file is then
   * created at the vacated path, allocate a private suffix rather than aliasing
   * the renamed model. The suffix reveals no file-system information.
   */
  private allocateIdentity(baseModelId: string, baseUri: string): { modelId: string; uri: string } {
    let sequence = 1;
    let modelId = baseModelId;
    while (this.allocatedModelIds.has(modelId)) {
      sequence += 1;
      modelId = `${baseModelId}-${sequence}`;
    }
    return {
      modelId,
      uri: sequence === 1 ? baseUri : `${baseUri}/${sequence}`
    };
  }
}

function requireSurface(surface: string): string {
  const normalized = typeof surface === 'string' ? surface.trim() : '';
  if (!normalized) throw new Error('编辑器表面标识不能为空。');
  return normalized;
}
