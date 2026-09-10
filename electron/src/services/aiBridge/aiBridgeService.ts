import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { applyWorkspaceEditToFiles, getWorkspaceEditProposal, proposeLingCppEdit, rejectWorkspaceEdit, validateDesignerProjectEdit } from '../lingCpp/aiEditService';
import { getLingCppSemanticDiagnostics } from '../lingCpp/languageService';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from '../lingCpp/projectGlobalService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from '../lingCpp/projectDataTypeService';
import { createProjectFunctionContext } from '../lingCpp/functionLibraryService';
import { LingCppEditContext, LingCppProjectSourceFile, LingCppWorkspaceFile } from '../lingCpp/types';
import { createModuleService } from '../modules/moduleService';
import { describeLingCppModuleContextForAi } from '../modules/moduleContextAdapters';
import { AI_MODULE_MANIFEST_FILE } from '../modules/aiModuleImportParser';
import { createModuleTemplate, importAiModuleFiles, validateModuleDirectory } from '../modules/moduleSdkService';
import { BuildConfigurationService } from '../tasks/buildConfigurationService';
import { exportModuleNativeDependencies, materializeModuleNativeDependencies, ModuleNativeDependencyPlan } from '../modules/nativeDependencyService';
import { createManagedProcessService } from '../tasks/managedProcessService';
import { decodeCompilerOutput } from '../tasks/compilerOutputEncoding';
import type { ManagedProcessService, ManagedProcessStopAllResult } from '../tasks/managedProcessService';
import {
  createProjectBuildCoordinator,
  ProjectBuildBusyError,
  ProjectBuildCancelledBeforeStartError,
  type ProjectBuildCoordinator,
  type ProjectBuildLease
} from '../tasks/projectBuildCoordinator';
import {
  createProjectBuildSessionService,
  ProjectBuildPreparationError,
  type ProjectBuildSessionService
} from '../tasks/projectBuildSessionService';
import { IncrementalBuildService } from '../tasks/incrementalBuildService';
import { createBuildStepProviderRegistry } from '../build/providerRegistry';
import { BuildPipelineService } from '../build/buildPipeline';
import { createProtobufCodeGeneratorProvider } from '../build/protobufProvider';
import { createWindowsMsvcBuildTarget, runProjectCodeGenerators, type ProjectCodeGeneratorResult } from '../build/projectCodeGeneratorService';
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';
import { decodeTextFile, encodeTextFile } from '../files/textFileService';
import type { TextFileFormat } from '../files/types';
import { generateLingCppNativeWin32Project } from '../windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../windowDesigner/visualStudioProjectExporter';
import { createDesignerAssetService } from '../windowDesigner/designerAssetService';
import { LingWindowProject } from '../windowDesigner/types';
import {
  compileWindowsExecutableResource,
  createWindowsExecutableIconService,
  WINDOWS_EXECUTABLE_RESOURCE_FILE,
  WindowsExecutableResourceCompileError
} from '../windowDesigner/windowsExecutableIconService';
import { detectNestedWorkspaceArtifacts, isNestedWorkspaceArtifactRelativePath, isProjectBuildArtifactRelativePath } from '../solution/nestedWorkspaceGuard';
import { createSolutionService, DEFAULT_PROJECT_ID, type LingBuilderSolutionProject } from '../solution/solutionService';
import { createProjectCreationService, type ProjectCreationRequest, type ProjectCreationService } from '../solution/projectCreationService';
import { SdkDependencyService } from '../sdkDependencies/sdkDependencyService';
import { resolveSdkCacheRoot } from '../sdkDependencies/sdkDependencyCatalog';
import { AiBridgePermissionService } from './permissionService';
import {
  AiBridgeBuildRunRequest,
  AiBridgeEditApplyRequest,
  AiBridgeEditApplyResult,
  AiBridgeEditProposeRequest,
  AiBridgeHealth,
  AiBridgeLingCppDiagnosticsRequest,
  AiBridgeModuleInstallPreviewRequest,
  AiBridgeModuleInstallRequest,
  AiBridgeModulePackRequest,
  AiBridgeModuleScaffoldRequest,
  AiBridgeModuleValidateRequest,
  AiBridgeModuleWriteFilesRequest,
  AiBridgeNativeRequest,
  AiBridgeSearchMatch,
  AiBridgeSearchRequest,
  AiBridgeServerOptions,
  AiBridgeTreeEntry
} from './types';

const IGNORED_DIRS = new Set([
  '.git',
  'node_modules',
  'dist',
  'dist-electron',
  '.lingbuilder-build',
  'coverage'
]);

const READABLE_EXTENSIONS = new Set([
  '.lcpp',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.rc',
  '.xml',
  '.json',
  '.ini',
  '.md',
  '.txt',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.html'
]);

const WRITABLE_EXTENSIONS = new Set([
  '.lcpp',
  '.cpp',
  '.c',
  '.h',
  '.hpp',
  '.rc',
  '.xml',
  '.json',
  '.ini',
  '.md',
  '.txt'
]);

const execFileAsync = promisify(execFile);
const SEARCH_FILE_LIMIT = 2 * 1024 * 1024;
const SEARCH_TOTAL_LIMIT = 64 * 1024 * 1024;
const SEARCH_FILE_COUNT_LIMIT = 20_000;
const TREE_NODE_LIMIT = 10_000;

export type AiBridgeCompilerInfo = {
  kind: 'msvc' | 'g++' | 'clang++';
  command: string;
  setupBatch?: string;
  /** MSVC 目标架构；CEF3 等原生模块需要 x64 与对应 SDK 匹配。 */
  arch?: 'win32' | 'x64';
};

export interface AiBridgeCompileResult {
  ok: boolean;
  logs: string[];
}

export type AiBridgeProcessManager = Pick<ManagedProcessService, 'start' | 'stop' | 'stopAll'>
  & Partial<Pick<ManagedProcessService, 'waitForExit'>>;

export interface AiBridgeServiceDependencies {
  managedProcessService?: AiBridgeProcessManager;
  projectBuildCoordinator?: ProjectBuildCoordinator;
  detectCompiler?: () => Promise<AiBridgeCompilerInfo | null>;
  compileWin32Preview?: (
    compiler: AiBridgeCompilerInfo,
    sourcePath: string,
    exePath: string,
    objDir: string,
    cwd: string,
    modulePlan?: ModuleNativeDependencyPlan,
    resourcePath?: string,
    signal?: AbortSignal
  ) => Promise<AiBridgeCompileResult>;
  assertModuleAccess?: (moduleIds: readonly string[]) => void;
  buildPipelineService?: BuildPipelineService;
  requireSdkDependencies?: (moduleIds: readonly string[]) => Promise<void>;
}

export class AiBridgeService {
  readonly permissions: AiBridgePermissionService;
  private readonly workspaceRoot: string;
  private readonly pathPolicy: WorkspacePathPolicy;
  private readonly moduleService;
  private readonly solutionService;
  private readonly projectCreationService: ProjectCreationService;
  private readonly designerAssetService;
  private readonly windowsExecutableIconService;
  private readonly managedProcessService: AiBridgeProcessManager;
  private readonly projectBuildCoordinator: ProjectBuildCoordinator;
  private readonly projectBuildSessionService: ProjectBuildSessionService;
  private readonly compilerDetector: () => Promise<AiBridgeCompilerInfo | null>;
  private readonly compilerRunner: NonNullable<AiBridgeServiceDependencies['compileWin32Preview']>;
  private readonly assertModuleAccess: NonNullable<AiBridgeServiceDependencies['assertModuleAccess']>;
  private readonly buildPipelineService: BuildPipelineService;
  private readonly incrementalBuildService: IncrementalBuildService;
  private readonly buildConfigurationService: BuildConfigurationService;
  private readonly requireSdkDependencies: NonNullable<AiBridgeServiceDependencies['requireSdkDependencies']>;
  private readonly fbroVipKey: string;
  private runAdmissionClosed = false;
  private shuttingDown = false;

  constructor(
    private readonly options: AiBridgeServerOptions,
    dependencies: AiBridgeServiceDependencies = {}
  ) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.pathPolicy = new WorkspacePathPolicy(this.workspaceRoot);
    this.permissions = new AiBridgePermissionService(this.pathPolicy, options.permission);
    this.moduleService = createModuleService(this.workspaceRoot);
    this.solutionService = createSolutionService(this.workspaceRoot);
    this.projectCreationService = createProjectCreationService(this.workspaceRoot, {
      solutionService: this.solutionService,
      moduleService: this.moduleService
    });
    this.designerAssetService = createDesignerAssetService(this.workspaceRoot);
    this.windowsExecutableIconService = createWindowsExecutableIconService(this.workspaceRoot, this.designerAssetService);
    this.managedProcessService = dependencies.managedProcessService ?? createManagedProcessService();
    this.projectBuildCoordinator = dependencies.projectBuildCoordinator ?? createProjectBuildCoordinator();
    this.projectBuildSessionService = createProjectBuildSessionService(
      this.projectBuildCoordinator,
      this.managedProcessService
    );
    // 显式 arch 只用于「本机探测为 x64、但目标必须是 32 位」的场景（例如 32 位 OCX 示例）。
    // PATH 里的 cl 无法区分位数，此时必须改用对应的 vcvars 批处理重新进入编译环境。
    const requestedArch = options.arch;
    const baseDetector = dependencies.detectCompiler ?? detectCompiler;
    this.compilerDetector = requestedArch
      ? async () => {
          const detected = await baseDetector();
          if (!detected || detected.kind !== 'msvc' || detected.arch === requestedArch) return detected;
          const setupBatch = await findMsvcSetupBatch(requestedArch);
          if (!setupBatch) return detected;
          return { kind: 'msvc', command: 'cl', setupBatch, arch: requestedArch };
        }
      : baseDetector;
    this.compilerRunner = dependencies.compileWin32Preview ?? compileWin32Preview;
    this.assertModuleAccess = dependencies.assertModuleAccess ?? (() => undefined);
    const sdkDependencyService = new SdkDependencyService({
      cacheRoot: resolveSdkCacheRoot(process.env),
      workspaceRoot: () => this.workspaceRoot,
      environment: process.env,
      resourcesPath: process.env.LINGBUILDER_RESOURCE_ROOT
    });
    this.requireSdkDependencies = dependencies.requireSdkDependencies
      ?? (moduleIds => sdkDependencyService.requireForModules(moduleIds));
    this.buildPipelineService = dependencies.buildPipelineService ?? new BuildPipelineService(createBuildStepProviderRegistry([
      createProtobufCodeGeneratorProvider({
        sdkRoot: () => process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(this.workspaceRoot, '.lingbuilder', 'toolchains', 'protobuf'),
        protocPath: () => path.join(process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(this.workspaceRoot, '.lingbuilder', 'toolchains', 'protobuf'), 'bin', 'protoc.exe'),
        expectedSha256: process.env.LINGBUILDER_PROTOC_SHA256
      })
    ]));
    this.incrementalBuildService = new IncrementalBuildService(this.workspaceRoot);
    this.buildConfigurationService = new BuildConfigurationService(this.workspaceRoot);
    this.fbroVipKey = String(process.env.LINGBUILDER_FBRO_VIP_KEY || '').trim().slice(0, 4096);
    delete process.env.LINGBUILDER_FBRO_VIP_KEY;
  }

  health(): AiBridgeHealth {
    return {
      ok: true,
      service: 'LingBuilder AI Bridge',
      version: 1,
      workspaceRoot: this.workspaceRoot,
      permission: this.options.permission,
      mcp: this.options.enableMcp
    };
  }

  async listWorkspaceTree(): Promise<AiBridgeTreeEntry[]> {
    try {
      return await this.readDirectoryTree(await this.pathPolicy.getRealWorkspaceRoot(), 0, { nodes: 0 });
    } catch (error) {
      await this.auditFailure('read', 'workspace.list', '.', error);
      throw error;
    }
  }

  async readFile(filePath: string): Promise<{ filePath: string; content: string; format: TextFileFormat }> {
    try {
      const absolutePath = await this.resolveReadablePath(filePath);
      const snapshot = decodeTextFile(await fs.readFile(absolutePath));
      return {
        filePath: await this.pathPolicy.toWorkspaceRelative(absolutePath),
        content: snapshot.content,
        format: snapshot.format
      };
    } catch (error) {
      await this.auditFailure('read', 'file.read', filePath, error);
      throw error;
    }
  }

  async searchFiles(request: AiBridgeSearchRequest): Promise<{ matches: AiBridgeSearchMatch[] }> {
    const query = request.query?.trim();
    if (!query) throw new Error('缺少搜索关键词。');
    const include = request.include?.length ? request.include : ['src', 'config', '.lingbuilder'];
    const maxResults = Math.max(1, Math.min(request.maxResults || 100, 500));
    const matches: AiBridgeSearchMatch[] = [];
    const budget = { files: 0, bytes: 0, deadline: Date.now() + 10_000 };

    try {
      for (const item of include) {
        let root: string;
        try {
          root = await this.pathPolicy.resolveExisting(item, { rejectSymlinks: true });
        } catch (error: any) {
          if (error?.code === 'ENOENT') continue;
          throw error;
        }
        await this.searchPath(root, query, matches, maxResults, budget);
        if (matches.length >= maxResults) break;
      }
    } catch (error) {
      await this.auditFailure('read', 'file.search', include.join(','), error);
      throw error;
    }

    return { matches };
  }

  async getLingCppDiagnostics(request: AiBridgeLingCppDiagnosticsRequest) {
    const sourceCode = typeof request.sourceCode === 'string'
      ? request.sourceCode
      : (await this.readFile(request.filePath)).content;
    const moduleContext = await this.getModuleContext(request.projectId);
    const normalizedRequestPath = normalizeFilePath(request.filePath);
    let projectGlobals;
    let projectTypes;
    const projectSources = request.projectId
      ? await this.resolveLingCppProjectSources(request.projectId)
      : [];
    const effectiveSources: LingCppProjectSourceFile[] = [
      ...projectSources.filter(source => normalizeFilePath(source.filePath) !== normalizedRequestPath),
      { filePath: normalizedRequestPath, sourceCode }
    ];
    const globalSource = effectiveSources.find(source => isProjectGlobalsFilePath(source.filePath));
    if (globalSource) projectGlobals = createProjectGlobalContext(globalSource.filePath, globalSource.sourceCode);
    const typeSource = effectiveSources.find(source => isProjectDataTypesFilePath(source.filePath));
    if (typeSource) projectTypes = createProjectTypeContext(typeSource.filePath, typeSource.sourceCode);
    const projectFunctions = createProjectFunctionContext(
      effectiveSources.map(source => ({ ...source, language: 'lingcpp' }))
    );
    const diagnostics = getLingCppSemanticDiagnostics(
      sourceCode,
      request.designerProject,
      request.filePath,
      moduleContext,
      projectGlobals,
      projectTypes,
      projectFunctions
    );
    return {
      ok: true,
      filePath: normalizeFilePath(request.filePath),
      diagnostics,
      moduleContextSummary: describeLingCppModuleContextForAi(moduleContext)
    };
  }

  async proposeEdit(request: AiBridgeEditProposeRequest, planner?: (context: LingCppEditContext) => Promise<any>) {
    const sourceCode = typeof request.sourceCode === 'string'
      ? request.sourceCode
      : (await this.readFile(request.filePath)).content;
    const context: LingCppEditContext = {
      filePath: normalizeFilePath(request.filePath),
      sourceCode: normalizeLineEndings(sourceCode),
      instruction: request.instruction || '',
      selection: request.selection,
      workspaceFiles: await this.resolveEditWorkspaceFiles(request),
      moduleContext: await this.getModuleContext(request.projectId),
      aiConfig: request.aiConfig,
      designerProject: request.designerProject
    };
    if (!planner && !request.files?.length) {
      throw new Error('当前独立 AI Bridge 未配置系统 AI planner；请由外部 AI 提供 files 完整文件草稿后再创建提案。');
    }
    const draft = planner ? await planner(context) : { summary: request.instruction || '外部 AI 编辑提案', explanation: '外部 AI 提供了完整文件草稿，LingBuilder 仅创建可预览提案。', files: request.files, designerProject: request.updatedDesignerProject };
    const proposal = proposeLingCppEdit(context, draft);
    return { ok: true, proposal };
  }

  async applyEdit(request: AiBridgeEditApplyRequest): Promise<{ ok: true } & AiBridgeEditApplyResult> {
    const proposal = request.proposalId ? getWorkspaceEditProposal(request.proposalId) : undefined;
    if (!proposal) throw new Error('未找到编辑提案。');

    await this.requireWriteWithAudit('edit.apply', request.proposalId, request.approved);
    const workspaceFiles = await this.resolveApplyWorkspaceFiles(request);
    const appliedFiles = applyWorkspaceEditToFiles(workspaceFiles, proposal);
    const persistedFiles: Array<{ filePath: string; sourceCode: string; absolutePath: string }> = [];
    const staged: Array<{ file: typeof appliedFiles[number]; absolutePath: string; temporaryPath: string; original?: Buffer }> = [];
    let appliedDesignerProject = proposal.designerProject;

    if (proposal.designerProject) {
      const projectRef = await this.resolveAssetProject(proposal.designerProject);
      // Always re-read the persisted model. A caller-provided snapshot is only
      // an assertion of what it observed, never an authority that can bypass
      // external edits made after the proposal was created.
      const currentDesignerProject = await this.solutionService.readDesignerProject(projectRef);
      if (request.designerProject && JSON.stringify(request.designerProject) !== JSON.stringify(currentDesignerProject)) {
        throw new Error('提交应用的窗口设计器模型与磁盘版本不一致，请重新读取并生成提案。');
      }
      if (proposal.designerProjectOriginal && JSON.stringify(currentDesignerProject) !== JSON.stringify(proposal.designerProjectOriginal)) {
        throw new Error('窗口设计器模型在 AI 提案生成后已发生变化，请重新生成提案。');
      }
      validateDesignerProjectEdit(proposal.designerProjectOriginal, currentDesignerProject);
      const designerPath = await this.resolveWritablePath(projectRef.designerPath);
      const format = await this.readExistingTextFileFormat(designerPath);
      await fs.mkdir(path.dirname(designerPath), { recursive: true });
      const temporaryPath = `${designerPath}.${process.pid}.${Date.now()}.ai-designer.tmp`;
      let original: Buffer | undefined;
      try { original = await fs.readFile(designerPath); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
      await fs.writeFile(temporaryPath, encodeTextFile(JSON.stringify(proposal.designerProject, null, 2) + '\n', format));
      staged.push({
        file: { filePath: projectRef.designerPath.replace(/\\/g, '/'), sourceCode: JSON.stringify(proposal.designerProject, null, 2) + '\n' },
        absolutePath: designerPath,
        temporaryPath,
        original
      });
    }

    try {
      for (const file of appliedFiles) {
        const absolutePath = await this.resolveWritablePath(file.filePath);
        const format = await this.readExistingTextFileFormat(absolutePath);
        await fs.mkdir(path.dirname(absolutePath), { recursive: true });
        const temporaryPath = `${absolutePath}.${process.pid}.${Date.now()}.ai-edit.tmp`;
        let original: Buffer | undefined;
        try { original = await fs.readFile(absolutePath); } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
        await fs.writeFile(temporaryPath, encodeTextFile(file.sourceCode, format));
        staged.push({ file, absolutePath, temporaryPath, original });
      }
      for (const item of staged) { await fs.rename(item.temporaryPath, item.absolutePath); persistedFiles.push({ ...item.file, absolutePath: item.absolutePath }); }
      for (const file of persistedFiles) await this.permissions.audit({ operation: 'write', action: 'edit.apply', ok: true, target: file.filePath });
    } catch (error) {
      for (const item of staged) {
        await fs.rm(item.temporaryPath, { force: true }).catch(() => undefined);
        if (persistedFiles.some(file => file.absolutePath === item.absolutePath)) {
          if (item.original) await fs.writeFile(item.absolutePath, item.original).catch(() => undefined);
          else await fs.rm(item.absolutePath, { force: true }).catch(() => undefined);
        }
      }
      await this.auditFailure('write', 'edit.apply', request.proposalId, error);
      throw error;
    }

    rejectWorkspaceEdit(request.proposalId);
    return { ok: true, proposal, appliedFiles: persistedFiles, ...(appliedDesignerProject ? { designerProject: appliedDesignerProject } : {}) };
  }

  async listModules(projectId = 'lingbuilder-ui-project') {
    const [availableModules, enabledModules, history] = await Promise.all([
      this.moduleService.scanInstalledModules(projectId),
      this.moduleService.getEnabledProjectModules(projectId),
      this.moduleService.getHistory()
    ]);
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    return {
      ok: true,
      availableModules,
      enabledModules,
      history,
      summary: describeLingCppModuleContextForAi({ availableModules, enabledModules })
    };
  }

  private async assertWithinModuleArea(absolutePath: string, area: 'module-build' | 'module-packages', allowAreaRoot = false): Promise<string> {
    const realRoot = await this.pathPolicy.getRealWorkspaceRoot();
    const areaRoot = path.join(realRoot, '.lingbuilder', area);
    const resolved = path.resolve(absolutePath);
    const relative = path.relative(areaRoot, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative) || (!allowAreaRoot && !relative)) {
      throw new Error(`路径必须位于工作区 .lingbuilder/${area} 目录内。`);
    }
    return resolved;
  }

  private assertModuleAreaRelativePath(value: string, area: 'module-build' | 'module-packages'): string {
    const normalized = value.trim().replace(/\\/gu, '/');
    const areaError = new Error(`路径必须位于工作区 .lingbuilder/${area} 目录内。`);
    if (!normalized || normalized.startsWith('/') || /^[a-zA-Z]:/u.test(normalized)) throw areaError;
    const parts = normalized.split('/');
    if (parts.some(part => !part || part === '.' || part === '..')) throw areaError;
    if (parts[0] !== '.lingbuilder' || parts[1] !== area) throw areaError;
    return normalized;
  }

  private async resolveModuleAreaWriteDirectory(value: string, area: 'module-build' | 'module-packages', allowAreaRoot = false): Promise<string> {
    const normalized = this.assertModuleAreaRelativePath(value, area);
    const resolved = await this.pathPolicy.resolveDirectoryForWrite(normalized);
    return await this.assertWithinModuleArea(resolved, area, allowAreaRoot);
  }

  private async resolveModuleAreaExistingPath(value: string, area: 'module-build' | 'module-packages'): Promise<string> {
    const normalized = this.assertModuleAreaRelativePath(value, area);
    const resolved = await this.pathPolicy.resolveExisting(normalized, { rejectSymlinks: true });
    return await this.assertWithinModuleArea(resolved, area);
  }

  async scaffoldModule(request: AiBridgeModuleScaffoldRequest) {
    const moduleId = typeof request.id === 'string' ? request.id.trim() : '';
    if (!moduleId) throw new Error('缺少模块 ID（id）。');
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(moduleId)) throw new Error('模块 ID 只能使用小写字母、数字、点、下划线和中划线（3~81 位，字母或数字开头）。');
    await this.requireWriteWithAudit('module.scaffold', `.lingbuilder/module-build/${moduleId}`, request.approved);
    const outDirRelative = request.outDir?.trim() || `.lingbuilder/module-build/${moduleId}`;
    const outDir = await this.resolveModuleAreaWriteDirectory(outDirRelative, 'module-build');
    const manifest = await createModuleTemplate({
      template: request.template?.trim() || 'cpp-source',
      outDir,
      id: moduleId,
      name: request.name?.trim() || undefined
    });
    await this.permissions.audit({ operation: 'write', action: 'module.scaffold', ok: true, target: outDirRelative });
    return { ok: true as const, manifest, outDir: outDirRelative.replace(/\\/gu, '/') };
  }

  async writeModuleFiles(request: AiBridgeModuleWriteFilesRequest) {
    const files = Array.isArray(request.files) ? request.files : [];
    if (files.length === 0) throw new Error('缺少 files 文件列表；每个条目必须包含完整的 path 与 content。');
    await this.requireWriteWithAudit('module.writeFiles', request.outDir?.trim() || '.lingbuilder/module-build', request.approved);
    const normalizedFiles = files.map(file => ({
      path: typeof file?.path === 'string' ? file.path : '',
      content: typeof file?.content === 'string' ? file.content : ''
    }));
    let moduleId = '';
    const manifestEntry = normalizedFiles.find(file => file.path.replace(/\\/gu, '/').split('/').pop() === AI_MODULE_MANIFEST_FILE);
    if (manifestEntry) {
      try {
        const parsed = JSON.parse(manifestEntry.content.replace(/^\uFEFF/u, '')) as { id?: unknown };
        if (typeof parsed.id === 'string' && /^[a-z0-9][a-z0-9._-]{2,80}$/u.test(parsed.id.trim())) moduleId = parsed.id.trim();
      } catch {
        // manifest 内容非法时交给 importAiModuleFiles 的校验诊断报告。
      }
    }
    const outDirRelative = request.outDir?.trim() || (moduleId ? `.lingbuilder/module-build/${moduleId}` : '');
    if (!outDirRelative) throw new Error('无法从文件列表解析模块 ID，请显式传入 outDir（必须位于 .lingbuilder/module-build 下）。');
    const outDir = await this.resolveModuleAreaWriteDirectory(outDirRelative, 'module-build');
    const result = await importAiModuleFiles(normalizedFiles, outDir);
    await this.permissions.audit({ operation: 'write', action: 'module.writeFiles', ok: true, target: outDirRelative });
    return {
      ok: true as const,
      moduleId: result.manifest.id,
      moduleName: result.manifest.name,
      outDir: outDirRelative.replace(/\\/gu, '/'),
      fileCount: result.writtenFiles.length,
      overwrittenExisting: result.overwrittenExisting,
      diagnostics: result.diagnostics
    };
  }

  async validateModule(request: AiBridgeModuleValidateRequest) {
    const modulePath = typeof request.modulePath === 'string' ? request.modulePath.trim() : '';
    if (!modulePath) throw new Error('缺少 modulePath（.lingbuilder/module-build 下的模块目录）。');
    const resolvedModulePath = await this.resolveModuleAreaExistingPath(modulePath, 'module-build');
    const stat = await fs.stat(resolvedModulePath);
    const result = await validateModuleDirectory(
      stat.isFile() ? path.dirname(resolvedModulePath) : resolvedModulePath,
      {
        requireCommandBindings: true,
        requireNonEmptyDocumentsAndExamples: true
      }
    );
    return {
      ok: result.diagnostics.length === 0,
      modulePath: modulePath.replace(/\\/gu, '/'),
      manifest: result.manifest,
      diagnostics: result.diagnostics
    };
  }

  async packModule(request: AiBridgeModulePackRequest) {
    const moduleDirValue = typeof request.moduleDir === 'string' ? request.moduleDir.trim() : '';
    if (!moduleDirValue) throw new Error('缺少 moduleDir（.lingbuilder/module-build 下包含 lingbuilder.module.json 的目录）。');
    const requestedTarget = request.targetPath?.trim() || '';
    if (requestedTarget && !requestedTarget.toLowerCase().endsWith('.lbmod')) throw new Error('导出目标必须是 .lbmod 文件。');
    await this.requireWriteWithAudit('module.pack', requestedTarget || '.lingbuilder/module-packages', request.approved);
    const moduleDir = await this.resolveModuleAreaExistingPath(moduleDirValue, 'module-build');
    const targetRelative = requestedTarget || `.lingbuilder/module-packages/${path.basename(moduleDir)}.lbmod`;
    const targetDir = await this.resolveModuleAreaWriteDirectory(path.dirname(targetRelative), 'module-packages', true);
    const targetPath = path.join(targetDir, path.basename(targetRelative));
    await this.moduleService.exportModulePackage(moduleDir, targetPath, {
      requireCommandBindings: true,
      requireNonEmptyDocumentsAndExamples: true
    });
    await this.permissions.audit({ operation: 'write', action: 'module.pack', ok: true, target: targetRelative });
    return { ok: true as const, moduleDir: moduleDirValue.replace(/\\/gu, '/'), targetPath: targetRelative.replace(/\\/gu, '/') };
  }

  async previewModuleInstall(request: AiBridgeModuleInstallPreviewRequest) {
    const packagePath = typeof request.packagePath === 'string' ? request.packagePath.trim() : '';
    if (!packagePath) throw new Error('缺少 packagePath（.lingbuilder/module-packages 下的 .lbmod 路径）。');
    const resolvedPackagePath = await this.resolveModuleAreaExistingPath(packagePath, 'module-packages');
    const preview = await this.moduleService.previewPackageInstall(resolvedPackagePath);
    return { ok: true as const, preview };
  }

  async installModule(request: AiBridgeModuleInstallRequest) {
    const previewId = typeof request.previewId === 'string' ? request.previewId.trim() : '';
    if (!previewId) throw new Error('缺少 previewId；必须先调用 lingbuilder.module.installPreview 获取预览。');
    const projectId = typeof request.projectId === 'string' ? request.projectId.trim() : '';
    if (!projectId) throw new Error('缺少 projectId，模块安装必须指定当前项目。');
    const solution = await this.solutionService.getSolution();
    this.solutionService.getProject(solution, projectId);
    const preview = this.moduleService.getPackageInstallPreview(previewId);
    if (!preview?.manifest) throw new Error('安装预览不存在或已经失效，请重新调用 lingbuilder.module.installPreview。');
    this.assertModuleAccess([preview.manifest.id]);
    await this.requireWriteWithAudit('module.install', `${preview.manifest.id}@${preview.manifest.version}`, request.approved);
    const result = await this.moduleService.installPackage(previewId);
    const enableForProject = request.enableForProject !== false;
    let buildConfiguration;
    let buildConfigurationChanged = false;
    const messages: string[] = [];
    if (enableForProject) {
      await this.moduleService.enableModuleForProject(projectId, result.moduleId);
      const compatibility = await this.buildConfigurationService.ensureCompatibleWithModules(
        (await this.moduleService.getEnabledProjectModules(projectId)).map(module => module.manifest.id)
      );
      buildConfiguration = compatibility.configuration;
      buildConfigurationChanged = compatibility.changed;
      messages.push(...(compatibility.messages || []));
    }
    await this.permissions.audit({ operation: 'write', action: 'module.install', ok: true, target: `${result.moduleId}@${result.version}` });
    return { ok: true as const, result, enableForProject, buildConfiguration, buildConfigurationChanged, messages };
  }

  async listProjectTemplates() {
    return {
      ok: true as const,
      templates: this.projectCreationService.listTemplates()
    };
  }

  async createProject(request: ProjectCreationRequest = {}) {
    const preview = await this.projectCreationService.preview(request);
    const moduleIds = [
      ...preview.modules.requestedModuleIds,
      ...preview.modules.dependencyModuleIds
    ];
    this.assertModuleAccess(moduleIds);
    if (request.approved !== true) {
      return { ok: true as const, applied: false as const, preview };
    }

    await this.requireWriteWithAudit('project.create', preview.project.id, request.approved);
    try {
      const result = await this.projectCreationService.create(request);
      await this.permissions.audit({ operation: 'write', action: 'project.create', ok: true, target: result.project.id });
      return { ok: true as const, applied: true as const, preview, result };
    } catch (error) {
      await this.auditFailure('write', 'project.create', preview.project.id, error);
      throw error;
    }
  }

  async undoProjectCreate(receiptId: string, approved?: boolean) {
    await this.requireWriteWithAudit('project.create.undo', receiptId, approved);
    try {
      const result = await this.projectCreationService.undo(receiptId);
      await this.permissions.audit({ operation: 'write', action: 'project.create.undo', ok: true, target: result.projectId });
      return result;
    } catch (error) {
      await this.auditFailure('write', 'project.create.undo', receiptId, error);
      throw error;
    }
  }

  async nativePreview(request: AiBridgeNativeRequest) {
    const projectId = request.project.id || 'lingbuilder-ui-project';
    const [enabledModules, lingCppSources] = await Promise.all([
      this.moduleService.getEnabledProjectModules(projectId),
      this.resolveLingCppProjectSources(projectId, request.lingCppSources)
    ]);
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    await this.requireSdkDependencies(enabledModules.map(module => module.manifest.id));
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      lingCppSources,
      enabledModules
    });
    const projectRef = await this.resolveAssetProject(request.project);
    const compiler = await this.compilerDetector();
    const architecture = compiler?.arch === 'x64' ? 'x64' : 'win32';
    const previewRoot = await this.pathPolicy.resolveDirectoryForWrite(
      normalizeFilePath(path.join('.lingbuilder-build', 'native-preview', sanitizeFilename(projectId)))
    );
    await fs.rm(previewRoot, { recursive: true, force: true });
    await fs.mkdir(previewRoot, { recursive: true });
    const codeGeneratorResult = await runProjectCodeGenerators({
      service: this.buildPipelineService,
      workspaceRoot: this.workspaceRoot,
      projectRoot: path.resolve(this.workspaceRoot, projectRef.sourceRoot || '.'),
      outputRoot: previewRoot,
      exportRoot: previewRoot,
      projectId,
      modules: enabledModules,
      target: createWindowsMsvcBuildTarget(architecture),
      cache: this.incrementalBuildService,
      cacheKey: `${projectId}:native-preview-code-generators:${architecture}`
    });
    const files = [...generatedProject.files, ...codeGeneratorResult.textFiles];
    return {
      ok: true,
      generatedFiles: generatedProject.files,
      files,
      diagnostics: [...generatedProject.diagnostics, ...codeGeneratorResult.diagnostics],
      blockingDiagnostics: generatedProject.blockingDiagnostics,
      selectedWindow: generatedProject.selectedWindow,
      enabledModules,
      sourceMap: generatedProject.sourceMap,
      logs: codeGeneratorResult.logs,
      codeGenerators: {
        fingerprint: codeGeneratorResult.fingerprint,
        incrementalHit: codeGeneratorResult.incrementalHit,
        artifacts: codeGeneratorResult.artifacts.map(({ relativePath, kind, size, sha256 }) => ({ relativePath, kind, size, sha256 }))
      }
    };
  }

  async nativeExport(request: AiBridgeNativeRequest) {
    await this.requireWriteWithAudit('native.export', request.project?.id, request.approved);
    try {
      const preview = await this.nativePreview(request);
      if (preview.blockingDiagnostics.length > 0) {
        throw new Error(`LCPP 项目源码存在阻止导出的错误：\n${preview.blockingDiagnostics.join('\n')}`);
      }
      const exportDir = await this.pathPolicy.resolveDirectoryForWrite(
        normalizeFilePath(path.join('generated', 'cpp', sanitizeFilename(request.project.id || 'window-preview')))
      );
      await fs.mkdir(exportDir, { recursive: true });
      const projectRef = await this.resolveAssetProject(request.project);
      const compiler = await this.compilerDetector();
      const architecture = compiler?.arch === 'x64' ? 'x64' : 'win32';
      const codeGeneratorResult = await runProjectCodeGenerators({
        service: this.buildPipelineService,
        workspaceRoot: this.workspaceRoot,
        projectRoot: path.resolve(this.workspaceRoot, projectRef.sourceRoot || '.'),
        outputRoot: exportDir,
        exportRoot: exportDir,
        projectId: request.project.id || 'window-preview',
        modules: preview.enabledModules,
        target: createWindowsMsvcBuildTarget(architecture),
        cache: this.incrementalBuildService,
        cacheKey: `${request.project.id || 'window-preview'}:native-export-code-generators:${architecture}`
      });
      const generatedFiles = [...preview.generatedFiles, ...codeGeneratorResult.textFiles];
      await Promise.all(generatedFiles.map(async file => {
        const targetPath = path.join(exportDir, file.relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, file.content, 'utf8');
      }));
      const copiedAssets = await this.designerAssetService.copyProjectAssets(projectRef, [exportDir]);
      const executableIcon = await this.windowsExecutableIconService.materialize(projectRef, preview.selectedWindow, [exportDir]);
      const moduleDiagnostics = await exportModuleNativeDependencies(preview.enabledModules, exportDir);
      const visualStudioProject = await exportVisualStudioProject({
        projectDir: exportDir,
        projectId: request.project.id || 'window-preview',
        generatedFiles,
        enabledModules: preview.enabledModules,
        contentFiles: [
          ...copiedAssets.map(file => normalizeFilePath(path.relative(exportDir, file))),
          ...executableIcon.files.map(file => normalizeFilePath(path.relative(exportDir, file))),
          ...codeGeneratorResult.artifacts
            .filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime')
            .map(artifact => normalizeFilePath(artifact.relativePath))
        ]
      });
      await this.permissions.audit({ operation: 'write', action: 'native.export', ok: true, target: exportDir });
      return {
        ...preview,
        files: [
          ...generatedFiles.map(file => path.join(exportDir, file.relativePath)),
          ...codeGeneratorResult.artifacts.map(artifact => path.join(exportDir, artifact.relativePath)),
          ...visualStudioProject.files
        ],
        exportDir,
        visualStudioProject,
        diagnostics: [...preview.diagnostics, ...codeGeneratorResult.diagnostics, ...moduleDiagnostics],
        logs: [...(preview.logs || []), ...codeGeneratorResult.logs]
      };
    } catch (error) {
      await this.auditFailure('write', 'native.export', request.project?.id, error);
      throw error;
    }
  }

  async buildRun(request: AiBridgeBuildRunRequest) {
    const projectId = sanitizeFilename((request.project.id || 'window-preview').trim());
    const buildAdmission = this.projectBuildCoordinator.captureAdmission(projectId);
    await this.requireExecuteWithAudit('build.run', request.project?.id, request.approved);
    if (this.runAdmissionClosed || this.shuttingDown) {
      return await this.createCancelledBuildResult(
        projectId,
        this.shuttingDown ? 'AI Bridge 正在关闭。' : 'AI Bridge 正在停止受控运行任务。'
      );
    }

    let buildLease: ProjectBuildLease | undefined;
    let preBuildLogs: string[] = [];
    try {
      const buildSession = await this.projectBuildSessionService.begin(projectId, buildAdmission);
      buildLease = buildSession.lease;
      if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
      if (buildLease.isCancelled()) {
        return await this.createCancelledBuildResult(projectId, '任务在生成前已被停止。', preBuildLogs);
      }
      return await this.executeBuildRun(request, buildLease, preBuildLogs);
    } catch (error) {
      await this.auditFailure('execute', 'build.run', request.project?.id, error);
      if (
        error instanceof ProjectBuildBusyError
        || error instanceof ProjectBuildCancelledBeforeStartError
        || error instanceof ProjectBuildPreparationError
      ) {
        return {
          ok: false,
          stage: error instanceof ProjectBuildBusyError
            ? 'busy'
            : error instanceof ProjectBuildCancelledBeforeStartError
              ? 'cancelled'
              : error.stage,
          error: error.message,
          logs: [error.message]
        };
      }
      throw error;
    } finally {
      buildLease?.finish();
    }
  }

  async stopRuns(): Promise<ManagedProcessStopAllResult> {
    this.runAdmissionClosed = true;
    this.projectBuildCoordinator.cancelAll('user');
    try {
      await this.projectBuildCoordinator.waitForIdle();
      return await this.managedProcessService.stopAll();
    } finally {
      if (!this.shuttingDown) this.runAdmissionClosed = false;
    }
  }

  async waitForRun(projectId: string) {
    const normalizedProjectId = sanitizeFilename((projectId || 'window-preview').trim());
    if (!this.managedProcessService.waitForExit) {
      return {
        projectId: normalizedProjectId,
        found: false,
        message: `项目“${normalizedProjectId}”的进程管理器不支持等待运行结束。`
      };
    }
    return await this.managedProcessService.waitForExit(normalizedProjectId);
  }

  private async resolveLingCppProjectSources(
    projectId: string,
    explicitSources?: LingCppProjectSourceFile[]
  ): Promise<LingCppProjectSourceFile[]> {
    const solution = await this.solutionService.getSolution();
    let projectRef: LingBuilderSolutionProject;
    try {
      projectRef = this.solutionService.getProject(solution, projectId);
    } catch (error) {
      if (explicitSources?.length) throw error;
      return [];
    }
    const sourceRoot = normalizeFilePath(projectRef.sourceRoot).replace(/\/+$/u, '');
    const nestedWorkspacePlan = await detectNestedWorkspaceArtifacts(path.resolve(this.workspaceRoot, sourceRoot));
    if (Array.isArray(explicitSources) && explicitSources.length > 0) {
      let totalSize = 0;
      const unique = new Map<string, LingCppProjectSourceFile>();
      for (const source of explicitSources) {
        if (!source || typeof source.filePath !== 'string' || typeof source.sourceCode !== 'string') throw new Error('项目源码集合包含无效条目。');
        const filePath = normalizeFilePath(source.filePath).replace(/^\.\//u, '');
        if (!filePath.toLocaleLowerCase().endsWith('.lcpp') || filePath.split('/').includes('..') || path.isAbsolute(filePath)) throw new Error(`项目源码路径不安全：${source.filePath}`);
        if (!filePath.startsWith(`${sourceRoot}/`)) throw new Error(`项目源码路径不属于当前项目源码目录：${source.filePath}`);
        const sourceRelativePath = filePath.slice(sourceRoot.length + 1);
        if (isProjectBuildArtifactRelativePath(sourceRelativePath)) continue;
        if (isNestedWorkspaceArtifactRelativePath(sourceRelativePath, nestedWorkspacePlan)) continue;
        totalSize += Buffer.byteLength(source.sourceCode, 'utf8');
        if (totalSize > 8 * 1024 * 1024) throw new Error('项目 LCPP 源码集合超过 8 MB 限制。');
        unique.set(filePath.toLocaleLowerCase(), { filePath, sourceCode: source.sourceCode });
      }
      return [...unique.values()];
    }
    const files = await this.solutionService.readProjectFiles(projectRef);
    return Object.entries(files)
      .filter(([filePath]) => filePath.toLocaleLowerCase().endsWith('.lcpp')
        && normalizeFilePath(filePath).startsWith(`${sourceRoot}/`)
        && !isProjectBuildArtifactRelativePath(normalizeFilePath(filePath).slice(sourceRoot.length + 1)))
      .map(([filePath, sourceCode]) => ({ filePath: normalizeFilePath(filePath), sourceCode: String(sourceCode || '') }));
  }

  async shutdown(): Promise<ManagedProcessStopAllResult> {
    this.shuttingDown = true;
    this.runAdmissionClosed = true;
    this.projectBuildCoordinator.shutdown();
    await this.projectBuildCoordinator.waitForIdle();
    return await this.managedProcessService.stopAll();
  }

  private async executeBuildRun(
    request: AiBridgeBuildRunRequest,
    buildLease: ProjectBuildLease,
    preBuildLogs: string[]
  ) {
    const sourceProjectId = request.project.id || 'lingbuilder-ui-project';
    const [enabledModules, lingCppSources] = await Promise.all([
      this.moduleService.getEnabledProjectModules(sourceProjectId),
      this.resolveLingCppProjectSources(sourceProjectId, request.lingCppSources)
    ]);
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    await this.requireSdkDependencies(enabledModules.map(module => module.manifest.id));
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      lingCppSources,
      enabledModules
    });
    if (generatedProject.blockingDiagnostics.length > 0) {
      throw new Error(`LCPP 项目源码存在阻止构建的错误：\n${generatedProject.blockingDiagnostics.join('\n')}`);
    }
    const managedProjectId = buildLease.projectId;
    const projectId = sanitizeFilename(managedProjectId);
    const [buildDir, exportDir] = await Promise.all([
      this.pathPolicy.resolveDirectoryForWrite(normalizeFilePath(path.join('.lingbuilder-build', projectId))),
      this.pathPolicy.resolveDirectoryForWrite(normalizeFilePath(path.join('generated', 'cpp', projectId)))
    ]);
    const sourceDir = path.join(buildDir, 'src');
    const binDir = path.join(buildDir, 'bin');
    const objDir = path.join(buildDir, 'obj');
    // These directories contain only reproducible build products. Recreate
    // them so disabled modules cannot leave stale DLLs, libs or sources in a
    // later build (for example after switching away from new_emoji).
    await Promise.all([
      fs.rm(binDir, { recursive: true, force: true }),
      fs.rm(objDir, { recursive: true, force: true }),
      fs.rm(path.join(buildDir, 'modules'), { recursive: true, force: true }),
      fs.rm(path.join(sourceDir, 'modules'), { recursive: true, force: true }),
      fs.rm(path.join(exportDir, 'modules'), { recursive: true, force: true })
    ]);
    await Promise.all([
      fs.mkdir(sourceDir, { recursive: true }),
      fs.mkdir(binDir, { recursive: true }),
      fs.mkdir(objDir, { recursive: true }),
      fs.mkdir(exportDir, { recursive: true })
    ]);

    const activeWindow = request.project.windows.find(window => window.id === request.activeWindowId) || request.project.windows[0];
    if (activeWindow && request.lingCppSourceCode?.trim()) {
      const fileName = `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, '')}.lcpp`;
      await fs.writeFile(path.join(sourceDir, fileName), request.lingCppSourceCode, 'utf8');
    }

    await Promise.all(generatedProject.files.map(async file => {
      const sourcePath = path.join(sourceDir, file.relativePath);
      const exportPath = path.join(exportDir, file.relativePath);
      await Promise.all([
        fs.mkdir(path.dirname(sourcePath), { recursive: true }),
        fs.mkdir(path.dirname(exportPath), { recursive: true })
      ]);
      await Promise.all([
        fs.writeFile(sourcePath, file.content, 'utf8'),
        fs.writeFile(exportPath, file.content, 'utf8')
      ]);
    }));

    const projectRef = await this.resolveAssetProject(request.project);
    const compiler = await this.compilerDetector();
    let codeGeneratorResult: ProjectCodeGeneratorResult;
    try {
      await fs.rm(path.join(binDir, 'LingBuilderPreview.exe'), { force: true });
      codeGeneratorResult = await runProjectCodeGenerators({
        service: this.buildPipelineService,
        workspaceRoot: this.workspaceRoot,
        projectRoot: path.resolve(this.workspaceRoot, projectRef.sourceRoot || '.'),
        outputRoot: sourceDir,
        exportRoot: exportDir,
        projectId: managedProjectId,
        modules: enabledModules,
        target: createWindowsMsvcBuildTarget(compiler?.arch === 'x64' ? 'x64' : 'win32'),
        signal: buildLease.signal,
        cache: this.incrementalBuildService,
        cacheKey: `${managedProjectId}:code-generators:${compiler?.arch === 'x64' ? 'x64' : 'win32'}`
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const result = {
        ok: false,
        stage: 'code-generators',
        error: reason,
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        sourceMap: generatedProject.sourceMap,
        logs: [...preBuildLogs, `代码生成阶段失败：${reason}`]
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }
    const generatedCodegenFiles = codeGeneratorResult.textFiles;
    const copiedAssets = await this.designerAssetService.copyProjectAssets(projectRef, [buildDir, binDir, exportDir]);
    const executableIcon = await this.windowsExecutableIconService.materialize(projectRef, generatedProject.selectedWindow, [buildDir, exportDir]);
    const copiedBuildContent = [...copiedAssets, ...executableIcon.files];
    const buildContentFiles = copiedBuildContent
      .filter(file => file.startsWith(`${path.resolve(buildDir)}${path.sep}`))
      .map(file => normalizeFilePath(path.relative(buildDir, file)));
    const exportContentFiles = copiedBuildContent
      .filter(file => file.startsWith(`${path.resolve(exportDir)}${path.sep}`))
      .map(file => normalizeFilePath(path.relative(exportDir, file)));

    const preferredTargetId = compiler?.arch === 'x64' ? 'windows-msvc-x64' : 'windows-msvc-win32';
    const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
      buildDir,
      sourceDir,
      binDir,
      exportDir,
      preferredTargetId
    });
    if (moduleNativePlan.blockingDiagnostics.length > 0) {
      const result = {
        ok: false,
        stage: 'native-dependencies',
        error: moduleNativePlan.blockingDiagnostics.join('\n'),
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        sourceMap: generatedProject.sourceMap,
        logs: [...preBuildLogs, ...generatedProject.diagnostics, ...moduleNativePlan.diagnostics, '原生依赖未准备完整，已阻止编译和运行。']
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }
    const generatedNativeSources = codeGeneratorResult.outputFiles.filter((file): file is string => typeof file === 'string' && /\.(?:c|cc|cpp|cxx)$/iu.test(file));
    moduleNativePlan.sourceFiles.push(...generatedNativeSources);
    moduleNativePlan.includeDirs.push(...new Set(generatedNativeSources.map(file => path.dirname(file))));
    moduleNativePlan.sourceFiles = [...new Set(moduleNativePlan.sourceFiles)];
    moduleNativePlan.includeDirs = [...new Set(moduleNativePlan.includeDirs)];
    const buildVisualStudioProject = await exportVisualStudioProject({
      projectDir: buildDir,
      projectId,
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles].map(file => ({
        ...file,
        relativePath: normalizeFilePath(path.join('src', file.relativePath))
      })),
      enabledModules,
      contentFiles: [...buildContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(path.join('src', artifact.relativePath)))],
      requiredCppStandard: moduleNativePlan.requiredCppStandard,
      requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt,
      fbroRuntimeFromBuildBin: true
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId,
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles],
      enabledModules,
      contentFiles: [...exportContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(artifact.relativePath))],
      requiredCppStandard: moduleNativePlan.requiredCppStandard,
      requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt
    });
    if (buildLease.isCancelled()) {
      return await this.createCancelledBuildResult(
        managedProjectId,
        '已完成源码导出，但任务在编译前被停止。',
        preBuildLogs,
        buildDir
      );
    }
    const baseLogs = [
      ...preBuildLogs,
      `AI Bridge 已生成 Win32 C++ 工程：${buildDir}`,
      `C++ 源码目录：${sourceDir}`,
      `可复制生成目录：${exportDir}`,
      `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
      `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
      ...generatedProject.diagnostics,
      ...codeGeneratorResult.logs,
      ...moduleNativePlan.diagnostics
    ];

    if (!compiler) {
      const result = {
        ok: false,
        stage: 'compiler',
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        files: [...generatedProject.files, ...generatedCodegenFiles].map(file => path.join(sourceDir, file.relativePath)),
        visualStudioProject: buildVisualStudioProject,
        exportVisualStudioProject: exportVisualStudioProjectResult,
        sourceMap: generatedProject.sourceMap,
        logs: [
          ...baseLogs,
          '未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。'
        ]
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }

    const sourcePath = path.join(sourceDir, 'main.cpp');
    const exePath = path.join(binDir, 'LingBuilderPreview.exe');
    const executableResourcePath = generatedProject.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)
      ? path.join(sourceDir, WINDOWS_EXECUTABLE_RESOURCE_FILE)
      : undefined;
    const compileResult = await this.compilerRunner(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, executableResourcePath, buildLease.signal);
    const logs = [
      ...baseLogs,
      `exe 输出目录：${binDir}`,
      `中间文件目录：${objDir}`,
      `编译器：${compiler.kind} (${compiler.command})`,
      moduleNativePlan.runtimeFiles.length ? `已复制模块运行时文件：${moduleNativePlan.runtimeFiles.map(file => path.basename(file)).join(', ')}` : '',
      ...compileResult.logs
    ].filter(Boolean);

    if (!compileResult.ok) {
      const result = {
        ok: false,
        stage: 'compile',
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exePath,
        compiler,
        exportDir,
        visualStudioProject: buildVisualStudioProject,
        exportVisualStudioProject: exportVisualStudioProjectResult,
        sourceMap: generatedProject.sourceMap,
        logs
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }

    if (buildLease.isCancelled()) {
      return await this.createCancelledBuildResult(
        managedProjectId,
        '编译已结束，但启动请求已被停止；不会启动生成的 exe。',
        logs,
        buildDir
      );
    }

    if (request.run !== false) {
      try {
        const logFile = path.join(buildDir, 'run.log');
        const started = await this.managedProcessService.start(managedProjectId, exePath, {
          cwd: binDir,
          env: {
            ...process.env,
            ...(this.fbroVipKey ? { LINGBUILDER_FBRO_VIP_KEY: this.fbroVipKey } : {})
          },
          detached: false,
          windowsHide: false,
          logFilePath: logFile
        });
        if (buildLease.isCancelled()) {
          const stopped = await this.managedProcessService.stop(managedProjectId);
          return await this.createCancelledBuildResult(
            managedProjectId,
            '运行进程在登记期间收到停止请求，已回收且不会遗留后台进程。',
            [...logs, stopped.message],
            buildDir
          );
        }
        logs.push(started.message, `运行文件：${exePath}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const failedLogs = [...logs, `运行启动失败：${reason || '无法启动生成的 exe'}`];
        await this.permissions.audit({
          operation: 'execute',
          action: 'build.run',
          ok: false,
          target: buildDir,
          details: { stage: 'run-start', reason }
        });
        return {
          ok: false,
          stage: 'run-start',
          buildDir,
          sourceDir,
          binDir,
          objDir,
          exePath,
          compiler,
          exportDir,
          visualStudioProject: buildVisualStudioProject,
          exportVisualStudioProject: exportVisualStudioProjectResult,
          sourceMap: generatedProject.sourceMap,
          logs: failedLogs
        };
      }
    }

    await this.permissions.audit({
      operation: 'execute',
      action: 'build.run',
      ok: true,
      target: buildDir,
      details: { run: request.run !== false }
    });
    return {
      ok: true,
      stage: request.run === false ? 'build' : 'run',
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exePath,
      compiler,
      exportDir,
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      logs
    };
  }

  private async resolveAssetProject(project: LingWindowProject): Promise<LingBuilderSolutionProject> {
    try {
      return this.solutionService.getProject(await this.solutionService.getSolution(), project.id);
    } catch {
      const projectId = String(project.id || 'window-preview');
      return {
        id: projectId,
        name: project.name || projectId,
        type: 'visual-cpp',
        sourceRoot: `src/${projectId}`,
        configRoot: `config/${projectId}`,
        designerPath: `.lingbuilder/projects/${projectId}/window-designer.json`,
        isDefault: projectId === DEFAULT_PROJECT_ID
      };
    }
  }

  private async createCancelledBuildResult(
    projectId: string,
    reason: string,
    logs: string[] = [],
    target = projectId
  ) {
    const error = `项目“${projectId}”的 AI Bridge 生成运行任务已取消：${reason}`;
    try {
      await this.permissions.audit({
        operation: 'execute',
        action: 'build.run',
        ok: false,
        target,
        details: { stage: 'cancelled', reason }
      });
    } catch {
      // Audit failure must not turn a safe cancellation into an unhandled error.
    }
    return { ok: false, stage: 'cancelled', error, projectId, logs: [...logs, error] };
  }

  private async getModuleContext(projectId = 'lingbuilder-ui-project') {
    const [availableModules, enabledModules] = await Promise.all([
      this.moduleService.scanInstalledModules(projectId),
      this.moduleService.getEnabledProjectModules(projectId)
    ]);
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    return { availableModules, enabledModules };
  }

  private async resolveEditWorkspaceFiles(request: AiBridgeEditProposeRequest): Promise<LingCppWorkspaceFile[]> {
    if (Array.isArray(request.workspaceFiles) && request.workspaceFiles.length > 0) {
      return request.workspaceFiles.map(file => ({
        ...file,
        filePath: normalizeFilePath(file.filePath),
        sourceCode: normalizeLineEndings(file.sourceCode)
      }));
    }
    return [{
      filePath: normalizeFilePath(request.filePath),
      sourceCode: typeof request.sourceCode === 'string' ? normalizeLineEndings(request.sourceCode) : (await this.readFile(request.filePath)).content
    }];
  }

  private async resolveApplyWorkspaceFiles(request: AiBridgeEditApplyRequest): Promise<LingCppWorkspaceFile[]> {
    if (Array.isArray(request.workspaceFiles) && request.workspaceFiles.length > 0) {
      return request.workspaceFiles.map(file => ({
        ...file,
        filePath: normalizeFilePath(file.filePath),
        sourceCode: normalizeLineEndings(file.sourceCode)
      }));
    }
    const proposal = getWorkspaceEditProposal(request.proposalId);
    if (!proposal?.changes.length) return [];
    return await Promise.all(proposal.changes.map(async (change, index) => ({
      filePath: change.filePath,
      sourceCode: index === 0 && typeof request.sourceCode === 'string'
        ? normalizeLineEndings(request.sourceCode)
        : (await this.readFile(change.filePath)).content
    })));
  }

  private async readDirectoryTree(directory: string, depth: number, budget: { nodes: number }): Promise<AiBridgeTreeEntry[]> {
    if (depth > 10 || budget.nodes >= TREE_NODE_LIMIT) return [];
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const result: AiBridgeTreeEntry[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (budget.nodes >= TREE_NODE_LIMIT) break;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = await this.pathPolicy.toWorkspaceRelative(absolutePath);
      budget.nodes += 1;
      if (entry.isDirectory()) {
        result.push({
          path: relativePath,
          name: entry.name,
          type: 'directory',
          children: await this.readDirectoryTree(absolutePath, depth + 1, budget)
        });
      } else if (entry.isFile() && isReadableExtension(entry.name)) {
        const stat = await fs.stat(absolutePath);
        result.push({ path: relativePath, name: entry.name, type: 'file', size: stat.size });
      }
    }
    return result;
  }

  private async searchPath(targetPath: string, query: string, matches: AiBridgeSearchMatch[], maxResults: number, budget: { files: number; bytes: number; deadline: number }): Promise<void> {
    if (Date.now() > budget.deadline) throw new Error('AI Bridge 搜索超过 10 秒资源上限。');
    const stat = await fs.lstat(targetPath);
    if (stat.isSymbolicLink()) return;
    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxResults) return;
        if (entry.isSymbolicLink()) continue;
        if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
        await this.searchPath(path.join(targetPath, entry.name), query, matches, maxResults, budget);
      }
      return;
    }
    if (!stat.isFile() || !isReadableExtension(targetPath)) return;
    if (stat.size > SEARCH_FILE_LIMIT) return;
    budget.files += 1; budget.bytes += stat.size;
    if (budget.files > SEARCH_FILE_COUNT_LIMIT || budget.bytes > SEARCH_TOTAL_LIMIT) throw new Error('AI Bridge 搜索超过文件数或 64 MiB 总扫描上限。');
    const content = decodeTextFile(await fs.readFile(targetPath)).content;
    const workspacePath = await this.pathPolicy.toWorkspaceRelative(targetPath);
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length && matches.length < maxResults; index += 1) {
      const line = lines[index];
      const column = line.indexOf(query);
      if (column >= 0) {
        matches.push({
          filePath: workspacePath,
          line: index + 1,
          column: column + 1,
          preview: line.trim()
        });
      }
    }
  }

  private async resolveReadablePath(filePath: string): Promise<string> {
    const absolutePath = await this.pathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    if (!isReadableExtension(absolutePath)) throw new Error('该文件类型不允许通过 AI Bridge 读取。');
    return absolutePath;
  }

  private async resolveWritablePath(filePath: string): Promise<string> {
    const absolutePath = await this.pathPolicy.resolveForWrite(filePath);
    if (!WRITABLE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
      throw new Error('该文件类型不允许通过 AI Bridge 写入。');
    }
    return absolutePath;
  }

  private async readExistingTextFileFormat(filePath: string): Promise<TextFileFormat> {
    try {
      return decodeTextFile(await fs.readFile(filePath)).format;
    } catch (error: any) {
      if (error?.code === 'ENOENT') return { encoding: 'utf8', eol: 'lf' };
      throw error;
    }
  }

  private async requireWriteWithAudit(action: string, target: string | undefined, approved?: boolean): Promise<void> {
    try {
      this.permissions.requireWrite(approved);
    } catch (error) {
      await this.auditFailure('write', action, target, error);
      throw error;
    }
  }

  private async requireExecuteWithAudit(action: string, target: string | undefined, approved?: boolean): Promise<void> {
    try {
      this.permissions.requireExecute(approved);
    } catch (error) {
      await this.auditFailure('execute', action, target, error);
      throw error;
    }
  }

  private async auditFailure(
    operation: 'read' | 'write' | 'execute',
    action: string,
    target: string | undefined,
    error: unknown
  ): Promise<void> {
    try {
      await this.permissions.audit({
        operation,
        action,
        ok: false,
        target,
        details: error instanceof Error ? error.message : String(error)
      });
    } catch {
      // Never replace the original security or operation error with an audit-log failure.
    }
  }
}

async function detectCompiler(): Promise<AiBridgeCompilerInfo | null> {
  try {
    await execFileAsync('where.exe', ['cl'], { timeout: 4000, windowsHide: true });
    return { kind: 'msvc', command: 'cl', arch: 'x64' };
  } catch {
    // MSVC may be installed but not loaded into the current shell.
  }

  const msvcSetupBatch = await findMsvcSetupBatch();
  if (msvcSetupBatch && await canUseMsvcSetupBatch(msvcSetupBatch)) {
    const arch = /vcvars64|amd64/i.test(msvcSetupBatch) ? 'x64' : /vcvars32|x86/i.test(msvcSetupBatch) ? 'win32' : 'x64';
    return { kind: 'msvc', command: 'cl', setupBatch: msvcSetupBatch, arch };
  }

  const candidates: AiBridgeCompilerInfo[] = [
    { kind: 'g++', command: 'g++' },
    { kind: 'clang++', command: 'clang++' }
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, ['--version'], { timeout: 4000, windowsHide: true });
      return candidate;
    } catch {
      // Try next compiler.
    }
  }

  return null;
}

async function findMsvcSetupBatch(arch?: 'win32' | 'x64'): Promise<string | null> {
  const installPaths = new Set<string>();
  const vswherePath = process.env['ProgramFiles(x86)']
    ? path.join(process.env['ProgramFiles(x86)'] as string, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
    : '';

  if (vswherePath && await pathExists(vswherePath)) {
    try {
      const result = await execFileAsync(vswherePath, ['-latest', '-products', '*', '-property', 'installationPath'], {
        timeout: 5000,
        windowsHide: true
      });
      result.stdout
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => installPaths.add(line));
    } catch {
      // Fall back to common Visual Studio installation folders below.
    }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const editions = ['BuildTools', 'Community', 'Professional', 'Enterprise'];
  for (const edition of editions) {
    installPaths.add(path.join(programFiles, 'Microsoft Visual Studio', '2022', edition));
    installPaths.add(path.join(programFiles, 'Microsoft Visual Studio', '2019', edition));
  }

  for (const installPath of installPaths) {
    const vcvars = (name: string) => path.join(installPath, 'VC', 'Auxiliary', 'Build', name);
    const candidates = arch === 'win32'
      ? [vcvars('vcvars32.bat'), vcvars('vcvars64.bat'), path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')]
      : arch === 'x64'
        ? [vcvars('vcvars64.bat'), path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')]
        : [vcvars('vcvars64.bat'), vcvars('vcvars32.bat'), path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) return candidate;
    }
  }

  return null;
}

async function canUseMsvcSetupBatch(setupBatch: string): Promise<boolean> {
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', `call ${quoteCmdArg(setupBatch)} >nul && where cl >nul`], {
      timeout: 15000,
      windowsHide: true,
      windowsVerbatimArguments: true
    });
    return true;
  } catch {
    return false;
  }
}

async function compileWin32Preview(
  compiler: AiBridgeCompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  modulePlan?: ModuleNativeDependencyPlan,
  resourcePath?: string,
  signal?: AbortSignal
): Promise<AiBridgeCompileResult> {
  const includeArgs = (modulePlan?.includeDirs || []).flatMap(includeDir => ['/I', includeDir]);
  const moduleSources = modulePlan?.sourceFiles || [];
  const moduleLibs = modulePlan?.libFiles || [];
  if (compiler.kind !== 'msvc' && modulePlan?.requiresMsvc) {
    return {
      ok: false,
      logs: [
        '编译失败。',
        '当前启用模块需要 MSVC/Visual Studio Build Tools；检测到的编译器不能直接链接 .lib 导入库。'
      ]
    };
  }

  let resourceOutputPath: string | undefined;
  let resourceLogs: string[] = [];
  try {
    const resourceResult = await compileWindowsExecutableResource({ compiler, resourcePath, objDir, cwd, signal });
    resourceOutputPath = resourceResult.outputPath;
    resourceLogs = resourceResult.logs;
  } catch (error) {
    if (error instanceof WindowsExecutableResourceCompileError) {
      return { ok: false, logs: error.logs };
    }
    return { ok: false, logs: ['EXE 图标资源编译失败。', error instanceof Error ? error.message : String(error)] };
  }

  const objectPath = path.join(objDir, 'main.obj');
  const useDynamicCrt = modulePlan?.requiresDynamicCrt === true;
  const requiredCppStandard = modulePlan?.requiredCppStandard === 20 ? 20 : 17;
  if (compiler.kind === 'msvc' && moduleSources.length > 0) {
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs, requiredCppStandard, useDynamicCrt, resourceOutputPath, resourceLogs, signal);
  }

  const commandArgs = compiler.kind === 'msvc'
    ? [
        '/nologo',
        '/EHsc',
        `/std:c++${requiredCppStandard}`,
        '/utf-8',
        ...(useDynamicCrt ? ['/MD'] : []),
        '/DUNICODE',
        '/D_UNICODE',
        ...includeArgs,
        sourcePath,
        '/Fo:' + objectPath,
        '/Fe:' + exePath,
        'user32.lib',
        'gdi32.lib',
        'comctl32.lib',
        'ole32.lib',
        ...(resourceOutputPath ? [resourceOutputPath] : []),
        ...moduleLibs
      ]
    : [
        '-municode',
        `-std=c++${requiredCppStandard}`,
        '-finput-charset=UTF-8',
        '-fexec-charset=UTF-8',
        '-DUNICODE',
        '-D_UNICODE',
        '-c',
        sourcePath,
        '-o',
        objectPath
      ];
  const linkArgs = compiler.kind === 'msvc'
    ? []
    : [
        '-municode',
        objectPath,
        ...(resourceOutputPath ? [resourceOutputPath] : []),
        '-o',
        exePath,
        '-luser32',
        '-lgdi32',
        '-lcomctl32'
      ];

  try {
    const command = compiler.kind === 'msvc' && compiler.setupBatch ? 'cmd.exe' : compiler.command;
    const args = compiler.kind === 'msvc' && compiler.setupBatch
      ? ['/d', '/c', `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(' ')}`]
      : commandArgs;

    const compileResult = await execCompilerFileAsync(command, args, {
      cwd,
      timeout: 60000,
      windowsHide: true,
      windowsVerbatimArguments: command === 'cmd.exe',
      maxBuffer: 1024 * 1024 * 4
      , signal
    });
    const linkResult = linkArgs.length > 0
      ? await execCompilerFileAsync(compiler.command, linkArgs, {
          cwd,
          timeout: 60000,
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4
          , signal
        })
      : undefined;

    return {
      ok: true,
      logs: [
        '编译成功。',
        ...resourceLogs,
        compileResult.stdout?.trim() ? `stdout:\n${compileResult.stdout.trim()}` : '',
        compileResult.stderr?.trim() ? `stderr:\n${compileResult.stderr.trim()}` : '',
        linkResult?.stdout?.trim() ? `link stdout:\n${linkResult.stdout.trim()}` : '',
        linkResult?.stderr?.trim() ? `link stderr:\n${linkResult.stderr.trim()}` : ''
      ].filter(Boolean)
    };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        '编译失败。',
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : '',
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : '',
        error.message ? `错误：${error.message}` : ''
      ].filter(Boolean)
    };
  }
}

async function compileMsvcPreviewWithModules(
  compiler: AiBridgeCompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  includeArgs: string[],
  moduleSources: string[],
  moduleLibs: string[],
  requiredCppStandard: 17 | 20,
  useDynamicCrt: boolean,
  resourceOutputPath: string | undefined,
  resourceLogs: string[],
  signal?: AbortSignal
): Promise<{ ok: boolean; logs: string[] }> {
  const sources = [sourcePath, ...moduleSources];
  const objectFiles = sources.map((source, index) => path.join(objDir, `${index === 0 ? 'main' : `module_${index}`}.obj`));
  const compileCommands = sources.map((source, index) => [
    '/nologo',
    '/EHsc',
    `/std:c++${requiredCppStandard}`,
    '/utf-8',
    ...(useDynamicCrt ? ['/MD'] : []),
    '/DUNICODE',
    '/D_UNICODE',
    ...includeArgs,
    '/c',
    source,
    '/Fo:' + objectFiles[index]
  ]);
  const linkArgs = [
    '/nologo',
    ...objectFiles,
    '/Fe:' + exePath,
    'user32.lib',
    'gdi32.lib',
    'comctl32.lib',
    'ole32.lib',
    ...(resourceOutputPath ? [resourceOutputPath] : []),
    ...moduleLibs
  ];

  try {
    const outputs: string[] = [];
    for (const args of compileCommands) {
      const result = await runMsvcCommand(compiler, args, cwd, signal);
      if (result.stdout?.trim()) outputs.push(`stdout:\n${result.stdout.trim()}`);
      if (result.stderr?.trim()) outputs.push(`stderr:\n${result.stderr.trim()}`);
    }
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd, signal);
    if (linkResult.stdout?.trim()) outputs.push(`link stdout:\n${linkResult.stdout.trim()}`);
    if (linkResult.stderr?.trim()) outputs.push(`link stderr:\n${linkResult.stderr.trim()}`);
    return { ok: true, logs: ['编译成功。', ...resourceLogs, ...outputs] };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        '编译失败。',
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : '',
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : '',
        error.message ? `错误：${error.message}` : ''
      ].filter(Boolean)
    };
  }
}

async function runMsvcCommand(compiler: AiBridgeCompilerInfo, commandArgs: string[], cwd: string, signal?: AbortSignal) {
  const command = compiler.setupBatch ? 'cmd.exe' : compiler.command;
  const args = compiler.setupBatch
    ? ['/d', '/c', `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(' ')}`]
    : commandArgs;
  return await execCompilerFileAsync(command, args, {
    cwd,
    timeout: 60000,
    windowsHide: true,
    windowsVerbatimArguments: command === 'cmd.exe',
    maxBuffer: 1024 * 1024 * 4
    , signal
  });
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

async function execCompilerFileAsync(command: string, args: string[], options: Record<string, unknown>): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(command, args, { ...options, encoding: 'buffer' } as any);
    return { stdout: decodeCompilerOutput(result.stdout), stderr: decodeCompilerOutput(result.stderr) };
  } catch (error: any) {
    error.stdout = decodeCompilerOutput(error.stdout);
    error.stderr = decodeCompilerOutput(error.stderr);
    throw error;
  }
}

function isReadableExtension(filePath: string): boolean {
  return READABLE_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, '\n');
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, '/').trim();
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 80) || 'window-preview';
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.stat(value);
    return true;
  } catch {
    return false;
  }
}
