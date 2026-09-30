import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { resolveProtobufSdkLocation } from '../src/services/modules/protobufSdkLocation';

/** 保存/恢复三个相关环境变量与 process.argv[1]，测试之间互不污染。 */
async function withSdkEnvironment<T>(
  environment: Record<string, string | undefined>,
  entryArgument: string | undefined,
  run: () => Promise<T>
): Promise<T> {
  const keys = ['LINGBUILDER_PROTOBUF_SDK_ROOT', 'LINGBUILDER_BUNDLED_PROTOBUF_SDK', 'LINGBUILDER_RESOURCE_ROOT'];
  const previousEnv = new Map(keys.map(key => [key, process.env[key]]));
  const previousArgv1 = process.argv[1];
  try {
    for (const key of keys) {
      if (environment[key] === undefined) delete process.env[key];
      else process.env[key] = environment[key];
    }
    if (entryArgument === undefined) delete process.argv[1];
    else process.argv[1] = entryArgument;
    return await run();
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    if (previousArgv1 === undefined) delete process.argv[1];
    else process.argv[1] = previousArgv1;
  }
}

async function makeProtobufSdk(root: string): Promise<string> {
  await fs.mkdir(path.join(root, 'bin'), { recursive: true });
  await fs.writeFile(path.join(root, 'runtime-manifest.json'), '{"sdkVersion":"27.3.0"}', 'utf8');
  return root;
}

test('LINGBUILDER_PROTOBUF_SDK_ROOT 显式指定时优先且不做存在性检查', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-configured-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const configured = path.join(root, '自定义SDK');
  await withSdkEnvironment({ LINGBUILDER_PROTOBUF_SDK_ROOT: configured }, undefined, async () => {
    const location = await resolveProtobufSdkLocation(path.join(root, '任意'));
    assert.equal(location.origin, 'configured');
    assert.equal(location.root, path.resolve(configured));
  });
});

test('工作区自备副本优先于 IDE 随包源', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-workspace-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const workspace = await makeProtobufSdk(path.join(root, '工作区', '.lingbuilder', 'toolchains', 'protobuf'));
  const bundled = await makeProtobufSdk(path.join(root, '随包', 'protobuf'));
  await withSdkEnvironment({ LINGBUILDER_BUNDLED_PROTOBUF_SDK: bundled }, undefined, async () => {
    // 从工作区深层目录（默认构建目录深度）解析，命中工作区副本。
    const buildDir = path.join(path.dirname(path.dirname(workspace)), '构建', 'Demo项目', 'Debug');
    const location = await resolveProtobufSdkLocation(buildDir);
    assert.equal(location.origin, 'workspace');
    assert.equal(path.resolve(location.root), path.resolve(workspace));
  });
});

test('工作区缺失时回退 LINGBUILDER_BUNDLED_PROTOBUF_SDK 指定的随包源', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-bundled-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundled = await makeProtobufSdk(path.join(root, '随包', 'protobuf'));
  const emptyWorkspace = path.join(root, '空工作区');
  await fs.mkdir(path.join(emptyWorkspace, '.lingbuilder'), { recursive: true });
  await withSdkEnvironment({ LINGBUILDER_BUNDLED_PROTOBUF_SDK: bundled }, undefined, async () => {
    const location = await resolveProtobufSdkLocation(emptyWorkspace);
    assert.equal(location.origin, 'bundled');
    assert.equal(path.resolve(location.root), path.resolve(bundled));
  });
});

test('随包源可经 LINGBUILDER_RESOURCE_ROOT 推导（打包 default-workspace / 开发 third_party）', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-resource-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const emptyWorkspace = path.join(root, '空工作区');
  await fs.mkdir(path.join(emptyWorkspace, '.lingbuilder'), { recursive: true });

  // 打包形态：<resources>/default-workspace/.lingbuilder/toolchains/protobuf。
  const packagedSdk = await makeProtobufSdk(path.join(root, 'resources', 'default-workspace', '.lingbuilder', 'toolchains', 'protobuf'));
  await withSdkEnvironment({ LINGBUILDER_RESOURCE_ROOT: path.join(root, 'resources') }, undefined, async () => {
    const location = await resolveProtobufSdkLocation(emptyWorkspace);
    assert.equal(location.origin, 'bundled');
    assert.equal(path.resolve(location.root), path.resolve(packagedSdk));
  });

  // 开发形态：<仓库 electron>/third_party/protobuf。
  const devSdk = await makeProtobufSdk(path.join(root, 'electron', 'third_party', 'protobuf'));
  await withSdkEnvironment({ LINGBUILDER_RESOURCE_ROOT: path.join(root, 'electron') }, undefined, async () => {
    const location = await resolveProtobufSdkLocation(emptyWorkspace);
    assert.equal(location.origin, 'bundled');
    assert.equal(path.resolve(location.root), path.resolve(devSdk));
  });
});

test('独立 CLI 无环境变量时从入口脚本位置向上找到随包源', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-walkup-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const bundled = await makeProtobufSdk(path.join(root, 'resources', 'default-workspace', '.lingbuilder', 'toolchains', 'protobuf'));
  const emptyWorkspace = path.join(root, '工作区');
  await fs.mkdir(emptyWorkspace, { recursive: true });
  const cliEntry = path.join(root, 'resources', 'app', 'dist', 'cli.cjs');
  await withSdkEnvironment({}, cliEntry, async () => {
    const location = await resolveProtobufSdkLocation(emptyWorkspace);
    assert.equal(location.origin, 'bundled');
    assert.equal(path.resolve(location.root), path.resolve(bundled));
  });
});

test('工作区与随包源全部缺失时维持工作区期望路径，由 SDK 校验给出中文诊断', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-sdk-loc-missing-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const buildDir = path.join(root, '工作区', '.lingbuilder-build', 'Demo', 'win32', 'Debug');
  await fs.mkdir(buildDir, { recursive: true });
  await fs.mkdir(path.join(root, '工作区', '.lingbuilder'), { recursive: true });
  await withSdkEnvironment({}, undefined, async () => {
    const location = await resolveProtobufSdkLocation(buildDir);
    assert.equal(location.origin, 'workspace-missing');
    assert.equal(path.resolve(location.root), path.resolve(path.join(root, '工作区', '.lingbuilder', 'toolchains', 'protobuf')));
  });
});
