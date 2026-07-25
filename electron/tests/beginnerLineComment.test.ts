import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleBeginnerLineComment } from '../src/services/lingCpp/beginnerLineComment';

test('新手编辑器 Ctrl+/ 注释光标所在行并保留缩进和光标位置', () => {
  const source = '    调试输出("你好")';
  const result = toggleBeginnerLineComment(source, 8, 8);

  assert.equal(result.value, '    // 调试输出("你好")');
  assert.equal(result.selectionStart, 11);
  assert.equal(result.selectionEnd, 11);
  assert.equal(result.commented, true);
});

test('新手编辑器 Ctrl+/ 可取消多行注释并跳过空行', () => {
  const source = [
    '    // 信息框("你好")',
    '',
    '\t// 调试输出("完成")'
  ].join('\n');
  const result = toggleBeginnerLineComment(source, 0, source.length);

  assert.equal(result.value, [
    '    信息框("你好")',
    '',
    '\t调试输出("完成")'
  ].join('\n'));
  assert.equal(result.selectionStart, 0);
  assert.equal(result.selectionEnd, result.value.length);
  assert.equal(result.commented, false);
});

test('多行选区末尾位于下一行行首时不修改下一行', () => {
  const source = '第一行\n第二行\n第三行';
  const result = toggleBeginnerLineComment(source, 0, '第一行\n'.length);

  assert.equal(result.value, '// 第一行\n第二行\n第三行');
  assert.equal(result.selectionEnd, '// 第一行\n'.length);
});

test('混合注释选区会统一添加注释并保持 CRLF', () => {
  const source = '// 已注释\r\n未注释';
  const result = toggleBeginnerLineComment(source, 0, source.length);

  assert.equal(result.value, '// // 已注释\r\n// 未注释');
  assert.equal(result.value.includes('\r\n'), true);
  assert.equal(result.commented, true);
});

test('文件以空行开头时选区仍从真实首行计算', () => {
  const source = '\n调试输出("继续")';
  const result = toggleBeginnerLineComment(source, 0, source.length);

  assert.equal(result.value, '\n// 调试输出("继续")');
});
