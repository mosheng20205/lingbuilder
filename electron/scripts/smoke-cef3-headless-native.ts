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
const projectId = 'cef3-headless-console-smoke';
const psProbe = path.join(repoRoot, '.lingbuilder-build', `${projectId}-window-probe.ps1`);
const pageFile = path.join(repoRoot, '.lingbuilder-build', `${projectId}-page.html`);
const firstPageFile = path.join(repoRoot, '.lingbuilder-build', `${projectId}-page-first.html`);

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
  '    局部 长整数型 帧数',
  '    帧数 = CEF3无头_取渲染帧数(1)',
  '    如果真 (帧数 < 1)',
  '      调试输出("OSR 未出帧")',
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
  'Add-Type -Namespace Win32 -Name Wnd -MemberDefinition @"',
  '[DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr l);',
  'public delegate bool EnumWindowsProc(IntPtr h, IntPtr l);',
  '[DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
  '[DllImport("user32.dll")] public static extern int GetWindowTextW(IntPtr h, System.Text.StringBuilder s, int n);',
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

async function findExecutable(): Promise<string> {
  const roots = [
    path.join(repoRoot, '.lingbuilder-build', projectId),
    path.join(repoRoot, '.lingbuilder-build', projectId, 'x64')
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

async function resetSmokeProject(keepForDebug: boolean): Promise<void> {
  if (keepForDebug) return;
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
    path.join(repoRoot, '.lingbuilder-build', projectId),
    pageFile,
    firstPageFile
  ]) {
    await fs.rm(target, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  staticSourceChecks();
  // 红线静态扫描不依赖真机构建，单独入口用于快速回归（不起 MSBuild）。
  if (process.argv.includes('--static-only')) {
    console.log(JSON.stringify({ ok: true, mode: 'static-only' }, null, 2));
    return;
  }
  // 冒烟可重复运行：上一轮遗留的同名项目会让 project.create 直接报「已存在」。
  await resetSmokeProject(false);
  await fs.mkdir(path.dirname(psProbe), { recursive: true });
  await fs.writeFile(psProbe, WINDOWS_PROBE, 'utf8');
  await fs.writeFile(pageFile, PAGE_HTML, 'utf8');
  await fs.writeFile(firstPageFile, FIRST_PAGE_HTML, 'utf8');

  const service = new AiBridgeService({
    workspaceRoot: repoRoot,
    host: '127.0.0.1',
    port: 0,
    token: 'cef3-headless-smoke-token',
    permission: 'yolo',
    allowRemote: false,
    enableMcp: false
  });
  let exitCode: number | null = null;
  let stdout = '';
  let windows: string[] = [];
  let executable = '';
  try {
    await service.createProject({
      name: 'CEF3 无头浏览器控制台冒烟',
      projectId,
      templateId: 'windows-console',
      enabledModuleIds: cef3ModuleIds(),
      approved: true
    });
    // 控制台模板自己就生成入口源码（类 程序 + 启动()）；再另建一个 .lcpp 会让类名和
    // 启动() 双份，构建诊断会直接拦下——所以覆写模板已有的那一个文件。
    const projectSourceDir = path.join(repoRoot, 'src', projectId);
    const lcppFiles = (await fs.readdir(projectSourceDir)).filter(name => name.toLowerCase().endsWith('.lcpp'));
    if (!lcppFiles.length) throw new Error(`控制台模板没有生成 .lcpp 源码：${projectSourceDir}`);
    await fs.writeFile(path.join(projectSourceDir, lcppFiles[0]), headlessSource(fileUrl(firstPageFile), fileUrl(pageFile)), 'utf8');
    for (const extra of lcppFiles.slice(1)) await fs.rm(path.join(projectSourceDir, extra), { force: true });

    const built = await service.buildRun({ projectId, run: false, approved: true } as never);
    if (built?.ok === false) {
      // 构建失败必须把编译器原话带回来：只报「stage: compile」等于让下一轮从零猜。
      const logs = Object.entries(built)
        .filter(([, value]) => typeof value === 'string' && /error|警告|C\d{4}|LNK\d{3,}/u.test(value as string))
        .map(([key, value]) => `${key}: ${value}`);
      throw new Error(`build.run 失败（stage=${(built as { stage?: string }).stage}）：\n${(logs.join('\n') || JSON.stringify(built)).slice(0, 12000)}`);
    }
    executable = await findExecutable();

    const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', chunk => { stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { stdout += chunk.toString(); });
    // 探针必须在运行期并行跑：等进程退出后再 EnumWindows 只会什么都抓不到。
    const probePromise = probeWindows(child.pid!);
    exitCode = await new Promise<number | null>(resolve => child.once('exit', code => resolve(code)));
    windows = await probePromise;
  } finally {
    await service.shutdown();
    await fs.rm(psProbe, { force: true });
  }

  const missing = MARKERS.filter(marker => !stdout.includes(marker));
  if (exitCode !== 0) throw new Error(`冒烟程序退出码 ${exitCode}：\n${stdout}`);
  if (missing.length) throw new Error(`冒烟输出缺少确认标记：${missing.join('、')}\n${stdout}`);
  if (windows.length) throw new Error(`无头运行期出现可见顶层窗口：${JSON.stringify(windows)}\n${stdout}`);
  // 全绿才清理；失败时保留项目与构建产物，便于直接复看生成的 main.cpp 与 exe。
  await resetSmokeProject(false);

  console.log(JSON.stringify({
    ok: true,
    executable,
    exitCode,
    checks: [...MARKERS, '无可见顶层窗口探针', '无头创建路径零 HWND 静态扫描', 'wmain 子进程守卫存在', '等待加载完成先等浏览器对象就绪', '创建后立刻导航经排队补发'],
    // 只回显中文调试输出：CEF 自己的 SSL/GPU 噪声会把断言证据挤出可见窗口。
    output: stdout.trim().split(/\r?\n/u).filter(line => line.includes('[调试输出]')).slice(0, 24)
  }, null, 2));
}

await main();
