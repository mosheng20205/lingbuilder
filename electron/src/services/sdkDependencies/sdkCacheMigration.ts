import type { Dirent } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { renameDirectoryWithRetry } from './sdkDependencyService';

export interface SdkCacheMigrationFailure {
  moduleId: string;
  sourceRoot: string;
  reason: string;
}

export interface SdkCacheMigrationResult {
  targetRoot: string;
  migrated: string[];
  skipped: string[];
  failed: SdkCacheMigrationFailure[];
}

export interface SdkCacheMigrationOptions {
  rename?: typeof renameDirectoryWithRetry;
  pathExists?: (target: string) => Promise<boolean>;
  listModuleDirectories?: (modulesDir: string) => Promise<string[]>;
}

/** 旧缓存根优先级：先主实例 userData/sdk-cache（最新），再早期 resolveSdkCacheRoot 回退目录。 */
export function legacySdkCacheRoots(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform
): string[] {
  // 非 win32 的旧默认目录（XDG_CACHE_HOME 或 ~/.cache + LingBuilder/sdk-cache）与机器级新目录一致，无遗留可迁。
  if (platform !== 'win32') return [];
  const appData = String(environment.APPDATA || '').trim() || path.join(os.homedir(), 'AppData', 'Roaming');
  return [
    // 主进程 userData/sdk-cache：打包版与开发态曾共用 lingbuilder-electron userData。
    path.join(appData, 'lingbuilder-electron', 'sdk-cache'),
    // 更早期 resolveSdkCacheRoot 的回退目录（AI Bridge ai-server 曾长期使用）。
    path.join(appData, 'LingBuilder', 'sdk-cache')
  ];
}

/**
 * 把旧缓存根里已安装的 SDK 模块迁入机器级缓存目录（rename-if-absent）：
 * - 只搬 modules/<模块ID> 目录，downloads/.staging 等临时物不迁；
 * - 目标已有同名模块时跳过，绝不覆盖；
 * - 单个模块失败（跨盘 EXDEV、文件被占用等）只记录，不阻断其余模块与启动流程；
 * - 并发实例同时迁移时 rename 单赢家，输家视为 skipped。
 */
export async function migrateLegacySdkCaches(
  targetRoot: string,
  legacyRoots: readonly string[],
  options: SdkCacheMigrationOptions = {}
): Promise<SdkCacheMigrationResult> {
  const rename = options.rename || renameDirectoryWithRetry;
  const pathExists = options.pathExists || defaultPathExists;
  const listModuleDirectories = options.listModuleDirectories || defaultListModuleDirectories;
  const target = path.resolve(targetRoot);
  const result: SdkCacheMigrationResult = { targetRoot: target, migrated: [], skipped: [], failed: [] };
  const sources = legacyRoots
    .map(root => path.resolve(root))
    .filter(root => root.toLowerCase() !== target.toLowerCase());
  const sourceModuleRoots = new Map<string, string>();
  for (const root of sources) {
    for (const moduleId of await listModuleDirectories(path.join(root, 'modules'))) {
      if (!sourceModuleRoots.has(moduleId)) sourceModuleRoots.set(moduleId, root);
    }
  }
  if (sourceModuleRoots.size === 0) return result;

  await fs.mkdir(path.join(target, 'modules'), { recursive: true });
  for (const [moduleId, sourceRoot] of sourceModuleRoots) {
    const targetModuleDir = path.join(target, 'modules', moduleId);
    if (await pathExists(targetModuleDir)) {
      result.skipped.push(moduleId);
      continue;
    }
    const sourceModuleDir = path.join(sourceRoot, 'modules', moduleId);
    try {
      await rename(sourceModuleDir, targetModuleDir, { attempts: 8, delayMs: 250 });
      result.migrated.push(moduleId);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT' && !await pathExists(sourceModuleDir)) {
        result.skipped.push(moduleId);
        continue;
      }
      const reason = code === 'EXDEV'
        ? '缓存目录与旧目录不在同一磁盘卷，无法直接移动，该 SDK 将按需重新下载'
        : String((error as Error)?.message || error);
      result.failed.push({ moduleId, sourceRoot, reason });
    }
  }
  return result;
}

export function describeSdkCacheMigration(result: SdkCacheMigrationResult): string[] {
  const lines: string[] = [];
  if (result.migrated.length > 0) {
    lines.push(`[sdk-cache] 已迁移 ${result.migrated.join('、')} 到机器级缓存目录 ${result.targetRoot}（无需重新下载）。`);
  }
  for (const failure of result.failed) {
    lines.push(`[sdk-cache] 迁移 ${failure.moduleId} 失败（来自 ${failure.sourceRoot}）：${failure.reason}`);
  }
  return lines;
}

async function defaultPathExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function defaultListModuleDirectories(modulesDir: string): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(modulesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
}
