import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lingBuilder', {
  runtime: 'electron',
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    close: () => ipcRenderer.invoke('window:close'),
  },
  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke('shell:open-path', targetPath),
  },
  workspace: {
    getCurrent: () => ipcRenderer.invoke('workspace:get-current'),
    open: () => ipcRenderer.invoke('workspace:open'),
  },
  docs: {
    openModuleManual: () => ipcRenderer.invoke('docs:open-module-manual'),
  },
});
