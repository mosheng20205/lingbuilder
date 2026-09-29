export interface CachedModuleAuthorization {
  permit?: {
    payload?: {
      moduleId?: string;
      /** 授权来源：free_window（限时免费活动）/ 正式权益（购买、授权码等）。 */
      source?: string;
      expiresAt?: string;
    };
  };
  [key: string]: unknown;
}

export interface ModulePermitRestoreResult {
  cachedCount: number;
  synchronizedCount: number;
  refreshedCount: number;
  rendererReady: boolean;
  failures: string[];
  /** 已过期且本次启动未能换发的 Permit 中文提示：主进程推给渲染层，在输出面板显性化，
   *  避免用户直到 F5 构建被 402 拦下才发现模块授权过期。 */
  staleNotices: string[];
}

export interface ModulePermitRestoreOptions {
  readCache: () => Promise<CachedModuleAuthorization[]>;
  writeCache: (values: CachedModuleAuthorization[]) => Promise<void>;
  requestRendererApi: (apiPath: string, init: RequestInit) => Promise<unknown>;
  refreshAuthorization?: (moduleId: string) => Promise<CachedModuleAuthorization>;
  retryAttempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  now?: () => number;
  log?: (level: 'info' | 'warn', message: string) => void;
}

const DEFAULT_RETRY_ATTEMPTS = 40;
const DEFAULT_RETRY_DELAY_MS = 250;

export async function restoreModulePermits(options: ModulePermitRestoreOptions): Promise<ModulePermitRestoreResult> {
  const cached = await options.readCache();
  const now = options.now ?? Date.now;
  const result: ModulePermitRestoreResult = {
    cachedCount: cached.length,
    synchronizedCount: 0,
    refreshedCount: 0,
    rendererReady: false,
    failures: [],
    staleNotices: []
  };
  if (cached.length === 0) return result;

  result.rendererReady = await waitForRendererApi(options);
  if (!result.rendererReady) {
    const message = `本地模块授权服务在重试后仍未就绪，${cached.length} 个缓存 Permit 尚未同步。`;
    result.failures.push(message);
    options.log?.('warn', message);
    return result;
  }

  for (const authorization of cached) {
    const moduleId = moduleIdOf(authorization);
    try {
      await options.requestRendererApi('/api/module-access/sync', {
        method: 'POST',
        body: JSON.stringify(authorization)
      });
      result.synchronizedCount += 1;
      options.log?.('info', `已从安全缓存恢复模块授权：${moduleId || '未知模块'}。`);
    } catch (error) {
      const message = `模块 ${moduleId || '未知模块'} 的缓存 Permit 同步失败：${errorMessage(error)}`;
      result.failures.push(message);
      options.log?.('warn', message);
    }
  }

  if (!options.refreshAuthorization) {
    for (const authorization of cached) {
      const notice = expiredPermitNotice(authorization, now());
      if (notice) result.staleNotices.push(notice);
    }
    return result;
  }

  const updated = [...cached];
  let cacheChanged = false;
  for (const authorization of cached) {
    const moduleId = moduleIdOf(authorization);
    if (!moduleId) continue;
    const wasExpired = Boolean(expiredPermitNotice(authorization, now()));
    try {
      const refreshed = await options.refreshAuthorization(moduleId);
      await options.requestRendererApi('/api/module-access/sync', {
        method: 'POST',
        body: JSON.stringify(refreshed)
      });
      const existingIndex = updated.findIndex(item => moduleIdOf(item) === moduleId);
      if (existingIndex >= 0) updated[existingIndex] = refreshed;
      else updated.push(refreshed);
      cacheChanged = true;
      result.refreshedCount += 1;
      options.log?.('info', `已联网刷新模块授权：${moduleId}。`);
    } catch (error) {
      const message = `模块 ${moduleId} 的联网授权刷新失败，将继续使用可验证的离线 Permit：${errorMessage(error)}`;
      result.failures.push(message);
      options.log?.('warn', message);
      // 过期 Permit 换发失败时必须显性化：不能让它埋到 F5 构建被 402 拦下才暴露。
      if (wasExpired) {
        const notice = expiredPermitNotice(authorization, now());
        if (notice) result.staleNotices.push(`${notice}（本次联网换发失败：${errorMessage(error)}）`);
      }
    }
  }
  if (cacheChanged) await options.writeCache(updated);
  return result;
}

/** 过期 Permit 的中文提示；未过期返回空串。 */
function expiredPermitNotice(authorization: CachedModuleAuthorization, nowMs: number): string {
  const payload = authorization.permit?.payload;
  const moduleId = typeof payload?.moduleId === 'string' ? payload.moduleId.trim() : '';
  const expiresAt = Date.parse(String(payload?.expiresAt || ''));
  if (!moduleId || !Number.isFinite(expiresAt) || nowMs < expiresAt) return '';
  const source = payload?.source === 'free_window' ? '限时免费授权' : '离线授权';
  return `模块 ${moduleId} 的${source}已于 ${new Date(expiresAt).toLocaleString()} 过期：请登录后在模块面板重新启用该模块以刷新授权；若账号已有正式权益会自动换发，否则需要购买或等待新一轮活动。`;
}

async function waitForRendererApi(options: ModulePermitRestoreOptions): Promise<boolean> {
  const attempts = Math.max(1, Math.trunc(options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS));
  const delayMs = Math.max(0, Math.trunc(options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS));
  const sleep = options.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await options.requestRendererApi('/api/health', { method: 'GET' });
      return true;
    } catch (error) {
      if (attempt === attempts) {
        options.log?.('warn', `等待本地模块授权服务失败：${errorMessage(error)}`);
        return false;
      }
      await sleep(delayMs);
    }
  }
  return false;
}

function moduleIdOf(authorization: CachedModuleAuthorization): string {
  return typeof authorization.permit?.payload?.moduleId === 'string'
    ? authorization.permit.payload.moduleId.trim()
    : '';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
