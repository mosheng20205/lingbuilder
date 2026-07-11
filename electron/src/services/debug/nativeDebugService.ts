import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DapConnection, type DapMessage } from './dapConnection';

export interface NativeBreakpoint { sourcePath: string; line: number; condition?: string; clientSourcePath?: string; clientLine?: number }
export interface VerifiedBreakpoint extends NativeBreakpoint { id?: number; verified: boolean; message?: string; actualLine?: number }
export type NativeDebugState = 'initializing' | 'running' | 'stopped' | 'terminated' | 'error';
export interface NativeDebugSnapshot {
  id: string; state: NativeDebugState; program: string; cwd: string; adapterPath: string; createdAt: string;
  threadId?: number; stopReason?: string; description?: string; exitCode?: number; breakpoints: VerifiedBreakpoint[]; logs: string[];
}
export interface DebugThread { id: number; name: string }
export interface DebugStackFrame { id: number; name: string; line: number; column: number; sourcePath?: string; sourceName?: string; instructionPointerReference?: string }
export interface DebugVariable { name: string; value: string; type?: string; evaluateName?: string; variablesReference: number; namedVariables?: number; indexedVariables?: number; memoryReference?: string }
export interface DebugScope { name: string; variablesReference: number; expensive: boolean; variables: DebugVariable[] }
export interface DebugInspection { threadId: number; frameId: number; threads: DebugThread[]; stackFrames: DebugStackFrame[]; scopes: DebugScope[] }
export interface DebugEvaluation { expression: string; result: string; type?: string; variablesReference: number; memoryReference?: string }
export interface DebugMemory { address: string; data: string; bytes: number[]; unreadableBytes: number }
export interface DebugInstruction { address: string; instruction: string; symbol?: string; location?: string; line?: number; column?: number }
export interface DebugConnection {
  request<T = any>(command: string, args?: unknown, timeoutMs?: number): Promise<T>;
  waitForEvent<T = any>(event: string, predicate?: (body: T) => boolean, timeoutMs?: number): Promise<T>;
  respond(request: DapMessage, success: boolean, body?: unknown, message?: string): void;
  on(event: string, listener: (...args: any[]) => void): this;
  terminate(): void;
  waitForExit?(timeoutMs?: number): Promise<void>;
}
interface Session { snapshot: NativeDebugSnapshot; connection: DebugConnection; intentionalStop: boolean }

export class NativeDebugService {
  private session: Session | undefined; private readonly listeners = new Set<(snapshot: NativeDebugSnapshot) => void>();
  constructor(private readonly workspaceRoot: string, private readonly dependencies: {
    resolveAdapter?: () => Promise<string>;
    createConnection?: (adapterPath: string) => DebugConnection;
  } = {}) {}

  async start(options: { program: string; cwd?: string; args?: string[]; stopAtEntry?: boolean; breakpoints?: NativeBreakpoint[] }): Promise<NativeDebugSnapshot> {
    const program = await this.resolveFile(options.program); const cwd = await this.resolveDirectory(options.cwd || path.dirname(program));
    return await this.startSession({ program, cwd, breakpoints: options.breakpoints, command: 'launch', commandArgs: {
      name: 'LingBuilder 原生调试', type: 'lldb-dap', request: 'launch', program, args: validateArgs(options.args), cwd,
      stopAtEntry: Boolean(options.stopAtEntry), stopOnEntry: Boolean(options.stopAtEntry), console: 'internalConsole', environment: []
    }, readyMessage: '调试配置完成，原生程序已启动。' });
  }

  async attach(options: { pid: number; program?: string; breakpoints?: NativeBreakpoint[] }): Promise<NativeDebugSnapshot> {
    const pid = boundedRequiredInteger(options.pid, 1, 0x7fffffff, '进程 ID');
    const program = options.program ? await this.resolveFile(options.program) : '';
    return await this.startSession({ program, cwd: program ? path.dirname(program) : await fs.realpath(this.workspaceRoot), breakpoints: options.breakpoints,
      command: 'attach', commandArgs: { name: 'LingBuilder 附加进程', type: 'lldb-dap', request: 'attach', pid, ...(program ? { program } : {}) }, readyMessage: `已附加到进程 ${pid}。` });
  }

  async openDump(options: { program: string; coreFile: string }): Promise<NativeDebugSnapshot> {
    const program = await this.resolveFile(options.program); const coreFile = await this.resolveFile(options.coreFile);
    return await this.startSession({ program, cwd: path.dirname(program), command: 'attach', commandArgs: {
      name: 'LingBuilder 转储调试', type: 'lldb-dap', request: 'attach', program, coreFile
    }, readyMessage: `已打开转储：${path.basename(coreFile)}` });
  }

  async connectRemote(options: { program: string; host?: string; port: number; breakpoints?: NativeBreakpoint[] }): Promise<NativeDebugSnapshot> {
    const program = await this.resolveFile(options.program); const host = validRemoteHost(options.host || 'localhost'); const port = boundedRequiredInteger(options.port, 1, 65535, '远程端口');
    return await this.startSession({ program, cwd: path.dirname(program), breakpoints: options.breakpoints, command: 'attach', commandArgs: {
      name: 'LingBuilder 远程调试', type: 'lldb-dap', request: 'attach', program, 'gdb-remote-host': host, 'gdb-remote-port': port
    }, readyMessage: `已连接远程调试目标 ${host}:${port}。` });
  }

  private async startSession(options: { program: string; cwd: string; breakpoints?: NativeBreakpoint[]; command: 'launch' | 'attach'; commandArgs: Record<string, unknown>; readyMessage: string }): Promise<NativeDebugSnapshot> {
    if (this.session && !['terminated', 'error'].includes(this.session.snapshot.state)) throw new Error('已有原生调试会话正在运行，请先停止。');
    const { program, cwd } = options;
    const adapterPath = await (this.dependencies.resolveAdapter?.() ?? findOpenDebugAdapter());
    const breakpoints = await this.validateBreakpoints(options.breakpoints || []);
    const connection = this.dependencies.createConnection?.(adapterPath) ?? createAdapterConnection(adapterPath);
    const snapshot: NativeDebugSnapshot = {
      id: crypto.randomUUID(), state: 'initializing', program, cwd, adapterPath, createdAt: new Date().toISOString(),
      breakpoints: breakpoints.map(item => ({ ...item, verified: false })), logs: [`已启动原生调试适配器：${adapterPath}`]
    };
    const session: Session = { snapshot, connection, intentionalStop: false }; this.session = session; this.wire(session); this.emit();
    try {
      await connection.request('initialize', {
        clientID: 'lingbuilder', clientName: 'LingBuilder 中文集成开发环境', adapterID: isLldbDap(adapterPath) ? 'lldb' : 'cppdbg',
        pathFormat: 'path', linesStartAt1: true, columnsStartAt1: true,
        supportsVariableType: true, supportsVariablePaging: true, supportsRunInTerminalRequest: false, locale: 'zh-CN'
      });
      const initialized = connection.waitForEvent('initialized', undefined, 20_000);
      const launch = connection.request(options.command, options.commandArgs, 30_000);
      await initialized;
      snapshot.breakpoints = await this.sendBreakpoints(connection, breakpoints);
      await connection.request('configurationDone'); await launch;
      if (snapshot.state === 'initializing') snapshot.state = 'running';
      snapshot.logs.push(options.readyMessage); this.emit(); return clone(snapshot);
    } catch (error) {
      snapshot.state = 'error'; snapshot.description = error instanceof Error ? error.message : String(error); snapshot.logs.push(`调试启动失败：${snapshot.description}`); this.emit();
      connection.terminate(); throw error;
    }
  }

  getSnapshot(): NativeDebugSnapshot | null { return this.session ? clone(this.session.snapshot) : null; }
  subscribe(listener: (snapshot: NativeDebugSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  async setBreakpoints(breakpoints: NativeBreakpoint[]): Promise<NativeDebugSnapshot> {
    const session = this.requireSession(); const validated = await this.validateBreakpoints(breakpoints);
    session.snapshot.breakpoints = await this.sendBreakpoints(session.connection, validated); this.emit(); return clone(session.snapshot);
  }
  async continue(): Promise<NativeDebugSnapshot> { return await this.control('continue'); }
  async next(): Promise<NativeDebugSnapshot> { return await this.control('next'); }
  async stepIn(): Promise<NativeDebugSnapshot> { return await this.control('stepIn'); }
  async stepOut(): Promise<NativeDebugSnapshot> { return await this.control('stepOut'); }

  async inspect(threadId?: number, frameId?: number): Promise<DebugInspection> {
    const session = this.requireStoppedSession();
    const threadsResponse = await session.connection.request<any>('threads');
    const threads: DebugThread[] = (threadsResponse?.threads || []).slice(0, 256).map((item: any) => ({ id: Number(item.id), name: String(item.name || `线程 ${item.id}`) }));
    const selectedThreadId = validReference(threadId || session.snapshot.threadId || threads[0]?.id, '线程');
    if (!threads.some(item => item.id === selectedThreadId)) throw new Error(`线程 ${selectedThreadId} 不存在。`);
    const stackResponse = await session.connection.request<any>('stackTrace', { threadId: selectedThreadId, startFrame: 0, levels: 200 });
    const stackFrames: DebugStackFrame[] = (stackResponse?.stackFrames || []).map((item: any) => ({
      id: Number(item.id), name: String(item.name || '(匿名帧)'), line: Number(item.line || 1), column: Number(item.column || 1),
      sourcePath: item.source?.path ? String(item.source.path) : undefined, sourceName: item.source?.name ? String(item.source.name) : undefined,
      instructionPointerReference: item.instructionPointerReference ? String(item.instructionPointerReference) : undefined
    }));
    const selectedFrameId = validReference(frameId || stackFrames[0]?.id, '栈帧');
    if (!stackFrames.some(item => item.id === selectedFrameId)) throw new Error(`栈帧 ${selectedFrameId} 不存在。`);
    const scopesResponse = await session.connection.request<any>('scopes', { frameId: selectedFrameId });
    const scopes: DebugScope[] = [];
    for (const item of (scopesResponse?.scopes || []).slice(0, 32)) {
      const reference = validReference(item.variablesReference, '变量作用域');
      scopes.push({ name: String(item.name || '作用域'), variablesReference: reference, expensive: Boolean(item.expensive), variables: await this.readVariables(session, reference, 0, 200) });
    }
    return { threadId: selectedThreadId, frameId: selectedFrameId, threads, stackFrames, scopes };
  }

  async variables(variablesReference: number, start = 0, count = 200): Promise<DebugVariable[]> {
    return await this.readVariables(this.requireStoppedSession(), validReference(variablesReference, '变量'), boundedInteger(start, 0, 1_000_000), boundedInteger(count, 1, 500));
  }

  async evaluate(expression: string, frameId?: number): Promise<DebugEvaluation> {
    const session = this.requireStoppedSession(); const value = expression?.trim();
    if (!value || value.length > 2000 || /[\r\n\0]/u.test(value)) throw new Error('监视表达式必须为单行且不超过 2000 个字符。');
    const response = await session.connection.request<any>('evaluate', { expression: value, frameId, context: 'watch' });
    return { expression: value, result: String(response?.result ?? ''), type: response?.type ? String(response.type) : undefined,
      variablesReference: Number(response?.variablesReference || 0), memoryReference: response?.memoryReference ? String(response.memoryReference) : undefined };
  }

  async registers(frameId: number): Promise<DebugVariable[]> {
    const session = this.requireStoppedSession(); const response = await session.connection.request<any>('scopes', { frameId: validReference(frameId, '栈帧') });
    const scope = (response?.scopes || []).find((item: any) => item.presentationHint === 'registers' || /register|寄存器/iu.test(String(item.name || '')));
    if (!scope) throw new Error('当前调试适配器没有提供寄存器作用域。');
    return await this.readVariables(session, validReference(scope.variablesReference, '寄存器'), 0, 500);
  }

  async readMemory(memoryReference: string, offset = 0, count = 256): Promise<DebugMemory> {
    const session = this.requireStoppedSession(); const reference = validMemoryReference(memoryReference);
    const safeOffset = boundedRequiredInteger(offset, -0x7fffffff, 0x7fffffff, '内存偏移'); const safeCount = boundedRequiredInteger(count, 1, 4096, '内存长度');
    const response = await session.connection.request<any>('readMemory', { memoryReference: reference, offset: safeOffset, count: safeCount });
    const data = String(response?.data || ''); let bytes: number[];
    try { bytes = [...Buffer.from(data, 'base64')]; } catch { throw new Error('调试适配器返回了无效的内存数据。'); }
    return { address: String(response?.address || reference), data, bytes, unreadableBytes: Number(response?.unreadableBytes || 0) };
  }

  async disassemble(memoryReference: string, offset = 0, instructionCount = 64): Promise<DebugInstruction[]> {
    const session = this.requireStoppedSession(); const reference = validMemoryReference(memoryReference);
    const response = await session.connection.request<any>('disassemble', { memoryReference: reference,
      offset: boundedRequiredInteger(offset, -0x7fffffff, 0x7fffffff, '反汇编偏移'), instructionCount: boundedRequiredInteger(instructionCount, 1, 512, '指令数量'), resolveSymbols: true });
    return (response?.instructions || []).map((item: any) => ({ address: String(item.address || ''), instruction: String(item.instruction || ''),
      symbol: item.symbol ? String(item.symbol) : undefined, location: item.location?.path ? String(item.location.path) : undefined,
      line: Number.isInteger(item.line) ? item.line : undefined, column: Number.isInteger(item.column) ? item.column : undefined }));
  }

  async stop(): Promise<NativeDebugSnapshot | null> {
    const session = this.session; if (!session) return null;
    session.intentionalStop = true;
    try { await session.connection.request('disconnect', { restart: false, terminateDebuggee: true }, 5000); } catch { /* force below */ }
    session.connection.terminate();
    try { await session.connection.waitForExit?.(3000); } catch { session.snapshot.logs.push('调试适配器未及时退出，已完成强制终止请求。'); }
    session.snapshot.state = 'terminated'; session.snapshot.description = '用户已停止调试。'; session.snapshot.logs.push('原生调试会话已停止。'); this.emit();
    return clone(session.snapshot);
  }

  private async control(command: 'continue' | 'next' | 'stepIn' | 'stepOut'): Promise<NativeDebugSnapshot> {
    const session = this.requireSession(); const threadId = session.snapshot.threadId;
    if (session.snapshot.state !== 'stopped' || !threadId) throw new Error('调试器当前未停在断点，不能执行继续或单步。');
    await session.connection.request(command, { threadId, singleThread: false }); session.snapshot.state = 'running'; session.snapshot.stopReason = undefined; this.emit(); return clone(session.snapshot);
  }

  private wire(session: Session): void {
    const { connection, snapshot } = session;
    connection.on('event', (message: DapMessage) => {
      const body = message.body || {};
      if (message.event === 'stopped') { snapshot.state = 'stopped'; snapshot.threadId = body.threadId; snapshot.stopReason = body.reason; snapshot.description = body.description; snapshot.logs.push(`程序已暂停：${body.description || body.reason || '未知原因'}`); }
      else if (message.event === 'continued') { snapshot.state = 'running'; snapshot.stopReason = undefined; }
      else if (message.event === 'breakpoint' && body.breakpoint) {
        const index = snapshot.breakpoints.findIndex(item => item.id === body.breakpoint.id);
        if (index >= 0) snapshot.breakpoints[index] = { ...snapshot.breakpoints[index], verified: Boolean(body.breakpoint.verified), message: body.breakpoint.message, actualLine: body.breakpoint.line };
      }
      else if (message.event === 'output' && typeof body.output === 'string') snapshot.logs.push(body.output.trimEnd());
      else if (message.event === 'exited') { snapshot.exitCode = body.exitCode; snapshot.logs.push(`被调试程序已退出，代码 ${body.exitCode ?? 0}。`); }
      else if (message.event === 'terminated') { snapshot.state = 'terminated'; queueMicrotask(() => connection.terminate()); }
      this.emit();
    });
    connection.on('request', (request: DapMessage) => connection.respond(request, false, undefined, 'LingBuilder 当前不支持调试适配器反向请求。'));
    connection.on('stderr', (text: string) => { if (text.trim()) { snapshot.logs.push(`[适配器] ${text.trim()}`); this.emit(); } });
    connection.on('close', (error: Error) => {
      if (snapshot.state !== 'terminated' && !session.intentionalStop) { snapshot.state = 'error'; snapshot.description = error.message; snapshot.logs.push(error.message); this.emit(); }
    });
  }

  private async sendBreakpoints(connection: DebugConnection, breakpoints: NativeBreakpoint[]): Promise<VerifiedBreakpoint[]> {
    const groups = new Map<string, NativeBreakpoint[]>();
    for (const breakpoint of breakpoints) groups.set(breakpoint.sourcePath, [...(groups.get(breakpoint.sourcePath) || []), breakpoint]);
    const verified: VerifiedBreakpoint[] = [];
    for (const [sourcePath, items] of groups) {
      const response = await connection.request<any>('setBreakpoints', {
        source: { name: path.basename(sourcePath), path: sourcePath },
        breakpoints: items.map(item => ({ line: item.line, condition: item.condition })), sourceModified: false
      });
      items.forEach((item, index) => { const result = response?.breakpoints?.[index] || {}; verified.push({ ...item, id: result.id, verified: Boolean(result.verified), message: result.message, actualLine: result.line }); });
    }
    return verified;
  }

  private requireSession(): Session {
    if (!this.session || ['terminated', 'error'].includes(this.session.snapshot.state)) throw new Error('当前没有可操作的原生调试会话。'); return this.session;
  }
  private requireStoppedSession(): Session {
    const session = this.requireSession(); if (session.snapshot.state !== 'stopped') throw new Error('只有程序暂停时才能读取线程、调用栈、变量或监视表达式。'); return session;
  }
  private async readVariables(session: Session, variablesReference: number, start: number, count: number): Promise<DebugVariable[]> {
    const response = await session.connection.request<any>('variables', { variablesReference, start, count });
    return (response?.variables || []).slice(0, count).map((item: any) => ({ name: String(item.name || ''), value: String(item.value ?? ''),
      type: item.type ? String(item.type) : undefined, evaluateName: item.evaluateName ? String(item.evaluateName) : undefined,
      variablesReference: Number(item.variablesReference || 0), namedVariables: Number.isInteger(item.namedVariables) ? item.namedVariables : undefined,
      indexedVariables: Number.isInteger(item.indexedVariables) ? item.indexedVariables : undefined, memoryReference: item.memoryReference ? String(item.memoryReference) : undefined }));
  }
  private async validateBreakpoints(items: NativeBreakpoint[]): Promise<NativeBreakpoint[]> {
    if (items.length > 500) throw new Error('单次最多设置 500 个断点。');
    return await Promise.all(items.map(async item => ({
      sourcePath: await this.resolveFile(item.sourcePath), line: validLine(item.line),
      ...(item.condition?.trim() ? { condition: validCondition(item.condition) } : {}),
      ...(item.clientSourcePath ? { clientSourcePath: item.clientSourcePath.replace(/\\/gu, '/') } : {}),
      ...(item.clientLine ? { clientLine: validLine(item.clientLine) } : {})
    })));
  }
  private async resolveFile(value: string): Promise<string> { const file = await this.resolveInside(value); if (!(await fs.stat(file)).isFile()) throw new Error('调试目标必须是工作区内文件。'); return file; }
  private async resolveDirectory(value: string): Promise<string> { const dir = await this.resolveInside(value); if (!(await fs.stat(dir)).isDirectory()) throw new Error('调试工作目录无效。'); return dir; }
  private async resolveInside(value: string): Promise<string> {
    const root = await fs.realpath(this.workspaceRoot); const candidate = await fs.realpath(path.resolve(this.workspaceRoot, value)); const relative = path.relative(root, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('调试路径不能超出当前工作区。'); return candidate;
  }
  private emit(): void { if (!this.session) return; const snapshot = clone(this.session.snapshot); this.listeners.forEach(listener => listener(snapshot)); }
}

export async function findOpenDebugAdapter(): Promise<string> {
  const candidates: string[] = [];
  if (process.env.LINGBUILDER_DEBUG_ADAPTER) candidates.push(process.env.LINGBUILDER_DEBUG_ADAPTER);
  candidates.push(
    path.join(process.env.ProgramFiles || '', 'LLVM', 'bin', 'lldb-dap.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'LLVM', 'bin', 'lldb-dap.exe')
  );
  for (const directory of (process.env.PATH || '').split(path.delimiter)) candidates.push(path.join(directory, process.platform === 'win32' ? 'lldb-dap.exe' : 'lldb-dap'));
  for (const candidate of candidates) try { if ((await fs.stat(candidate)).isFile()) return await fs.realpath(candidate); } catch { /* next */ }
  throw new Error('未找到开源原生调试适配器 lldb-dap。请安装 LLVM，或通过 LINGBUILDER_DEBUG_ADAPTER 配置 lldb-dap 路径。');
}

function createAdapterConnection(adapterPath: string): DebugConnection {
  const child = spawn(adapterPath, [], { cwd: path.dirname(adapterPath), stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  return new DapConnection(child);
}
function isLldbDap(adapterPath: string): boolean { return path.basename(adapterPath).toLowerCase().startsWith('lldb-dap'); }
function validLine(value: number): number { if (!Number.isInteger(value) || value < 1 || value > 10_000_000) throw new Error('断点行号无效。'); return value; }
function validCondition(value: string): string { const result = value.trim(); if (!result || result.length > 1000 || /[\r\n\0]/u.test(result)) throw new Error('条件断点表达式无效。'); return result; }
function validReference(value: unknown, label: string): number { if (!Number.isInteger(value) || Number(value) <= 0) throw new Error(`${label}引用无效。`); return Number(value); }
function boundedInteger(value: unknown, min: number, max: number): number { if (!Number.isInteger(value)) return min; return Math.max(min, Math.min(max, Number(value))); }
function boundedRequiredInteger(value: unknown, min: number, max: number, label: string): number { if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error(`${label}无效。`); return Number(value); }
function validMemoryReference(value: string): string { const result = value?.trim(); if (!result || result.length > 256 || /[\r\n\0]/u.test(result)) throw new Error('内存引用无效。'); return result; }
function validRemoteHost(value: string): string { const result = value.trim(); if (!result || result.length > 253 || !/^[a-z0-9._:-]+$/iu.test(result)) throw new Error('远程主机名无效。'); return result; }
function validateArgs(args?: string[]): string[] { if (!args) return []; if (!Array.isArray(args) || args.length > 128 || args.some(item => typeof item !== 'string' || item.length > 4096 || /\0/u.test(item))) throw new Error('调试参数无效。'); return [...args]; }
function clone(snapshot: NativeDebugSnapshot): NativeDebugSnapshot { return { ...snapshot, breakpoints: snapshot.breakpoints.map(item => ({ ...item })), logs: [...snapshot.logs] }; }
