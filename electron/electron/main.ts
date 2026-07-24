import {
  app,
  BrowserWindow,
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
import path from 'node:path';
import { spawn } from 'node:child_process';
import { buildWorkspaceWindowLaunch, DesktopWorkspaceService, getArgumentValue, resolveWorkspaceDropTarget } from './workspaceService';
import { CloudAccountService } from './cloudAccountService';

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
let isQuitting = false;
let shutdownPromise: Promise<void> | null = null;
let workspaceService: DesktopWorkspaceService;
const rendererConfirmedClose = new WeakSet<BrowserWindow>();

function getFocusedWindow() {
  return BrowserWindow.getFocusedWindow() || mainWindow;
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

function credentialPath(): string { return path.join(app.getPath('userData'), 'credentials', 'ai-api-key.bin'); }
async function readAiCredential(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; const encrypted = await fs.readFile(credentialPath()); return safeStorage.decryptString(encrypted); } catch { return ''; } }
async function writeAiCredential(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全凭据存储。'); const file = credentialPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
function cloudRefreshPath(): string { return path.join(app.getPath('userData'), 'credentials', 'cloud-refresh-token.bin'); }
async function readCloudRefresh(): Promise<string> { try { if (!safeStorage.isEncryptionAvailable()) return ''; return safeStorage.decryptString(await fs.readFile(cloudRefreshPath())); } catch { return ''; } }
async function writeCloudRefresh(value: string): Promise<void> { if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统不支持安全账号凭据存储。'); const file = cloudRefreshPath(); await fs.mkdir(path.dirname(file), { recursive: true }); if (!value) { await fs.rm(file, { force: true }); return; } const temporary = `${file}.${crypto.randomUUID()}.tmp`; await fs.writeFile(temporary, safeStorage.encryptString(value)); await fs.rename(temporary, file); }
const cloudAccountService = new CloudAccountService(process.env.LINGBUILDER_CLOUD_API_URL || 'http://127.0.0.1:17900', readCloudRefresh, writeCloudRefresh);

async function startPackagedRendererServer(workspaceRoot: string): Promise<ServerReadyInfo> {
  await stopRendererServer();
  rendererSessionToken = crypto.randomBytes(32).toString('hex');

  const child = utilityProcess.fork(serverEntryPath(), [], {
    cwd: workspaceRoot,
    serviceName: 'LingBuilder Local Service',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      LINGBUILDER_WORKSPACE_ROOT: workspaceRoot,
      LINGBUILDER_USER_SETTINGS_PATH: path.join(app.getPath('userData'), 'settings.json'),
      LINGBUILDER_STATIC_ROOT: rendererStaticRoot(),
      LINGBUILDER_RULEBOOK_PATH: rulebookPath(),
      LINGBUILDER_SESSION_TOKEN: rendererSessionToken,
      LINGBUILDER_DEV_NO_AUTH: 'false',
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false',
      LINGBUILDER_SERVER_AUTOSTART: 'true'
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

async function createMainWindow(): Promise<void> {
  const smokeTest = process.argv.includes('--smoke-test');
  const savedWindowState = await workspaceService.getWindowState();
  const usableBounds = savedWindowState && screen.getAllDisplays().some(display => intersects(display.workArea, savedWindowState))
    ? savedWindowState
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

  await mainWindow.loadURL(rendererOrigin);
  if (!app.isPackaged && process.env.LINGBUILDER_OPEN_DEVTOOLS === 'true') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  if (smokeTest) await runPackagedSmokeTest(mainWindow);
}

async function runPackagedSmokeTest(window: BrowserWindow): Promise<void> {
  const resultPath = getArgumentValue(process.argv, '--smoke-result');
  try {
    const rendererResult = await window.webContents.executeJavaScript(`(async () => {
      const healthResponse = await fetch('/api/health');
      const modulesResponse = await fetch('/api/modules/installed?projectId=lingbuilder-ui-project');
      const aiResponse = await fetch('/api/lingcpp/edit/propose', {
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
      const bridgeResponse = await fetch('/api/ai-bridge/health');
      const terminalCreateResponse = await fetch('/api/terminal/sessions', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ profile: 'cmd', cols: 80, rows: 24 })
      });
      const terminalCreate = await terminalCreateResponse.json();
      let terminalSnapshot = null;
      let terminalResizeStatus = 0;
      let terminalCloseStatus = 0;
      if (terminalCreateResponse.ok && terminalCreate.session?.id) {
        await fetch('/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id) + '/input', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ data: 'echo LINGBUILDER_PACKAGED_PTY_OK\\r' })
        });
        for (let attempt = 0; attempt < 120; attempt += 1) {
          const list = await (await fetch('/api/terminal/sessions')).json();
          terminalSnapshot = list.sessions?.find(session => session.id === terminalCreate.session.id) || null;
          if (terminalSnapshot?.buffer?.includes('LINGBUILDER_PACKAGED_PTY_OK')) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        terminalResizeStatus = (await fetch('/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id) + '/resize', {
          method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cols: 100, rows: 30 })
        })).status;
        terminalCloseStatus = (await fetch('/api/terminal/sessions/' + encodeURIComponent(terminalCreate.session.id), { method: 'DELETE' })).status;
      }
      const health = await healthResponse.json();
      const modules = await modulesResponse.json();
      const ai = await aiResponse.json();
      return {
        ok: healthResponse.ok
          && modulesResponse.ok
          && aiResponse.ok
          && bridgeResponse.status === 404
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

async function switchWorkspace(workspacePath: string): Promise<void> {
  if (!app.isPackaged) throw new Error('开发模式切换工作区后请重新运行 npm run dev。');
  const candidateWorkspace = await workspaceService.validateWorkspace(workspacePath);
  const previousWorkspace = activeWorkspace;
  try {
    const ready = await startPackagedRendererServer(candidateWorkspace);
    rendererOrigin = ready.origin;
    configureRendererSession(rendererOrigin, rendererSessionToken);
    await mainWindow?.loadURL(rendererOrigin);
    activeWorkspace = await workspaceService.rememberWorkspace(candidateWorkspace);
  } catch (error) {
    let restoreError: unknown;
    try {
      const restored = await startPackagedRendererServer(previousWorkspace);
      rendererOrigin = restored.origin;
      configureRendererSession(rendererOrigin, rendererSessionToken);
      await mainWindow?.loadURL(rendererOrigin);
      activeWorkspace = previousWorkspace;
    } catch (caught) {
      restoreError = caught;
    }
    const primaryMessage = error instanceof Error ? error.message : String(error);
    if (restoreError) {
      throw new Error(`${primaryMessage}；恢复原工作区也失败：${restoreError instanceof Error ? restoreError.message : String(restoreError)}`);
    }
    throw error;
  }
}

function registerIpcHandlers(): void {
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
  ipcMain.handle('shell:open-workspace-path', async (_event, relativePath = '.') => {
    if (!activeWorkspace) return '当前没有已打开的工作区。';
    const workspaceRoot = path.resolve(activeWorkspace);
    const targetPath = path.resolve(workspaceRoot, relativePath || '.');
    const relativeTarget = path.relative(workspaceRoot, targetPath);
    if (relativeTarget.startsWith('..') || path.isAbsolute(relativeTarget)) return '目标目录超出当前工作区。';
    return await shell.openPath(targetPath);
  });
  ipcMain.handle('docs:open-module-manual', async () => shell.openPath(moduleManualPath()));
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
  ipcMain.handle('cloud-account:register', (_event, value: any) => cloudAccountService.register(String(value?.email || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:verify-email', (_event, token: string) => cloudAccountService.verifyEmail(String(token || '')));
  ipcMain.handle('cloud-account:login', (_event, value: any) => cloudAccountService.login(String(value?.email || ''), String(value?.password || '')));
  ipcMain.handle('cloud-account:logout', () => cloudAccountService.logout());
  ipcMain.handle('cloud-account:session', () => cloudAccountService.snapshot());
  ipcMain.handle('cloud-account:models', () => cloudAccountService.models());
  ipcMain.handle('cloud-account:balance', () => cloudAccountService.balance());
  ipcMain.handle('cloud-ai:start', async (event, kind: 'chat'|'edit', payload: unknown) => cloudAccountService.startAi(kind, payload, (requestKey, streamEvent) => event.sender.send('cloud-ai:event', requestKey, streamEvent)));
  ipcMain.handle('cloud-ai:cancel', (_event, requestKey: string) => cloudAccountService.cancel(requestKey));
  ipcMain.handle('workspace:get-current', () => activeWorkspace);
  ipcMain.handle('workspace:list-recent', () => workspaceService.listRecentWorkspaces());
  ipcMain.handle('workspace:forget-recent', (_event, workspacePath: string) => workspaceService.forgetWorkspace(workspacePath));
  ipcMain.handle('workspace:open-path', async (_event, targetPath: string, newWindow = false) => {
    try {
      const workspacePath = await resolveWorkspaceDropTarget(targetPath);
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
        { name: 'LingBuilder 解决方案', extensions: ['lbsln'] },
        { name: '兼容的工作区入口', extensions: ['lingbuilder', 'lbworkspace', 'sln'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    try {
      await switchWorkspace(await resolveWorkspaceDropTarget(result.filePaths[0]));
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
        { name: 'LingBuilder 解决方案', extensions: ['lbsln'] },
        { name: '兼容的工作区入口', extensions: ['lingbuilder', 'lbworkspace', 'sln'] }
      ]
    };
    const result = owner
      ? await dialog.showOpenDialog(owner, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const workspacePath = await resolveWorkspaceDropTarget(result.filePaths[0]);
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
    seedVersion: app.getVersion()
  });
  activeWorkspace = await workspaceService.resolveInitialWorkspace(
    app.isPackaged ? undefined : (process.env.LINGBUILDER_WORKSPACE_ROOT || repoRoot())
  );

  if (app.isPackaged) {
    const ready = await startPackagedRendererServer(activeWorkspace);
    rendererOrigin = ready.origin;
    configureRendererSession(rendererOrigin, rendererSessionToken);
  } else {
    rendererOrigin = DEV_SERVER_URL;
    configureRendererSession(rendererOrigin, rendererSessionToken);
  }

  await cloudAccountService.initialize().catch(error => console.warn(`系统 AI 账号恢复失败：${error instanceof Error ? error.message : String(error)}`));
  registerIpcHandlers();
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
