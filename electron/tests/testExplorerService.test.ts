import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { findCMakeTool, TestExplorerService } from '../src/services/testing/testExplorerService';

const exec = promisify(execFile);
test('test explorer discovers and runs real Node TypeScript tests with pass, fail and skip results', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-tests-node-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const directory = path.join(root, 'tests'); await fs.mkdir(directory);
  await fs.writeFile(path.join(directory, 'sample.test.ts'), `import test from 'node:test';\nimport assert from 'node:assert/strict';\ntest('中文通过', () => assert.equal(1 + 1, 2));\ntest('中文失败', () => assert.equal(1, 2));\ntest.skip('中文跳过', () => {});\n`);
  const service = new TestExplorerService(root); const discovered = await service.discover(); assert.deepEqual(discovered.map(item => item.name), ['中文通过', '中文失败', '中文跳过']);
  const passed = await service.run(discovered.find(item => item.name === '中文通过')!.id); assert.equal(passed.state, 'passed', `${passed.stdout}\n${passed.stderr}`);
  const failed = await service.run(discovered.find(item => item.name === '中文失败')!.id); assert.equal(failed.state, 'failed', `${failed.stdout}\n${failed.stderr}`); assert.match(`${failed.stdout}\n${failed.stderr}`, /test failed|ERR_ASSERTION|测试运行失败|fail 1/iu);
  assert.equal((await service.run(discovered.find(item => item.name === '中文跳过')!.id)).state, 'skipped'); assert.equal(service.debugConfiguration(discovered[0].id).adapter, 'node-inspector');
});

test('test explorer compiles, discovers and runs real C++ tests through CTest JSON v1', { timeout: 120_000 }, async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-tests-cpp-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const build = path.join(root, 'build');
  await fs.writeFile(path.join(root, 'test.cpp'), `#include <string>\nint main(int argc, char** argv) { return argc > 1 && std::string(argv[1]) == "pass" ? 0 : 7; }\n`);
  await fs.writeFile(path.join(root, 'CMakeLists.txt'), `cmake_minimum_required(VERSION 3.20)\nproject(LingBuilderTest LANGUAGES CXX)\nenable_testing()\nadd_executable(sample_test test.cpp)\nadd_test(NAME Cpp.Pass COMMAND sample_test pass)\nadd_test(NAME Cpp.Fail COMMAND sample_test fail)\n`);
  const cmake = await findCMakeTool('cmake'); await exec(cmake, ['-S', root, '-B', build], { windowsHide: true, timeout: 60_000 }); await exec(cmake, ['--build', build, '--config', 'Debug'], { windowsHide: true, timeout: 60_000 });
  const service = new TestExplorerService(root); const discovered = (await service.discover()).filter(item => item.kind === 'ctest'); assert.deepEqual(discovered.map(item => item.name), ['Cpp.Fail', 'Cpp.Pass']);
  assert.equal((await service.run(discovered.find(item => item.name === 'Cpp.Pass')!.id)).state, 'passed'); assert.equal((await service.run(discovered.find(item => item.name === 'Cpp.Fail')!.id)).state, 'failed'); const debug = service.debugConfiguration(discovered[0].id); assert.equal(debug.adapter, 'lldb-dap'); assert.match(debug.program, /sample_test(?:\.exe)?$/iu);
});

test('test discovery bounds output and rejects stale ids', async t => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-tests-safe-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const service = new TestExplorerService(root); await service.discover(); await assert.rejects(service.run('missing'), /不存在|过期/u); });
