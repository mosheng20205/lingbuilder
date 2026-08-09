import { getControlDescendantIds } from './controlHierarchy';
import { reconcileRebarBands } from './designerOperations';
import type { DesignerContainerLayoutRegistry, DesignerLayoutTransferItem, DesignerPasteTarget } from './containerLayoutRegistry';
import type { LingControl, LingDesignerResource, LingWindowModel, LingWindowProject } from './types';
import { clearPastedControlTagConflicts } from './controlTagService';

export const DESIGNER_CLIPBOARD_PREFIX = 'LINGBUILDER_DESIGNER_CONTROLS:';
export const DESIGNER_CLIPBOARD_SCHEMA_VERSION = 1;
const MAX_CLIPBOARD_BYTES = 2 * 1024 * 1024;

export interface DesignerClipboardFragment {
  sourceParentId?: string;
  sourceContainerSlot?: string;
  sourceLayoutMode: string;
  rootControlIds: string[];
}

export interface DesignerClipboardPayload {
  kind: 'lingbuilder.designer.controls';
  schemaVersion: 1;
  createdAt: string;
  source: {
    projectId: string;
    windowId: string;
    designerBackend: string;
  };
  controls: LingControl[];
  rootControlIds: string[];
  fragments: DesignerClipboardFragment[];
  placements: Record<string, ReturnType<DesignerContainerLayoutRegistry['capturePlacement']>>;
  resources: LingDesignerResource[];
  requiredModules: string[];
}

export interface DesignerClipboardWriteResult {
  storage: 'system' | 'session';
  bytes: number;
  warning?: string;
}

export interface DesignerPastePlanResult {
  ok: boolean;
  project: LingWindowProject;
  window: LingWindowModel;
  insertedControlIds: string[];
  missingModules: string[];
  warnings: string[];
  errors: string[];
}

export interface CreateDesignerClipboardOptions {
  resolveModuleId?: (control: LingControl) => string | undefined;
}

export interface PlanDesignerPasteOptions {
  target: DesignerPasteTarget;
  enabledModules?: ReadonlySet<string>;
  supportsControl?: (control: LingControl) => boolean;
  hasEventHandler?: (handlerName: string) => boolean;
}

export interface ClipboardTextPort {
  writeText(value: string): Promise<void>;
  readText(): Promise<string>;
}

export class DesignerClipboardService {
  private sessionText = '';
  private pasteSerial = 0;

  constructor(
    private readonly layouts: DesignerContainerLayoutRegistry,
    private readonly systemClipboard?: ClipboardTextPort
  ) {}

  createPayload(
    project: LingWindowProject,
    window: LingWindowModel,
    selectedControlIds: readonly string[],
    options: CreateDesignerClipboardOptions = {}
  ): DesignerClipboardPayload {
    const selected = new Set(selectedControlIds.filter(id => window.controls.some(control => control.id === id)));
    const byId = new Map(window.controls.map(control => [control.id, control]));
    const rootControlIds = window.controls.filter(control => selected.has(control.id) && !hasSelectedAncestor(control, selected, byId)).map(control => control.id);
    if (!rootControlIds.length) throw new Error('请先选择要复制的控件。');

    const included = new Set(rootControlIds);
    rootControlIds.forEach(id => getControlDescendantIds(window.controls, id).forEach(descendantId => included.add(descendantId)));
    const controls = window.controls.filter(control => included.has(control.id)).map(control => structuredClone(control));
    const placements = Object.fromEntries(controls.map(control => [control.id, this.layouts.capturePlacement(window, control)]));
    const fragmentsByKey = new Map<string, DesignerClipboardFragment>();
    rootControlIds.forEach(id => {
      const placement = placements[id];
      const key = `${placement.parentId || ''}\0${placement.containerSlot || ''}\0${placement.mode}`;
      const fragment = fragmentsByKey.get(key) || {
        sourceParentId: placement.parentId,
        sourceContainerSlot: placement.containerSlot,
        sourceLayoutMode: placement.mode,
        rootControlIds: []
      };
      fragment.rootControlIds.push(id);
      fragmentsByKey.set(key, fragment);
    });

    const resourceIds = new Set((project.resources || []).map(resource => resource.id));
    const referencedIds = new Set<string>();
    controls.forEach(control => collectMatchingStrings(control.properties, resourceIds, referencedIds));
    const resources = (project.resources || []).filter(resource => referencedIds.has(resource.id)).map(resource => structuredClone(resource));
    const requiredModules = [...new Set(controls.map(control => options.resolveModuleId?.(control)).filter((id): id is string => Boolean(id)))];

    return {
      kind: 'lingbuilder.designer.controls',
      schemaVersion: DESIGNER_CLIPBOARD_SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      source: { projectId: project.id, windowId: window.id, designerBackend: window.designerBackend || 'win32' },
      controls,
      rootControlIds,
      fragments: [...fragmentsByKey.values()],
      placements,
      resources,
      requiredModules
    };
  }

  async writePayload(payload: DesignerClipboardPayload): Promise<DesignerClipboardWriteResult> {
    const text = serializeDesignerClipboard(payload);
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > MAX_CLIPBOARD_BYTES) throw new Error('设计器剪贴板数据超过 2MB，请减少一次复制的控件数量。');
    this.sessionText = text;
    if (!this.systemClipboard) return { storage: 'session', bytes, warning: '系统剪贴板不可用，数据仅在本次 IDE 会话中有效。' };
    try {
      await this.systemClipboard.writeText(text);
      return { storage: 'system', bytes };
    } catch {
      return { storage: 'session', bytes, warning: '无法写入系统剪贴板，数据仅在本次 IDE 会话中有效。' };
    }
  }

  async readPayload(): Promise<DesignerClipboardPayload> {
    let text = '';
    if (this.systemClipboard) {
      try { text = await this.systemClipboard.readText(); } catch { text = ''; }
    }
    if (!text.startsWith(DESIGNER_CLIPBOARD_PREFIX)) text = this.sessionText;
    if (!text) throw new Error('剪贴板中没有 LingBuilder 设计器控件。');
    return parseDesignerClipboard(text);
  }

  planPaste(
    payload: DesignerClipboardPayload,
    project: LingWindowProject,
    targetWindow: LingWindowModel,
    options: PlanDesignerPasteOptions
  ): DesignerPastePlanResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const enabledModules = options.enabledModules || new Set<string>();
    const missingModules = payload.requiredModules.filter(id => !enabledModules.has(id));
    if (missingModules.length) errors.push(`目标项目未启用模块：${missingModules.join('、')}。`);
    if (payload.source.designerBackend !== (targetWindow.designerBackend || 'win32')) {
      const unsupported = payload.controls.filter(control => options.supportsControl && !options.supportsControl(control));
      if (unsupported.length) errors.push(`目标 UI 后端不支持控件：${unsupported.map(item => item.name).join('、')}。`);
      else warnings.push(`正在从“${payload.source.designerBackend}”布局转换到“${targetWindow.designerBackend || 'win32'}”。`);
    } else if (options.supportsControl) {
      const unsupported = payload.controls.filter(control => !options.supportsControl!(control));
      if (unsupported.length) errors.push(`目标设计器不支持控件：${unsupported.map(item => item.name).join('、')}。`);
    }

    const sourceById = new Map(payload.controls.map(control => [control.id, control]));
    const rootItems: DesignerLayoutTransferItem[] = payload.rootControlIds.map(id => ({
      sourceId: id,
      control: sourceById.get(id)!,
      placement: payload.placements[id]
    })).filter(item => item.control && item.placement);
    const placementPlan = this.layouts.planPaste(targetWindow, options.target, rootItems);
    warnings.push(...placementPlan.warnings);
    errors.push(...placementPlan.errors);
    if (errors.length) return { ok: false, project, window: targetWindow, insertedControlIds: [], missingModules, warnings, errors };

    const existingIds = new Set(targetWindow.controls.map(control => control.id));
    const existingNames = new Set(targetWindow.controls.map(control => control.name));
    const idMap = new Map<string, string>();
    const nameMap = new Map<string, string>();
    payload.controls.forEach(control => {
      const id = uniqueId(control.id, existingIds, ++this.pasteSerial);
      existingIds.add(id);
      idMap.set(control.id, id);
      const name = uniqueName(control.name, existingNames);
      existingNames.add(name);
      nameMap.set(control.id, name);
    });
    const plannedBySource = new Map(placementPlan.placements.map(item => [item.sourceId, item]));
    const rootDeltas = new Map<string, { x: number; y: number }>();
    payload.rootControlIds.forEach(id => {
      const source = sourceById.get(id);
      const placement = plannedBySource.get(id);
      if (source && placement) rootDeltas.set(id, { x: placement.x - source.x, y: placement.y - source.y });
    });

    const targetIsDifferentProject = payload.source.projectId !== project.id;
    const clonedControls = payload.controls.map(control => {
      const rootId = findClipboardRoot(control.id, payload.rootControlIds, sourceById);
      const delta = rootDeltas.get(rootId) || { x: 0, y: 0 };
      const rootPlacement = plannedBySource.get(control.id);
      const clone = structuredClone(control);
      clone.id = idMap.get(control.id)!;
      clone.name = nameMap.get(control.id)!;
      clone.designerLocked = false;
      clone.x = rootPlacement?.x ?? control.x + delta.x;
      clone.y = rootPlacement?.y ?? control.y + delta.y;
      clone.parentId = control.parentId && idMap.has(control.parentId)
        ? idMap.get(control.parentId)
        : rootPlacement?.parentId;
      clone.containerSlot = rootPlacement ? rootPlacement.containerSlot : control.containerSlot;
      clone.designerLayout = rootPlacement?.designerLayout ?? clone.designerLayout;
      clone.properties = remapObjectStrings(clone.properties, idMap) as LingControl['properties'];
      if (targetIsDifferentProject && clone.events) {
        const retained = Object.fromEntries(Object.entries(clone.events).filter(([, handler]) => options.hasEventHandler?.(handler)));
        const removed = Object.keys(clone.events).length - Object.keys(retained).length;
        if (removed) warnings.push(`控件“${clone.name}”有 ${removed} 个事件绑定在目标项目中无法确认，已移除。`);
        clone.events = Object.keys(retained).length ? retained : undefined;
      }
      return clone;
    });
    const tagResult = clearPastedControlTagConflicts(targetWindow.controls, clonedControls);
    const clones = tagResult.controls;
    warnings.push(...tagResult.warnings);

    const resourceIdMap = new Map<string, string>();
    const existingResourceIds = new Set((project.resources || []).map(resource => resource.id));
    const existingResourceNames = new Set((project.resources || []).map(resource => resource.name));
    const resources = targetIsDifferentProject ? payload.resources.map(resource => {
      const clone = structuredClone(resource);
      clone.id = uniqueId(resource.id, existingResourceIds, ++this.pasteSerial);
      existingResourceIds.add(clone.id);
      resourceIdMap.set(resource.id, clone.id);
      clone.name = uniqueName(resource.name, existingResourceNames);
      existingResourceNames.add(clone.name);
      return clone;
    }) : [];
    if (!targetIsDifferentProject) payload.resources.forEach(resource => resourceIdMap.set(resource.id, resource.id));
    clones.forEach(control => { control.properties = remapObjectStrings(control.properties, resourceIdMap) as LingControl['properties']; });

    let nextWindow: LingWindowModel = { ...targetWindow, controls: [...targetWindow.controls, ...clones] };
    nextWindow = this.layouts.normalizeChildren(nextWindow, options.target.parentId);
    const nextProject: LingWindowProject = {
      ...project,
      windows: project.windows.map(window => window.id === targetWindow.id ? nextWindow : window),
      resources: [...(project.resources || []), ...resources]
    };
    return {
      ok: true,
      project: nextProject,
      window: nextWindow,
      insertedControlIds: payload.rootControlIds.map(id => idMap.get(id)!).filter(Boolean),
      missingModules,
      warnings: [...new Set(warnings)],
      errors: []
    };
  }
}

export function serializeDesignerClipboard(payload: DesignerClipboardPayload): string {
  return `${DESIGNER_CLIPBOARD_PREFIX}${JSON.stringify(payload)}`;
}

export function parseDesignerClipboard(text: string): DesignerClipboardPayload {
  if (!text.startsWith(DESIGNER_CLIPBOARD_PREFIX)) throw new Error('剪贴板不是 LingBuilder 设计器数据。');
  if (new TextEncoder().encode(text).byteLength > MAX_CLIPBOARD_BYTES) throw new Error('剪贴板数据超过 2MB 安全限制。');
  let value: unknown;
  try { value = JSON.parse(text.slice(DESIGNER_CLIPBOARD_PREFIX.length)); }
  catch { throw new Error('剪贴板中的设计器数据已损坏。'); }
  const payload = value as Partial<DesignerClipboardPayload>;
  if (payload.kind !== 'lingbuilder.designer.controls' || payload.schemaVersion !== DESIGNER_CLIPBOARD_SCHEMA_VERSION) {
    throw new Error('剪贴板设计器数据版本不受支持。');
  }
  if (!payload.source || !Array.isArray(payload.controls) || !Array.isArray(payload.rootControlIds) || !payload.placements) {
    throw new Error('剪贴板设计器数据缺少必要字段。');
  }
  if (payload.controls.length > 5000 || (payload.resources?.length || 0) > 1000) throw new Error('剪贴板设计器节点或资源数量超过安全限制。');
  const ids = new Set<string>();
  for (const control of payload.controls) {
    if (!control || typeof control.id !== 'string' || !control.id.trim() || ids.has(control.id)) throw new Error('剪贴板包含空白或重复控件 ID。');
    if (typeof control.type !== 'string' || typeof control.name !== 'string') throw new Error('剪贴板控件类型或名称无效。');
    if (![control.x, control.y, control.width, control.height].every(value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1_000_000) || control.width <= 0 || control.height <= 0) throw new Error('剪贴板控件几何数据无效。');
    ids.add(control.id);
  }
  if (!payload.rootControlIds.every(id => ids.has(id))) throw new Error('剪贴板顶层控件引用无效。');
  if (!payload.rootControlIds.every(id => {
    const placement = payload.placements?.[id];
    return placement && [placement.x, placement.y, placement.width, placement.height].every(value => typeof value === 'number' && Number.isFinite(value));
  })) throw new Error('剪贴板顶层控件缺少有效布局位置。');
  const byId = new Map(payload.controls.map(control => [control.id, control]));
  for (const control of payload.controls) {
    const visited = new Set<string>([control.id]);
    let parentId = control.parentId;
    while (parentId && byId.has(parentId)) {
      if (visited.has(parentId)) throw new Error('剪贴板控件父子关系存在循环。');
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId;
    }
  }
  payload.fragments = Array.isArray(payload.fragments) ? payload.fragments : [];
  payload.resources = Array.isArray(payload.resources) ? payload.resources : [];
  payload.requiredModules = Array.isArray(payload.requiredModules)
    ? payload.requiredModules.filter((id): id is string => typeof id === 'string' && Boolean(id.trim()))
    : [];
  return structuredClone(payload as DesignerClipboardPayload);
}

export function removeClipboardSelection(window: LingWindowModel, selectedIds: readonly string[]): LingWindowModel {
  const removing = new Set(selectedIds);
  selectedIds.forEach(id => getControlDescendantIds(window.controls, id).forEach(descendant => removing.add(descendant)));
  return { ...window, controls: reconcileAfterRemoval(window.controls.filter(control => !removing.has(control.id))) };
}

function reconcileAfterRemoval(controls: LingControl[]): LingControl[] {
  const existing = new Set(controls.map(control => control.id));
  return reconcileRebarBands(controls.map(control => control.parentId && !existing.has(control.parentId)
    ? { ...control, parentId: undefined, containerSlot: undefined }
    : control));
}

function hasSelectedAncestor(control: LingControl, selected: ReadonlySet<string>, byId: ReadonlyMap<string, LingControl>): boolean {
  const visited = new Set<string>();
  let parentId = control.parentId;
  while (parentId && !visited.has(parentId)) {
    if (selected.has(parentId)) return true;
    visited.add(parentId);
    parentId = byId.get(parentId)?.parentId;
  }
  return false;
}

function findClipboardRoot(id: string, roots: readonly string[], byId: ReadonlyMap<string, LingControl>): string {
  const rootSet = new Set(roots);
  let current = id;
  const visited = new Set<string>();
  while (!rootSet.has(current) && !visited.has(current)) {
    visited.add(current);
    const parentId = byId.get(current)?.parentId;
    if (!parentId) break;
    current = parentId;
  }
  return rootSet.has(current) ? current : id;
}

function uniqueId(source: string, existing: ReadonlySet<string>, serial: number): string {
  const base = source.replace(/[^a-z0-9_\-]/giu, '_') || 'control';
  let candidate = `${base}_copy_${Date.now().toString(36)}_${serial.toString(36)}`;
  let suffix = 2;
  while (existing.has(candidate)) candidate = `${base}_copy_${suffix++}`;
  return candidate;
}

function uniqueName(source: string, existing: ReadonlySet<string>): string {
  const base = `${source}副本`;
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

function collectMatchingStrings(value: unknown, candidates: ReadonlySet<string>, result: Set<string>): void {
  if (typeof value === 'string') { if (candidates.has(value)) result.add(value); return; }
  if (Array.isArray(value)) { value.forEach(item => collectMatchingStrings(item, candidates, result)); return; }
  if (value && typeof value === 'object') Object.values(value).forEach(item => collectMatchingStrings(item, candidates, result));
}

function remapObjectStrings(value: unknown, mapping: ReadonlyMap<string, string>): unknown {
  if (typeof value === 'string') return mapping.get(value) || value;
  if (Array.isArray(value)) return value.map(item => remapObjectStrings(item, mapping));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, remapObjectStrings(item, mapping)]));
  return value;
}
