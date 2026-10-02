/**
 * 连续赋值语句原生冒烟：生成控制台工程 → MSVC 编译 → 运行 → 断言输出。
 *
 * 覆盖三条红线：① 标量/数组元素一值多目标展开；② 值只求值一次（用程序集变量
 * 计数器证明含调用的值不会被每个目标重复执行）；③ 数组元素单行赋值 a[i] = x。
 * 用法：cd electron && npx tsx scripts/smoke-consecutive-assignment.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'consecutive-assignment-smoke');

const project: LingWindowProject = {
  schemaVersion: 2,
  id: 'consecutive-assignment-smoke',
  name: '连续赋值原生冒烟',
  windows: [{
    id: 'main-window',
    fileName: 'MainWindow.xml',
    className: '程序',
    title: '连续赋值原生冒烟',
    width: 360,
    height: 180,
    background: '#202028',
    description: '验证连续赋值语句与数组元素赋值可由 MSVC 编译并正确运行',
    controls: []
  }]
};

const source = [
  '包 控制台程序',
  '',
  '类 程序',
  '    整数型 调用计数 = 0',
  '公开',
  '  整数型 启动()',
  '    局部 整数型 人数',
  '    局部 整数型 轮询次数',
  '    局部 文本型 名单[]',
  '    数组_重定义(名单, 3)',
  '    连续赋值(0, 人数, 轮询次数)',
  '    连续赋值("", 名单[1], 名单[2])',
  '    连续赋值(取起始序号(), 人数, 轮询次数)',
  '    名单[1] = "已重置"',
  '    调试输出("人数=" + 到文本(人数))',
  '    调试输出("轮询=" + 到文本(轮询次数))',
  '    调试输出("求值=" + 到文本(调用计数))',
  '    调试输出("名单1=" + 名单[1])',
  '    调试输出("名单2=" + 名单[2])',
  '    返回 (0)',
  '  结束',
  '',
  '  整数型 取起始序号()',
  '    调用计数 = 调用计数 + 1',
  '    返回 (7)',
  '  结束',
  '结束类',
  ''
].join('\n');

async function main() {
  const arrayModuleId = 'lingbuilder.std.array';
  const arrayManifest = BUILTIN_MODULES.find(item => item.id === arrayModuleId);
  if (!arrayManifest) throw new Error(`缺少内置模块：${arrayModuleId}`);
  const enabledModules: InstalledModule[] = [{
    manifest: arrayManifest,
    installPath: `builtin://${arrayModuleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }];
  const generated = generateLingCppNativeWin32Project(project, {
    lingCppSourceCode: source,
    outputKind: 'console-application',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) {
    throw new Error(generated.blockingDiagnostics.join('\n'));
  }
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!/人数 = 0; 轮询次数 = 0;/u.test(mainCpp)) throw new Error('标量组未按逐条赋值展开。');
  if (!/名单\[1\] = L""; 名单\[2\] = L"";/u.test(mainCpp)) throw new Error('数组元素目标未按逐条赋值展开。');
  if (!/const auto& 连续赋值_值_\d+ = \(取起始序号\(\)\); 人数 = 连续赋值_值_\d+; 轮询次数 = 连续赋值_值_\d+;/u.test(mainCpp)) {
    throw new Error('含调用值未生成求值一次的临时变量。');
  }

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  // 本机未布置 CEF3 SDK 时，控制台 wmain 的两条 CEF3 生命周期调用没有成员声明
  // （声明侧被 LINGBUILDER_CEF3_AVAILABLE 宏门住，调用侧无条件——并行会话在途改动）。
  // 本冒烟只验证连续赋值代码生成与运行，注释掉这两行即可独立编译；SDK 齐备后此补丁仍无害。
  const mainCppPath = path.join(projectDir, 'main.cpp');
  const patchedMainCpp = (await fs.readFile(mainCppPath, 'utf8'))
    .replace(/^(\s*)(consoleApp\.LingBuilder_CEF3_创建无头资源\(\));$/m, '$1// $2')
    .replace(/^(\s*)(consoleApp\.LingBuilder_CEF3_退出回收\(\));$/m, '$1// $2');
  await fs.writeFile(mainCppPath, patchedMainCpp, 'utf8');

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Microsoft Visual Studio',
    'Installer',
    'vswhere.exe'
  );
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*',
    '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const vcvars = path.join(installation, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const executable = path.join(projectDir, 'consecutive-assignment-smoke.exe');
  // 本机常有 _CL_/_LINK_ 环境污染导致 cl 直接失败：在 cmd 内部清空（不能在父进程
  // env -u，那会吞掉 node 自身的 stdout）。
  await execFileAsync('cmd.exe', [
    '/d', '/c',
    `set _CL_=&& set _LINK_=&& call "${vcvars}" >nul && cl /nologo /utf-8 /std:c++17 /EHsc /O2 main.cpp /Fe:"${executable}"`
  ], {
    cwd: projectDir,
    windowsHide: true,
    windowsVerbatimArguments: true,
    timeout: 3 * 60 * 1000,
    maxBuffer: 16 * 1024 * 1024
  });

  const run = await execFileAsync(executable, [], {
    cwd: projectDir,
    windowsHide: true,
    timeout: 30 * 1000,
    maxBuffer: 4 * 1024 * 1024
  });
  const output = `${run.stdout}\n${run.stderr}`;
  const expectations = ['人数=7', '轮询=7', '求值=1', '名单1=已重置', '名单2='];
  const failures = expectations.filter(expected => !output.includes(expected));
  if (failures.length) {
    throw new Error(`运行输出断言失败：${failures.join('、')}\n实际输出：\n${output}`);
  }
  console.log(JSON.stringify({ ok: true, projectDir, executable, output: output.trim().split(/\r?\n/u) }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
