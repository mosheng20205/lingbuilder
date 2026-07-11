import test from 'node:test';
import assert from 'node:assert/strict';

import {
  areShortcutOverridesEqual,
  decideShortcutDraftSynchronization,
  hasUnsavedShortcutChanges,
  validateShortcutOverrides
} from '../src/services/commands';

test('shortcut overrides normalize valid strokes and ignore empty inherited entries', () => {
  assert.deepEqual(validateShortcutOverrides({
    'workbench.save': ' control + s ',
    'workbench.run': 'F5',
    'workbench.inherit': ''
  }), {
    normalized: { 'workbench.save': 'Ctrl+S', 'workbench.run': 'F5' },
    errors: {}
  });
});

test('shortcut overrides report both conflict owners, malformed input, and unsupported chords', () => {
  const result = validateShortcutOverrides({
    'workbench.first': 'Ctrl+J',
    'workbench.second': 'control+j',
    'workbench.bad': 'Ctrl++',
    'workbench.chord': 'Ctrl+K Ctrl+S'
  });
  assert.match(result.errors['workbench.first'], /冲突/u);
  assert.match(result.errors['workbench.second'], /冲突/u);
  assert.ok(result.errors['workbench.bad']);
  assert.match(result.errors['workbench.chord'], /单段/u);
});

test('shortcut overrides reject input-stealing bare keys and conflicts with command defaults', () => {
  const bareKeys = validateShortcutOverrides({
    'workbench.letter': 'A',
    'workbench.focus': 'Tab',
    'workbench.function': 'F6'
  });
  assert.match(bareKeys.errors['workbench.letter'], /文字输入/u);
  assert.match(bareKeys.errors['workbench.focus'], /焦点导航/u);
  assert.equal(bareKeys.errors['workbench.function'], undefined);
  assert.equal(bareKeys.normalized['workbench.function'], 'F6');

  const defaults = [
    { id: 'workbench.save', keybindings: ['Ctrl+S'] },
    { id: 'workbench.run', keybindings: ['F5'] }
  ];
  const conflict = validateShortcutOverrides({ 'workbench.run': 'Ctrl+S' }, defaults);
  assert.match(conflict.errors['workbench.run'], /workbench\.save/u);
  assert.match(conflict.errors['workbench.save'], /workbench\.run/u);

  const safeSwap = validateShortcutOverrides({
    'workbench.save': 'F5',
    'workbench.run': 'Ctrl+S'
  }, defaults);
  assert.deepEqual(safeSwap.errors, {});
});

test('shortcut draft equality ignores object insertion order but detects unsaved edits', () => {
  assert.equal(areShortcutOverridesEqual(
    { save: 'Ctrl+S', run: 'F5' },
    { run: 'F5', save: 'Ctrl+S' }
  ), true);
  assert.equal(areShortcutOverridesEqual({ save: 'Ctrl+S' }, { save: 'Ctrl+Shift+S' }), false);
  assert.equal(areShortcutOverridesEqual({ save: 'Ctrl+S' }, {}), false);
  assert.equal(hasUnsavedShortcutChanges({ save: 'Ctrl+Shift+S' }, { save: 'Ctrl+S' }), true);
  assert.equal(hasUnsavedShortcutChanges({ save: 'Ctrl+S' }, { save: 'Ctrl+S' }), false);
});

test('shortcut draft synchronization never overwrites dirty drafts after unrelated or external updates', () => {
  assert.equal(decideShortcutDraftSynchronization('user:[]', 'user:[]', true), 'none');
  assert.equal(decideShortcutDraftSynchronization('user:[]', 'user:[["save","Ctrl+S"]]', true), 'preserve');
  assert.equal(decideShortcutDraftSynchronization('user:[]', 'user:[["save","Ctrl+S"]]', false), 'replace');
  assert.equal(decideShortcutDraftSynchronization('user:[]', 'workspace:[]', true), 'replace');
  assert.equal(decideShortcutDraftSynchronization('', 'user:[]', true), 'replace');
});
