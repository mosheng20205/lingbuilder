import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export type ToolbarButtonStyle = 'button' | 'check' | 'separator' | 'dropdown';

export interface ToolbarEditableButton {
  id: number;
  title: string;
  image: number;
  style: ToolbarButtonStyle;
}

const TOOLBAR_BUTTON_STYLES = new Set<ToolbarButtonStyle>(['button', 'check', 'separator', 'dropdown']);

function finiteInteger(value: unknown, fallback: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function nextCommandId(buttons: ToolbarEditableButton[]): number {
  const used = new Set(buttons.map(button => button.id));
  for (let candidate = 1; candidate <= 65535; candidate += 1) {
    if (!used.has(candidate)) return candidate;
  }
  return 1;
}

export function normalizeToolbarButtons(value: Win32ControlPropertyValue | undefined): ToolbarEditableButton[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = typeof item === 'string' ? { title: item } : item && typeof item === 'object' ? item as Record<string, unknown> : {};
    const rawStyle = String(record.style ?? 'button') as ToolbarButtonStyle;
    return {
      id: Math.min(65535, Math.max(1, finiteInteger(record.id, index + 1))),
      title: String(record.title ?? record.label ?? record.text ?? ''),
      image: Math.max(-1, finiteInteger(record.image, -1)),
      style: TOOLBAR_BUTTON_STYLES.has(rawStyle) ? rawStyle : 'button'
    };
  });
}

export function appendToolbarButton(buttons: ToolbarEditableButton[]): ToolbarEditableButton[] {
  return [...buttons, {
    id: nextCommandId(buttons),
    title: `按钮 ${buttons.length + 1}`,
    image: -1,
    style: 'button'
  }];
}

export function duplicateToolbarButton(buttons: ToolbarEditableButton[], index: number): ToolbarEditableButton[] {
  if (index < 0 || index >= buttons.length) return buttons;
  const duplicate = { ...buttons[index], id: nextCommandId(buttons), title: buttons[index].title ? `${buttons[index].title} 副本` : '' };
  return [...buttons.slice(0, index + 1), duplicate, ...buttons.slice(index + 1)];
}

export function moveToolbarButton(buttons: ToolbarEditableButton[], from: number, to: number): ToolbarEditableButton[] {
  if (from === to || from < 0 || from >= buttons.length || to < 0 || to >= buttons.length) return buttons;
  const next = [...buttons];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function removeToolbarButton(buttons: ToolbarEditableButton[], index: number): ToolbarEditableButton[] {
  return buttons.filter((_, buttonIndex) => buttonIndex !== index);
}
