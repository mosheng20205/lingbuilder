export {};

type LingBuilderAiBridgePermission = 'readonly' | 'preview' | 'yolo';
type LingBuilderAiBridgeLifecycle = 'workspace' | 'ide';
/** 本机授权代理状态：外部 AI 客户端的 stdio 宿主凭据换取通道。 */
type LingBuilderLocalAuthorizationSnapshot = {
  enabled: boolean;
  running: boolean;
  port: number;
  discoveryPath: string;
  exchanges: number;
  lastError: string;
};
type LingBuilderAiBridgeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
/** 灵码 Skill 正文取物状态：remote=官网最新版，cache=本机已校验缓存，bundled=安装包内置快照。 */
type LingBuilderSkillKitStatus = {
  ok: boolean;
  source: 'remote' | 'cache' | 'bundled';
  id: string;
  version: string;
  sequence: number;
  minIdeVersion: string;
  entrypointPath: string;
  installPrompt: string;
  fileCount: number;
  checkedAt: string;
  problem: string;
};
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
  /** 仅 ai-bridge:start 返回：启动成功但设置未能持久化时的中文原因。 */
  settingsError?: string;
}

/** 面板内嵌 Agent 运行时（DeepSeek Harness）状态：只驱动规划与工具循环，不直接写盘。 */
interface LingBuilderAgentRuntimeSnapshot {
  state: 'stopped' | 'starting' | 'running' | 'busy' | 'stopping' | 'failed';
  workspaceRoot: string;
  nodePath: string;
  nodeVersion: string;
  dshBinPath: string;
  pid: number | null;
  sessionId: string;
  provider: string;
  model: string;
  maskedToolRows: number;
  problem: string;
  logs: string[];
  lastTurnEvents: number;
}

interface LingBuilderAgentProviderSettings {
  kind: 'deepseek-official' | 'custom-openai';
  /** 主进程永不下发已保存的密钥，读到的恒为空串；留空表示沿用已保存的那份。 */
  apiKey: string;
  baseUrl: string;
  model: string;
  protocol?: 'messages' | 'chat-completions';
}

interface LingBuilderAgentProviderView {
  ok: boolean;
  settings?: LingBuilderAgentProviderSettings;
  hasApiKey?: boolean;
  keyUnavailable?: boolean;
  problem?: string;
  error?: string;
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
      logs?: {
        /** 在系统文件管理器中打开诊断日志目录；'' 表示成功。 */
        reveal: () => Promise<string>;
        export: () => Promise<{ ok: boolean; canceled?: boolean; filePath?: string; error?: string }>;
        delete: () => Promise<{ ok: boolean; canceled?: boolean; deleted?: number; error?: string }>;
        report: (entry: { level?: 'info' | 'warn' | 'error'; category?: string; message: string }) => void;
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
        loadStartSettings: () => Promise<{
          settings: {
            port: number;
            permission: LingBuilderAiBridgePermission;
            lifecycle: LingBuilderAiBridgeLifecycle;
            token: string;
            externalModuleAccess: boolean;
          } | null;
          localAuthorization: LingBuilderLocalAuthorizationSnapshot | null;
        } | null>;
        saveStartSettings: (settings: {
          port: number;
          permission: LingBuilderAiBridgePermission;
          lifecycle: LingBuilderAiBridgeLifecycle;
          token: string;
          externalModuleAccess?: boolean;
        }) => Promise<{
          ok: boolean;
          error?: string;
          localAuthorization?: LingBuilderLocalAuthorizationSnapshot | null;
        }>;
        localAuthStatus?: () => Promise<LingBuilderLocalAuthorizationSnapshot | null>;
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
      agentRuntime?: {
        status: () => Promise<LingBuilderAgentRuntimeSnapshot>;
        start: (request: {
          provider?: string;
          model?: string;
          maxTokens?: number;
          reasoningEffort?: string;
        }) => Promise<{ ok: boolean; snapshot?: LingBuilderAgentRuntimeSnapshot; error?: string }>;
        prompt: (request: { prompt: string; sessionId?: string }) => Promise<{
          ok: boolean;
          sessionId?: string;
          finalText?: string;
          events?: Array<Record<string, unknown>>;
          error?: string;
        }>;
        stop: () => Promise<{ ok: boolean; snapshot?: LingBuilderAgentRuntimeSnapshot; error?: string }>;
        getProviderSettings: () => Promise<LingBuilderAgentProviderView>;
        setProviderSettings: (settings: LingBuilderAgentProviderSettings) => Promise<LingBuilderAgentProviderView>;
        restart: () => Promise<{ ok: boolean; snapshot?: LingBuilderAgentRuntimeSnapshot; error?: string }>;
        probeProvider: (request: {
          action: 'models' | 'connect';
          kind: LingBuilderAgentProviderSettings['kind'];
          baseUrl?: string;
          model?: string;
          apiKey?: string;
          protocol?: LingBuilderAgentProviderSettings['protocol'];
        }) => Promise<{ ok: boolean; result?: unknown; error?: string }>;
        onStatusChanged: (listener: (snapshot: LingBuilderAgentRuntimeSnapshot) => void) => () => void;
        onEvent: (listener: (payload: { sessionId: string; event: Record<string, unknown> }) => void) => () => void;
      };
      skillKit?: {
        status: () => Promise<LingBuilderSkillKitStatus | null>;
        checkUpdate: () => Promise<LingBuilderSkillKitStatus | null>;
      };
      modules?: {
        importPackage: (sourcePath: string) => Promise<{ ok: boolean; relativePath?: string; error?: string }>;
        selectPackage: () => Promise<{ ok: boolean; canceled: boolean; relativePath?: string; error?: string }>;
        getDroppedFilePath: (file: File) => string;
        onInstallRequest: (listener: (request: { packagePath: string; error?: string }) => void) => () => void;
        openInfo: (module: unknown) => Promise<void>;
        onInfo: (listener: (module: unknown) => void) => () => void;
        listDemos: () => Promise<{ ok: boolean; moduleIds?: string[]; error?: string }>;
        openDemo: (moduleId: string) => Promise<{ ok: boolean; workspacePath?: string; error?: string }>;
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
      solutionImport?: {
        pickProject: () => Promise<{ ok: boolean; canceled: boolean; filePath?: string; error?: string }>;
        pickSourceDirectory: () => Promise<{ ok: boolean; canceled: boolean; filePath?: string; error?: string }>;
        copyExternalProject: (projectFilePath: string) => Promise<{ ok: boolean; projectFileRelative?: string; targetDir?: string; error?: string }>;
      };
      designerAssets?: {
        selectImage: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectGif: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectAnimation: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectVideo: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectIcon: () => Promise<{ canceled: boolean; filePath?: string }>;
        selectEmbeddedFiles: () => Promise<{ canceled: boolean; filePaths?: string[]; error?: string }>;
        selectEmbeddedFolder: () => Promise<{ canceled: boolean; directoryPath?: string; error?: string }>;
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
        forgotPassword: (value: { email: string }) => Promise<{ ok: boolean }>;
        resetPassword: (value: { token: string; password: string }) => Promise<{ ok: boolean }>;
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
        check: (payload?: { channel?: 'stable' | 'preview' }) => Promise<{ ok: boolean; currentVersion: string; latestVersion?: string; releaseTitle?: string; hasUpdate: boolean; websiteUrl: string; downloadUrl?: string | null; sha256?: string | null; fileSize?: string | null; releaseNotes?: string | null; channel?: string | null; error?: string }>;
        download: () => Promise<{ ok: boolean; alreadyRunning?: boolean; alreadyDownloaded?: boolean; error?: string }>;
        cancel: () => Promise<{ ok: boolean }>;
        status: () => Promise<AppUpdateProgressSnapshot | null>;
        install: () => Promise<{ ok: boolean; error?: string }>;
        onProgress: (listener: (progress: AppUpdateProgressSnapshot) => void) => () => void;
      };
      betaProgram?: {
        status: () => Promise<{ ok: boolean; authenticated?: boolean; enrolled: boolean; status?: string | null; validUntil?: string | null; previewSuspended: boolean; application: { status: string; rejectReason: string; updatedAt?: string } | null }>;
        apply: (message?: string) => Promise<{ ok: boolean; application?: { status: string } ; error?: string }>;
        cancelApplication: () => Promise<{ ok: boolean; error?: string }>;
      };
      payments?: {
        openPage: (url: string) => Promise<string>;
      };
    };
  }
}
