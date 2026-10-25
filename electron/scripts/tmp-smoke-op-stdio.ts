/**
 * OP 后台图色模块 stdio 握手验收：以 stdio MCP 宿主形态拉起 dist/cli.cjs，
 * 完成 initialize 握手并核对 instructions 关键词与工具数（2026-10-24 批次5）。
 */
import { spawn } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const workspaceRoot = process.argv[2] || path.resolve(root, '..');
const cliPath = path.join(root, 'dist', 'cli.cjs');

function send(proc: ReturnType<typeof spawn>, message: unknown): void {
  proc.stdin!.write(JSON.stringify(message) + '\n');
}

async function readUntil(proc: ReturnType<typeof spawn>, predicate: (message: any) => boolean): Promise<any> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let newlineIndex = buffer.indexOf('\n');
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const message = JSON.parse(line);
            if (predicate(message)) {
              proc.stdout!.off('data', onData);
              resolve(message);
              return;
            }
          } catch {
            // 非 JSON 行忽略
          }
        }
        newlineIndex = buffer.indexOf('\n');
      }
    };
    proc.stdout!.on('data', onData);
    proc.once('exit', code => reject(new Error(`cli 提前退出：${code}`)));
    setTimeout(() => reject(new Error('等待响应超时')), 30000).unref();
  });
}

async function main(): Promise<void> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-op-stdio-'));
  const proc = spawn(process.execPath, [cliPath, 'ai-server', '--workspace', workspaceRoot, '--port', '0', '--mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, LINGBUILDER_AI_BRIDGE_TOKEN: 'op-smoke-token-0123456789' }
  });
  let stderr = '';
  proc.stderr!.on('data', chunk => { stderr += chunk.toString('utf8'); });
  try {
    send(proc, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'op-smoke', version: '1.0' } } });
    const init = await readUntil(proc, message => message.id === 1 && message.result);
    const instructions = String(init.result?.instructions || '');
    const keywords = ['lingbuilder.op', '后台_绑定窗口', '后台_找图全部', '颜色一律 RRGGBB', '右下边界是开区间', '兼容大漠 dm.txt 字库'];
    let pass = 0;
    for (const keyword of keywords) {
      const ok = instructions.includes(keyword);
      if (ok) pass += 1;
      console.log(`${ok ? 'PASS' : 'FAIL'} 关键词 ${keyword}`);
    }
    send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });
    send(proc, { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = await readUntil(proc, message => message.id === 2 && message.result);
    const toolCount = (tools.result?.tools || []).length;
    console.log(`${toolCount === 25 ? 'PASS' : 'FAIL'} 工具数 25（实际 ${toolCount}）`);
    send(proc, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.op', query: '后台_绑定窗口' } } });
    const info = await readUntil(proc, message => message.id === 3 && (message.result || message.error));
    const infoText = JSON.stringify(info.result || info.error || {});
    const infoOk = infoText.includes('后台_绑定窗口');
    console.log(`${infoOk ? 'PASS' : 'FAIL'} module.info 可查 OP 命令签名`);
    const total = pass + (toolCount === 25 ? 1 : 0) + (infoOk ? 1 : 0);
    console.log(`RESULT: ${total}/${keywords.length + 2} PASS`);
    if (total < keywords.length + 2) process.exit(1);
  } finally {
    proc.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error('SMOKE FAILED:', error.message);
  if (stderr) console.error(stderr.slice(0, 2000));
  process.exit(1);
});
