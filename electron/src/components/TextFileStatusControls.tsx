import React from 'react';

import type {
  TextFileEncoding,
  TextFileEol,
  TextFileFormat
} from '../services/files/types';

export interface TextFileStatusControlsProps {
  /** The currently selected file format. A missing value renders the no-file state. */
  format?: TextFileFormat | null;
  /** Used to make the accessible control names specific without taking status-bar space. */
  fileName?: string;
  isDarkMode: boolean;
  disabled?: boolean;
  isModified?: boolean;
  className?: string;
  onEncodingChange: (encoding: TextFileEncoding) => void;
  onEolChange: (eol: TextFileEol) => void;
}

const controlBaseClassName = [
  'h-6 max-w-full cursor-pointer rounded border px-1.5 text-[11px] font-medium',
  'outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-400',
  'disabled:cursor-not-allowed disabled:opacity-50'
].join(' ');

const encodingOptions: ReadonlyArray<{ value: TextFileEncoding; label: string }> = [
  { value: 'utf8', label: 'UTF-8' },
  { value: 'utf8bom', label: 'UTF-8（带 BOM）' },
  { value: 'utf16le', label: 'UTF-16 LE' },
  { value: 'utf16be', label: 'UTF-16 BE' }
];

const eolOptions: ReadonlyArray<{ value: TextFileEol; label: string }> = [
  { value: 'lf', label: 'LF' },
  { value: 'crlf', label: 'CRLF' }
];

/**
 * Compact, keyboard-accessible text format controls intended for the workbench
 * status bar. Native selects retain platform keyboard and screen-reader
 * behavior while the wrapping container remains usable at narrow widths.
 */
export default function TextFileStatusControls({
  format,
  fileName,
  isDarkMode,
  disabled = false,
  isModified = false,
  className = '',
  onEncodingChange,
  onEolChange
}: TextFileStatusControlsProps) {
  /* 原生 select 弹出的 option 列表不继承按钮配色：显式指定深/浅底色，
   * 避免深色状态栏下白色弹层叠加白色文字导致选项不可读。 */
  const themeClassName = isDarkMode
    ? 'border-white/30 bg-white/10 text-white hover:bg-white/20 [&>option]:bg-[#252526] [&>option]:text-slate-200'
    : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100 [&>option]:bg-white [&>option]:text-slate-800';

  if (!format) {
    return (
      <span
        role="status"
        aria-live="polite"
        aria-label="文本文件格式"
        className={`min-w-0 max-w-full truncate text-[11px] ${
          isDarkMode ? 'text-slate-300' : 'text-slate-600'
        } ${className}`}
      >
        未打开文本文件
      </span>
    );
  }

  const fileLabel = fileName?.trim() ? `“${fileName.trim()}”` : '当前文件';
  const controlsDisabled = disabled;

  return (
    <div
      role="group"
      aria-label={`${fileLabel}的文本格式`}
      aria-disabled={controlsDisabled || undefined}
      className={`flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1 ${className}`}
    >
      {isModified && (
        <span
          role="status"
          aria-live="polite"
          className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold ${
            isDarkMode ? 'bg-amber-300/20 text-amber-100' : 'bg-amber-100 text-amber-800'
          }`}
        >
          格式待保存
        </span>
      )}
      <label className="inline-flex min-w-0 max-w-full items-center">
        <span className="sr-only">文件编码</span>
        <select
          aria-label={`更改${fileLabel}的文件编码`}
          title={`文件编码：${encodingOptions.find(option => option.value === format.encoding)?.label ?? format.encoding}`}
          value={format.encoding}
          disabled={controlsDisabled}
          onChange={event => onEncodingChange(event.currentTarget.value as TextFileEncoding)}
          className={`${controlBaseClassName} ${themeClassName}`}
        >
          {encodingOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="inline-flex min-w-0 max-w-full items-center">
        <span className="sr-only">换行符</span>
        <select
          aria-label={`更改${fileLabel}的换行符`}
          title={`换行符：${format.eol.toUpperCase()}`}
          value={format.eol}
          disabled={controlsDisabled}
          onChange={event => onEolChange(event.currentTarget.value as TextFileEol)}
          className={`${controlBaseClassName} ${themeClassName}`}
        >
          {eolOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
