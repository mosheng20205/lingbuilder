// 临时端到端验收：生成 datagrid-thread-demo 原生工程 → MSVC x64 编译 → 启动 exe →
// Win32 UI 自动化驱动「启动多线程任务 / 勾选前3行 / 删除勾选行」并断言标签文本。
// 验证目标：DataGrid 三条勾选批量命令在真机可用；工作线程进度经界面线程封送写入表格不崩溃。
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { createWindowsExecutableIconService } from '../src/services/windowDesigner/windowsExecutableIconService';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'datagrid-thread-demo');
const windowTitle = 'DataGrid 多线程读写与勾选批量删除示例';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

const automationPs1 = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class LBWin {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lparam);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc cb, IntPtr lparam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowTextW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassNameW(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr h, uint msg, IntPtr wp, IntPtr lp);
}
"@
$targetPid = __PID__
$script:main = [IntPtr]::Zero
$enumMain = [LBWin+EnumProc]{
  param($h, $l)
  $owner = [uint32]0
  [void][LBWin]::GetWindowThreadProcessId($h, [ref]$owner)
  if ($owner -eq $targetPid -and [LBWin]::IsWindowVisible($h)) {
    $t = New-Object System.Text.StringBuilder 512
    [void][LBWin]::GetWindowTextW($h, $t, 512)
    if ($t.ToString().Length -gt 0) { $script:main = $h; return $false }
  }
  return $true
}
[void][LBWin]::EnumWindows($enumMain, [IntPtr]::Zero)
if ($script:main -eq [IntPtr]::Zero) { throw '按进程 PID 找不到可见主窗口' }
function Get-Children {
  $list = New-Object System.Collections.ArrayList
  $cb = [LBWin+EnumProc]{
    param($h, $l)
    $t = New-Object System.Text.StringBuilder 512
    [void][LBWin]::GetWindowTextW($h, $t, 512)
    $c = New-Object System.Text.StringBuilder 256
    [void][LBWin]::GetClassNameW($h, $c, 256)
    [void]$list.Add(@{ H = $h; Text = $t.ToString(); Class = $c.ToString() })
    return $true
  }
  [void][LBWin]::EnumChildWindows($script:main, $cb, [IntPtr]::Zero)
  return $list
}
function Find-Button($text) {
  foreach ($c in (Get-Children)) { if ($c.Class -eq 'Button' -and $c.Text -eq $text) { return $c.H } }
  return [IntPtr]::Zero
}
function Get-LabelText {
  foreach ($c in (Get-Children)) { if ($c.Class -eq 'Static' -and $c.Text.StartsWith('状态：')) { return $c.Text } }
  return ''
}
function Wait-LabelContains($needle, $timeoutMs) {
  $deadline = [DateTime]::UtcNow.AddMilliseconds($timeoutMs)
  while ([DateTime]::UtcNow -lt $deadline) {
    $text = Get-LabelText
    if ($text.Contains($needle)) { return $text }
    Start-Sleep -Milliseconds 300
  }
  throw "等待超时，未在标签中找到「$needle」，当前：$(Get-LabelText)"
}
function Click-Button($text) {
  $h = Find-Button $text
  if ($h -eq [IntPtr]::Zero) { throw "找不到按钮：$text" }
  [void][LBWin]::SendMessageW($h, 0xF5, [IntPtr]::Zero, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 400
}
Start-Sleep -Milliseconds 800
Click-Button '启动多线程任务'
$done = Wait-LabelContains '全部完成' 60000
Click-Button '勾选前3行'
$checkText = ''
foreach ($c in (Get-Children)) { if ($c.Class -eq 'Static' -and $c.Text.StartsWith('勾选：')) { $checkText = $c.Text } }
if (-not $checkText.Contains('3')) { throw "勾选统计异常：$checkText" }
Click-Button '删除勾选行'
$deleted = Wait-LabelContains '已批量删除 3' 10000
if (-not $deleted.Contains('剩余 27')) { throw "删除后行数异常：$deleted" }
Start-Sleep -Milliseconds 800
$alive = Get-Process -Id $targetPid -ErrorAction SilentlyContinue
if (-not $alive -or $alive.HasExited) { throw '断言通过后主窗口进程已退出（疑似崩溃）' }
Write-Output ('PASS ' + $deleted)
`;

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('构建目录越出工作区。');
  const enabledModuleIds = JSON.parse(await fs.readFile(path.join(repoRoot, '.lingbuilder', 'projects', 'datagrid-thread-demo', 'project-modules.json'), 'utf8')).enabledModuleIds as string[];
  const enabledModules = enabledModuleIds.map(builtin);
  const project = JSON.parse(await fs.readFile(path.join(repoRoot, '.lingbuilder', 'projects', 'datagrid-thread-demo', 'window-designer.json'), 'utf8')) as LingWindowProject;
  const source = await fs.readFile(path.join(repoRoot, 'src', 'datagrid-thread-demo', 'MainWindow.lcpp'), 'utf8');
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(`生成阻断：\n${generated.blockingDiagnostics.join('\n')}`);

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const projectRef: LingBuilderSolutionProject = {
    id: 'datagrid-thread-demo', name: '数据表格多线程示例', type: 'visual-cpp',
    sourceRoot: 'src/datagrid-thread-demo', configRoot: 'config/datagrid-thread-demo',
    designerPath: '.lingbuilder/projects/datagrid-thread-demo/window-designer.json', isDefault: false, references: []
  };
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const copiedAssets = await createDesignerAssetService(repoRoot).copyProjectAssets(projectRef, [projectDir]);
  const contentFiles = copiedAssets.map(file => path.relative(projectDir, file).replace(/\\/gu, '/'));
  const designerAssets = createDesignerAssetService(repoRoot);
  await createWindowsExecutableIconService(repoRoot, designerAssets).materialize(projectRef, project.windows[0], [projectDir]);
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules, contentFiles });

  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const child = spawn(executable, [], { cwd: path.dirname(executable), stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 2500));
  if (child.exitCode !== null) throw new Error(`示例程序提前退出，代码 ${child.exitCode}。`);

  const ps1Path = path.join(projectDir, 'ui-automation.ps1');
  await fs.writeFile(ps1Path, '\uFEFF' + automationPs1.replace('__PID__', String(child.pid)), 'utf8');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps1Path], { timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  child.kill();
  console.log(JSON.stringify({ ok: true, executable, verdict: stdout.trim().slice(0, 400) }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
