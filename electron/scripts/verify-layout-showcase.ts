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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'layout-showcase-verify');
const designerPath = path.join(repoRoot, '.lingbuilder', 'projects', 'layout-showcase', 'window-designer.json');
const MAIN_TITLE = '布局演示厅';
const SCALE_TITLE = '等比缩放仪表盘';

interface ProbeRect { left: number; top: number; right: number; bottom: number; class: string; text: string }

/**
 * layout-showcase 示例项目真机验收（长期留存）：
 * 读取仓库真实项目文件（.lingbuilder/projects/layout-showcase/window-designer.json + src/layout-showcase/*.lcpp），
 * 生成 C++ → MSVC 双平台编译 → 运行探针：
 *  - 主窗口：流式面板换行/表格星号列初始排布 + 拉伸后锚定跟随（日志框 left,top,right / 按钮 right,bottom）与面板不漂移
 *  - BM_CLICK「打开等比缩放窗口」→ 等比窗口拉伸按 min(宽比,高比) 整体缩放
 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('验收目录越出工作区。');
  }
  const project = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const mainSource = await fs.readFile(path.join(repoRoot, 'src', 'layout-showcase', 'MainWindow.lcpp'), 'utf8');
  const scaleSource = await fs.readFile(path.join(repoRoot, 'src', 'layout-showcase', 'ScaleDashboard.lcpp'), 'utf8');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls'].map(moduleId => {
    const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
    if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
    return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSources: [
      { filePath: 'src/layout-showcase/MainWindow.lcpp', sourceCode: mainSource },
      { filePath: 'src/layout-showcase/ScaleDashboard.lcpp', sourceCode: scaleSource }
    ],
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(`示例项目生成阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  const runtimeHeader = generated.files.map(file => file.content).join('\n');
  for (const symbol of ['void ApplyPanelLayout_()', 'void ApplyAnchorLayout_(int newClientWidth', 'void ApplyScaleLayout_(int newClientWidth', 'L"flow"', 'L"table"', 'int anchorMask;', 'bool scaleContent;']) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少布局运行时符号：${symbol}`);
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
      exported.solutionPath, '/m', '/t:Build',
      '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const executable = path.join(projectDir, platform === 'x64' ? 'x64' : 'Win32', 'Release', 'bin', `${exported.projectName}.exe`);
    await fs.access(executable);
    console.log(`PASS MSVC ${platform} 编译：${executable}`);
    if (platform === 'x64') {
      await verify(executable);
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function verify(executable: string): Promise<void> {
  const probeScript = path.join(projectDir, 'showcase-probe.ps1');
  // PowerShell 5.1 对无 BOM 的 .ps1 按 ANSI 解码，中文窗口名会乱码——必须带 BOM。
  await fs.writeFile(probeScript, `\uFEFF${buildProbeScript()}`, 'utf8');
  // 防重复实例：残留同名进程会让 EnumWindows 按标题匹配到旧窗口，探针读到脏数据。
  try { spawn('taskkill', ['/IM', 'layout-showcase.exe', '/F'], { stdio: 'ignore' }); await sleep(1200); } catch { /* 无残留实例 */ }
  const child = spawn(executable, [], { stdio: 'ignore', detached: false });
  try {
    await waitForWindow(probeScript, MAIN_TITLE);
    const runProbe = async (args: string[]) => {
      const { stdout } = await execFileAsync('powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript, ...args],
        { windowsHide: false, timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });
      return stdout;
    };
    const parseChildren = (stdout: string): ProbeRect[] => stdout.split(/\r?\n/)
      .filter(line => line.startsWith('CTL|'))
      .map(line => {
        const [, className, text, left, top, right, bottom] = line.split('|');
        return { class: className, text, left: Number(left), top: Number(top), right: Number(right), bottom: Number(bottom) };
      });

    // ===== 主窗口：初始排布 + 锚定跟随 =====
    const before = parseChildren(await runProbe(['-Phase', 'children', '-Title', MAIN_TITLE]));
    if (before.length < 10) throw new Error(`主窗口探针只抓到 ${before.length} 个子控件。\n${JSON.stringify(before)}`);
    const find = (list: ProbeRect[], needle: string) => list.findIndex(item => item.text.includes(needle));
    const near = (label: string, actual: number, expected: number, tolerance = 3) => {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${label} 不符：实际 ${actual}，期望 ${expected}（±${tolerance}）。`);
      }
    };
    // 本机 200% DPI：1 DIP = 2px。流式面板（水平 wrap，面板宽 380DIP=760px、padding/hgap 16px）：
    // 内容宽 728px；甲(180)+乙(180)+丙(180)=540+32=572 ≤728，丁(220)=572+16+220=808 >728 → 丁换行。
    const b1 = before[find(before, '新建')];
    const b2 = before[find(before, '打开 (90')];
    const b3 = before[find(before, '保存 (90')];
    const b4 = before[find(before, '另存')];
    near('流式 乙-甲 x 距', b2.left - b1.left, 196);
    near('流式 丙-乙 x 距', b3.left - b2.left, 196);
    near('流式 丁 换行 y 距', b4.top - b1.top, (48 + 8) * 2);
    near('流式 丁 回行首 x', b4.left - b1.left, 0);
    // 表格面板（列 100|*|90，面板宽 456DIP=912px、padding/hgap 16px）：可用=912-32-32=848，
    // 星号列=848-200-180=468px。
    const c1 = before[find(before, '检查')];
    const c2 = before[find(before, '用户名：')];
    const c3 = before[find(before, '保存')];
    near('表格 星号列宽', c3.left - c2.left - 200 - 32, 468);
    near('表格 第三列宽', c1.right - c1.left, 180);

    // 拉伸主窗口
    const resizeOut = await runProbe(['-Phase', 'resize', '-Title', MAIN_TITLE, '-Dx', '600', '-Dy', '300']);
    const sizes = resizeOut.split(/\r?\n/).filter(line => line.startsWith('SIZE|')).map(line => line.split('|'));
    const beforeClient = { width: Number(sizes[0][1]), height: Number(sizes[0][2]) };
    const afterClient = { width: Number(sizes[1][1]), height: Number(sizes[1][2]) };
    const dx = afterClient.width - beforeClient.width;
    const dy = afterClient.height - beforeClient.height;
    if (dx <= 0 || dy <= 0) throw new Error(`客户区未变大：${beforeClient.width}x${beforeClient.height} → ${afterClient.width}x${afterClient.height}`);
    await sleep(400);
    const after = parseChildren(await runProbe(['-Phase', 'children', '-Title', MAIN_TITLE]));
    if (after.length !== before.length) throw new Error(`拉伸前后子控件数量不一致：${before.length} → ${after.length}`);
    // 创建完毕事件链验证：日志框文本由 控件_设置文本 写入（WM_GETTEXT 读取 EDIT 内容）。
    const logText = await runProbe(['-Phase', 'edittext', '-Title', MAIN_TITLE]);
    if (!logText.includes('布局演示厅已就绪')) {
      throw new Error(`日志框未写入创建完毕文本（控件_设置文本/自由子程序链路异常）：\n${logText.slice(0, 200)}`);
    }
    // 锚定断言参照「锚定说明」标签：与日志框同为 left,top,right 锚定（日志框 HWND 文本为空无法按文本找）。
    const logBefore = before[find(before, '锚定演示')];
    const logAfter = after[find(after, '锚定演示')];
    near('日志区（左+右锚定）宽度增量', (logAfter.right - logAfter.left) - (logBefore.right - logBefore.left), dx, 4);
    near('日志区 x 不动', logAfter.left - logBefore.left, 0);
    const btnBefore = before[find(before, '打开等比缩放窗口')];
    const btnAfter = after[find(after, '打开等比缩放窗口')];
    near('右下按钮（右+下锚定）x 增量', btnAfter.left - btnBefore.left, dx, 4);
    near('右下按钮（右+下锚定）y 增量', btnAfter.top - btnBefore.top, dy, 4);
    const flowAfter = after[find(after, '新建')];
    near('面板无锚定不漂移', flowAfter.left - b1.left, 0, 2);
    const starAfter = after[find(after, '用户名：')];
    near('表格星号列（面板固定）不变', (starAfter.right - starAfter.left) - (c2.right - c2.left), 0, 2);

    // ===== BM_CLICK 打开等比窗口并验证整体缩放 =====
    await runProbe(['-Phase', 'click', '-Title', MAIN_TITLE, '-ClickText', '打开等比缩放窗口']);
    await waitForWindow(probeScript, SCALE_TITLE);
    await sleep(300);
    const scaleBefore = parseChildren(await runProbe(['-Phase', 'children', '-Title', SCALE_TITLE]));
    if (scaleBefore.length < 8) throw new Error(`等比窗口探针只抓到 ${scaleBefore.length} 个子控件。`);
    // 客户区相对坐标（比值断言须扣除窗口原点屏偏移，每次启动位置不同）
    const toRelative = (list: ProbeRect[]): ProbeRect[] => {
      const originLeft = Math.min(...list.map(item => item.left));
      const originTop = Math.min(...list.map(item => item.top));
      return list.map(item => ({ ...item, left: item.left - originLeft, top: item.top - originTop, right: item.right - originLeft, bottom: item.bottom - originTop }));
    };
    const scaleResize = await runProbe(['-Phase', 'resize', '-Title', SCALE_TITLE, '-Dx', '500', '-Dy', '400']);
    const scaleSizes = scaleResize.split(/\r?\n/).filter(line => line.startsWith('SIZE|')).map(line => line.split('|'));
    const sBefore = { width: Number(scaleSizes[0][1]), height: Number(scaleSizes[0][2]) };
    const sAfter = { width: Number(scaleSizes[1][1]), height: Number(scaleSizes[1][2]) };
    const factor = Math.min(sAfter.width / sBefore.width, sAfter.height / sBefore.height);
    await sleep(400);
    const scaleAfter = parseChildren(await runProbe(['-Phase', 'children', '-Title', SCALE_TITLE]));
    const relBefore = toRelative(scaleBefore);
    const relAfter = toRelative(scaleAfter);
    if (relAfter.length !== relBefore.length) throw new Error('等比窗口拉伸前后子控件数量不一致。');
    const ratioError = (label: string, beforeValue: number, afterValue: number) => {
      if (beforeValue <= 0) throw new Error(`${label} 基线非法：${beforeValue}`);
      const ratio = afterValue / beforeValue;
      if (Math.abs(ratio - factor) > factor * 0.03) {
        throw new Error(`${label} 缩放比不符：实际 ${ratio.toFixed(4)}，期望 ${factor.toFixed(4)}。`);
      }
    };
    const idx = (needle: string) => {
      const index = relBefore.findIndex(item => item.text.includes(needle));
      if (index < 0) throw new Error(`等比窗口未找到控件：${needle}`);
      return index;
    };
    const cardIdx = idx('今日访问量');
    ratioError('卡片宽', relBefore[cardIdx].right - relBefore[cardIdx].left, relAfter[cardIdx].right - relAfter[cardIdx].left);
    ratioError('卡片高', relBefore[cardIdx].bottom - relBefore[cardIdx].top, relAfter[cardIdx].bottom - relAfter[cardIdx].top);
    const valueIdx = idx('12,804');
    ratioError('大字号数值标签宽', relBefore[valueIdx].right - relBefore[valueIdx].left, relAfter[valueIdx].right - relAfter[valueIdx].left);
    const closeIdx = idx('关闭本窗口');
    ratioError('关闭按钮左距', relBefore[closeIdx].left, relAfter[closeIdx].left);
    ratioError('关闭按钮顶距', relBefore[closeIdx].top, relAfter[closeIdx].top);
    console.log(`PASS 主窗口：流式换行/表格星号列/锚定跟随（dx=${dx}, dy=${dy}）`);
    console.log(`PASS 等比窗口：factor=${factor.toFixed(4)} 全控件按 min(宽比,高比) 缩放`);
  } finally {
    if (child.pid) {
      try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* 收尾失败不掩盖主结论 */ }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForWindow(probeScript: string, title: string): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const { stdout } = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript,
        '-Phase', 'exists', '-Title', title
      ], { windowsHide: true, timeout: 30_000 });
      if (stdout.includes('FOUND')) return;
    } catch { /* 窗口尚未出现，继续等 */ }
    await sleep(250);
  }
  throw new Error(`60 秒内未检测到窗口：${title}`);
}

function buildProbeScript(): string {
  return `
param(
    [string]$Phase,
    [string]$Title,
    [string]$ClickText,
    [int]$Dx = 600,
    [int]$Dy = 300
)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class ShowcaseProbe {
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
    [DllImport("user32.dll")] public static extern bool SendMessageW(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    // 本沙箱环境 FindWindowW 恒 0（连 Progman 都找不到），EnumWindows 正常——统一 EnumWindows 精确匹配。
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

    public static IntPtr FindChildByText(IntPtr parent, string needle) {
        IntPtr found = IntPtr.Zero;
        EnumChildWindows(parent, delegate(IntPtr hwnd, IntPtr lParam) {
            if (found != IntPtr.Zero) return false;
            StringBuilder text = new StringBuilder(256);
            GetWindowTextW(hwnd, text, 256);
            if (text.ToString().Contains(needle)) found = hwnd;
            return true;
        }, IntPtr.Zero);
        return found;
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, EntryPoint = "SendMessageW")] public static extern IntPtr SendMessageGetTextW(IntPtr hwnd, uint message, IntPtr wParam, StringBuilder text);

    // 拼接窗口内全部 EDIT 内容（WM_GETTEXT）：多行日志的文本由创建完毕事件运行期写入，
    // HWND 窗口文本拿不到，必须逐 EDIT 取内容。
    public static string GetAllEditTexts(IntPtr hwnd) {
        StringBuilder combined = new StringBuilder();
        EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr lParam) {
            StringBuilder cls = new StringBuilder(256);
            GetClassNameW(child, cls, 256);
            if (cls.ToString().ToLowerInvariant() != "edit") return true;
            StringBuilder text = new StringBuilder(8192);
            SendMessageGetTextW(child, 0x000D, (IntPtr)8192, text);
            combined.Append(text.ToString()).Append(Environment.NewLine);
            return true;
        }, IntPtr.Zero);
        return combined.ToString();
    }
}
'@
[ShowcaseProbe]::SetProcessDPIAware() | Out-Null
$hwnd = [ShowcaseProbe]::FindByTitle($Title)
if ($Phase -eq 'exists') {
    if ($hwnd -ne [IntPtr]::Zero -and [ShowcaseProbe]::IsWindowVisible($hwnd)) { Write-Output 'FOUND' }
    exit 0
}
if ($hwnd -eq [IntPtr]::Zero) { throw "未找到窗口：$Title" }
if ($Phase -eq 'children') {
    # 红线：scriptblock 转 Win32 delegate 时，callback 内 Write-Output 的行会被当作
    # delegate 返回值吞掉、枚举立即中断——必须在 ArrayList 里 [void].Add 收集，函数外统一输出。
    $list = New-Object System.Collections.ArrayList
    $callback = [ShowcaseProbe+EnumProc]{
        param($child, $lParam)
        $rect = New-Object ShowcaseProbe+RECT
        [ShowcaseProbe]::GetWindowRect($child, [ref]$rect) | Out-Null
        $name = New-Object System.Text.StringBuilder 256
        [ShowcaseProbe]::GetWindowTextW($child, $name, 256) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [ShowcaseProbe]::GetClassNameW($child, $cls, 256) | Out-Null
        [void]$list.Add("CTL|$($cls.ToString())|$($name.ToString())|$($rect.Left)|$($rect.Top)|$($rect.Right)|$($rect.Bottom)")
        return $true
    }
    [ShowcaseProbe]::EnumChildWindows($hwnd, $callback, [IntPtr]::Zero) | Out-Null
    $list | ForEach-Object { Write-Output $_ }
    exit 0
}
if ($Phase -eq 'edittext') {
    # 全部 EDIT 内容拼接（WM_GETTEXT）：多行日志文本由创建完毕事件运行期写入，HWND 窗口文本拿不到。
    Write-Output ([ShowcaseProbe]::GetAllEditTexts($hwnd))
    exit 0
}
if ($Phase -eq 'click') {
    $target = [ShowcaseProbe]::FindChildByText($hwnd, $ClickText)
    if ($target -eq [IntPtr]::Zero) { throw "未找到按钮：$ClickText" }
    # BM_CLICK = 0x00F5：程序化触发按钮（锚定跟随后的按钮必须仍可点中，位置错误会点空）
    [ShowcaseProbe]::SendMessageW($target, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null
    Write-Output 'CLICKED'
    exit 0
}
if ($Phase -eq 'resize') {
    $clientBefore = New-Object ShowcaseProbe+RECT
    [ShowcaseProbe]::GetClientRect($hwnd, [ref]$clientBefore) | Out-Null
    Write-Output "SIZE|$($clientBefore.Right - $clientBefore.Left)|$($clientBefore.Bottom - $clientBefore.Top)"
    $outer = New-Object ShowcaseProbe+RECT
    [ShowcaseProbe]::GetWindowRect($hwnd, [ref]$outer) | Out-Null
    [ShowcaseProbe]::SetWindowPos($hwnd, [IntPtr]::Zero, $outer.Left, $outer.Top,
        ($outer.Right - $outer.Left) + $Dx, ($outer.Bottom - $outer.Top) + $Dy, 0x0004) | Out-Null
    Start-Sleep -Milliseconds 350
    $clientAfter = New-Object ShowcaseProbe+RECT
    [ShowcaseProbe]::GetClientRect($hwnd, [ref]$clientAfter) | Out-Null
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
    '-latest', '-products', '*',
    '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property', 'installationPath'
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
