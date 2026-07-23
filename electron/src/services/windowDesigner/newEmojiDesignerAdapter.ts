import type { LingControl, LingControlType, LingWindowModel } from './types';

export const NEW_EMOJI_MODULE_ID = 'lingbuilder.new_emoji.ui';

export const NEW_EMOJI_SUPPORTED_CONTROL_TYPES = new Set<LingControlType>([
  'Button',
  'TextBox',
  'Label',
  'CheckBox',
  'RadioButton',
  'ListBox',
  'Image',
  'ProgressBar',
  'Grid'
]);

export function isNewEmojiDesignerEnabled(moduleIds: Iterable<string>): boolean {
  return [...moduleIds].includes(NEW_EMOJI_MODULE_ID);
}

export function isNewEmojiDesignerControlSupported(type: LingControlType): boolean {
  return NEW_EMOJI_SUPPORTED_CONTROL_TYPES.has(type);
}

export function getNewEmojiUnsupportedControlDiagnostics(window: LingWindowModel): string[] {
  return window.controls
    .filter(control => control.visibility === 'Visible' && !isNewEmojiDesignerControlSupported(control.type))
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
    default: return 'unsupported';
  }
}
