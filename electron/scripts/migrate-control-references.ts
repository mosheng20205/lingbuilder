import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BUILTIN_MODULES } from '../src/services/modules/builtinModules';
import { validateModuleManifest } from '../src/services/modules/manifest';
import type { InstalledModule, LingBuilderModuleManifest, LingCppModuleContext } from '../src/services/modules/types';
import {
  getLingCppControlReferences,
  migrateQuotedControlReferences
} from '../src/services/lingCpp/controlReferenceService';
import type { LingWindowProject } from '../src/services/windowDesigner/types';

interface SolutionProject {
  id: string;
  sourceRoot: string;
  designerPath?: string;
  designerProject?: LingWindowProject;
  recursive?: boolean;
}

interface SolutionFile {
  projects?: SolutionProject[];
}

interface BuildRequestDocument {
  filePath: string;
  request: Record<string, unknown> & {
    project: LingWindowProject;
    lingCppSourceCode: string;
    lingCppSourceFilePath?: string;
  };
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..', '..');
const writeChanges = process.argv.includes('--write');

async function main(): Promise<void> {
  process.stdout.write(`controlRef 迁移模式：${writeChanges ? '写入' : '只读审计'}。\n`);
  const solution = JSON.parse(await fs.readFile(path.join(workspaceRoot, '.lingbuilder', 'solution.json'), 'utf8')) as SolutionFile;
  const moduleContext = await loadModuleContext();
  const projects = await loadProjects(await includeDiscoveredProjects(solution.projects || []));
  const sourceFiles = await collectSourceFiles(projects);
  let resolvedQuotedCount = 0;
  let referenceCount = 0;
  let resolvedReferenceCount = 0;
  let changedFileCount = 0;
  const unresolved: string[] = [];

  for (const filePath of sourceFiles) {
    const owner = selectOwnerProject(filePath, projects);
    if (!owner?.designerProject) continue;
    const source = await fs.readFile(filePath, 'utf8');
    const relativePath = normalizeRelative(filePath);
    const references = getLingCppControlReferences(source, owner.designerProject, moduleContext, relativePath);
    referenceCount += references.length;
    resolvedReferenceCount += references.filter(reference => reference.status === 'resolved').length;
    references.filter(reference => reference.status !== 'resolved').forEach(reference => {
      unresolved.push(`${relativePath}:${reference.range.startLine} ${reference.canonicalCommandName}/${reference.parameter.name} -> ${reference.status} (${reference.rawText})`);
    });
    const migrated = migrateQuotedControlReferences(source, owner.designerProject, moduleContext, relativePath);
    if (!migrated.changeCount) continue;
    resolvedQuotedCount += migrated.changeCount;
    changedFileCount += 1;
    if (writeChanges) await fs.writeFile(filePath, migrated.source, 'utf8');
    process.stdout.write(`${writeChanges ? '已迁移' : '待迁移'} ${relativePath}: ${migrated.changeCount}\n`);
  }

  for (const document of await loadBuildRequestDocuments()) {
    const sourceFilePath = document.request.lingCppSourceFilePath || path.basename(document.filePath, '.json');
    const relativeSourcePath = normalizeRelative(path.resolve(path.dirname(document.filePath), sourceFilePath));
    const references = getLingCppControlReferences(
      document.request.lingCppSourceCode,
      document.request.project,
      moduleContext,
      relativeSourcePath
    );
    references.filter(reference => reference.quoted && reference.status !== 'resolved').forEach(reference => {
      unresolved.push(`${normalizeRelative(document.filePath)}:${reference.range.startLine} 嵌入源码 ${reference.canonicalCommandName}/${reference.parameter.name} -> ${reference.status} (${reference.rawText})`);
    });
    const migrated = migrateQuotedControlReferences(
      document.request.lingCppSourceCode,
      document.request.project,
      moduleContext,
      relativeSourcePath
    );
    if (!migrated.changeCount) continue;
    resolvedQuotedCount += migrated.changeCount;
    changedFileCount += 1;
    if (writeChanges) {
      document.request.lingCppSourceCode = migrated.source;
      await fs.writeFile(document.filePath, `${JSON.stringify(document.request, null, 2)}\n`, 'utf8');
    }
    process.stdout.write(`${writeChanges ? '已迁移' : '待迁移'} ${normalizeRelative(document.filePath)} 嵌入源码: ${migrated.changeCount}\n`);
  }

  if (unresolved.length) {
    process.stdout.write(`无法解析的 controlRef（需修复设计器对象、类型或作用域）: ${unresolved.length}\n${unresolved.join('\n')}\n`);
    process.exitCode = 1;
  }
  process.stdout.write(`controlRef 审计完成：${sourceFiles.length} 个源码文件，${referenceCount} 个引用（${resolvedReferenceCount} 个已解析），${changedFileCount} 个文件、${resolvedQuotedCount} 个可安全迁移引用。\n`);
  if (!writeChanges && resolvedQuotedCount > 0) process.exitCode = 1;
}

async function loadBuildRequestDocuments(): Promise<BuildRequestDocument[]> {
  const documents: BuildRequestDocument[] = [];
  for (const filePath of await findWorkspaceFiles('build-request.json', false, true)) {
    try {
      const request = JSON.parse(await fs.readFile(filePath, 'utf8')) as BuildRequestDocument['request'];
      if (!request.project || typeof request.lingCppSourceCode !== 'string') continue;
      documents.push({ filePath, request });
    } catch {
      // build-request 的格式诊断由对应 smoke 测试负责。
    }
  }
  return documents;
}

async function loadProjects(projects: SolutionProject[]): Promise<Array<SolutionProject & { sourceRoot: string; designerProject?: LingWindowProject }>> {
  const loaded = await Promise.all(projects.map(async project => {
    const sourceRoot = path.resolve(workspaceRoot, project.sourceRoot);
    if (project.designerProject) return { ...project, sourceRoot };
    if (!project.designerPath) return { ...project, sourceRoot };
    try {
      const designerProject = JSON.parse(await fs.readFile(path.resolve(workspaceRoot, project.designerPath), 'utf8')) as LingWindowProject;
      return { ...project, sourceRoot, designerProject };
    } catch (error) {
      process.stderr.write(`跳过无效设计器项目 ${project.id}: ${error instanceof Error ? error.message : String(error)}\n`);
      return { ...project, sourceRoot };
    }
  }));
  return loaded.sort((left, right) => right.sourceRoot.length - left.sourceRoot.length);
}

async function includeDiscoveredProjects(projects: SolutionProject[]): Promise<SolutionProject[]> {
  const result = new Map(projects.map(project => [normalizeProjectSourceRoot(project.sourceRoot), project]));
  const addProject = (project: SolutionProject) => {
    const key = normalizeProjectSourceRoot(project.sourceRoot);
    if (!result.has(key)) result.set(key, project);
  };
  const projectsRoot = path.join(workspaceRoot, '.lingbuilder', 'projects');
  try {
    for (const entry of await fs.readdir(projectsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const sourceRoot = entry.name.startsWith('module-demo-')
        ? `examples/module-demos/${entry.name.slice('module-demo-'.length)}/src`
        : `src/${entry.name}`;
      try {
        await fs.access(path.join(workspaceRoot, sourceRoot));
      } catch {
        continue;
      }
      addProject({
        id: entry.name,
        sourceRoot,
        designerPath: `.lingbuilder/projects/${entry.name}/window-designer.json`
      });
    }
  } catch {
    // 没有项目目录时仅使用解决方案清单。
  }

  for (const solutionPath of await findWorkspaceFiles('solution.json')) {
    if (path.resolve(solutionPath) === path.resolve(workspaceRoot, '.lingbuilder', 'solution.json')) continue;
    try {
      const portableSolution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as SolutionFile;
      const portableRoot = path.dirname(path.dirname(solutionPath));
      for (const project of portableSolution.projects || []) {
        const resolvedSourceRoot = path.resolve(portableRoot, project.sourceRoot);
        const resolvedDesignerPath = project.designerPath ? path.resolve(portableRoot, project.designerPath) : undefined;
        try {
          await fs.access(resolvedSourceRoot);
          if (resolvedDesignerPath) await fs.access(resolvedDesignerPath);
        } catch {
          continue;
        }
        addProject({
          ...project,
          id: `${project.id}@${path.basename(portableRoot)}-solution`,
          sourceRoot: path.relative(workspaceRoot, resolvedSourceRoot),
          designerPath: resolvedDesignerPath ? path.relative(workspaceRoot, resolvedDesignerPath) : undefined
        });
      }
    } catch {
      // 嵌套解决方案格式诊断由解决方案服务负责。
    }
  }

  for (const requestPath of await findWorkspaceFiles('build-request.json', false, true)) {
    try {
      const request = JSON.parse(await fs.readFile(requestPath, 'utf8')) as {
        project?: LingWindowProject;
        lingCppSourceFilePath?: string;
      };
      if (!request.project || !request.lingCppSourceFilePath) continue;
      const requestRoot = path.dirname(requestPath);
      const sourceFilePath = await resolveBuildRequestSourcePath(requestRoot, request.lingCppSourceFilePath);
      addProject({
        id: `${request.project.id}@build-request`,
        sourceRoot: path.relative(workspaceRoot, sourceFilePath),
        recursive: false,
        designerProject: request.project
      });
    } catch {
      // build-request 的格式诊断由对应 smoke 测试负责。
    }
  }

  for (const designerPath of await findWorkspaceFiles('window-designer.json')) {
    if (path.basename(path.dirname(designerPath)) !== '.lingbuilder') continue;
    const portableRoot = path.dirname(path.dirname(designerPath));
    try {
      await fs.access(path.join(portableRoot, '.lingbuilder', 'solution.json'));
      continue;
    } catch {
      // 没有解决方案清单时才使用单项目便携工作区回退。
    }
    const sourceRoot = path.join(portableRoot, 'src');
    try {
      await fs.access(sourceRoot);
      addProject({
        id: `${path.basename(portableRoot)}@portable`,
        sourceRoot: path.relative(workspaceRoot, sourceRoot),
        designerPath: path.relative(workspaceRoot, designerPath)
      });
    } catch {
      // 便携工作区没有源码目录时不参与迁移。
    }
  }

  for (const layoutPath of await findWorkspaceFiles('layout.json', true)) {
    const normalized = layoutPath.replace(/\\/gu, '/');
    const markerIndex = normalized.lastIndexOf('/generated/cpp/');
    if (markerIndex < 0) continue;
    const projectRoot = normalized.slice(0, markerIndex);
    const generatedProjectId = path.basename(path.dirname(layoutPath));
    const solutionProject = await findSolutionProject(projectRoot, generatedProjectId);
    const sourceRoot = path.join(projectRoot, solutionProject?.sourceRoot || 'src');
    try {
      await fs.access(sourceRoot);
      addProject({
        id: `${path.basename(projectRoot)}@generated-layout`,
        sourceRoot: path.relative(workspaceRoot, sourceRoot),
        recursive: false,
        designerPath: path.relative(workspaceRoot, layoutPath)
      });
    } catch {
      // 仅把仍有直接源码目录的导出布局加入安全迁移。
    }
  }

  return [...result.values()];
}

function normalizeProjectSourceRoot(sourceRoot: string): string {
  return path.resolve(workspaceRoot, sourceRoot).toLocaleLowerCase();
}

async function findWorkspaceFiles(fileName: string, includeGenerated = false, matchSuffix = false): Promise<string[]> {
  const output: string[] = [];
  await walkForFileName(workspaceRoot, fileName.toLocaleLowerCase(), output, includeGenerated, matchSuffix);
  return output.sort();
}

async function walkForFileName(current: string, fileName: string, output: string[], includeGenerated: boolean, matchSuffix: boolean): Promise<void> {
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (entry.name === '.git'
        || entry.name === '.lingbuilder-build'
        || entry.name === 'dist'
        || entry.name === 'node_modules'
        || entry.name === 'coverage'
        || entry.name === 'out'
        || entry.name === 'release'
        || entry.name.startsWith('release-')) continue;
      if (!includeGenerated && entry.name === 'generated') continue;
      await walkForFileName(path.join(current, entry.name), fileName, output, includeGenerated, matchSuffix);
      continue;
    }
    if (entry.isFile() && (matchSuffix
      ? entry.name.toLocaleLowerCase().endsWith(fileName)
      : entry.name.toLocaleLowerCase() === fileName)) output.push(path.join(current, entry.name));
  }
}

async function resolveBuildRequestSourcePath(requestRoot: string, sourceFilePath: string): Promise<string> {
  if (path.isAbsolute(sourceFilePath)) return sourceFilePath;
  const workspaceRelative = path.resolve(workspaceRoot, sourceFilePath);
  try {
    await fs.access(workspaceRelative);
    return workspaceRelative;
  } catch {
    return path.resolve(requestRoot, sourceFilePath);
  }
}

async function findSolutionProject(projectRoot: string, projectId: string): Promise<SolutionProject | undefined> {
  try {
    const solutionFile = (await fs.readdir(projectRoot, { withFileTypes: true }))
      .find(entry => entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.lbsln'));
    if (!solutionFile) return undefined;
    const solution = JSON.parse(await fs.readFile(path.join(projectRoot, solutionFile.name), 'utf8')) as SolutionFile;
    return solution.projects?.find(project => project.id === projectId);
  } catch {
    return undefined;
  }
}

async function loadModuleContext(): Promise<LingCppModuleContext> {
  const manifests: LingBuilderModuleManifest[] = [...BUILTIN_MODULES];
  const installedRoot = path.join(workspaceRoot, '.lingbuilder', 'modules');
  try {
    for (const entry of await fs.readdir(installedRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(installedRoot, entry.name, 'lingbuilder.module.json');
      try {
        const raw = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as unknown;
        const validated = validateModuleManifest(raw);
        if (validated.manifest && !manifests.some(item => item.id === validated.manifest!.id)) manifests.push(validated.manifest);
      } catch {
        // 清单门禁由模块测试报告；迁移器不会消费无效清单。
      }
    }
  } catch {
    // 没有安装第三方模块时仅使用内置清单。
  }
  const modules: InstalledModule[] = manifests.map(manifest => ({
    manifest,
    installPath: `audit://${manifest.id}`,
    isBuiltin: BUILTIN_MODULES.some(item => item.id === manifest.id),
    isInstalled: true,
    isEnabledForProject: true,
    diagnostics: []
  }));
  return { enabledModules: modules, availableModules: modules };
}

async function collectSourceFiles(projects: Array<SolutionProject & { sourceRoot: string }>): Promise<string[]> {
  const files = new Set<string>();
  for (const project of projects) await walk(project.sourceRoot, files, project.recursive !== false);
  return [...files].sort();
}

async function walk(current: string, output: Set<string>, recursive = true): Promise<void> {
  try {
    const stats = await fs.stat(current);
    if (stats.isFile()) {
      if (current.toLocaleLowerCase().endsWith('.lcpp')) output.add(path.resolve(current));
      return;
    }
  } catch {
    return;
  }
  let entries: Dirent<string>[];
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name === '.lingbuilder-build' || entry.name === 'generated' || entry.name === 'node_modules') continue;
    const fullPath = path.join(current, entry.name);
    if (entry.isDirectory() && recursive) await walk(fullPath, output, true);
    else if (entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.lcpp')) output.add(path.resolve(fullPath));
  }
}

function selectOwnerProject(
  filePath: string,
  projects: Array<SolutionProject & { sourceRoot: string; designerProject?: LingWindowProject }>
): (SolutionProject & { sourceRoot: string; designerProject?: LingWindowProject }) | undefined {
  const resolved = path.resolve(filePath);
  return projects.find(project => resolved === project.sourceRoot
    || (project.recursive !== false && resolved.startsWith(`${project.sourceRoot}${path.sep}`)));
}

function normalizeRelative(filePath: string): string {
  return path.relative(workspaceRoot, filePath).replace(/\\/gu, '/');
}

await main();
