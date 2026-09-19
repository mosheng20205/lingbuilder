/**
 * LingBuilder 账号对话框服务（登录 / 注册 / 找回密码唯一入口）。
 *
 * 任何需要账号的地方——标题栏入口、欢迎页、设置页、收费模块门禁、AI 助手面板——
 * 都必须调用本服务，不得另写内联登录或注册表单；注册表单历史上只存在于 AI 面板
 * 二级折叠里，导致用户在其它界面看到「请先登录」却找不到入口。
 *
 * 与 workbenchConfirmService 相同：同一时刻只保留一个挂起请求，新请求把旧请求按
 * 取消结算；对话框 UI 由 App.tsx 顶层挂载并结算。
 */

export interface CloudAccountLoginResult {
  authenticated: boolean;
  email?: string;
  cancelled?: boolean;
}

export interface CloudAccountLoginOptions {
  title?: string;
  /** 登录原因说明，例如“启用「new_emoji 界面库」需要先登录 LingBuilder 账号。” */
  description?: string;
  /** 打开时的形态：默认登录；'register' 直接注册；'reset' 走两步密码重置。 */
  initialMode?: 'login' | 'register' | 'reset';
}

export interface CloudAccountLoginRequest extends CloudAccountLoginOptions {
  id: number;
  resolve: (result: CloudAccountLoginResult) => void;
}

type CloudAccountLoginListener = (request: CloudAccountLoginRequest | null) => void;

const listeners = new Set<CloudAccountLoginListener>();
let activeRequest: CloudAccountLoginRequest | null = null;
let nextRequestId = 0;

function publish(request: CloudAccountLoginRequest | null): void {
  for (const listener of listeners) listener(request);
}

/** 弹出登录对话框；用户完成登录返回 authenticated=true，关闭/取消返回 cancelled=true。 */
export function requestCloudAccountLogin(options: CloudAccountLoginOptions = {}): Promise<CloudAccountLoginResult> {
  return new Promise(resolve => {
    if (activeRequest) {
      const displaced = activeRequest;
      activeRequest = null;
      displaced.resolve({ authenticated: false, cancelled: true });
    }
    const request: CloudAccountLoginRequest = { id: ++nextRequestId, ...options, resolve };
    activeRequest = request;
    publish(request);
  });
}

/** 由对话框 UI 结算当前挂起请求。 */
export function settleCloudAccountLoginDialog(result: CloudAccountLoginResult): void {
  if (!activeRequest) return;
  const request = activeRequest;
  activeRequest = null;
  request.resolve(result);
  publish(null);
}

/** 把当前挂起请求按取消结算。 */
export function cancelCloudAccountLoginDialog(): void {
  settleCloudAccountLoginDialog({ authenticated: false, cancelled: true });
}

/** 订阅挂起请求变化；返回退订函数。App.tsx 顶层用它驱动对话框渲染。 */
export function subscribeCloudAccountLoginDialog(listener: CloudAccountLoginListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 读取当前挂起请求（供渲染层同步恢复状态，测试与诊断也可使用）。 */
export function getActiveCloudAccountLoginDialog(): CloudAccountLoginRequest | null {
  return activeRequest;
}
