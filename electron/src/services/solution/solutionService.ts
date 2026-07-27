import fs from 'fs/promises';
import path from 'path';
import { decodeTextFile } from '../files/textFileService';
import type { TextFileSnapshot } from '../files/types';
import { LingWindowProject } from '../windowDesigner/types';
import { normalizeStartupProjects, topologicalProjectOrder, validateProjectDependencies } from './projectDependencyGraph';
import { ExternalProjectService, validateProperties, type ExternalProjectProperties } from './externalProjectService';
import { writeSolutionEntry } from './solutionEntryFile';
import { EMPTY_PROJECT_GLOBALS_SOURCE, PROJECT_GLOBALS_FILE_NAME } from '../lingCpp/projectGlobalService';
import { EMPTY_PROJECT_DATA_TYPES_SOURCE, PROJECT_DATA_TYPES_FILE_NAME } from '../lingCpp/projectDataTypeService';

export const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';
export const DEFAULT_SOLUTION_ID = 'lingbuilder-solution';

export interface LingBuilderSolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp' | 'external-msbuild' | 'external-cmake';
  sourceRoot: string;
  configRoot: string;
  designerPath: string;
  isDefault?: boolean;
  references?: string[];
  projectFile?: string;
  buildProperties?: ExternalProjectProperties;
}

export interface LingBuilderSolution {
  schemaVersion: 2;
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  projects: LingBuilderSolutionProject[];
}

export interface CreateSolutionProjectRequest {
  name?: string;
  projectId?: string;
}

export interface DeleteSolutionProjectOptions {
  deleteFiles?: boolean;
}

export interface CleanSolutionResult {
  ok: boolean;
  projectIds: string[];
  removedDirs: string[];
  preservedDirs: string[];
  logs: string[];
}

export class SolutionService {
  private readonly externalProjectService: ExternalProjectService;
  constructor(private readonly workspaceRoot: string) { this.externalProjectService = new ExternalProjectService(workspaceRoot); }

  async getSolution(): Promise<LingBuilderSolution> {
    const existing = await this.readSolutionFile();
    if (existing) {
      const normalized = this.normalizeSolution(existing);
      if ((existing as any).schemaVersion !== 2 || JSON.stringify(existing) !== JSON.stringify(normalized)) await this.writeSolution(normalized);
      else await writeSolutionEntry(this.workspaceRoot, normalized);
      return normalized;
    }

    const migrated = this.createDefaultSolution();
    await this.materializeProject(migrated.projects[0], createDesignerProject(DEFAULT_PROJECT_ID, '新建项目'));
    await this.writeSolution(migrated);
    return migrated;
  }

  async createProject(request: CreateSolutionProjectRequest = {}): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject; designerProject: LingWindowProject }> {
    const solution = await this.getSolution();
    const baseName = (request.name || '新建项目').trim() || '新建项目';
    const projectId = this.createUniqueProjectId(request.projectId || baseName, solution);
    const project: LingBuilderSolutionProject = {
      id: projectId,
      name: baseName,
      type: 'visual-cpp',
      sourceRoot: `src/${projectId}`,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`
      , references: []
    };
    const designerProject = createDesignerProject(project.id, project.name);

    await this.materializeProject(project, designerProject);
    const nextSolution = {
      ...solution,
      startupProjectId: solution.startupProjectId || project.id,
      projects: [...solution.projects, project]
    };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project, designerProject };
  }

  async importExternalProject(relativePath: string): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject }> {
    const solution = await this.getSolution();
    const inspected = await this.externalProjectService.inspect(relativePath);
    const project = { ...inspected, id: this.createUniqueProjectId(inspected.id, solution) } as LingBuilderSolutionProject;
    const nextSolution = { ...solution, projects: [...solution.projects, project] };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project };
  }

  async updateProject(projectId: string, patch: Partial<Pick<LingBuilderSolutionProject, 'name' | 'references' | 'buildProperties'>> & { startup?: boolean; startupProjectIds?: string[] }): Promise<LingBuilderSolution> {
    const solution = await this.getSolution();
    const target = solution.projects.find(project => project.id === projectId);
    if (!target) throw new Error(`未找到项目：${projectId}`);
    if (patch.buildProperties) validateProperties(patch.buildProperties);

    const projects = solution.projects.map(project => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        name: patch.name?.trim() || project.name,
        references: project.id === projectId && patch.references ? [...new Set(patch.references)] : (project.references || []),
        buildProperties: patch.buildProperties || project.buildProperties
      };
    });
    validateProjectDependencies(projects);
    const startupProjectIds = patch.startupProjectIds
      ? normalizeStartupProjects(projects, patch.startupProjectIds, projectId)
      : patch.startup ? [projectId] : solution.startupProjectIds;
    const nextSolution = {
      ...solution,
      startupProjectId: startupProjectIds[0] || projectId,
      startupProjectIds,
      projects
    };
    await this.writeSolution(nextSolution);
    return nextSolution;
  }

  async deleteProject(projectId: string, options: DeleteSolutionProjectOptions = {}): Promise<{ solution: LingBuilderSolution; removedPaths: string[] }> {
    const solution = await this.getSolution();
    const target = solution.projects.find(project => project.id === projectId);
    if (!target) throw new Error(`未找到项目：${projectId}`);
    if (solution.projects.length <= 1) throw new Error('至少需要保留一个项目，不能删除最后一个项目。');
    if (target.isDefault && options.deleteFiles) throw new Error('默认兼容项目不能删除磁盘文件，只能从解决方案中移除非默认项目。');

    const projects = solution.projects.filter(project => project.id !== projectId);
    const nextStartupProjectId = solution.startupProjectId === projectId ? projects[0].id : solution.startupProjectId;
    const nextSolution = {
      ...solution,
      startupProjectId: nextStartupProjectId,
      startupProjectIds: normalizeStartupProjects(projects, solution.startupProjectIds.filter(id => id !== projectId), nextStartupProjectId),
      projects: projects.map(project => ({ ...project, references: (project.references || []).filter(id => id !== projectId) }))
    };
    const removedPaths: string[] = [];

    if (options.deleteFiles) {
      for (const relativePath of [target.sourceRoot, target.configRoot, path.posix.dirname(target.designerPath)]) {
        const absolutePath = this.resolveWorkspacePath(relativePath);
        await fs.rm(absolutePath, { recursive: true, force: true });
        removedPaths.push(absolutePath);
      }
      const projectModulesPath = this.resolveWorkspacePath(`.lingbuilder/projects/${target.id}/project-modules.json`);
      await fs.rm(projectModulesPath, { force: true });
      removedPaths.push(projectModulesPath);
    }

    await this.writeSolution(nextSolution);
    return { solution: nextSolution, removedPaths };
  }

  async readDesignerProject(project: LingBuilderSolutionProject): Promise<LingWindowProject> {
    const designerPath = this.resolveWorkspacePath(project.designerPath);
    if (await exists(designerPath)) {
      const parsed = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
      if (parsed && Array.isArray(parsed.windows) && parsed.windows.length > 0) {
        return { ...parsed, id: parsed.id || project.id, name: parsed.name || project.name };
      }
    }
    return createDesignerProject(project.id, project.name);
  }

  async readProjectFiles(project: LingBuilderSolutionProject): Promise<Record<string, string>> {
    const snapshots = await this.readProjectFileSnapshots(project);
    return Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [filePath, snapshot.content])
    );
  }

  async readProjectFileSnapshots(project: LingBuilderSolutionProject): Promise<Record<string, TextFileSnapshot>> {
    const files: Record<string, TextFileSnapshot> = {};
    for (const relativeRoot of [project.sourceRoot, project.configRoot]) {
      await collectTextFiles(this.workspaceRoot, this.resolveWorkspacePath(relativeRoot), files);
    }
    return files;
  }

  async cleanProjects(projectIds?: string[]): Promise<CleanSolutionResult> {
    const solution = await this.getSolution();
    const selectedIds = projectIds?.length ? projectIds : solution.projects.map(project => project.id);
    const validProjects = solution.projects.filter(project => selectedIds.includes(project.id));
    const removedDirs: string[] = [];
    const preservedDirs = validProjects.map(project => this.resolveWorkspacePath(`generated/cpp/${safeSegment(project.id)}`));
    const logs: string[] = [];

    for (const project of validProjects) {
      const buildDir = this.resolveWorkspacePath(`.lingbuilder-build/${safeSegment(project.id)}`);
      await fs.rm(buildDir, { recursive: true, force: true });
      removedDirs.push(buildDir);
      logs.push(`已清理项目 ${project.name} 的临时构建目录：${buildDir}`);
    }

    if (validProjects.length === 0) {
      logs.push('没有找到需要清理的项目。');
    } else {
      logs.push('清理完成。generated/cpp 中的可复制 Visual Studio 工程已保留。');
    }

    return {
      ok: true,
      projectIds: validProjects.map(project => project.id),
      removedDirs,
      preservedDirs,
      logs
    };
  }

  getProject(solution: LingBuilderSolution, projectId?: string): LingBuilderSolutionProject {
    const target = projectId
      ? solution.projects.find(project => project.id === projectId)
      : solution.projects.find(project => project.id === solution.startupProjectId) || solution.projects[0];
    if (!target) throw new Error(`未找到项目：${projectId || solution.startupProjectId}`);
    return target;
  }

  getBuildOrder(solution: LingBuilderSolution, projectIds?: string[]): LingBuilderSolutionProject[] {
    return topologicalProjectOrder(solution.projects, projectIds).map(id => this.getProject(solution, id));
  }

  private async materializeProject(project: LingBuilderSolutionProject, designerProject: LingWindowProject): Promise<void> {
    const sourceRoot = this.resolveWorkspacePath(project.sourceRoot);
    const configRoot = this.resolveWorkspacePath(project.configRoot);
    const designerPath = this.resolveWorkspacePath(project.designerPath);

    await Promise.all([
      fs.mkdir(sourceRoot, { recursive: true }),
      fs.mkdir(configRoot, { recursive: true }),
      fs.mkdir(path.dirname(designerPath), { recursive: true })
    ]);

    const mainWindow = designerProject.windows[0];
    await Promise.all([
      fs.writeFile(path.join(sourceRoot, `${mainWindow.className}.lcpp`), createDefaultLingCppSource(mainWindow.className), 'utf8'),
      fs.writeFile(path.join(sourceRoot, PROJECT_GLOBALS_FILE_NAME), EMPTY_PROJECT_GLOBALS_SOURCE, 'utf8'),
      fs.writeFile(path.join(sourceRoot, PROJECT_DATA_TYPES_FILE_NAME), EMPTY_PROJECT_DATA_TYPES_SOURCE, 'utf8'),
      fs.writeFile(path.join(configRoot, 'config.ini'), `[project]\nname=${project.name}\nid=${project.id}\n`, 'utf8'),
      fs.writeFile(designerPath, JSON.stringify(designerProject, null, 2), 'utf8')
    ]);
  }

  private async readSolutionFile(): Promise<LingBuilderSolution | null> {
    const targetPath = this.solutionPath();
    if (!(await exists(targetPath))) return null;
    return JSON.parse(await fs.readFile(targetPath, 'utf8')) as LingBuilderSolution;
  }

  private normalizeSolution(solution: LingBuilderSolution): LingBuilderSolution {
    const fallback = this.createDefaultSolution();
    const projects = Array.isArray(solution.projects) && solution.projects.length > 0
      ? solution.projects.map(project => ({
          type: project.type || ('visual-cpp' as const),
          ...project,
          sourceRoot: project.sourceRoot || (project.id === DEFAULT_PROJECT_ID ? 'src' : `src/${project.id}`),
          configRoot: project.configRoot || (project.id === DEFAULT_PROJECT_ID ? 'config' : `config/${project.id}`),
          designerPath: project.designerPath || (project.id === DEFAULT_PROJECT_ID ? '.lingbuilder/window-designer.json' : `.lingbuilder/projects/${project.id}/window-designer.json`)
        }))
      : fallback.projects;
    const normalizedProjects = projects.map(project => ({ ...project, references: Array.isArray(project.references) ? [...new Set(project.references)] : [] }));
    validateProjectDependencies(normalizedProjects);
    const startupProjectId = normalizedProjects.some(project => project.id === solution.startupProjectId)
      ? solution.startupProjectId
      : normalizedProjects[0].id;
    const startupProjectIds = normalizeStartupProjects(normalizedProjects, (solution as any).startupProjectIds, startupProjectId);
    return {
      schemaVersion: 2,
      id: solution.id || DEFAULT_SOLUTION_ID,
      name: solution.name || 'UI_CppLocProj',
      startupProjectId: startupProjectIds[0],
      startupProjectIds,
      projects: normalizedProjects
    };
  }

  private createDefaultSolution(): LingBuilderSolution {
    return {
      schemaVersion: 2,
      id: DEFAULT_SOLUTION_ID,
      name: '未命名解决方案',
      startupProjectId: DEFAULT_PROJECT_ID,
      startupProjectIds: [DEFAULT_PROJECT_ID],
      projects: [
        {
          id: DEFAULT_PROJECT_ID,
          name: '新建项目',
          type: 'visual-cpp',
          sourceRoot: 'src',
          configRoot: 'config',
          designerPath: '.lingbuilder/window-designer.json',
          isDefault: true
          , references: []
        }
      ]
    };
  }

  private createUniqueProjectId(value: string, solution: LingBuilderSolution): string {
    const usedIds = new Set(solution.projects.map(project => project.id));
    const base = safeSegment(value).toLowerCase() || 'lingbuilder-project';
    let candidate = base;
    let index = 2;
    while (usedIds.has(candidate)) {
      candidate = `${base}-${index}`;
      index++;
    }
    return candidate;
  }

  private async writeSolution(solution: LingBuilderSolution): Promise<void> {
    const normalized = this.normalizeSolution(solution);
    const targetPath = this.solutionPath();
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(normalized, null, 2), 'utf8');
    await fs.rename(temporaryPath, targetPath);
    await writeSolutionEntry(this.workspaceRoot, normalized);
  }

  private solutionPath(): string {
    return path.join(this.workspaceRoot, '.lingbuilder', 'solution.json');
  }

  private resolveWorkspacePath(relativePath: string): string {
    const resolved = path.resolve(this.workspaceRoot, relativePath);
    const root = path.resolve(this.workspaceRoot);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error(`路径越界：${relativePath}`);
    }
    return resolved;
  }
}

export function createSolutionService(workspaceRoot: string): SolutionService {
  return new SolutionService(workspaceRoot);
}

function createDesignerProject(projectId: string, name: string): LingWindowProject {
  return {
    id: projectId,
    name,
    windows: [
      {
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: `${name}主窗口`,
        width: 900,
        height: 560,
        background: '#1f2937',
        description: `${name} 默认主窗口`,
        controls: []
      }
    ]
  };
}

function createDefaultLingCppSource(className: string): string {
  return [
    `类 ${className}`,
    '    事件 创建完毕()',
    '        调试输出("窗口创建完毕")',
    '    结束',
    '结束类',
    ''
  ].join('\n');
}

async function collectTextFiles(
  workspaceRoot: string,
  directory: string,
  files: Record<string, TextFileSnapshot>
): Promise<void> {
  if (!(await exists(directory))) return;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(workspaceRoot, targetPath, files);
      continue;
    }
    if (!/\.(cpp|h|rc|ini|lcpp|e|xml|json)$/i.test(entry.name)) continue;
    const relativePath = path.relative(workspaceRoot, targetPath).replace(/\\/g, '/');
    files[relativePath] = decodeTextFile(await fs.readFile(targetPath));
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeSegment(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'lingbuilder-project';
}
