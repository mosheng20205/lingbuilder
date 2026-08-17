import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  SdkDependencyRequiredError,
  SdkDependencyService,
  ARIA2C_CONNECTIONS,
  ARIA2C_MIN_SPLIT_SIZE,
  createAria2cArguments,
  inspectZipArchive,
  waitForAria2cExitOrVerifiedArchive,
  type Aria2cDownloadProcess,
  type SdkDependencyJobSnapshot
} from '../src/services/sdkDependencies/sdkDependencyService';
import {
  getRequiredSdkDependencyIds,
  SDK_DEPENDENCY_RESOURCES,
  type SdkDependencyResource
} from '../src/services/sdkDependencies/sdkDependencyCatalog';

test('SDK 资源清单固定使用 HTTPS、精确大小和 SHA-256', () => {
  assert.deepEqual(SDK_DEPENDENCY_RESOURCES.map(item => item.id), ['cef3', 'fbro']);
  for (const resource of SDK_DEPENDENCY_RESOURCES) {
    assert.match(resource.downloadUrl, /^https:\/\//u);
    assert.ok(resource.archiveBytes > 100 * 1024 * 1024);
    assert.match(resource.sha256, /^[a-f0-9]{64}$/u);
    assert.ok(resource.criticalFiles.length >= 7);
  }
  assert.deepEqual(getRequiredSdkDependencyIds(['lingbuilder.win32.basic']), []);
  assert.deepEqual(getRequiredSdkDependencyIds(['lingbuilder.cef3.browser']), ['cef3']);
  assert.deepEqual(getRequiredSdkDependencyIds(['lingbuilder.fbro.browser']), ['fbro']);
});

test('SDK 下载使用 aria2c 多连接、分段和断点续传参数', () => {
  const url = 'https://example.invalid/sdk.zip';
  const destination = path.join('C:\\sdk-cache', 'sdk.zip.part');
  const args = createAria2cArguments(url, destination);
  assert.ok(args.includes('--continue=true'));
  assert.ok(args.includes(`--max-connection-per-server=${ARIA2C_CONNECTIONS}`));
  assert.ok(args.includes(`--split=${ARIA2C_CONNECTIONS}`));
  assert.ok(args.includes(`--min-split-size=${ARIA2C_MIN_SPLIT_SIZE}`));
  assert.ok(args.includes('--file-allocation=none'));
  assert.ok(args.includes(`--dir=${path.dirname(destination)}`));
  assert.ok(args.includes(`--out=${path.basename(destination)}`));
  assert.equal(args.at(-1), url);
});

test('完整归档通过 SHA-256 后等待 aria2c 退出再继续', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-complete-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archive = Buffer.from('verified-archive', 'utf8');
  const destination = path.join(root, 'sdk.zip.part');
  await fs.writeFile(destination, archive);
  const child = new HangingAria2cProcess();
  const result = await waitForAria2cExitOrVerifiedArchive(
    child,
    destination,
    archive.length,
    createHash('sha256').update(archive).digest('hex'),
    new AbortController().signal,
    { verificationIntervalMs: 1, terminationGraceMs: 100 }
  );
  assert.equal(result.archiveVerified, true);
  assert.equal(result.exitCode, 1);
  assert.equal(child.killCalls, 1);
});

test('aria2c 在已验证归档后不退出时会强制终止并报告失败', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-no-close-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archive = Buffer.from('verified-archive', 'utf8');
  const destination = path.join(root, 'sdk.zip.part');
  await fs.writeFile(destination, archive);
  const child = new NeverClosingAria2cProcess();
  await assert.rejects(
    waitForAria2cExitOrVerifiedArchive(
      child,
      destination,
      archive.length,
      createHash('sha256').update(archive).digest('hex'),
      new AbortController().signal,
      { verificationIntervalMs: 1, terminationGraceMs: 100 }
    ),
    /未能在终止后退出/u
  );
  assert.equal(child.killCalls, 2);
});

test('已取消的下载信号会立即终止 aria2c 并等待退出', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-aborted-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const controller = new AbortController();
  controller.abort();
  const child = new HangingAria2cProcess();
  await assert.rejects(
    waitForAria2cExitOrVerifiedArchive(
      child,
      path.join(root, 'sdk.zip.part'),
      1,
      '0'.repeat(64),
      controller.signal,
      { terminationGraceMs: 100 }
    ),
    error => error instanceof DOMException && error.name === 'AbortError'
  );
  assert.equal(child.killCalls, 1);
});

test('aria2c 非零退出时仍等待正在进行的 SHA-256 校验', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-aria2-close-race-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archive = Buffer.alloc(8 * 1024 * 1024, 0x5A);
  const destination = path.join(root, 'sdk.zip.part');
  await fs.writeFile(destination, archive);
  const child = new ManualAria2cProcess();
  const completion = waitForAria2cExitOrVerifiedArchive(
    child,
    destination,
    archive.length,
    createHash('sha256').update(archive).digest('hex'),
    new AbortController().signal,
    { verificationIntervalMs: 1, terminationGraceMs: 100 }
  );
  child.close(1, null);
  const result = await completion;
  assert.equal(result.archiveVerified, true);
  assert.equal(result.exitCode, 1);
});

test('FBro runtime 的受控最小体积不会超过已签名归档中的 libcef.dll', () => {
  const fbro = SDK_DEPENDENCY_RESOURCES.find(item => item.id === 'fbro');
  assert.ok(fbro);
  const libcef = fbro.criticalFiles.find(item => item.relativePath === 'runtime/x64/libcef.dll');
  assert.ok(libcef);
  assert.ok(libcef.minimumBytes >= 200 * 1024 * 1024);
  assert.ok(libcef.minimumBytes <= 246_742_016);
});

test('实际上传 ZIP 的中央目录与受控资源清单一致', async () => {
  const packageRoot = path.resolve(import.meta.dirname, '../../output/cloud-sdk-packages-2026-08-13');
  for (const resource of SDK_DEPENDENCY_RESOURCES) {
    const inventory = await inspectZipArchive(path.join(packageRoot, resource.archiveName));
    assert.deepEqual(inventory.roots, [resource.moduleId]);
    assert.equal(inventory.fileCount, resource.fileCount);
    assert.equal(inventory.expandedBytes, resource.expandedBytes);
  }
});

test('普通 Win32 不触发 SDK 门禁，FBro 项目返回结构化缺失依赖', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-gate-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new SdkDependencyService({ cacheRoot: root, workspaceRoot: () => root, platform: 'win32' });
  await service.requireForModules(['lingbuilder.win32.basic']);
  await assert.rejects(
    service.requireForModules(['lingbuilder.fbro.browser']),
    (error: unknown) => error instanceof SdkDependencyRequiredError
      && error.code === 'SDK_DEPENDENCY_REQUIRED'
      && error.dependencies[0]?.id === 'fbro'
  );
});

test('SDK 下载通过校验和原子安装后可从共享缓存识别', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-install-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const archive = Buffer.from('controlled-test-archive', 'utf8');
  const manifest = `${JSON.stringify({ schemaVersion: 2, id: 'lingbuilder.fbro.sdk', version: 'test-1' })}\n`;
  const header = 'bridge-header';
  const expandedBytes = Buffer.byteLength(manifest) + Buffer.byteLength(header);
  const resource: SdkDependencyResource = {
    id: 'fbro', moduleId: 'lingbuilder.fbro.sdk', name: '测试 FBro SDK', version: 'test-1', sdkVersion: 'test-1',
    platform: 'windows-x64', archiveName: 'fbro-test.zip', downloadUrl: 'https://example.invalid/fbro-test.zip',
    archiveBytes: archive.length, expandedBytes, fileCount: 2,
    sha256: createHash('sha256').update(archive).digest('hex'),
    requiredModuleIds: ['lingbuilder.fbro.browser'],
    criticalFiles: [{ relativePath: 'include/LingBuilderFbroBridge.h', minimumBytes: header.length }]
  };
  const service = new SdkDependencyService({
    cacheRoot: root,
    workspaceRoot: () => root,
    platform: 'win32',
    resources: [resource],
    download: async (_url, destination, _expected, _expectedSha256, _signal, onProgress) => {
      await fs.writeFile(destination, archive);
      onProgress({ downloadedBytes: archive.length, bytesPerSecond: archive.length });
    },
    inspectArchive: async () => ({ fileCount: 2, expandedBytes, roots: ['lingbuilder.fbro.sdk'] }),
    extractArchive: async (_archive, destination) => {
      const moduleRoot = path.join(destination, 'lingbuilder.fbro.sdk');
      await fs.mkdir(path.join(moduleRoot, 'sdk', 'include'), { recursive: true });
      await fs.writeFile(path.join(moduleRoot, 'lingbuilder.module.json'), manifest);
      await fs.writeFile(path.join(moduleRoot, 'sdk', 'include', 'LingBuilderFbroBridge.h'), header);
    }
  });
  service.start('fbro');
  const completed = await waitForCompletion(service);
  assert.equal(completed.state, 'succeeded');
  assert.equal((await service.inspect('fbro')).source, 'managed-cache');
  await service.requireForModules(['lingbuilder.fbro.browser']);
  assert.equal(await pathExists(path.join(root, 'downloads', resource.archiveName)), false, '成功安装后不保留重复 ZIP');
});

test('SDK SHA-256 不匹配时拒绝安装且保留失败状态', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-invalid-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const resource: SdkDependencyResource = {
    id: 'fbro', moduleId: 'lingbuilder.test.fbro.sdk', name: '测试 FBro SDK', version: 'test-1',
    platform: 'windows-x64', archiveName: 'cef3-test.zip', downloadUrl: 'https://example.invalid/cef3-test.zip',
    archiveBytes: 4, expandedBytes: 1, fileCount: 1, sha256: '0'.repeat(64),
    requiredModuleIds: ['lingbuilder.fbro.browser'],
    criticalFiles: [{ relativePath: 'include/cef_app.h', minimumBytes: 1 }]
  };
  const service = new SdkDependencyService({
    cacheRoot: root, workspaceRoot: () => root, platform: 'win32', resources: [resource],
    download: async (_url, destination, _expected, _expectedSha256, _signal, onProgress) => {
      await fs.writeFile(destination, 'bad!');
      onProgress({ downloadedBytes: 4, bytesPerSecond: 4 });
    },
    inspectArchive: async () => { throw new Error('不应解压'); },
    extractArchive: async () => { throw new Error('不应解压'); }
  });
  service.start('fbro');
  const completed = await waitForCompletion(service);
  assert.equal(completed.state, 'failed');
  assert.match(completed.message, /SHA-256/u);
  assert.equal((await service.inspect('fbro')).installed, false);
  assert.equal(await pathExists(path.join(root, 'downloads', `${resource.archiveName}.part`)), false, '损坏的完整分片必须删除，允许重新下载');
});

async function waitForCompletion(service: SdkDependencyService): Promise<SdkDependencyJobSnapshot> {
  for (let index = 0; index < 200; index += 1) {
    const snapshot = service.status();
    if (!snapshot.active) return snapshot;
    await new Promise<void>(resolve => setTimeout(resolve, 10));
  }
  throw new Error('等待 SDK 测试任务完成超时。');
}

async function pathExists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}

class HangingAria2cProcess extends EventEmitter implements Aria2cDownloadProcess {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killCalls = 0;

  kill(_signal?: NodeJS.Signals | number): boolean {
    this.killCalls += 1;
    this.signalCode = 'SIGTERM';
    setTimeout(() => this.emit('close', 1, this.signalCode), 0);
    return true;
  }
}

class NeverClosingAria2cProcess extends EventEmitter implements Aria2cDownloadProcess {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;
  killCalls = 0;

  kill(_signal?: NodeJS.Signals | number): boolean {
    this.killCalls += 1;
    return true;
  }
}

class ManualAria2cProcess extends EventEmitter implements Aria2cDownloadProcess {
  exitCode: number | null = null;
  signalCode: NodeJS.Signals | null = null;

  kill(_signal?: NodeJS.Signals | number): boolean {
    return true;
  }

  close(code: number | null, signalCode: NodeJS.Signals | null): void {
    this.exitCode = code;
    this.signalCode = signalCode;
    this.emit('close', code, signalCode);
  }
}
