import fs from 'node:fs/promises';
import path from 'node:path';

export interface WorkspaceState {
  schemaVersion: 1;
  lastWorkspace: string;
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
    if (requested) return await this.rememberWorkspace(requested);

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
    await fs.writeFile(this.statePath, JSON.stringify({
      schemaVersion: 1,
      lastWorkspace: resolved
    } satisfies WorkspaceState, null, 2), 'utf8');
    return resolved;
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
      const parsed = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as Partial<WorkspaceState>;
      if (parsed.schemaVersion !== 1 || typeof parsed.lastWorkspace !== 'string') return undefined;
      return parsed as WorkspaceState;
    } catch {
      return undefined;
    }
  }

  private async assertWorkspaceDirectory(resolved: string): Promise<void> {
    const stat = await fs.stat(resolved);
    if (!stat.isDirectory()) throw new Error(`工作区不是目录：${resolved}`);
  }
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
