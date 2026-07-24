import { LingCppModuleContext } from '../modules/types';

export type LingCppAccessModifier = '公开' | '私有' | '保护';

export interface LingCppDiagnostic {
  id: string;
  line: number;
  level: 'error' | 'warning' | 'info';
  message: string;
  codeSnippet: string;
  suggestion: string;
}

export interface LingCppProgram {
  packageName: string;
  uses: string[];
  classes: LingCppClass[];
  diagnostics: LingCppDiagnostic[];
  source: string;
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
  statements: LingCppStatement[];
}

export interface LingCppParameter {
  name: string;
  type: string;
  defaultValue?: string;
}

export interface LingCppStatement {
  line: number;
  indent: string;
  text: string;
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
  | 'class'
  | 'access'
  | 'member'
  | 'constructor'
  | 'destructor'
  | 'method'
  | 'event'
  | 'parameter'
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
  children: LingCppAstNode[];
}

export interface LingCppSymbolIndex {
  declarations: LingCppAstNode[];
  classes: LingCppAstNode[];
  members: LingCppAstNode[];
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
}

export interface LingCppWorkspaceFile {
  filePath: string;
  sourceCode: string;
  language?: string;
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
  selection?: WorkspaceEditRange;
  workspaceFiles?: LingCppWorkspaceFile[];
  moduleContext?: LingCppModuleContext;
  aiConfig?: AiConnectionConfig;
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
  group: 'declaration' | 'package' | 'class' | 'member' | 'method' | 'constructor' | 'event' | 'parameter' | 'note';
  name: string;
  type?: string;
  value?: string;
  note: string;
  line: number;
  blockId?: string;
  status?: LingCppDesignerBindingStatus;
  editable?: boolean;
  editKind?: 'package' | 'class' | 'member' | 'method' | 'event' | 'missing-event' | 'note';
  className?: string;
  targetName?: string;
  access?: LingCppAccessModifier;
  initialValue?: string;
  returnType?: string;
  isStatic?: boolean;
  isArray?: boolean;
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
}

export type LingCppAstEdit =
  | { kind: 'update-package'; packageName: string }
  | { kind: 'update-class'; className?: string; line?: number; newName?: string; baseClass?: string; note?: string }
  | { kind: 'add-member'; className?: string; member: { name: string; type: string; access?: LingCppAccessModifier; initialValue?: string; isStatic?: boolean; isArray?: boolean; note?: string } }
  | { kind: 'update-member'; className?: string; memberName: string; newName?: string; type?: string; access?: LingCppAccessModifier; initialValue?: string; isStatic?: boolean; isArray?: boolean; note?: string }
  | { kind: 'delete-member'; className?: string; memberName: string }
  | { kind: 'add-event'; className?: string; event: { handlerName: string; access?: LingCppAccessModifier; parameters?: LingCppParameter[]; note?: string } }
  | { kind: 'update-event'; className?: string; handlerName: string; newHandlerName?: string; access?: LingCppAccessModifier; parameters?: LingCppParameter[]; note?: string }
  | { kind: 'delete-event'; className?: string; handlerName: string }
  | { kind: 'add-method'; className?: string; method: { name: string; returnType?: string; access?: LingCppAccessModifier; isStatic?: boolean; parameters?: LingCppParameter[]; bodyLines?: string[]; note?: string } }
  | { kind: 'update-method-signature'; className?: string; methodName: string; newName?: string; returnType?: string; access?: LingCppAccessModifier; isStatic?: boolean; parameters?: LingCppParameter[]; note?: string }
  | { kind: 'delete-method'; className?: string; methodName: string }
  | { kind: 'update-method-body'; className?: string; methodName: string; bodyLines: string[] }
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
  kind: 'class' | 'event' | 'method' | 'statement' | 'native-cpp';
  symbolName: string;
  className?: string;
}
