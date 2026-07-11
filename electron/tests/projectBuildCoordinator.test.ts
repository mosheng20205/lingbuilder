import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProjectBuildCoordinator,
  ProjectBuildBusyError,
  ProjectBuildCancelledBeforeStartError
} from '../src/services/tasks/projectBuildCoordinator';

test('project build coordinator serializes the same project and releases an idempotent lease', () => {
  const coordinator = createProjectBuildCoordinator();
  const first = coordinator.begin('demo');

  assert.throws(() => coordinator.begin('demo'), ProjectBuildBusyError);
  assert.equal(coordinator.getStatus('demo')?.taskId, first.taskId);

  first.finish();
  first.finish();
  const second = coordinator.begin('demo');
  assert.ok(second.taskId > first.taskId);
  second.finish();
  assert.equal(coordinator.getStatus('demo'), null);
});

test('cancelling a project invalidates only its active lease and prevents a late launch decision', () => {
  const coordinator = createProjectBuildCoordinator();
  const first = coordinator.begin('first');
  const second = coordinator.begin('second');

  assert.equal(coordinator.cancel('first'), true);
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, false);
  assert.equal(first.isCancelled(), true);
  assert.equal(first.getCancelReason(), 'user');
  assert.equal(second.isCancelled(), false);
  assert.equal(coordinator.cancel('missing'), false);

  first.finish();
  second.finish();
});

test('shutdown cancels every in-flight project and permanently rejects new work', () => {
  const coordinator = createProjectBuildCoordinator();
  const first = coordinator.begin('first');
  const second = coordinator.begin('second');

  assert.deepEqual(coordinator.shutdown().sort(), ['first', 'second']);
  assert.equal(first.isCancelled(), true);
  assert.equal(second.isCancelled(), true);
  assert.equal(first.getCancelReason(), 'shutdown');
  assert.equal(first.signal.aborted, true);
  assert.equal(second.signal.aborted, true);
  assert.equal(coordinator.getAllStatuses().every(status => status.cancelled), true);
  assert.throws(() => coordinator.begin('third'), /正在关闭/);

  first.finish();
  second.finish();
});

test('waitForIdle resolves only after every active lease has finished', async () => {
  const coordinator = createProjectBuildCoordinator();
  const first = coordinator.begin('first');
  const second = coordinator.begin('second');
  let resolved = false;
  const idle = coordinator.waitForIdle().then(() => { resolved = true; });

  first.finish();
  await Promise.resolve();
  assert.equal(resolved, false);
  second.finish();
  await idle;
  assert.equal(resolved, true);
  await coordinator.waitForIdle();
});

test('a stop invalidates requests admitted before their asynchronous project lookup finishes', () => {
  const coordinator = createProjectBuildCoordinator();
  const globalAdmission = coordinator.captureAdmission('global-pending');
  coordinator.cancelAll('user');
  assert.throws(
    () => coordinator.begin('global-pending', globalAdmission),
    ProjectBuildCancelledBeforeStartError
  );

  const projectAdmission = coordinator.captureAdmission('project-pending');
  coordinator.cancel('project-pending', 'user');
  assert.throws(
    () => coordinator.begin('project-pending', projectAdmission),
    ProjectBuildCancelledBeforeStartError
  );
});
