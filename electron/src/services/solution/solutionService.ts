import fs from 'fs/promises';
import path from 'path';
import { decodeTextFile } from '../files/textFileService';
import type { TextFileSnapshot } from '../files/types';
import { LingWindowProject, type LingControl } from '../windowDesigner/types';
import { normalizeStartupProjects, topologicalProjectOrder, validateProjectDependencies } from './projectDependencyGraph';
import { ExternalProjectService, validateProperties, type ExternalProjectProperties } from './externalProjectService';
import { collectCppSourceFiles, generateCMakeSkeleton } from './externalProjectDetect';
import { importNativeCppToLingBuilder } from '../windowDesigner/nativeCppImportService';
import { BuildConfigurationService } from '../tasks/buildConfigurationService';
import { getEffectiveBuildPathTemplates, resolveProjectBuildDirectories } from '../tasks/buildPathService';
import { writeSolutionEntry } from './solutionEntryFile';
import { EMPTY_PROJECT_GLOBALS_SOURCE, PROJECT_GLOBALS_FILE_NAME } from '../lingCpp/projectGlobalService';
import { EMPTY_PROJECT_DATA_TYPES_SOURCE, PROJECT_DATA_TYPES_FILE_NAME } from '../lingCpp/projectDataTypeService';
import { EMPTY_PROJECT_DLL_COMMANDS_SOURCE, PROJECT_DLL_COMMANDS_FILE_NAME } from '../lingCpp/projectDllCommandService';
import { detectNestedWorkspaceArtifacts, isNestedWorkspaceArtifactPath, isProjectBuildArtifactRelativePath, type NestedWorkspaceArtifactPlan } from './nestedWorkspaceGuard';
import type { Win32ControlPropertyValue } from '../windowDesigner/win32ControlRegistry';
import { detectLatestMsvcPlatformToolset } from '../windowDesigner/msvcPlatformToolset';
import { createWindowsDllProjectFiles } from './windowsDllProjectService';

export const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';
export const DEFAULT_SOLUTION_ID = 'lingbuilder-solution';
let solutionWriteSerial = 0;
const solutionWriteQueues = new Map<string, Promise<void>>();

export interface LingBuilderSolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp' | 'windows-dll' | 'windows-console' | 'external-msbuild' | 'external-cmake';
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
  /** 新建时一并设置解决方案名称；工作区已有解决方案时表示重命名。 */
  solutionName?: string;
  /** 项目源码目录，支持工作区相对路径或工作区内绝对路径；缺省为 src/<projectId>。 */
  projectDirectory?: string;
  /**
   * 可选：项目产物类型（exe 缺省 / dll）。仅窗口模板（kind windows-ui）接受 dll——把「公开」子程序
   * 导出为 DLL 接口；windows-dll 模板本身就是动态库（显式传 exe 报错），控制台模板固定控制台程序、
   * new_emoji 模板后端不支持 DLL 输出，两者传 dll 都会在创建前被中文报错拒绝。
   */
  outputType?: 'exe' | 'dll';
}

export type SolutionProjectTemplateId = 'blank-window' | 'hello-window' | 'sqlite-crud-window' | 'new-emoji-fbro-browser-shell' | 'windows-dll' | 'windows-console';

export interface SolutionProjectTemplate {
  id: SolutionProjectTemplateId;
  name: string;
  description: string;
  kind?: 'windows-ui' | 'windows-dll' | 'windows-console';
  moduleIds?: readonly string[];
  architecture?: 'Win32' | 'x64';
}

export interface PlannedSolutionProjectFile {
  relativePath: string;
  content: string;
  kind: 'source' | 'config' | 'designer';
}

export interface CreateSolutionProjectPlan {
  project: LingBuilderSolutionProject;
  designerProject?: LingWindowProject;
  template: SolutionProjectTemplate;
  files: PlannedSolutionProjectFile[];
}

export const SOLUTION_PROJECT_TEMPLATES: readonly SolutionProjectTemplate[] = [
  {
    id: 'blank-window',
    name: '空白 Win32 窗口',
    description: '创建一个可直接编写中文代码的空白 Win32 窗口项目。',
    kind: 'windows-ui'
  },
  {
    id: 'hello-window',
    name: '你好 LingBuilder',
    description: '创建包含标题、按钮和中文单击事件的最小可运行 Win32 示例。',
    kind: 'windows-ui'
  },
  {
    id: 'sqlite-crud-window',
    name: 'SQLite 会员管理（增删改查）',
    description: '创建「表单输入 + 列表视图 + SQLite 数据库」的完整增删改查示例：数据存入 members.db，支持新增、修改、删除和刷新。',
    kind: 'windows-ui',
    moduleIds: [
      'lingbuilder.win32.basic',
      'lingbuilder.win32.common-controls',
      'lingbuilder.database.sqlite'
    ]
  },
  {
    id: 'new-emoji-fbro-browser-shell',
    name: 'new_emoji FBro 浏览器外壳',
    description: '创建带标签页、地址栏、菜单、弹层、窗口按钮和真实 FBro x64 网页宿主的浏览器外壳。',
    kind: 'windows-ui',
    architecture: 'x64',
    moduleIds: [
      'lingbuilder.win32.basic',
      'lingbuilder.new_emoji.ui',
      'lingbuilder.fbro.browser',
      'lingbuilder.fbro.sdk',
      'lingbuilder.new_emoji.fbro-shell'
    ]
  },
  {
    id: 'windows-dll',
    name: 'Windows 动态链接库',
    description: '创建可由其他 Windows 程序调用的 MSVC DLL 项目，包含 C ABI 导出示例和 Visual Studio 工程。',
    kind: 'windows-dll',
    moduleIds: [],
    architecture: 'Win32'
  },
  {
    id: 'windows-console',
    name: 'Windows 控制台程序',
    description: '创建以“公开 启动()”子程序为主体的控制台项目，编译为命令行可执行文件。',
    kind: 'windows-console'
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
    await this.materializeProject(await this.createMaterializationPlan(migrated.projects[0], designerProject, template));
    await this.writeSolution(migrated);
    return migrated;
  }

  async createProject(request: CreateSolutionProjectRequest = {}): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject; designerProject?: LingWindowProject; logs?: string[] }> {
    const solution = await this.getSolution();
    const plan = await this.createProjectPlan(request, solution);
    const { project, designerProject } = plan;

    await this.ensureProjectTargetDirectoriesEmpty(project);
    try {
      await this.materializeProject(plan);
    } catch (error) {
      await this.removeMaterializedProjectFiles(project);
      throw error;
    }
    const logs: string[] = [];
    let nextSolution = {
      ...solution,
      startupProjectId: solution.startupProjectId || project.id,
      projects: [...solution.projects, project]
    };
    const requestedSolutionName = typeof request.solutionName === 'string' ? request.solutionName.trim() : '';
    if (requestedSolutionName && requestedSolutionName !== solution.name) {
      const validatedSolutionName = validateSolutionDisplayName(requestedSolutionName);
      nextSolution = { ...nextSolution, name: validatedSolutionName };
      logs.push(solution.name === '未命名解决方案'
        ? `已命名解决方案：${validatedSolutionName}`
        : `已重命名解决方案：${solution.name} → ${validatedSolutionName}`);
    }
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project, designerProject, logs };
  }

  async previewCreateProject(request: CreateSolutionProjectRequest = {}): Promise<CreateSolutionProjectPlan> {
    return this.createProjectPlan(request, await this.getSolution());
  }

  /**
   * 在用户指定的绝对目录（可以是当前工作区之外的其他磁盘）创建一个独立、自包含的项目工作区：
   * 目录内包含 .lingbuilder/solution.json、src、config 与解决方案入口文件，可整体复制迁移。
   * 布局与默认工作区一致（src / config / .lingbuilder/window-designer.json），
   * 之后把这个目录作为工作区打开即可无缝继续开发。创建完成后由调用方负责切换当前工作区。
   */
  async createProjectWorkspace(request: CreateSolutionProjectRequest = {}): Promise<{ solution: LingBuilderSolution; project: LingBuilderSolutionProject; designerProject?: LingWindowProject; logs?: string[]; workspaceRoot: string }> {
    const workspaceRoot = await this.resolveStandaloneProjectRoot(request.projectDirectory);
    const target = createSolutionService(workspaceRoot);
    const solutionName = typeof request.solutionName === 'string' && request.solutionName.trim()
      ? validateSolutionDisplayName(request.solutionName)
      : '未命名解决方案';
    const projectName = validateProjectDisplayName((request.name || '新建项目').trim() || '新建项目', DEFAULT_PROJECT_ID, []);
    const template = getSolutionProjectTemplate(request.templateId);
    const outputType = resolveCreatedProjectOutputType(template, request.outputType);
    const project: LingBuilderSolutionProject = {
      id: DEFAULT_PROJECT_ID,
      name: projectName,
      type: template.kind === 'windows-dll' ? 'windows-dll' : template.kind === 'windows-console' ? 'windows-console' : 'visual-cpp',
      sourceRoot: 'src',
      configRoot: 'config',
      designerPath: '.lingbuilder/window-designer.json',
      references: [],
      ...(template.kind === 'windows-dll' ? { projectFile: `src/${DEFAULT_PROJECT_ID}.vcxproj` } : {}),
      ...(template.architecture || outputType ? {
        buildProperties: {
          configuration: 'Debug' as const,
          architecture: template.architecture || 'Win32',
          additionalArguments: [],
          // DLL 项目创建即带 dll 输出类型：IDE 的 F5 禁用、「生成动态库」入口与服务端运行守卫都读它。
          ...(outputType ? { outputType } : {})
        }
      } : {})
    };
    const designerProject = template.kind === 'windows-dll'
      ? undefined
      : createDesignerProject(project.id, project.name, template.id, request.windowTitle);
    const filesPlan = await target.createMaterializationPlan(project, designerProject, template);
    await target.materializeProject(filesPlan);
    const solution: LingBuilderSolution = {
      schemaVersion: 2,
      id: DEFAULT_SOLUTION_ID,
      name: solutionName,
      startupProjectId: DEFAULT_PROJECT_ID,
      startupProjectIds: [DEFAULT_PROJECT_ID],
      folders: [],
      projects: [project]
    };
    await target.writeSolution(solution);
    const logs = [`已创建独立项目工作区：${workspaceRoot}`];
    if (solutionName !== '未命名解决方案') logs.push(`已命名解决方案：${solutionName}`);
    return { solution, project, designerProject, logs, workspaceRoot };
  }

  private async resolveStandaloneProjectRoot(input: unknown): Promise<string> {
    if (typeof input !== 'string' || !input.trim()) throw new Error('创建独立项目工作区需要绝对路径的创建位置。');
    const raw = collapseDuplicatedBackslashes(input.trim());
    if (/[\r\n\t]/u.test(raw)) throw new Error('创建位置不能包含换行符或制表符。');
    if (raw.length > 260) throw new Error('创建位置过长，请使用不超过 260 个字符的路径。');
    if (!path.isAbsolute(raw)) {
      throw new Error('创建独立项目工作区需要绝对路径的创建位置（如 D:\\Projects\\我的游戏）；相对路径请在当前工作区内创建。');
    }
    const resolved = path.resolve(raw);
    if (path.parse(resolved).root === resolved) {
      throw new Error('不能把磁盘根目录作为创建位置，请在根目录下选择或新建一个空目录。');
    }
    const workspaceRoot = path.resolve(this.workspaceRoot);
    const relative = path.relative(workspaceRoot, resolved);
    if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
      throw new Error('创建位置位于当前工作区内，请改用相对路径（如 games/我的游戏）在当前工作区内创建项目。');
    }
    if (await exists(resolved)) {
      const entries = await fs.readdir(resolved);
      if (entries.length > 0) throw new Error(`创建位置已存在且非空：${resolved}。请选择一个空目录或更换位置。`);
    } else {
      await fs.mkdir(resolved, { recursive: true });
    }
    return resolved;
  }

  async importExternalProject(relativePath: string, options: { mode?: 'expand' | 'single' } = {}): Promise<{
    solution: LingBuilderSolution; project: LingBuilderSolutionProject; projects?: LingBuilderSolutionProject[]; logs?: string[]; warnings?: string[];
  }> {
    const solution = await this.getSolution();
    if (relativePath.trim().toLowerCase().endsWith('.sln') && options.mode !== 'single') {
      // B1：把 .sln 展开为多个解决方案项目，依赖（ProjectDependencies）翻译为 references，
      // 由现有依赖拓扑分批构建直接复用；解析失败时调用方可用 mode:'single' 回退为整 sln 导入。
      const inspected = await this.externalProjectService.inspectSolution(relativePath);
      // 展开导入的项目在写出前携带 sln GUID 元数据，依赖翻译为 references 后丢弃（见下方 expanded 映射）。
      const projects: (LingBuilderSolutionProject & { solutionGuid?: string; solutionDependencies?: string[] })[] = [];
      const guidToId = new Map<string, string>();
      const dependenciesByGuid = new Map<string, string[]>();
      for (const candidate of inspected.projects) {
        const id = this.createUniqueProjectId(candidate.id, { ...solution, projects: [...solution.projects, ...projects] });
        if (candidate.solutionGuid) {
          guidToId.set(candidate.solutionGuid, id);
          dependenciesByGuid.set(candidate.solutionGuid, candidate.solutionDependencies || []);
        }
        projects.push({ ...candidate, id });
      }
      const expanded = projects.map(project => {
        if (!project.solutionGuid) return project;
        const { solutionGuid, solutionDependencies, ...rest } = project;
        const references = dependenciesByGuid.get(solutionGuid)
          ?.map(guid => guidToId.get(guid))
          .filter((referenceId): referenceId is string => Boolean(referenceId)) || [];
        return { ...rest, references };
      });
      const nextSolution = { ...solution, projects: [...solution.projects, ...expanded] };
      await this.writeSolution(nextSolution);
      return { solution: nextSolution, project: expanded[0]!, projects: expanded, logs: inspected.logs, warnings: inspected.warnings };
    }
    const inspected = await this.externalProjectService.inspect(relativePath);
    const project = { ...inspected, id: this.createUniqueProjectId(inspected.id, solution) } as LingBuilderSolutionProject;
    const nextSolution = { ...solution, projects: [...solution.projects, project] };
    await this.writeSolution(nextSolution);
    return { solution: nextSolution, project };
  }

  /**
   * 扫描工作区内源码目录，生成最小 CMakeLists.txt（生成物，可自由修改）并作为 external-cmake 工程导入。
   * 目录已有 CMakeLists.txt 时阻断；调用方确认后携带 overwrite=true 重试（只重写该文件）。
   */
  async importSourceDirectory(directory: string, options: { overwrite?: boolean } = {}): Promise<{
    solution: LingBuilderSolution; project: LingBuilderSolutionProject; generatedCMakeListsPath: string; sourceFiles: string[];
  }> {
    const absoluteDirectory = this.resolveWorkspacePath(String(directory || '').trim());
    const stat = await fs.stat(absoluteDirectory).catch(() => null);
    if (!stat?.isDirectory()) throw new Error(`源码目录不存在或不是目录：${directory}`);
    const sourceFiles = await collectCppSourceFiles(absoluteDirectory);
    if (sourceFiles.length === 0) {
      throw new Error('该目录（含三层子目录）下没有找到 C/C++ 源码文件（.cpp/.cc/.cxx/.c）。');
    }
    const cmakeListsPath = path.join(absoluteDirectory, 'CMakeLists.txt');
    if (!options.overwrite && await exists(cmakeListsPath)) {
      throw new Error('该目录已存在 CMakeLists.txt。如需重新生成请确认覆盖（只重写该文件）。');
    }
    const projectName = path.basename(absoluteDirectory);
    await fs.writeFile(cmakeListsPath, generateCMakeSkeleton(projectName, sourceFiles), 'utf8');
    const relativeCMakeLists = path.relative(path.resolve(this.workspaceRoot), cmakeListsPath).replace(/\\/gu, '/');
    const result = await this.importExternalProject(relativeCMakeLists);
    return { solution: result.solution, project: result.project, generatedCMakeListsPath: relativeCMakeLists, sourceFiles };
  }

  /**
   * 原生 C++ 源码适配为新的中文工程（D2）：读取 .cpp → importNativeCppToLingBuilder 翻译，
   * 新建空白窗口项目后覆写其 .lcpp 源码与设计器窗口模型；不修改被读取的原 C++ 源码。
   * 未识别的 C++ 语句会降级为 @ 原生块保留，翻译报告与诊断随结果返回。
   */
  async adaptNativeCppToProject(projectFileRelative: string, options: { name?: string } = {}): Promise<{
    solution: LingBuilderSolution; project: LingBuilderSolutionProject; report: string[]; diagnostics: string[]; preservedNativeBlockCount: number;
  }> {
    const absolutePath = this.resolveWorkspacePath(String(projectFileRelative || '').trim());
    const stat = await fs.stat(absolutePath).catch(() => null);
    if (!stat?.isFile()) throw new Error(`源码文件不存在：${projectFileRelative}`);
    if (!/\.(?:cpp|cc|cxx|c)$/iu.test(absolutePath)) throw new Error('只能适配 .cpp/.cc/.cxx/.c 源码文件。');
    const cppSource = await fs.readFile(absolutePath, 'utf8');
    const adapted = importNativeCppToLingBuilder(cppSource);
    const baseName = (options.name || '').trim() || `${path.basename(absolutePath, path.extname(absolutePath))}适配`;
    // 项目显示名不可重复：带后缀依次重试，避免与既有项目冲突。
    let created: Awaited<ReturnType<SolutionService['createProject']>> | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const candidateName = attempt === 0 ? baseName : `${baseName}${attempt + 1}`;
      try {
        created = await this.createProject({ name: candidateName, templateId: 'blank-window' });
      } catch (error) {
        lastError = error;
        // 仅在名称冲突时重试，其他错误直接抛出。
        if (!/已存在|重名|名称/iu.test(error instanceof Error ? error.message : String(error))) throw error;
      }
    }
    if (!created) {
      throw lastError instanceof Error ? lastError : new Error('创建适配项目失败。');
    }
    const project = created.project;
    const designerAbsolute = this.resolveWorkspacePath(project.designerPath);
    const designerProject = JSON.parse(await fs.readFile(designerAbsolute, 'utf8')) as LingWindowProject;
    const adaptedWindows = Array.isArray(adapted.designerProjectPatch.windows) && adapted.designerProjectPatch.windows.length > 0
      ? adapted.designerProjectPatch.windows
      : designerProject.windows;
    const nextDesigner = { ...designerProject, ...adapted.designerProjectPatch, windows: adaptedWindows };
    await fs.writeFile(designerAbsolute, JSON.stringify(nextDesigner, null, 2), 'utf8');
    const templateWindow = designerProject.windows[0];
    const lcppRelative = path.posix.join(project.sourceRoot, `${templateWindow?.className || 'MainWindow'}.lcpp`);
    await fs.writeFile(this.resolveWorkspacePath(lcppRelative), adapted.lcppSource, 'utf8');
    return {
      solution: created.solution,
      project,
      report: adapted.report,
      diagnostics: adapted.diagnostics,
      preservedNativeBlockCount: adapted.preservedNativeBlocks.length
    };
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
    if (patch.buildProperties) await this.assertProjectBuildPathsCompatible(solution, projectId, patch.buildProperties);
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

  /**
   * 项目构建目录/生成源码目录的保存期冲突校验：当前项目的解析结果不得与其他项目的
   * 构建目录、生成源码目录或源码根目录重合、嵌套，避免 F5/清理/导出互相破坏。
   * 目录名按保守规范化比较；规范同名即视为冲突（宁误报不静默放行）。
   */
  private async assertProjectBuildPathsCompatible(
    solution: LingBuilderSolution,
    projectId: string,
    buildProperties: ExternalProjectProperties
  ): Promise<void> {
    const configuration = await new BuildConfigurationService(this.workspaceRoot).read();
    const currentProject = solution.projects.find(project => project.id === projectId);
    const resolveDirs = (project: Pick<LingBuilderSolutionProject, 'id' | 'name' | 'type' | 'buildProperties' | 'sourceRoot'>, effectiveBuildProperties: ExternalProjectProperties) => {
      const templates = {
        buildDirectory: effectiveBuildProperties.buildDirectory?.trim() || configuration.buildDirectory,
        generatedSourceDirectory: effectiveBuildProperties.generatedSourceDirectory?.trim() || configuration.generatedSourceDirectory
      };
      // 与构建链路保持同一规则：窗口设计器项目目录跟随工作区构建配置，外部/DLL 项目按自身属性。
      const platform = project.type === 'visual-cpp' ? configuration.architecture : (effectiveBuildProperties.architecture || configuration.architecture);
      const configurationMode = project.type === 'visual-cpp' ? configuration.mode : (effectiveBuildProperties.configuration || configuration.mode);
      const dirs = resolveProjectBuildDirectories({
        workspaceRoot: this.workspaceRoot,
        projectDirName: canonicalProjectDirName(project.id),
        projectName: project.name,
        platform,
        configuration: configurationMode,
        templates
      });
      return { dirs, sourceRoot: path.resolve(this.workspaceRoot, project.sourceRoot || '.') };
    };
    const current = resolveDirs({
      id: projectId,
      name: currentProject?.name || projectId,
      type: currentProject?.type || 'visual-cpp',
      buildProperties,
      sourceRoot: currentProject?.sourceRoot || '.'
    }, buildProperties);
    for (const other of solution.projects) {
      if (other.id === projectId) continue;
      const otherProperties = other.buildProperties || buildProperties;
      const candidate = resolveDirs(other, otherProperties);
      const pairs: ReadonlyArray<readonly [string, string, string, string]> = [
        [current.dirs.buildDir, '构建目录', candidate.dirs.buildDir, `项目 ${other.name} 的构建目录`],
        [current.dirs.buildDir, '构建目录', candidate.dirs.exportDir, `项目 ${other.name} 的生成源码目录`],
        [current.dirs.exportDir, '生成源码目录', candidate.dirs.buildDir, `项目 ${other.name} 的构建目录`],
        [current.dirs.exportDir, '生成源码目录', candidate.dirs.exportDir, `项目 ${other.name} 的生成源码目录`],
        [current.dirs.buildDir, '构建目录', candidate.sourceRoot, `项目 ${other.name} 的源码目录`],
        [current.dirs.exportDir, '生成源码目录', candidate.sourceRoot, `项目 ${other.name} 的源码目录`]
      ];
      for (const [own, ownLabel, theirs, theirsLabel] of pairs) {
        if (directoriesOverlap(own, theirs)) {
          throw new Error(`当前项目的${ownLabel}与${theirsLabel}重合或嵌套，请调整构建目录设置：${own}`);
        }
      }
    }
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
    return (await this.readDesignerProjectSnapshot(project)).project;
  }

  /** 读取设计器模型并标注是否真实落盘：persisted=false 表示文件缺失或无效，返回的是兜底空模型。 */
  async readDesignerProjectSnapshot(project: LingBuilderSolutionProject): Promise<{ project: LingWindowProject; persisted: boolean }> {
    const designerPath = this.resolveWorkspacePath(project.designerPath);
    if (await exists(designerPath)) {
      const parsed = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
      if (parsed && Array.isArray(parsed.windows) && parsed.windows.length > 0) {
        return { project: { ...parsed, id: parsed.id || project.id, name: parsed.name || project.name }, persisted: true };
      }
    }
    return { project: createDesignerProject(project.id, project.name), persisted: false };
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
    const foreignRoots = await this.foreignProjectRoots(project);
    await collectTextFiles(this.workspaceRoot, sourceRoot, files, nestedWorkspacePlan, foreignRoots);
    await collectTextFiles(this.workspaceRoot, this.resolveWorkspacePath(project.configRoot), files, undefined, foreignRoots);
    return files;
  }

  /**
   * 项目文件归属隔离：新建项目默认落在 `src/<id>`、`config/<id>`，嵌套在默认项目 `src`/`config` 内部。
   * 枚举任一项目文件时必须剪掉其他项目归属的根目录，否则解决方案树出现重复 MainWindow.lcpp/config.ini，
   * 构建源码集合与项目上下文也会吸入别家同名固定文件（重复类定义、DLL 命令冲突）。
   */
  private async foreignProjectRoots(project: LingBuilderSolutionProject): Promise<string[]> {
    const solution = await this.getSolution();
    const normalize = (value: string | undefined) => normalizeWorkspaceRelative(value).replace(/\/+$/u, '').toLowerCase();
    const ownRoots = [normalize(project.sourceRoot), normalize(project.configRoot)].filter(root => root && root !== '.');
    const foreign = solution.projects
      .filter(other => other.id !== project.id)
      .flatMap(other => [normalize(other.sourceRoot), normalize(other.configRoot)])
      .filter(root => root && root !== '.')
      // 只剪「严格位于本项目根之下」的别家根；别家根是本项目根的祖先/相等时不动（默认 src 嵌套 src/<id> 的常态）。
      .filter(root => ownRoots.some(own => root.startsWith(`${own}/`)));
    return [...new Set(foreign)];
  }

  async cleanProjects(projectIds?: string[]): Promise<CleanSolutionResult> {
    const solution = await this.getSolution();
    const selectedIds = projectIds?.length ? projectIds : solution.projects.map(project => project.id);
    const validProjects = solution.projects.filter(project => selectedIds.includes(project.id));
    const removedDirs: string[] = [];
    const preservedDirs = validProjects.map(project => this.resolveWorkspacePath(`generated/cpp/${safeSegment(project.id)}`));
    const logs: string[] = [];
    const buildConfiguration = await new BuildConfigurationService(this.workspaceRoot).read();

    for (const project of validProjects) {
      const templates = {
        buildDirectory: project.buildProperties?.buildDirectory?.trim() || buildConfiguration.buildDirectory,
        generatedSourceDirectory: project.buildProperties?.generatedSourceDirectory?.trim() || buildConfiguration.generatedSourceDirectory
      };
      // 目录里的平台/配置段必须与实际构建链路一致：窗口设计器项目跟随工作区构建配置，
      // 外部/DLL 项目按自身 buildProperties 构建。
      const platform = project.type === 'visual-cpp' ? buildConfiguration.architecture : (project.buildProperties?.architecture || buildConfiguration.architecture);
      const configuration = project.type === 'visual-cpp' ? buildConfiguration.mode : (project.buildProperties?.configuration || buildConfiguration.mode);
      const resolved = resolveProjectBuildDirectories({
        workspaceRoot: this.workspaceRoot,
        projectDirName: safeSegment(project.id),
        projectName: project.name,
        platform,
        configuration,
        templates
      });
      // 配置变更后旧缺省目录里的残留也要一并清理，避免占用磁盘并干扰增量缓存。
      const legacyBuildDir = this.resolveWorkspacePath(`.lingbuilder-build/${safeSegment(project.id)}`);
      for (const buildDir of new Set([resolved.buildDir, legacyBuildDir])) {
        await fs.rm(buildDir, { recursive: true, force: true });
        removedDirs.push(buildDir);
        logs.push(`已清理项目 ${project.name} 的临时构建目录：${buildDir}`);
      }
      preservedDirs.push(resolved.exportDir);
      if (project.type === 'windows-dll' && project.projectFile) {
        const projectRoot = this.resolveWorkspacePath(path.posix.dirname(project.projectFile.replace(/\\/gu, '/')));
        for (const architecture of ['Win32', 'x64'] as const) {
          for (const configuration of ['Debug', 'Release'] as const) {
            const dllBuildDir = path.join(projectRoot, architecture, configuration);
            await fs.rm(dllBuildDir, { recursive: true, force: true });
            removedDirs.push(dllBuildDir);
          }
        }
        logs.push(`已清理项目 ${project.name} 的 DLL 配置输出目录。`);
      }
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

  /** 解析用户输入的项目创建目录为工作区相对路径；未提供时回落到 src/<projectId>。 */
  private resolveProjectSourceDirectory(input: unknown, projectId: string): string {
    if (input === undefined || input === null || (typeof input === 'string' && input.trim() === '')) {
      return `src/${projectId}`;
    }
    if (typeof input !== 'string') throw new Error('创建位置格式无效，请输入目录路径。');
    const raw = collapseDuplicatedBackslashes(input.trim());
    if (/[\r\n\t]/u.test(raw)) throw new Error('创建位置不能包含换行符或制表符。');
    if (raw.length > 260) throw new Error('创建位置过长，请使用不超过 260 个字符的路径。');
    const resolved = this.resolveWorkspacePath(raw);
    const relative = path.relative(this.workspaceRoot, resolved).replace(/\\/g, '/');
    if (!relative || relative === '.') throw new Error('创建位置不能是工作区根目录。');
    const segments = relative.split('/').filter(Boolean);
    if (segments.some(segment => segment === '..')) throw new Error(`创建位置越界：${raw}`);
    if (segments.some(segment => segment.startsWith('.'))) throw new Error(`创建位置不能包含以点开头的目录（如 .lingbuilder、.git）：${raw}`);
    return segments.join('/');
  }

  /** 新建项目前确认目标目录可用：目录已存在且非空时拒绝，避免静默覆盖既有文件。 */
  private async ensureProjectTargetDirectoriesEmpty(project: LingBuilderSolutionProject): Promise<void> {
    const targets = [project.sourceRoot, project.configRoot, path.posix.dirname(project.designerPath)];
    for (const relative of targets) {
      const absolute = this.resolveWorkspacePath(relative);
      if (!(await exists(absolute))) continue;
      const entries = await fs.readdir(absolute);
      if (entries.length > 0) {
        throw new Error(`创建位置已存在且非空：${relative}。请更换项目名称或创建位置，避免覆盖已有文件。`);
      }
    }
  }

  private async createProjectPlan(request: CreateSolutionProjectRequest, solution: LingBuilderSolution): Promise<CreateSolutionProjectPlan> {
    const baseName = validateProjectDisplayName((request.name || '新建项目').trim() || '新建项目', '', solution.projects);
    const projectId = this.createUniqueProjectId(request.projectId || baseName, solution);
    const sourceRoot = this.resolveProjectSourceDirectory(request.projectDirectory, projectId);
    const template = getSolutionProjectTemplate(request.templateId);
    const outputType = resolveCreatedProjectOutputType(template, request.outputType);
    const project: LingBuilderSolutionProject = {
      id: projectId,
      name: baseName,
      type: template.kind === 'windows-dll' ? 'windows-dll' : template.kind === 'windows-console' ? 'windows-console' : 'visual-cpp',
      sourceRoot,
      configRoot: `config/${projectId}`,
      designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`,
      references: [],
      ...(template.kind === 'windows-dll' ? { projectFile: path.posix.join(sourceRoot, `${projectId}.vcxproj`) } : {}),
      ...(template.architecture || outputType ? {
        buildProperties: {
          configuration: 'Debug' as const,
          architecture: template.architecture || 'Win32',
          additionalArguments: [],
          // 与独立工作区创建路径（createProjectWorkspace）保持同一口径：DLL 项目创建即带 dll 输出类型。
          ...(outputType ? { outputType } : {})
        }
      } : {})
    };
    const designerProject = template.kind === 'windows-dll'
      ? undefined
      : createDesignerProject(project.id, project.name, template.id, request.windowTitle);
    if (template.kind === 'windows-console' && designerProject) {
      applyConsoleTemplateWindow(designerProject, project.name);
    }
    return await this.createMaterializationPlan(project, designerProject, template);
  }

  private async createMaterializationPlan(
    project: LingBuilderSolutionProject,
    designerProject: LingWindowProject | undefined,
    template: SolutionProjectTemplate
  ): Promise<CreateSolutionProjectPlan> {
    if (template.kind === 'windows-dll') {
      const platformToolset = (await detectLatestMsvcPlatformToolset()).toolset;
      const dllFiles = createWindowsDllProjectFiles(project.id, project.name, { platformToolset });
      return {
        project,
        template,
        files: [
          ...dllFiles.map(file => ({
            relativePath: path.posix.join(project.sourceRoot, file.relativePath),
            content: file.content,
            kind: file.kind === 'source' || file.kind === 'header' || file.kind === 'definition' ? 'source' as const : 'config' as const
          })),
          { relativePath: project.configRoot + '/config.ini', content: `[project]\nname=${project.name}\nid=${project.id}\ntype=windows-dll\n`, kind: 'config' as const },
          {
            relativePath: `.lingbuilder/projects/${project.id}/project-modules.json`,
            content: `${JSON.stringify({ schemaVersion: 1, enabledModuleIds: [], pinnedVersions: {} }, null, 2)}\n`,
            kind: 'config' as const
          }
        ]
      };
    }
    if (template.kind === 'windows-console') {
      if (!designerProject) throw new Error('控制台项目缺少设计器模型。');
      applyConsoleTemplateWindow(designerProject, project.name);
      const files: PlannedSolutionProjectFile[] = [
        {
          relativePath: path.posix.join(project.sourceRoot, `${CONSOLE_TEMPLATE_CLASS_NAME}.lcpp`),
          content: createConsoleTemplateLingCppSource(),
          kind: 'source'
        },
        { relativePath: path.posix.join(project.sourceRoot, PROJECT_GLOBALS_FILE_NAME), content: EMPTY_PROJECT_GLOBALS_SOURCE, kind: 'source' },
        { relativePath: path.posix.join(project.sourceRoot, PROJECT_DATA_TYPES_FILE_NAME), content: EMPTY_PROJECT_DATA_TYPES_SOURCE, kind: 'source' },
        { relativePath: path.posix.join(project.sourceRoot, PROJECT_DLL_COMMANDS_FILE_NAME), content: EMPTY_PROJECT_DLL_COMMANDS_SOURCE, kind: 'source' },
        { relativePath: path.posix.join(project.configRoot, 'config.ini'), content: `[project]\nname=${project.name}\nid=${project.id}\ntype=windows-console\n`, kind: 'config' as const },
        { relativePath: project.designerPath, content: JSON.stringify(designerProject, null, 2), kind: 'designer' }
      ];
      return { project, designerProject, template, files };
    }
    if (!designerProject) throw new Error('窗口项目缺少设计器模型。');
    const mainWindow = designerProject.windows[0];
    if (!mainWindow) throw new Error('窗口项目至少需要一个窗口。');
    const files: PlannedSolutionProjectFile[] = [
      {
        relativePath: path.posix.join(project.sourceRoot, `${mainWindow.className}.lcpp`),
        content: createTemplateLingCppSource(mainWindow.className, template.id),
        kind: 'source'
      },
      { relativePath: path.posix.join(project.sourceRoot, PROJECT_GLOBALS_FILE_NAME), content: EMPTY_PROJECT_GLOBALS_SOURCE, kind: 'source' },
      { relativePath: path.posix.join(project.sourceRoot, PROJECT_DATA_TYPES_FILE_NAME), content: EMPTY_PROJECT_DATA_TYPES_SOURCE, kind: 'source' },
      { relativePath: path.posix.join(project.sourceRoot, PROJECT_DLL_COMMANDS_FILE_NAME), content: EMPTY_PROJECT_DLL_COMMANDS_SOURCE, kind: 'source' },
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

  /**
   * 只读读取解决方案：无 solution.json 时返回 null，绝不物化默认项目。
   * workspace.list 的 projects[] 视图与单项目 projectHint 用它——那些是读接口，
   * 走 getSolution() 会在空工作区悄悄创建 src/config 与默认项目。
   */
  async peekSolution(): Promise<LingBuilderSolution | null> {
    const existing = await this.readSolutionFile();
    return existing ? this.normalizeSolution(existing) : null;
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
      await replaceFile(temporaryPath, targetPath);
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

async function replaceFile(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error: any) {
    if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) throw error;
    await fs.rm(targetPath, { force: true });
    await fs.rename(sourcePath, targetPath);
  }
}

export function createSolutionService(workspaceRoot: string): SolutionService {
  return new SolutionService(workspaceRoot);
}

export const CONSOLE_TEMPLATE_CLASS_NAME = '程序';

/** 控制台模板窗口：不承载任何可视控件，仅作为“公开 启动()”子程序的生成宿主类。 */
function applyConsoleTemplateWindow(designerProject: LingWindowProject, projectName: string): void {
  const consoleWindow = designerProject.windows[0];
  if (!consoleWindow) return;
  consoleWindow.className = CONSOLE_TEMPLATE_CLASS_NAME;
  consoleWindow.title = `${projectName} 控制台`;
  consoleWindow.controls = [];
}

/**
 * SQLite 会员管理模板：表单输入 + 列表视图 + 增删改查。
 * 写法红线：带命令调用的局部变量一律先声明后赋值（生成器会把带初始化的局部变量
 * 提升到方法最前，直接初始化会脱离时序）；文本拼接不内联进调用参数（C2664），
 * 统一走 格式化文本。
 */
function createSqliteCrudTemplateSource(className: string): string {
  return [
    '包 会员管理示例',
    '使用 Win32窗口基础模块',
    '使用 通用控件模块',
    '使用 SQLite 数据库模块',
    '',
    `类 ${className} : 窗口`,
    '公开',
    '  SQLite连接 数据库',
    '',
    '  事件 创建完毕()',
    '    数据库 = SQLite_打开连接("members.db", 0, 5000)',
    '    如果 (数据库 == 0)',
    '      控件_设置文本(状态标签, 格式化文本("打开数据库失败：{}", SQLite_取错误()))',
    '    否则',
    '      SQLite_执行于(数据库, "CREATE TABLE IF NOT EXISTS members(id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL DEFAULT \'\', points INTEGER NOT NULL DEFAULT 0)")',
    '      重建会员列表()',
    '      控件_设置文本(状态标签, "数据库已就绪：新增、修改、删除都会立即写入 members.db")',
    '    如果结束',
    '  结束',
    '',
    '  事件 _新增按钮_被单击()',
    '    局部 文本型 姓名',
    '    姓名 = 控件_取文本(姓名框)',
    '    如果 (姓名 == "")',
    '      信息框("请先输入姓名再新增。", 64, "提示")',
    '    否则',
    '      局部 SQLite语句 插入语句',
    '      插入语句 = SQLite_准备(数据库, "INSERT INTO members(name, phone, points) VALUES(?1, ?2, ?3)")',
    '      如果 (插入语句 == 0)',
    '        控件_设置文本(状态标签, 格式化文本("新增失败：{}", SQLite_取错误()))',
    '      否则',
    '        局部 文本型 电话',
    '        电话 = 控件_取文本(电话框)',
    '        局部 文本型 积分文本',
    '        积分文本 = 控件_取文本(积分框)',
    '        SQLite_绑定文本(插入语句, 1, 姓名)',
    '        SQLite_绑定文本(插入语句, 2, 电话)',
    '        SQLite_绑定整数(插入语句, 3, 到整数(积分文本))',
    '        如果 (SQLite_语句步进(插入语句) == 0)',
    '          控件_设置文本(姓名框, "")',
    '          控件_设置文本(电话框, "")',
    '          控件_设置文本(积分框, "0")',
    '          重建会员列表()',
    '          控件_设置文本(状态标签, 格式化文本("已新增会员：{}", 姓名))',
    '        否则',
    '          控件_设置文本(状态标签, 格式化文本("新增失败：{}", SQLite_取错误()))',
    '        如果结束',
    '        SQLite_语句释放(插入语句)',
    '      如果结束',
    '    如果结束',
    '  结束',
    '',
    '  事件 _修改按钮_被单击()',
    '    局部 整数型 选中行',
    '    选中行 = 列表视图_取下一个选中行(会员列表, -1)',
    '    如果 (选中行 < 0)',
    '      信息框("请先在右侧列表中选中要修改的会员。", 64, "提示")',
    '    否则',
    '      局部 文本型 编号文本',
    '      编号文本 = 列表视图_取单元格(会员列表, 选中行, 0)',
    '      局部 文本型 姓名',
    '      姓名 = 控件_取文本(姓名框)',
    '      如果 (姓名 == "")',
    '        信息框("姓名不能为空，无法修改。", 64, "提示")',
    '      否则',
    '        局部 SQLite语句 更新语句',
    '        更新语句 = SQLite_准备(数据库, "UPDATE members SET name = ?1, phone = ?2, points = ?3 WHERE id = ?4")',
    '        如果 (更新语句 == 0)',
    '          控件_设置文本(状态标签, 格式化文本("修改失败：{}", SQLite_取错误()))',
    '        否则',
    '          局部 文本型 电话',
    '          电话 = 控件_取文本(电话框)',
    '          局部 文本型 积分文本',
    '          积分文本 = 控件_取文本(积分框)',
    '          SQLite_绑定文本(更新语句, 1, 姓名)',
    '          SQLite_绑定文本(更新语句, 2, 电话)',
    '          SQLite_绑定整数(更新语句, 3, 到整数(积分文本))',
    '          SQLite_绑定文本(更新语句, 4, 编号文本)',
    '          如果 (SQLite_语句步进(更新语句) == 0)',
    '            重建会员列表()',
    '            控件_设置文本(状态标签, 格式化文本("已修改会员编号 {}：{}", 编号文本, 姓名))',
    '          否则',
    '            控件_设置文本(状态标签, 格式化文本("修改失败：{}", SQLite_取错误()))',
    '          如果结束',
    '          SQLite_语句释放(更新语句)',
    '        如果结束',
    '      如果结束',
    '    如果结束',
    '  结束',
    '',
    '  事件 _删除按钮_被单击()',
    '    局部 整数型 选中行',
    '    选中行 = 列表视图_取下一个选中行(会员列表, -1)',
    '    如果 (选中行 < 0)',
    '      信息框("请先在右侧列表中选中要删除的会员。", 64, "提示")',
    '    否则',
    '      局部 文本型 编号文本',
    '      编号文本 = 列表视图_取单元格(会员列表, 选中行, 0)',
    '      局部 文本型 姓名',
    '      姓名 = 列表视图_取单元格(会员列表, 选中行, 1)',
    '      局部 SQLite语句 删除语句',
    '      删除语句 = SQLite_准备(数据库, "DELETE FROM members WHERE id = ?1")',
    '      如果 (删除语句 == 0)',
    '        控件_设置文本(状态标签, 格式化文本("删除失败：{}", SQLite_取错误()))',
    '      否则',
    '        SQLite_绑定文本(删除语句, 1, 编号文本)',
    '        如果 (SQLite_语句步进(删除语句) == 0)',
    '          重建会员列表()',
    '          控件_设置文本(状态标签, 格式化文本("已删除会员：{}", 姓名))',
    '        否则',
    '          控件_设置文本(状态标签, 格式化文本("删除失败：{}", SQLite_取错误()))',
    '        如果结束',
    '        SQLite_语句释放(删除语句)',
    '      如果结束',
    '    如果结束',
    '  结束',
    '',
    '  事件 _刷新按钮_被单击()',
    '    如果 (数据库 == 0)',
    '      信息框("数据库尚未打开，无法刷新。", 64, "提示")',
    '    否则',
    '      重建会员列表()',
    '      控件_设置文本(状态标签, "已重新加载全部会员。")',
    '    如果结束',
    '  结束',
    '',
    '  空 重建会员列表()',
    '    控件_清空项目(会员列表)',
    '    如果 (数据库 == 0)',
    '      控件_设置文本(状态标签, "数据库尚未打开。")',
    '    否则',
    '      局部 SQLite语句 查询',
    '      查询 = SQLite_准备(数据库, "SELECT id, name, phone, points FROM members ORDER BY id")',
    '      如果 (查询 == 0)',
    '        控件_设置文本(状态标签, 格式化文本("查询失败：{}", SQLite_取错误()))',
    '      否则',
    '        局部 整数型 步进结果',
    '        步进结果 = SQLite_语句步进(查询)',
    '        判断循环首 (步进结果 == 1)',
    '          局部 文本型 编号',
    '          编号 = SQLite_取列文本(查询, 0)',
    '          局部 文本型 姓名',
    '          姓名 = SQLite_取列文本(查询, 1)',
    '          局部 文本型 电话',
    '          电话 = SQLite_取列文本(查询, 2)',
    '          局部 整数型 积分',
    '          积分 = SQLite_取列整数(查询, 3)',
    '          列表视图_添加行(会员列表, 列表视图_创建行(编号, 姓名, 电话, 积分))',
    '          步进结果 = SQLite_语句步进(查询)',
    '        判断循环尾 ()',
    '        SQLite_语句释放(查询)',
    '      如果结束',
    '    如果结束',
    '  结束',
    '结束类',
    ''
  ].join('\n');
}

function createConsoleTemplateLingCppSource(): string {
  return [
    '包 控制台程序',
    '',
    `类 ${CONSOLE_TEMPLATE_CLASS_NAME}`,
    '公开',
    '  整数型 启动()',
    '    调试输出("你好，LingBuilder 控制台！")',
    '    返回 (0)',
    '  结束',
    '结束类',
    ''
  ].join('\n');
}

function createDesignerProject(
  projectId: string,
  name: string,
  templateId: SolutionProjectTemplateId = 'blank-window',
  requestedWindowTitle?: string
): LingWindowProject {
  const windowTitle = normalizeWindowTitle(requestedWindowTitle, `${name}主窗口`);
  const browserShell = templateId === 'new-emoji-fbro-browser-shell';
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
        width: browserShell ? 1180 : 900,
        height: browserShell ? 760 : 560,
        background: browserShell ? '#202124' : '#1f2937',
        description: `${name} 默认主窗口`,
        designerBackend: browserShell ? 'new-emoji' : 'win32',
        ...(browserShell ? {
          resizable: true,
          maximizable: true,
          cornerStyle: 'rounded' as const,
          windowFrame: {
            preset: 'browserShell' as const,
            flags: 0x3f,
            resizeBorder: { left: 6, top: 6, right: 6, bottom: 6 },
            cornerRadius: 10
          },
          events: {
            Loaded: '_MainWindow_创建完毕',
            SizeChanged: '_MainWindow_大小被改变',
            KeyDown: '_MainWindow_按键被按下',
            DpiChanged: '_MainWindow_DPI被改变'
          }
        } : {}),
        controls: templateId === 'hello-window'
          ? createHelloWindowControls()
          : templateId === 'sqlite-crud-window'
            ? createSqliteCrudWindowControls()
            : browserShell
              ? createNewEmojiFbroBrowserShellControls()
              : []
      }
    ]
  };
}

function createTemplateLingCppSource(className: string, templateId: SolutionProjectTemplateId): string {
  if (templateId === 'new-emoji-fbro-browser-shell') return createNewEmojiFbroBrowserShellSource(className);
  if (templateId === 'sqlite-crud-window') return createSqliteCrudTemplateSource(className);
  if (templateId === 'hello-window') {
    return [
      `类 ${className}`,
      '    事件 创建完毕()',
      '        调试输出("你好，LingBuilder 项目已启动。")',
      '    结束',
      '',
      '    事件 _问候按钮_被单击()',
      '        信息框("你好，LingBuilder！", 64, "提示")',
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

function createNewEmojiFbroBrowserShellSource(className: string): string {
  return [
    `类 ${className} : 公开 窗口`,
    '    构造()',
    '        调试输出("正在初始化 chrome_shell_demo.py 完整复刻版 new_emoji FBro 浏览器外壳。")',
    '',
    '    事件 _MainWindow_创建完毕()',
    '        浏览器外壳_创建(浏览器标签页, 浏览器页面占位, &浏览器状态改变)',
    '        浏览器外壳_新建标签页("home", "https://www.baidu.com", "新标签页")',
    '        控件_设置文本(地址栏, "https://www.baidu.com")',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    空 重排浏览器布局()',
    '        局部 整数型 窗口宽度 = 窗口_取事件宽度()',
    '        局部 整数型 窗口高度 = 窗口_取事件高度()',
    '        局部 整数型 当前DPI = 窗口_取事件DPI()',
    '        如果 (当前DPI <= 0)',
    '            当前DPI = 96',
    '        如果结束',
    '        窗口宽度 = 窗口宽度 * 96 / 当前DPI',
    '        窗口高度 = 窗口高度 * 96 / 当前DPI',
    '        如果 (窗口宽度 < 760)',
    '            窗口宽度 = 760',
    '        如果结束',
    '        如果 (窗口高度 < 420)',
    '            窗口高度 = 420',
    '        如果结束',
    '        局部 整数型 标签数量 = 浏览器外壳_取标签页数量()',
    '        局部 整数型 标签区宽度 = 0',
    '        局部 整数型 标签宽度 = 0',
    '        局部 整数型 标签控件宽度 = 0',
    '        局部 整数型 标签栏右边 = 0',
    '        局部 整数型 新建标签横坐标 = 0',
    '        局部 整数型 更多横坐标 = 0',
    '        局部 整数型 扩展横坐标 = 0',
    '        局部 整数型 下载横坐标 = 0',
    '        局部 整数型 地址栏宽度 = 0',
    '        如果 (标签数量 < 1)',
    '            标签数量 = 1',
    '        如果结束',
    '        标签区宽度 = 窗口宽度 - 300',
    '        如果 (标签区宽度 < 220)',
    '            标签区宽度 = 220',
    '        如果结束',
    '        标签宽度 = 标签区宽度 / 标签数量',
    '        如果 (标签宽度 > 220)',
    '            标签宽度 = 220',
    '        如果结束',
    '        如果 (标签宽度 < 96)',
    '            标签宽度 = 96',
    '        如果结束',
    '        标签控件宽度 = 标签数量 * 标签宽度',
    '        标签栏右边 = 16 + 标签控件宽度',
    '        如果 (标签栏右边 > 窗口宽度 - 184)',
    '            标签栏右边 = 窗口宽度 - 184',
    '        如果结束',
    '        新建标签横坐标 = 标签栏右边 + 8',
    '        如果 (新建标签横坐标 > 窗口宽度 - 176)',
    '            新建标签横坐标 = 窗口宽度 - 176',
    '        如果结束',
    '        更多横坐标 = 窗口宽度 - 58',
    '        如果 (更多横坐标 < 392)',
    '            更多横坐标 = 392',
    '        如果结束',
    '        扩展横坐标 = 更多横坐标 - 42',
    '        下载横坐标 = 扩展横坐标 - 42',
    '        地址栏宽度 = 下载横坐标 - 16 - 132',
    '        如果 (地址栏宽度 < 220)',
    '            地址栏宽度 = 220',
    '        如果结束',
    '        控件_设置位置大小(浏览器根容器, 0, 0, 窗口宽度, 窗口高度)',
    '        控件_设置位置大小(标签栏背景, 0, 0, 窗口宽度, 40)',
    '        控件_设置位置大小(工具栏背景, 0, 40, 窗口宽度, 50)',
    '        控件_设置位置大小(浏览器标签页, 16, 4, 标签控件宽度, 34)',
    '        控件_设置位置大小(新建标签按钮, 新建标签横坐标, 5, 30, 30)',
    '        控件_设置位置大小(后退按钮, 12, 46, 34, 34)',
    '        控件_设置位置大小(前进按钮, 50, 46, 34, 34)',
    '        控件_设置位置大小(刷新按钮, 88, 46, 34, 34)',
    '        控件_设置位置大小(地址栏, 132, 46, 地址栏宽度, 34)',
    '        控件_设置位置大小(下载按钮, 下载横坐标, 46, 34, 34)',
    '        控件_设置位置大小(扩展按钮, 扩展横坐标, 46, 34, 34)',
    '        控件_设置位置大小(更多按钮, 更多横坐标, 46, 34, 34)',
    '        控件_设置位置大小(最小化按钮, 窗口宽度 - 138, 0, 46, 32)',
    '        控件_设置位置大小(最大化按钮, 窗口宽度 - 92, 0, 46, 32)',
    '        控件_设置位置大小(关闭按钮, 窗口宽度 - 46, 0, 46, 32)',
    '        控件_设置位置大小(浏览器页面占位, 0, 90, 窗口宽度, 窗口高度 - 90)',
    '    结束',
    '',
    '    事件 _MainWindow_大小被改变()',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    事件 _MainWindow_DPI被改变(整数型 新DPI)',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    事件 _MainWindow_按键被按下(整数型 键码，逻辑型 Ctrl键按下，逻辑型 Shift键按下，逻辑型 Alt键按下)',
    '        如果 (Ctrl键按下 并且 键码 == 76)',
    '            浏览器外壳_聚焦地址栏(地址栏)',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '        如果 (Ctrl键按下 并且 键码 == 84)',
    '            浏览器外壳_新建空白标签页()',
    '            重排浏览器布局()',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '        如果 (Ctrl键按下 并且 键码 == 87)',
    '            浏览器外壳_关闭当前标签页()',
    '            重排浏览器布局()',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '        如果 (Ctrl键按下 并且 键码 == 82)',
    '            浏览器外壳_刷新()',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '        如果 (Alt键按下 并且 键码 == 37)',
    '            浏览器外壳_后退()',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '        如果 (Alt键按下 并且 键码 == 39)',
    '            浏览器外壳_前进()',
    '            窗口_标记按键已处理()',
    '        如果结束',
    '    结束',
    '',
    '    事件 _地址栏_提交(文本型 地址)',
    '        浏览器外壳_导航(地址)',
    '    结束',
    '',
    '    事件 _地址栏_动作图标(整数型 图标索引，整数型 起始位置，整数型 结束位置)',
    '        调试输出("地址栏动作图标", 图标索引, 起始位置, 结束位置)',
    '    结束',
    '',
    '    事件 _新建标签按钮_被单击()',
    '        浏览器外壳_新建空白标签页()',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    事件 _后退按钮_被单击()',
    '        浏览器外壳_后退()',
    '    结束',
    '',
    '    事件 _前进按钮_被单击()',
    '        浏览器外壳_前进()',
    '    结束',
    '',
    '    事件 _刷新按钮_被单击()',
    '        浏览器外壳_刷新()',
    '    结束',
    '',
    '    事件 _浏览器标签页_选择变化(整数型 选中索引，整数型 项目数量，整数型 动作)',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    事件 _下载菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        调试输出("下载菜单", 项目索引, 菜单路径, 命令)',
    '    结束',
    '',
    '    事件 _扩展菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        调试输出("扩展菜单", 项目索引, 菜单路径, 命令)',
    '    结束',
    '',
    '    事件 _更多菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        如果 (项目索引 == 0)',
    '            浏览器外壳_新建空白标签页()',
    '            重排浏览器布局()',
    '        如果结束',
    '        如果 (项目索引 == 17)',
    '            调试输出("请使用右上角关闭按钮退出浏览器外壳。")',
    '        如果结束',
    '        调试输出("更多菜单", 项目索引, 菜单路径, 命令)',
    '    结束',
    '',
    '    事件 _标签页菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        如果 (项目索引 == 0)',
    '            浏览器外壳_新建空白标签页()',
    '        如果结束',
    '        如果 (项目索引 == 1)',
    '            浏览器外壳_关闭当前标签页()',
    '        如果结束',
    '        如果 (项目索引 == 2)',
    '            浏览器外壳_关闭其他标签页()',
    '        如果结束',
    '        重排浏览器布局()',
    '    结束',
    '',
    '    事件 _地址栏菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        调试输出("地址栏右键菜单", 项目索引, 菜单路径, 命令)',
    '    结束',
    '',
    '    事件 _网页菜单_命令(整数型 项目索引，文本型 菜单路径，文本型 命令)',
    '        如果 (项目索引 == 0)',
    '            浏览器外壳_后退()',
    '        如果结束',
    '        如果 (项目索引 == 1)',
    '            浏览器外壳_刷新()',
    '        如果结束',
    '        调试输出("网页右键菜单", 项目索引, 菜单路径, 命令)',
    '    结束',
    '',
    '    事件 浏览器状态改变(整数型 标签索引，文本型 地址，文本型 标题，逻辑型 加载中)',
    '        控件_设置文本(地址栏, 地址)',
    '        重排浏览器布局()',
    '        调试输出("浏览器状态", 标签索引, 地址, 标题, 加载中)',
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

/** SQLite 会员管理模板的控件布局：左侧表单输入，右侧列表视图，底部状态提示。 */
function createSqliteCrudWindowControls(): LingWindowProject['windows'][number]['controls'] {
  const formField = (
    id: string,
    type: 'Label' | 'TextBox',
    name: string,
    content: string,
    x: number,
    y: number,
    width: number
  ) => ({
    id,
    type,
    name,
    content,
    width,
    height: type === 'TextBox' ? 32 : 24,
    x,
    y,
    fontSize: 13,
    background: type === 'TextBox' ? '#0f172a' : 'transparent',
    foreground: type === 'TextBox' ? '#f8fafc' : '#cbd5f5',
    isEnabled: true,
    visibility: 'Visible' as const
  });
  const actionButton = (id: string, name: string, content: string, x: number, y: number, background: string) => ({
    id,
    type: 'Button' as const,
    name,
    content,
    width: 96,
    height: 36,
    x,
    y,
    fontSize: 13,
    background,
    foreground: '#ffffff',
    isEnabled: true,
    visibility: 'Visible' as const,
    events: { Click: `_${name}_被单击` }
  });
  return [
    formField('crud-name-label', 'Label', '姓名标签', '姓名：', 24, 28, 52),
    formField('crud-name-box', 'TextBox', '姓名框', '', 84, 24, 180),
    formField('crud-phone-label', 'Label', '电话标签', '电话：', 24, 68, 52),
    formField('crud-phone-box', 'TextBox', '电话框', '', 84, 64, 180),
    formField('crud-points-label', 'Label', '积分标签', '积分：', 24, 108, 52),
    formField('crud-points-box', 'TextBox', '积分框', '0', 84, 104, 180),
    actionButton('crud-add-button', '新增按钮', '新增', 24, 232, '#2563eb'),
    actionButton('crud-update-button', '修改按钮', '修改', 132, 232, '#0f766e'),
    actionButton('crud-delete-button', '删除按钮', '删除', 240, 232, '#b91c1c'),
    actionButton('crud-refresh-button', '刷新按钮', '刷新', 24, 280, '#475569'),
    {
      id: 'crud-member-list', type: 'ListView', name: '会员列表', content: '',
      width: 600, height: 380, x: 288, y: 24, fontSize: 13,
      background: '#0f172a', foreground: '#f8fafc', isEnabled: true, visibility: 'Visible',
      properties: {
        columns: [
          { title: '编号', width: 60, image: -1, alignment: 'right' },
          { title: '姓名', width: 150, image: -1, alignment: 'left' },
          { title: '电话', width: 190, image: -1, alignment: 'left' },
          { title: '积分', width: 100, image: -1, alignment: 'right' }
        ],
        items: []
      }
    },
    {
      id: 'crud-status-label', type: 'Label', name: '状态标签', content: '就绪：SQLite 数据库文件 members.db 与程序同目录',
      width: 600, height: 24, x: 288, y: 420, fontSize: 12,
      background: 'transparent', foreground: '#94a3b8', isEnabled: true, visibility: 'Visible'
    }
  ];
}

function createNewEmojiFbroBrowserShellControls(): LingControl[] {
  const make = (
    id: string,
    type: string,
    name: string,
    content: string,
    x: number,
    y: number,
    width: number,
    height: number,
    properties: Record<string, Win32ControlPropertyValue> = {},
    events: Record<string, string> = {}
  ): LingControl => ({
    id,
    type: type === 'Tabs' ? 'TabControl' : type === 'Container' || type === 'Panel' ? 'Grid' : 'Label',
    designerType: `lingbuilder.new_emoji.ui/${type}`,
    name,
    content,
    x,
    y,
    width,
    height,
    fontSize: 13,
    fontFamily: 'Microsoft YaHei UI',
    fontBold: false,
    fontItalic: false,
    fontUnderline: false,
    background: 'transparent',
    foreground: '#e8eaed',
    isEnabled: true,
    visibility: 'Visible',
    properties,
    events
  });
  const iconButton = (
    id: string,
    name: string,
    icon: string,
    tooltip: string,
    x: number,
    y: number,
    width = 34,
    height = 34,
    properties: Record<string, Win32ControlPropertyValue> = {},
    events: Record<string, string> = {}
  ) => make(id, 'IconButton', name, icon, x, y, width, height, {
    icon,
    tooltip,
    shape: width === 46 ? 0 : 1,
    radius: width === 46 ? 0 : 17,
    iconSize: 17,
    normalBg: '#00000000',
    hoverBg: '#1AFFFFFF',
    pressedBg: '#26FFFFFF',
    checkedBg: '#26000000',
    disabledBg: '#00000000',
    iconColor: '#FFE8EAED',
    disabledIconColor: '#FF5F6368',
    ...properties
  }, events);

  const child = (control: LingControl): LingControl => ({ ...control, parentId: 'browser-root' });
  const menuItem = (
    id: string,
    command: string,
    title: string,
    icon = '',
    shortcut = '',
    separator = false,
    disabled = false
  ) => ({ id, command, title, icon, shortcut, separator, checked: false, disabled, submenu: '' });
  const menuProperties = (
    anchorElementId: string,
    popupTrigger: 'dropdown' | 'right_click',
    popupPlacement: number,
    popupOffsetY: number,
    menuItems: ReturnType<typeof menuItem>[]
  ): Record<string, Win32ControlPropertyValue> => ({
    orientation: '1',
    activeIndex: 0,
    collapsed: false,
    menuBackgroundColor: '#FF292A2D',
    menuTextColor: '#FFE8EAED',
    menuActiveTextColor: '#FFE8EAED',
    menuHoverBackgroundColor: '#FF3C4043',
    menuDisabledTextColor: '#FF9AA0A6',
    menuBorderColor: '#FF3C4043',
    anchorElementId,
    popupTrigger,
    popupPlacement,
    popupOffsetX: 0,
    popupOffsetY,
    popupOpen: false,
    popupCloseOnOutside: true,
    popupCloseOnEscape: true,
    menuItems
  });

  const homeTab = {
    id: 'home', title: '新标签页', icon: '🌐', closable: true,
    disabled: false, pinned: false, loading: false, muted: false, alerting: false
  };
  return [
    make('browser-root', 'Container', '浏览器根容器', '浏览器根容器', 0, 0, 1180, 760, {
      flowEnabled: false,
      orientation: 0,
      gap: 0,
      backgroundColor: '#FF202124',
      borderColor: '#00000000'
    }),
    child(make('browser-viewport', 'BrowserViewport', '浏览器页面占位', '浏览器页面宿主', 0, 90, 1180, 670, {
      state: 4,
      loading: false,
      progress: 0,
      placeholderTitle: '新标签页 🌐',
      placeholderDesc: '浏览器式外壳示例：标签栏、地址栏、工具按钮、菜单和内容占位区均由 D2D Element 绘制。',
      placeholderIcon: '🌐',
      screenshot: ''
    })),
    child(make('tab-background', 'Panel', '标签栏背景', '', 0, 0, 1180, 40, {
      backgroundColor: '#FF202124', borderColor: '#00000000', borderWidth: 0, cornerRadius: 0, padding: 0
    })),
    child(make('toolbar-background', 'Panel', '工具栏背景', '', 0, 40, 1180, 50, {
      backgroundColor: '#FF202124', borderColor: '#00000000', borderWidth: 0, cornerRadius: 0, padding: 0
    })),
    child(make('browser-tabs', 'Tabs', '浏览器标签页', '浏览器标签页', 16, 4, 220, 34, {
      items: [homeTab], tabs: [{ ...homeTab, image: -1 }], activeIndex: 0,
      selectedIndex: 0, tabType: 0, position: 0, headerVisible: true,
      contentVisible: false, closable: true, addable: false, editable: false,
      chromeMode: true, chromeMinWidth: 96, chromeMaxWidth: 220,
      chromePinnedWidth: 46, chromeTabHeight: 32, chromeOverlap: 0,
      newButtonVisible: false, reorderEnabled: true, detachEnabled: false
    }, { SelectionChanged: '_浏览器标签页_选择变化' })),
    child(iconButton('new-tab-button', '新建标签按钮', '+', '新建标签页', 244, 5, 30, 30, {
      radius: 15, iconSize: 18, paddingLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0
    }, { Clicked: '_新建标签按钮_被单击' })),
    child(iconButton('back-button', '后退按钮', '←', '后退', 12, 46, 34, 34, {}, { Clicked: '_后退按钮_被单击' })),
    child(iconButton('forward-button', '前进按钮', '→', '前进', 50, 46, 34, 34, {}, { Clicked: '_前进按钮_被单击' })),
    child(iconButton('reload-button', '刷新按钮', '↻', '刷新', 88, 46, 34, 34, {}, { Clicked: '_刷新按钮_被单击' })),
    child(make('browser-omnibox', 'Omnibox', '地址栏', '', 132, 46, 890, 34, {
      value: 'https://www.baidu.com',
      placeholder: '搜索或输入网址',
      securityState: 5,
      securityText: '',
      prefixIcon: '',
      prefixText: '',
      prefixBg: '#00000000',
      prefixFg: '#00000000',
      actionIcons: [
        { id: 'favorite', icon: '☆', tooltip: '收藏', enabled: true },
        { id: 'share', icon: '↗', tooltip: '分享', enabled: true }
      ],
      suggestions: [
        { id: '搜索', title: '搜索 new_emoji 浏览器式外壳', url: 'new_emoji 浏览器式外壳', icon: '🔍', description: '默认搜索' },
        { id: '历史', title: '组件封装进度', url: '组件封装进度.md', icon: '🕘', description: '本地文档' },
        { id: '书签', title: 'API 索引', url: 'docs/api-index.md', icon: '☆', description: 'docs/api-index.md' }
      ],
      suggestionOpen: false,
      suggestionSelected: 0
    }, { TextChanged: '_地址栏_提交', ValueChanged: '_地址栏_动作图标' })),
    child(iconButton('download-button', '下载按钮', '⇩', '下载', 1038, 46, 34, 34, {
      badge: '2', badgeVisible: true, dropdownElementId: 'download-menu'
    })),
    child(iconButton('extensions-button', '扩展按钮', '◆', '扩展程序', 1080, 46, 34, 34, {
      checked: true, dropdownElementId: 'extensions-menu'
    })),
    child(iconButton('more-button', '更多按钮', '⋮', '自定义及控制', 1122, 46, 34, 34, {
      dropdownElementId: 'browser-menu'
    })),
    child(iconButton('min-button', '最小化按钮', '−', '最小化', 1042, 0, 46, 32, {
      shape: 0, radius: 0, iconSize: 16, paddingLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, windowCommand: '1'
    })),
    child(iconButton('max-button', '最大化按钮', '□', '最大化/还原', 1088, 0, 46, 32, {
      shape: 0, radius: 0, iconSize: 16, paddingLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0, windowCommand: '2'
    })),
    child(iconButton('close-button', '关闭按钮', '×', '关闭', 1134, 0, 46, 32, {
      shape: 0, radius: 0, iconSize: 16, paddingLeft: 0, paddingTop: 0, paddingRight: 0, paddingBottom: 0,
      hoverBg: '#FFE81123', pressedBg: '#FFD7001B', checkedBg: '#00000000', windowCommand: '3'
    })),
    child(make('download-menu', 'Menu', '下载菜单', '下载菜单', -900, 0, 330, 248,
      menuProperties('download-button', 'dropdown', 5, 8, [
        menuItem('download-title', 'download-title', '下载', '', '', false, true),
        menuItem('download-recent', 'download-recent', '最近下载', '', '', false, true),
        menuItem('download-dll', 'download-dll', 'new_emoji.dll', '📦', '已完成'),
        menuItem('download-demo', 'download-demo', 'chrome_shell_demo.py', '🐍', '已完成'),
        menuItem('download-separator', 'download-separator', '-', '', '', true),
        menuItem('download-open', 'download-open', '打开下载内容', '↗', 'Ctrl+J'),
        menuItem('download-clear', 'download-clear', '清除所有')
      ]), { MenuCommand: '_下载菜单_命令' })),
    child(make('extensions-menu', 'Menu', '扩展菜单', '扩展菜单', -900, 0, 330, 248,
      menuProperties('extensions-button', 'dropdown', 5, 8, [
        menuItem('extensions-title', 'extensions-title', '扩展程序', '', '', false, true),
        menuItem('extensions-pinned', 'extensions-pinned', '已固定扩展', '', '', false, true),
        menuItem('extensions-inspector', 'extensions-inspector', '组件检查器', '🧪'),
        menuItem('extensions-theme', 'extensions-theme', '主题助手', '🎨'),
        menuItem('extensions-separator', 'extensions-separator', '-', '', '', true),
        menuItem('extensions-manage', 'extensions-manage', '管理扩展程序', '🧩'),
        menuItem('extensions-permission', 'extensions-permission', '权限状态正常', '🔒')
      ]), { MenuCommand: '_扩展菜单_命令' })),
    child(make('browser-menu', 'Menu', '更多菜单', '更多菜单', -900, 0, 318, 628,
      menuProperties('more-button', 'dropdown', 5, 8, [
        menuItem('new-tab', 'new-tab', '新标签页', '', 'Ctrl+T'),
        menuItem('new-window', 'new-window', '新窗口', '', 'Ctrl+N'),
        menuItem('new-incognito-window', 'new-incognito-window', '新建无痕窗口', '', 'Ctrl+Shift+N'),
        menuItem('more-separator-1', 'more-separator-1', '-', '', '', true),
        menuItem('history', 'history', '历史记录'),
        menuItem('downloads', 'downloads', '下载内容', '', 'Ctrl+J'),
        menuItem('bookmarks', 'bookmarks', '书签和清单'),
        menuItem('extensions', 'extensions', '扩展程序'),
        menuItem('more-separator-2', 'more-separator-2', '-', '', '', true),
        menuItem('zoom', 'zoom', '缩放', '', '100%'),
        menuItem('print', 'print', '打印...', '', 'Ctrl+P'),
        menuItem('cast', 'cast', '投放...'),
        menuItem('find', 'find', '查找...', '', 'Ctrl+F'),
        menuItem('more-tools', 'more-tools', '更多工具'),
        menuItem('more-separator-3', 'more-separator-3', '-', '', '', true),
        menuItem('settings', 'settings', '设置'),
        menuItem('help', 'help', '帮助'),
        menuItem('exit', 'exit', '退出')
      ]), { MenuCommand: '_更多菜单_命令' })),
    child(make('omnibox-menu', 'Menu', '地址栏菜单', '地址栏菜单', -900, 0, 248, 174,
      menuProperties('browser-omnibox', 'right_click', 3, 0, [
        menuItem('copy-url', 'copy-url', '复制网址', '📋'),
        menuItem('paste-go', 'paste-go', '粘贴并转到', '📥'),
        menuItem('select-all', 'select-all', '全选文字', '✅'),
        menuItem('edit-search-engine', 'edit-search-engine', '编辑搜索引擎', '⚙️')
      ]), { MenuCommand: '_地址栏菜单_命令' })),
    child(make('tabs-menu', 'Menu', '标签页菜单', '标签页菜单', -900, 0, 238, 138,
      menuProperties('browser-tabs', 'right_click', 3, 0, [
        menuItem('tabs-new', 'tabs-new', '新建标签页', '🌐'),
        menuItem('tabs-close', 'tabs-close', '关闭标签页', '✖'),
        menuItem('tabs-close-other', 'tabs-close-other', '关闭其他标签页', '🧹')
      ]), { MenuCommand: '_标签页菜单_命令' })),
    child(make('viewport-menu', 'Menu', '网页菜单', '网页菜单', -900, 0, 286, 356,
      menuProperties('browser-viewport', 'right_click', 3, 0, [
        menuItem('viewport-back', 'viewport-back', '返回', '', '', false, true),
        menuItem('viewport-reload', 'viewport-reload', '重新加载', '', 'Ctrl+R'),
        menuItem('viewport-separator-1', 'viewport-separator-1', '-', '', '', true),
        menuItem('viewport-save', 'viewport-save', '另存为...'),
        menuItem('viewport-print', 'viewport-print', '打印...', '', 'Ctrl+P'),
        menuItem('viewport-cast', 'viewport-cast', '投放...'),
        menuItem('viewport-translate', 'viewport-translate', '翻译成中文'),
        menuItem('viewport-separator-2', 'viewport-separator-2', '-', '', '', true),
        menuItem('viewport-source', 'viewport-source', '查看网页源代码', '', 'Ctrl+U'),
        menuItem('viewport-inspect', 'viewport-inspect', '检查', '', 'Ctrl+Shift+I')
      ]), { MenuCommand: '_网页菜单_命令' })),
    {
      ...child(make('download-popover', 'Popover', '下载弹层', '最近下载\n📦 new_emoji.dll\n🐍 chrome_shell_demo.py\n✅ 全部下载已完成', -1200, 0, 286, 178, {
        label: '', title: '下载 📥', content: '最近下载\n📦 new_emoji.dll\n🐍 chrome_shell_demo.py\n✅ 全部下载已完成',
        placement: 5, open: false, popupWidth: 286, popupHeight: 178,
        closable: false, triggerMode: 0, closeOnOutside: true, showArrow: true, offset: 6,
        anchorElementId: 'download-button', arrowSize: 8, elevation: 2, autoPlacement: true, closeOnEscape: true
      })),
      visibility: 'Collapsed'
    },
    {
      ...child(make('extensions-popover', 'Popover', '扩展弹层', '已固定扩展\n🧪 组件检查器\n🎨 主题助手\n🔒 权限状态正常', -1200, 0, 286, 178, {
        label: '', title: '扩展程序 🧩', content: '已固定扩展\n🧪 组件检查器\n🎨 主题助手\n🔒 权限状态正常',
        placement: 5, open: false, popupWidth: 286, popupHeight: 178,
        closable: false, triggerMode: 0, closeOnOutside: true, showArrow: true, offset: 6,
        anchorElementId: 'extensions-button', arrowSize: 8, elevation: 2, autoPlacement: true, closeOnEscape: true
      })),
      visibility: 'Collapsed'
    }
  ];
}

function getSolutionProjectTemplate(templateId?: string): SolutionProjectTemplate {
  const normalized = templateId?.trim() || 'blank-window';
  const template = SOLUTION_PROJECT_TEMPLATES.find(item => item.id === normalized);
  if (!template) throw new Error(`不支持的项目模板：${normalized}`);
  return template;
}

/**
 * 校验创建请求的 outputType 与模板组合，返回应写入 buildProperties 的产物类型（undefined=缺省 exe）。
 * 只有窗口模板接受 dll（把「公开」子程序导出为 DLL 接口）；windows-dll 模板本身即动态库，
 * 控制台模板固定命令行程序、new_emoji 后端不支持 DLL 输出，冲突组合在创建前中文报错。
 */
function resolveCreatedProjectOutputType(template: SolutionProjectTemplate, outputType: 'exe' | 'dll' | undefined): 'dll' | undefined {
  if (template.kind === 'windows-dll') {
    if (outputType === 'exe') throw new Error('windows-dll 模板本身就是动态链接库，不能指定 outputType=exe；如需 EXE 应用请改用窗口或控制台模板。');
    return 'dll';
  }
  if (outputType === undefined || outputType === 'exe') return undefined;
  if (template.kind === 'windows-console') throw new Error('控制台项目不支持 DLL 输出：控制台模板固定编译为命令行可执行文件。');
  if (template.id === 'new-emoji-fbro-browser-shell') throw new Error('new_emoji 原生界面后端不支持 DLL 输出，请改用普通 Win32 窗口模板再指定 outputType=dll。');
  return 'dll';
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
  nestedWorkspacePlan?: NestedWorkspaceArtifactPlan,
  foreignRoots?: readonly string[]
): Promise<void> {
  if (nestedWorkspacePlan && isNestedWorkspaceArtifactPath(directory, nestedWorkspacePlan)) return;
  const relativeDirectory = path.relative(workspaceRoot, directory).replace(/\\/g, '/');
  if (foreignRoots?.length) {
    const lowered = relativeDirectory.toLowerCase();
    if (foreignRoots.some(root => lowered === root || lowered.startsWith(`${root}/`))) return;
  }
  if (isProjectBuildArtifactRelativePath(relativeDirectory)) return;
  if (!(await exists(directory))) return;
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const targetPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTextFiles(workspaceRoot, targetPath, files, nestedWorkspacePlan, foreignRoots);
      continue;
    }
    const relativePath = path.relative(workspaceRoot, targetPath).replace(/\\/g, '/');
    if (isProjectBuildArtifactRelativePath(relativePath)) continue;
    // 文本类扩展名白名单：txt/csv/md 让「内嵌资源」里的文本素材在解决方案树里可见、可打开编辑
    // （二进制资源如 png/zip 仍不进文本模型，由项目的「内嵌资源」组展示）。
    if (!/\.(cpp|h|rc|ini|lcpp|e|xml|json|txt|csv|md)$/i.test(entry.name)) continue;
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

/** 项目相对根目录规范化：反斜杠→斜杠、去 ./ 与前导 /、trim。 */
function normalizeWorkspaceRelative(value: string | undefined): string {
  return String(value || '').trim().replace(/\\/g, '/').replace(/^\.\//u, '').replace(/^\/+/u, '');
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

function validateSolutionDisplayName(value: string): string {
  const name = value.trim();
  if (!name) throw new Error('解决方案名称不能为空。');
  if (name.length > 100) throw new Error('解决方案名称不能超过 100 个字符。');
  if (/[\r\n\t]/u.test(name)) throw new Error('解决方案名称不能包含换行符或制表符。');
  return name;
}

/**
 * 折叠用户输入路径中连续出现的反斜杠（例如从日志复制的 D:\\Projects）为单个，
 * 让用户只需要输入一个反斜杠；开头的 UNC 前缀（\\server\share）保留为两个。
 */
function collapseDuplicatedBackslashes(value: string): string {
  if (!value.includes('\\')) return value;
  const uncPrefixed = value.startsWith('\\\\');
  const body = uncPrefixed ? value.slice(2) : value;
  return (uncPrefixed ? '\\\\' : '') + body.replace(/\\{2,}/gu, '\\');
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

/** 冲突校验用的保守目录名规范化：不同项目规范化后同名即视为冲突（宁误报不静默放行）。 */
function canonicalProjectDirName(value: string): string {
  return safeSegment(value).toLowerCase();
}

/** 判断两个目录是否重合或存在嵌套关系。 */
function directoriesOverlap(first: string, second: string): boolean {
  const relative = path.relative(path.resolve(first), path.resolve(second));
  if (!relative) return true;
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) return true;
  const inverse = path.relative(path.resolve(second), path.resolve(first));
  return !inverse.startsWith('..') && !path.isAbsolute(inverse);
}
