import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { WebsiteContentService } from '../src/website/website-content.service.js';

test('module manifest sync uses stable module command keys and preserves handler parameters', async () => {
  const upserts: any[] = [];
  const audits: any[] = [];
  const prisma = {
    websiteCommandReference: {
      upsert: async (args: any) => { upserts.push(args); return { id: `command-${upserts.length}`, ...args.create }; },
      updateMany: async (args: any) => { assert.equal(args.where.moduleId, 'example.network'); return { count: 2 }; }
    },
    adminAuditLog: { create: async (args: any) => { audits.push(args); return args.data; } }
  };
  const service = new WebsiteContentService(prisma as any);
  const result = await service.syncManifest({ publish: true, manifest: {
    schemaVersion: 2,
    id: 'example.network',
    name: 'network',
    displayName: '网络示例模块',
    version: '1.2.0',
    category: '网络',
    minLingBuilderVersion: '0.2.0',
    contributes: { commands: [{ name: '网页_异步访问', signature: '网页_异步访问(地址, 标识, &完成处理器)', description: '异步访问网页。' }] },
    bindings: { commands: [{ command: '网页_异步访问', runtimeName: 'LB_WebRequest', parameters: [{ name: '地址', type: 'wideString' }, { name: '标识', type: 'int' }, { name: '完成处理器', type: 'handler' }], returnType: 'bool', example: '网页_异步访问("https://example.com", 0, &获取完成)' }] },
    targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
  } }, { id: 'admin-1', email: 'admin@example.com', role: 'operator', mfa: true });

  assert.deepEqual(result, { ok: true, moduleId: 'example.network', version: '1.2.0', updated: 1, deprecated: 2 });
  assert.equal(upserts[0].where.stableKey, 'example.network:网页_异步访问');
  assert.equal(upserts[0].create.parameters[2].type, 'handler');
  assert.equal(upserts[0].create.publicationStatus, 'PUBLISHED');
  assert.deepEqual(upserts[0].create.supportedBackends, ['windows-msvc-x64']);
  assert.equal(audits[0].data.action, 'website.command.sync-manifest');
});

test('public command query is publication-scoped and clamps result size', async () => {
  let captured: any;
  const prisma = {
    websiteCommandReference: {
      findMany: async (args: any) => { captured ||= args; return []; },
      count: async () => 0
    }
  };
  const service = new WebsiteContentService(prisma as any);
  const result = await service.publicCommands({ query: '信息框', category: '窗口', limit: 999 });
  assert.equal(captured.where.publicationStatus, 'PUBLISHED');
  assert.equal(captured.where.category, '窗口');
  assert.equal(captured.take, 200);
  assert.equal(result.total, 0);
});

test('cloud API allows bounded manifest payloads larger than the Express default', () => {
  const source = requireSource('../src/main.ts');
  assert.match(source, /useBodyParser\('json', \{ limit: '5mb' \}\)/u);
});

test('r2 upload config is only served when both worker url and shared token are set', () => {
  const previous = { ...process.env };
  const service = new WebsiteContentService({} as any);
  try {
    delete process.env.R2_UPLOAD_WORKER_URL;
    delete process.env.R2_UPLOAD_TOKEN;
    assert.throws(() => service.r2UploadConfig(), /直链上传未配置/u);

    process.env.R2_UPLOAD_WORKER_URL = 'https://lingbuilder-r2-large-file-uploader.example.workers.dev/';
    process.env.R2_UPLOAD_TOKEN = '';
    assert.throws(() => service.r2UploadConfig(), /直链上传未配置/u);

    process.env.R2_UPLOAD_TOKEN = 'shared-upload-secret';
    assert.deepEqual(service.r2UploadConfig(), {
      ok: true,
      endpoint: 'https://lingbuilder-r2-large-file-uploader.example.workers.dev',
      token: 'shared-upload-secret',
    });
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});

test('admin site controller exposes r2 upload config only to writing roles', () => {
  const source = requireSource('../src/website/website-content.controller.ts');
  assert.match(source, /@Get\('r2-upload\/config'\) @Roles\('super_admin', 'operator'\)/u);
});

function latestVersionPrisma(release: any) {
  return latestVersionPrismaMany(release ? [release] : []);
}

function latestVersionPrismaMany(releases: any[]) {
  let captured: any;
  const prisma = {
    websiteDownloadRelease: {
      findMany: async (args: any) => { captured ||= args; return releases; }
    }
  };
  return { prisma, args: () => captured };
}

test('latest version returns installer direct link, sha256 and release notes', async () => {
  const { prisma, args } = latestVersionPrisma({
    version: '0.7.0', title: 'LingBuilder 0.7.0', summary: '新版本', publishedAt: '2026-09-01T00:00:00.000Z',
    channel: 'stable', fileSize: '85 MB',
    sha256: 'A'.repeat(32) + 'a'.repeat(32),
    releaseNotes: '修复若干问题。',
    mirrors: [
      { provider: 'direct', enabled: true, url: 'https://dl.lingbuilder.com/LingBuilder-0.7.0-x64.exe', sortOrder: 0 },
      { provider: '123pan', enabled: true, url: 'https://pan.example.com/s/xyz', sortOrder: 1 }
    ]
  });
  const service = new WebsiteContentService(prisma as any);
  const result: any = await service.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal(args().where.publicationStatus, 'PUBLISHED');
  assert.deepEqual(args().select.mirrors.where, { enabled: true, provider: 'direct' });
  assert.equal(result.available, true);
  assert.equal(result.downloadUrl, 'https://dl.lingbuilder.com/LingBuilder-0.7.0-x64.exe');
  assert.equal(result.sha256, ('A'.repeat(32) + 'a'.repeat(32)).toLowerCase());
  assert.equal(result.fileSize, '85 MB');
  assert.equal(result.releaseNotes, '修复若干问题。');
  assert.equal(result.channel, 'stable');
  assert.equal(result.version, '0.7.0');
});

test('latest version ignores disabled, non-direct and http direct mirrors', async () => {
  const { prisma } = latestVersionPrisma({
    version: '0.7.0', title: 't', summary: 's', publishedAt: null, channel: 'stable', fileSize: '', sha256: '', releaseNotes: '',
    mirrors: [
      { provider: 'direct', enabled: false, url: 'https://dl.lingbuilder.com/a.exe', sortOrder: 0 },
      { provider: 'baidu', enabled: true, url: 'https://pan.baidu.com/s/1', sortOrder: 1 },
      { provider: 'direct', enabled: true, url: 'http://dl.lingbuilder.com/b.exe', sortOrder: 2 }
    ]
  });
  const service = new WebsiteContentService(prisma as any);
  const result: any = await service.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal(result.downloadUrl, null);
  assert.equal(result.sha256, null);
  assert.equal(result.fileSize, null);
  assert.equal(result.releaseNotes, null);
  assert.equal(result.version, '0.7.0');
  assert.equal(result.title, 't');
});

test('latest version picks the first https direct mirror in query order', async () => {
  const { prisma } = latestVersionPrisma({
    version: '0.7.0', title: 't', summary: 's', publishedAt: null, channel: 'stable', fileSize: '', sha256: '', releaseNotes: '',
    mirrors: [
      { provider: 'direct', enabled: true, url: 'https://backup.lingbuilder.com/a.exe', sortOrder: 1 },
      { provider: 'direct', enabled: true, url: 'https://dl.lingbuilder.com/b.exe', sortOrder: 0 }
    ]
  });
  const service = new WebsiteContentService(prisma as any);
  const result: any = await service.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal(result.downloadUrl, 'https://backup.lingbuilder.com/a.exe');
});

test('latest version reports unavailable without leaking fields when no release is published', async () => {
  const { prisma } = latestVersionPrisma(null);
  const service = new WebsiteContentService(prisma as any);
  const result: any = await service.latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.deepEqual(result, { ok: true, available: false });
});

test('latest version picks the highest version number even when an older release has a larger sortOrder', async () => {
  const older = {
    version: '0.6.9', title: 'old', summary: '', publishedAt: '2026-09-10T00:00:00.000Z', channel: 'stable', fileSize: '', sha256: '', releaseNotes: '',
    mirrors: [{ provider: 'direct', enabled: true, url: 'https://dl.lingbuilder.com/old.exe', sortOrder: 0 }]
  };
  const newer = {
    version: '0.10.0', title: 'new', summary: '', publishedAt: '2026-09-01T00:00:00.000Z', channel: 'stable', fileSize: '', sha256: '', releaseNotes: '',
    mirrors: [{ provider: 'direct', enabled: true, url: 'https://dl.lingbuilder.com/new.exe', sortOrder: 0 }]
  };
  // Prisma 按 sortOrder desc / publishedAt desc 排序，旧版本排在前面；服务端必须改按版本号取最大。
  const { prisma } = latestVersionPrismaMany([older, newer]);
  const result: any = await new WebsiteContentService(prisma as any).latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal(result.version, '0.10.0');
  assert.equal(result.downloadUrl, 'https://dl.lingbuilder.com/new.exe');
});

test('latest version normalizes uppercase sha256 and rejects malformed values', async () => {
  const upper = await new WebsiteContentService(latestVersionPrisma({
    version: '0.7.0', title: 't', summary: 's', publishedAt: null, channel: 'stable', fileSize: '', sha256: 'ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789', releaseNotes: '', mirrors: []
  }).prisma as any).latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal((upper as any).sha256, 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');

  const malformed = await new WebsiteContentService(latestVersionPrisma({
    version: '0.7.0', title: 't', summary: 's', publishedAt: null, channel: 'stable', fileSize: '', sha256: 'not-a-hash', releaseNotes: '', mirrors: []
  }).prisma as any).latestVersion({ platform: 'Windows', architecture: 'x64', channel: 'stable' });
  assert.equal((malformed as any).sha256, null);
});

function requireSource(relativePath: string) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
