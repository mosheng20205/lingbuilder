import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import WorkspaceSearchDialog, {
  createWorkspaceSearchQueryRequest,
  getWorkspaceSearchInteractionState,
  isWorkspaceSearchRequestCurrent,
  popWorkspaceReplaceTransaction,
  pushWorkspaceReplaceTransaction,
  shouldInvalidateWorkspaceSearchContext,
  type WorkspaceSearchDialogProps
} from '../src/components/WorkspaceSearchDialog';
import type {
  WorkspaceReplaceApplyResponse,
  WorkspaceReplacePreviewResponse,
  WorkspaceReplaceRollbackResponse,
  WorkspaceSearchQueryResponse
} from '../src/services/workspace/workspaceSearchTypes';

const searchResult: WorkspaceSearchQueryResponse = {
  queryId: 'query-1',
  matches: [
    {
      id: 'match-1',
      filePath: 'src/MainWindow.lcpp',
      line: 12,
      column: 5,
      endLine: 12,
      endColumn: 8,
      matchText: '旧值',
      preview: '    标题 = “旧值”'
    },
    {
      id: 'match-2',
      filePath: 'src/MainWindow.lcpp',
      line: 25,
      column: 9,
      endLine: 25,
      endColumn: 12,
      matchText: '旧值',
      preview: '        信息框（“旧值”）'
    },
    {
      id: 'match-3',
      filePath: 'src/helpers.cpp',
      line: 8,
      column: 13,
      endLine: 8,
      endColumn: 16,
      matchText: '旧值',
      preview: 'return L"旧值";'
    }
  ],
  truncated: true,
  scannedFiles: 7,
  skippedFiles: 1,
  diagnostics: [{
    code: 'BINARY_SKIPPED',
    level: 'warning',
    message: '已跳过二进制文件。',
    filePath: 'assets/logo.ico'
  }]
};

const emptyResult: WorkspaceSearchQueryResponse = {
  queryId: 'query-empty',
  matches: [],
  truncated: false,
  scannedFiles: 4,
  skippedFiles: 0,
  diagnostics: []
};

const replacePreview: WorkspaceReplacePreviewResponse = {
  previewId: 'preview-1',
  queryId: searchResult.queryId,
  files: [
    {
      filePath: 'src/MainWindow.lcpp',
      before: '标题 = “旧值”',
      after: '标题 = “新值”',
      replacements: 2
    },
    {
      filePath: 'src/helpers.cpp',
      before: 'return L"旧值";',
      after: 'return L"新值";',
      replacements: 1
    }
  ],
  replacementCount: 3,
  diagnostics: []
};

const applyResult: WorkspaceReplaceApplyResponse = {
  transactionId: 'transaction-1',
  updatedFiles: ['src/MainWindow.lcpp', 'src/helpers.cpp'],
  replacementCount: 3
};

const rollbackResult: WorkspaceReplaceRollbackResponse = {
  transactionId: applyResult.transactionId,
  restoredFiles: applyResult.updatedFiles
};

const defaultProps: WorkspaceSearchDialogProps = {
  open: true,
  initialMode: 'search',
  isDarkMode: true,
  activeFilePath: 'src/MainWindow.lcpp',
  activeProjectId: 'demo-project',
  hasUnsavedFiles: false,
  onClose: () => undefined,
  onQuery: async () => searchResult,
  onPreview: async () => replacePreview,
  onApply: async () => applyResult,
  onRollback: async () => rollbackResult,
  onReveal: () => undefined,
  onSaveBeforeReplace: async () => true
};

function renderDialog(overrides: Partial<WorkspaceSearchDialogProps> = {}): string {
  return renderToStaticMarkup(<WorkspaceSearchDialog {...defaultProps} {...overrides} />);
}

test('closed workspace search dialog leaves no hidden interactive controls', () => {
  assert.equal(renderDialog({ open: false }), '');
});

test('workspace search interaction policy freezes every request and never bypasses dirty replacement', () => {
  for (const operation of ['query', 'save', 'preview', 'apply', 'rollback'] as const) {
    assert.deepEqual(getWorkspaceSearchInteractionState(operation, false), {
      isBusy: true,
      replacementBlocked: false
    });
  }
  assert.deepEqual(getWorkspaceSearchInteractionState(null, true), {
    isBusy: false,
    replacementBlocked: true
  });
  assert.deepEqual(getWorkspaceSearchInteractionState('query', true), {
    isBusy: true,
    replacementBlocked: true
  });
});

test('file and project scoped results expire when their owning context changes', () => {
  const previous = { activeFilePath: 'src\\demo\\MainWindow.lcpp', activeProjectId: 'demo' };

  assert.equal(shouldInvalidateWorkspaceSearchContext('file', previous, {
    activeFilePath: 'src/demo/MainWindow.lcpp',
    activeProjectId: 'demo'
  }), false);
  assert.equal(shouldInvalidateWorkspaceSearchContext('file', previous, {
    activeFilePath: 'src/demo/Other.lcpp',
    activeProjectId: 'demo'
  }), true);
  assert.equal(shouldInvalidateWorkspaceSearchContext('project', previous, {
    activeFilePath: 'src/demo/Other.lcpp',
    activeProjectId: 'demo'
  }), false);
  assert.equal(shouldInvalidateWorkspaceSearchContext('project', previous, {
    activeFilePath: 'src/next/MainWindow.lcpp',
    activeProjectId: 'next'
  }), true);
  assert.equal(shouldInvalidateWorkspaceSearchContext('workspace', previous, {
    activeFilePath: 'src/next/MainWindow.lcpp',
    activeProjectId: 'next'
  }), false);
  assert.equal(shouldInvalidateWorkspaceSearchContext('workspace', {
    ...previous,
    contextVersion: 4
  }, {
    ...previous,
    contextVersion: 5
  }), true);
});

test('a deferred query response is ignored after the search context generation changes', async () => {
  let resolveQuery!: () => void;
  const deferred = new Promise<void>(resolve => {
    resolveQuery = resolve;
  });
  let currentGeneration = 8;
  const requestGeneration = currentGeneration;
  const commit = deferred.then(() => isWorkspaceSearchRequestCurrent(
    requestGeneration,
    currentGeneration
  ));

  currentGeneration += 1;
  resolveQuery();
  assert.equal(await commit, false);
});

test('workspace replacement transaction history is lossless and rolls back in LIFO order', () => {
  let transactionIds: string[] = [];
  for (let index = 1; index <= 6; index += 1) {
    transactionIds = pushWorkspaceReplaceTransaction(transactionIds, `transaction-${index}`);
  }

  assert.deepEqual(transactionIds, [
    'transaction-1',
    'transaction-2',
    'transaction-3',
    'transaction-4',
    'transaction-5',
    'transaction-6'
  ]);
  assert.deepEqual(
    popWorkspaceReplaceTransaction(transactionIds, 'transaction-5'),
    transactionIds,
    'only the latest transaction may be popped'
  );
  transactionIds = popWorkspaceReplaceTransaction(transactionIds, 'transaction-6');
  transactionIds = popWorkspaceReplaceTransaction(transactionIds, 'transaction-5');
  assert.deepEqual(transactionIds, ['transaction-1', 'transaction-2', 'transaction-3', 'transaction-4']);
});

test('query request preserves leading, trailing, and whitespace-only search text', () => {
  const spaced = createWorkspaceSearchQueryRequest('  旧值  ', 'file', 'text', false, 'src/MainWindow.lcpp', 'demo-project');
  assert.equal(spaced.query, '  旧值  ');
  assert.equal(spaced.filePath, 'src/MainWindow.lcpp');
  assert.equal(spaced.projectId, undefined);

  const whitespaceOnly = createWorkspaceSearchQueryRequest('   ', 'workspace', 'regex', true);
  assert.equal(whitespaceOnly.query, '   ');
  assert.equal(whitespaceOnly.isRegex, true);
  assert.equal(whitespaceOnly.matchCase, true);
});

test('workspace search dialog exposes real accessible search controls and responsive containment', () => {
  const markup = renderDialog();

  assert.match(markup, /role="dialog"/u);
  assert.match(markup, /aria-modal="true"/u);
  assert.match(markup, /aria-describedby=/u);
  assert.match(markup, /工作区搜索与替换/u);
  assert.match(markup, /<form/u);
  assert.match(markup, /搜索内容/u);
  assert.match(markup, /<select/u);
  assert.match(markup, /<option value="file">当前文件<\/option>/u);
  assert.match(markup, /<option value="project" selected="">当前项目<\/option>/u);
  assert.match(markup, /<option value="workspace">整个工作区<\/option>/u);
  assert.match(markup, /type="radio"/u);
  assert.match(markup, /区分大小写/u);
  assert.match(markup, /关闭工作区搜索/u);
  assert.match(markup, /max-w-5xl/u);
  assert.match(markup, /overflow-x-hidden/u);
  assert.match(markup, /max-h-\[calc\(100dvh-1rem\)\]/u);
  assert.match(markup, /data-workspace-search-control-scope="query"/u);
  assert.match(markup, /data-workspace-search-control-scope="results"/u);
});

test('dirty files keep disk search available but block replacement until save', () => {
  const markup = renderDialog({ initialMode: 'replace', hasUnsavedFiles: true, initialResult: searchResult });

  assert.match(markup, /搜索仍可运行，但只搜索已保存到磁盘的内容/u);
  assert.match(markup, /替换预览与应用已禁用/u);
  assert.match(markup, /保存后继续/u);
  assert.match(markup, /<button type="submit"[^>]*>.*开始搜索/u);
  assert.match(markup, /<button type="button" disabled=""[^>]*title="请先保存未保存的文件"[^>]*>.*生成替换预览/u);
});

test('search results are grouped by file with selectable matches, reveal buttons, diagnostics, and truncation', () => {
  const markup = renderDialog({ initialResult: searchResult });

  assert.match(markup, /3 处匹配 · 2 个文件 · 已扫描 7 个文件 · 跳过 1 个文件/u);
  assert.match(markup, /结果已达到上限并被截断/u);
  assert.match(markup, /替换只会处理当前明确勾选的匹配项/u);
  assert.match(markup, /aria-label="搜索诊断"/u);
  assert.match(markup, /已跳过二进制文件/u);
  assert.equal((markup.match(/src\/MainWindow\.lcpp/gu) || []).length >= 1, true);
  assert.equal((markup.match(/src\/helpers\.cpp/gu) || []).length >= 1, true);
  assert.match(markup, /aria-label="选择全部搜索结果"/u);
  assert.match(markup, /aria-label="选择文件 src\/MainWindow\.lcpp 的全部匹配"/u);
  assert.match(markup, /aria-label="打开 src\/MainWindow\.lcpp 第 12 行第 5 列"/u);
  assert.match(markup, /第 12 行，第 5 列/u);
  assert.match(markup, /标题 = “旧值”/u);
});

test('empty query response renders a Chinese recovery-oriented empty state', () => {
  const markup = renderDialog({ initialResult: emptyResult });

  assert.match(markup, /0 处匹配/u);
  assert.match(markup, /没有找到匹配内容/u);
  assert.match(markup, /请调整搜索文本、范围或大小写选项/u);
});

test('replacement preview requires an explicit confirmation before apply', () => {
  const markup = renderDialog({
    initialMode: 'replace',
    initialResult: searchResult,
    initialPreview: replacePreview
  });

  assert.match(markup, /替换预览/u);
  assert.match(markup, /将在 2 个文件中替换 3 处/u);
  assert.match(markup, /替换前/u);
  assert.match(markup, /替换后/u);
  assert.match(markup, /标题 = “旧值”/u);
  assert.match(markup, /标题 = “新值”/u);
  assert.match(markup, /我已检查以上替换预览，并确认应用到所选文件/u);
  assert.match(markup, /<button type="button" disabled=""[^>]*>确认并应用替换<\/button>/u);
});

test('applied transaction exposes rollback and errors use an assertive alert', () => {
  const transactionMarkup = renderDialog({ initialTransactionId: applyResult.transactionId });
  assert.match(transactionMarkup, /撤销最近一次替换/u);
  assert.match(transactionMarkup, /等待搜索 · 1 个替换事务可撤销/u);

  const errorMarkup = renderDialog({
    isDarkMode: false,
    initialError: '模拟工作区搜索失败'
  });
  assert.match(errorMarkup, /role="alert"/u);
  assert.match(errorMarkup, /模拟工作区搜索失败/u);
  assert.match(errorMarkup, /bg-slate-50/u);
  assert.match(errorMarkup, /aria-live="polite"/u);
});
