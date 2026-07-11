import React, { useEffect, useId, useRef, useState } from 'react';
import { Command as CommandIcon, CornerDownLeft, Search, X } from 'lucide-react';

import type { CommandPresentation } from '../services/commands';
import {
  clampCommandPaletteSelection,
  moveCommandPaletteSelection,
  scrollCommandPaletteOptionIntoView
} from '../services/commands';

interface CommandPaletteProps {
  open: boolean;
  query: string;
  commands: CommandPresentation[];
  isDarkMode: boolean;
  onQueryChange: (query: string) => void;
  onExecute: (commandId: string) => Promise<boolean | void>;
  onClose: () => void;
}

export default function CommandPalette({
  open,
  query,
  commands,
  isDarkMode,
  onQueryChange,
  onExecute,
  onClose
}: CommandPaletteProps) {
  const titleId = useId();
  const listboxId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!open) return;
    setExecutingId(null);
    setStatus(commands.length > 0 ? `找到 ${commands.length} 个命令。` : '没有匹配的命令。');
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    setSelectedIndex(current => clampCommandPaletteSelection(current, commands.length));
    setStatus(commands.length > 0 ? `找到 ${commands.length} 个命令。` : '没有匹配的命令。');
  }, [commands.length]);

  useEffect(() => {
    setSelectedIndex(commands.length > 0 ? 0 : -1);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    scrollCommandPaletteOptionIntoView(listboxRef.current, selectedIndex);
  }, [commands.length, open, selectedIndex]);

  if (!open) return null;

  const selected = selectedIndex >= 0 ? commands[selectedIndex] : undefined;
  const execute = async (command: CommandPresentation) => {
    if (!command.enabled || executingId) return;
    setExecutingId(command.id);
    setStatus(`正在执行“${command.title}”…`);
    try {
      const shouldClose = await onExecute(command.id);
      if (shouldClose === false) {
        setStatus(`“${command.title}”未完成或已取消，请查看输出面板。`);
        return;
      }
      setStatus(`已执行“${command.title}”。`);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '命令执行失败。');
    } finally {
      setExecutingId(null);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const move = event.key === 'ArrowDown'
        ? 'next'
        : event.key === 'ArrowUp'
          ? 'previous'
          : event.key === 'Home'
            ? 'first'
            : 'last';
      setSelectedIndex(current => moveCommandPaletteSelection(current, commands.length, move));
      return;
    }
    if (event.key === 'Enter' && selected) {
      event.preventDefault();
      void execute(selected);
      return;
    }
    if (event.key === 'Tab') trapFocus(event, dialogRef.current);
  };

  const activeDescendant = selected ? `${listboxId}-option-${selectedIndex}` : undefined;
  const surface = isDarkMode ? 'bg-[#252526] text-slate-100 border-[#454545]' : 'bg-white text-slate-900 border-slate-300';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-600';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 px-4 pt-[9vh]"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className={`w-[min(680px,calc(100vw-32px))] overflow-hidden rounded-lg border shadow-2xl ${surface}`}
      >
        <div className={`flex items-center gap-3 border-b px-4 ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
          <Search className={`h-4 w-4 shrink-0 ${muted}`} aria-hidden="true" />
          <label id={titleId} htmlFor="lingbuilder-command-query" className="sr-only">命令面板</label>
          <input
            ref={inputRef}
            id="lingbuilder-command-query"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="输入中文命令、英文 alias 或命令 ID"
            className={`h-12 min-w-0 flex-1 bg-transparent text-sm outline-none ${isDarkMode ? 'placeholder:text-slate-500' : 'placeholder:text-slate-400'}`}
          />
          <kbd className={`rounded border px-1.5 py-0.5 text-[10px] ${isDarkMode ? 'border-[#555] bg-[#333] text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-600'}`}>Esc</kbd>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭命令面板"
            className={`rounded p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isDarkMode ? 'hover:bg-[#3a3a3a]' : 'hover:bg-slate-100'}`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div ref={listboxRef} id={listboxId} role="listbox" aria-label="可用命令" className="max-h-[min(56vh,420px)] overflow-y-auto p-2">
          {commands.length === 0 ? (
            <div className={`flex min-h-28 flex-col items-center justify-center gap-2 px-4 text-center text-xs ${muted}`}>
              <CommandIcon className="h-6 w-6" aria-hidden="true" />
              <span>没有匹配命令。可尝试“保存”“设置”“build”等关键词。</span>
            </div>
          ) : commands.map((command, index) => {
            const active = index === selectedIndex;
            const disabled = !command.enabled || executingId !== null;
            return (
              <button
                type="button"
                role="option"
                id={`${listboxId}-option-${index}`}
                data-command-index={index}
                key={command.id}
                aria-selected={active}
                aria-disabled={disabled}
                disabled={disabled}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => void execute(command)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${
                  active
                    ? isDarkMode ? 'bg-[#094771] text-white' : 'bg-sky-100 text-sky-950'
                    : isDarkMode ? 'hover:bg-[#2f2f30]' : 'hover:bg-slate-100'
                } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
              >
                <CommandIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{command.title}</span>
                    {command.category && <span className={`text-[10px] ${active ? 'opacity-75' : muted}`}>{command.category}</span>}
                  </span>
                  <span className={`block truncate font-mono text-[10px] ${active ? 'opacity-75' : muted}`}>{command.id}</span>
                </span>
                {command.keybindings[0] && (
                  <kbd className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${active ? 'border-current/30 bg-black/10' : isDarkMode ? 'border-[#555] bg-[#333]' : 'border-slate-300 bg-slate-50'}`}>
                    {command.keybindings[0]}
                  </kbd>
                )}
                {active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <div className={`flex min-h-8 items-center justify-between border-t px-3 text-[10px] ${isDarkMode ? 'border-[#3c3c3c] bg-[#1e1e1e] text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          <span>↑↓ 选择 · Enter 执行 · Esc 关闭</span>
          <span aria-live="polite" aria-atomic="true">{status}</span>
        </div>
      </div>
    </div>
  );
}

function trapFocus(event: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
