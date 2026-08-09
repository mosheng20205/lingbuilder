import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { detectNestedWorkspaceArtifacts, isNestedWorkspaceArtifactPath, type NestedWorkspaceArtifactPlan } from './nestedWorkspaceGuard';

const execFileAsync = promisify(execFile);

export const LCPP_SOURCE_PACKAGE_EXTENSION = '.lcpppkg';
export const LCPP_SOURCE_PACKAGE_KIND = 'lingbuilder-lcpp-source-package';
export const LCPP_SOURCE_PACKAGE_MANIFEST = 'lingbuilder-source-package.json';

const PACKAGE_SCHEMA_VERSION = 2;
const LEGACY_PACKAGE_SCHEMA_VERSION = 1;
const MINIMUM_GENERATOR_VERSION = '0.2.5';
// Keep package compatibility checks inside the desktop package boundary. This
// must match the desktop generator version and cannot import renderer services.
const CURRENT_GENERATOR_VERSION = '0.3.0';
const LIST_VIEW_STRUCTURED_ROWS_MINIMUM_GENERATOR_VERSION = '0.2.7';
const EDGEVIEW_SAFE_API_MINIMUM_GENERATOR_VERSION = '0.2.7';
const EDGEVIEW_SAFE_API_V2_MINIMUM_GENERATOR_VERSION = '0.2.7';
const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024;
const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_FILE_COUNT = 50_000;
const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';

export const LCPP_GENERATOR_CAPABILITIES = {
  listViewAdvancedApi: 'win32.listview.advanced-api.v1',
  listViewStructuredRows: 'win32.listview.structured-rows.v1',
  dataGridV1: 'win32.datagrid.v1',
  edgeViewSafeApiV1: 'edgeview.safe-api.v1',
  edgeViewSafeApiV2: 'edgeview.safe-api.v2'
} as const;

const SUPPORTED_GENERATOR_CAPABILITIES = new Set<string>(Object.values(LCPP_GENERATOR_CAPABILITIES));
const GENERATOR_CAPABILITY_LABELS: Record<string, string> = {
  [LCPP_GENERATOR_CAPABILITIES.listViewAdvancedApi]: 'Win32 ListView 高级接口（列、状态、分组和布局）',
  [LCPP_GENERATOR_CAPABILITIES.listViewStructuredRows]: 'Win32 ListView 类型化行与行集合',
  [LCPP_GENERATOR_CAPABILITIES.dataGridV1]: 'Win32 数据表格 v1（强类型列、虚拟数据和单元格交互）',
  [LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV1]: 'EdgeView WebView2 安全 API v1（受管任务、设置、会话、下载、查找、打印与资源控制）',
  [LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV2]: 'EdgeView WebView2 双基线安全 API v2（受管对象、Frame、Worker、扩展、通知和安全决策）'
};
const LIST_VIEW_DATA_COMMANDS = new Set([
  '列表视图_添加行', '列表视图_插入行', '列表视图_删除行', '列表视图_设置单元格', '列表视图_取单元格',
  '列表视图_取行数', '列表视图_批量添加行', '列表视图_开始批量更新', '列表视图_结束批量更新', '列表视图_排序',
  '列表视图_取最后单击列', '列表视图_取虚拟模式', '列表视图_设置虚拟行数', '列表视图_设置虚拟行'
]);
const LIST_VIEW_STRUCTURED_ROW_COMMANDS = new Set(['列表视图_创建行', '列表视图_创建行集合']);
const LIST_VIEW_COMMAND_PATTERN = /列表视图_[\p{L}\p{N}_]+\s*\(/gu;
const DATA_GRID_COMMAND_PATTERN = /表格_[\p{L}\p{N}_]+\s*\(/gu;
const EDGEVIEW_SAFE_COMMAND_PATTERN = /EdgeView(?:任务|导航|脚本|设置|会话|下载|查找|打印|媒体|开发者工具|资源|事件)_[\p{L}\p{N}_]+\s*\(/gu;
const EDGEVIEW_SAFE_V2_COMMAND_PATTERN = /EdgeView(?:创建选项|对象|框架|工作线程|扩展|权限|通知|缓冲|安全)_[\p{L}\p{N}_]+\s*\(/gu;

interface PortableSolutionProject {
  id: string;
  name: string;
  type: 'visual-cpp' | 'external-msbuild' | 'external-cmake';
  sourceRoot: string;
  configRoot: string;
  designerPath: string;
  isDefault?: boolean;
  references?: string[];
  projectFile?: string;
  buildProperties?: unknown;
}

interface PortableSolution {
  schemaVersion: 2;
  id: string;
  name: string;
  startupProjectId: string;
  startupProjectIds: string[];
  projects: PortableSolutionProject[];
}

interface PortableProjectModules {
  schemaVersion: 1;
  enabledModuleIds: string[];
  pinnedVersions: Record<string, string>;
}

interface PortableModuleManifest {
  schemaVersion: 2;
  id: string;
  name: string;
  version: string;
  minLingBuilderVersion?: string;
  targets?: unknown[];
  bindings?: { commands?: unknown[] };
  contributes?: { commands?: unknown[]; designerControls?: unknown[]; types?: unknown[]; snippets?: unknown[] };
}

interface PortableInstalledModule {
  manifest: PortableModuleManifest;
  installPath: string;
}

export interface LcppSourcePackageFile {
  path: string;
  size: number;
  sha256: string;
}

export interface LcppSourcePackageModuleRequirement {
  projectId: string;
  id: string;
  name: string;
  version: string;
  builtin: boolean;
  bundled: boolean;
}

export interface LcppSourcePackageManifest {
  schemaVersion: 2;
  kind: typeof LCPP_SOURCE_PACKAGE_KIND;
  createdAt: string;
  createdBy: { product: 'LingBuilder'; version: string };
  sourceSolution: { id: string; name: string };
  startupProjectId: string;
  minimumGeneratorVersion: string;
  requiredCapabilities: string[];
  projects: Array<{ id: string; name: string; sourceRoot: string; configRoot: string; designerPath: string }>;
  modules: LcppSourcePackageModuleRequirement[];
  bundledSupportModuleIds: string[];
  files: LcppSourcePackageFile[];
  excludedSensitiveFiles: string[];
}

export interface LcppSourcePackageExportResult {
  ok: true;
  packagePath: string;
  manifest: LcppSourcePackageManifest;
  fileCount: number;
  totalBytes: number;
  lcppFileCount: number;
  warnings: string[];
}

export interface LcppSourcePackagePreview {
  manifest: LcppSourcePackageManifest;
  packagePath: string;
  packageSha256: string;
  totalBytes: number;
  warnings: string[];
}

export interface LcppSourcePackageImportResult extends LcppSourcePackagePreview {
  ok: true;
  workspacePath: string;
  solutionEntryPath: string;
}

interface CopyBudget {
  files: number;
  bytes: number;
  copiedPaths: Map<string, string>;
  excludedSensitiveFiles: string[];
}

interface ExtractedPackage {
  temporaryRoot: string;
  workspaceRoot: string;
  preview: LcppSourcePackagePreview;
}

export class LcppSourcePackageService {
  constructor(private readonly workspaceRoot: string) {}

  async exportProject(projectId: string, requestedTargetPath: string, ideVersion = '0.1.0'): Promise<LcppSourcePackageExportResult> {
    const solution = await readSolution(this.workspaceRoot);
    const selectedProject = solution.projects.find(project => project.id === projectId);
    if (!selectedProject) throw new Error(`未找到要分享的项目：${projectId}`);
    const projects = getProjectBuildOrder(solution, selectedProject.id);
    const unsupported = projects.find(project => project.type !== 'visual-cpp');
    if (unsupported) throw new Error(`项目 ${unsupported.name} 是外部工程，当前 LCPP 源码包只支持 LingBuilder 可视 C++ 项目。`);

    const targetPath = normalizePackageTargetPath(requestedTargetPath);
    const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-export-'));
    const stagedWorkspace = path.join(temporaryRoot, 'package', 'workspace');
    const packageRoot = path.dirname(stagedWorkspace);
    const warnings: string[] = [];
    const budget: CopyBudget = { files: 0, bytes: 0, copiedPaths: new Map(), excludedSensitiveFiles: [] };

    try {
      await fs.mkdir(stagedWorkspace, { recursive: true });
      const portableSolution = createPortableSolution(solution, projects, selectedProject.id);
      const requiredCapabilities = await collectRequiredGeneratorCapabilities(this.workspaceRoot, projects);
      const installedModules = await readInstalledModules(this.workspaceRoot);
      const moduleRequirements: LcppSourcePackageModuleRequirement[] = [];
      const bundledModules = new Map<string, PortableInstalledModule>();
      const moduleMinimumGeneratorVersions: string[] = [MINIMUM_GENERATOR_VERSION];

      for (const project of projects) {
        const sourceRoot = resolveWithin(this.workspaceRoot, normalizeRelativePath(project.sourceRoot));
        const nestedWorkspacePlan = await detectNestedWorkspaceArtifacts(sourceRoot);
        await this.copyRequiredProjectPath(project.sourceRoot, stagedWorkspace, budget, true, nestedWorkspacePlan);
        if (nestedWorkspacePlan.detected) {
          warnings.push(`已排除项目“${project.name}”源码目录中误创建的嵌套 LingBuilder 工作区。`);
        }
        await this.copyRequiredProjectPath(project.configRoot, stagedWorkspace, budget, false);
        await this.copyRequiredProjectPath(project.designerPath, stagedWorkspace, budget, false);
        const assetRoot = project.isDefault ? 'assets' : `assets/${safePathSegment(project.id)}`;
        await this.copyRequiredProjectPath(assetRoot, stagedWorkspace, budget, false);

        const refs = await readProjectModules(this.workspaceRoot, project.id);
        const refsPath = project.id === DEFAULT_PROJECT_ID
          ? '.lingbuilder/project-modules.json'
          : `.lingbuilder/projects/${project.id}/project-modules.json`;
        await writeJson(path.join(stagedWorkspace, refsPath), refs);

        for (const moduleId of refs.enabledModuleIds) {
          const module = installedModules.get(moduleId);
          const builtin = !module;
          if (builtin && !moduleId.startsWith('lingbuilder.')) {
            throw new Error(`项目 ${project.name} 启用了第三方模块 ${moduleId}，但工作区中找不到其安装目录，无法生成可无缝打开的源码包。`);
          }
          moduleRequirements.push({
            projectId: project.id,
            id: moduleId,
            name: module?.manifest.name || moduleId,
            version: module?.manifest.version || refs.pinnedVersions[moduleId] || '*',
            builtin,
            bundled: !builtin
          });
          if (module?.manifest.minLingBuilderVersion) moduleMinimumGeneratorVersions.push(module.manifest.minLingBuilderVersion);
          if (module) bundledModules.set(module.manifest.id, module);
        }

      }

      const requiredModuleIds = new Set(moduleRequirements.map(requirement => requirement.id));
      for (const module of installedModules.values()) {
        if (isRequiredSupportAssetModule(module, requiredModuleIds)) bundledModules.set(module.manifest.id, module);
      }

      for (const module of bundledModules.values()) {
        if (!path.isAbsolute(module.installPath)) throw new Error(`模块 ${module.manifest.id} 没有可复制的安装目录。`);
        await this.copyAbsoluteTree(module.installPath, `.lingbuilder/modules/${module.manifest.id}`, stagedWorkspace, budget, false);
      }

      await this.copyRequiredProjectPath('.lingbuilder/build-configuration.json', stagedWorkspace, budget, false);
      await writeJson(path.join(stagedWorkspace, '.lingbuilder', 'solution.json'), portableSolution);
      await writePortableSolutionEntry(stagedWorkspace, portableSolution);

      const workspaceFiles = await describeFiles(stagedWorkspace);
      const lcppFileCount = workspaceFiles.filter(file => file.path.toLowerCase().endsWith('.lcpp')).length;
      const totalBytes = workspaceFiles.reduce((sum, file) => sum + file.size, 0);
      if (lcppFileCount === 0) throw new Error('当前项目及其依赖项目中没有可分享的 .lcpp 源文件。');
      if (workspaceFiles.length > MAX_FILE_COUNT || totalBytes > MAX_EXTRACTED_BYTES) {
        throw new Error('源码包内容超出允许的文件数量或总大小限制。');
      }
      if (budget.excludedSensitiveFiles.length > 0) {
        warnings.push(`已排除 ${budget.excludedSensitiveFiles.length} 个疑似凭据或私钥文件。`);
      }

      const capabilityMinimumGeneratorVersion = requiredCapabilities.includes(LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV2)
        ? EDGEVIEW_SAFE_API_V2_MINIMUM_GENERATOR_VERSION
        : requiredCapabilities.includes(LCPP_GENERATOR_CAPABILITIES.listViewStructuredRows)
          ? LIST_VIEW_STRUCTURED_ROWS_MINIMUM_GENERATOR_VERSION
          : requiredCapabilities.includes(LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV1)
            ? EDGEVIEW_SAFE_API_MINIMUM_GENERATOR_VERSION : MINIMUM_GENERATOR_VERSION;
      const manifest: LcppSourcePackageManifest = {
        schemaVersion: PACKAGE_SCHEMA_VERSION,
        kind: LCPP_SOURCE_PACKAGE_KIND,
        createdAt: new Date().toISOString(),
        createdBy: { product: 'LingBuilder', version: ideVersion },
        sourceSolution: { id: solution.id, name: solution.name },
        startupProjectId: selectedProject.id,
        minimumGeneratorVersion: maxGeneratorVersion([
          capabilityMinimumGeneratorVersion,
          ...moduleMinimumGeneratorVersions
        ]),
        requiredCapabilities,
        projects: projects.map(project => ({
          id: project.id,
          name: project.name,
          sourceRoot: project.sourceRoot,
          configRoot: project.configRoot,
          designerPath: project.designerPath
        })),
        modules: moduleRequirements,
        bundledSupportModuleIds: [...bundledModules.keys()].filter(id => !moduleRequirements.some(item => item.id === id)).sort(),
        files: workspaceFiles,
        excludedSensitiveFiles: budget.excludedSensitiveFiles.sort()
      };
      await writeJson(path.join(packageRoot, LCPP_SOURCE_PACKAGE_MANIFEST), manifest);
      await compressDirectory(packageRoot, targetPath);
      const stat = await fs.stat(targetPath);
      if (stat.size > MAX_PACKAGE_BYTES) {
        await fs.rm(targetPath, { force: true });
        throw new Error('生成的 LCPP 源码包超过 1GB 限制。请移除不必要的大型资源后重试。');
      }
      return {
        ok: true,
        packagePath: targetPath,
        manifest,
        fileCount: workspaceFiles.length,
        totalBytes,
        lcppFileCount,
        warnings
      };
    } finally {
      await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }

  async inspectPackage(packagePath: string): Promise<LcppSourcePackagePreview> {
    const extracted = await extractAndValidatePackage(packagePath);
    try {
      return extracted.preview;
    } finally {
      await fs.rm(extracted.temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }

  async importPackage(packagePath: string, destinationParent: string): Promise<LcppSourcePackageImportResult> {
    const extracted = await extractAndValidatePackage(packagePath);
    let temporaryDestination = '';
    try {
      await fs.mkdir(destinationParent, { recursive: true });
      const baseName = safeFileName(extracted.preview.manifest.projects.find(project => project.id === extracted.preview.manifest.startupProjectId)?.name
        || extracted.preview.manifest.sourceSolution.name
        || 'LCPP源码');
      const workspacePath = await uniqueDirectoryPath(destinationParent, baseName);
      temporaryDestination = `${workspacePath}.importing-${crypto.randomUUID()}`;
      await fs.cp(extracted.workspaceRoot, temporaryDestination, { recursive: true, errorOnExist: true });
      await fs.rename(temporaryDestination, workspacePath);
      temporaryDestination = '';

      const solution = JSON.parse(await fs.readFile(path.join(workspacePath, '.lingbuilder', 'solution.json'), 'utf8')) as PortableSolution;
      const solutionEntryPath = await writePortableSolutionEntry(workspacePath, solution);
      await writeJson(path.join(workspacePath, '.lingbuilder', 'source-package-import.json'), {
        schemaVersion: 1,
        packageName: path.basename(packagePath),
        packageSha256: extracted.preview.packageSha256,
        importedAt: new Date().toISOString()
      });
      return { ...extracted.preview, ok: true, workspacePath, solutionEntryPath };
    } finally {
      if (temporaryDestination) {
        await fs.rm(temporaryDestination, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
      }
      await fs.rm(extracted.temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    }
  }

  private async copyRequiredProjectPath(
    relativePath: string,
    stagedWorkspace: string,
    budget: CopyBudget,
    required: boolean,
    nestedWorkspacePlan?: NestedWorkspaceArtifactPlan
  ): Promise<void> {
    const normalized = normalizeRelativePath(relativePath);
    const source = resolveWithin(this.workspaceRoot, normalized);
    if (!await exists(source)) {
      if (required) throw new Error(`项目源码目录不存在：${normalized}`);
      return;
    }
    await this.copyAbsoluteTree(source, normalized, stagedWorkspace, budget, true, nestedWorkspacePlan);
  }

  private async copyAbsoluteTree(
    source: string,
    destinationRelativePath: string,
    stagedWorkspace: string,
    budget: CopyBudget,
    skipBuildDirectories = true,
    nestedWorkspacePlan?: NestedWorkspaceArtifactPlan
  ): Promise<void> {
    const realWorkspace = await fs.realpath(this.workspaceRoot);
    const realSource = await fs.realpath(source);
    if (!isWithin(realWorkspace, realSource)) throw new Error(`分享文件路径超出工作区：${source}`);
    await copyTree(realSource, resolveWithin(stagedWorkspace, destinationRelativePath), stagedWorkspace, budget, skipBuildDirectories, nestedWorkspacePlan);
  }
}

export function createLcppSourcePackageService(workspaceRoot: string): LcppSourcePackageService {
  return new LcppSourcePackageService(path.resolve(workspaceRoot));
}

export function isLcppSourcePackagePath(value: string): boolean {
  return String(value || '').toLowerCase().endsWith(LCPP_SOURCE_PACKAGE_EXTENSION);
}

/**
 * Resolve the user-facing export target without allowing the package to leave
 * the workspace's portable `exports` directory.
 */
export function resolveProjectSourcePackagePath(workspaceRoot: string, requestedPath: string, fallbackName: string): string {
  const exportRoot = path.join(path.resolve(workspaceRoot), 'exports');
  const requestedName = path.basename(String(requestedPath || '').trim());
  const fallback = safeFileName(fallbackName);
  const safeName = safeFileName(requestedName || fallback);
  const fileName = isLcppSourcePackagePath(safeName) ? safeName : `${safeName}${LCPP_SOURCE_PACKAGE_EXTENSION}`;
  return path.join(exportRoot, fileName);
}

function createPortableSolution(solution: PortableSolution, projects: PortableSolutionProject[], startupProjectId: string): PortableSolution {
  const includedIds = new Set(projects.map(project => project.id));
  return {
    schemaVersion: 2,
    id: solution.id,
    name: solution.name,
    startupProjectId,
    startupProjectIds: [startupProjectId],
    projects: projects.map(project => ({
      ...project,
      references: (project.references || []).filter(id => includedIds.has(id))
    }))
  };
}

function isSupportAssetModule(module: PortableInstalledModule): boolean {
  const contributes = module.manifest.contributes;
  return (module.manifest.targets?.length || 0) === 0
    && (module.manifest.bindings?.commands?.length || 0) === 0
    && (contributes?.commands?.length || 0) === 0
    && (contributes?.designerControls?.length || 0) === 0
    && (contributes?.types?.length || 0) === 0
    && (contributes?.snippets?.length || 0) === 0;
}

function isRequiredSupportAssetModule(module: PortableInstalledModule, requiredModuleIds: ReadonlySet<string>): boolean {
  if (!isSupportAssetModule(module)) return false;
  const consumers: Record<string, readonly string[]> = {
    'lingbuilder.cef3.sdk': ['lingbuilder.cef3.browser'],
    'lingbuilder.fbro.sdk': ['lingbuilder.fbro.browser'],
    'lingbuilder.crypto.sdk': [
      'lingbuilder.crypto.hash',
      'lingbuilder.crypto.password',
      'lingbuilder.crypto.symmetric',
      'lingbuilder.crypto.asymmetric'
    ],
    'lingbuilder.opencv.sdk': ['lingbuilder.opencv']
  };
  const knownConsumers = consumers[module.manifest.id];
  if (knownConsumers) return knownConsumers.some(moduleId => requiredModuleIds.has(moduleId));
  return requiredModuleIds.has(module.manifest.id);
}

async function readSolution(workspaceRoot: string): Promise<PortableSolution> {
  const solutionPath = path.join(path.resolve(workspaceRoot), '.lingbuilder', 'solution.json');
  const solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as PortableSolution;
  if (solution.schemaVersion !== 2 || !Array.isArray(solution.projects) || solution.projects.length === 0) {
    throw new Error('当前工作区没有有效的 LingBuilder v2 解决方案。');
  }
  return solution;
}

function getProjectBuildOrder(solution: PortableSolution, projectId: string): PortableSolutionProject[] {
  const projectsById = new Map(solution.projects.map(project => [project.id, project]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: PortableSolutionProject[] = [];
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`项目引用存在循环，不能生成可移植源码包：${id}`);
    const project = projectsById.get(id);
    if (!project) throw new Error(`项目引用缺失：${id}`);
    visiting.add(id);
    for (const dependencyId of project.references || []) visit(dependencyId);
    visiting.delete(id);
    visited.add(id);
    ordered.push(project);
  };
  visit(projectId);
  return ordered;
}

async function readProjectModules(workspaceRoot: string, projectId: string): Promise<PortableProjectModules> {
  const relativePath = projectId === DEFAULT_PROJECT_ID
    ? '.lingbuilder/project-modules.json'
    : `.lingbuilder/projects/${projectId}/project-modules.json`;
  try {
    const parsed = JSON.parse(await fs.readFile(resolveWithin(workspaceRoot, relativePath), 'utf8')) as Partial<PortableProjectModules>;
    const enabledModuleIds = Array.isArray(parsed.enabledModuleIds)
      ? [...new Set(parsed.enabledModuleIds.filter((id): id is string => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{2,80}$/u.test(id)))]
      : [];
    if (!enabledModuleIds.includes('lingbuilder.win32.basic')) enabledModuleIds.unshift('lingbuilder.win32.basic');
    const pins = parsed.pinnedVersions && typeof parsed.pinnedVersions === 'object' ? parsed.pinnedVersions : {};
    return {
      schemaVersion: 1,
      enabledModuleIds,
      pinnedVersions: Object.fromEntries(enabledModuleIds.map(id => [id, typeof pins[id] === 'string' ? pins[id] : '*']))
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error(`项目模块引用不是合法 JSON：${relativePath}`);
    return { schemaVersion: 1, enabledModuleIds: ['lingbuilder.win32.basic'], pinnedVersions: { 'lingbuilder.win32.basic': '1.0.0' } };
  }
}

async function readInstalledModules(workspaceRoot: string): Promise<Map<string, PortableInstalledModule>> {
  const result = new Map<string, PortableInstalledModule>();
  const modulesRoot = path.join(path.resolve(workspaceRoot), '.lingbuilder', 'modules');
  if (!await exists(modulesRoot)) return result;
  for (const entry of await fs.readdir(modulesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const installPath = path.join(modulesRoot, entry.name);
    const manifestPath = path.join(installPath, 'lingbuilder.module.json');
    try {
      const manifest = validatePortableModuleManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')));
      if (entry.name !== manifest.id) continue;
      result.set(manifest.id, { manifest, installPath });
    } catch {
      // 未启用或损坏的安装目录不会进入源码包；已启用时会被当作缺失模块处理。
    }
  }
  return result;
}

function validatePortableModuleManifest(value: unknown): PortableModuleManifest {
  if (!value || typeof value !== 'object') throw new Error('模块清单无效。');
  const manifest = value as PortableModuleManifest;
  if (manifest.schemaVersion !== 2 || !/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(manifest.id)
    || typeof manifest.name !== 'string' || !manifest.name.trim()
    || typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error('模块清单缺少稳定 ID、名称或版本。');
  }
  return manifest;
}

async function writePortableSolutionEntry(workspaceRoot: string, solution: PortableSolution): Promise<string> {
  const baseName = safeFileName(solution.name || 'LingBuilder');
  let targetPath = path.join(workspaceRoot, `${baseName}.lbsln`);
  let suffix = 2;
  while (await exists(targetPath)) {
    try {
      const parsed = JSON.parse(await fs.readFile(targetPath, 'utf8')) as { kind?: unknown; solutionFile?: unknown };
      if (parsed.kind === 'lingbuilder-solution' && parsed.solutionFile === '.lingbuilder/solution.json') break;
    } catch {
      // 名称冲突时选择新文件名，不覆盖用户文件。
    }
    targetPath = path.join(workspaceRoot, `${baseName}-${suffix++}.lbsln`);
  }
  await writeJson(targetPath, {
    schemaVersion: 1,
    kind: 'lingbuilder-solution',
    id: solution.id,
    name: solution.name,
    solutionFile: '.lingbuilder/solution.json',
    startupProjectId: solution.startupProjectId,
    startupProjectIds: solution.startupProjectIds,
    projects: solution.projects.map(project => ({
      id: project.id,
      name: project.name,
      type: project.type,
      sourceRoot: project.sourceRoot,
      ...(project.projectFile ? { projectFile: project.projectFile } : {}),
      references: project.references || []
    }))
  });
  return targetPath;
}

async function copyTree(
  source: string,
  destination: string,
  stagedWorkspace: string,
  budget: CopyBudget,
  skipBuildDirectories: boolean,
  nestedWorkspacePlan?: NestedWorkspaceArtifactPlan
): Promise<void> {
  if (nestedWorkspacePlan && isNestedWorkspaceArtifactPath(source, nestedWorkspacePlan)) return;
  const stat = await fs.lstat(source);
  if (stat.isSymbolicLink()) throw new Error(`源码包不允许包含符号链接：${source}`);
  if (stat.isDirectory()) {
    if (skipBuildDirectories && shouldSkipDirectory(path.basename(source))) return;
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      await copyTree(path.join(source, entry.name), path.join(destination, entry.name), stagedWorkspace, budget, skipBuildDirectories, nestedWorkspacePlan);
    }
    return;
  }
  if (!stat.isFile()) throw new Error(`源码包只允许包含普通文件：${source}`);
  const relativeDestination = normalizeRelativePath(path.relative(stagedWorkspace, destination));
  if (isSensitiveFile(relativeDestination)) {
    if (!budget.excludedSensitiveFiles.includes(relativeDestination)) budget.excludedSensitiveFiles.push(relativeDestination);
    return;
  }
  if (stat.size > MAX_FILE_BYTES) throw new Error(`文件超过 512MB 限制：${relativeDestination}`);
  const existingSource = budget.copiedPaths.get(relativeDestination.toLowerCase());
  if (existingSource) {
    if (path.resolve(existingSource) !== path.resolve(source)) throw new Error(`源码包目标路径冲突：${relativeDestination}`);
    return;
  }
  budget.files += 1;
  budget.bytes += stat.size;
  if (budget.files > MAX_FILE_COUNT) throw new Error(`源码包文件数量超过 ${MAX_FILE_COUNT} 个限制。`);
  if (budget.bytes > MAX_EXTRACTED_BYTES) throw new Error('源码包内容超过 2GB 限制。');
  budget.copiedPaths.set(relativeDestination.toLowerCase(), source);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function describeFiles(root: string): Promise<LcppSourcePackageFile[]> {
  const files: LcppSourcePackageFile[] = [];
  await walkFiles(root, async (absolutePath, relativePath, stat) => {
    files.push({ path: relativePath, size: Number(stat.size), sha256: await hashFile(absolutePath) });
  });
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function extractAndValidatePackage(packagePath: string): Promise<ExtractedPackage> {
  const source = await fs.realpath(path.resolve(packagePath));
  const stat = await fs.stat(source);
  if (!stat.isFile()) throw new Error('LCPP 源码包不是普通文件。');
  if (!isLcppSourcePackagePath(source)) throw new Error(`源码包扩展名必须是 ${LCPP_SOURCE_PACKAGE_EXTENSION}。`);
  if (stat.size > MAX_PACKAGE_BYTES) throw new Error('LCPP 源码包超过 1GB 限制。');
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lcpp-import-'));
  try {
    await expandArchive(source, temporaryRoot);
    const rootEntries = (await fs.readdir(temporaryRoot)).sort();
    if (rootEntries.some(entry => entry !== LCPP_SOURCE_PACKAGE_MANIFEST && entry !== 'workspace')) {
      throw new Error('源码包根目录包含未声明内容。');
    }
    const rawManifest = JSON.parse(await fs.readFile(path.join(temporaryRoot, LCPP_SOURCE_PACKAGE_MANIFEST), 'utf8')) as { schemaVersion?: unknown };
    const legacyPackage = rawManifest.schemaVersion === LEGACY_PACKAGE_SCHEMA_VERSION;
    const manifest = validatePackageManifest(rawManifest);
    const workspaceRoot = path.join(temporaryRoot, 'workspace');
    const actualFiles = await describeFiles(workspaceRoot);
    const expected = new Map(manifest.files.map(file => [file.path.toLowerCase(), file]));
    if (expected.size !== manifest.files.length) throw new Error('源码包清单包含重复文件路径。');
    if (actualFiles.length !== manifest.files.length) throw new Error('源码包文件数量与完整性清单不一致。');
    let totalBytes = 0;
    for (const actual of actualFiles) {
      const declared = expected.get(actual.path.toLowerCase());
      if (!declared || declared.path !== actual.path || declared.size !== actual.size || declared.sha256 !== actual.sha256) {
        throw new Error(`源码包文件完整性校验失败：${actual.path}`);
      }
      totalBytes += actual.size;
    }
    if (totalBytes > MAX_EXTRACTED_BYTES) throw new Error('源码包解压内容超过 2GB 限制。');
    const solutionPath = path.join(workspaceRoot, '.lingbuilder', 'solution.json');
    const solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as PortableSolution;
    if (solution.schemaVersion !== 2 || !solution.projects.some(project => project.id === manifest.startupProjectId)) {
      throw new Error('源码包中的 LingBuilder 解决方案状态无效。');
    }
    const compatibilityManifest = legacyPackage
      ? {
        ...manifest,
        requiredCapabilities: await collectRequiredGeneratorCapabilities(workspaceRoot, solution.projects),
        minimumGeneratorVersion: MINIMUM_GENERATOR_VERSION
      }
      : manifest;
    validateRequiredGeneratorCapabilities(compatibilityManifest);
    validateMinimumGeneratorVersion(compatibilityManifest);
    const moduleWarnings = await validateModuleAvailability(compatibilityManifest, workspaceRoot);
    const warnings = compatibilityManifest.excludedSensitiveFiles.length > 0
      ? [`导出方已排除 ${manifest.excludedSensitiveFiles.length} 个疑似敏感文件。`]
      : [];
    warnings.push(...moduleWarnings);
    return {
      temporaryRoot,
      workspaceRoot,
      preview: {
        manifest: compatibilityManifest,
        packagePath: source,
        packageSha256: await hashFile(source),
        totalBytes,
        warnings
      }
    };
  } catch (error) {
    await fs.rm(temporaryRoot, { recursive: true, force: true, maxRetries: 20, retryDelay: 250 });
    throw error;
  }
}

function validatePackageManifest(value: unknown): LcppSourcePackageManifest {
  if (!value || typeof value !== 'object') throw new Error('LCPP 源码包清单不是有效对象。');
  const manifest = value as LcppSourcePackageManifest;
  const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
  if (![LEGACY_PACKAGE_SCHEMA_VERSION, PACKAGE_SCHEMA_VERSION].includes(schemaVersion as number) || manifest.kind !== LCPP_SOURCE_PACKAGE_KIND) {
    throw new Error('LCPP 源码包格式版本不受支持。');
  }
  if (!manifest.sourceSolution || typeof manifest.sourceSolution.name !== 'string') throw new Error('源码包缺少解决方案信息。');
  if (typeof manifest.startupProjectId !== 'string' || !manifest.startupProjectId) throw new Error('源码包缺少启动项目。');
  const minimumGeneratorVersion = schemaVersion === LEGACY_PACKAGE_SCHEMA_VERSION
    ? MINIMUM_GENERATOR_VERSION
    : manifest.minimumGeneratorVersion;
  if (typeof minimumGeneratorVersion !== 'string' || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(minimumGeneratorVersion)) {
    throw new Error('源码包缺少有效的最低生成器版本。');
  }
  const requiredCapabilities = schemaVersion === LEGACY_PACKAGE_SCHEMA_VERSION ? [] : manifest.requiredCapabilities;
  if (!Array.isArray(requiredCapabilities)
    || requiredCapabilities.length > 100
    || requiredCapabilities.some(capability => typeof capability !== 'string' || !/^[a-z0-9][a-z0-9.-]{2,100}$/u.test(capability))) {
    throw new Error('源码包所需生成器能力清单无效。');
  }
  if (!Array.isArray(manifest.projects) || manifest.projects.length === 0 || manifest.projects.length > 100) throw new Error('源码包项目清单无效。');
  if (!Array.isArray(manifest.modules) || manifest.modules.length > 1000) throw new Error('源码包模块清单无效。');
  if (!Array.isArray(manifest.files) || manifest.files.length === 0 || manifest.files.length > MAX_FILE_COUNT) throw new Error('源码包文件清单无效。');
  if (!Array.isArray(manifest.excludedSensitiveFiles)) throw new Error('源码包敏感文件摘要无效。');
  for (const file of manifest.files) {
    if (normalizeRelativePath(file.path) !== file.path || !Number.isInteger(file.size) || file.size < 0 || file.size > MAX_FILE_BYTES || !/^[a-f0-9]{64}$/u.test(file.sha256)) {
      throw new Error(`源码包文件记录无效：${String(file?.path || '')}`);
    }
  }
  return {
    ...manifest,
    schemaVersion: PACKAGE_SCHEMA_VERSION,
    minimumGeneratorVersion,
    requiredCapabilities
  };
}

function validateRequiredGeneratorCapabilities(manifest: LcppSourcePackageManifest): void {
  const unsupported = [...new Set(manifest.requiredCapabilities)].filter(capability => !SUPPORTED_GENERATOR_CAPABILITIES.has(capability));
  if (unsupported.length === 0) return;
  const details = unsupported.map(capability => GENERATOR_CAPABILITY_LABELS[capability] || capability).join('、');
  throw new Error(`当前 LingBuilder 生成器不支持此源码包所需能力：${details}。请升级到 ${manifest.minimumGeneratorVersion} 或更新版本后再导入。`);
}

function validateMinimumGeneratorVersion(manifest: LcppSourcePackageManifest): void {
  if (compareGeneratorVersions(CURRENT_GENERATOR_VERSION, manifest.minimumGeneratorVersion) < 0) {
    throw new Error(`当前 LingBuilder 版本为 ${CURRENT_GENERATOR_VERSION}，此源码包至少需要 ${manifest.minimumGeneratorVersion}。请升级 IDE 后再导入。`);
  }
}

function maxGeneratorVersion(versions: readonly string[]): string {
  return versions.reduce((maximum, candidate) => (
    compareGeneratorVersions(candidate, maximum) > 0 ? candidate : maximum
  ), MINIMUM_GENERATOR_VERSION);
}

function compareGeneratorVersions(left: string, right: string): number {
  const parse = (value: string) => value.split('-', 1)[0].split('.').map(part => Number.parseInt(part, 10) || 0);
  const leftParts = parse(left);
  const rightParts = parse(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  const leftPrerelease = left.includes('-');
  const rightPrerelease = right.includes('-');
  if (leftPrerelease === rightPrerelease) return 0;
  return leftPrerelease ? -1 : 1;
}

async function collectRequiredGeneratorCapabilities(
  workspaceRoot: string,
  projects: PortableSolutionProject[]
): Promise<string[]> {
  const required = new Set<string>();
  for (const project of projects) {
    const sourceRoot = resolveWithin(workspaceRoot, project.sourceRoot);
    const nestedWorkspacePlan = await detectNestedWorkspaceArtifacts(sourceRoot);
    for (const source of await collectLcppSources(sourceRoot, nestedWorkspacePlan)) {
      const sourceCode = await fs.readFile(source, 'utf8');
      const commands = [...sourceCode.matchAll(LIST_VIEW_COMMAND_PATTERN)].map(match => match[0].replace(/\s*\($/u, ''));
      if (commands.some(command => !LIST_VIEW_DATA_COMMANDS.has(command) && !LIST_VIEW_STRUCTURED_ROW_COMMANDS.has(command))) {
        required.add(LCPP_GENERATOR_CAPABILITIES.listViewAdvancedApi);
      }
      if (commands.some(command => LIST_VIEW_STRUCTURED_ROW_COMMANDS.has(command))) {
        required.add(LCPP_GENERATOR_CAPABILITIES.listViewStructuredRows);
      }
      if (DATA_GRID_COMMAND_PATTERN.test(sourceCode)) required.add(LCPP_GENERATOR_CAPABILITIES.dataGridV1);
      DATA_GRID_COMMAND_PATTERN.lastIndex = 0;
      if (EDGEVIEW_SAFE_COMMAND_PATTERN.test(sourceCode)) required.add(LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV1);
      EDGEVIEW_SAFE_COMMAND_PATTERN.lastIndex = 0;
      if (EDGEVIEW_SAFE_V2_COMMAND_PATTERN.test(sourceCode)) required.add(LCPP_GENERATOR_CAPABILITIES.edgeViewSafeApiV2);
      EDGEVIEW_SAFE_V2_COMMAND_PATTERN.lastIndex = 0;
    }
    try {
      const designerPath = resolveWithin(workspaceRoot, project.designerPath);
      const designerText = await fs.readFile(designerPath, 'utf8');
      if (/"type"\s*:\s*"DataGrid"|"nativeAdapter"\s*:\s*"lingbuilder-datagrid"/u.test(designerText)) {
        required.add(LCPP_GENERATOR_CAPABILITIES.dataGridV1);
      }
    } catch {
      // 没有设计器文件的纯源码项目继续按源码命令检测。
    }
  }
  return [...required].sort();
}

async function collectLcppSources(root: string, nestedWorkspacePlan?: NestedWorkspaceArtifactPlan): Promise<string[]> {
  if (nestedWorkspacePlan && isNestedWorkspaceArtifactPath(root, nestedWorkspacePlan)) return [];
  const stat = await fs.stat(root);
  if (stat.isFile()) return root.toLowerCase().endsWith('.lcpp') ? [root] : [];
  if (!stat.isDirectory()) return [];
  const result: string[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await collectLcppSources(child, nestedWorkspacePlan));
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.lcpp')) result.push(child);
  }
  return result;
}

async function validateModuleAvailability(manifest: LcppSourcePackageManifest, workspaceRoot: string): Promise<string[]> {
  const warnings: string[] = [];
  for (const requirement of manifest.modules) {
    if (requirement.builtin) {
      continue;
    }
    const bundledManifest = path.join(workspaceRoot, '.lingbuilder', 'modules', requirement.id, 'lingbuilder.module.json');
    if (!isWithin(path.resolve(workspaceRoot), path.resolve(bundledManifest))) throw new Error(`模块路径无效：${requirement.id}`);
    if (!await exists(bundledManifest)) throw new Error(`源码包缺少第三方模块：${requirement.name} (${requirement.id})。`);
  }
  return warnings;
}

async function walkFiles(root: string, visit: (absolutePath: string, relativePath: string, stat: Awaited<ReturnType<typeof fs.lstat>>) => Promise<void>): Promise<void> {
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('源码包 workspace 目录无效。');
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const stat = await fs.lstat(absolutePath);
      if (stat.isSymbolicLink()) throw new Error(`源码包包含不允许的符号链接：${path.relative(root, absolutePath)}`);
      if (stat.isDirectory()) await walk(absolutePath);
      else if (stat.isFile()) await visit(absolutePath, normalizeRelativePath(path.relative(root, absolutePath)), stat);
      else throw new Error(`源码包包含不支持的文件类型：${path.relative(root, absolutePath)}`);
    }
  };
  await walk(root);
}

async function compressDirectory(sourceDirectory: string, targetPath: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('当前源码包压缩实现仅支持 Windows。');
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryZip = `${targetPath}.${crypto.randomUUID()}.zip`;
  try {
    const script = '$ErrorActionPreference = "Stop"; Compress-Archive -Path (Join-Path $env:LINGBUILDER_LCPPPKG_SOURCE "*") -DestinationPath $env:LINGBUILDER_LCPPPKG_DESTINATION -CompressionLevel Optimal -Force';
    await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        LINGBUILDER_LCPPPKG_SOURCE: sourceDirectory,
        LINGBUILDER_LCPPPKG_DESTINATION: temporaryZip
      }
    });
    await fs.rm(targetPath, { force: true });
    await fs.rename(temporaryZip, targetPath);
  } finally {
    await fs.rm(temporaryZip, { force: true });
  }
}

async function expandArchive(sourcePackage: string, destination: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('当前源码包解压实现仅支持 Windows。');
  const temporaryZip = path.join(path.dirname(destination), `${crypto.randomUUID()}.zip`);
  try {
    await fs.copyFile(sourcePackage, temporaryZip);
    const script = [
      '$ErrorActionPreference = "Stop";',
      'Add-Type -AssemblyName System.IO.Compression.FileSystem;',
      '$source = $env:LINGBUILDER_LCPPPKG_SOURCE;',
      '$destination = $env:LINGBUILDER_LCPPPKG_DESTINATION;',
      '$maxFiles = [int]$env:LINGBUILDER_LCPPPKG_MAX_FILES;',
      '$maxFileBytes = [long]$env:LINGBUILDER_LCPPPKG_MAX_FILE_BYTES;',
      '$maxTotalBytes = [long]$env:LINGBUILDER_LCPPPKG_MAX_TOTAL_BYTES;',
      '$root = [IO.Path]::GetFullPath($destination + [IO.Path]::DirectorySeparatorChar);',
      '$archive = [IO.Compression.ZipFile]::OpenRead($source);',
      'try {',
      '$count = 0; [long]$total = 0;',
      'foreach ($entry in $archive.Entries) {',
      '$count++; if ($count -gt $maxFiles) { throw "源码包文件数量超过限制。" };',
      '$name = $entry.FullName.Replace("\\", "/");',
      'if ([string]::IsNullOrWhiteSpace($name) -or $name.StartsWith("/") -or $name -match "^[A-Za-z]:" -or ($name.Split("/") -contains "..")) { throw "源码包包含不安全路径：$name" };',
      '$target = [IO.Path]::GetFullPath([IO.Path]::Combine($root, $name.Replace([char]47, [IO.Path]::DirectorySeparatorChar)));',
      'if (-not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { throw "源码包路径越界：$name" };',
      'if ([string]::IsNullOrEmpty($entry.Name)) { continue };',
      'if ($entry.Length -gt $maxFileBytes) { throw "源码包单文件超过限制：$name" };',
      '$total += $entry.Length; if ($total -gt $maxTotalBytes) { throw "源码包解压内容超过限制。" };',
      '}',
      '} finally { $archive.Dispose() };',
      '[IO.Compression.ZipFile]::ExtractToDirectory($source, $destination)'
    ].join(' ');
    await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
      env: {
        ...process.env,
        LINGBUILDER_LCPPPKG_SOURCE: temporaryZip,
        LINGBUILDER_LCPPPKG_DESTINATION: destination,
        LINGBUILDER_LCPPPKG_MAX_FILES: String(MAX_FILE_COUNT + 10),
        LINGBUILDER_LCPPPKG_MAX_FILE_BYTES: String(MAX_FILE_BYTES),
        LINGBUILDER_LCPPPKG_MAX_TOTAL_BYTES: String(MAX_EXTRACTED_BYTES)
      }
    });
  } finally {
    await fs.rm(temporaryZip, { force: true });
  }
}

function normalizePackageTargetPath(value: string): string {
  const requested = path.resolve(String(value || '').trim());
  if (!String(value || '').trim()) throw new Error('请选择 LCPP 源码包保存位置。');
  return isLcppSourcePackagePath(requested) ? requested : `${requested}${LCPP_SOURCE_PACKAGE_EXTENSION}`;
}

function normalizeRelativePath(value: string): string {
  const normalized = String(value || '').replace(/\\/gu, '/').replace(/^\.\//u, '');
  if (!normalized || path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/u.test(normalized) || normalized.includes('\0') || normalized.split('/').some(part => !part || part === '..')) {
    throw new Error(`源码包路径无效：${value}`);
  }
  return normalized;
}

function resolveWithin(root: string, relativePath: string): string {
  const normalized = normalizeRelativePath(relativePath);
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, normalized);
  if (!isWithin(resolvedRoot, target)) throw new Error(`路径超出工作区：${relativePath}`);
  return target;
}

function isWithin(root: string, target: string): boolean {
  return target === root || target.startsWith(`${root}${path.sep}`);
}

function shouldSkipDirectory(name: string): boolean {
  return [
    '.git', '.svn', '.hg', 'node_modules', '.lingbuilder-build', 'generated', 'dist', 'release',
    '.cache', 'cache', 'browser-cache', 'browser-data', 'profiles', 'user-data', 'userdata',
    'local storage', 'localstorage', 'session storage', 'sessionstorage', 'indexeddb'
  ].includes(name.toLowerCase());
}

function isSensitiveFile(relativePath: string): boolean {
  const name = path.posix.basename(relativePath).toLowerCase();
  return /^\.env(?:\..+)?$/u.test(name)
    || /^(?:id_rsa|id_ed25519)(?:\.pub)?$/u.test(name)
    || /\.(?:pem|pfx|p12|key|kdbx)$/u.test(name)
    || /^(?:credentials?|secrets?|tokens?)(?:[._-].*)?\.json$/u.test(name)
    || /^(?:.*[._-])?cookies?(?:[._-].*)?\.json$/u.test(name);
}

function safeFileName(value: string): string {
  return String(value || '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, '-')
    .replace(/[. ]+$/gu, '')
    .trim()
    .slice(0, 80) || 'LCPP源码';
}

function safePathSegment(value: string): string {
  return String(value || '').replace(/[^a-zA-Z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'project';
}

async function uniqueDirectoryPath(parent: string, baseName: string): Promise<string> {
  let candidate = path.join(parent, baseName);
  let suffix = 2;
  while (await exists(candidate) || await exists(`${candidate}.importing`)) candidate = path.join(parent, `${baseName} ${suffix++}`);
  return candidate;
}

async function writeJson(targetPath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, JSON.stringify(value, null, 2), 'utf8');
}

async function hashFile(targetPath: string): Promise<string> {
  return crypto.createHash('sha256').update(await fs.readFile(targetPath)).digest('hex');
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
