const path = require('node:path');
const { spawn } = require('node:child_process');

const electronRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(electronRoot, '..');
const cliEntry = path.join(electronRoot, 'dist', 'cli.cjs');
const token = 'lingbuilder-local-health-smoke-token';
const child = spawn(process.execPath, [
  cliEntry,
  'ai-server',
  '--workspace', workspaceRoot,
  '--host', '127.0.0.1',
  '--port', '0',
  '--permission', 'preview',
  '--token', token
], { cwd: electronRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });

let output = '';
let errorOutput = '';
let finished = false;
let verifying = false;
const timer = setTimeout(() => finish(new Error('AI Bridge health smoke 启动超时。')), 15_000);

child.stdout.on('data', chunk => {
  output += String(chunk);
  const ready = output.match(/^LINGBUILDER_AI_BRIDGE_READY (.+)$/mu);
  if (!ready || finished || verifying) return;
  verifying = true;
  void verify(JSON.parse(ready[1]));
});
child.stderr.on('data', chunk => { errorOutput += String(chunk); });
child.once('error', finish);
child.once('exit', code => {
  if (!finished) finish(new Error(errorOutput || output || `AI Bridge 提前退出：${code}`));
});

async function verify(ready) {
  try {
    const response = await fetch(`${ready.origin}/api/ai-bridge/health`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(`健康检查失败：HTTP ${response.status}`);
    process.stdout.write(`${JSON.stringify({ ok: true, origin: ready.origin, permission: result.permission })}\n`);
    finish();
  } catch (error) {
    finish(error);
  }
}

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timer);
  if (!child.killed && child.exitCode === null) child.kill('SIGTERM');
  if (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n${errorOutput}`);
    process.exitCode = 1;
  }
}
