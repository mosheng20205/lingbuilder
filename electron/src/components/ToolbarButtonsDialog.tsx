import { useEffect, useMemo, useRef } from 'react';
import { ArrowDown, ArrowUp, Copy, PanelTop, Plus, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  appendToolbarButton,
  duplicateToolbarButton,
  moveToolbarButton,
  normalizeToolbarButtons,
  removeToolbarButton,
  type ToolbarButtonStyle,
  type ToolbarEditableButton
} from '../services/windowDesigner/toolbarButtonCollectionModel';

interface ToolbarButtonsDialogProps {
  controlName: string;
  value: Win32ControlPropertyValue | undefined;
  hasImageList: boolean;
  isDarkMode: boolean;
  onChange: (buttons: ToolbarEditableButton[]) => void;
  onClose: () => void;
}

const STYLE_OPTIONS: Array<{ value: ToolbarButtonStyle; label: string }> = [
  { value: 'button', label: '普通按钮' },
  { value: 'check', label: '切换按钮' },
  { value: 'separator', label: '分隔符' },
  { value: 'dropdown', label: '下拉按钮' }
];

export default function ToolbarButtonsDialog({
  controlName,
  value,
  hasImageList,
  isDarkMode,
  onChange,
  onClose
}: ToolbarButtonsDialogProps) {
  const buttons = useMemo(() => normalizeToolbarButtons(value), [value]);
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

  const updateButton = (index: number, fields: Partial<ToolbarEditableButton>) => {
    onChange(buttons.map((button, buttonIndex) => buttonIndex === index ? { ...button, ...fields } : button));
  };
  const addButton = () => onChange(appendToolbarButton(buttons));

  const renderActions = (index: number) => (
    <div className="flex items-center justify-end gap-0.5">
      <button type="button" aria-label={`复制第 ${index + 1} 个工具栏按钮`} title="复制按钮" onClick={() => onChange(duplicateToolbarButton(buttons, index))} className={iconButton}><Copy className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`上移第 ${index + 1} 个工具栏按钮`} title="上移" disabled={index === 0} onClick={() => onChange(moveToolbarButton(buttons, index, index - 1))} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`下移第 ${index + 1} 个工具栏按钮`} title="下移" disabled={index === buttons.length - 1} onClick={() => onChange(moveToolbarButton(buttons, index, index + 1))} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
      <button type="button" aria-label={`删除第 ${index + 1} 个工具栏按钮`} title="删除按钮" onClick={() => onChange(removeToolbarButton(buttons, index))} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
    </div>
  );

  const renderFields = (button: ToolbarEditableButton, index: number, compact = false) => [
      <label key="id" className={compact ? 'block text-[10px] text-slate-500' : ''}>
        {compact && '命令 ID'}
        <input aria-label={`第 ${index + 1} 个工具栏按钮命令 ID`} type="number" min={1} max={65535} value={button.id} onChange={event => updateButton(index, { id: Math.min(65535, Math.max(1, Math.trunc(Number(event.target.value) || 1))) })} className={`${inputClass} ${compact ? 'mt-1' : ''}`} />
      </label>,
      <label key="title" className={compact ? 'block text-[10px] text-slate-500' : ''}>
        {compact && '文字'}
        <input aria-label={`第 ${index + 1} 个工具栏按钮文字`} value={button.title} disabled={button.style === 'separator'} onChange={event => updateButton(index, { title: event.target.value })} placeholder={button.style === 'separator' ? '分隔符不显示文字' : '按钮文字'} className={`${inputClass} ${compact ? 'mt-1' : ''}`} />
      </label>,
      <label key="image" className={compact ? 'block text-[10px] text-slate-500' : ''}>
        {compact && '图片编号'}
        <input aria-label={`第 ${index + 1} 个工具栏按钮图片编号`} type="number" min={-1} value={button.image} disabled={!hasImageList || button.style === 'separator'} onChange={event => updateButton(index, { image: Math.max(-1, Math.trunc(Number(event.target.value) || 0)) })} title={hasImageList ? '图像列表中的图片序号，-1 表示不使用图片' : '请先为工具栏选择图像列表'} className={`${inputClass} ${compact ? 'mt-1' : ''}`} />
      </label>,
      <label key="style" className={compact ? 'block text-[10px] text-slate-500' : ''}>
        {compact && '样式'}
        <select aria-label={`第 ${index + 1} 个工具栏按钮样式`} value={button.style} onChange={event => updateButton(index, { style: event.target.value as ToolbarButtonStyle })} className={`${inputClass} ${compact ? 'mt-1' : ''}`}>
          {STYLE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
  ];

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="toolbar-buttons-title" aria-describedby="toolbar-buttons-description" className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <PanelTop className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1">
            <h2 id="toolbar-buttons-title" className="truncate text-sm font-bold sm:text-base">编辑工具栏按钮 · {controlName}</h2>
            <p id="toolbar-buttons-description" className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>按钮顺序、命令 ID、文字、图片和样式会立即同步到设计器与生成的原生程序。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="关闭工具栏按钮编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <button type="button" onClick={addButton} className={secondaryButton}><Plus className="h-3.5 w-3.5" />新增按钮</button>
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{buttons.length} 个项目</span>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {buttons.length === 0 ? (
            <div className={`flex min-h-48 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>
              <PanelTop className="mb-2 h-7 w-7" />
              <p className="text-sm font-semibold">还没有工具栏按钮</p>
              <p className="mt-1 text-xs">新增按钮后，使用命令 ID 在“按钮被单击”事件中区分操作。</p>
              <button type="button" onClick={addButton} className={`${secondaryButton} mt-3`}><Plus className="h-3.5 w-3.5" />新增第一个按钮</button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[820px] border-separate border-spacing-0 text-left text-xs">
                  <thead><tr className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><th className="w-14 border-b p-2">序号</th><th className="w-28 border-b p-2">命令 ID</th><th className="border-b p-2">文字</th><th className="w-28 border-b p-2">图片编号</th><th className="w-36 border-b p-2">样式</th><th className="w-36 border-b p-2 text-right">操作</th></tr></thead>
                  <tbody>{buttons.map((button, index) => <tr key={index} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-100/60'}><td className="border-b p-2 font-mono text-slate-500">{index + 1}</td>{renderFields(button, index).map((field, fieldIndex) => <td key={fieldIndex} className="border-b p-2">{field}</td>)}<td className="border-b p-2">{renderActions(index)}</td></tr>)}</tbody>
                </table>
              </div>
              <div className="space-y-2 md:hidden">{buttons.map((button, index) => <section key={index} className={`rounded border p-3 ${isDarkMode ? 'border-[#3d3d46] bg-[#202026]' : 'border-slate-200 bg-white'}`}><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">第 {index + 1} 个项目</span>{renderActions(index)}</div><div className="grid gap-3 sm:grid-cols-2">{renderFields(button, index, true)}</div></section>)}</div>
            </>
          )}
        </main>

        <footer className={`flex shrink-0 items-center justify-between gap-3 border-t px-3 py-2.5 sm:px-5 ${isDarkMode ? 'border-[#35353e] bg-[#202026]' : 'border-slate-200 bg-white'}`}>
          <span className="text-[10px] text-slate-500">图片编号 -1 表示不使用图片；命令 ID 用于读取“工具栏_最后命令()”。</span>
          <button type="button" onClick={onClose} className={secondaryButton}>完成</button>
        </footer>
      </div>
    </div>
  );
}
