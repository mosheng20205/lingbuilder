import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { CDP_CLIENT_COMMAND_SPECS, CDP_CLIENT_MODULE } from '../src/services/modules/cdpClientModule';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { InstalledModule } from '../src/services/modules/types';
import { LingWindowProject } from '../src/services/windowDesigner/types';

const cdpModule: InstalledModule = {
  manifest: CDP_CLIENT_MODULE,
  installPath: 'builtin://lingbuilder.cdp.client',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

const newEmojiModule: InstalledModule = {
  manifest: {
    schemaVersion: 2,
    id: 'lingbuilder.new_emoji.ui',
    name: 'new_emoji 原生界面库',
    version: '1.0.0',
    category: '界面',
    description: 'CDP 客户端双后端测试模块。',
    targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
  },
  installPath: 'builtin://lingbuilder.new_emoji.ui',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

const project: LingWindowProject = {
  id: 'cdp-client-runtime-test',
  name: 'CDP 客户端运行时测试',
  windows: [{
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: 'MainWindow',
    title: 'CDP 客户端测试',
    width: 640,
    height: 480,
    background: '#202020',
    description: 'CDP 客户端双后端生成测试。',
    controls: []
  }]
};

const source = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        局部 CDP连接 浏览器A = CDP_连接("http://127.0.0.1:9222", &连接就绪)',
  '        局部 CDP连接 浏览器B = CDP_连接("http://127.0.0.1:9333", &连接就绪)',
  '        调试输出(到文本(CDP_取连接数量()))',
  '        CDP_设置命令超时(浏览器A, 60000)',
  '    结束',
  '    事件 连接就绪()',
  '        局部 CDP连接 浏览器A = CDP_取当前连接()',
  '        局部 CDP页面 页面 = CDP_新建页面(浏览器A, "https://example.com", &页面就绪)',
  '    结束',
  '    事件 页面就绪()',
  '        局部 CDP页面 页面 = CDP_取当前页面()',
  '        CDP_执行脚本(页面, "document.title", &脚本完成)',
  '        CDP元素 按钮 = CDP_查询元素(页面, "#submit")',
  '        CDP_点击元素(按钮, &点击完成)',
  '        CDP_截图(页面, "screenshot.png", 假, &截图完成)',
  '        CDP_绑定对话框事件(页面, &对话框出现)',
  '        CDP_绑定下载事件(CDP_取当前连接(), &下载事件)',
  '        CDP_拦截开始(页面, "*://api.example.com/*", &请求被拦截)',
  '        CDP_等待加载(页面, 2, 30, &等待完成)',
  '        CDP_设置视口(页面, 1280, 720)',
  '        CDP_设置暗色模式(页面, 真)',
  '        CDP_设置离线(页面, 真)',
  '        CDP_鼠标拖拽(页面, 10, 10, 100, 100, 5)',
  '    结束',
  '    事件 请求被拦截()',
  '        CDP_拦截继续(CDP_取当前拦截())',
  '    结束',
  '    事件 对话框出现()',
  '        CDP_应答对话框(CDP_取当前页面(), 真, "")',
  '    结束',
  '    事件 脚本完成()',
  '        调试输出(CDP_取当前事件文本())',
  '    结束',
  '    事件 点击完成()',
  '        如果 (CDP_取当前事件类型() == "命令失败")',
  '            调试输出(CDP_取当前错误())',
  '        如果结束',
  '    结束',
  '    事件 截图完成()',
  '    结束',
  '    事件 等待完成()',
  '    结束',
  '    事件 下载事件()',
  '    结束',
  '结束类'
].join('\n');

function generate(enabledModules: InstalledModule[], designerBackend?: 'new-emoji') {
  const currentProject = designerBackend
    ? { ...project, id: `${project.id}-new-emoji`, windows: project.windows.map(window => ({ ...window, designerBackend })) }
    : project;
  return generateLingCppNativeWin32Project(currentProject, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    enabledModules
  });
}

test('CDP 客户端模块清单、文档与命令完整性', async () => {
  assert.equal(validateModuleManifest(CDP_CLIENT_MODULE).diagnostics.length, 0);
  assert.equal(CDP_CLIENT_COMMAND_SPECS.length, 144);
  assert.equal(CDP_CLIENT_MODULE.version, '3.0.0');
  assert.deepEqual(
    CDP_CLIENT_MODULE.bindings?.commands?.map(item => item.command),
    CDP_CLIENT_MODULE.contributes?.commands?.map(item => item.name)
  );
  for (const name of ['CDP_连接', 'CDP_连接远程', 'CDP_断开连接', 'CDP_取连接数量', 'CDP_附加页面', 'CDP_新建页面', 'CDP_打开网址', 'CDP_执行脚本', 'CDP_查询元素', 'CDP_点击元素', 'CDP_输入文本', 'CDP_鼠标单击', 'CDP_按键', 'CDP_组合键', 'CDP_绑定网络事件', 'CDP_取网络响应体', 'CDP_取Cookie', 'CDP_置Cookie', 'CDP_绑定控制台事件', 'CDP_绑定页面异常', 'CDP_截图', 'CDP_打印PDF', 'CDP_绑定连接事件', 'CDP_绑定页面事件', 'CDP_取当前事件类型', 'CDP_取当前事件文本', 'CDP_取当前错误', 'CDP_取当前页面',
    // 阶段 2：超时与 Fetch 拦截
    'CDP_设置命令超时', 'CDP_拦截开始', 'CDP_拦截继续', 'CDP_拦截改写', 'CDP_拦截模拟响应', 'CDP_拦截终止', 'CDP_拦截应答认证', 'CDP_取拦截请求体', 'CDP_拦截停止',
    // 阶段 2：对话框、下载、上传、等待
    'CDP_绑定对话框事件', 'CDP_应答对话框', 'CDP_取当前对话框消息', 'CDP_设置下载目录', 'CDP_绑定下载事件', 'CDP_取当前下载文件名', 'CDP_取当前下载进度', 'CDP_取当前拦截', 'CDP_设置元素文件', 'CDP_等待加载',
    // 阶段 2：仿真
    'CDP_设置视口', 'CDP_设置UserAgent', 'CDP_设置触摸', 'CDP_设置地理位置', 'CDP_设置时区', 'CDP_设置语言', 'CDP_设置暗色模式', 'CDP_设置CPU节流', 'CDP_重置仿真', 'CDP_设置离线', 'CDP_设置限速', 'CDP_禁用缓存',
    // 阶段 2：截图元素、窗口、弹窗、拖拽
    'CDP_截图元素', 'CDP_取窗口边界', 'CDP_设置窗口边界', 'CDP_绑定新页面事件', 'CDP_鼠标拖拽', 'CDP_调用函数',
    // 阶段 3：Target/session/binding/Debugger/Storage/录制
    'CDP_设置自动附加', 'CDP_绑定目标事件', 'CDP_枚举目标JSON', 'CDP_附加目标', 'CDP_分离会话', 'CDP_会话执行脚本', 'CDP_取目标JSON', 'CDP_取会话JSON', 'CDP_枚举帧JSON',
    'CDP_添加页面绑定', 'CDP_移除页面绑定', 'CDP_高亮元素', 'CDP_隐藏高亮', 'CDP_派发触摸',
    'CDP_启用调试器', 'CDP_禁用调试器', 'CDP_绑定调试事件', 'CDP_设置断点', 'CDP_移除断点', 'CDP_暂停调试', 'CDP_恢复调试', 'CDP_调试单步', 'CDP_取当前调用帧数量', 'CDP_取当前调用帧', 'CDP_取调用帧JSON', 'CDP_调用帧执行脚本', 'CDP_取作用域变量',
    'CDP_取性能指标', 'CDP_取存储用量', 'CDP_清理来源数据', 'CDP_开启证书错误接管', 'CDP_裁决证书错误', 'CDP_关闭证书错误接管', 'CDP_绑定安全状态事件', 'CDP_开始录制', 'CDP_记录步骤', 'CDP_停止录制', 'CDP_加载回放', 'CDP_取录制状态', 'CDP_取回放状态']) {
    assert.ok(CDP_CLIENT_COMMAND_SPECS.some(item => item.name === name), `缺少命令 ${name}`);
  }
  const documentationPath = path.resolve(process.cwd(), 'docs/modules/cdp-client/README.md');
  const documentation = await fs.readFile(documentationPath, 'utf8');
  assert.ok(documentation.includes('CDP_连接'));
  assert.ok(documentation.includes('WinHTTP'));
  assert.ok(documentation.includes('--remote-debugging-port'));
  assert.ok(documentation.includes('CDP_拦截开始'), '模块文档缺少阶段 2 拦截说明');
  assert.ok(documentation.includes('CDP_应答对话框'), '模块文档缺少阶段 2 对话框说明');
  // 全部异步命令必须使用 &处理器名 引用语法。
  for (const spec of CDP_CLIENT_COMMAND_SPECS) {
    for (const parameter of spec.parameters) {
      if (parameter.type === 'handler') {
        assert.ok(parameter.handlerSignature, `${spec.name} 的 handler 参数缺少 handlerSignature`);
        assert.deepEqual(parameter.handlerSignature?.parameterTypes, [], `${spec.name} 的处理器必须无参数`);
      }
    }
  }
});

test('Win32 CDP 客户端生成多连接 runtime、会话路由与处理器引用', () => {
  const generated = generate([cdpModule]);
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('class LingCdpRuntime'));
  assert.ok(mainCpp.includes('namespace LingCdpJson'));
  assert.ok(mainCpp.includes('WinHttpWebSocketCompleteUpgrade'));
  assert.ok(mainCpp.includes('WINHTTP_OPTION_UPGRADE_TO_WEB_SOCKET'));
  assert.ok(mainCpp.includes('json/version'));
  assert.ok(mainCpp.includes('json/list'));
  assert.ok(mainCpp.includes('Target.attachToTarget'));
  assert.ok(mainCpp.includes('flatten'));
  assert.ok(mainCpp.includes('Runtime.evaluate'));
  assert.ok(mainCpp.includes('Input.dispatchMouseEvent'));
  assert.ok(mainCpp.includes('Input.dispatchKeyEvent'));
  assert.ok(mainCpp.includes('Input.insertText'));
  assert.equal(mainCpp.includes('Input.insertTextInput'), false);
  assert.ok(mainCpp.includes('Network.getResponseBody'));
  assert.ok(mainCpp.includes('Page.captureScreenshot'));
  assert.ok(mainCpp.includes('Page.printToPDF'));
  assert.ok(mainCpp.includes('WM_LINGBUILDER_CDP_CLIENT_EVENT'));
  assert.ok(mainCpp.includes('case WM_LINGBUILDER_CDP_CLIENT_EVENT:'));
  assert.ok(mainCpp.includes('LingCdpRuntime cdpClientRuntime_'));
  assert.ok(mainCpp.includes('long long CDP_连接(const wchar_t* address, const wchar_t* handler)'));
  assert.ok(mainCpp.includes('long long CDP_新建页面(long long connection, const wchar_t* url, const wchar_t* handler)'));
  assert.ok(mainCpp.includes('if (callback == L"连接就绪")'));
  assert.ok(mainCpp.includes('CDP_连接(L"http://127.0.0.1:9222", L"连接就绪")'));
  assert.ok(mainCpp.includes('CDP_点击元素(按钮, L"点击完成")'));
  // 多开核心：连接注册表与每连接独立消息编号。
  assert.ok(mainCpp.includes('std::unordered_map<long long, std::shared_ptr<Connection>> connections_'));
  assert.ok(mainCpp.includes('std::atomic<long long> nextMsgId{1}'));
  // 会话内核：pending 回调表与 sessionId 路由。
  assert.ok(mainCpp.includes('std::unordered_map<long long, Pending> pending'));
  assert.ok(mainCpp.includes('sessionId'));
  // 断开时释放未完成回调。
  assert.ok(mainCpp.includes('FailPendingAll'));
  // 默认回环限制。
  assert.ok(mainCpp.includes('IsLoopbackHost'));
  // 阶段 2：看门狗超时。
  assert.ok(mainCpp.includes('WatchdogLoop'));
  assert.ok(mainCpp.includes('CheckTimeouts'));
  assert.ok(mainCpp.includes('CDP 命令超时'));
  // 阶段 2：Fetch 拦截、对话框、下载、上传、等待与仿真。
  assert.ok(mainCpp.includes('Fetch.enable'));
  assert.ok(mainCpp.includes('Fetch.requestPaused'));
  assert.ok(mainCpp.includes('Fetch.fulfillRequest'));
  assert.ok(mainCpp.includes('Fetch.continueWithAuth'));
  assert.ok(mainCpp.includes('Page.javascriptDialogOpening'));
  assert.ok(mainCpp.includes('Page.handleJavaScriptDialog'));
  assert.ok(mainCpp.includes('Browser.setDownloadBehavior'));
  assert.ok(mainCpp.includes('Browser.downloadWillBegin'));
  assert.ok(mainCpp.includes('DOM.setFileInputFiles'));
  assert.ok(mainCpp.includes('Page.setLifecycleEventsEnabled'));
  assert.ok(mainCpp.includes('Page.lifecycleEvent'));
  assert.ok(mainCpp.includes('Emulation.setDeviceMetricsOverride'));
  assert.ok(mainCpp.includes('Emulation.setEmulatedMedia'));
  assert.ok(mainCpp.includes('Network.emulateNetworkConditions'));
  assert.ok(mainCpp.includes('Browser.setWindowBounds'));
  assert.ok(mainCpp.includes('Target.setDiscoverTargets'));
  // 阶段 3：Target/session、binding、Debugger、Storage 与录制地基。
  assert.ok(mainCpp.includes('Target.setAutoAttach'));
  assert.ok(mainCpp.includes('Target.attachedToTarget'));
  assert.ok(mainCpp.includes('Runtime.bindingCalled'));
  assert.ok(mainCpp.includes('Overlay.highlightRect'));
  assert.ok(mainCpp.includes('Input.dispatchTouchEvent'));
  assert.ok(mainCpp.includes('Debugger.setBreakpointByUrl'));
  assert.ok(mainCpp.includes('Debugger.evaluateOnCallFrame'));
  assert.ok(mainCpp.includes('Runtime.getProperties'));
  assert.ok(mainCpp.includes('Performance.getMetrics'));
  assert.ok(mainCpp.includes('Storage.getUsageAndQuota'));
  assert.ok(mainCpp.includes('Storage.clearDataForOrigin'));
  assert.ok(mainCpp.includes('Security.setOverrideCertificateErrors'));
  assert.ok(mainCpp.includes('Security.handleCertificateError'));
  assert.ok(mainCpp.includes('certificateOverrideDeadline'));
  assert.ok(mainCpp.includes('lingbuilder.cdp.recording'));
  assert.ok(mainCpp.includes('long long CDP_附加目标(long long target, const wchar_t* handler)'));
  assert.ok(mainCpp.includes('long long CDP_设置断点(long long page'));
  assert.ok(mainCpp.includes('bool CDP_清理来源数据(long long connection'));
  // 阶段 2 命令调用生成。
  assert.ok(mainCpp.includes('CDP_拦截继续(CDP_取当前拦截())'));
  assert.ok(mainCpp.includes('CDP_应答对话框(CDP_取当前页面(), true, L"")'));
  assert.ok(mainCpp.includes('CDP_拦截开始(页面, L"*://api.example.com/*", L"请求被拦截")'));
  assert.ok(mainCpp.includes('if (callback == L"请求被拦截")'));
});

test('new_emoji CDP 客户端复用同一 runtime 并创建消息窗口', () => {
  const generated = generate([newEmojiModule, cdpModule], 'new-emoji');
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('static LingCdpRuntime g_cdpClientRuntime'));
  assert.ok(mainCpp.includes('LB_NE_CreateCdpClientEventWindow'));
  assert.ok(mainCpp.includes('WM_LINGBUILDER_NE_CDP_CLIENT_EVENT'));
  assert.ok(mainCpp.includes('static long long CDP_连接(const wchar_t* address, const wchar_t* handler)'));
  assert.ok(mainCpp.includes('static void LB_NE_DispatchCdpClientEvent'));
  assert.ok(mainCpp.includes('if (callback == L"连接就绪")'));
});

test('未启用 CDP 模块时不注入 runtime 与消息号', () => {
  const generated = generate([]);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(mainCpp.includes('class LingCdpRuntime'), false);
  assert.equal(mainCpp.includes('LingCdpJson'), false);
  assert.equal(mainCpp.includes('#define LINGBUILDER_CDP_CLIENT_MODULE'), false);
  assert.equal(mainCpp.includes('long long CDP_连接(const wchar_t* address'), false);
});
