import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adaptBeginnerInitialValueForType,
  BEGINNER_TYPE_DEFAULT_INITIAL_VALUES
} from '../src/services/lingCpp/beginnerTypeCompletion';

test('beginner local initial value adapts to the new type default literal', () => {
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '整数型' }), '0');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '长整数型' }), '0');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '字节型' }), '0');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '小数型' }), '0');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '双精度小数型' }), '0');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '逻辑型' }), '假');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '整数型', nextType: '文本型' }), '""');
});

test('beginner local initial value clears for types without a simple literal', () => {
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '日期时间型' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '字节集' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '日期时间选择器' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '对象' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '窗体' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '按钮' }), '');
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '我的自定义类型' }), '');
});

test('beginner local constants keep their initial value for types without a literal', () => {
  assert.equal(
    adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '日期时间型', isConstant: true }),
    undefined
  );
  // 常量改为有默认字面量的类型时同样自动适配
  assert.equal(
    adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '整数型', isConstant: true }),
    '0'
  );
});

test('beginner local initial value is untouched when the type does not change', () => {
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '整数型', nextType: '整数型' }), undefined);
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '', nextType: '' }), undefined);
  assert.equal(adaptBeginnerInitialValueForType({ previousType: '文本型', nextType: '  ' }), undefined);
});

test('every default initial value literal maps to a known beginner type', () => {
  for (const type of Object.keys(BEGINNER_TYPE_DEFAULT_INITIAL_VALUES)) {
    assert.ok(BEGINNER_TYPE_DEFAULT_INITIAL_VALUES[type].length > 0, `${type} 的默认初始值不能为空`);
  }
});
