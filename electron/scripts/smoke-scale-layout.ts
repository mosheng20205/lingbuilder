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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'scale-layout-smoke');
const windowTitle = '等比缩放冒烟';

interface ProbeRect { left: number; top: number; right: number; bottom: number; class: string; text: string }

/** 2026-10-30 真机验收：窗口级等比缩放（布局系统二期）——MSVC 双编译 + 程序化拉伸实测 min(宽比,高比) 整体缩放。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('等比缩放冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'scale-layout-smoke',
    name: '等比缩放冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: windowTitle,
      width: 800,
      height: 600,
      background: '#1f2937',
      description: '验证 scaleContentWithWindow：拉伸窗口时全部控件按 min(宽比,高比) 整体缩放，工具栏豁免',
      resizable: true,
      borderStyle: 'normal-resizable',
      scaleContentWithWindow: true,
      controls: [
        { id: 'ctrl-toolbar', type: 'ToolBar', name: '工具栏1', content: '', x: 0, y: 0, width: 480, height: 34, fontSize: 12, background: '#333333', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-edit', type: 'TextBox', name: '编辑框1', content: '', x: 24, y: 48, width: 752, height: 40, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { multiline: true } },
        { id: 'ctrl-list', type: 'ListBox', name: '列表1', content: '', x: 24, y: 104, width: 300, height: 380, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-corner', type: 'Button', name: '右下按钮', content: '右下按钮', x: 656, y: 520, width: 120, height: 35, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        控件_添加项目(列表1, "缩放项 1")',
    '        控件_设置文本(编辑框1, "拉伸窗口后整体应等比缩放")',
    '        调试输出("等比缩放冒烟就绪")',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(moduleId => {
    const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
    if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
    return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
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
  for (const symbol of ['bool scaleContent;', 'void ApplyScaleLayout_(int newClientWidth, int newClientHeight)', 'if (spec_.scaleContent) ApplyScaleLayout_(nextWidth, nextHeight);']) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少等比缩放运行时符号：${symbol}`);
  }
  // 互斥：等比窗口内控件即便残留 anchor 也必须发射 0 掩码，锚定运行时不发射。
  if (runtimeHeader.includes('void ApplyAnchorLayout_(int newClientWidth')) {
    throw new Error('等比缩放项目不应发射锚定运行时（互斥失效）。');
  }
  if (/L"右下按钮"[^\n]*, [1-9] \}/u.test(runtimeHeader)) {
    throw new Error('等比缩放窗口内控件 anchor 未被抑制（应发射 0 掩码）。');
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
    console.log(`PASS MSVC ${platform} 编译：${executable}`);
    if (platform === 'x64') {
      await verifyScaleResize(executable);
      console.log('PASS 程序化拉伸：全部控件按 min(宽比,高比) 等比缩放，工具栏保持基线');
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function verifyScaleResize(executable: string): Promise<void> {
  const probeScript = path.join(projectDir, 'scale-probe.ps1');
  // PowerShell 5.1 对无 BOM 的 .ps1 按 ANSI 解码，中文窗口名会乱码导致查找失败——必须带 BOM。
  await fs.writeFile(probeScript, `\uFEFF${buildProbeScript()}`, 'utf8');
  const child = spawn(executable, [], { stdio: 'ignore', detached: false });
  try {
    await waitForWindow(probeScript);
    const run = async (phase: string) => {
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript, '-Phase', phase],
        { windowsHide: false, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
      );
      const lines = stdout.split(/\r?\n/).filter(line => line.startsWith('CTL|'));
      if (lines.length < 4) throw new Error(`探针只抓到 ${lines.length} 个子控件（${phase}）。\n${stdout}`);
      return lines.map(line => {
        const [, className, text, left, top, right, bottom] = line.split('|');
        return { class: className, text, left: Number(left), top: Number(top), right: Number(right), bottom: Number(bottom) } as ProbeRect;
      });
    };
    const before = await run('before');
    const { stdout: resizeOutput } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript, '-Phase', 'resize'],
      { windowsHide: false, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 }
    );
    const sizes = resizeOutput.split(/\r?\n/).filter(line => line.startsWith('SIZE|')).map(line => line.split('|'));
    if (sizes.length < 2) throw new Error(`探针未取到拉伸前后客户区尺寸。\n${resizeOutput}`);
    const beforeClient = { width: Number(sizes[0][1]), height: Number(sizes[0][2]) };
    const afterClient = { width: Number(sizes[1][1]), height: Number(sizes[1][2]) };
    await new Promise(resolve => setTimeout(resolve, 400));
    const after = await run('after');
    if (after.length !== before.length) throw new Error(`拉伸前后子控件数量不一致：${before.length} → ${after.length}`);

    const factor = Math.min(afterClient.width / beforeClient.width, afterClient.height / beforeClient.height);
    if (factor <= 1.001) throw new Error(`客户区未变大：${beforeClient.width}x${beforeClient.height} → ${afterClient.width}x${afterClient.height}`);

    const ratioError = (label: string, beforeValue: number, afterValue: number) => {
      if (beforeValue <= 0) throw new Error(`${label} 基线尺寸非法：${beforeValue}`);
      const ratio = afterValue / beforeValue;
      if (Math.abs(ratio - factor) > factor * 0.03) {
        throw new Error(`${label} 缩放比不符：实际 ${ratio.toFixed(4)}，期望 ${factor.toFixed(4)}（客户区 ${beforeClient.width}x${beforeClient.height} → ${afterClient.width}x${afterClient.height}）。`);
      }
    };
    const pairByContent = (needle: string) => {
      const index = before.findIndex(item => item.text.includes(needle));
      if (index < 0) throw new Error(`探针未找到控件：${needle}`);
      return { beforeRect: before[index], afterRect: after[index] };
    };

    // 右下按钮：位置与尺寸同因子
    const corner = pairByContent('右下按钮');
    ratioError('右下按钮 左距', corner.beforeRect.left, corner.afterRect.left);
    ratioError('右下按钮 顶距', corner.beforeRect.top, corner.afterRect.top);
    ratioError('右下按钮 宽', corner.beforeRect.right - corner.beforeRect.left, corner.afterRect.right - corner.afterRect.left);
    ratioError('右下按钮 高', corner.beforeRect.bottom - corner.beforeRect.top, corner.afterRect.bottom - corner.afterRect.top);

    // 编辑框帧（最宽空 STATIC）：位置与尺寸同因子
    let widestIndex = -1;
    let widestWidth = -1;
    before.forEach((item, index) => {
      const width = item.right - item.left;
      if (item.class.toLowerCase() === 'static' && item.text === '' && width > widestWidth) { widestWidth = width; widestIndex = index; }
    });
    if (widestIndex < 0) throw new Error('探针未找到编辑框外框（STATIC 帧）。');
    const editBefore = before[widestIndex];
    const editAfter = after[widestIndex];
    ratioError('编辑框帧 宽', editBefore.right - editBefore.left, editAfter.right - editAfter.left);
    ratioError('编辑框帧 高', editBefore.bottom - editBefore.top, editAfter.bottom - editAfter.top);

    // 列表帧：空文本 STATIC 中顶距最大者
    let listFrameIndex = -1;
    let listFrameTop = -1;
    before.forEach((item, index) => {
      if (index === widestIndex || item.class.toLowerCase() !== 'static' || item.text !== '') return;
      if (item.top > listFrameTop) { listFrameTop = item.top; listFrameIndex = index; }
    });
    if (listFrameIndex < 0) throw new Error('探针未找到列表外框（STATIC 帧）。');
    ratioError('列表帧 宽', before[listFrameIndex].right - before[listFrameIndex].left, after[listFrameIndex].right - after[listFrameIndex].left);
    ratioError('列表帧 高', before[listFrameIndex].bottom - before[listFrameIndex].top, after[listFrameIndex].bottom - after[listFrameIndex].top);

    // 工具栏豁免：ToolBar HWND 无窗口标题（文本在按钮数据里），改按「存在完全不变的控件」验证——
    // factor > 1 时所有参与等比缩放的控件矩形必变，唯一不变的就是豁免管线类型（工具栏）。
    const unchanged = before.some((item, index) => {
      const other = after[index];
      return other
        && item.left === other.left && item.top === other.top
        && item.right === other.right && item.bottom === other.bottom;
    });
    if (!unchanged) {
      throw new Error('未发现保持基线的豁免控件（工具栏应不参与等比缩放）。');
    }
  } finally {
    if (child.pid) {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 收尾失败不掩盖主结论 */ }
    }
  }
}

async function waitForWindow(probeScript: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript, '-Phase', 'exists'
      ], { windowsHide: true, timeout: 30_000 });
      if (stdout.includes('FOUND')) return;
    } catch { /* 窗口尚未出现，继续等 */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('60 秒内未检测到冒烟窗口。');
}

function buildProbeScript(): string {
  return `
param([string]$Phase)
# node 按 UTF-8 解码 stdout；PowerShell 5.1 控制台默认 GBK，必须显式切 UTF-8。
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ScaleProbe {
    public delegate bool EnumProc(IntPtr hwnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hwnd, EnumProc proc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hwnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr hwnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassNameW(IntPtr hwnd, StringBuilder text, int maxCount);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr after, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hwnd, out POINT point);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
    public struct POINT { public int X; public int Y; }

    // 本沙箱环境 FindWindowW 对任意窗口（含 Progman）都返回 0，EnumWindows 正常——
    // 统一走 EnumWindows 精确标题匹配，不用 FindWindow。
    public static IntPtr FindByTitle(string title) {
        IntPtr found = IntPtr.Zero;
        EnumWindows(delegate(IntPtr hwnd, IntPtr lParam) {
            if (found != IntPtr.Zero) return false;
            StringBuilder text = new StringBuilder(256);
            GetWindowTextW(hwnd, text, 256);
            if (IsWindowVisible(hwnd) && text.ToString() == title) found = hwnd;
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
'@
[ScaleProbe]::SetProcessDPIAware() | Out-Null
$hwnd = [ScaleProbe]::FindByTitle('${windowTitle}')
if ($Phase -eq 'exists') {
    if ($hwnd -ne [IntPtr]::Zero -and [ScaleProbe]::IsWindowVisible($hwnd)) { Write-Output 'FOUND' }
    exit 0
}
if ($hwnd -eq [IntPtr]::Zero) { throw "未找到窗口：${windowTitle}" }
function Get-Children {
    $list = New-Object System.Collections.ArrayList
    # 输出客户区相对坐标：等比断言按比值比较，必须扣除窗口原点屏偏移（每次启动位置不同）。
    $origin = New-Object ScaleProbe+POINT
    [ScaleProbe]::ClientToScreen($hwnd, [ref]$origin) | Out-Null
    $callback = [ScaleProbe+EnumProc]{
        param($child, $lParam)
        $rect = New-Object ScaleProbe+RECT
        [ScaleProbe]::GetWindowRect($child, [ref]$rect) | Out-Null
        $name = New-Object System.Text.StringBuilder 256
        [ScaleProbe]::GetWindowTextW($child, $name, 256) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [ScaleProbe]::GetClassNameW($child, $cls, 256) | Out-Null
        [void]$list.Add("CTL|$($cls.ToString())|$($name.ToString())|$($rect.Left - $origin.X)|$($rect.Top - $origin.Y)|$($rect.Right - $origin.X)|$($rect.Bottom - $origin.Y)")
        return $true
    }
    [ScaleProbe]::EnumChildWindows($hwnd, $callback, [IntPtr]::Zero) | Out-Null
    return $list
}
if ($Phase -eq 'before' -or $Phase -eq 'after') {
    Get-Children | ForEach-Object { Write-Output $_ }
    exit 0
}
if ($Phase -eq 'resize') {
    $clientBefore = New-Object ScaleProbe+RECT
    [ScaleProbe]::GetClientRect($hwnd, [ref]$clientBefore) | Out-Null
    Write-Output "SIZE|$($clientBefore.Right - $clientBefore.Left)|$($clientBefore.Bottom - $clientBefore.Top)"
    $outer = New-Object ScaleProbe+RECT
    [ScaleProbe]::GetWindowRect($hwnd, [ref]$outer) | Out-Null
    $newWidth = ($outer.Right - $outer.Left) + 1000
    $newHeight = ($outer.Bottom - $outer.Top) + 800
    [ScaleProbe]::SetWindowPos($hwnd, [IntPtr]::Zero, $outer.Left, $outer.Top, $newWidth, $newHeight, 0x0004) | Out-Null
    Start-Sleep -Milliseconds 350
    $clientAfter = New-Object ScaleProbe+RECT
    [ScaleProbe]::GetClientRect($hwnd, [ref]$clientAfter) | Out-Null
    Write-Output "SIZE|$($clientAfter.Right - $clientAfter.Left)|$($clientAfter.Bottom - $clientAfter.Top)"
    exit 0
}
`;
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
