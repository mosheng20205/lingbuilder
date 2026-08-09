import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { exportModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const projectDir = path.join(repoRoot, '.lingbuilder-build', 'fbro-process-native-smoke');

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return { manifest, installPath: `builtin://${id}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function countHostProcesses(): Promise<number> {
  const command = "@(Get-CimInstance Win32_Process -Filter \"Name = 'LingBuilderFbroHost.exe'\").Count";
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', command], { windowsHide: true });
  return Number.parseInt(stdout.trim(), 10) || 0;
}

async function waitUntil(predicate: () => Promise<boolean>, timeoutMs: number, message: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(message);
}

async function copyDefaultIcon(): Promise<void> {
  const candidates = [
    path.join(repoRoot, 'image', 'lingbuilder-ide-icon-v2.ico'),
    path.join(repoRoot, 'electron', 'assets', 'lingbuilder-window.ico')
  ];
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      await fs.mkdir(path.join(projectDir, 'resources'), { recursive: true });
      await fs.copyFile(candidate, path.join(projectDir, 'resources', 'lingbuilder-app.ico'));
      return;
    } catch {
      // Try the next development resource path.
    }
  }
  throw new Error('多进程冒烟测试缺少 LingBuilder 默认窗口图标。');
}

async function main(): Promise<void> {
  const enabledModules = [builtin('lingbuilder.win32.basic'), builtin('lingbuilder.fbro.browser')];
  const project: LingWindowProject = {
    id: 'fbro-process-native-smoke', name: 'FBro 独立进程原生冒烟', windows: [{
      id: 'main-window', fileName: 'MainWindow.xml', className: 'MainWindow', title: 'FBro 独立进程冒烟',
      width: 720, height: 460, background: '#202124', description: '验证 FBro Host 多进程控制', controls: [
        {
          id: 'fbro-embedded', type: 'FBroBrowser', name: 'FBro嵌入浏览器', content: '', x: 16, y: 16,
          width: 660, height: 190, background: '#ffffff', foreground: '#000000', fontSize: 14,
          isEnabled: true, visibility: 'Visible',
          properties: { processMode: 'independent-embedded', url: 'https://example.com/?host=embedded', cacheDir: '', enableJs: true, enableDevTools: true, loadImages: true, proxyMode: 'system' },
          events: { Created: 'FBro嵌入浏览器_创建完成', Error: 'FBro嵌入浏览器_错误' }
        },
        {
          id: 'fbro-window', type: 'FBroBrowser', name: 'FBro窗口浏览器', content: '', x: 16, y: 225,
          width: 660, height: 190, background: '#ffffff', foreground: '#000000', fontSize: 14,
          isEnabled: true, visibility: 'Visible',
          properties: { processMode: 'independent-window', url: 'https://example.com/?host=window', cacheDir: '', enableJs: true, enableDevTools: true, loadImages: true, proxyMode: 'system' },
          events: { Created: 'FBro窗口浏览器_创建完成', Error: 'FBro窗口浏览器_错误' }
        }
      ]
    }]
  };
  const generated = generateLingCppNativeWin32Project(project, {
    enabledModules,
    lingCppSourceCode: [
      '类 MainWindow',
      '    事件 FBro嵌入浏览器_创建完成()',
      '        FBro_导航(FBro嵌入浏览器, "https://example.com/?command=navigate")',
      '        FBro_设置缩放级别(FBro嵌入浏览器, 0)',
      '        FBro_设置静音(FBro嵌入浏览器, 真)',
      '        调试输出(FBro_取进程状态(FBro嵌入浏览器), FBro_取进程ID(FBro嵌入浏览器), FBro_取调试端口(FBro嵌入浏览器))',
      '    结束',
      '    事件 FBro窗口浏览器_创建完成()',
      '        FBro_隐藏(FBro窗口浏览器)',
      '        FBro_显示(FBro窗口浏览器)',
      '        FBro_调整大小(FBro窗口浏览器, 640, 420)',
      '        调试输出(FBro_执行JS(FBro窗口浏览器, "document.title"))',
      '    结束',
      '    事件 FBro嵌入浏览器_错误()',
      '        调试输出(FBro_取最近错误(FBro嵌入浏览器))',
      '    结束',
      '    事件 FBro窗口浏览器_错误()',
      '        调试输出(FBro_取最近错误(FBro窗口浏览器))',
      '    结束',
      '结束类'
    ].join('\n')
  });
  if (generated.blockingDiagnostics.length) throw new Error(generated.blockingDiagnostics.join('\n'));
  if (!generated.files.find(file => file.relativePath === 'main.cpp')?.content.includes('LB_FBroProcess_RunHostIfRequested')) {
    throw new Error('生成结果未包含 FBro Host 入口。');
  }
  await fs.rm(projectDir, { recursive: true, force: true });
  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  await copyDefaultIcon();
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, projectDir);
  if (dependencyDiagnostics.length) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({ projectDir, projectId: project.id, generatedFiles: generated.files, enabledModules });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [exported.solutionPath, '/m', '/t:Build', '/p:Configuration=Release', '/p:Platform=x64', '/v:minimal'], {
    cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(projectDir, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  const before = await countHostProcesses();
  const runtime = spawn(executable, [], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore' });
  await new Promise<void>((resolve, reject) => { runtime.once('spawn', resolve); runtime.once('error', reject); });
  try {
    await waitUntil(async () => (await countHostProcesses()) >= before + 2, 30000, '未在 30 秒内启动两个 FBro 独立 Host 进程。');
    await new Promise(resolve => setTimeout(resolve, 3000));
    if (runtime.exitCode !== null) throw new Error(`主程序在独立 Host 运行期间异常退出，退出码：${runtime.exitCode}`);
  } finally {
    if (runtime.exitCode === null) runtime.kill();
    await waitUntil(async () => (await countHostProcesses()) <= before, 15000, '主程序退出后 FBro Host 进程未被 Job Object 回收。');
  }
  console.log(JSON.stringify({ ok: true, projectDir, executable, hosts: 2 }, null, 2));
}

void main();
