import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { spawn } from 'node:child_process';
import { AiBridgeManagerService } from '../electron/aiBridgeManagerService';

test('IDE-managed AI Bridge controls lifecycle, redacts token, and refreshes shared MCP clients', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-bridge-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  const invocations: Array<{ executable: string; args: string[]; options: { env?: NodeJS.ProcessEnv } }> = [];
  const fakeSpawn = ((executable: string, args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    invocations.push({ executable, args, options });
    const child = new EventEmitter() as any;
    child.pid = 4321; child.exitCode = null; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.exitCode = 0; queueMicrotask(() => child.emit('exit', 0)); return true; };
    queueMicrotask(() => child.stdout.write(`LINGBUILDER_AI_BRIDGE_READY ${JSON.stringify({ host: '127.0.0.1', port: 17860, origin: 'http://127.0.0.1:17860' })}\nToken: managed-test-secret-token-value\n`));
    return child;
  }) as typeof spawn;
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response(JSON.stringify({ activeClients: 1, clients: [{ id: 'client-1', connectedAt: '2026-07-26T00:00:00Z', lastActiveAt: '2026-07-26T00:00:01Z', userAgent: 'test-client' }], recentActivity: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const sdkCacheRoot = path.join(workspaceRoot, 'sdk-cache');
  const manager = new AiBridgeManagerService({
    runtimeExecutable: 'electron.exe',
    cliEntryPath,
    spawnProcess: fakeSpawn,
    fetcher,
    environment: { ...process.env, LINGBUILDER_SDK_CACHE_ROOT: sdkCacheRoot }
  });
  manager.setFbroVipKey('developer-owned-fbro-key');
  const started = await manager.start({ workspaceRoot, port: 17860, permission: 'preview', lifecycle: 'workspace', token: 'managed-test-secret-token-value' });
  assert.equal(started.state, 'running');
  assert.equal(started.activeClients, 1);
  assert.equal(manager.revealToken(), 'managed-test-secret-token-value');
  assert.equal(started.logs.some(line => line.includes('managed-test-secret-token-value')), false);
  assert.match(started.mcpUrl, /\/api\/ai-bridge\/mcp$/u);
  assert.deepEqual(invocations[0].args.slice(-2), ['--permission', 'preview']);
  assert.equal(invocations[0].args.includes('managed-test-secret-token-value'), false);
  assert.equal(invocations[0].options.env?.LINGBUILDER_AI_BRIDGE_TOKEN, 'managed-test-secret-token-value');
  assert.equal(invocations[0].options.env?.LINGBUILDER_FBRO_VIP_KEY, 'developer-owned-fbro-key');
  assert.equal(invocations[0].options.env?.LINGBUILDER_SDK_CACHE_ROOT, sdkCacheRoot);
  const stopped = await manager.stop();
  assert.equal(stopped.state, 'stopped');
  assert.throws(() => manager.revealToken(), /尚未运行/u);
});

test('startup failure relays the CLI stderr diagnosis and non-ASCII custom tokens are rejected upfront', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-bridge-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  const failingSpawn = ((() => {
    const child = new EventEmitter() as any;
    child.pid = 4322; child.exitCode = null; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.exitCode = 1; queueMicrotask(() => child.emit('exit', 1)); return true; };
    queueMicrotask(() => {
      child.stderr.write('AI Bridge 监听失败：端口 17860 已被占用，请更换监听端口。\n');
      queueMicrotask(() => child.emit('exit', 1));
    });
    return child;
  }) as unknown) as typeof spawn;
  const manager = new AiBridgeManagerService({
    runtimeExecutable: 'electron.exe', cliEntryPath, spawnProcess: failingSpawn,
    fetcher: (async () => new Response('{}', { status: 500 })) as typeof fetch,
    environment: { ...process.env },
    // 占用者查不到时保持原样失败；显式注入避免测试机真跑 netstat。
    portHolderResolver: async () => null
  });
  await assert.rejects(
    () => manager.start({ workspaceRoot, port: 17860, permission: 'preview', lifecycle: 'workspace' }),
    /端口 17860 已被占用/u
  );

  // 与 aiBridgeStartSettings.normalizeAiBridgeStartSettings 同口径：非 ASCII Token 启动前即拒绝，杜绝「能启动但记不住」。
  await assert.rejects(
    () => manager.start({ workspaceRoot, port: 17861, permission: 'preview', lifecycle: 'workspace', token: '自定义口令-包含中文字符-0123456789ab' }),
    /可见 ASCII/u
  );
});

test('leftover orphan bridge holding the port is taken over and the start is retried once', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-bridge-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  let spawnCount = 0;
  const spawnFactory = ((() => {
    spawnCount += 1;
    const child = new EventEmitter() as any;
    child.pid = 4323 + spawnCount; child.exitCode = null; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    if (spawnCount === 1) {
      // 第一次：端口被残留进程霸占，CLI 打印监听失败并退出。
      child.kill = () => { child.exitCode = 1; queueMicrotask(() => child.emit('exit', 1)); return true; };
      queueMicrotask(() => {
        child.stderr.write('AI Bridge 监听失败：端口 17860 已被占用，请更换监听端口，或关闭占用该端口的程序。\n');
        queueMicrotask(() => child.emit('exit', 1));
      });
    } else {
      child.kill = () => { child.exitCode = 0; queueMicrotask(() => child.emit('exit', 0)); return true; };
      queueMicrotask(() => child.stdout.write(`LINGBUILDER_AI_BRIDGE_READY ${JSON.stringify({ host: '127.0.0.1', port: 17860, origin: 'http://127.0.0.1:17860' })}\n`));
    }
    return child;
  }) as unknown) as typeof spawn;
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith('/health')) return new Response(JSON.stringify({ ok: true }), { status: 200 });
    return new Response(JSON.stringify({ activeClients: 0, clients: [], recentActivity: [] }), { status: 200 });
  }) as typeof fetch;
  const killedPids: number[] = [];
  // 残留进程：自家 Bridge 的命令行形态，宿主 IDE 已死（孤儿），再次查询时端口已释放。
  const holder = {
    pid: 5123,
    name: 'LingBuilder.exe',
    commandLine: `"T:\\apps\\LingBuilder\\LingBuilder.exe" "${cliEntryPath}" ai-server --workspace C:\\old --host 127.0.0.1 --port 17860`,
    parentProcessId: 998877
  };
  const manager = new AiBridgeManagerService({
    runtimeExecutable: 'T:\\apps\\LingBuilder\\LingBuilder.exe',
    cliEntryPath,
    spawnProcess: spawnFactory,
    fetcher,
    environment: { ...process.env },
    portHolderResolver: async () => (killedPids.length ? null : holder),
    processTerminator: async pid => { killedPids.push(pid); },
    processLivenessChecker: async () => false
  });
  const started = await manager.start({ workspaceRoot, port: 17860, permission: 'preview', lifecycle: 'workspace', token: 'managed-test-secret-token-value' });
  assert.equal(started.state, 'running');
  assert.deepEqual(killedPids, [5123]);
  assert.equal(spawnCount, 2);
  assert.equal(started.logs.some(line => line.includes('已结束并接管端口 17860')), true);
  assert.equal(started.logs.some(line => line.includes('managed-test-secret-token-value')), false);
});

test('a bridge whose host is still alive is reported with its pid instead of being killed', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-bridge-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  const failingSpawn = ((() => {
    const child = new EventEmitter() as any;
    child.pid = 4325; child.exitCode = null; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.exitCode = 1; queueMicrotask(() => child.emit('exit', 1)); return true; };
    queueMicrotask(() => {
      child.stderr.write('AI Bridge 监听失败：端口 17860 已被占用，请更换监听端口。\n');
      queueMicrotask(() => child.emit('exit', 1));
    });
    return child;
  }) as unknown) as typeof spawn;
  const killedPids: number[] = [];
  const manager = new AiBridgeManagerService({
    runtimeExecutable: 'T:\\apps\\LingBuilder\\LingBuilder.exe',
    cliEntryPath,
    spawnProcess: failingSpawn,
    fetcher: (async () => new Response('{}', { status: 500 })) as typeof fetch,
    environment: { ...process.env },
    portHolderResolver: async () => ({
      pid: 5124,
      name: 'LingBuilder.exe',
      commandLine: `"T:\\apps\\LingBuilder\\LingBuilder.exe" "${cliEntryPath}" ai-server --workspace C:\\other --port 17860`,
      parentProcessId: 998878
    }),
    processTerminator: async pid => { killedPids.push(pid); },
    processLivenessChecker: async () => true
  });
  await assert.rejects(
    () => manager.start({ workspaceRoot, port: 17860, permission: 'preview', lifecycle: 'workspace' }),
    error => {
      assert.match(error instanceof Error ? error.message : String(error), /PID 5124/u);
      assert.match(error instanceof Error ? error.message : String(error), /宿主程序仍在运行/u);
      return true;
    }
  );
  assert.deepEqual(killedPids, []);
});

test('a foreign process holding the port is named in the error and never killed', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-managed-bridge-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  const failingSpawn = ((() => {
    const child = new EventEmitter() as any;
    child.pid = 4326; child.exitCode = null; child.stdout = new PassThrough(); child.stderr = new PassThrough();
    child.kill = () => { child.exitCode = 1; queueMicrotask(() => child.emit('exit', 1)); return true; };
    queueMicrotask(() => {
      child.stderr.write('AI Bridge 监听失败：端口 17860 已被占用，请更换监听端口。\n');
      queueMicrotask(() => child.emit('exit', 1));
    });
    return child;
  }) as unknown) as typeof spawn;
  const killedPids: number[] = [];
  const manager = new AiBridgeManagerService({
    runtimeExecutable: 'T:\\apps\\LingBuilder\\LingBuilder.exe',
    cliEntryPath,
    spawnProcess: failingSpawn,
    fetcher: (async () => new Response('{}', { status: 500 })) as typeof fetch,
    environment: { ...process.env },
    portHolderResolver: async () => ({
      pid: 6078,
      name: 'other-app.exe',
      commandLine: '"C:\\Tools\\other-app.exe" --listen 17860',
      parentProcessId: 0
    }),
    processTerminator: async pid => { killedPids.push(pid); },
    processLivenessChecker: async () => false
  });
  await assert.rejects(
    () => manager.start({ workspaceRoot, port: 17860, permission: 'preview', lifecycle: 'workspace' }),
    error => {
      const message = error instanceof Error ? error.message : String(error);
      assert.match(message, /other-app\.exe/u);
      assert.match(message, /PID 6078/u);
      return true;
    }
  );
  assert.deepEqual(killedPids, []);
});
