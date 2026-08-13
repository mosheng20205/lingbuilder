import { afterEach, describe, expect, it, vi } from 'vitest';
import { R2MultipartUploader } from '../public/uploader.js';

const originalFetch = globalThis.fetch;
const originalWindow = globalThis.window;
const originalXmlHttpRequest = globalThis.XMLHttpRequest;

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.window = originalWindow;
  globalThis.XMLHttpRequest = originalXmlHttpRequest;
  vi.restoreAllMocks();
});

describe('本机 R2 上传进度', () => {
  it('只统计已经获得 R2 ETag 确认的分片', async () => {
    globalThis.window = Object.assign(globalThis, {
      location: { origin: 'http://127.0.0.1:8791' },
    });
    const completionBodies = [];
    globalThis.fetch = vi.fn(async (url, options) => {
      if (url === '/api/uploads/init') {
        return Response.json({
          ok: true,
          key: 'uploads/test.bin',
          uploadId: 'upload-id',
          partSize: 32,
          partCount: 2,
          progressMode: 'committed',
        });
      }
      if (url === '/api/uploads/complete') {
        completionBodies.push(JSON.parse(options.body));
        return Response.json({ ok: true, key: 'uploads/test.bin', size: 64, etag: 'complete-etag' });
      }
      if (url === '/api/uploads/abort') return Response.json({ ok: true });
      throw new Error(`未预期的请求：${url}`);
    });

    class FakeXmlHttpRequest {
      constructor() {
        this.listeners = new Map();
        this.uploadListeners = new Map();
        this.upload = {
          addEventListener: (type, listener) => this.uploadListeners.set(type, listener),
        };
      }

      open(_method, url) {
        this.url = url;
      }

      setRequestHeader() {}

      addEventListener(type, listener) {
        this.listeners.set(type, listener);
      }

      send(blob) {
        queueMicrotask(() => {
          this.uploadListeners.get('progress')?.({ lengthComputable: true, loaded: 7 });
          const partNumber = Number(new URL(this.url).searchParams.get('partNumber'));
          this.status = 200;
          this.responseText = JSON.stringify({ ok: true, partNumber, etag: `etag-${partNumber}` });
          this.listeners.get('load')?.();
        });
      }

      abort() {
        this.listeners.get('abort')?.();
      }
    }
    globalThis.XMLHttpRequest = FakeXmlHttpRequest;

    const progress = [];
    const uploader = new R2MultipartUploader({
      concurrency: 2,
      onProgress: loaded => progress.push(loaded),
    });
    const file = {
      name: 'test.bin',
      size: 64,
      type: 'application/octet-stream',
      slice: (start, end) => ({ size: end - start }),
    };

    await expect(uploader.upload(file)).resolves.toMatchObject({
      key: 'uploads/test.bin',
      size: 64,
    });
    expect(progress.filter(loaded => loaded > 0)).toEqual([32, 64, 64]);
    expect(progress).not.toContain(7);
    expect(progress).not.toContain(14);
    expect(completionBodies).toEqual([{
      key: 'uploads/test.bin',
      uploadId: 'upload-id',
      parts: [
        { ok: true, partNumber: 1, etag: 'etag-1' },
        { ok: true, partNumber: 2, etag: 'etag-2' },
      ],
    }]);
  });
});
