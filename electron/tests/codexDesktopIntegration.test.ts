import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import {
  CodexDesktopIntegrationService,
  type CodexDesktopInstallation
} from '../electron/codexDesktopIntegrationService';

const INSTALLED: CodexDesktopInstallation = {
  installed: true,
  running: false,
  label: 'ChatGPT / Codex 桌面版',
  packageFullName: 'OpenAI.Codex_test',
  appUserModelId: 'OpenAI.Codex_test!App',
  executable: 'C:\\Program Files\\WindowsApps\\OpenAI.Codex\\app\\ChatGPT.exe',
  startedAt: null,
  detail: '已安装。'
};

test('Codex desktop integration writes a project-scoped token-free stdio MCP config and preserves unrelated TOML', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-codex-desktop-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const runtimeExecutable = path.join(workspaceRoot, 'LingBuilder.exe');
  const cliEntryPath = path.join(workspaceRoot, 'resources', 'app.asar', 'dist', 'cli.cjs');
  await fs.mkdir(path.dirname(cliEntryPath), { recursive: true });
  await fs.writeFile(runtimeExecutable, '', 'utf8');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  await fs.mkdir(path.join(workspaceRoot, '.codex'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.codex', 'config.toml'), '[features]\nfast_mode = true\n', 'utf8');
  let launches = 0;
  const service = new CodexDesktopIntegrationService({
    workspaceRoot,
    runtimeExecutable,
    cliEntryPath,
    detectInstallation: async () => INSTALLED,
    launchApp: async () => { launches += 1; }
  });

  assert.equal((await service.inspect()).state, 'not-configured');
  const configured = await service.configure({ permission: 'preview' });
  assert.equal(configured.state, 'configured');
  assert.equal(configured.configured, true);
  assert.equal(launches, 1);
  const source = await fs.readFile(configured.configPath, 'utf8');
  assert.match(source, /\[features\]\nfast_mode = true/u);
  assert.match(source, /\[mcp_servers\.lingbuilder_desktop\]/u);
  assert.match(source, /--stdio-only/u);
  assert.match(source, /default_tools_approval_mode = "writes"/u);
  assert.equal(/token/iu.test(source), false);

  const removed = await service.remove();
  assert.equal(removed.state, 'not-configured');
  assert.doesNotMatch(await fs.readFile(removed.configPath, 'utf8'), /lingbuilder_desktop/u);
});

test('Codex desktop integration reports conflicts and only replaces them after explicit approval', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-codex-conflict-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const runtimeExecutable = path.join(workspaceRoot, 'LingBuilder.exe');
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(runtimeExecutable, '', 'utf8');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  await fs.mkdir(path.join(workspaceRoot, '.codex'), { recursive: true });
  await fs.writeFile(path.join(workspaceRoot, '.codex', 'config.toml'), '[mcp_servers.lingbuilder_desktop]\ncommand = "custom"\n\n[features]\nfast_mode = true\n', 'utf8');
  const service = new CodexDesktopIntegrationService({
    workspaceRoot,
    runtimeExecutable,
    cliEntryPath,
    detectInstallation: async () => INSTALLED,
    launchApp: async () => undefined
  });

  assert.equal((await service.inspect()).state, 'conflict');
  await assert.rejects(service.configure(), /确认替换/u);
  const configured = await service.configure({ replaceExisting: true, openApp: false });
  assert.equal(configured.state, 'configured');
  const source = await fs.readFile(configured.configPath, 'utf8');
  assert.doesNotMatch(source, /command = "custom"/u);
  assert.match(source, /\[features\]\nfast_mode = true/u);
});

test('Codex desktop integration marks a running desktop client for restart when config is newer', async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-codex-restart-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  const runtimeExecutable = path.join(workspaceRoot, 'LingBuilder.exe');
  const cliEntryPath = path.join(workspaceRoot, 'cli.cjs');
  await fs.writeFile(runtimeExecutable, '', 'utf8');
  await fs.writeFile(cliEntryPath, '', 'utf8');
  const service = new CodexDesktopIntegrationService({
    workspaceRoot,
    runtimeExecutable,
    cliEntryPath,
    detectInstallation: async () => ({ ...INSTALLED, running: true, startedAt: '2020-01-01T00:00:00.000Z' }),
    launchApp: async () => undefined
  });
  const configured = await service.configure({ openApp: false });
  assert.equal(configured.state, 'restart-required');
  assert.equal(configured.restartRequired, true);
});

test('stdio-only mode completes a real MCP handshake without HTTP or a bearer token', { timeout: 20_000 }, async t => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-codex-stdio-'));
  t.after(() => fs.rm(workspaceRoot, { recursive: true, force: true }));
  await fs.writeFile(path.join(workspaceRoot, 'hello.lcpp'), '.版本 2\n', 'utf8');
  const electronRoot = path.resolve(import.meta.dirname, '..');
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      '--import', 'tsx', path.join(electronRoot, 'src', 'cli.ts'),
      'ai-server', '--workspace', workspaceRoot, '--permission', 'readonly', '--mcp', '--stdio-only'
    ],
    cwd: electronRoot,
    stderr: 'pipe'
  });
  const stderr: Buffer[] = [];
  transport.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)));
  const client = new Client({ name: 'lingbuilder-codex-desktop-test', version: '1.0.0' });
  t.after(() => client.close().catch(() => undefined));
  await client.connect(transport);
  const tools = await client.listTools();
  assert.equal(tools.tools.some(tool => tool.name === 'lingbuilder.workspace.list'), true);
  const result = await client.callTool({ name: 'lingbuilder.workspace.list', arguments: {} });
  assert.equal(result.isError, undefined);
  const logs = Buffer.concat(stderr).toString('utf8');
  assert.match(logs, /MCP stdio 已启动/u);
  assert.doesNotMatch(logs, /listening on http/iu);
  assert.doesNotMatch(logs, /Token:/u);
});
