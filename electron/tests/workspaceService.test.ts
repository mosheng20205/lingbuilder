import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildWorkspaceWindowLaunch, DesktopWorkspaceService, getArgumentValue, resolveWorkspaceDropTarget } from '../electron/workspaceService';

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

test('workspace service accepts a .lbsln through the explicit --workspace argument', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-arg-entry-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.lingbuilder'));
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), '{}');
  const entryPath = path.join(root, 'Demo.lbsln');
  await fs.writeFile(entryPath, JSON.stringify({ schemaVersion: 1, kind: 'lingbuilder-solution', solutionFile: '.lingbuilder/solution.json' }));
  const service = new DesktopWorkspaceService({
    argv: ['LingBuilder.exe', '--workspace', entryPath],
    documentsPath: path.join(root, 'Documents'),
    userDataPath: path.join(root, 'UserData')
  });
  assert.equal(await service.resolveInitialWorkspace(), root);
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

test('workspace service migrates recents, deduplicates, bounds history, and forgets entries', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-recents-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const userDataPath = path.join(root, 'UserData');
  await fs.mkdir(userDataPath, { recursive: true });
  const first = path.join(root, 'first'); await fs.mkdir(first);
  await fs.writeFile(path.join(userDataPath, 'workspace-state.json'), JSON.stringify({ schemaVersion: 1, lastWorkspace: first }));
  const service = new DesktopWorkspaceService({ argv: ['app'], documentsPath: root, userDataPath });
  assert.deepEqual(await service.listRecentWorkspaces(), [first]);
  for (let index = 0; index < 12; index += 1) await service.rememberWorkspace(path.join(root, `workspace-${index}`));
  const recent = await service.listRecentWorkspaces();
  assert.equal(recent.length, 10);
  assert.equal(recent[0], path.join(root, 'workspace-11'));
  await service.rememberWorkspace(recent[1]);
  assert.equal((await service.listRecentWorkspaces())[0], recent[1]);
  await service.forgetWorkspace(recent[1]);
  assert.equal((await service.listRecentWorkspaces()).includes(recent[1]), false);
});

test('workspace service persists window state and validates dropped files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-workspace-drop-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project'); await fs.mkdir(project);
  const source = path.join(project, 'Main.lcpp'); await fs.writeFile(source, '类 Main\n结束类\n');
  const unsupported = path.join(project, 'readme.txt'); await fs.writeFile(unsupported, 'x');
  assert.equal(await resolveWorkspaceDropTarget(project), project);
  assert.equal(await resolveWorkspaceDropTarget(source), project);
  await assert.rejects(resolveWorkspaceDropTarget(unsupported), /不支持/u);
  const service = new DesktopWorkspaceService({ argv: ['app', source], documentsPath: root, userDataPath: path.join(root, 'profile') });
  assert.equal(await service.resolveInitialWorkspace(), project);
  await service.rememberWindowState({ x: 20, y: 30, width: 1200, height: 800, maximized: true });
  assert.deepEqual(await service.getWindowState(), { x: 20, y: 30, width: 1200, height: 800, maximized: true });
});

test('a valid .lbsln opens its workspace and damaged entries are rejected', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-lbsln-open-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, '.lingbuilder'), { recursive: true });
  await fs.writeFile(path.join(root, '.lingbuilder', 'solution.json'), '{}', 'utf8');
  const entryPath = path.join(root, '演示解决方案.lbsln');
  await fs.writeFile(entryPath, JSON.stringify({
    schemaVersion: 1,
    kind: 'lingbuilder-solution',
    solutionFile: '.lingbuilder/solution.json'
  }), 'utf8');
  assert.equal(await resolveWorkspaceDropTarget(entryPath), root);
  await fs.writeFile(entryPath, JSON.stringify({ schemaVersion: 1, kind: 'unknown', solutionFile: '.lingbuilder/solution.json' }), 'utf8');
  await assert.rejects(resolveWorkspaceDropTarget(entryPath), /不是有效/u);
});

test('new workspace windows use an isolated process with an explicit workspace argument', () => {
  const packaged = buildWorkspaceWindowLaunch({ packaged: true, executablePath: 'LingBuilder.exe', mainEntryPath: 'main.cjs', workspacePath: 'C:\\项目' });
  assert.equal(packaged.command, 'LingBuilder.exe');
  assert.deepEqual(packaged.args.slice(-3), ['--workspace', path.resolve('C:\\项目'), '--new-window']);
  const development = buildWorkspaceWindowLaunch({ packaged: false, executablePath: 'electron.exe', mainEntryPath: 'dist/main.cjs', workspacePath: 'C:\\项目' });
  assert.equal(development.args[0], path.resolve('dist/main.cjs'));
});
