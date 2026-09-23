import { collectLingCppStringLiteralRegions } from '../lingCpp/stringLiteralRegions';

export interface EplMessageBoxRule {
  text: string;
  title: string;
  flagCode: number;
  cppFlagsExpression: string;
  confirmResultCode?: number;
}

export interface EplRuntimeEventRule {
  handlerName: string;
  messageBox?: EplMessageBoxRule;
  debugOutputs: string[];
  closesWindowOnConfirm: boolean;
  rawBody: string;
}

export type EplRuntimeEventRuleMap = Record<string, EplRuntimeEventRule>;

/**
 * Legacy LingCpp command spellings that are still accepted for old projects.
 * The generated C++ name must always point at a runtime symbol that exists.
 */
export const EPL_RUNTIME_CALL_ALIASES: Readonly<Record<string, string>> = {
  上传_打开: '上传_打开文件选择'
};

export function resolveEplRuntimeCallName(name: string): string {
  return EPL_RUNTIME_CALL_ALIASES[name.trim()] || name.trim();
}

export interface EplControlMemberRule {
  controlName: string;
  memberName: '内容';
  getterRuntimeName: '控件_取文本';
  setterRuntimeName: '控件_设置文本';
}

export interface EplControlMemberAssignmentRule extends EplControlMemberRule {
  valueExpression: string;
}

export interface EplControlMethodCallRule {
  controlName: string;
  methodName: '设置选择项' | '设置图片';
  runtimeName: '控件_设置选择项' | '控件_设置图片';
  argumentsText: string;
}

const EPL_SUBPROGRAM_RE = /^\.子程序\s+([^,\s\r\n]+)[^\r\n]*(?:\r?\n|$)/gm;
const EPL_MESSAGE_BOX_RE = /信息框\s*[（(]\s*[“"]([^”"]*)[”"]\s*[,，]\s*(\d+)\s*[,，]\s*[“"]([^”"]*)[”"]\s*[）)]/u;
const EPL_DEBUG_OUTPUT_RE = /调试输出\s*[（(]\s*[“"]([^”"]*)[”"]\s*[）)]/gu;
const CONTROL_NAME_PATTERN = '[\\w\\u4e00-\\u9fa5]+';
const CONTROL_TEXT_MEMBER_RE = new RegExp(`^(${CONTROL_NAME_PATTERN})\\s*\\.\\s*(内容|文字)$`, 'u');
const CONTROL_TEXT_ASSIGNMENT_RE = new RegExp(`^(${CONTROL_NAME_PATTERN})\\s*\\.\\s*(内容|文字)\\s*[=＝]\\s*(.+)$`, 'u');
const CONTROL_METHOD_RE = new RegExp(`^(${CONTROL_NAME_PATTERN})\\s*\\.\\s*(设置选择项|设置图片)\\s*[（(](.*)[）)]\\s*;?$`, 'u');

export function parseEplControlMemberRule(expression: string): EplControlMemberRule | undefined {
  const match = expression.trim().match(CONTROL_TEXT_MEMBER_RE);
  if (!match?.[1]) return undefined;
  return {
    controlName: match[1],
    memberName: '内容',
    getterRuntimeName: '控件_取文本',
    setterRuntimeName: '控件_设置文本'
  };
}

export function parseEplControlMemberAssignmentRule(statement: string): EplControlMemberAssignmentRule | undefined {
  const match = statement.trim().match(CONTROL_TEXT_ASSIGNMENT_RE);
  if (!match?.[1] || !match[3]?.trim()) return undefined;
  return {
    controlName: match[1],
    memberName: '内容',
    getterRuntimeName: '控件_取文本',
    setterRuntimeName: '控件_设置文本',
    valueExpression: match[3].trim()
  };
}

export function parseEplControlMethodCallRule(expression: string): EplControlMethodCallRule | undefined {
  const match = expression.trim().match(CONTROL_METHOD_RE);
  if (!match?.[1] || !match[2] || !match[3]?.trim()) return undefined;
  const methodName = match[2] as EplControlMethodCallRule['methodName'];
  return {
    controlName: match[1],
    methodName,
    runtimeName: methodName === '设置图片' ? '控件_设置图片' : '控件_设置选择项',
    argumentsText: match[3].trim()
  };
}

export function splitEplBinaryExpression(expression: string): { left: string; operator: string; right: string } | undefined {
  const precedenceGroups = [
    ['||', '或'],
    ['&&', '且'],
    // 中文条件表达式使用单个“=”表示相等判断；保持双等号优先匹配；不等号支持 <> 与 ≠。
    ['==', '!=', '<>', '>=', '<=', '>', '<', '='],
    ['+', '-'],
    ['*', '/', '%']
  ];

  // 字符串字面量区间（含引号字符）由公共工具正向标定：`\"` 转义与连续反斜杠的奇偶
  // 配对都正确处理。此前这里从后往前扫描时只判断 `char === quote`，被转义的引号被
  // 误判为字符串结束、引号奇偶翻转，顶层运算符找不到，整句表达式掉进生成端兜底被
  // 原样吐进 C++。
  const mask = new Uint8Array(expression.length);
  for (const region of collectLingCppStringLiteralRegions(expression)) {
    mask.fill(1, region.start, region.end);
  }

  for (const operators of precedenceGroups) {
    let depth = 0;
    for (let index = expression.length - 1; index >= 0; index -= 1) {
      if (mask[index]) continue;
      const char = expression[index];
      if (char === ')' || char === '）') {
        depth += 1;
        continue;
      }
      if (char === '(' || char === '（') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth !== 0) continue;

      const operator = operators.find(candidate => {
        if (!expression.startsWith(candidate, index)) return false;
        if (/^[\x20-\x7E]+$/.test(candidate)) return true;
        // 中文运算符（或/且）必须独立成词：前后都不能是标识符字符，避免拆断「或者标志」这类名字。
        const before = index > 0 ? expression[index - 1] : '';
        const after = expression[index + candidate.length] || '';
        return !/[\p{L}\p{N}_]/u.test(before) && !/[\p{L}\p{N}_]/u.test(after);
      });
      if (!operator) continue;
      const left = expression.slice(0, index).trim();
      const right = expression.slice(index + operator.length).trim();
      if (!left || !right || /[+\-*/%!=<>（(]$/u.test(left)) continue;
      return { left, operator, right };
    }
  }

  return undefined;
}

// 允许原样透传给 C++ 的表达式字符：ASCII 结构符号 + 各语言标识符字符（中文标识符
// 在生成 C++ 中合法）。引号（任何未走字符串翻译分支的残留）、反斜杠、分号与全角
// 标点一律不允许透传——它们要么是 .lcpp 专属形态，要么必然生成坏代码。
const CPP_PLAUSIBLE_PASSTHROUGH_PATTERN = /^[\p{L}\p{N}_ \t+\-*/%<>=!&|^~?:.,()[\]]+$/u;

/**
 * 生成端兜底透传判定：表达式里没有任何字符串字面量，且字符全部是标识符字符或
 * C++ 表达式安全符号时，才允许原样透传（如 `arr[0]`、`-1` 这类 .lcpp 未专门建模、
 * 但透传后就是合法 C++ 的形态）。其余形态必须走「无法翻译」降级，绝不能把含引号、
 * 全角标点或中文引号的原文当 C++ 吐出去。
 */
export function isPlausibleCppPassthroughExpression(expression: string): boolean {
  const trimmed = expression.trim();
  if (!trimmed) return false;
  if (collectLingCppStringLiteralRegions(trimmed).length > 0) return false;
  return CPP_PLAUSIBLE_PASSTHROUGH_PATTERN.test(trimmed);
}

export function parseEplRuntimeEventRules(sourceCode: string | undefined): EplRuntimeEventRuleMap {
  if (!sourceCode?.trim()) {
    return {};
  }

  const matches = Array.from(sourceCode.matchAll(EPL_SUBPROGRAM_RE));
  const rules: EplRuntimeEventRuleMap = {};

  matches.forEach((match, index) => {
    const handlerName = match[1]?.trim();
    if (!handlerName) return;

    const bodyStart = match.index! + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? sourceCode.length;
    const rawBody = sourceCode.slice(bodyStart, bodyEnd).trimEnd();

    rules[handlerName] = parseEplRuntimeEventRule(handlerName, rawBody);
  });

  return rules;
}

export function parseEplRuntimeEventRule(handlerName: string, rawBody: string): EplRuntimeEventRule {
  const messageBoxMatch = rawBody.match(EPL_MESSAGE_BOX_RE);
  const messageBox = messageBoxMatch
    ? createMessageBoxRule(messageBoxMatch, rawBody)
    : undefined;

  const debugOutputs = Array.from(rawBody.matchAll(EPL_DEBUG_OUTPUT_RE))
    .map(match => match[1]?.trim())
    .filter((value): value is string => Boolean(value));

  return {
    handlerName,
    messageBox,
    debugOutputs,
    closesWindowOnConfirm: Boolean(messageBox?.confirmResultCode === 6 && /结束\s*[（(]\s*[）)]/.test(rawBody)),
    rawBody
  };
}

export function getEplRuntimeEventRule(rules: EplRuntimeEventRuleMap, handlerName: string): EplRuntimeEventRule | undefined {
  const normalizedName = handlerName.trim();
  if (rules[normalizedName]) return rules[normalizedName];
  if (rules[`_${normalizedName}`]) return rules[`_${normalizedName}`];

  // Fuzzy matching:
  // 1. Strip all leading underscores
  const cleanName = normalizedName.replace(/^_+/, '');
  for (const key of Object.keys(rules)) {
    if (key.replace(/^_+/, '') === cleanName) {
      return rules[key];
    }
  }

  // 2. Strip window class prefix (e.g. "_登录窗体_太空冒险安全账户登录_被选择" -> "太空冒险安全账户登录_被选择")
  const parts = cleanName.split('_');
  if (parts.length > 1) {
    const withoutWindow = parts.slice(1).join('_');
    for (const key of Object.keys(rules)) {
      const keyClean = key.replace(/^_+/, '');
      if (keyClean === withoutWindow) {
        return rules[key];
      }
    }

    // 3. Match control name prefix with any suffix (e.g. expect "太空冒险安全账户登录_被选择" -> matches "太空冒险安全账户登录_鼠标被按下")
    const controlName = parts.slice(0, parts.length - 1).join('_');
    const controlNameWithoutWindow = parts.length > 2 ? parts.slice(1, parts.length - 1).join('_') : '';
    
    for (const key of Object.keys(rules)) {
      const keyClean = key.replace(/^_+/, '');
      if (
        (controlName && keyClean.startsWith(controlName + '_')) ||
        (controlNameWithoutWindow && keyClean.startsWith(controlNameWithoutWindow + '_')) ||
        keyClean === controlName ||
        keyClean === controlNameWithoutWindow
      ) {
        return rules[key];
      }
    }
  }

  return undefined;
}

export function toMessageBoxFlagsExpression(flagCode: number): string {
  const parts: string[] = [];

  switch (flagCode & 0x0f) {
    case 1:
      parts.push('MB_OKCANCEL');
      break;
    case 2:
      parts.push('MB_ABORTRETRYIGNORE');
      break;
    case 3:
      parts.push('MB_YESNOCANCEL');
      break;
    case 4:
      parts.push('MB_YESNO');
      break;
    case 5:
      parts.push('MB_RETRYCANCEL');
      break;
    default:
      parts.push('MB_OK');
      break;
  }

  const iconCode = flagCode & 0xf0;
  if (iconCode === 16) {
    parts.push('MB_ICONERROR');
  } else if (iconCode === 32) {
    parts.push('MB_ICONQUESTION');
  } else if (iconCode === 48) {
    parts.push('MB_ICONWARNING');
  } else if (iconCode === 64) {
    parts.push('MB_ICONINFORMATION');
  }

  return parts.join(' | ');
}

function createMessageBoxRule(match: RegExpMatchArray, rawBody: string): EplMessageBoxRule {
  const text = match[1]?.trim() || '';
  const flagCode = Number.parseInt(match[2] || '0', 10);
  const title = match[3]?.trim() || '提示';
  const expressionStart = match.index ?? rawBody.indexOf(match[0]);
  const expressionLine = getLineAt(rawBody, expressionStart);
  const confirmResultCodeMatch = expressionLine.match(/[=＝]\s*(\d+)/);

  return {
    text,
    title,
    flagCode: Number.isFinite(flagCode) ? flagCode : 0,
    cppFlagsExpression: toMessageBoxFlagsExpression(Number.isFinite(flagCode) ? flagCode : 0),
    confirmResultCode: confirmResultCodeMatch ? Number.parseInt(confirmResultCodeMatch[1], 10) : undefined
  };
}

function getLineAt(value: string, index: number): string {
  const safeIndex = Math.max(0, index);
  const lineStart = value.lastIndexOf('\n', safeIndex);
  const lineEnd = value.indexOf('\n', safeIndex);
  return value.slice(lineStart + 1, lineEnd === -1 ? value.length : lineEnd);
}
