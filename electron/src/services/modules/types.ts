export type LingBuilderModuleCategory =
  | '界面'
  | '系统'
  | '网络'
  | '数据库'
  | '图像'
  | 'AI'
  | '构建'
  | '其他';

export interface ModuleCommandContribution {
  name: string;
  signature: string;
  description: string;
  insertText?: string;
  returnType?: string;
}

export interface ModuleTypeContribution {
  name: string;
  description: string;
  cppType?: string;
}

export interface ModuleSnippetContribution {
  label: string;
  insertText: string;
  description: string;
}

export interface ModuleDesignerControlContribution {
  type: string;
  label: string;
  defaultProps: Record<string, unknown>;
  events?: Array<{ name: string; label: string; handlerPattern: string }>;
}

export interface ModuleCppContribution {
  includeDirs?: string[];
  sources?: string[];
  headers?: string[];
  libs?: string[];
  defines?: string[];
  runtimeFiles?: string[];
}

export interface ModuleDocContribution {
  title: string;
  path: string;
}

export interface ModuleExampleContribution {
  title: string;
  path: string;
  description?: string;
}

export type ModuleTargetPlatform = 'windows' | 'linux' | 'macos';
export type ModuleTargetArch = 'win32' | 'x64' | 'arm64' | 'any';
export type ModuleTargetToolchain = 'msvc' | 'gcc' | 'clang' | 'cmake' | 'any';

export interface ModuleTargetContribution {
  id: string;
  platform: ModuleTargetPlatform;
  arch: ModuleTargetArch;
  toolchain: ModuleTargetToolchain;
  includeDirs?: string[];
  sources?: string[];
  headers?: string[];
  libs?: string[];
  defines?: string[];
  runtimeFiles?: string[];
  compileOptions?: string[];
  linkOptions?: string[];
}

export type ModuleBindingValueType =
  | 'void'
  | 'int'
  | 'longLong'
  | 'double'
  | 'bool'
  | 'wideString'
  | 'utf8String'
  | 'handle'
  | 'raw';

export interface ModuleCommandBindingParameter {
  name: string;
  type: ModuleBindingValueType;
  description?: string;
}

export interface ModuleCommandBinding {
  command: string;
  runtimeName: string;
  parameters?: ModuleCommandBindingParameter[];
  returnType?: ModuleBindingValueType;
  targetIds?: string[];
  encoding?: 'wide' | 'utf8' | 'raw';
  example?: string;
  description?: string;
}

export interface ModuleBindingsContribution {
  commands?: ModuleCommandBinding[];
}

export interface ModulePublishContribution {
  homepage?: string;
  repository?: string;
  downloadUrl?: string;
  sha256?: string;
  signature?: string;
}

export interface LingBuilderModuleManifest {
  schemaVersion: 2;
  id: string;
  name: string;
  version: string;
  displayName?: string;
  category: LingBuilderModuleCategory;
  description: string;
  author?: string;
  license?: string;
  tags?: string[];
  minLingBuilderVersion?: string;
  contributes?: {
    commands?: ModuleCommandContribution[];
    types?: ModuleTypeContribution[];
    snippets?: ModuleSnippetContribution[];
    designerControls?: ModuleDesignerControlContribution[];
    docs?: ModuleDocContribution[];
    examples?: ModuleExampleContribution[];
  };
  targets?: ModuleTargetContribution[];
  bindings?: ModuleBindingsContribution;
  publish?: ModulePublishContribution;
}

export interface InstalledModule {
  manifest: LingBuilderModuleManifest;
  installPath: string;
  isBuiltin?: boolean;
  isInstalled: boolean;
  isEnabledForProject?: boolean;
  diagnostics: string[];
  sha256?: string;
}

export interface LingBuilderProjectModules {
  schemaVersion: 1;
  enabledModuleIds: string[];
  pinnedVersions: Record<string, string>;
}

export interface ModuleInstallPreview {
  previewId: string;
  packagePath: string;
  unpackedPath: string;
  manifest?: LingBuilderModuleManifest;
  fileCount: number;
  totalBytes: number;
  sha256: string;
  diagnostics: string[];
  canInstall: boolean;
  willUpgrade: boolean;
  existingVersion?: string;
}

export interface ModuleInstallResult {
  moduleId: string;
  moduleName: string;
  version: string;
  installPath: string;
  historyId: string;
}

export interface MarketSource {
  id: string;
  name: string;
  type: 'local' | 'official' | 'enterprise';
  enabled: boolean;
  location: string;
  priority: number;
}

export interface MarketModule {
  id: string;
  name: string;
  version: string;
  category: LingBuilderModuleCategory;
  description: string;
  author?: string;
  tags?: string[];
  sourceId: string;
  packagePath?: string;
  downloadUrl?: string;
  sha256?: string;
  installedVersion?: string;
}

export interface ModuleHistoryEntry {
  id: string;
  time: string;
  action: 'install' | 'uninstall' | 'enable' | 'disable' | 'export' | 'rollback' | 'preview-failed';
  moduleId?: string;
  moduleName?: string;
  version?: string;
  status: 'success' | 'failed';
  summary: string;
  details: string;
  snapshotPath?: string;
}

export interface LingCppModuleContext {
  enabledModules: InstalledModule[];
  availableModules?: InstalledModule[];
}
