import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { LingBuilderSolutionProject } from '../src/services/solution/solutionService';
import { createDesignerAssetService } from '../src/services/windowDesigner/designerAssetService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'datagrid-api-demo');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('DataGrid 示例构建目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.win32.common-controls')];
  const project = JSON.parse(await fs.readFile(path.join(repoRoot, '.lingbuilder', 'projects', 'datagrid-api-demo', 'window-designer.json'), 'utf8')) as LingWindowProject;
  let source = await fs.readFile(path.join(repoRoot, 'src', 'datagrid-api-demo', 'MainWindow.lcpp'), 'utf8');
  const smokeAnchor = '        控件_设置文本("事件日志", "事件日志：请直接单击、双击或编辑左侧表格。")';
  if (!source.includes(smokeAnchor)) throw new Error('DataGrid smoke 无法定位创建完毕处理器注入点。');
  source = source.replace(smokeAnchor, [
    smokeAnchor,
    '        表格_导出Excel("静态表格", "datagrid-smoke.xlsx", 真)',
    '        表格_清空行("静态表格")',
    '        表格_导入Excel("静态表格", "datagrid-smoke.xlsx", 真)',
    '        表格_导出Excel("静态表格", "datagrid-smoke-roundtrip.xlsx", 真)'
  ].join('\n'));
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
  const projectRef: LingBuilderSolutionProject = {
    id: 'datagrid-api-demo', name: 'Win32 DataGrid 完整接口示例', type: 'visual-cpp',
    sourceRoot: 'src/datagrid-api-demo', configRoot: 'config/datagrid-api-demo',
    designerPath: '.lingbuilder/projects/datagrid-api-demo/window-designer.json', isDefault: false, references: []
  };
  const copiedAssets = await createDesignerAssetService(repoRoot).copyProjectAssets(projectRef, [projectDir]);
  const contentFiles = copiedAssets.map(file => path.relative(projectDir, file).replace(/\\/gu, '/'));
  if (!contentFiles.includes('assets/datagrid-api-demo/datagrid-demo.png')) throw new Error('DataGrid 示例图片未由项目资源服务复制。');
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules, contentFiles });

  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { windowsHide: true })).stdout.trim();
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  await fs.access(path.join(path.dirname(executable), 'assets', 'datagrid-api-demo', 'datagrid-demo.png'));
  const firstWorkbook = path.join(path.dirname(executable), 'datagrid-smoke.xlsx');
  const roundtripWorkbook = path.join(path.dirname(executable), 'datagrid-smoke-roundtrip.xlsx');
  await Promise.all([fs.rm(firstWorkbook, { force: true }), fs.rm(roundtripWorkbook, { force: true })]);
  const child = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  await new Promise(resolve => setTimeout(resolve, 3000));
  if (child.exitCode !== null) throw new Error(`DataGrid 完整示例提前退出，代码 ${child.exitCode}。`);
  const [firstBytes, roundtripBytes] = await Promise.all([fs.readFile(firstWorkbook), fs.readFile(roundtripWorkbook)]);
  for (const [name, bytes] of [['首次导出', firstBytes], ['导入后再次导出', roundtripBytes]] as const) {
    if (bytes.length < 1000 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(`${name}未生成有效的 XLSX ZIP 文件。`);
  }
  if (roundtripBytes.length < firstBytes.length * 0.7) throw new Error('XLSX 导入后再次导出的内容异常偏小，往返数据可能丢失。');
  child.kill();
  console.log(JSON.stringify({ ok: true, projectDir, solutionPath: exported.solutionPath, executable, survivedMilliseconds: 3000, xlsxBytes: firstBytes.length, roundtripXlsxBytes: roundtripBytes.length }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
