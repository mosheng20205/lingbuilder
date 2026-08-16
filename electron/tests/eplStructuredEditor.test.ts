import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEplFoldableBlocks,
  buildEplStatementGuides,
  getEplMethodCall,
  parseEplStructuredDocument,
  replaceEplMethodArgument,
  serializeEplStructuredDocument
} from '../src/services/eplStructuredEditor';

test('structured EPL editor preserves local constant blocks through parse and serialization', () => {
  const source = [
    '.子程序 示例, 整数型',
    '    .局部常量 标题, 文本型, "完成"',
    '    调试输出 (标题)'
  ].join('\n');

  const documentModel = parseEplStructuredDocument(source);
  const block = documentModel.subprograms[0]?.body[0];
  assert.equal(block?.kind, 'variables');
  if (block?.kind !== 'variables') return;
  assert.equal(block.declarationKind, 'constant');
  assert.equal(block.variables[0]?.initialValue, '"完成"');
  assert.match(serializeEplStructuredDocument(documentModel), /\.局部常量 标题, 文本型, "完成"/u);
});

test('structured EPL editor keeps an editable statement after final local declarations', () => {
  const source = [
    '.子程序 _按钮2_被单击, 空',
    '    调试输出 ("按钮2被单击")',
    '    .局部变量 局部变量, 文本型'
  ].join('\n');

  const body = parseEplStructuredDocument(source).subprograms[0]?.body || [];
  assert.deepEqual(body.map(entry => entry.kind), ['statement', 'variables', 'statement']);
  const trailingStatement = body.at(-1);
  assert.equal(trailingStatement?.kind, 'statement');
  assert.equal(trailingStatement?.text, '');
  assert.equal(trailingStatement?.indent, '    ');
});

test('structured EPL editor reports separately foldable if and else ranges', () => {
  const source = [
    '.子程序 示例',
    '    如果 (真)',
    '        调试输出 ("是")',
    '    否则',
    '        调试输出 ("否")',
    '    如果结束'
  ].join('\n');
  const body = parseEplStructuredDocument(source).subprograms[0]?.body || [];
  const blocks = buildEplFoldableBlocks(body);
  assert.deepEqual(blocks.map(block => block.kind).sort(), ['condition', 'else']);
  assert.equal(blocks.find(block => block.kind === 'condition')?.startIndex, 0);
  assert.equal(blocks.find(block => block.kind === 'else')?.startIndex, 2);
});

test('structured EPL editor tracks nested flow depth for visual guides', () => {
  const statements = [
    { id: 'if', sourceLine: 1, indent: '    ', text: '如果真 (真)' },
    { id: 'loop', sourceLine: 2, indent: '    ', text: '计次循环首 (3)' },
    { id: 'loop-end', sourceLine: 3, indent: '    ', text: '计次循环尾 ()' },
    { id: 'if-end', sourceLine: 4, indent: '    ', text: '如果真结束' }
  ];

  assert.deepEqual(buildEplStatementGuides(statements).map(guides => guides.length), [1, 2, 2, 1]);
});

test('structured EPL editor resolves bound method parameters and writes back to the head call', () => {
  const call = getEplMethodCall('信息框 ("旧提示", 64, "标题")');
  assert.equal(call?.signature.parameters[0]?.name, '提示信息');
  assert.equal(call?.arguments[1], '64');
  assert.equal(
    replaceEplMethodArgument('信息框 ("旧提示", 64, "标题")', 0, '"新提示"'),
    '信息框 ("新提示", 64, "标题")'
  );
});
