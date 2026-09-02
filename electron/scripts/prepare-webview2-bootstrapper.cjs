const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');

const DOWNLOAD_URL = 'https://go.microsoft.com/fwlink/p/?LinkId=2124703';
const projectRoot = path.resolve(__dirname, '..');
const destination = path.join(projectRoot, 'build', 'vendor', 'MicrosoftEdgeWebview2Setup.exe');

async function main() {
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
