/**
 * lingbuilder.threading 线程池并发数去上限（1～64 → ≥1 不设固定上限）真机验收：
 * 生成窗口工程 → MSBuild Win32+x64 Release → 运行 exe → exe 写 threading-pool-smoke.txt → 脚本逐行硬断言。
 * 覆盖：线程池_创建(256, 1000) 成功（旧 64 上限会拒绝）、取并发数=256、256 个提交任务全部完成、
 * 协作关闭+销毁成功、并发数 0 仍被拒绝且中文错误可读。
 * 运行：cd electron && npm run smoke:threading-pool
 */
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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'threading-pool-native-smoke');
const REPORT_NAME = 'threading-pool-smoke.txt';
const TASK_COUNT = 256;

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('threading pool 冒烟目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.threading')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'threading-pool-native-smoke',
    name: '线程池并发数去上限原生冒烟测试',
    windows: [{ id: 'main', fileName: 'MainWindow.xml', className: 'MainWindow', title: '线程池并发数去上限原生冒烟测试', width: 420, height: 240, background: '#202028', description: '线程池_创建 大并发/拒绝零并发/全量完成', controls: [] }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 线程池 大并发池',
    '        局部 线程原子整数 完成计数',
    '        局部 整数型 轮次',
    `        大并发池 = 线程池_创建(${TASK_COUNT}, 1000)`,
    '        完成计数 = 原子整数_创建(0)',
    `        计次循环首 (${TASK_COUNT}, 轮次)`,
    '            线程池_提交(大并发池, &池工作体, 完成计数)',
    '        计次循环尾 ()',
    '        局部 线程任务 探针任务',
    '        探针任务 = 线程池_提交(大并发池, &池工作体, 完成计数)',
    '        线程池_等待空闲(大并发池, 60000)',
    '        局部 整数型 等待数量',
    '        等待数量 = 线程池_取等待数量(大并发池)',
    '        局部 整数型 运行数量',
    '        运行数量 = 线程池_取运行数量(大并发池)',
    '        局部 线程任务状态 探针状态',
    '        探针状态 = 线程_取状态(探针任务)',
    '        局部 长整数型 已完成',
    '        已完成 = 原子整数_读取(完成计数)',
    '        局部 整数型 池并发',
    '        池并发 = 线程池_取并发数(大并发池)',
    '        局部 逻辑型 关闭成功',
    '        关闭成功 = 线程池_关闭(大并发池, 60000)',
    '        局部 逻辑型 销毁成功',
    '        销毁成功 = 线程池_销毁(大并发池)',
    '        局部 线程池 零并发池',
    '        零并发池 = 线程池_创建(0, 100)',
    '        @ const std::wstring 零并发错误(线程_取错误(0));',
    '        @ const std::wstring 探针错误(线程_取错误(探针任务));',
    `        @ std::remove("${REPORT_NAME}");`,
    `        @ { std::ofstream out("${REPORT_NAME}", std::ios::binary | std::ios::app);`,
    `        @   out << "pool256 " << (大并发池 != 0 ? 'E' : 'N') << ' ' << 大并发池 << ' ' << 池并发 << ' ' << 已完成 << ' ' << (关闭成功 ? 'E' : 'N') << (销毁成功 ? 'E' : 'N') << "\\n";`,
    `        @   out << "probe " << 探针状态 << ' ' << 探针任务 << ' ' << 等待数量 << ' ' << 运行数量 << ' ' << 探针错误.size() << "\\n";`,
    `        @   out << "zero " << (零并发池 == 0 ? 'E' : 'N') << ' ' << (零并发错误.find(L"大于 0") != std::wstring::npos ? 'E' : 'N') << "\\n";`,
    '        @   out << "final OK" << "\\n"; }',
    '        @ ExitProcess(0);',
    '    结束',
    '',
    '    空 池工作体(线程原子整数 计数器)',
    '        原子整数_增加(计数器, 1)',
    '    结束',
    '结束类'
  ].join('\n');

  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  for (const platform of ['Win32', 'x64'] as const) {
    try {
      await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 15 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    } catch (error) {
      const output = [error.stdout, error.stderr].filter(Boolean).join('\n');
      const failure = output.split('\n').filter(line => /error|错误/i.test(line)).slice(0, 30).join('\n');
      throw new Error(`${platform} MSBuild 失败：\n${failure || output.slice(-4000) || error.message}`);
    }
    const binDir = path.join(projectDir, platform, 'Release', 'bin');
    const executable = path.join(binDir, `${exported.projectName}.exe`);
    const run = await execFileAsync(executable, [], { cwd: binDir, windowsHide: true, timeout: 3 * 60 * 1000, maxBuffer: 1024 * 1024 }).then(() => ({}), error => ({ error }));
    const reportPath = path.join(binDir, REPORT_NAME);
    const report = await fs.readFile(reportPath, 'utf8').catch(() => '');
    if ('error' in run && !report.includes('OK')) throw new Error(`${platform} 运行未正常退出（exit=${(run.error as { code?: number }).code}）：\n${report}`);
    assertReport(platform, report);
    console.log(`[${platform}] threading-pool 原生冒烟 PASS`);
  }
  console.log(JSON.stringify({ ok: true, projectDir, platforms: ['Win32', 'x64'] }, null, 2));
}

function assertReport(platform: string, report: string): void {
  const lines = new Map(report.split('\n').filter(Boolean).map(line => [line.split(' ')[0] || '', line]));
  const poolLine = lines.get('pool256');
  if (!poolLine) throw new Error(`${platform} 报告缺少 pool256 行：\n${report}`);
  const [, poolFlag, , concText, doneText, closeDestroy = ''] = poolLine.split(' ');
  if (poolFlag !== 'E') throw new Error(`${platform} 线程池_创建(256, 1000) 应成功返回非 0 句柄：${poolLine}`);
  if (Number(concText) !== 256) throw new Error(`${platform} 线程池_取并发数 应为 256：${poolLine}`);
  if (Number(doneText) !== TASK_COUNT + 1) throw new Error(`${platform} 256 个提交任务加 1 个探针任务应全部完成，实际 ${doneText}：${poolLine}`);
  if (closeDestroy !== 'EE') throw new Error(`${platform} 线程池关闭/销毁应都成功：${poolLine}`);
  const zeroLine = lines.get('zero');
  if (!zeroLine || zeroLine.split(' ').slice(1).join(' ') !== 'E E') throw new Error(`${platform} 零并发应被拒绝且错误含「大于 0」：${zeroLine || '<缺失>'}`);
  const probeLine = lines.get('probe');
  if (!probeLine) throw new Error(`${platform} 报告缺少 probe 行：\n${report}`);
  const [, probeStatus, , probeWaiting, probeRunning, probeErrorSize] = probeLine.split(' ');
  if (Number(probeStatus) !== 2) throw new Error(`${platform} 探针任务应成功完成（状态 2）：${probeLine}`);
  if (Number(probeWaiting) !== 0 || Number(probeRunning) !== 0 || Number(probeErrorSize) !== 0) throw new Error(`${platform} 探针任务等待/运行/错误应全为 0：${probeLine}`);
  if (!lines.get('final')?.endsWith('OK')) throw new Error(`${platform} 报告缺少 final OK：\n${report}`);
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
