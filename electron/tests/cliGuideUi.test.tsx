import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function readSource(relative: string): Promise<string> {
  return fs.readFile(path.resolve(import.meta.dirname, relative), 'utf8');
}

test('AI Bridge 连接中心收敛为状态行 + 通用 MCP 配置 + 高级设置，一键适配与 CLI 列表整体移除', async () => {
  const source = await readSource('../src/components/CliGuideDialog.tsx');
  assert.match(source, /AI Bridge 连接中心/u);
  assert.match(source, /启动 AI Bridge/u);
  assert.match(source, /连接配置（通用 MCP）/u);
  assert.match(source, /复制连接配置/u);
  assert.match(source, /配置一次长期有效/u);
  assert.match(source, /高级设置/u);
  assert.match(source, /Bridge 启动设置/u);
  assert.match(source, /mcpServers/u);
  assert.match(source, /灵码 Skill 正文/u);
  assert.match(source, /readonly/u);
  assert.match(source, /preview/u);
  assert.match(source, /yolo/u);
  assert.match(source, /role="dialog"/u);
  assert.match(source, /aria-modal="true"/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /event\.key === 'Escape'/u);
  assert.match(source, /event\.key === 'Tab'/u);
  // 截图三区块物理移除：桌面客户端一键适配、外部 AI CLI 列表、Bridge 终端、STDIO 提示条。
  assert.doesNotMatch(source, /连接并打开/u);
  assert.doesNotMatch(source, /Codex 桌面/u);
  assert.doesNotMatch(source, /ChatGPT \/ Codex 桌面客户端/u);
  assert.doesNotMatch(source, /打开 Bridge 终端/u);
  assert.doesNotMatch(source, /不保存 Token、不监听网络端口/u);
  assert.doesNotMatch(source, /LINGBUILDER_AI_BRIDGE_TOKEN 环境变量/u);
  assert.doesNotMatch(source, /ClientRow|CodexDesktopCard|ProbeErrorCard/u);
});

test('通用 MCP 配置内嵌真实 Token（运行中取运行时，否则回落持久化 Token）', async () => {
  const source = await readSource('../src/components/CliGuideDialog.tsx');
  assert.match(source, /const connectionToken = runtimeToken \|\| savedToken;/u);
  assert.match(source, /Authorization: `Bearer \$\{connectionToken/u);
  assert.match(source, /revealToken/u);
  assert.match(source, /setSavedToken\(saved\.token \|\| ''\)/u);
});

test('Bridge 随 IDE 启动自动拉起：主进程自启 + Token 默认持久化 + yolo 确认随设置持久化', async () => {
  const [mainSource, settingsSource, componentSource, dtsSource] = await Promise.all([
    readSource('../electron/main.ts'),
    readSource('../electron/aiBridgeStartSettings.ts'),
    readSource('../src/components/CliGuideDialog.tsx'),
    readSource('../src/electron-api.d.ts')
  ]);
  // 主进程：IDE 启动即自动拉起（不阻塞窗口创建），冒烟测试跳过。
  assert.match(mainSource, /async function autoStartAiBridgeOnLaunch/u);
  assert.match(mainSource, /void autoStartAiBridgeOnLaunch\(\)/u);
  assert.match(mainSource, /process\.argv\.includes\('--smoke-test'\)/u);
  // Token 持久化：没有持久化 Token 时先随机生成并落盘，再启动，保证客户端配置一次长期有效。
  assert.match(mainSource, /crypto\.randomBytes\(32\)\.toString\('hex'\)/u);
  assert.match(mainSource, /writeAiBridgeStartSettings/u);
  // yolo 门禁：自动启动没有会话内确认框，只有持久化的确认标记才允许按 yolo 拉起，否则降级 preview。
  assert.match(mainSource, /yoloConfirmed !== true \? 'preview'/u);
  assert.match(mainSource, /启动设置即用户显式选择|持久化的权限即用户的显式选择/u);
  // 设置模型：yoloConfirmed 进 normalize/read/write 全链。
  assert.match(settingsSource, /yoloConfirmed: value\.yoloConfirmed === true/u);
  assert.match(settingsSource, /yoloConfirmed: parsed\.yoloConfirmed === true/u);
  assert.match(settingsSource, /yoloConfirmed: normalized\.yoloConfirmed/u);
  // 渲染端：确认框状态随设置回填并参与防抖保存；启动接口继续要求 approvedYolo。
  assert.match(componentSource, /setApprovedYolo\(saved\.yoloConfirmed === true\)/u);
  assert.match(componentSource, /yoloConfirmed: approvedYolo/u);
  assert.match(dtsSource, /yoloConfirmed/u);
  // 组件：打开连接中心时回填上次设置（运行中快照优先），停止态编辑防抖自动保存。
  assert.match(componentSource, /loadStartSettings/u);
  assert.match(componentSource, /停止态修改后自动保存到本机加密存储/u);
  assert.match(componentSource, /saveStartSettings/u);
  assert.match(componentSource, /bridgeRef\.current\.state === 'running'/u);
  assert.match(componentSource, /settingsSaveState/u);
  assert.match(componentSource, /正在保存…/u);
  assert.match(componentSource, /已保存到本机加密存储/u);
  // 生命周期下拉在接线前属假设置，已从 UI 移除（内部固定 workspace）。
  assert.doesNotMatch(componentSource, /生命周期<select/u);
  // 主进程：start 成功后仍写设置并暴露独立 load/save IPC，保存失败回传 settingsError。
  assert.match(mainSource, /ai-bridge:start-settings:load/u);
  assert.match(mainSource, /ai-bridge:start-settings:save/u);
  assert.match(mainSource, /settingsError/u);
  // 本机授权代理与灵码 Skill 正文取物：主进程 IPC + preload 白名单 + 类型声明三处齐备。
  assert.match(mainSource, /ai-bridge:local-auth-status/u);
  assert.match(mainSource, /skill-kit:status/u);
  assert.match(mainSource, /skill-kit:check-update/u);
});

test('工作台入口保留，被移除的 IPC/服务不再出现在 preload 与类型声明中', async () => {
  const [appSource, mainSource, preloadSource, dtsSource, packageSource] = await Promise.all([
    readSource('../src/App.tsx'),
    readSource('../electron/main.ts'),
    readSource('../electron/preload.ts'),
    readSource('../src/electron-api.d.ts'),
    readSource('../package.json')
  ]);
  assert.match(appSource, /workbench\.action\.help\.openCliGuide/u);
  assert.match(appSource, /AI Bridge 连接中心\.\.\./u);
  assert.match(appSource, /AiBridgeTitleBarBadge/u);
  assert.doesNotMatch(appSource, /onOpenTerminal=\{message =>/u);
  assert.match(mainSource, /docs:open-cli-manual/u);
  assert.match(mainSource, /ai-bridge:start/u);
  assert.doesNotMatch(mainSource, /ai-bridge:launch-client/u);
  assert.doesNotMatch(mainSource, /ai-bridge:clients/u);
  assert.doesNotMatch(mainSource, /codex-desktop/u);
  assert.doesNotMatch(mainSource, /cli:inspect/u);
  assert.doesNotMatch(mainSource, /aiClientIntegrationService|codexDesktopIntegrationService|cliIntegrationService/u);
  assert.match(preloadSource, /openCliManual/u);
  assert.match(preloadSource, /onStatusChanged/u);
  assert.doesNotMatch(preloadSource, /launchClient|codexDesktopStatus|configureCodexDesktop|removeCodexDesktop|openCodexDesktop|'ai-bridge:clients'|cli:inspect/u);
  assert.doesNotMatch(dtsSource, /LingBuilderCodexDesktopStatus|LingBuilderExternalAiClientId/u);
  assert.doesNotMatch(dtsSource, /launchClient|codexDesktopStatus/u);
  assert.match(packageSource, /AI_BRIDGE_CLI_USAGE\.md/u);
});

test('权限中文标签、破坏性操作确认与暗色可读性约束继续成立', async () => {
  const source = await readSource('../src/components/CliGuideDialog.tsx');
  assert.match(source, /PERMISSION_LABELS/u);
  assert.match(source, /只读/u);
  assert.match(source, /预览确认/u);
  assert.match(source, /全自动/u);
  assert.match(source, /当前配置：\$\{PERMISSION_LABELS\[permission\]\}/u);
  assert.match(source, /停止 AI Bridge/u);
  assert.match(source, /断开全部连接并中断进行中的 AI 操作/u);
  assert.match(source, /重新生成 Token/u);
  assert.match(source, /旧 Token 立即失效/u);
  assert.match(source, /已复制/u);
  assert.doesNotMatch(source, /text-\[9px\]/u);
  assert.doesNotMatch(source, /text-\[10px\] font-semibold/u);
  assert.doesNotMatch(source, /text-\[1[01\]]px[^"`]*text-slate-500/u);
});
