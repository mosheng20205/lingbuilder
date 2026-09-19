import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule, LingBuilderModuleManifest } from '../src/services/modules/types';
import { createSolutionService } from '../src/services/solution/solutionService';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectId = 'new-emoji-fbro-browser-shell-smoke';
const buildDirectory = path.join(repoRoot, '.lingbuilder-build', 'new-emoji-fbro-browser-shell-native-smoke');
let msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';

/** 用 vswhere 解析实际安装的 MSBuild（本机可能是 VS2022/2026 等），失败回落到默认路径。 */
async function resolveMsbuild(): Promise<void> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  try {
    const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
    if (installation) {
      const resolved = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
      await fs.access(resolved);
      msbuild = resolved;
    }
  } catch {
    /* 保留默认路径，交由后续 fs.access 报错 */
  }
}
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

interface RuntimeProcess {
  ProcessId: number;
  CommandLine?: string;
  ExecutablePath?: string;
}

interface RuntimeManifest {
  files: Array<{ path: string; size: number; sha256: string }>;
}

interface WindowSnapshot {
  Handle: number;
  Owner: number;
  Style: number;
  ExStyle: number;
  Visible: boolean;
  Left: number;
  Top: number;
  Right: number;
  Bottom: number;
  ClientX: number;
  ClientY: number;
  ClientWidth: number;
  ClientHeight: number;
  Dpi: number;
  ChildCount: number;
  ClassName: string;
}

interface BrowserShellWindowProbe {
  main: WindowSnapshot;
  companions: WindowSnapshot[];
  toolbarPixel: [number, number, number];
  browserPixel: [number, number, number];
  dragHitTest: number;
  tabHitTest: number;
}

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

async function installed(id: string): Promise<InstalledModule> {
  const installPath = path.join(repoRoot, '.lingbuilder', 'modules', id);
  const manifest = JSON.parse(await fs.readFile(path.join(installPath, 'lingbuilder.module.json'), 'utf8')) as LingBuilderModuleManifest;
  return {
    manifest,
    installPath,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function main() {
  assertBuildDirectory();
  await resolveMsbuild();
  await fs.access(msbuild);
  const fixture = await startFixtureServer();
  let runtime: ReturnType<typeof spawn> | undefined;
  let runtimeProcesses: RuntimeProcess[] = [];
  let normalClose = false;
  try {
    const newEmojiModule = await installed('lingbuilder.new_emoji.ui');
    const fbroSdkModule = await installed('lingbuilder.fbro.sdk');
    const enabledModules: InstalledModule[] = [
      builtin('lingbuilder.win32.basic'),
      newEmojiModule,
      builtin('lingbuilder.fbro.browser'),
      builtin('lingbuilder.new_emoji.fbro-shell')
    ];

    const workspaceDirectory = path.join(buildDirectory, 'template-workspace');
    const solutionService = createSolutionService(workspaceDirectory);
    const plan = await solutionService.previewCreateProject({
      name: 'new_emoji FBro 浏览器外壳 Smoke',
      projectId,
      templateId: 'new-emoji-fbro-browser-shell'
    });
    const mainSource = plan.files.find(file => file.kind === 'source' && file.relativePath.endsWith('/MainWindow.lcpp'));
    if (!mainSource) throw new Error('浏览器外壳模板没有生成 MainWindow.lcpp。');
    const fixtureUrl = fixture.origin;
    const source = mainSource.content
      .replaceAll('https://www.baidu.com', `${fixtureUrl}/first`)
      .replace(
        `        浏览器外壳_新建标签页("home", "${fixtureUrl}/first", "新标签页")`,
        [
          `        浏览器外壳_新建标签页("home", "${fixtureUrl}/first", "本地首页")`,
          `        浏览器外壳_新建标签页("docs", "${fixtureUrl}/second", "本地文档")`,
          `        浏览器外壳_新建标签页("status", "${fixtureUrl}/third", "本地状态")`,
          '        浏览器外壳_重排标签页("status", 1)',
          '        浏览器外壳_选择标签页("home")'
        ].join('\n')
      );
    const generated = generateLingCppNativeWin32Project(plan.designerProject, {
      enabledModules,
      lingCppSourceCode: source
    });
    if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));

    await fs.rm(buildDirectory, { recursive: true, force: true });
    await fs.mkdir(buildDirectory, { recursive: true });
    for (const file of generated.files) {
      const target = path.join(buildDirectory, file.relativePath);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, 'utf8');
    }
    const assetService = createDesignerAssetService(workspaceDirectory);
    const iconService = createWindowsExecutableIconService(
      workspaceDirectory,
      assetService,
      path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico')
    );
    await iconService.materialize(plan.project, plan.designerProject.windows[0], [buildDirectory]);
    const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
    if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
    const exported = await exportVisualStudioProject({
      projectDir: buildDirectory,
      projectId,
      generatedFiles: generated.files,
      enabledModules
    });
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
    const executableDirectory = path.dirname(executable);
    await fs.access(executable);
    const dependencyHashes = await verifyRuntimeAssets(executableDirectory, newEmojiModule, fbroSdkModule);

    runtime = spawn(executable, [], {
      cwd: executableDirectory,
      windowsHide: true,
      stdio: 'ignore'
    });
    await new Promise<void>((resolve, reject) => {
      runtime!.once('spawn', resolve);
      runtime!.once('error', reject);
    });
    if (!runtime.pid) throw new Error('浏览器外壳 smoke 未取得主进程 ID。');

    await delay(10_000);
    if (runtime.exitCode !== null) throw new Error(`浏览器外壳在 10 秒内提前退出，退出码：${runtime.exitCode}`);
    const windowProbe = await inspectBrowserShellWindows(runtime.pid);
    verifyBrowserShellWindows(windowProbe);
    runtimeProcesses = await listFbroProcesses(executableDirectory);
    const rendererProcesses = runtimeProcesses.filter(item => String(item.CommandLine || '').includes('--type=renderer'));
    if (rendererProcesses.length < 3) {
      throw new Error(`三个标签页未保持独立 FBro renderer：检测到 ${rendererProcesses.length} 个 renderer（总子进程 ${runtimeProcesses.length} 个）。`);
    }

    await closeMainWindow(runtime.pid);
    normalClose = true;
    await waitForExit(runtime, 15_000);
    await delay(2_000);
    const residualProcesses = await listFbroProcesses(executableDirectory);
    if (residualProcesses.length > 0) {
      throw new Error(`主窗口正常关闭后仍有 ${residualProcesses.length} 个 FBroSubprocess.exe 残留。`);
    }

    console.log(JSON.stringify({
      ok: true,
      buildDirectory,
      executable,
      fixtureUrl,
      runtimeSeconds: 10,
      fbroProcessCount: runtimeProcesses.length,
      rendererProcessCount: rendererProcesses.length,
      normalClose,
      windowProbe,
      dependencyHashes
    }, null, 2));
  } finally {
    await fixture.close();
    if (!normalClose && runtime?.pid) await forceStop(runtime.pid, path.join(buildDirectory, 'x64', 'Release', 'bin'));
  }
}

async function inspectBrowserShellWindows(processId: number): Promise<BrowserShellWindowProbe> {
  const source = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public sealed class LBWindowSnapshot {
  public long Handle;
  public long Owner;
  public long Style;
  public long ExStyle;
  public bool Visible;
  public int Left;
  public int Top;
  public int Right;
  public int Bottom;
  public int ClientX;
  public int ClientY;
  public int ClientWidth;
  public int ClientHeight;
  public uint Dpi;
  public int ChildCount;
  public string ClassName;
}

public static class LBBrowserShellProbe {
  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr parent, EnumWindowsProc callback, IntPtr lParam);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr hwnd, uint command);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr hwnd, out RECT rect);
  [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr hwnd, ref POINT point);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr hwnd);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr hwnd, StringBuilder text, int capacity);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")] static extern IntPtr GetWindowLongPtr64(IntPtr hwnd, int index);
  [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] static extern int GetWindowLong32(IntPtr hwnd, int index);
  [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr hwnd);
  [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr hwnd, IntPtr dc);
  [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr hwnd, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
  [DllImport("user32.dll")] static extern IntPtr SendMessageW(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);
  [DllImport("gdi32.dll")] static extern uint GetPixel(IntPtr dc, int x, int y);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr hwnd);

  static long WindowLong(IntPtr hwnd, int index) {
    return IntPtr.Size == 8 ? GetWindowLongPtr64(hwnd, index).ToInt64() : GetWindowLong32(hwnd, index);
  }

  public static LBWindowSnapshot Snapshot(IntPtr hwnd) {
    RECT windowRect; GetWindowRect(hwnd, out windowRect);
    RECT clientRect; GetClientRect(hwnd, out clientRect);
    POINT clientOrigin = new POINT { X = 0, Y = 0 }; ClientToScreen(hwnd, ref clientOrigin);
    int childCount = 0;
    EnumChildWindows(hwnd, delegate(IntPtr child, IntPtr state) { childCount++; return true; }, IntPtr.Zero);
    var className = new StringBuilder(256); GetClassName(hwnd, className, className.Capacity);
    return new LBWindowSnapshot {
      Handle = hwnd.ToInt64(), Owner = GetWindow(hwnd, 4).ToInt64(),
      Style = WindowLong(hwnd, -16), ExStyle = WindowLong(hwnd, -20), Visible = IsWindowVisible(hwnd),
      Left = windowRect.Left, Top = windowRect.Top, Right = windowRect.Right, Bottom = windowRect.Bottom,
      ClientX = clientOrigin.X, ClientY = clientOrigin.Y,
      ClientWidth = clientRect.Right - clientRect.Left, ClientHeight = clientRect.Bottom - clientRect.Top,
      Dpi = GetDpiForWindow(hwnd), ChildCount = childCount, ClassName = className.ToString()
    };
  }

  public static LBWindowSnapshot[] FindCompanions(int processId, IntPtr owner) {
    var result = new List<LBWindowSnapshot>();
    EnumWindows(delegate(IntPtr hwnd, IntPtr state) {
      uint candidateProcessId; GetWindowThreadProcessId(hwnd, out candidateProcessId);
      if (candidateProcessId == (uint)processId && GetWindow(hwnd, 4) == owner) {
        var snapshot = Snapshot(hwnd);
        if ((snapshot.Style & unchecked((long)0x80000000)) != 0 && (snapshot.ExStyle & 0x80) != 0) result.Add(snapshot);
      }
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }

  public static int[][] Sample(IntPtr main) {
    var snapshot = Snapshot(main);
    SetWindowPos(main, new IntPtr(-1), 0, 0, 0, 0, 0x0013);
    System.Threading.Thread.Sleep(400);
    IntPtr dc = GetDC(IntPtr.Zero);
    try {
      return new [] {
        ReadRgb(dc, snapshot.ClientX + snapshot.ClientWidth / 2, snapshot.ClientY + Math.Max(10, Scale(20, snapshot.Dpi))),
        ReadRgb(dc, snapshot.ClientX + snapshot.ClientWidth / 2, snapshot.ClientY + Math.Max(100, Scale(220, snapshot.Dpi)))
      };
    } finally {
      ReleaseDC(IntPtr.Zero, dc);
      SetWindowPos(main, new IntPtr(-2), 0, 0, 0, 0, 0x0013);
    }
  }

  public static int HitTest(IntPtr main, int logicalX, int logicalY) {
    var snapshot = Snapshot(main);
    int screenX = snapshot.ClientX + Scale(logicalX, snapshot.Dpi);
    int screenY = snapshot.ClientY + Scale(logicalY, snapshot.Dpi);
    int packed = unchecked((screenY << 16) | (screenX & 0xffff));
    return SendMessageW(main, 0x0084, IntPtr.Zero, new IntPtr(packed)).ToInt32();
  }

  public static int Scale(int value, uint dpi) { return (int)((long)value * (dpi == 0 ? 96 : dpi) / 96); }
  static int[] ReadRgb(IntPtr dc, int x, int y) {
    uint color = GetPixel(dc, x, y);
    return new [] { (int)(color & 255), (int)((color >> 8) & 255), (int)((color >> 16) & 255) };
  }
}`;
  const script = [
    `$source = @'\n${source}\n'@`,
    'Add-Type -TypeDefinition $source -Language CSharp',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop`,
    '$process.Refresh()',
    '$mainHandle = [IntPtr]$process.MainWindowHandle',
    'if ($mainHandle -eq [IntPtr]::Zero) { throw "浏览器外壳没有主窗口句柄。" }',
    '$main = [LBBrowserShellProbe]::Snapshot($mainHandle)',
    `$companions = @([LBBrowserShellProbe]::FindCompanions(${processId}, $mainHandle))`,
    '$pixels = [LBBrowserShellProbe]::Sample($mainHandle)',
    '$dragHitTest = [LBBrowserShellProbe]::HitTest($mainHandle, 800, 20)',
    '$tabHitTest = [LBBrowserShellProbe]::HitTest($mainHandle, 100, 20)',
    '[pscustomobject]@{ main = $main; companions = $companions; toolbarPixel = $pixels[0]; browserPixel = $pixels[1]; dragHitTest = $dragHitTest; tabHitTest = $tabHitTest } | ConvertTo-Json -Depth 6 -Compress'
  ].join('\n');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', script], {
    windowsHide: true,
    timeout: 30_000,
    maxBuffer: 4 * 1024 * 1024
  });
  return JSON.parse(stdout.trim()) as BrowserShellWindowProbe;
}

function verifyBrowserShellWindows(probe: BrowserShellWindowProbe): void {
  const wsChild = 0x40000000;
  const wsExLayered = 0x00080000;
  if ((probe.main.ExStyle & wsExLayered) === 0) throw new Error('new_emoji 主窗口未处于分层渲染模式，smoke 无法覆盖本次回归。');
  if (probe.companions.length !== 3) {
    throw new Error(`应创建三个伴随宿主窗口，实际为 ${probe.companions.length} 个：${JSON.stringify(probe.companions)}`);
  }
  const visible = probe.companions.filter(item => item.Visible);
  if (visible.length !== 1) throw new Error(`多标签页应只显示一个伴随宿主，实际可见 ${visible.length} 个。`);
  const expectedTop = probe.main.ClientY + Math.trunc(90 * (probe.main.Dpi || 96) / 96);
  for (const host of probe.companions) {
    if (host.Owner !== probe.main.Handle) throw new Error('FBro 伴随宿主没有绑定 new_emoji 主窗口 owner。');
    if ((host.Style & wsChild) !== 0) throw new Error('FBro 伴随宿主仍带 WS_CHILD。');
    if ((host.ExStyle & wsExLayered) !== 0) throw new Error('FBro 伴随宿主错误继承了 WS_EX_LAYERED。');
    if (host.Left !== probe.main.ClientX || Math.abs(host.Top - expectedTop) > 1) {
      throw new Error(`FBro 伴随宿主位置错误：(${host.Left}, ${host.Top})，预期 (${probe.main.ClientX}, ${expectedTop})。`);
    }
    if (host.Right - host.Left !== probe.main.ClientWidth || host.Bottom - host.Top !== probe.main.ClientHeight - (expectedTop - probe.main.ClientY)) {
      throw new Error('FBro 伴随宿主尺寸未覆盖 BrowserViewport。');
    }
    if (host.ChildCount === 0) throw new Error('FBro 伴随宿主未创建 Chromium 子窗口。');
  }
  const isNearWhite = ([red, green, blue]: [number, number, number]) => red >= 235 && green >= 235 && blue >= 235;
  if (isNearWhite(probe.toolbarPixel)) throw new Error(`顶部浏览器外壳被网页覆盖：RGB(${probe.toolbarPixel.join(',')})。`);
  if (!isNearWhite(probe.browserPixel)) throw new Error(`网页区域未显示本地白色 fixture：RGB(${probe.browserPixel.join(',')})。`);
  if (probe.dragHitTest !== 2) throw new Error(`标签后的顶部空白区不可拖动窗口：WM_NCHITTEST=${probe.dragHitTest}。`);
  if (probe.tabHitTest === 2) throw new Error('标签交互区被错误识别为窗口拖拽区。');
}

function assertBuildDirectory(): void {
  const relative = path.relative(repoRoot, buildDirectory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`拒绝清理工作区外的 smoke 目录：${buildDirectory}`);
  }
}

async function startFixtureServer(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((request, response) => {
    const page = String(request.url || '/').replace(/^\//u, '') || 'first';
    const title = `LingBuilder FBro ${page}`;
    const body = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><main><h1>${title}</h1><a href="/history">history</a><script>document.documentElement.dataset.fixture="${page}";</script></main></body></html>`;
    response.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-length': Buffer.byteLength(body)
    });
    response.end(body);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('本地 HTTP fixture 启动失败。');
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => closeServer(server)
  };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
}

async function verifyRuntimeAssets(
  executableDirectory: string,
  newEmojiModule: InstalledModule,
  fbroSdkModule: InstalledModule
): Promise<Record<string, string>> {
  const hashes: Record<string, string> = {};
  const newEmojiTarget = newEmojiModule.manifest.targets?.find(target => target.id === 'windows-msvc-x64');
  for (const relativePath of newEmojiTarget?.runtimeFiles || []) {
    const source = path.join(newEmojiModule.installPath, ...relativePath.split('/'));
    const target = path.join(executableDirectory, path.basename(relativePath));
    await assertSameHash(source, target, hashes, path.basename(relativePath));
  }

  const sdkRoot = path.join(fbroSdkModule.installPath, 'sdk');
  await assertSameHash(
    path.join(sdkRoot, 'bridge', 'x64', 'LingBuilderFbroBridge.dll'),
    path.join(executableDirectory, 'LingBuilderFbroBridge.dll'),
    hashes,
    'LingBuilderFbroBridge.dll'
  );
  const manifest = JSON.parse(await fs.readFile(path.join(sdkRoot, 'runtime-manifest.json'), 'utf8')) as RuntimeManifest;
  for (const entry of manifest.files) {
    const source = path.join(sdkRoot, 'runtime', 'x64', ...entry.path.split('/'));
    const target = path.join(executableDirectory, ...entry.path.split('/'));
    const stat = await fs.stat(target);
    if (stat.size !== entry.size) throw new Error(`FBro 运行时文件大小不匹配：${entry.path}`);
    await assertSameHash(source, target, hashes, entry.path);
    if (hashes[entry.path] !== entry.sha256.toLowerCase()) throw new Error(`FBro 运行时清单哈希不匹配：${entry.path}`);
  }
  for (const required of ['new_emoji.dll', 'LingBuilderFbroBridge.dll', 'libcef.dll', 'chrome_elf.dll', 'FBroSubprocess.exe', 'icudtl.dat', 'locales/zh-CN.pak']) {
    await fs.access(path.join(executableDirectory, ...required.split('/')));
  }
  return hashes;
}

async function assertSameHash(
  source: string,
  target: string,
  hashes: Record<string, string>,
  key: string
): Promise<void> {
  const [sourceHash, targetHash] = await Promise.all([sha256(source), sha256(target)]);
  if (sourceHash !== targetHash) throw new Error(`F5/Visual Studio 运行时依赖哈希不一致：${key}`);
  hashes[key] = targetHash;
}

async function sha256(filePath: string): Promise<string> {
  return crypto.createHash('sha256').update(await fs.readFile(filePath)).digest('hex');
}

async function listFbroProcesses(executableDirectory: string): Promise<RuntimeProcess[]> {
  const executablePath = path.join(executableDirectory, 'FBroSubprocess.exe').replace(/'/gu, "''");
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `@(Get-CimInstance Win32_Process -Filter "Name = 'FBroSubprocess.exe'" | Where-Object { $_.ExecutablePath -eq '${executablePath}' } | Select-Object ProcessId,CommandLine,ExecutablePath) | ConvertTo-Json -Compress`
  ], { windowsHide: true, timeout: 30_000 });
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  return Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
}

async function closeMainWindow(processId: number): Promise<void> {
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `$process = Get-Process -Id ${processId} -ErrorAction Stop; if (-not $process.CloseMainWindow()) { throw '主窗口拒绝正常关闭请求。' }`
  ], { windowsHide: true, timeout: 30_000 });
}

async function waitForExit(child: ReturnType<typeof spawn>, timeout: number): Promise<void> {
  if (child.exitCode !== null) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.off('exit', onExit);
      reject(new Error(`等待浏览器外壳正常退出超过 ${timeout}ms。`));
    }, timeout);
    const onExit = () => {
      clearTimeout(timer);
      resolve();
    };
    child.once('exit', onExit);
  });
}

async function forceStop(processId: number, executableDirectory: string): Promise<void> {
  const escapedDirectory = executableDirectory.replace(/'/gu, "''");
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `$children = @(Get-CimInstance Win32_Process -Filter "Name = 'FBroSubprocess.exe'" | Where-Object { $_.ExecutablePath -like '${escapedDirectory}\\*' }); Stop-Process -Id ${processId} -Force -ErrorAction SilentlyContinue; $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
  ], { windowsHide: true, timeout: 30_000 }).catch(() => undefined);
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
