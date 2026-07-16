import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lingBuilder', {
  runtime: 'electron',
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    close: () => ipcRenderer.invoke('window:close'),
    confirmClose: () => ipcRenderer.invoke('window:confirm-close'),
    onCloseRequested: (listener: () => void) => {
      const handler = () => listener();
      ipcRenderer.on('window:close-requested', handler);
      return () => ipcRenderer.removeListener('window:close-requested', handler);
    },
  },
  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke('shell:open-path', targetPath),
    openWorkspacePath: (relativePath = '.') => ipcRenderer.invoke('shell:open-workspace-path', relativePath),
  },
  workspace: {
    getCurrent: () => ipcRenderer.invoke('workspace:get-current'),
    open: () => ipcRenderer.invoke('workspace:open'),
    openNewWindow: () => ipcRenderer.invoke('workspace:open-new-window'),
    openPath: (targetPath: string, newWindow = false) => ipcRenderer.invoke('workspace:open-path', targetPath, newWindow),
    listRecent: () => ipcRenderer.invoke('workspace:list-recent'),
    forgetRecent: (workspacePath: string) => ipcRenderer.invoke('workspace:forget-recent', workspacePath),
  },
  docs: {
    openModuleManual: () => ipcRenderer.invoke('docs:open-module-manual'),
  },
  credentials: {
    getAiApiKey: () => ipcRenderer.invoke('credentials:ai:get'),
    setAiApiKey: (value: string) => ipcRenderer.invoke('credentials:ai:set', value),
    deleteAiApiKey: () => ipcRenderer.invoke('credentials:ai:delete'),
  },
  cloudAccount: {
    register: (value: { email: string; password: string }) => ipcRenderer.invoke('cloud-account:register', value),
    verifyEmail: (token: string) => ipcRenderer.invoke('cloud-account:verify-email', token),
    login: (value: { email: string; password: string }) => ipcRenderer.invoke('cloud-account:login', value),
    logout: () => ipcRenderer.invoke('cloud-account:logout'),
    session: () => ipcRenderer.invoke('cloud-account:session'),
    models: () => ipcRenderer.invoke('cloud-account:models'),
    balance: () => ipcRenderer.invoke('cloud-account:balance'),
  },
  cloudAi: {
    start: (kind: 'chat' | 'edit', payload: unknown) => ipcRenderer.invoke('cloud-ai:start', kind, payload),
    cancel: (requestKey: string) => ipcRenderer.invoke('cloud-ai:cancel', requestKey),
    onEvent: (listener: (requestKey: string, event: any) => void) => { const handler = (_event: unknown, requestKey: string, streamEvent: any) => listener(requestKey, streamEvent); ipcRenderer.on('cloud-ai:event', handler); return () => ipcRenderer.removeListener('cloud-ai:event', handler); },
  },
});
