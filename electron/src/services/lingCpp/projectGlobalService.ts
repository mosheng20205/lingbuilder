import { LingCppModuleContext } from '../modules/types';
import { inferLingCppExpressionType } from './expressionTypeService';
import { LING_CPP_TYPES, normalizeIdentifier, parseLingCpp } from './parser';
import { collectLingCppTextBlockOpaqueLines, scanLingCppTextBlockRanges } from './textBlock';
import { LingCppConstant, LingCppDiagnostic, LingCppGlobalVariable, LingCppProjectGlobalContext } from './types';

export const PROJECT_GLOBALS_FILE_NAME = '项目全局变量.lcpp';
export const EMPTY_PROJECT_GLOBALS_SOURCE = '// 项目级常量与全局变量：可在当前项目的全部 .lcpp 源码中直接使用。\n';
export const PROJECT_CONSTANT_TYPES = ['文本型', '整数型', '长整数型', '小数型', '单精度小数型', '双精度小数型', '逻辑型'] as const;

export function isProjectGlobalsFilePath(filePath: string | undefined): boolean {
  if (!filePath) return false;
  return (filePath.replace(/\\/gu, '/').split('/').pop() || '').toLocaleLowerCase() === PROJECT_GLOBALS_FILE_NAME.toLocaleLowerCase();
}

export function createProjectGlobalContext(filePath: string, sourceCode: string): LingCppProjectGlobalContext {
  return {
    filePath: filePath.replace(/\\/gu, '/'),
    sourceCode,
    constants: parseLingCpp(sourceCode).program.constants,
    globals: parseLingCpp(sourceCode).program.globals
  };
}

export function getProjectGlobalDiagnostics(
  sourceCode: string,
  filePath: string | undefined,
  moduleContext?: LingCppModuleContext,
  projectTypeNames: string[] = []
): LingCppDiagnostic[] {
  const parsed = parseLingCpp(sourceCode);
  const diagnostics: LingCppDiagnostic[] = [];
  const isGlobalFile = isProjectGlobalsFilePath(filePath);

  if (!isGlobalFile && (parsed.program.constants.length > 0 || parsed.program.globals.length > 0)) {
    parsed.program.constants.forEach(constant => diagnostics.push(createDiagnostic(
      'error', constant.line, `常量 ${constant.type} ${constant.name}`,
      '项目常量只能声明在“项目全局变量.lcpp”中。',
      '请把该声明移动到解决方案资源管理器中的“项目变量与常量”。'
    )));
    parsed.program.globals.forEach(global => diagnostics.push(createDiagnostic(
      'error',
      global.line,
      `全局 ${global.type} ${global.name}`,
      '项目全局变量只能声明在“项目全局变量.lcpp”中。',
      '请把该声明移动到解决方案资源管理器中的“项目变量与常量”。'
    )));
    return diagnostics;
  }
  if (!isGlobalFile) return diagnostics;

  // 项目全局变量的声明语法是「全局 类型 名称 = 初值」。少了「全局」关键字的一行会被解析器当成普通语句忽略，
  // 编辑者却以为变量已声明（功能库随后引用它只会得到「尚未声明」，非常难定位）。这里显式拦截并给出修法。
  const declaredGlobalLines = new Set(parsed.program.globals.map(global => global.line));
  const knownTypeNames = new Set([
    ...LING_CPP_TYPES.map(type => normalizeIdentifier(type)),
    ...PROJECT_CONSTANT_TYPES.map(type => normalizeIdentifier(type)),
    ...projectTypeNames.map(name => normalizeIdentifier(name)),
    ...(moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || []).map(type => normalizeIdentifier(type.name)))
  ]);
  sourceCode.split(/\r?\n/u).forEach((line, index) => {
    const lineNumber = index + 1;
    if (declaredGlobalLines.has(lineNumber)) return;
    const text = line.trim();
    if (!text || text.startsWith('//') || /^(?:常量|全局|公开|私有|局部|类|功能库)\b/u.test(text)) return;
    const match = text.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*(?:\[\]|［］)?\s+([\p{L}_][\p{L}\p{N}_]*)\s*(?:[=＝].*)?$/u);
    if (!match) return;
    const typeName = match[1] || '';
    const variableName = match[2] || '';
    if (!knownTypeNames.has(normalizeIdentifier(typeName))) return;
    diagnostics.push(createDiagnostic(
      'error', lineNumber, text,
      `项目全局变量 ${variableName} 缺少“全局”关键字，写成 ${typeName} ${variableName} 会被忽略。`,
      `请写成 全局 ${typeName} ${variableName} = 初值（数组写 全局 ${typeName} ${variableName}[]），功能库与窗口源码才能引用它。`
    ));
  });

  parsed.program.classes.forEach(cls => diagnostics.push(createDiagnostic(
    'error', cls.line, `类 ${cls.name}`, '项目变量与常量文件不能声明类。', '请把类移动到普通 .lcpp 源文件。'
  )));

  const firstGlobalLine = parsed.program.globals[0]?.line;
  const constantTypes = new Map<string, string>();
  parsed.program.constants.forEach(constant => {
    if (firstGlobalLine && constant.line > firstGlobalLine) {
      diagnostics.push(createDiagnostic('error', constant.line, constant.name, `项目常量 ${constant.name} 必须声明在全部项目全局变量之前。`, '请把常量移动到“项目常量”声明区域。'));
    }
    if (!PROJECT_CONSTANT_TYPES.includes(constant.type as typeof PROJECT_CONSTANT_TYPES[number])) {
      diagnostics.push(createDiagnostic('error', constant.line, constant.type, `项目常量 ${constant.name} 不支持类型 ${constant.type}。`, `请选择 ${PROJECT_CONSTANT_TYPES.join('、')}。`));
    }
    if (!constant.initialValue.trim()) {
      diagnostics.push(createDiagnostic('error', constant.line, constant.name, `项目常量 ${constant.name} 必须填写常量值。`, '请输入与常量类型兼容的字面量或前面已经声明的项目常量。'));
    } else {
      const invalidReason = validateConstantInitializer(constant, constantTypes, moduleContext);
      if (invalidReason) diagnostics.push(createDiagnostic('error', constant.line, constant.initialValue, `项目常量 ${constant.name} 的常量值无效：${invalidReason}`, '只使用字面量、纯运算和前面已经声明的项目常量。'));
    }
    constantTypes.set(normalizeIdentifier(constant.name), constant.type);
  });

  const knownTypes = new Set([
    ...LING_CPP_TYPES.map(normalizeIdentifier),
    ...projectTypeNames.map(normalizeIdentifier),
    ...(moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || []).map(type => normalizeIdentifier(type.name)))
  ]);
  const precedingTypes = new Map<string, string>(constantTypes);
  parsed.program.globals.forEach(global => {
    if (!knownTypes.has(normalizeIdentifier(global.type))) {
      diagnostics.push(createDiagnostic(
        'error', global.line, global.type, `项目全局变量 ${global.name} 使用了未知类型 ${global.type}。`, '请选择内置类型，或先启用贡献该类型的模块。'
      ));
    }
    if (global.isArray && global.initialValue?.trim()) {
      diagnostics.push(createDiagnostic(
        'error', global.line, global.initialValue, `数组全局变量 ${global.name} 首版只支持默认空数组。`, '请清空初始值，并在窗口创建后按需添加数组内容。'
      ));
    } else if (global.initialValue?.trim()) {
      const invalidReason = validateSafeGlobalInitializer(global.initialValue, precedingTypes);
      if (invalidReason) {
        diagnostics.push(createDiagnostic(
          'error', global.line, global.initialValue, `项目全局变量 ${global.name} 的初始值不安全：${invalidReason}`, '只使用字面量、纯运算和前面已经声明的项目全局变量。'
        ));
      } else {
        const actualType = inferSafeInitializerType(global.initialValue, precedingTypes, moduleContext);
        if (actualType && !areGlobalTypesCompatible(global.type, actualType)) {
          diagnostics.push(createDiagnostic(
            'error', global.line, global.initialValue, `项目全局变量 ${global.name} 的类型是 ${global.type}，不能使用 ${actualType} 初始化。`, `请改用 ${global.type} 值，或修改变量类型。`
          ));
        }
      }
    }
    precedingTypes.set(normalizeIdentifier(global.name), global.type);
  });
  return diagnostics;
}

export function validateSafeGlobalInitializer(expression: string, precedingTypes: ReadonlyMap<string, string>): string | undefined {
  if (/^[\s\S]*[\p{L}_][\p{L}\p{N}_]*\s*[（(]/u.test(expression)) return '包含函数调用、成员访问或不支持的符号';
  const tokens = tokenizeSafeExpression(expression);
  if (!tokens) return '包含函数调用、成员访问或不支持的符号';
  for (const token of tokens) {
    if (token.kind !== 'identifier') continue;
    if (/^(真|假)$/u.test(token.value)) continue;
    if (!precedingTypes.has(normalizeIdentifier(token.value))) return `只能引用前面已经声明的全局变量 ${token.value}`;
  }
  return undefined;
}

function validateConstantInitializer(
  constant: LingCppConstant,
  precedingTypes: ReadonlyMap<string, string>,
  moduleContext?: LingCppModuleContext
): string | undefined {
  const invalidReason = validateSafeGlobalInitializer(constant.initialValue, precedingTypes);
  if (invalidReason) return invalidReason.replace('全局变量', '项目常量');
  const tokens = tokenizeSafeExpression(constant.initialValue);
  if (!tokens) return '包含函数调用、成员访问或不支持的符号';
  if (/文本/u.test(constant.type)) {
    if (tokens.length !== 1 || !['string', 'identifier'].includes(tokens[0]?.kind || '')) return '文本常量首版只支持字符串字面量或前面声明的文本常量';
  }
  const actualType = inferSafeInitializerType(constant.initialValue, new Map(precedingTypes), moduleContext);
  if (actualType && !areGlobalTypesCompatible(constant.type, actualType)) return `类型是 ${constant.type}，不能使用 ${actualType} 初始化`;
  return undefined;
}

function inferSafeInitializerType(
  expression: string,
  precedingTypes: Map<string, string>,
  moduleContext?: LingCppModuleContext
): string | undefined {
  const direct = inferLingCppExpressionType(expression, precedingTypes, moduleContext);
  if (direct) return direct;
  const tokens = tokenizeSafeExpression(expression);
  if (!tokens) return undefined;
  if (tokens.some(token => token.kind === 'operator' && /^(?:&&|\|\||==|!=|<=|>=|<|>)$/u.test(token.value))) return '逻辑型';
  const valueTypes = tokens.flatMap(token => {
    if (token.kind === 'string') return ['文本型'];
    if (token.kind === 'decimal') return ['小数型'];
    if (token.kind === 'integer') return ['整数型'];
    if (token.kind === 'identifier') return [precedingTypes.get(normalizeIdentifier(token.value)) || ''];
    return [];
  }).filter(Boolean);
  if (valueTypes.some(type => /文本|字符串/u.test(type))) return '文本型';
  if (valueTypes.some(type => /小数|双精度/u.test(type))) return '小数型';
  if (valueTypes.some(type => /整数|长整数|字节/u.test(type))) return '整数型';
  return undefined;
}

function tokenizeSafeExpression(expression: string): Array<{ kind: 'string' | 'integer' | 'decimal' | 'identifier' | 'operator' | 'paren'; value: string }> | undefined {
  const tokens: Array<{ kind: 'string' | 'integer' | 'decimal' | 'identifier' | 'operator' | 'paren'; value: string }> = [];
  let rest = expression.trim();
  while (rest) {
    const whitespace = rest.match(/^\s+/u);
    if (whitespace) { rest = rest.slice(whitespace[0].length); continue; }
    const string = rest.match(/^(?:"(?:\\.|[^"\\])*"|“[^”]*”)/u);
    if (string) { tokens.push({ kind: 'string', value: string[0] }); rest = rest.slice(string[0].length); continue; }
    const number = rest.match(/^\d+(?:\.\d+)?/u);
    if (number) { tokens.push({ kind: number[0].includes('.') ? 'decimal' : 'integer', value: number[0] }); rest = rest.slice(number[0].length); continue; }
    const identifier = rest.match(/^[\p{L}_][\p{L}\p{N}_]*/u);
    if (identifier) { tokens.push({ kind: 'identifier', value: identifier[0] }); rest = rest.slice(identifier[0].length); continue; }
    const operator = rest.match(/^(?:&&|\|\||==|!=|<=|>=|[+\-*/%!<>])/u);
    if (operator) { tokens.push({ kind: 'operator', value: operator[0] }); rest = rest.slice(operator[0].length); continue; }
    const paren = rest.match(/^[()（）]/u);
    if (paren) { tokens.push({ kind: 'paren', value: paren[0] }); rest = rest.slice(paren[0].length); continue; }
    return undefined;
  }
  return tokens;
}

function areGlobalTypesCompatible(expected: string, actual: string): boolean {
  const category = (type: string) => {
    if (/文本|字符串/u.test(type)) return 'text';
    if (/逻辑|布尔/u.test(type)) return 'bool';
    if (/小数|双精度/u.test(type)) return 'decimal';
    if (/整数|长整数|字节/u.test(type)) return 'integer';
    return normalizeIdentifier(type);
  };
  const expectedCategory = category(expected);
  const actualCategory = category(actual);
  return expectedCategory === actualCategory || (expectedCategory === 'decimal' && actualCategory === 'integer');
}

function createDiagnostic(
  level: LingCppDiagnostic['level'],
  line: number,
  codeSnippet: string,
  message: string,
  suggestion: string
): LingCppDiagnostic {
  return { id: `lingcpp-project-global-${line}-${message}`, line, level, message, codeSnippet, suggestion };
}

export function projectGlobalTypes(globals: LingCppGlobalVariable[]): Map<string, string> {
  return new Map(globals.map(global => [normalizeIdentifier(global.name), global.type]));
}

export function findProjectGlobalDefinition(
  name: string,
  context: LingCppProjectGlobalContext
): { filePath: string; line: number; global: LingCppGlobalVariable } | undefined {
  const normalizedName = normalizeIdentifier(name);
  const global = context.globals.find(item => normalizeIdentifier(item.name) === normalizedName);
  return global ? { filePath: context.filePath, line: global.line, global } : undefined;
}

export function renameProjectGlobalAcrossSources(
  sources: Array<{ filePath: string; sourceCode: string }>,
  context: LingCppProjectGlobalContext,
  oldName: string,
  newName: string
): Array<{ filePath: string; sourceCode: string }> {
  const definition = findProjectGlobalDefinition(oldName, context);
  const nextName = newName.trim();
  if (!definition) throw new Error(`未找到项目全局变量：${oldName}`);
  if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(nextName)) throw new Error('新的项目全局变量名不是有效标识符。');
  if (context.globals.some(global => normalizeIdentifier(global.name) === normalizeIdentifier(nextName) && normalizeIdentifier(global.name) !== normalizeIdentifier(oldName))) {
    throw new Error(`项目全局变量 ${nextName} 已存在。`);
  }
  return sources.map(source => ({ ...source, sourceCode: renameIdentifierOutsideStringsAndComments(source.sourceCode, oldName, nextName) }));
}

function renameIdentifierOutsideStringsAndComments(sourceCode: string, oldName: string, newName: string): string {
  const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const identifier = new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'gu');
  const sourceLines = sourceCode.split(/\r?\n/u);
  const opaqueLines = collectLingCppTextBlockOpaqueLines(scanLingCppTextBlockRanges(sourceLines), sourceLines.length);
  let lineNumber = 0;
  return sourceCode.split(/(\r?\n)/u).map(part => {
    if (/^\r?\n$/u.test(part)) return part;
    lineNumber += 1;
    if (opaqueLines.has(lineNumber)) return part; // 多行文本块内容不参与全局变量重命名
    let output = '';
    let segment = '';
    let quote: '"' | '“' | undefined;
    for (let index = 0; index < part.length; index += 1) {
      const character = part[index];
      if (!quote && character === '/' && part[index + 1] === '/') {
        output += segment.replace(identifier, newName) + part.slice(index);
        return output;
      }
      if (!quote && (character === '"' || character === '“')) {
        output += segment.replace(identifier, newName);
        segment = character;
        quote = character;
        continue;
      }
      segment += character;
      if ((quote === '"' && character === '"' && segment.length > 1 && part[index - 1] !== '\\') || (quote === '“' && character === '”')) {
        output += segment;
        segment = '';
        quote = undefined;
      }
    }
    return output + (quote ? segment : segment.replace(identifier, newName));
  }).join('');
}

export function projectSymbolTypes(constants: LingCppConstant[], globals: LingCppGlobalVariable[]): Map<string, string> {
  return new Map([
    ...constants.map(constant => [normalizeIdentifier(constant.name), constant.type] as const),
    ...globals.map(global => [normalizeIdentifier(global.name), global.isArray ? `${global.type}[]` : global.type] as const)
  ]);
}
