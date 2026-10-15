import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 必须携带第 27 条窗口布局坐标红线，工具数 24。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-clause27-stdio-'));
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-clause27', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const instructions = String((init.result as { instructions?: string }).instructions || '');

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = (tools.result as { tools?: Array<{ name: string }> }).tools || [];
  const proposeTool = toolList.find(tool => tool.name === 'lingbuilder.edit.propose');
  const proposeDesc = JSON.stringify(proposeTool?.inputSchema ?? {});

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  check('工具数仍为 24', toolList.length === 24, String(toolList.length));
  check('第 27 条坐标红线条目', instructions.includes('手写/修改窗口布局的坐标红线'));
  check('客户区高度扣减口径', instructions.includes('客户区高度算成 window.height − 标题栏高'));
  check('普通/窄/无边框 28/20/0', instructions.includes('普通标题 28px、窄标题 20px、无边框 0px'));
  check('越界判别式', instructions.includes('y + 控件高度 ≤ 窗口声明高度 − 标题栏高'));
  check('560/532/536 实例锚点', instructions.includes('手写 y=536 的控件必被裁掉'));
  check('StatusBar 不自动停靠红线', instructions.includes('不会自动停靠窗口底部'));
  check('edit.propose updatedDesignerProject 描述带红线', proposeDesc.includes('客户区高=窗口高−标题栏高'));

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  if (failures.length > 0) process.exit(1);
  console.log('CLAUSE27_STDIO_ALL_PASS');
}
main().catch(error => { console.error(error); process.exit(1); });
