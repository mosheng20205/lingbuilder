import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BUILTIN_MODULES } from './builtinModules';
import { validateModuleManifest, validateModuleManifestContents, validateModuleRelativePath, type ModuleValidationOptions } from './manifest';
import { createModuleTemplate } from './moduleSdkService';
import {
  InstalledModule,
  LINGBUILDER_MODULE_CATEGORIES,
  LingBuilderModuleManifest,
  LingBuilderProjectModules,
  MarketModule,
  MarketSource,
  ModuleDevLink,
  ModuleDevLinkRegistry,
  ModuleHistoryEntry,
  ModuleInstallPreview,
  ModuleInstallResult
} from './types';

const execFileAsync = promisify(execFile);

const PROJECT_MODULES_FILE = 'project-modules.json';
const MODULE_MANIFEST_FILE = 'lingbuilder.module.json';
const MODULE_SOURCES_FILE = 'module-sources.json';
const MODULE_HISTORY_FILE = 'module-history.json';
const MODULE_LINKS_FILE = 'module-links.json';
const DEFAULT_PROJECT_ID = 'lingbuilder-ui-project';
const BASIC_MODULE_ID = 'lingbuilder.win32.basic';
// 新项目默认启用的内置模块（基础模块之外的增量）：
// 旧工作区/旧项目在读取层“只补缺不覆盖”地补上（参照 DesktopWorkspaceService.ensureBundledModules 语义），
// 用户显式禁用过的 ID 记录在 project-modules.json 的 optOutDefaultModuleIds，不会被再次自动打开。
const DEFAULT_ENABLED_MODULE_IDS = ['lingbuilder.advanced.process-memory'];
// These resources belong to a project and must never be exposed as installable
// modules. Keeping the filter here also migrates older project refs in memory.
const PROJECT_RESOURCE_MODULE_IDS = new Set(['lingbuilder.browser.doubao-downloader']);
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

export interface ModuleServiceOptions {
  /**
   * 安装包随附的 default-workspace 根目录（打包后为 resources/default-workspace）。
   * 提供后：扫描结果对「清单无法读取或校验未通过」的模块给出 bundledRepairable 标记，
   * 且 repairBundledModule 可用该副本整体修复重装；缺省时两者都不可用。
   */
  bundledWorkspaceSource?: string;
}

export class ModuleService {
  constructor(private readonly workspaceRoot: string, private readonly options: ModuleServiceOptions = {}) {}

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

    const links = await this.readModuleDevLinks();
    const linkedModuleIds = new Set(Object.keys(links));

    const installRoot = this.installedModulesDir();
    const entries = await safeReadDir(installRoot);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (PROJECT_RESOURCE_MODULE_IDS.has(entry.name)) continue;
      if (linkedModuleIds.has(entry.name)) continue;
      const installPath = path.join(installRoot, entry.name);
      const loaded = await this.loadInstalledModuleFromDir(installPath, entry.name, projectRefs.enabledModuleIds);
      // 链接优先：目录名与清单 ID 不一致时（如手工改名的目录），清单 ID 命中链接表也要跳过。
      if (loaded.manifest && linkedModuleIds.has(loaded.manifest.id)) continue;
      modules.push(loaded);
    }

    // 开发源链接模块：installPath 直接指向工作区内源目录，改动即时生效，不落真实符号链接。
    for (const link of Object.values(links)) {
      const sourceDir = this.resolveDevLinkDir(link);
      const manifestPath = path.join(sourceDir, MODULE_MANIFEST_FILE);
      try {
        const raw = await fs.readFile(manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        const validation = validateModuleManifest(parsed);
        if (!validation.manifest) {
          modules.push({
            manifest: createInvalidManifest(link.moduleId),
            installPath: sourceDir,
            isInstalled: true,
            isEnabledForProject: false,
            isDevLink: true,
            diagnostics: [...validation.diagnostics, `开发源清单校验未通过：${link.sourcePath}`]
          });
          continue;
        }
        const contentDiagnostics = await validateModuleManifestContents(sourceDir, validation.manifest);
        modules.push({
          manifest: validation.manifest,
          installPath: sourceDir,
          isInstalled: true,
          isEnabledForProject: projectRefs.enabledModuleIds.includes(validation.manifest.id),
          isDevLink: true,
          diagnostics: [...validation.diagnostics, ...contentDiagnostics],
          sha256: await hashDirectoryManifest(sourceDir)
        });
      } catch (error) {
        modules.push({
          manifest: createInvalidManifest(link.moduleId),
          installPath: sourceDir,
          isInstalled: true,
          isEnabledForProject: false,
          isDevLink: true,
          diagnostics: [`开发源目录不可用（${link.sourcePath}）：${errorMessage(error)}`]
        });
      }
    }

    return modules.sort((a, b) => Number(Boolean(b.isBuiltin)) - Number(Boolean(a.isBuiltin)) || a.manifest.name.localeCompare(b.manifest.name, 'zh-CN'));
  }

  private async loadInstalledModuleFromDir(
    installPath: string,
    fallbackId: string,
    enabledModuleIds: readonly string[]
  ): Promise<InstalledModule> {
    const manifestPath = path.join(installPath, MODULE_MANIFEST_FILE);
    try {
      const raw = await fs.readFile(manifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      const validation = validateModuleManifest(parsed);
      if (!validation.manifest) {
        return {
          manifest: createInvalidManifest(fallbackId),
          installPath,
          isInstalled: true,
          isEnabledForProject: false,
          bundledRepairable: await this.bundledModuleRepairable(fallbackId),
          diagnostics: validation.diagnostics
        };
      }
      const contentDiagnostics = await validateModuleManifestContents(installPath, validation.manifest);
      return {
        manifest: validation.manifest,
        installPath,
        isInstalled: true,
        isEnabledForProject: enabledModuleIds.includes(validation.manifest.id),
        diagnostics: [...validation.diagnostics, ...contentDiagnostics],
        sha256: await hashDirectoryManifest(installPath)
      };
    } catch (error) {
      return {
        manifest: createInvalidManifest(fallbackId),
        installPath,
        isInstalled: true,
        isEnabledForProject: false,
        bundledRepairable: await this.bundledModuleRepairable(fallbackId),
        diagnostics: [`模块清单读取失败：${errorMessage(error)}`]
      };
    }
  }

  async getEnabledProjectModules(projectId = DEFAULT_PROJECT_ID): Promise<InstalledModule[]> {
    return (await this.scanInstalledModules(projectId)).filter(module => module.isEnabledForProject);
  }

  /** Returns the normalized project module IDs used for inheritance and diagnostics. */
  async getProjectModuleIds(projectId = DEFAULT_PROJECT_ID): Promise<string[]> {
    return [...(await this.readProjectModules(projectId)).enabledModuleIds];
  }

  async enableModuleForProject(projectId: string, moduleId: string): Promise<void> {
    await this.enableModulesForProject(projectId, [moduleId]);
  }

  async enableModulesForProject(projectId: string, moduleIds: readonly string[]): Promise<ProjectModuleEnablePlan> {
    const projectResource = moduleIds.find(moduleId => PROJECT_RESOURCE_MODULE_IDS.has(moduleId));
    if (projectResource) throw new Error(`“${projectResource}”是项目资源，不是可安装模块；请将资源放入项目 assets 目录。`);
    const plan = await this.planEnableModulesForProject(projectId, moduleIds);
    await this.applyProjectModuleEnablePlan(plan);
    return plan;
  }

  /** Commits a previously validated module plan after its project exists. */
  async applyProjectModuleEnablePlan(plan: ProjectModuleEnablePlan): Promise<void> {
    await this.assertProjectExists(plan.projectId);
    await this.writeTextAtomically(plan.targetPath, plan.sourceCode);
    await this.recordProjectModuleEnablePlan(plan);
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
      pinnedVersions: { ...refs.pinnedVersions },
      ...(refs.optOutDefaultModuleIds ? { optOutDefaultModuleIds: [...refs.optOutDefaultModuleIds] } : {})
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
    // 显式启用的模块如果此前被记为“默认模块已禁用”，这里一并清除该记录。
    if (nextRefs.optOutDefaultModuleIds?.length) {
      nextRefs.optOutDefaultModuleIds = nextRefs.optOutDefaultModuleIds.filter(moduleId => !nextRefs.enabledModuleIds.includes(moduleId));
    }
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
    // 默认启用模块被显式禁用后要记入 opt-out，否则下次读取会被自动补回。
    // 级联连带移除的默认模块同样记录，保证依赖关系不被“补缺”逻辑重新拼回来。
    const optOut = new Set(refs.optOutDefaultModuleIds || []);
    for (const removedModuleId of plan.removedModuleIds) {
      if (DEFAULT_ENABLED_MODULE_IDS.includes(removedModuleId)) optOut.add(removedModuleId);
    }
    refs.optOutDefaultModuleIds = [...optOut];
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
    const devLinks = await this.readModuleDevLinks();
    const existingLink = devLinks[preview.manifest.id];
    if (existingLink) {
      throw new Error(`模块 ${preview.manifest.id} 已链接开发源（${existingLink.sourcePath}），扫描以开发源为准；请先在模块管理中取消链接后再安装。`);
    }
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
    const devLinks = await this.readModuleDevLinks();
    if (devLinks[moduleId]) {
      // 链接模块的「卸载」只断链并清理项目引用，绝不触碰用户开发源目录。
      delete devLinks[moduleId];
      await this.writeModuleDevLinks(devLinks);
      const cleanedLinkedRefs = await this.removeModuleFromAllProjects(moduleId);
      await this.appendHistory({
        action: 'unlink',
        moduleId,
        status: 'success',
        summary: `已取消模块开发源链接 ${moduleId}`,
        details: `开发源目录文件未删除；已清理 ${cleanedLinkedRefs} 个项目引用。`
      });
      return;
    }
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

  /** 随包副本目录（default-workspace/.lingbuilder/modules/<moduleId>）；未配置随包源或 ID 非法时返回 undefined。 */
  private bundledModuleDir(moduleId: string): string | undefined {
    const bundledSource = this.options.bundledWorkspaceSource;
    if (!bundledSource) return undefined;
    if (!/^[a-zA-Z0-9._-]{1,160}$/u.test(moduleId)) return undefined;
    return path.join(bundledSource, '.lingbuilder', 'modules', moduleId);
  }

  /** 随包源里是否存在同 ID 且清单校验通过的副本；决定模块面板「修复重装」入口是否可见。 */
  private async bundledModuleRepairable(moduleId: string): Promise<boolean> {
    const bundledDir = this.bundledModuleDir(moduleId);
    if (!bundledDir) return false;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(bundledDir, MODULE_MANIFEST_FILE), 'utf8'));
      return Boolean(validateModuleManifest(parsed).manifest);
    } catch {
      return false;
    }
  }

  /**
   * 用安装包随附副本整体修复重装一个已安装模块：清单损坏或校验未通过（例如老工作区
   * 残留旧版 new_emoji 清单）时的一键自愈入口。只接受随包源里清单校验通过且 ID 一致的
   * 模块；内置模块与已链接开发源的模块拒绝；替换前按卸载同款语义留快照，替换后返回
   * 刷新后的完整扫描结果。
   */
  async repairBundledModule(moduleId: string): Promise<{ moduleId: string; moduleName: string; version: string; modules: InstalledModule[] }> {
    if (BUILTIN_MODULES.some(module => module.id === moduleId)) throw new Error('内置模块无需修复重装。');
    const devLinks = await this.readModuleDevLinks();
    if (devLinks[moduleId]) throw new Error('该模块已链接开发源；请先取消开发源链接再修复重装。');
    const bundledDir = this.bundledModuleDir(moduleId);
    if (!bundledDir || !(await fs.stat(bundledDir).catch(() => undefined))?.isDirectory()) {
      throw new Error('该模块没有随包副本，无法修复重装；请重新安装模块包。');
    }
    let manifest: LingBuilderModuleManifest;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(bundledDir, MODULE_MANIFEST_FILE), 'utf8'));
      const validation = validateModuleManifest(parsed);
      if (!validation.manifest) throw new Error(validation.diagnostics[0] || '清单不符合 manifest v2 规范。');
      manifest = validation.manifest;
    } catch (error) {
      throw new Error(`随包副本不可用：${errorMessage(error)}`);
    }
    if (manifest.id !== moduleId) throw new Error(`随包副本模块 ID 不匹配：期望 ${moduleId}，实际 ${manifest.id}。`);
    const installPath = path.join(this.installedModulesDir(), moduleId);
    const snapshotPath = await this.snapshotIfExists(installPath, moduleId);
    await fs.rm(installPath, { recursive: true, force: true });
    await copyDirectory(bundledDir, installPath);
    await this.appendHistory({
      action: 'repair',
      moduleId,
      moduleName: manifest.name,
      version: manifest.version,
      status: 'success',
      summary: `已用随包副本修复重装模块 ${manifest.name}`,
      details: `清单版本 ${manifest.version}；安装目录已按随包副本整体重建。`,
      snapshotPath
    });
    return { moduleId, moduleName: manifest.name, version: manifest.version, modules: await this.scanInstalledModules() };
  }

  /** 已登记的开发源链接（moduleId → 链接条目）。 */
  async listModuleDevLinks(): Promise<ModuleDevLink[]> {
    return Object.values(await this.readModuleDevLinks());
  }

  /**
   * 把模块开发源目录链接进当前工作区：源目录保持在原位（不改文件、不建符号链接），
   * 扫描器按登记表把 installPath 指向源目录，改源码后重新构建即拿到最新文件。
   * sourcePath 必须是工作区相对路径（如 `.lingbuilder/module-build/<id>`）。
   */
  async linkModuleDevSource(sourcePath: string): Promise<{ link: ModuleDevLink; module: InstalledModule }> {
    const normalized = (sourcePath || '').trim().replace(/\\/gu, '/');
    if (!normalized) throw new Error('缺少开发源目录路径。');
    if (path.posix.isAbsolute(normalized) || /^[a-zA-Z]:/u.test(normalized)) {
      throw new Error('开发源链接只接受工作区相对路径。');
    }
    const collapsed = path.posix.normalize(normalized).replace(/^\.\//u, '');
    if (collapsed === '..' || collapsed.startsWith('../')) {
      throw new Error('路径越界：开发源必须位于当前 LingBuilder 工作区内。');
    }
    const sourceDir = path.resolve(this.workspaceRoot, ...collapsed.split('/'));
    const workspacePrefix = path.resolve(this.workspaceRoot) + path.sep;
    if (!sourceDir.startsWith(workspacePrefix)) {
      throw new Error('路径越界：开发源必须位于当前 LingBuilder 工作区内。');
    }
    const installRoot = path.resolve(this.installedModulesDir());
    if (sourceDir === installRoot || sourceDir.startsWith(installRoot + path.sep)) {
      throw new Error('开发源不能指向已安装模块目录（.lingbuilder/modules）；请指向模块源码工程目录。');
    }
    const stat = await fs.stat(sourceDir).catch(() => undefined);
    if (!stat?.isDirectory()) throw new Error(`开发源目录不存在或不是目录：${collapsed}`);
    let manifest: LingBuilderModuleManifest;
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(sourceDir, MODULE_MANIFEST_FILE), 'utf8'));
      const validation = validateModuleManifest(parsed);
      if (!validation.manifest) {
        throw new Error(validation.diagnostics[0] || '清单不符合 manifest v2 规范。');
      }
      manifest = validation.manifest;
    } catch (error) {
      throw new Error(`开发源缺少有效的 ${MODULE_MANIFEST_FILE}（${collapsed}）：${errorMessage(error)}`);
    }
    if (BUILTIN_MODULES.some(module => module.id === manifest.id)) {
      throw new Error(`内置模块不能作为开发源链接：${manifest.id}`);
    }
    if (PROJECT_RESOURCE_MODULE_IDS.has(manifest.id)) {
      throw new Error(`“${manifest.id}”是项目资源，不能作为开发源链接。`);
    }
    const links = await this.readModuleDevLinks();
    const existing = links[manifest.id];
    if (existing && existing.sourcePath !== collapsed) {
      throw new Error(`模块 ${manifest.id} 已链接到其他开发源（${existing.sourcePath}）；请先取消原链接。`);
    }
    const link: ModuleDevLink = {
      moduleId: manifest.id,
      sourcePath: collapsed,
      linkedAt: existing?.linkedAt || new Date().toISOString()
    };
    links[link.moduleId] = link;
    await this.writeModuleDevLinks(links);
    await this.appendHistory({
      action: 'link',
      moduleId: link.moduleId,
      moduleName: manifest.name,
      version: manifest.version,
      status: 'success',
      summary: `${existing ? '已更新' : '已链接'}模块开发源 ${manifest.name}`,
      details: `开发源：${collapsed}；该模块的补全、诊断与构建物化将直接消费源目录，无需重新打包安装。`
    });
    const modules = await this.scanInstalledModules();
    const module = modules.find(item => item.manifest.id === link.moduleId);
    if (!module) throw new Error('开发源链接后模块扫描失败，请检查清单内容。');
    return { link, module };
  }

  /** 取消开发源链接：只移除登记表条目，不删除开发源与已安装目录中的任何文件。 */
  async unlinkModuleDevSource(moduleId: string): Promise<void> {
    const links = await this.readModuleDevLinks();
    if (!links[moduleId]) throw new Error(`模块 ${moduleId} 没有开发源链接。`);
    delete links[moduleId];
    await this.writeModuleDevLinks(links);
    await this.appendHistory({
      action: 'unlink',
      moduleId,
      status: 'success',
      summary: `已取消模块开发源链接 ${moduleId}`,
      details: '开发源目录文件未改动。'
    });
  }

  /** 欢迎页「新建模块」：在 .lingbuilder/module-build/<id> 生成 manifest v2 骨架并自动登记为开发源。 */
  async createModuleSource(options: {
    id?: string;
    name?: string;
    category?: string;
    description?: string;
    template?: string;
  }): Promise<{ moduleId: string; sourceDir: string; sourcePath: string; manifest: LingBuilderModuleManifest; diagnostics: string[] }> {
    const moduleId = (options.id || '').trim();
    if (!/^[a-z0-9][a-z0-9._-]{2,80}$/u.test(moduleId)) {
      throw new Error('模块 ID 只能使用小写字母、数字、点、下划线和中划线（3~81 位，字母或数字开头）。');
    }
    const category = options.category?.trim();
    if (category && !(LINGBUILDER_MODULE_CATEGORIES as readonly string[]).includes(category)) {
      throw new Error(`模块分类只允许：${LINGBUILDER_MODULE_CATEGORIES.join('、')}。`);
    }
    const template = options.template?.trim() || 'cpp-source';
    const targetDir = path.join(this.lingBuilderDir(), 'module-build', moduleId);
    const targetExists = await fs.stat(targetDir).then(() => true).catch(() => false);
    if (targetExists) {
      throw new Error(`目标目录已存在：.lingbuilder/module-build/${moduleId}。请换一个模块 ID，或先删除/改名旧目录。`);
    }
    const manifest = await createModuleTemplate({
      template,
      outDir: targetDir,
      id: moduleId,
      name: options.name?.trim() || undefined,
      category: options.category?.trim() || undefined,
      description: options.description?.trim() || undefined
    });
    const diagnostics = await validateModuleManifestContents(targetDir, manifest);
    const relativePath = `.lingbuilder/module-build/${moduleId}`;
    const { link } = await this.linkModuleDevSource(relativePath);
    return { moduleId, sourceDir: targetDir, sourcePath: link.sourcePath, manifest, diagnostics };
  }

  /** 欢迎页「打开模块包」：把 .lbmod 解开为 .lingbuilder/module-build/<id> 下的可编辑源码并登记开发源（不安装）。 */
  async openModulePackageAsSource(packagePath: string): Promise<{ moduleId: string; sourceDir: string; sourcePath: string; manifest: LingBuilderModuleManifest; diagnostics: string[] }> {
    await this.ensureModuleDirs();
    const normalizedPackagePath = path.resolve(packagePath);
    const stat = await fs.stat(normalizedPackagePath).catch(() => undefined);
    if (!stat?.isFile()) throw new Error(`模块包文件不存在：${normalizedPackagePath}`);
    if (stat.size > MAX_PACKAGE_BYTES) throw new Error('模块包超过 1GB 限制。');
    if (!normalizedPackagePath.toLowerCase().endsWith('.lbmod')) throw new Error('模块包扩展名必须是 .lbmod。');

    const tempId = `open-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const tempDir = path.join(this.previewsDir(), tempId);
    await fs.mkdir(tempDir, { recursive: true });
    try {
      try {
        await expandArchive(normalizedPackagePath, tempDir);
      } catch (error) {
        throw new Error(`模块包解压失败，文件可能损坏：${errorMessage(error)}`);
      }
      const files = await collectFiles(tempDir);
      if (files.some(file => !validateModuleRelativePath(file.relativePath))) {
        throw new Error('模块包中包含不安全路径，已拒绝打开。');
      }
      let manifest: LingBuilderModuleManifest;
      try {
        const validation = validateModuleManifest(JSON.parse(await fs.readFile(path.join(tempDir, MODULE_MANIFEST_FILE), 'utf8')));
        if (!validation.manifest) {
          throw new Error(validation.diagnostics.join('；') || '清单不符合 manifest v2 规范。');
        }
        manifest = validation.manifest;
      } catch (error) {
        throw new Error(`模块包缺少有效的 ${MODULE_MANIFEST_FILE}：${errorMessage(error)}`);
      }
      const moduleId = manifest.id;
      if (BUILTIN_MODULES.some(item => item.id === moduleId)) throw new Error(`内置模块不能作为开发源打开：${moduleId}`);
      if (PROJECT_RESOURCE_MODULE_IDS.has(moduleId)) throw new Error(`「${moduleId}」是项目资源，不能作为开发源打开。`);
      const targetDir = path.join(this.lingBuilderDir(), 'module-build', moduleId);
      const targetExists = await fs.stat(targetDir).then(() => true).catch(() => false);
      if (targetExists) {
        throw new Error(`目标目录已存在：.lingbuilder/module-build/${moduleId}。如需重新打开，请先删除或改名旧目录。`);
      }
      await fs.mkdir(path.dirname(targetDir), { recursive: true });
      await copyDirectory(tempDir, targetDir);
      const diagnostics = await validateModuleManifestContents(targetDir, manifest);
      const { link } = await this.linkModuleDevSource(`.lingbuilder/module-build/${moduleId}`);
      return { moduleId, sourceDir: targetDir, sourcePath: link.sourcePath, manifest, diagnostics };
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
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

  async exportModulePackage(moduleDir: string, targetPath: string, options: ModuleValidationOptions = {}): Promise<void> {
    const resolvedModuleDir = path.resolve(moduleDir);
    const resolvedTargetPath = path.resolve(targetPath);
    const manifest = JSON.parse(await fs.readFile(path.join(resolvedModuleDir, MODULE_MANIFEST_FILE), 'utf8'));
    const validation = validateModuleManifest(manifest, options);
    if (!validation.manifest) throw new Error(validation.diagnostics.join('\n'));
    const contentDiagnostics = await validateModuleManifestContents(resolvedModuleDir, validation.manifest, options);
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
    const targetPath = this.projectModulesPath(_projectId);
    let refs: LingBuilderProjectModules | undefined;
    let missingFile = false;
    const projectType = await this.getSolutionProjectType(_projectId);
    const isWindowsDll = projectType === 'windows-dll';
    try {
      refs = JSON.parse(await fs.readFile(targetPath, 'utf8')) as LingBuilderProjectModules;
    } catch (error: any) {
      missingFile = error?.code === 'ENOENT';
    }

    // Projects created before project-level module manifests were introduced
    // can safely inherit the workspace default once they are known solution
    // members. Unknown project IDs retain the basic-module fallback.
    if (missingFile && !isWindowsDll && _projectId !== DEFAULT_PROJECT_ID && await this.isSolutionProject(_projectId)) {
      refs = await this.readProjectModules(DEFAULT_PROJECT_ID);
    }
    if (!refs) refs = isWindowsDll
      ? { schemaVersion: 1, enabledModuleIds: [], pinnedVersions: {} }
      : {
          schemaVersion: 1,
          enabledModuleIds: [BASIC_MODULE_ID],
          pinnedVersions: { [BASIC_MODULE_ID]: '1.0.0' }
        };
    if (!Array.isArray(refs.enabledModuleIds)) refs.enabledModuleIds = [];
    refs.enabledModuleIds = refs.enabledModuleIds.filter(moduleId => !PROJECT_RESOURCE_MODULE_IDS.has(moduleId));
    if (!isWindowsDll && !refs.enabledModuleIds.includes(BASIC_MODULE_ID)) refs.enabledModuleIds.unshift(BASIC_MODULE_ID);
    refs.pinnedVersions ||= {};
    // 默认启用模块补齐：只补缺不覆盖；被用户显式禁用过的默认模块跳过，
    // 但其内置依赖跟随主模块一起补齐（如 进程内存模块 依赖 缓冲区模块），保证生成的 C++ 运行时完整。
    if (!isWindowsDll) {
      const optOut = new Set(refs.optOutDefaultModuleIds || []);
      const ensureModuleIds = new Set<string>();
      for (const moduleId of DEFAULT_ENABLED_MODULE_IDS) {
        if (optOut.has(moduleId)) continue;
        ensureModuleIds.add(moduleId);
        const manifest = BUILTIN_MODULES.find(item => item.id === moduleId);
        for (const dependency of manifest?.dependencies || []) {
          if (BUILTIN_MODULES.some(item => item.id === dependency.moduleId)) ensureModuleIds.add(dependency.moduleId);
        }
      }
      for (const moduleId of ensureModuleIds) {
        if (!refs.enabledModuleIds.includes(moduleId)) refs.enabledModuleIds.push(moduleId);
        refs.pinnedVersions[moduleId] ||= BUILTIN_MODULES.find(item => item.id === moduleId)?.version || '1.0.0';
      }
      // 已启用的 ID 视为未禁用：清理过期 opt-out，避免“启用后仍被记为禁用”的矛盾状态。
      if (refs.optOutDefaultModuleIds?.length) {
        refs.optOutDefaultModuleIds = refs.optOutDefaultModuleIds.filter(moduleId => !refs.enabledModuleIds.includes(moduleId));
      }
    }
    for (const moduleId of PROJECT_RESOURCE_MODULE_IDS) delete refs.pinnedVersions[moduleId];
    if (!isWindowsDll) refs.pinnedVersions[BASIC_MODULE_ID] ||= '1.0.0';
    return refs;
  }

  private async getSolutionProjectType(projectId: string): Promise<string | undefined> {
    try {
      const raw = await fs.readFile(path.join(this.lingBuilderDir(), 'solution.json'), 'utf8');
      const solution = JSON.parse(raw) as { projects?: Array<{ id?: string; type?: string }> };
      return solution.projects?.find(project => project?.id === projectId)?.type;
    } catch {
      return undefined;
    }
  }

  private async isSolutionProject(projectId: string): Promise<boolean> {
    try {
      const raw = await fs.readFile(path.join(this.lingBuilderDir(), 'solution.json'), 'utf8');
      const solution = JSON.parse(raw) as { projects?: Array<{ id?: string }> };
      return Array.isArray(solution.projects) && solution.projects.some(project => project?.id === projectId);
    } catch {
      return false;
    }
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

  private moduleLinksPath(): string {
    return path.join(this.lingBuilderDir(), MODULE_LINKS_FILE);
  }

  private async readModuleDevLinks(): Promise<Record<string, ModuleDevLink>> {
    const registry = await readJsonFile<ModuleDevLinkRegistry>(this.moduleLinksPath(), { schemaVersion: 1, links: {} });
    const links: Record<string, ModuleDevLink> = {};
    for (const [key, value] of Object.entries(registry?.links || {})) {
      const moduleId = typeof value?.moduleId === 'string' && value.moduleId ? value.moduleId : key;
      if (!moduleId || typeof value?.sourcePath !== 'string' || !value.sourcePath) continue;
      if (BUILTIN_MODULES.some(module => module.id === moduleId)) continue;
      links[moduleId] = { moduleId, sourcePath: value.sourcePath, linkedAt: String(value.linkedAt || '') };
    }
    return links;
  }

  private async writeModuleDevLinks(links: Record<string, ModuleDevLink>): Promise<void> {
    await fs.mkdir(this.lingBuilderDir(), { recursive: true });
    const registry: ModuleDevLinkRegistry = { schemaVersion: 1, links };
    await fs.writeFile(this.moduleLinksPath(), `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
  }

  private resolveDevLinkDir(link: ModuleDevLink): string {
    return path.resolve(this.workspaceRoot, ...link.sourcePath.replace(/\\/gu, '/').split('/').filter(Boolean));
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

export function createModuleService(workspaceRoot: string, options: ModuleServiceOptions = {}): ModuleService {
  return new ModuleService(workspaceRoot, options);
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
