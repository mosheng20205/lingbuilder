import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';

import {
  createManagedProcessService,
  type ManagedProcessDiagnostic,
  type ManagedProcessSignal
} from '../src/services/tasks/managedProcessService';

const KEEP_ALIVE_SCRIPT = `
process.stdout.write('ready\\n');
setInterval(() => undefined, 1_000);
`;

test('managed process start forwards output, writes a merged log, and reports status', { timeout: 10_000 }, async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-process-'));
  const logFilePath = path.join(workspace, 'logs', 'run.log');
  const diagnostics: ManagedProcessDiagnostic[] = [];
  const service = createManagedProcessService({ onDiagnostic: diagnostic => diagnostics.push(diagnostic) });
  const output = new PassThrough();
  const outputText = collectStream(output);
  t.after(async () => {
    await service.stopAll();
    output.destroy();
  });

  const ready = waitForCollectedText(outputText, 'managed-ready');
  const result = await service.start('demo-project', process.execPath, {
    args: ['-e', `
      process.stdout.write('managed-ready:' + process.env.LINGBUILDER_PROCESS_TEST + ':' + process.cwd() + '\\n');
      process.stderr.write('managed-error-line\\n');
      setInterval(() => undefined, 1_000);
    `],
    cwd: workspace,
    env: { ...process.env, LINGBUILDER_PROCESS_TEST: '环境已传递' },
    windowsHide: true,
    detached: false,
    stdout: output,
    logFilePath
  });
  await ready;

  assert.ok(result.pid > 0);
  assert.equal(result.replaced, false);
  assert.equal(result.status.cwd, workspace);
  assert.equal(service.getStatus('demo-project')?.pid, result.pid);
  assert.equal(service.getStatus('demo-project')?.state, 'running');
  assert.match(outputText.value, /managed-ready:环境已传递:/);
  assert.match(outputText.value, new RegExp(escapeRegExp(workspace), 'i'));

  const stopped = await service.stop('demo-project');
  assert.equal(stopped.found, true);
  assert.equal(stopped.stopped, true);
  assert.equal(stopped.forced, false);
  assert.equal(service.getStatus('demo-project'), null);

  const log = await fs.readFile(logFilePath, 'utf8');
  assert.match(log, /managed-ready/);
  assert.match(log, /managed-error-line/);
  assert.ok(diagnostics.some(item => item.message.includes('已启动')));
  assert.ok(diagnostics.some(item => item.message.includes('已停止')));
});

test('starting the same project replaces only its managed child and never kills an unrelated process', { timeout: 10_000 }, async t => {
  const service = createManagedProcessService({
    gracefulStopTimeoutMs: 500,
    forceStopTimeoutMs: 500
  });
  const unrelated = spawnReadyNodeProcess();
  t.after(async () => {
    await service.stopAll();
    await killChild(unrelated);
  });
  await waitForChildText(unrelated, 'ready');
  const unrelatedPid = requirePid(unrelated);

  const first = await service.start('replace-project', process.execPath, {
    args: ['-e', KEEP_ALIVE_SCRIPT],
    windowsHide: true
  });
  const second = await service.start('replace-project', process.execPath, {
    args: ['-e', KEEP_ALIVE_SCRIPT],
    windowsHide: true
  });

  assert.equal(second.replaced, true);
  assert.notEqual(second.pid, first.pid);
  await waitForPidDead(first.pid);
  assert.equal(isPidAlive(second.pid), true);
  assert.equal(isPidAlive(unrelatedPid), true);
  assert.equal(service.getAllStatuses().length, 1);

  const allStopped = await service.stopAll();
  assert.equal(allStopped.total, 1);
  assert.equal(allStopped.stopped, 1);
  await waitForPidDead(second.pid);
  assert.equal(isPidAlive(unrelatedPid), true, 'stopAll 不应终止未登记的无关进程');
});

test('register takes ownership of an existing child and stopAll stops every registered project', { timeout: 10_000 }, async t => {
  const service = createManagedProcessService();
  const registered = spawnReadyNodeProcess();
  t.after(async () => {
    await service.stopAll();
    await killChild(registered);
  });
  await waitForChildText(registered, 'ready');

  const registeredResult = await service.register('registered-project', registered, {
    command: process.execPath,
    args: ['-e', KEEP_ALIVE_SCRIPT]
  });
  const startedResult = await service.start('started-project', process.execPath, {
    args: ['-e', KEEP_ALIVE_SCRIPT],
    windowsHide: true
  });

  assert.equal(registeredResult.pid, requirePid(registered));
  assert.deepEqual(
    service.getAllStatuses().map(status => status.projectId).sort(),
    ['registered-project', 'started-project']
  );

  const result = await service.stopAll();
  assert.equal(result.total, 2);
  assert.equal(result.stopped, 2);
  assert.equal(service.getAllStatuses().length, 0);
  await waitForPidDead(registeredResult.pid);
  await waitForPidDead(startedResult.pid);

  const missing = await service.stop('missing-project');
  assert.equal(missing.found, false);
  assert.match(missing.message, /没有受控运行进程/);
});

test('stop sends a graceful signal first and force-kills the same child after timeout', { timeout: 10_000 }, async t => {
  const sentSignals: ManagedProcessSignal[] = [];
  const diagnostics: ManagedProcessDiagnostic[] = [];
  const service = createManagedProcessService({
    gracefulStopTimeoutMs: 30,
    forceStopTimeoutMs: 1_000,
    onDiagnostic: diagnostic => diagnostics.push(diagnostic),
    sendSignal: (child, signal) => {
      sentSignals.push(signal);
      // 跨平台地模拟“SIGTERM 已发送但进程未退出”，随后仍用真实句柄执行 SIGKILL。
      return signal === 'SIGTERM' ? true : child.kill(signal);
    }
  });
  t.after(async () => {
    await service.stopAll();
  });

  const started = await service.start('force-project', process.execPath, {
    args: ['-e', KEEP_ALIVE_SCRIPT],
    windowsHide: true
  });
  const result = await service.stop('force-project');

  assert.equal(result.stopped, true);
  assert.equal(result.forced, true);
  assert.deepEqual(sentSignals, ['SIGTERM', 'SIGKILL']);
  await waitForPidDead(started.pid);
  assert.ok(diagnostics.some(item => item.message.includes('正在强制终止')));
  assert.ok(diagnostics.some(item => item.message.includes('已强制终止')));
});

test('stop and replacement return only after child close and owned log flush complete', { timeout: 20_000 }, async t => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-settlement-'));
  const triggersByPid = new Map<number, string>();
  const service = createManagedProcessService({
    gracefulStopTimeoutMs: 5_000,
    forceStopTimeoutMs: 2_000,
    sendSignal: (child, signal) => {
      const trigger = child.pid === undefined ? undefined : triggersByPid.get(child.pid);
      if (signal === 'SIGTERM' && trigger) {
        fsSync.writeFileSync(trigger, '停止', 'utf8');
        return true;
      }
      return child.kill(signal);
    }
  });
  t.after(async () => {
    await service.stopAll();
  });

  const direct = await startFlushOnStopProcess(service, workspace, 'direct-stop');
  triggersByPid.set(direct.pid, direct.triggerFilePath);
  const directStopped = await service.stop('direct-stop');
  assert.equal(directStopped.stopped, true);
  const directLog = await fs.readFile(direct.logFilePath, 'utf8');
  assert.ok(directLog.endsWith('direct-stop:flush-complete\n'));
  assert.ok(Buffer.byteLength(directLog, 'utf8') > 2_000_000);

  const replaced = await startFlushOnStopProcess(service, workspace, 'replace-and-flush');
  triggersByPid.set(replaced.pid, replaced.triggerFilePath);
  const replacement = await service.start('replace-and-flush', process.execPath, {
    args: ['-e', KEEP_ALIVE_SCRIPT],
    windowsHide: true
  });
  assert.equal(replacement.replaced, true);
  const replacedLog = await fs.readFile(replaced.logFilePath, 'utf8');
  assert.ok(replacedLog.endsWith('replace-and-flush:flush-complete\n'));
  assert.ok(Buffer.byteLength(replacedLog, 'utf8') > 2_000_000);
});

function spawnReadyNodeProcess(): ChildProcess {
  return spawn(process.execPath, ['-e', KEEP_ALIVE_SCRIPT], {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'ignore']
  });
}

function collectStream(stream: PassThrough): { value: string } {
  const collected = { value: '' };
  stream.setEncoding('utf8');
  stream.on('data', chunk => {
    collected.value += String(chunk);
  });
  return collected;
}

async function waitForCollectedText(
  collected: { value: string },
  expected: string,
  timeoutMs = 2_000
): Promise<void> {
  await waitForCondition(
    () => collected.value.includes(expected),
    `等待输出“${expected}”超时`,
    timeoutMs
  );
}

async function waitForChildText(child: ChildProcess, expected: string): Promise<void> {
  const stdout = child.stdout;
  assert.ok(stdout, '测试子进程必须提供 stdout');
  let output = '';
  stdout.setEncoding('utf8');
  stdout.on('data', chunk => {
    output += String(chunk);
  });
  await waitForCondition(() => output.includes(expected), `等待子进程输出“${expected}”超时`);
}

async function waitForPidDead(pid: number): Promise<void> {
  await waitForCondition(() => !isPidAlive(pid), `PID ${pid} 未按预期退出`);
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function requirePid(child: ChildProcess): number {
  assert.notEqual(child.pid, undefined, '测试子进程必须具有 PID');
  return child.pid as number;
}

async function killChild(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exit = once(child, 'exit');
  child.kill('SIGKILL');
  await Promise.race([exit, delay(2_000)]);
}

async function startFlushOnStopProcess(
  service: ReturnType<typeof createManagedProcessService>,
  workspace: string,
  projectId: string
): Promise<{ pid: number; triggerFilePath: string; logFilePath: string }> {
  const triggerFilePath = path.join(workspace, `${projectId}.stop`);
  const logFilePath = path.join(workspace, `${projectId}.log`);
  const output = new PassThrough();
  const collected = collectStream(output);
  const ready = waitForCollectedText(collected, `${projectId}:ready`, 5_000);
  const started = await service.start(projectId, process.execPath, {
    args: ['-e', `
      const fs = require('node:fs');
      const trigger = ${JSON.stringify(triggerFilePath)};
      const projectId = ${JSON.stringify(projectId)};
      process.stdout.write(projectId + ':ready\\n');
      const timer = setInterval(() => {
        if (!fs.existsSync(trigger)) return;
        clearInterval(timer);
        const payload = '日志稳定性验证'.repeat(180000);
        process.stdout.write(payload + '\\n' + projectId + ':flush-complete\\n', () => process.exit(0));
      }, 5);
    `],
    windowsHide: true,
    stdout: output,
    logFilePath
  });
  await ready;
  output.destroy();
  return { pid: started.pid, triggerFilePath, logFilePath };
}

async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeoutMessage: string,
  timeoutMs = 2_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() >= deadline) {
      throw new Error(timeoutMessage);
    }
    await delay(20);
  }
}

async function delay(timeoutMs: number): Promise<void> {
  await new Promise<void>(resolve => setTimeout(resolve, timeoutMs));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
