import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';
import { DEFAULT_BUILD_DIRECTORY_TEMPLATE, DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE, resolveProjectBuildDirectories, validateBuildPathTemplate } from '../tasks/buildPathService';
import { extractPlatforms, parseSolutionFile } from './solutionFileParser';
import {
  generateWindowsDllSourceFromLingCpp,
  isWindowsDllProjectManifest,
  WINDOWS_DLL_PROJECT_MANIFEST
} from './windowsDllProjectService';

export type ExternalProjectKind = 'windows-dll' | 'external-msbuild' | 'external-cmake';
export interface ExternalProjectProperties {
  configuration: 'Debug' | 'Release';
  architecture: 'Win32' | 'x64';
  additionalArguments: string[];
  /** 可选：本项目构建目录模板覆盖（工作区相对，支持宏）；未设置时跟随工作区构建配置。 */
  buildDirectory?: string;
  /** 可选：本项目可复制生成源码目录模板覆盖；未设置时跟随工作区构建配置。 */
  generatedSourceDirectory?: string;
  /** 可选：本项目构建产物 EXE 文件名（可带 .exe 后缀）；未设置时使用 LingBuilderPreview.exe。 */
  executableName?: string;
  /** 可选：项目产物类型；exe（缺省，向后兼容）生成应用程序，dll 生成动态库 + 导入库，并导出源码中的“公开”子程序。 */
  outputType?: 'exe' | 'dll';
}
export interface ImportedExternalProject {
  id: string; name: string; type: ExternalProjectKind; projectFile: string; sourceRoot: string; configRoot: string;
  designerPath: string; references: string[]; buildProperties: ExternalProjectProperties;
  /** 从 .sln 展开导入时保留的原项目 GUID（大写含花括号），用于映射解决方案内依赖。 */
  solutionGuid?: string;
  /** 从 .sln 展开导入时记录的依赖项目 GUID 列表，由 solutionService 翻译为 references 后丢弃。 */
  solutionDependencies?: string[];
}
export interface InspectedSolution {
  projects: ImportedExternalProject[];
  /** 导入过程提示（解析数量、平台降级说明等）。 */
  logs: string[];
  /** 解析告警：跳过的非 C++ 项目、工作区外项目、无法导入的项目等。 */
  warnings: string[];
  solutionConfigurations: string[];
}
export interface ExternalBuildResult {
  ok: boolean;
  command: string;
  args: string[];
  cwd: string;
  stdout: string;
  stderr: string;
  outputDir: string;
  artifacts?: string[];
}
export type ExternalCommandRunner = (command: string, args: readonly string[], cwd: string, signal?: AbortSignal) => Promise<{ exitCode: number; stdout: string; stderr: string }>;

export class ExternalProjectService {
  private readonly policy: WorkspacePathPolicy;
  constructor(private readonly workspaceRoot: string, private readonly runner: ExternalCommandRunner = runCommand) { this.policy = new WorkspacePathPolicy(workspaceRoot); }

  async inspect(relativePath: string, projectId?: string): Promise<ImportedExternalProject> {
    const absolutePath = await this.policy.resolveExisting(relativePath, { rejectSymlinks: true });
    const stat = await fs.stat(absolutePath);
    const projectFile = stat.isDirectory() ? path.join(absolutePath, 'CMakeLists.txt') : absolutePath;
    await fs.access(projectFile);
    return this.inspectProjectFile(projectFile, projectId);
  }

  /**
   * 把 .sln 展开为多个外部工程：每个 Visual C++（.vcxproj）项目生成一个解决方案项目，
   * 解决方案外的项目跳过并给出中文告警。依赖 GUID 由 solutionService 统一映射为 references。
   */
  async inspectSolution(relativePath: string): Promise<InspectedSolution> {
    const absolutePath = await this.policy.resolveExisting(relativePath, { rejectSymlinks: true });
    if (path.extname(absolutePath).toLowerCase() !== '.sln') throw new Error('只能对 .sln 文件执行解决方案展开导入。');
    const parsed = parseSolutionFile(await readSolutionText(absolutePath));
    const warnings = [...parsed.warnings];
    const logs: string[] = [];
    const slnDir = path.dirname(absolutePath);
    const workspaceRoot = path.resolve(this.workspaceRoot);
    const projects: ImportedExternalProject[] = [];
    for (const entry of parsed.projects) {
      const candidate = path.resolve(slnDir, entry.relativePath.replace(/\\/gu, '/'));
      const workspaceRelative = path.relative(workspaceRoot, candidate);
      if (!workspaceRelative || workspaceRelative.startsWith('..') || path.isAbsolute(workspaceRelative)) {
        warnings.push(`已跳过位于工作区外的项目：${entry.name || entry.relativePath}。`);
        continue;
      }
      try {
        const project = await this.inspectProjectFile(candidate);
        project.solutionGuid = entry.guid;
        project.solutionDependencies = entry.dependencies;
        const platforms = extractPlatforms(entry.configPlatforms).map(platform => platform.toLowerCase());
        if (platforms.length && !platforms.includes('win32') && platforms.includes('x64')) {
          project.buildProperties.architecture = 'x64';
          logs.push(`项目 ${project.name} 未提供 Win32 平台，构建属性已默认为 x64。`);
        }
        projects.push(project);
      } catch (error) {
        warnings.push(`无法导入项目 ${entry.name || entry.relativePath}：${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (projects.length === 0) {
      throw new Error(warnings[0] || '该 .sln 中没有可导入的 Visual C++ 项目。');
    }
    logs.push(`已从 ${path.basename(absolutePath)} 解析出 ${projects.length} 个 Visual C++ 项目。`);
    return { projects, logs, warnings, solutionConfigurations: parsed.solutionConfigurations };
  }

  private async inspectProjectFile(projectFile: string, projectId?: string): Promise<ImportedExternalProject> {
    const normalized = (await this.policy.toWorkspaceRelative(projectFile)).replace(/\\/gu, '/');
    const extension = path.extname(projectFile).toLowerCase();
    const type: ExternalProjectKind = path.basename(projectFile).toLowerCase() === 'cmakelists.txt' ? 'external-cmake'
      : extension === '.vcxproj' || extension === '.sln' ? 'external-msbuild'
      : (() => { throw new Error('只支持导入 CMakeLists.txt、.vcxproj 或 .sln。'); })();
    const content = await fs.readFile(projectFile, 'utf8');
    const fallbackName = path.basename(extension === '.sln' ? projectFile : path.dirname(projectFile), extension);
    const name = type === 'external-cmake'
      ? content.match(/\bproject\s*\(\s*([A-Za-z0-9_.-]+)/iu)?.[1] || fallbackName
      : content.match(/<RootNamespace>([^<]+)<\/RootNamespace>/iu)?.[1] || path.basename(projectFile, extension);
    const id = safeId(projectId || name);
    const sourceRoot = (await this.policy.toWorkspaceRelative(path.dirname(projectFile))).replace(/\\/gu, '/') || '.';
    return {
      id, name, type, projectFile: normalized, sourceRoot, configRoot: sourceRoot,
      designerPath: `.lingbuilder/projects/${id}/window-designer.json`, references: [],
      buildProperties: { configuration: 'Debug', architecture: 'Win32', additionalArguments: [] }
    };
  }

  async build(project: ImportedExternalProject, signal?: AbortSignal): Promise<ExternalBuildResult> {
    validateProperties(project.buildProperties);
    const projectFile = await this.policy.resolveExisting(project.projectFile, { rejectSymlinks: true });
    const cwd = path.dirname(projectFile);
    if (project.type === 'windows-dll') await this.materializeLingCppDllSource(cwd, project.id);
    const outputDir = await this.resolveOutputDir(project);
    await fs.mkdir(outputDir, { recursive: true });
    let command: string; let args: string[];
    if (project.type === 'external-cmake') {
      command = 'cmake';
      const generatorArch = project.buildProperties.architecture === 'x64' ? 'x64' : 'Win32';
      // 钉定可执行文件输出目录：多配置生成器会在其下再按配置分子目录，保证“构建后运行”可确定性定位产物。
      const configure = ['-S', cwd, '-B', outputDir, '-A', generatorArch, `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY=${outputDir}`, ...project.buildProperties.additionalArguments];
      const configured = await this.runner(command, configure, cwd, signal);
      if (configured.exitCode !== 0) return { ok: false, command, args: configure, cwd, stdout: configured.stdout, stderr: configured.stderr, outputDir };
      args = ['--build', outputDir, '--config', project.buildProperties.configuration];
    } else {
      command = resolveMsBuildCommand();
      // 钉定 OutDir（结尾必须是路径分隔符），避免各工程自定义输出目录导致产物定位不稳定。
      args = [projectFile, '/m', `/p:Configuration=${project.buildProperties.configuration}`, `/p:Platform=${project.buildProperties.architecture}`, `/p:OutDir=${outputDir}${path.sep}`, ...project.buildProperties.additionalArguments];
    }
    const result = await this.runner(command, args, cwd, signal);
    if (project.type !== 'windows-dll' || result.exitCode !== 0) {
      return { ok: result.exitCode === 0, command, args, cwd, stdout: result.stdout, stderr: result.stderr, outputDir };
    }
    const outputName = path.basename(project.projectFile, path.extname(project.projectFile));
    const artifacts = [path.join(outputDir, `${outputName}.dll`), path.join(outputDir, `${outputName}.lib`)].filter(file => fileExistsSync(file));
    if (artifacts.length < 2) {
      return {
        ok: false,
        command,
        args,
        cwd,
        stdout: result.stdout,
        stderr: `${result.stderr}\nMSBuild 已返回成功，但未找到 DLL 或导入库输出。请检查项目配置。`.trim(),
        outputDir,
        artifacts
      };
    }
    return { ok: true, command, args, cwd, stdout: result.stdout, stderr: result.stderr, outputDir, artifacts };
  }

  /**
   * 解析外部工程构建产物目录：与 build() 保持同一逻辑（windows-dll 为工程旁 arch/config/bin，
   * 其余走工作区构建目录模板）。供运行定位产物与被引用工程收集链接库复用。
   */
  async resolveOutputDir(project: ImportedExternalProject): Promise<string> {
    validateProperties(project.buildProperties);
    if (project.type === 'windows-dll') {
      const projectFile = await this.policy.resolveExisting(project.projectFile, { rejectSymlinks: true });
      return path.join(path.dirname(projectFile), project.buildProperties.architecture, project.buildProperties.configuration, 'bin');
    }
    return resolveProjectBuildDirectories({
      workspaceRoot: this.workspaceRoot,
      projectDirName: safeId(project.id),
      projectName: project.name,
      platform: project.buildProperties.architecture,
      configuration: project.buildProperties.configuration,
      templates: {
        buildDirectory: project.buildProperties.buildDirectory,
        generatedSourceDirectory: project.buildProperties.generatedSourceDirectory
      }
    }).buildDir;
  }

  /**
   * 定位外部工程构建产物中的导入库/静态库（.lib），供引用它的中文工程在链接阶段使用。
   * 按钉定输出目录与工程目录常见组合查找，去重返回绝对路径列表。
   */
  async locateLibraries(project: ImportedExternalProject, outputDir: string): Promise<string[]> {
    let projectDir = path.dirname(outputDir);
    try {
      const projectFile = await this.policy.resolveExisting(project.projectFile, { rejectSymlinks: true });
      projectDir = path.dirname(projectFile);
    } catch { /* 工程文件不可达时退回输出目录附近查找 */ }
    const config = project.buildProperties.configuration;
    const architecture = project.buildProperties.architecture;
    const candidateDirs = [
      outputDir,
      path.join(outputDir, config),
      path.join(projectDir, architecture, config),
      path.join(projectDir, config, architecture),
      path.join(projectDir, config),
      path.join(projectDir, architecture),
      projectDir
    ];
    const libraries: string[] = [];
    for (const dir of candidateDirs) {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.lib')) continue;
        const file = path.join(dir, entry.name);
        if (!libraries.includes(file)) libraries.push(file);
      }
    }
    return libraries;
  }

  /**
   * 定位外部工程构建产物中的可执行文件（供“构建后运行”）：
   * 优先在钉定输出目录（含多配置子目录）中查找，其次按工程目录常见组合，
   * 最后对工程目录做深度 ≤3 的兜底扫描（排除 obj/.vs 等中间目录）。
   * 设置了 executableName 时优先精确匹配；找不到时回退为最新 .exe。返回 null 表示未找到。
   */
  async locateExecutable(project: ImportedExternalProject, outputDir: string): Promise<string | null> {
    if (project.type === 'windows-dll') return null;
    const executableName = project.buildProperties.executableName
      ? resolveExecutableNameParts(project.buildProperties.executableName).fileName.toLowerCase()
      : null;
    let projectDir = path.dirname(outputDir);
    try {
      const projectFile = await this.policy.resolveExisting(project.projectFile, { rejectSymlinks: true });
      projectDir = path.dirname(projectFile);
    } catch { /* 工程文件不可达时退回输出目录附近查找 */ }
    const config = project.buildProperties.configuration;
    const architecture = project.buildProperties.architecture;
    const candidateDirs = [
      outputDir,
      path.join(outputDir, config),
      path.join(projectDir, config),
      path.join(projectDir, architecture),
      path.join(projectDir, architecture, config),
      path.join(projectDir, config, architecture),
      projectDir
    ];
    for (const dir of candidateDirs) {
      const found = await findExecutableInDirectory(dir, executableName);
      if (found) return found;
    }
    const named = await findExecutableDeep(projectDir, executableName, 3);
    return named || findExecutableDeep(projectDir, null, 3);
  }

  private async materializeLingCppDllSource(projectDirectory: string, projectId: string): Promise<void> {
    const manifestPath = path.join(projectDirectory, WINDOWS_DLL_PROJECT_MANIFEST);
    let manifest: unknown;
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    } catch {
      return;
    }
    if (!isWindowsDllProjectManifest(manifest)) return;
    const lingCppFiles = (await fs.readdir(projectDirectory, { withFileTypes: true }))
      .filter(entry => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.lcpp'))
      .map(entry => entry.name)
      .sort((left, right) => left.localeCompare(right));
    const sourceCode = lingCppFiles.length > 0
      ? await fs.readFile(path.join(projectDirectory, lingCppFiles[0]!), 'utf8')
      : '';
    const outputName = manifest.outputName || projectId;
    await fs.writeFile(
      path.join(projectDirectory, 'DllMain.cpp'),
      generateWindowsDllSourceFromLingCpp(outputName, sourceCode),
      'utf8'
    );
  }
}

export const DEFAULT_EXECUTABLE_FILE_NAME = 'LingBuilderPreview.exe';
const EXECUTABLE_BASE_NAME_MAX_LENGTH = 64;

/**
 * 解析项目构建产物的文件名：接受带或不带 .exe / .dll 后缀的名称；
 * 缺省/空白回退 LingBuilderPreview（DLL 输出为 .dll，其余为 .exe）；含 Windows 非法文件名字符时抛错。
 */
export function resolveExecutableNameParts(value: unknown, outputType: 'exe' | 'dll' = 'exe'): { baseName: string; fileName: string } {
  let base = typeof value === 'string' ? value.trim() : '';
  const lowerBase = base.toLowerCase();
  if (lowerBase.endsWith('.exe') || lowerBase.endsWith('.dll')) base = base.slice(0, -4);
  base = base.replace(/[.\s]+$/u, '');
  const defaultFileName = outputType === 'dll' ? `${DEFAULT_EXECUTABLE_FILE_NAME.slice(0, -4)}.dll` : DEFAULT_EXECUTABLE_FILE_NAME;
  if (!base) return { baseName: defaultFileName.slice(0, -4), fileName: defaultFileName };
  if (base.length > EXECUTABLE_BASE_NAME_MAX_LENGTH || /[\\/:*?"<>|\r\n\0]/u.test(base)) {
    throw new Error(`项目可执行文件名不合法：“${String(value)}”不得包含 \ / : * ? " < > | 字符，长度不超过 ${EXECUTABLE_BASE_NAME_MAX_LENGTH}。`);
  }
  return { baseName: base, fileName: `${base}${outputType === 'dll' ? '.dll' : '.exe'}` };
}

export function validateProperties(value: ExternalProjectProperties): void {
  if (!value || !['Debug', 'Release'].includes(value.configuration) || !['Win32', 'x64'].includes(value.architecture)) throw new Error('外部工程配置无效。');
  if (value.outputType !== undefined && value.outputType !== 'exe' && value.outputType !== 'dll') throw new Error('项目输出类型无效：只支持 exe 或 dll。');
  if (!Array.isArray(value.additionalArguments) || value.additionalArguments.some(argument => typeof argument !== 'string' || argument.length > 200 || /[\r\n\0]/u.test(argument))) throw new Error('外部工程附加参数无效。');
  if (value.buildDirectory !== undefined) {
    if (typeof value.buildDirectory !== 'string') throw new Error('项目构建目录模板无效。');
    validateBuildPathTemplate(value.buildDirectory, '项目构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE);
  }
  if (value.generatedSourceDirectory !== undefined) {
    if (typeof value.generatedSourceDirectory !== 'string') throw new Error('项目生成源码目录模板无效。');
    validateBuildPathTemplate(value.generatedSourceDirectory, '项目生成源码目录', DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE);
  }
  if (value.executableName !== undefined) {
    if (typeof value.executableName !== 'string') throw new Error('项目可执行文件名无效。');
    try {
      resolveExecutableNameParts(value.executableName, value.outputType === 'dll' ? 'dll' : 'exe');
    } catch {
      throw new Error('项目可执行文件名不合法：不得包含 \ / : * ? " < > | 字符，长度不超过 64。');
    }
  }
}
const execFileAsync = promisify(execFile);
function fileExistsSync(filePath: string): boolean {
  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function resolveMsBuildCommand(): string {
  const configured = process.env.LINGBUILDER_MSBUILD_PATH;
  if (configured && fileExistsSync(configured)) return configured;
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const candidates = [programFiles, programFilesX86].flatMap(root => [2022, 2019].flatMap(year =>
    ['Community', 'Professional', 'Enterprise', 'BuildTools'].flatMap(edition => [
      path.join(root, 'Microsoft Visual Studio', String(year), edition, 'MSBuild', 'Current', 'Bin', 'amd64', 'MSBuild.exe'),
      path.join(root, 'Microsoft Visual Studio', String(year), edition, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe')
    ])
  ));
  return candidates.find(fileExistsSync) || 'msbuild';
}

const runCommand: ExternalCommandRunner = async (command, args, cwd, signal) => {
  try { const result = await execFileAsync(command, [...args], { cwd, windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024, signal }); return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }; }
  catch (error: any) { return { exitCode: typeof error.code === 'number' ? error.code : 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message || '') }; }
};
const safeId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'external-project';

/** 可执行文件搜索时跳过的中间产物/环境目录（小写比较）。 */
const EXECUTABLE_SEARCH_SKIPPED_DIRECTORIES = new Set(['obj', '.vs', '.git', 'node_modules', '.lingbuilder', '.lingbuilder-build']);

/** 读取 .sln 文本：VS 生成的部分解决方案是带 BOM 的 UTF-16 LE，需按 BOM 解码。 */
async function readSolutionText(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) return buffer.toString('utf16le');
  return buffer.toString('utf8');
}

async function findExecutableInDirectory(directory: string, executableName: string | null): Promise<string | null> {
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return null; }
  const candidates: Array<{ file: string; mtimeMs: number }> = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.exe')) continue;
    if (executableName && entry.name.toLowerCase() !== executableName) continue;
    const file = path.join(directory, entry.name);
    try { candidates.push({ file, mtimeMs: (await fs.stat(file)).mtimeMs }); } catch { /* 忽略瞬时消失的文件 */ }
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  return candidates[0]!.file;
}

async function findExecutableDeep(directory: string, executableName: string | null, depth: number): Promise<string | null> {
  if (depth < 0) return null;
  const direct = await findExecutableInDirectory(directory, executableName);
  if (direct) return direct;
  let entries;
  try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (EXECUTABLE_SEARCH_SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
    const found = await findExecutableDeep(path.join(directory, entry.name), executableName, depth - 1);
    if (found) return found;
  }
  return null;
}
