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
  satisfiesNodeRequirement,
  writeAgentProfilePatch
} from '../electron/agentRuntime/agentRuntimeProfile';
import { AgentRuntimeService } from '../electron/agentRuntime/agentRuntimeService';
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

/** 可变形假运行器：boot 在启动期执行一次；turn 行为决定一轮怎么收场。 */
function harnessScript(options: { boot?: string; turn?: 'full' | 'idle-only' | 'silent' | 'crash' } = {}): string {
  const turn = options.turn === 'full'
    ? `send({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'running' } });
       send({ jsonrpc: '2.0', method: 'session.event', params: { sessionId, event: { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '完成' }] } } } } });
       send({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } });`
    : options.turn === 'idle-only'
      ? `send({ jsonrpc: '2.0', method: 'session.status', params: { sessionId, status: 'idle' } });`
      : options.turn === 'crash'
        ? `setTimeout(() => process.exit(2), 20);`
        : '';
  return `
const readline = require('node:readline');
const rl = readline.createInterface({ input: process.stdin });
const send = (frame) => process.stdout.write(JSON.stringify(frame) + '\\n');
${options.boot || ''}
rl.on('line', (line) => {
  let msg; try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { serverInfo: { name: 'deepseek-harness-sdk-runtime', version: 'fake' } } });
    return;
  }
  if (msg.method === 'session/prompt') {
    const sessionId = msg.params.sessionId;
    send({ jsonrpc: '2.0', id: msg.id, result: { messageId: 'msg-1' } });
    ${turn}
    return;
  }
  if (msg.method === 'shutdown') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} });
    process.exit(0);
  }
});
`;
}

function delayed(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** 服务失败路径的 close 是 fire-and-forget：目录清理要容忍子进程尚未完全退出的 EBUSY。 */
async function removeTempDir(target: string): Promise<void> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await fs.rm(target, { recursive: true, force: true }).catch(() => undefined);
    try {
      await fs.access(target);
    } catch {
      return;
    }
    await delayed(500);
  }
}

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), `lingbuilder-${prefix}-`));
}

function fakeHarnessSpawn(script: string = FAKE_HARNESS): typeof spawn {
  return ((...args: any[]) => {
    const options = args[2] || {};
    return spawn(process.execPath, ['-e', script], { ...options, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) as any;
  }) as any;
}

/**
 * 服务级测试脚手架：LINGBUILDER_DSH_NODE/BIN 指向真实存在且可探测的候选，
 * spawnProcess 把 `--version` 探测与真正的运行器分开应答。
 */
async function createTestService(options: { boot?: string; turn?: 'full' | 'idle-only' | 'silent' | 'crash'; turnTimeoutMs?: number; extraEnv?: Record<string, string> } = {}): Promise<{ service: AgentRuntimeService; root: string }> {
  const root = await createTempDir('agent-service');
  const dshBin = path.join(root, 'dsh-bin.js');
  await fs.writeFile(dshBin, '// fake dsh entry\n', 'utf8');
  const script = harnessScript(options);
  const spawnProcess = ((_command: string, args: string[], spawnOptions: any) => {
    if (Array.isArray(args) && args[0] === '--version') {
      return spawn(process.execPath, ['-e', 'console.log("v24.20.0")'], { ...spawnOptions, windowsHide: true });
    }
    return spawn(process.execPath, ['-e', script], { ...spawnOptions, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
  }) as typeof spawn;
  const service = new AgentRuntimeService({
    bridgeCommand: process.execPath,
    cliEntryPath: path.join(root, 'dist', 'cli.cjs'),
    profileDirectory: path.join(root, 'profiles'),
    // 在真实 env 上只覆盖解析变量：dsh 子进程的 env 必须带 SystemRoot/PATH 等
    // Windows 必需项（生产环境注入的就是完整 process.env），否则 spawn 直接 ENOENT。
    environment: { ...process.env, LINGBUILDER_DSH_NODE: process.execPath, LINGBUILDER_DSH_BIN: dshBin, ...(options.extraEnv || {}) },
    resourcesPath: '',
    homeDirectory: '',
    globalNodeModules: '',
    spawnProcess,
    turnTimeoutMs: options.turnTimeoutMs
  });
  return { service, root };
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

test('IDE 版本经环境变量写进 overlay env 块，MCP 宿主据此回报版本（2026-09-23）', async () => {
  const { service, root } = await createTestService({ turn: 'full', extraEnv: { LINGBUILDER_IDE_VERSION: '9.9.9-test' } });
  try {
    await service.start({ workspaceRoot: root });
    const profiles = await fs.readdir(path.join(root, 'profiles'));
    const overlay = await fs.readFile(path.join(root, 'profiles', profiles.find(name => name.endsWith('.cordis.yml')) || ''), 'utf8');
    assert.match(overlay, /LINGBUILDER_IDE_VERSION: '9\.9\.9-test'/u, 'overlay env 必须携带 IDE 版本，供 MCP 宿主的 health / workspace.list / serverInfo 消费');
    assert.doesNotMatch(overlay, /apiKey|sk-/u, 'env 块仍不得夹带密钥');
  } finally {
    await service.stop().catch(() => undefined);
    await removeTempDir(root);
  }
});

test('LINGBUILDER_IDE_VERSION 常量在两棵编译树逐字一致（rootDir 边界只允许镜像+测试把关）', async () => {
  const { fileURLToPath } = await import('node:url');
  const bridgeSource = await fs.readFile(fileURLToPath(new URL('../src/services/aiBridge/ideVersion.ts', import.meta.url)), 'utf8');
  const runtimeSource = await fs.readFile(fileURLToPath(new URL('../electron/agentRuntime/agentRuntimeService.ts', import.meta.url)), 'utf8');
  assert.match(bridgeSource, /'LINGBUILDER_IDE_VERSION'/u, 'bridge 侧必须定义 IDE_VERSION_ENV');
  assert.match(runtimeSource, /'LINGBUILDER_IDE_VERSION'/u, 'agentRuntime 侧必须镜像同名环境变量');
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
  assert.equal(dshCandidates[2], path.join('R:\\resources', 'dsh', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    '随包 npm 安装形态（prepare-agent-runtime 产出的目录结构）必须在候选里');
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

test('随包 Agent 运行时：打包链携带 node/dsh 并裁剪无关体积包', async () => {
  const electronRoot = path.resolve(import.meta.dirname, '..');
  const pkg = JSON.parse(await fs.readFile(path.join(electronRoot, 'package.json'), 'utf8')) as {
    scripts: Record<string, string>;
    build?: { extraResources?: Array<{ from: string; to: string }> };
  };
  const extra = pkg.build?.extraResources ?? [];
  const resource = (from: string) => extra.find(entry => entry.from === from);
  // electron-builder 会硬编码排除复制源根下的 node_modules（app-builder-lib util/filter.js createFilter），
  // dsh 的依赖树经 node/dsh 两条目录映射必被清空，必须用整目录映射 agent-runtime → resources 根携带。
  // 解析器只认 resources/node 与 resources/dsh，产物布局须保持 node/ dsh/ agent-runtime.json 三项。
  const runtime = resource('agent-runtime');
  assert.ok(runtime, 'extraResources 缺少 agent-runtime 整目录映射');
  assert.equal(runtime?.to, '.');
  for (const script of ['package:win', 'package:dir']) {
    assert.match(pkg.scripts[script] ?? '', /prepare:agent-runtime/u);
    assert.match(pkg.scripts[script] ?? '', /verify:agent-runtime:unpacked/u);
  }

  const prepareSource = await fs.readFile(path.join(electronRoot, 'scripts', 'prepare-agent-runtime.cjs'), 'utf8');
  // dsh 树里唯一撑体积的是 LibreOffice 原生包（≈325MB），内嵌场景永不使用，必须裁剪。
  assert.match(prepareSource, /libreoffice-kit-win32-x64/u);
  // 随包是默认形态，且下载失败只能降级为占位目录，不得把内嵌 Agent 变成出包的硬依赖。
  assert.match(prepareSource, /LINGBUILDER_AGENT_RUNTIME_BUNDLE !== '0'/u);
  assert.match(prepareSource, /writeStubManifest\(problem\)/u);

  const verifySource = await fs.readFile(path.join(electronRoot, 'scripts', 'verify-agent-runtime-package.cjs'), 'utf8');
  assert.match(verifySource, /--version/u);
});

// ---------- 面板 Provider 配置（第 4 条） ----------

const fakeSafeStorage = (available = true) => ({
  isEncryptionAvailable: () => available,
  encryptString: (value: string) => Buffer.from(`enc:${value}`, 'utf8'),
  decryptString: (buffer: Buffer) => buffer.toString('utf8').replace(/^enc:/u, '')
});

test('provider 配置校验：非法地址、非 ASCII 密钥与缺 Base URL 都给中文修法', async () => {
  const { normalizeAgentProviderSettings } = await import('../electron/agentRuntime/agentProviderSettings');
  assert.match(normalizeAgentProviderSettings({ kind: 'custom-openai', baseUrl: '' }).problem || '', /必须填写 Base URL/u);
  assert.match(normalizeAgentProviderSettings({ kind: 'deepseek-official', baseUrl: 'ftp://x' }).problem || '', /http\/https/u);
  assert.match(normalizeAgentProviderSettings({ kind: 'deepseek-official', apiKey: '短' }).problem || '', /可见 ASCII/u);
  assert.match(normalizeAgentProviderSettings({ kind: '不存在', apiKey: '' }).problem || '', /未知的模型通道/u);
  const ok = normalizeAgentProviderSettings({ kind: 'custom-openai', baseUrl: 'https://gw.example/v1', model: 'm1', apiKey: 'sk-abcdef123456' });
  assert.equal(ok.settings?.kind, 'custom-openai');
});

test('provider overlay 写端点与模型名，密钥绝不进 overlay 文件', async () => {
  const { buildAgentProfilePatchYaml } = await import('../electron/agentRuntime/agentRuntimeProfile');
  const base = {
    workspaceRoot: 'W:\ws', bridgeCommand: 'C:\node.exe', bridgeArgs: ['cli.cjs'],
    bridgeCwd: 'W:\electron', bridgeEnv: { ELECTRON_RUN_AS_NODE: '1' }
  };
  const official = buildAgentProfilePatchYaml({
    ...base,
    providerSettings: { kind: 'deepseek-official', apiKey: 'sk-secret-official', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', protocol: 'chat-completions' }
  });
  assert.match(official, /- id: llm-deepseek/u);
  assert.match(official, /apiKeyEnv: DEEPSEEK_API_KEY/u);
  assert.match(official, /baseURL: 'https:\/\/api\.deepseek\.com'/u);
  assert.match(official, /protocol: chat-completions/u);
  assert.match(official, /- id: 'deepseek-v4-flash'/u);
  assert.doesNotMatch(official, /sk-secret-official/u, 'overlay 落在 userData，绝不能含密钥');

  const custom = buildAgentProfilePatchYaml({
    ...base,
    providerSettings: { kind: 'custom-openai', apiKey: 'sk-secret-custom', baseUrl: 'https://gw.example/v1', model: 'acme-1', protocol: 'messages' }
  });
  assert.match(custom, /- id: llm-pi-ai/u);
  assert.match(custom, /lingbuilder-custom:/u);
  assert.match(custom, /api: openai-completions/u);
  assert.match(custom, /apiKeyEnv: LINGBUILDER_AGENT_API_KEY/u);
  assert.match(custom, /- id: 'acme-1'/u);
  assert.doesNotMatch(custom, /sk-secret-custom/u);

  // 未配置（沿用本机 dsh 凭据）时不得凭空插入 provider 行，保持 overlay 与旧形态一致。
  const untouched = buildAgentProfilePatchYaml(base);
  assert.doesNotMatch(untouched, /llm-deepseek|llm-pi-ai/u);
});

test('启动计划把密钥只注入子进程环境，provider/model 缺省按通道推导', async () => {
  const { createAgentLaunchPlan } = await import('../electron/agentRuntime/agentRuntimeProfile');
  const { agentProviderRuntimeName, agentProviderRuntimeModel, agentProviderEnvironment } = await import('../electron/agentRuntime/agentProviderSettings');
  const profileDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-agent-provider-'));
  const plan = await createAgentLaunchPlan({
    workspaceRoot: 'W:\ws',
    cliEntryPath: 'W:\electron\dist\cli.cjs',
    bridgeCommand: 'C:\node.exe',
    bridgeEnv: { ELECTRON_RUN_AS_NODE: '1' },
    resolution: { ok: true, nodePath: 'C:\node.exe', nodeVersion: 'v24.0.0', dshBinPath: 'C:\dsh\bin.js' },
    profileDirectory,
    environment: { PATH: '' },
    providerSettings: { kind: 'custom-openai', apiKey: 'sk-plan-secret', baseUrl: 'https://gw.example/v1', model: 'acme-1', protocol: 'messages' }
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.plan?.env.LINGBUILDER_AGENT_API_KEY, 'sk-plan-secret');
  const written = await fs.readFile(plan.plan!.patchPath, 'utf8');
  assert.doesNotMatch(written, /sk-plan-secret/u, '落盘 overlay 不得含密钥');
  assert.equal(agentProviderRuntimeName({ kind: 'custom-openai', apiKey: '', baseUrl: '', model: '', protocol: 'messages' }), 'lingbuilder-custom');
  assert.equal(agentProviderRuntimeModel(undefined), 'deepseek-v4-flash');
  assert.deepEqual(agentProviderEnvironment({ kind: 'deepseek-official', apiKey: '', baseUrl: '', model: '', protocol: 'messages' }), {});
  await fs.rm(profileDirectory, { recursive: true, force: true });
});

test('provider 配置读写往返：密钥走 safeStorage，不可用时不落明文并如实报告', async () => {
  const module = await import('../electron/agentRuntime/agentProviderSettings');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-agent-settings-'));
  const file = path.join(directory, 'agent-provider.json');
  const written = await module.writeAgentProviderSettings(file, {
    kind: 'custom-openai', apiKey: 'sk-roundtrip-123', baseUrl: 'https://gw.example/v1', model: 'm1', protocol: 'messages'
  }, fakeSafeStorage());
  assert.equal(written.ok, true);
  assert.equal(written.problem, undefined);
  const onDisk = await fs.readFile(file, 'utf8');
  assert.doesNotMatch(onDisk, /sk-roundtrip-123/u, '磁盘上不得出现明文密钥');
  const loaded = await module.readAgentProviderSettings(file, fakeSafeStorage());
  assert.equal(loaded.settings.apiKey, 'sk-roundtrip-123');
  assert.equal(loaded.settings.baseUrl, 'https://gw.example/v1');

  // 钥匙串不可用：保存其余字段并给出中文说明；读回时标记 keyUnavailable 而不是退回明文。
  const degraded = await module.writeAgentProviderSettings(file, {
    kind: 'deepseek-official', apiKey: 'sk-no-keychain', baseUrl: '', model: '', protocol: 'messages'
  }, fakeSafeStorage(false));
  assert.match(degraded.problem || '', /系统凭据存储不可用/u);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /sk-no-keychain/u);
  const reload = await module.readAgentProviderSettings(file, fakeSafeStorage(false));
  assert.equal(reload.keyUnavailable, true);
  assert.equal(reload.settings.apiKey, '');
  await fs.rm(directory, { recursive: true, force: true });
});

test('密钥留空保存沿用已存的那份，显式 clearApiKey 才作废', async () => {
  const { mergeAgentProviderKey } = await import('../electron/agentRuntime/agentProviderSettings');
  const saved = { kind: 'custom-openai' as const, apiKey: 'sk-already-saved', baseUrl: 'https://gw/v1', model: 'm', protocol: 'messages' as const };
  const blank = { kind: 'custom-openai' as const, apiKey: '', baseUrl: 'https://gw2/v1', model: 'm2', protocol: 'messages' as const };
  assert.equal(mergeAgentProviderKey(blank, saved).apiKey, 'sk-already-saved', '留空不得擦掉已存密钥');
  assert.equal(mergeAgentProviderKey({ ...blank, apiKey: 'sk-new' }, saved).apiKey, 'sk-new');
  assert.equal(mergeAgentProviderKey(blank, saved, true).apiKey, '', '显式清除才作废');
  assert.equal(mergeAgentProviderKey(blank, undefined).apiKey, '');
});

// ---------- 运行时状态机（2026-09-23 修复批） ----------

test('运行器进程崩溃后快照必须从 running 修正为 failed，不得僵尸「待命」', async () => {
  const { service, root } = await createTestService({ turn: 'crash' });
  const started = await service.start({ workspaceRoot: root });
  assert.equal(started.state, 'running');
  await assert.rejects(() => service.prompt('干活', 'conv-1'), /退出码 2/u);
  const snapshot = service.snapshot();
  assert.equal(snapshot.state, 'failed', 'dsh 进程已死，状态不得停留在 running/待命');
  assert.match(snapshot.problem, /退出码 2/u);
  assert.equal(snapshot.pid, null);
  await service.stop().catch(() => undefined);
  await removeTempDir(root);
});

test('本轮失败（整轮超时）后运行时必须停机置 failed，杜绝两轮交错', async () => {
  const { service, root } = await createTestService({ turn: 'silent', turnTimeoutMs: 600 });
  await service.start({ workspaceRoot: root });
  await assert.rejects(() => service.prompt('慢慢想', 'conv-1'), /未回到空闲状态/u);
  const snapshot = service.snapshot();
  assert.equal(snapshot.state, 'failed', '请求失败后无法信任状态流，必须停机而不是回到 running');
  assert.match(snapshot.problem, /未回到空闲状态/u);
  assert.equal(snapshot.pid, null);
  await service.stop().catch(() => undefined);
  await removeTempDir(root);
});

test('主动停止打断本轮时状态由 stop() 收尾为 stopped，不得改写 failed', async () => {
  const { service, root } = await createTestService({ turn: 'silent' });
  await service.start({ workspaceRoot: root });
  const turnPromise = service.prompt('停我', 'conv-1');
  await delayed(150);
  await service.stop();
  await assert.rejects(() => turnPromise, /已退出|已关闭/u);
  assert.equal(service.snapshot().state, 'stopped');
  await removeTempDir(root);
});

test('dsh 会话由调用方按面板会话显式指定，未传时必须开新会话（不得继承上一轮）', async () => {
  const { service, root } = await createTestService({ turn: 'full' });
  await service.start({ workspaceRoot: root });
  const first = await service.prompt('第一轮', 'conv-A');
  assert.equal(first.sessionId, 'conv-A');
  const second = await service.prompt('第二轮');
  assert.match(second.sessionId, /^lb-panel-/u);
  assert.notEqual(second.sessionId, 'conv-A', '未传 sessionId 不得复用上一轮会话，否则跨面板会话泄漏上下文');
  await service.stop().catch(() => undefined);
  await removeTempDir(root);
});

test('零事件 idle（开场即失败，如凭据缺失）在宽限后立即结束，不得挂满整轮超时', async () => {
  const client = new HarnessSdkClient({
    command: 'ignored',
    args: [],
    cwd: process.cwd(),
    env: {},
    spawnProcess: fakeHarnessSpawn(harnessScript({ turn: 'idle-only' }))
  });
  await client.start();
  const startedAt = Date.now();
  const turn = await runHarnessTurn({ client, sessionId: 's-9', prompt: 'x', timeoutMs: 30_000, idleGraceMs: 300 });
  assert.ok(Date.now() - startedAt < 5_000, '零事件 idle 必须在宽限内结束，而不是等满整轮超时');
  assert.equal(turn.events.length, 0);
  assert.equal(turn.finalText, '');
  await client.close();
});

test('profile overlay 更新后必须清掉旧指纹文件，userData 不堆积垃圾', async () => {
  const dir = await createTempDir('agent-overlay-prune');
  const first = await writeAgentProfilePatch(dir, 'a: 1\n');
  const second = await writeAgentProfilePatch(dir, 'a: 2\n');
  assert.notEqual(first, second);
  const entries = await fs.readdir(dir);
  assert.deepEqual(entries, [path.basename(second)], '旧指纹 overlay 必须被清理，只保留当前这份');
  await fs.rm(dir, { recursive: true, force: true });
});
