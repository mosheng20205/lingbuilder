import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMonacoValueBinding,
  synchronizeMonacoModelValue
} from '../src/services/textModel/monacoModelSync';
import { TextEditHistory } from '../src/services/textModel/textEditHistory';

test('LingCpp mode rebind clears stale Monaco undo while preserving canonical redo', () => {
  assert.deepEqual(createMonacoValueBinding('lingcpp', 'A'), {
    defaultValue: 'A',
    value: undefined
  });
  const canonical = new TextEditHistory('A');
  canonical.record('B');
  assert.equal(canonical.undo(), 'A');
  assert.equal(canonical.canUndo(), false);
  assert.equal(canonical.canRedo(), true);

  let modelValue = 'B';
  const nativeUndo = ['A'];
  let executeEditsCalls = 0;
  const result = synchronizeMonacoModelValue({
    getValue: () => modelValue,
    setValue: value => {
      modelValue = value;
      nativeUndo.length = 0;
    },
    getFullModelRange: () => ({ start: 0, end: modelValue.length })
  }, {
    executeEdits: () => {
      executeEditsCalls += 1;
    }
  }, canonical.current(), {
    authoritative: true,
    readOnly: false,
    resetNativeHistory: true
  });

  assert.equal(result, 'authoritative');
  assert.equal(modelValue, 'A');
  assert.deepEqual(nativeUndo, []);
  assert.equal(executeEditsCalls, 0);
  assert.equal(canonical.canUndo(), false);
  assert.equal(canonical.redo(), 'B');
});

test('non-canonical Monaco files keep external synchronization undoable', () => {
  assert.deepEqual(createMonacoValueBinding('cpp', 'after'), {
    defaultValue: undefined,
    value: 'after'
  });
  let modelValue = 'before';
  let stackBoundaries = 0;
  let editSource = '';
  const result = synchronizeMonacoModelValue({
    getValue: () => modelValue,
    setValue: value => {
      modelValue = value;
    },
    getFullModelRange: () => ({ start: 0, end: modelValue.length }),
    pushStackElement: () => {
      stackBoundaries += 1;
    }
  }, {
    executeEdits: (source, edits) => {
      editSource = source;
      modelValue = edits[0].text;
    }
  }, 'after', {
    authoritative: false,
    readOnly: false
  });

  assert.equal(result, 'undoable');
  assert.equal(modelValue, 'after');
  assert.equal(editSource, 'lingbuilder.externalEdit');
  assert.equal(stackBoundaries, 2);
});

test('entering canonical LingCpp clears stale native undo even when text already matches', () => {
  let setValueCalls = 0;
  const nativeUndo = ['rename-before'];
  const result = synchronizeMonacoModelValue({
    getValue: () => 'renamed content',
    setValue: () => {
      setValueCalls += 1;
      nativeUndo.length = 0;
    }
  }, {}, 'renamed content', {
    authoritative: true,
    readOnly: false,
    resetNativeHistory: true
  });

  assert.equal(result, 'authoritative');
  assert.equal(setValueCalls, 1);
  assert.deepEqual(nativeUndo, []);
});

test('canonical LingCpp sync preserves caret across authoritative replacement', () => {
  let value = 'old value';
  const setPositions: Array<{ lineNumber: number; column: number }> = [];
  const setSelections: Array<{ selectionStartLineNumber: number; selectionStartColumn: number; positionLineNumber: number; positionColumn: number }> = [];
  const result = synchronizeMonacoModelValue({
    getValue: () => value,
    setValue: next => {
      value = next;
    },
    getOffsetAt: () => 5,
    getPositionAt: offset => ({ lineNumber: 2, column: offset + 1 })
  }, {
    getSelection: () => ({
      selectionStartLineNumber: 2,
      selectionStartColumn: 6,
      positionLineNumber: 2,
      positionColumn: 6
    }),
    setPosition: position => setPositions.push(position),
    setSelection: selection => setSelections.push(selection)
  }, 'brand new content', {
    authoritative: true,
    readOnly: false
  });

  assert.equal(result, 'authoritative');
  assert.equal(value, 'brand new content');
  assert.deepEqual(setPositions, [{ lineNumber: 2, column: 6 }]);
  assert.deepEqual(setSelections, []);
});

test('canonical LingCpp sync restores a collapsed multi-offset selection', () => {
  let value = 'old value';
  const setSelections: Array<{ selectionStartLineNumber: number; selectionStartColumn: number; positionLineNumber: number; positionColumn: number }> = [];
  synchronizeMonacoModelValue({
    getValue: () => value,
    setValue: next => {
      value = next;
    },
    getOffsetAt: position => position.column - 1,
    getPositionAt: offset => ({ lineNumber: 1, column: offset + 1 })
  }, {
    getSelection: () => ({
      selectionStartLineNumber: 1,
      selectionStartColumn: 1,
      positionLineNumber: 1,
      positionColumn: 9
    }),
    setSelection: selection => setSelections.push(selection)
  }, 'brand new content', {
    authoritative: true,
    readOnly: false
  });

  assert.equal(value, 'brand new content');
  assert.deepEqual(setSelections, [{
    selectionStartLineNumber: 1,
    selectionStartColumn: 1,
    positionLineNumber: 1,
    positionColumn: 9
  }]);
});
