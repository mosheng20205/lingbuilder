import { InstalledModule, ModuleTargetContribution } from './types';

export const DEFAULT_MODULE_TARGET_ID = 'windows-msvc-win32';

export function getPreferredModuleTarget(
  module: InstalledModule,
  preferredTargetId = DEFAULT_MODULE_TARGET_ID
): ModuleTargetContribution | undefined {
  const targets = module.manifest.targets || [];
  const preferredArch = preferredTargetId.endsWith('-x64') ? 'x64' : 'win32';
  const isCompatible = (target: ModuleTargetContribution) => (
    target.platform === 'windows' && target.toolchain === 'msvc' && target.arch === preferredArch
  );
  return targets.find(target => target.id === preferredTargetId && isCompatible(target))
    || targets.find(isCompatible);
}

export function getUnsupportedModuleTargetDiagnostic(
  module: InstalledModule,
  preferredTargetId = DEFAULT_MODULE_TARGET_ID
): string | undefined {
  if (getPreferredModuleTarget(module, preferredTargetId)) return undefined;
  const availableTargets = (module.manifest.targets || []).map(target => target.id).join('、') || '无';
  return `模块 ${module.manifest.name} 未提供兼容目标 ${preferredTargetId}（可用目标：${availableTargets}），已跳过该模块的原生依赖。`;
}

export function getModuleTargets(module: InstalledModule): ModuleTargetContribution[] {
  return module.manifest.targets || [];
}
