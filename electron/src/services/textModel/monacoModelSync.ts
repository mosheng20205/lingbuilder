export type MonacoModelSyncResult = 'unchanged' | 'authoritative' | 'undoable' | 'unavailable';

export interface MonacoSyncModel {
  getValue?: () => string;
  setValue?: (value: string) => void;
  getFullModelRange?: () => unknown;
  pushStackElement?: () => void;
}

export interface MonacoSyncEditor {
  executeEdits?: (
    source: string,
    edits: Array<{ range: unknown; text: string; forceMoveMarkers: boolean }>
  ) => unknown;
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
    model.setValue(sourceCode);
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
