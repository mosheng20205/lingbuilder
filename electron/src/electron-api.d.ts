export {};

type LingBuilderAiBridgePermission = 'readonly' | 'preview' | 'yolo';
type LingBuilderAiBridgeLifecycle = 'workspace' | 'ide';
type LingBuilderAiBridgeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
type LingBuilderExternalAiClientId = 'codex' | 'claude' | 'gemini' | 'generic';

interface AppUpdateProgressSnapshot {
  state: 'idle' | 'downloading' | 'verifying' | 'ready' | 'launching' | 'error';
  version?: string;
  downloadedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number | null;
  engine: 'aria2c' | 'fetch' | null;
  message?: string;
  error?: string;
  installerPath?: string;
}

interface LingBuilderCodexDesktopStatus {
  state: 'not-installed' | 'not-configured' | 'configured' | 'restart-required' | 'repair-required' | 'conflict' | 'error';
  installed: boolean;
  running: boolean;
  label: string;
  packageFullName: string;
  appUserModelId: string;
  executable: string;
  startedAt: string | null;
  detail: string;
  configured: boolean;
  configPath: string;
  workspaceRoot: string;
  permission: LingBuilderAiBridgePermission;
  restartRequired: boolean;
  managed: boolean;
}

interface LingBuilderAiBridgeSnapshot {
  state: LingBuilderAiBridgeState;
  workspaceRoot: string;
  permission: LingBuilderAiBridgePermission;
  lifecycle: LingBuilderAiBridgeLifecycle;
  host: '127.0.0.1';
  port: number;
  httpUrl: string;
  mcpUrl: string;
  startedAt: string | null;
  pid: number | null;
  tokenMasked: string;
  tokenAvailable: boolean;
  activeClients: number;
  clients: Array<{ id: string; connectedAt: string; lastActiveAt: string; userAgent: string }>;
  recentActivity: Array<{ id: string; timestamp: string; clientId: string; kind: 'connected' | 'disconnected' | 'tool'; tool?: string; ok: boolean; durationMs?: number; message: string }>;
  logs: string[];
  error: string;
}

declare global {
  interface Window {
    lingBuilder?: {
      runtime: 'electron';
      platform: NodeJS.Platform;
      startup?: {
        shouldShowWelcome: () => Promise<boolean>;
      };
      windowControls?: {
        minimize: () => Promise<void>;
        toggleMaximize: () => Promise<boolean>;
        isMaximized: () => Promise<boolean>;
        close: () => Promise<void>;
        confirmClose: () => Promise<void>;
        onCloseRequested: (listener: () => void) => () => void;
      };
      shell?: {
        openPath: (targetPath: string) => Promise<string>;
        revealWorkspacePath: (targetPath: string) => Promise<string>;
        openWorkspacePath: (relativePath?: string) => Promise<string>;
        copyFullPath: (target: { kind: 'solution'; solutionName: string } | { kind: 'project'; relativePath: string }) => Promise<{
          ok: boolean;
          path?: string;
          error?: string;
        }>;
      };
      community?: {
        openQQGroup: () => Promise<string>;
      };
      workspace?: {
        getCurrent: () => Promise<string>;
        open: () => Promise<{
          ok: boolean;
          canceled: boolean;
          workspacePath?: string;
          error?: string;
        }>;
        openNewWindow: () => Promise<{ ok: boolean; canceled: boolean; workspacePath?: string; error?: string; newWindow?: boolean }>;
        openPath: (targetPath: string, newWindow?: boolean) => Promise<{ ok: boolean; canceled: boolean; workspacePath?: string; error?: string; newWindow?: boolean }>;
        listRecent: () => Promise<string[]>;
        forgetRecent: (workspacePath: string) => Promise<void>;
        closeCurrent: () => Promise<{ ok: boolean; workspacePath?: string; error?: string }>;
        onDidChange: (listener: (snapshot: { workspacePath: string; version?: number }) => void) => () => void;
      };
      docs?: {
        openModuleManual: () => Promise<string>;
        openCliManual: () => Promise<string>;
        openAiModuleGuide: () => Promise<string>;
        readAiModuleGuide: () => Promise<string>;
      };
      cli?: {
        inspect: () => Promise<{
          supported: boolean;
          packaged: boolean;
          state: 'ready' | 'path-missing' | 'launcher-missing' | 'check-failed' | 'development';
          launcherPath: string;
          launcherExists: boolean;
          pathConfigured: boolean;
          commandAvailable: boolean;
          version: string | null;
          detail: string;
        }>;
      };
      aiBridge?: {
        status: () => Promise<LingBuilderAiBridgeSnapshot>;
        start: (request: {
          port: number;
          permission: LingBuilderAiBridgePermission;
          lifecycle: LingBuilderAiBridgeLifecycle;
          token?: string;
          approvedYolo?: boolean;
        }) => Promise<LingBuilderAiBridgeSnapshot>;
        stop: () => Promise<LingBuilderAiBridgeSnapshot>;
        rotateToken: () => Promise<LingBuilderAiBridgeSnapshot>;
        revealToken: () => Promise<string>;
        clients: () => Promise<Array<{
          id: LingBuilderExternalAiClientId;
          label: string;
          installed: boolean;
          executable: string;
          detail: string;
        }>>;
        codexDesktopStatus: (permission?: LingBuilderAiBridgePermission) => Promise<LingBuilderCodexDesktopStatus>;
        configureCodexDesktop: (request: {
          permission: LingBuilderAiBridgePermission;
          replaceExisting?: boolean;
          openApp?: boolean;
          approvedYolo?: boolean;
        }) => Promise<LingBuilderCodexDesktopStatus>;
        removeCodexDesktop: () => Promise<LingBuilderCodexDesktopStatus>;
        openCodexDesktop: () => Promise<LingBuilderCodexDesktopStatus>;
        launchClient: (clientId: LingBuilderExternalAiClientId) => Promise<{ ok: boolean; sessionId: string; detail: string }>;
        onStatusChanged: (listener: (snapshot: LingBuilderAiBridgeSnapshot) => void) => () => void;
      };
      modules?: {
        importPackage: (sourcePath: string) => Promise<{ ok: boolean; relativePath?: string; error?: string }>;
        selectPackage: () => Promise<{ ok: boolean; canceled: boolean; relativePath?: string; error?: string }>;
        getDroppedFilePath: (file: File) => string;
        onInstallRequest: (listener: (request: { packagePath: string; error?: string }) => void) => () => void;
        openInfo: (module: unknown) => Promise<void>;
        onInfo: (listener: (module: unknown) => void) => () => void;
      };
      sourcePackages?: {
        exportProject: (projectId: string, suggestedName?: string) => Promise<{
          ok: boolean;
          canceled: boolean;
          packagePath?: string;
          fileCount?: number;
          totalBytes?: number;
          lcppFileCount?: number;
          warnings?: string[];
          error?: string;
        }>;
        open: () => Promise<{ ok: boolean; canceled: boolean; workspacePath?: string; error?: string }>;
      };
      designerAssets?: {
        selectImage: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectGif: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectAnimation: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectVideo: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectIcon: () => Promise<{ canceled: boolean; filePath?: string }>;
      };
      credentials?: {
        getAiApiKey: () => Promise<string>;
        setAiApiKey: (value: string) => Promise<void>;
        deleteAiApiKey: () => Promise<void>;
        getFbroVipKeyStatus: () => Promise<{ configured: boolean; source: 'secure-storage' | 'environment' | 'none' }>;
        setFbroVipKey: (value: string) => Promise<{ configured: boolean; source: 'secure-storage' | 'environment' | 'none' }>;
        deleteFbroVipKey: () => Promise<{ configured: boolean; source: 'secure-storage' | 'environment' | 'none' }>;
      };
      cloudAccount?: {
        register: (value: { email: string; password: string }) => Promise<{ ok: boolean; verificationRequired: boolean }>;
        verifyEmail: (token: string) => Promise<{ ok: boolean }>;
        login: (value: { email: string; password: string }) => Promise<{ authenticated: boolean; email?: string; balance?: { available: string; reserved: string } }>;
        logout: () => Promise<{ ok: boolean }>;
        session: () => Promise<{ authenticated: boolean; email?: string; balance?: { available: string; reserved: string }; error?: string }>;
        models: () => Promise<{ ok: boolean; models: Array<{ alias: string; displayName: string; description: string; maxOutputTokens: number }> }>;
        balance: () => Promise<{ ok: boolean; balance: { available: string; reserved: string } }>;
        moduleCatalog: () => Promise<{ ok: boolean; products: Array<{ moduleId: string; productId: string; name: string; description: string; listed: boolean; enabled: boolean; offers: Array<{ id: string; name: string; kind: 'perpetual'|'fixed_term'; priceMinor: string; currency: 'CNY'; durationDays?: number }>; freeWindow?: { startsAt: string; endsAt: string; timezone: string }; access?: { allowed: boolean; source?: string; expiresAt?: string; reason?: string } }> }>;
        moduleEntitlements: () => Promise<{ ok: boolean; entitlements: Array<{ id: string; moduleId: string; source: string; startsAt: string; endsAt?: string; revokedAt?: string }> }>;
        authorizeModule: (moduleId: string) => Promise<{ ok: boolean; error?: string; code?: string; status?: { moduleId: string; paid: boolean; allowed: boolean; source?: string; expiresAt?: string; reason?: string } }>;
        createModuleOrder: (value: { offerId: string; provider: 'wechat'|'alipay'; idempotencyKey: string }) => Promise<{ ok: boolean; order: { id: string; moduleId: string; status: string; paymentUrl?: string; expiresAt: string } }>;
        rechargePackages: () => Promise<{ ok: boolean; packages: Array<{ id: string; name: string; points: string; amountMinor: string; currency: string }> }>;
        createRechargeOrder: (value: { packageId: string; provider: 'wechat'|'alipay'; idempotencyKey: string }) => Promise<{ ok: boolean; order: { id: string; status: string; points: string; packageName: string; paymentUrl?: string; paymentForm?: string | null; expiresAt: string } }>;
        rechargeOrder: (orderId: string) => Promise<{ ok: boolean; order: { id: string; status: string; points: string; packageName: string; paymentUrl?: string; paidAt?: string; expiresAt: string } }>;
        downloadModule: (value: { moduleId: string; arch?: 'win32'|'x64'|'any' }) => Promise<{ ok: boolean; relativePath: string; artifact: { id: string; moduleId: string; version: string; arch: string; sha256: string } }>;
      };
      cloudAi?: {
        start: (kind: 'chat' | 'edit', payload: unknown) => Promise<string>;
        cancel: (requestKey: string) => Promise<boolean>;
        onEvent: (listener: (requestKey: string, event: any) => void) => () => void;
      };
      updates?: {
        check: () => Promise<{ ok: boolean; currentVersion: string; latestVersion?: string; releaseTitle?: string; hasUpdate: boolean; websiteUrl: string; downloadUrl?: string | null; sha256?: string | null; fileSize?: string | null; releaseNotes?: string | null; channel?: string | null; error?: string }>;
        download: () => Promise<{ ok: boolean; alreadyRunning?: boolean; alreadyDownloaded?: boolean; error?: string }>;
        cancel: () => Promise<{ ok: boolean }>;
        status: () => Promise<AppUpdateProgressSnapshot | null>;
        install: () => Promise<{ ok: boolean; error?: string }>;
        onProgress: (listener: (progress: AppUpdateProgressSnapshot) => void) => () => void;
      };
      payments?: {
        openPage: (url: string) => Promise<string>;
      };
    };
  }
}
