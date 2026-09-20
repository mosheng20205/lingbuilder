import { BUILTIN_MODULES } from './src/services/modules/builtinModules';
import { generateLingCppNativeWin32Project } from './src/services/windowDesigner/lingCppWin32Project';
import type { InstalledModule } from './src/services/modules/types';
import type { LingWindowProject } from './src/services/windowDesigner/types';
import { writeFileSync } from 'node:fs';

const browser = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser')!;
const module: InstalledModule = { manifest: browser, installPath: 'builtin://x', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
const project = { schemaVersion: 2, id: 'p', name: 'p', resources: [], windows: [{ id: 'w', fileName: 'MainWindow.xml', className: '程序', title: 't', width: 640, height: 420, background: '#1e1e1e', description: '', designerBackend: 'win32', controls: [] }] } as unknown as LingWindowProject;
const SOURCE = [
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
  '    调试输出(CEF3无头_取页面文本(1, 8000), CEF3无头_取页面源码(1, 8000))',
  '    调试输出(CEF3无头_是否已创建(1), CEF3无头_是否加载中(1), CEF3无头_取浏览器句柄(1))',
  '    CEF3无头_设置视口(1, 1024, 640)',
  '    CEF3无头_关闭(1)',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
].join('\n');
const g = generateLingCppNativeWin32Project(project, { lingCppSourceCode: SOURCE, outputKind: 'console-application', enabledModules: [module] });
console.log('blocking=', JSON.stringify(g.blockingDiagnostics));
const cpp = g.files.find(f => f.relativePath === 'main.cpp')!.content;
writeFileSync('.tmp-task6-main.cpp', cpp, 'utf8');
console.log('lines=', cpp.split('\n').length);
for (const line of cpp.split('\n')) {
  if (/无头事件上限|记录无头事件|deque<std::wstring> headlessEvents|CEF3_桥接错误文本|CEF3_取标题\(const|CEF3_取地址\(const/.test(line)) console.log('>', line);
}
