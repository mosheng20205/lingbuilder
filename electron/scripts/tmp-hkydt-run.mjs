// 一次性驱动：构建 HKydt hkydt-multibox 项目（x64 Release，只构建不运行）。
// 用法：node scripts/tmp-hkydt-build.mjs
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import process from 'node:process';

const cliEntry = path.resolve(import.meta.dirname, '..', 'dist', 'cli.cjs');
const workspaceRoot = 'T:\\逆向\\HKydt';

const child = spawn(process.execPath, [cliEntry, 'ai-server', '--workspace', workspaceRoot, '--mcp', '--stdio-only'], {
  cwd: path.dirname(cliEntry),
  env: { ...process.env, LINGBUILDER_RESOURCE_ROOT: 'C:\\Users\\Administrator\\AppData\\Local\\Programs\\LingBuilder\\resources' },
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
  } else if (message && message.method === 'notifications/message') {
    const note = message.params || {};
    console.log(`  [进度] ${note.message ?? ''}`);
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

import fs from 'node:fs';
const T = (s) => fs.appendFileSync('T:/逆向/HKydt/tools/run-driver.trace', new Date().toISOString().slice(11,19) + ' ' + s + String.fromCharCode(10));
T('driver start');
T('sending initialize');
const init = await request('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'hkydt-build', version: '0.0.1' },
});
if (!init.result) {
  console.error('初始化失败：', JSON.stringify(init).slice(0, 400));
  process.exit(1);
}
child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`);

T('calling build.run run:true');
const call = await request('tools/call', {
  name: 'lingbuilder.build.run',
  arguments: { projectId: 'hkydt-multibox', approved: true, run: true },
});
const text = textOf(call.result);
T('response bytes=' + text.length);
try {
  const parsed = JSON.parse(text);
  const diags = parsed.compilerDiagnostics || (parsed.result && parsed.result.compilerDiagnostics) || [];
  console.log(`结构化诊断 ${diags.length} 条：`);
  for (const d of diags.slice(0, 10)) console.log(JSON.stringify(d));
} catch {
  console.log(text.slice(0, 2500));
}
await new Promise(r => setTimeout(r, 180000));
child.kill();
process.exit(0);
