import fs from 'node:fs/promises';
import path from 'node:path';

export type CliIntegrationState =
  | 'ready'
  | 'path-missing'
  | 'launcher-missing'
  | 'check-failed'
  | 'development';

export interface CliIntegrationStatus {
  supported: boolean;
  packaged: boolean;
  state: CliIntegrationState;
  launcherPath: string;
  launcherExists: boolean;
  pathConfigured: boolean;
  commandAvailable: boolean;
  version: string | null;
  detail: string;
}

export interface CliIntegrationInspectionOptions {
  packaged: boolean;
  installDirectory: string;
  launcherPath: string;
  userPath: string;
  runVersion: () => Promise<string>;
}

export function normalizePathEntry(value: string): string {
  const trimmed = String(value || '').trim().replace(/^"|"$/gu, '');
  if (!trimmed) return '';
  return path.normalize(trimmed).replace(/[\\/]+$/gu, '').toLocaleLowerCase('en-US');
}

export function pathContainsDirectory(pathValue: string, directory: string): boolean {
  const expected = normalizePathEntry(directory);
  if (!expected) return false;
  return String(pathValue || '')
    .split(';')
    .some(entry => normalizePathEntry(entry) === expected);
}

export async function inspectCliIntegration(
  options: CliIntegrationInspectionOptions
): Promise<CliIntegrationStatus> {
  const launcherExists = await fs.access(options.launcherPath).then(() => true).catch(() => false);
  const pathConfigured = pathContainsDirectory(options.userPath, options.installDirectory);

  if (!options.packaged) {
    return {
      supported: true,
      packaged: false,
      state: 'development',
      launcherPath: options.launcherPath,
      launcherExists,
      pathConfigured,
      commandAvailable: false,
      version: null,
      detail: '当前是开发版；请通过 npm run ai-server 或打包后的 lingbuilder 命令使用 CLI。'
    };
  }

  if (!launcherExists) {
    return {
      supported: true,
      packaged: true,
      state: 'launcher-missing',
      launcherPath: options.launcherPath,
      launcherExists: false,
      pathConfigured,
      commandAvailable: false,
      version: null,
      detail: '安装目录中缺少 lingbuilder.cmd，请重新安装 LingBuilder。'
    };
  }

  try {
    const version = (await options.runVersion()).trim();
    if (!/^LingBuilder CLI \d+\.\d+\.\d+$/u.test(version)) {
      throw new Error(`CLI 返回了意外的版本信息：${version || '无输出'}`);
    }
    return {
      supported: true,
      packaged: true,
      state: pathConfigured ? 'ready' : 'path-missing',
      launcherPath: options.launcherPath,
      launcherExists: true,
      pathConfigured,
      commandAvailable: pathConfigured,
      version,
      detail: pathConfigured
        ? 'CLI 启动器、内置运行时和当前用户 PATH 均已就绪。'
        : 'CLI 可通过安装目录运行，但当前用户 PATH 未包含 LingBuilder 安装目录。'
    };
  } catch (error) {
    return {
      supported: true,
      packaged: true,
      state: 'check-failed',
      launcherPath: options.launcherPath,
      launcherExists: true,
      pathConfigured,
      commandAvailable: false,
      version: null,
      detail: `CLI 版本检查失败：${error instanceof Error ? error.message : String(error)}`
    };
  }
}

