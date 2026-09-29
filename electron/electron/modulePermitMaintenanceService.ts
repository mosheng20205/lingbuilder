import type { CachedModuleAuthorization } from './modulePermitRestoreService';

/** 临期预续期阈值：剩余有效期低于该值即换发（12 小时，云端离线有效期为 72 小时）。 */
export const MODULE_PERMIT_RENEW_THRESHOLD_MS = 12 * 60 * 60_000;
/** 常规巡检周期：30 分钟。 */
export const MODULE_PERMIT_SWEEP_INTERVAL_MS = 30 * 60_000;
/** 换发失败后的静默重试退避：初始 1 分钟，指数翻倍，上限 2 小时。 */
export const MODULE_PERMIT_BACKOFF_INITIAL_MS = 60_000;
export const MODULE_PERMIT_BACKOFF_MAX_MS = 2 * 60 * 60_000;

export interface ModulePermitRenewalOutcome {
  moduleId: string;
  /** true：续期把授权从「过期/不可用」翻转为「可用」，需要输出面板提示并同步 AI Bridge。 */
  restored: boolean;
  /** true：续期前授权仍可用（临期预续期），静默完成、不提示不打扰。 */
  proactive: boolean;
  expiresAt?: string;
  /** restored=true 时的用户可见中文提示（不含【模块授权】前缀与时间戳）。 */
  message: string;
}

export interface ModulePermitMaintenanceSweepResult {
  ran: boolean;
  /** ran=false 时的中文跳过原因：未登录 / 无换发通道 / 无缓存 / 已有检查在途。 */
  skippedReason?: string;
  /** 本次实际尝试换发的模块数。 */
  checkedCount: number;
  renewed: ModulePermitRenewalOutcome[];
  failures: string[];
}

export interface ModulePermitMaintenanceOptions {
  readCache: () => Promise<CachedModuleAuthorization[]>;
  writeCache: (values: CachedModuleAuthorization[]) => Promise<void>;
  requestRendererApi: (apiPath: string, init: RequestInit) => Promise<unknown>;
  /** 登录态判定：未登录时巡检直接跳过，绝不调用换发。 */
  isAuthenticated: () => boolean | Promise<boolean>;
  /** 联网换发出口：必须复用 cloudAccountService.modulePermit，禁止第二套换发实现。 */
  refreshAuthorization: (moduleId: string) => Promise<CachedModuleAuthorization>;
  /** 每轮巡检结束回调：主进程据此推送输出面板提示并按需重启 AI Bridge。 */
  onSweep?: (result: ModulePermitMaintenanceSweepResult) => void;
  log?: (level: 'info' | 'warn', message: string) => void;
  intervalMs?: number;
  renewThresholdMs?: number;
  backoffInitialMs?: number;
  backoffMaxMs?: number;
  now?: () => number;
}

/**
 * 收费模块 Permit 运行期自动续期（2026-09-29）。
 * 背景：云端 Permit 离线有效期 72 小时，历史上换发只发生在启动恢复/模块启用/F5 402 三个被动时机，
 * 长驻会话里 Permit 过期后不重启就永远显示过期。本服务把换发变成运行期自治：
 * 每 30 分钟巡检一次安全缓存，对「已过期或剩余 < 12 小时」的 Permit 联网换发并同步渲染层与缓存；
 * 网络恢复在线、云账号登录成功两个时机各立即触发一次；失败静默指数退避（上限 2 小时），绝不弹窗。
 */
export class ModulePermitMaintenanceService {
  private intervalTimer: NodeJS.Timeout | undefined;
  private retryTimer: NodeJS.Timeout | undefined;
  private pendingRetryDelayMsValue: number | undefined;
  private sweepInFlight = false;
  private failureCount = 0;
  private readonly intervalMs: number;
  private readonly renewThresholdMs: number;
  private readonly backoffInitialMs: number;
  private readonly backoffMaxMs: number;

  constructor(private readonly options: ModulePermitMaintenanceOptions) {
    this.intervalMs = positiveOrDefault(options.intervalMs, MODULE_PERMIT_SWEEP_INTERVAL_MS);
    this.renewThresholdMs = positiveOrDefault(options.renewThresholdMs, MODULE_PERMIT_RENEW_THRESHOLD_MS);
    this.backoffInitialMs = positiveOrDefault(options.backoffInitialMs, MODULE_PERMIT_BACKOFF_INITIAL_MS);
    this.backoffMaxMs = positiveOrDefault(options.backoffMaxMs, MODULE_PERMIT_BACKOFF_MAX_MS);
  }

  /** 启动 30 分钟周期巡检；已启动时幂等。首次巡检在启动后一个周期，启动时的换发由恢复流承担。 */
  start(): void {
    if (this.intervalTimer) return;
    this.intervalTimer = setInterval(() => {
      void this.triggerSweep('周期巡检');
    }, this.intervalMs);
    this.intervalTimer.unref?.();
  }

  /** 停止巡检与待重试定时器（登出 / 退出时调用）。 */
  stop(): void {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.intervalTimer = undefined;
    this.clearRetryTimer();
    this.failureCount = 0;
  }

  isRunning(): boolean {
    return Boolean(this.intervalTimer);
  }

  /** 供测试观察退避调度：当前待重试定时器的延迟毫秒数（未安排时为 undefined）。 */
  nextRetryDelayMs(): number | undefined {
    return this.pendingRetryDelayMsValue;
  }

  /** 立即触发一轮巡检（登录成功 / 网络恢复在线 / 退避重试）。绝不抛错。 */
  async triggerSweep(reason: string): Promise<ModulePermitMaintenanceSweepResult> {
    return await this.sweep(reason);
  }

  private async sweep(reason: string): Promise<ModulePermitMaintenanceSweepResult> {
    const result: ModulePermitMaintenanceSweepResult = { ran: false, checkedCount: 0, renewed: [], failures: [] };
    if (this.sweepInFlight) {
      result.skippedReason = '已有一次授权巡检在执行，本轮跳过。';
      return result;
    }
    this.sweepInFlight = true;
    try {
      if (!await this.options.isAuthenticated()) {
        result.skippedReason = '未登录 LingBuilder 账号，跳过模块授权自动续期。';
        return result;
      }
      const cached = await this.options.readCache();
      if (cached.length === 0) {
        result.skippedReason = '本地没有缓存的模块授权，跳过自动续期。';
        return result;
      }
      result.ran = true;
      const nowMs = (this.options.now ?? Date.now)();
      const updated = [...cached];
      let cacheChanged = false;
      for (const authorization of cached) {
        const moduleId = moduleIdOf(authorization);
        if (!moduleId) continue;
        const due = this.evaluateDue(authorization, nowMs);
        if (!due || !due.needsRenewal) continue;
        result.checkedCount += 1;
        try {
          const refreshed = await this.options.refreshAuthorization(moduleId);
          try {
            await this.options.requestRendererApi('/api/module-access/sync', {
              method: 'POST',
              body: JSON.stringify(refreshed)
            });
          } catch (syncError) {
            // 本地服务暂时不可用不影响授权本体：缓存仍会更新，下次启动恢复流会重新同步。
            this.options.log?.('warn', `模块 ${moduleId} 的新授权同步到本地服务失败：${errorMessage(syncError)}；已更新安全缓存，重启后会重新同步。`);
          }
          const existingIndex = updated.findIndex(item => moduleIdOf(item) === moduleId);
          if (existingIndex >= 0) updated[existingIndex] = refreshed;
          else updated.push(refreshed);
          cacheChanged = true;
          const expiresAt = extractExpiresAt(refreshed);
          if (due.expired) {
            const message = `模块 ${moduleId} 的${sourceLabel(refreshed)}已自动续期，有效期至 ${formatWhen(expiresAt)}。`;
            result.renewed.push({ moduleId, restored: true, proactive: false, expiresAt, message });
            this.options.log?.('info', message);
          } else {
            result.renewed.push({ moduleId, restored: false, proactive: true, expiresAt, message: '' });
            this.options.log?.('info', `模块 ${moduleId} 的授权临近过期，已自动续期至 ${formatWhen(expiresAt)}。`);
          }
        } catch (error) {
          const message = `模块 ${moduleId} 的授权自动续期失败：${errorMessage(error)}`;
          result.failures.push(message);
          this.options.log?.('warn', `${message}（将在退避后静默重试，不影响当前使用。）`);
        }
      }
      if (cacheChanged) await this.options.writeCache(updated);
      this.afterSweep(result);
      return result;
    } catch (error) {
      result.failures.push(`模块授权自动续期巡检失败：${errorMessage(error)}`);
      this.options.log?.('warn', result.failures[0] || '');
      this.afterSweep(result);
      return result;
    } finally {
      this.sweepInFlight = false;
    }
  }

  private evaluateDue(authorization: CachedModuleAuthorization, nowMs: number): { needsRenewal: boolean; expired: boolean } | undefined {
    const expiresAt = Date.parse(String(authorization.permit?.payload?.expiresAt || ''));
    if (!Number.isFinite(expiresAt)) return undefined;
    const remaining = expiresAt - nowMs;
    return { needsRenewal: remaining < this.renewThresholdMs, expired: remaining <= 0 };
  }

  private afterSweep(result: ModulePermitMaintenanceSweepResult): void {
    if (result.renewed.length > 0) {
      // 任一换发成功即恢复常规节奏：清空退避，回到 30 分钟巡检。
      this.failureCount = 0;
      this.clearRetryTimer();
    } else if (result.failures.length > 0) {
      this.failureCount += 1;
      this.armRetryTimer(Math.min(this.backoffInitialMs * 2 ** (this.failureCount - 1), this.backoffMaxMs));
    }
    try {
      this.options.onSweep?.(result);
    } catch (error) {
      this.options.log?.('warn', `模块授权续期回调处理失败：${errorMessage(error)}`);
    }
  }

  private armRetryTimer(delayMs: number): void {
    this.clearRetryTimer();
    this.pendingRetryDelayMsValue = delayMs;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.pendingRetryDelayMsValue = undefined;
      void this.triggerSweep('退避重试');
    }, delayMs);
    this.retryTimer.unref?.();
  }

  private clearRetryTimer(): void {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.pendingRetryDelayMsValue = undefined;
  }
}

function positiveOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;
}

function moduleIdOf(authorization: CachedModuleAuthorization): string {
  return typeof authorization.permit?.payload?.moduleId === 'string'
    ? authorization.permit.payload.moduleId.trim()
    : '';
}

function extractExpiresAt(authorization: CachedModuleAuthorization): string | undefined {
  const value = authorization.permit?.payload?.expiresAt;
  return typeof value === 'string' && value ? value : undefined;
}

function sourceLabel(authorization: CachedModuleAuthorization): string {
  return authorization.permit?.payload?.source === 'free_window' ? '限时免费授权' : '离线授权';
}

function formatWhen(expiresAt: string | undefined): string {
  const parsed = Date.parse(String(expiresAt || ''));
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString() : '未知时间';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
