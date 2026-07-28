import type { LingControl, LingControlType, LingWindowModel } from './types';

export const NEW_EMOJI_MODULE_ID = 'lingbuilder.new_emoji.ui';

export interface NewEmojiThemePreview {
  mode: 'dark' | 'light';
  panelBackground: string;
  titleBarBackground: string;
  titleBarForeground: string;
  buttonBackground: string;
  buttonDisabledBackground: string;
  editBackground: string;
  border: string;
  disabledBorder: string;
  textPrimary: string;
  textMuted: string;
  focusBorder: string;
}

const NEW_EMOJI_DARK_THEME: NewEmojiThemePreview = {
  mode: 'dark',
  panelBackground: '#1E1E2E',
  titleBarBackground: '#181825',
  titleBarForeground: '#CDD6F4',
  buttonBackground: '#45475A',
  buttonDisabledBackground: '#2A2D3A',
  editBackground: '#313244',
  border: '#585B70',
  disabledBorder: '#3A3D4C',
  textPrimary: '#CDD6F4',
  textMuted: '#6C7086',
  focusBorder: '#89B4FA'
};

const NEW_EMOJI_LIGHT_THEME: NewEmojiThemePreview = {
  mode: 'light',
  panelBackground: '#EFF1F5',
  titleBarBackground: '#DCE0E8',
  titleBarForeground: '#4C4F69',
  buttonBackground: '#CCD0DA',
  buttonDisabledBackground: '#E5E7EB',
  editBackground: '#E6E9EF',
  border: '#BCC0CC',
  disabledBorder: '#D1D5DB',
  textPrimary: '#4C4F69',
  textMuted: '#9CA0B0',
  focusBorder: '#1E66F5'
};

export const NEW_EMOJI_SUPPORTED_CONTROL_TYPES = new Set<LingControlType>([
  'Button',
  'TextBox',
  'Label',
  'CheckBox',
  'RadioButton',
  'ListBox',
  'Image',
  'ProgressBar',
  'Grid',
  'Upload',
  'DragUpload'
]);

export function isNewEmojiDesignerEnabled(moduleIds: Iterable<string>): boolean {
  return [...moduleIds].includes(NEW_EMOJI_MODULE_ID);
}

export function isNewEmojiDesignerControlSupported(type: LingControlType): boolean {
  return NEW_EMOJI_SUPPORTED_CONTROL_TYPES.has(type);
}

export function isNewEmojiDarkBackground(value: string): boolean {
  const match = value.match(/^#([0-9a-f]{6})$/iu);
  if (!match) return true;
  const rgb = Number.parseInt(match[1]!, 16);
  const red = (rgb >> 16) & 0xff;
  const green = (rgb >> 8) & 0xff;
  const blue = rgb & 0xff;
  return (red * 299 + green * 587 + blue * 114) / 1000 < 150;
}

export function getNewEmojiThemePreview(windowBackground: string): NewEmojiThemePreview {
  return isNewEmojiDarkBackground(windowBackground) ? NEW_EMOJI_DARK_THEME : NEW_EMOJI_LIGHT_THEME;
}

export function isNewEmojiTextInputControl(control: LingControl): boolean {
  const namespacedType = control.designerType?.split('/').pop()?.toLocaleLowerCase() || '';
  return control.type === 'TextBox' || namespacedType === 'input' || namespacedType === 'editbox';
}

export function getNewEmojiUnsupportedControlDiagnostics(window: LingWindowModel): string[] {
  return window.controls
    .filter(control => control.visibility === 'Visible'
      && !control.designerType?.startsWith(`${NEW_EMOJI_MODULE_ID}/`)
      && !isNewEmojiDesignerControlSupported(control.type))
    .map(control => `new_emoji 设计器暂不支持控件“${control.name}”(${control.type})；该控件不会被伪装成 Win32 控件生成。`);
}

export function getNewEmojiElementKind(control: LingControl): string {
  switch (control.type) {
    case 'Button': return 'button';
    case 'TextBox': return 'input';
    case 'Label': return 'text';
    case 'CheckBox': return 'checkbox';
    case 'RadioButton': return 'radio';
    case 'ListBox': return 'listbox';
    case 'Image': return 'image';
    case 'ProgressBar': return 'progress';
    case 'Grid': return 'container';
    case 'Upload': return 'upload';
    case 'DragUpload': return 'drag-upload';
    default: return 'unsupported';
  }
}
