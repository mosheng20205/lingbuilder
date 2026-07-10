import fs from 'node:fs/promises';
import path from 'node:path';

export type WorkspacePathPolicyErrorCode =
  | 'INVALID_PATH'
  | 'OUTSIDE_WORKSPACE'
  | 'SYMLINK_NOT_ALLOWED';

export class WorkspacePathPolicyError extends Error {
  constructor(
    public readonly code: WorkspacePathPolicyErrorCode,
    message: string,
    public readonly requestedPath?: string
  ) {
    super(message);
    this.name = 'WorkspacePathPolicyError';
  }
}

export interface ResolveExistingPathOptions {
  /** File trees and searches must never traverse a symlink or Windows junction. */
  rejectSymlinks?: boolean;
}

/**
 * Resolves user-controlled paths against one workspace and verifies the final
 * filesystem target.  Lexical containment alone is insufficient because a
 * symlink/junction inside the workspace may point outside it.
 */
export class WorkspacePathPolicy {
  readonly workspaceRoot: string;
  private realWorkspaceRootPromise?: Promise<string>;

  constructor(workspaceRoot: string) {
    if (!workspaceRoot?.trim()) {
      throw new WorkspacePathPolicyError('INVALID_PATH', '缺少 LingBuilder 工作区路径。');
    }
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  async getRealWorkspaceRoot(): Promise<string> {
    this.realWorkspaceRootPromise ||= fs.realpath(this.workspaceRoot).then(value => path.resolve(value));
    return await this.realWorkspaceRootPromise;
  }

  /** Resolve an existing path and verify its real target remains in the workspace. */
  async resolveExisting(
    requestedPath: string,
    options: ResolveExistingPathOptions = {}
  ): Promise<string> {
    const lexicalPath = this.resolveLexically(requestedPath);
    if (options.rejectSymlinks) {
      await this.rejectLinkComponents(lexicalPath, requestedPath, false);
    }
    const [realRoot, realTarget] = await Promise.all([
      this.getRealWorkspaceRoot(),
      fs.realpath(lexicalPath)
    ]);
    this.assertContained(realRoot, realTarget, requestedPath);
    return realTarget;
  }

  /**
   * Resolve a write target. Existing link components (including the target)
   * are rejected, and a new target is anchored to its nearest existing parent.
   */
  async resolveForWrite(requestedPath: string): Promise<string> {
    const lexicalPath = this.resolveLexically(requestedPath);
    const nearestExisting = await this.rejectLinkComponents(lexicalPath, requestedPath, true);
    const [realRoot, realParent] = await Promise.all([
      this.getRealWorkspaceRoot(),
      fs.realpath(nearestExisting)
    ]);
    this.assertContained(realRoot, realParent, requestedPath);
    return lexicalPath;
  }

  /** Resolve an output directory and reject links anywhere in its existing tree. */
  async resolveDirectoryForWrite(requestedPath: string): Promise<string> {
    const targetPath = await this.resolveForWrite(requestedPath);
    try {
      await this.rejectLinksInTree(targetPath, requestedPath);
    } catch (error: any) {
      if (error?.code !== 'ENOENT') throw error;
    }
    return targetPath;
  }

  async toWorkspaceRelative(absolutePath: string): Promise<string> {
    const realRoot = await this.getRealWorkspaceRoot();
    const resolved = path.resolve(absolutePath);
    this.assertContained(realRoot, resolved, absolutePath);
    return path.relative(realRoot, resolved).replace(/\\/gu, '/');
  }

  private resolveLexically(requestedPath: string): string {
    if (typeof requestedPath !== 'string' || !requestedPath.trim() || requestedPath.includes('\0')) {
      throw new WorkspacePathPolicyError('INVALID_PATH', '路径不能为空或包含非法字符。', requestedPath);
    }
    const normalized = requestedPath.replace(/[\\/]+/gu, path.sep).trim();
    if (path.isAbsolute(normalized)) {
      throw new WorkspacePathPolicyError(
        'INVALID_PATH',
        '只接受相对于当前 LingBuilder 工作区的路径。',
        requestedPath
      );
    }
    const target = path.resolve(this.workspaceRoot, normalized);
    this.assertContained(this.workspaceRoot, target, requestedPath);
    return target;
  }

  private async rejectLinkComponents(
    targetPath: string,
    requestedPath: string,
    allowMissingTail: boolean
  ): Promise<string> {
    const relative = path.relative(this.workspaceRoot, targetPath);
    const segments = relative ? relative.split(path.sep).filter(Boolean) : [];
    let current = this.workspaceRoot;
    let nearestExisting = this.workspaceRoot;

    for (const segment of segments) {
      current = path.join(current, segment);
      try {
        const stat = await fs.lstat(current);
        if (stat.isSymbolicLink()) {
          throw new WorkspacePathPolicyError(
            'SYMLINK_NOT_ALLOWED',
            '路径包含符号链接或目录联接，已拒绝访问。',
            requestedPath
          );
        }
        nearestExisting = current;
      } catch (error: any) {
        if (error instanceof WorkspacePathPolicyError) throw error;
        if (error?.code === 'ENOENT' && allowMissingTail) break;
        throw error;
      }
    }

    return nearestExisting;
  }

  private assertContained(root: string, target: string, requestedPath: string): void {
    const relative = path.relative(path.resolve(root), path.resolve(target));
    if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new WorkspacePathPolicyError(
        'OUTSIDE_WORKSPACE',
        '路径越界：只能访问当前 LingBuilder 工作区内的文件。',
        requestedPath
      );
    }
  }

  private async rejectLinksInTree(currentPath: string, requestedPath: string): Promise<void> {
    const stat = await fs.lstat(currentPath);
    if (stat.isSymbolicLink()) {
      throw new WorkspacePathPolicyError(
        'SYMLINK_NOT_ALLOWED',
        '写入目录中包含符号链接或目录联接，已拒绝访问。',
        requestedPath
      );
    }
    if (!stat.isDirectory()) return;
    const entries = await fs.readdir(currentPath);
    for (const entry of entries) {
      await this.rejectLinksInTree(path.join(currentPath, entry), requestedPath);
    }
  }
}
