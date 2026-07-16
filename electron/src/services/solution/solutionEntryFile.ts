import fs from 'node:fs/promises';
import path from 'node:path';

export const LINGBUILDER_SOLUTION_EXTENSION = '.lbsln';
export const LINGBUILDER_SOLUTION_KIND = 'lingbuilder-solution';
export const INTERNAL_SOLUTION_PATH = '.lingbuilder/solution.json';

interface SolutionEntrySource {
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  projects: Array<{
    id: string;
    name: string;
    type: 'visual-cpp' | 'external-msbuild' | 'external-cmake';
    sourceRoot: string;
    projectFile?: string;
    references?: string[];
  }>;
}

export interface LingBuilderSolutionEntry {
  schemaVersion: 1;
  kind: typeof LINGBUILDER_SOLUTION_KIND;
  id: string;
  name: string;
  solutionFile: typeof INTERNAL_SOLUTION_PATH;
  startupProjectId: string;
  startupProjectIds: string[];
  projects: Array<{
    id: string;
    name: string;
    type: SolutionEntrySource['projects'][number]['type'];
    sourceRoot: string;
    projectFile?: string;
    references: string[];
  }>;
}

export function createSolutionEntry(solution: SolutionEntrySource): LingBuilderSolutionEntry {
  return {
    schemaVersion: 1,
    kind: LINGBUILDER_SOLUTION_KIND,
    id: solution.id,
    name: solution.name,
    solutionFile: INTERNAL_SOLUTION_PATH,
    startupProjectId: solution.startupProjectId,
    startupProjectIds: [...solution.startupProjectIds],
    projects: solution.projects.map(project => ({
      id: project.id,
      name: project.name,
      type: project.type,
      sourceRoot: project.sourceRoot,
      ...(project.projectFile ? { projectFile: project.projectFile } : {}),
      references: [...(project.references || [])]
    }))
  };
}

export async function findSolutionEntryPath(workspaceRoot: string, solutionName: string): Promise<string> {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  for (const entry of entries.filter(item => item.isFile() && item.name.toLowerCase().endsWith(LINGBUILDER_SOLUTION_EXTENSION)).sort((a, b) => a.name.localeCompare(b.name))) {
    const candidate = path.join(workspaceRoot, entry.name);
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, 'utf8')) as Partial<LingBuilderSolutionEntry>;
      if (parsed.kind === LINGBUILDER_SOLUTION_KIND && parsed.solutionFile === INTERNAL_SOLUTION_PATH) return candidate;
    } catch {
      // Preserve unrelated or damaged entry files; a new valid entry receives a unique name.
    }
  }

  const baseName = safeSolutionFileName(solutionName) || 'LingBuilder';
  let candidate = path.join(workspaceRoot, `${baseName}${LINGBUILDER_SOLUTION_EXTENSION}`);
  let suffix = 2;
  while (await exists(candidate)) candidate = path.join(workspaceRoot, `${baseName}-${suffix++}${LINGBUILDER_SOLUTION_EXTENSION}`);
  return candidate;
}

export async function writeSolutionEntry(workspaceRoot: string, solution: SolutionEntrySource): Promise<string> {
  const targetPath = await findSolutionEntryPath(workspaceRoot, solution.name);
  const content = `${JSON.stringify(createSolutionEntry(solution), null, 2)}\n`;
  try {
    if (await fs.readFile(targetPath, 'utf8') === content) return targetPath;
  } catch {
    // Missing files are created below.
  }
  const temporaryPath = `${targetPath}.${process.pid}.tmp`;
  await fs.writeFile(temporaryPath, content, 'utf8');
  await fs.rename(temporaryPath, targetPath);
  return targetPath;
}

export async function resolveSolutionEntryWorkspace(entryPath: string): Promise<string> {
  const resolvedEntry = path.resolve(entryPath);
  const parsed = JSON.parse(await fs.readFile(resolvedEntry, 'utf8')) as Partial<LingBuilderSolutionEntry>;
  if (parsed.schemaVersion !== 1 || parsed.kind !== LINGBUILDER_SOLUTION_KIND) {
    throw new Error(`不是有效的 LingBuilder 解决方案文件：${path.basename(resolvedEntry)}`);
  }
  if (parsed.solutionFile !== INTERNAL_SOLUTION_PATH) {
    throw new Error('解决方案入口中的内部状态路径无效。');
  }
  const workspaceRoot = path.dirname(resolvedEntry);
  const internalPath = path.resolve(workspaceRoot, parsed.solutionFile);
  if (path.dirname(internalPath) !== path.join(workspaceRoot, '.lingbuilder') || !await exists(internalPath)) {
    throw new Error(`解决方案内部状态文件不存在：${parsed.solutionFile}`);
  }
  return workspaceRoot;
}

function safeSolutionFileName(value: string): string {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/gu, '-').replace(/[. ]+$/gu, '').slice(0, 100);
}

async function exists(targetPath: string): Promise<boolean> {
  try { await fs.access(targetPath); return true; } catch { return false; }
}
