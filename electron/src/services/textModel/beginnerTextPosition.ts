import type { TextPosition } from './types';

export function textPositionAtOffset(value: string, rawOffset: number): TextPosition {
  const offset = Math.max(0, Math.min(value.length, Number.isFinite(rawOffset) ? Math.trunc(rawOffset) : 0));
  const prefix = value.slice(0, offset);
  const lines = prefix.split(/\r\n|\r|\n/u);
  return {
    line: Math.max(1, lines.length),
    column: (lines[lines.length - 1]?.length || 0) + 1
  };
}

export function inferBeginnerBodyStartColumn(
  sourceLines: readonly string[],
  methodLine: number,
  statementLines: readonly number[]
): number {
  const existingStatement = statementLines
    .map(line => sourceLines[Math.max(0, line - 1)] || '')
    .find(line => line.trim());
  if (existingStatement) return (existingStatement.match(/^\s*/u)?.[0].length || 0) + 1;
  const declaration = sourceLines[Math.max(0, methodLine - 1)] || '';
  return (declaration.match(/^\s*/u)?.[0].length || 0) + 5;
}

export function getBeginnerBodySourceColumns(
  statements: readonly { indent: string; text: string }[],
  fallbackStartColumn: number
): number[] {
  const fallback = Math.max(1, Math.trunc(fallbackStartColumn) || 1);
  return statements.map(statement => (
    statement.text.trim()
      ? statement.indent.length + 1
      : fallback
  ));
}

/** Converts a method-body textarea offset into the complete source document. */
export function mapBeginnerBodyTextPosition(
  value: string,
  rawOffset: number,
  sourceLines: readonly number[],
  fallbackStartLine: number,
  sourceColumns: readonly number[] = [],
  fallbackStartColumn = 1
): TextPosition {
  const local = textPositionAtOffset(value, rawOffset);
  const localIndex = local.line - 1;
  const localLineCount = value.split(/\r\n|\r|\n/u).length;
  if (sourceLines.length !== localLineCount) {
    return {
      line: Math.max(1, Math.trunc(fallbackStartLine) || 1) + localIndex,
      column: Math.max(1, Math.trunc(fallbackStartColumn) || 1) + local.column - 1
    };
  }
  const exactLine = sourceLines[localIndex];
  const exactColumn = sourceColumns[localIndex];
  if (Number.isInteger(exactLine) && exactLine > 0) {
    return {
      line: exactLine,
      column: (Number.isInteger(exactColumn) && exactColumn > 0 ? exactColumn : fallbackStartColumn) + local.column - 1
    };
  }

  for (let index = Math.min(localIndex - 1, sourceLines.length - 1); index >= 0; index -= 1) {
    const knownLine = sourceLines[index];
    if (Number.isInteger(knownLine) && knownLine > 0) {
      const knownColumn = sourceColumns[index];
      return {
        line: knownLine + (localIndex - index),
        column: (Number.isInteger(knownColumn) && knownColumn > 0 ? knownColumn : fallbackStartColumn) + local.column - 1
      };
    }
  }

  return {
    line: Math.max(1, Math.trunc(fallbackStartLine) || 1) + localIndex,
    column: Math.max(1, Math.trunc(fallbackStartColumn) || 1) + local.column - 1
  };
}
