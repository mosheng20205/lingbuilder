import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDiff } from '../src/utils/diff';

test('diff treats CRLF, LF, and lone CR line endings as equivalent', () => {
  const crlf = computeDiff('第一行\r\n第二行\r\n', '第一行\n第二行\n');
  assert.deepEqual(crlf.stats, { added: 0, deleted: 0, modified: 0, unchanged: 3 });
  assert.deepEqual(crlf.originalLines.map(line => line.content), ['第一行', '第二行', '']);

  const loneCr = computeDiff('第一行\r第二行', '第一行\n第二行');
  assert.deepEqual(loneCr.stats, { added: 0, deleted: 0, modified: 0, unchanged: 2 });
});

test('diff aligns an insertion in the middle without turning following lines into modifications', () => {
  const result = computeDiff('甲\n乙\n丙', '甲\n新增\n乙\n丙');

  assert.deepEqual(result.stats, { added: 1, deleted: 0, modified: 0, unchanged: 3 });
  assert.deepEqual(result.originalLines.map(line => line.type), ['unchanged', 'added', 'unchanged', 'unchanged']);
  assert.deepEqual(result.translatedLines.map(line => line.content), ['甲', '新增', '乙', '丙']);
  assert.equal(result.originalLines[1].content, '');
  assert.equal(result.translatedLines[1].translatedLineNumber, 2);
});

test('diff aligns a deletion in the middle without losing the later anchor', () => {
  const result = computeDiff('甲\n待删除\n乙\n丙', '甲\n乙\n丙');

  assert.deepEqual(result.stats, { added: 0, deleted: 1, modified: 0, unchanged: 3 });
  assert.deepEqual(result.originalLines.map(line => line.content), ['甲', '待删除', '乙', '丙']);
  assert.deepEqual(result.translatedLines.map(line => line.type), ['unchanged', 'deleted', 'unchanged', 'unchanged']);
  assert.equal(result.translatedLines[1].content, '');
  assert.equal(result.originalLines[1].originalLineNumber, 2);
});

test('diff reports a middle replacement as one modification with word highlights', () => {
  const result = computeDiff('开始\nconst title = "Hello";\n结束', '开始\nconst title = "你好";\n结束');

  assert.deepEqual(result.stats, { added: 0, deleted: 0, modified: 1, unchanged: 2 });
  assert.equal(result.originalLines[1].type, 'modified');
  assert.equal(result.translatedLines[1].type, 'modified');
  assert.ok(result.originalLines[1].words?.some(word => word.text === '"Hello"' && word.changed));
  assert.ok(result.translatedLines[1].words?.some(word => word.text === '"你好"' && word.changed));
});

test('diff handles an insertion and deletion even when both files have the same line count', () => {
  const result = computeDiff('甲\n乙\n丙', '甲\n新增\n乙');

  assert.deepEqual(result.stats, { added: 1, deleted: 1, modified: 0, unchanged: 2 });
  assert.deepEqual(result.originalLines.map(line => line.type), ['unchanged', 'added', 'unchanged', 'deleted']);
  assert.deepEqual(result.translatedLines.map(line => line.content), ['甲', '新增', '乙', '']);
});

test('diff preserves a final newline as an explicit added or deleted empty line', () => {
  const addedFinalNewline = computeDiff('内容', '内容\n');
  assert.deepEqual(addedFinalNewline.stats, { added: 1, deleted: 0, modified: 0, unchanged: 1 });
  assert.equal(addedFinalNewline.translatedLines[1].content, '');
  assert.equal(addedFinalNewline.translatedLines[1].translatedLineNumber, 2);

  const deletedFinalNewline = computeDiff('内容\n', '内容');
  assert.deepEqual(deletedFinalNewline.stats, { added: 0, deleted: 1, modified: 0, unchanged: 1 });
  assert.equal(deletedFinalNewline.originalLines[1].content, '');
  assert.equal(deletedFinalNewline.originalLines[1].originalLineNumber, 2);
});

test('diff trims large unchanged prefixes and suffixes around a localized edit', () => {
  const originalLines = Array.from({ length: 12_000 }, (_, index) => `第 ${index + 1} 行`);
  const translatedLines = [...originalLines];
  translatedLines[5_999] = '第 6000 行（已修改）';

  const result = computeDiff(originalLines.join('\n'), translatedLines.join('\n'));

  assert.deepEqual(result.stats, { added: 0, deleted: 0, modified: 1, unchanged: 11_999 });
  assert.equal(result.originalLines[5_999].type, 'modified');
  assert.equal(result.translatedLines[5_999].content, '第 6000 行（已修改）');
});

test('diff treats clearing a non-empty file as deleting every original line', () => {
  const result = computeDiff('第一行\n第二行', '');

  assert.deepEqual(result.stats, { added: 0, deleted: 2, modified: 0, unchanged: 0 });
  assert.deepEqual(result.originalLines.map(line => line.type), ['deleted', 'deleted']);
  assert.deepEqual(result.translatedLines.map(line => line.content), ['', '']);
});
