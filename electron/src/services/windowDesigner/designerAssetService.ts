import fs from 'node:fs/promises';
import path from 'node:path';
import type { LingBuilderSolutionProject } from '../solution/solutionService';
import type { TextFileSnapshot } from '../files/types';
import type { LingWindowProject } from './types';
import {
  EMBEDDED_RESOURCE_MAX_FILE_BYTES,
  isEmbeddableResourceSourceFile,
  isEmbeddedResourceLogicalName
} from './embeddedResourceService';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tif', '.tiff', '.ico']);
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;
const MAX_ANIMATION_BYTES = 200 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(['.mp4', '.wmv', '.avi', '.mov', '.m4v']);
const MAX_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * 内嵌资源在项目源码根下的默认导入目录。
 * 注意与 embeddedResourceService 的 EMBEDDED_RESOURCE_DIRECTORY 区分：那个是构建目录内的 rc 归档目录，
 * 这里是项目源码里的源文件目录（默认 <项目源码根>/resources/）。
 */
export const EMBEDDED_RESOURCE_SOURCE_DIRECTORY = 'resources';
/** 一次「选择文件…」最多导入的文件数，避免误选整屏文件。 */
export const EMBEDDED_RESOURCE_IMPORT_FILE_LIMIT = 64;
/** 一次「选择文件夹…」递归展开的文件数上限（与内嵌站点扫描同口径）。 */
export const EMBEDDED_RESOURCE_IMPORT_FOLDER_FILE_LIMIT = 512;

export interface ImportedDesignerImage {
  relativePath: string;
  fileName: string;
  size: number;
}

/** 已复制进项目、可直接写回 embeddedResources 的一条内嵌资源。 */
export interface ImportedEmbeddedResource {
  /** 逻辑名（默认 = 相对源码根的项目内相对路径，如 resources/logo.png）。 */
  name: string;
  /** 工作区内相对源路径（如 src/resources/logo.png）。 */
  file: string;
  size: number;
}

export interface EmbeddedResourceImportResult {
  entries: ImportedEmbeddedResource[];
  /** 被跳过的文件与中文原因（超限、无扩展名、名字不合法等）。 */
  skipped: Array<{ path: string; reason: string }>;
  /** 需要提示用户的非阻断说明（重命名、同名合并等）。 */
  notes: string[];
  totalBytes: number;
}

export class DesignerAssetService {
  constructor(private readonly workspaceRoot: string) {}

  getProjectAssetRoot(project: LingBuilderSolutionProject): string {
    return project.isDefault ? 'assets' : path.posix.join('assets', safeSegment(project.id));
  }

  async importImage(project: LingBuilderSolutionProject, sourcePath: string): Promise<ImportedDesignerImage> {
    const source = await fs.realpath(String(sourcePath || ''));
    const sourceStat = await fs.stat(source);
    if (!sourceStat.isFile()) throw new Error('选择的图片源不是普通文件。');
    if (sourceStat.size > MAX_IMAGE_BYTES) throw new Error('图片文件超过 50MB 限制。');

    const extension = path.extname(source).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      throw new Error('仅支持 PNG、JPEG、BMP、GIF、TIFF 和 ICO 图片。');
    }

    const assetRoot = this.getProjectAssetRoot(project);
    const assetDirectory = this.resolveWorkspacePath(assetRoot);
    await fs.mkdir(assetDirectory, { recursive: true });

    const parsed = path.parse(source);
    const baseName = sanitizeFileBase(parsed.name) || 'image';
    let fileName = `${baseName}${extension}`;
    let target = path.join(assetDirectory, fileName);
    let suffix = 2;
    while (await exists(target)) {
      if (await filesEqual(source, target)) {
        return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
      }
      fileName = `${baseName}-${suffix}${extension}`;
      target = path.join(assetDirectory, fileName);
      suffix += 1;
    }

    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
  }

  async importAnimation(project: LingBuilderSolutionProject, sourcePath: string): Promise<ImportedDesignerImage> {
    const source = await fs.realpath(String(sourcePath || ''));
    const sourceStat = await fs.stat(source);
    if (!sourceStat.isFile()) throw new Error('选择的动画源不是普通文件。');
    if (sourceStat.size > MAX_ANIMATION_BYTES) throw new Error('AVI 动画文件超过 200MB 限制。');

    const extension = path.extname(source).toLowerCase();
    if (extension !== '.avi') throw new Error('动画控件当前仅支持 AVI 文件。');

    const assetRoot = this.getProjectAssetRoot(project);
    const assetDirectory = this.resolveWorkspacePath(assetRoot);
    await fs.mkdir(assetDirectory, { recursive: true });

    const parsed = path.parse(source);
    const baseName = sanitizeFileBase(parsed.name) || 'animation';
    let fileName = `${baseName}${extension}`;
    let target = path.join(assetDirectory, fileName);
    let suffix = 2;
    while (await exists(target)) {
      if (await filesEqual(source, target)) {
        return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
      }
      fileName = `${baseName}-${suffix}${extension}`;
      target = path.join(assetDirectory, fileName);
      suffix += 1;
    }

    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
  }

  async importVideo(project: LingBuilderSolutionProject, sourcePath: string): Promise<ImportedDesignerImage> {
    const source = await fs.realpath(String(sourcePath || ''));
    const sourceStat = await fs.stat(source);
    if (!sourceStat.isFile()) throw new Error('选择的视频源不是普通文件。');
    if (sourceStat.size > MAX_VIDEO_BYTES) throw new Error('视频文件超过 2GB 限制。');

    const extension = path.extname(source).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(extension)) throw new Error('仅支持 MP4、WMV、AVI、MOV 和 M4V 视频。');

    const assetRoot = this.getProjectAssetRoot(project);
    const assetDirectory = this.resolveWorkspacePath(assetRoot);
    await fs.mkdir(assetDirectory, { recursive: true });

    const parsed = path.parse(source);
    const baseName = sanitizeFileBase(parsed.name) || 'video';
    let fileName = `${baseName}${extension}`;
    let target = path.join(assetDirectory, fileName);
    let suffix = 2;
    while (await exists(target)) {
      if (await filesEqual(source, target)) {
        return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
      }
      fileName = `${baseName}-${suffix}${extension}`;
      target = path.join(assetDirectory, fileName);
      suffix += 1;
    }

    await fs.copyFile(source, target, fs.constants.COPYFILE_EXCL);
    return { relativePath: path.posix.join(assetRoot, fileName), fileName, size: sourceStat.size };
  }

  /**
   * 「选择文件…」：把任意本机文件复制进 <项目源码根>/resources/（重名自动去冲突）并回到可写回
   * embeddedResources 的逻辑名。逻辑名相对源码根，因此与设计器模型里声明的逻辑名口径一致。
   */
  async importEmbeddedResourceFiles(
    project: LingBuilderSolutionProject,
    sourcePaths: readonly string[]
  ): Promise<EmbeddedResourceImportResult> {
    const requested = [...new Set((sourcePaths || []).map(item => String(item || '').trim()).filter(Boolean))];
    if (requested.length === 0) throw new Error('没有选择任何文件。');
    if (requested.length > EMBEDDED_RESOURCE_IMPORT_FILE_LIMIT) {
      throw new Error(`一次最多导入 ${EMBEDDED_RESOURCE_IMPORT_FILE_LIMIT} 个文件（当前选择了 ${requested.length} 个）。`);
    }
    const result = createEmptyEmbeddedImportResult();
    const projectRoot = this.getProjectResourceRoot(project);
    // 同一批里后出现的同名文件按去冲突规则改名，而不是静默覆盖。
    const reserved = new Set<string>();
    for (const requestedPath of requested) {
      const absolute = await this.resolveImportSourceFile(requestedPath);
      const stat = await fs.stat(absolute);
      const reason = validateEmbeddableSource(path.basename(absolute), stat.size);
      if (reason) {
        result.skipped.push({ path: requestedPath, reason });
        continue;
      }
      const extension = path.extname(absolute);
      const baseName = sanitizeEmbeddedResourceSegment(path.parse(absolute).name);
      const target = await this.copyIntoProject({
        source: absolute,
        projectRoot,
        directorySegments: [],
        baseName,
        extension,
        reserved,
        result
      });
      if (!target) continue;
      if (target.fileName.replace(/\\/gu, '/') !== path.basename(absolute)) {
        result.notes.push(`已重命名：${path.basename(absolute)} → ${target.fileName}`);
      }
      result.entries.push({
        name: path.posix.join(EMBEDDED_RESOURCE_SOURCE_DIRECTORY, target.fileName),
        file: target.relativePath,
        size: stat.size
      });
      result.totalBytes += stat.size;
    }
    return result;
  }

  /**
   * 「选择文件夹…」：递归展开文件夹（≤512 个文件、跳过符号链接），按目录结构复制进
   * <项目源码根>/resources/<文件夹名>/…，逻辑名保留文件夹内的相对路径。
   */
  async importEmbeddedResourceFolder(
    project: LingBuilderSolutionProject,
    requestedDirectory: string
  ): Promise<EmbeddedResourceImportResult> {
    const absolute = await this.resolveImportSourceDirectory(requestedDirectory);
    const folderName = sanitizeEmbeddedResourceSegment(path.basename(absolute));
    const files = await collectImportFiles(absolute);
    const result = createEmptyEmbeddedImportResult();
    if (files.length === 0) throw new Error('选择的文件夹里没有文件。');
    if (files.length > EMBEDDED_RESOURCE_IMPORT_FOLDER_FILE_LIMIT) {
      throw new Error(`文件夹里的文件超过上限（最多 ${EMBEDDED_RESOURCE_IMPORT_FOLDER_FILE_LIMIT} 个，当前 ${files.length} 个）；请分次导入。`);
    }
    const projectRoot = this.getProjectResourceRoot(project);
    const reserved = new Set<string>();
    for (const relativeFile of files) {
      const absoluteFile = path.join(absolute, relativeFile.split('/').join(path.sep));
      const stat = await fs.stat(absoluteFile).catch(() => null);
      if (!stat || !stat.isFile()) continue;
      const displayPath = `${path.basename(absolute)}/${relativeFile}`;
      const reason = validateEmbeddableSource(displayPath, stat.size);
      if (reason) {
        result.skipped.push({ path: displayPath, reason });
        continue;
      }
      const segments = relativeFile.split('/');
      const target = await this.copyIntoProject({
        source: absoluteFile,
        projectRoot,
        directorySegments: [folderName, ...segments.slice(0, -1).map(segment => sanitizeEmbeddedResourceSegment(segment))],
        baseName: sanitizeEmbeddedResourceSegment(path.parse(segments.at(-1) || '').name),
        extension: path.extname(relativeFile),
        reserved,
        result
      });
      if (!target) continue;
      const fileName = target.fileName.replace(/\\/gu, '/');
      if (fileName !== `${folderName}/${relativeFile}`) {
        result.notes.push(`已重命名：${folderName}/${relativeFile} → ${fileName}`);
      }
      result.entries.push({
        name: path.posix.join(EMBEDDED_RESOURCE_SOURCE_DIRECTORY, fileName),
        file: target.relativePath,
        size: stat.size
      });
      result.totalBytes += stat.size;
    }
    return result;
  }

  /**
   * 「扫描目录…」：递归列出工作区内一个目录里可直接内嵌的文件（工作区相对路径）。
   * 只读，不复制；逻辑名直接取工作区相对路径原样，因此不受源码根影响。
   */
  async scanEmbeddedResourceDirectory(directory: string): Promise<{ files: string[]; skipped: Array<{ path: string; reason: string }> }> {
    const normalized = normalizeRelativePath(String(directory || ''));
    const root = path.resolve(this.workspaceRoot);
    const target = this.resolveWorkspacePath(normalized);
    const stat = await fs.stat(target).catch(() => null);
    if (!stat || !stat.isDirectory()) throw new Error(`目录不存在：${normalized}`);
    const collected: string[] = [];
    await collectWorkspaceFiles(root, target, collected);
    const files: string[] = [];
    const skipped: Array<{ path: string; reason: string }> = [];
    for (const file of collected.sort((left, right) => left.localeCompare(right))) {
      const stat = await fs.stat(this.resolveWorkspacePath(file)).catch(() => null);
      if (!stat?.isFile()) continue;
      const reason = validateEmbeddableSource(file, stat.size);
      if (reason) {
        skipped.push({ path: file, reason });
        continue;
      }
      if (!isEmbeddedResourceLogicalName(file)) {
        skipped.push({ path: file, reason: '逻辑名包含不支持的字符，请先重命名文件' });
        continue;
      }
      files.push(file);
    }
    return { files, skipped };
  }

  /** 项目源码根下的内嵌资源目录（工作区相对路径，如 src/resources）。 */
  getProjectResourceRoot(project: LingBuilderSolutionProject): string {
    const sourceRoot = String(project.sourceRoot || '').trim().replace(/\\/gu, '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
    return sourceRoot && sourceRoot !== '.' ? path.posix.join(sourceRoot, EMBEDDED_RESOURCE_SOURCE_DIRECTORY) : EMBEDDED_RESOURCE_SOURCE_DIRECTORY;
  }

  private async resolveImportSourceFile(requestedPath: string): Promise<string> {
    const raw = String(requestedPath || '').trim();
    if (!raw) throw new Error('内嵌资源源文件路径为空。');
    const absolute = await fs.realpath(path.resolve(raw)).catch(() => '');
    if (!absolute) throw new Error(`内嵌资源源文件不存在：${raw}`);
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) throw new Error(`内嵌资源源文件不是普通文件：${raw}`);
    return absolute;
  }

  private async resolveImportSourceDirectory(requestedPath: string): Promise<string> {
    const raw = String(requestedPath || '').trim();
    if (!raw) throw new Error('内嵌资源文件夹路径为空。');
    const absolute = await fs.realpath(path.resolve(raw)).catch(() => '');
    if (!absolute) throw new Error(`内嵌资源文件夹不存在：${raw}`);
    if (path.resolve(absolute) === path.resolve(this.workspaceRoot)) {
      throw new Error('不允许把整个工作区目录导入为内嵌资源；请选择具体子目录。');
    }
    const stat = await fs.stat(absolute);
    if (!stat.isDirectory()) throw new Error(`内嵌资源文件夹不是目录：${raw}`);
    return absolute;
  }

  /**
   * 复制到项目内：目标已存在且内容一致时复用，否则追加 -2、-3… 后缀（不覆盖用户已有文件）。
   * 返回工作区内相对路径与最终文件名（相对 projectRoot，正斜杠）。
   */
  private async copyIntoProject(options: {
    source: string;
    projectRoot: string;
    directorySegments: string[];
    baseName: string;
    extension: string;
    reserved: Set<string>;
    result: EmbeddedResourceImportResult;
  }): Promise<{ relativePath: string; fileName: string } | undefined> {
    const { source, projectRoot, directorySegments, baseName, extension, reserved, result } = options;
    const root = this.resolveWorkspacePath(projectRoot);
    const targetDirectory = path.join(root, ...directorySegments);
    if (!isWithin(path.resolve(this.workspaceRoot), targetDirectory)) throw new Error('内嵌资源复制目标越出工作区。');
    await fs.mkdir(targetDirectory, { recursive: true });
    // 返回的 fileName 相对 projectRoot（调用方再拼 projectRoot 得到逻辑名）。
    const relativeFileNameOf = (fileName: string) => path.posix.join(...directorySegments, fileName);
    for (let suffix = 1; suffix <= 200; suffix += 1) {
      const fileName = suffix === 1 ? `${baseName}${extension}` : `${baseName}-${suffix}${extension}`;
      const logicalName = relativeFileNameOf(fileName);
      // 兜底守卫：任何情况下都不能把生成器无法表示的逻辑名写回项目。
      if (!isEmbeddedResourceLogicalName(logicalName)) {
        result.skipped.push({ path: `${baseName}${extension}`, reason: '无法生成合法的内嵌资源逻辑名' });
        return undefined;
      }
      const candidate = path.join(targetDirectory, fileName);
      if (!reserved.has(relativeFileNameOf(fileName).toLowerCase())) {
        const existing = await fs.stat(candidate).catch(() => null);
        if (!existing) {
          await fs.copyFile(source, candidate);
          reserved.add(relativeFileNameOf(fileName).toLowerCase());
          return { relativePath: workspaceRelativePath(this.workspaceRoot, candidate), fileName: relativeFileNameOf(fileName) };
        }
        if (existing.isFile() && await filesEqual(source, candidate)) {
          reserved.add(relativeFileNameOf(fileName).toLowerCase());
          return { relativePath: workspaceRelativePath(this.workspaceRoot, candidate), fileName: relativeFileNameOf(fileName) };
        }
      }
    }
    result.skipped.push({ path: baseName, reason: '同名文件过多，无法自动去冲突，请先手工改名' });
    return undefined;
  }

  async readImage(project: LingBuilderSolutionProject, relativePath: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const resolved = await this.resolveProjectImage(project, relativePath);
    return { bytes: await fs.readFile(resolved), mimeType: imageMimeType(resolved) };
  }

  /**
   * 删除项目 assets 目录中的一张图片资源。
   * 复用 resolveProjectImage 的全部校验（归属项目 assets 根、扩展名、工作区边界、普通文件），
   * 文件缺失等异常统一转成中文诊断；调用方负责先做引用扫描与用户确认。
   */
  async deleteProjectImage(project: LingBuilderSolutionProject, relativePath: string): Promise<void> {
    let target: string;
    try {
      target = await this.resolveProjectImage(project, relativePath);
    } catch (error) {
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('图片资源不存在或已被删除。');
      }
      throw error;
    }
    await fs.rm(target, { force: true });
  }

  async listProjectImages(project: LingBuilderSolutionProject): Promise<ImportedDesignerImage[]> {
    const assetRoot = this.getProjectAssetRoot(project);
    const sourceRoot = this.resolveWorkspacePath(assetRoot);
    if (!await exists(sourceRoot)) return [];
    const files = await collectFiles(sourceRoot);
    const images = await Promise.all(files
      .filter(file => IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()))
      .map(async file => {
        const stat = await fs.stat(file);
        const relativeWithinAssets = path.relative(sourceRoot, file).replace(/\\/gu, '/');
        return {
          relativePath: path.posix.join(assetRoot, relativeWithinAssets),
          fileName: path.basename(file),
          size: stat.size
        };
      }));
    return images.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'zh-CN'));
  }

  async copyProjectAssets(project: LingBuilderSolutionProject, destinationRoots: string[]): Promise<string[]> {
    const assetRoot = this.getProjectAssetRoot(project);
    const sourceRoot = this.resolveWorkspacePath(assetRoot);
    if (!await exists(sourceRoot)) return [];

    const files = await collectFiles(sourceRoot);
    const copied: string[] = [];
    for (const source of files) {
      const relativeWithinAssets = path.relative(sourceRoot, source);
      const workspaceRelativePath = path.join(assetRoot, relativeWithinAssets);
      for (const destinationRoot of destinationRoots) {
        const destination = path.resolve(destinationRoot, workspaceRelativePath);
        const resolvedDestinationRoot = path.resolve(destinationRoot);
        if (!isWithin(resolvedDestinationRoot, destination)) throw new Error('图片资源复制目标越界。');
        await fs.mkdir(path.dirname(destination), { recursive: true });
        await fs.copyFile(source, destination);
        copied.push(destination);
      }
    }
    return copied;
  }

  private async resolveProjectImage(project: LingBuilderSolutionProject, requestedPath: string): Promise<string> {
    const normalized = normalizeRelativePath(requestedPath);
    const assetRoot = this.getProjectAssetRoot(project);
    if (normalized !== assetRoot && !normalized.startsWith(`${assetRoot}/`)) {
      throw new Error('图片路径不属于当前项目 assets 目录。');
    }
    if (!IMAGE_EXTENSIONS.has(path.posix.extname(normalized).toLowerCase())) throw new Error('不支持的图片文件类型。');

    const target = this.resolveWorkspacePath(normalized);
    const [realWorkspace, realTarget] = await Promise.all([fs.realpath(this.workspaceRoot), fs.realpath(target)]);
    if (!isWithin(realWorkspace, realTarget)) throw new Error('图片路径越过工作区。');
    const stat = await fs.stat(realTarget);
    if (!stat.isFile()) throw new Error('图片资源不存在或不是普通文件。');
    return realTarget;
  }

  private resolveWorkspacePath(relativePath: string): string {
    const root = path.resolve(this.workspaceRoot);
    const target = path.resolve(root, relativePath);
    if (!isWithin(root, target)) throw new Error('图片资源路径越过工作区。');
    return target;
  }
}

/** 一处图片资源引用：designer = 窗口设计器模型；source = 项目源码文件。 */
export interface DesignerImageReferenceHit {
  source: 'designer' | 'source';
  /** 中文位置描述，如「窗口「主窗口」的控件「图片框1」」或「src/Main.lcpp:12」。 */
  location: string;
  /** 命中明细：图标路径、属性名或源码行文本（已截断）。 */
  detail: string;
}

export interface DesignerImageReferenceScan {
  hits: DesignerImageReferenceHit[];
  /** 超出展示上限、未逐条列出的引用条数。 */
  truncated: number;
}

const DESIGNER_IMAGE_REFERENCE_LIMIT = 50;

/**
 * 删除前引用扫描：在窗口设计器模型（图标、控件内容与属性）和项目源码快照中
 * 查找指向该 assets 相对路径的引用。匹配大小写不敏感，正斜杠与反斜杠写法等价；
 * 源码文件清单必须来自 SolutionService.readProjectFileSnapshots（项目归属隔离出口）。
 */
export function findDesignerImageReferences(options: {
  designerProject?: LingWindowProject | null;
  sourceFiles: Record<string, TextFileSnapshot>;
  relativePath: string;
}): DesignerImageReferenceScan {
  const forward = String(options.relativePath || '').trim().replace(/\\/gu, '/');
  if (!forward) return { hits: [], truncated: 0 };
  const backward = forward.includes('/') ? forward.replace(/\//gu, '\\') : forward;
  const lowerForward = forward.toLowerCase();
  const lowerBackward = backward.toLowerCase();
  const matchesReference = (text: string) => {
    const lowered = text.toLowerCase();
    return lowered.includes(lowerForward) || lowered.includes(lowerBackward);
  };

  const hits: DesignerImageReferenceHit[] = [];
  let truncated = 0;
  const push = (hit: DesignerImageReferenceHit) => {
    if (hits.length >= DESIGNER_IMAGE_REFERENCE_LIMIT) {
      truncated += 1;
      return;
    }
    hits.push(hit);
  };

  const designer = options.designerProject;
  if (designer) {
    for (const window of designer.windows) {
      const windowLabel = `窗口「${window.title || window.className}」`;
      if (window.iconPath && matchesReference(window.iconPath)) {
        push({ source: 'designer', location: `${windowLabel}的图标`, detail: window.iconPath });
      }
      for (const control of window.controls || []) {
        if (!matchesReference(JSON.stringify(control))) continue;
        if (matchesReference(control.content || '')) {
          push({ source: 'designer', location: `${windowLabel}的控件「${control.name}」`, detail: `控件内容 ${control.content}` });
          continue;
        }
        const matchedProperties = Object.entries(control.properties || {})
          .filter(([, value]) => matchesReference(JSON.stringify(value)))
          .map(([key]) => key);
        push({
          source: 'designer',
          location: `${windowLabel}的控件「${control.name}」`,
          detail: matchedProperties.length ? `属性 ${matchedProperties.join('、')}` : ''
        });
      }
    }
  }

  for (const [filePath, snapshot] of Object.entries(options.sourceFiles)) {
    if (!snapshot?.content) continue;
    const lines = snapshot.content.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index += 1) {
      if (!matchesReference(lines[index])) continue;
      push({
        source: 'source',
        location: `${filePath}:${index + 1}`,
        detail: lines[index].trim().slice(0, 160)
      });
    }
  }

  return { hits, truncated };
}

export function createDesignerAssetService(workspaceRoot: string): DesignerAssetService {
  return new DesignerAssetService(workspaceRoot);
}

function normalizeRelativePath(value: string): string {
  const normalized = String(value || '').replace(/\\/gu, '/').replace(/^\.\//u, '');
  if (!normalized || path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/u.test(normalized) || normalized.split('/').includes('..')) {
    throw new Error('图片资源必须使用工作区内的相对路径。');
  }
  return normalized;
}

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function safeSegment(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'project';
}

function sanitizeFileBase(value: string): string {
  return value.replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, '-').replace(/[. ]+$/gu, '').slice(0, 120);
}

function imageMimeType(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.bmp': return 'image/bmp';
    case '.gif': return 'image/gif';
    case '.tif':
    case '.tiff': return 'image/tiff';
    case '.ico': return 'image/x-icon';
    default: return 'application/octet-stream';
  }
}

function createEmptyEmbeddedImportResult(): EmbeddedResourceImportResult {
  return { entries: [], skipped: [], notes: [], totalBytes: 0 };
}

/** 单个文件能否作为内嵌资源：必须有扩展名、大小在单文件上限内（size 省略时只查扩展名）。 */
function validateEmbeddableSource(displayPath: string, size?: number): string {
  const normalized = displayPath.replace(/\\/gu, '/');
  if (!isEmbeddableResourceSourceFile(normalized)) return '没有扩展名，无法作为内嵌资源（rc 需要按扩展名归档）';
  if (size !== undefined && size > EMBEDDED_RESOURCE_MAX_FILE_BYTES) {
    return `超过单文件上限 ${Math.floor(EMBEDDED_RESOURCE_MAX_FILE_BYTES / 1024 / 1024)}MB`;
  }
  return '';
}

/**
 * 逻辑名片段归一化：只保留内嵌资源逻辑名允许的字符（与服务端/生成器同一份字符集），
 * 非法字符替换成连字符，因此源文件叫什么都能导入；发生改写时会作为说明回给用户。
 */
function sanitizeEmbeddedResourceSegment(value: string): string {
  const cleaned = String(value || '')
    .replace(/[^\p{L}\p{N}_$@()\[\] {}#+.,-]+/gu, '-')
    .replace(/^[. ]+|[. ]+$/gu, '')
    .slice(0, 120);
  return cleaned || 'file';
}

/** 递归展开待导入文件夹（≤512 个文件，跳过符号链接），返回文件夹内相对路径（正斜杠）。 */
async function collectImportFiles(directory: string, limit = EMBEDDED_RESOURCE_IMPORT_FOLDER_FILE_LIMIT): Promise<string[]> {
  const files: string[] = [];
  const walk = async (current: string, prefix: string): Promise<void> => {
    if (files.length > limit) return;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(current, entry.name), relative);
      } else if (entry.isFile()) {
        files.push(relative);
        if (files.length > limit) return;
      }
    }
  };
  await walk(directory, '');
  return files.sort((left, right) => left.localeCompare(right));
}

/** 只读扫描工作区内目录（≤512 个文件，跳过符号链接），返回工作区相对路径。 */
async function collectWorkspaceFiles(root: string, directory: string, result: string[], limit = EMBEDDED_RESOURCE_IMPORT_FOLDER_FILE_LIMIT): Promise<void> {
  if (result.length >= limit) return;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await collectWorkspaceFiles(root, absolute, result, limit);
    } else if (entry.isFile()) {
      result.push(workspaceRelativePath(root, absolute));
      if (result.length >= limit) return;
    }
  }
}

function workspaceRelativePath(root: string, absolute: string): string {
  return path.relative(path.resolve(root), path.resolve(absolute)).replace(/\\/gu, '/');
}

async function collectFiles(directory: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error(`图片资源目录包含不允许的符号链接：${entry.name}`);
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await collectFiles(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

async function filesEqual(left: string, right: string): Promise<boolean> {
  const [leftStat, rightStat] = await Promise.all([fs.stat(left), fs.stat(right)]);
  if (leftStat.size !== rightStat.size) return false;
  const [leftBytes, rightBytes] = await Promise.all([fs.readFile(left), fs.readFile(right)]);
  return leftBytes.equals(rightBytes);
}

async function exists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
