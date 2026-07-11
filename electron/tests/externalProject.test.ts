import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { ExternalProjectService, validateProperties } from '../src/services/solution/externalProjectService';

test('external project inspection recognizes CMake and MSBuild metadata inside the workspace', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-import-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'cmake')); await fs.writeFile(path.join(root, 'cmake', 'CMakeLists.txt'), 'cmake_minimum_required(VERSION 3.20)\nproject(SpaceGame LANGUAGES CXX)\n');
  await fs.mkdir(path.join(root, 'msbuild')); await fs.writeFile(path.join(root, 'msbuild', 'Native.vcxproj'), '<Project><PropertyGroup><RootNamespace>NativeEngine</RootNamespace></PropertyGroup></Project>');
  const service = new ExternalProjectService(root);
  const cmake = await service.inspect('cmake'); const msbuild = await service.inspect('msbuild/Native.vcxproj');
  assert.equal(cmake.type, 'external-cmake'); assert.equal(cmake.name, 'SpaceGame'); assert.equal(cmake.projectFile, 'cmake/CMakeLists.txt');
  assert.equal(msbuild.type, 'external-msbuild'); assert.equal(msbuild.name, 'NativeEngine');
  await assert.rejects(service.inspect('../outside.vcxproj'), /越界|workspace|工作区/u);
});

test('external CMake and MSBuild properties materially change controlled build commands', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-import-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'cmake')); await fs.writeFile(path.join(root, 'cmake', 'CMakeLists.txt'), 'project(App)');
  await fs.mkdir(path.join(root, 'msbuild')); await fs.writeFile(path.join(root, 'msbuild', 'App.vcxproj'), '<Project/>');
  const calls: Array<{ command: string; args: readonly string[] }> = [];
  const service = new ExternalProjectService(root, async (command, args) => { calls.push({ command, args: [...args] }); return { exitCode: 0, stdout: 'ok', stderr: '' }; });
  const cmake = await service.inspect('cmake'); cmake.buildProperties = { configuration: 'Release', architecture: 'x64', additionalArguments: ['-DUSE_UI=ON'] };
  assert.equal((await service.build(cmake)).ok, true);
  assert.ok(calls[0].args.includes('x64')); assert.ok(calls[0].args.includes('-DUSE_UI=ON')); assert.ok(calls[1].args.includes('Release'));
  const msbuild = await service.inspect('msbuild/App.vcxproj'); msbuild.buildProperties = { configuration: 'Debug', architecture: 'Win32', additionalArguments: ['/t:Build'] };
  await service.build(msbuild);
  assert.ok(calls[2].args.includes('/p:Configuration=Debug')); assert.ok(calls[2].args.includes('/p:Platform=Win32'));
  assert.throws(() => validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: ['bad\narg'] }), /参数无效/u);
});

test('external builds forward cancellation to every controlled child process', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-import-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'cmake')); await fs.writeFile(path.join(root, 'cmake', 'CMakeLists.txt'), 'project(App)');
  const seenSignals: Array<AbortSignal | undefined> = [];
  const service = new ExternalProjectService(root, async (_command, _args, _cwd, signal) => {
    seenSignals.push(signal); return { exitCode: 0, stdout: '', stderr: '' };
  });
  const project = await service.inspect('cmake'); const controller = new AbortController();
  await service.build(project, controller.signal);
  assert.equal(seenSignals.length, 2);
  assert.equal(seenSignals.every(signal => signal === controller.signal), true);
});
