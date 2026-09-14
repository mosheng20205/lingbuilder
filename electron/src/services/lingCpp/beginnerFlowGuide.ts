import {
  LingCppControlFlowFamily,
  parseLingCppControlFlowLine
} from './controlFlow';

export type BeginnerIfBranchKind =
  | 'if'
  | 'elseif'
  | 'else'
  | 'select'
  | 'case'
  | 'default'
  | 'loop'
  | 'try'
  | 'catch'
  | 'finally';

export interface BeginnerIfBranch {
  kind: BeginnerIfBranchKind;
  line: number;
  text: string;
}

export interface BeginnerIfBlock {
  family: LingCppControlFlowFamily;
  startLine: number;
  endLine: number;
  parent?: BeginnerIfBlock;
  branches: BeginnerIfBranch[];
}

export interface BeginnerFlowGuideRow {
  kind: BeginnerIfBranchKind | 'end' | 'break' | 'continue' | 'throw' | undefined;
  inBlock: boolean;
  mark: '┌' | '├' | '└' | '│' | '↳' | '';
  tracks: BeginnerFlowGuideTrack[];
}

/**
 * A single visible rail in a beginner flow guide. The first rail stays in the
 * fixed flow column; nested rails are rendered beside their indented code.
 */
export interface BeginnerFlowGuideTrack {
  depth: number;
  mark: BeginnerFlowGuideRow['mark'];
}

function beginnerFlowLineKind(line: string): BeginnerFlowGuideRow['kind'] {
  const control = parseLingCppControlFlowLine(line);
  if (!control) return undefined;
  if (control.role === 'end') return 'end';
  if (control.role === 'break' || control.role === 'continue' || control.role === 'throw') return control.role;
  if (control.role === 'start') {
    if (control.family === 'if') return 'if';
    if (control.family === 'select') return 'select';
    if (control.family === 'try') return 'try';
    return 'loop';
  }
  if (control.branchKind === 'elseif') return 'elseif';
  if (control.branchKind === 'else') return 'else';
  if (control.branchKind === 'case') return 'case';
  if (control.branchKind === 'default') return 'default';
  if (control.branchKind === 'catch') return 'catch';
  if (control.branchKind === 'finally') return 'finally';
  return undefined;
}

// Retained for compatibility with callers/tests; it now recognizes every
// structured control-flow line, not only if/else.
export function beginnerIfLineKind(line: string): BeginnerFlowGuideRow['kind'] {
  return beginnerFlowLineKind(line);
}

export function parseBeginnerIfBlocks(lines: string[]): BeginnerIfBlock[] {
  const blocks: BeginnerIfBlock[] = [];
  const stack: BeginnerIfBlock[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const control = parseLingCppControlFlowLine(line);
    const kind = beginnerFlowLineKind(line);
    if (!control || !kind || control.role === 'break' || control.role === 'continue' || control.role === 'throw') return;

    if (control.role === 'end') {
      const current = stack.at(-1);
      if (current?.family === control.family) {
        current.endLine = lineNumber;
        stack.pop();
      }
      return;
    }

    if (control.role === 'branch') {
      const current = stack.at(-1);
      if (current?.family === control.family) {
        current.branches.push({ kind: kind as BeginnerIfBranchKind, line: lineNumber, text: line.trim() });
      }
      return;
    }

    const parent = stack.at(-1);
    const block: BeginnerIfBlock = {
      family: control.family || 'if',
      startLine: lineNumber,
      endLine: lines.length,
      parent,
      branches: [{ kind: kind as BeginnerIfBranchKind, line: lineNumber, text: line.trim() }]
    };
    blocks.push(block);
    stack.push(block);
  });

  return blocks;
}

export function getBeginnerIfFlowGuideRows(lines: string[]): BeginnerFlowGuideRow[] {
  const blocks = parseBeginnerIfBlocks(lines);
  const stack: LingCppControlFlowFamily[] = [];

  return lines.map((line, index) => {
    const lineNumber = index + 1;
    const kind = beginnerFlowLineKind(line);
    const control = parseLingCppControlFlowLine(line);
    const inBlock = blocks.some(block => lineNumber >= block.startLine && lineNumber <= block.endLine);
    const mark =
      kind === 'if' || kind === 'select' || kind === 'loop' || kind === 'try' ? '┌' :
      kind === 'elseif' || kind === 'else' || kind === 'case' || kind === 'default' || kind === 'catch' || kind === 'finally' ? '├' :
      kind === 'end' ? '└' :
      kind === 'break' || kind === 'continue' || kind === 'throw' ? '↳' :
      inBlock ? '│' : '';
    const tracks: BeginnerFlowGuideTrack[] = stack.map((_, depth) => ({ depth, mark: '│' }));

    if (control?.role === 'start' && control.family) {
      tracks.push({ depth: stack.length, mark: '┌' });
      stack.push(control.family);
    } else if (control?.role === 'branch' && control.family && stack.at(-1) === control.family) {
      tracks[stack.length - 1] = { depth: stack.length - 1, mark: '├' };
    } else if (control?.role === 'end' && control.family && stack.at(-1) === control.family) {
      tracks[stack.length - 1] = { depth: stack.length - 1, mark: '└' };
      stack.pop();
    } else if (control?.role === 'break' || control?.role === 'continue' || control?.role === 'throw') {
      tracks.push({ depth: stack.length, mark: '↳' });
    }

    return {
      kind,
      inBlock,
      mark,
      tracks
    };
  });
}

/**
 * Formats a method body relative to its declaration indentation. Control-flow
 * markers are sufficient to derive nesting, so a partially typed beginner
 * block still remains readable before the user manually adjusts every line.
 */
export function formatBeginnerFlowIndentation(lines: string[]): string[] {
  let depth = 0;

  return lines.map(line => {
    const text = line.trim();
    const control = parseLingCppControlFlowLine(text);
    const sourceIndent = line.match(/^\s*/u)?.[0] || '';
    const lineDepth = control?.role === 'end' || control?.role === 'branch'
      ? Math.max(0, depth - 1)
      : depth;
    const requiredIndent = lineDepth * 4;
    const indent = sourceIndent.length >= requiredIndent
      ? sourceIndent
      : `${sourceIndent}${' '.repeat(requiredIndent - sourceIndent.length)}`;

    // Keep a writable blank row aligned with its surrounding block. Without
    // this, a multiline completion leaves its body line at column zero until
    // the user presses Enter again.
    if (!text) return indent;

    if (control?.role === 'end') depth = Math.max(0, depth - 1);
    if (control?.role === 'start') depth += 1;

    return `${indent}${text}`;
  });
}

/**
 * Returns the indentation for a line inserted at the current cursor. The
 * calculation deliberately uses only text before the cursor, so an unfinished
 * statement to the right never changes the indentation of the newly created
 * line.
 */
export function getBeginnerNextLineIndentation(value: string, cursor: number): string {
  const beforeCursor = value.slice(0, Math.max(0, Math.min(cursor, value.length)));
  const lines = beforeCursor.split(/\r?\n/u);
  const currentLine = lines.at(-1) || '';
  let depth = 0;

  lines.forEach(line => {
    const control = parseLingCppControlFlowLine(line);
    if (control?.role === 'end') depth = Math.max(0, depth - 1);
    if (control?.role === 'start') depth += 1;
  });

  const currentIndent = currentLine.match(/^\s*/u)?.[0] || '';
  const requiredIndentLength = depth * 4;
  return currentIndent.length >= requiredIndentLength
    ? currentIndent
    : `${currentIndent}${' '.repeat(requiredIndentLength - currentIndent.length)}`;
}

export const findBeginnerIfBlocksAtLine = (blocks: BeginnerIfBlock[], line: number) =>
  blocks
    .filter(block => line >= block.startLine && line <= block.endLine)
    .sort((left, right) => {
      const leftSpan = left.endLine - left.startLine;
      const rightSpan = right.endLine - right.startLine;
      return leftSpan - rightSpan || right.startLine - left.startLine;
    });

export interface BeginnerFlowFoldSegmentSource {
  segmentId: string;
  /** Draft lines exactly as rendered for this code segment. */
  lines: string[];
  /** Index of this segment's first statement inside the flat method statement list. */
  statementStart: number;
}

export interface BeginnerCrossSegmentFlowFold {
  key: string;
  anchorSegmentId: string;
  anchorStartLine: number;
  /** First source line hidden by the fold (the row right after the anchor). */
  sourceFrom: number;
  /** Source line of the matching 结构结束 statement (inclusive). */
  sourceTo: number;
  /** Hidden statement index range in the flat method statement list. */
  statementFrom: number;
  statementTo: number;
  /** Total visible rows hidden: statements after the anchor + interleaved locals. */
  hiddenRows: number;
}

/**
 * A local-declaration table between a 流程结构 header and its 结束 line splits the
 * block across several code segments, so the per-segment fold would collapse
 * zero lines. This resolves the real extent of a collapsed block across the
 * whole method statement list so the canvas can hide the segments in between.
 */
export function getBeginnerCrossSegmentFlowFolds(
  segments: BeginnerFlowFoldSegmentSource[],
  statements: ReadonlyArray<{ line: number; text?: string }>,
  locals: ReadonlyArray<{ line?: number }>,
  collapsedKeys: ReadonlyArray<string>,
  targetKey: string
): BeginnerCrossSegmentFlowFold[] {
  if (collapsedKeys.length === 0) return [];
  const folds: BeginnerCrossSegmentFlowFold[] = [];

  segments.forEach(segment => {
    if (segment.lines.length === 0) return;
    const blocks = parseBeginnerIfBlocks(segment.lines);
    if (blocks.length === 0) return;

    // A block closed inside this segment is fully handled by the segment's own
    // fold rendering; only blocks still open at the segment end span segments.
    const closedKeys = new Set<string>();
    const openStack: Array<{ family: LingCppControlFlowFamily; startLine: number }> = [];
    segment.lines.forEach((line, index) => {
      const control = parseLingCppControlFlowLine(line);
      if (!control?.family) return;
      if (control.role === 'start') {
        openStack.push({ family: control.family, startLine: index + 1 });
      } else if (control.role === 'end' && openStack.at(-1)?.family === control.family) {
        const opened = openStack.pop();
        if (opened) closedKeys.add(`${opened.family}:${opened.startLine}`);
      }
    });

    blocks.forEach(block => {
      const key = `${targetKey}:${segment.segmentId}:${block.family}:${block.startLine}`;
      if (!collapsedKeys.includes(key)) return;
      if (closedKeys.has(`${block.family}:${block.startLine}`)) return;

      const anchorStatementIndex = Math.min(
        segment.statementStart + block.startLine - 1,
        Math.max(0, statements.length - 1)
      );
      const familyStack: LingCppControlFlowFamily[] = [block.family];
      let endIndex = statements.length - 1;
      for (let index = anchorStatementIndex + 1; index < statements.length; index += 1) {
        const control = parseLingCppControlFlowLine(statements[index]?.text || '');
        if (!control?.family) continue;
        if (control.role === 'start') {
          familyStack.push(control.family);
        } else if (control.role === 'end') {
          const matchIndex = familyStack.lastIndexOf(control.family);
          if (matchIndex < 0) continue;
          familyStack.length = matchIndex;
          if (familyStack.length === 0) {
            endIndex = index;
            break;
          }
        }
      }

      const anchorSourceLine = statements[anchorStatementIndex]?.line ?? 1;
      const endSourceLine = statements[endIndex]?.line ?? anchorSourceLine;
      const hiddenLocalCount = locals.filter(local =>
        (local.line ?? 0) > anchorSourceLine && (local.line ?? 0) <= endSourceLine
      ).length;
      folds.push({
        key,
        anchorSegmentId: segment.segmentId,
        anchorStartLine: block.startLine,
        sourceFrom: anchorSourceLine,
        sourceTo: endSourceLine,
        statementFrom: anchorStatementIndex + 1,
        statementTo: endIndex,
        hiddenRows: (endIndex - anchorStatementIndex) + hiddenLocalCount
      });
    });
  });

  return folds;
}

export const currentBeginnerBranch = (block: BeginnerIfBlock, line: number) =>
  [...block.branches]
    .sort((left, right) => left.line - right.line)
    .filter(branch => branch.line <= line)
    .at(-1) || block.branches[0];

const fallbackBranchLabel = (kind: BeginnerIfBranchKind) => ({
  if: '如果',
  elseif: '否则如果',
  else: '否则',
  select: '选择',
  case: '分支',
  default: '默认',
  loop: '循环',
  try: '尝试',
  catch: '捕获',
  finally: '最终'
})[kind];

const fallbackEndLabel = (family: LingCppControlFlowFamily) => ({
  if: '如果结束',
  select: '选择结束',
  loop: '循环结束',
  try: '尝试结束'
})[family];

export const beginnerStructureAnchors = (block: BeginnerIfBlock) => {
  const anchors = [...block.branches]
    .sort((left, right) => left.line - right.line)
    .map(branch => ({
      line: branch.line,
      label: branch.text || fallbackBranchLabel(branch.kind)
    }));
  if (block.endLine >= block.startLine) anchors.push({ line: block.endLine, label: fallbackEndLabel(block.family) });
  return anchors.filter((anchor, index, all) => all.findIndex(item => item.line === anchor.line) === index);
};
