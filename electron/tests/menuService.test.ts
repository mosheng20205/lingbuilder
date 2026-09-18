import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommandService } from '../src/services/commands/commandService';
import { MenuService } from '../src/services/menus/menuService';
import { validateModuleManifest } from '../src/services/modules/manifest';
import { DESIGNER_CONTROL_CONTEXT_MENU, LINGCPP_BEGINNER_CONTEXT_MENU, SOLUTION_EXPLORER_CONTEXT_MENU, SOLUTION_PROJECT_CONTEXT_MENU } from '../src/services/menus/types';
import {
  CREATE_SOLUTION_FOLDER_COMMAND,
  RENAME_SOLUTION_PROJECT_COMMAND,
  registerSolutionExplorerMenu
} from '../src/services/solution/solutionExplorerMenu';
import { acquireDesignerCommands, activeDesignerCommandTargetService } from '../src/services/windowDesigner/designerCommandTargetService';
import {
  acquireLingCppBeginnerCommands,
  activeLingCppBeginnerCommandTargetService,
  ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND,
  ADD_BEGINNER_LOCAL_CONSTANT_COMMAND,
  ADD_BEGINNER_LOCAL_VARIABLE_COMMAND,
  ADD_BEGINNER_SUBPROGRAM_COMMAND,
  COPY_BEGINNER_SUBPROGRAM_COMMAND,
  CUT_BEGINNER_SUBPROGRAM_COMMAND,
  MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND,
  MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND,
  PASTE_BEGINNER_SUBPROGRAM_COMMAND
} from '../src/services/lingCpp/beginnerCommandTargetService';
import {
  acquireLingCppControlReferenceCommands,
  REVEAL_LINGCPP_CONTROL_COMMAND
} from '../src/services/lingCpp/controlReferenceCommands';
import {
  acquireLingCppDllCommandsEditorCommands,
  COLLAPSE_ALL_DLL_COMMANDS_COMMAND,
  EXPAND_ALL_DLL_COMMANDS_COMMAND,
  SEARCH_DLL_COMMANDS_COMMAND
} from '../src/services/lingCpp/dllCommandsEditorCommands';
import { getMenuService } from '../src/services/menus/menuService';
import { LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU, LINGCPP_DLL_COMMANDS_CONTEXT_MENU } from '../src/services/menus/types';
import {
  clearDesignerNavigationRequests,
  completeDesignerNavigation,
  getPendingDesignerNavigation,
  registerDesignerNavigationTarget,
  subscribeDesignerNavigation
} from '../src/services/windowDesigner/designerNavigationService';

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

test('控件引用右键菜单通过 CommandService 路由，并在设计器挂载前保留稳定 ID 导航请求', async () => {
  clearDesignerNavigationRequests();
  const commands = createCommandService();
  const registration = acquireLingCppControlReferenceCommands(commands);
  const menu = getMenuService(commands).resolveMenu(
    LINGCPP_CONTROL_REFERENCE_CONTEXT_MENU,
    { 'workspace.open': true, 'lingcpp.controlReference': true }
  );
  assert.equal(menu.length, 1);
  assert.equal(menu[0].kind, 'command');
  if (menu[0].kind !== 'command') return;
  assert.equal(menu[0].command.id, REVEAL_LINGCPP_CONTROL_COMMAND);

  await commands.executeCommand(menu[0].command.id, { 'workspace.open': true }, {
    projectId: 'project-1',
    windowId: 'window-1',
    controlId: 'control-1',
    kind: 'visual',
    name: '操作结果'
  });
  const pending = getPendingDesignerNavigation('project-1');
  assert.equal(pending?.windowId, 'window-1');
  assert.equal(pending?.controlId, 'control-1');
  let focused = '';
  const target = registerDesignerNavigationTarget({
    projectId: 'project-1', windowId: 'window-1', controlId: 'control-1', kind: 'visual'
  }, request => { focused = request.controlId; });
  assert.equal(focused, 'control-1');
  assert.equal(getPendingDesignerNavigation('project-1'), undefined);

  let observed = '';
  const listener = subscribeDesignerNavigation(request => { observed = request.controlId; });
  await commands.executeCommand(menu[0].command.id, { 'workspace.open': true }, {
    projectId: 'project-1', windowId: 'window-1', controlId: 'control-2', kind: 'resource'
  });
  assert.equal(observed, 'control-2');
  completeDesignerNavigation(getPendingDesignerNavigation('project-1')!.requestId);
  assert.equal(getPendingDesignerNavigation('project-1'), undefined);
  listener.dispose();
  target.dispose();
  registration.dispose();
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

test('EdgeView preview command is visible only for an EdgeBrowser selection and invokes the active designer', async () => {
  const commands = createCommandService();
  const menus = new MenuService(commands);
  const commandRegistration = acquireDesignerCommands(commands, menus);
  let previewed = 0;
  const noop = () => undefined;
  const targetRegistration = activeDesignerCommandTargetService.register({
    id: 'edge-preview-test', getContext: () => ({}), openDefaultEvent: noop, openProperties: noop,
    copy: async () => undefined, cut: async () => undefined, paste: async () => undefined, duplicate: async () => undefined,
    deleteSelection: noop, deleteResource: noop, selectAll: noop, applyLayout: noop, reorder: noop, setLocked: noop,
    selectParent: noop, selectChildren: noop, moveToRoot: noop, previewEdgeControl: async () => { previewed += 1; },
    addEmbeddedResourceFiles: async () => '', addEmbeddedResourceFolder: async () => '',
    addEmbeddedResourceDirectory: async () => '', enableEmbeddedResourceModule: async () => ''
  });
  const edgeContext = { 'designer.active': true, 'designer.hasSelection': true, 'designer.control.type': 'EdgeBrowser' };
  const buttonContext = { ...edgeContext, 'designer.control.type': 'Button' };
  assert.equal(commands.getCommandState('designer.edgeview.previewControl', edgeContext).enabled, true);
  assert.equal(commands.getCommandState('designer.edgeview.previewControl', buttonContext).enabled, false);
  const edgeMenu = menus.resolveMenu(DESIGNER_CONTROL_CONTEXT_MENU, edgeContext, { includeDisabled: true });
  assert.ok(edgeMenu.some(item => item.kind === 'command' && item.command.id === 'designer.edgeview.previewControl' && item.command.enabled));
  await commands.executeCommand('designer.edgeview.previewControl', edgeContext);
  assert.equal(previewed, 1);
  targetRegistration.dispose();
  commandRegistration.dispose();
});

test('embedded resource panel actions run through the designer command service with arguments', async () => {
  const commands = createCommandService();
  const menus = new MenuService(commands);
  const commandRegistration = acquireDesignerCommands(commands, menus);
  const calls: string[] = [];
  const noop = () => undefined;
  const targetRegistration = activeDesignerCommandTargetService.register({
    id: 'embedded-resource-test', getContext: () => ({}), openDefaultEvent: noop, openProperties: noop,
    copy: async () => undefined, cut: async () => undefined, paste: async () => undefined, duplicate: async () => undefined,
    deleteSelection: noop, deleteResource: noop, selectAll: noop, applyLayout: noop, reorder: noop, setLocked: noop,
    selectParent: noop, selectChildren: noop, moveToRoot: noop, previewEdgeControl: async () => undefined,
    addEmbeddedResourceFiles: async () => { calls.push('files'); return '已选择文件。'; },
    addEmbeddedResourceFolder: async () => { calls.push('folder'); return '已选择文件夹。'; },
    addEmbeddedResourceDirectory: async directory => { calls.push(`scan:${directory}`); return '已扫描目录。'; },
    enableEmbeddedResourceModule: async () => { calls.push('module'); return '已启用模块。'; }
  });
  const context = { 'designer.active': true };
  const disabled = commands.getCommandState('designer.embeddedResources.addFiles', { 'designer.active': false });
  assert.equal(disabled.enabled, false);
  assert.equal(await commands.executeCommand('designer.embeddedResources.addFiles', context), '已选择文件。');
  assert.equal(await commands.executeCommand('designer.embeddedResources.addFolder', context), '已选择文件夹。');
  assert.equal(await commands.executeCommand('designer.embeddedResources.addDirectory', context, 'assets'), '已扫描目录。');
  assert.equal(await commands.executeCommand('designer.embeddedResources.enableModule', context), '已启用模块。');
  assert.deepEqual(calls, ['files', 'folder', 'scan:assets', 'module']);
  targetRegistration.dispose();
  commandRegistration.dispose();
});

test('LingCpp beginner creation commands expose shortcuts, execute through MenuService and unregister cleanly', async () => {
  const commands = createCommandService();
  const menus = new MenuService(commands);
  const commandRegistration = acquireLingCppBeginnerCommands(commands, menus);
  const calls: Array<{
    kind: 'subprogram' | 'assembly-variable' | 'variable' | 'constant' | 'move-up' | 'move-down' | 'cut' | 'copy' | 'paste';
    target?: { className: string; methodName: string };
    direction?: 'up' | 'down';
  }> = [];
  const targetRegistration = activeLingCppBeginnerCommandTargetService.register({
    id: 'beginner-local-test',
    addSubprogram: target => calls.push({ kind: 'subprogram', target }),
    addAssemblyVariable: () => calls.push({ kind: 'assembly-variable' }),
    addLocalVariable: target => calls.push({ kind: 'variable', target }),
    addLocalConstant: target => calls.push({ kind: 'constant', target }),
    moveSubprogram: (target, direction) => calls.push({ kind: direction === 'up' ? 'move-up' : 'move-down', target, direction }),
    cutSubprogram: target => calls.push({ kind: 'cut', target }),
    copySubprogram: target => calls.push({ kind: 'copy', target }),
    pasteSubprogram: target => calls.push({ kind: 'paste', target })
  });
  const enabledContext = {
    'lingcpp.beginner.active': true,
    'lingcpp.beginner.hasTarget': true,
    'lingcpp.beginner.canAddSubprogram': true,
    'lingcpp.beginner.canAddAssemblyVariable': true,
    'lingcpp.beginner.hasSubprogramTarget': true,
    'lingcpp.beginner.canMoveSubprogramUp': true,
    'lingcpp.beginner.canMoveSubprogramDown': true,
    'lingcpp.beginner.canPasteSubprogram': true,
    'lingcpp.beginner.writable': true
  };
  const disabledContext = {
    'lingcpp.beginner.active': true,
    'lingcpp.beginner.hasTarget': false,
    'lingcpp.beginner.canAddSubprogram': false,
    'lingcpp.beginner.canAddAssemblyVariable': false,
    'lingcpp.beginner.hasSubprogramTarget': false,
    'lingcpp.beginner.canMoveSubprogramUp': false,
    'lingcpp.beginner.canMoveSubprogramDown': false,
    'lingcpp.beginner.canPasteSubprogram': false,
    'lingcpp.beginner.writable': false
  };
  const enabledMenu = menus.resolveMenu(LINGCPP_BEGINNER_CONTEXT_MENU, enabledContext, { includeDisabled: true });
  const disabledMenu = menus.resolveMenu(LINGCPP_BEGINNER_CONTEXT_MENU, disabledContext, { includeDisabled: true });

  assert.deepEqual(enabledMenu.filter(item => item.kind === 'command').map(item => item.kind === 'command' && item.command.id), [
    ADD_BEGINNER_SUBPROGRAM_COMMAND,
    ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND,
    ADD_BEGINNER_LOCAL_VARIABLE_COMMAND,
    ADD_BEGINNER_LOCAL_CONSTANT_COMMAND,
    MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND,
    MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND,
    CUT_BEGINNER_SUBPROGRAM_COMMAND,
    COPY_BEGINNER_SUBPROGRAM_COMMAND,
    PASTE_BEGINNER_SUBPROGRAM_COMMAND
  ]);
  assert.deepEqual(enabledMenu.filter(item => item.kind === 'command').map(item => item.kind === 'command' && item.command.keybindings[0]).slice(0, 4), [
    'Ctrl+N',
    'Ctrl+D',
    'Ctrl+L',
    'Ctrl+B'
  ]);
  assert.ok(enabledMenu.every(item => item.kind !== 'command' || item.command.enabled));
  assert.ok(disabledMenu.every(item => item.kind !== 'command' || !item.command.enabled));

  const methodTarget = { className: 'MainWindow', methodName: '创建完毕' };
  await commands.executeKeybinding('Ctrl+N', enabledContext);
  await commands.executeKeybinding('Ctrl+D', enabledContext);
  await commands.executeKeybinding('Ctrl+L', enabledContext, methodTarget);
  await commands.executeKeybinding('Ctrl+B', enabledContext, methodTarget);
  await commands.executeCommand(MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND, enabledContext, methodTarget);
  await commands.executeCommand(MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND, enabledContext, methodTarget);
  await commands.executeCommand(CUT_BEGINNER_SUBPROGRAM_COMMAND, enabledContext, methodTarget);
  await commands.executeCommand(COPY_BEGINNER_SUBPROGRAM_COMMAND, enabledContext, methodTarget);
  await commands.executeCommand(PASTE_BEGINNER_SUBPROGRAM_COMMAND, enabledContext, methodTarget);
  assert.deepEqual(calls, [
    { kind: 'subprogram', target: undefined },
    { kind: 'assembly-variable' },
    { kind: 'variable', target: methodTarget },
    { kind: 'constant', target: methodTarget },
    { kind: 'move-up', target: methodTarget, direction: 'up' },
    { kind: 'move-down', target: methodTarget, direction: 'down' },
    { kind: 'cut', target: methodTarget },
    { kind: 'copy', target: methodTarget },
    { kind: 'paste', target: methodTarget }
  ]);

  targetRegistration.dispose();
  commandRegistration.dispose();
  assert.deepEqual(menus.resolveMenu(LINGCPP_BEGINNER_CONTEXT_MENU, enabledContext, { includeDisabled: true }), []);
  assert.equal(commands.hasCommand(ADD_BEGINNER_SUBPROGRAM_COMMAND), false);
  assert.equal(commands.hasCommand(ADD_BEGINNER_ASSEMBLY_VARIABLE_COMMAND), false);
  assert.equal(commands.hasCommand(ADD_BEGINNER_LOCAL_VARIABLE_COMMAND), false);
  assert.equal(commands.hasCommand(ADD_BEGINNER_LOCAL_CONSTANT_COMMAND), false);
  assert.equal(commands.hasCommand(MOVE_BEGINNER_SUBPROGRAM_UP_COMMAND), false);
  assert.equal(commands.hasCommand(MOVE_BEGINNER_SUBPROGRAM_DOWN_COMMAND), false);
  assert.equal(commands.hasCommand(CUT_BEGINNER_SUBPROGRAM_COMMAND), false);
  assert.equal(commands.hasCommand(COPY_BEGINNER_SUBPROGRAM_COMMAND), false);
  assert.equal(commands.hasCommand(PASTE_BEGINNER_SUBPROGRAM_COMMAND), false);
});

test('项目 DLL 命令声明编辑器右键菜单的三个视图动作在 workspace.open 上下文下可执行', async () => {
  const commands = createCommandService();
  const actions: string[] = [];
  const registration = acquireLingCppDllCommandsEditorCommands(commands, {
    onSearch: () => actions.push('search'),
    onExpandAll: () => actions.push('expandAll'),
    onCollapseAll: () => actions.push('collapseAll')
  });
  const menus = getMenuService(commands);
  try {
    const items = menus.resolveMenu(LINGCPP_DLL_COMMANDS_CONTEXT_MENU, { 'workspace.open': true }, { includeDisabled: true });
    assert.deepEqual(
      items.map(item => (item.kind === 'command' ? item.command.id : item.kind)),
      [SEARCH_DLL_COMMANDS_COMMAND, EXPAND_ALL_DLL_COMMANDS_COMMAND, COLLAPSE_ALL_DLL_COMMANDS_COMMAND]
    );
    // 历史缺陷：菜单按 workspace.open 解析为可用，点击却以空上下文执行 → 按「当前上下文中不可用」抛错被吞掉，表现为点了没反应。
    await assert.rejects(commands.executeCommand(SEARCH_DLL_COMMANDS_COMMAND), /不可用/u);
    for (const item of items) {
      if (item.kind !== 'command') continue;
      await commands.executeCommand(item.command.id, { 'workspace.open': true });
    }
    assert.deepEqual(actions, ['search', 'expandAll', 'collapseAll']);
  } finally {
    registration.dispose();
  }
  assert.deepEqual(menus.resolveMenu(LINGCPP_DLL_COMMANDS_CONTEXT_MENU, { 'workspace.open': true }, { includeDisabled: true }), []);
  assert.equal(commands.hasCommand(SEARCH_DLL_COMMANDS_COMMAND), false);
});
