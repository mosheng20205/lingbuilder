import { EventEmitter } from 'node:events';
import type { Readable, Writable } from 'node:stream';

export interface JsonRpcMessage { jsonrpc: '2.0'; id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { code: number; message: string; data?: unknown } }

export class JsonRpcConnection extends EventEmitter {
  private buffer = Buffer.alloc(0);
  private nextId = 1;
  private readonly pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();

  constructor(private readonly input: Readable, private readonly output: Writable) {
    super();
    input.on('data', chunk => this.consume(Buffer.from(chunk)));
    input.on('error', error => this.failPending(error));
    input.on('end', () => this.failPending(new Error('LSP 输出流已关闭。')));
  }

  request<T>(method: string, params?: unknown, signal?: AbortSignal): Promise<T> {
    const id = this.nextId++;
    const promise = new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: value => resolve(value as T), reject });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
    if (signal) {
      const cancel = () => {
        if (!this.pending.has(id)) return;
        this.notify('$/cancelRequest', { id });
        this.pending.get(id)!.reject(new Error(`LSP 请求已取消：${method}`));
        this.pending.delete(id);
      };
      if (signal.aborted) cancel(); else signal.addEventListener('abort', cancel, { once: true });
      void promise.finally(() => signal.removeEventListener('abort', cancel)).catch(() => undefined);
    }
    return promise;
  }

  notify(method: string, params?: unknown): void { this.send({ jsonrpc: '2.0', method, params }); }
  dispose(reason = 'LSP 连接已关闭。'): void { this.failPending(new Error(reason)); this.removeAllListeners(); }

  private send(message: JsonRpcMessage): void {
    const json = Buffer.from(JSON.stringify(message), 'utf8');
    this.output.write(`Content-Length: ${json.byteLength}\r\n\r\n`);
    this.output.write(json);
  }

  private consume(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const headerEnd = this.buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) return;
      const header = this.buffer.subarray(0, headerEnd).toString('ascii');
      const match = /(?:^|\r\n)Content-Length:\s*(\d+)/iu.exec(header);
      if (!match) { this.emit('protocolError', new Error('LSP 消息缺少 Content-Length。')); this.buffer = this.buffer.subarray(headerEnd + 4); continue; }
      const length = Number(match[1]);
      if (this.buffer.byteLength < headerEnd + 4 + length) return;
      const body = this.buffer.subarray(headerEnd + 4, headerEnd + 4 + length);
      this.buffer = this.buffer.subarray(headerEnd + 4 + length);
      try { this.handle(JSON.parse(body.toString('utf8')) as JsonRpcMessage); }
      catch (error) { this.emit('protocolError', error); }
    }
  }

  private handle(message: JsonRpcMessage): void {
    if (typeof message.id === 'number' && !message.method) {
      const pending = this.pending.get(message.id); if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(`LSP ${message.error.code}：${message.error.message}`)); else pending.resolve(message.result);
      return;
    }
    if (message.method) this.emit('notification', message.method, message.params);
  }

  private failPending(error: Error): void { this.pending.forEach(item => item.reject(error)); this.pending.clear(); }
}
