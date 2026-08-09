import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-richlist';
const releaseBuild = process.argv.includes('--release');
const buildDirectory = path.join(repositoryRoot, '.lingbuilder-build',
  releaseBuild ? 'new-emoji-fbro-richlist-native' : 'new-emoji-fbro-richlist-native-smoke');
const fixtureUrl = 'data:text/html;charset=utf-8,%3Cbody%20style%3D%22margin%3A0%3Bbackground%3Awhite%3Bcolor%3Ablack%22%3E%3Ch1%3ELingBuilder%20RichList%20FBro%3C%2Fh1%3E%3C%2Fbody%3E';
const cookieUrl = 'https://www.baidu.com/';
const cookieName = `lingbuilder_richlist_isolation_${Date.now()}`;

interface BrowserProbe {
  Handle: number;
  Companion: number;
  StableId: string;
  ProcessId: number;
  Visible: boolean;
  ChildCount: number;
}

interface WindowProbe {
  mainHandle: number;
  dpi: number;
  mainVisible: boolean;
  mainEnabled: boolean;
  mainIconic: boolean;
  browsers: BrowserProbe[];
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

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function countHostProcesses(): Promise<number> {
  const command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'LingBuilderFbroHost.exe'\").Count";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

async function startRuntime(executable: string): Promise<number> {
  const cwd = path.dirname(executable);
  const command = `$process = Start-Process -FilePath ${quotePowerShell(executable)} -WorkingDirectory ${quotePowerShell(cwd)} -WindowStyle Normal -PassThru; $process.Id`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  const pid = Number.parseInt(stdout.trim(), 10);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('无法启动 RichList 动态多浏览器主进程。');
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
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  throw new Error(message);
}

async function inspectBrowsers(processId: number): Promise<WindowProbe> {
  const source = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class LBRichBrowserSnapshot {
  public long Handle;
  public long Companion;
  public string StableId;
  public uint ProcessId;
  public bool Visible;
  public int ChildCount;
}

public static class LBRichBrowserProbe {
  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsWindowEnabled(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int capacity);

  public static LBRichBrowserSnapshot[] Find(IntPtr main) {
    var result = new List<LBRichBrowserSnapshot>();
    EnumWindows(delegate(IntPtr companion, IntPtr state) {
      if (GetWindow(companion, 4) != main) return true;
      var title = new StringBuilder(512); GetWindowText(companion, title, title.Capacity);
      EnumChildWindows(companion, delegate(IntPtr hwnd, IntPtr nestedState) {
        var className = new StringBuilder(256); GetClassName(hwnd, className, className.Capacity);
        if (className.ToString() != "LingBuilder.FBro.Host.Browser") return true;
        uint childProcessId; GetWindowThreadProcessId(hwnd, out childProcessId);
        int childCount = 0;
        EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr nested) { childCount++; return true; }, IntPtr.Zero);
        result.Add(new LBRichBrowserSnapshot {
          Handle = hwnd.ToInt64(), Companion = GetParent(hwnd).ToInt64(), StableId = title.ToString(),
          ProcessId = childProcessId, Visible = IsWindowVisible(hwnd), ChildCount = childCount
        });
        return true;
      }, IntPtr.Zero);
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }

  public static uint Dpi(IntPtr main) {
    uint dpi = GetDpiForWindow(main); return dpi == 0 ? 96U : dpi;
  }

  public static bool Visible(IntPtr main) { return IsWindowVisible(main); }
  public static bool Enabled(IntPtr main) { return IsWindowEnabled(main); }
  public static bool Iconic(IntPtr main) { return IsIconic(main); }
}`;
  const script = [
    `$source = @'\n${source}\n'@`,
    'Add-Type -TypeDefinition $source -Language CSharp',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop`,
    '$process.Refresh()',
    '$main = [IntPtr]$process.MainWindowHandle',
    'if ($main -eq [IntPtr]::Zero) { throw "RichList Demo 没有主窗口句柄。" }',
    '$browsers = @([LBRichBrowserProbe]::Find($main))',
    '[pscustomobject]@{ mainHandle = $main.ToInt64(); dpi = [LBRichBrowserProbe]::Dpi($main); mainVisible = [LBRichBrowserProbe]::Visible($main); mainEnabled = [LBRichBrowserProbe]::Enabled($main); mainIconic = [LBRichBrowserProbe]::Iconic($main); browsers = $browsers } | ConvertTo-Json -Depth 5 -Compress'
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true, timeout: 30_000, maxBuffer: 4 * 1024 * 1024
  });
  const result = JSON.parse(stdout.trim()) as WindowProbe;
  result.browsers = Array.isArray(result.browsers) ? result.browsers : result.browsers ? [result.browsers] : [];
  return result;
}

async function postClientClick(processId: number, logicalX: number, logicalY: number): Promise<void> {
  const source = String.raw`
using System;
using System.Runtime.InteropServices;
public static class LBClick {
  public struct Point { public int X; public int Y; }
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd, ref Point point);
  [DllImport("user32.dll")] static extern bool GetCursorPos(out Point point);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr hwnd);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, IntPtr processId);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint first, uint second, bool attach);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
  public static void Send(IntPtr hwnd, int x, int y) {
    SetThreadDpiAwarenessContext(new IntPtr(-4));
    uint dpi = GetDpiForWindow(hwnd); if (dpi == 0) dpi = 96;
    int clientX = (int)Math.Round(x * dpi / 96.0);
    int clientY = (int)Math.Round(y * dpi / 96.0);
    var target = new Point { X = clientX, Y = clientY };
    if (!ClientToScreen(hwnd, ref target)) throw new InvalidOperationException("无法换算 Demo 点击坐标。");
    Point previous; GetCursorPos(out previous);
    IntPtr foreground = GetForegroundWindow();
    uint foregroundThread = GetWindowThreadProcessId(foreground, IntPtr.Zero);
    uint currentThread = GetCurrentThreadId();
    bool attached = foregroundThread != 0 && foregroundThread != currentThread
      && AttachThreadInput(currentThread, foregroundThread, true);
    ShowWindow(hwnd, 5); BringWindowToTop(hwnd); SetForegroundWindow(hwnd);
    if (attached) AttachThreadInput(currentThread, foregroundThread, false);
    System.Threading.Thread.Sleep(120);
    SetCursorPos(target.X, target.Y);
    System.Threading.Thread.Sleep(80);
    IntPtr point = new IntPtr((clientY << 16) | (clientX & 0xffff));
    SendMessage(hwnd, 0x0200, UIntPtr.Zero, point);
    SendMessage(hwnd, 0x0201, new UIntPtr(1), point);
    System.Threading.Thread.Sleep(35);
    PostMessage(hwnd, 0x0202, UIntPtr.Zero, point);
    System.Threading.Thread.Sleep(180);
    SetCursorPos(previous.X, previous.Y);
  }
}`;
  const script = [
    `$source = @'\n${source}\n'@`, 'Add-Type -TypeDefinition $source -Language CSharp',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop`, '$process.Refresh()',
    `[LBClick]::Send([IntPtr]$process.MainWindowHandle, ${logicalX}, ${logicalY})`
  ].join('\n');
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 30_000 });
}

async function fillCookieDialog(processId: number, address: string, cookie: string): Promise<boolean> {
  const source = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class LBCookieDialog {
  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern IntPtr GetDlgItem(IntPtr hwnd, int id);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool SetWindowText(IntPtr hwnd, string text);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, string lParam);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, StringBuilder lParam);
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hwnd, uint message, UIntPtr wParam, IntPtr lParam);
  public static bool Fill(IntPtr owner, string address, string cookie) {
    IntPtr dialog = IntPtr.Zero;
    EnumWindows(delegate(IntPtr hwnd, IntPtr state) {
      if (GetWindow(hwnd, 4) != owner) return true;
      var title = new StringBuilder(256); GetWindowText(hwnd, title, title.Capacity);
      if (title.ToString() == "为当前浏览器置入 Cookie") { dialog = hwnd; return false; }
      return true;
    }, IntPtr.Zero);
    if (dialog == IntPtr.Zero) return false;
    IntPtr addressEdit = GetDlgItem(dialog, 4101); IntPtr cookieEdit = GetDlgItem(dialog, 4102);
    if (addressEdit == IntPtr.Zero || cookieEdit == IntPtr.Zero) return false;
    SendMessage(addressEdit, 0x000C, IntPtr.Zero, address);
    SendMessage(cookieEdit, 0x000C, IntPtr.Zero, cookie);
    var actualAddress = new StringBuilder(address.Length + 2);
    var actualCookie = new StringBuilder(cookie.Length + 2);
    SendMessage(addressEdit, 0x000D, new IntPtr(actualAddress.Capacity), actualAddress);
    SendMessage(cookieEdit, 0x000D, new IntPtr(actualCookie.Capacity), actualCookie);
    if (actualAddress.ToString() != address || actualCookie.ToString() != cookie) return false;
    PostMessage(dialog, 0x0111, new UIntPtr(1), IntPtr.Zero);
    return true;
  }
}`;
  const script = [
    `$source = @'\n${source}\n'@`, 'Add-Type -TypeDefinition $source -Language CSharp',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop`, '$process.Refresh()',
    `[LBCookieDialog]::Fill([IntPtr]$process.MainWindowHandle, ${quotePowerShell(address)}, ${quotePowerShell(cookie)})`
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, timeout: 30_000 });
  return stdout.trim().toLowerCase() === 'true';
}

async function readCookieFailureDialog(processId: number): Promise<string> {
  const source = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public static class LBCookieFailure {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
  public static string Read(uint expectedProcessId) {
    string result = "";
    EnumWindows(delegate(IntPtr hwnd, IntPtr state) {
      uint processId; GetWindowThreadProcessId(hwnd, out processId);
      if (processId != expectedProcessId) return true;
      var title = new StringBuilder(256); GetWindowText(hwnd, title, title.Capacity);
      if (title.ToString() != "Cookie 置入失败") return true;
      var messages = new List<string>();
      EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr nested) {
        var className = new StringBuilder(64); GetClassName(child, className, className.Capacity);
        if (className.ToString() == "Static") {
          var text = new StringBuilder(2048); GetWindowText(child, text, text.Capacity);
          if (text.Length > 0) messages.Add(text.ToString());
        }
        return true;
      }, IntPtr.Zero);
      result = string.Join("；", messages); return false;
    }, IntPtr.Zero);
    return result;
  }
}`;
  const script = [
    `$source = @'\n${source}\n'@`, 'Add-Type -TypeDefinition $source -Language CSharp',
    `[LBCookieFailure]::Read(${processId})`
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true, timeout: 30_000
  });
  return stdout.trim();
}

async function postMainClose(processId: number): Promise<void> {
  const command = `$process = Get-Process -Id ${processId} -ErrorAction SilentlyContinue; if ($process) { $process.Refresh(); Add-Type -Namespace LB -Name Native -MemberDefinition '[DllImport("user32.dll")] public static extern bool PostMessage(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, System.IntPtr lParam);'; [LB.Native]::PostMessage([IntPtr]$process.MainWindowHandle, 0x0010, [UIntPtr]::Zero, [IntPtr]::Zero) | Out-Null }`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 30_000 });
}

function visibleStableId(probe: WindowProbe): string {
  const visible = probe.browsers.filter(browser => browser.Visible);
  if (visible.length !== 1) throw new Error(`应只显示一个浏览器，实际可见 ${visible.length} 个：${JSON.stringify(probe.browsers)}`);
  return visible[0]!.StableId;
}

function verifyProbe(probe: WindowProbe, expectedIds: readonly string[], expectedVisibleCount = 1): void {
  if (probe.browsers.length !== expectedIds.length) {
    throw new Error(`预期 ${expectedIds.length} 个浏览器 HWND，实际为 ${probe.browsers.length}。`);
  }
  if (new Set(probe.browsers.map(browser => browser.Handle)).size !== expectedIds.length
    || new Set(probe.browsers.map(browser => browser.Companion)).size !== expectedIds.length
    || new Set(probe.browsers.map(browser => browser.ProcessId)).size !== expectedIds.length) {
    throw new Error('浏览器实例没有使用互不相同的 Host PID、浏览器 HWND 和伴随宿主 HWND。');
  }
  const actualIds = new Set(probe.browsers.map(browser => browser.StableId));
  if (expectedIds.some(id => !actualIds.has(id))) throw new Error(`稳定 ID 与 HWND 绑定不完整：${JSON.stringify(probe.browsers)}`);
  if (probe.browsers.some(browser => browser.ChildCount <= 0)) throw new Error('至少一个 FBro Host 没有创建 Chromium 子窗口。');
  const visibleCount = probe.browsers.filter(browser => browser.Visible).length;
  if (visibleCount !== expectedVisibleCount) {
    throw new Error(`预期 ${expectedVisibleCount} 个可见浏览器，实际为 ${visibleCount}。`);
  }
}

async function waitForProbe(processId: number, expectedIds: readonly string[], timeoutMs = 240_000,
  expectedVisibleCount = 1): Promise<WindowProbe> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '尚未取得窗口探针。';
  while (Date.now() < deadline) {
    try {
      const probe = await inspectBrowsers(processId);
      verifyProbe(probe, expectedIds, expectedVisibleCount);
      return probe;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
  }
  throw new Error(`未在 ${Math.round(timeoutMs / 1000)} 秒内取得预期浏览器状态：${lastError}`);
}

const listGeometry = { x: 18, y: 138, headerHeight: 28, paddingX: 8, paddingY: 6, rowHeight: 116 } as const;
const listRowStride = listGeometry.rowHeight + listGeometry.paddingY;

async function clickRow(processId: number, index: number): Promise<void> {
  await postClientClick(processId, listGeometry.x + listGeometry.paddingX + 150,
    listGeometry.y + listGeometry.headerHeight + listGeometry.paddingY + index * listRowStride + 20);
}

async function clickRowAction(processId: number, index: number,
  action: 'status' | 'close' | 'delete' | 'cookie' | 'move-up' | 'move-down' | 'move-top' | 'move-bottom'): Promise<void> {
  const xByAction = { status: 403, close: 77, delete: 161, cookie: 238, 'move-up': 290, 'move-down': 322, 'move-top': 354, 'move-bottom': 386 };
  const relativeY = action === 'status' ? 20 : 84;
  await postClientClick(processId, xByAction[action],
    listGeometry.y + listGeometry.headerHeight + listGeometry.paddingY + index * listRowStride + relativeY);
}

async function waitForVisible(processId: number, expectedId: string, expectedOpenIds: readonly string[]): Promise<WindowProbe> {
  let result: WindowProbe | undefined;
  let lastObserved = '尚未取得窗口快照。';
  try {
    await waitUntil(async () => {
      try {
        const probe = await inspectBrowsers(processId);
        lastObserved = JSON.stringify(probe);
        verifyProbe(probe, expectedOpenIds);
        if (visibleStableId(probe) !== expectedId) return false;
        result = probe;
        return true;
      } catch { return false; }
    }, 30_000, '切换浏览器超时。');
  } catch {
    throw new Error(`切换后没有只显示稳定会话 ${expectedId}；最后窗口状态：${lastObserved}`);
  }
  return result!;
}

async function assertOrder(processId: number, order: readonly string[], openIds: readonly string[]): Promise<void> {
  for (let index = 0; index < order.length; index += 1) {
    await clickRow(processId, index);
    await waitForVisible(processId, order[index]!, openIds);
  }
}

function bindingSnapshot(probe: WindowProbe): Map<string, string> {
  return new Map(probe.browsers.map(browser => [browser.StableId,
    `${browser.ProcessId}:${browser.Companion}:${browser.Handle}`]));
}

function assertBindingUnchanged(before: Map<string, string>, after: WindowProbe): void {
  for (const browser of after.browsers) {
    if (before.get(browser.StableId) !== `${browser.ProcessId}:${browser.Companion}:${browser.Handle}`) {
      throw new Error(`排序导致稳定会话 ${browser.StableId} 的浏览器绑定串位。`);
    }
  }
}

function templateActions(richList: LingControl): Array<Record<string, unknown>> {
  const values = Array.isArray(richList.properties?.templateJson) ? richList.properties.templateJson : [];
  const template = JSON.parse(String(values[0] ?? '{}')) as { template?: { nodes?: Array<Record<string, unknown>> } };
  return template.template?.nodes ?? [];
}

async function validateProject(): Promise<{ project: LingWindowProject; source: string; viewport: LingControl }> {
  const projectDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const [designerText, modulesText, source, solutionText] = await Promise.all([
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(path.join(projectDirectory, 'project-modules.json'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, '.lingbuilder', 'solution.json'), 'utf8')
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  const modules = JSON.parse(modulesText) as { enabledModuleIds?: string[]; pinnedVersions?: Record<string, string> };
  const solution = JSON.parse(solutionText) as { projects?: Array<{ id?: string; solutionFolderId?: string }> };
  const controls = project.windows[0]?.controls ?? [];
  const richList = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/RichList');
  const viewport = controls.find(control => control.designerType === 'lingbuilder.new_emoji.ui/BrowserViewport');
  const tabs = controls.find(control => control.id === 'browser-host-tabs');
  if (!richList || !viewport || tabs?.designerType !== 'lingbuilder.new_emoji.ui/Tabs'
    || tabs.properties?.headerVisible !== false || controls.some(control => control.type === 'FBroBrowser')) {
    throw new Error('项目必须只使用 RichList + 隐藏 Tabs + BrowserViewport，不能预放固定 FBroBrowser。');
  }
  const nodes = templateActions(richList);
  const requiredActions = ['status', 'close', 'delete', 'cookie', 'move-up', 'move-down', 'move-top', 'move-bottom'];
  for (const actionId of requiredActions) {
    const node = nodes.find(item => item.actionId === actionId);
    if (!node) throw new Error(`RichList 缺少行动作：${actionId}`);
    if (['move-up', 'move-down', 'move-top', 'move-bottom'].includes(actionId) && !String(node.tooltip ?? '').trim()) {
      throw new Error(`RichList 图标动作 ${actionId} 缺少中文 Tooltip。`);
    }
  }
  if (richList.events?.SelectionChanged !== '_浏览器会话列表_选择变化'
    || richList.events?.ItemClicked !== '_浏览器会话列表_项目被点击'
    || richList.events?.ButtonClicked !== '_浏览器会话列表_按钮被点击') {
    throw new Error('RichList 必须同时绑定 SelectionChanged、ItemClicked 和 ButtonClicked。');
  }
  const expectedModules = ['lingbuilder.win32.basic', 'lingbuilder.std.text', 'lingbuilder.new_emoji.ui', 'lingbuilder.fbro.browser', 'lingbuilder.new_emoji.fbro-shell'];
  if (expectedModules.some(moduleId => !modules.enabledModuleIds?.includes(moduleId))
    || modules.pinnedVersions?.['lingbuilder.new_emoji.fbro-shell'] !== '1.2.0') {
    throw new Error('项目模块引用缺少 fbro-shell 1.2.0 或其它必需模块。');
  }
  if (!solution.projects?.some(item => item.id === projectId && item.solutionFolderId === 'newemoji')) {
    throw new Error('解决方案未把新项目加入 NewEmoji集合。');
  }
  const requiredSource = [
    '浏览器外壳_创建(浏览器Host页面, 浏览器页面占位, &浏览器状态改变)',
    '浏览器外壳_绑定实例列表(浏览器会话列表)',
    '浏览器外壳_新建独立实例(稳定ID, 默认网址, 标题, 缓存目录)',
    '浏览器外壳_处理实例列表动作(事件数据)',
    '事件 _浏览器会话列表_项目被点击(文本型 事件数据)',
    '事件 _浏览器会话列表_按钮被点击(文本型 事件数据)'
  ];
  if (requiredSource.some(fragment => !source.includes(fragment)) || source.includes('FBroBrowser')) {
    throw new Error('MainWindow.lcpp 缺少稳定会话/RichList 行动作链路，或仍依赖固定 FBroBrowser。');
  }
  return { project, source, viewport };
}

async function buildNative(project: LingWindowProject, source: string): Promise<{ executable: string; mainCpp: string }> {
  if (!releaseBuild) {
    for (const control of project.windows[0]?.controls ?? []) {
      if (control.id === 'address-input') {
        control.content = fixtureUrl;
        control.properties = { ...control.properties, value: fixtureUrl };
      }
    }
    source = source.replace('文本型 默认网址 = "https://www.baidu.com/"', `文本型 默认网址 = "${fixtureUrl}"`);
  }
  const enabledModules = [
    builtin('lingbuilder.win32.basic'), builtin('lingbuilder.std.text'), await installed('lingbuilder.new_emoji.ui'),
    builtin('lingbuilder.fbro.browser'), builtin('lingbuilder.new_emoji.fbro-shell')
  ];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window', lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: source, enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const buildRoot = path.resolve(repositoryRoot, '.lingbuilder-build');
  const resolvedBuild = path.resolve(buildDirectory);
  if (!resolvedBuild.startsWith(`${buildRoot}${path.sep}`)) throw new Error('拒绝清理工作区构建目录之外的路径。');
  await fs.rm(resolvedBuild, { recursive: true, force: true });
  await fs.mkdir(resolvedBuild, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(resolvedBuild, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  for (const candidate of [path.join(repositoryRoot, 'image', 'lingbuilder-ide-icon-v2.ico'), path.join(repositoryRoot, 'electron', 'assets', 'lingbuilder-window.ico')]) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(resolvedBuild, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(resolvedBuild, 'resources', 'lingbuilder-app.ico'));
      break;
    } catch { /* Try the next bundled icon. */ }
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, resolvedBuild);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: resolvedBuild, projectId, generatedFiles: generated.files, enabledModules });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: resolvedBuild, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024
  });
  const executable = path.join(resolvedBuild, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const mainCpp = await fs.readFile(path.join(resolvedBuild, 'main.cpp'), 'utf8');
  for (const symbol of ['浏览器外壳_关闭实例', '浏览器外壳_重新打开实例', '浏览器外壳_删除实例',
    '浏览器外壳_设置实例Cookie', '浏览器外壳_处理实例列表动作', 'LB_NE_StartBrowserShellProcess']) {
    if (!mainCpp.includes(symbol)) throw new Error(`生成的 C++ 缺少运行时符号：${symbol}`);
  }
  if (!mainCpp.includes('L"setCookie"') || !mainCpp.includes('shellSessionOpen')) {
    throw new Error('生成的 C++ 未包含独立 Cookie Host 协议或关闭/重开状态模型。');
  }
  return { executable, mainCpp };
}

async function runRuntimeSmoke(executable: string): Promise<Record<string, unknown>> {
  const beforeHosts = await countHostProcesses();
  const runtimePid = await startRuntime(executable);
  let gracefulClose = false;
  try {
    await waitUntil(() => isProcessResponding(runtimePid), 30_000, '主窗口启动后未恢复消息响应。');
    let probe = await waitForProbe(runtimePid, ['rich-browser-1']);
    if (visibleStableId(probe) !== 'rich-browser-1') throw new Error('初始浏览器没有自动选中并显示。');

    const allIds = ['rich-browser-1', 'rich-browser-2', 'rich-browser-3', 'rich-browser-4'];
    for (let index = 1; index < allIds.length; index += 1) {
      let created = false;
      for (let attempt = 0; attempt < 3 && !created; attempt += 1) {
        await postClientClick(runtimePid, 93, 105);
        try {
          probe = await waitForProbe(runtimePid, allIds.slice(0, index + 1), 30_000);
          created = true;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      if (visibleStableId(probe) !== allIds[index]) {
        throw new Error(`新建后没有自动显示稳定会话 ${allIds[index]}。`);
      }
    }
    if (visibleStableId(probe) !== 'rich-browser-4') throw new Error('连续新建后没有自动显示最新会话。');
    const initialBindings = bindingSnapshot(probe);

    const profileRoot = path.join(path.dirname(executable), '.fbro-profiles');
    const profiles = allIds.map((_, index) => path.join(profileRoot, `richlist-session-${index + 1}`));
    await waitUntil(async () => (await Promise.all(profiles.map(async profile => {
      try { return (await fs.stat(profile)).isDirectory(); } catch { return false; }
    }))).every(Boolean), 30_000, '四个独立 Profile 目录未全部创建。');
    if (new Set(profiles.map(profile => path.resolve(profile).toLowerCase())).size !== profiles.length) {
      throw new Error('浏览器会话复用了缓存目录。');
    }

    await assertOrder(runtimePid, allIds, allIds);
    await clickRowAction(runtimePid, 2, 'move-up');
    await assertOrder(runtimePid, ['rich-browser-1', 'rich-browser-3', 'rich-browser-2', 'rich-browser-4'], allIds);
    await clickRowAction(runtimePid, 1, 'move-down');
    await assertOrder(runtimePid, allIds, allIds);
    await clickRowAction(runtimePid, 2, 'move-top');
    await assertOrder(runtimePid, ['rich-browser-3', 'rich-browser-1', 'rich-browser-2', 'rich-browser-4'], allIds);
    await clickRowAction(runtimePid, 0, 'move-bottom');
    const reordered = ['rich-browser-1', 'rich-browser-2', 'rich-browser-4', 'rich-browser-3'];
    await assertOrder(runtimePid, reordered, allIds);
    probe = await inspectBrowsers(runtimePid);
    assertBindingUnchanged(initialBindings, probe);
    await clickRowAction(runtimePid, 0, 'move-up');
    await clickRowAction(runtimePid, 3, 'move-down');
    await assertOrder(runtimePid, reordered, allIds);

    await clickRowAction(runtimePid, 1, 'close');
    const withoutTwo = ['rich-browser-1', 'rich-browser-3', 'rich-browser-4'];
    probe = await waitForProbe(runtimePid, withoutTwo, 60_000);
    if (probe.browsers.some(browser => browser.StableId === 'rich-browser-2')) throw new Error('关闭会话后原生 Host/HWND 未释放。');
    if (visibleStableId(probe) !== 'rich-browser-3') throw new Error('关闭非当前会话错误切换了当前浏览器。');
    await clickRowAction(runtimePid, 1, 'status');
    probe = await waitForProbe(runtimePid, allIds, 120_000);
    if (visibleStableId(probe) !== 'rich-browser-2') throw new Error('点击“已关闭”后没有恢复并显示原稳定会话。');
    const reopened = probe.browsers.find(browser => browser.StableId === 'rich-browser-2');
    if (!reopened || initialBindings.get('rich-browser-2') === `${reopened.ProcessId}:${reopened.Companion}:${reopened.Handle}`) {
      throw new Error('重新打开没有创建新的 Host 进程和伴随 HWND。');
    }

    await clickRowAction(runtimePid, 2, 'delete');
    const afterDeleteIds = ['rich-browser-1', 'rich-browser-2', 'rich-browser-3'];
    probe = await waitForProbe(runtimePid, afterDeleteIds, 60_000);
    if (probe.browsers.some(browser => browser.StableId === 'rich-browser-4')) throw new Error('删除会话后实例绑定仍存在。');
    await assertOrder(runtimePid, afterDeleteIds, afterDeleteIds);

    await clickRowAction(runtimePid, 1, 'cookie');
    await waitUntil(() => fillCookieDialog(runtimePid, cookieUrl, `${cookieName}=target-session`),
      30_000, 'Cookie 中文输入对话框未出现或无法提交。');
    let cookieFailure = '';
    await waitUntil(async () => {
      const state = await inspectBrowsers(runtimePid);
      if (state.mainEnabled) return true;
      cookieFailure = await readCookieFailureDialog(runtimePid);
      return cookieFailure.length > 0;
    }, 30_000, 'Cookie 置入后主窗口未恢复消息响应。');
    if (cookieFailure) throw new Error(`Cookie 置入失败：${cookieFailure}`);
    await waitForVisible(runtimePid, 'rich-browser-2', afterDeleteIds);
    await clickRowAction(runtimePid, 1, 'close');
    await waitForProbe(runtimePid, ['rich-browser-1', 'rich-browser-3'], 60_000, 0);

    await postMainClose(runtimePid);
    await waitUntil(async () => !(await isProcessAlive(runtimePid)), 30_000, '主窗口关闭后测试进程未退出。');
    gracefulClose = true;
    await waitUntil(async () => (await countHostProcesses()) <= beforeHosts, 30_000, '主窗口退出后 FBro Host 进程未全部回收。');
    return {
      initialSessions: 1, createdSessions: 4, uniqueProfiles: profiles.length,
      closeReopen: true, deleteBinding: true, reorder: true, cookieIsolation: true,
      gracefulClose, remainingHostProcesses: await countHostProcesses()
    };
  } finally {
    if (await isProcessAlive(runtimePid)) await stopRuntime(runtimePid);
    await waitUntil(async () => (await countHostProcesses()) <= beforeHosts, 30_000,
      '测试清理后仍有 LingBuilderFbroHost.exe 残留。');
  }
}

async function main(): Promise<void> {
  const { project, source } = await validateProject();
  const built = await buildNative(project, source);
  if (releaseBuild) {
    console.log(JSON.stringify({ ok: true, projectId, buildDirectory, executable: built.executable, configuration: 'Release', platform: 'x64' }, null, 2));
    return;
  }
  const runtime = await runRuntimeSmoke(built.executable);
  console.log(JSON.stringify({ ok: true, projectId, buildDirectory, executable: built.executable, runtime }, null, 2));
}

void main();
