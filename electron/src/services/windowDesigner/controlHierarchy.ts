import { LingControl } from './types';

export interface LingControlHierarchyNode {
  control: LingControl;
  children: LingControlHierarchyNode[];
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
