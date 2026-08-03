import assert from 'node:assert/strict';

const baseUrl = (process.env.R2_UPLOADER_URL || 'http://127.0.0.1:8793').replace(/\/$/, '');
const fileName = process.env.R2_SMOKE_FILE_NAME || 'lingbuilder-r2-native-smoke.bin';
const size = 6 * 1024 * 1024;
const content = Buffer.alloc(size, 0x4c);

async function readJson(response) {
  const result = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
  return result;
}

let session;
try {
  session = await readJson(await fetch(`${baseUrl}/api/uploads/init`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      fileName,
      fileSize: content.length,
      contentType: 'application/octet-stream',
    }),
  }));
  assert.equal(session.key, `uploads/${fileName}`);
  assert.equal(session.partCount, 1);

  const partUrl = new URL(`${baseUrl}/api/uploads/part`);
  partUrl.searchParams.set('key', session.key);
  partUrl.searchParams.set('uploadId', session.uploadId);
  partUrl.searchParams.set('partNumber', '1');
  const part = await readJson(await fetch(partUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: content,
  }));

  const completed = await readJson(await fetch(`${baseUrl}/api/uploads/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      key: session.key,
      uploadId: session.uploadId,
      parts: [{ partNumber: part.partNumber, etag: part.etag }],
    }),
  }));
  assert.equal(completed.key, session.key);
  assert.equal(completed.size, size);
  assert.equal(completed.publicDownloadUrl, `https://msimgimg.xyz/uploads/${fileName}`);

  const head = await fetch(completed.downloadUrl, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(Number(head.headers.get('content-length')), size);

  const range = await fetch(completed.downloadUrl, { headers: { range: 'bytes=1024-2047' } });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 1024);
  assert.equal(range.headers.get('content-range'), `bytes 1024-2047/${size}`);

  process.stdout.write(`${JSON.stringify({
    ok: true,
    key: completed.key,
    size: completed.size,
    etag: completed.etag,
    downloadUrl: completed.downloadUrl,
    publicDownloadUrl: completed.publicDownloadUrl,
    headStatus: head.status,
    rangeStatus: range.status,
  }, null, 2)}\n`);
} catch (error) {
  if (session?.key && session?.uploadId) {
    await fetch(`${baseUrl}/api/uploads/abort`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ key: session.key, uploadId: session.uploadId }),
    }).catch(() => undefined);
  }
  throw error;
}
