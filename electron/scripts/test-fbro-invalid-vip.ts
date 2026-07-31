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
const pdfOutput = path.join(path.dirname(executable), 'fbro-transfer-smoke.pdf');

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

async function closeFbroFileDialog(rootProcessId: number) {
  const script = [
    'Add-Type -TypeDefinition @"',
    'using System; using System.Runtime.InteropServices; using System.Text;',
    'public static class LBFileDialogClose {',
    '  public delegate bool EnumWindowsProc(IntPtr hwnd, IntPtr lParam);',
    '  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);',
    '  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hwnd, StringBuilder text, int count);',
    '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);',
    '  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr hwnd, EnumWindowsProc callback, IntPtr lParam);',
    '  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint message, IntPtr wParam, IntPtr lParam);',
    '  private static void Cancel(IntPtr hwnd) { PostMessage(hwnd, 0x0111, new IntPtr(2), IntPtr.Zero); PostMessage(hwnd, 0x0100, new IntPtr(0x1B), IntPtr.Zero); PostMessage(hwnd, 0x0101, new IntPtr(0x1B), IntPtr.Zero); PostMessage(hwnd, 0x0010, IntPtr.Zero, IntPtr.Zero); }',
    '  public static void Pulse(int[] processIds) { var allowed = new System.Collections.Generic.HashSet<int>(processIds); EnumWindows((hwnd, arg) => { uint processId; GetWindowThreadProcessId(hwnd, out processId); var className = new StringBuilder(128); GetClassName(hwnd, className, className.Capacity); if (allowed.Contains((int)processId) && className.ToString() == "#32770") Cancel(hwnd); return true; }, IntPtr.Zero); }',
    '}',
    '"@;',
    `$rootProcessId = ${rootProcessId};`,
    'for ($i = 0; $i -lt 50; $i++) { $all = @(Get-CimInstance Win32_Process); $ids = @($rootProcessId); do { $before = $ids.Count; $children = @($all | Where-Object { $ids -contains [int]$_.ParentProcessId } | ForEach-Object { [int]$_.ProcessId }); $ids = @($ids + $children | Select-Object -Unique) } while ($ids.Count -gt $before); [LBFileDialogClose]::Pulse([int[]]$ids); Start-Sleep -Milliseconds 200 }; exit 0'
  ].join('\n');
  await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    windowsHide: true,
    timeout: 15_000
  });
}

async function main() {
  await fs.rm(pdfOutput, { force: true });
  const child = spawn(executable, [], {
    cwd: path.dirname(executable),
    windowsHide: true,
    env: { ...process.env, LINGBUILDER_FBRO_VIP_KEY: deliberatelyInvalidKey },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stdout = '';
  let stderr = '';
  let dialogClosePromise: Promise<void> | undefined;
  let dialogCloseError = '';
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', chunk => {
    stdout += chunk;
    if (!dialogClosePromise && stdout.includes('FBro File Dialog Starting')) {
      dialogClosePromise = closeFbroFileDialog(child.pid || 0).catch(error => {
        dialogCloseError = error instanceof Error ? error.message : String(error);
      });
    }
  });
  child.stderr.on('data', chunk => { stderr += chunk; });

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('等待 FBro 错误 VIP 授权诊断超时（55 秒）')), 55_000);
      const poll = setInterval(() => {
        if (!stdout.includes('FBro VIP 授权信息') || !stdout.includes('https://example.com')
          || !stdout.includes('FBro Image') || !stdout.includes('FBro Certificate')
          || !stdout.includes('FBro Frame Lookup') || !stdout.includes('FBro PDF Result')
          || !stdout.includes('FBro File Dialog Invalid')) return;
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
        if (stdout.includes('FBro VIP 授权信息') && stdout.includes('https://example.com')
          && stdout.includes('FBro Image') && stdout.includes('FBro Certificate')
          && stdout.includes('FBro Frame Lookup') && stdout.includes('FBro PDF Result')
          && stdout.includes('FBro File Dialog Invalid')) return;
        clearTimeout(timeout);
        clearInterval(poll);
        reject(new Error(`FBro 测试程序提前退出，退出码 ${String(code)}`));
      });
    });

    if (!stdout.includes('FBro 已创建')) throw new Error('未收到 FBro 浏览器创建完成事件');
    if (!stdout.includes('https://example.com')) throw new Error('未收到 FBro 浏览器加载完成地址');
    if (!/FBro 缓冲大小,\s*4/u.test(stdout) || !/FBro 缓冲十六进制,\s*41004200/u.test(stdout)) {
      throw new Error('FBro C ABI v2 受管缓冲的大小或十六进制结果不正确');
    }
    if (!/FBro Value 整数,\s*42,\s*10/u.test(stdout) || !/FBro Value 文本,\s*对象文本/u.test(stdout)) {
      throw new Error(`FBro Value 受管对象读写结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Dictionary,\s*2,\s*42,\s*LingBuilder/u.test(stdout)) {
      throw new Error(`FBro Dictionary 受管对象读写结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Dictionary Keys,\s*\[[^\]]*answer[^\]]*name[^\]]*\]/u.test(stdout)) {
      throw new Error(`FBro Dictionary UTF-16 JSON 键列表结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro List,\s*3,\s*first,\s*7/u.test(stdout)) {
      throw new Error(`FBro List 受管对象读写结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Binary,\s*41004200/u.test(stdout)) {
      throw new Error(`FBro Binary 与受管缓冲转换结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Nested List,\s*first/u.test(stdout) || !/FBro Nested Dictionary,\s*nested/u.test(stdout)) {
      throw new Error(`FBro 嵌套 Value、Dictionary、List 结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Stream,\s*41004200,\s*4,/u.test(stdout) || !/FBro Stream Seek,\s*0/u.test(stdout)) {
      throw new Error(`FBro 受管 Stream 读取或定位结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro 对象类型错误,\s*-8/u.test(stdout) || !/FBro 对象释放,\s*1,\s*-7/u.test(stdout)) {
      throw new Error(`FBro 对象类型校验或重复释放错误码不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro 子对象级联释放,\s*-7,\s*-7/u.test(stdout)) {
      throw new Error(`FBro 父子对象级联释放结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Frame,\s*16,\s*1,\s*1,\s*[01],\s*https:\/\/example\.com/u.test(stdout)
      || !/FBro Frame Lookup,\s*16,\s*[1-9][0-9]*,\s*0,\s*\[[^\]]+\],\s*\[/u.test(stdout)) {
      throw new Error(`FBro Frame 受管句柄、属性或按标识查找结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Image Wait,\s*1/u.test(stdout)
      || !/FBro Image,\s*0,\s*[1-9][0-9]*,\s*[1-9][0-9]*,\s*\{"actualScaleFactor":[0-9.]+,"pixelWidth":[1-9][0-9]*,"pixelHeight":[1-9][0-9]*\},\s*[1-9][0-9]*/u.test(stdout)) {
      throw new Error(`FBro 异步 Image 生产、受管句柄或 PNG 缓冲结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Certificate Wait,\s*1/u.test(stdout)
      || !/FBro Certificate,\s*(?:\*\.)?example\.com,.*?,\s*[1-9][0-9]{8,},\s*[1-9][0-9]{8,},\s*[0-9]+,\s*[1-9][0-9]*/u.test(stdout)) {
      throw new Error(`FBro 当前页面 Certificate、Principal 或 DER 缓冲结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro Cookie Set,\s*1/u.test(stdout)
      || !/FBro Cookie Set Result,\s*\{"accepted":true\}/u.test(stdout)
      || !/FBro Cookie Visit,\s*1/u.test(stdout)
      || !/FBro Cookie Visit Result,\s*\[/u.test(stdout)
      || !/FBro Cookie Visit All,\s*1/u.test(stdout)
      || !/FBro Cookie Visit All Result,\s*\[/u.test(stdout)
      || !/FBro Cookie Flush,\s*1/u.test(stdout)
      || !/FBro Cookie Delete,\s*1/u.test(stdout)
      || !/FBro Cache Clear,\s*1/u.test(stdout)
      || !/FBro Cache Clear Result,\s*\{"success":true\}/u.test(stdout)) {
      throw new Error(`FBro CookieManager 异步设置、遍历、刷新或删除结果不正确。实际输出：\n${stdout}`);
    }
    if (!/FBro PDF Wait,\s*1/u.test(stdout)
      || !/FBro PDF Result,\s*\{"success":true,"path":"[^"]*fbro-transfer-smoke\.pdf"\}/u.test(stdout)) {
      throw new Error(`FBro PDF 异步生成结果不正确。实际输出：\n${stdout}`);
    }
    const pdfStat = await fs.stat(pdfOutput).catch(() => undefined);
    if (!pdfStat || pdfStat.size < 100) throw new Error('FBro PDF 回调成功但输出文件不存在或内容为空');
    if (!/FBro File Dialog Invalid,\s*0/u.test(stdout)) {
      throw new Error(`FBro 文件对话框未阻止无效模式。实际输出：\n${stdout}`);
    }
    if (dialogClosePromise) await dialogClosePromise;
    if (dialogCloseError) throw new Error(`FBro 文件对话框自动取消失败：${dialogCloseError}\n${stdout}`);
    if (!/FBro Screenshot Invalid VIP Wait,\s*-5/u.test(stdout)
      || !/FBro Screenshot Invalid VIP Error,\s*FBro 截图需要有效 VIP Key[^,]*,\s*0/u.test(stdout)) {
      throw new Error(`FBro 截图未通过受管任务拒绝无效 VIP Key。实际输出：\n${stdout}`);
    }
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
      managedBufferVerified: true,
      managedValueVerified: true,
      managedDictionaryVerified: true,
      managedListVerified: true,
      managedNestedObjectsVerified: true,
      managedBinaryVerified: true,
      managedStreamVerified: true,
      managedImageVerified: true,
      managedCertificateVerified: true,
      managedFrameVerified: true,
      managedCookieSessionVerified: true,
      managedPdfTransferVerified: true,
      fileDialogValidationVerified: true,
      interactiveFileDialogSmoke: false,
      screenshotVipBoundaryVerified: true,
      objectLifecycleVerified: true,
      vipKeyLeaked: false,
      diagnostic: stdout.split(/\r?\n/u).find(line => line.includes('FBro VIP 授权信息'))?.trim() || ''
    }, null, 2));
  } finally {
    if (dialogClosePromise) await dialogClosePromise;
    await closeProcessTreeGracefully(child);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
