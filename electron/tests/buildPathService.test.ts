import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertDisjointProjectBuildPaths,
  DEFAULT_BUILD_DIRECTORY_TEMPLATE,
  DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE,
  getActiveWorkspaceBuildExcludeDirs,
  isPathExcludedAsBuildOutput,
  isRelativePathInsideDir,
  resolveBuildPathTemplate,
  resolveProjectBuildDirectories,
  setActiveWorkspaceBuildExcludeDirs,
  validateBuildPathTemplate
} from '../src/services/tasks/buildPathService';
import { validateBuildConfiguration } from '../src/services/tasks/buildConfigurationService';

test('缺省模板与历史 .lingbuilder-build/<项目>/<平台>/<配置> 布局逐字节一致', () => {
  const resolved = resolveProjectBuildDirectories({
    workspaceRoot: path.join('T:', 'workspace'),
    projectDirName: 'demo-project',
    platform: 'Win32',
    configuration: 'Debug'
  });
  assert.equal(resolved.buildDir, path.join('T:', 'workspace', '.lingbuilder-build', 'demo-project', 'Win32', 'Debug'));
  assert.equal(resolved.sourceDir, path.join(resolved.buildDir, 'src'));
  assert.equal(resolved.binDir, path.join(resolved.buildDir, 'bin'));
  assert.equal(resolved.objDir, path.join(resolved.buildDir, 'obj'));
  assert.equal(resolved.exportDir, path.join('T:', 'workspace', 'generated', 'cpp', 'demo-project'));
  assert.equal(resolved.relativeBuildDir.replace(/\\/gu, '/'), '.lingbuilder-build/demo-project/Win32/Debug');
});

test('宏按大小写不敏感替换并支持 $(ProjectName)', () => {
  assert.equal(
    resolveBuildPathTemplate('.out/$(ProjectId)/$(platform)/$(CONFIGURATION)', {
      projectDirName: 'demo',
      projectName: '演示项目',
      platform: 'x64',
      configuration: 'Release'
    }),
    '.out/demo/x64/Release'
  );
  assert.equal(
    resolveBuildPathTemplate('输出/$(ProjectName)', {
      projectDirName: 'demo',
      projectName: '演示项目',
      platform: 'Win32',
      configuration: 'Debug'
    }),
    '输出/演示项目'
  );
});

test('模板校验拒绝绝对路径、..、非法字符和保留目录名', () => {
  assert.throws(() => validateBuildPathTemplate('D:\\build', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /工作区相对路径/u);
  assert.throws(() => validateBuildPathTemplate('/var/build', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /工作区相对路径/u);
  assert.throws(() => validateBuildPathTemplate('build/../.lingbuilder', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /\.\./u);
  assert.throws(() => validateBuildPathTemplate('build/a<b', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /非法字符/u);
  assert.throws(() => validateBuildPathTemplate('build/保留. ', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /点或空格/u);
  assert.throws(() => validateBuildPathTemplate('.lingbuilder/out', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /保留目录名/u);
  assert.throws(() => validateBuildPathTemplate('build/$(Bogus)', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), /未知宏/u);
  assert.equal(validateBuildPathTemplate('', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), DEFAULT_BUILD_DIRECTORY_TEMPLATE);
  assert.equal(validateBuildPathTemplate(' out\\\\demo ', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), 'out/demo');
  assert.equal(validateBuildPathTemplate('build/ok/', '构建目录', DEFAULT_BUILD_DIRECTORY_TEMPLATE), 'build/ok');
});

test('构建目录与生成源码目录必须都在工作区内且互不嵌套', () => {
  const workspaceRoot = path.join('T:', 'workspace');
  assert.throws(() => assertDisjointProjectBuildPaths(
    path.join(workspaceRoot, 'build'),
    path.join('T:', 'outside'),
    workspaceRoot
  ), /工作区内/u);
  assert.throws(() => assertDisjointProjectBuildPaths(
    path.join(workspaceRoot, 'build'),
    path.join(workspaceRoot, 'build', 'gen'),
    workspaceRoot
  ), /生成源码目录不能与构建目录重合/u);
  assert.throws(() => assertDisjointProjectBuildPaths(
    path.join(workspaceRoot, 'build'),
    path.join(workspaceRoot, 'build'),
    workspaceRoot
  ), /重合/u);
  assertDisjointProjectBuildPaths(
    path.join(workspaceRoot, 'build', 'demo'),
    path.join(workspaceRoot, 'generated', 'cpp', 'demo'),
    workspaceRoot
  );
});

test('项目模板覆盖工作区默认，空值回退到下一层', () => {
  const resolved = resolveProjectBuildDirectories({
    workspaceRoot: 'T:\\workspace',
    projectDirName: 'demo',
    platform: 'x64',
    configuration: 'Release',
    templates: {
      buildDirectory: 'out/$(ProjectId)',
      generatedSourceDirectory: ' '
    }
  });
  assert.equal(resolved.relativeBuildDir.replace(/\\/gu, '/'), 'out/demo');
  assert.equal(resolved.relativeExportDir.replace(/\\/gu, '/'), DEFAULT_GENERATED_SOURCE_DIRECTORY_TEMPLATE.replace('$(ProjectId)', 'demo'));
});

test('构建配置接受并规范化目录模板，读取旧配置仍返回缺省结构', () => {
  const validated = validateBuildConfiguration({
    mode: 'Debug',
    architecture: 'x64',
    buildDirectory: ' .build\\\\$(ProjectId) ',
    generatedSourceDirectory: 'gen/$(ProjectId)'
  });
  assert.equal(validated.buildDirectory, '.build/$(ProjectId)');
  assert.equal(validated.generatedSourceDirectory, 'gen/$(ProjectId)');
  assert.throws(() => validateBuildConfiguration({ mode: 'Debug', architecture: 'x64', buildDirectory: 'C:/out' }), /工作区相对路径/u);
  const legacy = validateBuildConfiguration({ mode: 'Release', architecture: 'Win32' });
  assert.equal(legacy.buildDirectory, undefined);
  assert.equal(legacy.generatedSourceDirectory, undefined);
});

test('排除目录登记供搜索与索引遍历器共享', () => {
  setActiveWorkspaceBuildExcludeDirs(['.output\\\\demo', 'generated/cpp/demo/']);
  assert.deepEqual(getActiveWorkspaceBuildExcludeDirs(), ['.output/demo', 'generated/cpp/demo']);
  assert.equal(isPathExcludedAsBuildOutput('.output/demo/Win32/Debug/bin/a.exe'), true);
  assert.equal(isPathExcludedAsBuildOutput('generated/cpp/demo/main.cpp'), true);
  assert.equal(isPathExcludedAsBuildOutput('src/demo/main.lcpp'), false);
  assert.equal(isRelativePathInsideDir('generated2/demo', 'generated'), false);
  setActiveWorkspaceBuildExcludeDirs([]);
  assert.equal(isPathExcludedAsBuildOutput('.output/demo/main.cpp'), false);
});

test('自定义目录解析落盘可用且清理保留生成源码目录', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-paths-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const resolved = resolveProjectBuildDirectories({
    workspaceRoot: root,
    projectDirName: 'demo',
    platform: 'Win32',
    configuration: 'Debug',
    templates: { buildDirectory: '.out/$(ProjectId)/$(Platform)', generatedSourceDirectory: 'gen/$(ProjectId)' }
  });
  await fs.mkdir(resolved.binDir, { recursive: true });
  await fs.writeFile(path.join(resolved.binDir, 'LingBuilderPreview.exe'), '', 'utf8');
  await fs.mkdir(resolved.exportDir, { recursive: true });
  await fs.writeFile(path.join(resolved.exportDir, 'main.cpp'), 'int main() { return 0; }', 'utf8');
  assert.equal((await fs.stat(path.join(resolved.binDir, 'LingBuilderPreview.exe'))).isFile(), true);
  assert.equal((await fs.stat(path.join(resolved.exportDir, 'main.cpp'))).isFile(), true);
});
