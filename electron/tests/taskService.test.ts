import assert from 'node:assert/strict';
import test from 'node:test';
import { TaskCancelledError, TaskService } from '../src/services/tasks/taskService';

test('task service queues the same group, streams progress/logs, and preserves order', async () => {
  const service = new TaskService();
  const events: string[] = [];
  service.subscribe(task => events.push(`${task.title}:${task.state}:${task.progress}`));
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const first = service.enqueue({ type: 'build', title: '第一项', group: 'project:a', run: async context => { context.report(35, '正在生成'); await gate; return 1; } });
  const second = service.enqueue({ type: 'build', title: '第二项', group: 'project:a', run: async context => { context.log('编译完成'); return 2; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(service.get(first.id)?.state, 'running');
  assert.equal(service.get(second.id)?.state, 'queued');
  assert.equal(service.get(first.id)?.progress, 35);
  release();
  assert.equal(await first.result, 1);
  assert.equal(await second.result, 2);
  assert.equal(service.get(second.id)?.state, 'succeeded');
  assert.ok(events.some(event => event === '第一项:running:35'));
});

test('task service cancels queued and running work without starting cancelled queue entries', async () => {
  const service = new TaskService();
  let queuedStarted = false;
  const running = service.enqueue({ type: 'build', title: '运行中', group: 'same', run: async context => {
    await new Promise<void>((_resolve, reject) => context.signal.addEventListener('abort', () => reject(context.signal.reason), { once: true }));
  } });
  const queued = service.enqueue({ type: 'build', title: '排队中', group: 'same', run: async () => { queuedStarted = true; } });
  assert.equal(queued.cancel('不再需要'), true);
  assert.equal(running.cancel('停止编译'), true);
  await assert.rejects(queued.result, TaskCancelledError);
  await assert.rejects(running.result, TaskCancelledError);
  assert.equal(queuedStarted, false);
  assert.equal(service.get(running.id)?.state, 'cancelled');
});

test('task service isolates groups, reports failures, enforces monotonic progress, and bounds logs', async () => {
  const service = new TaskService();
  const first = service.enqueue({ type: 'index', title: '索引', group: 'a', run: async context => { context.report(80); context.report(20); for (let i = 0; i < 510; i++) context.log(String(i)); return 'ok'; } });
  const failed = service.enqueue({ type: 'check', title: '检查', group: 'b', run: async () => { throw new Error('工具缺失'); } });
  assert.equal(await first.result, 'ok');
  await assert.rejects(failed.result, /工具缺失/u);
  assert.equal(service.get(first.id)?.progress, 100);
  assert.equal(service.get(first.id)?.logs.length, 500);
  assert.equal(service.get(failed.id)?.state, 'failed');
});
