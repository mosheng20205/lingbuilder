/**
 * 工作台内非阻塞对话框服务。
 *
 * 原生 window.confirm/alert/prompt 会同步阻塞渲染进程主线程：等待用户答复期间，
 * 整个工作台（包括其他已打开的 React 对话框与全部输入事件）都无法响应。
 * 该服务把确认、提示与输入请求统一建模为可订阅的挂起请求，由工作台顶层的
 * WorkbenchConfirmDialog 渲染并结算，调用方以 await 获得结果，主线程保持畅通。
 *
 * 同一时刻只保留一个挂起请求：新请求会把旧请求按取消结算（confirm→false、
 * prompt→null、alert→直接完成），避免对话框堆叠导致语义混乱。
 */

export type WorkbenchDialogKind = 'confirm' | 'alert' | 'prompt';

export interface WorkbenchDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 仅 prompt：输入框标签。 */
  inputLabel?: string;
  /** 仅 prompt：输入框初始值。 */
  inputValue?: string;
  /** 仅 prompt：输入框占位提示。 */
  inputPlaceholder?: string;
}

export interface WorkbenchDialogRequest extends WorkbenchDialogOptions {
  id: number;
  kind: WorkbenchDialogKind;
  /** confirm→boolean；alert→void；prompt→string|null。 */
  resolve: (value: boolean | string | null | undefined) => void;
}

type WorkbenchDialogListener = (request: WorkbenchDialogRequest | null) => void;

const listeners = new Set<WorkbenchDialogListener>();
let activeRequest: WorkbenchDialogRequest | null = null;
let nextRequestId = 0;

function publish(request: WorkbenchDialogRequest | null): void {
  for (const listener of listeners) listener(request);
}

function dispatchRequest(kind: WorkbenchDialogKind, options: WorkbenchDialogOptions): Promise<boolean | string | null | undefined> {
  return new Promise(resolve => {
    // 同一时刻只保留一个挂起请求：旧请求按取消语义立即结算。
    if (activeRequest) {
      const displaced = activeRequest;
      activeRequest = null;
      displaced.resolve(displaced.kind === 'confirm' ? false : displaced.kind === 'prompt' ? null : undefined);
    }
    const request: WorkbenchDialogRequest = {
      id: ++nextRequestId,
      kind,
      ...options,
      resolve
    };
    activeRequest = request;
    publish(request);
  });
}

/** 两按钮确认：返回 true 表示用户选择确认。 */
export function requestWorkbenchConfirm(options: WorkbenchDialogOptions): Promise<boolean> {
  return dispatchRequest('confirm', options) as unknown as Promise<boolean>;
}

/** 单按钮提示：用户点击“确定”后完成。 */
export function requestWorkbenchAlert(options: WorkbenchDialogOptions): Promise<void> {
  return dispatchRequest('alert', options) as unknown as Promise<void>;
}

/** 输入对话框：返回用户输入文本；取消时返回 null。 */
export function requestWorkbenchPrompt(options: WorkbenchDialogOptions): Promise<string | null> {
  return dispatchRequest('prompt', options) as unknown as Promise<string | null>;
}

/** 由对话框 UI 结算当前挂起请求：confirm 传 boolean，prompt 传文本或 null，alert 传 true。 */
export function settleWorkbenchDialog(result: boolean | string | null): void {
  if (!activeRequest) return;
  const request = activeRequest;
  activeRequest = null;
  // alert 是纯提示，统一归一化为 undefined，避免外部把按钮结果当成有意义值消费。
  request.resolve(request.kind === 'alert' ? undefined : result);
  publish(null);
}

/** 把当前挂起请求按取消结算（confirm→false、prompt→null、alert→直接完成）。 */
export function cancelWorkbenchDialog(): void {
  if (!activeRequest) return;
  const request = activeRequest;
  activeRequest = null;
  request.resolve(request.kind === 'confirm' ? false : request.kind === 'prompt' ? null : undefined);
  publish(null);
}

/** 订阅挂起请求变化；返回退订函数。工作台顶层用它驱动对话框渲染。 */
export function subscribeWorkbenchDialog(listener: WorkbenchDialogListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前挂起请求（供渲染层同步恢复状态，测试与诊断也可使用）。 */
export function getActiveWorkbenchDialog(): WorkbenchDialogRequest | null {
  return activeRequest;
}
