import { ModuleAccessService } from '../modules/moduleAccessService';
import { requestLocalAuthorization, requestModuleAuthorizationExchange, type LocalModuleAuthorizationResult } from './localAuthorizationClient';

export type ModuleAccessBootstrap = 'env' | 'exchanged' | 'failed';

/** 结构化最小接口：真实 ModuleAccessService 与测试桩都按形状满足，门禁不关心 Permit 密码学细节。 */
export interface ModuleAccessGateAuthorizer {
  assertAccess(moduleId: string): void;
  sync(input: unknown): unknown;
}

export interface ModuleAccessGateOptions {
  authorizer: ModuleAccessGateAuthorizer;
  /** 宿主启动时取得模块授权状态的途径：env=IDE 注入；exchanged=启动时向本机代理换取成功；failed=启动时未取得。 */
  bootstrap: ModuleAccessBootstrap;
  /** bootstrap=failed 时的启动诊断（本机授权客户端返回的中文原因），拼进最终报错帮助定位。 */
  bootstrapMessage?: string;
  /** 仅供测试注入；缺省用本机授权代理客户端。 */
  requestExchange?: typeof requestLocalAuthorization;
  /** 按需换发（仅供测试注入）；缺省请 IDE 主进程用登录态向云端换发该模块 Permit 并回传最新状态。 */
  requestAuthorize?: (moduleId: string) => Promise<LocalModuleAuthorizationResult>;
  retryCooldownMs?: number;
  log?: (message: string) => void;
}

export interface ModuleAccessGate {
  assert(moduleIds: readonly string[]): Promise<void>;
}

const DEFAULT_RETRY_COOLDOWN_MS = 3000;

/**
 * 收费模块门禁的宿主侧包装（外部 AI 接入链路 P1，2026-09-21；按需换发 2026-10-18）。
 * stdio 宿主常由外部 AI 客户端拉起，可能先于用户在 IDE 打开「允许外部 AI 客户端使用本机授权」，
 * 启动时换不到授权 ≠ 用户没购买；一次握手时序错误不应惩罚整场会话。
 * 规则（三级恢复，全部带冷却，绝不静默放行）：
 * ① assert 失败先重读一次最新授权状态（用户可能刚在 IDE 启用/续期）；拿到最新状态即热更新；
 * ② 仍拒绝则按需换发：请 IDE 主进程用登录态向云端换发该模块 Permit——用户登录了（Pro/已购/限免
 *    由云端判定）就现场换到，登录了即可用，不再要求先去模块面板手动启用；
 * ③ 换发拿到 IDE 权威中文原因（未登录/无权益/云端失败）→ 原样分类报出；换发后仍无凭据 → 按
 *    「请先登录并购买」原语义拒绝；状态本身拿不到 → 报错指向「保持 LingBuilder 运行/重连 MCP」。
 */
export function createModuleAccessGate(options: ModuleAccessGateOptions): ModuleAccessGate {
  const requestExchange = options.requestExchange ?? requestLocalAuthorization;
  const requestAuthorize = options.requestAuthorize ?? requestModuleAuthorizationExchange;
  const cooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  const log = options.log ?? (() => undefined);
  let lastRetryAt = 0;
  let lastAuthorizeAt = 0;

  const syncAuthorizations = (value: string): boolean => {
    try {
      const authorizations = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      if (!Array.isArray(authorizations)) return false;
      const sync = (options.authorizer.sync as (input: unknown) => unknown).bind(options.authorizer);
      authorizations.forEach(authorization => sync(authorization));
      return true;
    } catch {
      return false;
    }
  };

  const refresh = async (): Promise<boolean> => {
    const now = Date.now();
    if (now - lastRetryAt < cooldownMs) return false;
    lastRetryAt = now;
    const exchange = await requestExchange('module-access');
    return exchange.ok ? syncAuthorizations(exchange.value) : false;
  };

  /** 按需换发；返回 null=冷却中跳过本轮。 */
  const authorize = async (moduleId: string): Promise<LocalModuleAuthorizationResult | null> => {
    const now = Date.now();
    if (now - lastAuthorizeAt < cooldownMs) return null;
    lastAuthorizeAt = now;
    return requestAuthorize(moduleId);
  };

  const describeUnreachable = (moduleId: string, error: unknown): Error => {
    const original = error instanceof Error ? error : new Error(String(error));
    const code = (original as NodeJS.ErrnoException).code || '';
    // 启动时已拿到 IDE 最新授权状态（env/exchanged）：「查无凭据」就是事实，按原语义拒绝。
    if (options.bootstrap !== 'failed') return original;
    // 过期/签名/信任锚等诊断已精确说明原因，原样透出；只有「完全查无凭据」才按启动时序解释。
    if (code !== 'MODULE_PAYMENT_REQUIRED') return original;
    return Object.assign(new Error(
      `收费模块「${moduleId}」需要本机授权，而本 AI 宿主启动时未取得授权，当前也仍未取得` +
      (options.bootstrapMessage ? `（启动时诊断：${options.bootstrapMessage}）` : '') +
      '。常见原因是 LingBuilder 未在运行或外部 AI 授权开关已关闭：请保持 LingBuilder 运行并登录账号' +
      '（「帮助 → AI Bridge 连接中心 → Bridge 启动设置」可检查「允许外部 AI 客户端使用本机授权」），然后重试；' +
      '若刚改动过设置，请重启 AI 客户端或重连 MCP，让宿主重新取得本机授权。'
    ), { status: 402, code: 'MODULE_PAYMENT_REQUIRED' });
  };

  return {
    async assert(moduleIds: readonly string[]): Promise<void> {
      for (const moduleId of moduleIds) {
        let denied: unknown;
        try {
          options.authorizer.assertAccess(moduleId);
          continue;
        } catch (error) {
          denied = error;
        }
        // ① 重读最新授权状态；「最新状态里确实没有凭据」先记下，②按需换发失败后再据此终判。
        let freshState = false;
        if (await refresh()) {
          try {
            options.authorizer.assertAccess(moduleId);
            log(`已通过本机授权代理热更新模块授权：${moduleId}`);
            continue;
          } catch (stillDenied) {
            denied = stillDenied;
            freshState = true;
          }
        }
        // ② 按需换发：登录了（Pro/已购/限免由云端判定）就现场换到 Permit。
        const authorizeOutcome = await authorize(moduleId);
        if (authorizeOutcome?.ok && syncAuthorizations(authorizeOutcome.value)) {
          try {
            options.authorizer.assertAccess(moduleId);
            log(`已按需换发并热更新模块授权：${moduleId}`);
            continue;
          } catch {
            freshState = true;
          }
        }
        // ③ 终态分类：IDE 给出的权威中文原因（未登录/无权益/云端失败）原样透出；
        // 换发后最新状态里仍无凭据 → 「请先登录并购买」原语义；状态拿不到 → 时序/环境指引。
        if (authorizeOutcome && !authorizeOutcome.ok && authorizeOutcome.reachable && authorizeOutcome.message) {
          throw Object.assign(new Error(`收费模块「${moduleId}」自动授权未成功：${authorizeOutcome.message}`), {
            status: 402,
            code: 'MODULE_PAYMENT_REQUIRED',
            moduleId
          });
        }
        if (freshState) {
          throw denied;
        }
        throw describeUnreachable(moduleId, denied);
      }
    }
  };
}

/** ModuleAccessService 满足门禁所需的最小接口（结构化赋值，避免门禁反向依赖具体实现）。 */
export function asModuleAccessGateAuthorizer(service: ModuleAccessService): ModuleAccessGateAuthorizer {
  return service;
}
