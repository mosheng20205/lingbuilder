export interface DesignerHotKeyStroke {
  key: string;
  code: string;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  metaKey: boolean;
}

export type DesignerHotKeyCaptureResult =
  | { kind: 'capture'; value: string }
  | { kind: 'clear' }
  | { kind: 'pending' }
  | { kind: 'cancel' }
  | { kind: 'pass' }
  | { kind: 'unsupported'; message: string };

const MODIFIER_CODES = new Set([
  'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight',
  'ShiftLeft', 'ShiftRight', 'MetaLeft', 'MetaRight'
]);

function resolveSupportedMainKey(stroke: DesignerHotKeyStroke): string | null {
  const letter = /^Key([A-Z])$/u.exec(stroke.code);
  if (letter) return letter[1];

  const digit = /^(?:Digit|Numpad)([0-9])$/u.exec(stroke.code);
  if (digit) return digit[1];

  const functionKey = /^F([1-9]|1[0-2])$/u.exec(stroke.key.toUpperCase());
  return functionKey ? functionKey[0] : null;
}

/** Converts a designer keydown into the exact text format consumed by ParseHotKeyValue. */
export function captureDesignerHotKey(stroke: DesignerHotKeyStroke): DesignerHotKeyCaptureResult {
  if (stroke.key === 'Tab') return { kind: 'pass' };
  if (stroke.key === 'Escape') return { kind: 'cancel' };
  if (stroke.key === 'Backspace' || stroke.key === 'Delete') return { kind: 'clear' };
  if (MODIFIER_CODES.has(stroke.code)) return { kind: 'pending' };
  if (stroke.metaKey) return { kind: 'unsupported', message: '当前原生运行时不支持 Windows/Meta 组合键。' };

  const mainKey = resolveSupportedMainKey(stroke);
  if (!mainKey) {
    return { kind: 'unsupported', message: '仅支持字母、数字以及 F1–F12。' };
  }

  const parts: string[] = [];
  if (stroke.ctrlKey) parts.push('Ctrl');
  if (stroke.altKey) parts.push('Alt');
  if (stroke.shiftKey) parts.push('Shift');
  parts.push(mainKey);
  return { kind: 'capture', value: parts.join('+') };
}
