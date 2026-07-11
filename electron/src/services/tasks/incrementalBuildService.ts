import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

interface CacheEntry { fingerprint: string; outputs: string[]; completedAt: string }
interface CacheFile { schemaVersion: 1; entries: Record<string, CacheEntry> }

export class IncrementalBuildService {
  private cache: CacheFile | undefined;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly workspaceRoot: string) {}

  fingerprint(value: unknown): string {
    return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
  }

  async isFresh(key: string, fingerprint: string): Promise<boolean> {
    const entry = (await this.read()).entries[key];
    if (!entry || entry.fingerprint !== fingerprint || entry.outputs.length === 0) return false;
    return (await Promise.all(entry.outputs.map(output => this.outputExists(output)))).every(Boolean);
  }

  async record(key: string, fingerprint: string, outputs: readonly string[]): Promise<void> {
    const normalizedOutputs = [...new Set(outputs.map(output => path.resolve(output)))];
    this.writeChain = this.writeChain.then(async () => {
      const cache = await this.read();
      cache.entries[key] = { fingerprint, outputs: normalizedOutputs, completedAt: new Date().toISOString() };
      await this.write(cache);
    });
    await this.writeChain;
  }

  async invalidate(keys?: readonly string[]): Promise<void> {
    this.writeChain = this.writeChain.then(async () => {
      const cache = await this.read();
      if (!keys) cache.entries = {};
      else keys.forEach(key => delete cache.entries[key]);
      await this.write(cache);
    });
    await this.writeChain;
  }

  private async read(): Promise<CacheFile> {
    if (this.cache) return this.cache;
    try {
      const parsed = JSON.parse(await fs.readFile(this.cachePath, 'utf8')) as CacheFile;
      this.cache = parsed?.schemaVersion === 1 && parsed.entries && typeof parsed.entries === 'object'
        ? parsed
        : { schemaVersion: 1, entries: {} };
    } catch {
      this.cache = { schemaVersion: 1, entries: {} };
    }
    return this.cache;
  }

  private async write(cache: CacheFile): Promise<void> {
    await fs.mkdir(path.dirname(this.cachePath), { recursive: true });
    const temporaryPath = `${this.cachePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, `${JSON.stringify(cache, null, 2)}\n`, 'utf8');
    await fs.rename(temporaryPath, this.cachePath);
  }

  private async outputExists(output: string): Promise<boolean> {
    try {
      const resolved = path.resolve(output);
      const relative = path.relative(this.workspaceRoot, resolved);
      if (relative.startsWith('..') || path.isAbsolute(relative)) return false;
      return (await fs.stat(resolved)).isFile();
    } catch { return false; }
  }

  private get cachePath(): string { return path.join(this.workspaceRoot, '.lingbuilder-build', 'incremental-build-cache.json'); }
}

export function dependencyBuildBatches<T extends { id: string; references?: string[] }>(projects: readonly T[]): T[][] {
  const byId = new Map(projects.map(project => [project.id, project]));
  const remaining = new Set(byId.keys());
  const completed = new Set<string>();
  const batches: T[][] = [];
  while (remaining.size) {
    const batch = [...remaining]
      .map(id => byId.get(id)!)
      .filter(project => (project.references || []).every(reference => !byId.has(reference) || completed.has(reference)));
    if (!batch.length) throw new Error('项目引用存在循环，无法安排并行构建。');
    batch.forEach(project => remaining.delete(project.id));
    batch.forEach(project => completed.add(project.id));
    batches.push(batch);
  }
  return batches;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}
