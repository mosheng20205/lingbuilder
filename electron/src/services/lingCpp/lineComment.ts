import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from './textBlock';

export interface LingCppLineCommentEdit {
  /** 1 起的行号。 */
  lineNumber: number;
  /** 1 起的列号，指向行首缩进之后的第一个字符。 */
  column: number;
  /** 要写入的文本；取消注释时为空串。 */
  text: string;
  /** 取消注释时要从 column 起删除的注释符长度（'// ' 为 3，'//' 为 2；加注释时为 0）。 */
  removedLength: number;
}

export interface LingCppLineCommentPlan {
  edits: LingCppLineCommentEdit[];
  /** true = 本次执行加注释，false = 本次执行取消注释。 */
  commented: boolean;
}

/**
 * Plans a `//` line-comment toggle over the inclusive 1-based line range.
 * 与新手编辑器 toggleBeginnerLineComment 同一行为契约：空行保持不变、
 * 多行文本块的开始/内容/结束行不参与切换、仅当候选行全部已是 `//` 注释时
 * 才整体取消，否则整体加注释。
 */
export function planLingCppLineCommentToggle(lines: string[], startLine: number, endLine: number): LingCppLineCommentPlan | null {
  const from = Math.max(1, Math.trunc(startLine));
  const to = Math.min(lines.length, Math.trunc(endLine));
  if (from > to) return null;
  const blockConsumed = collectLingCppTextBlockLines(scanLingCppTextBlockRanges(lines), lines.length);
  const candidates: Array<{ lineNumber: number; column: number; content: string }> = [];
  for (let lineNumber = from; lineNumber <= to; lineNumber += 1) {
    const rawLine = lines[lineNumber - 1] || '';
    const indentationLength = rawLine.match(/^[\t ]*/u)?.[0].length ?? 0;
    const content = rawLine.slice(indentationLength);
    if (!content.trim() || blockConsumed.has(lineNumber)) continue;
    candidates.push({ lineNumber, column: indentationLength + 1, content });
  }
  if (candidates.length === 0) return null;
  const shouldUncomment = candidates.every(candidate => candidate.content.startsWith('//'));
  return {
    edits: candidates.map(candidate => shouldUncomment
      ? {
        lineNumber: candidate.lineNumber,
        column: candidate.column,
        text: '',
        removedLength: candidate.content[2] === ' ' ? 3 : 2
      }
      : { lineNumber: candidate.lineNumber, column: candidate.column, text: '// ', removedLength: 0 }),
    commented: !shouldUncomment
  };
}

/** Maps a 1-based column on the edited line through the planned comment edit so caret/selection survive the toggle. */
export function mapColumnThroughLingCppLineCommentEdits(plan: LingCppLineCommentPlan, lineNumber: number, column: number): number {
  const edit = plan.edits.find(item => item.lineNumber === lineNumber);
  if (!edit || column <= edit.column) return column;
  if (column < edit.column + edit.removedLength) return edit.column + edit.text.length;
  return column + edit.text.length - edit.removedLength;
}
