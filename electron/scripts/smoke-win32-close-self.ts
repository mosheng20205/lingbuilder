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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'win32-close-self-smoke');

/** 2026-10-23 真机验收：窗口_关闭自身 登录切主窗口标准链（打开→关自身→剩一窗存活），MSVC 双编译 + 行为断言。 */
async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) {
    throw new Error('冒烟目录越出工作区。');
  }
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'win32-close-self-smoke',
    name: '关闭自身冒烟',
    startupWindowId: 'main-window',
    windows: [
      {
        id: 'main-window',
        fileName: 'MainWindow.xml',
        className: 'MainWindow',
        title: '登录窗口冒烟',
        width: 640,
        height: 480,
        background: '#1f2937',
        description: '启动窗口：创建完毕时打开主页窗口并关闭自身，验证程序不退出',
        controls: [
          { id: 'ctrl-status', type: 'Label', name: '状态标签', content: '登录窗口', x: 24, y: 24, width: 300, height: 24, fontSize: 12, background: 'transparent', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' }
        ]
      },
      {
        id: 'home-window',
        fileName: 'Window2.xml',
        className: 'HomeWindow',
        title: '主页窗口冒烟',
        width: 640,
        height: 480,
        background: '#0f172a',
        description: '主页窗口：验证登录窗口关闭后仍存活，并按句柄关闭弹窗',
        controls: [
          { id: 'ctrl-home-status', type: 'Label', name: '主页状态', content: '主页窗口', x: 24, y: 24, width: 400, height: 24, fontSize: 12, background: 'transparent', foreground: '#E2E8F0', isEnabled: true, visibility: 'Visible' }
        ]
      },
      {
        id: 'popup-window',
        fileName: 'Window3.xml',
        className: 'PopupWindow',
        title: '弹窗-按句柄关闭',
        width: 360,
        height: 240,
        background: '#312e81',
        description: '弹窗：被 窗口_按标题查找+窗口_关闭 关掉的靶子',
        controls: []
      }
    ]
  };
  const source = [
    '类 MainWindow',
    '    事件 创建完毕()',
    '        调试输出("登录窗口创建完毕：即将打开主页窗口并关闭自身")',
    '        打开窗口(HomeWindow)',
    '        窗口_关闭自身()',
    '    结束',
    '结束类',
    '',
    '类 HomeWindow : 公开 窗体',
    '    事件 _HomeWindow_创建完毕()',
    '        窗口_设置自身标题("主页窗口-登录窗口已关闭")',
    '        调试输出("主页窗口创建完毕，登录窗口应已关闭")',
    '        打开窗口(PopupWindow)',
    '        延迟调用(800, &_按句柄关闭弹窗)',
    '    结束',
    '    事件 _按句柄关闭弹窗()',
    '        局部 长整数型 弹窗句柄 = 窗口_按标题查找("弹窗-按句柄关闭")',
    '        调试输出("按标题查到弹窗句柄：", 弹窗句柄)',
    '        局部 逻辑型 关闭结果 = 窗口_关闭(弹窗句柄)',
    '        调试输出("窗口_关闭 返回：", 关闭结果)',
    '    结束',
    '结束类',
    '',
    '类 PopupWindow : 公开 窗体',
    '    事件 _PopupWindow_创建完毕()',
    '        调试输出("弹窗已打开，等待被按句柄关闭")',
    '    结束',
    '结束类'
  ].join('\n');
  const enabledModules: InstalledModule[] = ['lingbuilder.win32.basic', 'lingbuilder.win32.window-utils'].map(moduleId => {
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
  const runtimeHeader = generated.files.map(file => file.content).join('\n');
  const expectedSymbols = [
    'bool 窗口_关闭自身()',
    'PostMessageW(hwnd_, WM_CLOSE, 0, 0)',
    'bool 窗口_关闭(long long handle)',
    'PostMessageW(window, WM_CLOSE, 0, 0)'
  ];
  for (const symbol of expectedSymbols) {
    if (!runtimeHeader.includes(symbol)) throw new Error(`生成 C++ 缺少关闭自身运行时符号：${symbol}`);
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
      // 行为断言：登录窗口在创建完毕里关闭自身，若运行时误把「关一扇窗」当成「退出程序」
      // 进程会立刻退出；只有主页窗口存活并继续跑消息循环，进程才会持续存活。
      const child = spawn(executable, [], { stdio: 'ignore', windowsHide: true, detached: false });
      const alive = await new Promise<boolean>(resolve => {
        const timer = setTimeout(() => resolve(true), 4000);
        child.once('exit', code => { clearTimeout(timer); resolve(false); });
        child.once('error', () => { clearTimeout(timer); resolve(false); });
      });
      if (!alive) {
        throw new Error('x64 exe 在登录窗口关闭自身后退出：窗口计数语义被破坏（应为最后一窗才退出）。');
      }
      // 主页窗口标题应被改为「主页窗口-登录窗口已关闭」，证明主页窗口创建完毕事件已执行。
      // 探针脚本带 UTF-8 BOM 且强制 [Console]::OutputEncoding=UTF8：GBK 控制台下中文标题
      // 匹配必须走 stdout 编码声明，否则 node 侧收到的是 mojibake（首次验收踩坑）。
      const probeScript = path.join(projectDir, 'probe-windows.ps1');
      await fs.writeFile(probeScript, [
        '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
        'Add-Type -TypeDefinition \'using System; using System.Text; using System.Runtime.InteropServices; public class W { public delegate bool EnumCb(IntPtr hWnd, IntPtr lParam); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern bool EnumWindows(EnumCb cb, IntPtr lp); [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid); }\' -Language CSharp',
        '$targetPid = [uint32]$args[0]',
        '$found = $false',
        '$popupSeen = $false',
        '$cb = [W+EnumCb]{',
        '  param($h, $lp)',
        '  $wpid = [uint32]0',
        '  [W]::GetWindowThreadProcessId($h, [ref]$wpid) | Out-Null',
        '  if ($wpid -eq $targetPid -and [W]::IsWindowVisible($h)) {',
        '    $sb = New-Object System.Text.StringBuilder 256',
        '    [W]::GetWindowText($h, $sb, 256) | Out-Null',
        '    if ($sb.ToString() -eq [char]0x4E3B + [char]0x9875 + [char]0x7A97 + [char]0x53E3 + [char]0x2D + [char]0x767B + [char]0x5F55 + [char]0x7A97 + [char]0x53E3 + [char]0x5DF2 + [char]0x5173 + [char]0x95ED) { $script:found = $true }',
        '    if ($sb.ToString() -eq [char]0x5F39 + [char]0x7A97 + [char]0x2D + [char]0x6309 + [char]0x53E5 + [char]0x67C4 + [char]0x5173 + [char]0x95ED) { $script:popupSeen = $true }',
        '  }',
        '  return $true',
        '}',
        '[W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null',
        'if ($found) { \'TITLE-OK\' } else { \'TITLE-MISS\' }',
        'if ($popupSeen) { \'POPUP-STILL-OPEN\' } else { \'POPUP-CLOSED\' }'
      ].join('\n') + '\n', 'utf8');
      const probeOut = await execFileAsync('powershell.exe', [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', probeScript, String(child.pid)
      ], { windowsHide: true, timeout: 10000, encoding: 'utf8' });
      const exitCode = await new Promise<number>(resolve => {
        child.once('exit', (_code, signal) => resolve(signal ? -1 : 0));
        child.kill();
        setTimeout(() => resolve(-2), 5000);
      });
      if (!probeOut.stdout.includes('TITLE-OK')) {
        throw new Error(`主页窗口标题断言失败（TITLE-MISS）：登录窗口关闭后主页窗口未执行创建完毕事件。探测输出：${probeOut.stdout.trim()}`);
      }
      if (!probeOut.stdout.includes('POPUP-CLOSED')) {
        throw new Error(`弹窗断言失败（POPUP-STILL-OPEN）：窗口_按标题查找+窗口_关闭 未能关闭弹窗。探测输出：${probeOut.stdout.trim()}`);
      }
      console.log(`PASS x64 行为断言：登录窗口 窗口_关闭自身 后进程存活（主页窗口接管消息循环），主页窗口标题已改写，弹窗经 窗口_按标题查找+窗口_关闭 按句柄关闭`);
    }
  }
  console.log(JSON.stringify({ ok: true, projectDir, solution: exported.solutionPath }, null, 2));
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
  return msbuild;
}

main().catch(error => {
  console.error('FAIL', error instanceof Error ? error.message : error);
  process.exit(1);
});
