const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MODULE_ID = 'lingbuilder.fbro.sdk';
const SDK_VERSION = '135.0.21';
const BRIDGE_VERSION = '1.0.0';
const DEFAULT_SOURCE = 'T:\\编程工具\\win_android\\plugins\\vprj_win\\classlib\\sys\\FBrowser';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.FBRO_OFFICIAL_ROOT || DEFAULT_SOURCE);
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const installRoot = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
  await assertSource(sourceRoot);

  const cmake = await findCmake();
  const bridgeBuild = path.join(repoRoot, '.lingbuilder-build', 'fbro-bridge');
  await execFileAsync(cmake, ['-S', path.join(repoRoot, 'electron', 'native', 'fbro-bridge'), '-B', bridgeBuild,
    '-A', 'x64', `-DFBRO_SDK_ROOT=${sourceRoot}`], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  await execFileAsync(cmake, ['--build', bridgeBuild, '--config', 'Release', '--target', 'LingBuilderFbroBridge'],
    { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });

  await fs.rm(workRoot, { recursive: true, force: true });
  const sdkRoot = path.join(workRoot, 'sdk');
  await fs.mkdir(sdkRoot, { recursive: true });
  await writeText(path.join(workRoot, 'lingbuilder.module.json'), `${JSON.stringify(buildModuleManifest(), null, 2)}\n`);
  await writeText(path.join(workRoot, 'README.md'), moduleReadme());

  await fs.copyFile(path.join(repoRoot, 'electron', 'native', 'fbro-bridge', 'LingBuilderFbroBridge.h'),
    path.join(await mkdir(path.join(sdkRoot, 'include')), 'LingBuilderFbroBridge.h'));
  await fs.copyFile(path.join(bridgeBuild, 'Release', 'LingBuilderFbroBridge.lib'),
    path.join(await mkdir(path.join(sdkRoot, 'lib', 'x64')), 'LingBuilderFbroBridge.lib'));
  await fs.copyFile(path.join(bridgeBuild, 'Release', 'LingBuilderFbroBridge.dll'),
    path.join(await mkdir(path.join(sdkRoot, 'bridge', 'x64')), 'LingBuilderFbroBridge.dll'));

  const officialInclude = path.join(sourceRoot, 'src', 'env', 'FBrowserCEF3lib');
  const officialLib = path.join(sourceRoot, 'src', 'env', 'lib64');
  await copyDirectory(officialInclude, path.join(sdkRoot, 'official', 'include'));
  await copyDirectory(officialLib, path.join(sdkRoot, 'official', 'lib64'));

  const runtimeSource = path.join(sourceRoot, 'src', 'CEFLib64');
  const runtimeTarget = path.join(sdkRoot, 'runtime', 'x64');
  await copyDirectory(runtimeSource, runtimeTarget);
  const runtimeFiles = await listFiles(runtimeTarget);
  const files = [];
  for (const file of runtimeFiles) {
    const stat = await fs.stat(file);
    files.push({
      path: path.relative(runtimeTarget, file).replace(/\\/g, '/'),
      size: stat.size,
      sha256: await sha256File(file)
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = { schemaVersion: 1, sdkVersion: SDK_VERSION, architecture: 'x64', bridgeVersion: BRIDGE_VERSION, files };
  await writeText(path.join(sdkRoot, 'runtime-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  if (args.install) {
    const staging = `${installRoot}.staging-${process.pid}`;
    await fs.rm(staging, { recursive: true, force: true });
    await copyDirectory(workRoot, staging);
    const backup = `${installRoot}.previous-${process.pid}`;
    await fs.rm(backup, { recursive: true, force: true });
    try {
      try { await fs.rename(installRoot, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; }
      try {
        await fs.rename(staging, installRoot);
      } catch (error) {
        // Windows 上 Electron/杀毒软件可能短暂持有新目录句柄，导致目录重命名返回 EPERM。
        // 此时仍保持旧 SDK 在 backup 中，采用逐文件复制完成安装后再清理 staging。
        if (process.platform !== 'win32' || !['EPERM', 'EACCES'].includes(error.code)) throw error;
        await copyDirectory(staging, installRoot);
        await fs.rm(staging, { recursive: true, force: true });
      }
      await fs.rm(backup, { recursive: true, force: true });
    } catch (error) {
      try { await fs.rename(backup, installRoot); } catch { /* 保留原始异常。 */ }
      throw error;
    }
  }

  console.log(`FBro SDK ${SDK_VERSION} x64 generated: ${files.length} runtime files.`);
  console.log(`Runtime bytes: ${files.reduce((sum, file) => sum + file.size, 0)}`);
  console.log(`Module directory: ${args.install ? installRoot : workRoot}`);
}

function parseArgs(values) {
  const result = { source: '', install: false };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--source') result.source = values[++index] || '';
    else if (values[index] === '--install') result.install = true;
  }
  return result;
}

async function assertSource(root) {
  const required = [
    ['src', 'env', 'FBrowserCEF3lib', 'FBroInit.h'],
    ['src', 'env', 'lib64', 'FBrowserCEF3lib.lib'],
    ['src', 'env', 'lib64', 'FBrowserVIP.lib'],
    ['src', 'env', 'lib64', 'libcef.lib'],
    ['src', 'env', 'lib64', 'release', 'libcef_dll_wrapper.lib'],
    ['src', 'CEFLib64', 'libcef.dll'],
    ['src', 'CEFLib64', 'FBroSubprocess.exe']
  ];
  for (const parts of required) {
    const target = path.join(root, ...parts);
    try { await fs.access(target); } catch { throw new Error(`FBro 官方 SDK 缺少文件：${target}`); }
  }
  const versionHeader = await fs.readFile(path.join(root, 'src', 'env', 'FBrowserCEF3lib', 'include', 'cef_version.h'), 'utf8');
  if (!versionHeader.includes('135.0.21')) throw new Error(`FBro CEF 版本不匹配，需要 ${SDK_VERSION}。`);
}

async function findCmake() {
  const candidates = [
    'cmake.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe'
  ];
  for (const candidate of candidates) {
    try { await execFileAsync(candidate, ['--version'], { windowsHide: true }); return candidate; } catch { /* next */ }
  }
  throw new Error('未找到 CMake/Visual Studio 2022，无法编译 LingBuilderFbroBridge.dll。');
}

function buildModuleManifest() {
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: 'FBro 135 内置 SDK（x64）',
    version: `${SDK_VERSION}.${BRIDGE_VERSION}`,
    category: '界面',
    description: 'FBro CEF 135 x64 只读资产模块，包含固定头文件、库、C ABI 桥接层、运行时与 SHA-256 清单；项目无需单独启用。'
  };
}

function moduleReadme() {
  return `# FBro 135 内置 SDK（x64）\n\n此目录由 \`npm run module:fbro-sdk -- --install\` 生成。项目只通过 LingBuilderFbroBridge C ABI 使用 SDK。\nIDE 用户在“设置 → 浏览器凭据”中加密保存自己的 VIP Key；脱离 IDE 运行导出工程时可通过 LINGBUILDER_FBRO_VIP_KEY 环境变量提供。\n`;
}

async function mkdir(target) { await fs.mkdir(target, { recursive: true }); return target; }
async function writeText(target, content) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, 'utf8'); }
async function copyDirectory(source, target) {
  await fs.mkdir(target, { recursive: true });
  for (const entry of await fs.readdir(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name); const to = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(from, to);
    else if (entry.isFile()) await fs.copyFile(from, to);
  }
}
async function listFiles(root) {
  const result = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) result.push(...await listFiles(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}
async function sha256File(target) {
  const hash = crypto.createHash('sha256');
  const handle = await fs.open(target, 'r');
  try {
    const buffer = Buffer.allocUnsafe(1024 * 1024);
    let position = 0;
    while (true) {
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, position);
      if (!bytesRead) break;
      hash.update(buffer.subarray(0, bytesRead)); position += bytesRead;
    }
  } finally { await handle.close(); }
  return hash.digest('hex');
}

main().catch(error => { console.error(error.message || error); process.exitCode = 1; });
