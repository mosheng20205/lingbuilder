import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertHttpsUpdaterUrl,
  assertUpdaterSizeWithinLimit,
  buildUpdaterFileName,
  createUpdaterAria2cArguments,
  describeAria2cExitMessage,
  describeUpdaterDownloadError,
  MAX_UPDATE_INSTALLER_BYTES,
  normalizeUpdaterSha256,
  parseContentLength,
  removeFileWithRetry,
  resolveBundledUpdaterAria2cPath,
  UpdateDownloadService,
  verifyInstallerSha256,
  type AppUpdateProgress,
  type UpdaterChildProcess
} from '../electron/updateDownloadService';
import type { VersionCheckResult } from '../electron/versionCheckService';

function checkResult(overrides: Partial<VersionCheckResult> = {}): VersionCheckResult {
  return {
    ok: true, currentVersion: '0.6.1', latestVersion: '9.9.9', hasUpdate: true,
    websiteUrl: 'https://lingbuilder.com',
    downloadUrl: 'https://dl.lingbuilder.com/LingBuilder-9.9.9-x64.exe',
    sha256: '', fileSize: '1 KB', releaseNotes: '测试更新。', channel: 'stable',
    ...overrides
  };
}

class FakeChild {
  handlers: Record<string, ((...args: any[]) => void) | null> = { error: null, close: null };
  stderr = { on: () => undefined };
  exitCode: number | null = null;
  killCalls: string[] = [];
  kill(signal?: NodeJS.Signals | number): boolean {
    this.killCalls.push(String(signal));
    this.emitClose(1);
    return true;
  }
  unref(): void { /* 测试无需处理 */ }
  once(event: 'error' | 'close', listener: (...args: any[]) => void): this {
    this.handlers[event] = listener;
    return this;
  }
  emitClose(code: number): void {
    this.exitCode = code;
    this.handlers.close?.(code, null);
  }
  emitError(error: Error): void {
    this.handlers.error?.(error);
  }
}

async function pollUntil(service: UpdateDownloadService, predicate: (progress: AppUpdateProgress) => boolean, timeoutMs = 8_000): Promise<AppUpdateProgress> {
  const startedAt = Date.now();
  for (;;) {
    const progress = service.status();
    if (predicate(progress)) return progress;
    if (Date.now() - startedAt > timeoutMs) throw new Error(`等待更新状态超时：${JSON.stringify(progress)}`);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

/** 在 resourcesPath 下放置伪造的 aria2c.exe，让服务选择 aria2c 引擎（内容无所谓，只做存在性探测）。 */
async function makeFakeAria2cAvailable(resourcesPath: string): Promise<void> {
  const exePath = path.join(resourcesPath, 'third_party', 'aria2', 'aria2c.exe');
  await fs.mkdir(path.dirname(exePath), { recursive: true });
  await fs.writeFile(exePath, 'fake-aria2c');
}

test('createUpdaterAria2cArguments enables segmented resumable download and appends url last', () => {
  const args = createUpdaterAria2cArguments('https://example.com/a.exe', String.raw`C:\tmp\LingBuilder-9.9.9-x64.exe.part`, 'http://127.0.0.1:7890');
  assert.ok(args.includes('--continue=true'));
  assert.ok(args.includes('--split=8'));
  assert.ok(args.includes('--max-connection-per-server=8'));
  assert.ok(args.includes('--min-split-size=8M'));
  assert.ok(args.includes('--check-certificate=true'));
  assert.ok(args.includes('--all-proxy=http://127.0.0.1:7890'));
  assert.equal(args[args.length - 1], 'https://example.com/a.exe');
  assert.ok(args.some(item => item.startsWith('--out=LingBuilder-9.9.9-x64.exe.part')));
});

test('resolveBundledUpdaterAria2cPath follows packaged resources and dev layout', () => {
  assert.equal(resolveBundledUpdaterAria2cPath(true, String.raw`C:\app\resources`), path.join(String.raw`C:\app\resources`, 'third_party', 'aria2', 'aria2c.exe'));
  assert.equal(resolveBundledUpdaterAria2cPath(false, undefined, String.raw`D:\repo\electron`), path.join(String.raw`D:\repo\electron`, 'third_party', 'aria2', 'aria2c.exe'));
});

test('assertHttpsUpdaterUrl rejects non-https urls and allows localhost only in dev mode', () => {
  assert.throws(() => assertHttpsUpdaterUrl('http://dl.lingbuilder.com/a.exe'), /必须使用 HTTPS/u);
  assert.throws(() => assertHttpsUpdaterUrl('ftp://dl.lingbuilder.com/a.exe'), /必须使用 HTTPS/u);
  assert.throws(() => assertHttpsUpdaterUrl(''), /下载地址为空/u);
  assert.equal(assertHttpsUpdaterUrl('https://dl.lingbuilder.com/a.exe'), 'https://dl.lingbuilder.com/a.exe');
  assert.equal(assertHttpsUpdaterUrl('http://127.0.0.1:8899/a.exe', true), 'http://127.0.0.1:8899/a.exe');
  assert.throws(() => assertHttpsUpdaterUrl('http://127.0.0.1:8899/a.exe', false), /必须使用 HTTPS/u);
});

test('parseContentLength and size limit guard the installer download', () => {
  assert.equal(parseContentLength('123'), 123);
  assert.equal(parseContentLength(null), null);
  assert.equal(parseContentLength('abc'), null);
  assert.equal(parseContentLength('0'), null);
  assert.doesNotThrow(() => assertUpdaterSizeWithinLimit(MAX_UPDATE_INSTALLER_BYTES));
  assert.throws(() => assertUpdaterSizeWithinLimit(MAX_UPDATE_INSTALLER_BYTES + 1), /2GB 上限/u);
  assert.throws(() => assertUpdaterSizeWithinLimit(0), /大小信息无效/u);
});

test('normalizeUpdaterSha256, file name and exit code messages', () => {
  assert.equal(normalizeUpdaterSha256('ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789'), 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789');
  assert.equal(normalizeUpdaterSha256('nope'), null);
  assert.equal(buildUpdaterFileName('1.2.3'), 'LingBuilder-1.2.3-x64.exe');
  assert.equal(describeAria2cExitMessage(6), '网络连接失败');
  assert.equal(describeAria2cExitMessage(null), null);
});

test('describeUpdaterDownloadError translates common network failures into Chinese guidance', () => {
  const translated = describeUpdaterDownloadError('getaddrinfo ENOTFOUND dl.lingbuilder.com');
  assert.match(translated, /更新包下载失败（下载服务器域名无法解析）/u);
  assert.match(describeUpdaterDownloadError('connect ETIMEDOUT 1.2.3.4:443'), /连接超时/u);
  assert.equal(describeUpdaterDownloadError('普通错误'), '普通错误');
});

test('verifyInstallerSha256 matches stream hash and removeFileWithRetry deletes files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  try {
    const target = path.join(dir, 'payload.bin');
    const payload = crypto.randomBytes(4096);
    await fs.writeFile(target, payload);
    const digest = crypto.createHash('sha256').update(payload).digest('hex');
    assert.equal(await verifyInstallerSha256(target, digest), true);
    assert.equal(await verifyInstallerSha256(target, '0'.repeat(64)), false);
    assert.equal(await verifyInstallerSha256(path.join(dir, 'missing.bin'), digest), false);
    await removeFileWithRetry(target);
    await assert.rejects(fs.access(target));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download refuses installers without checksum or with non-https url when packaged', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  try {
    const service = new UpdateDownloadService({ updatesDir: dir, isPackaged: true });
    const noSha = await service.download(checkResult({ sha256: null }));
    assert.equal(noSha.ok, false);
    assert.match(noSha.error || '', /不支持应用内下载/u);

    const httpUrl = await service.download(checkResult({ downloadUrl: 'http://dl.lingbuilder.com/a.exe', sha256: 'a'.repeat(64) }));
    assert.equal(httpUrl.ok, false);
    assert.match(httpUrl.error || '', /必须使用 HTTPS/u);

    const noUrl = await service.download(checkResult({ downloadUrl: null, sha256: 'a'.repeat(64) }));
    assert.equal(noUrl.ok, false);
    assert.match(noUrl.error || '', /未提供安装包直链/u);
    assert.equal(service.isBusy(), false);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download runs full aria2c flow to a verified installer and install launches it', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  const payload = crypto.randomBytes(96 * 1024);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const spawned: Array<{ command: string; args: string[] }> = [];
  const resourcesPath = path.join(dir, 'resources');
  await makeFakeAria2cAvailable(resourcesPath);
  try {
    const fetchImpl = (async (url: any, init: any) => {
      if (init?.method === 'HEAD') {
        return new Response(null, { status: 200, headers: { 'content-length': String(payload.length) } }) as any;
      }
      return new Response(payload) as any;
    }) as typeof fetch;
    const spawnImpl = ((command: string, args: string[]) => {
      spawned.push({ command, args });
      const child = new FakeChild();
      setTimeout(() => {
        const out = args.find(item => item.startsWith('--out='))?.slice('--out='.length) || '';
        const dirArg = args.find(item => item.startsWith('--dir='))?.slice('--dir='.length) || '';
        void fs.writeFile(path.join(dirArg, out), payload).then(() => child.emitClose(0));
      }, 10);
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const service = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath,
      fetchImpl, spawnImpl,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    const start = await service.download(checkResult({ sha256: digest }));
    assert.equal(start.ok, true);
    const progress = await pollUntil(service, item => item.state === 'ready' || item.state === 'error');
    assert.equal(progress.state, 'ready', progress.error);
    assert.equal(spawned.length, 1);
    assert.match(spawned[0].command, /aria2c\.exe$/u);
    const installerPath = progress.installerPath || '';
    assert.equal(path.basename(installerPath), 'LingBuilder-9.9.9-x64.exe');
    await assert.rejects(fs.access(`${installerPath}.part`));

    const notReady = await new UpdateDownloadService({ updatesDir: path.join(dir, 'other'), isPackaged: true }).install();
    assert.equal(notReady.ok, false);

    let spawnedInstaller = false;
    const installSpawn = ((command: string) => {
      spawnedInstaller = command === installerPath;
      const child = new FakeChild();
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const installerService = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath: path.join(dir, 'resources'),
      fetchImpl, spawnImpl: installSpawn,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    const ready = await installerService.download(checkResult({ sha256: digest }));
    assert.equal(ready.alreadyDownloaded, true);
    const installResult = await installerService.install();
    assert.equal(installResult.ok, true);
    assert.equal(installerService.status().state, 'launching');
    assert.equal(spawnedInstaller, true);

    const failSpawn = ((_command: string) => {
      const child = new FakeChild();
      setTimeout(() => child.emitError(new Error('EACCES')), 5);
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const failing = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath: path.join(dir, 'resources'),
      fetchImpl, spawnImpl: failSpawn,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    await failing.download(checkResult({ sha256: digest }));
    const failed = await failing.install();
    assert.equal(failed.ok, false);
    assert.match(failed.error || '', /无法启动安装程序.*手动运行/u);
    assert.equal(failing.status().state, 'error');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download keeps partial file with Chinese diagnostics when aria2c exits non-zero', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  const payload = crypto.randomBytes(32 * 1024);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const resourcesPath = path.join(dir, 'resources');
  await makeFakeAria2cAvailable(resourcesPath);
  try {
    const fetchImpl = (async () => new Response(null, { status: 200, headers: { 'content-length': String(payload.length) } })) as typeof fetch;
    const spawnImpl = ((_command: string, args: string[]) => {
      const child = new FakeChild();
      setTimeout(() => {
        const out = args.find(item => item.startsWith('--out='))?.slice('--out='.length) || '';
        const dirArg = args.find(item => item.startsWith('--dir='))?.slice('--dir='.length) || '';
        void fs.writeFile(path.join(dirArg, out), payload.subarray(0, 1024)).then(() => child.emitClose(6));
      }, 10);
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const service = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath,
      fetchImpl, spawnImpl,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    await service.download(checkResult({ sha256: digest }));
    const progress = await pollUntil(service, item => item.state === 'error' || item.state === 'ready');
    assert.equal(progress.state, 'error');
    assert.match(progress.error || '', /aria2c 下载未完成：网络连接失败.*退出码 6/u);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download reports checksum mismatch as blocking error and removes the payload', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  const payload = crypto.randomBytes(16 * 1024);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const resourcesPath = path.join(dir, 'resources');
  await makeFakeAria2cAvailable(resourcesPath);
  try {
    const fetchImpl = (async (url: any, init: any) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(payload.length) } }) as any;
      return new Response(payload) as any;
    }) as typeof fetch;
    const spawnImpl = ((_command: string, args: string[]) => {
      const child = new FakeChild();
      setTimeout(() => {
        const out = args.find(item => item.startsWith('--out='))?.slice('--out='.length) || '';
        const dirArg = args.find(item => item.startsWith('--dir='))?.slice('--dir='.length) || '';
        void fs.writeFile(path.join(dirArg, out), Buffer.from('corrupted')).then(() => child.emitClose(0));
      }, 10);
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const service = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath,
      fetchImpl, spawnImpl,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    await service.download(checkResult({ sha256: digest }));
    const progress = await pollUntil(service, item => item.state === 'error' || item.state === 'ready');
    assert.equal(progress.state, 'error');
    assert.match(progress.error || '', /SHA-256 校验失败/u);
    await assert.rejects(fs.access(path.join(updatesDir, 'LingBuilder-9.9.9-x64.exe')));
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('download falls back to single-stream fetch when bundled aria2c is missing', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  const payload = crypto.randomBytes(48 * 1024);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  try {
    const fetchImpl = (async (url: any, init: any) => {
      if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(payload.length) } }) as any;
      return new Response(payload) as any;
    }) as typeof fetch;
    const spawnImpl = (() => {
      throw new Error('aria2c should not be spawned in fetch fallback');
    }) as unknown as typeof spawn;
    const service = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath: path.join(dir, 'missing-resources'),
      fetchImpl, spawnImpl,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    const start = await service.download(checkResult({ sha256: digest }));
    assert.equal(start.ok, true);
    const progress = await pollUntil(service, item => item.state === 'ready' || item.state === 'error');
    assert.equal(progress.state, 'ready', progress.error);
    assert.equal(await verifyInstallerSha256(progress.installerPath || '', digest), true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('cancel aborts an active download, cleans partial files and returns to idle', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  const payload = crypto.randomBytes(64 * 1024);
  const digest = crypto.createHash('sha256').update(payload).digest('hex');
  const resourcesPath = path.join(dir, 'resources');
  await makeFakeAria2cAvailable(resourcesPath);
  try {
    const fetchImpl = (async (_url: any, init: any) => new Response(null, { status: 200, headers: { 'content-length': String(payload.length) } })) as typeof fetch;
    let spawnedChild: FakeChild | null = null;
    const spawnImpl = ((_command: string, args: string[]) => {
      const child = new FakeChild();
      spawnedChild = child;
      setTimeout(() => {
        const out = args.find(item => item.startsWith('--out='))?.slice('--out='.length) || '';
        const dirArg = args.find(item => item.startsWith('--dir='))?.slice('--dir='.length) || '';
        void fs.writeFile(path.join(dirArg, out), payload.subarray(0, 2048)).catch(() => undefined);
      }, 10);
      return child as unknown as UpdaterChildProcess;
    }) as unknown as typeof spawn;
    const service = new UpdateDownloadService({
      updatesDir, isPackaged: true,
      resourcesPath,
      fetchImpl, spawnImpl,
      execFileImpl: async () => { throw new Error('no reg'); }
    });
    const start = await service.download(checkResult({ sha256: digest }));
    assert.equal(start.ok, true);
    await pollUntil(service, item => item.state === 'downloading' && (item.downloadedBytes > 0 || item.engine === 'aria2c'), 3_000);
    assert.equal(service.cancel(), true);
    const progress = await pollUntil(service, item => item.state === 'idle');
    assert.match(progress.message || '', /已取消下载/u);
    assert.notEqual(spawnedChild, null);
    assert.ok((spawnedChild as FakeChild).killCalls.length >= 1);
    await assert.rejects(fs.access(path.join(updatesDir, 'LingBuilder-9.9.9-x64.exe.part')));

    assert.equal(service.cancel(), false);
    const second = await service.download(checkResult({ sha256: digest }));
    assert.equal(second.ok, true);
    service.cancel();
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('cleanupAbandoned removes leftover update files', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-update-'));
  const updatesDir = path.join(dir, 'updates');
  await fs.mkdir(updatesDir, { recursive: true });
  await fs.writeFile(path.join(updatesDir, 'LingBuilder-9.9.9-x64.exe'), 'stale');
  const service = new UpdateDownloadService({ updatesDir, isPackaged: true });
  await service.cleanupAbandoned();
  await assert.rejects(fs.access(updatesDir));
  await fs.rm(dir, { recursive: true, force: true });
});
