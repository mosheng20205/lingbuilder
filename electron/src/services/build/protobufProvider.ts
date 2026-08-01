import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ModuleCodeGeneratorContribution } from '../modules/types';
import { PROTOBUF_SDK_VERSION, ProtobufSdkValidationError, validateProtobufSdk } from '../modules/protobufSdk';
import { describeArtifact } from './buildGraph';
import type { BuildStep, BuildStepProvider, BuildStepResult, BuildProviderPlanContext, BuildStepContext } from './types';

const execFileAsync = promisify(execFile);
const PROTOBUF_PROVIDER_ID = 'lingbuilder.protobuf.protoc';
const PROTOBUF_PROVIDER_VERSION = '1.0.0';

export interface ProtobufProviderOptions {
  protocPath: string | (() => string);
  sdkRoot?: string | (() => string);
  expectedSha256?: string;
  runtimeVersion?: string;
}

export function createProtobufCodeGeneratorProvider(options: ProtobufProviderOptions): BuildStepProvider {
  return {
    id: PROTOBUF_PROVIDER_ID,
    version: PROTOBUF_PROVIDER_VERSION,
    plan: (declaration, context) => planProtobufStep(declaration, context, options),
    run: (step, context) => runProtobufStep(step, context, options)
  };
}

async function planProtobufStep(
  declaration: ModuleCodeGeneratorContribution,
  context: BuildProviderPlanContext,
  options: ProtobufProviderOptions
): Promise<readonly BuildStep[]> {
  await validateProviderSdk(options, context.target.arch);
  const requestedRuntimeVersion = declaration.options?.runtimeVersion;
  if (requestedRuntimeVersion !== undefined
      && requestedRuntimeVersion !== 'pinned'
      && requestedRuntimeVersion !== PROTOBUF_SDK_VERSION) {
    throw new ProtobufSdkValidationError(`Protobuf 生成器要求固定 runtime 版本 ${PROTOBUF_SDK_VERSION}。`);
  }
  const inputRoot = path.resolve(context.projectRoot, declaration.inputs.root || '.');
  const entryFiles = await collectProtoFiles(inputRoot, declaration.inputs.include, declaration.inputs.exclude || []);
  if (entryFiles.length === 0) {
    context.log(`Protobuf 代码生成器未找到输入，跳过：${declaration.id}`);
    return [];
  }
  const files = await collectProtoDependencies(inputRoot, entryFiles);
  const outputDirectory = typeof declaration.options?.outputDirectory === 'string'
    ? declaration.options.outputDirectory
    : 'generated/protobuf';
  const descriptorPath = declaration.outputs.find(output => output.kind === 'descriptor')?.path || path.posix.join(outputDirectory.replace(/\\/gu, '/'), 'descriptor.pb');
  const generatedFiles = entryFiles.flatMap(file => {
    const relative = path.relative(inputRoot, file).replace(/\\/gu, '/');
    const stem = relative.replace(/\.proto$/iu, '');
    return [
      { path: path.posix.join(outputDirectory, `${stem}.pb.h`), kind: 'header' as const },
      { path: path.posix.join(outputDirectory, `${stem}.pb.cc`), kind: 'source' as const }
    ];
  });
  const inputPaths = new Set(files.map(file => path.resolve(file).toLowerCase()));
  for (const output of [...generatedFiles, { path: descriptorPath, kind: 'descriptor' as const }]) {
    if (inputPaths.has(path.resolve(context.outputRoot, output.path).toLowerCase())) {
      throw new Error(`Protobuf 代码生成器输出不能覆盖输入源码：${output.path}`);
    }
  }
  return [{
    id: 'generate',
    provider: PROTOBUF_PROVIDER_ID,
    providerVersion: PROTOBUF_PROVIDER_VERSION,
    phase: 'generate',
    dependsOn: [],
    inputs: files.map(file => ({ path: path.relative(context.projectRoot, file).replace(/\\/gu, '/') })),
    outputs: [...generatedFiles, { path: descriptorPath, kind: 'descriptor' }],
    options: {
      inputRoot: path.relative(context.projectRoot, inputRoot).replace(/\\/gu, '/') || '.',
      protoFiles: entryFiles.map(file => path.relative(inputRoot, file).replace(/\\/gu, '/')),
      outputDirectory,
      descriptorPath,
      runtimeVersion: declaration.options?.runtimeVersion
    }
  }];
}

async function runProtobufStep(step: BuildStep, context: BuildStepContext, options: ProtobufProviderOptions): Promise<BuildStepResult> {
  const sdk = await validateProviderSdk(options, context.target.arch);
  const requestedRuntimeVersion = step.options.runtimeVersion;
  if (requestedRuntimeVersion !== undefined
      && requestedRuntimeVersion !== 'pinned'
      && requestedRuntimeVersion !== PROTOBUF_SDK_VERSION) {
    throw new ProtobufSdkValidationError(`Protobuf 生成器要求固定 runtime 版本 ${PROTOBUF_SDK_VERSION}。`);
  }
  const configuredProtocPath = path.resolve(typeof options.protocPath === 'function' ? options.protocPath() : options.protocPath);
  if (configuredProtocPath.toLowerCase() !== sdk.protocPath.toLowerCase()) {
    throw new ProtobufSdkValidationError('protoc 必须使用固定 SDK 中的 bin/protoc.exe，禁止回退到系统或工作区外的可执行文件。');
  }
  const protocPath = sdk.protocPath;
  const inputRoot = resolveSafePath(context.projectRoot, String(step.options.inputRoot || '.'), 'Protobuf 输入根目录');
  const outputDirectory = resolveSafePath(context.outputRoot, String(step.options.outputDirectory || 'generated/protobuf'), 'Protobuf 输出目录');
  const descriptorPath = resolveSafePath(context.outputRoot, String(step.options.descriptorPath || path.posix.join(String(step.options.outputDirectory || 'generated/protobuf'), 'descriptor.pb')), 'Protobuf descriptor 输出');
  const protoFiles = Array.isArray(step.options.protoFiles) ? step.options.protoFiles.map(String) : [];
  if (protoFiles.length === 0) throw new Error('Protobuf 构建步骤缺少输入文件。');
  if (protoFiles.some(file => path.isAbsolute(file) || file.split(/[\\/]/u).includes('..'))) throw new ProtobufSdkValidationError('Protobuf 输入文件路径越界。');
  await fs.mkdir(outputDirectory, { recursive: true });
  await fs.mkdir(path.dirname(descriptorPath), { recursive: true });
  const args = [
    `--proto_path=${inputRoot}`,
    `--cpp_out=${outputDirectory}`,
    `--descriptor_set_out=${descriptorPath}`,
    '--include_imports',
    ...protoFiles
  ];
  context.log(`运行受控 protoc（${protoFiles.length} 个入口文件，${step.inputs.length} 个含 import 的输入）。`);
  await execFileAsync(protocPath, args, {
    cwd: inputRoot,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024,
    signal: context.signal
  } as Parameters<typeof execFileAsync>[2]);
  const artifacts = [];
  for (const output of step.outputs) {
    const absolute = path.resolve(context.outputRoot, output.path);
    if (output.kind === 'descriptor' || !output.path.endsWith('/')) {
      if (await fileExists(absolute)) artifacts.push(await describeArtifact(absolute, context.outputRoot, output.kind));
    }
  }
  if (artifacts.length === 0) throw new Error('protoc 未生成声明的产物。');
  return { artifacts, logs: [`Protobuf 生成完成：${artifacts.length} 个产物。`] };
}

async function validateProviderSdk(
  options: ProtobufProviderOptions,
  architecture: BuildProviderPlanContext['target']['arch']
) {
  if (architecture !== 'win32' && architecture !== 'x64') {
    throw new ProtobufSdkValidationError(`Protobuf Provider 不支持目标架构 ${architecture}。`);
  }
  const configuredProtocPath = path.resolve(typeof options.protocPath === 'function' ? options.protocPath() : options.protocPath);
  const sdkRoot = path.resolve(typeof options.sdkRoot === 'function'
    ? options.sdkRoot()
    : options.sdkRoot || path.dirname(path.dirname(configuredProtocPath)));
  const sdk = await validateProtobufSdk(sdkRoot, architecture);
  if (options.runtimeVersion && options.runtimeVersion !== 'pinned' && options.runtimeVersion !== PROTOBUF_SDK_VERSION) {
    throw new ProtobufSdkValidationError(`Protobuf Provider 要求固定 runtime 版本 ${PROTOBUF_SDK_VERSION}。`);
  }
  if (options.expectedSha256) {
    const entry = sdk.files.get('bin/protoc.exe');
    if (!entry || entry.sha256.toLowerCase() !== options.expectedSha256.toLowerCase()) {
      throw new ProtobufSdkValidationError('protoc SHA-256 与固定 SDK 清单不一致，已阻止构建。');
    }
  }
  return sdk;
}

function resolveSafePath(root: string, relative: string, label: string): string {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/u).includes('..')) throw new ProtobufSdkValidationError(`${label}路径不安全：${relative}`);
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relative);
  const outside = path.relative(resolvedRoot, resolved);
  if (outside.startsWith('..') || path.isAbsolute(outside)) throw new ProtobufSdkValidationError(`${label}路径越界：${relative}`);
  return resolved;
}

async function collectProtoFiles(root: string, includes: readonly string[], excludes: readonly string[]): Promise<string[]> {
  const files: string[] = [];
  const visit = async (directory: string): Promise<void> => {
    const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) {
        const relative = path.relative(root, target).replace(/\\/gu, '/');
        if (includes.some(pattern => globMatch(relative, pattern)) && !excludes.some(pattern => globMatch(relative, pattern))) files.push(target);
      }
    }
  };
  await visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

/**
 * Resolve every local import so changes to a dependency invalidate the
 * generator cache and portable exports contain the complete .proto graph.
 */
async function collectProtoDependencies(root: string, entryFiles: readonly string[]): Promise<string[]> {
  const visited = new Map<string, string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const current = path.resolve(queue.shift()!);
    const key = current.toLowerCase();
    if (visited.has(key)) continue;
    visited.set(key, current);
    const source = await fs.readFile(current, 'utf8');
    const imports = extractProtoImports(source);
    for (const imported of imports) {
      if (path.isAbsolute(imported) || imported.split(/[\\/]/u).includes('..')) {
        throw new Error(`Protobuf import 路径越界：${imported}`);
      }
      const candidates = [
        path.resolve(path.dirname(current), imported),
        path.resolve(root, imported)
      ];
      const resolved = await firstExistingFile(candidates);
      if (!resolved) throw new Error(`Protobuf import 文件不存在：${imported}（来源：${path.relative(root, current).replace(/\\/gu, '/')})`);
      const relative = path.relative(path.resolve(root), resolved);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new Error(`Protobuf import 不能离开输入根目录：${imported}`);
      }
      queue.push(resolved);
    }
  }
  return [...visited.values()].sort((left, right) => left.localeCompare(right));
}

function extractProtoImports(source: string): string[] {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//gu, '')
    .replace(/(^|[^:])\/\/.*$/gmu, '$1');
  const imports: string[] = [];
  const expression = /\bimport\s+(?:(?:public|weak)\s+)?"([^"]+)"\s*;/gu;
  for (const match of withoutComments.matchAll(expression)) {
    if (match[1]) imports.push(match[1]);
  }
  return imports;
}

async function firstExistingFile(candidates: readonly string[]): Promise<string | undefined> {
  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isFile()) return candidate;
    } catch {
      // Try the next import root candidate.
    }
  }
  return undefined;
}

function globMatch(value: string, pattern: string): boolean {
  const normalized = pattern.replace(/\\/gu, '/').replace(/^\.\//u, '');
  let expression = '^';
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (character === '*' && normalized[index + 1] === '*') {
      index += 1;
      if (normalized[index + 1] === '/') index += 1;
      expression += '.*';
    } else if (character === '*') {
      expression += '[^/]*';
    } else if (character === '?') {
      expression += '[^/]';
    } else {
      expression += character.replace(/[.+^${}()|[\]\\]/gu, '\\$&');
    }
  }
  return new RegExp(`${expression}$`, 'iu').test(value);
}

async function fileExists(filePath: string): Promise<boolean> {
  return Boolean(await fs.stat(filePath).catch(() => undefined));
}

export { PROTOBUF_PROVIDER_ID, PROTOBUF_PROVIDER_VERSION };
