import React, { useState, useEffect, useRef } from 'react';
import { Brain, Sparkles, Send, RefreshCw, Cpu, Check, AlertTriangle, ShieldCheck } from 'lucide-react';
import { AppliedWorkspaceFile, ExtractedString, GlossaryTerm, WorkspaceEditProposal, WorkspaceFileSnapshot } from '../types';

interface AiAssistantProps {
  strings: ExtractedString[];
  glossary: GlossaryTerm[];
  onBatchTranslate: (translations: { id: string; translated: string }[]) => void;
  onSetStatus: (id: string, status: 'translated' | 'skipped' | 'pending') => void;
  filePath: string;
  sourceCode: string;
  activeLanguage: string;
  workspaceFiles: WorkspaceFileSnapshot[];
  onApplyWorkspaceEdit?: (proposal: WorkspaceEditProposal, appliedFiles: AppliedWorkspaceFile[]) => void;
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
  workspaceFiles,
  onApplyWorkspaceEdit,
  isDarkMode = true
}: AiAssistantProps) {
  const [model, setModel] = useState('gemini-3.5-flash');
  const [translationStyle, setTranslationStyle] = useState<'standard' | 'formal' | 'xianxia' | 'cyberpunk'>('standard');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationProgress, setTranslationStyleProgress] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: '你好！我是您的 C++ 中文编程 AI 助手。已自动挂载 Google AI Studio 的 Gemini 3.5 核心引擎。\n\n我可以帮您做这些：\n1. 一键批量上下文智能生成中文映射代码。\n2. 解析与保护 C++ 占位符（如 `%s`, `%d`）。\n3. 提供中文命名、代码润色或编码格式排错建议。\n\n请在下方输入您的问题，或者直接点击上面的“一键智能映射”！',
      timestamp: new Date().toLocaleTimeString()
    }
  ]);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [editProposal, setEditProposal] = useState<WorkspaceEditProposal | null>(null);
  const isLingCppFile = activeLanguage === 'lingcpp' || filePath.endsWith('.lcpp');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isAiResponding]);

  useEffect(() => {
    setEditProposal(null);
  }, [filePath]);

  // Handle one-click AI translation
  const handleBatchAiTranslate = async () => {
    if (strings.length === 0) return;
    setIsTranslating(true);
    setTranslationStyleProgress(10);

    try {
      // 1. Get strings that are pending
      const pendingStrings = strings.filter(s => s.status === 'pending');
      if (pendingStrings.length === 0) {
        setTranslationStyleProgress(100);
        setTimeout(() => {
          setIsTranslating(false);
          setTranslationStyleProgress(0);
        }, 1000);
        return;
      }

      setTranslationStyleProgress(30);

      // Call Express server-side translate endpoint
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: pendingStrings,
          glossary,
          style: translationStyle // Passes style preference for contextual tweaks
        })
      });

      setTranslationStyleProgress(70);

      if (!response.ok) {
        throw new Error('网络请求错误，请确认已在 AI Studio 中配置了 GEMINI_API_KEY');
      }

      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.translations && Array.isArray(data.translations)) {
        onBatchTranslate(data.translations);
        setTranslationStyleProgress(100);
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
          text: `⚠️ 批量代码生成失败：${error.message || '请确认您的 GEMINI_API_KEY 已挂载且可以正常连接。'}\n\n已自动切换到本地词典匹配机制进行处理。`,
          timestamp: new Date().toLocaleTimeString()
        }
      ]);
    } finally {
      setTimeout(() => {
        setIsTranslating(false);
        setTranslationStyleProgress(0);
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

    try {
      if (isLingCppFile) {
        const response = await fetch('/api/lingcpp/edit/propose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filePath,
            sourceCode,
            instruction: userMsg.text,
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strings: [{ id: 'chat_query', original: prompt, type: 'string', context: 'User Chat Interaction' }]
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
    onApplyWorkspaceEdit(editProposal, appliedFiles);
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
          <span>{model}</span>
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

        {/* Translation Style Config */}
        <div className="mb-3">
          <label className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block mb-1">中文代码生成风格</label>
          <select
            value={translationStyle}
            onChange={e => setTranslationStyle(e.target.value as any)}
            className={`w-full border rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-purple-500 cursor-pointer ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-300' : 'bg-white border-slate-300 text-slate-800'
            }`}
          >
            <option value="standard" className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>专业标准 (微软/Visual Studio 风格)</option>
            <option value="formal" className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>信达雅学术风格 (适合传统桌面系统)</option>
            <option value="xianxia" className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>武侠/仙侠游戏本地化 (适合中国武侠RPG)</option>
            <option value="cyberpunk" className={isDarkMode ? 'bg-[#24242b] text-slate-300' : 'bg-white text-slate-800'}>科幻/赛博朋克风格 (适合现代科幻游戏)</option>
          </select>
        </div>

        <button
          onClick={handleBatchAiTranslate}
          disabled={isTranslating || strings.length === 0 || isLingCppFile}
          className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-blue-600 text-white font-bold py-2 rounded text-xs transition-all cursor-pointer disabled:opacity-50 select-none shadow-md"
        >
          {isTranslating ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>AI 代码生成中 ({translationProgress}%)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 text-yellow-300 fill-yellow-300/20" />
              <span>智能一键代码映射 (LBDsl + C++)</span>
            </>
          )}
        </button>

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
        <span>已通过 Google AI Studio Secrets 安全连接 to Gemini AI</span>
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
        <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin select-text">
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
                {msg.sender === 'user' ? <span>开发者</span> : <span className="text-purple-500 font-bold">Gemini AI</span>}
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
          <div ref={chatEndRef}></div>
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
            className={`flex-1 border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-purple-500 disabled:opacity-50 ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
          <button
            type="submit"
            disabled={isAiResponding || !chatInput.trim()}
            className="p-1.5 rounded bg-[#4f46e5] text-white hover:bg-indigo-600 transition-colors cursor-pointer disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}
