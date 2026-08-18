import { BrowserWindow, screen } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

export type ModuleInfoSnapshot = Record<string, unknown> & { manifest?: { id?: unknown; name?: unknown } };

export class ModuleInfoWindowService {
  private window: BrowserWindow | null = null;
  private current: ModuleInfoSnapshot | null = null;
  private readonly statePath: string;

  constructor(private readonly options: { preloadPath: string; rendererOrigin: () => string; userDataPath: string; iconPath?: string }) {
    this.statePath = path.join(options.userDataPath, 'module-info-window.json');
  }

  async open(module: ModuleInfoSnapshot): Promise<void> {
    const id = String(module.manifest?.id || '').trim();
    if (!id) throw new Error('模块信息窗口缺少有效模块 ID。');
    this.current = module;
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('module-info:set', module);
      this.window.show();
      this.window.focus();
      return;
    }
    const bounds = await this.readBounds();
    const workArea = screen.getPrimaryDisplay().workAreaSize;
    const defaultWidth = Math.max(900, Math.min(1500, Math.round(workArea.width * 0.82)));
    const defaultHeight = Math.max(620, Math.min(1000, Math.round(workArea.height * 0.82)));
    this.window = new BrowserWindow({
      width: bounds?.width || defaultWidth, height: bounds?.height || defaultHeight,
      ...(bounds ? { x: bounds.x, y: bounds.y } : {}), minWidth: 720, minHeight: 520,
      title: '模块信息', show: false, autoHideMenuBar: true,
      ...(this.options.iconPath ? { icon: this.options.iconPath } : {}),
      webPreferences: { preload: this.options.preloadPath, contextIsolation: true, nodeIntegration: false, sandbox: false }
    });
    const window = this.window;
    window.on('closed', () => { void this.saveBounds(window); this.window = null; this.current = null; });
    window.on('resize', () => { void this.saveBounds(window); });
    window.on('move', () => { void this.saveBounds(window); });
    window.once('ready-to-show', () => { if (bounds?.maximized) window.maximize(); window.show(); window.focus(); });
    await window.loadURL(`${this.options.rendererOrigin()}?module-info-window=1`);
    window.webContents.send('module-info:set', module);
  }

  refresh(module: ModuleInfoSnapshot): void {
    this.current = module;
    if (this.window && !this.window.isDestroyed()) this.window.webContents.send('module-info:set', module);
  }

  close(): void { if (this.window && !this.window.isDestroyed()) this.window.close(); }

  private async readBounds(): Promise<(Electron.Rectangle & { maximized?: boolean }) | null> {
    try {
      const value = JSON.parse(await fs.readFile(this.statePath, 'utf8')) as Electron.Rectangle & { maximized?: boolean };
      return screen.getAllDisplays().some(display => display.workArea.x < value.x + value.width && display.workArea.x + display.workArea.width > value.x)
        ? value : null;
    } catch { return null; }
  }

  private async saveBounds(window: BrowserWindow): Promise<void> {
    if (window.isDestroyed()) return;
    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(this.statePath, JSON.stringify({ ...window.getNormalBounds(), maximized: window.isMaximized() }), 'utf8');
    } catch { /* best effort */ }
  }
}
