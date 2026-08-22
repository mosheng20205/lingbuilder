import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export type AiConversationRole = 'user' | 'assistant';
export type AiConversationMessageStatus = 'complete' | 'streaming' | 'cancelled' | 'error';

export interface AiConversationMessage {
  id: string;
  role: AiConversationRole;
  content: string;
  createdAt: string;
  status?: AiConversationMessageStatus;
  model?: { mode: 'system' | 'byok'; provider?: string; modelName?: string };
}

export interface AiConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AiConversationMessage[];
}

export interface AiConversationStore {
  schemaVersion: 1;
  projectId: string;
  activeConversationId?: string;
  conversations: AiConversation[];
}

const MAX_CONVERSATIONS = 60;
const MAX_MESSAGES = 500;
const MAX_MESSAGE_CHARS = 80_000;

export class AiConversationStoreError extends Error {
  constructor(public readonly code: 'INVALID_PROJECT' | 'CORRUPTED_STORE' | 'NOT_FOUND' | 'INVALID_INPUT', message: string) {
    super(message);
    this.name = 'AiConversationStoreError';
  }
}

/** Workspace-local AI history. Credentials belong to safeStorage, never this file. */
export class AiConversationService {
  constructor(private readonly workspaceRoot: string) {}

  async get(projectId: string): Promise<AiConversationStore> { return clone(await this.read(projectId)); }

  async create(projectId: string, title?: string): Promise<AiConversationStore> {
    const store = await this.read(projectId);
    const now = new Date().toISOString();
    const conversation: AiConversation = { id: crypto.randomUUID(), title: normalizeTitle(title) || '新建 AI 会话', createdAt: now, updatedAt: now, messages: [] };
    store.conversations = [conversation, ...store.conversations].slice(0, MAX_CONVERSATIONS);
    store.activeConversationId = conversation.id;
    await this.write(store);
    return clone(store);
  }

  async activate(projectId: string, conversationId: string): Promise<AiConversationStore> {
    const store = await this.read(projectId);
    this.requireConversation(store, conversationId);
    store.activeConversationId = conversationId;
    await this.write(store);
    return clone(store);
  }

  async rename(projectId: string, conversationId: string, title: unknown): Promise<AiConversationStore> {
    const store = await this.read(projectId);
    const conversation = this.requireConversation(store, conversationId);
    const nextTitle = normalizeTitle(title);
    if (!nextTitle) throw new AiConversationStoreError('INVALID_INPUT', '会话标题不能为空。');
    conversation.title = nextTitle;
    conversation.updatedAt = new Date().toISOString();
    await this.write(store);
    return clone(store);
  }

  async remove(projectId: string, conversationId: string): Promise<AiConversationStore> {
    const store = await this.read(projectId);
    this.requireConversation(store, conversationId);
    store.conversations = store.conversations.filter(item => item.id !== conversationId);
    if (store.activeConversationId === conversationId) store.activeConversationId = store.conversations[0]?.id;
    await this.write(store);
    return clone(store);
  }

  async replaceMessages(projectId: string, conversationId: string, messages: unknown): Promise<AiConversationStore> {
    const store = await this.read(projectId);
    const conversation = this.requireConversation(store, conversationId);
    if (!Array.isArray(messages)) throw new AiConversationStoreError('INVALID_INPUT', '会话消息必须是数组。');
    conversation.messages = messages.slice(-MAX_MESSAGES).map((message, index) => normalizeMessage(message, index));
    conversation.updatedAt = new Date().toISOString();
    const firstUserMessage = conversation.messages.find(message => message.role === 'user');
    if (conversation.title === '新建 AI 会话' && firstUserMessage) conversation.title = normalizeTitle(firstUserMessage.content) || conversation.title;
    await this.write(store);
    return clone(store);
  }

  private async read(projectId: string): Promise<AiConversationStore> {
    const target = this.resolvePath(projectId);
    try { return validateStore(JSON.parse(await fs.readFile(target, 'utf8')), projectId); }
    catch (error: any) {
      if (error?.code === 'ENOENT') return { schemaVersion: 1, projectId, conversations: [] };
      if (error instanceof AiConversationStoreError) throw error;
      if (error instanceof SyntaxError) throw new AiConversationStoreError('CORRUPTED_STORE', 'AI 会话文件已损坏，请先备份并修复 .lingbuilder/ai 中的会话文件。');
      throw error;
    }
  }

  private async write(store: AiConversationStore): Promise<void> {
    const target = this.resolvePath(store.projectId);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const temporary = `${target}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(temporary, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
    await fs.rename(temporary, target);
  }

  private requireConversation(store: AiConversationStore, conversationId: string): AiConversation {
    const conversation = store.conversations.find(item => item.id === (typeof conversationId === 'string' ? conversationId.trim() : ''));
    if (!conversation) throw new AiConversationStoreError('NOT_FOUND', '未找到指定的 AI 会话。');
    return conversation;
  }

  private resolvePath(projectId: string): string {
    if (typeof projectId !== 'string' || !/^[\w.-]+$/u.test(projectId)) throw new AiConversationStoreError('INVALID_PROJECT', '项目 ID 包含不安全字符。');
    return path.join(this.workspaceRoot, '.lingbuilder', 'ai', `${projectId}.sessions.json`);
  }
}

function validateStore(value: unknown, projectId: string): AiConversationStore {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiConversationStoreError('CORRUPTED_STORE', 'AI 会话文件格式无效。');
  const candidate = value as Partial<AiConversationStore>;
  if (candidate.schemaVersion !== 1 || candidate.projectId !== projectId || !Array.isArray(candidate.conversations)) throw new AiConversationStoreError('CORRUPTED_STORE', 'AI 会话文件版本或项目标识无效。');
  const conversations = candidate.conversations.slice(0, MAX_CONVERSATIONS).map((item, index) => normalizeConversation(item, index));
  const activeConversationId = typeof candidate.activeConversationId === 'string' && conversations.some(item => item.id === candidate.activeConversationId) ? candidate.activeConversationId : conversations[0]?.id;
  return { schemaVersion: 1, projectId, activeConversationId, conversations };
}

function normalizeConversation(value: unknown, index: number): AiConversation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiConversationStoreError('CORRUPTED_STORE', `第 ${index + 1} 个 AI 会话格式无效。`);
  const item = value as Partial<AiConversation>;
  if (!isSafeId(item.id) || !Array.isArray(item.messages)) throw new AiConversationStoreError('CORRUPTED_STORE', `第 ${index + 1} 个 AI 会话缺少有效标识或消息。`);
  return { id: item.id, title: normalizeTitle(item.title) || '未命名 AI 会话', createdAt: normalizeTime(item.createdAt), updatedAt: normalizeTime(item.updatedAt), messages: item.messages.slice(-MAX_MESSAGES).map((message, messageIndex) => normalizeMessage(message, messageIndex)) };
}

function normalizeMessage(value: unknown, index: number): AiConversationMessage {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AiConversationStoreError('INVALID_INPUT', `第 ${index + 1} 条会话消息格式无效。`);
  const item = value as Partial<AiConversationMessage>;
  if (!isSafeId(item.id) || (item.role !== 'user' && item.role !== 'assistant') || typeof item.content !== 'string') throw new AiConversationStoreError('INVALID_INPUT', `第 ${index + 1} 条会话消息缺少有效内容。`);
  if (item.content.length > MAX_MESSAGE_CHARS) throw new AiConversationStoreError('INVALID_INPUT', `第 ${index + 1} 条会话消息超过 ${MAX_MESSAGE_CHARS} 个字符。`);
  const status = item.status === 'streaming' || item.status === 'cancelled' || item.status === 'error' || item.status === 'complete' ? item.status : undefined;
  const model = item.model && typeof item.model === 'object' && !Array.isArray(item.model) ? normalizeModel(item.model) : undefined;
  return { id: item.id, role: item.role, content: item.content, createdAt: normalizeTime(item.createdAt), ...(status ? { status } : {}), ...(model ? { model } : {}) };
}

function normalizeModel(value: object): AiConversationMessage['model'] | undefined {
  const model = value as { mode?: unknown; provider?: unknown; modelName?: unknown };
  if (model.mode !== 'system' && model.mode !== 'byok') return undefined;
  const provider = typeof model.provider === 'string' ? model.provider.slice(0, 80) : undefined;
  const modelName = typeof model.modelName === 'string' ? model.modelName.slice(0, 160) : undefined;
  return { mode: model.mode, ...(provider ? { provider } : {}), ...(modelName ? { modelName } : {}) };
}

function normalizeTitle(value: unknown): string { return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ').slice(0, 80) : ''; }
function normalizeTime(value: unknown): string { return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : new Date().toISOString(); }
function isSafeId(value: unknown): value is string { return typeof value === 'string' && /^[\w.-]{1,128}$/u.test(value); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
