import { LingControl } from './types';

export interface LingControlHierarchyNode {
  control: LingControl;
  children: LingControlHierarchyNode[];
}

export interface EffectiveControlState {
  visible: boolean;
  enabled: boolean;
}

/**
 * Calculates inherited visibility/enabled state once for a complete control
 * set. The designer asks for this state for every painted control, so doing
 * the parent walk inside each render would rebuild the same map repeatedly.
 */
export function getEffectiveControlStates(controls: LingControl[]): Map<string, EffectiveControlState> {
  const controlsById = new Map(controls.map(control => [control.id, control]));
  const states = new Map<string, EffectiveControlState>();
  const resolving = new Set<string>();

  const resolve = (controlId: string): EffectiveControlState => {
    const cached = states.get(controlId);
    if (cached) return cached;
    const control = controlsById.get(controlId);
    if (!control) return { visible: true, enabled: true };
    // A malformed cycle should not make painting recurse forever. Normalized
    // projects do not hit this branch, but the fallback keeps the canvas usable
    // while a damaged project is being repaired.
    if (resolving.has(controlId)) return { visible: false, enabled: false };
    resolving.add(controlId);
    const own = {
      visible: control.visibility === 'Visible',
      enabled: control.isEnabled === true
    };
    const parent = control.parentId ? resolve(control.parentId) : undefined;
    const state = parent
      ? { visible: own.visible && parent.visible, enabled: own.enabled && parent.enabled }
      : own;
    resolving.delete(controlId);
    states.set(controlId, state);
    return state;
  };

  controls.forEach(control => resolve(control.id));
  return states;
}

function createsParentCycle(controlId: string, parentId: string, controlsById: Map<string, LingControl>): boolean {
  const visited = new Set<string>([controlId]);
  let currentId: string | undefined = parentId;

  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);
    currentId = controlsById.get(currentId)?.parentId;
  }

  return false;
}

export function normalizeControlHierarchy(controls: LingControl[]): LingControl[] {
  const controlsById = new Map(controls.map(control => [control.id, control]));
  let changed = false;

  const normalized = controls.map(control => {
    const parentId = control.parentId?.trim();
    if (!parentId || !controlsById.has(parentId) || createsParentCycle(control.id, parentId, controlsById)) {
      if (control.parentId === undefined) return control;
      changed = true;
      const { parentId: _invalidParentId, ...rest } = control;
      return rest;
    }
    if (parentId === control.parentId) return control;
    changed = true;
    return { ...control, parentId };
  });

  return changed ? normalized : controls;
}

export function buildControlHierarchy(controls: LingControl[]): LingControlHierarchyNode[] {
  const normalizedControls = normalizeControlHierarchy(controls);
  const nodesById = new Map<string, LingControlHierarchyNode>();
  normalizedControls.forEach(control => nodesById.set(control.id, { control, children: [] }));

  const roots: LingControlHierarchyNode[] = [];
  normalizedControls.forEach(control => {
    const node = nodesById.get(control.id)!;
    const parentNode = control.parentId ? nodesById.get(control.parentId) : undefined;
    if (parentNode) parentNode.children.push(node);
    else roots.push(node);
  });

  return roots;
}

/**
 * 设计画布使用同一个绝对定位层渲染所有控件，因此父容器必须先于其后代绘制。
 * 保留同一层级的原始顺序，避免修改用户已有的兄弟控件叠放关系。
 */
export function orderControlsForDesignerPainting(controls: LingControl[]): LingControl[] {
  const normalizedControls = normalizeControlHierarchy(controls);
  const pendingIds = new Set(normalizedControls.map(control => control.id));
  const ordered: LingControl[] = [];

  // 稳定拓扑排序：仅把仍未绘制父级的控件延后，其余控件沿用项目数组顺序。
  while (pendingIds.size > 0) {
    const next = normalizedControls.find(control => pendingIds.has(control.id)
      && (!control.parentId || !pendingIds.has(control.parentId)));
    if (!next) break; // normalizeControlHierarchy 已消除循环，此处只是防御性降级。
    pendingIds.delete(next.id);
    ordered.push(next);
  }

  return ordered.length === normalizedControls.length ? ordered : normalizedControls;
}

export function getControlDescendantIds(controls: LingControl[], controlId: string): Set<string> {
  const childrenByParent = new Map<string, string[]>();
  normalizeControlHierarchy(controls).forEach(control => {
    if (!control.parentId) return;
    const children = childrenByParent.get(control.parentId) || [];
    children.push(control.id);
    childrenByParent.set(control.parentId, children);
  });

  const descendants = new Set<string>();
  const pending = [...(childrenByParent.get(controlId) || [])];
  while (pending.length > 0) {
    const childId = pending.shift()!;
    if (descendants.has(childId)) continue;
    descendants.add(childId);
    pending.push(...(childrenByParent.get(childId) || []));
  }
  return descendants;
}

export function canReparentControl(
  controls: LingControl[],
  controlId: string,
  parentId?: string,
  containerSlot?: string
): boolean {
  const control = controls.find(item => item.id === controlId);
  if (!control) return false;

  const normalizedParentId = parentId?.trim() || undefined;
  const currentParentId = control.parentId?.trim() || undefined;
  const targetParent = normalizedParentId ? controls.find(item => item.id === normalizedParentId) : undefined;
  const normalizedSlot = targetParent?.type === 'TabControl' ? containerSlot?.trim() || undefined : undefined;
  const currentSlot = currentParentId && controls.find(item => item.id === currentParentId)?.type === 'TabControl'
    ? control.containerSlot?.trim() || undefined
    : undefined;
  if (currentParentId === normalizedParentId && currentSlot === normalizedSlot) return false;
  if (!normalizedParentId) return true;
  if (normalizedParentId === controlId) return false;
  if (!controls.some(item => item.id === normalizedParentId)) return false;

  return !getControlDescendantIds(controls, controlId).has(normalizedParentId);
}

export function reparentControl(
  controls: LingControl[],
  controlId: string,
  parentId?: string,
  containerSlot?: string
): LingControl[] {
  if (!canReparentControl(controls, controlId, parentId, containerSlot)) return controls;
  const normalizedParentId = parentId?.trim() || undefined;
  const targetParent = normalizedParentId ? controls.find(item => item.id === normalizedParentId) : undefined;
  const normalizedSlot = targetParent?.type === 'TabControl' ? containerSlot?.trim() || undefined : undefined;

  return controls.map(control => control.id === controlId
    ? { ...control, parentId: normalizedParentId, containerSlot: normalizedSlot }
    : control);
}

function getTopLevelSelectedControlIds(controls: LingControl[], controlIds: string[]): string[] {
  const selectedIds = new Set(controlIds.filter(id => controls.some(control => control.id === id)));
  const controlsById = new Map(controls.map(control => [control.id, control]));

  return controls
    .filter(control => selectedIds.has(control.id))
    .filter(control => {
      const visited = new Set<string>();
      let parentId = control.parentId;
      while (parentId && !visited.has(parentId)) {
        if (selectedIds.has(parentId)) return false;
        visited.add(parentId);
        parentId = controlsById.get(parentId)?.parentId;
      }
      return true;
    })
    .map(control => control.id);
}

function hasSameControlParent(
  controls: LingControl[],
  controlId: string,
  parentId?: string,
  containerSlot?: string
): boolean {
  const control = controls.find(item => item.id === controlId);
  if (!control) return false;
  const normalizedParentId = parentId?.trim() || undefined;
  const targetParent = normalizedParentId ? controls.find(item => item.id === normalizedParentId) : undefined;
  const normalizedSlot = targetParent?.type === 'TabControl' ? containerSlot?.trim() || undefined : undefined;
  const currentParentId = control.parentId?.trim() || undefined;
  const currentSlot = currentParentId && controls.find(item => item.id === currentParentId)?.type === 'TabControl'
    ? control.containerSlot?.trim() || undefined
    : undefined;
  return currentParentId === normalizedParentId && currentSlot === normalizedSlot;
}

export function canReparentControls(
  controls: LingControl[],
  controlIds: string[],
  parentId?: string,
  containerSlot?: string
): boolean {
  const topLevelIds = getTopLevelSelectedControlIds(controls, controlIds);
  if (topLevelIds.length === 0) return false;

  let hasChange = false;
  for (const controlId of topLevelIds) {
    if (hasSameControlParent(controls, controlId, parentId, containerSlot)) continue;
    if (!canReparentControl(controls, controlId, parentId, containerSlot)) return false;
    hasChange = true;
  }
  return hasChange;
}

/**
 * 批量移动只改变选区最外层控件的父级。若父控件和其后代同时被选中，
 * 后代继续挂在原父控件下，避免一次拖拽意外打散已有布局结构。
 */
export function reparentControls(
  controls: LingControl[],
  controlIds: string[],
  parentId?: string,
  containerSlot?: string
): LingControl[] {
  if (!canReparentControls(controls, controlIds, parentId, containerSlot)) return controls;
  const movableIds = new Set(getTopLevelSelectedControlIds(controls, controlIds));
  const normalizedParentId = parentId?.trim() || undefined;
  const targetParent = normalizedParentId ? controls.find(item => item.id === normalizedParentId) : undefined;
  const normalizedSlot = targetParent?.type === 'TabControl' ? containerSlot?.trim() || undefined : undefined;

  return controls.map(control => movableIds.has(control.id) && !hasSameControlParent(controls, control.id, parentId, containerSlot)
    ? { ...control, parentId: normalizedParentId, containerSlot: normalizedSlot }
    : control);
}

export function getEffectiveControlState(
  controls: LingControl[],
  controlId: string
): EffectiveControlState {
  const controlsById = new Map(controls.map(control => [control.id, control]));
  const visited = new Set<string>();
  let current = controlsById.get(controlId);
  let visible = true;
  let enabled = true;

  while (current) {
    if (visited.has(current.id)) return { visible: false, enabled: false };
    visited.add(current.id);
    visible = visible && current.visibility === 'Visible';
    enabled = enabled && current.isEnabled;
    current = current.parentId ? controlsById.get(current.parentId) : undefined;
  }

  return { visible, enabled };
}
