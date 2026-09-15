import { scanBeginnerCodePrefix } from './beginnerCompletionContext';
import { normalizeIdentifier } from './parser';
import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from './textBlock';
import type { LingCppMethod, LingCppProgram, LingCppProjectFunctionLibrary } from './types';

export interface BeginnerProcedureCall {
  name: string;
  start: number;
  end: number;
}

export interface BeginnerProcedureDefinition {
  className: string;
  method: LingCppMethod;
}

export interface BeginnerLibraryCall {
  libraryName: string;
  functionName: string;
  start: number;
  end: number;
}

export interface BeginnerFunctionLibraryDefinition {
  libraryName: string;
  filePath: string;
  method: LingCppMethod;
}

const PROCEDURE_IDENTIFIER_PATTERN = /[A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*/gu;
// 「库名.功能名(」限定调用：光标落在库名或功能名任一段都应能识别。
const LIBRARY_QUALIFIED_CALL_PATTERN = /([A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*)\s*\.\s*([A-Za-z_\u3400-\u9fff][A-Za-z0-9_\u3400-\u9fff]*)\s*[（(]/gu;

interface CursorLine {
  line: string;
  lineStart: number;
}

function readCursorLine(value: string, cursor: number): CursorLine {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const previousNewline = safeCursor > 0 ? value.lastIndexOf('\n', safeCursor - 1) : -1;
  const lineStart = previousNewline + 1;
  const nextNewline = value.indexOf('\n', safeCursor);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  return { line: value.slice(lineStart, lineEnd), lineStart };
}

/** 光标行是否落在多行文本块（开始行/内容行/结束标记）内——块内不做跳转识别。 */
function isCursorLineInTextBlock(value: string, lineStart: number): boolean {
  const lines = value.split('\n');
  return collectLingCppTextBlockLines(
    scanLingCppTextBlockRanges(lines),
    lines.length
  ).has(value.slice(0, lineStart).split('\n').length);
}

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
  if (isCursorLineInTextBlock(value, lineStart)) return null;

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

/** 识别光标处的「库名.功能名(」功能库限定调用：光标落在库名或功能名上均可。
 * 行首 `@` 的内嵌 C++ 行是原生成员调用，明确排除（规则手册功能库章节）。 */
export function getBeginnerLibraryCallAtCursor(
  value: string,
  cursor: number,
  libraries: ReadonlyArray<LingCppProjectFunctionLibrary>
): BeginnerLibraryCall | null {
  if (libraries.length === 0) return null;
  const knownCalls = new Map<string, { libraryName: string; functionName: string }>();
  libraries.forEach(library => {
    library.methods.forEach(method => {
      knownCalls.set(
        `${normalizeIdentifier(library.name)}.${normalizeIdentifier(method.name)}`,
        { libraryName: library.name, functionName: method.name }
      );
    });
  });
  if (knownCalls.size === 0) return null;

  const { line, lineStart } = readCursorLine(value, cursor);
  const column = Math.max(0, Math.min(cursor, value.length)) - lineStart;
  if (line.trimStart().startsWith('@')) return null;
  if (isCursorLineInTextBlock(value, lineStart)) return null;

  for (const match of line.matchAll(LIBRARY_QUALIFIED_CALL_PATTERN)) {
    const libraryStart = match.index ?? 0;
    const libraryName = match[1] || '';
    const functionName = match[2] || '';
    const callEnd = libraryStart + match[0].length;
    if (column < libraryStart || column > callEnd) continue;

    const known = knownCalls.get(
      `${normalizeIdentifier(libraryName)}.${normalizeIdentifier(functionName)}`
    );
    if (!known) continue;

    const prefixSyntax = scanBeginnerCodePrefix(line.slice(0, libraryStart));
    if (prefixSyntax.isInsideString || prefixSyntax.isInsideComment) return null;

    return {
      libraryName: known.libraryName,
      functionName: known.functionName,
      start: lineStart + libraryStart,
      end: lineStart + callEnd
    };
  }

  return null;
}

export function resolveBeginnerFunctionLibraryDefinition(
  libraries: ReadonlyArray<LingCppProjectFunctionLibrary>,
  libraryName: string,
  functionName: string
): BeginnerFunctionLibraryDefinition | undefined {
  const library = libraries.find(item =>
    normalizeIdentifier(item.name) === normalizeIdentifier(libraryName)
  );
  const method = library?.methods.find(item =>
    normalizeIdentifier(item.name) === normalizeIdentifier(functionName)
  );
  if (!library || !method) return undefined;
  return { libraryName: library.name, filePath: library.filePath, method };
}
