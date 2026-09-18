import { normalizeIdentifier } from './parser';
import { splitLingCppControlArguments } from './controlFlow';
import { getLingCppParameterElementType, isLingCppArrayParameterType } from './parameterTypeService';
import { LingCppModuleContext, ModuleCommandBinding } from '../modules/types';
import { LingCppProjectTypeContext } from './types';

/** 数组成员型由同一次调用的数组实参决定，没有固定标签。 */
const DYNAMIC_ARRAY_ELEMENT_TYPES = new Set(['arrayelement', '数组成员', '数组成员型']);

const MODULE_VALUE_TYPE_ALIASES: Record<string, string> = {
  int: '整数型',
  integer: '整数型',
  longlong: '长整数型',
  double: '双精度小数型',
  float: '单精度小数型',
  bool: '逻辑型',
  boolean: '逻辑型',
  widestring: '文本型',
  utf8string: '文本型',
  string: '文本型',
  handle: '窗口句柄',
  raw: '原始值'
};

export function normalizeLingCppValueType(type: string | undefined): string | undefined {
  const trimmed = type?.trim();
  if (!trimmed || /^(空|无|void|none|null)$/iu.test(trimmed)) return undefined;
  const normalized = normalizeIdentifier(trimmed);
  if (normalized === 'bytes' || normalized === 'bytearray') return '字节集';
  if (DYNAMIC_ARRAY_ELEMENT_TYPES.has(normalized)) return undefined;
  if (isLingCppArrayParameterType(trimmed)) {
    const elementType = normalizeLingCppValueType(getLingCppParameterElementType(trimmed));
    return elementType ? `${elementType}[]` : undefined;
  }
  return MODULE_VALUE_TYPE_ALIASES[normalized] || trimmed;
}

export function inferLingCppExpressionType(
  expression: string,
  scopeTypes: Map<string, string>,
  moduleContext?: LingCppModuleContext,
  commandReturnTypes: ReadonlyMap<string, string> = new Map(),
  projectTypes?: LingCppProjectTypeContext
): string | undefined {
  const value = expression.trim();
  if (value === '当前窗口') return '控件容器';
  if (/^(?:L)?["“].*["”]$/su.test(value)) return '文本型';
  if (/^(真|假)$/u.test(value)) return '逻辑型';
  if (/^-?\d+$/u.test(value)) return '整数型';
  if (/^-?\d+\.\d+$/u.test(value)) return '小数型';

  const identifierType = scopeTypes.get(normalizeIdentifier(value));
  if (identifierType) return normalizeLingCppValueType(identifierType);

  const indexAccess = value.match(/^([\p{L}_][\p{L}\p{N}_]*(?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)*)\s*[[［][\s\S]+[\]］]$/u);
  if (indexAccess) {
    const containerType = inferLingCppExpressionType(indexAccess[1] || '', scopeTypes, moduleContext, commandReturnTypes, projectTypes);
    if (containerType && isLingCppArrayParameterType(containerType)) {
      return normalizeLingCppValueType(getLingCppParameterElementType(containerType));
    }
    return containerType === '字节集' ? '字节型' : undefined;
  }

  const memberPath = value.match(/^([\p{L}_][\p{L}\p{N}_]*)((?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)+)$/u);
  if (memberPath) {
    const rootType = scopeTypes.get(normalizeIdentifier(memberPath[1] || ''));
    const fields = (memberPath[2] || '').split(/\s*\.\s*/u).filter(Boolean);
    return normalizeLingCppValueType(resolveProjectFieldPathType(rootType, fields, projectTypes));
  }

  const call = value.match(/^([\w\u4e00-\u9fa5]+)\s*[（(]/u);
  if (!call) return undefined;
  const callArgumentsText = value.match(/^[\p{L}\p{N}_]+\s*[（(]([\s\S]*)[）)]\s*$/u)?.[1] || '';
  const commandName = call[1] || '';
  const knownReturnType = commandReturnTypes.get(normalizeIdentifier(commandName));
  if (knownReturnType) return normalizeLingCppValueType(knownReturnType);

  for (const module of moduleContext?.enabledModules || []) {
    const contribution = (module.manifest.contributes?.commands || []).find(command =>
      command.name === commandName || (command.aliases || []).includes(commandName));
    const binding = (module.manifest.bindings?.commands || []).find(command => command.command === contribution?.name);
    // 数组成员型命令没有固定返回类型，必须回到本次调用的数组实参上求解。
    if (binding?.returnType === 'arrayElement') {
      return resolveArrayElementReturnType(callArgumentsText, binding, scopeTypes, moduleContext, commandReturnTypes, projectTypes);
    }
    const contributionType = normalizeLingCppValueType(contribution?.returnType);
    if (contributionType) return contributionType;

    const bindingType = normalizeLingCppValueType(binding?.returnType);
    if (bindingType) return bindingType;
  }
  return undefined;
}

function resolveArrayElementReturnType(
  argumentsText: string,
  binding: ModuleCommandBinding,
  scopeTypes: Map<string, string>,
  moduleContext: LingCppModuleContext | undefined,
  commandReturnTypes: ReadonlyMap<string, string>,
  projectTypes: LingCppProjectTypeContext | undefined
): string | undefined {
  const arrayParameterIndex = (binding.parameters || []).findIndex(parameter => parameter.type === 'array');
  if (arrayParameterIndex < 0) return undefined;
  const argument = splitLingCppControlArguments(argumentsText)[arrayParameterIndex];
  if (!argument) return undefined;
  const arrayType = inferLingCppExpressionType(argument, scopeTypes, moduleContext, commandReturnTypes, projectTypes);
  return arrayType && isLingCppArrayParameterType(arrayType)
    ? normalizeLingCppValueType(getLingCppParameterElementType(arrayType))
    : undefined;
}

function resolveProjectFieldPathType(
  rootType: string | undefined,
  fields: string[],
  projectTypes?: LingCppProjectTypeContext
): string | undefined {
  if (!rootType) return undefined;
  const typeMap = new Map((projectTypes?.dataTypes || []).map(dataType => [normalizeIdentifier(dataType.name), dataType]));
  let currentType = rootType;
  for (const fieldName of fields) {
    const owner = typeMap.get(normalizeIdentifier(currentType));
    const field = owner?.fields.find(item => normalizeIdentifier(item.name) === normalizeIdentifier(fieldName));
    if (!field) return undefined;
    currentType = field.type;
  }
  return currentType;
}

/**
 * 模块公开类型的 C++ 表示归类（类型名 → integer/decimal/bool/text）。
 * 模块句柄类型（如 SQLite连接 的 cppType=long long）允许用 0 做哨兵初始化、
 * 与整数互比；不提供时按独立类别处理（与旧行为一致）。
 */
export type LingCppModuleTypeCategories = ReadonlyMap<string, string>;

export function areLingCppTypesCompatible(
  expected: string,
  actual: string,
  moduleTypeCategories?: LingCppModuleTypeCategories
): boolean {
  const expectedIsArray = isLingCppArrayParameterType(expected);
  const actualIsArray = isLingCppArrayParameterType(actual);
  // 数组和标量之间没有隐式转换，元素类型也不做整数到小数的放宽：std::vector<int> 与 std::vector<double> 是两种类型。
  if (expectedIsArray || actualIsArray) {
    return expectedIsArray && actualIsArray
      && lingCppTypeCategory(getLingCppParameterElementType(expected), moduleTypeCategories) === lingCppTypeCategory(getLingCppParameterElementType(actual), moduleTypeCategories);
  }
  const expectedCategory = lingCppTypeCategory(expected, moduleTypeCategories);
  const actualCategory = lingCppTypeCategory(actual, moduleTypeCategories);
  return expectedCategory === actualCategory || (expectedCategory === 'decimal' && actualCategory === 'integer');
}

function lingCppTypeCategory(type: string, moduleTypeCategories?: LingCppModuleTypeCategories): string {
  const bare = type.replace(/(?:\[\]|［］)$/u, '');
  if (moduleTypeCategories) {
    const mapped = moduleTypeCategories.get(normalizeIdentifier(bare));
    if (mapped) return mapped;
  }
  if (/文本|字符串/u.test(type)) return 'text';
  if (/字节集/u.test(type)) return 'bytes';
  if (/逻辑|布尔/u.test(type)) return 'bool';
  if (/小数|双精度/u.test(type)) return 'decimal';
  if (/整数|长整数|字节/u.test(type)) return 'integer';
  return normalizeIdentifier(type);
}
