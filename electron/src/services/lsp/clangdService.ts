import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { JsonRpcConnection } from './jsonRpcConnection';

export type ClangdState = 'stopped' | 'starting' | 'ready' | 'restarting' | 'unavailable' | 'failed';
export interface ClangdStatus { state: ClangdState; message: string; restartCount: number; pid?: number }
export interface LspTextChange { range?: { start: { line: number; character: number }; end: { line: number; character: number } }; rangeLength?: number; text: string }
export interface ClangdProcess extends EventEmitter { stdin: ChildProcessWithoutNullStreams['stdin']; stdout: ChildProcessWithoutNullStreams['stdout']; stderr: ChildProcessWithoutNullStreams['stderr']; pid?: number; kill(signal?: NodeJS.Signals): boolean }
export interface ClangdServiceOptions {
  workspaceRoot: string; command?: string; args?: string[]; maxRestarts?: number; restartDelayMs?: number;
  spawnProcess?: (command: string, args: readonly string[], cwd: string) => ClangdProcess;
}

interface OpenDocument { uri: string; languageId: string; version: number; text: string }

export class ClangdService extends EventEmitter {
  private process: ClangdProcess | null = null;
  private connection: JsonRpcConnection | null = null;
  private status: ClangdStatus = { state: 'stopped', message: 'clangd 尚未启动。', restartCount: 0 };
  private readonly documents = new Map<string, OpenDocument>();
  private stopping = false;
  private starting: Promise<ClangdStatus> | null = null;

  constructor(private readonly options: ClangdServiceOptions) { super(); }
  getStatus(): ClangdStatus { return { ...this.status }; }

  async start(): Promise<ClangdStatus> {
    if (this.status.state === 'ready') return this.getStatus();
    if (this.status.state === 'unavailable' || this.status.state === 'failed') return this.getStatus();
    if (this.starting) return this.starting;
    this.stopping = false;
    this.starting = this.startProcess(this.status.restartCount > 0 ? 'restarting' : 'starting').finally(() => { this.starting = null; });
    return this.starting;
  }

  async restart(): Promise<ClangdStatus> {
    if (this.process || this.connection) await this.stop();
    this.status = { state: 'stopped', message: '正在重试 clangd。', restartCount: 0 };
    return this.start();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    const connection = this.connection; const process = this.process;
    this.connection = null; this.process = null;
    if (connection) {
      try { await connection.request('shutdown', undefined, AbortSignal.timeout(1500)); connection.notify('exit'); } catch { /* force below */ }
      connection.dispose();
    }
    process?.kill();
    this.setStatus('stopped', 'clangd 已停止。');
  }

  async openDocument(filePath: string, text: string, languageId = 'cpp'): Promise<void> {
    await this.ensureReady();
    const uri = toUri(filePath); const document = { uri, languageId, version: 1, text };
    this.documents.set(uri, document);
    this.connection!.notify('textDocument/didOpen', { textDocument: document });
  }

  async changeDocument(filePath: string, changes: LspTextChange[]): Promise<number> {
    await this.ensureReady();
    const uri = toUri(filePath); const document = this.documents.get(uri);
    if (!document) throw new Error('文档尚未通过 LSP 打开。');
    document.version += 1;
    const full = changes.find(change => !change.range); if (full) document.text = full.text;
    this.connection!.notify('textDocument/didChange', { textDocument: { uri, version: document.version }, contentChanges: changes });
    return document.version;
  }

  async closeDocument(filePath: string): Promise<void> {
    const uri = toUri(filePath); if (!this.documents.delete(uri)) return;
    this.connection?.notify('textDocument/didClose', { textDocument: { uri } });
  }

  async request<T>(method: string, params: unknown, signal?: AbortSignal): Promise<T> {
    await this.ensureReady(); return this.connection!.request<T>(method, params, signal);
  }

  private async ensureReady(): Promise<void> {
    const status = await this.start();
    if (status.state !== 'ready') throw new Error(status.message);
  }

  private async startProcess(state: 'starting' | 'restarting'): Promise<ClangdStatus> {
    this.setStatus(state, state === 'starting' ? '正在启动 clangd…' : '正在重启 clangd…');
    const command = this.options.command || 'clangd';
    try {
      const process = (this.options.spawnProcess || defaultSpawn)(command, this.options.args || ['--background-index', '--clang-tidy'], this.options.workspaceRoot);
      this.process = process;
      /* spawn 失败（如未安装 clangd 的 ENOENT）以异步 'error' 事件到达而不是同步抛出；
       * 必须先挂监听，否则未处理的 'error' 事件会拖垮整个 IDE server。 */
      const spawnFailure = new Promise<never>((_, reject) => process.once('error', reject));
      spawnFailure.catch(() => undefined);
      process.stderr.on('data', chunk => this.emit('log', String(chunk)));
      process.once('exit', (code, signal) => void this.handleExit(code, signal));
      const connection = new JsonRpcConnection(process.stdout, process.stdin);
      this.connection = connection;
      connection.on('notification', (method, params) => {
        if (method === 'textDocument/publishDiagnostics') this.emit('diagnostics', params);
        else this.emit('notification', method, params);
      });
      const initializeRequest = connection.request('initialize', {
        processId: process.pid || null,
        rootUri: pathToFileURL(path.resolve(this.options.workspaceRoot)).href,
        capabilities: { textDocument: { synchronization: { dynamicRegistration: false }, publishDiagnostics: { relatedInformation: true } } },
        workspaceFolders: [{ uri: pathToFileURL(path.resolve(this.options.workspaceRoot)).href, name: path.basename(this.options.workspaceRoot) }]
      }, AbortSignal.timeout(10_000));
      /* 输家由双方各自的 catch 兑底，避免竞速后产生未处理拒绝。 */
      void initializeRequest.catch(() => undefined);
      await Promise.race([initializeRequest, spawnFailure]);
      connection.notify('initialized', {});
      for (const document of this.documents.values()) connection.notify('textDocument/didOpen', { textDocument: document });
      this.setStatus('ready', 'clangd 语言服务已就绪。', process.pid);
    } catch (error: any) {
      this.connection?.dispose(); this.connection = null; this.process = null;
      const unavailable = error?.code === 'ENOENT';
      this.setStatus(unavailable ? 'unavailable' : 'failed', unavailable
        ? '未找到 clangd，C/C++ 编辑已降级为本地语法高亮。'
        : `clangd 启动失败：${error instanceof Error ? error.message : String(error)}`);
    }
    return this.getStatus();
  }

  private async handleExit(code: number | null, signal: NodeJS.Signals | null): Promise<void> {
    this.connection?.dispose(`clangd 已退出（${code ?? signal ?? '未知'}）。`); this.connection = null; this.process = null;
    if (this.stopping) return;
    const maxRestarts = this.options.maxRestarts ?? 2;
    if (this.status.restartCount >= maxRestarts) { this.setStatus('failed', `clangd 连续退出，已停止自动重启。`); return; }
    this.status.restartCount += 1;
    this.setStatus('restarting', `clangd 意外退出，正在第 ${this.status.restartCount} 次重启。`);
    await new Promise(resolve => setTimeout(resolve, this.options.restartDelayMs ?? 250));
    if (!this.stopping) await this.start();
  }

  private setStatus(state: ClangdState, message: string, pid?: number): void {
    this.status = { ...this.status, state, message, pid }; this.emit('status', this.getStatus());
  }
}

const toUri = (filePath: string) => filePath.startsWith('file:') ? filePath : pathToFileURL(path.resolve(filePath)).href;
const defaultSpawn = (command: string, args: readonly string[], cwd: string): ClangdProcess => spawn(command, [...args], { cwd, shell: false, windowsHide: true, stdio: 'pipe' });
