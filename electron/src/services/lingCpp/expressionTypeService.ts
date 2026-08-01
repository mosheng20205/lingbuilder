import { normalizeIdentifier } from './parser';
import { LingCppModuleContext } from '../modules/types';
import { LingCppProjectTypeContext } from './types';

const MODULE_VALUE_TYPE_ALIASES: Record<string, string> = {
  int: '整数型',
  integer: '整数型',
  longlong: '长整数型',
  double: '双精度小数型',
  float: '小数型',
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
  if (/^(?:L)?["“].*["”]$/su.test(value)) return '文本型';
  if (/^(真|假)$/u.test(value)) return '逻辑型';
  if (/^-?\d+$/u.test(value)) return '整数型';
  if (/^-?\d+\.\d+$/u.test(value)) return '小数型';

  const identifierType = scopeTypes.get(normalizeIdentifier(value));
  if (identifierType) return normalizeLingCppValueType(identifierType);

  const memberPath = value.match(/^([\p{L}_][\p{L}\p{N}_]*)((?:\s*\.\s*[\p{L}_][\p{L}\p{N}_]*)+)$/u);
  if (memberPath) {
    const rootType = scopeTypes.get(normalizeIdentifier(memberPath[1] || ''));
    const fields = (memberPath[2] || '').split(/\s*\.\s*/u).filter(Boolean);
    return normalizeLingCppValueType(resolveProjectFieldPathType(rootType, fields, projectTypes));
  }

  const call = value.match(/^([\w\u4e00-\u9fa5]+)\s*[（(]/u);
  if (!call) return undefined;
  const commandName = call[1] || '';
  const knownReturnType = commandReturnTypes.get(normalizeIdentifier(commandName));
  if (knownReturnType) return normalizeLingCppValueType(knownReturnType);

  for (const module of moduleContext?.enabledModules || []) {
    const contribution = (module.manifest.contributes?.commands || []).find(command =>
      command.name === commandName || (command.aliases || []).includes(commandName));
    const contributionType = normalizeLingCppValueType(contribution?.returnType);
    if (contributionType) return contributionType;

    const binding = (module.manifest.bindings?.commands || []).find(command => command.command === contribution?.name);
    const bindingType = normalizeLingCppValueType(binding?.returnType);
    if (bindingType) return bindingType;
  }
  return undefined;
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

export function areLingCppTypesCompatible(expected: string, actual: string): boolean {
  const category = (type: string) => {
    if (/文本|字符串/u.test(type)) return 'text';
    if (/字节集/u.test(type)) return 'bytes';
    if (/逻辑|布尔/u.test(type)) return 'bool';
    if (/小数|双精度/u.test(type)) return 'decimal';
    if (/整数|长整数|字节/u.test(type)) return 'integer';
    return normalizeIdentifier(type);
  };
  const expectedCategory = category(expected);
  const actualCategory = category(actual);
  return expectedCategory === actualCategory || (expectedCategory === 'decimal' && actualCategory === 'integer');
}
