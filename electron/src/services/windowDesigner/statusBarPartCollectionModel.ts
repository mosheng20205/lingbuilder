import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export interface StatusBarEditablePart {
  title: string;
  width: number;
}

function finiteWidth(value: unknown, fallback = 120): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(1, Math.trunc(parsed)) : fallback;
}

export function normalizeStatusBarParts(value: Win32ControlPropertyValue | undefined): StatusBarEditablePart[] {
  if (!Array.isArray(value)) return [];
  return value.map(item => {
    const record = typeof item === 'string'
      ? { title: item }
      : item && typeof item === 'object'
        ? item as Record<string, unknown>
        : {};
    return {
      title: String(record.title ?? record.label ?? record.text ?? ''),
      width: finiteWidth(record.width)
    };
  });
}

export function appendStatusBarPart(parts: StatusBarEditablePart[]): StatusBarEditablePart[] {
  return [...parts, { title: `分区 ${parts.length + 1}`, width: 120 }];
}

export function duplicateStatusBarPart(parts: StatusBarEditablePart[], index: number): StatusBarEditablePart[] {
  if (index < 0 || index >= parts.length) return parts;
  const source = parts[index];
  const duplicate = { ...source, title: source.title ? `${source.title} 副本` : '' };
  return [...parts.slice(0, index + 1), duplicate, ...parts.slice(index + 1)];
}

export function moveStatusBarPart(parts: StatusBarEditablePart[], from: number, to: number): StatusBarEditablePart[] {
  if (from === to || from < 0 || from >= parts.length || to < 0 || to >= parts.length) return parts;
  const next = [...parts];
  const [part] = next.splice(from, 1);
  next.splice(to, 0, part);
  return next;
}

export function removeStatusBarPart(parts: StatusBarEditablePart[], index: number): StatusBarEditablePart[] {
  return parts.filter((_, partIndex) => partIndex !== index);
}
