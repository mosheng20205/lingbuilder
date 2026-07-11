import React from 'react';

export type DiffViewMode = 'chinese' | 'split' | 'unified';

export const DIFF_VIEW_MODE_CHANGE_EVENT = 'lingbuilder-diff-view-mode-change';

export const DIFF_VIEW_MODE_OPTIONS: ReadonlyArray<{
  value: DiffViewMode;
  label: string;
  description: string;
}> = [
  { value: 'chinese', label: '编辑', description: '编辑当前中文代码' },
  { value: 'split', label: '并排对比', description: '左右并排查看原代码与本地化代码' },
  { value: 'unified', label: '内联对比', description: '在同一视图中逐行查看修改' }
];

interface DiffViewModeSelectorProps {
  value: DiffViewMode;
  onChange: (value: DiffViewMode) => void;
  isDarkMode: boolean;
  hasDifferences: boolean;
}

export default function DiffViewModeSelector({
  value,
  onChange,
  isDarkMode,
  hasDifferences
}: DiffViewModeSelectorProps) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      {!hasDifferences && (
        <span
          role="status"
          aria-live="polite"
          className={`whitespace-nowrap text-[11px] font-medium ${
            isDarkMode ? 'text-emerald-300' : 'text-emerald-700'
          }`}
        >
          当前文件没有差异
        </span>
      )}
      <div
        role="group"
        aria-label="对比视图模式"
        className={`flex shrink-0 items-center rounded-md border p-0.5 ${
          isDarkMode ? 'border-slate-600 bg-[#141418]' : 'border-slate-300 bg-white'
        }`}
      >
        {DIFF_VIEW_MODE_OPTIONS.map(option => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              title={option.description}
              onClick={() => onChange(option.value)}
              className={`min-h-7 whitespace-nowrap rounded px-2 py-1 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 ${
                isSelected
                  ? isDarkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-600 text-white shadow-sm'
                  : isDarkMode
                    ? 'text-slate-300 hover:bg-slate-700 hover:text-white focus-visible:ring-offset-[#141418]'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:ring-offset-white'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
