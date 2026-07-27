import { execFile } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

export type EnvironmentCheckId =
  | 'node'
  | 'msvc'
  | 'windowsSdk'
  | 'cmake'
  | 'gpp'
  | 'clangpp'
  | 'webView2'
  | 'platform';

export interface EnvironmentCheckItem {
  available: boolean;
  version: string | null;
  path: string | null;
  detail: string;
}

export type EnvironmentChecks = Record<EnvironmentCheckId, EnvironmentCheckItem>;

export interface EnvironmentCheckResult {
  /** 默认 LingBuilder Win32/MSVC 构建链是否完整可用。 */
  ready: boolean;
  /** 是否至少存在一个可用的 C++ 编译器，包括可选的 g++/clang++。 */
  cppCompilerAvailable: boolean;
  /** 默认 LingBuilder Win32/MSVC 构建链是否完整可用。 */
  msvcBuildReady: boolean;
  warnings: string[];
  checkedAt: string;
  checks: EnvironmentChecks;
}

export interface EnvironmentCommandResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface EnvironmentCommandOptions {
  timeoutMs?: number;
  windowsVerbatimArguments?: boolean;
}

export type EnvironmentCommandRunner = (
  command: string,
  args: readonly string[],
  options?: EnvironmentCommandOptions
) => Promise<EnvironmentCommandResult>;

export interface EnvironmentCheckDependencies {
  commandRunner?: EnvironmentCommandRunner;
  environment?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  architecture?: string;
  osRelease?: string;
  nodeVersion?: string;
  nodePath?: string;
  now?: () => Date;
  overallTimeoutMs?: number;
}

interface ResolvedDependencies {
  commandRunner: EnvironmentCommandRunner;
  environment: NodeJS.ProcessEnv;
  platform: NodeJS.Platform;
  architecture: string;
  osRelease: string;
  nodeVersion: string;
  nodePath: string;
  now: () => Date;
  overallTimeoutMs: number;
}

interface MsvcDetection {
  item: EnvironmentCheckItem;
  setupBatch: string | null;
}

const WEBVIEW2_CLIENT_ID = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}';

/**
 * Detects the local toolchain without mutating the machine. Command execution and
 * runtime information are injectable so callers can test every branch deterministically.
 */
export class EnvironmentCheckService {
  private readonly dependencies: ResolvedDependencies;

  constructor(dependencies: EnvironmentCheckDependencies = {}) {
    this.dependencies = {
      commandRunner: dependencies.commandRunner || runEnvironmentCommand,
      environment: dependencies.environment || process.env,
      platform: dependencies.platform || process.platform,
      architecture: dependencies.architecture || process.arch,
      osRelease: dependencies.osRelease || os.release(),
      nodeVersion: dependencies.nodeVersion ?? process.versions.node,
      nodePath: dependencies.nodePath ?? process.execPath,
      now: dependencies.now || (() => new Date()),
      overallTimeoutMs: normalizeOverallTimeout(dependencies.overallTimeoutMs)
    };
  }

  async check(): Promise<EnvironmentCheckResult> {
    return await withOverallTimeout(this.performCheck(), this.dependencies.overallTimeoutMs);
  }

  private async performCheck(): Promise<EnvironmentCheckResult> {
    const { platform } = this.dependencies;
    const node = this.detectNode();
    const platformInfo = this.detectPlatform();

    const [msvcDetection, cmake, gpp, clangpp, webView2] = await Promise.all([
      this.detectMsvc(),
      this.detectCmake(),
      this.detectVersionedTool('g++', ['--version'], parseGppVersion, '未检测到 GNU C++ 编译器。'),
      this.detectVersionedTool('clang++', ['--version'], parseClangVersion, '未检测到 Clang C++ 编译器。'),
      this.detectWebView2()
    ]);
    const windowsSdk = await this.detectWindowsSdk(msvcDetection.setupBatch);
    const msvc = msvcDetection.item;

    const checks: EnvironmentChecks = {
      node,
      msvc,
      windowsSdk,
      cmake,
      gpp,
      clangpp,
      webView2,
      platform: platformInfo
    };
    const warnings = buildWarnings(checks);
    const cppCompilerAvailable = msvc.available || gpp.available || clangpp.available;
    const msvcBuildReady = platformInfo.available
      && node.available
      && msvc.available
      && windowsSdk.available;

    return {
      ready: msvcBuildReady,
      cppCompilerAvailable,
      msvcBuildReady,
      warnings,
      checkedAt: this.dependencies.now().toISOString(),
      checks
    };
  }

  private detectNode(): EnvironmentCheckItem {
    const { nodeVersion, nodePath } = this.dependencies;
    const version = normalizeVersion(nodeVersion);
    return {
      available: Boolean(version),
      version,
      path: nodePath || null,
      detail: version
        ? `LingBuilder 当前正在 Node.js ${version} 运行时上运行。`
        : '无法读取当前 Node.js 运行时版本。'
    };
  }

  private detectPlatform(): EnvironmentCheckItem {
    const { platform, architecture, osRelease, environment } = this.dependencies;
    const isWindows = platform === 'win32';
    return {
      available: isWindows,
      version: osRelease || null,
      path: environment.SystemRoot || environment.WINDIR || null,
      detail: isWindows
        ? `Windows ${architecture}（内核 ${osRelease || '未知'}）`
        : `当前平台为 ${platform} ${architecture}；LingBuilder 原生 Win32 构建需要 Windows。`
    };
  }

  private async detectVersionedTool(
    command: string,
    versionArgs: readonly string[],
    parseVersion: (output: string) => string | null,
    missingDetail: string
  ): Promise<EnvironmentCheckItem> {
    const executablePath = await this.locateTool(command);
    if (!executablePath) return unavailable(missingDetail);

    const versionResult = await this.run(executablePath, versionArgs, { timeoutMs: 5_000 });
    const output = combineOutput(versionResult);
    if (!versionResult || versionResult.exitCode !== 0) {
      return {
        available: false,
        version: parseVersion(output),
        path: executablePath,
        detail: `已找到 ${command}，但执行版本检查失败。`
      };
    }

    const version = parseVersion(output);
    return {
      available: true,
      version,
      path: executablePath,
      detail: version ? `已验证 ${command} ${version}。` : `已验证 ${command}，但未能解析版本号。`
    };
  }

  private async detectCmake(): Promise<EnvironmentCheckItem> {
    const fromPath = await this.detectVersionedTool(
      'cmake',
      ['--version'],
      parseCmakeVersion,
      '未检测到 CMake。'
    );
    if (fromPath.available) return fromPath;

    if (this.dependencies.platform !== 'win32') return fromPath;

    const programFiles = this.dependencies.environment.ProgramFiles;
    if (programFiles) {
      const standalonePath = path.join(programFiles, 'CMake', 'bin', 'cmake.exe');
      const standalone = await this.detectCmakeAtPath(standalonePath, '标准安装目录');
      if (standalone.available) return standalone;
    }

    const vswherePath = await this.findVswhere();
    if (!vswherePath) return fromPath;

    const relativeCmakePath = path.join(
      'Common7',
      'IDE',
      'CommonExtensions',
      'Microsoft',
      'CMake',
      'CMake',
      'bin',
      'cmake.exe'
    );
    const latestFindResult = await this.run(vswherePath, [
      '-latest',
      '-products',
      '*',
      '-find',
      relativeCmakePath
    ], { timeoutMs: 8_000 });
    let visualStudioCmakePath = latestFindResult?.exitCode === 0
      ? firstPathLine(latestFindResult.stdout)
      : null;
    if (!visualStudioCmakePath) {
      const fallbackFindResult = await this.run(vswherePath, [
        '-products',
        '*',
        '-find',
        relativeCmakePath
      ], { timeoutMs: 8_000 });
      visualStudioCmakePath = fallbackFindResult?.exitCode === 0
        ? firstPathLine(fallbackFindResult.stdout)
        : null;
    }
    if (!visualStudioCmakePath) return fromPath;

    return await this.detectCmakeAtPath(visualStudioCmakePath, 'Visual Studio Installer');
  }

  private async detectCmakeAtPath(
    executablePath: string,
    source: string
  ): Promise<EnvironmentCheckItem> {
    const versionResult = await this.run(executablePath, ['--version'], { timeoutMs: 5_000 });
    const output = combineOutput(versionResult);
    const version = parseCmakeVersion(output);
    if (!versionResult || versionResult.exitCode !== 0) {
      return {
        available: false,
        version,
        path: executablePath,
        detail: `已在 ${source} 找到 CMake，但执行版本检查失败。`
      };
    }

    return {
      available: true,
      version,
      path: executablePath,
      detail: version
        ? `已通过 ${source} 验证 CMake ${version}。`
        : `已通过 ${source} 验证 CMake，但未能解析版本号。`
    };
  }

  private async detectMsvc(): Promise<MsvcDetection> {
    if (this.dependencies.platform !== 'win32') {
      return { item: unavailable('MSVC 仅在 Windows 开发环境中可用。'), setupBatch: null };
    }

    const directClPath = await this.locateTool('cl.exe');
    if (directClPath) {
      const versionResult = await this.run(directClPath, ['/Bv'], { timeoutMs: 8_000 });
      const version = parseMsvcVersion(combineOutput(versionResult));
      return {
        item: {
          available: Boolean(versionResult && (versionResult.exitCode === 0 || combineOutput(versionResult).trim())),
          version,
          path: directClPath,
          detail: version
            ? `已从 PATH 验证 MSVC ${version}。`
            : '已从 PATH 找到 cl.exe，但未能解析版本号。'
        },
        setupBatch: null
      };
    }

    const vswherePath = await this.findVswhere();
    if (!vswherePath) {
      return { item: unavailable('未在 PATH 或 Visual Studio Installer 中检测到 MSVC。'), setupBatch: null };
    }

    const installationResult = await this.run(vswherePath, [
      '-latest',
      '-products',
      '*',
      '-requires',
      'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
      '-property',
      'installationPath'
    ], { timeoutMs: 8_000 });
    const installationPath = firstPathLine(installationResult?.stdout || '');
    if (!installationResult || installationResult.exitCode !== 0 || !installationPath) {
      return {
        item: unavailable('已找到 vswhere，但未找到安装了 C++ 工具集的 Visual Studio。'),
        setupBatch: null
      };
    }

    const setupCandidates = this.createMsvcSetupCandidates(installationPath);
    for (const setupBatch of setupCandidates) {
      const commandText = `call ${quoteCmdPath(setupBatch)} >nul && where cl.exe && cl.exe /Bv`;
      const setupResult = await this.run('cmd.exe', ['/d', '/c', commandText], {
        timeoutMs: 20_000,
        windowsVerbatimArguments: true
      });
      const output = combineOutput(setupResult);
      const clPath = firstExecutablePath(output, 'cl.exe');
      const version = parseMsvcVersion(output);
      if (!setupResult || (!clPath && setupResult.exitCode !== 0 && !version)) continue;
      return {
        item: {
          available: true,
          version,
          path: clPath || setupBatch,
          detail: version
            ? `已通过 vswhere 和 ${path.basename(setupBatch)} 验证 MSVC ${version}。`
            : `已通过 vswhere 和 ${path.basename(setupBatch)} 验证 cl.exe。`
        },
        setupBatch
      };
    }

    return {
      item: unavailable('找到了 Visual Studio C++ 工具集，但 vcvars/VS 开发环境初始化失败。'),
      setupBatch: null
    };
  }

  private async detectWindowsSdk(msvcSetupBatch: string | null): Promise<EnvironmentCheckItem> {
    if (this.dependencies.platform !== 'win32') {
      return unavailable('Windows SDK 仅在 Windows 开发环境中可用。');
    }

    const directRcPath = await this.locateTool('rc.exe');
    if (directRcPath) {
      const versionResult = await this.run(directRcPath, ['/?'], { timeoutMs: 8_000 });
      const version = parseWindowsSdkVersion(combineOutput(versionResult), directRcPath);
      return {
        available: Boolean(versionResult && (versionResult.exitCode === 0 || combineOutput(versionResult).trim())),
        version,
        path: directRcPath,
        detail: version
          ? `已验证 Windows SDK 资源编译器 ${version}。`
          : '已找到 rc.exe，但未能解析 Windows SDK 版本。'
      };
    }

    if (msvcSetupBatch) {
      const commandText = `call ${quoteCmdPath(msvcSetupBatch)} >nul && where rc.exe && rc.exe /?`;
      const setupResult = await this.run('cmd.exe', ['/d', '/c', commandText], {
        timeoutMs: 20_000,
        windowsVerbatimArguments: true
      });
      const output = combineOutput(setupResult);
      const rcPath = firstExecutablePath(output, 'rc.exe');
      if (setupResult && (setupResult.exitCode === 0 || rcPath)) {
        const version = parseWindowsSdkVersion(output, rcPath);
        return {
          available: Boolean(rcPath),
          version,
          path: rcPath,
          detail: version
            ? `已通过 ${path.basename(msvcSetupBatch)} 验证 Windows SDK ${version}。`
            : '已通过 Visual Studio 开发环境找到 rc.exe。'
        };
      }
    }

    return unavailable('未检测到 Windows SDK 关键工具 rc.exe。');
  }

  private async detectWebView2(): Promise<EnvironmentCheckItem> {
    if (this.dependencies.platform !== 'win32') {
      return unavailable('WebView2 Runtime 仅在 Windows 上检测。');
    }

    const registryKeys = [
      `HKLM\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_ID}`,
      `HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_ID}`,
      `HKCU\\SOFTWARE\\Microsoft\\EdgeUpdate\\Clients\\${WEBVIEW2_CLIENT_ID}`
    ];

    for (const registryKey of registryKeys) {
      const result = await this.run('reg.exe', ['query', registryKey], { timeoutMs: 5_000 });
      if (!result || result.exitCode !== 0) continue;

      const version = readRegistryValue(result.stdout, 'pv');
      if (!version || version === '0.0.0.0') continue;
      const location = readRegistryValue(result.stdout, 'location');
      const executablePath = location
        ? resolveWebView2ExecutablePath(location, version)
        : this.inferWebView2Path(version);
      return {
        available: true,
        version,
        path: executablePath,
        detail: `已从 ${registryKey.startsWith('HKCU') ? '当前用户' : '本机'}注册表验证 WebView2 Runtime ${version}。`
      };
    }

    return unavailable('未在 Microsoft EdgeUpdate 注册表中检测到 WebView2 Runtime。');
  }

  private inferWebView2Path(version: string): string | null {
    const programFilesX86 = this.dependencies.environment['ProgramFiles(x86)'];
    if (!programFilesX86) return null;
    return path.join(programFilesX86, 'Microsoft', 'EdgeWebView', 'Application', version, 'msedgewebview2.exe');
  }

  private async findVswhere(): Promise<string | null> {
    const fromPath = await this.locateTool('vswhere.exe');
    if (fromPath) return fromPath;

    const programFilesX86 = this.dependencies.environment['ProgramFiles(x86)'];
    if (!programFilesX86) return null;
    const candidate = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
    const probe = await this.run(candidate, ['-?'], { timeoutMs: 5_000 });
    return probe && probe.exitCode === 0 ? candidate : null;
  }

  private createMsvcSetupCandidates(installationPath: string): string[] {
    const preferred = this.dependencies.architecture === 'x64' || this.dependencies.architecture === 'arm64'
      ? ['vcvars64.bat', 'vcvars32.bat']
      : ['vcvars32.bat', 'vcvars64.bat'];
    return [
      ...preferred.map(fileName => path.join(installationPath, 'VC', 'Auxiliary', 'Build', fileName)),
      path.join(installationPath, 'Common7', 'Tools', 'VsDevCmd.bat')
    ];
  }

  private async locateTool(command: string): Promise<string | null> {
    const locator = this.dependencies.platform === 'win32' ? 'where.exe' : 'which';
    const result = await this.run(locator, [command], { timeoutMs: 5_000 });
    if (!result || result.exitCode !== 0) return null;
    return firstPathLine(result.stdout);
  }

  private async run(
    command: string,
    args: readonly string[],
    options?: EnvironmentCommandOptions
  ): Promise<EnvironmentCommandResult | null> {
    try {
      return await this.dependencies.commandRunner(command, args, options);
    } catch {
      return null;
    }
  }
}

export async function checkDevelopmentEnvironment(
  dependencies: EnvironmentCheckDependencies = {}
): Promise<EnvironmentCheckResult> {
  return await new EnvironmentCheckService(dependencies).check();
}

export const runEnvironmentCommand: EnvironmentCommandRunner = async (command, args, options = {}) => {
  return await new Promise(resolve => {
    execFile(command, [...args], {
      timeout: options.timeoutMs || 5_000,
      windowsHide: true,
      windowsVerbatimArguments: options.windowsVerbatimArguments,
      encoding: 'utf8'
    }, (error, stdout, stderr) => {
      const errorCode = error && typeof (error as NodeJS.ErrnoException & { code?: unknown }).code === 'number'
        ? (error as NodeJS.ErrnoException & { code: number }).code
        : error ? -1 : 0;
      resolve({
        exitCode: errorCode,
        stdout: String(stdout || ''),
        stderr: String(stderr || '')
      });
    });
  });
};

function unavailable(detail: string): EnvironmentCheckItem {
  return { available: false, version: null, path: null, detail };
}

function buildWarnings(checks: EnvironmentChecks): string[] {
  const warnings: string[] = [];
  if (!checks.platform.available) warnings.push('当前不是 Windows 运行平台，无法执行 LingBuilder Win32 原生构建。');
  if (!checks.node.available) warnings.push('未检测到可用的 Node.js 运行时。');

  const hasCompiler = checks.msvc.available || checks.gpp.available || checks.clangpp.available;
  if (!hasCompiler) {
    warnings.push('未检测到可用的 C++ 编译器（MSVC、g++ 或 clang++）。');
  } else if (!checks.msvc.available) {
    warnings.push('未检测到 MSVC；LingBuilder 默认 Win32 原生构建及依赖 Visual Studio .lib 导入库的模块不可用。');
  }
  if (!checks.windowsSdk.available) warnings.push('未检测到 Windows SDK rc.exe，资源文件编译不可用。');
  if (!checks.cmake.available) warnings.push('未检测到 CMake，CMake 项目功能不可用。');
  if (!checks.webView2.available) warnings.push('未检测到 WebView2 Runtime，需要 WebView2 的原生预览功能可能不可用。');
  return warnings;
}

function combineOutput(result: EnvironmentCommandResult | null | undefined): string {
  if (!result) return '';
  return [result.stdout, result.stderr].filter(Boolean).join('\n');
}

function normalizeVersion(version: string | null | undefined): string | null {
  const normalized = version?.trim().replace(/^v/u, '');
  return normalized || null;
}

function parseCmakeVersion(output: string): string | null {
  return normalizeVersion(output.match(/cmake\s+version\s+([^\s]+)/iu)?.[1]);
}

function parseGppVersion(output: string): string | null {
  return normalizeVersion(
    output.match(/(?:g\+\+|gcc)[^\r\n]*?\b(\d+\.\d+(?:\.\d+)*)\b/iu)?.[1]
      || output.match(/\b(\d+\.\d+(?:\.\d+)*)\b/u)?.[1]
  );
}

function parseClangVersion(output: string): string | null {
  return normalizeVersion(output.match(/clang\s+version\s+(\d+(?:\.\d+)+)/iu)?.[1]);
}

function parseMsvcVersion(output: string): string | null {
  return normalizeVersion(
    output.match(/(?:C\/C\+\+\s+Optimizing\s+Compiler|Compiler)\s+Version\s+(\d+(?:\.\d+)+)/iu)?.[1]
      || output.match(/Version\s+(19\.\d+(?:\.\d+)*)/iu)?.[1]
      || output.match(/\b(19\.\d+(?:\.\d+)*)\b/u)?.[1]
  );
}

function parseWindowsSdkVersion(output: string, executablePath: string | null = null): string | null {
  const normalizedPath = executablePath?.replace(/\\/gu, '/');
  const fromPath = normalizedPath?.match(/Windows Kits\/\d+\/bin\/(\d+(?:\.\d+)+)\//iu)?.[1];
  if (fromPath) return normalizeVersion(fromPath);
  const fromOutput = output.match(/Resource\s+Compiler\s+Version\s+(\d+(?:\.\d+)+)/iu)?.[1]
    || output.match(/\bVersion\s+(\d{2}\.\d+(?:\.\d+)+)/iu)?.[1];
  return normalizeVersion(fromOutput);
}

function firstPathLine(output: string): string | null {
  const lines = output.split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return lines.find(line => /^[A-Za-z]:[\\/]/u.test(line) || /^\\\\/u.test(line) || /^\//u.test(line)) || null;
}

function firstExecutablePath(output: string, executableName: string): string | null {
  const expectedSuffix = executableName.toLowerCase();
  return output
    .split(/\r?\n/u)
    .map(line => line.trim())
    .find(line => line.toLowerCase().endsWith(expectedSuffix) && (/^[A-Za-z]:[\\/]/u.test(line) || /^\\\\/u.test(line)))
    || null;
}

function readRegistryValue(output: string, valueName: string): string | null {
  const escapedName = valueName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  const match = output.match(new RegExp(`^\\s*${escapedName}\\s+REG_\\w+\\s+(.+?)\\s*$`, 'imu'));
  return match?.[1]?.trim() || null;
}

function quoteCmdPath(value: string): string {
  return `"${value.replace(/"/gu, '""')}"`;
}

function resolveWebView2ExecutablePath(location: string, version: string): string {
  if (location.toLowerCase().endsWith('.exe')) return location;
  const locationEndsWithVersion = path.basename(path.normalize(location)).toLowerCase() === version.toLowerCase();
  return path.join(location, ...(locationEndsWithVersion ? [] : [version]), 'msedgewebview2.exe');
}

function normalizeOverallTimeout(value: number | undefined): number {
  if (value === undefined) return 30_000;
  const normalized = Math.trunc(value);
  if (!Number.isFinite(value) || normalized <= 0) {
    throw new Error('环境检测总超时时间必须是大于 0 的有限数字。');
  }
  return normalized;
}

async function withOverallTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const observedOperation = operation.then(
    value => ({ kind: 'fulfilled' as const, value }),
    reason => ({ kind: 'rejected' as const, reason: reason as unknown })
  );

  try {
    const outcome = await Promise.race([
      observedOperation,
      new Promise<{ kind: 'timeout' }>(resolve => {
        timer = setTimeout(
          () => resolve({ kind: 'timeout' }),
          timeoutMs
        );
      })
    ]);

    if (outcome.kind === 'timeout') {
      // The underlying command may settle after the caller has timed out. Its
      // rejection is converted into a fulfilled outcome above, so it cannot
      // become an unhandled rejection while the remaining probes wind down.
      throw new Error(`开发环境检测超过 ${timeoutMs} 毫秒，已停止等待结果。`);
    }
    if (outcome.kind === 'rejected') throw outcome.reason;
    return outcome.value;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
