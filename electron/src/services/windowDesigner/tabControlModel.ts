import type { LingControl } from './types';

export interface TabControlPage {
  id: string;
  title: string;
}

export function getTabControlPages(control: LingControl): TabControlPage[] {
  if (control.type !== 'TabControl') return [];
  const source = Array.isArray(control.properties?.tabs) ? control.properties.tabs : [];
  const pages = source.map((item, index) => {
    const record = item && typeof item === 'object' ? item as Record<string, unknown> : {};
    return {
      id: String(record.id ?? `page${index + 1}`),
      title: String(record.title ?? record.label ?? record.name ?? `标签页 ${index + 1}`)
    };
  });
  return pages.length > 0 ? pages : [{ id: 'page1', title: '标签页 1' }];
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
