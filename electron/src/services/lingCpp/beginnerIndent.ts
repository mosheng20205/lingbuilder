import { collectLingCppTextBlockOpaqueLines, scanLingCppTextBlockRanges } from './textBlock';

/** 新手编辑器缩进单位：4 个空格，与回车自动对齐（beginnerFlowGuide）保持一致。 */
export const BEGINNER_INDENT_TEXT = '    ';

export interface BeginnerIndentEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  /** 本次是否实际产生改动；无改动时调用方直接返回，不写撤销栈。 */
  changed: boolean;
}

interface LineIndentEdit {
  start: number;
  end: number;
  text: string;
}

interface TouchedLine {
  lineNumber: number;
  lineStart: number;
  lineEnd: number;
  /** 行首空白文本（原样保留，供反缩进量测层级）。 */
  indentationText: string;
  /** 去掉行首空白后的内容（不含行尾换行/回车）。 */
  content: string;
}

/**
 * 新手编辑器 Tab 向右缩进：无选区时在光标处插入一个缩进单位；
 * 有选区时对选区触及的每一行行首整体缩进，选中文本保持不变。
 * 空行与多行文本块不透明行（内容行 + 结束标记）不缩进，开始行正常缩进。
 */
export function indentBeginnerLines(
  value: string,
  selectionStart: number,
  selectionEnd: number
): BeginnerIndentEdit {
  const start = clampOffset(selectionStart, value.length);
  const end = clampOffset(Math.max(selectionStart, selectionEnd), value.length);

  if (start === end) {
    return {
      value: `${value.slice(0, start)}${BEGINNER_INDENT_TEXT}${value.slice(end)}`,
      selectionStart: start + BEGINNER_INDENT_TEXT.length,
      selectionEnd: start + BEGINNER_INDENT_TEXT.length,
      changed: true
    };
  }

  const lines = collectTouchedLines(value, start, end);
  const edits: LineIndentEdit[] = [];
  lines.forEach(line => {
    if (isProtectedLine(value, line)) return;
    if (line.content.trim().length === 0) return;
    edits.push({ start: line.lineStart, end: line.lineStart, text: BEGINNER_INDENT_TEXT });
  });

  if (edits.length === 0) {
    return { value, selectionStart: start, selectionEnd: end, changed: false };
  }

  return {
    value: applyLineEdits(value, edits),
    selectionStart: mapOffsetThroughEdits(start, edits),
    selectionEnd: mapOffsetThroughEdits(end, edits),
    changed: true
  };
}

/**
 * 新手编辑器 Shift+Tab 向左缩进：对光标所在行或选区触及的每一行，
 * 从行首移除至多一个缩进单位的前导空白（制表符算一整个层级）。
 * 多行文本块内容行是用户正文，不参与反缩进。
 */
export function outdentBeginnerLines(
  value: string,
  selectionStart: number,
  selectionEnd: number
): BeginnerIndentEdit {
  const start = clampOffset(selectionStart, value.length);
  const end = clampOffset(Math.max(selectionStart, selectionEnd), value.length);
  const lines = collectTouchedLines(value, start, end);
  const edits: LineIndentEdit[] = [];

  lines.forEach(line => {
    if (isProtectedLine(value, line)) return;
    if (line.indentationText.length === 0) return;
    edits.push({
      start: line.lineStart,
      end: line.lineStart + measureOutdentRemovalLength(line.indentationText),
      text: ''
    });
  });

  const effectiveEdits = edits.filter(edit => edit.end > edit.start || edit.text.length > 0);
  if (effectiveEdits.length === 0) {
    return { value, selectionStart: start, selectionEnd: end, changed: false };
  }

  return {
    value: applyLineEdits(value, effectiveEdits),
    selectionStart: mapOffsetThroughEdits(start, effectiveEdits),
    selectionEnd: mapOffsetThroughEdits(end, effectiveEdits),
    changed: true
  };
}

/**
 * 选区触及的完整行集合：选区末尾恰好落在下一行行首时不含下一行。
 * 空选区 = 光标所在行。行号从 1 起，与 textBlock 扫描对齐。
 */
function collectTouchedLines(value: string, start: number, end: number): TouchedLine[] {
  const firstLineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextLineBreak = value.indexOf('\n', effectiveEnd);
  const lastLineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const lines: TouchedLine[] = [];
  let lineStart = firstLineStart;

  while (lineStart <= lastLineEnd) {
    const lineBreak = value.indexOf('\n', lineStart);
    const lineEnd = lineBreak === -1 || lineBreak > lastLineEnd ? lastLineEnd : lineBreak;
    const rawLine = value.slice(lineStart, lineEnd).replace(/\r$/u, '');
    const indentationText = rawLine.match(/^[\t ]*/u)?.[0] ?? '';
    lines.push({
      lineNumber: value.slice(0, lineStart).split('\n').length,
      lineStart,
      lineEnd,
      indentationText,
      content: rawLine.slice(indentationText.length)
    });
    if (lineBreak === -1 || lineBreak >= lastLineEnd) break;
    lineStart = lineBreak + 1;
  }

  return lines;
}

function isProtectedLine(value: string, line: TouchedLine) {
  // 不透明行 = 文本块内容行 + 结束标记；开始行是普通赋值语句，可参与缩进（见 textBlock.ts）。
  const opaqueLines = collectLingCppTextBlockOpaqueLines(
    scanLingCppTextBlockRanges(value.split('\n')),
    value.split('\n').length
  );
  return opaqueLines.has(line.lineNumber);
}

/**
 * 反缩进一次移除的行首长度：至多一个缩进单位（4 空格）；
 * 制表符算一整个缩进层级，遇到即停（与 VS Code 反缩进口径一致，
 * `\t\t` 一次剩 `\t`，不会一次打光两级）。
 */
function measureOutdentRemovalLength(lineContent: string) {
  let spaceCount = 0;
  for (const char of lineContent) {
    if (char === '\t') return spaceCount + 1;
    if (char !== ' ') break;
    spaceCount += 1;
    if (spaceCount >= BEGINNER_INDENT_TEXT.length) return spaceCount;
  }
  return spaceCount;
}

function applyLineEdits(value: string, edits: LineIndentEdit[]) {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`, value);
}

function mapOffsetThroughEdits(offset: number, edits: LineIndentEdit[]) {
  let delta = 0;
  const orderedEdits = [...edits].sort((left, right) => left.start - right.start);

  for (const edit of orderedEdits) {
    const removedLength = edit.end - edit.start;
    if (removedLength === 0) {
      if (offset >= edit.start) delta += edit.text.length;
      continue;
    }
    if (offset <= edit.start) break;
    if (offset < edit.end) return edit.start + delta + edit.text.length;
    delta += edit.text.length - removedLength;
  }

  return offset + delta;
}

function clampOffset(offset: number, length: number) {
  if (!Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(length, Math.trunc(offset)));
}
