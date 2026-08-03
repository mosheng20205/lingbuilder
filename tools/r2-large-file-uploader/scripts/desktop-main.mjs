import { access, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow, dialog, Menu, shell } from 'electron';

const productName = 'LingBuilder R2 大文件上传器';
app.setName(productName);
app.setAppUserModelId('com.lingbuilder.r2-uploader');

let mainWindow = null;
let serverModule = null;
let shutdownStarted = false;

function focusMainWindow() {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', focusMainWindow);
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function migrateLocalConfig(targetPath) {
  if (await fileExists(targetPath)) return;

  const candidates = [path.join(process.cwd(), 'r2-uploader.config.json')];
  if (process.env.PORTABLE_EXECUTABLE_DIR) {
    candidates.push(path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'r2-uploader.config.json'));
  }

  for (const candidate of candidates) {
    if (path.resolve(candidate) === path.resolve(targetPath) || !await fileExists(candidate)) continue;
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(candidate, targetPath);
    return;
  }
}

function openExternal(targetUrl) {
  try {
    const url = new URL(targetUrl);
    if (url.protocol === 'http:' || url.protocol === 'https:') void shell.openExternal(url.toString());
  } catch {
    // Ignore malformed external navigation requests.
  }
}

function createMainWindow(localUrl) {
  const localOrigin = new URL(localUrl).origin;
  mainWindow = new BrowserWindow({
    title: productName,
    width: 1060,
    height: 860,
    minWidth: 720,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f4f6f7',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    try {
      if (new URL(targetUrl).origin === localOrigin) return;
    } catch {
      // Invalid navigation is blocked below.
    }
    event.preventDefault();
    openExternal(targetUrl);
  });
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  mainWindow.on('closed', () => { mainWindow = null; });
  void mainWindow.loadURL(localUrl);
}

async function startDesktopClient() {
  const configPath = path.join(app.getPath('userData'), 'r2-uploader.config.json');
  await migrateLocalConfig(configPath);
  process.env.R2_UPLOADER_CONFIG_PATH = configPath;
  process.env.R2_UPLOADER_PORT ||= '0';

  serverModule = await import('./local-server.mjs');
  const { url } = await serverModule.serverReady;
  Menu.setApplicationMenu(null);
  createMainWindow(url);
}

app.whenReady().then(startDesktopClient).catch(error => {
  dialog.showErrorBox(productName, error instanceof Error ? error.message : String(error));
  app.quit();
});

app.on('activate', () => {
  if (mainWindow) focusMainWindow();
});

app.on('window-all-closed', () => app.quit());

app.on('before-quit', event => {
  if (!serverModule || shutdownStarted) return;
  event.preventDefault();
  shutdownStarted = true;
  serverModule.shutdown()
    .catch(() => undefined)
    .finally(() => app.quit());
});
