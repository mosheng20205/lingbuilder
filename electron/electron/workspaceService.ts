import fs from 'node:fs/promises';
import path from 'node:path';
import { createLcppSourcePackageService, isLcppSourcePackagePath } from './lcppSourcePackageService';

export interface WorkspaceState {
  schemaVersion: 3;
  profile: 'development' | 'packaged';
  lastWorkspace: string;
  recentWorkspaces: string[];
  window?: { x: number; y: number; width: number; height: number; maximized: boolean };
}

/** 最近工作区最多保留的条数；超出后最旧的记录被丢弃。 */
export const RECENT_WORKSPACES_LIMIT = 200;

export interface DesktopWorkspaceServiceOptions {
  argv: string[];
  documentsPath: string;
  userDataPath: string;
  defaultWorkspaceSource?: string;
  /** 安装包随附的固定版本 Protobuf SDK 根目录；工作区缺失时自动铺设。 */
  bundledProtobufSdkSource?: string;
  seedVersion?: string;
  profile?: WorkspaceState['profile'];
}

/**
 * 记录初始工作区是怎么定下来的。双击 `.lcpppkg` 或把工作区文件夹拖到 exe 上时是
 * `associated-file`；桌面宿主据此跳过欢迎页，直接进工作台。
 */
export type InitialWorkspaceSource = 'argument' | 'associated-file' | 'associated-directory' | 'state' | 'fallback' | 'seed';

export class DesktopWorkspaceService {
  private readonly statePath: string;
  private readonly profile: WorkspaceState['profile'];
  private initialWorkspaceSource: InitialWorkspaceSource = 'seed';

  constructor(private readonly options: DesktopWorkspaceServiceOptions) {
    this.profile = options.profile || 'development';
    this.statePath = path.join(
      options.userDataPath,
      this.profile === 'packaged' ? 'workspace-state.packaged.json' : 'workspace-state.json'
    );
  }

  /** 最近一次 `resolveInitialWorkspace` 的来源；未解析过时为 `seed`。 */
  get lastInitialWorkspaceSource(): InitialWorkspaceSource {
    return this.initialWorkspaceSource;
  }

  async resolveInitialWorkspace(fallbackWorkspace?: string): Promise<string> {
    const requested = getArgumentValue(this.options.argv, '--workspace');
    if (requested) {
      const target = await pathExists(requested) ? await this.resolveWorkspaceTarget(requested) : requested;
      this.initialWorkspaceSource = 'argument';
      return await this.rememberWorkspace(target);
    }
    const associatedFile = this.options.argv.slice(1).find(value => value && !value.startsWith('-'));
    if (associatedFile) {
      try {
        const target = await this.resolveWorkspaceTarget(associatedFile);
        // 只有「双击一个文件」才算文件关联启动。开发态 `electron .` 传的是目录，
        // 仍按普通启动处理，欢迎页行为不变。
        this.initialWorkspaceSource = await isDirectory(path.resolve(associatedFile))
          ? 'associated-directory'
          : 'associated-file';
        return await this.rememberWorkspace(target);
      } catch { /* Ignore executable/bootstrap arguments that are not workspace targets. */ }
    }

    const state = await this.readState();
    if (state?.lastWorkspace && await isDirectory(state.lastWorkspace)) {
      this.initialWorkspaceSource = 'state';
      const remembered = path.resolve(state.lastWorkspace);
      // 这条路径不经过 rememberWorkspace，也要补齐随附工具链，否则老工作区第一次
      // 用到 Protobuf 模块仍会因缺 SDK 阻断构建。
      await this.ensureBundledToolchains(remembered);
      await this.ensureBundledModules(remembered);
      return remembered;
    }

    if (fallbackWorkspace) {
      this.initialWorkspaceSource = 'fallback';
      return await this.rememberWorkspace(fallbackWorkspace);
    }

    const seededWorkspace = await this.seedDefaultWorkspace();
    this.initialWorkspaceSource = 'seed';
    return await this.rememberWorkspace(seededWorkspace);
  }

  async rememberWorkspace(workspacePath: string): Promise<string> {
    const resolved = path.resolve(workspacePath);
    await fs.mkdir(resolved, { recursive: true });
    await this.assertWorkspaceDirectory(resolved);
    await this.ensureBundledToolchains(resolved);
    await this.ensureBundledModules(resolved);
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    const previous = await this.readState();
    await this.writeState({
      schemaVersion: 3,
      profile: this.profile,
      lastWorkspace: resolved,
      recentWorkspaces: [resolved, ...(previous?.recentWorkspaces || []).filter(item => !samePath(item, resolved))].slice(0, RECENT_WORKSPACES_LIMIT),
      window: previous?.window
    });
    return resolved;
  }

  async listRecentWorkspaces(): Promise<string[]> {
    const state = await this.readState();
    const existing: string[] = [];
    for (const workspacePath of state?.recentWorkspaces || []) {
      if (await isDirectory(workspacePath)) existing.push(path.resolve(workspacePath));
    }
    return existing;
  }

  async forgetWorkspace(workspacePath: string): Promise<void> {
    const state = await this.readState();
    if (!state) return;
    state.recentWorkspaces = state.recentWorkspaces.filter(item => !samePath(item, workspacePath));
    if (samePath(state.lastWorkspace, workspacePath)) state.lastWorkspace = '';
    await this.writeState(state);
  }

  async createFreshWorkspace(): Promise<string> {
    const parent = path.join(this.options.documentsPath, 'LingBuilder');
    await fs.mkdir(parent, { recursive: true });
    let suffix = 1;
    let target = path.join(parent, '新建工作区');
    while (await pathExists(target)) {
      suffix += 1;
      target = path.join(parent, `新建工作区 ${suffix}`);
    }
    await fs.mkdir(target, { recursive: true });
    if (this.options.defaultWorkspaceSource && await isDirectory(this.options.defaultWorkspaceSource)) {
      await copyMissingFiles(this.options.defaultWorkspaceSource, target);
    }
    return target;
  }

  async rememberWindowState(windowState: WorkspaceState['window']): Promise<void> {
    const state = await this.readState() || {
      schemaVersion: 3,
      profile: this.profile,
      lastWorkspace: '',
      recentWorkspaces: []
    };
    state.window = windowState;
    await this.writeState(state);
  }

  async getWindowState(): Promise<WorkspaceState['window']> {
    return (await this.readState())?.window;
  }

  async validateWorkspace(workspacePath: string): Promise<string> {
    const resolved = path.resolve(workspacePath);
    await this.assertWorkspaceDirectory(resolved);
    return resolved;
  }

  async resolveWorkspaceTarget(targetPath: string): Promise<string> {
    const resolved = path.resolve(targetPath);
    if (isLcppSourcePackagePath(resolved)) {
      const destinationParent = path.join(this.options.documentsPath, 'LingBuilder', '已导入源码');
      const imported = await createLcppSourcePackageService(path.dirname(resolved)).importPackage(resolved, destinationParent);
      return imported.workspacePath;
    }
    return await resolveWorkspaceDropTarget(resolved);
  }

  async seedDefaultWorkspace(): Promise<string> {
    const target = path.join(this.options.documentsPath, 'LingBuilder', '起始工作区');
    await fs.mkdir(target, { recursive: true });
    if (this.options.defaultWorkspaceSource && await isDirectory(this.options.defaultWorkspaceSource)) {
      await copyMissingFiles(this.options.defaultWorkspaceSource, target);
    }

    const markerDir = path.join(target, '.lingbuilder');
    const markerPath = path.join(markerDir, 'seed.json');
    await fs.mkdir(markerDir, { recursive: true });
    await fs.writeFile(markerPath, JSON.stringify({
      schemaVersion: 1,
      seedVersion: this.options.seedVersion || '0.1.0'
    }, null, 2), 'utf8');
    return target;
  }

  /**
   * 把安装包随附的固定版本工具链（当前只有 Protobuf SDK）铺进工作区。
   * 只补缺失文件、绝不覆盖用户已有内容（包括用户自备的同版本 SDK）；
   * 每次打开工作区都补一次，可以自愈上次中断留下的半份拷贝。失败不阻断
   * 打开工作区——真正用到时构建链路会给出明确的中文 SDK 校验诊断。
   */
  async ensureBundledToolchains(workspacePath: string): Promise<void> {
    const source = this.options.bundledProtobufSdkSource;
    if (!source || !await isDirectory(source)) return;
    const target = path.join(workspacePath, '.lingbuilder', 'toolchains', 'protobuf');
    try {
      await copyMissingFiles(source, target);
    } catch (error) {
      console.warn(`铺设 Protobuf 工具链失败（构建时会给出明确诊断）：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 把安装包随附的 default-workspace 模块（当前为 lingbuilder.new_emoji.ui 等）
   * 同步进工作区。随包模块是 IDE 托管的版本化内容，不是用户内容：清单损坏、
   * 版本低于随包副本、或与随包副本同版本但内容漂移时，整个模块目录以随包为准
   * 重建；清单缺失（半成品目录）等其余情况保持「只补缺失文件」不动用户已有
   * 内容。已链接开发源的模块不参与同步。每次打开工作区都执行，升级安装后老
   * 工作区自动拿到新模块，也能自愈历史遗留的旧清单（例如 cb 回调参数仍为 raw
   * 的 pre-2.0 生成物，会被新版清单校验整卡拒绝）。开发态没有 default-workspace
   * 时自动跳过。失败不阻断打开工作区——模块面板仍有「修复重装」入口。
   */
  async ensureBundledModules(workspacePath: string): Promise<void> {
    const source = this.options.defaultWorkspaceSource
      ? path.join(this.options.defaultWorkspaceSource, '.lingbuilder', 'modules')
      : undefined;
    if (!source || !await isDirectory(source)) return;
    const target = path.join(workspacePath, '.lingbuilder', 'modules');
    const linkedModuleIds = new Set<string>();
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(workspacePath, '.lingbuilder', 'module-links.json'), 'utf8')) as {
        links?: Record<string, unknown>;
      };
      for (const moduleId of Object.keys(parsed?.links || {})) linkedModuleIds.add(moduleId);
    } catch {
      // 无链接登记表时按目录逐一同步。
    }
    let entries;
    try {
      entries = await fs.readdir(source, { withFileTypes: true });
    } catch (error) {
      console.warn(`读取随包模块目录失败：${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || linkedModuleIds.has(entry.name)) continue;
      const sourceDir = path.join(source, entry.name);
      const targetDir = path.join(target, entry.name);
      try {
        if (!entry.isDirectory()) {
          // 目录外的零散文件保持旧的只补缺语义。
          if (!await pathExists(targetDir)) {
            await fs.mkdir(path.dirname(targetDir), { recursive: true });
            await fs.copyFile(sourceDir, targetDir);
          }
          continue;
        }
        if (await shouldReplaceBundledModuleDir(sourceDir, targetDir)) {
          await fs.rm(targetDir, { recursive: true, force: true });
        }
        await copyMissingFiles(sourceDir, targetDir);
      } catch (error) {
        console.warn(`同步随包模块 ${entry.name} 失败（可在模块面板修复重装）：${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  private async readState(): Promise<WorkspaceState | undefined> {    try {
      const parsed = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as {
        schemaVersion?: number;
        profile?: unknown;
        lastWorkspace?: unknown;
        recentWorkspaces?: unknown;
        window?: WorkspaceState['window'];
      };
      if (![1, 2, 3].includes(parsed.schemaVersion || 0) || typeof parsed.lastWorkspace !== 'string') return undefined;
      if (parsed.schemaVersion === 3 && parsed.profile !== this.profile) return undefined;
      if (parsed.schemaVersion !== 3 && this.profile !== 'development') return undefined;
      return {
        schemaVersion: 3,
        profile: this.profile,
        lastWorkspace: parsed.lastWorkspace,
        recentWorkspaces: Array.isArray(parsed.recentWorkspaces)
          ? parsed.recentWorkspaces.filter((item: unknown): item is string => typeof item === 'string')
          : [parsed.lastWorkspace],
        window: parsed.window
      };
    } catch {
      return undefined;
    }
  }

  private async assertWorkspaceDirectory(resolved: string): Promise<void> {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) throw new Error(`工作区不是目录：${resolved}`);
  }

  private async writeState(state: WorkspaceState): Promise<void> {
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    const temporaryPath = `${this.statePath}.${process.pid}.tmp`;
    await fs.writeFile(temporaryPath, JSON.stringify(state, null, 2), 'utf8');
    await fs.rename(temporaryPath, this.statePath);
  }
}

/** 允许「以文件打开工作区」的全部扩展名；second-instance 转交与拖放必须保持同一口径。 */
const WORKSPACE_FILE_PATTERN = /\.(?:lbsln|sln|code-workspace|lingbuilder|lbworkspace|lcpp|e)$/iu;

export function isWorkspaceFilePath(value: string): boolean {
  return WORKSPACE_FILE_PATTERN.test(value);
}

/** 从命令行参数里找出被双击的工作区类文件（`.lbsln` 等），与 `findLbmodArgument` 同一口径。 */
export const findWorkspaceFileArgument = (argv: readonly string[]): string | undefined =>
  argv.slice(1).find(value => value && !value.startsWith('-') && isWorkspaceFilePath(value));

export async function resolveWorkspaceDropTarget(targetPath: string): Promise<string> {
  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) return resolved;
  if (!stat.isFile()) throw new Error(`不支持的工作区目标：${targetPath}`);
  if (resolved.toLowerCase().endsWith('.lbsln')) return await resolveSolutionEntryWorkspace(resolved);
  if (!isWorkspaceFilePath(resolved)) {
    throw new Error(`不支持通过该文件打开工作区：${path.basename(resolved)}`);
  }
  return path.dirname(resolved);
}

export function buildWorkspaceWindowLaunch(options: {
  packaged: boolean; executablePath: string; mainEntryPath: string; workspacePath: string;
}): { command: string; args: string[] } {
  const workspacePath = path.resolve(options.workspacePath);
  return {
    command: options.executablePath,
    args: options.packaged
      ? ['--workspace', workspacePath, '--new-window']
      : [path.resolve(options.mainEntryPath), '--workspace', workspacePath, '--new-window', '--managed-dev-server']
  };
}

export function getArgumentValue(argv: string[], name: string): string | undefined {
  const inlinePrefix = `${name}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === name) return argv[index + 1];
    if (value?.startsWith(inlinePrefix)) return value.slice(inlinePrefix.length);
  }
  return undefined;
}

/** 模块包 v2 固定清单文件名；与 src/services/modules 的 MODULE_MANIFEST_FILE 保持同一取值。 */
const BUNDLED_MODULE_MANIFEST_FILE = 'lingbuilder.module.json';

/**
 * 判定随包模块目录是否需要整体以随包副本重建。判定只依据清单（主进程不允许
 * 依赖 src 的校验器，用「与随包清单逐字节一致 / 版本号比较」代替结构校验）：
 * - 随包清单自身缺失或损坏 → 不替换，保持旧的只补缺语义。
 * - 工作区清单缺失 → 不替换，只补缺（半成品目录沿用历史语义，绝不覆盖已有文件）。
 * - 工作区清单与随包清单逐字节一致 → 不动。
 * - 工作区清单不是合法 JSON / 缺版本号 → 重建（自愈损坏清单）。
 * - 工作区版本高于随包 → 不动（用户手动装过更新版，不降级）。
 * - 其余（同版本内容漂移、工作区更旧）→ 重建。
 */
async function shouldReplaceBundledModuleDir(bundledDir: string, workspaceDir: string): Promise<boolean> {
  const bundledRaw = await readTextIfPossible(path.join(bundledDir, BUNDLED_MODULE_MANIFEST_FILE));
  if (bundledRaw === undefined) return false;
  const bundledVersion = parseManifestVersion(bundledRaw);
  if (bundledVersion === undefined) return false;
  const workspaceRaw = await readTextIfPossible(path.join(workspaceDir, BUNDLED_MODULE_MANIFEST_FILE));
  if (workspaceRaw === undefined) return false;
  if (workspaceRaw === bundledRaw) return false;
  const workspaceVersion = parseManifestVersion(workspaceRaw);
  if (workspaceVersion === undefined) return true;
  return compareModuleVersions(workspaceVersion, bundledVersion) <= 0;
}

async function readTextIfPossible(filePath: string): Promise<string | undefined> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

function parseManifestVersion(raw: string): string | undefined {
  try {
    const parsed = JSON.parse(raw) as { version?: unknown };
    return typeof parsed?.version === 'string' && parsed.version.trim() ? parsed.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

/** 点分数字版本号比较；非数字段按 0 处理，仅服务于随包模块的新旧判定。 */
function compareModuleVersions(a: string, b: string): number {
  const segmentsA = a.split('.').map(part => Number.parseInt(part, 10));
  const segmentsB = b.split('.').map(part => Number.parseInt(part, 10));
  const length = Math.max(segmentsA.length, segmentsB.length);
  for (let index = 0; index < length; index++) {
    const valueA = Number.isFinite(segmentsA[index]) ? segmentsA[index] : 0;
    const valueB = Number.isFinite(segmentsB[index]) ? segmentsB[index] : 0;
    if (valueA !== valueB) return valueA < valueB ? -1 : 1;
  }
  return 0;
}

async function copyMissingFiles(sourceRoot: string, targetRoot: string): Promise<void> {
  await fs.mkdir(targetRoot, { recursive: true });
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const sourcePath = path.join(sourceRoot, entry.name);
    const targetPath = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) {
      await copyMissingFiles(sourcePath, targetPath);
      continue;
    }
    if (!entry.isFile() || await pathExists(targetPath)) continue;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.copyFile(sourcePath, targetPath);
  }
}

async function isDirectory(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isDirectory();
  } catch {
    return false;
  }
}

async function pathExists(value: string): Promise<boolean> {
  try {
    await fs.access(value);
    return true;
  } catch {
    return false;
  }
}

async function resolveSolutionEntryWorkspace(entryPath: string): Promise<string> {
  const parsed = JSON.parse(await fs.readFile(entryPath, 'utf8')) as {
    schemaVersion?: unknown;
    kind?: unknown;
    solutionFile?: unknown;
  };
  if (parsed.schemaVersion !== 1 || parsed.kind !== 'lingbuilder-solution') {
    throw new Error(`不是有效的 LingBuilder 解决方案文件：${path.basename(entryPath)}`);
  }
  if (parsed.solutionFile !== '.lingbuilder/solution.json') {
    throw new Error('解决方案入口中的内部状态路径无效。');
  }
  const workspaceRoot = path.dirname(entryPath);
  const internalPath = path.resolve(workspaceRoot, parsed.solutionFile);
  if (path.dirname(internalPath) !== path.join(workspaceRoot, '.lingbuilder') || !await pathExists(internalPath)) {
    throw new Error(`解决方案内部状态文件不存在：${parsed.solutionFile}`);
  }
  return workspaceRoot;
}

function samePath(left: string, right: string): boolean {
  return path.resolve(left).localeCompare(path.resolve(right), undefined, { sensitivity: process.platform === 'win32' ? 'accent' : 'variant' }) === 0;
}
