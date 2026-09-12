import { useEffect, useMemo, useRef, useState } from 'react';
import { FolderOpen, Search, X } from 'lucide-react';

export interface RecentWorkspacesDialogProps {
  open: boolean;
  isDarkMode: boolean;
  recentWorkspaces: string[];
  initialQuery?: string;
  onOpenWorkspace: (workspacePath: string) => void | Promise<void>;
  onForgetWorkspace: (workspacePath: string) => void | Promise<void>;
  onClose: () => void;
}

export function workspaceLabel(workspacePath: string): string {
  const normalized = workspacePath.replace(/[\\/]+$/u, '');
  return normalized.split(/[\\/]/u).pop() || normalized;
}

/** 全部最近工作区选择器：按名称或路径实时过滤，支持键盘上下选择与从列表移除。 */
export default function RecentWorkspacesDialog({
  open,
  isDarkMode,
  recentWorkspaces,
  initialQuery,
  onOpenWorkspace,
  onForgetWorkspace,
  onClose
}: RecentWorkspacesDialogProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery(initialQuery || '');
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialQuery]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return recentWorkspaces;
    return recentWorkspaces.filter(workspacePath => workspacePath.toLowerCase().includes(keyword));
  }, [query, recentWorkspaces]);

  useEffect(() => {
    setActiveIndex(index => Math.min(index, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  if (!open) return null;

  const openActive = () => {
    const target = filtered[activeIndex];
    if (target) void onOpenWorkspace(target);
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recent-workspaces-dialog-title"
      onKeyDown={event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        } else if (event.key === 'ArrowDown') {
          event.preventDefault();
          setActiveIndex(index => Math.min(index + 1, filtered.length - 1));
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          setActiveIndex(index => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          openActive();
        }
      }}
    >
      <div
        className={`flex max-h-[calc(100vh-2rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border shadow-2xl ${
          isDarkMode ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-5 py-4 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="recent-workspaces-dialog-title" className="text-base font-semibold">全部最近工作区</h2>
              <p className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                输入名称或路径过滤，方向键选择，Enter 打开。
              </p>
            </div>
            <button
              type="button"
              title="关闭"
              aria-label="关闭全部最近工作区"
              onClick={onClose}
              className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                isDarkMode ? 'text-slate-400 hover:bg-[#303038] hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="relative mt-3">
            <Search className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={event => { setQuery(event.target.value); setActiveIndex(0); }}
              placeholder="搜索工作区名称或路径…"
              aria-label="搜索最近工作区"
              data-recent-workspace-search
              className={`h-9 w-full rounded-md border pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${
                isDarkMode
                  ? 'border-[#3d3d44] bg-[#16161b] text-slate-200 placeholder:text-slate-500'
                  : 'border-slate-300 bg-white text-slate-800 placeholder:text-slate-400'
              }`}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {recentWorkspaces.length === 0 ? (
            <div className={`rounded-md border border-dashed px-4 py-8 text-center text-xs ${isDarkMode ? 'border-[#45454e] text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              暂无最近工作区
            </div>
          ) : filtered.length === 0 ? (
            <div className={`rounded-md border border-dashed px-4 py-8 text-center text-xs ${isDarkMode ? 'border-[#45454e] text-slate-500' : 'border-slate-300 text-slate-400'}`}>
              没有匹配「{query.trim()}」的工作区
            </div>
          ) : (
            <ul className="space-y-1" data-recent-workspace-list>
              {filtered.map((workspacePath, index) => (
                <li
                  key={workspacePath}
                  ref={element => {
                    if (index === activeIndex) element?.scrollIntoView({ block: 'nearest' });
                  }}
                  className={`group flex w-full items-center gap-1 rounded-md border px-1 transition-colors ${
                    index === activeIndex
                      ? isDarkMode ? 'border-blue-400/60 bg-[#2b2b34]' : 'border-blue-400 bg-blue-50/60'
                      : isDarkMode ? 'border-transparent hover:bg-[#2b2b34]' : 'border-transparent hover:bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    title={workspacePath}
                    data-recent-workspace={workspacePath}
                    onClick={() => { setActiveIndex(index); void onOpenWorkspace(workspacePath); }}
                    onMouseEnter={() => setActiveIndex(index)}
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left focus:outline-none"
                  >
                    <FolderOpen className={`h-4 w-4 shrink-0 ${isDarkMode ? 'text-slate-400' : 'text-slate-400'}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{workspaceLabel(workspacePath)}</span>
                      <span className={`mt-0.5 block truncate text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>{workspacePath}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title="从最近列表移除"
                    aria-label={`从最近列表移除 ${workspaceLabel(workspacePath)}`}
                    data-forget-workspace={workspacePath}
                    onClick={event => {
                      event.stopPropagation();
                      void onForgetWorkspace(workspacePath);
                      // 该行即将从列表移除，把焦点还给搜索框，键盘操作（方向键/Enter/Escape）不中断。
                      searchRef.current?.focus();
                    }}
                    className={`mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-0 transition-opacity transition-colors focus:opacity-100 focus:outline-none group-hover:opacity-100 ${
                      isDarkMode ? 'text-slate-500 hover:bg-[#3a3a44] hover:text-rose-400' : 'text-slate-400 hover:bg-slate-200 hover:text-rose-600'
                    }`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={`border-t px-5 py-2.5 text-[11px] ${isDarkMode ? 'border-[#35353c] text-slate-500' : 'border-slate-200 text-slate-400'}`}>
          共 {recentWorkspaces.length} 个工作区{query.trim() ? `，匹配 ${filtered.length} 个` : ''}；悬停或方向键选中后可用右侧按钮从列表移除。
        </div>
      </div>
    </div>
  );
}
