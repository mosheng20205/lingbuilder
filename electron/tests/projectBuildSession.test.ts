import test from 'node:test';
import assert from 'node:assert/strict';

import { createProjectBuildCoordinator } from '../src/services/tasks/projectBuildCoordinator';
import {
  createProjectBuildSessionService,
  ProjectBuildPreparationError
} from '../src/services/tasks/projectBuildSessionService';

test('project build session stops the old fixed-path exe before compile work can begin', async () => {
  const events: string[] = [];
  const coordinator = createProjectBuildCoordinator();
  const service = createProjectBuildSessionService(coordinator, {
    async stop(projectId) {
      events.push(`stop:${projectId}`);
      return {
        projectId,
        pid: 42,
        found: true,
        stopped: true,
        forced: false,
        message: '旧运行进程已停止。'
      };
    }
  });

  const session = await service.begin('fixed-output-project');
  events.push('compile');
  assert.deepEqual(events, ['stop:fixed-output-project', 'compile']);
  assert.equal(session.previousRun.stopped, true);
  session.lease.finish();
});

test('project build session rejects a failed stop and releases the project lease', async () => {
  const coordinator = createProjectBuildCoordinator();
  const service = createProjectBuildSessionService(coordinator, {
    async stop(projectId) {
      return {
        projectId,
        pid: 43,
        found: true,
        stopped: false,
        forced: true,
        message: '进程仍未退出。'
      };
    }
  });

  await assert.rejects(() => service.begin('locked-project'), ProjectBuildPreparationError);
  assert.equal(coordinator.isActive('locked-project'), false);
  const retry = coordinator.begin('locked-project');
  retry.finish();
});

test('project build session does not touch a process after a pending admission was cancelled', async () => {
  const coordinator = createProjectBuildCoordinator();
  const admission = coordinator.captureAdmission('pending-project');
  let stopCalls = 0;
  const service = createProjectBuildSessionService(coordinator, {
    async stop(projectId) {
      stopCalls += 1;
      return { projectId, found: false, stopped: false, forced: false, message: '没有进程。' };
    }
  });
  coordinator.cancelAll('user');

  await assert.rejects(() => service.begin('pending-project', admission), /开始前被停止/);
  assert.equal(stopCalls, 0);
});
