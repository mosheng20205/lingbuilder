import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { resolveSdkCacheRoot } from '../src/services/sdkDependencies/sdkDependencyCatalog';
import {
  describeSdkCacheMigration,
  legacySdkCacheRoots,
  migrateLegacySdkCaches
} from '../src/services/sdkDependencies/sdkCacheMigration';

async function makeTempDir(prefix: string): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function writeModule(root: string, moduleId: string, files: Record<string, string>): Promise<string> {
  const moduleDir = path.join(root, 'modules', moduleId);
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(moduleDir, ...relativePath.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, 'utf8');
  }
  return moduleDir;
}

test('旧缓存里的已装 SDK 模块整体迁入机器级目录，源目录消失', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const legacy = await makeTempDir('sdk-mig-legacy-');
  try {
    await writeModule(legacy, 'lingbuilder.fbro.sdk', {
      'lingbuilder.module.json': '{"schemaVersion":2,"id":"lingbuilder.fbro.sdk","version":"135.0.21.2.9.3"}',
      '.lingbuilder-sdk-install.json': '{"schemaVersion":1,"version":"135.0.21.2.9.3"}',
      'sdk/runtime-manifest.json': '{}'
    });
    const result = await migrateLegacySdkCaches(target, [legacy]);
    assert.deepEqual(result.migrated, ['lingbuilder.fbro.sdk']);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.failed, []);
    const manifest = JSON.parse(await fs.readFile(
      path.join(target, 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json'),
      'utf8'
    ));
    assert.equal(manifest.version, '135.0.21.2.9.3');
    await assert.rejects(fs.access(path.join(legacy, 'modules', 'lingbuilder.fbro.sdk')));
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  }
});

test('目标已有同名模块时跳过且绝不覆盖', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const legacy = await makeTempDir('sdk-mig-legacy-');
  try {
    await writeModule(target, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{"version":"new"}' });
    await writeModule(legacy, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{"version":"old"}' });
    const result = await migrateLegacySdkCaches(target, [legacy]);
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, ['lingbuilder.fbro.sdk']);
    assert.equal(
      JSON.parse(await fs.readFile(path.join(target, 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json'), 'utf8')).version,
      'new'
    );
    assert.equal(
      JSON.parse(await fs.readFile(path.join(legacy, 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json'), 'utf8')).version,
      'old'
    );
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  }
});

test('多旧缓存根按优先级各归其源，同模块先到先得', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const newer = await makeTempDir('sdk-mig-newer-');
  const older = await makeTempDir('sdk-mig-older-');
  try {
    await writeModule(newer, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{"version":"2.9.3"}' });
    await writeModule(newer, 'lingbuilder.cef3.sdk', { 'lingbuilder.module.json': '{"version":"150"}' });
    await writeModule(older, 'lingbuilder.cef3.sdk', { 'lingbuilder.module.json': '{"version":"150"}' });
    await writeModule(older, 'lingbuilder.sunnynet.sdk', { 'lingbuilder.module.json': '{"version":"1.5.1"}' });
    const result = await migrateLegacySdkCaches(target, [newer, older]);
    assert.deepEqual(result.migrated.sort(), ['lingbuilder.cef3.sdk', 'lingbuilder.fbro.sdk', 'lingbuilder.sunnynet.sdk']);
    assert.deepEqual(result.failed, []);
    // 同模块两个源都有时优先级靠前的胜出，靠后的原地残留。
    await fs.access(path.join(target, 'modules', 'lingbuilder.cef3.sdk', 'lingbuilder.module.json'));
    await fs.access(path.join(older, 'modules', 'lingbuilder.cef3.sdk', 'lingbuilder.module.json'));
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(newer, { recursive: true, force: true });
    await fs.rm(older, { recursive: true, force: true });
  }
});

test('跨盘 EXDEV 记为 failed 且不阻断其余模块', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const legacy = await makeTempDir('sdk-mig-legacy-');
  try {
    await writeModule(legacy, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{}' });
    await writeModule(legacy, 'lingbuilder.cef3.sdk', { 'lingbuilder.module.json': '{}' });
    const result = await migrateLegacySdkCaches(target, [legacy], {
      rename: async () => {
        const error = new Error('cross-device link') as NodeJS.ErrnoException;
        error.code = 'EXDEV';
        throw error;
      }
    });
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, []);
    assert.equal(result.failed.length, 2);
    assert.match(result.failed[0].reason, /同一磁盘卷/u);
    // 失败的模块不能在目标留下半成品。
    await fs.access(path.join(target, 'modules'));
    assert.equal((await fs.readdir(path.join(target, 'modules'))).length, 0);
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  }
});

test('并发实例先迁走时（rename ENOENT 且源已消失）视为 skipped', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const legacy = await makeTempDir('sdk-mig-legacy-');
  try {
    await writeModule(legacy, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{}' });
    const result = await migrateLegacySdkCaches(target, [legacy], {
      rename: async () => {
        await fs.rm(path.join(legacy, 'modules', 'lingbuilder.fbro.sdk'), { recursive: true, force: true });
        const error = new Error('no such file or directory') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      }
    });
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, ['lingbuilder.fbro.sdk']);
    assert.deepEqual(result.failed, []);
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  }
});

test('目标与旧根是同一目录（含大小写/分隔符差异）时不做任何迁移', async () => {
  const target = await makeTempDir('sdk-mig-same-');
  try {
    await writeModule(target, 'lingbuilder.fbro.sdk', { 'lingbuilder.module.json': '{}' });
    const result = await migrateLegacySdkCaches(target, [target, `${target}${path.sep}`]);
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.failed, []);
    await fs.access(path.join(target, 'modules', 'lingbuilder.fbro.sdk', 'lingbuilder.module.json'));
  } finally {
    await fs.rm(target, { recursive: true, force: true });
  }
});

test('modules 下的散文件与下载临时物不参与迁移', async () => {
  const target = await makeTempDir('sdk-mig-target-');
  const legacy = await makeTempDir('sdk-mig-legacy-');
  try {
    await fs.mkdir(path.join(legacy, 'modules'), { recursive: true });
    await fs.writeFile(path.join(legacy, 'modules', 'loose-file.txt'), 'junk', 'utf8');
    await fs.mkdir(path.join(legacy, 'downloads'), { recursive: true });
    await fs.writeFile(path.join(legacy, 'downloads', 'archive.zip.part'), 'partial', 'utf8');
    const result = await migrateLegacySdkCaches(target, [legacy]);
    assert.deepEqual(result.migrated, []);
    assert.deepEqual(result.skipped, []);
    assert.deepEqual(result.failed, []);
  } finally {
    await fs.rm(target, { recursive: true, force: true });
    await fs.rm(legacy, { recursive: true, force: true });
  }
});

test('legacySdkCacheRoots 只在 win32 返回两个旧目录，显式顺序为主实例优先', () => {
  const environment = { APPDATA: 'C:\\Users\\u\\AppData\\Roaming' } as unknown as NodeJS.ProcessEnv;
  assert.deepEqual(legacySdkCacheRoots(environment, 'win32'), [
    'C:\\Users\\u\\AppData\\Roaming\\lingbuilder-electron\\sdk-cache',
    'C:\\Users\\u\\AppData\\Roaming\\LingBuilder\\sdk-cache'
  ]);
  assert.deepEqual(legacySdkCacheRoots(environment, 'linux'), []);
  assert.deepEqual(legacySdkCacheRoots(environment, 'darwin'), []);
});

test('resolveSdkCacheRoot 默认解析到机器级 LOCALAPPDATA 目录，显式环境变量仍然优先', () => {
  const environment = {
    LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local',
    LINGBUILDER_SDK_CACHE_ROOT: ''
  } as unknown as NodeJS.ProcessEnv;
  assert.equal(resolveSdkCacheRoot(environment), path.join('C:\\Users\\u\\AppData\\Local', 'LingBuilder', 'sdk-cache'));
  assert.equal(
    resolveSdkCacheRoot({ ...environment, LINGBUILDER_SDK_CACHE_ROOT: 'D:\\custom\\cache' } as unknown as NodeJS.ProcessEnv),
    path.resolve('D:\\custom\\cache')
  );
  assert.throws(() => resolveSdkCacheRoot({ ...environment, LINGBUILDER_SDK_CACHE_ROOT: 'relative/path' } as unknown as NodeJS.ProcessEnv), /绝对路径/u);
});

test('describeSdkCacheMigration 只输出有迁移与失败时的中文诊断', () => {
  const base = { targetRoot: 'T:\\cache', migrated: [], skipped: ['x'], failed: [] };
  assert.deepEqual(describeSdkCacheMigration(base), []);
  const lines = describeSdkCacheMigration({
    ...base,
    migrated: ['lingbuilder.fbro.sdk'],
    failed: [{ moduleId: 'lingbuilder.cef3.sdk', sourceRoot: 'C:\\old', reason: '跨盘' }]
  });
  assert.equal(lines.length, 2);
  assert.match(lines[0], /已迁移 lingbuilder\.fbro\.sdk/);
  assert.match(lines[1], /迁移 lingbuilder\.cef3\.sdk 失败/);
});
