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
  assert.match(source, /手动连接（高级）/u);
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

test('AI Bridge center persists settings on edit in stopped state without clobbering the running snapshot', async () => {
  const [componentSource, mainSource, preloadSource, dtsSource] = await Promise.all([
    fs.readFile(path.resolve(import.meta.dirname, '../src/components/CliGuideDialog.tsx'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/main.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../electron/preload.ts'), 'utf8'),
    fs.readFile(path.resolve(import.meta.dirname, '../src/electron-api.d.ts'), 'utf8')
  ]);
  // 组件：打开连接中心时回填上次设置（运行中快照优先），停止态编辑防抖自动保存。
  assert.match(componentSource, /loadStartSettings/u);
  assert.match(componentSource, /停止态修改后自动保存到本机加密存储/u);
  assert.match(componentSource, /saveStartSettings/u);
  assert.match(componentSource, /bridgeRef\.current\.state === 'running'/u);
  // 权限选择只触发桌面客户端重新检测，不得连带回滚启动设置（effect 解耦）。
  // bootstrap effect 允许带 loadSkillKit（打开时读一次正文状态），但绝不能依赖 refreshCodexDesktop。
  assert.match(componentSource, /\}, \[desktopApi, loadBridgeStatus, loadSkillKit, open, refreshClients\]\);/u);
  assert.doesNotMatch(componentSource, /\}, \[[^\]]*loadBridgeStatus[^\]]*refreshCodexDesktop[^\]]*\]\);/u);
  assert.match(componentSource, /\}, \[desktopApi, open, refreshCodexDesktop\]\);/u);
  // 生命周期下拉在接线前属假设置，已从 UI 移除（内部固定 workspace）。
  assert.doesNotMatch(componentSource, /生命周期<select/u);
  // 主进程：start 成功后仍写设置并暴露独立 load/save IPC，保存失败回传 settingsError。
  assert.match(mainSource, /writeAiBridgeStartSettings/u);
  assert.match(mainSource, /ai-bridge:start-settings:load/u);
  assert.match(mainSource, /ai-bridge:start-settings:save/u);
  assert.match(mainSource, /settingsError/u);
  assert.match(preloadSource, /loadStartSettings: \(\) => ipcRenderer\.invoke\('ai-bridge:start-settings:load'\)/u);
  assert.match(preloadSource, /saveStartSettings: \(settings: unknown\) => ipcRenderer\.invoke\('ai-bridge:start-settings:save', settings\)/u);
  assert.match(dtsSource, /loadStartSettings/u);
  assert.match(dtsSource, /saveStartSettings/u);
  // 本机授权代理与灵码 Skill 正文取物：主进程 IPC + preload 白名单 + 类型声明三处齐备。
  assert.match(mainSource, /ai-bridge:local-auth-status/u);
  assert.match(mainSource, /skill-kit:status/u);
  assert.match(mainSource, /skill-kit:check-update/u);
  assert.match(preloadSource, /localAuthStatus: \(\) => ipcRenderer\.invoke\('ai-bridge:local-auth-status'\)/u);
  assert.match(preloadSource, /status: \(\) => ipcRenderer\.invoke\('skill-kit:status'\)/u);
  assert.match(preloadSource, /checkUpdate: \(\) => ipcRenderer\.invoke\('skill-kit:check-update'\)/u);
  assert.match(dtsSource, /skillKit\?:/u);
  assert.match(dtsSource, /LingBuilderSkillKitStatus/u);
  assert.match(componentSource, /允许外部 AI 客户端使用本机授权/u);
  assert.match(componentSource, /灵码 Skill 正文/u);
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
  assert.match(appSource, /AiBridgeTitleBarBadge/u);
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
  assert.match(source, /Bridge 启动设置/u);
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
