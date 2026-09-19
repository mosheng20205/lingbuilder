import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { CDP_CLIENT_MODULE } from '../src/services/modules/cdpClientModule';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingEdgeViewHeadlessResource, LingWindowProject } from '../src/services/windowDesigner/types';
import type { InstalledModule } from '../src/services/modules/types';

const edgeViewModule: InstalledModule = {
  manifest: BUILTIN_MODULES.find(item => item.id === 'lingbuilder.edgeview')!,
  installPath: 'builtin://lingbuilder.edgeview',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};
const cdpModule: InstalledModule = {
  manifest: CDP_CLIENT_MODULE,
  installPath: 'builtin://lingbuilder.cdp.client',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

function headlessResource(overrides: Partial<LingEdgeViewHeadlessResource> = {}): LingEdgeViewHeadlessResource {
  return {
    id: 'edgeview-headless-1',
    type: 'EdgeViewHeadlessBrowser',
    name: 'EdgeView无头浏览器1',
    ownerWindowId: 'main-window',
    instanceId: 7,
    url: 'https://example.com',
    cacheDir: '.edgeview/headless-7',
    userAgent: 'DemoAgent/1.0',
    proxyServer: '',
    autoStart: true,
    ...overrides
  };
}

function makeProject(resources: LingEdgeViewHeadlessResource[]): LingWindowProject {
  return {
    schemaVersion: 2,
    id: 'edgeview-headless-test',
    name: 'EdgeView 无头测试项目',
    resources,
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#202020',
      description: '主窗口',
      designerBackend: 'win32',
      controls: []
    }]
  };
}

function generatedMain(project: LingWindowProject, source: string, outputKind?: 'console-application') {
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [edgeViewModule, cdpModule],
    lingCppSourceCode: source,
    ...(outputKind ? { outputKind } : {})
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  return { generated, cpp };
}

const WINDOW_SOURCE = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        EdgeView_导航实例(7, "https://qoder.com")',
  '        EdgeView_等待事件(7, "导航完成", 5000)',
  '    结束',
  '结束类'
].join('\n');

const CONSOLE_SOURCE = [
  '包 控制台程序',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    局部 整数型 创建无头',
  '    局部 CDP连接 无头连接',
  '    创建无头 = EdgeView_创建无头实例(1, "https://example.com", ".edgeview/headless-console")',
  '    无头连接 = CDP_启动浏览器("", &浏览器就绪)',
  '    EdgeView_泵消息(200)',
  '    如果 (CDP_停止浏览器(无头连接) == 0)',
  '        调试输出(CDP_取最后错误())',
  '    如果结束',
  '    返回 (0)',
  '  结束',
  '',
  '  事件 浏览器就绪()',
  '    调试输出(CDP_取当前事件类型())',
  '  结束',
  '结束类'
].join('\n');

test('EdgeView 无头实例与泵消息命令同时登记在 contributes 与 bindings', () => {
  const contributes = new Set((edgeViewModule.manifest.contributes?.commands ?? []).map(item => item.name));
  const bindings = new Map((edgeViewModule.manifest.bindings?.commands ?? []).map(item => [item.command, item]));
  for (const command of [
    'EdgeView_创建无头实例',
    'EdgeView_创建无头实例代理',
    'EdgeView_创建弹窗浏览器初始隐藏',
    'EdgeView_创建弹窗浏览器初始隐藏代理',
    'EdgeView_泵消息'
  ]) {
    assert.ok(contributes.has(command), `${command} 缺少 contributes.commands`);
    assert.ok(bindings.has(command), `${command} 缺少 bindings.commands`);
  }
});

test('CDP 无头浏览器命令登记在 contributes 与 bindings', () => {
  const contributes = new Set((CDP_CLIENT_MODULE.contributes?.commands ?? []).map(item => item.name));
  const bindings = new Map((CDP_CLIENT_MODULE.bindings?.commands ?? []).map(item => [item.command, item]));
  for (const command of ['CDP_启动浏览器', 'CDP_停止浏览器', 'CDP_停止全部浏览器', 'CDP_取最后错误']) {
    assert.ok(contributes.has(command), `${command} 缺少 contributes.commands`);
    assert.ok(bindings.has(command), `${command} 缺少 bindings.commands`);
  }
});

test('EdgeView无头浏览器设计器资源生成 spec 表并在窗口创建期建立无头实例', () => {
  const { generated, cpp } = generatedMain(makeProject([headlessResource(), headlessResource({
    id: 'edgeview-headless-2', name: 'EdgeView无头浏览器2', instanceId: 8, cacheDir: '.edgeview/headless-8', autoStart: false
  })]), WINDOW_SOURCE);
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join(' / '));
  assert.match(cpp, /static EdgeViewHeadlessSpec g_edgeViewHeadlessBrowsers\[\]/u);
  assert.match(cpp, /L"EdgeView无头浏览器1", 0, 7, L"https:\/\/example\.com", L"\.edgeview\/headless-7", L"DemoAgent\/1\.0", L"", true/u);
  assert.match(cpp, /L"EdgeView无头浏览器2", 0, 8, L"https:\/\/example\.com", L"\.edgeview\/headless-8", L"DemoAgent\/1\.0", L"", false/u);
  assert.match(cpp, /void EdgeView_创建无头资源\(\)/u);
  assert.match(cpp, /EdgeView_创建无头资源\(\);/u);
  // 无头宿主：WS_POPUP 隐藏工具窗口，创建核心以 revealHost=false + headless=true 收口。
  assert.match(cpp, /EdgeView 无头宿主", WS_POPUP/u);
  assert.match(cpp, /userAgent, false, true\)\) \{ DestroyWindow\(host\); return 0; \}/u);
  assert.match(cpp, /instance\.controller->put_IsVisible\(instance\.headless \? TRUE/u);
});

test('EdgeView 无头资源模型校验：实例编号必须正整数且项目内唯一', () => {
  const { generated } = generatedMain(makeProject([
    headlessResource(),
    headlessResource({ id: 'edgeview-headless-2', name: 'EdgeView无头浏览器2', instanceId: 7 })
  ]), WINDOW_SOURCE);
  const messages = generated.diagnostics.join('\n');
  assert.ok(messages.includes('实例编号 7 与其他无头组件重复'), messages);
  const { generated: zero } = generatedMain(makeProject([headlessResource({ instanceId: 0 })]), WINDOW_SOURCE);
  assert.ok(zero.diagnostics.some(item => item.includes('实例编号必须是正整数')), zero.diagnostics.join('\n'));
});

test('弹窗初始隐藏命令与泵消息运行时符号真实生成', () => {
  const { cpp } = generatedMain(makeProject([]), WINDOW_SOURCE);
  assert.match(cpp, /int EdgeView_创建弹窗浏览器初始隐藏\(int instanceId/u);
  assert.match(cpp, /int EdgeView_创建弹窗浏览器初始隐藏代理\(int instanceId/u);
  assert.match(cpp, /int EdgeView_泵消息\(int waitMilliseconds\)/u);
  assert.match(cpp, /MsgWaitForMultipleObjects\(0, nullptr, FALSE, 10, QS_ALLINPUT\)/u);
});

test('控制台入口创建无头泵窗口并保留无通知 owner 回退', () => {
  const { generated, cpp } = generatedMain(
    { ...makeProject([]), windows: [{ ...makeProject([]).windows[0], className: '程序' }] },
    CONSOLE_SOURCE,
    'console-application'
  );
  assert.equal(generated.blockingDiagnostics.length, 0, generated.blockingDiagnostics.join(' / '));
  assert.match(cpp, /if \(!consoleApp\.LingBuilder_确保无头泵窗口\(\)\)/u);
  assert.match(cpp, /LingBuilderConsolePumpWindow/u);
  assert.match(cpp, /WS_EX_TOOLWINDOW.*WS_POPUP/u);
  // WM_CREATE 泵分支只登记线程 owner；WM_DESTROY/WM_CLOSE/WM_NCDESTROY 全部有泵窗口守卫。
  assert.match(cpp, /case WM_CREATE: \{\s*\r?\n\s*if \(pumpWindowMode_\)/u);
  assert.match(cpp, /case WM_DESTROY:\s*\r?\n\s*if \(isPumpWindow_\) return 0;/u);
  assert.match(cpp, /if \(self->isPumpWindow_\) self->hwnd_ = nullptr;\s*\r?\n\s*else delete self;/u);
});

test('控制台无头资源给出代码命令引导诊断', () => {
  const { generated } = generatedMain(makeProject([headlessResource()]), CONSOLE_SOURCE, 'console-application');
  assert.ok(generated.diagnostics.some(item => item.includes('「EdgeView无头浏览器」组件不会自动启动')), generated.diagnostics.join('\n'));
});

test('CDP 启动浏览器运行时：DevToolsActivePort 解析、优雅停止与退出回收', () => {
  const { cpp } = generatedMain(makeProject([]), WINDOW_SOURCE);
  assert.match(cpp, /long long LaunchBrowser\(const wchar_t\* optionsJson/u);
  assert.match(cpp, /--headless=new --remote-debugging-port=0/u);
  assert.match(cpp, /DevToolsActivePort/u);
  assert.match(cpp, /SendCommand\(connection, L"Browser\.close"/u);
  assert.match(cpp, /禁止留下 msedge --headless 孤儿进程/u);
  assert.match(cpp, /CDP_启动浏览器\(const wchar_t\* optionsJson/u);
  assert.match(cpp, /const wchar_t\* CDP_取最后错误\(\)/u);
});

test('EdgeView 填表助手脚本必须用相邻字面量拼接（禁止指针相加坏全仓构建）', () => {
  const { cpp } = generatedMain(makeProject([]), WINDOW_SOURCE);
  assert.ok(!/document\.querySelectorAll\(select"\s*\r?\n\s*\+ L"/u.test(cpp), '填表助手脚本里仍存在 `+ L"` 指针拼接');
});
