import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 第 8 条必须携带 HTTP 接口文档口径，工具数 25。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-httpdocs-stdio-'));
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-httpdocs', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const instructions = String((init.result as { instructions?: string }).instructions || '');

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = (tools.result as { tools?: Array<{ name: string }> }).tools || [];

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  check('工具数仍为 25', toolList.length === 25, String(toolList.length));
  check('第 8 条接口文档启用命令', instructions.includes('HTTP_启用接口文档(服务, "/docs", 标题)'));
  check('openapi.json 规范地址', instructions.includes('/docs/openapi.json'));
  check('离线内嵌无 CDN 红线', instructions.includes('无 CDN 依赖'));
  check('登记与真实路由一字不差红线', instructions.includes('登记的方法路径必须与真实路由一字不差'));
  check('声明性登记不阻断口径', instructions.includes('登记是声明性的、不阻断构建'));
  check('登记接口命令签名', instructions.includes('HTTP_登记接口(服务, 方法, 路径, 名称, 说明)'));
  check('登记接口参数常量', instructions.includes('#接口参数_路径/查询/请求头'));
  check('规范导出命令', instructions.includes('HTTP_取接口文档JSON(服务)'));
  check('版本口径 2.3.0', instructions.includes('lingbuilder.http.server` 模块（2.3.0）'));

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  if (failures.length > 0) process.exit(1);
  console.log('HTTPDOCS_STDIO_ALL_PASS');
}
main().catch(error => { console.error(error); process.exit(1); });
