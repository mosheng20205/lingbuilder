import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import {
  signSkillCatalogPayload,
  skillCatalogSignatureInput,
  validateSkillCatalogRelease,
  verifySkillCatalogPayloadSignature
} from '../src/website/skill-catalog-signing.js';
import { verifySdkCatalogPayloadSignature } from '../src/website/sdk-catalog-signing.js';
import { SkillCatalogService } from '../src/website/skill-catalog.service.js';

const actor = { id: 'admin-1', email: 'admin@example.com', role: 'operator', mfa: true };
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);

function validFile(overrides: Record<string, unknown> = {}) {
  return {
    path: 'SKILL.md',
    bytes: 7727,
    sha256: SHA_A,
    downloadUrl: 'https://cdn.lingbuilder.example/skill-kit/SKILL.md',
    ...overrides
  };
}

function validRelease(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lingbuilder.skill-kit',
    version: '0.2.0',
    entrypoint: 'SKILL.md',
    minIdeVersion: '0.7.6',
    installPromptTemplate: '请读取 {skillPath} 并按其中步骤安装。',
    files: [validFile()],
    ...overrides
  };
}

function mockPrisma(options: { maxSequence?: number | null } = {}) {
  const creates: any[] = [];
  const audits: any[] = [];
  const prisma = {
    skillCatalogRelease: {
      aggregate: async () => ({ _max: { sequence: options.maxSequence === undefined ? 3 : options.maxSequence } }),
      create: async (args: any) => { creates.push(args); return { id: 'skill-rel-1', createdAt: new Date('2026-09-19T00:00:00Z'), ...args.data }; },
      findFirst: async () => null,
      findMany: async () => []
    },
    adminAuditLog: { create: async (args: any) => { audits.push(args); return args.data; } }
  };
  return { prisma, creates, audits };
}

function requireSource(relativePath: string) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}

test('skill 清单签名可回验，篡改即失效', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const payloadJson = JSON.stringify({ schemaVersion: 1, sequence: 1, release: validRelease() });
  const signature = signSkillCatalogPayload(payloadJson, privateKey);
  assert.equal(verifySkillCatalogPayloadSignature(payloadJson, signature, publicKey), true);
  assert.equal(verifySkillCatalogPayloadSignature(payloadJson.replace('0.2.0', '9.9.9'), signature, publicKey), false);
});

test('skill 清单与 SDK 清单签名域名互相隔离，签名不可跨清单复用', () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const payloadJson = '{"schemaVersion":1,"sequence":1,"release":{}}';
  assert.deepEqual(skillCatalogSignatureInput(payloadJson), Buffer.from(`lingbuilder-skill-catalog-v1\n${payloadJson}`, 'utf8'));
  const skillSignature = signSkillCatalogPayload(payloadJson, privateKey);
  // 同一条 payload 换到 SDK 域名下必须验不过：否则一份清单可以被搬到另一个端点冒充另一套。
  assert.equal(verifySdkCatalogPayloadSignature(payloadJson, skillSignature, publicKey), false);
});

test('清单校验拒绝缺失或非法字段', () => {
  const cases: Array<[Record<string, unknown>, RegExp]> = [
    [{ id: 'Bad Id' }, /包 ID/u],
    [{ version: 'v2' }, /语义版本/u],
    [{ minIdeVersion: 'abc' }, /最低 IDE 版本/u],
    [{ entrypoint: 'C:\\evil\\SKILL.md' }, /相对路径/u],
    [{ entrypoint: '../SKILL.md' }, /相对路径/u],
    [{ installPromptTemplate: '请读取文档安装。' }, /\{skillPath\} 占位符/u],
    [{ installPromptTemplate: '' }, /指令模板不能为空/u],
    [{ files: [] }, /文件清单不能为空/u],
    [{ files: [validFile({ sha256: 'ABC' })] }, /SHA-256/u],
    [{ files: [validFile({ downloadUrl: 'http://insecure.example/SKILL.md' })] }, /HTTPS/u],
    [{ files: [validFile({ bytes: 0 })] }, /字节数/u],
    [{ files: [validFile({ path: 'manifest.json' })] }, /入口文件/u]
  ];
  for (const [overrides, pattern] of cases) {
    assert.throws(() => validateSkillCatalogRelease(validRelease(overrides)),
      (error: any) => error.status === 400 && pattern.test(error.message), `未按预期拒绝：${JSON.stringify(overrides)}`);
  }
});

test('清单校验拒绝重复文件路径与超限合计体积', () => {
  assert.throws(() => validateSkillCatalogRelease(validRelease({ files: [validFile(), validFile({ sha256: SHA_B })] })),
    (error: any) => error.status === 400 && /路径重复/u.test(error.message));
  const fiveFiles = ['SKILL.md', 'f1.md', 'f2.md', 'f3.md', 'f4.md'].map((path, index) =>
    validFile({ path, bytes: 5 * 1024 * 1024, sha256: String(index + 1).repeat(64).slice(0, 64) }));
  assert.throws(() => validateSkillCatalogRelease(validRelease({ files: fiveFiles })),
    (error: any) => error.status === 400 && /合计字节数/u.test(error.message));
});

test('清单校验只保留白名单字段并允许多文件', () => {
  const release = validateSkillCatalogRelease(validRelease({
    files: [validFile(), validFile({ path: 'manifest.json', sha256: SHA_B, bytes: 620 })],
    entrypoint: 'SKILL.md',
    smuggled: 'x'
  }));
  assert.deepEqual(Object.keys(release).sort(), ['entrypoint', 'files', 'id', 'installPromptTemplate', 'minIdeVersion', 'version']);
  assert.deepEqual(Object.keys(release.files[0]).sort(), ['bytes', 'downloadUrl', 'path', 'sha256']);
  assert.equal(release.files.length, 2);
});

test('createRelease 递增 sequence、签名落库并写审计', async () => {
  const { prisma, creates, audits } = mockPrisma();
  const service = new SkillCatalogService(prisma as any);
  const result = await service.createRelease({ release: validRelease(), note: '补界面配方章节' }, actor);

  assert.equal(creates.length, 1);
  assert.equal(creates[0].data.sequence, 4);
  const payload = JSON.parse(creates[0].data.payload);
  assert.equal(payload.schemaVersion, 1);
  assert.equal(payload.sequence, 4);
  assert.equal(payload.release.id, 'lingbuilder.skill-kit');
  assert.deepEqual(Object.keys(payload.release).sort(), ['entrypoint', 'files', 'id', 'installPromptTemplate', 'minIdeVersion', 'version']);
  assert.match(creates[0].data.keyId, /^[0-9a-f]{16}$/u);
  assert.equal(result.ok, true);

  assert.equal(audits.length, 1);
  assert.equal(audits[0].data.action, 'website.skill-catalog.publish');
  assert.equal(audits[0].data.details.sequence, 4);
  assert.equal(audits[0].data.details.version, '0.2.0');
});

test('createRelease 也接受扁平 body（release 可省）', async () => {
  const { prisma, creates } = mockPrisma({ maxSequence: 0 });
  const service = new SkillCatalogService(prisma as any);
  await service.createRelease({ ...validRelease(), note: '' }, actor);
  assert.equal(creates[0].data.sequence, 1);
  assert.equal(JSON.parse(creates[0].data.payload).release.version, '0.2.0');
});

test('公开与后台路由形状固定：无缓存公开读 + 角色门禁写', () => {
  const controller = requireSource('../src/website/skill-catalog.controller.ts');
  assert.match(controller, /@Controller\('v1\/site'\)/u);
  assert.match(controller, /@Public\(\)/u);
  assert.match(controller, /@Header\('Cache-Control', 'no-store'\)/u);
  assert.match(controller, /@Get\('skill-catalog'\)/u);
  assert.match(controller, /@Post\('skill-catalog'\) @Roles\('super_admin', 'operator'\)/u);
  const moduleSource = requireSource('../src/app.module.ts');
  for (const symbol of ['SkillCatalogController', 'SkillCatalogAdminController', 'SkillCatalogService']) {
    assert.ok(moduleSource.includes(symbol), `app.module 未注册 ${symbol}`);
  }
});

test('数据模型与迁移成对存在', () => {
  const schema = requireSource('../prisma/schema.prisma');
  assert.match(schema, /model SkillCatalogRelease \{/u);
  assert.match(schema, /sequence\s+Int\s+@unique/u);
  const migration = requireSource('../prisma/migrations/202609190001_skill_catalog/migration.sql');
  assert.match(migration, /CREATE TABLE "SkillCatalogRelease"/u);
  assert.match(migration, /CREATE UNIQUE INDEX "SkillCatalogRelease_sequence_key"/u);
});
