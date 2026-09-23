import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';

/** dsh SDK 线协议：换行分隔的 JSON-RPC 2.0，stdout 只走协议帧，诊断走 stderr。 */
export const HARNESS_SDK_INITIALIZE = 'initialize';
export const HARNESS_SDK_PROMPT = 'session/prompt';
export const HARNESS_SDK_SHUTDOWN = 'shutdown';

export interface HarnessInitializeParams {
  cwd: string;
  provider: string;
  model: string;
  maxTokens?: number;
  reasoningEffort?: string;
}

export interface HarnessInitializeResult {
  serverInfo: { name: string; version: string };
}

export interface HarnessNotification {
  method: string;
  params: Record<string, unknown>;
}

export interface HarnessSdkClientOptions {
  command: string;
  args: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  initializeTimeoutMs?: number;
  requestTimeoutMs?: number;
  /** 覆盖 initialize 的 provider/model/maxTokens（缺省 deepseek-official / deepseek-v4-flash）。 */
  initializeParams?: Partial<HarnessInitializeParams>;
  /** 注入点：回归测试用假子进程驱动协议。 */
  spawnProcess?: typeof spawn;
}

export class HarnessSdkTransportError extends Error {
  constructor(message: string, readonly stderrTail = '') {
    super(stderrTail ? `${message}\n运行器 stderr：${stderrTail}` : message);
    this.name = 'HarnessSdkTransportError';
  }
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: NodeJS.Timeout;
}

const MAX_STDERR_CHARS = 8000;

/**
 * 最小 dsh SDK 客户端：只实现 initialize / session/prompt / shutdown 三个请求与
 * session.event / session.status / subagent.* 四类通知的换行分隔 JSON-RPC 帧。
 * 不依赖 @deepseek-ai/dsh-sdk-client —— 那个包带 5 个 rc 版本 peer 依赖，且会按
 * 同版本号去找 @deepseek-ai/dsh 可执行文件，长期是版本耦合陷阱；协议本身只有
 * 3+4 个方法名，wire 身份稳定（deepseek-harness-sdk-runtime）。
 */
export class HarnessSdkClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private readonly pending = new Map<number, Pending>();
  private readonly notificationHandlers = new Set<(notification: HarnessNotification) => void>();
  private readonly exitListeners = new Set<(reason: string) => void>();
  private nextId = 1;
  private stdoutBuffer = '';
  private stderrTail = '';
  private closed = false;
  private exited = false;
  private exitReason = '';

  constructor(private readonly options: HarnessSdkClientOptions) {}

  get running(): boolean {
    return !!this.child && !this.closed;
  }

  /** 进程是否仍然存活；崩溃（close/error）后为 false，与「主动 close 过」区分开。 */
  get alive(): boolean {
    return !!this.child && !this.closed && !this.exited;
  }

  /** 进程退出（含主动 close）回调：服务层据此把快照从 running 修正为 failed，避免僵尸「待命」。 */
  onExit(listener: (reason: string) => void): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  /**
   * 进程退出时 resolve（带退出原因）。服务层用整轮等待与它做 race：
   * session/prompt 的 ack 很早就完成了，进程半路死亡不会拒绝任何 pending 请求，
   * 不做 race 的话整轮要干等到整轮超时（最长 15 分钟）。
   */
  waitForExit(): Promise<string> {
    if (!this.alive) return Promise.resolve(this.exitReason || '内嵌 Agent 运行器已退出。');
    return new Promise(resolve => this.exitListeners.add(reason => resolve(reason)));
  }

  get pid(): number | null {
    return this.child?.pid ?? null;
  }

  get processStderrTail(): string {
    return this.stderrTail;
  }

  onNotification(handler: (notification: HarnessNotification) => void): () => void {
    this.notificationHandlers.add(handler);
    return () => this.notificationHandlers.delete(handler);
  }

  async start(): Promise<HarnessInitializeResult> {
    if (this.child) throw new Error('内嵌 Agent 运行器已经启动。');
    const spawnProcess = this.options.spawnProcess || spawn;
    const child = spawnProcess(this.options.command, this.options.args, {
      cwd: this.options.cwd,
      env: this.options.env,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    }) as ChildProcessWithoutNullStreams;
    if (!child.stdout || !child.stdin || !child.stderr) {
      throw new HarnessSdkTransportError('内嵌 Agent 运行器未能建立标准输入输出通道。', this.stderrTail);
    }
    this.child = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => this.consumeStdout(String(chunk)));
    child.stderr.on('data', chunk => this.consumeStderr(String(chunk)));
    child.on('error', error => this.handleExit(`内嵌 Agent 运行器进程错误：${error.message}`));
    child.on('close', code => this.handleExit(`内嵌 Agent 运行器已退出（退出码 ${code ?? '未知'}）`));

    const params: HarnessInitializeParams = {
      cwd: this.options.cwd,
      provider: 'deepseek-official',
      model: 'deepseek-v4-flash',
      ...this.initializeOverrides()
    };
    const result = await this.request<HarnessInitializeResult>(
      HARNESS_SDK_INITIALIZE,
      params,
      this.options.initializeTimeoutMs ?? 60_000
    );
    if (!result?.serverInfo?.name) {
      throw new HarnessSdkTransportError('内嵌 Agent 运行器初始化响应缺少 serverInfo，无法确认协议版本。', this.stderrTail);
    }
    return result;
  }

  async prompt(sessionId: string, content: string): Promise<{ messageId: string }> {
    // 确认超时只覆盖「dsh 接收需求」这一步（正常毫秒级回 messageId）；放宽到 2 分钟，
    // 避免网关冷启动时误报失败而 dsh 其实仍在后台跑（那会导致两轮交错）。
    return this.request<{ messageId: string }>(HARNESS_SDK_PROMPT, {
      sessionId,
      contentBlocks: [{ type: 'text', text: content }]
    }, this.options.requestTimeoutMs ?? 120_000);
  }

  async request<T>(method: string, params: unknown, timeoutMs: number): Promise<T> {
    const child = this.child;
    if (!child || this.closed) throw new HarnessSdkTransportError('内嵌 Agent 运行器未运行。', this.stderrTail);
    const id = this.nextId++;
    const frame = `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new HarnessSdkTransportError(`内嵌 Agent 运行器对 ${method} 响应超时（${timeoutMs}ms）。`, this.stderrTail));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: value => resolve(value as T),
        reject,
        timer
      });
      child.stdin.write(frame, error => {
        if (!error) return;
        clearTimeout(timer);
        this.pending.delete(id);
        reject(new HarnessSdkTransportError(`写入内嵌 Agent 运行器失败：${error.message}`, this.stderrTail));
      });
    });
  }

  /** 优雅收尾：协议 shutdown → stdin EOF → SIGTERM → SIGKILL，最后销毁 stdio 管道。 */
  async close(): Promise<void> {
    const child = this.child;
    if (!child) {
      this.closed = true;
      this.exited = true;
      return;
    }
    this.notificationHandlers.clear();
    try {
      // shutdown 必须在标记 closed 之前发送：request() 对已关闭的客户端直接拒绝，
      // 先置位会让协议 shutdown 永远发不出去，每次都退化成 stdin EOF 慢路径。
      await this.request(HARNESS_SDK_SHUTDOWN, {}, 3_000).catch(() => undefined);
    } finally {
      this.closed = true;
      this.exited = true;
      this.exitReason = this.exitReason || '内嵌 Agent 运行器已关闭。';
      this.failAll('内嵌 Agent 运行器已关闭。');
    }
    if (await waitForExit(child, 4_000)) {
      this.destroyStdio(child);
      return;
    }
    child.stdin.end();
    if (await waitForExit(child, 2_000)) {
      this.destroyStdio(child);
      return;
    }
    child.kill('SIGTERM');
    if (await waitForExit(child, 2_000)) {
      this.destroyStdio(child);
      return;
    }
    child.kill('SIGKILL');
    await waitForExit(child, 2_000);
    this.destroyStdio(child);
  }

  /** 进程退出后必须显式销毁 stdio 管道：残留的 Socket 句柄会一直占住事件循环（node --test 不退出就是它）。 */
  private destroyStdio(child: ChildProcessWithoutNullStreams): void {
    try { child.stdout.destroy(); } catch { /* 已销毁 */ }
    try { child.stderr.destroy(); } catch { /* 已销毁 */ }
  }

  private initializeOverrides(): Partial<HarnessInitializeParams> {
    return this.options.initializeParams ? { ...this.options.initializeParams } : {};
  }

  private consumeStderr(chunk: string): void {
    this.stderrTail = (this.stderrTail + chunk).slice(-MAX_STDERR_CHARS);
  }

  private handleExit(reason: string): void {
    this.exited = true;
    this.exitReason = this.exitReason || reason;
    this.failAll(reason);
    for (const listener of [...this.exitListeners]) listener(reason);
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/u);
    this.stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      const message = parseFrame(line);
      if (!message) continue;
      if (typeof message.id === 'number' && (message.method || !('result' in message))) {
        // 服务端请求（当前协议不使用）：明确拒绝，避免对端永久等待。
        this.child?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'LingBuilder SDK client does not handle server requests.' } })}\n`, () => undefined);
        continue;
      }
      if (typeof message.id === 'number') {
        const entry = this.pending.get(message.id);
        if (!entry) continue;
        this.pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.error) entry.reject(new HarnessSdkTransportError(`内嵌 Agent 运行器返回错误：${message.error.message || JSON.stringify(message.error)}`, this.stderrTail));
        else entry.resolve(message.result);
        continue;
      }
      if (typeof message.method === 'string') {
        const notification: HarnessNotification = { method: message.method, params: (message.params || {}) as Record<string, unknown> };
        for (const handler of [...this.notificationHandlers]) handler(notification);
      }
    }
  }

  private failAll(reason: string): void {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new HarnessSdkTransportError(reason, this.stderrTail));
    }
    this.pending.clear();
  }
}

interface WireMessage {
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { code?: number; message?: string };
}

function parseFrame(line: string): WireMessage | undefined {
  const trimmed = line.trim();
  if (!trimmed) return undefined;
  try {
    const value = JSON.parse(trimmed) as WireMessage;
    return value && typeof value === 'object' ? value : undefined;
  } catch {
    // 协议规定畸形行直接忽略（对端可能混入日志）。
    return undefined;
  }
}

function waitForExit(child: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode) return Promise.resolve(true);
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      resolve(false);
    }, timeoutMs);
    function onExit() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once('exit', onExit);
  });
}

/**
 * 一轮对话：投递 prompt，收集该会话的事件，直到整代理回到 idle。
 * dsh 不给 prompt 指派 assistant message / turn/end，所以「结束」只能以
 * session.status=idle 为准，且必须先看到事件，避免把上一轮的 idle 当成本轮结果。
 *
 * 唯一例外：开场即失败（凭据缺失、网关拒绝）可能一条事件都不发就回到 idle；
 * 这种情况若也等事件就会挂满整轮超时。所以在「零事件 + 从未进入运行态」时
 * 给一个短宽限（idleGraceMs），宽限内没有任何事件到达就按已完成处理，
 * 由调用方据 events/finalText 全空给出诊断文案。
 */
export async function runHarnessTurn(input: {
  client: HarnessSdkClient;
  sessionId: string;
  prompt: string;
  timeoutMs?: number;
  /** 零事件 idle 的宽限时长；宽限内出现任何事件即回到「必须见事件」的严格判定。 */
  idleGraceMs?: number;
  onEvent?: (event: Record<string, unknown>) => void;
}): Promise<{ events: Record<string, unknown>[]; finalText: string }> {
  const events: Record<string, unknown>[] = [];
  let resolveIdle: () => void = () => undefined;
  const idle = new Promise<void>(resolve => { resolveIdle = resolve; });
  let rejectTurn: (error: HarnessSdkTransportError) => void = () => undefined;
  // 进程退出必须立即可见地终结本轮：否则 race 被别处赢走后，这里挂着的整轮超时
  // 定时器会钉住事件循环（node --test 不退出），服务层也无法及时进入停机自愈。
  const exited = new Promise<never>((_, reject) => {
    rejectTurn = reject;
  });
  const exitUnsubscribe = input.client.onExit(reason => rejectTurn(
    new HarnessSdkTransportError(`内嵌 Agent 在本轮执行期间退出：${reason}`, input.client.processStderrTail)
  ));
  let idleSettled = false;
  let sawActiveStatus = false;
  let graceTimer: NodeJS.Timeout | undefined;
  const settleIdle = () => {
    if (idleSettled) return;
    idleSettled = true;
    if (graceTimer) clearTimeout(graceTimer);
    graceTimer = undefined;
    resolveIdle();
  };
  const unsubscribe = input.client.onNotification(notification => {
    if (String(notification.params?.sessionId || '') !== input.sessionId) return;
    if (notification.method === 'session.event') {
      const event = (notification.params?.event || {}) as Record<string, unknown>;
      events.push(event);
      input.onEvent?.(event);
      return;
    }
    if (notification.method !== 'session.status') return;
    const status = String(notification.params?.status || '');
    if (status && status !== 'idle') {
      sawActiveStatus = true;
      if (graceTimer) { clearTimeout(graceTimer); graceTimer = undefined; }
      return;
    }
    if (status !== 'idle') return;
    if (events.length > 0 || sawActiveStatus) settleIdle();
    else if (!graceTimer) {
      graceTimer = setTimeout(settleIdle, input.idleGraceMs ?? 5_000);
    }
  });
  const timeoutMs = input.timeoutMs ?? 15 * 60_000;
  let timeoutTimer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => reject(new HarnessSdkTransportError(
      `内嵌 Agent 本轮执行超过 ${Math.round(timeoutMs / 60000)} 分钟未回到空闲状态（已收到 ${events.length} 个事件）。`,
      input.client.processStderrTail
    )), timeoutMs);
  });
  try {
    await input.client.prompt(input.sessionId, input.prompt);
    await Promise.race([idle, exited, timeout]);
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (graceTimer) clearTimeout(graceTimer);
    exitUnsubscribe();
    unsubscribe();
  }
  return { events, finalText: lastAssistantText(events) };
}

/** 取本轮最后一条 assistant 消息的正文，用于面板兜底展示。 */
export function lastAssistantText(events: Record<string, unknown>[]): string {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type !== 'assistant/message') continue;
    const message = (event.data as any)?.message;
    const blocks = Array.isArray(message?.content) ? message.content : [];
    const text = blocks.filter((block: any) => block?.type === 'text' && typeof block.text === 'string')
      .map((block: any) => String(block.text))
      .join('\n')
      .trim();
    if (text) return text;
  }
  return '';
}
