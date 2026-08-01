import type { CommandService } from '../commands/commandService';
import type { CommandRegistration } from '../commands/types';
import { getMenuService } from '../menus/menuService';
import { LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU } from '../menus/types';
import {
  DesignerNavigationRequest,
  requestDesignerNavigation
} from '../windowDesigner/designerNavigationService';

export const REVEAL_LINGCPP_CONTROL_COMMAND = 'lingcpp.action.revealControl';

const registrations = new WeakMap<CommandService, { refs: number; registration: CommandRegistration }>();

export function acquireLingCppControlReferenceCommands(commands: CommandService): CommandRegistration {
  const existing = registrations.get(commands);
  if (existing) {
    existing.refs += 1;
    return release(commands, existing);
  }
  const menus = getMenuService(commands);
  const commandRegistration = commands.registerCommand({
    id: REVEAL_LINGCPP_CONTROL_COMMAND,
    title: '跳转到控件',
    aliases: ['Reveal Control', 'Go to Designer Control', '定位控件'],
    category: '中文代码',
    description: '打开可视化设计器，并按稳定 ID 选中当前代码引用的控件或资源。',
    when: 'workspace.open',
    handler: (_context, request: Omit<DesignerNavigationRequest, 'requestId'>) => {
      if (!request?.projectId || !request.windowId || !request.controlId) {
        throw new Error('当前光标没有可跳转的控件引用。');
      }
      return requestDesignerNavigation(request);
    }
  });
  const menuRegistration = menus.registerMenuItem({
    menu: LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU,
    command: REVEAL_LINGCPP_CONTROL_COMMAND,
    group: 'navigation',
    order: 10,
    source: 'builtin'
  });
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
  return release(commands, record);
}

function release(
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
