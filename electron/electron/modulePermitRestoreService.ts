export interface CachedModuleAuthorization {
  permit?: {
    payload?: {
      moduleId?: string;
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
}

export interface ModulePermitRestoreOptions {
  readCache: () => Promise<CachedModuleAuthorization[]>;
  writeCache: (values: CachedModuleAuthorization[]) => Promise<void>;
  requestRendererApi: (apiPath: string, init: RequestInit) => Promise<unknown>;
  refreshAuthorization?: (moduleId: string) => Promise<CachedModuleAuthorization>;
  retryAttempts?: number;
  retryDelayMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  log?: (level: 'info' | 'warn', message: string) => void;
}

const DEFAULT_RETRY_ATTEMPTS = 40;
const DEFAULT_RETRY_DELAY_MS = 250;

export async function restoreModulePermits(options: ModulePermitRestoreOptions): Promise<ModulePermitRestoreResult> {
  const cached = await options.readCache();
  const result: ModulePermitRestoreResult = {
    cachedCount: cached.length,
    synchronizedCount: 0,
    refreshedCount: 0,
    rendererReady: false,
    failures: []
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

  if (!options.refreshAuthorization) return result;

  const updated = [...cached];
  let cacheChanged = false;
  for (const authorization of cached) {
    const moduleId = moduleIdOf(authorization);
    if (!moduleId) continue;
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
    }
  }
  if (cacheChanged) await options.writeCache(updated);
  return result;
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
