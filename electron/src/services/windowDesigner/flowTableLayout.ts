import type { LingControl } from './types';

/**
 * 流式布局面板（FlowPanel）与表格布局面板（TablePanel）共享算法规格（布局系统三/四期）。
 *
 * 语义红线（生成器 C++ ApplyPanelLayout_ 与设计器画布必须共用本文件公式，禁止各自实现）：
 * - 子控件坐标由布局算法接管：x/y 设计值不参与显示与运行，width/height 是「设计尺寸」；
 * - 流式顺序 = 兄弟数组顺序（创建顺序）；表格格位 = 子控件 properties.tableCell，
 *   缺格位的子控件按数组顺序自动填充下一个空格位；
 * - 布局面板自身仍可参与锚定/等比缩放（面板矩形变化后子控件在面板内重排）；
 *   面板的直接子控件不再参与锚定（生成期发射掩码 0）。
 */

export const FLOW_PANEL_TYPE = 'FlowPanel';
export const TABLE_PANEL_TYPE = 'TablePanel';

/** 画布与运行期面板布局的豁免口径与 anchorLayout 一致；面板子控件一律按本文件算法排。 */
export interface PanelChildInput {
  id: string;
  width: number;
  height: number;
  tableCell?: { row?: number; col?: number; rowSpan?: number; colSpan?: number };
}

export interface FlowPanelProps {
  /** 排列方向；horizontal=水平排列自动换行，vertical=垂直排列自动换列。 */
  orientation: 'horizontal' | 'vertical';
  /** 是否自动换行/换列；false 时单行（列）排完，超出面板不显示（被裁剪）。 */
  wrap: boolean;
  /** 子控件之间的水平间距（DIP）。 */
  hgap: number;
  /** 子控件之间的垂直间距（DIP）。 */
  vgap: number;
  /** 面板内容内边距（DIP，四边同值）。 */
  padding: number;
  /** 非换行模式下的次轴对齐；wrap=true 时忽略（逐行 start 对齐）。 */
  align: 'start' | 'center' | 'end';
}

export interface TablePanelProps {
  /**
   * 列宽定义（DIP 或表达式）：固定数字（如 "120"）、星号权重（"*"、"2*"）、
   * 自动（"auto" = 该列子控件设计宽度最大值）。缺列定义时整列按 auto。
   */
  columns: string[];
  /** 行高定义，语法同 columns（"auto" = 该行子控件设计高度最大值）。 */
  rows: string[];
  /** 单元格之间的水平间距（DIP）。 */
  hgap: number;
  /** 单元格之间的垂直间距（DIP）。 */
  vgap: number;
  /** 面板内容内边距（DIP，四边同值）。 */
  padding: number;
}

export interface PanelLayoutRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_FLOW: FlowPanelProps = {
  orientation: 'horizontal',
  wrap: true,
  hgap: 8,
  vgap: 8,
  padding: 8,
  align: 'start'
};

const DEFAULT_TABLE: TablePanelProps = {
  columns: ['*'],
  rows: ['auto'],
  hgap: 8,
  vgap: 8,
  padding: 8
};

function clampSpacing(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(200, Math.round(parsed));
}

/** 面板属性容错解析：手写/旧模型缺字段时落默认值。 */
export function parseFlowPanelProps(properties: Record<string, unknown> | undefined): FlowPanelProps {
  const props = properties || {};
  return {
    orientation: props.orientation === 'vertical' ? 'vertical' : 'horizontal',
    wrap: props.wrap !== false,
    hgap: clampSpacing(props.hgap, DEFAULT_FLOW.hgap),
    vgap: clampSpacing(props.vgap, DEFAULT_FLOW.vgap),
    padding: clampSpacing(props.padding, DEFAULT_FLOW.padding),
    align: props.align === 'center' || props.align === 'end' ? props.align : 'start'
  };
}

/** 面板属性容错解析；星号/自动之外的非法表达式按自动处理。 */
export function parseTablePanelProps(properties: Record<string, unknown> | undefined): TablePanelProps {
  const props = properties || {};
  const parseTracks = (value: unknown, fallback: string[]): string[] => {
    if (!Array.isArray(value)) return fallback;
    const tracks = value.map(item => String(item ?? '').trim()).filter(Boolean);
    return tracks.length > 0 ? tracks : fallback;
  };
  return {
    columns: parseTracks(props.columns, DEFAULT_TABLE.columns),
    rows: parseTracks(props.rows, DEFAULT_TABLE.rows),
    hgap: clampSpacing(props.hgap, DEFAULT_TABLE.hgap),
    vgap: clampSpacing(props.vgap, DEFAULT_TABLE.vgap),
    padding: clampSpacing(props.padding, DEFAULT_TABLE.padding)
  };
}

interface TrackSizingInput {
  definitions: string[];
  panelExtent: number;
  gap: number;
  padding: number;
  /** 每条轨道上「auto 参与子控件」的设计尺寸最大值（无子控件为 0）。 */
  autoSizes: number[];
  /** spans[i] = 第 i 条轨道被跨轨子控件占据的合并跨度集合（auto/star 计算需排除跨轨项）。 */
}

/**
 * 轨道尺寸解析（列宽/行高共用）：固定 = 字面数字；auto = autoSizes[i]；
 * star = (面板可用空间 − 固定 − auto − 总 gap) 按权重分配（至少 0）。
 * 跨轨子控件（span>1）不参与 auto 统计（其尺寸在合并格里自适应，与 WinForms TableLayoutPanel 同口径）。
 */
function resolveTracks(input: TrackSizingInput): number[] {
  const count = Math.max(1, input.definitions.length);
  const weights: number[] = new Array(count).fill(0);
  const fixed: number[] = new Array(count).fill(0);
  const auto: number[] = new Array(count).fill(0);
  let hasStar = false;
  for (let i = 0; i < count; i += 1) {
    const definition = (input.definitions[i] || 'auto').trim();
    const starMatch = /^(\d+(?:\.\d+)?)?\s*\*$/u.exec(definition);
    if (starMatch) {
      hasStar = true;
      const weight = starMatch[1] ? Number.parseFloat(starMatch[1]) : 1;
      weights[i] = Number.isFinite(weight) && weight > 0 ? weight : 1;
    } else if (/^auto$/iu.test(definition)) {
      auto[i] = Math.max(0, input.autoSizes[i] || 0);
    } else {
      const parsed = Number.parseFloat(definition);
      fixed[i] = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
    }
  }
  const gapTotal = count > 1 ? (count - 1) * input.gap : 0;
  const tracks: number[] = new Array(count).fill(0);
  for (let i = 0; i < count; i += 1) tracks[i] = fixed[i] + auto[i];
  if (hasStar) {
    const availableForStar = Math.max(0, input.panelExtent - input.padding * 2 - gapTotal - fixed.reduce((sum, value) => sum + value, 0) - auto.reduce((sum, value) => sum + value, 0));
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (weightSum > 0) {
      let distributed = 0;
      for (let i = 0; i < count; i += 1) {
        if (weights[i] <= 0) continue;
        const value = i === count - 1 || weights[i] === weightSum
          ? availableForStar - distributed
          : Math.round(availableForStar * weights[i] / weightSum);
        tracks[i] += Math.max(0, value);
        distributed += Math.max(0, value);
      }
    }
  }
  return tracks;
}

/** 子控件格位解析：缺行/列/跨度时落 0（0 = 自动顺序填充）。 */
function parseCell(child: PanelChildInput): { row: number; col: number; rowSpan: number; colSpan: number } {
  const cell = child.tableCell || {};
  const positive = (value: unknown) => Number.isFinite(Number(value)) && Number(value) > 0 ? Math.trunc(Number(value)) : 0;
  return {
    row: positive(cell.row),
    col: positive(cell.col),
    rowSpan: Math.max(1, positive(cell.rowSpan) || 1),
    colSpan: Math.max(1, positive(cell.colSpan) || 1)
  };
}

/**
 * 流式布局：返回每个子控件的显示矩形（面板内相对坐标）。
 * wrap=true：主轴排满换行；wrap=false：单行（列），align 控制次轴对齐。
 * 子控件按设计尺寸排布，不做拉伸（拉伸语义留给锚定/等比缩放，两不混用）。
 */
export function computeFlowLayoutRects(
  panelWidth: number,
  panelHeight: number,
  children: PanelChildInput[],
  props: FlowPanelProps
): Map<string, PanelLayoutRect> {
  const rects = new Map<string, PanelLayoutRect>();
  const horizontal = props.orientation === 'horizontal';
  const contentWidth = Math.max(0, panelWidth - props.padding * 2);
  const contentHeight = Math.max(0, panelHeight - props.padding * 2);
  if (horizontal) {
    let cursorX = props.padding;
    let cursorY = props.padding;
    let rowHeight = 0;
    const rowChildren: PanelChildInput[] = [];
    const flushRow = () => {
      // 行内次轴（垂直）对齐：align=start 顶对齐；center/end 在行高内分配。
      const rowTop = cursorY;
      for (const child of rowChildren) {
        const rect = rects.get(child.id);
        if (!rect) continue;
        const offsetY = props.align === 'center'
          ? Math.round((rowHeight - child.height) / 2)
          : props.align === 'end' ? rowHeight - child.height : 0;
        rect.y = rowTop + Math.max(0, offsetY);
      }
      rowChildren.length = 0;
    };
    for (const child of children) {
      const width = Math.max(0, child.width);
      const height = Math.max(0, child.height);
      const overflow = props.wrap && rowChildren.length > 0 && cursorX - props.padding + width > contentWidth + 1e-6;
      if (overflow) {
        flushRow();
        cursorX = props.padding;
        cursorY += rowHeight + props.vgap;
        rowHeight = 0;
      }
      rects.set(child.id, { id: child.id, x: cursorX, y: cursorY, width, height });
      rowChildren.push(child);
      cursorX += width + props.hgap;
      rowHeight = Math.max(rowHeight, height);
    }
    flushRow();
  } else {
    let cursorY = props.padding;
    for (const child of children) {
      const width = Math.max(0, child.width);
      const height = Math.max(0, child.height);
      let offsetX = 0;
      if (!props.wrap) {
        offsetX = props.align === 'center'
          ? Math.round((contentWidth - width) / 2)
          : props.align === 'end' ? contentWidth - width : 0;
        offsetX = Math.max(0, offsetX);
      }
      rects.set(child.id, { id: child.id, x: props.padding + offsetX, y: cursorY, width, height });
      cursorY += height + props.vgap;
    }
  }
  return rects;
}

/**
 * 表格布局：返回每个子控件的显示矩形（面板内相对坐标）。
 * 有格位的子控件按格位排（跨行跨列合并格）；缺格位的按数组顺序填下一个空格位。
 * 面板小数分解容差 ≤1px（与 resolveTracks 的取整口径配套）。
 */
export function computeTableLayoutRects(
  panelWidth: number,
  panelHeight: number,
  children: PanelChildInput[],
  props: TablePanelProps
): Map<string, PanelLayoutRect> {
  const rects = new Map<string, PanelLayoutRect>();
  const columnCount = Math.max(1, props.columns.length);
  const rowCount = Math.max(1, props.rows.length);
  const occupied = new Set<string>();
  const explicit: Array<{ child: PanelChildInput; row: number; col: number; rowSpan: number; colSpan: number }> = [];
  const autoQueue: PanelChildInput[] = [];
  const autoCursor = { row: 0, col: 0 };

  const cellFree = (row: number, col: number) => !occupied.has(`${row}:${col}`);
  const markCell = (row: number, col: number, rowSpan: number, colSpan: number) => {
    for (let r = row; r < row + rowSpan; r += 1) {
      for (let c = col; c < col + colSpan; c += 1) occupied.add(`${r}:${c}`);
    }
  };
  const advanceCursor = () => {
    while (autoCursor.row < rowCount) {
      if (cellFree(autoCursor.row, autoCursor.col)) return;
      autoCursor.col += 1;
      if (autoCursor.col >= columnCount) {
        autoCursor.col = 0;
        autoCursor.row += 1;
      }
    }
  };

  for (const child of children) {
    const cell = parseCell(child);
    if (cell.row > 0 && cell.col > 0) {
      const row = Math.min(cell.row - 1, rowCount - 1);
      const col = Math.min(cell.col - 1, columnCount - 1);
      explicit.push({ child, row, col, rowSpan: cell.rowSpan, colSpan: cell.colSpan });
    } else {
      autoQueue.push(child);
    }
  }
  for (const entry of explicit) markCell(entry.row, entry.col, entry.rowSpan, entry.colSpan);
  for (const child of autoQueue) {
    advanceCursor();
    if (autoCursor.row >= rowCount) break;
    const row = autoCursor.row;
    const col = autoCursor.col;
    const cell = parseCell(child);
    const rowSpan = Math.min(Math.max(1, cell.rowSpan), rowCount - row);
    const colSpan = Math.min(Math.max(1, cell.colSpan), columnCount - col);
    markCell(row, col, rowSpan, colSpan);
    explicit.push({ child, row, col, rowSpan, colSpan });
  }

  // auto 轨道统计：只收单轨子控件（跨轨项在合并格里自适应）。
  const autoWidths = new Array(columnCount).fill(0);
  const autoHeights = new Array(rowCount).fill(0);
  for (const entry of explicit) {
    if (entry.colSpan === 1) autoWidths[entry.col] = Math.max(autoWidths[entry.col], entry.child.width);
    if (entry.rowSpan === 1) autoHeights[entry.row] = Math.max(autoHeights[entry.row], entry.child.height);
  }
  const columnWidths = resolveTracks({ definitions: props.columns, panelExtent: panelWidth, gap: props.hgap, padding: props.padding, autoSizes: autoWidths });
  const rowHeights = resolveTracks({ definitions: props.rows, panelExtent: panelHeight, gap: props.vgap, padding: props.padding, autoSizes: autoHeights });

  const trackOrigin = (sizes: number[], gap: number, padding: number, index: number) => {
    let origin = padding;
    for (let i = 0; i < index; i += 1) origin += sizes[i] + gap;
    return origin;
  };
  for (const entry of explicit) {
    const x = trackOrigin(columnWidths, props.hgap, props.padding, entry.col);
    const y = trackOrigin(rowHeights, props.vgap, props.padding, entry.row);
    const width = columnWidths.slice(entry.col, entry.col + entry.colSpan).reduce((sum, value) => sum + value, 0) + (entry.colSpan - 1) * props.hgap;
    const height = rowHeights.slice(entry.row, entry.row + entry.rowSpan).reduce((sum, value) => sum + value, 0) + (entry.rowSpan - 1) * props.vgap;
    rects.set(entry.child.id, { id: entry.child.id, x, y, width: Math.max(0, width), height: Math.max(0, height) });
  }
  return rects;
}

/** 控件是否为布局面板容器（FlowPanel/TablePanel）。 */
export function isLayoutPanelType(type: string): boolean {
  return type === FLOW_PANEL_TYPE || type === TABLE_PANEL_TYPE;
}

/** 从模型控件提取布局面板子控件输入（按数组顺序 = 创建顺序）。 */
export function collectLayoutPanelChildren(controls: LingControl[], panelId: string): PanelChildInput[] {
  return controls
    .filter(control => control.parentId === panelId)
    .map(control => {
      const cell = control.properties?.tableCell;
      const record = cell && typeof cell === 'object' && !Array.isArray(cell) ? cell as Record<string, unknown> : undefined;
      const toInt = (value: unknown) => Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : undefined;
      return {
        id: control.id,
        width: control.width,
        height: control.height,
        tableCell: record ? {
          row: toInt(record.row),
          col: toInt(record.col),
          rowSpan: toInt(record.rowSpan),
          colSpan: toInt(record.colSpan)
        } : undefined
      };
    });
}
