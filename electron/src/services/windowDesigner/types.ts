import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export type LingControlType =
  | 'Button' | 'TextBox' | 'Label' | 'CheckBox' | 'RadioButton'
  | 'ListBox' | 'ComboBox' | 'GroupBox' | 'ScrollBar'
  | 'Image' | 'ProgressBar' | 'Grid'
  | 'Upload' | 'DragUpload'
  | 'ListView' | 'TreeView' | 'TabControl' | 'Header' | 'ComboBoxEx' | 'SysLink'
  | 'DateTimePicker' | 'MonthCalendar' | 'TrackBar' | 'UpDown' | 'HotKey' | 'IPAddress'
  | 'ToolBar' | 'StatusBar' | 'ToolTip' | 'ReBar' | 'Pager' | 'RichEdit'
  | 'Animation' | 'FlatScrollBar' | 'ImageList' | 'PropertySheet' | 'FileDialog';

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

export type LingWindowCornerStyle = 'system' | 'rounded' | 'small-rounded' | 'square';
export type LingWindowIconStyle = 'lingbuilder' | 'system' | 'custom' | 'none';

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
  /** 字体名称及样式；旧项目缺失时确定性迁移为微软雅黑 UI 常规字体。 */
  fontFamily?: string;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
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
  /** 原生非客户区外观；旧版 Windows 不支持的 DWM 属性会安全回退到系统样式。 */
  titleBarBackground?: string;
  titleBarForeground?: string;
  cornerStyle?: LingWindowCornerStyle;
  iconStyle?: LingWindowIconStyle;
  /** 自定义窗口图标的工作区相对路径；仅在 iconStyle 为 custom 时使用。 */
  iconPath?: string;
  description: string;
  openPlacement?: LingWindowOpenPlacement;
  openX?: number;
  openY?: number;
  /** 是否允许用户拖拽原生窗口边框调整大小；旧项目默认允许。 */
  resizable?: boolean;
  /** 是否允许用户通过标题栏按钮或系统菜单最大化窗口；旧项目默认允许。 */
  maximizable?: boolean;
  controls: LingControl[];
  menuName?: string;
  menuItems?: string;
  /** 原生窗口菜单栏及其下拉菜单的背景颜色。 */
  menuBackground?: string;
  /** 原生窗口菜单栏及其下拉菜单的文字颜色。 */
  menuForeground?: string;
  menuFontFamily?: string;
  menuFontSize?: number;
  menuFontBold?: boolean;
  menuFontItalic?: boolean;
  menuFontUnderline?: boolean;
  menuEvents?: Record<string, string>;
  /** 窗口自身事件；事件键由 windowEventRegistry 统一维护。 */
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

export interface LingFileDialogResource {
  id: string;
  type: 'FileDialog';
  name: string;
  /** 仅用于设计器画布内占位的水平坐标，不生成运行时控件。 */
  designerX?: number;
  /** 仅用于设计器画布内占位的垂直坐标，不生成运行时控件。 */
  designerY?: number;
  /** 组件所属窗口；按钮触发和窗口级拖放均限制在该窗口。 */
  ownerWindowId: string;
  /** 单击后自动打开对话框的现有控件。 */
  triggerControlId: string;
  /** 接收拖入文件的窗口或控件 ID。 */
  dropTargetId: string;
  title: string;
  filter: string;
  multiple: boolean;
  allowDrop: boolean;
  filesSelectedHandler?: string;
  filesDroppedHandler?: string;
  cancelledHandler?: string;
}

export type LingDesignerResource = LingImageListResource | LingToolTipResource | LingPropertySheetResource | LingFileDialogResource;

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
