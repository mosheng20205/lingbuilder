import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampCommandPaletteSelection,
  createCommandPaletteContext,
  isSuccessfulCommandResult,
  moveCommandPaletteSelection,
  scrollCommandPaletteOptionIntoView
} from '../src/services/commands';

test('command palette selection wraps and supports first/last navigation', () => {
  assert.equal(moveCommandPaletteSelection(-1, 3, 'next'), 0);
  assert.equal(moveCommandPaletteSelection(0, 3, 'previous'), 2);
  assert.equal(moveCommandPaletteSelection(2, 3, 'next'), 0);
  assert.equal(moveCommandPaletteSelection(1, 3, 'first'), 0);
  assert.equal(moveCommandPaletteSelection(1, 3, 'last'), 2);
});

test('command palette selection handles empty and shrinking result sets', () => {
  assert.equal(moveCommandPaletteSelection(2, 0, 'next'), -1);
  assert.equal(clampCommandPaletteSelection(5, 2), 1);
  assert.equal(clampCommandPaletteSelection(-1, 2), 0);
  assert.equal(clampCommandPaletteSelection(0, 0), -1);
});

test('command palette evaluates and executes commands as if only the palette itself were closed', () => {
  assert.deepEqual(createCommandPaletteContext({
    'workspace.open': true,
    'workbench.commandPaletteOpen': true,
    'workbench.settingsOpen': false,
    'workbench.blockingDialogOpen': false,
    'workbench.modalOpen': true
  }), {
    'workspace.open': true,
    'workbench.commandPaletteOpen': false,
    'workbench.settingsOpen': false,
    'workbench.blockingDialogOpen': false,
    'workbench.modalOpen': false
  });

  assert.equal(createCommandPaletteContext({
    'workbench.commandPaletteOpen': true,
    'workbench.blockingDialogOpen': true,
    'workbench.modalOpen': true
  })['workbench.modalOpen'], true);
});

test('command palette treats an explicit false handler result as failure or cancellation', () => {
  assert.equal(isSuccessfulCommandResult(false), false);
  assert.equal(isSuccessfulCommandResult(true), true);
  assert.equal(isSuccessfulCommandResult(undefined), true);
  assert.equal(isSuccessfulCommandResult({ ok: false }), true);
});

test('command palette scrolls the keyboard-selected option into the nearest visible area', () => {
  let selector = '';
  let block = '';
  const scrolled = scrollCommandPaletteOptionIntoView({
    querySelector(nextSelector: string) {
      selector = nextSelector;
      return {
        scrollIntoView(options?: ScrollIntoViewOptions) {
          block = options?.block || '';
        }
      };
    }
  }, 12);
  assert.equal(scrolled, true);
  assert.equal(selector, '[data-command-index="12"]');
  assert.equal(block, 'nearest');
  assert.equal(scrollCommandPaletteOptionIntoView(null, 0), false);
  assert.equal(scrollCommandPaletteOptionIntoView({ querySelector: () => null }, -1), false);
});
