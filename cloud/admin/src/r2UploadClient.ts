/**
 * 管理后台直链上传客户端：浏览器按 32 MiB 分片、3 路并发直传 Cloudflare R2 上传 Worker。
 * 移植自 tools/r2-large-file-uploader/public/uploader.js；文件字节不经过官网管理后台服务器。
 * 使用 globalThis 而不是 window，保证 Node 测试进程可以直接导入本模块。
 */

const DEFAULT_CONCURRENCY = 3;
const MAX_RETRIES = 3;
const INIT_REQUEST_TIMEOUT_MS = 60_000;
const PART_REQUEST_TIMEOUT_MS = 11 * 60_000;
const COMPLETE_REQUEST_TIMEOUT_MS = 3 * 60_000;
const ABORT_REQUEST_TIMEOUT_MS = 60_000;

export class UploadCancelledError extends Error {
  constructor() {
    super('上传已取消。');
    this.name = 'UploadCancelledError';
  }
}

export interface R2UploadResult {
  ok: boolean;
  key: string;
  size: number;
  etag: string;
  downloadUrl: string;
  publicDownloadUrl: string;
}

async function readJsonResponse(response: Response): Promise<any> {
  const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
  timeoutMessage: string,
  parentSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (parentSignal?.aborted) throw new UploadCancelledError();
  parentSignal?.addEventListener('abort', abort, { once: true });
  const timer = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new Error(timeoutMessage);
    if (parentSignal?.aborted || (error as Error)?.name === 'AbortError') throw new UploadCancelledError();
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abort);
  }
}

function delay(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      globalThis.clearTimeout(timer);
      reject(new UploadCancelledError());
    }, { once: true });
  });
}

export interface R2MultipartUploaderOptions {
  /** R2 上传 Worker 的基地址，例如 https://xxx.workers.dev；来自 /v1/admin/site/r2-upload/config。 */
  baseUrl: string;
  /** 与 Worker R2_UPLOAD_TOKEN secret 一致的 Bearer 令牌。 */
  token: string;
  concurrency?: number;
  onProgress?: (loaded: number, total: number) => void;
  onPhase?: (text: string) => void;
}

interface UploadSession {
  key: string;
  uploadId: string;
  partSize: number;
  partCount: number;
}

export class R2MultipartUploader {
  private readonly concurrency: number;
  private readonly onProgress: (loaded: number, total: number) => void;
  private readonly onPhase: (text: string) => void;
  private readonly activeRequests = new Set<XMLHttpRequest>();
  private abortController: AbortController | null = null;
  private session: UploadSession | null = null;
  private abortRequest: Promise<void> | null = null;

  constructor(private readonly options: R2MultipartUploaderOptions) {
    this.concurrency = Math.max(1, Math.min(6, options.concurrency ?? DEFAULT_CONCURRENCY));
    this.onProgress = options.onProgress || (() => {});
    this.onPhase = options.onPhase || (() => {});
  }

  private authorizationHeader(): Record<string, string> {
    return this.options.token ? { authorization: `Bearer ${this.options.token}` } : {};
  }

  private endpointUrl(path: string): string {
    return new URL(path, `${this.options.baseUrl.replace(/\/+$/, '')}/`).toString();
  }

  async upload(file: File): Promise<R2UploadResult> {
    if (this.abortController) throw new Error('已有文件正在上传。');
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const loadedByPart = new Map<number, number>();
    let completed = false;

    try {
      this.onPhase('正在创建分片上传会话...');
      const initResponse = await fetchWithTimeout(this.endpointUrl('/api/uploads/init'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authorizationHeader() },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
      }, INIT_REQUEST_TIMEOUT_MS, '创建上传会话超时，上传服务或 R2 当前无响应。', signal);
      const session = await readJsonResponse(initResponse) as UploadSession;
      this.session = session;

      const parts = Array.from({ length: session.partCount }, (_, index) => {
        const partNumber = index + 1;
        const start = index * session.partSize;
        return {
          partNumber,
          blob: file.slice(start, Math.min(start + session.partSize, file.size)),
        };
      });

      let nextPartIndex = 0;
      const uploadedParts: Array<{ partNumber: number; etag: string }> = [];
      this.onPhase(`正在上传 ${parts.length} 个分片...`);

      const reportProgress = (partNumber: number, loaded: number) => {
        loadedByPart.set(partNumber, loaded);
        const totalLoaded = [...loadedByPart.values()].reduce((sum, value) => sum + value, 0);
        this.onProgress(Math.min(totalLoaded, file.size), file.size);
      };

      const worker = async () => {
        while (!signal.aborted) {
          const index = nextPartIndex;
          nextPartIndex += 1;
          if (index >= parts.length) return;
          const part = parts[index];
          const result = await this.uploadPartWithRetry(part, reportProgress, signal);
          loadedByPart.set(part.partNumber, part.blob.size);
          uploadedParts.push(result);
          reportProgress(part.partNumber, part.blob.size);
        }
        throw new UploadCancelledError();
      };

      await Promise.all(Array.from(
        { length: Math.min(this.concurrency, parts.length) },
        () => worker(),
      ));

      if (signal.aborted) throw new UploadCancelledError();
      this.onPhase('分片已上传，正在合并文件...');
      const completeResponse = await fetchWithTimeout(this.endpointUrl('/api/uploads/complete'), {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...this.authorizationHeader() },
        body: JSON.stringify({
          key: session.key,
          uploadId: session.uploadId,
          parts: uploadedParts.sort((left, right) => left.partNumber - right.partNumber),
        }),
      }, COMPLETE_REQUEST_TIMEOUT_MS, 'R2 合并确认超时，请检查网络后重试。', signal);
      const result = await readJsonResponse(completeResponse);
      completed = true;
      this.session = null;
      this.onProgress(file.size, file.size);
      return result;
    } catch (error) {
      if (!completed) await this.abortSession();
      if (signal.aborted || (error as Error)?.name === 'AbortError') throw new UploadCancelledError();
      throw error;
    } finally {
      this.activeRequests.clear();
      this.abortController = null;
      this.abortRequest = null;
    }
  }

  private async uploadPartWithRetry(
    part: { partNumber: number; blob: Blob },
    reportProgress: (partNumber: number, loaded: number) => void,
    signal: AbortSignal,
  ): Promise<{ partNumber: number; etag: string }> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      if (signal.aborted) throw new UploadCancelledError();
      reportProgress(part.partNumber, 0);
      try {
        return await this.uploadPart(part, loaded => reportProgress(part.partNumber, loaded), signal);
      } catch (error) {
        if (signal.aborted || error instanceof UploadCancelledError) throw new UploadCancelledError();
        lastError = error;
        if (attempt < MAX_RETRIES) {
          this.onPhase(`第 ${part.partNumber} 个分片未获确认，正在重试（${attempt}/${MAX_RETRIES}）...`);
          await delay(500 * (2 ** (attempt - 1)), signal);
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`第 ${part.partNumber} 个分片上传失败。`);
  }

  private uploadPart(
    part: { partNumber: number; blob: Blob },
    onProgress: (loaded: number) => void,
    signal: AbortSignal,
  ): Promise<{ partNumber: number; etag: string }> {
    return new Promise((resolve, reject) => {
      const url = new URL(this.endpointUrl('/api/uploads/part'));
      url.searchParams.set('key', this.session!.key);
      url.searchParams.set('uploadId', this.session!.uploadId);
      url.searchParams.set('partNumber', String(part.partNumber));

      const xhr = new XMLHttpRequest();
      this.activeRequests.add(xhr);
      xhr.open('PUT', url);
      xhr.timeout = PART_REQUEST_TIMEOUT_MS;
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      for (const [header, value] of Object.entries(this.authorizationHeader())) {
        xhr.setRequestHeader(header, value);
      }
      xhr.upload.addEventListener('progress', event => {
        if (event.lengthComputable) onProgress(event.loaded);
      });
      xhr.addEventListener('load', () => {
        this.activeRequests.delete(xhr);
        let result: any;
        try {
          result = JSON.parse(xhr.responseText);
        } catch {
          reject(new Error(`第 ${part.partNumber} 个分片返回了无效数据。`));
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          reject(new Error(result.error || `第 ${part.partNumber} 个分片上传失败。`));
          return;
        }
        resolve(result);
      });
      xhr.addEventListener('error', () => {
        this.activeRequests.delete(xhr);
        reject(new Error(`第 ${part.partNumber} 个分片网络错误。`));
      });
      xhr.addEventListener('timeout', () => {
        this.activeRequests.delete(xhr);
        reject(new Error(`第 ${part.partNumber} 个分片等待确认超时。`));
      });
      xhr.addEventListener('abort', () => {
        this.activeRequests.delete(xhr);
        reject(new UploadCancelledError());
      });
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(part.blob);
    });
  }

  private async abortSession(): Promise<void> {
    if (!this.session) return;
    if (this.abortRequest) return this.abortRequest;
    const session = this.session;
    this.session = null;
    this.abortRequest = fetchWithTimeout(this.endpointUrl('/api/uploads/abort'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.authorizationHeader() },
      body: JSON.stringify({ key: session.key, uploadId: session.uploadId }),
    }, ABORT_REQUEST_TIMEOUT_MS, '取消上传超时。').then(() => undefined, () => undefined);
    await this.abortRequest;
  }

  async cancel(): Promise<void> {
    if (!this.abortController) return;
    this.abortController.abort();
    for (const request of this.activeRequests) request.abort();
    await this.abortSession();
  }
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(value: number, bits: number): number {
  return ((value >>> bits) | (value << (32 - bits))) >>> 0;
}

/** 增量 SHA-256：浏览器 crypto.subtle.digest 不支持流式，安装包需要按块喂入避免整文件驻留内存。 */
export class Sha256 {
  private readonly state = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private readonly buffer = new Uint8Array(64);
  private buffered = 0;
  private lengthBytes = 0;

  update(data: Uint8Array): this {
    this.lengthBytes += data.byteLength;
    let offset = 0;
    if (this.buffered > 0) {
      const take = Math.min(64 - this.buffered, data.byteLength);
      this.buffer.set(data.subarray(0, take), this.buffered);
      this.buffered += take;
      offset = take;
      if (this.buffered === 64) {
        this.compress(this.buffer);
        this.buffered = 0;
      }
    }
    while (offset + 64 <= data.byteLength) {
      this.compress(data.subarray(offset, offset + 64));
      offset += 64;
    }
    if (offset < data.byteLength) {
      this.buffer.set(data.subarray(offset));
      this.buffered = data.byteLength - offset;
    }
    return this;
  }

  /** 已喂入的总字节数，用于流式进度回调。 */
  bytesProcessed(): number {
    return this.lengthBytes;
  }

  digestHex(): string {
    const bits = this.lengthBytes * 8;
    const high = Math.floor(bits / 4294967296);
    const low = bits - high * 4294967296;
    const tail = new Uint8Array(8 + ((this.buffered < 56 ? 56 : 120) - this.buffered));
    tail[0] = 0x80;
    const view = new DataView(tail.buffer);
    view.setUint32(tail.length - 8, high);
    view.setUint32(tail.length - 4, low);

    let offset = 0;
    if (this.buffered > 0) {
      const take = Math.min(64 - this.buffered, tail.byteLength);
      this.buffer.set(tail.subarray(0, take), this.buffered);
      this.buffered += take;
      offset = take;
      if (this.buffered === 64) {
        this.compress(this.buffer);
        this.buffered = 0;
      }
    }
    while (offset < tail.byteLength) {
      this.compress(tail.subarray(offset, offset + 64));
      offset += 64;
    }

    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let index = 0; index < 8; index += 1) outView.setUint32(index * 4, this.state[index]);
    return Array.from(out, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  private compress(block: Uint8Array): void {
    const w = new Uint32Array(64);
    const view = new DataView(block.buffer, block.byteOffset, block.byteLength);
    for (let index = 0; index < 16; index += 1) w[index] = view.getUint32(index * 4);
    for (let index = 16; index < 64; index += 1) {
      const previous15 = w[index - 15];
      const previous2 = w[index - 2];
      const s0 = rotr(previous15, 7) ^ rotr(previous15, 18) ^ (previous15 >>> 3);
      const s1 = rotr(previous2, 17) ^ rotr(previous2, 19) ^ (previous2 >>> 10);
      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }
    let a = this.state[0];
    let b = this.state[1];
    let c = this.state[2];
    let d = this.state[3];
    let e = this.state[4];
    let f = this.state[5];
    let g = this.state[6];
    let h = this.state[7];
    for (let index = 0; index < 64; index += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[index] + w[index]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    const next = [a, b, c, d, e, f, g, h];
    for (let index = 0; index < 8; index += 1) this.state[index] = (this.state[index] + next[index]) >>> 0;
  }
}

/** 流式计算文件 SHA-256（十六进制小写）；旧浏览器降级为一次性读入。 */
export async function computeFileSha256Hex(file: Blob, onProgress?: (loaded: number, total: number) => void): Promise<string> {
  const hasher = new Sha256();
  if (typeof (file as File & { stream?: () => ReadableStream<Uint8Array> }).stream === 'function') {
    const reader = (file as File).stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      hasher.update(value);
      onProgress?.(hasher.bytesProcessed(), file.size);
    }
  } else {
    hasher.update(new Uint8Array(await file.arrayBuffer()));
    onProgress?.(file.size, file.size);
  }
  return hasher.digestHex();
}

/** 与官网“文件大小”展示口径一致：148.6MB 这种无空格、最多 1 位小数的格式。 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value.toFixed(index === 0 ? 0 : 1)}${units[index]}`;
}

/** 从安装包文件名解析版本号，例如 LingBuilder-0.6.0-x64.exe → 0.6.0。 */
export function versionFromFileName(name: string): string {
  const match = /(\d+\.\d+\.\d+(?:\.\d+)*)/u.exec(name);
  return match ? match[1] : '';
}
