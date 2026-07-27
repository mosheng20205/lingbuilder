import type { MenuService } from '../menus/menuService';
import {
  SOLUTION_EXPLORER_CONTEXT_MENU,
  SOLUTION_PROJECT_CONTEXT_MENU,
  type MenuRegistration
} from '../menus/types';

export const CREATE_SOLUTION_FOLDER_COMMAND = 'workbench.action.solution.createFolder';
export const MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND = 'workbench.action.solution.moveProjectToFolder';
export const RENAME_SOLUTION_PROJECT_COMMAND = 'workbench.action.solution.renameProject';

export function registerSolutionExplorerMenu(menus: MenuService): MenuRegistration {
  return menus.registerMenuItems([
    {
      menu: SOLUTION_EXPLORER_CONTEXT_MENU,
      command: CREATE_SOLUTION_FOLDER_COMMAND,
      group: 'navigation',
      order: 20,
      source: 'builtin'
    },
    {
      menu: SOLUTION_PROJECT_CONTEXT_MENU,
      command: RENAME_SOLUTION_PROJECT_COMMAND,
      group: 'state',
      order: 10,
      source: 'builtin'
    }
  ]);
}
