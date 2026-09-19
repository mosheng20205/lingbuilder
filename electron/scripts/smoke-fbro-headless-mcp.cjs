// 真机 stdio 验收：经打包宿主（dist/cli.cjs ai-server --mcp --stdio-only）调用
// lingbuilder.module.info，确认 FBro 无头命令与句柄命令族已进入外部 AI 可见清单。
const { spawn } = require('node:child_process');
const path = require('node:path');

const cliDir = path.resolve(__dirname, '..');
const cli = path.join(cliDir, 'dist', 'cli.cjs');
const host = spawn(process.execPath, [cli, 'ai-server', '--workspace', path.resolve(cliDir, '..'), '--mcp', '--stdio-only'], {
  cwd: cliDir, stdio: ['pipe', 'pipe', 'inherit'], windowsHide: true
});
let buffer = '';
const pending = new Map();
host.stdout.on('data', chunk => {
  buffer += chunk.toString('utf8');
  let index;
  while ((index = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, index).trim();
    buffer = buffer.slice(index + 1);
    if (!line) continue;
    const message = JSON.parse(line);
    const resolver = pending.get(message.id);
    if (resolver) { pending.delete(message.id); resolver(message); }
  }
});
function request(id, method, params) {
  return new Promise(resolve => {
    pending.set(id, resolve);
    host.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
(async () => {
  const init = await request(1, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'headless-bundle-check', version: '1.0.0' }
  });
  const instructions = init.result?.instructions || '';
  const checks = [
    ['instructions 含无头口径', /FBro_启用无头模式/.test(instructions) && /FBro_实例等待加载超时/.test(instructions)]
  ];
  host.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const info = await request(2, 'tools/call', {
    name: 'lingbuilder.module.info',
    arguments: { moduleId: 'lingbuilder.fbro.browser' }
  });
  const text = (info.result?.content || []).map(item => item.text || '').join('\n');
  checks.push(['module.info 命中 FBro_启用无头模式', text.includes('FBro_启用无头模式')]);
  checks.push(['module.info 命中 实例等待加载超时', text.includes('FBro_实例等待加载超时') || text.includes('实例等待加载超时')]);
  let fail = 0;
  for (const [label, ok] of checks) {
    console.log(ok ? 'PASS' : 'FAIL', label);
    if (!ok) fail += 1;
  }
  host.stdin.end();
  host.kill();
  console.log(`合计 ${checks.length} 项，失败 ${fail} 项`);
  process.exitCode = fail ? 1 : 0;
})();
