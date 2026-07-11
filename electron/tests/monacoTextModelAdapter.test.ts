import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bindMonacoTextModel,
  captureMonacoViewState,
  disposeMonacoTextModel,
  MonacoEditorLike,
  MonacoTextModelAdapter,
  MonacoTextModelLike,
  restoreMonacoViewState
} from '../src/services/textModel';

class FakeModel implements MonacoTextModelLike {
  undoCalls = 0;
  redoCalls = 0;
  disposeCalls = 0;
  disposed = false;

  constructor(
    readonly name: string,
    private content: string,
    private undoAvailable = true,
    private redoAvailable = true
  ) {}

  getValue() { return this.content; }
  setValue(value: string) { this.content = value; }
  canUndo() { return this.undoAvailable; }
  canRedo() { return this.redoAvailable; }
  undo() { this.undoCalls += 1; this.undoAvailable = false; this.redoAvailable = true; }
  redo() { this.redoCalls += 1; this.redoAvailable = false; this.undoAvailable = true; }
  dispose() { this.disposeCalls += 1; this.disposed = true; }
  isDisposed() { return this.disposed; }
}

class FakeEditor implements MonacoEditorLike<FakeModel> {
  model: FakeModel | null = null;
  position = { lineNumber: 3, column: 2 };
  selection = {
    selectionStartLineNumber: 3,
    selectionStartColumn: 5,
    positionLineNumber: 1,
    positionColumn: 2
  };
  scrollTop = 120;
  scrollLeft = 16;
  opaqueState: unknown = {
    cursorState: [{ selectionStartLineNumber: 3 }],
    viewState: { scrollTop: 120 }
  };
  restoredOpaque: unknown;
  setModelCalls: Array<string | null> = [];
  triggerCalls: string[] = [];
  disposeCalls = 0;

  getModel() { return this.model; }
  setModel(model: FakeModel | null) {
    this.model = model;
    this.setModelCalls.push(model?.name || null);
  }
  getPosition() { return this.position; }
  setPosition(position: { lineNumber: number; column: number }) { this.position = position; }
  getSelection() { return this.selection; }
  setSelection(selection: typeof this.selection) {
    this.selection = selection;
    this.position = {
      lineNumber: selection.positionLineNumber,
      column: selection.positionColumn
    };
  }
  getScrollTop() { return this.scrollTop; }
  getScrollLeft() { return this.scrollLeft; }
  setScrollPosition(position: { scrollTop?: number; scrollLeft?: number }) {
    if (position.scrollTop !== undefined) this.scrollTop = position.scrollTop;
    if (position.scrollLeft !== undefined) this.scrollLeft = position.scrollLeft;
  }
  saveViewState() { return this.opaqueState; }
  restoreViewState(state: unknown) { this.restoredOpaque = state; }
  trigger(_source: string, actionId: string) { this.triggerCalls.push(actionId); }
  dispose() { this.disposeCalls += 1; }
}

test('bind and history actions always target the currently bound model', async () => {
  const editor = new FakeEditor();
  const a = new FakeModel('A', 'A');
  const b = new FakeModel('B', 'B');
  const adapter = new MonacoTextModelAdapter<FakeModel>();

  adapter.bind(editor, a);
  assert.equal(adapter.getCurrentModel(), a);
  assert.equal(adapter.canUndo(), true);
  await adapter.undo();
  assert.equal(a.undoCalls, 1);
  assert.equal(b.undoCalls, 0);

  adapter.bind(editor, b);
  assert.equal(adapter.getCurrentModel(), b);
  await adapter.undo();
  await adapter.redo();
  assert.equal(a.undoCalls, 1);
  assert.equal(a.redoCalls, 0);
  assert.equal(b.undoCalls, 1);
  assert.equal(b.redoCalls, 1);
  assert.deepEqual(editor.setModelCalls, ['A', 'B']);

  editor.setModel(null);
  assert.equal(adapter.getCurrentModel(), undefined);
  assert.equal(adapter.canUndo(), false);
  assert.equal(await adapter.undo(), false);
  assert.equal(b.undoCalls, 1);
});

test('capture and restore preserve reverse selection, scroll, and serializable opaque state', () => {
  const editor = new FakeEditor();
  const model = new FakeModel('source', '第一行\nabc\n第三行');
  const binding = bindMonacoTextModel(editor, model);
  const captured = binding.captureViewState()!;

  assert.deepEqual(captured.cursor, { line: 3, column: 2 });
  assert.deepEqual(captured.selection, {
    anchor: { line: 3, column: 4 },
    active: { line: 1, column: 2 }
  });
  assert.equal(captured.scrollTop, 120);
  assert.equal(captured.scrollLeft, 16);
  assert.deepEqual(captured.opaque, editor.opaqueState);

  const restored = binding.restoreViewState({
    cursor: { line: 99, column: 99 },
    selection: {
      anchor: { line: 3, column: 99 },
      active: { line: 2, column: 3 }
    },
    scrollTop: 450,
    scrollLeft: 35,
    opaque: { custom: { folded: [1, 2] } }
  });
  assert.equal(restored, true);
  assert.deepEqual(editor.selection, {
    selectionStartLineNumber: 3,
    selectionStartColumn: 4,
    positionLineNumber: 2,
    positionColumn: 3,
    startLineNumber: 2,
    startColumn: 3,
    endLineNumber: 3,
    endColumn: 4
  });
  assert.deepEqual(editor.position, { lineNumber: 2, column: 3 });
  assert.equal(editor.scrollTop, 450);
  assert.equal(editor.scrollLeft, 35);
  assert.deepEqual(editor.restoredOpaque, { custom: { folded: [1, 2] } });
});

test('authoritative value replacement restores cursor, reverse selection, and scroll after flush', () => {
  const editor = new FakeEditor();
  const model = new FakeModel('source', '第一行\nabc\n第三行');
  const originalSetValue = model.setValue.bind(model);
  model.setValue = value => {
    originalSetValue(value);
    editor.position = { lineNumber: 1, column: 1 };
    editor.selection = {
      selectionStartLineNumber: 1,
      selectionStartColumn: 1,
      positionLineNumber: 1,
      positionColumn: 1
    };
    editor.scrollTop = 0;
    editor.scrollLeft = 0;
  };
  const adapter = bindMonacoTextModel(editor, model);

  assert.equal(adapter.replaceValuePreservingView('新第一行\nxyz\n新第三行'), true);
  assert.deepEqual(editor.selection, {
    selectionStartLineNumber: 3,
    selectionStartColumn: 4,
    positionLineNumber: 1,
    positionColumn: 2,
    startLineNumber: 1,
    startColumn: 2,
    endLineNumber: 3,
    endColumn: 4
  });
  assert.deepEqual(editor.position, { lineNumber: 1, column: 2 });
  assert.equal(editor.scrollTop, 120);
  assert.equal(editor.scrollLeft, 16);
});

test('standalone capture/restore helpers use duck typing and omit cyclic opaque state', () => {
  const editor = new FakeEditor();
  const model = new FakeModel('helper', 'x');
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  editor.opaqueState = cyclic;
  editor.position = { lineNumber: 8, column: 8 };
  editor.selection = {
    selectionStartLineNumber: 8,
    selectionStartColumn: 8,
    positionLineNumber: 8,
    positionColumn: 8
  };

  const captured = captureMonacoViewState(editor, model)!;
  assert.equal(captured.opaque, undefined);
  assert.deepEqual(captured.cursor, { line: 1, column: 2 });
  assert.equal(restoreMonacoViewState(editor, model, captured), true);
});

test('dispose releases only the current model, detaches it, and optionally disposes editor', () => {
  const editor = new FakeEditor();
  const a = new FakeModel('A', 'A');
  const b = new FakeModel('B', 'B');
  const adapter = new MonacoTextModelAdapter<FakeModel>();
  adapter.bind(editor, a);
  adapter.bind(editor, b);

  adapter.dispose({ disposeModel: true, disposeEditor: true });
  assert.equal(a.disposeCalls, 0);
  assert.equal(b.disposeCalls, 1);
  assert.equal(editor.model, null);
  assert.equal(editor.disposeCalls, 1);
  assert.equal(adapter.getCurrentModel(), undefined);
  assert.equal(disposeMonacoTextModel(b), false);
  assert.equal(disposeMonacoTextModel(a), true);
  assert.equal(a.disposeCalls, 1);
});

test('dispose releases the owned binding without disposing a model attached externally', () => {
  const editor = new FakeEditor();
  const owned = new FakeModel('owned', 'owned');
  const external = new FakeModel('external', 'external');
  const adapter = new MonacoTextModelAdapter<FakeModel>().bind(editor, owned);
  editor.setModel(external);

  adapter.dispose();
  assert.equal(owned.disposeCalls, 1);
  assert.equal(external.disposeCalls, 0);
  assert.equal(editor.model, external);
});

test('adapter refuses disposed models and reports unavailable history without side effects', async () => {
  const editor = new FakeEditor();
  const model = new FakeModel('empty-history', 'x', false, false);
  const adapter = new MonacoTextModelAdapter<FakeModel>().bind(editor, model);
  assert.equal(adapter.canUndo(), false);
  assert.equal(adapter.canRedo(), false);
  assert.equal(await adapter.undo(), false);
  assert.equal(await adapter.redo(), false);
  assert.equal(model.undoCalls, 0);
  assert.equal(model.redoCalls, 0);

  model.dispose();
  assert.throws(
    () => new MonacoTextModelAdapter<FakeModel>().bind(editor, model),
    /已释放/u
  );
});

test('adapter refuses to capture or undo a model attached externally until it is explicitly rebound', async () => {
  const editor = new FakeEditor();
  const a = new FakeModel('A', 'A');
  const b = new FakeModel('B', 'B');
  const adapter = new MonacoTextModelAdapter<FakeModel>().bind(editor, a);
  editor.setModel(b);

  assert.equal(adapter.getCurrentModel(), undefined);
  assert.equal(adapter.captureViewState(), undefined);
  assert.equal(await adapter.undo(), false);
  assert.equal(a.undoCalls, 0);
  assert.equal(b.undoCalls, 0);

  adapter.bind(editor, b);
  assert.equal(await adapter.undo(), true);
  assert.equal(b.undoCalls, 1);
});
