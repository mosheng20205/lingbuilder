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

function requireSource(relativePath: string) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8');
}
