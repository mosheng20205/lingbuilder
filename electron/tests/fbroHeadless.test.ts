import { strict as assert } from 'node:assert';
import test from 'node:test';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { getLingCppSemanticDiagnostics } from '../src/services/lingCpp/languageService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingFbroHeadlessResource, LingWindowProject } from '../src/services/windowDesigner/types';

const fbroManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.browser')!;
const fbroEventsManifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.fbro.events')!;
const fbroModule: InstalledModule = {
  manifest: fbroManifest,
  installPath: 'builtin://lingbuilder.fbro.browser',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};
const fbroEventsModule: InstalledModule = {
  manifest: fbroEventsManifest,
  installPath: 'builtin://lingbuilder.fbro.events',
  isBuiltin: true,
  isInstalled: true,
  isEnabledForProject: true,
  diagnostics: []
};

const headlessResource: LingFbroHeadlessResource = {
  id: 'fbro-headless-1',
  type: 'FBroHeadlessBrowser',
  name: '无头浏览器1',
  ownerWindowId: 'main-window',
  url: 'https://example.com',
  cacheDir: '.fbro-headless/cache',
  extraInfoJson: ''
};

function makeProject(withVisibleBrowser: boolean): LingWindowProject {
  return {
    id: 'fbro-headless-test',
    name: 'FBro 无头测试项目',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'MainWindow',
      width: 640,
      height: 480,
      background: '#202020',
      description: '主窗口',
      controls: withVisibleBrowser
        ? [{
          id: 'fbro-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 12, y: 20,
          width: 480, height: 320, background: '#ffffff', foreground: '#000000', fontSize: 14,
          isEnabled: true, visibility: 'Visible', properties: {}, events: {}
        }]
        : []
    }],
    resources: [headlessResource]
  };
}

function generatedMain(project: LingWindowProject, source: string) {
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules: [fbroModule],
    lingCppSourceCode: source
  });
  const cpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  return { generated, cpp };
}

test('FBro无头浏览器设计器资源生成期烘焙 headless 启动开关并创建后台实例', () => {
  const { generated, cpp } = generatedMain(makeProject(false),
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        FBro_绑定事件(无头浏览器1, "LoadEnd", &加载完成)\n    结束\n    公开 空 加载完成()\n    结束\n结束类');
  assert.equal(generated.blockingDiagnostics.filter(item => item.includes('无头')).length, 0);
  assert.ok(cpp.includes('LB_FBro_SetStartupSwitches(L"{\\"headless\\":true}"'), '启动开关 JSON 必须包含 headless');
  assert.match(cpp, /static const bool g_lingFbroHeadlessBaked = true;/u);
  assert.match(cpp, /static FbroHeadlessSpec g_fbroHeadlessBrowsers\[\]/u);
  assert.match(cpp, /L"无头浏览器1"/u);
  assert.match(cpp, /void FBro_创建无头资源\(\)/u);
  assert.match(cpp, /FBro_创建\(nullptr\); FBro_创建无头资源\(\);/u);
  assert.match(cpp, /LB_FBro_CreateBackground\(instance->url\.c_str\(\)/u);
});

test('FBro_启用无头模式 字面调用在无窗口设计器内容时也烘焙 headless', () => {
  const project: LingWindowProject = { ...makeProject(false), resources: [] };
  const { cpp } = generatedMain(project,
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出(FBro_启用无头模式())\n    结束\n结束类');
  assert.ok(cpp.includes('LB_FBro_SetStartupSwitches(L"{\\"headless\\":true}"'));
  assert.match(cpp, /static const bool g_lingFbroHeadlessBaked = true;/u);
  assert.match(cpp, /int FBro_启用无头模式\(\)[\s\S]{0,120}return g_lingFbroHeadlessBaked \? 1 : 0;/u);
});

test('字符串与注释里的 FBro_启用无头模式 不触发无头烘焙', () => {
  const project: LingWindowProject = { ...makeProject(false), resources: [] };
  const { cpp } = generatedMain(project,
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出("FBro_启用无头模式()")\n        // FBro_启用无头模式()\n    结束\n结束类');
  assert.ok(!/g_lingFbroHeadlessBaked = true/u.test(cpp));
  assert.ok(!cpp.includes('LB_FBro_SetStartupSwitches'));
});

test('无头模式与可见进程内 FBroBrowser 控件共存必须生成前阻断', () => {
  const { generated } = generatedMain(makeProject(true),
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n    结束\n结束类');
  assert.ok(generated.blockingDiagnostics.some(item =>
    item.includes('无头模式与可见 FBroBrowser 控件进程级互斥') && item.includes('FBro浏览器1')),
  `缺少互斥阻断诊断：${generated.blockingDiagnostics.join(' / ')}`);
});

test('无头资源与独立进程可见控件共存不触发互斥阻断', () => {
  const project = makeProject(true);
  project.windows[0].controls[0].properties = { processMode: 'independent-window' };
  const { generated } = generatedMain(project,
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n    结束\n结束类');
  assert.equal(generated.blockingDiagnostics.filter(item => item.includes('进程级互斥')).length, 0);
});

test('FBro 浏览器族命令的组件名参数接受无头资源并解析为设计器资源', () => {
  const diagnostics = getLingCppSemanticDiagnostics(
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        FBro_导航(无头浏览器1, "https://example.com")\n        FBro_绑定事件(无头浏览器1, "LoadEnd", &加载完成)\n    结束\n    公开 空 加载完成()\n    结束\n结束类',
    makeProject(false),
    'src/MainWindow.lcpp',
    { enabledModules: [fbroModule, fbroEventsModule], availableModules: [fbroModule, fbroEventsModule] }
  );
  assert.equal(diagnostics.filter(item => item.level === 'error' && item.id.includes('control-reference'))
    .map(item => item.message).join('\n'), '');
});

test('new_emoji 后端声明无头模式时给出仅支持标准 Win32 后端的阻断诊断', () => {
  const project = makeProject(false);
  (project.windows[0] as { designerBackend?: string }).designerBackend = 'new-emoji';
  const { generated } = generatedMain(project,
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n        调试输出(FBro_启用无头模式())\n    结束\n结束类');
  assert.ok(generated.blockingDiagnostics.some(item => item.includes('仅支持标准 Win32 后端')));
});

/** 只留一个可见 FBroBrowser 控件的项目骨架：不带无头资源，避免与本批开关断言互相干扰。 */
function fbroSwitchProject(properties: Record<string, unknown>): LingWindowProject {
  const project = makeProject(true);
  project.resources = [];
  project.windows[0].controls[0].properties = { ...properties } as
    LingWindowProject['windows'][number]['controls'][number]['properties'];
  return project;
}

test('FBroBrowser 新增启动开关属性进入生成期烘焙命令行', () => {
  const { cpp } = generatedMain(fbroSwitchProject({ enableCrossFrame: true, disableProxy: true }),
    '类 MainWindow\n    事件 _MainWindow_创建完毕()\n    结束\n结束类');
  assert.match(cpp, /static const bool g_lingFbroStartupSwitchesBaked = true;/u);
  assert.ok(cpp.includes('LB_FBro_SetStartupSwitches(L"{\\"enableCrossFrame\\":true,\\"disableProxy\\":true}"'),
    '两个新开关必须按白名单键名烘焙进初始化前的启动开关登记');
});

test('FBro_设置启动开关JSON 字面声明在生成期并入烘焙，同键以代码声明为准', () => {
  const source = '类 MainWindow\n    事件 _MainWindow_创建完毕()\n'
    + '        调试输出(FBro_设置启动开关JSON("{\\"disableGpu\\":true,\\"enableCrossFrame\\":false}"))\n'
    + '    结束\n结束类';
  const { generated, cpp } = generatedMain(fbroSwitchProject({ disableGpu: true }), source);
  assert.equal(generated.blockingDiagnostics.filter(item => item.includes('启动开关')).length, 0);
  assert.ok(cpp.includes('LB_FBro_SetStartupSwitches(L"{\\"disableGpu\\":true,\\"enableCrossFrame\\":false}"'),
    '代码字面声明必须并入烘焙，且同键覆盖属性勾选（可把属性项显式关掉）');
  assert.match(cpp, /static const bool g_lingFbroStartupSwitchesBaked = true;/u);
  assert.match(cpp, /int FBro_设置启动开关JSON\(const wchar_t\* switchesJson\)/u);
});

test('FBro 启动开关白名单外键与非法 JSON 在生成前中文阻断', () => {
  const cases: Array<[string, string]> = [
    ['{\\"noSandbox\\":true}', '不在白名单内'],
    ['{\\"disableGpu\\":\\"yes\\"}', '必须是 true 或 false'],
    ['{disableGpu:true}', '不是合法 JSON'],
    ['[\\"disableGpu\\"]', '只接受单层 JSON 对象']
  ];
  for (const [literal, expected] of cases) {
    const source = '类 MainWindow\n    事件 _MainWindow_创建完毕()\n'
      + `        调试输出(FBro_设置启动开关JSON("${literal}"))\n`
      + '    结束\n结束类';
    const { generated } = generatedMain(fbroSwitchProject({}), source);
    assert.ok(generated.blockingDiagnostics.some(item => item.includes(expected)),
      `开关文本 ${literal} 必须给出含「${expected}」的生成前阻断诊断`);
  }
});

test('字符串与注释里的 FBro_设置启动开关JSON 不触发烘焙', () => {
  const source = '类 MainWindow\n    事件 _MainWindow_创建完毕()\n'
    + '        // 调试输出(FBro_设置启动开关JSON("{\\"disableGpu\\":true}"))\n'
    + '        调试输出("FBro_设置启动开关JSON(\\"{\u005c\\"disableGpu\\":true\u005c\\"}")")\n'
    + '    结束\n结束类';
  const { generated, cpp } = generatedMain(fbroSwitchProject({}), source);
  assert.equal(generated.blockingDiagnostics.filter(item => item.includes('启动开关')).length, 0);
  const bakedLine = cpp.split(String.fromCharCode(10)).find(line => line.includes('LB_FBro_SetStartupSwitches')) || '';
  assert.equal(bakedLine, '', '被注释与被字符串遮蔽的命令名不得进入启动开关烘焙');
  assert.match(cpp, /static const bool g_lingFbroStartupSwitchesBaked = false;/u);
});

test('FBro 启动开关白名单与桥内 kStartupSwitchKeys 不漂移', async () => {
  const { FBRO_STARTUP_SWITCH_KEYS } = await import('../src/services/windowDesigner/lingCppWin32Project');
  const fs = await import('node:fs/promises');
  const bridgeSource = await fs.readFile(new URL('../native/fbro-bridge/LingBuilderFbroBridge.cpp', import.meta.url), 'utf8');
  const block = bridgeSource.slice(
    bridgeSource.indexOf('kStartupSwitchKeys[]'),
    bridgeSource.indexOf('ValidateStartupSwitchJson'));
  const bridgeKeys = [...block.matchAll(/L"([A-Za-z]+)"/gu)].map(match => match[1]);
  assert.deepEqual(bridgeKeys.sort(),
    [...FBRO_STARTUP_SWITCH_KEYS, 'headless'].sort(),
    '桥内白名单与生成器白名单必须一一对应：新增开关要同时改两处');

  // 应用函数只能调官方语义化包装：出现裸 AppendSwitch 就等于把不受控的进程级命令行开放出去。
  const apply = bridgeSource.slice(bridgeSource.indexOf('void ApplyStartupSwitchesTo'),
    bridgeSource.indexOf('const wchar_t* const kStartupSwitchKeys[]'));
  assert.ok(apply.includes('FBroHsCommandLine_EnableCrossFrame(command_line)'), '跨域必须走官方 EnableCrossFrame');
  assert.ok(apply.includes('FBroHsCommandLine_DisableProxy(command_line)'), '禁用代理必须走官方 DisableProxy');
  assert.ok(!/AppendSwitch|AppendSwitchWithValue/u.test(apply),
    '启动开关应用函数不得拼裸命令行开关（否则白名单形同虚设）');
  for (const key of [...FBRO_STARTUP_SWITCH_KEYS, 'headless']) {
    assert.ok(apply.includes(`SwitchJsonEnabled(json, L"${key}")`), `应用函数必须处理开关 ${key}`);
  }

  // 导出侧守卫：初始化后拒绝、非白名单 JSON 拒绝、写入必须在 g_mutex 之下（OnBeforeCommandLineProcessing 持同一把锁读）。
  const exportStart = bridgeSource.indexOf('int __stdcall LB_FBro_SetStartupSwitches');
  assert.ok(exportStart > 0, '缺少 LB_FBro_SetStartupSwitches 导出');
  const exportBody = bridgeSource.slice(exportStart, bridgeSource.indexOf('int __stdcall LB_FBro_GetStartupCommandLine'));
  assert.equal(exportBody.match(/if \(g_initialized\) return LB_FBRO_ERROR_OPERATION_FAILED;/gu).length, 2,
    '空文本与非空文本两条路径都必须在已初始化后拒绝');
  assert.ok(exportBody.includes('if (!ValidateStartupSwitchJson(json)) return LB_FBRO_ERROR_INVALID_ARGUMENT;'),
    '白名单校验必须在导出内完成');
  assert.ok(exportBody.indexOf('std::lock_guard<std::recursive_mutex> lock(g_mutex)') < exportBody.indexOf('g_startup_switches_json = json;'),
    '写入 g_startup_switches_json 必须先持 g_mutex');
});
