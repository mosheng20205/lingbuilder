import type {
  SdkDependencyJobSnapshot,
  SdkDependencyStatus
} from './sdkDependencyService';

export interface SdkDependencyPromptSnapshot {
  open: boolean;
  dependencies: SdkDependencyStatus[];
  job: SdkDependencyJobSnapshot | null;
  installing: boolean;
  error: string;
}

type Listener = (snapshot: SdkDependencyPromptSnapshot) => void;

const CLOSED_SNAPSHOT: SdkDependencyPromptSnapshot = {
  open: false,
  dependencies: [],
  job: null,
  installing: false,
  error: ''
};

export class SdkDependencyPromptCoordinator {
  private snapshot: SdkDependencyPromptSnapshot = { ...CLOSED_SNAPSHOT };
  private listeners = new Set<Listener>();
  private pending: Promise<void> | null = null;
  private resolvePending: (() => void) | null = null;
  private rejectPending: ((error: Error) => void) | null = null;
  private cancelled = false;

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SdkDependencyPromptSnapshot {
    return structuredClone(this.snapshot);
  }

  requestInstall(dependencies: readonly SdkDependencyStatus[]): Promise<void> {
    const missing = dependencies.filter(item => !item.installed);
    if (missing.length === 0) return Promise.resolve();
    if (this.pending) {
      const merged = new Map(this.snapshot.dependencies.map(item => [item.id, item]));
      missing.forEach(item => merged.set(item.id, item));
      this.update({ dependencies: [...merged.values()] });
      return this.pending;
    }
    this.cancelled = false;
    this.update({ open: true, dependencies: [...missing], job: null, installing: false, error: '' });
    this.pending = new Promise<void>((resolve, reject) => {
      this.resolvePending = resolve;
      this.rejectPending = reject;
    });
    return this.pending;
  }

  async install(): Promise<void> {
    if (!this.pending || this.snapshot.installing) return;
    this.update({ installing: true, error: '' });
    try {
      for (let index = 0; index < this.snapshot.dependencies.length; index += 1) {
        const dependency = this.snapshot.dependencies[index];
        if (this.cancelled) throw new Error('已取消 SDK 安装。');
        const latest = await fetchSdkOverview();
        if (latest.dependencies.find(item => item.id === dependency.id)?.installed) continue;
        const response = await fetch('/api/sdk-dependencies/install', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dependencyId: dependency.id })
        });
        const started = await response.json().catch(() => ({})) as { ok?: boolean; job?: SdkDependencyJobSnapshot; error?: string };
        if (!response.ok || !started.ok || !started.job) throw new Error(started.error || `启动 ${dependency.name} 下载失败。`);
        this.update({ job: started.job });
        await this.waitForCurrentJob();
      }
      this.resolvePending?.();
      this.clearPending();
      this.update({ ...CLOSED_SNAPSHOT });
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'SDK 安装失败。';
      if (this.cancelled) {
        this.rejectPending?.(new Error(message));
        this.clearPending();
        this.update({ ...CLOSED_SNAPSHOT });
      } else {
        this.update({ installing: false, error: message });
      }
    }
  }

  async cancel(): Promise<void> {
    this.cancelled = true;
    if (this.snapshot.job?.active) {
      await fetch('/api/sdk-dependencies/cancel', { method: 'POST' }).catch(() => undefined);
    }
    this.rejectPending?.(new Error('用户取消了 SDK 下载，原操作未执行。'));
    this.clearPending();
    this.update({ ...CLOSED_SNAPSHOT });
  }

  private async waitForCurrentJob(): Promise<void> {
    while (!this.cancelled) {
      const overview = await fetchSdkOverview();
      this.update({ job: overview.job });
      if (!overview.job.active) {
        if (overview.job.state === 'succeeded') return;
        throw new Error(overview.job.error || overview.job.message || 'SDK 安装未完成。');
      }
      await new Promise(resolve => globalThis.setTimeout(resolve, 500));
    }
  }

  private clearPending(): void {
    this.pending = null;
    this.resolvePending = null;
    this.rejectPending = null;
  }

  private update(patch: Partial<SdkDependencyPromptSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    const next = this.getSnapshot();
    this.listeners.forEach(listener => listener(next));
  }
}

export const sdkDependencyPromptCoordinator = new SdkDependencyPromptCoordinator();

export async function fetchWithSdkDependencies(
  request: () => Promise<Response>,
  options: { retryLimit?: number } = {}
): Promise<Response> {
  const retryLimit = options.retryLimit ?? 1;
  let response = await request();
  for (let attempt = 0; attempt < retryLimit; attempt += 1) {
    const payload = await response.clone().json().catch(() => ({})) as {
      code?: string;
      dependencies?: SdkDependencyStatus[];
    };
    if (payload.code !== 'SDK_DEPENDENCY_REQUIRED' || !payload.dependencies?.length) return response;
    await sdkDependencyPromptCoordinator.requestInstall(payload.dependencies);
    response = await request();
  }
  return response;
}

async function fetchSdkOverview(): Promise<{
  dependencies: SdkDependencyStatus[];
  job: SdkDependencyJobSnapshot;
}> {
  const response = await fetch('/api/sdk-dependencies/status');
  const result = await response.json().catch(() => ({})) as {
    ok?: boolean;
    dependencies?: SdkDependencyStatus[];
    job?: SdkDependencyJobSnapshot;
    error?: string;
  };
  if (!response.ok || !result.ok || !result.dependencies || !result.job) {
    throw new Error(result.error || '读取 SDK 下载状态失败。');
  }
  return { dependencies: result.dependencies, job: result.job };
}
