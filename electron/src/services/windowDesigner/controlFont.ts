import type { LingControl } from './types';

export const DEFAULT_CONTROL_FONT_FAMILY = 'Microsoft YaHei UI';

export const CONTROL_FONT_FAMILY_OPTIONS = [
  { value: 'Microsoft YaHei UI', label: '微软雅黑 UI' },
  { value: 'Microsoft YaHei', label: '微软雅黑' },
  { value: 'DengXian', label: '等线' },
  { value: 'SimSun', label: '宋体' },
  { value: 'SimHei', label: '黑体' },
  { value: 'KaiTi', label: '楷体' },
  { value: 'FangSong', label: '仿宋' },
  { value: 'Segoe UI', label: 'Segoe UI' },
  { value: 'Arial', label: 'Arial' },
  { value: 'Times New Roman', label: 'Times New Roman' },
  { value: 'Consolas', label: 'Consolas' }
] as const;

const CONTROL_FONT_FAMILY_VALUES = new Set<string>(CONTROL_FONT_FAMILY_OPTIONS.map(option => option.value));

export interface NormalizedControlFont {
  family: string;
  size: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export function normalizeControlFont(control: Pick<LingControl, 'fontFamily' | 'fontSize' | 'fontBold' | 'fontItalic' | 'fontUnderline'>): NormalizedControlFont {
  const requestedFamily = typeof control.fontFamily === 'string' ? control.fontFamily.trim() : '';
  const family = CONTROL_FONT_FAMILY_VALUES.has(requestedFamily) ? requestedFamily : DEFAULT_CONTROL_FONT_FAMILY;
  const parsedSize = Number(control.fontSize);
  return {
    family,
    size: Number.isFinite(parsedSize) ? Math.max(9, Math.min(72, Math.round(parsedSize))) : 12,
    bold: control.fontBold === true,
    italic: control.fontItalic === true,
    underline: control.fontUnderline === true
  };
}

export function getControlFontCssStyle(control: Pick<LingControl, 'fontFamily' | 'fontSize' | 'fontBold' | 'fontItalic' | 'fontUnderline'>) {
  const font = normalizeControlFont(control);
  return {
    fontFamily: `"${font.family.replace(/["\\]/gu, '')}", sans-serif`,
    fontSize: `${font.size}px`,
    fontWeight: font.bold ? 700 : 400,
    fontStyle: font.italic ? 'italic' : 'normal',
    textDecoration: font.underline ? 'underline' : 'none'
  } as const;
}
