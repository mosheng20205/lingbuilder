import { normalizeIdentifier } from '../lingCpp/parser';
import type { LingCppModuleContext } from './types';
import type { InstalledModule, ModuleConstantContribution, ModuleConstantValueType } from './types';

export interface LingCppModuleConstant {
  name: string;
  type: ModuleConstantValueType;
  value: number | string | boolean;
  description: string;
  level: 'basic' | 'advanced';
  moduleId: string;
  moduleName: string;
}

const CONSTANT_NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
const CONSTANT_VALUE_TYPES: readonly string[] = [
  '整数型', '长整数型', '字节型', '小数型', '双精度小数型', '文本型', '逻辑型'
];
const INTEGER_TYPES = new Set<string>(['整数型', '长整数型', '字节型']);

function normalizeConstantName(name: string): string {
  return normalizeIdentifier(name);
}

/** 校验 contributes.constants；与 validateModuleTypeContributions 同一门禁口径。 */
export function validateModuleConstantContributions(value: unknown, diagnostics: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) {
    diagnostics.push('contributes.constants 必须是数组。');
    return;
  }

  const seen = new Set<string>();
  (value as Array<Record<string, unknown>>).forEach((entry, index) => {
    const label = `contributes.constants[${index}]`;
    const name = typeof entry?.name === 'string' ? entry.name.trim() : '';
    if (!name || !CONSTANT_NAME_RE.test(name) || name.startsWith('#')) {
      diagnostics.push(`${label}.name 必须是有效的 LingCpp 常量名称（中文、字母、数字、下划线，不能以数字开头，不能带 # 前缀）。`);
    }
    const key = name ? normalizeConstantName(name) : '';
    if (key && seen.has(key)) diagnostics.push(`模块常量名称重复：${name}`);
    if (key) seen.add(key);
    if (!CONSTANT_VALUE_TYPES.includes(String(entry?.type))) {
      diagnostics.push(`${label}.type 只允许 ${CONSTANT_VALUE_TYPES.join('、')}。`);
      return;
    }
    const constantValue = entry?.value;
    const type = String(entry?.type) as ModuleConstantValueType;
    if (type === '文本型' && typeof constantValue !== 'string') {
      diagnostics.push(`模块常量 ${name || index + 1} 的 value 必须是文本字面量。`);
    } else if (type === '逻辑型' && typeof constantValue !== 'boolean') {
      diagnostics.push(`模块常量 ${name || index + 1} 的 value 必须是 true 或 false。`);
    } else if (INTEGER_TYPES.has(type) && (typeof constantValue !== 'number' || !Number.isInteger(constantValue))) {
      diagnostics.push(`模块常量 ${name || index + 1} 的 value 必须是整数。`);
    } else if ((type === '小数型' || type === '双精度小数型') && typeof constantValue !== 'number') {
      diagnostics.push(`模块常量 ${name || index + 1} 的 value 必须是数值。`);
    }
    if (typeof entry?.description !== 'string' || !entry.description.trim()) {
      diagnostics.push(`${label}.description 必须是非空中文说明。`);
    }
    if (entry?.level !== undefined && !['basic', 'advanced'].includes(String(entry.level))) {
      diagnostics.push(`${label}.level 只允许 basic 或 advanced。`);
    }
  });
}

/** 收集启用模块公开的全部常量；顺序按模块启用序，供补全、悬停与 C++ 生成消费。 */
export function getModuleConstants(modules: readonly InstalledModule[] = []): LingCppModuleConstant[] {
  return modules.flatMap(module => (module.manifest.contributes?.constants || []).map(constant => ({
    name: constant.name,
    type: constant.type,
    value: constant.value,
    description: constant.description,
    level: constant.level === 'advanced' ? 'advanced' as const : 'basic' as const,
    moduleId: module.manifest.id,
    moduleName: module.manifest.displayName || module.manifest.name
  })));
}

/** 跨启用模块的同名常量是硬冲突：与结构化公开类型同一口径，构建前阻断。 */
export function getEnabledModuleConstantDiagnostics(moduleContext?: LingCppModuleContext): string[] {
  const owners = new Map<string, { moduleId: string; name: string }>();
  const diagnostics: string[] = [];
  (moduleContext?.enabledModules || []).forEach(module => {
    (module.manifest.contributes?.constants || []).forEach((constant: ModuleConstantContribution) => {
      const key = normalizeConstantName(constant.name);
      const owner = owners.get(key);
      if (owner && owner.moduleId !== module.manifest.id) {
        diagnostics.push(`模块 ${owner.moduleId} 与 ${module.manifest.id} 重复公开常量 ${constant.name}；请禁用其中一个模块，或让模块作者为常量名加模块前缀。`);
      } else if (!owner) {
        owners.set(key, { moduleId: module.manifest.id, name: constant.name });
      }
    });
  });
  return diagnostics;
}

/** 查找提供指定常量名的模块（含未启用模块），用于「未启用模块」中文诊断。 */
export function findModuleConstantOwner(
  name: string,
  modules: readonly InstalledModule[] = []
): { moduleId: string; moduleName: string } | undefined {
  const key = normalizeConstantName(name);
  const owner = modules.find(module => (module.manifest.contributes?.constants || [])
    .some(constant => normalizeConstantName(constant.name) === key));
  if (!owner) return undefined;
  return { moduleId: owner.manifest.id, moduleName: owner.manifest.displayName || owner.manifest.name };
}
