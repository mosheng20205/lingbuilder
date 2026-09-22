// 生成 lingbuilder.sunnynet.sdk：把 SunnyNet 官方 DLL 组装为带 runtime-manifest 校验的 SDK 模块。
// 用法：node scripts/generate-sunnynet-sdk-module.cjs --source <解压后的 [Full]SDK/windows 目录> [--install] [--lbmod]
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MODULE_ID = 'lingbuilder.sunnynet.sdk';
const SUNNYNET_VERSION = '1.5.1';
const SUNNYNET_BUILD = '2026-09-16';
const EXPECTED_FILES = [
  { file: 'Win32/SunnyNet.dll', source: 'SunnyNet.dll', sha256: '24f7fe102b986ba7512d2eed7264266d7256f37ae0d9154901a3f8d457bde58b' },
  { file: 'x64/SunnyNet64.dll', source: 'SunnyNet64.dll', sha256: '535331e65c9cbe6a087bc8ad5bf646cdf8b832c8da86fa08133bef447a180ea9' }
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source) throw new Error('缺少 --source 参数：指向解压后 SunnyNet [Full]SDK 的 windows 目录（含 SunnyNet.dll / SunnyNet64.dll）。');
  const repoRoot = path.resolve(__dirname, '..', '..');
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const installRoot = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'lingbuilder-sunnynet-sdk.lbmod');

  await fs.rm(workRoot, { recursive: true, force: true });
  const sdkRoot = path.join(workRoot, 'sdk');
  await fs.mkdir(sdkRoot, { recursive: true });
  await writeText(path.join(workRoot, 'lingbuilder.module.json'), `${JSON.stringify(moduleManifest(), null, 2)}\n`);
  await writeText(path.join(workRoot, 'README.md'), moduleReadme());
  const apiDocSource = path.join(args.source, 'README_api.md');
  if (await exists(apiDocSource)) await copyFile(apiDocSource, path.join(sdkRoot, 'docs', 'SunnyNet-API-参考.md'));

  const files = [];
  for (const entry of EXPECTED_FILES) {
    const source = path.join(args.source, entry.source);
    const target = path.join(sdkRoot, 'bin', entry.file.replace('/', path.sep));
    const hash = await sha256File(source);
    if (hash !== entry.sha256) throw new Error(`SunnyNet DLL SHA-256 校验失败（${entry.source}）：期望 ${entry.sha256}，实际 ${hash}。`);
    await copyFile(source, target);
    const stat = await fs.stat(target);
    files.push({ path: `bin/${entry.file}`, size: stat.size, sha256: hash });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  await writeText(path.join(sdkRoot, 'runtime-manifest.json'), `${JSON.stringify({ schemaVersion: 1, sdkVersion: SUNNYNET_VERSION, build: SUNNYNET_BUILD, files }, null, 2)}\n`);

  await fs.mkdir(packageDir, { recursive: true });
  await fs.rm(packagePath, { force: true });
  if (args.lbmod) await compressArchive(workRoot, packagePath);
  if (args.install) await installAtomically(workRoot, installRoot);
  console.log(`Generated ${MODULE_ID}: SunnyNet v${SUNNYNET_VERSION}（构建 ${SUNNYNET_BUILD}），${files.length} 个文件。`);
  if (args.lbmod) console.log(`Package: ${packagePath}`);
  if (args.install) console.log(`Installed: ${installRoot}`);
}

function parseArgs(values) {
  const result = { install: false, lbmod: false, source: '' };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--install') result.install = true;
    else if (values[index] === '--lbmod') result.lbmod = true;
    else if (values[index] === '--source') result.source = values[++index] || '';
  }
  return result;
}

function moduleManifest() {
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: '网络中间件 SDK',
    version: `${SUNNYNET_VERSION}`,
    category: '网络',
    description: 'SunnyNet 网络中间件的 Win32/x64 官方 DLL（MIT）；由网络中间件模块自动使用，无需项目单独启用。安装包不随 IDE 分发，通过按需下载获取。',
    author: 'LingBuilder',
    license: 'MIT',
    tags: ['SDK', '网络', '按需下载']
  };
}

function moduleReadme() {
  return `# LingBuilder 网络中间件 SDK\n\nSunnyNet v${SUNNYNET_VERSION}（构建 ${SUNNYNET_BUILD}）官方 Win32/x64 DLL，SHA-256 见 runtime-manifest.json。 lingbuilder.sunnynet 模块构建时自动消费本 SDK。\n`;
}

async function copyFile(source, target) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); }
async function writeText(target, content) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, 'utf8'); }
async function exists(target) { try { await fs.access(target); return true; } catch { return false; } }
async function sha256File(target) { const hash = crypto.createHash('sha256'); hash.update(await fs.readFile(target)); return hash.digest('hex'); }
async function copyDirectory(source, target) { await fs.mkdir(target, { recursive: true }); for (const entry of await fs.readdir(source, { withFileTypes: true })) { const from = path.join(source, entry.name), to = path.join(target, entry.name); if (entry.isDirectory()) await copyDirectory(from, to); else if (entry.isFile()) await fs.copyFile(from, to); } }
async function installAtomically(source, target) { const staging = `${target}.staging-${process.pid}`; const backup = `${target}.previous-${process.pid}`; await fs.rm(staging, { recursive: true, force: true }); await fs.rm(backup, { recursive: true, force: true }); await copyDirectory(source, staging); try { try { await fs.rename(target, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; } await fs.rename(staging, target); await fs.rm(backup, { recursive: true, force: true }); } catch (error) { try { await fs.rename(backup, target); } catch {} throw error; } }
async function compressArchive(source, target) { const zip = `${target}.zip`; await fs.rm(zip, { force: true }); const quote = value => `'${value.replace(/'/g, "''")}'`; await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${quote(path.join(source, '*'))} -DestinationPath ${quote(zip)} -Force`], { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 }); await fs.rename(zip, target); }

main().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
