import { randomUUID } from 'node:crypto';
import type { Server as HttpServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { PtyTerminalService, TerminalEvent, TerminalSessionSnapshot } from './ptyTerminalService';

export interface TerminalServerMessage {
  type: 'snapshot' | 'event' | 'error';
  session?: TerminalSessionSnapshot;
  event?: TerminalEvent;
  error?: string;
}

export interface TerminalClientMessage {
  type: 'input' | 'resize' | 'close';
  id?: unknown;
  data?: unknown;
  cols?: unknown;
  rows?: unknown;
}

const MAX_PAYLOAD = 1024 * 1024;
const TICKET_TTL_MS = 30_000;

const pendingTickets = new Map<string, number>();

/** 发放一次性 WS 接入票据：渲染层先经受会话鉴权保护的 REST 换票，再随握手查询参数携带。 */
export function createTerminalWebSocketTicket(): string {
  const ticket = randomUUID();
  pendingTickets.set(ticket, Date.now());
  for (const [key, createdAt] of pendingTickets) {
    if (Date.now() - createdAt > TICKET_TTL_MS) pendingTickets.delete(key);
  }
  return ticket;
}

function consumeTicket(value: string | null): boolean {
  if (!value) return false;
  const createdAt = pendingTickets.get(value);
  pendingTickets.delete(value);
  return createdAt !== undefined && Date.now() - createdAt <= TICKET_TTL_MS;
}

export interface TerminalWebSocketBridge {
  /** 工作区切换重建 PtyTerminalService 后调用：对每个在线客户端重订阅新实例并补发权威快照。 */
  resync(): void;
  close(): Promise<void>;
}

/** 服务端最小会话操作面：以适配器注入，工作区切换重建 PtyTerminalService 后自动跟随新实例。 */
export interface TerminalWebSocketServiceAdapter {
  list(): TerminalSessionSnapshot[];
  subscribe(listener: (event: TerminalEvent) => void): () => void;
  write(id: string, data: string): void;
  resize(id: string, cols: number, rows: number): TerminalSessionSnapshot;
  close(id: string): boolean;
}

/**
 * 终端 WebSocket 双向通道：替代 SSE + 逐键 HTTP POST。
 * 单连接天然保证输入/输出两个方向的有序性；每次（重）连都会下发带完整 buffer 的会话快照，
 * 渲染层重置回放后即可修复任何状态分叉。票据在握手层校验，与会话令牌同口径，单次有效。
 */
export function attachTerminalWebSocketServer(server: HttpServer, service: TerminalWebSocketServiceAdapter, path = '/api/terminal/ws'): TerminalWebSocketBridge {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const alive = new WeakSet<object>();
  const clients = new Map<WebSocket, () => void>();
  const heartbeat = setInterval(() => {
    wss.clients.forEach(client => {
      if (!alive.has(client)) {
        client.terminate();
        return;
      }
      alive.delete(client);
      client.ping();
    });
  }, 30_000);
  heartbeat.unref();
  server.on('upgrade', (request, socket, head) => {
    let pathname = '';
    let ticket: string | null = null;
    try {
      const url = new URL(request.url || '/', 'http://127.0.0.1');
      pathname = url.pathname;
      ticket = url.searchParams.get('ticket');
    } catch {
      return;
    }
    if (pathname !== path) return;
    if (!consumeTicket(ticket)) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(request, socket, head, ws => {
      alive.add(ws);
      ws.on('pong', () => alive.add(ws));
      const send = (message: TerminalServerMessage): void => {
        if (ws.readyState !== ws.OPEN) return;
        try {
          ws.send(JSON.stringify(message));
        } catch {
          /* 连接已断开 */
        }
      };
      // 先订阅再取快照：订阅与快照之间不会漏输出；快照与事件的序号交叠由客户端序号守卫去重
      const subscribeCurrent = (): (() => void) => service.subscribe(event => send({ type: 'event', event }));
      let unsubscribe = subscribeCurrent();
      clients.set(ws, unsubscribe);
      service.list().forEach(session => send({ type: 'snapshot', session }));
      ws.on('message', raw => {
        let message: TerminalClientMessage;
        try {
          message = JSON.parse(String(raw)) as TerminalClientMessage;
        } catch {
          send({ type: 'error', error: '终端通道消息必须是合法 JSON。' });
          return;
        }
        if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
          send({ type: 'error', error: '终端通道消息格式无效。' });
          return;
        }
        try {
          if (message.type === 'input') {
            if (typeof message.id !== 'string' || typeof message.data !== 'string') throw new Error('终端输入必须携带会话 ID 与文本。');
            service.write(message.id, message.data);
          } else if (message.type === 'resize') {
            if (typeof message.id !== 'string') throw new Error('终端调整尺寸必须携带会话 ID。');
            const cols = Number(message.cols);
            const rows = Number(message.rows);
            if (!Number.isInteger(cols) || !Number.isInteger(rows)) throw new Error('终端尺寸必须是整数。');
            service.resize(message.id, cols, rows);
          } else if (message.type === 'close') {
            if (typeof message.id !== 'string') throw new Error('终端关闭必须携带会话 ID。');
            service.close(message.id);
          } else {
            throw new Error(`未知的终端通道消息类型：${message.type}`);
          }
        } catch (error) {
          send({ type: 'error', error: error instanceof Error ? error.message : '终端通道消息处理失败。' });
        }
      });
      ws.on('close', () => {
        clients.delete(ws);
        unsubscribe();
      });
      ws.on('error', () => ws.close());
    });
  });
  return {
    resync: () => {
      clients.forEach((unsubscribe, ws) => {
        unsubscribe();
        if (ws.readyState !== ws.OPEN) {
          clients.delete(ws);
          return;
        }
        const send = (message: TerminalServerMessage): void => {
          try {
            ws.send(JSON.stringify(message));
          } catch {
            /* 连接已断开 */
          }
        };
        clients.set(ws, service.subscribe(event => send({ type: 'event', event })));
        service.list().forEach(session => send({ type: 'snapshot', session }));
      });
    },
    close: () => new Promise(resolve => {
      clearInterval(heartbeat);
      wss.clients.forEach(client => client.terminate());
      wss.close(() => resolve());
    })
  };
}
