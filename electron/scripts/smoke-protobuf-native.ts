import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { BuildPipelineService } from '../src/services/build/buildPipeline';
import { createProtobufCodeGeneratorProvider } from '../src/services/build/protobufProvider';
import { createBuildStepProviderRegistry } from '../src/services/build/providerRegistry';
import { PROTOBUF_MODULE } from '../src/services/modules/protobufModule';
import { validateProtobufSdk } from '../src/services/modules/protobufSdk';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const sdkRoot = path.resolve(process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(repoRoot, '.lingbuilder', 'toolchains', 'protobuf'));
const requireSdk = process.argv.includes('--require-sdk');

async function main(): Promise<void> {
  try {
    await validateProtobufSdk(sdkRoot, 'x64');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (requireSdk) throw new Error(`Protobuf 原生 smoke 需要固定 SDK：${message}`);
    console.log(JSON.stringify({ ok: true, skipped: true, reason: message, sdkRoot }, null, 2));
    return;
  }

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-protobuf-native-'));
  try {
    const sourceRoot = path.join(workspace, 'src');
    const outputRoot = path.join(workspace, 'generated');
    await fs.mkdir(sourceRoot, { recursive: true });
    await fs.writeFile(path.join(sourceRoot, 'common.proto'), [
      'syntax = "proto3";',
      'package smoke;',
      'message Common { string name = 1; bytes payload = 2; }'
    ].join('\n'), 'utf8');
    await fs.writeFile(path.join(sourceRoot, 'root.proto'), [
      'syntax = "proto3";',
      'package smoke;',
      'import "common.proto";',
      'message Root { repeated Common items = 1; map<string, bytes> values = 2; }'
    ].join('\n'), 'utf8');

    const provider = createProtobufCodeGeneratorProvider({
      sdkRoot,
      protocPath: path.join(sdkRoot, 'bin', 'protoc.exe')
    });
    const service = new BuildPipelineService(createBuildStepProviderRegistry([provider]));
    const declaration = { ...PROTOBUF_MODULE.build!.codeGenerators![0], inputs: { root: 'src', include: ['**/*.proto'] } };
    const result = await service.run({
      workspaceRoot: workspace,
      projectRoot: workspace,
      outputRoot,
      projectId: 'protobuf-native-smoke',
      target: { platform: 'windows', arch: 'x64', toolchain: 'msvc', id: 'windows-msvc-x64' },
      modules: [{ manifest: { id: PROTOBUF_MODULE.id, build: { codeGenerators: [declaration] } } }]
    });
    const generated = result.artifacts.map(item => item.relativePath);
    for (const expected of ['generated/protobuf/common.pb.h', 'generated/protobuf/common.pb.cc', 'generated/protobuf/root.pb.h', 'generated/protobuf/root.pb.cc', 'generated/protobuf/descriptor.pb']) {
      if (!generated.includes(expected)) throw new Error(`Protobuf smoke 缺少产物：${expected}`);
    }

    const installed: InstalledModule = {
      manifest: PROTOBUF_MODULE,
      installPath: 'builtin://lingbuilder.data.protobuf',
      isBuiltin: true,
      isInstalled: true,
      diagnostics: []
    };
    const materialized = await materializeModuleNativeDependencies([installed], {
      buildDir: path.join(workspace, 'build'),
      sourceDir: path.join(workspace, 'source'),
      binDir: path.join(workspace, 'bin'),
      exportDir: path.join(workspace, 'export'),
      preferredTargetId: 'windows-msvc-x64'
    });
    if (materialized.blockingDiagnostics.length > 0) throw new Error(materialized.blockingDiagnostics.join('\n'));
    await fs.access(path.join(workspace, 'build', 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', 'protoc.exe'));
    await fs.access(path.join(workspace, 'export', 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', 'libprotobuf.dll'));
    console.log(JSON.stringify({ ok: true, sdkRoot, generated, runtimeFiles: materialized.runtimeFiles }, null, 2));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
