import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

/**
 * 真机 stdio 验收（2026-10-18）：收费模块「登录即可用」三级恢复。
 * stub 本机授权代理 + 宿主启动早于授权（bootstrap=failed）三场景：
 * A 按需换发被 IDE 权威拒绝（未登录）→「自动授权未成功：请先注册并登录…」；
 * B 换发后最新状态仍无凭据 →「请先登录并购买」（fail-closed）；
 * C 代理不可达 →「宿主启动时未取得授权…保持 LingBuilder 运行并登录账号」。
 */
async function main() {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lb-authorize-stdio-'));
  const discoveryPath = path.join(workspaceRoot, 'ai-bridge-local-auth.json');
  const token = 'a'.repeat(43);
  // 播种一个同 ID 最小工作区模块：new_emoji.ui 是内置收费模块但空工作区未安装，
  // project.create 的启用计划要求「已安装」才走到权益门禁；这里只借它触发门禁，不参与构建。
  const moduleDir = path.join(workspaceRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui');
  fs.mkdirSync(moduleDir, { recursive: true });
  fs.writeFileSync(path.join(moduleDir, 'lingbuilder.module.json'), JSON.stringify({
    schemaVersion: 2,
    id: 'lingbuilder.new_emoji.ui',
    name: 'new_emoji 界面模块（验收桩）',
    version: '1.0.0',
    category: '界面',
    description: 'stdio 验收专用：仅用于让启用计划通过已安装检查，触发收费模块权益门禁。'
  }, null, 2), 'utf8');

  let mode: 'unauthorized' | 'empty' = 'unauthorized';
  const proxy = http.createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += String(chunk); });
    request.on('end', () => {
      const finish = (status: number, payload: Record<string, unknown>) => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(payload));
      };
      if (request.method !== 'POST' || request.url !== '/local-authority/exchange') return finish(404, { ok: false });
      if (String(request.headers.authorization || '') !== `Bearer ${token}`) return finish(401, { ok: false });
      const requested = JSON.parse(body || '{}') as { authorizeModuleIds?: string[] };
      const authorizeErrors = mode === 'unauthorized'
        ? (requested.authorizeModuleIds || []).map(moduleId => ({ moduleId, message: '请先注册并登录 LingBuilder 账号，再启用收费模块。' }))
        : [];
      finish(200, {
        ok: true,
        moduleAccessState: Buffer.from('[]', 'utf8').toString('base64url'),
        fbroVipKey: '',
        ...(authorizeErrors.length > 0 ? { authorizeErrors } : {})
      });
    });
  });
  await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
  const port = (proxy.address() as { port: number }).port;
  const writeDiscovery = () => fs.writeFileSync(discoveryPath, JSON.stringify({ version: 1, port, token, pid: process.pid, startedAt: new Date().toISOString() }), 'utf8');
  const removeDiscovery = () => fs.rmSync(discoveryPath, { force: true });

  const child = spawn(process.execPath, [
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'cli.cjs'),
    'ai-server', '--mcp', '--stdio-only', '--permission', 'yolo', '--workspace', workspaceRoot, '--port', '0'
  ], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, LINGBUILDER_LOCAL_AUTH_FILE: discoveryPath } });

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
  const stderrTail: string[] = [];
  child.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString('utf8');
    stderrTail.push(text);
    if (stderrTail.length > 40) stderrTail.shift();
  });

  const send = (message: Record<string, unknown>) => { child.stdin.write(`${JSON.stringify(message)}\n`); };
  const waitFor = async (predicate: (message: Record<string, unknown>) => boolean, timeoutMs = 30_000): Promise<Record<string, unknown>> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const hit = messages.find(predicate);
      if (hit) return hit;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`等待 MCP 响应超时\n${stderrTail.join('')}`);
  };

  const failures: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? `：${detail}` : ''}`);
    if (!ok) failures.push(name);
  };

  const createCall = (id: number) => send({
    jsonrpc: '2.0', id, method: 'tools/call',
    params: { name: 'lingbuilder.project.create', arguments: { templateId: 'blank-window', name: 'auth-smoke', enabledModuleIds: ['lingbuilder.new_emoji.ui'] } }
  });
  const errorTextOf = (message: Record<string, unknown>): string => {
    const result = message.result as { isError?: boolean; content?: Array<{ type?: string; text?: string }> } | undefined;
    return (result?.content || []).map(item => item.text || '').join('\n');
  };

  try {
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'accept', version: '0' } } });
    const init = await waitFor(message => message.id === 1);
    const instructions = String((init.result as { instructions?: string }).instructions || '');
    check('instructions 携带登录后按需换发口径', instructions.includes('按需换发') && instructions.includes('登录了账号'));
    check('instructions 保留代理不可达环境指引', instructions.includes('本机授权代理不可达'));
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

    // 场景 A：宿主启动早于授权（启动时无发现文件），授权代理上线后按需换发被权威拒绝（未登录）。
    writeDiscovery();
    createCall(2);
    const unauthorized = await waitFor(message => message.id === 2);
    const unauthorizedText = errorTextOf(unauthorized);
    check('A 按需换发未登录→自动授权未成功透出登录指引', unauthorizedText.includes('自动授权未成功') && unauthorizedText.includes('请先注册并登录'), unauthorizedText.slice(0, 120));
    check('A 未登录报错不得指向重启客户端', !unauthorizedText.includes('重启 AI 客户端'), unauthorizedText.slice(0, 120));

    // 场景 B：换发成功但最新状态里仍无凭据 → 维持「请先登录并购买」（fail-closed）；等冷却结束。
    await new Promise(resolve => setTimeout(resolve, 3_500));
    mode = 'empty';
    createCall(3);
    const empty = await waitFor(message => message.id === 3);
    const emptyText = errorTextOf(empty);
    check('B 换发后仍无凭据→按未购买拒绝', emptyText.includes('购买该模块') && emptyText.includes('请先登录'), emptyText.slice(0, 120));
    check('B 不得伪装成时序问题', !emptyText.includes('宿主启动时未取得授权'), emptyText.slice(0, 120));

    // 场景 C：代理下线（bootstrap=failed）→ 环境指引，不得报未购买。
    await new Promise(resolve => setTimeout(resolve, 3_500));
    removeDiscovery();
    createCall(4);
    const unreachable = await waitFor(message => message.id === 4);
    const unreachableText = errorTextOf(unreachable);
    check('C 代理不可达→宿主启动时未取得授权', unreachableText.includes('宿主启动时未取得授权'), unreachableText.slice(0, 160));
    check('C 指向保持 LingBuilder 运行并登录', unreachableText.includes('保持 LingBuilder 运行并登录账号'), unreachableText.slice(0, 160));
    check('C 不得误报未购买', !unreachableText.includes('请先登录并购买'), unreachableText.slice(0, 160));
  } finally {
    child.kill();
    proxy.close();
    fs.rmSync(workspaceRoot, { recursive: true, force: true });
  }

  if (failures.length > 0) {
    console.error(`验收失败 ${failures.length} 项：${failures.join('；')}`);
    process.exitCode = 1;
    return;
  }
  console.log('收费模块按需换发 stdio 验收：全部 PASS');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
