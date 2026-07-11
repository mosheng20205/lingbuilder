import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildConfigurationService, getBuildCompilerFlags, getBuildOutputSegment, getModuleTargetId, validateBuildConfiguration } from '../src/services/tasks/buildConfigurationService';

test('build configuration persists every Debug/Release and Win32/x64 combination atomically', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-config-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const service = new BuildConfigurationService(root);
  assert.deepEqual(await service.read(), { schemaVersion: 1, mode: 'Debug', architecture: 'Win32' });
  for (const mode of ['Debug', 'Release'] as const) for (const architecture of ['Win32', 'x64'] as const) {
    assert.deepEqual(await service.write({ mode, architecture }), { schemaVersion: 1, mode, architecture });
    assert.deepEqual(await service.read(), { schemaVersion: 1, mode, architecture });
  }
  assert.deepEqual((await fs.readdir(path.join(root, '.lingbuilder'))).filter(name => name.endsWith('.tmp')), []);
  assert.throws(() => validateBuildConfiguration({ mode: 'Fast', architecture: 'arm64' }), /有效组合/u);
});

test('build configuration changes compiler flags, output paths, and module target IDs', () => {
  const debug = { schemaVersion: 1, mode: 'Debug', architecture: 'Win32' } as const;
  const release = { schemaVersion: 1, mode: 'Release', architecture: 'x64' } as const;
  assert.deepEqual(getBuildCompilerFlags(debug, 'msvc'), ['/Od', '/Zi', '/D_DEBUG', '/RTC1', '/MDd']);
  assert.deepEqual(getBuildCompilerFlags(release, 'g++'), ['-m64', '-O2', '-DNDEBUG']);
  assert.equal(getBuildOutputSegment(release), path.join('x64', 'Release'));
  assert.equal(getModuleTargetId(debug), 'windows-msvc-win32');
  assert.equal(getModuleTargetId(release), 'windows-msvc-x64');
});
