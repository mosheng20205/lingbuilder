import { canReparentControls, getControlDescendantIds, reparentControls } from './controlHierarchy';
import type { DesignerContainerLayoutRegistry, DesignerPasteTarget } from './containerLayoutRegistry';
import { reconcileRebarBands, reorderDesignerControls, updateControlWithDescendants } from './designerOperations';
import type { LingControl, LingWindowProject } from './types';

export type DesignerEditOperation =
  | { type: 'update'; controlId: string; fields: Partial<Pick<LingControl, 'name' | 'content' | 'background' | 'foreground' | 'fontSize' | 'fontFamily' | 'fontBold' | 'fontItalic' | 'fontUnderline' | 'isEnabled' | 'visibility' | 'properties' | 'events'>> }
  | { type: 'move'; controlId: string; x: number; y: number }
  | { type: 'resize'; controlId: string; width: number; height: number }
  | { type: 'insert'; control: LingControl; target?: DesignerPasteTarget }
  | { type: 'delete'; controlIds: string[] }
  | { type: 'reparent'; controlIds: string[]; target: DesignerPasteTarget }
  | { type: 'reorder'; controlIds: string[]; operation: 'front' | 'forward' | 'backward' | 'back' }
  | { type: 'lock'; controlIds: string[]; locked: boolean };

export interface DesignerEditEnvelope {
  kind: 'lingbuilder.designer.edit';
  baseRevision: string;
  operations: DesignerEditOperation[];
}

export interface DesignerCommandInvocation {
  projectId: string;
  windowId: string;
  revision: string;
  targetKind: unknown;
  selectedControls: Array<Pick<LingControl, 'id' | 'name' | 'type' | 'designerType' | 'parentId' | 'containerSlot' | 'x' | 'y' | 'width' | 'height' | 'designerLocked'>>;
}

export function getDesignerModelRevision(project: LingWindowProject): string {
  const source = JSON.stringify(project);
  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `v1-${source.length.toString(36)}-${(hash >>> 0).toString(36)}`;
}

export function isDesignerEditEnvelope(value: unknown): value is DesignerEditEnvelope {
  return Boolean(value && typeof value === 'object' && (value as DesignerEditEnvelope).kind === 'lingbuilder.designer.edit');
}

export function applyDesignerEditEnvelope(
  project: LingWindowProject,
  windowId: string,
  envelope: DesignerEditEnvelope,
  layouts: DesignerContainerLayoutRegistry,
  supportsControl: (control: LingControl) => boolean
): LingWindowProject {
  if (envelope.baseRevision !== getDesignerModelRevision(project)) throw new Error('插件编辑基于过期的设计器模型，请刷新后重试。');
  if (!Array.isArray(envelope.operations) || envelope.operations.length < 1 || envelope.operations.length > 100) throw new Error('插件编辑操作数量必须介于 1 到 100。');
  let serialized = '';
  try { serialized = JSON.stringify(envelope); } catch { throw new Error('插件编辑不是可序列化数据。'); }
  if (new TextEncoder().encode(serialized).byteLength > 256 * 1024) throw new Error('插件编辑超过 256KB 限制。');
  const sourceWindow = project.windows.find(window => window.id === windowId);
  if (!sourceWindow) throw new Error('插件编辑的目标窗口不存在。');
  let window = structuredClone(sourceWindow);

  const requireControl = (controlId: string) => {
    const control = window.controls.find(item => item.id === controlId);
    if (!control) throw new Error(`插件引用了不存在的控件“${controlId}”。`);
    return control;
  };
  const requireUnlocked = (control: LingControl) => {
    if (control.designerLocked) throw new Error(`控件“${control.name}”已锁定。`);
  };

  for (const operation of envelope.operations) {
    if (!operation || typeof operation !== 'object' || typeof operation.type !== 'string') throw new Error('插件包含无效设计器操作。');
    if (operation.type === 'update') {
      requireControl(operation.controlId);
      const allowed = new Set(['name', 'content', 'background', 'foreground', 'fontSize', 'fontFamily', 'fontBold', 'fontItalic', 'fontUnderline', 'isEnabled', 'visibility', 'properties', 'events']);
      if (Object.keys(operation.fields || {}).some(key => !allowed.has(key))) throw new Error('插件 update 包含不允许字段。');
      window.controls = updateControlWithDescendants(window.controls, operation.controlId, structuredClone(operation.fields));
    } else if (operation.type === 'move') {
      const control = requireControl(operation.controlId); requireUnlocked(control);
      requireFiniteGeometry(operation.x, operation.y);
      window.controls = updateControlWithDescendants(window.controls, control.id, { x: Math.round(operation.x), y: Math.round(operation.y) });
    } else if (operation.type === 'resize') {
      const control = requireControl(operation.controlId); requireUnlocked(control);
      requireFiniteGeometry(operation.width, operation.height);
      if (operation.width < 1 || operation.height < 1) throw new Error('插件设置的控件尺寸必须大于 0。');
      window.controls = updateControlWithDescendants(window.controls, control.id, { width: Math.round(operation.width), height: Math.round(operation.height) });
    } else if (operation.type === 'insert') {
      const control = structuredClone(operation.control);
      if (!control || typeof control.id !== 'string' || window.controls.some(item => item.id === control.id)) throw new Error('插件 insert 的控件 ID 无效或重复。');
      if (!supportsControl(control)) throw new Error(`插件尝试插入未启用的控件类型“${control.designerType || control.type}”。`);
      requireFiniteGeometry(control.x, control.y, control.width, control.height);
      const placement = layouts.capturePlacement({ ...window, controls: [...window.controls, control] }, control);
      const plan = layouts.planPaste(window, operation.target || { parentId: control.parentId, containerSlot: control.containerSlot }, [{ sourceId: control.id, control, placement }]);
      if (plan.errors.length) throw new Error(plan.errors.join('；'));
      const target = plan.placements[0];
      window.controls.push({ ...control, ...target, sourceId: undefined } as LingControl);
      window = layouts.normalizeChildren(window, target.parentId);
    } else if (operation.type === 'delete') {
      const deleting = new Set<string>();
      operation.controlIds.forEach(id => {
        const control = requireControl(id); requireUnlocked(control); deleting.add(id);
        getControlDescendantIds(window.controls, id).forEach(descendant => deleting.add(descendant));
      });
      window.controls = reconcileRebarBands(window.controls.filter(control => !deleting.has(control.id)));
    } else if (operation.type === 'reparent') {
      const controls = operation.controlIds.map(requireControl); controls.forEach(requireUnlocked);
      if (!canReparentControls(window.controls, operation.controlIds, operation.target.parentId, operation.target.containerSlot)) throw new Error('插件重挂载会产生无效或循环父子关系。');
      const transfer = controls.map(control => ({ sourceId: control.id, control, placement: layouts.capturePlacement(window, control) }));
      const plan = layouts.planPaste(window, operation.target, transfer);
      if (plan.errors.length) throw new Error(plan.errors.join('；'));
      window.controls = reparentControls(window.controls, operation.controlIds, operation.target.parentId, operation.target.containerSlot);
      plan.placements.forEach(placement => { window.controls = updateControlWithDescendants(window.controls, placement.sourceId, placement); });
      window = layouts.normalizeChildren(window, operation.target.parentId);
    } else if (operation.type === 'reorder') {
      operation.controlIds.map(requireControl).forEach(requireUnlocked);
      window = reorderDesignerControls(window, operation.controlIds, operation.operation);
    } else if (operation.type === 'lock') {
      const ids = new Set(operation.controlIds.map(id => requireControl(id).id));
      window.controls = window.controls.map(control => ids.has(control.id) ? { ...control, designerLocked: operation.locked || undefined } : control);
    } else {
      throw new Error(`插件设计器操作“${(operation as { type: string }).type}”不受支持。`);
    }
  }

  return { ...project, windows: project.windows.map(item => item.id === windowId ? window : item) };
}

function requireFiniteGeometry(...values: number[]): void {
  if (values.some(value => typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > 1_000_000)) throw new Error('插件编辑包含无效几何数值。');
}
