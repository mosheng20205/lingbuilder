import type { LingControl } from './types';
import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export interface TabControlPage {
  id: string;
  title: string;
  image: number;
}

export type TabControlPageMutation =
  | { type: 'rename'; previousId: string; nextId: string }
  | { type: 'remove'; removedId: string; fallbackId: string };

function finiteImage(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(-1, Math.trunc(parsed)) : -1;
}

export function normalizeTabControlPages(value: Win32ControlPropertyValue | undefined): TabControlPage[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const record = typeof item === 'string'
      ? { title: item }
      : item && typeof item === 'object'
        ? item as Record<string, unknown>
        : {};
    return {
      id: String(record.id ?? `page${index + 1}`),
      title: String(record.title ?? record.label ?? record.name ?? `标签页 ${index + 1}`),
      image: finiteImage(record.image)
    };
  });
}

function nextPageId(pages: TabControlPage[]): string {
  const used = new Set(pages.map(page => page.id));
  for (let candidate = 1; candidate <= pages.length + 1; candidate += 1) {
    const id = `page${candidate}`;
    if (!used.has(id)) return id;
  }
  return `page${Date.now()}`;
}

export function appendTabControlPage(pages: TabControlPage[]): TabControlPage[] {
  const index = pages.length + 1;
  return [...pages, { id: nextPageId(pages), title: `标签页 ${index}`, image: -1 }];
}

export function duplicateTabControlPage(pages: TabControlPage[], index: number): TabControlPage[] {
  if (index < 0 || index >= pages.length) return pages;
  const source = pages[index];
  const duplicate = { ...source, id: nextPageId(pages), title: source.title ? `${source.title} 副本` : `标签页 ${pages.length + 1}` };
  return [...pages.slice(0, index + 1), duplicate, ...pages.slice(index + 1)];
}

export function moveTabControlPage(pages: TabControlPage[], from: number, to: number): TabControlPage[] {
  if (from === to || from < 0 || from >= pages.length || to < 0 || to >= pages.length) return pages;
  const next = [...pages];
  const [page] = next.splice(from, 1);
  next.splice(to, 0, page);
  return next;
}

export function removeTabControlPage(pages: TabControlPage[], index: number): TabControlPage[] {
  if (pages.length <= 1 || index < 0 || index >= pages.length) return pages;
  return pages.filter((_, pageIndex) => pageIndex !== index);
}

export function getTabControlPages(control: LingControl): TabControlPage[] {
  if (control.type !== 'TabControl') return [];
  const pages = normalizeTabControlPages(control.properties?.tabs);
  return pages.length > 0 ? pages : [{ id: 'page1', title: '标签页 1', image: -1 }];
}

export function getSelectedTabPage(control: LingControl): TabControlPage | undefined {
  const pages = getTabControlPages(control);
  if (pages.length === 0) return undefined;
  const requested = typeof control.properties?.selectedIndex === 'number'
    ? Math.trunc(control.properties.selectedIndex)
    : 0;
  return pages[Math.max(0, Math.min(pages.length - 1, requested))];
}

export function isTabControlHeaderHidden(control: LingControl): boolean {
  return control.type === 'TabControl' && control.properties?.hideHeader === true;
}

export function getControlTabSlot(control: LingControl, tabControl: LingControl): string | undefined {
  const pages = getTabControlPages(tabControl);
  if (pages.length === 0) return undefined;
  const configured = control.containerSlot?.trim();
  return configured && pages.some(page => page.id === configured) ? configured : pages[0].id;
}

export function isControlOnSelectedTab(controls: LingControl[], controlId: string): boolean {
  const controlsById = new Map(controls.map(control => [control.id, control]));
  const visited = new Set<string>();
  let current = controlsById.get(controlId);

  while (current?.parentId) {
    if (visited.has(current.id)) return false;
    visited.add(current.id);
    const parent = controlsById.get(current.parentId);
    if (!parent) return true;
    if (parent.type === 'TabControl') {
      const selectedPage = getSelectedTabPage(parent);
      if (!selectedPage || getControlTabSlot(current, parent) !== selectedPage.id) return false;
    }
    current = parent;
  }
  return true;
}
