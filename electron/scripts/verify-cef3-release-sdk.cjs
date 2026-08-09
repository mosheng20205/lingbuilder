const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MODULE_ID = 'lingbuilder.cef3.sdk';
const MODULE_RELATIVE_PATH = path.join('.lingbuilder', 'modules', MODULE_ID);
const PACKAGED_MODULE_PREFIX = `resources/default-workspace/.lingbuilder/modules/${MODULE_ID}/`;
const MINIMUM_FILE_COUNT = 500;
const MINIMUM_TOTAL_BYTES = 440 * 1024 * 1024;
const CRITICAL_FILES = new Map([
  ['lingbuilder.module.json', 500],
  ['README.md', 500],
  ['sdk/include/cef_app.h', 5_000],
  ['sdk/include/cef_version.h', 1_000],
  ['sdk/Release/libcef.dll', 250 * 1024 * 1024],
  ['sdk/Release/libcef.lib', 50_000],
  ['sdk/Release/chrome_elf.dll', 2 * 1024 * 1024],
  ['sdk/Release/v8_context_snapshot.bin', 500_000],
  ['sdk/build_wrapper_x64_md/libcef_dll_wrapper/Release/libcef_dll_wrapper.lib', 40 * 1024 * 1024],
  ['sdk/Resources/icudtl.dat', 8 * 1024 * 1024],
  ['sdk/Resources/resources.pak', 12 * 1024 * 1024],
  ['sdk/Resources/locales/zh-CN.pak', 400_000],
  ['sdk/Resources/locales/en-US.pak', 400_000],
  ['sdk/bridge/x64/LingBuilderCefBridge.h', 4_000],
  ['sdk/bridge/x64/LingBuilderCefBridge.lib', 1_000],
  ['sdk/bridge/x64/LingBuilderCefBridge.dll', 10_000],
  ['sdk/bridge/x64/VERSION.json', 300]
]);

const CRC_TABLE = createCrcTable();

async function verifySourceSdk(projectRoot = path.resolve(__dirname, '..', '..')) {
  const moduleRoot = path.join(projectRoot, MODULE_RELATIVE_PATH);
  const packageJsonPath = path.join(projectRoot, 'electron', 'package.json');
  const [manifest, packageJson, versionHeader] = await Promise.all([
    readJson(path.join(moduleRoot, 'lingbuilder.module.json'), '缺少 CEF3 SDK 模块清单'),
    readJson(packageJsonPath, '无法读取 Electron package.json'),
    fsp.readFile(path.join(moduleRoot, 'sdk', 'include', 'cef_version.h'), 'utf8')
      .catch(error => { throw new Error(`缺少 CEF 版本头文件：${error.message}`); })
  ]);

  if (manifest.schemaVersion !== 2 || manifest.id !== MODULE_ID) {
    throw new Error(`CEF3 SDK 模块清单无效：需要 schemaVersion=2 且 id=${MODULE_ID}。`);
  }
  if (typeof manifest.version !== 'string' || !manifest.version.trim()) {
    throw new Error('CEF3 SDK 模块清单缺少版本号。');
  }
  const headerVersion = versionHeader.match(/^#define CEF_VERSION "([^"]+)"/mu)?.[1];
  if (!headerVersion || headerVersion !== manifest.version) {
    throw new Error(`CEF3 SDK 版本不一致：manifest=${manifest.version}，header=${headerVersion || '未识别'}。`);
  }
  const extraResources = packageJson?.build?.extraResources;
  const includesModules = Array.isArray(extraResources) && extraResources.some(item =>
    normalizeRelative(item?.from) === '../.lingbuilder/modules'
      && normalizeRelative(item?.to) === 'default-workspace/.lingbuilder/modules'
  );
  if (!includesModules) {
    throw new Error('Electron 发布配置未把 ../.lingbuilder/modules 映射到 default-workspace/.lingbuilder/modules。');
  }

  for (const [relativePath, minimumBytes] of CRITICAL_FILES) {
    const stat = await fsp.stat(path.join(moduleRoot, ...relativePath.split('/')))
      .catch(() => { throw new Error(`CEF3 SDK 缺少关键文件：${relativePath}`); });
    if (!stat.isFile() || stat.size < minimumBytes) {
      throw new Error(`CEF3 SDK 关键文件不完整：${relativePath}（${stat.size} bytes，最少 ${minimumBytes}）。`);
    }
  }
  await verifyBridgeMetadata(path.join(moduleRoot, 'sdk', 'bridge', 'x64'), headerVersion);
  await Promise.all([
    assertPeX64(path.join(moduleRoot, 'sdk', 'Release', 'libcef.dll')),
    assertPeX64(path.join(moduleRoot, 'sdk', 'Release', 'chrome_elf.dll')),
    assertPeX64(path.join(moduleRoot, 'sdk', 'bridge', 'x64', 'LingBuilderCefBridge.dll'))
  ]);

  const inventory = await collectDirectoryInventory(moduleRoot);
  const totalBytes = [...inventory.values()].reduce((sum, item) => sum + item.size, 0);
  if (inventory.size < MINIMUM_FILE_COUNT || totalBytes < MINIMUM_TOTAL_BYTES) {
    throw new Error(`CEF3 SDK 文件集不完整：${inventory.size} 个文件 / ${totalBytes} bytes，最少要求 ${MINIMUM_FILE_COUNT} 个文件 / ${MINIMUM_TOTAL_BYTES} bytes。`);
  }
  return { moduleRoot, manifest, inventory, totalBytes };
}

async function verifyPackagedDirectory(appOutDir, projectRoot = path.resolve(__dirname, '..', '..')) {
  const source = await verifySourceSdk(projectRoot);
  const packagedRoot = path.join(appOutDir, ...PACKAGED_MODULE_PREFIX.split('/').filter(Boolean));
  const packagedInventory = await collectDirectoryInventory(packagedRoot)
    .catch(error => { throw new Error(`发布目录缺少 CEF3 SDK：${packagedRoot}\n${error.message}`); });
  compareInventories(source.inventory, packagedInventory, '发布目录');
  return { ...source, packagedRoot };
}

async function verifyInstallerArchive(installerPath, projectRoot = path.resolve(__dirname, '..', '..')) {
  const source = await verifySourceSdk(projectRoot);
  const sevenZipPath = await findSevenZip();
  if (!sevenZipPath) {
    throw new Error('无法找到 7za.exe，不能校验 NSIS 安装包内的 CEF3 SDK，拒绝完成发布。');
  }
  await fsp.access(installerPath).catch(() => { throw new Error(`未找到待校验的安装包：${installerPath}`); });
  const { stdout } = await execFileAsync(sevenZipPath, ['l', '-slt', installerPath], {
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 5 * 60 * 1000
  });
  const archiveEntries = parseSevenZipListing(stdout);
  const packagedInventory = new Map();
  for (const [archivePath, item] of archiveEntries) {
    const normalized = normalizeRelative(archivePath);
    if (!normalized.startsWith(PACKAGED_MODULE_PREFIX)) continue;
    const relativePath = normalized.slice(PACKAGED_MODULE_PREFIX.length);
    if (!relativePath || item.isDirectory) continue;
    packagedInventory.set(relativePath, { size: item.size, crc32: item.crc32 });
  }
  compareInventories(source.inventory, packagedInventory, 'NSIS 安装包');
  return { ...source, installerPath, sevenZipPath };
}

async function collectDirectoryInventory(root) {
  const inventory = new Map();
  async function visit(directory, relativeRoot = '') {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name, 'en'));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = normalizeRelative(path.join(relativeRoot, entry.name));
      if (entry.isSymbolicLink()) throw new Error(`CEF3 SDK 不允许符号链接：${relativePath}`);
      if (entry.isDirectory()) await visit(absolutePath, relativePath);
      else if (entry.isFile()) {
        const stat = await fsp.stat(absolutePath);
        inventory.set(relativePath, { size: stat.size, crc32: await crc32File(absolutePath) });
      }
    }
  }
  await visit(root);
  return inventory;
}

function compareInventories(expected, actual, label) {
  const errors = [];
  for (const [relativePath, expectedItem] of expected) {
    const actualItem = actual.get(relativePath);
    if (!actualItem) errors.push(`缺少 ${relativePath}`);
    else if (actualItem.size !== expectedItem.size || actualItem.crc32 !== expectedItem.crc32) {
      errors.push(`不一致 ${relativePath}（期望 ${expectedItem.size}/${expectedItem.crc32}，实际 ${actualItem.size}/${actualItem.crc32}）`);
    }
  }
  for (const relativePath of actual.keys()) if (!expected.has(relativePath)) errors.push(`额外 ${relativePath}`);
  if (errors.length) {
    throw new Error(`${label} CEF3 SDK 完整性校验失败（${errors.length} 项）：\n${errors.slice(0, 20).join('\n')}`);
  }
}

function parseSevenZipListing(output) {
  const entries = new Map();
  for (const block of String(output).split(/\r?\n\r?\n/u)) {
    const fields = {};
    for (const line of block.split(/\r?\n/u)) {
      const index = line.indexOf(' = ');
      if (index > 0) fields[line.slice(0, index)] = line.slice(index + 3);
    }
    if (!fields.Path || fields.Size === undefined || fields.Attributes === undefined) continue;
    const isDirectory = fields.Attributes.includes('D');
    if (!isDirectory && !/^[0-9A-F]{8}$/iu.test(fields.CRC || '')) continue;
    entries.set(fields.Path, {
      size: Number.parseInt(fields.Size, 10),
      crc32: isDirectory ? '' : fields.CRC.toUpperCase(),
      isDirectory
    });
  }
  return entries;
}

async function crc32File(filePath) {
  let crc = 0xFFFFFFFF;
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) {
    for (let index = 0; index < chunk.length; index += 1) {
      crc = CRC_TABLE[(crc ^ chunk[index]) & 0xFF] ^ (crc >>> 8);
    }
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[value] = crc >>> 0;
  }
  return table;
}

async function assertPeX64(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const dosHeader = Buffer.alloc(64);
    await handle.read(dosHeader, 0, dosHeader.length, 0);
    if (dosHeader.readUInt16LE(0) !== 0x5A4D) throw new Error(`${filePath} 不是有效 PE 文件。`);
    const peOffset = dosHeader.readUInt32LE(0x3C);
    const peHeader = Buffer.alloc(6);
    await handle.read(peHeader, 0, peHeader.length, peOffset);
    if (peHeader.readUInt32LE(0) !== 0x00004550 || peHeader.readUInt16LE(4) !== 0x8664) {
      throw new Error(`${filePath} 不是 x64 PE 产物。`);
    }
  } finally {
    await handle.close();
  }
}

async function verifyBridgeMetadata(bridgeRoot, cefVersion) {
  const metadata = await readJson(path.join(bridgeRoot, 'VERSION.json'), 'CEF3 Bridge 缺少版本与校验清单');
  const compatibleAbis = Array.isArray(metadata.compatibleBridgeAbis) ? metadata.compatibleBridgeAbis : [];
  if (metadata.schemaVersion !== 2 || metadata.bridgeAbi !== '4.0.0'
      || !compatibleAbis.includes('3.0.0') || !compatibleAbis.includes('4.0.0')
      || metadata.platform !== 'windows-msvc-x64' || metadata.cefVersion !== cefVersion) {
    throw new Error(`CEF3 Bridge 元数据不匹配：ABI=${metadata.bridgeAbi}，CEF=${metadata.cefVersion}，平台=${metadata.platform}。`);
  }
  for (const name of ['LingBuilderCefBridge.h', 'LingBuilderCefBridge.lib', 'LingBuilderCefBridge.dll']) {
    const expected = metadata.files?.[name];
    if (!/^[0-9a-f]{64}$/iu.test(expected || '')) throw new Error(`CEF3 Bridge 校验清单缺少 ${name}。`);
    const actual = await sha256File(path.join(bridgeRoot, name));
    if (actual !== expected.toLowerCase()) throw new Error(`CEF3 Bridge SHA-256 不匹配：${name}。`);
  }
}

async function sha256File(filePath) {
  const hash = require('node:crypto').createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function findSevenZip() {
  const explicit = process.env.LINGBUILDER_7ZA_PATH;
  if (explicit && await isFile(explicit)) return path.resolve(explicit);
  try {
    const { stdout } = await execFileAsync('where.exe', ['7za.exe'], { windowsHide: true, timeout: 10_000 });
    const candidate = stdout.split(/\r?\n/u).map(item => item.trim()).find(Boolean);
    if (candidate && await isFile(candidate)) return candidate;
  } catch {
    // 继续搜索 electron-builder 缓存。
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;
  return await findNamedFile(path.join(localAppData, 'electron-builder', 'Cache'), '7za.exe', 6);
}

async function findNamedFile(root, fileName, depth) {
  if (depth < 0) return null;
  let entries;
  try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { return null; }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isFile() && entry.name.toLowerCase() === fileName.toLowerCase()) return fullPath;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findNamedFile(path.join(root, entry.name), fileName, depth - 1);
    if (found) return found;
  }
  return null;
}

async function isFile(filePath) {
  try { return (await fsp.stat(filePath)).isFile(); } catch { return false; }
}

async function readJson(filePath, label) {
  try { return JSON.parse(await fsp.readFile(filePath, 'utf8')); }
  catch (error) { throw new Error(`${label}：${filePath}\n${error.message}`); }
}

function normalizeRelative(value) {
  return String(value || '').replace(/\\/gu, '/').replace(/^\.\//u, '');
}

function resolveInstallerPath(projectRoot) {
  const packageJson = require(path.join(projectRoot, 'electron', 'package.json'));
  return path.join(projectRoot, 'electron', 'release', `LingBuilder-${packageJson.version}-x64.exe`);
}

async function main() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  const mode = process.argv[2] || 'source';
  let result;
  if (mode === 'source') result = await verifySourceSdk(projectRoot);
  else if (mode === 'unpacked') {
    const appOutDir = path.resolve(process.argv[3] || path.join(projectRoot, 'electron', 'release', 'win-unpacked'));
    result = await verifyPackagedDirectory(appOutDir, projectRoot);
  } else if (mode === 'installer') {
    result = await verifyInstallerArchive(path.resolve(process.argv[3] || resolveInstallerPath(projectRoot)), projectRoot);
  } else throw new Error(`未知校验模式：${mode}`);
  console.log(JSON.stringify({
    ok: true,
    mode,
    moduleId: MODULE_ID,
    version: result.manifest.version,
    files: result.inventory.size,
    bytes: result.totalBytes,
    target: result.installerPath || result.packagedRoot || result.moduleRoot
  }, null, 2));
}

if (require.main === module) {
  main().catch(error => {
    console.error(`CEF3 发布 SDK 校验失败：${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}

module.exports = {
  MODULE_ID,
  PACKAGED_MODULE_PREFIX,
  collectDirectoryInventory,
  compareInventories,
  crc32File,
  findSevenZip,
  parseSevenZipListing,
  resolveInstallerPath,
  verifyInstallerArchive,
  verifyPackagedDirectory,
  verifySourceSdk
};
