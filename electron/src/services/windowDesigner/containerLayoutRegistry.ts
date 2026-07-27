import { getTabControlPages, isTabControlHeaderHidden } from './tabControlModel';
import { reconcileRebarBands } from './designerOperations';
import type { LingControl, LingWindowModel } from './types';

export type DesignerLayoutMode = 'absolute' | 'flow' | 'stack' | 'grid' | 'dock' | 'slots' | 'single' | 'custom';
export type DesignerCoordinateSpace = 'window' | 'parent';

export interface DesignerContainerLayoutDescriptor {
  mode: DesignerLayoutMode;
  coordinateSpace?: DesignerCoordinateSpace;
  orientation?: 'horizontal' | 'vertical';
  slots?: readonly string[];
  capacity?: number;
  acceptedDesignerTypes?: readonly string[];
  adapterId?: string;
}

export interface DesignerCapturedPlacement {
  mode: DesignerLayoutMode;
  coordinateSpace: DesignerCoordinateSpace;
  parentId?: string;
  containerSlot?: string;
  siblingIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  data?: Record<string, unknown>;
}

export interface DesignerLayoutTransferItem {
  sourceId: string;
  control: LingControl;
  placement: DesignerCapturedPlacement;
}

export interface DesignerPasteTarget {
  parentId?: string;
  containerSlot?: string;
  anchorX?: number;
  anchorY?: number;
  insertIndex?: number;
}

export interface DesignerPlannedPlacement {
  sourceId: string;
  parentId?: string;
  containerSlot?: string;
  x: number;
  y: number;
  designerLayout?: LingControl['designerLayout'];
}

export interface DesignerPastePlacementPlan {
  adapterId: string;
  mode: DesignerLayoutMode;
  placements: DesignerPlannedPlacement[];
  warnings: string[];
  errors: string[];
}

export interface DesignerContainerLayoutAdapter {
  readonly id: string;
  readonly descriptor: DesignerContainerLayoutDescriptor;
  canAccept(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): boolean;
  listSlots(window: LingWindowModel, target: DesignerPasteTarget): readonly string[];
  capturePlacement(window: LingWindowModel, control: LingControl): DesignerCapturedPlacement;
  planPaste(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): DesignerPastePlacementPlan;
  validatePlan(window: LingWindowModel, target: DesignerPasteTarget, plan: DesignerPastePlacementPlan): readonly string[];
  normalizeChildren(window: LingWindowModel): LingWindowModel;
  describeConflict(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): string;
}

type AdapterFactory = (descriptor: DesignerContainerLayoutDescriptor) => DesignerContainerLayoutAdapter;

export class DesignerContainerLayoutRegistry {
  private readonly descriptors = new Map<string, DesignerContainerLayoutDescriptor>();
  private readonly factories = new Map<DesignerLayoutMode, AdapterFactory>();

  constructor() {
    const genericFactory: AdapterFactory = descriptor => new StandardLayoutAdapter(descriptor);
    (['absolute', 'flow', 'stack', 'grid', 'dock', 'slots', 'single'] as DesignerLayoutMode[])
      .forEach(mode => this.factories.set(mode, genericFactory));
    this.registerContainer('__window__', { mode: 'absolute', coordinateSpace: 'window', adapterId: 'win32.window.absolute' });
    this.registerContainer('GroupBox', { mode: 'absolute', coordinateSpace: 'window', adapterId: 'win32.groupbox.absolute' });
    this.registerContainer('Grid', { mode: 'absolute', coordinateSpace: 'window', adapterId: 'win32.grid.absolute' });
    this.registerContainer('Pager', { mode: 'absolute', coordinateSpace: 'window', adapterId: 'win32.pager.absolute' });
    this.registerContainer('TabControl', { mode: 'slots', coordinateSpace: 'window', adapterId: 'win32.tab.slots' });
    this.registerContainer('ReBar', { mode: 'slots', coordinateSpace: 'window', adapterId: 'win32.rebar.bands' });
  }

  registerMode(mode: DesignerLayoutMode, factory: AdapterFactory): { dispose(): void } {
    if (mode !== 'custom' && this.factories.has(mode)) throw new Error(`布局模式“${mode}”已注册。`);
    this.factories.set(mode, factory);
    return { dispose: () => { if (this.factories.get(mode) === factory) this.factories.delete(mode); } };
  }

  registerContainer(controlType: string, descriptor: DesignerContainerLayoutDescriptor): { dispose(): void } {
    const key = controlType.trim();
    if (!key) throw new Error('容器控件类型不能为空。');
    validateDescriptor(descriptor);
    const copy = structuredClone(descriptor);
    this.descriptors.set(key, copy);
    return { dispose: () => { if (this.descriptors.get(key) === copy) this.descriptors.delete(key); } };
  }

  resolve(window: LingWindowModel, parentId?: string): DesignerContainerLayoutAdapter {
    const parent = parentId ? window.controls.find(control => control.id === parentId) : undefined;
    const key = parent?.designerType || parent?.type || '__window__';
    const descriptor = this.descriptors.get(key)
      || (parent?.type ? this.descriptors.get(parent.type) : undefined)
      || { mode: 'absolute' as const, coordinateSpace: 'window' as const, adapterId: `legacy.${key}.absolute` };
    const factory = this.factories.get(descriptor.mode);
    if (!factory) throw new Error(`容器“${key}”声明了未注册布局模式“${descriptor.mode}”。`);
    return factory(descriptor);
  }

  capturePlacement(window: LingWindowModel, control: LingControl): DesignerCapturedPlacement {
    return this.resolve(window, control.parentId).capturePlacement(window, control);
  }

  planPaste(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): DesignerPastePlacementPlan {
    const adapter = this.resolve(window, target.parentId);
    if (!adapter.canAccept(window, target, items)) {
      return { adapterId: adapter.id, mode: adapter.descriptor.mode, placements: [], warnings: [], errors: [adapter.describeConflict(window, target, items)] };
    }
    const plan = adapter.planPaste(window, target, items);
    plan.errors.push(...adapter.validatePlan(window, target, plan));
    return plan;
  }

  normalizeChildren(window: LingWindowModel, parentId?: string): LingWindowModel {
    return this.resolve(window, parentId).normalizeChildren(window);
  }
}

class StandardLayoutAdapter implements DesignerContainerLayoutAdapter {
  readonly id: string;

  constructor(readonly descriptor: DesignerContainerLayoutDescriptor) {
    this.id = descriptor.adapterId || `standard.${descriptor.mode}`;
  }

  canAccept(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): boolean {
    if (!items.length) return false;
    const accepted = this.descriptor.acceptedDesignerTypes;
    if (accepted?.length && items.some(item => !accepted.includes(item.control.designerType || item.control.type))) return false;
    const capacity = this.descriptor.mode === 'single' ? 1 : this.descriptor.capacity;
    if (capacity === undefined) return true;
    const occupied = window.controls.filter(control => (control.parentId || undefined) === (target.parentId || undefined)).length;
    return occupied + items.length <= capacity;
  }

  listSlots(window: LingWindowModel, target: DesignerPasteTarget): readonly string[] {
    if (this.descriptor.slots?.length) return [...this.descriptor.slots];
    const parent = target.parentId ? window.controls.find(control => control.id === target.parentId) : undefined;
    if (parent?.type === 'TabControl') return getTabControlPages(parent).map(page => page.id);
    if (parent?.type === 'ReBar') {
      const bands = Array.isArray(parent.properties?.bands) ? parent.properties.bands : [];
      return bands.map((band, index) => String((band as Record<string, unknown>)?.id || `band-${index + 1}`));
    }
    return [];
  }

  capturePlacement(window: LingWindowModel, control: LingControl): DesignerCapturedPlacement {
    const siblings = window.controls.filter(item => item.parentId === control.parentId && item.containerSlot === control.containerSlot);
    return {
      mode: this.descriptor.mode,
      coordinateSpace: this.descriptor.coordinateSpace || 'window',
      parentId: control.parentId,
      containerSlot: control.containerSlot,
      siblingIndex: Math.max(0, siblings.findIndex(item => item.id === control.id)),
      x: control.x,
      y: control.y,
      width: control.width,
      height: control.height,
      data: control.designerLayout?.data ? structuredClone(control.designerLayout.data) : undefined
    };
  }

  planPaste(window: LingWindowModel, target: DesignerPasteTarget, items: readonly DesignerLayoutTransferItem[]): DesignerPastePlacementPlan {
    const warnings: string[] = [];
    const errors: string[] = [];
    const sourceModes = [...new Set(items.map(item => item.placement.mode))];
    if (sourceModes.some(mode => mode !== this.descriptor.mode)) {
      warnings.push(`布局将从“${sourceModes.join(' / ')}”转换为“${this.descriptor.mode}”，请确认目标容器中的排列效果。`);
    }
    const parent = target.parentId ? window.controls.find(control => control.id === target.parentId) : undefined;
    const slots = this.listSlots(window, target);
    let slot = target.containerSlot;
    if (this.descriptor.mode === 'slots') {
      if (!slot || (slots.length && !slots.includes(slot))) {
        if (parent?.type === 'TabControl') {
          const selectedIndex = Number(parent.properties?.selectedIndex || 0);
          slot = getTabControlPages(parent)[selectedIndex]?.id || slots[0];
        } else slot = slots[0];
        if (slot) warnings.push(`来源插槽在目标容器中不存在，已放入“${slot}”。`);
      }
      if (!slot && parent?.type === 'TabControl') errors.push('目标选项卡没有可用标签页。');
    }

    const minX = Math.min(...items.map(item => item.placement.x));
    const minY = Math.min(...items.map(item => item.placement.y));
    const defaultAnchorX = parent ? parent.x + 12 : minX + 10;
    const parentTopInset = parent?.type === 'TabControl' && !isTabControlHeaderHidden(parent) ? 36 : 12;
    const defaultAnchorY = parent ? parent.y + parentTopInset : minY + 10;
    const anchorX = target.anchorX ?? defaultAnchorX;
    const anchorY = target.anchorY ?? defaultAnchorY;
    const ordered = [...items].sort((left, right) => left.placement.siblingIndex - right.placement.siblingIndex);

    const placements = ordered.map((item, index): DesignerPlannedPlacement => {
      let x = anchorX + item.placement.x - minX;
      let y = anchorY + item.placement.y - minY;
      let data = item.placement.data ? structuredClone(item.placement.data) : undefined;
      if (this.descriptor.mode === 'flow' || this.descriptor.mode === 'stack') {
        const horizontal = this.descriptor.orientation === 'horizontal';
        x = anchorX + (horizontal ? index * (item.control.width + 8) : 0);
        y = anchorY + (horizontal ? 0 : index * (item.control.height + 8));
        data = { ...(data || {}), order: (target.insertIndex ?? window.controls.length) + index };
      } else if (this.descriptor.mode === 'grid') {
        const columns = Math.max(1, Number(data?.columns || 12));
        const start = Math.max(0, target.insertIndex ?? window.controls.filter(control => control.parentId === target.parentId).length);
        data = { ...(data || {}), row: Math.floor((start + index) / columns), column: (start + index) % columns };
      } else if (this.descriptor.mode === 'dock') {
        data = { ...(data || {}), dock: data?.dock || 'top', order: (target.insertIndex ?? 0) + index };
      }
      return {
        sourceId: item.sourceId,
        parentId: target.parentId,
        containerSlot: this.descriptor.mode === 'slots' ? slot : undefined,
        x: Math.round(x),
        y: Math.round(y),
        designerLayout: this.descriptor.mode === 'absolute' || this.descriptor.mode === 'slots'
          ? undefined
          : { kind: this.descriptor.mode, data }
      };
    });
    return { adapterId: this.id, mode: this.descriptor.mode, placements, warnings, errors };
  }

  validatePlan(window: LingWindowModel, target: DesignerPasteTarget, plan: DesignerPastePlacementPlan): readonly string[] {
    const errors: string[] = [];
    const parent = target.parentId ? window.controls.find(control => control.id === target.parentId) : undefined;
    if (target.parentId && !parent) errors.push('目标父容器不存在。');
    if (plan.placements.some(item => !Number.isFinite(item.x) || !Number.isFinite(item.y))) errors.push('粘贴计划包含无效坐标。');
    if (this.descriptor.mode === 'slots') {
      const slots = this.listSlots(window, target);
      if (slots.length && plan.placements.some(item => !item.containerSlot || !slots.includes(item.containerSlot))) errors.push('粘贴计划包含无效容器插槽。');
    }
    return errors;
  }

  normalizeChildren(window: LingWindowModel): LingWindowModel {
    return this.id === 'win32.rebar.bands' ? { ...window, controls: reconcileRebarBands(window.controls) } : window;
  }

  describeConflict(_window: LingWindowModel, _target: DesignerPasteTarget, _items: readonly DesignerLayoutTransferItem[]): string {
    if (this.descriptor.mode === 'single') return '目标容器只能容纳一个直接子控件，当前已无可用位置。';
    return '目标容器不接受当前控件组合。';
  }
}

function validateDescriptor(descriptor: DesignerContainerLayoutDescriptor): void {
  if (!descriptor || !['absolute', 'flow', 'stack', 'grid', 'dock', 'slots', 'single', 'custom'].includes(descriptor.mode)) {
    throw new Error('容器布局 mode 无效。');
  }
  if (descriptor.capacity !== undefined && (!Number.isInteger(descriptor.capacity) || descriptor.capacity < 1)) {
    throw new Error('容器布局 capacity 必须是正整数。');
  }
}

export function createDesignerContainerLayoutRegistry(): DesignerContainerLayoutRegistry {
  return new DesignerContainerLayoutRegistry();
}
