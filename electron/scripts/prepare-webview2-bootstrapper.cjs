const fs = require('node:fs/promises');
const fsSync = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const DOWNLOAD_URL = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';
const projectRoot = path.resolve(__dirname, '..');
const destination = path.join(projectRoot, 'build', 'vendor', 'MicrosoftEdgeWebview2Setup.exe');

// EdgeView 构建用 WebView2 SDK（编译期头文件 + 静态库）的钉扎信息。
// 版本与哈希必须与 electron/src/services/modules/nativeDependencyService.ts 的
// EDGEVIEW_WEBVIEW2_SDK_VERSION / EDGEVIEW_WEBVIEW2_HEADER_SHA256 保持一致。
const WEBVIEW2_SDK_VERSION = '1.0.4078.44';
const WEBVIEW2_NUGET_PACKAGE_ID = 'microsoft.web.webview2';
const WEBVIEW2_HEADER_SHA256 = 'dff1e3181ec7ec203a34ef6efa966590e0ef0ba1a5c3fe3b69da6508c2f8a02e';
const WEBVIEW2_SDK_FILES = [
  'build/native/include/WebView2.h',
  'build/native/include/WebView2EnvironmentOptions.h',
  'build/native/x64/WebView2LoaderStatic.lib',
  'build/native/x86/WebView2LoaderStatic.lib'
];
const sdkBundledRoot = path.join(projectRoot, 'third_party', 'webview2', WEBVIEW2_NUGET_PACKAGE_ID, WEBVIEW2_SDK_VERSION);

async function main() {
  await prepareWebview2SdkSubset();
  if (await fileExists(destination)) {
    await validateBootstrapper(destination);
    process.stdout.write(`已复用本地 WebView2 Bootstrapper：${destination}\n`);
    return;
  }
  const response = await fetch(DOWNLOAD_URL, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`下载 WebView2 Bootstrapper 失败：HTTP ${response.status}`);
  const finalUrl = new URL(response.url);
  if (finalUrl.protocol !== 'https:' || !isMicrosoftHost(finalUrl.hostname)) {
    throw new Error(`WebView2 Bootstrapper 重定向到了非微软地址：${finalUrl.hostname}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  validateBootstrapperBytes(bytes);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, bytes);
  await validateBootstrapper(temporary);
  await fs.rename(temporary, destination);
  process.stdout.write(`WebView2 Bootstrapper 已冻结到安装资源：${destination}\n`);
}

/**
 * 把 NuGet 全局缓存里固定版本的 WebView2 SDK 子集物化到 third_party/webview2，
 * 供 extraResources 随包分发。缓存缺失或 WebView2.h 哈希不符时直接失败，
 * 不允许打出缺 SDK 的安装包（用户机会因此构建出 EdgeView 空实现程序）。
 */
async function prepareWebview2SdkSubset() {
  if (await sdkSubsetComplete(sdkBundledRoot)) {
    await verifySdkHeaderHash(path.join(sdkBundledRoot, 'build/native/include/WebView2.h'));
    process.stdout.write(`已复用本地 WebView2 SDK 副本：${sdkBundledRoot}\n`);
    return;
  }
  const cacheRoot = await findWebview2NugetRoot();
  if (!cacheRoot) {
    throw new Error(
      `缺少 WebView2 SDK：本机未找到 ${WEBVIEW2_NUGET_PACKAGE_ID} ${WEBVIEW2_SDK_VERSION} 的 NuGet 缓存` +
      `（已检查 NUGET_PACKAGES、%USERPROFILE%\\.nuget\\packages、LINGBUILDER_WEBVIEW2_SDK_ROOT）。` +
      `请先恢复该 NuGet 包（dotnet restore / nuget install），或设置 LINGBUILDER_WEBVIEW2_SDK_ROOT 指向包根目录后重试。`
    );
  }
  await verifySdkHeaderHash(path.join(cacheRoot, 'build/native/include/WebView2.h'));
  await fs.mkdir(path.dirname(path.join(sdkBundledRoot, WEBVIEW2_SDK_FILES[0])), { recursive: true });
  for (const relativeFile of WEBVIEW2_SDK_FILES) {
    const target = path.join(sdkBundledRoot, ...relativeFile.split('/'));
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.copyFile(path.join(cacheRoot, ...relativeFile.split('/')), target);
  }
  process.stdout.write(`WebView2 SDK ${WEBVIEW2_SDK_VERSION} 子集已物化：${sdkBundledRoot}\n`);
}

async function sdkSubsetComplete(root) {
  for (const relativeFile of WEBVIEW2_SDK_FILES) {
    if (!(await fileExists(path.join(root, ...relativeFile.split('/'))))) return false;
  }
  return true;
}

async function findWebview2NugetRoot() {
  // LINGBUILDER_WEBVIEW2_SDK_ROOT 兼容两种语义：指向包根目录本身，或指向存放 microsoft.web.webview2 的包仓库根。
  const explicit = String(process.env.LINGBUILDER_WEBVIEW2_SDK_ROOT || '').trim();
  if (explicit) {
    const resolved = path.resolve(explicit);
    if (fsSync.existsSync(path.join(resolved, 'build', 'native', 'include', 'WebView2.h'))) return resolved;
  }
  const candidates = [];
  const push = (value) => {
    const normalized = String(value || '').trim();
    if (normalized) candidates.push(path.resolve(normalized));
  };
  push(explicit && path.join(explicit, WEBVIEW2_NUGET_PACKAGE_ID));
  push(process.env.NUGET_PACKAGES && path.join(process.env.NUGET_PACKAGES, WEBVIEW2_NUGET_PACKAGE_ID));
  push(process.env.USERPROFILE && path.join(process.env.USERPROFILE, '.nuget', 'packages', WEBVIEW2_NUGET_PACKAGE_ID));
  for (const root of candidates) {
    const packageRoot = path.join(root, WEBVIEW2_SDK_VERSION);
    if (fsSync.existsSync(path.join(packageRoot, 'build', 'native', 'include', 'WebView2.h'))) return packageRoot;
  }
  return null;
}

async function verifySdkHeaderHash(headerPath) {
  const actual = crypto.createHash('sha256').update(await fs.readFile(headerPath)).digest('hex');
  if (actual !== WEBVIEW2_HEADER_SHA256) {
    throw new Error(`WebView2.h SHA-256 校验失败：期望 ${WEBVIEW2_HEADER_SHA256}，实际 ${actual}。请改用钉扎版本 ${WEBVIEW2_SDK_VERSION} 的官方 NuGet 包。`);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function validateBootstrapper(filePath) {
  validateBootstrapperBytes(await fs.readFile(filePath));
  await verifyMicrosoftSignature(filePath);
}

function validateBootstrapperBytes(bytes) {
  if (bytes.length < 1024 || bytes.length > 16 * 1024 * 1024 || bytes.subarray(0, 2).toString('ascii') !== 'MZ') {
    throw new Error('WebView2 Bootstrapper 不是有效的 Windows 可执行文件。');
  }
}

async function verifyMicrosoftSignature(executablePath) {
  const script = [
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:LINGBUILDER_INSTALLER_PATH",
    "if ($signature.Status -ne 'Valid') { exit 1 }",
    "if ($signature.SignerCertificate.Subject -notmatch 'Microsoft') { exit 1 }"
  ].join('; ');
  const shell = process.env.LINGBUILDER_POWERSHELL_PATH || (process.env.ComSpec ? 'powershell.exe' : 'pwsh.exe');
  await new Promise((resolve, reject) => {
    const child = spawn(shell, ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, LINGBUILDER_INSTALLER_PATH: executablePath }
    });
    child.once('error', reject);
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.once('exit', code => {
      if (code === 0) return resolve();
      const detail = stderr.trim();
      reject(new Error(detail
        ? `WebView2 Bootstrapper 的 Microsoft Authenticode 签名验证失败：${detail}`
        : 'WebView2 Bootstrapper 的 Microsoft Authenticode 签名验证失败。'));
    });
  });
}

function isMicrosoftHost(hostname) {
  const normalized = hostname.toLowerCase();
  return normalized === 'go.microsoft.com'
    || normalized === 'microsoft.com'
    || normalized.endsWith('.microsoft.com');
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
