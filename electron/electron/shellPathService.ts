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
  return [
    candidates.rendererWorkspaceRoot,
    candidates.configuredWorkspaceRoot,
    candidates.activeWorkspace
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
