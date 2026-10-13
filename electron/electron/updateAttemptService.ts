import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 应用内更新「安装尝试」标记：点「安装更新」退出前写入，下次启动比对版本号判断
 * 安装是否真正生效。背景（2026-10-13 实锤）：外部 AI 客户端自动复活的 MCP 宿主进程
 * （LingBuilder.exe 持有 app.asar）会让安装器跳过被锁核心文件、报成功但版本不变，
 * 用户陷入「更新→安装→还是旧版→再提示更新」死循环。标记让 IDE 能把死循环翻译成
 * 明确错误，并保留已下载的安装包供一键重试。
 */

export const UPDATE_ATTEMPT_MARKER_FILE = 'update-install-attempt.json';

export interface UpdateAttemptMarker {
  /** 期望更新到的版本号。 */
  version: string;
  /** 已下载安装包的绝对路径。 */
  installerPath: string;
  /** 安装包期望 SHA-256（来自云端版本检查结果；空表示无法校验）。 */
  sha256: string;
  /** 写入时间（ISO 字符串）。 */
  at: string;
}

/** 非 strict 工程约定：结果类型用单一接口，不用布尔判别式联合。 */
export interface UpdateAttemptStatus {
  pending: boolean;
  tookEffect?: boolean;
  version?: string;
  installerPath?: string;
  /** pending 且未生效时由主进程生成的中文说明（含安装包是否保留），供更新界面直接展示。 */
  message?: string;
}

export type UpdateAttemptStartupPlan = 'cleanup-only' | 'clear-marker-and-cleanup' | 'verify-retained';

export function updateAttemptMarkerPath(userDataPath: string): string {
  return path.join(userDataPath, UPDATE_ATTEMPT_MARKER_FILE);
}

export async function readUpdateAttemptMarker(userDataPath: string): Promise<UpdateAttemptMarker | null> {
  let raw: string;
  try {
    raw = await fs.readFile(updateAttemptMarkerPath(userDataPath), 'utf-8');
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<UpdateAttemptMarker>;
    if (!parsed || typeof parsed.version !== 'string' || !parsed.version) return null;
    return {
      version: parsed.version,
      installerPath: typeof parsed.installerPath === 'string' ? parsed.installerPath : '',
      sha256: typeof parsed.sha256 === 'string' ? parsed.sha256 : '',
      at: typeof parsed.at === 'string' ? parsed.at : ''
    };
  } catch {
    return null;
  }
}

export async function writeUpdateAttemptMarker(userDataPath: string, marker: UpdateAttemptMarker): Promise<void> {
  await fs.writeFile(updateAttemptMarkerPath(userDataPath), `${JSON.stringify(marker, null, 2)}\n`, 'utf-8');
}

export async function clearUpdateAttemptMarker(userDataPath: string): Promise<void> {
  await fs.rm(updateAttemptMarkerPath(userDataPath), { force: true }).catch(() => undefined);
}

export function evaluateUpdateAttempt(appVersion: string, marker: UpdateAttemptMarker | null): UpdateAttemptStatus {
  if (!marker) return { pending: false };
  return {
    pending: true,
    tookEffect: appVersion === marker.version,
    version: marker.version,
    installerPath: marker.installerPath || undefined
  };
}

/** 启动时的处置计划：无标记正常清理；版本已前进清标记；未生效保留 updates 目录待验证收养。 */
export function planUpdateAttemptStartup(appVersion: string, marker: UpdateAttemptMarker | null): UpdateAttemptStartupPlan {
  if (!marker) return 'cleanup-only';
  return appVersion === marker.version ? 'clear-marker-and-cleanup' : 'verify-retained';
}

export function formatUpdateAttemptFailureMessage(marker: UpdateAttemptMarker, retainedInstallerPath?: string): string {
  const kept = retainedInstallerPath || marker.installerPath;
  const keptHint = kept ? `（${path.basename(kept)}）` : '';
  return `上次更新到 v${marker.version} 未生效：安装期间核心程序文件被其它进程占用，通常是连接 LingBuilder 的外部 AI 客户端在自动重启其 MCP 宿主进程。` +
    (kept
      ? `已保留下载完成的安装包${keptHint}，可直接点击安装按钮重试。`
      : '请重新下载安装包后再试。') +
    `若再次失败，请先退出所有 AI 客户端（或在任务管理器「详细信息」中结束所有 LingBuilder.exe）后重试。`;
}
