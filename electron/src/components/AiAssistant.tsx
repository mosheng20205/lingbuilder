import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { Brain, Send, Square, ChevronDown, ChevronUp, RefreshCw, Check, X, Plus, Trash2, Copy } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { AppliedWorkspaceFile, WorkspaceEditProposal, WorkspaceFileSnapshot } from '../types';
import type { LingWindowProject } from '../services/windowDesigner/types';
import type { ProjectMutationOwner } from '../services/workspace/projectMutationOwner';
import type { AiConversationStore } from '../services/ai/aiConversationService';
import { MAX_REASONING_CHARS } from '../services/ai/aiConversationService';
import type { CommandService } from '../services/commands/commandService';

/** 面板里「本机 Agent」模型通道的表单形态（与主进程 AgentProviderSettings 字段一致）。 */
type AgentProviderForm = {
  kind: 'deepseek-official' | 'custom-openai';
  baseUrl: string;
  model: string;
  apiKey: string;
  protocol: 'messages' | 'chat-completions';
};

function defaultAgentProviderForm(): AgentProviderForm {
  return { kind: 'deepseek-official', baseUrl: '', model: '', apiKey: '', protocol: 'messages' };
}

/** IPC 返回值形态；catch 分支必须带同样的可选字段，否则联合类型会丢属性。 */
type AgentProviderView = {
  ok: boolean;
  settings?: { kind: AgentProviderForm['kind']; baseUrl: string; model: string; apiKey: string; protocol?: 'messages' | 'chat-completions' };
  hasApiKey?: boolean;
  keyUnavailable?: boolean;
  problem?: string;
  error?: string;
};
type AgentRuntimeView = { ok: boolean; snapshot?: { provider?: string; model?: string }; error?: string };
type AgentProbeView = { ok: boolean; result?: unknown; error?: string };

const COLLAPSED_MESSAGE_HEIGHT = 224;

// 聊天输入框高度：自动模式跟随内容（含两行占位提示）完整显示，拖拽模式允许用户拉大。
const AI_CHAT_INPUT_AUTO_MAX_HEIGHT = 128;
const AI_CHAT_INPUT_MANUAL_MAX_HEIGHT = 320;
const AI_CHAT_INPUT_MIN_HEIGHT = 36;


/** 提案结果播报：如实区分「布局已改（应用后画布立即重绘）」与「界面未变（仅源码改动）」。 */
export function describeEditProposalOutcome(proposal: WorkspaceEditProposal): string {
  const outcome = proposal.designerProject
    ? '本次涉及窗口设计器布局改动，应用后界面设计器会立即重绘。'
    : proposal.designerUnchanged
      ? '界面布局未发生变化（本次仅源码改动）；如需改外观或布局，请点名要调整的控件与属性。'
      : '';
  return `本次涉及 ${proposal.changes.length} 个文件${outcome ? `；${outcome}` : ''}`;
}

/**
 * dsh 的 tool/call 把 callId 放在 data 顶层，tool/result 却只放在
 * `data.message.source.callId` / `content[].toolCallId` 里；只认顶层会让每次调用都停在未完成态。
 */
export function agentToolEventCallId(data: Record<string, unknown> | undefined): string {
  const message = data?.message as { source?: { callId?: unknown }; content?: Array<{ toolCallId?: unknown }> } | undefined;
  const direct = [data?.callId, message?.source?.callId].find(value => typeof value === 'string' && value);
  if (typeof direct === 'string') return direct;
  const nested = message?.content?.find(item => typeof item?.toolCallId === 'string' && item.toolCallId);
  return typeof nested?.toolCallId === 'string' ? nested.toolCallId : '';
}

interface AiAssistantProps {
  filePath: string;
  sourceCode: string;
  activeLanguage: string;
  projectId?: string;
  projectMutationOwner: ProjectMutationOwner;
  designerProject?: LingWindowProject;
  workspaceFiles: WorkspaceFileSnapshot[];
  /** 工作台转交的「交给本机 Agent」需求（模块面板 AI 生成模块）；消费后由 onAgentRequestHandled 认领。 */
  agentRequest?: { id: number; prompt: string; origin?: string } | null;
  onAgentRequestHandled?: (id: number) => void;
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
  filePath,
  sourceCode,
  activeLanguage,
  projectId,
  projectMutationOwner,
  designerProject,
  workspaceFiles,
  agentRequest,
  onAgentRequestHandled,
  onApplyWorkspaceEdit,
  precheckApplyWorkspaceEdit,
  commandService,
  isDarkMode = true
}: AiAssistantProps) {
  const [chatInput, setChatInput] = useState('');
  const [isAiConfigExpanded, setIsAiConfigExpanded] = useState(true);
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

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const messageContentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const conversationSaveTimerRef = useRef<number | undefined>(undefined);
  const chatHistoryRef = useRef<Message[]>(chatHistory);
  chatHistoryRef.current = chatHistory;
  // 挂载一次的云端事件监听通过 ref 读取最新值，避免每次按键都重新订阅并重复请求会话。
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;
  const activeConversationRef = useRef(activeConversation);
  activeConversationRef.current = activeConversation;
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);
  // 空输入时的自适应高度，即完整显示占位提示所需的最小高度，作为拖拽下限防止文字再次被裁。
  const chatInputAutoHeightRef = useRef(AI_CHAT_INPUT_MIN_HEIGHT);
  const chatInputResizeRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const chatAutoScrollRef = useRef(true);
  const confirmActionRef = useRef<{ kind: 'remove' | 'clear'; conversationId?: string; expiresAt: number } | null>(null);
  const confirmActionTimerRef = useRef<number | undefined>(undefined);

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
    setEditProposal(null);
  }, [filePath, projectMutationOwner.loadGeneration, projectMutationOwner.projectId]);

  // 本机 Agent 引擎（内嵌 DeepSeek Harness）：跨轮复用的会话与已接手的提案 ID。
  const agentSessionRef = useRef('');
  const handledAgentProposalsRef = useRef<Set<string>>(new Set());
  /** 本轮工具调用轨迹：只活在内存里，随会话切换丢弃（不写进会话存储，避免把工具结果正文持久化）。 */
  const [agentSteps, setAgentSteps] = useState<Array<{ callId: string; tool: string; done: boolean }>>([]);
  const [agentRuntimeStatus, setAgentRuntimeStatus] = useState<{
    state: string; nodeVersion: string; model: string; problem: string; pid: number | null;
  } | null>(null);
  const [agentStepsExpanded, setAgentStepsExpanded] = useState(true);

  useEffect(() => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime) return undefined;
    void runtime.status().then(snapshot => { if (snapshot) setAgentRuntimeStatus(snapshot); }).catch(() => undefined);
    const offStatus = runtime.onStatusChanged(snapshot => setAgentRuntimeStatus(snapshot));
    const offEvent = runtime.onEvent(({ event }) => {
      const data = (event.data || {}) as Record<string, unknown>;
      if (event.type === 'tool/call') {
        const callId = agentToolEventCallId(data);
        if (!callId) return;
        const tool = String(data.name || '').replace(/^mcp__lingbuilder__lingbuilder_/u, '').replace(/_[0-9a-f]{12}$/u, '');
        setAgentSteps(previous => (previous.some(step => step.callId === callId) ? previous : [...previous, { callId, tool, done: false }]));
        return;
      }
      if (event.type === 'tool/result') {
        const callId = agentToolEventCallId(data);
        if (!callId) return;
        setAgentSteps(previous => previous.map(step => (step.callId === callId ? { ...step, done: true } : step)));
      }
    });
    return () => { offStatus(); offEvent(); };
  }, []);

  const startAgentRuntime = async () => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime) return;
    const result = await runtime.start({});
    if (!result.ok) pushAgentNotice(`内嵌 Agent 启动失败：${result.error || '未知原因'}`);
  };

  const stopAgentRuntime = async () => {
    await window.lingBuilder?.agentRuntime?.stop();
    setAgentSteps([]);
  };

  /**
   * 本机 Agent 的模型通道配置。密钥只存主进程（safeStorage），渲染层拿到的读回值恒为空串，
   * 留空即表示沿用已保存的那份；拉模型列表与测连通也由主进程代调本地服务，密钥不回传。
   */
  const [agentProvider, setAgentProvider] = useState<AgentProviderForm>(defaultAgentProviderForm);
  const [agentProviderSaved, setAgentProviderSaved] = useState({ hasApiKey: false, keyUnavailable: false });
  const [agentProviderBusy, setAgentProviderBusy] = useState<'' | 'save' | 'models' | 'connect' | 'restart'>('');
  const [agentProviderMessage, setAgentProviderMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [agentProviderModels, setAgentProviderModels] = useState<string[]>([]);

  useEffect(() => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime?.getProviderSettings) return;
    void runtime.getProviderSettings().then(view => {
      const settings = view?.settings;
      if (!view?.ok || !settings) return;
      setAgentProvider(previous => ({
        ...previous,
        kind: settings.kind,
        baseUrl: settings.baseUrl || '',
        model: settings.model || '',
        protocol: settings.protocol || 'messages'
      }));
      setAgentProviderSaved({ hasApiKey: Boolean(view.hasApiKey), keyUnavailable: Boolean(view.keyUnavailable) });
    }).catch(() => undefined);
  }, []);

  const updateAgentProvider = (patch: Partial<AgentProviderForm>) => {
    setAgentProvider(previous => ({ ...previous, ...patch }));
    if (patch.baseUrl !== undefined || patch.kind !== undefined) setAgentProviderModels([]);
    setAgentProviderMessage(null);
  };

  const agentProviderPayload = () => ({ ...agentProvider, apiKey: agentProvider.apiKey.trim() });

  const saveAgentProvider = async () => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime?.setProviderSettings) return;
    setAgentProviderBusy('save');
    const result: AgentProviderView = await runtime.setProviderSettings(agentProviderPayload())
      .catch((error): AgentProviderView => ({ ok: false, error: String(error?.message || error) }));
    setAgentProviderBusy('');
    if (!result.ok || !result.settings) {
      setAgentProviderMessage({ tone: 'error', text: result.error || '模型配置保存失败。' });
      return;
    }
    setAgentProviderSaved({ hasApiKey: Boolean(result.hasApiKey), keyUnavailable: false });
    setAgentProvider(previous => ({ ...previous, apiKey: '' }));
    const running = agentRuntimeStatus?.state === 'running' || agentRuntimeStatus?.state === 'busy';
    setAgentProviderMessage({
      tone: 'ok',
      text: result.problem || (running ? '已保存。当前运行中的 Agent 仍在使用旧配置，点「重启生效」切换。' : '已保存，下次启动运行时生效。')
    });
  };

  const restartAgentProviderRuntime = async () => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime?.restart) return;
    setAgentProviderBusy('restart');
    const result: AgentRuntimeView = await runtime.restart()
      .catch((error): AgentRuntimeView => ({ ok: false, error: String(error?.message || error) }));
    setAgentProviderBusy('');
    setAgentProviderMessage(result.ok
      ? { tone: 'ok', text: `已按新配置重启运行时（${result.snapshot?.provider || ''} / ${result.snapshot?.model || ''}）。` }
      : { tone: 'error', text: result.error || '运行时重启失败。' });
  };

  const probeAgentProvider = async (action: 'models' | 'connect') => {
    const runtime = window.lingBuilder?.agentRuntime;
    if (!runtime?.probeProvider) return;
    setAgentProviderBusy(action);
    const result: AgentProbeView = await runtime.probeProvider({ action, ...agentProviderPayload() })
      .catch((error): AgentProbeView => ({ ok: false, error: String(error?.message || error) }));
    setAgentProviderBusy('');
    const payload = result.result as { models?: string[]; reply?: string; error?: string; details?: string } | undefined;
    if (action === 'models') {
      if (result.ok && Array.isArray(payload?.models)) {
        setAgentProviderModels(payload.models);
        setAgentProviderMessage(payload.models.length
          ? { tone: 'ok', text: `已获取 ${payload.models.length} 个模型，点击填入模型名。` }
          : { tone: 'error', text: '该地址未返回任何模型，请确认 Base URL 是否为 OpenAI 兼容的 /v1 端点。' });
      } else {
        setAgentProviderMessage({ tone: 'error', text: String(payload?.details || payload?.error || result.error || '获取模型列表失败。') });
      }
      return;
    }
    setAgentProviderMessage(result.ok
      ? { tone: 'ok', text: `连通正常：${payload?.reply || '模型已应答'}（模型 ${agentProvider.model || '默认'}）` }
      : { tone: 'error', text: String(payload?.details || payload?.error || result.error || '连接失败。') });
  };

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
    setAgentSteps([]);
    setAgentStepsExpanded(true);
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
        pushAgentNotice(`已生成可预览的编辑提案：${proposal.summary || proposal.id}
${describeEditProposalOutcome(proposal)}
请在上方差异预览后点击「应用提案」。`);
      }
    } catch {
      pushAgentNotice('未读取到内嵌 Agent 的提案交接内容（/api/lingcpp/edit/agent-proposal 不可用）。');
    }
  };

  // 单引擎提交：需求整体交给内嵌 Agent，面板不再本地判定「这是问答/编辑还是模块生成」。
  // 分类与工具选择由 Agent 自己决定；写盘与构建仍只在用户确认提案后由 IDE 代执行。
  const runChatTurn = async (rawText: string) => {
    const instruction = rawText.trim();
    if (!instruction || isAiResponding) return false;
    const userMsg: Message = createChatMessage('user', instruction);
    updateChatHistory(prev => [...prev, userMsg]);
    setIsAiResponding(true);
    try {
      await runAgentTurn(instruction);
    } catch (error) {
      pushAgentNotice(`内嵌 Agent 出错：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsAiResponding(false);
    }
    return true;
  };

  const runChatTurnRef = useRef(runChatTurn);
  runChatTurnRef.current = runChatTurn;
  const onAgentRequestHandledRef = useRef(onAgentRequestHandled);
  onAgentRequestHandledRef.current = onAgentRequestHandled;

  // 模块面板「AI 生成模块」把需求交给本机 Agent：工作台负责展开侧栏并把需求送进来，
  // 本面板是唯一执行入口，禁止任何面板再自建第二套编排或写盘路径。
  useEffect(() => {
    const request = agentRequest;
    if (!request) return;
    onAgentRequestHandledRef.current?.(request.id);
    void runChatTurnRef.current(request.prompt).then(accepted => {
      if (accepted) return;
      pushAgentNotice(`本机 Agent 正在执行上一条需求，「${request.origin || '模块面板'}」这次投来的需求已丢弃；请等本轮结束后重试。`);
    });
  }, [agentRequest]);

  const submitChatMessage = async () => {
    if (!chatInput.trim()) return;
    const instruction = chatInput;
    setChatInput('');
    await runChatTurn(instruction);
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

  // 内嵌 Agent 的单轮请求是同步 await 的，没有「中途取消」协议；
  // 停止即回收运行时（下一条需求会自动重启），并丢弃本轮会话上下文。
  const stopAiResponse = () => {
    if (!isAiResponding) return;
    agentSessionRef.current = '';
    void stopAgentRuntime();
    setIsAiResponding(false);
    updateChatHistory(previous => [...previous, createChatMessage('ai', '已停止本次 Agent 执行，内嵌运行时已回收；再次发送需求会自动重启。', { contextExcluded: true })]);
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

      {/* AI 引擎与模型通道设置 */}
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
            <>
            <div className={`flex items-center gap-2 rounded border px-2 py-1.5 text-[10px] ${isDarkMode ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50'}`}>
              <span className={`inline-flex min-h-5 items-center gap-1 rounded px-1.5 font-semibold ${agentRuntimeStatus?.state === 'failed' ? 'bg-rose-600 text-white' : agentRuntimeStatus?.state === 'running' || agentRuntimeStatus?.state === 'busy' ? 'bg-emerald-600 text-white' : 'bg-slate-500/20 text-slate-500'}`}>
                <Brain className="h-3 w-3" />
                {{ stopped: '未启动', starting: '启动中', running: '待命', busy: '执行中', stopping: '停止中', failed: '启动失败' }[agentRuntimeStatus?.state || 'stopped'] || agentRuntimeStatus?.state}
              </span>
              <span className="truncate text-slate-400">
                {agentRuntimeStatus?.state === 'running' || agentRuntimeStatus?.state === 'busy'
                  ? `Node ${agentRuntimeStatus.nodeVersion || '?'} · ${agentRuntimeStatus.model || '?'} · PID ${agentRuntimeStatus.pid ?? '?'}`
                  : (agentRuntimeStatus?.problem || '内嵌 DeepSeek Harness 运行时，经 LingBuilder MCP 干活；写盘与构建由你确认后代执行。')}
              </span>
              {agentRuntimeStatus?.state === 'stopped' || agentRuntimeStatus?.state === 'failed' ? (
                <button type="button" onClick={() => void startAgentRuntime()} className="ml-auto min-h-6 shrink-0 rounded bg-emerald-600 px-2 font-semibold text-white hover:bg-emerald-500">启动</button>
              ) : (
                <button type="button" onClick={() => void stopAgentRuntime()} className="ml-auto min-h-6 shrink-0 rounded bg-slate-500/20 px-2 font-semibold text-slate-500 hover:bg-slate-500/30">停止</button>
              )}
            </div>
            <div className="mt-2 space-y-2">
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>模型通道</span>
                <select
                  value={agentProvider.kind}
                  onChange={event => updateAgentProvider({ kind: event.target.value as AgentProviderForm['kind'] })}
                  className={`w-full min-h-7 cursor-pointer border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'}`}
                >
                  <option value="deepseek-official">DeepSeek 官方（推荐，与本机 Agent 默认一致）</option>
                  <option value="custom-openai">自定义 API（OpenAI 兼容网关）</option>
                </select>
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>API 地址</span>
                <input
                  value={agentProvider.baseUrl}
                  onChange={event => updateAgentProvider({ baseUrl: event.target.value })}
                  placeholder={agentProvider.kind === 'custom-openai' ? 'https://你的网关/v1' : '留空使用 https://api.deepseek.com'}
                  className={`w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  API Key{agentProviderSaved.hasApiKey && !agentProvider.apiKey ? '（已保存，留空则不修改）' : ''}
                </span>
                <input
                  type="password"
                  value={agentProvider.apiKey}
                  onChange={event => updateAgentProvider({ apiKey: event.target.value })}
                  placeholder={agentProviderSaved.hasApiKey ? '已保存 ••••••••' : 'sk-…'}
                  className={`w-full border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                />
                {agentProviderSaved.keyUnavailable && (
                  <p className="mt-0.5 text-[10px] text-amber-500">本机系统凭据存储不可用，已保存的密钥读不出来；重新填写并保存可修复。</p>
                )}
              </div>
              <div>
                <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>模型名</span>
                <div className="flex items-center gap-1">
                  <input
                    value={agentProvider.model}
                    onChange={event => updateAgentProvider({ model: event.target.value })}
                    placeholder={agentProvider.kind === 'custom-openai' ? '先点右侧「模型」自动填' : 'deepseek-v4-flash'}
                    className={`min-w-0 flex-1 border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'}`}
                  />
                  <button
                    type="button"
                    onClick={() => void probeAgentProvider('models')}
                    disabled={Boolean(agentProviderBusy) || agentProviderBusy === 'models'}
                    title="按当前地址与密钥拉取模型列表（OpenAI 兼容 GET /models）"
                    className={`min-h-6 shrink-0 rounded px-2 text-[10px] font-semibold ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:opacity-50`}
                  >{agentProviderBusy === 'models' ? '获取中…' : '模型'}</button>
                </div>
                {agentProviderModels.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                    {agentProviderModels.slice(0, 60).map(model => (
                      <button
                        key={model}
                        type="button"
                        onClick={() => updateAgentProvider({ model })}
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${model === agentProvider.model ? 'border-emerald-500 text-emerald-500' : isDarkMode ? 'border-[#2d2d34] text-slate-400 hover:text-slate-200' : 'border-slate-300 text-slate-500 hover:text-slate-800'}`}
                      >{model}</button>
                    ))}
                  </div>
                )}
              </div>
              {agentProvider.kind === 'deepseek-official' && (
                <div>
                  <span className={`mb-1 block text-[11px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>接口协议</span>
                  <select
                    value={agentProvider.protocol}
                    onChange={event => updateAgentProvider({ protocol: event.target.value as AgentProviderForm['protocol'] })}
                    className={`w-full min-h-7 cursor-pointer border rounded px-2 py-1 text-[11px] focus:outline-none focus:border-emerald-500 ${isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'}`}
                  >
                    <option value="messages">messages（Anthropic 风格，DeepSeek 官方默认）</option>
                    <option value="chat-completions">chat-completions（OpenAI 风格）</option>
                  </select>
                </div>
              )}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => void saveAgentProvider()}
                  disabled={Boolean(agentProviderBusy)}
                  className="min-h-6 rounded bg-emerald-600 px-2 text-[10px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >{agentProviderBusy === 'save' ? '保存中…' : '保存配置'}</button>
                <button
                  type="button"
                  onClick={() => void probeAgentProvider('connect')}
                  disabled={Boolean(agentProviderBusy)}
                  className={`min-h-6 rounded px-2 text-[10px] font-semibold ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:opacity-50`}
                >{agentProviderBusy === 'connect' ? '测试中…' : '测试连通'}</button>
                {(agentRuntimeStatus?.state === 'running' || agentRuntimeStatus?.state === 'busy') && (
                  <button
                    type="button"
                    onClick={() => void restartAgentProviderRuntime()}
                    disabled={Boolean(agentProviderBusy)}
                    className={`min-h-6 rounded px-2 text-[10px] font-semibold ${isDarkMode ? 'bg-slate-700 text-slate-200 hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'} disabled:opacity-50`}
                  >{agentProviderBusy === 'restart' ? '重启中…' : '重启生效'}</button>
                )}
              </div>
              {agentProviderMessage && (
                <p className={`text-[10px] leading-relaxed ${agentProviderMessage.tone === 'ok' ? 'text-emerald-500' : 'text-rose-500'}`}>{agentProviderMessage.text}</p>
              )}
              <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                配置由 LingBuilder 加密保存在本机，只注入内嵌 Agent 子进程，不会写入日志或随项目分发。
                运行时由 <span className="font-mono">DeepSeek Harness</span> 提供 ·{' '}
                <a
                  href="https://github.com/deepseek-ai/deepseek-harness"
                  target="_blank"
                  rel="noreferrer"
                  className="underline decoration-dotted hover:text-emerald-500"
                >官方仓库</a>
              </p>
            </div>
            </>
          )}
        </div>
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
          {agentSteps.length > 0 && (
            <div className={`rounded border p-2 text-[10px] ${isDarkMode ? 'border-[#2a3240] bg-[#11131a]' : 'border-slate-200 bg-slate-50'}`}>
              <button
                type="button"
                className="flex w-full items-center gap-1 font-semibold text-emerald-400"
                aria-expanded={agentStepsExpanded}
                onClick={() => setAgentStepsExpanded(value => !value)}
              >
                {agentStepsExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                <span>本轮 LingBuilder 工具调用（{agentSteps.filter(step => step.done).length}/{agentSteps.length}）</span>
              </button>
              {agentStepsExpanded && (
                <ol className="mt-1.5 space-y-1">
                  {agentSteps.map(step => (
                    <li key={step.callId} className="flex items-center gap-1.5 font-mono">
                      <span className={step.done ? 'text-emerald-500' : 'animate-pulse text-amber-400'}>{step.done ? '✓' : '●'}</span>
                      <span className="truncate text-slate-400">{step.tool}</span>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-1.5 text-[9px] text-slate-500">写盘与构建不在此列：提案需你在下方确认后由 IDE 代执行。</div>
            </div>
          )}
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
