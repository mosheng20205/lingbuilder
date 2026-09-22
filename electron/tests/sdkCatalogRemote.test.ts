import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, generateKeyPairSync, sign as cryptoSign } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SDK_CATALOG_TRUST_ANCHORS } from '../src/services/sdkDependencies/catalogTrustAnchors';
import {
  compareCatalogAnchoredFields,
  fetchRemoteCatalog,
  readSdkCatalogState,
  resolveSdkCatalogEndpoint,
  verifyAndMergeCatalog,
  writeSdkCatalogState,
  SDK_CATALOG_SIGNATURE_PREFIX,
  type SdkCatalogManifestEnvelope,
  type SdkCatalogTrustAnchor
} from '../src/services/sdkDependencies/sdkCatalogRemote';
import { SDK_DEPENDENCY_RESOURCES, type SdkDependencyResource } from '../src/services/sdkDependencies/sdkDependencyCatalog';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const keyId = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
const anchors: SdkCatalogTrustAnchor[] = [{ keyId, publicKeyPem }];

const builtin = SDK_DEPENDENCY_RESOURCES;
const remoteResource = (overrides: Record<string, unknown> = {}) => ({
  id: 'cef3',
  moduleId: 'lingbuilder.cef3.sdk',
  name: 'CEF3 环境 SDK',
  platform: 'windows-x64',
  requiredModuleIds: ['lingbuilder.cef3.browser'],
  criticalFiles: builtin[0].criticalFiles.map(file => file.relativePath),
  version: '150.0.15',
  sdkVersion: '0.6.0',
  archiveName: 'lingbuilder-cef3-sdk-new.zip',
  downloadUrl: 'https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-new.zip',
  archiveBytes: 187_000_000,
  sha256: 'a'.repeat(64),
  fileCount: 540,
  expandedBytes: 471_000_000,
  ...overrides
});

function signPayload(payload: string, signingKey: string = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()): string {
  return cryptoSign(null, Buffer.from(`${SDK_CATALOG_SIGNATURE_PREFIX}${payload}`, 'utf8'), signingKey).toString('base64');
}

// 2026-09-21 写回：内置清单新增 sunnynet 后，所有远端清单夹具必须携带该资源，
// 否则 verifyAndMergeCatalog 会按「资源 ID 集合与内置清单不一致」整条拒绝。
const sunnynetResource = () => remoteResource({
  id: 'sunnynet', moduleId: 'lingbuilder.sunnynet.sdk', name: '网络中间件 SDK',
  requiredModuleIds: ['lingbuilder.sunnynet'],
  criticalFiles: builtin[2].criticalFiles.map(file => file.relativePath),
  archiveName: 'lingbuilder-sunnynet-sdk-new.zip',
  downloadUrl: 'https://lingbuilder.com/update-assets/sdk/lingbuilder-sunnynet-sdk-new.zip',
  archiveBytes: 31_070_540, sha256: 'c'.repeat(64), fileCount: 5, expandedBytes: 84_071_967,
  version: '1.5.2', sdkVersion: '1.5.1'
});

function buildManifest(sequence: number, resources: unknown[], payloadOverrides: Record<string, unknown> = {}): { manifest: SdkCatalogManifestEnvelope; payload: string } {
  const list = [...resources];
  if (!list.some(item => (item as { id?: string }).id === 'sunnynet')) list.push(sunnynetResource());
  const payload = JSON.stringify({ schemaVersion: 1, sequence, resources: list, ...payloadOverrides });
  return { payload, manifest: { payload, keyId, signature: signPayload(payload), publishedAt: '2026-09-01T00:00:00.000Z' } };
}

test('信任锚文件只允许硬编码常量，不允许环境变量或配置文件覆盖公钥', async () => {
  const source = await fs.readFile(new URL('../src/services/sdkDependencies/catalogTrustAnchors.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /process\.env/u);
  assert.ok(Array.isArray(SDK_CATALOG_TRUST_ANCHORS));
});

const fbroResource = () => remoteResource({
  id: 'fbro', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro 环境 SDK',
  requiredModuleIds: ['lingbuilder.fbro.browser'],
  criticalFiles: builtin[1].criticalFiles.map(file => file.relativePath),
  downloadUrl: 'https://msimgimg.xyz/uploads/fbro-new.zip', sha256: 'b'.repeat(64)
});

test('verifyAndMergeCatalog 验签通过后锚定字段取内置值、可更新字段取远端值', () => {
  const { manifest } = buildManifest(1, [remoteResource(), fbroResource()]);
  const merged = verifyAndMergeCatalog(builtin, manifest, anchors, { acceptedSequence: 0 });
  assert.equal(merged.sequence, 1);
  const cef3 = merged.resources.find(item => item.id === 'cef3')!;
  assert.equal(cef3.version, '150.0.15');
  assert.equal(cef3.downloadUrl, 'https://msimgimg.xyz/uploads/lingbuilder-cef3-sdk-new.zip');
  assert.equal(cef3.archiveBytes, 187_000_000);
  assert.deepEqual(cef3.criticalFiles, builtin[0].criticalFiles, '锚定的关键文件必须保留内置的最小字节数校验');
  assert.equal(cef3.moduleId, 'lingbuilder.cef3.sdk');
});

test('verifyAndMergeCatalog 拒绝被篡改的 payload', () => {
  const { manifest } = buildManifest(1, [remoteResource()]);
  const tampered: SdkCatalogManifestEnvelope = { ...manifest, payload: manifest.payload.replace('187000000', '1') };
  assert.throws(() => verifyAndMergeCatalog(builtin, tampered, anchors, { acceptedSequence: 0 }), /签名/u);
});

test('verifyAndMergeCatalog 拒绝锚定字段与内置清单不一致的清单', () => {
  const drifted = remoteResource({ criticalFiles: ['Release/libcef.dll'] });
  const { manifest } = buildManifest(1, [drifted, fbroResource()]);
  assert.throws(() => verifyAndMergeCatalog(builtin, manifest, anchors, { acceptedSequence: 0 }), /锚定/u);
  const moduleIdDrift = remoteResource({ moduleId: 'lingbuilder.other' });
  const manifest2 = buildManifest(1, [moduleIdDrift, fbroResource()]).manifest;
  assert.throws(() => verifyAndMergeCatalog(builtin, manifest2, anchors, { acceptedSequence: 0 }), /锚定/u);
});

test('verifyAndMergeCatalog 拒绝资源 id 集合缺失或多余', () => {
  const { manifest } = buildManifest(1, [remoteResource(), remoteResource({ id: 'extra' })]);
  assert.throws(() => verifyAndMergeCatalog(builtin, manifest, anchors, { acceptedSequence: 0 }), /资源 ID/u);
  const { manifest: missing } = buildManifest(1, []);
  assert.throws(() => verifyAndMergeCatalog(builtin, missing, anchors, { acceptedSequence: 0 }), /资源 ID/u);
});

test('verifyAndMergeCatalog 拒绝低于已接受 sequence 的清单（防回滚）', () => {
  const { manifest } = buildManifest(4, [remoteResource(), remoteResource({ id: 'fbro', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro 环境 SDK', requiredModuleIds: ['lingbuilder.fbro.browser'], criticalFiles: builtin[1].criticalFiles.map(file => file.relativePath) })]);
  assert.throws(() => verifyAndMergeCatalog(builtin, manifest, anchors, { acceptedSequence: 5 }), /sequence/u);
  const accepted = verifyAndMergeCatalog(builtin, manifest, anchors, { acceptedSequence: 4 });
  assert.equal(accepted.sequence, 4);
});

test('verifyAndMergeCatalog 拒绝未知 keyId、非 https 下载地址与非法 sha256', () => {
  const { manifest } = buildManifest(1, [remoteResource(), fbroResource()]);
  assert.throws(() => verifyAndMergeCatalog(builtin, manifest, [{ keyId: 'deadbeefdeadbeef', publicKeyPem }], { acceptedSequence: 0 }), /信任锚/u);
  const httpUrl = buildManifest(1, [remoteResource({ downloadUrl: 'http://msimgimg.xyz/x.zip' }), fbroResource()]).manifest;
  assert.throws(() => verifyAndMergeCatalog(builtin, httpUrl, anchors, { acceptedSequence: 0 }), /HTTPS/u);
  const badSha = buildManifest(1, [remoteResource({ sha256: 'ABC' }), fbroResource()]).manifest;
  assert.throws(() => verifyAndMergeCatalog(builtin, badSha, anchors, { acceptedSequence: 0 }), /SHA-256/u);
});

test('compareCatalogAnchoredFields 收集全部锚定漂移而不是抛出第一个错误', () => {
  const full = [remoteResource(), fbroResource(), sunnynetResource()];
  assert.deepEqual(compareCatalogAnchoredFields(builtin, full), []);
  const drifted = compareCatalogAnchoredFields(builtin, [
    remoteResource({ moduleId: 'lingbuilder.other', criticalFiles: ['Release/libcef.dll'] }),
    fbroResource(),
    { ...remoteResource(), id: 'extra' }
  ]);
  assert.ok(drifted.length >= 3, `应收集全部漂移，实际 ${JSON.stringify(drifted)}`);
  assert.ok(drifted.some(item => item.includes('cef3')), JSON.stringify(drifted));
  assert.ok(drifted.some(item => item.includes('extra')), JSON.stringify(drifted));
  assert.ok(drifted.every(item => /锚定|资源/.test(item)), JSON.stringify(drifted));
  assert.ok(compareCatalogAnchoredFields(builtin, [remoteResource()]).some(item => item.includes('fbro')));
});

test('发布门禁脚本存在且失败时输出中文诊断并以非零退出', async () => {
  const source = await fs.readFile(new URL('../scripts/check-sdk-catalog-anchors.ts', import.meta.url), 'utf8');
  assert.match(source, /compareCatalogAnchoredFields/u);
  assert.match(source, /process\.exit\(1\)/u);
  assert.match(source, /锚定/u);
  assert.match(source, /LINGBUILDER_SDK_CATALOG_URL|resolveSdkCatalogEndpoint/u);
});

test('SDK 面板与客户端暴露清单来源与 sequence', async () => {
  const client = await fs.readFile(new URL('../src/services/sdkDependencies/sdkDependencyClient.ts', import.meta.url), 'utf8');
  assert.match(client, /catalogSource/u);
  assert.match(client, /catalogSequence/u);
  const dialog = await fs.readFile(new URL('../src/components/SdkDependencyInstallerDialog.tsx', import.meta.url), 'utf8');
  assert.match(dialog, /清单来源/u);
  assert.match(dialog, /sequence/u);
});

test('sequence 状态文件读写往返，损坏或缺失时视为未接受', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-sdk-catalog-'));
  const statePath = path.join(dir, 'sdk-catalog-state.json');
  assert.equal(await readSdkCatalogState(statePath), null);
  await writeSdkCatalogState(statePath, 7);
  assert.deepEqual(await readSdkCatalogState(statePath), { acceptedSequence: 7 });
  await fs.writeFile(statePath, '{broken json');
  assert.equal(await readSdkCatalogState(statePath), null);
  await fs.rm(dir, { recursive: true, force: true });
});

test('resolveSdkCatalogEndpoint 未配置时返回 null，显式 URL 或 online 模式返回地址', () => {
  assert.equal(resolveSdkCatalogEndpoint({}), null);
  assert.deepEqual(
    resolveSdkCatalogEndpoint({ LINGBUILDER_SDK_CATALOG_URL: 'http://127.0.0.1:17900/v1/site/sdk-catalog' }),
    { url: 'http://127.0.0.1:17900/v1/site/sdk-catalog' }
  );
  assert.deepEqual(
    resolveSdkCatalogEndpoint({ LINGBUILDER_CLOUD_RELEASE_MODE: 'online', LINGBUILDER_CLOUD_API_URL: 'https://api.lingbuilder.com' }),
    { url: 'https://api.lingbuilder.com/v1/site/sdk-catalog' }
  );
  assert.equal(resolveSdkCatalogEndpoint({ LINGBUILDER_CLOUD_RELEASE_MODE: 'offline' }), null);
});

test('fetchRemoteCatalog 返回信封，HTTP 错误与非法 JSON 报中文错误', async () => {
  const server = http.createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, manifest: { payload: '{}', keyId, signature: 'x', publishedAt: '2026-09-01T00:00:00.000Z' } }));
      return;
    }
    res.writeHead(500).end('boom');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const manifest = await fetchRemoteCatalog(`${base}/ok`);
    assert.equal(manifest.keyId, keyId);
    await assert.rejects(() => fetchRemoteCatalog(`${base}/bad`), /拉取/u);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('SdkDependencyService 接入远端清单：成功换源、失败回退内置并在 overview 暴露来源', async () => {
  const { SdkDependencyService } = await import('../src/services/sdkDependencies/sdkDependencyService');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-sdk-svc-'));
  const statePath = path.join(dir, 'sdk-catalog-state.json');
  const resources = [remoteResource(), remoteResource({ id: 'fbro', moduleId: 'lingbuilder.fbro.sdk', name: 'FBro 环境 SDK', requiredModuleIds: ['lingbuilder.fbro.browser'], criticalFiles: builtin[1].criticalFiles.map(file => file.relativePath), downloadUrl: 'https://msimgimg.xyz/uploads/fbro-new.zip', sha256: 'b'.repeat(64) })] as unknown as SdkDependencyResource[];
  let mode: 'ok' | 'fail' = 'ok';
  const server = http.createServer((_req, res) => {
    if (mode !== 'ok') { res.writeHead(500).end(); return; }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, manifest: buildManifest(9, resources).manifest }));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const url = `http://127.0.0.1:${address.port}/v1/site/sdk-catalog`;
  const makeService = () => new SdkDependencyService({
    cacheRoot: path.join(dir, 'cache'),
    workspaceRoot: () => dir,
    environment: {},
    resourcesPath: undefined,
    aria2cPath: path.join(dir, 'aria2c-missing'),
    remoteCatalog: { url, anchors, statePath, timeoutMs: 2000, cacheTtlMs: 0 }
  });
  try {
    const service = makeService();
    const ok = await service.overview();
    assert.equal(ok.catalogSource, 'remote');
    assert.equal(ok.catalogSequence, 9);
    assert.equal(ok.dependencies.find(item => item.id === 'cef3')?.version, '150.0.15');
    assert.deepEqual(await readSdkCatalogState(statePath), { acceptedSequence: 9 });

    mode = 'fail';
    const failing = makeService();
    const degraded = await failing.overview();
    assert.equal(degraded.catalogSource, 'builtin');
    assert.equal(degraded.catalogSequence, null);
    assert.equal(degraded.dependencies.find(item => item.id === 'cef3')?.version, '150.0.14+g7c1aa68+chromium-150.0.7871.129');

    const builtinService = new SdkDependencyService({
      cacheRoot: path.join(dir, 'cache2'),
      workspaceRoot: () => dir,
      environment: {},
      aria2cPath: path.join(dir, 'aria2c-missing')
    });
    const plain = await builtinService.overview();
    assert.equal(plain.catalogSource, 'builtin');
    assert.equal(plain.catalogSequence, null);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('sdk-catalog:export 生成的导入载荷符合远端契约（criticalFiles 为相对路径字符串数组）', async () => {
  const { buildSdkCatalogImportPayload } = await import('../scripts/export-sdk-catalog');
  const payloadText = buildSdkCatalogImportPayload();
  const parsed = JSON.parse(payloadText) as { resources: Array<Record<string, unknown>> };
  assert.ok(Array.isArray(parsed.resources));
  assert.deepEqual(parsed.resources.map(item => item.id), ['cef3', 'fbro', 'sunnynet']);
  const builtin = (await import('../src/services/sdkDependencies/sdkDependencyCatalog')).SDK_DEPENDENCY_RESOURCES;
  parsed.resources.forEach((resource, index) => {
    assert.deepEqual(resource.criticalFiles, builtin[index].criticalFiles.map(file => file.relativePath));
    assert.equal(resource.sdkVersion, builtin[index].sdkVersion);
  });
  assert.match(payloadText, /"resources":\s*\[/u);
  assert.doesNotMatch(payloadText, /\[object Object\]/u);
});
