import assert from 'node:assert/strict';
import test from 'node:test';
import { mapCompilerDiagnostics, parseCompilerDiagnostics } from '../src/services/tasks/compilerDiagnosticService';
import { decodeCompilerOutput } from '../src/services/tasks/compilerOutputEncoding';

test('compiler output keeps UTF-8 and falls back to the Chinese Windows code page', () => {
  assert.equal(decodeCompilerOutput(Buffer.from('中文错误', 'utf8')), '中文错误');
  assert.equal(decodeCompilerOutput(Buffer.from([0xd6, 0xd0, 0xce, 0xc4, 0xb4, 0xed, 0xce, 0xf3])), '中文错误');
});

test('compiler diagnostics parse MSVC, GCC, Clang and linker formats with severity and codes', () => {
  const msvc = parseCompilerDiagnostics('C:\\build\\main.cpp(42,7): error C2065: identifier not found\nmain.cpp(9): warning C4100: unused');
  assert.deepEqual(msvc.map(item => [item.tool, item.severity, item.code, item.line, item.column]), [
    ['msvc', 'error', 'C2065', 42, 7], ['msvc', 'warning', 'C4100', 9, undefined]
  ]);
  const gcc = parseCompilerDiagnostics('/tmp/main.cpp:18:3: error: expected ;');
  const clang = parseCompilerDiagnostics('/tmp/main.cpp:5:2: warning: unused value', 'clang');
  const linker = parseCompilerDiagnostics('LINK : fatal error LNK1104: cannot open file');
  assert.equal(gcc[0].tool, 'gcc'); assert.equal(clang[0].tool, 'clang'); assert.equal(linker[0].tool, 'linker');
});

test('compiler diagnostics map the narrowest generated range back to LingCpp source lines', () => {
  const parsed = parseCompilerDiagnostics('C:\\build\\main.cpp(105,9): error C2143: syntax error');
  const mapped = mapCompilerDiagnostics(parsed, [
    { generatedFile: 'main.cpp', generatedStartLine: 90, generatedEndLine: 130, sourceFile: 'src/Main.lcpp', sourceStartLine: 10, sourceEndLine: 40, kind: 'method', symbolName: 'Run' },
    { generatedFile: 'main.cpp', generatedStartLine: 100, generatedEndLine: 110, sourceFile: 'src/Main.lcpp', sourceStartLine: 20, sourceEndLine: 30, kind: 'statement', symbolName: 'statement' }
  ]);
  assert.equal(mapped[0].filePath, 'src/Main.lcpp'); assert.equal(mapped[0].line, 25);
  assert.equal(mapped[0].generatedLine, 105); assert.match(mapped[0].message, /映射回中文源码/u);
});

test('unmapped and unrelated compiler output degrade safely without fabricated locations', () => {
  const parsed = parseCompilerDiagnostics('hello\nsource.cpp:3:1: note: expanded here');
  const mapped = mapCompilerDiagnostics(parsed, []);
  assert.equal(mapped.length, 1); assert.equal(mapped[0].severity, 'info'); assert.equal(mapped[0].generatedLine, undefined);
});
