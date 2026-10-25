// dy-live-monitor 直连构建（临时探针）：复用 tmp-direct-build-douyin 的思路，
// 工作区在外部路径 T:\逆向\抖音\灵码，用工作区源码直接生成 C++ 工程 + msbuild 增量编译。
// 用法：cd electron && npx tsx scripts/tmp-direct-build-dy-live-monitor.ts
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { parseLingCpp } from '../src/services/lingCpp/parser';
import { materializeProjectDllDeclarationModules } from '../src/services/modules/projectDllMaterializeService';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const workspaceRoot = 'T:\\逆向\\抖音\\灵码';
const projectId = 'dy-live-monitor';
const projectDir = path.join(workspaceRoot, '.lingbuilder-build', projectId, 'x64', 'Debug');

function resolveModule(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (manifest) {
    return {
      manifest,
      installPath: `builtin://${moduleId}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: true,
      diagnostics: []
    };
  }
  const workspaceManifestPath = path.join(workspaceRoot, '.lingbuilder', 'modules', moduleId, 'lingbuilder.module.json');
  const workspaceManifest = JSON.parse(fsSync.readFileSync(workspaceManifestPath, 'utf8'));
  return {
    manifest: workspaceManifest,
    installPath: path.join(workspaceRoot, '.lingbuilder', 'modules', moduleId),
    isBuiltin: false,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function main() {
  const solution = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), 'utf8')) as {
    projects: Array<{ id: string; sourceRoot: string; designerPath: string }>;
  };
  const project = solution.projects.find(item => item.id === projectId);
  if (!project) throw new Error(`solution.json 缺少项目 ${projectId}`);

  const sourceRoot = path.join(workspaceRoot, project.sourceRoot);
  const lcppFiles: string[] = [];
  const collect = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const child = path.join(dir, entry.name);
      if (entry.isDirectory()) await collect(child);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lcpp')) lcppFiles.push(child);
    }
  };
  await collect(sourceRoot);

  const designerProject = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, project.designerPath), 'utf8')
  ) as LingWindowProject;
  const moduleRefs = JSON.parse(
    await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json'), 'utf8')
  ) as { enabledModuleIds?: string[] };
  const enabledModules = (moduleRefs.enabledModuleIds ?? []).map(resolveModule);

  const lingCppSources = [];
  for (const filePath of lcppFiles) {
    lingCppSources.push({
      filePath: path.relative(sourceRoot, filePath).replace(/\\/gu, '/'),
      sourceCode: await fs.readFile(filePath, 'utf8')
    });
  }
  console.log('源码文件：' + lingCppSources.map(item => item.filePath).join(', '));

  const generated = generateLingCppNativeWin32Project(designerProject, {
    activeWindowId: designerProject.windows[0]?.id,
    lingCppSources,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  for (const diag of generated.diagnostics ?? []) console.log('诊断：' + diag);

  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }

  const projectDllLibraries = lingCppSources.flatMap(source => parseLingCpp(source.sourceCode).program.dllLibraries ?? []);
  if (projectDllLibraries.length > 0) {
    const materialized = await materializeProjectDllDeclarationModules({
      dllLibraries: projectDllLibraries,
      sourceRootAbsolute: sourceRoot,
      buildDir: projectDir,
      sourceDir: projectDir,
      binDir: path.join(projectDir, 'bin'),
      exportDir: projectDir,
      machine: 'X64',
      logs: []
    });
    if (materialized.blocking.length > 0) {
      throw new Error(`DLL 声明物化阻断：\n${materialized.blocking.join('\n')}`);
    }
    for (const note of materialized.notes) console.log('物化：' + note);
  }

  const exported = await exportVisualStudioProject({
    projectDir,
    projectId,
    generatedFiles: generated.files,
    enabledModules
  });

  // 直连构建没有 IDE 的图标物化链路：手动把 IDE 图标放进生成工程期望的 resources/lingbuilder-app.ico。
  const iconTarget = path.join(projectDir, 'resources', 'lingbuilder-app.ico');
  await fs.mkdir(path.dirname(iconTarget), { recursive: true });
  await fs.copyFile('T:\\electron\\lingbuilder\\image\\lingbuilder-ide-icon-v2.ico', iconTarget);

  // 模块原生依赖物化（与 IDE build.run 同一条链路）：EdgeView 的 WebView2 SDK 必须落进
  // modules/lingbuilder.edgeview/{include,lib/x64}，否则 LNK1104。
  const depPlan = await materializeModuleNativeDependencies(enabledModules, {
    buildDir: projectDir,
    sourceDir: projectDir,
    binDir: path.join(projectDir, 'bin'),
    exportDir: projectDir,
    preferredTargetId: 'windows-msvc-x64'
  });
  if (depPlan.blockingDiagnostics.length > 0) {
    throw new Error(`原生依赖物化阻断：\n${depPlan.blockingDiagnostics.join('\n')}`);
  }
  for (const diag of depPlan.diagnostics) console.log('依赖：' + diag);

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio', 'Installer', 'vswhere.exe'
  );
  const { stdout } = await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-property', 'installationPath']);
  const msbuild = path.join(stdout.trim().split(/\r?\n/)[0], 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  try {
    await execFileAsync(msbuild, [
      exported.solutionPath,
      '/m',
      '/t:Build',
      '/p:Configuration=Debug',
      '/p:Platform=x64',
      `/p:OutDir=${path.join(projectDir, 'bin')}${path.sep}`,
      '/v:minimal'
    ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string };
    console.error('---- MSBUILD STDOUT ----\n' + (err.stdout ?? ''));
    console.error('---- MSBUILD STDERR ----\n' + (err.stderr ?? ''));
    throw error;
  }

  const executable = path.join(projectDir, 'bin', `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(`PASS x64 Debug 构建完成：${executable}`);
}

main().catch(error => {
  console.error(error instanceof Error ? (error.stack ?? error.message) : error);
  process.exitCode = 1;
});
