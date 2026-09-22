import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MASKED_DSH_TOOL_ROWS,
  buildAgentProfilePatchYaml,
  createAgentLaunchPlan,
  dshBinCandidates,
  nodeHostCandidates,
  parseNodeVersion,
  resolveDshRuntime,
  satisfiesNodeRequirement
} from '../electron/agentRuntime/agentRuntimeProfile';
import { HarnessSdkClient, lastAssistantText, runHarnessTurn } from '../electron/agentRuntime/harnessSdkClient';

/** 假 dsh 运行器：按换行分隔 JSON-RPC 说 initialize / session/prompt / shutdown。 */
const FAKE_HARNESS = `
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (frame) => process.stdout.write(JSON.stringify(frame) + '\\n');
rl.on('line', (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: 'fake' } } });
    return;
  }
  if (msg.method === 'session/prompt') {
    const sessionId = msg.params.sessionId;
    send({ jsonrpc: '2.0', id: msg.id, result: { messageId: 'msg-1' } });
    send({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'running' } });
    send({ jsonrpc: '2.0', method: 'session.event', params: { sessionId, event: { type: 'tool/call', data: { name: 'mcp__lingbuilder__lingbuilder_edit_propose_1', arguments: '{}' } } } });
    send({ jsonrpc: '2.0', method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '提案已生成，请在面板确认。' }] } } } } });
    send({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } });
    return;
  }
  if (msg.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} });
    process.exit(0);
  }
});
`;

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `lingbuilder-${prefix}-`));
}

function fakeHarnessSpawn(): typeof spawn {
  return ((...args: any[]) => {
    const options = args[2] || {};
    return spawn(process.execPath, ['-e', FAKE_HARNESS], { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) as any;
  }) as any;
}

test('agent profile overlay 只挂 lingbuilder MCP 并整行禁用本地工具', () => {
  const yaml = buildAgentProfilePatchYaml({
    workspaceRoot: 'C:\\work\\demo',
    bridgeCommand: 'C:\\Program Files\\LingBuilder\\LingBuilder.exe',
    bridgeArgs: [
      'C:\\app.asar\\dist\\cli.cjs', 'ai-server', '--workspace', 'C:\\work\\demo',
      '--mcp', '--stdio-only', '--mcp-toolset', 'agent'
    ],
    bridgeCwd: 'C:\\app.asar\\dist',
    bridgeEnv: { ELECTRON_RUN_AS_NODE: '1' }
  });
  assert.match(yaml, /serverName: lingbuilder/u);
  assert.match(yaml, /transport: stdio/u);
  assert.ok(yaml.includes(`'C:\\Program Files\\LingBuilder\\LingBuilder.exe'`), 'Windows 路径必须单引号字面量，避免反斜杠被 YAML 吃掉');
  assert.ok(yaml.includes("'--mcp-toolset'") && yaml.includes("'agent'"), '必须以 agent 工具集启动 Bridge');
  assert.match(yaml, /ELECTRON_RUN_AS_NODE: '1'/u);
  assert.doesNotMatch(yaml, /Bearer|token/iu, 'stdio 通道不得携带任何 Token');
  for (const row of MASKED_DSH_TOOL_ROWS) {
    assert.ok(yaml.includes(`- id: ${row}\n  disabled: true`), `必须整行禁用 ${row}`);
  }
  assert.ok(yaml.includes('tool-fs') && yaml.includes('tool-pwsh') && yaml.includes('tool-bash'));
  assert.equal(MASKED_DSH_TOOL_ROWS.length, 15);
});

test('agent profile overlay 对同一输入完全确定（内容指纹即文件名）', async () => {
  const request = {
    workspaceRoot: 'C:\\work\\demo',
    bridgeCommand: 'node',
    bridgeArgs: ['cli.cjs', 'ai-server', '--workspace', 'C:\\work\\demo', '--mcp', '--stdio-only', '--mcp-toolset', 'agent'],
    bridgeCwd: 'C:\\work\\demo'
  };
  const first = buildAgentProfilePatchYaml(request);
  const second = buildAgentProfilePatchYaml(request);
  assert.equal(first, second);
  const root = await createTempDir('agent-profile');
  const plan = await createAgentLaunchPlan({
    workspaceRoot: request.workspaceRoot,
    cliEntryPath: path.join(root, 'dist', 'cli.cjs'),
    bridgeCommand: 'node',
    resolution: { ok: true, nodePath: process.execPath, nodeVersion: 'v24.0.0', dshBinPath: 'C:\\dsh\\bin.js' },
    profileDirectory: root,
    environment: {}
  });
  assert.equal(plan.ok, true);
  if (!plan.ok || !plan.plan) return;
  assert.deepEqual(plan.plan.args.slice(1), ['--profile', 'sdk', '--patch', plan.plan.patchPath]);
  assert.equal(plan.plan.command, process.execPath);
  const written = await fs.readFile(plan.plan.patchPath, 'utf8');
  assert.ok(written.includes('--mcp-toolset'));
  const again = await createAgentLaunchPlan({
    workspaceRoot: request.workspaceRoot,
    cliEntryPath: path.join(root, 'dist', 'cli.cjs'),
    bridgeCommand: 'node',
    resolution: { ok: true, nodePath: process.execPath, nodeVersion: 'v24.0.0', dshBinPath: 'C:\\dsh\\bin.js' },
    profileDirectory: root,
    environment: {}
  });
  assert.equal(again.ok && again.plan.patchPath, plan.plan.patchPath, '同配置必须复用同一 overlay 文件');
});

test('运行时解析失败必须给中文诊断与可执行修法', async () => {
  const missing = await resolveDshRuntime({
    environment: { PATH: '' },
    resourcesPath: '',
    homeDirectory: '',
    globalNodeModules: ''
  }, async () => '');
  assert.equal(missing.ok, false);
  assert.match(missing.problem || '', /未找到可用的 Node 运行时/u);
  assert.match(missing.problem || '', /LINGBUILDER_DSH_NODE/u);

  const oldNode = await resolveDshRuntime({
    environment: { LINGBUILDER_DSH_NODE: process.execPath, PATH: '' },
    resourcesPath: '', homeDirectory: '', globalNodeModules: ''
  }, async () => 'v20.11.0');
  assert.equal(oldNode.ok, false);
  assert.match(oldNode.problem || '', /版本不满足/u);
  assert.match(oldNode.problem || '', /v20\.11\.0/u, '诊断必须带上实测版本，便于定位是哪一台 Node');

  const noHarnness = await resolveDshRuntime({
    environment: { LINGBUILDER_DSH_NODE: process.execPath, PATH: '' },
    resourcesPath: '', homeDirectory: '', globalNodeModules: ''
  }, async () => process.versions.node ? `v${process.versions.node}` : '');
  assert.equal(noHarnness.ok, false);
  assert.match(noHarnness.problem || '', /未找到 DeepSeek Harness/u);
  assert.match(noHarnness.problem || '', /LINGBUILDER_DSH_BIN/u);
});

test('Node 宿主与 dsh 入口候选顺序：环境变量 → 随包 → 系统', () => {
  const nodeCandidates = nodeHostCandidates({
    environment: { LINGBUILDER_DSH_NODE: 'D:\\tools\\node.exe', PATH: `C:\\nvm${path.delimiter}C:\\x` },
    resourcesPath: 'R:\\resources',
    platform: 'win32'
  });
  assert.equal(nodeCandidates[0], 'D:\\tools\\node.exe');
  assert.equal(nodeCandidates[1], path.join('R:\\resources', 'node', 'node.exe'));
  assert.ok(nodeCandidates.some(item => item.includes('nvm')));

  const dshCandidates = dshBinCandidates({
    environment: { LINGBUILDER_DSH_BIN: 'D:\\dsh\\bin.js' },
    resourcesPath: 'R:\\resources',
    globalNodeModules: 'C:\\npm\\node_modules',
    homeDirectory: 'C:\\Users\\me'
  });
  assert.equal(dshCandidates[0], 'D:\\dsh\\bin.js');
  assert.equal(dshCandidates[1], path.join('R:\\resources', 'dsh', 'bin.js'));
  assert.ok(dshCandidates.some(item => item.includes('npm')));
  assert.ok(dshCandidates.some(item => item.includes('.dsh')));
});

test('Node 版本门槛按 dsh engines 判定（^22.19 || >=24）', () => {
  assert.deepEqual(parseNodeVersion('v22.18.0'), { major: 22, minor: 18, text: 'v22.18.0' });
  assert.equal(satisfiesNodeRequirement({ major: 22, minor: 18 }), false);
  assert.equal(satisfiesNodeRequirement({ major: 22, minor: 19 }), true);
  assert.equal(satisfiesNodeRequirement({ major: 24, minor: 0 }), true);
  assert.equal(satisfiesNodeRequirement({ major: 20, minor: 0 }), false);
  assert.equal(satisfiesNodeRequirement(undefined), false);
  assert.equal(parseNodeVersion('n/a'), undefined);
});

test('SDK 客户端按换行帧驱动 initialize / prompt / 事件流 / shutdown', async () => {
  const client = new HarnessSdkClient({
    command: 'ignored',
    args: [],
    cwd: process.cwd(),
    env: {},
    spawnProcess: fakeHarnessSpawn()
  });
  const info = await client.start();
  assert.equal(info.serverInfo.name, 'deepseek-harness-sdk-runtime');

  const turn = await runHarnessTurn({ client, sessionId: 's-1', prompt: '给按钮加点击计数', timeoutMs: 30_000 });
  assert.equal(turn.events.length, 2, '必须收齐本轮 session.event');
  assert.equal(turn.finalText, '提案已生成，请在面板确认。');
  assert.ok(turn.events.some(event => String((event.data as any)?.name || '').startsWith('mcp__lingbuilder__')));

  const otherSession = await runHarnessTurn({ client, sessionId: 's-2', prompt: '再来一轮', timeoutMs: 30_000 });
  assert.equal(otherSession.finalText, '提案已生成，请在面板确认。');
  await client.close();
  assert.equal(client.running, false);
});

test('SDK 客户端在进程退出时给出带 stderr 的中文错误而不是静默挂起', async () => {
  const client = new HarnessSdkClient({
    command: 'ignored',
    args: [],
    cwd: process.cwd(),
    env: {},
    initializeTimeoutMs: 4_000,
    spawnProcess: (((_command: string, _args: string[], options: any) => {
      const child = spawn(process.execPath, ['-e', 'console.error("plugin tree failed"); process.exit(3);'], { ...options, stdio: ['pipe', 'pipe', 'pipe'] });
      return child;
    }) as any)
  });
  await assert.rejects(() => client.start(), /已退出（退出码 3）/u);
  assert.match(client.processStderrTail, /plugin tree failed/u);
});

test('lastAssistantText 只取正文文本，忽略 reasoning 与工具块', () => {
  assert.equal(lastAssistantText([
    { type: 'assistant/message', data: { message: { content: [{ type: 'reasoning', text: '想' }, { type: 'text', text: '第一段' }] } } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '第二段' }, { type: 'tool-call', name: 'x' }] } } }
  ]), '第二段');
  assert.equal(lastAssistantText([]), '');
});
