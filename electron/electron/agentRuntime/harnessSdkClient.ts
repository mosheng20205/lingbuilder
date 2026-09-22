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
  private nextId = 1;
  private stdoutBuffer = '';
  private stderrTail = '';
  private closed = false;

  constructor(private readonly options: HarnessSdkClientOptions) {}

  get running(): boolean {
    return !!this.child && !this.closed;
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
    child.on('error', error => this.failAll(`内嵌 Agent 运行器进程错误：${error.message}`));
    child.on('close', code => this.failAll(`内嵌 Agent 运行器已退出（退出码 ${code ?? '未知'}）`));

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
    return this.request<{ messageId: string }>(HARNESS_SDK_PROMPT, {
      sessionId,
      contentBlocks: [{ type: 'text', text: content }]
    }, this.options.requestTimeoutMs ?? 30_000);
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

  /** 优雅收尾：协议 shutdown → stdin EOF → SIGTERM → SIGKILL。 */
  async close(): Promise<void> {
    const child = this.child;
    this.closed = true;
    if (!child) return;
    this.notificationHandlers.clear();
    try {
      await this.request(HARNESS_SDK_SHUTDOWN, {}, 3_000).catch(() => undefined);
    } finally {
      this.failAll('内嵌 Agent 运行器已关闭。');
    }
    if (await waitForExit(child, 4_000)) return;
    child.stdin.end();
    if (await waitForExit(child, 2_000)) return;
    child.kill('SIGTERM');
    if (await waitForExit(child, 2_000)) return;
    child.kill('SIGKILL');
    await waitForExit(child, 2_000);
  }

  private initializeOverrides(): Partial<HarnessInitializeParams> {
    return this.options.initializeParams ? { ...this.options.initializeParams } : {};
  }

  private consumeStderr(chunk: string): void {
    this.stderrTail = (this.stderrTail + chunk).slice(-MAX_STDERR_CHARS);
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
 */
export async function runHarnessTurn(input: {
  client: HarnessSdkClient;
  sessionId: string;
  prompt: string;
  timeoutMs?: number;
  onEvent?: (event: Record<string, unknown>) => void;
}): Promise<{ events: Record<string, unknown>[]; finalText: string }> {
  const events: Record<string, unknown>[] = [];
  let resolveIdle: () => void = () => undefined;
  const idle = new Promise<void>(resolve => { resolveIdle = resolve; });
  const unsubscribe = input.client.onNotification(notification => {
    if (String(notification.params?.sessionId || '') !== input.sessionId) return;
    if (notification.method === 'session.event') {
      const event = (notification.params?.event || {}) as Record<string, unknown>;
      events.push(event);
      input.onEvent?.(event);
      return;
    }
    if (notification.method === 'session.status' && notification.params?.status === 'idle' && events.length > 0) {
      resolveIdle();
    }
  });
  const timeoutMs = input.timeoutMs ?? 15 * 60_000;
  let timeoutTimer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => reject(new HarnessSdkTransportError(
      `内嵌 Agent 本轮执行超过 ${Math.round(timeoutMs / 60000)} 分钟未回到空闲状态。`,
      input.client.processStderrTail
    )), timeoutMs);
  });
  try {
    await input.client.prompt(input.sessionId, input.prompt);
    await Promise.race([idle, timeout]);
  } finally {
    if (timeoutTimer) clearTimeout(timeoutTimer);
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
