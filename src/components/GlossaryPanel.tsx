import React, { useState } from 'react';
import { BookOpen, Plus, Trash2, Search, Import, Check } from 'lucide-react';
import { GlossaryTerm } from '../types';

interface GlossaryPanelProps {
  glossary: GlossaryTerm[];
  onAddTerm: (term: GlossaryTerm) => void;
  onDeleteTerm: (english: string) => void;
  onImportDictionary: (name: string, terms: GlossaryTerm[]) => void;
  isDarkMode?: boolean;
}

const DICTIONARY_PRESETS = [
  {
    name: 'Windows SDK & MFC 经典术语库',
    icon: '💻',
    terms: [
      { english: 'handle', chinese: '句柄', description: 'Windows system reference pointer' },
      { english: 'message loop', chinese: '消息循环', description: 'Windows system event dispatcher' },
      { english: 'callback', chinese: '回调函数', description: 'User defined function triggered by OS' },
      { english: 'dialog', chinese: '对话框', description: 'Standard popup dialog window' },
      { english: 'instance', chinese: '实例', description: 'Running process instance reference' },
      { english: 'device context', chinese: '设备上下文', description: 'GDI rendering context (HDC)' }
    ]
  },
  {
    name: 'DirectX & 游戏图形学术语库',
    icon: '🎮',
    terms: [
      { english: 'render', chinese: '渲染', description: 'Drawing graphic primitives to buffers' },
      { english: 'buffer', chinese: '缓冲区', description: 'Dedicated VRAM block for data' },
      { english: 'shader', chinese: '着色器', description: 'GPU programmable graphics module' },
      { english: 'frame rate', chinese: '帧率', description: 'Frames rendered per second (FPS)' },
      { english: 'viewport', chinese: '视口', description: 'Client window clip area' },
      { english: 'texture', chinese: '纹理', description: 'Bitmap applied to a 3D primitive surface' }
    ]
  }
];

export default function GlossaryPanel({
  glossary,
  onAddTerm,
  onDeleteTerm,
  onImportDictionary,
  isDarkMode = true
}: GlossaryPanelProps) {
  const [eng, setEng] = useState('');
  const [chn, setChn] = useState('');
  const [desc, setDesc] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eng.trim() || !chn.trim()) return;

    onAddTerm({
      english: eng.trim().toLowerCase(),
      chinese: chn.trim(),
      description: desc.trim()
    });

    setEng('');
    setChn('');
    setDesc('');
    showFeedback('术语添加成功！');
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  const filteredGlossary = glossary.filter(g =>
    g.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
    g.chinese.includes(searchQuery)
  );

  return (
    <div 
      id="glossary-control-panel" 
      className={`h-full flex flex-col font-sans border-l ${
        isDarkMode 
          ? 'bg-[#1e1e24] text-[#D4D4D4] border-[#2d2d34]' 
          : 'bg-white text-slate-700 border-slate-200'
      }`}
    >
      {/* Panel Header */}
      <div 
        className={`p-3.5 border-b flex items-center gap-2 shrink-0 ${
          isDarkMode ? 'bg-[#18181c] border-[#2d2d34] text-slate-200' : 'bg-slate-100 border-slate-200 text-slate-800'
        }`}
      >
        <BookOpen className="w-4 h-4 text-emerald-500" />
        <span className="text-xs font-semibold uppercase tracking-wider">中文代码映射与术语表</span>
      </div>

      {/* Dictionary Presets */}
      <div 
        className={`p-3 border-b shrink-0 select-none ${
          isDarkMode ? 'bg-[#1a1a20]/40 border-[#2d2d34]' : 'bg-slate-50 border-slate-200'
        }`}
      >
        <span className={`text-[10px] font-semibold uppercase tracking-wider block mb-2 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>一键载入预设词典</span>
        <div className="space-y-1.5">
          {DICTIONARY_PRESETS.map((dict, idx) => (
            <button
              key={idx}
              onClick={() => {
                onImportDictionary(dict.name, dict.terms);
                showFeedback(`成功载入：${dict.name}`);
              }}
              className={`w-full text-left p-2 border rounded-md text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer ${
                isDarkMode 
                  ? 'bg-[#24242c] hover:bg-[#2c2c36] border-[#2d2d34] text-slate-300 hover:text-white' 
                  : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-2 truncate">
                <span>{dict.icon}</span>
                <span className="truncate">{dict.name}</span>
              </span>
              <Import className="w-3 h-3 text-slate-400 shrink-0" />
            </button>
          ))}
        </div>
      </div>

      {/* Add new Term Form */}
      <div 
        className={`p-3.5 border-b shrink-0 ${
          isDarkMode ? 'bg-[#1e1e24] border-[#2d2d34]' : 'bg-white border-slate-200'
        }`}
      >
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-2.5">添加自定义术语</span>
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="英文 (Eng)"
              value={eng}
              onChange={e => setEng(e.target.value)}
              className={`border rounded px-2 py-1 text-xs w-1/2 focus:outline-none focus:border-emerald-500 ${
                isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
              }`}
              required
            />
            <input
              type="text"
              placeholder="中文映射"
              value={chn}
              onChange={e => setChn(e.target.value)}
              className={`border rounded px-2 py-1 text-xs w-1/2 focus:outline-none focus:border-emerald-500 ${
                isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
              }`}
              required
            />
          </div>
          <input
            type="text"
            placeholder="说明 (可选，例如 HDC, HWND)"
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className={`border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-emerald-500 ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold py-1.5 rounded text-xs transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>添加至词典</span>
          </button>
        </form>
      </div>

      {/* Terms Search and List */}
      <div className={`flex-1 flex flex-col min-h-0 ${isDarkMode ? 'bg-[#18181c]/30' : 'bg-slate-50'}`}>
        <div className={`p-2 border-b flex items-center relative shrink-0 ${isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200'}`}>
          <input
            type="text"
            placeholder="搜词典术语..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className={`border rounded pl-7 pr-3 py-1 text-xs w-full focus:outline-none focus:border-emerald-500 ${
              isDarkMode ? 'bg-[#24242b] border-[#2d2d34] text-slate-200' : 'bg-white border-slate-300 text-slate-800'
            }`}
          />
          <Search className="w-3 h-3 text-slate-400 absolute left-4.5" />
        </div>

        {/* Dynamic Terms list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
          {filteredGlossary.length === 0 ? (
            <div className="text-center py-6 text-slate-400 text-xs">
              无匹配术语条目
            </div>
          ) : (
            filteredGlossary.map((g, idx) => (
              <div
                key={idx}
                className={`group flex items-center justify-between p-2 rounded-md border transition-all ${
                  isDarkMode 
                    ? 'bg-[#24242c] border-[#2d2d34] hover:border-emerald-500/30' 
                    : 'bg-white border-slate-200 hover:border-emerald-500/30 shadow-sm'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="font-mono text-xs font-semibold text-emerald-600 capitalize">{g.english}</span>
                    <span className="text-[10px] text-slate-400">→</span>
                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{g.chinese}</span>
                  </div>
                  {g.description && (
                    <span className="text-[10px] text-slate-400 truncate mt-0.5">{g.description}</span>
                  )}
                </div>
                <button
                  onClick={() => onDeleteTerm(g.english)}
                  className={`p-1 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100 shrink-0 ${
                    isDarkMode ? 'text-slate-500 hover:text-rose-400 hover:bg-[#2d2d36]' : 'text-slate-400 hover:text-rose-500 hover:bg-slate-100'
                  }`}
                  title="删除词条"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating feedback alert */}
      {feedback && (
        <div className={`m-3 p-2 border rounded flex items-center gap-1.5 text-xs font-medium animate-fade-in shrink-0 ${
          isDarkMode ? 'bg-emerald-950/70 border-emerald-500/30 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          <Check className="w-3.5 h-3.5" />
          <span>{feedback}</span>
        </div>
      )}
    </div>
  );
}
