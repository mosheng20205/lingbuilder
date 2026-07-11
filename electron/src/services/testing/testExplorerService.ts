import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const MODULE_BASE = typeof __dirname === 'string' ? __dirname : process.cwd();
export const TSX_IMPORT = pathToFileURL(createRequire(path.join(MODULE_BASE, 'package.json')).resolve('tsx')).href;
export type TestKind = 'node' | 'ctest';
export interface DiscoveredTest { id: string; kind: TestKind; name: string; suite?: string; filePath?: string; line?: number; command?: string[]; cwd: string; skipped?: boolean }
export interface TestRunResult { testId: string; state: 'passed' | 'failed' | 'skipped'; durationMs: number; stdout: string; stderr: string; exitCode: number | null; startedAt: string; completedAt: string }
type CommandRunner = (command: string, args: string[], options: { cwd: string; timeout: number; signal?: AbortSignal }) => Promise<{ stdout: string; stderr: string }>;

export class TestExplorerService {
  private cache = new Map<string, DiscoveredTest>();
  constructor(private readonly workspaceRoot: string, private readonly runner: CommandRunner = defaultRunner) {}

  async discover(): Promise<DiscoveredTest[]> {
    const root = await fs.realpath(this.workspaceRoot); const files = await walk(root); const tests: DiscoveredTest[] = [];
    for (const file of files) {
      if (isNodeTestFile(file)) tests.push(...await this.discoverNodeFile(root, file));
      else if (path.basename(file) === 'CTestTestfile.cmake') tests.push(...await this.discoverCTest(root, path.dirname(file)));
    }
    tests.sort((a, b) => `${a.kind}:${a.filePath || a.cwd}:${a.line || 0}:${a.name}`.localeCompare(`${b.kind}:${b.filePath || b.cwd}:${b.line || 0}:${b.name}`)); this.cache = new Map(tests.map(item => [item.id, item])); return tests;
  }

  list(): DiscoveredTest[] { return [...this.cache.values()]; }
  get(testId: string): DiscoveredTest { const test = this.cache.get(testId); if (!test) throw new Error('测试不存在或发现结果已过期，请刷新测试列表。'); return test; }

  async run(testId: string, signal?: AbortSignal): Promise<TestRunResult> {
    const test = this.get(testId); if (test.skipped) return this.result(test, 'skipped', 0, '', '', null, new Date()); const started = new Date();
    try {
      const execution = test.kind === 'node' ? await this.runNode(test, signal) : await this.runCTest(test, signal);
      return this.result(test, 'passed', Date.now() - started.getTime(), execution.stdout, execution.stderr, 0, started);
    } catch (error: any) {
      return this.result(test, signal?.aborted ? 'skipped' : 'failed', Date.now() - started.getTime(), String(error?.stdout || ''), String(error?.stderr || error?.message || '测试运行失败。'), Number.isInteger(error?.code) ? error.code : 1, started);
    }
  }

  debugConfiguration(testId: string): { adapter: 'node-inspector' | 'lldb-dap'; program: string; args: string[]; cwd: string; test: DiscoveredTest } {
    const test = this.get(testId);
    if (test.kind === 'node') return { adapter: 'node-inspector', program: process.execPath, args: ['--inspect-brk=127.0.0.1:0', '--import', TSX_IMPORT, path.resolve(test.cwd, test.filePath!)], cwd: test.cwd, test };
    const command = test.command || []; if (!command[0]) throw new Error('CTest 没有提供可调试的测试命令。'); return { adapter: 'lldb-dap', program: command[0], args: command.slice(1), cwd: test.cwd, test };
  }

  private async discoverNodeFile(root: string, file: string): Promise<DiscoveredTest[]> {
    const text = await fs.readFile(file, 'utf8'); const relative = normalize(path.relative(root, file)); const result: DiscoveredTest[] = []; const lines = text.split(/\r?\n/u);
    const pattern = /\b(test|it)(?:\.(only|skip|todo))?\s*\(\s*(['"`])([^'"`]+)\3/u;
    lines.forEach((line, index) => { const match = line.match(pattern); if (!match) return; const name = match[4].trim(); if (!name) return; result.push({ id: id('node', relative, String(index + 1), name), kind: 'node', name, filePath: relative, line: index + 1, cwd: root, skipped: match[2] === 'skip' || match[2] === 'todo' }); }); return result;
  }
  private async discoverCTest(root: string, directory: string): Promise<DiscoveredTest[]> {
    let output: { stdout: string; stderr: string }; try { output = await this.runner(await findCMakeTool('ctest'), ['--show-only=json-v1', '--build-config', 'Debug', '--test-dir', directory], { cwd: directory, timeout: 30_000 }); } catch { return []; }
    let data: any; try { data = JSON.parse(output.stdout); } catch { return []; }
    return (data.tests || []).slice(0, 5000).map((item: any) => { const command = Array.isArray(item.command) ? item.command.map(String) : []; const workingDirectory = item.properties?.find((property: any) => property.name === 'WORKING_DIRECTORY')?.value; const cwd = typeof workingDirectory === 'string' && path.isAbsolute(workingDirectory) ? workingDirectory : directory; const relativeDir = normalize(path.relative(root, directory)); return { id: id('ctest', relativeDir, String(item.name)), kind: 'ctest' as const, name: String(item.name), suite: relativeDir || 'CTest', command, cwd, skipped: Boolean(item.properties?.some((property: any) => property.name === 'DISABLED' && property.value)) }; });
  }
  private async runNode(test: DiscoveredTest, signal?: AbortSignal) { const file = await this.resolveWorkspaceFile(test.filePath!); return await this.runner(process.execPath, ['--import', TSX_IMPORT, '--test', '--test-name-pattern', exactPattern(test.name), file], { cwd: test.cwd, timeout: 120_000, signal }); }
  private async runCTest(test: DiscoveredTest, signal?: AbortSignal) { const command = test.command || []; if (!command[0]) throw new Error('CTest 没有提供可运行的测试命令。'); return await this.runner(command[0], command.slice(1), { cwd: test.cwd, timeout: 120_000, signal }); }
  private async resolveWorkspaceFile(relative: string): Promise<string> { const root = await fs.realpath(this.workspaceRoot); const candidate = await fs.realpath(path.resolve(root, relative)); const check = path.relative(root, candidate); if (check.startsWith('..') || path.isAbsolute(check)) throw new Error('测试文件不能超出当前工作区。'); return candidate; }
  private result(test: DiscoveredTest, state: TestRunResult['state'], durationMs: number, stdout: string, stderr: string, exitCode: number | null, started: Date): TestRunResult { return { testId: test.id, state, durationMs, stdout: bounded(stdout), stderr: bounded(stderr), exitCode, startedAt: started.toISOString(), completedAt: new Date().toISOString() }; }
}

async function defaultRunner(command: string, args: string[], options: { cwd: string; timeout: number; signal?: AbortSignal }) { const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; return await execFileAsync(command, args, { ...options, env, windowsHide: true, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8' }) as { stdout: string; stderr: string }; }
async function walk(root: string): Promise<string[]> { const result: string[] = []; const queue = [root]; while (queue.length && result.length < 20_000) { const directory = queue.shift()!; let entries: any[]; try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { continue; } for (const entry of entries) { if (entry.isSymbolicLink()) continue; const target = path.join(directory, entry.name); if (entry.isDirectory()) { if (!shouldSkipDirectory(entry.name)) queue.push(target); } else if (entry.isFile() && (isNodeTestFile(target) || entry.name === 'CTestTestfile.cmake')) result.push(target); } } return result; }
function shouldSkipDirectory(name: string): boolean { return ['.git', 'node_modules', 'dist', 'dist-electron', 'release'].includes(name) || name.startsWith('.cache'); }
function isNodeTestFile(file: string): boolean { return /(?:^|[\\/])(?:test|tests|__tests__)(?:[\\/].*)?\.(?:test|spec)?\.(?:[cm]?js|tsx?)$/iu.test(file) || /\.(?:test|spec)\.(?:[cm]?js|tsx?)$/iu.test(file); }
function normalize(value: string): string { return value.replace(/\\/gu, '/'); }
function id(...parts: string[]): string { return crypto.createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 24); }
function exactPattern(value: string): string { return `^${value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}$`; }
function bounded(value: string): string { return value.length <= 2 * 1024 * 1024 ? value : `${value.slice(0, 2 * 1024 * 1024)}\n…输出已截断…`; }

export async function findCMakeTool(name: 'cmake' | 'ctest'): Promise<string> {
  const executable = process.platform === 'win32' ? `${name}.exe` : name; const candidates = [path.join(process.env.ProgramFiles || '', 'CMake', 'bin', executable)];
  if (process.platform === 'win32') {
    const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    try { const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-property', 'installationPath'], { windowsHide: true, encoding: 'utf8', timeout: 5000 })).stdout.trim(); if (installation) candidates.push(path.join(installation, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', executable)); } catch { /* try PATH below */ }
  }
  for (const candidate of candidates) try { if ((await fs.stat(candidate)).isFile()) return candidate; } catch { /* next */ }
  return executable;
}
