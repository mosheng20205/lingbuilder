import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserExtensionValidation } from './types';

export interface BrowserExtensionFileStore {
  isDirectory(directory: string): Promise<boolean>;
  readText(filePath: string): Promise<string>;
}

export class BrowserExtensionService {
  constructor(
    private readonly store: BrowserExtensionFileStore = new NodeBrowserExtensionFileStore(),
    private readonly supportedManifestVersions: readonly number[] = [3]
  ) {}

  resolveRuntimeDirectory(executablePath: string): string {
    if (!path.isAbsolute(executablePath)) throw new Error('必须使用真实 exe 绝对路径解析浏览器插件目录。');
    return path.join(path.dirname(executablePath), 'doubao-downloader');
  }

  async validate(directory: string): Promise<BrowserExtensionValidation> {
    if (!directory || !await this.store.isDirectory(directory)) {
      return { ok: false, status: '插件缺失', directory, diagnostic: '插件目录不存在或不可访问。' };
    }
    let source: string;
    try { source = await this.store.readText(path.join(directory, 'manifest.json')); }
    catch { return { ok: false, status: '插件缺失', directory, diagnostic: '插件目录缺少 manifest.json。' }; }
    let manifest: { manifest_version?: unknown; name?: unknown; version?: unknown };
    try { manifest = JSON.parse(source) as typeof manifest; }
    catch { return { ok: false, status: '插件加载失败', directory, diagnostic: '插件 manifest.json 不是合法 UTF-8 JSON。' }; }
    if (!Number.isInteger(manifest.manifest_version) || !this.supportedManifestVersions.includes(manifest.manifest_version as number)) {
      return {
        ok: false,
        status: '插件加载失败',
        directory,
        manifestVersion: Number(manifest.manifest_version) || undefined,
        diagnostic: `插件 manifest_version 不受支持；当前支持 ${this.supportedManifestVersions.join('、')}。`
      };
    }
    if (typeof manifest.name !== 'string' || !manifest.name.trim() || typeof manifest.version !== 'string' || !manifest.version.trim()) {
      return { ok: false, status: '插件加载失败', directory, diagnostic: '插件清单缺少有效的 name 或 version。' };
    }
    return {
      ok: true,
      status: '插件已加载',
      directory,
      manifestVersion: manifest.manifest_version as number,
      name: manifest.name.trim(),
      version: manifest.version.trim()
    };
  }
}

export class NodeBrowserExtensionFileStore implements BrowserExtensionFileStore {
  async isDirectory(directory: string): Promise<boolean> {
    try { return (await fs.stat(directory)).isDirectory(); } catch { return false; }
  }

  readText(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf8');
  }
}
