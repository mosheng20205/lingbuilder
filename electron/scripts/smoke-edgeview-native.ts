import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'edgeview-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

function control(fields: Partial<LingControl> & Pick<LingControl, 'id' | 'type' | 'name'>): LingControl {
  return {
    content: '', x: 12, y: 12, width: 360, height: 220, fontSize: 12, background: '#FFFFFF', foreground: '#111827',
    isEnabled: true, visibility: 'Visible', properties: {}, events: {}, ...fields
  };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('EdgeView 冒烟测试目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.win32.common-controls'), builtin('lingbuilder.edgeview')];
  const project: LingWindowProject = {
    schemaVersion: 2, id: 'edgeview-native-smoke', name: 'EdgeView 原生冒烟测试',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'EdgeView 多实例原生冒烟测试',
      width: 1180, height: 760, background: '#202028', description: '根级、分组框和选项卡内独立 WebView2',
      controls: [
        control({ id: 'root-edge', type: 'EdgeBrowser', name: '根级浏览器', x: 12, y: 12, width: 360, height: 280, properties: { url: 'about:blank', cacheDir: '.edgeview/root', userAgent: 'LingBuilder-EdgeView-Smoke/1.1', enableDevTools: false } }),
        control({ id: 'group', type: 'GroupBox', name: '浏览器分组', x: 388, y: 12, width: 380, height: 310, content: '分组框内 Edge' }),
        control({ id: 'group-edge', parentId: 'group', type: 'EdgeBrowser', name: '分组浏览器', x: 12, y: 34, width: 350, height: 250, properties: { url: 'about:blank', cacheDir: '.edgeview/group', muteAudio: true } }),
        control({ id: 'tabs', type: 'TabControl', name: '浏览器选项卡', x: 12, y: 340, width: 756, height: 350, properties: { tabs: [{ id: 'page-a', title: '页面A' }, { id: 'page-b', title: '页面B' }], selectedIndex: 0 } }),
        control({ id: 'tab-edge-a', parentId: 'tabs', containerSlot: 'page-a', type: 'EdgeBrowser', name: '选项卡浏览器A', x: 12, y: 38, width: 710, height: 270, properties: { url: 'about:blank', cacheDir: '.edgeview/tab-a' } }),
        control({ id: 'tab-edge-b', parentId: 'tabs', containerSlot: 'page-b', type: 'EdgeBrowser', name: '选项卡浏览器B', x: 12, y: 38, width: 710, height: 270, visibility: 'Collapsed', properties: { url: 'about:blank', cacheDir: '.edgeview/tab-b' } })
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        EdgeView脚本_文档预注入异步(根级浏览器, "document.body.innerHTML=\'LingBuilder EdgeView smoke\'", &根级浏览器_脚本完成)',
    '    结束',
    '    事件 根级浏览器_脚本完成()',
    '        调试输出(EdgeView任务_取结果(EdgeView任务_取当前任务ID()))',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const results: Array<Record<string, unknown>> = [];
  for (const platform of ['Win32', 'x64'] as const) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 });
    const executable = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    const loader = path.join(path.dirname(executable), 'WebView2Loader.dll');
    await Promise.all([fs.access(executable), fs.access(loader)]);
    const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
    await new Promise(resolve => setTimeout(resolve, 5000));
    if (child.exitCode !== null) throw new Error(`EdgeView ${platform} 冒烟程序提前退出，代码 ${child.exitCode}。`);
    child.kill();
    results.push({ platform, executable, loader, survivedMilliseconds: 5000 });
  }
  console.log(JSON.stringify({ ok: true, projectDir, results }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
