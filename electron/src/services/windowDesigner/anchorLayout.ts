import type { LingControl, LingWindowModel, LingWindowProject } from './types';
import { getDesignerWindowContentOffset } from './windowDesignerService';
import { isLayoutPanelType } from './flowTableLayout';

/**
 * 控件锚定布局共享规格（一期：控件级锚定）。
 *
 * 语义与 WinForms 锚定同构，生成器（lingCppWin32Project.ts 运行时 ApplyAnchorLayout_）
 * 与设计器画布「模拟拉伸预览」必须共用本文件的同一份数学，禁止各自实现：
 *
 * - anchor 值是 left/top/right/bottom 的组合，存放在控件 `properties.anchor`；
 *   缺省 / "left,top" = 固定位置（现状行为），旧项目零迁移；
 * - 设父容器尺寸变化量 dx/dy（窗口 = 客户区变化量；分组框/选项卡页 = 该控件尺寸变化量）：
 *   · 仅 left/top（默认）  → x/y 不动，宽高不变；
 *   · 仅 right（无 left）  → x += dx（距右缘不变），宽高不变；
 *   · 仅 bottom（无 top）  → y += dy（距下缘不变），宽高不变；
 *   · left+right           → 左右边距都固定 → 宽度 += dx；
 *   · top+bottom           → 上下边距都固定 → 高度 += dy；
 *   · 四向全开             → 位置不变，宽高双向伸缩。
 * - 非默认锚定必然涉及 right 和/或 bottom（left-only/top-only 与默认同义，解析归零）。
 *
 * 运行期豁免类型（有专属创建/布局管线，锚定不接管）：工具栏、状态栏、Rebar 带、菜单项。
 * 运行期动态创建（控件_创建*）的控件不参与锚定（基线在窗口创建期捕获）。
 */

export const ANCHOR_LEFT = 1;
export const ANCHOR_TOP = 2;
export const ANCHOR_RIGHT = 4;
export const ANCHOR_BOTTOM = 8;

export type AnchorSide = 'left' | 'top' | 'right' | 'bottom';

const SIDE_BITS: Readonly<Record<AnchorSide, number>> = {
  left: ANCHOR_LEFT,
  top: ANCHOR_TOP,
  right: ANCHOR_RIGHT,
  bottom: ANCHOR_BOTTOM
};

const SIDE_ORDER: readonly AnchorSide[] = ['left', 'top', 'right', 'bottom'];

const SIDE_ALIASES: Readonly<Record<string, AnchorSide>> = {
  left: 'left',
  top: 'top',
  right: 'right',
  bottom: 'bottom',
  左: 'left',
  上: 'top',
  右: 'right',
  下: 'bottom'
};

/** 运行期锚定重排的豁免控件类型；与生成器 C++ AnchorLayoutSkipsType 保持一致。 */
export const ANCHOR_LAYOUT_SKIPPED_TYPES: ReadonlySet<string> = new Set([
  'ToolBar',
  'StatusBar',
  'Rebar',
  'ReBar',
  'MenuItem'
]);

/**
 * 解析锚定值为位掩码。返回 0 表示默认锚定（固定位置，运行期零参与）。
 * 容忍大小写、中文顿号/逗号/空格分隔、中文方位别名；未知词元整体视为非法 → 0，
 * 避免半截手写值产生错误锚定。
 * 完整掩码保留 left/top 位（left+right / top+bottom 拉伸语义需要）；仅含 left/top
 * 的组合与缺省同义，归零。
 */
export function parseAnchorMask(value: unknown): number {
  if (typeof value !== 'string') return 0;
  const tokens = value.split(/[,,、\s;；]+/u).map(token => token.trim().toLowerCase()).filter(Boolean);
  if (tokens.length === 0) return 0;
  let mask = 0;
  for (const token of tokens) {
    const side = SIDE_ALIASES[token];
    if (!side) return 0;
    mask |= SIDE_BITS[side];
  }
  if ((mask & ~(ANCHOR_LEFT | ANCHOR_TOP)) === 0) return 0;
  return mask;
}

/** 位掩码 → 规范存储字符串（left,top,right,bottom 顺序）；0（默认）返回空串，不落盘。 */
export function anchorMaskToValue(mask: number): string {
  if (mask === 0) return '';
  return SIDE_ORDER.filter(side => mask & SIDE_BITS[side]).join(',');
}

/** 控件当前的规范锚定值；默认锚定返回空串。 */
export function getControlAnchorValue(control: Pick<LingControl, 'properties'>): string {
  return normalizeAnchorValue(control.properties?.anchor);
}

/** 归一化任意输入为可存储的规范锚定值；默认/非法返回空串（= 删除该属性）。 */
export function normalizeAnchorValue(value: unknown): string {
  return anchorMaskToValue(parseAnchorMask(value));
}

export interface AnchoredRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * 共享重排数学：基线矩形 + 父容器尺寸变化量 → 新矩形。
 * 生成器 C++ ApplyAnchorLayout_ 与设计器画布模拟拉伸预览共用本函数定义的语义。
 */
export function computeAnchoredRect(
  base: AnchoredRect,
  mask: number,
  parentDeltaX: number,
  parentDeltaY: number
): AnchoredRect {
  const stretchWidth = (mask & ANCHOR_LEFT) !== 0 && (mask & ANCHOR_RIGHT) !== 0;
  const stretchHeight = (mask & ANCHOR_TOP) !== 0 && (mask & ANCHOR_BOTTOM) !== 0;
  const followRight = (mask & ANCHOR_RIGHT) !== 0 && !stretchWidth;
  const followBottom = (mask & ANCHOR_BOTTOM) !== 0 && !stretchHeight;
  let width = base.width;
  let height = base.height;
  if (stretchWidth) width += parentDeltaX;
  if (stretchHeight) height += parentDeltaY;
  return {
    x: base.x + (followRight ? parentDeltaX : 0),
    y: base.y + (followBottom ? parentDeltaY : 0),
    width: Math.max(0, Math.round(width)),
    height: Math.max(0, Math.round(height))
  };
}

/**
 * 窗口客户区最小尺寸（DIP）：left+right / top+bottom 拉伸控件在新客户区下宽高不得为负。
 * 仅 right/bottom 跟随不产生下限（控件可滑出窗口外被裁剪，与 WinForms 行为一致）。
 * 入参是窗口设计模型（高度含标题栏），内部换算为运行时客户区口径；
 * 生成器 WM_GETMINMAXINFO 消费同一公式（C++ 侧基线取捕获的真实客户区，捕获前回退 spec 尺寸）。
 */
export function computeWindowMinimumClientSize(
  window: Pick<LingWindowModel, 'width' | 'height' | 'controls' | 'borderStyle' | 'menuItems'>
): { width: number; height: number } {
  const clientWidth = window.width;
  const clientHeight = Math.max(0, window.height - getDesignerWindowContentOffset(window));
  let minWidth = 0;
  let minHeight = 0;
  for (const control of window.controls) {
    if (control.parentId) continue; // 容器内控件的约束相对父控件，不产生窗口级下限
    const mask = parseAnchorMask(control.properties?.anchor);
    if (mask === 0 || ANCHOR_LAYOUT_SKIPPED_TYPES.has(control.type)) continue;
    if ((mask & ANCHOR_LEFT) !== 0 && (mask & ANCHOR_RIGHT) !== 0) {
      minWidth = Math.max(minWidth, clientWidth - control.width);
    }
    if ((mask & ANCHOR_TOP) !== 0 && (mask & ANCHOR_BOTTOM) !== 0) {
      minHeight = Math.max(minHeight, clientHeight - control.height);
    }
  }
  return { width: Math.max(0, minWidth), height: Math.max(0, minHeight) };
}

/**
 * 项目是否存在非默认锚定控件（生成器 anchor family 门控；缺省 = 零发射）。
 * 开启 scaleContentWithWindow 的窗口整体排除：等比缩放与锚定互斥，其内控件 anchor 全部忽略。
 * 布局面板（FlowPanel/TablePanel）的直接子控件排除：其位置由面板布局接管，anchor 发射期已抑制。
 */
export function isAnchorLayoutEnabledForProject(project: LingWindowProject): boolean {
  return project.windows.some(window => window.scaleContentWithWindow !== true && window.controls.some(control =>
    !ANCHOR_LAYOUT_SKIPPED_TYPES.has(control.type)
    && !(control.parentId && window.controls.some(parent => isLayoutPanelType(parent.type) && parent.id === control.parentId))
    && parseAnchorMask(control.properties?.anchor) !== 0
  ));
}

/**
 * 「模拟拉伸」整窗预览：客户区宽高各加 stretchX/stretchY（DIP，可为负），返回
 * 每个控件的显示矩形（模型坐标，不写回）。控件数组顺序父先于子（与创建顺序一致），
 * 父级变化量取自身已计算的父矩形；默认锚定/豁免类型控件保持原矩形（父变化量为零传播）。
 * 语义与生成 C++ ApplyAnchorLayout_ 完全同规格（同一 computeAnchoredRect）。
 */
export function anchorStretchPreviewRects(
  window: Pick<LingWindowModel, 'controls'>,
  stretchX: number,
  stretchY: number
): Map<string, AnchoredRect> {
  const resolved = new Map<string, AnchoredRect>();
  const baseById = new Map<string, LingControl>();
  for (const control of window.controls) baseById.set(control.id, control);
  for (const control of window.controls) {
    const base: AnchoredRect = { x: control.x, y: control.y, width: control.width, height: control.height };
    const mask = parseAnchorMask(control.properties?.anchor);
    const anchored = mask !== 0 && !ANCHOR_LAYOUT_SKIPPED_TYPES.has(control.type);
    if (!control.parentId) {
      resolved.set(control.id, anchored ? computeAnchoredRect(base, mask, stretchX, stretchY) : base);
      continue;
    }
    const parent = baseById.get(control.parentId);
    const parentRect = resolved.get(control.parentId);
    if (!parent || !parentRect || !anchored) {
      resolved.set(control.id, base);
      continue;
    }
    const parentDeltaX = parentRect.width - parent.width;
    const parentDeltaY = parentRect.height - parent.height;
    resolved.set(control.id, computeAnchoredRect(base, mask, parentDeltaX, parentDeltaY));
  }
  return resolved;
}

/**
 * 窗口级等比缩放（布局系统二期）共享数学：给定缩放后客户区（DIP），返回每个控件的
 * 显示矩形。因子 = min(客户区宽/基线宽, 客户区高/基线高)，基线 = 设计器客户区尺寸；
 * 控件新位置 = 父新位置 + 父内相对偏移 × 因子（模型坐标是窗口绝对坐标，父内偏移现场换算），
 * 尺寸 = 基线 × 因子。豁免类型（ANCHOR_LAYOUT_SKIPPED_TYPES）保持基线矩形。
 * 语义与生成 C++ ApplyScaleLayout_ 同规格；开启 scaleContentWithWindow 的窗口忽略控件锚定。
 */
export function computeWindowScaledRects(
  window: Pick<LingWindowModel, 'width' | 'height' | 'controls' | 'borderStyle' | 'menuItems'>,
  clientWidth: number,
  clientHeight: number
): { factor: number; rects: Map<string, AnchoredRect> } {
  const baseWidth = Math.max(1, window.width);
  const baseHeight = Math.max(1, window.height - getDesignerWindowContentOffset(window));
  const factor = Math.min(clientWidth / baseWidth, clientHeight / baseHeight);
  const rects = new Map<string, AnchoredRect>();
  const baseById = new Map<string, LingControl>();
  for (const control of window.controls) baseById.set(control.id, control);
  for (const control of window.controls) {
    const base: AnchoredRect = { x: control.x, y: control.y, width: control.width, height: control.height };
    if (ANCHOR_LAYOUT_SKIPPED_TYPES.has(control.type)) {
      rects.set(control.id, base);
      continue;
    }
    const parent = control.parentId ? baseById.get(control.parentId) : undefined;
    const parentRect = parent ? rects.get(parent.id) : undefined;
    if (control.parentId && (!parent || !parentRect)) {
      rects.set(control.id, base);
      continue;
    }
    const originX = parentRect ? parentRect.x : 0;
    const originY = parentRect ? parentRect.y : 0;
    const relativeX = parent ? control.x - parent.x : control.x;
    const relativeY = parent ? control.y - parent.y : control.y;
    rects.set(control.id, {
      x: originX + Math.round(relativeX * factor),
      y: originY + Math.round(relativeY * factor),
      width: Math.max(0, Math.round(control.width * factor)),
      height: Math.max(0, Math.round(control.height * factor))
    });
  }
  return { factor, rects };
}
