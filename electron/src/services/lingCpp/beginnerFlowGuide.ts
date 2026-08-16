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
