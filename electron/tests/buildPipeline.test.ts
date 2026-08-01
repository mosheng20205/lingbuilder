import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { BuildGraphCancelledError, BuildGraphValidationError, describeArtifact, executeBuildGraph, orderBuildSteps } from '../src/services/build/buildGraph';
import { BuildPipelineService, fingerprintBuildSteps, validateCodeGeneratorDeclaration } from '../src/services/build/buildPipeline';
import { createBuildStepProviderRegistry, DuplicateBuildProviderError, UnknownBuildProviderError } from '../src/services/build/providerRegistry';
import { createProtobufCodeGeneratorProvider } from '../src/services/build/protobufProvider';
import type { BuildStep, BuildStepProvider } from '../src/services/build/types';
import type { ModuleCodeGeneratorContribution } from '../src/services/modules/types';
import { PROTOBUF_SDK_VERSION, PROTOBUF_SDK_REQUIRED_FILES, createProtobufSdkManifest } from '../src/services/modules/protobufSdk';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { MODULE_BINDING_TYPE_LABELS } from '../src/services/modules/bindingValueType';
import { generateProtobufRuntime } from '../src/services/windowDesigner/protobufRuntime';
import { runProjectCodeGenerators } from '../src/services/build/projectCodeGeneratorService';
import { PROTOBUF_MODULE } from '../src/services/modules/protobufModule';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import { readModuleDocumentation } from '../src/services/modules/moduleDocumentationService';
import { areLingCppTypesCompatible, inferLingCppExpressionType, normalizeLingCppValueType } from '../src/services/lingCpp/expressionTypeService';

function provider(run: BuildStepProvider['run'] = async () => undefined): BuildStepProvider {
  return { id: 'test.provider', version: '1.0.0', run };
}

function step(id: string, overrides: Partial<BuildStep> = {}): BuildStep {
  return {
    id,
    provider: 'test.provider',
    providerVersion: '1.0.0',
    phase: 'generate',
    dependsOn: [],
    inputs: [],
    outputs: [{ path: `generated/${id}.txt`, kind: 'content' }],
    options: {},
    ...overrides
  };
}

test('build provider registry rejects duplicate and unknown providers', () => {
  const registry = createBuildStepProviderRegistry([provider()]);
  assert.throws(() => registry.register(provider()), DuplicateBuildProviderError);
  assert.throws(() => registry.get('missing.provider'), UnknownBuildProviderError);
});

test('build graph orders dependencies and diagnoses cycles and path escapes', () => {
  const registry = createBuildStepProviderRegistry([provider()]);
  const ordered = orderBuildSteps([
    step('second', { dependsOn: ['first'] }),
    step('first')
  ], registry, 'C:/build');
  assert.deepEqual(ordered.map(item => item.id), ['first', 'second']);
  assert.throws(() => orderBuildSteps([
    step('a', { dependsOn: ['b'] }),
    step('b', { dependsOn: ['a'], outputs: [{ path: 'generated/b.txt', kind: 'content' }] })
  ], registry, 'C:/build'), BuildGraphValidationError);
  assert.throws(() => orderBuildSteps([step('escape', { outputs: [{ path: '../outside.txt', kind: 'content' }] })], registry, 'C:/build'), /越界|工作区/u);
  assert.throws(() => orderBuildSteps([step('overwrite', { inputs: [{ path: 'source.txt' }], outputs: [{ path: 'source.txt', kind: 'content' }] })], registry, 'C:/build', 'C:/build'), /覆盖输入|源码/u);
  assert.throws(() => orderBuildSteps([step('no-output', { outputs: [] })], registry, 'C:/build'), /缺少产物声明|输入\/输出无效/u);
});

test('build graph reports progress and rolls back output on failure or cancellation', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-graph-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'generated', 'write.txt');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, 'before', 'utf8');
  const reports: number[] = [];
  const failing = createBuildStepProviderRegistry([provider(async (current, context) => {
    await fs.writeFile(path.join(context.outputRoot, current.outputs[0].path), 'after', 'utf8');
    throw new Error('intentional failure');
  })]);
  await assert.rejects(executeBuildGraph([step('write')], failing, {
    workspaceRoot: root, projectRoot: root, outputRoot: root,
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc' },
    report: progress => reports.push(progress)
  }), /intentional failure/u);
  assert.equal(await fs.readFile(output, 'utf8'), 'before');
  assert.ok(reports.some(progress => progress >= 0));

  const controller = new AbortController();
  const cancelling = createBuildStepProviderRegistry([provider(async (current, context) => {
    await fs.writeFile(path.join(context.outputRoot, current.outputs[0].path), 'cancelled', 'utf8');
    controller.abort();
  })]);
  await assert.rejects(executeBuildGraph([step('write')], cancelling, {
    workspaceRoot: root, projectRoot: root, outputRoot: root,
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc' }, signal: controller.signal
  }), BuildGraphCancelledError);
  assert.equal(await fs.readFile(output, 'utf8'), 'before');
});

test('build graph rejects providers that omit a declared output and rolls back', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-missing-output-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const output = path.join(root, 'generated', 'missing.txt');
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, 'before', 'utf8');
  const registry = createBuildStepProviderRegistry([provider(async () => ({ logs: ['provider did not emit output'] }))]);
  await assert.rejects(executeBuildGraph([step('missing')], registry, {
    workspaceRoot: root,
    projectRoot: root,
    outputRoot: root,
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc' }
  }), /未生成声明产物/u);
  assert.equal(await fs.readFile(output, 'utf8'), 'before');
});

test('build fingerprints include source bytes, provider version, options and target', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-build-fingerprint-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'input.proto'), 'message A {}', 'utf8');
  const current = step('fingerprint', {
    inputs: [{ path: 'input.proto' }],
    options: { optimize: true }
  });
  const base = { workspaceRoot: root, projectRoot: root, target: { platform: 'windows' as const, arch: 'x64' as const, toolchain: 'msvc' as const } };
  const first = await fingerprintBuildSteps([current], base);
  const changedOption = await fingerprintBuildSteps([{ ...current, options: { optimize: false } }], base);
  const changedTarget = await fingerprintBuildSteps([current], { ...base, target: { ...base.target, arch: 'win32' } });
  await fs.writeFile(path.join(root, 'input.proto'), 'message B {}', 'utf8');
  const changedInput = await fingerprintBuildSteps([current], base);
  assert.notEqual(first, changedOption);
  assert.notEqual(first, changedTarget);
  assert.notEqual(first, changedInput);
});

test('codeGenerators manifest validation remains declarative and target-bound', () => {
  const valid: ModuleCodeGeneratorContribution = {
    id: 'test.generator', provider: 'test.provider', version: '1.0.0',
    inputs: { include: ['**/*.proto'] },
    outputs: [{ path: 'generated/out.pb', kind: 'descriptor' }],
    options: { outputDirectory: 'generated' }, targetIds: ['windows-msvc-x64']
  };
  assert.doesNotThrow(() => validateCodeGeneratorDeclaration(valid, { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' }));
  assert.throws(() => validateCodeGeneratorDeclaration({ ...valid, outputs: [{ path: '../out.pb', kind: 'descriptor' }] }, { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' }), BuildGraphValidationError);
  assert.throws(() => validateCodeGeneratorDeclaration(valid, { platform: 'windows', arch: 'win32', toolchain: 'msvc', id: 'windows-msvc-win32' }), BuildGraphValidationError);
  assert.throws(() => validateCodeGeneratorDeclaration({ ...valid, inputs: { root: '../outside', include: ['**/*.proto'] } }, { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' }), BuildGraphValidationError);
  assert.throws(() => validateCodeGeneratorDeclaration({ ...valid, inputs: { include: ['**/*.proto'], exclude: '*.generated.proto' } as never }, { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' }), BuildGraphValidationError);
});

test('protobuf provider blocks a missing fixed SDK before planning', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-protobuf-no-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'message.proto'), 'syntax = "proto3"; message Message { bytes value = 1; }', 'utf8');
  const service = new BuildPipelineService(createBuildStepProviderRegistry([createProtobufCodeGeneratorProvider({
    sdkRoot: path.join(root, 'missing-sdk'), protocPath: path.join(root, 'missing-sdk', 'bin', 'protoc.exe')
  })]));
  await assert.rejects(service.planCodeGenerators({
    workspaceRoot: root, projectRoot: root, outputRoot: path.join(root, 'out'), projectId: 'protobuf',
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' },
    modules: [{ manifest: { id: 'lingbuilder.data.protobuf', build: { codeGenerators: [PROTOBUF_MODULE.build!.codeGenerators![0]] } } }]
  }), /runtime-manifest|SDK/u);
});

test('protobuf provider fingerprints local imports as build inputs', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-protobuf-imports-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const relative of PROTOBUF_SDK_REQUIRED_FILES) {
    const target = path.join(root, 'sdk', ...relative.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(relative), 'utf8');
  }
  const sdkRoot = path.join(root, 'sdk');
  await fs.writeFile(path.join(sdkRoot, 'runtime-manifest.json'), JSON.stringify(await createProtobufSdkManifest(sdkRoot, PROTOBUF_SDK_REQUIRED_FILES)), 'utf8');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  await fs.writeFile(path.join(root, 'src', 'main.proto'), 'syntax = "proto3"; import "common.proto"; message Main { Common value = 1; }', 'utf8');
  await fs.writeFile(path.join(root, 'src', 'common.proto'), 'syntax = "proto3"; message Common { bytes data = 1; }', 'utf8');
  const service = new BuildPipelineService(createBuildStepProviderRegistry([createProtobufCodeGeneratorProvider({ sdkRoot, protocPath: path.join(sdkRoot, 'bin', 'protoc.exe') })]));
  const steps = await service.planCodeGenerators({
    workspaceRoot: root, projectRoot: root, outputRoot: path.join(root, 'out'), projectId: 'protobuf-imports',
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' },
    modules: [{ manifest: { id: PROTOBUF_MODULE.id, build: { codeGenerators: [{ ...PROTOBUF_MODULE.build!.codeGenerators![0], inputs: { root: 'src', include: ['main.proto'] } }] } } }]
  });
  assert.deepEqual(steps[0]?.options.protoFiles, ['main.proto']);
  assert.deepEqual(steps[0]?.inputs.map(input => input.path), ['src/common.proto', 'src/main.proto']);
});

test('project code generator export includes proto inputs in build and portable trees', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-codegen-input-export-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'main.proto'), 'syntax = "proto3"; message Main {}', 'utf8');
  const registry = createBuildStepProviderRegistry([{
    id: 'test.provider', version: '1.0.0',
    plan: () => [step('generate', { inputs: [{ path: 'main.proto' }], outputs: [{ path: 'generated/main.txt', kind: 'content' }] })],
    run: async (current, context) => {
      const target = path.join(context.outputRoot, current.outputs[0].path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, 'generated', 'utf8');
      return { artifacts: [await describeArtifact(target, context.outputRoot, 'content')] };
    }
  }]);
  const service = new BuildPipelineService(registry);
  const result = await runProjectCodeGenerators({
    service, workspaceRoot: root, projectRoot: root, outputRoot: path.join(root, 'build'), exportRoot: path.join(root, 'export'), projectId: 'input-export',
    modules: [{ manifest: { ...PROTOBUF_MODULE, id: 'test.module', build: { codeGenerators: [{ id: 'test-generator', provider: 'test.provider', inputs: { include: ['main.proto'] }, outputs: [{ path: 'generated/main.txt', kind: 'content' }] }] } }, installPath: 'builtin://test.module', isBuiltin: true, isInstalled: true, diagnostics: [] }],
    target: { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' }
  });
  assert.ok(result.artifacts.some(artifact => artifact.relativePath === 'main.proto' && artifact.kind === 'content'));
  assert.equal(await fs.readFile(path.join(root, 'build', 'main.proto'), 'utf8'), 'syntax = "proto3"; message Main {}');
  assert.equal(await fs.readFile(path.join(root, 'export', 'main.proto'), 'utf8'), 'syntax = "proto3"; message Main {}');
});

test('protobuf SDK manifest pins required files, version, size and digest', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-protobuf-sdk-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const relative of PROTOBUF_SDK_REQUIRED_FILES) {
    const target = path.join(root, ...relative.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(relative), 'utf8');
  }
  const manifest = await createProtobufSdkManifest(root, PROTOBUF_SDK_REQUIRED_FILES);
  await fs.writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify(manifest), 'utf8');
  const providerInstance = createProtobufCodeGeneratorProvider({ sdkRoot: root, protocPath: path.join(root, 'bin', 'protoc.exe') });
  const service = new BuildPipelineService(createBuildStepProviderRegistry([providerInstance]));
  await fs.writeFile(path.join(root, 'message.proto'), 'syntax = "proto3"; message Message {}', 'utf8');
  const request = {
    workspaceRoot: root, projectRoot: root, outputRoot: path.join(root, 'out'), projectId: 'protobuf',
    target: { platform: 'windows' as const, arch: 'x64' as const, toolchain: 'msvc' as const, id: 'windows-msvc-x64' },
    modules: [{ manifest: { id: 'lingbuilder.data.protobuf', build: { codeGenerators: [{ ...PROTOBUF_MODULE.build!.codeGenerators![0] }] } } }]
  };
  assert.equal((await service.planCodeGenerators(request)).length, 1);
  const before = JSON.parse(await fs.readFile(path.join(root, 'runtime-manifest.json'), 'utf8')) as { sdkVersion: string };
  before.sdkVersion = '0.0.0';
  await fs.writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify(before), 'utf8');
  await assert.rejects(service.planCodeGenerators(request), /固定版本|版本/u);
  assert.equal(PROTOBUF_SDK_VERSION, '27.3.0');
});

test('native materialization copies verified protobuf runtime and protoc into build and export trees', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-protobuf-materialize-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const relative of PROTOBUF_SDK_REQUIRED_FILES) {
    const target = path.join(root, ...relative.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, Buffer.from(relative), 'utf8');
  }
  await fs.writeFile(path.join(root, 'runtime-manifest.json'), JSON.stringify(await createProtobufSdkManifest(root, PROTOBUF_SDK_REQUIRED_FILES)), 'utf8');
  const previous = process.env.LINGBUILDER_PROTOBUF_SDK_ROOT;
  process.env.LINGBUILDER_PROTOBUF_SDK_ROOT = root;
  try {
    const module = { manifest: PROTOBUF_MODULE, installPath: 'builtin://lingbuilder.data.protobuf', isBuiltin: true, isInstalled: true, diagnostics: [] };
    const layout = {
      buildDir: path.join(root, 'build'), sourceDir: path.join(root, 'source'),
      binDir: path.join(root, 'bin'), exportDir: path.join(root, 'export'), preferredTargetId: 'windows-msvc-x64'
    };
    const first = await materializeModuleNativeDependencies([module], layout);
    assert.deepEqual(first.blockingDiagnostics, []);
    for (const location of [
      path.join(layout.buildDir, 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', 'protoc.exe'),
      path.join(layout.exportDir, 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', 'protoc.exe'),
      path.join(layout.exportDir, 'modules', PROTOBUF_MODULE.id, 'sdk', 'runtime-manifest.json')
    ]) assert.ok(await fs.stat(location));
    await fs.writeFile(path.join(root, 'bin', 'protoc.exe'), 'tampered', 'utf8');
    const damaged = await materializeModuleNativeDependencies([module], layout);
    assert.match(damaged.blockingDiagnostics.join('\n'), /SHA-256|不一致/u);
  } finally {
    if (previous === undefined) delete process.env.LINGBUILDER_PROTOBUF_SDK_ROOT;
    else process.env.LINGBUILDER_PROTOBUF_SDK_ROOT = previous;
  }
});

test('bytes is the canonical user-facing type and native ABI keeps ownership with caller', () => {
  assert.equal(MODULE_BINDING_TYPE_LABELS.bytes, '字节集');
  assert.equal(normalizeLingCppValueType('bytes'), '字节集');
  assert.equal(inferLingCppExpressionType('取数据()', new Map(), undefined, new Map([['取数据', 'bytes']])), '字节集');
  assert.equal(areLingCppTypesCompatible('字节集', 'bytes'), true);
  const runtime = generateProtobufRuntime([{
    manifest: PROTOBUF_MODULE, installPath: 'builtin://lingbuilder.data.protobuf', isBuiltin: true,
    isInstalled: true, diagnostics: []
  }]);
  assert.match(runtime, /const unsigned char\* data, size_t size/u);
  assert.match(runtime, /size_t LingBuilderProtoSerializeBytes/u);
  assert.match(runtime, /#if LINGBUILDER_PROTOBUF_AVAILABLE/u);
  assert.doesNotMatch(runtime, /#if defined\(LINGBUILDER_PROTOBUF_AVAILABLE\)/u);
  assert.doesNotMatch(runtime, /extern "C"[^\n]+std::vector/u);
});

test('module manifest accepts bytes and diagnoses byte-sequence raw bindings', () => {
  const valid = {
    schemaVersion: 2, id: 'test.bytes', name: '字节集测试', version: '1.0.0', category: '其他', description: 'bytes',
    contributes: { commands: [{ name: '读取字节', signature: '读取字节()', description: '读取', insertText: '读取字节()', returnType: '字节集' }] },
    bindings: { commands: [{ command: '读取字节', runtimeName: '读取字节', returnType: 'bytes' }] }
  };
  assert.deepEqual(validateModuleManifest(valid).diagnostics, []);
  const legacy = {
    ...valid,
    bindings: { commands: [{ command: '读取字节', runtimeName: '读取字节', parameters: [{ name: 'bytes', type: 'raw' }] }] }
  };
  assert.match(validateModuleManifest(legacy).diagnostics.join('\n'), /raw.*bytes|bytes.*raw/u);
});

test('module manifest rejects executable codeGenerator options and missing targets', () => {
  const manifest = {
    schemaVersion: 2, id: 'test.generator.options', name: '生成器选项测试', version: '1.0.0', category: '其他', description: 'options',
    targets: [{ id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }],
    build: { codeGenerators: [{
      id: 'test-generator', provider: 'test.provider', inputs: { include: ['**/*.proto'] },
      outputs: [{ path: 'generated/out', kind: 'content' }], targetIds: ['windows-msvc-win32'],
      options: { command: 'protoc', nested: { executable: 'evil.exe' } }
    }] }
  };
  const diagnostics = validateModuleManifest(manifest).diagnostics.join('\n');
  assert.match(diagnostics, /target|命令|脚本/u);
});

test('protobuf builtin documentation and example assets match manifest paths', async () => {
  const module = { manifest: PROTOBUF_MODULE, installPath: 'builtin://lingbuilder.data.protobuf', isBuiltin: true, isInstalled: true, diagnostics: [] };
  const options = { workspaceRoot: process.cwd(), resourceRoot: process.cwd() };
  const manual = await readModuleDocumentation(module, 'docs/modules/protobuf/README.md', options);
  const example = await fs.readFile(path.join(process.cwd(), 'docs/modules/protobuf/examples/basic.lcpp'), 'utf8');
  assert.match(manual.content, /受控.*protoc/u);
  assert.match(example, /PB_序列化为字节集/u);
});
