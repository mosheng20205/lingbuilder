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
const projectId = 'new-emoji-fbro-tabs';
const buildDirectory = path.join(repoRoot, '.lingbuilder-build', 'new-emoji-fbro-tabs-native-smoke');
const delay = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

function builtin(id: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === id);
  if (!manifest) throw new Error(`缺少内置模块：${id}`);
  return {
    manifest,
    installPath: `builtin://${id}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function main() {
  const newEmojiInstallPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  const newEmojiManifest = JSON.parse(await fs.readFile(path.join(newEmojiInstallPath, 'lingbuilder.module.json'), 'utf8'));
  const enabledModules: InstalledModule[] = [
    builtin('lingbuilder.win32.basic'),
    {
      manifest: newEmojiManifest,
      installPath: newEmojiInstallPath,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    },
    builtin('lingbuilder.fbro.browser')
  ];
  const project = JSON.parse(await fs.readFile(
    path.join(repoRoot, '.lingbuilder', 'projects', projectId, 'window-designer.json'),
    'utf8'
  )) as LingWindowProject;
  const source = await fs.readFile(path.join(repoRoot, 'src', projectId, 'MainWindow.lcpp'), 'utf8');
  const generated = generateLingCppNativeWin32Project(project, { enabledModules, lingCppSourceCode: source });
  if (generated.blockingDiagnostics.length > 0) throw new Error(generated.blockingDiagnostics.join('\n'));

  await fs.rm(buildDirectory, { recursive: true, force: true });
  await fs.mkdir(buildDirectory, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(buildDirectory, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }
  const dependencyDiagnostics = await exportModuleNativeDependencies(enabledModules, buildDirectory);
  if (dependencyDiagnostics.length > 0) throw new Error(dependencyDiagnostics.join('\n'));
  const exported = await exportVisualStudioProject({
    projectDir: buildDirectory,
    projectId,
    generatedFiles: generated.files,
    enabledModules
  });
  const msbuild = 'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\MSBuild\\Current\\Bin\\MSBuild.exe';
  await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Release',
    '/p:Platform=x64',
    '/v:minimal'
  ], {
    cwd: buildDirectory,
    windowsHide: true,
    timeout: 10 * 60 * 1000,
    maxBuffer: 32 * 1024 * 1024
  });
  const executable = path.join(buildDirectory, 'x64', 'Release', 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);

  const runtime = spawn(executable, [], {
    cwd: path.dirname(executable),
    windowsHide: true,
    stdio: 'ignore'
  });
  await new Promise<void>((resolve, reject) => {
    runtime.once('spawn', resolve);
    runtime.once('error', reject);
  });
  if (!runtime.pid) throw new Error('原生运行烟雾测试未取得进程 ID。');

  let fbroProcessCount = 0;
  let rendererProcessCount = 0;
  try {
    await delay(10_000);
    if (runtime.exitCode !== null) {
      throw new Error(`原生程序提前退出，退出码：${runtime.exitCode}`);
    }
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\" | Select-Object ProcessId,CommandLine) | ConvertTo-Json -Compress`
    ], { windowsHide: true, timeout: 30_000 });
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const fbroProcesses = Array.isArray(parsed) ? parsed : [parsed];
    fbroProcessCount = fbroProcesses.length;
    rendererProcessCount = fbroProcesses.filter(item => String(item.CommandLine || '').includes('--type=renderer')).length;
    if (rendererProcessCount < 3) {
      throw new Error(`三个标签页未全部启动 FBro 渲染进程：检测到 ${rendererProcessCount} 个 renderer（总子进程 ${fbroProcessCount} 个）。`);
    }
  } finally {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `$children=@(Get-CimInstance Win32_Process -Filter \"ParentProcessId = ${runtime.pid} AND Name = 'FBroSubprocess.exe'\"); Stop-Process -Id ${runtime.pid} -Force -ErrorAction SilentlyContinue; $children | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
    ], { windowsHide: true, timeout: 30_000 }).catch(() => undefined);
  }

  console.log(JSON.stringify({ ok: true, buildDirectory, executable, fbroProcessCount, rendererProcessCount }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
