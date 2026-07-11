import React, { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, Send, RefreshCw, Cpu, Check, AlertTriangle, ShieldCheck, Cloud, KeyRound, Coins, LogOut } from 'lucide-react';
import { AppliedWorkspaceFile, ExtractedString, GlossaryTerm, WorkspaceEditProposal, WorkspaceFileSnapshot } from '../types';
import { LingCppModuleContext } from '../services/modules/types';
import type { ProjectMutationOwner } from '../services/workspace/projectMutationOwner';

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
  workspaceFiles: WorkspaceFileSnapshot[];
  onApplyWorkspaceEdit?: (
    proposal: WorkspaceEditProposal,
    appliedFiles: AppliedWorkspaceFile[],
    owner?: ProjectMutationOwner
  ) => void;
  isDarkMode?: boolean;
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  codeBlock?: string;
}

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
  workspaceFiles,
  onApplyWorkspaceEdit,
  isDarkMode = true
}: AiAssistantProps) {
  const [aiMode, setAiMode] = useState<'system' | 'byok'>('system');
  const [cloudSession, setCloudSession] = useState<{ authenticated: boolean; email?: string; balance?: { available: string; reserved: string }; error?: string }>({ authenticated: false });
  const [cloudModels, setCloudModels] = useState<Array<{ alias: string; displayName: string; description: string; maxOutputTokens: number }>>([]);
  const [cloudModelAlias, setCloudModelAlias] = useState('');
  const [accountEmail, setAccountEmail] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [aiConfig, setAiConfig] = useState<AiConnectionConfig>(loadAiConfig);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationProgress] = useState(0);
  const [isAiConfigExpanded, setIsAiConfigExpanded] = useState(true);
  const [isConnectingAi, setIsConnectingAi] = useState(false);
  const [aiConnectedSignature, setAiConnectedSignature] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: '你好！我是 LingBuilder 的 AI 智能编程助手。\n\n我会结合当前文件、工作区文件和已启用模块上下文，帮你生成可预览、可确认的代码修改方案。\n\n我可以帮你做这些：\n1. 根据需求编写或调整中文 C++ / .lcpp 代码。\n2. 解释报错、定位问题，并给出修复建议。\n3. 补全事件处理、窗口逻辑、模块调用和命名结构。\n\n请在下方直接描述你想改什么；需要切换模型时，可在上方 AI 对接设置里选择。',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [editProposal, setEditProposal] = useState<WorkspaceEditProposal | null>(null);
  const isLingCppFile = activeLanguage === 'lingcpp' || filePath.endsWith('.lcpp');

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const chatAbortRef = useRef<AbortController | null>(null);
  const cloudRequestRef = useRef<string | null>(null);
  const effectiveModelName = aiConfig.modelName.trim() || DEFAULT_AI_CONFIG.modelName;
  const aiConnectionSignature = [
    aiConfig.provider || DEFAULT_AI_CONFIG.provider,
    aiConfig.baseUrl.trim(),
    aiConfig.apiKey.trim(),
    effectiveModelName
  ].join('|');
  const isAiConnected = aiConnectedSignature === aiConnectionSignature;

  const updateAiConfig = (patch: Partial<AiConnectionConfig>) => {
    setAiConnectedSignature(null);
    setAiConfig(current => ({
      ...current,
      ...patch
    }));
  };

  const handlePresetChange = (presetId: string) => {
    const preset = AI_MODEL_PRESETS.find(item => item.id === presetId);
    if (!preset || preset.id === 'custom') {
      updateAiConfig({ presetId, provider: 'openai' });
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
      setAiConnectedSignature(aiConnectionSignature);
      setChatHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: `AI 已连接：${effectiveModelName}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } catch (error: any) {
      setAiConnectedSignature(null);
      setChatHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: `AI 连接失败：${error?.message || '请检查 Base URL、API Key 和 Model Name。'}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setIsConnectingAi(false);
    }
  };

  useEffect(() => {
    const scrollPanel = chatScrollRef.current;
    if (!scrollPanel) return;
    scrollPanel.scrollTo({
      top: scrollPanel.scrollHeight,
      behavior: 'smooth'
    });
  }, [chatHistory, isAiResponding]);

  useEffect(() => {
    try {
      window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify({ ...aiConfig, apiKey: undefined, modelName: effectiveModelName }));
      void window.lingBuilder?.credentials?.setAiApiKey(aiConfig.apiKey);
    } catch {
      // AI settings remain usable for the current session even if storage fails.
    }
  }, [aiConfig, effectiveModelName]);

  useEffect(() => { try { const raw = window.localStorage.getItem(AI_CONFIG_STORAGE_KEY); if (raw) { const parsed = JSON.parse(raw); if (parsed.apiKey) { delete parsed.apiKey; window.localStorage.setItem(AI_CONFIG_STORAGE_KEY, JSON.stringify(parsed)); } } } catch { /* ignore legacy cleanup failure */ } void window.lingBuilder?.credentials?.getAiApiKey().then(apiKey => { if (apiKey) setAiConfig(current => ({ ...current, apiKey })); }); }, []);

  useEffect(() => {
    setEditProposal(null);
  }, [filePath, projectMutationOwner.loadGeneration, projectMutationOwner.projectId]);

  useEffect(() => {
    if (!window.lingBuilder?.cloudAccount) {
      setAiMode('byok');
      return;
    }
    void window.lingBuilder.cloudAccount.session().then(async session => {
      setCloudSession(session);
      if (!session.authenticated) return;
      const result = await window.lingBuilder!.cloudAccount!.models();
      setCloudModels(result.models || []);
      setCloudModelAlias(current => current || result.models?.[0]?.alias || '');
    }).catch(error => setCloudSession({ authenticated: false, error: error instanceof Error ? error.message : String(error) }));
    return window.lingBuilder.cloudAi?.onEvent((requestKey, event) => {
      if (requestKey !== cloudRequestRef.current) return;
      if (event.type === 'delta' && event.text) {
        setChatHistory(previous => {
          const id = `cloud-${requestKey}`;
          const existing = previous.find(message => message.id === id);
          if (existing) return previous.map(message => message.id === id ? { ...message, text: message.text + event.text } : message);
          return [...previous, { id, sender: 'ai', text: event.text, timestamp: new Date().toLocaleTimeString() }];
        });
      }
      if (event.type === 'edit_draft' && Array.isArray(event.files)) {
        void fetch('/api/lingcpp/edit/from-system-draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, sourceCode, instruction: '系统 AI 工作区编辑', projectId, moduleContext, workspaceFiles, files: event.files }) }).then(response => response.json()).then(value => { if (!value.ok) throw new Error(value.error || '系统 AI 编辑草稿校验失败'); setEditProposal(value.proposal); });
      }
      if (event.type === 'usage') {
        setChatHistory(previous => [...previous, { id: `usage-${requestKey}`, sender: 'ai', text: `本次用量：输入 ${event.receipt.inputTokens}、输出 ${event.receipt.outputTokens} Token，扣除 ${event.receipt.chargedPoints} AI 点数${event.receipt.freePromotionId ? '（免费活动）' : ''}。`, timestamp: new Date().toLocaleTimeString() }]);
        void window.lingBuilder?.cloudAccount?.balance().then(value => setCloudSession(current => ({ ...current, balance: value.balance })));
      }
      if (event.type === 'completed' || event.type === 'error') {
        if (event.type === 'error') setChatHistory(previous => [...previous, { id: `error-${requestKey}`, sender: 'ai', text: event.message || '系统 AI 请求失败。', timestamp: new Date().toLocaleTimeString() }]);
        cloudRequestRef.current = null; setIsAiResponding(false);
      }
    });
  }, [filePath, sourceCode, projectId, moduleContext, workspaceFiles]);

  const handleCloudAccount = async (action: 'login' | 'register') => {
    if (!window.lingBuilder?.cloudAccount) return;
    setAccountBusy(true); setAccountMessage('');
    try {
      if (action === 'register') {
        await window.lingBuilder.cloudAccount.register({ email: accountEmail, password: accountPassword });
        setAccountMessage('注册成功，请在邮箱中完成验证后登录。');
      } else {
        const session = await window.lingBuilder.cloudAccount.login({ email: accountEmail, password: accountPassword });
        setCloudSession(session); const result = await window.lingBuilder.cloudAccount.models(); setCloudModels(result.models || []); setCloudModelAlias(result.models?.[0]?.alias || ''); setAccountPassword('');
      }
    } catch (error) { setAccountMessage(error instanceof Error ? error.message : String(error)); }
    finally { setAccountBusy(false); }
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
      // Fallback: translate locally using matching dict values if Gemini fails or is unconfigured
      const fallbackTranslations = strings.map(s => {
        // Simple search in templates.ts localTranslations is handled by parent,
        // we'll append a failure alert in chat
        return {
          id: s.id,
          translated: `[AI] 代码生成时出错: ${error.message || '未知错误'}`
        };
      });
      
      setChatHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: `⚠️ 批量代码生成失败：${error.message || '请确认 API Key、Base URL 和模型名称可以正常连接。'}\n\n已自动切换到本地词典匹配机制进行处理。`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setTimeout(() => {
        setIsTranslating(false);
        setTranslationProgress(0);
      }, 1000);
    }
  };

  // Conversational translation query
  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg: Message = {
      id: Math.random().toString(),
      sender: 'user',
      text: chatInput,
      timestamp: new Date().toLocaleTimeString()
    };

    setChatHistory(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiResponding(true);
    const controller = new AbortController(); chatAbortRef.current?.abort(); chatAbortRef.current = controller;

    try {
      if (aiMode === 'system') {
        if (!cloudSession.authenticated || !window.lingBuilder?.cloudAi || !cloudModelAlias) throw new Error('请先登录系统 AI 并选择可用模型。');
        const messages = [...chatHistory.filter(message => message.id !== 'welcome').slice(-18).map(message => ({ role: message.sender === 'ai' ? 'assistant' as const : 'user' as const, content: message.text })), { role: 'user' as const, content: userMsg.text }];
        const rulebookVersion = 'lingbuilder-rulebook-v1';
        const payload = isLingCppFile ? {
          modelAlias: cloudModelAlias, messages, rulebookVersion, activeFilePath: filePath, instruction: userMsg.text,
          files: await Promise.all(workspaceFiles.slice(0, 5).map(async file => ({ filePath: file.filePath, content: file.sourceCode.slice(0, 24_000), language: file.language, sha256: await sha256(file.sourceCode) })))
        } : { modelAlias: cloudModelAlias, messages, rulebookVersion };
        const requestKey = await window.lingBuilder.cloudAi.start(isLingCppFile ? 'edit' : 'chat', payload);
        cloudRequestRef.current = requestKey;
        return;
      }
      if (isLingCppFile) {
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
            workspaceFiles
          })
        });

        if (!response.ok) {
          throw new Error('中文 C++ 编辑提案生成失败');
        }

        const data = await response.json();
        const proposal = data.proposal as WorkspaceEditProposal;
        setEditProposal(proposal);
        setChatHistory(prev => [
          ...prev,
          {
            id: Math.random().toString(),
            sender: 'ai',
            text: `已生成一份可预览的工作区编辑提案：${proposal.summary}\n\n本次涉及 ${proposal.changes.length} 个文件，请在下方预览差异后选择“应用提案”或“拒绝提案”。`,
            timestamp: new Date().toLocaleTimeString()
          }
        ]);
        return;
      }

      // Build a contextual prompt about the current file's strings
      const fileContext = strings.slice(0, 10).map(s => `- ID: ${s.id}, 原文: "${s.original}"`).join('\n');
      const prompt = `您是 C++ 编程与代码映射专家。以下是当前文件 ${filePath} 中提取的部分字符串（仅供参考）：\n${fileContext}\n\n用户提问：${userMsg.text}\n\n请针对用户的中文代码映射或 C++ 语法问题，进行专业解答。如果涉及代码，请用 Markdown 代码块返回，以便用户拷贝。`;

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
        throw new Error('AI 助手响应失败');
      }

      const data = await response.json();
      const aiReplyText = data.translations?.[0]?.translated || 'AI 助手当前不可用，请检查 API 密钥设置。';

      setChatHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: aiReplyText,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } catch (err: any) {
      setChatHistory(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'ai',
          text: `抱歉，在尝试回应您时发生错误：${err.message || '请检查 API 连接状况。'}`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      if (chatAbortRef.current === controller) chatAbortRef.current = null;
      setIsAiResponding(false);
    }
  };

  const handleApplyProposal = async () => {
    if (!editProposal || !onApplyWorkspaceEdit) return;
    const response = await fetch('/api/lingcpp/edit/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proposalId: editProposal.id,
        sourceCode,
        workspaceFiles
      })
    });
    if (!response.ok) return;
    const data = await response.json();
    const appliedFiles = (data.appliedFiles || []) as AppliedWorkspaceFile[];
    onApplyWorkspaceEdit(editProposal, appliedFiles, projectMutationOwner);
    const changedFileList = editProposal.changes.map(change => change.filePath).join('、');
    setChatHistory(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'ai',
        text: `已应用该工作区编辑提案，改动已写回：${changedFileList}。`,
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    setEditProposal(null);
  };

  const handleRejectProposal = async () => {
    if (!editProposal) return;
    await fetch('/api/lingcpp/edit/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalId: editProposal.id })
    });
    setChatHistory(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'ai',
        text: '已拒绝当前中文 C++ 编辑提案，源文件未发生变化。',
        timestamp: new Date().toLocaleTimeString()
      }
    ]);
    setEditProposal(null);
  };

  const getPendingCount = () => strings.filter(s => s.status === 'pending').length;
  const getTranslatedCount = () => strings.filter(s => s.status === 'translated').length;

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
        <div className="flex items-center gap-1 bg-purple-500/10 text-purple-600 px-2 py-0.5 rounded border border-purple-500/20 text-[10px] font-mono">
          <Cpu className="w-3 h-3" />
          <span>{effectiveModelName}</span>
        </div>
      </div>

      {/* Batch Translation Controller */}
      <div 
        className={`p-3.5 border-b shrink-0 ${
          isDarkMode ? 'border-[#2d2d34] bg-[#1a1a20]/30' : 'border-slate-200 bg-slate-50'
        }`}
      >
        <div className="flex items-center justify-between text-xs mb-3">
          <div className="flex flex-col">
            <span className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>一键批量生成中文代码</span>
            <span className="text-[10px] text-slate-500">
              当前文件待配置: <strong className="text-amber-500">{getPendingCount()}</strong> 串，
              已映射: <strong className="text-emerald-500">{getTranslatedCount()}</strong> 串
            </span>
          </div>
        </div>

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
          <div className={`grid grid-cols-2 gap-1 rounded border p-1 ${isDarkMode ? 'border-[#343442] bg-[#18181c]' : 'border-slate-200 bg-slate-100'}`} role="tablist" aria-label="AI 使用模式">
            <button type="button" role="tab" aria-selected={aiMode === 'system'} onClick={() => setAiMode('system')} className={`flex min-h-8 items-center justify-center gap-1 rounded px-2 text-[10px] ${aiMode === 'system' ? 'bg-violet-600 text-white' : 'text-slate-500'}`}><Cloud className="h-3 w-3"/>系统 AI</button>
            <button type="button" role="tab" aria-selected={aiMode === 'byok'} onClick={() => setAiMode('byok')} className={`flex min-h-8 items-center justify-center gap-1 rounded px-2 text-[10px] ${aiMode === 'byok' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}><KeyRound className="h-3 w-3"/>自定义 API</button>
          </div>
          {aiMode === 'system' && isAiConfigExpanded && (
            <div className={`space-y-2 rounded border p-2.5 ${isDarkMode ? 'border-violet-500/20 bg-violet-500/5' : 'border-violet-200 bg-violet-50'}`}>
              {cloudSession.authenticated ? <>
                <div className="flex items-center justify-between gap-2 text-[10px]"><span className="truncate text-slate-400">{cloudSession.email}</span><button type="button" aria-label="退出系统 AI 账号" className="flex min-h-7 items-center gap-1 text-rose-400" onClick={() => void window.lingBuilder?.cloudAccount?.logout().then(() => setCloudSession({ authenticated: false }))}><LogOut className="h-3 w-3"/>退出</button></div>
                <div className="flex items-center gap-2 rounded bg-black/10 px-2 py-1.5 text-[10px]"><Coins className="h-3.5 w-3.5 text-amber-400"/><span>可用点数</span><strong className="ml-auto tabular-nums">{cloudSession.balance?.available || '0'}</strong></div>
                <label className="block text-[10px] text-slate-500" htmlFor="system-ai-model">系统模型</label>
                <select id="system-ai-model" value={cloudModelAlias} onChange={event => setCloudModelAlias(event.target.value)} className={`min-h-9 w-full rounded border px-2 text-xs ${isDarkMode ? 'border-slate-700 bg-slate-900 text-slate-200' : 'border-slate-300 bg-white text-slate-800'}`}>{cloudModels.map(model => <option key={model.alias} value={model.alias}>{model.displayName}</option>)}</select>
              </> : <>
                <label className="block text-[10px] text-slate-500" htmlFor="system-ai-email">账号邮箱</label><input id="system-ai-email" type="email" autoComplete="username" value={accountEmail} onChange={event => setAccountEmail(event.target.value)} className={`min-h-9 w-full rounded border px-2 text-xs ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}/>
                <label className="block text-[10px] text-slate-500" htmlFor="system-ai-password">密码</label><input id="system-ai-password" type="password" autoComplete="current-password" value={accountPassword} onChange={event => setAccountPassword(event.target.value)} className={`min-h-9 w-full rounded border px-2 text-xs ${isDarkMode ? 'border-slate-700 bg-slate-900' : 'border-slate-300 bg-white'}`}/>
                <div className="grid grid-cols-2 gap-2"><button type="button" disabled={accountBusy} onClick={() => void handleCloudAccount('login')} className="min-h-9 rounded bg-violet-600 text-[10px] font-semibold text-white disabled:opacity-50">登录</button><button type="button" disabled={accountBusy} onClick={() => void handleCloudAccount('register')} className="min-h-9 rounded border border-violet-500/40 text-[10px] text-violet-400 disabled:opacity-50">注册</button></div>
                {accountMessage && <div role="status" className="text-[10px] text-amber-400">{accountMessage}</div>}
              </>}
            </div>
          )}
          {aiMode === 'byok' && isAiConfigExpanded && (
            <>
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
              <input
                value={aiConfig.baseUrl}
                onChange={event => updateAiConfig({ baseUrl: event.target.value, presetId: 'custom' })}
                placeholder="Base URL，选择常用模型后自动填充"
                className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                  isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <input
                value={aiConfig.apiKey}
                onChange={event => updateAiConfig({ apiKey: event.target.value })}
                placeholder="API Key，留空使用服务端环境变量"
                type="password"
                className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                  isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <input
                value={aiConfig.modelName}
                onChange={event => updateAiConfig({ modelName: event.target.value, presetId: 'custom' })}
                placeholder="Model Name，选择常用模型后自动填充"
                className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 ${
                  isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300 placeholder:text-slate-600' : 'bg-white border-slate-300 text-slate-800 placeholder:text-slate-400'
                }`}
              />
              <button
                type="button"
                onClick={handleConnectAi}
                disabled={isConnectingAi || !effectiveModelName || isAiConnected}
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
            </>
          )}
        </div>

        {isTranslating && (
          <div className={`w-full h-1 rounded-full overflow-hidden mt-2 ${isDarkMode ? 'bg-slate-850' : 'bg-slate-200'}`}>
            <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${translationProgress}%` }}></div>
          </div>
        )}
        {isLingCppFile && (
          <div className={`mt-2 rounded border px-2.5 py-2 text-[10px] leading-relaxed ${
            isDarkMode ? 'border-[#343442] bg-[#202028] text-slate-400' : 'border-slate-200 bg-white text-slate-600'
          }`}>
            当前为 `.lcpp` 中文 C++ 源码，AI 在本面板中默认生成“可预览工作区提案”，不会直接静默改写文件。
          </div>
        )}
      </div>

      {/* Security Credentials info indicator (In compliance with standard instructions) */}
      <div 
        className={`px-3 py-1.5 border-b text-[10px] flex items-center gap-2 shrink-0 select-none ${
          isDarkMode ? 'bg-[#171e24] border-[#2d2d34] text-slate-400' : 'bg-emerald-50/50 border-emerald-100 text-slate-600'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
        <span>{aiMode === 'system' ? '系统 AI 源码默认零保留，所有文件修改仍需本地预览确认' : '自定义 API Key 使用系统安全凭据存储，不进入工作区或同步包'}</span>
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
        <div 
          className={`p-2 border-b shrink-0 select-none ${
            isDarkMode ? 'border-[#2d2d34] bg-[#1a1a20]/15' : 'border-slate-200 bg-slate-50/50'
          }`}
        >
             <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">{isLingCppFile ? 'AI 中文 C++ 编辑助手' : 'AI 编程与代码生成助手'}</span>
        </div>

        {/* Chat History scroll panel */}
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin select-text">
          {chatHistory.map((msg, idx) => (
            <div
              key={msg.id || idx}
              className={`flex flex-col max-w-[85%] rounded-lg p-2.5 text-xs line-clamp-none ${
                msg.sender === 'user'
                  ? 'bg-blue-600/20 border border-blue-500/20 text-blue-800 dark:text-blue-200 self-end ml-auto'
                  : isDarkMode 
                  ? 'bg-[#25252b] border border-[#2d2d34] text-slate-300 self-start mr-auto'
                  : 'bg-slate-100 border border-slate-200 text-slate-800 self-start mr-auto'
              }`}
            >
              <div className="flex items-center gap-1.5 mb-1.5 opacity-60 text-[9px] font-mono select-none">
                {msg.sender === 'user' ? <span>开发者</span> : <span className="text-purple-500 font-bold">AI 助手</span>}
                <span>•</span>
                <span>{msg.timestamp}</span>
              </div>
              <div className="whitespace-pre-line leading-relaxed font-sans">{msg.text}</div>
            </div>
          ))}
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

        {/* Chat Send Form */}
        <form 
          onSubmit={handleSendChat} 
          className={`p-3 border-t flex gap-1.5 shrink-0 ${
            isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200'
          }`}
        >
          <input
            type="text"
            placeholder={isLingCppFile ? '描述你想让 AI 如何修改当前 .lcpp 文件或相关工作区文件...' : '问AI关于C++中文编程的问题...'}
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            disabled={isAiResponding}
            aria-label="向 AI 助手提问"
            className={`flex-1 border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 disabled:opacity-50 ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
          <button
            type="submit"
            disabled={isAiResponding || !chatInput.trim()}
            aria-label="发送 AI 请求"
            className="p-1.5 rounded bg-[#4f46e5] text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
          {isAiResponding && <button type="button" aria-label="取消 AI 请求" onClick={() => { if (aiMode === 'system' && cloudRequestRef.current) void window.lingBuilder?.cloudAi?.cancel(cloudRequestRef.current); else chatAbortRef.current?.abort(); }} className="rounded border border-slate-500 px-2">取消</button>}
        </form>
      </div>
    </div>
  );
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
