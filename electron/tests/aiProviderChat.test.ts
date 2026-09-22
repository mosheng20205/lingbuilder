// /api/ai/chat（BYOK 聊天链路收口）与 aiProviderService 四协议组装回归。
// 2026-09-20 落地：聊天 prompt 曾借道 /api/translate 被原文回显（DeepSeek 复读 bug），
// 本文件钉住新链路的消息形状、规则手册注入与 SSE 流式行为。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SERVER_READY_PREFIX } from '../src/services/server/serverRuntime';

interface ReadyInfo { origin: string; host: string; port: number }

interface CapturedProviderRequest { path: string; body: any; authorization?: string }

async function startTestServer(options: { workspaceRoot: string; extraEnv?: NodeJS.ProcessEnv }): Promise<{ origin: string; stop: () => Promise<void> }> {
  const staticRoot = path.join(options.workspaceRoot, 'static');
  const rulebookPath = path.join(options.workspaceRoot, 'rulebook.md');
  await fs.mkdir(staticRoot, { recursive: true });
  await fs.writeFile(path.join(staticRoot, 'index.html'), '<!doctype html><title>LingBuilder Test</title>', 'utf8');
  await fs.writeFile(rulebookPath, '# test rulebook\nLingBuilder 规则手册测试内容。', 'utf8');
  const child = spawn(process.execPath, ['--import', 'tsx', path.resolve(process.cwd(), 'server.ts')], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '0',
      LINGBUILDER_WORKSPACE_ROOT: options.workspaceRoot,
      STATIC_ROOT: staticRoot,
      RULEBOOK_PATH: rulebookPath,
      LINGBUILDER_USER_SETTINGS_PATH: path.join(options.workspaceRoot, 'profile', 'settings.json'),
      SESSION_TOKEN: 'ai-provider-chat-test',
      // 测试进程内清除 BYOK 凭据，保证「缺少 API Key」错误分支可稳定复现。
      GEMINI_API_KEY: '',
      LINGBUILDER_AI_BRIDGE_ENABLED: 'false',
      ...(options.extraEnv || {})
    } as NodeJS.ProcessEnv,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr?.on('data', chunk => { stderr += String(chunk); });
  const ready = await new Promise<ReadyInfo>((resolve, reject) => {
    const offAll = () => {
      clearTimeout(timeout);
      child.stdout?.off('data', onData);
      child.off('exit', onExit);
    };
    const timeout = setTimeout(() => {
      offAll();
      reject(new Error(`等待服务就绪超时：\n${stderr}`));
    }, 30_000);
    const onData = (chunk: Buffer) => {
      for (const line of String(chunk).split(/\r?\n/u)) {
        if (!line.startsWith(SERVER_READY_PREFIX)) continue;
        try {
          const value = JSON.parse(line.slice(SERVER_READY_PREFIX.length)) as ReadyInfo;
          offAll();
          resolve(value);
          return;
        } catch { /* 忽略无法解析的行 */ }
      }
    };
    const onExit = (code: number | null) => {
      offAll();
      reject(new Error(`服务在就绪前退出（${code}）：\n${stderr}`));
    };
    child.stdout?.on('data', onData);
    child.once('exit', onExit);
  });
  return {
    origin: ready.origin,
    stop: async () => {
      child.kill();
      await new Promise(resolve => child.once('exit', resolve));
    }
  };
}

/** OpenAI 兼容 + Anthropic 形态的本地 mock provider；记录每个请求体供断言。 */
async function startMockProvider(): Promise<{
  origin: string;
  requests: CapturedProviderRequest[];
  close: () => Promise<void>;
}> {
  const requests: CapturedProviderRequest[] = [];
  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', chunk => { raw += String(chunk); });
    req.on('end', () => {
      let body: any = null;
      try { body = JSON.parse(raw || 'null'); } catch { body = null; }
      requests.push({ path: req.url || '', body, authorization: req.headers.authorization });
      if (req.url === '/chat/completions') {
        if (body?.model === 'lb-edit-draft-model') {
          // 编辑提案链回归：返回一份可直接通过提案校验的 LingCppEditDraft JSON。
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: JSON.stringify({
            summary: '回归测试草稿',
            explanation: 'mock provider 返回的固定编辑草稿。',
            files: [{ filePath: 'src/MainWindow.lcpp', updatedSource: '类 主窗口\n版本 1\n结束类\n' }]
          }) } }] }));
          return;
        }
        if (body?.stream) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          for (const delta of ['你好', '，', '世界']) {
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: delta } }] })}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: 'MOCK_REPLY' } }] }));
        return;
      }
      if (req.url === '/messages') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ content: [{ type: 'text', text: 'MOCK_ANTHROPIC' }] }));
        return;
      }
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end('{}');
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return {
    origin: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}

async function readSseEvents(response: Response): Promise<Array<{ delta?: string; reasoning?: string; ok?: boolean; reply?: string; error?: string }>> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: Array<{ delta?: string; reasoning?: string; ok?: boolean; reply?: string; error?: string }> = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data) events.push(JSON.parse(data));
    }
  }
  return events;
}

test('AI 聊天端点拒绝缺失消息、非法角色与未配置 Key', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-chat-'));
  const server = await startTestServer({ workspaceRoot });
  try {
    const headers = { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' };
    const missing = await fetch(`${server.origin}/api/ai/chat`, { method: 'POST', headers, body: JSON.stringify({}) });
    assert.equal(missing.status, 400);
    assert.match((await missing.json()).error, /聊天消息列表/u);
    const badRole = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: [{ role: 'system', content: '系统消息不能由调用方直接传入' }] })
    });
    assert.equal(badRole.status, 400);
    assert.match((await badRole.json()).error, /role/u);
    const noKey = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: [{ role: 'user', content: '你好' }], aiConfig: {} })
    });
    assert.equal(noKey.status, 400);
    assert.match((await noKey.json()).error, /API Key/u);
  } finally {
    await server.stop();
  }
});

test('DeepSeek 兼容端点的非流式聊天携带 system 规则手册与多轮消息', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-chat-ds-'));
  const mock = await startMockProvider();
  const server = await startTestServer({ workspaceRoot });
  try {
    const response = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '第一个问题' },
          { role: 'assistant', content: '上一个回答' },
          { role: 'user', content: '看着 IDE 写一个 DLL 示例' }
        ],
        aiConfig: { provider: 'deepseek', baseUrl: mock.origin, apiKey: 'test-key', modelName: 'test-model' }
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.reply, 'MOCK_REPLY');

    assert.equal(mock.requests.length, 1);
    const providerBody = mock.requests[0].body;
    assert.equal(mock.requests[0].path, '/chat/completions');
    assert.equal(providerBody.model, 'test-model');
    assert.equal(providerBody.max_tokens, 8192);
    assert.deepEqual(providerBody.thinking, { type: 'disabled' });
    assert.equal(providerBody.stream, undefined);
    assert.equal(providerBody.messages.length, 4);
    assert.equal(providerBody.messages[0].role, 'system');
    assert.match(providerBody.messages[0].content, /LingBuilder/u);
    assert.match(providerBody.messages[0].content, /# test rulebook/u);
    assert.deepEqual(providerBody.messages.slice(1), [
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '上一个回答' },
      { role: 'user', content: '看着 IDE 写一个 DLL 示例' }
    ]);
  } finally {
    await server.stop();
    await mock.close();
  }
});

test('AI 聊天端点的 SSE 流式回复逐段透出并以完整文本收尾', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-chat-stream-'));
  const mock = await startMockProvider();
  const server = await startTestServer({ workspaceRoot });
  try {
    const response = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: '你好' }],
        aiConfig: { provider: 'deepseek', baseUrl: mock.origin, apiKey: 'test-key', modelName: 'test-model' },
        stream: true
      })
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /text\/event-stream/u);
    const events = await readSseEvents(response);
    const deltas = events.filter(event => typeof event.delta === 'string').map(event => event.delta);
    assert.deepEqual(deltas, ['你好', '，', '世界']);
    const final = events[events.length - 1];
    assert.equal(final.ok, true);
    assert.equal(final.reply, '你好，世界');
    assert.equal(mock.requests[0].body.stream, true);
  } finally {
    await server.stop();
    await mock.close();
  }
});

test('Anthropic 协议把 system 外置、透传多轮消息并携带当前文件节选', { timeout: 60_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-chat-anthropic-'));
  const mock = await startMockProvider();
  const server = await startTestServer({ workspaceRoot });
  try {
    const response = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: '第一个问题' },
          { role: 'assistant', content: '上一个回答' },
          { role: 'user', content: '报错是啥原因' }
        ],
        activeFile: { filePath: 'src/lingbuilder-dll/DllApi.lcpp', language: 'lingcpp', excerpt: '子程序 获取接口版本，整数型' },
        aiConfig: { provider: 'anthropic', baseUrl: mock.origin, apiKey: 'test-key', modelName: 'test-model' }
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.reply, 'MOCK_ANTHROPIC');

    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].path, '/messages');
    const providerBody = mock.requests[0].body;
    assert.equal(providerBody.model, 'test-model');
    assert.match(providerBody.system, /LingBuilder/u);
    assert.match(providerBody.system, /# test rulebook/u);
    assert.match(providerBody.system, /src\/lingbuilder-dll\/DllApi\.lcpp/u);
    assert.match(providerBody.system, /子程序 获取接口版本/u);
    assert.deepEqual(providerBody.messages, [
      { role: 'user', content: '第一个问题' },
      { role: 'assistant', content: '上一个回答' },
      { role: 'user', content: '报错是啥原因' }
    ]);
  } finally {
    await server.stop();
    await mock.close();
  }
});

// ---- BYOK 配置生命周期回归（2026-09-22 编辑提案链 401 根治）----
// 根因形态：面板 BYOK 请求体 aiConfig 的 apiKey 为空（凭据异步回填竞态）时，
// resolveAiConnectionConfig 会回落到 server 启动时固化的 GEMINI_API_KEY 旧值，
// 上游收到「尾缀与用户当前 Key 一致却被判 401」的旧 Key。以下两条钉住：
// ①请求体 Key 优先级最高；②显式传入 aiConfig 对象时绝不混入环境变量。

test('编辑提案链优先消费请求体 aiConfig 的 Key，不用环境变量旧 Key 顶替', { timeout: 90_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-edit-priority-'));
  const mock = await startMockProvider();
  const server = await startTestServer({
    workspaceRoot,
    extraEnv: { GEMINI_API_KEY: 'stale-env-key-should-never-leak' }
  });
  try {
    const response = await fetch(`${server.origin}/api/lingcpp/edit/propose`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' },
      body: JSON.stringify({
        filePath: 'src/MainWindow.lcpp',
        sourceCode: '类 主窗口\n结束类\n',
        instruction: '给按钮1添加点击计数',
        aiConfig: { provider: 'deepseek', baseUrl: mock.origin, apiKey: 'byok-panel-key', modelName: 'lb-edit-draft-model' }
      })
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.proposal.changes.length, 1);
    assert.equal(payload.proposal.changes[0].filePath, 'src/MainWindow.lcpp');

    assert.equal(mock.requests.length, 1);
    assert.equal(mock.requests[0].path, '/chat/completions');
    assert.equal(mock.requests[0].authorization, 'Bearer byok-panel-key');
    assert.deepEqual(mock.requests[0].body.thinking, { type: 'disabled' });
  } finally {
    await server.stop();
    await mock.close();
  }
});

test('显式 BYOK 配置缺 Key 时不回落环境变量：提案本地降级且不打上游，聊天直接报缺 Key', { timeout: 90_000 }, async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'lingbuilder-ai-edit-noenv-'));
  const mock = await startMockProvider();
  const server = await startTestServer({
    workspaceRoot,
    extraEnv: { GEMINI_API_KEY: 'stale-env-key-should-never-leak' }
  });
  try {
    const headers = { 'content-type': 'application/json', 'x-lingbuilder-session': 'ai-provider-chat-test' };
    const propose = await fetch(`${server.origin}/api/lingcpp/edit/propose`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filePath: 'src/MainWindow.lcpp',
        sourceCode: '类 主窗口\n结束类\n',
        instruction: '给按钮1添加点击计数',
        aiConfig: { provider: 'deepseek', baseUrl: mock.origin, apiKey: '', modelName: 'lb-edit-draft-model' }
      })
    });
    assert.equal(propose.status, 200);
    const payload = await propose.json();
    assert.equal(payload.ok, true);
    // 缺 Key 走既有「本地安全提案」降级，而不是带着环境变量旧 Key 打上游被 401。
    assert.match(payload.proposal.explanation || '', /未检测到 AI API Key/u);

    const chat = await fetch(`${server.origin}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: [{ role: 'user', content: '你好' }],
        aiConfig: { provider: 'deepseek', baseUrl: mock.origin, apiKey: '', modelName: 'test-model' }
      })
    });
    assert.equal(chat.status, 400);
    assert.match((await chat.json()).error, /API Key/u);

    // 关键断言：mock provider 全程零请求——环境变量里的旧 Key 绝不能顶替空 Key 出网。
    assert.equal(mock.requests.length, 0);
  } finally {
    await server.stop();
    await mock.close();
  }
});
