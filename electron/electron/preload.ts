import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('lingBuilder', {
  runtime: 'electron',
  platform: process.platform,
  startup: {
    shouldShowWelcome: () => ipcRenderer.invoke('startup:should-show-welcome'),
  },
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
    revealWorkspacePath: (targetPath: string) => ipcRenderer.invoke('shell:reveal-workspace-path', targetPath),
    openWorkspacePath: (relativePath = '.') => ipcRenderer.invoke('shell:open-workspace-path', relativePath),
    copyFullPath: (target: { kind: 'solution'; solutionName: string } | { kind: 'project'; relativePath: string }) => ipcRenderer.invoke('shell:copy-full-path', target),
  },
  community: {
    openQQGroup: () => ipcRenderer.invoke('community:open-qq-group'),
  },
  logs: {
    reveal: () => ipcRenderer.invoke('logs:reveal'),
    export: () => ipcRenderer.invoke('logs:export'),
    delete: () => ipcRenderer.invoke('logs:delete'),
    report: (entry: { level?: 'info' | 'warn' | 'error'; category?: string; message: string }) => ipcRenderer.send('diagnostic:report', entry),
  },
  workspace: {
    getCurrent: () => ipcRenderer.invoke('workspace:get-current'),
    open: () => ipcRenderer.invoke('workspace:open'),
    openNewWindow: () => ipcRenderer.invoke('workspace:open-new-window'),
    openPath: (targetPath: string, newWindow = false) => ipcRenderer.invoke('workspace:open-path', targetPath, newWindow),
    listRecent: () => ipcRenderer.invoke('workspace:list-recent'),
    forgetRecent: (workspacePath: string) => ipcRenderer.invoke('workspace:forget-recent', workspacePath),
    closeCurrent: () => ipcRenderer.invoke('workspace:close-current'),
    onDidChange: (listener: (snapshot: { workspacePath: string; version?: number }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: { workspacePath: string; version?: number }) => listener(snapshot);
      ipcRenderer.on('workspace:changed', handler);
      return () => ipcRenderer.removeListener('workspace:changed', handler);
    },
  },
  docs: {
    openModuleManual: () => ipcRenderer.invoke('docs:open-module-manual'),
    openCliManual: () => ipcRenderer.invoke('docs:open-cli-manual'),
    openAiModuleGuide: () => ipcRenderer.invoke('docs:open-ai-module-guide'),
    readAiModuleGuide: () => ipcRenderer.invoke('docs:read-ai-module-guide'),
  },
  cli: {
    inspect: () => ipcRenderer.invoke('cli:inspect'),
  },
  aiBridge: {
    status: () => ipcRenderer.invoke('ai-bridge:status'),
    start: (request: unknown) => ipcRenderer.invoke('ai-bridge:start', request),
    loadStartSettings: () => ipcRenderer.invoke('ai-bridge:start-settings:load'),
    saveStartSettings: (settings: unknown) => ipcRenderer.invoke('ai-bridge:start-settings:save', settings),
    localAuthStatus: () => ipcRenderer.invoke('ai-bridge:local-auth-status'),
    stop: () => ipcRenderer.invoke('ai-bridge:stop'),
    rotateToken: () => ipcRenderer.invoke('ai-bridge:rotate-token'),
    revealToken: () => ipcRenderer.invoke('ai-bridge:reveal-token'),
    clients: () => ipcRenderer.invoke('ai-bridge:clients'),
    codexDesktopStatus: (permission?: string) => ipcRenderer.invoke('ai-bridge:codex-desktop-status', permission),
    configureCodexDesktop: (request: unknown) => ipcRenderer.invoke('ai-bridge:configure-codex-desktop', request),
    removeCodexDesktop: () => ipcRenderer.invoke('ai-bridge:remove-codex-desktop'),
    openCodexDesktop: () => ipcRenderer.invoke('ai-bridge:open-codex-desktop'),
    launchClient: (clientId: string) => ipcRenderer.invoke('ai-bridge:launch-client', clientId),
    onStatusChanged: (listener: (snapshot: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, snapshot: unknown) => listener(snapshot);
      ipcRenderer.on('ai-bridge:status-changed', handler);
      return () => ipcRenderer.removeListener('ai-bridge:status-changed', handler);
    },
  },
  skillKit: {
    status: () => ipcRenderer.invoke('skill-kit:status'),
    checkUpdate: () => ipcRenderer.invoke('skill-kit:check-update'),
  },
  modules: {
    importPackage: (sourcePath: string) => ipcRenderer.invoke('modules:import-package', sourcePath),
    selectPackage: () => ipcRenderer.invoke('modules:select-package'),
    getDroppedFilePath: (file: File) => {
      try { return webUtils.getPathForFile(file); } catch { return ''; }
    },
    onInstallRequest: (listener: (request: { packagePath: string; error?: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, request: { packagePath: string; error?: string }) => listener(request);
      ipcRenderer.on('lingbuilder:install-module-package', handler);
      return () => ipcRenderer.removeListener('lingbuilder:install-module-package', handler);
    },
    openInfo: (module: unknown) => ipcRenderer.invoke('modules:open-info', module),
    onInfo: (listener: (module: unknown) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, module: unknown) => listener(module);
      ipcRenderer.on('module-info:set', handler);
      return () => ipcRenderer.removeListener('module-info:set', handler);
    },
  },
  sourcePackages: {
    exportProject: (projectId: string, suggestedName?: string) => ipcRenderer.invoke('source-packages:export-project', projectId, suggestedName),
    open: () => ipcRenderer.invoke('source-packages:open'),
  },
  solutionImport: {
    pickProject: () => ipcRenderer.invoke('solution-import:pick-project'),
    pickSourceDirectory: () => ipcRenderer.invoke('solution-import:pick-source-directory'),
    copyExternalProject: (projectFilePath: string) => ipcRenderer.invoke('solution-import:copy-external-project', projectFilePath),
  },
  designerAssets: {
    selectImage: () => ipcRenderer.invoke('designer-assets:select-image'),
    selectGif: () => ipcRenderer.invoke('designer-assets:select-gif'),
    selectAnimation: () => ipcRenderer.invoke('designer-assets:select-animation'),
    selectVideo: () => ipcRenderer.invoke('designer-assets:select-video'),
    selectIcon: () => ipcRenderer.invoke('designer-assets:select-icon'),
    selectEmbeddedFiles: () => ipcRenderer.invoke('designer-assets:select-embedded-files'),
    selectEmbeddedFolder: () => ipcRenderer.invoke('designer-assets:select-embedded-folder'),
  },
  credentials: {
    getAiApiKey: () => ipcRenderer.invoke('credentials:ai:get'),
    setAiApiKey: (value: string) => ipcRenderer.invoke('credentials:ai:set', value),
    deleteAiApiKey: () => ipcRenderer.invoke('credentials:ai:delete'),
    getFbroVipKeyStatus: () => ipcRenderer.invoke('credentials:fbro-vip:status'),
    setFbroVipKey: (value: string) => ipcRenderer.invoke('credentials:fbro-vip:set', value),
    deleteFbroVipKey: () => ipcRenderer.invoke('credentials:fbro-vip:delete'),
  },
  cloudAccount: {
    register: (value: { email: string; password: string }) => ipcRenderer.invoke('cloud-account:register', value),
    verifyEmail: (token: string) => ipcRenderer.invoke('cloud-account:verify-email', token),
    forgotPassword: (value: { email: string }) => ipcRenderer.invoke('cloud-account:forgot-password', value),
    resetPassword: (value: { token: string; password: string }) => ipcRenderer.invoke('cloud-account:reset-password', value),
    login: (value: { email: string; password: string }) => ipcRenderer.invoke('cloud-account:login', value),
    logout: () => ipcRenderer.invoke('cloud-account:logout'),
    session: () => ipcRenderer.invoke('cloud-account:session'),
    models: () => ipcRenderer.invoke('cloud-account:models'),
    balance: () => ipcRenderer.invoke('cloud-account:balance'),
    moduleCatalog: () => ipcRenderer.invoke('cloud-modules:catalog'),
    moduleEntitlements: () => ipcRenderer.invoke('cloud-modules:entitlements'),
    authorizeModule: (moduleId: string) => ipcRenderer.invoke('cloud-modules:authorize', moduleId),
    createModuleOrder: (value: { offerId: string; provider: 'wechat'|'alipay'; idempotencyKey: string }) => ipcRenderer.invoke('cloud-modules:create-order', value),
    rechargePackages: () => ipcRenderer.invoke('cloud-credits:packages'),
    createRechargeOrder: (value: { packageId: string; provider: 'wechat'|'alipay'; idempotencyKey: string }) => ipcRenderer.invoke('cloud-credits:create-order', value),
    rechargeOrder: (orderId: string) => ipcRenderer.invoke('cloud-credits:order', orderId),
    downloadModule: (value: { moduleId: string; arch?: 'win32'|'x64'|'any' }) => ipcRenderer.invoke('cloud-modules:download', value),
  },
  updates: {
    check: (payload?: { channel?: 'stable' | 'preview' }) => ipcRenderer.invoke('app:check-update', payload),
    download: () => ipcRenderer.invoke('app:update:download'),
    cancel: () => ipcRenderer.invoke('app:update:cancel'),
    status: () => ipcRenderer.invoke('app:update:status'),
    install: () => ipcRenderer.invoke('app:update:install'),
    onProgress: (listener: (progress: unknown) => void) => {
      const handler = (_event: unknown, progress: unknown) => listener(progress);
      ipcRenderer.on('app-update:progress', handler);
      return () => ipcRenderer.removeListener('app-update:progress', handler);
    },
  },
  betaProgram: {
    status: () => ipcRenderer.invoke('beta-program:entitlement'),
    apply: (message?: string) => ipcRenderer.invoke('beta-program:apply', message),
    cancelApplication: () => ipcRenderer.invoke('beta-program:cancel-application'),
  },
  payments: {
    openPage: (url: string) => ipcRenderer.invoke('payments:open-page', url),
  },
  cloudAi: {
    start: (kind: 'chat' | 'edit', payload: unknown) => ipcRenderer.invoke('cloud-ai:start', kind, payload),
    cancel: (requestKey: string) => ipcRenderer.invoke('cloud-ai:cancel', requestKey),
    onEvent: (listener: (requestKey: string, event: any) => void) => { const handler = (_event: unknown, requestKey: string, streamEvent: any) => listener(requestKey, streamEvent); ipcRenderer.on('cloud-ai:event', handler); return () => ipcRenderer.removeListener('cloud-ai:event', handler); },
  },
});
