import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWorkspaceReplace,
  previewWorkspaceReplace,
  queryWorkspace,
  rollbackWorkspaceReplace,
  WorkspaceSearchClientError,
  type WorkspaceSearchFetch
} from '../src/services/workspace/workspaceSearchClient';

test('workspace search client posts each request to its dedicated endpoint', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = [];
  const responses = [
    {
      ok: true,
      queryId: 'query-1',
      matches: [],
      truncated: false,
      scannedFiles: 3,
      skippedFiles: 0,
      diagnostics: []
    },
    {
      ok: true,
      previewId: 'preview-1',
      queryId: 'query-1',
      files: [],
      replacementCount: 0,
      diagnostics: []
    },
    {
      ok: true,
      transactionId: 'transaction-1',
      updatedFiles: [],
      replacementCount: 0
    },
    {
      ok: true,
      transactionId: 'transaction-1',
      restoredFiles: []
    }
  ];
  const fetchImpl: WorkspaceSearchFetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return jsonResponse(responses[calls.length - 1]);
  };
  const signal = new AbortController().signal;

  const queryRequest = {
    query: '主窗口',
    scope: 'workspace' as const,
    isRegex: false,
    matchCase: true,
    maxResults: 200
  };
  const previewRequest = {
    queryId: 'query-1',
    replacement: '窗口',
    matchIds: ['match-1']
  };
  const applyRequest = { previewId: 'preview-1' };
  const rollbackRequest = { transactionId: 'transaction-1' };

  assert.equal((await queryWorkspace(queryRequest, { fetchImpl, signal })).queryId, 'query-1');
  assert.equal((await previewWorkspaceReplace(previewRequest, { fetchImpl, signal })).previewId, 'preview-1');
  assert.equal((await applyWorkspaceReplace(applyRequest, { fetchImpl, signal })).transactionId, 'transaction-1');
  assert.deepEqual((await rollbackWorkspaceReplace(rollbackRequest, { fetchImpl, signal })).restoredFiles, []);

  assert.deepEqual(calls.map(call => call.input), [
    '/api/workspace-search/query',
    '/api/workspace-search/preview',
    '/api/workspace-search/apply',
    '/api/workspace-search/rollback'
  ]);
  assert.deepEqual(calls.map(call => JSON.parse(String(call.init?.body))), [
    queryRequest,
    previewRequest,
    applyRequest,
    rollbackRequest
  ]);
  for (const call of calls) {
    assert.equal(call.init?.method, 'POST');
    assert.equal(call.init?.signal, signal);
    assert.deepEqual(call.init?.headers, {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    });
  }
});

test('workspace search client exposes Chinese service errors and HTTP status', async () => {
  const cases = [
    { status: 400, message: '搜索条件无效。', code: 'INVALID_QUERY' },
    { status: 409, message: '预览后文件已发生变化。', code: 'STALE_FILE' },
    { status: 500, message: '工作区搜索服务内部错误。', code: 'INTERNAL_ERROR' }
  ];

  for (const item of cases) {
    const fetchImpl: WorkspaceSearchFetch = async () => jsonResponse({
      ok: false,
      error: item.message,
      code: item.code
    }, item.status);

    await assert.rejects(
      () => queryWorkspace({ query: 'x', scope: 'workspace' }, { fetchImpl }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceSearchClientError);
        assert.equal(error.message, item.message);
        assert.equal(error.status, item.status);
        assert.equal(error.code, item.code);
        return true;
      }
    );
  }
});

test('workspace search client treats ok false on a 2xx response as a service failure', async () => {
  const fetchImpl: WorkspaceSearchFetch = async () => jsonResponse({
    ok: false,
    message: '替换预览已失效。'
  });

  await assert.rejects(
    () => applyWorkspaceReplace({ previewId: 'expired' }, { fetchImpl }),
    (error: unknown) => {
      assert.ok(error instanceof WorkspaceSearchClientError);
      assert.equal(error.message, '替换预览已失效。');
      assert.equal(error.status, 200);
      return true;
    }
  );
});

test('workspace search client reports empty, malformed, and structurally invalid responses in Chinese', async () => {
  const responses = [
    new Response('', { status: 200 }),
    new Response('{broken', { status: 200 }),
    jsonResponse(['unexpected-array'])
  ];

  for (const response of responses) {
    const fetchImpl: WorkspaceSearchFetch = async () => response;
    await assert.rejects(
      () => previewWorkspaceReplace({ queryId: 'query-1', replacement: 'x' }, { fetchImpl }),
      (error: unknown) => {
        assert.ok(error instanceof WorkspaceSearchClientError);
        assert.equal(error.status, 200);
        assert.equal(error.code, 'INVALID_RESPONSE');
        assert.match(error.message, /工作区搜索服务/u);
        return true;
      }
    );
  }
});

test('workspace search client distinguishes aborts from network failures', async () => {
  const controller = new AbortController();
  controller.abort();
  let preAbortedFetchCalled = false;
  const preAbortedFetch: WorkspaceSearchFetch = async () => {
    preAbortedFetchCalled = true;
    throw new Error('must not run');
  };
  await assert.rejects(
    () => queryWorkspace(
      { query: 'x', scope: 'workspace' },
      { fetchImpl: preAbortedFetch, signal: controller.signal }
    ),
    (error: unknown) => assertClientError(error, 'ABORTED', /已取消/u)
  );
  assert.equal(preAbortedFetchCalled, false);

  const inFlightController = new AbortController();
  const abortingFetch: WorkspaceSearchFetch = async (_input, init) => {
    assert.equal(init?.signal, inFlightController.signal);
    inFlightController.abort();
    throw new DOMException('aborted', 'AbortError');
  };
  await assert.rejects(
    () => rollbackWorkspaceReplace(
      { transactionId: 'transaction-1' },
      { fetchImpl: abortingFetch, signal: inFlightController.signal }
    ),
    (error: unknown) => assertClientError(error, 'ABORTED', /已取消/u)
  );

  const networkFetch: WorkspaceSearchFetch = async () => {
    throw new TypeError('connection refused');
  };
  await assert.rejects(
    () => queryWorkspace({ query: 'x', scope: 'workspace' }, { fetchImpl: networkFetch }),
    (error: unknown) => assertClientError(error, 'NETWORK_ERROR', /无法连接/u)
  );
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function assertClientError(
  error: unknown,
  code: string,
  messagePattern: RegExp
): boolean {
  assert.ok(error instanceof WorkspaceSearchClientError);
  assert.equal(error.code, code);
  assert.match(error.message, messagePattern);
  return true;
}
