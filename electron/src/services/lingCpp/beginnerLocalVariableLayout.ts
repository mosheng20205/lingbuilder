import {
  BeginnerFlowGuideTrack,
  formatBeginnerFlowIndentation,
  getBeginnerIfFlowGuideRows
} from './beginnerFlowGuide';
import { LingCppLocalVariable, LingCppMethod, LingCppStatement } from './types';

export type BeginnerMethodBodySegment =
  | {
      kind: 'code';
      id: string;
      sourceLine: number;
      statementStartIndex: number;
      statements: LingCppStatement[];
    }
  | {
      kind: 'locals';
      id: string;
      sourceLine: number;
      locals: LingCppLocalVariable[];
    };

type MethodBodyEntry =
  | { kind: 'code'; line: number; statement: LingCppStatement }
  | { kind: 'locals'; line: number; local: LingCppLocalVariable };

/**
 * Keeps the beginner surface in the same source order as the .lcpp file.
 * Adjacent local declarations form one foldable table; code between declarations
 * remains an independently editable code segment.
 */
export function getBeginnerMethodBodySegments(method: LingCppMethod): BeginnerMethodBodySegment[] {
  const entries: MethodBodyEntry[] = [
    ...method.statements.map(statement => ({ kind: 'code' as const, line: statement.line, statement })),
    ...(method.locals || []).map(local => ({ kind: 'locals' as const, line: local.line, local }))
  ].sort((left, right) => left.line - right.line);

  if (entries.length === 0) {
    return [{
      kind: 'code',
      id: 'code:empty',
      sourceLine: method.line + 1,
      statementStartIndex: 0,
      statements: []
    }];
  }

  const segments: BeginnerMethodBodySegment[] = [];
  let statementIndex = 0;

  entries.forEach(entry => {
    const previous = segments.at(-1);
    if (entry.kind === 'code') {
      if (previous?.kind === 'code') {
        previous.statements.push(entry.statement);
      } else {
        segments.push({
          kind: 'code',
          id: `code:${entry.line}`,
          sourceLine: entry.line,
          statementStartIndex: statementIndex,
          statements: [entry.statement]
        });
      }
      statementIndex += 1;
      return;
    }

    if (previous?.kind === 'locals') {
      previous.locals.push(entry.local);
    } else {
      segments.push({
        kind: 'locals',
        id: `locals:${entry.local.name}`,
        sourceLine: entry.line,
        locals: [entry.local]
      });
    }
  });

  // A method ending in local declarations still needs a writable body surface.
  // This empty segment maps to the method end, so AST writeback keeps every
  // declaration before code entered after the table.
  const lastSegment = segments.at(-1);
  if (lastSegment?.kind === 'locals') {
    const lastLocal = lastSegment.locals.at(-1);
    segments.push({
      kind: 'code',
      id: 'code:trailing',
      sourceLine: (lastLocal?.line || method.line) + 1,
      statementStartIndex: statementIndex,
      statements: []
    });
  }

  return segments;
}

/**
 * Resolves the statement slot represented by the caret row in a beginner code
 * editor. The returned index points at the source row that must move down when a
 * local declaration is inserted. A trailing editor row points at the method end.
 */
export function getBeginnerLocalInsertStatementIndex(
  editorValue: string,
  selectionStart: number,
  statementStartIndex = 0
): number {
  const safeSelectionStart = Math.max(0, Math.min(selectionStart, editorValue.length));
  const caretLineIndex = editorValue.slice(0, safeSelectionStart).split('\n').length - 1;
  return Math.max(0, statementStartIndex) + caretLineIndex;
}

export type BeginnerLocalInsertShortcutKind = 'variable' | 'constant';

/** Ctrl/Command+L or B remains detectable while a Chinese IME reports key=Process. */
export function getBeginnerLocalInsertShortcutKind(event: {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): BeginnerLocalInsertShortcutKind | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null;
  const key = event.key.toLocaleLowerCase();
  if (key === 'l' || event.code === 'KeyL') return 'variable';
  if (key === 'b' || event.code === 'KeyB') return 'constant';
  return null;
}

export function isBeginnerLocalInsertShortcut(event: {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
}): boolean {
  return getBeginnerLocalInsertShortcutKind(event) === 'variable';
}

export interface BeginnerLocalAnchorLayout {
  /** Leading whitespace columns of the declaration row as rendered in the body. */
  indentColumns: number;
  /** Flow rails that must continue through the declaration table rows. */
  tracks: BeginnerFlowGuideTrack[];
}

/**
 * A local declaration table sits between two code segments, so neither segment's
 * per-segment flow parse can see the blocks enclosing the declaration. This
 * merges statements and declaration lines in source order, formats them with the
 * same rules as the rendered body, and reports the declaration row's own indent
 * columns plus its enclosing flow tracks, so the canvas can indent the table to
 * the declaration level and draw the 如果/循环 rails through the table rows.
 */
export function getBeginnerLocalAnchorLayout(
  method: LingCppMethod,
  firstLocalLine: number,
  sourceLines: string[]
): BeginnerLocalAnchorLayout {
  const meaningfulStatements = method.statements.filter(statement => statement.text.trim());
  const baseIndentLength = meaningfulStatements.reduce(
    (minimum, statement) => Math.min(minimum, statement.indent.length),
    Number.POSITIVE_INFINITY
  );
  const baseIndent = Number.isFinite(baseIndentLength) ? baseIndentLength : 0;
  const rows = [
    ...method.statements.map(statement => ({
      line: statement.line,
      text: `${statement.indent.slice(Math.min(baseIndent, statement.indent.length))}${statement.text}`
    })),
    ...(method.locals || []).map(local => {
      const rawLine = sourceLines[Math.max(0, (local.line || 1) - 1)] || '';
      const indent = rawLine.match(/^\s*/u)?.[0] || '';
      return {
        line: local.line || 0,
        text: `${indent.slice(Math.min(baseIndent, indent.length))}${rawLine.trim()}`
      };
    })
  ].sort((left, right) => left.line - right.line);
  const formatted = formatBeginnerFlowIndentation(rows.map(row => row.text));
  const flowRows = getBeginnerIfFlowGuideRows(formatted);
  const anchorIndex = rows.findIndex(row => row.line === firstLocalLine);
  if (anchorIndex < 0) return { indentColumns: 0, tracks: [] };
  return {
    indentColumns: formatted[anchorIndex].match(/^\s*/u)?.[0].length || 0,
    tracks: flowRows[anchorIndex]?.tracks || []
  };
}
