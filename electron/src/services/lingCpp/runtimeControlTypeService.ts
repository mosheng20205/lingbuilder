import type {
  LingCppModuleContext,
  ModuleCommandBindingParameter,
  ModuleRuntimeControlContribution
} from '../modules/types';
import { normalizeIdentifier, parseLingCpp } from './parser';
import type { LingCppMethod, LingCppParseResult } from './types';

export interface LingCppRuntimeControlType {
  moduleId: string;
  designerType: string;
  contract: ModuleRuntimeControlContribution;
}

export interface LingCppRuntimeControlVariable {
  name: string;
  type: string;
  line: number;
  kind: 'parameter' | 'local';
}

/** 运行时控件变量查找所需的最小方法形状，便于复用一次解析结果。 */
export type RuntimeControlMethodCandidate = Pick<LingCppMethod, 'line' | 'endLine' | 'parameters' | 'locals'>;

/** 运行时控件类型目录按 moduleContext 引用缓存：模块上下文在 App 里保持引用稳定，
 *  而语言诊断/补全会对每个局部变量、参数、控件引用反复查询，重建目录是 O(控件数) 的热点。 */
interface LingCppRuntimeControlTypeCatalog {
  types: LingCppRuntimeControlType[];
  /** 归一化后的 lingCppType 集合，用于 isLingCppRuntimeControlType 的 O(1) 判定。 */
  typeNames: Set<string>;
}
const runtimeControlTypeCatalogCache = new WeakMap<LingCppModuleContext, LingCppRuntimeControlTypeCatalog>();
const EMPTY_RUNTIME_CONTROL_CATALOG: LingCppRuntimeControlTypeCatalog = { types: [], typeNames: new Set<string>() };

function getRuntimeControlTypeCatalog(moduleContext?: LingCppModuleContext): LingCppRuntimeControlTypeCatalog {
  if (!moduleContext) return EMPTY_RUNTIME_CONTROL_CATALOG;
  const cached = runtimeControlTypeCatalogCache.get(moduleContext);
  if (cached) return cached;
  const types = collectLingCppRuntimeControlTypes(moduleContext);
  const catalog: LingCppRuntimeControlTypeCatalog = {
    types,
    typeNames: new Set(types.map(item => normalizeIdentifier(item.contract.lingCppType)))
  };
  runtimeControlTypeCatalogCache.set(moduleContext, catalog);
  return catalog;
}

function collectLingCppRuntimeControlTypes(moduleContext: LingCppModuleContext): LingCppRuntimeControlType[] {
  const result: LingCppRuntimeControlType[] = [];
  for (const module of moduleContext.enabledModules || []) {
    for (const control of module.manifest.contributes?.designerControls || []) {
      if (!control.runtimeControl) continue;
      result.push({ moduleId: module.manifest.id, designerType: control.namespacedType || control.type, contract: control.runtimeControl });
    }
  }
  return result;
}

export function getLingCppRuntimeControlTypes(moduleContext?: LingCppModuleContext): LingCppRuntimeControlType[] {
  return getRuntimeControlTypeCatalog(moduleContext).types;
}

export function getLingCppRuntimeControlTypeNames(moduleContext?: LingCppModuleContext): Set<string> {
  return getRuntimeControlTypeCatalog(moduleContext).typeNames;
}

export function isLingCppRuntimeControlType(type: string | undefined, moduleContext?: LingCppModuleContext): boolean {
  if (!type || !moduleContext) return false;
  // 类型名含 `[]` 后缀时需要去掉再比较，其余情况直接命中集合，避免每次都做正则替换。
  const normalized = type.endsWith('[]')
    ? normalizeIdentifier(type.replace(/\[\]$/u, ''))
    : normalizeIdentifier(type);
  return getRuntimeControlTypeCatalog(moduleContext).typeNames.has(normalized);
}

export function isRuntimeControlTypeCompatibleWithParameter(
  type: string,
  parameter: ModuleCommandBindingParameter,
  moduleContext?: LingCppModuleContext
): boolean {
  if (parameter.type !== 'controlRef') return false;
  const runtimeType = getLingCppRuntimeControlTypes(moduleContext)
    .find(item => normalizeIdentifier(item.contract.lingCppType) === normalizeIdentifier(type));
  if (!runtimeType) return false;
  const allowed = new Set((parameter.controlTypes || []).map(normalizeIdentifier));
  return allowed.size === 0
    || allowed.has(normalizeIdentifier(runtimeType.designerType))
    || allowed.has(normalizeIdentifier(runtimeType.designerType.split('/').at(-1) || ''))
    || allowed.has(normalizeIdentifier(runtimeType.contract.lingCppType));
}

export function getRuntimeControlVariablesAtLine(
  source: string,
  line: number,
  moduleContext?: LingCppModuleContext
): LingCppRuntimeControlVariable[] {
  const parsed = parseLingCpp(source);
  return getRuntimeControlVariablesFromMethods(collectRuntimeControlMethodCandidates(parsed), line, moduleContext);
}

/**
 * 收集所有可能包含运行时控件变量的方法（类方法 + 功能库方法）。
 * 调用方持有一次解析结果后应复用该列表，禁止在每个引用处重新全文解析。
 */
export function collectRuntimeControlMethodCandidates(parsed: LingCppParseResult): RuntimeControlMethodCandidate[] {
  return [
    ...parsed.program.classes.flatMap(cls => cls.methods),
    ...parsed.program.functionLibraries.flatMap(library => library.methods)
  ];
}

/**
 * 在已解析的方法集合中查找指定行可见的运行时控件变量。
 * 与 getRuntimeControlVariablesAtLine 语义一致，但复用调用方的解析结果。
 */
export function getRuntimeControlVariablesFromMethods(
  methods: readonly RuntimeControlMethodCandidate[],
  line: number,
  moduleContext?: LingCppModuleContext
): LingCppRuntimeControlVariable[] {
  const method = methods.find(item => line >= item.line && line <= (item.endLine || Number.MAX_SAFE_INTEGER));
  if (!method) return [];
  return [
    ...method.parameters
      .filter(parameter => isLingCppRuntimeControlType(parameter.type, moduleContext))
      .map(parameter => ({ name: parameter.name, type: parameter.type, line: method.line, kind: 'parameter' as const })),
    ...(method.locals || [])
      .filter(local => local.line <= line && isLingCppRuntimeControlType(local.type, moduleContext))
      .map(local => ({ name: local.name, type: local.type, line: local.line, kind: 'local' as const }))
  ];
}

export function getRuntimeControlCommandReturnType(commandName: string, moduleContext?: LingCppModuleContext): string | undefined {
  for (const module of moduleContext?.enabledModules || []) {
    const contribution = (module.manifest.contributes?.commands || [])
      .find(command => command.name === commandName || (command.aliases || []).includes(commandName));
    const binding = (module.manifest.bindings?.commands || []).find(command => command.command === contribution?.name);
    const returnType = String(binding?.returnType || contribution?.returnType || '');
    if (isLingCppRuntimeControlType(returnType, moduleContext)) return returnType;
  }
  return undefined;
}
