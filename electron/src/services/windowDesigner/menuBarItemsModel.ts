export const DEFAULT_WINDOW_MENU_ITEMS = '关于太空冒险客户端, 太空冒险安全账户登录, 关联设计文件';

export function parseMenuBarItems(value: string | undefined): string[] {
  return (value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export function serializeMenuBarItems(items: string[]): string {
  return items.map(item => item.trim()).filter(Boolean).join(', ');
}

export function validateMenuBarItems(items: string[]): string | null {
  if (items.length === 0) return '请至少保留一个菜单项。';
  if (items.some(item => item.trim() === '')) return '菜单项名称不能为空。';
  if (items.some(item => item.includes(','))) return '菜单项名称不能包含英文逗号“,”，可改用中文逗号“，”。';
  return null;
}
