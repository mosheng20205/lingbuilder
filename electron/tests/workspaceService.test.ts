import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { DesktopWorkspaceService, getArgumentValue } from '../electron/workspaceService';

test('workspace service prefers --workspace and remembers it', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-arg-'));
  const target = path.join(root, 'target');
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', target],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });

  assert.equal(await service.resolveInitialWorkspace(), target);
  const state = JSON.parse(await fs.readFile(path.join(root, 'UserData', 'workspace-state.json'), 'utf8'));
  assert.equal(state.lastWorkspace, target);
  assert.equal(getArgumentValue(['app', '--workspace=E:\\项目'], '--workspace'), 'E:\\项目');
});

test('workspace seed copies missing files and never overwrites user changes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-seed-'));
  const source = path.join(root, 'seed');
  const documents = path.join(root, 'Documents');
  const target = path.join(documents, 'LingBuilder', '示例工作区');
  await fs.mkdir(path.join(source, 'src'), { recursive: true });
  await fs.writeFile(path.join(source, 'src', 'Main.lcpp'), '初始内容', 'utf8');

  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe'],
    documentsPath: documents,
    userDataPath: path.join(root, 'UserData'),
    defaultWorkspaceSource: source,
    seedVersion: '2.0.0'
  });

  assert.equal(await service.resolveInitialWorkspace(), target);
  await fs.writeFile(path.join(target, 'src', 'Main.lcpp'), '用户修改', 'utf8');
  await service.seedDefaultWorkspace();
  assert.equal(await fs.readFile(path.join(target, 'src', 'Main.lcpp'), 'utf8'), '用户修改');
  const marker = JSON.parse(await fs.readFile(path.join(target, '.lingbuilder', 'seed.json'), 'utf8'));
  assert.equal(marker.seedVersion, '2.0.0');
});
