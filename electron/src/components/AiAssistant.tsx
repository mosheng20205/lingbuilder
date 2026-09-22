import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Brain, Sparkles, Send, Square, ChevronDown, ChevronUp, RefreshCw, Check, AlertTriangle, Cloud, KeyRound, Coins, LogOut, X, Plus, Trash2, Copy, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppliedWorkspaceFile, ExtractedString, GlossaryTerm, WorkspaceEditProposal, WorkspaceFileSnapshot } from '../types';
import { LingCppModuleContext } from '../services/modules/types';
import { readPreferredCloudModelAlias, writePreferredCloudModelAlias } from '../services/ai/cloudModelPreference';
import { requestCloudAccountLogin } from '../services/workbench/cloudAccountLoginService';
import { requestCloudAccountRecharge } from '../services/workbench/cloudAccountRechargeService';
import {
  getCloudAccountSessionState,
  refreshCloudAccountSession,
  signOutCloudAccount,
  subscribeCloudAccountSession,
  type CloudAccountSessionState
} from '../services/workbench/cloudAccountSessionStore';
import type { LingWindowProject } from '../services/windowDesigner/types';
import type { ProjectMutationOwner } from '../services/workspace/projectMutationOwner';
import {
  aiConnectionSession,
  type AiConnectionMode
} from '../services/ai/aiConnectionSessionService';
import type { AiConversationStore } from '../services/ai/aiConversationService';
import { MAX_REASONING_CHARS } from '../services/ai/aiConversationService';
import type { CommandService } from '../services/commands/commandService';

const AI_CONFIG_STORAGE_KEY = 'lingbuilder.aiConnectionConfig.v1';

interface AiConnectionConfig {
  baseUrl: string;
  apiKey: string;
  modelName: string;
  presetId?: string;
  provider?: 'gemini' | 'openai' | 'anthropic' | 'deepseek';
}

const DEFAULT_AI_CONFIG: AiConnectionConfig = {
  baseUrl: '',
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  presetId: 'gemini-2.5-flash',
  provider: 'gemini'
};

const COLLAPSED_MESSAGE_HEIGHT = 224;

// 聊天输入框高度：自动模式跟随内容（含两行占位提示）完整显示，拖拽模式允许用户拉大。
const AI_CHAT_INPUT_AUTO_MAX_HEIGHT = 128;
const AI_CHAT_INPUT_MANUAL_MAX_HEIGHT = 320;
const AI_CHAT_INPUT_MIN_HEIGHT = 36;

const AI_MODEL_PRESETS = [
  { id: 'custom', label: '自定义模型', baseUrl: '', modelName: '', provider: 'openai' },
  { id: 'claude-sonnet', label: 'Claude - Sonnet', baseUrl: 'https://api.anthropic.com/v1', modelName: 'claude-sonnet-4-5', provider: 'anthropic' },
  { id: 'claude-haiku', label: 'Claude - Haiku', baseUrl: 'https://api.anthropic.com/v1', modelName: 'claude-haiku-4-5', provider: 'anthropic' },
  { id: 'chatgpt-gpt41', label: 'ChatGPT - GPT-4.1', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4.1', provider: 'openai' },
  { id: 'chatgpt-gpt4o', label: 'ChatGPT - GPT-4o', baseUrl: 'https://api.openai.com/v1', modelName: 'gpt-4o', provider: 'openai' },
  { id: 'gemini-2.5-flash', label: 'Gemini - 2.5 Flash', baseUrl: 'https://generativelanguage.googleapis.com', modelName: 'gemini-2.5-flash', provider: 'gemini' },
  { id: 'gemini-2.5-pro', label: 'Gemini - 2.5 Pro', baseUrl: 'https://generativelanguage.googleapis.com', modelName: 'gemini-2.5-pro', provider: 'gemini' },
  { id: 'deepseek-v4-flash', label: 'DeepSeek - V4 Flash', baseUrl: 'https://api.deepseek.com', modelName: 'deepseek-v4-flash', provider: 'deepseek' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek - V4 Pro', baseUrl: 'https://api.deepseek.com', modelName: 'deepseek-v4-pro', provider: 'deepseek' },
  { id: 'qwen-plus', label: '阿里通义 - Qwen Plus', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-plus', provider: 'openai' },
  { id: 'qwen-max', label: '阿里通义 - Qwen Max', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelName: 'qwen-max', provider: 'openai' },
  { id: 'doubao-seed', label: '豆包 - Seed', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelName: 'doubao-seed-1-6', provider: 'openai' },
  { id: 'minimax-m1', label: 'MiniMax - M1', baseUrl: 'https://api.minimax.io/v1', modelName: 'MiniMax-M1', provider: 'openai' },
  { id: 'kimi-k2', label: 'Kimi - K2', baseUrl: 'https://api.moonshot.cn/v1', modelName: 'kimi-k2-0711-preview', provider: 'openai' },
  { id: 'kimi-latest', label: 'Kimi - Latest', baseUrl: 'https://api.moonshot.cn/v1', modelName: 'moonshot-v1-auto', provider: 'openai' }
] as const;

// 自定义模型可选的接口协议；value 与 AiConnectionConfig.provider 及服务端协议分派一一对应。
const AI_PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI Compatible' },
  { value: 'anthropic', label: 'Anthropic Compatible' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'gemini', label: 'Google Gemini' }
] as const;

type AiProviderOption = (typeof AI_PROVIDER_OPTIONS)[number]['value'];

function loadAiConfig(): AiConnectionConfig {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_AI_CONFIG;
    const parsed = JSON.parse(raw);
    const preset = AI_MODEL_PRESETS.find(item => item.id === parsed.presetId);
    return {
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
      apiKey: '',
      modelName: typeof parsed.modelName === 'string' && parsed.modelName.trim() ? parsed.modelName : DEFAULT_AI_CONFIG.modelName,
      presetId: typeof parsed.presetId === 'string' ? parsed.presetId : DEFAULT_AI_CONFIG.presetId,
      provider: preset && preset.id !== 'custom'
        ? preset.provider
        : ['gemini', 'openai', 'anthropic', 'deepseek'].includes(parsed.provider)
          ? parsed.provider
          : DEFAULT_AI_CONFIG.provider
    };
  } catch {
    return DEFAULT_AI_CONFIG;
  }
}

function loadAiMode(): AiConnectionMode {
  try {
    const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
    if (!raw) return 'system';
    const value = JSON.parse(raw)?.aiMode;
    return value === 'byok' ? 'byok' : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Layout edits must not depend on the active editor language. A project can
 * have an `.ini`, `.cpp`, or other file open while the request still targets
 * the current window designer model.
 */
export function isLikelyDesignerEditInstruction(instruction: string): boolean {
  const normalized = instruction.trim();
  if (!normalized) return false;
  const hasDesignerTarget = /窗口|窗体|控件|布局|界面|按钮|文本框|输入框|标签|进度条|设计器|标题栏|面板|列表|菜单/u.test(normalized);
  const hasDesignerMutation = /增加|新增|添加|删除|移除|去掉|移动|调整|修改|设置|美化|美观|好看|太乱|整洁|优化|显示|隐藏|颜色|字体|圆角|间距|宽度|高度|尺寸|位置|对齐|重排/u.test(normalized);
  return hasDesignerTarget && hasDesignerMutation;
}

/** Only enter the edit-preview flow when the user explicitly asks for a change. */
export function isLikelyCodeEditInstruction(instruction: string): boolean {
  const normalized = instruction.trim();
  if (!normalized) return false;
  return /修改|改写|重写|重构|修复|纠正|补全|新增|删除|移除|替换|调整|优化|生成代码|写代码|实现|添加功能|rename|refactor|rewrite|fix|change|update|remove|delete|add|implement/iu.test(normalized);
}

/** Keep the active source and at least one design-relevant `.lcpp` file in
 * the bounded system-AI context, even when the active editor is `config.ini`.
 */
export function getAiWorkspaceFilesForEdit(
  workspaceFiles: WorkspaceFileSnapshot[],
  activeFilePath: string,
  activeSourceCode: string
): WorkspaceFileSnapshot[] {
  const normalizePath = (value: string) => value.replaceAll('\\', '/').toLowerCase();
  const activePath = normalizePath(activeFilePath);
  const activeSnapshot = workspaceFiles.find(file => normalizePath(file.filePath) === activePath);
  const currentActiveFile: WorkspaceFileSnapshot = activeSnapshot
    ? { ...activeSnapshot, sourceCode: activeSourceCode }
    : { filePath: activeFilePath, sourceCode: activeSourceCode };
  const prioritized = [
    currentActiveFile,
    ...workspaceFiles.filter(file => normalizePath(file.filePath) !== activePath && /\.lcpp$/iu.test(file.filePath)),
    ...workspaceFiles
  ];
  const seen = new Set<string>();
  return prioritized.filter(file => {
    const key = normalizePath(file.filePath);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}

interface AiAssistantProps {
  strings: ExtractedString[];
  glossary: GlossaryTerm[];
  onBatchTranslate: (translations: { id: string; translated: string }[], owner?: ProjectMutationOwner) => void;
  onSetStatus: (id: string, status: 'translated' | 'skipped' | 'pending', owner?: ProjectMutationOwner) => void;
  filePath: string;
  sourceCode: string;
  activeLanguage: string;
  projectId?: string;
  projectMutationOwner: ProjectMutationOwner;
  moduleContext?: LingCppModuleContext;
  designerProject?: LingWindowProject;
  workspaceFiles: WorkspaceFileSnapshot[];
  onApplyWorkspaceEdit?: (
    proposal: WorkspaceEditProposal,
    appliedFiles: AppliedWorkspaceFile[],
    owner?: ProjectMutationOwner
  ) => boolean | void | Promise<boolean | void>;
  /** 服务端写盘前的项目上下文预检；返回空串放行，否则为中文拒绝原因（面板不得发起 /edit/apply）。 */
  precheckApplyWorkspaceEdit?: () => string;
  commandService?: CommandService;
  isDarkMode?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  /** ISO 创建时间；持久化与展示都以它为准，避免保存时被整体改写。 */
  createdAt: string;
  /** 推理型模型的思考过程；仅折叠展示，不作为正文持久化。 */
  reasoningText?: string;
  /** 连接状态、用量报表等系统通知；保留展示但不回传给模型当上下文。 */
  contextExcluded?: boolean;
  codeBlock?: string;
  status?: 'complete' | 'streaming' | 'cancelled' | 'error';
  model?: { mode: 'system' | 'byok'; provider?: string; modelName?: string };
}

function createChatMessage(sender: 'user' | 'ai', text: string, options: { id?: string; contextExcluded?: boolean } = {}): Message {
  const now = new Date();
  return {
    id: options.id ?? Math.random().toString(),
    sender,
    text,
    timestamp: now.toLocaleTimeString(),
    createdAt: now.toISOString(),
    ...(options.contextExcluded ? { contextExcluded: true } : {})
  };
}

/** 思考内容提升为正文时的上限；须低于会话存储的 MAX_MESSAGE_CHARS，保证提升后的消息仍可持久化。 */
const PROMOTED_REASONING_LIMIT = 70_000;

function promoteReasoningText(reasoningText: string): string {
  return reasoningText.length > PROMOTED_REASONING_LIMIT
    ? `${reasoningText.slice(0, PROMOTED_REASONING_LIMIT)}\n\n（思考内容过长，已截断展示）`
    : reasoningText;
}

/** Message → 会话存储结构。reasoningText 必须随行：chatHistory 从会话 store 派生，
 * 丢掉该字段会让「AI 思考过程」折叠块无法渲染，且 completed 时的空回复提升静默失效。 */
function toConversationMessage(message: Message) {
  return {
    id: message.id,
    role: message.sender === 'ai' ? 'assistant' as const : 'user' as const,
    content: message.text,
    createdAt: message.createdAt || new Date().toISOString(),
    status: message.status || 'complete' as const,
    model: message.model,
    ...(message.reasoningText ? { reasoningText: message.reasoningText.slice(0, MAX_REASONING_CHARS) } : {}),
    ...(message.contextExcluded ? { contextExcluded: true } : {})
  };
}

const WELCOME_MESSAGE: Message = {
  id: 'welcome',
  sender: 'ai',
  text: '你好！我是 LingBuilder 的 AI 智能编程助手。\n\n我会结合当前文件、工作区文件和已启用模块上下文，帮你生成可预览、可确认的代码修改方案。\n\n请在下方直接描述你想改什么；需要切换模型时，可在上方 AI 对接设置里选择。',
  timestamp: '',
  createdAt: ''
};

export default function AiAssistant({
  strings,
  glossary,
  onBatchTranslate,
  onSetStatus,
  filePath,
  sourceCode,
  activeLanguage,
  projectId,
  projectMutationOwner,
  moduleContext,
  designerProject,
  workspaceFiles,
  onApplyWorkspaceEdit,
  precheckApplyWorkspaceEdit,
  commandService,
  isDarkMode = true
}: AiAssistantProps) {
  const [aiMode, setAiMode] = useState<AiConnectionMode>(() => {
    // Web 预览没有云端账号 IPC；初始即落回自定义 API，避免渲染出不可用的登录表单。
    const stored = aiConnectionSession.getMode() || loadAiMode();
    return stored === 'system' && !window.lingBuilder?.cloudAccount ? 'byok' : stored;
  });
  const [cloudSession, setCloudSession] = useState<CloudAccountSessionState>(getCloudAccountSessionState);
  const [cloudModels, setCloudModels] = useState<Array<{ alias: string; displayName: string; description: string; maxOutputTokens: number }>>([]);
  const [cloudModelAlias, setCloudModelAlias] = useState(() => readPreferredCloudModelAlias());
  // 登录态与点数一律来自 cloudAccountSessionStore，面板不再自持一份会话副本。
  useEffect(() => subscribeCloudAccountSession(() => setCloudSession(getCloudAccountSessionState())), []);
  const loadCloudModels = async () => {
    const cloudAccount = window.lingBuilder?.cloudAccount;
    if (!cloudAccount) return;
    const result = await cloudAccount.models().catch(() => null);
    const modelList = result?.models || [];
    setCloudModels(modelList);
    setCloudModelAlias(current => {
      const aliases = modelList.map(model => model.alias);
      if (current && aliases.includes(current)) return current;
      const preferred = readPreferredCloudModelAlias();
      if (preferred && aliases.includes(preferred)) return preferred;
      return aliases[0] || '';
    });
  };
  const [aiConfig, setAiConfig] = useState<AiConnectionConfig>(loadAiConfig);
  const [isAiCredentialReady, setIsAiCredentialReady] = useState(
    () => !window.lingBuilder?.credentials
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [isAiConfigExpanded, setIsAiConfigExpanded] = useState(true);
  // 自定义 API 自动检测：配置变更去抖后真实 ping 一次供应商，内联展示结果；成功等同连接成功（不写聊天气泡）。
  const [autoCheckState, setAutoCheckState] = useState<{ status: 'checking' | 'ok' | 'fail'; message: string } | null>(null);
  const autoCheckGenerationRef = useRef(0);
  const lastAutoCheckSignatureRef = useRef<string | null>(null);
  const autoCheckConfigEditedRef = useRef(false);
  // 密钥明文切换与「获取模型列表」：列表仅在地址/密钥/协议变更时失效，模型名编辑不清空。
  const [showApiKey, setShowApiKey] = useState(false);
  const [modelOptions, setModelOptions] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelFetchError, setModelFetchError] = useState('');
  const [isConnectingAi, setIsConnectingAi] = useState(false);
  const [aiConnectedSignature, setAiConnectedSignature] = useState<string | null>(
    () => aiConnectionSession.getConnectedSignature()
  );
  const [chatInput, setChatInput] = useState('');
  // null 表示高度自动跟随内容；用户拖拽顶部分隔条后为固定像素高度，双击分隔条恢复自动。
  const [chatInputHeight, setChatInputHeight] = useState<number | null>(null);
  const [conversationStore, setConversationStore] = useState<AiConversationStore | null>(null);
  const [conversationError, setConversationError] = useState('');
  const activeConversation = conversationStore?.conversations.find(item => item.id === conversationStore.activeConversationId);
  const storedChatMessages = activeConversation?.messages.map(message => ({
    id: message.id,
    sender: message.role === 'assistant' ? 'ai' as const : 'user' as const,
    text: message.content,
    timestamp: new Date(message.createdAt).toLocaleTimeString(),
    createdAt: message.createdAt,
    status: message.status,
    model: message.model,
    ...(message.reasoningText ? { reasoningText: message.reasoningText } : {}),
    ...(message.contextExcluded ? { contextExcluded: true as const } : {})
  }));
  // 会话为空数组时同样要回落到欢迎消息：[].map() 是 truthy，旧写法会在清空后渲染出空白聊天区。
  const chatHistory: Message[] = storedChatMessages && storedChatMessages.length > 0
    ? storedChatMessages
    : [{ ...WELCOME_MESSAGE, timestamp: new Date().toLocaleTimeString(), createdAt: new Date().toISOString() }];
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [expandedMessageIds, setExpandedMessageIds] = useState<Set<string>>(() => new Set());
  const [collapsibleMessageIds, setCollapsibleMessageIds] = useState<Set<string>>(() => new Set());
  const [reasoningExpandedMessageIds, setReasoningExpandedMessageIds] = useState<Set<string>>(() => new Set());
  const [confirmAction, setConfirmAction] = useState<{ kind: 'remove' | 'clear'; conversationId?: string } | null>(null);
  const [renamingConversationId, setRenamingConversationId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editProposal, setEditProposal] = useState<WorkspaceEditProposal | null>(null);
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const isLingCppFile = activeLanguage === 'lingcpp' || filePath.endsWith('.lcpp');
  // Web 预览没有 window.lingBuilder.cloudAccount：系统 AI 标签禁用，避免出现点击无反应的登录表单。
  const isCloudAccountAvailable = Boolean(window.lingBuilder?.cloudAccount);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messageContentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const chatAbortRef = useRef<AbortController | null>(null);
  const stopRequestedRef = useRef(false);
  const cloudRequestRef = useRef<string | null>(null);
  // Older cloud API versions did not include `instruction` in edit_draft.
  // Keep the user prompt locally so the renderer can still apply the same
  // designer fallback and validation rules while those servers are rolling out.
  const cloudInstructionRef = useRef<Map<string, string>>(new Map());
  const cloudKindRef = useRef<Map<string, 'chat' | 'edit'>>(new Map());
  const pendingCloudInstructionRef = useRef<string | null>(null);
  const conversationSaveTimerRef = useRef<number | undefined>(undefined);
  const chatHistoryRef = useRef<Message[]>(chatHistory);
  chatHistoryRef.current = chatHistory;
  // 挂载一次的云端事件监听通过 ref 读取最新值，避免每次按键都重新订阅并重复请求会话。
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const activeConversationRef = useRef(activeConversation);
  activeConversationRef.current = activeConversation;
  const aiEditContextRef = useRef({ filePath, sourceCode, projectId, moduleContext, designerProject, workspaceFiles });
  aiEditContextRef.current = { filePath, sourceCode, projectId, moduleContext, designerProject, workspaceFiles };
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  // 空输入时的自适应高度，即完整显示占位提示所需的最小高度，作为拖拽下限防止文字再次被裁。
  const chatInputAutoHeightRef = useRef(AI_CHAT_INPUT_MIN_HEIGHT);
  const chatInputResizeRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const chatAutoScrollRef = useRef(true);
  const confirmActionRef = useRef<{ kind: 'remove' | 'clear'; conversationId?: string; expiresAt: number } | null>(null);
  const confirmActionTimerRef = useRef<number | undefined>(undefined);
  const effectiveModelName = aiConfig.modelName.trim() || DEFAULT_AI_CONFIG.modelName;
  const effectiveProvider: AiProviderOption = aiConfig.provider || DEFAULT_AI_CONFIG.provider;
  const isCustomPreset = (aiConfig.presetId || 'custom') === 'custom';
  const aiConnectionSignature = [
    aiConfig.provider || DEFAULT_AI_CONFIG.provider,
    aiConfig.baseUrl.trim(),
    aiConfig.apiKey.trim(),
    effectiveModelName
  ].join('|');
  const isAiConnected = aiConnectionSession.isConnected(aiConnectionSignature)
    && aiConnectedSignature === aiConnectionSignature;

  const applyConversationStore = (store: AiConversationStore) => {
    setConversationStore(store);
    setConversationError('');
  };

  const persistMessages = (messages: Message[], immediately = false) => {
    const conversation = activeConversationRef.current;
    const projectId = projectIdRef.current;
    if (!projectId || !conversation) return;
    const save = async () => {
      try {
        const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversation.id)}/messages`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, messages: messages.filter(message => message.id !== 'welcome').map(toConversationMessage) })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.ok === false) throw new Error(result.error || '保存 AI 会话失败。');
        applyConversationStore(result.store as AiConversationStore);
      } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
    };
    if (conversationSaveTimerRef.current) window.clearTimeout(conversationSaveTimerRef.current);
    if (immediately) void save();
    else conversationSaveTimerRef.current = window.setTimeout(() => { void save(); }, 400);
  };

  const updateChatHistory = (updater: (previous: Message[]) => Message[], immediately = false) => {
    const next = updater(chatHistoryRef.current);
    chatHistoryRef.current = next;
    const conversation = activeConversationRef.current;
    if (conversation) {
      setConversationStore(previous => previous ? {
        ...previous,
        conversations: previous.conversations.map(item => item.id === conversation.id ? {
          ...item,
          updatedAt: new Date().toISOString(),
          messages: next.filter(message => message.id !== 'welcome').map(toConversationMessage)
        } : item)
      } : previous);
    }
    persistMessages(next, immediately);
  };

  useEffect(() => {
    if (!projectId) { setConversationStore(null); return; }
    let active = true;
    void fetch(`/api/ai/conversations?projectId=${encodeURIComponent(projectId)}`).then(async response => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '读取 AI 会话失败。');
      if (!active) return;
      const store = result.store as AiConversationStore;
      if (store.conversations.length === 0) {
        const created = await fetch('/api/ai/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
        const createdResult = await created.json().catch(() => ({}));
        if (!created.ok || createdResult.ok === false) throw new Error(createdResult.error || '创建默认 AI 会话失败。');
        if (active) applyConversationStore(createdResult.store as AiConversationStore);
      } else applyConversationStore(store);
    }).catch(error => { if (active) setConversationError(error instanceof Error ? error.message : String(error)); });
    return () => { active = false; if (conversationSaveTimerRef.current) window.clearTimeout(conversationSaveTimerRef.current); };
  }, [projectId]);

  const createConversation = async () => {
    if (!projectId) return;
    try {
      const response = await fetch('/api/ai/conversations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '新建 AI 会话失败。');
      applyConversationStore(result.store as AiConversationStore);
      setEditProposal(null);
    } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
  };

  const activateConversation = async (conversationId: string) => {
    if (!projectId || conversationId === activeConversation?.id) return;
    try {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}/activate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ projectId }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '切换 AI 会话失败。');
      applyConversationStore(result.store as AiConversationStore);
      setEditProposal(null);
    } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
  };

  const removeConversation = async (conversationId: string) => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}?projectId=${encodeURIComponent(projectId)}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '删除 AI 会话失败。');
      if ((result.store as AiConversationStore).conversations.length === 0) { await createConversation(); return; }
      applyConversationStore(result.store as AiConversationStore);
    } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
  };

  const clearCurrentConversation = async () => {
    if (!projectId || !activeConversation) return;
    stopAiResponse();
    try {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(activeConversation.id)}/messages`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, messages: [] })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '清除当前上下文失败。');
      applyConversationStore(result.store as AiConversationStore);
      setEditProposal(null);
      setExpandedMessageIds(new Set());
      setCollapsibleMessageIds(new Set());
    } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
  };

  // 删除会话/清除上下文都是不可撤销操作：第一次点击只亮起确认态，3 秒内再点一次才执行。
  const armOrRunConfirm = (kind: 'remove' | 'clear', conversationId: string | undefined, run: () => void) => {
    const current = confirmActionRef.current;
    if (current && current.kind === kind && current.conversationId === conversationId && current.expiresAt > Date.now()) {
      confirmActionRef.current = null;
      setConfirmAction(null);
      if (confirmActionTimerRef.current) window.clearTimeout(confirmActionTimerRef.current);
      run();
      return;
    }
    confirmActionRef.current = { kind, conversationId, expiresAt: Date.now() + 3000 };
    setConfirmAction({ kind, conversationId });
    if (confirmActionTimerRef.current) window.clearTimeout(confirmActionTimerRef.current);
    confirmActionTimerRef.current = window.setTimeout(() => {
      confirmActionRef.current = null;
      setConfirmAction(null);
    }, 3000);
  };

  const requestRemoveConversation = (conversationId: string) => {
    armOrRunConfirm('remove', conversationId, () => void removeConversation(conversationId));
  };

  const requestClearCurrentConversation = () => {
    armOrRunConfirm('clear', undefined, () => void clearCurrentConversation());
  };

  const beginRenameConversation = (conversation: { id: string; title: string }) => {
    setRenamingConversationId(conversation.id);
    setRenameDraft(conversation.title);
  };

  const commitRenameConversation = async () => {
    const conversationId = renamingConversationId;
    if (!conversationId) return;
    const title = renameDraft.trim();
    setRenamingConversationId(null);
    const currentProjectId = projectIdRef.current;
    if (!currentProjectId || !title) return;
    try {
      const response = await fetch(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: currentProjectId, title })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) throw new Error(result.error || '重命名 AI 会话失败。');
      applyConversationStore(result.store as AiConversationStore);
    } catch (error) { setConversationError(error instanceof Error ? error.message : String(error)); }
  };

  useEffect(() => {
    if (!commandService) return;
    const registration = commandService.registerCommands([
      {
        id: 'workbench.action.ai.newConversation',
        title: 'AI：新建会话',
        aliases: ['新建 AI 会话', 'new ai conversation'],
        category: 'AI 助手',
        description: '创建一个新的项目级 AI 会话。',
        enabled: () => Boolean(projectId),
        handler: () => createConversation()
      },
      {
        id: 'workbench.action.ai.clearContext',
        title: 'AI：清除当前上下文',
        aliases: ['清除 AI 上下文', 'clear ai context'],
        category: 'AI 助手',
        description: '清空当前会话消息，但保留会话记录。',
        enabled: () => Boolean(projectId && activeConversation),
        handler: () => requestClearCurrentConversation()
      }
    ]);
    return () => registration.dispose();
  }, [commandService, projectId, activeConversation?.id]);

  useEffect(() => {
    if (!messageContextMenu) return;
    const close = () => setMessageContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); };
  }, [messageContextMenu]);

  const copyMessage = async () => {
    if (!messageContextMenu) return;
    try { await navigator.clipboard.writeText(messageContextMenu.text); }
    catch {
      const textarea = document.createElement('textarea');
      textarea.value = messageContextMenu.text; textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select(); document.execCommand('copy'); textarea.remove();
    }
    setMessageContextMenu(null);
  };

  const updateAiConfig = (patch: Partial<AiConnectionConfig>) => {
    aiConnectionSession.clear();
    autoCheckConfigEditedRef.current = true;
    if ('provider' in patch || 'baseUrl' in patch || 'apiKey' in patch) {
      setModelOptions([]);
      setModelFetchError('');
    }
    setAiConnectedSignature(null);
    setAiConfig(current => ({
      ...current,
      ...patch
    }));
  };

  const handleFetchModels = async () => {
    if (isFetchingModels) return;
    setIsFetchingModels(true);
    setModelFetchError('');
    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiConfig: { ...aiConfig, modelName: effectiveModelName } })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.details || data.error || '获取模型列表失败');
      }
      const models: string[] = Array.isArray(data.models) ? data.models.filter((item: unknown) => typeof item === 'string') : [];
      if (!models.length) {
        throw new Error('服务端未返回任何可用模型');
      }
      setModelOptions(models);
    } catch (error: any) {
      setModelOptions([]);
      setModelFetchError(String(error?.message || '获取模型列表失败').slice(0, 200));
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAiModeChange = (mode: AiConnectionMode) => {
    aiConnectionSession.setMode(mode);
    setAiMode(mode);
  };

  const handlePresetChange = (presetId: string) => {
    const preset = AI_MODEL_PRESETS.find(item => item.id === presetId);
    if (!preset || preset.id === 'custom') {
      updateAiConfig({ presetId });
      return;
    }
    updateAiConfig({
      presetId,
      baseUrl: preset.baseUrl,
      modelName: preset.modelName,
      provider: preset.provider
    });
  };

  const handleConnectAi = async () => {
    setIsConnectingAi(true);
    lastAutoCheckSignatureRef.current = aiConnectionSignature;
    setAutoCheckState(null);
    try {
      const response = await fetch('/api/ai/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aiConfig: { ...aiConfig, modelName: effectiveModelName }
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.details || data.error || 'AI 连接失败');
      }
      aiConnectionSession.markConnected(aiConnectionSignature);
      setAiConnectedSignature(aiConnectionSignature);
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `AI 已连接：${effectiveModelName}`, { contextExcluded: true })
      ]);
    } catch (error: any) {
      aiConnectionSession.clear();
      setAiConnectedSignature(null);
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `AI 连接失败：${error?.message || '请检查 Base URL、API Key 和 Model Name。'}`, { contextExcluded: true })
      ]);
    } finally {
      setIsConnectingAi(false);
    }
  };

  useEffect(() => {
    const scrollPanel = chatScrollRef.current;
    if (!scrollPanel || !chatAutoScrollRef.current) return;
    // 只有用户本来就停在底部时才跟随新内容滚动；上翻阅读时不被流式输出拽回底部。
    scrollPanel.scrollTo({
      top: scrollPanel.scrollHeight,
      behavior: 'smooth'
    });
  }, [chatHistory, isAiResponding]);

  const handleChatScroll = () => {
    const scrollPanel = chatScrollRef.current;
    if (!scrollPanel) return;
    chatAutoScrollRef.current = scrollPanel.scrollHeight - scrollPanel.scrollTop - scrollPanel.clientHeight < 80;
  };

  useLayoutEffect(() => {
    const nextCollapsibleIds = new Set<string>();
    chatHistory.forEach(message => {
      if (message.sender !== 'ai') return;
      const element = messageContentRefs.current[message.id];
      if (element && element.scrollHeight > COLLAPSED_MESSAGE_HEIGHT) nextCollapsibleIds.add(message.id);
    });
    setCollapsibleMessageIds(previous => {
      if (previous.size === nextCollapsibleIds.size && [...previous].every(id => nextCollapsibleIds.has(id))) return previous;
      return nextCollapsibleIds;
    });
  }, [chatHistory]);

  useEffect(() => {
    const updateMessageOverflow = () => {
      const nextCollapsibleIds = new Set<string>();
      chatHistory.forEach(message => {
        if (message.sender !== 'ai') return;
        const element = messageContentRefs.current[message.id];
        if (element && element.scrollHeight > COLLAPSED_MESSAGE_HEIGHT) nextCollapsibleIds.add(message.id);
      });
      setCollapsibleMessageIds(previous => {
        if (previous.size === nextCollapsibleIds.size && [...previous].every(id => nextCollapsibleIds.has(id))) return previous;
        return nextCollapsibleIds;
      });
    };
    window.addEventListener('resize', updateMessageOverflow);
    return () => window.removeEventListener('resize', updateMessageOverflow);
  }, [chatHistory]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({
        ...aiConfig,
        aiMode,
        apiKey: undefined,
        modelName: effectiveModelName
      }));
      if (isAiCredentialReady) {
        void window.lingBuilder?.credentials?.setAiApiKey(aiConfig.apiKey);
      }
    } catch {
      // AI settings remain usable for the current session even if storage fails.
    }
  }, [aiConfig, aiMode, effectiveModelName, isAiCredentialReady]);

  useEffect(() => {
    if (aiMode !== 'byok') return;
    if (!autoCheckConfigEditedRef.current) return;
    if (!aiConfig.apiKey.trim() || !effectiveModelName) return;
    if (lastAutoCheckSignatureRef.current === aiConnectionSignature) return;
    const generation = ++autoCheckGenerationRef.current;
    const requestConfig = { ...aiConfig, modelName: effectiveModelName };
    const timer = window.setTimeout(async () => {
      // 手动「连接到 AI」已覆盖当前签名时跳过，避免重复 ping 供应商。
      if (lastAutoCheckSignatureRef.current === aiConnectionSignature) return;
      lastAutoCheckSignatureRef.current = aiConnectionSignature;
      setAutoCheckState({ status: 'checking', message: '' });
      try {
        const response = await fetch('/api/ai/connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ aiConfig: requestConfig })
        });
        const data = await response.json().catch(() => ({}));
        if (generation !== autoCheckGenerationRef.current) return;
        if (!response.ok || data.ok === false) {
          setAutoCheckState({ status: 'fail', message: String(data.details || data.error || 'AI 连接失败').slice(0, 200) });
          return;
        }
        setAutoCheckState({ status: 'ok', message: effectiveModelName });
        aiConnectionSession.markConnected(aiConnectionSignature);
        setAiConnectedSignature(aiConnectionSignature);
      } catch (error: any) {
        if (generation !== autoCheckGenerationRef.current) return;
        setAutoCheckState({ status: 'fail', message: String(error?.message || 'AI 连接失败').slice(0, 200) });
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [aiConnectionSignature, aiMode, aiConfig, effectiveModelName]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.apiKey) {
          delete parsed.apiKey;
          window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(parsed));
        }
      }
    } catch {
      // Ignore legacy cleanup failures.
    }

    const credentials = window.lingBuilder?.credentials;
    if (!credentials) {
      setIsAiCredentialReady(true);
      return;
    }

    void credentials.getAiApiKey()
      .then(apiKey => {
        if (apiKey) setAiConfig(current => ({ ...current, apiKey }));
      })
      .catch(() => undefined)
      .finally(() => setIsAiCredentialReady(true));
  }, []);

  useEffect(() => {
    setEditProposal(null);
  }, [filePath, projectMutationOwner.loadGeneration, projectMutationOwner.projectId]);

  // Web 预览没有云端账号 IPC：仅在挂载时同步一次回退模式，不再随编辑器输入反复切换。
  useEffect(() => {
    if (!window.lingBuilder?.cloudAccount) handleAiModeChange('byok');
  }, []);

  // 云端会话与流式事件只订阅一次：旧的依赖 sourceCode/workspaceFiles 会导致每次按键都
  // 重新请求 /v1/me 与余额接口，并在流式期间反复重挂监听器。
  useEffect(() => {
    const cloudAccount = window.lingBuilder?.cloudAccount;
    if (!cloudAccount) return;
    let active = true;
    void refreshCloudAccountSession().then(session => {
      if (active && session.authenticated) void loadCloudModels();
    });
    const unsubscribe = window.lingBuilder?.cloudAi?.onEvent((requestKey, event) => {
      if (requestKey !== cloudRequestRef.current) return;
      if (event.type === 'delta' && event.text) {
        if (cloudKindRef.current.get(requestKey) === 'edit') {
          updateChatHistory(previous => {
            const id = `cloud-${requestKey}`;
            const status = 'AI 正在生成可确认的修改方案（含源码与设计器），请稍候…';
            const existing = previous.find(message => message.id === id);
            if (existing) return previous.map(message => message.id === id ? { ...message, text: status } : message);
            return [...previous, { ...createChatMessage('ai', status, { id }), contextExcluded: true }];
          });
          return;
        }
        updateChatHistory(previous => {
          const id = `cloud-${requestKey}`;
          const existing = previous.find(message => message.id === id);
          if (existing) return previous.map(message => message.id === id ? { ...message, text: message.text + event.text } : message);
          return [...previous, createChatMessage('ai', event.text, { id })];
        });
      }
      if (event.type === 'reasoning' && event.text) {
        // 推理型模型的思考过程与正文分离，只在折叠块里展示，不再混入回复正文。
        updateChatHistory(previous => {
          const id = `cloud-${requestKey}`;
          const existing = previous.find(message => message.id === id);
          if (existing) return previous.map(message => message.id === id ? { ...message, reasoningText: (message.reasoningText || '') + event.text } : message);
          return [...previous, { ...createChatMessage('ai', '', { id }), reasoningText: event.text }];
        });
      }
      if (event.type === 'edit_draft' && Array.isArray(event.files)) {
        const instruction = typeof event.instruction === 'string' && event.instruction.trim()
          ? event.instruction
          : cloudInstructionRef.current.get(requestKey)
            || pendingCloudInstructionRef.current
            || '系统 AI 工作区编辑';
        const editContext = aiEditContextRef.current;
        void fetch('/api/lingcpp/edit/from-system-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath: editContext.filePath, sourceCode: editContext.sourceCode, instruction, projectId: editContext.projectId, moduleContext: editContext.moduleContext, currentDesignerProject: editContext.designerProject, designerProject: event.designerProject, workspaceFiles: editContext.workspaceFiles, files: event.files }) }).then(response => response.json()).then(value => { if (!value.ok) throw new Error(value.error || '系统 AI 编辑草稿校验失败'); setEditProposal(value.proposal); }).catch(error => updateChatHistory(previous => [...previous, createChatMessage('ai', error instanceof Error ? error.message : String(error), { contextExcluded: true })]));
      }
      if (event.type === 'usage') {
        updateChatHistory(previous => [...previous, createChatMessage('ai', `本次用量：输入 ${event.receipt.inputTokens}、输出 ${event.receipt.outputTokens} Token，扣除 ${event.receipt.chargedPoints} AI 点数${event.receipt.freePromotionId ? '（免费活动）' : ''}。`, { contextExcluded: true })]);
        void refreshCloudAccountSession();
      }
      if (event.type === 'completed' || event.type === 'error') {
        if (event.type === 'completed') {
          // 模型只输出思考过程时，把思考内容提升为正文，避免用户看到空白回复。
          updateChatHistory(previous => previous.map(message => message.id === `cloud-${requestKey}` && !message.text.trim() && message.reasoningText
            ? { ...message, text: promoteReasoningText(message.reasoningText), reasoningText: undefined }
            : message), true);
        }
        if (event.type === 'error') updateChatHistory(previous => [...previous, createChatMessage('ai', event.message || '系统 AI 请求失败。', { contextExcluded: true })], true);
        cloudInstructionRef.current.delete(requestKey);
        if (cloudRequestRef.current === requestKey) pendingCloudInstructionRef.current = null;
        cloudRequestRef.current = null; setIsAiResponding(false);
      }
    });
    return () => {
      active = false;
      if (confirmActionTimerRef.current) window.clearTimeout(confirmActionTimerRef.current);
      unsubscribe?.();
    };
  }, []);

  // 登录/注册/找回密码统一走顶层账号对话框（全 IDE 唯一表单），面板只负责刷新模型列表。
  const openAccountDialog = async (initialMode: 'login' | 'register' | 'reset') => {
    if (!window.lingBuilder?.cloudAccount) return;
    const result = await requestCloudAccountLogin({ initialMode });
    if (!result.authenticated) return;
    await refreshCloudAccountSession();
    void loadCloudModels();
  };

  // Handle one-click AI translation
  const handleBatchAiTranslate = async () => {
    if (strings.length === 0) return;
    setIsTranslating(true);
    setTranslationProgress(10);

    try {
      // 1. Get strings that are pending
      const pendingStrings = strings.filter(s => s.status === 'pending');
      if (pendingStrings.length === 0) {
        setTranslationProgress(100);
        setTimeout(() => {
          setIsTranslating(false);
          setTranslationProgress(0);
        }, 1000);
        return;
      }

      setTranslationProgress(30);

      // Call Express server-side translate endpoint
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: pendingStrings,
          glossary,
          aiConfig: { ...aiConfig, modelName: effectiveModelName }
        })
      });

      setTranslationProgress(70);

      if (!response.ok) {
        throw new Error('网络请求错误，请确认已配置 API Key、Base URL 和模型名称');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.translations && Array.isArray(data.translations)) {
        onBatchTranslate(data.translations, projectMutationOwner);
        setTranslationProgress(100);
      } else {
        throw new Error('未返回有效的代码生成数据结构');
      }
    } catch (error: any) {
      console.error(error);
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `⚠️ 批量代码生成失败：${error.message || '请确认 API Key、Base URL 和模型名称可以正常连接。'}`, { contextExcluded: true })
      ]);
    } finally {
      setTimeout(() => {
        setIsTranslating(false);
        setTranslationProgress(0);
      }, 1000);
    }
  };

  // 聊天面板内直接驱动「AI 生成模块」共享流：多阶段生成 → 契约解析 → 导入 module-build。
  // 与模块面板共用 aiModuleGenerationFlow 唯一实现；结果以聊天消息汇报，不进入编辑提案链。
  const runModuleGenerationInChat = async (requirement: string) => {
    const channel: 'system' | 'byok' = aiMode === 'system' ? 'system' : 'byok';
    const statusId = `module-gen-${Date.now()}`;
    const upsertStatus = (text: string) => updateChatHistory(previous => {
      const existing = previous.find(message => message.id === statusId);
      if (existing) return previous.map(message => message.id === statusId ? { ...message, text } : message);
      return [...previous, { ...createChatMessage('ai', text, { id: statusId }), contextExcluded: true }];
    }, true);
    try {
      upsertStatus(channel === 'system'
        ? '正在按《LingBuilder 模块 AI 开发规范》生成模块（清单 → 文件 → 导入），请稍候……'
        : '正在通过自定义 API 生成模块并导入 module-build，请稍候……');
      let outcome: AiModuleGenerationOutcome;
      try {
        outcome = await runAiModuleGeneration(requirement, channel, {
          onStage: (_stage, message) => upsertStatus(message),
          onRequestKey: key => { moduleGenerationRequestRef.current = key; }
        }, { ...aiConfig, modelName: effectiveModelName });
      } catch (error) {
        outcome = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
      if (stopRequestedRef.current) return;
      if (!outcome.ok || !outcome.imported) {
        updateChatHistory(previous => [...previous, createChatMessage('ai', `AI 模块生成失败：${outcome.error || '未知错误'}${outcome.rawOutput ? '\n\n可打开「模块 → 开发工具 → AI 生成模块」的手动模式，把 AI 原始回复粘贴进文本框完成导入。' : ''}`)]);
        return;
      }
      const imported = outcome.imported;
      const summaryLines = [
        `已${imported.overwrittenExisting ? '重新生成并覆盖导入' : '生成并导入'}模块「${imported.moduleName}」（${imported.moduleId}）到 ${imported.outDir}，共 ${imported.fileCount} 个文件。`,
        imported.diagnostics.length > 0 ? `导入校验未完全通过：${imported.diagnostics.join('；')}` : '导入后校验通过。',
        '下一步：打开「模块」页 → 开发工具 →「模块包制作」，校验并导出 .lbmod 后安装启用；在项目里启用模块后即可调用其中文命令。'
      ];
      updateChatHistory(previous => [...previous, createChatMessage('ai', summaryLines.filter(Boolean).join('\n'))]);
    } finally {
      moduleGenerationRequestRef.current = null;
      setIsAiResponding(false);
    }
  };

  // BYOK 发送前解析凭据 Key（2026-09-22 编辑提案链 401 根治的一环）：
  // aiConfig.apiKey 在挂载时由凭据库异步回填，编辑提案/聊天若赶在回填前发出，
  // 会带着空 Key 打服务端——旧版服务端会用启动时固化的 GEMINI_* 环境变量旧值顶替，
  // 造成「Key 尾缀与当前一致却被上游 401」的假象。这里在每次发送前保证 Key 已从
  // 凭据库取到最新值；仍取不到就直接给中文错误，不发注定失败的请求。
  const resolveByokAiConfig = async (): Promise<AiConnectionConfig> => {
    let apiKey = aiConfig.apiKey;
    if (!apiKey.trim() && window.lingBuilder?.credentials) {
      try {
        apiKey = (await window.lingBuilder.credentials.getAiApiKey()) || '';
      } catch {
        apiKey = '';
      }
      if (apiKey) setAiConfig(current => ({ ...current, apiKey }));
    }
    return { ...aiConfig, apiKey, modelName: effectiveModelName };
  };

  // 本机 Agent 引擎（内嵌 DeepSeek Harness）：跨轮复用的会话与已接手的提案 ID。
  const agentSessionRef = useRef('');
  const handledAgentProposalsRef = useRef<Set<string>>(new Set());

  const pushAgentNotice = (text: string) => updateChatHistory(previous => [...previous, createChatMessage('ai', text, { contextExcluded: true })]);

  /**
   * 把需求整体交给内嵌运行时。它只能经 AI Bridge MCP 的 agent 工具集干活
   * （写盘与构建类工具对它不可见），生成的提案由工作区交接目录回到本面板，
   * 预览与落盘仍复用现有唯一 apply 事务——这里绝不直接改文件。
   */
  const runAgentTurn = async (instruction: string) => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime) {
      pushAgentNotice('本机 Agent 引擎只在 LingBuilder 桌面版可用（需要 IDE 主进程托管内嵌运行时）。');
      return;
    }
    const status = await runtime.status();
    if (status && status.state !== 'running' && status.state !== 'busy') {
      const started = await runtime.start({});
      if (!started.ok) {
        pushAgentNotice(`内嵌 Agent 启动失败：${started.error || '未知原因'}`);
        return;
      }
      pushAgentNotice(`内嵌 Agent 已启动（Node ${started.snapshot?.nodeVersion || '未知版本'}，模型 ${started.snapshot?.model || '未知模型'}）。它只能生成提案，落盘与构建由你确认后执行。`);
    }
    const turn = await runtime.prompt({ prompt: instruction, sessionId: agentSessionRef.current || undefined });
    if (!turn.ok) {
      pushAgentNotice(`本轮失败：${turn.error || '内嵌 Agent 未返回结果'}`);
      return;
    }
    if (turn.sessionId) agentSessionRef.current = turn.sessionId;
    const toolCalls = (turn.events || []).filter(event => event.type === 'tool/call').length;
    pushAgentNotice(turn.finalText?.trim() || `（本轮调用了 ${toolCalls} 个 LingBuilder 工具，没有留下文字说明）`);
    try {
      const fetched = await fetch('/api/lingcpp/edit/agent-proposal').then(response => response.json());
      const proposal = fetched?.proposal;
      if (proposal?.id && !handledAgentProposalsRef.current.has(proposal.id)) {
        handledAgentProposalsRef.current.add(proposal.id);
        setEditProposal(proposal);
        pushAgentNotice(`已生成可预览的编辑提案：${proposal.summary || proposal.id}。请在上方差异预览后点击「应用提案」。`);
      }
    } catch {
      pushAgentNotice('未读取到内嵌 Agent 的提案交接内容（/api/lingcpp/edit/agent-proposal 不可用）。');
    }
  };

  // Conversational translation query
  const submitChatMessage = async () => {
    if (isAiResponding) return;
    if (!chatInput.trim()) return;

    const userMsg: Message = createChatMessage('user', chatInput);
    // 纯问答先判掉：既不进模块生成流，也不进编辑提案链。
    const askingOnlyInstruction = isLikelyAskingOnlyInstruction(userMsg.text);

    // 本机 Agent 引擎：整轮交给内嵌运行时，不走系统 AI / BYOK 的本地 planner 链。
    if (aiMode === 'agent') {
      updateChatHistory(prev => [...prev, userMsg]);
      setChatInput('');
      setIsAiResponding(true);
      try {
        await runAgentTurn(userMsg.text);
      } catch (error) {
        pushAgentNotice(`内嵌 Agent 出错：${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsAiResponding(false);
      }
      return;
    }

    updateChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiResponding(true);
    stopRequestedRef.current = false;
    const controller = new AbortController(); chatAbortRef.current?.abort(); chatAbortRef.current = controller;
    let isManagedByCloudStream = false;

    try {
      if (aiMode === 'system') {
        if (!cloudSession.authenticated || !window.lingBuilder?.cloudAi || !cloudModelAlias) throw new Error('请先登录系统 AI 并选择可用模型。');
        pendingCloudInstructionRef.current = userMsg.text;
        const messages = [...chatHistoryRef.current.filter(message => message.id !== 'welcome' && !message.contextExcluded && message.id !== userMsg.id).slice(-18).map(message => ({ role: message.sender === 'ai' ? 'assistant' as const : 'user' as const, content: message.text })), { role: 'user' as const, content: userMsg.text }];
        const rulebookVersion = 'lingbuilder-rulebook-v1';
        const shouldUseEditFlow = (isLingCppFile && isLikelyCodeEditInstruction(userMsg.text)) || Boolean(
          designerProject && isLikelyDesignerEditInstruction(userMsg.text)
        );
        const payload = shouldUseEditFlow ? {
          modelAlias: cloudModelAlias, messages, rulebookVersion, activeFilePath: filePath, instruction: userMsg.text,
          files: await Promise.all(getAiWorkspaceFilesForEdit(workspaceFiles, filePath, sourceCode).map(async file => ({ filePath: file.filePath, content: file.sourceCode.slice(0, 24_000), language: file.language, sha256: await sha256(file.sourceCode) }))),
          ...(designerProject ? { designerProject } : {})
        } : { modelAlias: cloudModelAlias, messages, rulebookVersion };
        const requestKey = await window.lingBuilder.cloudAi.start(shouldUseEditFlow ? 'edit' : 'chat', payload);
        cloudKindRef.current.set(requestKey, shouldUseEditFlow ? 'edit' : 'chat');
        cloudInstructionRef.current.set(requestKey, userMsg.text);
        cloudRequestRef.current = requestKey;
        isManagedByCloudStream = true;
        if (chatAbortRef.current === controller) chatAbortRef.current = null;
        if (stopRequestedRef.current) {
          await window.lingBuilder.cloudAi.cancel(requestKey);
          cloudKindRef.current.delete(requestKey);
          cloudInstructionRef.current.delete(requestKey);
          cloudRequestRef.current = null;
          pendingCloudInstructionRef.current = null;
          setIsAiResponding(false);
        }
        return;
      }
      const shouldUseEditFlow = (isLingCppFile && isLikelyCodeEditInstruction(userMsg.text)) || Boolean(
        designerProject && isLikelyDesignerEditInstruction(userMsg.text)
      );
      if (shouldUseEditFlow) {
        const response = await fetch('/api/lingcpp/edit/propose', {
          signal: controller.signal,
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            sourceCode,
            instruction: userMsg.text,
            projectId,
            moduleContext,
            aiConfig: { ...aiConfig, modelName: effectiveModelName },
            workspaceFiles,
            designerProject
          })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          throw new Error(data.error || `中文 C++ 编辑提案生成失败（HTTP ${response.status}）。`);
        }

        const proposal = data.proposal as WorkspaceEditProposal;
        setEditProposal(proposal);
        updateChatHistory(prev => [
          ...prev,
          createChatMessage('ai', `已生成一份可预览的工作区编辑提案：${proposal.summary}\n\n本次涉及 ${proposal.changes.length} 个文件${proposal.designerProject ? '，并同步修改窗口设计器模型' : ''}，请在下方预览差异后选择“应用提案”或“拒绝提案”。`)
        ]);
        return;
      }

      // Build a contextual prompt about the current file's strings
      const fileContext = strings.slice(0, 10).map(s => `- ID: ${s.id}, 原文: "${s.original}"`).join('\n');
      // 自定义 API 模式同样携带最近对话：追问（如“再详细一点”）才能命中上文。
      const historyMessages = chatHistoryRef.current
        .filter(message => message.id !== 'welcome' && message.id !== userMsg.id && !message.contextExcluded)
        .slice(-8);
      const historyBlock = historyMessages.length > 0
        ? `以下是此前的对话记录（最近 ${historyMessages.length} 条，供上下文参考，回答需与最新问题连贯）：\n${historyMessages.map(message => `${message.sender === 'user' ? '用户' : '助手'}：${message.text.length > 2000 ? `${message.text.slice(0, 2000)}…` : message.text}`).join('\n')}\n\n`
        : '';
      const prompt = `您是 C++ 编程与代码映射专家。以下是当前文件 ${filePath} 中提取的部分字符串（仅供参考）：\n${fileContext}\n\n${historyBlock}用户提问：${userMsg.text}\n\n请针对用户的中文代码映射或 C++ 语法问题，结合此前对话进行连贯的专业解答。如果涉及代码，请用 Markdown 代码块返回，以便用户拷贝。`;

      const response = await fetch('/api/translate', {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: [{ id: 'chat_query', original: prompt, type: 'string', context: 'User Chat Interaction' }]
          ,
          aiConfig: { ...aiConfig, modelName: effectiveModelName }
        })
      });

      if (!response.ok) {
        // 透传服务端 error/details（如 fetch failed / 缺少 API Key），不再只报通用失败。
        const failure = await response.json().catch(() => ({} as { error?: string; details?: string }));
        throw new Error([failure.error, failure.details].filter(Boolean).join('：') || `AI 助手响应失败（HTTP ${response.status}）`);
      }

      const data = await response.json();
      const aiReplyText = data.translations?.[0]?.translated || 'AI 助手当前不可用，请检查 API 密钥设置。';

      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', aiReplyText)
      ]);
    } catch (err: any) {
      if (controller.signal.aborted || stopRequestedRef.current) return;
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `抱歉，在尝试回应您时发生错误：${err.message || '请检查 API 连接状况。'}`, { contextExcluded: true })
      ]);
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      if (!isManagedByCloudStream) setIsAiResponding(false);
    }
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    void submitChatMessage();
  };

  // 未手动拖拽时，输入框高度自适应内容（含占位提示），保证文字完整显示；超过上限后内部滚动。
  const chatInputManualHeightRef = useRef<number | null>(chatInputHeight);
  chatInputManualHeightRef.current = chatInputHeight;
  const fitChatInputHeight = () => {
    const textarea = chatInputRef.current;
    if (!textarea || chatInputManualHeightRef.current !== null) return;
    textarea.style.height = 'auto';
    const borderBox = textarea.offsetHeight - textarea.clientHeight;
    const contentHeight = Math.ceil(textarea.scrollHeight) + borderBox;
    chatInputAutoHeightRef.current = Math.max(contentHeight, AI_CHAT_INPUT_MIN_HEIGHT);
    textarea.style.height = `${Math.min(contentHeight, AI_CHAT_INPUT_AUTO_MAX_HEIGHT)}px`;
  };
  const fitChatInputHeightRef = useRef(fitChatInputHeight);
  fitChatInputHeightRef.current = fitChatInputHeight;

  useLayoutEffect(() => {
    fitChatInputHeight();
  }, [chatInput, chatInputHeight, isLingCppFile]);

  // 面板宽度变化导致占位提示重新换行时，重新自适应高度，避免文字再次被裁。
  useEffect(() => {
    const textarea = chatInputRef.current;
    if (!textarea || typeof ResizeObserver === 'undefined') return;
    let lastWidth = textarea.getBoundingClientRect().width;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (Math.abs(entry.contentRect.width - lastWidth) < 1) continue;
        lastWidth = entry.contentRect.width;
        fitChatInputHeightRef.current();
      }
    });
    observer.observe(textarea);
    return () => observer.disconnect();
  }, []);

  const handleChatInputResizeStart = (event: React.PointerEvent<HTMLDivElement>) => {
    const textarea = chatInputRef.current;
    if (!textarea || event.button !== 0) return;
    event.preventDefault();
    chatInputResizeRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight: textarea.offsetHeight };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleChatInputResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = chatInputResizeRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    // 拖拽下限取空输入自适应高度，保证占位提示始终完整可见。
    const minHeight = Math.max(chatInputAutoHeightRef.current, AI_CHAT_INPUT_MIN_HEIGHT);
    const nextHeight = Math.min(Math.max(drag.startHeight - (event.clientY - drag.startY), minHeight), AI_CHAT_INPUT_MANUAL_MAX_HEIGHT);
    setChatInputHeight(nextHeight);
  };

  const handleChatInputResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (chatInputResizeRef.current?.pointerId !== event.pointerId) return;
    chatInputResizeRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const handleChatInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter 发送、Shift+Enter 换行；输入法组合期间不触发发送。
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submitChatMessage();
  };

  const stopAiResponse = () => {
    if (!isAiResponding) return;
    stopRequestedRef.current = true;
    const requestKey = cloudRequestRef.current;
    if (aiMode === 'system' && requestKey) {
      cloudRequestRef.current = null;
      pendingCloudInstructionRef.current = null;
      cloudKindRef.current.delete(requestKey);
      cloudInstructionRef.current.delete(requestKey);
      void window.lingBuilder?.cloudAi?.cancel(requestKey);
    } else {
      chatAbortRef.current?.abort();
      chatAbortRef.current = null;
    }
    setIsAiResponding(false);
    updateChatHistory(previous => [...previous, createChatMessage('ai', '已停止本次 AI 回复。', { contextExcluded: true })]);
  };

  const handleApplyProposal = async () => {
    if (!editProposal || !onApplyWorkspaceEdit) return;
    const precheckBlock = precheckApplyWorkspaceEdit ? precheckApplyWorkspaceEdit() : '';
    if (precheckBlock) {
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `应用编辑提案失败：${precheckBlock}`, { contextExcluded: true })
      ]);
      return;
    }
    try {
      const response = await fetch('/api/lingcpp/edit/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proposalId: editProposal.id,
          sourceCode,
          workspaceFiles,
          designerProject,
          projectId
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `应用提案失败（HTTP ${response.status}）。`);
      }
      const appliedFiles = (data.appliedFiles || []) as AppliedWorkspaceFile[];
      // 不传渲染期捕获的 projectMutationOwner 快照：提案期间切换过项目会让它过期，
      // 严格相等会把刚完成的写入误拒成僵尸卡。由 App 在调用时刻新鲜捕获。
      if (await onApplyWorkspaceEdit(editProposal, appliedFiles) === false) {
        // 服务端此刻已原子写盘成功，只是编辑器内存状态未同步——不得谎报「应用失败」。
        const changedFileList = editProposal.changes.map(change => change.filePath).join('、');
        updateChatHistory(prev => [
          ...prev,
          createChatMessage('ai', `提案已写回磁盘：${changedFileList}；但编辑器内存状态未同步（项目上下文切换中）。请重新打开该文件查看最新内容，输出面板已记录拒因。`, { contextExcluded: true })
        ]);
        setEditProposal(null);
        return;
      }
      const changedFileList = editProposal.changes.map(change => change.filePath).join('、');
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `已应用该工作区编辑提案，源码和窗口设计器改动已写回：${changedFileList}。`)
      ]);
      setEditProposal(null);
    } catch (error) {
      updateChatHistory(prev => [
        ...prev,
        createChatMessage('ai', `应用编辑提案失败：${error instanceof Error ? error.message : String(error)}`, { contextExcluded: true })
      ]);
    }
  };

  const handleRejectProposal = async () => {
    if (!editProposal) return;
    await fetch('/api/lingcpp/edit/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: editProposal.id })
    });
    updateChatHistory(prev => [
      ...prev,
      createChatMessage('ai', '已拒绝当前中文 C++ 编辑提案，源文件未发生变化。')
    ]);
    setEditProposal(null);
  };

  return (
    <div 
      id="ai-assistant-panel" 
      className={`h-full flex flex-col font-sans border-l ${
        isDarkMode 
          ? 'bg-[#1e1e24] text-[#D4D4D4] border-[#2d2d34]' 
          : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {/* Panel Title */}
      <div 
        className={`p-3.5 border-b flex items-center justify-between shrink-0 ${
          isDarkMode ? 'bg-[#18181c] border-[#2d2d34]' : 'bg-slate-100 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-500" />
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>AI 智能中文代码引擎</span>
        </div>
      </div>

      <div className={`shrink-0 border-b px-3 py-2 ${isDarkMode ? 'border-[#2d2d34] bg-[#1a1a20]/30' : 'border-slate-200 bg-slate-50'}`}>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">当前项目会话</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={requestClearCurrentConversation} className={`flex h-6 w-6 items-center justify-center rounded border ${confirmAction?.kind === 'clear' ? 'border-rose-500/60 bg-rose-500/20 text-rose-400' : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'}`} title={confirmAction?.kind === 'clear' ? '再次点击确认清除当前上下文' : '清除当前上下文'} aria-label={confirmAction?.kind === 'clear' ? '确认清除当前上下文' : '清除当前上下文'}><X className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => void createConversation()} className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/40 text-blue-400 hover:bg-blue-500/10" title="新建 AI 会话" aria-label="新建 AI 会话"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5" role="tablist" aria-label="AI 会话列表">
          {conversationStore?.conversations.map(conversation => (
            <div key={conversation.id} className={`flex max-w-[170px] shrink-0 items-center rounded border ${conversation.id === activeConversation?.id ? 'border-blue-500/60 bg-blue-500/10' : isDarkMode ? 'border-[#3a3a44] bg-[#202028]' : 'border-slate-200 bg-white'}`}>
              {renamingConversationId === conversation.id ? (
                <input
                  autoFocus
                  value={renameDraft}
                  onChange={event => setRenameDraft(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') { event.preventDefault(); void commitRenameConversation(); }
                    else if (event.key === 'Escape') { event.preventDefault(); setRenamingConversationId(null); }
                  }}
                  onBlur={() => void commitRenameConversation()}
                  aria-label="重命名 AI 会话"
                  className="w-24 rounded border border-blue-500/50 bg-transparent px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none"
                />
              ) : (
                <button type="button" role="tab" aria-selected={conversation.id === activeConversation?.id} onClick={() => void activateConversation(conversation.id)} onDoubleClick={() => beginRenameConversation(conversation)} className="min-w-0 truncate px-2 py-1 text-[10px] text-slate-300" title={`${conversation.title}（双击重命名）`}>{conversation.title}</button>
              )}
              <button type="button" onClick={() => requestRemoveConversation(conversation.id)} className={`mr-1 rounded p-0.5 ${confirmAction?.kind === 'remove' && confirmAction.conversationId === conversation.id ? 'bg-rose-500/20 text-rose-400' : 'text-slate-500 hover:text-rose-400'}`} title={confirmAction?.kind === 'remove' && confirmAction.conversationId === conversation.id ? '再次点击确认删除' : '删除会话'} aria-label={confirmAction?.kind === 'remove' && confirmAction.conversationId === conversation.id ? `确认删除会话：${conversation.title}` : `删除会话：${conversation.title}`}><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
        {conversationError && <div role="alert" className="mt-1 text-[11px] leading-relaxed text-rose-400">{conversationError}</div>}
      </div>

      {/* Batch Translation Controller */}
      <div 
        className={`p-3.5 border-b shrink-0 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#1a1a20]/30' : 'border-slate-200 bg-slate-50'
        }`}
      >
        {/* AI connection config */}
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">AI 对接设置</label>
            <button
              type="button"
              onClick={() => setIsAiConfigExpanded(value => !value)}
              className={`h-6 px-2 rounded border text-[10px] font-semibold cursor-pointer transition-colors ${
                isDarkMode ? 'border-[#343442] text-slate-300 hover:bg-[#2a2a34]' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {isAiConfigExpanded ? '收起' : '展开'}
            </button>
          </div>
          {isAiConfigExpanded && (
            <div className={`grid grid-cols-2 gap-1 rounded border p-1 ${isDarkMode ? 'border-[#343442] bg-[#18181c]' : 'border-slate-200 bg-slate-100'}`} role="tablist" aria-label="AI 使用模式">
              <button type="button" role="tab" aria-selected={aiMode === 'system'} onClick={() => handleAiModeChange('system')} disabled={!isCloudAccountAvailable} title={isCloudAccountAvailable ? '使用 LingBuilder 云端系统 AI' : '系统 AI 需要在 LingBuilder 桌面版中使用'} className={`flex min-h-7 items-center justify-center gap-1 rounded px-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${aiMode === 'system' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}><Cloud className="h-3 w-3"/>系统 AI</button>
              <button type="button" role="tab" aria-selected={aiMode === 'byok'} onClick={() => handleAiModeChange('byok')} className={`flex min-h-7 items-center justify-center gap-1 rounded px-2 text-[10px] ${aiMode === 'byok' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><KeyRound className="h-3 w-3"/>自定义 API</button>
              <button type="button" role="tab" aria-selected={aiMode === 'agent'} onClick={() => handleAiModeChange('agent')} disabled={!window.lingBuilder?.agentRuntime} title={window.lingBuilder?.agentRuntime ? '使用本机内嵌 Agent 运行时（DeepSeek Harness，经 LingBuilder MCP 干活；写盘与构建由你确认后代执行）' : '本机 Agent 只在 LingBuilder 桌面版可用'} className={`flex min-h-7 items-center justify-center gap-1 rounded px-2 text-[10px] disabled:cursor-not-allowed disabled:opacity-40 ${aiMode === 'agent' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}><Brain className="h-3 w-3"/>本机 Agent</button>
            </div>
          )}
          {aiMode === 'system' && isAiConfigExpanded && (
            <div className={`space-y-2 rounded border p-2.5 ${isDarkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
              {cloudSession.authenticated ? <>
                <div className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate text-slate-400">{cloudSession.email}</span><button type="button" aria-label="退出系统 AI 账号" className="flex min-h-7 items-center gap-1 text-rose-400" onClick={() => void signOutCloudAccount()}><LogOut className="h-3 w-3"/>退出</button></div>
                <div className="flex items-center gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded bg-black/10 px-2 py-1.5 text-[10px]"><Coins className="h-3.5 w-3.5 text-amber-400"/><span>可用点数</span><strong className="ml-auto tabular-nums">{cloudSession.balance?.available || '0'}</strong></div>
                  <button type="button" aria-label="打开点数充值" onClick={() => void requestCloudAccountRecharge()} className="min-h-7 rounded bg-amber-500/90 px-2 text-[10px] font-semibold text-white hover:bg-amber-500">充值</button>
                </div>
                <label className="block text-[10px] text-slate-500" htmlFor="system-ai-model">系统模型</label>
                <select id="system-ai-model" value={cloudModelAlias} onChange={event => { setCloudModelAlias(event.target.value); writePreferredCloudModelAlias(event.target.value); }} className={`min-h-9 w-full rounded border px-2 text-xs ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`}>{cloudModels.map(model => <option key={model.alias} value={model.alias}>{model.displayName}</option>)}</select>
              </> : <>
                <p className={`text-[10px] leading-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>系统 AI 按点数计费，需先登录 LingBuilder 账号；同一账号也用于收费模块权益与体验计划。</p>
                <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void openAccountDialog('login')} className="min-h-9 rounded bg-violet-600 text-[10px] font-semibold text-white">登录</button><button type="button" onClick={() => void openAccountDialog('register')} className="min-h-9 rounded border border-violet-500/40 text-[10px] text-violet-400">注册</button></div>
                <button type="button" onClick={() => void openAccountDialog('reset')} className={`text-left text-[10px] underline-offset-2 hover:underline cursor-pointer ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>忘记密码？通过邮箱重置</button>
                {cloudSession.error && <div role="status" className="text-[10px] text-amber-400">{cloudSession.error}</div>}
              </>}
            </div>
          )}
          {aiMode === 'byok' && isAiConfigExpanded && (
            <>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>预设</span>
                <select
                  value={aiConfig.presetId || 'custom'}
                  onChange={event => handlePresetChange(event.target.value)}
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 cursor-pointer ${
                    isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'
                  }`}
                >
                  {AI_MODEL_PRESETS.map(preset => (
                    <option key={preset.id} value={preset.id} className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>接口协议</span>
                <select
                  value={effectiveProvider}
                  onChange={event => updateAiConfig({ provider: event.target.value as AiProviderOption })}
                  disabled={!isCustomPreset}
                  title={isCustomPreset ? '自定义模型的调用协议' : '内置预设使用固定协议，选择「自定义模型」后可切换'}
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                    isCustomPreset ? 'cursor-pointer' : 'cursor-not-allowed opacity-70'
                  } ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'}`}
                >
                  {AI_PROVIDER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value} className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>API 地址</span>
                <input
                  value={aiConfig.baseUrl}
                  onChange={event => updateAiConfig({ baseUrl: event.target.value, presetId: 'custom' })}
                  placeholder="https://api.openai.com/v1"
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                    isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>密钥</span>
                <div className="relative">
                  <input
                    value={aiConfig.apiKey}
                    onChange={event => updateAiConfig({ apiKey: event.target.value })}
                    placeholder="留空使用服务端环境变量"
                    type={showApiKey ? 'text' : 'password'}
                    className={`w-full border rounded px-2.5 py-1.5 pr-9 text-xs focus:outline-none focus:border-purple-500 ${
                      isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(value => !value)}
                    title={showApiKey ? '隐藏密钥' : '显示密钥'}
                    aria-label={showApiKey ? '隐藏密钥' : '显示密钥'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>模型 ID</span>
                  <button
                    type="button"
                    onClick={handleFetchModels}
                    disabled={isFetchingModels || !aiConfig.apiKey.trim()}
                    title="从服务商拉取当前密钥可用的模型列表"
                    className="text-[11px] text-purple-500 hover:text-purple-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
                  >
                    {isFetchingModels ? '获取中…' : '获取模型列表'}
                  </button>
                </div>
                <input
                  value={aiConfig.modelName}
                  onChange={event => updateAiConfig({ modelName: event.target.value, presetId: 'custom' })}
                  placeholder="选择常用模型后自动填充，也可手动输入"
                  list="ai-byok-model-options"
                  className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                    isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                  }`}
                />
                <datalist id="ai-byok-model-options">
                  {modelOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
                {modelFetchError && (
                  <div className={`mt-1 text-[11px] leading-4 break-all ${isDarkMode ? 'text-rose-400' : 'text-rose-600'}`}>获取失败：{modelFetchError}</div>
                )}
              </div>
              <button
                type="button"
                onClick={handleConnectAi}
                disabled={isConnectingAi || !isAiCredentialReady || !effectiveModelName || isAiConnected}
                className={`w-full flex items-center justify-center gap-2 text-white font-bold py-2 rounded text-xs transition-all select-none shadow-md ${
                  isAiConnected
                    ? 'bg-emerald-600/80 cursor-default'
                    : 'bg-[#2563eb] hover:bg-blue-600 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {isConnectingAi ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>正在连接 AI...</span>
                  </>
                ) : isAiConnected ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>已连接 AI</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300/20" />
                    <span>连接到 AI</span>
                  </>
                )}
              </button>
              {autoCheckState && (
                <div
                  role="status"
                  className={`text-[11px] leading-4 break-all ${
                    autoCheckState.status === 'checking'
                      ? 'text-slate-500'
                      : autoCheckState.status === 'ok'
                        ? isDarkMode ? 'text-emerald-400' : 'text-emerald-600'
                        : isDarkMode ? 'text-rose-400' : 'text-rose-600'
                  }`}
                >
                  {autoCheckState.status === 'checking'
                    ? '正在自动检测接口可用性…'
                    : autoCheckState.status === 'ok'
                      ? `接口可用：${autoCheckState.message || effectiveModelName}`
                      : `接口不可用：${autoCheckState.message || '请检查 Base URL、API Key 和 Model Name'}`}
                </div>
              )}
            </>
          )}
        </div>

        {isTranslating && (
          <div className={`w-full h-1 rounded-full overflow-hidden mt-2 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-200'}`}>
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${translationProgress}%` }}></div>
          </div>
        )}
      </div>

      {editProposal && (
        <div className={`border-b p-3 shrink-0 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#181a22]' : 'border-slate-200 bg-slate-50'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <div className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{editProposal.title}</div>
              <div className="text-[10px] text-slate-500">{editProposal.summary}</div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleApplyProposal}
                className="px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-semibold hover:bg-emerald-500"
              >
                应用提案
              </button>
              <button
                onClick={handleRejectProposal}
                className={`px-2 py-1 rounded text-[10px] font-semibold ${
                  isDarkMode ? 'bg-[#2a2a34] text-slate-300 hover:bg-[#353542]' : 'bg-white text-slate-700 border border-slate-300'
                }`}
              >
                拒绝提案
              </button>
            </div>
          </div>
          <div className={`rounded border p-2 text-[10px] font-mono whitespace-pre-wrap ${
            isDarkMode ? 'border-[#343442] bg-[#11131a] text-slate-300' : 'border-slate-200 bg-white text-slate-700'
          }`}>
            <div className="text-slate-400 mb-2">{editProposal.explanation}</div>
            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
              {editProposal.changes.map((change, index) => (
                <div
                  key={`${change.filePath}-${index}`}
                  className={`rounded border p-2 ${
                    isDarkMode ? 'border-[#2a3240] bg-[#151821]' : 'border-slate-200 bg-slate-50/80'
                  }`}
                >
                  <div className="text-[10px] text-blue-400 mb-2">{change.filePath}</div>
                  <div className="text-amber-500 mb-1">原文</div>
                  <div>{change.originalText || '(空)'}</div>
                  <div className="text-emerald-500 mt-3 mb-1">新文</div>
                  <div>{change.newText || '(空)'}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conversation Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Chat History scroll panel */}
        <div ref={chatScrollRef} onScroll={handleChatScroll} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin select-text">
          {chatHistory.map((msg, idx) => {
            const isAiMessageCollapsible = msg.sender === 'ai' && collapsibleMessageIds.has(msg.id);
            const isAiMessageCollapsed = isAiMessageCollapsible && !expandedMessageIds.has(msg.id);
            return (
            <div
              key={msg.id || idx}
              onContextMenu={event => { event.preventDefault(); setMessageContextMenu({ x: event.clientX, y: event.clientY, text: msg.text }); }}
              className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-xs line-clamp-none ${
                msg.sender === 'user'
                  ? 'bg-[#223A73] border border-[#5B8DEF] !text-[#EAF2FF] self-end ml-auto'
                  : isDarkMode 
                  ? 'bg-[#25252b] border border-[#2d2d34] text-slate-300 self-start mr-auto'
                  : 'bg-slate-100 border border-slate-200 text-slate-800 self-start mr-auto'
              }`}
            >
              <div className={`flex items-center gap-1.5 mb-1.5 text-[9px] font-mono select-none ${msg.sender === 'user' ? '!text-[#BFD7FF]' : 'text-slate-400'}`}>
                {msg.sender === 'user' ? <span className="!text-[#D7E6FF]">开发者</span> : <span className="text-purple-500 font-bold">AI 助手</span>}
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>
              <div
                ref={element => { messageContentRefs.current[msg.id] = element; }}
                onContextMenu={event => { event.preventDefault(); setMessageContextMenu({ x: event.clientX, y: event.clientY, text: msg.text }); }}
                className={`relative select-text leading-relaxed font-sans ${msg.sender === 'user' ? '!text-[#EAF2FF]' : ''} ${
                  isAiMessageCollapsed ? 'max-h-56 overflow-hidden' : ''
                }`}
              >
                {msg.reasoningText && (
                  <div className="mb-1.5">
                    <button
                      type="button"
                      aria-expanded={reasoningExpandedMessageIds.has(msg.id)}
                      aria-label={reasoningExpandedMessageIds.has(msg.id) ? '收起 AI 思考过程' : '展开 AI 思考过程'}
                      onClick={() => setReasoningExpandedMessageIds(previous => {
                        const next = new Set(previous);
                        if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
                        return next;
                      })}
                      className={`inline-flex min-h-6 items-center gap-1 rounded border px-1.5 text-[9px] transition-colors ${
                        isDarkMode ? 'border-purple-500/30 text-purple-300/80 hover:bg-purple-500/10' : 'border-purple-300 text-purple-700 hover:bg-purple-50'
                      }`}
                    >
                      {reasoningExpandedMessageIds.has(msg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      <span>AI 思考过程</span>
                    </button>
                    {reasoningExpandedMessageIds.has(msg.id) && (
                      <div className={`mt-1 max-h-40 overflow-y-auto whitespace-pre-line rounded border p-1.5 text-[10px] italic leading-relaxed ${
                        isDarkMode ? 'border-[#343442] bg-[#1a1a22] text-slate-500' : 'border-slate-200 bg-slate-50 text-slate-500'
                      }`}>{msg.reasoningText}</div>
                    )}
                  </div>
                )}
                {msg.sender === 'ai'
                  ? <ChatMarkdown text={msg.text} isDarkMode={isDarkMode} />
                  : <span className="whitespace-pre-line">{msg.text}</span>}
                {isAiMessageCollapsed && (
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t to-transparent ${
                      isDarkMode ? 'from-[#25252b]' : 'from-slate-100'
                    }`}
                  />
                )}
              </div>
              {isAiMessageCollapsible && (
                <button
                  type="button"
                  aria-expanded={expandedMessageIds.has(msg.id)}
                  aria-label={expandedMessageIds.has(msg.id) ? '收起 AI 消息' : '展开 AI 消息'}
                  onClick={() => setExpandedMessageIds(previous => {
                    const next = new Set(previous);
                    if (next.has(msg.id)) next.delete(msg.id); else next.add(msg.id);
                    return next;
                  })}
                  className={`mt-2 inline-flex min-h-7 items-center gap-1 self-start rounded border px-2 text-[10px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                    isDarkMode
                      ? 'border-purple-500/40 text-purple-300 hover:bg-purple-500/10'
                      : 'border-purple-300 text-purple-700 hover:bg-purple-50'
                  }`}
                >
                  {expandedMessageIds.has(msg.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  <span>{expandedMessageIds.has(msg.id) ? '收起' : '展开全部'}</span>
                </button>
              )}
            </div>
            );
          })}
          {isAiResponding && (
            <div 
              className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-xs self-start mr-auto ${
                isDarkMode ? 'bg-[#25252b] border border-[#2d2d34] text-slate-400' : 'bg-slate-100 border border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-2 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-500" />
                <span>AI 正在思考中...</span>
              </div>
            </div>
          )}
        </div>

        {messageContextMenu && (
          <div
            role="menu"
            className={`fixed z-[100] min-w-28 rounded border p-1 text-xs shadow-xl ${isDarkMode ? 'border-slate-600 bg-[#25252b] text-slate-100' : 'border-slate-300 bg-white text-slate-800'}`}
            style={{ left: messageContextMenu.x, top: messageContextMenu.y }}
            onClick={event => event.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={() => void copyMessage()} className="w-full rounded px-2 py-1.5 text-left hover:bg-blue-500/20">复制消息</button>
          </div>
        )}

        {/* Chat Send Form */}
        <form
          onSubmit={handleSendChat}
          className={`relative p-3 border-t flex gap-1.5 shrink-0 items-end ${
            isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200'
          }`}
        >
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="调整输入框高度"
            title="上下拖拽调整输入框高度；双击恢复自动高度"
            onPointerDown={handleChatInputResizeStart}
            onPointerMove={handleChatInputResizeMove}
            onPointerUp={handleChatInputResizeEnd}
            onPointerCancel={handleChatInputResizeEnd}
            onDoubleClick={() => setChatInputHeight(null)}
            className="group absolute inset-x-0 top-0 z-10 flex h-2 cursor-row-resize touch-none items-center justify-center"
          >
            <span className={`h-0.5 w-10 rounded-full transition-colors ${
              isDarkMode ? 'bg-[#2d2d34] group-hover:bg-purple-400/70' : 'bg-slate-300 group-hover:bg-purple-400'
            }`} />
          </div>
          <textarea
            ref={chatInputRef}
            rows={1}
            placeholder={isLingCppFile ? '提问或明确描述要修改当前 .lcpp 文件的内容...（Enter 发送，Shift+Enter 换行）' : '问 AI 关于 C++ 中文编程的问题...（Enter 发送，Shift+Enter 换行）'}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={handleChatInputKeyDown}
            aria-label="向 AI 助手提问"
            style={chatInputHeight !== null ? { height: chatInputHeight, maxHeight: AI_CHAT_INPUT_MANUAL_MAX_HEIGHT } : undefined}
            className={`min-h-9 flex-1 resize-none overflow-y-auto border rounded px-3 py-2 text-xs leading-relaxed focus:outline-none focus:border-purple-500 ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
          <button
            type={isAiResponding ? 'button' : 'submit'}
            disabled={!isAiResponding && !chatInput.trim()}
            onClick={isAiResponding ? stopAiResponse : undefined}
            aria-label={isAiResponding ? '停止 AI 请求' : '发送 AI 请求'}
            title={isAiResponding ? '停止本次 AI 回复' : '发送 AI 请求'}
            className="flex min-h-9 min-w-9 items-center justify-center rounded bg-[#4f46e5] p-2 text-white transition-colors hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isAiResponding ? <Square className="h-3.5 w-3.5 fill-current" /> : <Send className="h-3.5 w-3.5" />}
          </button>
        </form>
      </div>
    </div>
  );
}

/** 从 ReactMarkdown 渲染结果里提取代码纯文本，供“复制”按钮使用。 */
function extractNodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractNodeText).join('');
  if (typeof node === 'object' && 'props' in (node as { props?: unknown })) {
    return extractNodeText((node as { props?: { children?: React.ReactNode } }).props?.children);
  }
  return '';
}

/** AI 回复中的代码块：带语言头部与一键复制，与模块文档预览的排版风格一致。 */
function ChatCodeBlock({ children, isDarkMode }: { children?: React.ReactNode; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const code = extractNodeText(children);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      // 剪贴板不可用时保持沉默；用户仍可手动选中文本复制。
    }
  };
  return (
    <div className={`my-1.5 select-text overflow-hidden rounded border ${isDarkMode ? 'border-[#343442] bg-[#11131a]' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`flex items-center justify-between border-b px-2 py-1 text-[9px] ${isDarkMode ? 'border-[#2a2a34] text-slate-500' : 'border-slate-200 text-slate-500'}`}>
        <span>代码</span>
        <button type="button" onClick={() => void copy()} className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-blue-500/20" aria-label="复制代码">{copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}{copied ? '已复制' : '复制'}</button>
      </div>
      <pre className="overflow-x-auto p-2 text-[10px] leading-relaxed font-mono">{children}</pre>
    </div>
  );
}

/** AI 回复正文：渲染 Markdown（代码块/列表/链接），用户消息仍保持纯文本。 */
function ChatMarkdown({ text, isDarkMode }: { text: string; isDarkMode: boolean }) {
  if (!text) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      skipHtml
      components={{
        p: props => <p className="my-1 break-words whitespace-pre-line" {...props} />,
        ul: props => <ul className="my-1 list-disc space-y-0.5 pl-4" {...props} />,
        ol: props => <ol className="my-1 list-decimal space-y-0.5 pl-4" {...props} />,
        a: props => <a className="text-sky-400 underline hover:text-sky-300" target="_blank" rel="noreferrer" {...props} />,
        pre: ({ children }) => <ChatCodeBlock isDarkMode={isDarkMode}>{children}</ChatCodeBlock>,
        code: ({ className, ...props }) => (
          <code
            className={className?.includes('language-') ? 'font-mono' : `rounded bg-black/20 px-1 py-0.5 font-mono text-[0.9em] ${isDarkMode ? '' : 'bg-slate-200/60'}`}
            {...props}
          />
        ),
        table: props => <div className="my-1.5 overflow-x-auto"><table className="w-full border-collapse text-left text-[10px]" {...props} /></div>
      }}
    >{text}</ReactMarkdown>
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
