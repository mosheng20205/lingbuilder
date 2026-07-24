export {};

declare global {
  interface Window {
    lingBuilder?: {
      runtime: 'electron';
      platform: NodeJS.Platform;
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
        openWorkspacePath: (relativePath?: string) => Promise<string>;
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
      };
      docs?: {
        openModuleManual: () => Promise<string>;
      };
      modules?: {
        importPackage: (sourcePath: string) => Promise<{ ok: boolean; relativePath?: string; error?: string }>;
      };
      designerAssets?: {
        selectImage: () => Promise<{ canceled: boolean; filePath?: string }>;
      };
      credentials?: {
        getAiApiKey: () => Promise<string>;
        setAiApiKey: (value: string) => Promise<void>;
        deleteAiApiKey: () => Promise<void>;
      };
      cloudAccount?: {
        register: (value: { email: string; password: string }) => Promise<{ ok: boolean; verificationRequired: boolean }>;
        verifyEmail: (token: string) => Promise<{ ok: boolean }>;
        login: (value: { email: string; password: string }) => Promise<{ authenticated: boolean; email?: string; balance?: { available: string; reserved: string } }>;
        logout: () => Promise<{ ok: boolean }>;
        session: () => Promise<{ authenticated: boolean; email?: string; balance?: { available: string; reserved: string }; error?: string }>;
        models: () => Promise<{ ok: boolean; models: Array<{ alias: string; displayName: string; description: string; maxOutputTokens: number }> }>;
        balance: () => Promise<{ ok: boolean; balance: { available: string; reserved: string } }>;
      };
      cloudAi?: {
        start: (kind: 'chat' | 'edit', payload: unknown) => Promise<string>;
        cancel: (requestKey: string) => Promise<boolean>;
        onEvent: (listener: (requestKey: string, event: any) => void) => () => void;
      };
    };
  }
}
