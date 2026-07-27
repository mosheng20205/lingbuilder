import test from 'node:test';
import assert from 'node:assert/strict';

import type { CppFile } from '../src/types';
import {
  getCurrentFileContent,
  isEditorFileDirty,
  updateEditorFileContent
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

test('split editor changes keep the matching active-file snapshot synchronized', () => {
  const active = createFile({ originalContent: '旧内容', translatedContent: '旧内容' });
  const other = createFile({ path: 'src/other.lcpp', name: 'other.lcpp', originalContent: '其它' });

  const result = updateEditorFileContent([active, other], active, active.path, '第二编辑组的新内容');

  assert.equal(result.files[0].translatedContent, '第二编辑组的新内容');
  assert.equal(result.activeFile?.translatedContent, '第二编辑组的新内容');
  assert.equal(result.activeFile, result.files[0]);
  assert.equal(result.activeFile?.isModified, true);
});

test('editing a secondary file does not replace a different primary active file', () => {
  const active = createFile({ originalContent: '主文件' });
  const secondary = createFile({
    path: 'src/secondary.lcpp',
    name: 'secondary.lcpp',
    originalContent: '旧内容'
  });

  const result = updateEditorFileContent([active, secondary], active, secondary.path, '新内容');

  assert.equal(result.activeFile, active);
  assert.equal(result.files[1].translatedContent, '新内容');
});

test('split editor ignores unchanged Monaco synchronization events', () => {
  const active = createFile({ originalContent: '相同内容', translatedContent: '相同内容' });
  const files = [active];

  const result = updateEditorFileContent(files, active, active.path, '相同内容');

  assert.equal(result.files, files);
  assert.equal(result.activeFile, active);
  assert.equal(result.updatedFile, null);
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
