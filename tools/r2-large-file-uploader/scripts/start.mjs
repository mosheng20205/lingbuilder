import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const serverEntry = fileURLToPath(new URL('./local-server.mjs', import.meta.url));
const requestedPort = Number(process.env.R2_UPLOADER_PORT || 8791);

if (!Number.isInteger(requestedPort) || requestedPort < 1 || requestedPort > 65_535) {
  throw new Error('R2_UPLOADER_PORT 必须是 1 到 65535 之间的整数。');
}

const localUrl = `http://127.0.0.1:${requestedPort}`;
const server = spawn(process.execPath, [serverEntry], {
  cwd: projectRoot,
  env: { ...process.env, R2_UPLOADER_PORT: String(requestedPort) },
  stdio: 'inherit',
});

const serverExit = new Promise(resolve => {
  server.once('exit', (code, signal) => resolve({ code, signal }));
});

async function waitForPage() {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (server.exitCode !== null) throw new Error('本地上传服务在页面启动前已退出。');
    try {
      const response = await fetch(localUrl);
      if (response.ok) return;
    } catch {
      // 本地服务仍在初始化。
    }
    await delay(250);
  }
  throw new Error(`等待上传页面超时：${localUrl}`);
}

function openBrowser(url) {
  if (process.env.R2_UPLOADER_NO_OPEN === '1') return;

  let command;
  let args;
  if (process.platform === 'win32') {
    command = 'rundll32.exe';
    args = ['url.dll,FileProtocolHandler', url];
  } else if (process.platform === 'darwin') {
    command = 'open';
    args = [url];
  } else {
    command = 'xdg-open';
    args = [url];
  }

  const opener = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  opener.unref();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.kill(signal));
}

try {
  await waitForPage();
  process.stdout.write(`\nR2 大文件上传器已启动：${localUrl}\n`);
  process.stdout.write('请在页面中配置 R2 S3 API 凭据；完成后文件会作为一个完整对象写入真实 R2 存储桶。\n');
  openBrowser(localUrl);
  const result = await serverExit;
  process.exitCode = result.code ?? (result.signal ? 1 : 0);
} catch (error) {
  server.kill();
  throw error;
}
