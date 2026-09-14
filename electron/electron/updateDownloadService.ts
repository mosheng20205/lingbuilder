import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import type { VersionCheckResult } from './versionCheckService.js';

const execFileAsync = promisify(execFile);

/** 更新包大小硬上限：2 GiB，远大于当前安装包体积，用于挡住异常响应。 */
export const MAX_UPDATE_INSTALLER_BYTES = 2 * 1024 * 1024 * 1024;
export const UPDATER_ARIA2C_CONNECTIONS = 8;
export const UPDATER_ARIA2C_MIN_SPLIT_SIZE = '8M';
/** aria2c 退出码 15/16/17 表示文件被占用或读写失败，多为杀毒软件瞬时扫描下载中的安装包所致。 */
export const UPDATER_ARIA2C_FILE_LOCK_EXIT_CODES: ReadonlySet<number> = new Set([15, 16, 17]);
const UPDATER_FILE_LOCK_RETRY_DELAY_MS = 2_500;
const UPDATER_RENAME_RETRY_ATTEMPTS = 6;
const UPDATER_RENAME_RETRY_BASE_DELAY_MS = 250;
const UPDATER_PROGRESS_INTERVAL_MS = 500;
const UPDATER_TERMINATION_GRACE_MS = 2_000;
const UPDATER_SPAWN_PROBE_MS = 500;
const UPDATER_PROBE_TIMEOUT_MS = 15_000;

export type AppUpdateState = 'idle' | 'downloading' | 'verifying' | 'ready' | 'launching' | 'error';

export interface AppUpdateProgress {
  state: AppUpdateState;
  version?: string;
  downloadedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number | null;
  engine: 'aria2c' | 'fetch' | null;
  message?: string;
  error?: string;
  installerPath?: string;
}

export interface UpdaterChildProcess {
  readonly exitCode: number | null;
  kill(signal?: NodeJS.Signals | number): boolean;
  once(event: 'error', listener: (error: Error) => void): this;
  once(event: 'close', listener: (code: number | null, signal: NodeJS.Signals | null) => void): this;
  stderr: { on(event: 'data', listener: (chunk: unknown) => void): unknown } | null;
  unref(): void;
}

export type UpdaterSpawn = typeof spawn;
export type UpdaterExecFile = (file: string, args: string[], options: { windowsHide?: boolean; timeout?: number }) => Promise<{ stdout: string }>;

export interface UpdateDownloadServiceOptions {
  updatesDir: string;
  isPackaged: boolean;
  resourcesPath?: string;
  fetchImpl?: typeof fetch;
  spawnImpl?: UpdaterSpawn;
  execFileImpl?: UpdaterExecFile;
  now?: () => number;
  /** 仅开发态本地端到端测试允许 HTTP 直链；打包版必须 HTTPS。 */
  allowInsecureUrl?: boolean;
  onProgress?: (progress: AppUpdateProgress) => void;
}

interface UpdaterJob {
  info: VersionCheckResult;
  controller: AbortController;
  destination: string;
  promise: Promise<void>;
}

function updaterError(message: string) {
  return new Error(message);
}

export function resolveBundledUpdaterAria2cPath(isPackaged: boolean, resourcesPath?: string, devRoot?: string): string {
  const root = isPackaged && resourcesPath
    ? path.resolve(resourcesPath)
    : path.resolve(devRoot || path.join(process.cwd(), 'electron'));
  return path.join(root, 'third_party', 'aria2', 'aria2c.exe');
}

export function createUpdaterAria2cArguments(url: string, destination: string, proxy?: string | null): string[] {
  const args = [
    '--continue=true',
    '--allow-overwrite=true',
    '--auto-file-renaming=false',
    '--file-allocation=none',
    `--max-connection-per-server=${UPDATER_ARIA2C_CONNECTIONS}`,
    `--split=${UPDATER_ARIA2C_CONNECTIONS}`,
    `--min-split-size=${UPDATER_ARIA2C_MIN_SPLIT_SIZE}`,
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

export function assertHttpsUpdaterUrl(url: string, allowInsecureUrl = false): string {
  const trimmed = String(url || '').trim();
  if (!trimmed) throw updaterError('更新包下载地址为空，请前往官网手动下载。');
  if (allowInsecureUrl && /^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?\//iu.test(`${trimmed}/`)) return trimmed;
  if (!trimmed.startsWith('https://')) throw updaterError('更新包下载地址必须使用 HTTPS。');
  return trimmed;
}

export function parseContentLength(header: string | null): number | null {
  const value = Number(String(header ?? '').trim());
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function assertUpdaterSizeWithinLimit(bytes: number): void {
  if (!Number.isSafeInteger(bytes) || bytes <= 0) throw updaterError('更新包大小信息无效。');
  if (bytes > MAX_UPDATE_INSTALLER_BYTES) throw updaterError('更新包大小超过 2GB 上限，请前往官网手动下载。');
}

export function normalizeUpdaterSha256(value: unknown): string | null {
  const result = String(value ?? '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/u.test(result) ? result : null;
}

export function buildUpdaterFileName(version: string): string {
  const safeVersion = String(version || '').trim().replace(/[^0-9A-Za-z.+-]/gu, '-') || 'latest';
  return `LingBuilder-${safeVersion}-x64.exe`;
}

export async function verifyInstallerSha256(filePath: string, expected: string): Promise<boolean> {
  const hash = crypto.createHash('sha256');
  try {
    const stream = fsSync.createReadStream(filePath);
    for await (const chunk of stream) hash.update(chunk as Buffer);
  } catch {
    return false;
  }
  return hash.digest('hex') === expected.toLowerCase();
}

export function describeAria2cExitMessage(exitCode: number | null): string | null {
  switch (exitCode) {
    case 1: return '未知下载错误';
    case 2: return '下载超时';
    case 3: return '下载服务器上不存在该资源';
    case 4: return '多次找不到下载资源';
    case 5: return '下载速度过低被中止';
    case 6: return '网络连接失败';
    case 7: return '下载被取消或中断';
    case 8: return '下载服务器不支持断点续传';
    case 9: return '磁盘空间不足';
    case 10: return '下载分段大小与续传记录不一致';
    case 11: return '该文件已在下载中';
    case 13: return '目标文件已存在';
    case 14: return '下载器重命名文件失败';
    case 15: return '下载器无法打开已下载的文件，可能被杀毒软件或其它程序临时占用';
    case 16: return '下载器无法创建写入文件，可能被其它程序占用或权限不足';
    case 17: return '下载器读写文件失败';
    default: return null;
  }
}

const UPDATER_NETWORK_ERROR_PATTERNS: ReadonlyArray<{ pattern: RegExp; cause: string; advice?: string }> = [
  { pattern: /spawn\s+\S*\s*(EACCES|EPERM)\b/iu, cause: '下载器启动被拒绝（权限不足或被安全软件拦截）' },
  { pattern: /\bspawn\b.*\bENOENT\b/iu, cause: '下载器程序缺失，可能被安全软件清理，请重新安装 LingBuilder' },
  { pattern: /ECONNREFUSED|Connection refused|拒绝连接/iu, cause: '连接被拒绝' },
  { pattern: /ENOTFOUND|getaddrinfo|Failed to resolve|Unable to resolve|Could not resolve|域名无法解析/iu, cause: '下载服务器域名无法解析' },
  { pattern: /ETIMEDOUT|timed? ?out|连接超时/iu, cause: '连接超时' },
  { pattern: /ECONNRESET|Connection reset|连接被重置/iu, cause: '连接被重置' },
  { pattern: /EHOSTUNREACH|ENETUNREACH|No route to host|unreachable|网络不可达/iu, cause: '网络不可达' },
  { pattern: /certificate|SSL|TLS|EPROTO|OpenSSL/iu, cause: 'HTTPS 证书或 TLS 握手失败' },
  { pattern: /fetch failed|network error|Network Error|ENETDOWN|ERR_INTERNET_DISCONNECTED|网络连接不可用/iu, cause: '网络连接不可用' },
  { pattern: /\bEBUSY\b|resource busy or locked/iu, cause: '更新包文件被其它程序占用，可能是杀毒软件正在扫描或旧的安装包正在运行', advice: '请稍候重试，已保留的下载进度可续传' },
  { pattern: /\bEPERM\b|operation not permitted/iu, cause: '更新包文件写入权限不足，可能被安全软件拦截', advice: '请检查安全软件设置后重试' }
];

export function describeUpdaterDownloadError(message: string): string {
  const text = String(message || '');
  if (!text) return text;
  const matched = UPDATER_NETWORK_ERROR_PATTERNS.find(item => item.pattern.test(text));
  if (!matched) return text;
  const original = text.length > 240 ? `${text.slice(0, 240)}…` : text;
  const advice = matched.advice || '请检查网络连接或代理设置后重试';
  return `更新包下载失败（${matched.cause}），${advice}。（原始信息：${original}）`;
}

export async function removeFileWithRetry(target: string, attempts = 4): Promise<void> {
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
  throw lastError instanceof Error ? lastError : updaterError(`无法删除文件：${target}`);
}

/** Windows 上杀毒软件会短暂持有新落地文件（无 FILE_SHARE_DELETE），rename 报 EBUSY/EPERM/EACCES：退避重试等待扫描结束。 */
export async function renameFileWithRetry(
  source: string,
  destination: string,
  attempts: number = UPDATER_RENAME_RETRY_ATTEMPTS,
  renameImpl: (from: string, to: string) => Promise<void> = (from, to) => fs.rename(from, to),
  delayImpl: (ms: number) => Promise<void> = ms => new Promise<void>(resolve => setTimeout(resolve, ms))
): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await renameImpl(source, destination);
      return;
    } catch (error) {
      lastError = error;
      const code = (error as NodeJS.ErrnoException).code;
      if ((code !== 'EBUSY' && code !== 'EPERM' && code !== 'EACCES') || attempt === attempts - 1) break;
      await delayImpl(UPDATER_RENAME_RETRY_BASE_DELAY_MS * 2 ** attempt);
    }
  }
  throw lastError instanceof Error ? lastError : updaterError(`无法移动文件：${source}`);
}

function abortableDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      resolve();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

const UPDATER_PROXY_ENV_KEYS = ['HTTPS_PROXY', 'https_proxy', 'ALL_PROXY', 'all_proxy'] as const;

export function normalizeUpdaterProxyAddress(value: string): string | null {
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

export function parseWindowsProxyServerValue(raw: string): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (!value.includes('=')) return normalizeUpdaterProxyAddress(value);
  let httpProxy: string | null = null;
  let httpsProxy: string | null = null;
  for (const segment of value.split(';')) {
    const separator = segment.indexOf('=');
    if (separator <= 0) continue;
    const scheme = segment.slice(0, separator).trim().toLowerCase();
    const address = segment.slice(separator + 1).trim();
    if (!address || address === '<local>') continue;
    if (scheme !== 'http' && scheme !== 'https') continue;
    const normalized = normalizeUpdaterProxyAddress(address);
    if (!normalized) continue;
    if (scheme === 'https') httpsProxy ??= normalized;
    else httpProxy ??= normalized;
  }
  return httpsProxy ?? httpProxy;
}

const WININET_SETTINGS_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

async function readWininetRegistryValue(name: string, execFileImpl: UpdaterExecFile): Promise<string | null> {
  try {
    const { stdout } = await execFileImpl('reg', ['query', WININET_SETTINGS_KEY, '/v', name], { windowsHide: true, timeout: 5_000 });
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

export async function resolveUpdaterProxy(
  environment: NodeJS.ProcessEnv = process.env,
  execFileImpl: UpdaterExecFile = execFileAsync as UpdaterExecFile,
  platform: NodeJS.Platform = process.platform
): Promise<string | null> {
  for (const key of UPDATER_PROXY_ENV_KEYS) {
    const proxy = normalizeUpdaterProxyAddress(String(environment[key] || ''));
    if (proxy) return proxy;
  }
  if (platform !== 'win32') return null;
  const enableRaw = await readWininetRegistryValue('ProxyEnable', execFileImpl).catch(() => null);
  if (!/0x1\b/iu.test(enableRaw || '')) return null;
  const serverRaw = await readWininetRegistryValue('ProxyServer', execFileImpl).catch(() => null);
  if (!serverRaw) return null;
  return parseWindowsProxyServerValue(serverRaw.replace(/^REG_SZ\b/iu, '').trim());
}

async function waitForChildExit(child: UpdaterChildProcess, signal: AbortSignal): Promise<{ code: number | null; spawnFailed?: Error }> {
  return await new Promise((resolve, reject) => {
    let settled = false;
    let terminationTimer: NodeJS.Timeout | null = null;
    const finish = (value: { code: number | null; spawnFailed?: Error }) => {
      if (settled) return;
      settled = true;
      if (terminationTimer) clearTimeout(terminationTimer);
      signal.removeEventListener('abort', abort);
      resolve(value);
    };
    const abort = () => {
      try { child.kill('SIGTERM'); } catch { /* close 事件决定最终状态 */ }
      terminationTimer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* 进程可能已退出 */ }
      }, UPDATER_TERMINATION_GRACE_MS);
    };
    signal.addEventListener('abort', abort, { once: true });
    child.once('error', error => finish({ code: null, spawnFailed: error }));
    child.once('close', code => finish({ code }));
  });
}

export class UpdateDownloadService {
  private readonly updatesDir: string;
  private readonly options: UpdateDownloadServiceOptions;
  private job: UpdaterJob | null = null;
  private progress: AppUpdateProgress = { state: 'idle', downloadedBytes: 0, totalBytes: null, bytesPerSecond: null, engine: null };

  constructor(options: UpdateDownloadServiceOptions) {
    this.options = options;
    this.updatesDir = options.updatesDir;
  }

  isBusy(): boolean {
    return this.job !== null;
  }

  status(): AppUpdateProgress {
    return this.progress;
  }

  private emit(progress: AppUpdateProgress): void {
    this.progress = progress;
    this.options.onProgress?.(progress);
  }

  private emitState(patch: Partial<AppUpdateProgress>): void {
    this.emit({ ...this.progress, ...patch });
  }

  async cleanupAbandoned(): Promise<void> {
    await fs.rm(this.updatesDir, { recursive: true, force: true }).catch(() => undefined);
  }

  async download(info: VersionCheckResult): Promise<{ ok: boolean; alreadyRunning?: boolean; alreadyDownloaded?: boolean; error?: string }> {
    if (!info.ok || !info.latestVersion || !info.hasUpdate) return { ok: false, error: '当前没有可安装的更新。' };
    if (this.job) {
      if (this.job.info.latestVersion === info.latestVersion) return { ok: true, alreadyRunning: true };
      return { ok: false, error: `正在下载 v${this.job.info.latestVersion} 的更新，请先取消或等待完成。` };
    }
    const expectedSha256 = normalizeUpdaterSha256(info.sha256);
    if (!expectedSha256) return { ok: false, error: '云端未提供安装包校验值，为安全起见不支持应用内下载，请前往官网手动下载。' };
    if (!info.downloadUrl) return { ok: false, error: '云端未提供安装包直链，请前往官网手动下载。' };
    let url: string;
    try {
      url = assertHttpsUpdaterUrl(String(info.downloadUrl), this.options.allowInsecureUrl === true);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }

    const destination = path.join(this.updatesDir, buildUpdaterFileName(info.latestVersion));
    if (await verifyInstallerSha256(destination, expectedSha256)) {
      this.emit({ state: 'ready', version: info.latestVersion, downloadedBytes: 0, totalBytes: null, bytesPerSecond: null, engine: null, message: '更新包已下载并通过完整性校验。', installerPath: destination });
      return { ok: true, alreadyDownloaded: true };
    }

    const controller = new AbortController();
    const job: UpdaterJob = { info, controller, destination, promise: Promise.resolve() };
    this.job = job;
    this.emit({ state: 'downloading', version: info.latestVersion, downloadedBytes: 0, totalBytes: null, bytesPerSecond: null, engine: null, message: '正在准备下载更新包…' });
    job.promise = this.runDownload(job, url, expectedSha256)
      .catch(error => {
        if (controller.signal.aborted) {
          this.emit({ state: 'idle', version: info.latestVersion, downloadedBytes: 0, totalBytes: null, bytesPerSecond: null, engine: null, message: '已取消下载。' });
          return;
        }
        const message = describeUpdaterDownloadError(error instanceof Error ? error.message : String(error));
        this.emit({ state: 'error', version: info.latestVersion, downloadedBytes: this.progress.downloadedBytes, totalBytes: this.progress.totalBytes, bytesPerSecond: null, engine: null, error: message });
      })
      .finally(() => {
        if (this.job === job) this.job = null;
      });
    return { ok: true };
  }

  cancel(): boolean {
    const job = this.job;
    if (!job) return false;
    job.controller.abort();
    return true;
  }

  async install(): Promise<{ ok: boolean; error?: string }> {
    const installerPath = this.progress.state === 'ready' ? this.progress.installerPath : undefined;
    if (!installerPath) return { ok: false, error: '还没有完成下载的更新包。' };
    try {
      const stat = await fs.stat(installerPath);
      if (!stat.isFile()) throw updaterError('目标不是文件。');
    } catch {
      this.emitState({ state: 'error', error: `找不到已下载的更新包，请重新下载。` });
      return { ok: false, error: '找不到已下载的更新包，请重新下载。' };
    }
    this.emitState({ state: 'launching', message: '正在启动安装程序，LingBuilder 即将退出…' });
    const spawnImpl = this.options.spawnImpl || spawn;
    let spawnError: Error | null = null;
    const child = spawnImpl(installerPath, [], { detached: true, stdio: 'ignore', windowsHide: true }) as unknown as UpdaterChildProcess;
    child.once('error', error => { spawnError = error; });
    try { child.unref(); } catch { /* 平台不支持 unref 时忽略 */ }
    const failure = await new Promise<Error | null>(resolve => {
      const timer = setTimeout(() => {
        clearInterval(check);
        resolve(null);
      }, UPDATER_SPAWN_PROBE_MS);
      const check = setInterval(() => {
        if (spawnError) {
          clearTimeout(timer);
          clearInterval(check);
          resolve(spawnError);
        }
      }, 50);
    });
    if (failure) {
      this.emitState({ state: 'error', error: `无法启动安装程序（${failure.message}）。请手动运行：${installerPath}` });
      return { ok: false, error: `无法启动安装程序（${failure.message}）。请手动运行：${installerPath}` };
    }
    return { ok: true };
  }

  private async runDownload(job: UpdaterJob, url: string, expectedSha256: string): Promise<void> {
    const partFile = `${job.destination}.part`;
    const controlFile = `${partFile}.aria2`;
    await fs.mkdir(this.updatesDir, { recursive: true });
    const totalBytes = await this.probeContentLength(url, job.controller.signal);
    if (totalBytes !== null) assertUpdaterSizeWithinLimit(totalBytes);
    this.emitState({ totalBytes, message: '正在下载更新包…' });

    // 快路径：本地已有完整大小的 .part（常见于上一次改名被杀毒软件短暂占用），直接校验落位，不必重启下载器。
    const partStat = await fs.stat(partFile).catch(() => null);
    if (partStat && totalBytes !== null && partStat.size === totalBytes) {
      this.emitState({ state: 'verifying', message: '正在校验安装包完整性…', bytesPerSecond: null });
      if (await verifyInstallerSha256(partFile, expectedSha256)) {
        await this.promoteVerifiedPart(job, partFile, controlFile, expectedSha256, totalBytes);
        return;
      }
      // 校验不过说明旧分段残缺，交给下载器按续传记录修复。
    }

    const aria2cPath = resolveBundledUpdaterAria2cPath(this.options.isPackaged, this.options.resourcesPath);
    const aria2cAvailable = await fs.stat(aria2cPath).then(stat => stat.isFile()).catch(() => false);
    if (aria2cAvailable) {
      await this.downloadWithAria2c(job, url, aria2cPath, partFile, controlFile, totalBytes);
    } else {
      await this.downloadWithFetch(job, url, partFile, totalBytes);
    }
    this.emitState({ state: 'verifying', message: '正在校验安装包完整性…', bytesPerSecond: null });
    if (!await verifyInstallerSha256(partFile, expectedSha256)) {
      await removeFileWithRetry(partFile).catch(() => undefined);
      await removeFileWithRetry(controlFile).catch(() => undefined);
      throw updaterError('安装包 SHA-256 校验失败，已删除下载内容。请重试，或前往官网手动下载。');
    }
    await this.promoteVerifiedPart(job, partFile, controlFile, expectedSha256, totalBytes);
  }

  /** 把已通过校验的 .part 落位为最终安装包：改名被占用时退避重试，仍失败再走复制兜底；全部失败给中文诊断并保留续传断点。 */
  private async promoteVerifiedPart(job: UpdaterJob, partFile: string, controlFile: string, expectedSha256: string, totalBytes: number | null): Promise<void> {
    await removeFileWithRetry(job.destination).catch(() => undefined);
    try {
      await renameFileWithRetry(partFile, job.destination);
    } catch {
      // 源文件被杀毒软件短期持有时 rename 报 sharing violation，但内容仍可读：复制一份落位。
      try {
        await fs.copyFile(partFile, job.destination);
        if (!await verifyInstallerSha256(job.destination, expectedSha256)) throw updaterError('安装包 SHA-256 校验失败。');
      } catch {
        throw updaterError('更新包被其它程序占用，无法完成落位（可能是杀毒软件正在扫描，或已下载的安装包正在运行）。下载进度已保留，请稍候重试，或前往官网手动下载。');
      }
    }
    await removeFileWithRetry(controlFile).catch(() => undefined);
    await removeFileWithRetry(partFile).catch(() => undefined);
    this.emit({ state: 'ready', version: job.info.latestVersion, downloadedBytes: 0, totalBytes, bytesPerSecond: null, engine: null, message: '更新包已下载并通过完整性校验。', installerPath: job.destination });
  }

  /** 不跟随重定向的 HEAD 预检：网络层失败不阻断（交给下载引擎实测），但重定向/非 2xx 直接给中文诊断。 */
  private async probeContentLength(url: string, signal: AbortSignal): Promise<number | null> {
    const doFetch = this.options.fetchImpl || fetch;
    const combined = AbortSignal.any([signal, AbortSignal.timeout(UPDATER_PROBE_TIMEOUT_MS)]);
    let response: Response;
    try {
      response = await doFetch(url, { method: 'HEAD', redirect: 'manual', signal: combined });
    } catch {
      if (signal.aborted) throw new DOMException('操作已取消。', 'AbortError');
      return null;
    }
    if (response.status >= 300 && response.status < 400) throw updaterError('更新包下载地址发生重定向，请检查官网直链配置。');
    if (!response.ok) return null;
    const length = parseContentLength(response.headers.get('content-length'));
    return length;
  }

  private async downloadWithAria2c(job: UpdaterJob, url: string, aria2cPath: string, partFile: string, controlFile: string, totalBytes: number | null): Promise<void> {
    const signal = job.controller.signal;
    const controlExists = await fs.stat(controlFile).then(() => true).catch(() => false);
    const partStat = await fs.stat(partFile).catch(() => null);
    if (partStat) {
      const resumePossible = controlExists && (totalBytes === null || partStat.size <= totalBytes);
      if (!resumePossible) {
        await removeFileWithRetry(partFile).catch(() => undefined);
        await removeFileWithRetry(controlFile).catch(() => undefined);
      }
    } else {
      await removeFileWithRetry(controlFile).catch(() => undefined);
    }
    const proxy = await resolveUpdaterProxy(process.env, this.options.execFileImpl).catch(() => null);
    const spawnImpl = this.options.spawnImpl || spawn;
    let fileLockRetriesLeft = 1;
    for (;;) {
      const args = createUpdaterAria2cArguments(url, partFile, proxy);
      const child = spawnImpl(aria2cPath, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }) as unknown as UpdaterChildProcess;
      let stderr = '';
      child.stderr?.on('data', chunk => {
        stderr += String(chunk);
        if (stderr.length > 8 * 1024) stderr = stderr.slice(-8 * 1024);
      });

      let previousBytes = (await fs.stat(partFile).catch(() => null))?.size ?? 0;
      let previousAt = this.options.now?.() ?? Date.now();
      const reportProgress = async (): Promise<void> => {
        if (signal.aborted) return;
        let downloaded = previousBytes;
        try {
          const stat = await fs.stat(partFile);
          downloaded = totalBytes === null ? stat.size : Math.min(totalBytes, stat.size);
        } catch {
          downloaded = previousBytes;
        }
        const now = this.options.now?.() ?? Date.now();
        const elapsedSeconds = Math.max(0.001, (now - previousAt) / 1000);
        const bytesPerSecond = Math.max(0, Math.round((downloaded - previousBytes) / elapsedSeconds));
        previousBytes = downloaded;
        previousAt = now;
        this.emitState({ downloadedBytes: downloaded, bytesPerSecond, engine: 'aria2c' });
      };
      const progressTimer = setInterval(() => { void reportProgress(); }, UPDATER_PROGRESS_INTERVAL_MS);
      try {
        const completion = await waitForChildExit(child, signal);
        if (signal.aborted) {
          await removeFileWithRetry(partFile).catch(() => undefined);
          await removeFileWithRetry(controlFile).catch(() => undefined);
          throw new DOMException('操作已取消。', 'AbortError');
        }
        if (completion.spawnFailed) throw completion.spawnFailed;
        if (completion.code !== 0) {
          // 退出码 15/16/17 多为杀毒软件瞬时占用下载文件：等待片刻自动重试一次，断点不丢。
          if (completion.code !== null && UPDATER_ARIA2C_FILE_LOCK_EXIT_CODES.has(completion.code) && fileLockRetriesLeft > 0) {
            fileLockRetriesLeft -= 1;
            await abortableDelay(UPDATER_FILE_LOCK_RETRY_DELAY_MS, signal);
            if (signal.aborted) {
              await removeFileWithRetry(partFile).catch(() => undefined);
              await removeFileWithRetry(controlFile).catch(() => undefined);
              throw new DOMException('操作已取消。', 'AbortError');
            }
            continue;
          }
          const reason = describeAria2cExitMessage(completion.code);
          const detail = stderr.trim().replace(/\s+/gu, ' ').slice(-240);
          throw updaterError(`aria2c 下载未完成${reason ? `：${reason}` : ''}（退出码 ${completion.code ?? '未知'}）。已保留下载进度，重试可续传。${detail ? ` 下载器信息：${detail}` : ''}`);
        }
        await reportProgress();
        return;
      } finally {
        clearInterval(progressTimer);
      }
    }
  }

  private async downloadWithFetch(job: UpdaterJob, url: string, partFile: string, totalBytes: number | null): Promise<void> {
    const signal = job.controller.signal;
    const doFetch = this.options.fetchImpl || fetch;
    const response = await doFetch(url, { redirect: 'follow', signal });
    if (!response.ok || !response.body) throw updaterError(`更新包下载失败：HTTP ${response.status}。`);
    const temporaryPath = `${partFile}.${crypto.randomBytes(6).toString('hex')}.partial`;
    const handle = await fs.open(temporaryPath, 'wx');
    const hash = crypto.createHash('sha256');
    let downloaded = 0;
    let previousBytes = 0;
    let previousAt = this.options.now?.() ?? Date.now();
    const progressTimer = setInterval(() => {
      if (signal.aborted) return;
      const now = this.options.now?.() ?? Date.now();
      const elapsedSeconds = Math.max(0.001, (now - previousAt) / 1000);
      const bytesPerSecond = Math.max(0, Math.round((downloaded - previousBytes) / elapsedSeconds));
      previousBytes = downloaded;
      previousAt = now;
      this.emitState({ downloadedBytes: downloaded, bytesPerSecond, engine: 'fetch' });
    }, UPDATER_PROGRESS_INTERVAL_MS);
    try {
      for await (const rawChunk of response.body as unknown as AsyncIterable<unknown>) {
        if (signal.aborted) throw new DOMException('操作已取消。', 'AbortError');
        const chunk = Buffer.from(rawChunk as ArrayBuffer);
        downloaded += chunk.length;
        if (downloaded > MAX_UPDATE_INSTALLER_BYTES) throw updaterError('更新包大小超过 2GB 上限，请前往官网手动下载。');
        hash.update(chunk);
        await handle.write(chunk);
      }
      await handle.close();
      if (totalBytes !== null && downloaded !== totalBytes) throw updaterError(`更新包下载不完整：${downloaded} / ${totalBytes} 字节。`);
      if (hash.digest('hex') !== normalizeUpdaterSha256(job.info.sha256)) {
        throw updaterError('安装包 SHA-256 校验失败，已删除下载内容。请重试，或前往官网手动下载。');
      }
      await removeFileWithRetry(partFile).catch(() => undefined);
      await renameFileWithRetry(temporaryPath, partFile);
    } catch (error) {
      await handle.close().catch(() => undefined);
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw error;
    } finally {
      clearInterval(progressTimer);
    }
  }
}
