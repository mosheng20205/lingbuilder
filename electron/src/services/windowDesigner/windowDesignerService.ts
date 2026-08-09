import {
  LingControl,
  LingControlType,
  LingDesignerEventInfo,
  LingWindowFrame,
  LingWindowModel,
  LingWindowProject
} from './types';
import { normalizeControlHierarchy } from './controlHierarchy';
import { DEFAULT_CONTROL_FONT_FAMILY, normalizeControlFont } from './controlFont';
import { normalizeWindowControlTags } from './controlTagService';
import {
  createDefaultControlProperties,
  getPrimaryWin32ControlEvent,
  getWin32ControlDefinition
} from './win32ControlRegistry';
import type { Win32ControlPropertyValue } from './win32ControlRegistry';
import { getWindowEventDefinition } from './windowEventRegistry';
import type { ModuleDesignerControlContribution } from '../modules/types';
import { normalizeFbroEventId } from '../modules/fbroEventCatalog';
import {
  dataGridModelToPropertyValues,
  migrateLegacyNewEmojiTableProperties,
  normalizeDataGridModel
} from './dataGridModel';

export const WINDOW_DESIGNER_AUTOSAVE_KEY = 'lingbuilder.windowDesigner.autosave.v1';
const NEW_EMOJI_DESIGNER_TYPE_PREFIX = 'lingbuilder.new_emoji.ui/';
export const WINDOW_DESIGNER_PROJECT_UPDATED = 'window-designer:project-updated';
export const WINDOW_DESIGNER_DIRTY_STATE_CHANGED = 'window-designer:dirty-state-changed';

export const DESIGNER_TITLE_BAR_HEIGHT = 28;
export const DESIGNER_MENU_BAR_HEIGHT = 24;
export const DEFAULT_WINDOW_TITLE_BAR_BACKGROUND = '#2D2D30';
export const DEFAULT_WINDOW_TITLE_BAR_FOREGROUND = '#CBD5E1';
export const DEFAULT_WINDOW_CORNER_STYLE = 'rounded' as const;
export const DEFAULT_WINDOW_ICON_STYLE = 'lingbuilder' as const;
export const NEW_EMOJI_BROWSER_SHELL_FRAME_FLAGS = 0x3F;
export const NEW_EMOJI_WINDOW_FRAME_FLAG_OPTIONS = [
  { flag: 0x01, label: '无系统边框' },
  { flag: 0x02, label: '自绘标题区' },
  { flag: 0x04, label: '自绘窗口按钮' },
  { flag: 0x08, label: '允许缩放' },
  { flag: 0x10, label: '启用圆角' },
  { flag: 0x20, label: '隐藏系统标题栏' }
] as const;
const NEW_EMOJI_STABLE_RELATION_PROPERTY_KEYS = new Set([
  'targetContainerId', 'containerId', 'targetElementId', 'anchorElementId', 'dropdownElementId'
]);

function migrateNewEmojiStableRelationships(properties: Record<string, Win32ControlPropertyValue>): Record<string, Win32ControlPropertyValue> {
  let changed = false;
  const next = { ...properties };
  for (const key of NEW_EMOJI_STABLE_RELATION_PROPERTY_KEYS) {
    if (next[key] === 0 || next[key] === '0') {
      next[key] = '';
      changed = true;
    }
  }
  if (Array.isArray(next.menuItems)) {
    const menuItems = next.menuItems.map(item => {
      if (!item || typeof item !== 'object') return item;
      const record = item as Record<string, unknown>;
      if (record.submenu !== 0 && record.submenu !== '0') return item;
      changed = true;
      return { ...record, submenu: '' };
    });
    if (changed) next.menuItems = menuItems as Array<Record<string, unknown>>;
  }
  return changed ? next : properties;
}

function finiteFrameMetric(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(64, Math.trunc(numeric))) : fallback;
}

export function normalizeLingWindowFrame(
  frame: Partial<LingWindowFrame> | undefined,
  resizable = true,
  cornerStyle: LingWindowModel['cornerStyle'] = DEFAULT_WINDOW_CORNER_STYLE
): LingWindowFrame {
  const preset = frame?.preset === 'browserShell' || frame?.preset === 'custom' ? frame.preset : 'system';
  const defaultBorder = resizable ? 6 : 0;
  const defaultRadius = cornerStyle === 'square' ? 0 : cornerStyle === 'small-rounded' ? 6 : 10;
  const flags = preset === 'browserShell'
    ? NEW_EMOJI_BROWSER_SHELL_FRAME_FLAGS
    : preset === 'custom'
      ? Math.max(0, Math.min(NEW_EMOJI_BROWSER_SHELL_FRAME_FLAGS, Math.trunc(Number(frame?.flags) || 0)))
      : 0;
  return {
    preset,
    flags,
    resizeBorder: {
      left: finiteFrameMetric(frame?.resizeBorder?.left, defaultBorder),
      top: finiteFrameMetric(frame?.resizeBorder?.top, defaultBorder),
      right: finiteFrameMetric(frame?.resizeBorder?.right, defaultBorder),
      bottom: finiteFrameMetric(frame?.resizeBorder?.bottom, defaultBorder)
    },
    cornerRadius: finiteFrameMetric(frame?.cornerRadius, defaultRadius)
  };
}

export interface PersistedWindowDesignerState {
  project: LingWindowProject;
  activeWindowId: string;
  selectedControlId: string | null;
}

export interface WindowDesignerDirtyStateDetail {
  projectId: string;
  isDirty: boolean;
  state: PersistedWindowDesignerState;
  source: 'designer';
}

export interface PrimaryDesignerEventBinding {
  eventName: string;
  handlerName: string;
  menuEventKey?: string;
}

const EVENT_NAME_MAP: Record<string, string> = {
  Click: '单击',
  TextChanged: '文本改变',
  Checked: '选中',
  Unchecked: '取消选中',
  SelectionChanged: '选中项改变',
  ValueChanged: '数值改变',
  MouseEnter: '鼠标移入',
  MouseLeave: '鼠标移出',
  MouseDown: '鼠标按下',
  Select: '选择',
  Loaded: '加载完成',
  GotFocus: '获得焦点',
  LostFocus: '失去焦点'
};

const CPP_EVENT_NAME_MAP: Record<string, string> = {
  Click: '单击',
  TextChanged: '文本内容改变',
  Checked: '被勾选',
  Unchecked: '取消勾选',
  SelectionChanged: '下拉项改变',
  ValueChanged: '数值变化',
  MouseEnter: '指针移入',
  MouseLeave: '指针移出',
  MouseDown: '鼠标按下',
  Loaded: '初始化加载',
  GotFocus: '获得输入焦点',
  LostFocus: '失去输入焦点'
};

const EPL_EVENT_SUFFIX_MAP: Record<string, string> = {
  Click: '被单击',
  TextChanged: '内容被改变',
  Checked: '被选中',
  Unchecked: '被取消选中',
  SelectionChanged: '选择项被改变',
  ValueChanged: '数值被改变',
  MouseEnter: '鼠标移入',
  MouseLeave: '鼠标移出',
  MouseDown: '鼠标被按下',
  Select: '被选择',
  Loaded: '创建完毕',
  GotFocus: '获得焦点',
  LostFocus: '失去焦点'
};

export function getEplEventSuffix(eventName: string): string {
  return getWindowEventDefinition(eventName)?.handlerSuffix || EPL_EVENT_SUFFIX_MAP[eventName] || EVENT_NAME_MAP[eventName] || eventName;
}

export function getPrimaryEventNameForType(type: LingControlType): string {
  return getPrimaryWin32ControlEvent(type)?.name || getEventsForType(type)[0]?.name || 'Loaded';
}

export function hasDesignerWindowMenu(window: Pick<LingWindowModel, 'menuItems'>): boolean {
  return Boolean(window.menuItems?.split(',').some(item => item.trim()));
}

export function getDesignerWindowContentOffset(window: Pick<LingWindowModel, 'menuItems'>): number {
  return DESIGNER_TITLE_BAR_HEIGHT + (hasDesignerWindowMenu(window) ? DESIGNER_MENU_BAR_HEIGHT : 0);
}

export function getPrimaryDesignerEventBinding(
  control: LingControl,
  window?: LingWindowModel,
  moduleControl?: ModuleDesignerControlContribution
): PrimaryDesignerEventBinding {
  const fallbackEventName = getPrimaryEventNameForType(control.type);
  const moduleEvent = moduleControl?.events?.find(event => Boolean(event.runtimeCommand));
  const eventName = moduleEvent?.name || fallbackEventName;
  const compatibleEventNames = [eventName, ...(moduleEvent?.aliases || []), fallbackEventName]
    .filter((name, index, names) => names.indexOf(name) === index);
  const existingControlHandler = compatibleEventNames
    .map(name => control.events?.[name]?.trim())
    .find(Boolean);

  if (control.id === '__window_menu_bar__') {
    return {
      eventName: 'Select',
      handlerName: window?.menuEvents?.Select?.trim()
        || existingControlHandler
        || `_${window?.className || control.name}_窗口菜单被选择`,
      menuEventKey: 'Select'
    };
  }

  const menuItemMatch = /^__window_menu_item_(\d+)__$/.exec(control.id);
  if (menuItemMatch) {
    const itemIndex = Number.parseInt(menuItemMatch[1], 10);
    const menuEventKey = `Item_${itemIndex}`;
    return {
      eventName: 'Select',
      handlerName: window?.menuEvents?.[menuEventKey]?.trim()
        || control.events?.Select?.trim()
        || `_${window?.className || '窗口'}_${control.name}_被选择`,
      menuEventKey
    };
  }

  return {
    eventName,
    handlerName: existingControlHandler
      || moduleEvent?.handlerPattern.replace('{controlName}', control.name)
      || getEplEventHandlerName(control.name, eventName)
  };
}

export function getEplEventHandlerName(controlName: string, eventName: string): string {
  const normalizedName = controlName.trim().replace(/\s+/g, '') || '控件';
  return `_${normalizedName}_${getEplEventSuffix(eventName)}`;
}

export function getEventsForType(type: LingControlType): LingDesignerEventInfo[] {
  const registered = getWin32ControlDefinition(type);
  if (registered) {
    return registered.events.map(item => ({
      name: item.name,
      label: `${item.label} (${item.name})`,
      desc: `${registered.label}触发“${item.label}”时执行中文事件处理器。`,
      handlerSuffix: item.handlerSuffix
    }));
  }
  switch (type as any) {
    case 'MenuBar':
    case 'MenuItem':
      return [
        { name: 'Select', label: '菜单项被选择 (Select)', desc: '点击或选择该菜单的任意子菜单项时触发' }
      ];
    case 'Button':
      return [
        { name: 'Click', label: '单击事件 (Click)', desc: '鼠标左键点击按钮时触发' },
        { name: 'MouseEnter', label: '鼠标移入 (MouseEnter)', desc: '鼠标指针移入按钮边界时触发' },
        { name: 'MouseLeave', label: '鼠标移出 (MouseLeave)', desc: '鼠标指针离开按钮边界时触发' }
      ];
    case 'TextBox':
      return [
        { name: 'TextChanged', label: '文本改变 (TextChanged)', desc: '文本框内字符内容发生变化时触发' },
        { name: 'GotFocus', label: '获得焦点 (GotFocus)', desc: '输入光标进入文本框时触发' },
        { name: 'LostFocus', label: '失去焦点 (LostFocus)', desc: '输入光标离开文本框时触发' }
      ];
    case 'CheckBox':
    case 'RadioButton':
      return [
        { name: 'Checked', label: '选中事件 (Checked)', desc: '控件被勾选或选中时触发' },
        { name: 'Unchecked', label: '取消选中 (Unchecked)', desc: '控件被取消勾选时触发' }
      ];
    case 'ComboBox':
      return [
        { name: 'SelectionChanged', label: '选择改变 (SelectionChanged)', desc: '下拉选择框的当前选中项改变时触发' }
      ];
    case 'ProgressBar':
      return [
        { name: 'ValueChanged', label: '数值改变 (ValueChanged)', desc: '进度条的当前值发生改变时触发' }
      ];
    default:
      return [
        { name: 'MouseDown', label: '鼠标按下 (MouseDown)', desc: '鼠标在该元素上按下时触发' },
        { name: 'Loaded', label: '加载完成 (Loaded)', desc: '控件在界面上初始化渲染完毕时触发' }
      ];
  }
}

export function createControl(type: LingControlType, index: number): LingControl {
  const definition = getWin32ControlDefinition(type);
  if (!definition) throw new Error(`未知 Win32 控件类型：${type}`);
  const newId = `${type.toLowerCase()}_${Math.floor(1000 + Math.random() * 9000)}`;

  return {
    id: newId,
    type,
    name: `${definition.label.split('/')[0]}${index}`,
    content: definition.defaultProps.content,
    width: definition.defaultProps.width,
    height: definition.defaultProps.height,
    x: 180 + Math.floor(Math.random() * 50),
    y: 150 + Math.floor(Math.random() * 50),
    fontSize: 12,
    fontFamily: DEFAULT_CONTROL_FONT_FAMILY,
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,
    background: definition.defaultProps.background || 'transparent',
    foreground: definition.defaultProps.foreground || '#FFFFFF',
    isEnabled: true,
    visibility: 'Visible',
    properties: createDefaultControlProperties(type, definition.defaultProps.content)
  };
}

export function createBlankWindow(index: number, designerBackend = 'win32'): LingWindowModel {
  return {
    id: `window_${Date.now()}_${index}`,
    fileName: `Window${index}.xml`,
    className: `自定义窗体${index}`,
    title: `自定义窗口 ${index}`,
    width: 700,
    height: 420,
    background: '#1E1E24',
    titleBarBackground: DEFAULT_WINDOW_TITLE_BAR_BACKGROUND,
    titleBarForeground: DEFAULT_WINDOW_TITLE_BAR_FOREGROUND,
    cornerStyle: DEFAULT_WINDOW_CORNER_STYLE,
    iconStyle: DEFAULT_WINDOW_ICON_STYLE,
    description: '可通过拖拽控件、绑定中文事件并实时生成 C++ 类定义。',
    openPlacement: 'default',
    resizable: true,
    maximizable: true,
    windowFrame: normalizeLingWindowFrame(undefined, true, DEFAULT_WINDOW_CORNER_STYLE),
    designerBackend,
    controls: designerBackend !== 'win32' ? [] : [
      {
        id: `lbl_custom_${index}`,
        type: 'Label',
        name: `窗口标题标签_${index}`,
        content: `自定义窗口 ${index}`,
        width: 260,
        height: 32,
        x: 40,
        y: 42,
        fontSize: 20,
        background: 'transparent',
        foreground: '#FFFFFF',
        isEnabled: true,
        visibility: 'Visible'
      },
      {
        id: `btn_custom_${index}`,
        type: 'Button',
        name: `按钮${index}`,
        content: '确认',
        width: 120,
        height: 36,
        x: 40,
        y: 110,
        fontSize: 13,
        background: '#007ACC',
        foreground: '#FFFFFF',
        isEnabled: true,
        visibility: 'Visible',
        events: { Click: getEplEventHandlerName(`按钮${index}`, 'Click') }
      }
    ]
  };
}

export const createDefaultWindowProject = (): LingWindowProject => ({
  schemaVersion: 2,
  id: 'lingbuilder-ui-project',
  name: '太空冒险中文桌面应用',
  resources: [],
  windows: [
    {
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: '游戏主窗体',
      title: '太空冒险游戏客户端',
      width: 700,
      height: 420,
      background: '#1E1E24',
      description: '主启动窗口，负责显示游戏状态、昵称输入、启动和退出入口。',
      controls: [
        {
          id: 'lbl_title',
          type: 'Label',
          name: '游戏标题标签',
          content: '太空冒险 (Space Adventure) 客户端',
          width: 500,
          height: 40,
          x: 40,
          y: 30,
          fontSize: 22,
          background: 'transparent',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'lbl_version',
          type: 'Label',
          name: '版本文本',
          content: '核心版本: v2.0.4.12 (C++ UTF-8 本地化版)',
          width: 320,
          height: 25,
          x: 40,
          y: 75,
          fontSize: 12,
          background: 'transparent',
          foreground: '#888899',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'lbl_status',
          type: 'Label',
          name: '服务器状态标签',
          content: '太空服务器状态：正常联机已就绪',
          width: 450,
          height: 25,
          x: 40,
          y: 105,
          fontSize: 13,
          background: 'transparent',
          foreground: '#73C991',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'lbl_name_hint',
          type: 'Label',
          name: '角色昵称提示标签',
          content: '请输入您的星际领航员昵称：',
          width: 250,
          height: 20,
          x: 40,
          y: 145,
          fontSize: 12,
          background: 'transparent',
          foreground: '#CCCCCC',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'txt_username',
          type: 'TextBox',
          name: '编辑框1',
          content: '星际探索者_零号',
          width: 280,
          height: 34,
          x: 40,
          y: 170,
          fontSize: 13,
          background: '#2D2D30',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { TextChanged: getEplEventHandlerName('编辑框1', 'TextChanged') }
        },
        {
          id: 'btn_launch',
          type: 'Button',
          name: '按钮1',
          content: '进入太空冒险',
          width: 200,
          height: 42,
          x: 40,
          y: 220,
          fontSize: 14,
          background: '#007ACC',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: getEplEventHandlerName('按钮1', 'Click') }
        },
        {
          id: 'btn_exit',
          type: 'Button',
          name: '按钮2',
          content: '关闭客户端',
          width: 120,
          height: 42,
          x: 255,
          y: 220,
          fontSize: 14,
          background: '#3E3E40',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: getEplEventHandlerName('按钮2', 'Click') }
        },
        {
          id: 'chk_remember',
          type: 'CheckBox',
          name: '复选框1',
          content: '保存当前登录配置与中文代码方案',
          width: 300,
          height: 22,
          x: 40,
          y: 280,
          fontSize: 12,
          background: 'transparent',
          foreground: '#CCCCCC',
          isEnabled: true,
          visibility: 'Visible',
          events: { Checked: getEplEventHandlerName('复选框1', 'Checked') }
        },
        {
          id: 'progress_sync',
          type: 'ProgressBar',
          name: '资源同步进度条',
          content: '35',
          width: 620,
          height: 22,
          x: 40,
          y: 350,
          fontSize: 11,
          background: '#2D2D30',
          foreground: '#73C991',
          isEnabled: true,
          visibility: 'Visible'
        }
      ]
    },
    {
      id: 'login-window',
      fileName: 'LoginWindow.xml',
      className: '登录窗体',
      title: '太空冒险安全账户登录',
      width: 620,
      height: 380,
      background: '#1E1E24',
      description: '独立登录窗口，演示多窗体切换、输入控件和事件绑定。',
      controls: [
        {
          id: 'lbl_login_title',
          type: 'Label',
          name: '登录窗体标题',
          content: '太空冒险安全账户登录',
          width: 400,
          height: 35,
          x: 110,
          y: 40,
          fontSize: 18,
          background: 'transparent',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'txt_account',
          type: 'TextBox',
          name: '账户输入框',
          content: 'admin@space_adventure.com',
          width: 400,
          height: 35,
          x: 100,
          y: 120,
          fontSize: 13,
          background: '#2D2D30',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { GotFocus: '账户输入框_获得焦点' }
        },
        {
          id: 'txt_password',
          type: 'TextBox',
          name: '密码输入框',
          content: '请输入密码',
          width: 400,
          height: 35,
          x: 100,
          y: 195,
          fontSize: 13,
          background: '#2D2D30',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'chk_policy',
          type: 'CheckBox',
          name: '许可协议复选框',
          content: '我已经阅读并同意用户公约',
          width: 350,
          height: 22,
          x: 100,
          y: 250,
          fontSize: 12,
          background: 'transparent',
          foreground: '#AAAAAA',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'btn_submit',
          type: 'Button',
          name: '提交登录按钮',
          content: '立即安全登录账户',
          width: 400,
          height: 42,
          x: 100,
          y: 295,
          fontSize: 14,
          background: '#2e7d32',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: '提交登录按钮_单击' }
        }
      ]
    },
    {
      id: 'about-window',
      fileName: 'AboutWindow.xml',
      className: '关于窗体',
      title: '关于太空冒险客户端',
      width: 520,
      height: 320,
      background: '#1E1E24',
      description: '关于窗口，演示说明文本、确认按钮和独立窗体生成。',
      controls: [
        {
          id: 'lbl_about_app',
          type: 'Label',
          name: '程序说明标题',
          content: 'Space Adventure UI 核心管理器',
          width: 350,
          height: 25,
          x: 50,
          y: 40,
          fontSize: 16,
          background: 'transparent',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'lbl_about_desc',
          type: 'Label',
          name: '多行关于描述',
          content: '本工具支持中文代码、中文事件、多个窗口和可视化拖拽设计。',
          width: 400,
          height: 100,
          x: 50,
          y: 110,
          fontSize: 12,
          background: 'transparent',
          foreground: '#CCCCCC',
          isEnabled: true,
          visibility: 'Visible'
        },
        {
          id: 'btn_confirm',
          type: 'Button',
          name: '确认关闭按钮',
          content: '我知道了',
          width: 100,
          height: 35,
          x: 350,
          y: 230,
          fontSize: 12,
          background: '#007ACC',
          foreground: '#FFFFFF',
          isEnabled: true,
          visibility: 'Visible',
          events: { Click: '确认关闭按钮_单击' }
        }
      ]
    }
  ]
});

export function normalizeWindowDesignerState(state?: Partial<PersistedWindowDesignerState> | null): PersistedWindowDesignerState {
  const fallbackProject = createDefaultWindowProject();
  const sourceProject = state?.project && Array.isArray(state.project.windows) && state.project.windows.length > 0
    ? state.project
    : fallbackProject;
  let projectChanged = sourceProject.schemaVersion !== 2 || !Array.isArray(sourceProject.resources);
  const normalizedWindows = sourceProject.windows.map(window => {
    const menuFont = normalizeControlFont({
      fontFamily: window.menuFontFamily,
      fontSize: window.menuFontSize ?? 11,
      fontBold: window.menuFontBold,
      fontItalic: window.menuFontItalic,
      fontUnderline: window.menuFontUnderline
    });
    const hierarchyControls = normalizeControlHierarchy(window.controls || []);
    const normalizedTags = normalizeWindowControlTags(hierarchyControls);
    let controlsChanged = hierarchyControls !== window.controls || normalizedTags.changed;
    const controls = normalizedTags.controls.map(control => {
      const font = normalizeControlFont(control);
      let properties = control.properties || createDefaultControlProperties(control.type, control.content);
      let dataGridMigrated = false;
      if (control.type === 'DataGrid') {
        const model = normalizeDataGridModel({
          columns: properties.dataGridColumns as any,
          rows: properties.dataGridRows as any,
          selectionMode: properties.selectionMode as any,
          emptyText: properties.emptyText as any,
          virtualMode: properties.virtualMode as any,
          virtualRowCount: properties.virtualRowCount as any
        });
        const normalizedProperties = { ...properties, ...dataGridModelToPropertyValues(model) };
        dataGridMigrated = JSON.stringify(normalizedProperties) !== JSON.stringify(properties);
        properties = normalizedProperties;
      } else if (control.designerType === 'lingbuilder.new_emoji.ui/Table') {
        const migrated = migrateLegacyNewEmojiTableProperties(properties as Record<string, unknown>);
        dataGridMigrated = JSON.stringify(migrated) !== JSON.stringify(properties);
        properties = migrated as typeof properties;
      }
      const migratedRelationships = migrateNewEmojiStableRelationships(properties);
      if (migratedRelationships !== properties) {
        dataGridMigrated = true;
        properties = migratedRelationships;
      }
      const missingComboBoxExDropDownHeight = control.type === 'ComboBoxEx'
        && !Number.isFinite(Number(properties.dropDownHeight));
      const missingDateTimePickerCalendarHeight = control.type === 'DateTimePicker'
        && !Number.isFinite(Number(properties.calendarHeight));
      const usesLegacyDateTimePickerHeight = control.type === 'DateTimePicker' && control.height === 30;
      const usesLegacyMonthCalendarSize = control.type === 'MonthCalendar' && control.width === 250 && control.height === 190;
      const requiresMigration = !control.properties
        || dataGridMigrated
        || missingComboBoxExDropDownHeight
        || missingDateTimePickerCalendarHeight
        || usesLegacyDateTimePickerHeight
        || usesLegacyMonthCalendarSize
        || control.fontFamily !== font.family
        || control.fontSize !== font.size
        || control.fontBold !== font.bold
        || control.fontItalic !== font.italic
        || control.fontUnderline !== font.underline
        || (control.type === 'FBroBrowser' && Object.keys(control.events || {}).some(name => normalizeFbroEventId(name) !== name));
      if (!requiresMigration) return control;
      controlsChanged = true;
      const normalizedEvents = control.type === 'FBroBrowser' && control.events
        ? Object.fromEntries(Object.entries(control.events).map(([name, handler]) => [normalizeFbroEventId(name), handler]))
        : control.events;
      return {
        ...control,
        fontFamily: font.family,
        fontSize: font.size,
        fontBold: font.bold,
        fontItalic: font.italic,
        fontUnderline: font.underline,
        events: normalizedEvents,
        width: usesLegacyMonthCalendarSize ? 300 : control.width,
        height: usesLegacyDateTimePickerHeight || usesLegacyMonthCalendarSize ? (control.type === 'DateTimePicker' ? 40 : 300) : control.height,
        properties: {
          ...properties,
          ...(missingComboBoxExDropDownHeight ? { dropDownHeight: 160 } : {}),
          ...(missingDateTimePickerCalendarHeight ? { calendarHeight: 300 } : {})
        }
      };
    });
    const inferredDesignerBackend = window.designerBackend
      || (controls.some(control => control.designerType?.startsWith(NEW_EMOJI_DESIGNER_TYPE_PREFIX)) ? 'new-emoji' : undefined);
    const normalizedWindowFrame = normalizeLingWindowFrame(window.windowFrame, window.resizable !== false, window.cornerStyle);
    const appearanceChanged = !window.titleBarBackground || !window.titleBarForeground || !window.cornerStyle || !window.iconStyle || !window.menuBackground || !window.menuForeground
      || typeof window.resizable !== 'boolean' || typeof window.maximizable !== 'boolean'
      || window.menuFontFamily !== menuFont.family || window.menuFontSize !== menuFont.size || window.menuFontBold !== menuFont.bold
      || window.menuFontItalic !== menuFont.italic || window.menuFontUnderline !== menuFont.underline
      || window.designerBackend !== inferredDesignerBackend
      || JSON.stringify(window.windowFrame) !== JSON.stringify(normalizedWindowFrame);
    if (!controlsChanged && !appearanceChanged) return window;
    projectChanged = true;
    return {
      ...window,
      titleBarBackground: window.titleBarBackground || DEFAULT_WINDOW_TITLE_BAR_BACKGROUND,
      titleBarForeground: window.titleBarForeground || DEFAULT_WINDOW_TITLE_BAR_FOREGROUND,
      menuBackground: window.menuBackground || '#ffffff',
      menuForeground: window.menuForeground || '#000000',
      menuFontFamily: menuFont.family,
      menuFontSize: menuFont.size,
      menuFontBold: menuFont.bold,
      menuFontItalic: menuFont.italic,
      menuFontUnderline: menuFont.underline,
      cornerStyle: window.cornerStyle || DEFAULT_WINDOW_CORNER_STYLE,
      iconStyle: window.iconStyle || DEFAULT_WINDOW_ICON_STYLE,
      ...(inferredDesignerBackend ? { designerBackend: inferredDesignerBackend } : {}),
      resizable: window.resizable !== false,
      maximizable: window.maximizable !== false,
      windowFrame: normalizedWindowFrame,
      controls
    };
  });
  const project = projectChanged ? { ...sourceProject, schemaVersion: 2 as const, resources: sourceProject.resources || [], windows: normalizedWindows } : sourceProject;
  const activeWindowId = project.windows.some(window => window.id === state?.activeWindowId)
    ? state!.activeWindowId!
    : project.windows[0].id;
  const activeWindow = project.windows.find(window => window.id === activeWindowId) || project.windows[0];
  const hasPersistedSelection = Boolean(state && Object.prototype.hasOwnProperty.call(state, 'selectedControlId'));
  const persistedSelection = state?.selectedControlId;
  const isVirtualWindowChild = typeof persistedSelection === 'string' && persistedSelection.startsWith('__window_');
  const selectedControlId = hasPersistedSelection && (
    persistedSelection === null
    || isVirtualWindowChild
    || activeWindow.controls.some(control => control.id === persistedSelection)
  )
    ? persistedSelection ?? null
    : activeWindow.controls[0]?.id || null;

  return {
    project,
    activeWindowId,
    selectedControlId
  };
}

export function getWindowDesignerAutosaveKey(projectId: string): string {
  return `${WINDOW_DESIGNER_AUTOSAVE_KEY}.${encodeURIComponent(projectId.trim())}`;
}

export function readWindowDesignerState(projectId?: string): PersistedWindowDesignerState {
  if (typeof window === 'undefined') {
    return normalizeWindowDesignerState();
  }

  const normalizedProjectId = projectId?.trim();
  const keys = normalizedProjectId
    ? [getWindowDesignerAutosaveKey(normalizedProjectId), WINDOW_DESIGNER_AUTOSAVE_KEY]
    : [WINDOW_DESIGNER_AUTOSAVE_KEY];
  for (const key of keys) {
    try {
      const rawState = window.localStorage.getItem(key);
      if (!rawState) continue;
      const state = normalizeWindowDesignerState(JSON.parse(rawState) as Partial<PersistedWindowDesignerState>);
      if (normalizedProjectId && state.project.id !== normalizedProjectId) continue;
      if (normalizedProjectId && key === WINDOW_DESIGNER_AUTOSAVE_KEY) {
        window.localStorage.setItem(getWindowDesignerAutosaveKey(normalizedProjectId), JSON.stringify(state));
      }
      return state;
    } catch {
      // Ignore a damaged cache entry and continue with the legacy/fallback key.
    }
  }
  return normalizeWindowDesignerState();
}

export function notifyWindowDesignerProjectUpdated(state: PersistedWindowDesignerState): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<PersistedWindowDesignerState>(WINDOW_DESIGNER_PROJECT_UPDATED, {
    detail: normalizeWindowDesignerState(state)
  }));
}

export function notifyWindowDesignerDirtyStateChanged(
  detail: WindowDesignerDirtyStateDetail
): WindowDesignerDirtyStateDetail {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<WindowDesignerDirtyStateDetail>(WINDOW_DESIGNER_DIRTY_STATE_CHANGED, {
      detail
    }));
  }
  return detail;
}

export function saveWindowDesignerState(
  state: PersistedWindowDesignerState,
  options: { notify?: boolean } = {}
): PersistedWindowDesignerState {
  const nextState = normalizeWindowDesignerState(state);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(getWindowDesignerAutosaveKey(nextState.project.id), JSON.stringify(nextState));
      window.localStorage.setItem(WINDOW_DESIGNER_AUTOSAVE_KEY, JSON.stringify(nextState));
    } catch {
      // Autosave is best-effort in the prototype; editing should keep working if storage is unavailable.
    }

    if (options.notify !== false) {
      notifyWindowDesignerProjectUpdated(nextState);
    }
  }
  return nextState;
}

export function getLingWindowSourceFileName(windowFileName?: string, windowClassName?: string): string {
  if (windowClassName?.trim()) return `${windowClassName.trim()}.lcpp`;
  const normalized = (windowFileName || '窗口').replace(/\.xml$/i, '');
  return `${normalized}.lcpp`;
}

export function getLingWindowSourceFilePath(
  projectSourceRoot: string | undefined,
  windowFileName?: string,
  windowClassName?: string
): string {
  const sourceRoot = (projectSourceRoot || 'src')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/\/+$/u, '');
  const sourceFileName = getLingWindowSourceFileName(windowFileName, windowClassName);
  return !sourceRoot || sourceRoot === '.' ? sourceFileName : `${sourceRoot}/${sourceFileName}`;
}

export function generateWindowXml(window: LingWindowModel): string {
  let xml = `<!-- 可视化中文界面布局结构定义 (${window.fileName}) -->\n`;
  const iconPathAttr = window.iconStyle === 'custom' && window.iconPath
    ? ` 窗口图标文件="${escapeXmlAttribute(window.iconPath)}"`
    : '';
  xml += `<主窗口 名称="${window.className}" 标题="${window.title}" 宽度="${window.width}" 高度="${window.height}" 背景颜色="${window.background}" 标题栏颜色="${window.titleBarBackground || DEFAULT_WINDOW_TITLE_BAR_BACKGROUND}" 标题文字颜色="${window.titleBarForeground || DEFAULT_WINDOW_TITLE_BAR_FOREGROUND}" 窗口圆角="${window.cornerStyle || DEFAULT_WINDOW_CORNER_STYLE}" 窗口图标="${window.iconStyle || DEFAULT_WINDOW_ICON_STYLE}"${iconPathAttr} 禁止拖拽调整大小="${window.resizable === false ? '是' : '否'}" 禁止窗口最大化="${window.maximizable === false ? '是' : '否'}" 控件对齐="绝对坐标">\n`;
  xml += `    <网格布局 容器边距="0">\n`;

  window.controls.forEach(control => {
    const visibilityAttr = control.visibility === 'Collapsed' ? ' 可见性="隐藏"' : '';
    const stateAttr = !control.isEnabled ? ' 启用状态="禁用"' : '';
    const styleAttr = control.background !== 'transparent' ? ` 背景色="${control.background}"` : '';
    const font = normalizeControlFont(control);
    const tagAttrs = `${control.tagText ? ` 标记文本="${escapeXmlAttribute(control.tagText)}"` : ''}${control.tagInteger !== undefined ? ` 标记整数="${control.tagInteger}"` : ''}`;
    const fontAttrs = ` 字体名称="${escapeXmlAttribute(font.family)}" 字体大小="${font.size}" 粗体="${font.bold ? '是' : '否'}" 斜体="${font.italic ? '是' : '否'}" 下划线="${font.underline ? '是' : '否'}"${tagAttrs}`;
    const parentAttr = control.parentId ? ` 父级控件="${control.parentId}"` : '';
    const eventAttrs = Object.entries(control.events || {})
      .filter(([, handler]) => handler.trim())
      .map(([eventName, handler]) => ` ${EVENT_NAME_MAP[eventName] || eventName}="${handler}"`)
      .join('');

    switch (control.type) {
      case 'Button':
        xml += `        <中文按钮 名称="${control.name}" 内容="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs}${parentAttr}${styleAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      case 'TextBox':
        xml += `        <中文输入框 名称="${control.name}" 默认文本="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs}${parentAttr}${styleAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      case 'Label':
        xml += `        <中文标签 名称="${control.name}" 内容="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs} 字体颜色="${control.foreground}"${parentAttr}${visibilityAttr}${eventAttrs} />\n`;
        break;
      case 'CheckBox':
        xml += `        <中文复选框 名称="${control.name}" 内容="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}" 默认选中="否"${fontAttrs}${parentAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      case 'RadioButton':
        xml += `        <中文单选框 名称="${control.name}" 内容="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}" 默认选中="否"${fontAttrs}${parentAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      case 'ProgressBar':
        xml += `        <中文进度条 名称="${control.name}" 当前值="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs} 进度条颜色="${control.foreground}"${parentAttr}${visibilityAttr}${eventAttrs} />\n`;
        break;
      case 'ComboBox':
        xml += `        <中文下拉框 名称="${control.name}" 默认选中项="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs}${parentAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      case 'Image':
        xml += `        <中文图片 名称="${control.name}" 图片源="${control.content}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}" 填充模式="等比例拉伸"${fontAttrs}${parentAttr}${visibilityAttr}${eventAttrs} />\n`;
        break;
      case 'Grid':
        xml += `        <中文网格 名称="${control.name}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs}${parentAttr}${visibilityAttr}${eventAttrs} />\n`;
        break;
      default: {
        const definition = getWin32ControlDefinition(control.type);
        const properties = escapeXmlAttribute(JSON.stringify(control.properties || {}));
        xml += `        <Win32控件 类型="${control.type}" 中文名称="${definition?.label || control.type}" 名称="${control.name}" 内容="${escapeXmlAttribute(control.content)}" 宽度="${control.width}" 高度="${control.height}" 坐标="${control.x},${control.y}"${fontAttrs} 专属属性="${properties}"${parentAttr}${styleAttr}${visibilityAttr}${stateAttr}${eventAttrs} />\n`;
        break;
      }
    }
  });

  xml += `    </网格布局>\n`;
  xml += `</主窗口>`;
  return xml;
}

export function generateWindowCpp(window: LingWindowModel): string {
  let cpp = `// =========================================================\n`;
  cpp += `// 自动生成的中文 C++ 界面逻辑及类型映射类定义 (${window.className}.h)\n`;
  cpp += `// 来源窗体: ${window.fileName}\n`;
  cpp += `// =========================================================\n`;
  cpp += `#pragma once\n\n`;
  cpp += `#include "中文UI运行支持库.h"\n\n`;
  cpp += `类 ${window.className} : 公开 窗体 {\n`;
  cpp += `私有:\n`;
  cpp += `    // 可视化设计器自动提取的中文控件映射成员：\n`;

  window.controls.forEach(control => {
    cpp += `    ${getCppControlType(control.type).padEnd(16)} ${control.name};\n`;
  });

  cpp += `\n公开:\n`;
  cpp += `    ${window.className}() {\n`;
  cpp += `        主窗体->设置标题(L"${window.title}");\n`;
  cpp += `        主窗体->设置宽度(${window.width});\n`;
  cpp += `        主窗体->设置高度(${window.height});\n`;
  cpp += `        主窗体->设置背景画刷(十六进制画刷::从代码("${window.background}"));\n\n`;
  cpp += `        // 顺序装载并实例化可视化设计器生成的控件\n`;

  window.controls.forEach(control => {
    cpp += `        // 映射控件: ${control.name}\n`;
    cpp += `        ${control.name} = ${getCppFactory(control.type)}();\n`;
    if (control.type === 'ProgressBar') {
      cpp += `        ${control.name}->设置当前进度(${control.content});\n`;
    } else if (control.type !== 'Grid') {
      cpp += `        ${control.name}->设置内容文本(L"${control.content}");\n`;
    }
    cpp += `        ${control.name}->设置控件宽度(${control.width});\n`;
    cpp += `        ${control.name}->设置控件高度(${control.height});\n`;
    cpp += `        ${control.name}->设置视口位置(${control.x}, ${control.y});\n`;
    cpp += `        ${control.name}->设置字体字号(${control.fontSize});\n`;
    if (control.background !== 'transparent') {
      cpp += `        ${control.name}->设置背景颜色(十六进制画刷::从代码("${control.background}"));\n`;
    }
    if (!control.isEnabled) {
      cpp += `        ${control.name}->设置为禁用状态(真);\n`;
    }
    if (control.visibility === 'Collapsed') {
      cpp += `        ${control.name}->设置可见状态(假);\n`;
    }
    cpp += `        主窗体->子控件集合->添加(${control.name});\n\n`;
  });

  cpp += `        // 注册事件回调处理器\n`;
  window.controls.forEach(control => {
    Object.entries(control.events || {}).forEach(([eventName, handler]) => {
      if (!handler.trim()) return;
      const chineseEventName = CPP_EVENT_NAME_MAP[eventName] || eventName;
      cpp += `        ${control.name}->${chineseEventName}事件 += [本指针](对象* 发送方, 路由参数* 参数) {\n`;
      cpp += `            本指针->${handler}(发送方, 参数);\n`;
      cpp += `        };\n`;
    });
  });

  cpp += `    }\n\n`;
  cpp += `    ~${window.className}() {\n`;
  window.controls.forEach(control => {
    cpp += `        安全删除(this->${control.name});\n`;
  });
  cpp += `    }\n\n`;

  cpp += `    // 后台事件处理器：中文子程序入口\n`;
  let handlerCount = 0;
  window.controls.forEach(control => {
    Object.entries(control.events || {}).forEach(([eventName, handler]) => {
      if (!handler.trim()) return;
      handlerCount++;
      cpp += `    空 ${handler}(对象* 发送方, 路由参数* 参数) {\n`;
      cpp += `        // ${control.name} 的 ${EVENT_NAME_MAP[eventName] || eventName} 事件响应\n`;
      if (control.type === 'Button') {
        cpp += `        弹窗消息::弹出提示(L"事件响应成功：已触发【${control.name}】");\n`;
      } else if (control.type === 'TextBox') {
        cpp += `        文字调试区::输出行(L"【${control.name}】内容更新...");\n`;
      } else {
        cpp += `        // 在此编写您的中文 C++ 业务逻辑\n`;
      }
      cpp += `    }\n\n`;
    });
  });
  if (handlerCount === 0) {
    cpp += `    // 当前没有绑定事件处理器。您可以在右侧【事件】面板中添加。\n`;
  }

  cpp += `};`;
  return cpp;
}

export function generateProjectManifest(project: LingWindowProject): string {
  const lines = [
    `// LingBuilder 中文窗口程序集`,
    `项目名称: ${project.name}`,
    `窗口数量: ${project.windows.length}`,
    ''
  ];

  project.windows.forEach(window => {
    lines.push(`窗口: ${window.title}`);
    lines.push(`  文件: ${window.fileName}`);
    lines.push(`  类名: ${window.className}`);
    lines.push(`  控件: ${window.controls.length}`);
    lines.push('');
  });

  return lines.join('\n');
}

function getCppControlType(type: LingControlType): string {
  const map: Partial<Record<LingControlType, string>> = {
    Button: '中文按钮*',
    TextBox: '中文文本输入框*',
    Label: '中文文本标签*',
    CheckBox: '中文复选框*',
    RadioButton: '中文单选框*',
    Image: '中文图片框*',
    ProgressBar: '中文进度条*',
    ComboBox: '中文下拉选择框*',
    Grid: '中文网格*'
  };
  return map[type] || `Win32控件<${getWin32ControlDefinition(type)?.label || type}>*`;
}

function getCppFactory(type: LingControlType): string {
  const map: Partial<Record<LingControlType, string>> = {
    Button: '新 中文按钮',
    TextBox: '新 中文文本输入框',
    Label: '新 中文文本标签',
    CheckBox: '新 中文复选框',
    RadioButton: '新 中文单选框',
    Image: '新 中文图片框',
    ProgressBar: '新 中文进度条',
    ComboBox: '新 中文下拉选择框',
    Grid: '新 中文网格'
  };
  return map[type] || `新 Win32控件<${getWin32ControlDefinition(type)?.label || type}>`;
}

function escapeXmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
