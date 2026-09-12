import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { BuildPipelineService } from '../src/services/build/buildPipeline';
import { createProtobufCodeGeneratorProvider } from '../src/services/build/protobufProvider';
import { createBuildStepProviderRegistry } from '../src/services/build/providerRegistry';
import { PROTOBUF_MODULE } from '../src/services/modules/protobufModule';
import { validateProtobufSdk } from '../src/services/modules/protobufSdk';
import { materializeModuleNativeDependencies } from '../src/services/modules/nativeDependencyService';
import type { InstalledModule } from '../src/services/modules/types';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const sdkRoot = path.resolve(process.env.LINGBUILDER_PROTOBUF_SDK_ROOT || path.join(repoRoot, '.lingbuilder', 'toolchains', 'protobuf'));
const requireSdk = process.argv.includes('--require-sdk');

/** 用 vswhere 找最新 VS 安装根，供 VsDevCmd 环境调用 cl。 */
async function findVisualStudioRoot(): Promise<string | null> {
  const vswhere = String.raw`C:\Program Files (x86)\Microsoft Visual Studio\Installer\vswhere.exe`;
  try {
    const { stdout } = await execFileAsync(vswhere, ['-latest', '-property', 'installationPath'], { timeout: 15000 });
    const root = stdout.trim().split(/\r?\n/u)[0];
    return root && await fs.access(path.join(root, 'Common7', 'Tools', 'VsDevCmd.bat')).then(() => root, () => null);
  } catch {
    return null;
  }
}

/** 端到端：编译 protoc 生成代码 + 反射主程序，运行并校验输出（真实固定 SDK 的双架构验收）。 */
async function runEndToEnd(
  vsRoot: string,
  architecture: 'x64' | 'win32',
  workspace: string,
  binDir: string
): Promise<Record<string, unknown>> {
  const vsArch = architecture === 'x64' ? 'x64' : 'x86';
  const exePath = path.join(binDir, `protobuf-e2e-${architecture}.exe`);
  const objDir = path.join(binDir, `obj-${architecture}`);
  await fs.mkdir(objDir, { recursive: true });
  const compileArgs = [
    '/nologo', '/EHsc', '/std:c++17', '/utf-8', '/DUNICODE', '/D_UNICODE', '/DPROTOBUF_USE_DLLS', '/DABSL_CONSUME_DLL',
    `/I${path.join(sdkRoot, 'include')}`, `/I${workspace}`
  ];
  // 逐文件 /Fo 指向完整 .obj 路径：/Fo 的目录形式以反斜杠结尾，与 cmd 引号转义冲突。
  const sources = [
    { source: 'main.cpp', name: 'main' },
    { source: path.join('generated', 'protobuf', 'common.pb.cc'), name: 'common.pb' },
    { source: path.join('generated', 'protobuf', 'root.pb.cc'), name: 'root.pb' }
  ];
  const clLines = [
    '@echo off',
    `call "${path.join(vsRoot, 'Common7', 'Tools', 'VsDevCmd.bat')}" -arch=${vsArch} -no_logo >nul`,
    ...sources.map(item => `cl ${compileArgs.join(' ')} /c "${path.join(workspace, item.source)}" /Fo:"${path.join(objDir, `${item.name}.obj`)}"`),
    `link /nologo /OUT:"${exePath}" "${path.join(objDir, 'main.obj')}" "${path.join(objDir, 'common.pb.obj')}" "${path.join(objDir, 'root.pb.obj')}" "${path.join(sdkRoot, 'lib', architecture, 'libprotobuf.lib')}" "${path.join(sdkRoot, 'lib', architecture, 'abseil_dll.lib')}"`
  ];
  const scriptPath = path.join(workspace, `compile-${architecture}.cmd`);
  await fs.writeFile(scriptPath, clLines.join('\r\n'), 'utf8');
  try {
    await execFileAsync('cmd.exe', ['/d', '/c', scriptPath], { cwd: workspace, timeout: 300000, windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
  } catch (error) {
    const detail = [error.stdout, error.stderr].filter(value => typeof value === 'string' && value.trim()).join('\n');
    throw new Error(`Protobuf ${architecture} 端到端编译失败：\n${detail || String(error)}`);
  }
  for (const runtime of ['libprotobuf.dll', 'abseil_dll.dll']) {
    await fs.copyFile(path.join(sdkRoot, 'bin', architecture, runtime), path.join(binDir, runtime));
  }
  const run = await execFileAsync(exePath, [], { cwd: binDir, timeout: 30000, maxBuffer: 1024 * 1024 });
  if (!run.stdout.includes('SMOKE-RUN-OK')) {
    throw new Error(`Protobuf ${architecture} 端到端运行输出不符合预期：${run.stdout.trim()}`);
  }
  return { architecture, stdout: run.stdout.trim() };
}

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
    // 与 F5 一致：outputRoot 即生成工程的源码目录，生成物落在 <outputRoot>/generated/protobuf。
    const outputRoot = workspace;
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
    for (const architecture of ['x64', 'win32'] as const) {
      const materialized = await materializeModuleNativeDependencies([installed], {
        buildDir: path.join(workspace, 'build'),
        sourceDir: path.join(workspace, 'source'),
        binDir: path.join(workspace, 'bin'),
        exportDir: path.join(workspace, 'export'),
        preferredTargetId: architecture === 'x64' ? 'windows-msvc-x64' : 'windows-msvc-win32'
      });
      if (materialized.blockingDiagnostics.length > 0) throw new Error(materialized.blockingDiagnostics.join('\n'));
      await fs.access(path.join(workspace, 'build', 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', 'protoc.exe'));
      await fs.access(path.join(workspace, 'export', 'modules', PROTOBUF_MODULE.id, 'sdk', 'bin', architecture, 'libprotobuf.dll'));
      await fs.access(path.join(workspace, 'bin', 'libprotobuf.dll'));
      await fs.access(path.join(workspace, 'bin', 'abseil_dll.dll'));
    }

    const vsRoot = await findVisualStudioRoot();
    if (!vsRoot) throw new Error('Protobuf 端到端 smoke 需要 Visual Studio（未找到 VsDevCmd.bat）。');
    await fs.writeFile(path.join(workspace, 'main.cpp'), [
      '#include "generated/protobuf/root.pb.h"',
      '#include <iostream>',
      '#include <string>',
      'int main() {',
      '    smoke::Root root;',
      '    smoke::Common* item = root.add_items();',
      '    item->set_name("\xE5\x90\x8D\xE7\xA7\xB0");',
      '    item->set_payload(std::string(3, \'\\1\'));',
      '    root.mutable_values()->insert({"k", std::string(2, \'\\2\')});',
      '    std::string encoded;',
      '    if (!root.SerializeToString(&encoded)) return 2;',
      '    smoke::Root decoded;',
      '    if (!decoded.ParseFromString(encoded)) return 3;',
      '    if (decoded.items_size() != 1 || decoded.items(0).name() != "\xE5\x90\x8D\xE7\xA7\xB0") return 4;',
      '    std::cout << "SMOKE-RUN-OK bytes=" << encoded.size() << std::endl;',
      '    return 0;',
      '}'
    ].join('\n'), 'utf8');
    const e2e = [
      await runEndToEnd(vsRoot, 'x64', workspace, path.join(workspace, 'bin')),
      await runEndToEnd(vsRoot, 'win32', workspace, path.join(workspace, 'bin'))
    ];
    console.log(JSON.stringify({ ok: true, sdkRoot, generated, endToEnd: e2e }, null, 2));
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
}

void main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
