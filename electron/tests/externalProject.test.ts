import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  describeExternalCommandNotFound,
  ExternalProjectService,
  resolveExecutableNameParts,
  resolveMsBuildCommandAsync,
  validateProperties
} from '../src/services/solution/externalProjectService';

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

test('Windows DLL builds require both the DLL and import library artifacts', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-dll-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src', 'demo'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'demo', 'demo.vcxproj'), '<Project/>');
  const project = {
    id: 'demo', name: 'Demo DLL', type: 'windows-dll' as const,
    projectFile: 'src/demo/demo.vcxproj', sourceRoot: 'src/demo', configRoot: 'src/demo',
    designerPath: '', references: [],
    buildProperties: { configuration: 'Debug' as const, architecture: 'Win32' as const, additionalArguments: [] }
  };
  const service = new ExternalProjectService(root, async (_command, args, cwd) => {
    assert.ok(args.includes('/p:Configuration=Debug'));
    assert.ok(args.includes('/p:Platform=Win32'));
    const outputDir = path.join(cwd, 'Win32', 'Debug', 'bin');
    await fs.writeFile(path.join(outputDir, 'demo.dll'), 'dll');
    await fs.writeFile(path.join(outputDir, 'demo.lib'), 'lib');
    return { exitCode: 0, stdout: 'built', stderr: '' };
  });
  const result = await service.build(project);
  assert.equal(result.ok, true);
  assert.deepEqual(result.artifacts?.map(file => path.basename(file)).sort(), ['demo.dll', 'demo.lib']);

  await fs.rm(path.join(root, 'src', 'demo', 'Win32'), { recursive: true, force: true });
  const missingArtifacts = new ExternalProjectService(root, async () => ({ exitCode: 0, stdout: 'built', stderr: '' }));
  const failed = await missingArtifacts.build(project);
  assert.equal(failed.ok, false);
  assert.match(failed.stderr, /未找到 DLL 或导入库/u);
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

test('resolveExecutableNameParts normalizes, defaults and rejects illegal names', () => {
  assert.deepEqual(resolveExecutableNameParts(undefined), { baseName: 'LingBuilderPreview', fileName: 'LingBuilderPreview.exe' });
  assert.deepEqual(resolveExecutableNameParts(''), { baseName: 'LingBuilderPreview', fileName: 'LingBuilderPreview.exe' });
  assert.deepEqual(resolveExecutableNameParts('  灵集应用市场.exe '), { baseName: '灵集应用市场', fileName: '灵集应用市场.exe' });
  assert.deepEqual(resolveExecutableNameParts('My.App'), { baseName: 'My.App', fileName: 'My.App.exe' });
  assert.throws(() => resolveExecutableNameParts('a/b.exe'), /不合法/u);
  assert.throws(() => resolveExecutableNameParts('a'+String.fromCharCode(92)+'b'), /不合法/u);
  assert.throws(() => resolveExecutableNameParts(':'.repeat(65)), /不合法/u);
});

test('validateProperties accepts requireAdministrator boolean and rejects other types', () => {
  validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], requireAdministrator: true });
  validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], requireAdministrator: false });
  assert.throws(() => validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], requireAdministrator: 'yes' as unknown as boolean }), /requireAdministrator/u);
});

test('validateProperties accepts an optional executableName and rejects illegal values', () => {
  validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], executableName: '灵集应用市场' });
  validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], executableName: '' });
  assert.throws(() => validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], executableName: 'bad<name' }), /可执行文件名不合法/u);
  assert.throws(() => validateProperties({ configuration: 'Debug', architecture: 'Win32', additionalArguments: [], executableName: 42 as unknown as string }), /项目可执行文件名无效/u);
});

test('missing external build commands produce Chinese repair guidance instead of raw ENOENT', () => {
  const msbuildMessage = describeExternalCommandNotFound('msbuild');
  assert.match(msbuildMessage, /未找到 MSBuild\.exe/u);
  assert.match(msbuildMessage, /LINGBUILDER_MSBUILD_PATH/u);
  const cmakeMessage = describeExternalCommandNotFound('cmake');
  assert.match(cmakeMessage, /未找到 cmake/u);
  assert.match(describeExternalCommandNotFound('C:\\tools\\custom.exe'), /custom\.exe/u);
});

test('msbuild resolution honors LINGBUILDER_MSBUILD_PATH before any filesystem scan', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-msbuild-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const fakeMsBuild = path.join(root, 'MSBuild.exe');
  await fs.writeFile(fakeMsBuild, 'stub');
  const previous = process.env.LINGBUILDER_MSBUILD_PATH;
  process.env.LINGBUILDER_MSBUILD_PATH = fakeMsBuild;
  t.after(() => {
    if (previous === undefined) delete process.env.LINGBUILDER_MSBUILD_PATH;
    else process.env.LINGBUILDER_MSBUILD_PATH = previous;
  });
  assert.equal(await resolveMsBuildCommandAsync(), fakeMsBuild);
});
