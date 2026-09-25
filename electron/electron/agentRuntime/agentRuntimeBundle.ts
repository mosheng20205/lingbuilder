import { spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 随包内嵌 Agent 运行时的「单文件归档 + 首次启动释放」。
 *
 * 为什么不把 node/dsh 两棵树（约 2.6 万个文件）直接打进安装包：NSIS 安装是
 * 「7z 解压到临时目录 + CopyFiles 再整目录复制」两趟，小文件逐个落地还要吃
 * 杀软实时扫描，安装进度会长时间停在 50% 附近（0.7.8/0.7.9 真机实测）。
 * 因此安装包只携带一个未压缩 tar（NSIS 固实 LZMA 压 tar 的比率与压散文件一致，
 * 安装包体积不变），首次用到内嵌 Agent 时用 Windows 10+ 自带的 bsdtar 一次性释放。
 *
 * 释放目标优先安装目录（随包安装为当前用户可写，且演示实例等可共享同一份），
 * 不可写时回落 userData。释放成功写入 marker（记录归档 SHA-256），marker 与
 * 归档一致即直接复用；归档更换（升级）后自动重释放。归档本身保留在 resources
 * 里不删除：释放树被杀软/用户误删后还能自愈，无需重装。
 */

export interface AgentRuntimeBundleManifest {
  bundled?: boolean;
  node?: { version?: string; executable?: string };
  dsh?: { version?: string; entry?: string };
  archive?: { file?: string; sha256?: string; bytes?: number };
  problem?: string;
}

export interface AgentRuntimeBundleOptions {
  resourcesPath?: string;
  /** 安装目录（resources 的上一级）；可写时释放到 <install>/agent-runtime。 */
  installDirectory?: string;
  /** 安装目录不可写时的回落根目录（userData）。 */
  userDataDirectory?: string;
  environment?: NodeJS.ProcessEnv;
  spawnProcess?: typeof spawn;
  onLog?: (line: string) => void;
}

/** 单一结果形态（主进程树未开 strictNullChecks，禁用布尔判别式联合）。 */
export interface AgentRuntimeBundleResult {
  ok: boolean;
  /** 释放后的运行时根目录（内含 node/ 与 dsh/）；未随包或失败时为空串。 */
  root: string;
  /** true = 安装包未携带运行时（bundled=false 或无 manifest），调用方静默走本机回退。 */
  skipped: boolean;
  problem: string;
}

const EXTRACT_TIMEOUT_MS = 10 * 60 * 1000;
const MARKER_NAME = 'agent-runtime-marker.json';

interface BundleMarker {
  archiveSha256: string;
  nodeVersion: string;
  dshVersion: string;
  extractedAt: string;
}

/** 进程内缓存：同一归档只做一次 SHA-256 与释放；key = 归档绝对路径。 */
const settledByArchive = new Map<string, AgentRuntimeBundleResult>();
const inFlightByArchive = new Map<string, Promise<AgentRuntimeBundleResult>>();

/** 必须用绝对路径取系统 bsdtar（Git Bash 的 GNU tar 会把 C:\ 当远程主机），与 prepare 脚本同口径。 */
function systemTar(environment: NodeJS.ProcessEnv | undefined): string {
  const root = String(environment?.SystemRoot || 'C:\\Windows');
  const candidate = path.join(root, 'System32', 'tar.exe');
  return candidate;
}

async function sha256File(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  hash.update(await fs.readFile(file));
  return hash.digest('hex');
}

async function readManifest(resourcesPath: string): Promise<AgentRuntimeBundleManifest | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(resourcesPath, 'agent-runtime.json'), 'utf8')) as AgentRuntimeBundleManifest;
  } catch {
    return null;
  }
}

async function fileExists(target: string): Promise<boolean> {
  try {
    return (await fs.stat(target)).isFile();
  } catch {
    return false;
  }
}

/** 依次尝试候选目录，mkdir 成功即选中（父目录不可写会抛错）。 */
async function pickDestination(candidates: string[]): Promise<string> {
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      await fs.mkdir(candidate, { recursive: true });
      return candidate;
    } catch {
      // 尝试下一个候选。
    }
  }
  return '';
}

/**
 * tar 释放到临时目录后整体换名，避免半截树被解析器当成可用运行时，
 * 也避免两个进程同时释放互相覆盖（后完成者胜出，换名是原子操作）。
 */
async function extractArchive(archivePath: string, destination: string, options: AgentRuntimeBundleOptions): Promise<void> {
  const parent = path.dirname(destination);
  const staging = path.join(parent, `agent-runtime.tmp-${process.pid}-${Date.now()}`);
  await fs.mkdir(staging, { recursive: true });
  const tarPath = systemTar(options.environment);
  try {
    await new Promise<void>((resolve, reject) => {
      const runner = options.spawnProcess || spawn;
      let child: ChildProcess;
      try {
        child = runner(tarPath, ['-xf', archivePath, '-C', staging], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }) as ChildProcess;
      } catch (error) {
        reject(new Error(`启动系统 tar 失败：${error instanceof Error ? error.message : String(error)}`));
        return;
      }
      if (!child) {
        reject(new Error('启动系统 tar 失败：spawn 未返回进程'));
        return;
      }
      let stderr = '';
      child.stderr?.setEncoding('utf8');
      child.stderr?.on('data', chunk => { stderr += String(chunk); });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error(`释放随包运行时超时（${Math.round(EXTRACT_TIMEOUT_MS / 1000)} 秒）：${tarPath}`));
      }, EXTRACT_TIMEOUT_MS);
      timer.unref?.();
      child.once('error', error => {
        clearTimeout(timer);
        reject(new Error(`系统 tar 执行失败：${error.message}`));
      });
      child.once('close', code => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`系统 tar 退出码 ${code}：${stderr.trim().split('\n').pop() || '无输出'}`));
      });
    });
  } catch (error) {
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
  // tar 成员带根目录名（node/、dsh/）直接落在 staging 下，staging 即运行时根。
  const previous = `${destination}.old-${Date.now()}`;
  let swapped = false;
  try {
    await fs.rename(destination, previous);
    swapped = true;
  } catch {
    // 旧目录不存在或被占用：占用场景由下面的 rename 兜底报错。
  }
  try {
    await fs.rename(staging, destination);
  } catch (error) {
    if (swapped) await fs.rename(previous, destination).catch(() => undefined);
    await fs.rm(staging, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(`释放结果换名失败：${error instanceof Error ? error.message : String(error)}`);
  }
  if (swapped) await fs.rm(previous, { recursive: true, force: true }).catch(() => undefined);
}

/**
 * 确保随包内嵌 Agent 运行时已释放可用，返回可交给 profile 解析的根目录。
 * 未随包 → skipped；归档校验/释放失败 → ok=false 带中文问题（调用方回退本机候选，不视为致命）。
 */
export async function ensureAgentRuntimeBundle(options: AgentRuntimeBundleOptions = {}): Promise<AgentRuntimeBundleResult> {
  const resourcesPath = String(options.resourcesPath || '').trim();
  if (!resourcesPath) return { ok: true, root: '', skipped: true, problem: '' };
  const manifest = await readManifest(resourcesPath);
  if (!manifest || manifest.bundled !== true || !manifest.archive?.file) {
    return { ok: true, root: '', skipped: true, problem: '' };
  }
  const archivePath = path.join(resourcesPath, manifest.archive.file);
  const expectedSha = String(manifest.archive.sha256 || '').trim();
  const cached = settledByArchive.get(archivePath);
  if (cached) return cached;
  const inFlight = inFlightByArchive.get(archivePath);
  if (inFlight) return inFlight;
  const task = (async (): Promise<AgentRuntimeBundleResult> => {
    if (!await fileExists(archivePath)) {
      return { ok: false, root: '', skipped: false, problem: `随包运行时归档缺失：${archivePath}（安装包不完整，请重新安装 LingBuilder）` };
    }
    const destination = await pickDestination([
      options.installDirectory ? path.join(options.installDirectory, 'agent-runtime') : '',
      options.userDataDirectory ? path.join(options.userDataDirectory, 'agent-runtime-bundle') : ''
    ]);
    if (!destination) {
      return { ok: false, root: '', skipped: false, problem: '内嵌 Agent 运行时释放目录不可写（安装目录与用户数据目录均创建失败），请检查磁盘与权限后重试。' };
    }
    const markerPath = path.join(destination, MARKER_NAME);
    const nodeExe = path.join(destination, 'node', manifest.node?.executable || 'node.exe');
    const dshEntry = path.join(destination, 'dsh', manifest.dsh?.entry || path.join('node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'));
    if (expectedSha && await fileExists(markerPath) && await fileExists(nodeExe) && await fileExists(dshEntry)) {
      try {
        const marker = JSON.parse(await fs.readFile(markerPath, 'utf8')) as BundleMarker;
        if (marker.archiveSha256 === expectedSha) {
          const result: AgentRuntimeBundleResult = { ok: true, root: destination, skipped: false, problem: '' };
          settledByArchive.set(archivePath, result);
          return result;
        }
      } catch {
        // marker 损坏按未释放处理，走重释放。
      }
    }
    options.onLog?.(`首次启动正在释放内嵌 Agent 运行时（约 2.6 万个文件，受杀软扫描影响可能需要一到两分钟）…`);
    const startedAt = Date.now();
    let actualSha = '';
    try {
      actualSha = await sha256File(archivePath);
      if (expectedSha && actualSha !== expectedSha) {
        return {
          ok: false, root: '', skipped: false,
          problem: `随包运行时归档校验失败（期望 ${expectedSha.slice(0, 16)}…，实际 ${actualSha.slice(0, 16)}…）。请重新安装 LingBuilder；若反复出现，多半是杀软件拦截了安装目录，请将 LingBuilder 加入信任区。`
        };
      }
      await extractArchive(archivePath, destination, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, root: '', skipped: false, problem: `释放内嵌 Agent 运行时失败：${message}` };
    }
    if (!await fileExists(nodeExe) || !await fileExists(dshEntry)) {
      return { ok: false, root: '', skipped: false, problem: `释放后未找到随包运行时入口（${nodeExe} / ${dshEntry}），释放树不完整。` };
    }
    const marker: BundleMarker = {
      archiveSha256: actualSha || expectedSha,
      nodeVersion: String(manifest.node?.version || ''),
      dshVersion: String(manifest.dsh?.version || ''),
      extractedAt: new Date().toISOString()
    };
    await fs.writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, 'utf8');
    options.onLog?.(`内嵌 Agent 运行时已释放到 ${destination}（${Math.round((Date.now() - startedAt) / 1000)} 秒）。`);
    const result: AgentRuntimeBundleResult = { ok: true, root: destination, skipped: false, problem: '' };
    settledByArchive.set(archivePath, result);
    return result;
  })();
  inFlightByArchive.set(archivePath, task);
  try {
    return await task;
  } finally {
    inFlightByArchive.delete(archivePath);
  }
}

export interface LegacyRuntimeCleanupResult {
  ok: boolean;
  /** 实际删除的绝对路径（resources\dsh 与 resources\node）。 */
  removed: string[];
  problem: string;
}

/**
 * 后台清理老版本随包形态（≤0.7.9 首包）留在 resources 里的散文件解压树。
 * 这两棵树（约 2.6 万个文件、376MB）在新形态下只是陈旧残留：解析器优先使用
 * 首启释放目录。删除放在应用侧而不是安装器——安装器 RMDir /r 2.6 万个文件
 * 会被杀软逐个拦截，把「正在安装」进度条冻结在尾部数分钟（0.7.9 首包真机实测），
 * 应用启动后异步删则完全无感。仅在存在 agent-runtime.json（本产品布局）时才动手，
 * 且删除失败不影响任何功能。
 */
export async function removeLegacyBundledRuntimeTrees(options: {
  resourcesPath?: string;
  /** 延迟执行（毫秒），给启动让路；默认立即。 */
  delayMs?: number;
}): Promise<LegacyRuntimeCleanupResult> {
  const resourcesPath = String(options.resourcesPath || '').trim();
  const removed: string[] = [];
  if (!resourcesPath) return { ok: true, removed, problem: '' };
  if ((options.delayMs ?? 0) > 0) await new Promise(resolve => setTimeout(resolve, options.delayMs));
  const manifest = await readManifest(resourcesPath);
  if (!manifest) return { ok: true, removed, problem: '' };
  for (const name of ['dsh', 'node']) {
    const target = path.join(resourcesPath, name);
    try {
      const stat = await fs.stat(target).catch(() => null);
      if (!stat?.isDirectory()) continue;
      await fs.rm(target, { recursive: true, force: true, maxRetries: 2 });
      removed.push(target);
    } catch (error) {
      return {
        ok: false,
        removed,
        problem: `清理旧版随包运行时残留失败（${target}）：${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  return { ok: true, removed, problem: '' };
}
