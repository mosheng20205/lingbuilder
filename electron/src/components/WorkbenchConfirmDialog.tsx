import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';

export type WorkbenchConfirmDialogKind = 'confirm' | 'alert' | 'prompt';

export interface WorkbenchConfirmDialogProps {
  open: boolean;
  /** 对话框形态：confirm=取消/确认；alert=单按钮提示；prompt=输入框+取消/确认。默认 confirm。 */
  kind?: WorkbenchConfirmDialogKind;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  inputLabel?: string;
  /** prompt 初始输入值。 */
  inputValue?: string;
  inputPlaceholder?: string;
  isDarkMode: boolean;
  /** confirm→boolean；prompt→输入文本或 null（取消）；alert→true。 */
  onResult: (result: boolean | string | null) => void;
}

/**
 * 工作台内非阻塞确认/提示/输入对话框。
 *
 * 用于替代异步流程中的 window.confirm/alert/prompt：
 * 原生对话框会同步阻塞渲染进程主线程，导致工作台全部输入
 * （包括其他已打开的 React 对话框）在等待用户期间失去响应。
 */
export default function WorkbenchConfirmDialog({
  open,
  kind = 'confirm',
  title,
  description,
  confirmLabel = '确定',
  cancelLabel = '取消',
  inputLabel,
  inputValue = '',
  inputPlaceholder,
  isDarkMode,
  onResult
}: WorkbenchConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftValue, setDraftValue] = useState(inputValue);

  useEffect(() => {
    if (!open) return;
    if (kind === 'prompt') {
      setDraftValue(inputValue);
      const frame = window.requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => window.cancelAnimationFrame(frame);
    }
    const frame = window.requestAnimationFrame(() => cancelRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, kind, inputValue]);

  if (!open) return null;

  const submitPrompt = () => onResult(draftValue);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onResult(kind === 'prompt' ? null : false);
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      // 输入框内回车直接提交；按钮上的回车走原生 click。
      event.stopPropagation();
      if (kind === 'prompt') submitPrompt();
      else onResult(true);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workbench-confirm-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`w-full max-w-md rounded-lg border shadow-2xl ${
          isDarkMode
            ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 id="workbench-confirm-dialog-title" className="text-sm font-semibold">{title}</h2>
          {description && (
            <p className={`mt-1 text-[11px] leading-5 whitespace-pre-line ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {description}
            </p>
          )}
        </div>
        {kind === 'prompt' && (
          <div className="px-4 pt-3">
            <label htmlFor="workbench-confirm-dialog-input" className="mb-1.5 block text-xs font-medium">
              {inputLabel || title}
            </label>
            <input
              ref={inputRef}
              id="workbench-confirm-dialog-input"
              aria-label={inputLabel || title}
              value={draftValue}
              placeholder={inputPlaceholder}
              onChange={event => setDraftValue(event.target.value)}
              className={`w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
                isDarkMode
                  ? 'border-[#414149] bg-[#25252c] text-slate-100'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>
        )}
        <div className="flex justify-end gap-2 px-4 py-3">
          {kind !== 'alert' && (
            <button
              type="button"
              ref={cancelRef}
              onClick={() => onResult(kind === 'prompt' ? null : false)}
              className={`cursor-pointer rounded border px-3 py-1.5 text-xs transition-colors ${
                isDarkMode
                  ? 'border-[#484850] text-slate-300 hover:bg-[#303038] hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            ref={kind === 'alert' ? cancelRef : undefined}
            autoFocus={kind === 'alert'}
            onClick={() => (kind === 'prompt' ? submitPrompt() : onResult(true))}
            className="cursor-pointer rounded bg-blue-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-500"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
