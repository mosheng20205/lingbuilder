import React, { useEffect } from 'react';
import { ChevronDown, ChevronUp, List, X } from 'lucide-react';
import type { BeginnerFindScope } from '../../services/lingCpp/beginnerFind';

export type { BeginnerFindScope };

export interface BeginnerFindBarProps {
  query: string;
  matchCase: boolean;
  /** 当前命中下标（0 起始）；无命中时忽略。 */
  activeIndex: number;
  totalCount: number;
  scope: BeginnerFindScope;
  /** 跨文件范围（项目/解决方案）的汇总计数；null 表示尚未搜索。 */
  crossSummary: { matches: number; files: number; truncated: boolean; searching: boolean } | null;
  isDarkMode: boolean;
  inputRef?: React.MutableRefObject<HTMLInputElement | null>;
  onQueryChange: (value: string) => void;
  onToggleMatchCase: () => void;
  onScopeChange: (scope: BeginnerFindScope) => void;
  onPrevious: () => void;
  onNext: () => void;
  onFindAll: () => void;
  onClose: () => void;
}

const SCOPE_LABELS: Record<BeginnerFindScope, string> = {
  file: '当前文件',
  project: '当前项目',
  solution: '整个解决方案'
};

/**
 * 新手结构化画布的查找条。
 * 由 DiffViewer 渲染在画布滚动容器的顶部（sticky 浮层，不占布局高度），
 * Enter / Shift+Enter 在命中间循环，Esc 关闭并把注意力交还画布。
 * 范围为当前文件时逐处循环导航；项目/解决方案范围由「查找全部」汇总到底部结果面板。
 */
export default function BeginnerFindBar({
  query,
  matchCase,
  activeIndex,
  totalCount,
  scope,
  crossSummary,
  isDarkMode,
  inputRef,
  onQueryChange,
  onToggleMatchCase,
  onScopeChange,
  onPrevious,
  onNext,
  onFindAll,
  onClose
}: BeginnerFindBarProps) {
  useEffect(() => {
    const input = inputRef?.current;
    if (input) {
      input.focus();
      input.select();
    }
  }, [inputRef]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    // 输入法组词中的 Enter/Esc 归输入法（确认候选/取消组词），不触发查找导航。
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (scope === 'file') {
        if (event.shiftKey) onPrevious();
        else onNext();
      } else {
        onFindAll();
      }
    }
  };

  const chromeClass = isDarkMode
    ? 'border-[#3a3e4c] bg-[#23262f]/95 text-slate-200 shadow-black/50'
    : 'border-slate-300 bg-white/95 text-slate-700 shadow-slate-400/40';
  const inputClass = isDarkMode
    ? 'border-[#3a3e4c] bg-[#171920] text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-1 focus:ring-cyan-400/25'
    : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/20';
  const buttonIdleClass = isDarkMode
    ? 'text-slate-400 hover:bg-[#333744] hover:text-slate-100'
    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800';
  const disabledClass = 'disabled:opacity-35';
  const countPillClass = crossSummary
    ? (crossSummary.matches > 0
      ? isDarkMode ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'
      : isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700')
    : (totalCount > 0
      ? isDarkMode ? 'bg-slate-500/15 text-slate-300' : 'bg-slate-100 text-slate-600'
      : isDarkMode ? 'bg-amber-500/15 text-amber-300' : 'bg-amber-50 text-amber-700');
  const countText = crossSummary
    ? (crossSummary.searching
      ? '搜索中…'
      : crossSummary.matches > 0
        ? `${crossSummary.matches} 处/${crossSummary.files} 文件${crossSummary.truncated ? '+' : ''}`
        : '无结果')
    : (totalCount > 0 ? `${Math.min(activeIndex + 1, totalCount)}/${totalCount}` : '无结果');

  return (
    <div
      role="search"
      aria-label="查找当前文件内容"
      className={`pointer-events-auto flex w-max max-w-full items-center gap-0.5 rounded-lg border px-1 py-1 shadow-xl backdrop-blur-sm ${chromeClass}`}
    >
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={event => onQueryChange(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder="查找内容"
        aria-label="查找内容"
        spellCheck={false}
        className={`h-7 w-36 rounded-md border px-2 text-xs outline-none transition-colors ${inputClass}`}
      />
      <select
        value={scope}
        onChange={event => onScopeChange(event.currentTarget.value as BeginnerFindScope)}
        aria-label="查找范围"
        title="查找范围"
        className={`h-7 rounded-md border px-1 text-[11px] outline-none transition-colors ${inputClass}`}
      >
        <option value="file">当前文件</option>
        <option value="project">当前项目</option>
        <option value="solution">整个解决方案</option>
      </select>
      <span
        aria-live="polite"
        className={`mx-0.5 rounded px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none tabular-nums ${countPillClass}`}
      >
        {countText}
      </span>
      <button
        type="button"
        onClick={onToggleMatchCase}
        aria-pressed={matchCase}
        aria-label={matchCase ? '已区分大小写' : '不区分大小写'}
        title="区分大小写"
        className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-bold leading-none transition-colors ${
          matchCase
            ? isDarkMode ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
            : buttonIdleClass
        }`}
      >
        Aa
      </button>
      <button
        type="button"
        onClick={onPrevious}
        aria-label="上一个匹配"
        title="上一个 (Shift+Enter)"
        disabled={totalCount === 0}
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${buttonIdleClass} ${disabledClass}`}
      >
        <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="下一个匹配"
        title="下一个 (Enter)"
        disabled={totalCount === 0}
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${buttonIdleClass} ${disabledClass}`}
      >
        <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onFindAll}
        aria-label="查找全部"
        title="查找全部（在底部结果面板列出）"
        disabled={!query}
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${buttonIdleClass} ${disabledClass}`}
      >
        <List className="h-4 w-4" strokeWidth={2.5} />
      </button>
      <button
        type="button"
        onClick={onClose}
        aria-label="关闭查找"
        title="关闭 (Esc)"
        className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${buttonIdleClass}`}
      >
        <X className="h-4 w-4" strokeWidth={2.5} />
      </button>
    </div>
  );
}
