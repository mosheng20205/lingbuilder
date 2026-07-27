const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const {
  collectDirectoryInventory,
  compareInventories,
  parseSevenZipListing,
  findSevenZip
} = require('./verify-cef3-release-sdk.cjs');

const execFileAsync = promisify(execFile);
const MODULE_ID = 'lingbuilder.fbro.sdk';
const MODULE_RELATIVE_PATH = path.join('.lingbuilder', 'modules', MODULE_ID);
const PACKAGED_MODULE_PREFIX = `resources/default-workspace/.lingbuilder/modules/${MODULE_ID}/`;
const EXPECTED_VERSION = '135.0.21';

async function verifySource(projectRoot) {
  const moduleRoot = path.join(projectRoot, MODULE_RELATIVE_PATH);
  const manifest = JSON.parse(await fsp.readFile(path.join(moduleRoot, 'lingbuilder.module.json'), 'utf8'));
  const runtimeManifest = JSON.parse(await fsp.readFile(path.join(moduleRoot, 'sdk', 'runtime-manifest.json'), 'utf8'));
  if (manifest.id !== MODULE_ID || manifest.schemaVersion !== 2) throw new Error('FBro SDK 模块清单无效。');
  if (runtimeManifest.sdkVersion !== EXPECTED_VERSION || runtimeManifest.architecture !== 'x64') {
    throw new Error(`FBro SDK 版本/架构不匹配：${runtimeManifest.sdkVersion}/${runtimeManifest.architecture}`);
  }
  if (!Array.isArray(runtimeManifest.files) || runtimeManifest.files.length !== 78) {
    throw new Error(`FBro 运行时必须为 78 项，实际 ${runtimeManifest.files?.length || 0} 项。`);
  }
  const totalRuntimeBytes = runtimeManifest.files.reduce((sum, entry) => sum + Number(entry.size || 0), 0);
  if (totalRuntimeBytes < 380_000_000) throw new Error(`FBro 运行时体积异常：${totalRuntimeBytes} bytes。`);
  for (const relative of ['libcef.dll', 'FBroSubprocess.exe', 'locales/zh-CN.pak']) {
    if (!runtimeManifest.files.some(entry => entry.path === relative)) throw new Error(`FBro 运行时清单缺少 ${relative}。`);
  }
  for (const entry of runtimeManifest.files) {
    const file = path.join(moduleRoot, 'sdk', 'runtime', 'x64', ...entry.path.split('/'));
    const stat = await fsp.stat(file).catch(() => { throw new Error(`FBro 运行时缺少 ${entry.path}`); });
    if (stat.size !== entry.size || await sha256(file) !== entry.sha256.toLowerCase()) throw new Error(`FBro 运行时校验失败：${entry.path}`);
  }
  for (const relative of [
    'sdk/include/LingBuilderFbroBridge.h', 'sdk/lib/x64/LingBuilderFbroBridge.lib',
    'sdk/bridge/x64/LingBuilderFbroBridge.dll', 'sdk/official/include/FBroInit.h',
    'sdk/official/lib64/FBrowserCEF3lib.lib'
  ]) await fsp.access(path.join(moduleRoot, ...relative.split('/'))).catch(() => { throw new Error(`FBro SDK 缺少 ${relative}`); });
  const inventory = await collectDirectoryInventory(moduleRoot);
  return { moduleRoot, manifest, inventory, totalBytes: [...inventory.values()].reduce((sum, item) => sum + item.size, 0) };
}

async function verifyUnpacked(appOutDir, projectRoot) {
  const source = await verifySource(projectRoot);
  const packagedRoot = path.join(appOutDir, ...PACKAGED_MODULE_PREFIX.split('/'));
  compareInventories(source.inventory, await collectDirectoryInventory(packagedRoot), '发布目录 FBro SDK');
  return { ...source, packagedRoot };
}

async function verifyInstaller(installerPath, projectRoot) {
  const source = await verifySource(projectRoot);
  const sevenZip = await findSevenZip();
  if (!sevenZip) throw new Error('未找到 7za.exe，不能验证安装包中的 FBro SDK。');
  const { stdout } = await execFileAsync(sevenZip, ['l', '-slt', installerPath], { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 300000 });
  const entries = parseSevenZipListing(stdout);
  const packaged = new Map();
  for (const [archivePath, item] of entries) {
    const normalized = archivePath.replace(/\\/g, '/');
    if (!normalized.startsWith(PACKAGED_MODULE_PREFIX) || item.isDirectory) continue;
    packaged.set(normalized.slice(PACKAGED_MODULE_PREFIX.length), { size: item.size, crc32: item.crc32 });
  }
  compareInventories(source.inventory, packaged, 'NSIS 安装包 FBro SDK');
  return { ...source, installerPath };
}

async function sha256(file) {
  const hash = crypto.createHash('sha256');
  hash.update(await fsp.readFile(file));
  return hash.digest('hex');
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const mode = process.argv[2] || 'source';
  let result;
  if (mode === 'source') result = await verifySource(projectRoot);
  else if (mode === 'unpacked') result = await verifyUnpacked(path.resolve(process.argv[3] || path.join(projectRoot, 'electron', 'release', 'win-unpacked')), projectRoot);
  else if (mode === 'installer') {
    const packageJson = require(path.join(projectRoot, 'electron', 'package.json'));
    result = await verifyInstaller(path.resolve(process.argv[3] || path.join(projectRoot, 'electron', 'release', `LingBuilder-${packageJson.version}-x64.exe`)), projectRoot);
  } else throw new Error(`未知模式：${mode}`);
  console.log(JSON.stringify({ ok: true, mode, moduleId: MODULE_ID, files: result.inventory.size, bytes: result.totalBytes }, null, 2));
}

if (require.main === module) main().catch(error => { console.error(`FBro 发布 SDK 校验失败：${error.message || error}`); process.exitCode = 1; });
module.exports = { verifySource, verifyUnpacked, verifyInstaller };
