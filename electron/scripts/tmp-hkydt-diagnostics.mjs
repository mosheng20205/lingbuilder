// 一次性驱动：对 T:\逆向\HKydt 工作区跑 lingcpp 诊断（stdio MCP）。
// 用法：node scripts/tmp-hkydt-diagnostics.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import process from 'node:process';

const cliEntry = path.resolve(import.meta.dirname, '..', 'dist', 'cli.cjs');
const workspaceRoot = 'T:\\逆向\\HKydt';
const files = [
  'src/hkydt-multibox/MainWindow.lcpp',
  'src/hkydt-multibox/项目C++源码库.lcpp',
];

const child = spawn(process.execPath, [cliEntry, 'ai-server', '--workspace', workspaceRoot, '--mcp', '--stdio-only'], {
  cwd: path.dirname(cliEntry),
  stdio: ['pipe', 'pipe', 'pipe'],
});
const pending = new Map();
let nextId = 1;

const rl = createInterface({ input: child.stdout });
rl.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  if (message && message.id !== undefined && pending.has(message.id)) {
    const resolve = pending.get(message.id);
    pending.delete(message.id);
    resolve(message);
  }
});
child.stderr.on('data', chunk => process.stderr.write(String(chunk)));

function request(method, params) {
  const id = nextId++;
  return new Promise(resolve => {
    pending.set(id, resolve);
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
  });
}

function textOf(result) {
  if (!result || !Array.isArray(result.content)) return JSON.stringify(result);
  return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
}

const init = await request('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'hkydt-diag', version: '0.0.1' },
});
if (!init.result) {
  console.error('初始化失败：', JSON.stringify(init).slice(0, 400));
  process.exit(1);
}
child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

for (const file of files) {
  const call = await request('tools/call', {
    name: 'lingbuilder_lingcpp_diagnostics',
    arguments: { filePath: file },
  });
  const text = textOf(call.result);
  const parsed = (() => { try { return JSON.parse(text); } catch { return null; } })();
  const items = parsed && Array.isArray(parsed.diagnostics) ? parsed.diagnostics : [];
  const errors = items.filter(item => item.severity === 'error');
  const warnings = items.filter(item => item.severity !== 'error');
  console.log(`\n=== ${file}`);
  console.log(`error=${errors.length} warning=${warnings.length}`);
  for (const item of items.slice(0, 40)) {
    console.log(`  [${item.severity}] L${item.line ?? '?'}:${item.column ?? '?'} ${item.code ?? ''} ${item.message}`);
  }
}

child.kill();
process.exit(0);
