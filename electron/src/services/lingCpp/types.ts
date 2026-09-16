import { LingCppModuleContext } from '../modules/types';
import type { LingWindowProject } from '../windowDesigner/types';

export type LingCppAccessModifier = '公开' | '私有' | '保护';

export interface LingCppDiagnostic {
  id: string;
  line: number;
  range?: LingCppSourceRange;
  level: 'error' | 'warning' | 'info';
  message: string;
  codeSnippet: string;
  suggestion: string;
}

export interface LingCppProgram {
  packageName: string;
  uses: string[];
  constants: LingCppConstant[];
  globals: LingCppGlobalVariable[];
  dataTypes: LingCppDataType[];
  functionLibraries: LingCppFunctionLibrary[];
  dllLibraries: LingCppDllLibrary[];
  classes: LingCppClass[];
  diagnostics: LingCppDiagnostic[];
  source: string;
}

/**
 * A stateless, project-scoped collection of reusable functions.
 * Function libraries intentionally have no members, events or constructors.
 */
export interface LingCppFunctionLibrary {
  name: string;
  line: number;
  endLine?: number;
  methods: LingCppMethod[];
}

export interface LingCppConstant {
  /** 项目级只读符号。 */
  name: string;
  type: string;
  line: number;
  initialValue: string;
  note?: string;
}

export interface LingCppGlobalVariable {
  name: string;
  type: string;
  line: number;
  initialValue?: string;
  isArray?: boolean;
  note?: string;
}

export interface LingCppDataType {
  name: string;
  line: number;
  endLine?: number;
  note?: string;
  fields: LingCppDataField[];
  /** 省略时表示项目数据类型文件中的声明。 */
  origin?: 'project' | 'module';
  sourceModuleId?: string;
  sourceModuleName?: string;
}

export interface LingCppDataField {
  name: string;
  type: string;
  line: number;
  initialValue?: string;
  isArray?: boolean;
  note?: string;
}

export interface LingCppClass {
  name: string;
  baseClass?: string;
  line: number;
  endLine?: number;
  members: LingCppMember[];
  methods: LingCppMethod[];
}

export interface LingCppMember {
  name: string;
  type: string;
  access: LingCppAccessModifier;
  line: number;
  initialValue?: string;
  isStatic?: boolean;
  isArray?: boolean;
}

export interface LingCppMethod {
  name: string;
  returnType: string;
  access: LingCppAccessModifier;
  isStatic?: boolean;
  kind: 'constructor' | 'destructor' | 'method' | 'event';
  line: number;
  endLine?: number;
  parameters: LingCppParameter[];
  locals?: LingCppLocalVariable[];
  statements: LingCppStatement[];
  note?: string;
}

export interface LingCppLocalVariable {
  name: string;
  type: string;
  line: number;
  initialValue?: string;
  note?: string;
  isArray?: boolean;
  /** 运行时初始化一次、之后只读的子程序局部值。 */
  isConstant?: boolean;
}

export interface LingCppParameter {
  name: string;
  type: string;
  defaultValue?: string;
  note?: string;
  /** 项目 DLL 命令声明：按指针传址（输出参数），生成 `类型*` 形参与 `&实参` 调用。 */
  byRef?: boolean;
}

export interface LingCppStatement {
  line: number;
  indent: string;
  text: string;
  /** 多行文本块语句的结束行（1-based，含）；普通单行语句缺省。 */
  endLine?: number;
}

export interface LingCppSourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type LingCppAstNodeKind =
  | 'program'
  | 'package'
  | 'use'
  | 'constant'
  | 'global'
  | 'data-type'
  | 'data-field'
  | 'function-library'
  | 'dll-library'
  | 'dll-command'
  | 'dll-arch'
  | 'class'
  | 'access'
  | 'member'
  | 'constructor'
  | 'destructor'
  | 'method'
  | 'event'
  | 'parameter'
  | 'local'
  | 'statement'
  | 'comment'
  | 'designer';

export interface LingCppAstNode {
  id: string;
  kind: LingCppAstNodeKind;
  name: string;
  range: LingCppSourceRange;
  parentId?: string;
  detail?: string;
  value?: string;
  access?: LingCppAccessModifier;
  type?: string;
  returnType?: string;
  isStatic?: boolean;
  isArray?: boolean;
  isConstant?: boolean;
  children: LingCppAstNode[];
}

export interface LingCppSymbolIndex {
  declarations: LingCppAstNode[];
  classes: LingCppAstNode[];
  constants: LingCppAstNode[];
  globals: LingCppAstNode[];
  dataTypes: LingCppAstNode[];
  dataFields: LingCppAstNode[];
  functionLibraries: LingCppAstNode[];
  members: LingCppAstNode[];
  locals: LingCppAstNode[];
  methods: LingCppAstNode[];
  events: LingCppAstNode[];
  byName: Record<string, LingCppAstNode[]>;
  byLine: Record<number, LingCppAstNode[]>;
}

export interface LingCppAst {
  version: 1;
  source: string;
  range: LingCppSourceRange;
  root: LingCppAstNode;
  nodes: LingCppAstNode[];
  symbolIndex: LingCppSymbolIndex;
  diagnostics: LingCppDiagnostic[];
  program: LingCppProgram;
}

export interface LingCppEventBinding {
  handlerName: string;
  className: string;
  methodName: string;
}

export interface LingCppParseResult {
  program: LingCppProgram;
  ast: LingCppAst;
  symbolIndex: LingCppSymbolIndex;
  diagnostics: LingCppDiagnostic[];
}

export interface WorkspaceEditRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface WorkspaceEditChange {
  filePath: string;
  range: WorkspaceEditRange;
  originalText: string;
  newText: string;
}

export interface WorkspaceEditProposal {
  id: string;
  title: string;
  summary: string;
  createdAt: string;
  changes: WorkspaceEditChange[];
  explanation: string;
  /** AI 对窗口设计器的完整模型替换；缺省表示本次没有设计器改动。 */
  designerProject?: LingWindowProject;
  /** 生成提案时的设计器快照，用于应用前检测外部修改。 */
  designerProjectOriginal?: LingWindowProject;
}

export interface LingCppWorkspaceFile {
  filePath: string;
  sourceCode: string;
  language?: string;
}

export interface LingCppProjectSourceFile {
  filePath: string;
  sourceCode: string;
}

export interface LingCppProjectGlobalContext {
  filePath: string;
  sourceCode: string;
  constants: LingCppConstant[];
  globals: LingCppGlobalVariable[];
}

export interface LingCppProjectTypeContext {
  filePath: string;
  sourceCode: string;
  dataTypes: LingCppDataType[];
}

/** 项目 DLL 命令库：单个架构的 DLL 文件映射（项目内相对路径）。 */
export interface LingCppDllArchitectureFile {
  arch: 'Win32' | 'x64';
  relativePath: string;
  line: number;
}

/** 项目 DLL 命令库单条导出声明：命令名默认即 DLL 导出函数名，可用 `= 导出名` 指定不同导出名。 */
export interface LingCppDllCommand {
  name: string;
  returnType: string;
  parameters: LingCppParameter[];
  callingConvention: 'cdecl' | 'stdcall';
  /** 命令备注（写入合成模块的 description，补全/新手提示可见）。 */
  remark?: string;
  /** 实际导出函数名；省略时与命令名相同。 */
  exportName?: string;
  /** 命令是否公开（对补全和新手编辑器可见）；缺省视为公开，仅 `公开 = 假` 显式关闭。 */
  isPublic?: boolean;
  line: number;
}

/** 项目 DLL 命令库：不经 .lbmod 模块，项目内直接声明「DLL 文件 + 导出函数 → 中文命令」。 */
export interface LingCppDllLibrary {
  name: string;
  line: number;
  endLine?: number;
  /** 系统 DLL（user32/gdi32 等）：免分发、不复制、不生成导入库，链接系统导入库。 */
  isSystem?: boolean;
  archFiles: LingCppDllArchitectureFile[];
  commands: LingCppDllCommand[];
}

export interface LingCppProjectDllCommandContext {
  filePath: string;
  sourceCode: string;
  dllLibraries: LingCppDllLibrary[];
}

export interface AiConnectionConfig {
  baseUrl?: string;
  apiKey?: string;
  modelName?: string;
  provider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
}

export interface LingCppEditContext {
  filePath: string;
  sourceCode: string;
  instruction: string;
  /** 当前活动解决方案项目 ID；用于阻止跨项目设计器模型混用。 */
  projectId?: string;
  selection?: WorkspaceEditRange;
  workspaceFiles?: LingCppWorkspaceFile[];
  moduleContext?: LingCppModuleContext;
  aiConfig?: AiConnectionConfig;
  designerProject?: LingWindowProject;
}

export interface LingCppEditDraftFile {
  filePath: string;
  updatedSource: string;
}

export interface LingCppEditDraft {
  summary?: string;
  explanation?: string;
  updatedSource?: string;
  files?: LingCppEditDraftFile[];
  designerProject?: LingWindowProject;
}

export interface AppliedWorkspaceFile {
  filePath: string;
  sourceCode: string;
}

export interface SourceControlFileStatus {
  path: string;
  indexStatus: string;
  workingTreeStatus: string;
}

export interface SourceControlStatus {
  isRepository: boolean;
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  files: SourceControlFileStatus[];
  error?: string;
}

export type LingCppSymbolKind =
  | 'package'
  | 'use'
  | 'global'
  | 'data-type'
  | 'data-field'
  | 'function-library'
  | 'class'
  | 'member'
  | 'constructor'
  | 'destructor'
  | 'method'
  | 'event';

export interface LingCppDocumentSymbol {
  name: string;
  detail?: string;
  kind: LingCppSymbolKind;
  line: number;
  endLine?: number;
  children?: LingCppDocumentSymbol[];
}

export interface LingCppFoldingRange {
  startLine: number;
  endLine: number;
  kind?: 'region' | 'comment';
}

export interface LingCppCompletionContext {
  source: string;
  line: number;
  column: number;
  triggerText?: string;
}

export interface LingCppCompletionItem {
  label: string;
  kind: 'keyword' | 'type' | 'function' | 'event' | 'snippet';
  insertText: string;
  detail: string;
  signature?: string;
  returnType?: string;
  documentation?: string;
  isSnippet?: boolean;
  aliases?: string[];
  pinyin?: string[];
  example?: string;
  category?: 'symbol' | 'keyword' | 'type' | 'command' | 'event' | 'designer' | 'module' | 'snippet';
  audienceText?: string;
}

export interface LingCppCompletionCatalogItem extends LingCppCompletionItem {
  source: 'builtin' | 'designer' | 'module' | 'symbol';
  sortRank: number;
}

export interface LingCppHover {
  line: number;
  column: number;
  contents: string;
  range?: LingCppSourceRange;
}

export type LingCppDesignerBindingStatus =
  | 'bound'
  | 'unbound-source'
  | 'missing-source'
  | 'missing-control';

export interface LingCppDesignerBindingHint {
  status: LingCppDesignerBindingStatus;
  line: number;
  handlerName: string;
  className?: string;
  controlName?: string;
  controlId?: string;
  eventName?: string;
  windowId?: string;
  message: string;
  suggestion: string;
  displayText?: string;
  detailText?: string;
  actionKind?: LingCppQuickActionKind;
  targetLine?: number;
  targetControlId?: string;
}

export type LingCppProblemSource = 'parser' | 'block' | 'designer';

export type LingCppProblemActionKind =
  | 'generate-event'
  | 'bind-designer-event'
  | 'rename-handler'
  | 'reveal-designer'
  | 'none';

export interface LingCppProblem {
  id: string;
  filePath: string;
  line: number;
  level: 'error' | 'warning' | 'info';
  source: LingCppProblemSource;
  message: string;
  codeSnippet: string;
  suggestion: string;
  actionKind: LingCppProblemActionKind;
  actionLabel?: string;
  locationKind?: 'source' | 'insertion';
}

export type LingCppQuickActionKind =
  | 'generate-event'
  | 'bind-designer-event'
  | 'rename-handler'
  | 'reveal-designer'
  | 'none';

export interface LingCppQuickAction {
  id: string;
  label: string;
  kind: LingCppQuickActionKind;
  targetLine?: number;
  targetControlId?: string;
  description: string;
}

export type LingCppStructureNodeKind =
  | 'package'
  | 'use'
  | 'global'
  | 'class'
  | 'member'
  | 'constructor'
  | 'destructor'
  | 'event'
  | 'designer';

export interface LingCppStructureNode {
  id: string;
  kind: LingCppStructureNodeKind;
  name: string;
  detail?: string;
  line: number;
  status?: LingCppDesignerBindingStatus;
  targetControlId?: string;
  children?: LingCppStructureNode[];
}

export type LingCppReadingMode = 'off' | 'beginner' | 'focused';

export interface ReadableEventName {
  rawName: string;
  subject: string;
  eventLabel: string;
  displayName: string;
}

export type LingCppReadableBlockKind =
  | 'class'
  | 'member-section'
  | 'constructor'
  | 'destructor'
  | 'window-event'
  | 'control-event'
  | 'menu-event'
  | 'custom-event'
  | 'method';

export interface LingCppReadableActionSummary {
  kind: 'message-box' | 'debug-output' | 'exit-program' | 'set-control-text' | 'open-window' | 'custom';
  label: string;
  line: number;
}

export interface LingCppReadableBlock {
  id: string;
  kind: LingCppReadableBlockKind;
  startLine: number;
  endLine: number;
  title: string;
  summary: string;
  bindingStatus?: LingCppDesignerBindingStatus;
  handlerName?: string;
  readableName?: ReadableEventName;
  actionCount: number;
  actions: LingCppReadableActionSummary[];
  targetControlId?: string;
}

export interface LingCppInlineHint {
  id: string;
  line: number;
  column: number;
  text: string;
  mode: LingCppReadingMode;
  hover?: string;
  kind: 'class' | 'constructor' | 'event' | 'action' | 'binding';
}

export interface LingCppEventBlockHighlight {
  id: string;
  blockId: string;
  startLine: number;
  endLine: number;
  kind: LingCppReadableBlockKind;
  bindingStatus?: LingCppDesignerBindingStatus;
  actionKinds: LingCppReadableActionSummary['kind'][];
}

export type LingCppCompletionContextKind =
  | 'top-level'
  | 'class-body'
  | 'member-section'
  | 'method-body'
  | 'event-body';

export interface LingCppStructuredReadingRow {
  id: string;
  group: 'declaration' | 'package' | 'global' | 'class' | 'member' | 'local' | 'method' | 'constructor' | 'event' | 'parameter' | 'note';
  name: string;
  type?: string;
  value?: string;
  note: string;
  line: number;
  blockId?: string;
  status?: LingCppDesignerBindingStatus;
  editable?: boolean;
  editKind?: 'package' | 'global' | 'class' | 'member' | 'local' | 'method' | 'event' | 'missing-event' | 'note';
  className?: string;
  methodName?: string;
  targetName?: string;
  access?: LingCppAccessModifier;
  initialValue?: string;
  returnType?: string;
  isStatic?: boolean;
  isArray?: boolean;
  isConstant?: boolean;
  parameters?: LingCppParameter[];
}

export interface LingCppLanguageContext {
  source: string;
  filePath?: string;
  ast: LingCppAst;
  program: LingCppProgram;
  symbolIndex: LingCppSymbolIndex;
  diagnostics: LingCppDiagnostic[];
  designerBindings: LingCppDesignerBindingHint[];
  designerProject?: unknown;
  moduleContext?: LingCppModuleContext;
  moduleContributions: LingCppCompletionCatalogItem[];
  projectGlobals?: LingCppProjectGlobalContext;
  projectTypes?: LingCppProjectTypeContext;
  projectFunctions?: LingCppProjectFunctionContext;
}

export interface LingCppProjectFunctionLibrary extends LingCppFunctionLibrary {
  filePath: string;
}

export interface LingCppProjectFunctionContext {
  libraries: LingCppProjectFunctionLibrary[];
}

export type LingCppAstEdit =
  | { kind: 'update-package'; packageName: string }
  | { kind: 'add-constant'; constant: { name: string; type: string; initialValue: string; note?: string } }
  | { kind: 'update-constant'; constantName: string; newName?: string; type?: string; initialValue?: string; note?: string }
  | { kind: 'delete-constant'; constantName: string }
  | { kind: 'add-global'; global: { name: string; type: string; initialValue?: string; isArray?: boolean; note?: string } }
  | { kind: 'update-global'; globalName: string; newName?: string; type?: string; initialValue?: string; isArray?: boolean; note?: string }
  | { kind: 'delete-global'; globalName: string }
  | { kind: 'add-data-type'; dataType: { name: string; note?: string } }
  | { kind: 'update-data-type'; dataTypeName: string; newName?: string; note?: string }
  | { kind: 'delete-data-type'; dataTypeName: string }
  | { kind: 'move-data-type'; dataTypeName: string; direction: 'up' | 'down' }
  | { kind: 'add-data-field'; dataTypeName: string; field: { name: string; type: string; initialValue?: string; isArray?: boolean; note?: string } }
  | { kind: 'update-data-field'; dataTypeName: string; fieldName: string; newName?: string; type?: string; initialValue?: string; isArray?: boolean; note?: string }
  | { kind: 'delete-data-field'; dataTypeName: string; fieldName: string }
  | { kind: 'move-data-field'; dataTypeName: string; fieldName: string; direction: 'up' | 'down' }
  | { kind: 'update-class'; className?: string; line?: number; newName?: string; baseClass?: string; note?: string }
  | { kind: 'add-member'; className?: string; member: { name: string; type: string; access?: LingCppAccessModifier; initialValue?: string; isStatic?: boolean; isArray?: boolean; note?: string } }
  | { kind: 'update-member'; className?: string; memberName: string; newName?: string; type?: string; access?: LingCppAccessModifier; initialValue?: string; isStatic?: boolean; isArray?: boolean; note?: string }
  | { kind: 'delete-member'; className?: string; memberName: string }
  | { kind: 'add-local'; className?: string; methodName: string; insertBeforeLine?: number; local: { name: string; type: string; initialValue?: string; isArray?: boolean; isConstant?: boolean; note?: string } }
  | { kind: 'update-local'; className?: string; methodName: string; localName: string; newName?: string; type?: string; initialValue?: string; isArray?: boolean; isConstant?: boolean; note?: string }
  | { kind: 'delete-local'; className?: string; methodName: string; localName: string }
  | { kind: 'add-event'; className?: string; event: { handlerName: string; access?: LingCppAccessModifier; parameters?: LingCppParameter[]; note?: string } }
  | { kind: 'update-event'; className?: string; handlerName: string; newHandlerName?: string; access?: LingCppAccessModifier; parameters?: LingCppParameter[]; note?: string }
  | { kind: 'delete-event'; className?: string; handlerName: string }
  | { kind: 'add-method'; className?: string; insertAfterMethodName?: string; method: { name: string; returnType?: string; access?: LingCppAccessModifier; isStatic?: boolean; parameters?: LingCppParameter[]; bodyLines?: string[]; note?: string } }
  | { kind: 'update-method-signature'; className?: string; methodName: string; newName?: string; returnType?: string; access?: LingCppAccessModifier; isStatic?: boolean; parameters?: LingCppParameter[]; note?: string }
  | { kind: 'delete-method'; className?: string; methodName: string }
  | { kind: 'move-method'; className?: string; methodName: string; direction: 'up' | 'down' }
  | { kind: 'insert-method-block'; className?: string; blockLines: string[]; access: LingCppAccessModifier; insertAfterMethodName?: string }
  | { kind: 'update-method-body'; className?: string; methodName: string; bodyLines: string[]; localStatementAnchors?: Record<string, number> }
  | { kind: 'update-note'; line: number; note: string };

export interface LingCppAstEditResult {
  success: boolean;
  sourceCode: string;
  diagnostics: LingCppDiagnostic[];
  change?: WorkspaceEditChange;
  error?: string;
}

export interface LingCppNativeSourceMapEntry {
  generatedFile: string;
  generatedStartLine: number;
  generatedEndLine: number;
  sourceFile?: string;
  sourceStartLine: number;
  sourceEndLine: number;
  kind: 'constant' | 'global' | 'data-type' | 'data-field' | 'function-library' | 'class' | 'event' | 'method' | 'local' | 'statement' | 'native-cpp';
  symbolName: string;
  className?: string;
}
