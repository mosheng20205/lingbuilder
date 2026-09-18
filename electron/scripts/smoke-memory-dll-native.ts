/**
 * 内存加载 DLL 原生烟雾测试（无头、可重复）。
 *
 * 场景 A（项目 DLL 命令声明 + 加载方式 = 内存）：
 *   DLL 以 RCDATA 内嵌进 EXE → 运行期手工 PE 映射（不落盘）→ 导出按名解析后按声明签名调用。
 *   断言：导出调用结果正确（含 C++ 异常、DllMain 入口计数、静态变量可写），
 *         且 exe 目录内不存在被加载的 DLL 文件（证明没有落盘）。
 * 场景 B（内存加载DLL模块命令直用）：
 *   从文件读字节集 → 内存DLL_加载 → 取函数地址/序号地址/模块大小/已加载 → 卸载；
 *   并用错误架构 DLL 验证中文诊断（x64 程序加载 32 位 DLL 必须被拒绝并给出原因）。
 *
 * 运行：cd electron && npx tsx scripts/smoke-memory-dll-native.ts
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { materializeProjectDllDeclarationModules } from '../src/services/modules/projectDllMaterializeService';
import { MEMORY_DLL_MODULE_ID } from '../src/services/windowDesigner/memoryDllRuntime';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const scratchRoot = path.resolve(repoRoot, '.lingbuilder-build', 'memory-dll-smoke');
const dllSourceDir = path.resolve(repoRoot, 'examples', 'memory-dll-demo', 'third-party-dll-src');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function resolveMsbuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

/** 用 examples 里的演示 DLL 源码构建 Win32 + x64 两套 DLL。 */
async function buildDemoDll(): Promise<{ win32: string; x64: string }> {
  const buildScript = path.join(dllSourceDir, 'build-memory-demo-dll.cmd');
  // cmd.exe 要求整条命令行按原样传入：必须用 windowsVerbatimArguments，
  // 否则 Node 会把引号转义成 \" 让 cmd 解析失败（与构建管线调用 vcvars 的写法一致）。
  const quote = (value: string) => `"${value}"`;
  await execFileAsync('cmd.exe', ['/d', '/c', `call ${quote(buildScript)} ${quote(path.join(scratchRoot, 'dll'))}`], {
    cwd: dllSourceDir, windowsHide: true, windowsVerbatimArguments: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const win32 = path.join(scratchRoot, 'dll', 'bin', 'Win32', 'memory_demo.dll');
  const x64 = path.join(scratchRoot, 'dll', 'bin', 'x64', 'memory_demo.dll');
  await Promise.all([fs.access(win32), fs.access(x64)]);
  return { win32, x64 };
}

async function writeProjectFiles(projectDir: string, files: Array<{ relativePath: string; content: string }>): Promise<void> {
  for (const file of files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
}

async function buildWithMsbuild(msbuild: string, solutionPath: string, projectDir: string, platform: 'Win32' | 'x64'): Promise<string> {
  try {
    await execFileAsync(msbuild, [
      solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const detail = error as { stdout?: string; stderr?: string };
    throw new Error(`MSBuild（${platform}）失败：\n${String(detail.stdout || '').slice(-8000)}\n${String(detail.stderr || '').slice(-2000)}`);
  }
  return projectDir;
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFilesRecursive(absolute));
    else files.push(absolute);
  }
  return files;
}

/**
 * 清理构建目录：刚运行过的 exe / MSBuild 节点会短暂占用句柄（EBUSY/EPERM），
 * 按退避重试；仍失败时改名让路，避免整个冒烟因锁失败。
 */
async function removeDirectoryWithRetry(directory: string): Promise<void> {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      await fs.rm(directory, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code !== 'EBUSY' && code !== 'EPERM' && code !== 'ENOTEMPTY') throw error;
      await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  const renamed = `${directory}-stale-${Date.now()}`;
  await fs.rename(directory, renamed).catch(() => undefined);
  await fs.rm(renamed, { recursive: true, force: true }).catch(() => undefined);
}

// ===== 场景 A：项目 DLL 命令声明 + 加载方式 = 内存 =====

const DECLARATION_SOURCE = [
  '包 项目DLL命令',
  '',
  'DLL命令库 MemoryDemo',
  '  Win32 = "dll/Win32/memory_demo.dll"',
  '  x64 = "dll/x64/memory_demo.dll"',
  '  加载方式 = 内存',
  '',
  '  整数型 内存演示_加法(整数型 甲, 整数型 乙) = memo_add',
  '  整数型 内存演示_除法(整数型 甲, 整数型 乙) = memo_divide',
  '  整数型 内存演示_入口计数() = memo_entry_count',
  '  整数型 内存演示_文本长度(文本型 文本) = memo_text_length',
  '  文本型 内存演示_取文本(文本型 前缀) = memo_make_text',
  '  整数型 内存演示_静态计数() = memo_static_counter',
  '  整数型 内存演示_自路径(整数型 占位) = memo_self_path',
  '结束DLL命令库',
  ''
].join('\n');

const DECLARE_MAIN_SOURCE = [
  '包 内存加载DLL演示',
  '使用 Win32窗口基础模块',
  '使用 内存加载DLL模块',
  '',
  '类 内存演示窗口 : 窗口',
  '公开',
  '  事件 _内存演示窗口_创建完毕()',
  '    局部 整数型 加法结果 = 0',
  '    局部 整数型 除零结果 = 0',
  '    局部 整数型 入口计数 = 0',
  '    局部 整数型 文本长度 = 0',
  '    局部 整数型 静态计数 = 0',
  '    局部 整数型 自路径结果 = 0',
  '    局部 文本型 组合文本 = ""',
  '    加法结果 = 内存演示_加法(2, 3)',
  '    除零结果 = 内存演示_除法(7, 0)',
  '    入口计数 = 内存演示_入口计数()',
  '    文本长度 = 内存演示_文本长度("灵码LingBuilder")',
  '    组合文本 = 内存演示_取文本("内存加载")',
  '    静态计数 = 内存演示_静态计数() + 内存演示_静态计数()',
  '    自路径结果 = 内存演示_自路径(0)',
  '    @ const bool lbTextOk = 组合文本 == L"[内存加载] 来自内存 DLL";',
  '    @ FILE* lbReport = nullptr;',
  '    @ fopen_s(&lbReport, "memory-dll-declare-report.txt", "wb");',
  '    @ if (lbReport) fprintf(lbReport, "%d|%d|%d|%d|%d|%d|%d\\n", 加法结果, 除零结果, 入口计数, 文本长度, 静态计数, 自路径结果, lbTextOk ? 1 : 0);',
  '    @ if (lbReport) fclose(lbReport);',
  '    @ PostQuitMessage(0);',
  '  结束',
  '结束类',
  ''
].join('\n');

async function runDeclareScenario(msbuild: string, platform: 'Win32' | 'x64', dllPaths: { win32: string; x64: string }): Promise<{ ok: boolean; values: string; exeDirDlls: string[] }> {
  const projectDir = path.join(scratchRoot, `declare-${platform}`);
  const binDir = path.join(projectDir, 'bin');
  const exportDir = path.join(projectDir, 'export');
  await removeDirectoryWithRetry(projectDir);
  await Promise.all([fs.mkdir(binDir, { recursive: true }), fs.mkdir(exportDir, { recursive: true })]);
  // Win32 用「无图标」验证 rc 只含内嵌 DLL 资源的分支；x64 用默认图标验证与图标共存的正式分支。
  const iconStyle: 'none' | 'lingbuilder' = platform === 'Win32' ? 'none' : 'lingbuilder';
  if (iconStyle === 'lingbuilder') {
    const iconTarget = path.join(projectDir, 'resources', 'lingbuilder-app.ico');
    await fs.mkdir(path.dirname(iconTarget), { recursive: true });
    await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'), iconTarget);
  }

  // 声明里的 DLL 相对路径以 sourceRootAbsolute 为基准：这里把两套架构 DLL 铺到 <projectDir>/dll/<arch>/。
  const dllRoot = path.join(projectDir, 'dll');
  await fs.mkdir(path.join(dllRoot, 'Win32'), { recursive: true });
  await fs.mkdir(path.join(dllRoot, 'x64'), { recursive: true });
  await fs.copyFile(dllPaths.win32, path.join(dllRoot, 'Win32', 'memory_demo.dll'));
  await fs.copyFile(dllPaths.x64, path.join(dllRoot, 'x64', 'memory_demo.dll'));

  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'memory-dll-declare-smoke',
    name: '内存加载 DLL 声明烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '内存演示窗口', title: '内存加载 DLL 声明烟雾测试',
      width: 520, height: 240, background: '#202028', description: '无头验证「加载方式 = 内存」的声明内嵌链路', iconStyle, controls: []
    }]
  };
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin(MEMORY_DLL_MODULE_ID)];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: 'src/内存加载演示.lcpp',
    lingCppSources: [
      { filePath: 'src/项目DLL命令.lcpp', sourceCode: DECLARATION_SOURCE },
      { filePath: 'src/内存加载演示.lcpp', sourceCode: DECLARE_MAIN_SOURCE }
    ],
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(`生成被阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  await writeProjectFiles(projectDir, generated.files);
  const resourceFile = generated.files.find(file => file.relativePath === 'lingbuilder-app.rc');
  if (!resourceFile || !/RCDATA\s+"resources\\\\lingbuilder-project-dll-1\.dll"/u.test(resourceFile.content)) {
    throw new Error(`rc 未内嵌内存加载 DLL 资源：\n${resourceFile?.content || '（缺少 rc）'}`);
  }

  const dllLibraries = parseLingCpp(DECLARATION_SOURCE).program.dllLibraries;
  const materialized = await materializeProjectDllDeclarationModules({
    dllLibraries,
    sourceRootAbsolute: projectDir,
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir,
    exportDir,
    machine: platform === 'x64' ? 'X64' : 'X86',
    logs: []
  });
  if (materialized.blocking.length) throw new Error(`物化被阻断：\n${materialized.blocking.join('\n')}`);
  if (materialized.libFiles.length > 0) throw new Error('内存加载不应生成导入库，却发现 libFiles：' + materialized.libFiles.join(', '));

  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  await buildWithMsbuild(msbuild, exported.solutionPath, projectDir, platform);

  const executable = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const executableDir = path.dirname(executable);
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const report = (await fs.readFile(path.join(executableDir, 'memory-dll-declare-report.txt'), 'utf8')).trim();
  const exeDirDlls = (await listFilesRecursive(executableDir)).filter(file => /\.dll$/iu.test(file)).map(file => path.basename(file));
  // 期望：加法 5；除零 -1；DllMain 入口计数 42；文本长度 13；静态计数 1+2=3；自身模块查询 0；文本比对 1。
  return { ok: report === '5|-1|42|13|3|0|1', values: report, exeDirDlls };
}

// ===== 场景 B：内存加载DLL模块命令直用 =====

const COMMAND_MAIN_SOURCE = [
  '包 内存加载命令演示',
  '使用 Win32窗口基础模块',
  '使用 内存加载DLL模块',
  '使用 缓冲区模块',
  '使用 字节与十六进制模块',
  '',
  '类 内存命令窗口 : 窗口',
  '公开',
  '  事件 _内存命令窗口_创建完毕()',
  '    局部 长整数型 缓冲区 = 缓冲区_从文件("data/memory_demo.dll")',
  '    局部 字节集 数据 = 缓冲区_到字节集(缓冲区)',
  '    局部 长整数型 模块地址 = 内存DLL_加载(数据, "memory_demo.dll")',
  '    局部 整数型 模块大小 = 内存DLL_取模块大小(模块地址)',
  '    局部 长整数型 函数地址 = 内存DLL_取函数地址(模块地址, "memo_add")',
  '    局部 长整数型 序号地址 = 内存DLL_取函数序号地址(模块地址, 1)',
  '    局部 逻辑型 已加载 = 内存DLL_已加载(模块地址)',
  '    局部 逻辑型 卸载成功 = 内存DLL_卸载(模块地址)',
  '    局部 逻辑型 卸载后已加载 = 内存DLL_已加载(模块地址)',
  '    局部 长整数型 错误缓冲区 = 缓冲区_从文件("data/memory_demo_x86.dll")',
  '    局部 字节集 错误数据 = 缓冲区_到字节集(错误缓冲区)',
  '    局部 长整数型 架构不符结果 = 内存DLL_加载(错误数据, "memory_demo_x86.dll")',
  '    局部 文本型 错误文本 = 内存DLL_取错误信息()',
  '    局部 字节集 空数据 = 字节集_从文本("")',
  '    局部 长整数型 空数据结果 = 内存DLL_加载(空数据, "空.dll")',
  '    @ const bool lbArchMessage = 错误文本.find(L"架构") != std::wstring::npos;',
  '    @ FILE* lbReport = nullptr;',
  '    @ fopen_s(&lbReport, "memory-dll-command-report.txt", "wb");',
  '    @ if (lbReport) fprintf(lbReport, "%d|%d|%d|%d|%d|%d|%d|%d|%d|%d|%d\\n", 模块地址 > 0 ? 1 : 0, 模块大小 > 0 ? 1 : 0, 函数地址 > 0 ? 1 : 0, 序号地址 > 0 ? 1 : 0, 已加载 ? 1 : 0, 卸载成功 ? 1 : 0, 卸载后已加载 ? 1 : 0, 架构不符结果 == 0 ? 1 : 0, lbArchMessage ? 1 : 0, 空数据结果 == 0 ? 1 : 0, 模块地址 > 0 ? 1 : 0);',
  '    @ if (lbReport) fclose(lbReport);',
  '    @ PostQuitMessage(0);',
  '  结束',
  '结束类',
  ''
].join('\n');

async function runCommandScenario(msbuild: string, dllPaths: { win32: string; x64: string }): Promise<{ ok: boolean; values: string }> {
  const projectDir = path.join(scratchRoot, 'command-x64');
  await removeDirectoryWithRetry(projectDir);
  await fs.mkdir(projectDir, { recursive: true });
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'memory-dll-command-smoke',
    name: '内存加载命令烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: '内存命令窗口', title: '内存加载命令烟雾测试',
      width: 520, height: 240, background: '#202028', description: '无头验证内存DLL_* 命令族', iconStyle: 'none', controls: []
    }]
  };
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.std.buffer'), builtin('lingbuilder.std.bytes'), builtin(MEMORY_DLL_MODULE_ID)];
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceFilePath: 'src/内存加载命令演示.lcpp',
    lingCppSourceCode: COMMAND_MAIN_SOURCE,
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(`生成被阻断：\n${generated.blockingDiagnostics.join('\n')}`);
  await writeProjectFiles(projectDir, generated.files);
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  await buildWithMsbuild(msbuild, exported.solutionPath, projectDir, 'x64');

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const executableDir = path.dirname(executable);
  // 场景 B 的字节来源就是磁盘上的文件（用户自己的 DLL），DLL 目录刻意放在 exe 目录的 data 子目录。
  const dataDir = path.join(executableDir, 'data');
  await fs.mkdir(dataDir, { recursive: true });
  await fs.copyFile(dllPaths.x64, path.join(dataDir, 'memory_demo.dll'));
  await fs.copyFile(dllPaths.win32, path.join(dataDir, 'memory_demo_x86.dll'));
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
  const report = (await fs.readFile(path.join(executableDir, 'memory-dll-command-report.txt'), 'utf8')).trim();
  return { ok: report === '1|1|1|1|1|1|0|1|1|1|1', values: report };
}

async function main(): Promise<void> {
  if (!scratchRoot.startsWith(`${repoRoot}${path.sep}`)) throw new Error('内存加载 DLL 烟雾测试目录越出工作区。');
  await fs.mkdir(scratchRoot, { recursive: true });
  const dllPaths = await buildDemoDll();
  const msbuild = await resolveMsbuild();

  const results: Record<string, unknown> = {};
  for (const platform of ['Win32', 'x64'] as const) {
    const result = await runDeclareScenario(msbuild, platform, dllPaths);
    results[`声明内嵌-${platform}`] = result;
    if (!result.ok) throw new Error(`声明内嵌（${platform}）结果不符：${result.values}`);
    const leaked = result.exeDirDlls.filter(name => /^memory_demo/iu.test(name));
    if (leaked.length > 0) throw new Error(`声明内嵌（${platform}）exe 目录出现了被加载的 DLL：${leaked.join(', ')}`);
    if (result.exeDirDlls.length > 0) throw new Error(`声明内嵌（${platform}）exe 目录不应有任何 DLL：${result.exeDirDlls.join(', ')}`);
  }
  const commandResult = await runCommandScenario(msbuild, dllPaths);
  results['命令直用-x64'] = commandResult;
  if (!commandResult.ok) throw new Error(`命令直用结果不符：${commandResult.values}`);

  console.log(JSON.stringify({ ok: true, scratchRoot, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
