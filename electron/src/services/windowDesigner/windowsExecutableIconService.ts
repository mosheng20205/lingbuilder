import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { LingBuilderSolutionProject } from '../solution/solutionService';
import { decodeCompilerOutput } from '../tasks/compilerOutputEncoding';
import type { DesignerAssetService } from './designerAssetService';
import type { LingWindowModel } from './types';

export const WINDOWS_EXECUTABLE_RESOURCE_FILE = 'lingbuilder-app.rc';
export const WINDOWS_EXECUTABLE_ICON_FILE = 'resources/lingbuilder-app.ico';

const execFileAsync = promisify(execFile);

export interface WindowsExecutableIconMaterialization {
  files: string[];
  fingerprint: string;
  source: 'custom' | 'lingbuilder' | 'none';
}

export interface WindowsResourceCompilerInfo {
  kind: 'msvc' | 'g++' | 'clang++';
  command: string;
  setupBatch?: string;
}

export interface WindowsResourceCompileResult {
  outputPath?: string;
  logs: string[];
}

export class WindowsExecutableResourceCompileError extends Error {
  constructor(message: string, readonly logs: string[]) {
    super(message);
    this.name = 'WindowsExecutableResourceCompileError';
  }
}

export function getSafeCustomWindowIconPath(window: LingWindowModel): string {
  if (window.iconStyle !== 'custom') return '';
  const normalized = window.iconPath?.trim().replace(/\\/gu, '/') || '';
  if (!normalized.toLowerCase().endsWith('.ico')) return '';
  if (!normalized.startsWith('assets/') || normalized.split('/').includes('..')) return '';
  if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(normalized) || /["\u0000-\u001f]/u.test(normalized)) return '';
  return normalized;
}

export function generateWindowsExecutableResourceFile(window: LingWindowModel): { relativePath: string; content: string } | undefined {
  const iconStyle = window.iconStyle || 'lingbuilder';
  if (iconStyle !== 'lingbuilder' && iconStyle !== 'custom') return undefined;
  if (iconStyle === 'custom' && !getSafeCustomWindowIconPath(window)) return undefined;
  return {
    relativePath: WINDOWS_EXECUTABLE_RESOURCE_FILE,
    content: [
      '#pragma code_page(65001)',
      '#define IDI_LINGBUILDER_APP 101',
      `IDI_LINGBUILDER_APP ICON "${WINDOWS_EXECUTABLE_ICON_FILE}"`,
      ''
    ].join('\n')
  };
}

export class WindowsExecutableIconService {
  constructor(
    private readonly workspaceRoot: string,
    private readonly designerAssetService: DesignerAssetService,
    private readonly bundledIconPath?: string
  ) {}

  async materialize(
    project: LingBuilderSolutionProject,
    window: LingWindowModel,
    destinationRoots: readonly string[]
  ): Promise<WindowsExecutableIconMaterialization> {
    const resourceFile = generateWindowsExecutableResourceFile(window);
    if (!resourceFile) {
      await this.removeStaleIcons(destinationRoots);
      return { files: [], fingerprint: 'none', source: 'none' };
    }

    const customIconPath = getSafeCustomWindowIconPath(window);
    const source = customIconPath ? 'custom' : 'lingbuilder';
    const bytes = customIconPath
      ? (await this.designerAssetService.readImage(project, customIconPath)).bytes
      : await fs.readFile(await this.resolveBundledIconPath());
    validateIco(bytes, customIconPath || 'LingBuilder 默认窗口图标');

    const files: string[] = [];
    for (const destinationRoot of [...new Set(destinationRoots.map(root => path.resolve(root)))]) {
      const target = resolveWithin(destinationRoot, WINDOWS_EXECUTABLE_ICON_FILE);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
      files.push(target);
    }
    return {
      files,
      fingerprint: crypto.createHash('sha256').update(bytes).digest('hex'),
      source
    };
  }

  private async resolveBundledIconPath(): Promise<string> {
    const resourceRoot = String(process.env.LINGBUILDER_RESOURCE_ROOT || '').trim();
    const candidates = [
      this.bundledIconPath,
      resourceRoot ? path.join(resourceRoot, 'assets', 'lingbuilder-window.ico') : '',
      path.join(path.dirname(process.execPath), 'resources', 'assets', 'lingbuilder-window.ico'),
      resourceRoot ? path.resolve(resourceRoot, '..', 'image', 'lingbuilder-ide-icon-v2.ico') : '',
      path.join(this.workspaceRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
      path.resolve(process.cwd(), '..', 'image', 'lingbuilder-ide-icon-v2.ico')
    ].filter((candidate): candidate is string => Boolean(candidate));
    for (const candidate of candidates) {
      try {
        if ((await fs.stat(candidate)).isFile()) return candidate;
      } catch {
        // Try the next development or packaged resource location.
      }
    }
    throw new Error('LingBuilder 默认窗口图标资源缺失，已阻止生成无图标的 EXE。请修复安装资源后重试。');
  }

  private async removeStaleIcons(destinationRoots: readonly string[]): Promise<void> {
    await Promise.all([...new Set(destinationRoots.map(root => path.resolve(root)))].map(async destinationRoot => {
      await fs.rm(resolveWithin(destinationRoot, WINDOWS_EXECUTABLE_ICON_FILE), { force: true });
    }));
  }
}

export function createWindowsExecutableIconService(
  workspaceRoot: string,
  designerAssetService: DesignerAssetService,
  bundledIconPath?: string
): WindowsExecutableIconService {
  return new WindowsExecutableIconService(workspaceRoot, designerAssetService, bundledIconPath);
}

export async function compileWindowsExecutableResource(options: {
  compiler: WindowsResourceCompilerInfo;
  resourcePath?: string;
  objDir: string;
  cwd: string;
  signal?: AbortSignal;
}): Promise<WindowsResourceCompileResult> {
  if (!options.resourcePath) return { logs: [] };
  const resourcePath = path.resolve(options.resourcePath);
  const iconPath = resolveWithin(path.resolve(options.cwd), WINDOWS_EXECUTABLE_ICON_FILE);
  try {
    await Promise.all([fs.access(resourcePath), fs.access(iconPath), fs.mkdir(options.objDir, { recursive: true })]);
  } catch (error) {
    const message = `EXE 图标资源不完整：${error instanceof Error ? error.message : String(error)}`;
    throw new WindowsExecutableResourceCompileError(message, ['EXE 图标资源编译失败。', message]);
  }

  const isMsvc = options.compiler.kind === 'msvc';
  const outputPath = path.join(options.objDir, isMsvc ? 'lingbuilder-app.res' : 'lingbuilder-app-resource.o');
  const command = isMsvc ? 'rc.exe' : resolveWindresCommand(options.compiler.command);
  const commandArgs = isMsvc
    ? ['/nologo', '/fo', outputPath, resourcePath]
    : ['--input-format=rc', '--output-format=coff', '--input', resourcePath, '--output', outputPath];

  try {
    const result = isMsvc && options.compiler.setupBatch
      ? await execDecoded('cmd.exe', [
          '/d',
          '/c',
          `call ${quoteCmdArg(options.compiler.setupBatch)} >nul && ${command} ${commandArgs.map(quoteCmdArg).join(' ')}`
        ], { ...options, windowsVerbatimArguments: true })
      : await execDecoded(command, commandArgs, options);
    return {
      outputPath,
      logs: [
        `已编译 EXE 图标资源：${path.basename(resourcePath)}`,
        result.stdout.trim() ? `resource stdout:\n${result.stdout.trim()}` : '',
        result.stderr.trim() ? `resource stderr:\n${result.stderr.trim()}` : ''
      ].filter(Boolean)
    };
  } catch (error: any) {
    const toolHint = isMsvc
      ? '请确认 Visual Studio Build Tools 已安装 Windows SDK Resource Compiler (rc.exe)。'
      : '请确认 MinGW windres 与当前 C++ 编译器位于同一工具链。';
    const logs = [
      'EXE 图标资源编译失败。',
      error.stdout?.trim() ? `resource stdout:\n${error.stdout.trim()}` : '',
      error.stderr?.trim() ? `resource stderr:\n${error.stderr.trim()}` : '',
      error.message ? `错误：${error.message}` : '',
      toolHint
    ].filter(Boolean);
    throw new WindowsExecutableResourceCompileError(logs.join('\n'), logs);
  }
}

function validateIco(bytes: Buffer, label: string): void {
  const imageCount = bytes.length >= 6 ? bytes.readUInt16LE(4) : 0;
  const directoryEnd = 6 + imageCount * 16;
  const validHeader = bytes.length >= directoryEnd
    && bytes.readUInt16LE(0) === 0
    && bytes.readUInt16LE(2) === 1
    && imageCount > 0
    && imageCount <= 256;
  const validEntries = validHeader && Array.from({ length: imageCount }).every((_, index) => {
    const entryOffset = 6 + index * 16;
    const imageBytes = bytes.readUInt32LE(entryOffset + 8);
    const imageOffset = bytes.readUInt32LE(entryOffset + 12);
    return imageBytes > 0 && imageOffset >= directoryEnd && imageOffset + imageBytes <= bytes.length;
  });
  if (!validEntries) throw new Error(`${label} 不是有效的 ICO 文件，已阻止生成无图标或损坏的 EXE。`);
}

function resolveWithin(root: string, relativePath: string): string {
  const target = path.resolve(root, relativePath);
  const relative = path.relative(root, target);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`EXE 图标资源目标路径不安全：${relativePath}`);
  }
  return target;
}

function resolveWindresCommand(compilerCommand: string): string {
  const compilerDirectory = path.dirname(compilerCommand);
  return compilerDirectory && compilerDirectory !== '.'
    ? path.join(compilerDirectory, 'windres.exe')
    : 'windres.exe';
}

function quoteCmdArg(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

async function execDecoded(
  command: string,
  args: string[],
  options: { cwd: string; signal?: AbortSignal; windowsVerbatimArguments?: boolean }
): Promise<{ stdout: string; stderr: string }> {
  try {
    const result = await execFileAsync(command, args, {
      cwd: options.cwd,
      timeout: 60_000,
      windowsHide: true,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      maxBuffer: 4 * 1024 * 1024,
      signal: options.signal,
      encoding: 'buffer'
    } as any);
    return { stdout: decodeCompilerOutput(result.stdout), stderr: decodeCompilerOutput(result.stderr) };
  } catch (error: any) {
    error.stdout = decodeCompilerOutput(error.stdout);
    error.stderr = decodeCompilerOutput(error.stderr);
    throw error;
  }
}
