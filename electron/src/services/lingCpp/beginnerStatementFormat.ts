import { collectLingCppTextBlockLines, scanLingCppTextBlockRanges } from './textBlock';

export interface BeginnerStatementFormatResult {
  value: string;
  cursor: number;
  changed: boolean;
}

/**
 * 新手正文编辑器在行尾按回车提交语句时，规范化赋值运算符两侧的空格：
 * `数值=到整数(编辑框1.内容)` 格式化为 `数值 = 到整数(编辑框1.内容)`。
 * 只处理语句级的独立赋值等号：字符串、注释、括号内（参数默认值、循环条件）
 * 以及 ==、!=、<=、>=、:= 等复合运算符中的等号一律保持原样。
 */
export function formatBeginnerAssignmentLine(line: string): string {
  const trimmedStart = line.trimStart();
  if (!trimmedStart || trimmedStart.startsWith('//') || trimmedStart.startsWith("'") || trimmedStart.startsWith('@')) {
    return line;
  }

  let inDoubleQuote = false;
  let inChineseQuote = false;
  let escaped = false;
  let depth = 0;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (inDoubleQuote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inDoubleQuote = false;
      continue;
    }
    if (inChineseQuote) {
      if (char === '”') inChineseQuote = false;
      continue;
    }
    if (char === '"') {
      inDoubleQuote = true;
      continue;
    }
    if (char === '“') {
      inChineseQuote = true;
      continue;
    }
    if (char === '/' && next === '/') break;
    if (char === '(' || char === '（') {
      depth += 1;
      continue;
    }
    if (char === ')' || char === '）') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if ((char === '=' || char === '＝') && depth === 0 && next !== '=' && next !== '＝') {
      const previous = line[index - 1];
      if (previous && (/[=!<>:]/u.test(previous) || previous === '＝')) continue;
      const lhs = line.slice(0, index).trimEnd();
      const rhs = line.slice(index + 1).trimStart();
      if (!lhs || !rhs) return line;
      return `${lhs} = ${rhs}`;
    }
  }

  return line;
}

/**
 * 光标位于行尾（该行输入完毕）时格式化光标所在行并同步移动光标；
 * 光标在行中间时按回车是拆行操作，不做任何改写。
 */
export function formatBeginnerAssignmentAtCursor(value: string, cursor: number): BeginnerStatementFormatResult {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const lineStart = value.lastIndexOf('\n', Math.max(0, safeCursor - 1)) + 1;
  const nextNewline = value.indexOf('\n', safeCursor);
  const lineEnd = nextNewline >= 0 ? nextNewline : value.length;
  if (safeCursor !== lineEnd) return { value, cursor: safeCursor, changed: false };

  const line = value.slice(lineStart, lineEnd);
  // 多行文本块的开始行/内容行/结束标记不参与赋值格式化（内容按 raw 语义原样保留）。
  const blockLines = collectLingCppTextBlockLines(
    scanLingCppTextBlockRanges(value.split('\n')),
    value.split('\n').length
  );
  if (blockLines.has(value.slice(0, lineStart).split('\n').length)) {
    return { value, cursor: safeCursor, changed: false };
  }
  const formatted = formatBeginnerAssignmentLine(line);
  if (formatted === line) return { value, cursor: safeCursor, changed: false };

  return {
    value: `${value.slice(0, lineStart)}${formatted}${value.slice(lineEnd)}`,
    cursor: lineStart + formatted.length,
    changed: true
  };
}
