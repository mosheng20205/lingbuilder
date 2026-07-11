import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
export interface PerformanceSample { elapsedMs: number; cpuMs: number; workingSetBytes: number; readBytes: number; writeBytes: number }
export interface PerformanceHotFunction { name: string; selfMs: number; totalMs: number }
export interface PerformanceReport { state: 'completed' | 'cancelled'; durationMs: number; samples: PerformanceSample[]; hotFunctions: PerformanceHotFunction[]; summary: { peakWorkingSetBytes: number; cpuMs: number; readBytes: number; writeBytes: number } }

type Sampler = (pid: number) => Promise<Omit<PerformanceSample, 'elapsedMs'>>;

export class PerformanceService {
  private active: { child: ChildProcess; cancelled: boolean } | null = null;
  constructor(private readonly workspaceRoot: string, private readonly sampler: Sampler = sampleProcess) {}

  async collect(options: { executablePath: string; args?: string[]; intervalMs?: number; durationMs?: number }): Promise<PerformanceReport> {
    if (this.active) throw new Error('已有性能采集任务正在运行。');
    const executable = await this.resolveFile(options.executablePath); const args = validateArgs(options.args); const interval = bounded(options.intervalMs, 100, 5000, 250); const duration = bounded(options.durationMs, interval, 300_000, 5000);
    const child = spawn(executable, args, { cwd: await fs.realpath(this.workspaceRoot), windowsHide: true, stdio: 'ignore' }); const active = { child, cancelled: false }; this.active = active;
    const started = Date.now(); const samples: PerformanceSample[] = [];
    try {
      while (!active.cancelled && child.exitCode === null && Date.now() - started < duration) {
        await delay(interval); if (child.exitCode !== null) break;
        try { samples.push({ elapsedMs: Date.now() - started, ...await this.sampler(child.pid!) }); } catch { if (child.exitCode === null) throw new Error('无法读取目标进程性能计数器。'); }
      }
      if (child.exitCode === null) { child.kill(); await waitForExit(child); }
      return summarize(active.cancelled ? 'cancelled' : 'completed', Date.now() - started, samples, []);
    } finally { if (child.exitCode === null) child.kill(); if (this.active === active) this.active = null; }
  }

  cancel(): boolean { if (!this.active) return false; this.active.cancelled = true; this.active.child.kill(); return true; }

  async importCpuProfile(relativePath: string): Promise<PerformanceReport> {
    const file = await this.resolveFile(relativePath); let profile: any; try { profile = JSON.parse(await fs.readFile(file, 'utf8')); } catch { throw new Error('CPU Profile JSON 无效。'); }
    if (!Array.isArray(profile.nodes) || !Array.isArray(profile.samples) || !Array.isArray(profile.timeDeltas)) throw new Error('CPU Profile 缺少 nodes、samples 或 timeDeltas。');
    const nodes = new Map(profile.nodes.map((node: any) => [Number(node.id), node])); const totals = new Map<string, number>(); let duration = 0;
    profile.samples.slice(0, 1_000_000).forEach((id: unknown, index: number) => { const micros = Math.max(0, Number(profile.timeDeltas[index] || 0)); duration += micros; const node: any = nodes.get(Number(id)); const name = String(node?.callFrame?.functionName || '(匿名函数)').slice(0, 200); totals.set(name, (totals.get(name) || 0) + micros / 1000); });
    const hotFunctions = [...totals].map(([name, selfMs]) => ({ name, selfMs: round(selfMs), totalMs: round(selfMs) })).sort((a, b) => b.selfMs - a.selfMs).slice(0, 100);
    return summarize('completed', Math.round(duration / 1000), [], hotFunctions);
  }

  private async resolveFile(value: string): Promise<string> { const root = await fs.realpath(this.workspaceRoot); const file = await fs.realpath(path.resolve(root, value)); const relative = path.relative(root, file); if (relative.startsWith('..') || path.isAbsolute(relative) || !(await fs.stat(file)).isFile()) throw new Error('性能分析路径不能超出当前工作区。'); return file; }
}

export function summarize(state: PerformanceReport['state'], durationMs: number, samples: PerformanceSample[], hotFunctions: PerformanceHotFunction[]): PerformanceReport { const last = samples.at(-1); return { state, durationMs, samples: samples.slice(0, 5000), hotFunctions, summary: { peakWorkingSetBytes: Math.max(0, ...samples.map(item => item.workingSetBytes)), cpuMs: last?.cpuMs || 0, readBytes: last?.readBytes || 0, writeBytes: last?.writeBytes || 0 } }; }
async function sampleProcess(pid: number): Promise<Omit<PerformanceSample, 'elapsedMs'>> { if (process.platform === 'win32') { const script = `$p=Get-CimInstance Win32_Process -Filter "ProcessId=${pid}"; if(!$p){exit 3}; @($p.KernelModeTime,$p.UserModeTime,$p.WorkingSetSize,$p.ReadTransferCount,$p.WriteTransferCount)-join ','`; const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 }); const [kernel, user, memory, read, write] = stdout.trim().split(',').map(Number); return { cpuMs: (kernel + user) / 10_000, workingSetBytes: memory, readBytes: read, writeBytes: write }; } const [stat, io, status] = await Promise.all([fs.readFile(`/proc/${pid}/stat`, 'utf8'), fs.readFile(`/proc/${pid}/io`, 'utf8'), fs.readFile(`/proc/${pid}/status`, 'utf8')]); const fields = stat.split(' '); const ticks = Number(fields[13]) + Number(fields[14]); return { cpuMs: ticks * 10, workingSetBytes: Number(status.match(/^VmRSS:\s+(\d+)/mu)?.[1] || 0) * 1024, readBytes: Number(io.match(/^read_bytes:\s+(\d+)/mu)?.[1] || 0), writeBytes: Number(io.match(/^write_bytes:\s+(\d+)/mu)?.[1] || 0) }; }
function validateArgs(args?: string[]): string[] { if (!args) return []; if (!Array.isArray(args) || args.length > 64 || args.some(arg => typeof arg !== 'string' || arg.length > 4096 || /[\0\r\n]/u.test(arg))) throw new Error('性能分析参数无效。'); return [...args]; }
function bounded(value: number | undefined, min: number, max: number, fallback: number): number { const number = value ?? fallback; if (!Number.isFinite(number) || number < min || number > max) throw new Error('性能采集时间参数无效。'); return Math.round(number); }
function round(value: number): number { return Number(value.toFixed(3)); }
function delay(ms: number): Promise<void> { return new Promise(resolve => setTimeout(resolve, ms)); }
function waitForExit(child: ChildProcess): Promise<void> { if (child.exitCode !== null) return Promise.resolve(); return new Promise(resolve => { child.once('exit', () => resolve()); setTimeout(resolve, 2000); }); }
