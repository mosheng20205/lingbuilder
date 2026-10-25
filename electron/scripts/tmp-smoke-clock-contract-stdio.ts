import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 必须携带时钟 periodHandler 单份定义契约，工具数 25。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-clock-contract-stdio-'));
  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--workspace', workspaceRoot, '--port', '0'
  ], { stdio: ['pipe', 'pipe', 'pipe'] });

  let lineBuffer = '';
  const messages: Array<Record<string, unknown>> = [];
  child.stdout.on('data', (chunk: Buffer) => {
    lineBuffer += chunk.toString('utf8');
    let index: number;
    while ((index = lineBuffer.indexOf('\n')) >= 0) {
      const line = lineBuffer.slice(0, index).trim();
      lineBuffer = lineBuffer.slice(index + 1);
      if (!line) continue;
      try { messages.push(JSON.parse(line) as Record<string, unknown>); } catch { /* 非消息行忽略 */ }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  const send = (message: Record<string, unknown>) => { child.stdin.write(`${JSON.stringify(message)}\n`); };
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean, timeoutMs = 30_000): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = messages.find(predicate);
      if (hit) return hit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('等待 MCP 响应超时');
  };

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-clock-contract', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const result = (init.result || {}) as { instructions?: string; serverInfo?: { name?: string } };
  const instructions = String(result.instructions || '');

  const checks: Array<[RegExp, string]> = [
    [/时钟「周期到期」处理器必须在源码类里声明同名方法/u, '第 13 条时钟单份定义契约'],
    [/new_emoji 后端不支持时钟组件/u, '第 13 条 NE 后端时钟阻断'],
    [/事件 名\(\) 或 空 名\(\)/u, '第 13 条同名方法两种声明写法']
  ];
  let failed = 0;
  for (const [pattern, label] of checks) {
    if (pattern.test(instructions)) {
      console.log(`PASS: ${label}`);
    } else {
      console.error(`FAIL: ${label}`);
      failed += 1;
    }
  }

  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = ((tools.result || {}) as { tools?: unknown[] }).tools || [];
  console.log(`工具数: ${toolList.length}`);
  if (toolList.length !== 25) failed += 1;

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  if (failed) {
    console.error(`验收失败 ${failed} 项`);
    process.exitCode = 1;
  } else {
    console.log('时钟 periodHandler 契约 stdio 验收全 PASS');
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
