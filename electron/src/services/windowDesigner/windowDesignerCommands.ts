export const WINDOW_DESIGNER_BUILD_RUN_REQUEST = 'window-designer:build-run-request';
export const WINDOW_DESIGNER_BUILD_RUN_STATE = 'window-designer:build-run-state';
export const WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST = 'window-designer:lingcpp-source-request';
export const WINDOW_DESIGNER_EPL_SOURCE_REQUEST = WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST;

export type WindowDesignerBuildRunStatus = 'started' | 'completed' | 'failed';

export interface WindowDesignerBuildRunStateDetail {
  status: WindowDesignerBuildRunStatus;
  ok?: boolean;
  stage?: string;
  message?: string;
}

export interface WindowDesignerLingCppSourceRequestDetail {
  activeWindowId?: string;
  windowFileName?: string;
  windowClassName?: string;
  respond: (sourceCode: string) => void;
}

export type WindowDesignerEplSourceRequestDetail = WindowDesignerLingCppSourceRequestDetail;

export function requestWindowDesignerBuildRun(): void {
  window.dispatchEvent(new CustomEvent(WINDOW_DESIGNER_BUILD_RUN_REQUEST));
}

export function notifyWindowDesignerBuildRunState(detail: WindowDesignerBuildRunStateDetail): void {
  window.dispatchEvent(new CustomEvent(WINDOW_DESIGNER_BUILD_RUN_STATE, { detail }));
}

export function requestWindowDesignerLingCppSource(
  activeWindowId?: string,
  windowFileName?: string,
  windowClassName?: string
): string {
  let sourceCode = '';
  window.dispatchEvent(new CustomEvent<WindowDesignerLingCppSourceRequestDetail>(WINDOW_DESIGNER_LINGCPP_SOURCE_REQUEST, {
    detail: {
      activeWindowId,
      windowFileName,
      windowClassName,
      respond: nextSourceCode => {
        sourceCode = nextSourceCode;
      }
    }
  }));
  return sourceCode;
}

export const requestWindowDesignerEplSource = requestWindowDesignerLingCppSource;
