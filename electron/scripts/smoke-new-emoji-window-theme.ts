import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const buildDirectory = path.join(repoRoot, '.lingbuilder-build', 'new-emoji-window-theme-smoke');

async function locateMsBuild(): Promise<string> {
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  try {
    const { stdout } = await execFileAsync(vswhere, [
      '-latest', '-requires', 'Microsoft.Component.MSBuild', '-find', 'MSBuild\\**\\Bin\\MSBuild.exe'
    ], { windowsHide: true });
    const candidate = stdout.trim().split(/\r?\n/)[0]?.trim();
    if (candidate) return candidate;
  } catch {
    // vswhere 缺失时回退常见安装路径。
  }
  throw new Error('未找到 MSBuild.exe，请确认 Visual Studio 安装。');
}

function findMsBuildFallback(): string {
  const candidates = [
    'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe'
  ];
  for (const candidate of candidates) {
    if (require('node:fs').existsSync(candidate)) return candidate;
  }
  throw new Error('未找到 MSBuild.exe 常见安装路径。');
}

async function captureWindowPixels(processId: number): Promise<{ center: number[]; topRight: number[]; titleBar: number[] }> {
  const script = `
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ThemeSmokeNative {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
}
'@
Add-Type -AssemblyName System.Drawing
[ThemeSmokeNative]::SetProcessDPIAware() | Out-Null
$process = Get-Process -Id ${processId} -ErrorAction Stop
$window = $process.MainWindowHandle
if ($window -eq [IntPtr]::Zero) { throw '主题冒烟程序没有主窗口句柄。' }
$rect = New-Object ThemeSmokeNative+RECT
[ThemeSmokeNative]::GetClientRect($window, [ref]$rect) | Out-Null
$width = $rect.Right - $rect.Left
$height = $rect.Bottom - $rect.Top
if ($width -le 0 -or $height -le 0) { throw "客户区尺寸异常：$width x $height。" }
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
[ThemeSmokeNative]::PrintWindow($window, $hdc, 2) | Out-Null
$graphics.ReleaseHdc($hdc)
$graphics.Dispose()
$center = $bitmap.GetPixel([int]($width / 2), [int]($height / 2))
$topRight = $bitmap.GetPixel($width - 12, [int]($height / 2))
$titleBar = $bitmap.GetPixel([int]($width / 2), 14)
$bitmap.Dispose()
[PSCustomObject]@{
  center = @($center.R, $center.G, $center.B)
  topRight = @($topRight.R, $topRight.G, $topRight.B)
  titleBar = @($titleBar.R, $titleBar.G, $titleBar.B)
} | ConvertTo-Json -Compress
`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 1024 * 1024
  });
  return JSON.parse(stdout.trim());
}

function assertChannelClose(actual: number, expected: number, tolerance: number, label: string): void {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${label} 颜色偏差超限：实际 ${actual}，期望 ${expected}（容差 ${tolerance}）。`);
  }
}

async function main() {
  const newEmojiInstallPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const newEmojiManifest = JSON.parse(await fs.readFile(path.join(newEmojiInstallPath, 'lingbuilder.module.json'), 'utf8'));
  const enabledModules: InstalledModule[] = [{
    manifest: newEmojiManifest,
    installPath: newEmojiInstallPath,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];

  // 背景 #EFEAFC 与外部用户报障截图同色：浅色背景必须真正渲染浅色窗口。
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'new-emoji-window-theme-smoke',
    name: 'new_emoji 窗口主题冒烟',
    windows: [{
      id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '浅色主题冒烟',
      width: 720, height: 480, background: '#EFEAFC', description: '',
      titleBarBackground: '#FFFFFF', titleBarForeground: '#0F172A',
      controls: [
        { id: 'label_1', type: 'Label', name: '说明文本', content: '左上角标签', x: 24, y: 48, width: 200, height: 28, isEnabled: true, visibility: 'Visible', background: 'transparent', foreground: '', fontSize: 12, fontFamily: 'Microsoft YaHei UI', fontBold: false, fontItalic: false, fontUnderline: false, events: {} }
      ]
    }]
  } as unknown as LingWindowProject;

  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: '类 MainWindow\n    事件 创建完毕()\n        调试输出("主题冒烟")\n    结束\n结束类'
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainFile = generated.files.find(file => file.relativePath.replaceAll('\\', '/') === 'main.cpp');
  if (!mainFile) throw new Error('原生生成结果缺少 main.cpp。');
  for (const fragment of [
    'NE_创建窗口(L"浅色主题冒烟"',
    'EU_SetThemeMode(g_newEmojiWindow, 0);',
    'lbSetWindowThemeToken("panel_bg", 0xFFEFEAFCu);',
    'lbSetWindowThemeToken("titlebar_bg", 0xFFFFFFFFu);',
    'lbSetWindowThemeToken("titlebar_text", 0xFF0F172Au);'
  ]) {
    if (!mainFile.content.includes(fragment)) throw new Error(`生成代码缺少窗口主题片段：${fragment}`);
  }

  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  // 默认图标风格需要先把 lingbuilder 图标物化到构建目录，供生成的 .rc 引用。
  const iconService = createWindowsExecutableIconService(
    repoRoot,
    createDesignerAssetService(repoRoot),
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico')
  );
  await iconService.materialize(
    { id: project.id, name: project.name, sourceRoot: '.' } as never,
    project.windows[0],
    [buildDirectory]
  );
  const exported = await exportVisualStudioProject({
    projectDir: buildDirectory,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = await locateMsBuild().catch(findMsBuildFallback);
  await execFileAsync(msbuild, [
    exported.solutionPath, '/m', '/t:Build',
    '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'
  ], {
    cwd: buildDirectory,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);

  const runtime = spawn(executable, [], { detached: false, stdio: 'ignore' });
  try {
    await new Promise(resolve => setTimeout(resolve, 4000));
    if (runtime.exitCode !== null) throw new Error(`主题冒烟程序提前退出：${runtime.exitCode}`);
    const pixels = await captureWindowPixels(runtime.pid);
    // 背景 #EFEAFC = (239, 234, 252)；标题栏 #FFFFFF = (255, 255, 255)。
    assertChannelClose(pixels.center[0], 239, 14, '客户区中心 R');
    assertChannelClose(pixels.center[1], 234, 14, '客户区中心 G');
    assertChannelClose(pixels.center[2], 252, 14, '客户区中心 B');
    assertChannelClose(pixels.topRight[0], 239, 14, '客户区右上 R');
    assertChannelClose(pixels.topRight[1], 234, 14, '客户区右上 G');
    assertChannelClose(pixels.topRight[2], 252, 14, '客户区右上 B');
    assertChannelClose(pixels.titleBar[0], 255, 14, '标题栏 R');
    assertChannelClose(pixels.titleBar[1], 255, 14, '标题栏 G');
    assertChannelClose(pixels.titleBar[2], 255, 14, '标题栏 B');
    console.log(JSON.stringify({ ok: true, executable, pixels }, null, 2));
  } finally {
    if (runtime.exitCode === null) runtime.kill();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
