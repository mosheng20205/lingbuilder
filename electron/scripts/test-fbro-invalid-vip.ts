import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const executable = path.join(
  repoRoot,
  '.lingbuilder-build',
  'fbro-native-smoke',
  'x64',
  'Release',
  'bin',
  'fbro-native-smoke.exe'
);
const deliberatelyInvalidKey = 'LINGBUILDER-INTENTIONALLY-INVALID-VIP-KEY';

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs: number) {
  if (child.exitCode !== null) return true;
  return new Promise<boolean>(resolve => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    child.once('exit', () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
}

async function closeProcessTreeGracefully(child: ReturnType<typeof spawn>) {
  if (!child.pid || process.platform !== 'win32' || child.exitCode !== null) return;
  const closeScript = [
    'Add-Type -TypeDefinition \"using System; using System.Runtime.InteropServices; public static class LBWindow { [DllImport(\\\"user32.dll\\\")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l); }\";',
    `$p = Get-Process -Id ${child.pid} -ErrorAction SilentlyContinue;`,
    'if ($p -and $p.MainWindowHandle -ne 0) { [LBWindow]::PostMessage($p.MainWindowHandle, 0x0010, [IntPtr]::Zero, [IntPtr]::Zero) | Out-Null }'
  ].join(' ');
  try {
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', closeScript], { windowsHide: true });
  } catch {
    // The process may have already closed between the checks.
  }
  if (await waitForExit(child, 20_000)) return;
  try {
    await execFileAsync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
    await waitForExit(child, 5_000);
  } catch {
    // The process may have already completed its shutdown.
  }
}

async function main() {
  const child = spawn(executable, [], {
    cwd: path.dirname(executable),
    windowsHide: true,
    env: { ...process.env, LINGBUILDER_FBRO_VIP_KEY: deliberatelyInvalidKey },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('等待 FBro 错误 VIP 授权诊断超时（55 秒）')), 55_000);
      const poll = setInterval(() => {
        if (!stdout.includes('FBro VIP 授权信息') || !stdout.includes('https://example.com')) return;
        clearTimeout(timeout);
        clearInterval(poll);
        resolve();
      }, 100);
      child.once('error', error => {
        clearTimeout(timeout);
        clearInterval(poll);
        reject(error);
      });
      child.once('exit', code => {
        if (stdout.includes('FBro VIP 授权信息') && stdout.includes('https://example.com')) return;
        clearTimeout(timeout);
        clearInterval(poll);
        reject(new Error(`FBro 测试程序提前退出，退出码 ${String(code)}`));
      });
    });

    if (!stdout.includes('FBro 已创建')) throw new Error('未收到 FBro 浏览器创建完成事件');
    if (!stdout.includes('https://example.com')) throw new Error('未收到 FBro 浏览器加载完成地址');
    const safeOutput = stdout.replaceAll(deliberatelyInvalidKey, '[已隐藏]');
    if (!/FBro VIP 应用结果,\s*0/u.test(stdout)) {
      throw new Error(`错误 VIP Key 未被中文命令层拒绝。实际输出：\n${safeOutput}`);
    }
    if (!/FBro VIP 授权信息,\s*FBro VIP 授权码校验失败/u.test(stdout)) {
      throw new Error('未看到“FBro VIP 授权码校验失败”诊断');
    }
    if (stdout.includes(deliberatelyInvalidKey) || stderr.includes(deliberatelyInvalidKey)) {
      throw new Error('测试输出泄露了传入的 VIP Key');
    }
    const fbroLog = await fs.readFile(path.join(path.dirname(executable), 'fbro.log'), 'utf8').catch(() => '');
    if (/cache_path|Cannot create profile/iu.test(`${stderr}\n${fbroLog}`)) {
      throw new Error(`FBro 缓存/profile 初始化失败：\n${stderr}\n${fbroLog}`);
    }
    console.log(JSON.stringify({
      ok: true,
      browserCreated: true,
      pageLoaded: true,
      invalidVipRejected: true,
      profileReady: true,
      diagnosticVisible: true,
      vipKeyLeaked: false,
      diagnostic: stdout.split(/\r?\n/u).find(line => line.includes('FBro VIP 授权信息'))?.trim() || ''
    }, null, 2));
  } finally {
    await closeProcessTreeGracefully(child);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
