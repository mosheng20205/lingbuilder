import fs from 'node:fs/promises';
import path from 'node:path';

export interface NestedWorkspaceArtifactPlan {
  detected: boolean;
  excludedAbsolutePaths: Set<string>;
}

const EMPTY_PLAN: NestedWorkspaceArtifactPlan = {
  detected: false,
  excludedAbsolutePaths: new Set<string>()
};

// Electron 主进程使用独立 tsconfig/rootDir，因此在主进程边界保留同等的路径守卫。
export async function detectNestedWorkspaceArtifacts(sourceRoot: string): Promise<NestedWorkspaceArtifactPlan> {
  const resolvedRoot = path.resolve(sourceRoot);
  try {
    const marker = await fs.stat(path.join(resolvedRoot, '.lingbuilder', 'solution.json'));
    if (!marker.isFile()) return EMPTY_PLAN;
    const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
    const solutionEntries = entries.filter(entry => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.lbsln'));
    if (solutionEntries.length === 0) return EMPTY_PLAN;
    return {
      detected: true,
      excludedAbsolutePaths: new Set([
        path.resolve(resolvedRoot, '.lingbuilder'),
        path.resolve(resolvedRoot, 'config'),
        path.resolve(resolvedRoot, 'src'),
        ...solutionEntries.map(entry => path.resolve(resolvedRoot, entry.name))
      ].map(item => item.toLocaleLowerCase()))
    };
  } catch {
    return EMPTY_PLAN;
  }
}

export function isNestedWorkspaceArtifactPath(absolutePath: string, plan: NestedWorkspaceArtifactPlan): boolean {
  if (!plan.detected) return false;
  const normalized = path.resolve(absolutePath).toLocaleLowerCase();
  return [...plan.excludedAbsolutePaths].some(excluded => normalized === excluded || normalized.startsWith(`${excluded}${path.sep}`));
}
