import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatBeginnerConstantValue, getBeginnerConstantInfoAtCursor } from '../src/services/lingCpp/beginnerConstantInfo';

const constants = [
  { name: '软件名称', type: '文本型', value: '"模块常量与 #常量 引用"', origin: '项目常量' as const },
  { name: '最大重试次数', type: '整数型', value: '99', origin: '项目常量' as const },
  { name: '回车键', type: '整数型', value: '13', origin: '模块常量' as const, moduleName: '键鼠演示常量' },
  { name: '显示键码提示', type: '逻辑型', value: '真', origin: '模块常量' as const, moduleName: '键鼠演示常量' }
];

test('光标落在 #常量 标识符上任一位置都能命中常量值信息', () => {
  const source = '控件_设置文本(状态标签, 格式化文本("{}", #回车键))';
  const hashIndex = source.indexOf('#回车键');
  for (const offset of [hashIndex + 1, hashIndex + 2, hashIndex + 4]) {
    const info = getBeginnerConstantInfoAtCursor(source, offset, constants);
    assert.ok(info, `offset ${offset} 应命中`);
    assert.equal(info?.name, '回车键');
    assert.equal(info?.value, '13');
    assert.equal(info?.moduleName, '键鼠演示常量');
  }
});

test('项目常量遮蔽同名模块常量（遮蔽优先级 = 数组顺序）', () => {
  const source = '整数型 索引 = #最大重试次数';
  const info = getBeginnerConstantInfoAtCursor(source, source.indexOf('#最大重试次数') + 2, constants);
  assert.equal(info?.origin, '项目常量');
  assert.equal(info?.value, '99');
});

test('字符串、注释、调用位置与多行文本块内不命中', () => {
  const inString = '控件_添加项目(日志列表, "#回车键")';
  assert.equal(getBeginnerConstantInfoAtCursor(inString, inString.indexOf('#回车键') + 2, constants), null);
  const inComment = '// #回车键 说明';
  assert.equal(getBeginnerConstantInfoAtCursor(inComment, inComment.indexOf('#回车键') + 2, constants), null);
  const atCallArg = '调试输出(回车键)';
  assert.equal(getBeginnerConstantInfoAtCursor(atCallArg, atCallArg.indexOf('回车键') + 1, constants), null);
  const textBlock = ['提示 = """', '内容为 #回车键', '"""'].join('\n');
  assert.equal(getBeginnerConstantInfoAtCursor(textBlock, textBlock.indexOf('#回车键') + 2, constants), null);
});

test('裸标识符（同名局部变量）不显示常量值，# 前缀才命中', () => {
  const bare = '键码和 = 回车键 + 13';
  assert.equal(getBeginnerConstantInfoAtCursor(bare, bare.indexOf('回车键') + 1, constants), null);
  const hash = '键码和 = #回车键 + 13';
  const info = getBeginnerConstantInfoAtCursor(hash, hash.indexOf('#回车键') + 3, constants);
  assert.equal(info?.name, '回车键');
});

test('光标不在任何常量标识符上返回 null', () => {
  const source = '控件_设置文本(状态标签, "完成")';
  assert.equal(getBeginnerConstantInfoAtCursor(source, 2, constants), null);
  assert.equal(getBeginnerConstantInfoAtCursor(source, 5, []), null);
});

test('逻辑型常量值归一为 真/假，其余原样', () => {
  assert.equal(formatBeginnerConstantValue('逻辑型', true), '真');
  assert.equal(formatBeginnerConstantValue('逻辑型', false), '假');
  assert.equal(formatBeginnerConstantValue('逻辑型', '真'), '真');
  assert.equal(formatBeginnerConstantValue('整数型', 13), '13');
  assert.equal(formatBeginnerConstantValue('文本型', '"文本"'), '"文本"');
});
