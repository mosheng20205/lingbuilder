/**
 * module.info 未找到提示模糊匹配 stdio 验收：以 stdio MCP 宿主形态拉起 dist/cli.cjs，
 * 用俗称 usbhid 查询模块，核对未找到提示给出 lingbuilder.aoahid；再核对 aoahid 清单带 USB 标签。
 */
import { spawn } from 'node:child_process';
import * as path from 'node:path';

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

function resultText(message: any): string {
  const content = message?.result?.content;
  if (Array.isArray(content)) return content.map((item: any) => String(item?.text || '')).join('\n');
  return JSON.stringify(message?.result ?? message?.error ?? {});
}

async function main(): Promise<void> {
  const proc = spawn(process.execPath, [cliPath, 'ai-server', '--workspace', workspaceRoot, '--port', '0', '--mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, LINGBUILDER_AI_BRIDGE_TOKEN: 'suggest-smoke-token-0123456789' }
  });
  let stderr = '';
  proc.stderr!.on('data', chunk => { stderr += chunk.toString('utf8'); });
  let nextId = 1;
  try {
    send(proc, { jsonrpc: '2.0', id: nextId++, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'suggest-smoke', version: '1.0' } } });
    await readUntil(proc, message => message.id === 1 && (message.result || message.error));
    send(proc, { jsonrpc: '2.0', method: 'notifications/initialized' });

    send(proc, { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.usbhid' } } });
    const miss = await readUntil(proc, message => message.id === 2);
    const missText = resultText(miss);
    if (!missText.includes('未找到模块「lingbuilder.usbhid」') || !missText.includes('相近模块：lingbuilder.aoahid')) {
      throw new Error(`usbhid 查询未提示 aoahid：${missText.slice(0, 400)}`);
    }
    console.log('PASS 1/3  module.info("lingbuilder.usbhid") → 相近模块：lingbuilder.aoahid');

    send(proc, { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: '触控' } } });
    const cjk = await readUntil(proc, message => message.id === 3);
    const cjkText = resultText(cjk);
    if (!cjkText.includes('相近模块：lingbuilder.aoahid')) {
      throw new Error(`中文俗称查询未提示 aoahid：${cjkText.slice(0, 400)}`);
    }
    console.log('PASS 2/3  module.info("触控") → 相近模块：lingbuilder.aoahid');

    send(proc, { jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.aoahid' } } });
    const hit = await readUntil(proc, message => message.id === 4);
    const hitText = resultText(hit);
    if (!hitText.includes('"lingbuilder.aoahid"') || !hitText.includes('USB')) {
      throw new Error(`aoahid 查询异常或缺少 USB 标签：${hitText.slice(0, 400)}`);
    }
    console.log('PASS 3/3  module.info("lingbuilder.aoahid") 正常返回且 tags 含 USB');

    console.log('ALL PASS');
  } finally {
    proc.kill();
  }
  if (stderr.trim()) console.error(`[stderr] ${stderr.slice(0, 400)}`);
}

main().catch(error => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
