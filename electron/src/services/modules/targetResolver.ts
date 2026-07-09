import { InstalledModule, ModuleTargetContribution } from './types';

export const DEFAULT_MODULE_TARGET_ID = 'windows-msvc-win32';

export function getPreferredModuleTarget(
  module: InstalledModule,
  preferredTargetId = DEFAULT_MODULE_TARGET_ID
): ModuleTargetContribution | undefined {
  const targets = module.manifest.targets || [];
  return targets.find(target => target.id === preferredTargetId)
    || targets.find(target => target.platform === 'windows' && target.toolchain === 'msvc' && target.arch === 'win32')
    || targets[0];
}

export function getModuleTargets(module: InstalledModule): ModuleTargetContribution[] {
  return module.manifest.targets || [];
}
