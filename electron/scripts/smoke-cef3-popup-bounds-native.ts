import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'cef3-popup-bounds-smoke');

/** 2026-10-29 真机验收：CEF3 谷歌原生UI弹窗位置/尺寸控制。
 *  6 个 Chrome Runtime 顶层弹窗按 3×2 物理像素网格创建（创建时带 左/顶/宽/高），
 *  实例 1 再用 CEF3_置实例窗口边界 事后搬移，DPI-aware Win32 探针逐窗断言
 *  GetWindowRect 与请求矩形一致（尺寸高于 Chrome 最小窗宽，不吃钳制）。 */

interface ExpectedRect { x: number; y: number; width: number; height: number }

const POPUP_WIDTH = 1100;
const POPUP_HEIGHT = 900;
const GRID_ORIGIN_X = 60;
const GRID_ORIGIN_Y = 60;
const GRID_STEP_X = 1160;
const GRID_STEP_Y = 960;

function expectedRects(): ExpectedRect[] {
  const rects: ExpectedRect[] = [];
  for (let instance = 1; instance <= 6; instance++) {
    const column = (instance - 1) % 3;
    const row = Math.floor((instance - 1) / 3);
    rects.push({
      x: GRID_ORIGIN_X + column * GRID_STEP_X,
      y: GRID_ORIGIN_Y + row * GRID_STEP_Y,
      width: POPUP_WIDTH,
      height: POPUP_HEIGHT
    });
  }
  // 实例 1 事后搬到独立空位（不与网格格位重合），验证创建后摆位命令真实生效。
  rects[0] = { x: 1500, y: 1100, width: POPUP_WIDTH, height: POPUP_HEIGHT };
  return rects;
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('CEF3 弹窗冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'cef3-popup-bounds-smoke',
    name: 'CEF3弹窗边界冒烟',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'CEF3弹窗边界冒烟',
      width: 420,
      height: 240,
      background: '#1f2937',
      description: '验证 CEF3_创建弹窗浏览器 尾部边界参数与 CEF3_置实例窗口边界 的真机落位',
      controls: []
    }]
  };
  const creationLines: string[] = [];
  for (let instance = 1; instance <= 6; instance++) {
    const column = (instance - 1) % 3;
    const row = Math.floor((instance - 1) / 3);
    creationLines.push(
      `        CEF3_创建弹窗浏览器(${instance}, "about:blank", ".cef3-smoke/store-${instance}", "", `
      + `${GRID_ORIGIN_X + column * GRID_STEP_X}, ${GRID_ORIGIN_Y + row * GRID_STEP_Y}, ${POPUP_WIDTH}, ${POPUP_HEIGHT})`);
  }
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    ...creationLines,
    `        CEF3_置实例窗口边界(1, 1500, 1100, ${POPUP_WIDTH}, ${POPUP_HEIGHT})`,
    '        调试输出(CEF3_取实例窗口边界JSON(1))',
    '        调试输出(CEF3_取实例窗口句柄(1))',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.cef3.browser'].map(moduleId => {
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
  const generatedText = generated.files.map(file => file.content).join('\n');
  for (const symbol of [
    'LB_CEF3_BrowserSetWindowBounds(handle, left, top, width, height)',
    'int CEF3_置实例窗口边界(int instanceId',
    'std::wstring CEF3_取实例窗口边界JSON(int instanceId',
    'long long CEF3_取实例窗口句柄(int instanceId'
  ]) {
    if (!generatedText.includes(symbol)) throw new Error(`生成 C++ 缺少弹窗边界运行时符号：${symbol}`);
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
  // CEF3 桥是原生依赖：编译前必须物化（头/lib 进 include、lib 目录，DLL 进 exe 旁），
  // 物化自带 ABI 门槛——旧 SDK 在这里就被中文阻断，不会流到链接末端报找不到标识符。
  const binDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const materialized = await materializeModuleNativeDependencies([enabledModules[0]], {
    buildDir: binDir,
    sourceDir: projectDir,
    binDir,
    exportDir: projectDir,
    preferredTargetId: 'windows-msvc-x64'
  });
  if (materialized.blockingDiagnostics.length) {
    throw new Error(materialized.blockingDiagnostics.join('\n'));
  }
  // 导出器对含斜杠的 targets.libs 条目会再包一层 modules/<id>/，vcxproj 期望的是
  // 双层路径；物化产物补拷一份到该位置（仅本冒烟工程自适配，不改共享导出约定）。
  const doubledLibDir = path.join(projectDir, 'modules', 'lingbuilder.cef3.browser', 'modules', 'lingbuilder.cef3.browser', 'lib', 'x64');
  await fs.mkdir(doubledLibDir, { recursive: true });
  const materializedLib = materialized.libFiles.find(file => file.endsWith('LingBuilderCefBridge.lib'));
  if (!materializedLib) throw new Error('物化结果缺少 LingBuilderCefBridge.lib。');
  await fs.copyFile(materializedLib, path.join(doubledLibDir, 'LingBuilderCefBridge.lib'));
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = await findMsbuild();
  await execFileAsync(msbuild, [
    exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release',
    '/p:Platform=x64', '/v:minimal'
  ], {
    cwd: projectDir,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(`PASS MSVC x64 编译：${executable}`);

  const child = spawn(executable, [], { stdio: 'ignore', windowsHide: false, detached: false });
  try {
    const rects = await waitForPopupRects(child.pid ?? 0, expectedRects());
    console.log(`PASS 6 个 Chrome Runtime 顶层弹窗落位与请求矩形一致：${JSON.stringify(rects)}`);
  } finally {
    if (child.pid) {
      try { process.kill(child.pid); } catch { /* 已退出 */ }
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
}

async function waitForPopupRects(pid: number, expected: ExpectedRect[]): Promise<ExpectedRect[]> {
  const deadline = Date.now() + 30000;
  let lastJson = '[]';
  while (Date.now() < deadline) {
    lastJson = await probePopupRects(pid);
    let parsed: ExpectedRect[] = [];
    try { parsed = JSON.parse(lastJson) as ExpectedRect[]; } catch { parsed = []; }
    if (parsed.length === expected.length) {
      const remaining = expected.map(item => ({ ...item }));
      let allMatched = true;
      for (const actual of parsed) {
        const index = remaining.findIndex(item =>
          Math.abs(item.x - actual.x) <= 1 && Math.abs(item.y - actual.y) <= 1
          && Math.abs(item.width - actual.width) <= 1 && Math.abs(item.height - actual.height) <= 1);
        if (index < 0) { allMatched = false; break; }
        remaining.splice(index, 1);
      }
      if (allMatched) return parsed;
    }
    await sleep(500);
  }
  throw new Error(`30 秒内弹窗落位未匹配：期望 ${JSON.stringify(expected)}，实际 ${lastJson}`);
}

async function probePopupRects(pid: number): Promise<string> {
  // DPI-aware（PerMonitorV2）探针：GetWindowRect 返回真实物理像素，与弹窗命令口径一致。
  // 整个枚举在 C# 内完成（PS 委托回调的脚本作用域在子进程管道下不可靠，会静默丢命中），
  // 直接输出命中矩形 JSON，不经 PS 回调。
  const script = [
    'Add-Type -TypeDefinition @"',
    'using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;',
    'public class PopupProbe {',
    '  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value);',
    '  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr lParam);',
    '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);',
    '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out RECT rect);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder text, int count);',
    '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);',
    '  [DllImport("user32.dll")] public static extern IntPtr GetParent(IntPtr window);',
    '  public delegate bool EnumProc(IntPtr window, IntPtr lParam);',
    '  public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }',
    '  public static string Probe(uint targetPid) {',
    '    SetProcessDpiAwarenessContext((IntPtr)(-4));',
    '    var hits = new List<string>();',
    '    EnumWindows(delegate(IntPtr window, IntPtr lParam) {',
    '      uint windowPid; GetWindowThreadProcessId(window, out windowPid);',
    '      if (windowPid == targetPid && IsWindowVisible(window) && GetParent(window) == IntPtr.Zero) {',
    '        var className = new StringBuilder(256);',
    '        GetClassName(window, className, 256);',
    '        if (className.ToString().StartsWith("Chrome_WidgetWin_1", StringComparison.Ordinal)) {',
    '          RECT rect;',
    '          if (GetWindowRect(window, out rect)) {',
    '            hits.Add("{\\"x\\":" + rect.Left + ",\\"y\\":" + rect.Top + ",\\"width\\":" + (rect.Right - rect.Left) + ",\\"height\\":" + (rect.Bottom - rect.Top) + "}");',
    '          }',
    '        }',
    '      }',
    '      return true;',
    '    }, IntPtr.Zero);',
    '    return "[" + string.Join(",", hits) + "]";',
    '  }',
    '}',
    '"@',
    `[void][PopupProbe]::Probe(${pid})`,
    `[PopupProbe]::Probe(${pid}) | Write-Output`
  ].join('\r\n');
  const scriptPath = path.join(projectDir, 'probe-popups.ps1');
  await fs.writeFile(scriptPath, script, 'utf8');
  const result = await execFileAsync('powershell', [
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath
  ], { windowsHide: true, timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
  return result.stdout.trim().split(/\r?\n/u).pop()?.trim() || '[]';
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
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
