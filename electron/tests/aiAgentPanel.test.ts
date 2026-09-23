import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { AGENT_PROPOSAL_TTL_MS, agentToolEventCallId, describeEditProposalOutcome, isAgentProposalStale } from '../src/components/AiAssistant';
import { buildProposalLineDiff } from '../src/services/ai/proposalPreviewDiff';
import { buildAgentTurnContextPrompt, deriveProjectDirectory } from '../src/services/ai/agentTurnContext';
import { deriveAiNewFileAllowance, isPathAllowedByNewFileAllowance, parseAiNewFileAllowance } from '../src/services/ai/aiEditFileScope';

const read = (relative: string) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('AI 面板收敛为本机 Agent 单引擎：系统 AI 与自定义 API 通道已物理删除', () => {
  const assistant = read('../src/components/AiAssistant.tsx');

  // 旧通道的标识符必须一个都不剩（不是隐藏页签，是删实现）。
  for (const gone of [
    'aiMode', 'handleAiModeChange', 'AI_MODEL_PRESETS', 'aiConfig', 'loadAiConfig',
    'cloudAi', 'api/ai/chat', 'api/ai/connect', 'api/ai/models',
    'runAiModuleGeneration', 'resolveByokAiConfig', 'aiConnectionSession',
    // 面板用不到账号系统：本机 Agent 自带模型通道，登录/注册/点数/充值一律留在标题栏、设置与欢迎页。
    'cloudAccount', 'requestCloudAccountLogin', 'requestCloudAccountRecharge', '\u53ef\u7528\u70b9\u6570',
    'isLikelyDesignerEditInstruction', 'isLikelyCodeEditInstruction', 'isLikelyModuleGenerationInstruction'
  ]) {
    assert.ok(!assistant.includes(gone), `AI 面板不得再出现旧通道标识：${gone}`);
  }

  // 唯一提交路径：需求整体交给内嵌运行时，落盘仍只在用户确认提案后由 IDE 代执行。
  assert.match(assistant, /await runAgentTurn\(instruction\)/u);
  assert.match(assistant, /window\.lingBuilder\?\.agentRuntime/u);
  assert.match(assistant, /\/api\/lingcpp\/edit\/agent-proposal/u);
  // DeepSeek Harness 致谢与官方仓库导航（用户明确要求不得移除）。
  assert.match(assistant, /DeepSeek Harness/u);
  assert.match(assistant, /github\.com\/deepseek-ai\/deepseek-harness/u);
});

test('面板间需求交接只有事件总线一条通道，且由工作台展开侧栏后交面板执行', () => {
  const bus = read('../src/services/ai/agentRequestBus.ts');
  const app = read('../src/App.tsx');
  const assistant = read('../src/components/AiAssistant.tsx');

  assert.match(bus, /export const AI_AGENT_REQUEST_EVENT/u);
  assert.match(app, /onAiAgentRequest\(request =>/u);
  // 侧栏收起时 AiAssistant 未挂载，需求必须先落工作台 state，再由面板认领。
  assert.match(app, /setPendingAgentRequest\(\{ id: agentRequestSeqRef\.current/u);
  assert.match(app, /agentRequest=\{pendingAgentRequest\}/u);
  assert.match(app, /workbench\.aiPanel\.visible', true/u);
  assert.match(assistant, /const request = agentRequest;/u);
  assert.match(assistant, /onAgentRequestHandledRef\.current\?\.\(request\.id\)/u);

  // App 在欢迎页分支上有提前 return：交接 state 必须留在主 hook 区（该分支之前），
  // 否则欢迎页→工作台切换时 hook 数量变多，React 直接「Rendered more hooks…」整树崩（09-22 实踩）。
  const appLines = app.split('\n');
  const hookLine = appLines.findIndex(line => line.includes('const [pendingAgentRequest'));
  const welcomeBranch = appLines.findIndex(line => /^  if \(showWelcomePage\) \{/u.test(line));
  assert.ok(hookLine > 0, 'pendingAgentRequest state 必须存在于 App.tsx');
  assert.ok(welcomeBranch > hookLine, '交接 state 必须声明在欢迎页提前 return 分支之前');
});

test('模块面板不再自带模型通道：AI 生成模块经事件总线交给本机 Agent', () => {
  const inspector = read('../src/components/ModuleInspector.tsx');

  assert.match(inspector, /requestAiAgentTurn\(\{/u);
  assert.match(inspector, /module\.scaffold[\s\S]{0,24}module\.writeFiles[\s\S]{0,40}module\.validate/u);
  for (const gone of ['aiGenerateChannel', 'runAiModuleGenerationFlow', 'AiModuleGenerationStage', 'cloudAuthenticated', 'aiGenerateStage']) {
    assert.ok(!inspector.includes(gone), `模块面板不得再自带旧生成通道状态：${gone}`);
  }
  // 手动粘贴导入（解析「### 文件：」契约 → 受控导入）是引擎无关能力，必须保留。
  assert.match(inspector, /importAiModuleFilesToWorkspace/u);
  assert.match(inspector, /canImportAiFiles/u);
});

test('工具调用卡片必须认得 dsh 的 tool/result callId 位置', () => {
  // tool/call：顶层 callId
  assert.equal(agentToolEventCallId({ callId: 'call_00_ET_abc', name: 'mcp__lingbuilder__lingbuilder_file_read_123456789abc' }), 'call_00_ET_abc');
  // tool/result：真实形态把 id 藏在 message.source.callId 与 content[].toolCallId，顶层没有 callId。
  // 只认顶层会让所有步骤停在未完成态（真机截图里「本轮工具调用 0/4」就是这个）。
  assert.equal(agentToolEventCallId({ message: { source: { kind: 'tool', callId: 'call_00_ET_abc' }, content: [] } }), 'call_00_ET_abc');
  assert.equal(agentToolEventCallId({ message: { content: [{ type: 'tool-result', toolCallId: 'call_01_XY_def' }] } }), 'call_01_XY_def');
  assert.equal(agentToolEventCallId({}), '');
});

test('提案播报如实区分「布局已改」与「界面未变」，不让用户误判', () => {
  const base = {
    id: 'p1', title: 't', summary: 's', createdAt: '', explanation: '', changes: []
  } as any;
  assert.match(
    describeEditProposalOutcome({ ...base, changes: [{ filePath: 'src/MainWindow.lcpp' }], designerProject: { id: 'p' } }),
    /界面设计器会立即重绘/u
  );
  assert.match(
    describeEditProposalOutcome({ ...base, changes: [{ filePath: 'src/MainWindow.lcpp' }], designerUnchanged: true }),
    /界面布局未发生变化（本次仅源码改动）/u
  );
  const codeOnly = describeEditProposalOutcome({ ...base, changes: [{ filePath: 'src/MainWindow.lcpp' }] });
  assert.equal(codeOnly.includes('界面布局未发生变化'), false);
});

test('纯布局提案贯通到应用与画布刷新，判定不再依赖面板关键词', () => {
  const app = read('../src/App.tsx');
  const server = read('../server.ts');
  const assistant = read('../src/components/AiAssistant.tsx');

  // 面板播报必须走统一出口（否则「应用成功但界面没动」又回到用户视野里）。
  assert.match(assistant, /describeEditProposalOutcome\(proposal\)/u);
  // 纯布局提案返回 0 个文件不得被当成写入失败。
  assert.match(app, /\(!appliedFiles\.length && !proposal\.designerProject\)/u);
  // 重载刷新画布时必须保留仍存在的窗口与选中控件。
  assert.match(app, /keepsActiveWindow/u);
  assert.match(app, /keepsSelectedControl/u);

  // 系统 AI 的纯布局草稿（files 为空 + 设计器确实变化）不能被本地路由打回。
  assert.match(server, /const designerOnlyDraft = !safeDraftFiles\.length/u);
  assert.match(server, /if \(!safeDraftFiles\.length && !designerOnlyDraft\) \{/u);
});

test('新建文件白名单：校验、匹配与指令推导', () => {
  const parsed = parseAiNewFileAllowance({ paths: ['./src/utils.lcpp', 'src\\utils.lcpp'], maxCount: 3 });
  assert.equal(parsed.ok, true);
  if (parsed.ok) {
    assert.deepEqual(parsed.allowance.paths, ['src/utils.lcpp']);
    assert.equal(parsed.allowance.maxCount, 3);
  }
  const directoryAllowance = parseAiNewFileAllowance({ directories: ['src/演示项目'], extensions: ['.lcpp'] });
  assert.equal(directoryAllowance.ok, true);
  if (directoryAllowance.ok) {
    assert.equal(isPathAllowedByNewFileAllowance('src/演示项目/Cookie导出.lcpp', directoryAllowance.allowance), true);
    assert.equal(isPathAllowedByNewFileAllowance('src/演示项目/notes.md', directoryAllowance.allowance), false);
    assert.equal(isPathAllowedByNewFileAllowance('src/other/新库.lcpp', directoryAllowance.allowance), false);
  }
  assert.equal(parseAiNewFileAllowance({ paths: ['../逃逸.lcpp'] }).ok, false);
  assert.equal(parseAiNewFileAllowance({ paths: [] }).ok, false);
  assert.equal(parseAiNewFileAllowance({ paths: ['a.lcpp'], maxCount: 99 }).ok, false);

  // 指令点名具体文件 → 显式路径落在活动文件同目录。
  const explicit = deriveAiNewFileAllowance('帮我新建 utils.lcpp 功能库放这些函数', 'src/演示项目/MainWindow.lcpp');
  assert.ok(explicit?.paths?.includes('src/演示项目/utils.lcpp'));
  // 指令要求新建但不点名 → 活动目录内允许建 .lcpp。
  const unnamed = deriveAiNewFileAllowance('新建一个功能库把这些公共函数放进去', 'src/演示项目/MainWindow.lcpp');
  assert.deepEqual(unnamed?.directories, ['src/演示项目']);
  assert.deepEqual(unnamed?.extensions, ['.lcpp']);
  // 与新建无关的指令不改变既有语义。
  assert.equal(deriveAiNewFileAllowance('请修复这个编译错误', 'src/MainWindow.lcpp'), undefined);
});

test('提案预览行级 diff：增删计数、相同行折叠省略与超长截断', () => {
  // 单行替换：相同上下文保留，增删各 1 行。
  const edit = buildProposalLineDiff('如果真\n按钮.标题 = 1\n调试输出(1)', '如果真\n按钮.标题 = 2\n调试输出(1)');
  assert.equal(edit.addedCount, 1);
  assert.equal(edit.removedCount, 1);
  assert.equal(edit.lines.filter(line => line.kind === 'same').length, 2);
  assert.ok(edit.lines.some(line => line.kind === 'removed' && line.text.includes('标题 = 1')));
  assert.ok(edit.lines.some(line => line.kind === 'added' && line.text.includes('标题 = 2')));

  // 新建文件：全部是新增行。
  const fresh = buildProposalLineDiff('', '变量 x = 1\n变量 y = 2');
  assert.equal(fresh.addedCount, 2);
  assert.equal(fresh.removedCount, 0);

  // 长相同段折叠：只保留首尾各 3 行 + 省略标记，不再整段平铺。
  const longSame = Array.from({ length: 20 }, () => 'k');
  const fold = buildProposalLineDiff([...longSame, 'z'].join('\n'), [...longSame, 'Z'].join('\n'));
  assert.ok(fold.lines.some(line => line.kind === 'elided'), '超过 6 行的相同段必须折叠省略');
  assert.equal(fold.lines.filter(line => line.kind === 'same').length, 6);

  // 超长截断：最多 400 行并如实标注。
  const big = buildProposalLineDiff(
    Array.from({ length: 500 }, (_, index) => `旧${index}`).join('\n'),
    Array.from({ length: 500 }, (_, index) => `新${index}`).join('\n')
  );
  assert.equal(big.truncated, true);
  assert.equal(big.lines.length, 400);
});

test('过期提案预警：超过 30 分钟判过期，createdAt 非法不得误判', () => {
  assert.equal(AGENT_PROPOSAL_TTL_MS, 30 * 60_000);
  const now = Date.now();
  assert.equal(isAgentProposalStale({ createdAt: new Date(now - 10 * 60_000).toISOString() }), false);
  assert.equal(isAgentProposalStale({ createdAt: new Date(now - 31 * 60_000).toISOString() }), true);
  assert.equal(isAgentProposalStale({ createdAt: '' }), false);
  assert.equal(isAgentProposalStale({ createdAt: '不是时间' }), false);
});

test('Agent 轮次注入当前项目上下文：多项目工作区不再误取占位项目', () => {
  // 推导项目目录：取第一个文件路径的目录段，容错反斜杠。
  assert.equal(deriveProjectDirectory(['agent-demo\\MainWindow.lcpp', 'agent-demo\\项目DLL命令.lcpp']), 'agent-demo');
  assert.equal(deriveProjectDirectory(['MainWindow.lcpp']), '');
  assert.equal(deriveProjectDirectory([]), '');
  assert.equal(deriveProjectDirectory(undefined), '');

  const prompt = buildAgentTurnContextPrompt({
    projectId: 'lingbuilder-project',
    filePath: 'agent-demo\\MainWindow.lcpp',
    hasDesigner: true,
    workspaceFilePaths: ['agent-demo/MainWindow.lcpp', 'agent-demo/项目DLL命令.lcpp']
  }, '把按钮文本改成「点我试试」');
  assert.match(prompt, /当前打开项目 ID：lingbuilder-project/u);
  assert.match(prompt, /项目源码目录：agent-demo\//u);
  assert.match(prompt, /活动文件：agent-demo\/MainWindow\.lcpp/u);
  assert.match(prompt, /窗口项目/u);
  assert.match(prompt, /不要改动其它项目的文件/u);
  assert.ok(prompt.endsWith('把按钮文本改成「点我试试」'), '指令原文必须完整附在上下文之后');

  // 没有任何事实（网页版无 IPC）时不注入，原样返回。
  assert.equal(buildAgentTurnContextPrompt({}, '你好'), '你好');
});

test('面板修复批：会话映射、停止静默、凭据门检、提案门检与常驻状态行', () => {
  const assistant = read('../src/components/AiAssistant.tsx');

  // 面板会话 ↔ dsh 会话一一映射：清除上下文/停止/重启必须作废映射，否则旧上下文
  // 静默泄漏进新会话，「清除上下文」就只剩清 UI 的假动作。
  assert.match(assistant, /agentSessionsRef = useRef<Map<string, string>>/u);
  assert.match(assistant, /agentSessionsRef\.current\.delete\(activeConversation\.id\)/u);
  assert.match(assistant, /agentSessionsRef\.current\.clear\(\)/u);

  // 主动停止导致的 in-flight 拒绝必须静默，不得再追加「内嵌 Agent 出错」误导报错。
  assert.match(assistant, /agentStopRequestedRef/u);

  // 启动前凭据门检（自定义通道缺 Key 硬拦截）与零响应诊断文案。
  assert.match(assistant, /checkAgentCredential/u);
  assert.match(assistant, /没有留下文字说明/u);
  assert.match(assistant, /可点上方「测试连通」验证/u);

  // 提案取回必须以本轮真的调用过 edit.propose 为前提，且过期时禁用「应用提案」。
  assert.match(assistant, /edit_propose/iu);
  assert.match(assistant, /isAgentProposalStale/u);
  assert.match(assistant, /buildProposalLineDiff/u);

  // 运行状态行必须常驻：其 JSX 出现在配置折叠区（isAiConfigExpanded &&）之前。
  const statusRow = assistant.indexOf('运行状态行常驻');
  const collapsedForm = assistant.indexOf('{isAiConfigExpanded && (');
  assert.ok(statusRow >= 0, '必须保留常驻状态行注释锚点');
  assert.ok(collapsedForm > statusRow, '状态行必须渲染在配置折叠区之前');

  // 一轮执行中禁止会话切换/新建/清除（防止把本轮结果写进切换后的会话）。
  assert.match(assistant, /const activateConversation = async \(conversationId: string\) => \{\n    if \(isAiResponding\) return;/u);
});
