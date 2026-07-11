import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dependencyBuildBatches, IncrementalBuildService } from '../src/services/tasks/incrementalBuildService';

test('incremental cache hits only for identical inputs with every output present', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-incremental-'));
  const service = new IncrementalBuildService(root);
  const output = path.join(root, '.lingbuilder-build', 'app', 'app.exe');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, 'binary');
  const first = service.fingerprint({ source: 'A', configuration: 'Debug' });
  await service.record('app/Debug', first, [output]);
  assert.equal(await service.isFresh('app/Debug', first), true);
  assert.equal(await service.isFresh('app/Debug', service.fingerprint({ source: 'B', configuration: 'Debug' })), false);
  await fs.rm(output);
  assert.equal(await service.isFresh('app/Debug', first), false);
});

test('incremental cache persists, invalidates selected entries, and rejects outside outputs', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-incremental-'));
  const output = path.join(root, 'inside.exe'); await fs.writeFile(output, 'x');
  const first = new IncrementalBuildService(root); const fingerprint = first.fingerprint({ b: 2, a: 1 });
  assert.equal(fingerprint, first.fingerprint({ a: 1, b: 2 }));
  await first.record('app', fingerprint, [output]);
  const reloaded = new IncrementalBuildService(root);
  assert.equal(await reloaded.isFresh('app', fingerprint), true);
  await reloaded.invalidate(['app']);
  assert.equal(await reloaded.isFresh('app', fingerprint), false);
  await reloaded.record('outside', fingerprint, [path.join(root, '..', 'outside.exe')]);
  assert.equal(await reloaded.isFresh('outside', fingerprint), false);
});

test('dependency scheduler creates parallel batches while preserving prerequisites', () => {
  const batches = dependencyBuildBatches([
    { id: 'core', references: [] }, { id: 'util', references: [] },
    { id: 'service', references: ['core'] }, { id: 'ui', references: ['core', 'util'] },
    { id: 'app', references: ['service', 'ui'] }
  ]).map(batch => batch.map(project => project.id));
  assert.deepEqual(batches, [['core', 'util'], ['service', 'ui'], ['app']]);
  assert.throws(() => dependencyBuildBatches([{ id: 'a', references: ['b'] }, { id: 'b', references: ['a'] }]), /循环/u);
});
