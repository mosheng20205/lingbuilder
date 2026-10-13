import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/** 真机 stdio 握手验收：dist/cli.cjs 必须携带第 25 条安装包导出指引，工具数 24。 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-installer-stdio-'));
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
      try {
        messages.push(JSON.parse(line) as Record<string, unknown>);
      } catch {
        // 非消息行忽略。
      }
    }
  });
  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));

  const send = (message: Record<string, unknown>) => {
    const body = JSON.stringify(message);
    child.stdin.write(`${body}\n`);
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

  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept', version: '0' } } });
  const init = await waitFor(message => message.id === 1);
  const instructions = String((init.result as { instructions?: string }).instructions || '');

  send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = await waitFor(message => message.id === 2);
  const toolList = (tools.result as { tools?: Array<{ name: string }> }).tools || [];
  const installerTool = toolList.find(tool => tool.name === 'lingbuilder.installer.export');

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };
  check('initialize instructions 含安装包导出工作流', instructions.includes('lingbuilder.installer.export'));
  check('instructions 写明先构建后导出与产物位置', instructions.includes('构建输出目录 installer'));
  check('instructions 写明 DLL 项目拒绝', instructions.includes('DLL（动态库）项目会被中文拒绝'));
  check('工具数 24', toolList.length === 24, String(toolList.length));
  check('installer.export 工具存在', Boolean(installerTool));

  child.kill();
  await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  if (failures.length > 0) {
    console.error(`失败 ${failures.length} 项`);
    process.exit(1);
  }
  console.log('ALL PASS');
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
