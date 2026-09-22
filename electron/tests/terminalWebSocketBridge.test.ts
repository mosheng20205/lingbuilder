import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { attachTerminalWebSocketServer, createTerminalWebSocketTicket, type TerminalServerMessage } from '../src/services/terminal/terminalWebSocketBridge';
import { PtyTerminalService, type PtyProcess, type PtySpawner } from '../src/services/terminal/ptyTerminalService';

class FakePty implements PtyProcess {
  pid = 42; writes: string[] = []; sizes: Array<[number, number]> = []; killed = false;
  dataListeners = new Set<(data: string) => void>(); exitListeners = new Set<(event: { exitCode: number }) => void>();
  write(data: string) { this.writes.push(data); }
  resize(cols: number, rows: number) { this.sizes.push([cols, rows]); }
  kill() { this.killed = true; }
  onData(listener: (data: string) => void) { this.dataListeners.add(listener); return { dispose: () => this.dataListeners.delete(listener) }; }
  onExit(listener: (event: { exitCode: number }) => void) { this.exitListeners.add(listener); return { dispose: () => this.exitListeners.delete(listener) }; }
  emitData(data: string) { this.dataListeners.forEach(listener => listener(data)); }
}

interface QueuedClient {
  client: WebSocket;
  queue: TerminalServerMessage[];
  next(predicate: (message: TerminalServerMessage) => boolean, timeoutMs?: number): Promise<TerminalServerMessage>;
}

// 消息监听器必须与构造同时挂上：服务端在握手完成瞬间就发快照，晚挂会丢消息
function makeClient(url: string): QueuedClient {
  const client = new WebSocket(url);
  const queue: TerminalServerMessage[] = [];
  const waiters: Array<{ predicate: (message: TerminalServerMessage) => boolean; resolve: (message: TerminalServerMessage) => void; timer: NodeJS.Timeout }> = [];
  client.on('message', raw => {
    const message = JSON.parse(String(raw)) as TerminalServerMessage;
    const index = waiters.findIndex(waiter => waiter.predicate(message));
    if (index >= 0) {
      const waiter = waiters[index];
      waiters.splice(index, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(message);
      return;
    }
    queue.push(message);
  });
  return {
    client,
    queue,
    next(predicate, timeoutMs = 2000) {
      const index = queue.findIndex(predicate);
      if (index >= 0) return Promise.resolve(queue.splice(index, 1)[0]);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          const waiterIndex = waiters.findIndex(waiter => waiter.timer === timer);
          if (waiterIndex >= 0) waiters.splice(waiterIndex, 1);
          reject(new Error('等待终端通道消息超时。'));
        }, timeoutMs);
        waiters.push({ predicate, resolve, timer });
      });
    }
  };
}

test('terminal websocket bridge streams snapshots, forwards input/resize, replays buffer on reconnect and rejects bad tickets', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-termws-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const children: FakePty[] = [];
  const spawner: PtySpawner = (() => {
    const child = new FakePty(); children.push(child); return child;
  }) as unknown as PtySpawner;
  const service = new PtyTerminalService(root, spawner);
  const session = await service.create({ profile: 'cmd', cwd: '.', cols: 80, rows: 24 });

  const server = http.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  const port = address.port;
  // 适配器委托到可变量：与 server.ts 的工作区切换重绑定语义一致
  let current: PtyTerminalService = service;
  const bridge = attachTerminalWebSocketServer(server, {
    list: () => current.list(),
    subscribe: listener => current.subscribe(listener),
    write: (id, data) => current.write(id, data),
    resize: (id, cols, rows) => current.resize(id, cols, rows),
    close: id => current.close(id)
  });
  t.after(async () => {
    await bridge.close();
    server.close();
    service.closeAll();
  });

  // 无票据 / 错票据握手必须被拒绝
  const badSocket = new WebSocket(`ws://127.0.0.1:${port}/api/terminal/ws?ticket=not-a-ticket`);
  const badOutcome = await new Promise<string>(resolve => {
    badSocket.on('error', () => resolve('error'));
    badSocket.on('unexpected-response', () => resolve('rejected'));
  });
  assert.notEqual(badOutcome, 'open', '错误票据不应完成握手');

  // 正常握手：先收到带 buffer 的权威快照
  const good = makeClient(`ws://127.0.0.1:${port}/api/terminal/ws?ticket=${encodeURIComponent(createTerminalWebSocketTicket())}`);
  const client = good.client;
  await once(client, 'open');
  const snapshot = await good.next(message => message.type === 'snapshot');
  assert.equal(snapshot.session?.id, session.id);
  assert.equal(snapshot.session?.buffer, '');

  // 上行 input → pty 收到；下行输出 → 客户端收到带最新 buffer 的 data 事件
  client.send(JSON.stringify({ type: 'input', id: session.id, data: 'echo ok\r' }));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(children[0].writes, ['echo ok\r']);
  children[0].emitData('输出内容');
  const dataEvent = await good.next(message => message.type === 'event' && message.event?.kind === 'data');
  assert.equal(dataEvent.event?.data, '输出内容');
  assert.equal(dataEvent.event?.session.buffer, '输出内容');

  // 上行 resize → pty 尺寸生效，并广播 resized 事件
  client.send(JSON.stringify({ type: 'resize', id: session.id, cols: 120, rows: 40 }));
  const resizedEvent = await good.next(message => message.type === 'event' && message.event?.kind === 'resized');
  assert.equal(resizedEvent.event?.session.cols, 120);
  assert.deepEqual(children[0].sizes, [[120, 40]]);

  // 非法消息给中文错误，不破坏连接
  client.send('不是JSON');
  const parseError = await good.next(message => message.type === 'error');
  assert.match(parseError.error || '', /合法 JSON/u);
  client.send(JSON.stringify({ type: 'input', id: 'missing', data: 'x' }));
  const missingError = await good.next(message => message.type === 'error');
  assert.match(missingError.error || '', /不存在/u);

  // 重连：新连接拿到包含历史输出的快照（断线期间状态分叉的自愈来源）
  client.close();
  await once(client, 'close');
  const reconnect = makeClient(`ws://127.0.0.1:${port}/api/terminal/ws?ticket=${encodeURIComponent(createTerminalWebSocketTicket())}`);
  await once(reconnect.client, 'open');
  const replay = await reconnect.next(message => message.type === 'snapshot');
  assert.equal(replay.session?.buffer, '输出内容');

  // 工作区切换语义：resync 后在线客户端改订新实例并收到新实例的权威快照
  const replacement = new PtyTerminalService(root, spawner);
  await replacement.create({ profile: 'cmd', cwd: '.', cols: 80, rows: 24 });
  current = replacement;
  bridge.resync();
  const resyncSnapshot = await reconnect.next(message => message.type === 'snapshot');
  assert.notEqual(resyncSnapshot.session?.id, session.id, 'resync 后应下发新实例的会话快照');
  children[1].emitData('新工作区输出');
  const replacementData = await reconnect.next(message => message.type === 'event' && message.event?.kind === 'data');
  assert.equal(replacementData.event?.data, '新工作区输出');

  reconnect.client.close();
  service.closeAll();
  replacement.closeAll();
  await new Promise(resolve => setTimeout(resolve, 30));
});
