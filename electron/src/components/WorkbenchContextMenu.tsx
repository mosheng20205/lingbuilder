import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight } from 'lucide-react';
import type { ResolvedMenuCommandItem, ResolvedMenuItem, ResolvedSubmenuItem } from '../services/menus';

interface WorkbenchContextMenuProps {
  x: number;
  y: number;
  items: readonly ResolvedMenuItem[];
  isDarkMode: boolean;
  ariaLabel: string;
  onExecute: (item: ResolvedMenuCommandItem) => void | Promise<void>;
  onClose: () => void;
}

export default function WorkbenchContextMenu(props: WorkbenchContextMenuProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(typeof document === 'undefined' ? null : document.activeElement as HTMLElement | null);
  const [position, setPosition] = useState({ left: props.x, top: props.y });

  useLayoutEffect(() => {
    const element = rootRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(4, Math.min(props.x, window.innerWidth - rect.width - 4)),
      top: Math.max(4, Math.min(props.y, window.innerHeight - rect.height - 4))
    });
  }, [props.items, props.x, props.y]);

  useEffect(() => {
    const close = (event: Event) => {
      if (event.type === 'pointerdown' && rootRef.current?.contains(event.target as Node)) return;
      props.onClose();
    };
    window.addEventListener('pointerdown', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [props.onClose]);

  useEffect(() => () => {
    const target = restoreFocusRef.current;
    if (target?.isConnected) target.focus();
  }, []);

  if (!props.items.length) return null;
  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[400]"
      style={position}
      onContextMenu={event => event.preventDefault()}
    >
      <MenuLevel {...props} autoFocus onRequestCloseSubmenu={props.onClose} />
    </div>,
    document.body
  );
}

interface MenuLevelProps extends Omit<WorkbenchContextMenuProps, 'x' | 'y'> {
  autoFocus?: boolean;
  onRequestCloseSubmenu: () => void;
}

function MenuLevel({
  items,
  isDarkMode,
  ariaLabel,
  onExecute,
  onClose,
  autoFocus,
  onRequestCloseSubmenu
}: MenuLevelProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeIndex, setActiveIndex] = useState(() => firstEnabledIndex(items));
  const [openSubmenuIndex, setOpenSubmenuIndex] = useState<number | null>(null);

  useEffect(() => {
    if (autoFocus && activeIndex >= 0) itemRefs.current[activeIndex]?.focus();
  }, [activeIndex, autoFocus]);

  const focusExact = (index: number) => {
    if (index < 0) return;
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  };

  return (
    <div
      role="menu"
      aria-label={ariaLabel}
      className={`min-w-52 max-w-80 overflow-visible rounded-md border py-1 text-xs shadow-2xl ${
        isDarkMode ? 'border-[#45454f] bg-[#252526] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
      }`}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
        if (event.key === 'ArrowDown') { event.preventDefault(); focusExact(nextEnabledIndex(items, activeIndex, 1)); return; }
        if (event.key === 'ArrowUp') { event.preventDefault(); focusExact(nextEnabledIndex(items, activeIndex, -1)); return; }
        if (event.key === 'Home') { event.preventDefault(); focusExact(firstEnabledIndex(items)); return; }
        if (event.key === 'End') { event.preventDefault(); focusExact(lastEnabledIndex(items)); return; }
        if (event.key === 'ArrowLeft') { event.preventDefault(); onRequestCloseSubmenu(); }
      }}
    >
      {items.map((item, index) => {
        if (item.kind === 'separator') return (
          <div key={item.id} role="separator" className={isDarkMode ? 'my-1 border-t border-[#3c3c44]' : 'my-1 border-t border-slate-200'} />
        );
        if (item.kind === 'submenu') return (
          <SubmenuRow
            key={item.id}
            item={item}
            index={index}
            buttonRef={element => { itemRefs.current[index] = element; }}
            active={openSubmenuIndex === index}
            isDarkMode={isDarkMode}
            onOpen={() => { setActiveIndex(index); setOpenSubmenuIndex(index); }}
            onClose={() => setOpenSubmenuIndex(null)}
            onExecute={onExecute}
            onCloseMenu={onClose}
          />
        );
        return (
          <button
            key={item.id}
            ref={element => { itemRefs.current[index] = element; }}
            type="button"
            role="menuitem"
            disabled={!item.command.enabled}
            title={!item.command.enabled ? '命令在当前上下文中不可用' : item.command.description}
            className={`flex w-full items-center gap-3 px-3 py-1.5 text-left outline-none ${
              isDarkMode ? 'focus:bg-[#094771] hover:bg-[#094771]' : 'focus:bg-blue-50 hover:bg-blue-50'
            } disabled:cursor-not-allowed disabled:opacity-40`}
            onFocus={() => { setActiveIndex(index); setOpenSubmenuIndex(null); }}
            onClick={() => { if (item.command.enabled) void onExecute(item); }}
          >
            <span className="min-w-0 flex-1 truncate">{item.command.title}</span>
            {item.command.keybindings[0] && <span className="shrink-0 text-[10px] opacity-55">{item.command.keybindings[0]}</span>}
          </button>
        );
      })}
    </div>
  );
}

function SubmenuRow({ item, index, buttonRef, active, isDarkMode, onOpen, onClose, onExecute, onCloseMenu }: {
  item: ResolvedSubmenuItem;
  index: number;
  buttonRef: (element: HTMLButtonElement | null) => void;
  active: boolean;
  isDarkMode: boolean;
  onOpen: () => void;
  onClose: () => void;
  onExecute: (item: ResolvedMenuCommandItem) => void | Promise<void>;
  onCloseMenu: () => void;
}) {
  const anchorRef = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ left: '100%', top: 0 });
  useLayoutEffect(() => {
    if (!active || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const estimatedWidth = 240;
    setPosition({
      left: rect.right + estimatedWidth > window.innerWidth ? '-100%' : '100%',
      top: Math.max(-rect.top + 4, Math.min(0, window.innerHeight - rect.top - 320))
    });
  }, [active]);
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        ref={element => { anchorRef.current = element; buttonRef(element); }}
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={active}
        className={`flex w-full items-center gap-3 px-3 py-1.5 text-left outline-none ${
          isDarkMode ? 'focus:bg-[#094771] hover:bg-[#094771]' : 'focus:bg-blue-50 hover:bg-blue-50'
        }`}
        onFocus={onOpen}
        onClick={onOpen}
        onKeyDown={event => {
          if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onOpen();
          }
        }}
      >
        <span className="min-w-0 flex-1 truncate">{item.title}</span>
        <ChevronRight className="h-3.5 w-3.5 opacity-60" />
      </button>
      {active && (
        <div className="absolute z-[410]" style={position}>
          <MenuLevel
            items={item.items}
            isDarkMode={isDarkMode}
            ariaLabel={item.title}
            onExecute={onExecute}
            onClose={onCloseMenu}
            autoFocus={false}
            onRequestCloseSubmenu={() => { onClose(); anchorRef.current?.focus(); }}
          />
        </div>
      )}
    </div>
  );
}

function firstEnabledIndex(items: readonly ResolvedMenuItem[]): number {
  return items.findIndex(item => item.kind === 'submenu' || (item.kind === 'command' && item.command.enabled));
}

function lastEnabledIndex(items: readonly ResolvedMenuItem[]): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item.kind === 'submenu' || (item.kind === 'command' && item.command.enabled)) return index;
  }
  return -1;
}

function nextEnabledIndex(items: readonly ResolvedMenuItem[], current: number, direction: number): number {
  if (!items.length) return -1;
  const step = direction < 0 ? -1 : 1;
  let index = current;
  for (let count = 0; count < items.length; count += 1) {
    index = (index + step + items.length) % items.length;
    const item = items[index];
    if (item.kind === 'submenu' || (item.kind === 'command' && item.command.enabled)) return index;
  }
  return -1;
}
