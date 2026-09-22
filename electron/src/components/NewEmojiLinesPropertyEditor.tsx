import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, TriangleAlert, Trash2 } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  parseNewEmojiLines,
  serializeNewEmojiLines,
  type NewEmojiLinesSpec
} from '../services/windowDesigner/newEmojiDataFormats';

/**
 * new_emoji 行分隔多列属性的「小表格」编辑器：把 `标题<TAB>内容` 这类
 * 不可见的分隔符串渲染成带中文列头的输入行。旧数据字段数超出已知格式
 * （overflow）时回退为原始多行文本框，保证不丢字段。
 */
export default function NewEmojiLinesPropertyEditor({
  value,
  spec,
  isDarkMode,
  onChange
}: {
  value: Win32ControlPropertyValue;
  spec: NewEmojiLinesSpec;
  isDarkMode: boolean;
  onChange: (value: Win32ControlPropertyValue) => void;
}) {
  const initialRows = parseNewEmojiLines(value, spec);
  const hasOverflow = initialRows.some(row => row.overflow);
  const externalSignature = JSON.stringify(value);
  const lastEmittedSignature = useRef<string>(hasOverflow ? externalSignature : JSON.stringify(serializeNewEmojiLines(initialRows.map(row => row.fields), spec)));
  const [rows, setRows] = useState<string[][]>(() => {
    if (hasOverflow) return [];
    const next = initialRows.map(row => {
      const fields = row.fields.slice(0, spec.maxFields);
      while (fields.length < spec.columns.length) fields.push('');
      return fields;
    });
    return next.length > 0 ? next : [];
  });
  const [draftText, setDraftText] = useState<string>(() => (hasOverflow ? readText(value) : ''));
  const [fallback, setFallback] = useState(hasOverflow);

  useEffect(() => {
    if (externalSignature === lastEmittedSignature.current) return;
    lastEmittedSignature.current = externalSignature;
    if (fallback) {
      setDraftText(Array.isArray(value) ? value.map(item => String(item ?? '')).join('\n') : String(value ?? ''));
      return;
    }
    const parsed = parseNewEmojiLines(value, spec);
    if (parsed.some(row => row.overflow)) {
      setFallback(true);
      setDraftText(readText(value));
      return;
    }
    setRows(parsed.map(row => {
      const fields = row.fields.slice(0, spec.maxFields);
      while (fields.length < spec.columns.length) fields.push('');
      return fields;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalSignature, value]);

  const commit = (nextRows: string[][]) => {
    setRows(nextRows);
    const lines = serializeNewEmojiLines(nextRows, spec);
    lastEmittedSignature.current = JSON.stringify(lines);
    onChange(lines);
  };

  const inputClass = `h-7 w-full min-w-0 rounded border px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode ? 'border-[#3c3c44] bg-[#1b1b20] text-slate-200 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const iconButton = `inline-flex h-6 w-6 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-200'
  }`;

  if (fallback) {
    return (
      <div className="space-y-1">
        <textarea
          value={draftText}
          onChange={event => {
            const nextText = event.target.value;
            setDraftText(nextText);
            const lines = nextText.split('\n');
            lastEmittedSignature.current = JSON.stringify(lines);
            onChange(lines);
          }}
          rows={4}
          aria-label="原始文本（每行一条）"
          placeholder="每行一条，字段之间用分隔符隔开"
          className={`w-full resize-y rounded border px-2 py-1 font-mono text-xs ${isDarkMode ? 'bg-[#1b1b20] border-[#3c3c44] text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
        />
        <p className={`flex items-start gap-1 text-[9px] leading-3 text-amber-500`}><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />这段数据的字段数超出了结构化编辑器支持的范围，已切换为原始文本编辑；修改后仍按原格式保存。</p>
      </div>
    );
  }

  const addRow = () => commit([...rows, spec.columns.map(() => '')]);

  return (
    <div className="space-y-1">
      {rows.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-end gap-1" aria-hidden="true">
            {spec.columns.map(column => <span key={column.key} className={`min-w-0 flex-1 truncate pb-0.5 text-[9px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{column.label}</span>)}
            <span className="w-14 shrink-0" />
          </div>
          {rows.map((fields, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-1">
              {spec.columns.map((column, columnIndex) => (
                <input
                  key={column.key}
                  aria-label={`第 ${rowIndex + 1} 行 ${column.label}`}
                  value={fields[columnIndex] ?? ''}
                  onChange={event => {
                    const next = rows.map(row => [...row]);
                    const row = next[rowIndex];
                    if (row) row[columnIndex] = event.target.value;
                    commit(next);
                  }}
                  placeholder={column.placeholder ?? ''}
                  inputMode={column.numeric ? 'decimal' : undefined}
                  className={`${inputClass} min-w-0 flex-1 ${column.numeric && fields[columnIndex] !== '' && fields[columnIndex] !== undefined && Number.isNaN(Number(fields[columnIndex])) ? 'border-rose-500' : ''}`}
                />
              ))}
              <span className="flex w-14 shrink-0 justify-end gap-0.5">
                <button type="button" aria-label={`上移第 ${rowIndex + 1} 行`} title="上移" disabled={rowIndex === 0} onClick={() => { const next = [...rows]; [next[rowIndex - 1], next[rowIndex]] = [next[rowIndex]!, next[rowIndex - 1]!]; commit(next); }} className={iconButton}><ArrowUp className="h-3 w-3" /></button>
                <button type="button" aria-label={`下移第 ${rowIndex + 1} 行`} title="下移" disabled={rowIndex === rows.length - 1} onClick={() => { const next = [...rows]; [next[rowIndex], next[rowIndex + 1]] = [next[rowIndex + 1]!, next[rowIndex]!]; commit(next); }} className={iconButton}><ArrowDown className="h-3 w-3" /></button>
                <button type="button" aria-label={`删除第 ${rowIndex + 1} 行`} title="删除" onClick={() => commit(rows.filter((_, index) => index !== rowIndex))} className={`${iconButton} text-rose-400`}><Trash2 className="h-3 w-3" /></button>
              </span>
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={addRow} className={`w-full rounded border border-dashed py-1 text-[10px] ${isDarkMode ? 'border-slate-600 text-slate-400 hover:border-cyan-500 hover:text-cyan-400' : 'border-slate-300 text-slate-500 hover:border-cyan-500 hover:text-cyan-600'}`} aria-label="添加一行">
        + 添加一行
      </button>
      <p className={`text-[9px] leading-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>{spec.hint}</p>
    </div>
  );
}

function readText(value: Win32ControlPropertyValue): string {
  if (Array.isArray(value)) return value.map(item => String(item ?? '')).join('\n');
  if (value === undefined || value === null) return '';
  return String(value);
}
