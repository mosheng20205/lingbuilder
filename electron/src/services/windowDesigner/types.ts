import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export type LingControlType =
  | 'Button' | 'TextBox' | 'Label' | 'CheckBox' | 'RadioButton'
  | 'ListBox' | 'ComboBox' | 'GroupBox' | 'ScrollBar'
  | 'Image' | 'ProgressBar' | 'Grid'
  | 'ListView' | 'TreeView' | 'TabControl' | 'Header' | 'ComboBoxEx' | 'SysLink'
  | 'DateTimePicker' | 'MonthCalendar' | 'TrackBar' | 'UpDown' | 'HotKey' | 'IPAddress'
  | 'ToolBar' | 'StatusBar' | 'ToolTip' | 'ReBar' | 'Pager' | 'RichEdit'
  | 'Animation' | 'FlatScrollBar' | 'ImageList' | 'PropertySheet';

export interface LingEventBinding {
  [eventName: string]: string;
}

export type LingWindowOpenPlacement =
  | 'default'
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'custom';

export interface LingControl {
  id: string;
  /** 布局树中的父控件。控件坐标仍使用窗口绝对坐标，避免影响现有生成结果。 */
  parentId?: string;
  type: LingControlType;
  name: string;
  content: string;
  width: number;
  height: number;
  x: number;
  y: number;
  fontSize: number;
  background: string;
  foreground: string;
  isEnabled: boolean;
  visibility: 'Visible' | 'Collapsed';
  /** 控件专属属性。旧项目缺失时由注册表默认值和 content 确定性迁移。 */
  properties?: Record<string, Win32ControlPropertyValue>;
  /** Tab、PropertySheet、Rebar 等多槽位容器中的目标槽位。 */
  containerSlot?: string;
  events?: LingEventBinding;
}

export interface LingWindowModel {
  id: string;
  fileName: string;
  className: string;
  title: string;
  width: number;
  height: number;
  background: string;
  description: string;
  openPlacement?: LingWindowOpenPlacement;
  openX?: number;
  openY?: number;
  controls: LingControl[];
  menuName?: string;
  menuItems?: string;
  menuEvents?: Record<string, string>;
  /** 窗口自身事件；当前确定性生成链路支持 Loaded（创建完毕）。 */
  events?: LingEventBinding;
}

export interface LingImageListResource {
  id: string;
  type: 'ImageList';
  name: string;
  imageWidth: number;
  imageHeight: number;
  images: string[];
}

export interface LingToolTipResource {
  id: string;
  type: 'ToolTip';
  name: string;
  targetControlId: string;
  text: string;
  initialDelay: number;
}

export interface LingPropertySheetPage {
  id: string;
  title: string;
  content: string;
  /** 可选的设计器窗口模板；其全部控件会作为该属性页的真实子 HWND 创建。 */
  sourceWindowId?: string;
}

export interface LingPropertySheetResource {
  id: string;
  type: 'PropertySheet';
  name: string;
  title: string;
  pages: LingPropertySheetPage[];
  appliedHandler?: string;
}

export type LingDesignerResource = LingImageListResource | LingToolTipResource | LingPropertySheetResource;

export interface LingWindowProject {
  schemaVersion?: 2;
  id: string;
  name: string;
  windows: LingWindowModel[];
  resources?: LingDesignerResource[];
}

export interface LingDesignerEventInfo {
  name: string;
  label: string;
  desc: string;
}

export interface LingCppNativePreviewFile {
  relativePath: string;
  language: 'cpp' | 'json' | 'text';
  content: string;
  readonly: true;
}

export interface LingCppNativePreviewResult {
  ok: boolean;
  files: LingCppNativePreviewFile[];
  diagnostics: string[];
  selectedWindow: LingWindowModel;
  enabledModules: string[];
  sourceMap?: import('../lingCpp/types').LingCppNativeSourceMapEntry[];
  stale?: boolean;
}

export interface NativeCppImportResult {
  lcppSource: string;
  designerProjectPatch: Partial<LingWindowProject>;
  preservedNativeBlocks: string[];
  diagnostics: string[];
  report: string[];
}
