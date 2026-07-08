import fs from 'fs/promises';
import path from 'path';
import { execFile, spawn } from 'child_process';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { applyWorkspaceEditToFiles, getWorkspaceEditProposal, proposeLingCppEdit, rejectWorkspaceEdit } from '../lingCpp/aiEditService';
import { getLingCppSemanticDiagnostics } from '../lingCpp/languageService';
import { LingCppEditContext, LingCppWorkspaceFile } from '../lingCpp/types';
import { createModuleService } from '../modules/moduleService';
import { describeLingCppModuleContextForAi } from '../modules/moduleContextAdapters';
import { exportModuleNativeDependencies, materializeModuleNativeDependencies, ModuleNativeDependencyPlan } from '../modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../windowDesigner/lingCppWin32Project';
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

type CompilerInfo = {
  kind: 'msvc' | 'g++' | 'clang++';
  command: string;
  setupBatch?: string;
};

export class AiBridgeService {
  readonly permissions: AiBridgePermissionService;
  private readonly workspaceRoot: string;
  private readonly moduleService;

  constructor(private readonly options: AiBridgeServerOptions) {
    this.workspaceRoot = path.resolve(options.workspaceRoot);
    this.permissions = new AiBridgePermissionService(this.workspaceRoot, options.permission);
    this.moduleService = createModuleService(this.workspaceRoot);
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
    return await this.readDirectoryTree(this.workspaceRoot, 0);
  }

  async readFile(filePath: string): Promise<{ filePath: string; content: string }> {
    const absolutePath = this.resolveReadablePath(filePath);
    const content = await fs.readFile(absolutePath, 'utf8');
    return { filePath: this.toWorkspacePath(absolutePath), content };
  }

  async searchFiles(request: AiBridgeSearchRequest): Promise<{ matches: AiBridgeSearchMatch[] }> {
    const query = request.query?.trim();
    if (!query) throw new Error('缺少搜索关键词。');
    const include = request.include?.length ? request.include : ['src', 'config', '.lingbuilder'];
    const maxResults = Math.max(1, Math.min(request.maxResults || 100, 500));
    const matches: AiBridgeSearchMatch[] = [];

    for (const item of include) {
      const root = this.resolveInsideWorkspace(item);
      if (!await pathExists(root)) continue;
      await this.searchPath(root, query, matches, maxResults);
      if (matches.length >= maxResults) break;
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
    const draft = planner ? await planner(context) : undefined;
    const proposal = proposeLingCppEdit(context, draft);
    return { ok: true, proposal };
  }

  async applyEdit(request: AiBridgeEditApplyRequest): Promise<{ ok: true } & AiBridgeEditApplyResult> {
    const proposal = request.proposalId ? getWorkspaceEditProposal(request.proposalId) : undefined;
    if (!proposal) throw new Error('未找到编辑提案。');

    this.permissions.requireWrite(request.approved);
    const workspaceFiles = await this.resolveApplyWorkspaceFiles(request);
    const appliedFiles = applyWorkspaceEditToFiles(workspaceFiles, proposal);
    const persistedFiles = [];

    for (const file of appliedFiles) {
      const absolutePath = this.resolveWritablePath(file.filePath);
      await fs.mkdir(path.dirname(absolutePath), { recursive: true });
      await fs.writeFile(absolutePath, file.sourceCode, 'utf8');
      persistedFiles.push({ ...file, absolutePath });
      await this.permissions.audit({ operation: 'write', action: 'edit.apply', ok: true, target: file.filePath });
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
    this.permissions.requireWrite(request.approved);
    const preview = await this.nativePreview(request);
    const exportDir = path.join(this.workspaceRoot, 'generated', 'cpp', sanitizeFilename(request.project.id || 'window-preview'));
    await fs.mkdir(exportDir, { recursive: true });
    await Promise.all(preview.files.map(async file => {
      const targetPath = path.join(exportDir, file.relativePath);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.writeFile(targetPath, file.content, 'utf8');
    }));
    const moduleDiagnostics = await exportModuleNativeDependencies(preview.enabledModules, exportDir);
    await this.permissions.audit({ operation: 'write', action: 'native.export', ok: true, target: exportDir });
    return {
      ...preview,
      exportDir,
      diagnostics: [...preview.diagnostics, ...moduleDiagnostics]
    };
  }

  async buildRun(request: AiBridgeBuildRunRequest) {
    this.permissions.requireExecute(request.approved);
    const enabledModules = await this.moduleService.getEnabledProjectModules(request.project.id || 'lingbuilder-ui-project');
    const generatedProject = generateLingCppNativeWin32Project(request.project, {
      activeWindowId: request.activeWindowId,
      lingCppSourceCode: request.lingCppSourceCode || '',
      lingCppSourceFilePath: request.lingCppSourceFilePath,
      enabledModules
    });
    const projectId = sanitizeFilename(request.project.id || 'window-preview');
    const buildDir = path.join(this.workspaceRoot, '.lingbuilder-build', projectId);
    const sourceDir = path.join(buildDir, 'src');
    const binDir = path.join(buildDir, 'bin');
    const objDir = path.join(buildDir, 'obj');
    const exportDir = path.join(this.workspaceRoot, 'generated', 'cpp', projectId);
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
    const compiler = await detectCompiler();
    const baseLogs = [
      `AI Bridge 已生成 Win32 C++ 工程：${buildDir}`,
      `C++ 源码目录：${sourceDir}`,
      `可复制生成目录：${exportDir}`,
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
    const compileResult = await compileWin32Preview(compiler, sourcePath, exePath, objDir, buildDir, moduleNativePlan);
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
        sourceMap: generatedProject.sourceMap,
        logs
      };
      await this.permissions.audit({ operation: 'execute', action: 'build.run', ok: false, target: buildDir, details: result.stage });
      return result;
    }

    if (request.run !== false) {
      try {
        const logFile = path.join(buildDir, 'run.log');
        const logStream = createWriteStream(logFile, { flags: 'w' });
        const child = spawn(exePath, [], {
          cwd: binDir,
          detached: true,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: false
        });
        child.stdout.pipe(logStream);
        child.stderr.pipe(logStream);
        child.unref();
        logs.push(`已启动运行窗口：${exePath}`);
      } catch (error: any) {
        logs.push(`运行启动失败：${error?.message || '无法启动生成的 exe'}`);
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
      sourceMap: generatedProject.sourceMap,
      logs
    };
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
    if (!proposal?.changes[0]) return [];
    const filePath = proposal.changes[0].filePath;
    return [{
      filePath,
      sourceCode: typeof request.sourceCode === 'string'
        ? normalizeLineEndings(request.sourceCode)
        : (await this.readFile(filePath)).content
    }];
  }

  private async readDirectoryTree(directory: string, depth: number): Promise<AiBridgeTreeEntry[]> {
    if (depth > 5) return [];
    const entries = await fs.readdir(directory, { withFileTypes: true });
    const result: AiBridgeTreeEntry[] = [];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
      const absolutePath = path.join(directory, entry.name);
      const relativePath = this.toWorkspacePath(absolutePath);
      if (entry.isDirectory()) {
        result.push({
          path: relativePath,
          name: entry.name,
          type: 'directory',
          children: await this.readDirectoryTree(absolutePath, depth + 1)
        });
      } else if (entry.isFile() && isReadableExtension(entry.name)) {
        const stat = await fs.stat(absolutePath);
        result.push({ path: relativePath, name: entry.name, type: 'file', size: stat.size });
      }
    }
    return result;
  }

  private async searchPath(targetPath: string, query: string, matches: AiBridgeSearchMatch[], maxResults: number): Promise<void> {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(targetPath, { withFileTypes: true });
      for (const entry of entries) {
        if (matches.length >= maxResults) return;
        if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;
        await this.searchPath(path.join(targetPath, entry.name), query, matches, maxResults);
      }
      return;
    }
    if (!stat.isFile() || !isReadableExtension(targetPath)) return;
    const content = await fs.readFile(targetPath, 'utf8');
    content.split(/\r?\n/).forEach((line, index) => {
      if (matches.length >= maxResults) return;
      const column = line.indexOf(query);
      if (column >= 0) {
        matches.push({
          filePath: this.toWorkspacePath(targetPath),
          line: index + 1,
          column: column + 1,
          preview: line.trim()
        });
      }
    });
  }

  private resolveReadablePath(filePath: string): string {
    const absolutePath = this.resolveInsideWorkspace(filePath);
    if (!isReadableExtension(absolutePath)) throw new Error('该文件类型不允许通过 AI Bridge 读取。');
    return absolutePath;
  }

  private resolveWritablePath(filePath: string): string {
    const absolutePath = this.resolveInsideWorkspace(filePath);
    if (!WRITABLE_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) {
      throw new Error('该文件类型不允许通过 AI Bridge 写入。');
    }
    return absolutePath;
  }

  private resolveInsideWorkspace(filePath: string): string {
    const absolutePath = path.resolve(this.workspaceRoot, normalizeFilePath(filePath));
    const relativePath = path.relative(this.workspaceRoot, absolutePath);
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      throw new Error('路径越界：只能访问当前 LingBuilder 工作区内的文件。');
    }
    return absolutePath;
  }

  private toWorkspacePath(absolutePath: string): string {
    return normalizeFilePath(path.relative(this.workspaceRoot, absolutePath));
  }
}

async function detectCompiler(): Promise<CompilerInfo | null> {
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

  const candidates: CompilerInfo[] = [
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
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  modulePlan?: ModuleNativeDependencyPlan
): Promise<{ ok: boolean; logs: string[] }> {
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
    return await compileMsvcPreviewWithModules(compiler, sourcePath, exePath, objDir, cwd, includeArgs, moduleSources, moduleLibs);
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
    });
    const linkResult = linkArgs.length > 0
      ? await execFileAsync(compiler.command, linkArgs, {
          cwd,
          timeout: 60000,
          windowsHide: true,
          maxBuffer: 1024 * 1024 * 4
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
  compiler: CompilerInfo,
  sourcePath: string,
  exePath: string,
  objDir: string,
  cwd: string,
  includeArgs: string[],
  moduleSources: string[],
  moduleLibs: string[]
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
      const result = await runMsvcCommand(compiler, args, cwd);
      if (result.stdout?.trim()) outputs.push(`stdout:\n${result.stdout.trim()}`);
      if (result.stderr?.trim()) outputs.push(`stderr:\n${result.stderr.trim()}`);
    }
    const linkResult = await runMsvcCommand(compiler, linkArgs, cwd);
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

async function runMsvcCommand(compiler: CompilerInfo, commandArgs: string[], cwd: string) {
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
