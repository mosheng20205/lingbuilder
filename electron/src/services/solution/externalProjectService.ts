import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';
import { DEFAULT_BUILD_DIRECTORY_TEMPLATE, DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE, resolveProjectBuildDirectories, validateBuildPathTemplate } from '../tasks/buildPathService';
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
}
export interface ImportedExternalProject {
  id: string; name: string; type: ExternalProjectKind; projectFile: string; sourceRoot: string; configRoot: string;
  designerPath: string; references: string[]; buildProperties: ExternalProjectProperties;
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
    const outputDir = project.type === 'windows-dll'
      ? path.join(cwd, project.buildProperties.architecture, project.buildProperties.configuration, 'bin')
      : resolveProjectBuildDirectories({
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
    await fs.mkdir(outputDir, { recursive: true });
    let command: string; let args: string[];
    if (project.type === 'external-cmake') {
      command = 'cmake';
      const generatorArch = project.buildProperties.architecture === 'x64' ? 'x64' : 'Win32';
      const configure = ['-S', cwd, '-B', outputDir, '-A', generatorArch, ...project.buildProperties.additionalArguments];
      const configured = await this.runner(command, configure, cwd, signal);
      if (configured.exitCode !== 0) return { ok: false, command, args: configure, cwd, stdout: configured.stdout, stderr: configured.stderr, outputDir };
      args = ['--build', outputDir, '--config', project.buildProperties.configuration];
    } else {
      command = resolveMsBuildCommand();
      args = [projectFile, '/m', `/p:Configuration=${project.buildProperties.configuration}`, `/p:Platform=${project.buildProperties.architecture}`, ...project.buildProperties.additionalArguments];
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
 * 解析项目构建产物的 EXE 文件名：接受带或不带 .exe 后缀的名称；
 * 缺省/空白回退 LingBuilderPreview.exe；含 Windows 非法文件名字符时抛错。
 */
export function resolveExecutableNameParts(value: unknown): { baseName: string; fileName: string } {
  let base = typeof value === 'string' ? value.trim() : '';
  if (base.toLowerCase().endsWith('.exe')) base = base.slice(0, -4);
  base = base.replace(/[.\s]+$/u, '');
  if (!base) return { baseName: DEFAULT_EXECUTABLE_FILE_NAME.slice(0, -4), fileName: DEFAULT_EXECUTABLE_FILE_NAME };
  if (base.length > EXECUTABLE_BASE_NAME_MAX_LENGTH || /[\\/:*?"<>|\r\n\0]/u.test(base)) {
    throw new Error(`项目可执行文件名不合法：“${String(value)}”不得包含 \ / : * ? " < > | 字符，长度不超过 ${EXECUTABLE_BASE_NAME_MAX_LENGTH}。`);
  }
  return { baseName: base, fileName: `${base}.exe` };
}

export function validateProperties(value: ExternalProjectProperties): void {
  if (!value || !['Debug', 'Release'].includes(value.configuration) || !['Win32', 'x64'].includes(value.architecture)) throw new Error('外部工程配置无效。');
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
      resolveExecutableNameParts(value.executableName);
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
