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

const EPL_SUBPROGRAM_RE = /^\.子程序\s+([^,\s\r\n]+)[^\r\n]*(?:\r?\n|$)/gm;
const EPL_MESSAGE_BOX_RE = /信息框\s*[（(]\s*[“"]([^”"]*)[”"]\s*[,，]\s*(\d+)\s*[,，]\s*[“"]([^”"]*)[”"]\s*[）)]/u;
const EPL_DEBUG_OUTPUT_RE = /调试输出\s*[（(]\s*[“"]([^”"]*)[”"]\s*[）)]/gu;

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
  return rules[normalizedName] || rules[`_${normalizedName}`];
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
