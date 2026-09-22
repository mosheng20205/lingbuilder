import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { applyWorkspaceEditToFiles, areDesignerProjectsEquivalent, getWorkspaceEditProposal, proposeLingCppEdit, rejectWorkspaceEdit, validateDesignerProjectEdit } from '../lingCpp/aiEditService';
import { getLingCppSemanticDiagnostics } from '../lingCpp/languageService';
import { collectControlReferenceAdmissionProblems, formatControlReferenceAdmissionBlock } from '../lingCpp/controlReferenceAdmission';
import { deleteAgentProposal, persistAgentProposal, readAgentProposal } from '../lingCpp/agentProposalStore';
import { createProjectGlobalContext, isProjectGlobalsFilePath } from '../lingCpp/projectGlobalService';
import { createProjectTypeContext, isProjectDataTypesFilePath } from '../lingCpp/projectDataTypeService';
import { createFunctionLibraryTemplate, createProjectFunctionContext } from '../lingCpp/functionLibraryService';
import { LingCppDiagnostic, LingCppEditContext, LingCppProjectSourceFile, LingCppWorkspaceFile, WorkspaceEditProposal } from '../lingCpp/types';
import { createModuleService } from '../modules/moduleService';
import {
  DESIGNER_CONTROL_DETAIL_MAX,
  DESIGNER_CONTROL_SUMMARY_MAX,
  DEMO_EXAMPLE_MAX_COMMANDS,
  buildDesignerControlDetails,
  buildDesignerControlSummaries,
  collectUiExamples,
  loadComponentGuides,
  readComponentGuide,
  loadDemoCorpus,
  matchUiExample,
  readUiExampleContent
} from './moduleUiViews';
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
import { createProjectDllDeclarationModuleFromSources, getProjectDllCommandsDiagnostics, isProjectDllCommandsFilePath } from '../lingCpp/projectDllCommandService';
import { materializeProjectDllDeclarationModules } from '../modules/projectDllMaterializeService';
import { getEmbeddedResourceSpecsForBuild } from '../windowDesigner/embeddedResourceMigration';
import { normalizeIdentifier, parseLingCpp } from '../lingCpp/parser';
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
import { resolveExecutableNameParts } from '../solution/externalProjectService';
import { resolveProjectBuildDirectories } from '../tasks/buildPathService';
import { createProjectCreationService, type ProjectCreationRequest, type ProjectCreationService } from '../solution/projectCreationService';
import { SdkDependencyService } from '../sdkDependencies/sdkDependencyService';
import { resolveSdkCacheRoot } from '../sdkDependencies/sdkDependencyCatalog';
import { AiBridgePermissionService } from './permissionService';
import {
  AiBridgeBuildRunRequest,
  AiBridgeCodeOrganizationInfo,
  AiBridgeDesignerContextInfo,
  AiBridgeDesignerInventory,
  AiBridgeDesignerControlItem,
  AiBridgeDesignerWindowInfo,
  AiBridgeEditApplyRequest,
  AiBridgeEditApplyResult,
  AiBridgeEditProposeRequest,
  AiBridgeHealth,
  AiBridgeLingCppDiagnosticsRequest,
  AiBridgeModuleInstallPreviewRequest,
  AiBridgeModuleInstallRequest,
  AiBridgeModuleInfoRequest,
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
import { LINGBUILDER_MODULE_CATEGORIES, type ModuleCommandBinding, type ModuleCommandContribution } from '../modules/types';
import { describeModuleBindingParameterType } from '../modules/bindingValueType';
import { REQUIRE_ADMINISTRATOR_LINK_ARGS } from '../windowDesigner/windowsSystemLibraries';

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

/**
 * MCP 工具共享的设计器上下文解析结果：
 * - caller：调用方显式传入的完整设计器模型，始终优先；
 * - workspace：按 projectId 从解决方案解析并读取磁盘设计器模型（persisted=false 表示文件缺失或无效，实为兜底空模型）；
 * - none：无任何设计器上下文（未传模型且 projectId 缺失或不在解决方案中）。
 */
type AiBridgeDesignerContextResolution =
  | { source: 'caller'; project: LingWindowProject }
  | { source: 'workspace'; project: LingWindowProject; persisted: boolean; designerPath: string }
  | { source: 'none'; reason: 'missing-project-id' | 'project-not-found'; projectId?: string };
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
  & Partial<Pick<ManagedProcessService, 'waitForExit' | 'getStatus'>>;

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
    signal?: AbortSignal,
    outputType?: 'exe' | 'dll',
    requireAdministrator?: boolean
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
  /** 最近一次受控运行的 run.log 路径（进程退出后 status 消失，仍可读日志）。 */
  private readonly lastRunLogPaths = new Map<string, string>();

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
    const dllCommandSource = effectiveSources.find(source => isProjectDllCommandsFilePath(source.filePath));
    const projectFunctions = createProjectFunctionContext(
      effectiveSources.map(source => ({ ...source, language: 'lingcpp' }))
    );
    const designerContext = await this.resolveDesignerContext(request.designerProject, request.projectId);
    const diagnostics = getLingCppSemanticDiagnostics(
      sourceCode,
      designerContext.source === 'none' ? undefined : designerContext.project,
      request.filePath,
      moduleContext,
      projectGlobals,
      projectTypes,
      projectFunctions,
      { suppressDesignerControlDiagnostics: designerContext.source === 'none' }
    );
    const designerNotices = this.createDesignerContextDiagnostics(designerContext);
    if (designerNotices.length > 0) diagnostics.unshift(...designerNotices);
    const designerInventory = this.describeDesignerInventory(designerContext, effectiveSources);
    const codeOrganization = this.describeCodeOrganization({
      windowProject: designerContext.source !== 'none',
      sources: effectiveSources,
      functionLibraries: projectFunctions.libraries
    });
    diagnostics.push(...this.createCodeOrganizationDiagnostics(codeOrganization, request.filePath));
    if (dllCommandSource) diagnostics.unshift(...getProjectDllCommandsDiagnostics(dllCommandSource.sourceCode, dllCommandSource.filePath));
    return {
      ok: true,
      filePath: normalizeFilePath(request.filePath),
      diagnostics,
      designerContext: this.describeDesignerContext(designerContext),
      designerInventory,
      codeOrganization,
      moduleContextSummary: describeLingCppModuleContextForAi(moduleContext)
    };
  }

  async proposeEdit(request: AiBridgeEditProposeRequest, planner?: (context: LingCppEditContext) => Promise<any>) {
    const sourceCode = typeof request.sourceCode === 'string'
      ? request.sourceCode
      : (await this.readFile(request.filePath)).content;
    const designerContext = await this.resolveDesignerContext(request.designerProject, request.projectId);
    if (request.updatedDesignerProject !== undefined) assertDesignerProjectShape(request.updatedDesignerProject, 'updatedDesignerProject');
    const workspaceFiles = await this.resolveEditWorkspaceFiles(request);
    const proposedFiles = await this.normalizeProposedFiles(request, workspaceFiles);
    const designerProjectDiskBaseline = designerContext.source === 'caller'
      ? await this.readDesignerDiskBaselineFor(designerContext.project, request.projectId)
      : undefined;
    const context: LingCppEditContext = {
      filePath: normalizeFilePath(request.filePath),
      sourceCode: normalizeLineEndings(sourceCode),
      instruction: request.instruction || '',
      // 外部 AI 自带完整文件草稿（无 planner）时允许纯源码提案；系统 AI planner 路径保持严格。
      designerEditPolicy: planner ? 'strict' : 'caller-draft',
      selection: request.selection,
      workspaceFiles,
      moduleContext: await this.getModuleContext(request.projectId),
      aiConfig: request.aiConfig,
      designerProject: designerContext.source === 'none' ? undefined : designerContext.project,
      designerProjectDiskBaseline
    };
    if (!planner && !proposedFiles?.length) {
      throw new Error('当前独立 AI Bridge 未配置系统 AI planner；请由外部 AI 提供 files 完整文件草稿后再创建提案。');
    }
    const draft = planner ? await planner(context) : { summary: request.instruction || '外部 AI 编辑提案', explanation: '外部 AI 提供了完整文件草稿，LingBuilder 仅创建可预览提案。', files: proposedFiles, designerProject: request.updatedDesignerProject };
    if (draft.designerProject) await this.assertDesignerProjectRegistered(draft.designerProject.id);
    const proposal = proposeLingCppEdit(context, draft);
    if (this.options.agentProposalHandoff) {
      // 内嵌 Agent 的 MCP 子进程与 IDE 本地服务是两个进程，进程内提案 store 不共享：
      // 落工作区交接目录后，面板才能按同一 proposalId 取回并在用户确认后代执行 apply。
      await persistAgentProposal(this.workspaceRoot, proposal);
    }
    // 响应瘦身：草稿全文不回传（服务端已留存，apply 只需 proposalId）。
    return {
      ok: true,
      proposal: {
        id: proposal.id,
        title: proposal.title,
        summary: proposal.summary,
        createdAt: proposal.createdAt,
        designerChanged: Boolean(proposal.designerProject),
        changes: proposal.changes.map(change => ({
          filePath: change.filePath,
          startLine: change.range.startLine,
          endLine: change.range.endLine
        }))
      }
    };
  }

  async applyEdit(request: AiBridgeEditApplyRequest): Promise<{ ok: true } & AiBridgeEditApplyResult> {
    const proposal = await this.resolveEditProposal(request.proposalId);
    if (!proposal) throw new Error('未找到编辑提案。');

    await this.requireWriteWithAudit('edit.apply', request.proposalId, request.approved);
    const workspaceFiles = await this.resolveApplyWorkspaceFiles(request);
    const appliedFiles = applyWorkspaceEditToFiles(workspaceFiles, proposal);
    const gateContext = await this.resolveWindowProjectForApply(proposal, appliedFiles);
    if (gateContext) {
      await this.assertControlReferencesInDesigner({ ...gateContext, actionLabel: 'lingbuilder.edit.apply' });
    }
    const persistedFiles: Array<{ filePath: string; sourceCode: string; absolutePath: string }> = [];
    const staged: Array<{ file: typeof appliedFiles[number]; absolutePath: string; temporaryPath: string; original?: Buffer }> = [];
    let appliedDesignerProject = proposal.designerProject;

    if (proposal.designerProject) {
      const projectRef = await this.resolveAssetProject(proposal.designerProject);
      await this.assertDesignerProjectRegistered(proposal.designerProject.id);
      // Always re-read the persisted model. A caller-provided snapshot is only
      // an assertion of what it observed, never an authority that can bypass
      // external edits made after the proposal was created.
      const currentDesignerProject = await this.solutionService.readDesignerProject(projectRef);
      if (request.designerProject !== undefined) {
        assertDesignerProjectShape(request.designerProject, 'designerProject');
        if (!areDesignerProjectsEquivalent(request.designerProject, currentDesignerProject)) {
          throw new Error('提交应用的窗口设计器模型与磁盘版本不一致，请重新读取并生成提案。');
        }
      }
      if (proposal.designerProjectOriginal && !areDesignerProjectsEquivalent(currentDesignerProject, proposal.designerProjectOriginal)) {
        throw new Error('窗口设计器模型在 AI 提案生成后已发生变化，请重新生成提案。');
      }
      // 与服务端 apply 一致：复用提案生成时校验通过的允许类型集合，
      // 避免模块贡献控件（如 FBroBrowser）在应用阶段被默认集合误拒。
      validateDesignerProjectEdit(proposal.designerProjectOriginal, currentDesignerProject, {
        allowedControlTypes: proposal.designerAllowedControlTypes
          ? new Set(proposal.designerAllowedControlTypes)
          : undefined
      });
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

    for (const file of appliedFiles) await this.assertDesignerFileWriteAllowed(file.filePath);
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
    if (this.options.agentProposalHandoff) {
      // 交接目录里只留未应用的提案：一旦落盘成功立即删除，避免源码草稿长期驻留工作区。
      await deleteAgentProposal(this.workspaceRoot, request.proposalId).catch(() => undefined);
    }
    return {
      ok: true,
      appliedFiles: persistedFiles.map(file => ({ filePath: file.filePath, bytes: Buffer.byteLength(file.sourceCode, 'utf8') })),
      ...(appliedDesignerProject ? { designerProjectId: appliedDesignerProject.id } : {}),
      message: persistedFiles.length > 0
        ? `已应用 ${persistedFiles.length} 个文件的修改${appliedDesignerProject ? '，窗口设计器布局已同步更新' : ''}。`
        : appliedDesignerProject
          ? '窗口设计器布局已同步更新（本次源码未改动）。'
          : 'AI 提案未产生任何文件改动。',
    };
  }

  async listModules(projectId = 'lingbuilder-ui-project') {
    const [availableModules, enabledModules, history] = await Promise.all([
      this.moduleService.scanInstalledModules(projectId),
      this.moduleService.getEnabledProjectModules(projectId),
      this.moduleService.getHistory()
    ]);
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    const enabledIds = new Set(enabledModules.map(module => module.manifest.id));
    // 完整 manifest（new_emoji 一家就有 4000+ 条命令、6MB+ JSON）绝不整体返回；
    // 未启用模块只用一行紧凑字符串列出（id + 名称 + 版本 + 命令数），
    // 外部 AI 需要命令签名时用 lingbuilder.module.info 按 moduleId 单查。
    const summarize = (module: (typeof availableModules)[number]) => ({
      id: module.manifest.id,
      name: module.manifest.name,
      version: module.manifest.version,
      commandCount: (module.manifest.contributes?.commands || []).length,
      docs: (module.manifest.contributes?.docs || []).slice(0, 3).map(doc => doc.path),
      diagnostics: module.diagnostics
    });
    const describeCompact = (module: (typeof availableModules)[number]) => {
      const suffix = module.diagnostics.length > 0 ? ' · 诊断异常' : '';
      return `${module.manifest.id} · ${module.manifest.name} v${module.manifest.version} · ${(module.manifest.contributes?.commands || []).length} 命令${suffix}`;
    };
    const recentHistory = history.slice(0, 5);
    return {
      ok: true,
      totalCount: availableModules.length,
      enabledCount: enabledModules.length,
      availableModules: availableModules
        .filter(module => !enabledIds.has(module.manifest.id))
        .map(describeCompact),
      enabledModules: enabledModules.map(summarize),
      history: recentHistory,
      historyTruncated: history.length > recentHistory.length,
      hint: 'enabledModules 为已启用模块摘要；availableModules 为未启用模块的一行摘要（含模块 ID）。需要某个模块的完整命令签名、参数说明和示例时，调用 lingbuilder.module.info 传 moduleId 单查。'
    };
  }

  async getModuleInfo(request: AiBridgeModuleInfoRequest) {
    const moduleId = String(request.moduleId || '').trim();
    if (!moduleId) throw new Error('必须提供要查询的 moduleId，例如 lingbuilder.database.sqlite。');
    const projectId = request.projectId?.trim() || 'lingbuilder-ui-project';
    const availableModules = await this.moduleService.scanInstalledModules(projectId);
    const found = availableModules.find(module => module.manifest.id.toLowerCase() === moduleId.toLowerCase());
    if (!found) {
      const candidates = availableModules
        .map(module => module.manifest.id)
        .filter(id => id.toLowerCase().includes(moduleId.toLowerCase()))
        .slice(0, 8);
      throw new Error(`未找到模块「${moduleId}」。${candidates.length ? `相近模块：${candidates.join('、')}。` : '请先用 lingbuilder.modules.list 查看可用模块。'}`);
    }
    const manifest = found.manifest;
    const query = request.query?.trim().toLowerCase() || '';
    const filteredCommands = (manifest.contributes?.commands || [])
      .filter(command => command.visibility !== 'internal')
      .filter(command => request.includeAdvanced === true || command.visibility !== 'advanced')
      .filter(command => !query
        || command.name.toLowerCase().includes(query)
        || (command.description || '').toLowerCase().includes(query));
    // 真实调用示例只在结果集有限时逐条附带：整模块全量查询时它会白白撑爆响应。
    const demoCorpus = await loadDemoCorpus(this.workspaceRoot, manifest.id);
    const withDemoExamples = filteredCommands.length <= DEMO_EXAMPLE_MAX_COMMANDS;
    const commands = filteredCommands.map(command => {
      const binding = manifest.bindings?.commands?.find(item => item.command === command.name);
      return {
        name: command.name,
        signature: command.signature,
        returnType: command.returnType,
        returnDescription: command.returnDescription,
        description: command.description,
        visibility: command.visibility,
        parameters: parseModuleCommandParameterDocs(command, binding),
        example: command.insertText || command.signature,
        // 未命中演示语料时不下发空字段，避免外部 AI 把 null 当成「该命令不可用」。
        ...(withDemoExamples && demoCorpus?.invocations.has(command.name)
          ? { demoExample: demoCorpus.invocations.get(command.name) }
          : {})
      };
    });
    const MAX_COMMANDS = 500;
    const truncated = commands.length > MAX_COMMANDS;
    const componentGuides = await loadComponentGuides(found);
    const designerControls = buildDesignerControlSummaries(manifest, componentGuides);
    const uiExamples = await collectUiExamples(found, this.workspaceRoot);
    const exampleFilter = request.example?.trim() || '';
    const matchedExample = exampleFilter ? matchUiExample(uiExamples, exampleFilter) : undefined;
    if (exampleFilter && !matchedExample) {
      throw new Error(`未找到匹配「${exampleFilter}」的示例。可用示例：${uiExamples.map(example => example.title).join('、') || '该模块暂无登记示例。'}`);
    }
    const exampleContent = matchedExample
      ? await readUiExampleContent(found, this.workspaceRoot, matchedExample)
      : null;
    const controlFilter = request.control?.trim() || '';
    const controlDetails = controlFilter ? buildDesignerControlDetails(manifest, controlFilter, componentGuides) : null;
    const singleControl = controlDetails && controlDetails.matched === 1 ? controlDetails.details[0] : undefined;
    const controlGuide = singleControl?.documentation
      ? await readComponentGuide(found, singleControl.documentation)
      : null;
    if (controlFilter && controlDetails && controlDetails.matched === 0) {
      const available = designerControls.slice(0, 12).map(control => control.label).join('、');
      throw new Error(`设计器控件中没有任何项匹配「${controlFilter}」。该模块控件示例：${available}${designerControls.length > 12 ? `…（共 ${designerControls.length} 个）` : ''}。`);
    }
    return {
      ok: true,
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      category: manifest.category,
      tags: manifest.tags,
      isBuiltin: found.isBuiltin === true,
      enabled: found.isEnabledForProject === true,
      installPath: found.installPath,
      diagnostics: found.diagnostics,
      targets: (manifest.targets || []).map(target => ({
        id: target.id, platform: target.platform, arch: target.arch, toolchain: target.toolchain
      })),
      types: (manifest.contributes?.types || []).map(type => ({ name: type.name, description: type.description })),
      constants: (manifest.contributes?.constants || []).map(constant => ({
        name: `#${constant.name}`,
        type: constant.type,
        value: constant.value,
        description: constant.description,
        level: constant.level === 'advanced' ? 'advanced' : 'basic'
      })),
      docs: (manifest.contributes?.docs || []).map(doc => ({ title: doc.title, path: doc.path })),
      // control 已锁定具体控件时不再重复回整套概览（概览单项就有 ~20KB）。
      designerControls: controlFilter ? [] : designerControls.slice(0, DESIGNER_CONTROL_SUMMARY_MAX),
      designerControlsTotal: designerControls.length,
      ...(designerControls.length > DESIGNER_CONTROL_SUMMARY_MAX
        ? { designerControlsHint: `控件数超过 ${DESIGNER_CONTROL_SUMMARY_MAX}，概览已截断；用 control 参数按控件类型或中文名过滤可拿到完整属性、事件与代码创建契约。` }
        : {}),
      ...(controlDetails ? {
        designerControlMatched: controlDetails.matched,
        designerControlDetails: controlDetails.details,
        ...(controlDetails.matched > DESIGNER_CONTROL_DETAIL_MAX
          ? { designerControlDetailHint: `匹配 ${controlDetails.matched} 个控件，详情只返回前 ${DESIGNER_CONTROL_DETAIL_MAX} 个；请收窄 control 过滤词。` }
          : {})
      } : {}),
      ...(controlGuide ? {
        componentGuide: {
          path: singleControl?.documentation || '',
          nativePath: singleControl?.nativeDocumentation || '',
          absolutePath: controlGuide.absolutePath,
          truncated: controlGuide.truncated,
          content: controlGuide.content
        }
      } : {}),
      uiExamples: uiExamples.map(example => ({
        title: example.title,
        path: example.path,
        source: example.source,
        scenario: example.scenario || example.description,
        commands: (example.commands || []).slice(0, 16),
        notes: example.notes
      })),
      ...(matchedExample && exampleContent ? {
        uiExample: {
          title: matchedExample.title,
          path: matchedExample.path,
          source: matchedExample.source,
          absolutePath: exampleContent.absolutePath,
          truncated: exampleContent.truncated,
          content: exampleContent.content
        }
      } : {}),
      ...(demoCorpus ? {
        demoProject: {
          projectId: demoCorpus.projectId,
          commandCount: demoCorpus.commandCount,
          generatedAt: demoCorpus.generatedAt,
          groupCount: demoCorpus.groupCount,
          sourceRoot: demoCorpus.sourceRoot,
          designerModelPath: demoCorpus.projectId ? `.lingbuilder/projects/${demoCorpus.projectId}/window-designer.json` : '',
          sourcePackage: demoCorpus.packageName,
          stale: demoCorpus.commandCount !== (manifest.contributes?.commands || []).length,
          hint: '该模块的全量逐命令演示项目，demoExample 取自其中。未附带 demoExample 只表示语料未覆盖该命令（语料过期或命令较新），不代表命令不可用；需要刷新时执行 npm run module:demos -w lingbuilder-electron。要成段可读源码用 lingbuilder.file.read 读 <sourceRoot>/MainWindow.lcpp（文件很大，按需读取）。'
        }
      } : {}),
      commandsTotal: (manifest.contributes?.commands || []).length,
      // 只查界面视图时不回命令表：500 条命令文档就有 ~350KB，会把外部 AI 上下文直接占满。
      commandsMatched: controlFilter || exampleFilter ? 0 : commands.length,
      commandsTruncated: !controlFilter && !exampleFilter && truncated,
      commands: controlFilter || exampleFilter ? [] : (truncated ? commands.slice(0, MAX_COMMANDS) : commands),
      ...(controlFilter || exampleFilter
        ? { commandsSkippedHint: '本次按 control/example 查询界面视图，未返回命令表（命令文档体量很大）；需要命令请用 query 单独查询。' }
        : {}),
      ...(truncated && !controlFilter && !exampleFilter ? { truncationHint: `命令数超过 ${MAX_COMMANDS}，已截断；请用 query 参数按命令名过滤后分批查询。` } : {}),
      hint: '参数类型为 controlRef 的参数必须传裸控件名（不带引号）；类型为 handler 的处理器参数必须传 &处理器名；constants 为模块公开常量，源码中必须用 #常量名 引用（不带引号）。designerControls 是该模块贡献到设计器的控件概览（含代码创建命令与类型）；要某个控件的完整属性/事件/布局契约就传 control，要成段可用源码就传 example（按标题或序号命中 uiExamples 里的示例正文）。'
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
    const category = typeof request.category === 'string' ? request.category.trim() : '';
    if (category && !(LINGBUILDER_MODULE_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(`模块分类只允许：${LINGBUILDER_MODULE_CATEGORIES.join('、')}。`);
    }
    await this.requireWriteWithAudit('module.scaffold', `.lingbuilder/module-build/${moduleId}`, request.approved);
    const outDirRelative = request.outDir?.trim() || `.lingbuilder/module-build/${moduleId}`;
    const outDir = await this.resolveModuleAreaWriteDirectory(outDirRelative, 'module-build');
    const manifest = await createModuleTemplate({
      template: request.template?.trim() || 'cpp-source',
      outDir,
      id: moduleId,
      name: request.name?.trim() || undefined,
      category: category || undefined,
      description: typeof request.description === 'string' ? request.description.trim() || undefined : undefined
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
      // 响应瘦身：已应用时不重复返回 preview，文件只留元数据（完整内容已落盘，可用 file.read 读取），
      // 否则外部 AI 每次创建项目都要吞下双份模板全文。
      const slimResult = {
        template: result.template,
        project: result.project,
        ...(result.designerProject ? { designerProject: result.designerProject } : {}),
        modules: result.modules,
        navigation: result.navigation,
        receipt: result.receipt,
        files: result.files.map(file => ({ relativePath: file.relativePath, kind: file.kind, bytes: file.bytes })),
        message: result.message
      };
      return { ok: true as const, applied: true as const, result: slimResult };
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

  /**
   * 解析项目的生成产物形态：windows-console 项目使用控制台入口（wmain + “公开 启动()”），
   * dll 输出使用动态库入口（DllMain + 导出包装），其余为窗口应用（wWinMain + 消息循环）。
   */
  private async resolveProjectOutputKind(projectId: string): Promise<'application' | 'dynamic-library' | 'console-application'> {
    try {
      const solutionForOutputType = await this.solutionService.getSolution();
      const recordForOutputType = solutionForOutputType.projects.find(item => item.id === projectId);
      if (recordForOutputType?.type === 'windows-console') return 'console-application';
      return recordForOutputType?.buildProperties?.outputType === 'dll' ? 'dynamic-library' : 'application';
    } catch {
      // 解决方案尚未建立时按窗口应用模式处理。
      return 'application';
    }
  }

  /** 与 IDE F5 同口径：读取解决方案项目记录的 requireAdministrator，决定生成的 exe 是否请求管理员权限（UAC）。 */
  private async resolveProjectRequireAdministrator(projectId: string): Promise<boolean> {
    try {
      const solution = await this.solutionService.getSolution();
      const record = solution.projects.find(item => item.id === projectId);
      return record?.buildProperties?.requireAdministrator === true;
    } catch {
      // 解决方案尚未建立时按 asInvoker 处理。
      return false;
    }
  }

  /**
   * 控件引用门禁（apply/build 共用）：窗口项目的最终源码引用了设计器模型不存在的控件
   * （controlRef 缺失/歧义/越界/带引号等 error 级诊断）时阻断，杜绝「源码有控件、设计器没有」
   * 导致 IDE 画布空白、生成 exe 无控件的脱节状态。
   */
  private async assertControlReferencesInDesigner(request: {
    projectId: string;
    designerProject: LingWindowProject | undefined;
    sources: Array<{ filePath: string; sourceCode: string }>;
    actionLabel: string;
  }): Promise<void> {
    if (!request.designerProject) return;
    const moduleContext = await this.getModuleContext(request.projectId);
    const problems = collectControlReferenceAdmissionProblems({
      designerProject: request.designerProject,
      sources: request.sources,
      moduleContext
    });
    if (problems.length > 0) {
      throw new Error(formatControlReferenceAdmissionBlock(request.actionLabel, problems));
    }
  }

  /** edit.apply 门禁上下文：按提案模型 ID 或变更 .lcpp 的 sourceRoot 最长前缀解析窗口项目，并合并「磁盘 + 提案后」最终源码。解析不出窗口项目则跳过门禁。 */
  private async resolveWindowProjectForApply(
    proposal: NonNullable<ReturnType<typeof getWorkspaceEditProposal>>,
    appliedFiles: Array<{ filePath: string; sourceCode: string }>
  ): Promise<{ projectId: string; designerProject: LingWindowProject; sources: Array<{ filePath: string; sourceCode: string }> } | undefined> {
    try {
      const solution = await this.solutionService.getSolution();
      const directId = typeof proposal.designerProject?.id === 'string' ? proposal.designerProject.id : '';
      let projectRef = directId ? solution.projects.find(item => item.id === directId) : undefined;
      if (!projectRef) {
        const firstSource = appliedFiles.find(file => file.filePath.toLocaleLowerCase().endsWith('.lcpp'));
        if (firstSource) {
          const filePath = normalizeFilePath(firstSource.filePath);
          let bestLength = -1;
          for (const candidate of solution.projects) {
            const root = normalizeFilePath(candidate.sourceRoot || '');
            if (!root || root === '.') continue;
            if ((filePath === root || filePath.startsWith(`${root}/`)) && root.length > bestLength) { projectRef = candidate; bestLength = root.length; }
          }
        }
      }
      if (!projectRef) return undefined;
      const snapshot = await this.solutionService.readDesignerProjectSnapshot(projectRef);
      const designerProject = (proposal.designerProject as LingWindowProject | undefined) ?? (snapshot.persisted ? snapshot.project : undefined);
      if (!designerProject) return undefined;
      const diskFiles = await this.solutionService.readProjectFiles(projectRef);
      const overrides = new Map(appliedFiles.map(file => [normalizeFilePath(file.filePath).toLocaleLowerCase(), file.sourceCode]));
      const sources = Object.entries(diskFiles).map(([filePath, sourceCode]) => ({
        filePath: normalizeFilePath(filePath),
        sourceCode: String(overrides.get(normalizeFilePath(filePath).toLocaleLowerCase()) ?? sourceCode ?? '')
      }));
      for (const file of appliedFiles) {
        const filePath = normalizeFilePath(file.filePath);
        if (!sources.some(source => source.filePath === filePath)) sources.push({ filePath, sourceCode: file.sourceCode });
      }
      return { projectId: projectRef.id, designerProject, sources };
    } catch {
      return undefined;
    }
  }

  /**
   * 构建/预览/导出的设计器模型解析：显式传入完整 project 优先；缺省按 projectId 读取磁盘快照。
   * 外部 AI 因此不必每次重发全量模型——磁盘模型即 IDE 设计器的权威状态。
   */
  private async resolveNativeDesignerProject(
    request: { project?: LingWindowProject; projectId?: string },
    toolLabel: string
  ): Promise<LingWindowProject> {
    if (request.project !== undefined) {
      assertDesignerProjectShape(request.project, 'project');
      return request.project;
    }
    const projectId = typeof request.projectId === 'string' ? request.projectId.trim() : '';
    if (!projectId) {
      throw new Error(`${toolLabel} 需要 project（完整设计器模型）或 projectId（按已注册项目读取磁盘模型）二者之一；推荐只传 projectId。`);
    }
    const solution = await this.solutionService.getSolution();
    const projectRef = solution.projects.find(item => item.id === projectId);
    if (!projectRef) throw new Error(`项目“${projectId}”未在解决方案（.lingbuilder/solution.json）中注册，无法读取磁盘设计器模型。`);
    const snapshot = await this.solutionService.readDesignerProjectSnapshot(projectRef);
    if (!snapshot.persisted) {
      throw new Error(`项目“${projectId}”的磁盘设计器模型缺失或无效（${projectRef.designerPath}）；请先通过 edit.apply 同步布局或重新创建项目。`);
    }
    return snapshot.project;
  }

  async nativePreview(request: AiBridgeNativeRequest) {
    request.project = await this.resolveNativeDesignerProject(request, 'lingbuilder.native.preview');
    const projectId = request.project.id || 'lingbuilder-ui-project';
    const [enabledModules, lingCppSources] = await Promise.all([
      this.moduleService.getEnabledProjectModules(projectId),
      this.resolveLingCppProjectSources(projectId, request.lingCppSources)
    ]);
    await this.assertControlReferencesInDesigner({ projectId, designerProject: request.project, sources: lingCppSources, actionLabel: 'lingbuilder.native.preview' });
    this.assertModuleAccess(enabledModules.map(module => module.manifest.id));
    await this.requireSdkDependencies(enabledModules.map(module => module.manifest.id));
    // 与 executeBuildRun 同口径：预览产物跟随解决方案项目记录的输出形态（窗口应用缺省 / dll / 控制台）。
    const previewOutputKind = await this.resolveProjectOutputKind(projectId);
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      lingCppSources,
      enabledModules,
      outputKind: previewOutputKind,
      requireAdministrator: await this.resolveProjectRequireAdministrator(projectId)
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
    const designerMismatchWarning = await this.describeDesignerModelMismatchWarning(request.project);
    return {
      ok: true,
      generatedFiles: generatedProject.files,
      files,
      diagnostics: [...generatedProject.diagnostics, ...codeGeneratorResult.diagnostics, ...(designerMismatchWarning ? [designerMismatchWarning] : [])],
      blockingDiagnostics: generatedProject.blockingDiagnostics,
      selectedWindow: generatedProject.selectedWindow,
      enabledModules,
      logs: [...codeGeneratorResult.logs, ...(designerMismatchWarning ? [designerMismatchWarning] : [])],
      codeGenerators: {
        fingerprint: codeGeneratorResult.fingerprint,
        incrementalHit: codeGeneratorResult.incrementalHit,
        artifacts: codeGeneratorResult.artifacts.map(({ relativePath, kind, size, sha256 }) => ({ relativePath, kind, size, sha256 }))
      }
    };
  }

  async nativeExport(request: AiBridgeNativeRequest) {
    request.project = await this.resolveNativeDesignerProject(request, 'lingbuilder.native.export');
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
      let previewExecutableBaseName = 'LingBuilderPreview';
      try {
        const exportSolution = await this.solutionService.getSolution();
        const exportProjectRecord = exportSolution.projects.find(item => item.id === (request.project.id || 'window-preview'));
        previewExecutableBaseName = resolveExecutableNameParts(exportProjectRecord?.buildProperties?.executableName).baseName;
      } catch {
        // 解决方案尚未建立或名称非法时按默认命名导出。
      }
      const visualStudioProject = await exportVisualStudioProject({
        projectDir: exportDir,
        projectId: request.project.id || 'window-preview',
        executableBaseName: previewExecutableBaseName,
        generatedFiles,
        enabledModules: preview.enabledModules,
        contentFiles: [
          ...copiedAssets.map(file => normalizeFilePath(path.relative(exportDir, file))),
          ...executableIcon.files.map(file => normalizeFilePath(path.relative(exportDir, file))),
          ...codeGeneratorResult.artifacts
            .filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime')
            .map(artifact => normalizeFilePath(artifact.relativePath))
        ],
        requireAdministrator: await this.resolveProjectRequireAdministrator(request.project.id || 'window-preview')
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
    // captureAdmission 必须保持在第一个 await 之前：跨入口停止代次竞态检测依赖这个同步前缀。
    const projectId = sanitizeFilename((request.project?.id || request.projectId || 'window-preview').trim());
    const buildAdmission = this.projectBuildCoordinator.captureAdmission(projectId);
    request.project = await this.resolveNativeDesignerProject(request, 'lingbuilder.build.run');
    await this.requireExecuteWithAudit('build.run', request.project?.id, request.approved);
    if (this.runAdmissionClosed || this.shuttingDown) {
      return await this.createCancelledBuildResult(
        projectId,
        this.shuttingDown ? 'AI Bridge 正在关闭。' : 'AI Bridge 正在停止受控运行任务。'
      );
    }
    await this.assertControlReferencesInDesigner({
      projectId: request.project.id || projectId,
      designerProject: request.project,
      sources: await this.resolveLingCppProjectSources(request.project.id || projectId, request.lingCppSources),
      actionLabel: 'lingbuilder.build.run'
    });

    let buildLease: ProjectBuildLease | undefined;
    let preBuildLogs: string[] = [];
    try {
      const buildSession = await this.projectBuildSessionService.begin(projectId, buildAdmission);
      buildLease = buildSession.lease;
      if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
      const designerMismatchWarning = await this.describeDesignerModelMismatchWarning(request.project);
      if (designerMismatchWarning) preBuildLogs = [...preBuildLogs, designerMismatchWarning];
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

  /** 停止单个项目的受控运行进程；停止操作不新增任何写入或执行，只回收 Bridge 自己启动的进程，所有权限模式都可用。 */
  async stopRun(projectId?: string) {
    const rawProjectId = String(projectId || '').trim();
    if (!rawProjectId) throw new Error('必须提供要停止运行的项目 ID（project.create 返回的 project.id）。');
    const normalizedProjectId = sanitizeFilename(rawProjectId);
    this.projectBuildCoordinator.cancel(normalizedProjectId, 'user');
    const stopped = await this.managedProcessService.stop(normalizedProjectId);
    await this.permissions.audit({ operation: 'execute', action: 'build.stop', ok: stopped.stopped || !stopped.found, target: normalizedProjectId });
    return stopped;
  }

  async waitForRun(projectId?: string, timeoutSeconds?: number) {
    const rawProjectId = String(projectId || '').trim();
    if (!rawProjectId) throw new Error('必须提供要等待的项目 ID（project.create 返回的 project.id）。');
    const normalizedProjectId = sanitizeFilename(rawProjectId);
    const requestedSeconds = Number(timeoutSeconds);
    const timeoutMs = Number.isFinite(requestedSeconds) && requestedSeconds > 0
      ? Math.min(Math.trunc(requestedSeconds), 600) * 1000
      : 30_000;
    const status = this.managedProcessService.getStatus
      ? this.managedProcessService.getStatus(normalizedProjectId)
      : null;
    if (!status) {
      return {
        projectId: normalizedProjectId,
        found: false,
        message: `项目“${normalizedProjectId}”当前没有受控运行进程。`
      };
    }
    if (!this.managedProcessService.waitForExit) {
      return { projectId: normalizedProjectId, found: true, running: true, status, message: '当前进程管理器不支持等待运行结束。' };
    }
    const exit = await Promise.race([
      this.managedProcessService.waitForExit(normalizedProjectId).then(result => ({ result })),
      new Promise<{ result?: undefined }>(resolve => {
        const timer = setTimeout(() => resolve({}), timeoutMs);
        timer.unref?.();
      })
    ]);
    if (!exit.result) {
      return {
        projectId: normalizedProjectId,
        found: true,
        running: true,
        pid: status.pid,
        message: `等待超时（${Math.round(timeoutMs / 1000)} 秒）：项目“${normalizedProjectId}”的运行进程仍在运行（PID ${status.pid}）。可用 lingbuilder.run.log 查看输出，或 lingbuilder.build.stop 停止。`
      };
    }
    return { projectId: normalizedProjectId, ...exit.result };
  }

  async readRunLog(projectId?: string, tailLines?: number) {
    const rawProjectId = String(projectId || '').trim();
    if (!rawProjectId) throw new Error('必须提供要读取运行日志的项目 ID（project.create 返回的 project.id）。');
    const normalizedProjectId = sanitizeFilename(rawProjectId);
    const status = this.managedProcessService.getStatus
      ? this.managedProcessService.getStatus(normalizedProjectId)
      : null;
    const logFilePath = status?.logFilePath || this.lastRunLogPaths.get(normalizedProjectId);
    if (!logFilePath) {
      return {
        projectId: normalizedProjectId,
        ok: false,
        logFilePath: undefined,
        content: '',
        message: `项目“${normalizedProjectId}”还没有受控运行记录；先用 lingbuilder.build.run（run=true）启动一次。`
      };
    }
    let content = '';
    try {
      content = await fs.readFile(logFilePath, 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return {
          projectId: normalizedProjectId,
          ok: true,
          logFilePath,
          content: '',
          running: Boolean(status),
          message: '运行日志文件尚未生成（GUI 程序通常没有控制台输出）。'
        };
      }
      throw error;
    }
    const requestedTail = Number(tailLines);
    const tail = Number.isFinite(requestedTail) && requestedTail > 0 ? Math.min(Math.trunc(requestedTail), 1000) : 200;
    const lines = content.split(/\r?\n/);
    const truncated = lines.length > tail;
    const visibleLines = truncated ? lines.slice(-tail) : lines;
    return {
      projectId: normalizedProjectId,
      ok: true,
      logFilePath,
      running: Boolean(status),
      totalLines: lines.length,
      truncated,
      content: visibleLines.join('\n')
    };
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
    // 项目级 DLL 命令声明：扫描全部源码解析声明库（虚拟模块由生成器内部合成，这里准备物化数据）。
    const projectDllLibraries = lingCppSources.flatMap(source => parseLingCpp(source.sourceCode).program.dllLibraries || []);
    // 输出形态来自解决方案项目记录（windows-console / buildProperties.outputType）；
    // 必须在生成前解析：DLL 模式生成 DllMain + “公开”子程序导出包装，控制台模式生成 wmain + “启动()”入口。
    const outputKind = await this.resolveProjectOutputKind(buildLease.projectId);
    // 与 IDE F5 同口径：requireAdministrator 提前解析，供 VS 工程导出与直编链接参数共用。
    const requireAdministrator = await this.resolveProjectRequireAdministrator(buildLease.projectId);
    const outputType: 'exe' | 'dll' = outputKind === 'dynamic-library' ? 'dll' : 'exe';
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      lingCppSources,
      enabledModules,
      outputKind,
      requireAdministrator: await this.resolveProjectRequireAdministrator(buildLease.projectId)
    });
    if (generatedProject.blockingDiagnostics.length > 0) {
      throw new Error(`LCPP 项目源码存在阻止构建的错误：\n${generatedProject.blockingDiagnostics.join('\n')}`);
    }
    const managedProjectId = buildLease.projectId;
    const projectId = sanitizeFilename(managedProjectId);
    // 与 IDE F5 相同的目录解析规则：项目模板覆盖工作区默认，再回退内置缺省。
    const buildConfiguration = await this.buildConfigurationService.read();
    let pathTemplateOverrides: { projectName?: string; buildDirectory?: string; generatedSourceDirectory?: string } = {};
    let executableNameParts = { baseName: 'LingBuilderPreview', fileName: 'LingBuilderPreview.exe' };
    try {
      const solution = await this.solutionService.getSolution();
      const projectRecord = solution.projects.find(item => item.id === managedProjectId);
      if (projectRecord) {
        pathTemplateOverrides = {
          projectName: projectRecord.name,
          buildDirectory: projectRecord.buildProperties?.buildDirectory?.trim() || buildConfiguration.buildDirectory,
          generatedSourceDirectory: projectRecord.buildProperties?.generatedSourceDirectory?.trim() || buildConfiguration.generatedSourceDirectory
        };
        try {
          executableNameParts = resolveExecutableNameParts(projectRecord.buildProperties?.executableName, outputType);
        } catch (nameError) {
          preBuildLogs.push(nameError instanceof Error ? nameError.message : '项目可执行文件名无效，已回退默认命名。');
        }
      }
    } catch {
      // 解决方案尚未建立时按工作区默认目录构建。
    }
    const resolvedBuildPaths = resolveProjectBuildDirectories({
      workspaceRoot: this.workspaceRoot,
      projectDirName: projectId,
      projectName: pathTemplateOverrides.projectName,
      platform: buildConfiguration.architecture,
      configuration: buildConfiguration.mode,
      templates: {
        buildDirectory: pathTemplateOverrides.buildDirectory,
        generatedSourceDirectory: pathTemplateOverrides.generatedSourceDirectory
      }
    });
    const [buildDir, exportDir] = await Promise.all([
      this.pathPolicy.resolveDirectoryForWrite(resolvedBuildPaths.relativeBuildDir),
      this.pathPolicy.resolveDirectoryForWrite(resolvedBuildPaths.relativeExportDir)
    ]);
    const sourceDir = path.join(buildDir, 'src');
    const binDir = path.join(buildDir, 'bin');
    const objDir = path.join(buildDir, 'obj');
    // These directories contain only reproducible build products. Recreate
    // them so disabled modules cannot leave stale DLLs, libs or sources in a
    // later build (for example after switching away from new_emoji).
    // objDir 例外：保留作为编译缓存目录（按源码内容+编译参数指纹复用 obj），
    // 陈旧 obj 由编译阶段按本次编译清单清理，禁用模块不会留下参与链接的产物。
    await Promise.all([
      fs.rm(binDir, { recursive: true, force: true }),
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
      if (executableNameParts.fileName !== 'LingBuilderPreview.exe') {
        await fs.rm(path.join(binDir, executableNameParts.fileName), { force: true });
      }
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
          logs: [...preBuildLogs, `代码生成阶段失败：${reason}`]
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }
    const generatedCodegenFiles = codeGeneratorResult.textFiles;
    const copiedAssets = await this.designerAssetService.copyProjectAssets(projectRef, [buildDir, binDir, exportDir]);
    const executableIcon = await this.windowsExecutableIconService.materialize(projectRef, generatedProject.selectedWindow, [buildDir, exportDir, sourceDir], { embeddedResourceSpecs: getEmbeddedResourceSpecsForBuild(request.project) });
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
    // 项目级 DLL 命令声明物化：声明头 + 按实际导出表生成导入库 + DLL 拷到 exe 目录。
    const projectDllBuildNotes: string[] = [];
    if (projectDllLibraries.length > 0) {
      const projectDllSourceRoot = path.resolve(this.workspaceRoot, projectRef.sourceRoot || 'src');
      const { blocking: projectDllBlocking, libFiles: projectDllLibFiles, notes: projectDllNotes } = await materializeProjectDllDeclarationModules({
        dllLibraries: projectDllLibraries,
        sourceRootAbsolute: projectDllSourceRoot,
        buildDir,
        sourceDir,
        binDir,
        exportDir,
        machine: preferredTargetId === 'windows-msvc-x64' ? 'X64' : 'X86',
        logs: []
      });
      moduleNativePlan.blockingDiagnostics.push(...projectDllBlocking);
      moduleNativePlan.libFiles.push(...projectDllLibFiles);
      projectDllBuildNotes.push(...projectDllNotes);
    }
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
    // descriptor / runtime 产物（如 protobuf descriptor.pb）是 exe 运行期输入，
    // F5 直接编译路径不经过 msbuild 的 contentFiles 复制，这里显式落进 exe 目录。
    for (const artifact of codeGeneratorResult.artifacts.filter(item => item.kind === 'descriptor' || item.kind === 'runtime')) {
      const target = path.join(binDir, artifact.relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(artifact.absolutePath, target);
    }
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
      projectKind: outputKind,
      fbroRuntimeFromBuildBin: true,
      executableBaseName: executableNameParts.baseName,
      requireAdministrator
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId,
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles],
      enabledModules,
      contentFiles: [...exportContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(artifact.relativePath))],
      requiredCppStandard: moduleNativePlan.requiredCppStandard,
      requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt,
      projectKind: outputKind,
      executableBaseName: executableNameParts.baseName,
      requireAdministrator
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
      ...projectDllBuildNotes,
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
          logs: [
          ...baseLogs,
          '未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。'
        ]
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }

    const sourcePath = path.join(sourceDir, 'main.cpp');
    const exePath = path.join(binDir, executableNameParts.fileName);
    const executableResourcePath = generatedProject.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)
      ? path.join(sourceDir, WINDOWS_EXECUTABLE_RESOURCE_FILE)
      : undefined;
    // new_emoji 运行时 DLL 内嵌：把按目标架构解析出的 DLL 以 RCDATA 资源追加进图标 rc，
    // 配合 main.cpp 中的延迟加载钩子（首次 EU_* 调用时解压到 EXE 目录后 LoadLibrary），
    // 生成单文件即可运行的 EXE。资源缺失时钩子自动回退为同目录加载。
    const newEmojiRuntimeDllBase = moduleNativePlan.runtimeFiles.find(file => path.basename(file).toLowerCase() === 'new_emoji.dll');
    // 内嵌源必须与编译器实际位数一致：CLI 默认编译器是 x64 而 buildDir 目录名可能仍是
    // Win32（目录名只反映构建配置），按目录名猜架构会把 32 位 DLL 内嵌进 64 位 EXE。
    // 因此以 preferredTargetId（已按 compiler.arch 选择）为准，优先取模块安装目录中
    // 对应架构子目录的 DLL；缺失时回退 runtimeFiles 已按同一 target 复制进 bin 的副本。
    let newEmojiRuntimeDll = newEmojiRuntimeDllBase;
    const newEmojiModule = enabledModules.find(module => module.manifest.id === 'lingbuilder.new_emoji.ui');
    const newEmojiTargetArch = preferredTargetId === 'windows-msvc-x64' ? 'x64' : 'Win32';
    if (newEmojiRuntimeDllBase && newEmojiModule?.installPath) {
      const architectureCandidate = path.join(newEmojiModule.installPath, 'bin', newEmojiTargetArch, 'new_emoji.dll');
      try {
        await fs.access(architectureCandidate);
        newEmojiRuntimeDll = architectureCandidate;
      } catch {
        // 安装目录缺少对应架构 DLL 时保持原路径，由后续资源/链接步骤给出诊断。
      }
    }
    if (executableResourcePath && newEmojiRuntimeDll && compiler.kind === 'msvc') {
      try {
        // 把 DLL 复制进链接工作目录（rc 引用校验与 rc.exe 均以该目录解析相对路径），
        // rc 行用相对链接目录的路径引用，保证可复制工程在同类环境下同样可编译。
        const embeddedDllDir = path.join(sourceDir, 'modules', 'lingbuilder.new_emoji.ui', 'bin', newEmojiTargetArch);
        await fs.mkdir(embeddedDllDir, { recursive: true });
        const embeddedDllPath = path.join(embeddedDllDir, 'new_emoji.dll');
        let embeddedFresh = false;
        try {
          const [existing, sourceStat] = await Promise.all([fs.stat(embeddedDllPath), fs.stat(newEmojiRuntimeDll)]);
          embeddedFresh = existing.size === sourceStat.size;
        } catch {
          embeddedFresh = false;
        }
        if (!embeddedFresh) await fs.copyFile(newEmojiRuntimeDll, embeddedDllPath);
        const rcOriginal = await fs.readFile(executableResourcePath, 'utf8');
        // 幂等且自愈：先剥离历史（含带引号坏行）再追加规范行，避免旧产物残留导致重复或失效条目。
        const rcLines = rcOriginal
          .split(/\r?\n/)
          .filter(line => !(line.includes('NEW_EMOJI_DLL') && line.includes('RCDATA')));
        // rc 字符串里反斜杠是转义符，须双写；否则 `\new_emoji.dll` 中的 \n 被解析为换行导致文件找不到。
        // 资源名必须用不带引号的裸标识符：实测 rc.exe（VS18 工具链）会把裸未定义标识符编译为
        // 字符串资源名，与 FindResourceW(L"NEW_EMOJI_DLL") 对齐；若写成 "NEW_EMOJI_DLL"，引号
        // 会被原样保留在资源名里（15 字符），运行期反而查不到资源。
        const rcRelative = path.relative(sourceDir, embeddedDllPath).replace(/\\/g, '\\\\').replace(/\//g, '\\');
        const rcLine = 'NEW_EMOJI_DLL RCDATA "' + rcRelative + '"';
        await fs.writeFile(executableResourcePath, rcLines.join('\n').trimEnd() + '\n' + rcLine + '\n', 'utf8');
        baseLogs.push(`已内嵌 new_emoji 运行时 DLL（延迟解压）：${path.relative(sourceDir, embeddedDllPath)}`);
      } catch (error: any) {
        baseLogs.push(`new_emoji 运行时 DLL 内嵌失败（回退为同目录加载）：${error?.message || error}`);
      }
    }
    const compileResult = await this.compilerRunner(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, executableResourcePath, buildLease.signal, outputType, requireAdministrator);
    const logs = [
      ...baseLogs,
      `exe 输出目录：${binDir}`,
      `中间文件目录：${objDir}`,
      `编译器：${compiler.kind} (${compiler.command})`,
      executableNameParts.fileName !== 'LingBuilderPreview.exe' ? `项目自定义 EXE 文件名：${executableNameParts.fileName}` : '',
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

    if (request.run !== false && outputType === 'dll') {
      // 动态库没有运行入口：链接完成后不启动进程，产物即 dll + 导入库。
      const importLibraryPath = exePath.replace(/\.dll$/iu, '.lib');
      logs.push('动态库输出模式：编译完成后不启动运行进程。', `DLL 产物：${exePath}`, `导入库：${importLibraryPath}`);
    }
    if (request.run !== false && outputType !== 'dll') {
      try {
        const logFile = path.join(buildDir, 'run.log');
        this.lastRunLogPaths.set(managedProjectId, logFile);
        const started = await this.managedProcessService.start(managedProjectId, exePath, {
          cwd: binDir,
          env: {
            ...process.env,
            ...(this.fbroVipKey ? { LINGBUILDER_FBRO_VIP_KEY: this.fbroVipKey } : {})
          },
          detached: false,
          // 控制台程序的输出经 run.log 返回；隐藏宿主控制台，避免弹出空黑窗。
          windowsHide: outputKind === 'console-application',
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
      logs
    };
  }

  /** 设计器上下文统一解析：调用方显式传入的模型优先；否则按 projectId 从解决方案加载磁盘设计器模型；
   *  两者都不可用时返回 none——控件引用改为“未校验”并附说明，不得误报成“找不到控件”。 */
  private async resolveDesignerContext(
    designerProject: LingWindowProject | undefined,
    projectId?: string
  ): Promise<AiBridgeDesignerContextResolution> {
    if (designerProject !== undefined) {
      assertDesignerProjectShape(designerProject, 'designerProject');
      return { source: 'caller', project: designerProject };
    }
    if (!projectId) return { source: 'none', reason: 'missing-project-id' };
    const solution = await this.solutionService.getSolution();
    const projectRef = solution.projects.find(item => item.id === projectId);
    if (!projectRef) return { source: 'none', reason: 'project-not-found', projectId };
    const snapshot = await this.solutionService.readDesignerProjectSnapshot(projectRef);
    return { source: 'workspace', project: snapshot.project, persisted: snapshot.persisted, designerPath: projectRef.designerPath };
  }

  /** 设计器上下文不足以做控件校验时，给外部 AI 的根因说明（warning 级，附修复路径）。 */
  private createDesignerContextDiagnostics(context: AiBridgeDesignerContextResolution): LingCppDiagnostic[] {
    if (context.source === 'caller') return this.createEmptyDesignerModelDiagnostics(context.project);
    if (context.source === 'workspace') {
      if (!context.persisted) {
        return [{
          id: 'lingcpp-designer-model-missing',
          line: 1,
          level: 'warning',
          message: `项目“${context.project.id}”的设计器模型文件缺失或无效（${context.designerPath}）：本轮控件引用按空窗口模型校验，可能产生“找不到控件”诊断。`,
          codeSnippet: '',
          suggestion: '请通过 lingbuilder.edit.apply 携带 updatedDesignerProject 重建设计器模型，或使用 lingbuilder.project.create 重新创建项目。'
        }];
      }
      return this.createEmptyDesignerModelDiagnostics(context.project);
    }
    const message = context.reason === 'project-not-found'
      ? `未提供窗口设计器模型，且项目“${context.projectId}”不在当前解决方案中：控件引用与设计器事件绑定本轮未校验。`
      : '未提供窗口设计器模型：控件引用与设计器事件绑定本轮未校验。';
    return [{
      id: 'lingcpp-designer-context-missing',
      line: 1,
      level: 'warning',
      message,
      codeSnippet: '',
      suggestion: '请传 designerProject 提供完整设计器模型；对解决方案中的已注册项目，可只传 projectId 由工作区设计器模型自动补齐。'
    }];
  }

  /** 模型已加载却一个控件都没有：这就是「IDE 画布空白、exe 里没有组件」的根因，必须点名并给修复路径。 */
  private createEmptyDesignerModelDiagnostics(project: LingWindowProject): LingCppDiagnostic[] {
    if (project.windows.length === 0) return [];
    const totalControls = project.windows.reduce((total, window) => total + window.controls.length, 0);
    if (totalControls > 0) return [];
    return [{
      id: 'lingcpp-designer-controls-empty',
      line: 1,
      level: 'warning',
      message: `项目“${project.id}”的设计器模型里没有任何控件（${project.windows.length} 个窗口的 controls 全为空）：因此 IDE 界面设计器画布是空白的，构建出的 exe 窗口里也不会出现任何组件。这不是显示问题，而是控件从未进入设计器模型——只写 .lcpp 源码不会产生界面。`,
      codeSnippet: '',
      suggestion: '在 lingbuilder.edit.propose 里携带 updatedDesignerProject（完整设计器模型对象，windows[].controls 补齐目标控件，type 用规范英文标识如 Button/TextBox/ListView，每项都要带 content），经 edit.apply 落盘后再构建；需要控件显示出来还要保证 visibility 不为 Collapsed。'
    }];
  }

  private describeDesignerContext(context: AiBridgeDesignerContextResolution): AiBridgeDesignerContextInfo {
    if (context.source === 'caller') {
      return { source: 'caller', controlReferencesChecked: true, summary: '控件引用按调用方提供的设计器模型校验。' };
    }
    if (context.source === 'workspace') {
      return {
        source: 'workspace',
        projectId: context.project.id,
        persisted: context.persisted,
        controlReferencesChecked: true,
        summary: context.persisted
          ? `控件引用按工作区设计器模型校验（${context.designerPath}）。`
          : `工作区设计器模型文件缺失或无效（${context.designerPath}），已按空窗口模型校验。`
      };
    }
    return {
      source: 'none',
      ...(context.projectId ? { projectId: context.projectId } : {}),
      controlReferencesChecked: false,
      summary: '未提供设计器模型，控件引用与设计器事件绑定未校验。'
    };
  }

  private static readonly DESIGNER_INVENTORY_MAX_CONTROLS_PER_WINDOW = 160;
  private static readonly CODE_ORGANIZATION_MAX_FILES = 40;
  private static readonly CODE_ORGANIZATION_SPLIT_LINES = 300;
  private static readonly CODE_ORGANIZATION_HEAVY_LINES = 800;

  /**
   * 设计器组件清单：把已解析的设计器模型导出为「窗口 → 控件（名称/类型/内容/位置/可见性/事件绑定）」
   * 的权威表，外部 AI 一次 diagnostics 调用即可回答「我的窗口里到底有哪些组件、为什么没显示」，
   * 不需要猜 window-designer.json 路径或从源码反推。
   */
  private describeDesignerInventory(
    context: AiBridgeDesignerContextResolution,
    sources: Array<{ filePath: string; sourceCode: string }>
  ): AiBridgeDesignerInventory | undefined {
    if (context.source === 'none') return undefined;
    const project = context.project;
    const handlersByClass = new Map<string, string[]>();
    for (const source of sources.slice(0, AiBridgeService.CODE_ORGANIZATION_MAX_FILES)) {
      if (!source.filePath.toLocaleLowerCase().endsWith('.lcpp')) continue;
      let parsed;
      try {
        parsed = parseLingCpp(source.sourceCode);
      } catch {
        continue;
      }
      for (const classDecl of parsed.program.classes) {
        const key = normalizeIdentifier(classDecl.name);
        const handlers = classDecl.methods.filter(method => method.kind === 'event').map(method => method.name);
        handlersByClass.set(key, [...(handlersByClass.get(key) ?? []), ...handlers]);
      }
    }
    const controlNameById = new Map<string, string>(
      project.windows.flatMap(window => window.controls.map(control => [control.id, control.name] as [string, string]))
    );
    const maxPerWindow = AiBridgeService.DESIGNER_INVENTORY_MAX_CONTROLS_PER_WINDOW;
    let hiddenTotal = 0;
    const windows: AiBridgeDesignerWindowInfo[] = project.windows.map(window => {
      const hiddenCount = window.controls.filter(control => control.visibility === 'Collapsed').length;
      hiddenTotal += hiddenCount;
      return {
        id: window.id,
        fileName: window.fileName,
        className: window.className,
        title: window.title,
        ...(window.designerBackend ? { designerBackend: window.designerBackend } : {}),
        width: window.width,
        height: window.height,
        controlCount: window.controls.length,
        hiddenControlCount: hiddenCount,
        sourceEventHandlers: handlersByClass.get(normalizeIdentifier(window.className)) ?? [],
        truncated: window.controls.length > maxPerWindow,
        controls: window.controls.slice(0, maxPerWindow).map(control => {
          const item: AiBridgeDesignerControlItem = {
            name: control.name,
            type: control.designerType || control.type,
            x: control.x,
            y: control.y,
            width: control.width,
            height: control.height,
            visible: control.visibility !== 'Collapsed',
            enabled: control.isEnabled !== false,
            eventBindings: { ...(control.events ?? {}) }
          };
          const content = typeof control.content === 'string' ? control.content.trim() : '';
          if (content) item.content = content.length > 80 ? `${content.slice(0, 80)}…` : content;
          const parentName = control.parentId ? controlNameById.get(control.parentId) : undefined;
          if (parentName) item.parentName = parentName;
          return item;
        })
      };
    });
    const controlCount = windows.reduce((total, window) => total + window.controlCount, 0);
    const summary = windows.length === 0
      ? '设计器模型没有任何窗口。'
      : controlCount === 0
        ? `设计器有 ${windows.length} 个窗口但**没有任何组件**：这正是 IDE 画布空白、exe 窗口里没有控件的直接原因（只写 .lcpp 源码不会产生界面）。请在 edit.propose 携带 updatedDesignerProject 补齐控件后 apply 落盘，再构建。`
        : `设计器共 ${windows.length} 个窗口、${controlCount} 个组件${hiddenTotal > 0 ? `，其中 ${hiddenTotal} 个 visibility=Collapsed（画布与运行时都不显示）` : ''}。控件必须存在于本清单才会出现在 IDE 画布和生成的 exe 里；补齐或隐藏控件请在 edit.propose 携带 updatedDesignerProject。`;
    const designerPath = context.source === 'workspace' ? context.designerPath : undefined;
    return {
      source: context.source,
      ...(designerPath ? { designerPath } : {}),
      windowCount: windows.length,
      controlCount,
      windows,
      nonVisualResources: (project.resources ?? []).map(resource => ({
        name: String((resource as { name?: unknown }).name ?? ''),
        type: String((resource as { type?: unknown }).type ?? '')
      })),
      summary
    };
  }

  /**
   * 代码组织度量：统计项目内每个 .lcpp 的行数与角色（窗口主体/功能库/固定文件），并给出中文处方。
   * 配合 MCP_INSTRUCTIONS 第 7 条，把「别把整个项目堆进单个 MainWindow.lcpp」从引导语
   * 变成外部 AI 每次诊断都能拿到的可执行指标。
   */
  private describeCodeOrganization(request: {
    windowProject: boolean;
    sources: Array<{ filePath: string; sourceCode: string }>;
    functionLibraries: Array<{ name: string; filePath: string; methods: Array<{ name: string; access?: string }> }>;
  }): AiBridgeCodeOrganizationInfo {
    type FileMetric = AiBridgeCodeOrganizationInfo['files'][number];
    const files: FileMetric[] = request.sources
      .filter(source => source.filePath.toLocaleLowerCase().endsWith('.lcpp'))
      .map((source): FileMetric => {
        const normalized = normalizeFilePath(source.filePath);
        let functionLibraryCount = 0;
        let classNames: string[] = [];
        try {
          const parsed = parseLingCpp(source.sourceCode);
          functionLibraryCount = parsed.program.functionLibraries.length;
          classNames = parsed.program.classes.map(classDecl => classDecl.name);
        } catch {
          // 语法问题由常规诊断负责，这里只做角色归类。
        }
        const kind: FileMetric['kind'] = isProjectGlobalsFilePath(normalized) || isProjectDataTypesFilePath(normalized) || isProjectDllCommandsFilePath(normalized)
          ? 'fixed'
          : functionLibraryCount > 0
            ? 'function-library'
            : classNames.length > 0
              ? 'window-main'
              : 'other';
        return {
          filePath: normalized,
          lineCount: source.sourceCode === '' ? 0 : source.sourceCode.split(/\r?\n/u).length,
          kind,
          functionLibraryCount,
          classNames
        };
      })
      .filter(file => file.kind !== 'fixed')
      .sort((left, right) => right.lineCount - left.lineCount);
    const capped = files.slice(0, AiBridgeService.CODE_ORGANIZATION_MAX_FILES);
    const largestFile = capped[0];
    const functionLibraries = request.functionLibraries.map(library => ({
      name: library.name,
      filePath: normalizeFilePath(library.filePath),
      publicMethods: library.methods.filter(method => method.access !== '私有' && method.access !== '保护').map(method => method.name)
    }));
    const splitLines = AiBridgeService.CODE_ORGANIZATION_SPLIT_LINES;
    const heavyLines = AiBridgeService.CODE_ORGANIZATION_HEAVY_LINES;
    let summary: string;
    if (!request.windowProject) {
      summary = '非窗口项目：不适用功能库拆分建议。';
    } else if (functionLibraries.length === 0 && largestFile && largestFile.lineCount >= splitLines) {
      summary = `全部逻辑集中在 ${largestFile.filePath}（${largestFile.lineCount} 行）且项目没有任何功能库：功能库（用户口中的“功能代码/功能性代码/公共代码”就是指它）是独立 .lcpp 文件里的“功能库 名称 … 结束功能库”块，不是把代码改写成更多本地函数——请新建一个文件一个功能库，按分类把可复用逻辑与大批量 @ 内嵌 C++ 下沉进去，跨文件用 库名.功能(...) 限定调用，窗口主 .lcpp 只保留事件处理器与程序主体。`;
    } else if (largestFile && largestFile.lineCount >= heavyLines) {
      summary = `${largestFile.filePath} 已达 ${largestFile.lineCount} 行：继续按分类新增功能库文件（“功能库 名称 … 结束功能库”，即“功能代码”文件）并迁移逻辑，避免单文件持续膨胀。`;
    } else if (functionLibraries.length > 0) {
      summary = `代码组织良好：项目已有 ${functionLibraries.length} 个功能库，最大 .lcpp 为 ${largestFile?.lineCount ?? 0} 行；新增“功能代码”请继续落到对应功能库文件。`;
    } else {
      summary = `当前最大 .lcpp 为 ${largestFile?.lineCount ?? 0} 行，尚未需要拆分；新增可复用逻辑（“功能代码”）时优先放进独立功能库文件（“功能库 名称 … 结束功能库”），不要继续追加进窗口主 .lcpp。`;
    }
    return {
      windowProject: request.windowProject,
      files: capped,
      functionLibraries,
      ...(largestFile ? { largestFile } : {}),
      summary
    };
  }

  /** 代码组织处方诊断：info/warning 级，绝不阻断构建。 */
  private createCodeOrganizationDiagnostics(organization: AiBridgeCodeOrganizationInfo, filePath: string): LingCppDiagnostic[] {
    if (!organization.windowProject) return [];
    const oversized = organization.files.filter(file => file.lineCount >= AiBridgeService.CODE_ORGANIZATION_HEAVY_LINES);
    const needsSplit = organization.functionLibraries.length === 0
      && (organization.largestFile?.lineCount ?? 0) >= AiBridgeService.CODE_ORGANIZATION_SPLIT_LINES;
    if (!needsSplit && oversized.length === 0) return [];
    const current = organization.files.find(file => file.filePath === normalizeFilePath(filePath));
    const currentDirectory = current ? path.posix.dirname(current.filePath) : path.posix.dirname(normalizeFilePath(filePath));
    const libraryDirectory = currentDirectory === '.' ? 'src' : currentDirectory;
    const message = needsSplit
      ? `代码组织：${organization.summary}`
      : `代码组织：${oversized.map(file => `${file.filePath}（${file.lineCount} 行）`).join('、')} 体量过大。${organization.summary}`;
    return [{
      id: 'lingcpp-code-organization-split-suggestion',
      line: Math.max(1, current?.lineCount ?? 1),
      level: needsSplit && oversized.length === 0 ? 'info' : 'warning',
      message,
      codeSnippet: '',
      suggestion: `新建一个功能库文件（文件名即功能库名，例如 ${libraryDirectory}/文本工具.lcpp），照下面的骨架写（公开段可被其他文件限定调用，私有段只能库内调用），把可复用命令与 @ 内嵌 C++ 从窗口主文件迁进去，调用处改为 文本工具.功能名(...)；窗口主 .lcpp 只保留事件处理器与程序主体。\n${createFunctionLibraryTemplate('文本工具')}`
    }];
  }

  /** 设计器模型与项目数据只允许写入解决方案中已注册的项目，封堵“文件落盘但 IDE 看不到项目”的幻影项目。 */
  private async assertDesignerProjectRegistered(projectId: string): Promise<void> {
    const solution = await this.solutionService.getSolution();
    if (solution.projects.some(project => project.id === projectId)) return;
    throw new Error(`项目“${projectId}”未在解决方案（.lingbuilder/solution.json）中注册：禁止为未注册项目写入设计器模型或项目数据。请先使用 lingbuilder.project.create 创建项目，或改为操作已注册项目。`);
  }

  /** 设计器模型本体必须走提案的 updatedDesignerProject 校验通道，不允许绕过布局校验直接改文件。 */
  private async assertDesignerFileWriteAllowed(filePath: string): Promise<void> {
    const normalized = normalizeFilePath(filePath);
    const projectsMatch = normalized.match(/^\.lingbuilder\/projects\/([^/]+)(?:\/|$)/u);
    if (projectsMatch) await this.assertDesignerProjectRegistered(projectsMatch[1]);
    const solution = await this.solutionService.getSolution();
    const designerOwner = solution.projects.find(project => normalizeFilePath(project.designerPath) === normalized);
    if (designerOwner) {
      throw new Error(`设计器模型文件（${normalized}）不能通过普通文件草稿写入：请在提案中携带 updatedDesignerProject，经布局校验后原子应用。`);
    }
  }

  /** 构建/导出前检查传入模型与磁盘设计器是否脱节；只提示不阻断，避免静默生成与 IDE 不一致的结果。 */
  private async describeDesignerModelMismatchWarning(project: LingWindowProject): Promise<string | undefined> {
    try {
      if (!project?.id) return undefined;
      const solution = await this.solutionService.getSolution();
      const projectRef = solution.projects.find(item => item.id === project.id);
      if (!projectRef) return undefined;
      const snapshot = await this.solutionService.readDesignerProjectSnapshot(projectRef);
      if (!snapshot.persisted) return undefined;
      if (areDesignerProjectsEquivalent(snapshot.project, project)) return undefined;
      return `警告：传入的窗口设计器模型与磁盘版本（${projectRef.designerPath}）不一致，生成结果可能与 IDE 设计器脱节；请重新读取最新设计器模型后重试，或先通过 lingbuilder.edit.apply 同步磁盘。`;
    } catch {
      return undefined;
    }
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
    // 项目级 DLL 命令声明：合成虚拟模块并入上下文，使诊断/补全/AI 描述覆盖声明命令。
    const sources = await this.resolveLingCppProjectSources(projectId);
    const projectDllModule = createProjectDllDeclarationModuleFromSources(sources, projectId);
    const mergedEnabled = projectDllModule ? [...enabledModules, projectDllModule] : enabledModules;
    return { availableModules, enabledModules: mergedEnabled };
  }

  /**
   * files[] 归一化：updatedSource（全量）、updatedLines（按行）、edits（行级增量）三选一，
   * 统一转成完整 updatedSource 再进入提案管线；增量形态把换行从 JSON 转义中解放出来。
   */
  private async normalizeProposedFiles(
    request: AiBridgeEditProposeRequest,
    workspaceFiles: LingCppWorkspaceFile[]
  ): Promise<Array<{ filePath: string; updatedSource: string }> | undefined> {
    if (!request.files?.length) return undefined;
    const MAX_INLINE_SOURCE_BYTES = 256 * 1024;
    return request.files.map(file => {
      if (!file || typeof file !== 'object' || !file.filePath) throw new Error('files[] 每项必须包含 filePath。');
      const filePath = normalizeFilePath(file.filePath);
      const provided = [file.updatedSource !== undefined, Array.isArray(file.updatedLines), Array.isArray(file.edits)].filter(Boolean).length;
      if (provided !== 1) {
        throw new Error(`${filePath} 的 files[] 项必须且只能提供 updatedSource、updatedLines、edits 之一。`);
      }
      if (file.updatedSource !== undefined) {
        if (typeof file.updatedSource !== 'string') throw new Error(`${filePath} 的 updatedSource 必须是字符串。`);
        const bytes = Buffer.byteLength(file.updatedSource, 'utf8');
        if (bytes > MAX_INLINE_SOURCE_BYTES) {
          throw new Error(`${filePath} 的 updatedSource 约 ${Math.round(bytes / 1024)} KB，超过 ${MAX_INLINE_SOURCE_BYTES / 1024} KB 内联上限；请改用 updatedLines（按行数组，换行无需转义）或 edits（行级增量替换）。`);
        }
        return { filePath, updatedSource: normalizeLineEndings(file.updatedSource) };
      }
      if (Array.isArray(file.updatedLines)) {
        if (!file.updatedLines.every(line => typeof line === 'string')) throw new Error(`${filePath} 的 updatedLines 每一项都必须是字符串（不含行尾换行符）。`);
        return { filePath, updatedSource: file.updatedLines.join('\n') };
      }
      const current = workspaceFiles.find(item => normalizeFilePath(item.filePath).toLocaleLowerCase() === filePath.toLocaleLowerCase());
      if (!current) throw new Error(`${filePath} 使用 edits 增量编辑，但未能解析到其当前内容作为基准；请确认文件已存在于工作区。`);
      return { filePath, updatedSource: applyLineEdits(current.sourceCode, file.edits!, filePath) };
    });
  }

  /** caller 显式传入设计器模型时读取其磁盘快照，作为 apply 阶段「提案后漂移检测」的基准；无磁盘模型时返回 undefined。 */
  private async readDesignerDiskBaselineFor(designerProject: LingWindowProject, requestProjectId?: string): Promise<LingWindowProject | undefined> {
    try {
      const baselineId = typeof designerProject?.id === 'string' && designerProject.id ? designerProject.id : requestProjectId;
      if (!baselineId) return undefined;
      const solution = await this.solutionService.getSolution();
      const projectRef = solution.projects.find(item => item.id === baselineId);
      if (!projectRef) return undefined;
      const snapshot = await this.solutionService.readDesignerProjectSnapshot(projectRef);
      return snapshot.persisted ? snapshot.project : undefined;
    } catch {
      return undefined;
    }
  }

  /** 解析提案的工作区基准内容：显式传入时原样采用（未匹配文件由提案校验报错）；
   *  缺省时按 draft 文件清单自动读盘（磁盘上不存在的路径按新建空文件处理）。 */
  private async resolveEditWorkspaceFiles(request: AiBridgeEditProposeRequest): Promise<LingCppWorkspaceFile[]> {
    if (Array.isArray(request.workspaceFiles)) {
      return request.workspaceFiles.map(file => ({
        ...file,
        filePath: normalizeFilePath(file.filePath),
        sourceCode: normalizeLineEndings(file.sourceCode)
      }));
    }
    const targetPaths: string[] = [];
    for (const filePath of [request.filePath, ...(request.files || []).map(file => file.filePath)]) {
      if (!filePath) continue;
      const normalized = normalizeFilePath(filePath);
      if (targetPaths.some(existing => existing.toLocaleLowerCase() === normalized.toLocaleLowerCase())) continue;
      targetPaths.push(normalized);
    }
    // 每个目标文件都从磁盘补读；外部 AI 因此可以不再手工回传 workspaceFiles。
    const MAX_AUTO_READ_FILES = 8;
    if (targetPaths.length > MAX_AUTO_READ_FILES) {
      throw new Error(`一次提案最多处理 ${MAX_AUTO_READ_FILES} 个文件；请拆分提案后分批提交。`);
    }
    const resolved: LingCppWorkspaceFile[] = [];
    for (const filePath of targetPaths) {
      try {
        const content = await this.readFile(filePath);
        resolved.push({ filePath, sourceCode: normalizeLineEndings(content.content) });
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
        // 磁盘上不存在：按新建文件处理，基准内容为空；应用阶段仍受写入白名单与权限门禁约束。
        resolved.push({ filePath, sourceCode: '' });
      }
    }
    return resolved;
  }

  /**
   * 按 ID 取提案：先查本进程内存 store，未命中再查工作区交接目录
   * （内嵌 Agent 在另一进程生成提案）。agentProposalHandoff 关闭时绝不读盘。
   */
  private async resolveEditProposal(proposalId: string | undefined): Promise<WorkspaceEditProposal | undefined> {
    if (!proposalId) return undefined;
    return getWorkspaceEditProposal(proposalId)
      || (this.options.agentProposalHandoff ? await readAgentProposal(this.workspaceRoot, proposalId) : undefined);
  }

  private async resolveApplyWorkspaceFiles(request: AiBridgeEditApplyRequest): Promise<LingCppWorkspaceFile[]> {
    if (Array.isArray(request.workspaceFiles) && request.workspaceFiles.length > 0) {
      return request.workspaceFiles.map(file => ({
        ...file,
        filePath: normalizeFilePath(file.filePath),
        sourceCode: normalizeLineEndings(file.sourceCode)
      }));
    }
    const proposal = await this.resolveEditProposal(request.proposalId);
    if (!proposal?.changes.length) return [];
    return await Promise.all(proposal.changes.map(async (change, index) => {
      if (index === 0 && typeof request.sourceCode === 'string') {
        return { filePath: change.filePath, sourceCode: normalizeLineEndings(request.sourceCode) };
      }
      try {
        const content = await this.readFile(change.filePath);
        return { filePath: change.filePath, sourceCode: normalizeLineEndings(content.content) };
      } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
        // 提案生成时基准内容为空的文件按新建文件应用。
        return { filePath: change.filePath, sourceCode: '' };
      }
    }));
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

/** 从命令 signature 与 binding 提取逐参数中文说明；供 lingbuilder.module.info 返回。 */
function parseModuleCommandParameterDocs(command: ModuleCommandContribution, binding?: ModuleCommandBinding): Array<{ name: string; type: string; description: string }> {
  const signature = command.signature || '';
  const match = signature.match(/^[^(（]+[（(](.*)[）)]/u);
  if (!match || !match[1].trim()) return [];
  return match[1]
    .split(/[，,]/u)
    .map(part => part.trim())
    .filter(Boolean)
    .map((part, index) => {
      const [name, type] = part.split(/[:：]/u).map(value => value.trim());
      const bindingParameter = binding?.parameters?.[index];
      return {
        name: bindingParameter?.name || name || part,
        type: bindingParameter?.type
          ? describeModuleBindingParameterType(bindingParameter)
          : type || '参数',
        description: bindingParameter?.description || command.description || '模块尚未提供这个参数的详细说明。'
      };
    });
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
  signal?: AbortSignal,
  outputType: 'exe' | 'dll' = 'exe',
  requireAdministrator = false
): Promise<AiBridgeCompileResult> {
  const buildDynamicLibrary = outputType === 'dll';
  if (buildDynamicLibrary && compiler.kind !== 'msvc') {
    return {
      ok: false,
      logs: [
        '编译失败。',
        '动态库输出模式当前仅支持 MSVC/Visual Studio Build Tools：需要链接生成 .dll 与导入库 .lib；请安装 Visual Studio Build Tools 后重试。'
      ]
    };
  }
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
  // 动态库强制动态 CRT（与 Visual Studio 导出器的 DynamicLibrary 行为一致）：
  // 消费方工程链接导入库并传 std::wstring，跨 DLL 边界要求两侧共用同一 CRT。
  const useDynamicCrt = modulePlan?.requiresDynamicCrt === true || buildDynamicLibrary;
  const requiredCppStandard = modulePlan?.requiredCppStandard === 20 ? 20 : 17;
  const extraDefineArgs = (modulePlan?.extraCompileDefines || []).map(define => `/D${define}`);
  const newEmojiDelayLoadLinkArgs = modulePlan?.runtimeFiles.some(file => path.basename(file).toLowerCase() === 'new_emoji.dll')
    // 经 cl 调起链接时，纯链接器选项必须放在 /link 之后；否则 cl 会静默丢弃
    // /DELAYLOAD（连 D9002 都不报），new_emoji.dll 退回静态导入，EXE 离开同目录
    // DLL 直接 0xC0000135 无法启动，内嵌资源与延迟加载钩子全部失效。
    ? ['delayimp.lib', '/link', '/DELAYLOAD:new_emoji.dll']
    : [];
  if (compiler.kind === 'msvc' && moduleSources.length > 0) {
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs, requiredCppStandard, useDynamicCrt, extraDefineArgs, resourceOutputPath, resourceLogs, newEmojiDelayLoadLinkArgs, signal, buildDynamicLibrary, requireAdministrator);
  }

  const commandArgs = compiler.kind === 'msvc'
    ? [
        '/nologo',
        '/EHsc',
        `/std:c++${requiredCppStandard}`,
        '/utf-8',
        ...extraDefineArgs,
        ...(useDynamicCrt ? ['/MD'] : []),
        ...(buildDynamicLibrary ? ['/LD'] : []),
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
        ...moduleLibs,
        // 清单内嵌为 RT_MANIFEST（与 Visual Studio 工程默认行为一致）：
        // exe 目录不再出现外置 .exe.manifest，支持真正的单文件分发。
        '/link',
        '/MANIFEST:EMBED',
        // requireAdministrator：项目 buildProperties 要求时请求 UAC 提权（与 VS 导出工程一致）。
        ...(requireAdministrator ? [...REQUIRE_ADMINISTRATOR_LINK_ARGS] : [])
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
  extraDefineArgs: string[],
  resourceOutputPath: string | undefined,
  resourceLogs: string[],
  newEmojiDelayLoadLinkArgs: string[],
  signal?: AbortSignal,
  buildDynamicLibrary = false,
  requireAdministrator = false
): Promise<{ ok: boolean; logs: string[] }> {
  const sources = [sourcePath, ...moduleSources];
  // 编译输入指纹：编译器 + 目标架构 + 语言标准 + CRT + 宏 + 包含目录。
  // 头文件内容变化不参与指纹（与 make-less 缓存同等取舍）；模块升级时会连源头码
  // 一起更换，指纹必然变化，不会复用陈旧 obj。
  const fingerprint = [
    compiler.kind,
    compiler.arch || '',
    compiler.command,
    compiler.setupBatch || '',
    `/std:c++${requiredCppStandard}`,
    useDynamicCrt ? '/MD' : '/MT',
    buildDynamicLibrary ? '/LD' : '',
    ...extraDefineArgs,
    ...includeArgs
  ].join('\u0000');
  // obj 名按源码路径哈希稳定命名：源码列表顺序变化不会错误复用旧 obj。
  const compilePlans = sources.map(source => {
    const isMain = source === sourcePath;
    const hash12 = crypto.createHash('sha256').update(normalizeFilePath(source).toLocaleLowerCase()).digest('hex').slice(0, 12);
    const objectFile = path.join(objDir, isMain ? 'main.obj' : `module_${hash12}.obj`);
    return { source, objectFile, sidecarFile: `${objectFile}.inputs`, isMain };
  });

  // 清理已不在本次编译清单中的陈旧 obj/指纹（例如禁用模块后），保持与
  // “禁用模块不得在后续构建中留下陈旧产物”的既有约定一致。
  const keepObjects = new Set(compilePlans.flatMap(plan => [plan.objectFile.toLowerCase(), plan.sidecarFile.toLowerCase()]));
  try {
    const existingObjs = (await fs.readdir(objDir)).filter(name => /\.obj(?:\.inputs)?$/iu.test(name));
    await Promise.all(existingObjs
      .filter(name => !keepObjects.has(path.join(objDir, name).toLowerCase()))
      .map(name => fs.rm(path.join(objDir, name), { force: true })));
  } catch {
    // 目录尚未创建等清理失败不阻断构建；编译阶段会正常覆盖产物。
  }

  const compileCommands: Array<{ source: string; objectFile: string; sidecarFile: string; expectedKey: string }> = [];
  let reusedCount = 0;
  for (const plan of compilePlans) {
    const sourceHash = crypto.createHash('sha256').update(await fs.readFile(plan.source)).digest('hex');
    const expectedKey = crypto.createHash('sha256').update(`${fingerprint}\u0000${plan.source}\u0000${sourceHash}`).digest('hex');
    let cached = false;
    try {
      const [recordedKey, objectStat] = await Promise.all([
        fs.readFile(plan.sidecarFile, 'utf8').then(content => content.trim()),
        fs.stat(plan.objectFile)
      ]);
      cached = Boolean(objectStat.size) && recordedKey === expectedKey;
    } catch {
      cached = false;
    }
    if (cached) {
      reusedCount += 1;
      continue;
    }
    compileCommands.push({ source: plan.source, objectFile: plan.objectFile, sidecarFile: plan.sidecarFile, expectedKey });
  }
  const cacheLogs = reusedCount > 0
    ? [`编译缓存：${reusedCount}/${sources.length} 个源文件未变化，已复用上次 obj。`]
    : [];

  const objectsToLink = compilePlans.map(plan => plan.objectFile);
  const linkArgs = [
    '/nologo',
    ...(buildDynamicLibrary ? ['/DLL'] : []),
    ...objectsToLink,
    '/Fe:' + exePath,
    'user32.lib',
    'gdi32.lib',
    'comctl32.lib',
    'ole32.lib',
    ...(resourceOutputPath ? [resourceOutputPath] : []),
    ...moduleLibs,
    // 清单内嵌为 RT_MANIFEST（与 Visual Studio 工程默认行为一致），不落外置 .exe.manifest。
    // /link 区段只能开启一次：延迟加载参数自带 '/link'，必须真实展开并入该区段——
    // 只判空不展开会让 new_emoji.dll 退回硬导入，EXE 离开同目录即 0xC0000135，
    // 且 /MANIFEST:EMBED 落在 /link 外被 cl 以 D9002 静默忽略。
    ...(newEmojiDelayLoadLinkArgs.length > 0
      ? [...newEmojiDelayLoadLinkArgs, '/MANIFEST:EMBED']
      : ['/link', '/MANIFEST:EMBED']),
    ...(requireAdministrator ? [...REQUIRE_ADMINISTRATOR_LINK_ARGS] : [])
  ];

  try {
    const outputs: string[] = [];
    for (const { source, objectFile, sidecarFile, expectedKey } of compileCommands) {
      const args = [
        '/nologo',
        '/EHsc',
        `/std:c++${requiredCppStandard}`,
        '/utf-8',
        ...extraDefineArgs,
        ...(useDynamicCrt ? ['/MD'] : []),
        '/DUNICODE',
        '/D_UNICODE',
        ...includeArgs,
        '/c',
        source,
        '/Fo:' + objectFile
      ];
      const result = await runMsvcCommand(compiler, args, cwd, signal);
      // 指纹必须只在编译成功后落盘：否则失败编译会留下「旧 obj + 新指纹」，
      // 下次构建误命中缓存、把陈旧 obj 链接进产物。
      await fs.writeFile(sidecarFile, `${expectedKey}\n`, 'utf8').catch(() => undefined);
      if (result.stdout?.trim()) outputs.push(`stdout:\n${result.stdout.trim()}`);
      if (result.stderr?.trim()) outputs.push(`stderr:\n${result.stderr.trim()}`);
    }
    // 源文件有变化时才需要链接；全部命中缓存且 exe 仍在时也要重链接（exe 每轮构建前会被删除）。
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd, signal);
    if (linkResult.stdout?.trim()) outputs.push(`link stdout:\n${linkResult.stdout.trim()}`);
    if (linkResult.stderr?.trim()) outputs.push(`link stderr:\n${linkResult.stderr.trim()}`);
    return { ok: true, logs: ['编译成功。', ...cacheLogs, ...resourceLogs, ...outputs] };
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

/** 设计器模型必须是 JSON object；字符串形态多为二次 JSON.stringify 所致，须在入口给出可指导的中文错误。 */
function assertDesignerProjectShape(value: unknown, label: string): asserts value is object {
  if (value === null || value === undefined) return;
  if (Array.isArray(value) || typeof value !== 'object') {
    const received = Array.isArray(value) ? 'array' : typeof value;
    throw new Error(`${label} 必须是 JSON object，收到 ${received}。（常见误因：把设计器模型二次 JSON.stringify 后作为字符串传入；请直接传对象或省略该参数由服务端按 projectId 自动读取。）`);
  }
}

/** 行级增量替换：行号 1 起、含端点；endLine 缺省等于 startLine；空 newText 表示删除该区间。 */
function applyLineEdits(
  currentContent: string,
  edits: Array<{ startLine: number; endLine?: number; newText: string }>,
  filePath: string
): string {
  const lines = currentContent.split('\n');
  const normalized = edits.map((edit, index) => {
    if (!edit || typeof edit !== 'object') throw new Error(`${filePath} 的 edits[${index}] 不是对象。`);
    const startLine = Number(edit.startLine);
    const endLine = edit.endLine === undefined ? startLine : Number(edit.endLine);
    if (!Number.isInteger(startLine) || startLine < 1) throw new Error(`${filePath} 的 edits[${index}].startLine 必须是从 1 开始的整数。`);
    if (!Number.isInteger(endLine) || endLine < startLine) throw new Error(`${filePath} 的 edits[${index}].endLine 必须不小于 startLine。`);
    if (typeof edit.newText !== 'string') throw new Error(`${filePath} 的 edits[${index}].newText 必须是字符串。`);
    if (startLine > lines.length + 1 || endLine > lines.length) {
      throw new Error(`${filePath} 的 edits[${index}] 行区间 ${startLine}-${endLine} 超出当前文件行数（${lines.length}）。`);
    }
    return { startLine, endLine, newText: edit.newText };
  });
  // 先按 startLine 排序再逐对比较：交错提交（如 [1-8, 20-25, 3-5]）若按调用方顺序只比相邻对会漏检，
  // 而降序应用会把未检出的重叠区间变成静默错位替换。
  const ordered = [...normalized].sort((a, b) => a.startLine - b.startLine || a.endLine - b.endLine);
  for (let i = 1; i < ordered.length; i += 1) {
    if (ordered[i].startLine <= ordered[i - 1].endLine) {
      throw new Error(`${filePath} 的 edits 行区间存在重叠（${ordered[i - 1].startLine}-${ordered[i - 1].endLine} 与 ${ordered[i].startLine}-${ordered[i].endLine}），请按顺序拆分为不重叠区间。`);
    }
  }
  // 降序应用，避免先替换导致后续行号漂移。
  for (const edit of [...normalized].sort((a, b) => b.startLine - a.startLine)) {
    const replacement = edit.newText === '' ? [] : edit.newText.split('\n');
    lines.splice(edit.startLine - 1, edit.endLine - edit.startLine + 1, ...replacement);
  }
  return lines.join('\n');
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
