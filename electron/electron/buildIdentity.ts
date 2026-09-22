import fs from 'node:fs';
import path from 'node:path';

/**
 * 构建身份（2026-09-20）：`npm run build` 在 dist/ 下生成 build-meta.json，
 * 随 asar 分发。主进程启动时读一份作为「当前进程构建」；second-instance 到来时
 * 重读磁盘，两者不一致（升级或同版本重装）即触发自愈重启，避免单实例委托让
 * 用户永远落在旧渲染层。
 */
export const BUILD_META_FILE = 'build-meta.json';

export interface LingBuilderBuildMeta {
  version: string;
  buildTime: string;
  gitHash: string;
}

/** dist-electron 目录 → asar 内 dist/build-meta.json 的路径。 */
export function resolveBuildMetaPath(distElectronDir: string): string {
  return path.join(distElectronDir, '..', 'dist', BUILD_META_FILE);
}

export function readBuildMetaFile(filePath: string): LingBuilderBuildMeta | undefined {
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<LingBuilderBuildMeta> | null;
    if (!raw || typeof raw.version !== 'string' || typeof raw.buildTime !== 'string' || !raw.buildTime) return undefined;
    return {
      version: raw.version,
      buildTime: raw.buildTime,
      gitHash: typeof raw.gitHash === 'string' && raw.gitHash ? raw.gitHash : 'unknown'
    };
  } catch {
    return undefined;
  }
}

/**
 * 自愈判据：磁盘构建身份与当前进程构建身份不一致（只比 buildTime——每次构建唯一，
 * 同版本重装也会变化；gitHash/version 仅随 meta 记录用于展示与排查）。
 * 任一侧读不到（如旧安装包没有 meta）不触发，保持既有行为。
 */
export function diskBuildDiffersFromRunning(
  disk: LingBuilderBuildMeta | undefined,
  running: LingBuilderBuildMeta | undefined
): boolean {
  if (!disk || !running) return false;
  return disk.buildTime !== running.buildTime;
}
