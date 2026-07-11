import fs from 'node:fs/promises';
import path from 'node:path';

import {
  WorkspacePathPolicy,
  WorkspacePathPolicyError
} from './workspacePathPolicy';

export interface ProjectFileMutationScope {
  sourceRoot: string;
  configRoot: string;
}

export interface RenameProjectFileRequest {
  project: ProjectFileMutationScope;
  sourcePath: string;
  targetPath: string;
}

export interface DeleteProjectFileRequest {
  project: ProjectFileMutationScope;
  filePath: string;
}

export interface RenameProjectFileResult {
  kind: 'rename';
  sourcePath: string;
  targetPath: string;
}

export interface DeleteProjectFileResult {
  kind: 'delete';
  filePath: string;
}

export type ProjectFileMutationErrorCode =
  | 'INVALID_PATH'
  | 'OUTSIDE_WORKSPACE'
  | 'OUTSIDE_PROJECT_ROOTS'
  | 'SYMLINK_NOT_ALLOWED'
  | 'PROJECT_ROOT_NOT_FOUND'
  | 'FILE_NOT_FOUND'
  | 'TARGET_EXISTS'
  | 'NOT_A_FILE'
  | 'TARGET_DIRECTORY_NOT_FOUND'
  | 'SAME_PATH'
  | 'OPERATION_FAILED';

export class ProjectFileMutationError extends Error {
  constructor(
    public readonly code: ProjectFileMutationErrorCode,
    message: string,
    public readonly requestedPath?: string
  ) {
    super(message);
    this.name = 'ProjectFileMutationError';
  }
}

interface ResolvedProjectRoot {
  lexicalPath: string;
  realPath: string;
}

/**
 * Performs project-tree file mutations without relying on renderer state.
 *
 * All input paths are workspace-relative. Mutations are limited to regular
 * files below the selected project's sourceRoot or configRoot. Existing link
 * components (including Windows junctions) are rejected before an operation.
 */
export class ProjectFileMutationService {
  private readonly workspaceRoot: string;
  private readonly pathPolicy: WorkspacePathPolicy;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.pathPolicy = new WorkspacePathPolicy(this.workspaceRoot);
  }

  async renameFile(request: RenameProjectFileRequest): Promise<RenameProjectFileResult> {
    const roots = await this.resolveProjectRoots(request.project);
    const sourcePath = await this.resolveExistingProjectFile(request.sourcePath, roots);
    const targetPath = await this.resolveProjectWriteTarget(request.targetPath, roots);

    if (pathsEqual(sourcePath, targetPath)) {
      throw new ProjectFileMutationError(
        'SAME_PATH',
        '新文件路径与原文件路径相同，无需重命名。',
        request.targetPath
      );
    }

    await this.assertTargetDoesNotExist(targetPath, request.targetPath);

    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw this.fileNotFound(request.sourcePath);
      }
      if (error?.code === 'EEXIST' || error?.code === 'ENOTEMPTY') {
        throw this.targetExists(request.targetPath);
      }
      throw new ProjectFileMutationError(
        'OPERATION_FAILED',
        `重命名文件失败：${toErrorMessage(error)}`,
        request.sourcePath
      );
    }

    return {
      kind: 'rename',
      sourcePath: this.toWorkspaceRelative(sourcePath),
      targetPath: this.toWorkspaceRelative(targetPath)
    };
  }

  async deleteFile(request: DeleteProjectFileRequest): Promise<DeleteProjectFileResult> {
    const roots = await this.resolveProjectRoots(request.project);
    const filePath = await this.resolveExistingProjectFile(request.filePath, roots);

    try {
      await fs.unlink(filePath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        throw this.fileNotFound(request.filePath);
      }
      throw new ProjectFileMutationError(
        'OPERATION_FAILED',
        `删除文件失败：${toErrorMessage(error)}`,
        request.filePath
      );
    }

    return {
      kind: 'delete',
      filePath: this.toWorkspaceRelative(filePath)
    };
  }

  private async resolveProjectRoots(project: ProjectFileMutationScope): Promise<ResolvedProjectRoot[]> {
    if (!project || typeof project.sourceRoot !== 'string' || typeof project.configRoot !== 'string') {
      throw new ProjectFileMutationError(
        'INVALID_PATH',
        '项目缺少有效的 sourceRoot 或 configRoot，不能修改文件。'
      );
    }

    const uniqueRoots = [...new Set([project.sourceRoot, project.configRoot])];
    const roots: ResolvedProjectRoot[] = [];

    for (const requestedRoot of uniqueRoots) {
      let lexicalPath: string;
      let realPath: string;
      try {
        lexicalPath = await this.pathPolicy.resolveForWrite(requestedRoot);
        realPath = await this.pathPolicy.resolveExisting(requestedRoot, { rejectSymlinks: true });
      } catch (error: any) {
        if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
          throw new ProjectFileMutationError(
            'PROJECT_ROOT_NOT_FOUND',
            `项目文件根目录不存在：${requestedRoot}`,
            requestedRoot
          );
        }
        throw this.convertPathPolicyError(error, requestedRoot);
      }

      const stat = await fs.lstat(realPath);
      if (!stat.isDirectory()) {
        throw new ProjectFileMutationError(
          'PROJECT_ROOT_NOT_FOUND',
          `项目文件根路径不是目录：${requestedRoot}`,
          requestedRoot
        );
      }
      roots.push({ lexicalPath, realPath });
    }

    return roots;
  }

  private async resolveExistingProjectFile(
    requestedPath: string,
    roots: ResolvedProjectRoot[]
  ): Promise<string> {
    let resolvedPath: string;
    try {
      resolvedPath = await this.pathPolicy.resolveExisting(requestedPath, { rejectSymlinks: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        throw this.fileNotFound(requestedPath);
      }
      throw this.convertPathPolicyError(error, requestedPath);
    }

    this.assertInsideProjectRoots(resolvedPath, roots.map(root => root.realPath), requestedPath);

    const stat = await fs.lstat(resolvedPath);
    if (!stat.isFile()) {
      throw new ProjectFileMutationError(
        'NOT_A_FILE',
        `只能修改普通文件，不能操作目录或其他文件类型：${requestedPath}`,
        requestedPath
      );
    }
    return resolvedPath;
  }

  private async resolveProjectWriteTarget(
    requestedPath: string,
    roots: ResolvedProjectRoot[]
  ): Promise<string> {
    let resolvedPath: string;
    try {
      resolvedPath = await this.pathPolicy.resolveForWrite(requestedPath);
    } catch (error) {
      throw this.convertPathPolicyError(error, requestedPath);
    }

    this.assertInsideProjectRoots(resolvedPath, roots.map(root => root.lexicalPath), requestedPath);

    const parentPath = path.dirname(resolvedPath);
    let realParentPath: string;
    try {
      const relativeParent = this.toWorkspaceRelative(parentPath);
      realParentPath = await this.pathPolicy.resolveExisting(relativeParent, { rejectSymlinks: true });
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') {
        throw new ProjectFileMutationError(
          'TARGET_DIRECTORY_NOT_FOUND',
          `目标目录不存在：${this.toWorkspaceRelative(parentPath)}`,
          requestedPath
        );
      }
      throw this.convertPathPolicyError(error, requestedPath);
    }

    this.assertInsideProjectRoots(realParentPath, roots.map(root => root.realPath), requestedPath, true);
    const stat = await fs.lstat(realParentPath);
    if (!stat.isDirectory()) {
      throw new ProjectFileMutationError(
        'TARGET_DIRECTORY_NOT_FOUND',
        `目标路径的父级不是目录：${this.toWorkspaceRelative(parentPath)}`,
        requestedPath
      );
    }
    return resolvedPath;
  }

  private async assertTargetDoesNotExist(targetPath: string, requestedPath: string): Promise<void> {
    try {
      await fs.lstat(targetPath);
      throw this.targetExists(requestedPath);
    } catch (error: any) {
      if (error instanceof ProjectFileMutationError) throw error;
      if (error?.code === 'ENOENT') return;
      throw new ProjectFileMutationError(
        'OPERATION_FAILED',
        `无法检查目标文件：${toErrorMessage(error)}`,
        requestedPath
      );
    }
  }

  private assertInsideProjectRoots(
    targetPath: string,
    allowedRoots: string[],
    requestedPath: string,
    allowRootItself = false
  ): void {
    const allowed = allowedRoots.some(root => {
      const relative = path.relative(path.resolve(root), path.resolve(targetPath));
      if (relative === '') return allowRootItself;
      return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
    });
    if (!allowed) {
      throw new ProjectFileMutationError(
        'OUTSIDE_PROJECT_ROOTS',
        `路径不属于当前项目的 sourceRoot 或 configRoot：${requestedPath}`,
        requestedPath
      );
    }
  }

  private convertPathPolicyError(error: unknown, requestedPath: string): ProjectFileMutationError {
    if (error instanceof ProjectFileMutationError) return error;
    if (error instanceof WorkspacePathPolicyError) {
      const code: ProjectFileMutationErrorCode = error.code === 'SYMLINK_NOT_ALLOWED'
        ? 'SYMLINK_NOT_ALLOWED'
        : error.code === 'OUTSIDE_WORKSPACE'
          ? 'OUTSIDE_WORKSPACE'
          : 'INVALID_PATH';
      return new ProjectFileMutationError(code, error.message, requestedPath);
    }
    return new ProjectFileMutationError(
      'OPERATION_FAILED',
      `文件路径检查失败：${toErrorMessage(error)}`,
      requestedPath
    );
  }

  private fileNotFound(requestedPath: string): ProjectFileMutationError {
    return new ProjectFileMutationError(
      'FILE_NOT_FOUND',
      `文件不存在：${requestedPath}`,
      requestedPath
    );
  }

  private targetExists(requestedPath: string): ProjectFileMutationError {
    return new ProjectFileMutationError(
      'TARGET_EXISTS',
      `目标文件已存在，不能覆盖：${requestedPath}`,
      requestedPath
    );
  }

  private toWorkspaceRelative(absolutePath: string): string {
    return path.relative(this.workspaceRoot, absolutePath).replace(/\\/gu, '/');
  }
}

export function createProjectFileMutationService(workspaceRoot: string): ProjectFileMutationService {
  return new ProjectFileMutationService(workspaceRoot);
}

function pathsEqual(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return process.platform === 'win32'
    ? resolvedLeft.toLocaleLowerCase('en-US') === resolvedRight.toLocaleLowerCase('en-US')
    : resolvedLeft === resolvedRight;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
