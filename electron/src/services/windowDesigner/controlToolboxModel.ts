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

export function getControlToolboxGroupId(
  type: LingControlType,
  useNewEmojiDesigner: boolean
): ControlToolboxGroupId {
  if (useNewEmojiDesigner && isNewEmojiDesignerControlSupported(type)) {
    return 'new-emoji';
  }
  const moduleId = getWin32ControlDefinition(type)?.moduleId;
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
