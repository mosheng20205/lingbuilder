import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBeginnerCommandTokenAtCursor,
  getBeginnerCompletionContext,
  shouldShowBeginnerCompletion
} from '../src/services/lingCpp/beginnerCompletionContext';
import { getBeginnerBuiltinValueCompletions } from '../src/services/lingCpp/beginnerBuiltinValueCompletions';

test('新手编辑器单击模块命令和点语法控件命令时能够识别提示目标', () => {
  const availableCommands = new Set([
    '选项卡_设置隐藏表头',
    '选项卡_tab.设置选择项'
  ]);
  const source = [
    '选项卡_设置隐藏表头("选项卡1", 真)',
    '选项卡_tab.设置选择项(0)'
  ].join('\n');

  const moduleCursor = source.indexOf('隐藏表头') + 2;
  const controlCursor = source.indexOf('设置选择项') + 2;
  assert.equal(getBeginnerCommandTokenAtCursor(source, moduleCursor, availableCommands)?.token, '选项卡_设置隐藏表头');
  assert.equal(getBeginnerCommandTokenAtCursor(source, controlCursor, availableCommands)?.token, '选项卡_tab.设置选择项');
});

test('新手命令提示不会把字符串或注释中的同名文本识别为命令', () => {
  const availableCommands = new Set(['选项卡_设置隐藏表头']);
  const stringSource = '调试输出("选项卡_设置隐藏表头")';
  const commentSource = '// 选项卡_设置隐藏表头("选项卡1", 真)';

  assert.equal(getBeginnerCommandTokenAtCursor(stringSource, stringSource.indexOf('隐藏表头'), availableCommands), null);
  assert.equal(getBeginnerCommandTokenAtCursor(commentSource, commentSource.indexOf('隐藏表头'), availableCommands), null);
});

test('新手编辑器用 z 和 j 精确补全真假逻辑值', () => {
  const trueItems = getBeginnerBuiltinValueCompletions('z');
  const falseItems = getBeginnerBuiltinValueCompletions('j');

  assert.equal(trueItems[0]?.label, '真');
  assert.equal(trueItems[0]?.insertText, '真');
  assert.equal(falseItems[0]?.label, '假');
  assert.equal(falseItems[0]?.insertText, '假');
});

test('新手编辑器允许在控件方法参数中使用拼音补全表达式命令', () => {
  const source = '选项卡1.设置选择项(dzs';
  const context = getBeginnerCompletionContext(source, source.length);

  assert.equal(context.token, 'dzs');
  assert.equal(context.parenDepth, 1);
  assert.equal(shouldShowBeginnerCompletion(context, false), true);
});

test('新手编辑器允许在赋值右侧使用变量拼音补全', () => {
  const source = '编辑框1.内容=bj';
  const context = getBeginnerCompletionContext(source, source.length);

  assert.equal(context.token, 'bj');
  assert.equal(context.isCommandStart, false);
  assert.equal(context.isAssignmentValue, true);
  assert.equal(shouldShowBeginnerCompletion(context, false), true);

  const comparison = getBeginnerCompletionContext('本机IP==bj', '本机IP==bj'.length);
  assert.equal(comparison.isAssignmentValue, false);
});

test('新手编辑器在任意代码表达式位置按拼音补全符号', () => {
  const comparison = getBeginnerCompletionContext('如果真 (本机IP == bj', '如果真 (本机IP == bj'.length);
  const returnValue = getBeginnerCompletionContext('返回 bj', '返回 bj'.length);
  const arithmetic = getBeginnerCompletionContext('结果 + bj', '结果 + bj'.length);

  assert.equal(shouldShowBeginnerCompletion(comparison, false), true);
  assert.equal(shouldShowBeginnerCompletion(returnValue, false), true);
  assert.equal(shouldShowBeginnerCompletion(arithmetic, false), true);
});

test('新手编辑器输入数字字面量时不弹出命令补全', () => {
  const assignment = getBeginnerCompletionContext('数值=0', '数值=0'.length);
  assert.equal(assignment.token, '0');
  assert.equal(assignment.isAssignmentValue, true);
  assert.equal(shouldShowBeginnerCompletion(assignment, false), false);

  const multiDigit = getBeginnerCompletionContext('数值=123', '数值=123'.length);
  assert.equal(shouldShowBeginnerCompletion(multiDigit, false), false);

  const decimal = getBeginnerCompletionContext('结果=3.1', '结果=3.1'.length);
  assert.equal(shouldShowBeginnerCompletion(decimal, false), false);

  const lineStart = getBeginnerCompletionContext('0', 1);
  assert.equal(shouldShowBeginnerCompletion(lineStart, false), false);
});

test('新手编辑器在赋值右侧输入拼音时仍保留变量补全', () => {
  const pinyin = getBeginnerCompletionContext('数值=bj', '数值=bj'.length);
  assert.equal(pinyin.isAssignmentValue, true);
  assert.equal(shouldShowBeginnerCompletion(pinyin, false), true);

  const manual = getBeginnerCompletionContext('数值=0', '数值=0'.length);
  assert.equal(shouldShowBeginnerCompletion(manual, true), true);
});

test('新手编辑器仍禁止在字符串和注释中弹出普通命令补全', () => {
  const stringSource = '调试输出("dzs';
  const commentSource = '选项卡1.设置选择项(0) // dzs';

  assert.equal(shouldShowBeginnerCompletion(getBeginnerCompletionContext(stringSource, stringSource.length), false), false);
  assert.equal(shouldShowBeginnerCompletion(getBeginnerCompletionContext(commentSource, commentSource.length), false), false);
});
