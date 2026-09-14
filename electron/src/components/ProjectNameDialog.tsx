import React, { FormEvent, useEffect, useRef, useState } from 'react';

interface ProjectNameDialogProps {
  open: boolean;
  value: string;
  isDarkMode: boolean;
  busy?: boolean;
  error?: string;
  title?: string;
  description?: string;
  label?: string;
  confirmLabel?: string;
  busyLabel?: string;
  dialogId?: string;
  inputId?: string;
  /** 可选：解决方案名称字段；提供回调时才显示该输入框。 */
  solutionName?: string;
  onSolutionNameChange?: (value: string) => void;
  solutionNameHint?: string;
  /** 可选：创建位置（目录）字段；提供回调时才显示该输入框。 */
  location?: string;
  onLocationChange?: (value: string) => void;
  locationPlaceholder?: string;
  locationHint?: string;
  onChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  /**
   * 可选：busy 期间的「取消等待」回调。提供后，busy 时取消按钮与 Esc 键不再被禁用，
   * 点击会中止等待并关闭对话框；不提供时保持旧行为（busy 期间禁止关闭）。
   */
  onCancelBusy?: () => void;
}

export default function ProjectNameDialog({
  open,
  value,
  isDarkMode,
  busy = false,
  error,
  title = '新建解决方案项目',
  description = '将在当前工作区创建中文源码、配置文件和窗口设计器模型。',
  label = '项目名称',
  confirmLabel = '创建项目',
  busyLabel = '正在创建…',
  dialogId = 'create-project-dialog-title',
  inputId = 'create-project-name',
  solutionName,
  onSolutionNameChange,
  solutionNameHint,
  location,
  onLocationChange,
  locationPlaceholder,
  locationHint,
  onChange,
  onConfirm,
  onClose,
  onCancelBusy
}: ProjectNameDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [showUnresponsiveHint, setShowUnresponsiveHint] = useState(false);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    // busy 超过 10 秒仍未完成时提示本地服务无响应，等待结束后自动复位。
    if (!open || !busy) {
      setShowUnresponsiveHint(false);
      return;
    }
    const timer = window.setTimeout(() => setShowUnresponsiveHint(true), 10_000);
    return () => window.clearTimeout(timer);
  }, [busy, open]);

  const cancelDialog = () => {
    if (busy && onCancelBusy) {
      onCancelBusy();
      return;
    }
    onClose();
  };

  if (!open) return null;

  const inputClassName = `w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
    isDarkMode
      ? 'border-[#414149] bg-[#25252c] text-slate-100'
      : 'border-slate-300 bg-white text-slate-900'
  }`;
  const hintClassName = `mt-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (busy || !value.trim()) return;
    void onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby={dialogId}
        onKeyDown={event => {
          if (event.key !== 'Escape') return;
          if (busy && !onCancelBusy) return;
          cancelDialog();
        }}
    >
      <form
        onSubmit={submit}
        className={`w-full max-w-md rounded-lg border shadow-2xl ${
          isDarkMode
            ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 id={dialogId} className="text-sm font-semibold">{title}</h2>
          <p className={`mt-1 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            {description}
          </p>
        </div>

        <div className="px-4 py-4">
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium">{label}</label>
          <input
            ref={inputRef}
            id={inputId}
            aria-label={label}
            value={value}
            disabled={busy}
            onChange={event => onChange(event.target.value)}
            className={inputClassName}
          />
          {error && <div role="alert" className="mt-2 text-xs text-rose-500">{error}</div>}
          {onSolutionNameChange && (
            <div className="mt-3">
              <label htmlFor={`${inputId}-solution`} className="mb-1.5 block text-xs font-medium">解决方案名称</label>
              <input
                id={`${inputId}-solution`}
                aria-label="解决方案名称"
                value={solutionName ?? ''}
                disabled={busy}
                onChange={event => onSolutionNameChange(event.target.value)}
                className={inputClassName}
              />
              {solutionNameHint && <p className={hintClassName}>{solutionNameHint}</p>}
            </div>
          )}
          {onLocationChange && (
            <div className="mt-3">
              <label htmlFor={`${inputId}-location`} className="mb-1.5 block text-xs font-medium">创建位置</label>
              <input
                id={`${inputId}-location`}
                aria-label="创建位置"
                value={location ?? ''}
                placeholder={locationPlaceholder}
                disabled={busy}
                onChange={event => onLocationChange(event.target.value)}
                className={inputClassName}
              />
              {locationHint && <p className={hintClassName}>{locationHint}</p>}
            </div>
          )}
        </div>

        {busy && showUnresponsiveHint && (
          <p role="status" className={`px-4 pb-3 text-[11px] ${isDarkMode ? 'text-amber-400' : 'text-amber-600'}`}>
            仍在等待本地服务响应；若持续无响应，请检查 LingBuilder Local Service 进程，或点击「取消等待」放弃。
          </p>
        )}

        <div className={`flex justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <button
            type="button"
            disabled={busy && !onCancelBusy}
            onClick={cancelDialog}
            className="rounded border border-current/20 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy && onCancelBusy ? '取消等待' : '取消'}
          </button>
          <button
            type="submit"
            disabled={busy || !value.trim()}
            className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
