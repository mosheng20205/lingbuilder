import type { CommandContext, CommandRegistration } from '../commands/types';
import type { CommandService } from '../commands/commandService';
import { getMenuService, type MenuService } from '../menus/menuService';
import type { LingMenuResource, LingMenuResourceItem } from '../windowDesigner/types';
import type { BrowserWorkbenchCommandAdapter } from './types';

export const BROWSER_INSTANCE_CONTEXT_MENU = 'browserWorkbench/instance/context';

export const BROWSER_WORKBENCH_COMMAND_IDS = {
  create: 'browserWorkbench.instance.create',
  switch: 'browserWorkbench.instance.switch',
  rename: 'browserWorkbench.instance.rename',
  importCookies: 'browserWorkbench.cookies.import',
  exportCurrentSiteCookies: 'browserWorkbench.cookies.exportCurrentSite',
  exportAllCookies: 'browserWorkbench.cookies.exportAll',
  openCacheDirectory: 'browserWorkbench.cache.openDirectory',
  clearCache: 'browserWorkbench.cache.clear',
  deleteRetainData: 'browserWorkbench.instance.deleteRetainData',
  deleteClearData: 'browserWorkbench.instance.deleteClearData',
  exportSharePackage: 'browserWorkbench.package.exportShare'
} as const;

interface BrowserMenuSpec {
  command: string;
  group: string;
  order: number;
  label: string;
  nativeHandler: string;
  when?: string;
}

const INSTANCE_MENU_SPECS: readonly BrowserMenuSpec[] = [
  { command: BROWSER_WORKBENCH_COMMAND_IDS.switch, group: 'navigation', order: 10, label: '打开/切换浏览器', nativeHandler: '_浏览器菜单_打开' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.rename, group: 'state', order: 10, label: '重命名…', nativeHandler: '_浏览器菜单_重命名' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.importCookies, group: 'cookies', order: 10, label: '导入 Cookie…', nativeHandler: '_浏览器菜单_导入Cookie' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.exportCurrentSiteCookies, group: 'cookies', order: 20, label: '导出当前网站 Cookie', nativeHandler: '_浏览器菜单_导出当前网站Cookie' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.exportAllCookies, group: 'cookies', order: 30, label: '导出全部网站 Cookie', nativeHandler: '_浏览器菜单_导出全部Cookie' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.openCacheDirectory, group: 'cache', order: 10, label: '打开缓存目录', nativeHandler: '_浏览器菜单_打开缓存目录' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.clearCache, group: 'cache', order: 20, label: '清理缓存…', nativeHandler: '_浏览器菜单_清理缓存' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.deleteRetainData, group: 'danger', order: 10, label: '删除实例，保留缓存…', nativeHandler: '_浏览器菜单_删除保留缓存', when: 'browserWorkbench.canDelete' },
  { command: BROWSER_WORKBENCH_COMMAND_IDS.deleteClearData, group: 'danger', order: 20, label: '删除实例并清除数据…', nativeHandler: '_浏览器菜单_删除并清数据', when: 'browserWorkbench.canDelete' }
];

export function registerBrowserWorkbenchCommands(
  commands: CommandService,
  adapter: BrowserWorkbenchCommandAdapter,
  menus: MenuService = getMenuService(commands)
): CommandRegistration {
  const commandRegistration = commands.registerCommands([
    command('create', '新建浏览器实例', () => adapter.createInstance(), false),
    command('switch', '打开/切换浏览器', (context, instanceId) => adapter.switchInstance(resolveInstanceId(context, instanceId))),
    command('rename', '重命名浏览器实例', (context, instanceId, newName) => adapter.renameInstance(
      resolveInstanceId(context, instanceId), requireText(newName, '新名称')
    )),
    command('importCookies', '导入浏览器 Cookie', (context, instanceId, filePath) => adapter.importCookies(
      resolveInstanceId(context, instanceId), optionalText(filePath)
    )),
    command('exportCurrentSiteCookies', '导出当前网站 Cookie', (context, instanceId, filePath) => adapter.exportCookies(
      resolveInstanceId(context, instanceId), 'currentSite', optionalText(filePath)
    )),
    command('exportAllCookies', '导出全部网站 Cookie', (context, instanceId, filePath) => adapter.exportCookies(
      resolveInstanceId(context, instanceId), 'all', optionalText(filePath)
    )),
    command('openCacheDirectory', '打开浏览器缓存目录', (context, instanceId) => adapter.openCacheDirectory(resolveInstanceId(context, instanceId))),
    command('clearCache', '清理浏览器缓存', (context, instanceId) => adapter.clearCache(resolveInstanceId(context, instanceId))),
    command('deleteRetainData', '删除浏览器实例并保留缓存', (context, instanceId) => adapter.deleteInstance(
      resolveInstanceId(context, instanceId), 'retainData'
    ), true),
    command('deleteClearData', '删除浏览器实例并清除数据', (context, instanceId) => adapter.deleteInstance(
      resolveInstanceId(context, instanceId), 'clearData'
    ), true),
    command('exportSharePackage', '一键导出多浏览器工作台分享包', (context, projectId) => adapter.exportSharePackage(
      optionalText(projectId) || optionalText(context['project.id'])
    ), false)
  ]);
  const menuRegistration = menus.registerMenuItems(INSTANCE_MENU_SPECS.map(spec => ({
    menu: BROWSER_INSTANCE_CONTEXT_MENU,
    command: spec.command,
    group: spec.group,
    order: spec.order,
    when: spec.when || 'browserWorkbench.active'
  })));
  return {
    dispose: () => {
      menuRegistration.dispose();
      commandRegistration.dispose();
    }
  };
}

export function createNativeBrowserInstanceMenuResource(
  ownerWindowId: string,
  targetControlId: string
): LingMenuResource {
  const items: LingMenuResourceItem[] = [];
  let previousGroup = '';
  for (const spec of INSTANCE_MENU_SPECS) {
    if (previousGroup && previousGroup !== spec.group) {
      items.push({ id: `separator-${items.length}`, label: '', separator: true });
    }
    previousGroup = spec.group;
    items.push({ id: spec.command, label: spec.label, selectedHandler: spec.nativeHandler });
  }
  return {
    id: 'browser-instance-context-menu',
    type: 'PopupMenu',
    name: '浏览器实例右键菜单',
    ownerWindowId,
    targetControlId,
    items
  };
}

function command(
  key: keyof typeof BROWSER_WORKBENCH_COMMAND_IDS,
  title: string,
  handler: (context: CommandContext, ...args: unknown[]) => unknown,
  requiresDelete = false
) {
  return {
    id: BROWSER_WORKBENCH_COMMAND_IDS[key],
    title,
    category: '浏览器工作台',
    when: key === 'exportSharePackage' ? 'workspace.open' : 'browserWorkbench.active',
    enabled: requiresDelete ? (context: CommandContext) => context['browserWorkbench.canDelete'] !== false : true,
    handler
  };
}

function resolveInstanceId(context: CommandContext, value: unknown): string {
  return requireText(value ?? context['browserWorkbench.instanceId'], '浏览器实例 ID');
}

function requireText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}不能为空。`);
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
