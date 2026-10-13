export interface BeginnerTextPointMetrics {
  clientX: number;
  clientY: number;
  left: number;
  top: number;
  paddingLeft: number;
  paddingTop: number;
  scrollLeft: number;
  scrollTop: number;
  lineHeight: number;
  measureText: (text: string) => number;
  /**
   * 一次性给出整行全部前缀宽度的优选测宽通道；提供时 measureText 不再被逐前缀调用。
   * DOM 镜像测宽必须整行一次量完（多次读写之间不能失效布局），所以走这个批量入口。
   */
  measureLinePrefixes?: (line: string) => number[];
}

export function getBeginnerTextOffsetAtPoint(
  value: string,
  metrics: BeginnerTextPointMetrics
) {
  const lines = value.split('\n');
  const safeLineHeight = Math.max(1, metrics.lineHeight);
  const contentY = metrics.clientY - metrics.top - metrics.paddingTop + metrics.scrollTop;
  const lineIndex = Math.max(0, Math.min(lines.length - 1, Math.floor(contentY / safeLineHeight)));
  const line = lines[lineIndex] || '';
  const contentX = Math.max(0, metrics.clientX - metrics.left - metrics.paddingLeft + metrics.scrollLeft);
  const prefixWidths = metrics.measureLinePrefixes ? metrics.measureLinePrefixes(line) : null;
  const widthAt = (index: number) => (prefixWidths
    ? prefixWidths[index] ?? 0
    : metrics.measureText(line.slice(0, index)));

  let column = 0;
  let previousWidth = 0;
  for (let index = 1; index <= line.length; index += 1) {
    const width = widthAt(index);
    if (contentX < (previousWidth + width) / 2) break;
    column = index;
    previousWidth = width;
  }

  let offset = column;
  for (let index = 0; index < lineIndex; index += 1) offset += lines[index].length + 1;
  return offset;
}

// 与 textarea 同字体、同排版属性的隐藏镜像。canvas measureText 的 CJK/emoji 字体
// 回退与 DOM 实排不一致（逐字累积偏差，实测 19px 字号在中文串内可偏 8~16px），
// 会让悬停提示、Ctrl 单击跳转、双击选词的坐标换算在字符串尾部偏 1~2 个字符；
// DOM 镜像与输入框布局同源，无此偏差。
let beginnerTextMirror: HTMLDivElement | null = null;

function getBeginnerTextMirror(style: CSSStyleDeclaration): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  if (!beginnerTextMirror) {
    beginnerTextMirror = document.createElement('div');
    beginnerTextMirror.setAttribute('aria-hidden', 'true');
    beginnerTextMirror.style.position = 'absolute';
    beginnerTextMirror.style.top = '-9999px';
    beginnerTextMirror.style.left = '-9999px';
    beginnerTextMirror.style.visibility = 'hidden';
    beginnerTextMirror.style.whiteSpace = 'pre';
    beginnerTextMirror.style.pointerEvents = 'none';
    document.body.appendChild(beginnerTextMirror);
  }
  beginnerTextMirror.style.font = style.font || `${style.fontSize} ${style.fontFamily}`;
  beginnerTextMirror.style.letterSpacing = style.letterSpacing;
  beginnerTextMirror.style.tabSize = style.tabSize;
  beginnerTextMirror.style.fontKerning = style.fontKerning;
  beginnerTextMirror.style.fontFeatureSettings = style.fontFeatureSettings;
  return beginnerTextMirror;
}

function measureBeginnerLinePrefixWidths(mirror: HTMLDivElement, line: string): number[] {
  mirror.textContent = line;
  const widths = new Array<number>(line.length + 1);
  const node = mirror.firstChild;
  if (!node) {
    widths[0] = 0;
    return widths;
  }
  const range = document.createRange();
  for (let index = 0; index <= line.length; index += 1) {
    range.setStart(node, 0);
    range.setEnd(node, index);
    widths[index] = range.getBoundingClientRect().width;
  }
  return widths;
}

export function getBeginnerTextareaOffsetAtPoint(
  input: HTMLTextAreaElement,
  clientX: number,
  clientY: number
) {
  const rect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24;
  const mirror = getBeginnerTextMirror(style);
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  const context = canvas?.getContext('2d') ?? null;
  if (context) {
    context.font = style.font || `${style.fontSize} ${style.fontFamily}`;
  }

  return getBeginnerTextOffsetAtPoint(input.value, {
    clientX,
    clientY,
    left: rect.left,
    top: rect.top,
    paddingLeft: Number.parseFloat(style.paddingLeft) || 0,
    paddingTop: Number.parseFloat(style.paddingTop) || 0,
    scrollLeft: input.scrollLeft,
    scrollTop: input.scrollTop,
    lineHeight,
    measureText: text => context?.measureText(text).width ?? text.length * (Number.parseFloat(style.fontSize) || 14),
    measureLinePrefixes: mirror
      ? line => measureBeginnerLinePrefixWidths(mirror, line)
      : undefined
  });
}

const BEGINNER_IDENTIFIER_CHAR = /[A-Za-z0-9_\u3400-\u9fff]/u;

/**
 * 双击选中完整标识符（变量名、命令名）：中文标识符没有空格分词，
 * 浏览器原生双击按词典只选中一段（如 缓冲区句柄 → 缓冲区），
 * 这里按字符边界向两侧扩展出完整标识符区间。
 * 命中位置不是标识符字符（运算符、括号、空白）时返回 null，保留原生行为。
 */
export function getBeginnerIdentifierSpanAtOffset(
  value: string,
  offset: number
): { start: number; end: number } | null {
  const safeOffset = Math.max(0, Math.min(offset, value.length));
  const isIdentifierChar = (char: string | undefined) => Boolean(char && BEGINNER_IDENTIFIER_CHAR.test(char));

  let start = safeOffset;
  let end = safeOffset;
  if (isIdentifierChar(value[safeOffset])) {
    end = safeOffset + 1;
  } else if (isIdentifierChar(value[safeOffset - 1])) {
    // 命中点落在标识符右侧边界（如紧邻右括号），扩展左侧的标识符。
    start = safeOffset - 1;
  } else {
    return null;
  }
  while (start > 0 && isIdentifierChar(value[start - 1])) start -= 1;
  while (end < value.length && isIdentifierChar(value[end])) end += 1;
  return { start, end };
}
