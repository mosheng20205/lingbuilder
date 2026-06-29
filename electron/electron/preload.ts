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
});
