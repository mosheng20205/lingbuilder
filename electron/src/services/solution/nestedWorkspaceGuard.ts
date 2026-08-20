import fs from 'node:fs/promises';
import path from 'node:path';

export interface NestedWorkspaceArtifactPlan {
  detected: boolean;
  excludedAbsolutePaths: Set<string>;
  excludedTopLevelNames: Set<string>;
}

const EMPTY_PLAN: NestedWorkspaceArtifactPlan = {
  detected: false,
  excludedAbsolutePaths: new Set<string>(),
  excludedTopLevelNames: new Set<string>()
};

/**
 * 识别被误当作 LingBuilder 工作区打开后，在项目源码根目录中生成的嵌套默认工作区。
 * 只有“.lingbuilder/solution.json + 根目录 .lbsln”同时存在时才会排除，
 * 避免把普通的 src/config 子目录误判为嵌套工作区。
 */
export async function detectNestedWorkspaceArtifacts(sourceRoot: string): Promise<NestedWorkspaceArtifactPlan> {
  const resolvedRoot = path.resolve(sourceRoot);
  try {
    const marker = await fs.stat(path.join(resolvedRoot, '.lingbuilder', 'solution.json'));
    if (!marker.isFile()) return EMPTY_PLAN;
    const entries = await fs.readdir(resolvedRoot, { withFileTypes: true });
    const solutionEntries = entries.filter(entry => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.lbsln'));
    if (solutionEntries.length === 0) return EMPTY_PLAN;

    const excludedTopLevelNames = new Set<string>(['.lingbuilder', 'config', 'src']);
    solutionEntries.forEach(entry => excludedTopLevelNames.add(entry.name.toLocaleLowerCase()));
    return {
      detected: true,
      excludedTopLevelNames,
      excludedAbsolutePaths: new Set(
        [...excludedTopLevelNames].map(name => path.resolve(resolvedRoot, name).toLocaleLowerCase())
      )
    };
  } catch {
    return EMPTY_PLAN;
  }
}

export function isNestedWorkspaceArtifactPath(
  absolutePath: string,
  plan: NestedWorkspaceArtifactPlan
): boolean {
  if (!plan.detected) return false;
  const normalized = path.resolve(absolutePath).toLocaleLowerCase();
  return [...plan.excludedAbsolutePaths].some(excluded => normalized === excluded || normalized.startsWith(`${excluded}${path.sep}`));
}

export function isNestedWorkspaceArtifactRelativePath(
  relativePath: string,
  plan: NestedWorkspaceArtifactPlan
): boolean {
  if (!plan.detected) return false;
  const firstPart = String(relativePath || '').replace(/\\/gu, '/').replace(/^\.\//u, '').split('/')[0]?.toLocaleLowerCase();
  return Boolean(firstPart && plan.excludedTopLevelNames.has(firstPart));
}

/**
 * 构建输出和开发工具缓存不能作为项目源码参与 LCPP 聚合。
 * 这里使用相对路径的目录段判断，既能覆盖源码根目录本身就是工程目录的项目，
 * 也不会因为工作区绝对路径中恰好包含同名目录而误排除整个工作区。
 */
export function isProjectBuildArtifactRelativePath(relativePath: string): boolean {
  const parts = String(relativePath || '')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .split('/')
    .filter(Boolean)
    .map(part => part.toLocaleLowerCase());
  if (parts.some(part => ['.lingbuilder-build', '.git', 'node_modules', 'dist', 'dist-electron', 'coverage'].includes(part))) {
    return true;
  }
  return parts.some((part, index) => part === 'generated' && parts[index + 1] === 'cpp');
}
