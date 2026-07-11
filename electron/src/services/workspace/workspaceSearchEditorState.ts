import type { CppFile } from '../../types';
import {
  TEXT_FILE_ENCODINGS,
  TEXT_FILE_EOLS,
  type TextFileEncoding,
  type TextFileEol,
  type TextFileFormat
} from '../files/types';
import type { WorkspaceSearchMatch } from './workspaceSearchTypes';

export interface WorkspaceSearchProjectLike {
  id: string;
  sourceRoot: string;
  configRoot: string;
}

export interface WorkspaceSearchDiskSnapshot {
  files?: Record<string, string>;
  fileFormats?: Record<string, TextFileFormat>;
}

export interface WorkspaceSearchRevealDetail {
  filePath: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
}

/** Resolve nested projects before a broad compatibility root such as `src`. */
export function findWorkspaceSearchProject<T extends WorkspaceSearchProjectLike>(
  filePath: string,
  projects: readonly T[]
): T | undefined {
  const normalizedPath = normalizeWorkspacePath(filePath);
  return projects
    .map(project => ({
      project,
      specificity: Math.max(
        matchingRootLength(normalizedPath, project.sourceRoot),
        matchingRootLength(normalizedPath, project.configRoot)
      )
    }))
    .filter(candidate => candidate.specificity >= 0)
    .sort((left, right) => right.specificity - left.specificity)[0]?.project;
}

/**
 * Refresh only files touched by a disk replacement. Search replacement is
 * blocked while the editor is dirty, so a successful transaction becomes the
 * new saved baseline without discarding unrelated editor state.
 */
export function refreshWorkspaceSearchEditorFiles(
  editorFiles: readonly CppFile[],
  snapshot: WorkspaceSearchDiskSnapshot,
  changedPaths: readonly string[]
): CppFile[] {
  const changed = new Set(changedPaths.map(normalizeWorkspacePath));
  const diskFiles = snapshot.files || {};
  const formats = snapshot.fileFormats || {};

  return editorFiles.map(file => {
    const filePath = normalizeWorkspacePath(file.path);
    const diskContent = diskFiles[filePath];
    if (!changed.has(filePath) || typeof diskContent !== 'string') return file;

    const format = normalizeFormat(formats[filePath], {
      encoding: file.savedEncoding,
      eol: file.savedEol
    });
    return {
      ...file,
      originalContent: diskContent,
      translatedContent: diskContent,
      encoding: format.encoding,
      eol: format.eol,
      savedEncoding: format.encoding,
      savedEol: format.eol,
      formatModified: false,
      isModified: false
    };
  });
}

export function createWorkspaceSearchRevealDetail(
  match: WorkspaceSearchMatch
): WorkspaceSearchRevealDetail {
  const line = Math.max(1, finiteInteger(match.line, 1));
  const column = Math.max(1, finiteInteger(match.column, 1));
  const endLine = Math.max(line, finiteInteger(match.endLine, line));
  const endColumn = Math.max(endLine === line ? column : 1, finiteInteger(match.endColumn, column));
  return {
    filePath: normalizeWorkspacePath(match.filePath),
    line,
    column,
    endLine,
    endColumn
  };
}

function matchingRootLength(filePath: string, root: string): number {
  const normalizedRoot = normalizeWorkspacePath(root).replace(/\/$/u, '');
  if (!normalizedRoot) return -1;
  return filePath === normalizedRoot || filePath.startsWith(`${normalizedRoot}/`)
    ? normalizedRoot.length
    : -1;
}

function normalizeWorkspacePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/');
}

function normalizeFormat(value: TextFileFormat | undefined, fallback: TextFileFormat): TextFileFormat {
  return {
    encoding: TEXT_FILE_ENCODINGS.includes(value?.encoding as TextFileEncoding)
      ? value!.encoding
      : fallback.encoding,
    eol: TEXT_FILE_EOLS.includes(value?.eol as TextFileEol)
      ? value!.eol
      : fallback.eol
  };
}

function finiteInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.trunc(value) : fallback;
}
