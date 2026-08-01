import type { LingCppDataType, LingCppProjectTypeContext } from '../lingCpp/types';
import { areLingCppTypesCompatible, inferLingCppExpressionType } from '../lingCpp/expressionTypeService';
import type {
  InstalledModule,
  LingBuilderModuleManifest,
  LingCppModuleContext,
  ModuleTypeContribution
} from './types';

const IDENTIFIER_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const SAFE_VALUE_TYPES = new Set([
  '文本型', '整数型', '长整数型', '逻辑型', '小数型', '双精度小数型', '字节型', '字节集'
].map(normalizeTypeName));

export interface ModulePublicArrayType {
  name: string;
  elementType: string;
  moduleId: string;
  moduleName: string;
  description: string;
}

export function getModulePublicTypeKind(type: ModuleTypeContribution): 'opaque' | 'record' | 'array' {
  return type.kind || 'opaque';
}

export function formatModulePublicType(type: ModuleTypeContribution): string {
  const kind = getModulePublicTypeKind(type);
  if (kind === 'array') return `${type.name} = ${(type.elementType || '未知类型').trim()}[]`;
  if (kind === 'record') return `数据类型 ${type.name}`;
  return type.cppType || '不透明类型';
}

export function formatModulePublicTypeSource(type: ModuleTypeContribution): string {
  const kind = getModulePublicTypeKind(type);
  if (kind === 'array') return `${type.name}`;
  if (kind !== 'record') return type.name;
  return [
    `数据类型 ${type.name}`,
    ...(type.fields || []).map(field => `    ${field.type} ${field.name}${field.isArray ? '[]' : ''}${field.initialValue?.trim() ? ` = ${field.initialValue.trim()}` : ''}`),
    '结束数据类型'
  ].join('\n');
}

export function getModuleRecordDataTypes(modules: readonly InstalledModule[] = []): LingCppDataType[] {
  return modules.flatMap(module => (module.manifest.contributes?.types || [])
    .filter(type => getModulePublicTypeKind(type) === 'record')
    .map(type => ({
      name: type.name,
      line: 1,
      endLine: Math.max(1, (type.fields || []).length + 2),
      note: type.description,
      fields: (type.fields || []).map((field, index) => ({
        name: field.name,
        type: field.type,
        line: index + 2,
        note: field.description,
        initialValue: field.initialValue,
        isArray: Boolean(field.isArray)
      })),
      origin: 'module' as const,
      sourceModuleId: module.manifest.id,
      sourceModuleName: module.manifest.displayName || module.manifest.name
    })));
}

export function getModulePublicArrayTypes(modules: readonly InstalledModule[] = []): ModulePublicArrayType[] {
  return modules.flatMap(module => (module.manifest.contributes?.types || [])
    .filter(type => getModulePublicTypeKind(type) === 'array' && Boolean(type.elementType?.trim()))
    .map(type => ({
      name: type.name,
      elementType: type.elementType!.trim(),
      moduleId: module.manifest.id,
      moduleName: module.manifest.displayName || module.manifest.name,
      description: type.description
    })));
}

export function createEffectiveLingCppTypeContext(
  projectTypes?: LingCppProjectTypeContext,
  moduleContext?: LingCppModuleContext
): LingCppProjectTypeContext | undefined {
  const moduleRecords = getModuleRecordDataTypes(moduleContext?.enabledModules || []);
  if (moduleRecords.length === 0) return projectTypes;
  return {
    filePath: projectTypes?.filePath || '',
    sourceCode: projectTypes?.sourceCode || '',
    dataTypes: [...(projectTypes?.dataTypes || []), ...moduleRecords]
  };
}

export function getModuleStructuredTypeNames(moduleContext?: LingCppModuleContext): string[] {
  return (moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || [])
    .filter(type => getModulePublicTypeKind(type) !== 'opaque')
    .map(type => type.name));
}

export function validateModuleTypeContributions(value: unknown, diagnostics: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    diagnostics.push('contributes.types 必须是数组。');
    return;
  }

  const types = value as Array<Record<string, unknown>>;
  const seenTypes = new Set<string>();
  const structuredTypes = new Map<string, Record<string, unknown>>();
  types.forEach((type, index) => {
    const label = `contributes.types[${index}]`;
    const name = typeof type?.name === 'string' ? type.name.trim() : '';
    const kind = type?.kind === undefined ? 'opaque' : type.kind;
    if (!name || (kind !== 'opaque' && !IDENTIFIER_RE.test(name))) diagnostics.push(`${label}.name 必须是有效的 LingCpp 类型名称。`);
    const key = normalizeTypeName(name);
    if (name && seenTypes.has(key)) diagnostics.push(`公开类型名称重复：${name}`);
    if (name) seenTypes.add(key);
    if (typeof type?.description !== 'string' || !type.description.trim()) diagnostics.push(`${label}.description 必须是非空中文说明。`);
    if (!['opaque', 'record', 'array'].includes(String(kind))) {
      diagnostics.push(`${label}.kind 只允许 opaque、record 或 array。`);
      return;
    }
    if (kind !== 'opaque' && name) structuredTypes.set(key, type);

    if (kind === 'opaque') {
      if (type.cppType !== undefined && (typeof type.cppType !== 'string' || !type.cppType.trim())) diagnostics.push(`${label}.cppType 必须是非空 C++ 类型文本。`);
      if (type.fields !== undefined) diagnostics.push(`${label} 是 opaque 类型，不能声明 fields。`);
      if (type.elementType !== undefined) diagnostics.push(`${label} 是 opaque 类型，不能声明 elementType。`);
      return;
    }

    if (type.cppType !== undefined) diagnostics.push(`${label} 是结构化 LingCpp 类型，不能使用 cppType 绕过字段和数组契约。`);
    if (SAFE_VALUE_TYPES.has(key)) diagnostics.push(`${label}.name 与 LingCpp 基础类型 ${name} 冲突。`);
    if (kind === 'array') {
      if (typeof type.elementType !== 'string' || !IDENTIFIER_RE.test(type.elementType.trim())) diagnostics.push(`${label}.elementType 必须是有效的 LingCpp 元素类型名称。`);
      if (type.fields !== undefined) diagnostics.push(`${label} 是 array 类型，不能声明 fields。`);
      return;
    }

    if (!Array.isArray(type.fields)) {
      diagnostics.push(`${label}.fields 必须是数组。`);
      return;
    }
    if (type.elementType !== undefined) diagnostics.push(`${label} 是 record 类型，不能声明 elementType。`);
    const seenFields = new Set<string>();
    type.fields.forEach((field: any, fieldIndex: number) => {
      const fieldLabel = `${label}.fields[${fieldIndex}]`;
      const fieldName = typeof field?.name === 'string' ? field.name.trim() : '';
      const fieldType = typeof field?.type === 'string' ? field.type.trim() : '';
      if (!fieldName || !IDENTIFIER_RE.test(fieldName)) diagnostics.push(`${fieldLabel}.name 必须是有效的 LingCpp 字段名称。`);
      const fieldKey = normalizeTypeName(fieldName);
      if (fieldName && seenFields.has(fieldKey)) diagnostics.push(`公开记录 ${name} 的字段名称重复：${fieldName}`);
      if (fieldName) seenFields.add(fieldKey);
      if (!fieldType || !IDENTIFIER_RE.test(fieldType)) diagnostics.push(`${fieldLabel}.type 必须是类型名称；数组请使用 isArray。`);
      if (field?.description !== undefined && (typeof field.description !== 'string' || !field.description.trim())) diagnostics.push(`${fieldLabel}.description 必须是非空中文说明。`);
      if (field?.initialValue !== undefined && typeof field.initialValue !== 'string') diagnostics.push(`${fieldLabel}.initialValue 必须是文本形式的 LingCpp 初始值。`);
      if (field?.isArray !== undefined && typeof field.isArray !== 'boolean') diagnostics.push(`${fieldLabel}.isArray 必须是逻辑值。`);
      const initialValue = typeof field?.initialValue === 'string' ? field.initialValue.trim() : '';
      const fieldTypeKey = normalizeTypeName(fieldType);
      if (initialValue && (field?.isArray || fieldTypeKey === normalizeTypeName('字节集') || !SAFE_VALUE_TYPES.has(fieldTypeKey))) {
        diagnostics.push(`${fieldLabel} 的数组、字节集或结构化字段只能默认空初始化。`);
      } else if (initialValue && SAFE_VALUE_TYPES.has(fieldTypeKey)) {
        const inferredType = inferLingCppExpressionType(initialValue, new Map());
        if (!inferredType || !areLingCppTypesCompatible(fieldType, inferredType)) {
          diagnostics.push(`${fieldLabel}.initialValue 与字段类型 ${fieldType} 不兼容。`);
        }
      }
    });
  });

  const allowedTypes = new Set([...SAFE_VALUE_TYPES, ...structuredTypes.keys()]);
  structuredTypes.forEach((type, key) => {
    const kind = type.kind === undefined ? 'opaque' : type.kind;
    const references = kind === 'array'
      ? [String(type.elementType || '')]
      : Array.isArray(type.fields) ? type.fields.map((field: any) => String(field?.type || '')) : [];
    references.forEach(reference => {
      const referenceKey = normalizeTypeName(reference);
      if (referenceKey && !allowedTypes.has(referenceKey)) diagnostics.push(`公开类型 ${String(type.name || key)} 引用了未公开或不安全的字段类型 ${reference}。`);
    });
  });

  findStructuredTypeCycles(structuredTypes).forEach(cycle => {
    diagnostics.push(`模块公开类型存在循环嵌套：${cycle.join(' → ')}。`);
  });
}

export function getEnabledModuleStructuredTypeDiagnostics(moduleContext?: LingCppModuleContext): string[] {
  const owners = new Map<string, { moduleId: string; kind: 'opaque' | 'record' | 'array' }>();
  const diagnostics: string[] = [];
  (moduleContext?.enabledModules || []).forEach(module => {
    (module.manifest.contributes?.types || []).forEach(type => {
      const key = normalizeTypeName(type.name);
      const kind = getModulePublicTypeKind(type);
      const owner = owners.get(key);
      if (owner && owner.moduleId !== module.manifest.id && (owner.kind !== 'opaque' || kind !== 'opaque')) {
        diagnostics.push(`模块 ${owner.moduleId} 与 ${module.manifest.id} 重复公开类型 ${type.name}；结构化类型不能与其他公开类型同名。`);
      } else if (!owner) {
        owners.set(key, { moduleId: module.manifest.id, kind });
      }
    });
  });
  return diagnostics;
}

export function findModulePublicType(name: string, modules: readonly InstalledModule[] = []): { module: InstalledModule; type: ModuleTypeContribution } | undefined {
  const key = normalizeTypeName(name);
  for (const module of modules) {
    const type = (module.manifest.contributes?.types || []).find(candidate => normalizeTypeName(candidate.name) === key);
    if (type) return { module, type };
  }
  return undefined;
}

export function manifestStructuredTypeNames(manifest: LingBuilderModuleManifest): string[] {
  return (manifest.contributes?.types || []).filter(type => getModulePublicTypeKind(type) !== 'opaque').map(type => type.name);
}

function findStructuredTypeCycles(types: Map<string, Record<string, unknown>>): string[][] {
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (key: string) => {
    if (visiting.has(key)) {
      const start = stack.indexOf(key);
      cycles.push([...stack.slice(Math.max(0, start)), key].map(item => String(types.get(item)?.name || item)));
      return;
    }
    if (visited.has(key)) return;
    visiting.add(key);
    stack.push(key);
    const type = types.get(key);
    const references = type?.kind === 'array'
      ? [String(type.elementType || '')]
      : Array.isArray(type?.fields) ? type.fields.map((field: any) => String(field?.type || '')) : [];
    references.map(normalizeTypeName).filter(reference => types.has(reference)).forEach(visit);
    stack.pop();
    visiting.delete(key);
    visited.add(key);
  };
  types.forEach((_type, key) => visit(key));
  return cycles;
}

function normalizeTypeName(value: string): string {
  return value.trim().toLocaleLowerCase();
}
