export type MonacoModelSyncResult = 'unchanged' | 'authoritative' | 'undoable' | 'unavailable';

export interface MonacoSyncPosition {
  lineNumber: number;
  column: number;
}

export interface MonacoSyncSelection {
  selectionStartLineNumber: number;
  selectionStartColumn: number;
  positionLineNumber: number;
  positionColumn: number;
}

export interface MonacoSyncModel {
  getValue?: () => string;
  setValue?: (value: string) => void;
  getFullModelRange?: () => unknown;
  pushStackElement?: () => void;
  getOffsetAt?: (position: MonacoSyncPosition) => number;
  getPositionAt?: (offset: number) => MonacoSyncPosition | undefined;
}

export interface MonacoSyncEditor {
  executeEdits?: (
    source: string,
    edits: Array<{ range: unknown; text: string; forceMoveMarkers: boolean }>
  ) => unknown;
  getSelection?: () => MonacoSyncSelection | null;
  setSelection?: (selection: MonacoSyncSelection) => void;
  setPosition?: (position: MonacoSyncPosition) => void;
}

interface SelectionOffsets {
  anchor: number;
  active: number;
}

function captureSelectionOffsets(
  model: MonacoSyncModel,
  editor: MonacoSyncEditor
): SelectionOffsets | null {
  try {
    const selection = editor.getSelection?.();
    if (!selection || !model.getOffsetAt) return null;
    return {
      anchor: model.getOffsetAt({
        lineNumber: selection.selectionStartLineNumber,
        column: selection.selectionStartColumn
      }),
      active: model.getOffsetAt({
        lineNumber: selection.positionLineNumber,
        column: selection.positionColumn
      })
    };
  } catch {
    return null;
  }
}

function restoreSelectionOffsets(
  model: MonacoSyncModel,
  editor: MonacoSyncEditor,
  offsets: SelectionOffsets | null,
  valueLength: number
): void {
  if (!offsets || !model.getPositionAt) return;
  try {
    const limit = Math.max(0, valueLength);
    const anchor = model.getPositionAt(Math.min(Math.max(0, offsets.anchor), limit));
    const active = model.getPositionAt(Math.min(Math.max(0, offsets.active), limit));
    if (!anchor || !active) return;
    if (offsets.anchor !== offsets.active && editor.setSelection) {
      editor.setSelection({
        selectionStartLineNumber: anchor.lineNumber,
        selectionStartColumn: anchor.column,
        positionLineNumber: active.lineNumber,
        positionColumn: active.column
      });
    } else {
      editor.setPosition?.(active);
    }
  } catch {
    // 恢复失败时保留 setValue 的默认光标位置即可，不能阻断同步本身。
  }
}

export interface MonacoModelSyncOptions {
  authoritative: boolean;
  readOnly: boolean;
  resetNativeHistory?: boolean;
}

export interface MonacoValueBinding {
  defaultValue?: string;
  value?: string;
}

export function createMonacoValueBinding(language: string, sourceCode: string): MonacoValueBinding {
  return language === 'lingcpp'
    ? { defaultValue: sourceCode, value: undefined }
    : { defaultValue: undefined, value: sourceCode };
}

export function synchronizeMonacoModelValue(
  model: MonacoSyncModel,
  editor: MonacoSyncEditor,
  sourceCode: string,
  options: MonacoModelSyncOptions
): MonacoModelSyncResult {
  const valueMatches = model.getValue?.() === sourceCode;
  if (valueMatches && !(options.authoritative && options.resetNativeHistory)) return 'unchanged';

  if (options.authoritative || options.readOnly || !editor.executeEdits || !model.getFullModelRange) {
    if (!model.setValue) return 'unavailable';
    const selectionOffsets = captureSelectionOffsets(model, editor);
    model.setValue(sourceCode);
    restoreSelectionOffsets(model, editor, selectionOffsets, sourceCode.length);
    return 'authoritative';
  }

  model.pushStackElement?.();
  editor.executeEdits('lingbuilder.externalEdit', [{
    range: model.getFullModelRange(),
    text: sourceCode,
    forceMoveMarkers: true
  }]);
  model.pushStackElement?.();
  return 'undoable';
}
