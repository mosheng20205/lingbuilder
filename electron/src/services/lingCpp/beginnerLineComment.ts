import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from './textBlock';

export interface BeginnerLineCommentEdit {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  commented: boolean;
}

interface TextEdit {
  start: number;
  end: number;
  text: string;
}

/**
 * Toggles `//` comments for the complete lines touched by a beginner-editor
 * selection while preserving indentation, line endings and the caret/selection.
 */
export function toggleBeginnerLineComment(
  value: string,
  selectionStart: number,
  selectionEnd: number
): BeginnerLineCommentEdit {
  const start = clampOffset(selectionStart, value.length);
  const end = clampOffset(Math.max(selectionStart, selectionEnd), value.length);
  const firstLineStart = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const effectiveEnd = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextLineBreak = value.indexOf('\n', effectiveEnd);
  const lastLineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
  const lines = collectLines(value, firstLineStart, lastLineEnd);
  const blockConsumed = collectLingCppTextBlockLines(
    scanLingCppTextBlockRanges(value.split('\n')),
    value.split('\n').length
  );
  const nonBlankLines = lines.filter(line => line.content.trim().length > 0 && !blockConsumed.has(line.lineNumber));

  if (nonBlankLines.length === 0) {
    return { value, selectionStart: start, selectionEnd: end, commented: false };
  }

  const shouldUncomment = nonBlankLines.every(line => line.content.startsWith('//'));
  const edits: TextEdit[] = [];

  nonBlankLines.forEach(line => {
    if (shouldUncomment) {
      const markerEnd = line.contentStart + (line.content[2] === ' ' ? 3 : 2);
      edits.push({ start: line.contentStart, end: markerEnd, text: '' });
      return;
    }
    edits.push({ start: line.contentStart, end: line.contentStart, text: '// ' });
  });

  const nextValue = [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((text, edit) => `${text.slice(0, edit.start)}${edit.text}${text.slice(edit.end)}`, value);

  return {
    value: nextValue,
    selectionStart: mapOffsetThroughEdits(start, edits),
    selectionEnd: mapOffsetThroughEdits(end, edits),
    commented: !shouldUncomment
  };
}

function collectLines(value: string, start: number, end: number) {
  const lines: Array<{ contentStart: number; content: string; lineNumber: number }> = [];
  let lineStart = start;

  while (lineStart <= end) {
    const lineBreak = value.indexOf('\n', lineStart);
    const lineEnd = lineBreak === -1 || lineBreak > end ? end : lineBreak;
    const rawLine = value.slice(lineStart, lineEnd).replace(/\r$/u, '');
    const indentationLength = rawLine.match(/^[\t ]*/u)?.[0].length ?? 0;
    lines.push({
      contentStart: lineStart + indentationLength,
      content: rawLine.slice(indentationLength),
      lineNumber: value.slice(0, lineStart).split('\n').length
    });
    if (lineBreak === -1 || lineBreak >= end) break;
    lineStart = lineBreak + 1;
  }

  return lines;
}

function mapOffsetThroughEdits(offset: number, edits: TextEdit[]) {
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
