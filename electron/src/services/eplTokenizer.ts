/**
 * EPL Token-level Syntax Tokenizer
 *
 * Splits a Chinese EPL statement line into individually colorable tokens.
 * This enables token-level syntax highlighting similar to Visual Studio.
 */

// ── Token Types ──────────────────────────────────────────────────────────────

export type EplTokenKind =
  | 'keyword'     // 中文流程控制关键字 (如果, 否则, 判断, 循环...)
  | 'command'     // 中文系统/基本命令 (信息框, 调试输出, 返回, 结束...)
  | 'string'      // 引号字符串
  | 'comment'     // 注释 (以 ' 或 // 开头)
  | 'number'      // 数字字面量
  | 'operator'    // 运算符和标点
  | 'variable'    // 已声明的变量名
  | 'function'    // 子程序名 / 函数调用
  | 'boolean'     // 真 / 假
  | 'identifier'  // 其他标识符
  | 'whitespace'  // 空白
  | 'dot'         // 前导点号 (用于 .子程序 等)
  | 'paren'       // 括号 ( ) （ ）
  | 'comma';      // 逗号 , ，

export interface EplToken {
  kind: EplTokenKind;
  text: string;
  start: number;  // character offset in original string
}

// ── Keyword Sets ─────────────────────────────────────────────────────────────

const EPL_KEYWORDS = new Set([
  '如果', '如果真', '否则', '否则如果', '如果结束',
  '判断', '判断结束',
  '判断循环首', '判断循环尾',
  '循环判断首', '循环判断尾',
  '计次循环首', '计次循环尾',
  '变量循环首', '变量循环尾',
  '枚举循环首', '枚举循环尾',
  '跳出循环', '到循环尾',
  '尝试', '捕获',
]);

const EPL_COMMANDS = new Set([
  '信息框', '调试输出', '输出调试文本',
  '载入可视化设计', '读取配置项', '取运行目录',
  '返回', '结束',
  '到文本', '到整数', '到小数', '到逻辑',
  '取文本长度', '取文本左边', '取文本右边', '取文本中间',
  '寻找文本', '替换文本', '删全部空', '分割文本',
  '取数组成员数', '加入成员', '删除成员', '清除数组',
  '取随机数', '取绝对值', '取整', '四舍五入',
  '延时', '取启动时间',
  '写到文件', '读入文件', '文件是否存在', '创建目录',
  '写配置项', '取现行时间',
  '窗口_取标题', '窗口_置标题',
  '窗口_显示', '窗口_隐藏', '窗口_关闭',
  '置剪辑板文本', '取剪辑板文本',
]);

const EPL_BOOLEANS = new Set(['真', '假']);

// ── Tokenizer ────────────────────────────────────────────────────────────────

/**
 * Check if a character is a Chinese character (CJK Unified Ideographs range)
 */
function isChinese(ch: string): boolean {
  const code = ch.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * Check if a character can be part of an identifier (Chinese, ASCII letter, digit, underscore)
 */
function isIdentChar(ch: string): boolean {
  return isChinese(ch) || /[a-zA-Z0-9_]/.test(ch);
}

/**
 * Check if a character is a digit
 */
function isDigit(ch: string): boolean {
  return /[0-9]/.test(ch);
}

/**
 * Check if a character is whitespace
 */
function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t';
}

/**
 * Tokenize a single EPL statement line.
 * 
 * @param text - The statement text to tokenize
 * @param knownVariables - Set of known variable names for variable highlighting
 * @param knownFunctions - Set of known subprogram/function names
 * @returns Array of tokens
 */
export function tokenizeEplStatement(
  text: string,
  knownVariables?: Set<string>,
  knownFunctions?: Set<string>
): EplToken[] {
  if (!text) return [];

  const tokens: EplToken[] = [];
  const len = text.length;
  let i = 0;

  // Check for full-line comment
  const trimmed = text.trimStart();
  const leadingSpaces = text.length - trimmed.length;

  if (trimmed.startsWith("'") || trimmed.startsWith('//')) {
    // Leading whitespace
    if (leadingSpaces > 0) {
      tokens.push({ kind: 'whitespace', text: text.slice(0, leadingSpaces), start: 0 });
    }
    // Entire remainder is a comment
    tokens.push({ kind: 'comment', text: text.slice(leadingSpaces), start: leadingSpaces });
    return tokens;
  }

  while (i < len) {
    const ch = text[i];

    // Whitespace
    if (isWhitespace(ch)) {
      const start = i;
      while (i < len && isWhitespace(text[i])) i++;
      tokens.push({ kind: 'whitespace', text: text.slice(start, i), start });
      continue;
    }

    // String literals: double quotes (ASCII and Chinese)
    if (ch === '"' || ch === '\u201c' /* " */ || ch === '\u201d' /* " */) {
      const start = i;
      const openChar = ch;
      const closeChar = openChar === '\u201c' ? '\u201d' : openChar === '\u201d' ? '\u201c' : '"';
      i++; // skip opening quote
      while (i < len && text[i] !== closeChar && text[i] !== '"' && text[i] !== '\u201c' && text[i] !== '\u201d') {
        if (text[i] === '\\') i++; // skip escaped char
        i++;
      }
      if (i < len) i++; // skip closing quote
      tokens.push({ kind: 'string', text: text.slice(start, i), start });
      continue;
    }

    // Single-quoted strings
    if (ch === "'") {
      // If we're at the start or after whitespace only, it's a comment
      const beforeText = text.slice(0, i).trim();
      if (!beforeText) {
        // Full-line comment starting with '
        tokens.push({ kind: 'comment', text: text.slice(i), start: i });
        return tokens;
      }
      // Otherwise treat as string delimiter
      const start = i;
      i++;
      while (i < len && text[i] !== "'") {
        if (text[i] === '\\') i++;
        i++;
      }
      if (i < len) i++;
      tokens.push({ kind: 'string', text: text.slice(start, i), start });
      continue;
    }

    // Numbers
    if (isDigit(ch) || (ch === '.' && i + 1 < len && isDigit(text[i + 1]))) {
      const start = i;
      // Check if previous token is an identifier (then this dot is member access, not number)
      if (ch === '.' && tokens.length > 0 && tokens[tokens.length - 1].kind === 'identifier') {
        tokens.push({ kind: 'dot', text: '.', start: i });
        i++;
        continue;
      }
      while (i < len && isDigit(text[i])) i++;
      if (i < len && text[i] === '.') {
        i++;
        while (i < len && isDigit(text[i])) i++;
      }
      tokens.push({ kind: 'number', text: text.slice(start, i), start });
      continue;
    }

    // Leading dot (for .子程序, .局部变量, or member access)
    if (ch === '.') {
      tokens.push({ kind: 'dot', text: '.', start: i });
      i++;
      continue;
    }

    // Parentheses (ASCII and Chinese)
    if (ch === '(' || ch === ')' || ch === '\uff08' /* （ */ || ch === '\uff09' /* ） */) {
      tokens.push({ kind: 'paren', text: ch, start: i });
      i++;
      continue;
    }

    // Commas (ASCII and Chinese)
    if (ch === ',' || ch === '\uff0c' /* ， */) {
      tokens.push({ kind: 'comma', text: ch, start: i });
      i++;
      continue;
    }

    // Operators: = + - * / < > ! & | ^ ~ # @
    if ('=+-*/<>!&|^~#@'.includes(ch)) {
      const start = i;
      // Handle multi-char operators: ==, !=, <=, >=, &&, ||
      if (i + 1 < len) {
        const two = ch + text[i + 1];
        if (['==', '!=', '<=', '>=', '&&', '||', '+=', '-=', '*=', '/='].includes(two)) {
          i += 2;
          tokens.push({ kind: 'operator', text: two, start });
          continue;
        }
      }
      i++;
      tokens.push({ kind: 'operator', text: ch, start });
      continue;
    }

    // Identifiers (Chinese characters, ASCII letters, digits, underscores)
    if (isIdentChar(ch)) {
      const start = i;
      while (i < len && isIdentChar(text[i])) i++;
      const word = text.slice(start, i);

      // Classify the identifier
      let kind: EplTokenKind = 'identifier';
      if (EPL_KEYWORDS.has(word)) {
        kind = 'keyword';
      } else if (EPL_COMMANDS.has(word)) {
        kind = 'command';
      } else if (EPL_BOOLEANS.has(word)) {
        kind = 'boolean';
      } else if (knownVariables?.has(word)) {
        kind = 'variable';
      } else if (knownFunctions?.has(word)) {
        kind = 'function';
      }

      tokens.push({ kind, text: word, start });
      continue;
    }

    // Any other character (Chinese punctuation, etc.)
    tokens.push({ kind: 'operator', text: ch, start: i });
    i++;
  }

  return tokens;
}

// ── Token Color Theme ────────────────────────────────────────────────────────

export interface EplTokenColorTheme {
  keyword: string;
  command: string;
  string: string;
  comment: string;
  number: string;
  operator: string;
  variable: string;
  function: string;
  boolean: string;
  identifier: string;
  whitespace: string;
  dot: string;
  paren: string;
  comma: string;
}

/**
 * Dark theme colors inspired by Visual Studio Dark+
 */
export const EPL_TOKEN_COLORS_DARK: EplTokenColorTheme = {
  keyword:    '#569cd6',  // VS blue for keywords
  command:    '#dcdcaa',  // VS yellow for functions/commands
  string:     '#ce9178',  // VS orange-brown for strings
  comment:    '#6a9955',  // VS green for comments
  number:     '#b5cea8',  // VS light green for numbers
  operator:   '#d4d4d4',  // VS light gray for operators
  variable:   '#9cdcfe',  // VS light blue for variables
  function:   '#dcdcaa',  // VS yellow for functions
  boolean:    '#569cd6',  // VS blue for boolean literals
  identifier: '#d4d4d4',  // VS default text color
  whitespace: 'transparent',
  dot:        '#d4d4d4',
  paren:      '#ffd700',  // Gold for parentheses (VS bracket colorization)
  comma:      '#d4d4d4',
};

/**
 * Light theme colors inspired by Visual Studio Light+
 */
export const EPL_TOKEN_COLORS_LIGHT: EplTokenColorTheme = {
  keyword:    '#0000ff',  // VS classic blue
  command:    '#795e26',  // VS dark yellow for functions
  string:     '#a31515',  // VS dark red for strings
  comment:    '#008000',  // VS green for comments
  number:     '#098658',  // VS teal for numbers
  operator:   '#000000',  // Black
  variable:   '#001080',  // VS dark blue for variables
  function:   '#795e26',  // VS dark yellow
  boolean:    '#0000ff',  // Blue
  identifier: '#000000',  // Black
  whitespace: 'transparent',
  dot:        '#000000',
  paren:      '#0431fa',  // VS bracket blue
  comma:      '#000000',
};
