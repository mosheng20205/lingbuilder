import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * 真机 stdio 握手验收（2026-11-04 v7）：
 * 1) dist/cli.cjs 的 MCP instructions 必须携带第三方 .h 接入工作流 v7 关键词，工具数 25；
 * 2) tools/call file.read 读取临时工作区里的 GBK 编码 .h —— 真机断言中文内容解码正确且带
 *    legacyEncodingDecoded 标注。
 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-cppsrc-header-stdio-'));
  // 「中文」的 GBK 字节（D6D0 CEC4）；Node 无 GBK 编码器，手工拼。
  const gbkHeader = Buffer.concat([
    Buffer.from('#pragma once\r\n// gbk note: ', 'utf8'),
    Buffer.from([0xd6, 0xd0, 0xce, 0xc4]),
    Buffer.from('\r\ninline int probe(int a) { return a + 1; }\r\n', 'utf8')
  ]);
  await fs.writeFile(path.join(workspaceRoot, 'thirdparty.h'), gbkHeader);

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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-cppsrc-header', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const instructions = String((init.result as { instructions?: string }).instructions || '');

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = (tools.result as { tools?: Array<{ name: string; description?: string }> }).tools || [];

  send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.file.read', arguments: { filePath: 'thirdparty.h' } } });
  const read = await waitFor(message => message.id === 3);
  const readResultJson = JSON.stringify(read.result || {});

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  check('工具数仍为 25', toolList.length === 25, String(toolList.length));
  check('第 31 条 v7 工作流标题', instructions.includes('第三方 .h 头文件接入工作流'));
  check('file.read 旧编码标注口径', instructions.includes('legacyEncodingDecoded'));
  check('ASCII 薄包装配方', instructions.includes('ASCII 薄包装头'));
  check('shim 源码要求', instructions.includes('一行 shim .cpp'));
  check('物化自动转码口径', instructions.includes('自动转码为 UTF-8 副本'));
  check('纯类库免源码边界', instructions.includes('纯类库可只有「头文件 =」不带「源码 =」'));
  check('中文符号名硬墙', instructions.includes('中文 C++ 符号声明期中文诊断拒绝'));
  const fileReadTool = toolList.find(tool => tool.name === 'lingbuilder.file.read');
  check('file.read 工具描述带 GBK 解码说明', Boolean(fileReadTool?.description?.includes('legacyEncodingDecoded')), fileReadTool?.description?.slice(0, 60));
  check('GBK 头文件真机解码中文', readResultJson.includes('中文'), '');
  const readText = (read.result as { content?: Array<{ text?: string }> } | undefined)?.content?.[0]?.text || '';
  let parsedRead: { legacyEncodingDecoded?: string } = {};
  try { parsedRead = JSON.parse(readText) as { legacyEncodingDecoded?: string }; } catch { /* 非纯 JSON 响应走兜底 */ }
  check('file.read 响应带 legacyEncodingDecoded=gbk', parsedRead.legacyEncodingDecoded === 'gbk', readText.slice(0, 120));
  const readOk = (read.result as { isError?: boolean } | undefined);
  check('file.read 未报错', readOk ? readOk.isError !== true : false, '');

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => { /* 临时目录清理失败不阻断 */ });
  if (failures.length > 0) {
    console.error(`stdio 验收失败 ${failures.length} 项`);
    process.exitCode = 1;
  } else {
    console.log('stdio 验收 ALL PASS');
  }
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
