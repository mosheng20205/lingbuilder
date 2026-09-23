import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  powerMonitor,
  screen,
  session,
  safeStorage,
  shell,
  utilityProcess,
  UtilityProcess
} from 'electron';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { diskBuildDiffersFromRunning, readBuildMetaFile, resolveBuildMetaPath } from './buildIdentity';
import { buildWorkspaceWindowLaunch, DesktopWorkspaceService, findWorkspaceFileArgument, getArgumentValue } from './workspaceService';
import { CloudAccountService } from './cloudAccountService';
import { checkLatestVersion, type VersionCheckResult } from './versionCheckService';
import { UpdateDownloadService } from './updateDownloadService';
import { inspectCliIntegration } from './cliIntegrationService';
import { AiBridgeManagerService, type ManagedAiBridgePermission, type ManagedAiBridgeLifecycle } from './aiBridgeManagerService';
import { AgentRuntimeService } from './agentRuntime/agentRuntimeService';
import {
  defaultAgentProviderSettings,
  mergeAgentProviderKey,
  normalizeAgentProviderSettings,
  readAgentProviderSettings,
  resolveAgentProviderSettingsPath,
  writeAgentProviderSettings,
  type AgentProviderSettings
} from './agentRuntime/agentProviderSettings';
import { normalizeAiBridgeStartSettings, readAiBridgeStartSettings, resolveAiBridgeStartSettingsPath, writeAiBridgeStartSettings } from './aiBridgeStartSettings';
import { LocalAuthorizationService, type LocalAuthorizationSnapshot } from './localAuthorizationService';
import { SkillKitService, resolveBundledSkillKitRoot } from './skillKit/skillKitService';
import { createExternalAiLaunchPlan, detectExternalAiClients, type ExternalAiClientId } from './aiClientIntegrationService';
import { CodexDesktopIntegrationService } from './codexDesktopIntegrationService';
import { openPathWithExplorerFallback, selectShellWorkspaceRoot } from './shellPathService';
import { restoreModulePermits } from './modulePermitRestoreService';
import { ModuleInfoWindowService } from './moduleInfoWindowService';
import { listModuleDemoIds, openModuleDemoInNewInstance, type ModuleDemoServiceOptions } from './moduleDemoService';
import {
  createLcppSourcePackageService,
  isLcppSourcePackagePath,
  LCPP_SOURCE_PACKAGE_EXTENSION,
  resolveProjectSourcePackagePath
} from './lcppSourcePackageService';
import { findLbmodArgument, isLbmodPath, MODULE_INSTALL_EVENT } from './modulePackageIntakeService';
import { DiagnosticLogService, type DiagnosticLogLevel } from './diagnosticLogService';

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3001/';
const SERVER_READY_PREFIX = 'LINGBUILDER_SERVER_READY ';
const SERVER_START_TIMEOUT_MS = 30_000;

interface ServerReadyInfo {
  host: string;
  port: number;
  origin: string;
  workspaceRoot: string;
  pid: number;
}

let mainWindow: BrowserWindow | null = null;
let rendererServer: UtilityProcess | null = null;
let rendererReadyInfo: ServerReadyInfo | null = null;
const intentionallyStoppedServers = new WeakSet<UtilityProcess>();
let rendererOrigin = DEV_SERVER_URL;
let rendererSessionToken = process.env.LINGBUILDER_SESSION_TOKEN || '';
let activeWorkspace = '';
let showWelcomeOnNextRendererLoad = true;
/**
 * 本次进程是由「双击 .lcpppkg / 把工作区拖到 exe 上」这类文件关联启动的。
 * 用户已经明确指定了要打开什么，冷启动不应该再拦一层欢迎页。
 */
let startupOpenedAssociatedWorkspace = false;

/** 从命令行参数里找出被双击的 `.lcpppkg`，与 `findLbmodArgument` 同一口径。 */
const findLcppSourcePackageArgument = (argv: readonly string[]): string | undefined =>
  argv.slice(1).find(value => value && !value.startsWith('-') && isLcppSourcePackagePath(value));
let isQuitting = false;
let shutdownPromise: Promise<void> | null = null;
let pendingModulePackagePath: string | undefined;
let workspaceService: DesktopWorkspaceService;
let aiBridgeManager: AiBridgeManagerService;
let agentRuntime: AgentRuntimeService;
/**
 * 面板「本机 Agent」的模型通道配置缓存。密钥只留在主进程：渲染层拿到的永远是掩码视图，
 * 拉模型列表与测连通也由主进程代调本地服务（见 agent-runtime:list-models / test-provider）。
 */
let agentProviderCache: AgentProviderSettings = defaultAgentProviderSettings();
let agentProviderKeyUnavailable = false;
let localAuthorization: LocalAuthorizationService | null = null;
let moduleInfoWindow: ModuleInfoWindowService;
const rendererConfirmedClose = new WeakSet<BrowserWindow>();

/** 黑屏取证诊断日志（userData/logs），仅记录生命周期事件，不写用户代码内容。 */
let diagnosticLog: DiagnosticLogService | null = null;

function logDiagnostic(level: DiagnosticLogLevel, category: string, message: string): void {
  diagnosticLog?.append(level, category, message);
}

function getDiagnosticLogDirectory(): string {
  return path.join(app.getPath('userData'), 'logs');
}

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() || mainWindow;
}

function getShellWorkspaceRoot(): string {
  return selectShellWorkspaceRoot({
    rendererWorkspaceRoot: rendererReadyInfo?.workspaceRoot,
    configuredWorkspaceRoot: process.env.LINGBUILDER_WORKSPACE_ROOT,
    activeWorkspace
  });
}

function repoRoot(): string {
  return path.resolve(__dirname, '..', '..');
}

function serverEntryPath(): string {
  return path.join(__dirname, '..', 'dist', 'server.cjs');
}

function rendererStaticRoot(): string {
  return path.join(__dirname, '..', 'dist');
}

function defaultWorkspaceSource(): string | undefined {
  return app.isPackaged ? path.join(process.resourcesPath, 'default-workspace') : undefined;
}

/**
 * 安装包随附的固定版本 Protobuf SDK。打包后与 default-workspace 里的工具链布局一致；
 * 开发态直接用仓库内 third_party 目录，目录不存在时工作区铺设会自动跳过。
 */
function bundledProtobufSdkSource(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'default-workspace', '.lingbuilder', 'toolchains', 'protobuf')
    : path.join(repoRoot(), 'electron', 'third_party', 'protobuf');
}

function rulebookPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', 'LingBuilder AI 规则手册.md')
    : path.join(repoRoot(), 'LingBuilder AI 规则手册.md');
}

function moduleManualPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', '模块开发手册.md')
    : path.join(repoRoot(), 'docs', '模块开发手册.md');
}

function cliManualPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', 'AI_BRIDGE_CLI_USAGE.md')
    : path.join(repoRoot(), 'docs', 'AI_BRIDGE_CLI_USAGE.md');
}

function aiModuleGuidePath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', 'AI模块开发规范.md')
    : path.join(repoRoot(), 'docs', 'AI模块开发规范.md');
}

/**
 * 随 IDE 分发的模块例程库（module-demos 演示工作区）。打包后经 electron-builder
 * extraResources 落在 resources/module-demos（已剔除 AI 语料 JSON 等非工作区文件）；
 * 开发态直接用仓库 examples 目录，例程面板入口与打包版同一套链路。
 */
function moduleDemoSourceRoot(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'module-demos')
    : path.join(repoRoot(), 'examples', 'module-demos');
}

function moduleDemoServiceOptions(): ModuleDemoServiceOptions {
  return {
    demoSourceRoot: moduleDemoSourceRoot(),
    documentsPath: app.getPath('documents'),
    // 例程实例的独立 userData 放在主实例 userData 下：与主实例不竞争单实例锁、
    // 不共享设置，也不在用户目录另起炉灶（卸载残留可控）。
    demoUserDataRoot: path.join(app.getPath('userData'), 'module-demo-runtime')
  };
}

async function findCurrentSolutionEntryPath(workspaceRoot: string, solutionName: string): Promise<string> {
  const entries = await fs.readdir(workspaceRoot, { withFileTypes: true });
  let firstValidEntry = '';
  for (const entry of entries.filter(item => item.isFile() && item.name.toLowerCase().endsWith('.lbsln')).sort((a, b) => a.name.localeCompare(b.name))) {
    const candidate = path.join(workspaceRoot, entry.name);
    try {
      const parsed = JSON.parse(await fs.readFile(candidate, 'utf8')) as { kind?: unknown; solutionFile?: unknown; name?: unknown };
      if (parsed.kind !== 'lingbuilder-solution' || parsed.solutionFile !== '.lingbuilder/solution.json') continue;
      if (!firstValidEntry) firstValidEntry = candidate;
      if (parsed.name === solutionName) return candidate;
    } catch {
      // Ignore unrelated or damaged .lbsln files while locating the active solution entry.
    }
  }
  if (firstValidEntry) return firstValidEntry;
  throw new Error('当前工作区中没有可复制的 LingBuilder 解决方案文件。');
}

function cliLauncherPath(): string {
  return path.join(path.dirname(process.execPath), 'lingbuilder.cmd');
}

function cliEntryPath(): string {
  return app.isPackaged
    ? path.join(app.getAppPath(), 'dist', 'cli.cjs')
    : path.join(repoRoot(), 'electron', 'dist', 'cli.cjs');
}

function codexDesktopIntegration(): CodexDesktopIntegrationService {
  return new CodexDesktopIntegrationService({
    workspaceRoot: getShellWorkspaceRoot(),
    runtimeExecutable: process.execPath,
    cliEntryPath: cliEntryPath()
  });
}

async function runFixedProcess(
  executable: string,
  args: string[],
  environment: NodeJS.ProcessEnv = process.env,
  timeoutMs = 10_000
): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      env: environment,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      action();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`命令运行超过 ${timeoutMs / 1000} 秒。`)));
    }, timeoutMs);
    child.stdout?.on('data', chunk => stdout.push(Buffer.from(chunk)));
    child.stderr?.on('data', chunk => stderr.push(Buffer.from(chunk)));
    child.once('error', error => finish(() => reject(error)));
    child.once('exit', code => finish(() => {
      const output = Buffer.concat(stdout).toString('utf8').trim();
      const errorOutput = Buffer.concat(stderr).toString('utf8').trim();
      if (code === 0) resolve(output);
      else reject(new Error(errorOutput || output || `命令退出码：${code}`));
    }));
  });
}

async function readCurrentUserPath(): Promise<string> {
  if (process.platform !== 'win32') return process.env.PATH || '';
  const encoded = await runFixedProcess('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    "$value=[Environment]::GetEnvironmentVariable('Path','User'); if ($null -eq $value) {$value=''}; [Console]::Out.Write([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value)))"
  ], process.env, 5_000);
  return Buffer.from(encoded, 'base64').toString('utf8');
}

async function inspectInstalledCli() {
  const installDirectory = path.dirname(process.execPath);
  let userPath = process.env.PATH || '';
  try {
    userPath = await readCurrentUserPath();
  } catch {
    // PATH 读取失败时仍可继续验证启动器和内置 CLI。
  }
  return await inspectCliIntegration({
    packaged: app.isPackaged,
    installDirectory,
    launcherPath: cliLauncherPath(),
    userPath,
    runVersion: async () => {
      await fs.access(cliEntryPath());
      return await runFixedProcess(process.execPath, [cliEntryPath(), '--version'], {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1'
      });
    }
  });
}

/** 内嵌资源选择：逐个 realpath 归一化并确认是普通文件（拒绝断链符号链接与目录）。 */
async function resolvePickedFiles(filePaths: readonly string[]): Promise<string[]> {
  const resolved: string[] = [];
  for (const filePath of filePaths.slice(0, 64)) {
    const real = await fs.realpath(path.resolve(String(filePath))).catch(() => '');
    if (!real) throw new Error(`选择的文件不存在或无法访问：${path.basename(String(filePath))}`);
    const stat = await fs.stat(real);
    if (!stat.isFile()) throw new Error(`选择的路径不是普通文件：${path.basename(real)}`);
    resolved.push(real);
  }
  return resolved;
}

/** 内嵌资源选择：realpath 归一化并确认是目录，供「选择文件夹…」递归展开。 */
async function resolvePickedDirectory(directoryPath: string): Promise<string> {
  const real = await fs.realpath(path.resolve(String(directoryPath))).catch(() => '');
  if (!real) throw new Error('选择的文件夹不存在或无法访问。');
  const stat = await fs.stat(real);
  if (!stat.isDirectory()) throw new Error('选择的路径不是文件夹。');
  return real;
}

function credentialPath(): string { return path.join(app.getPath('userData'), 'credentials', 'ai-api-key.bin'); }
async function readAiCredential(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; const encrypted = await fs.readFile(credentialPath()); return safeStorage.decryptString(encrypted); } catch { return ''; } }
async function writeAiCredential(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全凭据存储。'); const file = credentialPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
const startupFbroVipKey = String(process.env.LINGBUILDER_FBRO_VIP_KEY || '').trim();
function fbroVipCredentialPath(): string { return path.join(app.getPath('userData'), 'credentials', 'fbro-vip-key.bin'); }
async function readFbroVipCredential(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; return safeStorage.decryptString(await fs.readFile(fbroVipCredentialPath())).trim(); } catch { return ''; } }
async function writeFbroVipCredential(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全凭据存储。'); const file = fbroVipCredentialPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
async function resolveFbroVipCredential(): Promise<{ value: string; source: 'secure-storage' | 'environment' | 'none' }> { const stored = await readFbroVipCredential(); if (stored) return { value: stored, source: 'secure-storage' }; if (startupFbroVipKey) return { value: startupFbroVipKey, source: 'environment' }; return { value: '', source: 'none' }; }
function publishFbroVipCredential(value: string): void { rendererServer?.postMessage({ type: 'lingbuilder:fbro-vip-key', value }); aiBridgeManager?.setFbroVipKey(value); }
/**
 * 本机授权代理：仅在用户于「AI Bridge 连接中心」显式开启后监听回环端口，
 * 供外部 AI 客户端自动拉起的 stdio 宿主换取模块 Permit 与浏览器凭据。
 */
async function syncLocalAuthorizationService(): Promise<LocalAuthorizationSnapshot | null> {
  const settings = await readAiBridgeStartSettings(resolveAiBridgeStartSettingsPath(app.getPath('userData')), safeStorage);
  if (settings?.externalModuleAccess !== true) {
    if (localAuthorization) {
      await localAuthorization.stop();
      localAuthorization = null;
    }
    return null;
  }
  if (!localAuthorization) {
    localAuthorization = new LocalAuthorizationService({
      userDataDir: app.getPath('userData'),
      enabled: true,
      readModulePermitCache,
      resolveFbroVipKey: async () => (await resolveFbroVipCredential()).value,
      log: message => logDiagnostic('info', 'ai-bridge', message)
    });
  }
  try {
    return await localAuthorization.start();
  } catch (error) {
    logDiagnostic('error', 'ai-bridge', `本机授权代理启动失败：${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
let skillKit: SkillKitService | null = null;
/** 灵码 Skill 正文取物：安装包内置快照兜底，联网时以云端签名清单为最新。 */
function skillKitService(): SkillKitService {
  if (!skillKit) {
    skillKit = new SkillKitService({
      userDataDir: app.getPath('userData'),
      bundledRoot: resolveBundledSkillKitRoot({
        packaged: app.isPackaged,
        resourcesPath: process.resourcesPath,
        electronRoot: path.join(repoRoot(), 'electron')
      }),
      ideVersion: app.getVersion(),
      environment: process.env
    });
  }
  return skillKit;
}
function cloudRefreshPath(): string { return path.join(app.getPath('userData'), 'credentials', 'cloud-refresh-token.bin'); }
async function readCloudRefresh(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; return safeStorage.decryptString(await fs.readFile(cloudRefreshPath())); } catch { return ''; } }
async function writeCloudRefresh(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全账号凭据存储。'); const file = cloudRefreshPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
function modulePermitCachePath(): string { return path.join(app.getPath('userData'), 'credentials', 'module-permits.bin'); }
async function readModulePermitCache(): Promise<any[]> { try { if (!safeStorage.isEncryptionAvailable()) return []; const value = JSON.parse(safeStorage.decryptString(await fs.readFile(modulePermitCachePath()))); return Array.isArray(value) ? value : []; } catch { return []; } }
async function writeModulePermitCache(values: any[]): Promise<void> { if (!safeStorage.isEncryptionAvailable()) return; const file = modulePermitCachePath(); await fs.mkdir(path.dirname(file), { recursive: true }); const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(JSON.stringify(values.slice(-32)))); await fs.rename(temporary, file); }
function cloudApiOrigin(): string {
  const explicit = process.env.LINGBUILDER_CLOUD_API_URL?.trim();
  if (explicit && (!app.isPackaged || explicit.startsWith('https://'))) return explicit.replace(/\/$/u, '');
  if (explicit && app.isPackaged) console.error('安装版拒绝使用非 HTTPS 的 LINGBUILDER_CLOUD_API_URL。');
  if (!app.isPackaged) return 'http://127.0.0.1:17900';
  try {
    const config = JSON.parse(readFileSync(path.join(process.resourcesPath, 'cloud-release.json'), 'utf8')) as { cloudMode?: unknown; cloudApiOrigin?: unknown };
    if (config.cloudMode === 'offline') return 'https://cloud-offline.invalid';
    if (config.cloudMode !== 'online') throw new Error('云端发布模式无效。');
    const origin = String(config.cloudApiOrigin || '').replace(/\/$/u, '');
    if (!origin.startsWith('https://')) throw new Error('正式云端地址不是 HTTPS。');
    return origin;
  } catch (error) {
    console.error('LingBuilder 安装包缺少有效的 cloud-release.json。', error);
    return 'https://cloud-config-missing.invalid';
  }
}
const cloudAccountService = new CloudAccountService(cloudApiOrigin(), readCloudRefresh, writeCloudRefresh);
let lastVersionCheck: VersionCheckResult | null = null;
/** 应用内更新下载器：安装包落在 userData/updates，进度经 app-update:progress 广播到所有窗口。 */
const updateDownloadService = new UpdateDownloadService({
  updatesDir: path.join(app.getPath('userData'), 'updates'),
  isPackaged: app.isPackaged,
  resourcesPath: app.isPackaged ? process.resourcesPath : undefined,
  allowInsecureUrl: !app.isPackaged,
  onProgress: progress => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send('app-update:progress', progress);
    }
  }
});

async function startManagedRendererServer(workspaceRoot: string): Promise<ServerReadyInfo> {
  await stopRendererServer();
  rendererSessionToken = crypto.randomBytes(32).toString('hex');
  const fbroVipCredential = await resolveFbroVipCredential();

  const child = utilityProcess.fork(serverEntryPath(), [], {
    cwd: app.isPackaged ? workspaceRoot : path.join(repoRoot(), 'electron'),
    serviceName: 'LingBuilder Local Service',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      HOST: '127.0.0.1',
      PORT: '0',
      LINGBUILDER_WORKSPACE_ROOT: workspaceRoot,
      LINGBUILDER_RESOURCE_ROOT: app.isPackaged ? process.resourcesPath : path.join(repoRoot(), 'electron'),
      LINGBUILDER_SDK_CACHE_ROOT: path.join(app.getPath('userData'), 'sdk-cache'),
      LINGBUILDER_USER_SETTINGS_PATH: path.join(app.getPath('userData'), 'settings.json'),
      LINGBUILDER_STATIC_ROOT: rendererStaticRoot(),
      LINGBUILDER_RULEBOOK_PATH: rulebookPath(),
      LINGBUILDER_AI_MODULE_SPEC_PATH: aiModuleGuidePath(),
      LINGBUILDER_SESSION_TOKEN: rendererSessionToken,
      LINGBUILDER_DEV_NO_AUTH: 'false',
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false',
      LINGBUILDER_SERVER_AUTOSTART: 'true',
      // 生产安装包必须让本地服务启用已验签的云端 SDK 清单；此前未透传该模式，
      // 导致 sdkCatalogRemote.resolveSdkCatalogEndpoint() 返回 null，始终回退内置清单。
      ...(app.isPackaged ? {
        LINGBUILDER_CLOUD_RELEASE_MODE: 'online',
        LINGBUILDER_CLOUD_API_URL: cloudApiOrigin()
      } : {}),
      ...(fbroVipCredential.value ? { LINGBUILDER_FBRO_VIP_KEY: fbroVipCredential.value } : {})
    }
  });
  rendererServer = child;

  child.stderr?.on('data', chunk => {
    const message = String(chunk).trim();
    if (message) {
      console.error(`[local-service] ${message}`);
      logDiagnostic('warn', 'local-service', message.slice(0, 300));
    }
  });
  child.on('exit', code => {
    if (rendererServer === child) rendererServer = null;
    if (!intentionallyStoppedServers.has(child) && !isQuitting) {
      console.error(`LingBuilder local service exited unexpectedly with code ${code}.`);
      logDiagnostic('error', 'local-service', `本地服务意外退出，退出码 ${code}。`);
      dialog.showErrorBox('LingBuilder 本地服务已停止', '本地 API 服务意外退出，请重新启动 LingBuilder。');
    }
  });

  return await new Promise<ServerReadyInfo>((resolve, reject) => {
    let stdoutBuffer = '';
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('等待 LingBuilder 本地服务启动超时。')), SERVER_START_TIMEOUT_MS);

    const finish = (error?: Error, ready?: ServerReadyInfo) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.off('exit', onEarlyExit);
      if (error) reject(error);
      else resolve(ready!);
    };
    const onEarlyExit = (code: number) => finish(new Error(`LingBuilder 本地服务启动失败，退出码 ${code}。`));
    child.once('exit', onEarlyExit);
    child.stdout?.on('data', chunk => {
      stdoutBuffer += String(chunk);
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith(SERVER_READY_PREFIX)) continue;
        try {
          const ready = JSON.parse(line.slice(SERVER_READY_PREFIX.length)) as ServerReadyInfo;
          if (ready.host !== '127.0.0.1' || !Number.isInteger(ready.port) || ready.port <= 0) {
            finish(new Error('LingBuilder 本地服务返回了无效监听地址。'));
            return;
          }
          rendererReadyInfo = ready;
          logDiagnostic('info', 'local-service', `本地服务已启动（pid ${ready.pid}，监听 ${ready.origin}）。`);
          finish(undefined, ready);
        } catch (error) {
          finish(error instanceof Error ? error : new Error(String(error)));
        }
      }
    });
  });
}

async function stopRendererServer(): Promise<void> {
  const child = rendererServer;
  rendererReadyInfo = null;
  if (!child) return;
  rendererServer = null;
  intentionallyStoppedServers.add(child);
  const pid = child.pid;
  child.kill();
  if (!pid) return;
  if (await waitForProcessExit(pid, 5_000)) return;
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // The service may have exited between the timeout and the force-kill.
  }
  if (!await waitForProcessExit(pid, 2_000)) {
    throw new Error(`LingBuilder 本地服务进程 ${pid} 未能退出。`);
  }
}

async function waitForProcessExit(pid: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!isProcessAlive(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return !isProcessAlive(pid);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function shutdownAndExit(code: number): Promise<void> {
  if (shutdownPromise) return shutdownPromise;
  isQuitting = true;
  logDiagnostic('info', 'app', `LingBuilder 正在退出（退出码 ${code}）。`);
  shutdownPromise = (async () => {
    let exitCode = code;
    try {
      await aiBridgeManager?.stop('LingBuilder 正在退出');
    } catch (error) {
      exitCode = 1;
      console.error(error);
    }
    try {
      // 内嵌 Agent 运行器是 dsh 子进程 + 它自己拉起的 MCP 子进程，退出必须回收。
      await agentRuntime?.dispose();
    } catch (error) {
      exitCode = 1;
      console.error(error);
    }
    try {
      // 退出必须撤掉本机授权代理并删除发现文件，避免陈旧端口被后来者误用。
      await localAuthorization?.stop();
      localAuthorization = null;
    } catch (error) {
      exitCode = 1;
      console.error(error);
    }
    try {
      await stopRendererServer();
    } catch (error) {
      exitCode = 1;
      console.error(error);
    }
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.destroy();
    }
    app.exit(exitCode);
  })();
  return shutdownPromise;
}

function configureRendererSession(origin: string, token: string): void {
  session.defaultSession.webRequest.onBeforeSendHeaders(null);
  if (!token) return;
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: [`${origin}/*`] }, (details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        'X-LingBuilder-Session': token
      }
    });
  });
}

async function requestRendererApi(apiPath: string, init: RequestInit): Promise<unknown> {
  const response = await fetch(new URL(apiPath, rendererOrigin), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(rendererSessionToken ? { 'X-LingBuilder-Session': rendererSessionToken } : {}),
      ...(init.headers || {})
    }
  });
  const result = await response.json().catch(() => ({})) as { error?: unknown; details?: unknown };
  if (!response.ok) {
    const reason = typeof result.error === 'string' ? result.error : `LingBuilder 本地服务请求失败：HTTP ${response.status}`;
    // 上游错误细节（fetch failed / 401 / 超时）必须一起报出来，否则面板只剩「AI 连接失败」四个字。
    throw new Error(typeof result.details === 'string' && result.details ? `${reason}：${result.details}` : reason);
  }
  return result;
}

/** 渲染进程崩溃重载防循环：60 秒窗口内连续崩溃达到 3 次后停止自动重载，只留日志。 */
const rendererCrashTimestamps: number[] = [];
let rendererConsoleErrorTimestamps: number[] = [];

function attachDiagnosticHandlers(window: BrowserWindow): void {
  const contents = window.webContents;
  contents.on('render-process-gone', (_event, details) => {
    const now = Date.now();
    while (rendererCrashTimestamps.length && now - rendererCrashTimestamps[0] > 60_000) rendererCrashTimestamps.shift();
    rendererCrashTimestamps.push(now);
    const repeated = rendererCrashTimestamps.length >= 3;
    logDiagnostic('error', 'renderer', `渲染进程意外退出：原因 ${details.reason}，退出码 ${details.exitCode}${repeated ? '（60 秒内第 3 次，已停止自动重载）' : ''}。`);
    if (!repeated && !window.isDestroyed()) {
      void dialog.showMessageBox(window, {
        type: 'warning',
        title: 'LingBuilder 界面无响应',
        message: '界面进程意外崩溃，正在自动恢复。',
        detail: '若反复黑屏，请通过「帮助 → 导出本地日志…」把日志发给开发者分析。',
        buttons: ['知道了'],
        defaultId: 0,
        noLink: true
      }).catch(() => undefined);
      setTimeout(() => { if (!window.isDestroyed()) window.webContents.reload(); }, 1_000);
    }
  });
  contents.on('unresponsive', () => logDiagnostic('warn', 'renderer', '渲染进程无响应（可能被系统挂起或高负载）。'));
  contents.on('responsive', () => logDiagnostic('info', 'renderer', '渲染进程恢复响应。'));
  contents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    logDiagnostic('error', 'renderer', `页面加载失败：${errorDescription}（错误码 ${errorCode}，URL ${validatedUrl}，主框架 ${isMainFrame ? '是' : '否'}）。`);
  });
  contents.on('did-finish-load', () => logDiagnostic('info', 'renderer', '页面加载完成。'));
  contents.on('console-message', (_event, ...args: unknown[]) => {
    // 新 Electron 运行时传 MessageDetails 对象，旧签名是位置参数（level 0-3：verbose/info/warning/error），两种都要兼容。
    const [second, third, fourth, fifth] = args as any[];
    const details = typeof second === 'object' && second
      ? second
      : { level: second, message: third, lineNumber: fourth, source: fifth };
    if (Number(details?.level) !== 3) return;
    const now = Date.now();
    rendererConsoleErrorTimestamps = rendererConsoleErrorTimestamps.filter(t => now - t < 60_000);
    if (rendererConsoleErrorTimestamps.length >= 30) return;
    rendererConsoleErrorTimestamps.push(now);
    const source = String(details.sourceUrl || details.source || '未知');
    logDiagnostic('error', 'renderer-console', `${details.message}（来源 ${source}:${details.lineNumber ?? 0}）`);
  });
}

async function createMainWindow(): Promise<void> {
  showWelcomeOnNextRendererLoad = !startupOpenedAssociatedWorkspace;
  const smokeTest = process.argv.includes('--smoke-test');
  const savedWindowState = await workspaceService.getWindowState();
  const usableBounds = savedWindowState && screen.getAllDisplays().some(display => intersects(display.workArea, savedWindowState))
    ? savedWindowState
    : undefined;
  const developmentWindowIcon = !app.isPackaged && process.platform === 'win32'
    ? path.join(repoRoot(), 'image', 'lingbuilder-ide-icon-v1.ico')
    : undefined;
  mainWindow = new BrowserWindow({
    width: usableBounds?.width || 1440,
    height: usableBounds?.height || 900,
    ...(usableBounds ? { x: usableBounds.x, y: usableBounds.y } : {}),
    minWidth: 1024,
    minHeight: 680,
    title: 'LingBuilder',
    backgroundColor: '#1e1e1e',
    frame: false,
    autoHideMenuBar: true,
    show: false,
    ...(developmentWindowIcon ? { icon: developmentWindowIcon } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (savedWindowState?.maximized) mainWindow?.maximize();
    if (!smokeTest) mainWindow?.show();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('close', event => {
    if (isQuitting || !mainWindow || rendererConfirmedClose.has(mainWindow)) return;
    event.preventDefault();
    mainWindow.webContents.send('window:close-requested');
  });
  attachDiagnosticHandlers(mainWindow);

  if (smokeTest) await writePackagedSmokeProgress('load-url:start');
  await mainWindow.loadURL(rendererOrigin);
  if (pendingModulePackagePath) {
    const packagePath = pendingModulePackagePath;
    pendingModulePackagePath = undefined;
    mainWindow.webContents.send(MODULE_INSTALL_EVENT, { packagePath });
  }
  if (smokeTest) await writePackagedSmokeProgress('load-url:done');
  // 消费构建自愈标记：上一次退出是「旧构建让位给新构建」，这里读掉并留痕，
  // 标题栏的构建时间戳（欢迎页/工作台顶栏）即用户可见的新旧判据。
  try {
    const markerPath = path.join(app.getPath('userData'), 'build-self-heal-marker.json');
    const markerRaw = await fs.readFile(markerPath, 'utf8');
    await fs.rm(markerPath, { force: true });
    console.info('[build-self-heal] 已从旧构建自动切换到当前安装的构建：', markerRaw.slice(0, 400));
  } catch {
    // 无标记（常规启动）属常态。
  }
  if (!app.isPackaged && process.env.LINGBUILDER_OPEN_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  if (smokeTest) await runPackagedSmokeTest(mainWindow);
}

async function runPackagedSmokeTest(window: BrowserWindow): Promise<void> {
  const resultPath = getArgumentValue(process.argv, '--smoke-result');
  try {
    await writePackagedSmokeProgress('renderer-smoke:start');
    const rendererResult = await window.webContents.executeJavaScript(`(async () => {
      const withTimeout = (promise, label, timeoutMs = 15000) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label + '超时。')), timeoutMs))
      ]);
      const timedFetch = (label, input, init) => withTimeout(fetch(input, init), label, 15000);
      const healthResponse = await timedFetch('本地服务健康检查', '/api/health');
      const modulesResponse = await timedFetch('已安装模块读取', '/api/modules/installed?projectId=lingbuilder-ui-project');
      const aiResponse = await timedFetch('AI 本地安全提案', '/api/lingcpp/edit/propose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          filePath: 'src/Smoke.lcpp',
          sourceCode: '类 Smoke\\n结束类\\n',
          instruction: '保持结构并生成安全提案',
          aiConfig: {
            provider: 'openai',
            baseUrl: 'http://127.0.0.1:1',
            apiKey: 'packaged-smoke',
            modelName: 'packaged-smoke'
          }
        })
      });
      const bridgeResponse = await timedFetch('共享 Bridge 路由隔离检查', '/api/ai-bridge/health');
      let managedBridgeStatus = 0;
      let managedMcpStatus = 0;
      let managedBridgeStopped = false;
      let managedClientLaunched = false;
      let managedBridgeError = '';
      try {
        const bridgeApi = window.lingBuilder?.aiBridge;
        if (!bridgeApi) throw new Error('安装版 preload 未暴露 AI Bridge API。');
        let started = null;
        for (let port = 17869; port <= 17879 && !started; port += 1) {
          try {
            started = await withTimeout(bridgeApi.start({ port, permission: 'preview', lifecycle: 'workspace' }), '启动受管 AI Bridge');
          } catch (error) {
            managedBridgeError = error instanceof Error ? error.message : String(error);
          }
        }
        if (!started) throw new Error(managedBridgeError || '没有可用的 AI Bridge 冒烟端口。');
        const token = await withTimeout(bridgeApi.revealToken(), '读取受管 AI Bridge Token');
        const refreshed = await withTimeout(bridgeApi.status(), '读取受管 AI Bridge 状态');
        managedBridgeStatus = started.state === 'running' && started.httpUrl && token.length >= 24 ? 200 : 0;
        managedMcpStatus = refreshed.state === 'running' && refreshed.mcpUrl && !refreshed.error ? 200 : 0;
        const launched = await withTimeout(bridgeApi.launchClient('generic'), '启动受管 AI 客户端');
        managedClientLaunched = launched.ok === true && Boolean(launched.sessionId);
        const stopped = await withTimeout(bridgeApi.stop(), '停止受管 AI Bridge');
        managedBridgeStopped = stopped.state === 'stopped';
        managedBridgeError = '';
      } catch (error) {
        managedBridgeError = error instanceof Error ? error.message : String(error);
        try {
          const stopped = await withTimeout(window.lingBuilder?.aiBridge?.stop(), '清理受管 AI Bridge');
          managedBridgeStopped = stopped?.state === 'stopped';
        } catch {
          // Preserve the original Bridge failure.
        }
      }
      const terminalCreateResponse = await timedFetch('创建终端会话', '/api/terminal/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: 'cmd', cols: 80, rows: 24 })
      });
      const terminalCreate = await terminalCreateResponse.json();
      let terminalSnapshot = null;
      let terminalResizeStatus = 0;
      let terminalCloseStatus = 0;
      if (terminalCreateResponse.ok && terminalCreate.session?.id) {
        await timedFetch('写入终端会话', '/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id) + '/input', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: 'echo LINGBUILDER_PACKAGED_PTY_OK\\r' })
        });
        for (let attempt = 0; attempt < 120; attempt += 1) {
          const list = await (await timedFetch('读取终端会话', '/api/terminal/sessions')).json();
          terminalSnapshot = list.sessions?.find(session => session.id === terminalCreate.session.id) || null;
          if (terminalSnapshot?.buffer?.includes('LINGBUILDER_PACKAGED_PTY_OK')) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        terminalResizeStatus = (await timedFetch('调整终端尺寸', '/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id) + '/resize', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cols: 100, rows: 30 })
        })).status;
        terminalCloseStatus = (await timedFetch('关闭终端会话', '/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id), { method: 'DELETE' })).status;
      }
      const health = await healthResponse.json();
      const modules = await modulesResponse.json();
      const ai = await aiResponse.json();
      return {
        ok: healthResponse.ok
          && modulesResponse.ok
          && aiResponse.ok
          && bridgeResponse.status === 404
          && managedBridgeStatus === 200
          && managedMcpStatus === 200
          && managedBridgeStopped
          && managedClientLaunched
          && health.status === 'ok'
          && Array.isArray(modules.modules)
          && ai.ok === true
          && Boolean(ai.proposal?.id)
          && terminalCreateResponse.status === 201
          && terminalSnapshot?.buffer?.includes('LINGBUILDER_PACKAGED_PTY_OK')
          && terminalResizeStatus === 200
          && terminalCloseStatus === 200,
        healthStatus: healthResponse.status,
        modulesStatus: modulesResponse.status,
        aiStatus: aiResponse.status,
        bridgeStatus: bridgeResponse.status,
        managedBridgeStatus,
        managedMcpStatus,
        managedBridgeStopped,
        managedClientLaunched,
        managedBridgeError,
        terminalStatus: terminalCreateResponse.status,
        terminalResizeStatus,
        terminalCloseStatus,
        terminalPtyOutput: Boolean(terminalSnapshot?.buffer?.includes('LINGBUILDER_PACKAGED_PTY_OK')),
        terminalBuffer: terminalSnapshot?.buffer || '',
        moduleCount: Array.isArray(modules.modules) ? modules.modules.length : 0,
        title: document.title,
        hasRoot: Boolean(document.getElementById('root'))
      };
    })()`);
    await writePackagedSmokeProgress('renderer-smoke:done');
    const serviceInfo = rendererReadyInfo;
    await stopRendererServer();
    const result = {
      ...rendererResult,
      workspacePath: activeWorkspace,
      serviceStopped: true,
      serviceOrigin: serviceInfo?.origin,
      servicePid: serviceInfo?.pid
    };
    if (resultPath) await fs.writeFile(resultPath, JSON.stringify(result, null, 2), 'utf8');
    await shutdownAndExit(result.ok ? 0 : 1);
  } catch (error) {
    try {
      await stopRendererServer();
    } catch {
      // The original smoke failure remains the primary diagnostic.
    }
    if (resultPath) {
      await fs.writeFile(resultPath, JSON.stringify({
        ok: false,
        serviceStopped: rendererServer === null,
        error: error instanceof Error ? error.message : String(error)
      }, null, 2), 'utf8');
    }
    await shutdownAndExit(1);
  }
}

async function writePackagedSmokeProgress(stage: string): Promise<void> {
  const resultPath = getArgumentValue(process.argv, '--smoke-result');
  if (!resultPath) return;
  await fs.writeFile(`${resultPath}.progress`, JSON.stringify({ stage, updatedAt: new Date().toISOString() }), 'utf8');
}

async function switchWorkspace(workspacePath: string): Promise<void> {
  const candidateWorkspace = await workspaceService.validateWorkspace(workspacePath);
  if (aiBridgeManager?.snapshot().state !== 'stopped') await aiBridgeManager.stop('工作区即将切换');
  if (agentRuntime && agentRuntime.snapshot().state !== 'stopped') await agentRuntime.dispose().catch(() => undefined);
  const result = await requestRendererApi('/api/workspace/switch', {
    method: 'POST',
    body: JSON.stringify({ workspacePath: candidateWorkspace })
  }) as { workspacePath?: string; version?: number };
  activeWorkspace = await workspaceService.rememberWorkspace(result.workspacePath || candidateWorkspace);
  if (rendererReadyInfo) rendererReadyInfo = { ...rendererReadyInfo, workspaceRoot: activeWorkspace };
  showWelcomeOnNextRendererLoad = false;
  mainWindow?.webContents.send('workspace:changed', {
    workspacePath: activeWorkspace,
    version: result.version
  });
}

async function importModulePackage(sourcePath: string) {
  try {
    if (!activeWorkspace) throw new Error('当前没有已打开的工作区。');
    const source = await fs.realpath(String(sourcePath || ''));
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw new Error('拖入目标不是文件。');
    if (!isLbmodPath(source)) throw new Error('只能导入 .lbmod 模块包。');
    if (stat.size > 100 * 1024 * 1024) throw new Error('模块包超过 100MB 限制。');
    const packageDir = path.join(path.resolve(activeWorkspace), '.lingbuilder', 'module-packages');
    await fs.mkdir(packageDir, { recursive: true });
    const parsed = path.parse(source);
    let target = path.join(packageDir, `${parsed.name}${parsed.ext}`);
    try { await fs.access(target); target = path.join(packageDir, `${parsed.name}-${Date.now()}${parsed.ext}`); } catch { /* new file */ }
    await fs.copyFile(source, target);
    return { ok: true, canceled: false, relativePath: path.relative(activeWorkspace, target).replace(/\\/gu, '/') };
  } catch (error) { return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) }; }
}

function registerIpcHandlers(): void {
  ipcMain.handle('startup:should-show-welcome', () => showWelcomeOnNextRendererLoad);
  ipcMain.handle('window:minimize', () => getFocusedWindow()?.minimize());
  ipcMain.handle('window:toggle-maximize', () => {
    const window = getFocusedWindow();
    if (!window) return false;
    if (window.isMaximized()) {
      window.unmaximize();
      return false;
    }
    window.maximize();
    return true;
  });
  ipcMain.handle('window:is-maximized', () => getFocusedWindow()?.isMaximized() ?? false);
  ipcMain.handle('window:close', () => getFocusedWindow()?.webContents.send('window:close-requested'));
  ipcMain.handle('window:confirm-close', async () => {
    const window = getFocusedWindow();
    if (!window) return;
    const bounds = window.getNormalBounds();
    await workspaceService.rememberWindowState({ ...bounds, maximized: window.isMaximized() });
    rendererConfirmedClose.add(window);
    window.close();
  });
  ipcMain.handle('shell:open-path', async (_event, targetPath: string) => targetPath ? shell.openPath(targetPath) : 'missing-path');
  ipcMain.handle('app:check-update', async (_event, payload?: { channel?: 'stable' | 'preview' }) => {
    // 渠道显式化：默认 stable；preview 只在用户开启体验渠道时请求，云端校验体验资格，无资格静默降级 stable。
    const channel = payload?.channel === 'preview' ? 'preview' : 'stable';
    const accessToken = channel === 'preview' ? await cloudAccountService.currentAccessToken() : '';
    lastVersionCheck = await checkLatestVersion(cloudApiOrigin(), app.getVersion(), { channel, accessToken });
    return lastVersionCheck;
  });
  ipcMain.handle('beta-program:entitlement', () => cloudAccountService.betaEntitlement());
  ipcMain.handle('beta-program:apply', (_event, message?: unknown) => cloudAccountService.betaApply(String(message ?? '').slice(0, 500)));
  ipcMain.handle('beta-program:cancel-application', () => cloudAccountService.betaCancelApplication());
  ipcMain.handle('app:update:download', () => {
    if (!lastVersionCheck?.latestVersion || !lastVersionCheck.hasUpdate) return Promise.resolve({ ok: false, error: '请先检查更新，再下载更新包。' });
    return updateDownloadService.download(lastVersionCheck);
  });
  ipcMain.handle('app:update:cancel', () => ({ ok: updateDownloadService.cancel() }));
  ipcMain.handle('app:update:status', () => updateDownloadService.status());
  ipcMain.handle('app:update:install', async () => {
    const result = await updateDownloadService.install();
    if (result.ok) void shutdownAndExit(0);
    return result;
  });
  ipcMain.handle('payments:open-page', async (_event, url: string) => {
    try {
      const target = new URL(String(url || ''));
      if (target.protocol !== 'https:' || !['api.lingbuilder.com', 'lingbuilder.com'].includes(target.hostname)) return '支付链接无效。';
      await shell.openExternal(target.toString());
      return '';
    } catch (error) {
      return `无法打开支付页面：${error instanceof Error ? error.message : String(error)}`;
    }
  });
  ipcMain.handle('community:open-qq-group', async () => {
    try {
      await shell.openExternal('https://qm.qq.com/q/q2VNHZXLXy');
      return '';
    } catch (error) {
      return `无法打开交流QQ群链接：${error instanceof Error ? error.message : String(error)}`;
    }
  });
  ipcMain.handle('logs:reveal', async () => shell.openPath(getDiagnosticLogDirectory()));
  ipcMain.handle('logs:export', async () => {
    const owner = getFocusedWindow();
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const options: Electron.SaveDialogOptions = {
      title: '导出本地诊断日志',
      defaultPath: path.join(app.getPath('downloads'), `LingBuilder诊断日志-${stamp}.log`),
      filters: [{ name: '日志文件', extensions: ['log'] }]
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
    if (result.canceled || !result.filePath) return { ok: false, canceled: true };
    try {
      diagnosticLog?.exportBundle(result.filePath);
      logDiagnostic('info', 'logs', `诊断日志已导出：${result.filePath}`);
      return { ok: true, filePath: result.filePath };
    } catch (error) {
      return { ok: false, error: `导出日志失败：${error instanceof Error ? error.message : String(error)}` };
    }
  });
  ipcMain.handle('logs:delete', async () => {
    const owner = getFocusedWindow();
    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      title: '删除本地日志',
      message: '确定要删除全部本地诊断日志吗？',
      detail: '将清空 userData/logs 下的全部诊断日志文件，不影响设置、工作区和项目文件。',
      buttons: ['删除', '取消'],
      defaultId: 1,
      cancelId: 1,
      noLink: true
    };
    const choice = owner ? await dialog.showMessageBox(owner, options) : await dialog.showMessageBox(options);
    if (choice.response !== 0) return { ok: false, canceled: true };
    const deleted = diagnosticLog?.deleteAllLogs() ?? 0;
    logDiagnostic('info', 'logs', `用户已删除本地日志（${deleted} 个文件）。`);
    return { ok: true, deleted };
  });
  ipcMain.on('diagnostic:report', (_event, payload: unknown) => {
    const entry = (payload || {}) as { level?: unknown; category?: unknown; message?: unknown };
    const level = entry.level === 'error' || entry.level === 'warn' ? entry.level : 'info';
    const category = String(entry.category || 'renderer').slice(0, 40);
    const message = String(entry.message || '').slice(0, 1000);
    if (message) logDiagnostic(level, category, message);
  });
  ipcMain.handle('shell:reveal-workspace-path', async (_event, targetPath: string) => {
    try {
      if (!String(targetPath || '').trim()) return '没有可定位的路径。';
      const shellWorkspaceRoot = getShellWorkspaceRoot();
      const trustedWorkspaceCandidates = [
        shellWorkspaceRoot,
        activeWorkspace,
        rendererReadyInfo?.workspaceRoot,
        process.env.LINGBUILDER_WORKSPACE_ROOT
      ].filter((candidate): candidate is string => Boolean(candidate));
      if (trustedWorkspaceCandidates.length === 0) return '当前没有已打开的工作区。';
      const requestedTarget = String(targetPath).trim();
      const [trustedWorkspaceRoots, resolvedTarget] = await Promise.all([
        Promise.all(trustedWorkspaceCandidates.map(candidate => fs.realpath(candidate))),
        fs.realpath(path.isAbsolute(requestedTarget)
          ? requestedTarget
          : path.resolve(shellWorkspaceRoot, requestedTarget))
      ]);
      const isInsideTrustedWorkspace = trustedWorkspaceRoots.some(workspaceRoot => {
        const relativeTarget = path.relative(workspaceRoot, resolvedTarget);
        return !relativeTarget.startsWith('..') && !path.isAbsolute(relativeTarget);
      });
      if (!isInsideTrustedWorkspace) {
        return '目标路径超出当前工作区。';
      }
      return await openPathWithExplorerFallback(resolvedTarget, shell);
    } catch (error) {
      return `路径不存在或无法打开：${error instanceof Error ? error.message : String(error)}`;
    }
  });
  ipcMain.handle('shell:open-workspace-path', async (_event, relativePath = '.') => {
    const selectedWorkspaceRoot = getShellWorkspaceRoot();
    if (!selectedWorkspaceRoot) return '当前没有已打开的工作区。';
    const workspaceRoot = path.resolve(selectedWorkspaceRoot);
    const targetPath = path.resolve(workspaceRoot, relativePath || '.');
    const relativeTarget = path.relative(workspaceRoot, targetPath);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) return '目标目录超出当前工作区。';
    return await openPathWithExplorerFallback(targetPath, shell);
  });
  ipcMain.handle('shell:copy-full-path', async (_event, target: unknown) => {
    try {
      const selectedWorkspaceRoot = getShellWorkspaceRoot();
      if (!selectedWorkspaceRoot) throw new Error('当前没有已打开的工作区。');
      if (!target || typeof target !== 'object') throw new Error('复制路径目标无效。');

      const request = target as { kind?: unknown; relativePath?: unknown; solutionName?: unknown };
      const workspaceRoot = await fs.realpath(path.resolve(selectedWorkspaceRoot));
      let requestedPath: string;
      if (request.kind === 'solution') {
        const solutionName = typeof request.solutionName === 'string' ? request.solutionName.trim() : '';
        if (!solutionName) throw new Error('解决方案名称无效。');
        requestedPath = await findCurrentSolutionEntryPath(workspaceRoot, solutionName);
      } else if (request.kind === 'project') {
        const relativePath = typeof request.relativePath === 'string' ? request.relativePath.trim() : '';
        requestedPath = path.resolve(workspaceRoot, relativePath || '.');
      } else {
        throw new Error('不支持的复制路径目标。');
      }

      const resolvedPath = await fs.realpath(requestedPath);
      const relativeTarget = path.relative(workspaceRoot, resolvedPath);
      if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) {
        throw new Error('目标路径超出当前工作区。');
      }
      clipboard.writeText(resolvedPath);
      return { ok: true, path: resolvedPath };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('docs:open-module-manual', async () => shell.openPath(moduleManualPath()));
  ipcMain.handle('docs:open-cli-manual', async () => shell.openPath(cliManualPath()));
  ipcMain.handle('docs:open-ai-module-guide', async () => shell.openPath(aiModuleGuidePath()));
  ipcMain.handle('docs:read-ai-module-guide', async () => {
    try {
      return await fs.readFile(aiModuleGuidePath(), 'utf8');
    } catch {
      return '';
    }
  });
  ipcMain.handle('cli:inspect', async () => inspectInstalledCli());
  ipcMain.handle('ai-bridge:status', async () => await aiBridgeManager.refreshRuntime());
  ipcMain.handle('ai-bridge:start', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    const permission = String(value.permission || 'preview') as ManagedAiBridgePermission;
    if (permission === 'yolo' && value.approvedYolo !== true) throw new Error('启用 yolo 前必须确认外部 AI 可自动写入并执行受控构建。');
    const port = typeof value.port === 'number' ? value.port : Number(value.port || 17860);
    const lifecycle = String(value.lifecycle || 'workspace') as ManagedAiBridgeLifecycle;
    const token = typeof value.token === 'string' ? value.token : undefined;
    const snapshot = await aiBridgeManager.start({
      workspaceRoot: getShellWorkspaceRoot(),
      port,
      permission,
      lifecycle,
      token,
      moduleAccessState: Buffer.from(JSON.stringify(await readModulePermitCache()), 'utf8').toString('base64url')
    });
    // 记住上次成功启动的设置（含自定义 Token，safeStorage 加密），下次打开连接中心自动回填。
    let settingsError = '';
    try {
      const persisted = await readAiBridgeStartSettings(resolveAiBridgeStartSettingsPath(app.getPath('userData')), safeStorage);
      await writeAiBridgeStartSettings(resolveAiBridgeStartSettingsPath(app.getPath('userData')), {
        port: snapshot.port || port,
        permission,
        lifecycle,
        token: token || '',
        // 外部 AI 授权开关独立于启动动作，必须原样保留，否则一次启动就把用户设置抹平。
        externalModuleAccess: persisted?.externalModuleAccess === true
      }, safeStorage);
    } catch (reason) {
      // 设置保存失败不阻断启动，但必须让用户可见（否则会出现「启动成功却记不住」）。
      settingsError = reason instanceof Error ? reason.message : String(reason);
    }
    return settingsError ? { ...snapshot, settingsError } : snapshot;
  });
  ipcMain.handle('ai-bridge:start-settings:load', async () => {
    const settings = await readAiBridgeStartSettings(resolveAiBridgeStartSettingsPath(app.getPath('userData')), safeStorage) ?? null;
    return { settings, localAuthorization: localAuthorization?.snapshot() ?? null };
  });
  ipcMain.handle('ai-bridge:local-auth-status', async () => localAuthorization?.snapshot() ?? null);
  ipcMain.handle('skill-kit:status', async () => await skillKitService().snapshot());
  ipcMain.handle('skill-kit:check-update', async () => await skillKitService().checkForUpdates());
  ipcMain.handle('ai-bridge:start-settings:save', async (_event, settings: unknown) => {
    const normalized = normalizeAiBridgeStartSettings(settings);
    if (!normalized) return { ok: false, error: '设置无效：端口需为 1024–65535，权限与生命周期取内置枚举，Token 需 24–256 个不含空白的可见 ASCII 字符。' };
    try {
      await writeAiBridgeStartSettings(resolveAiBridgeStartSettingsPath(app.getPath('userData')), normalized, safeStorage);
      // 外部 AI 授权开关立即生效：开启即监听回环端口并写发现文件，关闭即停监听并清理。
      const localAuth = await syncLocalAuthorizationService();
      return { ok: true, localAuthorization: localAuth };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  ipcMain.handle('ai-bridge:stop', async () => await aiBridgeManager.stop('用户停止'));
  ipcMain.handle('ai-bridge:rotate-token', async () => await aiBridgeManager.rotateToken());
  ipcMain.handle('ai-bridge:reveal-token', async () => aiBridgeManager.revealToken());
  ipcMain.handle('ai-bridge:clients', async () => await detectExternalAiClients());
  ipcMain.handle('agent-runtime:status', async () => agentRuntime?.snapshot());
  ipcMain.handle('agent-runtime:start', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    try {
      const snapshot = await agentRuntime.start({
        workspaceRoot: getShellWorkspaceRoot(),
        provider: typeof value.provider === 'string' ? value.provider : undefined,
        model: typeof value.model === 'string' ? value.model : undefined,
        maxTokens: typeof value.maxTokens === 'number' ? value.maxTokens : undefined,
        reasoningEffort: typeof value.reasoningEffort === 'string' ? value.reasoningEffort : undefined
      });
      return { ok: true, snapshot };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  ipcMain.handle('agent-runtime:prompt', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    try {
      const result = await agentRuntime.prompt(
        typeof value.prompt === 'string' ? value.prompt : '',
        typeof value.sessionId === 'string' ? value.sessionId : undefined
      );
      return { ok: true, ...result };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  ipcMain.handle('agent-runtime:stop', async () => {
    try {
      return { ok: true, snapshot: await agentRuntime.stop() };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  // 模型通道配置：密钥只进主进程，渲染层拿到的永远是掩码视图（hasApiKey + 空串）。
  ipcMain.handle('agent-runtime:get-provider-settings', async () => ({
    ok: true,
    settings: { ...agentProviderCache, apiKey: '' },
    hasApiKey: Boolean(agentProviderCache.apiKey),
    keyUnavailable: agentProviderKeyUnavailable
  }));
  ipcMain.handle('agent-runtime:set-provider-settings', async (_event, request: unknown) => {
    const normalized = normalizeAgentProviderSettings(request);
    if (!normalized.settings) return { ok: false, error: normalized.problem || '模型配置无效。' };
    const settings = mergeAgentProviderKey(
      normalized.settings, agentProviderCache,
      (request as Record<string, unknown> | undefined)?.clearApiKey === true);
    try {
      const written = await writeAgentProviderSettings(
        resolveAgentProviderSettingsPath(app.getPath('userData')), settings, safeStorage);
      agentProviderCache = settings;
      agentProviderKeyUnavailable = false;
      return {
        ok: true,
        settings: { ...agentProviderCache, apiKey: '' },
        hasApiKey: Boolean(agentProviderCache.apiKey),
        problem: written.problem
      };
    } catch (reason) {
      return { ok: false, error: `保存模型配置失败：${reason instanceof Error ? reason.message : String(reason)}` };
    }
  });
  ipcMain.handle('agent-runtime:restart', async () => {
    try {
      const snapshot = await agentRuntime.restart({ workspaceRoot: getShellWorkspaceRoot() });
      return { ok: true, snapshot };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  // 拉模型列表 / 测连通由主进程代调本地服务：避免把已保存的密钥下发到渲染层再回传。
  ipcMain.handle('agent-runtime:probe-provider', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    const draft = normalizeAgentProviderSettings({
      kind: value.kind, baseUrl: value.baseUrl, model: value.model, protocol: value.protocol,
      // 渲染层留空表示沿用已保存的密钥，不重新下发一份。
      apiKey: typeof value.apiKey === 'string' && value.apiKey.trim() ? value.apiKey : agentProviderCache.apiKey
    });
    if (!draft.settings) return { ok: false, error: draft.problem || '模型配置无效。' };
    const settings = draft.settings;
    const custom = settings.kind === 'custom-openai';
    const aiConfig = {
      provider: custom ? 'openai' : 'deepseek',
      baseUrl: settings.baseUrl || (custom ? '' : 'https://api.deepseek.com'),
      apiKey: settings.apiKey,
      modelName: settings.model || (custom ? '' : 'deepseek-v4-flash')
    };
    const endpoint = value.action === 'models' ? '/api/ai/models' : '/api/ai/connect';
    try {
      const result = await requestRendererApi(endpoint, { method: 'POST', body: JSON.stringify({ aiConfig }) });
      return { ok: true, result };
    } catch (reason) {
      return { ok: false, error: reason instanceof Error ? reason.message : String(reason) };
    }
  });
  ipcMain.handle('ai-bridge:codex-desktop-status', async (_event, permission?: ManagedAiBridgePermission) => (
    await codexDesktopIntegration().inspect(permission || 'preview')
  ));
  ipcMain.handle('ai-bridge:configure-codex-desktop', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    const permission = String(value.permission || 'preview') as ManagedAiBridgePermission;
    if (permission === 'yolo' && value.approvedYolo !== true) {
      throw new Error('为 Codex 桌面版启用 yolo 前必须确认其可自动写入并执行受控构建。');
    }
    return await codexDesktopIntegration().configure({
      permission,
      replaceExisting: value.replaceExisting === true,
      openApp: value.openApp !== false
    });
  });
  ipcMain.handle('ai-bridge:remove-codex-desktop', async () => await codexDesktopIntegration().remove());
  ipcMain.handle('ai-bridge:open-codex-desktop', async () => await codexDesktopIntegration().open());
  ipcMain.handle('ai-bridge:launch-client', async (_event, clientId: ExternalAiClientId) => {
    const snapshot = aiBridgeManager.snapshot();
    if (snapshot.state !== 'running') throw new Error('请先启动 AI Bridge，再连接外部 AI CLI。');
    const clients = clientId === 'generic'
      ? [{ id: 'generic' as const, label: '通用终端', installed: true, executable: '', detail: '打开已注入 Bridge 地址和临时 Token 的 PowerShell。' }]
      : await detectExternalAiClients();
    const plan = await createExternalAiLaunchPlan({
      clientId, clients, workspaceRoot: snapshot.workspaceRoot, mcpUrl: snapshot.mcpUrl,
      httpUrl: snapshot.httpUrl, token: aiBridgeManager.revealToken()
    });
    const created = await requestRendererApi('/api/terminal/sessions', {
      method: 'POST',
      body: JSON.stringify({ profile: plan.profile, cwd: plan.cwd, cols: 100, rows: 30, env: plan.env, title: plan.title })
    }) as { session?: { id?: string } };
    const sessionId = created.session?.id;
    if (!sessionId) throw new Error('集成终端没有返回有效会话。');
    await requestRendererApi(`/api/terminal/sessions/${encodeURIComponent(sessionId)}/input`, {
      method: 'POST', body: JSON.stringify({ data: `${plan.command}\r` })
    });
    return { ok: true, sessionId, detail: plan.detail };
  });
  // 「导入 MSBuild/CMake 工程」：原生文件对话框与区外工程复制进工作区（桌面版专属通道）。
  ipcMain.handle('solution-import:pick-project', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择要导入的 C++ 工程',
      properties: ['openFile'],
      filters: [
        { name: 'C++ 工程（.vcxproj / .sln / CMakeLists.txt）', extensions: ['vcxproj', 'sln', 'txt'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      const selected = await fs.realpath(result.filePaths[0]);
      const lower = selected.toLowerCase();
      const base = path.basename(lower);
      if (base !== 'cmakelists.txt' && !lower.endsWith('.vcxproj') && !lower.endsWith('.sln')) {
        return { ok: false, canceled: false, error: '只能导入 CMakeLists.txt、.vcxproj 或 .sln 工程文件。' };
      }
      return { ok: true, canceled: false, filePath: selected };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('solution-import:pick-source-directory', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择要导入的 C++ 源码目录',
      properties: ['openDirectory']
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      return { ok: true, canceled: false, filePath: await fs.realpath(result.filePaths[0]) };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('solution-import:copy-external-project', async (_event, projectFilePath: string) => {
    // 复制工作区外的工程到 <工作区>/external/<目录名>（排除构建产物与环境目录），
    // 返回复制后工程文件的工作区相对路径，供后续导入走同一条区内导入链路。
    const SKIPPED_DIRECTORIES = new Set([
      '.vs', '.git', '.svn', '.lingbuilder', '.lingbuilder-build', 'node_modules', 'packages',
      'obj', 'bin', 'build', 'builds', 'out', 'output', 'debug', 'release', 'x64', 'win32',
      'cmake-build-debug', 'cmake-build-release', '.cache', '.idea'
    ]);
    const MAX_FILE_COUNT = 20_000;
    const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
    try {
      if (!activeWorkspace) throw new Error('当前没有已打开的工作区。');
      const source = await fs.realpath(String(projectFilePath || ''));
      const lower = source.toLowerCase();
      const base = path.basename(lower);
      if (base !== 'cmakelists.txt' && !lower.endsWith('.vcxproj') && !lower.endsWith('.sln')) {
        throw new Error('只能复制 CMakeLists.txt、.vcxproj 或 .sln 工程文件所在目录。');
      }
      const sourceDir = path.dirname(source);
      const workspaceRoot = path.resolve(activeWorkspace);
      if (path.relative(workspaceRoot, sourceDir) === '' || (!path.relative(workspaceRoot, sourceDir).startsWith('..') && !path.isAbsolute(path.relative(workspaceRoot, sourceDir)))) {
        throw new Error('该工程已位于当前工作区内，无需复制。');
      }
      const externalRoot = path.join(workspaceRoot, 'external');
      await fs.mkdir(externalRoot, { recursive: true });
      let targetDir = path.join(externalRoot, path.basename(sourceDir));
      let suffix = 2;
      while (true) {
        try { await fs.access(targetDir); targetDir = path.join(externalRoot, `${path.basename(sourceDir)}-${suffix++}`); } catch { break; }
      }
      let fileCount = 0;
      let totalBytes = 0;
      const copyTree = async (from: string, to: string): Promise<void> => {
        const entries = await fs.readdir(from, { withFileTypes: true });
        await fs.mkdir(to, { recursive: true });
        for (const entry of entries) {
          if (fileCount >= MAX_FILE_COUNT) throw new Error(`工程文件数超过 ${MAX_FILE_COUNT} 上限，已中止复制。`);
          const sourcePath = path.join(from, entry.name);
          const targetPath = path.join(to, entry.name);
          if (entry.isDirectory()) {
            if (SKIPPED_DIRECTORIES.has(entry.name.toLowerCase())) continue;
            await copyTree(sourcePath, targetPath);
          } else if (entry.isFile()) {
            const stat = await fs.stat(sourcePath);
            totalBytes += stat.size;
            if (totalBytes > MAX_TOTAL_BYTES) throw new Error('工程体积超过 1GB 上限，已中止复制。请改为把工程目录移动到工作区内后重新打开。');
            fileCount += 1;
            await fs.copyFile(sourcePath, targetPath);
          }
        }
      };
      await copyTree(sourceDir, targetDir);
      const projectFileRelative = path.relative(workspaceRoot, path.join(targetDir, path.basename(source))).replace(/\\/gu, '/');
      return { ok: true, projectFileRelative, targetDir };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('modules:import-package', async (_event, sourcePath: string) => {
    try {
      if (!activeWorkspace) throw new Error('当前没有已打开的工作区。');
      const source = await fs.realpath(String(sourcePath || ''));
      const stat = await fs.stat(source);
      if (!stat.isFile()) throw new Error('拖入目标不是文件。');
      if (!source.toLowerCase().endsWith('.lbmod')) throw new Error('只能导入 .lbmod 模块包。');
      if (stat.size > 100 * 1024 * 1024) throw new Error('模块包超过 100MB 限制。');
      const packageDir = path.join(path.resolve(activeWorkspace), '.lingbuilder', 'module-packages');
      await fs.mkdir(packageDir, { recursive: true });
      const parsed = path.parse(source);
      let target = path.join(packageDir, `${parsed.name}${parsed.ext}`);
      try {
        await fs.access(target);
        target = path.join(packageDir, `${parsed.name}-${Date.now()}${parsed.ext}`);
      } catch {
        // 目标不存在时保留原文件名。
      }
      await fs.copyFile(source, target);
      return { ok: true, relativePath: path.relative(activeWorkspace, target).replace(/\\/gu, '/') };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('modules:select-package', async () => {
    const owner = getFocusedWindow();
    const result = owner
      ? await dialog.showOpenDialog(owner, { title: '选择 .lbmod 文件', properties: ['openFile'], filters: [{ name: 'LingBuilder 模块包', extensions: ['lbmod'] }] })
      : await dialog.showOpenDialog({ title: '选择 .lbmod 文件', properties: ['openFile'], filters: [{ name: 'LingBuilder 模块包', extensions: ['lbmod'] }] });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    return await importModulePackage(result.filePaths[0]);
  });
  ipcMain.handle('modules:open-info', async (_event, module: unknown) => {
    if (!module || typeof module !== 'object') throw new Error('模块信息无效。');
    await moduleInfoWindow.open(module as Record<string, unknown>);
  });
  ipcMain.handle('modules:list-demos', async () => {
    try {
      const moduleIds = await listModuleDemoIds(moduleDemoServiceOptions());
      return { ok: true, moduleIds };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('modules:open-demo', async (_event, moduleId: string) => {
    try {
      return await openModuleDemoInNewInstance(moduleDemoServiceOptions(), String(moduleId || ''), {
        isPackaged: app.isPackaged,
        execPath: process.execPath,
        appPath: app.getAppPath()
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('source-packages:export-project', async (_event, projectId: string, suggestedName?: string) => {
    try {
      const workspaceRoot = getShellWorkspaceRoot();
      if (!workspaceRoot) throw new Error('当前没有已打开的工作区。');
      const owner = getFocusedWindow();
      const defaultName = `${String(suggestedName || 'LingBuilder源码').replace(/[<>:"/\\|?*\u0000-\u001f]+/gu, '-')}${LCPP_SOURCE_PACKAGE_EXTENSION}`;
      const exportRoot = path.join(path.resolve(workspaceRoot), 'exports');
      await fs.mkdir(exportRoot, { recursive: true });
      const options: Electron.SaveDialogOptions = {
        title: '一键导出 LCPP 源码包',
        defaultPath: path.join(exportRoot, defaultName),
        filters: [{ name: 'LingBuilder LCPP 源码包', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1)] }]
      };
      const selected = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);
      if (selected.canceled || !selected.filePath) return { ok: false, canceled: true };
      const targetPath = resolveProjectSourcePackagePath(workspaceRoot, selected.filePath, defaultName);
      const result = await createLcppSourcePackageService(workspaceRoot).exportProject(String(projectId || ''), targetPath, app.getVersion());
      return { ...result, canceled: false };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('source-packages:open', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '打开 LCPP 源码包',
      properties: ['openFile'],
      filters: [{ name: 'LingBuilder LCPP 源码包', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1)] }]
    };
    const selected = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);
    if (selected.canceled || !selected.filePaths[0]) return { ok: false, canceled: true };
    try {
      const workspacePath = await workspaceService.resolveWorkspaceTarget(selected.filePaths[0]);
      await switchWorkspace(workspacePath);
      return { ok: true, canceled: false, workspacePath };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('designer-assets:select-image', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择图片资源',
      properties: ['openFile'],
      filters: [
        { name: '支持的图片', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tif', 'tiff'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, filePath: result.filePaths[0] };
  });
  ipcMain.handle('designer-assets:select-gif', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择 GIF 动态图像',
      properties: ['openFile'],
      filters: [
        { name: 'GIF 动态图像', extensions: ['gif'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, filePath: result.filePaths[0] };
  });
  ipcMain.handle('designer-assets:select-animation', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择 AVI 动画',
      properties: ['openFile'],
      filters: [
        { name: 'AVI 动画', extensions: ['avi'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, filePath: result.filePaths[0] };
  });
  ipcMain.handle('designer-assets:select-video', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择视频文件',
      properties: ['openFile'],
      filters: [
        { name: '支持的视频', extensions: ['mp4', 'wmv', 'avi', 'mov', 'm4v'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, filePath: result.filePaths[0] };
  });
  ipcMain.handle('designer-assets:select-icon', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择窗口图标',
      properties: ['openFile'],
      filters: [
        { name: 'Windows 图标', extensions: ['ico'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    return result.canceled || !result.filePaths[0]
      ? { canceled: true }
      : { canceled: false, filePath: result.filePaths[0] };
  });
  // 内嵌资源：只负责弹出本机选择框并把选中的路径做 realpath 归一化；
  // 复制进工作区、大小与逻辑名校验统一由 renderer 本地服务（/api/window-designer/embedded-resources/import）完成，
  // renderer 不直接接触 fs，主进程也不猜测工作区/项目目录结构。
  ipcMain.handle('designer-assets:select-embedded-files', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择要内嵌的资源文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '所有文件', extensions: ['*'] }]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return { canceled: true, filePaths: [] as string[] };
    try {
      return { canceled: false, filePaths: await resolvePickedFiles(result.filePaths) };
    } catch (error) {
      return { canceled: false, filePaths: [] as string[], error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('designer-assets:select-embedded-folder', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '选择要内嵌的资源文件夹',
      properties: ['openDirectory']
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { canceled: true };
    try {
      return { canceled: false, directoryPath: await resolvePickedDirectory(result.filePaths[0]) };
    } catch (error) {
      return { canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('credentials:ai:get', () => readAiCredential());
  ipcMain.handle('credentials:ai:set', (_event, value: string) => writeAiCredential(typeof value === 'string' ? value.slice(0, 16_384) : ''));
  ipcMain.handle('credentials:ai:delete', () => writeAiCredential(''));
  ipcMain.handle('credentials:fbro-vip:status', async () => { const credential = await resolveFbroVipCredential(); return { configured: Boolean(credential.value), source: credential.source }; });
  ipcMain.handle('credentials:fbro-vip:set', async (_event, value: string) => { const normalized = typeof value === 'string' ? value.trim() : ''; if (!normalized) throw new Error('FBro VIP Key 不能为空。'); if (normalized.length > 4096) throw new Error('FBro VIP Key 长度不能超过 4096 个字符。'); await writeFbroVipCredential(normalized); publishFbroVipCredential(normalized); return { configured: true, source: 'secure-storage' as const }; });
  ipcMain.handle('credentials:fbro-vip:delete', async () => { await writeFbroVipCredential(''); publishFbroVipCredential(startupFbroVipKey); return { configured: Boolean(startupFbroVipKey), source: startupFbroVipKey ? 'environment' as const : 'none' as const }; });
  ipcMain.handle('cloud-account:register', (_event, value: any) => cloudAccountService.register(String(value?.email || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:verify-email', (_event, token: string) => cloudAccountService.verifyEmail(String(token || '')));
  ipcMain.handle('cloud-account:forgot-password', (_event, value: any) => cloudAccountService.forgotPassword(String(value?.email || '')));
  ipcMain.handle('cloud-account:reset-password', (_event, value: any) => cloudAccountService.resetPassword(String(value?.token || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:login', (_event, value: any) => cloudAccountService.login(String(value?.email || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:logout', async () => { const result = await cloudAccountService.logout(); await writeModulePermitCache([]); await requestRendererApi('/api/module-access/clear', { method: 'POST', body: '{}' }).catch(() => undefined); if (aiBridgeManager?.snapshot().state === 'running') await aiBridgeManager.stop('账号已退出，正在撤销收费模块授权'); return result; });
  ipcMain.handle('cloud-account:session', () => cloudAccountService.snapshot());
  ipcMain.handle('cloud-account:models', () => cloudAccountService.models());
  ipcMain.handle('cloud-account:balance', () => cloudAccountService.balance());
  ipcMain.handle('cloud-modules:catalog', () => cloudAccountService.moduleCatalog());
  ipcMain.handle('cloud-modules:entitlements', () => cloudAccountService.moduleEntitlements());
  ipcMain.handle('cloud-modules:create-order', (_event, value: any) => cloudAccountService.createModuleOrder(String(value?.offerId || ''), value?.provider === 'alipay' ? 'alipay' : 'wechat', String(value?.idempotencyKey || '')));
  ipcMain.handle('cloud-credits:packages', () => cloudAccountService.rechargePackages());
  ipcMain.handle('cloud-credits:create-order', (_event, value: any) => cloudAccountService.createRechargeOrder(String(value?.packageId || ''), value?.provider === 'alipay' ? 'alipay' : 'wechat', String(value?.idempotencyKey || '')));
  ipcMain.handle('cloud-credits:order', (_event, orderId: string) => cloudAccountService.rechargeOrder(String(orderId || '')));
  ipcMain.handle('cloud-modules:download', (_event, value: any) => cloudAccountService.downloadModuleArtifact(String(value?.moduleId || ''), ['win32', 'x64'].includes(value?.arch) ? value.arch : 'any', activeWorkspace));
  ipcMain.handle('cloud-modules:authorize', async (_event, moduleId: string) => {
    try {
      const authorization = await cloudAccountService.modulePermit(String(moduleId || ''));
      const response = await requestRendererApi('/api/module-access/sync', { method: 'POST', body: JSON.stringify(authorization) }) as any;
      if (!response?.ok) return { ok: false, error: String(response?.error || '本地模块授权同步失败，请重新启动 IDE 后重试。') };
      const cached = (await readModulePermitCache()).filter(item => item?.permit?.payload?.moduleId !== moduleId);
      cached.push(authorization); await writeModulePermitCache(cached);
      if (aiBridgeManager?.snapshot().state === 'running') await aiBridgeManager.stop('模块授权已刷新，请重新启动 AI Bridge');
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: /[\u3400-\u9fff]/u.test(message) ? message : '模块授权检查失败，请确认云端服务已启动并重新登录后再试。' };
    }
  });
  ipcMain.handle('cloud-ai:start', async (event, kind: 'chat'|'edit', payload: unknown) => cloudAccountService.startAi(kind, payload, (requestKey, streamEvent) => event.sender.send('cloud-ai:event', requestKey, streamEvent)));
  ipcMain.handle('cloud-ai:cancel', (_event, requestKey: string) => cloudAccountService.cancel(requestKey));
  ipcMain.handle('workspace:get-current', () => activeWorkspace);
  ipcMain.handle('workspace:list-recent', () => workspaceService.listRecentWorkspaces());
  ipcMain.handle('workspace:forget-recent', (_event, workspacePath: string) => workspaceService.forgetWorkspace(workspacePath));
  ipcMain.handle('workspace:close-current', async () => {
    const previousWorkspace = activeWorkspace;
    try {
      const freshWorkspace = await workspaceService.createFreshWorkspace();
      await switchWorkspace(freshWorkspace);
      await workspaceService.forgetWorkspace(previousWorkspace);
      return { ok: true, workspacePath: activeWorkspace };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('workspace:open-path', async (_event, targetPath: string, newWindow = false) => {
    try {
      const workspacePath = await workspaceService.resolveWorkspaceTarget(targetPath);
      if (newWindow) {
        launchWorkspaceWindow(workspacePath);
        return { ok: true, canceled: false, workspacePath, newWindow: true };
      }
      await switchWorkspace(workspacePath);
      return { ok: true, canceled: false, workspacePath: activeWorkspace, newWindow: false };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('workspace:open', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '打开 LingBuilder 解决方案',
      properties: ['openFile'],
      filters: [
        { name: 'LingBuilder LCPP 源码包', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1)] },
        { name: 'LingBuilder 解决方案', extensions: ['lbsln'] },
        { name: '兼容的工作区入口', extensions: ['lingbuilder', 'lbworkspace', 'sln'] }
      ]
    };
    options.filters = [
      { name: 'LingBuilder 工作区文件', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1), 'lbsln', 'lingbuilder', 'lbworkspace', 'sln', 'code-workspace', 'lcpp', 'e'] },
      { name: '所有文件', extensions: ['*'] }
    ];
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      await switchWorkspace(await workspaceService.resolveWorkspaceTarget(result.filePaths[0]));
      return { ok: true, canceled: false, workspacePath: activeWorkspace };
    } catch (error) {
      return { ok: false, canceled: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
  ipcMain.handle('workspace:open-new-window', async () => {
    const owner = getFocusedWindow();
    const options: Electron.OpenDialogOptions = {
      title: '在新窗口打开 LingBuilder 解决方案',
      properties: ['openFile'],
      filters: [
        { name: 'LingBuilder LCPP 源码包', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1)] },
        { name: 'LingBuilder 解决方案', extensions: ['lbsln'] },
        { name: '兼容的工作区入口', extensions: ['lingbuilder', 'lbworkspace', 'sln'] }
      ]
    };
    options.filters = [
      { name: 'LingBuilder 工作区文件', extensions: [LCPP_SOURCE_PACKAGE_EXTENSION.slice(1), 'lbsln', 'lingbuilder', 'lbworkspace', 'sln', 'code-workspace', 'lcpp', 'e'] },
      { name: '所有文件', extensions: ['*'] }
    ];
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const workspacePath = await workspaceService.resolveWorkspaceTarget(result.filePaths[0]);
    launchWorkspaceWindow(workspacePath);
    return { ok: true, canceled: false, workspacePath, newWindow: true };
  });
}

function launchWorkspaceWindow(workspacePath: string): void {
  const launch = buildWorkspaceWindowLaunch({
    packaged: app.isPackaged,
    executablePath: process.execPath,
    mainEntryPath: path.join(repoRoot(), 'electron', 'dist-electron', 'main.cjs'),
    workspacePath
  });
  const child = spawn(launch.command, launch.args, { detached: true, stdio: 'ignore', env: { ...process.env } });
  child.unref();
}

function intersects(area: Electron.Rectangle, bounds: { x: number; y: number; width: number; height: number }): boolean {
  return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x
    && bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
}

/** 进程级崩溃/电源事件取证 + 60 秒内存采样，全部只写诊断日志不打扰用户。 */
function attachAppDiagnosticListeners(): void {
  app.on('child-process-gone', (_event, details) => {
    logDiagnostic('error', 'app', `子进程意外退出：类型 ${details.type}，原因 ${details.reason}，退出码 ${details.exitCode}，名称 ${details.name || '未知'}。`);
  });
  powerMonitor.on('suspend', () => logDiagnostic('info', 'power', '系统进入挂起/休眠。'));
  powerMonitor.on('resume', () => logDiagnostic('info', 'power', '系统从挂起/休眠恢复。'));
  powerMonitor.on('unlock-screen', () => logDiagnostic('info', 'power', '屏幕解锁。'));
  setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed() || !diagnosticLog) return;
    try {
      const parts = app.getAppMetrics().slice(0, 10).map(metric => `${metric.type}=${Math.round(metric.memory.workingSetSize / 1024)}MB`);
      diagnosticLog.info('memory', `进程内存：${parts.join(' ')}`);
    } catch {
      // 采样失败静默跳过。
    }
  }, 60_000);
  process.on('uncaughtException', error => {
    logDiagnostic('error', 'main-process', `主进程未捕获异常：${(error instanceof Error ? error.stack || error.message : String(error)).slice(0, 500)}`);
    console.error(error);
  });
  process.on('unhandledRejection', reason => {
    logDiagnostic('error', 'main-process', `主进程未处理的 Promise 拒绝：${String(reason instanceof Error ? reason.stack || reason.message : reason).slice(0, 500)}`);
  });
}

if (process.platform === 'win32') app.setAppUserModelId('cn.lingbuilder.ide');

// 录制/多实例隔离：设置 LINGBUILDER_REC_USER_DATA 后使用独立 userData，
// 与安装版互不抢占单实例锁，也不共享设置与最近工作区（见 录制/env.mjs）。
if (process.env.LINGBUILDER_REC_USER_DATA) {
  app.setPath('userData', process.env.LINGBUILDER_REC_USER_DATA);
}

const singleInstanceLock = app.requestSingleInstanceLock();
// 构建身份：本进程启动时的构建（asar 内 dist/build-meta.json）。second-instance 到来时
// 重读磁盘比对，不一致（升级或同版本重装）即自愈重启——否则单实例委托会让用户双击
// 新包图标却永远落在旧实例的旧渲染层（2026-09-20 修复）。
const runningBuildMeta = readBuildMetaFile(resolveBuildMetaPath(__dirname));
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // 构建自愈优先于工作区/文件委托：安装目录已不是本进程的构建时，旧实例自动让位。
    const diskBuildMeta = readBuildMetaFile(resolveBuildMetaPath(__dirname));
    if (diskBuildDiffersFromRunning(diskBuildMeta, runningBuildMeta)) {
      const markerPath = path.join(app.getPath('userData'), 'build-self-heal-marker.json');
      void fs.writeFile(markerPath, JSON.stringify({
        from: runningBuildMeta,
        to: diskBuildMeta,
        at: new Date().toISOString()
      }, null, 2) + '\n', 'utf8').catch(() => undefined);
      app.relaunch();
      app.exit(0);
      return;
    }
    const modulePath = findLbmodArgument(argv);
    if (modulePath) {
      void importModulePackage(modulePath).then(result => {
        if (result.ok && result.relativePath) {
          if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(MODULE_INSTALL_EVENT, { packagePath: result.relativePath });
          else pendingModulePackagePath = result.relativePath;
        } else if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(MODULE_INSTALL_EVENT, { packagePath: '', error: result.error });
      });
    }
    // IDE 已经开着时再双击 .lcpppkg：导入并切到新工作区，而不是只把窗口拉到前面。
    const packagePath = findLcppSourcePackageArgument(argv);
    if (packagePath && workspaceService) {
      void workspaceService.resolveWorkspaceTarget(packagePath)
        .then(workspacePath => switchWorkspace(workspacePath))
        .catch(error => {
          // 渲染端没有这条通道的监听器，失败必须用系统对话框告诉用户，不能静默吞掉。
          const reason = error instanceof Error ? error.message : String(error);
          dialog.showErrorBox('打开 LCPP 源码包失败', [packagePath, '', reason].join('\n'));
        });
    }
    // IDE 已经开着时再双击 .lbsln / .lcpp 等工作区类关联文件：与冷启动走同一套
    // resolveWorkspaceTarget 口径切换工作区；没有这个分支时双击只会触发下面的 focus。
    const workspaceFilePath = findWorkspaceFileArgument(argv);
    if (workspaceFilePath && workspaceService) {
      void workspaceService.resolveWorkspaceTarget(workspaceFilePath)
        .then(workspacePath => switchWorkspace(workspacePath))
        .catch(error => {
          const reason = error instanceof Error ? error.message : String(error);
          dialog.showErrorBox('打开工作区失败', [workspaceFilePath, '', reason].join('\n'));
        });
    }
    if (mainWindow && !mainWindow.isDestroyed()) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  });
}

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  diagnosticLog = new DiagnosticLogService(getDiagnosticLogDirectory());
  logDiagnostic('info', 'app', `LingBuilder ${app.getVersion()} 启动（${process.platform} ${process.arch}，${app.isPackaged ? '安装版' : '开发版'}）。`);
  attachAppDiagnosticListeners();
  void updateDownloadService.cleanupAbandoned();
  const smokeDocumentsPath = process.argv.includes('--smoke-test')
    ? getArgumentValue(process.argv, '--smoke-documents-dir')
    : undefined;
  const startupModulePath = findLbmodArgument(process.argv);
  const workspaceArgv = startupModulePath ? process.argv.filter(argument => argument !== startupModulePath) : process.argv;
  workspaceService = new DesktopWorkspaceService({
    argv: workspaceArgv,
    documentsPath: smokeDocumentsPath || app.getPath('documents'),
    userDataPath: app.getPath('userData'),
    defaultWorkspaceSource: defaultWorkspaceSource(),
    bundledProtobufSdkSource: bundledProtobufSdkSource(),
    seedVersion: app.getVersion(),
    profile: app.isPackaged ? 'packaged' : 'development'
  });
  activeWorkspace = await workspaceService.resolveInitialWorkspace(
    app.isPackaged ? undefined : (process.env.LINGBUILDER_WORKSPACE_ROOT || repoRoot())
  );
  // 双击 .lcpppkg 会在这里完成导入并把新工作区设为当前工作区；这条路径不经过
  // switchWorkspace，所以要在这里记下来，否则渲染端仍会停在欢迎页。
  startupOpenedAssociatedWorkspace = workspaceService.lastInitialWorkspaceSource === 'associated-file';
  if (startupModulePath) {
    const imported = await importModulePackage(startupModulePath);
    pendingModulePackagePath = imported.ok ? imported.relativePath : undefined;
  }
  aiBridgeManager = new AiBridgeManagerService({
    runtimeExecutable: process.execPath,
    cliEntryPath: cliEntryPath(),
    environment: {
      ...process.env,
      // Bridge 子进程据此在 health / workspace.list / MCP serverInfo 上回报 IDE 版本。
      LINGBUILDER_IDE_VERSION: app.getVersion(),
      LINGBUILDER_SDK_CACHE_ROOT: path.join(app.getPath('userData'), 'sdk-cache')
    }
  });
  aiBridgeManager.setFbroVipKey((await resolveFbroVipCredential()).value);
  aiBridgeManager.subscribe(snapshot => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-bridge:status-changed', snapshot);
  });
  // 面板内嵌 Agent 运行时（DeepSeek Harness）：只作为规划/工具循环引擎，
  // 写盘与构建由面板在用户确认提案后经 AiBridgeService 代执行。
  const providerLoaded = await readAgentProviderSettings(resolveAgentProviderSettingsPath(app.getPath('userData')), safeStorage);
  agentProviderCache = providerLoaded.settings;
  agentProviderKeyUnavailable = providerLoaded.keyUnavailable;
  agentRuntime = new AgentRuntimeService({
    bridgeCommand: process.execPath,
    cliEntryPath: cliEntryPath(),
    profileDirectory: path.join(app.getPath('userData'), 'agent-runtime'),
    environment: { ...process.env, LINGBUILDER_IDE_VERSION: app.getVersion() },
    providerSettings: () => agentProviderCache
  });
  agentRuntime.subscribe(snapshot => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('agent-runtime:status-changed', snapshot);
  });
  agentRuntime.onEvent(payload => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('agent-runtime:event', payload);
  });
  // 外部 AI 授权开关是持久化设置，IDE 启动即按上次选择恢复监听状态。
  await syncLocalAuthorizationService();

  const managedDevelopmentServer = !app.isPackaged && process.argv.includes('--managed-dev-server');
  if (app.isPackaged || managedDevelopmentServer) {
    const ready = await startManagedRendererServer(activeWorkspace);
    rendererOrigin = ready.origin;
    configureRendererSession(rendererOrigin, rendererSessionToken);
  } else {
    rendererOrigin = DEV_SERVER_URL;
    configureRendererSession(rendererOrigin, rendererSessionToken);
  }

  await cloudAccountService.initialize().catch(error => console.warn(`系统 AI 账号恢复失败：${error instanceof Error ? error.message : String(error)}`));
  const cloudSession = await cloudAccountService.snapshot();
  await restoreModulePermits({
    readCache: readModulePermitCache,
    writeCache: writeModulePermitCache,
    requestRendererApi,
    refreshAuthorization: cloudSession.authenticated
      ? moduleId => cloudAccountService.modulePermit(moduleId)
      : undefined,
    log: (level, message) => level === 'warn'
      ? console.warn(`[module-access] ${message}`)
      : console.info(`[module-access] ${message}`)
  });
  registerIpcHandlers();
  moduleInfoWindow = new ModuleInfoWindowService({
    preloadPath: path.join(__dirname, 'preload.cjs'),
    rendererOrigin: () => rendererOrigin,
    userDataPath: app.getPath('userData'),
    iconPath: !app.isPackaged && process.platform === 'win32' ? path.join(repoRoot(), 'image', 'lingbuilder-ide-icon-v1.ico') : undefined
  });
  await createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow();
  });
}).catch(async error => {
  logDiagnostic('error', 'app', `启动失败：${error instanceof Error ? error.stack || error.message : String(error)}`);
  dialog.showErrorBox('LingBuilder 启动失败', error instanceof Error ? error.message : String(error));
  await shutdownAndExit(1);
});

app.on('before-quit', event => {
  if (shutdownPromise) return;
  event.preventDefault();
  void shutdownAndExit(0);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
