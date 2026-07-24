import fs from 'node:fs/promises';
import path from 'node:path';
import type { LingBuilderSolutionProject } from '../solution/solutionService';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.gif', '.tif', '.tiff']);
const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export interface ImportedDesignerImage {
  relativePath: string;
  fileName: string;
  size: number;
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
      throw new Error('仅支持 PNG、JPEG、BMP、GIF 和 TIFF 图片。');
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

  async readImage(project: LingBuilderSolutionProject, relativePath: string): Promise<{ bytes: Buffer; mimeType: string }> {
    const resolved = await this.resolveProjectImage(project, relativePath);
    return { bytes: await fs.readFile(resolved), mimeType: imageMimeType(resolved) };
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
    default: return 'application/octet-stream';
  }
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
