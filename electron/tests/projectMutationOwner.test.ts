import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createProjectMutationOwner,
  isProjectMutationOwnerCurrent
} from '../src/services/workspace/projectMutationOwner';

test('accepts an asynchronous mutation only for the same ready project load', () => {
  const owner = createProjectMutationOwner('project-a', 4);
  assert.equal(isProjectMutationOwnerCurrent(owner, {
    activeProjectId: 'project-a',
    loadedProjectId: 'project-a',
    loadGeneration: 4,
    projectFilesReady: true
  }), true);
});

test('rejects a response after switching projects even when the new project is ready', () => {
  const owner = createProjectMutationOwner('project-a', 4);
  assert.equal(isProjectMutationOwnerCurrent(owner, {
    activeProjectId: 'project-b',
    loadedProjectId: 'project-b',
    loadGeneration: 5,
    projectFilesReady: true
  }), false);
});

test('rejects a response after reloading the same project', () => {
  const owner = createProjectMutationOwner('project-a', 4);
  assert.equal(isProjectMutationOwnerCurrent(owner, {
    activeProjectId: 'project-a',
    loadedProjectId: 'project-a',
    loadGeneration: 5,
    projectFilesReady: true
  }), false);
});

test('rejects responses while the authoritative project files are unavailable', () => {
  const owner = createProjectMutationOwner('project-a', 4);
  assert.equal(isProjectMutationOwnerCurrent(owner, {
    activeProjectId: 'project-a',
    loadedProjectId: 'project-a',
    loadGeneration: 4,
    projectFilesReady: false
  }), false);
});
