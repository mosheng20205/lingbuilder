import assert from 'node:assert/strict';
import test from 'node:test';

import { foldMsvcNoteLines, mapCompilerDiagnostics, parseCompilerDiagnostics } from '../src/services/tasks/compilerDiagnosticService';
import type { LingCppNativeSourceMapEntry } from '../src/services/lingCpp/types';

test('foldMsvcNoteLines：note 候选行折叠为摘要，error/warning 行保留', () => {
  const output = [
    'main.cpp(12437,14): error C3861: “文本_取左”: 找不到标识符',
    'main.cpp(12437,14): note: 可能是“std::operator+…”',
    'main.cpp(12437,14): note: 可能是“LingCppWideArg(...)”',
    'main.cpp(12600,9): warning C4189: 局部变量已初始化但未引用',
    ''
  ].join('\n');
  const folded = foldMsvcNoteLines(output);
  assert.equal(folded.foldedNotes, 2);
  assert.match(folded.text, /error C3861/u);
  assert.match(folded.text, /warning C4189/u);
  assert.doesNotMatch(folded.text, /可能是“std::operator/u);
  assert.match(folded.text, /另有 2 条 note/u);
  // 无 note 时原样返回，不追加摘要行。
  const untouched = foldMsvcNoteLines('main.cpp(1,1): error C2065: 未声明');
  assert.equal(untouched.foldedNotes, 0);
  assert.equal(untouched.text, 'main.cpp(1,1): error C2065: 未声明');
});

test('parseCompilerDiagnostics + mapCompilerDiagnostics：MSVC 行号回映 .lcpp 源行', () => {
  const output = [
    'main.cpp(120,10): error C3861: “文本_取左”: 找不到标识符',
    'LINK : fatal error LNK1161: 无法打开输出文件'
  ].join('\n');
  const parsed = parseCompilerDiagnostics(output);
  assert.equal(parsed.filter(item => item.severity === 'error').length, 2);
  const code = parsed.find(item => item.code === 'C3861');
  assert.equal(code?.line, 120);

  const sourceMap: LingCppNativeSourceMapEntry[] = [{
    generatedFile: 'main.cpp',
    generatedStartLine: 118,
    generatedEndLine: 122,
    sourceFile: 'src/MainWindow.lcpp',
    sourceStartLine: 14,
    sourceEndLine: 18
  } as LingCppNativeSourceMapEntry];
  const mapped = mapCompilerDiagnostics(parsed, sourceMap, 'T:/ws');
  const mappedCode = mapped.find(item => item.code === 'C3861');
  assert.equal(mappedCode?.filePath, 'src/MainWindow.lcpp');
  assert.equal(mappedCode?.line, 16);
  assert.match(mappedCode?.message || '', /映射回中文源码/u);
});
