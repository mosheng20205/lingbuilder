import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'textbox-rounded-corner-smoke');

/** 2026-11-17 真机验收：编辑框外框圆角改走 GDI+ 抗锯齿路径。MSVC 双编译 + 启动存活 + 四角像素采样。 */
const WINDOW_TITLE = '编辑框圆角冒烟';
// 与窗口背景(#1F2937)、编辑框背景(#0F172A)对应的三个端点色：外框未聚焦边框 RGB(51,65,85)。
const SURROUNDING = [31, 41, 55];
const INTERIOR = [15, 23, 42];
const BORDER = [51, 65, 85];
const CORNER_BOX = 12;
const BLEND_PIXELS_REQUIRED = 3;

// 单次 PowerShell 进程完成全部捕获：Add-Type 编译 2~5 秒，禁止拆成多次调用。
// 输出只写文件不写 stdout，避免 PowerShell 管道编码坑。
const CAPTURE_PS = `\uFEFF
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class LbCap {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr FindWindowW(string cls, string title);
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool ScreenToClient(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr l);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  public static string Children(IntPtr parent) {
    var list = new List<string>();
    EnumChildWindows(parent, (h, l) => {
      var sb = new StringBuilder(256);
      GetClassNameW(h, sb, 256);
      RECT r; GetWindowRect(h, out r);
      POINT p1 = new POINT(); p1.X = r.L; p1.Y = r.T; ScreenToClient(parent, ref p1);
      POINT p2 = new POINT(); p2.X = r.R; p2.Y = r.B; ScreenToClient(parent, ref p2);
      list.Add(sb.ToString() + "," + p1.X + "," + p1.Y + "," + p2.X + "," + p2.Y);
      return true;
    }, IntPtr.Zero);
    return string.Join("|", list);
  }
}
"@
# PS 进程必须 DPI-aware：否则 GetClientRect/子窗口坐标全部经系统虚拟化，与 150% 缩放的
# DPI-aware 目标窗口错位（位图尺寸与实际物理像素不一致，PrintWindow 拉伸或抓黑）。
[LbCap]::SetProcessDPIAware() | Out-Null
$main = [IntPtr]::Zero
for ($i = 0; $i -lt 60; $i++) {
  # PowerShell 5.1 会把 $null marshal 成空串而不是 NULL 指针，FindWindow 必须类名+标题双参数。
  $main = [LbCap]::FindWindowW('LingBuilderChineseCppWindowClass', '${WINDOW_TITLE}')
  if ($main -ne [IntPtr]::Zero) { break }
  Start-Sleep -Milliseconds 250
}
if ($main -eq [IntPtr]::Zero) { throw '未找到主窗口' }
$rect = New-Object LbCap+RECT
if (-not [LbCap]::GetClientRect($main, [ref]$rect)) { throw 'GetClientRect 失败' }
$width = $rect.R - $rect.L
$height = $rect.B - $rect.T
if ($width -le 0 -or $height -le 0) { throw '客户区尺寸异常' }
# 后台窗口的 PrintWindow(PW_RENDERFULLCONTENT) 会抓到全黑（DWM 合成路径）：
# 先置顶到前台保证真实可见，PrintWindow 抓黑时退回屏幕 CopyFromScreen。
[LbCap]::ShowWindow($main, 9)  # SW_RESTORE
[LbCap]::SetWindowPos($main, [IntPtr](-1), 0, 0, 0, 0, 0x53)  # HWND_TOPMOST; SWP_NOMOVE|NOSIZE|SHOWWINDOW
[LbCap]::SetForegroundWindow($main) | Out-Null
Start-Sleep -Milliseconds 500
$origin = New-Object LbCap+POINT; $origin.X = 0; $origin.Y = 0
[LbCap]::ClientToScreen($main, [ref]$origin) | Out-Null
$bitmap = New-Object System.Drawing.Bitmap($width, $height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$hdc = $graphics.GetHdc()
$ok = [LbCap]::PrintWindow($main, $hdc, 3)  # PW_CLIENTONLY | PW_RENDERFULLCONTENT
$graphics.ReleaseHdc($hdc)
$graphics.Dispose()
$method = 'printwindow'
$probe = $bitmap.GetPixel(1, 1)
if ($probe.R -le 2 -and $probe.G -le 2 -and $probe.B -le 2) {
  $screenGraphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $screenGraphics.CopyFromScreen($origin.X, $origin.Y, 0, 0, (New-Object System.Drawing.Size($width, $height)))
  $screenGraphics.Dispose()
  $method = 'screen'
}
$data = $bitmap.LockBits((New-Object System.Drawing.Rectangle(0, 0, $width, $height)), [System.Drawing.Imaging.ImageLockMode]::ReadOnly, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$stride = $data.Stride
$bytes = New-Object byte[] ($stride * $height)
[System.Runtime.InteropServices.Marshal]::Copy($data.Scan0, $bytes, 0, $bytes.Length)
$bitmap.UnlockBits($data)
$bitmap.Dispose()
$children = [LbCap]::Children($main)
$outDir = $args[0]
[System.IO.File]::WriteAllText("$outDir\\capture-manifest.txt", "SIZE,$width,$height\`nSTRIDE,$stride\`nMETHOD,$method\`nCHILDREN,$children", (New-Object System.Text.UTF8Encoding($false)))
[System.IO.File]::WriteAllBytes("$outDir\\capture-pixels.bin", $bytes)
Write-Output 'CAPTURED'
`;

interface CornerReport {
  frame: string;
  corner: string;
  uniqueColors: number;
  blendPixels: number;
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('圆角冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'textbox-rounded-corner-smoke',
    name: '编辑框圆角冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: WINDOW_TITLE,
      width: 640,
      height: 300,
      background: '#1F2937',
      description: '验证编辑框外框圆角由 GDI+ 抗锯齿路径绘制（HRGN/FillRgn 是 1-bit 掩码必然锯齿）',
      controls: [
        { id: 'ctrl-edit', type: 'TextBox', name: '编辑框1', content: '单行', x: 40, y: 40, width: 320, height: 32, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-edit2', type: 'TextBox', name: '编辑框2', content: '', x: 40, y: 100, width: 480, height: 160, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        调试输出("圆角冒烟窗口已创建")',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic'].map(moduleId => {
    const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
    if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
    return {
      manifest,
      installPath: `builtin://${moduleId}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    };
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: source,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  const runtimeHeader = generated.files.map(file => file.content).join('\n');
  const expectedSymbols = [
    'DrawAntiAliasedRoundedRectangle(drawDc, rect, cornerDiameter / 2',
    'TextBoxFrameSubclassProc'
  ];
  for (const symbol of expectedSymbols) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少圆角抗锯齿运行时符号：${symbol}`);
  }

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const resourcesDir = path.join(projectDir, 'resources');
  await fs.mkdir(resourcesDir, { recursive: true });
  await fs.copyFile(
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'),
    path.join(resourcesDir, 'lingbuilder-app.ico')
  );
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = await findMsbuild();
  const executableByPlatform: Record<string, string> = {};
  for (const platform of ['x64', 'Win32']) {
    await execFileAsync(msbuild, [
      exported.solutionPath,
      '/m',
      '/t:Build',
      '/p:Configuration=Release',
      `/p:Platform=${platform}`,
      '/v:minimal'
    ], {
      cwd: projectDir,
      windowsHide: true,
      timeout: 10 * 60 * 1000,
      maxBuffer: 32 * 1024 * 1024
    });
    const executable = path.join(projectDir, platform === 'x64' ? 'x64' : 'Win32', 'Release', 'bin', `${exported.projectName}.exe`);
    await fs.access(executable);
    executableByPlatform[platform] = executable;
    console.log(`PASS MSVC ${platform} 编译：${executable}`);
  }

  const captureDir = path.join(projectDir, 'capture');
  await fs.mkdir(captureDir, { recursive: true });
  const psPath = path.join(captureDir, 'capture-textbox-corner.ps1');
  await fs.writeFile(psPath, CAPTURE_PS, 'utf8');
  const child = spawn(executableByPlatform.x64, [], { stdio: 'ignore', windowsHide: true, detached: false });
  try {
    const alive = await new Promise<boolean>(resolve => {
      const timer = setTimeout(() => resolve(true), 2500);
      child.once('exit', () => { clearTimeout(timer); resolve(false); });
      child.once('error', () => { clearTimeout(timer); resolve(false); });
    });
    if (!alive) throw new Error('x64 exe 启动后 2.5 秒内退出，疑似运行期崩溃。');
    console.log('PASS x64 启动 2.5 秒存活');

    const psOutput = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, captureDir],
      { windowsHide: true, timeout: 90 * 1000, maxBuffer: 8 * 1024 * 1024 }
    );
    if (!psOutput.stdout.includes('CAPTURED')) throw new Error(`捕获脚本未完成：${psOutput.stderr}`);

    const manifest = await fs.readFile(path.join(captureDir, 'capture-manifest.txt'), 'utf8');
    const sizeLine = manifest.split('\n').find(line => line.startsWith('SIZE'));
    if (!sizeLine) throw new Error('捕获清单缺少 SIZE 行。');
    const [, widthText, heightText] = sizeLine.trim().split(',');
    const width = Number(widthText);
    const height = Number(heightText);
    const strideLine = manifest.split('\n').find(line => line.startsWith('STRIDE'));
    if (!strideLine) throw new Error('捕获清单缺少 STRIDE 行。');
    const stride = Number(strideLine.trim().split(',')[1]);
    const pixels = await fs.readFile(path.join(captureDir, 'capture-pixels.bin'));
    const childrenLine = manifest.split('\n').find(line => line.startsWith('CHILDREN'));
    if (!childrenLine) throw new Error('捕获清单缺少 CHILDREN 行。');
    const frames = childrenLine.slice('CHILDREN,'.length).trim().split('|')
      .map(entry => entry.split(','))
      .filter(parts => parts[0].toLowerCase() === 'static')
      .map(parts => ({
        cls: parts[0],
        left: Number(parts[1]),
        top: Number(parts[2]),
        right: Number(parts[3]),
        bottom: Number(parts[4])
      }))
      .filter(rect => rect.right - rect.left > 40 && rect.bottom - rect.top > 20);
    if (frames.length < 2) throw new Error(`应捕获到两个编辑框外框，实际 ${frames.length} 个。`);

    const readPixel = (x: number, y: number): [number, number, number] => {
      const offset = y * stride + x * 4;
      return [pixels[offset + 2], pixels[offset + 1], pixels[offset + 0]];
    };
    const sameColor = (a: [number, number, number], b: readonly number[]) =>
      Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1;
    const isBlend = (p: [number, number, number]) => {
      const endpoints = [SURROUNDING, INTERIOR, BORDER];
      if (endpoints.some(endpoint => sameColor(p, endpoint))) return false;
      for (let i = 0; i < endpoints.length; i++) {
        for (let j = i + 1; j < endpoints.length; j++) {
          const low = endpoints[i].map((v, k) => Math.min(v, endpoints[j][k]) - 1);
          const high = endpoints[i].map((v, k) => Math.max(v, endpoints[j][k]) + 1);
          if (p[0] >= low[0] && p[0] <= high[0] && p[1] >= low[1] && p[1] <= high[1] && p[2] >= low[2] && p[2] <= high[2]) {
            return true;
          }
        }
      }
      return false;
    };

    const reports: CornerReport[] = [];
    for (const frame of frames) {
      const corners: Array<[string, number, number]> = [
        ['top-left', frame.left, frame.top],
        ['top-right', frame.right - CORNER_BOX, frame.top],
        ['bottom-left', frame.left, frame.bottom - CORNER_BOX],
        ['bottom-right', frame.right - CORNER_BOX, frame.bottom - CORNER_BOX]
      ];
      for (const [corner, boxLeft, boxTop] of corners) {
        const colorSet = new Set<string>();
        let blendPixels = 0;
        for (let y = Math.max(0, boxTop); y < Math.min(height, boxTop + CORNER_BOX); y++) {
          for (let x = Math.max(0, boxLeft); x < Math.min(width, boxLeft + CORNER_BOX); x++) {
            const p = readPixel(x, y);
            colorSet.add(p.join(','));
            if (isBlend(p)) blendPixels++;
          }
        }
        reports.push({
          frame: `${frame.left},${frame.top}-${frame.right},${frame.bottom}`,
          corner,
          uniqueColors: colorSet.size,
          blendPixels
        });
      }
    }
    const passingFrames = new Set<string>();
    for (const report of reports) {
      if (report.blendPixels >= BLEND_PIXELS_REQUIRED) passingFrames.add(report.frame);
    }
    console.log('四角采样报告（blendPixels=混合过渡像素数）：');
    for (const report of reports) {
      console.log(`  frame(${report.frame}) ${report.corner}: uniqueColors=${report.uniqueColors} blendPixels=${report.blendPixels}`);
    }
    if (passingFrames.size < 2) {
      throw new Error(`只有 ${passingFrames.size} 个外框的四角存在抗锯齿混合像素（要求 ≥2），圆角仍是硬边。`);
    }
    console.log(`PASS 圆角抗锯齿像素采样：${passingFrames.size}/${frames.length} 个外框四角存在渐变混合像素`);
  } finally {
    if (!child.killed) {
      await new Promise<void>(resolve => {
        execFile('taskkill', ['/PID', String(child.pid), '/F'], () => resolve());
      });
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function findMsbuild(): Promise<string> {
  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await fs.access(msbuild);
  return msbuild;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
