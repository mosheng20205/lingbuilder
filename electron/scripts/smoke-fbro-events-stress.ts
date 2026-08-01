import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingControl, LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const eventBuildDirectory = path.join(repoRoot, '.lingbuilder-build', 'fbro-events-continuation-stress');
const authBuildDirectory = path.join(repoRoot, '.lingbuilder-build', 'fbro-events-auth-timeout-stress');
const closeBuildDirectory = path.join(repoRoot, '.lingbuilder-build', 'fbro-events-close-cleanup-stress');
const lifecycleBuildDirectory = path.join(repoRoot, '.lingbuilder-build', 'fbro-events-lifecycle-stress');
const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';

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

const enabledModules = [
  builtin('lingbuilder.win32.basic'),
  builtin('lingbuilder.threading'),
  builtin('lingbuilder.fbro.browser'),
  builtin('lingbuilder.fbro.events'),
  builtin('lingbuilder.fbro.automation'),
  builtin('lingbuilder.fbro.objects')
];

function browserControl(index: number, events: Record<string, string>): LingControl {
  const column = (index - 1) % 3;
  const row = Math.floor((index - 1) / 3);
  return {
    id: `fbro-stress-${index}`,
    type: 'FBroBrowser',
    name: `FBro浏览器${index}`,
    content: '',
    x: 12 + column * 250,
    y: 12 + row * 210,
    width: 235,
    height: 195,
    background: '#ffffff',
    foreground: '#000000',
    fontSize: 12,
    isEnabled: true,
    visibility: 'Visible',
    properties: {
      url: 'about:blank',
      cacheDir: `.fbro-global-cache/profile-event-stress-${index}`,
      enableJs: true,
      loadImages: true,
      enableWebGL: true,
      muteAudio: true,
      proxyMode: 'system',
      fingerprintProfile: ''
    },
    events
  };
}

function fullWindowBrowserControl(events: Record<string, string>): LingControl {
  return {
    ...browserControl(1, events),
    x: 0,
    y: 0,
    width: 760,
    height: 480
  };
}

async function buildNativeProject(
  buildDirectory: string,
  project: LingWindowProject,
  sourceCode: string
) {
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: sourceCode
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir: buildDirectory,
    projectId: project.id,
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
    timeout: 10 * 60_000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  return executable;
}

function quotePowerShellLiteral(value: string) {
  return `'${value.replace(/'/gu, "''")}'`;
}

async function runCapturedExecutable(
  executable: string,
  completionMarker: string,
  timeoutMilliseconds: number,
  minimumRuntimeMilliseconds: number
) {
  const stdoutPath = path.join(path.dirname(executable), '.fbro-stress.stdout.log');
  const stderrPath = path.join(path.dirname(executable), '.fbro-stress.stderr.log');
  const script = [
    `$executable=${quotePowerShellLiteral(executable)};`,
    `$stdoutPath=${quotePowerShellLiteral(stdoutPath)};`,
    `$stderrPath=${quotePowerShellLiteral(stderrPath)};`,
    'Remove-Item -LiteralPath $stdoutPath,$stderrPath -Force -ErrorAction SilentlyContinue;',
    '$started=[DateTime]::UtcNow;',
    '$process=Start-Process -FilePath $executable -WorkingDirectory (Split-Path $executable) -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru;',
    `$deadline=$started.AddMilliseconds(${timeoutMilliseconds});`,
    `$marker=${quotePowerShellLiteral(completionMarker)};`,
    '$found=$false;',
    'while([DateTime]::UtcNow -lt $deadline -and -not $process.HasExited){ Start-Sleep -Milliseconds 100; [string]$text=if(Test-Path -LiteralPath $stdoutPath){Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8}else{""}; if($text.Contains($marker)){$found=$true;break} };',
    'if(-not $found){ taskkill.exe /pid $process.Id /t /f 2>$null | Out-Null; [string]$text=if(Test-Path -LiteralPath $stdoutPath){Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8}else{""}; throw "等待标记超时：$marker`n$text" };',
    `$remaining=${minimumRuntimeMilliseconds}-([DateTime]::UtcNow-$started).TotalMilliseconds; if($remaining -gt 0){Start-Sleep -Milliseconds ([int]$remaining)};`,
    'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public static class LBStressClose { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }\';',
    '$process.Refresh(); if($process.MainWindowHandle -ne 0){[LBStressClose]::PostMessage($process.MainWindowHandle,0x0010,[IntPtr]::Zero,[IntPtr]::Zero)|Out-Null};',
    '$graceful=$process.WaitForExit(20000); if(-not $graceful){taskkill.exe /pid $process.Id /t /f 2>$null | Out-Null};',
    '[string]$stdout=if(Test-Path -LiteralPath $stdoutPath){Get-Content -LiteralPath $stdoutPath -Raw -Encoding UTF8}else{""};',
    '[string]$stderr=if(Test-Path -LiteralPath $stderrPath){Get-Content -LiteralPath $stderrPath -Raw -Encoding UTF8}else{""};',
    '$result=[pscustomobject]@{graceful=$graceful;elapsedMilliseconds=[int]([DateTime]::UtcNow-$started).TotalMilliseconds;stdoutBase64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($stdout));stderrBase64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($stderr))};',
    '$result|ConvertTo-Json -Compress'
  ].join(' ');
  const { stdout, stderr } = await execFileAsync('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-Command', script
  ], { windowsHide: true, timeout: timeoutMilliseconds + minimumRuntimeMilliseconds + 60_000,
    maxBuffer: 32 * 1024 * 1024 });
  if (!stdout.trim()) throw new Error(`FBro 压力启动器未返回结果。\n${stderr}`);
  const result = JSON.parse(stdout.trim()) as {
    graceful: boolean;
    elapsedMilliseconds: number;
    stdoutBase64: string;
    stderrBase64: string;
  };
  return {
    graceful: result.graceful,
    elapsedMilliseconds: result.elapsedMilliseconds,
    stdout: Buffer.from(result.stdoutBase64, 'base64').toString('utf8'),
    stderr: Buffer.from(result.stderrBase64, 'base64').toString('utf8')
  };
}

async function runContinuationStress() {
  const project: LingWindowProject = {
    id: 'fbro-events-continuation-stress',
    name: 'FBro 事件延续压力测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'FBro 事件延续压力测试',
      width: 760,
      height: 520,
      background: '#202124',
      description: '真实验证 v3 延续完成、取消、重复完成与事件风暴',
      controls: [fullWindowBrowserControl({ Created: 'FBro浏览器1_创建完成' })]
    }]
  };
  const sourceCode = [
    '类 MainWindow',
    '    事件 FBro浏览器1_创建完成()',
    '        调试输出("CREATED_HANDLER")',
    '        FBro_绑定事件(FBro浏览器1, "OnJSDialog", &完成延续测试)',
    '        FBro_绑定事件(FBro浏览器1, "OnConsoleMessage", &事件风暴处理)',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &初始加载完成)',
    '    结束',
    '    事件 FBro浏览器1_关闭完成()',
    '        调试输出("BROWSER_CLOSED_HANDLER")',
    '    结束',
    '    事件 初始加载完成()',
    '        局部 长整数型 主框架',
    '        调试输出("INITIAL_LOAD_HANDLER")',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &忽略后续加载)',
    '        主框架 = FBro框架_取主框架(FBro浏览器1)',
    '        FBro框架_执行JS(主框架, "for (let i = 0; i < 200; ++i) globalThis[\'console\'][\'log\'](\'LINGBUILDER_EVENT_STORM\'); alert(\'complete\')", "lingbuilder://event-stress", 1)',
    '        FBro对象_释放(主框架)',
    '    结束',
    '    事件 忽略后续加载()',
    '    结束',
    '    事件 事件风暴处理()',
    '        调试输出("EVENT_STORM_DELIVERED")',
    '    结束',
    '    事件 完成延续测试()',
    '        局部 长整数型 延续句柄',
    '        局部 整数型 首次结果',
    '        局部 整数型 重复结果',
    '        局部 长整数型 主框架',
    '        延续句柄 = FBro_取事件延续(FBro浏览器1)',
    '        首次结果 = FBro事件_完成延续(延续句柄, "{\\"action\\":1,\\"success\\":true}")',
    '        重复结果 = FBro事件_完成延续(延续句柄, "{\\"action\\":1}")',
    '        调试输出("CONTINUE_RESULTS", 首次结果, 重复结果)',
    '        FBro_绑定事件(FBro浏览器1, "OnJSDialog", &取消延续测试)',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &取消页面加载完成)',
    '        FBro_导航(FBro浏览器1, "data:text/html,<html><body>cancel-stage</body></html>")',
    '    结束',
    '    事件 取消页面加载完成()',
    '        局部 长整数型 主框架',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &忽略后续加载)',
    '        主框架 = FBro框架_取主框架(FBro浏览器1)',
    '        FBro框架_执行JS(主框架, "setTimeout(function(){alert(\'cancel\')}, 300)", "lingbuilder://event-stress", 1)',
    '        FBro对象_释放(主框架)',
    '    结束',
    '    事件 取消延续测试()',
    '        局部 长整数型 延续句柄',
    '        局部 整数型 首次结果',
    '        局部 整数型 重复结果',
    '        延续句柄 = FBro_取事件延续(FBro浏览器1)',
    '        首次结果 = FBro事件_取消延续(延续句柄)',
    '        重复结果 = FBro事件_取消延续(延续句柄)',
    '        调试输出("CANCEL_RESULTS", 首次结果, 重复结果)',
    '    结束',
    '结束类'
  ].join('\n');
  const executable = await buildNativeProject(eventBuildDirectory, project, sourceCode);
  const run = await runCapturedExecutable(executable, 'CANCEL_RESULTS', 45_000, 10_000);
  const stormCount = (run.stdout.match(/EVENT_STORM_DELIVERED/gu) || []).length;
  if (!/CONTINUE_RESULTS,\s*1,\s*-7/u.test(run.stdout)) throw new Error(`完成/重复完成结果错误。\n${run.stdout}`);
  if (!/CANCEL_RESULTS,\s*1,\s*-7/u.test(run.stdout)) throw new Error(`取消/重复取消结果错误。\n${run.stdout}`);
  if (stormCount < 100) throw new Error(`事件风暴投递不足：${stormCount}/100。\n${run.stdout}`);
  if (!run.graceful) throw new Error(`FBro 延续压力工程未能正常关闭。\n${run.stdout}\n${run.stderr}`);
  return { elapsedMilliseconds: run.elapsedMilliseconds, stormCount };
}

async function runDeferredTimeoutStress() {
  const project: LingWindowProject = {
    id: 'fbro-events-auth-timeout-stress',
    name: 'FBro 延迟决策超时测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow',
      title: 'FBro 延迟决策超时测试', width: 760, height: 520,
      background: '#202124', description: '真实验证资源请求延续 30 秒默认取消',
      controls: [fullWindowBrowserControl({
        Created: 'FBro浏览器1_创建完成',
        Closed: 'FBro浏览器1_关闭完成'
      })]
    }]
  };
  const sourceCode = [
    '类 MainWindow',
    '    事件 FBro浏览器1_创建完成()',
    '        调试输出("DEFERRED_CREATED")',
    '        FBro_绑定事件(FBro浏览器1, "OnBeforeResourceLoad", &延迟决策测试)',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &初始加载完成)',
    '    结束',
    '    事件 初始加载完成()',
    '        调试输出("DEFERRED_INITIAL_LOAD")',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &忽略后续加载)',
    '        FBro_导航(FBro浏览器1, "data:text/html,<html><body>deferred-timeout-stage</body></html>")',
    '    结束',
    '    事件 忽略后续加载()',
    '    结束',
    '    事件 延迟决策测试()',
    '        局部 长整数型 延续句柄',
    '        局部 整数型 超时后结果',
    '        延续句柄 = FBro_取事件延续(FBro浏览器1)',
    '        调试输出("DEFERRED_CONTINUATION", 延续句柄)',
    '        线程_休眠(36000)',
    '        超时后结果 = FBro事件_完成延续(延续句柄, "{\\"action\\":1}")',
    '        调试输出("TIMEOUT_RESULT", 超时后结果)',
    '    结束',
    '结束类'
  ].join('\n');
  const executable = await buildNativeProject(authBuildDirectory, project, sourceCode);
  const run = await runCapturedExecutable(executable, 'TIMEOUT_RESULT', 60_000, 10_000);
  if (!/DEFERRED_CONTINUATION,\s*[1-9]\d*/u.test(run.stdout)) throw new Error(`资源请求事件没有受管延续句柄。\n${run.stdout}`);
  if (!/TIMEOUT_RESULT,\s*-7/u.test(run.stdout)) throw new Error(`延迟决策超时结果错误。\n${run.stdout}`);
  if (!run.graceful) throw new Error(`FBro 延迟决策超时工程未能正常关闭。\n${run.stdout}\n${run.stderr}`);
  return run.elapsedMilliseconds;
}

async function runBrowserCloseContinuationStress() {
  const project: LingWindowProject = {
    id: 'fbro-events-close-cleanup-stress',
    name: 'FBro 浏览器关闭延续清理测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow',
      title: 'FBro 浏览器关闭延续清理测试', width: 760, height: 520,
      background: '#202124', description: '真实验证浏览器关闭立即取消未完成延续',
      controls: [fullWindowBrowserControl({
        Created: 'FBro浏览器1_创建完成',
        Closed: 'FBro浏览器1_关闭完成'
      })]
    }]
  };
  const sourceCode = [
    '类 MainWindow',
    '    事件 FBro浏览器1_创建完成()',
    '        FBro_绑定事件(FBro浏览器1, "OnJSDialog", &关闭清理测试)',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &初始加载完成)',
    '    结束',
    '    事件 FBro浏览器1_关闭完成()',
    '        调试输出("CLOSE_BROWSER_CLOSED")',
    '    结束',
    '    事件 初始加载完成()',
    '        局部 长整数型 主框架',
    '        FBro_绑定事件(FBro浏览器1, "OnLoadEnd", &忽略后续加载)',
    '        主框架 = FBro框架_取主框架(FBro浏览器1)',
    '        FBro框架_执行JS(主框架, "setTimeout(function(){alert(\'close\')}, 300)", "lingbuilder://event-stress", 1)',
    '        FBro对象_释放(主框架)',
    '    结束',
    '    事件 忽略后续加载()',
    '    结束',
    '    事件 关闭清理测试()',
    '        局部 长整数型 延续句柄',
    '        局部 整数型 关闭后结果',
    '        延续句柄 = FBro_取事件延续(FBro浏览器1)',
    '        FBro_关闭(FBro浏览器1)',
    '        关闭后结果 = FBro事件_完成延续(延续句柄, "{\\"action\\":1}")',
    '        调试输出("CLOSE_RESULT", 关闭后结果)',
    '    结束',
    '结束类'
  ].join('\n');
  const executable = await buildNativeProject(closeBuildDirectory, project, sourceCode);
  const run = await runCapturedExecutable(executable, 'CLOSE_BROWSER_CLOSED', 45_000, 10_000);
  if (!/CLOSE_RESULT,\s*-7/u.test(run.stdout)) throw new Error(`浏览器关闭清理延续结果错误。\n${run.stdout}`);
  if (!run.graceful) throw new Error(`FBro 浏览器关闭延续清理工程未能正常关闭。\n${run.stdout}\n${run.stderr}`);
  return run.elapsedMilliseconds;
}

async function runLifecycleStress() {
  const controls = Array.from({ length: 5 }, (_, offset) => {
    const index = offset + 1;
    return browserControl(index, {
      Created: `FBro浏览器${index}_创建完成`,
      Closed: `FBro浏览器${index}_关闭完成`
    });
  });
  const project: LingWindowProject = {
    id: 'fbro-events-lifecycle-stress',
    name: 'FBro 事件生命周期压力测试',
    windows: [{
      id: 'main-window',
      fileName: 'MainWindow.xml',
      className: 'MainWindow',
      title: 'FBro 事件生命周期压力测试',
      width: 790,
      height: 470,
      background: '#202124',
      description: '每轮创建并正常关闭五个真实 FBro 浏览器',
      controls
    }]
  };
  const sourceLines = ['类 MainWindow'];
  for (let index = 1; index <= 5; index += 1) {
    sourceLines.push(
      `    事件 FBro浏览器${index}_创建完成()`,
      `        调试输出("LIFECYCLE_CREATED_${index}")`,
      '    结束',
      `    事件 FBro浏览器${index}_关闭完成()`,
      `        调试输出("LIFECYCLE_CLOSED_${index}")`,
      '    结束'
    );
  }
  sourceLines.push('结束类');
  const executable = await buildNativeProject(lifecycleBuildDirectory, project, sourceLines.join('\n'));
  let gracefulRuns = 0;
  for (let runIndex = 1; runIndex <= 20; runIndex += 1) {
    let run: Awaited<ReturnType<typeof runCapturedExecutable>> | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        run = await runCapturedExecutable(executable, 'LIFECYCLE_CREATED_5', 20_000, 500);
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    if (!run) throw lastError;
    if (!run.graceful) throw new Error(`FBro 生命周期第 ${runIndex} 轮未能正常关闭。\n${run.stdout}\n${run.stderr}`);
    gracefulRuns += 1;
    for (let index = 1; index <= 5; index += 1) {
      if (!run.stdout.includes(`LIFECYCLE_CREATED_${index}`)) {
        throw new Error(`FBro 生命周期第 ${runIndex} 轮缺少浏览器 ${index} 的创建事件。\n${run.stdout}`);
      }
      if (!run.stdout.includes(`LIFECYCLE_CLOSED_${index}`)) {
        throw new Error(`FBro 生命周期第 ${runIndex} 轮缺少浏览器 ${index} 的关闭事件。\n${run.stdout}`);
      }
    }
  }
  return { gracefulRuns, createdAndClosedBrowsers: gracefulRuns * 5 };
}

async function main() {
  const selectedStage = process.env.LINGBUILDER_FBRO_STRESS_STAGE?.trim().toLowerCase() || 'all';
  console.log(`[FBro stress] stage=${selectedStage}`);
  const continuation = selectedStage === 'all' || selectedStage === 'continuation'
    ? await runContinuationStress()
    : { elapsedMilliseconds: 0, stormCount: 0 };
  console.log('[FBro stress] continuation complete');
  const deferredRuntimeMilliseconds = selectedStage === 'all' || selectedStage === 'auth'
    || selectedStage === 'deferred'
    ? await runDeferredTimeoutStress()
    : 0;
  console.log('[FBro stress] deferred timeout complete');
  const closeRuntimeMilliseconds = selectedStage === 'all' || selectedStage === 'close'
    ? await runBrowserCloseContinuationStress()
    : 0;
  console.log('[FBro stress] close complete');
  const lifecycle = selectedStage === 'all' || selectedStage === 'lifecycle'
    ? await runLifecycleStress()
    : { gracefulRuns: 0, createdAndClosedBrowsers: 0 };
  console.log('[FBro stress] lifecycle complete');
  console.log(JSON.stringify({
    ok: true,
    runtimeSeconds: Number((continuation.elapsedMilliseconds / 1000).toFixed(1)),
    deferredRuntimeSeconds: Number((deferredRuntimeMilliseconds / 1000).toFixed(1)),
    closeRuntimeSeconds: Number((closeRuntimeMilliseconds / 1000).toFixed(1)),
    eventStormDeliveries: continuation.stormCount,
    continuationCompleteAndRepeat: true,
    continuationCancelAndRepeat: true,
    continuationTimeout: true,
    continuationBrowserClose: true,
    lifecycleRuns: lifecycle.gracefulRuns,
    createdAndClosedBrowsers: lifecycle.createdAndClosedBrowsers
  }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
