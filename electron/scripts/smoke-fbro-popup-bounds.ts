// FBro 弹窗顶层窗口控制真机冒烟（lingbuilder.fbro.browser 2.13.0）：
// 控制台项目复用标准 Win32 后端窗口类，纯代码链
//   FBro_后台创建 → FBro_实例打开原生UI（独立顶层 Chrome 原生 UI 弹窗）
//   → FBro_实例设置窗口边界（内部轮询等异步建窗就绪）
//   → FBro_实例取窗口句柄 / FBro_实例取窗口边界JSON 回读
//   → 负例：无效句柄 0、后台实例（无窗口）0/{}/0
// 同步命令直接写 stdout，脚本逐项断言后回收进程。
// 该脚本同时是真机探针：验证 Chrome Runtime 弹窗 HWND 就绪时序与边界是否被内核覆盖。
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');

async function resolveMsbuild(): Promise<string> {
  const vswhere = 'C:\\Program Files (x86)\\Microsoft Visual Studio\\Installer\\vswhere.exe';
  try {
    const { stdout } = await execFileAsync(vswhere, [
      '-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild',
      '-find', 'MSBuild\\**\\Bin\\MSBuild.exe'
    ], { windowsHide: true });
    const found = stdout.split(/\r?\n/u).map(line => line.trim()).find(line => line.toLowerCase().endsWith('msbuild.exe'));
    if (found) return found;
  } catch { /* fall through to pinned path */ }
  return 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
}

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

const enabledModules = [
  builtin('lingbuilder.win32.basic'),
  builtin('lingbuilder.fbro.browser'),
  builtin('lingbuilder.fbro.events')
];

async function main() {
  const projectDir = path.join(repoRoot, '.lingbuilder-build', `fbro-popup-bounds-smoke-${process.pid}`);
  const project: LingWindowProject = {
    id: 'fbro-popup-bounds-smoke',
    name: 'FBro 弹窗边界冒烟',
    windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 弹窗边界冒烟',
      width: 480, height: 360, background: '#202020', description: 'FBro 弹窗边界冒烟', controls: []
    }]
  };
  const sourceCode = [
    '类 MainWindow',
    '公开',
    '  整数型 启动()',
    '    局部 长整数型 实例',
    '    局部 长整数型 弹窗',
    '    局部 长整数型 弹窗窗口',
    '    局部 文本型 边界',
    '    局部 整数型 无效句柄结果',
    '    局部 整数型 就绪',
    '    局部 整数型 等待次数',
    '    实例 = FBro_后台创建("", ".fbro-popup-smoke/profile", "")',
    '    调试输出("INSTANCE=", 实例)',
    '    // 后台实例登记即返回、浏览器异步启动：先轮询等存活（CreateChromeUi 要求来源浏览器已就绪）。',
    '    就绪 = FBro_实例是否存活(实例)',
    '    判断循环首 (就绪 < 1)',
    '      延时(50)',
    '      等待次数 = 等待次数 + 1',
    '      如果 (等待次数 > 200)',
    '        跳出循环',
    '      如果结束',
    '      就绪 = FBro_实例是否存活(实例)',
    '    判断循环尾 ()',
    '    调试输出("READY=", 就绪)',
    '    弹窗 = FBro_实例打开原生UI(实例, "")',
    '    调试输出("POPUP=", 弹窗)',
    '    调试输出("HWND_BEFORE=", FBro_实例取窗口句柄(弹窗))',
    '    调试输出("SETBOUNDS=", FBro_实例设置窗口边界(弹窗, 100, 100, 960, 640))',
    '    弹窗窗口 = FBro_实例取窗口句柄(弹窗)',
    '    调试输出("HWND_AFTER=", 弹窗窗口)',
    '    边界 = FBro_实例取窗口边界JSON(弹窗)',
    '    调试输出("BOUNDS=", 边界)',
    '    无效句柄结果 = FBro_实例设置窗口边界(987654321, 0, 0, 500, 400)',
    '    调试输出("INVALID=", 无效句柄结果)',
    '    调试输出("BGHWND=", FBro_实例取窗口句柄(实例))',
    '    调试输出("BGJSON=", FBro_实例取窗口边界JSON(实例))',
    '    FBro_实例关闭(弹窗)',
    '    延时(1500)',
    '    调试输出("POPUP_ALIVE=", FBro_实例是否存活(弹窗))',
    '    FBro_实例关闭(实例)',
    '    延时(1500)',
    '    调试输出("BG_ALIVE=", FBro_实例是否存活(实例))',
    '    返回 (0)',
    '  结束',
    '结束类'
  ].join('\n');
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: sourceCode,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    outputKind: 'console-application'
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const marker of ['FBro_实例打开原生UI', 'FBro_实例设置窗口边界', 'FBro_实例取窗口句柄', 'FBro_实例取窗口边界JSON']) {
    if (!mainCpp.includes(marker)) throw new Error(`生成代码缺少 ${marker} 的实现或调用。`);
  }
  for (let attempt = 0; ; attempt += 1) {
    try { await fs.rm(projectDir, { recursive: true, force: true }); break; }
    catch (error) {
      if (attempt >= 8 || !['EBUSY', 'EPERM'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  for (const candidate of [
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repoRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ]) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
      break;
    } catch { /* try next */ }
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules,
    projectKind: 'console-application'
  });
  const msbuild = await resolveMsbuild();
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/nodeReuse:false', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const { stdout } = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  console.log('[popup-bounds stdout]', stdout);
  const expect = (pattern: RegExp, label: string) => {
    if (!pattern.test(stdout)) throw new Error(`FBro 弹窗边界冒烟断言失败（${label}）：${pattern}`);
  };
  expect(/INSTANCE=,\s*[1-9]\d*/u, '后台实例句柄有效');
  expect(/POPUP=,\s*[1-9]\d*/u, '弹窗句柄有效（独立顶层 Chrome 原生 UI 已弹出）');
  expect(/SETBOUNDS=,\s*1/u, '设置窗口边界成功（内部轮询等到弹窗窗口就绪）');
  expect(/HWND_AFTER=,\s*[1-9]\d*/u, '弹窗顶层 HWND 可查');
  expect(/BOUNDS=,\s*\{"x":100,"y":100,"width":960,"height":640\}/u, '边界 JSON 与设置值往返一致');
  expect(/INVALID=,\s*0/u, '无效句柄设置边界返回 0（轮询超时拒绝）');
  expect(/POPUP_ALIVE=,\s*0/u, '弹窗已关闭');
  expect(/BG_ALIVE=,\s*0/u, '后台实例已关闭');
  console.log(JSON.stringify({ ok: true, projectDir, executable }, null, 2));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
