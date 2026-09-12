import { normalizeIdentifier } from './parser';
import { parseLingCppControlFlowLine } from './controlFlow';
import { inferLingCppExpressionType, normalizeLingCppValueType } from './expressionTypeService';
import { getLingCppParameterElementType, isLingCppArrayParameterType } from './parameterTypeService';
import { LingCppClass, LingCppGlobalVariable, LingCppMethod, LingCppProjectTypeContext } from './types';
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
  projectTypes?: LingCppProjectTypeContext;
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

  if (isBeginnerNameDeclared(name, options)) {
    return { kind: 'none', reason: 'already-declared' };
  }

  // 数组维度参与推断：名单[0] 和 数组_取成员(名单, 0) 都要能定型到元素类型。
  return {
    kind: 'declare',
    name,
    expression,
    inferredType: inferLingCppExpressionType(
      expression,
      buildBeginnerScopeTypeMap(options),
      options.moduleContext,
      options.commandReturnTypes,
      options.projectTypes
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

  if (isBeginnerNameDeclared(name, options)) {
    return { kind: 'none', reason: 'already-declared' };
  }

  const inferredType = normalizeBeginnerOutputParameterType(options.parameterType);
  if (!inferredType) return { kind: 'none', reason: 'unknown-type' };
  return { kind: 'declare', name, inferredType };
}

/**
 * 循环变量槽位是语言级固定语义：计次循环首第 2 参数、变量循环首第 4 参数、
 * 枚举循环首第 2 参数是循环中唯一需要预先声明的变量。计次与变量循环的
 * 循环变量按整数型处理；枚举循环的当前项类型跟随集合实参的元素类型。
 */
const BEGINNER_LOOP_VARIABLE_SLOTS: Record<string, {
  argumentIndex: number;
  argumentCount: number;
  mode: 'fixed' | 'foreach-element';
  fixedType?: string;
}> = {
  计次循环首: { argumentIndex: 1, argumentCount: 2, mode: 'fixed', fixedType: '整数型' },
  变量循环首: { argumentIndex: 3, argumentCount: 4, mode: 'fixed', fixedType: '整数型' },
  枚举循环首: { argumentIndex: 1, argumentCount: 2, mode: 'foreach-element' }
};

export type BeginnerAutoLocalLoopVariableAnalysis =
  | { kind: 'none'; reason: 'not-loop-variable' | 'not-identifier' | 'already-declared' }
  | { kind: 'declare'; name: string; inferredType?: string; statement: string };

export interface BeginnerAutoLocalLoopVariableOptions {
  lineText: string;
  method: LingCppMethod;
  ownerClass?: LingCppClass;
  globals?: LingCppGlobalVariable[];
  moduleContext?: LingCppModuleContext;
  commandReturnTypes?: ReadonlyMap<string, string>;
  projectTypes?: LingCppProjectTypeContext;
}

export function analyzeBeginnerAutoLocalLoopVariable(
  options: BeginnerAutoLocalLoopVariableOptions
): BeginnerAutoLocalLoopVariableAnalysis {
  const statement = options.lineText.trim();
  const control = parseLingCppControlFlowLine(statement);
  const slot = control ? BEGINNER_LOOP_VARIABLE_SLOTS[control.keyword] : undefined;
  if (!control || control.role !== 'start' || !slot) {
    return { kind: 'none', reason: 'not-loop-variable' };
  }
  if (control.arguments.length !== slot.argumentCount) {
    return { kind: 'none', reason: 'not-loop-variable' };
  }

  const name = (control.arguments[slot.argumentIndex] || '').trim();
  if (!isBeginnerLocalIdentifier(name)) {
    return { kind: 'none', reason: 'not-identifier' };
  }
  if (isBeginnerNameDeclared(name, options)) {
    return { kind: 'none', reason: 'already-declared' };
  }

  let inferredType: string | undefined;
  if (slot.mode === 'fixed') {
    inferredType = slot.fixedType;
  } else {
    // 枚举循环：当前项跟随集合实参的元素类型（含 字节集 → 字节型 的特例，
    // 与表达式类型服务对字节集下标访问的结论保持一致）。
    const collectionType = inferLingCppExpressionType(
      control.arguments[0] || '',
      buildBeginnerScopeTypeMap(options),
      options.moduleContext,
      options.commandReturnTypes,
      options.projectTypes
    );
    if (collectionType && isLingCppArrayParameterType(collectionType)) {
      inferredType = normalizeLingCppValueType(getLingCppParameterElementType(collectionType));
    } else if (collectionType === '字节集') {
      inferredType = '字节型';
    }
  }

  return { kind: 'declare', name, inferredType, statement };
}

interface BeginnerDeclarationScope {
  method: LingCppMethod;
  ownerClass?: LingCppClass;
  globals?: LingCppGlobalVariable[];
}

function isBeginnerNameDeclared(name: string, options: BeginnerDeclarationScope): boolean {
  const normalizedName = normalizeIdentifier(name);
  const declarationNames = [
    ...(options.globals || []).map(global => global.name),
    ...(options.ownerClass?.members || []).map(member => member.name),
    ...options.method.parameters.map(parameter => parameter.name),
    ...(options.method.locals || []).map(local => local.name)
  ];
  return declarationNames.some(declaration => normalizeIdentifier(declaration) === normalizedName);
}

function buildBeginnerScopeTypeMap(options: BeginnerDeclarationScope): Map<string, string> {
  const scopeTypes = new Map<string, string>();
  (options.globals || []).forEach(global => scopeTypes.set(normalizeIdentifier(global.name), global.isArray ? `${global.type}[]` : global.type));
  (options.ownerClass?.members || []).forEach(member => scopeTypes.set(normalizeIdentifier(member.name), member.isArray ? `${member.type}[]` : member.type));
  options.method.parameters.forEach(parameter => scopeTypes.set(normalizeIdentifier(parameter.name), parameter.type));
  (options.method.locals || []).forEach(local => scopeTypes.set(normalizeIdentifier(local.name), local.isArray ? `${local.type}[]` : local.type));
  return scopeTypes;
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
