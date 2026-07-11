import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import EditorPositionStatus from '../src/components/EditorPositionStatus';
import { WORKBENCH_DEFAULT_KEYBINDINGS } from '../src/services/commands';
import {
  createInactiveTextEditorStatus,
  formatEditorPositionStatus,
  getEditorHistoryPresentation,
  TextEditorStatus
} from '../src/services/textModel';

test('editor history presentation exposes per-surface Chinese disabled reasons', () => {
  const editable = status({ canUndo: true, canRedo: true, readOnly: false });
  assert.deepEqual(getEditorHistoryPresentation(editable, { undo: 'Ctrl+Z', redo: 'Ctrl+Y / Ctrl+Shift+Z' }), {
    undoDisabled: false,
    redoDisabled: false,
    undoTitle: '撤销当前文件的上一步编辑 (Ctrl+Z)',
    redoTitle: '重做当前文件刚撤销的编辑 (Ctrl+Y / Ctrl+Shift+Z)'
  });

  const beginner = getEditorHistoryPresentation(status({ surface: 'beginner', readOnly: false }));
  assert.equal(beginner.undoDisabled, true);
  assert.match(beginner.undoTitle, /新手结构输入框/u);

  const native = getEditorHistoryPresentation(status({ surface: 'native:main.cpp', readOnly: true }));
  assert.equal(native.redoDisabled, true);
  assert.match(native.redoTitle, /只读/u);
});

test('editor position status renders line, column, selection, and accessible label', () => {
  const state = status({ line: 12, column: 7, selectionLength: 9 });
  const presentation = formatEditorPositionStatus(state);
  const html = renderToStaticMarkup(<EditorPositionStatus state={state} />);

  assert.equal(presentation.text, '第 12 行，第 7 列 · 已选 9');
  assert.match(presentation.label, /已选择 9 个字符/u);
  assert.match(html, /data-editor-position-status="true"/u);
  assert.match(html, /aria-label="当前光标位于第 12 行、第 7 列，已选择 9 个字符"/u);
  assert.match(html, /第 12 行，第 7 列 · 已选 9/u);
});

test('inactive state and default history keybindings are deterministic on Windows and macOS', () => {
  assert.deepEqual(createInactiveTextEditorStatus(' switching '), {
    modelId: '',
    surface: 'switching',
    line: 1,
    column: 1,
    selectionLength: 0,
    canUndo: false,
    canRedo: false,
    readOnly: true,
    positionAvailable: false
  });
  assert.deepEqual(WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.editor.undo'], ['Ctrl+Z', 'Meta+Z']);
  assert.deepEqual(
    WORKBENCH_DEFAULT_KEYBINDINGS['workbench.action.editor.redo'],
    ['Ctrl+Y', 'Ctrl+Shift+Z', 'Meta+Shift+Z']
  );
});

function status(patch: Partial<TextEditorStatus>): TextEditorStatus {
  return {
    modelId: 'model-a',
    surface: 'professional',
    line: 1,
    column: 1,
    selectionLength: 0,
    canUndo: false,
    canRedo: false,
    readOnly: false,
    ...patch
  };
}
