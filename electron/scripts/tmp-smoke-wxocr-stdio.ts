import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收（2026-10-20）：dist/cli.cjs 必须携带第 20 条 ㉑ 微信OCR口径，
 *  工具数 25，且 lingbuilder.ocr 经 module.info 实查为 19 命令并包含 OCR_识别字节集。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-wxocr-stdio-'));
  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--permission', 'readonly', '--workspace', workspaceRoot, '--port', '0'
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
      try { messages.push(JSON.parse(line)); } catch { /* 忽略非 JSON 行 */ }
    }
  });
  child.stderr.on('data', () => { /* 诊断日志 */ });
  const send = (payload: unknown) => child.stdin.write(JSON.stringify(payload) + '\n');
  // 必须先声明再被 waitMessage 的超时分支引用：原来声明在函数之后，超时时会抛
  // ReferenceError（Cannot access 'payload4Debug' before initialization），把真正的握手超时盖掉。
  let payload4Debug: unknown = null;
  const waitMessage = async (predicate: (message: Record<string, unknown>) => boolean, timeoutMs: number) => {
    const start = Date.now();
    for (;;) {
      const found = messages.find(predicate);
      if (found) return found;
      if (Date.now() - start > timeoutMs) throw new Error(`等待 MCP 消息超时：${JSON.stringify(payload4Debug)}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  };

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wxocr-smoke', version: '1.0.0' } } });
    const init = await waitMessage(m => m['id'] === 1, 20000);
    const instructions = String((init as { result?: { instructions?: string } }).result?.instructions || '');
    const keywords = [
      'OCR_识别字节集', 'OCR_取微信状态', 'OCR结果_释放', '仅 x64', '识图_模板匹配字节集',
      // 2026-10-22：三个真实工程复踩的 OCR 用法红线（索引基数/跨行语句/界面线程同步识别/线程本地错误）
      '计次循环首 的计次变量从 1 起', '索引 = 行 - 1', '暂不支持的中文 C++ 语句',
      '禁止在窗口事件里同步调用识别', 'OCR_取错误() 是线程本地错误'
    ];
    const missing = keywords.filter(keyword => !instructions.includes(keyword));
    if (missing.length) throw new Error(`instructions 缺少关键词：${missing.join('、')}`);
    console.log(`[PASS] instructions ㉑ 关键词 ${keywords.length}/${keywords.length}`);

    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    const tools = await waitMessage(m => m['id'] === 2, 20000) as { result?: { tools?: Array<{ name?: string }> } };
    const names = (tools.result?.tools || []).map(tool => tool.name || '');
    if (names.length !== 25) throw new Error(`工具数应为 25，实际 ${names.length}`);
    console.log(`[PASS] 工具数 ${names.length}`);

    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.ocr' } } });
    const info = await waitMessage(m => m['id'] === 3, 30000) as { result?: { content?: Array<{ text?: string }> } };
    const text = String(info.result?.content?.[0]?.text || '');
    const expectCommands = ['OCR_识别', 'OCR_识别字节集', 'OCR_取微信状态', 'OCR_停止', 'OCR结果_取JSON', 'OCR结果_释放'];
    const missingCommands = expectCommands.filter(command => !text.includes(command));
    if (missingCommands.length) throw new Error(`module.info 缺少命令：${missingCommands.join('、')}`);
    console.log(`[PASS] lingbuilder.ocr module.info 含 ${expectCommands.length} 条代表命令`);

    console.log('ALL PASS');
  } finally {
    child.kill();
    await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
