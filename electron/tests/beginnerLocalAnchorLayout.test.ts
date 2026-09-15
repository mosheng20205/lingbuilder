import test from 'node:test';
import assert from 'node:assert/strict';

import { getBeginnerLocalAnchorLayout } from '../src/services/lingCpp/beginnerLocalVariableLayout';
import { LingCppMethod } from '../src/services/lingCpp/types';

const statement = (line: number, indent: string, text: string) => ({ line, indent, text });

// Mirrors 本地API接口演示.lcpp 启动服务(): the 局部 declaration on line 181 sits
// inside a nested 如果 block, so its table must indent to the block body level
// and keep both enclosing rails visible.
const nestedDemoMethod: LingCppMethod = {
  name: '启动服务',
  returnType: '空',
  access: '公开',
  kind: 'method',
  line: 177,
  parameters: [],
  locals: [{ name: '创建错误', type: '文本型', line: 181, initialValue: '""' }],
  statements: [
    statement(178, '    ', '如果 (服务 == 0)'),
    statement(179, '      ', '服务 = HTTP_创建服务()'),
    statement(180, '      ', '如果 (服务 == 0)'),
    statement(182, '        ', '创建错误 = HTTP_取服务错误(0)'),
    statement(183, '        ', '追加日志("创建服务端失败：" + 创建错误)'),
    statement(184, '      ', '否则'),
    statement(185, '        ', '配置并启动()'),
    statement(186, '      ', '如果结束'),
    statement(187, '    ', '否则'),
    statement(188, '      ', '如果 (HTTP_是否运行(服务))'),
    statement(189, '        ', '追加日志("服务已在运行，无需重复启动。")'),
    statement(190, '      ', '否则'),
    statement(191, '        ', '配置并启动()'),
    statement(192, '      ', '如果结束'),
    statement(193, '    ', '如果结束')
  ]
};

const demoSourceLines = (() => {
  const lines: string[] = [];
  lines[176] = '  空 启动服务()';
  lines[177] = '    如果 (服务 == 0)';
  lines[178] = '      服务 = HTTP_创建服务()';
  lines[179] = '      如果 (服务 == 0)';
  lines[180] = '        局部 文本型 创建错误 = ""';
  lines[181] = '        创建错误 = HTTP_取服务错误(0)';
  return lines;
})();

test('nested local anchor aligns with its own block body indent', () => {
  const layout = getBeginnerLocalAnchorLayout(nestedDemoMethod, 181, demoSourceLines);
  // After the shared base indent is stripped, the declaration row formats to the
  // same 8 columns as the statement that consumes it (创建错误 = HTTP_取服务错误(0)).
  assert.equal(layout.indentColumns, 8);
});

test('nested local anchor reports both enclosing flow rails', () => {
  const layout = getBeginnerLocalAnchorLayout(nestedDemoMethod, 181, demoSourceLines);
  assert.deepEqual(layout.tracks.map(track => [track.depth, track.mark]), [
    [0, '│'],
    [1, '│']
  ]);
});

test('top-level local anchor has no rails and no indent', () => {
  const method: LingCppMethod = {
    name: '取名称',
    returnType: '文本型',
    access: '公开',
    kind: 'method',
    line: 10,
    parameters: [],
    locals: [{ name: '结果', type: '文本型', line: 11, initialValue: '""' }],
    statements: [
      statement(11, '    ', '局部 文本型 结果 = ""'),
      statement(12, '    ', '返回 结果')
    ]
  };
  const layout = getBeginnerLocalAnchorLayout(method, 11, ['    局部 文本型 结果 = ""', '    返回 结果']);
  assert.equal(layout.indentColumns, 0);
  assert.deepEqual(layout.tracks, []);
});

test('local declared inside the 否则 branch keeps only the outer rail', () => {
  const method: LingCppMethod = {
    name: '启动服务',
    returnType: '空',
    access: '公开',
    kind: 'method',
    line: 20,
    parameters: [],
    locals: [{ name: '重试次数', type: '整数型', line: 24, initialValue: '0' }],
    statements: [
      statement(21, '    ', '如果 (服务 == 0)'),
      statement(22, '      ', '停止()'),
      statement(23, '    ', '否则'),
      statement(25, '      ', '重试次数 = 1'),
      statement(26, '    ', '如果结束')
    ]
  };
  const layout = getBeginnerLocalAnchorLayout(method, 24, [
    '  空 启动服务()',
    '    如果 (服务 == 0)',
    '      停止()',
    '    否则',
    '      局部 整数型 重试次数 = 0',
    '      重试次数 = 1',
    '    如果结束'
  ]);
  assert.equal(layout.indentColumns, 4);
  assert.deepEqual(layout.tracks.map(track => [track.depth, track.mark]), [[0, '│']]);
});
