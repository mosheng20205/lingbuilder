import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createProtobufSdkManifest, validateProtobufSdk } from '../src/services/modules/protobufSdk';

/**
 * 重新生成 electron/third_party/protobuf/runtime-manifest.json 并做双架构验收。
 * Protobuf SDK 二进制一旦更换（升级 27.3.0 或重编），必须重跑：
 *   npm run protobuf:manifest
 * 脚本会登记目录内全部文件的大小与 SHA-256，然后用 win32/x64 两个目标架构
 * 完整校验一遍，任何缺失或不一致直接以中文诊断退出 1。
 */
const sdkRoot = path.resolve(process.argv[2] || path.join(process.cwd(), 'third_party', 'protobuf'));

async function collectFiles(root: string, relative = ''): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, relative), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await collectFiles(root, child));
    else if (entry.isFile() && entry.name !== 'runtime-manifest.json') files.push(child);
  }
  return files.sort((left, right) => left.localeCompare(right));
}

const files = await collectFiles(sdkRoot);
if (files.length === 0) {
  console.error(`Protobuf SDK 目录为空：${sdkRoot}`);
  process.exit(1);
}
const manifest = await createProtobufSdkManifest(sdkRoot, files, {
  architectures: ['win32', 'x64'],
  toolchain: 'msvc-v143',
  runtimeLibrary: 'MD'
});
await fs.writeFile(path.join(sdkRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`已登记 ${files.length} 个文件，SDK 版本 ${manifest.sdkVersion}。`);

for (const architecture of ['win32', 'x64'] as const) {
  const info = await validateProtobufSdk(sdkRoot, architecture);
  console.log(`${architecture} 校验通过：manifest ${info.files.size} 项，protoc=${info.manifest.protocVersion}，runtimeLibrary=${info.manifest.runtimeLibrary}。`);
}
const digest = crypto.createHash('sha256').update(await fs.readFile(path.join(sdkRoot, 'runtime-manifest.json'))).digest('hex');
console.log(`runtime-manifest.json SHA-256：${digest}`);
