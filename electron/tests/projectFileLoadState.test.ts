import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProjectFileLoadState,
  getProjectFileEditorAvailability,
  hasUsableProjectFilePayload,
  isProjectFileLoadPending
} from '../src/services/workspace/projectFileLoadState';

test('initial and cross-project loads keep the editor read-only until authoritative files arrive', () => {
  const initial = createProjectFileLoadState('project-a');
  assert.equal(getProjectFileEditorAvailability('project-a', 'project-a', initial), 'loading');
  assert.equal(isProjectFileLoadPending('project-a', 'project-a', initial), true);

  const staleReady = createProjectFileLoadState('project-a', 'ready');
  assert.equal(getProjectFileEditorAvailability('project-b', 'project-a', staleReady), 'loading');
  assert.equal(isProjectFileLoadPending('project-b', 'project-a', staleReady), true);

  const loaded = createProjectFileLoadState('project-b', 'ready');
  assert.equal(getProjectFileEditorAvailability('project-b', 'project-b', loaded), 'ready');
  assert.equal(isProjectFileLoadPending('project-b', 'project-b', loaded), false);
});

test('only a non-empty string file map can complete authoritative hydration', () => {
  assert.equal(hasUsableProjectFilePayload({ 'src/main.lcpp': '包 测试' }), true);
  assert.equal(hasUsableProjectFilePayload({}), false);
  assert.equal(hasUsableProjectFilePayload([]), false);
  assert.equal(hasUsableProjectFilePayload({ 'src/main.lcpp': 42 }), false);
  assert.equal(hasUsableProjectFilePayload({ '': '内容' }), false);
});

test('failed project loads expose retry state and do not permanently block switching away', () => {
  const failed = createProjectFileLoadState('project-b', 'error', '网络失败');
  assert.equal(getProjectFileEditorAvailability('project-b', 'project-a', failed), 'error');
  assert.equal(isProjectFileLoadPending('project-b', 'project-a', failed), false);
  assert.equal(failed.error, '网络失败');
});
