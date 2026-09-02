import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import {
  sdkCatalogKeyId,
  sdkCatalogSignatureInput,
  sdkCatalogSigningKeyPair,
  signSdkCatalogPayload,
  validateSdkCatalogResources,
  verifySdkCatalogPayloadSignature
} from '../src/website/sdk-catalog-signing.js';
import { SdkCatalogService } from '../src/website/sdk-catalog.service.js';

const actor = { id: 'admin-1', email: 'admin@example.com', role: 'operator', mfa: true };

function validResource(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cef3-runtime',
    moduleId: 'lingbuilder.fbro.sdk',
    name: 'CEF3 运行时',
    platform: 'Windows',
    requiredModuleIds: [],
    criticalFiles: ['libcef.dll'],
    version: '1.0.0',
    sdkVersion: '1.0.0',
    archiveName: 'cef3-runtime.zip',
    downloadUrl: 'https://msimgimg.xyz/sdk/cef3-runtime.zip',
    archiveBytes: 186457476,
    sha256: 'b984477a30527864f67aab5817b4ee17d23ec1977fc5a6ab191b19a373a6dc55',
    fileCount: 12,
    expandedBytes: 400000000,
    ...overrides
  };
}

function mockPrisma(options: { maxSequence?: number | null; latestRow?: Record<string, unknown> } = {}) {
  const creates: any[] = [];
  const audits: any[] = [];
  const queries: any[] = [];
  const prisma = {
    sdkCatalogRelease: {
      aggregate: async () => ({ _max: { sequence: options.maxSequence === undefined ? 6 : options.maxSequence } }),
      create: async (args: any) => { creates.push(args); return { id: 'rel-1', createdAt: new Date('2026-09-01T00:00:00Z'), ...args.data }; },
      findFirst: async (args: any) => { queries.push(args); return options.latestRow ?? null; },
      findMany: async (args: any) => { queries.push(args); return []; }
    },
    adminAuditLog: { create: async (args: any) => { audits.push(args); return args.data; } }
  };
  return { prisma, creates, audits, queries };
}

function requireSource(relativePath: string) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('signature roundtrip verifies and tampering breaks it', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const payloadJson = JSON.stringify({ schemaVersion: 1, sequence: 3, resources: [validResource()] });
  const signature = signSdkCatalogPayload(payloadJson, privateKey);
  assert.equal(verifySdkCatalogPayloadSignature(payloadJson, signature, publicKey), true);
  assert.equal(verifySdkCatalogPayloadSignature(payloadJson.replace('1.0.0', '9.9.9'), signature, publicKey), false);
});

test('signature input is domain-separated from the raw payload bytes', () => {
  const payloadJson = '{"schemaVersion":1,"sequence":1,"resources":[]}';
  assert.deepEqual(sdkCatalogSignatureInput(payloadJson), Buffer.from(`lingbuilder-sdk-catalog-v1\n${payloadJson}`, 'utf8'));
});

test('keyId is 16 lowercase hex characters derived from the public key', () => {
  const { publicKey } = crypto.generateKeyPairSync('ed25519');
  assert.match(sdkCatalogKeyId(publicKey), /^[0-9a-f]{16}$/u);
});

test('resource validation rejects http download urls', () => {
  assert.throws(() => validateSdkCatalogResources([validResource({ downloadUrl: 'http://msimgimg.xyz/sdk/cef3-runtime.zip' })]),
    (error: any) => error.status === 400 && /下载地址/u.test(error.message));
});

test('resource validation rejects malformed sha256 values', () => {
  assert.throws(() => validateSdkCatalogResources([validResource({ sha256: 'b984477a' })]),
    (error: any) => error.status === 400 && /SHA-256/u.test(error.message));
  assert.throws(() => validateSdkCatalogResources([validResource({ sha256: 'B984477A30527864F67AAB5817B4EE17D23EC1977FC5A6AB191B19A373A6DC55' })]),
    (error: any) => error.status === 400 && /SHA-256/u.test(error.message));
});

test('resource validation rejects non-positive archive sizes', () => {
  for (const archiveBytes of [0, -1, 1.5, 'x']) {
    assert.throws(() => validateSdkCatalogResources([validResource({ archiveBytes })]),
      (error: any) => error.status === 400 && /包体大小/u.test(error.message));
  }
});

test('resource validation rejects missing required fields', () => {
  const resource = validResource();
  delete (resource as any).downloadUrl;
  assert.throws(() => validateSdkCatalogResources([resource]),
    (error: any) => error.status === 400 && /下载地址/u.test(error.message));
});

test('resource validation rejects duplicate resource ids', () => {
  assert.throws(() => validateSdkCatalogResources([validResource(), validResource()]),
    (error: any) => error.status === 400 && /重复/u.test(error.message));
});

test('resource validation normalizes fields and drops unknown keys', () => {
  const resources = validateSdkCatalogResources([validResource({ sneaky: 'x' })]);
  assert.equal(resources.length, 1);
  assert.deepEqual(Object.keys(resources[0]).sort(), ['archiveBytes', 'archiveName', 'criticalFiles', 'downloadUrl', 'expandedBytes', 'fileCount', 'id', 'moduleId', 'name', 'platform', 'requiredModuleIds', 'sdkVersion', 'sha256', 'version']);
});

test('createRelease signs the next sequence, persists it and writes an audit entry', async () => {
  const { prisma, creates, audits } = mockPrisma();
  const service = new SdkCatalogService(prisma as any);
  const result = await service.createRelease({ resources: [validResource()], note: '换源' }, actor);

  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.sequence, 7);
  const payload = JSON.parse(creates[0].data.payload);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.sequence, 7);
  assert.equal(payload.resources[0].id, 'cef3-runtime');

  const pair = sdkCatalogSigningKeyPair()!;
  assert.equal(verifySdkCatalogPayloadSignature(creates[0].data.payload, creates[0].data.signature, pair.publicKey), true);
  assert.equal(creates[0].data.keyId, sdkCatalogKeyId(pair.publicKey));

  assert.equal(audits[0].data.action, 'website.sdk-catalog.publish');
  assert.equal(audits[0].data.targetType, 'sdk-catalog');
  assert.equal(audits[0].data.details.sequence, 7);
  assert.equal(result.ok, true);
});

test('createRelease starts the sequence at 1 when no release exists', async () => {
  const { prisma, creates } = mockPrisma({ maxSequence: null });
  const service = new SdkCatalogService(prisma as any);
  await service.createRelease({ resources: [validResource()] }, actor);
  assert.equal(creates[0].data.sequence, 1);
});

test('createRelease rejects empty resource lists', async () => {
  const { prisma, creates } = mockPrisma();
  const service = new SdkCatalogService(prisma as any);
  await assert.rejects(service.createRelease({ resources: [] }, actor), (error: any) => error.status === 400);
  assert.equal(creates.length, 0);
});

test('getLatestManifest returns null before the first release', async () => {
  const { prisma, queries } = mockPrisma();
  const service = new SdkCatalogService(prisma as any);
  const result = await service.getLatestManifest();
  assert.equal(result.ok, true);
  assert.equal(result.manifest, null);
  assert.deepEqual(queries[0].orderBy, [{ sequence: 'desc' }]);
});

test('getLatestManifest returns the signed envelope of the newest release', async () => {
  const latestRow = { payload: '{"schemaVersion":1}', keyId: 'abcdef0123456789', signature: 'sig', createdAt: new Date('2026-09-01T00:00:00Z') };
  const { prisma } = mockPrisma({ latestRow });
  const service = new SdkCatalogService(prisma as any);
  const result = await service.getLatestManifest();
  assert.deepEqual(result.manifest, { payload: latestRow.payload, keyId: latestRow.keyId, signature: 'sig', publishedAt: latestRow.createdAt });
});

test('getHistory clamps the page size and orders by descending sequence', async () => {
  const { prisma, queries } = mockPrisma();
  const service = new SdkCatalogService(prisma as any);
  await service.getHistory(999);
  assert.equal(queries[0].take, 100);
  assert.deepEqual(queries[0].orderBy, [{ sequence: 'desc' }]);
});

test('createRelease refuses to sign in production without a configured key pair', async () => {
  const previous = { ...process.env };
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    delete process.env.SDK_CATALOG_PRIVATE_KEY_PEM;
    delete process.env.SDK_CATALOG_PUBLIC_KEY_PEM;
    process.env.NODE_ENV = 'production';
    const { prisma, creates } = mockPrisma();
    const service = new SdkCatalogService(prisma as any);
    await assert.rejects(service.createRelease({ resources: [validResource()] }, actor), (error: any) => error.status === 503);
    assert.equal(creates.length, 0);
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousNodeEnv;
  }
});

test('sdk catalog endpoints: public manifest is public with no-store, admin writes are role-restricted', () => {
  const controller = requireSource('../src/website/sdk-catalog.controller.ts');
  assert.match(controller, /@Controller\('v1\/site'\)/u);
  assert.match(controller, /@Public\(\)/u);
  assert.match(controller, /@Header\('Cache-Control', 'no-store'\)/u);
  assert.match(controller, /@Get\('sdk-catalog'\)/u);
  assert.match(controller, /@Controller\('v1\/admin\/site'\)/u);
  assert.match(controller, /@Post\('sdk-catalog'\) @Roles\('super_admin', 'operator'\)/u);
  assert.match(controller, /@Get\('sdk-catalog\/history'\) @Roles\('super_admin', 'operator'\)/u);
});

test('sdk catalog service and controllers are registered in the app module', () => {
  const source = requireSource('../src/app.module.ts');
  assert.match(source, /SdkCatalogController/u);
  assert.match(source, /SdkCatalogAdminController/u);
  assert.match(source, /SdkCatalogService/u);
});

test('criticalFiles 与 requiredModuleIds 必须全部是字符串，对象项直接拒绝', () => {
  const base = { id: 'cef3', moduleId: 'lingbuilder.cef3.sdk', name: 'CEF3', platform: 'windows-x64', requiredModuleIds: [] as unknown[], version: '1.0.0', sdkVersion: '1.0', archiveName: 'a.zip', downloadUrl: 'https://example.com/a.zip', archiveBytes: 1, sha256: 'a'.repeat(64), fileCount: 1, expandedBytes: 1 };
  assert.throws(() => validateSdkCatalogResources([{ ...base, criticalFiles: [{ relativePath: 'a.h' }] }]), /关键文件列表必须全部是字符串/u);
  assert.throws(() => validateSdkCatalogResources([{ ...base, criticalFiles: ['include/cef_app.h', '[object Object]'] }]), /关键文件列表必须是相对路径/u);
  assert.throws(() => validateSdkCatalogResources([{ ...base, criticalFiles: ['C:/evil/cef.dll'] }]), /关键文件列表必须是相对路径/u);
  assert.throws(() => validateSdkCatalogResources([{ ...base, criticalFiles: ['include/../cef_app.h'] }]), /关键文件列表必须是相对路径/u);
  assert.throws(() => validateSdkCatalogResources([{ ...base, requiredModuleIds: [{}] }]), /依赖模块列表必须全部是字符串/u);
  // 根级文件名（不带斜杠）与内置清单实际值都必须能通过校验。
  const ok = validateSdkCatalogResources([{
    ...base,
    criticalFiles: ['runtime-manifest.json', 'include/cef_app.h', 'Release/libcef.dll', 'Resources/locales/zh-CN.pak'],
    requiredModuleIds: ['lingbuilder.cef3.browser']
  }]);
  assert.deepEqual(ok[0].criticalFiles, ['runtime-manifest.json', 'include/cef_app.h', 'Release/libcef.dll', 'Resources/locales/zh-CN.pak']);
});
