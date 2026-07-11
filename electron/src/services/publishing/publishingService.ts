import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export type RemoteTarget = { kind: 'local' } | { kind: 'wsl'; distribution: string } | { kind: 'container'; container: string } | { kind: 'ssh'; host: string };
export interface PublishConfiguration { name: string; version: string; files: string[]; outputDirectory: string; target: RemoteTarget; signing?: { enabled: boolean; certificatePath?: string; timestampUrl?: string } }
export interface PublishArtifact { path: string; size: number; sha256: string }
export interface PublishResult { outputDirectory: string; artifacts: PublishArtifact[]; signed: boolean; target: RemoteTarget }
export interface CommandPlan { command: string; args: string[]; request: string }
type Runner = (command: string, args: string[], options?: Record<string, unknown>) => Promise<{ stdout?: string; stderr?: string }>;

export class PublishConfigurationNotFoundError extends Error {
  constructor() {
    super('尚未创建发布配置 `.lingbuilder/publish.json`。');
    this.name = 'PublishConfigurationNotFoundError';
  }
}

export class PublishingService {
  constructor(private readonly workspaceRoot: string, private readonly runner: Runner = async (command, args, options) => { const result = await execFileAsync(command, args, options as any); return { stdout: String(result.stdout || ''), stderr: String(result.stderr || '') }; }) {}

  async readConfiguration(relative = '.lingbuilder/publish.json'): Promise<PublishConfiguration> {
    let file: string;
    try {
      file = await this.resolveExisting(relative);
    } catch (error: any) {
      if (error?.code === 'ENOENT') throw new PublishConfigurationNotFoundError();
      throw error;
    }
    let value: unknown;
    try { value = JSON.parse(await fs.readFile(file, 'utf8')); } catch { throw new Error('发布配置 JSON 无效。'); }
    return validateConfiguration(value);
  }

  async readOptionalConfiguration(relative = '.lingbuilder/publish.json'): Promise<PublishConfiguration | undefined> {
    try {
      return await this.readConfiguration(relative);
    } catch (error) {
      if (error instanceof PublishConfigurationNotFoundError) return undefined;
      throw error;
    }
  }

  async publish(configuration: PublishConfiguration): Promise<PublishResult> {
    const config = validateConfiguration(configuration); const root = await fs.realpath(this.workspaceRoot);
    if (config.target.kind !== 'local') { const plan = createRemoteCommandPlan(config.target, { schemaVersion: 1, action: 'publish', configuration: config }); const response = await this.runner(plan.command, plan.args, { cwd: root, windowsHide: true, timeout: 300_000, maxBuffer: 4 * 1024 * 1024 }); let result: PublishResult; try { result = JSON.parse(String(response.stdout || '')); } catch { throw new Error('远程构建代理没有返回有效发布结果。'); } return validateRemoteResult(result, config.target); }
    const output = await this.resolveOutput(config.outputDirectory); const temporary = `${output}.tmp-${crypto.randomUUID()}`; const backup = `${output}.backup-${crypto.randomUUID()}`; let movedOld = false;
    try {
      await fs.mkdir(temporary, { recursive: true }); const artifacts: PublishArtifact[] = [];
      for (const relative of config.files) { const source = await this.resolveExisting(relative); const destination = path.join(temporary, normalizeRelative(relative)); await fs.mkdir(path.dirname(destination), { recursive: true }); await fs.copyFile(source, destination); artifacts.push(await describeArtifact(destination, temporary)); }
      if (config.signing?.enabled) { const certificate = config.signing.certificatePath ? await this.resolveExisting(config.signing.certificatePath) : undefined; for (const artifact of artifacts.filter(item => /\.(?:exe|dll)$/iu.test(item.path))) await this.sign(path.join(temporary, artifact.path), certificate, config.signing.timestampUrl); }
      const finalArtifacts = await Promise.all(artifacts.map(item => describeArtifact(path.join(temporary, item.path), temporary))); await fs.writeFile(path.join(temporary, 'lingbuilder-publish-manifest.json'), JSON.stringify({ schemaVersion: 1, name: config.name, version: config.version, target: config.target, signed: Boolean(config.signing?.enabled), artifacts: finalArtifacts }, null, 2));
      try { await fs.rename(output, backup); movedOld = true; } catch (error: any) { if (error?.code !== 'ENOENT') throw error; }
      await fs.rename(temporary, output); if (movedOld) await fs.rm(backup, { recursive: true, force: true }); return { outputDirectory: path.relative(root, output).replace(/\\/gu, '/'), artifacts: finalArtifacts, signed: Boolean(config.signing?.enabled), target: config.target };
    } catch (error) { await fs.rm(temporary, { recursive: true, force: true }); if (movedOld) { await fs.rm(output, { recursive: true, force: true }); await fs.rename(backup, output); } throw error; }
  }

  async verifySignature(relative: string): Promise<boolean> { const file = await this.resolveExisting(relative); try { await this.runner('signtool.exe', ['verify', '/pa', '/all', file], { windowsHide: true, timeout: 30_000 }); return true; } catch { return false; } }
  private async sign(file: string, certificate?: string, timestampUrl?: string): Promise<void> { const args = ['sign', '/fd', 'SHA256']; if (certificate) args.push('/f', certificate); else args.push('/a'); if (timestampUrl) args.push('/tr', validateUrl(timestampUrl), '/td', 'SHA256'); args.push(file); await this.runner('signtool.exe', args, { windowsHide: true, timeout: 120_000 }); await this.runner('signtool.exe', ['verify', '/pa', '/all', file], { windowsHide: true, timeout: 30_000 }); }
  private async resolveExisting(value: string): Promise<string> { const root = await fs.realpath(this.workspaceRoot); const file = await fs.realpath(path.resolve(root, value)); if (!inside(root, file) || !(await fs.stat(file)).isFile()) throw new Error('发布文件必须位于当前工作区内。'); return file; }
  private async resolveOutput(value: string): Promise<string> { const root = await fs.realpath(this.workspaceRoot); const output = path.resolve(root, value); if (!inside(root, output) || output === root || !normalizeRelative(value)) throw new Error('发布输出目录必须位于工作区内。'); return output; }
}

export function createRemoteCommandPlan(target: Exclude<RemoteTarget, { kind: 'local' }>, requestValue: unknown): CommandPlan { const request = Buffer.from(JSON.stringify(requestValue), 'utf8').toString('base64url'); if (request.length > 512_000) throw new Error('远程发布请求过大。'); if (target.kind === 'wsl') return { command: 'wsl.exe', args: ['--distribution', validateName(target.distribution, 'WSL 发行版'), '--exec', 'lingbuilder-agent', 'build', '--request', request], request }; if (target.kind === 'container') return { command: 'docker', args: ['exec', validateName(target.container, '容器'), 'lingbuilder-agent', 'build', '--request', request], request }; return { command: 'ssh', args: ['--', validateHost(target.host), 'lingbuilder-agent', 'build', '--request', request], request }; }
export function validateConfiguration(value: any): PublishConfiguration { if (!value || typeof value !== 'object') throw new Error('发布配置无效。'); const name = validateName(value.name, '发布名称'); if (typeof value.version !== 'string' || !/^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/iu.test(value.version)) throw new Error('发布版本必须使用语义版本。'); if (!Array.isArray(value.files) || !value.files.length || value.files.length > 1000) throw new Error('发布文件列表无效。'); const files = value.files.map((item: unknown) => { if (typeof item !== 'string' || !normalizeRelative(item)) throw new Error('发布文件路径无效。'); return normalizeRelative(item); }); const target = validateTarget(value.target || { kind: 'local' }); const outputDirectory = normalizeRelative(value.outputDirectory); if (!outputDirectory) throw new Error('发布输出目录无效。'); const signing = value.signing ? { enabled: Boolean(value.signing.enabled), certificatePath: value.signing.certificatePath ? normalizeRelative(value.signing.certificatePath) : undefined, timestampUrl: value.signing.timestampUrl ? validateUrl(value.signing.timestampUrl) : undefined } : undefined; return { name, version: value.version, files, outputDirectory, target, signing }; }
function validateTarget(value: any): RemoteTarget { if (value?.kind === 'local') return { kind: 'local' }; if (value?.kind === 'wsl') return { kind: 'wsl', distribution: validateName(value.distribution, 'WSL 发行版') }; if (value?.kind === 'container') return { kind: 'container', container: validateName(value.container, '容器') }; if (value?.kind === 'ssh') return { kind: 'ssh', host: validateHost(value.host) }; throw new Error('发布目标仅支持 local、wsl、container 或 ssh。'); }
function validateRemoteResult(value: any, target: RemoteTarget): PublishResult { if (!value || !Array.isArray(value.artifacts) || value.artifacts.some((item: any) => typeof item.path !== 'string' || !Number.isFinite(item.size) || !/^[a-f0-9]{64}$/u.test(item.sha256))) throw new Error('远程发布结果契约无效。'); return { outputDirectory: String(value.outputDirectory || ''), artifacts: value.artifacts.slice(0, 1000), signed: Boolean(value.signed), target }; }
async function describeArtifact(file: string, root: string): Promise<PublishArtifact> { const bytes = await fs.readFile(file); return { path: path.relative(root, file).replace(/\\/gu, '/'), size: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') }; }
function inside(root: string, value: string): boolean { const relative = path.relative(root, value); return !relative.startsWith('..') && !path.isAbsolute(relative); }
function normalizeRelative(value: unknown): string { if (typeof value !== 'string' || value.includes('\0')) return ''; const normalized = path.normalize(value.trim()); return !normalized || normalized === '.' || path.isAbsolute(normalized) || normalized.startsWith(`..${path.sep}`) || normalized === '..' ? '' : normalized; }
function validateName(value: unknown, label: string): string { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,127}$/iu.test(value)) throw new Error(`${label}无效。`); return value; }
function validateHost(value: unknown): string { if (typeof value !== 'string' || !/^(?:[a-z0-9._-]+@)?[a-z0-9.-]+(?::\d{1,5})?$/iu.test(value)) throw new Error('SSH 主机无效。'); return value; }
function validateUrl(value: unknown): string { if (typeof value !== 'string') throw new Error('时间戳地址无效。'); const url = new URL(value); if (url.protocol !== 'https:') throw new Error('时间戳地址必须使用 HTTPS。'); return url.toString(); }
