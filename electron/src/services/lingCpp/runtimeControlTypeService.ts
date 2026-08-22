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

export function getLingCppRuntimeControlTypes(moduleContext?: LingCppModuleContext): LingCppRuntimeControlType[] {
  const result: LingCppRuntimeControlType[] = [];
  for (const module of moduleContext?.enabledModules || []) {
    for (const control of module.manifest.contributes?.designerControls || []) {
      if (!control.runtimeControl) continue;
      result.push({ moduleId: module.manifest.id, designerType: control.namespacedType || control.type, contract: control.runtimeControl });
    }
  }
  return result;
}

export function getLingCppRuntimeControlTypeNames(moduleContext?: LingCppModuleContext): Set<string> {
  return new Set(getLingCppRuntimeControlTypes(moduleContext).map(item => normalizeIdentifier(item.contract.lingCppType)));
}

export function isLingCppRuntimeControlType(type: string | undefined, moduleContext?: LingCppModuleContext): boolean {
  return Boolean(type && getLingCppRuntimeControlTypeNames(moduleContext).has(normalizeIdentifier(type.replace(/\[\]$/u, ''))));
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
