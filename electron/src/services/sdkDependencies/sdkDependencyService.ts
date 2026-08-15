import { createHash, randomBytes } from 'node:crypto';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import {
  getManagedSdkModuleRoot,
  getRequiredSdkDependencyIds,
  getSdkDependencyResource,
  getSdkRootCandidates,
  SDK_DEPENDENCY_RESOURCES,
  type SdkDependencyId,
  type SdkDependencyResource
} from './sdkDependencyCatalog';

const execFileAsync = promisify(execFile);

export type SdkDependencyJobState =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'verifying'
  | 'extracting'
  | 'installing'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export interface SdkDependencyStatus {
  id: SdkDependencyId;
  moduleId: string;
  name: string;
  version: string;
  platform: 'windows-x64';
  archiveBytes: number;
  installed: boolean;
  installPath: string | null;
  source: 'environment' | 'workspace' | 'managed-cache' | 'packaged' | 'legacy' | null;
}

export interface SdkDependencyJobSnapshot {
  id: string | null;
  dependencyId: SdkDependencyId | null;
  state: SdkDependencyJobState;
  active: boolean;
  message: string;
  downloadedBytes: number;
  totalBytes: number;
  progress: number | null;
  bytesPerSecond: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
}

export interface SdkDependencyOverview {
  dependencies: SdkDependencyStatus[];
  job: SdkDependencyJobSnapshot;
}

type SdkArchiveDownloader = (
  url: string,
  destination: string,
  expectedBytes: number,
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void
) => Promise<void>;

export class SdkDependencyBusyError extends Error {
  constructor() {
    super('已有 SDK 下载或安装任务正在进行。');
    this.name = 'SdkDependencyBusyError';
  }
}

export class SdkDependencyRequiredError extends Error {
  readonly code = 'SDK_DEPENDENCY_REQUIRED';
  readonly status = 409;

  constructor(readonly dependencies: SdkDependencyStatus[]) {
    super(`当前操作需要先安装：${dependencies.map(item => `${item.name} ${item.version}`).join('、')}。`);
    this.name = 'SdkDependencyRequiredError';
  }
}

interface SdkDependencyServiceOptions {
  cacheRoot: string;
  workspaceRoot: () => string;
  environment?: NodeJS.ProcessEnv;
  resourcesPath?: string;
  aria2cPath?: string;
  platform?: NodeJS.Platform;
  now?: () => Date;
  download?: SdkArchiveDownloader;
  inspectArchive?: typeof inspectZipArchive;
  extractArchive?: typeof extractZipArchive;
  resources?: readonly SdkDependencyResource[];
}

const IDLE_JOB: SdkDependencyJobSnapshot = {
  id: null,
  dependencyId: null,
  state: 'idle',
  active: false,
  message: '当前没有 SDK 下载任务。',
  downloadedBytes: 0,
  totalBytes: 0,
  progress: null,
  bytesPerSecond: null,
  startedAt: null,
  finishedAt: null,
  error: null
};

export class SdkDependencyService {
  private readonly cacheRoot: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly platform: NodeJS.Platform;
  private readonly now: () => Date;
  private readonly download: SdkArchiveDownloader;
  private readonly aria2cPath: string;
  private readonly inspectArchive: typeof inspectZipArchive;
  private readonly extractArchive: typeof extractZipArchive;
  private readonly resources: readonly SdkDependencyResource[];
  private job: SdkDependencyJobSnapshot = { ...IDLE_JOB };
  private abortController: AbortController | null = null;

  constructor(private readonly options: SdkDependencyServiceOptions) {
    if (!path.isAbsolute(options.cacheRoot)) throw new Error('SDK 缓存目录必须是绝对路径。');
    this.cacheRoot = path.resolve(options.cacheRoot);
    this.environment = options.environment || process.env;
    this.platform = options.platform || process.platform;
    this.now = options.now || (() => new Date());
    this.aria2cPath = path.resolve(options.aria2cPath || resolveBundledAria2cPath(options.resourcesPath));
    this.download = options.download || ((url, destination, expectedBytes, signal, onProgress) => downloadArchive(
      url,
      destination,
      expectedBytes,
      signal,
      onProgress,
      this.aria2cPath
    ));
    this.inspectArchive = options.inspectArchive || inspectZipArchive;
    this.extractArchive = options.extractArchive || extractZipArchive;
    this.resources = options.resources || SDK_DEPENDENCY_RESOURCES;
  }

  status(): SdkDependencyJobSnapshot {
    return structuredClone(this.job);
  }

  async overview(): Promise<SdkDependencyOverview> {
    return {
      dependencies: await Promise.all(this.resources.map(resource => this.inspect(resource.id))),
      job: this.status()
    };
  }

  async inspect(id: SdkDependencyId): Promise<SdkDependencyStatus> {
    const resource = this.getResource(id);
    for (const candidate of getSdkRootCandidates(resource, {
      workspaceRoot: this.options.workspaceRoot(),
      cacheRoot: this.cacheRoot,
      environment: this.environment,
      resourcesPath: this.options.resourcesPath
    })) {
      if (await validateSdkRoot(resource, candidate.root)
          && (candidate.source !== 'managed-cache' || await validateManagedInstallMarker(resource, candidate.root))) {
        return createStatus(resource, true, candidate.root, candidate.source);
      }
    }
    return createStatus(resource, false, null, null);
  }

  async requireForModules(moduleIds: readonly string[]): Promise<void> {
    const enabled = new Set(moduleIds);
    const required = this.resources
      .filter(resource => resource.requiredModuleIds.some(moduleId => enabled.has(moduleId)))
      .map(resource => resource.id);
    const statuses = await Promise.all(required.map(id => this.inspect(id)));
    const missing = statuses.filter(item => !item.installed);
    if (missing.length > 0) throw new SdkDependencyRequiredError(missing);
  }

  start(id: SdkDependencyId): SdkDependencyJobSnapshot {
    if (this.job.active) throw new SdkDependencyBusyError();
    const resource = this.getResource(id);
    if (this.platform !== 'win32') throw new Error(`${resource.name} 当前只支持 Windows x64。`);
    const controller = new AbortController();
    this.abortController = controller;
    const startedAt = this.now().toISOString();
    this.job = {
      id: `sdk-${Date.now()}-${randomBytes(4).toString('hex')}`,
      dependencyId: id,
      state: 'checking',
      active: true,
      message: `正在检查 ${resource.name}…`,
      downloadedBytes: 0,
      totalBytes: resource.archiveBytes,
      progress: 0,
      bytesPerSecond: null,
      startedAt,
      finishedAt: null,
      error: null
    };
    void this.run(resource, controller.signal);
    return this.status();
  }

  cancel(): SdkDependencyJobSnapshot {
    if (this.job.active) this.abortController?.abort();
    return this.status();
  }

  private async run(resource: SdkDependencyResource, signal: AbortSignal): Promise<void> {
    const jobId = this.job.id!;
    const downloadDir = path.join(this.cacheRoot, 'downloads');
    const archivePath = path.join(downloadDir, resource.archiveName);
    const partialPath = `${archivePath}.part`;
    const stagingRoot = path.join(this.cacheRoot, '.staging', jobId);
    try {
      const existing = await this.inspect(resource.id);
      if (existing.installed) {
        this.complete('succeeded', `${resource.name} 已安装，无需重复下载。`);
        return;
      }
      await fs.mkdir(downloadDir, { recursive: true });
      let archiveReady = await fileMatches(archivePath, resource.archiveBytes, resource.sha256);
      if (!archiveReady) {
        await fs.rm(archivePath, { force: true });
        this.update({ state: 'downloading', message: `正在下载 ${resource.name}…` });
        await this.download(resource.downloadUrl, partialPath, resource.archiveBytes, signal, progress => {
          this.update({
            state: 'downloading',
            message: `正在下载 ${resource.name}…`,
            downloadedBytes: progress.downloadedBytes,
            totalBytes: resource.archiveBytes,
            progress: Math.min(100, Math.round(progress.downloadedBytes / resource.archiveBytes * 100)),
            bytesPerSecond: progress.bytesPerSecond
          });
        });
        throwIfAborted(signal);
        this.update({ state: 'verifying', message: `正在校验 ${resource.name}…`, bytesPerSecond: null });
        if (!await fileMatches(partialPath, resource.archiveBytes, resource.sha256)) {
          await fs.rm(partialPath, { force: true });
          await fs.rm(`${partialPath}.aria2`, { force: true });
          throw new Error(`${resource.name} 下载文件大小或 SHA-256 不匹配，已拒绝安装。`);
        }
        await fs.rename(partialPath, archivePath);
        archiveReady = true;
      }
      if (!archiveReady) throw new Error(`${resource.name} 下载文件没有准备完成。`);
      throwIfAborted(signal);
      this.update({ state: 'extracting', message: `正在安全解压 ${resource.name}…`, progress: 100 });
      const inventory = await this.inspectArchive(archivePath);
      validateArchiveInventory(resource, inventory);
      await fs.rm(stagingRoot, { recursive: true, force: true });
      await fs.mkdir(stagingRoot, { recursive: true });
      await this.extractArchive(archivePath, stagingRoot, signal);
      throwIfAborted(signal);
      const extractedModuleRoot = path.join(stagingRoot, resource.moduleId);
      if (!await validateSdkRoot(resource, path.join(extractedModuleRoot, 'sdk'))) {
        throw new Error(`${resource.name} 解压后的模块清单或关键文件不完整。`);
      }
      const extracted = await collectTreeInventory(extractedModuleRoot);
      if (extracted.files !== resource.fileCount || extracted.bytes !== resource.expandedBytes) {
        throw new Error(`${resource.name} 解压结果不完整：${extracted.files} 个文件 / ${extracted.bytes} 字节。`);
      }
      this.update({ state: 'installing', message: `正在安装 ${resource.name}…` });
      await this.installAtomically(resource, extractedModuleRoot, jobId);
      await fs.rm(archivePath, { force: true });
      await fs.rm(partialPath, { force: true });
      await fs.rm(stagingRoot, { recursive: true, force: true });
      this.complete('succeeded', `${resource.name} ${resource.version} 安装完成。`);
    } catch (error) {
      await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
      if (signal.aborted) {
        this.complete('cancelled', `${resource.name} 下载已取消。`);
      } else {
        const message = error instanceof Error ? error.message : String(error);
        this.complete('failed', `${resource.name} 安装失败：${message}`, message);
      }
    } finally {
      if (this.job.id === jobId) this.abortController = null;
    }
  }

  private getResource(id: SdkDependencyId): SdkDependencyResource {
    const resource = this.resources.find(item => item.id === id);
    if (!resource) throw new Error(`未知 SDK 依赖：${id}`);
    return resource;
  }

  private async installAtomically(resource: SdkDependencyResource, source: string, jobId: string): Promise<void> {
    const target = getManagedSdkModuleRoot(this.cacheRoot, resource);
    const backup = `${target}.backup-${jobId}`;
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rm(backup, { recursive: true, force: true });
    let movedExisting = false;
    try {
      if (await pathExists(target)) {
        await fs.rename(target, backup);
        movedExisting = true;
      }
      await fs.rename(source, target);
      await fs.writeFile(path.join(target, '.lingbuilder-sdk-install.json'), `${JSON.stringify({
        schemaVersion: 1,
        dependencyId: resource.id,
        moduleId: resource.moduleId,
        version: resource.version,
        archiveSha256: resource.sha256,
        installedAt: this.now().toISOString()
      }, null, 2)}\n`, 'utf8');
      await fs.rm(backup, { recursive: true, force: true });
    } catch (error) {
      await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
      if (movedExisting && await pathExists(backup)) await fs.rename(backup, target).catch(() => undefined);
      throw error;
    }
  }

  private update(patch: Partial<SdkDependencyJobSnapshot>): void {
    this.job = { ...this.job, ...patch };
  }

  private complete(state: 'succeeded' | 'failed' | 'cancelled', message: string, error: string | null = null): void {
    this.job = {
      ...this.job,
      state,
      active: false,
      message,
      progress: state === 'succeeded' ? 100 : this.job.progress,
      bytesPerSecond: null,
      finishedAt: this.now().toISOString(),
      error
    };
  }
}

export async function inspectSdkDependenciesForModules(
  moduleIds: readonly string[],
  options: { workspaceRoot: string; cacheRoot: string; environment?: NodeJS.ProcessEnv; resourcesPath?: string }
): Promise<SdkDependencyStatus[]> {
  const service = new SdkDependencyService({
    cacheRoot: options.cacheRoot,
    workspaceRoot: () => options.workspaceRoot,
    environment: options.environment,
    resourcesPath: options.resourcesPath
  });
  return await Promise.all(getRequiredSdkDependencyIds(moduleIds).map(id => service.inspect(id)));
}

function createStatus(
  resource: SdkDependencyResource,
  installed: boolean,
  installPath: string | null,
  source: SdkDependencyStatus['source']
): SdkDependencyStatus {
  return {
    id: resource.id,
    moduleId: resource.moduleId,
    name: resource.name,
    version: resource.version,
    platform: resource.platform,
    archiveBytes: resource.archiveBytes,
    installed,
    installPath,
    source
  };
}

async function validateSdkRoot(resource: SdkDependencyResource, sdkRoot: string): Promise<boolean> {
  try {
    for (const critical of resource.criticalFiles) {
      const stat = await fs.stat(path.join(sdkRoot, ...critical.relativePath.split('/')));
      if (!stat.isFile() || stat.size < critical.minimumBytes) return false;
    }
    const manifestPath = path.join(path.dirname(sdkRoot), 'lingbuilder.module.json');
    if (await pathExists(manifestPath)) {
      const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { id?: unknown; version?: unknown; schemaVersion?: unknown };
      if (manifest.schemaVersion !== 2 || manifest.id !== resource.moduleId || manifest.version !== resource.version) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function validateManagedInstallMarker(resource: SdkDependencyResource, sdkRoot: string): Promise<boolean> {
  try {
    const marker = JSON.parse(await fs.readFile(path.join(path.dirname(sdkRoot), '.lingbuilder-sdk-install.json'), 'utf8')) as {
      schemaVersion?: unknown;
      dependencyId?: unknown;
      moduleId?: unknown;
      version?: unknown;
      archiveSha256?: unknown;
    };
    return marker.schemaVersion === 1
      && marker.dependencyId === resource.id
      && marker.moduleId === resource.moduleId
      && marker.version === resource.version
      && marker.archiveSha256 === resource.sha256;
  } catch {
    return false;
  }
}

async function fileMatches(filePath: string, expectedBytes: number, expectedSha256: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size !== expectedBytes) return false;
    return await sha256File(filePath) === expectedSha256.toLowerCase();
  } catch {
    return false;
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = fsSync.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

interface DownloadProgress {
  downloadedBytes: number;
  bytesPerSecond: number | null;
}

async function downloadArchive(
  url: string,
  destination: string,
  expectedBytes: number,
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
  aria2cPath: string
): Promise<void> {
  if (!url.startsWith('https://')) throw new Error('SDK 下载地址必须使用 HTTPS。');
  await assertDirectHttpsDownloadUrl(url, expectedBytes, signal);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  let offset = 0;
  try {
    const stat = await fs.stat(destination);
    offset = stat.isFile() && stat.size <= expectedBytes ? stat.size : 0;
  } catch {
    offset = 0;
  }
  if (offset === expectedBytes) {
    onProgress({ downloadedBytes: offset, bytesPerSecond: 0 });
    return;
  }
  if (offset === 0) {
    await fs.rm(destination, { force: true });
    await fs.rm(`${destination}.aria2`, { force: true });
  }
  try {
    const aria2Stat = await fs.stat(aria2cPath);
    if (!aria2Stat.isFile()) throw new Error(`LingBuilder 随附的 aria2c.exe 无效：${aria2cPath}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes('无效')) throw error;
    throw new Error(`未找到 LingBuilder 随附的 aria2c.exe：${aria2cPath}`);
  }
  const args = createAria2cArguments(url, destination);
  let downloaded = offset;
  let previousBytes = offset;
  let previousAt = Date.now();
  const reportProgress = async (): Promise<void> => {
    try {
      const stat = await fs.stat(destination);
      downloaded = Math.min(expectedBytes, stat.size);
      const now = Date.now();
      const elapsedSeconds = Math.max(0.001, (now - previousAt) / 1000);
      const bytesPerSecond = Math.max(0, Math.round((downloaded - previousBytes) / elapsedSeconds));
      previousBytes = downloaded;
      previousAt = now;
      onProgress({ downloadedBytes: downloaded, bytesPerSecond });
    } catch {
      onProgress({ downloadedBytes: downloaded, bytesPerSecond: null });
    }
  };
  await reportProgress();
  const child = spawn(aria2cPath, args, {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe']
  });
  let stderr = '';
  child.stderr?.on('data', chunk => {
    stderr += String(chunk);
    if (stderr.length > 8 * 1024) stderr = stderr.slice(-8 * 1024);
  });
  const progressTimer = setInterval(() => { void reportProgress(); }, 500);
  const abort = (): void => { child.kill(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    await new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => {
        if (signal.aborted) {
          reject(new DOMException('操作已取消。', 'AbortError'));
        } else if (code === 0) {
          resolve();
        } else {
          const detail = stderr.trim().replace(/\s+/gu, ' ');
          reject(new Error(`aria2c 下载失败（退出码 ${code ?? '未知'}）${detail ? `：${detail}` : '。'}`));
        }
      });
    });
  } finally {
    signal.removeEventListener('abort', abort);
    clearInterval(progressTimer);
    await reportProgress();
  }
  throwIfAborted(signal);
  await fs.rm(`${destination}.aria2`, { force: true });
  downloaded = (await fs.stat(destination)).size;
  if (downloaded !== expectedBytes) throw new Error(`SDK 下载不完整：${downloaded} / ${expectedBytes} 字节。`);
}

export const ARIA2C_CONNECTIONS = 8;
export const ARIA2C_MIN_SPLIT_SIZE = '8M';

export function createAria2cArguments(url: string, destination: string): string[] {
  return [
    '--continue=true',
    '--allow-overwrite=true',
    '--auto-file-renaming=false',
    '--file-allocation=none',
    `--max-connection-per-server=${ARIA2C_CONNECTIONS}`,
    `--split=${ARIA2C_CONNECTIONS}`,
    `--min-split-size=${ARIA2C_MIN_SPLIT_SIZE}`,
    '--max-tries=5',
    '--retry-wait=2',
    '--timeout=60',
    '--connect-timeout=30',
    '--check-certificate=true',
    '--summary-interval=1',
    '--console-log-level=warn',
    '--enable-color=false',
    '--remote-time=false',
    `--dir=${path.dirname(destination)}`,
    `--out=${path.basename(destination)}`,
    url
  ];
}

async function assertDirectHttpsDownloadUrl(url: string, expectedBytes: number, signal: AbortSignal): Promise<void> {
  const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal });
  if (response.status >= 300 && response.status < 400) throw new Error('SDK 下载地址不允许重定向，请检查受控 HTTPS 直链。');
  if (!response.ok) throw new Error(`SDK 下载地址预检失败：HTTP ${response.status}。`);
  if (!response.url.startsWith('https://')) throw new Error('SDK 下载地址预检返回了非 HTTPS 地址。');
  const contentLength = Number(response.headers.get('content-length') || '');
  if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== expectedBytes) {
    throw new Error(`SDK 下载地址预检大小不匹配：${contentLength} / ${expectedBytes} 字节。`);
  }
}

function resolveBundledAria2cPath(resourcesPath?: string): string {
  const root = resourcesPath ? path.resolve(resourcesPath) : path.resolve(process.cwd(), 'electron');
  return path.join(root, 'third_party', 'aria2', 'aria2c.exe');
}

export interface ZipArchiveInventory {
  fileCount: number;
  expandedBytes: number;
  roots: string[];
}

export async function inspectZipArchive(archivePath: string): Promise<ZipArchiveInventory> {
  const stat = await fs.stat(archivePath);
  const tailBytes = Math.min(stat.size, 65_557);
  const handle = await fs.open(archivePath, 'r');
  try {
    const tail = Buffer.alloc(tailBytes);
    await handle.read(tail, 0, tail.length, stat.size - tailBytes);
    let eocd = -1;
    for (let index = tail.length - 22; index >= 0; index -= 1) {
      if (tail.readUInt32LE(index) === 0x06054B50) { eocd = index; break; }
    }
    if (eocd < 0) throw new Error('ZIP 缺少中央目录结束记录。');
    const entries = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (entries === 0xFFFF || centralSize === 0xFFFFFFFF || centralOffset === 0xFFFFFFFF) {
      throw new Error('SDK ZIP64 归档不在当前受控格式范围内。');
    }
    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, central.length, centralOffset);
    let cursor = 0;
    let fileCount = 0;
    let expandedBytes = 0;
    const roots = new Set<string>();
    const seen = new Set<string>();
    for (let entryIndex = 0; entryIndex < entries; entryIndex += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014B50) {
        throw new Error('SDK ZIP 中央目录损坏。');
      }
      const flags = central.readUInt16LE(cursor + 8);
      const method = central.readUInt16LE(cursor + 10);
      const expanded = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const externalAttributes = central.readUInt32LE(cursor + 38);
      const nameStart = cursor + 46;
      const rawName = central.subarray(nameStart, nameStart + nameLength).toString('utf8');
      const normalized = normalizeArchivePath(rawName);
      if ((flags & 0x1) !== 0) throw new Error(`SDK ZIP 不允许加密条目：${rawName}`);
      if (method !== 0 && method !== 8) throw new Error(`SDK ZIP 使用了不支持的压缩方法：${rawName}`);
      const unixMode = externalAttributes >>> 16;
      if ((unixMode & 0xF000) === 0xA000) throw new Error(`SDK ZIP 不允许符号链接：${rawName}`);
      const isDirectory = rawName.endsWith('/') || rawName.endsWith('\\');
      const key = normalized.toLowerCase();
      if (seen.has(key)) throw new Error(`SDK ZIP 包含重复路径：${normalized}`);
      seen.add(key);
      roots.add(normalized.split('/')[0]);
      if (!isDirectory) {
        fileCount += 1;
        expandedBytes += expanded;
      }
      cursor = nameStart + nameLength + extraLength + commentLength;
    }
    if (cursor > central.length) throw new Error('SDK ZIP 中央目录长度无效。');
    return { fileCount, expandedBytes, roots: [...roots] };
  } finally {
    await handle.close();
  }
}

function normalizeArchivePath(value: string): string {
  if (!value || value.includes('\0')) throw new Error('SDK ZIP 包含空路径或 NUL 字符。');
  const normalized = value.replaceAll('\\', '/').replace(/\/+$/u, '');
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/iu.test(normalized)) {
    throw new Error(`SDK ZIP 包含绝对路径：${value}`);
  }
  const segments = normalized.split('/');
  if (segments.some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`SDK ZIP 包含不安全路径：${value}`);
  }
  return normalized;
}

function validateArchiveInventory(resource: SdkDependencyResource, inventory: ZipArchiveInventory): void {
  if (inventory.roots.length !== 1 || inventory.roots[0] !== resource.moduleId) {
    throw new Error(`${resource.name} ZIP 顶层目录必须是 ${resource.moduleId}/。`);
  }
  if (inventory.fileCount !== resource.fileCount || inventory.expandedBytes !== resource.expandedBytes) {
    throw new Error(`${resource.name} ZIP 文件清单不匹配：${inventory.fileCount} 个文件 / ${inventory.expandedBytes} 字节。`);
  }
}

async function extractZipArchive(archivePath: string, destination: string, signal: AbortSignal): Promise<void> {
  const command = `Expand-Archive -LiteralPath ${quotePowerShell(archivePath)} -DestinationPath ${quotePowerShell(destination)} -Force`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
    windowsHide: true,
    timeout: 20 * 60_000,
    maxBuffer: 4 * 1024 * 1024,
    signal
  });
}

async function collectTreeInventory(root: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const queue = [root];
  while (queue.length > 0) {
    const directory = queue.shift()!;
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      const stat = await fs.lstat(target);
      if (stat.isSymbolicLink()) throw new Error(`SDK 解压结果包含符号链接：${target}`);
      if (stat.isDirectory()) queue.push(target);
      else if (stat.isFile()) { files += 1; bytes += stat.size; }
      else throw new Error(`SDK 解压结果包含不支持的文件类型：${target}`);
    }
  }
  return { files, bytes };
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException('操作已取消。', 'AbortError');
}

async function pathExists(target: string): Promise<boolean> {
  try { await fs.access(target); return true; } catch { return false; }
}
