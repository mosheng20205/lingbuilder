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
  controls: LingControl[];
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
