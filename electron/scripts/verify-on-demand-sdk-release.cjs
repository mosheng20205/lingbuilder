const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { findSevenZip, parseSevenZipListing } = require('./verify-cef3-release-sdk.cjs');

const execFileAsync = promisify(execFile);
const EXCLUDED_MODULE_IDS = ['lingbuilder.cef3.sdk', 'lingbuilder.fbro.sdk'];
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
  for (const moduleId of EXCLUDED_MODULE_IDS) {
    const root = path.join(moduleRoot, moduleId);
    if (await pathExists(root)) throw new Error(`发布目录仍包含 ${moduleId}，严格精简发布失败。`);
    results.push({ moduleId, excluded: true });
  }
  await assertNoHiddenSdkAssets(appOutDir);
  await assertBundledAria2(appOutDir);
  return { mode: 'unpacked', target: appOutDir, modules: results };
}

async function listArchiveEntries(sevenZip, target) {
  const { stdout } = await execFileAsync(sevenZip, ['l', '-slt', target], {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 5 * 60 * 1000
  });
  return parseSevenZipListing(stdout);
}

function listNsisEntryPaths(sevenZip, installerPath) {
  return execFileAsync(sevenZip, ['l', '-slt', installerPath], {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 5 * 60 * 1000
  }).then(({ stdout }) => {
    const paths = [];
    for (const block of String(stdout).split(/\r?\n\r?\n/u)) {
      const fields = {};
      for (const line of block.split(/\r?\n/u)) {
        const index = line.indexOf(' = ');
        if (index > 0) fields[line.slice(0, index)] = line.slice(index + 3);
      }
      // 归档自身的头信息块没有 Size/Attributes；NSIS 条目可能没有 CRC，仍必须参与检查。
      if (fields.Path && (fields.Size !== undefined || fields.Attributes !== undefined)) paths.push(fields.Path);
    }
    return paths;
  });
}

function assertSlimPayloadPaths(normalizedPaths, label) {
  for (const moduleId of EXCLUDED_MODULE_IDS) {
    const prefix = `${PACKAGED_MODULE_ROOT}/${moduleId}/`;
    if (normalizedPaths.some(item => item.startsWith(prefix))) throw new Error(`${label}仍包含 ${moduleId}，严格精简发布失败。`);
  }
  assertNoHiddenSdkAssetPaths(normalizedPaths);
}

function assertAria2Resources(normalizedPaths) {
  for (const required of ARIA2_RESOURCE_PATHS) {
    if (!normalizedPaths.includes(required)) throw new Error(`安装包缺少 aria2 运行时资源：${required}。`);
  }
}

async function verifyInstaller(installerPath) {
  const sevenZip = await findSevenZip();
  if (!sevenZip) throw new Error('未找到 7za.exe，不能验证安装包 SDK 瘦身结果。');
  const outerPaths = (await listNsisEntryPaths(sevenZip, installerPath)).map(normalizeRelative);
  assertSlimPayloadPaths(outerPaths, '安装包');

  // electron-builder 通过 nsis7z 把完整应用压缩为单个 app-*.7z 嵌入 NSIS 外壳，
  // 外层清单看不到应用文件，必须解出内嵌归档检查真实载荷。
  const embeddedArchives = outerPaths.filter(item => /\/app-[^/]+\.7z$/u.test(item));
  if (embeddedArchives.length === 0) throw new Error('安装包缺少内嵌应用归档（app-*.7z），无法校验精简结果。');
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-installer-verify-'));
  try {
    await execFileAsync(sevenZip, [
      'e', '-y', `-o${tempDir}`, installerPath,
      ...embeddedArchives.map(name => name.replace(/\//gu, '\\'))
    ], { windowsHide: true, maxBuffer: 32 * 1024 * 1024, timeout: 5 * 60 * 1000 });
    for (const fileName of await fsp.readdir(tempDir)) {
      const innerEntries = await listArchiveEntries(sevenZip, path.join(tempDir, fileName));
      const innerPaths = [...innerEntries.keys()].map(normalizeRelative);
      assertSlimPayloadPaths(innerPaths, '安装包内嵌应用归档');
      assertAria2Resources(innerPaths);
    }
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
  return { mode: 'installer', target: installerPath, modules: EXCLUDED_MODULE_IDS.map(moduleId => ({ moduleId, excluded: true })) };
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

module.exports = { ARIA2_RESOURCE_PATHS, EXCLUDED_MODULE_IDS, FORBIDDEN_SDK_ASSET_NAMES, PACKAGED_MODULE_ROOT, verifyInstaller, verifyUnpacked };
