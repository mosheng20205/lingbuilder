import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const exampleRoot = path.join(repositoryRoot, 'AI 视频自主生产', '基础篇加餐', '20 SQLite数据库模块');
const outputRoot = path.join(exampleRoot, '分享包');
const packageName = 'SQLite教程20-数据库模块.lcpppkg';
const projectId = 'sqlite-full-demo';

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return {
    manifest,
    installPath: `builtin://${moduleId}`,
    isBuiltin: true,
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  };
}

async function readEnabledModuleIds(workspaceRoot: string): Promise<string[]> {
  const refsPath = path.join(workspaceRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json');
  const parsed = JSON.parse(await fs.readFile(refsPath, 'utf8')) as { enabledModuleIds?: string[] };
  const ids = Array.isArray(parsed.enabledModuleIds) ? parsed.enabledModuleIds : [];
  if (!ids.includes('lingbuilder.win32.basic')) ids.unshift('lingbuilder.win32.basic');
  return ids;
}

async function collectLcppSources(root: string): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await collectLcppSources(child));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lcpp')) result.push(child);
  }
  return result;
}

interface SolutionProject {
  id: string;
  name: string;
  sourceRoot: string;
  designerPath: string;
}

async function validateWorkspace(workspaceRoot: string) {
  const solutionText = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), 'utf8');
  const solution = JSON.parse(solutionText) as { startupProjectId: string; projects: SolutionProject[] };
  const project = solution.projects.find(item => item.id === solution.startupProjectId);
  if (!project) throw new Error(`工作区缺少启动项目：${workspaceRoot}`);

  const sourceRoot = path.join(workspaceRoot, project.sourceRoot);
  const lcppFiles = await collectLcppSources(sourceRoot);
  if (lcppFiles.length === 0) throw new Error(`项目 ${project.name} 没有任何 .lcpp 源文件。`);

  const designerPath = path.join(workspaceRoot, project.designerPath);
  const designerProject = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const enabledModules = (await readEnabledModuleIds(workspaceRoot)).map(builtin);
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
    throw new Error(`项目 ${project.name} 存在阻断诊断：\n${generated.blockingDiagnostics.join('\n')}`);
  }
  const generatedMain = generated.files.find(file => file.relativePath === 'main.cpp')?.content || '';
  if (!generatedMain) throw new Error(`项目 ${project.name} 未生成 main.cpp。`);
  if (generatedMain.includes('暂不支持的中文 C++ 语句')) {
    throw new Error(`项目 ${project.name} 仍包含被生成器降级的中文语句。`);
  }
  return { project, lcppFiles, designerPath };
}

async function exportAndVerifyPackage(workspaceRoot: string, ideVersion: string) {
  const validation = await validateWorkspace(workspaceRoot);
  await fs.mkdir(outputRoot, { recursive: true });
  const exportPath = path.join(outputRoot, packageName);
  const service = createLcppSourcePackageService(workspaceRoot);
  const exported = await service.exportProject(validation.project.id, exportPath, ideVersion);
  const preview = await service.inspectPackage(exportPath);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sqlite-tutorial-import-'));
  try {
    const imported = await service.importPackage(exportPath, importParent);
    await Promise.all([
      ...validation.lcppFiles.map(filePath => fs.access(path.join(
        imported.workspacePath,
        validation.project.sourceRoot,
        path.relative(path.join(workspaceRoot, validation.project.sourceRoot), filePath)
      ))),
      fs.access(path.join(imported.workspacePath, validation.project.designerPath)),
      fs.access(path.join(imported.workspacePath, '.lingbuilder/projects', validation.project.id, 'project-modules.json'))
    ]);
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }
  const sumsPath = path.join(outputRoot, 'SHA256SUMS.txt');
  await fs.writeFile(sumsPath, `${preview.packageSha256}  ${packageName}\n`, 'utf8');
  return {
    solution: validation.project.name,
    packagePath: exportPath,
    packageSha256: preview.packageSha256,
    packageBytes: (await fs.stat(exportPath)).size,
    sourceFiles: exported.lcppFileCount,
    packagedFiles: exported.fileCount,
    requiredCapabilities: preview.manifest.requiredCapabilities,
    minimumGeneratorVersion: preview.manifest.minimumGeneratorVersion,
    warnings: preview.warnings,
    sumsPath
  };
}

async function main() {
  const electronPackage = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'electron', 'package.json'), 'utf8')) as { version?: string };
  const ideVersion = electronPackage.version || '0.6.6';
  const result = await exportAndVerifyPackage(exampleRoot, ideVersion);
  console.log(JSON.stringify({ ok: true, ideVersion, result }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
