import type {
  WorkspaceReplaceApplyRequest,
  WorkspaceReplaceApplyResponse,
  WorkspaceReplacePreviewRequest,
  WorkspaceReplacePreviewResponse,
  WorkspaceReplaceRollbackRequest,
  WorkspaceReplaceRollbackResponse,
  WorkspaceSearchQueryRequest,
  WorkspaceSearchQueryResponse
} from './workspaceSearchTypes';

export type WorkspaceSearchFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export interface WorkspaceSearchClientOptions {
  /** Used by tests and alternative browser hosts; defaults to global fetch. */
  fetchImpl?: WorkspaceSearchFetch;
  signal?: AbortSignal;
}

export type WorkspaceSearchClientErrorCode =
  | 'ABORTED'
  | 'NETWORK_ERROR'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE'
  | string;

export class WorkspaceSearchClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: WorkspaceSearchClientErrorCode,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = 'WorkspaceSearchClientError';
  }
}

export async function queryWorkspace(
  request: WorkspaceSearchQueryRequest,
  options?: WorkspaceSearchClientOptions
): Promise<WorkspaceSearchQueryResponse> {
  return await postWorkspaceSearch('/api/workspace-search/query', request, options);
}

export async function previewWorkspaceReplace(
  request: WorkspaceReplacePreviewRequest,
  options?: WorkspaceSearchClientOptions
): Promise<WorkspaceReplacePreviewResponse> {
  return await postWorkspaceSearch('/api/workspace-search/preview', request, options);
}

export async function applyWorkspaceReplace(
  request: WorkspaceReplaceApplyRequest,
  options?: WorkspaceSearchClientOptions
): Promise<WorkspaceReplaceApplyResponse> {
  return await postWorkspaceSearch('/api/workspace-search/apply', request, options);
}

export async function rollbackWorkspaceReplace(
  request: WorkspaceReplaceRollbackRequest,
  options?: WorkspaceSearchClientOptions
): Promise<WorkspaceReplaceRollbackResponse> {
  return await postWorkspaceSearch('/api/workspace-search/rollback', request, options);
}

async function postWorkspaceSearch<TRequest, TResponse>(
  endpoint: string,
  request: TRequest,
  options: WorkspaceSearchClientOptions = {}
): Promise<TResponse> {
  if (options.signal?.aborted) {
    throw createAbortedError();
  }

  let body: string;
  try {
    body = JSON.stringify(request);
  } catch (error) {
    throw new WorkspaceSearchClientError(
      '工作区搜索请求无法序列化为 JSON。',
      undefined,
      'INVALID_REQUEST',
      { cause: error }
    );
  }

  const fetchImpl = resolveFetch(options.fetchImpl);
  let response: Response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body,
      signal: options.signal
    });
  } catch (error) {
    if (options.signal?.aborted || isAbortError(error)) {
      throw createAbortedError(error);
    }
    throw new WorkspaceSearchClientError(
      '无法连接 LingBuilder 工作区搜索服务，请确认本地服务正在运行。',
      undefined,
      'NETWORK_ERROR',
      { cause: error }
    );
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch (error) {
    throw new WorkspaceSearchClientError(
      '读取工作区搜索服务响应失败。',
      response.status,
      'INVALID_RESPONSE',
      { cause: error }
    );
  }

  const payload = parseResponsePayload(responseText, response.status);
  const serviceError = readServiceError(payload);
  if (!response.ok || payload.ok === false) {
    const message = serviceError.message
      || `工作区搜索服务请求失败（HTTP ${response.status}）。`;
    throw new WorkspaceSearchClientError(message, response.status, serviceError.code);
  }

  return payload as TResponse;
}

function resolveFetch(fetchImpl?: WorkspaceSearchFetch): WorkspaceSearchFetch {
  if (fetchImpl) return fetchImpl;
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis) as WorkspaceSearchFetch;
  }
  throw new WorkspaceSearchClientError(
    '当前运行环境不支持访问工作区搜索服务。',
    undefined,
    'NETWORK_ERROR'
  );
}

function parseResponsePayload(responseText: string, status: number): Record<string, unknown> {
  if (!responseText.trim()) {
    throw new WorkspaceSearchClientError(
      '工作区搜索服务返回了空响应。',
      status,
      'INVALID_RESPONSE'
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch (error) {
    throw new WorkspaceSearchClientError(
      '工作区搜索服务返回了无效的 JSON 响应。',
      status,
      'INVALID_RESPONSE',
      { cause: error }
    );
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new WorkspaceSearchClientError(
      '工作区搜索服务返回了不符合约定的响应。',
      status,
      'INVALID_RESPONSE'
    );
  }
  return payload as Record<string, unknown>;
}

function readServiceError(payload: Record<string, unknown>): { message?: string; code?: string } {
  const message = typeof payload.error === 'string' && payload.error.trim()
    ? payload.error.trim()
    : typeof payload.message === 'string' && payload.message.trim()
      ? payload.message.trim()
      : undefined;
  const code = typeof payload.code === 'string' && payload.code.trim()
    ? payload.code.trim()
    : undefined;
  return { message, code };
}

function isAbortError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'name' in error && error.name === 'AbortError');
}

function createAbortedError(cause?: unknown): WorkspaceSearchClientError {
  return new WorkspaceSearchClientError(
    '工作区搜索请求已取消。',
    undefined,
    'ABORTED',
    cause === undefined ? undefined : { cause }
  );
}
