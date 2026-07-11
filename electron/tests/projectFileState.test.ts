import test from 'node:test';
import assert from 'node:assert/strict';

import type { CppFile } from '../src/types';
import {
  applyProjectFileDelete,
  applyProjectFileRename
} from '../src/services/workspace/projectFileState';

test('project file rename preserves the latest unsaved editor contents and tab selection', () => {
  const source = createFile('src/旧名称.lcpp', '尚未保存的新内容', true);
  const other = createFile('src/其他.lcpp', '其他内容');

  const result = applyProjectFileRename({
    files: [source, other],
    openTabs: [source.path, other.path],
    activeFilePath: source.path
  }, source.path, 'src/新名称.lcpp', 'lingcpp');

  assert.equal(result.files[0].path, 'src/新名称.lcpp');
  assert.equal(result.files[0].translatedContent, '尚未保存的新内容');
  assert.equal(result.files[0].isModified, true);
  assert.deepEqual(result.openTabs, ['src/新名称.lcpp', other.path]);
  assert.equal(result.activeFilePath, 'src/新名称.lcpp');
});

test('project file delete selects the neighboring surviving tab', () => {
  const files = ['a.lcpp', 'b.lcpp', 'c.lcpp'].map(name => createFile(`src/${name}`, name));
  const result = applyProjectFileDelete({
    files,
    openTabs: files.map(file => file.path),
    activeFilePath: files[1].path
  }, files[1].path);

  assert.deepEqual(result.files.map(file => file.path), ['src/a.lcpp', 'src/c.lcpp']);
  assert.deepEqual(result.openTabs, ['src/a.lcpp', 'src/c.lcpp']);
  assert.equal(result.activeFilePath, 'src/c.lcpp');
});

test('project file delete supports an empty state for the future TextModel host', () => {
  const file = createFile('src/only.lcpp', 'only');
  const result = applyProjectFileDelete({
    files: [file],
    openTabs: [file.path],
    activeFilePath: file.path
  }, file.path);

  assert.deepEqual(result.files, []);
  assert.deepEqual(result.openTabs, []);
  assert.equal(result.activeFilePath, null);
});

function createFile(path: string, content: string, isModified = false): CppFile {
  return {
    path,
    name: path.split('/').pop() || path,
    language: 'lingcpp',
    encoding: 'utf8',
    eol: 'lf',
    savedEncoding: 'utf8',
    savedEol: 'lf',
    formatModified: false,
    originalContent: isModified ? '磁盘旧内容' : content,
    translatedContent: content,
    strings: [],
    isModified
  };
}
