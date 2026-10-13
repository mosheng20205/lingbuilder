import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { decodeCompilerOutput } from '../tasks/compilerOutputEncoding';
import {
  generateInstallerNsi,
  normalizeInstallerVersion,
  sanitizeInstallerDisplayName,
  sanitizeInstallerFileName,
  type InstallerInstallMode,
  type InstallerNsiPayloadFile
} from './installerScriptGenerator';

const execFileAsync = promisify(execFile);

/**
 * 安装包导出服务：把一次成功构建的 bin 输出目录打包为 NSIS 安装程序。
 *
 * 与构建链的契约：构建成功（exe 形态）后由构建入口（IDE F5 路由 / buildRun）
 * 写 installer-build-manifest.json 到 <构建目录>/installer/，导出只消费该清单，
 * 不重复推导项目属性——保证安装包永远与「最近一次成功构建」一致。
 */

export const INSTALLER_MANIFEST_SCHEMA_VERSION = 1;
export const INSTALLER_MANIFEST_FILE_NAME = 'installer-build-manifest.json';
export const INSTALLER_EXPORT_MAX_FILES = 50_000;
export const INSTALLER_EXPORT_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;
export const INSTALLER_EXPORT_MAKENSIS_TIMEOUT_MS = 10 * 60 * 1000;
export const INSTALLER_EXPORT_LOG_TAIL_LINES = 40;

export interface InstallerBuildManifest {
  schemaVersion: number;
  projectId: string;
  projectName: string;
  /** bin 目录中的主程序文件名（含 .exe）。 */
  outputFileName: string;
  /** 构建输出目录与 bin 子目录（绝对路径）。 */
  buildDir: string;
  binDir: string;
  architecture: 'x64' | 'x86';
  buildMode: 'Debug' | 'Release';
  requireAdministrator: boolean;
  requiresDynamicCrt: boolean;
  outputType: 'exe';
  /** ISO 时间戳，安装包基于哪次构建。 */
  builtAt: string;
  /** 上次导出安装包使用的版本号（未显式传版本时沿用）。 */
  installerVersion?: string;
  /** 构建物化的主程序图标（.ico 绝对路径）；缺失表示安装器使用 NSIS 默认图标。 */
  iconPath?: string;
}

export interface InstallerExportResult {
  ok: boolean;
  error?: string;
  installerPath?: string;
  installerFileName?: string;
  fileCount?: number;
  totalBytes?: number;
  version?: string;
  requiresVcRedist?: boolean;
  logs: string[];
}

export function getInstallerManifestPath(buildDir: string): string {
  return path.join(buildDir, 'installer', INSTALLER_MANIFEST_FILE_NAME);
}

/** 构建成功后写入安装包清单；失败只记日志，不阻断构建结果。 */
export async function writeInstallerBuildManifest(buildDir: string, manifest: InstallerBuildManifest, logs?: string[]): Promise<void> {
  try {
    const target = getInstallerManifestPath(buildDir);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(manifest, null, 2), 'utf8');
  } catch (error) {
    logs?.push(`安装包清单写入失败（不影响构建产物，仅本次无法直接导出安装包）：${error instanceof Error ? error.message : String(error)}`);
  }
}

/** 读取最近一次成功构建的清单；不存在或损坏返回 null（调用方给中文指引）。 */
export async function readInstallerBuildManifest(buildDir: string): Promise<InstallerBuildManifest | null> {
  try {
    const raw = JSON.parse(await fs.readFile(getInstallerManifestPath(buildDir), 'utf8')) as Partial<InstallerBuildManifest> | null;
    if (!raw || raw.schemaVersion !== INSTALLER_MANIFEST_SCHEMA_VERSION) return null;
    if (!raw.projectId || !raw.outputFileName || !raw.binDir || !raw.buildDir) return null;
    if (raw.outputType !== 'exe') return null;
    return {
      schemaVersion: INSTALLER_MANIFEST_SCHEMA_VERSION,
      projectId: String(raw.projectId),
      projectName: String(raw.projectName || raw.projectId),
      outputFileName: String(raw.outputFileName),
      buildDir: String(raw.buildDir),
      binDir: String(raw.binDir),
      architecture: raw.architecture === 'x86' ? 'x86' : 'x64',
      buildMode: raw.buildMode === 'Release' ? 'Release' : 'Debug',
      requireAdministrator: raw.requireAdministrator === true,
      requiresDynamicCrt: raw.requiresDynamicCrt === true,
      outputType: 'exe',
      builtAt: String(raw.builtAt || ''),
      installerVersion: typeof raw.installerVersion === 'string' ? raw.installerVersion : undefined,
      iconPath: typeof raw.iconPath === 'string' && raw.iconPath.trim() ? raw.iconPath.trim() : undefined
    };
  } catch {
    return null;
  }
}

/**
 * 解析 makensis 可执行文件路径，顺序：
 * LINGBUILDER_NSIS_PATH 环境变量 → 显式候选 → IDE 随包（resources/nsis）→
 * electron-builder 缓存 → Tauri NSIS 缓存。
 */
export async function resolveMakensisExecutable(options: { env?: NodeJS.ProcessEnv; candidates?: string[] } = {}): Promise<string> {
  const env = options.env || process.env;
  const tried: string[] = [];
  const probe = async (candidate: string | undefined): Promise<string | null> => {
    if (!candidate) return null;
    tried.push(candidate);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // 候选不存在，继续下一个。
    }
    return null;
  };

  const direct = await probe(env.LINGBUILDER_NSIS_PATH
    ? path.join(env.LINGBUILDER_NSIS_PATH, 'makensis.exe')
    : undefined);
  if (direct) return direct;

  for (const candidate of options.candidates || []) {
    const hit = await probe(candidate);
    if (hit) return hit;
  }

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  const bundled = await probe(resourcesPath ? path.join(resourcesPath, 'nsis', 'makensis.exe') : undefined);
  if (bundled) return bundled;

  const localAppData = env.LOCALAPPDATA || '';
  const electronBuilderDir = localAppData ? path.join(localAppData, 'electron-builder', 'Cache', 'nsis') : '';
  if (electronBuilderDir) {
    try {
      const entries = await fs.readdir(electronBuilderDir, { withFileTypes: true });
      const versions = entries.filter(entry => entry.isDirectory() && entry.name.startsWith('nsis-')).map(entry => entry.name).sort().reverse();
      for (const version of versions) {
        const hit = await probe(path.join(electronBuilderDir, version, 'makensis.exe'));
        if (hit) return hit;
      }
    } catch {
      // 缓存目录不存在，跳过。
    }
  }

  const tauriDir = localAppData ? path.join(localAppData, 'tauri', 'NSIS') : '';
  for (const candidate of tauriDir ? [path.join(tauriDir, 'makensis.exe'), path.join(tauriDir, 'Bin', 'makensis.exe')] : []) {
    const hit = await probe(candidate);
    if (hit) return hit;
  }

  throw new Error(
    `未找到 NSIS 编译器（makensis.exe），无法导出安装包。修法任选其一：①安装 NSIS 3 并把环境变量 LINGBUILDER_NSIS_PATH 指向其目录；②用 electron-builder 或 Tauri 打包过应用后重试（会自动复用其 NSIS 缓存）。已尝试：${tried.slice(0, 6).join('；') || '（无候选路径）'}`
  );
}

export const VC_REDIST_CACHE_ENV = 'LINGBUILDER_VC_REDIST_DIR';
export const VC_REDIST_DOWNLOAD_URLS: Record<'x64' | 'x86', string> = {
  x64: 'https://aka.ms/vs/17/release/vc_redist.x64.exe',
  x86: 'https://aka.ms/vs/17/release/vc_redist.x86.exe'
};
export const VC_REDIST_MIN_BYTES = 1024 * 1024;

/**
 * 定位（或按需下载）VC++ 运行库离线安装器。
 * 顺序：LINGBUILDER_VC_REDIST_DIR 环境变量 → 用户缓存 %LOCALAPPDATA%\LingBuilderc-redist →
 * 官方 aka.ms 直链下载进缓存。仅校验体积与 MZ 头，不做哈希钉死（微软会就地更新该文件）。
 */
export async function resolveVcRedistInstaller(architecture: 'x64' | 'x86', options: { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch } = {}): Promise<string> {
  const env = options.env || process.env;
  const fileName = `vc_redist.${architecture}.exe`;
  const tried: string[] = [];
  const probe = async (candidate: string | undefined): Promise<string | null> => {
    if (!candidate) return null;
    tried.push(candidate);
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile() && stat.size >= VC_REDIST_MIN_BYTES) return candidate;
      if (stat.isFile()) tried.push(`${candidate}（体积 ${stat.size} 字节过小，已忽略）`);
    } catch {
      // 候选不存在，继续。
    }
    return null;
  };

  const fromEnv = await probe(env[VC_REDIST_CACHE_ENV] ? path.join(env[VC_REDIST_CACHE_ENV]!, fileName) : undefined);
  if (fromEnv) return fromEnv;

  const cacheDir = env.LOCALAPPDATA
    ? path.join(env.LOCALAPPDATA, 'LingBuilder', 'vc-redist')
    : '';
  const cached = await probe(cacheDir ? path.join(cacheDir, fileName) : undefined);
  if (cached) return cached;

  if (!cacheDir) {
    throw new Error(`需要捆绑 VC++ 运行库但未找到 ${fileName}，且本机缺少 LOCALAPPDATA 无法使用下载缓存。请手动下载后放到任一目录，并设置环境变量 ${VC_REDIST_CACHE_ENV} 指向该目录。`);
  }
  const url = VC_REDIST_DOWNLOAD_URLS[architecture];
  const target = path.join(cacheDir, fileName);
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    const fetchImpl = options.fetchImpl || fetch;
    const response = await fetchImpl(url, { redirect: 'follow' });
    if (!response.ok) {
      throw new Error(`下载返回 HTTP ${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength < VC_REDIST_MIN_BYTES || bytes.subarray(0, 2).toString('latin1') !== 'MZ') {
      throw new Error(`下载内容不是有效的 Windows 安装器（${bytes.byteLength} 字节）`);
    }
    await fs.writeFile(target, bytes);
    return target;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `捆绑 VC++ 运行库需要先获取离线安装器，自动下载失败：${message}。修法任选其一：①检查网络后重试；②手动从 ${url} 下载 ${fileName}，放到 ${cacheDir}（或任意目录并把环境变量 ${VC_REDIST_CACHE_ENV} 指向它）后重试。已尝试：${tried.join('；') || '（无候选路径）'}`
    );
  }
}

export interface InstallerPayloadCollection {
  files: InstallerNsiPayloadFile[];
  totalBytes: number;
  skipped: string[];
}

/** 递归收集 bin 输出目录全部文件（每次构建前 bin 会被整体清空，目录内容即本次构建产物）。 */
export async function collectInstallerPayloadFiles(binDir: string): Promise<InstallerPayloadCollection> {
  const files: InstallerNsiPayloadFile[] = [];
  const skipped: string[] = [];
  let totalBytes = 0;
  const walk = async (current: string): Promise<void> => {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath);
        continue;
      }
      if (!entry.isFile()) {
        skipped.push(path.relative(binDir, entryPath));
        continue;
      }
      const stat = await fs.stat(entryPath);
      files.push({
        relativePath: path.relative(binDir, entryPath).replace(/[\\/]+/gu, '/'),
        absolutePath: entryPath,
        sizeBytes: stat.size
      });
      totalBytes += stat.size;
      if (files.length > INSTALLER_EXPORT_MAX_FILES) {
        throw new Error(`构建输出目录文件数超过上限（${INSTALLER_EXPORT_MAX_FILES}），已拒绝打包；请检查输出目录是否被外部程序写入。`);
      }
    }
  };
  await walk(binDir);
  if (totalBytes > INSTALLER_EXPORT_MAX_TOTAL_BYTES) {
    throw new Error(`构建输出目录总大小 ${(totalBytes / 1024 / 1024).toFixed(1)} MB 超过安装包上限（2 GB），已拒绝打包。`);
  }
  files.sort((a, b) => (a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0));
  return { files, totalBytes, skipped };
}

/** 主程序图标在构建输出内的固定相对路径（与 windowsExecutableIconService 的物化目标一致）。 */
export const INSTALLER_BUILT_ICON_RELATIVE_PATH = 'resources/lingbuilder-app.ico';

/** 从构建物化的图标文件列表里取 buildDir 下的那份（安装器与 exe 同源图标）；没有返回 undefined。 */
export function resolveBuiltIconPath(buildDir: string, iconFiles: readonly string[]): string | undefined {
  const expected = path.join(path.resolve(buildDir), 'resources', 'lingbuilder-app.ico');
  for (const file of iconFiles) {
    if (path.resolve(file) === expected) return file;
  }
  return undefined;
}

export function tailLogs(logs: string[], limit = INSTALLER_EXPORT_LOG_TAIL_LINES): string[] {
  if (!Array.isArray(logs) || logs.length <= limit) return Array.isArray(logs) ? logs.filter(Boolean) : [];
  return [`（日志过长，仅保留末尾 ${limit} 行，完整日志见构建输出面板）`, ...logs.slice(-limit).filter(Boolean)];
}

export interface ExportInstallerOptions {
  manifest: InstallerBuildManifest;
  /** 覆盖清单之外的自定义版本号（x.y 或 x.y.z 均可，生成时规范为四段）。 */
  version?: string;
  /** 安装器使用构建物化的项目图标（.ico）；缺省 true。 */
  useProjectIcon?: boolean;
  /** 捆绑 VC++ 运行库并在安装时按需链式安装；缺省 false。 */
  bundleVcRedist?: boolean;
  /** 安装目录策略；缺省 auto（跟随构建属性的管理员设置）。 */
  installMode?: InstallerInstallMode;
  /** 测试注入：makensis 可执行文件绝对路径。 */
  makensisPath?: string;
  /** 测试注入：替换真实打包动作（返回 makensis 合并输出）。 */
  runMakensis?: (scriptPath: string) => Promise<{ stdout: string; stderr: string }>;
  /** 测试注入：替换 vc_redist 获取（返回安装器绝对路径）。 */
  resolveVcRedist?: (architecture: 'x64' | 'x86') => Promise<string>;
}

/**
 * 从构建清单导出安装包：校验主程序 → 收集 bin 文件 → 生成 .nsi（UTF-8 BOM）→
 * 调 makensis 编译 → 校验产物存在。脚本与安装包都落在 <构建目录>/installer/。
 */
export async function exportInstallerFromManifest(options: ExportInstallerOptions): Promise<InstallerExportResult> {
  const logs: string[] = [];
  const manifest = options.manifest;
  try {
    const binDir = manifest.binDir;
    const exePath = path.join(binDir, manifest.outputFileName);
    try {
      await fs.access(exePath);
    } catch {
      return {
        ok: false,
        error: `构建清单指向的主程序不存在：${exePath}。清单可能已过期（例如之后构建过 DLL），请重新构建本项目后再导出安装包。`,
        logs
      };
    }

    let collection: InstallerPayloadCollection;
    try {
      collection = await collectInstallerPayloadFiles(binDir);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error), logs };
    }
    if (collection.files.length === 0) {
      return { ok: false, error: `构建输出目录 ${binDir} 没有可打包的文件，请重新构建后再导出安装包。`, logs };
    }
    logs.push(`已收集构建产物 ${collection.files.length} 个文件（共 ${(collection.totalBytes / 1024 / 1024).toFixed(1)} MB）：${binDir}`);
    for (const skipped of collection.skipped.slice(0, 5)) logs.push(`已跳过非常规文件：${skipped}`);

    // 先规范为四段数字再进文件名，保证安装包文件名与响应/注册表里的版本一致。
    const version = normalizeInstallerVersion(
      (options.version || '').trim() || (manifest.installerVersion || '').trim() || '1.0.0'
    );
    const outputFileName = sanitizeInstallerFileName(
      `${sanitizeInstallerDisplayName(manifest.projectName, manifest.projectId)}-${version}-setup.exe`,
      'setup',
      '.exe'
    );
    // 图标：默认复用构建物化的 .ico（与主程序 exe 同源）；清单图标缺失时静默回退 NSIS 默认。
    let iconPath: string | undefined;
    if (options.useProjectIcon !== false && manifest.iconPath) {
      try {
        const stat = await fs.stat(manifest.iconPath);
        if (stat.isFile()) iconPath = manifest.iconPath;
        else logs.push(`提醒：项目图标文件已不存在（${manifest.iconPath}），安装器使用默认图标。`);
      } catch {
        logs.push(`提醒：项目图标文件已不存在（${manifest.iconPath}），安装器使用默认图标。`);
      }
    }

    // 捆绑 VC++ 运行库：仅 /MD 构建有意义；/MT 项目勾选了也照常捆绑但属冗余，给出提醒。
    let bundleVcRedist: { fileName: string; absolutePath: string; architecture: 'x64' | 'x86' } | undefined;
    if (options.bundleVcRedist) {
      if (!manifest.requiresDynamicCrt) {
        logs.push('提醒：本项目是静态 CRT（/MT）构建，无需 VC++ 运行库；本次仍按勾选捆绑，可关闭该选项以减小安装包体积。');
      }
      const redistPath = options.resolveVcRedist
        ? await options.resolveVcRedist(manifest.architecture)
        : await resolveVcRedistInstaller(manifest.architecture);
      const redistStat = await fs.stat(redistPath);
      bundleVcRedist = {
        fileName: path.basename(redistPath),
        absolutePath: redistPath,
        architecture: manifest.architecture
      };
      logs.push(`已捆绑 VC++ 运行库安装器：${redistPath}（${(redistStat.size / 1024 / 1024).toFixed(1)} MB，安装时检测已装则跳过）`);
    }

    const installMode: InstallerInstallMode = options.installMode === 'perMachine' || options.installMode === 'perUser'
      ? options.installMode
      : 'auto';

    const generated = generateInstallerNsi({
      appName: manifest.projectName,
      exeFileName: manifest.outputFileName,
      version,
      architecture: manifest.architecture,
      requireAdministrator: manifest.requireAdministrator,
      requiresDynamicCrt: manifest.requiresDynamicCrt,
      files: collection.files,
      outputFileName,
      iconPath,
      bundleVcRedist,
      installMode
    });
    logs.push(...generated.warnings.map(warning => `提醒：${warning}`));

    const outputDir = path.join(manifest.buildDir, 'installer');
    await fs.mkdir(outputDir, { recursive: true });
    const scriptPath = path.join(outputDir, 'installer.nsi');
    // makensis 靠 BOM 识别 UTF-8 脚本；中文项目名/文件名全靠这一点。
    await fs.writeFile(scriptPath, `\uFEFF${generated.script}`, 'utf8');
    logs.push(`已生成安装包脚本：${scriptPath}`);

    const makensisPath = options.makensisPath || await resolveMakensisExecutable();
    logs.push(`NSIS 编译器：${makensisPath}`);
    const runMakensis = options.runMakensis || (async (script: string) => {
      const result = await execFileAsync(makensisPath, ['/V2', script], {
        timeout: INSTALLER_EXPORT_MAKENSIS_TIMEOUT_MS,
        maxBuffer: 32 * 1024 * 1024,
        encoding: 'buffer'
      });
      return {
        stdout: decodeCompilerOutput(result.stdout as unknown as Buffer),
        stderr: decodeCompilerOutput(result.stderr as unknown as Buffer)
      };
    });
    let makensisOutput = { stdout: '', stderr: '' };
    try {
      makensisOutput = await runMakensis(scriptPath);
    } catch (error) {
      // execFile nonzero exit：stdout/stderr 在错误对象上（Buffer），一并回传给调用方定位。
      const execError = error as Error & { stdout?: unknown; stderr?: unknown };
      const message = error instanceof Error ? error.message : String(error);
      const detail = [
        makensisOutput.stdout,
        makensisOutput.stderr,
        typeof execError.stdout === 'string' ? execError.stdout : decodeCompilerOutput(execError.stdout as Buffer | undefined),
        typeof execError.stderr === 'string' ? execError.stderr : decodeCompilerOutput(execError.stderr as Buffer | undefined),
        message
      ].filter(Boolean).join('\n');
      return { ok: false, error: `NSIS 编译失败：${detail.slice(0, 4000)}`, logs };
    }
    const outputLines = [...makensisOutput.stdout.split(/\r?\n/u), ...makensisOutput.stderr.split(/\r?\n/u)].map(line => line.trim()).filter(Boolean);
    if (outputLines.length > 0) logs.push(...tailLogs(outputLines, 12));

    const installerPath = path.join(outputDir, outputFileName);
    try {
      const stat = await fs.stat(installerPath);
      logs.push(`安装包导出成功：${installerPath}`);
      // 记住本次版本号，下次不带版本导出时沿用（清单回写失败不影响导出结果）。
      try {
        await writeInstallerBuildManifest(manifest.buildDir, { ...manifest, installerVersion: generated.version });
      } catch {
        // 忽略回写失败。
      }
      return {
        ok: true,
        installerPath,
        installerFileName: outputFileName,
        fileCount: collection.files.length,
        totalBytes: stat.size,
        version: generated.version,
        requiresVcRedist: manifest.requiresDynamicCrt && !bundleVcRedist,
        logs
      };
    } catch {
      return { ok: false, error: `NSIS 未产出安装包文件（预期 ${installerPath}），请查看 makensis 输出。`, logs };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error), logs };
  }
}
