import test from 'node:test';
import assert from 'node:assert/strict';

import type { CppFile } from '../src/types';
import {
  getCurrentFileContent,
  isEditorFileDirty
} from '../src/services/files/editorFileState';

test('editor file content preserves an intentional empty document edit', () => {
  const file = createFile({
    originalContent: '原始内容\n',
    translatedContent: '',
    isModified: true
  });

  assert.equal(getCurrentFileContent(file), '');
  assert.equal(isEditorFileDirty(file), true);
});

test('clean template files fall back to original content and format-only changes are dirty', () => {
  const file = createFile({
    originalContent: '模板内容\n',
    translatedContent: '',
    isModified: false,
    formatModified: true
  });

  assert.equal(getCurrentFileContent(file), '模板内容\n');
  assert.equal(isEditorFileDirty(file), true);
});

function createFile(patch: Partial<CppFile>): CppFile {
  return {
    path: 'src/test.lcpp',
    name: 'test.lcpp',
    language: 'lingcpp',
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    originalContent: '',
    translatedContent: '',
    strings: [],
    isModified: false,
    ...patch
  };
}
