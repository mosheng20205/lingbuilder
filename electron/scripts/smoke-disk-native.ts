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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'disk-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('磁盘模块烟雾测试目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.system.disk')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'disk-native-smoke',
    name: '磁盘信息模块原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '磁盘信息模块原生烟雾测试',
      width: 480, height: 240, background: '#202028', description: '验证只读磁盘、卷和分区查询', controls: []
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 磁盘容量信息 容量 = 磁盘_取容量信息(".")',
    '        局部 磁盘卷信息列表 卷列表 = 磁盘_枚举逻辑驱动器()',
    '        局部 物理磁盘信息列表 物理磁盘 = 磁盘_枚举物理磁盘()',
    '        局部 磁盘分区信息列表 分区列表 = 磁盘_取分区列表(0)',
    '        @ bool ok = 容量.查询成功 && 容量.总容量字节 > 0 && 容量.总空闲字节 >= 0 && std::size(卷列表) > 0;',
    '        @ FILE* report = nullptr;',
    '        @ fopen_s(&report, "disk-native-smoke.txt", "wb");',
    '        @ if (report) fprintf(report, "%s\\n%zu\\n%zu\\n%zu\\n", ok ? "OK" : "FAIL", std::size(卷列表), std::size(物理磁盘), std::size(分区列表));',
    '        @ if (report) fclose(report);',
    '        @ PostQuitMessage(ok ? 0 : 2);',
    '    结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    activeWindowId: 'main-window', lingCppSourceCode: source, lingCppSourceFilePath: 'src/MainWindow.lcpp', enabledModules
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));

  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.resolve(projectDir, file.relativePath);
    if (!target.startsWith(`${projectDir}${path.sep}`)) throw new Error(`生成文件越界：${file.relativePath}`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const vswhere = path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, [
    '-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'
  ], { windowsHide: true })).stdout.trim();
  if (!installation) throw new Error('未找到包含 MSVC C++ 工具链的 Visual Studio。');
  const msbuild = path.join(installation, 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  const results: Array<{ platform: string; volumeCount: number; physicalDiskCount: number; partitionCount: number }> = [];
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const executable = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    const executableDir = path.dirname(executable);
    await fs.access(executable);
    await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
    const lines = (await fs.readFile(path.join(executableDir, 'disk-native-smoke.txt'), 'utf8')).trim().split(/\r?\n/u);
    if (lines[0] !== 'OK') throw new Error(`${platform} 磁盘模块原生验证失败：${lines.join(' / ')}`);
    results.push({
      platform,
      volumeCount: Number(lines[1] || 0),
      physicalDiskCount: Number(lines[2] || 0),
      partitionCount: Number(lines[3] || 0)
    });
  }
  console.log(JSON.stringify({ ok: true, projectDir, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
