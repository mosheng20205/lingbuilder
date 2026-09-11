import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

/** 探测不到本机 MSVC 平台工具集时的保底值，与历史导出行为一致（VS2022 及更早的默认工具集）。 */
export const FALLBACK_MSVC_PLATFORM_TOOLSET = 'v143';

export interface MsvcPlatformToolsetProbe {
  /** 钉入 vcxproj 的平台工具集，例如 v145、v143。 */
  toolset: string;
  /** detected 表示取自本机 Visual Studio 安装；fallback 表示未探测到，使用保底值。 */
  source: 'detected' | 'fallback';
  installationPath?: string;
}

export interface MsvcPlatformToolsetCommandResult {
  exitCode: number;
  stdout: string;
}

export interface MsvcPlatformToolsetDetectorDependencies {
  platform?: NodeJS.Platform;
  environment?: NodeJS.ProcessEnv;
  /** 显式指定 vswhere.exe 路径；传 null 表示跳过探测直接回退，便于测试。 */
  vswhereExecutable?: string | null;
  runCommand?: (command: string, args: readonly string[], timeoutMs: number) => Promise<MsvcPlatformToolsetCommandResult | null>;
  fileExists?: (filePath: string) => Promise<boolean>;
  directoryExists?: (directoryPath: string) => Promise<boolean>;
  readSubdirectoryNames?: (directoryPath: string) => Promise<string[]>;
}

interface ResolvedDetectorDependencies {
  platform: NodeJS.Platform;
  environment: NodeJS.ProcessEnv;
  vswhereExecutable?: string | null;
  runCommand: (command: string, args: readonly string[], timeoutMs: number) => Promise<MsvcPlatformToolsetCommandResult | null>;
  fileExists: (filePath: string) => Promise<boolean>;
  directoryExists: (directoryPath: string) => Promise<boolean>;
  readSubdirectoryNames: (directoryPath: string) => Promise<string[]>;
}

const VSWHERE_QUERY_TIMEOUT_MS = 8_000;
/** vcxproj 会同时声明 Win32 与 x64 配置，工具集必须在这两个平台目录下都存在。 */
const REQUIRED_PLATFORM_DIRECTORIES = ['Win32', 'x64'] as const;

/**
 * 探测本机 Visual Studio 实际可用的最新 MSVC 平台工具集（v145、v143 等）。
 * 以 vswhere 找到的最新 C++ 安装下 MSBuild 的 PlatformToolsets 目录为准，
 * 这是 MSBuild 解析工具集的同一份目录，能避免生成 MSB8020 无法编译的导出工程。
 */
export async function detectLatestMsvcPlatformToolset(
  dependencies: MsvcPlatformToolsetDetectorDependencies = {}
): Promise<MsvcPlatformToolsetProbe> {
  const resolved = resolveDependencies(dependencies);
  if (resolved.platform !== 'win32') return createFallbackProbe();

  const vswhereExecutable = resolved.vswhereExecutable !== undefined
    ? resolved.vswhereExecutable
    : await findVswhereExecutable(resolved);
  if (!vswhereExecutable) return createFallbackProbe();

  const queryResult = await resolved.runCommand(vswhereExecutable, [
    '-latest',
    '-products',
    '*',
    '-requires',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    '-property',
    'installationPath'
  ], VSWHERE_QUERY_TIMEOUT_MS);
  const installationPath = queryResult && queryResult.exitCode === 0
    ? firstInstallationPath(queryResult.stdout)
    : null;
  if (!installationPath) return createFallbackProbe();

  const toolset = await collectLatestCommonToolset(installationPath, resolved);
  if (!toolset) return createFallbackProbe();
  return { toolset, source: 'detected', installationPath };
}

export function parseToolsetVersionNumber(toolsetName: string): number | null {
  const match = toolsetName.trim().match(/^v(\d+)$/u);
  return match ? Number.parseInt(match[1]!, 10) : null;
}

async function collectLatestCommonToolset(
  installationPath: string,
  dependencies: ResolvedDetectorDependencies
): Promise<string | null> {
  const vcRoot = path.win32.join(installationPath, 'MSBuild', 'Microsoft', 'VC');
  if (!(await dependencies.directoryExists(vcRoot))) return null;

  let versionDirectoryNames: string[];
  try {
    versionDirectoryNames = await dependencies.readSubdirectoryNames(vcRoot);
  } catch {
    return null;
  }
  const toolsetsByPlatform = new Map<string, Set<number>>();
  for (const versionDirectoryName of versionDirectoryNames) {
    const platformsDirectory = path.win32.join(vcRoot, versionDirectoryName, 'Platforms');
    let platformDirectoryNames: string[];
    try {
      platformDirectoryNames = await dependencies.readSubdirectoryNames(platformsDirectory);
    } catch {
      continue;
    }
    for (const platformName of platformDirectoryNames) {
      if (!(REQUIRED_PLATFORM_DIRECTORIES as readonly string[]).includes(platformName)) continue;
      let toolsetDirectoryNames: string[];
      try {
        toolsetDirectoryNames = await dependencies.readSubdirectoryNames(
          path.win32.join(platformsDirectory, platformName, 'PlatformToolsets')
        );
      } catch {
        continue;
      }
      const versions = toolsetsByPlatform.get(platformName) ?? new Set<number>();
      for (const toolsetDirectoryName of toolsetDirectoryNames) {
        const version = parseToolsetVersionNumber(toolsetDirectoryName);
        if (version !== null) versions.add(version);
      }
      toolsetsByPlatform.set(platformName, versions);
    }
  }

  const platformSets = [...toolsetsByPlatform.values()];
  if (platformSets.length === 0) return null;
  const commonVersions = platformSets.reduce((accumulated, versions) =>
    new Set([...accumulated].filter(version => versions.has(version))));
  const latestVersion = [...commonVersions].sort((left, right) => right - left)[0];
  return latestVersion === undefined ? null : `v${latestVersion}`;
}

async function findVswhereExecutable(dependencies: ResolvedDetectorDependencies): Promise<string | null> {
  const programFilesX86 = dependencies.environment['ProgramFiles(x86)'];
  if (programFilesX86) {
    const candidate = path.win32.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    if (await dependencies.fileExists(candidate)) return candidate;
  }
  const pathLookup = await dependencies.runCommand('where.exe', ['vswhere.exe'], 5_000);
  return pathLookup && pathLookup.exitCode === 0 ? firstInstallationPath(pathLookup.stdout) : null;
}

function firstInstallationPath(output: string): string | null {
  return output.split(/\r?\n/u).map(line => line.trim())
    .find(line => /^[A-Za-z]:[\\/]/u.test(line) || /^\\\\/u.test(line)) || null;
}

function createFallbackProbe(): MsvcPlatformToolsetProbe {
  return { toolset: FALLBACK_MSVC_PLATFORM_TOOLSET, source: 'fallback' };
}

function resolveDependencies(
  dependencies: MsvcPlatformToolsetDetectorDependencies
): ResolvedDetectorDependencies {
  return {
    platform: dependencies.platform ?? process.platform,
    environment: dependencies.environment ?? process.env,
    vswhereExecutable: dependencies.vswhereExecutable,
    runCommand: dependencies.runCommand ?? defaultRunCommand,
    fileExists: dependencies.fileExists ?? defaultFileExists,
    directoryExists: dependencies.directoryExists ?? defaultDirectoryExists,
    readSubdirectoryNames: dependencies.readSubdirectoryNames ?? defaultReadSubdirectoryNames
  };
}

const execFileAsync = promisify(execFile);

const defaultRunCommand: ResolvedDetectorDependencies['runCommand'] = async (command, args, timeoutMs) => {
  try {
    const result = await execFileAsync(command, [...args], { timeout: timeoutMs, windowsHide: true, encoding: 'utf8' });
    return { exitCode: 0, stdout: String(result.stdout || '') };
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    return {
      exitCode: typeof code === 'number' ? code : 1,
      stdout: String((error as { stdout?: unknown }).stdout || '')
    };
  }
};

const defaultFileExists: ResolvedDetectorDependencies['fileExists'] = async filePath => {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
};

const defaultDirectoryExists: ResolvedDetectorDependencies['directoryExists'] = async directoryPath => {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
};

const defaultReadSubdirectoryNames: ResolvedDetectorDependencies['readSubdirectoryNames'] = async directoryPath => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.filter(entry => entry.isDirectory()).map(entry => entry.name);
};
