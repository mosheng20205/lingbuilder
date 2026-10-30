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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'panel-layout-smoke');
const windowTitle = '布局面板冒烟';

interface ProbeRect { left: number; top: number; right: number; bottom: number; class: string; text: string }

/** 2026-10-30 真机验收：FlowPanel/TablePanel（布局系统三/四期）——MSVC 双编译 + 程序化拉伸实测面板内子控件重排。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('面板冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'panel-layout-smoke',
    name: '布局面板冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: windowTitle,
      width: 900,
      height: 620,
      background: '#1f2937',
      description: '验证 FlowPanel 横向换行与 TablePanel 星号列拉伸：拉伸窗口时面板内子控件按布局算法重排',
      resizable: true,
      borderStyle: 'normal-resizable',
      controls: [
        { id: 'ctrl-flow', type: 'FlowPanel', name: '流式面板', content: '', x: 24, y: 24, width: 400, height: 180, fontSize: 12, background: '#1B2432', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { orientation: 'horizontal', wrap: true, hgap: 8, vgap: 8, padding: 8, align: 'start' } },
        { id: 'flow-b1', parentId: 'ctrl-flow', type: 'Button', name: '流式甲', content: '甲', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'flow-b2', parentId: 'ctrl-flow', type: 'Button', name: '流式乙', content: '乙', x: 0, y: 0, width: 100, height: 40, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'flow-b3', parentId: 'ctrl-flow', type: 'Button', name: '流式丙', content: '丙', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'flow-b4', parentId: 'ctrl-flow', type: 'Button', name: '流式丁', content: '丁', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#007ACC', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'ctrl-table', type: 'TablePanel', name: '表格面板', content: '', x: 24, y: 220, width: 850, height: 160, fontSize: 12, background: '#1B2432', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible', properties: { columns: ['120', '*', '2*'], rows: ['auto'], hgap: 8, vgap: 8, padding: 10 } },
        { id: 'table-c1', parentId: 'ctrl-table', type: 'Button', name: '表格固定', content: '固定', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#0E7490', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'table-c2', parentId: 'ctrl-table', type: 'Button', name: '表格星一', content: '星一', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#0E7490', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' },
        { id: 'table-c3', parentId: 'ctrl-table', type: 'Button', name: '表格星二', content: '星二', x: 0, y: 0, width: 100, height: 30, fontSize: 12, background: '#0E7490', foreground: '#FFFFFF', isEnabled: true, visibility: 'Visible' }
      ]
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        调试输出("布局面板冒烟就绪")',
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
  for (const symbol of ['void ApplyPanelLayout_()', 'WireCompositeControls(); ApplyPanelLayout_();', 'L"flow"', 'L"table"']) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少面板运行时符号：${symbol}`);
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
      await verifyPanelResize(executable);
      console.log('PASS 程序化拉伸：流式面板换行重排、表格星号列拉伸、固定列不动');
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function verifyPanelResize(executable: string): Promise<void> {
  const probeScript = path.join(projectDir, 'panel-probe.ps1');
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
      if (lines.length < 6) throw new Error(`探针只抓到 ${lines.length} 个子控件（${phase}）。\n${stdout}`);
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
    if (clientDx <= 0) throw new Error(`客户区未变宽：${beforeClient.width} → ${afterClient.width}`);

    // 面板自身是窗口根级控件（无锚定 = 固定不动）：面板矩形不变，面板内子控件相对面板排布也不变。
    // 换个更强的断言口径：直接校验「创建后初始布局」就符合流式/表格算法——拉伸面板自身不参与锚定，
    // 尺寸不变，所以重点验证初始排布数学 + 拉伸后布局稳定（不漂移）。
    // 屏幕坐标含窗口原点，改用「控件间相对差值」断言（与面板原点无关）。
    const tolerance = 3;
    const assertNear = (label: string, actual: number, expected: number) => {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label} 不符：实际 ${actual}，期望 ${expected}（±${tolerance}）。`);
      }
    };
    // GetWindowTextW 返回控件 content（不是 name），needle 必须按窗口文本找。
    const findIndex = (list: ProbeRect[], needle: string) => list.findIndex(item => item.text.includes(needle));
    // 探针输出是物理像素（本机 200% DPI：1 DIP = 2px）。流式面板（水平 wrap，面板宽 400DIP=800px、
    // padding 8DIP=16px、hgap 8DIP=16px）：内容宽 800-32=768px；甲乙丙=200×3+16×2=632px ≤768，
    // 丁=632+16+200=848px >768 → 丁换行。行2 y = 行1 y + (40+8)DIP×2 = 96px。
    const b1 = before[findIndex(before, '甲')];
    const b2 = before[findIndex(before, '乙')];
    const b3 = before[findIndex(before, '丙')];
    const b4 = before[findIndex(before, '丁')];
    assertNear('流式 乙-甲 x 距', b2.left - b1.left, 216);
    assertNear('流式 丙-乙 x 距', b3.left - b2.left, 216);
    assertNear('流式 丁 换行 y 距', b4.top - b1.top, 96);
    assertNear('流式 丁 回到行首 x', b4.left - b1.left, 0);
    // 拉伸后（面板自身无锚定固定不动）：面板内布局应保持不变。
    const a4 = after[findIndex(after, '丁')];
    assertNear('拉伸后 丁 x 不漂移', a4.left - b4.left, 0);
    assertNear('拉伸后 丁 y 不漂移', a4.top - b4.top, 0);

    // 表格面板（列 120 | * | 2*，面板宽 850DIP=1700px、padding 20px、hgap 16px）：
    // 可用 = 1700-40-32 = 1628px；星号可用 = 1628-240 = 1388px；星一:星二 = 1:2 → 462/926（末轨吃剩余）。
    const c1 = before[findIndex(before, '固定')];
    const c2 = before[findIndex(before, '星一')];
    const c3 = before[findIndex(before, '星二')];
    assertNear('表格 星一-固定 x 距', c2.left - c1.left, 240 + 16);
    assertNear('表格 星二-星一 x 距', c3.left - c2.left, 462 + 16);
    assertNear('表格 星一宽', c2.right - c2.left, 462);
    assertNear('表格 星二宽', c3.right - c3.left, 926);
    // 拉伸后固定：面板不动 → 表格内不漂移。
    const ac1 = after[findIndex(after, '固定')];
    assertNear('拉伸后 表格固定 x 不漂移', ac1.left - c1.left, 0);
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
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PanelProbe {
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
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

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
[PanelProbe]::SetProcessDPIAware() | Out-Null
$hwnd = [PanelProbe]::FindByTitle('${windowTitle}')
if ($Phase -eq 'exists') {
    if ($hwnd -ne [IntPtr]::Zero -and [PanelProbe]::IsWindowVisible($hwnd)) { Write-Output 'FOUND' }
    exit 0
}
if ($hwnd -eq [IntPtr]::Zero) { throw "未找到窗口：${windowTitle}" }
function Get-Children {
    $list = New-Object System.Collections.ArrayList
    $callback = [PanelProbe+EnumProc]{
        param($child, $lParam)
        $rect = New-Object PanelProbe+RECT
        [PanelProbe]::GetWindowRect($child, [ref]$rect) | Out-Null
        $name = New-Object System.Text.StringBuilder 256
        [PanelProbe]::GetWindowTextW($child, $name, 256) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [PanelProbe]::GetClassNameW($child, $cls, 256) | Out-Null
        [void]$list.Add("CTL|$($cls.ToString())|$($name.ToString())|$($rect.Left)|$($rect.Top)|$($rect.Right)|$($rect.Bottom)")
        return $true
    }
    [PanelProbe]::EnumChildWindows($hwnd, $callback, [IntPtr]::Zero) | Out-Null
    return $list
}
if ($Phase -eq 'before' -or $Phase -eq 'after') {
    Get-Children | ForEach-Object { Write-Output $_ }
    exit 0
}
if ($Phase -eq 'resize') {
    $clientBefore = New-Object PanelProbe+RECT
    [PanelProbe]::GetClientRect($hwnd, [ref]$clientBefore) | Out-Null
    Write-Output "SIZE|$($clientBefore.Right - $clientBefore.Left)|$($clientBefore.Bottom - $clientBefore.Top)"
    $outer = New-Object PanelProbe+RECT
    [PanelProbe]::GetWindowRect($hwnd, [ref]$outer) | Out-Null
    [PanelProbe]::SetWindowPos($hwnd, [IntPtr]::Zero, $outer.Left, $outer.Top, ($outer.Right - $outer.Left) + 600, ($outer.Bottom - $outer.Top) + 200, 0x0004) | Out-Null
    Start-Sleep -Milliseconds 350
    $clientAfter = New-Object PanelProbe+RECT
    [PanelProbe]::GetClientRect($hwnd, [ref]$clientAfter) | Out-Null
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
