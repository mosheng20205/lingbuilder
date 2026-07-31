const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const repoRoot = path.resolve(__dirname, '..', '..');
  const sdkRoot = path.resolve(args.sdk || process.env.CEF3_SDK_ROOT
    || path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.cef3.sdk', 'sdk'));
  const sourceRoot = path.join(repoRoot, 'electron', 'native', 'cef3-bridge');
  const buildRoot = path.join(repoRoot, '.lingbuilder-build', 'cef3-bridge');
  const outputRoot = path.resolve(args.output || (args.install
    ? path.join(sdkRoot, 'bridge', 'x64')
    : path.join(repoRoot, '.lingbuilder', 'module-build', 'lingbuilder.cef3.sdk', 'sdk', 'bridge', 'x64')));
  await assertFile(path.join(sdkRoot, 'include', 'cef_version.h'));
  const cmake = await findCmake();
  await execFileAsync(cmake, [
    '-S', sourceRoot, '-B', buildRoot, '-G', 'Visual Studio 17 2022', '-A', 'x64',
    `-DCEF_SDK_ROOT=${sdkRoot.replaceAll('\\', '/')}`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await execFileAsync(cmake, ['--build', buildRoot, '--config', 'Release', '--target', 'LingBuilderCefBridgeTests'], {
    windowsHide: true, maxBuffer: 1024 * 1024 * 10
  });
  await execFileAsync(path.join(buildRoot, 'Release', 'LingBuilderCefBridgeTests.exe'), [], {
    cwd: path.join(buildRoot, 'Release'),
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    env: { ...process.env, LB_CEF3_TEST_SDK_ROOT: sdkRoot }
  });
  await fs.mkdir(outputRoot, { recursive: true });
  const files = [
    [path.join(sourceRoot, 'LingBuilderCefBridge.h'), 'LingBuilderCefBridge.h'],
    [path.join(buildRoot, 'Release', 'LingBuilderCefBridge.lib'), 'LingBuilderCefBridge.lib'],
    [path.join(buildRoot, 'Release', 'LingBuilderCefBridge.dll'), 'LingBuilderCefBridge.dll']
  ];
  const checksums = {};
  for (const [source, name] of files) {
    const target = path.join(outputRoot, name);
    await fs.copyFile(source, target);
    checksums[name] = await sha256(target);
  }
  const metadata = {
    schemaVersion: 1,
    bridgeAbi: '3.0.0',
    cefVersion: await readCefVersion(path.join(sdkRoot, 'include', 'cef_version.h')),
    platform: 'windows-msvc-x64',
    files: checksums
  };
  await fs.writeFile(path.join(outputRoot, 'VERSION.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(`CEF3 Bridge built and tested: ${outputRoot}`);
}

function parseArgs(argv) {
  const result = { install: false, sdk: '', output: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--install') result.install = true;
    else if (argv[index] === '--sdk') result.sdk = argv[++index] || '';
    else if (argv[index] === '--output') result.output = argv[++index] || '';
  }
  return result;
}

async function assertFile(file) {
  const stat = await fs.stat(file).catch(() => null);
  if (!stat?.isFile()) throw new Error(`CEF3 Bridge 缺少文件：${file}`);
}

async function readCefVersion(file) {
  const source = await fs.readFile(file, 'utf8');
  const match = source.match(/^#define\s+CEF_VERSION\s+"([^"]+)"/mu);
  if (!match || !match[1].startsWith('150.')) throw new Error('CEF3 Bridge 只允许冻结的 CEF 150 基线');
  return match[1];
}

async function sha256(file) {
  const contents = await fs.readFile(file);
  return crypto.createHash('sha256').update(contents).digest('hex');
}

async function findCmake() {
  const candidates = [
    'cmake.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\2022\\BuildTools\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe'
  ];
  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate, ['--version'], { windowsHide: true });
      return candidate;
    } catch {
      // 尝试下一个 Visual Studio/CMake 安装位置。
    }
  }
  throw new Error('未找到 CMake/Visual Studio 2022，无法编译 LingBuilderCefBridge.dll。');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
