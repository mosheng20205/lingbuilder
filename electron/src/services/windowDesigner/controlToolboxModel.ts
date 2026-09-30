import { isNewEmojiDesignerControlSupported } from './newEmojiDesignerAdapter';
import type { LingControlType } from './types';
import { getWin32ControlDefinition } from './win32ControlRegistry';

export type ControlToolboxGroupId = 'basic' | 'advanced' | 'browser' | 'new-emoji';

export interface ControlToolboxGroupDefinition {
  id: ControlToolboxGroupId;
  label: string;
  description: string;
}

export interface ControlToolboxGroup extends ControlToolboxGroupDefinition {
  controlTypes: LingControlType[];
}

export type ControlToolboxExpansionState = Record<ControlToolboxGroupId, boolean>;

export const CONTROL_TOOLBOX_GROUP_DEFINITIONS: readonly ControlToolboxGroupDefinition[] = [
  { id: 'basic', label: '基础控件', description: '常用 Win32 输入、显示和布局控件' },
  { id: 'advanced', label: '高级控件', description: '系统通用控件和非可视行为组件' },
  { id: 'browser', label: '浏览器控件', description: 'Edge WebView2、CEF3 与 FBro 指纹浏览器控件' },
  { id: 'new-emoji', label: 'New_Emoji 控件', description: 'New_Emoji 原生设计后端支持的控件' }
] as const;

export const DEFAULT_CONTROL_TOOLBOX_EXPANSION: ControlToolboxExpansionState = {
  basic: true,
  advanced: false,
  browser: false,
  'new-emoji': false
};

const GROUP_BY_MODULE_ID: Record<string, ControlToolboxGroupId> = {
  'lingbuilder.win32.basic': 'basic',
  'lingbuilder.win32.common-controls': 'advanced',
  'lingbuilder.edgeview': 'browser',
  'lingbuilder.cef3.browser': 'browser',
  'lingbuilder.fbro.browser': 'browser',
  'lingbuilder.new_emoji.ui': 'new-emoji'
};

export function getControlToolboxModuleDisabledMessage(moduleId: string | undefined): string {
  const groupId = moduleId ? GROUP_BY_MODULE_ID[moduleId] : undefined;
  const group = CONTROL_TOOLBOX_GROUP_DEFINITIONS.find(item => item.id === groupId);
  return group ? `需要启用${group.label}模块` : '当前项目未启用此控件所需模块';
}

export function getControlToolboxGroupId(
  type: LingControlType,
  useNewEmojiDesigner: boolean
): ControlToolboxGroupId {
  const moduleId = getWin32ControlDefinition(type)?.moduleId;
  // FBro 在 new_emoji 窗口中使用受控 HWND 子宿主，但仍属于浏览器模块，
  // 不应混入 New_Emoji 目录贡献列表后被 92 个目录控件覆盖。
  if (moduleId === 'lingbuilder.fbro.browser') return 'browser';
  if (useNewEmojiDesigner && isNewEmojiDesignerControlSupported(type)) {
    return 'new-emoji';
  }
  return (moduleId && GROUP_BY_MODULE_ID[moduleId]) || 'basic';
}

export function createControlToolboxGroups(
  controlTypes: readonly LingControlType[],
  useNewEmojiDesigner: boolean
): ControlToolboxGroup[] {
  const controlsByGroup = new Map<ControlToolboxGroupId, LingControlType[]>(
    CONTROL_TOOLBOX_GROUP_DEFINITIONS.map(group => [group.id, []])
  );

  controlTypes.forEach(type => {
    controlsByGroup.get(getControlToolboxGroupId(type, useNewEmojiDesigner))?.push(type);
  });

  return CONTROL_TOOLBOX_GROUP_DEFINITIONS.map(group => ({
    ...group,
    controlTypes: controlsByGroup.get(group.id) || []
  }));
}

function getControlToolboxStorageKey(projectId: string): string {
  return `lingbuilder.control-toolbox.expansion.v1:${projectId}`;
}

export function readControlToolboxExpansionState(
  projectId: string,
  storage: Pick<Storage, 'getItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage
): ControlToolboxExpansionState {
  if (!storage) return { ...DEFAULT_CONTROL_TOOLBOX_EXPANSION };
  try {
    const raw = storage.getItem(getControlToolboxStorageKey(projectId));
    if (!raw) return { ...DEFAULT_CONTROL_TOOLBOX_EXPANSION };
    const parsed = JSON.parse(raw) as Partial<Record<ControlToolboxGroupId, unknown>>;
    return Object.fromEntries(
      CONTROL_TOOLBOX_GROUP_DEFINITIONS.map(group => [
        group.id,
        typeof parsed[group.id] === 'boolean'
          ? parsed[group.id]
          : DEFAULT_CONTROL_TOOLBOX_EXPANSION[group.id]
      ])
    ) as ControlToolboxExpansionState;
  } catch {
    return { ...DEFAULT_CONTROL_TOOLBOX_EXPANSION };
  }
}

export function saveControlToolboxExpansionState(
  projectId: string,
  state: ControlToolboxExpansionState,
  storage: Pick<Storage, 'setItem'> | undefined = typeof window === 'undefined' ? undefined : window.localStorage
): void {
  if (!storage) return;
  try {
    storage.setItem(getControlToolboxStorageKey(projectId), JSON.stringify(state));
  } catch {
    // 工具箱偏好写入失败不应影响窗口设计器本身。
  }
}

/** 模块贡献控件（contributes.designerControls）的归属模块 ID：namespacedType 前缀，缺省回落 new_emoji。 */
export function getModuleControlOwningModuleId(control: { namespacedType?: string; type?: string }): string {
  const prefix = control.namespacedType?.split('/')[0];
  if (prefix) return prefix;
  // 工具箱当前只把 new_emoji 模块的 designerControls 渲染进「New_Emoji 控件」分组。
  return 'lingbuilder.new_emoji.ui';
}

/** 门禁与工具箱提示里给人看的模块名。 */
export function getDesignerModuleDisplayName(moduleId: string): string {
  if (moduleId === 'lingbuilder.win32.basic') return 'Win32基础控件模块';
  if (moduleId === 'lingbuilder.win32.common-controls') return 'Win32高级控件模块';
  if (moduleId === 'lingbuilder.new_emoji.ui') return 'New_Emoji 模块';
  return moduleId;
}

export interface DesignerControlAddGateInput {
  /** 工具箱点击传入的类型：模块控件是 previewType（画布预览替身），普通控件即控件类型。 */
  type: LingControlType;
  /** 模块贡献控件；普通 Win32 控件不传。 */
  moduleControl?: { namespacedType?: string; label?: string } | null;
  /** 当前项目已启用模块集合（/api/modules/project/designer）。 */
  enabledDesignerModules: ReadonlySet<string>;
}

// electron 根 tsconfig 未开 strictNullChecks：布尔字面量判别联合不会收窄，
// 结果类型一律用单一接口（allowed + 必带 reason），与仓内约定一致。
export interface DesignerControlAddGateResult {
  allowed: boolean;
  /** 拦截时的中文原因；allowed=true 时为空串。 */
  reason: string;
}

/**
 * 「点击控件添加到画布」的模块门禁唯一实现。
 *
 * 模块贡献控件的真实依赖是提供它的模块（如 new_emoji 表格只依赖 lingbuilder.new_emoji.ui）；
 * previewType 仅用于画布预览，其 Win32 归属模块（列表视图/选项卡/树形视图 → 高级控件模块）
 * 不得参与拦截，否则「只启用 new_emoji 的项目」点表格/富列表/标签页/描述列表/树会静默无效
 * （2026-09-25 实机定位）。普通 Win32 控件仍按其归属模块拦截。
 */
export function resolveDesignerControlAddGate(input: DesignerControlAddGateInput): DesignerControlAddGateResult {
  const { type, moduleControl, enabledDesignerModules } = input;
  if (moduleControl) {
    const owningModuleId = getModuleControlOwningModuleId(moduleControl);
    if (!enabledDesignerModules.has(owningModuleId)) {
      const label = moduleControl.label || type;
      return {
        allowed: false,
        reason: `${label} 需要先在当前项目中启用 ${getDesignerModuleDisplayName(owningModuleId)}；请在解决方案树「模块 → 配置项目所使用模块」勾选后再添加。`
      };
    }
    return { allowed: true, reason: '' };
  }
  const definition = getWin32ControlDefinition(type);
  if (definition && !enabledDesignerModules.has(definition.moduleId)) {
    return {
      allowed: false,
      reason: `${definition.label} 需要先启用 ${getDesignerModuleDisplayName(definition.moduleId)}。`
    };
  }
  return { allowed: true, reason: '' };
}
