import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';

export type ManagedAiBridgePermission = 'readonly' | 'preview' | 'yolo';
export type ManagedAiBridgeLifecycle = 'workspace' | 'ide';
export type ManagedAiBridgeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ManagedAiBridgeClient {
  id: string;
  connectedAt: string;
  lastActiveAt: string;
  userAgent: string;
}

export interface ManagedAiBridgeActivity {
  id: string;
  timestamp: string;
  clientId: string;
  kind: 'connected' | 'disconnected' | 'tool';
  tool?: string;
  ok: boolean;
  durationMs?: number;
  message: string;
}

export interface ManagedAiBridgeSnapshot {
  state: ManagedAiBridgeState;
  workspaceRoot: string;
  permission: ManagedAiBridgePermission;
  lifecycle: ManagedAiBridgeLifecycle;
  host: '127.0.0.1';
  port: number;
  httpUrl: string;
  mcpUrl: string;
  startedAt: string | null;
  pid: number | null;
  tokenMasked: string;
  tokenAvailable: boolean;
  activeClients: number;
  clients: ManagedAiBridgeClient[];
  recentActivity: ManagedAiBridgeActivity[];
  logs: string[];
  error: string;
}

export interface StartManagedAiBridgeRequest {
  workspaceRoot: string;
  port?: number;
  permission?: ManagedAiBridgePermission;
  lifecycle?: ManagedAiBridgeLifecycle;
  token?: string;
  moduleAccessState?: string;
}

export interface AiBridgeManagerOptions {
  runtimeExecutable: string;
  cliEntryPath: string;
  environment?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  fetcher?: typeof fetch;
  spawnProcess?: typeof spawn;
}

const READY_PREFIX = 'LINGBUILDER_AI_BRIDGE_READY ';
const MAX_LOGS = 200;

export class AiBridgeManagerService {
  private process: ChildProcess | null = null;
  private token = '';
  private moduleAccessState = '';
  private listeners = new Set<(snapshot: ManagedAiBridgeSnapshot) => void>();
  private stopExpected = false;
  private snapshotValue: ManagedAiBridgeSnapshot = emptySnapshot();

  constructor(private readonly options: AiBridgeManagerOptions) {}

  snapshot(): ManagedAiBridgeSnapshot {
    return cloneSnapshot(this.snapshotValue);
  }

  revealToken(): string {
    if (this.snapshotValue.state !== 'running' || !this.token) throw new Error('AI Bridge 尚未运行，当前没有可用 Token。');
    return this.token;
  }

  subscribe(listener: (snapshot: ManagedAiBridgeSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(request: StartManagedAiBridgeRequest): Promise<ManagedAiBridgeSnapshot> {
    if (this.snapshotValue.state === 'starting' || this.snapshotValue.state === 'stopping') throw new Error('AI Bridge 正在切换状态，请稍候。');
    if (this.snapshotValue.state === 'running') throw new Error('AI Bridge 已经运行；修改端口、权限或工作区前请先停止。');
    const workspaceRoot = await validateWorkspaceRoot(request.workspaceRoot);
    const port = validatePort(request.port ?? 17860);
    const permission = validatePermission(request.permission ?? 'preview');
    const lifecycle = request.lifecycle === 'ide' ? 'ide' : 'workspace';
    const token = validateToken(request.token) || crypto.randomBytes(32).toString('hex');
    this.moduleAccessState = request.moduleAccessState || '';
    await fs.access(this.options.cliEntryPath);

    this.stopExpected = false;
    this.token = token;
    this.snapshotValue = {
      ...emptySnapshot(), state: 'starting', workspaceRoot, permission, lifecycle, port,
      tokenMasked: maskToken(token), tokenAvailable: true, logs: ['正在启动 AI Bridge…']
    };
    this.emit();

    const child = this.options.spawnProcess?.(
      this.options.runtimeExecutable,
      [this.options.cliEntryPath, 'ai-server', '--workspace', workspaceRoot, '--host', '127.0.0.1', '--port', String(port), '--permission', permission],
      { cwd: workspaceRoot, env: { ...(this.options.environment || process.env), ELECTRON_RUN_AS_NODE: '1', LINGBUILDER_AI_BRIDGE_TOKEN: token, LINGBUILDER_MODULE_ACCESS_STATE: this.moduleAccessState }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    ) || spawn(
      this.options.runtimeExecutable,
      [this.options.cliEntryPath, 'ai-server', '--workspace', workspaceRoot, '--host', '127.0.0.1', '--port', String(port), '--permission', permission],
      { cwd: workspaceRoot, env: { ...(this.options.environment || process.env), ELECTRON_RUN_AS_NODE: '1', LINGBUILDER_AI_BRIDGE_TOKEN: token, LINGBUILDER_MODULE_ACCESS_STATE: this.moduleAccessState }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    this.process = child;
    this.snapshotValue.pid = child.pid ?? null;

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let resolveReady!: (value: { origin: string; port: number }) => void;
    let rejectReady!: (reason: Error) => void;
    const ready = new Promise<{ origin: string; port: number }>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    let readySettled = false;
    const settleReady = (error?: Error, value?: { origin: string; port: number }) => {
      if (readySettled) return;
      readySettled = true;
      if (error) rejectReady(error); else resolveReady(value!);
    };
    const consume = (source: 'stdout' | 'stderr', chunk: Buffer | string) => {
      const current = (source === 'stdout' ? stdoutBuffer : stderrBuffer) + String(chunk);
      const lines = current.split(/\r?\n/u);
      if (source === 'stdout') stdoutBuffer = lines.pop() || ''; else stderrBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.trim()) continue;
        this.appendLog(line.trim());
        if (!line.startsWith(READY_PREFIX)) continue;
        try {
          const parsed = JSON.parse(line.slice(READY_PREFIX.length)) as { origin?: unknown; port?: unknown; host?: unknown };
          if (parsed.host !== '127.0.0.1' || typeof parsed.origin !== 'string' || !Number.isInteger(parsed.port)) throw new Error('CLI 返回的 Bridge 地址无效。');
          settleReady(undefined, { origin: parsed.origin, port: parsed.port as number });
        } catch (error) {
          settleReady(error instanceof Error ? error : new Error(String(error)));
        }
      }
    };
    child.stdout?.on('data', chunk => consume('stdout', chunk));
    child.stderr?.on('data', chunk => consume('stderr', chunk));
    child.once('error', error => settleReady(error));
    child.once('exit', code => {
      if (this.process !== child) return;
      this.process = null;
      settleReady(new Error(`AI Bridge 在启动完成前退出，退出码 ${code ?? '未知'}。`));
      if (this.stopExpected) return;
      this.token = '';
      this.snapshotValue = { ...this.snapshotValue, state: 'error', pid: null, tokenAvailable: false, tokenMasked: '', activeClients: 0, clients: [], error: `AI Bridge 进程意外退出，退出码 ${code ?? '未知'}。` };
      this.emit();
    });

    const timeout = setTimeout(() => settleReady(new Error(`等待 AI Bridge 启动超过 ${(this.options.startupTimeoutMs ?? 15_000) / 1000} 秒。`)), this.options.startupTimeoutMs ?? 15_000);
    try {
      const result = await ready;
      clearTimeout(timeout);
      const httpUrl = `${result.origin}/api/ai-bridge`;
      await this.checkHealth(httpUrl, token);
      this.snapshotValue = {
        ...this.snapshotValue, state: 'running', port: result.port, httpUrl, mcpUrl: `${httpUrl}/mcp`,
        startedAt: new Date().toISOString(), error: ''
      };
      this.emit();
      await this.refreshRuntime();
      return this.snapshot();
    } catch (error) {
      clearTimeout(timeout);
      await this.stop('启动失败').catch(() => undefined);
      this.snapshotValue = { ...this.snapshotValue, state: 'error', error: error instanceof Error ? error.message : String(error) };
      this.emit();
      throw error;
    }
  }

  async stop(reason = '用户停止'): Promise<ManagedAiBridgeSnapshot> {
    const child = this.process;
    if (!child) {
      this.token = '';
      this.snapshotValue = { ...emptySnapshot(), logs: this.snapshotValue.logs, error: this.snapshotValue.state === 'error' ? this.snapshotValue.error : '' };
      this.emit();
      return this.snapshot();
    }
    this.stopExpected = true;
    this.snapshotValue = { ...this.snapshotValue, state: 'stopping', activeClients: 0, clients: [] };
    this.appendLog(`${reason}，正在停止 AI Bridge…`);
    child.kill('SIGTERM');
    const exited = await waitForExit(child, 5_000);
    if (!exited) child.kill('SIGKILL');
    await waitForExit(child, 2_000);
    if (this.process === child) this.process = null;
    this.token = '';
    this.snapshotValue = { ...emptySnapshot(), logs: [...this.snapshotValue.logs, 'AI Bridge 已停止。'].slice(-MAX_LOGS) };
    this.emit();
    return this.snapshot();
  }

  async rotateToken(): Promise<ManagedAiBridgeSnapshot> {
    if (this.snapshotValue.state !== 'running') throw new Error('只有运行中的 AI Bridge 可以重新生成 Token。');
    const current = this.snapshot();
    await this.stop('重新生成 Token');
    return await this.start({
      workspaceRoot: current.workspaceRoot, port: current.port, permission: current.permission,
      lifecycle: current.lifecycle, moduleAccessState: this.moduleAccessState
    });
  }

  async refreshRuntime(): Promise<ManagedAiBridgeSnapshot> {
    if (this.snapshotValue.state !== 'running' || !this.token || !this.snapshotValue.mcpUrl) return this.snapshot();
    try {
      const response = await (this.options.fetcher || fetch)(`${this.snapshotValue.mcpUrl}/status`, { headers: { Authorization: `Bearer ${this.token}` } });
      const result = await response.json() as { activeClients?: unknown; clients?: unknown; recentActivity?: unknown; error?: unknown };
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `HTTP ${response.status}`);
      this.snapshotValue = {
        ...this.snapshotValue,
        activeClients: Number.isInteger(result.activeClients) ? result.activeClients as number : 0,
        clients: Array.isArray(result.clients) ? result.clients.slice(0, 50) as ManagedAiBridgeClient[] : [],
        recentActivity: Array.isArray(result.recentActivity) ? result.recentActivity.slice(0, 100) as ManagedAiBridgeActivity[] : []
      };
      this.emit();
    } catch (error) {
      this.snapshotValue = { ...this.snapshotValue, error: `状态刷新失败：${error instanceof Error ? error.message : String(error)}` };
      this.emit();
    }
    return this.snapshot();
  }

  private async checkHealth(httpUrl: string, token: string): Promise<void> {
    const response = await (this.options.fetcher || fetch)(`${httpUrl}/health`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`AI Bridge 健康检查失败：HTTP ${response.status}`);
  }

  private appendLog(message: string): void {
    this.snapshotValue.logs = [...this.snapshotValue.logs, `${new Date().toLocaleTimeString('zh-CN', { hour12: false })} ${redactToken(message, this.token)}`].slice(-MAX_LOGS);
    this.emit();
  }

  private emit(): void {
    const value = this.snapshot();
    this.listeners.forEach(listener => listener(value));
  }
}

async function validateWorkspaceRoot(value: string): Promise<string> {
  if (!value?.trim() || !path.isAbsolute(value)) throw new Error('AI Bridge 工作区必须是绝对路径。');
  const resolved = await fs.realpath(path.resolve(value));
  if (!(await fs.stat(resolved)).isDirectory()) throw new Error('AI Bridge 工作区不是有效目录。');
  return resolved;
}

function validatePort(value: number): number {
  if (!Number.isInteger(value) || value < 1024 || value > 65_535) throw new Error('AI Bridge 端口必须是 1024 至 65535 的整数。');
  return value;
}

function validatePermission(value: string): ManagedAiBridgePermission {
  if (value === 'readonly' || value === 'preview' || value === 'yolo') return value;
  throw new Error('AI Bridge 权限必须是 readonly、preview 或 yolo。');
}

function validateToken(value?: string): string {
  const token = value?.trim() || '';
  if (!token) return '';
  if (token.length < 24 || token.length > 256 || /[\s\0]/u.test(token)) throw new Error('自定义 Token 必须为 24 至 256 个不含空白的字符。');
  return token;
}

function maskToken(token: string): string {
  return token.length < 12 ? '••••••••' : `${token.slice(0, 4)}••••••••${token.slice(-4)}`;
}

function redactToken(value: string, token: string): string {
  return token ? value.split(token).join('[已隐藏 Token]') : value;
}

function emptySnapshot(): ManagedAiBridgeSnapshot {
  return {
    state: 'stopped', workspaceRoot: '', permission: 'preview', lifecycle: 'workspace', host: '127.0.0.1', port: 17860,
    httpUrl: '', mcpUrl: '', startedAt: null, pid: null, tokenMasked: '', tokenAvailable: false,
    activeClients: 0, clients: [], recentActivity: [], logs: [], error: ''
  };
}

function cloneSnapshot(value: ManagedAiBridgeSnapshot): ManagedAiBridgeSnapshot {
  return {
    ...value,
    clients: value.clients.map(item => ({ ...item })),
    recentActivity: value.recentActivity.map(item => ({ ...item })),
    logs: [...value.logs]
  };
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null) return true;
  return await new Promise(resolve => {
    const timer = setTimeout(() => { child.off('exit', onExit); resolve(false); }, timeoutMs);
    const onExit = () => { clearTimeout(timer); resolve(true); };
    child.once('exit', onExit);
  });
}
