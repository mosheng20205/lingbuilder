export interface ExtractedString {
  id: string;
  original: string;
  translated: string;
  line: number;
  type: 'string' | 'comment' | 'macro' | 'resource';
  status: 'pending' | 'translated' | 'skipped';
  context?: string; // Surrounding C++ code context
}

export interface GlossaryTerm {
  english: string;
  chinese: string;
  description?: string;
}

export interface CppFile {
  path: string;
  name: string;
  language: 'cpp' | 'header' | 'resource' | 'ini' | 'epl';
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
  level: 'error' | 'warning' | 'info';
  message: string;
  codeSnippet: string;
  suggestion: string;
}

export type BottomPanelTabType =
  | 'extracted'
  | 'designer_xml'
  | 'designer_cpp'
  | 'designer_manifest'
  | 'designer_logs'
  | 'problems'
  | 'output'
  | 'debug_locals'
  | 'debug_logs';

export interface DesignerGeneratedPanelData {
  xmlLabel: string;
  cppLabel: string;
  manifestLabel: string;
  xmlCode: string;
  cppCode: string;
  manifestCode: string;
  logs: string[];
  isBuilding: boolean;
}
