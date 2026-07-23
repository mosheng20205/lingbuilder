import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProblemsForClipboard } from '../src/services/problems/problemClipboard';

test('错误列表复制文本包含全部诊断及其完整上下文', () => {
  const text = formatProblemsForClipboard([
    {
      id: 'compiler',
      filePath: 'src/main.lcpp',
      line: 12,
      column: 8,
      code: 'C2137',
      level: 'error',
      message: '编译失败',
      codeSnippet: '信息框（“测试”）',
      suggestion: '检查中文引号',
      actionLabel: '跳到错误'
    },
    {
      id: 'designer',
      filePath: 'src/MainWindow.lcpp',
      line: 2,
      level: 'warning',
      message: '事件控件不存在',
      codeSnippet: '创建完毕',
      suggestion: '重新绑定事件'
    },
    {
      id: 'insertion',
      filePath: 'src/MainWindow.lcpp',
      line: 1,
      level: 'info',
      message: '这里有一条建议',
      codeSnippet: '类 MainWindow',
      suggestion: '可稍后处理',
      locationKind: 'insertion'
    }
  ]);

  assert.match(text, /\[1\/3\] 编译阻断 \(Error\).*第 12 行:8 · C2137/u);
  assert.match(text, /代码：信息框（“测试”）/u);
  assert.match(text, /修复建议：重新绑定事件/u);
  assert.match(text, /\[3\/3\] 辅助信息 \(Info\).*待生成事件（类末尾）/u);
  assert.equal((text.match(/^\[\d\/3\]/gmu) ?? []).length, 3);
});

test('空错误列表复制为明确的空状态', () => {
  assert.equal(formatProblemsForClipboard([]), '> [错误列表] 空');
});
