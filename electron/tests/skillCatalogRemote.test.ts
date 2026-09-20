import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { SDK_CATALOG_SIGNATURE_PREFIX } from '../src/services/sdkDependencies/sdkCatalogRemote';
import { SDK_CATALOG_TRUST_ANCHORS } from '../src/services/sdkDependencies/catalogTrustAnchors';
import {
  SKILL_CATALOG_SIGNATURE_PREFIX,
  compareSemver,
  downloadSkillKitFiles,
  resolveSkillCatalogEndpoint,
  verifySkillCatalogManifest,
  type SkillCatalogFetch,
  type SkillKitBundledManifest
} from '../electron/skillKit/skillCatalogRemote';
import { SKILL_CATALOG_TRUST_ANCHORS } from '../electron/skillKit/skillCatalogTrustAnchors';
import { SkillKitService, resolveBundledSkillKitRoot } from '../electron/skillKit/skillKitService';

const SKILL_TEXT = '.lcpp 接入指引正文\n';
const SKILL_SHA = createHash('sha256').update(SKILL_TEXT, 'utf8').digest('hex');

function bundledManifest(overrides: Partial<SkillKitBundledManifest> = {}): SkillKitBundledManifest {
  return {
    schemaVersion: 1,
    id: 'lingbuilder.skill-kit',
    version: '0.1.0',
    sequence: 1,
    entrypoint: 'SKILL.md',
    installPromptTemplate: '请读取 {skillPath} 安装。',
    files: [{ path: 'SKILL.md', bytes: Buffer.byteLength(SKILL_TEXT, 'utf8'), sha256: SKILL_SHA }],
    ...overrides
  };
}

function createKey() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return {
    privateKey,
    keyId: createHash('sha256').update(spki).digest('hex').slice(0, 16),
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }).toString()
  };
}

function signedEnvelope(key: ReturnType<typeof createKey>, payload: unknown, prefix = SKILL_CATALOG_SIGNATURE_PREFIX) {
  const payloadJson = JSON.stringify(payload);
  const signature = sign(null, Buffer.from(`${prefix}${payloadJson}`, 'utf8'), key.privateKey).toString('base64');
  return { payload: payloadJson, keyId: key.keyId, signature, publishedAt: new Date().toISOString() };
}

function remoteRelease(bundled: SkillKitBundledManifest, overrides: Record<string, unknown> = {}) {
  return {
    id: bundled.id,
    version: '0.2.0',
    entrypoint: bundled.entrypoint,
    minIdeVersion: '0.7.0',
    installPromptTemplate: '请读取 {skillPath} 并按最新版安装。',
    files: bundled.files.map(file => ({ ...file, downloadUrl: 'https://cdn.example.test/skill-kit/SKILL.md' })),
    ...overrides
  };
}

test('端点解析：显式 URL 优先，其次在线模式，否则不启用', () => {
  assert.deepEqual(resolveSkillCatalogEndpoint({ LINGBUILDER_SKILL_CATALOG_URL: 'http://127.0.0.1:1/x' }), { url: 'http://127.0.0.1:1/x' });
  assert.deepEqual(resolveSkillCatalogEndpoint({ LINGBUILDER_CLOUD_RELEASE_MODE: 'online', LINGBUILDER_CLOUD_API_URL: 'https://api.example.test/' }),
    { url: 'https://api.example.test/v1/site/skill-catalog' });
  assert.equal(resolveSkillCatalogEndpoint({ LINGBUILDER_CLOUD_RELEASE_MODE: 'offline' }), null);
  assert.equal(resolveSkillCatalogEndpoint({}), null);
  assert.equal(compareSemver('0.7.6', '0.7.10'), -1);
  assert.equal(compareSemver('0.8.0', '0.7.9'), 1);
});

test('验签通过即返回可更新字段，且签名域名与 SDK 清单互斥', () => {
  const key = createKey();
  const bundled = bundledManifest();
  const payload = { schemaVersion: 1, sequence: 2, release: remoteRelease(bundled) };
  const verified = verifySkillCatalogManifest({
    manifest: signedEnvelope(key, payload),
    bundled,
    anchors: [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }],
    acceptedSequence: 0,
    ideVersion: '0.7.6'
  });
  assert.equal(verified.sequence, 2);
  assert.equal(verified.release.version, '0.2.0');

  // 用 SDK 域名签的同一条 payload 必须验不过：防跨清单搬运签名。
  assert.throws(() => verifySkillCatalogManifest({
    manifest: signedEnvelope(key, payload, SDK_CATALOG_SIGNATURE_PREFIX),
    bundled,
    anchors: [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }],
    acceptedSequence: 0,
    ideVersion: '0.7.6'
  }), /签名验证失败/u);
  assert.notEqual(SDK_CATALOG_SIGNATURE_PREFIX, SKILL_CATALOG_SIGNATURE_PREFIX);
});

test('信任锚、防回滚与锚定字段任一不满足都整条拒绝', () => {
  const key = createKey();
  const bundled = bundledManifest();
  const payload = { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled) };
  const anchor = [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }];
  const run = (overrides: Record<string, unknown> = {}) => verifySkillCatalogManifest({
    manifest: signedEnvelope(key, (overrides.payload ?? payload) as never),
    bundled: (overrides.bundled ?? bundled) as SkillKitBundledManifest,
    anchors: (overrides.anchors ?? anchor) as never,
    acceptedSequence: (overrides.acceptedSequence ?? 0) as number,
    ideVersion: (overrides.ideVersion ?? '0.7.6') as string
  });

  assert.throws(() => run({ anchors: [] }), /未配置灵码 Skill 清单信任锚/u);
  assert.throws(() => verifySkillCatalogManifest({
    manifest: signedEnvelope(key, payload), bundled, anchors: [{ keyId: 'ffffffffffffffff', publicKeyPem: anchor[0].publicKeyPem }], acceptedSequence: 0, ideVersion: '0.7.6'
  }), /不在内置信任锚内/u);
  assert.throws(() => run({ acceptedSequence: 6 }), /疑似回滚/u);
  assert.throws(() => run({ bundled: bundledManifest({ sequence: 9 }) }), /低于安装包内置快照/u);
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { id: 'other.pkg' }) } }), /锚定漂移：包 ID/u);
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { entrypoint: 'GUIDE.md' }) } }), /锚定漂移：入口文件/u);
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { installPromptTemplate: '请读取文档安装。' }) } }), /\{skillPath\} 占位符/u);
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { minIdeVersion: '99.0.0' }) } }), /要求 IDE 不低于 99.0.0/u);
  assert.throws(() => run({ payload: { schemaVersion: 2, sequence: 5, release: remoteRelease(bundled) } }), /schemaVersion 不支持/u);
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { files: [] }) } }), /files 必须是非空数组/u);
  // 内置快照里没有的文件不允许出现在清单里（否则等于允许远端往工作区塞任意路径）
  assert.throws(() => run({ payload: { schemaVersion: 1, sequence: 5, release: remoteRelease(bundled, { files: [{ path: 'evil.sh', bytes: 3, sha256: '0'.repeat(64), downloadUrl: 'https://a.test/evil' }] }) } }), /内置快照不存在的文件/u);
});

test('下载逐文件校验，SHA-256 不符时不留半成品', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-skill-dl-'));
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const bundled = bundledManifest();
  const release = remoteRelease(bundled, { files: [{ ...bundled.files[0], downloadUrl: 'https://cdn.example.test/SKILL.md' }] });
  const okFetch: SkillCatalogFetch = async () => new Response(SKILL_TEXT);
  const written = await downloadSkillKitFiles(release as never, dir, okFetch);
  assert.equal(written.length, 1);
  assert.equal(await fs.readFile(written[0], 'utf8'), SKILL_TEXT);

  // 等长但内容不同：必须走到 SHA-256 分支，而不是被字节数校验提前挡下
  const badFetch: SkillCatalogFetch = async () => new Response(SKILL_TEXT.replace('正文', '主文'));
  await assert.rejects(() => downloadSkillKitFiles(release as never, dir, badFetch), /SHA-256 与清单不一致/u);
  await assert.rejects(() => downloadSkillKitFiles(release as never, dir, async () => new Response('完全不同的更长一段替换正文内容')), /字节数不符/u);
  await assert.rejects(() => downloadSkillKitFiles({ ...release, files: [{ ...release.files[0], downloadUrl: 'https://a' }] } as never, dir, async () => new Response('x', { status: 503 })), /HTTP 503/u);
});

test('服务：无网络时给内置快照，复制指令已替换绝对路径', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-skill-svc-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundledRoot = path.join(root, 'bundle');
  await fs.mkdir(bundledRoot, { recursive: true });
  await fs.writeFile(path.join(bundledRoot, 'SKILL.md'), SKILL_TEXT, 'utf8');
  await fs.writeFile(path.join(bundledRoot, 'manifest.json'), JSON.stringify(bundledManifest(), null, 2), 'utf8');
  const service = new SkillKitService({ userDataDir: root, bundledRoot, ideVersion: '0.7.6', environment: {} });

  const status = await service.snapshot();
  assert.equal(status.source, 'bundled');
  assert.equal(status.sequence, 1);
  assert.ok(status.entrypointPath.endsWith(path.join('bundle', 'SKILL.md')));
  assert.ok(!status.installPrompt.includes('{skillPath}'), '复制指令必须已替换成绝对路径');
  assert.ok(status.installPrompt.includes(status.entrypointPath));

  const offline = await service.checkForUpdates();
  assert.match(offline.problem, /未启用云端 Skill 清单通道/u);
  assert.equal(offline.source, 'bundled');
  assert.equal(resolveBundledSkillKitRoot({ packaged: true, resourcesPath: 'R:', electronRoot: 'E:' }), path.join('R:', 'skill-kit'));
  assert.equal(resolveBundledSkillKitRoot({ packaged: false, resourcesPath: 'R:', electronRoot: 'E:' }), path.join('E:', 'skill-kit'));
});

test('服务：联网成功后落缓存并推进 sequence，缓存被篡改即回退内置快照', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-skill-remote-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundledRoot = path.join(root, 'bundle');
  await fs.mkdir(bundledRoot, { recursive: true });
  await fs.writeFile(path.join(bundledRoot, 'SKILL.md'), SKILL_TEXT, 'utf8');
  const bundled = bundledManifest();
  await fs.writeFile(path.join(bundledRoot, 'manifest.json'), JSON.stringify(bundled, null, 2), 'utf8');

  const key = createKey();
  const payload = { schemaVersion: 1, sequence: 7, release: remoteRelease(bundled, { version: '0.3.0' }) };
  const envelope = { ok: true, manifest: signedEnvelope(key, payload) };
  const fetcher: SkillCatalogFetch = async url => (url.includes('/v1/site/skill-catalog')
    ? new Response(JSON.stringify(envelope), { headers: { 'content-type': 'application/json' } })
    : new Response(SKILL_TEXT));
  const service = new SkillKitService({
    userDataDir: root, bundledRoot, ideVersion: '0.7.6',
    environment: { LINGBUILDER_SKILL_CATALOG_URL: 'https://api.test/v1/site/skill-catalog' },
    fetcher, anchors: [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }]
  });

  const updated = await service.checkForUpdates();
  assert.equal(updated.source, 'remote');
  assert.equal(updated.sequence, 7);
  assert.equal(updated.version, '0.3.0');
  assert.equal(updated.problem, '');
  assert.ok(updated.entrypointPath.startsWith(path.join(root, 'skill-kit')));

  const cached = await service.snapshot();
  assert.equal(cached.source, 'cache');
  assert.equal(cached.sequence, 7);

  await fs.writeFile(path.join(root, 'skill-kit', 'SKILL.md'), '被人改过的正文', 'utf8');
  const afterTamper = await service.snapshot();
  assert.equal(afterTamper.source, 'bundled', '缓存文件与 SHA-256 不符时必须回退内置快照');

  // 防回滚：已接受 7 之后，云端退回 6 必须整条拒绝并保留可用快照
  const staleEnvelope = { ok: true, manifest: signedEnvelope(key, { ...payload, sequence: 6 }) };
  const staleService = new SkillKitService({
    userDataDir: root, bundledRoot, ideVersion: '0.7.6',
    environment: { LINGBUILDER_SKILL_CATALOG_URL: 'https://api.test/v1/site/skill-catalog' },
    fetcher: async url => (url.includes('/v1/site/skill-catalog')
      ? new Response(JSON.stringify(staleEnvelope), { headers: { 'content-type': 'application/json' } })
      : new Response(SKILL_TEXT)),
    anchors: [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }]
  });
  const rejected = await staleService.checkForUpdates();
  assert.match(rejected.problem, /疑似回滚/u);
  assert.ok(rejected.ok, '拒绝远端清单不影响本机仍有可用正文');

  const broken = new SkillKitService({
    userDataDir: root, bundledRoot, ideVersion: '0.7.6',
    environment: { LINGBUILDER_SKILL_CATALOG_URL: 'https://api.test/v1/site/skill-catalog' },
    fetcher: async () => { throw new Error('网络不可达'); },
    anchors: [{ keyId: key.keyId, publicKeyPem: key.publicKeyPem }]
  });
  const degraded = await broken.checkForUpdates();
  assert.match(degraded.problem, /拉取灵码 Skill 清单失败：网络不可达/u);
  assert.equal(degraded.source, 'bundled');
});

test('信任锚与 SDK 清单共用同一把生产公钥，轮换必须两处同步', () => {
  assert.equal(SKILL_CATALOG_TRUST_ANCHORS.length, SDK_CATALOG_TRUST_ANCHORS.length);
  for (const anchor of SKILL_CATALOG_TRUST_ANCHORS) {
    const twin = SDK_CATALOG_TRUST_ANCHORS.find(item => item.keyId === anchor.keyId);
    assert.ok(twin, `Skill 锚点 keyId ${anchor.keyId} 在 SDK 锚点里不存在`);
    assert.equal(anchor.publicKeyPem, twin!.publicKeyPem, `${anchor.keyId} 的公钥与 SDK 锚点不一致`);
  }
});

test('内置快照缺失时服务如实报错，不伪造版本', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-skill-missing-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new SkillKitService({ userDataDir: root, bundledRoot: path.join(root, 'nope'), ideVersion: '0.7.6', environment: {} });
  const status = await service.snapshot();
  assert.equal(status.ok, false);
  assert.match(status.problem, /内置的灵码 Skill 快照不可用/u);
  assert.equal(status.version, '');
  const updated = await service.checkForUpdates();
  assert.equal(updated.ok, false);
});
