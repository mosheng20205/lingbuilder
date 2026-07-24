import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, Menu, Plus, Save, Trash2, X } from 'lucide-react';
import {
  parseMenuBarItems,
  serializeMenuBarItems,
  validateMenuBarItems
} from '../services/windowDesigner/menuBarItemsModel';

interface MenuBarItemsDialogProps {
  controlName: string;
  value: string;
  isDarkMode: boolean;
  onSave: (value: string) => void;
  onClose: () => void;
}

function moveItem(items: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function MenuBarItemsDialog({
  controlName,
  value,
  isDarkMode,
  onSave,
  onClose
}: MenuBarItemsDialogProps) {
  const [items, setItems] = useState(() => parseMenuBarItems(value));
  const [error, setError] = useState('');
  const firstInputRef = useRef<HTMLInputElement>(null);
  const nextFocusIndexRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    firstInputRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const index = nextFocusIndexRef.current;
    if (index === null) return;
    nextFocusIndexRef.current = null;
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-menu-item-index="${index}"]`)?.focus());
  }, [items.length]);

  const inputClass = `h-8 min-w-0 flex-1 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode
      ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const secondaryButton = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 ${
    isDarkMode
      ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-8 w-8 shrink-0 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
  }`;

  const addItem = (afterIndex?: number) => {
    const insertIndex = afterIndex === undefined ? items.length : afterIndex + 1;
    const next = [...items];
    next.splice(insertIndex, 0, '新菜单项');
    nextFocusIndexRef.current = insertIndex;
    setItems(next);
    setError('');
  };

  const save = () => {
    const validationError = validateMenuBarItems(items);
    if (validationError) {
      setError(validationError);
      return;
    }
    onSave(serializeMenuBarItems(items));
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-bar-items-title"
        aria-describedby="menu-bar-items-description"
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${
          isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'
        }`}
      >
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <Menu className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0 flex-1">
            <h2 id="menu-bar-items-title" className="truncate text-sm font-bold sm:text-base">编辑菜单项 · {controlName}</h2>
            <p id="menu-bar-items-description" className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              每行对应一个顶级菜单项，可调整顺序。保存后会同步到设计画布与生成的原生程序。
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="取消并关闭菜单项编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <button type="button" onClick={() => addItem()} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增菜单项</button>
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{items.length} 个菜单项</span>
        </div>

        <main className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          {items.length === 0 ? (
            <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
              <Menu className="mb-2 h-7 w-7" />
              <p className="text-sm font-semibold">还没有菜单项</p>
              <p className="mt-1 text-xs">新增第一个菜单项后，再编辑它在窗口菜单栏中显示的名称。</p>
              <button type="button" onClick={() => addItem()} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一项</button>
            </div>
          ) : (
            <ol className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className={`flex min-w-0 items-center gap-2 rounded border p-2 ${isDarkMode ? 'border-[#35353e] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
                  <span className="w-6 shrink-0 text-center font-mono text-[11px] text-slate-500">{index + 1}</span>
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    data-menu-item-index={index}
                    aria-label={`第 ${index + 1} 个菜单项名称`}
                    value={item}
                    onChange={event => {
                      setItems(current => current.map((currentItem, currentIndex) => currentIndex === index ? event.target.value : currentItem));
                      setError('');
                    }}
                    className={inputClass}
                  />
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button type="button" aria-label={`复制第 ${index + 1} 个菜单项`} title="复制" onClick={() => {
                      const next = [...items];
                      next.splice(index + 1, 0, item);
                      nextFocusIndexRef.current = index + 1;
                      setItems(next);
                    }} className={iconButton}><Copy className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`上移第 ${index + 1} 个菜单项`} title="上移" disabled={index === 0} onClick={() => setItems(moveItem(items, index, index - 1))} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`下移第 ${index + 1} 个菜单项`} title="下移" disabled={index === items.length - 1} onClick={() => setItems(moveItem(items, index, index + 1))} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`删除第 ${index + 1} 个菜单项`} title="删除" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
          {error && <p role="alert" className="mt-3 rounded border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{error}</p>}
        </main>

        <footer className={`flex shrink-0 items-center justify-end gap-2 border-t px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
          <button type="button" onClick={onClose} className={secondaryButton}>取消</button>
          <button type="button" onClick={save} className="inline-flex h-8 items-center justify-center gap-1.5 rounded bg-cyan-600 px-3 text-xs font-semibold text-white outline-none hover:bg-cyan-500 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40">
            <Save className="h-3.5 w-3.5" />保存修改
          </button>
        </footer>
      </div>
    </div>
  );
}
