import { spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import {
  createAgentLaunchPlan,
  resolveDshRuntime,
  MASKED_DSH_TOOL_ROWS,
  type AgentRuntimeProfileOptions,
  type DshRuntimeResolution
} from './agentRuntimeProfile';
import { HarnessSdkClient, runHarnessTurn, type HarnessInitializeParams } from './harnessSdkClient';
import { agentProviderRuntimeModel, agentProviderRuntimeName, type AgentProviderSettings } from './agentProviderSettings';

export type AgentRuntimeState = 'stopped' | 'starting' | 'running' | 'busy' | 'stopping' | 'failed';

export interface AgentRuntimeEventPayload {
  sessionId: string;
  /** dsh 的 session-log 事件原样转发（type + data），面板据此渲染工具调用卡片。 */
  event: Record<string, unknown>;
}

export interface AgentRuntimeSnapshot {
  state: AgentRuntimeState;
  workspaceRoot: string;
  nodePath: string;
  nodeVersion: string;
  dshBinPath: string;
  pid: number | null;
  sessionId: string;
  provider: string;
  model: string;
  /** 面板可见工具数（遮蔽后），用于「引擎已就绪」提示里说清能力边界。 */
  maskedToolRows: number;
  problem: string;
  logs: string[];
  lastTurnEvents: number;
}

export interface AgentRuntimeStartRequest {
  workspaceRoot: string;
  provider?: string;
  model?: string;
  maxTokens?: number;
  reasoningEffort?: string;
}

export interface AgentRuntimeOptions {
  /** IDE 自己的 Electron 可执行文件：MCP 子进程用它当 Node 宿主（已实测可行）。 */
  bridgeCommand: string;
  /** dist/cli.cjs 路径（开发态 electron/dist，打包后 app.asar/dist）。 */
  cliEntryPath: string;
  /** 内嵌 Agent 生成的 profile overlay 落盘目录（userData 下）。 */
  profileDirectory: string;
  environment?: NodeJS.ProcessEnv;
  resourcesPath?: string;
  dshHome?: string;
  homeDirectory?: string;
  globalNodeModules?: string;
  spawnProcess?: typeof spawn;
  profileOverrides?: Partial<AgentRuntimeProfileOptions>;
  /** 单轮整体超时（含全部工具调用）；默认 15 分钟。回归测试用短超时驱动失败路径。 */
  turnTimeoutMs?: number;
  /**
   * 面板配置的模型通道（DeepSeek 官方 / 自定义 OpenAI 兼容网关）。用取值函数而不是快照传入：
   * 用户可能在运行时不重启的情况下改配置，下一次 start 必须读到最新值。
   */
  providerSettings?: () => AgentProviderSettings | undefined;
}

const MAX_LOGS = 120;

function emptySnapshot(): AgentRuntimeSnapshot {
  return {
    state: 'stopped', workspaceRoot: '', nodePath: '', nodeVersion: '', dshBinPath: '', pid: null,
    sessionId: '', provider: '', model: '', maskedToolRows: 0, problem: '', logs: [], lastTurnEvents: 0
  };
}

function cloneSnapshot(snapshot: AgentRuntimeSnapshot): AgentRuntimeSnapshot {
  return { ...snapshot, logs: [...snapshot.logs] };
}

/**
 * 面板内嵌 Agent 运行时：把 DeepSeek Harness（dsh）作为「规划 + 工具循环」引擎，
 * 通过 stdio JSON-RPC 驱动，工具面只保留 LingBuilder MCP 的 agent 工具集。
 *
 * 硬边界：写盘与构建一律不由该运行时执行——dsh 侧本地工具行整行禁用，MCP 侧
 * edit.apply / build.run 等被遮蔽，提案落盘由面板在用户确认后经 AiBridgeService
 * 代执行。因此本服务不产生第二套编辑事务，也不得被用来直接改工作区文件。
 */
export class AgentRuntimeService {
  private client: HarnessSdkClient | null = null;
  private resolution: DshRuntimeResolution | null = null;
  private snapshotValue = emptySnapshot();
  private readonly listeners = new Set<(snapshot: AgentRuntimeSnapshot) => void>();
  private readonly eventListeners = new Set<(payload: AgentRuntimeEventPayload) => void>();
  private turnInFlight = false;

  constructor(private readonly options: AgentRuntimeOptions) {}

  snapshot(): AgentRuntimeSnapshot {
    return cloneSnapshot(this.snapshotValue);
  }

  subscribe(listener: (snapshot: AgentRuntimeSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 逐事件推送（工具调用/助手消息），面板据此渲染流式过程。 */
  onEvent(listener: (payload: AgentRuntimeEventPayload) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  async start(request: AgentRuntimeStartRequest): Promise<AgentRuntimeSnapshot> {
    if (this.snapshotValue.state === 'starting' || this.snapshotValue.state === 'stopping') {
      throw new Error('内嵌 Agent 运行时正在切换状态，请稍候。');
    }
    if (this.snapshotValue.state === 'running' || this.snapshotValue.state === 'busy') {
      throw new Error('内嵌 Agent 运行时已经启动；更换工作区或模型前请先停止。');
    }
    const workspaceRoot = path.resolve(String(request.workspaceRoot || '').trim());
    if (!workspaceRoot || workspaceRoot === path.parse(workspaceRoot).root) {
      throw new Error('内嵌 Agent 需要有效的工作区路径。');
    }
    const providerSettings = this.options.providerSettings?.();

    this.snapshotValue = {
      ...emptySnapshot(), state: 'starting', workspaceRoot,
      provider: String(request.provider || agentProviderRuntimeName(providerSettings)),
      model: String(request.model || agentProviderRuntimeModel(providerSettings)),
      logs: ['正在解析内嵌 Agent 运行时依赖…']
    };
    this.emit();

    const profileOptions: AgentRuntimeProfileOptions = {
      environment: this.options.environment || process.env,
      resourcesPath: this.options.resourcesPath || process.resourcesPath,
      dshHome: this.options.dshHome,
      homeDirectory: this.options.homeDirectory,
      globalNodeModules: this.options.globalNodeModules,
      ...this.options.profileOverrides
    };
    this.resolution = await resolveDshRuntime(profileOptions, options => probeNodeVersion(options, this.options.spawnProcess));
    if (!this.resolution.ok) {
      return this.fail(this.resolution.problem || '内嵌 Agent 运行时依赖未就绪。');
    }
    this.pushLog(`已找到 Node ${this.resolution.nodeVersion} 与 dsh 运行库，正在启动运行器…`);

    const plan = await createAgentLaunchPlan({
      workspaceRoot,
      cliEntryPath: this.options.cliEntryPath,
      bridgeCommand: this.options.bridgeCommand,
      // MCP 宿主据此在 health / workspace.list / serverInfo 上回报 IDE 版本（overlay env 是它的可靠通道）。
      bridgeEnv: {
        ELECTRON_RUN_AS_NODE: '1',
        ...pickIdeVersionEnv(profileOptions.environment)
      },
      resolution: this.resolution,
      profileDirectory: this.options.profileDirectory,
      dshHome: this.options.dshHome,
      environment: profileOptions.environment,
      providerSettings
    });
    if (!plan.ok || !plan.plan) return this.fail(plan.problem || '内嵌 Agent 启动计划生成失败。');
    this.pushLog(`模型通道：${this.snapshotValue.provider} / ${this.snapshotValue.model}`);

    const initializeParams: Partial<HarnessInitializeParams> = {
      provider: this.snapshotValue.provider,
      model: this.snapshotValue.model
    };
    if (request.maxTokens && request.maxTokens > 0) initializeParams.maxTokens = request.maxTokens;
    if (request.reasoningEffort) initializeParams.reasoningEffort = request.reasoningEffort;

    const client = new HarnessSdkClient({
      command: plan.plan.command,
      args: plan.plan.args,
      cwd: plan.plan.cwd,
      env: plan.plan.env,
      initializeParams,
      spawnProcess: this.options.spawnProcess
    });
    try {
      const info = await client.start();
      // dsh 崩溃/被杀时必须把快照从 running 修正为 failed：否则状态行永远显示「待命」，
      // 用户每一轮只会看到「运行器未运行」却不知道要先重启（真机踩过的僵尸态）。
      client.onExit(reason => {
        if (this.client !== client) return;
        this.client = null;
        this.snapshotValue = {
          ...this.snapshotValue, state: 'failed', pid: null, problem: reason,
          logs: [...this.snapshotValue.logs, reason].slice(-MAX_LOGS)
        };
        this.emit();
      });
      this.client = client;
      this.snapshotValue = {
        ...this.snapshotValue,
        state: 'running',
        nodePath: this.resolution.nodePath || '',
        nodeVersion: this.resolution.nodeVersion || '',
        dshBinPath: this.resolution.dshBinPath || '',
        pid: client.pid,
        maskedToolRows: MASKED_DSH_TOOL_ROWS.length,
        logs: [...this.snapshotValue.logs, `运行器已就绪（${info.serverInfo.name} ${info.serverInfo.version}）。`]
      };
      this.emit();
      return cloneSnapshot(this.snapshotValue);
    } catch (error) {
      await client.close().catch(() => undefined);
      return this.fail(errorMessage(error));
    }
  }

  /**
   * 跑一轮对话。返回事件与最终文本；提案（edit.propose）由模型生成，
   * 面板负责展示预览并在用户确认后自行调用 apply —— 本服务不写盘。
   */
  async prompt(prompt: string, sessionId?: string): Promise<{ sessionId: string; finalText: string; events: Record<string, unknown>[] }> {
    if (!this.client || (this.snapshotValue.state !== 'running' && this.snapshotValue.state !== 'busy')) {
      throw new Error('内嵌 Agent 运行时未启动，请先在面板选择「本机 Agent」引擎。');
    }
    if (this.turnInFlight) throw new Error('上一轮还在执行中，请等待完成或先停止。');
    const text = String(prompt || '').trim();
    if (!text) throw new Error('请输入要交给内嵌 Agent 的需求。');
    // 面板按「会话 ID → dsh 会话」映射显式传 sessionId；调用方没传就必须开新会话，
    // 不得复用上一轮的会话——那会把上一个面板会话的上下文静默带进新会话。
    const activeSession = String(sessionId || '').trim() || `lb-panel-${Date.now()}`;

    this.turnInFlight = true;
    this.snapshotValue = {
      ...this.snapshotValue, state: 'busy', sessionId: activeSession,
      logs: [...this.snapshotValue.logs, '已提交需求，等待内嵌 Agent 生成提案…'].slice(-MAX_LOGS)
    };
    this.emit();
    try {
      // runHarnessTurn 自带「进程退出 → 本轮失败」分支：session/prompt 的 ack 在提交
      // 时就完成了，dsh 带轮崩溃不会拒绝任何 pending 请求，必须由退出回调终结本轮，
      // 否则整轮要干等到超时，失败后也无法及时停机自愈。
      const result = await runHarnessTurn({
        client: this.client,
        sessionId: activeSession,
        prompt: text,
        timeoutMs: this.options.turnTimeoutMs,
        onEvent: event => {
          for (const listener of [...this.eventListeners]) listener({ sessionId: activeSession, event });
        }
      });
      this.snapshotValue = {
        ...this.snapshotValue,
        state: 'running',
        lastTurnEvents: result.events.length,
        logs: [...this.snapshotValue.logs, `本轮完成，共 ${result.events.length} 个事件。`].slice(-MAX_LOGS)
      };
      this.emit();
      return { sessionId: activeSession, finalText: result.finalText, events: result.events };
    } catch (error) {
      // 主动停止（state 已是 stopping）由 stop() 收尾，这里不得改写状态。
      if (this.snapshotValue.state !== 'stopping' && this.client) {
        const dead = this.client;
        this.client = null;
        const message = errorMessage(error);
        // 请求失败后无法再信任这棵运行器的状态流（ack 超时时 dsh 可能仍在跑本轮）：
        // 直接停机置 failed，下一条需求会自动重启，从结构上杜绝两轮交错。
        this.snapshotValue = {
          ...this.snapshotValue, state: 'failed', pid: null, problem: message,
          logs: [...this.snapshotValue.logs, `本轮失败：${message}`].slice(-MAX_LOGS)
        };
        this.emit();
        void dead.close().catch(() => undefined);
      }
      throw error;
    } finally {
      this.turnInFlight = false;
    }
  }

  async stop(): Promise<AgentRuntimeSnapshot> {
    if (!this.client) {
      this.snapshotValue = { ...this.snapshotValue, state: 'stopped', pid: null };
      this.emit();
      return cloneSnapshot(this.snapshotValue);
    }
    this.snapshotValue = { ...this.snapshotValue, state: 'stopping' };
    this.emit();
    const client = this.client;
    this.client = null;
    await client.close().catch(error => this.pushLog(`停止内嵌 Agent 运行器时出错：${errorMessage(error)}`));
    this.snapshotValue = { ...this.snapshotValue, state: 'stopped', pid: null, logs: [...this.snapshotValue.logs, '内嵌 Agent 运行时已停止。'].slice(-MAX_LOGS) };
    this.emit();
    return cloneSnapshot(this.snapshotValue);
  }

  /** 改完模型配置后一键生效：先停旧进程（overlay 与注入的环境变量都是启动期决定的），再按新配置启动。 */
  async restart(request: AgentRuntimeStartRequest): Promise<AgentRuntimeSnapshot> {
    const workspaceRoot = path.resolve(String(request.workspaceRoot || this.snapshotValue.workspaceRoot || '').trim());
    await this.stop().catch(() => undefined);
    return this.start({ ...request, workspaceRoot });
  }

  /** 窗口退出/切换工作区必须回收子进程，否则残留 dsh 进程与它的 MCP 子进程。 */
  async dispose(): Promise<void> {
    await this.stop().catch(() => undefined);
    this.listeners.clear();
    this.eventListeners.clear();
  }

  private fail(problem: string): AgentRuntimeSnapshot {
    this.client = null;
    this.snapshotValue = {
      ...this.snapshotValue, state: 'failed', pid: null, problem,
      logs: [...this.snapshotValue.logs, problem].slice(-MAX_LOGS)
    };
    this.emit();
    return cloneSnapshot(this.snapshotValue);
  }

  private pushLog(line: string): void {
    this.snapshotValue = { ...this.snapshotValue, logs: [...this.snapshotValue.logs, line].slice(-MAX_LOGS) };
    this.emit();
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener(cloneSnapshot(this.snapshotValue));
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 环境变量名与 src/services/aiBridge/ideVersion.ts 的 IDE_VERSION_ENV 必须逐字一致
 * （主进程树受 tsconfig rootDir 约束不能 import ../src，只能镜像常量，由测试把关）。
 */
const IDE_VERSION_ENV_NAME = 'LINGBUILDER_IDE_VERSION';

/** 环境里有 IDE 版本就透传给 MCP 宿主；没有就不写 overlay，由宿主侧 package.json 回退兜底。 */
function pickIdeVersionEnv(environment: NodeJS.ProcessEnv | undefined): Record<string, string> {
  const version = String(environment?.[IDE_VERSION_ENV_NAME] || '').trim();
  return version ? { [IDE_VERSION_ENV_NAME]: version } : {};
}

/** 读 `node --version`；主进程里不阻塞事件循环，用异步 spawn。 */
async function probeNodeVersion(executable: string, spawnProcess?: typeof spawn): Promise<string> {
  const runner = spawnProcess || spawn;
  return new Promise(resolve => {
    let settled = false;
    const finish = (value: string) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      const child = runner(executable, ['--version'], { windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }) as ChildProcess;
      if (!child?.stdout) return finish('');
      child.stdout.setEncoding('utf8');
      let output = '';
      child.stdout.on('data', chunk => { output += String(chunk); });
      child.once('error', () => finish(''));
      child.once('close', () => finish(output.trim()));
      setTimeout(() => { child.kill(); finish(output.trim()); }, 5_000).unref?.();
    } catch {
      finish('');
    }
  });
}
