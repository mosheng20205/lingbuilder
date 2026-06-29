const { spawn } = require('node:child_process');

const DEV_URL = process.env.ELECTRON_RENDERER_URL || 'http://127.0.0.1:3001/';
const env = {
  ...process.env,
  ELECTRON_RENDERER_URL: DEV_URL,
  PORT: new URL(DEV_URL).port || '3001',
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

const dev = spawn(command, {
  stdio: 'inherit',
  shell: true,
  env,
});

dev.on('exit', (code) => process.exit(code ?? 0));
