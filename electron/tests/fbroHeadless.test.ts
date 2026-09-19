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
