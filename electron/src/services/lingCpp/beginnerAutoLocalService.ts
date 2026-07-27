import { normalizeIdentifier } from './parser';
import { inferLingCppExpressionType } from './expressionTypeService';
import { LingCppClass, LingCppGlobalVariable, LingCppMethod } from './types';
import { LingCppModuleContext } from '../modules/types';

export type BeginnerAutoLocalAnalysis =
  | { kind: 'none'; reason: 'not-assignment' | 'incomplete' | 'already-declared' }
  | { kind: 'declare'; name: string; expression: string; inferredType?: string };

export interface BeginnerAutoLocalAnalysisOptions {
  lineText: string;
  method: LingCppMethod;
  ownerClass?: LingCppClass;
  globals?: LingCppGlobalVariable[];
  moduleContext?: LingCppModuleContext;
  commandReturnTypes?: ReadonlyMap<string, string>;
}

export type BeginnerAutoLocalCommandArgumentAnalysis =
  | { kind: 'none'; reason: 'not-output-parameter' | 'not-identifier' | 'already-declared' | 'unknown-type' }
  | { kind: 'declare'; name: string; inferredType: string };

export interface BeginnerAutoLocalCommandArgumentOptions {
  value: string;
  parameterName?: string;
  parameterType?: string;
  parameterNote?: string;
  method: LingCppMethod;
  ownerClass?: LingCppClass;
  globals?: LingCppGlobalVariable[];
}

export function analyzeBeginnerAutoLocalAssignment(
  options: BeginnerAutoLocalAnalysisOptions
): BeginnerAutoLocalAnalysis {
  const line = options.lineText.trim();
  if (!line || line.startsWith("'") || line.startsWith('//') || line.startsWith('@')) {
    return { kind: 'none', reason: 'not-assignment' };
  }

  const assignment = line.match(/^([\w\u4e00-\u9fa5]+)\s*[=＝](?!=)\s*(.+?)\s*;?$/u);
  if (!assignment) return { kind: 'none', reason: 'not-assignment' };

  const name = assignment[1] || '';
  const expression = (assignment[2] || '').trim();
  if (!expression || !isCompleteBeginnerExpression(expression)) {
    return { kind: 'none', reason: 'incomplete' };
  }

  const normalizedName = normalizeIdentifier(name);
  const declarationNames = [
    ...(options.globals || []).map(global => global.name),
    ...(options.ownerClass?.members || []).map(member => member.name),
    ...options.method.parameters.map(parameter => parameter.name),
    ...(options.method.locals || []).map(local => local.name)
  ];
  if (declarationNames.some(declaration => normalizeIdentifier(declaration) === normalizedName)) {
    return { kind: 'none', reason: 'already-declared' };
  }

  const scopeTypes = new Map<string, string>();
  (options.globals || []).forEach(global => scopeTypes.set(normalizeIdentifier(global.name), global.type));
  (options.ownerClass?.members || []).forEach(member => scopeTypes.set(normalizeIdentifier(member.name), member.type));
  options.method.parameters.forEach(parameter => scopeTypes.set(normalizeIdentifier(parameter.name), parameter.type));
  (options.method.locals || []).forEach(local => scopeTypes.set(normalizeIdentifier(local.name), local.type));

  return {
    kind: 'declare',
    name,
    expression,
    inferredType: inferLingCppExpressionType(
      expression,
      scopeTypes,
      options.moduleContext,
      options.commandReturnTypes
    )
  };
}

/**
 * Detects an undeclared identifier entered into an output-style command
 * parameter (for example 返回Cookies). Input parameters must never create
 * locals implicitly, even when their value happens to be a bare identifier.
 */
export function analyzeBeginnerAutoLocalCommandArgument(
  options: BeginnerAutoLocalCommandArgumentOptions
): BeginnerAutoLocalCommandArgumentAnalysis {
  if (!isBeginnerOutputParameter(options.parameterName, options.parameterNote)) {
    return { kind: 'none', reason: 'not-output-parameter' };
  }

  const name = options.value.trim();
  if (!isBeginnerLocalIdentifier(name)) {
    return { kind: 'none', reason: 'not-identifier' };
  }

  const normalizedName = normalizeIdentifier(name);
  const declarationNames = [
    ...(options.globals || []).map(global => global.name),
    ...(options.ownerClass?.members || []).map(member => member.name),
    ...options.method.parameters.map(parameter => parameter.name),
    ...(options.method.locals || []).map(local => local.name)
  ];
  if (declarationNames.some(declaration => normalizeIdentifier(declaration) === normalizedName)) {
    return { kind: 'none', reason: 'already-declared' };
  }

  const inferredType = normalizeBeginnerOutputParameterType(options.parameterType);
  if (!inferredType) return { kind: 'none', reason: 'unknown-type' };
  return { kind: 'declare', name, inferredType };
}

function isBeginnerOutputParameter(name?: string, note?: string): boolean {
  const normalizedName = (name || '').replace(/\s+/gu, '');
  if (/^(返回|输出)/u.test(normalizedName)) return true;
  const normalizedNote = (note || '').replace(/\s+/gu, '');
  return /(?:输出参数|返回参数|回写(?:参数|变量|结果)?)/u.test(normalizedNote);
}

function isBeginnerLocalIdentifier(value: string): boolean {
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(value)) return false;
  return !/^(真|假|空|null|nullptr|true|false)$/iu.test(value);
}

function normalizeBeginnerOutputParameterType(type?: string): string | undefined {
  const value = (type || '').trim();
  if (!value || /^(空|无|任意|可选|参数|原始值|raw)$/iu.test(value)) return undefined;
  if (/^utf-?8\s*(?:文本|string)$/iu.test(value)) return '文本型';
  return value;
}

export function isCompleteBeginnerExpression(expression: string): boolean {
  const value = expression.trim().replace(/;$/u, '').trim();
  if (!value || /[=+加\-*/,.，(（\[{]$/u.test(value)) return false;

  const expectedClosers: string[] = [];
  let quote: '"' | '“' | undefined;
  let escaped = false;
  const closerFor: Record<string, string> = { '(': ')', '（': '）', '[': ']', '{': '}' };

  for (const character of value) {
    if (quote) {
      if (quote === '"' && character === '\\' && !escaped) {
        escaped = true;
        continue;
      }
      if ((quote === '"' && character === '"' && !escaped) || (quote === '“' && character === '”')) {
        quote = undefined;
      }
      escaped = false;
      continue;
    }

    if (character === '"' || character === '“') {
      quote = character;
      continue;
    }
    if (closerFor[character]) {
      expectedClosers.push(closerFor[character]);
      continue;
    }
    if (character === ')' || character === '）' || character === ']' || character === '}') {
      if (expectedClosers.pop() !== character) return false;
    }
  }

  return !quote && expectedClosers.length === 0;
}
