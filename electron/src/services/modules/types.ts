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
  /** 模块详情中的直接功能分类；命令应归入真实功能域，不额外套“命令接口”层。 */
  category?: string;
  /** 区分单项接口、批量入口、Bridge 自动管理能力和设置中心安全替代。 */
  capabilityKind?: 'single' | 'aggregate' | 'managed' | 'secureReplacement';
  /** 标记该命令是否对应覆盖目录中的一项官方能力。 */
  officialCapability?: boolean;
  /** 默认命令进入常规补全；advanced 仅在显式开启底层 API 时展示；internal 不进入用户补全。 */
  visibility?: 'default' | 'advanced' | 'internal';
}

export interface ModuleDesignerEventParameter {
  name: string;
  type: ModuleBindingValueType;
  description?: string;
}

export interface ModuleDesignerEventContribution {
  name: string;
  /** 兼容设计器旧模型或预览控件使用的历史事件键。 */
  aliases?: string[];
  label: string;
  handlerPattern: string;
  group?: string;
  parameters?: ModuleDesignerEventParameter[];
  /** 创建处理器时替代通用调试输出的初始语句。 */
  starterStatements?: string[];
  /** 仅当生成器已实现真实原生回调绑定时设置。 */
  runtimeCommand?: string;
}

export interface ModuleDesignerRuntimeMapping {
  createCommand?: string;
  createReturnType?: string;
  createParameters?: ModuleDesignerRuntimeParameter[];
  propertyCommands?: Record<string, string>;
  propertyBridgeCommands?: ModuleDesignerPropertyBridgeCommand[];
  eventCommands?: Record<string, string>;
  propertySetters?: ModuleDesignerPropertySetterMapping[];
  eventBindings?: ModuleDesignerEventBindingMapping[];
}

export interface ModuleDesignerPropertyBridgeCommand {
  command: string;
  type: string;
  eu: string;
  args: Array<{ kind: 'hwnd' | 'id' | 'utf8' | 'utf8len' | 'int' | 'float' | 'literal'; param?: number; value?: string | number; scale?: number }>;
}

export type ModuleRuntimeControlParentKind = 'window' | 'container' | 'tabPage';
export type ModuleRuntimeControlParameterRole =
  | 'parent'
  | 'x'
  | 'y'
  | 'width'
  | 'height'
  | 'content'
  | 'property'
  | 'tagText'
  | 'tagInteger';

export interface ModuleRuntimeControlCreationParameter {
  name: string;
  type: ModuleCommandValueType;
  role: ModuleRuntimeControlParameterRole;
  propertyKey?: string;
  optional?: boolean;
  defaultValue?: string | number | boolean | null;
}

/**
 * Host-owned contract for a visual control that can also be created at runtime.
 * Modules declare capabilities; they do not inject renderer or generator code.
 */
export interface ModuleRuntimeControlContribution {
  /** Explicit LingCpp type name used by locals, parameters and return values. */
  lingCppType: string;
  /** Non-owning C++ wrapper. The window remains the lifetime owner. */
  cppType: 'LingControlRef';
  createCommand: string;
  createParameters: ModuleRuntimeControlCreationParameter[];
  lookupByTagTextCommand: string;
  lookupByTagIntegerCommand: string;
  validCommand: '控件_是否有效';
  parentKinds: ModuleRuntimeControlParentKind[];
  /** Non-empty tags are unique in current window + concrete type + tag kind. */
  tagScope: 'currentWindowAndConcreteType';
}

export interface ModuleDesignerRuntimeParameter {
  name: string;
  type: string;
  propertyKey?: string;
  lengthOf?: string;
  /** Setter 需要的固定参数，例如启用布局或默认关闭掩码。 */
  literal?: string | number;
  /** 将设计器数值转换为原生 ABI 数值时使用的乘数，例如百分比到倍率为 0.01。 */
  valueScale?: number;
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
  /** 共享 JSON 文本回调中的稳定 event 字段值。 */
  payloadEvent?: string;
}

export type ModulePublicTypeKind = 'opaque' | 'record' | 'array';

export interface ModuleTypeFieldContribution {
  name: string;
  /** LingCpp 字段类型名；数组维度单独由 isArray 声明。 */
  type: string;
  description?: string;
  initialValue?: string;
  isArray?: boolean;
}

export interface ModuleTypeContribution {
  name: string;
  description: string;
  /** 旧模块省略 kind 时按 opaque 处理。 */
  kind?: ModulePublicTypeKind;
  /** opaque 类型映射到生成工程中的原生 C++ 类型。 */
  cppType?: string;
  /** record 类型公开的值语义字段。 */
  fields?: ModuleTypeFieldContribution[];
  /** array 类型的 LingCpp 元素类型名。 */
  elementType?: string;
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

export type ModuleDesignerRecordFieldType = 'text' | 'number' | 'boolean' | 'enum' | 'color' | 'file' | 'controlRef';

export interface ModuleDesignerRecordFieldContribution {
  key: string;
  label: string;
  type: ModuleDesignerRecordFieldType;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  controlTypes?: string[];
  controlKinds?: ModuleControlReferenceKind[];
  scope?: ModuleControlReferenceScope;
  runtimeRepresentation?: ModuleControlRuntimeRepresentation;
}

export interface ModuleDesignerPropertyContribution {
  key: string;
  label: string;
  type: 'text' | 'hotkey' | 'hotKey' | 'number' | 'boolean' | 'enum' | 'color' | 'file' | 'stringList' | 'columns' | 'dataGridColumns' | 'dataGridRows' | 'treeNodes' | 'tabs' | 'date' | 'controlRef' | 'recordList';
  defaultValue: unknown;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  description?: string;
  group?: string;
  level?: 'basic' | 'advanced';
  runtimeCommand?: string;
  controlTypes?: string[];
  controlKinds?: ModuleControlReferenceKind[];
  scope?: ModuleControlReferenceScope;
  runtimeRepresentation?: ModuleControlRuntimeRepresentation;
  recordKey?: string;
  fields?: ModuleDesignerRecordFieldContribution[];
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
  events?: ModuleDesignerEventContribution[];
  category?: string;
  icon?: string;
  isContainer?: boolean;
  /** 容器的声明式布局协议；新增容器必须显式声明。 */
  layout?: ModuleDesignerLayoutContribution;
  isVisual?: boolean;
  nativeAdapter?: string;
  requiredLibraries?: string[];
  properties?: ModuleDesignerPropertyContribution[];
  runtime?: ModuleDesignerRuntimeMapping;
  /** 可视控件的代码创建、类型化引用和按标记查找契约。 */
  runtimeControl?: ModuleRuntimeControlContribution;
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

export type ModuleBuildArtifactKind = 'source' | 'header' | 'content' | 'descriptor' | 'runtime';

export interface ModuleCodeGeneratorInput {
  root?: string;
  include: string[];
  exclude?: string[];
}

export interface ModuleCodeGeneratorOutput {
  path: string;
  kind: ModuleBuildArtifactKind;
}

/**
 * Declarative, host-owned code generation. A module can select a registered
 * provider, but it cannot inject a command line or executable into the build.
 */
export interface ModuleCodeGeneratorContribution {
  id: string;
  provider: string;
  version?: string;
  inputs: ModuleCodeGeneratorInput;
  outputs: ModuleCodeGeneratorOutput[];
  options?: Record<string, unknown>;
  targetIds?: string[];
}

export interface ModuleBuildContribution {
  codeGenerators?: ModuleCodeGeneratorContribution[];
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
  | 'controlRef'
  | 'handler'
  | 'lingValue'
  | 'handle'
  | 'bytes'
  /** 任意元素类型的 LingCpp 数组左值；生成器按 std::vector<T>& 原样传递，不做 ABI 转换。 */
  | 'array'
  /** 与同一命令中 array 参数元素类型一致的值；作为返回值表示返回该元素类型。 */
  | 'arrayElement'
  | 'raw';

/** 基础 ABI 类型或当前模块通过 contributes.types 公开的结构化 LingCpp 类型名。 */
export type ModuleCommandValueType = ModuleBindingValueType | (string & {});

export type ModuleControlReferenceScope = 'currentWindow' | 'project';
export type ModuleControlReferenceKind = 'visual' | 'nonVisual' | 'resource';
export type ModuleControlRuntimeRepresentation = 'wideName' | 'stableId' | 'nativeHandle';

export interface ModuleHandlerSignatureContract {
  /** 处理器在 .lcpp 中声明的参数类型，空数组表示必须是无参数处理器。 */
  parameterTypes: string[];
  /** 处理器在 .lcpp 中声明的返回类型，例如“空”“整数型”。 */
  returnType: string;
}

export interface ModuleCommandBindingParameter {
  name: string;
  type: ModuleCommandValueType;
  description?: string;
  /** controlRef 可接受的设计器控件类型；省略表示接受任意兼容控件。 */
  controlTypes?: string[];
  /** controlRef 可接受的设计器对象种类；默认仅 visual。 */
  controlKinds?: ModuleControlReferenceKind[];
  /** controlRef 的源码解析范围；默认 currentWindow。 */
  scope?: ModuleControlReferenceScope;
  /** controlRef 传给原生运行时的表示；当前默认 wideName。 */
  runtimeRepresentation?: ModuleControlRuntimeRepresentation;
  /** 仅 lingValue 可用；表示从此参数起接受任意数量的 LingCpp 可深拷贝值。 */
  variadic?: boolean;
  /** 仅 handler 可用；由语言服务校验 &引用目标的参数和返回类型。 */
  handlerSignature?: ModuleHandlerSignatureContract;
  /** 可选参数只能出现在参数列表尾部。 */
  optional?: boolean;
  /** 可选参数省略时使用的确定性默认值；null 表示“未设置”。 */
  defaultValue?: string | number | boolean | null;
}

export interface ModuleManagedTaskInvocation {
  kind: 'managedTask';
  /** submit 生成任务 lambda；synchronized 生成由 RAII 同步原语执行的 lambda。 */
  operation: 'submit' | 'synchronized';
  workerParameterIndex: number;
  variadicParameterIndex: number;
  poolParameterIndex?: number;
  timeoutParameterIndex?: number;
  progressParameterIndex?: number;
  completionParameterIndex?: number;
}

export interface ModuleCommandBinding {
  command: string;
  runtimeName: string;
  parameters?: ModuleCommandBindingParameter[];
  returnType?: ModuleCommandValueType;
  targetIds?: string[];
  encoding?: 'wide' | 'utf8' | 'raw';
  example?: string;
  description?: string;
  /** 由语言服务和生成器共同校验并展开的受管处理器调用。 */
  invocation?: ModuleManagedTaskInvocation;
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
  build?: ModuleBuildContribution;
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
