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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'anchor-layout-smoke');
const windowTitle = '锚定拉伸冒烟';

interface ProbeRect { left: number; top: number; right: number; bottom: number; class: string; text: string }

/** 2026-10-29 真机验收：控件锚定布局一期——MSVC 编译 + 启动可调窗口 + 程序化拉伸实测锚定跟随。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('锚定冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'anchor-layout-smoke',
    name: '锚定拉伸冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: windowTitle,
      width: 800,
      height: 600,
      background: '#1f2937',
      description: '验证控件锚定：拉伸窗口时右下按钮跟随、编辑框水平拉伸、列表四向拉伸、固定控件不动',
      resizable: true,
      borderStyle: 'normal-resizable',
      controls: [
        { id: 'ctrl-stretch-edit', type: 'TextBox', name: '拉伸编辑框', content: '', x: 24, y: 24, width: 752, height: 40, fontSize: 12, background: '#2D2D30', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { multiline: true, anchor: 'left,right' } },
        { id: 'ctrl-stretch-list', type: 'ListBox', name: '拉伸列表', content: '', x: 24, y: 80, width: 300, height: 400, fontSize: 12, background: '#0F172A', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { anchor: 'left,top,right,bottom' } },
        { id: 'ctrl-corner-button', type: 'Button', name: '右下按钮', content: '右下按钮', x: 656, y: 520, width: 120, height: 35, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible', properties: { anchor: 'right,bottom' } },
        { id: 'ctrl-fixed-button', type: 'Button', name: '固定按钮', content: '固定按钮', x: 344, y: 300, width: 100, height: 30, fontSize: 12, background: '#4B5563', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        控件_添加项目(拉伸列表, "锚定项 1")',
    '        控件_添加项目(拉伸列表, "锚定项 2")',
    '        控件_设置文本(拉伸编辑框, "拉伸窗口后本框宽度应随窗口变宽")',
    '        调试输出("锚定冒烟就绪")',
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
  for (const symbol of ['int anchorMask;', 'void ApplyAnchorLayout_(int newClientWidth, int newClientHeight)', 'ApplyAnchorLayout_(nextWidth, nextHeight);', 'case WM_GETMINMAXINFO:']) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少锚定运行时符号：${symbol}`);
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
      await verifyAnchorResize(executable);
      console.log('PASS 程序化拉伸：右下按钮跟随、编辑框水平拉伸、列表四向拉伸、固定控件不动');
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function verifyAnchorResize(executable: string): Promise<void> {
  const probeScript = path.join(projectDir, 'anchor-probe.ps1');
  // PowerShell 5.1 对无 BOM 的 .ps1 按 ANSI 解码，中文窗口名会乱码导致 FindWindow 失败——必须带 BOM。
  await fs.writeFile(probeScript, `\uFEFF${buildProbeScript()}`, 'utf8');
  const child = spawn(executable, [], { stdio: 'ignore', detached: false });
  try {
    await waitForWindow();
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

    const clientDx = afterClient.width - beforeClient.width;
    const clientDy = afterClient.height - beforeClient.height;
    if (clientDx <= 0 || clientDy <= 0) throw new Error(`客户区未变大：${beforeClient.width}x${beforeClient.height} → ${afterClient.width}x${afterClient.height}`);

    const tolerance = 2;
    const assertDelta = (label: string, actual: number, expected: number) => {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label} 位移不符：实际 ${actual}，期望 ${expected}（客户区变化 ${clientDx}x${clientDy}）。`);
      }
    };
    const pairByContent = (needle: string) => {
      const beforeIndex = before.findIndex(item => item.text.includes(needle));
      if (beforeIndex < 0) throw new Error(`探针未找到控件：${needle}`);
      return { beforeRect: before[beforeIndex], afterRect: after[beforeIndex] };
    };

    // 右下按钮 right,bottom：位置跟随、宽高不变
    const corner = pairByContent('右下按钮');
    assertDelta('右下按钮 x', corner.afterRect.left - corner.beforeRect.left, clientDx);
    assertDelta('右下按钮 y', corner.afterRect.top - corner.beforeRect.top, clientDy);
    assertDelta('右下按钮 宽', (corner.afterRect.right - corner.afterRect.left) - (corner.beforeRect.right - corner.beforeRect.left), 0);

    // 固定按钮（默认锚定）：完全不动
    const fixed = pairByContent('固定按钮');
    assertDelta('固定按钮 x', fixed.afterRect.left - fixed.beforeRect.left, 0);
    assertDelta('固定按钮 y', fixed.afterRect.top - fixed.beforeRect.top, 0);

    // 编辑框 left,right：宽度拉伸、位置不动。编辑框被 STATIC 帧包裹，取「拉伸前最宽的空文本 STATIC 帧」对比。
    // GetClassNameW 返回注册时的原始大小写（'Static'），类名比对统一不区分大小写。
    let widestIndex = -1;
    let widestWidth = -1;
    before.forEach((item, index) => {
      const width = item.right - item.left;
      if (item.class.toLowerCase() === 'static' && item.text === '' && width > widestWidth) { widestWidth = width; widestIndex = index; }
    });
    if (widestIndex >= 0) {
      const editBefore = before[widestIndex];
      const editAfter = after[widestIndex];
      assertDelta('编辑框帧 x', editAfter.left - editBefore.left, 0);
      assertDelta('编辑框帧 宽', (editAfter.right - editAfter.left) - (editBefore.right - editBefore.left), clientDx);
    } else {
      throw new Error('探针未找到编辑框外框（STATIC 帧）。');
    }

    // 列表 left,top,right,bottom：宽高双向拉伸。锚定作用于帧（空文本 STATIC）；LISTBOX 本体
    // 高度会被 LayoutListBoxControl 钳成行高整数倍（自绘滚动条整行对齐的既有设计），不能作断言对象。
    let listFrameIndex = -1;
    let listFrameTop = -1;
    before.forEach((item, index) => {
      if (index === widestIndex || item.class.toLowerCase() !== 'static' || item.text !== '') return;
      if (item.top > listFrameTop) { listFrameTop = item.top; listFrameIndex = index; }
    });
    if (listFrameIndex >= 0) {
      const listBefore = before[listFrameIndex];
      const listAfter = after[listFrameIndex];
      assertDelta('列表帧 宽', (listAfter.right - listAfter.left) - (listBefore.right - listBefore.left), clientDx);
      assertDelta('列表帧 高', (listAfter.bottom - listAfter.top) - (listBefore.bottom - listBefore.top), clientDy);
      const listBoxIndex = before.findIndex(item => item.class.toLowerCase() === 'listbox');
      if (listBoxIndex >= 0) {
        assertDelta('列表本体 宽', (after[listBoxIndex].right - after[listBoxIndex].left) - (before[listBoxIndex].right - before[listBoxIndex].left), clientDx);
      }
    } else {
      throw new Error('探针未找到四向拉伸列表外框。');
    }
  } finally {
    if (child.pid) {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 收尾失败不掩盖主结论 */ }
    }
  }
}

async function waitForWindow(): Promise<void> {
  const script = path.join(path.resolve(repoRoot, '.lingbuilder-build', 'anchor-layout-smoke'), 'anchor-probe.ps1');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Phase', 'exists'
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
public class AnchorProbe {
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
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hwnd);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

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
[AnchorProbe]::SetProcessDPIAware() | Out-Null
$hwnd = [AnchorProbe]::FindByTitle('${windowTitle}')
if ($Phase -eq 'exists') {
    if ($hwnd -ne [IntPtr]::Zero -and [AnchorProbe]::IsWindowVisible($hwnd)) { Write-Output 'FOUND' }
    exit 0
}
if ($hwnd -eq [IntPtr]::Zero) { throw "未找到窗口：${windowTitle}" }
function Get-Children {
    $list = New-Object System.Collections.ArrayList
    $callback = [AnchorProbe+EnumProc]{
        param($child, $lParam)
        $rect = New-Object AnchorProbe+RECT
        [AnchorProbe]::GetWindowRect($child, [ref]$rect) | Out-Null
        $name = New-Object System.Text.StringBuilder 256
        [AnchorProbe]::GetWindowTextW($child, $name, 256) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [AnchorProbe]::GetClassNameW($child, $cls, 256) | Out-Null
        [void]$list.Add("CTL|$($cls.ToString())|$($name.ToString())|$($rect.Left)|$($rect.Top)|$($rect.Right)|$($rect.Bottom)")
        return $true
    }
    [AnchorProbe]::EnumChildWindows($hwnd, $callback, [IntPtr]::Zero) | Out-Null
    return $list
}
if ($Phase -eq 'before' -or $Phase -eq 'after') {
    Get-Children | ForEach-Object { Write-Output $_ }
    exit 0
}
if ($Phase -eq 'resize') {
    $clientBefore = New-Object AnchorProbe+RECT
    [AnchorProbe]::GetClientRect($hwnd, [ref]$clientBefore) | Out-Null
    Write-Output "SIZE|$($clientBefore.Right - $clientBefore.Left)|$($clientBefore.Bottom - $clientBefore.Top)"
    $outer = New-Object AnchorProbe+RECT
    [AnchorProbe]::GetWindowRect($hwnd, [ref]$outer) | Out-Null
    $newWidth = ($outer.Right - $outer.Left) + 150
    $newHeight = ($outer.Bottom - $outer.Top) + 100
    [AnchorProbe]::SetWindowPos($hwnd, [IntPtr]::Zero, $outer.Left, $outer.Top, $newWidth, $newHeight, 0x0004) | Out-Null
    Start-Sleep -Milliseconds 350
    $clientAfter = New-Object AnchorProbe+RECT
    [AnchorProbe]::GetClientRect($hwnd, [ref]$clientAfter) | Out-Null
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
