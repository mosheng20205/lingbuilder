import { getControlDescendantIds } from './controlHierarchy';
import type { LingControl, LingWindowModel, LingWindowProject } from './types';

type RebarBand = Record<string, unknown>;

export type RebarBandCreationResult = {
  band?: RebarBand;
  message: string;
};

export function createNextRebarBand(
  configuredBands: unknown,
  directChildren: LingControl[]
): RebarBandCreationResult {
  const bands = Array.isArray(configuredBands)
    ? configuredBands.filter((band): band is RebarBand => Boolean(band) && typeof band === 'object')
    : [];
  const boundIds = new Set(bands.map(band => String(band.childControl ?? '')).filter(Boolean));
  const child = directChildren.find(control => !boundIds.has(control.id));
  if (!child) {
    return {
      message: directChildren.length === 0
        ? '请先选中 Rebar，再从工具箱添加工具栏或其他控件；它会自动成为 Rebar 的直接子控件和带区。'
        : '当前 Rebar 的直接子控件都已经绑定到带区。'
    };
  }
  return {
    band: {
      id: `band-${child.id}`,
      title: child.name,
      childControl: child.id,
      width: Math.max(40, Math.round(child.width)),
      minWidth: 40,
      height: Math.max(24, Math.round(child.height)),
      breakLine: false,
      resizable: true
    },
    message: `已把“${child.name}”绑定为新带区。`
  };
}

/**
 * Keeps Rebar band bindings aligned with its direct children. Existing band
 * settings and order are preserved; newly parented children receive a usable
 * band automatically unless the Rebar explicitly disables automatic binding.
 */
export function reconcileRebarBands(controls: LingControl[]): LingControl[] {
  const controlsById = new Map(controls.map(control => [control.id, control]));
  let changed = false;
  const next = controls.map(control => {
    if (control.type !== 'ReBar') return control;
    const directChildren = controls.filter(child => child.parentId === control.id);
    const directChildIds = new Set(directChildren.map(child => child.id));
    const configured = Array.isArray(control.properties?.bands)
      ? control.properties.bands.filter((band): band is RebarBand => Boolean(band) && typeof band === 'object')
      : [];
    const valid = configured.filter(band => {
      const childId = String(band.childControl ?? '');
      return childId.length > 0 && directChildIds.has(childId) && controlsById.has(childId);
    });
    const bound = new Set(valid.map(band => String(band.childControl)));
    const bands = control.properties?.autoBindChildren === false
      ? valid
      : [
          ...valid,
          ...directChildren.filter(child => !bound.has(child.id)).map(child => createNextRebarBand(valid, [child]).band!)
        ];
    if (JSON.stringify(bands) === JSON.stringify(configured)) return control;
    changed = true;
    return { ...control, properties: { ...(control.properties || {}), bands } };
  });
  return changed ? next : controls;
}

export type DesignerLayoutOperation = 'align-left' | 'align-right' | 'align-top' | 'align-bottom' | 'align-hcenter' | 'align-vcenter' | 'distribute-horizontal' | 'distribute-vertical' | 'same-width' | 'same-height';

function applyControlChangesWithDescendants(
  controls: LingControl[],
  changes: Map<string, Partial<LingControl>>
): LingControl[] {
  const controlsById = new Map(controls.map(control => [control.id, control]));

  const inheritedDelta = (control: LingControl, axis: 'x' | 'y'): number => {
    const visited = new Set<string>([control.id]);
    let parentId = control.parentId;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);
      const parent = controlsById.get(parentId);
      if (!parent) return 0;
      const parentChange = changes.get(parent.id);
      const nextCoordinate = parentChange?.[axis];
      if (typeof nextCoordinate === 'number' && Number.isFinite(nextCoordinate)) {
        return nextCoordinate - parent[axis];
      }
      parentId = parent.parentId;
    }
    return 0;
  };

  return controls.map(control => {
    const change = changes.get(control.id);
    const nextX = typeof change?.x === 'number' ? change.x : control.x + inheritedDelta(control, 'x');
    const nextY = typeof change?.y === 'number' ? change.y : control.y + inheritedDelta(control, 'y');
    if (!change && nextX === control.x && nextY === control.y) return control;
    return { ...control, ...change, x: nextX, y: nextY };
  });
}

export function updateControlWithDescendants(
  controls: LingControl[],
  controlId: string,
  fields: Partial<LingControl>
): LingControl[] {
  if (!controls.some(control => control.id === controlId)) return controls;
  return applyControlChangesWithDescendants(controls, new Map([[controlId, fields]]));
}

export function applyDesignerLayout(
  window: LingWindowModel,
  selectedIds: string[],
  operation: DesignerLayoutOperation
): LingWindowModel {
  const ids = new Set(selectedIds);
  const selected = window.controls.filter(control => ids.has(control.id));
  if (selected.length < 2) throw new Error('至少选择两个控件才能执行布局操作。');
  const anchor = selected[0];
  const changes = new Map<string, Partial<LingControl>>();

  if (operation.startsWith('align-') || operation.startsWith('same-')) {
    for (const control of selected) {
      if (operation === 'align-left') changes.set(control.id, { x: anchor.x });
      else if (operation === 'align-right') changes.set(control.id, { x: anchor.x + anchor.width - control.width });
      else if (operation === 'align-top') changes.set(control.id, { y: anchor.y });
      else if (operation === 'align-bottom') changes.set(control.id, { y: anchor.y + anchor.height - control.height });
      else if (operation === 'align-hcenter') changes.set(control.id, { x: Math.round(anchor.x + anchor.width / 2 - control.width / 2) });
      else if (operation === 'align-vcenter') changes.set(control.id, { y: Math.round(anchor.y + anchor.height / 2 - control.height / 2) });
      else if (operation === 'same-width') changes.set(control.id, { width: anchor.width });
      else if (operation === 'same-height') changes.set(control.id, { height: anchor.height });
    }
  } else {
    if (selected.length < 3) throw new Error('均匀分布至少需要三个控件。');
    const horizontal = operation === 'distribute-horizontal';
    const sorted = [...selected].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    const first = sorted[0];
    const last = sorted.at(-1)!;
    const occupied = sorted.reduce((sum, item) => sum + (horizontal ? item.width : item.height), 0);
    const span = horizontal ? last.x + last.width - first.x : last.y + last.height - first.y;
    const gap = (span - occupied) / (sorted.length - 1);
    let cursor = horizontal ? first.x : first.y;
    for (const control of sorted) {
      changes.set(control.id, horizontal ? { x: Math.round(cursor) } : { y: Math.round(cursor) });
      cursor += (horizontal ? control.width : control.height) + gap;
    }
  }

  return { ...window, controls: applyControlChangesWithDescendants(window.controls, changes) };
}

export function nudgeControls(
  window: LingWindowModel,
  selectedIds: string[],
  dx: number,
  dy: number
): LingWindowModel {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 1000 || Math.abs(dy) > 1000) {
    throw new Error('批量移动距离无效。');
  }

  const selected = new Set(selectedIds);
  const affected = new Set(selectedIds);
  for (const controlId of selectedIds) {
    for (const descendantId of getControlDescendantIds(window.controls, controlId)) affected.add(descendantId);
  }
  const affectedControls = window.controls.filter(control => affected.has(control.id));
  if (affectedControls.length === 0) return window;

  const minX = Math.min(...affectedControls.map(control => control.x));
  const minY = Math.min(...affectedControls.map(control => control.y));
  const maxRight = Math.max(...affectedControls.map(control => control.x + control.width));
  const maxBottom = Math.max(...affectedControls.map(control => control.y + control.height));
  const effectiveDx = Math.max(-minX, Math.min(window.width - maxRight, dx));
  const effectiveDy = Math.max(-minY, Math.min(window.height - 28 - maxBottom, dy));
  const changes = new Map<string, Partial<LingControl>>();
  for (const control of window.controls) {
    if (selected.has(control.id)) changes.set(control.id, { x: control.x + effectiveDx, y: control.y + effectiveDy });
  }

  return { ...window, controls: applyControlChangesWithDescendants(window.controls, changes) };
}

export class DesignerHistory {
  private past: LingWindowProject[] = [];
  private future: LingWindowProject[] = [];

  constructor(private current: LingWindowProject, private readonly limit = 100) {
    this.current = structuredClone(current);
  }

  get value() { return structuredClone(this.current); }

  commit(next: LingWindowProject) {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return this.value;
    this.past.push(this.current);
    if (this.past.length > this.limit) this.past.shift();
    this.current = structuredClone(next);
    this.future = [];
    return this.value;
  }

  undo() {
    const previous = this.past.pop();
    if (!previous) return null;
    this.future.push(this.current);
    this.current = previous;
    return this.value;
  }

  redo() {
    const next = this.future.pop();
    if (!next) return null;
    this.past.push(this.current);
    this.current = next;
    return this.value;
  }

  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
}
