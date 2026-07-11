import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as nodePty from 'node-pty';

export type TerminalProfile = 'powershell' | 'cmd' | 'shell';
export type TerminalStatus = 'running' | 'exited';
export interface TerminalSessionSnapshot {
  id: string; title: string; profile: TerminalProfile; cwd: string; cols: number; rows: number;
  status: TerminalStatus; pid: number; exitCode?: number; createdAt: string; sequence: number; buffer: string;
}
export interface TerminalEvent { kind: 'created' | 'data' | 'resized' | 'exited' | 'closed'; session: TerminalSessionSnapshot; data?: string }
export interface PtyProcess {
  pid: number; write(data: string): void; resize(cols: number, rows: number): void; kill(): void;
  onData(listener: (data: string) => void): { dispose(): void };
  onExit(listener: (event: { exitCode: number }) => void): { dispose(): void };
}
export type PtySpawner = (file: string, args: string[], options: nodePty.IPtyForkOptions) => PtyProcess;

interface SessionRecord { snapshot: TerminalSessionSnapshot; process: PtyProcess; disposables: Array<{ dispose(): void }> }
const MAX_BUFFER = 256 * 1024;

export class PtyTerminalService {
  private readonly sessions = new Map<string, SessionRecord>();
  private readonly listeners = new Set<(event: TerminalEvent) => void>();

  constructor(private readonly workspaceRoot: string, private readonly spawnPty: PtySpawner = nodePty.spawn) {}

  async create(options: { profile?: TerminalProfile; cwd?: string; cols?: number; rows?: number; env?: Record<string, string> } = {}): Promise<TerminalSessionSnapshot> {
    const profile = normalizeProfile(options.profile);
    const cwd = await this.resolveCwd(options.cwd);
    const cols = dimension(options.cols, 80, 20, 500); const rows = dimension(options.rows, 24, 5, 200);
    const shell = resolveShell(profile); const env = validateEnvironment(options.env);
    const child = this.spawnPty(shell.file, shell.args, {
      name: 'xterm-256color', cwd, cols, rows, env: { ...process.env, ...env },
      ...(process.platform === 'win32' ? { useConpty: true, useConptyDll: true } : {})
    });
    const id = crypto.randomUUID();
    const snapshot: TerminalSessionSnapshot = {
      id, title: `${profileTitle(profile)} ${this.sessions.size + 1}`, profile, cwd, cols, rows,
      status: 'running', pid: child.pid, createdAt: new Date().toISOString(), sequence: 0, buffer: ''
    };
    const record: SessionRecord = { snapshot, process: child, disposables: [] };
    record.disposables.push(child.onData(data => {
      snapshot.sequence += 1;
      snapshot.buffer = trimBuffer(snapshot.buffer + data);
      this.emit({ kind: 'data', session: clone(snapshot), data });
    }));
    record.disposables.push(child.onExit(event => {
      if (snapshot.status === 'exited') return;
      snapshot.status = 'exited'; snapshot.exitCode = event.exitCode; snapshot.sequence += 1;
      this.emit({ kind: 'exited', session: clone(snapshot) });
    }));
    this.sessions.set(id, record); this.emit({ kind: 'created', session: clone(snapshot) });
    return clone(snapshot);
  }

  list(): TerminalSessionSnapshot[] { return [...this.sessions.values()].map(record => clone(record.snapshot)); }
  get(id: string): TerminalSessionSnapshot | null { const record = this.sessions.get(id); return record ? clone(record.snapshot) : null; }

  write(id: string, data: string): void {
    const record = this.requireRunning(id);
    if (typeof data !== 'string' || data.length === 0 || data.length > 64 * 1024) throw new Error('终端输入必须为 1 至 65536 个字符。');
    record.process.write(data);
  }

  resize(id: string, cols: number, rows: number): TerminalSessionSnapshot {
    const record = this.requireRunning(id); const nextCols = dimension(cols, 80, 20, 500); const nextRows = dimension(rows, 24, 5, 200);
    record.process.resize(nextCols, nextRows); record.snapshot.cols = nextCols; record.snapshot.rows = nextRows; record.snapshot.sequence += 1;
    this.emit({ kind: 'resized', session: clone(record.snapshot) }); return clone(record.snapshot);
  }

  close(id: string): boolean {
    const record = this.sessions.get(id); if (!record) return false;
    this.sessions.delete(id); record.disposables.forEach(item => item.dispose());
    if (record.snapshot.status === 'running') record.process.kill();
    record.snapshot.status = 'exited'; record.snapshot.sequence += 1;
    this.emit({ kind: 'closed', session: clone(record.snapshot) }); return true;
  }

  closeAll(): void { [...this.sessions.keys()].forEach(id => this.close(id)); }
  subscribe(listener: (event: TerminalEvent) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private requireRunning(id: string): SessionRecord {
    const record = this.sessions.get(id); if (!record) throw new Error('终端会话不存在或已关闭。');
    if (record.snapshot.status !== 'running') throw new Error('终端进程已经退出，请新建终端。');
    return record;
  }

  private async resolveCwd(requested?: string): Promise<string> {
    const candidate = path.resolve(this.workspaceRoot, requested?.trim() || '.');
    const relative = path.relative(this.workspaceRoot, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('终端工作目录不能超出当前工作区。');
    const realRoot = await fs.realpath(this.workspaceRoot); const realCandidate = await fs.realpath(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (realRelative.startsWith('..') || path.isAbsolute(realRelative) || !(await fs.stat(realCandidate)).isDirectory()) throw new Error('终端工作目录无效或通过链接越过工作区。');
    return realCandidate;
  }

  private emit(event: TerminalEvent): void { this.listeners.forEach(listener => listener(event)); }
}

function resolveShell(profile: TerminalProfile): { file: string; args: string[] } {
  if (process.platform === 'win32') return profile === 'cmd'
    ? { file: process.env.ComSpec || 'cmd.exe', args: ['/Q'] }
    : { file: 'powershell.exe', args: ['-NoLogo'] };
  return { file: process.env.SHELL || '/bin/sh', args: [] };
}
function normalizeProfile(profile?: TerminalProfile): TerminalProfile {
  if (process.platform !== 'win32') return 'shell';
  return profile === 'cmd' ? 'cmd' : 'powershell';
}
function profileTitle(profile: TerminalProfile): string { return profile === 'cmd' ? '命令提示符' : profile === 'powershell' ? 'PowerShell' : 'Shell'; }
function dimension(value: unknown, fallback: number, min: number, max: number): number { return typeof value === 'number' && Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback; }
function validateEnvironment(env?: Record<string, string>): Record<string, string> {
  if (!env) return {};
  const entries = Object.entries(env);
  if (entries.length > 64 || entries.some(([key, value]) => !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(key) || typeof value !== 'string' || value.length > 4096 || /\0/u.test(value))) throw new Error('终端环境变量名称、数量或内容无效。');
  return Object.fromEntries(entries);
}
function trimBuffer(value: string): string { return value.length <= MAX_BUFFER ? value : value.slice(value.length - MAX_BUFFER); }
function clone(snapshot: TerminalSessionSnapshot): TerminalSessionSnapshot { return { ...snapshot }; }
