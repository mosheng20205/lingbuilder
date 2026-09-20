/**
 * CEF3 无头浏览器（官方 OSR）控制台项目真机端到端冒烟。
 *
 * 为什么走 AiBridgeService 而不是自己拼 MSBuild：只有真实构建链才会按模块 target 正确物化
 * CEF3 的 x64 桥资产；脚本里手搭 build 目录会把 modules/<id> 路径叠一层，链接必然失败（实测）。
 * 构建完成后由本脚本自己 spawn exe：这样才能在运行期用 EnumWindows 探针证明「无头实例没有任何
 * 可见顶层窗口」，并直接拿到控制台 stdout 做断言。
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

import { AiBridgeService } from '../src/services/aiBridge/aiBridgeService';
import { SolutionService } from '../src/services/solution/solutionService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const electronRoot = path.join(repoRoot, 'electron');
// 两个真机用例：控制台项目（代码显式创建）与窗口项目（设计器放置非可视组件、创建期自动启动）。
const consoleProjectId = 'cef3-headless-console-smoke';
const windowProjectId = 'cef3-headless-window-smoke';
const psProbe = path.join(repoRoot, '.lingbuilder-build', 'cef3-headless-window-probe.ps1');
const buildRoot = (projectId: string): string => path.join(repoRoot, '.lingbuilder-build', projectId);
const pageFileOf = (projectId: string): string => path.join(buildRoot(projectId), `${projectId}-page.html`);
const firstPageFileOf = (projectId: string): string => path.join(buildRoot(projectId), `${projectId}-page-first.html`);
const pageFile = pageFileOf(consoleProjectId);
const firstPageFile = firstPageFileOf(consoleProjectId);

const MARKERS = [
  '标题已取到', 'JS已取到', '源码已取到', '文本已取到', '帧数已确认',
  '视口已确认', '句柄已确认', 'OSR已生效', '事件已轮询', '导航已补发', '无头冒烟全部通过'
] as const;

// 冒烟页面刻意用本地文件而不是第三方站点：外部页面随时可能改版、变慢或被墙，
// 那会把「无头链路是否可用」测成网络可达性测试。本地页面内容固定，因此标题和
// DOM 断言都能取精确值（不再是「非空」这种弱断言）。
// 两个页面是为了验「创建后立刻导航」这条链：创建用 first 页，随后马上导航到 target 页；
// 只有排队导航被真正补发，读到的标题才是 target 页的标题（bridgeReady 被预置时这里会读到 first 页）。
const PAGE_TITLE = 'LingBuilderCef3Headless';
const PAGE_MARKER_TEXT = 'headless-osr-probe';
const FIRST_PAGE_TITLE = 'LingBuilderCef3HeadlessFirst';
const pageHtml = (title: string, marker: string): string => [
  '<!doctype html>',
  '<html><head><meta charset="utf-8">',
  `<title>${title}</title>`,
  '</head><body>',
  `<p id="probe">${marker}</p>`,
  '</body></html>',
  ''
].join('\n');
const PAGE_HTML = pageHtml(PAGE_TITLE, PAGE_MARKER_TEXT);
const FIRST_PAGE_HTML = pageHtml(FIRST_PAGE_TITLE, 'headless-osr-first');
// 一条表达式同时验标题和 DOM：返回固定数字，避免依赖执行JS 结果的 JSON 引号形态。
const PAGE_JS_PROBE = `document.title === '${PAGE_TITLE}' && document.getElementById('probe').textContent === '${PAGE_MARKER_TEXT}' ? 42 : 0`;

// 断言全部编进 .lcpp：任何一步不成立就用非 0 退出码结束并打印中文原因，
// 脚本侧只断言「退出码 0 + 全部标记 + 无可见顶层窗口」，不去解析数字。
function headlessSource(firstUrl: string, targetUrl: string): string {
  return [
  '包 无头冒烟',
  '',
  '类 程序',
  '公开',
  '  整数型 启动()',
  `    如果真 (CEF3_创建无头浏览器(1, "${firstUrl}", ".cef3/smoke-headless", "", 1024, 640) == 0)`,
  '      调试输出("创建无头浏览器失败")',
  '      返回 (11)',
  '    如果真结束',
  '    如果真 (CEF3无头_是否已创建(1) == 0)',
  '      调试输出("无头实例未登记")',
  '      返回 (12)',
  '    如果真结束',
  '    调试输出("事件创建后=" + CEF3无头_取事件JSON(1))',
  // 创建返回后立刻导航：此刻 CEF 侧多半还没建好浏览器，本次导航必须走排队补发。
  `    如果真 (CEF3无头_导航(1, "${targetUrl}") == 0)`,
  '      调试输出("创建后立刻导航被拒")',
  '      返回 (24)',
  '    如果真结束',
  '    如果真 (CEF3无头_等待加载完成(1, 25000) == 0)',
  '      调试输出("等待加载完成超时")',
  '      调试输出("事件=" + CEF3无头_取事件JSON(1))',
  '      返回 (13)',
  '    如果真结束',
  '    局部 文本型 标题',
  '    标题 = CEF3无头_取标题(1)',
  '    调试输出("标题观测=" + 标题)',
  `    如果真 (标题 != "${PAGE_TITLE}")`,
  '      调试输出("事件=" + CEF3无头_取事件JSON(1))',
  '      返回 (14)',
  '    如果真结束',
  '    调试输出("导航已补发")',
  '    调试输出("标题已取到")',
  '    局部 文本型 脚本结果',
  `    脚本结果 = CEF3无头_执行JS(1, "${PAGE_JS_PROBE}")`,
  '    调试输出("执行JS观测=" + 脚本结果)',
  '    如果真 (脚本结果 == "")',
  '      调试输出("事件=" + CEF3无头_取事件JSON(1))',
  '      返回 (15)',
  '    如果真结束',
  '    调试输出("JS已取到")',
  '    局部 文本型 页面源码',
  '    页面源码 = CEF3无头_取页面源码(1, 20000)',
  '    如果真 (页面源码 == "")',
  '      调试输出("取页面源码失败")',
  '      返回 (16)',
  '    如果真结束',
  '    调试输出("源码已取到")',
  '    局部 文本型 页面文本',
  '    页面文本 = CEF3无头_取页面文本(1, 20000)',
  '    调试输出("文本观测=" + 页面文本)',
  `    如果真 (页面文本 != "${PAGE_MARKER_TEXT}")`,
  '      调试输出("事件=" + CEF3无头_取事件JSON(1))',
  '      返回 (17)',
  '    如果真结束',
  '    调试输出("文本已取到")',
  // 加载完成 ≠ 已出帧：OSR 首帧更晚交付，必须带超时等（窗口用例实测首帧晚约半秒）。
  '    如果真 (CEF3无头_等待出帧(1, 8000) == 0)',
  '      调试输出("等待出帧超时")',
  '      调试输出("事件=" + CEF3无头_取事件JSON(1))',
  '      返回 (31)',
  '    如果真结束',
  '    局部 长整数型 帧数',
  '    帧数 = CEF3无头_取渲染帧数(1)',
  '    如果真 (帧数 < 1)',
  '      调试输出("等待出帧返回真但帧数为零")',
  '      返回 (18)',
  '    如果真结束',
  '    调试输出("帧数已确认")',
  '    局部 文本型 视口',
  '    视口 = CEF3无头_取视口JSON(1)',
  '    如果真 (视口 == "")',
  '      调试输出("取视口失败")',
  '      返回 (19)',
  '    如果真结束',
  '    调试输出("视口已确认")',
  '    局部 长整数型 浏览器句柄',
  '    浏览器句柄 = CEF3无头_取浏览器句柄(1)',
  '    如果真 (浏览器句柄 == 0)',
  '      调试输出("取浏览器句柄失败")',
  '      返回 (20)',
  '    如果真结束',
  '    局部 长整数型 主框架',
  '    主框架 = CEF3无头_取主框架(1)',
  '    如果真 (主框架 == 0)',
  '      调试输出("取主框架失败")',
  '      返回 (21)',
  '    如果真结束',
  '    调试输出("句柄已确认")',
  // OSR 官方接口首批（Task 10）：必须真链接、真回环，不能只是清单里的空壳。
  // 取帧率回读等于刚写入的值，才证明这条链真的走到 CefBrowserHost 而不是生成器桩。
  '    如果真 (CEF3离屏_订阅像素帧(浏览器句柄, 真) == 0)',
  '      调试输出("订阅像素帧失败")',
  '      返回 (25)',
  '    如果真结束',
  '    如果真 (CEF3离屏_订阅视图矩形(浏览器句柄, 真) == 0)',
  '      调试输出("订阅视图矩形失败")',
  '      返回 (26)',
  '    如果真结束',
  '    如果真 (CEF3OSR_设置窗口外帧率(浏览器句柄, 30) == 0)',
  '      调试输出("设置窗口外帧率失败")',
  '      返回 (27)',
  '    如果真结束',
  '    局部 整数型 帧率',
  '    帧率 = CEF3OSR_取窗口外帧率(浏览器句柄)',
  '    调试输出("OSR帧率观测=", 帧率)',
  '    如果真 (帧率 != 30)',
  '      调试输出("窗口外帧率回读不等于写入值")',
  '      返回 (28)',
  '    如果真结束',
  '    如果真 (CEF3OSR_请求重绘(浏览器句柄, 0) == 0)',
  '      调试输出("请求重绘失败")',
  '      返回 (29)',
  '    如果真结束',
  // 非法元素类型必须在生成期运行时被拒绝，不能透传给 CEF。
  '    如果真 (CEF3OSR_请求重绘(浏览器句柄, 7) != 0)',
  '      调试输出("非法元素类型未被拒绝")',
  '      返回 (30)',
  '    如果真结束',
  '    调试输出("OSR已生效")',
  '    局部 文本型 事件集',
  '    事件集 = CEF3无头_取事件JSON(1)',
  '    调试输出("事件已轮询")',
  // 探针是独立 PowerShell 进程、按 200ms 轮询；不留这段存活窗口，探针大部分时间只在
  // 「进程已退出」之后扫描，零可见窗口的证据就失去意义。窗口用例（用例二）是同一条探针的
  // 正向对照，两边合起来才证明探针真的能抓到窗口。
  '    @ Sleep(3000);',
  '    如果真 (CEF3无头_关闭(1) == 0)',
  '      调试输出("关闭无头实例失败")',
  '      返回 (22)',
  '    如果真结束',
  '    如果真 (CEF3无头_是否已创建(1) == 1)',
  '      调试输出("关闭后实例仍可解析")',
  '      返回 (23)',
  '    如果真结束',
  '    调试输出("无头冒烟全部通过")',
  '    返回 (0)',
  '  结束',
  '结束类',
  ''
  ].join('\n');
}

const WINDOWS_PROBE = [
  // 探针输出必须显式 UTF-8：PowerShell 默认按本机代码页（GBK）写 stdout，node 按 UTF-8 解码
  // 会得到乱码，窗口标题断言就永远判不过（真机实踩，窗口已经正确抓到）。
  '[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false',
  'Add-Type -Namespace Win32 -Name Wnd -MemberDefinition @"',
  '[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);',
  'public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);',
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
  // 必须显式声明 Unicode：默认 CharSet.Ansi 会把宽字符标题按 ANSI 截断，
  // 「CEF3无头窗口冒烟」只回一个 'C'，窗口标题断言会假失败（真机实测）。
  '[DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int n);',
  '"@',
  '$found = @()',
  '$procId = [uint32]$args[0]',
  'for ($i = 0; $i -lt 60; $i++) {',
  '  $cb = [Win32.Wnd+EnumWindowsProc]{',
  '    param($h, $l)',
  '    $p = [uint32]0',
  '    [void][Win32.Wnd]::GetWindowThreadProcessId($h, [ref]$p)',
  '    if ($p -eq $procId -and [Win32.Wnd]::IsWindowVisible($h)) {',
  '      $sb = New-Object System.Text.StringBuilder 260',
  '      [void][Win32.Wnd]::GetWindowTextW($h, $sb, 260)',
  '      $script:found += "$h|$($sb.ToString())"',
  '    }',
  '    return $true',
  '  }',
  '  [void][Win32.Wnd]::EnumWindows($cb, [IntPtr]::Zero)',
  '  if ($found.Count -gt 0) { break }',
  '  Start-Sleep -Milliseconds 200',
  '}',
  '$found | Sort-Object -Unique',
  ''
].join('\n');

function cef3ModuleIds(): string[] {
  return BUILTIN_MODULES.filter(manifest => manifest.id.startsWith('lingbuilder.cef3')).map(manifest => manifest.id);
}

// Chromium 认 file:///T:/… 这种形态；反斜杠必须换掉，否则 .lcpp 里的 \ 会被当成转义。
function fileUrl(absolutePath: string): string {
  return `file:///${absolutePath.replace(/\\/gu, '/')}`;
}

function staticSourceChecks(): void {
  // 静态断言：不经真机构建也要钉住「走官方 windowless、不借宿主窗口」这条红线。
  const manifest = BUILTIN_MODULES.find(item => item.id === 'lingbuilder.cef3.browser');
  if (!manifest) throw new Error('缺少 lingbuilder.cef3.browser 模块。');
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'cef3-headless-static-check',
    name: 'CEF3 无头静态检查',
    resources: [],
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '程序', title: '静态检查',
      width: 640, height: 420, background: '#1e1e1e', description: '',
      designerBackend: 'win32', controls: []
    }]
  };
  const installed: InstalledModule[] = cef3ModuleIds().map(id => {
    const found = BUILTIN_MODULES.find(item => item.id === id)!;
    return { manifest: found, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
  });
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: headlessSource(fileUrl(firstPageFile), fileUrl(pageFile)),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    outputKind: 'console-application',
    enabledModules: installed
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of ['int wmain(', 'lingbuilder_cef3_子进程守卫', 'LB_CEF3_BROWSER_WINDOWLESS', 'LB_CEF3_BrowserCreateWindowless', 'bridgeConfig.parent_window = 0;']) {
    if (!mainCpp.includes(required)) throw new Error(`生成的控制台 C++ 缺少：${required}`);
  }
  // 等待必须先看「浏览器对象是否已建好」再看加载中状态：只问 IsLoading 会把「还没创建」
  // 读成「加载完毕」，真机表现为创建后立刻取到空标题（本轮冒烟实测退出码 14 的根因）。
  const waitStart = mainCpp.indexOf('int CEF3无头_等待加载完成');
  const waitEnd = mainCpp.indexOf('std::wstring CEF3无头_取标题', Math.max(waitStart, 0));
  if (waitStart < 0 || waitEnd <= waitStart) throw new Error('未能切出无头等待加载完成函数体。');
  if (!mainCpp.slice(waitStart, waitEnd).includes('CEF3_浏览器对象已就绪(')) {
    throw new Error('CEF3无头_等待加载完成 未先等浏览器对象就绪。');
  }
  const start = mainCpp.indexOf('int CEF3_创建无头浏览器');
  const end = mainCpp.indexOf('int CEF3_创建弹窗浏览器');
  if (start < 0 || end <= start) throw new Error('未能切出无头创建函数体。');
  const body = mainCpp.slice(start, end);
  for (const banned of ['CreateWindowExW', 'RegisterClassExW', 'ShowWindow', 'SetWindowPos', 'hwnd_']) {
    if (body.includes(banned)) throw new Error(`无头创建路径出现被禁符号：${banned}`);
  }
}

async function findExecutable(projectId: string): Promise<string> {
  const roots = [
    buildRoot(projectId),
    path.join(buildRoot(projectId), 'x64')
  ];
  const candidates: string[] = [];
  for (const root of roots) {
    try {
      const walk = async (dir: string, depth: number): Promise<void> => {
        if (depth > 5) return;
        for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
          const target = path.join(dir, entry.name);
          if (entry.isDirectory()) { await walk(target, depth + 1); continue; }
          if (entry.name.toLowerCase().endsWith('.exe')) candidates.push(target);
        }
      };
      await walk(root, 0);
    } catch {
      // 目录不存在时继续找下一个根。
    }
  }
  if (!candidates.length) throw new Error(`构建产物里没有找到 exe（搜索根：${roots.join('、')}）。`);
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}

async function probeWindows(pid: number): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psProbe, String(pid)], {
      windowsHide: true, timeout: 40000
    });
    return stdout.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  } catch (error) {
    console.warn(`窗口探针执行失败：${String(error)}`);
    return [];
  }
}

/** 轮询已捕获的 stdout，直到出现某个标记；超时说明断言链卡在某一步，交由调用方回显全文。 */
async function waitForMarker(read: () => string, marker: string, timeoutMilliseconds: number): Promise<void> {
  const started = Date.now();
  while (!read().includes(marker)) {
    if (Date.now() - started > timeoutMilliseconds) throw new Error(`等待标记「${marker}」超过 ${timeoutMilliseconds} 毫秒。已观测：\n${read()}`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

async function resetSmokeProject(projectId: string, pageFiles: string[]): Promise<void> {
  // 失败的那一轮会把项目留在 .lingbuilder/solution.json 里，只删目录会让下一次
  // project.create 直接报「已存在同名项目」，所以先走解决方案的正规删除再补删目录。
  try {
    await new SolutionService(repoRoot).deleteProject(projectId, { deleteFiles: true });
  } catch {
    // 未登记时忽略，交给下面的目录清理。
  }
  for (const target of [
    path.join(repoRoot, 'src', projectId),
    path.join(repoRoot, 'config', projectId),
    path.join(repoRoot, '.lingbuilder', 'projects', projectId),
    buildRoot(projectId),
    ...pageFiles
  ]) {
    await fs.rm(target, { recursive: true, force: true });
  }
}

/** 构建失败必须把编译器原话带回来：只报「stage: compile」等于让下一轮从零猜。 */
async function buildProject(service: AiBridgeService, projectId: string): Promise<void> {
  const built = await service.buildRun({ projectId, run: false, approved: true } as never);
  if (built?.ok === false) {
    const logs = Object.entries(built)
      .filter(([, value]) => typeof value === 'string' && /error|警告|C\d{4}|LNK\d{3,}/u.test(value as string))
      .map(([key, value]) => `${key}: ${value}`);
    throw new Error(`build.run 失败（stage=${(built as { stage?: string }).stage}）：\n${(logs.join('\n') || JSON.stringify(built)).slice(0, 12000)}`);
  }
}

function buildService(): AiBridgeService {
  return new AiBridgeService({
    workspaceRoot: repoRoot,
    host: '127.0.0.1',
    port: 0,
    token: 'cef3-headless-smoke-token',
    permission: 'yolo',
    allowRemote: false,
    enableMcp: false
  });
}

async function writeSource(projectId: string, content: string, keepOnlyMainWindow: boolean): Promise<void> {
  const projectSourceDir = path.join(repoRoot, 'src', projectId);
  const lcppFiles = (await fs.readdir(projectSourceDir)).filter(name => name.toLowerCase().endsWith('.lcpp'));
  if (!lcppFiles.length) throw new Error(`模板没有生成 .lcpp 源码：${projectSourceDir}`);
  await fs.writeFile(path.join(projectSourceDir, lcppFiles[0]), content, 'utf8');
  if (keepOnlyMainWindow) {
    for (const extra of lcppFiles.slice(1)) await fs.rm(path.join(projectSourceDir, extra), { force: true });
  }
}

/**
 * 用例一：控制台项目。断言全部编在 .lcpp 里（失败即非 0 退出码），
 * 运行期并行用 EnumWindows 探针证明「零可见顶层窗口」。
 */
async function runConsoleCase(service: AiBridgeService): Promise<{ stdout: string; windows: string[]; exitCode: number | null }> {
  await resetSmokeProject(consoleProjectId, [pageFile, firstPageFile]);
  await fs.mkdir(path.dirname(pageFile), { recursive: true });
  await fs.writeFile(pageFile, PAGE_HTML, 'utf8');
  await fs.writeFile(firstPageFile, FIRST_PAGE_HTML, 'utf8');
  await service.createProject({
    name: 'CEF3 无头浏览器控制台冒烟',
    projectId: consoleProjectId,
    templateId: 'windows-console',
    enabledModuleIds: cef3ModuleIds(),
    approved: true
  });
  // 控制台模板自己就生成入口源码（类 程序 + 启动()）；再另建一个 .lcpp 会让类名和
  // 启动() 双份，构建诊断会直接拦下——所以覆写模板已有的那一个文件。
  await writeSource(consoleProjectId, headlessSource(fileUrl(firstPageFile), fileUrl(pageFile)), true);
  await buildProject(service, consoleProjectId);
  const executable = await findExecutable(consoleProjectId);
  let stdout = '';
  // windowsHide 会给子进程 STARTF_USESHOWWINDOW + SW_HIDE，被测程序自己的窗口因此以隐藏态启动，
  // EnumWindows 探针就永远什么都看不到——「零可见顶层窗口」会变成恒真假证据（真机实踩）。必须关。
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stdout += chunk.toString(); });
  // 探针必须在运行期并行跑：等进程退出后再 EnumWindows 只会什么都抓不到。
  const probePromise = probeWindows(child.pid!);
  const exitCode = await new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
  const windows = await probePromise;
  const missing = MARKERS.filter(marker => !stdout.includes(marker));
  if (exitCode !== 0) throw new Error(`控制台冒烟退出码 ${exitCode}：\n${stdout}`);
  if (missing.length) throw new Error(`控制台冒烟输出缺少确认标记：${missing.join('、')}\n${stdout}`);
  if (windows.length) throw new Error(`无头运行期出现可见顶层窗口：${JSON.stringify(windows)}\n${stdout}`);
  return { stdout, windows, exitCode };
}

// 用例二（窗口项目 + 设计器放置）的确认标记。窗口事件处理器是 void，失败没法用退出码分级，
// 因此约定：任何一步不成立就打印「窗口冒烟失败=…」并调用 结束() 让进程退出，脚本侧同时断言
// 「无失败标记 + 全部成功标记 + 5 秒后仍在运行」。
const WINDOW_MARKERS = [
  '窗口实例已自动创建', '窗口页面已加载', '窗口标题已取到', '窗口文本已取到',
  '窗口出帧已确认', '窗口视口已回显', '窗口控件已刷新', '无头窗口冒烟全部通过'
] as const;
const WINDOW_TITLE = 'CEF3无头窗口冒烟';
const windowPageFile = pageFileOf(windowProjectId);

/**
 * 窗口用例直接吃 examples/cef3-headless-demo 里那份 .lcpp —— 用户复制到工程里的源码，
 * 与本脚本在真机上编译运行的源码必须是同一份，否则「示例能跑」只是嘴上说说。
 * 页面地址不进源码：由设计器无头组件的「打开地址」给出（见 writeWindowedDesignerModel）。
 */
async function loadExampleSource(): Promise<string> {
  const sourcePath = path.join(repoRoot, 'examples', 'cef3-headless-demo', 'src', '\u65e0\u5934\u6293\u53d6\u793a\u4f8b.lcpp');
  const text = await fs.readFile(sourcePath, 'utf8');
  for (const required of ['CEF3\u65e0\u5934_\u7b49\u5f85\u51fa\u5e27', 'CEF3\u65e0\u5934_\u7b49\u5f85\u52a0\u8f7d\u5b8c\u6210', '\u65e0\u5934\u7a97\u53e3\u5192\u70df\u5168\u90e8\u901a\u8fc7']) {
    if (!text.includes(required)) throw new Error(`示例源码缺少 ${required}：${sourcePath}`);
  }
  return text;
}

/** 把设计器模型改写成「一个可见按钮 + 一个自动启动的无头组件」，其余字段沿用模板生成结果。 */
async function writeWindowedDesignerModel(url: string): Promise<void> {
  const modelPath = path.join(repoRoot, '.lingbuilder', 'projects', windowProjectId, 'window-designer.json');
  const model = JSON.parse(await fs.readFile(modelPath, 'utf8')) as LingWindowProject & {
    windows: Array<{ controls: Array<Record<string, unknown>>; title: string }>;
  };
  const window = model.windows[0];
  window.title = WINDOW_TITLE;
  window.controls.push({
    id: 'button-1', type: 'Button', name: '抓取按钮', content: '抓取',
    x: 24, y: 24, width: 220, height: 36, fontSize: 14,
    background: '#2d3748', foreground: '#ffffff', isEnabled: true, visibility: 'Visible',
    events: { Click: '_抓取按钮_被单击' }
  }, {
    id: 'result-label', type: 'Label', name: '结果标签', content: '等待抓取',
    x: 24, y: 76, width: 520, height: 28, fontSize: 13,
    background: 'transparent', foreground: '#4FC3F7', isEnabled: true, visibility: 'Visible'
  });
  model.resources = [{
    id: 'cef-headless-1', type: 'CefHeadlessBrowser', name: '无头抓取1',
    designerX: 260, designerY: 24, ownerWindowId: window.id, instanceId: 1,
    url, cacheDir: '.cef3/window-headless', proxyServer: '', viewWidth: 1024, viewHeight: 640, autoStart: true
  } as never];
  await fs.writeFile(modelPath, JSON.stringify(model, null, 2), 'utf8');
}

async function runWindowedCase(service: AiBridgeService): Promise<{ stdout: string; windows: string[]; viewport: string }> {
  await resetSmokeProject(windowProjectId, [windowPageFile]);
  await fs.mkdir(path.dirname(windowPageFile), { recursive: true });
  await fs.writeFile(windowPageFile, PAGE_HTML, 'utf8');
  await service.createProject({
    name: 'CEF3 无头浏览器窗口冒烟',
    projectId: windowProjectId,
    templateId: 'blank-window',
    enabledModuleIds: cef3ModuleIds(),
    approved: true
  });
  await writeWindowedDesignerModel(fileUrl(windowPageFile));
  await writeSource(windowProjectId, await loadExampleSource(), false);
  await buildProject(service, windowProjectId);
  const executable = await findExecutable(windowProjectId);

  // 同用例一：windowsHide 会把被测窗口自己藏掉，探针就失去正向对照能力。
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stdout += chunk.toString(); });
  const failFast = new Promise<never>((_, reject) => {
    child.once('exit', code => reject(new Error(`窗口冒烟进程提前退出（码 ${code}）：\n${stdout}`)));
  });
  // 收尾 kill 之后这条 promise 必然 reject；race 早已结束，这里只挂一个空处理器防止未捕获拒绝。
  failFast.catch(() => undefined);
  // 等最后一个成功标记出现（= 事件处理器已跑完并返回），再判存活与窗口数。
  await Promise.race([waitForMarker(() => stdout, '无头窗口冒烟全部通过', 90000), failFast]);
  // 存活红线：窗口项目必须像正常 GUI 一样继续运行（无头实例不得把进程带偏成一次性程序）。
  await new Promise(resolve => setTimeout(resolve, 5000));
  if (child.exitCode !== null) throw new Error(`窗口冒烟进程在 5 秒存活窗口内退出：\n${stdout}`);
  const windows = await probeWindows(child.pid!);
  child.kill();
  await new Promise(resolve => child.once('exit', () => resolve(undefined)));

  const failure = stdout.split(/\r?\n/u).find(line => line.includes('窗口冒烟失败='));
  if (failure) throw new Error(`窗口冒烟报告失败：${failure}\n${stdout}`);
  const missing = WINDOW_MARKERS.filter(marker => !stdout.includes(marker));
  if (missing.length) throw new Error(`窗口冒烟输出缺少确认标记：${missing.join('、')}\n${stdout}`);
  // 顶层窗口数必须等于设计器窗口数：无头实例绝不能带出一个隐窗或浏览器窗口。
  if (windows.length !== 1) throw new Error(`可见顶层窗口数应为 1（设计器窗口），实际 ${windows.length}：${JSON.stringify(windows)}`);
  if (!windows[0].includes(WINDOW_TITLE)) throw new Error(`顶层窗口标题不是设计器窗口：${windows[0]}`);
  const viewport = /窗口视口观测=(\{[^\r\n]*)/u.exec(stdout)?.[1] || '';
  // 设计器填的视口必须真的生效（桥在每次出帧时回写 CEF 实际渲染尺寸）。
  if (!/"width":1024/u.test(viewport) || !/"height":640/u.test(viewport)) {
    throw new Error(`设计器视口 1024x640 未生效，观测：${viewport || '(无)'}`);
  }
  // 示例源码本身只做「非空」判断（面向用户），精确等值由脚本侧把观测值钉死：
  // 读到的必须是本地固定页面的标题与正文，不能是 about:blank 或上一跳页面。
  const observedTitle = /窗口标题观测=([^\r\n]*)/u.exec(stdout)?.[1]?.trim() || '';
  const observedText = /窗口正文观测=([^\r\n]*)/u.exec(stdout)?.[1]?.trim() || '';
  if (observedTitle !== PAGE_TITLE) throw new Error(`窗口标题观测应为 ${PAGE_TITLE}，实际：${observedTitle || '(无)'}`);
  if (observedText !== PAGE_MARKER_TEXT) throw new Error(`窗口正文观测应为 ${PAGE_MARKER_TEXT}，实际：${observedText || '(无)'}`);
  return { stdout, windows, viewport };
}

async function main(): Promise<void> {
  staticSourceChecks();
  // 红线静态扫描不依赖真机构建，单独入口用于快速回归（不起 MSBuild）。
  if (process.argv.includes('--static-only')) {
    console.log(JSON.stringify({ ok: true, mode: 'static-only' }, null, 2));
    return;
  }
  await fs.mkdir(path.dirname(psProbe), { recursive: true });
  await fs.writeFile(psProbe, WINDOWS_PROBE, 'utf8');
  const service = buildService();
  let consoleResult: { stdout: string; windows: string[]; exitCode: number | null };
  let windowResult: { stdout: string; windows: string[]; viewport: string };
  let succeeded = false;
  try {
    consoleResult = await runConsoleCase(service);
    windowResult = await runWindowedCase(service);
    succeeded = true;
  } finally {
    await service.shutdown();
    await fs.rm(psProbe, { force: true });
    // 全绿才清理；失败时保留项目与构建产物，便于直接复看生成的 main.cpp 与 exe。
    if (succeeded) {
      await resetSmokeProject(consoleProjectId, [pageFile, firstPageFile]);
      await resetSmokeProject(windowProjectId, [windowPageFile]);
    }
  }

  console.log(JSON.stringify({
    ok: true,
    consoleCase: {
      exitCode: consoleResult.exitCode,
      checks: [...MARKERS, '无可见顶层窗口探针', '无头创建路径零 HWND 静态扫描', 'wmain 子进程守卫存在', '等待加载完成先等浏览器对象就绪', '创建后立刻导航经排队补发'],
      // 只回显中文调试输出：CEF 自己的 SSL/GPU 噪声会把断言证据挤出可见窗口。
      output: consoleResult.stdout.trim().split(/\r?\n/u).filter(line => line.includes('[调试输出]')).slice(0, 24)
    },
    windowCase: {
      checks: [...WINDOW_MARKERS, '窗口项目 5 秒后仍存活', '可见顶层窗口数等于设计器窗口数', '设计器视口 1024x640 生效'],
      observedTopLevelWindows: windowResult.windows,
      viewportObservation: windowResult.viewport,
      output: windowResult.stdout.trim().split(/\r?\n/u).filter(line => line.includes('[调试输出]')).slice(0, 24)
    }
  }, null, 2));
}

await main();
