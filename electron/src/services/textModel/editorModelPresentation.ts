import { TextEditorStatus } from './types';

export interface EditorHistoryPresentation {
  undoDisabled: boolean;
  redoDisabled: boolean;
  undoTitle: string;
  redoTitle: string;
}

export interface EditorHistoryKeybindingLabels {
  undo?: string;
  redo?: string;
}

export function createInactiveTextEditorStatus(surface: string): TextEditorStatus {
  return {
    modelId: '',
    surface: surface.trim() || 'inactive',
    line: 1,
    column: 1,
    selectionLength: 0,
    canUndo: false,
    canRedo: false,
    readOnly: true,
    positionAvailable: false
  };
}

export function getEditorHistoryPresentation(
  state: TextEditorStatus,
  keybindings: EditorHistoryKeybindingLabels = {}
): EditorHistoryPresentation {
  const undoDisabled = state.readOnly || !state.canUndo;
  const redoDisabled = state.readOnly || !state.canRedo;
  return {
    undoDisabled,
    redoDisabled,
    undoTitle: state.canUndo && !state.readOnly
      ? `撤销当前文件的上一步编辑${keybindings.undo ? ` (${keybindings.undo})` : ''}`
      : historyUnavailableReason(state, '撤销'),
    redoTitle: state.canRedo && !state.readOnly
      ? `重做当前文件刚撤销的编辑${keybindings.redo ? ` (${keybindings.redo})` : ''}`
      : historyUnavailableReason(state, '重做')
  };
}

export function formatEditorPositionStatus(state: Pick<TextEditorStatus, 'line' | 'column' | 'selectionLength' | 'positionAvailable'>): {
  text: string;
  label: string;
} {
  if (state.positionAvailable === false) {
    return { text: '无活动文本光标', label: '当前视图没有可用的文本光标位置' };
  }
  const line = positiveInteger(state.line);
  const column = positiveInteger(state.column);
  const selectionLength = nonNegativeInteger(state.selectionLength);
  const text = `第 ${line} 行，第 ${column} 列${selectionLength > 0 ? ` · 已选 ${selectionLength}` : ''}`;
  const label = selectionLength > 0
    ? `当前光标位于第 ${line} 行、第 ${column} 列，已选择 ${selectionLength} 个字符`
    : `当前光标位于第 ${line} 行、第 ${column} 列`;
  return { text, label };
}

function historyUnavailableReason(state: TextEditorStatus, action: '撤销' | '重做'): string {
  if (state.readOnly) return `当前界面为只读，不能${action}`;
  if (state.surface === 'designer') return `界面设计没有可${action}的设计操作`;
  if (state.surface === 'beginner') return `新手结构输入框暂无可由工作台${action}的编辑`;
  return `当前文件没有可${action}的编辑`;
}

function positiveInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : 1;
}

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}
