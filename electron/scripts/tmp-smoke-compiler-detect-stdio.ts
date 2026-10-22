import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

/**
 * 编译器探测重构真机 stdio 验收（2026-10-21）：
 * dist/cli.cjs 必须携带新的编译器探测诊断文案（构建失败时进 build.run logs），
 * 握手正常、instructions 与工具数（25）不回归。
 */
async function main() {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lb-compiler-detect-stdio-'));
  const bundlePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs');
  const bundle = await fs.readFile(bundlePath, 'utf8');

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  // esbuild 默认 charset=ascii：bundle 里非 ASCII 以 \u + 大写十六进制转义存在。
  const escapeForBundle = (probe: string) => probe
    .split('')
    .map(char => char.charCodeAt(0) > 126 ? `\\u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}` : char)
    .join('');
  const bundleHas = (probe: string) => bundle.includes(probe) || bundle.includes(escapeForBundle(probe));

  check('bundle 携带编译器探测明细标记', bundleHas('【编译器探测明细】'));
  check('bundle 携带暂时性失败与反馈指引', bundleHas('请再点一次「编译」重试') && bundleHas('发给开发组'));
  check('bundle 携带 VS2026 目录名 18 回退', bundle.includes("'18', '2022', '2019'") || bundle.includes('"18", "2022", "2019"'));
  check('bundle 携带杀软拦截中文解释', bundleHas('常见于杀毒软件拦截 cmd.exe'));

  const child = spawn(process.execPath, [
    bundlePath,
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

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'compiler-detect-smoke', version: '1.0' } } });
    const initialized = await waitFor(message => message.id === 1);
    const serverInfo = (initialized.result as { serverInfo?: { name?: string } })?.serverInfo;
    check('stdio initialize 握手成功', Boolean(serverInfo?.name), serverInfo?.name || '');

    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const tools = await waitFor(message => message.id === 2);
    const toolList = (tools.result as { tools?: Array<{ name?: string }> })?.tools || [];
    check('工具数保持 25', toolList.length === 25, `实际 ${toolList.length}`);
    check('build.run 工具在列', toolList.some(tool => tool.name === 'lingbuilder.build.run'));

    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'lingbuilder.workspace.list', arguments: {} } });
    const tree = await waitFor(message => message.id === 3);
    const treeText = ((tree.result as { content?: Array<{ type?: string; text?: string }> })?.content || [])
      .map(item => item.text || '').join('\n');
    check('workspace.list 可用且返回工作区根', treeText.includes('workspaceRoot'));
  } finally {
    child.kill();
    await fs.rm(workspaceRoot, { recursive: true, force: true }).catch(() => undefined);
  }

  if (failures.length) {
    console.error(`\n${failures.length} 项失败`);
    process.exit(1);
  }
  console.log('\n全部通过');
}

await main();
