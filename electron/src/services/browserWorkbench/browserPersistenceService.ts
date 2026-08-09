import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizeBrowserWorkspaceDocument } from './browserInstanceService';
import type { BrowserWorkspaceDocument } from './types';

export interface BrowserPersistenceFileStore {
  readText(filePath: string): Promise<string>;
  writeText(filePath: string, content: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
  ensureParent(filePath: string): Promise<void>;
  copyFile(source: string, target: string): Promise<void>;
  replaceFile(source: string, target: string): Promise<void>;
  moveFile(source: string, target: string): Promise<void>;
}

export interface BrowserPersistenceLoadResult {
  document?: BrowserWorkspaceDocument;
  recoveredFromBackup: boolean;
  diagnostic?: string;
  corruptPath?: string;
}

export class BrowserPersistenceService {
  constructor(
    private readonly store: BrowserPersistenceFileStore = new NodeBrowserPersistenceFileStore(),
    private readonly now: () => Date = () => new Date()
  ) {}

  async save(filePath: string, document: BrowserWorkspaceDocument): Promise<void> {
    const normalized = normalizeBrowserWorkspaceDocument(document);
    const temporaryPath = `${filePath}.tmp-${process.pid}`;
    const backupPath = `${filePath}.bak`;
    await this.store.ensureParent(filePath);
    await this.store.writeText(temporaryPath, `${JSON.stringify(normalized, null, 2)}\n`);
    try {
      if (await this.store.exists(filePath)) await this.store.copyFile(filePath, backupPath);
      await this.store.replaceFile(temporaryPath, filePath);
    } catch (error) {
      throw new Error(`浏览器实例配置原子写入失败：${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
  }

  async load(filePath: string): Promise<BrowserPersistenceLoadResult> {
    if (!await this.store.exists(filePath)) return { recoveredFromBackup: false };
    try {
      return { document: await this.readDocument(filePath), recoveredFromBackup: false };
    } catch (primaryError) {
      const backupPath = `${filePath}.bak`;
      if (!await this.store.exists(backupPath)) {
        return {
          recoveredFromBackup: false,
          diagnostic: `浏览器实例配置损坏且没有可用备份；原文件已保留：${errorMessage(primaryError)}`
        };
      }
      try {
        const document = await this.readDocument(backupPath);
        const suffix = this.now().toISOString().replace(/[:.]/gu, '-');
        const corruptPath = `${filePath}.corrupt-${suffix}`;
        await this.store.moveFile(filePath, corruptPath);
        return {
          document,
          recoveredFromBackup: true,
          corruptPath,
          diagnostic: '主配置损坏，已从原子写入备份恢复并保留损坏文件。'
        };
      } catch (backupError) {
        return {
          recoveredFromBackup: false,
          diagnostic: `浏览器实例配置和备份均无法恢复；两个文件都已保留：${errorMessage(backupError)}`
        };
      }
    }
  }

  private async readDocument(filePath: string): Promise<BrowserWorkspaceDocument> {
    return normalizeBrowserWorkspaceDocument(JSON.parse(await this.store.readText(filePath)) as unknown);
  }
}

export class NodeBrowserPersistenceFileStore implements BrowserPersistenceFileStore {
  readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }

  writeText(filePath: string, content: string): Promise<void> {
    return fs.writeFile(filePath, content, 'utf8');
  }

  async exists(filePath: string): Promise<boolean> {
    try { await fs.access(filePath); return true; } catch { return false; }
  }

  ensureParent(filePath: string): Promise<void> {
    return fs.mkdir(path.dirname(filePath), { recursive: true }).then(() => undefined);
  }

  copyFile(source: string, target: string): Promise<void> {
    return fs.copyFile(source, target);
  }

  replaceFile(source: string, target: string): Promise<void> {
    return fs.rename(source, target);
  }

  moveFile(source: string, target: string): Promise<void> {
    return fs.rename(source, target);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : String(error);
}
