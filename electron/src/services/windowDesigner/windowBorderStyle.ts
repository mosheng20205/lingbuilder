import type { LingWindowBorderStyle } from './types';

export interface LingWindowBorderOption {
  value: LingWindowBorderStyle;
  label: string;
}

export const LING_WINDOW_BORDER_STYLE_OPTIONS: LingWindowBorderOption[] = [
  { value: 'none', label: '无边框' },
  { value: 'normal-resizable', label: '普通可调边框' },
  { value: 'normal-fixed', label: '普通固定边框' },
  { value: 'thin-title-resizable', label: '窄标题可调边框' },
  { value: 'thin-title-fixed', label: '窄标题固定边框' },
  { value: 'frame-resizable', label: '镜框式可调边框' },
  { value: 'frame-fixed', label: '镜框式固定边框' }
];

const LING_WINDOW_BORDER_STYLE_VALUES = new Set<string>(LING_WINDOW_BORDER_STYLE_OPTIONS.map(option => option.value));

export function isLingWindowBorderStyle(value: unknown): value is LingWindowBorderStyle {
  return typeof value === 'string' && LING_WINDOW_BORDER_STYLE_VALUES.has(value);
}

/** 旧项目迁移：无 borderStyle 时按旧 resizable 布尔值确定，保持现状行为。 */
export function normalizeLingWindowBorderStyle(
  borderStyle: LingWindowBorderStyle | undefined,
  legacyResizable: boolean | undefined
): LingWindowBorderStyle {
  if (isLingWindowBorderStyle(borderStyle)) return borderStyle;
  return legacyResizable === false ? 'normal-fixed' : 'normal-resizable';
}

/** resizable 布尔值由边框枚举派生：固定类与无边框不可拖拽调整大小。 */
export function deriveLingWindowBorderStyle(borderStyle: LingWindowBorderStyle | undefined): boolean {
  if (!borderStyle || borderStyle === 'normal-resizable' || borderStyle === 'thin-title-resizable' || borderStyle === 'frame-resizable') return true;
  return false;
}

/** C++ 端枚举编号，与易语言边框编号 0–6 一致。 */
export function toWindowBorderCxxValue(borderStyle: LingWindowBorderStyle | undefined): number {
  const index = LING_WINDOW_BORDER_STYLE_OPTIONS.findIndex(option => option.value === borderStyle);
  return index >= 0 ? index : 1;
}

export interface ResolvedLingWindowBorder {
  /** 可直接嵌入生成 C++ 的样式宏表达式。 */
  dwStyle: string;
  dwExStyle: string;
  hasCaption: boolean;
  hasSizingBorder: boolean;
  captionKind: 'normal' | 'thin' | 'none';
}

/** 枚举 → Win32 样式的唯一确定性映射；生成器、画布、测试全部消费本函数。 */
export function resolveLingWindowBorder(
  borderStyle: LingWindowBorderStyle | undefined,
  maximizable: boolean
): ResolvedLingWindowBorder {
  const style = borderStyle || 'normal-resizable';
  const resizable = style === 'normal-resizable' || style === 'thin-title-resizable' || style === 'frame-resizable';
  let dwStyle = resizable ? 'WS_OVERLAPPEDWINDOW' : '(WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME)';
  let dwExStyle = '0';
  let captionKind: ResolvedLingWindowBorder['captionKind'] = 'normal';
  if (style === 'none') {
    dwStyle = 'WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX';
    captionKind = 'none';
  } else if (style === 'thin-title-resizable' || style === 'thin-title-fixed') {
    dwExStyle = 'WS_EX_TOOLWINDOW';
    captionKind = 'thin';
  } else if (style === 'frame-resizable' || style === 'frame-fixed') {
    dwExStyle = 'WS_EX_DLGMODALFRAME';
  }
  if (maximizable === false && style !== 'none') {
    dwStyle = dwStyle === 'WS_OVERLAPPEDWINDOW' ? '(WS_OVERLAPPEDWINDOW & ~WS_MAXIMIZEBOX)' : `(${dwStyle} & ~WS_MAXIMIZEBOX)`;
  }
  return {
    dwStyle,
    dwExStyle,
    hasCaption: captionKind !== 'none',
    hasSizingBorder: resizable,
    captionKind
  };
}

/** 生成 C++ 运行时辅助函数：WindowSpec 存枚举编号，运行时按编号计算样式位。 */
export function generateWindowBorderHelperCpp(): string {
  return `static DWORD LB_WindowBorderStyleToDwStyle(int borderStyle, bool maximizable) {
    DWORD style = WS_OVERLAPPEDWINDOW;
    switch (borderStyle) {
    case 0: style = WS_POPUP | WS_SYSMENU | WS_MINIMIZEBOX; break;
    case 2: case 4: case 6: style = WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME; break;
    default: style = WS_OVERLAPPEDWINDOW; break;
    }
    if (borderStyle != 0 && !maximizable) style &= ~WS_MAXIMIZEBOX;
    return style;
}

static DWORD LB_WindowBorderStyleToDwExStyle(int borderStyle) {
    if (borderStyle == 3 || borderStyle == 4) return WS_EX_TOOLWINDOW;
    if (borderStyle == 5 || borderStyle == 6) return WS_EX_DLGMODALFRAME;
    return 0;
}`;
}
