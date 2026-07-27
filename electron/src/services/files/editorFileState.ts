import type { CppFile } from '../../types';

/**
 * Returns the editor-visible contents, including an intentional empty-string
 * edit. A clean legacy/template file may still keep its initial text only in
 * `originalContent`, so that case continues to fall back safely.
 */
export function getCurrentFileContent(file: CppFile): string {
  return file.isModified
    ? file.translatedContent
    : (file.translatedContent || file.originalContent || '');
}

export function isEditorFileDirty(file: Pick<CppFile, 'isModified' | 'formatModified'>): boolean {
  return file.isModified || file.formatModified;
}

export interface EditorFileContentUpdate {
  files: CppFile[];
  activeFile: CppFile | null;
  updatedFile: CppFile | null;
}

/**
 * Applies an editor change to the canonical in-memory file collection and, when
 * the changed file is also the primary active file, returns the same updated
 * object for the active-file snapshot. Split editor groups share Monaco models,
 * so keeping these two snapshots aligned prevents a later surface switch from
 * authoritatively restoring stale text over the shared model.
 */
export function updateEditorFileContent(
  files: readonly CppFile[],
  activeFile: CppFile | null,
  filePath: string,
  content: string
): EditorFileContentUpdate {
  const currentFile = files.find(file => file.path === filePath);
  if (!currentFile || getCurrentFileContent(currentFile) === content) {
    return {
      files: files as CppFile[],
      activeFile,
      updatedFile: null
    };
  }

  let updatedFile: CppFile | null = null;
  const nextFiles = files.map(file => {
    if (file.path !== filePath) return file;
    updatedFile = {
      ...file,
      translatedContent: content,
      isModified: content !== file.originalContent
    };
    return updatedFile;
  });

  return {
    files: nextFiles,
    activeFile: activeFile?.path === filePath ? updatedFile : activeFile,
    updatedFile
  };
}
