/**
 * 2026-09-09 四火山工程缺口封装验证（fbro-four-project-audit 全量补齐）：
 * - VIPWebsocket拦截测试：WS 拦截闭环（拦截事件可绑定、篡改写回、WSS 客户端命令、SendByBrowser 回传）
 * - DOM填表实例：原生 DOM 遍历快照族（VisitDOM 序列化 + 按路径写回）
 * - VIP指纹测试：运行时创建独立 RequestContext + 原地重建 + 取主浏览器
 * - 同步辅助类及填表测试：既有填表/框架命令已覆盖，这里验证请求取方法补齐
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import {
  FBRO_BROWSER_DESIGNER_EVENTS,
  FBRO_EVENT_CATALOG,
  FBRO_PUBLIC_BROWSER_EVENTS,
  resolveFbroEvent
} from '../src/services/modules/fbroEventCatalog';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { LingWindowProject } from '../src/services/windowDesigner/types';

interface CoverageSignature {
  officialName: string;
  implementationStatus: string;
  classification: string;
}

interface CoverageFile {
  signatures: CoverageSignature[];
  eventCatalog: Array<{
    eventId: string;
    ownerClass: string;
    officialName: string;
    lingBuilderName: string;
    exposure: string;
    bridgeStatus: string;
  }>;
}

const coverage: CoverageFile = JSON.parse(
  await fs.readFile(
    path.resolve(process.cwd(), 'src', 'services', 'modules', 'fbroApiCoverage.generated.json'),
    'utf8'
  )
);

const GAP_CLOSURE_SYMBOLS = [
  // WS 拦截闭环
  'FBroHsSocketServer_SendByBrowser',
  'FBroHsSocketClient_SendByBrowser',
  'FBroHsWSSClient_IsNull',
  'FBroHsWSSClient_GetAddress',
  'FBroHsWSSClient_GetProtocol',
  'FBroHsWSSClient_GetExtensions',
  'FBroHsWSSClient_Send',
  'FBroHsWSSClient_SendData',
  'FBroHsRequest_GetMethod',
  // 原生 DOM 遍历族
  'FBroHsBrowserFrame_VisitDOM',
  'FBroHsDOMDocument_GetType',
  'FBroHsDOMDocument_GetDocument',
  'FBroHsDOMDocument_GetBody',
  'FBroHsDOMDocument_GetHead',
  'FBroHsDOMDocument_GetTitle',
  'FBroHsDOMDocument_GetBaseURL',
  'FBroHsDOMDocument_GetFocusedNode',
  'FBroHsDOMNode_GetType',
  'FBroHsDOMNode_IsElement',
  'FBroHsDOMNode_IsSame',
  'FBroHsDOMNode_GetName',
  'FBroHsDOMNode_GetValue',
  'FBroHsDOMNode_GetElementInnerText',
  'FBroHsDOMNode_GetElementAttributes',
  'FBroHsDOMNode_HasChildren',
  'FBroHsDOMNode_GetFirstChild',
  'FBroHsDOMNode_GetNextSibling',
  'FBroHsDOMNode_SetElementAttribute',
  'FBroHsDOMNode_SetValue',
  'FBroHsContextMenuParams_pGetTypeFlags',
  // 运行时上下文与杂项
  'FBroHsRequestContext_CreateContext',
  'FBroHsBrowserHost_GetMainBrowser'
] as const;

const PUBLIC_INTERCEPT_EVENTS = [
  { ownerClass: 'FBroHsInitEvent', officialName: 'OnWebSocketClientCreate', name: '初始化WebSocket客户端创建' },
  { ownerClass: 'FBroHsInitEvent', officialName: 'OnWebSocketClientConnect', name: '初始化WebSocket客户端连接' },
  { ownerClass: 'FBroHsInitEvent', officialName: 'OnWebSocketClientClose', name: '初始化WebSocket客户端关闭' },
  { ownerClass: 'FBroHsInitEvent', officialName: 'OnWebSocketClientMessage', name: '初始化WebSocket客户端消息' },
  { ownerClass: 'FBroHsInitEvent', officialName: 'OnWebSocketClientSend', name: '初始化WebSocket客户端发送' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnServerCreated', name: '本地服务器服务器已创建' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnServerDestroyed', name: '本地服务器服务器已销毁' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnClientConnected', name: '本地服务器客户端已连接' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnClientDisconnected', name: '本地服务器客户端已断开' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnWebSocketConnected', name: '本地服务器WebSocket已连接' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnWebSocketMessage', name: '本地服务器WebSocket消息到达' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnWebSocketRequest', name: '本地服务器WebSocket握手请求' },
  { ownerClass: 'FBroHsServerHandle', officialName: 'OnHttpRequest', name: '本地服务器HTTP请求到达' }
] as const;

const DESIGNER_WS_EVENT_NAMES = new Set(
  PUBLIC_INTERCEPT_EVENTS.filter(item => item.ownerClass === 'FBroHsInitEvent').map(item => item.name)
);

test('四火山工程缺口官方符号全部转为 implemented 且有真实 Bridge 调用', () => {
  const byName = new Map(coverage.signatures.map(item => [item.officialName, item]));
  for (const officialName of GAP_CLOSURE_SYMBOLS) {
    const signature = byName.get(officialName);
    assert.ok(signature, `覆盖目录缺少官方符号：${officialName}`);
    assert.equal(
      signature.implementationStatus, 'implemented',
      `${officialName} 仍为 ${signature.implementationStatus}，缺口未封闭`
    );
  }
});

test('13 个拦截与服务器事件转为公开且桥已真实实现', () => {
  assert.equal(FBRO_PUBLIC_BROWSER_EVENTS.length, 102);
  for (const expected of PUBLIC_INTERCEPT_EVENTS) {
    const definition = resolveFbroEvent(expected.name);
    assert.ok(definition, `事件别名无法解析：${expected.name}`);
    assert.equal(definition.ownerClass, expected.ownerClass);
    assert.equal(definition.officialName, expected.officialName);
    assert.equal(definition.exposure, 'public', `${expected.name} 仍是 ${definition.exposure}`);
    assert.equal(definition.bridgeStatus, 'implemented');
  }
  // 设计器 FBroBrowser 控件只挂 WS 客户端五事件；服务器事件经 FBro_绑定事件 绑定。
  const designerNames = new Set(FBRO_BROWSER_DESIGNER_EVENTS.map(item => item.lingBuilderName));
  for (const name of DESIGNER_WS_EVENT_NAMES) {
    assert.ok(designerNames.has(name), `设计器控件缺少 WS 拦截事件：${name}`);
  }
  for (const expected of PUBLIC_INTERCEPT_EVENTS.filter(item => item.ownerClass === 'FBroHsServerHandle')) {
    assert.ok(!designerNames.has(expected.name), `服务器事件不应挂在控件上：${expected.name}`);
  }
});

test('缺口命令全部登记清单、binding 且参数类型正确', () => {
  const expectedCommands: Array<{
    command: string;
    moduleId: string;
    parameters: string[];
    returnType: string;
    runtimeName?: string;
  }> = [
    { command: 'FBro服务器_创建', moduleId: 'lingbuilder.fbro.network', parameters: ['controlRef', 'wideString', 'int', 'int'], returnType: 'longLong' },
    { command: 'FBro页面_发送文本', moduleId: 'lingbuilder.fbro.network', parameters: ['controlRef', 'wideString', 'wideString'], returnType: 'int', runtimeName: 'FBro页面_发送文本' },
    { command: 'FBro页面_发送缓冲', moduleId: 'lingbuilder.fbro.network', parameters: ['controlRef', 'wideString', 'longLong'], returnType: 'int' },
    { command: 'FBro页面_客户端发送文本', moduleId: 'lingbuilder.fbro.network', parameters: ['controlRef', 'wideString', 'wideString'], returnType: 'int' },
    { command: 'FBro页面_客户端发送缓冲', moduleId: 'lingbuilder.fbro.network', parameters: ['controlRef', 'wideString', 'longLong'], returnType: 'int' },
    { command: 'FBroWS客户端_是否空', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong'], returnType: 'int' },
    { command: 'FBroWS客户端_取地址', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong'], returnType: 'wideString' },
    { command: 'FBroWS客户端_取协议', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong'], returnType: 'wideString' },
    { command: 'FBroWS客户端_取扩展', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong'], returnType: 'wideString' },
    { command: 'FBroWS客户端_发送文本', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong', 'wideString'], returnType: 'int' },
    { command: 'FBroWS客户端_发送缓冲', moduleId: 'lingbuilder.fbro.network', parameters: ['longLong', 'longLong'], returnType: 'int' },
    { command: 'FBro请求_取方法', moduleId: 'lingbuilder.fbro.objects', parameters: ['longLong'], returnType: 'wideString' },
    { command: 'FBro框架_遍历DOM', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong', 'int', 'int'], returnType: 'longLong' },
    { command: 'FBro遍历_取节点数', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong'], returnType: 'int' },
    { command: 'FBro遍历_取节点属性', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong', 'int', 'wideString'], returnType: 'wideString' },
    { command: 'FBro遍历_取焦点节点路径', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong'], returnType: 'wideString' },
    { command: 'FBro遍历_按路径设属性', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong', 'wideString', 'wideString', 'wideString'], returnType: 'int' },
    { command: 'FBro遍历_按路径赋值', moduleId: 'lingbuilder.fbro.automation', parameters: ['longLong', 'wideString', 'wideString'], returnType: 'int' },
    { command: 'FBro右键参数_取类型标志', moduleId: 'lingbuilder.fbro.objects', parameters: ['longLong'], returnType: 'int' },
    { command: 'FBro会话_创建上下文', moduleId: 'lingbuilder.fbro.session', parameters: ['wideString'], returnType: 'longLong' },
    { command: 'FBro会话_使用上下文重建', moduleId: 'lingbuilder.fbro.session', parameters: ['controlRef', 'longLong'], returnType: 'int' },
    { command: 'FBro_取主浏览器', moduleId: 'lingbuilder.fbro.browser', parameters: ['controlRef'], returnType: 'longLong' }
  ];
  for (const expected of expectedCommands) {
    const manifest = BUILTIN_MODULES.find(item => item.id === expected.moduleId);
    assert.ok(manifest, `缺少模块：${expected.moduleId}`);
    const contribution = manifest.contributes?.commands?.find(item => item.name === expected.command);
    assert.ok(contribution, `${expected.moduleId} 缺少命令 contribution：${expected.command}`);
    const binding = manifest.bindings?.commands?.find(item => item.command === expected.command);
    assert.ok(binding, `${expected.moduleId} 缺少命令 binding：${expected.command}`);
    assert.deepEqual(
      binding.parameters.map(parameter => parameter.type), expected.parameters,
      `${expected.command} 参数类型漂移`
    );
    assert.equal(binding.returnType, expected.returnType, `${expected.command} 返回类型漂移`);
    if (expected.runtimeName) assert.equal(binding.runtimeName, expected.runtimeName);
  }
});

test('缺口命令生成真实 C++ wrapper、桥接调用与调用点', async () => {
  const fbroModules = BUILTIN_MODULES.filter(item => item.id.startsWith('lingbuilder.fbro'))
    .map(manifest => ({
      manifest,
      installPath: `builtin://${manifest.id}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    }));
  const project: LingWindowProject = {
    id: 'fbro-gap-closure-project',
    name: 'FBro 缺口闭环测试项目',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'FBro 缺口闭环',
      width: 800,
      height: 600,
      background: '#202020',
      description: '主窗口',
      controls: [{
        id: 'fbro-main', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 0, y: 0,
        width: 640, height: 480, background: '#fff', foreground: '#000', fontSize: 12,
        isEnabled: true, visibility: 'Visible', properties: { url: 'about:blank' },
        events: {}
      }]
    }]
  };
  const source = `包 测试
类 MainWindow : 窗口
公开
  事件 测试()
    FBro_绑定事件(FBro浏览器1, "初始化WebSocket客户端消息", &处理WS消息)
    FBro_绑定事件(FBro浏览器1, "本地服务器WebSocket消息到达", &处理服务器消息)
    FBro会话_使用上下文重建(FBro浏览器1, FBro会话_创建上下文("{\"cachePath\":\"TestData\"}"))
    FBro页面_发送文本(FBro浏览器1, "websocketsendtext", "你好")
    FBro页面_发送缓冲(FBro浏览器1, "websocketsenddata", 0)
    FBro页面_客户端发送文本(FBro浏览器1, "websocket", "hello")
    FBroWS客户端_发送文本(1, "hi")
    FBro框架_遍历DOM(1, 16, 4000)
    FBro遍历_按路径设属性(1, "[0]", "class", "active")
    FBro遍历_按路径赋值(1, "[0,1]", "新值")
    FBro_取主浏览器(FBro浏览器1)
  结束
结束类`;
  const generated = generateLingCppNativeWin32Project(project, { lingCppSourceCode: source, enabledModules: fbroModules });
  assert.deepEqual(generated.blockingDiagnostics, []);
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  // wrapper 定义（static 与成员双版本全量生成，至少各出现一次）
  assert.match(cpp, /long long FBro框架_遍历DOM\(long long frame, int maxDepth, int maxNodes\)/);
  assert.match(cpp, /int FBro页面_发送文本\(const wchar_t\* (?:name|controlName), const wchar_t\* channel, const wchar_t\* text\)/);
  assert.match(cpp, /long long FBro会话_创建上下文\(const wchar_t\* settingsJson\)/);
  assert.match(cpp, /int FBro会话_使用上下文重建\(const wchar_t\* (?:name|controlName), long long context\)/);
  assert.match(cpp, /long long FBro_取主浏览器\(const wchar_t\* (?:name|controlName)\)/);
  assert.match(cpp, /std::wstring FBroWS客户端_取地址\(long long object\)/);
  assert.match(cpp, /std::wstring FBro遍历_取节点名称\(long long object, int nodeIndex\)/);
  assert.match(cpp, /std::wstring FBro请求_取方法\(long long object\)/);
  assert.match(cpp, /int FBro右键参数_取类型标志\(long long object\)/);
  // 真实桥接调用
  assert.match(cpp, /LB_FBro_FrameVisitDomAsync\(static_cast<LB_FBRO_OBJECT_HANDLE>\(frame\), maxDepth, maxNodes, nullptr, nullptr\)/);
  assert.match(cpp, /LB_FBro_SocketServerSendByBrowser\(/);
  assert.match(cpp, /LB_FBro_SocketClientSendByBrowser\(/);
  assert.match(cpp, /LB_FBro_RequestContextCreateAsync\(/);
  assert.match(cpp, /LB_FBro_RecreateBrowserWithContext\(/);
  assert.match(cpp, /LB_FBro_BrowserHostGetMainBrowser\(/);
  assert.match(cpp, /LB_FBro_WssSend\(/);
  assert.match(cpp, /LB_FBro_DomSetAttributeByPathAsync\(/);
  assert.match(cpp, /LB_FBro_DomSetValueByPathAsync\(/);
  assert.match(cpp, /LB_FBro_RequestGetMethod\(/);
  assert.match(cpp, /LB_FBro_ContextMenuParamsGetTypeFlags\(/);
  // .lcpp 调用点
  assert.match(cpp, /FBro页面_发送文本\(L"FBro浏览器1", L"websocketsendtext", L"你好"\)/);
  assert.match(cpp, /FBro框架_遍历DOM\(1, 16, 4000\)/);
  assert.match(cpp, /FBro_绑定事件\(L"FBro浏览器1", L"初始化WebSocket客户端消息", L"处理WS消息"\)/);
  assert.match(cpp, /FBro_绑定事件\(L"FBro浏览器1", L"本地服务器WebSocket消息到达", L"处理服务器消息"\)/);
});

test('拦截事件手写 override 标记与服务器事件分发进入生成与桥产物', async () => {
  const overrideSource = await fs.readFile(
    path.resolve(process.cwd(), 'native', 'fbro-bridge', 'FbroEventOverrides.generated.inc'), 'utf8');
  for (const expected of PUBLIC_INTERCEPT_EVENTS.filter(item => item.ownerClass === 'FBroHsInitEvent')) {
    const definition = resolveFbroEvent(expected.name);
    assert.ok(definition);
    assert.ok(
      overrideSource.includes(`LB_FBRO_EVENT_OVERRIDE:${definition.eventId}`),
      `生成覆盖缺少事件标记：${definition.eventId}`
    );
    assert.ok(
      overrideSource.includes(`// custom override: ${expected.officialName}`),
      `WS 拦截事件应为手写覆盖：${expected.officialName}`
    );
  }
  const bridgeSource = await fs.readFile(
    path.resolve(process.cwd(), 'native', 'fbro-bridge', 'LingBuilderFbroBridge.cpp'), 'utf8');
  for (const expected of PUBLIC_INTERCEPT_EVENTS) {
    const definition = resolveFbroEvent(expected.name);
    assert.ok(definition);
    assert.ok(
      bridgeSource.includes(definition.eventId) || overrideSource.includes(definition.eventId),
      `事件 ${expected.name} 缺少桥内真实派发或覆盖标记`
    );
  }
  // 服务器事件分发必须指向创建者浏览器（DispatchGeneratedBrowserEvent）。
  assert.ok(bridgeSource.includes('LB_FBro_ServerCreateAsync(LB_FBRO_HANDLE browser'));
  // 官方导出字面量必须真实出现在桥源（覆盖门禁同口径抽查；
  // FBroHsDOMNode_GetElementAttribute 由受管快照查找等价实现，不在桥内直调）。
  for (const officialName of GAP_CLOSURE_SYMBOLS) {
    assert.ok(bridgeSource.includes(officialName), `桥源缺少官方调用：${officialName}`);
  }
});
