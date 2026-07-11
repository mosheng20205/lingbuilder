import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampTextEditorViewState,
  createTextModelUri,
  TextEditorViewState,
  TextModelIdentity,
  TextModelService
} from '../src/services/textModel';

interface FakeModel {
  name: string;
  disposed: boolean;
}

interface FakeHistory {
  entries: string[];
  disposed: boolean;
}

const workspaceA = 'C:\\Users\\Administrator\\中文工作区';

test('stable model URI hides Windows paths and slash-equivalent file identities share a record', () => {
  const windowsIdentity = identity('src\\窗口\\Main.lcpp');
  const slashIdentity = identity('src/窗口/Main.lcpp');
  const uri = createTextModelUri(windowsIdentity);
  const service = new TextModelService();
  const first = service.ensure(windowsIdentity);
  const second = service.ensure(slashIdentity);

  assert.match(uri, /^lingbuilder:\/\/model\/[a-z0-9]+\/[a-z0-9]+\/[a-z0-9]+$/u);
  assert.equal(first.modelId, second.modelId);
  assert.equal(first.uri, second.uri);
  assert.equal(first.uri, uri);
  assert.doesNotMatch(uri, /Users|Administrator|Main|%3A|%5C|窗口/iu);
});

test('A and B keep independent model/history attachments and rename preserves A association', () => {
  const disposedModels: string[] = [];
  const disposedHistories: string[][] = [];
  const service = new TextModelService<FakeModel, FakeHistory>({
    disposeModel: model => {
      model.disposed = true;
      disposedModels.push(model.name);
    },
    disposeHistory: history => {
      history.disposed = true;
      disposedHistories.push([...history.entries]);
    }
  });
  const aIdentity = identity('src/a.lcpp');
  const bIdentity = identity('src/b.lcpp');
  const aModel = { name: 'A', disposed: false };
  const bModel = { name: 'B', disposed: false };
  const aHistory = { entries: ['A0', 'A1'], disposed: false };
  const bHistory = { entries: ['B0'], disposed: false };
  const a = service.ensure(aIdentity, { model: aModel, history: aHistory });
  const b = service.ensure(bIdentity, { model: bModel, history: bHistory });

  const renamed = service.rename(aIdentity, identity('src/renamed-a.lcpp'));
  assert.equal(service.get(aIdentity), undefined);
  assert.equal(renamed.modelId, a.modelId);
  assert.equal(renamed.uri, a.uri);
  assert.equal(renamed.generation, a.generation);
  assert.equal(renamed.model, aModel);
  assert.equal(renamed.history, aHistory);
  assert.deepEqual(renamed.history?.entries, ['A0', 'A1']);
  assert.equal(service.get(bIdentity)?.modelId, b.modelId);
  assert.equal(service.get(bIdentity)?.history, bHistory);
  assert.deepEqual(disposedModels, []);
  assert.deepEqual(disposedHistories, []);

  const recreatedAtOldPath = service.ensure(aIdentity, {
    model: { name: 'new-A', disposed: false },
    history: { entries: ['new-A0'], disposed: false }
  });
  assert.notEqual(recreatedAtOldPath.modelId, renamed.modelId);
  assert.notEqual(recreatedAtOldPath.uri, renamed.uri);
  assert.equal(service.get(identity('src/renamed-a.lcpp'))?.model, aModel);
  assert.equal(service.get(aIdentity)?.model?.name, 'new-A');
});

test('delete and workspace teardown dispose only records in scope', () => {
  const disposedModels: string[] = [];
  const disposedHistories: string[] = [];
  const service = new TextModelService<FakeModel, FakeHistory>({
    disposeModel: model => {
      model.disposed = true;
      disposedModels.push(model.name);
    },
    disposeHistory: history => {
      history.disposed = true;
      disposedHistories.push(history.entries[0]);
    }
  });
  const a = identity('src/a.lcpp');
  const b = identity('src/b.lcpp');
  const otherWorkspace = { ...identity('src/c.lcpp'), workspaceId: 'workspace-b' };
  service.ensure(a, { model: fakeModel('A'), history: fakeHistory('HA') });
  service.ensure(b, { model: fakeModel('B'), history: fakeHistory('HB') });
  service.ensure(otherWorkspace, { model: fakeModel('C'), history: fakeHistory('HC') });

  assert.equal(service.dispose(a), true);
  assert.equal(service.dispose(a), false);
  assert.deepEqual(disposedModels, ['A']);
  assert.deepEqual(disposedHistories, ['HA']);

  assert.equal(service.disposeWorkspace(workspaceA), 1);
  assert.equal(service.get(b), undefined);
  assert.ok(service.get(otherWorkspace));
  assert.deepEqual(disposedModels, ['A', 'B']);
  assert.deepEqual(disposedHistories, ['HA', 'HB']);

  assert.equal(service.disposeAll(), 1);
  assert.equal(service.list().length, 0);
  assert.deepEqual(disposedModels, ['A', 'B', 'C']);
});

test('generation guards reject callbacks from disposed or superseded generations', () => {
  const service = new TextModelService<FakeModel, FakeHistory>();
  const file = identity('src/async.lcpp');
  service.ensure(file, { model: fakeModel('first'), history: fakeHistory('first-history') });
  const staleAfterRefresh = service.generation(file);
  const fresh = service.nextGeneration(file);

  assert.equal(service.isCurrent(staleAfterRefresh), false);
  assert.equal(service.isCurrent(fresh), true);
  assert.equal(service.attachModelIfCurrent(staleAfterRefresh, fakeModel('stale-model')), false);
  assert.equal(service.attachHistoryIfCurrent(staleAfterRefresh, fakeHistory('stale-history')), false);
  assert.equal(service.get(file)?.model?.name, 'first');

  const staleAfterDispose = service.generation(file);
  service.dispose(file);
  const replacement = service.ensure(file, { model: fakeModel('replacement') });
  let callbackRan = false;
  assert.equal(service.runIfCurrent(staleAfterDispose, () => { callbackRan = true; }), false);
  assert.equal(service.saveViewStateIfCurrent(staleAfterDispose, 'professional', viewState(9)), false);
  assert.equal(callbackRan, false);
  assert.notEqual(replacement.generation, staleAfterDispose.generation);
  assert.notEqual(replacement.modelId, staleAfterDispose.modelId);
  assert.notEqual(replacement.uri, createTextModelUri(file));
  assert.equal(service.getViewState(file, 'professional'), undefined);
  assert.equal(service.get(file)?.model?.name, 'replacement');
});

test('view states are isolated by model and surface, retain reverse selection, and survive rename', () => {
  const service = new TextModelService();
  const a = identity('src/a.lcpp');
  const b = identity('src/b.lcpp');
  service.ensure(a);
  service.ensure(b);

  const professional = viewState(7, {
    cursor: { line: 7, column: 3 },
    selection: {
      anchor: { line: 7, column: 10 },
      active: { line: 3, column: 2 }
    },
    scrollTop: 240,
    scrollLeft: 18,
    opaque: { cursorState: [{ lineNumber: 7 }], viewState: { scrollTop: 240 } }
  });
  const beginner = viewState(2, { scrollTop: 40 });
  const native = viewState(5, { scrollLeft: 90 });
  service.saveViewState(a, 'professional', professional);
  service.saveViewState(a, 'beginner', beginner);
  service.saveViewState(a, 'native:generated/main.cpp', native);
  service.saveViewState(b, 'professional', viewState(20));

  // Saving and reading both clone values, so UI mutation cannot corrupt storage.
  professional.cursor.line = 99;
  const restored = service.getViewState(a, 'professional')!;
  assert.deepEqual(restored.cursor, { line: 7, column: 3 });
  assert.deepEqual(restored.selection, {
    anchor: { line: 7, column: 10 },
    active: { line: 3, column: 2 }
  });
  restored.selection.anchor.line = 100;
  assert.equal(service.getViewState(a, 'professional')?.selection.anchor.line, 7);
  assert.equal(service.getViewState(a, 'beginner')?.cursor.line, 2);
  assert.equal(service.getViewState(a, 'native:generated/main.cpp')?.cursor.line, 5);
  assert.equal(service.getViewState(b, 'professional')?.cursor.line, 20);

  const renamed = identity('src/a-renamed.lcpp');
  service.rename(a, renamed);
  assert.equal(service.getViewState(a, 'professional'), undefined);
  assert.equal(service.getViewState(renamed, 'professional')?.cursor.line, 7);
  assert.equal(service.getViewState(renamed, 'beginner')?.scrollTop, 40);
});

test('clamp helper keeps selection direction while constraining positions after content shrinks', () => {
  const state = viewState(40, {
    cursor: { line: 40, column: 80 },
    selection: {
      anchor: { line: 30, column: 60 },
      active: { line: 1, column: 99 }
    },
    scrollTop: -12,
    scrollLeft: Number.NaN
  });
  const clamped = clampTextEditorViewState(state, '中文\nabc');

  assert.deepEqual(clamped.cursor, { line: 2, column: 4 });
  assert.deepEqual(clamped.selection, {
    anchor: { line: 2, column: 4 },
    active: { line: 1, column: 3 }
  });
  assert.equal(clamped.scrollTop, 0);
  assert.equal(clamped.scrollLeft, 0);
});

function identity(filePath: string): TextModelIdentity {
  return { workspaceId: workspaceA, projectId: 'lingbuilder-ui-project', filePath };
}

function fakeModel(name: string): FakeModel {
  return { name, disposed: false };
}

function fakeHistory(entry: string): FakeHistory {
  return { entries: [entry], disposed: false };
}

function viewState(line: number, patch: Partial<TextEditorViewState> = {}): TextEditorViewState {
  return {
    cursor: { line, column: 1 },
    selection: {
      anchor: { line, column: 1 },
      active: { line, column: 1 }
    },
    scrollTop: 0,
    scrollLeft: 0,
    ...patch
  };
}
