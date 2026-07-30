const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const MODULE_ID = 'lingbuilder.crypto.sdk';
const BOTAN_VERSION = '3.12.0';
const BOTAN_SHA256 = '5370f98dc15f8c222ee1ce52cd61c8756a53be0dc57cc4c1b0714d5a09ad74fb';
const BOTAN_URL = `https://botan.randombit.net/releases/Botan-${BOTAN_VERSION}.tar.xz`;
const BLAKE3_VERSION = '1.8.5';
const BLAKE3_COMMIT = '93a431c78a52d7ccf0f366f106467f5070e6075e';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const cacheRoot = path.resolve(args.cache || path.join(os.tmpdir(), 'lingbuilder-crypto-sdk'));
  const botanRoot = path.resolve(args.botanSource || path.join(cacheRoot, `Botan-${BOTAN_VERSION}`));
  const blake3Root = path.resolve(args.blake3Source || path.join(cacheRoot, `BLAKE3-${BLAKE3_VERSION}`));
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const installRoot = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'lingbuilder-crypto-sdk.lbmod');

  await prepareBotan(cacheRoot, botanRoot);
  await prepareBlake3(blake3Root);
  const vsDevCmd = await findVsDevCmd();
  await buildBotan(botanRoot, vsDevCmd, 'x64', 'x86_64', 'build-x64', args.rebuild);
  await buildBotan(botanRoot, vsDevCmd, 'x86', 'x86_32', 'build-x86', args.rebuild);

  await fs.rm(workRoot, { recursive: true, force: true });
  const sdkRoot = path.join(workRoot, 'sdk');
  await fs.mkdir(sdkRoot, { recursive: true });
  await writeText(path.join(workRoot, 'lingbuilder.module.json'), `${JSON.stringify(moduleManifest(), null, 2)}\n`);
  await writeText(path.join(workRoot, 'README.md'), moduleReadme());

  await copyFile(path.join(botanRoot, 'build-x64', 'build', 'include', 'public', 'botan', 'ffi.h'), path.join(sdkRoot, 'include', 'botan', 'ffi.h'));
  for (const [buildDir, arch] of [['build-x86', 'Win32'], ['build-x64', 'x64']]) {
    await copyFile(path.join(botanRoot, buildDir, 'botan-3.lib'), path.join(sdkRoot, 'lib', arch, 'botan-3.lib'));
    await copyFile(path.join(botanRoot, buildDir, 'botan-3.dll'), path.join(sdkRoot, 'bin', arch, 'botan-3.dll'));
  }
  const blake3C = path.join(blake3Root, 'c');
  for (const name of ['blake3.c', 'blake3.h', 'blake3_dispatch.c', 'blake3_impl.h', 'blake3_portable.c']) {
    await copyFile(path.join(blake3C, name), path.join(sdkRoot, 'src', name));
  }
  await copyFile(path.join(blake3C, 'blake3.h'), path.join(sdkRoot, 'include', 'blake3.h'));
  await writeText(path.join(sdkRoot, 'src', 'blake3_amalgamation.c'), [
    '#define BLAKE3_NO_SSE2', '#define BLAKE3_NO_SSE41', '#define BLAKE3_NO_AVX2', '#define BLAKE3_NO_AVX512',
    '#include "blake3.c"', '#include "blake3_dispatch.c"', '#include "blake3_portable.c"', ''
  ].join('\n'));
  await copyFile(path.join(botanRoot, 'license.txt'), path.join(sdkRoot, 'licenses', 'Botan-LICENSE.txt'));
  await copyFile(path.join(blake3Root, 'LICENSE_A2'), path.join(sdkRoot, 'licenses', 'BLAKE3-LICENSE-Apache-2.0.txt'));
  await copyFile(path.join(blake3Root, 'LICENSE_CC0'), path.join(sdkRoot, 'licenses', 'BLAKE3-LICENSE-CC0.txt'));

  const files = [];
  for (const file of await listFiles(sdkRoot)) {
    const stat = await fs.stat(file);
    files.push({ path: path.relative(sdkRoot, file).replace(/\\/g, '/'), size: stat.size, sha256: await sha256File(file) });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  await writeText(path.join(sdkRoot, 'runtime-manifest.json'), `${JSON.stringify({ schemaVersion: 1, botanVersion: BOTAN_VERSION, blake3Version: BLAKE3_VERSION, files }, null, 2)}\n`);

  await fs.mkdir(packageDir, { recursive: true });
  await fs.rm(packagePath, { force: true });
  await compressArchive(workRoot, packagePath);
  if (args.install) await installAtomically(workRoot, installRoot);
  console.log(`Generated ${MODULE_ID}: Botan ${BOTAN_VERSION}, BLAKE3 ${BLAKE3_VERSION}, ${files.length} files.`);
  console.log(`Package: ${packagePath}`);
  if (args.install) console.log(`Installed: ${installRoot}`);
}

function parseArgs(values) {
  const result = { install: false, rebuild: false, botanSource: '', blake3Source: '', cache: '' };
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] === '--install') result.install = true;
    else if (values[index] === '--rebuild') result.rebuild = true;
    else if (values[index] === '--botan-source') result.botanSource = values[++index] || '';
    else if (values[index] === '--blake3-source') result.blake3Source = values[++index] || '';
    else if (values[index] === '--cache') result.cache = values[++index] || '';
  }
  return result;
}

async function prepareBotan(cacheRoot, botanRoot) {
  if (await exists(path.join(botanRoot, 'configure.py'))) return;
  await fs.mkdir(cacheRoot, { recursive: true });
  const archive = path.join(cacheRoot, `Botan-${BOTAN_VERSION}.tar.xz`);
  if (!await exists(archive)) await download(BOTAN_URL, archive);
  if (await sha256File(archive) !== BOTAN_SHA256) throw new Error('Botan 官方归档 SHA-256 校验失败。');
  const script = [
    'import lzma,tarfile,sys',
    'with lzma.open(sys.argv[1],"rb") as xz, tarfile.open(fileobj=xz,mode="r:") as tf:',
    '    tf.extractall(sys.argv[2], filter="data")'
  ].join('\n');
  await execFileAsync('python', ['-c', script, archive, cacheRoot], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
}

async function prepareBlake3(blake3Root) {
  if (await exists(path.join(blake3Root, 'c', 'blake3.c'))) {
    const commit = (await execFileAsync('git', ['-C', blake3Root, 'rev-parse', 'HEAD'], { windowsHide: true })).stdout.trim();
    if (commit !== BLAKE3_COMMIT) throw new Error(`BLAKE3 源码提交不匹配：${commit}`);
    return;
  }
  await execFileAsync('git', ['clone', '--depth', '1', '--branch', BLAKE3_VERSION, 'https://github.com/BLAKE3-team/BLAKE3.git', blake3Root], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
  const commit = (await execFileAsync('git', ['-C', blake3Root, 'rev-parse', 'HEAD'], { windowsHide: true })).stdout.trim();
  if (commit !== BLAKE3_COMMIT) throw new Error(`BLAKE3 官方标签提交校验失败：${commit}`);
}

async function buildBotan(root, vsDevCmd, arch, cpu, buildDir, rebuild) {
  const dll = path.join(root, buildDir, 'botan-3.dll');
  if (!rebuild && await exists(dll)) return;
  if (rebuild) await fs.rm(path.join(root, buildDir), { recursive: true, force: true });
  const configure = `call "${vsDevCmd}" -arch=${arch} -host_arch=x64 >nul && cd /d "${root}" && python configure.py --cc=msvc --os=windows --cpu=${cpu} --disable-static-library --without-documentation --build-targets=shared --with-build-dir=${buildDir} --distribution-info=LingBuilder-Crypto-SDK`;
  await runCmd(configure, 5 * 60 * 1000);
  await runCmd(`call "${vsDevCmd}" -arch=${arch} -host_arch=x64 >nul && cd /d "${root}" && nmake /NOLOGO /f ${buildDir}\\Makefile`, 30 * 60 * 1000);
}

async function findVsDevCmd() {
  const candidates = [
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\Tools\\VsDevCmd.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\Tools\\VsDevCmd.bat',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Professional\\Common7\\Tools\\VsDevCmd.bat'
  ];
  for (const candidate of candidates) if (await exists(candidate)) return candidate;
  throw new Error('未找到 Visual Studio 2022 C++ 工具链，无法生成双架构密码学 SDK。');
}

async function runCmd(command, timeout) { await execFileAsync('cmd.exe', ['/d', '/c', command], { windowsHide: true, timeout, maxBuffer: 64 * 1024 * 1024 }); }
async function download(url, target) {
  const response = await fetch(url); if (!response.ok || !response.body) throw new Error(`下载失败：${url} / HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer()); await fs.writeFile(target, bytes);
}
function moduleManifest() { return { schemaVersion: 2, id: MODULE_ID, name: 'LingBuilder 密码学 SDK', version: `${BOTAN_VERSION}+blake3.${BLAKE3_VERSION}`, category: '系统', description: 'Botan 与 BLAKE3 的 Win32/x64 已校验资产模块；由四个内置密码学模块自动使用，无需项目单独启用。', author: 'LingBuilder', license: 'BSD-2-Clause AND (Apache-2.0 OR CC0-1.0)' }; }
function moduleReadme() { return `# LingBuilder 密码学 SDK\n\nBotan ${BOTAN_VERSION} + BLAKE3 ${BLAKE3_VERSION}，提供 Win32/x64 /MD 构建、公开 FFI 头和 BLAKE3 可移植源码。项目无需单独启用。\n`; }
async function copyFile(source, target) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.copyFile(source, target); }
async function writeText(target, content) { await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, content, 'utf8'); }
async function exists(target) { try { await fs.access(target); return true; } catch { return false; } }
async function listFiles(root) { const result = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const target = path.join(root, entry.name); if (entry.isDirectory()) result.push(...await listFiles(target)); else if (entry.isFile()) result.push(target); } return result; }
async function sha256File(target) { const hash = crypto.createHash('sha256'); hash.update(await fs.readFile(target)); return hash.digest('hex'); }
async function copyDirectory(source, target) { await fs.mkdir(target, { recursive: true }); for (const entry of await fs.readdir(source, { withFileTypes: true })) { const from = path.join(source, entry.name), to = path.join(target, entry.name); if (entry.isDirectory()) await copyDirectory(from, to); else if (entry.isFile()) await fs.copyFile(from, to); } }
async function installAtomically(source, target) { const staging = `${target}.staging-${process.pid}`; const backup = `${target}.previous-${process.pid}`; await fs.rm(staging, { recursive: true, force: true }); await fs.rm(backup, { recursive: true, force: true }); await copyDirectory(source, staging); try { try { await fs.rename(target, backup); } catch (error) { if (error.code !== 'ENOENT') throw error; } await fs.rename(staging, target); await fs.rm(backup, { recursive: true, force: true }); } catch (error) { try { await fs.rename(backup, target); } catch {} throw error; } }
async function compressArchive(source, target) { const zip = `${target}.zip`; await fs.rm(zip, { force: true }); const quote = value => `'${value.replace(/'/g, "''")}'`; await execFileAsync('powershell.exe', ['-NoProfile', '-Command', `Compress-Archive -Path ${quote(path.join(source, '*'))} -DestinationPath ${quote(zip)} -Force`], { windowsHide: true, timeout: 10 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 }); await fs.rename(zip, target); }

main().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
