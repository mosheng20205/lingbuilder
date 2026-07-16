import fs from 'node:fs/promises';
import path from 'node:path';

export interface WorkspaceState {
  schemaVersion: 2;
  lastWorkspace: string;
  recentWorkspaces: string[];
  window?: { x: number; y: number; width: number; height: number; maximized: boolean };
}

export interface DesktopWorkspaceServiceOptions {
  argv: string[];
  documentsPath: string;
  userDataPath: string;
  defaultWorkspaceSource?: string;
  seedVersion?: string;
}

export class DesktopWorkspaceService {
  private readonly statePath: string;

  constructor(private readonly options: DesktopWorkspaceServiceOptions) {
    this.statePath = path.join(options.userDataPath, 'workspace-state.json');
  }

  async resolveInitialWorkspace(fallbackWorkspace?: string): Promise<string> {
    const requested = getArgumentValue(this.options.argv, '--workspace');
    if (requested) {
      const target = await pathExists(requested) ? await resolveWorkspaceDropTarget(requested) : requested;
      return await this.rememberWorkspace(target);
    }
    const associatedFile = this.options.argv.slice(1).find(value => value && !value.startsWith('-'));
    if (associatedFile) {
      try { return await this.rememberWorkspace(await resolveWorkspaceDropTarget(associatedFile)); }
      catch { /* Ignore executable/bootstrap arguments that are not workspace targets. */ }
    }

    const state = await this.readState();
    if (state?.lastWorkspace && await isDirectory(state.lastWorkspace)) {
      return path.resolve(state.lastWorkspace);
    }

    if (fallbackWorkspace) return await this.rememberWorkspace(fallbackWorkspace);

    const seededWorkspace = await this.seedDefaultWorkspace();
    return await this.rememberWorkspace(seededWorkspace);
  }

  async rememberWorkspace(workspacePath: string): Promise<string> {
    const resolved = path.resolve(workspacePath);
    await fs.mkdir(resolved, { recursive: true });
    await this.assertWorkspaceDirectory(resolved);
    await fs.mkdir(path.dirname(this.statePath), { recursive: true });
    const previous = await this.readState();
    await this.writeState({
      schemaVersion: 2,
      lastWorkspace: resolved,
      recentWorkspaces: [resolved, ...(previous?.recentWorkspaces || []).filter(item => !samePath(item, resolved))].slice(0, 10),
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
    await this.writeState(state);
  }

  async rememberWindowState(windowState: WorkspaceState['window']): Promise<void> {
    const state = await this.readState() || { schemaVersion: 2, lastWorkspace: '', recentWorkspaces: [] };
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

  async seedDefaultWorkspace(): Promise<string> {
    const target = path.join(this.options.documentsPath, 'LingBuilder', '示例工作区');
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

  private async readState(): Promise<WorkspaceState | undefined> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as {
        schemaVersion?: number; lastWorkspace?: unknown; recentWorkspaces?: unknown; window?: WorkspaceState['window'];
      };
      if ((parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) || typeof parsed.lastWorkspace !== 'string') return undefined;
      return {
        schemaVersion: 2,
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

export async function resolveWorkspaceDropTarget(targetPath: string): Promise<string> {
  const resolved = path.resolve(targetPath);
  const stat = await fs.stat(resolved);
  if (stat.isDirectory()) return resolved;
  if (!stat.isFile()) throw new Error(`不支持的工作区目标：${targetPath}`);
  if (resolved.toLowerCase().endsWith('.lbsln')) return await resolveSolutionEntryWorkspace(resolved);
  if (!/\.(?:sln|code-workspace|lingbuilder|lbworkspace|lcpp|e)$/iu.test(resolved)) {
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
      : [path.resolve(options.mainEntryPath), '--workspace', workspacePath, '--new-window']
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
