import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandService } from '../src/services/commands/commandService';
import { MenuService } from '../src/services/menus/menuService';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { SOLUTION_EXPLORER_CONTEXT_MENU, SOLUTION_PROJECT_CONTEXT_MENU } from '../src/services/menus/types';
import {
  CREATE_SOLUTION_FOLDER_COMMAND,
  RENAME_SOLUTION_PROJECT_COMMAND,
  registerSolutionExplorerMenu
} from '../src/services/solution/solutionExplorerMenu';

test('MenuService resolves commands, groups, submenus and dynamic disposal', async () => {
  const commands = createCommandService();
  const executed: unknown[][] = [];
  commands.registerCommands([
    { id: 'designer.test.open', title: '打开', when: 'designer.active', handler: (_context, ...args) => executed.push(args) },
    { id: 'designer.test.delete', title: '删除', enabled: context => Boolean(context['designer.canDelete']), handler: () => undefined }
  ]);
  const menus = new MenuService(commands);
  menus.registerSubmenu({ id: 'designer.test.more', title: '更多' });
  const registration = menus.registerMenuItems([
    { menu: 'designer/control/context', command: 'designer.test.open', group: 'navigation', arguments: ['value'] },
    { menu: 'designer/control/context', submenu: 'designer.test.more', group: 'layout' },
    { menu: 'designer.test.more', command: 'designer.test.delete', when: 'designer.hasSelection' }
  ]);
  const resolved = menus.resolveMenu('designer/control/context', {
    'designer.active': true,
    'designer.hasSelection': true,
    'designer.canDelete': false
  }, { includeDisabled: true });
  assert.equal(resolved[0].kind, 'command');
  assert.equal(resolved[1].kind, 'separator');
  assert.equal(resolved[2].kind, 'submenu');
  if (resolved[0].kind === 'command') await commands.executeCommand(resolved[0].command.id, { 'designer.active': true }, ...resolved[0].arguments);
  assert.deepEqual(executed, [['value']]);
  if (resolved[2].kind === 'submenu' && resolved[2].items[0].kind === 'command') assert.equal(resolved[2].items[0].command.enabled, false);
  registration.dispose();
  assert.deepEqual(menus.resolveMenu('designer/control/context', { 'designer.active': true }), []);
});

test('MenuService hides missing commands and diagnoses submenu cycles', () => {
  const menus = new MenuService(createCommandService());
  menus.registerSubmenus([{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }]);
  menus.registerMenuItems([
    { menu: 'root', command: 'missing.command' },
    { menu: 'root', submenu: 'a' },
    { menu: 'a', submenu: 'b' },
    { menu: 'b', submenu: 'a' }
  ]);
  assert.deepEqual(menus.resolveMenu('root', {}, { includeDisabled: true }), []);
  assert.ok(menus.getDiagnostics().some(item => item.code === 'missing-command'));
  assert.ok(menus.getDiagnostics().some(item => item.code === 'submenu-cycle'));
});

test('MenuService rejects non-serializable or oversized arguments', () => {
  const menus = new MenuService(createCommandService());
  assert.throws(() => menus.registerMenuItem({ menu: 'x', command: 'x', arguments: [BigInt(1)] }), /JSON/);
  assert.throws(() => menus.registerMenuItem({ menu: 'x', command: 'x', arguments: ['x'.repeat(40_000)] }), /32KB/);
});

test('solution explorer folder and project actions use MenuService and unregister cleanly', () => {
  const commands = createCommandService();
  commands.registerCommand({ id: CREATE_SOLUTION_FOLDER_COMMAND, title: '新建解决方案文件夹', handler: () => true });
  commands.registerCommand({ id: RENAME_SOLUTION_PROJECT_COMMAND, title: '重命名项目', handler: () => true });
  const menus = new MenuService(commands);
  const registration = registerSolutionExplorerMenu(menus);
  const resolved = menus.resolveMenu(SOLUTION_EXPLORER_CONTEXT_MENU, { 'workspace.open': true });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0].kind, 'command');
  if (resolved[0].kind === 'command') assert.equal(resolved[0].command.id, CREATE_SOLUTION_FOLDER_COMMAND);
  const projectMenu = menus.resolveMenu(SOLUTION_PROJECT_CONTEXT_MENU, { 'workspace.open': true });
  assert.equal(projectMenu.length, 1);
  if (projectMenu[0].kind === 'command') assert.equal(projectMenu[0].command.id, RENAME_SOLUTION_PROJECT_COMMAND);
  registration.dispose();
  assert.deepEqual(menus.resolveMenu(SOLUTION_EXPLORER_CONTEXT_MENU, { 'workspace.open': true }), []);
  assert.deepEqual(menus.resolveMenu(SOLUTION_PROJECT_CONTEXT_MENU, { 'workspace.open': true }), []);
});

test('module v2 validates declarative menus and container layouts', () => {
  const base = { schemaVersion: 2, id: 'example.ui', name: 'example', version: '1.0.0', category: '界面', description: 'example' };
  const valid = validateModuleManifest({
    ...base,
    contributes: {
      submenus: [{ id: 'example.more', title: '更多' }],
      menus: [{ menu: 'designer/control/context', submenu: 'example.more' }, { menu: 'example.more', command: 'designer.action.openProperties' }],
      designerControls: [{ type: 'Flow', label: '流式', isContainer: true, layout: { mode: 'flow', coordinateSpace: 'parent' }, defaultProps: {} }]
    }
  });
  assert.deepEqual(valid.diagnostics, []);
  const invalid = validateModuleManifest({ ...base, contributes: { menus: [{ menu: 'designer/control/context', command: 'a', submenu: 'b' }] } });
  assert.ok(invalid.diagnostics.some(item => item.includes('且只能')));
});
