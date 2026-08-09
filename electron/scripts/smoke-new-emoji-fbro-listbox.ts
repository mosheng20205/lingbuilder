import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { createSolutionService } from '../src/services/solution/solutionService';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-listbox';
const buildDirectory = path.join(repoRoot, '.lingbuilder-build', 'new-emoji-fbro-listbox-native-smoke');
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));
const buildOnly = process.argv.includes('--build-only');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return {
    manifest,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

function assertGeneratedListBoxBinding(mainSource: string) {
  const requiredFragments = [
    'EU_SetListBoxChangeCallback',
    'browser-baidu',
    'browser-bing',
    'browser-github',
    'FBro_显示(L"百度浏览器")',
    'FBro_显示(L"必应浏览器")',
    'FBro_显示(L"代码托管浏览器")'
  ];
  const missing = requiredFragments.filter(fragment => !mainSource.includes(fragment));
  if (missing.length > 0) {
    throw new Error(`生成代码缺少 ListBox 多浏览器绑定：${missing.join('、')}`);
  }
}

async function verifyListBoxSwitching(processId: number) {
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class LingBuilderListBoxSmokeNative {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  public static long[] VisibleBrowserHosts(IntPtr root, int expectedWidth, int expectedHeight) {
    var result = new List<long>();
    EnumChildWindows(root, (hwnd, _) => {
      var name = new StringBuilder(64);
      RECT rect;
      GetClassName(hwnd, name, name.Capacity);
      GetWindowRect(hwnd, out rect);
      if (name.ToString() == "Static" && IsWindowVisible(hwnd)
          && Math.Abs((rect.Right - rect.Left) - expectedWidth) <= 4
          && Math.Abs((rect.Bottom - rect.Top) - expectedHeight) <= 4) result.Add(hwnd.ToInt64());
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }
  public static void Click(IntPtr root, int x, int y) {
    var point = new IntPtr((y << 16) | (x & 0xffff));
    PostMessage(root, 0x0201, new IntPtr(1), point);
    PostMessage(root, 0x0202, IntPtr.Zero, point);
  }
}
'@
$process = Get-Process -Id ${processId} -ErrorAction Stop
$window = $process.MainWindowHandle
if ($window -eq 0) { throw '原生程序没有主窗口句柄。' }
$dpi = [LingBuilderListBoxSmokeNative]::GetDpiForWindow($window)
if ($dpi -le 0) { $dpi = 96 }
$scale = [double]$dpi / 96.0
$expectedWidth = [int][Math]::Round(988 * $scale)
$expectedHeight = [int][Math]::Round(680 * $scale)
$initial = @([LingBuilderListBoxSmokeNative]::VisibleBrowserHosts($window, $expectedWidth, $expectedHeight))
[LingBuilderListBoxSmokeNative]::Click($window, [int][Math]::Round(100 * $scale), [int][Math]::Round(162 * $scale))
Start-Sleep -Seconds 3
$second = @([LingBuilderListBoxSmokeNative]::VisibleBrowserHosts($window, $expectedWidth, $expectedHeight))
[LingBuilderListBoxSmokeNative]::Click($window, [int][Math]::Round(100 * $scale), [int][Math]::Round(218 * $scale))
Start-Sleep -Seconds 3
$third = @([LingBuilderListBoxSmokeNative]::VisibleBrowserHosts($window, $expectedWidth, $expectedHeight))
if ($initial.Count -ne 1 -or $second.Count -ne 1 -or $third.Count -ne 1) {
  throw "ListBox 切换时可见 FBro 宿主数量错误：$($initial.Count)/$($second.Count)/$($third.Count)。"
}
if ($initial[0] -eq $second[0] -or $second[0] -eq $third[0] -or $initial[0] -eq $third[0]) {
  throw "ListBox 三次选择没有切换到三个不同的 FBro 宿主：$($initial[0])/$($second[0])/$($third[0])。"
}
[PSCustomObject]@{ dpi = $dpi; initialHost = $initial[0]; secondHost = $second[0]; thirdHost = $third[0] } | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout.trim()) as { dpi: number; initialHost: number; secondHost: number; thirdHost: number };
}

async function main() {
  const newEmojiInstallPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const newEmojiManifest = JSON.parse(await fs.readFile(path.join(newEmojiInstallPath, 'lingbuilder.module.json'), 'utf8'));
  const enabledModules: InstalledModule[] = [
    builtin('lingbuilder.win32.basic'),
    {
      manifest: newEmojiManifest,
      installPath: newEmojiInstallPath,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    },
    builtin('lingbuilder.fbro.browser')
  ];
  const project = JSON.parse(await fs.readFile(
    path.join(repoRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json'),
    'utf8'
  )) as LingWindowProject;
  const source = await fs.readFile(path.join(repoRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8');
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));

  const mainFile = generated.files.find(file => file.relativePath.replaceAll('\\', '/') === 'main.cpp');
  if (!mainFile) throw new Error('原生生成结果缺少 main.cpp。');
  assertGeneratedListBoxBinding(mainFile.content);

  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const solution = await createSolutionService(repoRoot).getSolution();
  const projectRef = solution.projects.find(item => item.id === projectId);
  if (!projectRef) throw new Error(`解决方案缺少 smoke 项目：${projectId}`);
  const iconService = createWindowsExecutableIconService(
    repoRoot,
    createDesignerAssetService(repoRoot),
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico')
  );
  await iconService.materialize(projectRef, project.windows[0], [buildDirectory]);
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir: buildDirectory,
    projectId,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/v:minimal'
  ], {
    cwd: buildDirectory,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  if (buildOnly) {
    console.log(JSON.stringify({ ok: true, buildOnly: true, buildDirectory, executable }, null, 2));
    return;
  }

  const runtime = spawn(executable, [], {
    cwd: path.dirname(executable),
    windowsHide: true,
    stdio: 'ignore'
  });
  await new Promise<void>((resolve, reject) => {
    runtime.once('spawn', resolve);
    runtime.once('error', reject);
  });
  if (!runtime.pid) throw new Error('原生运行 smoke 未取得进程 ID。');

  let fbroProcessCount = 0;
  let rendererProcessCount = 0;
  let listBoxSwitching: Awaited<ReturnType<typeof verifyListBoxSwitching>> | undefined;
  try {
    await delay(10_000);
    if (runtime.exitCode !== null) throw new Error(`原生程序提前退出，退出码：${runtime.exitCode}`);
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`
    ], { windowsHide: true, timeout: 30_000 });
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const fbroProcesses = Array.isArray(parsed) ? parsed : [parsed];
    fbroProcessCount = fbroProcesses.length;
    rendererProcessCount = fbroProcesses.filter(item => String(item.CommandLine || '').includes('--type=renderer')).length;
    if (rendererProcessCount < 3) {
      throw new Error(`三个 ListBox 表项对应的 FBro 实例未全部启动：检测到 ${rendererProcessCount} 个 renderer（总子进程 ${fbroProcessCount} 个）。`);
    }
    listBoxSwitching = await verifyListBoxSwitching(runtime.pid);
  } finally {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$children=@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\"); Stop-Process -Id ${runtime.pid} -Force -ErrorAction SilentlyContinue; $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
    ], { windowsHide: true, timeout: 30_000 }).catch(() => undefined);
  }

  console.log(JSON.stringify({
    ok: true,
    buildDirectory,
    executable,
    fbroProcessCount,
    rendererProcessCount,
    listBoxSwitching
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
