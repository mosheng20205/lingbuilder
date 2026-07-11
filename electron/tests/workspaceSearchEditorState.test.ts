import test from 'node:test';
import assert from 'node:assert/strict';

import type { CppFile } from '../src/types';
import {
  createWorkspaceSearchRevealDetail,
  findWorkspaceSearchProject,
  refreshWorkspaceSearchEditorFiles
} from '../src/services/workspace/workspaceSearchEditorState';

const sourceFile: CppFile = {
  path: 'src/demo/main.lcpp',
  name: 'main.lcpp',
  language: 'lingcpp',
  encoding: 'utf8',
  eol: 'lf',
  savedEncoding: 'utf8',
  savedEol: 'lf',
  formatModified: false,
  originalContent: '旧内容',
  translatedContent: '草稿内容',
  strings: [],
  isModified: true
};

test('workspace search navigation chooses the most specific owning project root', () => {
  const projects = [
    { id: 'compat', sourceRoot: 'src', configRoot: 'config' },
    { id: 'demo', sourceRoot: 'src/demo', configRoot: 'config/demo' }
  ];
  assert.equal(findWorkspaceSearchProject('src/demo/main.lcpp', projects)?.id, 'demo');
  assert.equal(findWorkspaceSearchProject('config/settings.ini', projects)?.id, 'compat');
  assert.equal(findWorkspaceSearchProject('README.md', projects), undefined);
});

test('workspace replacement refreshes only changed loaded files and adopts disk format', () => {
  const untouched = { ...sourceFile, path: 'src/demo/other.lcpp', name: 'other.lcpp' };
  const next = refreshWorkspaceSearchEditorFiles(
    [sourceFile, untouched],
    {
      files: { 'src/demo/main.lcpp': '新内容\n' },
      fileFormats: { 'src/demo/main.lcpp': { encoding: 'utf16le', eol: 'crlf' } }
    },
    ['src\\demo\\main.lcpp']
  );

  assert.equal(next[0].originalContent, '新内容\n');
  assert.equal(next[0].translatedContent, '新内容\n');
  assert.equal(next[0].encoding, 'utf16le');
  assert.equal(next[0].eol, 'crlf');
  assert.equal(next[0].isModified, false);
  assert.equal(next[0].formatModified, false);
  assert.equal(next[1], untouched);
});

test('workspace search reveal detail clamps invalid ranges and normalizes paths', () => {
  assert.deepEqual(createWorkspaceSearchRevealDetail({
    id: 'match-1',
    filePath: 'src\\demo\\main.lcpp',
    line: 4,
    column: 8,
    endLine: 2,
    endColumn: 1,
    matchText: '窗口',
    preview: '信息框("窗口")'
  }), {
    filePath: 'src/demo/main.lcpp',
    line: 4,
    column: 8,
    endLine: 4,
    endColumn: 8
  });
});
