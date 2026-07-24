import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getBeginnerCompletionContext,
  shouldShowBeginnerCompletion
} from '../src/services/lingCpp/beginnerCompletionContext';

test('新手编辑器允许在控件方法参数中使用拼音补全表达式命令', () => {
  const source = '选项卡1.设置选择项(dzs';
  const context = getBeginnerCompletionContext(source, source.length);

  assert.equal(context.token, 'dzs');
  assert.equal(context.parenDepth, 1);
  assert.equal(shouldShowBeginnerCompletion(context, false), true);
});

test('新手编辑器仍禁止在字符串和注释中弹出普通命令补全', () => {
  const stringSource = '调试输出("dzs';
  const commentSource = '选项卡1.设置选择项(0) // dzs';

  assert.equal(shouldShowBeginnerCompletion(getBeginnerCompletionContext(stringSource, stringSource.length), false), false);
  assert.equal(shouldShowBeginnerCompletion(getBeginnerCompletionContext(commentSource, commentSource.length), false), false);
});
