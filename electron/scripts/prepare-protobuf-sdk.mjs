#!/usr/bin/env node
/**
 * 一键准备固定版本 Protobuf SDK 27.3.0（electron/third_party/protobuf）。
 * 该目录不随 Git 入库；打包机 / 开发机首次使用 protobuf 模块前运行一次：
 *   cd electron && npm run protobuf:prepare
 * 已存在 runtime-manifest.json 时直接跳过（FORCE=1 强制重建）。
 * 流程：下载官方 protoc 包 + protobuf/abseil 源码 → CMake 双架构构建 → 组装 → 生成并校验清单。
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const electronRoot = path.resolve(import.meta.dirname, '..');
const repoRoot = path.resolve(electronRoot, '..');
const sdkRoot = path.join(electronRoot, 'third_party', 'protobuf');
const buildRoot = process.env.LINGBUILDER_PROTOBUF_BUILD_DIR || path.join(os.tmpdir(), 'lingbuilder-protobuf-sdk-build');
const FORCE = process.env.FORCE === '1';

const PROTOC_URL = 'https://github.com/protocolbuffers/protobuf/releases/download/v27.3/protoc-27.3-win64.zip';
const PROTOBUF_URL = 'https://github.com/protocolbuffers/protobuf/releases/download/v27.3/protobuf-27.3.tar.gz';
const ABSL_URL = 'https://github.com/abseil/abseil-cpp/archive/refs/tags/20240722.1.tar.gz';
const ABSL_VERSION = '20240722.1';

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function download(url, target) {
  if (await exists(target) && !FORCE) return;
  console.log(`下载 ${url}`);
  await execFileAsync('curl', ['-sL', '--max-time', '600', '-o', target, url], { timeout: 660000 });
  const stat = await fs.stat(target);
  if (stat.size < 1024 * 1024) throw new Error(`下载内容过小，可能被网络劫持：${url}`);
}

/** Windows 10+ 自带 bsdtar，可直接解 zip 与 tar.gz，避免依赖 unzip。 */
async function extract(archive, destination) {
  if (await exists(destination) && !FORCE) return;
  await fs.mkdir(destination, { recursive: true });
  console.log(`解压 ${path.basename(archive)} -> ${destination}`);
  await execFileAsync('tar', ['-xf', archive, '-C', destination], { timeout: 300000 });
}

async function findCmake() {
  for (const candidate of [
    path.join('C:', 'Program Files', 'Microsoft Visual Studio', '18', 'Community', 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe'),
    path.join('C:', 'Program Files', 'Microsoft Visual Studio', '2022', 'Community', 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe')
  ]) {
    if (await exists(candidate)) return candidate;
  }
  return 'cmake';
}

async function runCmake(cmake, args, label) {
  console.log(`CMake ${label} ...`);
  await execFileAsync(cmake, args, { timeout: 3600000, maxBuffer: 1024 * 1024 * 16 });
}

async function buildAll(sourceRoot, abslRoot, buildDir) {
  const cmake = await findCmake();
  const generator = 'Visual Studio 18 2026';
  const env = { ...process.env, CMAKE_BUILD_PARALLEL_LEVEL: '8' };
  const archs = [['x64', 'x64'], ['win32', 'Win32']];
  for (const [arch, cmakeArch] of archs) {
    const abslBuild = path.join(buildDir, `absl-dll-${arch}`);
    const abslInstall = path.join(buildDir, `absl-dll-install-${arch}`);
    if (FORCE || !await exists(path.join(abslInstall, 'bin', 'abseil_dll.dll'))) {
      await runCmake(cmake, [
        '-S', abslRoot, '-B', abslBuild, '-G', generator, '-A', cmakeArch,
        '-DCMAKE_INSTALL_PREFIX=' + abslInstall,
        '-DBUILD_SHARED_LIBS=ON', '-DABSL_BUILD_MONOLITHIC_SHARED_LIBS=ON',
        '-DABSL_PROPAGATE_CXX_STD=ON', '-DABSL_BUILD_TESTING=OFF', '-DBUILD_TESTING=OFF',
        '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL', '-DCMAKE_CXX_STANDARD=17'
      ], `abseil ${arch} configure`);
      await execFileAsync(cmake, ['--build', abslBuild, '--config', 'Release', '--target', 'install'],
        { timeout: 3600000, maxBuffer: 1024 * 1024 * 16, env });
    }
    const pbBuild = path.join(buildDir, `pb-${arch}`);
    if (FORCE || !await exists(path.join(pbBuild, 'bin', 'Release', 'libprotobuf.dll'))) {
      await runCmake(cmake, [
        '-S', sourceRoot, '-B', pbBuild, '-G', generator, '-A', cmakeArch,
        '-Dprotobuf_BUILD_SHARED_LIBS=ON', '-Dprotobuf_BUILD_TESTS=OFF',
        '-Dprotobuf_BUILD_PROTOC_BINARIES=OFF', '-Dprotobuf_BUILD_LIBUPB=OFF',
        '-Dprotobuf_BUILD_CONFORMANCE=OFF', '-Dprotobuf_INSTALL=OFF',
        '-Dprotobuf_ABSL_PROVIDER=package', '-DCMAKE_PREFIX_PATH=' + abslInstall,
        '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreadedDLL', '-DCMAKE_CXX_STANDARD=17'
      ], `libprotobuf ${arch} configure`);
      await execFileAsync(cmake, ['--build', pbBuild, '--config', 'Release', '--target', 'libprotobuf'],
        { timeout: 3600000, maxBuffer: 1024 * 1024 * 16, env });
    }
  }
}

async function copyMissing(sourceRoot, targetRoot) {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  await fs.mkdir(targetRoot, { recursive: true });
  for (const entry of entries) {
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(targetRoot, entry.name);
    if (entry.isDirectory()) await copyMissing(source, target);
    else if (!await exists(target)) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.copyFile(source, target);
    }
  }
}

async function removeByPattern(root, predicate) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (predicate(entry.name)) await fs.rm(child, { recursive: true, force: true });
      else await removeByPattern(child, predicate);
    }
  }
}

async function assemble(downloads, sourceRoot, abslSourceRoot, buildDir) {
  await fs.rm(sdkRoot, { recursive: true, force: true });
  await fs.mkdir(sdkRoot, { recursive: true });

  const includeRoot = path.join(sdkRoot, 'include');
  await copyMissing(path.join(sourceRoot, 'src', 'google'), path.join(includeRoot, 'google'));
  await copyMissing(path.join(abslSourceRoot, 'absl'), path.join(includeRoot, 'absl'));
  // 只保留头文件与 .proto，测试数据与实现源码不进 SDK。
  const entries = await fs.readdir(includeRoot, { recursive: true });
  for (const relative of entries.filter(name => name.endsWith('.cc'))) {
    await fs.rm(path.join(includeRoot, relative), { force: true });
  }
  await removeByPattern(includeRoot, name => name === 'testdata' || name === 'testing');

  await copyMissing(path.join(downloads, 'protoc-dist'), sdkRoot);
  await fs.rm(path.join(sdkRoot, 'include'), { recursive: true, force: true });
  for (const [arch] of [['x64'], ['win32']]) {
    await copyMissing(path.join(buildDir, `pb-${arch}`, 'bin', 'Release'), path.join(sdkRoot, 'bin', arch));
    await copyMissing(path.join(buildDir, `absl-dll-install-${arch}`, 'bin'), path.join(sdkRoot, 'bin', arch));
    await fs.cp(path.join(buildDir, `pb-${arch}`, 'bin', 'Release', 'libprotobuf.lib'), path.join(sdkRoot, 'lib', arch, 'libprotobuf.lib'), { force: true });
    await fs.cp(path.join(buildDir, `absl-dll-install-${arch}`, 'lib', 'abseil_dll.lib'), path.join(sdkRoot, 'lib', arch, 'abseil_dll.lib'), { force: true });
    for (const name of ['libprotobuf.lib', 'utf8_validity.lib', 'abseil_dll.lib', 'abseil_dll.exp', 'libprotobuf.exp']) {
      await fs.rm(path.join(sdkRoot, 'bin', arch, name), { force: true });
    }
  }
  await fs.cp(path.join(sourceRoot, 'LICENSE'), path.join(sdkRoot, 'LICENSE'));
  await fs.cp(path.join(electronRoot, 'scripts', 'protobuf-sdk-NOTICE.md'), path.join(sdkRoot, 'NOTICE.md'));
}

async function main() {
  if (!FORCE && await exists(path.join(sdkRoot, 'runtime-manifest.json'))) {
    console.log(`Protobuf SDK 已就绪：${sdkRoot}（FORCE=1 强制重建）`);
    return;
  }
  const downloads = path.join(buildRoot, 'dl');
  await fs.mkdir(downloads, { recursive: true });
  await download(PROTOC_URL, path.join(downloads, 'protoc-27.3-win64.zip'));
  await download(PROTOBUF_URL, path.join(downloads, 'protobuf-27.3.tar.gz'));
  await download(ABSL_URL, path.join(downloads, `abseil-${ABSL_VERSION}.tar.gz`));
  await extract(path.join(downloads, 'protoc-27.3-win64.zip'), path.join(downloads, 'protoc-dist'));
  await extract(path.join(downloads, 'protobuf-27.3.tar.gz'), buildRoot);
  await extract(path.join(downloads, `abseil-${ABSL_VERSION}.tar.gz`), buildRoot);
  const sourceRoot = path.join(buildRoot, 'protobuf-27.3');
  const abslSourceRoot = path.join(buildRoot, `abseil-cpp-${ABSL_VERSION}`);
  for (const dir of [sourceRoot, abslSourceRoot]) {
    if (!await exists(dir)) throw new Error(`源码解压结果缺失：${dir}`);
  }
  // 发布包不带 abseil 子模块内容；把独立下载的 absl 源码填进去，module 提供者路径保持可用。
  await copyMissing(abslSourceRoot, path.join(sourceRoot, 'third_party', 'abseil-cpp'));
  await buildAll(sourceRoot, abslSourceRoot, buildRoot);
  await assemble(downloads, sourceRoot, abslSourceRoot, buildRoot);
  console.log(`SDK 组装完成：${sdkRoot}，开始生成并校验 runtime-manifest.json ...`);
  await execFileAsync('node', ['--import', 'tsx', 'scripts/generate-protobuf-sdk-manifest.ts'], {
    cwd: electronRoot, timeout: 600000, stdio: 'inherit'
  });
  console.log('Protobuf SDK 准备完成。');
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
