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
