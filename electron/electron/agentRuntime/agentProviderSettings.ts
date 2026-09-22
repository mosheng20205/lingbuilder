import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * 面板「本机 Agent」的模型来源配置。
 *
 * 为什么要在 IDE 里配：dsh 自身只认 `~/.dsh` 的 provider 行与环境变量，对新手没有可发现的入口；
 * 而 SDK 线协议的 `initialize` 只能传 provider/model，传不了 baseUrl 与密钥（实测 dsh-sdk-protocol
 * 的字段集合）。所以密钥与端点必须由 IDE 在启动 dsh 子进程时注入：端点写进 profile overlay 的
 * provider 行，密钥只进子进程环境变量，绝不写进 overlay 文件（它会落在 userData 里）。
 */
export type AgentProviderKind = 'deepseek-official' | 'custom-openai';

export interface AgentProviderSettings {
  kind: AgentProviderKind;
  /** API Key；官方通道留空表示沿用本机 dsh 已有凭据。 */
  apiKey: string;
  /** 自定义 OpenAI 兼容网关的 Base URL（官方通道可留空走默认端点）。 */
  baseUrl: string;
  /** 模型名；留空用通道默认模型。 */
  model: string;
  /** 官方通道的协议：messages（Anthropic 风格，默认）或 chat-completions。 */
  protocol?: 'messages' | 'chat-completions';
}

export interface AgentProviderSafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

interface StoredAgentProviderSettings {
  version: 1;
  kind: AgentProviderKind;
  baseUrl: string;
  model: string;
  protocol?: 'messages' | 'chat-completions';
  apiKey?: { encoding: 'safeStorage' | 'plain'; value: string };
  /** 用户给了密钥但本机无法加密时的标记：不落明文，也不能让提示随重启消失。 */
  apiKeyUnavailable?: boolean;
}

/** 官方通道：dsh 的 `llm-deepseek` 行默认读这个变量名。 */
export const DEEPSEEK_API_KEY_ENV = 'DEEPSEEK_API_KEY';
/** 自定义网关：我们自己命名的环境变量，避免污染用户其它 OpenAI 客户端配置。 */
export const CUSTOM_GATEWAY_API_KEY_ENV = 'LINGBUILDER_AGENT_API_KEY';
/** 自定义网关在 dsh 里的 provider 行名与路由名（initialize 的 provider 取值）。 */
export const CUSTOM_GATEWAY_PROVIDER = 'lingbuilder-custom';
export const DEEPSEEK_OFFICIAL_PROVIDER = 'deepseek-official';
const DEFAULT_OFFICIAL_MODEL = 'deepseek-v4-flash';
const CUSTOM_MODEL_ID = 'custom-model';

const KINDS: readonly AgentProviderKind[] = ['deepseek-official', 'custom-openai'];
const PROTOCOLS: readonly NonNullable<AgentProviderSettings['protocol']>[] = ['messages', 'chat-completions'];

export function defaultAgentProviderSettings(): AgentProviderSettings {
  return { kind: 'deepseek-official', apiKey: '', baseUrl: '', model: '', protocol: 'messages' };
}

export function resolveAgentProviderSettingsPath(userDataDir: string): string {
  return path.join(userDataDir, 'credentials', 'agent-provider-settings.json');
}

/**
 * 校验并归一化。返回 problem 时调用方必须展示中文修法，不得静默采用半成品配置：
 * Base URL 只允许 http/https（dsh 侧还会拒绝非回环明文之外的奇怪值），密钥必须是可见 ASCII。
 */
export function normalizeAgentProviderSettings(input: unknown): { settings?: AgentProviderSettings; problem?: string } {
  if (!input || typeof input !== 'object') return { problem: '模型配置格式无效，请重新填写。' };
  const value = input as Record<string, unknown>;
  const kind = String(value.kind || '') as AgentProviderKind;
  if (!KINDS.includes(kind)) return { problem: '未知的模型通道，请选择「DeepSeek 官方」或「自定义 API」。' };
  const apiKey = String(value.apiKey || '').trim();
  const baseUrl = String(value.baseUrl || '').trim();
  const model = String(value.model || '').trim();
  const protocol = value.protocol === undefined ? undefined : String(value.protocol) as NonNullable<AgentProviderSettings['protocol']>;
  if (apiKey && (apiKey.length < 8 || apiKey.length > 256 || /[^\x21-\x7e]/u.test(apiKey))) {
    return { problem: 'API Key 必须是 8-256 个可见 ASCII 字符，不能包含空格或中文。' };
  }
  if (protocol !== undefined && !PROTOCOLS.includes(protocol)) {
    return { problem: '接口协议只能是 messages 或 chat-completions。' };
  }
  if (baseUrl) {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      return { problem: `Base URL 不是合法地址：${baseUrl}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { problem: 'Base URL 只支持 http/https 协议。' };
    }
  }
  if (kind === 'custom-openai' && !baseUrl) return { problem: '自定义 API 通道必须填写 Base URL。' };
  if (model && (model.length > 120 || /[^\x21-\x7e]/u.test(model))) {
    return { problem: '模型名必须是 120 个字符以内的可见 ASCII。' };
  }
  return { settings: { kind, apiKey, baseUrl, model, protocol: protocol || 'messages' } };
}

/** dsh `initialize` 用的 provider 名。 */
export function agentProviderRuntimeName(settings: AgentProviderSettings | undefined): string {
  return settings?.kind === 'custom-openai' ? CUSTOM_GATEWAY_PROVIDER : DEEPSEEK_OFFICIAL_PROVIDER;
}

export function agentProviderRuntimeModel(settings: AgentProviderSettings | undefined): string {
  const model = String(settings?.model || '').trim();
  if (model) return model;
  return settings?.kind === 'custom-openai' ? CUSTOM_MODEL_ID : DEFAULT_OFFICIAL_MODEL;
}

/**
 * 只进子进程环境的密钥注入。绝不写进 profile overlay：overlay 文件落在 userData，
 * 明文密钥会长期留在磁盘上（AGENTS 对 Bridge Token 同口径）。
 */
export function agentProviderEnvironment(settings: AgentProviderSettings | undefined): Record<string, string> {
  const apiKey = String(settings?.apiKey || '').trim();
  if (!apiKey) return {};
  return settings?.kind === 'custom-openai'
    ? { [CUSTOM_GATEWAY_API_KEY_ENV]: apiKey }
    : { [DEEPSEEK_API_KEY_ENV]: apiKey };
}

function yamlSingleQuote(value: string): string {
  return `'${String(value).replace(/'/gu, "''")}'`;
}

/**
 * 生成 dsh provider 行。注意 profile patch 对某一行是**整体替换 config，不做字段合并**
 * （实测 dsh-base 的 patch 语义），所以这里必须把该行所有键重述完整，缺一个就会退回默认值。
 */
export function buildAgentProviderPatchLines(settings: AgentProviderSettings | undefined): string[] {
  if (!settings || settings.kind === 'deepseek-official') {
    if (!settings || (!settings.baseUrl && !settings.model)) return [];
    const lines = ['- id: llm-deepseek', '  config:', `    apiKeyEnv: ${DEEPSEEK_API_KEY_ENV}`];
    if (settings.protocol === 'chat-completions') lines.push('    protocol: chat-completions');
    if (settings.baseUrl) lines.push(`    baseURL: ${yamlSingleQuote(settings.baseUrl)}`);
    if (settings.model) {
      lines.push('    models:', `      - id: ${yamlSingleQuote(settings.model)}`, '        name: custom-model');
    }
    return lines;
  }
  const lines = [
    '- id: llm-pi-ai',
    '  config:',
    '    providers:',
    `      ${CUSTOM_GATEWAY_PROVIDER}:`,
    '        displayName: LingBuilder 自定义网关',
    `        apiKeyEnv: ${CUSTOM_GATEWAY_API_KEY_ENV}`,
    '        api: openai-completions',
    `        baseURL: ${yamlSingleQuote(settings.baseUrl)}`,
    '        models:'
  ];
  lines.push(`          - id: ${yamlSingleQuote(settings.model || CUSTOM_MODEL_ID)}`, '            name: 自定义模型');
  return lines;
}

/**
 * 表单里密钥留空 = 沿用已保存的那份（与面板文案同口径）；只有显式 clearApiKey 才作废。
 * 收进模块而不是写在 IPC 里，是为了让这条规则可被回归用例钉住。
 */
export function mergeAgentProviderKey(
  incoming: AgentProviderSettings,
  existing: AgentProviderSettings | undefined,
  clearApiKey = false
): AgentProviderSettings {
  if (incoming.apiKey) return incoming;
  if (clearApiKey) return { ...incoming, apiKey: '' };
  return { ...incoming, apiKey: existing?.apiKey || '' };
}

export async function readAgentProviderSettings(
  filePath: string,
  safeStorage: AgentProviderSafeStorageLike
): Promise<{ settings: AgentProviderSettings; keyUnavailable: boolean }> {
  let parsed: StoredAgentProviderSettings;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, 'utf8')) as StoredAgentProviderSettings;
  } catch {
    return { settings: defaultAgentProviderSettings(), keyUnavailable: false };
  }
  const normalized = normalizeAgentProviderSettings({
    kind: parsed?.kind,
    baseUrl: parsed?.baseUrl,
    model: parsed?.model,
    protocol: parsed?.protocol,
    apiKey: ''
  });
  const settings = normalized.settings || defaultAgentProviderSettings();
  let apiKey = '';
  let keyUnavailable = parsed?.apiKeyUnavailable === true;
  if (parsed?.apiKey?.value) {
    if (parsed.apiKey.encoding === 'safeStorage') {
      if (!safeStorage.isEncryptionAvailable()) {
        // 换机或系统钥匙串不可用：宁可提示也不退回明文读取。
        keyUnavailable = true;
      } else {
        try {
          apiKey = safeStorage.decryptString(Buffer.from(parsed.apiKey.value, 'base64'));
        } catch {
          keyUnavailable = true;
        }
      }
    } else {
      apiKey = parsed.apiKey.value;
    }
  }
  return { settings: { ...settings, apiKey }, keyUnavailable };
}

export interface AgentProviderWriteResult {
  ok: boolean;
  /** 密钥未能加密落盘时的中文说明（非密钥字段仍会保存）。 */
  problem?: string;
}

export async function writeAgentProviderSettings(
  filePath: string,
  settings: AgentProviderSettings,
  safeStorage: AgentProviderSafeStorageLike
): Promise<AgentProviderWriteResult> {
  const stored: StoredAgentProviderSettings = {
    version: 1,
    kind: settings.kind,
    baseUrl: settings.baseUrl,
    model: settings.model,
    protocol: settings.protocol,
    apiKeyUnavailable: false
  };
  let problem: string | undefined;
  if (settings.apiKey) {
    if (safeStorage.isEncryptionAvailable()) {
      stored.apiKey = { encoding: 'safeStorage', value: safeStorage.encryptString(settings.apiKey).toString('base64') };
    } else {
      // 与 Bridge Token 同口径：不落明文密钥，只保存其余字段并如实报告；
      // 同时记下标记，重启后仍会提示「密钥读不出来」而不是静默丢失。
      stored.apiKeyUnavailable = true;
      problem = '本机系统凭据存储不可用，API Key 未能保存（其余设置已生效）。请在 IDE 内重新填写密钥，或改用已登录 dsh 的本机凭据。';
    }
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(stored, null, 2)}\n`, 'utf8');
  return { ok: true, problem };
}
