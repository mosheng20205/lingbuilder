import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileText } from 'lucide-react';
import type { BeginnerFindResultEntry } from '../services/lingCpp/beginnerFind';

export interface FindResultsPanelProps {
  query: string;
  results: readonly BeginnerFindResultEntry[];
  truncated: boolean;
  scope: string;
  isDarkMode: boolean;
  /** 双击/回车某条命中：跳转到对应文件与代码行并显示行标识。 */
  onJump: (entry: BeginnerFindResultEntry) => void;
}

interface GroupedByFile {
  filePath: string;
  fileName: string;
  entries: BeginnerFindResultEntry[];
}

/** 命中文本着色的行预览：按列与长度拆分，避免整行 highlight 泛化。 */
const renderPreview = (entry: BeginnerFindResultEntry, isDarkMode: boolean) => {
  const before = entry.lineText.slice(0, entry.column - 1);
  const hit = entry.lineText.slice(entry.column - 1, entry.column - 1 + entry.length);
  const after = entry.lineText.slice(entry.column - 1 + entry.length);
  const hitClass = isDarkMode ? 'bg-amber-500/25 text-amber-200 rounded-[2px]' : 'bg-amber-200 text-amber-900 rounded-[2px]';
  return (
    <span className="truncate font-mono text-[11px]">
      <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>{before}</span>
      <span className={hitClass}>{hit}</span>
      <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{after}</span>
    </span>
  );
};

/** 底部面板「查找结果」页签：按文件分组列出命中，双击/回车跳转到代码行。 */
export default function FindResultsPanel({ query, results, truncated, scope, isDarkMode, onJump }: FindResultsPanelProps) {
  const [activeKey, setActiveKey] = useState<string>('');
  const [collapsedFiles, setCollapsedFiles] = useState<string[]>([]);

  const groups = useMemo<GroupedByFile[]>(() => {
    const map = new Map<string, GroupedByFile>();
    for (const entry of results) {
      const existing = map.get(entry.filePath);
      if (existing) {
        existing.entries.push(entry);
      } else {
        map.set(entry.filePath, { filePath: entry.filePath, fileName: entry.fileName, entries: [entry] });
      }
    }
    return Array.from(map.values());
  }, [results]);

  const toggleFile = (filePath: string) => {
    setCollapsedFiles(current => current.includes(filePath)
      ? current.filter(item => item !== filePath)
      : [...current, filePath]);
  };

  const rowClass = (active: boolean) => `flex w-full items-center gap-2 rounded px-6 py-[3px] text-left text-[11px] transition-colors ${
    active
      ? isDarkMode ? 'bg-cyan-500/15' : 'bg-cyan-50'
      : isDarkMode ? 'hover:bg-[#272733]' : 'hover:bg-slate-100'
  }`;

  if (!query) {
    return (
      <div className={`h-full overflow-auto p-4 text-xs ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
        在编辑器按 Ctrl+F 输入内容后，点击「查找全部」在这里列出所有命中。
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto select-text" data-beginner-find-results>
      <div className={`sticky top-0 z-10 flex items-center justify-between gap-2 border-b px-3 py-1.5 text-[10px] ${
        isDarkMode ? 'border-[#2d2d34] bg-[#18181f] text-slate-400' : 'border-slate-200 bg-white text-slate-500'
      }`}>
        <span>
          {scope === 'project' ? '当前项目' : scope === 'solution' ? '整个解决方案' : '当前文件'}
          ：共 {results.length} 处{truncated ? '（已达上限，未全部列出）' : ''}
        </span>
        <span>双击跳转到代码行</span>
      </div>
      {groups.length === 0 && (
        <div className="p-4 text-xs text-slate-500">无结果。</div>
      )}
      {groups.map(group => {
        const collapsed = collapsedFiles.includes(group.filePath);
        return (
          <div key={group.filePath}>
            <button
              type="button"
              onClick={() => toggleFile(group.filePath)}
              className={`flex w-full items-center gap-1.5 border-b px-2 py-1 text-left text-[11px] font-semibold ${
                isDarkMode ? 'border-[#2d2d34] hover:bg-[#232630]' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              {collapsed
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />}
              <FileText className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span className={`truncate ${isDarkMode ? 'text-slate-200' : 'text-slate-700'}`}>{group.filePath}</span>
              <span className="ml-auto shrink-0 text-[10px] text-slate-500">{group.entries.length} 处</span>
            </button>
            {!collapsed && group.entries.map(entry => {
              const rowKey = `${entry.filePath}:${entry.line}:${entry.column}`;
              return (
                <div
                  key={rowKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveKey(rowKey)}
                  onDoubleClick={() => onJump(entry)}
                  onKeyDown={event => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      onJump(entry);
                    }
                  }}
                  className={rowClass(activeKey === rowKey)}
                  title={`${entry.filePath} 第 ${entry.line} 行 第 ${entry.column} 列 · 双击跳转`}
                  data-find-result-row={rowKey}
                >
                  <span className={`w-24 shrink-0 text-right font-mono text-[10px] tabular-nums ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                    行 {entry.line} · 列 {entry.column}
                  </span>
                  {renderPreview(entry, isDarkMode)}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
