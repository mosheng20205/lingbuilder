import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { SKILL_CATALOG_TRUST_ANCHORS, type SkillCatalogTrustAnchor } from './skillCatalogTrustAnchors';
import {
  downloadSkillKitFiles,
  fetchRemoteSkillCatalog,
  readSkillCatalogState,
  resolveSkillCatalogEndpoint,
  verifySkillCatalogManifest,
  writeSkillCatalogState,
  type SkillCatalogFetch,
  type SkillCatalogRelease,
  type SkillKitBundledManifest
} from './skillCatalogRemote';

/**
 * 灵码 Skill 正文的取物编排：安装包内置快照是永远可用的兜底，
 * 联网时以云端签名清单为最新来源；任何一步失败都只降级，不抛给界面。
 */
export type SkillKitSource = 'remote' | 'cache' | 'bundled';

export interface SkillKitStatus {
  ok: boolean;
  source: SkillKitSource;
  id: string;
  version: string;
  sequence: number;
  minIdeVersion: string;
  entrypointPath: string;
  installPrompt: string;
  fileCount: number;
  checkedAt: string;
  problem: string;
}

export interface SkillKitServiceOptions {
  userDataDir: string;
  bundledRoot: string;
  ideVersion: string;
  environment?: NodeJS.ProcessEnv;
  fetcher?: SkillCatalogFetch;
  anchors?: readonly SkillCatalogTrustAnchor[];
}

interface CacheManifest extends SkillKitBundledManifest {
  minIdeVersion?: string;
  files: Array<{ path: string; bytes: number; sha256: string; downloadUrl?: string }>;
  fetchedAt?: string;
}

export function resolveBundledSkillKitRoot(options: { packaged: boolean; resourcesPath: string; electronRoot: string }): string {
  return options.packaged ? path.join(options.resourcesPath, 'skill-kit') : path.join(options.electronRoot, 'skill-kit');
}

export class SkillKitService {
  private readonly anchors: readonly SkillCatalogTrustAnchor[];
  private readonly cacheDir: string;
  private readonly cacheManifestPath: string;
  private readonly statePath: string;

  constructor(private readonly options: SkillKitServiceOptions) {
    this.anchors = options.anchors ?? SKILL_CATALOG_TRUST_ANCHORS;
    this.cacheDir = path.join(options.userDataDir, 'skill-kit');
    this.cacheManifestPath = path.join(this.cacheDir, 'manifest.json');
    this.statePath = path.join(this.cacheDir, 'state.json');
  }

  get bundledManifestPath(): string { return path.join(this.options.bundledRoot, 'manifest.json'); }

  private async readJson<T>(file: string): Promise<T | null> {
    const raw = await fs.readFile(file, 'utf8').catch(() => null);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  private async readBundled(): Promise<SkillKitBundledManifest | null> {
    return await this.readJson<SkillKitBundledManifest>(this.bundledManifestPath);
  }

  private buildStatus(args: {
    source: SkillKitSource;
    manifest: { id: string; version: string; sequence: number; entrypoint: string; installPromptTemplate: string; minIdeVersion?: string; files: Array<{ path: string }> };
    root: string;
    problem?: string;
  }): SkillKitStatus {
    const entrypointPath = path.join(args.root, ...args.manifest.entrypoint.split('/'));
    return {
      ok: true,
      source: args.source,
      id: args.manifest.id,
      version: args.manifest.version,
      sequence: args.manifest.sequence,
      minIdeVersion: args.manifest.minIdeVersion || '',
      entrypointPath,
      installPrompt: args.manifest.installPromptTemplate.replaceAll('{skillPath}', entrypointPath),
      fileCount: args.manifest.files.length,
      checkedAt: new Date().toISOString(),
      problem: args.problem || ''
    };
  }

  /** 缓存只有在每个文件都存在且 SHA-256 一致时才算可用；否则整目录视为不可用。 */
  private async readValidCache(bundled: SkillKitBundledManifest): Promise<CacheManifest | null> {
    const cache = await this.readJson<CacheManifest>(this.cacheManifestPath);
    if (!cache || cache.id !== bundled.id || cache.entrypoint !== bundled.entrypoint) return null;
    if (!Array.isArray(cache.files) || !cache.files.length) return null;
    for (const file of cache.files) {
      const data = await fs.readFile(path.join(this.cacheDir, ...file.path.split('/'))).catch(() => null);
      if (data === null || data.length !== file.bytes) return null;
      if (createHash('sha256').update(data).digest('hex') !== file.sha256) return null;
    }
    return cache;
  }

  /** 不联网的当前可用快照：优先已校验的云端缓存，其次安装包内置快照。 */
  async snapshot(): Promise<SkillKitStatus> {
    const bundled = await this.readBundled();
    if (!bundled) {
      return {
        ok: false, source: 'bundled', id: 'lingbuilder.skill-kit', version: '', sequence: 0, minIdeVersion: '',
        entrypointPath: '', installPrompt: '', fileCount: 0, checkedAt: new Date().toISOString(),
        problem: `安装包内置的灵码 Skill 快照不可用：缺少或无法解析 ${this.bundledManifestPath}。`
      };
    }
    const cache = await this.readValidCache(bundled);
    if (cache) return this.buildStatus({ source: 'cache', manifest: cache, root: this.cacheDir });
    return this.buildStatus({ source: 'bundled', manifest: bundled, root: this.options.bundledRoot });
  }

  /** 联网检查更新：成功即落缓存并推进 acceptedSequence；失败一律回退快照并带中文原因。 */
  async checkForUpdates(): Promise<SkillKitStatus> {
    const bundled = await this.readBundled();
    if (!bundled) return await this.snapshot();
    const endpoint = resolveSkillCatalogEndpoint(this.options.environment || process.env);
    if (!endpoint) {
      return await this.withProblem(await this.snapshot(), '未启用云端 Skill 清单通道（打包在线模式或 LINGBUILDER_SKILL_CATALOG_URL 未设置），当前使用本机快照。');
    }
    try {
      const fetcher = this.options.fetcher ?? fetch;
      const manifest = await fetchRemoteSkillCatalog(endpoint.url, 10_000, fetcher);
      const acceptedSequence = await readSkillCatalogState(this.statePath);
      const verified = verifySkillCatalogManifest({
        manifest,
        bundled,
        anchors: this.anchors,
        acceptedSequence,
        ideVersion: this.options.ideVersion
      });
      await fs.mkdir(this.cacheDir, { recursive: true });
      await downloadSkillKitFiles(verified.release, this.cacheDir, fetcher);
      const cacheManifest: CacheManifest = {
        schemaVersion: 1,
        id: verified.release.id,
        version: verified.release.version,
        sequence: verified.sequence,
        entrypoint: verified.release.entrypoint,
        minIdeVersion: verified.release.minIdeVersion,
        installPromptTemplate: verified.release.installPromptTemplate,
        files: verified.release.files,
        fetchedAt: new Date().toISOString()
      };
      await fs.writeFile(this.cacheManifestPath, `${JSON.stringify(cacheManifest, null, 2)}\n`, 'utf8');
      await writeSkillCatalogState(this.statePath, verified.sequence);
      return this.buildStatus({ source: 'remote', manifest: cacheManifest, root: this.cacheDir });
    } catch (reason) {
      return await this.withProblem(await this.snapshot(), reason instanceof Error ? reason.message : String(reason));
    }
  }

  private async withProblem(status: SkillKitStatus, problem: string): Promise<SkillKitStatus> {
    return { ...status, problem };
  }
}

export type { SkillCatalogRelease };
