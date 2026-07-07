export type LingControlType =
  | 'Button'
  | 'TextBox'
  | 'Label'
  | 'CheckBox'
  | 'RadioButton'
  | 'Image'
  | 'ProgressBar'
  | 'ComboBox'
  | 'Grid';

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
}

export interface LingWindowProject {
  id: string;
  name: string;
  windows: LingWindowModel[];
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
