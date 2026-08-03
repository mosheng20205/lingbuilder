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
import { detectNestedWorkspaceArtifacts, isNestedWorkspaceArtifactPath, type NestedWorkspaceArtifactPlan } from './nestedWorkspaceGuard';

export const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';
export const DEFAULT_SOLUTION_ID = 'lingbuilder-solution';
let solutionWriteSerial = 0;
const solutionWriteQueues = new Map<string, Promise<void>>();

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
  solutionFolderId?: string;
}

export interface LingBuilderSolutionFolder {
  id: string;
  name: string;
}

export interface LingBuilderSolution {
  schemaVersion: 2;
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  folders: LingBuilderSolutionFolder[];
  projects: LingBuilderSolutionProject[];
}

export interface CreateSolutionProjectRequest {
  name?: string;
  projectId?: string;
  templateId?: SolutionProjectTemplateId;
  windowTitle?: string;
}

export type SolutionProjectTemplateId = 'blank-window' | 'hello-window';

export interface SolutionProjectTemplate {
  id: SolutionProjectTemplateId;
  name: string;
  description: string;
}

export interface PlannedSolutionProjectFile {
  relativePath: string;
  content: string;
  kind: 'source' | 'config' | 'designer';
}

export interface CreateSolutionProjectPlan {
  project: LingBuilderSolutionProject;
  designerProject: LingWindowProject;
  template: SolutionProjectTemplate;
  files: PlannedSolutionProjectFile[];
}

export const SOLUTION_PROJECT_TEMPLATES: readonly SolutionProjectTemplate[] = [
  {
    id: 'blank-window',
    name: '空白 Win32 窗口',
    description: '创建一个可直接编写中文代码的空白 Win32 窗口项目。'
  },
  {
    id: 'hello-window',
    name: '你好 LingBuilder',
    description: '创建包含标题、按钮和中文单击事件的最小可运行 Win32 示例。'
  }
];

export interface DeleteSolutionProjectOptions {
  deleteFiles?: boolean;
}

export interface CreateSolutionFolderRequest {
  name?: string;
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
    const template = getSolutionProjectTemplate('blank-window');
    const designerProject = createDesignerProject(DEFAULT_PROJECT_ID, '新建项目', template.id);
    await this.materializeProject(this.createMaterializationPlan(migrated.projects[0], designerProject, template));
    await this.writeSolution(migrated);
    return migrated;
  }

  async createProject(request: CreateSolutionProjectRequest = {}): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject; designerProject: LingWindowProject }> {
    const solution = await this.getSolution();
    const plan = this.createProjectPlan(request, solution);
    const { project, designerProject } = plan;

    try {
      await this.materializeProject(plan);
    } catch (error) {
      await this.removeMaterializedProjectFiles(project);
      throw error;
    }
    const nextSolution = {
      ...solution,
      startupProjectId: solution.startupProjectId || project.id,
      projects: [...solution.projects, project]
    };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project, designerProject };
  }

  async previewCreateProject(request: CreateSolutionProjectRequest = {}): Promise<CreateSolutionProjectPlan> {
    return this.createProjectPlan(request, await this.getSolution());
  }

  async importExternalProject(relativePath: string): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject }> {
    const solution = await this.getSolution();
    const inspected = await this.externalProjectService.inspect(relativePath);
    const project = { ...inspected, id: this.createUniqueProjectId(inspected.id, solution) } as LingBuilderSolutionProject;
    const nextSolution = { ...solution, projects: [...solution.projects, project] };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project };
  }

  async createFolder(request: CreateSolutionFolderRequest = {}): Promise<{ solution: LingBuilderSolution; folder: LingBuilderSolutionFolder }> {
    const solution = await this.getSolution();
    const requestedName = request.name?.trim() || '新建解决方案文件夹';
    const usedNames = new Set(solution.folders.map(folder => folder.name));
    let name = requestedName;
    let nameSuffix = 2;
    while (usedNames.has(name)) name = `${requestedName} (${nameSuffix++})`;
    const usedIds = new Set(solution.folders.map(folder => folder.id));
    const baseId = safeSegment(requestedName).toLowerCase() || 'solution-folder';
    let id = baseId === 'lingbuilder-project' ? 'solution-folder' : baseId;
    let idSuffix = 2;
    while (usedIds.has(id)) id = `${baseId}-${idSuffix++}`;
    const folder = { id, name };
    const nextSolution = { ...solution, folders: [...solution.folders, folder] };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, folder };
  }

  async updateProject(projectId: string, patch: Partial<Pick<LingBuilderSolutionProject, 'name' | 'references' | 'buildProperties'>> & { startup?: boolean; startupProjectIds?: string[]; solutionFolderId?: string | null }): Promise<LingBuilderSolution> {
    const solution = await this.getSolution();
    const target = solution.projects.find(project => project.id === projectId);
    if (!target) throw new Error(`未找到项目：${projectId}`);
    if (patch.buildProperties) validateProperties(patch.buildProperties);
    if (patch.solutionFolderId && !solution.folders.some(folder => folder.id === patch.solutionFolderId)) {
      throw new Error(`未找到解决方案文件夹：${patch.solutionFolderId}`);
    }
    const requestedName = patch.name === undefined ? undefined : validateProjectDisplayName(patch.name, projectId, solution.projects);
    const updatesSolutionFolder = Object.prototype.hasOwnProperty.call(patch, 'solutionFolderId');

    const projects = solution.projects.map(project => {
      if (project.id !== projectId) return project;
      return {
        ...project,
        name: requestedName ?? project.name,
        references: project.id === projectId && patch.references ? [...new Set(patch.references)] : (project.references || []),
        buildProperties: patch.buildProperties || project.buildProperties,
        solutionFolderId: updatesSolutionFolder ? patch.solutionFolderId || undefined : project.solutionFolderId
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
    const sourceRoot = this.resolveWorkspacePath(project.sourceRoot);
    const nestedWorkspacePlan = await detectNestedWorkspaceArtifacts(sourceRoot);
    await collectTextFiles(this.workspaceRoot, sourceRoot, files, nestedWorkspacePlan);
    await collectTextFiles(this.workspaceRoot, this.resolveWorkspacePath(project.configRoot), files);
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

  private async materializeProject(plan: CreateSolutionProjectPlan): Promise<void> {
    await Promise.all(plan.files.map(async file => {
      const targetPath = this.resolveWorkspacePath(file.relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.content, 'utf8');
    }));
  }

  private async removeMaterializedProjectFiles(project: LingBuilderSolutionProject): Promise<void> {
    await Promise.all([
      fs.rm(this.resolveWorkspacePath(project.sourceRoot), { recursive: true, force: true }),
      fs.rm(this.resolveWorkspacePath(project.configRoot), { recursive: true, force: true }),
      fs.rm(this.resolveWorkspacePath(path.posix.dirname(project.designerPath)), { recursive: true, force: true })
    ]);
  }

  private createProjectPlan(request: CreateSolutionProjectRequest, solution: LingBuilderSolution): CreateSolutionProjectPlan {
    const baseName = validateProjectDisplayName((request.name || '新建项目').trim() || '新建项目', '', solution.projects);
    const projectId = this.createUniqueProjectId(request.projectId || baseName, solution);
    const template = getSolutionProjectTemplate(request.templateId);
    const project: LingBuilderSolutionProject = {
      id: projectId,
      name: baseName,
      type: 'visual-cpp',
      sourceRoot: `src/${projectId}`,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`,
      references: []
    };
    const designerProject = createDesignerProject(project.id, project.name, template.id, request.windowTitle);
    return this.createMaterializationPlan(project, designerProject, template);
  }

  private createMaterializationPlan(
    project: LingBuilderSolutionProject,
    designerProject: LingWindowProject,
    template: SolutionProjectTemplate
  ): CreateSolutionProjectPlan {
    const mainWindow = designerProject.windows[0];
    const files: PlannedSolutionProjectFile[] = [
      {
        relativePath: path.posix.join(project.sourceRoot, `${mainWindow.className}.lcpp`),
        content: createTemplateLingCppSource(mainWindow.className, template.id),
        kind: 'source'
      },
      { relativePath: path.posix.join(project.sourceRoot, PROJECT_GLOBALS_FILE_NAME), content: EMPTY_PROJECT_GLOBALS_SOURCE, kind: 'source' },
      { relativePath: path.posix.join(project.sourceRoot, PROJECT_DATA_TYPES_FILE_NAME), content: EMPTY_PROJECT_DATA_TYPES_SOURCE, kind: 'source' },
      { relativePath: path.posix.join(project.configRoot, 'config.ini'), content: `[project]\nname=${project.name}\nid=${project.id}\n`, kind: 'config' },
      { relativePath: project.designerPath, content: JSON.stringify(designerProject, null, 2), kind: 'designer' }
    ];
    return { project, designerProject, template, files };
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
    const folders = normalizeSolutionFolders((solution as Partial<LingBuilderSolution>).folders);
    const folderIds = new Set(folders.map(folder => folder.id));
    const normalizedProjects = projects.map(project => ({
      ...project,
      references: Array.isArray(project.references) ? [...new Set(project.references)] : [],
      solutionFolderId: project.solutionFolderId && folderIds.has(project.solutionFolderId) ? project.solutionFolderId : undefined
    }));
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
      folders,
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
      folders: [],
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
    await enqueueSolutionWrite(targetPath, async () => {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      const temporaryPath = `${targetPath}.${process.pid}.${++solutionWriteSerial}.tmp`;
      await fs.writeFile(temporaryPath, JSON.stringify(normalized, null, 2), 'utf8');
      await fs.rename(temporaryPath, targetPath);
      await writeSolutionEntry(this.workspaceRoot, normalized);
    });
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

function createDesignerProject(
  projectId: string,
  name: string,
  templateId: SolutionProjectTemplateId = 'blank-window',
  requestedWindowTitle?: string
): LingWindowProject {
  const windowTitle = normalizeWindowTitle(requestedWindowTitle, `${name}主窗口`);
  return {
    schemaVersion: 2,
    id: projectId,
    name,
    resources: [],
    windows: [
      {
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: windowTitle,
        width: 900,
        height: 560,
        background: '#1f2937',
        description: `${name} 默认主窗口`,
        designerBackend: 'win32',
        controls: templateId === 'hello-window' ? createHelloWindowControls() : []
      }
    ]
  };
}

function createTemplateLingCppSource(className: string, templateId: SolutionProjectTemplateId): string {
  if (templateId === 'hello-window') {
    return [
      `类 ${className}`,
      '    事件 创建完毕()',
      '        调试输出("你好，LingBuilder 项目已启动。")',
      '    结束',
      '',
      '    事件 _问候按钮_被单击()',
      '        信息框("你好，LingBuilder！")',
      '    结束',
      '结束类',
      ''
    ].join('\n');
  }
  return [
    `类 ${className}`,
    '    事件 创建完毕()',
    '        调试输出("窗口创建完毕")',
    '    结束',
    '结束类',
    ''
  ].join('\n');
}

function createHelloWindowControls(): LingWindowProject['windows'][number]['controls'] {
  return [
    {
      id: 'hello-title', type: 'Label', name: '欢迎标题', content: '你好，LingBuilder',
      width: 360, height: 44, x: 48, y: 48, fontSize: 24,
      background: 'transparent', foreground: '#f8fafc', isEnabled: true, visibility: 'Visible'
    },
    {
      id: 'hello-button', type: 'Button', name: '问候按钮', content: '显示问候',
      width: 140, height: 38, x: 48, y: 120, fontSize: 13,
      background: '#2563eb', foreground: '#ffffff', isEnabled: true, visibility: 'Visible',
      events: { Click: '_问候按钮_被单击' }
    }
  ];
}

function getSolutionProjectTemplate(templateId?: string): SolutionProjectTemplate {
  const normalized = templateId?.trim() || 'blank-window';
  const template = SOLUTION_PROJECT_TEMPLATES.find(item => item.id === normalized);
  if (!template) throw new Error(`不支持的项目模板：${normalized}`);
  return template;
}

function normalizeWindowTitle(value: string | undefined, fallback: string): string {
  const title = value?.trim() || fallback;
  if (title.length > 120) throw new Error('窗口标题不能超过 120 个字符。');
  if (/[\r\n\t]/u.test(title)) throw new Error('窗口标题不能包含换行符或制表符。');
  return title;
}

async function collectTextFiles(
  workspaceRoot: string,
  directory: string,
  files: Record<string, TextFileSnapshot>,
  nestedWorkspacePlan?: NestedWorkspaceArtifactPlan
): Promise<void> {
  if (nestedWorkspacePlan && isNestedWorkspaceArtifactPath(directory, nestedWorkspacePlan)) return;
  if (!(await exists(directory))) return;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(workspaceRoot, targetPath, files, nestedWorkspacePlan);
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

function normalizeSolutionFolders(value: unknown): LingBuilderSolutionFolder[] {
  if (!Array.isArray(value)) return [];
  const usedIds = new Set<string>();
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const source = item as Partial<LingBuilderSolutionFolder>;
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    const name = typeof source.name === 'string' ? source.name.trim() : '';
    if (!id || !name || usedIds.has(id)) return [];
    usedIds.add(id);
    return [{ id, name }];
  });
}

function validateProjectDisplayName(value: string, projectId: string, projects: readonly LingBuilderSolutionProject[]): string {
  const name = value.trim();
  if (!name) throw new Error('项目名称不能为空。');
  if (name.length > 100) throw new Error('项目名称不能超过 100 个字符。');
  if (/[\r\n\t]/u.test(name)) throw new Error('项目名称不能包含换行符或制表符。');
  if (projects.some(project => project.id !== projectId && project.name.localeCompare(name, 'zh-CN', { sensitivity: 'accent' }) === 0)) {
    throw new Error(`解决方案中已存在名为“${name}”的项目。`);
  }
  return name;
}

async function enqueueSolutionWrite(targetPath: string, write: () => Promise<void>): Promise<void> {
  const previous = solutionWriteQueues.get(targetPath) || Promise.resolve();
  const pending = previous.catch(() => undefined).then(write);
  solutionWriteQueues.set(targetPath, pending);
  try {
    await pending;
  } finally {
    if (solutionWriteQueues.get(targetPath) === pending) solutionWriteQueues.delete(targetPath);
  }
}
