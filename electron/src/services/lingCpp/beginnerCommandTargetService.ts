import type { CommandService } from '../commands/commandService';
import type { CommandContext, CommandRegistration } from '../commands/types';
import type { MenuService } from '../menus/menuService';
import { LINGCPP_BEGINNER_CONTEXT_MENU } from '../menus/types';

export const ADD_BEGINNER_LOCAL_VARIABLE_COMMAND = 'lingcpp.beginner.addLocalVariable';
export const ADD_BEGINNER_LOCAL_CONSTANT_COMMAND = 'lingcpp.beginner.addLocalConstant';
export const ADD_BEGINNER_SUBPROGRAM_COMMAND = 'lingcpp.beginner.addSubprogram';
export const ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND = 'lingcpp.beginner.addAssemblyVariable';
export const MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND = 'lingcpp.beginner.moveSubprogramUp';
export const MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND = 'lingcpp.beginner.moveSubprogramDown';
export const CUT_BEGINNER_SUBPROGRAM_COMMAND = 'lingcpp.beginner.cutSubprogram';
export const COPY_BEGINNER_SUBPROGRAM_COMMAND = 'lingcpp.beginner.copySubprogram';
export const PASTE_BEGINNER_SUBPROGRAM_COMMAND = 'lingcpp.beginner.pasteSubprogram';

export interface LingCppBeginnerMethodTarget {
  className: string;
  methodName: string;
}

export interface LingCppBeginnerCommandTarget {
  id: string;
  addSubprogram(target?: LingCppBeginnerMethodTarget): unknown;
  addAssemblyVariable(): unknown;
  addLocalVariable(target?: LingCppBeginnerMethodTarget): unknown;
  addLocalConstant(target?: LingCppBeginnerMethodTarget): unknown;
  moveSubprogram(target: LingCppBeginnerMethodTarget | undefined, direction: 'up' | 'down'): unknown;
  cutSubprogram(target?: LingCppBeginnerMethodTarget): unknown;
  copySubprogram(target?: LingCppBeginnerMethodTarget): unknown;
  pasteSubprogram(target?: LingCppBeginnerMethodTarget): unknown;
}

class ActiveLingCppBeginnerCommandTargetService {
  private targets: LingCppBeginnerCommandTarget[] = [];

  register(target: LingCppBeginnerCommandTarget): CommandRegistration {
    this.targets = [...this.targets.filter(item => item.id !== target.id), target];
    return { dispose: () => { this.targets = this.targets.filter(item => item !== target); } };
  }

  activate(targetId: string): void {
    const target = this.targets.find(item => item.id === targetId);
    if (!target) return;
    this.targets = [...this.targets.filter(item => item !== target), target];
  }

  require(): LingCppBeginnerCommandTarget {
    const target = this.targets.at(-1);
    if (!target) throw new Error('当前没有活动的新手中文代码编辑器。');
    return target;
  }
}

export const activeLingCppBeginnerCommandTargetService = new ActiveLingCppBeginnerCommandTargetService();

const registrations = new WeakMap<CommandService, { refs: number; registration: CommandRegistration }>();

export function acquireLingCppBeginnerCommands(commands: CommandService, menus: MenuService): CommandRegistration {
  const current = registrations.get(commands);
  if (current) {
    current.refs += 1;
    return releaseRegistration(commands, current);
  }

  const isWritable = (context: CommandContext) => context['lingcpp.beginner.writable'] !== false;
  const hasLocalTarget = (context: CommandContext) => Boolean(
    context['lingcpp.beginner.active'] && context['lingcpp.beginner.hasTarget']
  ) && isWritable(context);
  const hasSubprogramTarget = (context: CommandContext) => Boolean(
    context['lingcpp.beginner.active'] && context['lingcpp.beginner.hasSubprogramTarget']
  );
  const commandRegistration = commands.registerCommands([
    {
      id: ADD_BEGINNER_SUBPROGRAM_COMMAND,
      title: '新建子程序',
      category: 'LingCpp 新手模式',
      keybindings: ['Ctrl+N'],
      keybindingPriority: 100,
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canAddSubprogram']) && isWritable(context),
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().addSubprogram(target)
    },
    {
      id: ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND,
      title: '新建程序集变量',
      category: 'LingCpp 新手模式',
      keybindings: ['Ctrl+D'],
      keybindingPriority: 100,
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canAddAssemblyVariable']) && isWritable(context),
      handler: () => activeLingCppBeginnerCommandTargetService.require().addAssemblyVariable()
    },
    {
      id: ADD_BEGINNER_LOCAL_VARIABLE_COMMAND,
      title: '新建局部变量',
      category: 'LingCpp 新手模式',
      keybindings: ['Ctrl+L'],
      keybindingPriority: 100,
      when: 'lingcpp.beginner.active',
      enabled: hasLocalTarget,
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().addLocalVariable(target)
    },
    {
      id: ADD_BEGINNER_LOCAL_CONSTANT_COMMAND,
      title: '新建局部常量',
      category: 'LingCpp 新手模式',
      keybindings: ['Ctrl+B'],
      keybindingPriority: 100,
      when: 'lingcpp.beginner.active',
      enabled: hasLocalTarget,
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().addLocalConstant(target)
    },
    {
      id: MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND,
      title: '上移子程序',
      category: 'LingCpp 新手模式',
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canMoveSubprogramUp']) && isWritable(context),
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().moveSubprogram(target, 'up')
    },
    {
      id: MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND,
      title: '下移子程序',
      category: 'LingCpp 新手模式',
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canMoveSubprogramDown']) && isWritable(context),
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().moveSubprogram(target, 'down')
    },
    {
      id: CUT_BEGINNER_SUBPROGRAM_COMMAND,
      title: '剪切子程序',
      category: 'LingCpp 新手模式',
      when: 'lingcpp.beginner.active',
      enabled: context => hasSubprogramTarget(context) && isWritable(context),
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().cutSubprogram(target)
    },
    {
      id: COPY_BEGINNER_SUBPROGRAM_COMMAND,
      title: '复制子程序',
      category: 'LingCpp 新手模式',
      when: 'lingcpp.beginner.active',
      enabled: hasSubprogramTarget,
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().copySubprogram(target)
    },
    {
      id: PASTE_BEGINNER_SUBPROGRAM_COMMAND,
      title: '粘贴子程序',
      category: 'LingCpp 新手模式',
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canPasteSubprogram']) && isWritable(context),
      handler: (_context, target?: LingCppBeginnerMethodTarget) =>
        activeLingCppBeginnerCommandTargetService.require().pasteSubprogram(target)
    }
  ]);
  const menuRegistration = menus.registerMenuItems([
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: ADD_BEGINNER_SUBPROGRAM_COMMAND,
      group: 'navigation',
      order: 10,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND,
      group: 'navigation',
      order: 20,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: ADD_BEGINNER_LOCAL_VARIABLE_COMMAND,
      group: 'navigation',
      order: 30,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: ADD_BEGINNER_LOCAL_CONSTANT_COMMAND,
      group: 'navigation',
      order: 40,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND,
      group: 'navigation',
      order: 50,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND,
      group: 'navigation',
      order: 60,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: CUT_BEGINNER_SUBPROGRAM_COMMAND,
      group: 'navigation',
      order: 70,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: COPY_BEGINNER_SUBPROGRAM_COMMAND,
      group: 'navigation',
      order: 80,
      source: 'builtin'
    },
    {
      menu: LINGCPP_BEGINNER_CONTEXT_MENU,
      command: PASTE_BEGINNER_SUBPROGRAM_COMMAND,
      group: 'navigation',
      order: 90,
      source: 'builtin'
    }
  ]);
  const record = {
    refs: 1,
    registration: {
      dispose: () => {
        menuRegistration.dispose();
        commandRegistration.dispose();
      }
    }
  };
  registrations.set(commands, record);
  return releaseRegistration(commands, record);
}

function releaseRegistration(
  commands: CommandService,
  record: { refs: number; registration: CommandRegistration }
): CommandRegistration {
  let disposed = false;
  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      record.refs -= 1;
      if (record.refs > 0) return;
      record.registration.dispose();
      registrations.delete(commands);
    }
  };
}
