import fs from 'node:fs/promises';

export interface ShellPathActions {
  openPath(targetPath: string): Promise<string>;
  showItemInFolder(targetPath: string): void;
}

export interface ShellWorkspaceCandidates {
  rendererWorkspaceRoot?: string | null;
  configuredWorkspaceRoot?: string | null;
  activeWorkspace?: string | null;
}

export function selectShellWorkspaceRoot(candidates: ShellWorkspaceCandidates): string {
  // activeWorkspace 必须优先于 configured（进程 env）：工作区切换后 env 是过期值，
  // 若 env 优先，内嵌 Agent 运行时会拿着旧 --workspace 启动（真机踩实：切到 ep9
  // 工作区后 Agent 仍在 ep13 工作区里 edit.propose）。env 只作冷启动兜底。
  return [
    candidates.rendererWorkspaceRoot,
    candidates.activeWorkspace,
    candidates.configuredWorkspaceRoot
  ].find(candidate => Boolean(candidate?.trim()))?.trim() || '';
}

/**
 * Opens a local path and falls back to Explorer's reveal operation when
 * Electron cannot open a directory directly on Windows.
 */
export async function openPathWithExplorerFallback(
  targetPath: string,
  actions: ShellPathActions
): Promise<string> {
  try {
    const stat = await fs.stat(targetPath);
    if (!stat.isDirectory()) {
      actions.showItemInFolder(targetPath);
      return '';
    }

    const openError = await actions.openPath(targetPath);
    if (!openError) return '';

    actions.showItemInFolder(targetPath);
    return '';
  } catch (error) {
    return `路径不存在或无法打开：${error instanceof Error ? error.message : String(error)}`;
  }
}
