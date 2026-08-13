import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { readFile, writeFile } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { parse as parseJsonc } from 'jsonc-parser';

const PART_SIZE_BYTES = 32 * 1024 * 1024;
const MAX_MULTIPART_PARTS = 10_000;
const MAX_JSON_BYTES = 1024 * 1024;
const R2_CONNECTION_TIMEOUT_MS = 20_000;
const R2_SOCKET_TIMEOUT_MS = 120_000;
const R2_CONTROL_REQUEST_TIMEOUT_MS = 60_000;
const R2_PART_REQUEST_TIMEOUT_MS = 10 * 60_000;
const R2_COMPLETE_REQUEST_TIMEOUT_MS = 2 * 60_000;

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const publicRoot = path.join(projectRoot, 'public');
const localConfigPath = process.env.R2_UPLOADER_CONFIG_PATH
  ? path.resolve(process.env.R2_UPLOADER_CONFIG_PATH)
  : path.join(projectRoot, 'r2-uploader.config.json');
const wranglerText = await readFile(path.join(projectRoot, 'wrangler.jsonc'), 'utf8');
const configErrors = [];
const wranglerConfig = parseJsonc(wranglerText, configErrors);
if (configErrors.length) throw new Error('wrangler.jsonc 格式无效。');

const configuredBucket = wranglerConfig?.r2_buckets?.find(binding => binding.binding === 'FILES')?.bucket_name;
const defaultBucketName = process.env.R2_UPLOADER_BUCKET || configuredBucket || '';
const defaultAccountId = process.env.R2_UPLOADER_ACCOUNT_ID || wranglerConfig?.vars?.R2_ACCOUNT_ID || '';
const defaultPublicUrl = process.env.R2_UPLOADER_PUBLIC_BASE_URL
  || wranglerConfig?.vars?.PUBLIC_DOWNLOAD_BASE_URL
  || '';
const requestedPort = Number(process.env.R2_UPLOADER_PORT || 8791);
if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65_535) {
  throw new Error('R2_UPLOADER_PORT 必须是 0 到 65535 之间的整数，0 表示自动选择空闲端口。');
}

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeConfig(input, fallback) {
  const accountId = String(input?.accountId || fallback?.accountId || defaultAccountId).trim();
  const accessKeyId = String(input?.accessKeyId || fallback?.accessKeyId || '').trim();
  const secretAccessKey = String(input?.secretAccessKey || fallback?.secretAccessKey || '').trim();
  const bucketName = String(input?.bucketName || fallback?.bucketName || defaultBucketName).trim();
  const publicBaseUrl = String(input?.publicBaseUrl || fallback?.publicBaseUrl || defaultPublicUrl).trim();

  if (!/^[a-f0-9]{32}$/i.test(accountId)) throw new HttpError('Cloudflare Account ID 必须是 32 位十六进制字符串。');
  if (!accessKeyId) throw new HttpError('请填写 R2 Access Key ID。');
  if (!secretAccessKey) throw new HttpError('请填写 R2 Secret Access Key。');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucketName)) throw new HttpError('R2 存储桶名称无效。');
  if (publicBaseUrl) {
    try {
      const url = new URL(publicBaseUrl);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error();
    } catch {
      throw new HttpError('公开下载基址必须是有效的 HTTP 或 HTTPS 地址。');
    }
  }
  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

async function readSavedConfig() {
  try {
    return normalizeConfig(JSON.parse(await readFile(localConfigPath, 'utf8')));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    if (error instanceof HttpError) return null;
    throw error;
  }
}

function createS3Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    forcePathStyle: true,
    requestHandler: {
      connectionTimeout: R2_CONNECTION_TIMEOUT_MS,
      socketTimeout: R2_SOCKET_TIMEOUT_MS,
      throwOnRequestTimeout: true,
    },
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

let activeConfig = await readSavedConfig();
let s3 = activeConfig ? createS3Client(activeConfig) : null;
const sessions = new Map();

async function sendR2Command(client, command, {
  operation,
  timeoutMs = R2_CONTROL_REQUEST_TIMEOUT_MS,
  request,
} = {}) {
  const controller = new AbortController();
  let timedOut = false;
  let requestAborted = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  timer.unref?.();

  const abortUpstream = () => {
    requestAborted = true;
    controller.abort();
  };
  request?.once('aborted', abortUpstream);

  try {
    return await client.send(command, {
      abortSignal: controller.signal,
      requestTimeout: timeoutMs,
    });
  } catch (error) {
    if (timedOut) {
      throw new HttpError(`${operation || 'R2 请求'}超时，请检查网络后重试。`, 504);
    }
    if (requestAborted) throw new HttpError(`${operation || 'R2 请求'}已取消。`, 499);
    throw error;
  } finally {
    clearTimeout(timer);
    request?.off('aborted', abortUpstream);
  }
}

function requireS3() {
  if (!s3 || !activeConfig) throw new HttpError('请先配置并验证 R2 S3 API 凭据。', 503);
  return { client: s3, config: activeConfig };
}

function sendJson(response, data, status = 200) {
  const body = Buffer.from(JSON.stringify(data));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

async function readJson(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_JSON_BYTES) throw new HttpError('请求 JSON 过大。', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError('请求 JSON 格式无效。');
  }
}

function cleanFileName(fileName) {
  const normalized = fileName
    .normalize('NFC')
    .replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_')
    .replace(/^\.+/, '')
    .trim();
  return (normalized || 'file.bin').slice(0, 180);
}

function assertManagedKey(key) {
  if (
    typeof key !== 'string'
    || !key.startsWith('uploads/')
    || key.includes('..')
    || key.includes('\\')
    || key.length > 320
  ) {
    throw new HttpError('上传对象标识无效。');
  }
}

function getSession(reference) {
  assertManagedKey(reference?.key);
  const session = sessions.get(reference?.uploadId);
  if (!session || session.key !== reference.key) throw new HttpError('Multipart Upload 会话不存在或已失效。', 404);
  return session;
}

function publicConfig() {
  return {
    configured: Boolean(activeConfig && s3),
    accountId: activeConfig?.accountId || defaultAccountId,
    accessKeyId: activeConfig?.accessKeyId || '',
    bucketName: activeConfig?.bucketName || defaultBucketName,
    publicBaseUrl: activeConfig?.publicBaseUrl || defaultPublicUrl,
    endpoint: activeConfig ? `https://${activeConfig.accountId}.r2.cloudflarestorage.com` : '',
  };
}

async function configureR2(request, response) {
  const input = await readJson(request);
  const nextConfig = normalizeConfig(input, activeConfig);
  const candidate = createS3Client(nextConfig);
  try {
    await sendR2Command(
      candidate,
      new ListObjectsV2Command({ Bucket: nextConfig.bucketName, MaxKeys: 1 }),
      { operation: 'R2 凭据验证' },
    );
  } catch (error) {
    candidate.destroy();
    const detail = error instanceof Error ? error.message : String(error);
    throw new HttpError(`R2 凭据验证失败：${detail}`, 400);
  }

  await writeFile(localConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
  s3?.destroy();
  s3 = candidate;
  activeConfig = nextConfig;
  sessions.clear();
  sendJson(response, { ok: true, ...publicConfig() });
}

async function initializeUpload(request, response) {
  const { client, config } = requireS3();
  const input = await readJson(request);
  if (typeof input?.fileName !== 'string' || !input.fileName.trim()) throw new HttpError('请提供文件名。');
  if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) throw new HttpError('文件大小无效。');
  const partCount = Math.ceil(input.fileSize / PART_SIZE_BYTES);
  if (partCount > MAX_MULTIPART_PARTS) throw new HttpError('文件超过当前 Multipart 配置支持的最大大小。', 413);

  const originalName = cleanFileName(input.fileName);
  const key = `uploads/${originalName}`;
  const contentType = typeof input.contentType === 'string' && input.contentType
    ? input.contentType.slice(0, 200)
    : 'application/octet-stream';
  const result = await sendR2Command(
    client,
    new CreateMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: key,
      ContentType: contentType,
    }),
    { operation: '创建分片上传会话' },
  );
  if (!result.UploadId) throw new HttpError('R2 没有返回 Multipart Upload ID。', 502);

  sessions.set(result.UploadId, {
    key,
    uploadId: result.UploadId,
    originalName,
    contentType,
    declaredSize: input.fileSize,
    partCount,
  });
  sendJson(response, {
    ok: true,
    key,
    uploadId: result.UploadId,
    partSize: PART_SIZE_BYTES,
    partCount,
    progressMode: 'committed',
  });
}

async function uploadPart(request, response, url) {
  const { client, config } = requireS3();
  const session = getSession({ key: url.searchParams.get('key'), uploadId: url.searchParams.get('uploadId') });
  const partNumber = Number(url.searchParams.get('partNumber'));
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.partCount) {
    throw new HttpError(`分片序号必须介于 1 和 ${session.partCount} 之间。`);
  }

  const expectedSize = partNumber === session.partCount
    ? session.declaredSize - (PART_SIZE_BYTES * (partNumber - 1))
    : PART_SIZE_BYTES;
  const declaredLength = Number(request.headers['content-length']);
  if (!Number.isSafeInteger(declaredLength) || declaredLength !== expectedSize) {
    throw new HttpError(`第 ${partNumber} 个分片大小无效。`);
  }

  const result = await sendR2Command(
    client,
    new UploadPartCommand({
      Bucket: config.bucketName,
      Key: session.key,
      UploadId: session.uploadId,
      PartNumber: partNumber,
      ContentLength: expectedSize,
      Body: request,
    }),
    {
      operation: `第 ${partNumber} 个分片上传`,
      timeoutMs: R2_PART_REQUEST_TIMEOUT_MS,
      request,
    },
  );
  if (!result.ETag) throw new HttpError(`第 ${partNumber} 个分片没有返回 ETag。`, 502);
  sendJson(response, { ok: true, partNumber, etag: result.ETag });
}

function validateCompletionParts(session, parts) {
  if (!Array.isArray(parts) || parts.length !== session.partCount) {
    throw new HttpError(`完成上传时必须提供 ${session.partCount} 个分片。`);
  }
  return [...parts].sort((left, right) => left.partNumber - right.partNumber).map((part, index) => {
    if (part?.partNumber !== index + 1 || typeof part.etag !== 'string' || !part.etag) {
      throw new HttpError(`第 ${index + 1} 个分片信息无效。`);
    }
    return { PartNumber: part.partNumber, ETag: part.etag };
  });
}

function buildDownloadUrls(request, key, publicBaseUrl) {
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const localUrl = new URL(`/files/${encodedKey}`, `http://${request.headers.host}`).toString();
  const publicDownloadUrl = publicBaseUrl
    ? new URL(`/${encodedKey}`, `${publicBaseUrl.replace(/\/$/, '')}/`).toString()
    : localUrl;
  return { downloadUrl: localUrl, publicDownloadUrl };
}

async function completeUpload(request, response) {
  const { client, config } = requireS3();
  const input = await readJson(request);
  const session = getSession(input);
  const parts = validateCompletionParts(session, input.parts);
  let result;
  let recoveredMetadata;
  try {
    result = await sendR2Command(
      client,
      new CompleteMultipartUploadCommand({
        Bucket: config.bucketName,
        Key: session.key,
        UploadId: session.uploadId,
        MultipartUpload: { Parts: parts },
      }),
      {
        operation: 'R2 分片合并',
        timeoutMs: R2_COMPLETE_REQUEST_TIMEOUT_MS,
        request,
      },
    );
  } catch (completeError) {
    // CompleteMultipartUpload may succeed in R2 even if its response is lost locally.
    try {
      const metadata = await sendR2Command(
        client,
        new HeadObjectCommand({ Bucket: config.bucketName, Key: session.key }),
        { operation: 'R2 完整对象确认' },
      );
      if (metadata.ContentLength === session.declaredSize) recoveredMetadata = metadata;
    } catch {
      // Preserve the original completion error when no complete object can be confirmed.
    }
    if (!recoveredMetadata) throw completeError;
  }

  sessions.delete(session.uploadId);
  sendJson(response, {
    ok: true,
    key: session.key,
    size: session.declaredSize,
    etag: result?.ETag || recoveredMetadata?.ETag || '',
    ...buildDownloadUrls(request, session.key, config.publicBaseUrl),
  });
}

async function abortUpload(request, response) {
  const { client, config } = requireS3();
  const input = await readJson(request);
  const session = getSession(input);
  await sendR2Command(
    client,
    new AbortMultipartUploadCommand({
      Bucket: config.bucketName,
      Key: session.key,
      UploadId: session.uploadId,
    }),
    { operation: '取消分片上传' },
  );
  sessions.delete(session.uploadId);
  sendJson(response, { ok: true });
}

function parseByteRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || (!match[1] && !match[2])) return false;
  if (!match[1]) {
    const length = Math.min(Number(match[2]), size);
    return Number.isSafeInteger(length) && length > 0 ? { offset: size - length, length } : false;
  }
  const offset = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(requestedEnd) || offset < 0 || offset >= size || requestedEnd < offset) {
    return false;
  }
  const end = Math.min(requestedEnd, size - 1);
  return { offset, length: end - offset + 1 };
}

function contentDisposition(fileName) {
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function downloadName(key) {
  const name = key.split('/').at(-1);
  return name || 'download.bin';
}

async function serveDownload(request, response, url) {
  const { client, config } = requireS3();
  const encodedKey = url.pathname.slice('/files/'.length);
  let key;
  try {
    key = encodedKey.split('/').map(segment => decodeURIComponent(segment)).join('/');
  } catch {
    throw new HttpError('下载文件地址无效。');
  }
  assertManagedKey(key);

  let metadata;
  try {
    metadata = await client.send(new HeadObjectCommand({ Bucket: config.bucketName, Key: key }));
  } catch (error) {
    if (error?.$metadata?.httpStatusCode === 404) throw new HttpError('文件不存在或已被删除。', 404);
    throw error;
  }
  const size = metadata.ContentLength;
  if (!Number.isSafeInteger(size) || size < 0) throw new HttpError('R2 对象大小无效。', 502);
  const requestedRange = parseByteRange(request.headers.range, size);
  if (requestedRange === false) {
    response.writeHead(416, { 'content-range': `bytes */${size}` });
    response.end();
    return;
  }

  const range = requestedRange || { offset: 0, length: size };
  const headers = {
    'content-type': metadata.ContentType || 'application/octet-stream',
    'content-length': range.length,
    'content-disposition': contentDisposition(downloadName(key)),
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=0, must-revalidate',
    'x-content-type-options': 'nosniff',
  };
  if (metadata.ETag) headers.etag = metadata.ETag;
  if (requestedRange) headers['content-range'] = `bytes ${range.offset}-${range.offset + range.length - 1}/${size}`;
  response.writeHead(requestedRange ? 206 : 200, headers);
  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  const object = await client.send(new GetObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Range: requestedRange ? `bytes=${range.offset}-${range.offset + range.length - 1}` : undefined,
  }));
  if (!object.Body) throw new HttpError('R2 下载响应为空。', 502);
  await pipeline(object.Body, response);
}

const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/uploader.js', ['uploader.js', 'text/javascript; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
]);

async function serveAsset(response, pathname) {
  const asset = assets.get(pathname);
  if (!asset) throw new HttpError('页面不存在。', 404);
  const body = await readFile(path.join(publicRoot, asset[0]));
  response.writeHead(200, {
    'content-type': asset[1],
    'content-length': body.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(body);
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `127.0.0.1:${requestedPort}`}`);
    if (request.method === 'GET' && url.pathname === '/api/config') return sendJson(response, { ok: true, ...publicConfig() });
    if (request.method === 'POST' && url.pathname === '/api/config') return await configureR2(request, response);
    if (request.method === 'POST' && url.pathname === '/api/uploads/init') return await initializeUpload(request, response);
    if (request.method === 'PUT' && url.pathname === '/api/uploads/part') return await uploadPart(request, response, url);
    if (request.method === 'POST' && url.pathname === '/api/uploads/complete') return await completeUpload(request, response);
    if (request.method === 'POST' && url.pathname === '/api/uploads/abort') return await abortUpload(request, response);
    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname.startsWith('/files/')) {
      return await serveDownload(request, response, url);
    }
    if (request.method === 'GET' || request.method === 'HEAD') return await serveAsset(response, url.pathname);
    throw new HttpError('接口不存在。', 404);
  } catch (error) {
    if (response.headersSent) {
      response.destroy(error);
      return;
    }
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : '服务器处理失败。';
    sendJson(response, { ok: false, error: message }, status);
  }
});

export async function shutdown() {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
  s3?.destroy();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    shutdown().finally(() => process.exit(0));
  });
}

export const serverReady = new Promise((resolve, reject) => {
  const handleStartupError = error => reject(error);
  server.once('error', handleStartupError);
  server.listen(requestedPort, '127.0.0.1', () => {
    server.off('error', handleStartupError);
    const address = server.address();
    if (!address || typeof address === 'string') {
      reject(new Error('无法获取本机上传服务地址。'));
      return;
    }
    const url = `http://127.0.0.1:${address.port}`;
    process.stdout.write(`本地上传服务已监听：${url}\n`);
    process.stdout.write(activeConfig
      ? `目标 R2 存储桶：${activeConfig.bucketName}（真实 S3 Multipart）\n`
      : '尚未配置 R2 S3 API 凭据，请在页面中完成首次设置。\n');
    resolve({ url, port: address.port });
  });
});
