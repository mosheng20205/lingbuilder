import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from './builtinModules';
import { validateModuleManifest, validateModuleManifestContents, validateModuleRelativePath } from './manifest';
import {
  InstalledModule,
  LingBuilderModuleManifest,
  LingBuilderProjectModules,
  MarketModule,
  MarketSource,
  ModuleHistoryEntry,
  ModuleInstallPreview,
  ModuleInstallResult
} from './types';

const execFileAsync = promisify(execFile);

const PROJECT_MODULES_FILE = 'project-modules.json';
const MODULE_MANIFEST_FILE = 'lingbuilder.module.json';
const MODULE_SOURCES_FILE = 'module-sources.json';
const MODULE_HISTORY_FILE = 'module-history.json';
const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';
const BASIC_MODULE_ID = 'lingbuilder.win32.basic';
// CEF3 内核 SDK 等大型二进制资产模块包可达数百 MB，上限放宽到 1GB。
const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024;

const previewCache = new Map<string, ModuleInstallPreview>();

export interface ProjectModuleEnablePlan {
  projectId: string;
  targetPath: string;
  sourceCode: string;
  requestedModuleIds: string[];
  dependencyModuleIds: string[];
  addedModuleIds: string[];
  reusedModuleIds: string[];
}

export interface ProjectModuleDisablePlan {
  projectId: string;
  requestedModuleId: string;
  removedModuleIds: string[];
  dependentModuleIds: string[];
}

export class ModuleService {
  constructor(private readonly workspaceRoot: string) {}

  async scanInstalledModules(projectId = DEFAULT_PROJECT_ID): Promise<InstalledModule[]> {
    await this.ensureModuleDirs();
    const projectRefs = await this.readProjectModules(projectId);
    const modules: InstalledModule[] = BUILTIN_MODULES.map(manifest => ({
      manifest,
      installPath: `builtin://${manifest.id}`,
      isBuiltin: true,
      isInstalled: true,
      isEnabledForProject: projectRefs.enabledModuleIds.includes(manifest.id),
      diagnostics: []
    }));

    const installRoot = this.installedModulesDir();
    const entries = await safeReadDir(installRoot);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const installPath = path.join(installRoot, entry.name);
      const manifestPath = path.join(installPath, MODULE_MANIFEST_FILE);
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        const validation = validateModuleManifest(parsed);
        if (!validation.manifest) {
          modules.push({
            manifest: createInvalidManifest(entry.name),
            installPath,
            isInstalled: true,
            isEnabledForProject: false,
            diagnostics: validation.diagnostics
          });
          continue;
        }
        const contentDiagnostics = await validateModuleManifestContents(installPath, validation.manifest);
        modules.push({
          manifest: validation.manifest,
          installPath,
          isInstalled: true,
          isEnabledForProject: projectRefs.enabledModuleIds.includes(validation.manifest.id),
          diagnostics: [...validation.diagnostics, ...contentDiagnostics],
          sha256: await hashDirectoryManifest(installPath)
        });
      } catch (error) {
        modules.push({
          manifest: createInvalidManifest(entry.name),
          installPath,
          isInstalled: true,
          isEnabledForProject: false,
          diagnostics: [`模块清单读取失败：${errorMessage(error)}`]
        });
      }
    }

    return modules.sort((a, b) => Number(Boolean(b.isBuiltin)) - Number(Boolean(a.isBuiltin)) || a.manifest.name.localeCompare(b.manifest.name, 'zh-CN'));
  }

  async getEnabledProjectModules(projectId = DEFAULT_PROJECT_ID): Promise<InstalledModule[]> {
    return (await this.scanInstalledModules(projectId)).filter(module => module.isEnabledForProject);
  }

  async enableModuleForProject(projectId: string, moduleId: string): Promise<void> {
    await this.enableModulesForProject(projectId, [moduleId]);
  }

  async enableModulesForProject(projectId: string, moduleIds: readonly string[]): Promise<ProjectModuleEnablePlan> {
    const plan = await this.planEnableModulesForProject(projectId, moduleIds);
    await this.writeTextAtomically(plan.targetPath, plan.sourceCode);
    await this.recordProjectModuleEnablePlan(plan);
    return plan;
  }

  /**
   * Produces a validated project-module file update that can be committed in the
   * same transaction as copied source files. No disk mutation happens here.
   */
  async planEnableModulesForProject(projectId: string, moduleIds: readonly string[]): Promise<ProjectModuleEnablePlan> {
    await this.assertProjectExists(projectId);
    return await this.createProjectModuleEnablePlan(projectId, moduleIds);
  }

  /** Validates module references for a project creation preview before the project exists on disk. */
  async planEnableModulesForNewProject(projectId: string, moduleIds: readonly string[]): Promise<ProjectModuleEnablePlan> {
    const normalizedProjectId = safeProjectId(projectId);
    if (!projectId || normalizedProjectId !== projectId) throw new Error(`项目 ID 无效：${projectId || '(空)'}`);
    return await this.createProjectModuleEnablePlan(projectId, moduleIds);
  }

  private async createProjectModuleEnablePlan(projectId: string, moduleIds: readonly string[]): Promise<ProjectModuleEnablePlan> {
    const modules = await this.scanInstalledModules(projectId);
    const installedById = new Map(modules.map(module => [module.manifest.id, module]));
    const refs = await this.readProjectModules(projectId);
    const nextRefs: LingBuilderProjectModules = {
      schemaVersion: refs.schemaVersion,
      enabledModuleIds: [...refs.enabledModuleIds],
      pinnedVersions: { ...refs.pinnedVersions }
    };
    const requestedModuleIds = [...new Set(moduleIds)];
    const orderedModuleIds = resolveModuleDependencyOrder(requestedModuleIds, installedById);
    const addedModuleIds: string[] = [];
    const reusedModuleIds: string[] = [];
    for (const moduleId of orderedModuleIds) {
      const module = installedById.get(moduleId);
      if (!module) throw new Error(`功能库依赖的模块尚未安装：${moduleId}`);
      if (module.diagnostics.length > 0) throw new Error(`功能库依赖的模块校验未通过：${moduleId}：${module.diagnostics.join('；')}`);
      if (nextRefs.enabledModuleIds.includes(moduleId)) {
        reusedModuleIds.push(moduleId);
        continue;
      }
      nextRefs.enabledModuleIds.push(moduleId);
      nextRefs.pinnedVersions[moduleId] = module.manifest.version;
      addedModuleIds.push(moduleId);
    }
    assertNoModuleCompatibilityConflicts(modules, nextRefs.enabledModuleIds);
    return {
      projectId,
      targetPath: this.projectModulesPath(projectId),
      sourceCode: `${JSON.stringify(nextRefs, null, 2)}\n`,
      requestedModuleIds,
      dependencyModuleIds: orderedModuleIds.filter(moduleId => !requestedModuleIds.includes(moduleId)),
      addedModuleIds,
      reusedModuleIds
    };
  }

  async recordProjectModuleEnablePlan(plan: ProjectModuleEnablePlan): Promise<void> {
    for (const moduleId of plan.addedModuleIds) {
      const module = (await this.scanInstalledModules(plan.projectId)).find(item => item.manifest.id === moduleId);
      await this.appendHistory({
        action: 'enable',
        moduleId,
        moduleName: module?.manifest.name,
        version: module?.manifest.version,
        status: 'success',
        summary: `随功能库复制启用模块 ${module?.manifest.name || moduleId}`,
        details: `项目 ${plan.projectId} 已引用 ${moduleId}${module?.manifest.version ? `@${module.manifest.version}` : ''}。`
      });
    }
  }

  async planDisableModuleForProject(projectId: string, moduleId: string): Promise<ProjectModuleDisablePlan> {
    if (moduleId === BASIC_MODULE_ID) throw new Error('Win32窗口基础模块是普通 Win32 项目的默认基础能力，不能禁用。');
    await this.assertProjectExists(projectId);
    const refs = await this.readProjectModules(projectId);
    const modules = await this.scanInstalledModules(projectId);
    const enabled = new Set(refs.enabledModuleIds);
    const removed = new Set<string>(enabled.has(moduleId) ? [moduleId] : []);
    let changed = true;
    while (changed) {
      changed = false;
      for (const module of modules) {
        if (!enabled.has(module.manifest.id) || removed.has(module.manifest.id)) continue;
        if ((module.manifest.dependencies || []).some(dependency => removed.has(dependency.moduleId))) {
          removed.add(module.manifest.id);
          changed = true;
        }
      }
    }
    return {
      projectId,
      requestedModuleId: moduleId,
      removedModuleIds: [...removed],
      dependentModuleIds: [...removed].filter(id => id !== moduleId)
    };
  }

  async disableModuleForProject(projectId: string, moduleId: string, options: { cascade?: boolean } = {}): Promise<void> {
    const plan = await this.planDisableModuleForProject(projectId, moduleId);
    if (plan.dependentModuleIds.length > 0 && !options.cascade) {
      throw new Error(`模块仍被以下已启用模块依赖：${plan.dependentModuleIds.join('、')}。请确认后级联禁用。`);
    }
    const refs = await this.readProjectModules(projectId);
    const removed = new Set(plan.removedModuleIds);
    refs.enabledModuleIds = refs.enabledModuleIds.filter(id => !removed.has(id));
    plan.removedModuleIds.forEach(id => delete refs.pinnedVersions[id]);
    await this.writeProjectModules(projectId, refs);
    for (const removedModuleId of plan.removedModuleIds) {
      await this.appendHistory({
        action: 'disable',
        moduleId: removedModuleId,
        status: 'success',
        summary: `已从项目禁用模块 ${removedModuleId}`,
        details: `项目 ${projectId} 不再引用 ${removedModuleId}${removedModuleId === moduleId ? '' : '（依赖级联）'}。`
      });
    }
  }

  async previewPackageInstall(packagePath: string): Promise<ModuleInstallPreview> {
    await this.ensureModuleDirs();
    const normalizedPackagePath = path.resolve(packagePath);
    const stat = await fs.stat(normalizedPackagePath);
    const diagnostics: string[] = [];
    if (!stat.isFile()) diagnostics.push('模块包路径不是文件。');
    if (stat.size > MAX_PACKAGE_BYTES) diagnostics.push('模块包超过 1GB 限制。');
    if (!normalizedPackagePath.toLowerCase().endsWith('.lbmod')) diagnostics.push('模块包扩展名必须是 .lbmod。');

    const previewId = `preview-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const unpackedPath = path.join(this.previewsDir(), previewId);
    await fs.mkdir(unpackedPath, { recursive: true });

    if (diagnostics.length === 0) {
      await expandArchive(normalizedPackagePath, unpackedPath);
    }

    const fileInfos = diagnostics.length === 0 ? await collectFiles(unpackedPath) : [];
    if (fileInfos.some(file => !validateModuleRelativePath(file.relativePath))) {
      diagnostics.push('模块包中包含不安全路径。');
    }

    let manifest: LingBuilderModuleManifest | undefined;
    const manifestPath = path.join(unpackedPath, MODULE_MANIFEST_FILE);
    try {
      const manifestRaw = await fs.readFile(manifestPath, 'utf8');
      const validation = validateModuleManifest(JSON.parse(manifestRaw));
      manifest = validation.manifest;
      diagnostics.push(...validation.diagnostics);
      if (manifest) diagnostics.push(...await validateModuleManifestContents(unpackedPath, manifest));
    } catch (error) {
      diagnostics.push(`模块包缺少有效的 ${MODULE_MANIFEST_FILE}：${errorMessage(error)}`);
    }

    const installed = manifest ? (await this.scanInstalledModules()).find(module => module.manifest.id === manifest?.id) : undefined;
    const sha256 = await hashFile(normalizedPackagePath);
    const preview: ModuleInstallPreview = {
      previewId,
      packagePath: normalizedPackagePath,
      unpackedPath,
      manifest,
      fileCount: fileInfos.length,
      totalBytes: fileInfos.reduce((sum, file) => sum + file.size, 0),
      sha256,
      diagnostics,
      canInstall: Boolean(manifest && diagnostics.length === 0),
      willUpgrade: Boolean(installed && !installed.isBuiltin),
      existingVersion: installed?.manifest.version
    };

    previewCache.set(previewId, preview);
    if (!preview.canInstall) {
      await this.appendHistory({
        action: 'preview-failed',
        moduleId: manifest?.id,
        moduleName: manifest?.name,
        version: manifest?.version,
        status: 'failed',
        summary: '模块安装预览未通过',
        details: diagnostics.join('\n') || '未知错误'
      });
    }
    return preview;
  }

  async installPackage(previewId: string): Promise<ModuleInstallResult> {
    const preview = previewCache.get(previewId);
    if (!preview || !preview.manifest || !preview.canInstall) throw new Error('安装预览不存在或未通过校验。');
    if (BUILTIN_MODULES.some(module => module.id === preview.manifest?.id)) throw new Error('不能覆盖内置模块。');
    const contentDiagnostics = await validateModuleManifestContents(preview.unpackedPath, preview.manifest);
    if (contentDiagnostics.length > 0) {
      preview.canInstall = false;
      preview.diagnostics.push(...contentDiagnostics);
      throw new Error(`模块包内容在安装前校验失败：${contentDiagnostics.join('；')}`);
    }

    const targetPath = path.join(this.installedModulesDir(), preview.manifest.id);
    const snapshotPath = await this.snapshotIfExists(targetPath, preview.manifest.id);
    await fs.rm(targetPath, { recursive: true, force: true });
    await copyDirectory(preview.unpackedPath, targetPath);

    const history = await this.appendHistory({
      action: 'install',
      moduleId: preview.manifest.id,
      moduleName: preview.manifest.name,
      version: preview.manifest.version,
      status: 'success',
      summary: `已安装模块 ${preview.manifest.name}`,
      details: `安装路径：${targetPath}\nSHA256：${preview.sha256}`,
      snapshotPath
    });

    return {
      moduleId: preview.manifest.id,
      moduleName: preview.manifest.name,
      version: preview.manifest.version,
      installPath: targetPath,
      historyId: history.id
    };
  }

  getPackageInstallPreview(previewId: string): ModuleInstallPreview | undefined {
    const preview = previewCache.get(previewId);
    return preview ? structuredClone(preview) : undefined;
  }

  async uninstallModule(moduleId: string): Promise<void> {
    if (BUILTIN_MODULES.some(module => module.id === moduleId)) throw new Error('内置模块不能卸载。');
    const installPath = path.join(this.installedModulesDir(), moduleId);
    const snapshotPath = await this.snapshotIfExists(installPath, moduleId);
    await fs.rm(installPath, { recursive: true, force: true });

    const cleanedProjectReferences = await this.removeModuleFromAllProjects(moduleId);

    await this.appendHistory({
      action: 'uninstall',
      moduleId,
      status: 'success',
      summary: `已卸载模块 ${moduleId}`,
      details: `模块文件已移除，已清理 ${cleanedProjectReferences} 个项目引用。`,
      snapshotPath
    });
  }

  async listMarketModules(sourceId?: string): Promise<MarketModule[]> {
    const sources = (await this.readMarketSources()).filter(source => source.enabled && (!sourceId || source.id === sourceId));
    const installed = await this.scanInstalledModules();
    const installedById = new Map(installed.map(module => [module.manifest.id, module.manifest.version]));
    const modules: MarketModule[] = [];

    for (const source of sources) {
      modules.push(...await this.readMarketSourceModules(source, installedById));
    }
    return modules;
  }

  async exportModulePackage(moduleDir: string, targetPath: string): Promise<void> {
    const resolvedModuleDir = path.resolve(moduleDir);
    const resolvedTargetPath = path.resolve(targetPath);
    const manifest = JSON.parse(await fs.readFile(path.join(resolvedModuleDir, MODULE_MANIFEST_FILE), 'utf8'));
    const validation = validateModuleManifest(manifest);
    if (!validation.manifest) throw new Error(validation.diagnostics.join('\n'));
    const contentDiagnostics = await validateModuleManifestContents(resolvedModuleDir, validation.manifest);
    if (contentDiagnostics.length > 0) throw new Error(`模块内容不完整：${contentDiagnostics.join('；')}`);
    if (!resolvedTargetPath.toLowerCase().endsWith('.lbmod')) throw new Error('导出目标必须是 .lbmod 文件。');

    await fs.mkdir(path.dirname(resolvedTargetPath), { recursive: true });
    await compressArchive(resolvedModuleDir, resolvedTargetPath);
    await this.appendHistory({
      action: 'export',
      moduleId: validation.manifest.id,
      moduleName: validation.manifest.name,
      version: validation.manifest.version,
      status: 'success',
      summary: `已导出模块包 ${validation.manifest.name}`,
      details: `导出路径：${resolvedTargetPath}\nSHA256：${await hashFile(resolvedTargetPath)}`
    });
  }

  async getHistory(): Promise<ModuleHistoryEntry[]> {
    return readJsonFile<ModuleHistoryEntry[]>(this.historyPath(), []);
  }

  async assertProjectExists(projectId: string): Promise<void> {
    const normalizedProjectId = projectId?.trim();
    if (!normalizedProjectId || safeProjectId(normalizedProjectId) !== normalizedProjectId) {
      throw new Error(`项目 ID 无效：${projectId || '(空)'}`);
    }
    const solutionPath = path.join(this.lingBuilderDir(), 'solution.json');
    try {
      const solution = JSON.parse(await fs.readFile(solutionPath, 'utf8')) as { projects?: Array<{ id?: string }> };
      if (!Array.isArray(solution.projects) || !solution.projects.some(project => project?.id === normalizedProjectId)) {
        throw new Error(`项目不存在或未加入当前解决方案：${normalizedProjectId}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code === 'ENOENT' && normalizedProjectId === DEFAULT_PROJECT_ID) return;
      if (error instanceof SyntaxError) throw new Error('解决方案文件不是合法 JSON，无法校验项目模块引用。');
      throw error;
    }
  }

  private async readProjectModules(_projectId: string): Promise<LingBuilderProjectModules> {
    const refs = await readJsonFile<LingBuilderProjectModules>(this.projectModulesPath(_projectId), {
      schemaVersion: 1,
      enabledModuleIds: [BASIC_MODULE_ID],
      pinnedVersions: { [BASIC_MODULE_ID]: '1.0.0' }
    });
    if (!Array.isArray(refs.enabledModuleIds)) refs.enabledModuleIds = [];
    if (!refs.enabledModuleIds.includes(BASIC_MODULE_ID)) refs.enabledModuleIds.unshift(BASIC_MODULE_ID);
    refs.pinnedVersions ||= {};
    refs.pinnedVersions[BASIC_MODULE_ID] ||= '1.0.0';
    return refs;
  }

  private async writeProjectModules(_projectId: string, refs: LingBuilderProjectModules): Promise<void> {
    const targetPath = this.projectModulesPath(_projectId);
    await this.writeTextAtomically(targetPath, `${JSON.stringify(refs, null, 2)}\n`);
  }

  private async writeTextAtomically(targetPath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const suffix = `${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
    const tempPath = `${targetPath}.tmp-${suffix}`;
    const backupPath = `${targetPath}.bak-${suffix}`;
    await fs.writeFile(tempPath, content, 'utf8');
    try {
      await fs.rename(tempPath, targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== 'EEXIST' && (error as NodeJS.ErrnoException)?.code !== 'EPERM') throw error;
      let originalMoved = false;
      try {
        await fs.rename(targetPath, backupPath);
        originalMoved = true;
        await fs.rename(tempPath, targetPath);
        await fs.rm(backupPath, { force: true });
      } catch (replaceError) {
        if (originalMoved) {
          await fs.rm(targetPath, { force: true });
          await fs.rename(backupPath, targetPath);
        }
        throw replaceError;
      }
    } finally {
      await fs.rm(tempPath, { force: true });
      await fs.rm(backupPath, { force: true });
    }
  }

  private async removeModuleFromAllProjects(moduleId: string): Promise<number> {
    const referencePaths = [this.projectModulesPath(DEFAULT_PROJECT_ID)];
    const projectsRoot = path.join(this.lingBuilderDir(), 'projects');
    for (const entry of await safeReadDir(projectsRoot)) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      referencePaths.push(path.join(projectsRoot, entry.name, PROJECT_MODULES_FILE));
    }

    let cleanedCount = 0;
    for (const referencePath of referencePaths) {
      try {
        const refs = JSON.parse(await fs.readFile(referencePath, 'utf8')) as LingBuilderProjectModules;
        const enabledModuleIds = Array.isArray(refs.enabledModuleIds) ? refs.enabledModuleIds : [];
        const pinnedVersions = refs.pinnedVersions && typeof refs.pinnedVersions === 'object' ? refs.pinnedVersions : {};
        if (!enabledModuleIds.includes(moduleId) && !(moduleId in pinnedVersions)) continue;
        refs.enabledModuleIds = enabledModuleIds.filter(id => id !== moduleId);
        delete pinnedVersions[moduleId];
        refs.pinnedVersions = pinnedVersions;
        await fs.writeFile(referencePath, JSON.stringify(refs, null, 2), 'utf8');
        cleanedCount += 1;
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') throw error;
      }
    }
    return cleanedCount;
  }

  private async readMarketSources(): Promise<MarketSource[]> {
    const fallback: MarketSource[] = [
      {
        id: 'local-workspace',
        name: '本地模块市场',
        type: 'local',
        enabled: true,
        location: path.join(this.lingBuilderDir(), 'module-market.json'),
        priority: 1
      }
    ];
    return readJsonFile<MarketSource[]>(path.join(this.lingBuilderDir(), MODULE_SOURCES_FILE), fallback);
  }

  private async readMarketSourceModules(source: MarketSource, installedById: Map<string, string>): Promise<MarketModule[]> {
    try {
      if (source.location.startsWith('http://') || source.location.startsWith('https://')) {
        const response = await fetch(source.location);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const raw = await response.json();
        return normalizeMarketModules(raw, source, installedById);
      }
      const raw = await readJsonFile<any>(source.location, []);
      return normalizeMarketModules(raw, source, installedById);
    } catch {
      return [];
    }
  }

  private async appendHistory(entry: Omit<ModuleHistoryEntry, 'id' | 'time'>): Promise<ModuleHistoryEntry> {
    await fs.mkdir(this.lingBuilderDir(), { recursive: true });
    const history = await this.getHistory();
    const next: ModuleHistoryEntry = {
      id: `module-history-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      time: new Date().toISOString(),
      ...entry
    };
    history.unshift(next);
    await fs.writeFile(this.historyPath(), JSON.stringify(history.slice(0, 200), null, 2), 'utf8');
    return next;
  }

  private async snapshotIfExists(targetPath: string, moduleId: string): Promise<string | undefined> {
    try {
      const stat = await fs.stat(targetPath);
      if (!stat.isDirectory()) return undefined;
      const snapshotPath = path.join(this.snapshotsDir(), `${moduleId}-${Date.now()}`);
      await copyDirectory(targetPath, snapshotPath);
      return snapshotPath;
    } catch {
      return undefined;
    }
  }

  private async ensureModuleDirs(): Promise<void> {
    await Promise.all([
      fs.mkdir(this.installedModulesDir(), { recursive: true }),
      fs.mkdir(this.previewsDir(), { recursive: true }),
      fs.mkdir(this.snapshotsDir(), { recursive: true })
    ]);
  }

  private lingBuilderDir(): string {
    return path.join(this.workspaceRoot, '.lingbuilder');
  }

  private installedModulesDir(): string {
    return path.join(this.lingBuilderDir(), 'modules');
  }

  private previewsDir(): string {
    return path.join(os.tmpdir(), 'lingbuilder-module-previews');
  }

  private snapshotsDir(): string {
    return path.join(this.lingBuilderDir(), 'module-snapshots');
  }

  private projectModulesPath(projectId = DEFAULT_PROJECT_ID): string {
    if (!projectId || projectId === DEFAULT_PROJECT_ID) return path.join(this.lingBuilderDir(), PROJECT_MODULES_FILE);
    return path.join(this.lingBuilderDir(), 'projects', safeProjectId(projectId), PROJECT_MODULES_FILE);
  }

  private historyPath(): string {
    return path.join(this.lingBuilderDir(), MODULE_HISTORY_FILE);
  }
}

function assertNoModuleCompatibilityConflicts(modules: InstalledModule[], enabledModuleIds: readonly string[]): void {
  const enabled = new Set(enabledModuleIds);
  const byId = new Map(modules.map(module => [module.manifest.id, module]));
  for (const moduleId of enabled) {
    const module = byId.get(moduleId);
    for (const conflict of module?.manifest.compatibility?.conflicts || []) {
      if (!enabled.has(conflict.moduleId)) continue;
      const other = byId.get(conflict.moduleId);
      throw new Error(`模块不兼容：${module.manifest.name} 与 ${other?.manifest.name || conflict.moduleId} 不能在同一项目中启用。${conflict.reason}`);
    }
  }
}

function resolveModuleDependencyOrder(
  requestedModuleIds: readonly string[],
  installedById: ReadonlyMap<string, InstalledModule>
): string[] {
  const ordered: string[] = [];
  const state = new Map<string, 'visiting' | 'visited'>();
  const stack: string[] = [];

  const visit = (moduleId: string): void => {
    if (state.get(moduleId) === 'visited') return;
    if (state.get(moduleId) === 'visiting') {
      const cycleStart = stack.indexOf(moduleId);
      const cycle = [...stack.slice(Math.max(0, cycleStart)), moduleId];
      throw new Error(`检测到模块依赖循环：${cycle.join(' -> ')}`);
    }
    const module = installedById.get(moduleId);
    if (!module) throw new Error(`模块依赖尚未安装：${moduleId}`);
    if (module.diagnostics.length > 0) throw new Error(`模块校验未通过，不能启用 ${moduleId}：${module.diagnostics.join('；')}`);

    state.set(moduleId, 'visiting');
    stack.push(moduleId);
    for (const dependency of module.manifest.dependencies || []) {
      const installedDependency = installedById.get(dependency.moduleId);
      if (!installedDependency) {
        throw new Error(`模块 ${module.manifest.name} 缺少依赖：${dependency.moduleId}@>=${dependency.minimumVersion}`);
      }
      if (compareModuleVersions(installedDependency.manifest.version, dependency.minimumVersion) < 0) {
        throw new Error(`模块 ${module.manifest.name} 需要 ${dependency.moduleId}@>=${dependency.minimumVersion}，当前安装版本为 ${installedDependency.manifest.version}。`);
      }
      visit(dependency.moduleId);
    }
    stack.pop();
    state.set(moduleId, 'visited');
    ordered.push(moduleId);
  };

  requestedModuleIds.forEach(visit);
  return ordered;
}

function compareModuleVersions(left: string, right: string): number {
  const numericParts = (value: string) => value.split('-', 1)[0].split('.').map(part => Number.parseInt(part, 10) || 0);
  const leftParts = numericParts(left);
  const rightParts = numericParts(right);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  const leftPrerelease = left.includes('-');
  const rightPrerelease = right.includes('-');
  if (leftPrerelease === rightPrerelease) return 0;
  return leftPrerelease ? -1 : 1;
}

export function createModuleService(workspaceRoot: string): ModuleService {
  return new ModuleService(workspaceRoot);
}

function normalizeMarketModules(raw: any, source: MarketSource, installedById: Map<string, string>): MarketModule[] {
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.modules) ? raw.modules : [];
  return items
    .map((item: any) => ({
      id: String(item.id || ''),
      name: String(item.name || item.id || ''),
      version: String(item.version || '0.0.0'),
      category: item.category || '其他',
      description: String(item.description || ''),
      author: item.author,
      tags: Array.isArray(item.tags) ? item.tags : [],
      sourceId: source.id,
      packagePath: item.packagePath,
      downloadUrl: item.downloadUrl,
      sha256: item.sha256,
      installedVersion: installedById.get(item.id)
    }))
    .filter((item: MarketModule) => Boolean(item.id && item.name));
}

async function expandArchive(source: string, destination: string): Promise<void> {
  const zipSource = await ensureZipArchiveExtension(source);
  try {
    await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -LiteralPath ${quotePs(zipSource)} -DestinationPath ${quotePs(destination)} -Force`
    ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  } finally {
    if (zipSource !== source) await fs.rm(zipSource, { force: true });
  }
}

async function ensureZipArchiveExtension(source: string): Promise<string> {
  if (source.toLowerCase().endsWith('.zip')) return source;
  const tempZip = path.join(os.tmpdir(), `lingbuilder-${crypto.randomBytes(8).toString('hex')}.zip`);
  await fs.copyFile(source, tempZip);
  return tempZip;
}

async function compressArchive(sourceDir: string, targetPath: string): Promise<void> {
  const tempZipPath = `${targetPath}.zip`;
  await fs.rm(targetPath, { force: true });
  await fs.rm(tempZipPath, { force: true });
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path ${quotePs(path.join(sourceDir, '*'))} -DestinationPath ${quotePs(tempZipPath)} -Force`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await fs.rename(tempZipPath, targetPath);
}

function quotePs(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8')) as T;
  } catch {
    return fallback;
  }
}

async function safeReadDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function collectFiles(root: string): Promise<Array<{ relativePath: string; size: number }>> {
  const files: Array<{ relativePath: string; size: number }> = [];
  async function visit(current: string): Promise<void> {
    const entries = await safeReadDir(current);
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(fullPath);
      else if (entry.isFile()) {
        const stat = await fs.stat(fullPath);
        files.push({ relativePath: path.relative(root, fullPath).replace(/\\/g, '/'), size: stat.size });
      }
    }
  }
  await visit(root);
  return files;
}

async function copyDirectory(source: string, target: string): Promise<void> {
  await fs.mkdir(target, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) await fs.copyFile(sourcePath, targetPath);
  }
}

async function hashFile(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function hashDirectoryManifest(dir: string): Promise<string> {
  try {
    return hashFile(path.join(dir, MODULE_MANIFEST_FILE));
  } catch {
    return undefined as unknown as string;
  }
}

function createInvalidManifest(id: string): LingBuilderModuleManifest {
  return {
    schemaVersion: 2,
    id,
    name: id,
    version: '0.0.0',
    category: '其他',
    description: '该模块清单无法读取或校验未通过。'
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function safeProjectId(projectId: string): string {
  return projectId.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || DEFAULT_PROJECT_ID;
}
