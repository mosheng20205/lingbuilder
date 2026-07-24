import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, PanelsTopLeft, Plus, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  appendTabControlPage,
  duplicateTabControlPage,
  moveTabControlPage,
  normalizeTabControlPages,
  removeTabControlPage,
  type TabControlPage,
  type TabControlPageMutation
} from '../services/windowDesigner/tabControlModel';

interface TabControlPagesDialogProps {
  controlName: string;
  value: Win32ControlPropertyValue | undefined;
  hasImageList: boolean;
  isDarkMode: boolean;
  onChange: (pages: TabControlPage[], mutation?: TabControlPageMutation) => void;
  onClose: () => void;
}

export default function TabControlPagesDialog({ controlName, value, hasImageList, isDarkMode, onChange, onClose }: TabControlPagesDialogProps) {
  const pages = useMemo(() => normalizeTabControlPages(value), [value]);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [status, setStatus] = useState('');
  onCloseRef.current = onClose;

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const inputClass = `h-8 w-full min-w-0 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${isDarkMode ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'}`;
  const secondaryButton = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${isDarkMode ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`;
  const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'}`;

  const updatePage = (index: number, fields: Partial<TabControlPage>) => {
    setStatus('');
    onChange(pages.map((page, pageIndex) => pageIndex === index ? { ...page, ...fields } : page));
  };
  const renamePage = (index: number, requestedId: string) => {
    const nextId = requestedId.trim();
    const previousId = pages[index].id;
    if (!nextId) { setStatus('页面 ID 不能为空。'); return; }
    if (pages.some((page, pageIndex) => pageIndex !== index && page.id === nextId)) { setStatus(`页面 ID“${nextId}”已存在，请换一个。`); return; }
    if (nextId === previousId) return;
    setStatus('');
    onChange(pages.map((page, pageIndex) => pageIndex === index ? { ...page, id: nextId } : page), { type: 'rename', previousId, nextId });
  };
  const deletePage = (index: number) => {
    if (pages.length <= 1) { setStatus('选项卡至少需要保留一个标签页。'); return; }
    const removedId = pages[index].id;
    const next = removeTabControlPage(pages, index);
    const fallbackId = next[Math.min(index, next.length - 1)].id;
    setStatus('');
    onChange(next, { type: 'remove', removedId, fallbackId });
  };
  const renderActions = (index: number) => (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" aria-label={`复制第 ${index + 1} 个标签页`} title="复制标签页" onClick={() => onChange(duplicateTabControlPage(pages, index))} className={iconButton}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`上移第 ${index + 1} 个标签页`} title="上移" disabled={index === 0} onClick={() => onChange(moveTabControlPage(pages, index, index - 1))} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`下移第 ${index + 1} 个标签页`} title="下移" disabled={index === pages.length - 1} onClick={() => onChange(moveTabControlPage(pages, index, index + 1))} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`删除第 ${index + 1} 个标签页`} title="删除标签页" disabled={pages.length <= 1} onClick={() => deletePage(index)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
  const renderFields = (page: TabControlPage, index: number, compact = false) => [
    <label key="id" className={compact ? 'block text-[10px] text-slate-500' : ''}>{compact && '页面 ID'}<input aria-label={`第 ${index + 1} 个标签页页面 ID`} defaultValue={page.id} onBlur={event => renamePage(index, event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} className={`${inputClass} ${compact ? 'mt-1 font-mono' : 'font-mono'}`} /></label>,
    <label key="title" className={compact ? 'block text-[10px] text-slate-500' : ''}>{compact && '标题'}<input aria-label={`第 ${index + 1} 个标签页标题`} value={page.title} onChange={event => updatePage(index, { title: event.target.value })} placeholder="标签页标题" className={`${inputClass} ${compact ? 'mt-1' : ''}`} /></label>,
    <label key="image" className={compact ? 'block text-[10px] text-slate-500' : ''}>{compact && '图片编号'}<input aria-label={`第 ${index + 1} 个标签页图片编号`} type="number" min={-1} value={page.image} disabled={!hasImageList} title={hasImageList ? '图像列表中的图片编号，-1 表示不显示图片' : '请先为选项卡设置图像列表 ID'} onChange={event => updatePage(index, { image: Math.max(-1, Math.trunc(Number(event.target.value) || 0)) })} className={`${inputClass} ${compact ? 'mt-1' : ''} disabled:cursor-not-allowed disabled:opacity-45`} /></label>
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="tab-pages-title" aria-describedby="tab-pages-description" className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <PanelsTopLeft className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1"><h2 id="tab-pages-title" className="truncate text-sm font-bold sm:text-base">编辑标签页 · {controlName}</h2><p id="tab-pages-description" className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>集中设置页面标识、标题和图片；排序与修改会立即同步到设计器及原生生成结果。</p></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭标签页编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>
        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}><button type="button" onClick={() => { setStatus(''); onChange(appendTabControlPage(pages)); }} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增标签页</button><span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{pages.length} 个标签页</span></div>
        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {pages.length === 0 ? <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><PanelsTopLeft className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有标签页</p><p className="mt-1 text-xs">新增第一个标签页后，便可把控件放入对应页面。</p><button type="button" onClick={() => onChange(appendTabControlPage(pages))} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一个标签页</button></div> : <><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-xs"><thead><tr className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><th className="w-16 border-b p-2">序号</th><th className="w-56 border-b p-2">页面 ID</th><th className="border-b p-2">标题</th><th className="w-32 border-b p-2">图片编号</th><th className="w-36 border-b p-2 text-right">操作</th></tr></thead><tbody>{pages.map((page, index) => <tr key={page.id} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-100/60'}><td className="border-b p-2 font-mono text-slate-500">{index + 1}</td>{renderFields(page, index).map((field, fieldIndex) => <td key={fieldIndex} className="border-b p-2">{field}</td>)}<td className="border-b p-2">{renderActions(index)}</td></tr>)}</tbody></table></div><div className="space-y-2 md:hidden">{pages.map((page, index) => <section key={page.id} className={`rounded border p-3 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">第 {index + 1} 个标签页</span>{renderActions(index)}</div><div className="grid gap-3 sm:grid-cols-3">{renderFields(page, index, true)}</div></section>)}</div></>}
        </main>
        <footer className={`flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 sm:px-5 ${isDarkMode ? 'border-[#35353e] bg-[#202026]' : 'border-slate-200 bg-white'}`}><span role="status" className={`text-[10px] ${status ? 'text-amber-500' : 'text-slate-500'}`}>{status || '至少保留一个标签页；页面 ID 改名或删除时会自动迁移已有控件。图片编号 -1 表示不显示图片。'}</span><button type="button" onClick={onClose} className={secondaryButton}>完成</button></footer>
      </div>
    </div>
  );
}
