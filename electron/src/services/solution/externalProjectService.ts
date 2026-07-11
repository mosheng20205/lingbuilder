import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { WorkspacePathPolicy } from '../workspace/workspacePathPolicy';

export type ExternalProjectKind = 'external-msbuild' | 'external-cmake';
export interface ExternalProjectProperties { configuration: 'Debug' | 'Release'; architecture: 'Win32' | 'x64'; additionalArguments: string[] }
export interface ImportedExternalProject {
  id: string; name: string; type: ExternalProjectKind; projectFile: string; sourceRoot: string; configRoot: string;
  designerPath: string; references: string[]; buildProperties: ExternalProjectProperties;
}
export interface ExternalBuildResult { ok: boolean; command: string; args: string[]; cwd: string; stdout: string; stderr: string; outputDir: string }
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
    const outputDir = path.join(this.workspaceRoot, '.lingbuilder-build', safeId(project.id), project.buildProperties.architecture, project.buildProperties.configuration);
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
      command = 'msbuild';
      args = [projectFile, '/m', `/p:Configuration=${project.buildProperties.configuration}`, `/p:Platform=${project.buildProperties.architecture}`, ...project.buildProperties.additionalArguments];
    }
    const result = await this.runner(command, args, cwd, signal);
    return { ok: result.exitCode === 0, command, args, cwd, stdout: result.stdout, stderr: result.stderr, outputDir };
  }
}

export function validateProperties(value: ExternalProjectProperties): void {
  if (!value || !['Debug', 'Release'].includes(value.configuration) || !['Win32', 'x64'].includes(value.architecture)) throw new Error('外部工程配置无效。');
  if (!Array.isArray(value.additionalArguments) || value.additionalArguments.some(argument => typeof argument !== 'string' || argument.length > 200 || /[\r\n\0]/u.test(argument))) throw new Error('外部工程附加参数无效。');
}
const execFileAsync = promisify(execFile);
const runCommand: ExternalCommandRunner = async (command, args, cwd, signal) => {
  try { const result = await execFileAsync(command, [...args], { cwd, windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024, signal }); return { exitCode: 0, stdout: result.stdout, stderr: result.stderr }; }
  catch (error: any) { return { exitCode: typeof error.code === 'number' ? error.code : 1, stdout: String(error.stdout || ''), stderr: String(error.stderr || error.message || '') }; }
};
const safeId = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'external-project';
