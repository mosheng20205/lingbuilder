import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BEGINNER_FIND_MAX_QUERY_LENGTH,
  collectBeginnerFindFileResults,
  collectBeginnerFindMatches
} from '../src/services/lingCpp/beginnerFind';

const SOURCE = [
  '.版本 2',
  '',
  '子程序 按钮1_点击, 整数型, 公开',
  '信息框("保存完成", 64, "提示")',
  '调试输出("保存完成")',
  '返回(0)'
].join('\n');

test('collectBeginnerFindMatches: 源码段命中行列与长度', () => {
  const matches = collectBeginnerFindMatches({
    sourceText: SOURCE,
    codeBlocks: [],
    query: '保存完成',
    matchCase: false
  });
  assert.equal(matches.length, 2);
  assert.deepEqual(
    matches.map(match => [match.kind, match.line, match.column, match.length, match.sourceLine]),
    [
      ['source', 4, 6, 4, 4],
      ['source', 5, 7, 4, 5]
    ]
  );
  assert.equal(matches[0].targetKey, '');
  assert.equal(matches[0].lineText, '信息框("保存完成", 64, "提示")');
});

test('collectBeginnerFindMatches: 同一行多次命中按列展开并排序', () => {
  const matches = collectBeginnerFindMatches({
    sourceText: 'a b a\nb a',
    codeBlocks: [],
    query: 'a',
    matchCase: false
  });
  assert.deepEqual(
    matches.map(match => [match.line, match.column]),
    [[1, 1], [1, 5], [2, 3]]
  );
});

test('collectBeginnerFindMatches: 大小写开关', () => {
  const text = 'ABC abc Abc';
  const insensitive = collectBeginnerFindMatches({ sourceText: text, codeBlocks: [], query: 'abc', matchCase: false });
  const sensitive = collectBeginnerFindMatches({ sourceText: text, codeBlocks: [], query: 'abc', matchCase: true });
  assert.equal(insensitive.length, 3);
  assert.equal(sensitive.length, 1);
  assert.equal(sensitive[0].column, 5);
});

test('collectBeginnerFindMatches: 代码块覆盖的源码行去重，草稿文本参与匹配', () => {
  // 源码第 4-5 行已被方法体语句覆盖；草稿把第二处改成了新文本。
  const matches = collectBeginnerFindMatches({
    sourceText: SOURCE,
    codeBlocks: [{
      targetKey: '窗口:事件:按钮1_点击',
      bodyText: ['信息框("保存完成", 64, "提示")', '调试输出("已写入")'].join('\n'),
      sourceLineMap: [4, 5]
    }],
    query: '保存完成',
    matchCase: false
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].kind, 'code');
  assert.equal(matches[0].targetKey, '窗口:事件:按钮1_点击');
  assert.equal(matches[0].line, 1);
  assert.equal(matches[0].column, 6);
  assert.equal(matches[0].sourceLine, 4);
});

test('collectBeginnerFindMatches: 命中按源码行排序混合两类段', () => {
  const sourceText = ['头部 标记', '子程序 计算', '尾部 标记'].join('\n');
  const matches = collectBeginnerFindMatches({
    sourceText,
    codeBlocks: [{
      targetKey: '窗口:方法:计算',
      bodyText: '标记 在方法体里',
      sourceLineMap: [2]
    }],
    query: '标记',
    matchCase: false
  });
  assert.deepEqual(
    matches.map(match => [match.kind, match.sourceLine]),
    [['source', 1], ['code', 2], ['source', 3]]
  );
});

test('collectBeginnerFindMatches: 正则特殊字符按字面量匹配', () => {
  const matches = collectBeginnerFindMatches({
    sourceText: 'a(b) a(b',
    codeBlocks: [],
    query: 'a(b',
    matchCase: false
  });
  assert.equal(matches.length, 2);
});

test('collectBeginnerFindMatches: 中文与混合查询', () => {
  const matches = collectBeginnerFindMatches({
    sourceText: '如果 (计数 > 0)',
    codeBlocks: [],
    query: '计数 >',
    matchCase: false
  });
  assert.equal(matches.length, 1);
  assert.equal(matches[0].column, 5);
  assert.equal(matches[0].length, 4);
});

test('collectBeginnerFindMatches: 空查询与超长查询', () => {
  assert.deepEqual(
    collectBeginnerFindMatches({ sourceText: SOURCE, codeBlocks: [], query: '', matchCase: false }),
    []
  );
  // 纯空白查询按字面量匹配，源码里没有连续空白就没有命中。
  assert.deepEqual(
    collectBeginnerFindMatches({ sourceText: SOURCE, codeBlocks: [], query: '   ', matchCase: false }),
    []
  );
  const longQuery = 'x'.repeat(BEGINNER_FIND_MAX_QUERY_LENGTH + 10);
  const matches = collectBeginnerFindMatches({
    sourceText: 'x'.repeat(BEGINNER_FIND_MAX_QUERY_LENGTH),
    codeBlocks: [],
    query: longQuery,
    matchCase: false
  });
  assert.equal(matches.length, 1);
});

test('collectBeginnerFindFileResults: 跨文件命中分组统计与行列', () => {
  const outcome = collectBeginnerFindFileResults({
    files: [
      { filePath: 'src/a.lcpp', fileName: 'a.lcpp', sourceText: '内容 = 1\n标记 在这里\n标记 又一处' },
      { filePath: 'src/b.lcpp', fileName: 'b.lcpp', sourceText: '标记 在 b 里' },
      { filePath: 'config/c.ini', fileName: 'c.ini', sourceText: '没有命中' }
    ],
    query: '标记',
    matchCase: false
  });
  assert.equal(outcome.results.length, 3);
  assert.equal(outcome.fileCount, 2);
  assert.equal(outcome.truncated, false);
  assert.deepEqual(
    outcome.results.map(result => [result.filePath, result.line, result.column]),
    [['src/a.lcpp', 2, 1], ['src/a.lcpp', 3, 1], ['src/b.lcpp', 1, 1]]
  );
  assert.equal(outcome.results[0].lineText, '标记 在这里');
});

test('collectBeginnerFindFileResults: 空查询与截断', () => {
  assert.deepEqual(
    collectBeginnerFindFileResults({ files: [], query: '', matchCase: false }),
    { results: [], fileCount: 0, truncated: false }
  );
  const outcome = collectBeginnerFindFileResults({
    files: [{ filePath: 'a.txt', fileName: 'a.txt', sourceText: 'x x x x' }],
    query: 'x',
    matchCase: false,
    maxResults: 2
  });
  assert.equal(outcome.results.length, 2);
  assert.equal(outcome.truncated, true);
});
