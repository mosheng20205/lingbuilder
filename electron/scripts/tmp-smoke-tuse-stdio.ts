import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 必须携带 ㉒ 图色自动化口径（识图 1.1.0/截图 1.1.0/opencv 1.1.0），工具数 25。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-tuse-stdio-'));
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-tuse', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const result = init.result as { instructions?: string; serverInfo?: { name?: string; version?: string } } | undefined;
  const instructions = String(result?.instructions || '');
  const keywords = [
    '识图_模板匹配全部',
    '识图_取第N横坐标/纵坐标（序号从 1 起',
    '识图_等待出现/识图_等待消失',
    '阻塞当前线程，窗口程序必须放 线程_提交 家族的工作线程里跑',
    '截图_窗口到字节集(句柄)',
    'OpenCV_加载图像字节集',
    '坐标 + 模板宽高÷2',
    '投屏帧坐标≠手机/屏幕坐标',
    '识图状态（取结果/取第N）是线程本地存储',
    '模板不得超过 512×512 像素',
    '图色自动化找图找色'
  ];
  let failed = 0;
  for (const keyword of keywords) {
    if (instructions.includes(keyword)) {
      console.log(`PASS ㉒ 关键词：${keyword}`);
    } else {
      failed += 1;
      console.error(`FAIL ㉒ 关键词缺失：${keyword}`);
    }
  }
  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolCount = Array.isArray((tools.result as { tools?: unknown[] })?.tools) ? ((tools.result as { tools: unknown[] }).tools).length : 0;
  if (toolCount === 25) console.log(`PASS 工具数：${toolCount}`);
  else { failed += 1; console.error(`FAIL 工具数期望 25 实际 ${toolCount}`); }
  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  if (failed) throw new Error(`㉒ 图色自动化 stdio 验收失败 ${failed} 项`);
  console.log('PASS ㉒ 图色自动化 stdio 握手验收全绿');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
