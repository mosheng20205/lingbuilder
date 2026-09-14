import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import {
  BeginnerTypeCompletionItem,
  filterBeginnerTypeCompletions,
  resolveBeginnerTypeAlias
} from '../services/lingCpp/beginnerTypeCompletion';

interface SearchableTypeSelectProps {
  value: string;
  items: BeginnerTypeCompletionItem[];
  inputClassName: string;
  isDarkMode: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onValueChange?: (value: string) => void;
  onCommit?: (value: string) => void;
  rootClassName?: string;
}

export default function SearchableTypeSelect({
  value,
  items,
  inputClassName,
  isDarkMode,
  disabled,
  ariaLabel,
  onValueChange,
  onCommit,
  rootClassName
}: SearchableTypeSelectProps) {
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties | null>(null);

  useEffect(() => setInputValue(value), [value]);

  const visibleItems = useMemo(
    () => searching ? filterBeginnerTypeCompletions(items, inputValue, true) : items,
    [inputValue, items, searching]
  );

  const updateMenuPosition = () => {
    if (!rootRef.current || typeof window === 'undefined') return;
    const rect = rootRef.current.getBoundingClientRect();
    const menuWidth = Math.min(Math.max(rect.width, 240), Math.max(240, window.innerWidth - 16));
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - menuWidth - 8));
    const below = Math.max(0, window.innerHeight - rect.bottom - 8);
    const above = Math.max(0, rect.top - 8);
    const placeBelow = below >= 160 || below >= above;
    setMenuStyle(placeBelow
      ? { position: 'fixed', left, top: rect.bottom + 4, width: menuWidth, maxHeight: Math.max(96, Math.min(256, below)) }
      : { position: 'fixed', left, bottom: window.innerHeight - rect.top + 4, width: menuWidth, maxHeight: Math.max(96, Math.min(256, above)) });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPosition();
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [open]);

  const openAll = () => {
    if (disabled) return;
    setSearching(false);
    setActiveIndex(Math.max(0, items.findIndex(item => item.label === value)));
    updateMenuPosition();
    setOpen(true);
  };

  const selectValue = (nextValue: string) => {
    setInputValue(nextValue);
    onValueChange?.(nextValue);
    onCommit?.(nextValue);
    setOpen(false);
    setSearching(false);
  };

  const commitTypedValue = () => {
    const resolved = resolveBeginnerTypeAlias(items, inputValue);
    if (!items.some(item => item.label === resolved)) {
      setInputValue(value);
      onValueChange?.(value);
      return;
    }
    setInputValue(resolved);
    onValueChange?.(resolved);
    if (resolved !== value) onCommit?.(resolved);
  };

  return (
    <div
      ref={rootRef}
      className={rootClassName || 'relative min-w-[150px]'}
      onBlur={() => window.setTimeout(() => {
        if (rootRef.current?.contains(document.activeElement)) return;
        commitTypedValue();
        setOpen(false);
        setSearching(false);
      }, 0)}
    >
      <input
        ref={inputRef}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        className={`${inputClassName} pr-8`}
        value={inputValue}
        disabled={disabled}
        onFocus={openAll}
        onClick={() => {
          if (!open) openAll();
        }}
        onChange={event => {
          setInputValue(event.target.value);
          onValueChange?.(event.target.value);
          setSearching(true);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) {
              openAll();
              return;
            }
            const direction = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(index => visibleItems.length === 0
              ? 0
              : (index + direction + visibleItems.length) % visibleItems.length);
          } else if (event.key === 'Enter' && open && visibleItems[activeIndex]) {
            event.preventDefault();
            selectValue(visibleItems[activeIndex].label);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            setInputValue(value);
            onValueChange?.(value);
            setOpen(false);
            setSearching(false);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label={`${ariaLabel}：显示全部类型`}
        className="absolute right-0 top-0 flex h-full w-8 items-center justify-center rounded-r text-slate-500 hover:text-blue-500 disabled:opacity-40"
        disabled={disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            inputRef.current?.focus();
            openAll();
          }
        }}
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && !disabled && menuStyle && typeof document !== 'undefined' && createPortal(
        <div
          id={listboxId}
          role="listbox"
          style={menuStyle}
          className={`z-[10000] overflow-auto rounded border py-1 shadow-xl ${
            isDarkMode ? 'border-[#3b3b45] bg-[#24242c] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
          }`}
        >
          {visibleItems.length > 0 ? visibleItems.map((item, index) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={item.label === inputValue}
              className={`flex w-full items-center gap-4 whitespace-nowrap px-3 py-1.5 text-left text-xs ${
                index === activeIndex
                  ? 'bg-blue-600 text-white'
                  : isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
              }`}
              onMouseDown={event => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectValue(item.label)}
            >
              <span className="font-semibold">{item.label}</span>
              <span className={index === activeIndex ? 'text-blue-100' : 'text-slate-500'}>{item.detail}</span>
            </button>
          )) : (
            <div className="px-3 py-2 text-xs text-slate-500">没有匹配的类型</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
