export const WINDOW_DESIGNER_BUILD_RUN_REQUEST = 'window-designer:build-run-request';
export const WINDOW_DESIGNER_BUILD_RUN_STATE = 'window-designer:build-run-state';
export const WINDOW_DESIGNER_EPL_SOURCE_REQUEST = 'window-designer:epl-source-request';

export type WindowDesignerBuildRunStatus = 'started' | 'completed' | 'failed';

export interface WindowDesignerBuildRunStateDetail {
  status: WindowDesignerBuildRunStatus;
  ok?: boolean;
  stage?: string;
  message?: string;
}

export interface WindowDesignerEplSourceRequestDetail {
  activeWindowId?: string;
  windowFileName?: string;
  respond: (sourceCode: string) => void;
}

export function requestWindowDesignerBuildRun(): void {
  window.dispatchEvent(new CustomEvent(WINDOW_DESIGNER_BUILD_RUN_REQUEST));
}

export function notifyWindowDesignerBuildRunState(detail: WindowDesignerBuildRunStateDetail): void {
  window.dispatchEvent(new CustomEvent(WINDOW_DESIGNER_BUILD_RUN_STATE, { detail }));
}

export function requestWindowDesignerEplSource(activeWindowId?: string, windowFileName?: string): string {
  let sourceCode = '';
  window.dispatchEvent(new CustomEvent<WindowDesignerEplSourceRequestDetail>(WINDOW_DESIGNER_EPL_SOURCE_REQUEST, {
    detail: {
      activeWindowId,
      windowFileName,
      respond: nextSourceCode => {
        sourceCode = nextSourceCode;
      }
    }
  }));
  return sourceCode;
}
