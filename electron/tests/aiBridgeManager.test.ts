import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { spawn } from 'node:child_process';
import { AiBridgeManagerService } from '../electron/aiBridgeManagerService';
import { createExternalAiLaunchPlan, type ExternalAiClientStatus } from '../electron/aiClientIntegrationService';

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
  const manager = new AiBridgeManagerService({ runtimeExecutable: 'electron.exe', cliEntryPath, spawnProcess: fakeSpawn, fetcher });
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
  const stopped = await manager.stop();
  assert.equal(stopped.state, 'stopped');
  assert.throws(() => manager.revealToken(), /尚未运行/u);
});

test('external AI launch plans keep tokens in terminal environment and avoid persistent user configuration', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-client-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const clients: ExternalAiClientStatus[] = [
    { id: 'codex', label: 'Codex CLI', installed: true, executable: 'C:\\Tools\\codex.exe', detail: 'ok' },
    { id: 'claude', label: 'Claude Code', installed: true, executable: 'C:\\Tools\\claude.exe', detail: 'ok' },
    { id: 'gemini', label: 'Gemini CLI', installed: true, executable: 'C:\\Tools\\gemini.cmd', detail: 'ok' },
    { id: 'generic', label: '通用终端', installed: true, executable: '', detail: 'ok' }
  ];
  const base = { clients, workspaceRoot, mcpUrl: 'http://127.0.0.1:17860/api/ai-bridge/mcp', httpUrl: 'http://127.0.0.1:17860/api/ai-bridge', token: 'temporary-secret-token-value' };
  for (const clientId of ['codex', 'claude', 'gemini', 'generic'] as const) {
    const plan = await createExternalAiLaunchPlan({ ...base, clientId });
    assert.equal(plan.env.LINGBUILDER_AI_BRIDGE_TOKEN, base.token);
    assert.equal(plan.command.includes(base.token), false);
  }
  const configDirectory = path.join(workspaceRoot, '.lingbuilder', 'ai-bridge-clients');
  const persisted = `${await fs.readFile(path.join(configDirectory, 'claude.mcp.json'), 'utf8')}\n${await fs.readFile(path.join(configDirectory, 'gemini.settings.json'), 'utf8')}`;
  assert.equal(persisted.includes(base.token), false);
  assert.match(persisted, /LINGBUILDER_AI_BRIDGE_TOKEN/u);
});
