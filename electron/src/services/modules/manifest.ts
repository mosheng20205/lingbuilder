import {
  LingBuilderModuleManifest,
  LingBuilderModuleCategory,
  ModuleTargetContribution,
  ModuleTargetArch,
  ModuleTargetPlatform,
  ModuleTargetToolchain,
  ModuleBindingValueType
} from './types';

const CATEGORIES: LingBuilderModuleCategory[] = ['界面', '系统', '网络', '数据库', '图像', 'AI', '构建', '其他'];
const MODULE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,80}$/;
const TARGET_PLATFORMS: ModuleTargetPlatform[] = ['windows', 'linux', 'macos'];
const TARGET_ARCHES: ModuleTargetArch[] = ['win32', 'x64', 'arm64', 'any'];
const TARGET_TOOLCHAINS: ModuleTargetToolchain[] = ['msvc', 'gcc', 'clang', 'cmake', 'any'];
const BINDING_VALUE_TYPES: ModuleBindingValueType[] = ['void', 'int', 'longLong', 'double', 'bool', 'wideString', 'utf8String', 'handle', 'raw'];

export function validateModuleManifest(value: unknown): { manifest?: LingBuilderModuleManifest; diagnostics: string[] } {
  const diagnostics: string[] = [];
  if (!value || typeof value !== 'object') {
    return { diagnostics: ['模块清单不是有效对象。'] };
  }

  const raw = value as Record<string, any>;
  if (raw.schemaVersion !== 2) diagnostics.push('schemaVersion 必须为 2；旧版 .lbmod v1 需要使用模块迁移工具重新打包。');
  if (typeof raw.id !== 'string' || !MODULE_ID_RE.test(raw.id)) diagnostics.push('模块 ID 必须是小写字母、数字、点、横线或下划线组成的稳定标识。');
  if (typeof raw.name !== 'string' || !raw.name.trim()) diagnostics.push('模块名称不能为空。');
  if (typeof raw.version !== 'string' || !raw.version.trim()) diagnostics.push('模块版本不能为空。');
  if (!CATEGORIES.includes(raw.category)) diagnostics.push('模块分类不在允许范围内。');
  if (typeof raw.description !== 'string' || !raw.description.trim()) diagnostics.push('模块说明不能为空。');

  const contributes = raw.contributes;
  if (contributes !== undefined && (!contributes || typeof contributes !== 'object')) {
    diagnostics.push('contributes 必须是对象。');
  }

  if (contributes?.commands) {
    if (!Array.isArray(contributes.commands)) diagnostics.push('contributes.commands 必须是数组。');
    else {
      const seen = new Set<string>();
      contributes.commands.forEach((command: any, index: number) => {
        if (typeof command?.name !== 'string' || !command.name.trim()) diagnostics.push(`第 ${index + 1} 个命令缺少 name。`);
        if (seen.has(command?.name)) diagnostics.push(`命令重复：${command.name}`);
        seen.add(command?.name);
        if (typeof command?.signature !== 'string' || !command.signature.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 signature。`);
        if (typeof command?.description !== 'string' || !command.description.trim()) diagnostics.push(`命令 ${command?.name || index + 1} 缺少 description。`);
      });
    }
  }

  validatePathArray(contributes?.docs?.map((doc: any) => doc?.path), 'docs.path', diagnostics);
  validatePathArray(contributes?.examples?.map((example: any) => example?.path), 'examples.path', diagnostics);
  validateTargets(raw.targets, diagnostics);
  validateBindings(raw.bindings, contributes?.commands || [], raw.targets || [], diagnostics);

  if (diagnostics.length > 0) return { diagnostics };
  return { manifest: raw as LingBuilderModuleManifest, diagnostics };
}

export function validateModuleRelativePath(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  if (value.includes('\0')) return false;
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith('/') || value.startsWith('\\')) return false;
  const normalized = value.replace(/\\/g, '/').split('/');
  return !normalized.some(part => part === '..' || part === '');
}

function validateTargets(targets: unknown, diagnostics: string[]): void {
  if (targets === undefined) return;
  if (!Array.isArray(targets)) {
    diagnostics.push('targets 必须是数组。');
    return;
  }
  const seen = new Set<string>();
  targets.forEach((target: ModuleTargetContribution, index: number) => {
    if (typeof target?.id !== 'string' || !target.id.trim()) diagnostics.push(`targets[${index}] 缺少 id。`);
    if (seen.has(target?.id)) diagnostics.push(`target 重复：${target.id}`);
    seen.add(target?.id);
    if (!TARGET_PLATFORMS.includes(target?.platform)) diagnostics.push(`targets[${index}].platform 不受支持。`);
    if (!TARGET_ARCHES.includes(target?.arch)) diagnostics.push(`targets[${index}].arch 不受支持。`);
    if (!TARGET_TOOLCHAINS.includes(target?.toolchain)) diagnostics.push(`targets[${index}].toolchain 不受支持。`);
    validatePathArray(target?.includeDirs, `targets[${index}].includeDirs`, diagnostics);
    validatePathArray(target?.sources, `targets[${index}].sources`, diagnostics);
    validatePathArray(target?.headers, `targets[${index}].headers`, diagnostics);
    validatePathArray(target?.libs, `targets[${index}].libs`, diagnostics);
    validatePathArray(target?.runtimeFiles, `targets[${index}].runtimeFiles`, diagnostics);
  });
}

function validateBindings(bindings: any, commands: any[], targets: any[], diagnostics: string[]): void {
  if (bindings === undefined) return;
  if (!bindings || typeof bindings !== 'object') {
    diagnostics.push('bindings 必须是对象。');
    return;
  }
  if (bindings.commands === undefined) return;
  if (!Array.isArray(bindings.commands)) {
    diagnostics.push('bindings.commands 必须是数组。');
    return;
  }
  const commandNames = new Set(commands.map(command => command?.name).filter(Boolean));
  const targetIds = new Set(targets.map(target => target?.id).filter(Boolean));
  bindings.commands.forEach((binding: any, index: number) => {
    if (typeof binding?.command !== 'string' || !binding.command.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 command。`);
    if (binding?.command && commandNames.size > 0 && !commandNames.has(binding.command)) diagnostics.push(`binding 引用了未贡献的命令：${binding.command}`);
    if (typeof binding?.runtimeName !== 'string' || !binding.runtimeName.trim()) diagnostics.push(`bindings.commands[${index}] 缺少 runtimeName。`);
    if (binding?.returnType && !BINDING_VALUE_TYPES.includes(binding.returnType)) diagnostics.push(`bindings.commands[${index}].returnType 不受支持。`);
    if (binding?.parameters !== undefined) {
      if (!Array.isArray(binding.parameters)) diagnostics.push(`bindings.commands[${index}].parameters 必须是数组。`);
      else binding.parameters.forEach((parameter: any, parameterIndex: number) => {
        if (typeof parameter?.name !== 'string' || !parameter.name.trim()) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}] 缺少 name。`);
        if (!BINDING_VALUE_TYPES.includes(parameter?.type)) diagnostics.push(`bindings.commands[${index}].parameters[${parameterIndex}].type 不受支持。`);
      });
    }
    if (binding?.targetIds !== undefined) {
      if (!Array.isArray(binding.targetIds)) diagnostics.push(`bindings.commands[${index}].targetIds 必须是数组。`);
      else binding.targetIds.forEach((targetId: unknown) => {
        if (typeof targetId !== 'string' || (targetIds.size > 0 && !targetIds.has(targetId))) diagnostics.push(`binding 引用了不存在的 target：${String(targetId)}`);
      });
    }
  });
}

function validatePathArray(values: unknown, label: string, diagnostics: string[]): void {
  if (values === undefined) return;
  if (!Array.isArray(values)) {
    diagnostics.push(`${label} 必须是数组。`);
    return;
  }
  values.forEach((value, index) => {
    if (typeof value !== 'string' || !validateModuleRelativePath(value)) {
      diagnostics.push(`${label}[${index}] 不是安全的模块相对路径。`);
    }
  });
}
