import { ModuleAccessService } from '../modules/moduleAccessService';
import { requestLocalAuthorization } from './localAuthorizationClient';

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
  retryCooldownMs?: number;
  log?: (message: string) => void;
}

export interface ModuleAccessGate {
  assert(moduleIds: readonly string[]): Promise<void>;
}

const DEFAULT_RETRY_COOLDOWN_MS = 3000;

/**
 * 收费模块门禁的宿主侧包装（外部 AI 接入链路 P1，2026-09-21）。
 * stdio 宿主常由外部 AI 客户端拉起，可能先于用户在 IDE 打开「允许外部 AI 客户端使用本机授权」，
 * 启动时换不到授权 ≠ 用户没购买；一次握手时序错误不应惩罚整场会话。
 * 规则：assert 失败路径上惰性重换一次（带冷却），换到最新授权状态即热更新（只活在宿主进程内）；
 * 换到状态后仍拒绝 → 授权确实无效，按「请先登录并购买」原语义拒绝（fail-closed，绝不静默放行）；
 * 状态本身拿不到（无代理/换取失败）→ 报错指向「重启 AI 客户端/重连 MCP」，不再误报「未购买」。
 */
export function createModuleAccessGate(options: ModuleAccessGateOptions): ModuleAccessGate {
  const requestExchange = options.requestExchange ?? requestLocalAuthorization;
  const cooldownMs = options.retryCooldownMs ?? DEFAULT_RETRY_COOLDOWN_MS;
  const log = options.log ?? (() => undefined);
  let lastRetryAt = 0;

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
      '。常见原因是宿主先于授权开关启动：请在 LingBuilder「帮助 → AI Bridge 连接中心 → Bridge 启动设置」'
      + '勾选「允许外部 AI 客户端使用本机授权」并保持 IDE 运行，然后重启 AI 客户端或重连 MCP，让宿主重新取得本机授权。'
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
        if (await refresh()) {
          try {
            options.authorizer.assertAccess(moduleId);
            log(`已通过本机授权代理热更新模块授权：${moduleId}`);
            continue;
          } catch (stillDenied) {
            // 已拿到 IDE 最新授权状态仍拒绝：说明确实没有该模块的购买/免费资格，按原语义拒绝。
            throw stillDenied;
          }
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
