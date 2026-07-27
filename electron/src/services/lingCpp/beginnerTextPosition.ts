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

  let column = 0;
  let previousWidth = 0;
  for (let index = 1; index <= line.length; index += 1) {
    const width = metrics.measureText(line.slice(0, index));
    if (contentX < (previousWidth + width) / 2) break;
    column = index;
    previousWidth = width;
  }

  let offset = column;
  for (let index = 0; index < lineIndex; index += 1) offset += lines[index].length + 1;
  return offset;
}

export function getBeginnerTextareaOffsetAtPoint(
  input: HTMLTextAreaElement,
  clientX: number,
  clientY: number
) {
  const rect = input.getBoundingClientRect();
  const style = window.getComputedStyle(input);
  const lineHeight = Number.parseFloat(style.lineHeight) || Number.parseFloat(style.fontSize) * 1.5 || 24;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
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
    measureText: text => context?.measureText(text).width ?? text.length * (Number.parseFloat(style.fontSize) || 14)
  });
}
