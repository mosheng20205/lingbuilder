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

test('AI Bridge center degrades honestly outside desktop and never loses connect feedback', async () => {
  const [componentSource, appSource, integrationSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../src/components/CliGuideDialog.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../src/App.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/aiClientIntegrationService.ts'), 'utf8')
  ]);
  assert.match(componentSource, /MonitorSmartphone/u);
  assert.match(componentSource, /if \(!desktopApi\) \{\s*return \(/u);
  assert.match(componentSource, /withProbeTimeout/u);
  assert.match(componentSource, /重试获取状态/u);
  assert.match(componentSource, /未检测到外部 AI CLI/u);
  assert.match(componentSource, /onOpenTerminal\(result\.detail \|\|/u);
  assert.match(appSource, /onOpenTerminal=\{message =>/u);
  assert.match(appSource, /【AI Bridge】/u);
  assert.match(integrationSource, /正在通过 LingBuilder 共享 MCP 连接当前工作区/u);
  assert.match(integrationSource, /正在使用 LingBuilder 管理的临时 MCP 配置启动/u);
  assert.match(integrationSource, /正在使用本次终端专属设置连接 LingBuilder Bridge/u);
});

test('AI Bridge center permissions are Chinese-labeled, destructive actions confirm, and dark-mode text stays readable', async () => {
  const source = await fs.readFile(
    path.resolve(import.meta.dirname, '../src/components/CliGuideDialog.tsx'),
    'utf8'
  );
  assert.match(source, /PERMISSION_LABELS/u);
  assert.match(source, /只读/u);
  assert.match(source, /预览确认/u);
  assert.match(source, /全自动/u);
  assert.match(source, /调整启动设置（权限、端口、Token）/u);
  assert.match(source, /当前配置：\$\{PERMISSION_LABELS\[permission\]\}/u);
  assert.match(source, /停止 AI Bridge/u);
  assert.match(source, /断开全部连接并中断进行中的 AI 操作/u);
  assert.match(source, /重新生成 Token/u);
  assert.match(source, /旧 Token 立即失效/u);
  assert.match(source, /已复制\$\{label\}/u);
  assert.doesNotMatch(source, /text-\[9px\]/u);
  assert.doesNotMatch(source, /text-\[10px\] font-semibold/u);
  assert.doesNotMatch(source, /text-\[1[01\]]px[^"`]*text-slate-500/u);
});
