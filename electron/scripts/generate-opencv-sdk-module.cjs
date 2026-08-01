const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const OPENCV_VERSION = '4.14.0';
const BRIDGE_VERSION = '1.0.0';
const BRIDGE_ABI_VERSION = 1;
const MODULE_ID = 'lingbuilder.opencv.sdk';
const SOURCE_URL = `https://codeload.github.com/opencv/opencv/zip/refs/tags/${OPENCV_VERSION}`;
const SOURCE_SHA256 = '831375584ff7a680cbb4efbb242cf949d14a37a3c37cb029c503672fe035abb6';
const repoRoot = path.resolve(__dirname, '..', '..');
const electronRoot = path.resolve(__dirname, '..');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const workRoot = path.resolve(repoRoot, '.lingbuilder-build', 'opencv-sdk');
  const cacheRoot = path.resolve(repoRoot, '.lingbuilder', 'cache', 'opencv');
  const archivePath = path.join(cacheRoot, `opencv-${OPENCV_VERSION}.zip`);
  const sourceRoot = options.source ? path.resolve(options.source) : path.join(workRoot, `opencv-${OPENCV_VERSION}`);
  const opencvBuild = path.join(workRoot, 'opencv-build');
  const opencvInstall = path.join(workRoot, 'opencv-install');
  const bridgeBuild = path.join(workRoot, 'bridge-build');
  const stageRoot = path.join(workRoot, 'module');
  const outputPackage = path.resolve(options.out || path.join(repoRoot, '.lingbuilder', 'module-packages', 'opencv-sdk.lbmod'));

  if (!options.source) {
    await fs.mkdir(cacheRoot, { recursive: true });
    if (!await exists(archivePath) || await sha256File(archivePath) !== SOURCE_SHA256) {
      await fs.rm(archivePath, { force: true });
      console.log(`下载 OpenCV ${OPENCV_VERSION} 源码：${SOURCE_URL}`);
      await download(SOURCE_URL, archivePath);
    }
    const actualHash = await sha256File(archivePath);
    if (actualHash !== SOURCE_SHA256) throw new Error(`OpenCV 源码 SHA-256 不一致：期望 ${SOURCE_SHA256}，实际 ${actualHash}`);
    if (!await exists(path.join(sourceRoot, 'CMakeLists.txt'))) {
      await fs.rm(sourceRoot, { recursive: true, force: true });
      const extractRoot = path.join(workRoot, 'source-extract');
      await fs.rm(extractRoot, { recursive: true, force: true });
      await fs.mkdir(extractRoot, { recursive: true });
      await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${escapePowerShell(archivePath)}' -DestinationPath '${escapePowerShell(extractRoot)}' -Force`], commandOptions());
      const extracted = (await fs.readdir(extractRoot, { withFileTypes: true })).find(entry => entry.isDirectory() && entry.name.startsWith('opencv-'));
      if (!extracted) throw new Error('OpenCV 源码压缩包中没有找到源码目录。');
      await fs.rename(path.join(extractRoot, extracted.name), sourceRoot);
      await fs.rm(extractRoot, { recursive: true, force: true });
    }
  }
  await assertSourceVersion(sourceRoot);

  const cmake = await findCmake();
  await fs.rm(opencvBuild, { recursive: true, force: true });
  await fs.rm(opencvInstall, { recursive: true, force: true });
  await fs.mkdir(opencvBuild, { recursive: true });
  console.log('配置 OpenCV 最小 x64 Release 构建…');
  await run(cmake, [
    '-S', sourceRoot, '-B', opencvBuild,
    '-G', 'Visual Studio 17 2022', '-A', 'x64',
    `-DCMAKE_INSTALL_PREFIX=${opencvInstall.replace(/\\/g, '/')}`,
    '-DBUILD_SHARED_LIBS=ON',
    '-DBUILD_LIST=core,imgproc,imgcodecs',
    '-DCPU_BASELINE=SSE2', '-DCPU_DISPATCH=',
    '-DBUILD_opencv_world=OFF',
    '-DBUILD_WITH_STATIC_CRT=OFF',
    '-DBUILD_TESTS=OFF', '-DBUILD_PERF_TESTS=OFF', '-DBUILD_EXAMPLES=OFF', '-DBUILD_opencv_apps=OFF',
    '-DBUILD_JAVA=OFF', '-DBUILD_opencv_java=OFF', '-DBUILD_opencv_python2=OFF', '-DBUILD_opencv_python3=OFF',
    '-DWITH_CUDA=OFF', '-DWITH_OPENCL=OFF', '-DWITH_IPP=OFF', '-DWITH_TBB=OFF',
    '-DWITH_FFMPEG=OFF', '-DWITH_GSTREAMER=OFF', '-DWITH_MSMF=OFF', '-DWITH_DSHOW=OFF',
    '-DWITH_OPENEXR=OFF', '-DWITH_1394=OFF', '-DWITH_QUIRC=OFF'
  ], workRoot, 20 * 60 * 1000);
  await run(cmake, ['--build', opencvBuild, '--config', 'Release', '--target', 'INSTALL', '--', '/m'], workRoot, 40 * 60 * 1000);

  const opencvConfig = await findFileRecursive(opencvInstall, 'OpenCVConfig.cmake');
  if (!opencvConfig) throw new Error('OpenCV 安装结果缺少 OpenCVConfig.cmake。');
  await fs.rm(bridgeBuild, { recursive: true, force: true });
  console.log('构建 LingBuilder OpenCV C ABI Bridge…');
  await run(cmake, [
    '-S', path.join(electronRoot, 'native', 'opencv-bridge'), '-B', bridgeBuild,
    '-G', 'Visual Studio 17 2022', '-A', 'x64',
    `-DOpenCV_DIR=${path.dirname(opencvConfig).replace(/\\/g, '/')}`
  ], workRoot, 10 * 60 * 1000);
  await run(cmake, ['--build', bridgeBuild, '--config', 'Release', '--', '/m'], workRoot, 10 * 60 * 1000);

  await fs.rm(stageRoot, { recursive: true, force: true });
  const sdkRoot = path.join(stageRoot, 'sdk');
  await copyFile(path.join(electronRoot, 'native', 'opencv-bridge', 'LingBuilderOpenCvBridge.h'), path.join(sdkRoot, 'include', 'LingBuilderOpenCvBridge.h'));
  const bridgeLib = await findFileRecursive(bridgeBuild, 'LingBuilderOpenCvBridge.lib');
  const bridgeDll = await findFileRecursive(bridgeBuild, 'LingBuilderOpenCvBridge.dll');
  if (!bridgeLib || !bridgeDll) throw new Error('Bridge 构建结果缺少 LIB 或 DLL。');
  await copyFile(bridgeLib, path.join(sdkRoot, 'lib', 'x64', 'LingBuilderOpenCvBridge.lib'));
  await copyFile(bridgeDll, path.join(sdkRoot, 'bin', 'x64', 'LingBuilderOpenCvBridge.dll'));

  const requiredDlls = ['opencv_core4140.dll', 'opencv_imgproc4140.dll', 'opencv_imgcodecs4140.dll'];
  for (const name of requiredDlls) {
    const source = await findFileRecursive(opencvInstall, name);
    if (!source) throw new Error(`OpenCV 安装结果缺少 ${name}。`);
    await copyFile(source, path.join(sdkRoot, 'bin', 'x64', name));
  }
  await copyFile(path.join(sourceRoot, 'LICENSE'), path.join(stageRoot, 'licenses', 'OpenCV-LICENSE.txt'));
  await fs.writeFile(path.join(stageRoot, 'lingbuilder.module.json'), JSON.stringify(moduleManifest(), null, 2) + '\n', 'utf8');
  await fs.writeFile(path.join(stageRoot, 'README.md'), moduleReadme(), 'utf8');

  const manifestFiles = [];
  for (const file of await listFiles(sdkRoot)) {
    const relative = path.relative(sdkRoot, file).replace(/\\/g, '/');
    const stat = await fs.stat(file);
    manifestFiles.push({ path: relative, size: stat.size, sha256: await sha256File(file) });
  }
  manifestFiles.sort((left, right) => left.path.localeCompare(right.path));
  await fs.writeFile(path.join(sdkRoot, 'runtime-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    opencvVersion: OPENCV_VERSION,
    bridgeVersion: BRIDGE_VERSION,
    bridgeAbiVersion: BRIDGE_ABI_VERSION,
    architecture: 'x64',
    toolset: 'msvc-v143',
    runtimeLibrary: 'MD',
    files: manifestFiles
  }, null, 2) + '\n', 'utf8');

  await fs.mkdir(path.dirname(outputPackage), { recursive: true });
  await compressArchive(stageRoot, outputPackage);
  if (options.install) await installAtomically(stageRoot, path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID));
  console.log(JSON.stringify({ ok: true, moduleId: MODULE_ID, version: `${OPENCV_VERSION}+bridge.1`, outputPackage, installed: options.install }, null, 2));
}

function parseArgs(args) {
  const options = { source: '', out: '', install: false };
  for (let index = 0; index < args.length; ++index) {
    const value = args[index];
    if (value === '--source') options.source = args[++index] || '';
    else if (value === '--out') options.out = args[++index] || '';
    else if (value === '--install') options.install = true;
    else throw new Error(`未知参数：${value}`);
  }
  return options;
}

function moduleManifest() {
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: 'LingBuilder OpenCV SDK',
    version: `${OPENCV_VERSION}+bridge.1`,
    category: '图像',
    description: 'OpenCV 4.14.0 x64 /MD 最小运行时与 LingBuilder 稳定 C ABI Bridge，只作为 lingbuilder.opencv 的受管资产模块。',
    author: 'LingBuilder',
    license: 'Apache-2.0',
    tags: ['SDK', 'OpenCV', 'x64', '只读资产']
  };
}

function moduleReadme() {
  return `# LingBuilder OpenCV SDK\n\n固定 OpenCV ${OPENCV_VERSION}、Windows MSVC x64、动态 CRT /MD。只包含 core、imgproc、imgcodecs 和 LingBuilder C ABI Bridge。\n\n该模块由构建链自动使用，不应在项目中单独启用。OpenCV 使用 Apache-2.0 许可证，许可证文本位于 licenses/OpenCV-LICENSE.txt。\n`;
}

async function assertSourceVersion(sourceRoot) {
  const versionHeader = path.join(sourceRoot, 'modules', 'core', 'include', 'opencv2', 'core', 'version.hpp');
  const content = await fs.readFile(versionHeader, 'utf8');
  const major = content.match(/CV_VERSION_MAJOR\s+(\d+)/)?.[1];
  const minor = content.match(/CV_VERSION_MINOR\s+(\d+)/)?.[1];
  const revision = content.match(/CV_VERSION_REVISION\s+(\d+)/)?.[1];
  if (`${major}.${minor}.${revision}` !== OPENCV_VERSION) throw new Error(`OpenCV 源码版本不匹配：${major}.${minor}.${revision}`);
}

async function findCmake() {
  const fromPath = await tryCommand('cmake.exe', ['--version']);
  if (fromPath) return 'cmake.exe';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const vswhere = path.join(programFilesX86, 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');
  const installation = (await execFileAsync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], commandOptions())).stdout.trim();
  const bundled = path.join(installation, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin', 'cmake.exe');
  if (!await exists(bundled)) throw new Error('没有找到 Visual Studio 2022 自带的 CMake。');
  return bundled;
}

async function run(executable, args, cwd, timeout) {
  console.log(`> ${path.basename(executable)} ${args.join(' ')}`);
  try {
    const result = await execFileAsync(executable, args, { cwd, windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024 });
    if (result.stdout.trim()) console.log(result.stdout.trim());
    if (result.stderr.trim()) console.error(result.stderr.trim());
  } catch (error) {
    if (error && typeof error === 'object') {
      if (typeof error.stdout === 'string' && error.stdout.trim()) console.error(error.stdout.trim());
      if (typeof error.stderr === 'string' && error.stderr.trim()) console.error(error.stderr.trim());
    }
    throw error;
  }
}

async function tryCommand(executable, args) { try { await execFileAsync(executable, args, commandOptions()); return true; } catch { return false; } }
function commandOptions() { return { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 }; }
function escapePowerShell(value) { return value.replace(/'/g, "''"); }
async function exists(target) { try { await fs.access(target); return true; } catch { return false; } }
async function sha256File(target) { const hash = crypto.createHash('sha256'); hash.update(await fs.readFile(target)); return hash.digest('hex'); }
async function copyFile(source, target) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); }
async function listFiles(root) { const files = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory()) files.push(...await listFiles(target)); else if (entry.isFile()) files.push(target); } return files; }
async function findFileRecursive(root, name) { if (!await exists(root)) return null; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isFile() && entry.name.toLowerCase() === name.toLowerCase()) return target; if (entry.isDirectory()) { const found = await findFileRecursive(target, name); if (found) return found; } } return null; }
async function copyDirectory(source, target) { await fs.mkdir(target, { recursive: true }); for (const entry of await fs.readdir(source, { withFileTypes: true })) { const from = path.join(source, entry.name), to = path.join(target, entry.name); if (entry.isDirectory()) await copyDirectory(from, to); else if (entry.isFile()) await fs.copyFile(from, to); } }
async function installAtomically(source, target) { const staging = `${target}.staging-${process.pid}`, backup = `${target}.previous-${process.pid}`; await fs.rm(staging, { recursive: true, force: true }); await fs.rm(backup, { recursive: true, force: true }); await copyDirectory(source, staging); try { try { await fs.rename(target, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; } await fs.rename(staging, target); await fs.rm(backup, { recursive: true, force: true }); } catch (error) { try { await fs.rename(backup, target); } catch {} throw error; } }
async function compressArchive(source, target) { const zip = `${target}.zip`; await fs.rm(zip, { force: true }); await fs.rm(target, { force: true }); await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path '${escapePowerShell(path.join(source, '*'))}' -DestinationPath '${escapePowerShell(zip)}' -Force`], commandOptions()); await fs.rename(zip, target); }
async function download(url, target) { const response = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'LingBuilder-OpenCV-SDK' } }); if (!response.ok) throw new Error(`下载失败：${url} / HTTP ${response.status}`); await fs.mkdir(path.dirname(target), { recursive: true }); const temporary = `${target}.download-${process.pid}`; const bytes = Buffer.from(await response.arrayBuffer()); await fs.writeFile(temporary, bytes); await fs.rename(temporary, target); }

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
