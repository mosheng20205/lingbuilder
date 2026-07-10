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
      };
      shell?: {
        openPath: (targetPath: string) => Promise<string>;
      };
      workspace?: {
        getCurrent: () => Promise<string>;
        open: () => Promise<{
          ok: boolean;
          canceled: boolean;
          workspacePath?: string;
          error?: string;
        }>;
      };
      docs?: {
        openModuleManual: () => Promise<string>;
      };
    };
  }
}
