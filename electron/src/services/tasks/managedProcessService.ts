import { spawn, type ChildProcess } from 'node:child_process';
import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import type { Writable } from 'node:stream';

export type ManagedProcessState = 'running' | 'stopping';
export type ManagedProcessDiagnosticLevel = 'info' | 'warning' | 'error';
export type ManagedProcessSignal = NodeJS.Signals | number;

export interface ManagedProcessDiagnostic {
  level: ManagedProcessDiagnosticLevel;
  message: string;
  projectId: string;
  pid?: number;
  timestamp: string;
}

export interface ManagedProcessStatus {
  projectId: string;
  pid: number;
  state: ManagedProcessState;
  command?: string;
  args: string[];
  cwd?: string;
  logFilePath?: string;
  startedAt: string;
  stopRequestedAt?: string;
}

export interface ManagedProcessStartOptions {
  args?: readonly string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  windowsHide?: boolean;
  detached?: boolean;
  /** 将子进程标准输出转发到这个流；流的生命周期仍由调用方负责。 */
  stdout?: Writable;
  /** 将子进程标准错误转发到这个流；流的生命周期仍由调用方负责。 */
  stderr?: Writable;
  /** 将 stdout 和 stderr 合并写入此文件；目录不存在时会自动创建。 */
  logFilePath?: string;
}

export interface ManagedProcessRegisterOptions {
  command?: string;
  args?: readonly string[];
  cwd?: string;
  logFilePath?: string;
  startedAt?: Date;
}

export interface ManagedProcessStartResult {
  pid: number;
  status: ManagedProcessStatus;
  replaced: boolean;
  message: string;
}

export interface ManagedProcessStopResult {
  projectId: string;
  pid?: number;
  found: boolean;
  stopped: boolean;
  forced: boolean;
  exitCode?: number | null;
  signal?: NodeJS.Signals | null;
  message: string;
}

export interface ManagedProcessStopAllResult {
  total: number;
  stopped: number;
  forced: number;
  results: ManagedProcessStopResult[];
  message: string;
}

export interface ManagedProcessServiceOptions {
  gracefulStopTimeoutMs?: number;
  forceStopTimeoutMs?: number;
  onDiagnostic?: (diagnostic: ManagedProcessDiagnostic) => void;
  /** 仅用于宿主适配和测试；默认始终通过登记的 ChildProcess 句柄发送信号。 */
  sendSignal?: (child: ChildProcess, signal: ManagedProcessSignal) => boolean;
}

interface ProcessExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

interface ManagedProcessEntry {
  child: ChildProcess;
  status: ManagedProcessStatus;
  exited: boolean;
  exit?: ProcessExit;
  exitPromise: Promise<ProcessExit>;
  resolveExit: (exit: ProcessExit) => void;
  closed: boolean;
  close?: ProcessExit;
  closePromise: Promise<ProcessExit>;
  resolveClose: (exit: ProcessExit) => void;
  settled: boolean;
  settledPromise: Promise<void>;
}

const DEFAULT_GRACEFUL_STOP_TIMEOUT_MS = 1_500;
const DEFAULT_FORCE_STOP_TIMEOUT_MS = 1_000;

/**
 * 只管理显式启动或登记的子进程。服务不会按进程名扫描，也不会调用 taskkill/pkill，
 * 因而停止项目时不会误伤同名或无关进程。
 */
export class ManagedProcessService {
  private readonly processes = new Map<string, ManagedProcessEntry>();
  private readonly projectOperations = new Map<string, Promise<void>>();
  private readonly gracefulStopTimeoutMs: number;
  private readonly forceStopTimeoutMs: number;
  private readonly onDiagnostic?: (diagnostic: ManagedProcessDiagnostic) => void;
  private readonly sendSignal: (child: ChildProcess, signal: ManagedProcessSignal) => boolean;

  constructor(options: ManagedProcessServiceOptions = {}) {
    this.gracefulStopTimeoutMs = normalizeTimeout(
      options.gracefulStopTimeoutMs,
      DEFAULT_GRACEFUL_STOP_TIMEOUT_MS
    );
    this.forceStopTimeoutMs = normalizeTimeout(
      options.forceStopTimeoutMs,
      DEFAULT_FORCE_STOP_TIMEOUT_MS
    );
    this.onDiagnostic = options.onDiagnostic;
    this.sendSignal = options.sendSignal ?? ((child, signal) => child.kill(signal));
  }

  async start(
    projectId: string,
    command: string,
    options: ManagedProcessStartOptions = {}
  ): Promise<ManagedProcessStartResult> {
    const normalizedProjectId = requireProjectId(projectId);
    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
      throw new Error('运行命令不能为空。');
    }

    return await this.runForProject(normalizedProjectId, async () => {
      const replaced = await this.replaceCurrentProcess(normalizedProjectId);
      const args = [...(options.args ?? [])];
      let logStream: WriteStream | undefined;

      try {
        if (options.logFilePath) {
          await mkdir(path.dirname(options.logFilePath), { recursive: true });
          logStream = createWriteStream(options.logFilePath, { flags: 'w' });
          logStream.on('error', error => {
            this.emitDiagnostic(
              'error',
              normalizedProjectId,
              `运行日志写入失败：${error.message}`
            );
          });
        }

        const captureOutput = Boolean(options.stdout || options.stderr || logStream);
        const child = spawn(normalizedCommand, args, {
          cwd: options.cwd,
          env: options.env,
          windowsHide: options.windowsHide,
          detached: options.detached,
          shell: false,
          stdio: captureOutput ? ['ignore', 'pipe', 'pipe'] : ['ignore', 'ignore', 'ignore']
        });

        await waitUntilSpawned(child);
        this.connectOutput(child, options.stdout, options.stderr, logStream);
        return this.attach(normalizedProjectId, child, {
          command: normalizedCommand,
          args,
          cwd: options.cwd,
          logFilePath: options.logFilePath
        }, replaced, '启动', logStream);
      } catch (error) {
        endOwnedStream(logStream);
        const reason = errorMessage(error);
        this.emitDiagnostic(
          'error',
          normalizedProjectId,
          `项目“${normalizedProjectId}”的运行进程启动失败：${reason}`
        );
        throw new Error(`项目“${normalizedProjectId}”的运行进程启动失败：${reason}`);
      }
    });
  }

  async register(
    projectId: string,
    child: ChildProcess,
    options: ManagedProcessRegisterOptions = {}
  ): Promise<ManagedProcessStartResult> {
    const normalizedProjectId = requireProjectId(projectId);
    return await this.runForProject(normalizedProjectId, async () => {
      const replaced = await this.replaceCurrentProcess(normalizedProjectId);
      try {
        await waitUntilSpawned(child);
        return this.attach(normalizedProjectId, child, options, replaced, '接管');
      } catch (error) {
        const reason = errorMessage(error);
        this.emitDiagnostic(
          'error',
          normalizedProjectId,
          `项目“${normalizedProjectId}”的运行进程登记失败：${reason}`
        );
        throw new Error(`项目“${normalizedProjectId}”的运行进程登记失败：${reason}`);
      }
    });
  }

  async stop(projectId: string): Promise<ManagedProcessStopResult> {
    const normalizedProjectId = requireProjectId(projectId);
    return await this.runForProject(
      normalizedProjectId,
      async () => await this.stopCurrentProcess(normalizedProjectId, true)
    );
  }

  async stopAll(): Promise<ManagedProcessStopAllResult> {
    const projectIds = [...this.processes.keys()];
    const results = await Promise.all(projectIds.map(projectId => this.stop(projectId)));
    const stopped = results.filter(result => result.stopped).length;
    const forced = results.filter(result => result.forced).length;
    const message = projectIds.length === 0
      ? '当前没有需要停止的受控运行进程。'
      : `已停止 ${stopped}/${projectIds.length} 个受控运行进程${forced ? `，其中 ${forced} 个已强制终止` : ''}。`;
    return { total: projectIds.length, stopped, forced, results, message };
  }

  getStatus(projectId: string): ManagedProcessStatus | null {
    const entry = this.processes.get(requireProjectId(projectId));
    return entry ? cloneStatus(entry.status) : null;
  }

  getAllStatuses(): ManagedProcessStatus[] {
    return [...this.processes.values()]
      .map(entry => cloneStatus(entry.status))
      .sort((left, right) => left.startedAt.localeCompare(right.startedAt));
  }

  isRunning(projectId: string): boolean {
    return this.processes.has(requireProjectId(projectId));
  }

  private async replaceCurrentProcess(projectId: string): Promise<boolean> {
    if (!this.processes.has(projectId)) {
      return false;
    }
    const result = await this.stopCurrentProcess(projectId, false);
    if (!result.stopped) {
      throw new Error(`无法替换项目“${projectId}”的旧运行进程：${result.message}`);
    }
    this.emitDiagnostic('info', projectId, `项目“${projectId}”的旧运行进程已停止，正在启动新进程。`);
    return true;
  }

  private attach(
    projectId: string,
    child: ChildProcess,
    options: ManagedProcessRegisterOptions,
    replaced: boolean,
    action: '启动' | '接管',
    ownedLogStream?: WriteStream
  ): ManagedProcessStartResult {
    if (child.pid === undefined) {
      throw new Error('子进程没有可用的 PID。');
    }
    if (hasExited(child)) {
      throw new Error('子进程已经退出，无法登记。');
    }

    let resolveExit: (exit: ProcessExit) => void = () => undefined;
    const exitPromise = new Promise<ProcessExit>(resolve => {
      resolveExit = resolve;
    });
    let resolveClose: (exit: ProcessExit) => void = () => undefined;
    const closePromise = new Promise<ProcessExit>(resolve => {
      resolveClose = resolve;
    });
    const ownedLogCompletion = waitForOwnedStreamCompletion(ownedLogStream);
    const settledPromise = Promise.all([closePromise, ownedLogCompletion]).then(() => undefined);
    const status: ManagedProcessStatus = {
      projectId,
      pid: child.pid,
      state: 'running',
      command: options.command,
      args: [...(options.args ?? [])],
      cwd: options.cwd,
      logFilePath: options.logFilePath,
      startedAt: (options.startedAt ?? new Date()).toISOString()
    };
    const entry: ManagedProcessEntry = {
      child,
      status,
      exited: false,
      exitPromise,
      resolveExit,
      closed: false,
      closePromise,
      resolveClose,
      settled: false,
      settledPromise
    };

    const onError = (error: Error) => {
      this.emitDiagnostic(
        'error',
        projectId,
        `项目“${projectId}”的运行进程发生错误：${error.message}`,
        child.pid
      );
    };
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      if (entry.exited) {
        return;
      }
      entry.exited = true;
      entry.exit = { code, signal };
      entry.resolveExit(entry.exit);
      if (entry.status.state === 'running') {
        const detail = signal ? `信号 ${signal}` : `退出码 ${code ?? '未知'}`;
        this.emitDiagnostic(
          'info',
          projectId,
          `项目“${projectId}”的运行进程已退出（${detail}）。`,
          child.pid
        );
      }
    };
    const onClose = (code: number | null, signal: NodeJS.Signals | null) => {
      if (entry.closed) {
        return;
      }
      if (!entry.exited) {
        onExit(code, signal);
      }
      entry.closed = true;
      entry.close = { code, signal };
      child.off('error', onError);
      endOwnedStream(ownedLogStream);
      entry.resolveClose(entry.close);
    };

    child.on('error', onError);
    child.once('exit', onExit);
    child.once('close', onClose);
    this.processes.set(projectId, entry);
    void entry.settledPromise.then(() => {
      entry.settled = true;
      if (this.processes.get(projectId) === entry) {
        this.processes.delete(projectId);
      }
    });

    // 防止极短生命周期的进程在监听器安装前已经退出。
    if (hasExited(child)) {
      onExit(child.exitCode, child.signalCode);
    }

    const message = replaced
      ? `项目“${projectId}”的运行进程已替换（PID ${child.pid}）。`
      : `项目“${projectId}”的运行进程已${action}（PID ${child.pid}）。`;
    this.emitDiagnostic('info', projectId, message, child.pid);
    return { pid: child.pid, status: cloneStatus(status), replaced, message };
  }

  private connectOutput(
    child: ChildProcess,
    stdout?: Writable,
    stderr?: Writable,
    logStream?: WriteStream
  ): void {
    const stdoutTargets = [stdout, logStream].filter((stream): stream is Writable => Boolean(stream));
    const stderrTargets = [stderr, logStream].filter((stream): stream is Writable => Boolean(stream));

    if (child.stdout) {
      if (stdoutTargets.length === 0) {
        child.stdout.resume();
      } else {
        stdoutTargets.forEach(target => child.stdout?.pipe(target, { end: false }));
      }
    }
    if (child.stderr) {
      if (stderrTargets.length === 0) {
        child.stderr.resume();
      } else {
        stderrTargets.forEach(target => child.stderr?.pipe(target, { end: false }));
      }
    }
  }

  private async stopCurrentProcess(
    projectId: string,
    reportMissing: boolean
  ): Promise<ManagedProcessStopResult> {
    const entry = this.processes.get(projectId);
    if (!entry) {
      const message = `项目“${projectId}”当前没有受控运行进程。`;
      if (reportMissing) {
        this.emitDiagnostic('info', projectId, message);
      }
      return { projectId, found: false, stopped: false, forced: false, message };
    }

    entry.status.state = 'stopping';
    entry.status.stopRequestedAt = new Date().toISOString();
    let forced = false;

    if (!entry.exited && !hasExited(entry.child)) {
      try {
        this.sendSignal(entry.child, 'SIGTERM');
      } catch (error) {
        this.emitDiagnostic(
          'warning',
          projectId,
          `项目“${projectId}”的运行进程无法正常终止：${errorMessage(error)}`,
          entry.status.pid
        );
      }
    }

    let exited = await waitForExit(entry, this.gracefulStopTimeoutMs);
    if (!exited && !entry.exited && !hasExited(entry.child)) {
      forced = true;
      this.emitDiagnostic(
        'warning',
        projectId,
        `项目“${projectId}”的运行进程在 ${this.gracefulStopTimeoutMs} 毫秒内未退出，正在强制终止。`,
        entry.status.pid
      );
      try {
        this.sendSignal(entry.child, 'SIGKILL');
      } catch (error) {
        this.emitDiagnostic(
          'error',
          projectId,
          `项目“${projectId}”的运行进程强制终止失败：${errorMessage(error)}`,
          entry.status.pid
        );
      }
      exited = await waitForExit(entry, this.forceStopTimeoutMs);
    }

    if (!exited && !entry.exited && !hasExited(entry.child)) {
      entry.status.state = 'running';
      delete entry.status.stopRequestedAt;
      const message = `项目“${projectId}”的运行进程仍未退出，请检查进程状态（PID ${entry.status.pid}）。`;
      this.emitDiagnostic('error', projectId, message, entry.status.pid);
      return {
        projectId,
        pid: entry.status.pid,
        found: true,
        stopped: false,
        forced,
        message
      };
    }

    const settled = await waitForSettlement(entry, this.forceStopTimeoutMs);
    if (!settled) {
      const message = `项目“${projectId}”的运行进程已退出，但输出管道或运行日志尚未完成收尾（PID ${entry.status.pid}）。`;
      this.emitDiagnostic('error', projectId, message, entry.status.pid);
      return {
        projectId,
        pid: entry.status.pid,
        found: true,
        stopped: false,
        forced,
        exitCode: entry.exit?.code ?? entry.child.exitCode,
        signal: entry.exit?.signal ?? entry.child.signalCode,
        message
      };
    }

    if (this.processes.get(projectId) === entry) {
      this.processes.delete(projectId);
    }
    const exit = entry.exit ?? {
      code: entry.child.exitCode,
      signal: entry.child.signalCode
    };
    const message = forced
      ? `项目“${projectId}”的运行进程已强制终止（PID ${entry.status.pid}）。`
      : `项目“${projectId}”的运行进程已停止（PID ${entry.status.pid}）。`;
    this.emitDiagnostic(forced ? 'warning' : 'info', projectId, message, entry.status.pid);
    return {
      projectId,
      pid: entry.status.pid,
      found: true,
      stopped: true,
      forced,
      exitCode: exit.code,
      signal: exit.signal,
      message
    };
  }

  private emitDiagnostic(
    level: ManagedProcessDiagnosticLevel,
    projectId: string,
    message: string,
    pid?: number
  ): void {
    try {
      this.onDiagnostic?.({
        level,
        projectId,
        message,
        pid,
        timestamp: new Date().toISOString()
      });
    } catch {
      // 诊断接收方不能影响进程回收。
    }
  }

  private async runForProject<T>(projectId: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.projectOperations.get(projectId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(operation);
    const marker = result.then(() => undefined, () => undefined);
    this.projectOperations.set(projectId, marker);
    try {
      return await result;
    } finally {
      if (this.projectOperations.get(projectId) === marker) {
        this.projectOperations.delete(projectId);
      }
    }
  }
}

export function createManagedProcessService(
  options: ManagedProcessServiceOptions = {}
): ManagedProcessService {
  return new ManagedProcessService(options);
}

function requireProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) {
    throw new Error('项目 ID 不能为空。');
  }
  return normalized;
}

function normalizeTimeout(value: number | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('进程停止超时时间必须是大于或等于 0 的有限数字。');
  }
  return Math.trunc(value);
}

function cloneStatus(status: ManagedProcessStatus): ManagedProcessStatus {
  return { ...status, args: [...status.args] };
}

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitUntilSpawned(child: ChildProcess): Promise<void> {
  if (child.pid !== undefined) {
    return;
  }
  if (hasExited(child)) {
    throw new Error('子进程在启动完成前已经退出。');
  }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      child.off('spawn', onSpawn);
      child.off('error', onError);
    };
    const onSpawn = () => {
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

async function waitForExit(entry: ManagedProcessEntry, timeoutMs: number): Promise<boolean> {
  if (entry.exited || hasExited(entry.child)) {
    return true;
  }
  return await new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    entry.exitPromise.then(() => finish(true), () => finish(false));
  });
}

async function waitForSettlement(entry: ManagedProcessEntry, timeoutMs: number): Promise<boolean> {
  if (entry.settled) {
    return true;
  }
  return await new Promise<boolean>(resolve => {
    let settled = false;
    const finish = (value: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    entry.settledPromise.then(() => finish(true), () => finish(false));
  });
}

function waitForOwnedStreamCompletion(stream: WriteStream | undefined): Promise<void> {
  if (!stream || stream.writableFinished || stream.closed) {
    return Promise.resolve();
  }
  return new Promise<void>(resolve => {
    let settled = false;
    const cleanup = () => {
      stream.off('finish', onFinished);
      stream.off('close', onFinished);
    };
    const onFinished = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    stream.once('finish', onFinished);
    stream.once('close', onFinished);
  });
}

function endOwnedStream(stream: WriteStream | undefined): void {
  if (stream && !stream.destroyed && !stream.writableEnded) {
    stream.end();
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
