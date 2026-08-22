import {
  RequestError,
  abortUpload,
  completeUpload,
  createUploadSession,
  decodeObjectKey,
  encodeObjectKey,
  parseByteRange,
  readSegmentedManifest,
  selectManifestRangeParts,
  uploadPart,
  type SegmentedObjectManifest,
  type SegmentedObjectPart,
  type UploadCompleteInput,
  type UploadInitInput,
  type UploadSessionReference,
} from './uploadService';

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}

const UPLOAD_API_ALLOW_METHODS = 'POST, PUT, OPTIONS';
const UPLOAD_API_ALLOW_HEADERS = 'content-type, authorization';

/** 允许跨域直传的来源白名单，来自 wrangler.jsonc 的 UPLOAD_ALLOWED_ORIGINS（逗号分隔）。 */
function allowedUploadOrigins(env: Env): string[] {
  return (env.UPLOAD_ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/** 只为白名单内的 Origin 返回 CORS 响应头；同源请求和未知来源不携带。 */
function uploadCorsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('origin')?.trim() || '';
  if (!origin || !allowedUploadOrigins(env).includes(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': UPLOAD_API_ALLOW_METHODS,
    'access-control-allow-headers': UPLOAD_API_ALLOW_HEADERS,
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

function tokensMatch(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= provided.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/** R2_UPLOAD_TOKEN 未配置时保持原有开放行为；配置后所有 /api/uploads/* 请求都必须携带 Bearer 令牌。 */
function isUploadAuthorized(request: Request, env: Env): boolean {
  const expected = env.R2_UPLOAD_TOKEN?.trim() || '';
  if (!expected) return true;
  const header = request.headers.get('authorization')?.trim() || '';
  const scheme = header.slice(0, 7).toLowerCase();
  return scheme === 'bearer ' && tokensMatch(header.slice(7).trim(), expected);
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new RequestError('请求 JSON 格式无效。');
  }
}

function attachmentDisposition(originalName: string): string {
  const asciiName = originalName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
}

function directFileHeaders(object: R2Object, contentLength: number): Headers {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  const originalName = object.customMetadata?.originalName || object.key.split('/').at(-1) || 'download.bin';
  headers.set('content-length', String(contentLength));
  headers.set('etag', object.httpEtag);
  headers.set('content-disposition', attachmentDisposition(originalName));
  headers.set('accept-ranges', 'bytes');
  headers.set('x-content-type-options', 'nosniff');
  headers.set('cache-control', 'private, max-age=0, must-revalidate');
  return headers;
}

function segmentedFileHeaders(
  manifest: SegmentedObjectManifest,
  manifestObject: R2Object,
  contentLength: number,
): Headers {
  return new Headers({
    'content-type': manifest.contentType,
    'content-length': String(contentLength),
    'content-disposition': attachmentDisposition(manifest.originalName),
    'etag': manifestObject.httpEtag,
    'accept-ranges': 'bytes',
    'x-content-type-options': 'nosniff',
    'cache-control': 'private, max-age=0, must-revalidate',
  });
}

type StreamPart = Pick<SegmentedObjectPart, 'key'> & {
  offset?: number;
  length?: number;
};

function streamR2Parts(bucket: R2Bucket, parts: StreamPart[]): ReadableStream<Uint8Array> {
  let partIndex = 0;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        while (true) {
          if (!reader) {
            if (partIndex >= parts.length) {
              controller.close();
              return;
            }
            const part = parts[partIndex];
            const object = part.offset === undefined || part.length === undefined
              ? await bucket.get(part.key)
              : await bucket.get(part.key, { range: { offset: part.offset, length: part.length } });
            if (!object) throw new Error(`R2 分片不存在：${part.key}`);
            reader = object.body.getReader();
          }

          const result = await reader.read();
          if (!result.done) {
            controller.enqueue(result.value);
            return;
          }
          reader.releaseLock();
          reader = null;
          partIndex += 1;
        }
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel(reason) {
      await reader?.cancel(reason);
    },
  });
}

async function serveDirectFile(request: Request, env: Env, metadata: R2Object): Promise<Response> {
  if (request.method === 'HEAD') {
    return new Response(null, { headers: directFileHeaders(metadata, metadata.size) });
  }

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, metadata.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${metadata.size}` },
      });
    }
    const object = await env.FILES.get(metadata.key, { range });
    if (!object) throw new RequestError('文件不存在或已被删除。', 404);
    const headers = directFileHeaders(object, range.length);
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${metadata.size}`);
    return new Response(object.body, { status: 206, headers });
  }

  const object = await env.FILES.get(metadata.key);
  if (!object) throw new RequestError('文件不存在或已被删除。', 404);
  return new Response(object.body, { headers: directFileHeaders(object, object.size) });
}

async function serveSegmentedFile(
  request: Request,
  env: Env,
  manifest: SegmentedObjectManifest,
  manifestObject: R2Object,
): Promise<Response> {
  if (request.method === 'HEAD') {
    return new Response(null, { headers: segmentedFileHeaders(manifest, manifestObject, manifest.size) });
  }

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    const range = parseByteRange(rangeHeader, manifest.size);
    if (!range) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${manifest.size}` },
      });
    }
    const parts = selectManifestRangeParts(manifest.parts, range);
    const headers = segmentedFileHeaders(manifest, manifestObject, range.length);
    headers.set('content-range', `bytes ${range.offset}-${range.offset + range.length - 1}/${manifest.size}`);
    return new Response(streamR2Parts(env.FILES, parts), { status: 206, headers });
  }

  return new Response(streamR2Parts(env.FILES, manifest.parts), {
    headers: segmentedFileHeaders(manifest, manifestObject, manifest.size),
  });
}

async function serveFile(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = decodeObjectKey(url.pathname);
  const metadata = await env.FILES.head(key);
  if (metadata) return serveDirectFile(request, env, metadata);

  const segmented = await readSegmentedManifest(env.FILES, key);
  if (!segmented) throw new RequestError('文件不存在或已被删除。', 404);
  return serveSegmentedFile(request, env, segmented.manifest, segmented.object);
}

function buildDownloadUrls(request: Request, env: Env, key: string) {
  const encodedKey = encodeObjectKey(key);
  const downloadUrl = new URL(`/files/${encodedKey}`, request.url).toString();
  const publicBaseUrl = env.PUBLIC_DOWNLOAD_BASE_URL.trim();
  const publicDownloadUrl = publicBaseUrl
    ? new URL(`/${encodedKey}`, `${publicBaseUrl.replace(/\/$/, '')}/`).toString()
    : downloadUrl;
  return { downloadUrl, publicDownloadUrl };
}

async function routeApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'POST' && url.pathname === '/api/uploads/init') {
    const result = await createUploadSession(env.FILES, await readJson<UploadInitInput>(request));
    return json({ ok: true, ...result });
  }

  if (request.method === 'PUT' && url.pathname === '/api/uploads/part') {
    if (!request.body) throw new RequestError('分片内容为空。');
    const key = url.searchParams.get('key');
    const uploadId = url.searchParams.get('uploadId');
    const partNumber = Number(url.searchParams.get('partNumber'));
    const result = await uploadPart(env.FILES, { key, uploadId } as UploadSessionReference, partNumber, request.body);
    return json({ ok: true, ...result });
  }

  if (request.method === 'POST' && url.pathname === '/api/uploads/complete') {
    const result = await completeUpload(env.FILES, await readJson<UploadCompleteInput>(request));
    return json({ ok: true, ...result, ...buildDownloadUrls(request, env, result.key) });
  }

  if (request.method === 'POST' && url.pathname === '/api/uploads/abort') {
    await abortUpload(env.FILES, await readJson<UploadSessionReference>(request));
    return json({ ok: true });
  }

  return json({ ok: false, error: '接口不存在。' }, 404);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith('/api/')) {
        if (request.method === 'OPTIONS') {
          return new Response(null, { status: 204, headers: uploadCorsHeaders(request, env) });
        }
        const unauthorized = url.pathname.startsWith('/api/uploads/') && !isUploadAuthorized(request, env);
        const response = unauthorized
          ? json({ ok: false, error: '上传令牌无效或缺失：管理后台入口请刷新页面重试，独立上传页请在“上传令牌”栏填写。' }, 401)
          : await routeApi(request, env);
        const cors = uploadCorsHeaders(request, env);
        for (const [key, value] of Object.entries(cors)) response.headers.set(key, value);
        return response;
      }
      if (url.pathname.startsWith('/files/') && (request.method === 'GET' || request.method === 'HEAD')) {
        return await serveFile(request, env);
      }
      return await env.ASSETS.fetch(request);
    } catch (error) {
      const status = error instanceof RequestError ? error.status : 500;
      const message = error instanceof Error ? error.message : '服务器处理失败。';
      return json({ ok: false, error: message }, status);
    }
  },
} satisfies ExportedHandler<Env>;
