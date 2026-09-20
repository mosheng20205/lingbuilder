import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { CEF3_MODULE_FAMILY } from '../src/services/modules/moduleFamilies';
import { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { getLingCppControlReferenceDiagnostics } from '../src/services/lingCpp/controlReferenceService';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

// CEF3 真无头（CEF 官方 windowless / OSR）中文命令面：18 条命令全部按「实例编号」寻址，
// 不产生任何窗口，也不接受 controlRef。清单与 binding 必须成对（AGENTS 模块生态规则）。
const HEADLESS_COMMANDS = [
  'CEF3_创建无头浏览器', 'CEF3无头_是否已创建', 'CEF3无头_设置视口', 'CEF3无头_取视口JSON',
  'CEF3无头_取渲染帧数', 'CEF3无头_等待出帧', 'CEF3无头_导航', 'CEF3无头_是否加载中', 'CEF3无头_等待加载完成',
  'CEF3无头_取标题', 'CEF3无头_取地址', 'CEF3无头_取主框架', 'CEF3无头_取浏览器句柄',
  'CEF3无头_执行JS', 'CEF3无头_取页面文本', 'CEF3无头_取页面源码', 'CEF3无头_取事件JSON',
  'CEF3无头_关闭'
];

// 参数类型序列与返回类型（brief 表）：contributes 用中文类型，binding 用 ABI 类型。
const HEADLESS_SIGNATURES: Record<string, { parameters: Array<[string, string]>; abi: string; ling: string }> = {
  'CEF3_创建无头浏览器': { parameters: [['实例编号', 'int'], ['地址', 'wideString'], ['独立缓存目录', 'wideString'], ['代理地址', 'wideString'], ['视口宽', 'int'], ['视口高', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_是否已创建': { parameters: [['实例编号', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_设置视口': { parameters: [['实例编号', 'int'], ['视口宽', 'int'], ['视口高', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_取视口JSON': { parameters: [['实例编号', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取渲染帧数': { parameters: [['实例编号', 'int']], abi: 'longLong', ling: '长整数型' },
  'CEF3无头_等待出帧': { parameters: [['实例编号', 'int'], ['超时毫秒', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_导航': { parameters: [['实例编号', 'int'], ['地址', 'wideString']], abi: 'int', ling: '整数型' },
  'CEF3无头_是否加载中': { parameters: [['实例编号', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_等待加载完成': { parameters: [['实例编号', 'int'], ['超时毫秒', 'int']], abi: 'int', ling: '整数型' },
  'CEF3无头_取标题': { parameters: [['实例编号', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取地址': { parameters: [['实例编号', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取主框架': { parameters: [['实例编号', 'int']], abi: 'longLong', ling: '长整数型' },
  'CEF3无头_取浏览器句柄': { parameters: [['实例编号', 'int']], abi: 'longLong', ling: '长整数型' },
  'CEF3无头_执行JS': { parameters: [['实例编号', 'int'], ['脚本', 'wideString']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取页面文本': { parameters: [['实例编号', 'int'], ['超时毫秒', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取页面源码': { parameters: [['实例编号', 'int'], ['超时毫秒', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_取事件JSON': { parameters: [['实例编号', 'int']], abi: 'wideString', ling: '文本型' },
  'CEF3无头_关闭': { parameters: [['实例编号', 'int']], abi: 'int', ling: '整数型' }
};

// 运行时无签名（生成 C++ 里必须逐字存在，供本文件与 Task 9/11 定位函数体）。
const HEADLESS_RUNTIME_SIGNATURES: Record<string, string> = {
  'CEF3无头_是否已创建': 'int CEF3无头_是否已创建(int instanceId)',
  'CEF3无头_设置视口': 'int CEF3无头_设置视口(int instanceId, int viewWidth, int viewHeight)',
  'CEF3无头_取视口JSON': 'std::wstring CEF3无头_取视口JSON(int instanceId)',
  'CEF3无头_取渲染帧数': 'long long CEF3无头_取渲染帧数(int instanceId)',
  'CEF3无头_等待出帧': 'int CEF3无头_等待出帧(int instanceId, int timeoutMilliseconds)',
  'CEF3无头_导航': 'int CEF3无头_导航(int instanceId, const wchar_t* address)',
  'CEF3无头_是否加载中': 'int CEF3无头_是否加载中(int instanceId)',
  'CEF3无头_等待加载完成': 'int CEF3无头_等待加载完成(int instanceId, int timeoutMilliseconds)',
  'CEF3无头_取标题': 'std::wstring CEF3无头_取标题(int instanceId)',
  'CEF3无头_取地址': 'std::wstring CEF3无头_取地址(int instanceId)',
  'CEF3无头_取主框架': 'long long CEF3无头_取主框架(int instanceId)',
  'CEF3无头_取浏览器句柄': 'long long CEF3无头_取浏览器句柄(int instanceId)',
  'CEF3无头_执行JS': 'std::wstring CEF3无头_执行JS(int instanceId, const wchar_t* script)',
  'CEF3无头_取页面文本': 'std::wstring CEF3无头_取页面文本(int instanceId, int timeoutMilliseconds)',
  'CEF3无头_取页面源码': 'std::wstring CEF3无头_取页面源码(int instanceId, int timeoutMilliseconds)',
  'CEF3无头_取事件JSON': 'std::wstring CEF3无头_取事件JSON(int instanceId)',
  'CEF3无头_关闭': 'int CEF3无头_关闭(int instanceId)'
};

const browser = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser')!;
const contributionOf = (name: string) => browser.contributes!.commands!.find(item => item.name === name);
const bindingOf = (name: string) => browser.bindings!.commands!.find(item => item.command === name);

// 无头命令的运行时与「无 HWND」红线同属 LingWindowBase 无条件生成的 CEF3 运行时段；
// 这里额外用一份「真调用」源码验证 18 条命令的调用翻译（启用 CEF3 浏览器模块）。
const CONSOLE_SOURCE = [
  '包 无头演示',
  '使用 CEF3浏览器模块',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    局部 文本型 标题',
  '    局部 长整数型 框架',
  '    CEF3_创建无头浏览器(1, "https://www.example.com", ".cef3/headless-1", "", 1280, 720)',
  '    CEF3无头_导航(1, "https://www.example.com")',
  '    CEF3无头_等待加载完成(1, 15000)',
  '    框架 = CEF3无头_取主框架(1)',
  '    标题 = CEF3无头_取标题(1)',
  '    调试输出(CEF3无头_执行JS(1, "document.title"))',
  '    调试输出(CEF3无头_取视口JSON(1), CEF3无头_取渲染帧数(1), CEF3无头_取事件JSON(1))',
  '    调试输出(CEF3无头_等待出帧(1, 8000))',
  '    CEF3无头_设置视口(1, 1024, 640)',
  '    CEF3无头_关闭(1)',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');

const consoleProject = (): LingWindowProject => ({
  schemaVersion: 2,
  id: 'headless-command-demo',
  name: '无头命令示例',
  resources: [],
  windows: [{
    id: 'main-window', fileName: 'MainWindow.xml', className: '程序',
    title: '无头命令示例', width: 640, height: 420, background: '#1e1e1e',
    description: '', designerBackend: 'win32', controls: []
  }]
});

const cef3BrowserModule: InstalledModule = {
  manifest: browser,
  installPath: 'builtin://lingbuilder.cef3.browser',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

// OSR 命令全部按句柄寻址，因此调用范式是「先取无头实例句柄，再逐条传给 CEF3OSR_*/CEF3离屏_*」。
const OSR_SOURCE = [
  '包 无头渲染演示',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  '    局部 长整数型 句柄',
  '    CEF3_创建无头浏览器(1, "https://www.example.com", "", "", 1280, 720)',
  '    句柄 = CEF3无头_取浏览器句柄(1)',
  '    CEF3OSR_设置窗口外帧率(句柄, 30)',
  '    调试输出(CEF3OSR_取窗口外帧率(句柄))',
  '    CEF3OSR_请求重绘(句柄, 0)',
  '    CEF3离屏_订阅像素帧(句柄, 真)',
  '    CEF3离屏_订阅视图矩形(句柄, 真)',
  '    CEF3无头_关闭(1)',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');

const cef3OsrModule: InstalledModule = {
  manifest: BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.osr') ?? browser,
  installPath: 'builtin://lingbuilder.cef3.osr',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

function generatedConsoleMain(): string {
  const generated = generateLingCppNativeWin32Project(consoleProject(), {
    lingCppSourceCode: CONSOLE_SOURCE,
    outputKind: 'console-application',
    enabledModules: [cef3BrowserModule]
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  return generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
}

/** 切出某个成员函数的函数体（从签名到下一个同缩进签名），用于「体切片」断言。 */
function memberBody(code: string, signature: string): string {
  const start = code.indexOf(signature);
  assert.ok(start >= 0, `生成的 C++ 缺少 ${signature}`);
  const rest = code.slice(start);
  const end = rest.indexOf('\n    }');
  assert.ok(end > 0, `${signature} 的函数体不完整`);
  return rest.slice(0, end);
}

test('headless component passed as a control reference gets a named replacement diagnostic', () => {
  const basic: InstalledModule = {
    manifest: BUILTIN_MODULES.find(item => item.id === 'lingbuilder.win32.basic')!,
    installPath: 'builtin://lingbuilder.win32.basic',
    isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
  };
  const target = consoleProject();
  target.resources = [{
    id: 'cefheadless-main', type: 'CefHeadlessBrowser', name: 'CEF3无头浏览器1',
    ownerWindowId: 'main-window', instanceId: 3, url: '', cacheDir: '', proxyServer: '',
    viewWidth: 1280, viewHeight: 720, autoStart: true
  } as never];
  const context = { enabledModules: [basic], availableModules: [basic] };
  const diagnostics = getLingCppControlReferenceDiagnostics(
    '类 程序 : 公开 窗体\n事件 创建完毕()\n    控件_设置文本(CEF3无头浏览器1, "完成")\n结束\n结束类',
    target, context, 'src/MainWindow.lcpp'
  );
  const hit = diagnostics.find(item => String(item.id).includes('control-reference-headless-resource'));
  assert.ok(hit, `缺少无头组件指名诊断：${JSON.stringify(diagnostics.map(item => item.id))}`);
  assert.equal(hit!.level, 'error');
  assert.match(hit!.message, /不是控件/);
  assert.match((hit as { suggestion?: string }).suggestion || '', /CEF3无头_取页面文本\(3/, '指名替代必须给出实例编号写法');
  // 真控件仍走原有解析，不得被新分支误伤。
  const windowWithControl = consoleProject();
  windowWithControl.windows[0].controls = [{
    id: 'label-1', type: 'Label', name: '操作结果', content: '', x: 10, y: 10, width: 160, height: 28,
    fontSize: 13, background: '#202020', foreground: '#ffffff', isEnabled: true, visibility: 'Visible', events: {}
  }];
  assert.deepEqual(getLingCppControlReferenceDiagnostics(
    '类 程序 : 公开 窗体\n事件 创建完毕()\n    控件_设置文本(操作结果, "完成")\n结束\n结束类',
    windowWithControl, context, 'src/MainWindow.lcpp'
  ), []);
});

test('headless commands are declared in both contributes and bindings', () => {
  assert.equal(HEADLESS_COMMANDS.length, 18);
  const declared = new Set(browser.contributes!.commands!.map(item => item.name));
  const bound = new Set(browser.bindings!.commands!.map(item => item.command));
  for (const name of HEADLESS_COMMANDS) {
    assert.ok(declared.has(name), `contributes.commands 缺少 ${name}`);
    assert.ok(bound.has(name), `bindings.commands 缺少 ${name}`);
  }
});

test('headless commands address by instance number, never controlRef', () => {
  for (const binding of browser.bindings!.commands!) {
    if (!binding.command.startsWith('CEF3无头_') && binding.command !== 'CEF3_创建无头浏览器') continue;
    assert.equal(binding.parameters![0].name, '实例编号');
    assert.equal(binding.parameters![0].type, 'int');
    for (const parameter of binding.parameters!) {
      assert.notEqual(parameter.type, 'controlRef', `${binding.command} 的 ${parameter.name} 不应是 controlRef`);
    }
  }
});

test('headless command parameter sequences and return types match the spec table', () => {
  for (const [name, expected] of Object.entries(HEADLESS_SIGNATURES)) {
    const binding = bindingOf(name);
    const contribution = contributionOf(name);
    assert.ok(binding && contribution, `${name} 必须同时登记 binding 与 contributes`);
    assert.deepEqual(binding!.parameters!.map(item => [item.name, item.type]), expected.parameters, `${name} 参数序列不符`);
    assert.equal(binding!.returnType, expected.abi, `${name} binding 返回类型不符`);
    assert.equal(contribution!.returnType, expected.ling, `${name} contributes 返回类型不符`);
    assert.equal(contribution!.signature, `${name}(${expected.parameters.map(item => item[0]).join(', ')})`, `${name} 签名文本不符`);
    assert.ok(contribution!.insertText!.includes(`${name}(`), `${name} 的 insertText 必须以本命令调用为主体`);
    // 实例编号是裸整数：范本里绝不允许出现 命令("1"… 这种把编号写成文本的用法。
    assert.doesNotMatch(contribution!.insertText!, new RegExp(`${name}\\("`), `${name} 的 insertText 把实例编号写成了字符串`);
    // 含 wideString 参数或 wideString 返回值的命令必须声明 wide 编码（与既有 CEF3 实例版命令同口径）。
    const needsWide = expected.parameters.some(item => item[1] === 'wideString') || expected.abi === 'wideString';
    assert.equal(binding!.encoding, needsWide ? 'wide' : undefined, `${name} 的 encoding 口径不符`);
  }
});

test('headless command parameters all carry Chinese docs, including the new viewport ones', () => {
  for (const name of HEADLESS_COMMANDS) {
    for (const parameter of bindingOf(name)!.parameters ?? []) {
      assert.ok((parameter.description || '').trim().length > 8, `${name} 的 ${parameter.name} 缺中文说明`);
    }
  }
  const viewportWidth = bindingOf('CEF3无头_设置视口')!.parameters![1];
  assert.match(viewportWidth.description!, /视口|渲染尺寸/u);
  assert.match(viewportWidth.description!, /正整数/u);
  // 「实例编号」在 CEF3 无头语境下必须是本引擎的实例编号，不得只写 EdgeView 口径。
  assert.match(bindingOf('CEF3无头_执行JS')!.parameters![0].description!, /无头/u);
  // 阻塞类命令的超时口径（默认值与超时后的返回值）必须写清，禁止无限等待。
  assert.match(bindingOf('CEF3无头_等待加载完成')!.parameters![1].description!, /超时/u);
  assert.match(bindingOf('CEF3无头_取页面文本')!.parameters![1].description!, /空文本/u);
});

test('CEF3无头_取主框架 returns a managed frame handle', () => {
  const binding = bindingOf('CEF3无头_取主框架')!;
  assert.equal(binding.returnType, 'longLong');
  const contribution = contributionOf('CEF3无头_取主框架')!;
  assert.equal(contribution.returnType, '长整数型');
  assert.match(contribution.description, /CEF3框架_|CEF3填表_|CEF3DOM_/);
});

test('the two headless handle exits keep distinct roles and never fold together', () => {
  const browserHandle = contributionOf('CEF3无头_取浏览器句柄')!;
  const mainFrame = contributionOf('CEF3无头_取主框架')!;
  assert.equal(browserHandle.returnType, '长整数型');
  // 浏览器句柄 = 浏览器级 OSR 命令入口（Task 10），且必须写明「运行时托管、用户不得释放」。
  assert.match(browserHandle.description, /CEF3OSR_/);
  assert.match(browserHandle.description, /CEF3离屏_/);
  assert.match(browserHandle.description, /不得释放|不要释放|无需释放/);
  assert.doesNotMatch(browserHandle.description, /CEF3填表_|CEF3DOM_/);
  // 主框架句柄 = 页面内容/填表/DOM 路线，不得被写成 OSR 帧命令入口。
  assert.match(mainFrame.description, /CEF3填表_|CEF3DOM_|CEF3框架_/);
  assert.doesNotMatch(mainFrame.description, /CEF3OSR_|CEF3离屏_/);
});

test('headless descriptions state the reviewed runtime semantics', () => {
  // 视口读的是 CEF 实际渲染尺寸（OnPaint 会把真实出帧尺寸回写进存储视口），不是用户设定值。
  assert.match(contributionOf('CEF3无头_取视口JSON')!.description, /实际渲染尺寸|实际渲染/u);
  assert.doesNotMatch(contributionOf('CEF3无头_取视口JSON')!.description, /即你设置的|等于创建时传入/u);
  // 设置视口：刷新未确认时仍按「视口已写入，但刷新未确认」对外表述，不得只报失败。
  assert.match(contributionOf('CEF3无头_设置视口')!.description, /视口已写入，但刷新未确认/);
  // 控制台项目派发不了事件处理器，等待一律 50ms 轮询且不得依赖消息泵。
  const wait = contributionOf('CEF3无头_等待加载完成')!.description;
  assert.match(wait, /轮询/);
  assert.match(wait, /消息泵|不依赖.*泵/u);
  // 创建命令必须说清「不产生任何窗口」与一期无截图。
  const create = contributionOf('CEF3_创建无头浏览器')!.description;
  assert.match(create, /不创建窗口|不产生任何窗口|无窗口/u);
  assert.match(create, /截图/);
  assert.match(create, /CEF3_枚举实例JSON/);
  assert.match(create, /windowless/);
});

test('headless wait gates on browser-object readiness, not on IsLoading alone', () => {
  const code = generatedConsoleMain();
  // 根因回归：桥把创建投递到 CEF UI 线程，浏览器对象没建好时 LB_CEF3_BrowserIsLoading 也返回 0，
  // 只轮询加载状态会让等待瞬间成功，后续取标题/执行JS 全读到空文本（真机冒烟退出码 14）。
  const readiness = memberBody(code, 'int CEF3_浏览器对象已就绪(CefBrowserInstance* instance)');
  assert.match(readiness, /LB_CEF3_BrowserIsValid\(/, '就绪判定必须正向问 CEF 的 IsValid');
  assert.doesNotMatch(readiness, /BrowserIsLoading/, '就绪判定不得复用「未加载中」当「已创建」');
  const wait = memberBody(code, HEADLESS_RUNTIME_SIGNATURES['CEF3无头_等待加载完成']);
  const readyAt = wait.indexOf('CEF3_浏览器对象已就绪(');
  const documentAt = wait.indexOf('CEF3_页面已有文档(');
  const loadingAt = wait.indexOf('CEF3_是否加载中_按实例(');
  assert.ok(readyAt >= 0, '等待加载完成必须先等浏览器对象就绪');
  assert.ok(documentAt > readyAt, '就绪之后必须再确认主文档已提交');
  assert.ok(loadingAt > readyAt, '加载状态轮询必须排在就绪判定之后');
  // 桥句柄从 0xCEF3000000000001 起发，每个合法句柄按 int64 看都是负数：
  // 句柄转换只要出现 > 0 判定，整条 CEF3框架_*/CEF3填表_*/CEF3DOM_* 链就会恒失败（真机实测）。
  const frameCast = memberBody(code, 'static LB_CEF3_HANDLE CEF3_框架句柄(long long frameHandle)');
  assert.match(frameCast, /frameHandle != 0/, 'CEF3_框架句柄 只能判 0');
  assert.doesNotMatch(frameCast, /frameHandle > 0/, 'CEF3_框架句柄 不得按正数过滤句柄（合法句柄恒为负）');
  // 主框架挑选必须显式比 1：桥在句柄解析失败时返回负数错误码，真值判断会把失败当命中。
  assert.match(memberBody(code, 'long long CEF3_取主框架_按实例(CefBrowserInstance* instance)'), /LB_CEF3_FrameIsMain\(frame\) == 1/);
  // 命令说明要把「负数句柄」和「两段等待」讲给外部 AI。
  assert.match(contributionOf('CEF3无头_取主框架')!.description, /!= 0/);
  assert.match(contributionOf('CEF3无头_取浏览器句柄')!.description, /!= 0/);
  // 两段各有中文诊断，且共用同一个总超时（不得退化成无界等待）。
  assert.match(wait, /浏览器在给定毫秒数内仍未创建完成/);
  assert.match(wait, /页面在给定毫秒数内仍未加载结束/);
  assert.equal((wait.match(/GetTickCount64\(\) - started >= static_cast<ULONGLONG>\(deadline\)/g) ?? []).length, 2);
  // 命令说明必须把这条红线讲给外部 AI：是否加载中 返回 0 不等于浏览器已建好。
  assert.match(contributionOf('CEF3无头_是否加载中')!.description, /尚未创建|还没创建|不能.*判据/);
  assert.match(contributionOf('CEF3无头_等待加载完成')!.description, /主文档已提交/);
});

test('queued navigation is flushed from one place and does not depend on the event edge alone', () => {
  const code = generatedConsoleMain();
  // 排队补发只允许一份实现：置位 + 下发 + 清空都在 CEF3_补发排队导航 里，事件与就绪轮询都调它。
  const flush = memberBody(code, 'void CEF3_补发排队导航(CefBrowserInstance& instance)');
  assert.match(flush, /instance\.bridgeReady = true;/);
  assert.match(flush, /instance\.pendingNavigation\.clear\(\);/);
  assert.equal((code.match(/pendingNavigation\.clear\(\)/g) ?? []).length, 1, '排队导航补发必须收口成一份实现');
  // 创建点不得预置 bridgeReady（预置会让排队分支永不生效，创建后立刻导航必然失败）。
  const create = memberBody(code, 'int CEF3_创建无头浏览器(int instanceId, const wchar_t* address, const wchar_t* cacheDirectory,');
  assert.doesNotMatch(create, /bridgeReady = true/, '无头创建不得预置 bridgeReady');
  assert.match(create, /instance->created = true;/);
  for (const signature of [
    'int CEF3_创建弹窗浏览器(int instanceId, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer)',
    'int CEF3_创建区域(int instanceId, int left, int top, int width, int height, const wchar_t* address, const wchar_t* cacheDirectory, const wchar_t* proxyServer)'
  ]) {
    assert.doesNotMatch(memberBody(code, signature), /bridgeReady = true/, `${signature.split('(')[0]} 不得预置 bridgeReady`);
  }
  // 就绪判定自带补发：事件先到/登记先到都能收敛，导航走同一个就绪出口。
  assert.match(memberBody(code, 'int CEF3_浏览器对象已就绪(CefBrowserInstance* instance)'), /CEF3_补发排队导航\(\*instance\)/);
  assert.match(memberBody(code, 'int CEF3_导航_按实例(CefBrowserInstance* instance, const wchar_t* address)'), /CEF3_浏览器对象已就绪\(instance\)/);
  assert.match(
    memberBody(code, 'void CEF3_处理Bridge事件(const LB_CEF3_EVENT_PACKET_V3& packet, LB_CEF3_EVENT_RESPONSE_V3* response) {'),
    /浏览器创建完成.*CEF3_补发排队导航\(instance\);/
  );
});

test('every headless runtime wrapper exists in generated C++ and resolves by instance number', () => {
  const code = generatedConsoleMain();
  for (const [command, signature] of Object.entries(HEADLESS_RUNTIME_SIGNATURES)) {
    assert.ok(code.includes(`${signature} {`), `生成的 C++ 缺少 ${command} -> ${signature}`);
    if (command === 'CEF3_创建无头浏览器') continue;
    const body = memberBody(code, signature);
    assert.ok(body.includes('CEF3_查找无头实例(instanceId)'), `${command} 必须按实例编号解析实例`);
    for (const banned of ['hwnd_', 'CreateWindowExW', 'ShowWindow', 'SetWindowPos', 'reinterpret_cast']) {
      assert.ok(!body.includes(banned), `${command} 的无头包装不得出现 ${banned}`);
    }
    // 每条包装的失败路径都要有中文诊断，不得静默返回。
    assert.match(body, /调试输出\(L"CEF3 /, `${command} 缺少中文失败诊断`);
  }
  assert.match(code, /int CEF3_创建无头浏览器\(int instanceId, const wchar_t\* address, const wchar_t\* cacheDirectory,/);
});

test('headless wrappers reuse the control-path cores instead of duplicating JS and source logic', () => {
  const code = generatedConsoleMain();
  // 任务轮询只允许有一份实现：CEF 侧没有 TaskWait 导出，控件版与无头版共用同一个等待核心。
  assert.equal(code.match(/while \(\(status == LB_CEF3_TASK_PENDING \|\| status == LB_CEF3_TASK_RUNNING\)/g)?.length ?? 0, 1,
    'CEF3 任务轮询必须收口成一份核心');
  assert.match(code, /static std::wstring CEF3_任务等待文本\(LB_CEF3_TASK_HANDLE task/);
  const sharedCores: Array<[string, string[]]> = [
    ['CEF3_执行JS_按实例', ['std::wstring CEF3_执行JS(const wchar_t* controlName, const wchar_t* script)', 'std::wstring CEF3无头_执行JS(int instanceId, const wchar_t* script)']],
    ['CEF3_取主框架_按实例', ['long long CEF3框架_取主框架(const wchar_t* controlName)', 'long long CEF3无头_取主框架(int instanceId)']],
    ['CEF3_导航_按实例', ['int CEF3_导航(const wchar_t* controlName, const wchar_t* address)', 'int CEF3无头_导航(int instanceId, const wchar_t* address)']],
    ['CEF3_取标题_按实例', ['std::wstring CEF3_取标题(const wchar_t* controlName)', 'std::wstring CEF3无头_取标题(int instanceId)']],
    ['CEF3_取地址_按实例', ['std::wstring CEF3_取地址(const wchar_t* controlName)', 'std::wstring CEF3无头_取地址(int instanceId)']],
    ['CEF3_是否加载中_按实例', ['int CEF3_是否加载中(const wchar_t* controlName)', 'int CEF3无头_是否加载中(int instanceId)']]
  ];
  for (const [core, callers] of sharedCores) {
    assert.ok(code.includes(`${core}(`), `缺少共享核心 ${core}`);
    for (const caller of callers) {
      assert.ok(code.includes(`${caller} {`), `缺少调用方 ${caller}`);
      const body = memberBody(code, caller);
      assert.ok(body.includes(`${core}(`), `${caller.split('(')[0]} 必须复用 ${core}`);
    }
  }
  // 释放配对只允许有一份实现（共享核心内）。桥专属分支在「只用桥、无 CAPI 头」的产物里会被整体裁掉，
  // 因此只数「浏览器句柄关闭+释放」这一对的出现次数：有人再抄一遍就会变成 2。
  assert.equal(
    (code.match(/LB_CEF3_BrowserClose\((?:instance|it->second|found->second)->bridgeHandle, 1\)[\s\S]{0,120}?LB_CEF3_HandleRelease\((?:instance|it->second|found->second)->bridgeHandle\)/g) ?? []).length,
    1,
    '浏览器句柄的关闭+释放配对必须收口在 CEF3_释放实例桥接资源 一处'
  );
  assert.ok(code.includes('CEF3_释放实例桥接资源(*instance)'), '无头版关闭必须调用共享释放核心');
  // 取页面文本/源码共用一个「取框架文本」辅助，由它调框架异步任务 + 同一轮询核心；
  // 断言必须沿这条委托链验，否则会把「多一层共享辅助」误判成重复实现。
  for (const command of ['CEF3无头_取页面文本', 'CEF3无头_取页面源码']) {
    assert.match(
      memberBody(code, HEADLESS_RUNTIME_SIGNATURES[command]),
      /CEF3_无头取框架文本\(/,
      `${command} 必须委托共享的框架文本/源码辅助`
    );
  }
  const frameTextCore = memberBody(code, 'std::wstring CEF3_无头取框架文本(');
  assert.match(frameTextCore, /CEF3框架_取文本异步\(/);
  assert.match(frameTextCore, /CEF3框架_取源码异步\(/);
  assert.match(frameTextCore, /CEF3_任务等待文本\(/);
});

test('headless viewport and frame counters go through the OSR bridge exports', () => {
  const code = generatedConsoleMain();
  assert.match(code, /LB_CEF3_BrowserSetOsrViewport\(/);
  assert.match(code, /LB_CEF3_BrowserGetOsrViewport\(/);
  assert.match(code, /LB_CEF3_BrowserGetOsrPaintCount\(/);
  // 视口 JSON 形状固定 width/height/paintCount；失败时转述桥给出的中文原因，不得凭空造文案。
  const viewportJson = memberBody(code, HEADLESS_RUNTIME_SIGNATURES['CEF3无头_取视口JSON']);
  for (const key of ['width', 'height', 'paintCount']) {
    assert.ok(viewportJson.includes(`L"${key}"`), `取视口JSON 缺少字段 ${key}`);
  }
  // 失败原因统一走 CEF3_拼接桥接原因 这个共享出口，因此这里验的是整条链：
  // 取视口JSON 调用共享出口，而共享出口内部真的读桥的中文最后错误。
  assert.match(viewportJson, /CEF3_拼接桥接原因\(/);
  assert.match(
    memberBody(code, 'std::wstring CEF3_拼接桥接原因('),
    /CEF3_桥接错误文本\(\)/,
    'CEF3_拼接桥接原因 必须转述桥给出的中文最后错误'
  );
  // 读最后错误只允许一次带缓冲调用：空缓冲探长度会把 g_last_error 覆盖成「输出缓冲区不足」，
  // 真实中文原因就再也读不到（真机冒烟曾把 Frame 读取失败误诊成缓冲区问题）。
  const errorText = memberBody(code, 'static std::wstring CEF3_桥接错误文本(');
  assert.equal((errorText.match(/LB_CEF3_GetLastError\(/g) ?? []).length, 1, 'CEF3_桥接错误文本 只允许单次读取最近错误');
  assert.doesNotMatch(errorText, /LB_CEF3_GetLastError\(nullptr/, '不得用空缓冲探测最近错误长度');
  // 设置视口：写入选定视口后宿主重查失败时，回读确认视口已生效仍算成功。
  const setViewport = memberBody(code, HEADLESS_RUNTIME_SIGNATURES['CEF3无头_设置视口']);
  assert.match(setViewport, /视口已写入，但刷新未确认/);
  assert.match(setViewport, /CEF3_BrowserGetOsrViewport\(/);
});

test('headless bridge events are buffered instead of dropped by the window-only dispatcher', () => {
  const code = generatedConsoleMain();
  assert.match(code, /std::deque<std::wstring> headlessEvents;/);
  assert.match(code, /std::mutex headlessEventsMutex;/);
  const handler = memberBody(code, 'void CEF3_处理Bridge事件(const LB_CEF3_EVENT_PACKET_V3& packet, LB_CEF3_EVENT_RESPONSE_V3* response) {');
  const recordAt = handler.indexOf('CEF3_记录无头事件(');
  const dispatchAt = handler.indexOf('CEF3_发送事件(eventPacket)');
  assert.ok(recordAt >= 0, '无头事件必须写入实例缓冲');
  assert.ok(dispatchAt > recordAt, '无头分支必须在窗口派发之前 return，否则事件被 hwnd_ 判空丢弃');
  // 缓冲有界：超上限丢最旧。
  assert.match(code, /CEF3_无头事件上限 = 200;/);
  assert.match(code, /headlessEvents\.pop_front\(\)/);
  const eventsJson = memberBody(code, HEADLESS_RUNTIME_SIGNATURES['CEF3无头_取事件JSON']);
  assert.match(eventsJson, /headlessEvents/);
  assert.match(eventsJson, /CEF3_无头事件锁\(\)|headlessEventsMutex/);
});

test('headless commands translate into real generated calls without unknown-command diagnostics', () => {
  const code = generatedConsoleMain();
  assert.match(code, /CEF3_创建无头浏览器\(1, L"https:\/\/www\.example\.com", L"\.cef3\/headless-1", L"", 1280, 720\);/);
  assert.match(code, /CEF3无头_等待加载完成\(1, 15000\);/);
  assert.match(code, /CEF3无头_设置视口\(1, 1024, 640\);/);
  assert.match(code, /CEF3无头_取主框架\(1\);/);
  assert.match(code, /CEF3无头_执行JS\(1, L"document\.title"\)/);
});

// ── Task 10：lingbuilder.cef3.osr —— CEF 官方 OSR 接口首批（按浏览器句柄寻址） ──
// 命令名与 scripts/generate-cef3-api-coverage.cjs 的权威映射表逐字一致，改名必须两处同改。
const OSR_COMMANDS: Record<string, {
  parameters: Array<[string, 'longLong' | 'int' | 'bool']>;
  runtime: string;
  bridgeExport: string;
}> = {
  'CEF3OSR_请求重绘': {
    parameters: [['浏览器句柄', 'longLong'], ['元素类型', 'int']],
    runtime: 'int CEF3OSR_请求重绘(long long browserHandle, int paintElementType)',
    bridgeExport: 'LB_CEF3_BrowserInvalidate'
  },
  'CEF3OSR_设置窗口外帧率': {
    parameters: [['浏览器句柄', 'longLong'], ['帧率', 'int']],
    runtime: 'int CEF3OSR_设置窗口外帧率(long long browserHandle, int frameRate)',
    bridgeExport: 'LB_CEF3_BrowserSetWindowlessFrameRate'
  },
  'CEF3OSR_取窗口外帧率': {
    parameters: [['浏览器句柄', 'longLong']],
    runtime: 'int CEF3OSR_取窗口外帧率(long long browserHandle)',
    bridgeExport: 'LB_CEF3_BrowserGetWindowlessFrameRate'
  },
  'CEF3离屏_订阅像素帧': {
    parameters: [['浏览器句柄', 'longLong'], ['是否订阅', 'bool']],
    runtime: 'int CEF3离屏_订阅像素帧(long long browserHandle, bool enabled)',
    bridgeExport: 'LB_CEF3_RenderHandlerSubscribePaint'
  },
  'CEF3离屏_订阅视图矩形': {
    parameters: [['浏览器句柄', 'longLong'], ['是否订阅', 'bool']],
    runtime: 'int CEF3离屏_订阅视图矩形(long long browserHandle, bool enabled)',
    bridgeExport: 'LB_CEF3_RenderHandlerSubscribeViewRect'
  }
};

const osrModule = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.osr');

function generatedOsrMain(): string {
  const generated = generateLingCppNativeWin32Project(consoleProject(), {
    lingCppSourceCode: OSR_SOURCE,
    outputKind: 'console-application',
    enabledModules: [cef3BrowserModule, cef3OsrModule]
  });
  assert.deepEqual(generated.blockingDiagnostics, []);
  return generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
}

test('cef3 osr module exposes the headless-relevant official interfaces', () => {
  assert.ok(osrModule, '缺少 lingbuilder.cef3.osr 模块');
  // 版本必须与其余 CEF3 子模块同源（同一个 CEF3_ALPHA_VERSION）：子模块之间互相声明依赖，单独漂一个版本号会让依赖下限失真。
  assert.equal(osrModule!.version, BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.events')!.version,
    'osr 版本必须与其他 CEF3 子模块一致');
  assert.deepEqual(osrModule!.targets.map(item => item.id), ['windows-msvc-x64']);
  assert.deepEqual(osrModule!.dependencies?.map(item => item.moduleId), ['lingbuilder.cef3.browser']);
  const declared = osrModule!.contributes!.commands!.map(item => item.name);
  for (const name of Object.keys(OSR_COMMANDS)) {
    assert.ok(declared.includes(name), `缺少命令 ${name}`);
  }
  assert.equal(declared.length, Object.keys(OSR_COMMANDS).length, '首批只登记无头链路真正需要的 5 条');
  assert.equal(osrModule!.contributes!.commands!.length, osrModule!.bindings!.commands!.length, 'contributes 与 bindings 条数必须一致');
  for (const [name, shape] of Object.entries(OSR_COMMANDS)) {
    const contribution = osrModule!.contributes!.commands!.find(item => item.name === name)!;
    const binding = osrModule!.bindings!.commands!.find(item => item.command === name)!;
    assert.equal(contribution.visibility, 'advanced', `${name} 属于高级命令，不得进默认补全`);
    assert.deepEqual(binding.parameters.map(item => [item.name, item.type]), shape.parameters, `${name} 参数序必须与运行时无参序一致`);
    assert.equal(binding.runtimeName, name, `${name} binding 必须指向中文运行时代码`);
    for (const parameter of binding.parameters) {
      assert.ok((parameter.description || '').trim(), `${name}::${parameter.name} 缺少中文参数说明`);
    }
    // 句柄红线：桥句柄按 int64 看恒为负数，说明里必须写清「!= 0」，否则外部 AI 会写 > 0。
    assert.match(binding.parameters[0].description || '', /CEF3无头_取浏览器句柄/u, `${name}::浏览器句柄 必须说明取句柄入口`);
    assert.match(binding.parameters[0].description || '', /!= 0/u, `${name}::浏览器句柄 必须给出 != 0 判据`);
  }
  assert.match(declared.includes('CEF3离屏_订阅像素帧')
    ? osrModule!.contributes!.commands!.find(item => item.name === 'CEF3离屏_订阅像素帧')!.description!
    : '', /一期不外发帧内容/u, '像素帧订阅必须写明取不到画面，防止对外承诺截图');
});

test('cef3 osr module is registered in the CEF3 family as an advanced feature', () => {
  const feature = CEF3_MODULE_FAMILY.features.find(item => item.moduleId === 'lingbuilder.cef3.osr');
  assert.ok(feature, 'CEF3 模块家族缺少无头渲染入口');
  assert.equal(feature!.tier, 'advanced', 'OSR 官方接口必须单独确认启用，不随主模块一键启用');
});

test('cef3 osr commands have real runtime implementations that call the bridge exports', () => {
  const code = generatedOsrMain();
  for (const [name, shape] of Object.entries(OSR_COMMANDS)) {
    const body = memberBody(code, shape.runtime);
    // 只调真实桥导出，禁止在生成器里另起一套 CEF CAPI 直连。
    assert.ok(body.includes(`${shape.bridgeExport}(`), `${name} 必须调用 ${shape.bridgeExport}`);
    assert.match(body, /browserHandle == 0/, `${name} 必须先判空句柄`);
    assert.doesNotMatch(body, /browserHandle > 0|browserHandle >= 0/, `${name} 不得用正数判句柄有效（受管句柄为负数）`);
    // 启用 CEF3 浏览器模块时生成器会把宏分支静态收敛掉，这里必须落到真实现，而不是「未启用桥」的兜底。
    assert.doesNotMatch(body, /当前构建未启用 CEF3 桥/u, `${name} 在桥可用形态下不得保留兜底分支`);
  }
  // 订阅像素帧的运行时诊断也必须重复「帧内容不外发」，否则用户从 exe 侧得到相反预期。
  assert.match(memberBody(code, OSR_COMMANDS['CEF3离屏_订阅像素帧'].runtime), /一期不外发帧内容/u);

  // 未启用 CEF3 浏览器模块时不做宏收敛，5 条命令都必须保留桥可用性守卫与中文兜底（否则无桥构建链接不过）。
  const unguarded = generateLingCppNativeWin32Project(consoleProject(), {
    lingCppSourceCode: '包 无桥校验\n\n类 程序\n公开\n  整数型 启动()\n    调试输出(\"x\")\n    返回 (0)\n  结束\n结束类\n',
    outputKind: 'console-application',
    enabledModules: []
  });
  const bridgeOptional = unguarded.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const shape of Object.values(OSR_COMMANDS)) {
    const start = bridgeOptional.indexOf(shape.runtime);
    assert.ok(start >= 0, `未启用模块的生成结果同样缺少 ${shape.runtime}`);
    const body = bridgeOptional.slice(start, start + 1200);
    assert.match(body, /#if LINGBUILDER_CEF3_BRIDGE_AVAILABLE/, `${shape.runtime} 必须带桥可用性守卫`);
    assert.match(body, /#else[\s\S]*当前构建未启用 CEF3 桥/u, `${shape.runtime} 必须有中文兜底分支`);
  }
});

test('cef3 osr commands translate into real generated calls', () => {
  const code = generatedOsrMain();
  assert.match(code, /CEF3OSR_设置窗口外帧率\(句柄, 30\);/u);
  assert.match(code, /CEF3OSR_取窗口外帧率\(句柄\)/u);
  assert.match(code, /CEF3OSR_请求重绘\(句柄, 0\);/u);
  assert.match(code, /CEF3离屏_订阅像素帧\(句柄, true\)/u);
  assert.match(code, /CEF3离屏_订阅视图矩形\(句柄, true\)/u);
});

// 首帧交付晚于「加载完成」（真机实测窗口项目约半秒），所以等待出帧必须自带超时，
// 并且等待期间要主动请求重绘 —— 无窗口浏览器没有宿主可见性变化来催帧。
test('the first-frame wait is bounded and kicks the render pipeline', () => {
  const code = generatedConsoleMain();
  const body = memberBody(code, HEADLESS_RUNTIME_SIGNATURES['CEF3无头_等待出帧']);
  assert.match(body, /LB_CEF3_BrowserGetOsrPaintCount\(/);
  assert.match(body, /LB_CEF3_BrowserInvalidate\(/, '等待期间必须周期性请求重绘');
  assert.match(body, /timeoutMilliseconds > 0 \? timeoutMilliseconds : 10000/);
  assert.equal((body.match(/GetTickCount64\(\) - started >=/g) ?? []).length, 2, '一次超时判定 + 一次重绘节流判定');
  assert.match(body, /当前帧数=/);
  assert.match(code, /调试输出\(CEF3无头_等待出帧\(1, 8000\)\);/);
});
