/**
 * LingBuilder 云端账号会话状态源。
 *
 * 标题栏账号入口、AI 助手面板、设置页和收费模块门禁必须消费同一份登录态，
 * 不得各自维护 cloudSession 副本——副本漂移是「已登录但界面仍显示未登录」的根因。
 * 首次订阅时惰性拉取一次，之后由登录/退出/充值等动作显式刷新。
 */

export interface CloudAccountSessionState {
  authenticated: boolean;
  email?: string;
  balance?: { available: string; reserved: string };
  loading: boolean;
  error?: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();

let state: CloudAccountSessionState = { authenticated: false, loading: false };
let hasLoaded = false;
let inFlight: Promise<CloudAccountSessionState> | null = null;

function publish(next: CloudAccountSessionState): CloudAccountSessionState {
  state = next;
  for (const listener of [...listeners]) listener();
  return state;
}

/** 服务端渲染与 node 测试里没有 window，取 IPC 面必须先判存在，不能直接解引用。 */
function cloudAccountApi() {
  return typeof window === 'undefined' ? undefined : window.lingBuilder?.cloudAccount;
}

export function getCloudAccountSessionState(): CloudAccountSessionState {
  return state;
}

/** 订阅会话变化；返回退订函数。首次订阅会自动触发一次拉取。 */
export function subscribeCloudAccountSession(listener: Listener): () => void {
  listeners.add(listener);
  if (!hasLoaded) void refreshCloudAccountSession();
  return () => {
    listeners.delete(listener);
  };
}

/** 读取云端会话与点数；同一时刻只保留一次在途请求。 */
export function refreshCloudAccountSession(): Promise<CloudAccountSessionState> {
  if (inFlight) return inFlight;
  const cloudAccount = cloudAccountApi();
  if (!cloudAccount) {
    // 非桌面环境（Web 预览、node 测试）不得沿用上一轮的伪登录态。
    return Promise.resolve(publish({
      authenticated: false,
      loading: false,
      error: '当前运行环境不支持 LingBuilder 账号，请使用 LingBuilder 桌面版。'
    }));
  }
  inFlight = (async () => {
    publish({ ...state, loading: true });
    try {
      const session = await cloudAccount.session();
      if (!session?.authenticated) {
        return publish({ authenticated: false, loading: false });
      }
      const balanceResult = await cloudAccount.balance().catch(() => null);
      return publish({
        authenticated: true,
        email: session.email,
        balance: balanceResult?.balance || session.balance,
        loading: false
      });
    } catch (error) {
      return publish({
        ...state,
        loading: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      inFlight = null;
      hasLoaded = true;
    }
  })();
  return inFlight;
}

/** 登录成功后写入会话，避免各入口重复请求 /v1/me。 */
export function applyCloudAccountSignedIn(
  email?: string,
  balance?: { available: string; reserved: string }
): CloudAccountSessionState {
  return publish({ authenticated: true, email, balance, loading: false });
}

/** 退出登录或云端判定会话失效时清空。 */
export function applyCloudAccountSignedOut(): CloudAccountSessionState {
  return publish({ authenticated: false, loading: false });
}

/** 充值或点数消耗后只更新点数，不改变登录态。 */
export function applyCloudAccountBalance(balance: { available: string; reserved: string }): CloudAccountSessionState {
  return publish({ ...state, balance });
}

/** 退出登录：清本地 safeStorage 会话并广播未登录态。 */
export async function signOutCloudAccount(): Promise<void> {
  await cloudAccountApi()?.logout().catch(() => undefined);
  applyCloudAccountSignedOut();
}
