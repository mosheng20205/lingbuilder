export type ProjectBuildCancelReason = 'user' | 'project-delete' | 'shutdown';

export interface ProjectBuildStatus {
  projectId: string;
  taskId: number;
  startedAt: string;
  cancelled: boolean;
  cancelReason?: ProjectBuildCancelReason;
}

export interface ProjectBuildLease {
  readonly projectId: string;
  readonly taskId: number;
  readonly startedAt: string;
  isCancelled(): boolean;
  getCancelReason(): ProjectBuildCancelReason | undefined;
  readonly signal: AbortSignal;
  finish(): void;
}

export interface ProjectBuildAdmission {
  globalGeneration: number;
  projectId?: string;
  projectGeneration?: number;
}

interface ActiveProjectBuild {
  projectId: string;
  taskId: number;
  generation: number;
  globalGeneration: number;
  startedAt: string;
  cancelReason?: ProjectBuildCancelReason;
  controller: AbortController;
}

export class ProjectBuildBusyError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`项目“${projectId}”已有生成或运行任务正在执行，请先停止或等待任务结束。`);
    this.name = 'ProjectBuildBusyError';
    this.projectId = projectId;
  }
}

export class ProjectBuildCancelledBeforeStartError extends Error {
  readonly projectId: string;

  constructor(projectId: string) {
    super(`项目“${projectId}”的生成请求已在开始前被停止。`);
    this.name = 'ProjectBuildCancelledBeforeStartError';
    this.projectId = projectId;
  }
}

/**
 * 为每个项目串行化生成、编译和启动流程，并用取消代次阻止已取消任务晚到启动 exe。
 * 该服务不执行任意命令；具体编译仍由受控构建链路负责。
 */
export class ProjectBuildCoordinator {
  private readonly activeBuilds = new Map<string, ActiveProjectBuild>();
  private readonly generations = new Map<string, number>();
  private readonly idleWaiters = new Set<() => void>();
  private nextTaskId = 1;
  private globalGeneration = 0;
  private shuttingDown = false;

  captureAdmission(projectId: string): ProjectBuildAdmission {
    const normalizedProjectId = requireProjectId(projectId);
    return {
      projectId: normalizedProjectId,
      globalGeneration: this.globalGeneration,
      projectGeneration: this.generations.get(normalizedProjectId) ?? 0
    };
  }

  captureGlobalAdmission(): ProjectBuildAdmission {
    return { globalGeneration: this.globalGeneration };
  }

  begin(projectId: string, admission?: ProjectBuildAdmission): ProjectBuildLease {
    const normalizedProjectId = requireProjectId(projectId);
    if (this.shuttingDown) {
      throw new Error('LingBuilder 服务正在关闭，不能启动新的生成任务。');
    }
    if (this.activeBuilds.has(normalizedProjectId)) {
      throw new ProjectBuildBusyError(normalizedProjectId);
    }
    if (
      admission
      && (
        admission.globalGeneration !== this.globalGeneration
        || (
          admission.projectId !== undefined
          && (
            admission.projectId !== normalizedProjectId
            || admission.projectGeneration !== (this.generations.get(normalizedProjectId) ?? 0)
          )
        )
      )
    ) {
      throw new ProjectBuildCancelledBeforeStartError(normalizedProjectId);
    }

    const active: ActiveProjectBuild = {
      projectId: normalizedProjectId,
      taskId: this.nextTaskId++,
      generation: this.generations.get(normalizedProjectId) ?? 0,
      globalGeneration: this.globalGeneration,
      startedAt: new Date().toISOString()
      , controller: new AbortController()
    };
    this.activeBuilds.set(normalizedProjectId, active);

    let finished = false;
    return {
      projectId: active.projectId,
      taskId: active.taskId,
      startedAt: active.startedAt,
      isCancelled: () => this.shuttingDown
        || active.cancelReason !== undefined
        || this.globalGeneration !== active.globalGeneration
        || (this.generations.get(active.projectId) ?? 0) !== active.generation,
      getCancelReason: () => active.cancelReason ?? (this.shuttingDown ? 'shutdown' : undefined),
      signal: active.controller.signal,
      finish: () => {
        if (finished) return;
        finished = true;
        if (this.activeBuilds.get(active.projectId)?.taskId === active.taskId) {
          this.activeBuilds.delete(active.projectId);
          if (this.activeBuilds.size === 0) {
            const waiters = [...this.idleWaiters];
            this.idleWaiters.clear();
            waiters.forEach(resolve => resolve());
          }
        }
      }
    };
  }

  cancel(projectId: string, reason: ProjectBuildCancelReason = 'user'): boolean {
    const normalizedProjectId = requireProjectId(projectId);
    this.generations.set(normalizedProjectId, (this.generations.get(normalizedProjectId) ?? 0) + 1);
    const active = this.activeBuilds.get(normalizedProjectId);
    if (active) {
      active.cancelReason = reason;
      active.controller.abort(new Error(`项目构建已取消：${reason}`));
    }
    return Boolean(active);
  }

  cancelAll(reason: ProjectBuildCancelReason = 'user'): string[] {
    this.globalGeneration += 1;
    const projectIds = [...this.activeBuilds.keys()];
    projectIds.forEach(projectId => this.cancel(projectId, reason));
    return projectIds;
  }

  shutdown(): string[] {
    if (this.shuttingDown) return [...this.activeBuilds.keys()];
    this.shuttingDown = true;
    return this.cancelAll('shutdown');
  }

  isActive(projectId: string): boolean {
    return this.activeBuilds.has(requireProjectId(projectId));
  }

  getStatus(projectId: string): ProjectBuildStatus | null {
    const active = this.activeBuilds.get(requireProjectId(projectId));
    return active ? cloneStatus(active, this.shuttingDown) : null;
  }

  getAllStatuses(): ProjectBuildStatus[] {
    return [...this.activeBuilds.values()]
      .map(active => cloneStatus(active, this.shuttingDown))
      .sort((left, right) => left.taskId - right.taskId);
  }

  async waitForIdle(): Promise<void> {
    if (this.activeBuilds.size === 0) return;
    await new Promise<void>(resolve => this.idleWaiters.add(resolve));
  }
}

export function createProjectBuildCoordinator(): ProjectBuildCoordinator {
  return new ProjectBuildCoordinator();
}

function requireProjectId(projectId: string): string {
  const normalized = projectId.trim();
  if (!normalized) throw new Error('项目 ID 不能为空。');
  return normalized;
}

function cloneStatus(active: ActiveProjectBuild, shuttingDown: boolean): ProjectBuildStatus {
  return {
    projectId: active.projectId,
    taskId: active.taskId,
    startedAt: active.startedAt,
    cancelled: shuttingDown || active.cancelReason !== undefined,
    cancelReason: active.cancelReason ?? (shuttingDown ? 'shutdown' : undefined)
  };
}
