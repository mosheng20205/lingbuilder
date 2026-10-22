import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 必须携带第 20 条⑳ Win32 程序化滚动口径，工具数 25，新命令可查。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-scroll-stdio-'));
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept-scroll', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const instructions = String((init.result as { instructions?: string }).instructions || '');

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = (tools.result as { tools?: Array<{ name: string }> }).tools || [];

  const callModuleInfo = async (id: number, moduleId: string, query: string) => {
    send({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId, query } } });
    const response = await waitFor(message => message.id === id);
    const content = (response.result as { content?: Array<{ text?: string }> }).content || [];
    return JSON.parse(content.map(item => item.text || '').join('') || '{}') as {
      commandsTotal?: number;
      commands?: Array<{ name: string }>;
    };
  };

  const basicScroll = await callModuleInfo(3, 'lingbuilder.win32.basic', '滚动');
  const commonScroll = await callModuleInfo(4, 'lingbuilder.win32.common-controls', '滚动到行');

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  const commandNames = (value: { commands?: Array<{ name: string }> }) => new Set((value.commands || []).map(command => command.name));

  check('工具数仍为 25', toolList.length === 25, String(toolList.length));
  check('第 20 条⑳条目标题', instructions.includes('Win32 程序化滚动'));
  check('列表框_滚动到项', instructions.includes('列表框_滚动到项'));
  check('编辑框_滚动', instructions.includes('编辑框_滚动(控件名, 行数)'));
  check('编辑框_滚动到底', instructions.includes('编辑框_滚动到底'));
  check('表格_滚动到行', instructions.includes('表格_滚动到行'));
  check('列表视图既有滚动族点名', instructions.includes('列表视图_取每页行数'));
  check('适用控件边界红线', instructions.includes('组合框/单行编辑框/分组框等其余控件没有滚动命令'));
  check('win32.basic 命令总数 244', basicScroll.commandsTotal === 244, String(basicScroll.commandsTotal));
  const basicNames = commandNames(basicScroll);
  check('module.info 可查 列表框_滚动到项', basicNames.has('列表框_滚动到项'));
  check('module.info 可查 编辑框_滚动', basicNames.has('编辑框_滚动'));
  check('module.info 可查 编辑框_滚动到底', basicNames.has('编辑框_滚动到底'));
  check('common-controls 命令总数 561', commonScroll.commandsTotal === 561, String(commonScroll.commandsTotal));
  check('module.info 可查 表格_滚动到行', commandNames(commonScroll).has('表格_滚动到行'));

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true });
  if (failures.length) {
    console.error(`\n${failures.length} 项失败`);
    process.exit(1);
  }
  console.log('\n全部 PASS');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
