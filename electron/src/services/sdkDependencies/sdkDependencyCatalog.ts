import os from 'node:os';
import path from 'node:path';

export type SdkDependencyId = 'cef3' | 'fbro';

export interface SdkDependencyResource {
  id: SdkDependencyId;
  moduleId: string;
  name: string;
  version: string;
  sdkVersion?: string;
  platform: 'windows-x64';
  archiveName: string;
  downloadUrl: string;
  archiveBytes: number;
  expandedBytes: number;
  fileCount: number;
  sha256: string;
  requiredModuleIds: readonly string[];
  criticalFiles: readonly { relativePath: string; minimumBytes: number }[];
}

export const SDK_DEPENDENCY_RESOURCES: readonly SdkDependencyResource[] = [
  {
    id: 'cef3',
    moduleId: 'lingbuilder.cef3.sdk',
    name: 'CEF3 环境 SDK',
    version: '150.0.14+g7c1aa68+chromium-150.0.7871.129',
    platform: 'windows-x64',
    archiveName: 'lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip',
    downloadUrl: 'https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-windows-x64.zip',
    archiveBytes: 186_457_476,
    expandedBytes: 470_908_837,
    fileCount: 536,
    sha256: 'b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55',
    requiredModuleIds: ['lingbuilder.cef3.browser'],
    criticalFiles: [
      { relativePath: 'include/cef_app.h', minimumBytes: 5_000 },
      { relativePath: 'Release/libcef.dll', minimumBytes: 250 * 1024 * 1024 },
      { relativePath: 'Release/libcef.lib', minimumBytes: 50_000 },
      { relativePath: 'build_wrapper_x64_md/libcef_dll_wrapper/Release/libcef_dll_wrapper.lib', minimumBytes: 40 * 1024 * 1024 },
      { relativePath: 'Resources/icudtl.dat', minimumBytes: 8 * 1024 * 1024 },
      { relativePath: 'Resources/locales/zh-CN.pak', minimumBytes: 400_000 },
      { relativePath: 'bridge/x64/LingBuilderCefBridge.dll', minimumBytes: 10_000 }
    ]
  },
  {
    id: 'fbro',
    moduleId: 'lingbuilder.fbro.sdk',
    name: 'FBro 环境 SDK',
    version: '135.0.21.2.2.0',
    sdkVersion: '135.0.21',
    platform: 'windows-x64',
    archiveName: 'lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip',
    downloadUrl: 'https://msimgimg.xyz/uploads/lingbuilder-fbro-sdk-135.0.21.2.2.0-windows-x64.zip',
    archiveBytes: 245_575_922,
    expandedBytes: 830_471_391,
    fileCount: 478,
    sha256: '99ed17b2d649a91acf7552a5fce9427541a9fef287cbd8ef5a5855ebd449361f',
    requiredModuleIds: ['lingbuilder.fbro.browser'],
    criticalFiles: [
      { relativePath: 'runtime-manifest.json', minimumBytes: 5_000 },
      { relativePath: 'include/LingBuilderFbroBridge.h', minimumBytes: 5_000 },
      { relativePath: 'lib/x64/LingBuilderFbroBridge.lib', minimumBytes: 1_000 },
      { relativePath: 'bridge/x64/LingBuilderFbroBridge.dll', minimumBytes: 10_000 },
      { relativePath: 'official/include/FBroInit.h', minimumBytes: 1_000 },
      { relativePath: 'official/lib64/FBrowserCEF3lib.lib', minimumBytes: 1_000 },
      { relativePath: 'runtime/x64/libcef.dll', minimumBytes: 250 * 1024 * 1024 }
    ]
  }
] as const;

export function getSdkDependencyResource(id: SdkDependencyId): SdkDependencyResource {
  const resource = SDK_DEPENDENCY_RESOURCES.find(item => item.id === id);
  if (!resource) throw new Error(`未知 SDK 依赖：${id}`);
  return resource;
}

export function getRequiredSdkDependencyIds(moduleIds: readonly string[]): SdkDependencyId[] {
  const enabled = new Set(moduleIds);
  return SDK_DEPENDENCY_RESOURCES
    .filter(resource => resource.requiredModuleIds.some(moduleId => enabled.has(moduleId)))
    .map(resource => resource.id);
}

export function resolveSdkCacheRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const explicit = String(environment.LINGBUILDER_SDK_CACHE_ROOT || '').trim();
  if (explicit) {
    if (!path.isAbsolute(explicit)) throw new Error('LINGBUILDER_SDK_CACHE_ROOT 必须是绝对路径。');
    return path.resolve(explicit);
  }
  const profileRoot = process.platform === 'win32'
    ? String(environment.APPDATA || '').trim() || os.homedir()
    : String(environment.XDG_CACHE_HOME || '').trim() || path.join(os.homedir(), '.cache');
  return path.join(profileRoot, 'LingBuilder', 'sdk-cache');
}

export function getManagedSdkModuleRoot(cacheRoot: string, resource: SdkDependencyResource): string {
  return path.join(cacheRoot, 'modules', resource.moduleId);
}

export function getManagedSdkRoot(cacheRoot: string, resource: SdkDependencyResource): string {
  return path.join(getManagedSdkModuleRoot(cacheRoot, resource), 'sdk');
}

export function getSdkRootCandidates(
  resource: SdkDependencyResource,
  options: { workspaceRoot?: string; cacheRoot?: string; environment?: NodeJS.ProcessEnv; resourcesPath?: string } = {}
): Array<{ root: string; source: 'environment' | 'workspace' | 'managed-cache' | 'packaged' | 'legacy' }> {
  const environment = options.environment || process.env;
  const workspaceRoot = options.workspaceRoot ? path.resolve(options.workspaceRoot) : '';
  const cacheRoot = options.cacheRoot || resolveSdkCacheRoot(environment);
  const explicit = resource.id === 'cef3' ? environment.CEF3_SDK_ROOT : environment.FBRO_SDK_ROOT;
  const candidates: Array<{ root: string; source: 'environment' | 'workspace' | 'managed-cache' | 'packaged' | 'legacy' }> = [];
  if (explicit) candidates.push({ root: path.resolve(explicit), source: 'environment' });
  if (workspaceRoot) {
    candidates.push({
      root: path.join(workspaceRoot, '.lingbuilder', 'modules', resource.moduleId, 'sdk'),
      source: 'workspace'
    });
    if (resource.id === 'cef3') {
      candidates.push({ root: path.join(workspaceRoot, '.lingbuilder', 'cef3-sdk'), source: 'workspace' });
    }
  }
  candidates.push({ root: getManagedSdkRoot(cacheRoot, resource), source: 'managed-cache' });
  if (options.resourcesPath) {
    candidates.push({
      root: path.join(options.resourcesPath, 'default-workspace', '.lingbuilder', 'modules', resource.moduleId, 'sdk'),
      source: 'packaged'
    });
  }
  candidates.push({ root: path.resolve('.lingbuilder', 'modules', resource.moduleId, 'sdk'), source: 'legacy' });
  if (resource.id === 'cef3') {
    candidates.push({ root: path.resolve('.lingbuilder', 'cef3-sdk'), source: 'legacy' });
    if (process.platform === 'win32') candidates.push({ root: 'C:\\cef3-sdk', source: 'legacy' });
  }
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = path.resolve(candidate.root).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
