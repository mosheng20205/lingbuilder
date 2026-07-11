import test from 'node:test';
import assert from 'node:assert/strict';

import { reconcileTextEditHistory, TextEditHistory } from '../src/services/textModel';

test('per-file text edit histories isolate undo/redo and clear redo after a new edit', () => {
  const a = new TextEditHistory('A0');
  const b = new TextEditHistory('B0');
  a.record('A1');
  b.record('B1');
  assert.equal(a.undo(), 'A0');
  assert.equal(b.current(), 'B1');
  assert.equal(a.redo(), 'A1');
  assert.equal(b.undo(), 'B0');
  b.record('B2');
  assert.equal(b.canRedo(), false);
});

test('history handles empty documents, authoritative reset, and bounded undo depth', () => {
  const history = new TextEditHistory('', 2);
  history.record('1');
  history.record('2');
  history.record('3');
  assert.equal(history.undo(), '2');
  assert.equal(history.undo(), '1');
  assert.equal(history.undo(), undefined);
  history.reset('disk');
  assert.deepEqual(history.snapshot(), {
    current: 'disk',
    canUndo: false,
    canRedo: false,
    undoDepth: 0,
    redoDepth: 0
  });
});

test('a new editor-surface edit can invalidate fallback redo without changing undo history', () => {
  const history = new TextEditHistory('初始');
  history.record('新手编辑');
  assert.equal(history.undo(), '初始');
  assert.equal(history.canRedo(), true);
  assert.equal(history.clearRedo(), true);
  assert.equal(history.canRedo(), false);
  assert.equal(history.current(), '初始');
  assert.equal(history.clearRedo(), false);
});

test('one canonical timeline preserves mixed beginner and professional undo/redo direction', () => {
  const history = new TextEditHistory('A');
  history.record('B');
  history.record('C');
  assert.equal(history.undo(), 'B');
  assert.equal(history.undo(), 'A');
  assert.equal(history.undo(), undefined);
  assert.equal(history.redo(), 'B');
  assert.equal(history.redo(), 'C');
  assert.equal(history.redo(), undefined);
});

test('grouped Monaco undo and redo synchronize to matching canonical snapshots', () => {
  const history = new TextEditHistory('A');
  history.record('A1');
  history.record('A2');
  history.record('B');
  assert.equal(history.undoTo('A'), true);
  assert.equal(history.current(), 'A');
  assert.equal(history.canRedo(), true);
  assert.equal(history.redoTo('B'), true);
  assert.equal(history.current(), 'B');
  assert.equal(history.canRedo(), false);
  assert.equal(history.undoTo('missing'), false);
  assert.equal(history.current(), 'B');
});

test('external LingCpp values join the canonical timeline while self echoes stay idempotent', () => {
  const history = new TextEditHistory('A');
  assert.equal(reconcileTextEditHistory(history, {
    contextKey: 'lingcpp',
    value: 'A',
    canonical: true
  }), true);
  history.record('B');

  assert.equal(reconcileTextEditHistory(history, {
    contextKey: 'lingcpp',
    value: 'B',
    canonical: true
  }), false);
  assert.equal(reconcileTextEditHistory(history, {
    contextKey: 'lingcpp',
    value: 'C',
    canonical: true
  }), true);
  assert.equal(history.undo(), 'B');
  assert.equal(history.undo(), 'A');
  assert.equal(history.redo(), 'B');
  assert.equal(history.redo(), 'C');
});

test('language-changing rename resets canonical history to the current source baseline', () => {
  const history = new TextEditHistory('A');
  reconcileTextEditHistory(history, {
    contextKey: 'cpp',
    value: 'A',
    canonical: false
  });

  // Native Monaco changed the C++ file while canonical history was inactive.
  assert.equal(reconcileTextEditHistory(history, {
    contextKey: 'cpp',
    value: 'B',
    canonical: false
  }), false);
  assert.equal(reconcileTextEditHistory(history, {
    contextKey: 'lingcpp',
    value: 'B',
    canonical: true
  }), true);
  assert.equal(history.current(), 'B');
  assert.equal(history.canUndo(), false);
  assert.equal(history.canRedo(), false);

  history.record('C');
  assert.equal(history.undo(), 'B');
});
