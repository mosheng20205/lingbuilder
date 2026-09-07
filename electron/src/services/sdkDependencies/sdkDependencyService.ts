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
import {
  fetchRemoteCatalog,
  readSdkCatalogState,
  verifyAndMergeCatalog,
  writeSdkCatalogState
} from './sdkCatalogRemote';
import type { SdkCatalogTrustAnchor } from './catalogTrustAnchors';

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
  catalogSource: 'builtin' | 'remote';
  catalogSequence: number | null;
}

export interface SdkDependencyRemoteCatalogOptions {
  url: string;
  anchors: readonly SdkCatalogTrustAnchor[];
  statePath?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
}

type SdkArchiveDownloader = (
  url: string,
  destination: string,
  expectedBytes: number,
  expectedSha256: string,
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
  remoteCatalog?: SdkDependencyRemoteCatalogOptions;
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
  private readonly remoteCatalog: SdkDependencyRemoteCatalogOptions | null;
  private resources: readonly SdkDependencyResource[];
  private catalogSource: 'builtin' | 'remote' = 'builtin';
  private catalogSequence: number | null = null;
  private remoteCache: { resources: readonly SdkDependencyResource[]; sequence: number; fetchedAt: number } | null = null;
  private job: SdkDependencyJobSnapshot = { ...IDLE_JOB };
  private abortController: AbortController | null = null;

  constructor(private readonly options: SdkDependencyServiceOptions) {
    if (!path.isAbsolute(options.cacheRoot)) throw new Error('SDK 缓存目录必须是绝对路径。');
    this.cacheRoot = path.resolve(options.cacheRoot);
    this.environment = options.environment || process.env;
    this.platform = options.platform || process.platform;
    this.now = options.now || (() => new Date());
    this.aria2cPath = path.resolve(options.aria2cPath || resolveBundledAria2cPath(options.resourcesPath));
    this.download = options.download || ((url, destination, expectedBytes, expectedSha256, signal, onProgress) => downloadArchive(
      url,
      destination,
      expectedBytes,
      expectedSha256,
      signal,
      onProgress,
      this.aria2cPath,
      this.environment
    ));
    this.inspectArchive = options.inspectArchive || inspectZipArchive;
    this.extractArchive = options.extractArchive || extractZipArchive;
    this.resources = options.resources || SDK_DEPENDENCY_RESOURCES;
    this.remoteCatalog = options.remoteCatalog || null;
  }

  private async refreshRemoteCatalog(): Promise<void> {
    const config = this.remoteCatalog;
    if (!config || !config.anchors.length) return;
    const now = Date.now();
    const cacheTtl = config.cacheTtlMs ?? 600_000;
    if (this.remoteCache && now - this.remoteCache.fetchedAt < cacheTtl) {
      this.resources = this.remoteCache.resources;
      this.catalogSource = 'remote';
      this.catalogSequence = this.remoteCache.sequence;
      return;
    }
    try {
      const manifest = await fetchRemoteCatalog(config.url, config.timeoutMs);
      const statePath = config.statePath;
      const accepted = statePath ? await readSdkCatalogState(statePath) : null;
      const merged = verifyAndMergeCatalog(SDK_DEPENDENCY_RESOURCES, manifest, config.anchors, { acceptedSequence: accepted?.acceptedSequence ?? 0 });
      if (statePath) await writeSdkCatalogState(statePath, merged.sequence);
      this.remoteCache = { resources: merged.resources, sequence: merged.sequence, fetchedAt: Date.now() };
      this.resources = merged.resources;
      this.catalogSource = 'remote';
      this.catalogSequence = merged.sequence;
    } catch {
      this.resources = SDK_DEPENDENCY_RESOURCES;
      this.catalogSource = 'builtin';
      this.catalogSequence = null;
      this.remoteCache = null;
    }
  }

  status(): SdkDependencyJobSnapshot {
    return structuredClone(this.job);
  }

  async overview(): Promise<SdkDependencyOverview> {
    await this.refreshRemoteCatalog();
    return {
      dependencies: await Promise.all(this.resources.map(resource => this.inspect(resource.id))),
      job: this.status(),
      catalogSource: this.catalogSource,
      catalogSequence: this.catalogSequence
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
    void this.run(id, controller.signal);
    return this.status();
  }

  cancel(): SdkDependencyJobSnapshot {
    if (this.job.active) this.abortController?.abort();
    return this.status();
  }

  private async run(id: SdkDependencyId, signal: AbortSignal): Promise<void> {
    const jobId = this.job.id!;
    const downloadDir = path.join(this.cacheRoot, 'downloads');
    let stagingRoot: string | null = null;
    let resource: SdkDependencyResource | null = null;
    try {
      await this.refreshRemoteCatalog();
      resource = this.getResource(id);
      const archivePath = path.join(downloadDir, resource.archiveName);
      const partialPath = `${archivePath}.part`;
      stagingRoot = path.join(this.cacheRoot, '.staging', jobId);
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
        await this.download(resource.downloadUrl, partialPath, resource.archiveBytes, resource.sha256, signal, progress => {
        const complete = progress.downloadedBytes >= resource.archiveBytes;
        this.update({
          state: complete ? 'verifying' : 'downloading',
          message: complete ? `下载完成，正在校验 ${resource.name}…` : `正在下载 ${resource.name}…${progress.notice ? `（${progress.notice}）` : ''}`,
          downloadedBytes: Math.min(progress.downloadedBytes, resource.archiveBytes),
          totalBytes: resource.archiveBytes,
          progress: Math.min(100, Math.round(progress.downloadedBytes / resource.archiveBytes * 100)),
          bytesPerSecond: complete ? null : progress.bytesPerSecond
        });
        });
        throwIfAborted(signal);
        this.update({ state: 'verifying', message: `正在校验 ${resource.name}…`, bytesPerSecond: null });
        if (!await fileMatches(partialPath, resource.archiveBytes, resource.sha256)) {
          await fs.rm(partialPath, { force: true });
          await fs.rm(`${partialPath}.aria2`, { force: true });
          throw new Error(`${resource.name} 下载文件大小或 SHA-256 不匹配，已拒绝安装。`);
        }
        await renameDirectoryWithRetry(partialPath, archivePath, { attempts: 6, delayMs: 250 });
        archiveReady = true;
      }
      if (!archiveReady) throw new Error(`${resource.name} 下载文件没有准备完成。`);
      throwIfAborted(signal);
      this.update({ state: 'extracting', message: `下载完成，正在安全解压 ${resource.name}…`, progress: 100 });
      const inventory = await this.inspectArchive(archivePath);
      validateArchiveInventory(resource, inventory);
      await fs.rm(stagingRoot, { recursive: true, force: true });
      await fs.mkdir(stagingRoot, { recursive: true });
      await this.extractArchive(archivePath, stagingRoot, signal);
      throwIfAborted(signal);
      const extractedModuleRoot = await normalizeExtractedSdkModuleRoot(resource, stagingRoot);
      const extractedSdkRoot = path.join(extractedModuleRoot, 'sdk');
      const validationIssue = await getSdkRootValidationIssue(resource, extractedSdkRoot);
      if (validationIssue) {
        throw new Error(`${resource.name} 解压后的模块清单或关键文件不完整：${validationIssue}`);
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
      if (stagingRoot) await fs.rm(stagingRoot, { recursive: true, force: true }).catch(() => undefined);
      const name = resource?.name ?? 'SDK 依赖';
      if (signal.aborted) {
        this.complete('cancelled', `${name} 下载已取消。`);
      } else {
        const raw = error instanceof Error ? error.message : String(error);
        const message = translateSdkDownloadErrorText(raw);
        this.complete('failed', `${name} 安装失败：${message}`, message);
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
        await renameDirectoryWithRetry(target, backup, { attempts: 8, delayMs: 250 });
        movedExisting = true;
      }
      await renameDirectoryWithRetry(source, target, { attempts: 8, delayMs: 250 });
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
      if (movedExisting && await pathExists(backup)) await renameDirectoryWithRetry(backup, target, { attempts: 8, delayMs: 250 }).catch(() => undefined);
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

export async function renameDirectoryWithRetry(
  source: string,
  target: string,
  options: {
    attempts?: number;
    delayMs?: number;
    rename?: (source: string, target: string) => Promise<void>;
  } = {}
): Promise<void> {
  const attempts = Math.max(1, Math.floor(options.attempts ?? 5));
  const delayMs = Math.max(0, Math.floor(options.delayMs ?? 120));
  const rename = options.rename ?? ((from, to) => fs.rename(from, to));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await rename(source, target);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      const retryable = code === 'EPERM' || code === 'EACCES' || code === 'EBUSY';
      if (!retryable || attempt >= attempts) throw error;
      const waitMs = delayMs * attempt;
      if (waitMs > 0) await new Promise(resolve => setTimeout(resolve, waitMs));
    }
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
  return await getSdkRootValidationIssue(resource, sdkRoot) === null;
}

async function getSdkRootValidationIssue(resource: SdkDependencyResource, sdkRoot: string): Promise<string | null> {
  try {
    for (const critical of resource.criticalFiles) {
      const target = path.join(sdkRoot, ...critical.relativePath.split('/'));
      let stat: fsSync.Stats;
      try {
        stat = await fs.stat(target);
      } catch {
        return `缺少关键文件 ${critical.relativePath}。`;
      }
      if (!stat.isFile()) return `关键路径不是普通文件：${critical.relativePath}。`;
      if (stat.size < critical.minimumBytes) {
        return `关键文件 ${critical.relativePath} 大小不足（实际 ${stat.size} 字节，需要至少 ${critical.minimumBytes} 字节）。`;
      }
    }
    if (resource.id === 'cef3') {
      const bridgeHeader = path.join(sdkRoot, 'bridge', 'x64', 'LingBuilderCefBridge.h');
      const bridgeText = await fs.readFile(bridgeHeader, 'utf8').catch(() => '');
      if (!/\bLB_CEF3_ResourceResponseBodyBegin\b/u.test(bridgeText)) {
        return 'CEF3 Bridge ABI outdated: missing LB_CEF3_ResourceResponseBodyBegin.';
      }
    }
    const manifestPath = path.join(path.dirname(sdkRoot), 'lingbuilder.module.json');
    if (await pathExists(manifestPath)) {
      let manifest: { id?: unknown; version?: unknown; schemaVersion?: unknown };
      try {
        manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as { id?: unknown; version?: unknown; schemaVersion?: unknown };
      } catch {
        return '模块清单无法按 UTF-8 JSON 读取。';
      }
      if (manifest.schemaVersion !== 2 || manifest.id !== resource.moduleId || manifest.version !== resource.version) {
        return '模块清单的 schemaVersion、ID 或版本与受控资源清单不一致。';
      }
    }
    return null;
  } catch {
    return '无法读取 SDK 目录。';
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
  notice?: string | null;
}

export interface Aria2cDownloadProcess {
  readonly exitCode: number | null;
  readonly signalCode: NodeJS.Signals | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
}

export interface Aria2cDownloadCompletion {
  archiveVerified: boolean;
  exitCode: number | null;
  signalCode: NodeJS.Signals | null;
}

export interface WaitForAria2cDownloadOptions {
  verificationIntervalMs?: number;
  terminationGraceMs?: number;
  onArchiveVerified?: () => void;
}

const ARIA2C_COMPLETION_CHECK_INTERVAL_MS = 500;
const ARIA2C_TERMINATION_GRACE_MS = 2_000;

/**
 * aria2 can keep an HTTP connection open after it has written the final byte.
 * A full SHA-256 match is a stronger completion signal than waiting on that connection.
 */
export async function waitForAria2cExitOrVerifiedArchive(
  child: Aria2cDownloadProcess,
  destination: string,
  expectedBytes: number,
  expectedSha256: string,
  signal: AbortSignal,
  options: WaitForAria2cDownloadOptions = {}
): Promise<Aria2cDownloadCompletion> {
  const verificationIntervalMs = Math.max(50, options.verificationIntervalMs ?? ARIA2C_COMPLETION_CHECK_INTERVAL_MS);
  const terminationGraceMs = Math.max(100, options.terminationGraceMs ?? ARIA2C_TERMINATION_GRACE_MS);
  return await new Promise<Aria2cDownloadCompletion>((resolve, reject) => {
    let settled = false;
    let archiveVerified = false;
    let verificationPromise: Promise<boolean> | null = null;
    let closeResult: Aria2cDownloadCompletion | null = null;
    let forceKillRequested = false;
    let terminationReason: 'verified' | 'cancelled' | null = null;
    let verificationTimer: NodeJS.Timeout | null = null;
    let terminationTimer: NodeJS.Timeout | null = null;

    const abortError = (): DOMException => new DOMException('操作已取消。', 'AbortError');
    const clearTerminationTimer = (): void => {
      if (terminationTimer) clearTimeout(terminationTimer);
      terminationTimer = null;
    };
    const clearTimers = (): void => {
      if (verificationTimer) clearInterval(verificationTimer);
      clearTerminationTimer();
      verificationTimer = null;
      signal.removeEventListener('abort', abort);
    };
    const complete = (completion: Aria2cDownloadCompletion): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      resolve(completion);
    };
    const fail = (error: Error): void => {
      if (settled) return;
      settled = true;
      clearTimers();
      reject(error);
    };
    const terminate = (killSignal?: NodeJS.Signals): void => {
      try { child.kill(killSignal); } catch { /* The close/error handler determines the final state. */ }
    };
    const waitForCloseAfterTermination = (): void => {
      clearTerminationTimer();
      terminationTimer = setTimeout(() => {
        if (settled || closeResult) return;
        if (!forceKillRequested) {
          forceKillRequested = true;
          terminate('SIGKILL');
          waitForCloseAfterTermination();
          return;
        }
        if (terminationReason === 'cancelled') {
          fail(abortError());
        } else {
          fail(new Error('aria2c 已完成 SDK 归档校验，但未能在终止后退出；请稍后重试。'));
        }
      }, terminationGraceMs);
    };
    const requestTermination = (reason: 'verified' | 'cancelled'): void => {
      if (settled || closeResult) return;
      terminationReason = reason;
      forceKillRequested = false;
      terminate();
      waitForCloseAfterTermination();
    };
    const acceptVerifiedArchive = (): void => {
      if (settled || signal.aborted || archiveVerified) return;
      archiveVerified = true;
      try {
        options.onArchiveVerified?.();
      } catch {
        // UI progress reporting must not leave a verified archive or aria2 process in an indeterminate state.
      }
      requestTermination('verified');
      // 文件已通过完整大小与 SHA-256 校验，下载阶段应立即结束。
      // aria2c 的 close 事件只负责后续清理，不能阻塞解压和 UI 状态推进。
      complete({ ...(closeResult ?? { exitCode: null, signalCode: null }), archiveVerified: true });
    };
    const verifyCompletedArchive = (): Promise<boolean> => {
      if (settled || signal.aborted || archiveVerified) return Promise.resolve(archiveVerified);
      if (verificationPromise) return verificationPromise;
      verificationPromise = (async () => {
        try {
          const matches = await fileMatches(destination, expectedBytes, expectedSha256);
          if (matches && !settled && !signal.aborted) acceptVerifiedArchive();
          return archiveVerified;
        } catch {
          // The final validation remains authoritative; keep aria2 running after a transient read failure.
          return false;
        } finally {
          verificationPromise = null;
        }
      })();
      return verificationPromise;
    };
    const abort = (): void => {
      if (settled) return;
      if (closeResult) {
        fail(abortError());
        return;
      }
      requestTermination('cancelled');
    };
    const close = (code: number | null, signalCode: NodeJS.Signals | null): void => {
      closeResult = { archiveVerified, exitCode: code, signalCode };
      clearTerminationTimer();
      void (async () => {
        if (verificationPromise) await verificationPromise;
        if (settled) return;
        if (signal.aborted) {
          fail(abortError());
          return;
        }
        if (!archiveVerified) await verifyCompletedArchive();
        if (settled) return;
        if (signal.aborted) {
          fail(abortError());
          return;
        }
        complete({ ...closeResult!, archiveVerified });
      })();
    };

    child.once('error', fail);
    child.once('close', close);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
    } else {
      verificationTimer = setInterval(() => { void verifyCompletedArchive(); }, verificationIntervalMs);
      void verifyCompletedArchive();
    }
  });
}

async function downloadArchive(
  url: string,
  destination: string,
  expectedBytes: number,
  expectedSha256: string,
  signal: AbortSignal,
  onProgress: (progress: DownloadProgress) => void,
  aria2cPath: string,
  environment: NodeJS.ProcessEnv = process.env
): Promise<void> {
  if (!url.startsWith('https://')) throw new Error('SDK 下载地址必须使用 HTTPS。');
  const probeIssue = await probeDirectHttpsDownloadUrl(url, expectedBytes, signal);
  if (probeIssue) throw new Error(probeIssue);
  const proxy = await resolveSdkDownloadProxy(environment).catch(() => null);
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
  const args = createAria2cArguments(url, destination, proxy);
  let downloaded = offset;
  let previousBytes = offset;
  let previousAt = Date.now();
  const stallTracker = createSdkDownloadStallTracker();
  const reportProgress = async (): Promise<void> => {
    try {
      const stat = await fs.stat(destination);
      downloaded = Math.min(expectedBytes, stat.size);
      const now = Date.now();
      const elapsedSeconds = Math.max(0.001, (now - previousAt) / 1000);
      const bytesPerSecond = Math.max(0, Math.round((downloaded - previousBytes) / elapsedSeconds));
      previousBytes = downloaded;
      previousAt = now;
      const notice = downloaded < expectedBytes ? stallTracker.observe(downloaded) : null;
      onProgress({ downloadedBytes: downloaded, bytesPerSecond, notice });
    } catch {
      const notice = downloaded < expectedBytes ? stallTracker.observe(downloaded) : null;
      onProgress({ downloadedBytes: downloaded, bytesPerSecond: null, notice });
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
  try {
    const completion = await waitForAria2cExitOrVerifiedArchive(
      child,
      destination,
      expectedBytes,
      expectedSha256,
      signal,
      { onArchiveVerified: () => onProgress({ downloadedBytes: expectedBytes, bytesPerSecond: 0 }) }
    );
    if (signal.aborted) throw new DOMException('操作已取消。', 'AbortError');
    if (!completion.archiveVerified) {
      const detail = stderr.trim().replace(/\s+/gu, ' ');
      const reason = describeAria2ExitCode(completion.exitCode);
      await removeFileWithRetry(destination).catch(() => undefined);
      await removeFileWithRetry(`${destination}.aria2`).catch(() => undefined);
      throw new Error(`aria2c 下载未完成${reason ? `：${reason}` : ''}，SDK 归档未通过完整性校验（退出码 ${completion.exitCode ?? '未知'}）${detail ? `。下载器信息：${detail}` : '，请检查网络连接或代理设置。'}`);
    }
  } finally {
    clearInterval(progressTimer);
    await reportProgress();
  }
  throwIfAborted(signal);
  await removeFileWithRetry(`${destination}.aria2`).catch(() => undefined);
  downloaded = (await fs.stat(destination)).size;
  if (downloaded !== expectedBytes) throw new Error(`SDK 下载不完整：${downloaded} / ${expectedBytes} 字节。`);
}

async function removeFileWithRetry(target: string, attempts = 4): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await fs.rm(target, { force: true });
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== 'EBUSY' && code !== 'EPERM') || attempt === attempts - 1) break;
      await new Promise<void>(resolve => setTimeout(resolve, 100 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`无法删除文件：${target}`);
}

export const ARIA2C_CONNECTIONS = 8;
export const ARIA2C_MIN_SPLIT_SIZE = '8M';

export function createAria2cArguments(url: string, destination: string, proxy?: string | null): string[] {
  const args = [
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
    '--remote-time=false'
  ];
  if (proxy) args.push(`--all-proxy=${proxy}`);
  args.push(`--dir=${path.dirname(destination)}`, `--out=${path.basename(destination)}`, url);
  return args;
}

export interface ProbeDirectHttpsDownloadUrlOptions {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

/**
 * 对受控直链执行一次不跟随重定向的 HEAD 预检。
 * 返回 null 表示可以继续下载（预检通过，或预检本身遇到网络层失败——
 * 连通性交给 aria2c 实测，由它产生可翻译的真实错误）；
 * 返回非空字符串表示必须阻断的直链问题（重定向、非 HTTPS、大小不匹配等）。
 */
export async function probeDirectHttpsDownloadUrl(
  url: string,
  expectedBytes: number,
  signal: AbortSignal,
  options: ProbeDirectHttpsDownloadUrlOptions = {}
): Promise<string | null> {
  const doFetch = options.fetchImpl || fetch;
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 15_000);
  const combined = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  let response: Response;
  try {
    response = await doFetch(url, { method: 'HEAD', redirect: 'manual', signal: combined });
  } catch {
    if (signal.aborted) throw new DOMException('操作已取消。', 'AbortError');
    return null;
  }
  if (response.status >= 300 && response.status < 400) return 'SDK 下载地址不允许重定向，请检查受控 HTTPS 直链。';
  if (!response.ok) return `SDK 下载地址预检失败：HTTP ${response.status}。`;
  if (!(response.url || url).startsWith('https://')) return 'SDK 下载地址预检返回了非 HTTPS 地址。';
  const contentLength = Number(response.headers.get('content-length') || '');
  if (Number.isFinite(contentLength) && contentLength > 0 && contentLength !== expectedBytes) {
    return `SDK 下载地址预检大小不匹配：${contentLength} / ${expectedBytes} 字节。`;
  }
  return null;
}

export function normalizeSdkProxyAddress(value: string): string | null {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//iu.test(trimmed) ? trimmed : `http://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  if (!parsed.hostname || !/^\d{1,5}$/u.test(port)) return null;
  const host = parsed.hostname.includes(':') ? `[${parsed.hostname}]` : parsed.hostname;
  return `http://${host}:${port}`;
}

const SDK_DOWNLOAD_PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy'] as const;

export function resolveSdkProxyFromEnvironment(environment: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of SDK_DOWNLOAD_PROXY_ENV_KEYS) {
    const proxy = normalizeSdkProxyAddress(String(environment[key] || ''));
    if (proxy) return proxy;
  }
  return null;
}

export function parseWindowsProxyServerValue(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!value.includes('=')) return normalizeSdkProxyAddress(value);
  let httpProxy: string | null = null;
  let httpsProxy: string | null = null;
  for (const segment of value.split(';')) {
    const separator = segment.indexOf('=');
    if (separator <= 0) continue;
    const scheme = segment.slice(0, separator).trim().toLowerCase();
    const address = segment.slice(separator + 1).trim();
    if (!address || address === '<local>') continue;
    // aria2c 只支持 HTTP 代理；socks= 条目无法用于下载，直接忽略。
    if (scheme !== 'http' && scheme !== 'https') continue;
    const normalized = normalizeSdkProxyAddress(address);
    if (!normalized) continue;
    if (scheme === 'https') httpsProxy ??= normalized;
    else httpProxy ??= normalized;
  }
  return httpsProxy ?? httpProxy;
}

const WININET_SETTINGS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

async function readWininetRegistryValue(name: string, execFileImpl: typeof execFileAsync): Promise<string | null> {
  try {
    const { stdout } = await execFileImpl('reg', ['query', WININET_SETTINGS_KEY, '/v', name], {
      windowsHide: true,
      timeout: 5_000
    });
    for (const line of String(stdout).split(/\r?\n/)) {
      const marker = line.indexOf(name);
      if (marker < 0) continue;
      return line.slice(marker + name.length).trim();
    }
  } catch {
    return null;
  }
  return null;
}

export async function resolveWindowsSystemProxy(
  execFileImpl: typeof execFileAsync = execFileAsync,
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  if (platform !== 'win32') return null;
  const enableRaw = await readWininetRegistryValue('ProxyEnable', execFileImpl);
  if (!/0x1\b/iu.test(enableRaw || '')) return null;
  const serverRaw = await readWininetRegistryValue('ProxyServer', execFileImpl);
  if (!serverRaw) return null;
  return parseWindowsProxyServerValue(serverRaw.replace(/^REG_SZ\b/iu, '').trim());
}

export async function resolveSdkDownloadProxy(
  environment: NodeJS.ProcessEnv = process.env,
  execFileImpl: typeof execFileAsync = execFileAsync,
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  return resolveSdkProxyFromEnvironment(environment) ?? await resolveWindowsSystemProxy(execFileImpl, platform);
}

export function describeAria2ExitCode(exitCode: number | null): string | null {
  switch (exitCode) {
    case 1: return '未知下载错误';
    case 2: return '下载超时';
    case 3: return '下载服务器上不存在该资源';
    case 5: return '存在未完成的下载分段';
    case 6: return '网络连接失败';
    case 7: return '下载被取消或中断';
    case 8: return '下载服务器不支持断点续传';
    case 9: return '磁盘空间不足';
    default: return null;
  }
}

export const SDK_DOWNLOAD_STALL_NOTICE_MS = 30_000;

export interface SdkDownloadStallTracker {
  observe(downloadedBytes: number): string | null;
}

export function createSdkDownloadStallTracker(
  options: { stallNoticeAfterMs?: number; now?: () => number } = {}
): SdkDownloadStallTracker {
  const threshold = Math.max(1_000, options.stallNoticeAfterMs ?? SDK_DOWNLOAD_STALL_NOTICE_MS);
  const now = options.now ?? (() => Date.now());
  let lastBytes = Number.NaN;
  let lastProgressAt = now();
  return {
    observe(downloadedBytes: number): string | null {
      const currentAt = now();
      if (downloadedBytes !== lastBytes) {
        lastBytes = downloadedBytes;
        lastProgressAt = currentAt;
        return null;
      }
      const stalledMs = currentAt - lastProgressAt;
      if (stalledMs < threshold) return null;
      return `已 ${Math.max(1, Math.round(stalledMs / 1000))} 秒未收到数据，可能在等待重连；若持续无进展，请检查网络或代理设置`;
    }
  };
}

interface SdkNetworkErrorPattern {
  pattern: RegExp;
  cause: string;
}

const SDK_NETWORK_ERROR_PATTERNS: readonly SdkNetworkErrorPattern[] = [
  { pattern: /spawn\s+\S*\s*(EACCES|EPERM)\b/iu, cause: '下载器启动被拒绝（权限不足或被安全软件拦截）' },
  { pattern: /\bspawn\b.*\bENOENT\b/iu, cause: '下载器程序缺失，可能被安全软件清理，请重新安装 LingBuilder' },
  { pattern: /ECONNREFUSED|Connection refused|拒绝连接/iu, cause: '连接被拒绝' },
  { pattern: /ENOTFOUND|getaddrinfo|Failed to resolve|Unable to resolve|Could not resolve|域名无法解析/iu, cause: '下载服务器域名无法解析' },
  { pattern: /ETIMEDOUT|timed? ?out|连接超时/iu, cause: '连接超时' },
  { pattern: /ECONNRESET|Connection reset|连接被重置/iu, cause: '连接被重置' },
  { pattern: /EHOSTUNREACH|ENETUNREACH|No route to host|unreachable|网络不可达/iu, cause: '网络不可达' },
  { pattern: /certificate|SSL|TLS|EPROTO|OpenSSL/iu, cause: 'HTTPS 证书或 TLS 握手失败' },
  { pattern: /fetch failed|network error|Network Error|ENETDOWN|ERR_INTERNET_DISCONNECTED|网络连接不可用/iu, cause: '网络连接不可用' }
];

export function translateSdkDownloadErrorText(message: string): string {
  const text = String(message || '');
  if (!text) return text;
  const matched = SDK_NETWORK_ERROR_PATTERNS.find(item => item.pattern.test(text));
  if (!matched) return text;
  const original = text.length > 240 ? `${text.slice(0, 240)}…` : text;
  return `无法连接下载服务器（${matched.cause}），请检查网络连接或代理设置后重试。（原始信息：${original}）`;
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
  const roots = new Set(inventory.roots);
  const isFlatArchive = roots.has('sdk') && roots.has('lingbuilder.module.json')
    && [...roots].every(root => root === 'sdk' || root === 'lingbuilder.module.json' || root === 'README.md');
  if (!isFlatArchive && (inventory.roots.length !== 1 || inventory.roots[0] !== resource.moduleId)) {
    throw new Error(`${resource.name} ZIP 顶层目录必须是 ${resource.moduleId}/。`);
  }
  if (inventory.fileCount !== resource.fileCount || inventory.expandedBytes !== resource.expandedBytes) {
    throw new Error(`${resource.name} ZIP 文件清单不匹配：${inventory.fileCount} 个文件 / ${inventory.expandedBytes} 字节。`);
  }
}

async function normalizeExtractedSdkModuleRoot(resource: SdkDependencyResource, stagingRoot: string): Promise<string> {
  const moduleRoot = path.join(stagingRoot, resource.moduleId);
  if (await pathExists(path.join(moduleRoot, 'sdk'))) return moduleRoot;
  const flatSdkRoot = path.join(stagingRoot, 'sdk');
  if (!await pathExists(flatSdkRoot) || !await pathExists(path.join(stagingRoot, 'lingbuilder.module.json'))) {
    return moduleRoot;
  }
  await fs.mkdir(moduleRoot, { recursive: true });
  await renameDirectoryWithRetry(flatSdkRoot, path.join(moduleRoot, 'sdk'));
  for (const name of ['lingbuilder.module.json', 'README.md']) {
    const source = path.join(stagingRoot, name);
    if (await pathExists(source)) await renameDirectoryWithRetry(source, path.join(moduleRoot, name));
  }
  return moduleRoot;
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
