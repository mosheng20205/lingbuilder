import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

import { HTTP_CLIENT_COMMAND_SPECS, HTTP_CLIENT_MODULE } from '../src/services/modules/httpClientModule';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { InstalledModule } from '../src/services/modules/types';
import { LingWindowProject } from '../src/services/windowDesigner/types';

const httpModule: InstalledModule = {
  manifest: HTTP_CLIENT_MODULE,
  installPath: 'builtin://lingbuilder.net.http-client',
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
    description: 'HTTP 客户端双后端测试模块。',
    targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }]
  },
  installPath: 'builtin://lingbuilder.new_emoji.ui',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

const project: LingWindowProject = {
  id: 'http-client-runtime-test',
  name: 'HTTP 客户端运行时测试',
  windows: [{
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: 'MainWindow',
    title: 'HTTP 客户端测试',
    width: 640,
    height: 480,
    background: '#202020',
    description: 'HTTP 客户端双后端生成测试。',
    controls: []
  }]
};

const source = [
  '类 MainWindow',
  '    事件 _MainWindow_创建完毕()',
  '        局部 HTTP客户端 客户端 = HTTP客户端_创建客户端()',
  '        HTTP客户端_设置自动解压(客户端, true)',
  '        HTTP客户端_置Cookie(客户端, "PASS_ID", "v1", ".example.com", "/")',
  '        HTTP客户端请求 带Cookie请求 = HTTP客户端_创建请求(客户端, "GET", "https://example.com/api")',
  '        HTTP客户端_请求置Cookie(带Cookie请求, "PASS_ID=v1")',
  '        HTTP客户端_开始请求(带Cookie请求)',
  '        文本型 清单 = HTTP客户端_取CookieJSON(客户端)',
  '        调试输出(清单)',
  '        HTTP客户端_删除全部Cookie(客户端)',
  '        HTTP客户端请求 请求 = HTTP客户端_GET异步(客户端, "https://example.com", &请求完成)',
  '    结束',
  '    事件 请求完成()',
  '        HTTP客户端请求 请求 = HTTP客户端_取当前请求()',
  '        调试输出(HTTP客户端_取响应文本编码(请求, "auto"))',
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

test('HTTP 客户端模块清单、文档和旧兼容入口保持完整', async () => {
  assert.equal(validateModuleManifest(HTTP_CLIENT_MODULE).diagnostics.length, 0);
  assert.equal(HTTP_CLIENT_COMMAND_SPECS.length, 78);
  assert.deepEqual(
    HTTP_CLIENT_MODULE.bindings?.commands?.map(item => item.command),
    HTTP_CLIENT_MODULE.contributes?.commands?.map(item => item.name)
  );
  for (const name of ['HTTP客户端_请求', 'HTTP客户端_GET', 'HTTP客户端_POST', 'HTTP客户端_取状态码', 'HTTP客户端_取响应文本', 'HTTP客户端_取错误', 'HTTP客户端_清空状态']) {
    assert.ok(HTTP_CLIENT_COMMAND_SPECS.some(item => item.name === name), `缺少旧兼容入口 ${name}`);
  }
  for (const name of ['HTTP客户端_置Cookie', 'HTTP客户端_请求置Cookie', 'HTTP客户端_取CookieJSON', 'HTTP客户端_删除全部Cookie']) {
    assert.ok(HTTP_CLIENT_COMMAND_SPECS.some(item => item.name === name), `缺少 Cookie 注入命令 ${name}`);
  }
  const documentationPath = path.resolve(process.cwd(), 'docs/modules/http-client/README.md');
  const documentation = await fs.readFile(documentationPath, 'utf8');
  assert.ok(documentation.includes('HTTP客户端_GET异步'));
  assert.ok(documentation.includes('WinHTTP'));
  assert.ok(documentation.includes('HTTP客户端_请求置Cookie'));
});

test('Win32 HTTP 客户端生成共享 WinHTTP runtime、完成消息和处理器引用', () => {
  const generated = generate([httpModule]);
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('class LingHttpClientRuntime'));
  assert.ok(mainCpp.includes('WinHttpOpen('));
  assert.ok(mainCpp.includes('WinHttpSendRequest('));
  assert.ok(mainCpp.includes('WinHttpReceiveResponse('));
  assert.ok(mainCpp.includes('WINHTTP_QUERY_VERSION'));
  assert.ok(mainCpp.includes('WINHTTP_OPTION_REDIRECT_POLICY'));
  assert.ok(mainCpp.includes('WINHTTP_OPTION_DECOMPRESSION'));
  assert.ok(mainCpp.includes('request->uploadedBytes = static_cast<long long>(body.size())'));
  assert.ok(mainCpp.includes('body.size() > maxUploadBytes'));
  assert.ok(mainCpp.includes('ContainsControl(address)'));
  assert.ok(mainCpp.includes('WM_LINGBUILDER_HTTP_CLIENT_EVENT'));
  assert.ok(mainCpp.includes('case WM_LINGBUILDER_HTTP_CLIENT_EVENT:'));
  assert.ok(mainCpp.includes('bool HTTP客户端_执行同步(long long request)'));
  assert.ok(mainCpp.includes('bool HTTP客户端_请求(const wchar_t* method'));
  assert.ok(mainCpp.includes('bool HTTP客户端_置Cookie(long long client, const wchar_t* name, const wchar_t* value, const wchar_t* domain, const wchar_t* path)'));
  assert.ok(mainCpp.includes('bool HTTP客户端_请求置Cookie(long long request, const wchar_t* cookie)'));
  assert.ok(mainCpp.includes('HTTP客户端_置Cookie(客户端, L"PASS_ID", L"v1", L".example.com", L"/")'));
  assert.ok(mainCpp.includes('HTTP客户端_请求置Cookie(带Cookie请求, L"PASS_ID=v1")'));
  assert.ok(mainCpp.includes('request.cookieOverride = text'));
  assert.ok(mainCpp.includes('headers += L"Cookie: " + requestCookie + L"\\r\\n"'));
  assert.ok(mainCpp.includes('DWORD disableCookies = WINHTTP_DISABLE_COOKIES'));
  assert.ok(mainCpp.includes('ManualCookieDomainMatches(host, item.domain)'));
  assert.ok(mainCpp.includes('if (callback == L"请求完成")'));
  assert.ok(mainCpp.includes('HTTP客户端_GET异步(客户端, L"https://example.com", L"请求完成")'));
});

test('new_emoji HTTP 客户端复用同一 runtime 并创建消息窗口', () => {
  const generated = generate([newEmojiModule, httpModule], 'new-emoji');
  assert.deepEqual(generated.blockingDiagnostics, []);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.ok(mainCpp.includes('static LingHttpClientRuntime g_httpClientRuntime'));
  assert.ok(mainCpp.includes('LB_NE_CreateHttpClientEventWindow'));
  assert.ok(mainCpp.includes('WM_LINGBUILDER_NE_HTTP_CLIENT_EVENT'));
  assert.ok(mainCpp.includes('static long long HTTP客户端_创建客户端()'));
  assert.ok(mainCpp.includes('static void LB_NE_DispatchHttpClientEvent'));
  assert.ok(mainCpp.includes('if (callback == L"请求完成")'));
});

test('未启用 HTTP 客户端模块时不注入 WinHTTP runtime', () => {
  const generated = generate([]);
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  assert.equal(mainCpp.includes('class LingHttpClientRuntime'), false);
  assert.equal(mainCpp.includes('HTTP客户端_请求(const wchar_t* method'), false);
});
