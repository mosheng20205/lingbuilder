import fs from 'node:fs/promises';
import path from 'node:path';

export interface HotExitRecoveryData {
  schemaVersion: 1;
  projectId: string;
  savedAt: string;
  files: Record<string, string>;
  fileFormats?: Record<string, unknown>;
  baseVersions?: Record<string, string>;
  openTabs?: string[];
  activeFilePath?: string;
}

export class HotExitRecoveryService {
  constructor(private readonly workspaceRoot: string) {}

  async read(projectId: string): Promise<HotExitRecoveryData | null> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.resolvePath(projectId), 'utf8'));
      if (parsed?.schemaVersion !== 1 || parsed?.projectId !== projectId || typeof parsed?.files !== 'object') return null;
      return parsed;
    } catch (error: any) {
      if (error?.code === 'ENOENT' || error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async write(data: HotExitRecoveryData): Promise<void> {
    const targetPath = this.resolvePath(data.projectId);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const temporaryPath = `${targetPath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
    await fs.rename(temporaryPath, targetPath);
  }

  async delete(projectId: string): Promise<void> {
    await fs.rm(this.resolvePath(projectId), { force: true });
  }

  private resolvePath(projectId: string): string {
    if (!/^[\w.-]+$/u.test(projectId)) throw new Error('项目 ID 包含不安全字符。');
    return path.join(this.workspaceRoot, '.lingbuilder', 'recovery', `${projectId}.json`);
  }
}
