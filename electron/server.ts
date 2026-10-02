import express from "express";
import path from "path";
import { pathToFileURL } from "url";
import fs from "fs/promises";
import { watch as watchFiles, existsSync } from "fs";
import { execFile } from "child_process";
import { promisify } from "util";
import dotenv from "dotenv";
import { ExtractedString } from "./src/types";
import { normalizeIdentifier, parseLingCpp } from "./src/services/lingCpp/parser";
import {
  LingCppProjectSourceFile,
  LingCppWorkspaceFile
 } from "./src/services/lingCpp/types";
import { generateLingCppNativeWin32Project } from "./src/services/windowDesigner/lingCppWin32Project";
import { writeGeneratedProjectFiles } from "./src/services/windowDesigner/generatedProjectFileService";
import { exportVisualStudioProject } from "./src/services/windowDesigner/visualStudioProjectExporter";
import { createWindowsMsvcLinkLibraries, REQUIRE_ADMINISTRATOR_LINK_ARGS } from "./src/services/windowDesigner/windowsSystemLibraries";
import { LingWindowProject } from "./src/services/windowDesigner/types";
import { createProjectGlobalContext, isProjectGlobalsFilePath } from "./src/services/lingCpp/projectGlobalService";
import { createProjectTypeContext, isProjectDataTypesFilePath } from "./src/services/lingCpp/projectDataTypeService";
import { detectNestedWorkspaceArtifacts, isNestedWorkspaceArtifactRelativePath, isProjectBuildArtifactRelativePath } from "./src/services/solution/nestedWorkspaceGuard";
import {
  analyzeFunctionLibraryDependencyClosure,
  createFunctionLibraryTemplate,
  createProjectFunctionContext,
  mergeFunctionLibraryProjectResources,
  renameFunctionLibraryAcrossSources
} from "./src/services/lingCpp/functionLibraryService";
import { createModuleService } from "./src/services/modules/moduleService";
import {
  ModuleDocumentationError,
  readModuleDocumentation
} from "./src/services/modules/moduleDocumentationService";
import { ModuleAccessService } from "./src/services/modules/moduleAccessService";
import {
  exportModuleNativeDependencies,
  materializeModuleNativeDependencies,
  ModuleNativeDependencyPlan
} from "./src/services/modules/nativeDependencyService";
import {
  createMarketIndex,
  createModuleTemplate,
  importAiModuleFiles,
  migrateCppModule,
  validateModuleDirectory
} from "./src/services/modules/moduleSdkService";
import { AiBridgeService } from "./src/services/aiBridge/aiBridgeService";
import { createAiBridgeRouter } from "./src/services/aiBridge/httpRoutes";
import { AiBridgePermissionMode, AiBridgeServerOptions } from "./src/services/aiBridge/types";
import { createSolutionService, LingBuilderSolutionProject } from "./src/services/solution/solutionService";
import { findSolutionEntryPath } from "./src/services/solution/solutionEntryFile";
import { ExternalProjectService } from "./src/services/solution/externalProjectService";
import { detectExternalCppProjects } from "./src/services/solution/externalProjectDetect";
import { parseMsvcBuildOutput } from "./src/services/tasks/msvcOutputParser";
import {
  WorkspacePathPolicy,
  WorkspacePathPolicyError
} from "./src/services/workspace/workspacePathPolicy";
import {
  createProjectFileMutationService,
  ProjectFileMutationError
} from "./src/services/workspace/projectFileMutationService";
import { createWorkspaceSearchService } from "./src/services/workspace/workspaceSearchService";
import { GitService } from "./src/services/sourceControl/gitService";
import { TestExplorerService, TSX_IMPORT } from "./src/services/testing/testExplorerService";
import { NodeTestDebugService } from "./src/services/testing/nodeTestDebugService";
import { QualityService } from "./src/services/quality/qualityService";
import { ExtensionService } from "./src/services/extensions/extensionService";
import { DependencyService } from "./src/services/dependencies/dependencyService";
import { RcResourceService } from "./src/services/windowDesigner/rcResourceService";
import { createDesignerAssetService, findDesignerImageReferences } from "./src/services/windowDesigner/designerAssetService";
import {
  compileWindowsExecutableResource,
  createWindowsExecutableIconService,
  WINDOWS_EXECUTABLE_RESOURCE_FILE,
  WindowsExecutableResourceCompileError
} from "./src/services/windowDesigner/windowsExecutableIconService";
import { PerformanceService } from "./src/services/performance/performanceService";
import { PublishingService } from "./src/services/publishing/publishingService";
import { WorkspaceIndexService } from "./src/services/ai/workspaceIndexService";
import { SettingsSyncService } from "./src/services/configuration/settingsSyncService";
import { WorkspaceSearchError } from "./src/services/workspace/workspaceSearchTypes";
import { createManagedProcessService } from "./src/services/tasks/managedProcessService";
import { TaskService } from "./src/services/tasks/taskService";
import { BuildConfigurationService, getBuildCompilerFlags, getModuleTargetId, type BuildConfiguration } from "./src/services/tasks/buildConfigurationService";
import { resolveExecutableNameParts } from "./src/services/solution/externalProjectService";
import { isProjectDllCommandsFilePath, createProjectDllDeclarationModuleFromSources } from "./src/services/lingCpp/projectDllCommandService";
import { materializeProjectDllDeclarationModules } from "./src/services/modules/projectDllMaterializeService";
import { getEmbeddedResourceSpecsForBuild } from "./src/services/windowDesigner/embeddedResourceMigration";
import { resolveProjectBuildDirectories, setActiveWorkspaceBuildExcludeDirs } from "./src/services/tasks/buildPathService";
import { describeBuildOutputDirectory, formatBuildPathSummaryLines, formatSuccessCompileChannel, resolveBuildOutputKind } from "./src/services/tasks/buildOutputLabel";
import { ClangdService } from "./src/services/lsp/clangdService";
import { LspWorkspaceEditService } from "./src/services/lsp/lspWorkspaceEditService";
import { checkDevelopmentEnvironment } from "./src/services/tasks/environmentCheckService";
import {
  EnvironmentRepairBusyError,
  EnvironmentRepairService,
  isEnvironmentRepairTarget
} from "./src/services/tasks/environmentRepairService";
import {
  SdkDependencyBusyError,
  SdkDependencyRequiredError,
  SdkDependencyService
} from "./src/services/sdkDependencies/sdkDependencyService";
import {
  SDK_DEPENDENCY_RESOURCES,
  resolveSdkCacheRoot,
  type SdkDependencyId
} from "./src/services/sdkDependencies/sdkDependencyCatalog";
import { resolveSdkCatalogEndpoint } from "./src/services/sdkDependencies/sdkCatalogRemote";
import { SDK_CATALOG_TRUST_ANCHORS } from "./src/services/sdkDependencies/catalogTrustAnchors";
import { mapCompilerDiagnostics, parseCompilerDiagnostics } from "./src/services/tasks/compilerDiagnosticService";
import { decodeCompilerOutput } from "./src/services/tasks/compilerOutputEncoding";
import { dependencyBuildBatches, IncrementalBuildService } from "./src/services/tasks/incrementalBuildService";
import { PtyTerminalService } from "./src/services/terminal/ptyTerminalService";
import { attachTerminalWebSocketServer, createTerminalWebSocketTicket, type TerminalWebSocketBridge } from "./src/services/terminal/terminalWebSocketBridge";
import { NativeDebugService } from "./src/services/debug/nativeDebugService";
import type { LingCppNativeSourceMapEntry } from "./src/services/lingCpp/types";
import { mapSourceBreakpointsForDebug } from "./src/services/debug/sourceBreakpointMapper";
import {
  decodeTextFile,
  detectTextFileEol,
  encodeTextFile,
  resolveTextFileEol
} from "./src/services/files/textFileService";
import { convertProjectFileBytesToUtf8 } from "./src/services/files/encodingConversion";
import {
  createProjectFilePersistenceService,
  createProjectFileVersion,
  ProjectFileConflictError,
  readProjectFileVersionsFromDisk
} from "./src/services/files/projectFilePersistenceService";
import { HotExitRecoveryService } from "./src/services/files/hotExitRecoveryService";
import {
  TextFileFormatError,
  type ProjectFileReadProblem,
  type TextFileFormat
} from "./src/services/files/types";
import {
  ConfigurationPersistenceError,
  ConfigurationValidationError,
  WORKBENCH_CONFIGURATION_KEYS,
  createWorkbenchConfigurationService,
  type ConfigurationTarget,
  type ConfigurationValue,
  type WorkbenchConfigurationKey
} from "./src/services/configuration";
import {
  createProjectBuildCoordinator,
  ProjectBuildBusyError,
  ProjectBuildCancelledBeforeStartError,
  type ProjectBuildAdmission,
  type ProjectBuildLease
} from "./src/services/tasks/projectBuildCoordinator";
import {
  createProjectBuildSessionService,
  ProjectBuildPreparationError
} from "./src/services/tasks/projectBuildSessionService";
import { createBuildStepProviderRegistry } from "./src/services/build/providerRegistry";
import { BuildPipelineService } from "./src/services/build/buildPipeline";
import { createProtobufCodeGeneratorProvider } from "./src/services/build/protobufProvider";
import { createWindowsMsvcBuildTarget, runProjectCodeGenerators, type ProjectCodeGeneratorResult } from "./src/services/build/projectCodeGeneratorService";
import {
  formatServerReady,
  isServerSessionAuthorized,
  resolveServerRuntimeConfig,
  ServerReadyInfo,
  ServerRuntimeConfig
} from "./src/services/server/serverRuntime";

dotenv.config({ quiet: true });

let fbroRuntimeVipKey = String(process.env.LINGBUILDER_FBRO_VIP_KEY || '').trim().slice(0, 4096);
delete process.env.LINGBUILDER_FBRO_VIP_KEY;
const utilityParentPort = (process as typeof process & {
  parentPort?: { on: (event: 'message', listener: (message: { data?: unknown }) => void) => void };
}).parentPort;
utilityParentPort?.on('message', message => {
  const data = message.data as { type?: unknown; value?: unknown } | undefined;
  if (data?.type !== 'lingbuilder:fbro-vip-key') return;
  fbroRuntimeVipKey = typeof data.value === 'string' ? data.value.trim().slice(0, 4096) : '';
});

function createFbroRuntimeEnvironment(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...(fbroRuntimeVipKey ? { LINGBUILDER_FBRO_VIP_KEY: fbroRuntimeVipKey } : {})
  };
}

let serverRuntimeConfig = resolveServerRuntimeConfig(process.env);
// This process is already running as an Electron utility process. Ensure that
// any later process.execPath probe starts Electron in Node mode instead of
// recursively launching the packaged LingBuilder application.
if (serverRuntimeConfig.environment === "production") {
  process.env.ELECTRON_RUN_AS_NODE = "1";
}
let workspacePathPolicy = new WorkspacePathPolicy(serverRuntimeConfig.workspaceRoot);
let projectFileMutationService = createProjectFileMutationService(serverRuntimeConfig.workspaceRoot);
const projectFilePersistenceService = createProjectFilePersistenceService();
let hotExitRecoveryService = new HotExitRecoveryService(serverRuntimeConfig.workspaceRoot);
let workspaceSearchService = createWorkspaceSearchService(serverRuntimeConfig.workspaceRoot);
const managedProcessService = createManagedProcessService();
let activeEdgeControlPreviewProcessKey: string | undefined;
const edgeControlPreviewBuildDirs = new Map<string, string>();

async function cleanupEdgeControlPreviewBuild(processKey: string): Promise<void> {
  const buildDir = edgeControlPreviewBuildDirs.get(processKey);
  if (!buildDir) return;
  const previewRoot = path.resolve(getRepoWorkspaceRoot(), ".lingbuilder-build", "edgeview-control-preview");
  const resolvedBuildDir = path.resolve(buildDir);
  if (resolvedBuildDir !== previewRoot && resolvedBuildDir.startsWith(`${previewRoot}${path.sep}`)) {
    await fs.rm(resolvedBuildDir, { recursive: true, force: true });
  }
  edgeControlPreviewBuildDirs.delete(processKey);
}
const taskService = new TaskService();
const environmentRepairService = new EnvironmentRepairService();
const sdkCatalogEndpoint = resolveSdkCatalogEndpoint(process.env);
const sdkDependencyService = new SdkDependencyService({
  cacheRoot: resolveSdkCacheRoot(process.env),
  workspaceRoot: () => getRepoWorkspaceRoot(),
  environment: process.env,
  resourcesPath: process.env.LINGBUILDER_RESOURCE_ROOT,
  ...(sdkCatalogEndpoint ? {
    remoteCatalog: {
      url: sdkCatalogEndpoint.url,
      anchors: SDK_CATALOG_TRUST_ANCHORS,
      statePath: path.join(path.dirname(serverRuntimeConfig.userSettingsPath), "sdk-catalog-state.json")
    }
  } : {})
});
let buildConfigurationService = new BuildConfigurationService(serverRuntimeConfig.workspaceRoot);
let incrementalBuildService = new IncrementalBuildService(serverRuntimeConfig.workspaceRoot);
let ptyTerminalService = new PtyTerminalService(serverRuntimeConfig.workspaceRoot);
let terminalWorkspaceBridge: TerminalWebSocketBridge | null = null;
let nativeDebugService = new NativeDebugService(serverRuntimeConfig.workspaceRoot);
let gitService = new GitService(serverRuntimeConfig.workspaceRoot);
let testExplorerService = new TestExplorerService(serverRuntimeConfig.workspaceRoot);
const nodeTestDebugService = new NodeTestDebugService();
let qualityService = new QualityService(serverRuntimeConfig.workspaceRoot, TSX_IMPORT);
let extensionService = new ExtensionService(serverRuntimeConfig.workspaceRoot);
let dependencyService = new DependencyService(serverRuntimeConfig.workspaceRoot);
let rcResourceService = new RcResourceService(serverRuntimeConfig.workspaceRoot);
let designerAssetService = createDesignerAssetService(serverRuntimeConfig.workspaceRoot);
let windowsExecutableIconService = createWindowsExecutableIconService(serverRuntimeConfig.workspaceRoot, designerAssetService);
let performanceService = new PerformanceService(serverRuntimeConfig.workspaceRoot);
let publishingService = new PublishingService(serverRuntimeConfig.workspaceRoot);
let workspaceIndexService = new WorkspaceIndexService(serverRuntimeConfig.workspaceRoot);
let settingsSyncService = new SettingsSyncService(serverRuntimeConfig.workspaceRoot, serverRuntimeConfig.userSettingsPath);
let externalProjectService = new ExternalProjectService(serverRuntimeConfig.workspaceRoot);
const moduleAccessService = new ModuleAccessService();
let clangdService = new ClangdService({
  workspaceRoot: serverRuntimeConfig.workspaceRoot,
  command: process.env.LINGBUILDER_CLANGD_PATH || "clangd"
});
let lspWorkspaceEditService = new LspWorkspaceEditService(serverRuntimeConfig.workspaceRoot);
const projectBuildCoordinator = createProjectBuildCoordinator();
const projectBuildSessionService = createProjectBuildSessionService(
  projectBuildCoordinator,
  managedProcessService
);
const buildProviderRegistry = createBuildStepProviderRegistry([
  createProtobufCodeGeneratorProvider({
    sdkRoot: () => process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(getRepoWorkspaceRoot(), '.lingbuilder', 'toolchains', 'protobuf'),
    protocPath: () => path.join(process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(getRepoWorkspaceRoot(), '.lingbuilder', 'toolchains', 'protobuf'), 'bin', 'protoc.exe'),
    expectedSha256: process.env.LINGBUILDER_PROTOC_SHA256
  })
]);
const buildPipelineService = new BuildPipelineService(buildProviderRegistry);
let workbenchConfigurationService = createWorkbenchConfigurationService({
  workspaceRoot: serverRuntimeConfig.workspaceRoot,
  userSettingsPath: serverRuntimeConfig.userSettingsPath
});
let workbenchConfigurationInitialization = workbenchConfigurationService.initialize();
let lingBuilderAiRulebookCache: string | undefined;
let solutionServiceCache: ReturnType<typeof createSolutionService> | null = null;
let workspaceSwitchQueue: Promise<void> = Promise.resolve();
let workspaceRuntimeVersion = 1;

async function resolveWorkspaceSwitchTarget(value: unknown): Promise<string> {
  if (typeof value !== 'string' || !value.trim() || !path.isAbsolute(value.trim())) {
    throw new Error('工作区路径必须是绝对路径。');
  }
  const candidatePath = path.resolve(value.trim());
  const stat = await fs.stat(candidatePath);
  if (!stat.isDirectory()) throw new Error('工作区路径必须指向目录。');
  const candidatePolicy = new WorkspacePathPolicy(candidatePath);
  return await candidatePolicy.getRealWorkspaceRoot();
}

function isSameWorkspace(left: string, right: string): boolean {
  return path.resolve(left).localeCompare(path.resolve(right), undefined, {
    sensitivity: process.platform === 'win32' ? 'accent' : 'variant'
  }) === 0;
}

async function stopWorkspaceBoundServices(): Promise<void> {
  projectBuildCoordinator.cancelAll('user');
  await projectBuildCoordinator.waitForIdle();
  await Promise.allSettled([
    managedProcessService.stopAll(),
    nativeDebugService.stop(),
    clangdService.stop(),
    nodeTestDebugService.stop(),
    extensionService.stop()
  ]);
  ptyTerminalService.closeAll();
  performanceService.cancel();
  workspaceIndexService.cancel();
}

async function switchWorkspaceRuntime(requestedPath: unknown): Promise<{ workspacePath: string; version: number; changed: boolean }> {
  const candidateWorkspace = await resolveWorkspaceSwitchTarget(requestedPath);
  const operation = workspaceSwitchQueue.then(async () => {
    const currentWorkspace = serverRuntimeConfig.workspaceRoot;
    if (isSameWorkspace(currentWorkspace, candidateWorkspace)) {
      return { workspacePath: currentWorkspace, version: workspaceRuntimeVersion, changed: false };
    }

    await stopWorkspaceBoundServices();
    serverRuntimeConfig = { ...serverRuntimeConfig, workspaceRoot: candidateWorkspace };
    process.env.LINGBUILDER_WORKSPACE_ROOT = candidateWorkspace;
    workspacePathPolicy = new WorkspacePathPolicy(candidateWorkspace);
    projectFileMutationService = createProjectFileMutationService(candidateWorkspace);
    hotExitRecoveryService = new HotExitRecoveryService(candidateWorkspace);
    workspaceSearchService = createWorkspaceSearchService(candidateWorkspace);
    buildConfigurationService = new BuildConfigurationService(candidateWorkspace);
    incrementalBuildService = new IncrementalBuildService(candidateWorkspace);
    ptyTerminalService = new PtyTerminalService(candidateWorkspace);
    terminalWorkspaceBridge?.resync();
    nativeDebugService = new NativeDebugService(candidateWorkspace);
    gitService = new GitService(candidateWorkspace);
    testExplorerService = new TestExplorerService(candidateWorkspace);
    qualityService = new QualityService(candidateWorkspace, TSX_IMPORT);
    extensionService = new ExtensionService(candidateWorkspace);
    dependencyService = new DependencyService(candidateWorkspace);
    rcResourceService = new RcResourceService(candidateWorkspace);
    designerAssetService = createDesignerAssetService(candidateWorkspace);
    windowsExecutableIconService = createWindowsExecutableIconService(candidateWorkspace, designerAssetService);
    performanceService = new PerformanceService(candidateWorkspace);
    publishingService = new PublishingService(candidateWorkspace);
    workspaceIndexService = new WorkspaceIndexService(candidateWorkspace);
    settingsSyncService = new SettingsSyncService(candidateWorkspace, serverRuntimeConfig.userSettingsPath);
    externalProjectService = new ExternalProjectService(candidateWorkspace);
    clangdService = new ClangdService({
      workspaceRoot: candidateWorkspace,
      command: process.env.LINGBUILDER_CLANGD_PATH || "clangd"
    });
    lspWorkspaceEditService = new LspWorkspaceEditService(candidateWorkspace);
    workbenchConfigurationService = createWorkbenchConfigurationService({
      workspaceRoot: candidateWorkspace,
      userSettingsPath: serverRuntimeConfig.userSettingsPath
    });
    workbenchConfigurationInitialization = workbenchConfigurationService.initialize();
    solutionServiceCache = null;
    workspaceRuntimeVersion += 1;
    await workbenchConfigurationInitialization;
    void refreshWorkspaceBuildExcludeDirs();
    return { workspacePath: candidateWorkspace, version: workspaceRuntimeVersion, changed: true };
  });
  workspaceSwitchQueue = operation.then(() => undefined, () => undefined);
  return await operation;
}

async function getLingBuilderAiRulebook(): Promise<string> {
  if (lingBuilderAiRulebookCache !== undefined) return lingBuilderAiRulebookCache;
  try {
    lingBuilderAiRulebookCache = await fs.readFile(serverRuntimeConfig.rulebookPath, "utf8");
    return lingBuilderAiRulebookCache;
  } catch (error: any) {
    throw new Error(`LingBuilder AI 规则手册读取失败：${error?.message || String(error)}`);
  }
}

function getSolutionService() {
  if (!solutionServiceCache) {
    solutionServiceCache = createSolutionService(serverRuntimeConfig.workspaceRoot);
  }
  return solutionServiceCache;
}

const app = express();
const execFileAsync = promisify(execFile);
const ALLOWED_PROJECT_EXTS = [".lcpp", ".cpp", ".h", ".rc", ".xml", ".json", ".ini", ".e"];

class ProjectFileSaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectFileSaveValidationError";
  }
}

function isAllowedProjectTextPath(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return ALLOWED_PROJECT_EXTS.some(ext => normalized.endsWith(ext));
}

// Project saves include the complete source/config snapshot and designer model.
// Keep the request bounded, but allow normal module-heavy workspaces to exceed 2 MB.
app.use(express.json({ limit: "32mb" }));
app.use((req, res, next) => {
  const isAiBridgePath = req.path === "/api/ai-bridge" || req.path.startsWith("/api/ai-bridge/");
  if (!req.path.startsWith("/api/") || isAiBridgePath) {
    next();
    return;
  }
  if (serverRuntimeConfig.devNoAuth) {
    next();
    return;
  }
  const sessionToken = req.header("x-lingbuilder-session") || "";
  if (!isServerSessionAuthorized(serverRuntimeConfig, sessionToken)) {
    res.status(401).json({ ok: false, error: "LingBuilder 本地会话无效或缺失。" });
    return;
  }
  next();
});

function getAiBridgePermissionMode(): AiBridgePermissionMode {
  const value = process.env.LINGBUILDER_AI_BRIDGE_PERMISSION;
  return value === "readonly" || value === "preview" || value === "yolo" ? value : "preview";
}

function getRepoWorkspaceRoot() {
  return serverRuntimeConfig.workspaceRoot;
}

/**
 * 安装包随附的 default-workspace 根目录（含 .lingbuilder/modules 随包模块副本）。
 * 打包态由主进程经 LINGBUILDER_RESOURCE_ROOT 传入 resources 目录；开发态没有
 * default-workspace 时返回 undefined，模块面板不出现「修复重装」入口。
 */
function getBundledWorkspaceSource(): string | undefined {
  const resourceRoot = String(process.env.LINGBUILDER_RESOURCE_ROOT || "").trim();
  if (!resourceRoot) return undefined;
  const candidate = path.join(resourceRoot, "default-workspace");
  return existsSync(path.join(candidate, ".lingbuilder", "modules")) ? candidate : undefined;
}

function getModuleService() {
  return createModuleService(getRepoWorkspaceRoot(), { bundledWorkspaceSource: getBundledWorkspaceSource() });
}

function assertModuleAccess(moduleIds: readonly string[]): void {
  for (const moduleId of moduleIds) moduleAccessService.assertAccess(moduleId);
}

function assertEnabledModuleAccess(modules: readonly { manifest: { id: string } }[]): void {
  assertModuleAccess(modules.map(module => module.manifest.id));
}

async function requireEnabledModuleSdkDependencies(modules: readonly { manifest: { id: string } }[]): Promise<void> {
  await sdkDependencyService.requireForModules(modules.map(module => module.manifest.id));
}

function createSdkDependencyErrorPayload(error: unknown): { code?: string; dependencies?: unknown } {
  return error instanceof SdkDependencyRequiredError
    ? { code: error.code, dependencies: error.dependencies }
    : {};
}

async function requireExistingProject(projectId: string | undefined): Promise<string> {
  const normalizedProjectId = projectId?.trim();
  if (!normalizedProjectId) throw new Error("缺少 projectId，模块操作必须指定当前项目。");
  const solutionService = getSolutionService();
  const solution = await solutionService.getSolution();
  solutionService.getProject(solution, normalizedProjectId);
  return normalizedProjectId;
}

/**
 * 统一的项目构建输出目录解析：项目级 buildProperties 模板覆盖工作区默认，
 * 再回退内置缺省。所有 F5 构建、导出、运行日志链路都必须经此解析，
 * 禁止重新拼装 `.lingbuilder-build` / `generated/cpp` 字面量。
 */
async function resolveServerProjectBuildPaths(projectId: string, buildConfiguration: BuildConfiguration) {
  const solution = await getSolutionService().getSolution();
  const project = solution.projects.find(item => item.id === projectId);
  return resolveProjectBuildDirectories({
    workspaceRoot: getRepoWorkspaceRoot(),
    projectDirName: sanitizeFilename(projectId),
    projectName: project?.name,
    platform: buildConfiguration.architecture,
    configuration: buildConfiguration.mode,
    templates: {
      buildDirectory: project?.buildProperties?.buildDirectory?.trim() || buildConfiguration.buildDirectory,
      generatedSourceDirectory: project?.buildProperties?.generatedSourceDirectory?.trim() || buildConfiguration.generatedSourceDirectory
    }
  });
}

/** 刷新搜索/AI 索引的构建输出排除集：登记全部项目当前解析出的构建目录与生成源码目录。 */
async function refreshWorkspaceBuildExcludeDirs(): Promise<void> {
  const dirs = new Set<string>();
  try {
    const configuration = await buildConfigurationService.read();
    const workspaceRoot = getRepoWorkspaceRoot();
    const solution = await getSolutionService().getSolution();
    for (const project of solution.projects) {
      try {
        const resolved = resolveProjectBuildDirectories({
          workspaceRoot,
          projectDirName: sanitizeFilename(project.id),
          projectName: project.name,
          platform: project.type === "visual-cpp" ? configuration.architecture : (project.buildProperties?.architecture || configuration.architecture),
          configuration: project.type === "visual-cpp" ? configuration.mode : (project.buildProperties?.configuration || configuration.mode),
          templates: {
            buildDirectory: project.buildProperties?.buildDirectory?.trim() || configuration.buildDirectory,
            generatedSourceDirectory: project.buildProperties?.generatedSourceDirectory?.trim() || configuration.generatedSourceDirectory
          }
        });
        dirs.add(normalizeFilePath(path.relative(workspaceRoot, resolved.buildDir)));
        dirs.add(normalizeFilePath(path.relative(workspaceRoot, resolved.exportDir)));
      } catch {
        // 单个项目的目录配置冲突不阻断其他目录登记。
      }
    }
  } catch {
    // 解决方案尚未就绪时保留现有排除集。
  }
  setActiveWorkspaceBuildExcludeDirs([...dirs]);
}

function normalizeWorkspaceRelativePath(value: string, allowedRoot?: string): string {
  if (!value?.trim()) throw new Error("缺少工作区相对路径。");
  const normalized = value.trim().replace(/\\/gu, "/");
  if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/u.test(normalized)) {
    throw new Error("模块 HTTP API 只接受工作区相对路径；本机绝对路径仅允许通过 CLI 使用。");
  }
  const collapsed = path.posix.normalize(normalized).replace(/^\.\//u, "");
  if (collapsed === ".." || collapsed.startsWith("../")) {
    throw new Error("路径越界：只能访问当前 LingBuilder 工作区内的文件。");
  }
  if (allowedRoot && collapsed !== allowedRoot && !collapsed.startsWith(`${allowedRoot}/`)) {
    throw new Error(`该操作只允许访问 ${allowedRoot} 目录。`);
  }
  return collapsed;
}

async function resolveExistingModulePath(value: string, allowedRoot?: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveExisting(relativePath, { rejectSymlinks: true });
}

async function resolveModuleWritePath(value: string, allowedRoot: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveForWrite(relativePath);
}

async function resolveModuleWriteDirectory(value: string, allowedRoot: string): Promise<string> {
  const relativePath = normalizeWorkspaceRelativePath(value, allowedRoot);
  return await workspacePathPolicy.resolveDirectoryForWrite(relativePath);
}

async function toSafeHttpPackagePath(value: string | undefined): Promise<string | undefined> {
  if (!value) return undefined;
  try {
    if (!path.isAbsolute(value)) {
      const relativePath = normalizeWorkspaceRelativePath(value, ".lingbuilder/module-packages");
      await workspacePathPolicy.resolveExisting(relativePath, { rejectSymlinks: true });
      return relativePath;
    }
    const realPath = await fs.realpath(value);
    const relativePath = await workspacePathPolicy.toWorkspaceRelative(realPath);
    return normalizeWorkspaceRelativePath(relativePath, ".lingbuilder/module-packages");
  } catch {
    return undefined;
  }
}

const aiBridgeServiceOptions: AiBridgeServerOptions = {
  workspaceRoot: getRepoWorkspaceRoot(),
  host: serverRuntimeConfig.host,
  port: serverRuntimeConfig.port,
  token: serverRuntimeConfig.aiBridgeToken,
  permission: 'preview',
  allowRemote: false,
  enableMcp: false
};
const aiBridgeServiceDependencies = {
  managedProcessService,
  projectBuildCoordinator,
  buildPipelineService,
  assertModuleAccess
};
if (serverRuntimeConfig.aiBridgeEnabled) {
  const aiBridgeService = new AiBridgeService(
    { ...aiBridgeServiceOptions, permission: getAiBridgePermissionMode() },
    aiBridgeServiceDependencies
  );
  // 不再全局注入 planner：内嵌 Bridge 与独立 lingbuilder ai-server 行为一致，
  // 外部 AI 的 files[] 草稿直接生效；系统 AI planner 由面板路由显式传入。
  app.use(
    "/api/ai-bridge",
    createAiBridgeRouter(aiBridgeService, serverRuntimeConfig.aiBridgeToken)
  );
} else {
  app.use("/api/ai-bridge", (_req, res) => {
    res.status(404).json({ ok: false, error: "内嵌 AI Bridge 未启用；请使用 lingbuilder ai-server 显式启动。" });
  });
}

// API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/configuration", async (_req, res) => {
  try {
    await workbenchConfigurationInitialization;
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "读取工作台设置失败。");
  }
});

app.patch("/api/configuration", async (req, res) => {
  const { key, target, value } = req.body as {
    key?: string;
    target?: ConfigurationTarget;
    value?: ConfigurationValue;
  };
  if (!isWorkbenchConfigurationKey(key) || !isConfigurationTarget(target)) {
    return res.status(400).json({ ok: false, error: "设置更新缺少有效 key 或 target。" });
  }
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, "value")) {
    return res.status(400).json({ ok: false, error: "设置更新缺少 value；如需恢复默认值请使用 DELETE。" });
  }

  try {
    await workbenchConfigurationInitialization;
    await workbenchConfigurationService.update(key, value as ConfigurationValue, target);
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "保存工作台设置失败。");
  }
});

app.delete("/api/configuration/:key", async (req, res) => {
  const key = req.params.key;
  const target = req.query.target;
  if (!isWorkbenchConfigurationKey(key) || !isConfigurationTarget(target)) {
    return res.status(400).json({ ok: false, error: "恢复设置缺少有效 key 或 target。" });
  }

  try {
    await workbenchConfigurationInitialization;
    await workbenchConfigurationService.delete(key, target);
    res.json({ ok: true, ...workbenchConfigurationService.snapshot() });
  } catch (error) {
    respondWithConfigurationError(res, error, "恢复工作台设置失败。");
  }
});

app.post("/api/workspace-search/query", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.query(req.body));
});

app.post("/api/workspace-search/preview", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.preview(req.body));
});

app.post("/api/workspace-search/apply", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.apply(req.body));
});

app.post("/api/workspace-search/rollback", async (req, res) => {
  await handleWorkspaceSearchRequest(res, () => workspaceSearchService.rollback(req.body));
});

app.get("/api/environment/check", async (_req, res) => {
  try {
    const result = await checkDevelopmentEnvironment();
    const metadata: Record<string, { label: string; required: boolean }> = {
      node: { label: "Node.js", required: true },
      msvc: { label: "MSVC C++ 编译器", required: true },
      windowsSdk: { label: "Windows SDK / rc.exe", required: true },
      cmake: { label: "CMake", required: false },
      gpp: { label: "GNU g++", required: false },
      clangpp: { label: "Clang++", required: false },
      webView2: { label: "WebView2 Runtime", required: false },
      webView2Sdk: { label: "WebView2 SDK（EdgeView 构建）", required: false },
      platform: { label: "Windows 运行平台", required: true }
    };
    const checks = Object.entries(result.checks).map(([id, item]) => ({
      id,
      label: metadata[id]?.label || id,
      required: metadata[id]?.required || false,
      ...item
    }));
    res.json({
      ok: true,
      ready: result.ready,
      cppCompilerAvailable: result.cppCompilerAvailable,
      msvcBuildReady: result.msvcBuildReady,
      warnings: result.warnings,
      checkedAt: result.checkedAt,
      platform: result.checks.platform.detail,
      checks
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "开发环境检测失败。" });
  }
});

app.get("/api/environment/repair/status", (_req, res) => {
  res.json({ ok: true, repair: environmentRepairService.status() });
});

app.post("/api/environment/repair/start", (req, res) => {
  const target = req.body?.target;
  if (!isEnvironmentRepairTarget(target)) {
    return res.status(400).json({ ok: false, error: "环境修复目标无效。" });
  }
  try {
    const repair = environmentRepairService.start(target);
    res.status(202).json({ ok: true, repair });
  } catch (error) {
    const status = error instanceof EnvironmentRepairBusyError ? 409 : 400;
    res.status(status).json({
      ok: false,
      error: error instanceof Error ? error.message : "启动环境修复失败。"
    });
  }
});

app.get("/api/sdk-dependencies/status", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await sdkDependencyService.overview()) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "读取 SDK 依赖状态失败。" });
  }
});

app.post("/api/sdk-dependencies/install", (req, res) => {
  const dependencyId = req.body?.dependencyId;
  if (!SDK_DEPENDENCY_RESOURCES.some(item => item.id === dependencyId)) {
    return res.status(400).json({ ok: false, error: "SDK 依赖标识无效。" });
  }
  try {
    res.status(202).json({ ok: true, job: sdkDependencyService.start(dependencyId as SdkDependencyId) });
  } catch (error) {
    const status = error instanceof SdkDependencyBusyError ? 409 : 400;
    res.status(status).json({ ok: false, error: error instanceof Error ? error.message : "启动 SDK 下载失败。" });
  }
});

app.post("/api/sdk-dependencies/cancel", (_req, res) => {
  res.json({ ok: true, job: sdkDependencyService.cancel() });
});

app.post("/api/module-access/sync", (req, res) => {
  try {
    const status = moduleAccessService.sync(req.body || {});
    res.json({ ok: true, status });
  } catch (error: any) {
    res.status(400).json({ ok: false, code: "MODULE_PERMIT_INVALID", error: error?.message || "模块授权同步失败。" });
  }
});

app.post("/api/module-access/clear", (_req, res) => {
  moduleAccessService.clear();
  res.json({ ok: true });
});

app.get("/api/module-access/status", (req, res) => {
  const moduleId = String(req.query.moduleId || "");
  // 不带 moduleId 时返回全部已缓存 Permit 的权益状态：渲染层启动检查用，
  // 把过期授权在构建前就显性化（输出面板提示），而不是埋到 F5 被 402 拦下才发现。
  if (!moduleId) return res.json({ ok: true, modules: moduleAccessService.listStatuses() });
  res.json({ ok: true, status: moduleAccessService.status(moduleId) });
});

app.get("/api/modules/installed", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const validatedProjectId = await requireExistingProject(projectId);
    res.json({ ok: true, modules: await getModuleService().scanInstalledModules(validatedProjectId) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块扫描失败" });
  }
});

app.get("/api/modules/document", async (req, res) => {
  const moduleId = String(req.query.moduleId || "").trim();
  const documentPath = String(req.query.path || "").trim();
  if (!moduleId || !documentPath) {
    res.status(400).json({ ok: false, error: "缺少模块 ID 或文档路径。" });
    return;
  }
  try {
    const module = (await getModuleService().scanInstalledModules())
      .find(candidate => candidate.manifest.id === moduleId);
    if (!module) {
      res.status(404).json({ ok: false, error: "没有找到该模块。" });
      return;
    }
    const document = await readModuleDocumentation(module, documentPath, {
      workspaceRoot: getRepoWorkspaceRoot(),
      resourceRoot: process.env.LINGBUILDER_RESOURCE_ROOT || process.cwd()
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ ok: true, document });
  } catch (error) {
    const status = error instanceof ModuleDocumentationError
      ? error.code === "MODULE_DOCUMENT_TOO_LARGE" ? 413
        : error.code === "MODULE_DOCUMENT_NOT_FOUND" ? 404
          : 400
      : 500;
    res.status(status).json({
      ok: false,
      code: error instanceof ModuleDocumentationError ? error.code : "MODULE_DOCUMENT_READ_FAILED",
      error: error instanceof Error ? error.message : "模块文档读取失败。"
    });
  }
});

app.get("/api/modules/project", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const validatedProjectId = await requireExistingProject(projectId);
    const modules = await getModuleService().getEnabledProjectModules(validatedProjectId);
    // 项目级 DLL 命令声明：虚拟模块作为独立字段返回，由补全上下文合并；
    // 模块管理 UI（侧边栏模块组/模块检查器）读取 modules，不显示虚拟模块。
    const sources = await resolveLingCppProjectSources(validatedProjectId, undefined);
    const projectDeclarationModule = createProjectDllDeclarationModuleFromSources(sources, validatedProjectId) ?? null;
    res.json({ ok: true, modules, projectDeclarationModule });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "项目模块读取失败" });
  }
});

app.get("/api/modules/project/designer", async (req, res) => {
  try {
    const { projectId } = req.query as { projectId?: string };
    const validatedProjectId = await requireExistingProject(projectId);
    const modules = await getModuleService().getEnabledProjectModules(validatedProjectId);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ok: true,
      modules: modules.map(module => ({
        manifest: {
          id: module.manifest.id,
          name: module.manifest.name,
          version: module.manifest.version,
          contributes: {
            designerControls: module.manifest.contributes?.designerControls || [],
            menus: module.manifest.contributes?.menus || [],
            submenus: module.manifest.contributes?.submenus || []
          }
        }
      }))
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "设计器模块读取失败" });
  }
});

app.post("/api/modules/project/enable", async (req, res) => {
  try {
    const { projectId, moduleId, moduleIds } = req.body as { projectId?: string; moduleId?: string; moduleIds?: string[] };
    const requestedModuleIds = Array.isArray(moduleIds)
      ? [...new Set(moduleIds.map(item => String(item || '').trim()).filter(Boolean))]
      : moduleId ? [moduleId] : [];
    if (requestedModuleIds.length === 0) return res.status(400).json({ ok: false, error: "缺少 moduleId 或 moduleIds" });
    const validatedProjectId = await requireExistingProject(projectId);
    requestedModuleIds.forEach(requestedModuleId => moduleAccessService.assertAccess(requestedModuleId));
    const plan = await getModuleService().planEnableModulesForProject(validatedProjectId, requestedModuleIds);
    plan.addedModuleIds.forEach(dependencyModuleId => moduleAccessService.assertAccess(dependencyModuleId));
    await getModuleService().enableModulesForProject(validatedProjectId, requestedModuleIds);
    const enabledModules = await getModuleService().getEnabledProjectModules(validatedProjectId);
    const compatibility = await buildConfigurationService.ensureCompatibleWithModules(enabledModules.map(module => module.manifest.id));
    res.json({ ok: true, plan, buildConfiguration: compatibility.configuration, buildConfigurationChanged: compatibility.changed, messages: compatibility.messages });
  } catch (error: any) {
    res.status(error?.status || 500).json({ ok: false, code: error?.code, error: error?.message || "启用模块失败" });
  }
});

app.post("/api/modules/project/disable", async (req, res) => {
  try {
    const { projectId, moduleId, cascade = false } = req.body as { projectId?: string; moduleId?: string; cascade?: boolean };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    const validatedProjectId = await requireExistingProject(projectId);
    const plan = await getModuleService().planDisableModuleForProject(validatedProjectId, moduleId);
    await getModuleService().disableModuleForProject(validatedProjectId, moduleId, { cascade });
    res.json({ ok: true, plan });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "禁用模块失败" });
  }
});

app.post("/api/modules/project/change-plan", async (req, res) => {
  try {
    const { projectId, moduleId, moduleIds, action } = req.body as { projectId?: string; moduleId?: string; moduleIds?: string[]; action?: 'enable' | 'disable' };
    const requestedModuleIds = Array.isArray(moduleIds)
      ? [...new Set(moduleIds.map(item => String(item || '').trim()).filter(Boolean))]
      : moduleId ? [moduleId] : [];
    if (requestedModuleIds.length === 0) return res.status(400).json({ ok: false, error: "缺少 moduleId 或 moduleIds" });
    const validatedProjectId = await requireExistingProject(projectId);
    if (action === 'enable') {
      requestedModuleIds.forEach(requestedModuleId => moduleAccessService.assertAccess(requestedModuleId));
      const plan = await getModuleService().planEnableModulesForProject(validatedProjectId, requestedModuleIds);
      plan.addedModuleIds.forEach(dependencyModuleId => moduleAccessService.assertAccess(dependencyModuleId));
      return res.json({ ok: true, plan });
    }
    if (action === 'disable') {
      if (requestedModuleIds.length !== 1) return res.status(400).json({ ok: false, error: "禁用计划每次只能指定一个 moduleId" });
      return res.json({ ok: true, plan: await getModuleService().planDisableModuleForProject(validatedProjectId, requestedModuleIds[0]) });
    }
    return res.status(400).json({ ok: false, error: "action 必须是 enable 或 disable" });
  } catch (error: any) {
    res.status(error?.status || 500).json({ ok: false, code: error?.code, error: error?.message || "模块变更计划生成失败" });
  }
});

app.post("/api/modules/package/preview", async (req, res) => {
  try {
    const { packagePath } = req.body as { packagePath?: string };
    if (!packagePath) return res.status(400).json({ ok: false, error: "缺少 packagePath" });
    const resolvedPackagePath = await resolveExistingModulePath(packagePath, ".lingbuilder/module-packages");
    res.json({ ok: true, preview: await getModuleService().previewPackageInstall(resolvedPackagePath) });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包预览失败" });
  }
});

app.post("/api/modules/package/install", async (req, res) => {
  try {
    const { previewId, projectId, enableForProject = true } = req.body as { previewId?: string; projectId?: string; enableForProject?: boolean };
    if (!previewId) return res.status(400).json({ ok: false, error: "缺少 previewId" });
    const validatedProjectId = await requireExistingProject(projectId);
    const preview = getModuleService().getPackageInstallPreview(previewId);
    if (!preview?.manifest) return res.status(400).json({ ok: false, error: "安装预览不存在或已经失效。" });
    moduleAccessService.assertAccess(preview.manifest.id);
    const result = await getModuleService().installPackage(previewId);
    if (enableForProject) {
      await getModuleService().enableModuleForProject(validatedProjectId, result.moduleId);
    }
    const compatibility = enableForProject
      ? await buildConfigurationService.ensureCompatibleWithModules(
        (await getModuleService().getEnabledProjectModules(validatedProjectId)).map(module => module.manifest.id)
      )
      : undefined;
    res.json({
      ok: true,
      result,
      buildConfiguration: compatibility?.configuration,
      buildConfigurationChanged: compatibility?.changed || false,
      messages: compatibility?.messages || []
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({ ok: false, code: error?.code, error: error?.message || "模块安装失败" });
  }
});

app.get("/api/solution", async (_req, res) => {
  try {
    const solution = await getSolutionService().getSolution();
    res.json({ ok: true, solution });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "解决方案读取失败" });
  }
});

app.get("/api/solution/watch", async (req, res) => {
  try {
    await getSolutionService().getSolution();
    const solutionDirectory = path.join(getRepoWorkspaceRoot(), ".lingbuilder");
    await fs.mkdir(solutionDirectory, { recursive: true });
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    let disposed = false;
    let pendingTimer: NodeJS.Timeout | undefined;
    const sendSolutionChange = () => {
      if (disposed) return;
      res.write(`event: solution-change\ndata: ${JSON.stringify({ reason: "solution-file-changed" })}\n\n`);
    };
    const sendNavigation = async () => {
      if (disposed) return;
      try {
        const navigationPath = path.join(solutionDirectory, "ai-bridge", "workbench-navigation.json");
        const navigation = JSON.parse(await fs.readFile(navigationPath, "utf8")) as Record<string, unknown>;
        if (navigation.action !== "open-project" || typeof navigation.requestId !== "string" || typeof navigation.projectId !== "string" || typeof navigation.filePath !== "string") return;
        res.write(`event: workbench-navigation\ndata: ${JSON.stringify(navigation)}\n\n`);
      } catch (error: any) {
        if (error?.code !== "ENOENT") console.warn("工作台导航请求读取失败：", error?.message || error);
      }
    };
    const handleChange = (_eventType: string, fileName: string | Buffer | null) => {
      const changedName = fileName ? String(fileName).replace(/\\/g, "/") : "";
      if (!changedName || changedName === "solution.json") sendSolutionChange();
      if (changedName === "ai-bridge" || changedName === "ai-bridge/workbench-navigation.json") {
        if (pendingTimer) clearTimeout(pendingTimer);
        pendingTimer = setTimeout(() => { pendingTimer = undefined; void sendNavigation(); }, 40);
      }
    };
    const watcher = watchFiles(solutionDirectory, { recursive: true }, handleChange);
    sendSolutionChange();
    await sendNavigation();
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
    req.on("close", () => {
      disposed = true;
      if (pendingTimer) clearTimeout(pendingTimer);
      clearInterval(heartbeat);
      watcher.close();
    });
  } catch (error: any) {
    if (!res.headersSent) res.status(400).json({ ok: false, error: error?.message || "解决方案监听失败。" });
    else res.end();
  }
});

app.post("/api/solution/navigation/ack", async (req, res) => {
  const requestId = typeof req.body?.requestId === "string" ? req.body.requestId.trim() : "";
  if (!requestId) return res.status(400).json({ ok: false, error: "缺少导航请求 ID。" });
  try {
    const navigationPath = path.join(getRepoWorkspaceRoot(), ".lingbuilder", "ai-bridge", "workbench-navigation.json");
    const current = JSON.parse(await fs.readFile(navigationPath, "utf8")) as { requestId?: string };
    if (current.requestId === requestId) await fs.rm(navigationPath, { force: true });
    res.json({ ok: true });
  } catch (error: any) {
    if (error?.code === "ENOENT") return res.json({ ok: true });
    res.status(400).json({ ok: false, error: error?.message || "导航请求确认失败。" });
  }
});

app.post("/api/workspace/switch", async (req, res) => {
  try {
    const result = await switchWorkspaceRuntime(req.body?.workspacePath);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "工作区切换失败。" });
  }
});

app.post("/api/solution/projects", async (req, res) => {
  try {
    const body = req.body || {};
    const requestedDirectory = typeof body.projectDirectory === "string" ? body.projectDirectory.trim() : "";
    if (requestedDirectory && path.isAbsolute(requestedDirectory)) {
      const resolvedDirectory = path.resolve(requestedDirectory);
      const relativeToWorkspace = path.relative(path.resolve(serverRuntimeConfig.workspaceRoot), resolvedDirectory);
      const insideWorkspace = relativeToWorkspace === ""
        || (!relativeToWorkspace.startsWith("..") && !path.isAbsolute(relativeToWorkspace));
      if (!insideWorkspace) {
        // 工作区外的绝对路径（含其他磁盘）：创建独立、自包含的项目工作区。
        const standalone = await getSolutionService().createProjectWorkspace(body);
        res.json({
          ok: true,
          ...standalone,
          workspacePath: standalone.workspaceRoot,
          logs: [`已新建项目：${standalone.project.name} (${standalone.project.id})`, ...(standalone.logs ?? [])]
        });
        return;
      }
    }
    const result = await getSolutionService().createProject(body);
    res.json({
      ok: true,
      ...result,
      logs: [`已新建项目：${result.project.name} (${result.project.id})`, ...(result.logs ?? [])]
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "新建项目失败" });
  }
});
app.post("/api/solution/folders", async (req, res) => {
  try {
    const result = await getSolutionService().createFolder(req.body || {});
    res.json({ ok: true, ...result, logs: [`已新建解决方案文件夹：${result.folder.name}`] });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "新建解决方案文件夹失败" });
  }
});
app.post("/api/solution/import", async (req, res) => {
  try {
    if (!isNonEmptyString(req.body?.projectFile)) return res.status(400).json({ ok: false, error: "缺少要导入的工程路径。" });
    const mode = req.body?.mode === "single" ? "single" : "expand";
    const result = await getSolutionService().importExternalProject(req.body.projectFile, { mode });
    const logs = [`已导入 ${result.project.type}：${result.project.name}`, ...(result.logs || []), ...(result.warnings || [])];
    if (result.projects && result.projects.length > 1) {
      logs.unshift(`.sln 展开导入：共 ${result.projects.length} 个项目。`);
    }
    res.json({ ok: true, ...result, logs });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

// 打开文件夹后的「检测到现有 C++ 工程」提示数据：只读浅层扫描。
app.get("/api/solution/external-detect", async (_req, res) => {
  try {
    res.json({ ok: true, ...(await detectExternalCppProjects(serverRuntimeConfig.workspaceRoot)) });
  } catch (error: any) { res.status(500).json({ ok: false, error: error?.message || "检测已有工程失败" }); }
});

// 源码目录导入：生成最小 CMakeLists.txt（生成物，可自由修改）并作为 CMake 工程导入。
app.post("/api/solution/import-source-directory", async (req, res) => {
  try {
    const directory = typeof req.body?.directory === "string" ? req.body.directory.trim() : "";
    if (!directory) return res.status(400).json({ ok: false, error: "缺少要导入的源码目录。" });
    const overwrite = req.body?.overwrite === true;
    const result = await getSolutionService().importSourceDirectory(directory, { overwrite });
    res.json({
      ok: true,
      ...result,
      logs: [
        `已扫描到 ${result.sourceFiles.length} 个 C/C++ 源码文件，生成 ${result.generatedCMakeListsPath}（生成物，可自由修改）。`,
        `已导入 ${result.project.type}：${result.project.name}`
      ]
    });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

// 原生 C++ 源码适配：读取 .cpp 翻译为新的中文工程（不改原文件），未识别语句降级为 @ 原生块。
app.post("/api/solution/adapt-native-cpp", async (req, res) => {
  try {
    const projectFile = typeof req.body?.projectFile === "string" ? req.body.projectFile.trim() : "";
    if (!projectFile) return res.status(400).json({ ok: false, error: "缺少要适配的源码文件。" });
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    const result = await getSolutionService().adaptNativeCppToProject(projectFile, { name });
    res.json({
      ok: true,
      ...result,
      logs: [
        ...result.report,
        ...result.diagnostics.map(item => `警告：${item}`),
        result.preservedNativeBlockCount > 0 ? `已保留 ${result.preservedNativeBlockCount} 段 @ 原生代码块，可在中文工程中继续处理。` : "",
        `已创建中文工程：${result.project.name}（原 C++ 源码未修改）。`
      ].filter(Boolean)
    });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.patch("/api/solution/projects/:projectId", async (req, res) => {
  try {
    const solution = await getSolutionService().updateProject(req.params.projectId, req.body || {});
    void refreshWorkspaceBuildExcludeDirs();
    res.json({ ok: true, solution });
  } catch (error: any) {
    res.status(/循环|不存在|不能引用|名称|已存在|不能为空|超过|重合|路径|宏|非法|保留目录/iu.test(error?.message || "") ? 400 : 500).json({ ok: false, error: error?.message || "更新项目失败" });
  }
});

app.delete("/api/solution/projects/:projectId", async (req, res) => {
  try {
    const projectId = req.params.projectId.trim();
    if (!projectId) return res.status(400).json({ ok: false, error: "缺少要删除的项目 ID。" });
    const cancelledActiveBuild = projectBuildCoordinator.cancel(projectId, "project-delete");
    const stoppedProcess = await managedProcessService.stop(projectId);
    if (stoppedProcess.found && !stoppedProcess.stopped) {
      return res.status(409).json({
        ok: false,
        error: `项目运行进程未能停止，已取消删除以保护项目文件。${stoppedProcess.message}`
      });
    }
    if (cancelledActiveBuild) {
      return res.status(409).json({
        ok: false,
        error: "该项目的生成任务已取消但尚未退出。请等待当前任务结束后再次删除项目。"
      });
    }
    const deleteFiles = String(req.query.deleteFiles || "false") === "true";
    const result = await getSolutionService().deleteProject(projectId, { deleteFiles });
    res.json({
      ok: true,
      ...result,
      logs: [
        deleteFiles
          ? `已删除项目文件并从解决方案移除：${projectId}`
          : `已从解决方案移除项目引用：${projectId}`
      ]
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "删除项目失败" });
  }
});

app.post("/api/solution/clean", async (req, res) => {
  let createdTaskId: string | undefined;
  try {
    const { projectId } = req.body as { projectId?: string };
    let cleanProjectLabel = projectId || "";
    try {
      const solutionForTitle = await getSolutionService().getSolution();
      if (projectId) {
        cleanProjectLabel = solutionForTitle.projects.find(project => project.id === projectId)?.name || projectId;
      }
    } catch {
      // 标题取不到中文名时回退项目 id，不阻断清理任务。
    }
    const task = taskService.enqueue({
      type: "solution.clean", title: projectId ? `清理项目 ${cleanProjectLabel}` : "清理解决方案", group: `build:${projectId || "solution"}`,
      run: async context => {
        context.report(10, "开始清理构建产物。");
        const result = await getSolutionService().cleanProjects(projectId ? [projectId] : undefined);
        result.logs.forEach(line => context.log(line)); context.report(100); return result;
      }
    });
    createdTaskId = task.id;
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    const failureBody: Record<string, unknown> = { ok: false, error: error?.message || "清理解决方案失败" };
    if (createdTaskId) failureBody.taskId = createdTaskId;
    res.status(500).json(failureBody);
  }
});

app.post("/api/solution/build", async (req, res) => {
  let createdTaskId: string | undefined;
  try {
    const { projectId, run = false } = req.body as { projectId?: string; run?: boolean };
    const admission = projectBuildCoordinator.captureGlobalAdmission();
    const task = await enqueueSolutionBuildTask({ projectId, run, admission, rebuild: false });
    createdTaskId = task.id;
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    // 任务已创建时 taskId 必须随失败响应回传：日志行已进任务通道，前端据此不再重复播报。
    // 收费模块权益失败（402）必须把 code/moduleId 一起回传：渲染层据此走共享授权恢复流后重试。
    const failureBody: Record<string, unknown> = { ok: false, stage: "server", code: error?.code, moduleId: error?.moduleId, error: error?.message || "生成解决方案失败" };
    if (createdTaskId) failureBody.taskId = createdTaskId;
    res.status(error?.status || 500).json(failureBody);
  }
});

app.post("/api/solution/rebuild", async (req, res) => {
  let createdTaskId: string | undefined;
  try {
    const { projectId, run = false } = req.body as { projectId?: string; run?: boolean };
    const admission = projectBuildCoordinator.captureGlobalAdmission();
    const task = await enqueueSolutionBuildTask({ projectId, run, admission, rebuild: true });
    createdTaskId = task.id;
    res.json({ ...await task.result, taskId: task.id });
  } catch (error: any) {
    const failureBody: Record<string, unknown> = { ok: false, stage: "server", code: error?.code, moduleId: error?.moduleId, error: error?.message || "重新生成解决方案失败" };
    if (createdTaskId) failureBody.taskId = createdTaskId;
    res.status(error?.status || 500).json(failureBody);
  }
});

app.get("/api/tasks", (_req, res) => res.json({ ok: true, tasks: taskService.list() }));
app.get("/api/build-configuration", async (_req, res) => res.json({ ok: true, configuration: await buildConfigurationService.read() }));
app.put("/api/build-configuration", async (req, res) => {
  try { const configuration = await buildConfigurationService.write(req.body); void refreshWorkspaceBuildExcludeDirs(); res.json({ ok: true, configuration }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.get("/api/tasks/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  taskService.list().forEach(task => res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`));
  const unsubscribe = taskService.subscribe(task => res.write(`event: task\ndata: ${JSON.stringify(task)}\n\n`));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});
app.post("/api/tasks/:taskId/cancel", (req, res) => {
  const cancelled = taskService.cancel(req.params.taskId, "用户通过工作台取消任务。");
  if (!cancelled) return res.status(404).json({ ok: false, error: "任务不存在或已结束。" });
  res.json({ ok: true });
});

app.get("/api/terminal/sessions", (_req, res) => res.json({ ok: true, sessions: ptyTerminalService.list() }));
app.post("/api/terminal/sessions", async (req, res) => {
  try { res.status(201).json({ ok: true, session: await ptyTerminalService.create(req.body || {}) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "创建终端失败。" }); }
});
app.post("/api/terminal/sessions/:sessionId/input", (req, res) => {
  try { ptyTerminalService.write(req.params.sessionId, req.body?.data); res.json({ ok: true }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "终端输入失败。" }); }
});
app.post("/api/terminal/sessions/:sessionId/resize", (req, res) => {
  try { res.json({ ok: true, session: ptyTerminalService.resize(req.params.sessionId, req.body?.cols, req.body?.rows) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "调整终端大小失败。" }); }
});
app.post("/api/terminal/ws-ticket", (_req, res) => {
  try { res.json({ ok: true, ticket: createTerminalWebSocketTicket() }); }
  catch (error: any) { res.status(500).json({ ok: false, error: error?.message || "终端通道票据发放失败。" }); }
});
app.delete("/api/terminal/sessions/:sessionId", (req, res) => {
  if (!ptyTerminalService.close(req.params.sessionId)) return res.status(404).json({ ok: false, error: "终端会话不存在。" });
  res.json({ ok: true });
});

app.get("/api/debug/session", (_req, res) => res.json({ ok: true, session: nativeDebugService.getSnapshot() }));
app.get("/api/debug/inspection", async (req, res) => {
  try {
    const threadId = req.query.threadId ? Number(req.query.threadId) : undefined; const frameId = req.query.frameId ? Number(req.query.frameId) : undefined;
    res.json({ ok: true, inspection: await nativeDebugService.inspect(threadId, frameId) });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取调试上下文失败。" }); }
});
app.get("/api/debug/variables/:reference", async (req, res) => {
  try { res.json({ ok: true, variables: await nativeDebugService.variables(Number(req.params.reference), Number(req.query.start || 0), Number(req.query.count || 200)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取子变量失败。" }); }
});
app.post("/api/debug/evaluate", async (req, res) => {
  try { res.json({ ok: true, evaluation: await nativeDebugService.evaluate(req.body?.expression, req.body?.frameId) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "计算监视表达式失败。" }); }
});
app.get("/api/debug/registers", async (req, res) => {
  try { res.json({ ok: true, registers: await nativeDebugService.registers(Number(req.query.frameId)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取寄存器失败。" }); }
});
app.get("/api/debug/memory", async (req, res) => {
  try { res.json({ ok: true, memory: await nativeDebugService.readMemory(String(req.query.reference || ""), Number(req.query.offset || 0), Number(req.query.count || 256)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取内存失败。" }); }
});
app.get("/api/debug/disassembly", async (req, res) => {
  try { res.json({ ok: true, instructions: await nativeDebugService.disassemble(String(req.query.reference || ""), Number(req.query.offset || 0), Number(req.query.count || 64)) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "读取反汇编失败。" }); }
});
app.post("/api/debug/attach", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.attach({ pid: Number(req.body?.pid), program: req.body?.program }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "附加进程失败。" }); }
});
app.post("/api/debug/dump", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.openDump({ program: req.body?.program, coreFile: req.body?.coreFile }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "打开转储失败。" }); }
});
app.post("/api/debug/remote", async (req, res) => {
  try { await nativeDebugService.stop(); res.json({ ok: true, session: await nativeDebugService.connectRemote({ program: req.body?.program, host: req.body?.host, port: Number(req.body?.port) }) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "远程调试连接失败。" }); }
});
app.post("/api/debug/start", async (req, res) => {
  try {
    const { projectId, breakpoints = [], stopAtEntry = false } = req.body as { projectId?: string; breakpoints?: Array<{ filePath: string; line: number; condition?: string }>; stopAtEntry?: boolean };
    if (!isNonEmptyString(projectId) || !Array.isArray(breakpoints)) return res.status(400).json({ ok: false, error: "缺少有效 projectId 或断点列表。" });
    const configuration = await buildConfigurationService.read();
    if (configuration.mode !== "Debug") return res.status(400).json({ ok: false, error: "原生调试需要 Debug 构建配置，请先在状态栏切换到 Debug。" });
    await nativeDebugService.stop();
    const build = await buildSolutionProjects({ projectId: projectId.trim(), run: false, admission: projectBuildCoordinator.captureGlobalAdmission(), incremental: true });
    if (!build.ok) return res.status(400).json({ ok: false, stage: build.stage, error: build.logs.at(-1) || "调试前构建失败。", logs: build.logs, results: build.results });
    const target = build.results.find((item: any) => item.projectId === projectId.trim());
    if (!target?.exePath || !target?.sourceDir || !Array.isArray(target.sourceMap)) return res.status(400).json({ ok: false, error: "当前项目没有可调试的原生 exe 或源码映射。" });
    const mapped = mapSourceBreakpointsForDebug(breakpoints, target.sourceMap, target.sourceDir);
    const session = await nativeDebugService.start({ program: target.exePath, cwd: target.binDir || path.dirname(target.exePath), stopAtEntry, breakpoints: mapped });
    res.json({ ok: true, session, build });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "启动原生调试失败。", session: nativeDebugService.getSnapshot() }); }
});
app.put("/api/debug/breakpoints", async (req, res) => {
  try {
    const snapshot = nativeDebugService.getSnapshot(); if (!snapshot) return res.status(404).json({ ok: false, error: "当前没有原生调试会话。" });
    const sourceMap = req.body?.sourceMap as LingCppNativeSourceMapEntry[] | undefined;
    const sourceDir = req.body?.sourceDir as string | undefined;
    const breakpoints = req.body?.breakpoints as Array<{ filePath: string; line: number; condition?: string }>;
    if (!Array.isArray(sourceMap) || !isNonEmptyString(sourceDir) || !Array.isArray(breakpoints)) return res.status(400).json({ ok: false, error: "更新断点缺少源码映射上下文。" });
    res.json({ ok: true, session: await nativeDebugService.setBreakpoints(mapSourceBreakpointsForDebug(breakpoints, sourceMap, sourceDir)) });
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "更新断点失败。" }); }
});
for (const [route, action] of Object.entries({ continue: () => nativeDebugService.continue(), next: () => nativeDebugService.next(), "step-in": () => nativeDebugService.stepIn(), "step-out": () => nativeDebugService.stepOut(), stop: () => nativeDebugService.stop() })) {
  app.post(`/api/debug/${route}`, async (_req, res) => { try { res.json({ ok: true, session: await action() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "调试控制失败。" }); } });
}
app.get("/api/debug/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  const current = nativeDebugService.getSnapshot(); if (current) res.write(`event: debug\ndata: ${JSON.stringify(current)}\n\n`);
  const unsubscribe = nativeDebugService.subscribe(session => res.write(`event: debug\ndata: ${JSON.stringify(session)}\n\n`));
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000); req.on("close", () => { clearInterval(heartbeat); unsubscribe(); });
});

app.get("/api/lsp/status", (_req, res) => res.json({ ok: true, status: clangdService.getStatus() }));
app.post("/api/lsp/start", async (_req, res) => {
  const status = await clangdService.restart();
  res.status(status.state === "ready" || status.state === "unavailable" ? 200 : 500).json({ ok: status.state === "ready", status });
});
app.post("/api/lsp/stop", async (_req, res) => { await clangdService.stop(); res.json({ ok: true, status: clangdService.getStatus() }); });
app.put("/api/lsp/documents", async (req, res) => {
  try {
    const { filePath, text, languageId = "cpp" } = req.body as { filePath?: string; text?: string; languageId?: string };
    if (!isNonEmptyString(filePath) || typeof text !== "string" || !/\.(?:c|cc|cpp|cxx|h|hh|hpp|hxx)$/iu.test(filePath)) {
      return res.status(400).json({ ok: false, error: "只能向 clangd 打开工作区内的 C/C++ 文本文件。" });
    }
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    await clangdService.openDocument(absolutePath, text, languageId);
    res.json({ ok: true, status: clangdService.getStatus() });
  } catch (error: any) { res.status(503).json({ ok: false, error: error.message, status: clangdService.getStatus() }); }
});
app.patch("/api/lsp/documents", async (req, res) => {
  try {
    const { filePath, changes } = req.body as { filePath?: string; changes?: Array<{ range?: any; rangeLength?: number; text: string }> };
    if (!isNonEmptyString(filePath) || !Array.isArray(changes)) return res.status(400).json({ ok: false, error: "缺少文档变更。" });
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    const version = await clangdService.changeDocument(absolutePath, changes);
    res.json({ ok: true, version });
  } catch (error: any) { res.status(503).json({ ok: false, error: error.message, status: clangdService.getStatus() }); }
});
app.delete("/api/lsp/documents", async (req, res) => {
  try {
    const filePath = String(req.query.filePath || "");
    const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
    await clangdService.closeDocument(absolutePath); res.json({ ok: true });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.get("/api/lsp/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache"); res.flushHeaders();
  const status = (value: unknown) => res.write(`event: status\ndata: ${JSON.stringify(value)}\n\n`);
  const diagnostics = (value: unknown) => res.write(`event: diagnostics\ndata: ${JSON.stringify(value)}\n\n`);
  status(clangdService.getStatus()); clangdService.on("status", status); clangdService.on("diagnostics", diagnostics);
  const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
  req.on("close", () => { clearInterval(heartbeat); clangdService.off("status", status); clangdService.off("diagnostics", diagnostics); });
});

const ALLOWED_LSP_REQUESTS = new Set([
  "textDocument/completion", "textDocument/hover", "textDocument/signatureHelp",
  "textDocument/definition", "textDocument/implementation", "textDocument/documentSymbol", "workspace/symbol"
  , "textDocument/references", "textDocument/prepareRename", "textDocument/codeAction"
]);
app.post("/api/lsp/request", async (req, res) => {
  const controller = new AbortController(); req.on("close", () => controller.abort());
  try {
    const { method, filePath, position, query, range, context } = req.body as { method?: string; filePath?: string; position?: { line: number; character: number }; query?: string; range?: unknown; context?: unknown };
    if (!method || !ALLOWED_LSP_REQUESTS.has(method)) return res.status(400).json({ ok: false, error: "不支持的 LSP 请求。" });
    let params: unknown;
    if (method === "workspace/symbol") params = { query: typeof query === "string" ? query : "" };
    else {
      if (!isNonEmptyString(filePath)) return res.status(400).json({ ok: false, error: "LSP 请求缺少 filePath。" });
      const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      const textDocument = { uri: pathToFileURL(absolutePath).href };
      params = method === "textDocument/documentSymbol"
        ? { textDocument }
        : method === "textDocument/references"
          ? { textDocument, position, context: { includeDeclaration: true } }
          : method === "textDocument/codeAction"
            ? { textDocument, range, context: context || { diagnostics: [] } }
            : { textDocument, position };
    }
    const result = await clangdService.request(method, params, controller.signal);
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(clangdService.getStatus().state === "ready" ? 500 : 503).json({ ok: false, error: error.message, status: clangdService.getStatus() });
  }
});

app.post("/api/lsp/refactor/preview", async (req, res) => {
  try {
    const { kind, filePath, position, newName, edit, sourceText } = req.body as { kind?: "rename" | "codeAction"; filePath?: string; position?: any; newName?: string; edit?: any; sourceText?: string };
    let workspaceEdit = edit;
    if (isNonEmptyString(filePath)) {
      const sourcePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      if (typeof sourceText !== "string" || decodeTextFile(await fs.readFile(sourcePath)).content !== sourceText) {
        return res.status(409).json({ ok: false, error: "重构前请先保存当前 C/C++ 文件，避免将 clangd 内存位置应用到旧磁盘内容。" });
      }
    }
    if (kind === "rename") {
      if (!isNonEmptyString(filePath) || !isNonEmptyString(newName)) return res.status(400).json({ ok: false, error: "重命名缺少文件或新名称。" });
      const absolutePath = await workspacePathPolicy.resolveExisting(filePath, { rejectSymlinks: true });
      const textDocument = { uri: pathToFileURL(absolutePath).href };
      await clangdService.request("textDocument/prepareRename", { textDocument, position });
      workspaceEdit = await clangdService.request("textDocument/rename", { textDocument, position, newName });
    }
    const preview = await lspWorkspaceEditService.preview(workspaceEdit);
    res.json({ ok: true, preview });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});
app.post("/api/lsp/refactor/apply", async (req, res) => {
  try { res.json({ ok: true, ...await lspWorkspaceEditService.apply(String(req.body?.previewId || "")) }); }
  catch (error: any) { res.status(/external|changed|外部修改/iu.test(error.message) ? 409 : 400).json({ ok: false, error: error.message }); }
});

app.post("/api/modules/package/export", async (req, res) => {
  try {
    const { moduleDir, targetPath } = req.body as { moduleDir?: string; targetPath?: string };
    if (!moduleDir || !targetPath) return res.status(400).json({ ok: false, error: "缺少 moduleDir 或 targetPath" });
    const [resolvedModuleDir, resolvedTargetPath] = await Promise.all([
      resolveExistingModulePath(moduleDir, ".lingbuilder/module-build"),
      resolveModuleWritePath(targetPath, ".lingbuilder/module-packages")
    ]);
    await getModuleService().exportModulePackage(resolvedModuleDir, resolvedTargetPath, {
      requireCommandBindings: true,
      requireNonEmptyDocumentsAndExamples: true
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包导出失败" });
  }
});

app.post("/api/modules/developer/link", async (req, res) => {
  try {
    const { sourcePath } = req.body as { sourcePath?: string };
    if (!sourcePath) return res.status(400).json({ ok: false, error: "缺少 sourcePath" });
    const relativePath = normalizeWorkspaceRelativePath(sourcePath);
    await resolveExistingModulePath(relativePath);
    const { link, module } = await getModuleService().linkModuleDevSource(relativePath);
    res.json({ ok: true, link, module });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块开发源链接失败" });
  }
});

// 欢迎页「新建模块」：在 .lingbuilder/module-build/<id> 生成骨架并自动登记开发源。
app.post("/api/modules/developer/create", async (req, res) => {
  try {
    const body = req.body || {};
    const result = await getModuleService().createModuleSource({
      id: typeof body.id === "string" ? body.id : undefined,
      name: typeof body.name === "string" ? body.name : undefined,
      category: typeof body.category === "string" ? body.category : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      template: typeof body.template === "string" ? body.template : undefined
    });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块创建失败" });
  }
});

// 欢迎页「打开模块包」：把 .lbmod 解开为 .lingbuilder/module-build 下的可编辑源码并登记开发源（不安装）。
app.post("/api/modules/developer/open-package", async (req, res) => {
  try {
    const { packagePath } = req.body as { packagePath?: string };
    if (!packagePath) return res.status(400).json({ ok: false, error: "缺少 packagePath" });
    const result = await getModuleService().openModulePackageAsSource(packagePath);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块包打开失败" });
  }
});

app.post("/api/modules/developer/unlink", async (req, res) => {
  try {
    const { moduleId } = req.body as { moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    await getModuleService().unlinkModuleDevSource(moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "取消模块开发源链接失败" });
  }
});

app.post("/api/modules/uninstall", async (req, res) => {
  try {
    const { moduleId } = req.body as { moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    await getModuleService().uninstallModule(moduleId);
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "卸载模块失败" });
  }
});

app.post("/api/modules/repair-bundled", async (req, res) => {
  try {
    const { moduleId } = req.body as { moduleId?: string };
    if (!moduleId) return res.status(400).json({ ok: false, error: "缺少 moduleId" });
    const result = await getModuleService().repairBundledModule(moduleId);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "修复重装失败" });
  }
});

app.get("/api/modules/market", async (req, res) => {
  try {
    const { sourceId } = req.query as { sourceId?: string };
    const modules = await getModuleService().listMarketModules(sourceId);
    res.json({
      ok: true,
      modules: await Promise.all(modules.map(async module => ({
        ...module,
        packagePath: await toSafeHttpPackagePath(module.packagePath)
      })))
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块市场读取失败" });
  }
});

app.get("/api/modules/history", async (_req, res) => {
  try {
    res.json({ ok: true, history: await getModuleService().getHistory() });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块历史读取失败" });
  }
});

app.post("/api/modules/developer/template", async (req, res) => {
  try {
    const { template = "cpp-source", outDir, id, name } = req.body as { template?: string; outDir?: string; id?: string; name?: string };
    if (!outDir) return res.status(400).json({ ok: false, error: "缺少 outDir" });
    const resolvedOutDir = await resolveModuleWriteDirectory(outDir, ".lingbuilder/module-build");
    const manifest = await createModuleTemplate({ template, outDir: resolvedOutDir, id, name });
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块模板创建失败" });
  }
});

app.post("/api/modules/developer/import-ai-files", async (req, res) => {
  try {
    const { files, outDir } = req.body as { files?: Array<{ path?: unknown; content?: unknown }>; outDir?: string };
    if (!Array.isArray(files) || files.length === 0 || files.some(file => !file || typeof file !== 'object'
      || typeof (file as { path?: unknown }).path !== 'string'
      || typeof (file as { content?: unknown }).content !== 'string')) {
      return res.status(400).json({ ok: false, error: "缺少有效的 files 文件列表。" });
    }
    const typedFiles = files as Array<{ path: string; content: string }>;
    const manifestEntry = typedFiles.find(file => file.path.trim().replace(/\\/gu, '/').replace(/^\.\//u, '') === 'lingbuilder.module.json');
    let moduleId = '';
    if (manifestEntry) {
      try {
        moduleId = String(JSON.parse(manifestEntry.content.replace(/^\uFEFF/u, ''))?.id || '').trim();
      } catch {
        return res.status(400).json({ ok: false, error: "lingbuilder.module.json 不是合法 JSON，无法确定模块 ID。" });
      }
    }
    if (!moduleId || !/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(moduleId)) {
      return res.status(400).json({ ok: false, error: "缺少 lingbuilder.module.json 或模块 ID 不合法，无法确定导入目录。" });
    }
    const targetRelativeDir = outDir && outDir.trim()
      ? outDir.trim()
      : `.lingbuilder/module-build/${moduleId}`;
    const resolvedOutDir = await resolveModuleWriteDirectory(targetRelativeDir, ".lingbuilder/module-build");
    const result = await importAiModuleFiles(typedFiles, resolvedOutDir);
    res.json({
      ok: true,
      result: {
        moduleId: result.manifest.id,
        moduleName: result.manifest.name,
        outDir: targetRelativeDir.replace(/\\/gu, '/'),
        fileCount: result.writtenFiles.length,
        overwrittenExisting: result.overwrittenExisting === true,
        diagnostics: result.diagnostics
      }
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "AI 模块导入失败" });
  }
});

app.post("/api/modules/developer/validate", async (req, res) => {
  try {
    const { modulePath } = req.body as { modulePath?: string };
    if (!modulePath) return res.status(400).json({ ok: false, error: "缺少 modulePath" });
    let resolvedModulePath = await resolveExistingModulePath(modulePath, ".lingbuilder/module-build");
    if (path.basename(resolvedModulePath).toLowerCase() === "lingbuilder.module.json") {
      resolvedModulePath = path.dirname(resolvedModulePath);
    }
    const result = await validateModuleDirectory(resolvedModulePath, {
      requireCommandBindings: true,
      requireNonEmptyDocumentsAndExamples: true
    });
    res.json({ ok: true, result });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块校验失败" });
  }
});

app.post("/api/modules/developer/migrate-cpp", async (req, res) => {
  try {
    const { configPath, outDir } = req.body as { configPath?: string; outDir?: string };
    if (!configPath || !outDir) return res.status(400).json({ ok: false, error: "缺少 configPath 或 outDir" });
    const [resolvedConfigPath, resolvedOutDir] = await Promise.all([
      resolveExistingModulePath(configPath),
      resolveModuleWriteDirectory(outDir, ".lingbuilder/module-build")
    ]);
    const manifest = await migrateCppModule(resolvedConfigPath, resolvedOutDir);
    res.json({ ok: true, manifest });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "C++ 模块迁移失败" });
  }
});

app.post("/api/modules/developer/market-index", async (req, res) => {
  try {
    const { packagePaths, outPath } = req.body as { packagePaths?: string[]; outPath?: string };
    if (!Array.isArray(packagePaths) || !outPath) return res.status(400).json({ ok: false, error: "缺少 packagePaths 或 outPath" });
    const normalizedOutPath = normalizeWorkspaceRelativePath(outPath, ".lingbuilder");
    if (path.posix.dirname(normalizedOutPath) !== ".lingbuilder" || !normalizedOutPath.toLowerCase().endsWith(".json")) {
      throw new Error("模块市场索引必须输出为 .lingbuilder 目录下的 JSON 文件。");
    }
    const [resolvedPackagePaths, resolvedOutPath] = await Promise.all([
      Promise.all(packagePaths.map(packagePath => resolveExistingModulePath(packagePath, ".lingbuilder/module-packages"))),
      workspacePathPolicy.resolveForWrite(normalizedOutPath)
    ]);
    await createMarketIndex(resolvedPackagePaths, resolvedOutPath, { packagePathRoot: getRepoWorkspaceRoot() });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "模块市场索引生成失败" });
  }
});

app.post("/api/window-designer/assets/import", async (req, res) => {
  const { projectId, sourcePath } = req.body as { projectId?: string; sourcePath?: string };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sourcePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或图片源路径。" });
  }
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId.trim());
    const imported = await designerAssetService.importImage(projectRef, sourcePath);
    res.json({ ok: true, ...imported });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "图片复制到项目失败。" });
  }
});

app.post("/api/window-designer/assets/import-animation", async (req, res) => {
  const { projectId, sourcePath } = req.body as { projectId?: string; sourcePath?: string };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sourcePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 AVI 动画源路径。" });
  }
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId.trim());
    const imported = await designerAssetService.importAnimation(projectRef, sourcePath);
    res.json({ ok: true, ...imported });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "AVI 动画复制到项目失败。" });
  }
});

app.post("/api/window-designer/assets/import-video", async (req, res) => {
  const { projectId, sourcePath } = req.body as { projectId?: string; sourcePath?: string };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sourcePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或视频源路径。" });
  }
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId.trim());
    const imported = await designerAssetService.importVideo(projectRef, sourcePath);
    res.json({ ok: true, ...imported });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "视频复制到项目失败。" });
  }
});

app.get("/api/window-designer/assets", async (req, res) => {
  const projectId = String(req.query.projectId || "").trim();
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId。" });
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId);
    const resources = await designerAssetService.listProjectImages(projectRef);
    res.json({ ok: true, resources });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "项目图片资源读取失败。" });
  }
});

app.get("/api/window-designer/assets/content", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  const imagePath = String(req.query.path || "");
  if (!projectId || !imagePath) return res.status(400).send("缺少图片资源参数。");
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId);
    const image = await designerAssetService.readImage(projectRef, imagePath);
    res.setHeader("Content-Type", image.mimeType);
    res.setHeader("Cache-Control", "no-store");
    res.send(image.bytes);
  } catch (error: any) {
    res.status(404).send(error?.message || "图片资源不存在。");
  }
});

// 删除项目图片资源：删除前先扫设计器模型与项目源码引用，仍有引用时必须 confirmed=true 才真正删。
app.post("/api/window-designer/assets/delete", async (req, res) => {
  const { projectId, relativePath, confirmed } = req.body as { projectId?: string; relativePath?: string; confirmed?: boolean };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(relativePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或图片资源路径。" });
  }
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId.trim());
    const [designerProject, sourceFiles] = await Promise.all([
      solutionService.readDesignerProjectRaw(projectRef).catch(() => null),
      solutionService.readProjectFileSnapshots(projectRef)
    ]);
    const scan = findDesignerImageReferences({ designerProject, sourceFiles, relativePath: relativePath.trim() });
    if (scan.hits.length > 0 && confirmed !== true) {
      return res.status(409).json({
        ok: false,
        requiresConfirmation: true,
        references: scan.hits,
        truncated: scan.truncated,
        error: "图片资源仍被以下位置引用，确认后才会删除。"
      });
    }
    await designerAssetService.deleteProjectImage(projectRef, relativePath.trim());
    res.json({ ok: true });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "图片资源删除失败。" });
  }
});

// 内嵌站点「扫描目录」：递归列出工作区内一个目录的全部文件（工作区相对路径），只读。
app.get("/api/window-designer/embedded-site/scan", async (req, res) => {
  const directory = String(req.query.dir || "");
  try {
    const files = await windowsExecutableIconService.scanEmbeddedSiteDirectory(directory);
    res.json({ ok: true, files });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "内嵌站点目录扫描失败。" });
  }
});

// 内嵌资源「选择文件…/选择文件夹…」：把本机文件（或整个文件夹，递归展开）复制进
// <项目源码根>/resources/ 并回传可直接写回 embeddedResources 的逻辑名。
app.post("/api/window-designer/embedded-resources/import", async (req, res) => {
  const { projectId, sourcePaths, directory } = req.body as { projectId?: string; sourcePaths?: string[]; directory?: string };
  if (!isNonEmptyString(projectId)) return res.status(400).json({ ok: false, error: "缺少 projectId。" });
  const requestedFiles = Array.isArray(sourcePaths) ? sourcePaths.filter(item => isNonEmptyString(item)) : [];
  const requestedDirectory = typeof directory === "string" ? directory.trim() : "";
  if (requestedFiles.length === 0 && !requestedDirectory) {
    return res.status(400).json({ ok: false, error: "缺少要导入的文件或文件夹路径。" });
  }
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId.trim());
    const result = requestedFiles.length > 0
      ? await designerAssetService.importEmbeddedResourceFiles(projectRef, requestedFiles)
      : await designerAssetService.importEmbeddedResourceFolder(projectRef, requestedDirectory);
    res.json({ ok: true, ...result });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "内嵌资源导入失败。" });
  }
});

// 内嵌资源「扫描目录」：递归列出工作区内一个目录里可直接内嵌的文件（只读，不复制）。
app.get("/api/window-designer/embedded-resources/scan", async (req, res) => {
  const directory = String(req.query.dir || "");
  try {
    const result = await designerAssetService.scanEmbeddedResourceDirectory(directory);
    res.json({ ok: true, files: result.files, skipped: result.skipped });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "内嵌资源目录扫描失败。" });
  }
});

app.post("/api/window-designer/edge-control-preview", async (req, res) => {
  const { project, windowId, controlId } = req.body as { project?: LingWindowProject; windowId?: string; controlId?: string };
  if (!project || !isNonEmptyString(project.id) || !isNonEmptyString(windowId) || !isNonEmptyString(controlId)) {
    return res.status(400).json({ ok: false, stage: "prepare", error: "缺少 Edge 控件预览所需的项目、窗口或控件标识。" });
  }
  const sourceWindow = project.windows.find(item => item.id === windowId);
  const sourceControl = sourceWindow?.controls.find(item => item.id === controlId);
  if (!sourceWindow || !sourceControl || sourceControl.type !== "EdgeBrowser") {
    return res.status(400).json({ ok: false, stage: "prepare", error: "当前选择不是可预览的 Edge 浏览器控件。" });
  }
  const projectId = project.id.trim();
  const processKey = `edgeview-control-preview:${projectId}`;
  try {
    if (activeEdgeControlPreviewProcessKey) {
      await managedProcessService.stop(activeEdgeControlPreviewProcessKey);
      await cleanupEdgeControlPreviewBuild(activeEdgeControlPreviewProcessKey);
      activeEdgeControlPreviewProcessKey = undefined;
    }
    const previewControl = { ...sourceControl, parentId: undefined, containerSlot: undefined, x: 12, y: 12 };
    const previewWindow = {
      ...sourceWindow,
      id: `${sourceWindow.id}-edge-control-preview`, fileName: "EdgeViewControlPreview.xml", className: "EdgeViewControlPreviewWindow",
      title: `EdgeView 控件预览 - ${sourceControl.name}`,
      width: Math.max(360, sourceControl.width + 24), height: Math.max(240, sourceControl.height + 64),
      controls: [previewControl], events: {}, menuEvents: {}
    };
    const previewProject: LingWindowProject = { ...project, windows: [previewWindow] };
    const enabledModules = await getModuleService().getEnabledProjectModules(projectId);
    assertEnabledModuleAccess(enabledModules);
    if (!enabledModules.some(module => module.manifest.id === "lingbuilder.edgeview")) throw new Error("当前项目尚未启用 lingbuilder.edgeview 模块。");
    const compatibility = await buildConfigurationService.ensureCompatibleWithModules(enabledModules.map(module => module.manifest.id));
    const buildConfiguration = compatibility.configuration;
    const generated = generateLingCppNativeWin32Project(previewProject, {
      activeWindowId: previewWindow.id, lingCppSourceCode: "", lingCppSources: [], enabledModules
    });
    assertNoBlockingLingCppDiagnostics(generated.blockingDiagnostics);
    const repoRoot = getRepoWorkspaceRoot();
    const buildDir = path.join(repoRoot, ".lingbuilder-build", "edgeview-control-preview", sanitizeFilename(projectId));
    edgeControlPreviewBuildDirs.set(processKey, buildDir);
    const sourceDir = path.join(buildDir, "src"); const binDir = path.join(buildDir, "bin"); const objDir = path.join(buildDir, "obj"); const exportDir = path.join(buildDir, "export");
    await Promise.all([sourceDir, binDir, objDir, exportDir].map(directory => fs.mkdir(directory, { recursive: true })));
    await writeGeneratedProjectFiles(sourceDir, generated.files);
    const previewProjectRef = getSolutionService().getProject(await getSolutionService().getSolution(), projectId);
    await windowsExecutableIconService.materialize(previewProjectRef, generated.selectedWindow, [buildDir, sourceDir]);
    const modulePlan = await materializeModuleNativeDependencies(enabledModules, {
      buildDir, sourceDir, binDir, exportDir, preferredTargetId: getModuleTargetId(buildConfiguration)
    });
    if (modulePlan.blockingDiagnostics.length) return res.status(200).json({ ok: false, stage: "native-dependencies", error: modulePlan.blockingDiagnostics.join("\n"), logs: modulePlan.diagnostics });
    const compiler = await detectCompiler(buildConfiguration);
    if (!compiler || compiler.kind !== "msvc") return res.status(200).json({ ok: false, stage: "compiler", error: "EdgeView 独立预览需要 Visual Studio Build Tools / MSVC。", logs: compatibility.messages });
    const exePath = path.join(binDir, "EdgeViewControlPreview.exe");
    const resourcePath = generated.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)
      ? path.join(sourceDir, WINDOWS_EXECUTABLE_RESOURCE_FILE)
      : undefined;
    const compile = await compileWin32Preview(compiler, path.join(sourceDir, "main.cpp"), exePath, objDir, buildDir, modulePlan, buildConfiguration, resourcePath);
    const logs = [...compatibility.messages, ...generated.diagnostics, ...modulePlan.diagnostics, ...compile.logs];
    if (!compile.ok) return res.status(200).json({ ok: false, stage: "compile", error: "EdgeView 控件预览编译失败。", logs, buildDir });
    const started = await managedProcessService.start(processKey, exePath, { cwd: binDir, detached: false, windowsHide: false, logFilePath: path.join(buildDir, "run.log") });
    activeEdgeControlPreviewProcessKey = processKey;
    res.json({ ok: true, stage: "run", pid: started.pid, buildDir, exePath, message: `正在独立窗口预览 ${sourceControl.name}。`, logs: [...logs, `已启动 EdgeView 控件预览（PID ${started.pid}）。`] });
  } catch (error) {
    res.status(500).json({ ok: false, stage: "server", error: error instanceof Error ? error.message : "EdgeView 控件预览失败。" });
  }
});

app.post("/api/window-designer/edge-control-preview/stop", async (req, res) => {
  const projectId = isNonEmptyString(req.body?.projectId) ? req.body.projectId.trim() : undefined;
  const processKey = projectId ? `edgeview-control-preview:${projectId}` : activeEdgeControlPreviewProcessKey;
  if (!processKey) return res.json({ ok: true, message: "当前没有运行中的 EdgeView 控件预览。" });
  try {
    const result = await managedProcessService.stop(processKey);
    if (activeEdgeControlPreviewProcessKey === processKey) activeEdgeControlPreviewProcessKey = undefined;
    await cleanupEdgeControlPreviewBuild(processKey);
    res.json({ ok: true, message: result.message });
  } catch (error) {
    res.status(500).json({ ok: false, error: error instanceof Error ? error.message : "停止 EdgeView 控件预览失败。" });
  }
});

app.post("/api/window-designer/native-preview", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, lingCppSources } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
    lingCppSources?: LingCppProjectSourceFile[];
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }

  try {
    const enabledModules = await getModuleService().getEnabledProjectModules(project.id || "lingbuilder-ui-project");
    assertEnabledModuleAccess(enabledModules);
    await requireEnabledModuleSdkDependencies(enabledModules);
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: typeof lingCppSourceCode === "string" ? lingCppSourceCode : "",
      lingCppSourceFilePath,
      lingCppSources: await resolveLingCppProjectSources(project.id || "lingbuilder-ui-project", lingCppSources),
      enabledModules
    });
    const previewConfiguration = await buildConfigurationService.read();
    const previewRoot = path.join(getRepoWorkspaceRoot(), '.lingbuilder-build', 'native-preview', sanitizeFilename(project.id || 'window-preview'));
    await fs.rm(previewRoot, { recursive: true, force: true });
    await fs.mkdir(previewRoot, { recursive: true });
    let previewProjectRoot = getRepoWorkspaceRoot();
    try {
      const previewSolution = getSolutionService();
      const previewProjectRef = previewSolution.getProject(await previewSolution.getSolution(), project.id || 'lingbuilder-ui-project');
      previewProjectRoot = path.resolve(getRepoWorkspaceRoot(), previewProjectRef.sourceRoot || '.');
    } catch {
      // A detached designer preview may not have a persisted solution entry yet.
    }
    const previewCodeGenerators = await runProjectCodeGenerators({
      service: buildPipelineService,
      workspaceRoot: getRepoWorkspaceRoot(),
      projectRoot: previewProjectRoot,
      outputRoot: previewRoot,
      exportRoot: previewRoot,
      projectId: project.id || 'window-preview',
      modules: enabledModules,
      target: createWindowsMsvcBuildTarget(previewConfiguration.architecture === 'x64' ? 'x64' : 'win32'),
      cache: incrementalBuildService,
      cacheKey: `${project.id || 'window-preview'}:native-preview-code-generators:${previewConfiguration.architecture}`
    });
    const previewFiles = [...generatedProject.files, ...previewCodeGenerators.textFiles];

    res.json({
      ok: true,
      files: previewFiles.map(file => ({
        relativePath: file.relativePath,
        language: getGeneratedFileLanguage(file.relativePath),
        content: file.content,
        readonly: true
      })),
      diagnostics: [...generatedProject.diagnostics, ...previewCodeGenerators.diagnostics],
      logs: previewCodeGenerators.logs,
      selectedWindow: generatedProject.selectedWindow,
      enabledModules: enabledModules.map(module => `${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`),
      sourceMap: generatedProject.sourceMap
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({
      ok: false,
      code: error?.code,
      ...createSdkDependencyErrorPayload(error),
      error: error?.message || "原生 C++ 预览生成失败"
    });
  }
});

app.post("/api/window-designer/native-export", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, lingCppSources } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
    lingCppSources?: LingCppProjectSourceFile[];
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }

  try {
    const enabledModules = await getModuleService().getEnabledProjectModules(project.id || "lingbuilder-ui-project");
    assertEnabledModuleAccess(enabledModules);
    await requireEnabledModuleSdkDependencies(enabledModules);
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: typeof lingCppSourceCode === "string" ? lingCppSourceCode : "",
      lingCppSourceFilePath,
      lingCppSources: await resolveLingCppProjectSources(project.id || "lingbuilder-ui-project", lingCppSources),
      enabledModules
    });
    assertNoBlockingLingCppDiagnostics(generatedProject.blockingDiagnostics);
    const exportConfiguration = await buildConfigurationService.read();
    const exportProjectId = project.id || "window-preview";
    const exportDir = (await resolveServerProjectBuildPaths(exportProjectId, exportConfiguration)).exportDir;
    await fs.mkdir(exportDir, { recursive: true });
    await writeGeneratedProjectFiles(exportDir, generatedProject.files);
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), project.id || "lingbuilder-ui-project");
    const codeGeneratorResult = await runProjectCodeGenerators({
      service: buildPipelineService,
      workspaceRoot: getRepoWorkspaceRoot(),
      projectRoot: path.resolve(getRepoWorkspaceRoot(), projectRef.sourceRoot || '.'),
      outputRoot: exportDir,
      exportRoot: exportDir,
      projectId: project.id || 'window-preview',
      modules: enabledModules,
      target: createWindowsMsvcBuildTarget(exportConfiguration.architecture === 'x64' ? 'x64' : 'win32'),
      cache: incrementalBuildService,
      cacheKey: `${project.id || 'window-preview'}:native-export-code-generators:${exportConfiguration.architecture}`
    });
    const generatedCodegenFiles = codeGeneratorResult.textFiles;
    const copiedAssets = await designerAssetService.copyProjectAssets(projectRef, [exportDir]);
    const executableIcon = await windowsExecutableIconService.materialize(projectRef, generatedProject.selectedWindow, [exportDir]);
    const moduleExportDiagnostics = await exportModuleNativeDependencies(enabledModules, exportDir);
    const visualStudioProject = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId: project.id || "window-preview",
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles],
      enabledModules,
      contentFiles: [
        ...copiedAssets.map(file => normalizeFilePath(path.relative(exportDir, file))),
        ...executableIcon.files.map(file => normalizeFilePath(path.relative(exportDir, file))),
        ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(artifact.relativePath))
      ]
    });

    res.json({
      ok: true,
      exportDir,
      files: [
        ...generatedProject.files.map(file => path.join(exportDir, file.relativePath)),
        ...generatedCodegenFiles.map(file => path.join(exportDir, file.relativePath)),
        ...visualStudioProject.files
      ],
      visualStudioProject,
      diagnostics: [...generatedProject.diagnostics, ...codeGeneratorResult.diagnostics, ...moduleExportDiagnostics],
      selectedWindow: generatedProject.selectedWindow,
      enabledModules: enabledModules.map(module => `${module.manifest.name} (${module.manifest.id}@${module.manifest.version})`),
      sourceMap: generatedProject.sourceMap,
      logs: [
        `原生 C++ 工程目录：${exportDir}`,
        `Visual Studio 解决方案：${visualStudioProject.solutionPath}`,
        `当前窗口：${generatedProject.selectedWindow.title}`,
        copiedAssets.length ? `已复制 ${copiedAssets.length} 个项目图片资源。` : "当前项目没有需要复制的图片资源。",
        ...generatedProject.diagnostics,
        ...codeGeneratorResult.logs,
        ...moduleExportDiagnostics
      ]
    });
  } catch (error: any) {
    res.status(error?.status || 500).json({
      ok: false,
      code: error?.code,
      ...createSdkDependencyErrorPayload(error),
      error: error?.message || "原生 C++ 工程导出失败"
    });
  }
});

// API: Extract strings and comments from C++ code
app.post("/api/extract", (req, res) => {
  const { code, filename } = req.body;
  if (!code) {
    return res.status(400).json({ error: "Missing code content" });
  }

  const lines = code.split("\n");
  const extracted: ExtractedString[] = [];
  let idCounterVal = 1;

  // Simple parser for C++ strings & comments
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const currentLine = lines[i];

    // 1. Match C++ comments: // or /* */
    const singleLineCommentMatch = currentLine.match(/(\/\/.*)$/);
    if (originalCommentMatch(trimmed(currentLine))) {
      const match = trimmedComment(currentLine);
      if (match && match.length > 3) {
        extracted.push({
          id: `ext-c-${idCounterVal++}`,
          original: match,
          translated: '',
          line: lineNum,
          type: 'comment',
          status: 'pending',
          context: currentLine.trim()
        });
      }
    }

    // 2. Match C++ string literals: "..." or L"..." or _T("...")
    // Regex matches L"..." or _T("...") or "..."
    const stringRegex = /(?:L|_T)?\"([^"\\]*(?:\\.[^"\\]*)*)\"/g;
    let match;
    while ((match = stringRegex.exec(currentLine)) !== null) {
      const originalStr = match[1];
      if (originalStr && originalStr.trim().length > 1) {
        // Skip common formatting templates or pure punctuation strings
        if (/^[%d%s%x\s\-\.\,\!\?_]+$/.test(originalStr)) continue;
        
        extracted.push({
          id: `ext-s-${idCounterVal++}`,
          original: originalStr,
          translated: '',
          line: lineNum,
          type: 'string',
          status: 'pending',
          context: currentLine.trim()
        });
      }
    }
  }

  function trimmed(s: string) { return s.trim(); }
  function originalCommentMatch(s: string) { return s.includes("//") || s.includes("/*"); }
  function trimmedComment(s: string) {
    const m = s.match(/\/\/(.*)$/);
    if (m) return m[1].trim();
    const m2 = s.match(/\/\*([\s\S]*?)\*\//);
    if (m2) return m2[1].trim();
    return null;
  }

  res.json({ strings: extracted });
});

// API: Reconstruct C++ code with translations
app.post("/api/reconstruct", (req, res) => {
  const { code, strings } = req.body;
  if (!code || !strings) {
    return res.status(400).json({ error: "Missing original code or translated strings" });
  }

  const lines = code.split("\n");
  const processedStrings = [...strings].sort((a, b) => b.original.length - a.original.length); // Replace longer substrings first to avoid partial corruption

  // Map translations to specific lines for absolute precision
  const linesMap: Record<number, any[]> = {};
  processedStrings.forEach((s: any) => {
    if (s.translated && s.status === 'translated') {
      if (!linesMap[s.line]) linesMap[s.line] = [];
      linesMap[s.line].push(s);
    }
  });

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    if (linesMap[lineNum]) {
      let currentLine = lines[i];
      linesMap[lineNum].forEach((s: any) => {
        // String or comment precise replacement within line
        if (s.type === 'comment') {
          // Replace comment content
          currentLine = currentLine.replace(s.original, s.translated);
        } else {
          // For string literals, handle escaping differences if any, or just find hte original string literal content
          // Replace the literal content, making sure we don't accidentally corrupt code characters outside string quotes
          // Simple but effective: Replace first or matching occurrence of original string inside quotes
          const escapedOriginal = s.original.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`(["'])${escapedOriginal}(["'])`);
          currentLine = currentLine.replace(regex, `$1${s.translated}$2`);
          // Fallback if not inside quotes or other macro string structures
          if (!currentLine.includes(s.translated)) {
            currentLine = currentLine.replace(s.original, s.translated);
          }
        }
      });
      lines[i] = currentLine;
    }
  }

  res.json({ code: lines.join("\n") });
});

app.get("/api/window-designer/run-status", async (req, res) => {
  try {
    const { projectId, all } = req.query as { projectId?: string; all?: string };
    if (all === "true") {
      res.json({
        ok: true,
        statuses: managedProcessService.getAllStatuses(),
        builds: projectBuildCoordinator.getAllStatuses()
      });
      return;
    }
    if (!isNonEmptyString(projectId)) {
      return res.status(400).json({ ok: false, error: "缺少 projectId。" });
    }
    const normalizedProjectId = projectId.trim();
    res.json({
      ok: true,
      status: managedProcessService.getStatus(normalizedProjectId),
      build: projectBuildCoordinator.getStatus(normalizedProjectId)
    });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "读取运行进程状态失败。" });
  }
});

app.post("/api/window-designer/stop", async (req, res) => {
  try {
    const { projectId, all = false } = req.body as { projectId?: string; all?: boolean };
    if (all) {
      const cancelledBuilds = projectBuildCoordinator.cancelAll("user");
      const result = await managedProcessService.stopAll();
      const failed = result.results.filter(item => item.found && !item.stopped);
      const payload = {
        ok: failed.length === 0,
        stopped: result.stopped > 0,
        stoppedCount: result.stopped,
        forcedCount: result.forced,
        cancelledBuilds,
        message: [
          cancelledBuilds.length ? `已取消 ${cancelledBuilds.length} 个生成任务。` : "",
          result.message
        ].filter(Boolean).join(" "),
        failures: failed
      };
      res.status(failed.length === 0 ? 200 : 500).json(payload);
      return;
    }
    if (!isNonEmptyString(projectId)) {
      return res.status(400).json({ ok: false, error: "缺少 projectId；如需停止全部任务请传入 all=true。" });
    }
    const normalizedProjectId = projectId.trim();
    const cancelledBuild = projectBuildCoordinator.cancel(normalizedProjectId, "user");
    const result = await managedProcessService.stop(normalizedProjectId);
    const ok = !result.found || result.stopped;
    res.status(ok ? 200 : 500).json({
      ok,
      stopped: result.stopped,
      found: result.found,
      forced: result.forced,
      pid: result.pid,
      cancelledBuild,
      message: result.message,
      error: ok ? undefined : result.message
    });
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || "停止运行进程失败。" });
  }
});

app.post("/api/window-designer/build-run", async (req, res) => {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, lingCppSources, eplSourceCode, run = true } = req.body as {
    project?: LingWindowProject;
    activeWindowId?: string;
    lingCppSourceCode?: string;
    lingCppSourceFilePath?: string;
    lingCppSources?: LingCppProjectSourceFile[];
    eplSourceCode?: string;
    run?: boolean;
  };

  if (!project || !Array.isArray(project.windows) || project.windows.length === 0) {
    return res.status(400).json({
      ok: false,
      error: "缺少有效的窗口设计器项目模型"
    });
  }
  if (!isNonEmptyString(project.id)) {
    return res.status(400).json({ ok: false, error: "窗口设计器项目缺少有效 project.id。" });
  }
  const requestedProjectId = project.id.trim();
  // 动态库项目没有运行入口：F5「生成并运行」直接拒绝并引导「生成」。
  // UI 工具栏按钮对 DLL 项目已禁用，这里是绕过 UI 直接调用接口时的兜底护栏。
  if (run) {
    try {
      const solutionForRunGuard = await getSolutionService().getSolution();
      const recordForRunGuard = solutionForRunGuard.projects.find(item => item.id === requestedProjectId);
      // 旧版本创建的 windows-dll 模板项目可能没有 outputType 字段，按项目类型一并拦截。
      if (recordForRunGuard && (recordForRunGuard.type === "windows-dll" || recordForRunGuard.buildProperties?.outputType === "dll")) {
        return res.status(200).json({
          ok: false,
          stage: "run-unsupported",
          error: "动态库项目不支持生成并运行：请使用「生成解决方案」或命令面板「生成项目」编译 DLL 产物。",
          logs: [
            "动态库项目不支持生成并运行。",
            "请使用菜单/命令面板中的「生成解决方案」，或在解决方案资源管理器中右键项目选择「生成」。",
            "生成的 DLL 与导入库位于构建输出目录的 bin 子目录。"
          ]
        });
      }
    } catch {
      // 解决方案尚未建立时按 EXE 模式继续。
    }
  }
  const buildAdmission = projectBuildCoordinator.captureAdmission(requestedProjectId);
  const trackedTask = taskService.enqueue({
    type: run ? "project.build-run" : "project.build",
    title: run ? `生成并运行 ${requestedProjectId}` : `生成项目 ${requestedProjectId}`,
    group: `f5:${requestedProjectId}:${Date.now()}`,
    run: async context => {
      context.report(5);
      const cancel = () => projectBuildCoordinator.cancel(requestedProjectId, "user");
      context.signal.addEventListener("abort", cancel, { once: true });
      try {
        await new Promise<void>((resolve, reject) => res.once("finish", () => {
          if (res.statusCode < 400) resolve(); else reject(new Error(`生成请求失败（HTTP ${res.statusCode}）。`));
        }));
        context.report(100, run ? "生成并运行完成。" : "生成完成。");
      } finally {
        context.signal.removeEventListener("abort", cancel);
      }
    }
  });
  res.setHeader("X-LingBuilder-Task-Id", trackedTask.id);
  void trackedTask.result.catch(() => undefined);

  let buildLease: ProjectBuildLease | undefined;
  let preBuildLogs: string[] = [];
  try {
    const buildSession = await projectBuildSessionService.begin(requestedProjectId, buildAdmission);
    buildLease = buildSession.lease;
    if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
    const projectId = await requireExistingProject(requestedProjectId);
    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, preBuildLogs));
    }
    // 项目级 DLL 命令声明：解析声明文件（虚拟模块由生成器内部合成，这里准备物化数据）。
    const projectDllSource = lingCppSources?.find(source => isProjectDllCommandsFilePath(source.filePath))
      ?? (typeof lingCppSourceCode === "string" && isProjectDllCommandsFilePath(lingCppSourceFilePath || "") ? { sourceCode: lingCppSourceCode } : undefined);
    const projectDllLibraries = projectDllSource
      ? (parseLingCpp(projectDllSource.sourceCode).program.dllLibraries || [])
      : [];
    const sourceCode = typeof lingCppSourceCode === "string"
      ? lingCppSourceCode
      : typeof eplSourceCode === "string"
        ? eplSourceCode
        : "";
    const enabledModules = await getModuleService().getEnabledProjectModules(projectId);
    assertEnabledModuleAccess(enabledModules);
    await requireEnabledModuleSdkDependencies(enabledModules);
    const buildCompatibility = await buildConfigurationService.ensureCompatibleWithModules(enabledModules.map(module => module.manifest.id));
    const buildConfiguration = buildCompatibility.configuration;
    preBuildLogs.push(...buildCompatibility.messages);
    // 输出类型来自解决方案项目记录的 buildProperties.outputType（exe 缺省 / dll）；
    // 「生成项目」（run:false）同样按 DLL 模式生成与编译；windows-console 项目按控制台形态生成。
    let routeOutputType: "exe" | "dll" = "exe";
    let routeConsoleMode = false;
    let routeExecutableName: string | undefined;
    let routeSourceRoot = "src";
    let routeRequireAdministrator = false;
    let routeSolutionEntryPath: string | undefined;
    try {
      const solutionForOutputType = await getSolutionService().getSolution();
      const recordForOutputType = solutionForOutputType.projects.find(item => item.id === projectId);
      routeOutputType = recordForOutputType?.buildProperties?.outputType === "dll" ? "dll" : "exe";
      routeConsoleMode = recordForOutputType?.type === "windows-console";
      routeExecutableName = recordForOutputType?.buildProperties?.executableName;
      routeSourceRoot = recordForOutputType?.sourceRoot || "src";
      routeRequireAdministrator = recordForOutputType?.buildProperties?.requireAdministrator === true;
      routeSolutionEntryPath = await findSolutionEntryPath(getRepoWorkspaceRoot(), solutionForOutputType.name || "");
    } catch {
      // 解决方案尚未建立时按 EXE 模式构建，且不播报解决方案路径行。
    }
    const routeOutputKind = routeConsoleMode ? "console-application" : routeOutputType === "dll" ? "dynamic-library" : "application";
    let routeOutputNameParts = { baseName: "LingBuilderPreview", fileName: "LingBuilderPreview.exe" };
    try {
      routeOutputNameParts = resolveExecutableNameParts(routeExecutableName, routeOutputType);
    } catch {
      preBuildLogs.push("项目可执行文件名无效，已回退默认命名。");
    }
    const generatedProject = generateLingCppNativeWin32Project(project, {
      activeWindowId,
      lingCppSourceCode: sourceCode,
      lingCppSourceFilePath,
      lingCppSources: await resolveLingCppProjectSources(projectId, lingCppSources),
      enabledModules,
      outputKind: routeOutputKind,
      requireAdministrator: routeRequireAdministrator
    });
    assertNoBlockingLingCppDiagnostics(generatedProject.blockingDiagnostics);
    const repoRoot = getRepoWorkspaceRoot();
    const buildPaths = await resolveServerProjectBuildPaths(projectId, buildConfiguration);
    const buildDir = buildPaths.buildDir;
    const sourceDir = buildPaths.sourceDir;
    const binDir = buildPaths.binDir;
    const objDir = buildPaths.objDir;
    const exportDir = buildPaths.exportDir;

    await Promise.all([
      fs.mkdir(sourceDir, { recursive: true }),
      fs.mkdir(binDir, { recursive: true }),
      fs.mkdir(objDir, { recursive: true }),
      fs.mkdir(exportDir, { recursive: true })
    ]);

    const activeWindow = project.windows.find(w => w.id === activeWindowId) || project.windows[0];
    if (activeWindow && sourceCode.trim()) {
      const fileName = `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`;
      await fs.writeFile(path.join(sourceDir, fileName), sourceCode, "utf8");
    }
    await Promise.all([
      writeGeneratedProjectFiles(sourceDir, generatedProject.files),
      writeGeneratedProjectFiles(exportDir, generatedProject.files)
    ]);
    const assetProjectRef = getSolutionService().getProject(await getSolutionService().getSolution(), projectId);
    let codeGeneratorResult: ProjectCodeGeneratorResult;
    try {
      await fs.rm(path.join(binDir, "LingBuilderPreview.exe"), { force: true });
      codeGeneratorResult = await runProjectCodeGenerators({
        service: buildPipelineService,
        workspaceRoot: repoRoot,
        projectRoot: path.resolve(repoRoot, assetProjectRef.sourceRoot || '.'),
        outputRoot: sourceDir,
        exportRoot: exportDir,
        projectId,
        modules: enabledModules,
        target: createWindowsMsvcBuildTarget(buildConfiguration.architecture === 'x64' ? 'x64' : 'win32'),
        signal: buildLease.signal,
        cache: incrementalBuildService,
        cacheKey: `${projectId}:code-generators:${buildConfiguration.architecture}`,
        log: message => preBuildLogs.push(message)
      });
    } catch (error) {
      return res.status(200).json({
        ok: false,
        stage: "code-generators",
        error: error instanceof Error ? error.message : String(error),
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        sourceMap: generatedProject.sourceMap,
        logs: [...preBuildLogs, `代码生成阶段失败：${error instanceof Error ? error.message : String(error)}`]
      });
    }
    const generatedCodegenFiles = codeGeneratorResult.textFiles;
    const copiedAssets = await designerAssetService.copyProjectAssets(assetProjectRef, [buildDir, binDir, exportDir]);
    const executableIcon = await windowsExecutableIconService.materialize(assetProjectRef, generatedProject.selectedWindow, [buildDir, exportDir, sourceDir], { embeddedResourceSpecs: getEmbeddedResourceSpecsForBuild(project) });
    const copiedBuildContent = [...copiedAssets, ...executableIcon.files];
    const buildContentFiles = copiedBuildContent
      .filter(file => file.startsWith(`${path.resolve(buildDir)}${path.sep}`))
      .map(file => normalizeFilePath(path.relative(buildDir, file)));
    const exportContentFiles = copiedBuildContent
      .filter(file => file.startsWith(`${path.resolve(exportDir)}${path.sep}`))
      .map(file => normalizeFilePath(path.relative(exportDir, file)));
    // 原生模块文件必须在每次 F5 前重新物化；不能让旧 x64/Debug 目录里的 Bridge 头文件继续参与编译。
    await Promise.all([
      fs.rm(path.join(buildDir, "modules"), { recursive: true, force: true }),
      fs.rm(path.join(sourceDir, "modules"), { recursive: true, force: true })
    ]);
    const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
      buildDir,
      sourceDir,
      binDir,
      exportDir
      , preferredTargetId: getModuleTargetId(buildConfiguration)
    });
    // 项目级 DLL 命令声明物化：声明头 + 按实际导出表生成导入库 + DLL 拷到 exe 目录。
    const projectDllLogs: string[] = [];
    if (projectDllLibraries.length > 0) {
      const projectDllSourceRoot = path.resolve(getRepoWorkspaceRoot(), routeSourceRoot);
      const { blocking: projectDllBlocking, libFiles: projectDllLibFiles } = await materializeProjectDllDeclarationModules({
        dllLibraries: projectDllLibraries,
        sourceRootAbsolute: projectDllSourceRoot,
        buildDir,
        sourceDir,
        binDir,
        exportDir,
        machine: buildConfiguration.architecture === "x64" ? "X64" : "X86",
        logs: projectDllLogs
      });
      moduleNativePlan.blockingDiagnostics.push(...projectDllBlocking);
      moduleNativePlan.libFiles.push(...projectDllLibFiles);
    }
    if (moduleNativePlan.blockingDiagnostics.length > 0) {
      return res.status(200).json({
        ok: false,
        stage: "native-dependencies",
        error: moduleNativePlan.blockingDiagnostics.join("\n"),
        buildDir,
        sourceDir,
        binDir,
        objDir,
        exportDir,
        sourceMap: generatedProject.sourceMap,
        logs: [...preBuildLogs, ...generatedProject.diagnostics, ...moduleNativePlan.diagnostics, "原生依赖未准备完整，已阻止编译和运行。"]
      });
    }
    const generatedNativeSources = codeGeneratorResult.outputFiles.filter((file): file is string => typeof file === "string" && /\.(?:c|cc|cpp|cxx)$/iu.test(file));
    moduleNativePlan.sourceFiles.push(...generatedNativeSources);
    moduleNativePlan.includeDirs.push(...new Set(generatedNativeSources.map(file => path.dirname(file))));
    moduleNativePlan.sourceFiles = [...new Set(moduleNativePlan.sourceFiles)];
    moduleNativePlan.includeDirs = [...new Set(moduleNativePlan.includeDirs)];
    const buildVisualStudioProject = await exportVisualStudioProject({
      projectDir: buildDir,
      projectId,
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles].map(file => ({
        ...file,
        relativePath: normalizeFilePath(path.join("src", file.relativePath))
      })),
      enabledModules,
      contentFiles: [...buildContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(path.join('src', artifact.relativePath)))],
      requiredCppStandard: moduleNativePlan.requiredCppStandard,
      requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt,
      projectKind: routeOutputKind,
      fbroRuntimeFromBuildBin: true,
      requireAdministrator: routeRequireAdministrator
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId,
      generatedFiles: [...generatedProject.files, ...generatedCodegenFiles],
      enabledModules,
      contentFiles: [...exportContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(artifact.relativePath))],
      requiredCppStandard: moduleNativePlan.requiredCppStandard,
      requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt,
      projectKind: routeOutputKind,
      requireAdministrator: routeRequireAdministrator
    });

    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, [
        "已完成源码导出，但任务在编译前被停止。"
      ]));
    }

    const compiler = await detectCompiler(buildConfiguration);
    if (!compiler) {
      return res.status(200).json({
        ok: false,
        stage: "compiler",
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
          ...preBuildLogs,
          "已生成 Win32 C++ 工程文件。",
          `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
          `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
          ...generatedProject.diagnostics,
          ...moduleNativePlan.diagnostics,
          "未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。",
          "需要的编译器命令之一：cl、g++、clang++。"
        ]
      });
    }

    const sourcePath = path.join(sourceDir, "main.cpp");
    const exePath = path.join(binDir, routeOutputNameParts.fileName);
    const executableResourcePath = generatedProject.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)
      ? path.join(sourceDir, WINDOWS_EXECUTABLE_RESOURCE_FILE)
      : undefined;
    const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, buildConfiguration, executableResourcePath, undefined, routeOutputType, routeRequireAdministrator);
    const compilerDiagnostics = mapCompilerDiagnostics(
      parseCompilerDiagnostics(compileResult.logs.join("\n"), compiler.kind === "clang++" ? "clang" : compiler.kind === "g++" ? "gcc" : "msvc"),
      generatedProject.sourceMap,
      repoRoot
    );
    const logs = [
      ...preBuildLogs,
      ...projectDllLogs,
      ...formatBuildPathSummaryLines({
        buildDir,
        exportDir,
        binDir,
        outputKind: resolveBuildOutputKind(routeOutputType, routeConsoleMode),
        compilerSummary: `${compiler.kind} (${compiler.command})`,
        buildConfigurationSummary: `${buildConfiguration.mode}|${buildConfiguration.architecture}`,
        solutionPath: routeSolutionEntryPath
      }),
      ...generatedProject.diagnostics,
      ...codeGeneratorResult.logs,
      ...moduleNativePlan.diagnostics,
      moduleNativePlan.runtimeFiles.length ? `已复制模块运行时文件：${moduleNativePlan.runtimeFiles.map(file => path.basename(file)).join(", ")}` : "",
      ...compileResult.logs
    ].filter(Boolean);

    if (!compileResult.ok) {
      return res.status(200).json({
        ok: false,
        stage: "compile",
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
        compilerDiagnostics,
        logs
      });
    }

    if (buildLease.isCancelled()) {
      return res.status(409).json(createCancelledBuildResult(buildLease, [
        ...logs,
        "编译已结束，但启动请求已被停止；不会启动生成的 exe。"
      ]));
    }

    if (routeOutputType === "dll") {
      // 动态库没有运行入口：编译完成即产物。产物路径不再依赖 run 播报，
      // run 请求也不再尝试把 .dll 当进程启动。
      if (run) logs.push("动态库输出模式：编译完成后不启动运行进程。");
      logs.push(`DLL 产物：${exePath}`, `导入库：${exePath.replace(/\.dll$/iu, ".lib")}`);
    } else {
      logs.push(`程序产物：${exePath}`);
    }

    if (run && routeOutputType !== "dll") {
      try {
        const logFile = path.join(buildDir, "run.log");
        const started = await managedProcessService.start(projectId, exePath, {
          cwd: binDir,
          env: createFbroRuntimeEnvironment(),
          detached: false,
          // 控制台程序输出经 run.log 进输出面板；隐藏宿主控制台，避免弹出空黑窗。
          windowsHide: routeConsoleMode,
          logFilePath: logFile
        });
        if (buildLease.isCancelled()) {
          const stopped = await managedProcessService.stop(projectId);
          return res.status(409).json(createCancelledBuildResult(buildLease, [
            ...logs,
            stopped.message,
            "运行进程在登记期间收到停止请求，已回收且不会遗留后台进程。"
          ]));
        }
        logs.push(`已启动受控运行窗口：${exePath}（PID ${started.pid}）`);
        if (started.replaced) logs.push("已停止并替换该项目先前的运行进程。");
      } catch (error: any) {
        const message = error?.message || "无法启动生成的 exe";
        logs.push(`运行启动失败：${message}`);
        return res.status(500).json({
          ok: false,
          stage: "run-start",
          error: message,
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
        });
      }
    }

    return res.json({
      ok: true,
      stage: run ? "run" : "build",
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
      compilerDiagnostics,
      logs
    });
  } catch (error: any) {
    const expectedConflict = error instanceof ProjectBuildBusyError
      || error instanceof ProjectBuildCancelledBeforeStartError
      || error instanceof ProjectBuildPreparationError;
    return res.status(error?.status || (expectedConflict ? 409 : 500)).json({
      ok: false,
      code: error?.code,
      moduleId: error?.moduleId,
      ...createSdkDependencyErrorPayload(error),
      stage: error instanceof ProjectBuildBusyError
        ? "busy"
        : error instanceof ProjectBuildCancelledBeforeStartError
          ? "cancelled"
        : error instanceof ProjectBuildPreparationError
          ? error.stage
          : "server",
      error: error?.message || "窗口设计器构建运行失败"
    });
  } finally {
    buildLease?.finish();
  }
});

async function enqueueSolutionBuildTask(options: {
  projectId?: string; run: boolean; admission: ProjectBuildAdmission; rebuild: boolean;
}) {
  // 任务标题带中文项目名：任务日志经 [标题] 前缀进输出面板，不能用英文项目 id 播报。
  let projectLabel = options.projectId || "";
  try {
    const solutionForTitle = await getSolutionService().getSolution();
    if (options.projectId) {
      projectLabel = solutionForTitle.projects.find(project => project.id === options.projectId)?.name || options.projectId;
    }
  } catch {
    // 标题取不到中文名时回退项目 id，不阻断构建任务。
  }
  const title = options.rebuild
    ? (options.projectId ? `重新生成项目 ${projectLabel}` : "重新生成解决方案")
    : (options.projectId ? `生成项目 ${projectLabel}` : "生成解决方案");
  return taskService.enqueue({
    type: options.rebuild ? "solution.rebuild" : "solution.build",
    title,
    group: `build:${options.projectId || "solution"}`,
    run: async context => {
      const solutionAtStart = await getSolutionService().getSolution();
      const buildProjectIds = getSolutionService().getBuildOrder(
        solutionAtStart,
        options.projectId ? [options.projectId] : undefined
      ).map(project => project.id);
      const cancelBuild = () => buildProjectIds.forEach(projectId => projectBuildCoordinator.cancel(projectId, "user"));
      context.signal.addEventListener("abort", cancelBuild, { once: true });
      try {
        let clean: Awaited<ReturnType<ReturnType<typeof getSolutionService>["cleanProjects"]>> | undefined;
        if (options.rebuild) {
          context.report(10, "正在清理旧构建产物。");
          clean = await getSolutionService().cleanProjects(options.projectId ? [options.projectId] : undefined);
          clean.logs.forEach(line => context.log(line));
          await incrementalBuildService.invalidate(buildProjectIds.map(projectId => `${projectId}:Debug:Win32`).concat(
            buildProjectIds.flatMap(projectId => [`${projectId}:Debug:x64`, `${projectId}:Release:Win32`, `${projectId}:Release:x64`])
          ));
        }
        context.report(options.rebuild ? 30 : 10);
        const build = await buildSolutionProjects({ projectId: options.projectId, run: options.run, admission: options.admission, incremental: !options.rebuild });
        build.logs.forEach(line => context.log(line));
        if (!build.ok) throw new Error(build.logs.at(-1) || "生成失败。");
        context.report(100);
        return clean ? { ...build, logs: [...clean.logs, ...build.logs], clean } : build;
      } finally {
        context.signal.removeEventListener("abort", cancelBuild);
      }
    }
  });
}

/**
 * D3：收集本项目 references 指向的外部工程产物——include 目录（源码根 + include 子目录）
 * 与导入库（.lib）。中文主程序引用外部 C++ 工程时，这些产物会合并进编译链接计划，
 * 形成“中文主程序 + C++ 库”混合解决方案。外部工程需先构建成功，否则只给提示不阻断。
 */
async function collectReferencedExternalArtifacts(
  solution: { projects: Array<{ id: string; name: string; type: string; sourceRoot?: string; projectFile?: string; references?: string[]; buildProperties?: any }> },
  projectRef: { id: string; references?: string[] }
): Promise<{ artifacts: { includeDirs: string[]; libFiles: string[] }; logs: string[] }> {
  const artifacts = { includeDirs: [] as string[], libFiles: [] as string[] };
  const logs: string[] = [];
  for (const referenceId of projectRef.references || []) {
    const referenced = solution.projects.find(project => project.id === referenceId);
    if (!referenced || !["external-cmake", "external-msbuild", "windows-dll"].includes(referenced.type)) continue;
    try {
      const outputDir = await externalProjectService.resolveOutputDir(referenced as any);
      const libraries = await externalProjectService.locateLibraries(referenced as any, outputDir);
      const sourceRootAbsolute = path.resolve(serverRuntimeConfig.workspaceRoot, referenced.sourceRoot || ".");
      const includeDirs = [sourceRootAbsolute];
      const includeSubdir = path.join(sourceRootAbsolute, "include");
      try { if ((await fs.stat(includeSubdir)).isDirectory()) includeDirs.push(includeSubdir); } catch { /* 无 include 子目录 */ }
      artifacts.includeDirs.push(...includeDirs);
      artifacts.libFiles.push(...libraries);
      logs.push(`引用外部工程 ${referenced.name}：include ${includeDirs.join(" ; ")}；${libraries.length ? `链接 ${libraries.map(file => path.basename(file)).join(", ")}` : "未找到可链接的 .lib（如需链接请先构建该工程）"}`);
    } catch (error: any) {
      logs.push(`引用外部工程 ${referenced.name} 的产物收集失败：${error?.message || error}`);
    }
  }
  return { artifacts, logs };
}

async function buildSolutionProjects(options: {  projectId?: string;
  run?: boolean;
  admission?: ProjectBuildAdmission;
  incremental?: boolean;
}) {
  const solutionService = getSolutionService();
  const solution = await solutionService.getSolution();
  const projects = options.projectId
    ? solutionService.getBuildOrder(solution, [options.projectId])
    : solutionService.getBuildOrder(solution);
  const runProjectIds = new Set(options.projectId ? [options.projectId] : solution.startupProjectIds);
  const logs: string[] = [
    options.projectId
      ? `开始生成项目：${projects[0]?.name || options.projectId}`
      : `开始生成解决方案：${solution.name}（${projects.length} 个项目）`
  ];
  const results: any[] = [];
  let ok = true;
  let stage = "build";
  const startedAtMs = Date.now();

  const batches = dependencyBuildBatches(projects);
  // 单阶段单项目时，计划/阶段行与首行「开始生成」完全重复，不再输出；
  // 多项目单阶段压成一行并行清单，只有真正的多阶段依赖才展开计划与逐阶段行。
  if (batches.length > 1) {
    logs.push(`构建计划：${batches.length} 个依赖阶段，阶段内最多 ${Math.max(...batches.map(batch => batch.length))} 个项目并行。`);
  }
  for (const [batchIndex, batch] of batches.entries()) {
    if (batches.length > 1) {
      logs.push(`开始构建阶段 ${batchIndex + 1}/${batches.length}：${batch.map(project => project.name).join("、")}`);
    } else if (batch.length > 1) {
      logs.push(`并行生成：${batch.map(project => project.name).join("、")}`);
    }
    const batchResults = await Promise.all(batch.map(async projectRef => {
    // windows-dll 项目不再走外部 msbuild 简化翻译（那条路只支持「获取接口版本」级映射），
    // 统一落入下方生成器构建分支：零窗口设计器 + outputType=dll 由生成器按源码第一个类
    // 合成名义宿主窗口，任意「公开」子程序确定性导出，产物为纯逻辑精简形态，
    // 且构建配置跟随全局状态栏（Release/x64），与 visual-cpp 项目同口径。
    if (projectRef.type === "external-cmake" || projectRef.type === "external-msbuild") {
      const lease = projectBuildCoordinator.begin(projectRef.id, options.admission);
      try {
        const externalResult = await externalProjectService.build(projectRef as any, lease.signal);
        // D1：解析 MSVC/MSBuild 原样输出为结构化诊断，复用问题面板与 AI 解释链路。
        const compilerDiagnostics = parseMsvcBuildOutput(externalResult.stdout, externalResult.stderr);
        // 诊断文件路径规整为工作区相对路径（编译器输出多为绝对路径或相对工程目录），便于问题面板点击跳转。
        const detectWorkspaceRoot = path.resolve(serverRuntimeConfig.workspaceRoot);
        for (const diagnostic of compilerDiagnostics) {
          if (!diagnostic.filePath || diagnostic.filePath === "LINK") continue;
          try {
            const absolute = path.isAbsolute(diagnostic.filePath)
              ? diagnostic.filePath
              : path.resolve(externalResult.cwd, diagnostic.filePath);
            const relative = path.relative(detectWorkspaceRoot, absolute);
            diagnostic.filePath = relative && !relative.startsWith("..") && !path.isAbsolute(relative)
              ? relative.replace(/\\/gu, "/")
              : absolute;
          } catch { /* 保持原值 */ }
        }
        const externalLogs = [
          externalResult.stdout,
          externalResult.stderr
        ].filter(Boolean);
        if (compilerDiagnostics.length) {
          const errorCount = compilerDiagnostics.filter(item => item.severity === "error").length;
          externalLogs.push(`已解析出 ${compilerDiagnostics.length} 条构建诊断（错误 ${errorCount} 条），可在“问题”面板查看。`);
        }
        if (!externalResult.ok) {
          return { projectId: projectRef.id, projectName: projectRef.name, stage: "external-build", logs: externalLogs, compilerDiagnostics, ...externalResult };
        }
        // E1：外部工程作为运行目标时，构建成功后定位可执行文件并托管启动。
        const shouldRun = options.run && runProjectIds.has(projectRef.id);
        if (!shouldRun) {
          return { projectId: projectRef.id, projectName: projectRef.name, stage: "external-build", logs: externalLogs, compilerDiagnostics, ...externalResult };
        }
        try {
          const executablePath = await externalProjectService.locateExecutable(projectRef as any, externalResult.outputDir);
          if (!executablePath) {
            externalLogs.push(`未找到可执行文件：已在 ${externalResult.outputDir} 与工程目录中查找。可在“构建属性”中填写“可执行文件名”帮助定位。`);
            return { projectId: projectRef.id, projectName: projectRef.name, logs: externalLogs, compilerDiagnostics, ...externalResult, ok: false, stage: "run-start" };
          }
          const started = await managedProcessService.start(projectRef.id, executablePath, {
            cwd: path.dirname(executablePath),
            detached: false,
            windowsHide: false,
            logFilePath: path.join(externalResult.outputDir, "run.log")
          });
          externalLogs.push(`已启动运行：${executablePath}（PID ${started.pid}）`);
          if (started.replaced) externalLogs.push("已停止并替换该项目先前的运行进程。");
          return { projectId: projectRef.id, projectName: projectRef.name, stage: "external-build", logs: externalLogs, compilerDiagnostics, ...externalResult };
        } catch (runError: any) {
          const message = runError?.message || "无法启动构建产物";
          externalLogs.push(`运行启动失败：${message}`);
          return { projectId: projectRef.id, projectName: projectRef.name, logs: externalLogs, compilerDiagnostics, ...externalResult, ok: false, stage: "run-start", error: message };
        }
      } finally { lease.finish(); }
    }
    const designerSnapshot = await solutionService.readDesignerProjectSnapshot(projectRef);
    let project = designerSnapshot.project;
    if (!designerSnapshot.persisted && (projectRef.type === "windows-dll" || projectRef.buildProperties?.outputType === "dll")) {
      // 无窗口动态库项目（含由窗口模板转成无窗口的存量项目）：设计器零窗口/缺失时
      // readDesignerProject 返回的是合成默认窗口模型（类名与源码类失配会导致导出面为空），
      // 这里清空窗口，让生成器按动态库输出按源码第一个类合成名义宿主窗口。
      project = { ...project, windows: [] };
    }
    const files = await solutionService.readProjectFiles(projectRef);
    const source = resolveProjectLingCppSource(projectRef, project, files);
    const referencedExternal = await collectReferencedExternalArtifacts(solution, projectRef);
    logs.push(...referencedExternal.logs);
    const result = await runControlledWindowDesignerBuild({
      project,
      activeWindowId: project.windows[0]?.id,
      lingCppSourceCode: source.sourceCode,
      lingCppSourceFilePath: source.filePath,
      lingCppSources: source.sources,
      run: Boolean(options.run && runProjectIds.has(projectRef.id)),
      buildAdmission: options.admission,
      incremental: options.incremental !== false,
      referencedExternalArtifacts: referencedExternal.artifacts
    });
    return { projectId: projectRef.id, projectName: projectRef.name, ...result };
    }));
    results.push(...batchResults);
    for (const result of batchResults) {
      logs.push(...(result.logs || []).map((line: string) => `[${result.projectName}] ${line}`));
      if (!result.ok) {
        ok = false; stage = result.stage || "build";
        logs.push(`项目 ${result.projectName} 生成失败：${result.stage || "未知错误"}`);
      } else logs.push(`项目 ${result.projectName} ${"incrementalHit" in result && result.incrementalHit ? "增量检查完成，无需重新编译" : "生成完成"}。`);
    }
    if (!ok) break;
  }

  logs.push(ok ? `解决方案生成完成（用时 ${((Date.now() - startedAtMs) / 1000).toFixed(1)} 秒）。` : "解决方案生成已停止。");
  return {
    ok,
    stage,
    solution,
    results,
    logs
  };
}

async function runControlledWindowDesignerBuild(options: {
  project: LingWindowProject;
  activeWindowId?: string;
  lingCppSourceCode?: string;
  lingCppSourceFilePath?: string;
  lingCppSources?: LingCppProjectSourceFile[];
  run?: boolean;
  buildAdmission?: ProjectBuildAdmission;
  incremental?: boolean;
  /** D3：本项目 references 指向的外部工程产物（include 目录与导入库），合并进编译链接计划。 */
  referencedExternalArtifacts?: { includeDirs: string[]; libFiles: string[] };
}) {
  const { project, activeWindowId, lingCppSourceCode, lingCppSourceFilePath, lingCppSources, run = false, buildAdmission, incremental = true, referencedExternalArtifacts } = options;
  let buildLease: ProjectBuildLease | undefined;
  let projectId: string;
  let preBuildLogs: string[] = [];
  try {
    if (!isNonEmptyString(project.id)) throw new Error("窗口设计器项目缺少有效 project.id。");
    projectId = project.id.trim();
    const effectiveAdmission = buildAdmission ?? projectBuildCoordinator.captureAdmission(projectId);
    const buildSession = await projectBuildSessionService.begin(projectId, effectiveAdmission);
    buildLease = buildSession.lease;
    if (buildSession.previousRun.found) preBuildLogs = [buildSession.previousRun.message];
    await requireExistingProject(projectId);
  } catch (error) {
    return {
      ok: false,
      stage: error instanceof ProjectBuildBusyError
        ? "busy"
        : error instanceof ProjectBuildCancelledBeforeStartError
          ? "cancelled"
        : error instanceof ProjectBuildPreparationError
          ? error.stage
          : "server",
      error: error instanceof Error ? error.message : "无法开始项目生成任务。",
      logs: [error instanceof Error ? error.message : "无法开始项目生成任务。"]
    };
  }

  try {
  if (buildLease.isCancelled()) return createCancelledBuildResult(buildLease, preBuildLogs);
  const sourceCode = typeof lingCppSourceCode === "string" ? lingCppSourceCode : "";
  const enabledModules = await getModuleService().getEnabledProjectModules(projectId);
  assertEnabledModuleAccess(enabledModules);
  await requireEnabledModuleSdkDependencies(enabledModules);
  const buildCompatibility = await buildConfigurationService.ensureCompatibleWithModules(enabledModules.map(module => module.manifest.id));
  const buildConfiguration = buildCompatibility.configuration;
  preBuildLogs.push(...buildCompatibility.messages);
  // 输出类型来自解决方案项目记录的 buildProperties.outputType（exe 缺省 / dll）；
  // DLL 模式会改变生成入口（DllMain + "公开"子程序导出包装），必须在生成前解析。
  // windows-console 项目使用控制台入口（wmain + “公开 启动()”），同样必须在生成前解析。
  let outputType: "exe" | "dll" = "exe";
  let consoleMode = false;
  let outputExecutableName: string | undefined;
  let projectSourceRootForDll = "src";
  let requireAdministrator = false;
  let projectDllLibraries: import("./src/services/lingCpp/types").LingCppDllLibrary[] = [];
  let solutionEntryPathForLogs: string | undefined;
  try {
    const solutionForOutputType = await getSolutionService().getSolution();
    const recordForOutputType = solutionForOutputType.projects.find(item => item.id === projectId);
    outputType = recordForOutputType?.buildProperties?.outputType === "dll" ? "dll" : "exe";
    consoleMode = recordForOutputType?.type === "windows-console";
    outputExecutableName = recordForOutputType?.buildProperties?.executableName;
    projectSourceRootForDll = recordForOutputType?.sourceRoot || "src";
    requireAdministrator = recordForOutputType?.buildProperties?.requireAdministrator === true;
    solutionEntryPathForLogs = await findSolutionEntryPath(getRepoWorkspaceRoot(), solutionForOutputType.name || "");
  } catch {
    // 解决方案尚未建立时按 EXE 模式构建，且不播报解决方案路径行。
  }
  {
    const declarationSource = lingCppSources?.find(source => isProjectDllCommandsFilePath(source.filePath));
    if (declarationSource) {
      projectDllLibraries = parseLingCpp(declarationSource.sourceCode).program.dllLibraries || [];
    }
  }
  let outputFileNameParts = { baseName: "LingBuilderPreview", fileName: "LingBuilderPreview.exe" };
  try {
    outputFileNameParts = resolveExecutableNameParts(outputExecutableName, outputType);
  } catch {
    preBuildLogs.push("项目可执行文件名无效，已回退默认命名。");
  }
  const generatedProject = generateLingCppNativeWin32Project(project, {
    activeWindowId,
    lingCppSourceCode: sourceCode,
    lingCppSourceFilePath,
    lingCppSources: lingCppSources?.length ? lingCppSources : await resolveLingCppProjectSources(projectId),
    enabledModules,
    outputKind: consoleMode ? "console-application" : outputType === "dll" ? "dynamic-library" : "application",
    requireAdministrator
  });
  assertNoBlockingLingCppDiagnostics(generatedProject.blockingDiagnostics);
  const repoRoot = getRepoWorkspaceRoot();
  const buildPaths = await resolveServerProjectBuildPaths(projectId, buildConfiguration);
  const buildDir = buildPaths.buildDir;
  const sourceDir = buildPaths.sourceDir;
  const binDir = buildPaths.binDir;
  const objDir = buildPaths.objDir;
  const exportDir = buildPaths.exportDir;
  const exePath = path.join(binDir, outputFileNameParts.fileName);

  await Promise.all([
    fs.mkdir(sourceDir, { recursive: true }),
    fs.mkdir(binDir, { recursive: true }),
    fs.mkdir(objDir, { recursive: true }),
    fs.mkdir(exportDir, { recursive: true })
  ]);

  const activeWindow = project.windows.find(w => w.id === activeWindowId) || project.windows[0];
  if (activeWindow && sourceCode.trim()) {
    const fileName = `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`;
    await fs.writeFile(path.join(sourceDir, fileName), sourceCode, "utf8");
  }
  await Promise.all([
    writeGeneratedProjectFiles(sourceDir, generatedProject.files),
    writeGeneratedProjectFiles(exportDir, generatedProject.files)
  ]);
  const assetProjectRef = getSolutionService().getProject(await getSolutionService().getSolution(), projectId);
  let codeGeneratorResult: ProjectCodeGeneratorResult;
  try {
    await fs.rm(exePath, { force: true });
    codeGeneratorResult = await runProjectCodeGenerators({
      service: buildPipelineService,
      workspaceRoot: repoRoot,
      projectRoot: path.resolve(repoRoot, assetProjectRef.sourceRoot || '.'),
      outputRoot: sourceDir,
      exportRoot: exportDir,
      projectId,
      modules: enabledModules,
      target: createWindowsMsvcBuildTarget(buildConfiguration.architecture === 'x64' ? 'x64' : 'win32'),
      signal: buildLease.signal,
      cache: incrementalBuildService,
      cacheKey: `${projectId}:code-generators:${buildConfiguration.architecture}`,
      log: message => preBuildLogs.push(message)
    });
  } catch (error) {
    return {
      ok: false,
      stage: "code-generators",
      error: error instanceof Error ? error.message : String(error),
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exportDir,
      sourceMap: generatedProject.sourceMap,
      logs: [...preBuildLogs, `代码生成阶段失败：${error instanceof Error ? error.message : String(error)}`]
    };
  }
  const generatedCodegenFiles = codeGeneratorResult.textFiles;
  const copiedAssets = await designerAssetService.copyProjectAssets(assetProjectRef, [buildDir, binDir, exportDir]);
  const executableIcon = await windowsExecutableIconService.materialize(assetProjectRef, generatedProject.selectedWindow, [buildDir, exportDir, sourceDir], { embeddedResourceSpecs: getEmbeddedResourceSpecsForBuild(project) });
  const copiedBuildContent = [...copiedAssets, ...executableIcon.files];
  const buildContentFiles = copiedBuildContent
    .filter(file => file.startsWith(`${path.resolve(buildDir)}${path.sep}`))
    .map(file => normalizeFilePath(path.relative(buildDir, file)));
  const exportContentFiles = copiedBuildContent
    .filter(file => file.startsWith(`${path.resolve(exportDir)}${path.sep}`))
    .map(file => normalizeFilePath(path.relative(exportDir, file)));
  const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
    buildDir,
    sourceDir,
    binDir,
    exportDir,
    preferredTargetId: getModuleTargetId(buildConfiguration)
  });
  // 项目级 DLL 命令声明物化：声明头 + 按实际导出表生成导入库 + DLL 拷到 exe 目录。
  const projectDllLogs: string[] = [];
  if (outputType === "exe" && projectDllLibraries.length > 0) {
    const { blocking: projectDllBlocking, libFiles: projectDllLibFiles } = await materializeProjectDllDeclarationModules({
      dllLibraries: projectDllLibraries,
      sourceRootAbsolute: path.resolve(getRepoWorkspaceRoot(), projectSourceRootForDll),
      buildDir,
      sourceDir,
      binDir,
      exportDir,
      machine: buildConfiguration.architecture === "x64" ? "X64" : "X86",
      logs: projectDllLogs
    });
    moduleNativePlan.blockingDiagnostics.push(...projectDllBlocking);
    moduleNativePlan.libFiles.push(...projectDllLibFiles);
  }
  if (moduleNativePlan.blockingDiagnostics.length > 0) {
    return {
      ok: false,
      stage: "native-dependencies",
      error: moduleNativePlan.blockingDiagnostics.join("\n"),
      buildDir,
      sourceDir,
      binDir,
      objDir,
      exportDir,
      sourceMap: generatedProject.sourceMap,
      logs: [...preBuildLogs, ...generatedProject.diagnostics, ...moduleNativePlan.diagnostics, "原生依赖未准备完整，已阻止编译和运行。"]
    };
  }
  const generatedNativeSources = codeGeneratorResult.outputFiles.filter((file): file is string => typeof file === "string" && /\.(?:c|cc|cpp|cxx)$/iu.test(file));
  moduleNativePlan.sourceFiles.push(...generatedNativeSources);
  moduleNativePlan.includeDirs.push(...new Set(generatedNativeSources.map(file => path.dirname(file))));
  // D3：合并 references 指向的外部工程产物（include 目录 + 导入库），实现“中文主程序 + C++ 库”混合构建。
  if (referencedExternalArtifacts && (referencedExternalArtifacts.includeDirs.length || referencedExternalArtifacts.libFiles.length)) {
    moduleNativePlan.includeDirs.push(...referencedExternalArtifacts.includeDirs);
    moduleNativePlan.libFiles.push(...referencedExternalArtifacts.libFiles);
  }
  moduleNativePlan.sourceFiles = [...new Set(moduleNativePlan.sourceFiles)];
  moduleNativePlan.includeDirs = [...new Set(moduleNativePlan.includeDirs)];
  const buildVisualStudioProject = await exportVisualStudioProject({
    projectDir: buildDir,
    projectId,
    generatedFiles: [...generatedProject.files, ...generatedCodegenFiles].map(file => ({
      ...file,
      relativePath: normalizeFilePath(path.join("src", file.relativePath))
    })),
    enabledModules,
    contentFiles: [...buildContentFiles, ...codeGeneratorResult.artifacts.filter(artifact => artifact.kind === 'descriptor' || artifact.kind === 'runtime').map(artifact => normalizeFilePath(path.join('src', artifact.relativePath)))],
    requiredCppStandard: moduleNativePlan.requiredCppStandard,
    requiresDynamicCrt: moduleNativePlan.requiresDynamicCrt,
    projectKind: consoleMode ? "console-application" : outputType === "dll" ? "dynamic-library" : "application",
    fbroRuntimeFromBuildBin: true,
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
    projectKind: consoleMode ? "console-application" : outputType === "dll" ? "dynamic-library" : "application",
    requireAdministrator
  });

  const incrementalKey = `${projectId}:${buildConfiguration.mode}:${buildConfiguration.architecture}`;
  const incrementalFingerprint = incrementalBuildService.fingerprint({
    schemaVersion: 1,
    project,
    sourceCode,
    sourceFilePath: lingCppSourceFilePath || "",
    generatedFiles: generatedProject.files,
    codeGenerators: {
      fingerprint: codeGeneratorResult.fingerprint,
      artifacts: codeGeneratorResult.artifacts
    },
    executableIcon: executableIcon.fingerprint,
    enabledModules,
    buildConfiguration,
    // UAC 提权级别只影响链接参数，不影响生成源码；必须进指纹，否则翻转后增量命中会跳过重链接。
    requireAdministrator
  });
  if (incremental && !run && await incrementalBuildService.isFresh(incrementalKey, incrementalFingerprint)) {
    return {
      ok: true,
      stage: "incremental",
      incrementalHit: true,
      buildDir, sourceDir, binDir, objDir, exePath, exportDir,
      visualStudioProject: buildVisualStudioProject,
      exportVisualStudioProject: exportVisualStudioProjectResult,
      sourceMap: generatedProject.sourceMap,
      compilerDiagnostics: [],
      logs: [...preBuildLogs, "增量构建命中：输入和输出均未变化，已跳过 C++ 编译。"]
    };
  }

  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, ["已完成源码导出，但任务在编译前被停止。"]);
  }

  const compiler = await detectCompiler(buildConfiguration);
  if (!compiler) {
    return {
      ok: false,
      stage: "compiler",
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
        ...preBuildLogs,
        "已生成 Win32 C++ 工程文件。",
        `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
        `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
        ...generatedProject.diagnostics,
        ...moduleNativePlan.diagnostics,
        "未检测到可用 C++ 编译器。请安装 Visual Studio Build Tools、MinGW g++ 或 LLVM clang++ 后重试。",
        "需要的编译器命令之一：cl、g++、clang++。"
      ]
    };
  }

  const sourcePath = path.join(sourceDir, "main.cpp");
  const executableResourcePath = generatedProject.files.some(file => file.relativePath === WINDOWS_EXECUTABLE_RESOURCE_FILE)
    ? path.join(sourceDir, WINDOWS_EXECUTABLE_RESOURCE_FILE)
    : undefined;
  const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, buildConfiguration, executableResourcePath, buildLease.signal, outputType, requireAdministrator);
  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, [...preBuildLogs, ...compileResult.logs, "编译子进程已终止并完成取消清理。"]);
  }
  const compilerDiagnostics = mapCompilerDiagnostics(
    parseCompilerDiagnostics(compileResult.logs.join("\n"), compiler.kind === "clang++" ? "clang" : compiler.kind === "g++" ? "gcc" : "msvc"),
    generatedProject.sourceMap,
    repoRoot
  );
  const logs = [
    ...preBuildLogs,
    ...projectDllLogs,
    ...formatBuildPathSummaryLines({
      buildDir,
      exportDir,
      binDir,
      outputKind: resolveBuildOutputKind(outputType, consoleMode),
      compilerSummary: `${compiler.kind} (${compiler.command})`,
      solutionPath: solutionEntryPathForLogs
    }),
    ...generatedProject.diagnostics,
    ...codeGeneratorResult.logs,
    ...moduleNativePlan.diagnostics,
    moduleNativePlan.runtimeFiles.length ? `已复制模块运行时文件：${moduleNativePlan.runtimeFiles.map(file => path.basename(file)).join(", ")}` : "",
    ...compileResult.logs
  ].filter(Boolean);

  if (!compileResult.ok) {
    return {
      ok: false,
      stage: "compile",
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
      compilerDiagnostics,
      logs
    };
  }

  await incrementalBuildService.record(incrementalKey, incrementalFingerprint, [exePath]);

  if (buildLease.isCancelled()) {
    return createCancelledBuildResult(buildLease, [
      ...logs,
      "编译已结束，但启动请求已被停止；不会启动生成的 exe。"
    ]);
  }

  if (outputType === "dll") {
    // 动态库没有运行入口：编译完成即产物。产物路径不再依赖 run 播报——
    // 「生成项目/生成动态库」（run:false）同样要能看到 dll 与导入库的完整路径。
    if (run) logs.push("动态库输出模式：编译完成后不启动运行进程。");
    logs.push(`DLL 产物：${exePath}`, `导入库：${exePath.replace(/\.dll$/iu, ".lib")}`);
  } else {
    logs.push(`程序产物：${exePath}`);
  }
  if (run && outputType !== "dll") {
    try {
      const logFile = path.join(buildDir, "run.log");
      const started = await managedProcessService.start(projectId, exePath, {
        cwd: binDir,
        env: createFbroRuntimeEnvironment(),
        detached: false,
        // 控制台程序的输出经 run.log 进入 IDE 输出面板；隐藏宿主控制台，避免弹出空黑窗。
        windowsHide: consoleMode,
        logFilePath: logFile
      });
      if (buildLease.isCancelled()) {
        const stopped = await managedProcessService.stop(projectId);
        return createCancelledBuildResult(buildLease, [
          ...logs,
          stopped.message,
          "运行进程在登记期间收到停止请求，已回收且不会遗留后台进程。"
        ]);
      }
      logs.push(`已启动受控运行窗口：${exePath}（PID ${started.pid}）`);
      if (started.replaced) logs.push("已停止并替换该项目先前的运行进程。");
    } catch (error: any) {
      const message = error?.message || "无法启动生成的 exe";
      logs.push(`运行启动失败：${message}`);
      return {
        ok: false,
        stage: "run-start",
        error: message,
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
  }

  return {
    ok: true,
    stage: run && outputType !== "dll" ? "run" : "build",
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
    compilerDiagnostics,
    logs
  };
  } finally {
    buildLease.finish();
  }
}

function createCancelledBuildResult(buildLease: ProjectBuildLease, logs: string[] = []) {
  const reason = buildLease.getCancelReason();
  const reasonText = reason === "shutdown"
    ? "本地服务正在关闭"
    : reason === "project-delete"
      ? "项目正在删除"
      : "用户已请求停止";
  const error = `项目“${buildLease.projectId}”的生成运行任务已取消：${reasonText}。`;
  return {
    ok: false,
    stage: "cancelled",
    error,
    projectId: buildLease.projectId,
    taskId: buildLease.taskId,
    logs: [...logs, error]
  };
}

function resolveProjectLingCppSource(
  projectRef: LingBuilderSolutionProject,
  project: LingWindowProject,
  files: Record<string, string>
): { filePath: string; sourceCode: string; sources: LingCppProjectSourceFile[] } {
  const activeWindow = project.windows[0];
  const preferredName = activeWindow
    ? `${activeWindow.className || activeWindow.fileName.replace(/\.xml$/i, "")}.lcpp`
    : "";
  const preferredPath = preferredName ? `${projectRef.sourceRoot}/${preferredName}` : "";
  if (preferredPath && typeof files[preferredPath] === "string") {
    return { filePath: preferredPath, sourceCode: files[preferredPath], sources: collectProjectLingCppSources(projectRef, files) };
  }
  const fallbackPath = Object.keys(files).find(filePath => filePath.endsWith(".lcpp")) || preferredPath || `${projectRef.sourceRoot}/MainWindow.lcpp`;
  return { filePath: fallbackPath, sourceCode: files[fallbackPath] || "", sources: collectProjectLingCppSources(projectRef, files) };
}

function collectProjectLingCppSources(projectRef: LingBuilderSolutionProject, files: Record<string, string>): LingCppProjectSourceFile[] {
  const sourceRoot = projectRef.sourceRoot.replace(/\\/g, "/").replace(/\/+$/u, "");
  return Object.entries(files)
    .filter(([filePath]) => filePath.toLocaleLowerCase().endsWith(".lcpp")
      && filePath.startsWith(`${sourceRoot}/`)
      && !isProjectBuildArtifactRelativePath(filePath.slice(sourceRoot.length + 1)))
    .map(([filePath, sourceCode]) => ({ filePath, sourceCode }));
}

async function resolveLingCppProjectSources(
  projectId: string,
  explicitSources?: LingCppProjectSourceFile[]
): Promise<LingCppProjectSourceFile[]> {
  const solutionService = getSolutionService();
  const solution = await solutionService.getSolution();
  const projectRef = solutionService.getProject(solution, projectId);
  const sourceRoot = projectRef.sourceRoot.replace(/\\/g, "/").replace(/\/+$/u, "");
  const nestedWorkspacePlan = await detectNestedWorkspaceArtifacts(path.resolve(getRepoWorkspaceRoot(), sourceRoot));
  if (Array.isArray(explicitSources) && explicitSources.length > 0) {
    let totalSize = 0;
    const unique = new Map<string, LingCppProjectSourceFile>();
    for (const source of explicitSources) {
      if (!source || typeof source.filePath !== "string" || typeof source.sourceCode !== "string") {
        throw new Error("项目源码集合包含无效条目。");
      }
      const filePath = source.filePath.replace(/\\/g, "/").replace(/^\.\//u, "");
      if (!filePath.toLocaleLowerCase().endsWith(".lcpp") || filePath.split("/").includes("..") || path.isAbsolute(filePath)) {
        throw new Error(`项目源码路径不安全：${source.filePath}`);
      }
      if (filePath !== sourceRoot && !filePath.startsWith(`${sourceRoot}/`)) {
        throw new Error(`项目源码路径不属于当前项目源码目录：${source.filePath}`);
      }
      const sourceRelativePath = filePath === sourceRoot ? '' : filePath.slice(sourceRoot.length + 1);
      if (isProjectBuildArtifactRelativePath(sourceRelativePath)) continue;
      if (isNestedWorkspaceArtifactRelativePath(sourceRelativePath, nestedWorkspacePlan)) continue;
      totalSize += Buffer.byteLength(source.sourceCode, "utf8");
      if (totalSize > 8 * 1024 * 1024) throw new Error("项目 LCPP 源码集合超过 8 MB 限制。");
      unique.set(filePath.toLocaleLowerCase(), { filePath, sourceCode: source.sourceCode });
    }
    return [...unique.values()];
  }
  const files = await solutionService.readProjectFiles(projectRef);
  return Object.entries(files)
    .filter(([filePath]) => filePath.toLocaleLowerCase().endsWith(".lcpp")
      && (filePath === sourceRoot || filePath.startsWith(`${sourceRoot}/`))
      && !isProjectBuildArtifactRelativePath(filePath === sourceRoot ? '' : filePath.slice(sourceRoot.length + 1)))
    .map(([filePath, sourceCode]) => ({ filePath, sourceCode }));
}

function assertNoBlockingLingCppDiagnostics(diagnostics: string[]): void {
  if (diagnostics.length === 0) return;
  throw new Error(`LCPP 项目源码存在阻止构建的错误：\n${diagnostics.join("\n")}`);
}

type CompilerInfo = {
  kind: "msvc" | "g++" | "clang++";
  command: string;
  setupBatch?: string;
};


app.get("/api/window-designer/recovery", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try { res.json({ ok: true, recovery: await hotExitRecoveryService.read(projectId) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.post("/api/window-designer/recovery", async (req, res) => {
  try {
    const projectId = String(req.body?.projectId || "");
    if (!projectId || typeof req.body?.files !== "object") return res.status(400).json({ ok: false, error: "缺少项目恢复数据" });
    await hotExitRecoveryService.write({ ...req.body, schemaVersion: 1, projectId, savedAt: new Date().toISOString() });
    res.json({ ok: true });
  } catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.delete("/api/window-designer/recovery", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try { await hotExitRecoveryService.delete(projectId); res.json({ ok: true }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error.message }); }
});

app.get("/api/window-designer/files/watch", async (req, res) => {
  const projectId = String(req.query.projectId || "");
  if (!projectId) return res.status(400).json({ ok: false, error: "缺少 projectId" });
  try {
    const solutionService = getSolutionService();
    const projectRef = solutionService.getProject(await solutionService.getSolution(), projectId);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    const watchers = [projectRef.sourceRoot, projectRef.configRoot].map(relativeRoot => {
      const absoluteRoot = path.join(getRepoWorkspaceRoot(), relativeRoot);
      return watchFiles(absoluteRoot, { recursive: true }, (_eventType, fileName) => {
        if (!fileName) return;
        const relativePath = path.posix.join(relativeRoot.replace(/\\/g, "/"), String(fileName).replace(/\\/g, "/"));
        if (!isAllowedProjectTextPath(relativePath) || relativePath.includes(".lingbuilder-")) return;
        res.write(`event: file-change\ndata: ${JSON.stringify({ path: relativePath })}\n\n`);
      });
    });
    if (projectRef.type === "visual-cpp") {
      const designerRelativePath = projectRef.designerPath.replace(/\\/g, "/");
      const designerDirectory = path.dirname(path.join(getRepoWorkspaceRoot(), projectRef.designerPath));
      const designerFileName = path.basename(projectRef.designerPath);
      const designerWatcher = watchFiles(designerDirectory, { recursive: false }, (_eventType, fileName) => {
        if (!fileName || path.basename(String(fileName)) !== designerFileName) return;
        res.write(`event: file-change\ndata: ${JSON.stringify({ path: designerRelativePath })}\n\n`);
      });
      watchers.push(designerWatcher);
    }
    const heartbeat = setInterval(() => res.write(": heartbeat\n\n"), 20_000);
    req.on("close", () => { clearInterval(heartbeat); watchers.forEach(watcher => watcher.close()); });
  } catch (error: any) {
    if (!res.headersSent) res.status(400).json({ ok: false, error: error.message });
    else res.end();
  }
});

app.get("/api/window-designer/files", async (req, res) => {
  const { projectId } = req.query as { projectId?: string };
  if (!projectId) {
    return res.status(400).json({ ok: false, error: "缺少 projectId" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const projectRef = solutionService.getProject(solution, projectId);
    // 读取问题（非 UTF-8 编码、被占用等）随响应下发：单个坏文件只跳过并报告，不再整体 400。
    const readProblems: ProjectFileReadProblem[] = [];
    const snapshots = await solutionService.readProjectFileSnapshots(projectRef, readProblems);
    const files = Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [filePath, snapshot.content])
    );
    const fileFormats = Object.fromEntries(
      Object.entries(snapshots).map(([filePath, snapshot]) => [filePath, snapshot.format])
    );
    const fileVersions = await readProjectFileVersionsFromDisk(
      getRepoWorkspaceRoot(),
      Object.keys(snapshots)
    );
    const isWindowDesignerProject = projectRef.type === "visual-cpp";
    // 原样下发磁盘设计器模型（含零窗口）：无窗口 DLL 项目的磁盘事实就是没有窗口，
    // 不得替换成合成默认窗口——那会让 IDE 把无窗口项目呈现成有一个窗口。
    const designerProject = isWindowDesignerProject
      ? await solutionService.readDesignerProjectRaw(projectRef)
      : undefined;
    const designerRelativePath = isWindowDesignerProject
      ? projectRef.designerPath.replace(/\\/g, "/")
      : undefined;
    if (designerRelativePath) {
      try {
        const designerBytes = await fs.readFile(path.join(getRepoWorkspaceRoot(), projectRef.designerPath));
        fileVersions[designerRelativePath] = createProjectFileVersion(designerBytes);
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    res.json({
      ok: true,
      files,
      fileFormats,
      fileVersions,
      ...(readProblems.length ? { problems: readProblems } : {}),
      ...(designerRelativePath ? { designerPath: designerRelativePath } : {}),
      ...(designerProject ? { designerProject } : {})
    });
  } catch (err: any) {
    const status = err instanceof TextFileFormatError ? 400 : 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

app.post("/api/window-designer/files", async (req, res) => {
  const { projectId, files, fileFormats, baseVersions, project } = req.body as {
    projectId?: string;
    files?: Record<string, string>;
    fileFormats?: Record<string, TextFileFormat>;
    baseVersions?: Record<string, string>;
    project?: LingWindowProject;
  };
  if (!projectId || !files) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 files" });
  }

  try {
    const repoRoot = getRepoWorkspaceRoot();
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const projectRef = solutionService.getProject(solution, projectId);
    const existingSnapshots = await solutionService.readProjectFileSnapshots(projectRef);
    const isWindowDesignerProject = projectRef.type === "visual-cpp";
    const designerPath = isWindowDesignerProject ? path.join(repoRoot, projectRef.designerPath) : undefined;
    if (designerPath) await fs.mkdir(path.dirname(designerPath), { recursive: true });

    const pendingWrites: Array<{ relativePath: string; targetPath: string; bytes: Buffer; expectedVersion?: string }> = [];
    for (const [relativePath, content] of Object.entries(files)) {
      const normalizedPath = relativePath.replace(/\\/g, "/");
      if (!isAllowedProjectTextPath(normalizedPath)) {
        throw new ProjectFileSaveValidationError(`不支持保存该项目文件类型：${relativePath}`);
      }
      if (normalizedPath.split("/").includes("..")) {
        throw new ProjectFileSaveValidationError(`项目文件路径不能越过工作区：${relativePath}`);
      }
      if (
        !normalizedPath.startsWith(`${projectRef.sourceRoot}/`)
        && !normalizedPath.startsWith(`${projectRef.configRoot}/`)
        && !(projectRef.isDefault && (normalizedPath.startsWith("src/") || normalizedPath.startsWith("config/")))
      ) {
        throw new ProjectFileSaveValidationError(`项目文件不在当前项目源码或配置目录内：${relativePath}`);
      }
      const targetPath = await workspacePathPolicy.resolveForWrite(normalizedPath);
      const format = fileFormats?.[relativePath]
        || fileFormats?.[normalizedPath]
        || existingSnapshots[normalizedPath]?.format
        || { encoding: "utf8", eol: "lf" };
      pendingWrites.push({
        relativePath: normalizedPath,
        targetPath,
        bytes: encodeTextFile(content, format),
        expectedVersion: baseVersions?.[relativePath] ?? baseVersions?.[normalizedPath]
      });
    }

    const designerRelativePath = isWindowDesignerProject
      ? projectRef.designerPath.replace(/\\/g, "/")
      : undefined;
    if (project && designerPath && designerRelativePath) pendingWrites.push({
      relativePath: designerRelativePath,
      targetPath: designerPath,
      bytes: Buffer.from(JSON.stringify(project, null, 2), "utf8"),
      expectedVersion: baseVersions?.[designerRelativePath]
    });
    await projectFilePersistenceService.writeAll(pendingWrites);

    const savedSnapshots = await solutionService.readProjectFileSnapshots(projectRef);
    const savedFileFormats = Object.fromEntries(
      Object.entries(savedSnapshots).map(([filePath, snapshot]) => [filePath, snapshot.format])
    );
    const fileVersions = await readProjectFileVersionsFromDisk(
      getRepoWorkspaceRoot(),
      Object.keys(savedSnapshots)
    );
    if (designerRelativePath && designerPath) {
      try {
        fileVersions[designerRelativePath] = createProjectFileVersion(await fs.readFile(designerPath));
      } catch (error: any) {
        if (error?.code !== "ENOENT") throw error;
      }
    }
    res.json({
      ok: true,
      fileFormats: savedFileFormats,
      fileVersions,
      ...(designerRelativePath ? { designerPath: designerRelativePath } : {})
    });
  } catch (err: any) {
    if (err instanceof ProjectFileConflictError) {
      const solutionService = getSolutionService();
      const solution = await solutionService.getSolution();
      const projectRef = solutionService.getProject(solution, projectId);
      const snapshots = await solutionService.readProjectFileSnapshots(projectRef);
      const isWindowDesignerProject = projectRef.type === "visual-cpp";
      const designerRelativePath = isWindowDesignerProject
        ? projectRef.designerPath.replace(/\\/g, "/")
        : undefined;
      // 原样下发磁盘设计器模型（含零窗口）：同项目文件读取 API 的无窗口口径。
      const designerProject = isWindowDesignerProject
        ? await solutionService.readDesignerProjectRaw(projectRef)
        : undefined;
      const conflictFileVersions = await readProjectFileVersionsFromDisk(
        getRepoWorkspaceRoot(),
        Object.keys(snapshots)
      );
      if (designerRelativePath) {
        try {
          conflictFileVersions[designerRelativePath] = createProjectFileVersion(
            await fs.readFile(path.join(getRepoWorkspaceRoot(), projectRef.designerPath))
          );
        } catch (error: any) {
          if (error?.code !== "ENOENT") throw error;
        }
      }
      return res.status(409).json({
        ok: false,
        code: "PROJECT_FILE_CONFLICT",
        error: err.message,
        files: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.content])),
        fileFormats: Object.fromEntries(Object.entries(snapshots).map(([key, value]) => [key, value.format])),
        fileVersions: conflictFileVersions,
        ...(designerRelativePath ? { designerPath: designerRelativePath } : {}),
        ...(designerProject ? { designerProject } : {})
      });
    }
    const status = err instanceof TextFileFormatError
      || err instanceof ProjectFileSaveValidationError
      || err instanceof WorkspacePathPolicyError
      ? 400
      : 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

// 把按旧代码页（GBK/GB18030，中文 Windows 记事本/VS 的默认 ANSI）保存的项目文本文件
// 转存为 UTF-8。与保存路由同一套路径白名单与工作区写入校验；已是合法 UTF-8/UTF-16
// 的文件拒绝转换（防止误转二次损坏），解码失败不动磁盘。
app.post("/api/window-designer/files/convert-encoding", async (req, res) => {
  const { projectId, filePath, sourceEncoding } = req.body as {
    projectId?: string;
    filePath?: string;
    sourceEncoding?: string;
  };
  if (!projectId || !filePath) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 filePath" });
  }
  const encoding = sourceEncoding === "gb18030" ? "gb18030" : "gbk";

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const projectRef = solutionService.getProject(solution, projectId);
    const normalizedPath = filePath.replace(/\\/g, "/");
    if (!isAllowedProjectTextPath(normalizedPath)) {
      throw new ProjectFileSaveValidationError(`不支持转换该项目文件类型：${filePath}`);
    }
    if (normalizedPath.split("/").includes("..")) {
      throw new ProjectFileSaveValidationError(`项目文件路径不能越过工作区：${filePath}`);
    }
    if (
      !normalizedPath.startsWith(`${projectRef.sourceRoot}/`)
      && !normalizedPath.startsWith(`${projectRef.configRoot}/`)
      && !(projectRef.isDefault && (normalizedPath.startsWith("src/") || normalizedPath.startsWith("config/")))
    ) {
      throw new ProjectFileSaveValidationError(`项目文件不在当前项目源码或配置目录内：${filePath}`);
    }
    const targetPath = await workspacePathPolicy.resolveForWrite(normalizedPath);
    const bytes = await fs.readFile(targetPath);
    const conversion = convertProjectFileBytesToUtf8(bytes, encoding);
    if (!conversion.ok || !conversion.bytes) {
      return res.status(400).json({ ok: false, error: `文件 ${normalizedPath} ${conversion.message || "无法转存为 UTF-8。"}` });
    }
    await projectFilePersistenceService.writeAll([{ targetPath, bytes: conversion.bytes }]);
    res.json({ ok: true, message: `已把 ${normalizedPath} 按 ${encoding.toUpperCase()} 读取并转存为 UTF-8。` });
  } catch (err: any) {
    const status = err instanceof TextFileFormatError
      || err instanceof ProjectFileSaveValidationError
      || err instanceof WorkspacePathPolicyError
      ? 400
      : 500;
    res.status(status).json({ ok: false, error: err?.message || "编码转存失败。" });
  }
});

app.post("/api/window-designer/files/rename", async (req, res) => {
  const { projectId, sourcePath, targetPath } = req.body as {
    projectId?: string;
    sourcePath?: string;
    targetPath?: string;
  };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(sourcePath) || !isNonEmptyString(targetPath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId、sourcePath 或 targetPath。" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const project = solutionService.getProject(solution, projectId.trim());
    const result = await projectFileMutationService.renameFile({ project, sourcePath, targetPath });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    respondWithProjectFileMutationError(res, error, "文件重命名失败");
  }
});

app.post("/api/window-designer/files/delete", async (req, res) => {
  const { projectId, filePath } = req.body as { projectId?: string; filePath?: string };
  if (!isNonEmptyString(projectId) || !isNonEmptyString(filePath)) {
    return res.status(400).json({ ok: false, error: "缺少 projectId 或 filePath。" });
  }

  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const project = solutionService.getProject(solution, projectId.trim());
    const result = await projectFileMutationService.deleteFile({ project, filePath });
    res.json({ ok: true, ...result });
  } catch (error: any) {
    respondWithProjectFileMutationError(res, error, "文件删除失败");
  }
});

app.post("/api/window-designer/function-libraries/create", async (req, res) => {
  const { projectId, name } = req.body as { projectId?: string; name?: string };
  if (!isNonEmptyString(projectId) || !isValidLingCppIdentifier(name)) {
    return res.status(400).json({ ok: false, error: "缺少有效的 projectId 或功能库名称。" });
  }
  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const project = solutionService.getProject(solution, projectId.trim());
    const targetPath = `${project.sourceRoot.replace(/\\/g, "/").replace(/\/+$/u, "")}/功能/${name!.trim()}.lcpp`;
    const absolutePath = await workspacePathPolicy.resolveForWrite(targetPath);
    try {
      await fs.lstat(absolutePath);
      return res.status(409).json({ ok: false, code: "TARGET_EXISTS", error: `功能库文件已存在：${targetPath}` });
    } catch (error: any) {
      if (error?.code !== "ENOENT") throw error;
    }
    await projectFilePersistenceService.writeAll([{ targetPath: absolutePath, bytes: Buffer.from(createFunctionLibraryTemplate(name!.trim()), "utf8") }]);
    res.json({ ok: true, filePath: targetPath, sourceCode: createFunctionLibraryTemplate(name!.trim()) });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "新建功能库失败。" });
  }
});

app.post("/api/window-designer/function-libraries/copy", async (req, res) => {
  const { sourceProjectId, targetProjectId, sourcePath, targetName, approved } = req.body as {
    sourceProjectId?: string;
    targetProjectId?: string;
    sourcePath?: string;
    targetName?: string;
    approved?: boolean;
  };
  if (!isNonEmptyString(sourceProjectId) || !isNonEmptyString(targetProjectId) || !isNonEmptyString(sourcePath)) {
    return res.status(400).json({ ok: false, error: "复制功能库缺少源项目、目标项目或源文件。" });
  }
  try {
    const solutionService = getSolutionService();
    const solution = await solutionService.getSolution();
    const sourceProject = solutionService.getProject(solution, sourceProjectId.trim());
    const targetProject = solutionService.getProject(solution, targetProjectId.trim());
    const [sourceSnapshots, targetSnapshots, enabledModules] = await Promise.all([
      solutionService.readProjectFileSnapshots(sourceProject),
      solutionService.readProjectFileSnapshots(targetProject),
      getModuleService().getEnabledProjectModules(sourceProjectId.trim())
    ]);
    const normalizedSourcePath = sourcePath.replace(/\\/g, "/");
    const sourceSnapshot = sourceSnapshots[normalizedSourcePath];
    if (!sourceSnapshot) return res.status(404).json({ ok: false, error: `找不到源功能库文件：${normalizedSourcePath}` });
    const parsed = parseLingCpp(sourceSnapshot.content);
    if (parsed.program.functionLibraries.length !== 1) {
      return res.status(400).json({ ok: false, error: "源文件必须且只能包含一个功能库。" });
    }
    const sourceLibrary = parsed.program.functionLibraries[0]!;
    const nextName = isNonEmptyString(targetName) ? targetName.trim() : sourceLibrary.name;
    if (!isValidLingCppIdentifier(nextName)) return res.status(400).json({ ok: false, error: "目标功能库名称无效。" });
    const sourceFiles = Object.entries(sourceSnapshots).filter(([filePath]) => filePath.toLocaleLowerCase().endsWith(".lcpp")).map(([filePath, snapshot]) => ({ filePath, sourceCode: snapshot.content, language: "lingcpp" as const }));
    const targetFiles = Object.entries(targetSnapshots).filter(([filePath]) => filePath.toLocaleLowerCase().endsWith(".lcpp")).map(([filePath, snapshot]) => ({ filePath, sourceCode: snapshot.content, language: "lingcpp" as const }));
    const moduleContext = { availableModules: enabledModules, enabledModules };
    const closure = analyzeFunctionLibraryDependencyClosure(normalizedSourcePath, sourceFiles, moduleContext);
    const targetRoot = targetProject.sourceRoot.replace(/\\/g, "/").replace(/\/+$/u, "");
    const targetLibraries = new Map<string, { name: string; filePath: string; sourceCode: string }>();
    targetFiles.forEach(file => {
      const library = parseLingCpp(file.sourceCode).program.functionLibraries[0];
      if (library) targetLibraries.set(normalizeIdentifier(library.name), { name: library.name, filePath: file.filePath, sourceCode: file.sourceCode });
    });
    const usedNames = new Set([...targetLibraries.keys()]);
    const reservedRootName = normalizeIdentifier(nextName);
    if (!usedNames.has(reservedRootName)) usedNames.add(reservedRootName);
    const libraryNames = new Map<string, string>();
    const libraryActions: Array<{ sourceName: string; targetName: string; action: "copy" | "reuse"; sourcePath: string; targetPath: string }> = [];
    const portableSource = (value: string) => value.replace(/\r\n?/gu, "\n").split("\n").map(line => line.replace(/\s+$/u, "")).join("\n").trim();
    const uniqueLibraryName = (baseName: string) => {
      let candidate = `${baseName}副本`;
      let index = 2;
      while (usedNames.has(normalizeIdentifier(candidate))) candidate = `${baseName}副本${index++}`;
      return candidate;
    };
    let targetExists = false;
    for (const file of closure.files) {
      const isRoot = normalizeIdentifier(file.name) === normalizeIdentifier(closure.rootLibrary);
      let desiredName = isRoot ? nextName : file.name;
      const existing = targetLibraries.get(normalizeIdentifier(desiredName));
      if (existing && isRoot) targetExists = true;
      if (existing && !isRoot && portableSource(existing.sourceCode) === portableSource(file.sourceCode)) {
        libraryNames.set(normalizeIdentifier(file.name), existing.name);
        libraryActions.push({ sourceName: file.name, targetName: existing.name, action: "reuse", sourcePath: file.filePath, targetPath: existing.filePath });
        continue;
      }
      if (existing && !isRoot) desiredName = uniqueLibraryName(file.name);
      else if (!isRoot && usedNames.has(normalizeIdentifier(desiredName))) desiredName = uniqueLibraryName(file.name);
      libraryNames.set(normalizeIdentifier(file.name), desiredName);
      usedNames.add(normalizeIdentifier(desiredName));
      libraryActions.push({ sourceName: file.name, targetName: desiredName, action: "copy", sourcePath: file.filePath, targetPath: `${targetRoot}/功能/${desiredName}.lcpp` });
    }
    let rewrittenLibraries: LingCppWorkspaceFile[] = closure.files.map(file => ({ filePath: file.filePath, sourceCode: file.sourceCode, language: "lingcpp" }));
    libraryNames.forEach((mappedName, sourceKey) => {
      const sourceName = closure.files.find(file => normalizeIdentifier(file.name) === sourceKey)?.name;
      if (sourceName && normalizeIdentifier(sourceName) !== normalizeIdentifier(mappedName)) {
        rewrittenLibraries = renameFunctionLibraryAcrossSources(rewrittenLibraries, sourceName, mappedName);
      }
    });
    const rewrittenByPath = new Map(rewrittenLibraries.map(file => [file.filePath.replace(/\\/g, "/").toLocaleLowerCase(), file.sourceCode]));
    const resources = mergeFunctionLibraryProjectResources(closure, sourceFiles, targetFiles);
    const modulePlan = await getModuleService().planEnableModulesForProject(targetProjectId.trim(), closure.modules);
    const rootAction = libraryActions.find(item => normalizeIdentifier(item.sourceName) === normalizeIdentifier(closure.rootLibrary))!;
    const missing = { libraries: closure.missingLibraries, projectTypes: [], projectSymbols: [], modules: [] };
    const preview = {
      sourceLibrary: sourceLibrary.name,
      targetName: nextName,
      sourcePath: normalizedSourcePath,
      targetPath: rootAction.targetPath,
      targetExists,
      dependencies: {
        libraries: closure.files.filter(file => normalizeIdentifier(file.name) !== normalizeIdentifier(closure.rootLibrary)).map(file => file.name),
        projectTypes: closure.projectTypes,
        projectSymbols: closure.projectSymbols,
        modules: closure.modules
      },
      libraries: libraryActions,
      resources: {
        projectTypes: resources.projectTypes,
        projectSymbols: resources.projectSymbols,
        modules: { enabled: modulePlan.addedModuleIds, reused: modulePlan.reusedModuleIds }
      },
      conflicts: resources.conflicts,
      missing
    };
    if (!approved) return res.json({ ok: true, preview });
    if (targetExists) return res.status(409).json({ ok: false, code: "TARGET_EXISTS", error: `目标功能库已存在：${rootAction.targetPath}`, preview });
    if (closure.missingLibraries.length > 0) return res.status(409).json({ ok: false, code: "DEPENDENCY_MISSING", error: `源项目缺少依赖功能库：${closure.missingLibraries.join("、")}`, preview });
    if (resources.conflicts.length > 0) return res.status(409).json({ ok: false, code: "RESOURCE_CONFLICT", error: `目标项目存在依赖冲突：${resources.conflicts.map(item => item.name).join("、")}`, preview });

    const writes: Array<{ targetPath: string; bytes: Buffer; expectedVersion?: string }> = [];
    const updatedProjectFiles: Array<{ filePath: string; sourceCode: string }> = [];
    for (const action of libraryActions.filter(item => item.action === "copy")) {
      const absolutePath = await workspacePathPolicy.resolveForWrite(action.targetPath);
      const currentVersion = await projectFilePersistenceService.readVersion(absolutePath);
      if (currentVersion) return res.status(409).json({ ok: false, code: "TARGET_EXISTS", error: `目标功能库已存在：${action.targetPath}`, preview });
      writes.push({ targetPath: absolutePath, bytes: Buffer.from(rewrittenByPath.get(action.sourcePath.replace(/\\/g, "/").toLocaleLowerCase()) || "", "utf8") });
    }
    const appendProjectResourceWrite = async (relativePath: string, content: string | undefined) => {
      if (content === undefined) return;
      const absolutePath = await workspacePathPolicy.resolveForWrite(relativePath);
      const snapshot = targetSnapshots[relativePath];
      writes.push({
        targetPath: absolutePath,
        bytes: encodeTextFile(content, snapshot?.format || { encoding: "utf8", eol: "lf" }),
        expectedVersion: (await projectFilePersistenceService.readVersion(absolutePath)) || undefined
      });
      updatedProjectFiles.push({ filePath: relativePath, sourceCode: content });
    };
    await appendProjectResourceWrite(`${targetRoot}/项目数据类型.lcpp`, resources.dataTypesSource);
    await appendProjectResourceWrite(`${targetRoot}/项目全局变量.lcpp`, resources.globalsSource);
    if (modulePlan.addedModuleIds.length > 0) {
      writes.push({
        targetPath: modulePlan.targetPath,
        bytes: Buffer.from(modulePlan.sourceCode, "utf8"),
        expectedVersion: (await projectFilePersistenceService.readVersion(modulePlan.targetPath)) || undefined
      });
    }
    await projectFilePersistenceService.writeAll(writes);
    if (modulePlan.addedModuleIds.length > 0) {
      try { await getModuleService().recordProjectModuleEnablePlan(modulePlan); } catch { /* 复制事务已完成，历史记录失败不回滚源码。 */ }
    }
    const copiedFiles = libraryActions.filter(item => item.action === "copy").map(action => ({
      filePath: action.targetPath,
      sourceCode: rewrittenByPath.get(action.sourcePath.replace(/\\/g, "/").toLocaleLowerCase()) || ""
    }));
    const rootFile = copiedFiles.find(file => file.filePath === rootAction.targetPath)!;
    res.json({ ok: true, preview, filePath: rootFile.filePath, sourceCode: rootFile.sourceCode, files: copiedFiles, updatedFiles: [...copiedFiles, ...updatedProjectFiles] });
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || "复制功能库失败。" });
  }
});

app.get("/api/source-control/status", async (_req, res) => {
  res.json(await gitService.status());
});
app.post("/api/source-control/init", async (req, res) => sourceControlAction(res, () => gitService.init(req.body?.defaultBranch)));
app.post("/api/source-control/stage", async (req, res) => sourceControlAction(res, () => gitService.stage(req.body?.paths)));
app.post("/api/source-control/stage-all", async (_req, res) => sourceControlAction(res, () => gitService.stageAll()));
app.post("/api/source-control/unstage", async (req, res) => sourceControlAction(res, () => gitService.unstage(req.body?.paths)));
app.post("/api/source-control/unstage-all", async (_req, res) => sourceControlAction(res, () => gitService.unstageAll()));
app.post("/api/source-control/discard", async (req, res) => sourceControlAction(res, () => gitService.discard(req.body?.paths)));
app.post("/api/source-control/commit", async (req, res) => sourceControlAction(res, () => gitService.commit(req.body?.message)));
app.get("/api/source-control/diff", async (req, res) => sourceControlAction(res, () => gitService.diff(String(req.query.path || ""), String(req.query.staged || "") === "true")));
app.get("/api/source-control/branches", async (_req, res) => sourceControlAction(res, () => gitService.branches()));
app.post("/api/source-control/branches", async (req, res) => sourceControlAction(res, () => gitService.createBranch(req.body?.name, req.body?.checkout !== false)));
app.post("/api/source-control/branches/checkout", async (req, res) => sourceControlAction(res, () => gitService.checkoutBranch(req.body?.name)));
app.delete("/api/source-control/branches/:name", async (req, res) => sourceControlAction(res, () => gitService.deleteBranch(req.params.name)));
app.get("/api/source-control/history", async (req, res) => sourceControlAction(res, () => gitService.history(Number(req.query.limit || 50), Number(req.query.skip || 0))));
app.get("/api/source-control/blame", async (req, res) => sourceControlAction(res, () => gitService.blame(String(req.query.path || ""), Number(req.query.startLine || 1), Number(req.query.endLine || req.query.startLine || 1))));
app.get("/api/source-control/remotes", async (_req, res) => sourceControlAction(res, () => gitService.remotes()));
app.post("/api/source-control/remotes", async (req, res) => sourceControlAction(res, () => gitService.addRemote(req.body?.name, req.body?.url)));
app.put("/api/source-control/remotes/:name", async (req, res) => sourceControlAction(res, () => gitService.setRemoteUrl(req.params.name, req.body?.url)));
app.delete("/api/source-control/remotes/:name", async (req, res) => sourceControlAction(res, () => gitService.removeRemote(req.params.name)));
app.post("/api/source-control/fetch", async (req, res) => sourceControlAction(res, () => gitService.fetch(req.body?.remote)));
app.post("/api/source-control/pull", async (req, res) => sourceControlAction(res, () => gitService.pull(req.body?.remote, req.body?.branch, req.body?.strategy)));
app.post("/api/source-control/push", async (req, res) => sourceControlAction(res, () => gitService.push(req.body?.remote, req.body?.branch, Boolean(req.body?.setUpstream))));
app.post("/api/source-control/merge", async (req, res) => sourceControlAction(res, () => gitService.merge(req.body?.branch)));
app.post("/api/source-control/rebase", async (req, res) => sourceControlAction(res, () => gitService.rebase(req.body?.branch)));
app.get("/api/source-control/conflicts", async (_req, res) => sourceControlAction(res, () => gitService.conflicts()));
app.get("/api/source-control/conflicts/file", async (req, res) => sourceControlAction(res, () => gitService.conflictDetail(String(req.query.path || ""))));
app.post("/api/source-control/conflicts/resolve", async (req, res) => sourceControlAction(res, () => gitService.resolveConflict(req.body?.path, req.body?.resolution, req.body?.content)));
app.post("/api/source-control/integration/abort", async (req, res) => sourceControlAction(res, () => gitService.abortIntegration(req.body?.kind)));
app.post("/api/source-control/integration/continue", async (req, res) => sourceControlAction(res, () => gitService.continueIntegration(req.body?.kind)));
app.post("/api/source-control/pull-requests", async (req, res) => sourceControlAction(res, () => gitService.createPullRequest(req.body || {})));
app.get("/api/source-control/stashes", async (_req, res) => sourceControlAction(res, () => gitService.stashList()));
app.post("/api/source-control/stashes", async (req, res) => sourceControlAction(res, () => gitService.stashSave(req.body?.message, Boolean(req.body?.includeUntracked))));
app.post("/api/source-control/stashes/apply", async (req, res) => sourceControlAction(res, () => gitService.stashApply(Number(req.body?.index ?? 0), Boolean(req.body?.pop))));
app.delete("/api/source-control/stashes/:index", async (req, res) => sourceControlAction(res, () => gitService.stashDrop(Number(req.params.index))));
app.get("/api/source-control/tags", async (_req, res) => sourceControlAction(res, () => gitService.tags()));
app.post("/api/source-control/tags", async (req, res) => sourceControlAction(res, () => gitService.createTag(req.body?.name, req.body?.message)));
app.delete("/api/source-control/tags/:name", async (req, res) => sourceControlAction(res, () => gitService.deleteTag(req.params.name)));

app.get("/api/tests/discover", async (_req, res) => {
  try { res.json({ ok: true, tests: await testExplorerService.discover() }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试发现失败。" }); }
});
app.post("/api/tests/run", async (req, res) => {
  const controller = new AbortController(); req.on("aborted", () => controller.abort());
  try { res.json({ ok: true, result: await testExplorerService.run(String(req.body?.testId || ""), controller.signal) }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试运行失败。" }); }
});
app.post("/api/tests/debug", async (req, res) => {
  try {
    const configuration = testExplorerService.debugConfiguration(String(req.body?.testId || ""));
    if (configuration.adapter === "node-inspector") { await nativeDebugService.stop(); res.json({ ok: true, adapter: configuration.adapter, session: await nodeTestDebugService.start({ testId: configuration.test.id, program: configuration.program, args: configuration.args, cwd: configuration.cwd }) }); }
    else { await nodeTestDebugService.stop(); await nativeDebugService.stop(); const program = path.isAbsolute(configuration.program) ? configuration.program : path.resolve(configuration.cwd, configuration.program); res.json({ ok: true, adapter: configuration.adapter, session: await nativeDebugService.start({ program, cwd: configuration.cwd, args: configuration.args, stopAtEntry: true }) }); }
  } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "测试调试启动失败。" }); }
});
app.get("/api/tests/debug/node", (_req, res) => res.json({ ok: true, session: nodeTestDebugService.getSnapshot() }));
app.post("/api/tests/debug/node/continue", async (_req, res) => { try { res.json({ ok: true, session: await nodeTestDebugService.continue() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "继续 Node 测试失败。" }); } });
app.post("/api/tests/debug/stop", async (_req, res) => { await Promise.all([nodeTestDebugService.stop(), nativeDebugService.stop()]); res.json({ ok: true }); });
app.post("/api/quality/import", async (req, res) => { try { res.json({ ok: true, report: await qualityService.importReports(req.body || {}) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "质量报告导入失败。" }); } });
app.post("/api/quality/node-coverage", async (req, res) => { try { res.json({ ok: true, report: await qualityService.runNodeCoverage(String(req.body?.filePath || ""), req.body?.testName) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "Node 覆盖率运行失败。" }); } });
app.post("/api/performance/collect", async (req, res) => { try { res.json({ ok: true, report: await performanceService.collect(req.body || {}) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "性能采集失败。" }); } });
app.post("/api/performance/cancel", (_req, res) => res.json({ ok: true, cancelled: performanceService.cancel() }));
app.post("/api/performance/import", async (req, res) => { try { res.json({ ok: true, report: await performanceService.importCpuProfile(String(req.body?.filePath || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "性能报告导入失败。" }); } });
app.get("/api/publishing/configuration", async (_req, res) => { try { const configuration = await publishingService.readOptionalConfiguration(); res.json({ ok: true, configured: Boolean(configuration), configuration: configuration || null }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "发布配置读取失败。" }); } });
app.post("/api/publishing/run", async (req, res) => { try { res.json({ ok: true, result: await publishingService.publish(req.body?.configuration || await publishingService.readConfiguration()) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "发布失败。" }); } });
app.post("/api/publishing/verify-signature", async (req, res) => { try { res.json({ ok: true, valid: await publishingService.verifySignature(String(req.body?.filePath || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "签名验证失败。" }); } });
app.post("/api/ai-index/rebuild", async (req, res) => { const controller = new AbortController(); req.on("aborted", () => controller.abort()); try { const snapshot = await workspaceIndexService.rebuild(controller.signal); res.json({ ok: true, fileCount: snapshot.files.length, generatedAt: snapshot.generatedAt }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "工作区索引构建失败。" }); } });
app.post("/api/ai-index/cancel", (_req, res) => res.json({ ok: true, cancelled: workspaceIndexService.cancel() }));
app.get("/api/ai-index/search", async (req, res) => { try { res.json({ ok: true, hits: await workspaceIndexService.search(String(req.query.query || ""), Number(req.query.limit || 20)) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "工作区索引查询失败。" }); } });
app.post("/api/settings-sync/export", async (req, res) => { try { res.json({ ok: true, result: await settingsSyncService.exportBundle(String(req.body?.filePath || '.lingbuilder/settings-sync.json')) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "设置同步包导出失败。" }); } });
app.post("/api/settings-sync/preview", async (req, res) => { try { res.json({ ok: true, preview: await settingsSyncService.preview(String(req.body?.filePath || '')) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "设置同步包预览失败。" }); } });
app.post("/api/settings-sync/import", async (req, res) => { try { res.json({ ok: true, result: await settingsSyncService.importBundle(String(req.body?.filePath || ''), String(req.body?.token || '')) }); } catch (error: any) { res.status(409).json({ ok: false, error: error?.message || "设置同步包导入失败。" }); } });
app.get("/api/extensions", async (_req, res) => { try { res.json({ ok: true, host: await extensionService.start() }); } catch (error: any) { res.status(500).json({ ok: false, error: error?.message || "Extension Host 启动失败。", host: extensionService.getSnapshot() }); } });
app.post("/api/extensions/refresh", async (_req, res) => { try { res.json({ ok: true, host: await extensionService.refresh() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展刷新失败。" }); } });
app.put("/api/extensions/:extensionId/enabled", async (req, res) => { try { res.json({ ok: true, host: await extensionService.setEnabled(req.params.extensionId, Boolean(req.body?.enabled)) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展状态更新失败。" }); } });
app.post("/api/extensions/commands/:command", async (req, res) => { try { res.json({ ok: true, result: await extensionService.executeCommand(req.params.command, req.body?.args || []), host: extensionService.getSnapshot() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展命令执行失败。" }); } });
app.post("/api/extensions/languages/:languageId/activate", async (req, res) => { try { await extensionService.activateLanguage(req.params.languageId); res.json({ ok: true, host: extensionService.getSnapshot() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "语言扩展激活失败。" }); } });
app.get("/api/extensions/:extensionId/themes/:themeId", async (req, res) => { try { res.json({ ok: true, theme: await extensionService.loadTheme(req.params.extensionId, req.params.themeId) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "扩展主题读取失败。" }); } });
app.get("/api/dependencies", async (_req, res) => { try { res.json({ ok: true, snapshot: await dependencyService.inspect() }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "依赖清单读取失败。" }); } });
app.post("/api/dependencies/restore", async (req, res) => { try { res.json({ ok: true, result: await dependencyService.restore({ manifestPath: req.body?.manifestPath, offline: Boolean(req.body?.offline), triplet: req.body?.triplet }) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "依赖恢复失败。" }); } });
app.get("/api/resources/rc", async (req, res) => { try { res.json({ ok: true, document: await rcResourceService.read(String(req.query.path || "")) }); } catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "RC 资源读取失败。" }); } });
app.put("/api/resources/rc", async (req, res) => { try { res.json({ ok: true, document: await rcResourceService.apply(req.body?.filePath, req.body?.token, req.body?.edits) }); } catch (error: any) { res.status(409).json({ ok: false, error: error?.message || "RC 资源保存失败。" }); } });

async function sourceControlAction(res: express.Response, action: () => Promise<unknown>) {
  try { res.json({ ok: true, result: await action() }); }
  catch (error: any) { res.status(400).json({ ok: false, error: error?.message || "Git 操作失败。" }); }
}

app.get("/api/window-designer/debug-logs", async (req, res) => {
  const projectId = req.query.projectId as string || "window-preview";
  const clear = req.query.clear === "true";
  let buildDir: string;
  try {
    buildDir = (await resolveServerProjectBuildPaths(projectId, await buildConfigurationService.read())).buildDir;
  } catch {
    // 配置损坏时退回内置缺省目录读日志，不能让日志接口整体 500。
    buildDir = resolveProjectBuildDirectories({
      workspaceRoot: getRepoWorkspaceRoot(),
      projectDirName: sanitizeFilename(projectId),
      platform: "Win32",
      configuration: "Debug"
    }).buildDir;
  }
  const logFile = path.join(buildDir, "run.log");

  if (clear) {
    try {
      await fs.writeFile(logFile, "", "utf8");
    } catch {}
    return res.json({ logs: [] });
  }

  try {
    const data = await fs.readFile(logFile, "utf8");
    res.json({ logs: data.split("\n") });
  } catch {
    res.json({ logs: [] });
  }
});

async function detectCompiler(configuration?: BuildConfiguration): Promise<CompilerInfo | null> {
  if (configuration?.architecture === "x64") {
    const x64Setup = await findMsvcSetupBatch("x64");
    if (x64Setup && await canUseMsvcSetupBatch(x64Setup)) return { kind: "msvc", command: "cl", setupBatch: x64Setup };
  }
  try {
    await execFileAsync("where.exe", ["cl"], { timeout: 4000, windowsHide: true });
    return { kind: "msvc", command: "cl" };
  } catch {
    // MSVC is often installed but not loaded into the current shell.
  }

  const msvcSetupBatch = await findMsvcSetupBatch(configuration?.architecture === "x64" ? "x64" : "Win32");
  if (msvcSetupBatch && await canUseMsvcSetupBatch(msvcSetupBatch)) {
    return { kind: "msvc", command: "cl", setupBatch: msvcSetupBatch };
  }

  const candidates: CompilerInfo[] = [
    { kind: "g++", command: "g++" },
    { kind: "clang++", command: "clang++" }
  ];

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, ["--version"], { timeout: 4000, windowsHide: true });
      return candidate;
    } catch {
      // Try next compiler.
    }
  }

  return null;
}

async function findMsvcSetupBatch(architecture: "Win32" | "x64" = "Win32"): Promise<string | null> {
  const installPaths = new Set<string>();
  const vswherePath = process.env["ProgramFiles(x86)"]
    ? path.join(process.env["ProgramFiles(x86)"] as string, "Microsoft Visual Studio", "Installer", "vswhere.exe")
    : "";

  if (vswherePath && await pathExists(vswherePath)) {
    try {
      const result = await execFileAsync(vswherePath, ["-latest", "-products", "*", "-property", "installationPath"], {
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

  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const editions = ["BuildTools", "Community", "Professional", "Enterprise"];
  for (const edition of editions) {
    installPaths.add(path.join(programFiles, "Microsoft Visual Studio", "2022", edition));
    installPaths.add(path.join(programFiles, "Microsoft Visual Studio", "2019", edition));
  }

  for (const installPath of installPaths) {
    const candidates = [
      path.join(installPath, "VC", "Auxiliary", "Build", architecture === "x64" ? "vcvars64.bat" : "vcvars32.bat"),
      path.join(installPath, "Common7", "Tools", "VsDevCmd.bat")
    ];

    for (const candidate of candidates) {
      if (await pathExists(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

async function canUseMsvcSetupBatch(setupBatch: string): Promise<boolean> {
  try {
    await execFileAsync("cmd.exe", ["/d", "/c", `call ${quoteCmdArg(setupBatch)} >nul && where cl >nul`], {
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
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  modulePlan?: ModuleNativeDependencyPlan,
  buildConfiguration: BuildConfiguration = { schemaVersion: 1, mode: "Debug", architecture: "Win32" },
  resourcePath?: string,
  signal?: AbortSignal,
  outputType: "exe" | "dll" = "exe",
  requireAdministrator = false
): Promise<{ ok: boolean; logs: string[] }> {
  const buildDynamicLibrary = outputType === "dll";
  if (buildDynamicLibrary && compiler.kind !== "msvc") {
    return {
      ok: false,
      logs: [
        "编译失败。",
        "动态库输出模式当前仅支持 MSVC/Visual Studio Build Tools：需要链接生成 .dll 与导入库 .lib；请安装 Visual Studio Build Tools 后重试。"
      ]
    };
  }
  const includeArgs = (modulePlan?.includeDirs || []).flatMap(includeDir => ["/I", includeDir]);
  const moduleSources = modulePlan?.sourceFiles || [];
  const moduleLibs = modulePlan?.libFiles || [];
  const msvcLinkLibraries = createWindowsMsvcLinkLibraries(moduleLibs);
  if (compiler.kind !== "msvc" && modulePlan?.requiresMsvc) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        "new_emoji 模块需要 MSVC/Visual Studio Build Tools：当前检测到的编译器不能直接链接 .lib 导入库。"
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
    return { ok: false, logs: ["资源脚本编译失败。", error instanceof Error ? error.message : String(error)] };
  }

  const objectPath = path.join(objDir, "main.obj");
  const requiredCppStandard = modulePlan?.requiredCppStandard === 20 ? 20 : 17;
  // 动态库强制动态 CRT（与 Visual Studio 导出器的 DynamicLibrary 行为一致）：
  // 消费方工程链接导入库并传 std::wstring，跨 DLL 边界要求两侧共用同一 CRT。
  const useDynamicCrt = modulePlan?.requiresDynamicCrt === true || buildDynamicLibrary;
  const extraDefineArgs = (modulePlan?.extraCompileDefines || []).map(define => `/D${define}`);
  const msvcBuildFlags = getBuildCompilerFlags(buildConfiguration, "msvc")
    .filter(flag => !useDynamicCrt || (flag !== "/MD" && flag !== "/MDd" && flag !== "/D_DEBUG"));
  if (useDynamicCrt) {
    if (!msvcBuildFlags.includes("/DNDEBUG")) msvcBuildFlags.push("/DNDEBUG");
    msvcBuildFlags.push("/MD");
  }
  if (compiler.kind === "msvc" && moduleSources.length > 0) {
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, msvcLinkLibraries, buildConfiguration, requiredCppStandard, useDynamicCrt, extraDefineArgs, resourceOutputPath, resourceLogs, signal, buildDynamicLibrary, requireAdministrator);
  }

  const commandArgs = compiler.kind === "msvc"
    ? [
        "/nologo",
        "/EHsc",
        `/std:c++${requiredCppStandard}`,
        "/utf-8",
        ...extraDefineArgs,
        "/DUNICODE",
        "/D_UNICODE",
        ...msvcBuildFlags,
        ...(buildDynamicLibrary ? ["/LD"] : []),
        ...includeArgs,
        sourcePath,
        "/Fo:" + objectPath,
        "/Fe:" + exePath,
        ...msvcLinkLibraries,
        ...(resourceOutputPath ? [resourceOutputPath] : []),
        // /link 区段只允许开启一次：Debug/Release 分支均已开启，UAC 参数直接并入。
        // Release：按函数剔除无引用运行时并折叠等价 COMDAT（与 VS 导出工程
        // Release 的 OptimizeReferences/EnableCOMDATFolding 同口径）；不改动
        // manifest 行为（保持既有默认），Debug 链接参数不变。
        ...(buildConfiguration.mode === "Debug"
          ? ["/link", "/DEBUG", "/INCREMENTAL:NO", "/MANIFEST:EMBED"]
          : ["/link", "/OPT:REF", "/OPT:ICF"]),
        ...(requireAdministrator && compiler.kind === "msvc"
          ? ["/MANIFEST:EMBED", ...REQUIRE_ADMINISTRATOR_LINK_ARGS]
          : [])
      ]
    : [
        "-municode",
        `-std=c++${requiredCppStandard}`,
        "-finput-charset=UTF-8",
      "-fexec-charset=UTF-8",
      "-DUNICODE",
      "-D_UNICODE",
      ...getBuildCompilerFlags(buildConfiguration, compiler.kind),
      "-c",
      sourcePath,
      "-o",
      objectPath
    ];
  const linkArgs = compiler.kind === "msvc"
    ? []
    : [
      "-municode",
      buildConfiguration.architecture === "x64" ? "-m64" : "-m32",
      objectPath,
      ...(resourceOutputPath ? [resourceOutputPath] : []),
      "-o",
      exePath,
      "-luser32",
      "-lgdi32",
      "-lcomctl32",
      "-lole32"
    ];

  try {
    const command = compiler.kind === "msvc" && compiler.setupBatch ? "cmd.exe" : compiler.command;
    const args = compiler.kind === "msvc" && compiler.setupBatch
      ? ["/d", "/c", `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(" ")}`]
      : commandArgs;

    const compileResult = await execCompilerFileAsync(command, args, {
      cwd,
      timeout: 60000,
      windowsHide: true,
      windowsVerbatimArguments: command === "cmd.exe",
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
        ...resourceLogs,
        "编译成功。",
        formatSuccessCompileChannel("stdout", compileResult.stdout),
        formatSuccessCompileChannel("stderr", compileResult.stderr),
        formatSuccessCompileChannel("link stdout", linkResult?.stdout),
        formatSuccessCompileChannel("link stderr", linkResult?.stderr)
      ].filter(Boolean)
    };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : "",
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : "",
        error.message ? `错误：${error.message}` : ""
      ].filter(Boolean)
    };
  }
}

async function compileMsvcPreviewWithModules(
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  includeArgs: string[],
  moduleSources: string[],
  linkLibraries: string[],
  buildConfiguration: BuildConfiguration,
  requiredCppStandard: 17 | 20,
  useDynamicCrt: boolean,
  extraDefineArgs: string[],
  resourceOutputPath: string | undefined,
  resourceLogs: string[],
  signal?: AbortSignal,
  buildDynamicLibrary = false,
  requireAdministrator = false
): Promise<{ ok: boolean; logs: string[] }> {
  const sources = [sourcePath, ...moduleSources];
  const objectFiles = sources.map((source, index) => path.join(objDir, `${index === 0 ? "main" : `module_${index}`}.obj`));
  const msvcBuildFlags = getBuildCompilerFlags(buildConfiguration, "msvc")
    .filter(flag => !useDynamicCrt || (flag !== "/MD" && flag !== "/MDd" && flag !== "/D_DEBUG"));
  if (useDynamicCrt) {
    if (!msvcBuildFlags.includes("/DNDEBUG")) msvcBuildFlags.push("/DNDEBUG");
    msvcBuildFlags.push("/MD");
  }
  const compileCommands = sources.map((source, index) => [
    "/nologo",
    "/EHsc",
    `/std:c++${requiredCppStandard}`,
    "/utf-8",
    ...extraDefineArgs,
    "/DUNICODE",
    "/D_UNICODE",
    ...msvcBuildFlags,
    ...includeArgs,
    "/c",
    source,
    "/Fo:" + objectFiles[index]
  ]);
  const linkArgs = [
    "/nologo",
    ...(buildDynamicLibrary ? ["/DLL"] : []),
    ...objectFiles,
    "/Fe:" + exePath,
    ...linkLibraries,
    ...(resourceOutputPath ? [resourceOutputPath] : []),
    // Release 的 /OPT:REF /OPT:ICF 必须带 /link 前缀（cl 会以 D9002 静默忽略
    // /link 区段外的链接器选项）；Debug 链接参数保持现状不变。
    ...(buildConfiguration.mode === "Debug" ? ["/DEBUG", "/INCREMENTAL:NO"] : ["/link", "/OPT:REF", "/OPT:ICF"]),
    ...(requireAdministrator ? ["/MANIFEST:EMBED", ...REQUIRE_ADMINISTRATOR_LINK_ARGS] : [])
  ];

  try {
    const outputs: string[] = [];
    for (const args of compileCommands) {
      const result = await runMsvcCommand(compiler, args, cwd, signal);
      outputs.push(
        formatSuccessCompileChannel("stdout", result.stdout),
        formatSuccessCompileChannel("stderr", result.stderr)
      );
    }
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd, signal);
    outputs.push(
      formatSuccessCompileChannel("link stdout", linkResult.stdout),
      formatSuccessCompileChannel("link stderr", linkResult.stderr)
    );
    return { ok: true, logs: [...resourceLogs, "编译成功。", ...outputs.filter(Boolean)] };
  } catch (error: any) {
    return {
      ok: false,
      logs: [
        "编译失败。",
        error.stdout?.trim() ? `stdout:\n${error.stdout.trim()}` : "",
        error.stderr?.trim() ? `stderr:\n${error.stderr.trim()}` : "",
        error.message ? `错误：${error.message}` : ""
      ].filter(Boolean)
    };
  }
}

async function runMsvcCommand(compiler: CompilerInfo, commandArgs: string[], cwd: string, signal?: AbortSignal) {
  const command = compiler.setupBatch ? "cmd.exe" : compiler.command;
  const args = compiler.setupBatch
    ? ["/d", "/c", `call ${quoteCmdArg(compiler.setupBatch)} >nul && ${compiler.command} ${commandArgs.map(quoteCmdArg).join(" ")}`]
    : commandArgs;
  return await execCompilerFileAsync(command, args, {
    cwd,
    timeout: 60000,
    windowsHide: true,
    windowsVerbatimArguments: command === "cmd.exe",
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

function getGeneratedFileLanguage(relativePath: string): "cpp" | "json" | "text" {
  if (relativePath.endsWith(".cpp")) return "cpp";
  if (relativePath.endsWith(".json")) return "json";
  return "text";
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.stat(value);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFilename(value: string): string {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").slice(0, 80) || "window-preview";
}

function normalizeFilePath(value: string): string {
  return value.replace(/\\/g, "/").trim();
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidLingCppIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[\p{L}_][\p{L}\p{N}_]*$/u.test(value.trim());
}

function isWorkbenchConfigurationKey(value: unknown): value is WorkbenchConfigurationKey {
  return typeof value === "string"
    && (WORKBENCH_CONFIGURATION_KEYS as readonly string[]).includes(value);
}

function isConfigurationTarget(value: unknown): value is ConfigurationTarget {
  return value === "user" || value === "workspace";
}

function respondWithConfigurationError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string
): void {
  const message = error instanceof Error ? error.message : fallbackMessage;
  if (error instanceof ConfigurationValidationError) {
    res.status(400).json({ ok: false, code: "INVALID_VALUE", error: message, details: error.details });
    return;
  }
  if (error instanceof ConfigurationPersistenceError) {
    const status = error.code === "UNSAFE_PATH" ? 400 : 500;
    res.status(status).json({ ok: false, code: error.code, error: message });
    return;
  }
  res.status(500).json({ ok: false, error: message });
}

function respondWithProjectFileMutationError(
  res: express.Response,
  error: unknown,
  fallbackMessage: string
): void {
  if (!(error instanceof ProjectFileMutationError)) {
    const message = error instanceof Error ? error.message : fallbackMessage;
    if (/未找到项目/u.test(message)) {
      res.status(404).json({ ok: false, error: message });
      return;
    }
    res.status(500).json({
      ok: false,
      error: message
    });
    return;
  }

  const status = error.code === "FILE_NOT_FOUND" || error.code === "PROJECT_ROOT_NOT_FOUND"
    ? 404
    : error.code === "TARGET_EXISTS"
      ? 409
      : error.code === "OPERATION_FAILED"
        ? 500
        : 400;
  res.status(status).json({ ok: false, code: error.code, error: error.message });
}

async function handleWorkspaceSearchRequest<T>(
  res: express.Response,
  operation: () => Promise<T>
): Promise<void> {
  try {
    const result = await operation();
    res.json({ ok: true, ...result });
  } catch (error) {
    respondWithWorkspaceSearchError(res, error);
  }
}

function respondWithWorkspaceSearchError(res: express.Response, error: unknown): void {
  if (!(error instanceof WorkspaceSearchError)) {
    const detail = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      error: `工作区搜索服务发生未预期错误：${detail}`
    });
    return;
  }

  const conflictCodes = new Set([
    "QUERY_NOT_FOUND",
    "QUERY_EXPIRED",
    "PREVIEW_NOT_FOUND",
    "PREVIEW_EXPIRED",
    "TRANSACTION_NOT_FOUND",
    "TRANSACTION_EXPIRED",
    "CACHE_CAPACITY_EXCEEDED",
    "RESULT_TRUNCATED",
    "FILE_CHANGED",
    "ROLLBACK_CONFLICT"
  ]);
  const serverErrorCodes = new Set([
    "WRITE_FAILED",
    "CONSISTENCY_RECOVERY_FAILED"
  ]);
  const status = serverErrorCodes.has(error.code)
    ? 500
    : conflictCodes.has(error.code)
      ? 409
      : 400;
  res.status(status).json({
    ok: false,
    code: error.code,
    error: error.message,
    ...(error.filePath ? { filePath: error.filePath } : {})
  });
}

function formatOrigin(host: ServerRuntimeConfig["host"], port: number): string {
  return `http://${host === "::1" ? "[::1]" : host}:${port}`;
}

export async function startServer(): Promise<ServerReadyInfo> {
  await workspacePathPolicy.getRealWorkspaceRoot();
  if (!(await getLingBuilderAiRulebook()).trim()) {
    throw new Error("LingBuilder AI 规则手册为空，服务拒绝启动。");
  }
  // Vite integration
  if (serverRuntimeConfig.environment === "development") {
    // Keep Vite out of the packaged server's module graph. Some Vite/Rollup
    // dependencies probe process.execPath; inside Electron that is the app exe
    // and would recursively launch LingBuilder unless development explicitly
    // requests Vite here.
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          // UI 冒烟/环境探针的临时目录（.tmp-harness、.tmp-ide-userdata 等）会持续改写
          // 被锁定的 Chromium 缓存/Cookie 文件；vite watcher 对其 watch 会抛 EBUSY。
          //
          // 开发服务的 workspaceRoot 常被用户指到 IDE 源码目录自身（electron/）：此时
          // 工作区文件写入（AI 应用/保存/F5 产物写 .lcpp/.cpp/.json/.lingbuilder 等）
          // 会被 vite 当成前端源码变更触发整页 reload，整个应用重挂载退回欢迎页。
          // 下列模式是 IDE 写出的项目/产物文件，永远不是前端模块，对 watcher 屏蔽；
          // IDE 自身前端源码（.tsx/.ts/.css）不在屏蔽范围，HMR 不受影响。
          ignored: [
            "**/.lingbuilder/**",
            "**/.lingbuilder-build/**",
            "**/.tmp-*/**",
            "**/generated/**",
            "**/exports/**",
            "**/*.lcpp",
            "**/*.cpp",
            "**/*.h",
            "**/*.hpp",
            "**/*.rc",
            "**/*.def",
            "**/*.generated.json"
          ]
        }
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
    // chokidar 的 error 事件没有监听器时会杀死整个 dev 服务；本仓库常有并行会话
    // 生成的临时/锁定文件，监视失败只应丢失对应文件的 HMR，不应打断服务。
    vite.watcher.on("error", (error: unknown) => {
      console.warn(`[vite] 文件监视错误已忽略：${error instanceof Error ? error.message : String(error)}`);
    });
  } else {
    const distPath = serverRuntimeConfig.staticRoot as string;
    await fs.access(path.join(distPath, "index.html"));
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(serverRuntimeConfig.port, serverRuntimeConfig.host);
  // 适配器委托到可变量：工作区切换重建 PtyTerminalService 后，终端 WS 通道自动跟随新实例
  terminalWorkspaceBridge = attachTerminalWebSocketServer(server, {
    list: () => ptyTerminalService.list(),
    subscribe: listener => ptyTerminalService.subscribe(listener),
    write: (id, data) => ptyTerminalService.write(id, data),
    resize: (id, cols, rows) => ptyTerminalService.resize(id, cols, rows),
    close: id => ptyTerminalService.close(id)
  });
  void refreshWorkspaceBuildExcludeDirs();
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("LingBuilder IDE 服务未能获取有效监听地址。");
  }
  const ready: ServerReadyInfo = {
    host: serverRuntimeConfig.host,
    port: address.port,
    origin: formatOrigin(serverRuntimeConfig.host, address.port),
    workspaceRoot: serverRuntimeConfig.workspaceRoot,
    pid: process.pid
  };
  console.log(formatServerReady(ready));
  console.log(`LingBuilder IDE Server listening on ${ready.origin}`);

  let closeRequested = false;
  const closeServer = () => {
    if (closeRequested) return;
    closeRequested = true;
    projectBuildCoordinator.shutdown();
    // 先停止接收新请求，再在所有在途请求退出后做第二次回收，覆盖启动登记边界竞态。
    server.close(() => {
      ptyTerminalService.closeAll();
      performanceService.cancel();
      workspaceIndexService.cancel();
      void Promise.all([managedProcessService.stopAll(), clangdService.stop(), nativeDebugService.stop(), nodeTestDebugService.stop(), extensionService.stop()]).finally(() => {
        process.exitCode = 0;
      });
    });
    void managedProcessService.stopAll();
    void clangdService.stop();
    void nativeDebugService.stop();
    void nodeTestDebugService.stop();
    void extensionService.stop();
    ptyTerminalService.closeAll();
  };
  process.once("SIGTERM", closeServer);
  process.once("SIGINT", closeServer);
  return ready;
}

export function createLingBuilderServer() {
  return app;
}

if (process.env.LINGBUILDER_SERVER_AUTOSTART !== "false") {
  startServer().catch(error => {
    const payload = JSON.stringify({
      message: error instanceof Error ? error.message : String(error),
      pid: process.pid
    });
    console.error(`LINGBUILDER_SERVER_ERROR ${payload}`);
    process.exitCode = 1;
  });
}
