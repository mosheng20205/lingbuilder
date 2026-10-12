import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  CLOUD_REFRESH_TOKEN_FILE_NAME,
  clearSharedCredential,
  migrateLegacyCloudCredentialIfNeeded,
  readSharedCredentialBytes,
  resolveSharedCloudCredentialDir,
  withCloudCredentialLock,
  writeSharedCredentialBytes
} from '../electron/cloudCredentialStore.ts';

async function temporaryDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-cloud-credential-'));
}

test('共享凭据目录按渠道分片：Windows 走 LOCALAPPDATA，其余平台走状态目录', () => {
  if (process.platform === 'win32') {
    const packaged = resolveSharedCloudCredentialDir(true, { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' } as never);
    const dev = resolveSharedCloudCredentialDir(false, { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local' } as never);
    assert.equal(packaged, path.join('C:\\Users\\u\\AppData\\Local', 'LingBuilder', 'credentials', 'packaged'));
    assert.equal(dev, path.join('C:\\Users\\u\\AppData\\Local', 'LingBuilder', 'credentials', 'dev'));
    // LOCALAPPDATA 缺失时回退用户目录，不允许抛错（AI Bridge/服务端环境可能没有该变量）。
    const fallback = resolveSharedCloudCredentialDir(true, {} as never);
    assert.ok(path.isAbsolute(fallback));
    assert.ok(fallback.endsWith(path.join('credentials', 'packaged')));
  } else {
    const dev = resolveSharedCloudCredentialDir(false, {} as never);
    assert.ok(dev.endsWith(path.join('credentials', 'dev')));
  }
  // 显式覆盖环境变量（测试/冒烟隔离用）：绝对路径生效，相对路径拒绝。
  const explicit = resolveSharedCloudCredentialDir(true, { LINGBUILDER_CLOUD_CREDENTIAL_DIR: os.tmpdir() } as never);
  assert.equal(path.resolve(explicit), path.resolve(os.tmpdir()));
  assert.throws(
    () => resolveSharedCloudCredentialDir(true, { LINGBUILDER_CLOUD_CREDENTIAL_DIR: 'relative/path' } as never),
    /必须是绝对路径/u
  );
});

test('共享凭据原子写入、读取与清除', async () => {
  const dir = await temporaryDir();
  try {
    assert.equal(await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME), null);
    await writeSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME, Buffer.from('encrypted-bytes'));
    assert.equal((await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME))?.toString('utf8'), 'encrypted-bytes');
    // 覆盖写不留临时文件。
    await writeSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME, Buffer.from('rotated-bytes'));
    assert.equal((await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME))?.toString('utf8'), 'rotated-bytes');
    assert.deepEqual((await fs.readdir(dir)).filter(name => name.endsWith('.tmp')), []);
    await clearSharedCredential(dir, CLOUD_REFRESH_TOKEN_FILE_NAME);
    assert.equal(await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME), null);
    // 清除不存在的文件静默成功。
    await clearSharedCredential(dir, CLOUD_REFRESH_TOKEN_FILE_NAME);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('跨进程锁互斥：并发临界区绝不交错，退出后锁文件清理', async () => {
  const dir = await temporaryDir();
  try {
    const timeline: string[] = [];
    const work = (name: string, delayMs: number) => async () => {
      timeline.push(`${name}:start`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      timeline.push(`${name}:end`);
    };
    await Promise.all([
      withCloudCredentialLock(dir, work('a', 40)),
      withCloudCredentialLock(dir, work('b', 10))
    ]);
    const aStart = timeline.indexOf('a:start');
    const aEnd = timeline.indexOf('a:end');
    const bStart = timeline.indexOf('b:start');
    const bEnd = timeline.indexOf('b:end');
    assert.ok(aStart >= 0 && aEnd > aStart && bStart >= 0 && bEnd > bStart, `时间线异常：${timeline.join(' ')}`);
    const [first, second] = aStart < bStart ? [['a', aStart, aEnd], ['b', bStart, bEnd]] : [['b', bStart, bEnd], ['a', aStart, aEnd]];
    assert.ok(second[1] > first[2], `临界区必须串行：${timeline.join(' ')}`);
    assert.deepEqual(await fs.readdir(dir), [], '锁退出后目录里不得残留锁文件');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('跨进程锁：陈旧锁被强行接管，持锁中的锁等待超时报中文错误', async () => {
  const dir = await temporaryDir();
  try {
    // 残留锁 mtime 拨旧 → 视为持锁实例崩溃，直接接管。
    const lockPath = path.join(dir, 'cloud-refresh-token.lock');
    await fs.writeFile(lockPath, '{"pid": 1}');
    const staleMoment = new Date(Date.now() - 60_000);
    await fs.utimes(lockPath, staleMoment, staleMoment);
    await withCloudCredentialLock(dir, async () => 'recovered', { staleMs: 15_000, timeoutMs: 500 });
    assert.ok(true);

    // 新鲜锁（他人持锁）→ 等待超时必须报错而不是无锁继续：无锁刷新等于把同一刷新令牌并发双发。
    await fs.writeFile(lockPath, '{"pid": 999999}');
    await assert.rejects(
      withCloudCredentialLock(dir, async () => 'never', { staleMs: 60_000, timeoutMs: 200, retryIntervalMs: 20 }),
      /另一个 LingBuilder 实例/u
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('旧 userData 凭据迁移：move 语义防复活，共享已有或旧文件缺失时不动', async () => {
  const dir = await temporaryDir();
  const legacyDir = await temporaryDir();
  try {
    // 场景一：legacy 存在且共享缺失 → 迁移并删除旧文件（防止已退出/已轮换令牌被其他实例复活）。
    const legacyPath = path.join(legacyDir, 'credentials', 'cloud-refresh-token.bin');
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, 'legacy-encrypted');
    assert.equal(await migrateLegacyCloudCredentialIfNeeded(dir, legacyPath), true);
    assert.equal((await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME))?.toString('utf8'), 'legacy-encrypted');
    await assert.rejects(fs.readFile(legacyPath), '迁移必须删除旧文件');

    // 场景二：共享已有 → 不迁移，不覆盖既有凭据。
    await fs.writeFile(legacyPath, 'another-legacy');
    assert.equal(await migrateLegacyCloudCredentialIfNeeded(dir, legacyPath), false);
    assert.equal((await readSharedCredentialBytes(dir, CLOUD_REFRESH_TOKEN_FILE_NAME))?.toString('utf8'), 'legacy-encrypted');

    // 场景三：旧文件缺失 → 静默跳过（含退出登录清空后的例行读取路径）。
    await fs.rm(legacyPath, { force: true });
    assert.equal(await migrateLegacyCloudCredentialIfNeeded(dir, legacyPath), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
    await fs.rm(legacyDir, { recursive: true, force: true });
  }
});
