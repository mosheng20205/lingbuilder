const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { findSevenZip, parseSevenZipListing } = require('./verify-cef3-release-sdk.cjs');

const execFileAsync = promisify(execFile);
const SDK_MODULE_IDS = ['lingbuilder.cef3.sdk', 'lingbuilder.fbro.sdk'];
const PACKAGED_MODULE_ROOT = 'resources/default-workspace/.lingbuilder/modules';
const FORBIDDEN_SDK_ASSET_NAMES = new Set([
  'libcef.dll',
  'fbrowservip.dll',
  'lingbuilderfbrobridge.dll',
  'lingbuildercefbridge.dll'
]);
const ARIA2_RESOURCE_PATHS = [
  'resources/third_party/aria2/aria2c.exe',
  'resources/third_party/aria2/COPYING',
  'resources/third_party/aria2/NOTICE.md'
];

async function verifyUnpacked(appOutDir) {
  const moduleRoot = path.join(appOutDir, ...PACKAGED_MODULE_ROOT.split('/'));
  const results = [];
  for (const moduleId of SDK_MODULE_IDS) {
    const root = path.join(moduleRoot, moduleId);
    const manifest = JSON.parse(await fsp.readFile(path.join(root, 'lingbuilder.module.json'), 'utf8'));
    const readme = await fsp.readFile(path.join(root, 'README.md'), 'utf8');
    if (manifest.schemaVersion !== 2 || manifest.id !== moduleId) throw new Error(`${moduleId} 轻量模块清单无效。`);
    if (readme.trim().length < 100) throw new Error(`${moduleId} README 缺失或内容过短。`);
    if (await pathExists(path.join(root, 'sdk'))) throw new Error(`发布目录仍包含 ${moduleId}/sdk，按需下载瘦身失败。`);
    results.push({ moduleId, version: manifest.version });
  }
  await assertNoHiddenSdkAssets(appOutDir);
  await assertBundledAria2(appOutDir);
  return { mode: 'unpacked', target: appOutDir, modules: results };
}

async function verifyInstaller(installerPath) {
  const sevenZip = await findSevenZip();
  if (!sevenZip) throw new Error('未找到 7za.exe，不能验证安装包 SDK 瘦身结果。');
  const { stdout } = await execFileAsync(sevenZip, ['l', '-slt', installerPath], {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 5 * 60 * 1000
  });
  const entries = parseSevenZipListing(stdout);
  const normalizedPaths = [...entries.keys()].map(normalizeRelative);
  for (const moduleId of SDK_MODULE_IDS) {
    const prefix = `${PACKAGED_MODULE_ROOT}/${moduleId}/`;
    for (const required of ['lingbuilder.module.json', 'README.md']) {
      if (!normalizedPaths.includes(`${prefix}${required}`)) throw new Error(`安装包缺少 ${prefix}${required}。`);
    }
    if (normalizedPaths.some(item => item.startsWith(`${prefix}sdk/`))) {
      throw new Error(`安装包仍包含 ${moduleId}/sdk，按需下载瘦身失败。`);
    }
  }
  assertNoHiddenSdkAssetPaths(normalizedPaths);
  for (const required of ARIA2_RESOURCE_PATHS) {
    if (!normalizedPaths.includes(required)) throw new Error(`安装包缺少 aria2 运行时资源：${required}。`);
  }
  return { mode: 'installer', target: installerPath, modules: SDK_MODULE_IDS.map(moduleId => ({ moduleId })) };
}

async function assertBundledAria2(appOutDir) {
  const aria2c = path.join(appOutDir, 'resources', 'third_party', 'aria2', 'aria2c.exe');
  const copying = path.join(appOutDir, 'resources', 'third_party', 'aria2', 'COPYING');
  const notice = path.join(appOutDir, 'resources', 'third_party', 'aria2', 'NOTICE.md');
  const aria2Stat = await fsp.stat(aria2c).catch(() => null);
  const copyingStat = await fsp.stat(copying).catch(() => null);
  const noticeStat = await fsp.stat(notice).catch(() => null);
  if (!aria2Stat?.isFile() || aria2Stat.size < 1_000_000) throw new Error('发布目录缺少有效的 aria2c.exe。');
  if (!copyingStat?.isFile() || copyingStat.size < 1_000) throw new Error('发布目录缺少 aria2 GPLv2 许可文件。');
  if (!noticeStat?.isFile() || noticeStat.size < 200) throw new Error('发布目录缺少 aria2 来源与源码说明。');
}

async function assertNoHiddenSdkAssets(appOutDir) {
  const roots = [
    path.join(appOutDir, 'resources', 'default-workspace'),
    path.join(appOutDir, 'resources', 'docs')
  ];
  const paths = [];
  for (const root of roots) {
    if (!await pathExists(root)) continue;
    const queue = [root];
    while (queue.length > 0) {
      const directory = queue.shift();
      for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) queue.push(target);
        else if (entry.isFile()) paths.push(normalizeRelative(path.relative(appOutDir, target)));
      }
    }
  }
  assertNoHiddenSdkAssetPaths(paths);
}

function assertNoHiddenSdkAssetPaths(paths) {
  const hidden = paths.find(item => FORBIDDEN_SDK_ASSET_NAMES.has(path.posix.basename(item).toLowerCase()));
  if (hidden) throw new Error(`发布资源仍夹带 CEF3/FBro SDK 二进制：${hidden}`);
}

async function pathExists(target) {
  try { await fsp.access(target); return true; } catch { return false; }
}

function normalizeRelative(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^\.\//u, '');
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const mode = process.argv[2] || 'unpacked';
  let result;
  if (mode === 'unpacked') {
    result = await verifyUnpacked(path.resolve(process.argv[3] || path.join(projectRoot, 'electron', 'release', 'win-unpacked')));
  } else if (mode === 'installer') {
    const packageJson = require(path.join(projectRoot, 'electron', 'package.json'));
    result = await verifyInstaller(path.resolve(process.argv[3] || path.join(projectRoot, 'electron', 'release', `LingBuilder-${packageJson.version}-x64.exe`)));
  } else {
    throw new Error(`未知校验模式：${mode}`);
  }
  console.log(JSON.stringify({ ok: true, ...result }, null, 2));
}

if (require.main === module) main().catch(error => {
  console.error(`按需下载 SDK 发布校验失败：${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

module.exports = { ARIA2_RESOURCE_PATHS, FORBIDDEN_SDK_ASSET_NAMES, SDK_MODULE_IDS, PACKAGED_MODULE_ROOT, verifyInstaller, verifyUnpacked };
