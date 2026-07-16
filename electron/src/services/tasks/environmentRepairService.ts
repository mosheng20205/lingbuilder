import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs, { promises as fsPromises } from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

export type EnvironmentRepairTarget = 'cppBuildTools' | 'webView2';
export type EnvironmentRepairState = 'idle' | 'downloading' | 'installing' | 'succeeded' | 'failed';

export interface EnvironmentRepairSnapshot {
  id: string | null;
  target: EnvironmentRepairTarget | null;
  state: EnvironmentRepairState;
  active: boolean;
  progress: number | null;
  message: string;
  startedAt: string | null;
  finishedAt: string | null;
  exitCode: number | null;
  requiresRestart: boolean;
}

export interface EnvironmentRepairInstallerResult {
  exitCode: number;
}

export interface EnvironmentRepairDependencies {
  platform?: NodeJS.Platform;
  temporaryRoot?: string;
  now?: () => Date;
  download?: (url: string, destination: string, onProgress: (progress: number | null) => void) => Promise<void>;
  verify?: (executablePath: string) => Promise<void>;
  install?: (executablePath: string, args: readonly string[]) => Promise<EnvironmentRepairInstallerResult>;
}

interface ResolvedEnvironmentRepairDependencies {
  platform: NodeJS.Platform;
  temporaryRoot: string;
  now: () => Date;
  download: NonNullable<EnvironmentRepairDependencies['download']>;
  verify: NonNullable<EnvironmentRepairDependencies['verify']>;
  install: NonNullable<EnvironmentRepairDependencies['install']>;
}

const REPAIR_PLANS: Record<EnvironmentRepairTarget, {
  downloadUrl: string;
  fileName: string;
  args: readonly string[];
  downloadingMessage: string;
  installingMessage: string;
}> = {
  cppBuildTools: {
    downloadUrl: 'https://aka.ms/vs/17/release/vs_BuildTools.exe',
    fileName: 'vs_BuildTools.exe',
    args: [
      '--add',
      'Microsoft.VisualStudio.Workload.VCTools',
      '--includeRecommended',
      '--passive',
      '--wait',
      '--norestart'
    ],
    downloadingMessage: '正在从微软官方下载 Visual Studio Build Tools 引导程序…',
    installingMessage: '正在安装 MSVC、Windows SDK 和 CMake；请按系统提示授权并等待安装完成。'
  },
  webView2: {
    downloadUrl: 'https://go.microsoft.com/fwlink/p/?LinkId=2124703',
    fileName: 'MicrosoftEdgeWebview2Setup.exe',
    args: ['/silent', '/install'],
    downloadingMessage: '正在从微软官方下载 WebView2 Evergreen Bootstrapper…',
    installingMessage: '正在安装 WebView2 Runtime…'
  }
};

const IDLE_SNAPSHOT: EnvironmentRepairSnapshot = {
  id: null,
  target: null,
  state: 'idle',
  active: false,
  progress: null,
  message: '当前没有环境修复任务。',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  requiresRestart: false
};

export class EnvironmentRepairBusyError extends Error {
  constructor() {
    super('已有环境修复任务正在进行，请等待完成后再试。');
    this.name = 'EnvironmentRepairBusyError';
  }
}

/** 只运行 LingBuilder 固定声明的微软安装器，不接受外部命令、URL 或参数。 */
export class EnvironmentRepairService {
  private readonly dependencies: ResolvedEnvironmentRepairDependencies;
  private snapshot: EnvironmentRepairSnapshot = { ...IDLE_SNAPSHOT };

  constructor(dependencies: EnvironmentRepairDependencies = {}) {
    this.dependencies = {
      platform: dependencies.platform || process.platform,
      temporaryRoot: dependencies.temporaryRoot || os.tmpdir(),
      now: dependencies.now || (() => new Date()),
      download: dependencies.download || downloadMicrosoftInstaller,
      verify: dependencies.verify || verifyMicrosoftAuthenticodeSignature,
      install: dependencies.install || runMicrosoftInstaller
    };
  }

  status(): EnvironmentRepairSnapshot {
    return { ...this.snapshot };
  }

  start(target: EnvironmentRepairTarget): EnvironmentRepairSnapshot {
    if (this.snapshot.active) throw new EnvironmentRepairBusyError();
    if (this.dependencies.platform !== 'win32') {
      throw new Error('环境一键修复目前仅支持 Windows。');
    }
    const plan = REPAIR_PLANS[target];
    if (!plan) throw new Error('不支持的环境修复目标。');

    const startedAt = this.dependencies.now().toISOString();
    this.snapshot = {
      id: crypto.randomUUID(),
      target,
      state: 'downloading',
      active: true,
      progress: 0,
      message: plan.downloadingMessage,
      startedAt,
      finishedAt: null,
      exitCode: null,
      requiresRestart: false
    };
    void this.execute(plan);
    return this.status();
  }

  private async execute(plan: typeof REPAIR_PLANS[EnvironmentRepairTarget]): Promise<void> {
    const jobId = this.snapshot.id!;
    const jobDirectory = path.join(this.dependencies.temporaryRoot, `lingbuilder-environment-repair-${jobId}`);
    const installerPath = path.join(jobDirectory, plan.fileName);
    try {
      await fsPromises.mkdir(jobDirectory, { recursive: true });
      await this.dependencies.download(plan.downloadUrl, installerPath, progress => {
        if (this.snapshot.id !== jobId || this.snapshot.state !== 'downloading') return;
        this.snapshot = { ...this.snapshot, progress };
      });
      if (this.snapshot.id !== jobId) return;
      this.snapshot = {
        ...this.snapshot,
        progress: 100,
        message: '正在验证微软安装程序数字签名…'
      };
      await this.dependencies.verify(installerPath);
      if (this.snapshot.id !== jobId) return;
      this.snapshot = {
        ...this.snapshot,
        state: 'installing',
        progress: null,
        message: plan.installingMessage
      };
      const result = await this.dependencies.install(installerPath, plan.args);
      const succeeded = result.exitCode === 0 || result.exitCode === 1641 || result.exitCode === 3010;
      this.snapshot = {
        ...this.snapshot,
        state: succeeded ? 'succeeded' : 'failed',
        active: false,
        progress: succeeded ? 100 : null,
        message: succeeded
          ? '环境安装已完成，LingBuilder 已准备重新检测。'
          : `微软安装程序退出码为 ${result.exitCode}，请查看安装器界面或日志后重试。`,
        finishedAt: this.dependencies.now().toISOString(),
        exitCode: result.exitCode,
        requiresRestart: result.exitCode === 1641 || result.exitCode === 3010
      };
    } catch (error) {
      this.snapshot = {
        ...this.snapshot,
        state: 'failed',
        active: false,
        progress: null,
        message: error instanceof Error ? error.message : '环境修复失败。',
        finishedAt: this.dependencies.now().toISOString(),
        exitCode: null,
        requiresRestart: false
      };
    } finally {
      await fsPromises.rm(jobDirectory, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function isEnvironmentRepairTarget(value: unknown): value is EnvironmentRepairTarget {
  return value === 'cppBuildTools' || value === 'webView2';
}

async function downloadMicrosoftInstaller(
  url: string,
  destination: string,
  onProgress: (progress: number | null) => void
): Promise<void> {
  const temporary = `${destination}.part`;
  await fsPromises.rm(temporary, { force: true });
  try {
    await downloadHttpsRedirect(url, temporary, onProgress, 0);
    const handle = await fsPromises.open(temporary, 'r');
    try {
      const signature = Buffer.alloc(2);
      await handle.read(signature, 0, 2, 0);
      if (signature.toString('ascii') !== 'MZ') throw new Error('微软安装程序下载内容不是有效的 Windows 可执行文件。');
    } finally {
      await handle.close();
    }
    await fsPromises.rename(temporary, destination);
  } catch (error) {
    await fsPromises.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function downloadHttpsRedirect(
  value: string,
  destination: string,
  onProgress: (progress: number | null) => void,
  redirectCount: number
): Promise<void> {
  if (redirectCount > 8) throw new Error('微软安装程序下载重定向次数过多。');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !isMicrosoftDownloadHost(url.hostname)) {
    throw new Error('环境修复拒绝访问非微软 HTTPS 下载地址。');
  }

  await new Promise<void>((resolve, reject) => {
    const request = https.get(url, { timeout: 30_000 }, response => {
      const statusCode = response.statusCode || 0;
      if (statusCode >= 300 && statusCode < 400 && response.headers.location) {
        response.resume();
        const nextUrl = new URL(response.headers.location, url).toString();
        void downloadHttpsRedirect(nextUrl, destination, onProgress, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (statusCode !== 200) {
        response.resume();
        reject(new Error(`微软安装程序下载失败：HTTP ${statusCode}。`));
        return;
      }
      const total = Number(response.headers['content-length'] || 0);
      if (total > 32 * 1024 * 1024) {
        response.resume();
        reject(new Error('微软安装引导程序大小超过安全限制。'));
        return;
      }
      let received = 0;
      const output = fs.createWriteStream(destination, { flags: 'w' });
      response.on('data', chunk => {
        received += Buffer.byteLength(chunk);
        if (received > 32 * 1024 * 1024) {
          request.destroy(new Error('微软安装引导程序大小超过安全限制。'));
          return;
        }
        onProgress(total > 0 ? Math.min(99, Math.round((received / total) * 100)) : null);
      });
      response.on('error', reject);
      output.on('error', reject);
      output.on('finish', () => output.close(() => resolve()));
      response.pipe(output);
    });
    request.on('timeout', () => request.destroy(new Error('下载微软安装程序超时。')));
    request.on('error', reject);
  });
}

function isMicrosoftDownloadHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'aka.ms'
    || normalized === 'go.microsoft.com'
    || normalized === 'microsoft.com'
    || normalized.endsWith('.microsoft.com');
}

async function verifyMicrosoftAuthenticodeSignature(executablePath: string): Promise<void> {
  const verificationScript = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:LINGBUILDER_INSTALLER_PATH",
    "if ($signature.Status -ne 'Valid') { Write-Error ('签名状态：' + $signature.Status); exit 1 }",
    "if ($signature.SignerCertificate.Subject -notmatch 'Microsoft') { Write-Error '签名发布者不是 Microsoft'; exit 1 }"
  ].join('; ');
  await new Promise<void>((resolve, reject) => {
    let stderr = '';
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', verificationScript], {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, LINGBUILDER_INSTALLER_PATH: executablePath }
    });
    child.stderr?.on('data', chunk => { stderr += String(chunk); });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`微软安装程序数字签名验证失败。${stderr.trim() ? ` ${stderr.trim()}` : ''}`));
    });
  });
}

async function runMicrosoftInstaller(
  executablePath: string,
  args: readonly string[]
): Promise<EnvironmentRepairInstallerResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(executablePath, [...args], {
      windowsHide: false,
      stdio: 'ignore'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (signal) reject(new Error(`微软安装程序被信号 ${signal} 终止。`));
      else resolve({ exitCode: code ?? -1 });
    });
  });
}
