import React, { useEffect, useState } from 'react';

interface NumberFieldInputProps {
  ariaLabel: string;
  value: number;
  min?: number;
  max?: number;
  className?: string;
  title?: string;
  onCommit: (value: number) => void;
}

// 草稿态数字输入：输入过程允许清空和越界中间值，失焦或回车才钳制提交；
// 禁止改回受控 value + onChange 每键 Math.max 钳制——那会让清空瞬间弹回下限，无法正常改值。
export default function NumberFieldInput({ ariaLabel, value, min, max, className, title, onCommit }: NumberFieldInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => setDraft(String(value)), [value]);

  const commitDraft = (nextDraft: string, finalize = false) => {
    setDraft(nextDraft);
    if (nextDraft.trim() === '') {
      if (finalize) setDraft(String(value));
      return;
    }

    const parsed = Number(nextDraft);
    if (!Number.isFinite(parsed)) {
      if (finalize) setDraft(String(value));
      return;
    }

    const integer = Math.trunc(parsed);
    if (!finalize && ((min !== undefined && integer < min) || (max !== undefined && integer > max))) return;
    const normalized = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? -Number.MAX_SAFE_INTEGER, integer));
    setDraft(String(normalized));
    if (normalized !== value) onCommit(normalized);
  };

  return (
    <input
      aria-label={ariaLabel}
      title={title}
      type="number"
      min={min}
      max={max}
      value={draft}
      onChange={event => commitDraft(event.target.value)}
      onBlur={() => commitDraft(draft, true)}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commitDraft(draft, true);
          event.currentTarget.select();
        }
      }}
      className={className}
    />
  );
}
