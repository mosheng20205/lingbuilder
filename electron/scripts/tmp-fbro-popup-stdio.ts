import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收（2026-10-29）：dist/cli.cjs 必须携带第 22 条弹窗链反误解口径与弹窗边界命令，工具数 25。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-fbro-popup-stdio-'));
  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--permission', 'yolo', '--workspace', workspaceRoot, '--port', '0'
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
      try {
        messages.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // 非消息行忽略。
      }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  const send = (message: Record<string, unknown>) => {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  };
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean, timeoutMs = 30_000): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = messages.find(predicate);
      if (hit) return hit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('等待 MCP 响应超时');
  };
  const textOf = (message: Record<string, unknown>): string => {
    const content = (message.result as { content?: Array<{ type?: string; text?: string }> })?.content || [];
    return content.map(item => item.text || '').join('\n');
  };

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept', version: '0' } } });
    const init = await waitFor(message => message.id === 1);
    const instructions = String((init.result as { instructions?: string }).instructions || '');
    check('instructions 携带弹窗链反误解红线', instructions.includes('没有名字带「创建」的命令'));
    check('instructions 携带弹窗边界设置命令口径', instructions.includes('FBro_实例设置窗口边界(弹窗, X, Y, 宽, 高)'));
    check('instructions 携带弹窗边界回读命令', instructions.includes('FBro_实例取窗口边界JSON(弹窗)'));
    check('instructions 携带弹窗顶层 HWND 查询命令', instructions.includes('FBro_实例取窗口句柄(弹窗)'));

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = await waitFor(message => message.id === 2);
    const toolCount = ((tools.result as { tools?: unknown[] }).tools || []).length;
    check('工具数仍为 25', toolCount === 25, `实际 ${toolCount}`);

    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.module.info', arguments: { moduleId: 'lingbuilder.fbro.browser' } } });
    const info = await waitFor(message => message.id === 3);
    const infoText = textOf(info);
    for (const command of ['FBro_实例取窗口句柄', 'FBro_实例取窗口边界JSON', 'FBro_实例设置窗口边界']) {
      check(`module.info 暴露 ${command}`, infoText.includes(command));
    }
    check('module.info 版本为 2.13.0', infoText.includes('2.13.0'));
  } finally {
    child.kill();
  }
  if (failures.length) {
    console.error(`stdio 验收失败 ${failures.length} 项`);
    process.exitCode = 1;
  } else {
    console.log('FBro 弹窗边界 stdio 握手验收全 PASS');
  }
}

main().catch(error => { console.error(error instanceof Error ? error.stack || error.message : error); process.exitCode = 1; });
