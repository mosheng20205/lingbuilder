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

// 同一条生成源码要同时服务 Win32 与 x64 两个构建配置；架构回退只在这一对
// MSVC target 之间进行，其它平台/工具链 target 一律不参与。
export function getSiblingMsvcTargetId(targetId: string): string {
  return targetId === 'windows-msvc-x64' ? 'windows-msvc-win32' : 'windows-msvc-x64';
}

export function hasCompatibleWindowsMsvcTarget(module: InstalledModule): boolean {
  return [DEFAULT_MODULE_TARGET_ID, getSiblingMsvcTargetId(DEFAULT_MODULE_TARGET_ID)]
    .some(targetId => Boolean(getPreferredModuleTarget(module, targetId)));
}

export function getUnsupportedModuleTargetDiagnostic(
  module: InstalledModule,
  preferredTargetId = DEFAULT_MODULE_TARGET_ID
): string | undefined {
  // 头文件/源码声明可跨 Win32/x64 复用：只要任一 MSVC 架构 target 存在，生成源码
  // 即可包含该模块；只有两个架构都缺席才视为不可用。
  if (hasCompatibleWindowsMsvcTarget(module)) return undefined;
  const availableTargets = (module.manifest.targets || []).map(target => target.id).join('、') || '无';
  return `模块 ${module.manifest.name} 未提供兼容目标 ${preferredTargetId}（可用目标：${availableTargets}），已跳过该模块的原生依赖。`;
}

export function getModuleTargets(module: InstalledModule): ModuleTargetContribution[] {
  return module.manifest.targets || [];
}
