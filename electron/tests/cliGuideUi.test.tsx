import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

test('AI Bridge center exposes one-click lifecycle, clients, shared MCP, CLI, permissions, and accessible feedback', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/CliGuideDialog.tsx'),
    'utf8'
  );
  assert.match(source, /AI Bridge 连接中心/u);
  assert.match(source, /启动 AI Bridge/u);
  assert.match(source, /连接并打开/u);
  assert.match(source, /Codex CLI、Claude Code、Gemini CLI/u);
  assert.match(source, /ChatGPT \/ Codex 桌面客户端/u);
  assert.match(source, /配置并打开桌面版/u);
  assert.match(source, /不保存 Token、不监听网络端口/u);
  assert.match(source, /打开 Bridge 终端/u);
  assert.match(source, /MCP（推荐）/u);
  assert.match(source, /已连接客户端/u);
  assert.match(source, /工具调用活动/u);
  assert.match(source, /lingbuilder doctor --json/u);
  assert.match(source, /mcpServers/u);
  assert.match(source, /readonly/u);
  assert.match(source, /preview/u);
  assert.match(source, /yolo/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /event\.key === 'Escape'/u);
  assert.match(source, /event\.key === 'Tab'/u);
});

test('workbench and packaged desktop expose the managed Bridge center through discoverable entries and IPC', async () => {
  const [appSource, mainSource, preloadSource, packageSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/preload.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../package.json'), 'utf8')
  ]);
  assert.match(appSource, /workbench\.action\.help\.openCliGuide/u);
  assert.match(appSource, /AI Bridge 连接中心\.\.\./u);
  assert.match(mainSource, /docs:open-cli-manual/u);
  assert.match(mainSource, /cli:inspect/u);
  assert.match(mainSource, /ai-bridge:start/u);
  assert.match(mainSource, /ai-bridge:launch-client/u);
  assert.match(mainSource, /ai-bridge:configure-codex-desktop/u);
  assert.match(mainSource, /ai-bridge:open-codex-desktop/u);
  assert.match(mainSource, /requestRendererApi/u);
  assert.match(preloadSource, /openCliManual/u);
  assert.match(preloadSource, /inspect: \(\) => ipcRenderer\.invoke\('cli:inspect'\)/u);
  assert.match(preloadSource, /launchClient/u);
  assert.match(preloadSource, /configureCodexDesktop/u);
  assert.match(preloadSource, /onStatusChanged/u);
  assert.match(packageSource, /AI_BRIDGE_CLI_USAGE\.md/u);
});
