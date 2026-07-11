import {
  clampTextEditorViewState,
  cloneTextEditorViewState,
  TextEditorViewState,
  TextPosition,
  TextSelection,
  toSerializableValue
} from './types';

export interface MonacoPositionLike {
  lineNumber: number;
  column: number;
}

export interface MonacoSelectionLike {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
  startLineNumber?: number;
  startColumn?: number;
  endLineNumber?: number;
  endColumn?: number;
}

export interface MonacoTextModelLike {
  getValue?(): string;
  setValue?(value: string): void;
  canUndo?(): boolean;
  canRedo?(): boolean;
  undo?(): void | Promise<void>;
  redo?(): void | Promise<void>;
  dispose?(): void;
  isDisposed?(): boolean;
}

export interface MonacoEditorLike<TModel extends MonacoTextModelLike = MonacoTextModelLike> {
  getModel?(): TModel | null;
  setModel?(model: TModel | null): void;
  getPosition?(): MonacoPositionLike | null;
  setPosition?(position: MonacoPositionLike): void;
  getSelection?(): MonacoSelectionLike | null;
  setSelection?(selection: MonacoSelectionLike): void;
  getScrollTop?(): number;
  getScrollLeft?(): number;
  setScrollPosition?(position: { scrollTop?: number; scrollLeft?: number }): void;
  saveViewState?(): unknown;
  restoreViewState?(state: unknown): void;
  trigger?(source: string, actionId: string, payload?: unknown): void | Promise<void>;
  dispose?(): void;
}

export interface MonacoAdapterDisposeOptions {
  disposeModel?: boolean;
  disposeEditor?: boolean;
}

/**
 * Thin duck-typed bridge around a currently bound Monaco editor/model pair.
 * No browser globals or Monaco package types are required by this module.
 */
export class MonacoTextModelAdapter<TModel extends MonacoTextModelLike = MonacoTextModelLike> {
  private editor?: MonacoEditorLike<TModel>;
  private boundModel?: TModel;

  bind(editor: MonacoEditorLike<TModel>, model: TModel): this {
    if (model.isDisposed?.()) throw new Error('不能绑定已释放的 Monaco 文本模型。');
    if (editor.getModel?.() !== model) editor.setModel?.(model);
    this.editor = editor;
    this.boundModel = model;
    return this;
  }

  getCurrentModel(): TModel | undefined {
    if (this.editor?.getModel) {
      const editorModel = this.editor.getModel() || undefined;
      return editorModel === this.boundModel && !editorModel?.isDisposed?.()
        ? editorModel
        : undefined;
    }
    return this.boundModel?.isDisposed?.() ? undefined : this.boundModel;
  }

  captureViewState(): TextEditorViewState | undefined {
    const editor = this.editor;
    const model = this.getCurrentModel();
    if (!editor || !model) return undefined;
    const position = toTextPosition(editor.getPosition?.()) || { line: 1, column: 1 };
    const selection = toTextSelection(editor.getSelection?.()) || { anchor: position, active: position };
    const opaque = toSerializableValue(editor.saveViewState?.());
    const state: TextEditorViewState = {
      cursor: position,
      selection,
      scrollTop: finiteNonNegative(editor.getScrollTop?.()),
      scrollLeft: finiteNonNegative(editor.getScrollLeft?.()),
      ...(opaque === undefined ? {} : { opaque })
    };
    const content = model.getValue?.();
    return content === undefined ? state : clampTextEditorViewState(state, content);
  }

  restoreViewState(state: TextEditorViewState): boolean {
    const editor = this.editor;
    const model = this.getCurrentModel();
    if (!editor || !model) return false;
    const content = model.getValue?.();
    const next = content === undefined
      ? cloneTextEditorViewState(state)
      : clampTextEditorViewState(state, content);
    if (next.opaque !== undefined) editor.restoreViewState?.(next.opaque);

    if (editor.setSelection) {
      const anchorBeforeActive = next.selection.anchor.line < next.selection.active.line
        || (next.selection.anchor.line === next.selection.active.line
          && next.selection.anchor.column <= next.selection.active.column);
      const start = anchorBeforeActive ? next.selection.anchor : next.selection.active;
      const end = anchorBeforeActive ? next.selection.active : next.selection.anchor;
      editor.setSelection({
        selectionStartLineNumber: next.selection.anchor.line,
        selectionStartColumn: next.selection.anchor.column,
        positionLineNumber: next.selection.active.line,
        positionColumn: next.selection.active.column,
        startLineNumber: start.line,
        startColumn: start.column,
        endLineNumber: end.line,
        endColumn: end.column
      });
    } else {
      editor.setPosition?.({ lineNumber: next.cursor.line, column: next.cursor.column });
    }
    editor.setScrollPosition?.({ scrollTop: next.scrollTop, scrollLeft: next.scrollLeft });
    return true;
  }

  canUndo(): boolean {
    const model = this.getCurrentModel();
    return Boolean(model && !model.isDisposed?.() && model.canUndo?.());
  }

  canRedo(): boolean {
    const model = this.getCurrentModel();
    return Boolean(model && !model.isDisposed?.() && model.canRedo?.());
  }

  replaceValuePreservingView(value: string): boolean {
    const model = this.getCurrentModel();
    if (!model || model.isDisposed?.() || !model.setValue) return false;
    const previousViewState = this.captureViewState();
    if (model.getValue?.() !== value) model.setValue(value);
    if (previousViewState) this.restoreViewState(previousViewState);
    return true;
  }

  async undo(): Promise<boolean> {
    const model = this.getCurrentModel();
    if (!model || model.isDisposed?.() || !model.canUndo?.()) return false;
    if (model.undo) {
      await model.undo();
    } else {
      await this.editor?.trigger?.('lingbuilder.textModel', 'undo');
    }
    return true;
  }

  async redo(): Promise<boolean> {
    const model = this.getCurrentModel();
    if (!model || model.isDisposed?.() || !model.canRedo?.()) return false;
    if (model.redo) {
      await model.redo();
    } else {
      await this.editor?.trigger?.('lingbuilder.textModel', 'redo');
    }
    return true;
  }

  dispose(options: MonacoAdapterDisposeOptions = {}): void {
    const editor = this.editor;
    // Dispose the model this adapter owns, never an unrelated model that a
    // host may have attached to the editor after this binding was created.
    const model = this.boundModel;
    const disposeModel = options.disposeModel ?? true;
    if (editor?.getModel?.() === model) editor.setModel?.(null);
    if (disposeModel && model && !model.isDisposed?.()) model.dispose?.();
    if (options.disposeEditor) editor?.dispose?.();
    this.editor = undefined;
    this.boundModel = undefined;
  }
}

export function bindMonacoTextModel<TModel extends MonacoTextModelLike>(
  editor: MonacoEditorLike<TModel>,
  model: TModel
): MonacoTextModelAdapter<TModel> {
  return new MonacoTextModelAdapter<TModel>().bind(editor, model);
}

export function captureMonacoViewState<TModel extends MonacoTextModelLike>(
  editor: MonacoEditorLike<TModel>,
  model: TModel
): TextEditorViewState | undefined {
  return bindMonacoTextModel(editor, model).captureViewState();
}

export function restoreMonacoViewState<TModel extends MonacoTextModelLike>(
  editor: MonacoEditorLike<TModel>,
  model: TModel,
  state: TextEditorViewState
): boolean {
  return bindMonacoTextModel(editor, model).restoreViewState(state);
}

export function canUndoMonacoTextModel(model: MonacoTextModelLike | null | undefined): boolean {
  return Boolean(model && !model.isDisposed?.() && model.canUndo?.());
}

export function canRedoMonacoTextModel(model: MonacoTextModelLike | null | undefined): boolean {
  return Boolean(model && !model.isDisposed?.() && model.canRedo?.());
}

export async function undoMonacoTextModel(model: MonacoTextModelLike | null | undefined): Promise<boolean> {
  if (!canUndoMonacoTextModel(model) || !model?.undo) return false;
  await model.undo();
  return true;
}

export async function redoMonacoTextModel(model: MonacoTextModelLike | null | undefined): Promise<boolean> {
  if (!canRedoMonacoTextModel(model) || !model?.redo) return false;
  await model.redo();
  return true;
}

export function disposeMonacoTextModel(model: MonacoTextModelLike | null | undefined): boolean {
  if (!model || model.isDisposed?.() || !model.dispose) return false;
  model.dispose();
  return true;
}

function toTextPosition(position: MonacoPositionLike | null | undefined): TextPosition | undefined {
  if (!position) return undefined;
  return {
    line: positiveInteger(position.lineNumber),
    column: positiveInteger(position.column)
  };
}

function toTextSelection(selection: MonacoSelectionLike | null | undefined): TextSelection | undefined {
  if (!selection) return undefined;
  return {
    anchor: {
      line: positiveInteger(selection.selectionStartLineNumber),
      column: positiveInteger(selection.selectionStartColumn)
    },
    active: {
      line: positiveInteger(selection.positionLineNumber),
      column: positiveInteger(selection.positionColumn)
    }
  };
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function finiteNonNegative(value: number | undefined): number {
  return Number.isFinite(value) ? Math.max(0, value!) : 0;
}
