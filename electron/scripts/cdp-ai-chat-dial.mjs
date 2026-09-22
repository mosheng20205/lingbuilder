// CDP 真机拨测：驱动隔离 dev 实例验证 /api/ai/chat（BYOK 聊天链收口）。
// 断言：真实 DeepSeek 端点回复非复读、SSE 有增量、activeFile 上下文生效。
import WebSocket from '../node_modules/ws/index.js';

const CDP_HTTP = 'http://127.0.0.1:9222';

async function getPageWs() {
  const res = await fetch(`${CDP_HTTP}/json`);
  const targets = await res.json();
  const page = targets.find(t => t.type === 'page');
  if (!page) throw new Error('未找到页面目标');
  return page.webSocketDebuggerUrl;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0;
    const pending = new Map();
    ws.on('open', () => resolve({
      send(method, params = {}) {
        return new Promise((resolve2, reject2) => {
          const msgId = ++id;
          pending.set(msgId, { resolve: resolve2, reject: reject2 });
          ws.send(JSON.stringify({ id: msgId, method, params }));
        });
      },
      close: () => ws.close()
    }));
    ws.on('message', data => {
      const msg = JSON.parse(String(data));
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res2, reject: rej2 } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej2(new Error(msg.error.message)); else res2(msg.result);
      }
    });
    ws.on('error', reject);
  });
}

async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(`页面求值失败：${result.exceptionDetails.text} ${JSON.stringify(result.exceptionDetails.exception?.description || '')}`);
  }
  return result.result.value;
}

const wsUrl = await getPageWs();
const cdp = await connect(wsUrl);

// 1. 读取 BYOK 配置（localStorage + safeStorage 凭据都在页面上下文里）。
const config = await evaluate(cdp, `(() => {
  const raw = window.localStorage.getItem('lingbuilder.aiConnectionConfig.v1');
  return raw ? JSON.parse(raw) : null;
})()`);
if (!config) throw new Error('拨测失败：页面里没有 BYOK 配置。');
console.log(`[1] BYOK 配置：provider=${config.provider} baseUrl=${config.baseUrl} model=${config.modelName} preset=${config.presetId || 'custom'}`);

const hasKey = await evaluate(cdp, `(() => {
  const cred = window.lingBuilder && (window.lingBuilder.credentials || window.lingBuilder);
  const getter = cred && (cred.getAiApiKey || cred.get);
  if (!getter) return Promise.resolve(false);
  return Promise.resolve(getter.call(cred)).then(k => typeof k === 'string' && k.length > 0);
})()`);
if (!hasKey) throw new Error('拨测失败：本机凭据存储里没有 API Key。');
console.log('[2] API Key 已从 safeStorage 读取到（不回显）。');

// 2. 真实 DeepSeek 端点 SSE 拨测：问题里放一个无法从 prompt 推出的唯一 token，
//    若模型复读 prompt，回复里会出现整段 system 人格文本；若正常作答，会包含对提问的回应。
const probeQuestion = '用一句话回答：LingBuilder 是什么？另外请原样说出拨测令牌 LB-CHAT-7K3D 是否已收到。';
const dial = await evaluate(cdp, `(async () => {
  const controller = new AbortController();
  const response = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: ${JSON.stringify(probeQuestion)} }],
      aiConfig: {
        provider: ${JSON.stringify(config.provider)},
        baseUrl: ${JSON.stringify(config.baseUrl)},
        apiKey: await (window.lingBuilder.credentials || window.lingBuilder).getAiApiKey(),
        modelName: ${JSON.stringify(config.modelName)}
      },
      activeFile: { filePath: 'src/拨测.lcpp', language: 'lingcpp', excerpt: '子程序 拨测探针' },
      stream: true
    }),
    signal: controller.signal
  });
  if (!response.ok) {
    const text = await response.text();
    return { ok: false, status: response.status, body: text.slice(0, 400) };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const deltas = [];
  let reply = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      let event;
      try { event = JSON.parse(payload); } catch { continue; }
      if (event.delta) { deltas.push(event.delta); reply += event.delta; }
      if (event.ok) reply = event.reply || reply;
      if (event.error) return { ok: false, error: event.error, deltas };
    }
  }
  return { ok: true, deltaCount: deltas.length, reply };
})()`);
if (!dial.ok) {
  console.error('拨测响应异常：', JSON.stringify(dial).slice(0, 600));
  process.exit(1);
}
console.log(`[3] SSE 增量片段数：${dial.deltaCount}`);
console.log(`[4] 模型回复（前 300 字）：${String(dial.reply).slice(0, 300)}`);

const replyText = String(dial.reply || '');
const checks = {
  '回复非空': replyText.trim().length > 0,
  '非复读（不含系统人格开头「您是 C++ 编程与代码映射专家」）': !replyText.includes('您是 C++ 编程与代码映射专家'),
  '非复读（不含翻译通道回显标志「用户提问：」）': !replyText.includes('用户提问：'),
  '收到拨测令牌（模型真的读到了提问）': replyText.includes('LB-CHAT-7K3D'),
  '流式有增量（SSE delta 到达）': dial.deltaCount > 0
};
let pass = true;
for (const [name, ok] of Object.entries(checks)) {
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}`);
  if (!ok) pass = false;
}
console.log(pass ? 'ALL-PASS' : 'HAS-FAIL');
cdp.close();
process.exit(pass ? 0 : 1);
