import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
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
const projectId = 'win32-fbro-multi-browser-manager';
const releaseBuild = process.argv.includes('--release');
const singleInstance = process.argv.includes('--single-instance');
const buildOnly = process.argv.includes('--build-only');
const layoutOnly = process.argv.includes('--layout-only');
const downloadSmoke = process.argv.includes('--download');
const pluginVerificationSmoke = process.argv.includes('--plugin-verification');
const pluginVerificationUrl = pluginVerificationSmoke ? 'https://www.doubao.com/chat/' : '';
const chromiumStartUrl = process.argv.includes('--chrome-extensions') ? 'chrome://extensions/' : '';
let popupStartUrl = process.env.LINGBUILDER_FBRO_SMOKE_POPUP_START_URL || '';
let popupTargetUrl = process.env.LINGBUILDER_FBRO_SMOKE_POPUP_TARGET_URL || '';
let downloadStartUrl = '';
const downloadFileName = `lingbuilder-download-smoke-${process.pid}.txt`;
const downloadContent = Buffer.from(`LingBuilder download smoke ${process.pid}\n`, 'utf8');
const buildDirectory = path.join(repositoryRoot, '.lingbuilder-build',
  releaseBuild ? 'win32-fbro-multi-browser-manager-native' : 'win32-fbro-multi-browser-manager-native-smoke');
const smokeWorkspaceKey = `${projectId}-smoke-${process.pid}-${Date.now()}`;

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

async function countHostProcesses(): Promise<number> {
  const command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'LingBuilderFbroHost.exe'\").Count";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

function quotePowerShell(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

async function startRuntime(executable: string): Promise<number> {
  const cwd = path.dirname(executable);
  const command = `$p = Start-Process -FilePath ${quotePowerShell(executable)} -WorkingDirectory ${quotePowerShell(cwd)} -WindowStyle Normal -PassThru; $p.Id`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  const pid = Number.parseInt(stdout.trim(), 10);
  if (!Number.isInteger(pid) || pid <= 0) throw new Error('无法启动独立浏览器管理器。');
  return pid;
}

async function stopRuntime(pid: number): Promise<void> {
  const command = `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p) { $null = $p.CloseMainWindow(); if (-not $p.WaitForExit(20000)) { Stop-Process -InputObject $p -Force } }`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true, timeout: 30000 });
}

async function isProcessResponding(pid: number): Promise<boolean> {
  const command = `$p = Get-Process -Id ${pid} -ErrorAction SilentlyContinue; if ($p -and $p.Responding) { 1 } else { 0 }`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) === 1;
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, message: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch (error) { lastError = error instanceof Error ? error.message : String(error); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`${message}${lastError ? `：${lastError}` : ''}`);
}

interface BrowserProbe {
  handle: number;
  parent: number;
  processId: number;
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
  parentLeft: number;
  parentTop: number;
  parentWidth: number;
  parentHeight: number;
}

interface WindowProbe {
  clientWidth: number;
  clientHeight: number;
  tabLeft: number;
  tabTop: number;
  tabWidth: number;
  tabHeight: number;
  addressText: string;
  addressLeft: number;
  addressWidth: number;
  listTop: number;
  listHeight: number;
  listItems: string[];
  browsers: BrowserProbe[];
  downloadDetail?: string;
  downloadProgress?: number;
  downloadDetailTop?: number;
  downloadDetailHeight?: number;
  downloadDetailStyle?: number;
  downloadProgressTop?: number;
  downloadedFile?: string;
  chromiumStartUrl?: string;
  popupTargetUrl?: string;
  hostCountAfterPopup?: number;
}

async function clickBrowserLink(browser: BrowserProbe): Promise<void> {
  const script = String.raw`
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class LBMouse {
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr hwnd, uint flags);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr hwnd, int command);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extra);
  public static void Click(IntPtr browser, int x, int y) {
    IntPtr root = GetAncestor(browser, 2);
    ShowWindow(root, 9);
    SetForegroundWindow(root);
    Thread.Sleep(250);
    SetCursorPos(x, y);
    mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
    mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
  }
}
'@
[LBMouse]::Click([IntPtr]${browser.handle}, ${browser.left + Math.max(20, Math.floor(browser.width / 2))}, ${browser.top + Math.max(20, Math.floor(browser.height / 2))})`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024
  });
}

async function resizeRuntimeWindow(pid: number, width: number, height: number): Promise<void> {
  const script = String.raw`
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class LBResize {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);
  public static void Resize(IntPtr hwnd, int width, int height) {
    RECT rect;
    if (!GetWindowRect(hwnd, out rect)) throw new InvalidOperationException("Unable to read the main window bounds.");
    if (!SetWindowPos(hwnd, IntPtr.Zero, rect.Left, rect.Top, width, height, 0x0004 | 0x0010)) throw new InvalidOperationException("Unable to resize the main window.");
    return;
  }
/*
    RECT rect; if (!GetWindowRect(hwnd, out rect)) throw new InvalidOperationException("无法读取主窗口区域。");
    if (!SetWindowPos(hwnd, IntPtr.Zero, rect.Left, rect.Top, width, height, 0x0004 | 0x0010)) throw new InvalidOperationException("无法调整主窗口尺寸。");
  }
*/
}
'@
$p = Get-Process -Id ${pid} -ErrorAction Stop
if ($p.MainWindowHandle -eq [IntPtr]::Zero) { throw "Main window handle is empty." }
<#!
if ($p.MainWindowHandle -eq [IntPtr]::Zero) { throw "主窗口句柄为空。" }
#>
[LBResize]::Resize($p.MainWindowHandle, ${width}, ${height})`;
  await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true, timeout: 30000, maxBuffer: 1024 * 1024
  });
}

async function readPersistedLastUrl(persistenceRoot: string): Promise<string> {
  const document = JSON.parse(await fs.readFile(path.join(persistenceRoot, 'browser-instances.json'), 'utf8')) as {
    selectedInstanceId?: string;
    instances?: Array<{ id?: string; lastUrl?: string }>;
  };
  return document.instances?.find(item => item.id === document.selectedInstanceId)?.lastUrl
    || document.instances?.[0]?.lastUrl || '';
}

async function startPopupFixtureServer(): Promise<Server> {
  const fixtureRoot = path.join(repositoryRoot, 'electron', 'test-fixtures');
  const server = createServer(async (request, response) => {
    const requestPath = request.url?.split('?', 1)[0] || '';
    if (requestPath === '/fbro-download.html') {
      const content = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"><title>下载测试</title></head><body style="margin:0"><a href="/downloads/${downloadFileName}" download="${downloadFileName}" style="display:flex;width:100vw;height:100vh;align-items:center;justify-content:center;font:32px sans-serif">开始下载</a></body></html>`, 'utf8');
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
      response.end(content);
      return;
    }
    if (requestPath === `/downloads/${downloadFileName}`) {
      response.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="${downloadFileName}"`,
        'Content-Length': downloadContent.length
      });
      response.end(downloadContent);
      return;
    }
    const fileName = requestPath === '/fbro-popup-target.html'
      ? 'fbro-popup-target.html'
      : requestPath === '/fbro-popup-current-window.html'
        ? 'fbro-popup-current-window.html'
        : '';
    if (!fileName) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    try {
      const content = await fs.readFile(path.join(fixtureRoot, fileName));
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Length': content.length });
      response.end(content);
    } catch {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Fixture unavailable');
    }
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  return server;
}

async function stopPopupFixtureServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function inspectRuntime(pid: number): Promise<WindowProbe> {
  const csharp = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class LBBrowserProbe {
  public long handle, parent;
  public uint processId;
  public bool visible;
  public int left, top, width, height, parentLeft, parentTop, parentWidth, parentHeight;
}
public sealed class LBWindowProbe {
  public int clientWidth, clientHeight, tabLeft, tabTop, tabWidth, tabHeight, addressLeft, addressWidth, listTop, listHeight;
  public string[] listItems;
  public LBBrowserProbe[] browsers;
  public string addressText, downloadDetail;
  public int downloadProgress, downloadDetailTop, downloadDetailHeight, downloadDetailStyle, downloadProgressTop;
}
public static class LBProbe {
  public delegate bool EnumProc(IntPtr hwnd, IntPtr state);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern IntPtr GetParent(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, StringBuilder lParam);
  [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("user32.dll", EntryPoint="GetWindowLongW")] static extern int GetWindowLong(IntPtr hwnd, int index);
  const uint WM_GETTEXT = 0x000D, WM_GETTEXTLENGTH = 0x000E;
  const uint LB_GETCOUNT = 0x018B, LB_GETTEXTLEN = 0x018A, LB_GETTEXT = 0x0189;
  public static LBWindowProbe Inspect(IntPtr main) {
    var browsers = new List<LBBrowserProbe>(); var listItems = new List<string>();
    RECT mainClient = new RECT(); GetClientRect(main, out mainClient);
    RECT tabRect = new RECT(); string addressText = "", downloadDetail = "";
    int addressLeft = 0, addressWidth = 0, listTop = 0, listHeight = 0, downloadProgress = 0;
    int downloadDetailTop = 0, downloadDetailHeight = 0, downloadDetailStyle = 0, downloadProgressTop = 0;
    EnumChildWindows(main, delegate(IntPtr hwnd, IntPtr state) {
      var name = new StringBuilder(256); GetClassName(hwnd, name, name.Capacity);
      string cls = name.ToString();
      if (cls == "SysTabControl32") GetWindowRect(hwnd, out tabRect);
      if (cls == "ListBox") {
        RECT listRect; GetWindowRect(hwnd, out listRect); listTop = listRect.Top; listHeight = listRect.Bottom - listRect.Top;
        int count = SendMessage(hwnd, LB_GETCOUNT, IntPtr.Zero, IntPtr.Zero).ToInt32();
        for (int index = 0; index < count; index++) {
          int length = SendMessage(hwnd, LB_GETTEXTLEN, new IntPtr(index), IntPtr.Zero).ToInt32();
          var text = new StringBuilder(Math.Max(1, length + 1));
          SendMessage(hwnd, LB_GETTEXT, new IntPtr(index), text); listItems.Add(text.ToString());
        }
      }
      if (string.Equals(cls, "Edit", StringComparison.OrdinalIgnoreCase)) {
        int length = SendMessage(hwnd, WM_GETTEXTLENGTH, IntPtr.Zero, IntPtr.Zero).ToInt32();
        var text = new StringBuilder(Math.Max(1, length + 1));
        SendMessage(hwnd, WM_GETTEXT, new IntPtr(text.Capacity), text);
        if (text.ToString().Contains("下载：")) {
          downloadDetail = text.ToString();
          RECT detailRect; GetWindowRect(hwnd, out detailRect);
          downloadDetailTop = detailRect.Top;
          downloadDetailHeight = detailRect.Bottom - detailRect.Top;
          downloadDetailStyle = GetWindowLong(hwnd, -16);
        }
        RECT rect; GetWindowRect(hwnd, out rect); int width = rect.Right - rect.Left;
        if (width > addressWidth) { addressText = text.ToString(); addressLeft = rect.Left; addressWidth = width; }
      }
      if (cls == "msctls_progress32") {
        downloadProgress = SendMessage(hwnd, 0x0408, IntPtr.Zero, IntPtr.Zero).ToInt32();
        RECT progressRect; GetWindowRect(hwnd, out progressRect); downloadProgressTop = progressRect.Top;
      }
      if (cls == "LingBuilder.FBro.Host.Browser") {
        RECT rect, parentRect; GetWindowRect(hwnd, out rect); IntPtr parent = GetParent(hwnd); GetWindowRect(parent, out parentRect);
        uint childPid; GetWindowThreadProcessId(hwnd, out childPid);
        browsers.Add(new LBBrowserProbe {
          handle=hwnd.ToInt64(), parent=parent.ToInt64(), processId=childPid, visible=IsWindowVisible(hwnd),
          left=rect.Left, top=rect.Top, width=rect.Right-rect.Left, height=rect.Bottom-rect.Top,
          parentLeft=parentRect.Left, parentTop=parentRect.Top, parentWidth=parentRect.Right-parentRect.Left, parentHeight=parentRect.Bottom-parentRect.Top
        });
      }
      return true;
    }, IntPtr.Zero);
    return new LBWindowProbe { clientWidth=mainClient.Right-mainClient.Left, clientHeight=mainClient.Bottom-mainClient.Top,
      tabLeft=tabRect.Left, tabTop=tabRect.Top, tabWidth=tabRect.Right-tabRect.Left,
      tabHeight=tabRect.Bottom-tabRect.Top, listItems=listItems.ToArray(), browsers=browsers.ToArray(),
      addressText=addressText, addressLeft=addressLeft, addressWidth=addressWidth,
      listTop=listTop, listHeight=listHeight,
      downloadDetail=downloadDetail, downloadProgress=downloadProgress,
      downloadDetailTop=downloadDetailTop, downloadDetailHeight=downloadDetailHeight,
      downloadDetailStyle=downloadDetailStyle, downloadProgressTop=downloadProgressTop };
  }
}`;
  const script = [
    '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)',
    `$source = @'\n${csharp}\n'@`,
    'Add-Type -TypeDefinition $source -Language CSharp',
    `$p = Get-Process -Id ${pid} -ErrorAction Stop`,
    '$p.Refresh()',
    '$main = [IntPtr]$p.MainWindowHandle',
    'if ($main -eq [IntPtr]::Zero) { throw "主窗口句柄为空。" }',
    '[LBProbe]::Inspect($main) | ConvertTo-Json -Depth 5 -Compress'
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout.trim()) as WindowProbe;
}

function verifyLayoutProbe(probe: WindowProbe): void {
  const scrollStyleMask = 0x00100000 | 0x00200000;
  if ((probe.downloadDetailHeight || 0) < 100) {
    throw new Error(`下载详情框高度不足：${probe.downloadDetailHeight || 0}px。`);
  }
  if (((probe.downloadDetailStyle || 0) & scrollStyleMask) !== 0) {
    throw new Error(`下载详情框仍带固定滚动条样式：0x${(probe.downloadDetailStyle || 0).toString(16)}。`);
  }
  if ((probe.downloadProgressTop || 0) <= (probe.downloadDetailTop || 0) + (probe.downloadDetailHeight || 0)) {
    throw new Error('下载详情框与进度条发生重叠。');
  }
}

function verifyRuntimeProbe(probe: WindowProbe, expectedCount: number): void {
  verifyLayoutProbe(probe);
  if (probe.browsers.length !== expectedCount) throw new Error(`预期 ${expectedCount} 个真实 FBro 子窗口，实际 ${probe.browsers.length} 个。`);
  if (new Set(probe.browsers.map(item => item.processId)).size !== expectedCount) throw new Error('多个实例共享了 FBro Host PID。');
  if (new Set(probe.browsers.map(item => item.parent)).size !== expectedCount) throw new Error('多个实例共享了标签页面 HWND。');
  if (probe.browsers.filter(item => item.visible).length !== 1) throw new Error('运行时没有保持仅一个浏览器页面可见。');
  for (const browser of probe.browsers) {
    if (Math.abs(browser.parentTop - probe.tabTop) > 3 || Math.abs(browser.parentLeft - probe.tabLeft) > 3) {
      throw new Error('隐藏标签表头后页面仍残留表头偏移。');
    }
    if (Math.abs(browser.parentWidth - probe.tabWidth) > 3 || Math.abs(browser.parentHeight - probe.tabHeight) > 3) {
      throw new Error('标签页面没有占满选项卡客户区。');
    }
    if (Math.abs(browser.width - browser.parentWidth) > 3 || Math.abs(browser.height - browser.parentHeight) > 3) {
      throw new Error('跨进程 FBro Host 没有跟随标签页面的实际客户区尺寸。');
    }
  }
  // 「插件已生效」是 DOM 探针确认注入后的更强状态，必须与「插件已加载」一并视为成功。
  if (probe.listItems.length !== expectedCount
    || probe.listItems.some(item => !item.includes('插件已加载') && !item.includes('插件已生效'))) {
    throw new Error(`实例列表尚未显示每个 Host 的插件加载成功状态：${JSON.stringify(probe.listItems)}`);
  }
}

function verifySidebarResize(before: WindowProbe, after: WindowProbe): void {
  if (after.clientHeight <= before.clientHeight + 80) {
    throw new Error(`主窗口高度未扩大：${before.clientHeight} -> ${after.clientHeight}`);
  }
  if (after.listHeight <= before.listHeight + 80 || after.listTop !== before.listTop) {
    throw new Error('浏览器实例列表没有在原位置吸收窗口新增高度。');
  }
  if (Math.abs((after.downloadDetailHeight || 0) - (before.downloadDetailHeight || 0)) > 3) {
    throw new Error('下载详情框在窗口缩放时不应改变高度。');
  }
  if ((after.downloadDetailTop || 0) <= (before.downloadDetailTop || 0) + 80
    || (after.downloadProgressTop || 0) <= (before.downloadProgressTop || 0) + 80) {
    throw new Error('下载详情和进度操作区没有整体贴近窗口底部移动。');
  }
}

function verifyResize(before: WindowProbe, after: WindowProbe): void {
  verifySidebarResize(before, after);
  if (after.clientWidth <= before.clientWidth + 80) {
    throw new Error(`主窗口宽度未扩大：${before.clientWidth} -> ${after.clientWidth}`);
  }
  if (after.tabWidth <= before.tabWidth + 80 || after.tabHeight <= before.tabHeight + 80) {
    throw new Error(`浏览器选项卡未随窗口扩大：${before.tabWidth}x${before.tabHeight} -> ${after.tabWidth}x${after.tabHeight}`);
  }
  if (after.addressWidth <= before.addressWidth + 80 || after.addressLeft !== before.addressLeft) {
    throw new Error('地址栏没有按预期在原位置拉伸。');
  }
}

async function scanForbidden(root: string): Promise<void> {
  const forbidden = /new_emoji|new-emoji/iu;
  const stack = [root];
  const textExtensions = new Set(['.cpp', '.h', '.hpp', '.vcxproj', '.sln', '.json', '.txt', '.md', '.props', '.targets']);
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (forbidden.test(entry.name)) throw new Error(`生成目录包含禁止项：${absolute}`);
      if (entry.isDirectory()) { stack.push(absolute); continue; }
      if (entry.isFile() && textExtensions.has(path.extname(entry.name).toLowerCase())) {
        const content = await fs.readFile(absolute, 'utf8');
        if (forbidden.test(content)) throw new Error(`生成文件包含禁止依赖：${absolute}`);
      }
    }
  }
}

async function main(): Promise<void> {
  const popupServer = process.argv.includes('--popup-current-window') || downloadSmoke
    ? await startPopupFixtureServer() : undefined;
  if (popupServer) {
    const address = popupServer.address();
    if (!address || typeof address === 'string') throw new Error('无法解析弹窗测试回环端口。');
    popupStartUrl = `http://127.0.0.1:${address.port}/fbro-popup-current-window.html?auto=1`;
    popupTargetUrl = `http://127.0.0.1:${address.port}/fbro-popup-target.html`;
    if (downloadSmoke) {
      popupStartUrl = '';
      popupTargetUrl = '';
      downloadStartUrl = `http://127.0.0.1:${address.port}/downloads/${downloadFileName}`;
    }
  }
  try {
  const projectDirectory = path.join(repositoryRoot, '.lingbuilder', 'projects', projectId);
  const [designerText, source, moduleText] = await Promise.all([
    fs.readFile(path.join(projectDirectory, 'window-designer.json'), 'utf8'),
    fs.readFile(path.join(repositoryRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8'),
    fs.readFile(path.join(projectDirectory, 'project-modules.json'), 'utf8')
  ]);
  const project = JSON.parse(designerText) as LingWindowProject;
  const moduleConfig = JSON.parse(moduleText) as { enabledModuleIds?: string[] };
  const window = project.windows[0];
  const tab = window?.controls.find(control => control.id === 'browser-pages');
  const list = window?.controls.find(control => control.id === 'browser-list');
  const detail = window?.controls.find(control => control.id === 'instance-detail');
  const progress = window?.controls.find(control => control.id === 'download-progress');
  if (window?.designerBackend !== 'win32' || tab?.type !== 'TabControl' || tab.properties?.hideHeader !== true || list?.type !== 'ListBox') {
    throw new Error('目标项目必须使用 win32 后端、隐藏表头 TabControl 和 ListBox。');
  }
  if (window.controls.some(control => control.designerType || control.type === 'FBroBrowser')) {
    throw new Error('目标项目包含其它 UI 后端或固定 FBroBrowser 设计器控件。');
  }
  if (detail?.type !== 'TextBox' || detail.height < 114 || detail.properties?.scrollBars !== 'none') {
    throw new Error('下载详情框必须使用加高、无固定滚动条的只读多行 TextBox。');
  }
  if (!progress || detail.y + detail.height >= progress.y || (list?.height || 0) > 236) {
    throw new Error('左侧详情区、进度条或实例列表的紧凑布局不符合预期。');
  }
  if (!source.includes('控件_设置位置大小(浏览器实例列表')
    || !source.includes('控件_设置位置大小(实例详情')
    || !source.includes('控件_设置位置大小(下载进度')
    || !source.includes('控件_设置位置大小(打开下载目录')) {
    throw new Error('下载详情区没有接入窗口高度自适应布局。');
  }
  const expectedModules = ['lingbuilder.win32.basic', 'lingbuilder.win32.common-controls', 'lingbuilder.fbro.browser', 'lingbuilder.browser.doubao-downloader'];
  if (JSON.stringify(moduleConfig.enabledModuleIds) !== JSON.stringify(expectedModules)) throw new Error('项目模块引用不符合最小 Win32 + FBro 集合。');

  const enabledModules = [
    builtin('lingbuilder.win32.basic'), builtin('lingbuilder.win32.common-controls'),
    builtin('lingbuilder.fbro.browser'), await installed('lingbuilder.browser.doubao-downloader')
  ];
  const useIsolatedSmokeWorkspace = !releaseBuild || pluginVerificationSmoke;
  const sourceWithWorkspace = useIsolatedSmokeWorkspace ? source
    .replace('"win32-fbro-multi-browser-manager")', `"${smokeWorkspaceKey}")`) : source;
  if ((popupStartUrl || popupTargetUrl)
    && (!/^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9._/-]+(?:\?[A-Za-z0-9=&._-]+)?$/u.test(popupStartUrl)
      || !/^http:\/\/127\.0\.0\.1:\d+\/[A-Za-z0-9._/-]+(?:\?[A-Za-z0-9=&._-]+)?$/u.test(popupTargetUrl))) {
    throw new Error('弹窗 smoke URL 必须是 127.0.0.1 回环 HTTP 地址。');
  }
  const sourceWithPopup = sourceWithWorkspace;
  const sourceForBuild = releaseBuild || singleInstance || layoutOnly ? sourceWithPopup : sourceWithPopup
    .replace('        如果 (已恢复数量 <= 0)', [
      '        如果 (已恢复数量 == 1)',
      '            浏览器管理器_新增实例("隔离实例 2", "https://www.doubao.com/")',
      '            浏览器管理器_新增实例("隔离实例 3", "https://www.doubao.com/")',
      '            已恢复数量 = 3',
      '        如果结束',
      '        如果 (已恢复数量 <= 0)'
    ].join('\n'));
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: `src/${projectId}/MainWindow.lcpp`,
    lingCppSourceCode: sourceForBuild,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));
  const generatedMain = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!/DispatchWindowEvent\(L"SizeChanged"\);[\s\S]{0,180}RedrawWindow\(hwnd_, nullptr, nullptr,[\s\S]{0,120}RDW_INVALIDATE \| RDW_ERASE \| RDW_ALLCHILDREN \| RDW_UPDATENOW/u.test(generatedMain)) {
    throw new Error('原生窗口缩放后没有统一擦除背景并重绘子控件。');
  }
  const overriddenStartUrl = chromiumStartUrl || popupStartUrl || downloadStartUrl || pluginVerificationUrl;
  if (overriddenStartUrl) {
    const startUrlLiteral = `L"${overriddenStartUrl.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
    for (const file of generated.files) {
      if (file.relativePath === 'main.cpp') {
        file.content = file.content.replaceAll('L"https://www.doubao.com/"', startUrlLiteral);
      }
    }
  }
  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const icon = path.join(repositoryRoot, 'image', 'lingbuilder-ide-icon-v2.ico');
  try {
    await fs.access(icon); await fs.mkdir(path.join(buildDirectory, 'resources'), { recursive: true });
    await fs.copyFile(icon, path.join(buildDirectory, 'resources', 'lingbuilder-app.ico'));
  } catch { /* The generated RC can fall back to its default icon. */ }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir: buildDirectory, projectId, generatedFiles: generated.files, enabledModules });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: buildDirectory, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 64 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  for (const file of ['manifest.json', 'logo.png', 'popup.html', 'doubao-downloader.user.js']) {
    await fs.access(path.join(path.dirname(executable), 'doubao-downloader', file));
  }
  await scanForbidden(buildDirectory);
  if (buildOnly) {
    console.log(JSON.stringify({ ok: true, projectId, buildDirectory, executable, releaseBuild, buildOnly }, null, 2));
    return;
  }

  let expectedInstances = releaseBuild || singleInstance || layoutOnly ? 1 : 3;
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) throw new Error('无法解析 LocalAppData。');
  const persistenceRoot = path.join(localAppData, 'LingBuilder', 'browser-workspaces',
    useIsolatedSmokeWorkspace ? smokeWorkspaceKey : projectId);
  if (releaseBuild && !useIsolatedSmokeWorkspace) {
    try {
      const existing = JSON.parse(await fs.readFile(path.join(persistenceRoot, 'browser-instances.json'), 'utf8')) as {
        instances?: unknown[];
      };
      if (Array.isArray(existing.instances) && existing.instances.length > 0) {
        expectedInstances = existing.instances.length;
      }
    } catch {
      // A missing or malformed user workspace is covered by the manager's own recovery path.
    }
  }
  if (useIsolatedSmokeWorkspace) await fs.rm(persistenceRoot, { recursive: true, force: true });
  const before = await countHostProcesses();
  const runAndProbe = async (): Promise<WindowProbe> => {
    const pid = await startRuntime(executable);
    try {
      await waitUntil(() => isProcessResponding(pid), 30000, '主窗口未恢复消息响应');
      if (layoutOnly) {
        let latest: WindowProbe | undefined;
        await waitUntil(async () => {
          latest = await inspectRuntime(pid);
          verifyLayoutProbe(latest);
          return true;
        }, 30000, '下载详情控件布局尚未就绪');
        const initialProbe = latest!;
        for (const [width, height] of [[1340, 820], [1280, 760], [1420, 880], [1500, 940]]) {
          await resizeRuntimeWindow(pid, width, height);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await waitUntil(async () => {
          latest = await inspectRuntime(pid);
          verifyLayoutProbe(latest);
          verifySidebarResize(initialProbe, latest);
          return true;
        }, 30000, '窗口缩放后的列表伸缩、详情固定高度或底部锚定未通过验收');
        return latest!;
      }
      await waitUntil(async () => (await countHostProcesses()) >= before + expectedInstances, 240000, '独立 FBro Host 数量未就绪');
      let latest: WindowProbe | undefined;
      await waitUntil(async () => {
        latest = await inspectRuntime(pid);
        verifyRuntimeProbe(latest, expectedInstances);
        return true;
      }, 240000, '页面 HWND、Host PID、可见性或插件状态未通过验收');
      const initialProbe = latest!;
      await resizeRuntimeWindow(pid, 1500, 940);
      await waitUntil(async () => {
        latest = await inspectRuntime(pid);
        verifyRuntimeProbe(latest, expectedInstances);
        verifyResize(initialProbe, latest);
        return true;
      }, 30000, '调整主窗口后浏览器页面或 Host 没有自适应');
      if (pluginVerificationSmoke) {
        await waitUntil(async () => {
          latest = await inspectRuntime(pid);
          const active = latest.listItems.some(item => item.includes('插件已生效'));
          if (!active) throw new Error(JSON.stringify(latest.listItems));
          return active;
        }, 45000, '当前豆包页面没有在扩展注册后的刷新中检测到下载器入口');
      }
      if (chromiumStartUrl) {
        await waitUntil(async () => (await readPersistedLastUrl(persistenceRoot)) === chromiumStartUrl,
          30000, 'Chromium 内部地址未进入当前浏览器实例');
        if (latest!.addressText !== chromiumStartUrl) {
          throw new Error(`地址栏没有显示扩展检查地址：${latest!.addressText}`);
        }
        latest!.chromiumStartUrl = chromiumStartUrl;
      }
      if (popupStartUrl && popupTargetUrl) {
        await waitUntil(async () => [popupStartUrl, popupTargetUrl].includes(await readPersistedLastUrl(persistenceRoot)),
          30000, '弹窗测试起始页未完成加载');
        if (await readPersistedLastUrl(persistenceRoot) !== popupTargetUrl) {
          const visibleBrowser = latest!.browsers.find(browser => browser.visible);
          if (!visibleBrowser) throw new Error('弹窗测试找不到可见浏览器 HWND。');
          await clickBrowserLink(visibleBrowser);
        }
        await waitUntil(async () => (await readPersistedLastUrl(persistenceRoot)) === popupTargetUrl,
          30000, 'target=_blank 链接没有在当前实例加载');
        const hostCountAfterPopup = await countHostProcesses();
        const expectedHostCount = before + expectedInstances;
        if (hostCountAfterPopup !== expectedHostCount) {
          throw new Error(`新窗口请求后 Host 数量异常：预期 ${expectedHostCount}，实际 ${hostCountAfterPopup}`);
        }
        latest = await inspectRuntime(pid);
        verifyRuntimeProbe(latest, expectedInstances);
        if (latest.addressText !== popupTargetUrl) {
          throw new Error(`网页导航后地址栏没有同步当前地址：${latest.addressText}`);
        }
        latest.popupTargetUrl = popupTargetUrl;
        latest.hostCountAfterPopup = hostCountAfterPopup;
      }
      if (downloadSmoke) {
        await waitUntil(async () => {
          latest = await inspectRuntime(pid);
          const completed = latest.downloadProgress === 100
            && latest.downloadDetail?.includes('下载完成') === true
            && latest.downloadDetail.includes(`文件：${downloadFileName}`)
            && latest.downloadDetail.includes('目录：');
          if (!completed) throw new Error(JSON.stringify({
            downloadProgress: latest.downloadProgress,
            downloadDetail: latest.downloadDetail
          }));
          return true;
        }, 120000, '下载文件名、目录、完成状态或进度条未更新');
        const directoryLine = latest!.downloadDetail?.split(/\r?\n/u)
          .find(line => line.startsWith('目录：'))?.slice('目录：'.length).trim() || '';
        if (!directoryLine) throw new Error('下载详情没有提供下载目录。');
        const downloadedFile = path.join(directoryLine, downloadFileName);
        const content = await fs.readFile(downloadedFile);
        if (!content.equals(downloadContent)) throw new Error('下载目录中的文件内容与回环响应不一致。');
        latest!.downloadedFile = downloadedFile;
      }
      return latest!;
    } finally {
      await stopRuntime(pid);
      await waitUntil(async () => (await countHostProcesses()) <= before, 30000, '主程序退出后 Host 未被 Job Object 回收');
    }
  };
  const firstProbe = await runAndProbe();
  if (layoutOnly) {
    if (useIsolatedSmokeWorkspace) await fs.rm(persistenceRoot, { recursive: true, force: true });
    console.log(JSON.stringify({
      ok: true, projectId, buildDirectory, executable, releaseBuild, layoutOnly, firstProbe
    }, null, 2));
    return;
  }
  const document = JSON.parse(await fs.readFile(path.join(persistenceRoot, 'browser-instances.json'), 'utf8')) as {
    instances?: Array<{ id?: string; cacheDirectory?: string; name?: string; lastUrl?: string }>;
  };
  if (document.instances?.length !== expectedInstances
    || new Set(document.instances.map(item => item.id)).size !== expectedInstances
    || new Set(document.instances.map(item => item.cacheDirectory)).size !== expectedInstances) {
    throw new Error('持久化文件没有保存唯一稳定 ID 和独立 Profile。');
  }
  const secondProbe = downloadSmoke ? firstProbe : await runAndProbe();
  if (firstProbe.downloadedFile) await fs.rm(firstProbe.downloadedFile, { force: true });
  if (useIsolatedSmokeWorkspace) await fs.rm(persistenceRoot, { recursive: true, force: true });
  console.log(JSON.stringify({
    ok: true, projectId, buildDirectory, executable, releaseBuild,
    instances: expectedInstances, firstProbe, restoredProbe: secondProbe,
    stableIds: document.instances.map(item => item.id), profiles: document.instances.map(item => item.cacheDirectory)
  }, null, 2));
  } finally {
    if (popupServer) await stopPopupFixtureServer(popupServer);
  }
}

void main();
