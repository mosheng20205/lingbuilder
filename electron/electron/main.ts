import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
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
import { buildWorkspaceWindowLaunch, DesktopWorkspaceService, getArgumentValue } from './workspaceService';
import { CloudAccountService } from './cloudAccountService';
import { checkLatestVersion } from './versionCheckService';
import { inspectCliIntegration } from './cliIntegrationService';
import { AiBridgeManagerService, type ManagedAiBridgePermission, type ManagedAiBridgeLifecycle } from './aiBridgeManagerService';
import { createExternalAiLaunchPlan, detectExternalAiClients, type ExternalAiClientId } from './aiClientIntegrationService';
import { CodexDesktopIntegrationService } from './codexDesktopIntegrationService';
import { openPathWithExplorerFallback, selectShellWorkspaceRoot } from './shellPathService';
import { restoreModulePermits } from './modulePermitRestoreService';
import { ModuleInfoWindowService } from './moduleInfoWindowService';
import {
  createLcppSourcePackageService,
  LCPP_SOURCE_PACKAGE_EXTENSION,
  resolveProjectSourcePackagePath
} from './lcppSourcePackageService';

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
let isQuitting = false;
let shutdownPromise: Promise<void> | null = null;
let workspaceService: DesktopWorkspaceService;
let aiBridgeManager: AiBridgeManagerService;
let moduleInfoWindow: ModuleInfoWindowService;
const rendererConfirmedClose = new WeakSet<BrowserWindow>();

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

function rulebookPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', 'LingBuilder AI 规则手册.md')
    : path.join(repoRoot(), 'LingBuilder AI 规则手册.md');
}

function moduleManualPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', '模块开发手册.md')
    : path.join(repoRoot(), '模块开发手册.md');
}

function cliManualPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'docs', 'AI_BRIDGE_CLI_USAGE.md')
    : path.join(repoRoot(), 'AI_BRIDGE_CLI_USAGE.md');
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

function credentialPath(): string { return path.join(app.getPath('userData'), 'credentials', 'ai-api-key.bin'); }
async function readAiCredential(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; const encrypted = await fs.readFile(credentialPath()); return safeStorage.decryptString(encrypted); } catch { return ''; } }
async function writeAiCredential(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全凭据存储。'); const file = credentialPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
const startupFbroVipKey = String(process.env.LINGBUILDER_FBRO_VIP_KEY || '').trim();
function fbroVipCredentialPath(): string { return path.join(app.getPath('userData'), 'credentials', 'fbro-vip-key.bin'); }
async function readFbroVipCredential(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; return safeStorage.decryptString(await fs.readFile(fbroVipCredentialPath())).trim(); } catch { return ''; } }
async function writeFbroVipCredential(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全凭据存储。'); const file = fbroVipCredentialPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
async function resolveFbroVipCredential(): Promise<{ value: string; source: 'secure-storage' | 'environment' | 'none' }> { const stored = await readFbroVipCredential(); if (stored) return { value: stored, source: 'secure-storage' }; if (startupFbroVipKey) return { value: startupFbroVipKey, source: 'environment' }; return { value: '', source: 'none' }; }
function publishFbroVipCredential(value: string): void { rendererServer?.postMessage({ type: 'lingbuilder:fbro-vip-key', value }); aiBridgeManager?.setFbroVipKey(value); }
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
      LINGBUILDER_SESSION_TOKEN: rendererSessionToken,
      LINGBUILDER_DEV_NO_AUTH: 'false',
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false',
      LINGBUILDER_SERVER_AUTOSTART: 'true',
      ...(fbroVipCredential.value ? { LINGBUILDER_FBRO_VIP_KEY: fbroVipCredential.value } : {})
    }
  });
  rendererServer = child;

  child.stderr?.on('data', chunk => {
    const message = String(chunk).trim();
    if (message) console.error(`[local-service] ${message}`);
  });
  child.on('exit', code => {
    if (rendererServer === child) rendererServer = null;
    if (!intentionallyStoppedServers.has(child) && !isQuitting) {
      console.error(`LingBuilder local service exited unexpectedly with code ${code}.`);
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
  shutdownPromise = (async () => {
    let exitCode = code;
    try {
      await aiBridgeManager?.stop('LingBuilder 正在退出');
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
  const result = await response.json().catch(() => ({})) as { error?: unknown };
  if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : `LingBuilder 本地服务请求失败：HTTP ${response.status}`);
  return result;
}

async function createMainWindow(): Promise<void> {
  showWelcomeOnNextRendererLoad = true;
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

  if (smokeTest) await writePackagedSmokeProgress('load-url:start');
  await mainWindow.loadURL(rendererOrigin);
  if (smokeTest) await writePackagedSmokeProgress('load-url:done');
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
  ipcMain.handle('app:check-update', () => checkLatestVersion(cloudApiOrigin(), app.getVersion()));
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
  ipcMain.handle('cli:inspect', async () => inspectInstalledCli());
  ipcMain.handle('ai-bridge:status', async () => await aiBridgeManager.refreshRuntime());
  ipcMain.handle('ai-bridge:start', async (_event, request: unknown) => {
    const value = request && typeof request === 'object' ? request as Record<string, unknown> : {};
    const permission = String(value.permission || 'preview') as ManagedAiBridgePermission;
    if (permission === 'yolo' && value.approvedYolo !== true) throw new Error('启用 yolo 前必须确认外部 AI 可自动写入并执行受控构建。');
    return await aiBridgeManager.start({
      workspaceRoot: getShellWorkspaceRoot(),
      port: typeof value.port === 'number' ? value.port : Number(value.port || 17860),
      permission,
      lifecycle: String(value.lifecycle || 'workspace') as ManagedAiBridgeLifecycle,
      token: typeof value.token === 'string' ? value.token : undefined,
      moduleAccessState: Buffer.from(JSON.stringify(await readModulePermitCache()), 'utf8').toString('base64url')
    });
  });
  ipcMain.handle('ai-bridge:stop', async () => await aiBridgeManager.stop('用户停止'));
  ipcMain.handle('ai-bridge:rotate-token', async () => await aiBridgeManager.rotateToken());
  ipcMain.handle('ai-bridge:reveal-token', async () => aiBridgeManager.revealToken());
  ipcMain.handle('ai-bridge:clients', async () => await detectExternalAiClients());
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
  ipcMain.handle('modules:open-info', async (_event, module: unknown) => {
    if (!module || typeof module !== 'object') throw new Error('模块信息无效。');
    await moduleInfoWindow.open(module as Record<string, unknown>);
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
  ipcMain.handle('credentials:ai:get', () => readAiCredential());
  ipcMain.handle('credentials:ai:set', (_event, value: string) => writeAiCredential(typeof value === 'string' ? value.slice(0, 16_384) : ''));
  ipcMain.handle('credentials:ai:delete', () => writeAiCredential(''));
  ipcMain.handle('credentials:fbro-vip:status', async () => { const credential = await resolveFbroVipCredential(); return { configured: Boolean(credential.value), source: credential.source }; });
  ipcMain.handle('credentials:fbro-vip:set', async (_event, value: string) => { const normalized = typeof value === 'string' ? value.trim() : ''; if (!normalized) throw new Error('FBro VIP Key 不能为空。'); if (normalized.length > 4096) throw new Error('FBro VIP Key 长度不能超过 4096 个字符。'); await writeFbroVipCredential(normalized); publishFbroVipCredential(normalized); return { configured: true, source: 'secure-storage' as const }; });
  ipcMain.handle('credentials:fbro-vip:delete', async () => { await writeFbroVipCredential(''); publishFbroVipCredential(startupFbroVipKey); return { configured: Boolean(startupFbroVipKey), source: startupFbroVipKey ? 'environment' as const : 'none' as const }; });
  ipcMain.handle('cloud-account:register', (_event, value: any) => cloudAccountService.register(String(value?.email || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:verify-email', (_event, token: string) => cloudAccountService.verifyEmail(String(token || '')));
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

if (process.platform === 'win32') app.setAppUserModelId('cn.lingbuilder.ide');

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const smokeDocumentsPath = process.argv.includes('--smoke-test')
    ? getArgumentValue(process.argv, '--smoke-documents-dir')
    : undefined;
  workspaceService = new DesktopWorkspaceService({
    argv: process.argv,
    documentsPath: smokeDocumentsPath || app.getPath('documents'),
    userDataPath: app.getPath('userData'),
    defaultWorkspaceSource: defaultWorkspaceSource(),
    seedVersion: app.getVersion(),
    profile: app.isPackaged ? 'packaged' : 'development'
  });
  activeWorkspace = await workspaceService.resolveInitialWorkspace(
    app.isPackaged ? undefined : (process.env.LINGBUILDER_WORKSPACE_ROOT || repoRoot())
  );
  aiBridgeManager = new AiBridgeManagerService({
    runtimeExecutable: process.execPath,
    cliEntryPath: cliEntryPath(),
    environment: {
      ...process.env,
      LINGBUILDER_SDK_CACHE_ROOT: path.join(app.getPath('userData'), 'sdk-cache')
    }
  });
  aiBridgeManager.setFbroVipKey((await resolveFbroVipCredential()).value);
  aiBridgeManager.subscribe(snapshot => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ai-bridge:status-changed', snapshot);
  });

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
