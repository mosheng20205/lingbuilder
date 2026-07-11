import type { ManagedProcessStopResult } from './managedProcessService';
import type {
  ProjectBuildAdmission,
  ProjectBuildCoordinator,
  ProjectBuildLease
} from './projectBuildCoordinator';

export interface ProjectRunStopper {
  stop(projectId: string): Promise<ManagedProcessStopResult>;
}

export interface ProjectBuildSession {
  lease: ProjectBuildLease;
  previousRun: ManagedProcessStopResult;
}

export class ProjectBuildPreparationError extends Error {
  readonly stage = 'stop-existing-run';

  constructor(message: string) {
    super(message);
    this.name = 'ProjectBuildPreparationError';
  }
}

/**
 * 获取项目构建租约后，先停止固定输出路径上的旧受控 exe，避免 Windows 链接器因文件锁失败。
 */
export class ProjectBuildSessionService {
  constructor(
    private readonly coordinator: ProjectBuildCoordinator,
    private readonly processStopper: ProjectRunStopper
  ) {}

  async begin(projectId: string, admission?: ProjectBuildAdmission): Promise<ProjectBuildSession> {
    const lease = this.coordinator.begin(projectId, admission);
    try {
      const previousRun = await this.processStopper.stop(lease.projectId);
      if (previousRun.found && !previousRun.stopped) {
        throw new ProjectBuildPreparationError(
          `旧运行进程未能停止，已取消重新生成以避免覆盖正在使用的 exe。${previousRun.message}`
        );
      }
      return { lease, previousRun };
    } catch (error) {
      lease.finish();
      if (error instanceof ProjectBuildPreparationError) throw error;
      const reason = error instanceof Error ? error.message : String(error);
      throw new ProjectBuildPreparationError(`停止旧运行进程失败，已取消生成：${reason}`);
    }
  }
}

export function createProjectBuildSessionService(
  coordinator: ProjectBuildCoordinator,
  processStopper: ProjectRunStopper
): ProjectBuildSessionService {
  return new ProjectBuildSessionService(coordinator, processStopper);
}
