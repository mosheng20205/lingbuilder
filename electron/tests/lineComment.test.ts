import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mapColumnThroughLingCppLineCommentEdits,
  planLingCppLineCommentToggle
} from '../src/services/lingCpp/lineComment';

test('专业模式注释切换：单行加注释并定位到缩进之后', () => {
  const lines = ['    调试输出("你好")'];
  const plan = planLingCppLineCommentToggle(lines, 1, 1);

  assert.ok(plan);
  assert.equal(plan.commented, true);
  assert.deepEqual(plan.edits, [{ lineNumber: 1, column: 5, text: '// ', removedLength: 0 }]);
});

test('专业模式注释切换：候选行全部已注释时整体取消并跳过空行', () => {
  const lines = ['    // 信息框("你好")', '', '\t// 调试输出("完成")'];
  const plan = planLingCppLineCommentToggle(lines, 1, 3);

  assert.ok(plan);
  assert.equal(plan.commented, false);
  assert.deepEqual(plan.edits, [
    { lineNumber: 1, column: 5, text: '', removedLength: 3 },
    { lineNumber: 3, column: 2, text: '', removedLength: 3 }
  ]);
});

test('专业模式注释切换：部分已注释时仍整体加注释', () => {
  const lines = ['// 已注释', '调试输出("未注释")'];
  const plan = planLingCppLineCommentToggle(lines, 1, 2);

  assert.ok(plan);
  assert.equal(plan.commented, true);
  assert.equal(plan.edits.length, 2);
  assert.deepEqual(plan.edits[0], { lineNumber: 1, column: 1, text: '// ', removedLength: 0 });
});

test('专业模式注释切换：多行文本块的开始、内容与结束行不参与', () => {
  const lines = [
    '调试输出("前")',
    '提示 = """',
    '第一行',
    '"""',
    '调试输出("后")'
  ];
  const plan = planLingCppLineCommentToggle(lines, 1, 5);

  assert.ok(plan);
  assert.equal(plan.commented, true);
  assert.deepEqual(plan.edits.map(edit => edit.lineNumber), [1, 5]);
});

test('专业模式注释切换：空行与纯空白选区返回 null', () => {
  assert.equal(planLingCppLineCommentToggle(['', '   '], 1, 2), null);
  assert.equal(planLingCppLineCommentToggle(['调试输出("你好")'], 5, 9), null);
});

test('列映射：光标在注释列之后按插入长度平移、取消时回移', () => {
  const commentPlan = planLingCppLineCommentToggle(['    调试输出("你好")'], 1, 1);
  assert.ok(commentPlan);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(commentPlan, 1, 1), 1);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(commentPlan, 1, 5), 5);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(commentPlan, 1, 9), 12);

  const uncommentPlan = planLingCppLineCommentToggle(['    // 调试输出("你好")'], 1, 1);
  assert.ok(uncommentPlan);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(uncommentPlan, 1, 5), 5);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(uncommentPlan, 1, 8), 5);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(uncommentPlan, 1, 9), 6);
  assert.equal(mapColumnThroughLingCppLineCommentEdits(uncommentPlan, 1, 15), 12);
});
