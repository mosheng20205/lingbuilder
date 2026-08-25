const fs = require('node:fs/promises');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const MODULE_ID = 'lingbuilder.cef3.sdk';
const MODULE_NAME = 'CEF3 内核SDK包 (x64)';
const DEFAULT_SOURCE = 'C:\\cef3-sdk';
const WRAPPER_RELATIVE = path.join('build_wrapper_x64_md', 'libcef_dll_wrapper', 'Release', 'libcef_dll_wrapper.lib');

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const scriptDir = __dirname;
  const repoRoot = path.resolve(scriptDir, '..', '..');
  const sourceRoot = path.resolve(args.source || process.env.CEF3_SDK_ROOT || DEFAULT_SOURCE);
  const workRoot = path.join(repoRoot, '.lingbuilder', 'module-build', MODULE_ID);
  const packageDir = path.join(repoRoot, '.lingbuilder', 'module-packages');
  const packagePath = path.join(packageDir, 'cef3-sdk-x64.lbmod');

  const cefVersion = await assertCef3SdkSource(sourceRoot);

  await fs.rm(workRoot, { recursive: true, force: true });
  await fs.mkdir(workRoot, { recursive: true });

  await writeText(path.join(workRoot, 'lingbuilder.module.json'), JSON.stringify(buildManifest(cefVersion), null, 2) + '\n');
  await writeText(path.join(workRoot, 'README.md'), moduleReadme(cefVersion));

  const sdkRoot = path.join(workRoot, 'sdk');
  await copyDirectory(path.join(sourceRoot, 'include'), path.join(sdkRoot, 'include'));
  await copyDirectory(path.join(sourceRoot, 'Release'), path.join(sdkRoot, 'Release'));
  await copyDirectory(path.join(sourceRoot, 'Resources'), path.join(sdkRoot, 'Resources'));
  await fs.mkdir(path.dirname(path.join(sdkRoot, WRAPPER_RELATIVE)), { recursive: true });
  await fs.copyFile(path.join(sourceRoot, WRAPPER_RELATIVE), path.join(sdkRoot, WRAPPER_RELATIVE));
  await execFileAsync(process.execPath, [
    path.join(scriptDir, 'build-cef3-bridge.cjs'),
    '--sdk', sourceRoot,
    '--output', path.join(sdkRoot, 'bridge', 'x64')
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  for (const licenseName of ['LICENSE.txt', 'LICENSE', 'README.txt']) {
    try {
      await fs.copyFile(path.join(sourceRoot, licenseName), path.join(sdkRoot, licenseName));
    } catch {
      // 许可证/说明文件可选。
    }
  }

  await fs.mkdir(packageDir, { recursive: true });
  await fs.rm(packagePath, { force: true });
  console.log('正在压缩模块包（SDK 体积较大，约需 1-3 分钟）…');
  await compressArchive(workRoot, packagePath);

  if (args.install) {
    const installPath = path.join(repoRoot, '.lingbuilder', 'modules', MODULE_ID);
    await fs.rm(installPath, { recursive: true, force: true });
    await copyDirectory(workRoot, installPath);
    console.log(`Installed ${MODULE_ID} to ${installPath}`);
    console.log('SDK 载体模块无需为项目单独启用，构建链路按路径自动发现。');
  }

  const packageStat = await fs.stat(packagePath);
  console.log(`Generated ${MODULE_NAME}`);
  console.log(`CEF version: ${cefVersion}`);
  console.log(`Module directory: ${workRoot}`);
  console.log(`Package: ${packagePath} (${(packageStat.size / 1024 / 1024).toFixed(1)} MB)`);
}

function parseArgs(args) {
  const result = { install: false, source: '' };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--install') result.install = true;
    if (arg === '--source') result.source = args[index + 1] || '';
  }
  return result;
}

async function assertCef3SdkSource(sourceRoot) {
  const requiredFiles = [
    path.join('include', 'cef_app.h'),
    path.join('include', 'cef_version.h'),
    path.join('Release', 'libcef.lib'),
    path.join('Release', 'libcef.dll'),
    path.join('Release', 'v8_context_snapshot.bin'),
    path.join('Resources', 'icudtl.dat')
  ];
  for (const relative of requiredFiles) {
    const fullPath = path.join(sourceRoot, relative);
    try {
      await fs.access(fullPath);
    } catch {
      throw new Error(`CEF3 SDK 来源缺少必需文件：${fullPath}。请确认 --source 指向已解压的 CEF 官方二进制发行包（windows64）根目录。`);
    }
  }
  try {
    await fs.access(path.join(sourceRoot, WRAPPER_RELATIVE));
  } catch {
    throw new Error(
      `CEF3 SDK 来源缺少预编译 wrapper：${path.join(sourceRoot, WRAPPER_RELATIVE)}。\n` +
      '请先用 CMake 编译（/MD 动态 CRT）：\n' +
      `  cmake -S "${sourceRoot}" -B "${path.join(sourceRoot, 'build_wrapper_x64_md')}" -G "Visual Studio 17 2022" -A x64 -DCEF_RUNTIME_LIBRARY_FLAG=/MD\n` +
      `  cmake --build "${path.join(sourceRoot, 'build_wrapper_x64_md')}" --config Release --target libcef_dll_wrapper\n` +
      '注意：若 configure 崩溃（0xC0000409），先把 CMakeLists.txt 的 project(cef) 改为 project(cef LANGUAGES CXX)。'
    );
  }
  const versionHeader = await fs.readFile(path.join(sourceRoot, 'include', 'cef_version.h'), 'utf8');
  const versionMatch = versionHeader.match(/#define\s+CEF_VERSION\s+"([^"]+)"/);
  return versionMatch ? versionMatch[1] : '150.0.0-unknown';
}

function buildManifest(cefVersion) {
  return {
    schemaVersion: 2,
    id: MODULE_ID,
    name: MODULE_NAME,
    version: cefVersion,
    category: '界面',
    description:
      'CEF3（Chromium Embedded Framework）内核 SDK 离线载体模块（x64）：内含头文件、libcef.lib、预编译 /MD libcef_dll_wrapper.lib、' +
      '全部运行时 DLL（含 v8_context_snapshot.bin、GPU/软渲染组件）、资源文件及 LingBuilderCefBridge v3 C ABI。安装后 CEF3浏览器模块（lingbuilder.cef3.browser）' +
      '构建时自动从本模块发现 SDK，用户免下载、免 CMake、免编译。本模块只承载二进制资产，不提供中文命令或设计器控件，无需为项目单独启用。'
  };
}

function moduleReadme(cefVersion) {
  return [
    `# ${MODULE_NAME}`,
    '',
    `- CEF 版本：${cefVersion}`,
    '- 架构：x64（windows-msvc-x64）',
    '- CRT：预编译 wrapper 使用 /MD 动态 CRT，与 LingBuilder 编译链一致。',
    '',
    '本模块是纯资产载体：安装到 `.lingbuilder/modules/lingbuilder.cef3.sdk/` 后，',
    'CEF3浏览器模块（lingbuilder.cef3.browser）构建时按以下顺序自动发现 SDK：',
    '',
    '1. `CEF3_SDK_ROOT` 环境变量',
    '2. 工作区 `.lingbuilder/cef3-sdk`',
    '3. 本模块 `sdk/` 目录（`.lingbuilder/modules/lingbuilder.cef3.sdk/sdk`）',
    '4. `C:\\cef3-sdk`',
    '',
    '目录结构：',
    '',
    '```text',
    'sdk/',
    '  include/                                                    # CEF 头文件',
    '  Release/                                                    # libcef.lib + 全部运行时 DLL',
    '  Resources/                                                  # icudtl.dat、*.pak、locales/',
    '  build_wrapper_x64_md/libcef_dll_wrapper/Release/            # 预编译 /MD libcef_dll_wrapper.lib',
    '  bridge/x64/                                                  # Bridge DLL、导入库、头文件、版本与 SHA-256 清单',
    '```',
    '',
    '升级内核时用新版 CEF 官方包重新运行 `npm run module:cef3-sdk`（需先重新编译 wrapper），',
    '详见仓库根目录《docs/CEF3浏览器150内核封装.md》。',
    ''
  ].join('\n');
}

async function copyDirectory(source, target) {
  const entries = await fs.readdir(source, { withFileTypes: true });
  await fs.mkdir(target, { recursive: true });
  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) await copyDirectory(sourcePath, targetPath);
    else if (entry.isFile()) await fs.copyFile(sourcePath, targetPath);
  }
}

async function writeText(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function compressArchive(sourceDir, targetPath) {
  const tempZipPath = `${targetPath}.zip`;
  await fs.rm(tempZipPath, { force: true });
  await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path ${quotePs(path.join(sourceDir, '*'))} -DestinationPath ${quotePs(tempZipPath)} -Force`
  ], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
  await fs.rename(tempZipPath, targetPath);
}

function quotePs(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch(error => {
  console.error(error.message || error);
  process.exitCode = 1;
});
