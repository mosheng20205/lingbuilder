import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type ProjectFileVersion = string;

export interface ProjectFileWrite {
  targetPath: string;
  bytes: Uint8Array;
  expectedVersion?: ProjectFileVersion;
}

export interface ProjectFileWriteResult {
  versions: Record<string, ProjectFileVersion>;
}

export interface ProjectFilePersistenceFileSystem {
  readFile(filePath: string): Promise<Buffer>;
  writeFile(filePath: string, data: Uint8Array): Promise<void>;
  rename(sourcePath: string, targetPath: string): Promise<void>;
  mkdir(directoryPath: string, options: { recursive: true }): Promise<unknown>;
  rm(filePath: string, options: { force: true }): Promise<void>;
}

export class ProjectFileConflictError extends Error {
  constructor(public readonly conflicts: Record<string, ProjectFileVersion | null>) {
    super(`检测到 ${Object.keys(conflicts).length} 个文件已被外部修改，未覆盖磁盘内容。`);
    this.name = 'ProjectFileConflictError';
  }
}

export class ProjectFileRollbackError extends Error {
  constructor(message: string, public readonly cause: unknown, public readonly rollbackErrors: unknown[]) {
    super(message);
    this.name = 'ProjectFileRollbackError';
  }
}

export function createProjectFileVersion(bytes: Uint8Array): ProjectFileVersion {
  const buffer = Buffer.from(bytes);
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}:${buffer.byteLength}`;
}

export async function readProjectFileVersionsFromDisk(
  workspaceRoot: string,
  relativePaths: readonly string[],
  fileSystem: Pick<ProjectFilePersistenceFileSystem, 'readFile'> = fs
): Promise<Record<string, ProjectFileVersion>> {
  const resolvedRoot = path.resolve(workspaceRoot);
  const versions: Record<string, ProjectFileVersion> = {};
  for (const relativePath of relativePaths) {
    if (path.isAbsolute(relativePath)) {
      throw new Error(`项目文件版本路径必须是工作区相对路径：${relativePath}`);
    }
    const targetPath = path.resolve(resolvedRoot, relativePath);
    const pathFromRoot = path.relative(resolvedRoot, targetPath);
    if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(pathFromRoot)) {
      throw new Error(`项目文件版本路径不能越过工作区：${relativePath}`);
    }
    versions[relativePath] = createProjectFileVersion(await fileSystem.readFile(targetPath));
  }
  return versions;
}

export function createProjectFilePersistenceService(
  fileSystem: ProjectFilePersistenceFileSystem = fs
) {
  return new ProjectFilePersistenceService(fileSystem);
}

export class ProjectFilePersistenceService {
  constructor(private readonly fileSystem: ProjectFilePersistenceFileSystem) {}

  async readVersion(filePath: string): Promise<ProjectFileVersion | null> {
    try {
      return createProjectFileVersion(await this.fileSystem.readFile(filePath));
    } catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  async writeAll(writes: readonly ProjectFileWrite[]): Promise<ProjectFileWriteResult> {
    const normalizedWrites = this.validateWrites(writes);
    const originals = new Map<string, Buffer | null>();
    const conflicts: Record<string, ProjectFileVersion | null> = {};

    for (const write of normalizedWrites) {
      const original = await this.readOptional(write.targetPath);
      originals.set(write.targetPath, original);
      const currentVersion = original ? createProjectFileVersion(original) : null;
      if (write.expectedVersion !== undefined && write.expectedVersion !== currentVersion) {
        conflicts[write.targetPath] = currentVersion;
      }
    }
    if (Object.keys(conflicts).length > 0) throw new ProjectFileConflictError(conflicts);

    const transactionId = `${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const temporaryPaths = new Map<string, string>();
    const replacedPaths: string[] = [];
    try {
      for (const write of normalizedWrites) {
        await this.fileSystem.mkdir(path.dirname(write.targetPath), { recursive: true });
        const temporaryPath = `${write.targetPath}.lingbuilder-${transactionId}.tmp`;
        temporaryPaths.set(write.targetPath, temporaryPath);
        await this.fileSystem.writeFile(temporaryPath, write.bytes);
        const staged = await this.fileSystem.readFile(temporaryPath);
        if (createProjectFileVersion(staged) !== createProjectFileVersion(write.bytes)) {
          throw new Error(`临时文件校验失败：${write.targetPath}`);
        }
      }
      for (const write of normalizedWrites) {
        await replaceFile(this.fileSystem, temporaryPaths.get(write.targetPath)!, write.targetPath);
        replacedPaths.push(write.targetPath);
      }
    } catch (error) {
      const rollbackErrors: unknown[] = [];
      for (const targetPath of replacedPaths.reverse()) {
        try {
          const original = originals.get(targetPath);
          if (original === null) await this.fileSystem.rm(targetPath, { force: true });
          else if (original) await this.restoreAtomically(targetPath, original, transactionId);
        } catch (rollbackError) {
          rollbackErrors.push(rollbackError);
        }
      }
      await Promise.all([...temporaryPaths.values()].map(async temporaryPath => {
        try { await this.fileSystem.rm(temporaryPath, { force: true }); } catch { /* best effort */ }
      }));
      if (rollbackErrors.length > 0) {
        throw new ProjectFileRollbackError('文件保存失败，且至少一个文件未能完成回滚。', error, rollbackErrors);
      }
      throw error;
    }

    const versions: Record<string, ProjectFileVersion> = {};
    for (const write of normalizedWrites) versions[write.targetPath] = createProjectFileVersion(write.bytes);
    return { versions };
  }

  private validateWrites(writes: readonly ProjectFileWrite[]): ProjectFileWrite[] {
    const seen = new Set<string>();
    return writes.map(write => {
      const targetPath = path.resolve(write.targetPath);
      if (seen.has(targetPath)) throw new Error(`同一文件不能在一次保存中写入多次：${targetPath}`);
      seen.add(targetPath);
      return { ...write, targetPath, bytes: Buffer.from(write.bytes) };
    });
  }

  private async readOptional(filePath: string): Promise<Buffer | null> {
    try { return await this.fileSystem.readFile(filePath); }
    catch (error: any) {
      if (error?.code === 'ENOENT') return null;
      throw error;
    }
  }

  private async restoreAtomically(targetPath: string, bytes: Buffer, transactionId: string): Promise<void> {
    const rollbackPath = `${targetPath}.lingbuilder-${transactionId}.rollback`;
    await this.fileSystem.writeFile(rollbackPath, bytes);
    await replaceFile(this.fileSystem, rollbackPath, targetPath);
  }
}

/** Windows rename cannot replace an existing destination consistently. */
async function replaceFile(
  fileSystem: ProjectFilePersistenceFileSystem,
  sourcePath: string,
  targetPath: string
): Promise<void> {
  try {
    await fileSystem.rename(sourcePath, targetPath);
  } catch (error: any) {
    if (!['EEXIST', 'EPERM', 'ENOTEMPTY'].includes(error?.code)) throw error;
    await fileSystem.rm(targetPath, { force: true });
    await fileSystem.rename(sourcePath, targetPath);
  }
}
