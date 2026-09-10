import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const collectionRoot = path.join(repositoryRoot, 'AI 视频自主生产', 'FBro 指纹浏览器合集');
const outputRoot = path.join(collectionRoot, '分享包');
const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';

interface EpisodeSpec {
  episode: string;
  workspaceRelative: string;
  packageName: string;
}

const episodes: EpisodeSpec[] = [
  { episode: '01', workspaceRelative: '01 FBro 入门/示例项目/fbro-ep01-embed', packageName: 'FBro教程01-入门.lcpppkg' },
  { episode: '02', workspaceRelative: '02 浏览器管理器/示例项目/fbro-ep02-manager', packageName: 'FBro教程02-浏览器管理器.lcpppkg' },
  { episode: '03', workspaceRelative: '03 会话隔离/示例项目/fbro-ep03-isolation', packageName: 'FBro教程03-会话隔离.lcpppkg' },
  { episode: '04', workspaceRelative: '04 指纹配置/示例项目/fbro-ep04-fingerprint', packageName: 'FBro教程04-指纹配置.lcpppkg' },
  { episode: '05', workspaceRelative: '05 三种宿主模式/示例项目/fbro-ep05-hostmode', packageName: 'FBro教程05-三种宿主模式.lcpppkg' },
  { episode: '06', workspaceRelative: '06 事件驱动/示例项目/fbro-ep06-events', packageName: 'FBro教程06-事件驱动.lcpppkg' },
  { episode: '07', workspaceRelative: '07 获取资源响应/示例项目/fbro-ep07-resource', packageName: 'FBro教程07-获取资源响应.lcpppkg' },
  { episode: '08', workspaceRelative: '08 CDP 自动化/示例项目/fbro-ep08-cdp', packageName: 'FBro教程08-CDP自动化.lcpppkg' },
  { episode: '09', workspaceRelative: '09 网页填表/示例项目/fbro-ep09-form', packageName: 'FBro教程09-网页填表.lcpppkg' },
  { episode: '10', workspaceRelative: '10 下载截图打印/示例项目/fbro-ep10-transfer', packageName: 'FBro教程10-下载截图打印.lcpppkg' },
  { episode: '11', workspaceRelative: '11 综合项目/示例项目/fbro-ep11-workbench', packageName: 'FBro教程11-综合项目.lcpppkg' },
  { episode: '12', workspaceRelative: '12 修改资源响应/示例项目/fbro-ep12-replace', packageName: 'FBro教程12-修改资源响应.lcpppkg' }
];

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

async function readEnabledModuleIds(workspaceRoot: string, projectId: string): Promise<string[]> {
  const refsPath = projectId === DEFAULT_PROJECT_ID
    ? path.join(workspaceRoot, '.lingbuilder', 'project-modules.json')
    : path.join(workspaceRoot, '.lingbuilder', 'projects', projectId, 'project-modules.json');
  const parsed = JSON.parse(await fs.readFile(refsPath, 'utf8')) as { enabledModuleIds?: string[] };
  const ids = Array.isArray(parsed.enabledModuleIds) ? parsed.enabledModuleIds : [];
  if (!ids.includes('lingbuilder.win32.basic')) ids.unshift('lingbuilder.win32.basic');
  return ids;
}

async function collectLcppSources(root: string): Promise<string[]> {
  const stat = await fs.stat(root);
  if (stat.isFile()) return root.toLowerCase().endsWith('.lcpp') ? [root] : [];
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
  const enabledModules = (await readEnabledModuleIds(workspaceRoot, project.id)).map(builtin);
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

async function exportAndVerifyPackage(spec: EpisodeSpec, workspaceRoot: string, ideVersion: string) {
  const validation = await validateWorkspace(workspaceRoot);
  const exportPath = path.join(outputRoot, spec.packageName);
  await fs.mkdir(outputRoot, { recursive: true });
  const service = createLcppSourcePackageService(workspaceRoot);
  const exported = await service.exportProject(validation.project.id, exportPath, ideVersion);
  const preview = await service.inspectPackage(exportPath);
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), `lingbuilder-fbro-tutorial-import-`));
  try {
    const imported = await service.importPackage(exportPath, importParent);
    await Promise.all([
      ...validation.lcppFiles.map(filePath => fs.access(path.join(
        imported.workspacePath,
        validation.project.sourceRoot,
        path.relative(path.join(workspaceRoot, validation.project.sourceRoot), filePath)
      ))),
      fs.access(path.join(imported.workspacePath, validation.project.designerPath)),
      fs.access(path.join(imported.workspacePath, validation.project.id === DEFAULT_PROJECT_ID
        ? '.lingbuilder/project-modules.json'
        : `.lingbuilder/projects/${validation.project.id}/project-modules.json`))
    ]);
  } finally {
    await fs.rm(importParent, { recursive: true, force: true });
  }
  return {
    episode: spec.episode,
    solution: validation.project.name,
    packagePath: exportPath,
    packageSha256: preview.packageSha256,
    packageBytes: (await fs.stat(exportPath)).size,
    sourceFiles: exported.lcppFileCount,
    packagedFiles: exported.fileCount,
    requiredCapabilities: preview.manifest.requiredCapabilities,
    minimumGeneratorVersion: preview.manifest.minimumGeneratorVersion,
    warnings: preview.warnings
  };
}

async function main() {
  const electronPackage = JSON.parse(await fs.readFile(path.join(repositoryRoot, 'electron', 'package.json'), 'utf8')) as { version?: string };
  const ideVersion = electronPackage.version || '0.6.5';
  const results: Array<Record<string, unknown>> = [];
  for (const spec of episodes) {
    const workspaceRoot = path.join(collectionRoot, spec.workspaceRelative);
    results.push(await exportAndVerifyPackage(spec, workspaceRoot, ideVersion));
  }
  console.log(JSON.stringify({ ok: true, ideVersion, outputRoot, count: results.length, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
