import os from 'node:os';
import path from 'node:path';

export type SdkDependencyId = 'cef3' | 'fbro' | 'sunnynet';

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
    sdkVersion: '150.0.14',
    platform: 'windows-x64',
    archiveName: 'lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-bridge4-4-3-windows-x64.zip',
    downloadUrl: 'https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-150.0.14-chromium-150.0.7871.129-bridge4-4-3-windows-x64.zip',
    archiveBytes: 199_070_568,
    expandedBytes: 473_679_244,
    fileCount: 536,
    sha256: '24b1255883e751e4fc77a7666c8f5467026a9fa3dd1f72b87c556af4df41b4b6',
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
    version: '135.0.21.2.9.1',
    sdkVersion: '135.0.21',
    platform: 'windows-x64',
    archiveName: 'lingbuilder-fbro-sdk-135.0.21.2.9.1-windows-x64.zip',
    downloadUrl: 'https://msimgimg.xyz/uploads/lingbuilder-fbro-sdk-135.0.21.2.9.1-windows-x64.zip',
    archiveBytes: 230_359_730,
    expandedBytes: 674_086_775,
    fileCount: 473,
    sha256: '49d29381463ad03df6aa8bfd0cb21302af96ed2999a21f40b36a03f4d18df53b',
    requiredModuleIds: ['lingbuilder.fbro.browser'],
    criticalFiles: [
      { relativePath: 'runtime-manifest.json', minimumBytes: 5_000 },
      { relativePath: 'include/LingBuilderFbroBridge.h', minimumBytes: 5_000 },
      { relativePath: 'lib/x64/LingBuilderFbroBridge.lib', minimumBytes: 1_000 },
      { relativePath: 'bridge/x64/LingBuilderFbroBridge.dll', minimumBytes: 10_000 },
      { relativePath: 'official/include/FBroInit.h', minimumBytes: 1_000 },
      { relativePath: 'official/lib64/FBrowserCEF3lib.lib', minimumBytes: 1_000 },
      { relativePath: 'runtime/x64/libcef.dll', minimumBytes: 230 * 1024 * 1024 }
    ]
  },
  {
    id: 'sunnynet',
    moduleId: 'lingbuilder.sunnynet.sdk',
    name: '网络中间件 SDK',
    version: '1.5.1',
    sdkVersion: '1.5.1',
    platform: 'windows-x64',
    archiveName: 'lingbuilder-sunnynet-sdk-1.5.1-windows-x64.zip',
    downloadUrl: 'https://lingbuilder.com/update-assets/sdk/lingbuilder-sunnynet-sdk-1.5.1-windows-x64.zip',
    archiveBytes: 31_070_540,
    expandedBytes: 84_071_967,
    fileCount: 5,
    sha256: '6c5c9ff45907457c33e8394c7f9288e36ac24c862592cd5e8f176a8081efeb3c',
    requiredModuleIds: ['lingbuilder.sunnynet'],
    criticalFiles: [
      { relativePath: 'runtime-manifest.json', minimumBytes: 300 },
      { relativePath: 'bin/Win32/SunnyNet.dll', minimumBytes: 40_000_000 },
      { relativePath: 'bin/x64/SunnyNet64.dll', minimumBytes: 40_000_000 }
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
  const explicit = resource.id === 'cef3'
    ? environment.CEF3_SDK_ROOT
    : resource.id === 'fbro'
      ? environment.FBRO_SDK_ROOT
      : environment.LINGBUILDER_SUNNYNET_SDK_ROOT;
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
