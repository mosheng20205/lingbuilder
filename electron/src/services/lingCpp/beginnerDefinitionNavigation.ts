import { scanBeginnerCodePrefix } from './beginnerCompletionContext';
import { normalizeIdentifier } from './parser';
import type { LingCppMethod, LingCppProgram } from './types';

export interface BeginnerProcedureCall {
  name: string;
  start: number;
  end: number;
}

export interface BeginnerProcedureDefinition {
  className: string;
  method: LingCppMethod;
}

const PROCEDURE_IDENTIFIER_PATTERN = /[A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*/gu;

export function getBeginnerProcedureCallAtCursor(
  value: string,
  cursor: number,
  availableProcedureNames: Iterable<string>
): BeginnerProcedureCall | null {
  const availableNames = new Set(
    Array.from(availableProcedureNames, name => normalizeIdentifier(name)).filter(Boolean)
  );
  if (availableNames.size === 0) return null;

  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const previousNewline = safeCursor > 0 ? value.lastIndexOf('\n', safeCursor - 1) : -1;
  const lineStart = previousNewline + 1;
  const nextNewline = value.indexOf('\n', safeCursor);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  const line = value.slice(lineStart, lineEnd);
  const column = safeCursor - lineStart;

  for (const match of line.matchAll(PROCEDURE_IDENTIFIER_PATTERN)) {
    const columnStart = match.index ?? 0;
    const name = match[0];
    const columnEnd = columnStart + name.length;
    if (column < columnStart || column > columnEnd) continue;
    if (!availableNames.has(normalizeIdentifier(name))) continue;

    const suffix = line.slice(columnEnd);
    const prefix = line.slice(0, columnStart);
    const isProcedureCall = /^\s*[（(]/u.test(suffix);
    const isHandlerReference = /&\s*$/u.test(prefix);
    if (!isProcedureCall && !isHandlerReference) continue;

    const prefixSyntax = scanBeginnerCodePrefix(prefix);
    if (prefixSyntax.isInsideString || prefixSyntax.isInsideComment) return null;

    return {
      name,
      start: lineStart + columnStart,
      end: lineStart + columnEnd
    };
  }

  return null;
}

export function resolveBeginnerProcedureDefinition(
  program: LingCppProgram,
  callerClassName: string,
  procedureName: string
): BeginnerProcedureDefinition | undefined {
  const normalizedName = normalizeIdentifier(procedureName);
  const matches = program.classes.flatMap(cls =>
    cls.methods
      .filter(method => normalizeIdentifier(method.name) === normalizedName)
      .map(method => ({ className: cls.name, method }))
  );
  const sameClassMatch = matches.find(match =>
    normalizeIdentifier(match.className) === normalizeIdentifier(callerClassName)
  );

  if (sameClassMatch) return sameClassMatch;
  return matches.length === 1 ? matches[0] : undefined;
}
