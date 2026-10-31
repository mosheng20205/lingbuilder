// 一键导出 datagrid-thread-demo（DataGrid 多线程读写与勾选批量删除示例）为可分享的 .lcpppkg 源码包。
// 用法：cd electron && npx tsx scripts/tmp-export-datagrid-thread-demo-package.ts
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const workspaceRoot = repositoryRoot;
const projectId = 'datagrid-thread-demo';
const outputRoot = path.join(workspaceRoot, 'docs', '示例源码包');
const packageName = 'DataGrid多线程勾选批量删除示例.lcpppkg';

function builtin(moduleId: string): InstalledModule {
  const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
  if (!manifest) throw new Error(`缺少内置模块：${moduleId}`);
  return { manifest, installPath: `builtin://${moduleId}`, isBuiltin: true, isInstalled: true, isEnabledForProject: true, diagnostics: [] };
}

async function readEnabledModuleIds(): Promise<string[]> {
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

async function validateWorkspace() {
  const solutionText = await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), 'utf8');
  const solution = JSON.parse(solutionText) as { projects: SolutionProject[] };
  const project = solution.projects.find(item => item.id === projectId);
  if (!project) throw new Error(`工作区缺少项目：${projectId}`);

  const sourceRoot = path.join(workspaceRoot, project.sourceRoot);
  const lcppFiles = await collectLcppSources(sourceRoot);
  if (lcppFiles.length === 0) throw new Error(`项目 ${project.name} 没有任何 .lcpp 源文件。`);

  const designerPath = path.join(workspaceRoot, project.designerPath);
  const designerProject = JSON.parse(await fs.readFile(designerPath, 'utf8')) as LingWindowProject;
  const enabledModules = (await readEnabledModuleIds()).map(builtin);
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

async function exportAndVerifyPackage() {
  const validation = await validateWorkspace();
  await fs.mkdir(outputRoot, { recursive: true });
  const exportPath = path.join(outputRoot, packageName);
  const service = createLcppSourcePackageService(workspaceRoot);
  const ideVersion = '0.8.39';
  const exported = await service.exportProject(validation.project.id, exportPath, ideVersion);
  const preview = await service.inspectPackage(exportPath);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-datagrid-thread-import-'));
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
  const sumsPath = path.join(outputRoot, 'DataGrid多线程勾选批量删除示例-SHA256SUMS.txt');
  await fs.writeFile(sumsPath, `${preview.packageSha256}  ${packageName}\n`, 'utf8');
  return {
    exportPath,
    sha256: preview.packageSha256,
    sizeBytes: (await fs.stat(exportPath)).size,
    files: preview.manifest.files.length
  };
}

exportAndVerifyPackage()
  .then(result => {
    console.log(JSON.stringify({ ok: true, ...result }, null, 2));
  })
  .catch(error => {
    console.error(error instanceof Error ? error.stack || error.message : error);
    process.exit(1);
  });
