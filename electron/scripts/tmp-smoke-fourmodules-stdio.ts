/**
 * 四缺口模块批次 MCP 指令 stdio 真机验收（2026-10-24）。
 * 启动打包版 cli（dist/cli.cjs）的 --mcp stdio 形态，Initialize 握手后断言
 * instructions 含第 29 条新能力关键词与既有工作流锚点，最后 graceful 关闭。
 * 运行：npx tsx scripts/tmp-smoke-fourmodules-stdio.ts
 */
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import * as fs from 'node:fs';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const cli = path.join(repoRoot, 'electron', 'dist', 'cli.cjs');
if (!fs.existsSync(cli)) throw new Error('缺少 dist/cli.cjs，请先重建。');

interface JsonRpcMessage { jsonrpc: string; id?: number | string; method?: string; params?: unknown; result?: unknown; error?: { message?: string } }

function main(): Promise<void> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(process.execPath, [cli, 'ai-server', '--workspace', repoRoot, '--port', '0', '--mcp', '--permission', 'yolo'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, LINGBUILDER_DEV_NO_AUTH: 'true' }
    });
    let buffer = '';
    const settled = new Promise<JsonRpcMessage>((ok) => {
      const onLine = (line: string) => {
        if (!line.trim().startsWith('{')) return;
        try {
          const message = JSON.parse(line) as JsonRpcMessage;
          if (message.id === 1 && message.result) ok(message);
        } catch { /* 忽略非 JSON 行 */ }
      };
      child.stdout!.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8');
        let index: number;
        while ((index = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          onLine(line);
        }
      });
    });
    const stderrTail: string[] = [];
    child.stderr!.on('data', (chunk: Buffer) => stderrTail.push(chunk.toString('utf8')));
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('stdio 握手超时：' + stderrTail.slice(-3).join('')));
    }, 60_000);
    child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'fourmodules-smoke', version: '1.0' } } }) + '\n');
    settled.then((message) => {
      clearTimeout(timer);
      const result = message.result as { instructions?: string } | undefined;
      const instructions = String(result?.instructions || '');
      const keywords = [
        'lingbuilder.project.create',
        'Word_从JSON生成报告',
        'Word_替换占位符',
        'PDF_转Word文本流',
        'PDF_外部文档转PDF',
        'OpenCV_读下一帧',
        'lingbuilder.barcode'
      ];
      const missing = keywords.filter(keyword => !instructions.includes(keyword));
      child.stdin!.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
      child.stdin!.end();
      setTimeout(() => child.kill(), 500);
      if (missing.length) reject(new Error('instructions 缺少关键词：' + missing.join('、')));
      else {
        console.log('stdio 握手验收 PASS：第 29 条四缺口模块关键词全部在 instructions 中。');
        resolve();
      }
    }).catch(reject);
  });
}

main().then(() => process.exit(0), error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
