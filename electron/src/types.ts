export interface ExtractedString {
  id: string;
  original: string;
  translated: string;
  line: number;
  type: 'string' | 'comment' | 'macro' | 'resource';
  status: 'pending' | 'translated' | 'skipped';
  context?: string; // Surrounding C++ code context
}


export interface CppFile {
  path: string;
  name: string;
  language: 'cpp' | 'header' | 'resource' | 'ini' | 'epl' | 'lingcpp';
  /** Disk encoding selected for the next save. Editor content is normalized to LF. */
  encoding: import('./services/files/types').TextFileEncoding;
  /** Disk line-ending style selected for the next save. */
  eol: import('./services/files/types').TextFileEol;
  savedEncoding: import('./services/files/types').TextFileEncoding;
  savedEol: import('./services/files/types').TextFileEol;
  /** True when only encoding/EOL (rather than text) differs from the saved file. */
  formatModified: boolean;
  originalContent: string;
  translatedContent: string;
  strings: ExtractedString[];
  isModified: boolean;
}

export interface DiffLine {
  lineNumber: number;
  originalLineNumber?: number;
  translatedLineNumber?: number;
  type: 'added' | 'deleted' | 'modified' | 'unchanged';
  content: string;
  words?: { text: string; changed: boolean }[]; // For word-level diff highlight
}

export interface DiffResult {
  originalLines: DiffLine[];
  translatedLines: DiffLine[];
  stats: {
    added: number;
    deleted: number;
    modified: number;
    unchanged: number;
  };
}

export interface ProblemItem {
  id: string;
  filePath: string;
  line: number;
  column?: number;
  code?: string;
  source?: string;
  level: 'error' | 'warning' | 'info';
  message: string;
  codeSnippet: string;
  suggestion: string;
  actionLabel?: string;
  actionKind?: string;
  audienceText?: string;
  beginnerActionLabel?: string;
  severityForBeginner?: 'must-fix' | 'suggestion' | 'learning';
  canIgnore?: boolean;
  locationKind?: 'source' | 'insertion';
}

export interface CommandHintParameter {
  name: string;
  type: string;
  note: string;
}

export interface CommandHintContent {
  command: string;
  signature: string;
  returnType: string;
  returnDescription?: string;
  summary: string;
  parameters: CommandHintParameter[];
  example: string;
}

export type BottomPanelTabType =
  | 'extracted'
  | 'module_hint'
  | 'problems'
  | 'output'
  | 'terminal'
  | 'tests'
  | 'debug_locals'
  | 'debug_logs';

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
  explanation: string;
  changes: WorkspaceEditChange[];
  designerProject?: import('./services/windowDesigner/types').LingWindowProject;
  designerProjectOriginal?: import('./services/windowDesigner/types').LingWindowProject;
}

export interface WorkspaceFileSnapshot {
  filePath: string;
  sourceCode: string;
  language?: CppFile['language'];
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
