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
