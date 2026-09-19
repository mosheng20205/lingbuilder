/**
 * LingBuilder 点数充值对话框服务。
 *
 * 充值套餐、下单、二维码与到账轮询只允许这一份实现：AI 助手面板与标题栏账号菜单
 * 都调用 requestCloudAccountRecharge()，不得各自维护一份套餐状态。
 * 到账后由对话框写入 cloudAccountSessionStore，调用方只需 await 结果刷新自身视图。
 */

export interface CloudAccountRechargeResult {
  paid: boolean;
  cancelled?: boolean;
}

export interface CloudAccountRechargeRequest {
  id: number;
  resolve: (result: CloudAccountRechargeResult) => void;
}

type Listener = (request: CloudAccountRechargeRequest | null) => void;

const listeners = new Set<Listener>();
let activeRequest: CloudAccountRechargeRequest | null = null;
let nextRequestId = 0;

function publish(request: CloudAccountRechargeRequest | null): void {
  for (const listener of [...listeners]) listener(request);
}

/** 弹出充值对话框；到账并确认后返回 paid=true，关闭返回 cancelled=true。 */
export function requestCloudAccountRecharge(): Promise<CloudAccountRechargeResult> {
  return new Promise(resolve => {
    if (activeRequest) {
      const displaced = activeRequest;
      activeRequest = null;
      displaced.resolve({ paid: false, cancelled: true });
    }
    const request: CloudAccountRechargeRequest = { id: ++nextRequestId, resolve };
    activeRequest = request;
    publish(request);
  });
}

export function settleCloudAccountRechargeDialog(result: CloudAccountRechargeResult): void {
  if (!activeRequest) return;
  const request = activeRequest;
  activeRequest = null;
  request.resolve(result);
  publish(null);
}

export function subscribeCloudAccountRechargeDialog(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveCloudAccountRechargeDialog(): CloudAccountRechargeRequest | null {
  return activeRequest;
}
