import type { CommandService } from '../commands/commandService';
import type { CommandRegistration } from '../commands/types';
import { getMenuService } from '../menus/menuService';
import { LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU } from '../menus/types';

export const SEARCH_CPP_SOURCE_LIBRARY_COMMAND = 'lingcpp.cppSourceLibrary.search';
export const EXPAND_ALL_CPP_SOURCE_LIBRARY_COMMAND = 'lingcpp.cppSourceLibrary.expandAll';
export const COLLAPSE_ALL_CPP_SOURCE_LIBRARY_COMMAND = 'lingcpp.cppSourceLibrary.collapseAll';

/** 项目 C++ 源码库声明编辑器的视图动作回调（由编辑器组件注入，命令经菜单触发）。 */
export interface CppSourceLibraryEditorActions {
  onSearch: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

interface CppSourceLibraryEditorCommandRecord {
  refs: number;
  registration: CommandRegistration;
  actions: CppSourceLibraryEditorActions;
}

const registrations = new WeakMap<CommandService, CppSourceLibraryEditorCommandRecord>();

/**
 * 注册项目 C++ 源码库声明编辑器的视图命令与右键菜单贡献。
 * 同一 CommandService 多处挂载时按引用计数共享；动作回调以最新一次 acquire 为准。
 */
export function acquireLingCppCppSourceLibraryEditorCommands(commands: CommandService, actions: CppSourceLibraryEditorActions): CommandRegistration {
  const existing = registrations.get(commands);
  if (existing) {
    existing.refs += 1;
    existing.actions = actions;
    return release(commands, existing);
  }
  const menus = getMenuService(commands);
  const resolveActions = (): CppSourceLibraryEditorActions => {
    const record = registrations.get(commands);
    if (!record) throw new Error('C++ 源码库编辑器视图动作尚未就绪。');
    return record.actions;
  };
  const searchCommand = commands.registerCommand({
    id: SEARCH_CPP_SOURCE_LIBRARY_COMMAND,
    title: '搜索 C++ 源码库命令',
    aliases: ['Search C++ Source Library Commands'],
    category: '中文代码',
    description: '在项目 C++ 源码库声明编辑器中按命令名、函数名、参数或备注过滤命令。',
    when: 'workspace.open',
    handler: () => resolveActions().onSearch()
  });
  const expandCommand = commands.registerCommand({
    id: EXPAND_ALL_CPP_SOURCE_LIBRARY_COMMAND,
    title: '展开所有 C++ 源码库命令',
    aliases: ['Expand All C++ Source Library Commands'],
    category: '中文代码',
    description: '展开项目 C++ 源码库声明编辑器中的全部命令卡片。',
    when: 'workspace.open',
    handler: () => resolveActions().onExpandAll()
  });
  const collapseCommand = commands.registerCommand({
    id: COLLAPSE_ALL_CPP_SOURCE_LIBRARY_COMMAND,
    title: '折叠所有 C++ 源码库命令',
    aliases: ['Collapse All C++ Source Library Commands'],
    category: '中文代码',
    description: '折叠项目 C++ 源码库声明编辑器中的全部命令卡片，仅保留命令名概要行。',
    when: 'workspace.open',
    handler: () => resolveActions().onCollapseAll()
  });
  const menuRegistrations = [
    menus.registerMenuItem({ menu: LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU, command: SEARCH_CPP_SOURCE_LIBRARY_COMMAND, group: 'actions', order: 10, source: 'builtin' }),
    menus.registerMenuItem({ menu: LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU, command: EXPAND_ALL_CPP_SOURCE_LIBRARY_COMMAND, group: 'actions', order: 20, source: 'builtin' }),
    menus.registerMenuItem({ menu: LINGCPP_CPP_SOURCE_LIBRARY_CONTEXT_MENU, command: COLLAPSE_ALL_CPP_SOURCE_LIBRARY_COMMAND, group: 'actions', order: 30, source: 'builtin' })
  ];
  const record: CppSourceLibraryEditorCommandRecord = {
    refs: 1,
    actions,
    registration: {
      dispose: () => {
        menuRegistrations.forEach(item => item.dispose());
        searchCommand.dispose();
        expandCommand.dispose();
        collapseCommand.dispose();
      }
    }
  };
  registrations.set(commands, record);
  return release(commands, record);
}

function release(commands: CommandService, record: CppSourceLibraryEditorCommandRecord): CommandRegistration {
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
