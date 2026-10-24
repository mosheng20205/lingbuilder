import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { exportModuleNativeDependencies, materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { WORD_MODULE_ID } from '../src/services/modules/wordModule';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const baseProjectDir = path.join(repoRoot, '.lingbuilder-build', 'pdf-native-smoke');

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
  throw new Error(`无法腾出冒烟目录：${baseProjectDir}。`);
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main(): Promise<void> {
  const projectDir = await pickProjectDir();
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('pdf smoke 目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.data.pdf'), builtin(WORD_MODULE_ID)];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'pdf-native-smoke',
    name: 'PDF 文档模块原生冒烟测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'PDF 文档模块原生冒烟测试',
      width: 420, height: 180, background: '#202028', description: '验证 PDF 1.0 运行桥与 pdfium', controls: []
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window',
    lingCppSourceCode: createSource(),
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const allCode = generated.files.map(file => file.content).join('\n');
  for (const required of [
    'namespace LingBuilderPdfBridge',
    'long long PDF_打开',
    'bool PDF_渲染页面PNG',
    'bool PDF_转Word文本流',
    'bool PDF_外部文档转PDF',
    'LoadLibraryW(L"LingBuilderPdf.dll")'
  ]) {
    if (!allCode.includes(required)) throw new Error(`生成的 PDF 模块 C++ 缺少：${required}`);
  }
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
  await fs.copyFile(path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v1.ico'), path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
  const layout = { buildDir: projectDir, sourceDir: projectDir, binDir: path.join(projectDir, 'bin'), exportDir: projectDir, preferredTargetId: 'windows-msvc-x64' };
  const dependencies = await materializeModuleNativeDependencies(enabledModules, layout);
  if (dependencies.blockingDiagnostics.length) throw new Error(dependencies.blockingDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir,
    projectId: project.id,
    generatedFiles: generated.files,
    enabledModules,
    requiredCppStandard: dependencies.requiredCppStandard,
    requiresDynamicCrt: dependencies.requiresDynamicCrt
  });
  await exportModuleNativeDependencies(enabledModules, projectDir);
  const msbuild = await findMsBuild();
  const toolset = await installedToolset(msbuild);
  await execFileAsync(msbuild, [
    exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64',
    ...(toolset ? [`/p:PlatformToolset=${toolset}`] : []), '/v:minimal'
  ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  const executableDir = path.join(projectDir, 'x64', 'Release', 'bin');
  await fs.access(path.join(executableDir, 'pdfium.dll'));
  await fs.access(path.join(executableDir, 'LingBuilderPdf.dll'));
  const executable = path.join(executableDir, `${exported.projectName}.exe`);
  for (const artifact of ['sample.pdf', 'sample-split.pdf', 'sample-merged.pdf', 'sample-render.png', 'sample-word.docx']) {
    await fs.rm(path.join(executableDir, artifact), { force: true });
  }
  await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 4 * 60 * 1000, maxBuffer: 1024 * 1024 }).catch((error: NodeJS.ErrnoException & { code?: number | string }) => {
    throw new Error(`pdf 冒烟进程失败：exit=${(error as { code?: unknown }).code ?? '未知'}（失败 stage = exit - 100）`);
  });
  for (const artifact of ['sample.pdf', 'sample-split.pdf', 'sample-merged.pdf', 'sample-render.png', 'sample-word.docx']) {
    await fs.access(path.join(executableDir, artifact));
  }
  console.log(JSON.stringify({
    ok: true, projectDir, compiledPlatforms: ['x64'], runtimePlatform: 'x64',
    checks: ['pdfium/LingBuilderPdf 物化', 'Word 生成样张 → PDF 全链', '打开/页数/文本/文本层', '渲染PNG', '拆分/合并', '转Word文本流', '句柄释放']
  }, null, 2));
}

function createSource(): string {
  const stages: Array<[number, string]> = [
    [1, '        @ bool ok = PDF_是否可用();'],
    [2, '        @ long long wd = Word_创建文档();'],
    [3, '        @ ok = ok && wd != 0 && Word_添加标题(wd, L"月度销售报告", 1) && Word_添加段落(wd, L"华东区域销售额稳步增长。", L"正文") && Word_添加表格(wd, 2, 2) && Word_设置单元格文本(wd, 1, 1, 1, L"区域") && Word_设置单元格文本(wd, 1, 1, 2, L"销量");'],
    [4, '        @ ok = ok && Word_导出PDF(wd, L"sample.pdf") && Word_关闭文档(wd);'],
    [10, '        @ long long doc = PDF_打开(L"sample.pdf");'],
    [11, '        @ ok = ok && doc != 0 && PDF_取页数(doc) == 1 && PDF_是否有文本层(doc, 1);'],
    [12, '        @ ok = ok && std::wstring(PDF_取全部文本(doc)).find(L"月度销售报告") != std::wstring::npos && std::wstring(PDF_取全部文本(doc)).find(L"华东") != std::wstring::npos;'],
    [13, '        @ ok = ok && PDF_渲染页面PNG(doc, 1, 1.5, L"sample-render.png");'],
    [14, '        @ ok = ok && PDF_拆分页面(doc, 1, 1, L"sample-split.pdf");'],
    [15, '        @ long long split = PDF_打开(L"sample-split.pdf");'],
    [16, '        @ ok = ok && split != 0 && PDF_合并文档(doc, split, L"sample-merged.pdf");'],
    [17, '        @ long long merged = PDF_打开(L"sample-merged.pdf");'],
    [18, '        @ ok = ok && merged != 0 && PDF_取页数(merged) == 2;'],
    [19, '        @ PDF_关闭(merged); PDF_关闭(split);'],
    [20, '        @ ok = ok && PDF_转Word文本流(doc, L"sample-word.docx");'],
    [21, '        @ PDF_关闭(doc);'],
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

async function installedToolset(msbuild: string): Promise<string | undefined> {
  const vcRoot = path.join(path.dirname(msbuild), '..', '..', 'Microsoft', 'VC');
  const versions = (await fs.readdir(vcRoot).catch(() => [] as string[])).filter(name => /^v\d+$/.test(name)).sort().reverse();
  for (const version of versions) {
    const toolsets = (await fs.readdir(path.join(vcRoot, version, 'Platforms', 'x64', 'PlatformToolsets')).catch(() => [] as string[]))
      .filter(name => /^v\d+$/.test(name)).sort();
    if (toolsets.length) return toolsets[toolsets.length - 1];
  }
  return undefined;
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
