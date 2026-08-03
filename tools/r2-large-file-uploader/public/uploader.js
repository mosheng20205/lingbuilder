const DEFAULT_CONCURRENCY = 3;
const MAX_RETRIES = 3;

class UploadCancelledError extends Error {
  constructor() {
    super('上传已取消。');
    this.name = 'UploadCancelledError';
  }
}

async function readJsonResponse(response) {
  const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(new UploadCancelledError());
    }, { once: true });
  });
}

export class R2MultipartUploader {
  constructor({ concurrency = DEFAULT_CONCURRENCY, onProgress, onPhase } = {}) {
    this.concurrency = Math.max(1, Math.min(6, concurrency));
    this.onProgress = onProgress || (() => {});
    this.onPhase = onPhase || (() => {});
    this.activeRequests = new Set();
    this.abortController = null;
    this.session = null;
    this.abortRequest = null;
  }

  async upload(file) {
    if (this.abortController) throw new Error('已有文件正在上传。');
    this.abortController = new AbortController();
    const { signal } = this.abortController;
    const loadedByPart = new Map();
    let completed = false;

    try {
      this.onPhase('正在创建分片上传会话...');
      const initResponse = await fetch('/api/uploads/init', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          contentType: file.type || 'application/octet-stream',
        }),
        signal,
      });
      this.session = await readJsonResponse(initResponse);
      const reportTransferredBytes = this.session.progressMode !== 'committed';

      const parts = Array.from({ length: this.session.partCount }, (_, index) => {
        const partNumber = index + 1;
        const start = index * this.session.partSize;
        return {
          partNumber,
          blob: file.slice(start, Math.min(start + this.session.partSize, file.size)),
        };
      });

      let nextPartIndex = 0;
      const uploadedParts = [];
      this.onPhase(`正在上传 ${parts.length} 个分片...`);

      const reportProgress = (partNumber, loaded) => {
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
          const result = await this.uploadPartWithRetry(part, reportProgress, signal, reportTransferredBytes);
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
      const completeResponse = await fetch('/api/uploads/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          key: this.session.key,
          uploadId: this.session.uploadId,
          parts: uploadedParts.sort((left, right) => left.partNumber - right.partNumber),
        }),
        signal,
      });
      const result = await readJsonResponse(completeResponse);
      completed = true;
      this.session = null;
      this.onProgress(file.size, file.size);
      return result;
    } catch (error) {
      if (!completed) await this.abortSession();
      if (signal.aborted || error?.name === 'AbortError') throw new UploadCancelledError();
      throw error;
    } finally {
      this.activeRequests.clear();
      this.abortController = null;
      this.abortRequest = null;
    }
  }

  async uploadPartWithRetry(part, reportProgress, signal, reportTransferredBytes) {
    let lastError;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
      if (signal.aborted) throw new UploadCancelledError();
      reportProgress(part.partNumber, 0);
      try {
        return await this.uploadPart(
          part,
          loaded => reportProgress(part.partNumber, loaded),
          signal,
          reportTransferredBytes,
        );
      } catch (error) {
        if (signal.aborted || error instanceof UploadCancelledError) throw new UploadCancelledError();
        lastError = error;
        if (attempt < MAX_RETRIES) await delay(500 * (2 ** (attempt - 1)), signal);
      }
    }
    throw lastError || new Error(`第 ${part.partNumber} 个分片上传失败。`);
  }

  uploadPart(part, onProgress, signal, reportTransferredBytes) {
    return new Promise((resolve, reject) => {
      const url = new URL('/api/uploads/part', window.location.origin);
      url.searchParams.set('key', this.session.key);
      url.searchParams.set('uploadId', this.session.uploadId);
      url.searchParams.set('partNumber', String(part.partNumber));

      const xhr = new XMLHttpRequest();
      this.activeRequests.add(xhr);
      xhr.open('PUT', url);
      xhr.setRequestHeader('content-type', 'application/octet-stream');
      xhr.upload.addEventListener('progress', event => {
        if (reportTransferredBytes && event.lengthComputable) onProgress(event.loaded);
      });
      xhr.addEventListener('load', () => {
        this.activeRequests.delete(xhr);
        let result;
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
      xhr.addEventListener('abort', () => {
        this.activeRequests.delete(xhr);
        reject(new UploadCancelledError());
      });
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
      xhr.send(part.blob);
    });
  }

  async abortSession() {
    if (!this.session) return;
    if (this.abortRequest) return this.abortRequest;
    const session = this.session;
    this.session = null;
    this.abortRequest = fetch('/api/uploads/abort', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: session.key, uploadId: session.uploadId }),
    }).catch(() => undefined);
    await this.abortRequest;
  }

  async cancel() {
    if (!this.abortController) return;
    this.abortController.abort();
    for (const request of this.activeRequests) request.abort();
    await this.abortSession();
  }
}
