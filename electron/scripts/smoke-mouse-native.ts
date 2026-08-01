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
const projectDir = path.resolve(repoRoot, '.lingbuilder-build', 'mouse-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function main() {
  if (!projectDir.startsWith(`${repoRoot}${path.sep}`)) throw new Error('鼠标模块烟雾测试目录越出工作区。');
  const enabledModules = [builtin('lingbuilder.input.mouse')];
  const project: LingWindowProject = {
    schemaVersion: 2,
    id: 'mouse-native-smoke',
    name: '鼠标输入模块原生烟雾测试',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: '鼠标输入模块原生烟雾测试',
      width: 480, height: 240, background: '#202028', description: '只验证坐标查询、无效 HWND 消息和无效 UIA 查找', controls: []
    }]
  };
  const source = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        局部 整数型 横坐标 = 鼠标_取横坐标()',
    '        局部 整数型 纵坐标 = 鼠标_取纵坐标()',
    '        局部 逻辑型 消息移动返回 = 鼠标_窗口消息移动(0, 1, 1)',
    '        局部 逻辑型 左键返回 = 鼠标_窗口消息左键单击(0, 1, 1)',
    '        局部 逻辑型 右键返回 = 鼠标_窗口消息右键单击(0, 1, 1)',
    '        局部 逻辑型 中键返回 = 鼠标_窗口消息中键单击(0, 1, 1)',
    '        局部 逻辑型 滚轮返回 = 鼠标_窗口消息滚轮(0, 120, 1, 1)',
    '        局部 逻辑型 水平滚轮返回 = 鼠标_窗口消息水平滚轮(0, 120, 1, 1)',
    '        局部 长整数型 名称元素 = 鼠标_UIA_按名称查找(0, "不存在的元素")',
    '        局部 长整数型 自动化元素 = 鼠标_UIA_按自动化ID查找(0, "不存在的元素")',
    '        @ bool ok = !消息移动返回 && !左键返回 && !右键返回 && !中键返回 && !滚轮返回 && !水平滚轮返回 && 名称元素 == 0 && 自动化元素 == 0;',
    '        @ FILE* report = nullptr;',
    '        @ fopen_s(&report, "mouse-native-smoke.txt", "wb");',
    '        @ if (report) fprintf(report, "%s\\n%d\\n%d\\n", ok ? "OK" : "FAIL", 横坐标, 纵坐标);',
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

  const results: Array<{ platform: string; x: number; y: number }> = [];
  for (const platform of ['Win32', 'x64']) {
    await execFileAsync(msbuild, [
      exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', `/p:Platform=${platform}`, '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
    const executable = path.join(projectDir, platform, 'Release', 'bin', `${exported.projectName}.exe`);
    const executableDir = path.dirname(executable);
    await fs.access(executable);
    await execFileAsync(executable, [], { cwd: executableDir, windowsHide: true, timeout: 2 * 60 * 1000, maxBuffer: 1024 * 1024 });
    const lines = (await fs.readFile(path.join(executableDir, 'mouse-native-smoke.txt'), 'utf8')).trim().split(/\r?\n/u);
    if (lines[0] !== 'OK') throw new Error(`${platform} 鼠标模块原生验证失败：${lines.join(' / ')}`);
    results.push({ platform, x: Number(lines[1] || 0), y: Number(lines[2] || 0) });
  }
  console.log(JSON.stringify({ ok: true, projectDir, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
