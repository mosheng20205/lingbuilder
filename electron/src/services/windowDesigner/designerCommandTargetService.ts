import type { CommandService } from '../commands/commandService';
import type { CommandContext, CommandRegistration } from '../commands/types';
import type { MenuService } from '../menus/menuService';
import { DESIGNER_CANVAS_CONTEXT_MENU, DESIGNER_CONTROL_CONTEXT_MENU, DESIGNER_RESOURCE_CONTEXT_MENU } from '../menus/types';
import type { DesignerLayoutOperation } from './designerOperations';

export type DesignerLayerOperation = 'front' | 'forward' | 'backward' | 'back';

export interface DesignerCommandTarget {
  id: string;
  getContext(): CommandContext;
  openDefaultEvent(): void;
  openProperties(): void;
  copy(): Promise<void>;
  cut(): Promise<void>;
  paste(): Promise<void>;
  duplicate(): Promise<void>;
  deleteSelection(): void;
  deleteResource(): void;
  selectAll(): void;
  applyLayout(operation: DesignerLayoutOperation): void;
  reorder(operation: DesignerLayerOperation): void;
  setLocked(locked: boolean): void;
  selectParent(): void;
  selectChildren(): void;
  moveToRoot(): void;
  previewEdgeControl(): Promise<void>;
  /** 内嵌资源面板：选择文件并复制进项目（返回中文结果说明）。 */
  addEmbeddedResourceFiles(): Promise<string>;
  /** 内嵌资源面板：选择文件夹递归展开并复制进项目（返回中文结果说明）。 */
  addEmbeddedResourceFolder(): Promise<string>;
  /** 内嵌资源面板：扫描工作区内已有目录（不复制），逻辑名取工作区相对路径。 */
  addEmbeddedResourceDirectory(directory: string): Promise<string>;
  /** 内嵌资源面板：一键启用「内嵌资源模块」。 */
  enableEmbeddedResourceModule(): Promise<string>;
}

class ActiveDesignerCommandTargetService {
  private targets: DesignerCommandTarget[] = [];

  register(target: DesignerCommandTarget): CommandRegistration {
    this.targets = [...this.targets.filter(item => item.id !== target.id), target];
    return { dispose: () => { this.targets = this.targets.filter(item => item !== target); } };
  }

  activate(targetId: string): void {
    const target = this.targets.find(item => item.id === targetId);
    if (!target) return;
    this.targets = [...this.targets.filter(item => item !== target), target];
  }

  get active(): DesignerCommandTarget | undefined {
    return this.targets.at(-1);
  }

  require(): DesignerCommandTarget {
    const target = this.active;
    if (!target) throw new Error('当前没有活动的可视化设计器。');
    return target;
  }
}

export const activeDesignerCommandTargetService = new ActiveDesignerCommandTargetService();

const registrations = new WeakMap<CommandService, { refs: number; registration: CommandRegistration }>();

export function acquireDesignerCommands(commands: CommandService, menus: MenuService): CommandRegistration {
  const current = registrations.get(commands);
  if (current) {
    current.refs += 1;
    return releaseRegistration(commands, current);
  }
  const enabled = (key: string) => (context: CommandContext) => context[key] !== false && Boolean(context['designer.active']);
  const commandRegistration = commands.registerCommands([
    command('designer.action.openDefaultEvent', '编辑默认事件', [], enabled('designer.hasSelection'), target => target.openDefaultEvent()),
    command('designer.action.openProperties', '属性', [], enabled('designer.active'), target => target.openProperties()),
    command('designer.action.cut', '剪切', ['Mod+X'], enabled('designer.canCut'), target => target.cut()),
    command('designer.action.copy', '复制', ['Mod+C'], enabled('designer.canCopy'), target => target.copy()),
    command('designer.action.paste', '粘贴', ['Mod+V'], enabled('designer.canPaste'), target => target.paste()),
    command('designer.action.duplicate', '创建副本', ['Mod+D'], enabled('designer.canDuplicate'), target => target.duplicate()),
    command('designer.action.selectAll', '全选控件', ['Mod+A'], enabled('designer.active'), target => target.selectAll()),
    command('designer.action.delete', '删除', ['Delete'], enabled('designer.canDelete'), target => target.deleteSelection()),
    command('designer.action.resourceProperties', '属性', [], context => context['designer.targetKind'] === 'resource', target => target.openProperties()),
    command('designer.action.deleteResource', '删除资源', [], context => context['designer.targetKind'] === 'resource', target => target.deleteResource()),
    command('designer.action.lock', '锁定', [], context => enabled('designer.hasSelection')(context) && !context['designer.allLocked'], target => target.setLocked(true)),
    command('designer.action.unlock', '解除锁定', [], context => enabled('designer.hasSelection')(context) && Boolean(context['designer.anyLocked']), target => target.setLocked(false)),
    command('designer.action.layer.front', '置于顶层', [], enabled('designer.canReorder'), target => target.reorder('front')),
    command('designer.action.layer.forward', '上移一层', [], enabled('designer.canReorder'), target => target.reorder('forward')),
    command('designer.action.layer.backward', '下移一层', [], enabled('designer.canReorder'), target => target.reorder('backward')),
    command('designer.action.layer.back', '置于底层', [], enabled('designer.canReorder'), target => target.reorder('back')),
    command('designer.action.selectParent', '选择父控件', [], enabled('designer.hasParent'), target => target.selectParent()),
    command('designer.action.selectChildren', '选择直接子控件', [], enabled('designer.hasChildren'), target => target.selectChildren()),
    command('designer.action.moveToRoot', '移至窗口根级', [], enabled('designer.canMoveToRoot'), target => target.moveToRoot()),
    command('designer.edgeview.previewControl', '运行此 Edge 控件预览', [], context => enabled('designer.hasSelection')(context) && context['designer.control.type'] === 'EdgeBrowser', target => target.previewEdgeControl()),
    // 内嵌资源面板动作：文件选择/文件夹复制/目录扫描/模块启用都经命令系统执行，面板按钮只负责分发命令。
    command('designer.embeddedResources.addFiles', '内嵌资源：选择文件…', [], enabled('designer.active'), target => target.addEmbeddedResourceFiles()),
    command('designer.embeddedResources.addFolder', '内嵌资源：选择文件夹…', [], enabled('designer.active'), target => target.addEmbeddedResourceFolder()),
    command('designer.embeddedResources.addDirectory', '内嵌资源：扫描工作区目录', [], enabled('designer.active'), (target, directory) => target.addEmbeddedResourceDirectory(String(directory ?? ''))),
    command('designer.embeddedResources.enableModule', '内嵌资源：启用内嵌资源模块', [], enabled('designer.active'), target => target.enableEmbeddedResourceModule()),
    ...layoutCommands()
  ]);
  const submenuRegistration = menus.registerSubmenus([
    { id: 'designer.layout', title: '布局', source: 'builtin' },
    { id: 'designer.layer', title: '排列', source: 'builtin' },
    { id: 'designer.hierarchy', title: '父子层级', source: 'builtin' }
  ]);
  const menuRegistration = menus.registerMenuItems([
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.openDefaultEvent', 'navigation', 10),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.openProperties', 'navigation', 20),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.edgeview.previewControl', 'navigation', 30),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.cut', 'clipboard', 10),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.copy', 'clipboard', 20),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.paste', 'clipboard', 30),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.duplicate', 'clipboard', 40),
    { menu: DESIGNER_CONTROL_CONTEXT_MENU, submenu: 'designer.layout', group: 'layout', order: 10, source: 'builtin' },
    { menu: DESIGNER_CONTROL_CONTEXT_MENU, submenu: 'designer.layer', group: 'layout', order: 20, source: 'builtin' },
    { menu: DESIGNER_CONTROL_CONTEXT_MENU, submenu: 'designer.hierarchy', group: 'layout', order: 30, source: 'builtin' },
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.lock', 'state', 10),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.unlock', 'state', 20),
    item(DESIGNER_CONTROL_CONTEXT_MENU, 'designer.action.delete', 'danger', 10),
    item(DESIGNER_CANVAS_CONTEXT_MENU, 'designer.action.paste', 'clipboard', 10),
    item(DESIGNER_CANVAS_CONTEXT_MENU, 'designer.action.selectAll', 'selection', 10),
    item(DESIGNER_RESOURCE_CONTEXT_MENU, 'designer.action.resourceProperties', 'navigation', 10),
    item(DESIGNER_RESOURCE_CONTEXT_MENU, 'designer.action.deleteResource', 'danger', 10),
    ...layoutMenuItems(),
    ...['front', 'forward', 'backward', 'back'].map((id, index) => item('designer.layer', `designer.action.layer.${id}`, 'navigation', index * 10)),
    item('designer.hierarchy', 'designer.action.selectParent', 'navigation', 10),
    item('designer.hierarchy', 'designer.action.selectChildren', 'navigation', 20),
    item('designer.hierarchy', 'designer.action.moveToRoot', 'navigation', 30)
  ]);
  const record = { refs: 1, registration: { dispose: () => {
    menuRegistration.dispose();
    submenuRegistration.dispose();
    commandRegistration.dispose();
  } } };
  registrations.set(commands, record);
  return releaseRegistration(commands, record);
}

function releaseRegistration(commands: CommandService, record: { refs: number; registration: CommandRegistration }): CommandRegistration {
  let disposed = false;
  return { dispose: () => {
    if (disposed) return;
    disposed = true;
    record.refs -= 1;
    if (record.refs > 0) return;
    record.registration.dispose();
    registrations.delete(commands);
  } };
}

function command(
  id: string,
  title: string,
  keybindings: readonly string[],
  enabled: (context: CommandContext) => boolean,
  run: (target: DesignerCommandTarget, ...args: unknown[]) => unknown
) {
  return {
    id, title, category: '设计器', keybindings,
    when: 'designer.active', enabled,
    handler: (_context: CommandContext, ...args: unknown[]) => run(activeDesignerCommandTargetService.require(), ...args)
  };
}

function item(menu: string, commandId: string, group: string, order: number) {
  return { menu, command: commandId, group, order, source: 'builtin' as const };
}

function layoutCommands() {
  const operations: Array<[DesignerLayoutOperation, string]> = [
    ['align-left', '左对齐'], ['align-right', '右对齐'], ['align-top', '顶部对齐'], ['align-bottom', '底部对齐'],
    ['align-hcenter', '水平居中'], ['align-vcenter', '垂直居中'], ['distribute-horizontal', '水平均匀分布'],
    ['distribute-vertical', '垂直均匀分布'], ['same-width', '相同宽度'], ['same-height', '相同高度']
  ];
  return operations.map(([operation, title]) => command(
    `designer.action.layout.${operation}`,
    title,
    [],
    context => Boolean(context['designer.active']) && Boolean(context['designer.canLayout']) && Number(context['designer.selectionCount'] || 0) >= (operation.startsWith('distribute-') ? 3 : 2),
    target => target.applyLayout(operation)
  ));
}

function layoutMenuItems() {
  const operations: DesignerLayoutOperation[] = [
    'align-left', 'align-right', 'align-top', 'align-bottom', 'align-hcenter', 'align-vcenter',
    'distribute-horizontal', 'distribute-vertical', 'same-width', 'same-height'
  ];
  return operations.map((operation, index) => item('designer.layout', `designer.action.layout.${operation}`, index < 6 ? 'align' : index < 8 ? 'distribute' : 'size', index * 10));
}
