import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'threading-native-smoke');
const stressMarker = '/*LINGBUILDER_THREADING_STRESS*/';

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('多线程 smoke 目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.threading')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'threading-native-smoke',
    name: '多线程模块原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '多线程模块原生烟雾测试',
      width: 480, height: 240, background: '#202028', description: '验证项目级受管并发运行时', controls: []
    }]
  };
  const source = [
    '类 MainWindow',
    '    线程池 测试池',
    '    线程互斥锁 测试锁',
    '    线程原子整数 原子计数',
    '    线程同步事件 完成事件',
    '    线程信号量 限流信号',
    '    整数型 共享计数 = 0',
    '    逻辑型 进度有效 = 假',
    '    整数型 进度次数 = 0',
    '    整数型 完成次数 = 0',
    '    事件 _MainWindow_创建完毕()',
    '        测试池 = 线程池_创建(4, 1000)',
    '        测试锁 = 互斥锁_创建()',
    '        原子计数 = 原子整数_创建(0)',
    '        完成事件 = 线程事件_创建(真, 假)',
    '        限流信号 = 信号量_创建(1, 2)',
    '        线程烟雾记录 输入',
    '        输入.数值 = 7',
    '        输入.标签 = "原始记录"',
    '        整数型 数组[]',
    '        @ 数组 = { 11, 13 };',
    '        线程任务 任务',
    '        任务 = 线程池_提交进度(测试池, &执行工作, &工作进度, &工作完成, 输入, 数组, "批次A")',
    '        输入.数值 = 99',
    '        @ 数组[0] = 99;',
    '    线程烟雾记录 执行工作(线程烟雾记录 输入, 整数型[] 数组, 文本型 批次)',
    '        线程_协作等待(30)',
    '        逻辑型 自等待结果 = 线程池_等待空闲(测试池, 0)',
    '        @ if (自等待结果) throw std::runtime_error("pool self wait was not rejected");',
    '        @ if (输入.数值 != 7 || 输入.标签 != L"原始记录" || std::size(数组) != 2 || 数组[0] != 11 || 批次 != L"批次A") throw std::runtime_error("deep copy failed");',
    '        互斥锁_执行(测试锁, &增加共享计数, 5)',
    '        原子整数_增加(原子计数, 3)',
    '        信号量_等待(限流信号, 1000)',
    '        信号量_释放(限流信号, 1)',
    '        线程事件_置位(完成事件)',
    '        @ for (int progress = 0; progress <= 100; ++progress) { 线程_报告进度(progress, L"后台工作完成"); Sleep(10); }',
    '        输入.数值 = 输入.数值 + 数组[1]',
    '        返回 输入',
    '    空 增加共享计数(整数型 数量)',
    '        逻辑型 重入结果 = 互斥锁_尝试执行(测试锁, 0, &空工作)',
    '        @ if (重入结果) throw std::runtime_error("recursive mutex entry was not rejected");',
    '        共享计数 = 共享计数 + 数量',
    '    空 空工作()',
    '        线程_协作等待(0)',
    '    空 等待事件工作(线程同步事件 事件)',
    '        线程事件_等待(事件, -1)',
    '    空 异常工作()',
    '        @ throw std::runtime_error("expected worker failure");',
    '    空 工作进度(线程任务 任务, 整数型 百分比, 文本型 说明)',
    '        进度次数 = 进度次数 + 1',
    '        @ 进度有效 = GetCurrentThreadId() == GetWindowThreadProcessId(hwnd_, nullptr) && 百分比 == 100 && 说明 == L"后台工作完成";',
    '    空 工作完成(线程任务 任务, 线程烟雾记录 结果)',
    '        线程同步事件 自动事件',
    '        线程池 边界池',
    '        线程同步事件 阻塞事件',
    '        线程任务 运行任务',
    '        线程任务 排队任务',
    '        线程任务 溢出任务',
    '        线程任务状态 运行前状态',
    '        逻辑型 运行取消请求',
    '        线程任务状态 运行请求状态',
    '        逻辑型 已请求取消',
    '        线程任务状态 请求取消状态',
    '        逻辑型 运行等待成功',
    '        逻辑型 取消等待成功',
    '        线程任务状态 运行最终状态',
    '        线程任务状态 最终取消状态',
    '        线程任务 首次任务编号',
    '        线程任务 后续任务',
    '        逻辑型 后续等待成功',
    '        线程任务 异常任务',
    '        逻辑型 异常等待成功',
    '        线程池 压力池',
    '        完成次数 = 完成次数 + 1',
    '        @ bool ok = GetCurrentThreadId() == GetWindowThreadProcessId(hwnd_, nullptr);',
    '        @ ok = ok && 进度有效 && 进度次数 > 0 && 进度次数 <= 20 && 完成次数 == 1 && 线程_取状态(任务) == 2 && 线程_取进度(任务) == 100;',
    '        @ ok = ok && 结果.数值 == 20 && 结果.标签 == L"原始记录" && 共享计数 == 5 && 原子整数_读取(原子计数) == 3;',
    '        @ ok = ok && 原子整数_比较交换(原子计数, 3, 9) && !原子整数_比较交换(原子计数, 3, 10) && 原子整数_读取(原子计数) == 9;',
    '        @ ok = ok && 线程事件_等待(完成事件, 0) && 线程事件_重置(完成事件) && !线程事件_等待(完成事件, 0);',
    '        自动事件 = 线程事件_创建(假, 真)',
    '        @ ok = ok && 线程事件_等待(自动事件, 0) && !线程事件_等待(自动事件, 0);',
    '        @ ok = ok && 信号量_取可用数量(限流信号) == 1 && 信号量_释放(限流信号, 1) && !信号量_释放(限流信号, 1) && 信号量_取可用数量(限流信号) == 2;',
    '        边界池 = 线程池_创建(1, 1)',
    '        阻塞事件 = 线程事件_创建(真, 假)',
    '        运行任务 = 线程池_提交(边界池, &等待事件工作, 阻塞事件)',
    '        @ for (int spin = 0; spin < 5000 && 线程_取状态(运行任务) != 1; ++spin) Sleep(1);',
    '        运行前状态 = 线程_取状态(运行任务)',
    '        运行取消请求 = 线程_请求取消(运行任务)',
    '        运行请求状态 = 线程_取状态(运行任务)',
    '        排队任务 = 线程池_提交(边界池, &空工作)',
    '        溢出任务 = 线程池_提交(边界池, &空工作)',
    '        已请求取消 = 线程_请求取消(排队任务)',
    '        请求取消状态 = 线程_取状态(排队任务)',
    '        线程事件_置位(阻塞事件)',
    '        运行等待成功 = 线程_等待(运行任务, 5000)',
    '        取消等待成功 = 线程_等待(排队任务, 5000)',
    '        运行最终状态 = 线程_取状态(运行任务)',
    '        最终取消状态 = 线程_取状态(排队任务)',
    '        首次任务编号 = 运行任务',
    '        线程_释放任务(运行任务)',
    '        线程_释放任务(排队任务)',
    '        后续任务 = 线程池_提交(边界池, &空工作)',
    '        后续等待成功 = 线程_等待(后续任务, 5000)',
    '        @ ok = ok && 运行前状态 == 1 && 运行取消请求 && 运行请求状态 == 4 && 运行最终状态 == 5;',
    '        @ ok = ok && 溢出任务 == 0 && 已请求取消 && 请求取消状态 == 4 && 运行等待成功 && 取消等待成功 && 最终取消状态 == 5;',
    '        @ ok = ok && 后续等待成功 && 后续任务 != 首次任务编号;',
    '        异常任务 = 线程池_提交(边界池, &异常工作)',
    '        异常等待成功 = 线程_等待(异常任务, 5000)',
    '        @ ok = ok && 异常等待成功 && 线程_取状态(异常任务) == 3 && !线程_取错误(异常任务).empty();',
    '        @ ok = ok && 线程_释放任务(后续任务) && 线程_释放任务(异常任务) && 线程池_关闭(边界池, 5000) && 线程池_销毁(边界池) && 线程事件_销毁(阻塞事件);',
    '        @ ok = ok && 线程池_关闭(测试池, 5000) && 线程池_销毁(测试池);',
    '        @ ok = ok && 互斥锁_销毁(测试锁) && 原子整数_销毁(原子计数) && 线程事件_销毁(完成事件) && 线程事件_销毁(自动事件) && 信号量_销毁(限流信号);',
    '        @ ok = ok && 线程_释放任务(任务);',
    '        压力池 = 线程池_创建(64, 100000)',
    `        @ ${stressMarker}`,
    '        @ FILE* report = nullptr;',
    '        @ fopen_s(&report, "threading-native-smoke.txt", "wb");',
    '        @ if (report) { fprintf(report, "%s\\n", ok ? "OK" : "FAIL"); fclose(report); }',
    '        @ DestroyWindow(hwnd_);',
    '        @ if (!ok) PostQuitMessage(2);',
    '结束类'
  ].join('\n');
  const projectTypes = [
    '数据类型 线程烟雾记录',
    '    整数型 数值',
    '    文本型 标签',
    '结束数据类型'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSources: [
      { filePath: 'src/MainWindow.lcpp', sourceCode: source },
      { filePath: 'src/项目数据类型.lcpp', sourceCode: projectTypes }
    ],
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const stressCpp = [
    '{',
    '    bool stressOk = 压力池 != 0 && 线程池_取并发数(压力池) == 64 && 线程池_创建(65, 1) == 0;',
    '    auto& threadRuntime = LingThreadProjectRuntime::Instance();',
    '    const DWORD uiThreadId = GetCurrentThreadId();',
    '    const long long callbackOwner = threadRuntime.RegisterOwner([](long long) {});',
    '    std::atomic<int> completionCalls { 0 };',
    '    std::atomic<int> validCompletions { 0 };',
    '    long long successTask = 0;',
    '    long long failedTask = 0;',
    '    long long cancelledTask = 0;',
    '    successTask = threadRuntime.SubmitComplete(callbackOwner, 压力池, []() -> int { return 7; }, [&](long long id, int result) {',
    '        ++completionCalls;',
    '        if (GetCurrentThreadId() == uiThreadId && id == successTask && result == 7) ++validCompletions;',
    '    });',
    '    failedTask = threadRuntime.SubmitComplete(callbackOwner, 压力池, []() -> int { throw std::runtime_error("expected completion failure"); }, [&](long long id, int result) {',
    '        ++completionCalls;',
    '        if (GetCurrentThreadId() == uiThreadId && id == failedTask && threadRuntime.Status(id) == 3 && result == 0) ++validCompletions;',
    '    });',
    '    cancelledTask = threadRuntime.SubmitComplete(callbackOwner, 压力池, [&threadRuntime]() -> int { while (threadRuntime.CooperativeWait(1)) {} return 99; }, [&](long long id, int result) {',
    '        ++completionCalls;',
    '        if (GetCurrentThreadId() == uiThreadId && id == cancelledTask && threadRuntime.Status(id) == 5 && result == 0) ++validCompletions;',
    '    });',
    '    for (int spin = 0; spin < 5000 && threadRuntime.Status(cancelledTask) != 1; ++spin) Sleep(1);',
    '    stressOk = stressOk && threadRuntime.RequestCancel(cancelledTask)',
    '        && threadRuntime.WaitAll(std::vector<long long> { successTask, failedTask, cancelledTask }, 5000);',
    '    stressOk = stressOk && threadRuntime.Status(successTask) == 2 && threadRuntime.ReleaseTask(successTask);',
    '    threadRuntime.DrainOwnerCallbacks(callbackOwner);',
    '    stressOk = stressOk && completionCalls.load() == 3 && validCompletions.load() == 3;',
    '    threadRuntime.ShutdownOwner(callbackOwner);',
    '    stressOk = stressOk && threadRuntime.ReleaseTask(failedTask) && threadRuntime.ReleaseTask(cancelledTask);',
    '    const long long closingOwner = threadRuntime.RegisterOwner([](long long) {});',
    '    const long long survivingOwner = threadRuntime.RegisterOwner([](long long) {});',
    '    long long closingTask = threadRuntime.Submit(closingOwner, 压力池, [&threadRuntime]() { while (threadRuntime.CooperativeWait(1)) {} });',
    '    for (int spin = 0; spin < 5000 && threadRuntime.Status(closingTask) != 1; ++spin) Sleep(1);',
    '    long long survivingTask = threadRuntime.Submit(survivingOwner, 压力池, []() {});',
    '    threadRuntime.ShutdownOwner(closingOwner);',
    '    stressOk = stressOk && threadRuntime.Status(closingTask) == 5 && threadRuntime.Wait(survivingTask, 5000) && threadRuntime.Status(survivingTask) == 2;',
    '    threadRuntime.ShutdownOwner(survivingOwner);',
    '    stressOk = stressOk && threadRuntime.ReleaseTask(closingTask) && threadRuntime.ReleaseTask(survivingTask);',
    '    std::vector<long long> stressTasks;',
    '    stressTasks.reserve(100000);',
    '    for (int index = 0; index < 100000 && stressOk; ++index) {',
    '        long long id = this->线程池_提交(压力池, [this]() { this->空工作(); });',
    '        stressOk = id != 0;',
    '        if (id != 0) stressTasks.push_back(id);',
    '    }',
    '    long long activeLimitOverflow = stressOk ? this->线程池_提交(压力池, [this]() { this->空工作(); }) : -1;',
    '    stressOk = stressOk && stressTasks.size() == 100000 && activeLimitOverflow == 0',
    '        && LingThreadProjectRuntime::Instance().WaitAll(stressTasks, 60000);',
    '    stressOk = stressOk && this->线程_清理已完成() == 100000;',
    '    std::vector<long long> extraPools;',
    '    for (int index = 0; index < 15 && stressOk; ++index) {',
    '        long long pool = this->线程池_创建(1, 1);',
    '        stressOk = pool != 0;',
    '        if (pool != 0) extraPools.push_back(pool);',
    '    }',
    '    long long customPoolOverflow = stressOk ? this->线程池_创建(1, 1) : -1;',
    '    stressOk = stressOk && customPoolOverflow == 0;',
    '    for (long long pool : extraPools) stressOk = this->线程池_关闭(pool, 5000) && this->线程池_销毁(pool) && stressOk;',
    '    stressOk = this->线程池_关闭(压力池, 5000) && this->线程池_销毁(压力池) && stressOk;',
    '    ok = ok && stressOk;',
    '}'
  ].join('\n');
  const generatedFiles = generated.files.map(file => file.relativePath === 'main.cpp'
    ? { ...file, content: file.content.replace(stressMarker, stressCpp) }
    : file);
  if (generatedFiles.find(file => file.relativePath === 'main.cpp')?.content.includes(stressMarker)) {
    throw new Error('多线程压力测试标记未替换。');
  }

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generatedFiles) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  const results: string[] = [];
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const executable = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    const executableDir = path.dirname(executable);
    await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
    const result = (await fs.readFile(path.join(executableDir, 'threading-native-smoke.txt'), 'utf8')).trim();
    if (result !== 'OK') throw new Error(`${platform} 多线程原生验证失败：${result}`);
    results.push(platform);
  }
  console.log(JSON.stringify({ ok: true, projectDir, platforms: results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
