import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { createProjectFilePersistenceService, createProjectFileVersion, ProjectFileConflictError, type ProjectFilePersistenceFileSystem } from '../src/services/files/projectFilePersistenceService';
import { HotExitRecoveryService } from '../src/services/files/hotExitRecoveryService';

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
  await service.write({ schemaVersion: 1, projectId: 'demo', savedAt: '2026-07-11T00:00:00.000Z', files: { 'src/Main.lcpp': '未保存' } });
  assert.equal((await service.read('demo'))?.files['src/Main.lcpp'], '未保存');
  assert.deepEqual((await fs.readdir(path.join(root, '.lingbuilder', 'recovery'))).filter(name => name.endsWith('.tmp')), []);
  await service.delete('demo');
  assert.equal(await service.read('demo'), null);
  await assert.rejects(service.read('../escape'), /不安全/u);
});
