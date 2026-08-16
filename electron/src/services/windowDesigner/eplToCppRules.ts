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
    ['||'],
    ['&&'],
    // 中文条件表达式使用单个“=”表示相等判断；保持双等号优先匹配。
    ['==', '!=', '>=', '<=', '>', '<', '='],
    ['+', '-'],
    ['*', '/', '%']
  ];

  for (const operators of precedenceGroups) {
    let depth = 0;
    let quote: '"' | '“' | null = null;
    for (let index = expression.length - 1; index >= 0; index -= 1) {
      const char = expression[index];
      if (quote) {
        if ((quote === '"' && char === '"') || (quote === '“' && char === '“')) quote = null;
        continue;
      }
      if (char === '"') {
        quote = '"';
        continue;
      }
      if (char === '”') {
        quote = '“';
        continue;
      }
      if (char === ')' || char === '）') {
        depth += 1;
        continue;
      }
      if (char === '(' || char === '（') {
        depth = Math.max(0, depth - 1);
        continue;
      }
      if (depth !== 0) continue;

      const operator = operators.find(candidate => expression.startsWith(candidate, index));
      if (!operator) continue;
      const left = expression.slice(0, index).trim();
      const right = expression.slice(index + operator.length).trim();
      if (!left || !right || /[+\-*/%!=<>（(]$/u.test(left)) continue;
      return { left, operator, right };
    }
  }

  return undefined;
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
