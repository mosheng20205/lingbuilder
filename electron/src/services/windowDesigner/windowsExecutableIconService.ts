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
export const WINDOWS_EXECUTABLE_EMBEDDED_RESOURCE_ID_BASE = 2001;
const WINDOWS_EXECUTABLE_EMBEDDED_FILE_LIMIT = 8;
export const WINDOWS_EMBEDDED_SITE_RESOURCE_ID_BASE = 2101;
export const WINDOWS_EMBEDDED_SITE_FILE_LIMIT = 64;
export const WINDOWS_EMBEDDED_SITE_DEFAULT_HOST = 'embedded.local';
export const WINDOWS_EMBEDDED_SITE_DEFAULT_ENTRY = 'index.html';
export const WINDOWS_EMBEDDED_SITE_MAX_FILE_BYTES = 32 * 1024 * 1024;

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

export interface WindowsEmbeddedResourceSpec {
  /** RC 资源 ID（从 2001 起按声明顺序分配）。 */
  resourceId: number;
  /** 工作区内相对源路径（已校验）。 */
  sourceFile: string;
  /** 释放到临时目录后的文件名。 */
  extractName: string;
  /** 物化到构建/导出目录的资源文件（相对目录根）。 */
  resourceFileName: string;
}

export function getWindowEmbeddedResourceSpecs(window: LingWindowModel): WindowsEmbeddedResourceSpec[] {
  const specs = window.embeddedFiles || [];
  if (specs.length > WINDOWS_EXECUTABLE_EMBEDDED_FILE_LIMIT) {
    throw new Error(`内嵌文件数量超过上限（最多 ${WINDOWS_EXECUTABLE_EMBEDDED_FILE_LIMIT} 个）。`);
  }
  return specs.map((spec, index) => {
    const normalized = (spec.file || '').trim().replace(/\\/gu, '/');
    if (!normalized) throw new Error('内嵌文件路径为空。');
    if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(normalized) || normalized.split('/').includes('..') || /["\u0000-\u001f]/u.test(normalized)) {
      throw new Error(`内嵌文件路径不安全：${spec.file}`);
    }
    const baseName = normalized.split('/').pop() || '';
    const extractName = (spec.extractName || baseName).trim();
    if (!/^[A-Za-z0-9._-]{1,128}$/u.test(extractName) || extractName.startsWith('.')) {
      throw new Error(`内嵌文件释放名不合法（仅限字母、数字、点、下划线、连字符）：${extractName}`);
    }
    return {
      resourceId: WINDOWS_EXECUTABLE_EMBEDDED_RESOURCE_ID_BASE + index,
      sourceFile: normalized,
      extractName,
      resourceFileName: `resources/lingbuilder-embedded-${index + 1}.bin`
    };
  });
}

export interface WindowsEmbeddedSiteResourceSpec {
  /** RC 资源 ID（从 2101 起按 entry 目录内相对路径排序分配）。 */
  resourceId: number;
  /** 站点内请求路径（entry 所在目录的相对路径，正斜杠，如 assets/index.js）。 */
  sitePath: string;
  /** 工作区内相对源路径（已校验）。 */
  sourceFile: string;
  /** 物化到构建/导出目录的资源文件（相对目录根）。 */
  resourceFileName: string;
  /** 响应 Content-Type（含字符集）。 */
  contentType: string;
}

/** 按扩展名推断内嵌站点响应 Content-Type；未识别扩展名回退二进制流。 */
export function getEmbeddedSiteContentType(sitePath: string): string {
  const extension = (sitePath.split('/').pop() || '').split('.').pop()?.toLowerCase() || '';
  const table: Record<string, string> = {
    html: 'text/html; charset=utf-8',
    htm: 'text/html; charset=utf-8',
    js: 'text/javascript; charset=utf-8',
    mjs: 'text/javascript; charset=utf-8',
    css: 'text/css; charset=utf-8',
    json: 'application/json',
    map: 'application/json',
    svg: 'image/svg+xml',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    avif: 'image/avif',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
    otf: 'font/otf',
    eot: 'application/vnd.ms-fontobject',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    txt: 'text/plain; charset=utf-8',
    xml: 'application/xml',
    wasm: 'application/wasm'
  };
  return table[extension] || 'application/octet-stream';
}

/**
 * 解析窗口内嵌站点模型为 RCDATA 资源清单。纯模型校验（不读文件系统）：
 * 全部文件必须位于 entry 所在目录内，路径安全、去重后不超过 64 个。
 */
export function getWindowEmbeddedSiteResourceSpecs(window: LingWindowModel): WindowsEmbeddedSiteResourceSpec[] {
  const site = window.embeddedSite;
  if (!site) return [];
  const files = (site.files || []).map(file => String(file ?? '').trim().replace(/\\/gu, '/'));
  if (files.length === 0) throw new Error(`窗口“${window.title}”的内嵌站点文件清单为空。`);
  if (files.length > WINDOWS_EMBEDDED_SITE_FILE_LIMIT) {
    throw new Error(`内嵌站点文件数量超过上限（最多 ${WINDOWS_EMBEDDED_SITE_FILE_LIMIT} 个）：${files.length} 个。`);
  }
  const entryCandidate = (site.entry || '').trim().replace(/\\/gu, '/');
  // 缺省入口：优先根 index.html，其次任意目录下的 index.html，再退回清单第一个文件。
  const entry = entryCandidate
    || files.find(file => file === WINDOWS_EMBEDDED_SITE_DEFAULT_ENTRY)
    || files.find(file => file.endsWith(`/${WINDOWS_EMBEDDED_SITE_DEFAULT_ENTRY}`))
    || files[0];
  const host = (site.host || WINDOWS_EMBEDDED_SITE_DEFAULT_HOST).trim().toLowerCase();
  if (!/^[a-z0-9.-]{1,128}$/u.test(host) || host.startsWith('.') || host.endsWith('.') || host.includes('..')) {
    throw new Error(`内嵌站点主机名不合法（仅限字母、数字、点、连字符）：${site.host || ''}`);
  }
  const entryIndex = files.indexOf(entry);
  if (entryIndex < 0) throw new Error(`内嵌站点入口文件 ${entry} 不在文件清单内。`);
  const entryDirectory = entry.includes('/') ? entry.slice(0, entry.lastIndexOf('/') + 1) : '';
  const seen = new Set<string>();
  const normalizedFiles: string[] = [];
  for (const file of files) {
    if (!file) throw new Error(`窗口“${window.title}”的内嵌站点文件清单包含空路径。`);
    if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(file) || file.split('/').includes('..') || /["\u0000-\u001f]/u.test(file)) {
      throw new Error(`内嵌站点文件路径不安全：${file}`);
    }
    if (!entryDirectory || (file.startsWith(entryDirectory) && file !== entryDirectory.slice(0, -1))) {
      if (seen.has(file)) throw new Error(`内嵌站点文件清单包含重复路径：${file}`);
      seen.add(file);
      normalizedFiles.push(file);
      continue;
    }
    throw new Error(`内嵌站点文件 ${file} 必须位于入口文件 ${entry} 所在目录内。`);
  }
  normalizedFiles.sort((left, right) => (left === entry ? -1 : right === entry ? 1 : left.localeCompare(right)));
  return normalizedFiles.map((file, index) => {
    const sitePath = entryDirectory && file.startsWith(entryDirectory) ? file.slice(entryDirectory.length) : file;
    return {
      resourceId: WINDOWS_EMBEDDED_SITE_RESOURCE_ID_BASE + index,
      sitePath,
      sourceFile: file,
      resourceFileName: `resources/lbsite-${index + 1}.bin`,
      contentType: getEmbeddedSiteContentType(file)
    };
  });
}

export function getWindowEmbeddedSiteHost(window: LingWindowModel): string {
  return (window.embeddedSite?.host || WINDOWS_EMBEDDED_SITE_DEFAULT_HOST).trim().toLowerCase();
}

export function generateWindowsExecutableResourceFile(window: LingWindowModel): { relativePath: string; content: string } | undefined {
  const iconStyle = window.iconStyle || 'lingbuilder';
  const iconEnabled = iconStyle === 'lingbuilder' || (iconStyle === 'custom' && Boolean(getSafeCustomWindowIconPath(window)));
  const embeddedSpecs = iconEnabled ? getWindowEmbeddedResourceSpecs(window) : [];
  const siteSpecs = getWindowEmbeddedSiteResourceSpecs(window);
  if (!iconEnabled && siteSpecs.length === 0) return undefined;
  const lines: string[] = [];
  if (iconEnabled) {
    lines.push(
      '#pragma code_page(65001)',
      '#define IDI_LINGBUILDER_APP 101',
      `IDI_LINGBUILDER_APP ICON "${WINDOWS_EXECUTABLE_ICON_FILE}"`
    );
  }
  for (const embedded of embeddedSpecs) {
    lines.push(`#define ID_RCDATA_LINGBUILDER_EMBEDDED_${embedded.resourceId} ${embedded.resourceId}`);
    lines.push(`ID_RCDATA_LINGBUILDER_EMBEDDED_${embedded.resourceId} RCDATA "${embedded.resourceFileName}"`);
  }
  for (const site of siteSpecs) {
    lines.push(`#define ID_RCDATA_LINGBUILDER_SITE_${site.resourceId} ${site.resourceId}`);
    lines.push(`ID_RCDATA_LINGBUILDER_SITE_${site.resourceId} RCDATA "${site.resourceFileName}"`);
  }
  lines.push('');
  return {
    relativePath: WINDOWS_EXECUTABLE_RESOURCE_FILE,
    content: lines.join('\n')
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
    const iconStyle = window.iconStyle || 'lingbuilder';
    const iconEnabled = iconStyle === 'lingbuilder' || (iconStyle === 'custom' && Boolean(getSafeCustomWindowIconPath(window)));
    const siteSpecs = getWindowEmbeddedSiteResourceSpecs(window);
    if (!resourceFile && siteSpecs.length === 0) {
      await this.removeStaleIcons(destinationRoots);
      return { files: [], fingerprint: 'none', source: 'none' };
    }

    const customIconPath = iconEnabled ? getSafeCustomWindowIconPath(window) : '';
    const source = customIconPath ? 'custom' : iconEnabled ? 'lingbuilder' : 'none';
    const bytes = iconEnabled
      ? (customIconPath
        ? (await this.designerAssetService.readImage(project, customIconPath)).bytes
        : await fs.readFile(await this.resolveBundledIconPath()))
      : Buffer.alloc(0);
    if (iconEnabled) validateIco(bytes, customIconPath || 'LingBuilder 默认窗口图标');

    const embeddedSpecs = iconEnabled ? getWindowEmbeddedResourceSpecs(window) : [];
    const embeddedBytes = await Promise.all(embeddedSpecs.map(async spec => {
      const resolved = this.resolveWorkspacePath(spec.sourceFile);
      const stat = await fs.stat(resolved).catch(() => null);
      if (!stat || !stat.isFile()) throw new Error(`内嵌文件不存在：${spec.sourceFile}`);
      if (stat.size > 32 * 1024 * 1024) throw new Error(`内嵌文件超过 32MB 上限：${spec.sourceFile}`);
      return fs.readFile(resolved);
    }));
    const siteBytes = await Promise.all(siteSpecs.map(async spec => {
      const resolved = this.resolveWorkspacePath(spec.sourceFile);
      const stat = await fs.stat(resolved).catch(() => null);
      if (!stat || !stat.isFile()) throw new Error(`内嵌站点文件不存在：${spec.sourceFile}`);
      if (stat.size > WINDOWS_EMBEDDED_SITE_MAX_FILE_BYTES) {
        throw new Error(`内嵌站点文件超过 32MB 上限：${spec.sourceFile}`);
      }
      return fs.readFile(resolved);
    }));

    const fingerprintInput = Buffer.concat([bytes, ...embeddedBytes, ...siteBytes]);
    const files: string[] = [];
    for (const destinationRoot of [...new Set(destinationRoots.map(root => path.resolve(root)))]) {
      if (iconEnabled) {
        const target = resolveWithin(destinationRoot, WINDOWS_EXECUTABLE_ICON_FILE);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, bytes);
        files.push(target);
      } else {
        await this.removeStaleIcons([destinationRoot]);
      }
      for (let index = 0; index < embeddedSpecs.length; index += 1) {
        const embeddedTarget = resolveWithin(destinationRoot, embeddedSpecs[index].resourceFileName);
        await fs.mkdir(path.dirname(embeddedTarget), { recursive: true });
        await fs.writeFile(embeddedTarget, embeddedBytes[index]);
        files.push(embeddedTarget);
      }
      for (let index = 0; index < siteSpecs.length; index += 1) {
        const siteTarget = resolveWithin(destinationRoot, siteSpecs[index].resourceFileName);
        await fs.mkdir(path.dirname(siteTarget), { recursive: true });
        await fs.writeFile(siteTarget, siteBytes[index]);
        files.push(siteTarget);
      }
    }
    return {
      files,
      fingerprint: crypto.createHash('sha256').update(fingerprintInput).digest('hex'),
      source
    };
  }

  private resolveWorkspacePath(relativePath: string): string {
    const root = path.resolve(this.workspaceRoot);
    const target = path.resolve(root, relativePath);
    const relative = path.relative(root, target);
    if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`内嵌文件路径越出工作区：${relativePath}`);
    }
    return target;
  }

  /**
   * 递归扫描工作区内一个目录，返回内嵌站点可用的工作区相对文件清单（正斜杠、去符号链接、上限 512 个）。
   * 供设计器属性面板「扫描目录」使用；只读，不写任何文件。
   */
  async scanEmbeddedSiteDirectory(requestedDirectory: string): Promise<string[]> {
    const normalized = requestedDirectory.trim().replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '');
    if (!normalized) throw new Error('请填写要扫描的站点目录（工作区相对路径，如 www）。');
    if (/^(?:[a-zA-Z]:\/|\/|\\\\)/u.test(normalized) || normalized.split('/').includes('..') || /["\u0000-\u001f]/u.test(normalized)) {
      throw new Error(`站点目录不安全：${requestedDirectory}`);
    }
    const root = path.resolve(this.workspaceRoot);
    const directory = path.resolve(root, normalized);
    const relativeRoot = path.relative(root, directory);
    if (relativeRoot.startsWith(`..${path.sep}`) || path.isAbsolute(relativeRoot)) {
      throw new Error(`站点目录越出工作区：${requestedDirectory}`);
    }
    const stat = await fs.stat(directory).catch(() => null);
    if (!stat || !stat.isDirectory()) throw new Error(`站点目录不存在：${normalized}`);
    const files: string[] = [];
    const walk = async (current: string): Promise<void> => {
      if (files.length >= 512) return;
      for (const entry of await fs.readdir(current, { withFileTypes: true })) {
        if (entry.isSymbolicLink()) continue;
        const absolute = path.join(current, entry.name);
        if (entry.isDirectory()) {
          await walk(absolute);
        } else if (entry.isFile()) {
          files.push(path.relative(root, absolute).replace(/\\/gu, '/'));
          if (files.length >= 512) return;
        }
      }
    };
    await walk(directory);
    return files.sort((left, right) => left.localeCompare(right));
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
  const rcContent = await fs.readFile(resourcePath, 'utf8').catch(() => '');
  // RCDATA 引用按 rc 文件所在目录解析（与 rc.exe 编译行为一致），而非构建工作目录。
  const rcDirectory = path.dirname(resourcePath);
  const rcReferencedFiles = [...rcContent.matchAll(/RCDATA\s+"([^"]+)"/gu)]
    .map(match => resolveWithin(rcDirectory, match[1]));
  const requiresIcon = /^\s*IDI_[A-Za-z0-9_]+\s+ICON\s+"/mu.test(rcContent);
  const iconPath = resolveWithin(path.resolve(options.cwd), WINDOWS_EXECUTABLE_ICON_FILE);
  try {
    await Promise.all([fs.access(resourcePath), fs.mkdir(options.objDir, { recursive: true }),
      ...(requiresIcon ? [fs.access(iconPath)] : []),
      ...rcReferencedFiles.map(file => fs.access(file))]);
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
