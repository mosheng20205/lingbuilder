import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getBeginnerBodySourceColumns,
  inferBeginnerBodyStartColumn,
  mapBeginnerBodyTextPosition,
  textPositionAtOffset
} from '../src/services/textModel/beginnerTextPosition';

test('text offsets preserve CRLF-safe local line and column positions', () => {
  assert.deepEqual(textPositionAtOffset('第一行\r\n第二行', 6), { line: 2, column: 2 });
  assert.deepEqual(textPositionAtOffset('abc', 99), { line: 1, column: 4 });
});

test('empty and leading-blank method bodies inherit declaration indentation plus four spaces', () => {
  const lines = ['类 测试', '    子程序()', '', '        调试输出("测试")'];
  assert.equal(inferBeginnerBodyStartColumn(lines, 2, []), 9);
  assert.equal(inferBeginnerBodyStartColumn(lines, 2, [3, 4]), 9);
  assert.deepEqual(getBeginnerBodySourceColumns([
    { indent: '', text: '' },
    { indent: '        ', text: '调试输出("测试")' }
  ], 9), [9, 9]);
  assert.deepEqual(mapBeginnerBodyTextPosition('字\n调试输出("测试")', 1, [3, 4], 3, [9, 9], 9), {
    line: 3,
    column: 10
  });
});

test('beginner method body positions map to complete source lines', () => {
  const original = '调试输出("一")\n调试输出("二")';
  const secondLineOffset = original.indexOf('二');
  assert.deepEqual(mapBeginnerBodyTextPosition(original, 0, [21, 24], 21, [9, 13], 9), {
    line: 21,
    column: 9
  });
  assert.deepEqual(mapBeginnerBodyTextPosition(original, secondLineOffset, [21, 24], 21, [9, 13], 9), {
    line: 24,
    column: 19
  });

  const inserted = `${original}\n调试输出("新增")`;
  assert.deepEqual(mapBeginnerBodyTextPosition(inserted, inserted.indexOf('新增'), [21, 24], 21, [9, 13], 9), {
    line: 23,
    column: 15
  });
});
