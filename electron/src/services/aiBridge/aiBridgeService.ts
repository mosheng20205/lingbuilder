import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { applyWorkspaceEditToFiles, getWorkspaceEditProposal, proposeLingCppEdit, rejectWorkspaceEdit } from '../lingCpp/aiEditService';
import { getLingCppSemanticDiagnostics } from '../lingCpp/languageService';
import { LingCppEditContext, LingCppWorkspaceFile } from '../lingCpp/types';
import { createModuleService } from '../modules/moduleService';
import { describeLingCppModuleContextForAi } from '../modules/moduleContextAdapters';
import { exportModuleNativeDependencies, materializeModuleNativeDependencies, ModuleNativeDependencyPlan } from '../modules/nativeDependencyService';
import { createManagedProcessService } from '../tasks/managedProcessService';
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
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';
import { decodeTextFile, encodeTextFile } from '../files/textFileService';
import type { TextFileFormat } from '../files/types';
import { generateLingCppNativeWin32Project } from '../windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../windowDesigner/visualStudioProjectExporter';
import { LingWindowProject } from '../windowDesigner/types';
import { AiBridgePermissionService } from './permissionService';
import {
  AiBridgeBuildRunRequest,
  AiBridgeEditApplyRequest,
  AiBridgeEditApplyResult,
  AiBridgeEditProposeRequest,
  AiBridgeHealth,
  AiBridgeLingCppDiagnosticsRequest,
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
};

export interface AiBridgeCompileResult {
  ok: boolean;
  logs: string[];
}

export type AiBridgeProcessManager = Pick<ManagedProcessService, 'start' | 'stop' | 'stopAll'>;

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
    signal?: AbortSignal
  ) => Promise<AiBridgeCompileResult>;
}

export class AiBridgeService {
  readonly permissions: AiBridgePermissionService;
  private readonly workspaceRoot: string;
  private readonly pathPolicy: WorkspacePathPolicy;
  private readonly moduleService;
  private readonly managedProcessService: AiBridgeProcessManager;
  private readonly projectBuildCoordinator: ProjectBuildCoordinator;
  private readonly projectBuildSessionService: ProjectBuildSessionService;
  private readonly compilerDetector: () => Promise<AiBridgeCompilerInfo | null>;
  private readonly compilerRunner: NonNullable<AiBridgeServiceDependencies['compileWin32Preview']>;
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
    this.managedProcessService = dependencies.managedProcessService ?? createManagedProcessService();
    this.projectBuildCoordinator = dependencies.projectBuildCoordinator ?? createProjectBuildCoordinator();
    this.projectBuildSessionService = createProjectBuildSessionService(
      this.projectBuildCoordinator,
      this.managedProcessService
    );
    this.compilerDetector = dependencies.detectCompiler ?? detectCompiler;
    this.compilerRunner = dependencies.compileWin32Preview ?? compileWin32Preview;
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
    const diagnostics = getLingCppSemanticDiagnostics(
      sourceCode,
      request.designerProject,
      request.filePath,
      moduleContext
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
      aiConfig: request.aiConfig
    };
    if (!planner && !request.files?.length) {
      throw new Error('当前独立 AI Bridge 未配置系统 AI planner；请由外部 AI 提供 files 完整文件草稿后再创建提案。');
    }
    const draft = planner ? await planner(context) : { summary: request.instruction || '外部 AI 编辑提案', explanation: '外部 AI 提供了完整文件草稿，LingBuilder 仅创建可预览提案。', files: request.files };
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
    return { ok: true, proposal, appliedFiles: persistedFiles };
  }

  async listModules(projectId = 'lingbuilder-ui-project') {
    const [availableModules, enabledModules, history] = await Promise.all([
      this.moduleService.scanInstalledModules(projectId),
      this.moduleService.getEnabledProjectModules(projectId),
      this.moduleService.getHistory()
    ]);
    return {
      ok: true,
      availableModules,
      enabledModules,
      history,
      summary: describeLingCppModuleContextForAi({ availableModules, enabledModules })
    };
  }

  async nativePreview(request: AiBridgeNativeRequest) {
    const enabledModules = await this.moduleService.getEnabledProjectModules(request.project.id || 'lingbuilder-ui-project');
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      enabledModules
    });
    return {
      ok: true,
      files: generatedProject.files,
      diagnostics: generatedProject.diagnostics,
      selectedWindow: generatedProject.selectedWindow,
      enabledModules,
      sourceMap: generatedProject.sourceMap
    };
  }

  async nativeExport(request: AiBridgeNativeRequest) {
    await this.requireWriteWithAudit('native.export', request.project?.id, request.approved);
    try {
      const preview = await this.nativePreview(request);
      const exportDir = await this.pathPolicy.resolveDirectoryForWrite(
        normalizeFilePath(path.join('generated', 'cpp', sanitizeFilename(request.project.id || 'window-preview')))
      );
      await fs.mkdir(exportDir, { recursive: true });
      await Promise.all(preview.files.map(async file => {
        const targetPath = path.join(exportDir, file.relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, file.content, 'utf8');
      }));
      const moduleDiagnostics = await exportModuleNativeDependencies(preview.enabledModules, exportDir);
      const visualStudioProject = await exportVisualStudioProject({
        projectDir: exportDir,
        projectId: request.project.id || 'window-preview',
        generatedFiles: preview.files,
        enabledModules: preview.enabledModules
      });
      await this.permissions.audit({ operation: 'write', action: 'native.export', ok: true, target: exportDir });
      return {
        ...preview,
        exportDir,
        visualStudioProject,
        diagnostics: [...preview.diagnostics, ...moduleDiagnostics]
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
    const enabledModules = await this.moduleService.getEnabledProjectModules(request.project.id || 'lingbuilder-ui-project');
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      enabledModules
    });
    const managedProjectId = buildLease.projectId;
    const projectId = sanitizeFilename(managedProjectId);
    const [buildDir, exportDir] = await Promise.all([
      this.pathPolicy.resolveDirectoryForWrite(normalizeFilePath(path.join('.lingbuilder-build', projectId))),
      this.pathPolicy.resolveDirectoryForWrite(normalizeFilePath(path.join('generated', 'cpp', projectId)))
    ]);
    const sourceDir = path.join(buildDir, 'src');
    const binDir = path.join(buildDir, 'bin');
    const objDir = path.join(buildDir, 'obj');
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

    const moduleNativePlan = await materializeModuleNativeDependencies(enabledModules, {
      buildDir,
      sourceDir,
      binDir,
      exportDir
    });
    const buildVisualStudioProject = await exportVisualStudioProject({
      projectDir: buildDir,
      projectId,
      generatedFiles: generatedProject.files.map(file => ({
        ...file,
        relativePath: normalizeFilePath(path.join('src', file.relativePath))
      })),
      enabledModules
    });
    const exportVisualStudioProjectResult = await exportVisualStudioProject({
      projectDir: exportDir,
      projectId,
      generatedFiles: generatedProject.files,
      enabledModules
    });
    if (buildLease.isCancelled()) {
      return await this.createCancelledBuildResult(
        managedProjectId,
        '已完成源码导出，但任务在编译前被停止。',
        preBuildLogs,
        buildDir
      );
    }
    const compiler = await this.compilerDetector();
    const baseLogs = [
      ...preBuildLogs,
      `AI Bridge 已生成 Win32 C++ 工程：${buildDir}`,
      `C++ 源码目录：${sourceDir}`,
      `可复制生成目录：${exportDir}`,
      `Visual Studio 解决方案：${buildVisualStudioProject.solutionPath}`,
      `可复制 Visual Studio 解决方案：${exportVisualStudioProjectResult.solutionPath}`,
      ...generatedProject.diagnostics,
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
        files: generatedProject.files.map(file => path.join(sourceDir, file.relativePath)),
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
    const compileResult = await this.compilerRunner(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan, buildLease.signal);
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
    return { kind: 'msvc', command: 'cl' };
  } catch {
    // MSVC may be installed but not loaded into the current shell.
  }

  const msvcSetupBatch = await findMsvcSetupBatch();
  if (msvcSetupBatch && await canUseMsvcSetupBatch(msvcSetupBatch)) {
    return { kind: 'msvc', command: 'cl', setupBatch: msvcSetupBatch };
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

async function findMsvcSetupBatch(): Promise<string | null> {
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
    const candidates = [
      path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvars32.bat'),
      path.join(installPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat'),
      path.join(installPath, 'Common7', 'Tools', 'VsDevCmd.bat')
    ];

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

  const objectPath = path.join(objDir, 'main.obj');
  if (compiler.kind === 'msvc' && moduleSources.length > 0) {
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs, signal);
  }

  const commandArgs = compiler.kind === 'msvc'
    ? [
        '/nologo',
        '/EHsc',
        '/std:c++17',
        '/utf-8',
        '/DUNICODE',
        '/D_UNICODE',
        ...includeArgs,
        sourcePath,
        '/Fo:' + objectPath,
        '/Fe:' + exePath,
        'user32.lib',
        'gdi32.lib',
        'comctl32.lib',
        ...moduleLibs
      ]
    : [
        '-municode',
        '-std=c++17',
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

    const compileResult = await execFileAsync(command, args, {
      cwd,
      timeout: 60000,
      windowsHide: true,
      windowsVerbatimArguments: command === 'cmd.exe',
      maxBuffer: 1024 * 1024 * 4
      , signal
    });
    const linkResult = linkArgs.length > 0
      ? await execFileAsync(compiler.command, linkArgs, {
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
  signal?: AbortSignal
): Promise<{ ok: boolean; logs: string[] }> {
  const sources = [sourcePath, ...moduleSources];
  const objectFiles = sources.map((source, index) => path.join(objDir, `${index === 0 ? 'main' : `module_${index}`}.obj`));
  const compileCommands = sources.map((source, index) => [
    '/nologo',
    '/EHsc',
    '/std:c++17',
    '/utf-8',
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
    return { ok: true, logs: ['编译成功。', ...outputs] };
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
  return await execFileAsync(command, args, {
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
