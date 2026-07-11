import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CommandRegistrationError,
  CommandServiceError,
  compileCommandWhenClause,
  createCommandService,
  normalizeKeybinding
} from '../src/services/commands';

test('command service registers Chinese titles, executes by English alias, and disposes safely', async () => {
  const service = createCommandService();
  const changes: string[] = [];
  const listener = service.onDidChange(event => changes.push(`${event.reason}:${event.commandId}`));
  const registration = service.registerCommand({
    id: 'workbench.action.files.save',
    title: '保存文件',
    aliases: ['save', 'SaveFile'],
    category: '文件',
    handler: async (context, suffix) => `${context.fileName}:${suffix}`
  });

  assert.equal(service.hasCommand('SAVE'), true);
  assert.equal(service.getCommand('save')?.title, '保存文件');
  assert.equal(
    await service.executeCommand('savefile', { fileName: 'main.lcpp' }, '已写入'),
    'main.lcpp:已写入'
  );
  assert.deepEqual(changes, ['registered:workbench.action.files.save']);

  registration.dispose();
  registration.dispose();
  assert.equal(service.hasCommand('save'), false);
  assert.deepEqual(changes, [
    'registered:workbench.action.files.save',
    'unregistered:workbench.action.files.save'
  ]);
  listener.dispose();
});

test('duplicate IDs and aliases fail with complete Chinese diagnostics without replacing the first command', () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'editor.open',
    title: '打开编辑器',
    aliases: ['openEditor'],
    handler: () => 'first'
  });

  assert.throws(
    () => service.registerCommand({ id: 'editor.open', title: '重复命令', handler: () => 'second' }),
    (error: unknown) => error instanceof CommandRegistrationError
      && error.diagnostic.code === 'duplicate-command-id'
      && /editor\.open.*已注册/.test(error.message)
  );
  assert.throws(
    () => service.registerCommand({ id: 'editor.other', title: '其他', aliases: ['OPENEDITOR'], handler: () => null }),
    (error: unknown) => error instanceof CommandRegistrationError
      && error.diagnostic.code === 'alias-conflict'
      && /冲突/.test(error.message)
  );

  assert.equal(service.getCommand('editor.open')?.title, '打开编辑器');
  assert.deepEqual(
    service.getDiagnostics().map(item => item.code),
    ['duplicate-command-id', 'alias-conflict']
  );
});

test('when expressions support context keys, nesting, comparison, negation, and safe compilation', async () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'editor.format',
    title: '格式化中文代码',
    when: 'workspace.trusted && (editor.languageId == lingcpp || editor.languageId === cpp) && !editor.readOnly',
    handler: () => '已格式化'
  });

  const available = {
    workspace: { trusted: true },
    editor: { languageId: 'lingcpp', readOnly: false }
  };
  assert.equal(service.getCommandState('editor.format', available).whenMatched, true);
  assert.equal(await service.executeCommand('editor.format', available), '已格式化');
  assert.deepEqual(service.listCommands({ ...available, editor: { languageId: 'text', readOnly: false } }), []);

  await assert.rejects(
    service.executeCommand('editor.format', {
      workspace: { trusted: true },
      editor: { languageId: 'lingcpp', readOnly: true }
    }),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'command-unavailable'
      && /当前上下文中不可用/.test(error.message)
  );

  const predicate = compileCommandWhenClause('count == 3 && mode != release');
  assert.equal(predicate({ count: 3, mode: 'debug' }), true);
  assert.equal(predicate({ count: 3, mode: 'release' }), false);
});

test('invalid when expressions are rejected at registration with a Chinese position diagnostic', () => {
  const service = createCommandService();
  assert.throws(
    () => service.registerCommand({
      id: 'bad.when',
      title: '无效条件',
      when: 'editor.active && (workspace.trusted',
      handler: () => null
    }),
    (error: unknown) => error instanceof CommandRegistrationError
      && error.diagnostic.code === 'invalid-when-clause'
      && /when 条件无效.*位置/.test(error.message)
  );
  assert.equal(service.hasCommand('bad.when'), false);
  assert.equal(service.getDiagnostics()[0]?.code, 'invalid-when-clause');
});

test('enabled state is independent from when visibility and disabled execution reports a Chinese error', async () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'project.rename',
    title: '重命名项目',
    when: 'workspace.open',
    enabled: context => context.canRename === true,
    handler: () => null
  });

  const disabled = service.getCommandState('project.rename', { 'workspace.open': true, canRename: false });
  assert.equal(disabled.whenMatched, true);
  assert.equal(disabled.enabled, false);
  assert.equal(service.listCommands({ 'workspace.open': true, canRename: false }).length, 1);
  assert.equal(service.listCommands(
    { 'workspace.open': true, canRename: false },
    { includeDisabled: false }
  ).length, 0);

  await assert.rejects(
    service.executeCommand('project.rename', { 'workspace.open': true, canRename: false }),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'command-disabled'
      && /当前已禁用/.test(error.message)
  );
});

test('handler failures and predicate failures retain causes while presenting Chinese service errors', async () => {
  const service = createCommandService();
  const rootCause = new Error('磁盘写入失败');
  service.registerCommand({
    id: 'files.failSave',
    title: '保存失败演示',
    handler: () => { throw rootCause; }
  });
  service.registerCommand({
    id: 'context.fail',
    title: '条件失败演示',
    when: () => { throw new Error('上下文服务不可用'); },
    handler: () => null
  });

  await assert.rejects(
    service.executeCommand('files.failSave'),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'command-execution-failed'
      && error.cause === rootCause
      && /执行命令.*失败.*磁盘写入失败/.test(error.message)
  );
  assert.throws(
    () => service.getCommandState('context.fail'),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'context-evaluation-failed'
      && /条件计算失败/.test(error.message)
  );

  assert.deepEqual(service.searchCommands('context'), []);
  assert.equal(service.getDiagnostics().some(item => item.code === 'when-evaluation-failed'), true);
});

test('keybindings normalize chords, diagnose conflicts, and resolve deterministically by priority', async () => {
  const service = createCommandService();
  const calls: string[] = [];
  service.registerCommand({
    id: 'palette.first',
    title: '第一命令面板',
    keybindings: ['Shift + Control + p', 'ctrl+shift+P'],
    keybindingPriority: 1,
    handler: () => { calls.push('first'); }
  });
  const second = service.registerCommand({
    id: 'palette.second',
    title: '第二命令面板',
    keybindings: ['Ctrl+Shift+P'],
    keybindingPriority: 10,
    handler: () => { calls.push('second'); }
  });

  assert.equal(normalizeKeybinding('control+k control+c'), 'Ctrl+K Ctrl+C');
  assert.deepEqual(service.getCommand('palette.first')?.keybindings, ['Ctrl+Shift+P']);
  assert.deepEqual(
    service.resolveKeybinding('control + shift + p').map(item => item.id),
    ['palette.second', 'palette.first']
  );
  await service.executeKeybinding('Ctrl+Shift+P');
  assert.deepEqual(calls, ['second']);
  assert.equal(service.getDiagnostics().some(item => item.code === 'duplicate-command-keybinding'), true);
  assert.equal(service.getDiagnostics().some(item => item.code === 'keybinding-conflict'), true);

  second.dispose();
  await service.executeKeybinding('Ctrl+Shift+P');
  assert.deepEqual(calls, ['second', 'first']);
});

test('context-specific duplicate keybindings select the only matching command', async () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'editor.save',
    title: '保存编辑器',
    keybindings: ['Ctrl+S'],
    when: 'focus == editor',
    handler: () => 'editor'
  });
  service.registerCommand({
    id: 'designer.save',
    title: '保存设计器',
    keybindings: ['control+s'],
    when: 'focus == designer',
    handler: () => 'designer'
  });

  assert.equal(await service.executeKeybinding('Ctrl+S', { focus: 'designer' }), 'designer');
  await assert.rejects(
    service.executeKeybinding('F12', { focus: 'designer' }),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'keybinding-not-found'
      && /没有可执行的命令/.test(error.message)
  );
});

test('a disabled high-priority keybinding does not shadow a lower-priority executable command', async () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'save.disabledOverride',
    title: '禁用的保存覆盖',
    keybindings: ['Ctrl+S'],
    keybindingPriority: 100,
    enabled: false,
    handler: () => '不应执行'
  });
  service.registerCommand({
    id: 'save.fallback',
    title: '可用的保存命令',
    keybindings: ['Ctrl+S'],
    keybindingPriority: 1,
    handler: () => '已保存'
  });

  assert.deepEqual(service.resolveKeybinding('Ctrl+S').map(item => item.id), ['save.fallback']);
  assert.equal(await service.executeKeybinding('Ctrl+S'), '已保存');
});

test('command list and search use stable order, English aliases, multiple tokens, and limits', () => {
  const service = createCommandService();
  service.registerCommand({
    id: 'files.saveAll',
    title: '全部保存',
    aliases: ['saveAll'],
    category: '文件',
    description: '保存所有已修改文件',
    order: 20,
    handler: () => null
  });
  service.registerCommand({
    id: 'files.save',
    title: '保存当前文件',
    aliases: ['save', 'writeFile'],
    category: '文件',
    description: '写入当前文件',
    order: 10,
    handler: () => null
  });
  service.registerCommand({
    id: 'debug.start',
    title: '开始调试',
    aliases: ['startDebug'],
    category: '调试',
    order: 30,
    handler: () => null
  });

  const firstList = service.listCommands().map(item => item.id);
  const secondList = service.listCommands().map(item => item.id);
  assert.deepEqual(firstList, ['files.save', 'files.saveAll', 'debug.start']);
  assert.deepEqual(secondList, firstList);
  assert.deepEqual(service.searchCommands('SAVE').map(item => item.id), ['files.save', 'files.saveAll']);
  assert.deepEqual(service.searchCommands('文件 修改').map(item => item.id), ['files.saveAll']);
  assert.deepEqual(service.searchCommands('', {}, { limit: 2 }).map(item => item.id), ['files.save', 'files.saveAll']);
  assert.throws(() => service.searchCommands('', {}, { limit: -1 }), /limit.*大于或等于 0/);
});

test('batch registration rolls back earlier entries when a later definition is invalid', () => {
  const service = createCommandService();
  assert.throws(() => service.registerCommands([
    { id: 'batch.first', title: '批量命令一', handler: () => null },
    { id: 'batch.first', title: '批量命令二', handler: () => null }
  ]), CommandRegistrationError);
  assert.equal(service.hasCommand('batch.first'), false);
  assert.deepEqual(service.listCommands(), []);
});

test('unknown commands and malformed keybindings use actionable Chinese errors', async () => {
  const service = createCommandService();
  await assert.rejects(
    service.executeCommand('missing.command'),
    (error: unknown) => error instanceof CommandServiceError
      && error.code === 'command-not-found'
      && /检查命令 ID 或英文 alias/.test(error.message)
  );

  assert.throws(
    () => service.registerCommand({
      id: 'bad.keybinding',
      title: '无效快捷键',
      keybindings: ['Ctrl+Shift'],
      handler: () => null
    }),
    (error: unknown) => error instanceof CommandRegistrationError
      && error.diagnostic.code === 'invalid-keybinding'
      && /缺少普通按键/.test(error.message)
  );
  assert.equal(service.getDiagnostics()[0]?.code, 'invalid-keybinding');
});
