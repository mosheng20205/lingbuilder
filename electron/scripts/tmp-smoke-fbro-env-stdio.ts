// 一次性 stdio 冒烟：FBro 进程默认语言/区域 env 覆盖口径进入 MCP_INSTRUCTIONS 第 22 条⑩。
// 用法：node --import tsx scripts/tmp-smoke-fbro-env-stdio.ts
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createInterface } from 'node:readline';

const cliEntry = path.resolve(import.meta.dirname ?? '.', '..', 'dist', 'cli.cjs');
const workspaceRoot = path.resolve(import.meta.dirname ?? '.', '..', '..');

function main() {
  const child = spawn(process.execPath, [cliEntry, 'ai-server', '--workspace', workspaceRoot, '--mcp', '--stdio-only'], {
    cwd: path.dirname(cliEntry),
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const rl = createInterface({ input: child.stdout });
  let buffer = '';
  const done = (ok: boolean, reason: string) => {
    child.kill();
    if (!ok) {
      console.error(`FAIL: ${reason}${buffer.slice(0, 600)}`);
      process.exit(1);
    }
    console.log('PASS: stdio 握手成功，MCP_INSTRUCTIONS 第22条⑩ env 关键词齐全');
    process.exit(0);
  };
  rl.on('line', line => {
    buffer += line;
    if (buffer.includes('LINGBUILDER_FBRO_ACCEPT_LANGUAGE') && buffer.includes('LINGBUILDER_FBRO_LOCALE')
      && buffer.includes('进程默认语言/区域覆盖') && buffer.includes('"result"')) {
      done(true, '');
    }
  });
  child.stderr.on('data', chunk => { buffer += String(chunk); });
  child.on('exit', code => done(false, `cli 提前退出 code=${code}；`));
  const initialize = {
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'fbro-env-smoke', version: '0.0.1' },
    },
  };
  child.stdin.write(`${JSON.stringify(initialize)}\n`);
  setTimeout(() => done(false, '超时未收到含关键词的 initialize 结果；'), 30000);
}

main();
