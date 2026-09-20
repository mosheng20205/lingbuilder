import { BUILTIN_MODULES } from './src/services/modules/builtinModules';
import { generateLingCppNativeWin32Project } from './src/services/windowDesigner/lingCppWin32Project';
import type { InstalledModule } from './src/services/modules/types';
import type { LingWindowProject } from './src/services/windowDesigner/types';
const m = BUILTIN_MODULES.find(i => i.id === 'lingbuilder.fbro.browser')!;
const mod: InstalledModule = { manifest: m, installPath: 'builtin://x', isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
const project: LingWindowProject = {
  id: 'p', name: 'p', windows: [{
    id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'MainWindow',
    width: 640, height: 480, background: '#202020', description: 'd', controls: [
      { id: 'fbro-1', type: 'FBroBrowser', name: 'FBro浏览器1', content: '', x: 1, y: 1, width: 40, height: 40,
        background: '#fff', foreground: '#000', fontSize: 14, isEnabled: true, visibility: 'Visible',
        properties: { enableCrossFrame: true, disableProxy: true }, events: {} }],
    events: {}
  }], resources: []
} as unknown as LingWindowProject;
const g = generateLingCppNativeWin32Project(project, { enabledModules: [mod], lingCppSourceCode: '类 MainWindow\n    事件 _MainWindow_创建完毕()\n    结束\n结束类' });
const cpp = g.files.find(f => f.relativePath === 'main.cpp')!.content;
console.log('blocking:', JSON.stringify(g.blockingDiagnostics, null, 1));
for (const line of cpp.split('\n')) if (line.includes('SetStartupSwitches') || line.includes('StartupSwitchesBaked')) console.log('LINE>', line);
