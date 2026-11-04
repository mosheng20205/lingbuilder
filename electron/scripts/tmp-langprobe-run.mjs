// 一次性判别：托管运行 fbro-lang-probe（控制台 VIP 链探针），回读 run.log。
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';
import process from 'node:process';

const cliEntry = path.resolve(import.meta.dirname, '..', 'dist', 'cli.cjs');
const workspaceRoot = 'T:\\electron\\lingbuilder';

const child = spawn(process.execPath, [cliEntry, 'ai-server', '--workspace', workspaceRoot, '--mcp', '--stdio-only'], {
  cwd: path.dirname(cliEntry),
  stdio: ['pipe', 'pipe', 'pipe'],
});
const pending = new Map();
let nextId = 1;
const rl = createInterface({ input: child.stdout });
rl.on('line', line => {
  let m; try { m = JSON.parse(line); } catch { return; }
  if (m && m.id !== undefined && pending.has(m.id)) { const r = pending.get(m.id); pending.delete(m.id); r(m); }
});
function request(method, params) {
  const id = nextId++;
  return new Promise(res => { pending.set(id, res); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
}
function textOf(result) {
  if (!result || !Array.isArray(result.content)) return JSON.stringify(result);
  return result.content.filter(i => i.type === 'text').map(i => i.text).join('\n');
}
await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe-run', version: '0' } });
child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');

const build = await request('tools/call', { name: 'lingbuilder.build.run', arguments: { projectId: 'fbro-lang-probe', approved: true, run: true } });
console.log('== build.run ==');
console.log(textOf(build.result).slice(0, 900));
const wait = await request('tools/call', { name: 'lingbuilder.run.wait', arguments: { projectId: 'fbro-lang-probe', timeoutSeconds: 90 } });
console.log('== run.wait ==');
console.log(textOf(wait.result).slice(0, 400));
const log = await request('tools/call', { name: 'lingbuilder.run.log', arguments: { projectId: 'fbro-lang-probe', tailLines: 40 } });
console.log('== run.log ==');
console.log(textOf(log.result).slice(0, 3000));
child.kill();
process.exit(0);
