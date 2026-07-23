import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createProjectFilePersistenceService, createProjectFileVersion, ProjectFileConflictError, type ProjectFilePersistenceFileSystem } from '../src/services/files/projectFilePersistenceService';
import { HotExitRecoveryService } from '../src/services/files/hotExitRecoveryService';
import {
  isWorkspaceSaveEcho,
  type WorkspaceSaveEchoSnapshot
} from '../src/services/files/workspaceSaveEchoService';

test('own save watcher echo preserves edits made while the request is in flight', () => {
  const snapshot: WorkspaceSaveEchoSnapshot = {
    projectId: 'demo',
    files: { 'src/Main.lcpp': 'V1' },
    designerPath: '.lingbuilder/window-designer.json',
    designerSnapshot: '{"title":"V1"}'
  };
  const snapshots = new Map([[1, snapshot]]);
  let localContent = 'V2';
  let localDirty = true;
  let confirmations = 0;
  const diskContent = 'V1';

  const ownEcho = isWorkspaceSaveEcho(snapshots.values(), {
    projectId: 'demo',
    filePath: 'src/Main.lcpp',
    content: diskContent,
    kind: 'source'
  });
  if (!ownEcho && localDirty) confirmations += 1;
  if (!ownEcho) {
    localContent = diskContent;
    localDirty = false;
  }

  assert.equal(ownEcho, true);
  assert.equal(confirmations, 0);
  assert.equal(localContent, 'V2');
  assert.equal(localDirty, true);
  assert.equal(isWorkspaceSaveEcho(snapshots.values(), {
    projectId: 'demo',
    filePath: '.lingbuilder/window-designer.json',
    content: '{"title":"V1"}',
    kind: 'designer'
  }), true);
  assert.equal(isWorkspaceSaveEcho(snapshots.values(), {
    projectId: 'another-project',
    filePath: 'src/Main.lcpp',
    content: 'V1',
    kind: 'source'
  }), false);
});

test('completed or failed saves cannot suppress a later real external rollback', () => {
  const snapshots = new Map<number, WorkspaceSaveEchoSnapshot>([[1, {
    projectId: 'demo',
    files: { 'src/Main.lcpp': 'V1' },
    designerPath: '.lingbuilder/window-designer.json',
    designerSnapshot: '{"title":"V1"}'
  }]]);
  snapshots.delete(1);
  assert.equal(isWorkspaceSaveEcho(snapshots.values(), {
    projectId: 'demo',
    filePath: 'src/Main.lcpp',
    content: 'V1',
    kind: 'source'
  }), false);
  assert.equal(isWorkspaceSaveEcho(snapshots.values(), {
    projectId: 'demo',
    filePath: '.lingbuilder/window-designer.json',
    content: '{"title":"V1"}',
    kind: 'designer'
  }), false);
});

test('rejects stale versions without modifying files', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-persist-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const target = path.join(root, 'Main.lcpp');
  await fs.writeFile(target, '磁盘新版');
  await assert.rejects(createProjectFilePersistenceService().writeAll([{
    targetPath: target, bytes: Buffer.from('本地编辑'), expectedVersion: createProjectFileVersion(Buffer.from('旧版'))
  }]), (error: unknown) => error instanceof ProjectFileConflictError);
  assert.equal(await fs.readFile(target, 'utf8'), '磁盘新版');
});

test('atomically writes a complete batch', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-persist-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, 'a.lcpp');
  const second = path.join(root, 'nested', 'b.lcpp');
  await fs.writeFile(first, 'a0');
  const result = await createProjectFilePersistenceService().writeAll([
    { targetPath: first, bytes: Buffer.from('a1'), expectedVersion: createProjectFileVersion(Buffer.from('a0')) },
    { targetPath: second, bytes: Buffer.from('b1') }
  ]);
  assert.equal(await fs.readFile(first, 'utf8'), 'a1');
  assert.equal(await fs.readFile(second, 'utf8'), 'b1');
  assert.equal(result.versions[path.resolve(first)], createProjectFileVersion(Buffer.from('a1')));
});

test('rolls earlier replacements back when a later rename fails', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-persist-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const first = path.join(root, 'a.lcpp');
  const second = path.join(root, 'b.lcpp');
  await fs.writeFile(first, 'a0'); await fs.writeFile(second, 'b0');
  let replacements = 0;
  const failingFs: ProjectFilePersistenceFileSystem = {
    readFile: filePath => fs.readFile(filePath), writeFile: (filePath, data) => fs.writeFile(filePath, data),
    mkdir: (directoryPath, options) => fs.mkdir(directoryPath, options), rm: (filePath, options) => fs.rm(filePath, options),
    rename: async (sourcePath, targetPath) => {
      if (sourcePath.endsWith('.tmp') && ++replacements === 2) throw new Error('simulated rename failure');
      await fs.rename(sourcePath, targetPath);
    }
  };
  await assert.rejects(createProjectFilePersistenceService(failingFs).writeAll([
    { targetPath: first, bytes: Buffer.from('a1') }, { targetPath: second, bytes: Buffer.from('b1') }
  ]), /simulated rename failure/);
  assert.equal(await fs.readFile(first, 'utf8'), 'a0');
  assert.equal(await fs.readFile(second, 'utf8'), 'b0');
});

test('hot exit recovery is atomic, restorable, discardable, and path-safe', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-recovery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new HotExitRecoveryService(root);
  const designerProject = {
    schemaVersion: 2 as const,
    id: 'demo',
    name: '未保存设计器',
    windows: [{
      id: 'main',
      fileName: '主窗口.xml',
      className: '主窗口',
      title: '未保存标题',
      width: 640,
      height: 480,
      background: '#202028',
      description: '',
      controls: []
    }]
  };
  await service.write({
    schemaVersion: 1,
    projectId: 'demo',
    savedAt: '2026-07-11T00:00:00.000Z',
    files: { 'src/Main.lcpp': '未保存' },
    designerProject
  });
  const recovered = await service.read('demo');
  assert.equal(recovered?.files['src/Main.lcpp'], '未保存');
  assert.deepEqual(recovered?.designerProject, designerProject);
  assert.deepEqual((await fs.readdir(path.join(root, '.lingbuilder', 'recovery'))).filter(name => name.endsWith('.tmp')), []);
  await service.delete('demo');
  assert.equal(await service.read('demo'), null);
  await assert.rejects(service.read('../escape'), /不安全/u);
});
