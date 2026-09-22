import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createLcppSourcePackageService } from '../electron/lcppSourcePackageService';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import type { InstalledModule } from '../src/services/modules/types';
import { generateLingCppNativeWin32Project } from '../src/services/windowDesigner/lingCppWin32Project';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
const collectionRoot = path.join(repositoryRoot, 'AI 视频自主生产', 'CEF3 浏览器模块合集');
const outputRoot = path.join(collectionRoot, '分享包');
const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';

interface EpisodeSpec {
  episode: string;
  workspaceRelative: string;
  packageName: string;
}

const episodes: EpisodeSpec[] = [
  { episode: '01', workspaceRelative: '01 CEF3 入门/示例项目/cef3-ep01-intro', packageName: 'CEF3教程01-入门.lcpppkg' },
  { episode: '02', workspaceRelative: '02 浏览器操作小项目/示例项目/cef3-ep02-browser-tool', packageName: 'CEF3教程02-浏览器操作小项目.lcpppkg' },
  { episode: '03', workspaceRelative: '03 事件驱动/示例项目/cef3-ep03-events', packageName: 'CEF3教程03-事件驱动.lcpppkg' },
  { episode: '04', workspaceRelative: '04 会话隔离/示例项目/cef3-ep04-session-isolation', packageName: 'CEF3教程04-会话隔离.lcpppkg' },
  { episode: '05', workspaceRelative: '05 代理与请求决策/示例项目/cef3-ep05-network-decision', packageName: 'CEF3教程05-代理与请求决策.lcpppkg' },
  { episode: '06', workspaceRelative: '06 获取网页资源响应/示例项目/cef3-ep06-resource-response', packageName: 'CEF3教程06-获取网页资源响应.lcpppkg' },
  { episode: '07', workspaceRelative: '07 资源加载生命周期/示例项目/cef3-ep07-resource-lifecycle', packageName: 'CEF3教程07-资源加载生命周期.lcpppkg' },
  { episode: '08', workspaceRelative: '08 下载打印查找/示例项目/cef3-ep08-transfer-find', packageName: 'CEF3教程08-下载打印查找.lcpppkg' },
  { episode: '09', workspaceRelative: '09 JavaScript DevTools 异步任务/示例项目/cef3-ep09-automation-devtools', packageName: 'CEF3教程09-JavaScript与DevTools异步任务.lcpppkg' },
  { episode: '11', workspaceRelative: '11 读取资源响应正文/示例项目/cef3-ep11-resource-body', packageName: 'CEF3教程11-读取资源响应正文.lcpppkg' },
  { episode: '12', workspaceRelative: '12 修改资源响应数据/示例项目/cef3-ep12-replace-response', packageName: 'CEF3教程12-修改资源响应数据.lcpppkg' },
  { episode: '13', workspaceRelative: '13 JS交互页面调用原生/示例项目/cef3-ep13-jsquery', packageName: 'CEF3教程13-JS交互页面调用原生.lcpppkg' }
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
  const importParent = await fs.mkdtemp(path.join(os.tmpdir(), `lingbuilder-cef3-tutorial-import-`));
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
  // 可选 --episodes=12,13：只重导指定集，避免既有分享包 SHA 发生无关变化。
  const filterArg = process.argv.find(arg => arg.startsWith('--episodes='));
  const filter = filterArg ? filterArg.slice('--episodes='.length).split(',').map(item => item.trim()) : [];
  const specs = filter.length ? episodes.filter(spec => filter.includes(spec.episode)) : episodes;
  if (filter.length && !specs.length) throw new Error(`--episodes 过滤没有命中任何集：${filter.join('、')}`);
  const results: Array<Record<string, unknown>> = [];
  for (const spec of specs) {
    const workspaceRoot = path.join(collectionRoot, spec.workspaceRelative);
    results.push(await exportAndVerifyPackage(spec, workspaceRoot, ideVersion));
  }
  console.log(JSON.stringify({ ok: true, ideVersion, outputRoot, count: results.length, results }, null, 2));
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
