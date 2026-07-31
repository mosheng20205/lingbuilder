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
  /** 官方英文名、历史名称或其它稳定调用别名；别名参与补全、诊断、重命名和 binding 解析。 */
  aliases?: string[];
  signature: string;
  description: string;
  insertText?: string;
  returnType?: string;
  returnDescription?: string;
  /** 默认命令进入常规补全；advanced 仅在显式开启底层 API 时展示；internal 不进入用户补全。 */
  visibility?: 'default' | 'advanced' | 'internal';
}

export interface ModuleDesignerEventParameter {
  name: string;
  type: ModuleBindingValueType;
  description?: string;
}

export interface ModuleDesignerRuntimeMapping {
  createCommand?: string;
  createReturnType?: string;
  createParameters?: ModuleDesignerRuntimeParameter[];
  propertyCommands?: Record<string, string>;
  eventCommands?: Record<string, string>;
  propertySetters?: ModuleDesignerPropertySetterMapping[];
  eventBindings?: ModuleDesignerEventBindingMapping[];
}

export interface ModuleDesignerRuntimeParameter {
  name: string;
  type: string;
  propertyKey?: string;
  lengthOf?: string;
  /** Setter 需要的固定参数，例如启用布局或默认关闭掩码。 */
  literal?: string | number;
}

export interface ModuleDesignerPropertySetterMapping {
  command: string;
  parameters: ModuleDesignerRuntimeParameter[];
  propertyKeys: string[];
}

export interface ModuleDesignerEventBindingMapping {
  eventName: string;
  /** 兼容设计器旧模型或预览控件使用的历史事件键。 */
  aliases?: string[];
  command: string;
  callbackType: string;
  /** 共享鼠标/焦点回调中的原生事件码。 */
  eventCode?: number;
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

export interface ModuleMenuContribution {
  menu: string;
  command?: string;
  submenu?: string;
  when?: string;
  group?: string;
  order?: number;
  arguments?: unknown[];
}

export interface ModuleSubmenuContribution {
  id: string;
  title: string;
}

export interface ModuleDesignerLayoutContribution {
  mode: 'absolute' | 'flow' | 'stack' | 'grid' | 'dock' | 'slots' | 'single' | 'custom';
  coordinateSpace?: 'window' | 'parent';
  orientation?: 'horizontal' | 'vertical';
  slots?: string[];
  capacity?: number;
  acceptedDesignerTypes?: string[];
  adapterId?: string;
}

export interface ModuleDesignerControlContribution {
  type: string;
  label: string;
  defaultProps: Record<string, unknown>;
  /** 稳定的命名空间控件 ID；旧模块缺失时由 moduleId/type 确定性补齐。 */
  namespacedType?: string;
  /** 设计器画布使用的兼容预览控件类型。 */
  previewType?: string;
  backend?: string;
  events?: Array<{
    name: string;
    /** 兼容设计器旧模型或预览控件使用的历史事件键。 */
    aliases?: string[];
    label: string;
    handlerPattern: string;
    group?: string;
    parameters?: ModuleDesignerEventParameter[];
    /** 仅当生成器已实现真实原生回调绑定时设置。 */
    runtimeCommand?: string;
  }>;
  category?: string;
  icon?: string;
  isContainer?: boolean;
  /** 容器的声明式布局协议；新增容器必须显式声明。 */
  layout?: ModuleDesignerLayoutContribution;
  isVisual?: boolean;
  nativeAdapter?: string;
  requiredLibraries?: string[];
  properties?: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'boolean' | 'enum' | 'color' | 'file' | 'stringList' | 'columns' | 'dataGridColumns' | 'dataGridRows' | 'treeNodes' | 'tabs' | 'date' | 'controlRef';
    defaultValue: unknown;
    options?: Array<{ value: string; label: string }>;
    min?: number;
    max?: number;
    description?: string;
    group?: string;
    level?: 'basic' | 'advanced';
    runtimeCommand?: string;
  }>;
  runtime?: ModuleDesignerRuntimeMapping;
}

export interface ModuleDesignerCatalogContribution {
  backend: string;
  path: string;
  schemaVersion: number;
  sha256: string;
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
  | 'handler'
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

export interface ModuleConflictContribution {
  moduleId: string;
  reason: string;
}

export interface ModuleCompatibilityContribution {
  conflicts?: ModuleConflictContribution[];
}

export interface ModuleDependencyContribution {
  moduleId: string;
  minimumVersion: string;
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
  /** 启用本模块前必须递归启用的模块；顺序由 ModuleService 确定性解析。 */
  dependencies?: ModuleDependencyContribution[];
  contributes?: {
    commands?: ModuleCommandContribution[];
    menus?: ModuleMenuContribution[];
    submenus?: ModuleSubmenuContribution[];
    types?: ModuleTypeContribution[];
    snippets?: ModuleSnippetContribution[];
    designerControls?: ModuleDesignerControlContribution[];
    docs?: ModuleDocContribution[];
    examples?: ModuleExampleContribution[];
  };
  targets?: ModuleTargetContribution[];
  bindings?: ModuleBindingsContribution;
  designer?: ModuleDesignerCatalogContribution;
  publish?: ModulePublishContribution;
  compatibility?: ModuleCompatibilityContribution;
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

export type ModuleHintKind = '类型' | '命令接口' | '设计器控件' | 'C++ 依赖';

export interface ModuleHintField {
  label: string;
  value: string;
}

export interface ModuleHintContent {
  itemId: string;
  moduleId: string;
  moduleName: string;
  kind: ModuleHintKind;
  title: string;
  description: string;
  declaration?: string;
  fields?: ModuleHintField[];
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
  /** 用户显式开启后，Monaco/新手补全才展示 advanced 命令；internal 始终隐藏。 */
  showAdvancedApi?: boolean;
}
