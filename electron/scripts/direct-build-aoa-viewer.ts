// aoa-viewer 直连构建：绕过已安装 LingBuilder（0.8.30）MCP 桥里过期的内置模块注册表
//（安装版 bundle 不认识 websocket.client 2.1.0 的 WS_发送文本到连接异步，build_run 会在
// 命令解析层阻断），改用工作区源码直接生成 C++ 工程 + msbuild 增量编译。
// 用法：cd electron && npx tsx scripts/direct-build-aoa-viewer.ts
// 布局与 MCP build_run 一致：.lingbuilder-build/aoa-viewer/x64/Debug/{sln,vcxproj,src,modules,bin}。
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import { exportVisualStudioProject } from '../src/services/windowDesigner/visualStudioProjectExporter';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const workspaceRoot = repositoryRoot;
const projectId = 'aoa-viewer';
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

  const generated = generateLingCppNativeWin32Project(designerProject, {
    activeWindowId: designerProject.windows[0]?.id,
    lingCppSources,
    enabledModules
  });
  if (generated.blockingDiagnostics.length > 0) {
    throw new Error(`阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }

  await fs.mkdir(projectDir, { recursive: true });
  for (const file of generated.files) {
    const target = path.join(projectDir, file.relativePath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, file.content, 'utf8');
  }

  const exported = await exportVisualStudioProject({
    projectDir,
    projectId,
    generatedFiles: generated.files,
    enabledModules
  });

  const vswhere = path.join(
    process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)',
    'Microsoft Visual Studio', 'Installer', 'vswhere.exe'
  );
  const { stdout } = await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.Component.MSBuild', '-property', 'installationPath']);
  const msbuild = path.join(stdout.trim().split(/\r?\n/)[0], 'MSBuild', 'Current', 'Bin', 'MSBuild.exe');

  await execFileAsync(msbuild, [
    exported.solutionPath,
    '/m',
    '/t:Build',
    '/p:Configuration=Debug',
    '/p:Platform=x64',
    // 官方 build.run 同款钉平：导出器 OutDir=工程目录\\x64\\Debug\\bin\\ 会嵌套两版，
    // 显式覆写到 <buildDir>\\bin\\（帧文件/查看器日志的既定目录）。
    `/p:OutDir=${path.join(projectDir, 'bin')}${path.sep}`,
    '/v:minimal'
  ], { cwd: projectDir, windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 32 * 1024 * 1024 });

  const binDir = path.join(projectDir, 'bin');
  const htmlSource = path.join(sourceRoot, 'mirrordesk.html');
  if (fsSync.existsSync(htmlSource)) {
    await fs.copyFile(htmlSource, path.join(binDir, 'mirrordesk.html'));
  }

  const executable = path.join(binDir, `${exported.projectName}.exe`);
  await fs.access(executable);
  console.log(`PASS x64 Debug 构建完成：${executable}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
