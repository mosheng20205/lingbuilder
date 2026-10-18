import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEGINNER_INDENT_TEXT,
  indentBeginnerLines,
  outdentBeginnerLines
} from '../src/services/lingCpp/beginnerIndent';

test('Tab 无选区时在光标处插入一个缩进单位并右移光标', () => {
  const source = '调试输出("你好")';
  const result = indentBeginnerLines(source, 0, 0);

  assert.equal(result.value, `    调试输出("你好")`);
  assert.equal(result.selectionStart, 4);
  assert.equal(result.selectionEnd, 4);
  assert.equal(result.changed, true);
});

test('Tab 光标在行中时在光标处插入缩进', () => {
  const source = '调试输出("你好")';
  const cursor = '调试输出'.length;
  const result = indentBeginnerLines(source, cursor, cursor);

  assert.equal(result.value, '调试输出    ("你好")');
  assert.equal(result.selectionStart, cursor + 4);
});

test('Tab 多行选区对触及行整体缩进且选中文本保持不变', () => {
  const source = '如果 (真)\n    调试输出("内")\n调试输出("外")';
  const end = source.length;
  const result = indentBeginnerLines(source, 0, end);

  assert.equal(result.value, `    如果 (真)\n        调试输出("内")\n    调试输出("外")`);
  assert.equal(result.changed, true);
  // 选区仍然覆盖同一份内容：起点越过首行新增缩进，终点在三行行首编辑之后平移 3×4。
  assert.equal(result.selectionStart, 4);
  assert.equal(result.selectionEnd, end + 12);
});

test('Tab 选区末尾位于下一行行首时不缩进下一行', () => {
  const source = '第一行\n第二行\n第三行';
  const result = indentBeginnerLines(source, 0, '第一行\n'.length);

  assert.equal(result.value, `    第一行\n第二行\n第三行`);
  assert.equal(result.selectionEnd, `    第一行\n`.length);
});

test('Tab 多行选区跳过空行且保留 CRLF 行尾', () => {
  const source = '第一行\r\n\r\n第二行';
  const result = indentBeginnerLines(source, 0, source.length);

  assert.equal(result.value, `    第一行\r\n\r\n    第二行`);
  assert.equal(result.value.includes('\r\n'), true);
});

test('Tab 选区内全部是空行时不产生改动', () => {
  const source = '第一行\n\n\n第二行';
  const result = indentBeginnerLines(source, '第一行\n'.length, '第一行\n\n\n'.length);

  assert.equal(result.changed, false);
  assert.equal(result.value, source);
});

test('Shift+Tab 光标所在行移除一个缩进单位', () => {
  const source = '    调试输出("你好")';
  const result = outdentBeginnerLines(source, 8, 8);

  assert.equal(result.value, '调试输出("你好")');
  assert.equal(result.selectionStart, 4);
  assert.equal(result.selectionEnd, 4);
  assert.equal(result.changed, true);
});

test('Shift+Tab 前导空白不足一个缩进单位时全部移除', () => {
  const source = '  调试输出("你好")';
  const result = outdentBeginnerLines(source, 4, 4);

  assert.equal(result.value, '调试输出("你好")');
  assert.equal(result.selectionStart, 2);
  assert.equal(result.selectionEnd, 2);
});

test('Shift+Tab 制表符按一个字符移除', () => {
  const source = '\t\t调试输出("完成")';
  const result = outdentBeginnerLines(source, 3, 3);

  assert.equal(result.value, '\t调试输出("完成")');
});

test('Shift+Tab 多行选区逐行反缩进并跳过无缩进行', () => {
  const source = '    第一行\n第二行\n        第三行';
  const result = outdentBeginnerLines(source, 0, source.length);

  assert.equal(result.value, '第一行\n第二行\n    第三行');
  assert.equal(result.changed, true);
});

test('Shift+Tab 行首无空白且无选区可改时不产生改动', () => {
  const source = '调试输出("你好")';
  const result = outdentBeginnerLines(source, 2, 2);

  assert.equal(result.changed, false);
  assert.equal(result.value, source);
});

test('缩进与反缩进跳过多行文本块内容行，开始行正常参与', () => {
  const source = [
    '    内容 = """',
    '第一行文本',
    '    缩进文本',
    '"""',
    '    调试输出("完成")'
  ].join('\n');
  const indented = indentBeginnerLines(source, 0, source.length);

  assert.equal(indented.value, [
    `        内容 = """`,
    '第一行文本',
    '    缩进文本',
    '"""',
    `        调试输出("完成")`
  ].join('\n'));

  const restored = outdentBeginnerLines(indented.value, 0, indented.value.length);
  assert.equal(restored.value, source);
});

test('缩进单位是 4 个空格，与回车自动对齐一致', () => {
  assert.equal(BEGINNER_INDENT_TEXT, '    ');
});
