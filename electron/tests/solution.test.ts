import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createSolutionService, DEFAULT_PROJECT_ID } from '../src/services/solution/solutionService';

test('solution service creates a default solution for an empty workspace', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);

  const solution = await service.getSolution();

  assert.equal(solution.schemaVersion, 1);
  assert.equal(solution.startupProjectId, DEFAULT_PROJECT_ID);
  assert.equal(solution.projects.length, 1);
  assert.equal(solution.projects[0].id, DEFAULT_PROJECT_ID);
  assert.equal(solution.projects[0].sourceRoot, 'src');
  assert.ok(await exists(path.join(root, '.lingbuilder', 'solution.json')));
});

test('solution service creates project files and designer model', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);

  const result = await service.createProject({ name: '测试项目', projectId: 'demo-app' });

  assert.equal(result.project.id, 'demo-app');
  assert.equal(result.solution.projects.length, 2);
  assert.ok(await exists(path.join(root, 'src', 'demo-app', 'MainWindow.lcpp')));
  assert.ok(await exists(path.join(root, 'config', 'demo-app', 'config.ini')));
  assert.ok(await exists(path.join(root, '.lingbuilder', 'projects', 'demo-app', 'window-designer.json')));
});

test('solution service removes references or files while preserving last project', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.createProject({ name: '删除演示', projectId: 'delete-demo' });

  const removedReference = await service.deleteProject('delete-demo', { deleteFiles: false });
  assert.equal(removedReference.solution.projects.some(project => project.id === 'delete-demo'), false);
  assert.ok(await exists(path.join(root, 'src', 'delete-demo', 'MainWindow.lcpp')));

  await service.createProject({ name: '删除文件演示', projectId: 'delete-files-demo' });
  const removedFiles = await service.deleteProject('delete-files-demo', { deleteFiles: true });
  assert.equal(removedFiles.solution.projects.some(project => project.id === 'delete-files-demo'), false);
  assert.equal(await exists(path.join(root, 'src', 'delete-files-demo')), false);

  await assert.rejects(
    () => service.deleteProject(DEFAULT_PROJECT_ID, { deleteFiles: false }),
    /至少需要保留一个项目/
  );
});

test('solution clean removes build outputs and preserves generated exports', async () => {
  const root = await createTempWorkspace();
  const service = createSolutionService(root);
  await service.createProject({ name: '清理演示', projectId: 'clean-demo' });
  const buildDir = path.join(root, '.lingbuilder-build', 'clean-demo');
  const exportDir = path.join(root, 'generated', 'cpp', 'clean-demo');
  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(path.join(buildDir, 'temp.obj'), 'obj', 'utf8');
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, 'clean-demo.sln'), 'sln', 'utf8');

  const result = await service.cleanProjects(['clean-demo']);

  assert.equal(result.ok, true);
  assert.equal(await exists(buildDir), false);
  assert.ok(await exists(path.join(exportDir, 'clean-demo.sln')));
});

async function createTempWorkspace(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-solution-'));
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
