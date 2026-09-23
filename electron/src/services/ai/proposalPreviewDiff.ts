/**
 * 提案预览的行级 diff 内核。
 *
 * 面板过去直接并排渲染 change 的 originalText / newText 两段全文，内嵌 Agent 习惯
 * 整段重写时预览就是一面墙，用户没法快速确认「到底改了哪几行」。这里做行级
 * 前后缀裁剪（change 的 range 本身已是最小差异区段，区间内的相同行通常是少量
 * 上下文），相同行连续超过 CONTEXT_LIMIT 时折叠省略，超长整体截断。
 */

export interface ProposalPreviewLine {
  kind: 'same' | 'removed' | 'added' | 'elided';
  text: string;
}

export interface ProposalLineDiff {
  lines: ProposalPreviewLine[];
  addedCount: number;
  removedCount: number;
  truncated: boolean;
}

const CONTEXT_LIMIT = 3;
const MAX_LINES = 400;

function splitLines(text: string): string[] {
  const value = String(text || '');
  if (!value) return [];
  return value.split(/\r\n|\n|\r/u);
}

export function buildProposalLineDiff(originalText: string, newText: string): ProposalLineDiff {
  const original = splitLines(originalText);
  const updated = splitLines(newText);

  let prefix = 0;
  while (prefix < original.length && prefix < updated.length && original[prefix] === updated[prefix]) prefix += 1;
  let suffix = 0;
  while (
    suffix < original.length - prefix &&
    suffix < updated.length - prefix &&
    original[original.length - 1 - suffix] === updated[updated.length - 1 - suffix]
  ) suffix += 1;

  const removed = original.slice(prefix, original.length - suffix);
  const added = updated.slice(prefix, updated.length - suffix);

  const lines: ProposalPreviewLine[] = [];
  const pushContext = (source: string[], from: number, to: number) => {
    const count = to - from;
    if (count <= CONTEXT_LIMIT * 2) {
      for (let index = from; index < to; index += 1) lines.push({ kind: 'same', text: source[index] });
      return;
    }
    for (let index = from; index < from + CONTEXT_LIMIT; index += 1) lines.push({ kind: 'same', text: source[index] });
    lines.push({ kind: 'elided', text: `……（相同的 ${count - CONTEXT_LIMIT * 2} 行已省略）` });
    for (let index = to - CONTEXT_LIMIT; index < to; index += 1) lines.push({ kind: 'same', text: source[index] });
  };
  if (prefix > 0) pushContext(original, 0, prefix);
  for (const text of removed) lines.push({ kind: 'removed', text });
  for (const text of added) lines.push({ kind: 'added', text });
  const afterStart = original.length - suffix;
  if (suffix > 0) pushContext(original, afterStart, original.length);

  const truncated = lines.length > MAX_LINES;
  const kept = truncated ? lines.slice(0, MAX_LINES) : lines;
  return {
    lines: kept,
    addedCount: added.length,
    removedCount: removed.length,
    truncated
  };
}
