import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const baseProjectDir = path.join(repoRoot, '.lingbuilder-build', 'excel-native-smoke');

/** 被残留进程占用（CWD 锁）的目录允许重命名不能删除：整体改名让位，新目录从头生成。 */
async function pickProjectDir(): Promise<string> {
  let candidate = baseProjectDir;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      await fs.rm(candidate, { recursive: true, force: true });
      await fs.access(candidate);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return candidate;
    }
    candidate = `${baseProjectDir}-${attempt + 1}`;
  }
  throw new Error(`无法腾出冒烟目录：${baseProjectDir}。请关闭占用该目录的程序后重试。`);
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  const projectDir = await pickProjectDir();
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('Excel smoke 目录越出工作区。');
  const bundledDll = path.join(repoRoot, 'electron', 'third_party', 'excel', 'x64', 'LingBuilderExcel.dll');
  await fs.access(bundledDll);
  const enabledModules = [builtin('lingbuilder.data.excel')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'excel-native-smoke',
    name: 'Excel 表格模块原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'Excel 表格模块原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 Excel 1.0 运行桥', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const required of [
    'namespace LingBuilderExcelBridge',
    'long long Excel_创建工作簿',
    'long long Excel_打开工作簿',
    'bool Excel_写一行',
    'int Excel_追加行',
    'bool Excel_置加粗',
    'bool Excel_插入行',
    'LoadLibraryW(L"LingBuilderExcel.dll")'
  ]) {
    if (!mainCpp.includes(required)) throw new Error(`生成的 Excel C++ 缺少：${required}`);
  }

  // pickProjectDir 已保证目录是全新腾出的。
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
  await exportModuleNativeDependencies(enabledModules, projectDir);
  for (const architecture of ['x86', 'x64']) {
    await fs.access(path.join(projectDir, 'modules', 'lingbuilder.data.excel', architecture, 'LingBuilderExcel.dll'));
  }
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`,
      ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  }

  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  await fs.access(path.join(executableDir, 'LingBuilderExcel.dll'));
  for (const artifact of ['excel-smoke.xlsx', 'excel-smoke-copy.xlsx']) {
    await fs.rm(path.join(executableDir, artifact), { force: true });
  }
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 }).catch((error: NodeJS.ErrnoException & { code?: number | string }) => {
    throw new Error(`Excel 冒烟进程失败：exit=${(error as { code?: unknown }).code ?? '未知'}（失败 stage = exit - 100，299=末尾失败）`);
  });
  await fs.access(path.join(executableDir, 'excel-smoke.xlsx'));
  await fs.access(path.join(executableDir, 'excel-smoke-copy.xlsx'));
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    bundledDll,
    compiledPlatforms: ['Win32', 'x64'],
    runtimePlatform: 'x64',
    checks: ['动态加载', '创建模式：工作表/单元格/公式/日期/格式/合并/冻结/插入删除行', '保存与另存为', '打开模式：读回/追加行/保真保存', '区域读取', '日期序列换算', '打开模式格式命令中文诊断', '句柄关闭与错误缓存']
  }, null, 2));
}

function createSource(): string {
  const stages: Array<[number, string]> = [
    [1, '        @ bool ok = Excel_是否可用() && std::wstring(Excel_取版本()).find(L"libxlsxwriter") != std::wstring::npos;'],
    [3, '        @ long long wb = Excel_创建工作簿(L"excel-smoke.xlsx");'],
    [4, '        @ ok = ok && wb != 0 && Excel_添加工作表(wb, L"统计") && Excel_置当前工作表(wb, L"统计") && std::wstring(Excel_取当前工作表(wb)) == L"统计";'],
    [5, '        @ ok = ok && Excel_写一行(wb, L"A1", L"姓名\\t销量\\t金额", L"\\t");'],
    [6, '        @ ok = ok && Excel_置加粗(wb, L"A1", true) && Excel_置数字格式(wb, L"C2", 2) && Excel_置背景色(wb, L"A1", 0xFFF0F0);'],
    [7, '        @ ok = ok && Excel_追加行(wb, L"张三\\t12\\t980.5", L"\\t") == 2;'],
    [8, '        @ ok = ok && Excel_追加行(wb, L"李四\\t8\\t640", L"\\t") == 3;'],
    [9, '        @ ok = ok && Excel_写公式(wb, L"C4", L"=SUM(C2:C3)") && Excel_写日期(wb, L"D1", L"2026-01-31 08:30:00");'],
    [10, '        @ ok = ok && Excel_置列宽(wb, L"A", 18.5) && Excel_置行高(wb, 1, 22) && Excel_合并单元格(wb, L"A5:B5") && Excel_冻结窗格(wb, 1, 0);'],
    [11, '        @ ok = ok && Excel_插入行(wb, 2, 1);'],
    [112, '        @ ok = ok && Excel_删除行(wb, 2, 1);'],
    [113, '        @ ok = ok && std::wstring(Excel_取已用范围(wb)) == L"A1:D4";'],

    [12, '        @ ok = ok && std::wstring(Excel_读单元格文本(wb, L"A2")) == L"张三" && Excel_读单元格数值(wb, L"B2") == 12.0;'],
    [13, '        @ ok = ok && Excel_保存(wb) && Excel_另存为(wb, L"excel-smoke-copy.xlsx") && Excel_关闭(wb);'],
    [14, '        @ long long opened = Excel_打开工作簿(L"excel-smoke.xlsx");'],
    [15, '        @ ok = ok && opened != 0 && Excel_取工作表数量(opened) == 2 && Excel_置当前工作表(opened, L"统计");'],
    [16, '        @ ok = ok && std::wstring(Excel_读单元格文本(opened, L"A1")) == L"姓名" && Excel_读单元格数值(opened, L"B2") == 12.0;'],
    [17, '        @ ok = ok && Excel_取单元格类型(opened, L"C4") == 4 && std::wstring(Excel_读单元格公式(opened, L"C4")) == L"SUM(C2:C3)";'],
    [18, '        @ ok = ok && std::wstring(Excel_读区域(opened, L"A1:C1", L"|")) == L"姓名|销量|金额";'],
    [19, '        @ ok = ok && Excel_追加行(opened, L"王五\\t5\\t400", L"\\t") == 5 && std::wstring(Excel_读单元格文本(opened, L"A5")) == L"王五";'],
    [20, '        @ ok = ok && Excel_保存(opened) && Excel_关闭(opened);'],
    [21, '        @ opened = Excel_打开工作簿(L"excel-smoke.xlsx");'],
    [22, '        @ ok = ok && opened != 0 && Excel_置当前工作表(opened, L"统计") && std::wstring(Excel_读单元格文本(opened, L"A5")) == L"王五";'],
    [23, '        @ bool openModeFormatBlocked = !Excel_置列宽(opened, L"A", 10) && !std::wstring(Excel_取错误()).empty();'],
    [24, '        @ ok = ok && openModeFormatBlocked && std::wstring(Excel_序列转日期(Excel_日期转序列(L"2026-01-31"))) == L"2026-01-31" && Excel_日期转序列(L"不是日期") < 0;'],
    [25, '        @ ok = ok && Excel_是否为空单元格(opened, L"ZZ99") && Excel_关闭(opened);']
  ];
  const guard = (stage: number) => `        @ if (!ok) ExitProcess(${100 + stage});`;
  const lines: string[] = [];
  for (const [stage, code] of stages) {
    lines.push(code);
    if (stage === 1) continue;
    lines.push(guard(stage));
  }
  lines.push('        @ if (!ok) ExitProcess(299);');
  lines.push('        @ ExitProcess(ok ? 0 : 2);');
  return [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    ...lines.map(line => '        ' + line.trimStart()),
    '    结束',
    '结束类'
  ].join('\n');
}

async function findMsBuild(): Promise<string> {
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  return path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
}

/** 导出工程写死 v143；本机可能只装了更新的工具集（MSB8020），按实际安装情况覆盖。 */
async function installedToolset(msbuild: string): Promise<string | undefined> {
  const vcRoot = path.join(path.dirname(msbuild), '..', '..', 'Microsoft', 'VC');
  const versions = (await fs.readdir(vcRoot).catch(() => [])).filter(name => /^v\d+$/.test(name)).sort().reverse();
  for (const version of versions) {
    const toolsets = (await fs.readdir(path.join(vcRoot, version, 'Platforms', 'x64', 'PlatformToolsets')).catch(() => []))
      .filter(name => /^v\d+$/.test(name)).sort();
    if (toolsets.length) return toolsets[toolsets.length - 1];
  }
  return undefined;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
