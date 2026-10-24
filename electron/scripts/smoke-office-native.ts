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
const baseProjectDir = path.join(repoRoot, '.lingbuilder-build', 'office-native-smoke');

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
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('office smoke 目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.data.word'), builtin('lingbuilder.data.excel')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'office-native-smoke',
    name: 'Word/Excel 文档模块原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'Word/Excel 文档模块原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 Word 1.0 运行桥与 Excel 1.1 导出PDF', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const allCode = generated.files.map(file => file.content).join(
);
  for (const required of [
    'namespace LingBuilderWordBridge',
    'long long Word_创建文档',
    'bool Word_导出PDF',
    'int Word_替换占位符',
    'bool Word_表格另存Excel',
    'bool Word_从Excel填充表格',
    'LoadLibraryW(L"LingBuilderWord.dll")',
    'bool Excel_导出PDF',
    'namespace lbpdf'
  ]) {
    if (!allCode.includes(required)) throw new Error(`生成的文档模块 C++ 缺少：${required}`);
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
  for (const [moduleId, architecture] of [
    ['lingbuilder.data.word', 'x64'], ['lingbuilder.data.word', 'x86'],
    ['lingbuilder.data.excel', 'x64'], ['lingbuilder.data.excel', 'x86']
  ] as const) {
    const file = architecture === 'x64' ? 'LingBuilderWord.dll' : 'LingBuilderWord.dll';
    const dll = moduleId === 'lingbuilder.data.word' ? file : 'LingBuilderExcel.dll';
    await fs.access(path.join(projectDir, 'modules', moduleId, architecture, dll));
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
  await fs.access(path.join(executableDir, 'LingBuilderWord.dll'));
  await fs.access(path.join(executableDir, 'LingBuilderExcel.dll'));
  const artifacts = ['office-smoke.docx', 'office-smoke.pdf', 'office-table.xlsx', 'office-filled.docx', 'excel-smoke.pdf'];
  for (const artifact of artifacts) {
    await fs.rm(path.join(executableDir, artifact), { force: true });
  }
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 }).catch((error: NodeJS.ErrnoException & { code?: number | string }) => {
    throw new Error(`office 冒烟进程失败：exit=${(error as { code?: unknown }).code ?? '未知'}（失败 stage = exit - 100）`);
  });
  for (const artifact of artifacts) {
    await fs.access(path.join(executableDir, artifact));
  }
  // PDF 文件头抽查
  const pdfHead = Buffer.alloc(5);
  const fh = await fs.open(path.join(executableDir, 'office-smoke.pdf'), 'r');
  await fh.read(pdfHead, 0, 5, 0);
  await fh.close();
  if (pdfHead.toString('latin1') !== '%PDF-') throw new Error('office-smoke.pdf 文件头不是 %PDF-');
  const excelPdfHead = Buffer.alloc(5);
  const fh2 = await fs.open(path.join(executableDir, 'excel-smoke.pdf'), 'r');
  await fh2.read(excelPdfHead, 0, 5, 0);
  await fh2.close();
  if (excelPdfHead.toString('latin1') !== '%PDF-') throw new Error('excel-smoke.pdf 文件头不是 %PDF-');
  console.log(JSON.stringify({
    ok: true,
    projectDir,
    compiledPlatforms: ['Win32', 'x64'],
    runtimePlatform: 'x64',
    checks: ['Word 桥动态加载', '创建模式：标题/段落/表格/单元格/特殊字符', '保存与重开读回', '跨 run 占位符替换', '从JSON生成报告', '导出PDF（CID 中文）', '表格另存Excel + 从Excel填充表格', 'Excel 1.1：导出PDF', '旧格式/超子集明确拒绝']
  }, null, 2));
}

function createSource(): string {
  const stages: Array<[number, string]> = [
    [1, '        @ bool ok = Word_是否可用() && std::wstring(Word_取版本()).find(L"OOXML") != std::wstring::npos;'],
    [2, '        @ long long doc = Word_创建文档();'],
    [3, '        @ ok = ok && doc != 0 && Word_添加标题(doc, L"月度销售报告", 1) && Word_添加段落(doc, L"本报告由冒烟测试自动生成。", L"正文");'],
    [4, '        @ ok = ok && Word_添加段落(doc, L"区域：{{区域}}，销量：{{销量}}。", L"正文") && Word_添加表格(doc, 3, 2) && Word_设置单元格文本(doc, 1, 1, 1, L"区域") && Word_设置单元格文本(doc, 1, 1, 2, L"销量") && Word_设置单元格文本(doc, 1, 2, 1, L"华东") && Word_设置单元格文本(doc, 1, 2, 2, L"128");'],
    [5, '        @ ok = ok && Word_保存文档(doc, L"office-smoke.docx") && Word_导出PDF(doc, L"office-smoke.pdf") && Word_表格另存Excel(doc, 1, L"office-table.xlsx");'],
    [6, '        @ long long reopened = Word_打开文档(L"office-smoke.docx");'],
    [7, '        @ ok = ok && reopened != 0 && std::wstring(Word_取全文本(reopened)).find(L"月度销售报告") != std::wstring::npos && Word_取表格行数(reopened, 1) == 3 && std::wstring(Word_取单元格文本(reopened, 1, 2, 1)) == L"华东";'],
    [8, '        @ Word_关闭文档(reopened);'],
    [9, '        @ ok = ok && Word_从JSON生成报告(L"office-smoke.docx", L"{\\"区域\\":\\"华南\\",\\"销量\\":\\"256\\"}", L"office-filled.docx");'],
    [10, '        @ long long filled = Word_打开文档(L"office-filled.docx");'],
    [11, '        @ ok = ok && filled != 0 && std::wstring(Word_取全文本(filled)).find(L"华南") != std::wstring::npos && Word_关闭文档(filled);'],
    [12, '        @ Word_关闭文档(doc);'],
    [20, '        @ long long wb = Excel_创建工作簿(L"excel-smoke.xlsx");'],
    [21, '        @ ok = ok && wb != 0 && Excel_写一行(wb, L"A1", L"姓名\\t销量\\t金额", L"\\t") && Excel_追加行(wb, L"张三\\t12\\t980.5", L"\\t") && Excel_追加行(wb, L"李四\\t8\\t640", L"\\t");'],
    [22, '        @ ok = ok && Excel_导出PDF(wb, L"excel-smoke.pdf") && Excel_保存(wb) && Excel_关闭(wb);'],
    [30, '        @ ExitProcess(ok ? 0 : 2);']
  ];
  const guard = (stage: number) => `        @ if (!ok) ExitProcess(${100 + stage});`;
  const lines: string[] = [];
  for (const [stage, code] of stages) {
    lines.push(code);
    if (stage === 1) continue;
    lines.push(guard(stage));
  }
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
