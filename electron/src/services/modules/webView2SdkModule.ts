import fs from 'node:fs';
import path from 'node:path';

export const EDGEVIEW_MODULE_ID = 'lingbuilder.edgeview';
export const EDGEVIEW_WEBVIEW2_SDK_VERSION = '1.0.4078.44';
export const EDGEVIEW_WEBVIEW2_NUGET_PACKAGE_ID = 'microsoft.web.webview2';

export type WebView2SdkSource = 'environment' | 'packaged' | 'nuget-cache';

export interface WebView2SdkLocation {
  packageRoot: string;
  source: WebView2SdkSource;
}

export interface WebView2SdkLocatorOptions {
  environment?: NodeJS.ProcessEnv;
  /** 打包后的 process.resourcesPath；纯 Node（CLI/测试）下传 null 显式禁用随包候选。 */
  resourcesPath?: string | null;
}

export type WebView2SdkLocator = (options?: WebView2SdkLocatorOptions) => WebView2SdkLocation | null;

const SOURCE_LABELS: Record<WebView2SdkSource, string> = {
  environment: 'LINGBUILDER_WEBVIEW2_SDK_ROOT',
  packaged: 'LingBuilder 随包副本',
  'nuget-cache': 'NuGet 全局缓存'
};

export function describeWebView2SdkSource(source: WebView2SdkSource): string {
  return SOURCE_LABELS[source];
}

/**
 * EdgeView 模块编译所需的 WebView2 SDK（WebView2.h + WebView2LoaderStatic.lib）定位。
 * 候选顺序：LINGBUILDER_WEBVIEW2_SDK_ROOT → 打包机随包副本（third_party/webview2，经 extraResources 落 resources）→ NuGet 全局缓存。
 * 目录布局保持 NuGet 包原貌：<root>/<version>/build/native/{include,x64,x86}，与 materializeEdgeViewSdk 的消费路径一致。
 */
export function locateWebView2SdkPackage(options: WebView2SdkLocatorOptions = {}): WebView2SdkLocation | null {
  const environment = options.environment || process.env;
  const resourcesPath = options.resourcesPath === undefined
    ? readProcessResourcesPath()
    : options.resourcesPath;
  const candidates: Array<{ packageRoot: string; source: WebView2SdkSource }> = [];
  const explicit = String(environment.LINGBUILDER_WEBVIEW2_SDK_ROOT || '').trim();
  if (explicit) {
    // 兼容三种指向：包仓库根（含 microsoft.web.webview2/<版本>）、版本目录的父目录、包根目录本身。
    const resolved = path.resolve(explicit);
    candidates.push({ packageRoot: path.join(resolved, EDGEVIEW_WEBVIEW2_NUGET_PACKAGE_ID, EDGEVIEW_WEBVIEW2_SDK_VERSION), source: 'environment' });
    candidates.push({ packageRoot: path.join(resolved, EDGEVIEW_WEBVIEW2_SDK_VERSION), source: 'environment' });
    candidates.push({ packageRoot: resolved, source: 'environment' });
  }
  if (resourcesPath) {
    candidates.push({
      packageRoot: path.join(resourcesPath, 'third_party', 'webview2', EDGEVIEW_WEBVIEW2_NUGET_PACKAGE_ID, EDGEVIEW_WEBVIEW2_SDK_VERSION),
      source: 'packaged'
    });
  }
  const nugetPackages = String(environment.NUGET_PACKAGES || '').trim();
  if (nugetPackages) {
    candidates.push({
      packageRoot: path.join(path.resolve(nugetPackages), EDGEVIEW_WEBVIEW2_NUGET_PACKAGE_ID, EDGEVIEW_WEBVIEW2_SDK_VERSION),
      source: 'nuget-cache'
    });
  }
  const userProfile = String(environment.USERPROFILE || '').trim();
  if (userProfile) {
    candidates.push({
      packageRoot: path.join(path.resolve(userProfile), '.nuget', 'packages', EDGEVIEW_WEBVIEW2_NUGET_PACKAGE_ID, EDGEVIEW_WEBVIEW2_SDK_VERSION),
      source: 'nuget-cache'
    });
  }
  for (const candidate of candidates) {
    if (webView2HeaderExists(candidate.packageRoot)) return { packageRoot: candidate.packageRoot, source: candidate.source };
  }
  return null;
}

function webView2HeaderExists(packageRoot: string): boolean {
  try {
    fs.accessSync(path.join(packageRoot, 'build', 'native', 'include', 'WebView2.h'));
    return true;
  } catch {
    return false;
  }
}

function readProcessResourcesPath(): string | null {
  const candidate = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const normalized = String(candidate || '').trim();
  return normalized ? normalized : null;
}
