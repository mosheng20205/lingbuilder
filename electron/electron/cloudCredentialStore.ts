import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * 云账号登录凭据的机器级共享存储与跨进程刷新锁。
 *
 * 「在新窗口打开工作区」与例程实例必须带 LINGBUILDER_REC_USER_DATA 独立 userData
 * 才能绕开单实例锁（workspaceService/moduleDemoService 同一套机制），凭据若留在
 * userData 内，新窗口打开即未登录。而「复制一份凭据给新实例」行不通：云端刷新令牌
 * 轮换 + 重复使用检测会撤销整个会话族（cloud/api auth.service refresh），两个实例
 * 先后刷新必然互踢。唯一符合服务端语义的做法是全机实例共享同一份凭据文件，并以
 * 「锁内重读 → 刷新 → 写回」的临界区保证同一刷新令牌绝不被并发双发。
 *
 * 本模块只搬运「已加密的字节」，safeStorage 加解密留在 main.ts 读写器里，保持纯
 * Node 可测。dev 与打包版继续分目录隔离（与「dev/打包版 userData 完全隔离」同口径）。
 */

export const CLOUD_REFRESH_TOKEN_FILE_NAME = 'cloud-refresh-token.bin';
const LOCK_FILE_NAME = 'cloud-refresh-token.lock';
/** 持锁方崩溃残留的陈旧锁超过该时长后允许强行接管。临界区内含一次云端刷新网络请求。 */
const LOCK_STALE_MS = 15_000;
const LOCK_ACQUIRE_TIMEOUT_MS = 10_000;
const LOCK_RETRY_INTERVAL_MS = 50;

/** 锁等待参数可注入（仅测试需要缩短）；生产默认值见上方常量。 */
export interface CloudCredentialLockOptions {
  staleMs?: number;
  timeoutMs?: number;
  retryIntervalMs?: number;
}

/** 机器级共享凭据目录：主窗口、「在新窗口打开工作区」/例程实例全部同源；dev 与打包版分片隔离。 */
export function resolveSharedCloudCredentialDir(packaged: boolean, environment: NodeJS.ProcessEnv = process.env): string {
  // 显式覆盖（测试/冒烟隔离用），与 LINGBUILDER_SDK_CACHE_ROOT 同口径。
  const explicit = String(environment.LINGBUILDER_CLOUD_CREDENTIAL_DIR || '').trim();
  if (explicit) {
    if (!path.isAbsolute(explicit)) throw new Error('LINGBUILDER_CLOUD_CREDENTIAL_DIR 必须是绝对路径。');
    return path.resolve(explicit);
  }
  const channel = packaged ? 'packaged' : 'dev';
  if (process.platform === 'win32') {
    const localAppData = String(environment.LOCALAPPDATA || '').trim() || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'LingBuilder', 'credentials', channel);
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'LingBuilder', 'credentials', channel);
  }
  const stateRoot = String(environment.XDG_STATE_HOME || '').trim() || path.join(os.homedir(), '.local', 'state');
  return path.join(stateRoot, 'LingBuilder', 'credentials', channel);
}

/** 读共享凭据字节；缺失或不可读一律返回 null（由调用方决定是否迁移）。 */
export async function readSharedCredentialBytes(sharedDir: string, fileName: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(path.join(sharedDir, fileName));
  } catch {
    return null;
  }
}

/** 原子写入共享凭据字节（临时文件 + rename），并发写不会留下半截文件。 */
export async function writeSharedCredentialBytes(sharedDir: string, fileName: string, bytes: Buffer): Promise<void> {
  await fs.mkdir(sharedDir, { recursive: true });
  const target = path.join(sharedDir, fileName);
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, bytes);
  await fs.rename(temporary, target).catch(async error => {
    await fs.rm(temporary, { force: true });
    throw error;
  });
}

/** 清除共享凭据（退出登录 / 云端判定失效）；文件本就不存在时静默成功。 */
export async function clearSharedCredential(sharedDir: string, fileName: string): Promise<void> {
  await fs.rm(path.join(sharedDir, fileName), { force: true });
}

/**
 * 跨进程互斥执行：锁文件 wx 独占创建（原子），临界区内含云端刷新网络请求，
 * 陈旧锁（持锁实例崩溃）超时后强行接管；拿不到锁必须报错而不是无锁继续——
 * 无锁刷新等于把同一刷新令牌并发双发，会触发云端重复使用检测撤销全会话族。
 */
export async function withCloudCredentialLock<T>(sharedDir: string, work: () => Promise<T>, options: CloudCredentialLockOptions = {}): Promise<T> {
  const staleMs = options.staleMs ?? LOCK_STALE_MS;
  const timeoutMs = options.timeoutMs ?? LOCK_ACQUIRE_TIMEOUT_MS;
  const retryIntervalMs = options.retryIntervalMs ?? LOCK_RETRY_INTERVAL_MS;
  await fs.mkdir(sharedDir, { recursive: true });
  const lockPath = path.join(sharedDir, LOCK_FILE_NAME);
  const deadline = Date.now() + timeoutMs;
  let handle: Awaited<ReturnType<typeof fs.open>> | null = null;
  while (handle === null) {
    try {
      handle = await fs.open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, acquiredAt: new Date().toISOString() }), 'utf8');
    } catch (error) {
      await handle?.close().catch(() => undefined);
      handle = null;
      if ((error as { code?: unknown } | null)?.code !== 'EEXIST') throw error;
      if (await isLockStale(lockPath, staleMs)) {
        await fs.rm(lockPath, { force: true });
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error('云账号凭据正被另一个 LingBuilder 实例使用，请稍后重试。');
      }
      await new Promise(resolve => setTimeout(resolve, retryIntervalMs));
    }
  }
  try {
    return await work();
  } finally {
    await handle.close().catch(() => undefined);
    await fs.rm(lockPath, { force: true }).catch(() => undefined);
  }
}

async function isLockStale(lockPath: string, staleMs: number): Promise<boolean> {
  try {
    const stats = await fs.stat(lockPath);
    return Date.now() - stats.mtimeMs > staleMs;
  } catch {
    return false;
  }
}

/**
 * 把旧版 userData 内的凭据迁移到共享目录（move 语义：写入成功后删除旧文件，
 * 防止其他实例把已退出/已轮换的旧令牌复活）。必须幂等：并发迁移在锁内重查，
 * 只有真正完成迁移的实例删除旧文件。
 */
export async function migrateLegacyCloudCredentialIfNeeded(sharedDir: string, legacyFilePath: string): Promise<boolean> {
  if (await readSharedCredentialBytes(sharedDir, CLOUD_REFRESH_TOKEN_FILE_NAME)) return false;
  const legacy = await fs.readFile(legacyFilePath).catch(() => null);
  if (!legacy || legacy.length === 0) return false;
  return await withCloudCredentialLock(sharedDir, async () => {
    if (await readSharedCredentialBytes(sharedDir, CLOUD_REFRESH_TOKEN_FILE_NAME)) return false;
    await writeSharedCredentialBytes(sharedDir, CLOUD_REFRESH_TOKEN_FILE_NAME, legacy);
    await fs.rm(legacyFilePath, { force: true }).catch(() => undefined);
    return true;
  });
}
