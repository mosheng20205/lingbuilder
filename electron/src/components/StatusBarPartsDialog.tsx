import { useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, Copy, PanelBottom, Plus, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  appendStatusBarPart,
  duplicateStatusBarPart,
  moveStatusBarPart,
  normalizeStatusBarParts,
  removeStatusBarPart,
  type StatusBarEditablePart
} from '../services/windowDesigner/statusBarPartCollectionModel';

interface StatusBarPartsDialogProps {
  controlName: string;
  value: Win32ControlPropertyValue | undefined;
  isDarkMode: boolean;
  onChange: (parts: StatusBarEditablePart[]) => void;
  onClose: () => void;
}

export default function StatusBarPartsDialog({
  controlName,
  value,
  isDarkMode,
  onChange,
  onClose
}: StatusBarPartsDialogProps) {
  const parts = useMemo(() => normalizeStatusBarParts(value), [value]);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
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

  const inputClass = `h-8 w-full min-w-0 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode
      ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const secondaryButton = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode
      ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]'
      : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
  }`;

  const updatePart = (index: number, fields: Partial<StatusBarEditablePart>) => {
    onChange(parts.map((part, partIndex) => partIndex === index ? { ...part, ...fields } : part));
  };
  const addPart = () => onChange(appendStatusBarPart(parts));
  const renderActions = (index: number) => (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" aria-label={`复制第 ${index + 1} 个状态栏分区`} title="复制分区" onClick={() => onChange(duplicateStatusBarPart(parts, index))} className={iconButton}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`上移第 ${index + 1} 个状态栏分区`} title="上移" disabled={index === 0} onClick={() => onChange(moveStatusBarPart(parts, index, index - 1))} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`下移第 ${index + 1} 个状态栏分区`} title="下移" disabled={index === parts.length - 1} onClick={() => onChange(moveStatusBarPart(parts, index, index + 1))} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`删除第 ${index + 1} 个状态栏分区`} title="删除分区" onClick={() => onChange(removeStatusBarPart(parts, index))} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );
  const renderFields = (part: StatusBarEditablePart, index: number, compact = false) => [
    <label key="title" className={compact ? 'block text-[10px] text-slate-500' : ''}>
      {compact && '文字'}
      <input aria-label={`第 ${index + 1} 个状态栏分区文字`} value={part.title} onChange={event => updatePart(index, { title: event.target.value })} placeholder="分区显示文字" className={`${inputClass} ${compact ? 'mt-1' : ''}`} />
    </label>,
    <label key="width" className={compact ? 'block text-[10px] text-slate-500' : ''}>
      {compact && '宽度'}
      <input aria-label={`第 ${index + 1} 个状态栏分区宽度`} type="number" min={1} max={10000} value={part.width} onChange={event => updatePart(index, { width: Math.min(10000, Math.max(1, Math.trunc(Number(event.target.value) || 1))) })} className={`${inputClass} ${compact ? 'mt-1' : ''}`} />
    </label>
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="statusbar-parts-title" aria-describedby="statusbar-parts-description" className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <PanelBottom className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1">
            <h2 id="statusbar-parts-title" className="truncate text-sm font-bold sm:text-base">编辑状态栏分区 · {controlName}</h2>
            <p id="statusbar-parts-description" className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>分区顺序、文字和宽度会立即同步到设计器与生成的原生程序；最后一个分区会自动填充剩余空间。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭状态栏分区编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <button type="button" onClick={addPart} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增分区</button>
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{parts.length} 个分区</span>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {parts.length === 0 ? (
            <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
              <PanelBottom className="mb-2 h-7 w-7" />
              <p className="text-sm font-semibold">还没有自定义分区</p>
              <p className="mt-1 text-xs">未配置时状态栏使用“显示内容”；新增分区后可分别设置文字与宽度。</p>
              <button type="button" onClick={addPart} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一个分区</button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[620px] border-separate border-spacing-0 text-left text-xs">
                  <thead><tr className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><th className="w-16 border-b p-2">序号</th><th className="border-b p-2">文字</th><th className="w-40 border-b p-2">宽度</th><th className="w-36 border-b p-2 text-right">操作</th></tr></thead>
                  <tbody>{parts.map((part, index) => <tr key={index} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-100/60'}><td className="border-b p-2 font-mono text-slate-500">{index + 1}</td>{renderFields(part, index).map((field, fieldIndex) => <td key={fieldIndex} className="border-b p-2">{field}</td>)}<td className="border-b p-2">{renderActions(index)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{parts.map((part, index) => <section key={index} className={`rounded border p-3 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">第 {index + 1} 个分区</span>{renderActions(index)}</div><div className="grid gap-3 sm:grid-cols-2">{renderFields(part, index, true)}</div></section>)}</div>
            </>
          )}
        </main>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t px-3 py-2.5 sm:px-5 ${isDarkMode ? 'border-[#35353e] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
          <span className="text-[10px] text-slate-500">宽度单位为像素，至少为 1；双击事件可通过状态栏分区索引区分来源。</span>
          <button type="button" onClick={onClose} className={secondaryButton}>完成</button>
        </footer>
      </div>
    </div>
  );
}
