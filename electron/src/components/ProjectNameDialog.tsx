import React, { FormEvent, useEffect, useRef } from 'react';

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
  onChange: (value: string) => void;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
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
  onChange,
  onConfirm,
  onClose
}: ProjectNameDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;

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
        if (event.key === 'Escape' && !busy) onClose();
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
            className={`w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
              isDarkMode
                ? 'border-[#414149] bg-[#25252c] text-slate-100'
                : 'border-slate-300 bg-white text-slate-900'
            }`}
          />
          {error && <div role="alert" className="mt-2 text-xs text-rose-500">{error}</div>}
        </div>

        <div className={`flex justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded border border-current/20 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
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
