import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
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
  emitExit(exitCode: number) { this.exitListeners.forEach(listener => listener({ exitCode })); }
}

test('PTY service supports multiple sessions, input, resize, buffered recovery, exit and close', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-pty-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const children: FakePty[] = []; const options: any[] = [];
  const spawner: PtySpawner = (_file, _args, value) => { options.push(value); const child = new FakePty(); children.push(child); return child; };
  const service = new PtyTerminalService(root, spawner); const events: string[] = []; service.subscribe(event => events.push(event.kind));
  const first = await service.create({ profile: 'cmd', cwd: '.', cols: 100, rows: 30, env: { DEMO: '中文' }, title: 'Claude Code + LingBuilder' });
  const second = await service.create({ profile: 'powershell' });
  assert.equal(service.list().length, 2); assert.equal(options[0].cwd, await fs.realpath(root)); assert.equal(options[0].env.DEMO, '中文');
  service.write(first.id, 'echo ok\r'); service.resize(first.id, 120, 40); children[0].emitData('输出内容');
  assert.deepEqual(children[0].writes, ['echo ok\r']); assert.deepEqual(children[0].sizes, [[120, 40]]);
  assert.equal(service.get(first.id)?.buffer, '输出内容'); assert.equal(service.get(first.id)?.sequence, 2);
  assert.equal(service.get(first.id)?.title, 'Claude Code + LingBuilder');
  children[0].emitExit(7); assert.equal(service.get(first.id)?.status, 'exited'); assert.equal(service.get(first.id)?.exitCode, 7);
  assert.throws(() => service.write(first.id, 'late'), /已经退出/u);
  assert.equal(service.close(first.id), true); assert.equal(service.close(first.id), false);
  service.closeAll(); assert.equal(children[1].killed, true); assert.equal(service.list().length, 0);
  assert.ok(events.includes('created') && events.includes('data') && events.includes('resized') && events.includes('exited') && events.includes('closed'));
  assert.equal(second.status, 'running');
});

test('PTY service rejects cwd escape and invalid environment or input', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-pty-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const child = new FakePty(); const service = new PtyTerminalService(root, () => child);
  await assert.rejects(service.create({ cwd: '..' }), /不能超出/u);
  await assert.rejects(service.create({ env: { 'BAD-NAME': 'x' } }), /环境变量/u);
  await assert.rejects(service.create({ title: 'bad\ntitle' }), /终端标题/u);
  const session = await service.create(); assert.throws(() => service.write(session.id, ''), /1 至 65536/u);
  service.closeAll();
});

test('real PTY runs an interactive command in an isolated smoke process', { timeout: 12_000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-conpty-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', 'scripts/pty-smoke.ts', root], {
    cwd: path.resolve(import.meta.dirname, '..'), timeout: 10_000, windowsHide: true
  });
  assert.match(result.stdout, /LINGBUILDER_PTY_SMOKE_OK/u);
});
