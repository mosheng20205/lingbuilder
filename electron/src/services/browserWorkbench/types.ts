export const BROWSER_WORKSPACE_SCHEMA_VERSION = 1 as const;
export const BROWSER_WORKSPACE_TYPE = 'lingbuilder.multi-browser-workbench' as const;
export const BROWSER_EXTENSION_DIRECTORY = 'doubao-downloader' as const;

export type BrowserExtensionStatus =
  | '未配置'
  | '插件加载中'
  | '插件已加载'
  | '插件已移除'
  | '插件缺失'
  | '插件加载失败'
  | '待启动';

export interface BrowserInstanceModel {
  id: string;
  name: string;
  order: number;
  cacheDirectory: string;
  lastUrl: string;
  createdAt: string;
  restoreOpen: boolean;
  pluginStatus: BrowserExtensionStatus;
}

export interface BrowserWorkspaceDocument {
  schemaVersion: typeof BROWSER_WORKSPACE_SCHEMA_VERSION;
  workspaceType: typeof BROWSER_WORKSPACE_TYPE;
  selectedInstanceId: string;
  pluginDirectory: typeof BROWSER_EXTENSION_DIRECTORY;
  instances: BrowserInstanceModel[];
}

export interface BrowserCookieTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export interface BrowserCookieRecord {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires?: BrowserCookieTime | null;
  lastAccess?: BrowserCookieTime | null;
  hasExpires?: boolean;
  httpOnly: boolean;
  secure: boolean;
  sameSite: number;
  priority: number;
  session: boolean;
}

export interface BrowserCookieDocument {
  format: 'lingbuilder.browser.cookies';
  version: 1;
  exportedAt: string;
  scope: { type: 'all' | 'currentSite'; url: string };
  cookies: BrowserCookieRecord[];
}

export interface BrowserCookiePreview {
  validCount: number;
  invalidCount: number;
  expiredCount: number;
  conflictCount: number;
  domains: string[];
  accepted: BrowserCookieRecord[];
}

export interface BrowserExtensionValidation {
  ok: boolean;
  status: Extract<BrowserExtensionStatus, '插件已加载' | '插件缺失' | '插件加载失败'>;
  directory: string;
  manifestVersion?: number;
  name?: string;
  version?: string;
  diagnostic?: string;
}

export type BrowserCookieExportScope = 'currentSite' | 'all';
export type BrowserDeleteMode = 'retainData' | 'clearData';

export interface BrowserWorkbenchCommandAdapter {
  createInstance(): unknown | Promise<unknown>;
  switchInstance(instanceId: string): unknown | Promise<unknown>;
  renameInstance(instanceId: string, newName: string): unknown | Promise<unknown>;
  deleteInstance(instanceId: string, mode: BrowserDeleteMode): unknown | Promise<unknown>;
  importCookies(instanceId: string, filePath?: string): unknown | Promise<unknown>;
  exportCookies(instanceId: string, scope: BrowserCookieExportScope, filePath?: string): unknown | Promise<unknown>;
  openCacheDirectory(instanceId: string): unknown | Promise<unknown>;
  clearCache(instanceId: string): unknown | Promise<unknown>;
  exportSharePackage(projectId?: string): unknown | Promise<unknown>;
}
