import { describe, expect, it, vi } from 'vitest';
import worker from '../src/worker';

const fetchHandler = worker.fetch as unknown as (
  request: Request,
  env: Record<string, unknown>,
) => Promise<Response>;

function makeEnv(overrides: Record<string, unknown> = {}) {
  const createMultipartUpload = vi.fn(async () => ({
    key: 'uploads/测试安装包.exe',
    uploadId: 'r2-upload-id',
  }));
  return {
    FILES: { createMultipartUpload },
    ASSETS: { fetch: async () => new Response('asset') },
    R2_ACCOUNT_ID: 'test-account',
    PUBLIC_DOWNLOAD_BASE_URL: 'https://example.com',
    UPLOAD_ALLOWED_ORIGINS: 'https://lingbuilder.com,http://127.0.0.1:17901',
    R2_UPLOAD_TOKEN: 'secret-token',
    ...overrides,
    __createMultipartUpload: createMultipartUpload,
  };
}

function initRequest(headers: Record<string, string> = {}) {
  return new Request('https://worker.test/api/uploads/init', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ fileName: '测试安装包.exe', fileSize: 1024 }),
  });
}

describe('上传接口鉴权与跨域', () => {
  it('白名单来源的预检请求返回 204 和 CORS 响应头', async () => {
    const response = await fetchHandler(
      new Request('https://worker.test/api/uploads/part', {
        method: 'OPTIONS',
        headers: { origin: 'https://lingbuilder.com' },
      }),
      makeEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://lingbuilder.com');
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT');
    expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
  });

  it('白名单之外来源的预检请求不携带 CORS 响应头', async () => {
    const response = await fetchHandler(
      new Request('https://worker.test/api/uploads/part', {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
      makeEnv(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('缺少令牌时返回 401，且不触碰 R2 存储桶', async () => {
    const env = makeEnv();
    const response = await fetchHandler(
      initRequest({ origin: 'https://lingbuilder.com' }),
      env,
    );

    expect(response.status).toBe(401);
    expect(((await response.json()) as { ok: boolean }).ok).toBe(false);
    expect(env.__createMultipartUpload).not.toHaveBeenCalled();
    expect(response.headers.get('access-control-allow-origin')).toBe('https://lingbuilder.com');
  });

  it('令牌错误时返回 401', async () => {
    const env = makeEnv();
    const response = await fetchHandler(
      initRequest({ origin: 'https://lingbuilder.com', authorization: 'Bearer wrong-token' }),
      env,
    );

    expect(response.status).toBe(401);
    expect(env.__createMultipartUpload).not.toHaveBeenCalled();
  });

  it('令牌正确时创建上传会话并附带 CORS 响应头', async () => {
    const env = makeEnv();
    const response = await fetchHandler(
      initRequest({ origin: 'https://lingbuilder.com', authorization: 'Bearer secret-token' }),
      env,
    );

    expect(response.status).toBe(200);
    const result = (await response.json()) as { ok: boolean; uploadId: string };
    expect(result.ok).toBe(true);
    expect(result.uploadId).toBe('r2-upload-id');
    expect(env.__createMultipartUpload).toHaveBeenCalledTimes(1);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://lingbuilder.com');
  });

  it('未配置 R2_UPLOAD_TOKEN 时保持原有开放行为', async () => {
    const env = makeEnv({ R2_UPLOAD_TOKEN: '' });
    const response = await fetchHandler(
      initRequest({ origin: 'https://lingbuilder.com' }),
      env,
    );

    expect(response.status).toBe(200);
    expect(env.__createMultipartUpload).toHaveBeenCalledTimes(1);
  });

  it('本机开发来源也在白名单内', async () => {
    const response = await fetchHandler(
      initRequest({ origin: 'http://127.0.0.1:17901', authorization: 'Bearer secret-token' }),
      makeEnv(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:17901');
  });
});
