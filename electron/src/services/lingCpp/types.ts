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
  members: LingCppMember[];
  methods: LingCppMethod[];
}

export interface LingCppMember {
  name: string;
  type: string;
  access: LingCppAccessModifier;
  line: number;
  initialValue?: string;
}

export interface LingCppMethod {
  name: string;
  returnType: string;
  access: LingCppAccessModifier;
  kind: 'constructor' | 'destructor' | 'method' | 'event';
  line: number;
  parameters: LingCppParameter[];
  statements: LingCppStatement[];
}

export interface LingCppParameter {
  name: string;
  type: string;
}

export interface LingCppStatement {
  line: number;
  indent: string;
  text: string;
}

export interface LingCppEventBinding {
  handlerName: string;
  className: string;
  methodName: string;
}

export interface LingCppParseResult {
  program: LingCppProgram;
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

export interface LingCppEditContext {
  filePath: string;
  sourceCode: string;
  instruction: string;
  selection?: WorkspaceEditRange;
  workspaceFiles?: LingCppWorkspaceFile[];
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
  files: SourceControlFileStatus[];
  error?: string;
}
