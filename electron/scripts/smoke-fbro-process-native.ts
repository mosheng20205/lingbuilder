import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'fbro-process-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function countHostProcesses(): Promise<number> {
  const command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'LingBuilderFbroHost.exe'\").Count";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

/** 只数宿主进程会漏掉「进程起来了但顶层窗口从未显示」这一类缺陷，必须直接看窗口。
 *  宿主窗口由独立的 LingBuilderFbroHost.exe 创建，用 owner 窗口的进程号锁定本次冒烟自己拉起的那个。 */
async function countVisibleHostWindows(demoPid: number): Promise<number> {
  const source = [
    'using System; using System.Text; using System.Runtime.InteropServices;',
    'public static class LBHostWindowProbe {',
    '  delegate bool EnumProc(IntPtr h, IntPtr l);',
    '  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);',
    '  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);',
    '  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
    '  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
    '  public static int Count(int targetPid) { int n = 0; EnumWindows((h, l) => {',
    '    var b = new StringBuilder(256); GetClassName(h, b, 256);',
    '    if (b.ToString() != "LingBuilder.FBro.Host.Browser" || !IsWindowVisible(h)) return true;',
    '    IntPtr owner = GetWindow(h, 4); uint ownerPid = 0;',
    '    if (owner != IntPtr.Zero) { GetWindowThreadProcessId(owner, out ownerPid); if (ownerPid == (uint)targetPid) n++; }',
    '    return true; }, IntPtr.Zero); return n; }',
    '}'
  ].join('\n');
  const script = [
    `$source = @'\n${source}\n'@`,
    'Add-Type -TypeDefinition $source -Language CSharp',
    `[LBHostWindowProbe]::Count(${demoPid})`
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, message: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

async function findMsBuild(): Promise<string> {
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  try {
    const { stdout } = await execFileAsync(vswhere,
      ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-find', 'MSBuild\\**\\Bin\\MSBuild.exe'],
      { windowsHide: true });
    const found = stdout.split(/\r?\n/).map(line => line.trim()).find(Boolean);
    if (found) return found;
  } catch { /* 没有 vswhere 时回退到固定安装路径 */ }
  const fallback = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await fs.access(fallback);
  return fallback;
}

/** 导出工程写死 v143；本机可能只装了更新的工具集（MSB8020），按实际安装情况覆盖。 */
async function installedToolset(msbuild: string): Promise<string | undefined> {
  const vcRoot = path.join(path.dirname(msbuild), '..', '..', 'Microsoft', 'VC');
  const versions = (await fs.readdir(vcRoot).catch(() => [])).filter(name => /^v\d+$/.test(name)).sort().reverse();
  for (const version of versions) {
    const toolsets = (await fs.readdir(path.join(vcRoot, version, 'Platforms', 'x64', 'PlatformToolsets')).catch(() => []))
      .filter(name => /^v\d+$/.test(name)).sort();
    if (toolsets.length) return toolsets[toolsets.length - 1];
  }
  return undefined;
}

async function copyDefaultIcon(): Promise<void> {
  const candidates = [
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repoRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
      return;
    } catch {
      // Try the next development resource path.
    }
  }
  throw new Error('多进程冒烟测试缺少 LingBuilder 默认窗口图标。');
}

async function main(): Promise<void> {
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.fbro.browser')];
  const project: LingWindowProject = {
    id: 'fbro-process-native-smoke', name: 'FBro 独立进程原生冒烟', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 独立进程冒烟',
      width: 720, height: 460, background: '#202124', description: '验证 FBro Host 多进程控制', controls: [
        {
          id: 'fbro-embedded', type: 'FBroBrowser', name: 'FBro嵌入浏览器', content: '', x: 16, y: 16,
          width: 660, height: 190, background: '#ffffff', foreground: '#000000', fontSize: 14,
          isEnabled: true, visibility: 'Visible',
          properties: { processMode: 'independent-embedded', url: 'https://example.com/?host=embedded', cacheDir: '', enableJs: true, enableDevTools: true, loadImages: true, proxyMode: 'system' },
          events: { Created: 'FBro嵌入浏览器_创建完成', Error: 'FBro嵌入浏览器_错误' }
        },
        {
          id: 'fbro-window', type: 'FBroBrowser', name: 'FBro窗口浏览器', content: '', x: 16, y: 225,
          width: 660, height: 190, background: '#ffffff', foreground: '#000000', fontSize: 14,
          isEnabled: true, visibility: 'Visible',
          properties: { processMode: 'independent-window', url: 'https://example.com/?host=window', cacheDir: '', enableJs: true, enableDevTools: true, loadImages: true, proxyMode: 'system' },
          events: { Created: 'FBro窗口浏览器_创建完成', Error: 'FBro窗口浏览器_错误' }
        }
      ]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 FBro嵌入浏览器_创建完成()',
      '        FBro_导航(FBro嵌入浏览器, "https://example.com/?command=navigate")',
      '        FBro_设置缩放级别(FBro嵌入浏览器, 0)',
      '        FBro_设置静音(FBro嵌入浏览器, 真)',
      '        FBro_隐藏(FBro嵌入浏览器)',
      '        FBro_显示(FBro嵌入浏览器)',
      '        调试输出(FBro_取进程状态(FBro嵌入浏览器), FBro_取进程ID(FBro嵌入浏览器), FBro_取调试端口(FBro嵌入浏览器))',
      '    结束',
      '    事件 FBro窗口浏览器_创建完成()',
      '        FBro_调整大小(FBro窗口浏览器, 640, 420)',
      '        调试输出(FBro_执行JS(FBro窗口浏览器, "document.title"))',
      '    结束',
      '    事件 FBro嵌入浏览器_错误()',
      '        调试输出(FBro_取最近错误(FBro嵌入浏览器))',
      '    结束',
      '    事件 FBro窗口浏览器_错误()',
      '        调试输出(FBro_取最近错误(FBro窗口浏览器))',
      '    结束',
      '结束类'
    ].join('\n')
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  if (!generated.files.find(file => file.relativePath === 'main.cpp')?.content.includes('LB_FBroProcess_RunHostIfRequested')) {
    throw new Error('生成结果未包含 FBro Host 入口。');
  }
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await copyDefaultIcon();
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64',
    ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const before = await countHostProcesses();
  // windowsHide 会让主窗口以 SW_HIDE 启动，宿主顶层窗口是主窗口的 owned 窗口，
  // 那时 IsWindowVisible 永远为假，可见性断言不可能通过。
  const runtime = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: false, stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => { runtime.once('spawn', resolve); runtime.once('error', reject); });
  try {
    await waitUntil(async () => (await countHostProcesses()) >= before + 2, 30000, '未在 30 秒内启动两个 FBro 独立 Host 进程。');
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (runtime.exitCode !== null) throw new Error(`主程序在独立 Host 运行期间异常退出，退出码：${runtime.exitCode}`);
    // 独立进程握手（Start 每个实例最多阻塞界面线程 15 秒）发生在 WM_CREATE 内，
    // 主窗口和独立顶层宿主窗口要等所有实例握手完成才会出现，本机实测约 30~35 秒。
    await waitUntil(async () => (await countVisibleHostWindows(runtime.pid)) >= 1, 90000,
      '独立顶层窗口模式没有显示 FBro 宿主顶层窗口，只有进程不代表可用。');
  } finally {
    if (runtime.exitCode === null) runtime.kill();
    await waitUntil(async () => (await countHostProcesses()) <= before, 15000, '主程序退出后 FBro Host 进程未被 Job Object 回收。');
  }
  console.log(JSON.stringify({ ok: true, projectDir, executable, hosts: 2 }, null, 2));
}

void main();
