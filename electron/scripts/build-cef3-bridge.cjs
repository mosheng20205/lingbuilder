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
  const generator = await findVisualStudioGenerator(cmake);
  await execFileAsync(cmake, [
    '-S', sourceRoot, '-B', buildRoot, '-G', generator, '-A', 'x64',
    `-DCEF_SDK_ROOT=${sdkRoot.replaceAll('\\', '/')}`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await execFileAsync(cmake, ['--build', buildRoot, '--config', 'Release', '--target', 'LingBuilderCefBridgeTests'], {
    windowsHide: true, maxBuffer: 1024 * 1024 * 10
  });
  const testRuntimeRoot = path.join(buildRoot, 'Release');
  await stageTestRuntime(sdkRoot, testRuntimeRoot);
  const testEnvironment = {
    ...process.env,
    LB_CEF3_TEST_SDK_ROOT: sdkRoot,
    LB_CEF3_TEST_DISABLE_GPU: '1',
    LB_CEF3_TEST_DISABLE_BACKGROUND_NETWORKING: '1'
  };
  delete testEnvironment.LB_CEF3_TEST_NETWORK_CERTIFICATE;
  const testExecutable = path.join(buildRoot, 'Release', 'LingBuilderCefBridgeTests.exe');
  await execFileAsync(testExecutable, [], {
    cwd: path.join(buildRoot, 'Release'),
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    timeout: 120000,
    killSignal: 'SIGKILL',
    env: { ...testEnvironment, LB_CEF3_TEST_MEDIA_ROUTER_NOTIFY: '1' }
  });
  await execFileAsync(testExecutable, [], {
    cwd: path.join(buildRoot, 'Release'),
    windowsHide: true,
    maxBuffer: 1024 * 1024,
    timeout: 120000,
    killSignal: 'SIGKILL',
    env: testEnvironment
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
    schemaVersion: 2,
    bridgeAbi: '4.0.0',
    compatibleBridgeAbis: ['3.0.0', '4.0.0'],
    cefVersion: await readCefVersion(path.join(sdkRoot, 'include', 'cef_version.h')),
    platform: 'windows-msvc-x64',
    files: checksums
  };
  await fs.writeFile(path.join(outputRoot, 'VERSION.json'), `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
  console.log(`CEF3 Bridge built and tested: ${outputRoot}`);
}

async function stageTestRuntime(sdkRoot, outputRoot) {
  const releaseRoot = path.join(sdkRoot, 'Release');
  for (const entry of await fs.readdir(releaseRoot, { withFileTypes: true })) {
    if (!entry.isFile() || entry.name.endsWith('.lib') || /^bootstrapc?\.exe$/iu.test(entry.name)) continue;
    await copyIfChanged(path.join(releaseRoot, entry.name), path.join(outputRoot, entry.name));
  }
  await copyDirectoryIfChanged(path.join(sdkRoot, 'Resources'), outputRoot);
}

async function copyDirectoryIfChanged(sourceRoot, outputRoot) {
  for (const entry of await fs.readdir(sourceRoot, { withFileTypes: true })) {
    const source = path.join(sourceRoot, entry.name);
    const target = path.join(outputRoot, entry.name);
    if (entry.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      await copyDirectoryIfChanged(source, target);
    } else if (entry.isFile()) {
      await copyIfChanged(source, target);
    }
  }
}

async function copyIfChanged(source, target) {
  const [sourceStat, targetStat] = await Promise.all([
    fs.stat(source),
    fs.stat(target).catch(() => null)
  ]);
  if (targetStat?.isFile() && targetStat.size === sourceStat.size
      && targetStat.mtimeMs >= sourceStat.mtimeMs) return;
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.copyFile(source, target);
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
    'C:\\Program Files\\Microsoft Visual Studio\\18\\Community\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
    'C:\\Program Files\\Microsoft Visual Studio\\18\\BuildTools\\Common7\\IDE\\CommonExtensions\\Microsoft\\CMake\\CMake\\bin\\cmake.exe',
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
  throw new Error('未找到 CMake/Visual Studio，无法编译 LingBuilderCefBridge.dll。');
}

async function findVisualStudioGenerator(cmake) {
  let output = '';
  try {
    ({ stdout: output } = await execFileAsync(cmake, ['-G'], { windowsHide: true, maxBuffer: 1024 * 1024 }));
  } catch (error) {
    output = `${error.stdout || ''}\n${error.stderr || ''}`;
  }
  if (/Visual Studio 18 2026/iu.test(output)) return 'Visual Studio 18 2026';
  if (/Visual Studio 17 2022/iu.test(output)) return 'Visual Studio 17 2022';
  throw new Error('未找到可用的 Visual Studio CMake 生成器（需要 Visual Studio 18 2026 或 17 2022）。');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
