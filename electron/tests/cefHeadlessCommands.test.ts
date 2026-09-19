import test from 'node:test';
import assert from 'node:assert/strict';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

// CEF3 真无头（CEF 官方 windowless / OSR）中文命令面：17 条命令全部按「实例编号」寻址，
// 不产生任何窗口，也不接受 controlRef。清单与 binding 必须成对（AGENTS 模块生态规则）。
const HEADLESS_COMMANDS = [
  'CEF3_创建无头浏览器', 'CEF3无头_是否已创建', 'CEF3无头_设置视口', 'CEF3无头_取视口JSON',
  'CEF3无头_取渲染帧数', 'CEF3无头_导航', 'CEF3无头_是否加载中', 'CEF3无头_等待加载完成',
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
// 这里额外用一份「真调用」源码验证 17 条命令的调用翻译（启用 CEF3 浏览器模块）。
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

test('headless commands are declared in both contributes and bindings', () => {
  assert.equal(HEADLESS_COMMANDS.length, 17);
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
