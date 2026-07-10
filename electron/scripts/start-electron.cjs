const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const DEV_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3001/';
const WAIT_TIMEOUT_MS = 30000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        ELECTRON_RENDERER_URL: DEV_URL,
      },
      ...options,
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function waitForRenderer() {
  const started = Date.now();

  while (Date.now() - started < WAIT_TIMEOUT_MS) {
    if (await checkUrl(DEV_URL)) return;
    await sleep(500);
  }

  throw new Error(`Timed out waiting for renderer at ${DEV_URL}`);
}

async function main() {
  console.log(`[desktop] Waiting for renderer at ${DEV_URL}`);
  await waitForRenderer();

  const projectRoot = path.join(__dirname, '..');
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:electron'], {
    cwd: projectRoot,
  });

  const electronExe = path.join(projectRoot, 'node_modules', 'electron', 'dist', process.platform === 'win32' ? 'electron.exe' : 'electron');
  await run(electronExe, ['.'], {
    cwd: projectRoot,
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
