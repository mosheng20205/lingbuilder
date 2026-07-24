export interface BeginnerCompletionContext {
  token: string;
  isBlankLine: boolean;
  isCommandStart: boolean;
  isInsideString: boolean;
  isInsideComment: boolean;
  parenDepth: number;
  isWindowTargetContext: boolean;
  isWindowPlacementContext: boolean;
}

export interface BeginnerCommandTokenAtCursor {
  token: string;
  lineIndex: number;
  columnStart: number;
}

export function scanBeginnerCodePrefix(text: string) {
  let isInsideDoubleString = false;
  let isInsideChineseString = false;
  let isEscaped = false;
  let isInsideComment = false;
  let parenDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (!isInsideDoubleString && !isInsideChineseString && char === '/' && next === '/') {
      isInsideComment = true;
      break;
    }
    if (isInsideDoubleString) {
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (char === '\\') {
        isEscaped = true;
        continue;
      }
      if (char === '"') isInsideDoubleString = false;
      continue;
    }
    if (isInsideChineseString) {
      if (char === '”') isInsideChineseString = false;
      continue;
    }
    if (char === '"') {
      isInsideDoubleString = true;
      continue;
    }
    if (char === '“') {
      isInsideChineseString = true;
      continue;
    }
    if (char === '(' || char === '（') {
      parenDepth += 1;
      continue;
    }
    if ((char === ')' || char === '）') && parenDepth > 0) parenDepth -= 1;
  }

  return {
    isInsideString: isInsideDoubleString || isInsideChineseString,
    isInsideComment,
    parenDepth
  };
}

export function getBeginnerCompletionContext(value: string, cursor: number): BeginnerCompletionContext {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const lineStart = value.lastIndexOf('\n', Math.max(0, safeCursor - 1)) + 1;
  const linePrefix = value.slice(lineStart, safeCursor);
  const token = linePrefix.match(/[a-zA-Z0-9_@.\u4e00-\u9fa5]+$/u)?.[0] || '';
  const beforeToken = linePrefix.slice(0, linePrefix.length - token.length);
  const syntax = scanBeginnerCodePrefix(linePrefix);
  const isWindowTargetContext = /(?:^|\s)(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*["“][^"”\n]*$/u.test(linePrefix);
  const isWindowPlacementContext = /(?:^|\s)(?:打开窗口|窗口_打开|载入窗口|载入新窗口)\s*[（(]\s*(?:L)?["“][^"”\n]*["”]\s*[,，]\s*(?:(?:L)?["“][^"”\n]*|[\w\u4e00-\u9fa5-]*)$/u.test(linePrefix);

  return {
    token,
    isBlankLine: linePrefix.trim().length === 0,
    isCommandStart: beforeToken.trim().length === 0,
    isWindowTargetContext,
    isWindowPlacementContext,
    ...syntax
  };
}

export function shouldShowBeginnerCompletion(context: BeginnerCompletionContext, includeAll: boolean): boolean {
  if (context.isWindowTargetContext || context.isWindowPlacementContext) return true;
  if (context.isInsideString || context.isInsideComment) return false;
  if (context.parenDepth > 0) return includeAll || context.token.length > 0;
  if (includeAll) return context.isBlankLine || context.isCommandStart;
  return context.isCommandStart && context.token.length > 0;
}

export function getBeginnerCompletionToken(value: string, cursor: number): string {
  return getBeginnerCompletionContext(value, cursor).token;
}

export function getBeginnerCommandTokenAtCursor(
  value: string,
  cursor: number,
  availableCommands: ReadonlySet<string>
): BeginnerCommandTokenAtCursor | null {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const previousNewline = safeCursor > 0 ? value.lastIndexOf('\n', safeCursor - 1) : -1;
  const lineStart = previousNewline + 1;
  const nextNewline = value.indexOf('\n', safeCursor);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  const line = value.slice(lineStart, lineEnd);
  const column = safeCursor - lineStart;
  const tokenPattern = /[a-zA-Z0-9_@.．\u4e00-\u9fa5]+/gu;

  for (const match of line.matchAll(tokenPattern)) {
    const columnStart = match.index ?? 0;
    const token = match[0];
    const columnEnd = columnStart + token.length;
    if (column < columnStart || column > columnEnd || !availableCommands.has(token)) continue;

    const prefixSyntax = scanBeginnerCodePrefix(line.slice(0, columnStart));
    if (prefixSyntax.isInsideString || prefixSyntax.isInsideComment) return null;

    return {
      token,
      lineIndex: value.slice(0, lineStart).split('\n').length - 1,
      columnStart
    };
  }

  return null;
}
