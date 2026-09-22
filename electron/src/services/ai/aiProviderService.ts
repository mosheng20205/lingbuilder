// LingBuilder AI 模型调用唯一适配层（2026-09-20 聊天链收口落地）。
// 四协议（gemini / openai-compatible / deepseek / anthropic）的请求组装、
// 响应解析、流式增量解析只允许存在于本文件；server.ts 的汉化、连接测试、
// 模型列表、编辑 planner、模块 AI 生成与 /api/ai/chat 全部经此调用，
// 禁止在任何路由或组件里另写 provider 分支。
import { GoogleGenAI } from "@google/genai";
import type { AiConnectionConfig } from "../lingCpp/types";

export type AiChatRole = "system" | "user" | "assistant";

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiChatStreamCallbacks {
  /** 正文增量；与最终返回的完整文本一致。 */
  onDelta?: (text: string) => void;
  /** 推理型模型的思考增量（如 reasoning_content / thinking_delta）；与正文分离。 */
  onReasoning?: (text: string) => void;
}

export interface AiChatOptions {
  config: Required<AiConnectionConfig>;
  /** 追加在消息数组之前的系统提示；与 messages 内 system 角色合并。 */
  systemPrompt?: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** 提供即走流式请求，增量经回调透出。 */
  stream?: AiChatStreamCallbacks;
}

// 连接测试的硬上限：挂起不响应的中转端点不能让「正在连接 AI...」无限转圈。
const AI_CONNECT_TIMEOUT_MS = 10_000;

// 聊天默认输出上限：翻译/草稿类沿用各调用方原值，聊天明显更长。
export const AI_CHAT_DEFAULT_MAX_TOKENS = 8192;
export const AI_CHAT_DEFAULT_TEMPERATURE = 0.6;

// BYOK 配置生命周期口径（2026-09-22 编辑提案链 401 根治）：
// 调用方显式传入 aiConfig 对象（面板 propose/chat/translate/connect/models、模块 AI 生成、
// 编辑 planner）时，配置只取请求体——缺 apiKey 就是缺，绝不能回落到 GEMINI_* 环境变量。
// 环境变量是 server 进程启动时固化的快照（历史上是给无配置的系统脚本用的），
// 把它混进逐请求的 BYOK 配置会让「面板里换过的 Key」被「启动时的旧 Key」顶替，
// 表现为上游 401 且 Key 尾缀与用户当前 Key 一致的假象。环境变量兜底仅保留给
// 未传配置对象（config === undefined）的系统路径（如一键智能汉化不带 aiConfig）。
export function resolveAiConnectionConfig(config?: AiConnectionConfig): Required<AiConnectionConfig> {
  const isExplicitByokConfig = config !== undefined && config !== null;
  return {
    baseUrl: (config?.baseUrl || (isExplicitByokConfig ? "" : process.env.GEMINI_BASE_URL) || "").trim(),
    apiKey: (config?.apiKey || (isExplicitByokConfig ? "" : process.env.GEMINI_API_KEY) || "").trim(),
    modelName: (config?.modelName || (isExplicitByokConfig ? "" : process.env.GEMINI_MODEL_NAME) || "gemini-2.5-flash").trim(),
    provider: config?.provider || "gemini"
  };
}

export function withAiConnectTimeout<T>(task: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`连接测试超时：${AI_CONNECT_TIMEOUT_MS / 1000} 秒内未收到响应，请检查 Base URL 是否可达`)),
      AI_CONNECT_TIMEOUT_MS
    );
    task.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        // fetch 的 AbortSignal.timeout 与本计时器同刻触发且常先注册完成，这里把超时类错误统一规范成中文诊断。
        if (error instanceof Error && (error.name === "TimeoutError" || /aborted due to timeout/iu.test(error.message))) {
          reject(new Error(`连接测试超时：${AI_CONNECT_TIMEOUT_MS / 1000} 秒内未收到响应，请检查 Base URL 是否可达`));
          return;
        }
        reject(error);
      }
    );
  });
}

function joinBaseUrl(baseUrl: string, pathName: string): string {
  return `${baseUrl.replace(/\/+$/u, "")}/${pathName.replace(/^\/+/u, "")}`;
}

function splitSystemMessages(systemPrompt: string | undefined, messages: AiChatMessage[]): { systemText: string; chatMessages: AiChatMessage[] } {
  const parts: string[] = [];
  if (systemPrompt?.trim()) parts.push(systemPrompt.trim());
  const chatMessages: AiChatMessage[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      if (message.content.trim()) parts.push(message.content.trim());
      continue;
    }
    chatMessages.push(message);
  }
  return { systemText: parts.join("\n\n"), chatMessages };
}

/** 把 SSE 响应体按 `data:` 事件逐条解析；空行与注释行自动跳过。 */
async function readSseDataEvents(response: Response, onEvent: (data: string) => void): Promise<void> {
  if (!response.body) throw new Error("上游模型响应缺少正文流。");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/u, "");
      buffer = buffer.slice(newlineIndex + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) onEvent(data);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }
}

interface OpenAiStreamChunk {
  choices?: Array<{
    delta?: { content?: string | null; reasoning_content?: string | null };
  }>;
  error?: { message?: string };
}

interface AnthropicStreamEvent {
  type?: string;
  delta?: { type?: string; text?: string; thinking?: string };
  error?: { message?: string };
}

function getGeminiClient(config: Required<AiConnectionConfig>): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: config.apiKey,
    httpOptions: {
      ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function requestAnthropicChat(options: AiChatOptions): Promise<string> {
  const { config, systemPrompt, messages, temperature, maxTokens, signal, stream } = options;
  const { systemText, chatMessages } = splitSystemMessages(systemPrompt, messages);
  const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/messages"), {
    method: "POST",
    signal,
    headers: {
      "content-type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: config.modelName,
      ...(systemText ? { system: systemText } : {}),
      max_tokens: maxTokens,
      temperature,
      messages: chatMessages.map(message => ({ role: message.role, content: message.content })),
      ...(stream ? { stream: true } : {})
    })
  });
  if (!response.ok) throw new Error(await response.text());
  if (!stream) {
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return data.content?.map(item => item.text || "").join("") || "";
  }
  let reply = "";
  await readSseDataEvents(response, data => {
    let event: AnthropicStreamEvent;
    try {
      event = JSON.parse(data) as AnthropicStreamEvent;
    } catch {
      return;
    }
    if (event.type === "content_block_delta") {
      if (event.delta?.type === "thinking_delta" && event.delta.thinking) {
        stream?.onReasoning?.(event.delta.thinking);
        return;
      }
      if (event.delta?.text) {
        reply += event.delta.text;
        stream?.onDelta?.(event.delta.text);
      }
      return;
    }
    if (event.type === "error") throw new Error(event.error?.message || "Anthropic 流式响应返回错误。");
  });
  return reply;
}

async function requestOpenAiCompatibleChat(options: AiChatOptions): Promise<string> {
  const { config, systemPrompt, messages, temperature, maxTokens, signal, stream } = options;
  const defaultBaseUrl = config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
  const { systemText, chatMessages } = splitSystemMessages(systemPrompt, messages);
  const requestMessages: AiChatMessage[] = systemText
    ? [{ role: "system", content: systemText }, ...chatMessages]
    : chatMessages;
  const response = await fetch(joinBaseUrl(config.baseUrl || defaultBaseUrl, "/chat/completions"), {
    method: "POST",
    signal,
    headers: {
      "authorization": `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: config.modelName,
      messages: requestMessages,
      max_tokens: maxTokens,
      temperature,
      ...(config.provider === "deepseek" ? { thinking: { type: "disabled" } } : {}),
      ...(stream ? { stream: true } : {})
    })
  });
  if (!response.ok) throw new Error(await response.text());
  if (!stream) {
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }
  let reply = "";
  await readSseDataEvents(response, data => {
    if (data === "[DONE]") return;
    let chunk: OpenAiStreamChunk;
    try {
      chunk = JSON.parse(data) as OpenAiStreamChunk;
    } catch {
      return;
    }
    if (chunk.error) throw new Error(chunk.error.message || "模型流式响应返回错误。");
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (delta.reasoning_content) stream?.onReasoning?.(delta.reasoning_content);
    if (delta.content) {
      reply += delta.content;
      stream?.onDelta?.(delta.content);
    }
  });
  return reply;
}

async function requestGeminiChat(options: AiChatOptions): Promise<string> {
  const { config, systemPrompt, messages, temperature, maxTokens, signal, stream } = options;
  const { systemText, chatMessages } = splitSystemMessages(systemPrompt, messages);
  const ai = getGeminiClient(config);
  const contents = chatMessages.map(message => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));
  const requestConfig = {
    ...(systemText ? { systemInstruction: systemText } : {}),
    temperature,
    maxOutputTokens: maxTokens,
    ...(options.signal ? { abortSignal: options.signal } : {})
  };
  if (!stream) {
    const response = await ai.models.generateContent({
      model: config.modelName,
      contents,
      config: requestConfig
    });
    return response.text || "";
  }
  const result = await ai.models.generateContentStream({
    model: config.modelName,
    contents,
    config: requestConfig
  });
  let reply = "";
  for await (const chunk of result) {
    const text = chunk.text;
    if (!text) continue;
    reply += text;
    stream?.onDelta?.(text);
  }
  return reply;
}

/**
 * 多轮聊天补全：与 generateAiText 的单轮「system + prompt」不同，本函数消费
 * 完整消息数组（user/assistant 交替），供 /api/ai/chat 使用。
 */
export async function generateAiChat(options: AiChatOptions): Promise<string> {
  const maxTokens = options.maxTokens ?? AI_CHAT_DEFAULT_MAX_TOKENS;
  const temperature = options.temperature ?? AI_CHAT_DEFAULT_TEMPERATURE;
  const normalized: AiChatOptions = { ...options, maxTokens, temperature };
  if (normalized.config.provider === "anthropic") return requestAnthropicChat(normalized);
  if (normalized.config.provider === "deepseek" || normalized.config.provider === "openai") {
    return requestOpenAiCompatibleChat(normalized);
  }
  return requestGeminiChat(normalized);
}

export async function generateAiText(options: {
  config: Required<AiConnectionConfig>;
  systemPrompt: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  geminiResponseSchema?: any;
  geminiResponseMimeType?: string;
}): Promise<string> {
  const { config, systemPrompt, prompt, temperature = 0.2, maxTokens = 4096 } = options;

  if (config.provider === "anthropic") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/messages"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.modelName,
        system: systemPrompt,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: prompt }]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { content?: Array<{ type?: string; text?: string }> };
    return data.content?.map(item => item.text || "").join("") || "";
  }

  if (config.provider === "deepseek" || config.provider === "openai") {
    const defaultBaseUrl = config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
    const response = await fetch(joinBaseUrl(config.baseUrl || defaultBaseUrl, "/chat/completions"), {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: maxTokens,
        temperature,
        ...(config.provider === "deepseek" ? { thinking: { type: "disabled" } } : {})
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  const ai = getGeminiClient(config);
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: prompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      ...(options.geminiResponseMimeType ? { responseMimeType: options.geminiResponseMimeType } : {}),
      ...(options.geminiResponseSchema ? { responseSchema: options.geminiResponseSchema } : {})
    }
  });
  return response.text || "";
}

export async function testAiConnection(config: Required<AiConnectionConfig>): Promise<string> {
  if (config.provider === "anthropic") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/messages"), {
      method: "POST",
      signal: AbortSignal.timeout(AI_CONNECT_TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: config.modelName,
        max_tokens: 8,
        messages: [{ role: "user", content: "ping" }]
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { content?: Array<{ text?: string }> };
    return data.content?.map(item => item.text || "").join("") || "";
  }

  if (config.provider === "deepseek") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.deepseek.com", "/chat/completions"), {
      method: "POST",
      signal: AbortSignal.timeout(AI_CONNECT_TIMEOUT_MS),
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 16,
        temperature: 0,
        thinking: { type: "disabled" }
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  if (config.provider === "openai") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.openai.com/v1", "/chat/completions"), {
      method: "POST",
      signal: AbortSignal.timeout(AI_CONNECT_TIMEOUT_MS),
      headers: {
        "authorization": `Bearer ${config.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: config.modelName,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 8,
        temperature: 0
      })
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content || "";
  }

  const ai = getGeminiClient(config);
  const response = await ai.models.generateContent({
    model: config.modelName,
    contents: "ping",
    config: {
      temperature: 0,
      maxOutputTokens: 8
    }
  });
  return response.text || "";
}

// 「获取模型列表」的单次返回上限：防超大 provider 列表撑爆侧栏面板。
export const AI_MODELS_LIST_MAX = 200;

export async function listAiModels(config: Required<AiConnectionConfig>): Promise<string[]> {
  if (config.provider === "anthropic") {
    const response = await fetch(joinBaseUrl(config.baseUrl || "https://api.anthropic.com/v1", "/models"), {
      method: "GET",
      signal: AbortSignal.timeout(AI_CONNECT_TIMEOUT_MS),
      headers: {
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01"
      }
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { data?: Array<{ id?: string }> };
    return (data.data || []).map(item => item.id || "").filter(Boolean);
  }

  if (config.provider === "deepseek" || config.provider === "openai") {
    const defaultBaseUrl = config.provider === "deepseek" ? "https://api.deepseek.com" : "https://api.openai.com/v1";
    const response = await fetch(joinBaseUrl(config.baseUrl || defaultBaseUrl, "/models"), {
      method: "GET",
      signal: AbortSignal.timeout(AI_CONNECT_TIMEOUT_MS),
      headers: {
        "authorization": `Bearer ${config.apiKey}`
      }
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json() as { data?: Array<{ id?: string }> };
    return (data.data || []).map(item => item.id || "").filter(Boolean);
  }

  const ai = getGeminiClient(config);
  const pager = await ai.models.list();
  const models: string[] = [];
  for await (const model of pager) {
    // 仅保留支持 generateContent 的模型；字段缺失的 provider 形态（自建兼容端点）全部保留。
    if (model.supportedActions && !model.supportedActions.includes("generateContent")) continue;
    const name = (model.name || "").replace(/^models\//u, "");
    if (name) models.push(name);
    if (models.length >= AI_MODELS_LIST_MAX) break;
  }
  return models;
}
