import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

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

/** 监听指定端口的进程身份（netstat + Win32_Process 查询结果，查不到的字段留空）。 */
export interface AiBridgePortHolder {
  pid: number;
  name: string;
  commandLine: string;
  parentProcessId: number;
}

export interface AiBridgeManagerOptions {
  runtimeExecutable: string;
  cliEntryPath: string;
  environment?: NodeJS.ProcessEnv;
  startupTimeoutMs?: number;
  fetcher?: typeof fetch;
  spawnProcess?: typeof spawn;
  /** EADDRINUSE 自省：返回占用该端口的进程；null 表示查不到占用者。默认 netstat + PowerShell Win32_Process。 */
  portHolderResolver?: (port: number) => Promise<AiBridgePortHolder | null>;
  /** 结束占用进程；默认 taskkill /t /f。 */
  processTerminator?: (pid: number) => Promise<void>;
  /** 探测进程是否存活，用于区分「孤儿残留」与「仍在运行的宿主」。默认 process.kill(pid, 0)。 */
  processLivenessChecker?: (pid: number) => Promise<boolean>;
}

const READY_PREFIX = 'LINGBUILDER_AI_BRIDGE_READY ';
const MAX_LOGS = 200;

export class AiBridgeManagerService {
  private process: ChildProcess | null = null;
  private token = '';
  private moduleAccessState = '';
  private fbroVipKey = '';
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

  setFbroVipKey(value: string): void {
    this.fbroVipKey = String(value || '').trim().slice(0, 4096);
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

    try {
      let result: { origin: string; port: number };
      try {
        result = await this.launchChild(workspaceRoot, port, permission);
      } catch (firstError) {
        // 端口被占住时不直接失败：占用者是自家孤儿 Bridge 就地接管并重试一次，其余情况给出点名 PID 的错误。
        const tookOver = await this.resolvePortConflict(firstError, port);
        if (!tookOver) throw firstError;
        this.token = token;
        this.snapshotValue = { ...this.snapshotValue, state: 'starting', pid: null, error: '' };
        this.emit();
        result = await this.launchChild(workspaceRoot, port, permission);
      }
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
      await this.stop('启动失败').catch(() => undefined);
      this.snapshotValue = { ...this.snapshotValue, state: 'error', error: error instanceof Error ? error.message : String(error) };
      this.emit();
      throw error;
    }
  }

  /** 拉起 CLI 子进程并等待 READY 行；超时/提前退出以错误结束（快照状态由调用方善后）。 */
  private async launchChild(workspaceRoot: string, port: number, permission: ManagedAiBridgePermission): Promise<{ origin: string; port: number }> {
    const childEnvironment = {
      ...(this.options.environment || process.env),
      ELECTRON_RUN_AS_NODE: '1',
      LINGBUILDER_AI_BRIDGE_TOKEN: this.token,
      LINGBUILDER_MODULE_ACCESS_STATE: this.moduleAccessState,
      ...(this.fbroVipKey ? { LINGBUILDER_FBRO_VIP_KEY: this.fbroVipKey } : {})
    };
    const child = (this.options.spawnProcess || spawn)(
      this.options.runtimeExecutable,
      [this.options.cliEntryPath, 'ai-server', '--workspace', workspaceRoot, '--host', '127.0.0.1', '--port', String(port), '--permission', permission],
      { cwd: workspaceRoot, env: childEnvironment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );
    this.process = child;
    this.snapshotValue.pid = child.pid ?? null;

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let lastStderrLine = '';
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
        if (source === 'stderr') lastStderrLine = line.trim();
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
      const exitDetail = lastStderrLine || `退出码 ${code ?? '未知'}`;
      settleReady(new Error(`AI Bridge 在启动完成前退出：${exitDetail}`));
      if (this.stopExpected) return;
      this.token = '';
      this.snapshotValue = { ...this.snapshotValue, state: 'error', pid: null, tokenAvailable: false, tokenMasked: '', activeClients: 0, clients: [], error: `AI Bridge 进程意外退出：${exitDetail}` };
      this.emit();
    });

    const timeout = setTimeout(() => settleReady(new Error(`等待 AI Bridge 启动超过 ${(this.options.startupTimeoutMs ?? 15_000) / 1000} 秒。`)), this.options.startupTimeoutMs ?? 15_000);
    try {
      return await ready;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * 端口占用自愈（2026-10-29，issue#IKR4IP「端口被占用」）：
   * - 占用者是自家 cli.cjs ai-server 且其宿主 IDE 已退出（崩溃/被强杀留下的孤儿）→ 结束它并接管端口；
   * - 占用者是自家 Bridge 但宿主仍在运行（另一个 IDE 窗口或外部客户端拉起的进程）→ 不抢，报错点名 PID；
   * - 占用者是其他程序 → 报错点名 PID 与进程名，绝不误杀。
   * 返回 true 表示已完成接管、调用方应重试启动；其余情况抛出（或原样透传）错误。
   */
  private async resolvePortConflict(firstError: unknown, port: number): Promise<boolean> {
    if (process.platform !== 'win32') return false;
    const message = firstError instanceof Error ? firstError.message : String(firstError);
    if (parsePortOccupiedPort(message) !== port) return false;
    let holder: AiBridgePortHolder | null = null;
    try {
      holder = await (this.options.portHolderResolver || findPortHolder)(port);
    } catch {
      holder = null;
    }
    if (!holder) return false;
    if (!isOwnBridgeCommandLine(holder.commandLine, this.options.runtimeExecutable, this.options.cliEntryPath)) {
      throw new Error(`AI Bridge 监听失败：端口 ${port} 已被 ${holder.name || '未知进程'}（PID ${holder.pid}）占用。请结束该进程后再启动，或在连接中心更换监听端口。`);
    }
    const parentAlive = holder.parentProcessId > 0
      && await (this.options.processLivenessChecker || isProcessIdAlive)(holder.parentProcessId);
    if (parentAlive) {
      throw new Error(`AI Bridge 监听失败：端口 ${port} 正被另一个 LingBuilder AI Bridge 进程占用（PID ${holder.pid}，其宿主程序仍在运行）。同一端口同时只能服务一个工作区：请先在占用方的连接中心停止 AI Bridge，或更换本实例的监听端口。`);
    }
    try {
      await (this.options.processTerminator || terminateProcessTree)(holder.pid);
    } catch (reason) {
      throw new Error(`检测到残留的 AI Bridge 进程（PID ${holder.pid}），但结束失败：${reason instanceof Error ? reason.message : String(reason)}`);
    }
    if (!await waitForPortRelease(port, this.options.portHolderResolver || findPortHolder)) {
      throw new Error(`残留的 AI Bridge 进程（PID ${holder.pid}）已结束，但端口 ${port} 仍未释放，请稍后重试。`);
    }
    this.appendLog(`检测到残留的 AI Bridge 进程（PID ${holder.pid}），已结束并接管端口 ${port}，正在重新启动…`);
    return true;
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
        error: '',
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
  // 与 aiBridgeStartSettings.normalizeAiBridgeStartSettings 保持同一口径，避免「能启动但无法持久化」。
  if (token.length < 24 || token.length > 256 || /[^\x21-\x7e]/u.test(token)) {
    throw new Error('自定义 Token 必须为 24 至 256 个不含空白的可见 ASCII 字符。');
  }
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

function parsePortOccupiedPort(message: string): number | null {
  const match = /端口 (\d+) 已被占用/u.exec(message);
  if (!match) return null;
  const port = Number.parseInt(match[1], 10);
  return Number.isInteger(port) ? port : null;
}

/** netstat -ano 定位监听端口的 PID，再用 PowerShell Win32_Process 补全进程身份；任一步失败返回 null。 */
async function findPortHolder(port: number): Promise<AiBridgePortHolder | null> {
  if (process.platform !== 'win32') return null;
  const { stdout } = await execFileAsync('netstat', ['-ano', '-p', 'tcp'], { timeout: 5_000 });
  for (const line of stdout.split(/\r?\n/u)) {
    const columns = line.trim().split(/\s+/u);
    // `  TCP    127.0.0.1:17860    0.0.0.0:0    LISTENING    12345`（netstat 状态列不随系统语言本地化）
    if (columns.length < 5 || columns[0].toUpperCase() !== 'TCP' || columns[3].toUpperCase() !== 'LISTENING') continue;
    if (!columns[1].endsWith(`:${port}`)) continue;
    const pid = Number.parseInt(columns[4], 10);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    const description = await describeWindowsProcess(pid);
    return { pid, ...description };
  }
  return null;
}

async function describeWindowsProcess(pid: number): Promise<{ name: string; commandLine: string; parentProcessId: number }> {
  try {
    const script = `Get-CimInstance Win32_Process -Filter "ProcessId=${pid}" | Select-Object Name,CommandLine,ParentProcessId | ConvertTo-Json -Compress`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 8_000 });
    const parsed = JSON.parse(stdout.trim()) as { Name?: unknown; CommandLine?: unknown; ParentProcessId?: unknown } | null;
    if (!parsed || typeof parsed !== 'object') return { name: '', commandLine: '', parentProcessId: 0 };
    return {
      name: typeof parsed.Name === 'string' ? parsed.Name : '',
      commandLine: typeof parsed.CommandLine === 'string' ? parsed.CommandLine : '',
      parentProcessId: Number.isInteger(parsed.ParentProcessId) ? parsed.ParentProcessId as number : 0
    };
  } catch {
    return { name: '', commandLine: '', parentProcessId: 0 };
  }
}

/** 只认自家 Bridge：命令行同时包含本实例的运行时 exe 与 cli.cjs 路径并带 ai-server 子命令。 */
function isOwnBridgeCommandLine(commandLine: string, runtimeExecutable: string, cliEntryPath: string): boolean {
  if (!commandLine) return false;
  const normalize = (value: string) => value.replace(/\//gu, '\\').toLowerCase();
  const line = normalize(commandLine);
  return line.includes('ai-server')
    && line.includes(normalize(runtimeExecutable))
    && line.includes(normalize(cliEntryPath));
}

async function terminateProcessTree(pid: number): Promise<void> {
  await execFileAsync('taskkill', ['/pid', String(pid), '/t', '/f'], { timeout: 5_000 });
}

async function isProcessIdAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForPortRelease(port: number, resolver: (port: number) => Promise<AiBridgePortHolder | null>, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (!(await resolver(port))) return true;
    } catch {
      // 查询失败不纠结，交给重试启动去验证端口是否真的释放。
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  try {
    return !(await resolver(port));
  } catch {
    return true;
  }
}
