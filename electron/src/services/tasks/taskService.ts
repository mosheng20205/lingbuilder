import crypto from 'node:crypto';

export type TaskState = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type TaskLogLevel = 'info' | 'warning' | 'error';

export interface TaskLogEntry { timestamp: string; level: TaskLogLevel; message: string }
export interface TaskSnapshot {
  id: string; type: string; title: string; group: string; state: TaskState; progress: number;
  createdAt: string; startedAt?: string; finishedAt?: string; error?: string; logs: TaskLogEntry[];
}
export interface TaskContext {
  signal: AbortSignal;
  report(progress: number, message?: string): void;
  log(message: string, level?: TaskLogLevel): void;
}
export interface TaskRequest<T> {
  type: string; title: string; group?: string; run(context: TaskContext): Promise<T>;
}
export interface TaskHandle<T> { id: string; result: Promise<T>; cancel(reason?: string): boolean }

interface TaskEntry<T = unknown> {
  snapshot: TaskSnapshot; request: TaskRequest<T>; controller: AbortController;
  resolve: (value: T) => void; reject: (error: Error) => void;
}

export class TaskCancelledError extends Error {
  constructor(message = '任务已取消。') { super(message); this.name = 'TaskCancelledError'; }
}

export class TaskService {
  private readonly entries = new Map<string, TaskEntry>();
  private readonly queues = new Map<string, string[]>();
  private readonly runningGroups = new Set<string>();
  private readonly listeners = new Set<(snapshot: TaskSnapshot) => void>();

  enqueue<T>(request: TaskRequest<T>): TaskHandle<T> {
    if (!request.type.trim() || !request.title.trim()) throw new Error('任务类型和标题不能为空。');
    const id = crypto.randomUUID();
    const group = request.group?.trim() || 'default';
    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;
    const result = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
    const entry: TaskEntry<T> = {
      request: { ...request, group }, controller: new AbortController(), resolve, reject,
      snapshot: { id, type: request.type, title: request.title, group, state: 'queued', progress: 0, createdAt: now(), logs: [] }
    };
    this.entries.set(id, entry);
    this.queues.set(group, [...(this.queues.get(group) || []), id]);
    this.emit(entry);
    void this.drain(group);
    return { id, result, cancel: reason => this.cancel(id, reason) };
  }

  cancel(id: string, reason = '用户已取消任务。'): boolean {
    const entry = this.entries.get(id);
    if (!entry || isTerminal(entry.snapshot.state)) return false;
    entry.controller.abort(new TaskCancelledError(reason));
    if (entry.snapshot.state === 'queued') {
      this.queues.set(entry.snapshot.group, (this.queues.get(entry.snapshot.group) || []).filter(taskId => taskId !== id));
      this.finishCancelled(entry, reason);
    }
    return true;
  }

  get(id: string): TaskSnapshot | null { const entry = this.entries.get(id); return entry ? clone(entry.snapshot) : null; }
  list(): TaskSnapshot[] { return [...this.entries.values()].map(entry => clone(entry.snapshot)); }
  subscribe(listener: (snapshot: TaskSnapshot) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }

  private async drain(group: string): Promise<void> {
    if (this.runningGroups.has(group)) return;
    const id = this.queues.get(group)?.shift();
    if (!id) return;
    const entry = this.entries.get(id)!;
    this.runningGroups.add(group);
    entry.snapshot.state = 'running'; entry.snapshot.startedAt = now(); this.emit(entry);
    const context: TaskContext = {
      signal: entry.controller.signal,
      report: (progress, message) => {
        if (entry.controller.signal.aborted) return;
        entry.snapshot.progress = Math.max(entry.snapshot.progress, Math.min(100, Math.max(0, Math.round(progress))));
        if (message) this.addLog(entry, message, 'info'); else this.emit(entry);
      },
      log: (message, level = 'info') => this.addLog(entry, message, level)
    };
    try {
      const value = await entry.request.run(context);
      if (entry.controller.signal.aborted) this.finishCancelled(entry, abortMessage(entry.controller.signal));
      else { entry.snapshot.state = 'succeeded'; entry.snapshot.progress = 100; entry.snapshot.finishedAt = now(); this.emit(entry); entry.resolve(value); }
    } catch (error) {
      if (entry.controller.signal.aborted || error instanceof TaskCancelledError) this.finishCancelled(entry, errorMessage(error));
      else { entry.snapshot.state = 'failed'; entry.snapshot.error = errorMessage(error); entry.snapshot.finishedAt = now(); this.addLog(entry, entry.snapshot.error, 'error'); entry.reject(error instanceof Error ? error : new Error(String(error))); }
    } finally {
      this.runningGroups.delete(group);
      void this.drain(group);
    }
  }

  private finishCancelled(entry: TaskEntry, message: string): void {
    entry.snapshot.state = 'cancelled'; entry.snapshot.finishedAt = now(); entry.snapshot.error = message;
    this.addLog(entry, message, 'warning'); entry.reject(new TaskCancelledError(message));
  }
  private addLog(entry: TaskEntry, message: string, level: TaskLogLevel): void {
    entry.snapshot.logs.push({ timestamp: now(), level, message });
    if (entry.snapshot.logs.length > 500) entry.snapshot.logs.splice(0, entry.snapshot.logs.length - 500);
    this.emit(entry);
  }
  private emit(entry: TaskEntry): void { const snapshot = clone(entry.snapshot); this.listeners.forEach(listener => listener(snapshot)); }
}

const now = () => new Date().toISOString();
const clone = (snapshot: TaskSnapshot): TaskSnapshot => ({ ...snapshot, logs: snapshot.logs.map(log => ({ ...log })) });
const isTerminal = (state: TaskState) => state === 'succeeded' || state === 'failed' || state === 'cancelled';
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const abortMessage = (signal: AbortSignal) => errorMessage(signal.reason || '任务已取消。');
