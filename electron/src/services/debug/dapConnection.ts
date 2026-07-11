import { EventEmitter } from 'node:events';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';

export interface DapMessage { seq: number; type: 'request' | 'response' | 'event'; command?: string; event?: string; request_seq?: number; success?: boolean; message?: string; body?: any; arguments?: any }

export class DapConnection extends EventEmitter {
  private buffer = Buffer.alloc(0); private sequence = 1;
  private readonly pending = new Map<number, { resolve: (body: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  private closed = false;
  private readonly exitPromise: Promise<void>;

  constructor(private readonly child: ChildProcessWithoutNullStreams, private readonly timeoutMs = 15_000) {
    super(); this.exitPromise = new Promise(resolve => child.once('exit', () => resolve())); child.stdout.on('data', chunk => this.accept(Buffer.from(chunk)));
    child.stderr.on('data', chunk => this.emit('stderr', String(chunk)));
    child.once('exit', (code, signal) => this.close(new Error(`调试适配器已退出（code=${code ?? 'null'}, signal=${signal ?? 'none'}）。`)));
    child.once('error', error => this.close(error));
  }

  request<T = any>(command: string, args?: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    if (this.closed) return Promise.reject(new Error('调试适配器连接已关闭。'));
    const seq = this.sequence++; const message: DapMessage = { seq, type: 'request', command, arguments: args };
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(seq); reject(new Error(`调试请求 ${command} 超时。`)); }, timeoutMs);
      this.pending.set(seq, { resolve, reject, timer }); this.write(message);
    });
  }

  respond(request: DapMessage, success: boolean, body?: unknown, message?: string): void {
    this.write({ seq: this.sequence++, type: 'response', request_seq: request.seq, command: request.command, success, body, message });
  }

  waitForEvent<T = any>(event: string, predicate: (body: T) => boolean = () => true, timeoutMs = this.timeoutMs): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); reject(new Error(`等待调试事件 ${event} 超时。`)); }, timeoutMs);
      const listener = (body: T) => { if (!predicate(body)) return; cleanup(); resolve(body); };
      const cleanup = () => { clearTimeout(timer); this.off(`event:${event}`, listener); };
      this.on(`event:${event}`, listener);
    });
  }

  terminate(): void { if (!this.closed && !this.child.kill()) this.close(new Error('调试适配器连接已终止。')); }
  async waitForExit(timeoutMs = 3000): Promise<void> {
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([this.exitPromise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('调试适配器退出超时。')), timeoutMs); })]).finally(() => { if (timer) clearTimeout(timer); });
  }

  private accept(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n'); if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/iu);
      if (!match) { this.emit('protocolError', new Error('DAP 消息缺少 Content-Length。')); this.buffer = Buffer.alloc(0); return; }
      const length = Number(match[1]); const total = headerEnd + 4 + length; if (this.buffer.length < total) return;
      const payload = this.buffer.subarray(headerEnd + 4, total).toString('utf8'); this.buffer = this.buffer.subarray(total);
      try { this.handle(JSON.parse(payload) as DapMessage); } catch (error) { this.emit('protocolError', error); }
    }
  }

  private handle(message: DapMessage): void {
    if (message.type === 'response' && message.request_seq) {
      const pending = this.pending.get(message.request_seq); if (!pending) return;
      this.pending.delete(message.request_seq); clearTimeout(pending.timer);
      if (message.success === false) pending.reject(new Error(message.message || `调试请求 ${message.command || ''} 失败。`)); else pending.resolve(message.body);
      return;
    }
    if (message.type === 'event' && message.event) { this.emit('event', message); this.emit(`event:${message.event}`, message.body); return; }
    if (message.type === 'request') this.emit('request', message);
  }

  private write(message: DapMessage): void {
    const json = JSON.stringify(message); this.child.stdin.write(`Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`);
  }

  private close(error: Error): void {
    if (this.closed) return; this.closed = true;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear(); this.emit('close', error);
  }
}
