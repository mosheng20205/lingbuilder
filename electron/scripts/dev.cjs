const { spawn } = require('node:child_process');
const net = require('node:net');
const path = require('node:path');

const DEV_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3001/';
const PROJECT_ROOT = path.join(__dirname, '..');
const WORKSPACE_ROOT = path.join(PROJECT_ROOT, '..');
const env = {
  ...process.env,
  NODE_ENV: 'development',
  ELECTRON_RENDERER_URL: DEV_URL,
  HOST: '127.0.0.1',
  PORT: new URL(DEV_URL).port || '3001',
  LINGBUILDER_WORKSPACE_ROOT: WORKSPACE_ROOT,
  LINGBUILDER_RULEBOOK_PATH: path.join(WORKSPACE_ROOT, 'LingBuilder AI 规则手册.md'),
  LINGBUILDER_DEV_NO_AUTH: 'true',
  LINGBUILDER_AI_BRIDGE_ENABLED: 'false',
};

const command = [
  'npx',
  'concurrently',
  '-k',
  '-n',
  'SERVER,ELECTRON',
  '-c',
  'blue,green',
  '"npm:dev:renderer"',
  '"npm:dev:desktop"',
].join(' ');

function assertPortAvailable(host, port) {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', error => reject(new Error(
      `LingBuilder 开发端口 ${host}:${port} 已被占用。请先关闭旧的 npm run dev 窗口，再重新启动。\n${error.message}`
    )));
    probe.listen({ host, port, exclusive: true }, () => probe.close(resolve));
  });
}

async function main() {
  await assertPortAvailable(env.HOST, Number(env.PORT));
  const dev = spawn(command, {
    stdio: 'inherit',
    shell: true,
    env,
  });
  dev.on('exit', (code) => process.exit(code ?? 0));
}

main().catch(error => {
  console.error(`[dev] ${error.message}`);
  process.exit(1);
});
