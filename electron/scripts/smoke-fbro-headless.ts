// FBro 无头模式真机冒烟：
//  1) 控制台项目：FBro_启用无头模式() 字面烘焙 + FBro_后台创建/实例导航/等待加载/执行JS 同步驱动，断言 stdout 含 --headless 与真实页面标题。
//  2) 窗口项目（仅编译）：「FBro无头浏览器」设计器资源生成 headless 烘焙与后台实例创建代码，MSVC 编译链接通过。
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

function baseWindow(id: string, className: string, title: string) {
  return {
    id, fileName: `${className}.xml`, className, title,
    width: 640, height: 480, background: '#202020', description: title, controls: []
  };
}

async function buildProject(options: {
  projectDir: string; project: LingWindowProject; sourceCode: string; consoleMode: boolean;
}) {
  const { projectDir, project, sourceCode, consoleMode } = options;
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: sourceCode,
    lingCppSourceFilePath: 'src/MainWindow.lcpp',
    ...(consoleMode ? { outputKind: 'console-application' as const } : {})
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
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
    ...(consoleMode ? { projectKind: 'console-application' as const } : {})
  });
  const msbuild = await resolveMsbuild();
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/nodeReuse:false', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  return { generated, exported, executable };
}

async function smokeConsoleHeadless() {
  const projectDir = path.join(repoRoot, '.lingbuilder-build', `fbro-headless-console-smoke-${process.pid}`);
  const project: LingWindowProject = {
    id: 'fbro-headless-console-smoke',
    name: 'FBro 无头控制台冒烟',
    windows: [baseWindow('main-window', 'MainWindow', '无头控制台冒烟')]
  };
  const sourceCode = [
    '类 MainWindow',
    '公开',
    '  整数型 启动()',
    '    局部 整数型 无头声明',
    '    局部 长整数型 实例',
    '    无头声明 = FBro_启用无头模式()',
    '    调试输出("HEADLESS=", 无头声明)',
    '    实例 = FBro_后台创建("https://example.com/", "", "")',
    '    调试输出("HANDLE=", 实例)',
    '    调试输出("CMDLINE=", FBro_取启动命令行())',
    '    调试输出("WAIT=", FBro_实例等待加载超时(实例, 25000))',
    '    调试输出("TITLE=", FBro_实例执行JS(实例, "document.title"))',
    '    FBro_实例关闭(实例)',
    '    返回 (0)',
    '  结束',
    '结束类'
  ].join('\n');
  const { generated, executable } = await buildProject({ projectDir, project, sourceCode, consoleMode: true });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!mainCpp.includes('g_lingFbroHeadlessBaked = true')) throw new Error('控制台冒烟生成代码缺少 headless 烘焙。');
  const { stdout } = await execFileAsync(executable, [], { cwd: path.dirname(executable), windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  console.log('[console-smoke stdout]', stdout);
  const expect = (pattern: RegExp, label: string) => {
    if (!pattern.test(stdout)) throw new Error(`控制台无头冒烟断言失败（${label}）：${pattern}`);
  };
  expect(/HEADLESS=,\s*1/u, '无头声明返回 1');
  expect(/CMDLINE=,.*--headless/u, '启动命令行含 --headless');
  expect(/HANDLE=,\s*[1-9]\d*/u, '后台实例句柄有效');
  expect(/WAIT=,\s*1/u, '等待加载完成');
  expect(/TITLE=,.*Example Domain/u, '执行JS取回真实页面标题');
  return { projectDir, executable };
}

async function smokeDesignerResourceCompile() {
  const projectDir = path.join(repoRoot, '.lingbuilder-build', `fbro-headless-window-smoke-${process.pid}`);
  const project: LingWindowProject = {
    id: 'fbro-headless-window-smoke',
    name: 'FBro 无头窗口资源冒烟',
    windows: [baseWindow('main-window', 'MainWindow', '无头资源冒烟')],
    resources: [{
      id: 'fbro-headless-1', type: 'FBroHeadlessBrowser', name: '无头浏览器1',
      ownerWindowId: 'main-window', url: 'https://example.com/', cacheDir: '.fbro-headless-smoke', extraInfoJson: ''
    }]
  };
  const sourceCode = [
    '类 MainWindow',
    '    事件 _MainWindow_创建完毕()',
    '        FBro_绑定事件(无头浏览器1, "LoadEnd", &加载完成)',
    '    结束',
    '    公开 空 加载完成()',
    '        调试输出("HEADLESS-TITLE=", FBro_取标题(无头浏览器1))',
    '    结束',
    '结束类'
  ].join('\n');
  const { generated } = await buildProject({ projectDir, project, sourceCode, consoleMode: false });
  const mainCpp = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  for (const marker of ['g_lingFbroHeadlessBaked = true', 'FBro_创建无头资源()', 'LB_FBro_CreateBackground', '\\"headless\\":true']) {
    if (!mainCpp.includes(marker)) throw new Error(`窗口资源冒烟生成代码缺少 ${marker}`);
  }
  return { projectDir };
}

async function main() {
  const buildOnly = process.argv.includes('--build-only');
  const designer = await smokeDesignerResourceCompile();
  console.log('[designer-resource] compile ok:', JSON.stringify(designer));
  if (buildOnly) return;
  const consoleResult = await smokeConsoleHeadless();
  console.log('[console-headless] run ok:', JSON.stringify(consoleResult));
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
