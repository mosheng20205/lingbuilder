import { requestCloudAccountLogin } from '../workbench/cloudAccountLoginService';

/**
 * 收费模块权益失败码全集（moduleAccessService / moduleAccessGate 抛出的 code）。
 * 构建链路（F5、生成解决方案、SDK 依赖恢复包装器）命中这些码时走共享恢复流：
 * 未登录 → 弹全局登录框；登录/已登录 → authorizeModule 换发授权并同步本地服务；
 * 恢复成功后调用方自动重试一次原请求。
 */
export const PAID_MODULE_ACCESS_ERROR_CODES: readonly string[] = [
  'MODULE_PAYMENT_REQUIRED',
  'MODULE_FREE_WINDOW_ENDED',
  'MODULE_ENTITLEMENT_EXPIRED',
  'MODULE_PERMIT_ANCHOR_UNKNOWN'
];

export function isPaidModuleAccessErrorCode(code: unknown): code is string {
  return typeof code === 'string' && PAID_MODULE_ACCESS_ERROR_CODES.includes(code);
}

export interface PaidModuleAccessRecoveryResult {
  /** true=授权已就绪（本地服务 Permit 已同步），调用方可直接重试原请求。 */
  recovered: boolean;
  authenticated?: boolean;
  /** 用户主动取消登录或引导弹窗。 */
  cancelled?: boolean;
  /** 未恢复时的中文原因（已带修法指引），调用方直接展示。 */
  message?: string;
}

/**
 * 收费模块授权恢复的唯一出口：登录态检查 → 全局登录框 → authorizeModule 换发并同步 Permit。
 * 模块面板启用门禁、F5/生成构建的 402 恢复都必须走这里，不得再各写一套登录+授权逻辑；
 * 购买下单流程仍留在模块面板（本服务只负责把授权换发到「可用」或给出带指引的原因）。
 */
export async function recoverPaidModuleAccess(
  moduleId: string,
  options: { moduleName?: string } = {}
): Promise<PaidModuleAccessRecoveryResult> {
  const displayName = options.moduleName?.trim() || moduleId;
  // 经 globalThis 取桥：渲染层是 window.lingBuilder，Node 单测可直接注入桩。
  const bridge = (globalThis as { window?: { lingBuilder?: { cloudAccount?: LingBuilderCloudAccountBridge } } }).window?.lingBuilder?.cloudAccount;
  if (!bridge?.authorizeModule) {
    return { recovered: false, message: '收费模块必须在 LingBuilder 桌面端登录后使用。' };
  }
  const session = await bridge.session().catch(() => null);
  if (!session?.authenticated) {
    const login = await requestCloudAccountLogin({
      description: `使用收费模块「${displayName}」需要先登录 LingBuilder 账号；登录成功后将自动刷新模块授权并继续。`
    });
    if (!login.authenticated) {
      return { recovered: false, authenticated: false, cancelled: true, message: '已取消登录，模块授权未刷新。' };
    }
  }
  const authorization = await bridge.authorizeModule(moduleId).catch(() => null);
  if (!authorization?.ok) {
    return {
      recovered: false,
      authenticated: true,
      message: authorization?.error || '模块授权检查失败，请确认网络可用后重试；也可在模块面板重新启用该模块。'
    };
  }
  if (authorization.status?.allowed) return { recovered: true, authenticated: true };
  return {
    recovered: false,
    authenticated: true,
    message: authorization.status?.reason
      || '当前账号没有该模块的有效权益：可在模块面板查看该模块详情页购买，或等待新一轮限时免费活动。'
  };
}

/** electron-api.d.ts 中 window.lingBuilder.cloudAccount 的本服务所需子集（避免测试环境依赖 DOM 全局）。 */
interface LingBuilderCloudAccountBridge {
  session: () => Promise<{ authenticated: boolean; email?: string } | null>;
  authorizeModule: (moduleId: string) => Promise<{ ok: boolean; error?: string; code?: string; status?: { moduleId: string; paid: boolean; allowed: boolean; source?: string; expiresAt?: string; reason?: string } }>;
}
