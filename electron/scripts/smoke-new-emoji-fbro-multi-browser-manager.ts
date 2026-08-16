import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-multi-browser-manager';
const releaseBuild = process.argv.includes('--release');
const buildDirectory = path.join(
  repositoryRoot,
  '.lingbuilder-build',
  releaseBuild ? 'new-emoji-fbro-multi-browser-manager-native' : 'new-emoji-fbro-multi-browser-manager-native-smoke'
);
const fixtureUrl = 'data:text/html;charset=utf-8,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3Awhite%3Bcolor%3Ablack%22%3E%3Ch1%3ELingBuilder%20FBro%3C%2Fh1%3E%3C%2Fbody%3E';
const smokeWorkspaceId = `${projectId}-smoke-${process.pid}-${Date.now()}`;

function resolveSmokePersistenceDirectory(): string | undefined {
  if (releaseBuild) return undefined;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error('无法解析 LocalAppData，不能安全隔离多浏览器 smoke 持久化目录。');
  const root = path.resolve(localAppData, 'LingBuilder', 'browser-workspaces');
  const target = path.resolve(root, smokeWorkspaceId);
  if (path.dirname(target) !== root || !path.basename(target).startsWith(`${projectId}-smoke-`)) {
    throw new Error('多浏览器 smoke 持久化目录未通过安全边界校验。');
  }
  return target;
}

interface EmbeddedBrowserProbe {
  Handle: number;
  Parent: number;
  ProcessId: number;
  Style: number;
  Visible: boolean;
  Left: number;
  Top: number;
  Width: number;
  Height: number;
  ChildCount: number;
  ClassName: string;
}

interface ManagerWindowProbe {
  mainHandle: number;
  mainClientX: number;
  mainClientY: number;
  dpi: number;
  browsers: EmbeddedBrowserProbe[];
  browserPixel: [number, number, number];
}

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function installed(moduleId: string): Promise<InstalledModule> {
  const installPath = path.join(repositoryRoot, '.lingbuilder', 'modules', moduleId);
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as LingBuilderModuleManifest;
  return { manifest, installPath, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function copyPluginAssets(destinationRoot: string): Promise<void> {
  const sourceRoot = path.join(repositoryRoot, 'assets', projectId, 'doubao-downloader');
  const targetRoot = path.join(destinationRoot, 'assets', projectId, 'doubao-downloader');
  await fs.mkdir(targetRoot, { recursive: true });
  for (const file of ['manifest.json', 'logo.png', 'popup.html', 'doubao-downloader.user.js']) {
    await fs.copyFile(path.join(sourceRoot, file), path.join(targetRoot, file));
  }
}

async function countHostProcesses(): Promise<number> {
  const command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'LingBuilderFbroHost.exe'\").Count";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function startRuntime(executable: string, cwd: string): Promise<number> {
  const command = `$process = Start-Process -FilePath ${quotePowerShell(executable)} -WorkingDirectory ${quotePowerShell(cwd)} -WindowStyle Normal -PassThru; $process.Id`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  const pid = Number.parseInt(stdout.trim(), 10);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('无法启动 new_emoji FBro 多浏览器管理器主进程。');
  return pid;
}

async function isProcessAlive(pid: number): Promise<boolean> {
  const command = `@(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Count`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) > 0;
}

async function isProcessResponding(pid: number): Promise<boolean> {
  const command = `$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($process -and $process.Responding) { 1 } else { 0 }`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) === 1;
}

async function stopRuntime(pid: number): Promise<void> {
  const command = `$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($process) { Stop-Process -InputObject $process -Force }`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, message: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(message);
}

async function inspectEmbeddedBrowsers(processId: number): Promise<ManagerWindowProbe> {
  const source = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class LBEmbeddedBrowserSnapshot {
  public long Handle;
  public long Parent;
  public uint ProcessId;
  public long Style;
  public bool Visible;
  public int Left;
  public int Top;
  public int Width;
  public int Height;
  public int ChildCount;
  public string ClassName;
}

public static class LBMultiBrowserProbe {
  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr state);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd, ref POINT point);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr64(IntPtr hwnd, int index);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong32(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
  [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc, int x, int y);

  static long WindowLong(IntPtr hwnd, int index) {
    return IntPtr.Size == 8 ? GetWindowLongPtr64(hwnd, index).ToInt64() : GetWindowLong32(hwnd, index);
  }

  public static LBEmbeddedBrowserSnapshot[] Find(IntPtr main) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    var result = new List<LBEmbeddedBrowserSnapshot>();
    EnumWindows(delegate(IntPtr companion, IntPtr state) {
      if (GetWindow(companion, 4) != main) return true;
      EnumChildWindows(companion, delegate(IntPtr hwnd, IntPtr nestedState) {
        var className = new StringBuilder(256);
        GetClassName(hwnd, className, className.Capacity);
        if (className.ToString() != "LingBuilder.FBro.Host.Browser") return true;
        uint childProcessId; GetWindowThreadProcessId(hwnd, out childProcessId);
        RECT rect; GetWindowRect(hwnd, out rect);
        int childCount = 0;
        EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr nested) { childCount++; return true; }, IntPtr.Zero);
        result.Add(new LBEmbeddedBrowserSnapshot {
          Handle = hwnd.ToInt64(), Parent = GetParent(hwnd).ToInt64(), ProcessId = childProcessId,
          Style = WindowLong(hwnd, -16), Visible = IsWindowVisible(hwnd),
          Left = rect.Left, Top = rect.Top,
          Width = rect.Right - rect.Left, Height = rect.Bottom - rect.Top,
          ChildCount = childCount, ClassName = className.ToString()
        });
        return true;
      }, IntPtr.Zero);
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }

  public static int[] MainClientOrigin(IntPtr main) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    POINT origin = new POINT { X = 0, Y = 0 };
    ClientToScreen(main, ref origin);
    return new [] { origin.X, origin.Y };
  }

  public static uint WindowDpi(IntPtr main) {
    uint dpi = GetDpiForWindow(main);
    return dpi == 0 ? 96U : dpi;
  }

  public static int[] SampleBrowserPixel(IntPtr main) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    ShowWindow(main, 5); SetForegroundWindow(main); System.Threading.Thread.Sleep(500);
    RECT client; GetClientRect(main, out client);
    POINT origin = new POINT { X = 0, Y = 0 }; ClientToScreen(main, ref origin);
    int x = origin.X + 960;
    int y = origin.Y + 430;
    IntPtr dc = GetDC(IntPtr.Zero);
    try {
      uint color = GetPixel(dc, x, y);
      return new [] { (int)(color & 255), (int)((color >> 8) & 255), (int)((color >> 16) & 255) };
    } finally { ReleaseDC(IntPtr.Zero, dc); }
  }
}`;
  const script = [
    `$source = @'\n${source}\n'@`,
    'Add-Type -TypeDefinition $source -Language CSharp',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop`,
    '$process.Refresh()',
    '$main = [IntPtr]$process.MainWindowHandle',
    'if ($main -eq [IntPtr]::Zero) { throw "多浏览器管理器没有主窗口句柄。" }',
    '$browsers = @([LBMultiBrowserProbe]::Find($main))',
    '$mainOrigin = [LBMultiBrowserProbe]::MainClientOrigin($main)',
    '$dpi = [LBMultiBrowserProbe]::WindowDpi($main)',
    '$pixel = [LBMultiBrowserProbe]::SampleBrowserPixel($main)',
    '[pscustomobject]@{ mainHandle = $main.ToInt64(); mainClientX = $mainOrigin[0]; mainClientY = $mainOrigin[1]; dpi = $dpi; browsers = $browsers; browserPixel = $pixel } | ConvertTo-Json -Depth 5 -Compress'
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout.trim()) as ManagerWindowProbe;
}

function verifyEmbeddedBrowsers(
  probe: ManagerWindowProbe,
  viewport: { x: number; y: number; width: number; height: number }
): void {
  const wsChild = 0x40000000;
  if (probe.browsers.length !== 8) {
    throw new Error(`主界面应动态承载 8 个真实 FBro 子窗口，实际为 ${probe.browsers.length} 个。`);
  }
  if (new Set(probe.browsers.map(browser => browser.ProcessId)).size !== 8) {
    throw new Error('8 个 FBro 浏览器没有分布在 8 个独立 Host 进程中。');
  }
  const visible = probe.browsers.filter(browser => browser.Visible);
  if (visible.length !== 1) {
    throw new Error(`应只显示当前 FBro 浏览器，实际可见 ${visible.length} 个：${JSON.stringify(probe.browsers)}`);
  }
  const scale = probe.dpi / 96;
  const expectedLeft = probe.mainClientX + Math.round(viewport.x * scale);
  const expectedTop = probe.mainClientY + Math.round(viewport.y * scale);
  const expectedWidth = Math.round(viewport.width * scale);
  const expectedHeight = Math.round(viewport.height * scale);
  const coordinateTolerance = 3;
  for (const browser of probe.browsers) {
    if ((browser.Style & wsChild) === 0 || browser.Parent === 0) throw new Error('FBro Host 浏览器没有作为主界面承载区的真实子窗口。');
    if (browser.Width < 1200 || browser.Height < 700) throw new Error(`FBro 内嵌窗口没有占满右侧工作区：${browser.Width}x${browser.Height}。`);
    if (Math.abs(browser.Left - expectedLeft) > coordinateTolerance
      || Math.abs(browser.Top - expectedTop) > coordinateTolerance
      || Math.abs(browser.Width - expectedWidth) > coordinateTolerance
      || Math.abs(browser.Height - expectedHeight) > coordinateTolerance) {
      throw new Error(`FBro 内嵌窗口没有对齐 BrowserViewport：实际 ${browser.Left},${browser.Top},${browser.Width}x${browser.Height}，预期 ${expectedLeft},${expectedTop},${expectedWidth}x${expectedHeight}。`);
    }
    if (browser.ChildCount === 0) throw new Error('FBro Host 未创建 Chromium 子窗口。');
  }
  const [red, green, blue] = probe.browserPixel;
  if (red < 225 || green < 225 || blue < 225) {
    throw new Error(`浏览器承载区没有绘制真实测试网页：RGB(${red},${green},${blue})。`);
  }
}

async function waitForEmbeddedBrowsers(
  processId: number,
  timeoutMs: number,
  viewport: { x: number; y: number; width: number; height: number }
): Promise<ManagerWindowProbe> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '尚未取得浏览器窗口探针。';
  while (Date.now() < deadline) {
    try {
      const probe = await inspectEmbeddedBrowsers(processId);
      verifyEmbeddedBrowsers(probe, viewport);
      return probe;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error(`未在 ${Math.round(timeoutMs / 1000)} 秒内看到完整 FBro 网页：${lastError}`);
}

async function main(): Promise<void> {
  const smokePersistenceDirectory = resolveSmokePersistenceDirectory();
  const projectDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const [designerText, source] = await Promise.all([
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8')
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  const controls = project.windows[0]?.controls || [];
  const richList = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/RichList');
  const workspaceTabs = controls.find(control => control.id === 'workspace-pages');
  const browserTabs = controls.find(control => control.id === 'browser-host-pages');
  const configurationWorkspace = controls.find(control => control.id === 'configuration-workspace');
  const settingsPanel = controls.find(control => control.id === 'settings-panel');
  const toolsPanel = controls.find(control => control.id === 'tools-panel');
  const browserControls = controls.filter(control => control.type === 'FBroBrowser');
  const browserViewport = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/BrowserViewport');
  const addressOmnibox = controls.find(control => control.id === 'address-input');
  const addInstance = controls.find(control => control.id === 'add-instance');
  const globalSettings = controls.find(control => control.id === 'global-settings');
  if (!richList || richList.x > 40 || richList.width < 260 || richList.height < 520
    || richList.events?.SelectionChanged !== '_浏览器实例列表_选择变化') {
    throw new Error('原生 smoke 要求左侧使用可交互的 new_emoji RichList。');
  }
  const workspaceItems = Array.isArray(workspaceTabs?.properties?.items) ? workspaceTabs.properties.items : [];
  const browserItems = Array.isArray(browserTabs?.properties?.items) ? browserTabs.properties.items : [];
  if (workspaceTabs?.designerType !== 'lingbuilder.new_emoji.ui/Tabs'
    || workspaceItems.length !== 2
    || workspaceTabs.properties?.headerVisible !== false
    || browserTabs?.parentId !== workspaceTabs?.id
    || browserTabs?.containerSlot !== 'browser-workspace'
    || browserTabs?.properties?.headerVisible !== false
    || String(browserTabs?.properties?.position) !== '0'
    || browserItems.length !== 0
    || browserViewport?.parentId !== workspaceTabs?.id
    || browserViewport?.containerSlot !== 'browser-workspace'
    || configurationWorkspace?.parentId !== workspaceTabs?.id
    || configurationWorkspace?.containerSlot !== 'configuration-workspace'
    || settingsPanel?.parentId !== configurationWorkspace?.id
    || toolsPanel?.parentId !== configurationWorkspace?.id) {
    throw new Error('原生 smoke 要求右侧使用浏览器 / 实例设置与工具两页 Tabs；实例 Tabs 初始为空、隐藏表头，并由运行时动态增加标签。');
  }
  if (browserControls.length !== 0 || !browserViewport || browserViewport.x < 300 || browserViewport.width < 1200 || browserViewport.height < 700) {
    throw new Error('动态管理器不得预创建固定数量的 FBroBrowser；右侧必须由 BrowserViewport 提供动态 Host 布局边界。');
  }
  if (addressOmnibox?.designerType !== 'lingbuilder.new_emoji.ui/Omnibox'
    || addressOmnibox.events?.TextChanged !== '_地址输入_提交'
    || !addInstance || addInstance.events?.Clicked !== '_添加实例_被点击'
    || !globalSettings || globalSettings.events?.Clicked !== '_全局设置_被点击'
    || controls.some(control => ['show-current', 'restart-current', 'close-current'].includes(control.id))) {
    throw new Error('顶部地址栏必须使用带提交回调的 Omnibox，左下角只能保留添加实例和全局设置。');
  }
  const canvasTitle = controls.find(control => control.id === 'title');
  const subtitle = controls.find(control => control.id === 'subtitle');
  if (canvasTitle || !subtitle || subtitle.y > 24 || subtitle.height > 24) {
    throw new Error('原生 smoke 要求移除与窗口标题栏重复的画布标题，并使架构说明保持独立布局。');
  }
  if (!source.includes('控件_设置选择项(右侧工作区, 1)')
    || !source.includes('事件 _浏览器实例列表_选择变化(文本型 选中键列表)')
    || !source.includes('浏览器外壳_绑定实例列表(浏览器实例列表)')
    || !source.includes('浏览器外壳_新建独立实例(稳定ID, 默认首页, 实例标题, "profiles/" + 稳定ID)')
    || !source.includes('浏览器外壳_启用实例持久化("new-emoji-fbro-multi-browser-manager")')
    || !source.includes('浏览器外壳_导入实例Cookie')
    || !source.includes('浏览器外壳_导出实例Cookie')
    || !source.includes('浏览器外壳_确认删除实例')
    || !source.includes('浏览器外壳_选择列表键(选中键列表)')
    || !source.includes('空 同步当前地址栏()')
    || !source.includes('浏览器外壳_取地址()')
    || !source.includes('事件 _地址输入_提交(文本型 地址)')
    || !source.includes('事件 浏览器状态改变(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)')
    || !source.includes('空 添加实例()')
    || source.includes('已添加实例数量 < 6')
    || source.includes('当前模板已启用全部 6 个')
    || source.includes('实例设置遮罩')) {
    throw new Error('项目源码缺少动态独立实例、RichList/Tabs 映射或地址同步逻辑，或者仍残留固定 6 个上限。');
  }
  for (const control of project.windows[0]?.controls || []) {
    if (!releaseBuild && control.name === '地址输入') {
      control.content = fixtureUrl;
      control.properties = { ...control.properties, value: fixtureUrl };
    }
  }
  const enabledModules = [
    builtin('lingbuilder.win32.basic'),
    builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.std.text'),
    await installed('lingbuilder.new_emoji.ui'),
    builtin('lingbuilder.fbro.browser'),
    builtin('lingbuilder.new_emoji.fbro-shell')
  ];
  const sourceForBuild = releaseBuild ? source : source
    .replace(
      '浏览器外壳_启用实例持久化("new-emoji-fbro-multi-browser-manager")',
      `浏览器外壳_启用实例持久化("${smokeWorkspaceId}")`
    )
    .replace('文本型 默认首页 = "https://www.baidu.com"', `文本型 默认首页 = "${fixtureUrl}"`)
    .replace('        记录日志("主控已就绪：实例使用独立 Host、独立 Profile、原子 JSON 恢复和 exe 同级插件。")', [
      ...Array.from({ length: 7 }, () => '        添加实例()'),
      '        记录日志("主控已就绪：动态实例 smoke 已创建 8 个独立 Host。")'
    ].join('\n'));
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: sourceForBuild,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const iconCandidates = [
    path.join(repositoryRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repositoryRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ];
  for (const candidate of iconCandidates) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(buildDirectory, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(buildDirectory, 'resources', 'lingbuilder-app.ico'));
      break;
    } catch { /* Continue to the next bundled icon. */ }
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: buildDirectory, projectId, generatedFiles: generated.files, enabledModules });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: buildDirectory, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  await copyPluginAssets(path.dirname(executable));
  await Promise.all([
    'manifest.json',
    'logo.png',
    'popup.html',
    'doubao-downloader.user.js'
  ].map(file => fs.access(path.join(path.dirname(executable), 'assets', projectId, 'doubao-downloader', file))));
  if (releaseBuild) {
    console.log(JSON.stringify({ ok: true, projectId, buildDirectory, executable, releaseBuild }, null, 2));
    return;
  }
  const before = await countHostProcesses();
  const runtimePid = await startRuntime(executable, path.dirname(executable));
  try {
    await waitUntil(async () => (await countHostProcesses()) >= before + 8, 240000, '未在 240 秒内动态启动 8 个 FBro 独立 Host 进程。');
    if (!(await isProcessAlive(runtimePid))) throw new Error('主程序在 Host 运行期间退出。');
    await waitUntil(() => isProcessResponding(runtimePid), 30000, '首次启动 FBro Host 后，主窗口在 30 秒内仍未恢复消息响应。');
    const windowProbe = await waitForEmbeddedBrowsers(runtimePid, 240000, browserViewport);
    console.log(JSON.stringify({ ok: true, projectId, buildDirectory, executable, hosts: 8, windowProbe }, null, 2));
  } finally {
    try {
      await stopRuntime(runtimePid);
      await waitUntil(async () => (await countHostProcesses()) <= before, 30000, '主程序退出后 8 个 FBro Host 未被 Job Object 回收。');
    } finally {
      if (smokePersistenceDirectory) await fs.rm(smokePersistenceDirectory, { recursive: true, force: true });
    }
  }
}

void main();
