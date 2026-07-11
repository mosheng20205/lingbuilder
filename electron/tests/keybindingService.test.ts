import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCommandService,
  createKeybindingService,
  keyboardEventToKeybinding,
  type KeyboardEventLike
} from '../src/services/commands';

test('keyboard events normalize exact Windows, macOS, punctuation, and function-key strokes', () => {
  assert.equal(keyboardEventToKeybinding(eventOf('p', { ctrlKey: true, shiftKey: true })), 'Ctrl+Shift+P');
  assert.equal(keyboardEventToKeybinding(eventOf('P', { metaKey: true, shiftKey: true })), 'Meta+Shift+P');
  assert.equal(keyboardEventToKeybinding(eventOf(',', { ctrlKey: true })), 'Ctrl+,');
  assert.equal(keyboardEventToKeybinding(eventOf('F5', { shiftKey: true })), 'Shift+F5');
});

test('IME composition, keyCode 229, repeats, handled events, and modifier-only strokes are ignored', () => {
  assert.equal(keyboardEventToKeybinding(eventOf('Process', { isComposing: true })), null);
  assert.equal(keyboardEventToKeybinding(eventOf('a', { keyCode: 229 })), null);
  assert.equal(keyboardEventToKeybinding(eventOf('F5', { repeat: true })), null);
  assert.equal(keyboardEventToKeybinding(eventOf('F1', { defaultPrevented: true })), null);
  assert.equal(keyboardEventToKeybinding(eventOf('Control', { ctrlKey: true })), null);
});

test('keybinding service executes the enabled contextual command and owns the browser event', async () => {
  const commands = createCommandService();
  const calls: string[] = [];
  commands.registerCommand({
    id: 'workbench.save',
    title: '保存',
    keybindings: ['Ctrl+S'],
    when: 'workspace.open && !modal.open',
    handler: () => { calls.push('save'); }
  });
  let context = { 'workspace.open': true, 'modal.open': false };
  const service = createKeybindingService(commands, () => context);
  const event = eventOf('s', { ctrlKey: true });

  const handled = await service.dispatch(event);
  assert.equal(handled.handled, true);
  assert.equal(handled.commandId, 'workbench.save');
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.deepEqual(calls, ['save']);

  context = { 'workspace.open': true, 'modal.open': true };
  const unavailableEvent = eventOf('s', { ctrlKey: true });
  assert.equal((await service.dispatch(unavailableEvent)).handled, false);
  assert.equal(unavailableEvent.prevented, false);
});

test('keybinding execution errors are returned after preventing the matching browser shortcut', async () => {
  const commands = createCommandService();
  commands.registerCommand({
    id: 'workbench.fail',
    title: '失败命令',
    keybindings: ['F8'],
    handler: () => { throw new Error('模拟失败'); }
  });
  const event = eventOf('F8');
  const result = await createKeybindingService(commands, () => ({})).dispatch(event);

  assert.equal(result.handled, true);
  assert.equal(result.error?.code, 'command-execution-failed');
  assert.match(result.error?.message || '', /模拟失败/u);
  assert.equal(event.prevented, true);
});

test('editor undo leaves ordinary inputs alone but owns events inside an editor surface', async () => {
  const commands = createCommandService();
  let undoCalls = 0;
  commands.registerCommand({
    id: 'workbench.action.editor.undo',
    title: '编辑器：撤销',
    keybindings: ['Ctrl+Z'],
    handler: () => { undoCalls += 1; }
  });
  const service = createKeybindingService(commands, () => ({}));
  const ordinaryInput = eventOf('z', {
    ctrlKey: true,
    target: { tagName: 'INPUT', closest: () => null }
  });
  assert.equal((await service.dispatch(ordinaryInput)).handled, false);
  assert.equal(ordinaryInput.prevented, false);
  assert.equal(undoCalls, 0);

  const editorInput = eventOf('z', {
    ctrlKey: true,
    target: { tagName: 'TEXTAREA', closest: () => ({ dataset: { lingbuilderEditorCommandOwner: 'true' } }) }
  });
  assert.equal((await service.dispatch(editorInput)).handled, true);
  assert.equal(editorInput.prevented, true);
  assert.equal(undoCalls, 1);
});

function eventOf(
  key: string,
  overrides: Partial<KeyboardEventLike> = {}
): KeyboardEventLike & { prevented: boolean; stopped: boolean } {
  const event = {
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    keyCode: 0,
    defaultPrevented: false,
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    ...overrides
  };
  return event;
}
