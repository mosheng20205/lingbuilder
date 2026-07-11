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
