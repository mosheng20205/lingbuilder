import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, ListTree, Search } from 'lucide-react';
import type { LingCppStructuredReadingRow, LingCppStructureNode } from '../services/lingCpp/types';

interface LingCppStructureEditorProps {
  rows: LingCppStructuredReadingRow[];
  structureNodes: LingCppStructureNode[];
  pendingEventCount: number;
  fileLabel: string;
  sourceLineCount: number;
  activeLine?: number;
  error?: string | null;
  isDarkMode: boolean;
  children: React.ReactNode;
  onRevealLine: (line: number) => void;
  onGenerateMissingEvent?: (row: LingCppStructuredReadingRow) => void;
}

type OutlineGroup = {
  id: string;
  label: string;
  rows: LingCppStructuredReadingRow[];
};

const groupLabel: Record<LingCppStructuredReadingRow['group'], string> = {
  declaration: '声明',
  package: '入口',
  global: '项目全局变量',
  class: '类',
  member: '变量',
  local: '局部变量',
  method: '过程',
  constructor: '初始化',
  event: '事件',
  parameter: '参数',
  note: '备注'
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const rowSearchText = (row: LingCppStructuredReadingRow) =>
  [row.name, row.targetName, row.type, row.value, row.note, row.className, groupLabel[row.group]]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

const uniqueRows = (rows: LingCppStructuredReadingRow[]) => {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = `${row.id}:${row.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

function buildOutlineGroups(rows: LingCppStructuredReadingRow[], query: string): OutlineGroup[] {
  const normalizedQuery = normalizeSearchText(query);
  const filteredRows = normalizedQuery
    ? rows.filter(row => rowSearchText(row).includes(normalizedQuery))
    : rows;

  return [
    {
      id: 'class',
      label: '窗口程序集',
      rows: filteredRows.filter(row => row.group === 'class')
    },
    {
      id: 'member',
      label: '程序集变量',
      rows: filteredRows.filter(row => row.group === 'member')
    },
    {
      id: 'event',
      label: '事件处理',
      rows: filteredRows.filter(row => row.group === 'event' && row.editKind !== undefined)
    },
    {
      id: 'method',
      label: '子程序',
      rows: filteredRows.filter(row => row.group === 'method' || row.group === 'constructor')
    },
    {
      id: 'declaration',
      label: '声明',
      rows: filteredRows.filter(row => row.group === 'declaration' || row.group === 'package')
    }
  ].map(group => ({ ...group, rows: uniqueRows(group.rows).sort((left, right) => left.line - right.line) }));
}

export default function LingCppStructureEditor({
  rows,
  structureNodes,
  pendingEventCount,
  fileLabel,
  sourceLineCount,
  activeLine,
  error,
  isDarkMode,
  children,
  onRevealLine,
  onGenerateMissingEvent
}: LingCppStructureEditorProps) {
  const [outlineQuery, setOutlineQuery] = useState('');
  const outlineGroups = useMemo(() => buildOutlineGroups(rows, outlineQuery), [outlineQuery, rows]);
  const visibleOutlineCount = outlineGroups.reduce((total, group) => total + group.rows.length, 0);
  const classCount = rows.filter(row => row.group === 'class').length || structureNodes.filter(node => node.kind === 'class').length;
  const memberCount = rows.filter(row => row.group === 'member').length;
  const eventCount = rows.filter(row => row.group === 'event' && row.editKind !== undefined).length;
  const methodCount = rows.filter(row => row.group === 'method' || row.group === 'constructor').length;

  const surface = isDarkMode ? 'bg-[#18181f] text-slate-200' : 'bg-white text-slate-800';
  const border = isDarkMode ? 'border-[#2d2d34]' : 'border-slate-200';
  const subtleSurface = isDarkMode ? 'bg-[#111118]' : 'bg-slate-50';
  const inputSurface = isDarkMode
    ? 'border-[#343442] bg-[#15151b] text-slate-100 placeholder:text-slate-600 focus:border-cyan-500/70'
    : 'border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-500';

  return (
    <div className={`flex min-h-0 flex-1 overflow-hidden ${surface}`}>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className={`flex h-9 shrink-0 items-center justify-between gap-3 border-b px-3 ${border} ${subtleSurface}`}>
          <div className="flex min-w-0 items-center gap-2">
            <ListTree className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
            <span className={`whitespace-nowrap text-[11px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>
              中文结构源码
            </span>
            <span className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${isDarkMode ? 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300' : 'border-cyan-200 bg-cyan-50 text-cyan-700'}`}>
              {rows.length} 项
            </span>
            {pendingEventCount > 0 && (
              <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold ${isDarkMode ? 'border-amber-500/25 bg-amber-500/10 text-amber-300' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                <AlertTriangle className="h-3 w-3" />
                待生成 {pendingEventCount}
              </span>
            )}
          </div>
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-slate-500">
            <span className="hidden shrink-0 md:inline">共 {sourceLineCount} 行</span>
            <span className="truncate font-mono">{fileLabel}</span>
          </div>
        </header>

        {error && (
          <div className={`shrink-0 border-b px-3 py-2 text-[11px] ${isDarkMode ? 'border-[#2d2d34] bg-rose-950/20 text-rose-200' : 'border-rose-100 bg-rose-50 text-rose-700'}`}>
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      <aside className={`hidden w-[250px] shrink-0 flex-col border-l 2xl:flex ${border} ${isDarkMode ? 'bg-[#17181d]' : 'bg-white'}`}>
        <div className={`border-b px-3 py-2 ${border}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className={`text-[11px] font-semibold ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>结构大纲</span>
            <span className="text-[10px] text-slate-500">{visibleOutlineCount}</span>
          </div>
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={outlineQuery}
              onChange={event => setOutlineQuery(event.currentTarget.value)}
              aria-label="搜索结构大纲"
              placeholder="搜索变量、过程..."
              className={`h-7 w-full rounded border pl-7 pr-2 text-[11px] outline-none transition-colors ${inputSurface}`}
            />
          </label>
        </div>

        <div className="grid grid-cols-4 border-b text-center text-[10px] tabular-nums">
          {[
            ['类', classCount],
            ['变量', memberCount],
            ['事件', eventCount],
            ['过程', methodCount]
          ].map(([label, count]) => (
            <div key={label} className={`border-r px-1 py-1.5 last:border-r-0 ${border}`}>
              <div className={isDarkMode ? 'text-slate-500' : 'text-slate-500'}>{label}</div>
              <div className={`font-semibold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{count}</div>
            </div>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-auto py-1">
          {outlineGroups.some(group => group.rows.length > 0) ? (
            outlineGroups.map(group => (
              group.rows.length > 0 && (
                <section key={group.id}>
                  <div className={`sticky top-0 z-10 flex items-center justify-between border-b px-3 py-1.5 text-[10px] font-semibold ${border} ${subtleSurface}`}>
                    <span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>{group.label}</span>
                    <span className="text-slate-500">{group.rows.length}</span>
                  </div>
                  {group.rows.map(row => {
                    const selected = activeLine === row.line;
                    const missingEvent = row.editKind === 'missing-event' || row.status === 'missing-source';
                    return (
                      <div key={`${group.id}:${row.id}`} className={`flex items-stretch border-b ${border}`}>
                        <button
                          type="button"
                          onClick={() => onRevealLine(row.line)}
                          className={`grid min-w-0 flex-1 grid-cols-[16px_minmax(0,1fr)_42px] items-center gap-1 px-2 py-1.5 text-left text-[11px] transition-colors ${
                            selected
                              ? isDarkMode ? 'bg-cyan-500/12 text-cyan-100' : 'bg-cyan-50 text-cyan-900'
                              : isDarkMode ? 'text-slate-300 hover:bg-[#20222a]' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                          title={`${row.targetName || row.name} - 第 ${row.line} 行`}
                        >
                          <ChevronRight className={`h-3.5 w-3.5 ${selected ? 'text-cyan-400' : 'text-slate-500'}`} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold">{row.targetName || row.name}</span>
                            <span className="block truncate text-[10px] text-slate-500">{row.type || groupLabel[row.group]}</span>
                          </span>
                          <span className="text-right font-mono text-[10px] text-slate-500">{missingEvent ? '待生成' : row.line}</span>
                        </button>
                        {missingEvent && onGenerateMissingEvent && (
                          <button
                            type="button"
                            onClick={() => onGenerateMissingEvent(row)}
                            className={`m-1 shrink-0 rounded px-1.5 text-[9px] font-semibold transition-colors ${
                              isDarkMode ? 'bg-amber-400/15 text-amber-200 hover:bg-amber-400/25' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                            }`}
                            title={`快速生成事件 ${row.targetName || row.name}`}
                          >
                            生成
                          </button>
                        )}
                      </div>
                    );
                  })}
                </section>
              )
            ))
          ) : (
            <div className="px-3 py-8 text-center text-[11px] text-slate-500">没有匹配的结构项</div>
          )}
        </div>
      </aside>
    </div>
  );
}
