import { compileCommandWhenClause } from '../commands/whenClause';
import type { CommandService } from '../commands/commandService';
import type { CommandWhenPredicate } from '../commands/types';
import type {
  MenuContribution,
  MenuDiagnostic,
  MenuRegistration,
  MenuResolveOptions,
  ResolvedMenuItem,
  SubmenuContribution
} from './types';

interface PreparedMenuContribution extends MenuContribution {
  id: string;
  whenPredicate: CommandWhenPredicate;
  group: string;
  order: number;
  source: NonNullable<MenuContribution['source']>;
  arguments: readonly unknown[];
}

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const MAX_ARGUMENT_BYTES = 32 * 1024;

export class MenuService {
  private readonly items = new Map<string, PreparedMenuContribution[]>();
  private readonly submenus = new Map<string, SubmenuContribution>();
  private readonly diagnostics: MenuDiagnostic[] = [];
  private serial = 0;

  constructor(private readonly commands: CommandService) {}

  registerSubmenu(contribution: SubmenuContribution): MenuRegistration {
    const id = requireText(contribution.id, '子菜单 ID');
    const title = requireText(contribution.title, `子菜单“${id}”标题`);
    if (this.submenus.has(id)) throw new Error(`子菜单“${id}”已注册。`);
    const prepared = { ...contribution, id, title };
    this.submenus.set(id, prepared);
    let disposed = false;
    return { dispose: () => {
      if (disposed) return;
      disposed = true;
      if (this.submenus.get(id) === prepared) this.submenus.delete(id);
    } };
  }

  registerMenuItem(contribution: MenuContribution): MenuRegistration {
    const prepared = this.prepare(contribution);
    const list = this.items.get(prepared.menu) || [];
    list.push(prepared);
    this.items.set(prepared.menu, list);
    let disposed = false;
    return { dispose: () => {
      if (disposed) return;
      disposed = true;
      const current = this.items.get(prepared.menu);
      if (!current) return;
      const next = current.filter(item => item !== prepared);
      if (next.length) this.items.set(prepared.menu, next);
      else this.items.delete(prepared.menu);
    } };
  }

  registerMenuItems(contributions: readonly MenuContribution[]): MenuRegistration {
    const registrations = contributions.map(contribution => this.registerMenuItem(contribution));
    return { dispose: () => [...registrations].reverse().forEach(item => item.dispose()) };
  }

  registerSubmenus(contributions: readonly SubmenuContribution[]): MenuRegistration {
    const registrations = contributions.map(contribution => this.registerSubmenu(contribution));
    return { dispose: () => [...registrations].reverse().forEach(item => item.dispose()) };
  }

  resolveMenu(menuId: string, context: Readonly<Record<string, unknown>>, options: MenuResolveOptions = {}): ResolvedMenuItem[] {
    const maxDepth = Math.max(1, Math.min(10, options.maxDepth ?? 5));
    return this.resolve(menuId, context, options, [], 0, maxDepth);
  }

  getDiagnostics(): readonly MenuDiagnostic[] {
    return this.diagnostics.map(item => ({ ...item }));
  }

  clearDiagnostics(): void {
    this.diagnostics.length = 0;
  }

  private resolve(
    menuId: string,
    context: Readonly<Record<string, unknown>>,
    options: MenuResolveOptions,
    ancestry: readonly string[],
    depth: number,
    maxDepth: number
  ): ResolvedMenuItem[] {
    if (ancestry.includes(menuId)) {
      this.addDiagnostic({ severity: 'error', code: 'submenu-cycle', message: `菜单“${menuId}”存在循环子菜单。` });
      return [];
    }
    if (depth >= maxDepth) {
      this.addDiagnostic({ severity: 'warning', code: 'submenu-depth', message: `菜单“${menuId}”超过 ${maxDepth} 层，已停止展开。` });
      return [];
    }

    const visible = (this.items.get(menuId) || []).filter(item => {
      try { return item.whenPredicate(context); }
      catch {
        this.addDiagnostic({ severity: 'warning', code: 'invalid-when', message: `菜单项“${item.id}”的 when 条件执行失败。`, sourceId: item.sourceId });
        return false;
      }
    }).sort(compareContribution);

    const resolved = visible.flatMap<ResolvedMenuItem>(item => {
      if (item.command) {
        if (!this.commands.hasCommand(item.command)) {
          this.addDiagnostic({ severity: 'warning', code: 'missing-command', message: `菜单项“${item.id}”引用了未注册命令“${item.command}”。`, sourceId: item.sourceId });
          return [];
        }
        const command = this.commands.getCommandState(item.command, context);
        if (!command.whenMatched) return [];
        if (!options.includeDisabled && !command.enabled) return [];
        return [{
          kind: 'command', id: item.id, command, arguments: item.arguments,
          group: item.group, order: item.order, source: item.source, sourceId: item.sourceId
        }];
      }
      const submenu = this.submenus.get(item.submenu!);
      if (!submenu) {
        this.addDiagnostic({ severity: 'warning', code: 'missing-submenu', message: `菜单项“${item.id}”引用了未注册子菜单“${item.submenu}”。`, sourceId: item.sourceId });
        return [];
      }
      const children = this.resolve(item.submenu!, context, options, [...ancestry, menuId], depth + 1, maxDepth);
      if (!children.length) return [];
      return [{
        kind: 'submenu', id: item.id, title: submenu.title, items: children,
        group: item.group, order: item.order, source: item.source, sourceId: item.sourceId
      }];
    });

    const withSeparators: ResolvedMenuItem[] = [];
    let previousGroup: string | undefined;
    resolved.forEach(item => {
      if (item.kind === 'separator') return;
      if (previousGroup !== undefined && item.group !== previousGroup) {
        withSeparators.push({ kind: 'separator', id: `${menuId}:separator:${withSeparators.length}` });
      }
      previousGroup = item.group;
      withSeparators.push(item);
    });
    return withSeparators;
  }

  private prepare(contribution: MenuContribution): PreparedMenuContribution {
    const menu = requireText(contribution.menu, '菜单 ID');
    const command = contribution.command?.trim() || undefined;
    const submenu = contribution.submenu?.trim() || undefined;
    if (Boolean(command) === Boolean(submenu)) throw new Error(`菜单“${menu}”的贡献必须且只能声明 command 或 submenu。`);
    const args = contribution.arguments ?? [];
    if (!Array.isArray(args)) throw new Error(`菜单“${menu}”的 arguments 必须是数组。`);
    let serialized = '';
    try { serialized = JSON.stringify(args); } catch { throw new Error(`菜单“${menu}”的 arguments 必须可 JSON 序列化。`); }
    if (new TextEncoder().encode(serialized).byteLength > MAX_ARGUMENT_BYTES) throw new Error(`菜单“${menu}”的 arguments 超过 32KB。`);
    const order = contribution.order ?? 0;
    if (!Number.isFinite(order)) throw new Error(`菜单“${menu}”的 order 必须是有限数字。`);
    return {
      ...contribution,
      id: `${menu}:${command || submenu}:${++this.serial}`,
      menu,
      command,
      submenu,
      group: contribution.group?.trim() || 'navigation',
      order,
      source: contribution.source || 'builtin',
      arguments: structuredClone(args),
      whenPredicate: compileCommandWhenClause(contribution.when)
    };
  }

  private addDiagnostic(diagnostic: MenuDiagnostic): void {
    if (this.diagnostics.some(item => item.code === diagnostic.code && item.message === diagnostic.message)) return;
    this.diagnostics.push(diagnostic);
  }
}

const serviceByCommands = new WeakMap<CommandService, MenuService>();

export function getMenuService(commands: CommandService): MenuService {
  let service = serviceByCommands.get(commands);
  if (!service) {
    service = new MenuService(commands);
    serviceByCommands.set(commands, service);
  }
  return service;
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim();
}

function compareContribution(left: PreparedMenuContribution, right: PreparedMenuContribution): number {
  return groupWeight(left.group) - groupWeight(right.group)
    || collator.compare(left.group, right.group)
    || left.order - right.order
    || collator.compare(left.id, right.id);
}

function groupWeight(group: string): number {
  const builtins: Record<string, number> = { navigation: 0, clipboard: 100, selection: 150, layout: 200, state: 300, danger: 1000 };
  const explicit = /^(\d+)[_@]/u.exec(group);
  return explicit ? Number(explicit[1]) : builtins[group] ?? 500;
}
