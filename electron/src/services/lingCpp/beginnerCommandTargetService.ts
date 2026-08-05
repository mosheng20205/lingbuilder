import type { CommandService } from '../commands/commandService';
import type { CommandContext, CommandRegistration } from '../commands/types';
import type { MenuService } from '../menus/menuService';
import { LINGCPP_BEGINNER_CONTEXT_MENU } from '../menus/types';

export const ADD_BEGINNER_LOCAL_VARIABLE_COMMAND = 'lingcpp.beginner.addLocalVariable';
export const ADD_BEGINNER_LOCAL_CONSTANT_COMMAND = 'lingcpp.beginner.addLocalConstant';
export const ADD_BEGINNER_SUBPROGRAM_COMMAND = 'lingcpp.beginner.addSubprogram';
export const ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND = 'lingcpp.beginner.addAssemblyVariable';

export interface LingCppBeginnerMethodTarget {
  className: string;
  methodName: string;
}

export interface LingCppBeginnerCommandTarget {
  id: string;
  addSubprogram(): unknown;
  addAssemblyVariable(): unknown;
  addLocalVariable(target?: LingCppBeginnerMethodTarget): unknown;
  addLocalConstant(target?: LingCppBeginnerMethodTarget): unknown;
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
  const commandRegistration = commands.registerCommands([
    {
      id: ADD_BEGINNER_SUBPROGRAM_COMMAND,
      title: '新建子程序',
      category: 'LingCpp 新手模式',
      keybindings: ['Ctrl+N'],
      keybindingPriority: 100,
      when: 'lingcpp.beginner.active',
      enabled: context => Boolean(context['lingcpp.beginner.canAddSubprogram']) && isWritable(context),
      handler: () => activeLingCppBeginnerCommandTargetService.require().addSubprogram()
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
