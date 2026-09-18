import type { MenuService } from '../menus/menuService';
import {
  SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU,
  SOLUTION_EXPLORER_CONTEXT_MENU,
  SOLUTION_PROJECT_CONTEXT_MENU,
  type MenuRegistration
} from '../menus/types';

export const CREATE_SOLUTION_FOLDER_COMMAND = 'workbench.action.solution.createFolder';
export const MOVE_PROJECT_TO_SOLUTION_FOLDER_COMMAND = 'workbench.action.solution.moveProjectToFolder';
export const RENAME_SOLUTION_PROJECT_COMMAND = 'workbench.action.solution.renameProject';
/** 解决方案资源管理器「内嵌资源」组：复制逻辑名/源文件路径、打开源文件、打开配置对话框。 */
export const COPY_EMBEDDED_RESOURCE_NAME_COMMAND = 'workbench.action.project.copyEmbeddedResourceName';
export const COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND = 'workbench.action.project.copyEmbeddedResourceSource';
export const OPEN_EMBEDDED_RESOURCE_SOURCE_COMMAND = 'workbench.action.project.openEmbeddedResourceSource';
export const CONFIGURE_EMBEDDED_RESOURCES_COMMAND = 'workbench.action.project.configureEmbeddedResources';

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
    },
    // 内嵌资源：写代码时最常用的是把逻辑名贴进 资源_* 调用，所以复制类动作排在最前。
    {
      menu: SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU,
      command: COPY_EMBEDDED_RESOURCE_NAME_COMMAND,
      group: 'clipboard',
      order: 10,
      source: 'builtin'
    },
    {
      menu: SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU,
      command: COPY_EMBEDDED_RESOURCE_SOURCE_COMMAND,
      group: 'clipboard',
      order: 20,
      source: 'builtin'
    },
    {
      menu: SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU,
      command: OPEN_EMBEDDED_RESOURCE_SOURCE_COMMAND,
      group: 'navigation',
      order: 10,
      when: 'embeddedResource.openable',
      source: 'builtin'
    },
    {
      menu: SOLUTION_EMBEDDED_RESOURCE_CONTEXT_MENU,
      command: CONFIGURE_EMBEDDED_RESOURCES_COMMAND,
      group: 'settings',
      order: 10,
      source: 'builtin'
    }
  ]);
}
