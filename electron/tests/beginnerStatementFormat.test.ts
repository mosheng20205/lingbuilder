import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBeginnerAssignmentAtCursor,
  formatBeginnerAssignmentLine
} from '../src/services/lingCpp/beginnerStatementFormat';

test('回车提交语句时赋值运算符两侧补空格', () => {
  assert.equal(formatBeginnerAssignmentLine('数值=到整数(编辑框1.内容)'), '数值 = 到整数(编辑框1.内容)');
  assert.equal(formatBeginnerAssignmentLine('        局部 整数型 数值=0'), '        局部 整数型 数值 = 0');
  assert.equal(formatBeginnerAssignmentLine('数值  =  到整数(x)'), '数值 = 到整数(x)');
  assert.equal(formatBeginnerAssignmentLine('数值＝到整数(x)'), '数值 = 到整数(x)');
  assert.equal(formatBeginnerAssignmentLine('编辑框1.内容=bj'), '编辑框1.内容 = bj');
});

test('字符串、注释、比较符和括号内的等号不被改写', () => {
  assert.equal(formatBeginnerAssignmentLine('调试输出("a=b")'), '调试输出("a=b")');
  assert.equal(formatBeginnerAssignmentLine('调试输出(“键=值”)'), '调试输出(“键=值”)');
  assert.equal(formatBeginnerAssignmentLine('// 数值=0'), '// 数值=0');
  assert.equal(formatBeginnerAssignmentLine('数值=0 // 初始化'), '数值 = 0 // 初始化');
  assert.equal(formatBeginnerAssignmentLine('如果 (本机IP==bj)'), '如果 (本机IP==bj)');
  assert.equal(formatBeginnerAssignmentLine('如果 (x = 3)'), '如果 (x = 3)');
  assert.equal(formatBeginnerAssignmentLine('@ int x=1;'), '@ int x=1;');
  assert.equal(formatBeginnerAssignmentLine('变量循环首(i=1, 10)'), '变量循环首(i=1, 10)');
});

test('已规范的行保持不变（幂等）', () => {
  assert.equal(formatBeginnerAssignmentLine('数值 = 到整数(编辑框1.内容)'), '数值 = 到整数(编辑框1.内容)');
  assert.equal(formatBeginnerAssignmentLine('调试输出(数值)'), '调试输出(数值)');
  assert.equal(formatBeginnerAssignmentLine('数值='), '数值=');
});

test('光标在行尾时整体文本与光标同步调整，行中不改写', () => {
  const single = '数值=到整数(编辑框1.内容)';
  const result = formatBeginnerAssignmentAtCursor(single, single.length);
  assert.equal(result.changed, true);
  assert.equal(result.value, '数值 = 到整数(编辑框1.内容)');
  assert.equal(result.cursor, '数值 = 到整数(编辑框1.内容)'.length);

  const before = '调试输出("开")\n数值=0\n后续';
  const multiLine = formatBeginnerAssignmentAtCursor(before, '调试输出("开")\n数值=0'.length);
  assert.equal(multiLine.value, '调试输出("开")\n数值 = 0\n后续');
  assert.equal(multiLine.cursor, '调试输出("开")\n数值 = 0'.length);

  const midLine = formatBeginnerAssignmentAtCursor('数值=0', 2);
  assert.equal(midLine.changed, false);
  assert.equal(midLine.value, '数值=0');
  assert.equal(midLine.cursor, 2);
});
