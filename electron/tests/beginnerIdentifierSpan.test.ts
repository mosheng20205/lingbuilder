import assert from 'node:assert/strict';
import test from 'node:test';

import { getBeginnerIdentifierSpanAtOffset } from '../src/services/lingCpp/beginnerTextPosition';

const LINE = '    缓冲区_销毁(缓冲区句柄)';

test('double-click identifier span covers full CJK names with underscores', () => {
  const commandStart = LINE.indexOf('缓冲区_销毁');
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(LINE, commandStart), {
    start: commandStart,
    end: commandStart + '缓冲区_销毁'.length
  });
  // 双击命中命令名中段：仍选中完整命令名
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(LINE, commandStart + 4), {
    start: commandStart,
    end: commandStart + '缓冲区_销毁'.length
  });
  // 双击参数里的变量名：整名选中，而不是浏览器词典词「缓冲区」
  const argumentStart = LINE.indexOf('缓冲区句柄');
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(LINE, argumentStart + 2), {
    start: argumentStart,
    end: argumentStart + '缓冲区句柄'.length
  });
});

test('double-click identifier span stops at punctuation and keeps native behavior off-identifiers', () => {
  // 命中点落在标识符右侧边界（如 ( 的左半格）：向左扩展完整标识符，避免右半格点击选不中
  const openParen = LINE.indexOf('(');
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(LINE, openParen), {
    start: LINE.indexOf('缓冲区_销毁'),
    end: openParen
  });
  // 行首缩进空白处双击：非标识符，保留原生行为
  assert.equal(getBeginnerIdentifierSpanAtOffset(LINE, 0), null);
  // 命中点紧贴标识符右边界（) 前）时向左扩展完整标识符
  const close = LINE.indexOf(')');
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(LINE, close), {
    start: LINE.indexOf('缓冲区句柄'),
    end: close
  });
  // 两侧都是非标识符（逗号后空白）：保留原生行为
  assert.equal(getBeginnerIdentifierSpanAtOffset('调试输出(局部变量2, )', '调试输出(局部变量2,'.length), null);
});

test('double-click identifier span works across lines and clamps out-of-range offsets', () => {
  const value = '局部变量2 = 字节集_Base64编码(缓冲区_到字节集(缓冲区句柄))\n调试输出(局部变量2, )';
  const name = '字节集_Base64编码';
  assert.deepEqual(getBeginnerIdentifierSpanAtOffset(value, value.indexOf(name) + 1), {
    start: value.indexOf(name),
    end: value.indexOf(name) + name.length
  });
  assert.equal(getBeginnerIdentifierSpanAtOffset(value, 9999), null);
  assert.equal(getBeginnerIdentifierSpanAtOffset('', 0), null);
});
