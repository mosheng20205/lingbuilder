import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { validateModuleRelativePath } from './manifest';

/**
 * Protobuf is intentionally pinned. The SDK is provisioned offline by the
 * workspace or installer and is never replaced by a system installation.
 */
export const PROTOBUF_SDK_VERSION = '27.3.0';
export const PROTOBUF_SDK_MANIFEST_SCHEMA_VERSION = 1;
export const PROTOBUF_SDK_REQUIRED_FILES = [
  'include/google/protobuf/descriptor.h',
  'include/google/protobuf/dynamic_message.h',
  'include/google/protobuf/descriptor.pb.h',
  'include/google/protobuf/util/json_util.h',
  'lib/libprotobuf.lib',
  'bin/libprotobuf.dll',
  'bin/protoc.exe'
] as const;

export type ProtobufTargetArchitecture = 'win32' | 'x64';

export interface ProtobufSdkManifestFile {
  path: string;
  size: number;
  sha256: string;
}

export interface ProtobufSdkManifest {
  schemaVersion: number;
  sdkVersion: string;
  /** Optional in early manifests; when present it must equal sdkVersion. */
  protocVersion?: string;
  /** Optional in early manifests; when present it must equal sdkVersion. */
  runtimeVersion?: string;
  platform?: 'windows';
  architectures?: ProtobufTargetArchitecture[];
  toolchain?: 'msvc' | 'msvc-v143';
  runtimeLibrary?: 'MD' | 'MDd';
  files: ProtobufSdkManifestFile[];
}

export interface ProtobufSdkInfo {
  root: string;
  manifest: ProtobufSdkManifest;
  files: Map<string, ProtobufSdkManifestFile>;
  protocPath: string;
}

export class ProtobufSdkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProtobufSdkValidationError';
  }
}

/**
 * Load and verify every file recorded by the SDK manifest. A manifest is not
 * trusted merely because it parses: required entries, sizes and SHA-256
 * digests are checked before a build can use the SDK.
 */
export async function validateProtobufSdk(
  sdkRoot: string,
  targetArchitecture?: ProtobufTargetArchitecture
): Promise<ProtobufSdkInfo> {
  const root = path.resolve(sdkRoot);
  const manifestPath = path.join(root, 'runtime-manifest.json');
  let manifest: ProtobufSdkManifest;
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8')) as ProtobufSdkManifest;
  } catch (error) {
    throw new ProtobufSdkValidationError(`Protobuf SDK 缺少或无法读取 runtime-manifest.json：${errorMessage(error)}`);
  }

  if (!manifest || manifest.schemaVersion !== PROTOBUF_SDK_MANIFEST_SCHEMA_VERSION
      || manifest.sdkVersion !== PROTOBUF_SDK_VERSION
      || (manifest.protocVersion !== undefined && manifest.protocVersion !== PROTOBUF_SDK_VERSION)
      || (manifest.runtimeVersion !== undefined && manifest.runtimeVersion !== PROTOBUF_SDK_VERSION)
      || (manifest.platform !== undefined && manifest.platform !== 'windows')
      || !Array.isArray(manifest.files) || manifest.files.length === 0) {
    throw new ProtobufSdkValidationError(`Protobuf SDK 版本或 runtime-manifest.json 格式不匹配，要求固定版本 ${PROTOBUF_SDK_VERSION}。`);
  }
  if (manifest.architectures !== undefined
      && (!Array.isArray(manifest.architectures)
        || manifest.architectures.some(item => item !== 'win32' && item !== 'x64'))) {
    throw new ProtobufSdkValidationError('Protobuf SDK runtime-manifest.json 的 architectures 无效。');
  }
  if (targetArchitecture && manifest.architectures && !manifest.architectures.includes(targetArchitecture)) {
    throw new ProtobufSdkValidationError(`Protobuf SDK 不支持目标架构 ${targetArchitecture}。`);
  }
  if (manifest.toolchain !== undefined && manifest.toolchain !== 'msvc' && manifest.toolchain !== 'msvc-v143') {
    throw new ProtobufSdkValidationError('Protobuf SDK runtime-manifest.json 的 toolchain 无效。');
  }
  if (manifest.runtimeLibrary !== undefined && manifest.runtimeLibrary !== 'MD' && manifest.runtimeLibrary !== 'MDd') {
    throw new ProtobufSdkValidationError('Protobuf SDK runtime-manifest.json 的 runtimeLibrary 无效。');
  }

  const files = new Map<string, ProtobufSdkManifestFile>();
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== 'string' || !validateModuleRelativePath(entry.path)
        || !Number.isSafeInteger(entry.size) || entry.size < 0
        || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/iu.test(entry.sha256)) {
      throw new ProtobufSdkValidationError(`Protobuf SDK runtime-manifest.json 包含无效文件记录：${String(entry?.path || '')}`);
    }
    const relative = normalizePath(entry.path);
    if (files.has(relative)) throw new ProtobufSdkValidationError(`Protobuf SDK runtime-manifest.json 存在重复文件记录：${relative}`);
    files.set(relative, { path: relative, size: entry.size, sha256: entry.sha256.toLowerCase() });
  }

  for (const required of PROTOBUF_SDK_REQUIRED_FILES) {
    const entry = files.get(required);
    if (!entry) throw new ProtobufSdkValidationError(`Protobuf SDK 缺少清单记录：${required}`);
    const target = path.join(root, ...required.split('/'));
    if (!await fileMatchesManifest(target, entry)) {
      throw new ProtobufSdkValidationError(`Protobuf SDK 文件缺失或 SHA-256 不一致：${required}`);
    }
  }

  for (const entry of files.values()) {
    const target = path.join(root, ...entry.path.split('/'));
    if (!await fileMatchesManifest(target, entry)) {
      throw new ProtobufSdkValidationError(`Protobuf SDK 文件缺失或 SHA-256 不一致：${entry.path}`);
    }
  }

  return {
    root,
    manifest,
    files,
    protocPath: path.join(root, 'bin', 'protoc.exe')
  };
}

export async function createProtobufSdkManifest(
  sdkRoot: string,
  files: readonly string[],
  options: Pick<ProtobufSdkManifest, 'architectures' | 'toolchain' | 'runtimeLibrary'> = {}
): Promise<ProtobufSdkManifest> {
  const entries: ProtobufSdkManifestFile[] = [];
  for (const input of files) {
    const relative = normalizePath(input);
    const bytes = await fs.readFile(path.join(path.resolve(sdkRoot), ...relative.split('/')));
    entries.push({
      path: relative,
      size: bytes.byteLength,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex')
    });
  }
  return {
    schemaVersion: PROTOBUF_SDK_MANIFEST_SCHEMA_VERSION,
    sdkVersion: PROTOBUF_SDK_VERSION,
    protocVersion: PROTOBUF_SDK_VERSION,
    runtimeVersion: PROTOBUF_SDK_VERSION,
    platform: 'windows',
    architectures: options.architectures || ['win32', 'x64'],
    toolchain: options.toolchain || 'msvc-v143',
    runtimeLibrary: options.runtimeLibrary || 'MD',
    files: entries
  };
}

function normalizePath(value: string): string {
  return value.replace(/\\/gu, '/').replace(/^\.\//u, '');
}

async function fileMatchesManifest(target: string, entry: ProtobufSdkManifestFile): Promise<boolean> {
  try {
    const stat = await fs.stat(target);
    if (!stat.isFile() || stat.size !== entry.size) return false;
    const digest = crypto.createHash('sha256').update(await fs.readFile(target)).digest('hex');
    return digest.toLowerCase() === entry.sha256.toLowerCase();
  } catch {
    return false;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
