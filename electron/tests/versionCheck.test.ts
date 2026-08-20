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
    assert.equal(result.downloadUrl, LINGBUILDER_OFFICIAL_SITE_URL);
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
