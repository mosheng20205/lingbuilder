import assert from 'node:assert/strict';
import test from 'node:test';
import { checkLatestVersion, compareVersions, LINGBUILDER_OFFICIAL_SITE_URL } from '../electron/versionCheckService';

test('compareVersions handles semver ordering, v prefix and suffixes', () => {
  assert.ok(compareVersions('0.5.1', '0.5.0') > 0);
  assert.equal(compareVersions('0.5.0', '0.5.0'), 0);
  assert.ok(compareVersions('v0.4.9', '0.5.0') < 0);
  assert.ok(compareVersions('1.0.0', '0.9.9') > 0);
  assert.ok(compareVersions('0.10.0', '0.9.0') > 0);
  assert.equal(compareVersions('0.5.0-beta', '0.5.0'), 0);
  assert.equal(compareVersions('0.5', '0.5.0'), 0);
});

test('checkLatestVersion reports update when remote version is newer', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, available: true, version: '9.9.9', title: 'Future' }), { status: 200 })) as never;
  try {
    const result = await checkLatestVersion('https://api.example.com', '0.5.0');
    assert.equal(result.ok, true);
    assert.equal(result.hasUpdate, true);
    assert.equal(result.latestVersion, '9.9.9');
    assert.equal(result.releaseTitle, 'Future');
    assert.equal(result.websiteUrl, LINGBUILDER_OFFICIAL_SITE_URL);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkLatestVersion surfaces installer direct link and checksum when cloud provides them', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    ok: true, available: true, version: '1.2.0', title: '新版本', channel: 'stable',
    downloadUrl: 'https://dl.lingbuilder.com/LingBuilder-1.2.0-x64.exe',
    sha256: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789',
    fileSize: '85 MB', releaseNotes: '修复若干问题。'
  }), { status: 200 })) as never;
  try {
    const result = await checkLatestVersion('https://api.example.com', '1.0.0');
    assert.equal(result.hasUpdate, true);
    assert.equal(result.downloadUrl, 'https://dl.lingbuilder.com/LingBuilder-1.2.0-x64.exe');
    assert.equal(result.sha256, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
    assert.equal(result.fileSize, '85 MB');
    assert.equal(result.releaseNotes, '修复若干问题。');
    assert.equal(result.channel, 'stable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkLatestVersion keeps downloadUrl null for legacy cloud responses and malformed checksums', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, available: true, version: '9.9.9', title: 'Legacy', sha256: 'not-a-hash', downloadUrl: '' }), { status: 200 })) as never;
  try {
    const result = await checkLatestVersion('https://api.example.com', '0.5.0');
    assert.equal(result.hasUpdate, true);
    assert.equal(result.downloadUrl, null);
    assert.equal(result.sha256, null);
    assert.equal(result.fileSize, null);
    assert.equal(result.releaseNotes, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkLatestVersion reports latest and tolerates network failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({ ok: true, available: true, version: '0.5.0' }), { status: 200 })) as never;
  try {
    const same = await checkLatestVersion('https://api.example.com', '0.5.0');
    assert.equal(same.ok, true);
    assert.equal(same.hasUpdate, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
  globalThis.fetch = (async () => { throw new Error('network down'); }) as never;
  try {
    const failed = await checkLatestVersion('https://api.example.com', '0.5.0');
    assert.equal(failed.ok, false);
    assert.equal(failed.hasUpdate, false);
    assert.ok(failed.error);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkLatestVersion rejects missing cloud origin without network calls', async () => {
  const result = await checkLatestVersion('https://cloud-config-missing.invalid', '0.5.0');
  assert.equal(result.ok, false);
  assert.equal(result.error, '云端地址未配置。');
});

function captureUpdateRequest() {
  const originalFetch = globalThis.fetch;
  let capturedUrl = '';
  let capturedHeaders: Record<string, string> = {};
  globalThis.fetch = (async (input: unknown, init?: { headers?: Record<string, string> }) => {
    capturedUrl = String(input);
    capturedHeaders = init?.headers ?? {};
    return new Response(JSON.stringify({ ok: true, available: false }), { status: 200 }) as never;
  }) as never;
  return {
    args: () => ({ url: capturedUrl, headers: capturedHeaders }),
    restore: () => { globalThis.fetch = originalFetch; }
  };
}

test('checkLatestVersion always sends an explicit channel parameter', async () => {
  const stable = captureUpdateRequest();
  try {
    await checkLatestVersion('https://api.example.com', '0.5.0');
    assert.ok(stable.args().url.includes('channel=stable'));
    assert.deepEqual(stable.args().headers, {});
  } finally { stable.restore(); }

  const preview = captureUpdateRequest();
  try {
    await checkLatestVersion('https://api.example.com', '0.5.0', { channel: 'preview' });
    assert.ok(preview.args().url.includes('channel=preview'));
  } finally { preview.restore(); }
});

test('checkLatestVersion attaches the bearer token only when requesting the preview channel', async () => {
  const preview = captureUpdateRequest();
  try {
    await checkLatestVersion('https://api.example.com', '0.5.0', { channel: 'preview', accessToken: 'token-123' });
    assert.equal(preview.args().headers.authorization, 'Bearer token-123');
  } finally { preview.restore(); }

  const stable = captureUpdateRequest();
  try {
    await checkLatestVersion('https://api.example.com', '0.5.0', { channel: 'stable', accessToken: 'token-123' });
    assert.equal(stable.args().headers.authorization, undefined);
  } finally { stable.restore(); }
});
