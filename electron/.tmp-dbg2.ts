import { generateLingCppNativeWin32Project } from './src/services/windowDesigner/lingCppWin32Project';
import { BUILTIN_MODULES } from './src/services/modules/builtinModules';
import type { InstalledModule, LingWindowProject } from './src/services/windowDesigner/types';
const mod = {
  manifest: BUILTIN_MODULES.find(i => i.id === 'lingbuilder.fbro.browser')!,
  installPath: 'builtin://x', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: []
} as unknown as InstalledModule;
const project = (props: Record<string, unknown>) => ({
  id: 'p', name: 'p', resources: [],
  windows: [{ id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MainWindow',
    width: 640, height: 480, background: '#202020', description: 'd', events: {},
    controls: [{ id: 'fbro-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 1, y: 1,
      width: 40, height: 40, background: '#fff', foreground: '#000', fontSize: 14, isEnabled: true,
      visibility: 'Visible', properties: props, events: {} }] }]
}) as unknown as LingWindowProject;
const src = (literal: string) => '类 MainWindow\n    事件 _MainWindow_创建完毕()\n'
  + `        调试输出(FBro_设置启动开关JSON("${literal}"))\n    结束\n结束类`;
for (const literal of ['{\\"disableGpu\\":true,\\"enableCrossFrame\\":false}', '{\\"noSandbox\\":true}', '{\\"disableGpu\\":\\"yes\\"}', '{disableGpu:true}', '[\\"disableGpu\\"]']) {
  const g = generateLingCppNativeWin32Project(project({}), { enabledModules: [mod], lingCppSourceCode: src(literal) });
  const cpp = g.files.find(f => f.relativePath === 'main.cpp')!.content;
  const baked = cpp.split('\n').filter(l => l.includes('SetStartupSwitches')).join(' | ');
  console.log('LIT>', literal);
  console.log('   blocking:', JSON.stringify(g.blockingDiagnostics));
  console.log('   baked:', baked.slice(0, 140));
}
