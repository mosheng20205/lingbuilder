export interface TextEditHistorySnapshot {
  current: string;
  canUndo: boolean;
  canRedo: boolean;
  undoDepth: number;
  redoDepth: number;
}

/** Bounded, per-model history used by non-Monaco editing surfaces. */
export class TextEditHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private currentValue: string;
  private contextKey: string | undefined;

  constructor(initialValue: string, private readonly limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
      throw new Error('文本撤销历史上限必须是 1 到 1000 的整数。');
    }
    this.currentValue = String(initialValue);
  }

  current(): string {
    return this.currentValue;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clearRedo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.redoStack = [];
    return true;
  }

  /**
   * Establishes a non-undoable baseline when a file first enters a history
   * engine or crosses a language/editor-history boundary after a rename.
   */
  adoptContext(contextKey: string, value: string): boolean {
    const nextContextKey = String(contextKey);
    if (this.contextKey === nextContextKey) return false;
    this.contextKey = nextContextKey;
    this.reset(value);
    return true;
  }

  record(nextValue: string): boolean {
    const next = String(nextValue);
    if (next === this.currentValue) return false;
    this.undoStack.push(this.currentValue);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.currentValue = next;
    this.redoStack = [];
    return true;
  }

  undo(): string | undefined {
    const previous = this.undoStack.pop();
    if (previous === undefined) return undefined;
    this.redoStack.push(this.currentValue);
    this.currentValue = previous;
    return previous;
  }

  undoTo(targetValue: string): boolean {
    const target = String(targetValue);
    if (target === this.currentValue) return false;
    if (this.undoStack.lastIndexOf(target) < 0) return false;
    while (this.currentValue !== target) this.undo();
    return true;
  }

  redo(): string | undefined {
    const next = this.redoStack.pop();
    if (next === undefined) return undefined;
    this.undoStack.push(this.currentValue);
    this.currentValue = next;
    return next;
  }

  redoTo(targetValue: string): boolean {
    const target = String(targetValue);
    if (target === this.currentValue) return false;
    if (this.redoStack.lastIndexOf(target) < 0) return false;
    while (this.currentValue !== target) this.redo();
    return true;
  }

  /** Adopt an authoritative value without making hydration undoable. */
  reset(value: string): void {
    this.currentValue = String(value);
    this.undoStack = [];
    this.redoStack = [];
  }

  snapshot(): TextEditHistorySnapshot {
    return {
      current: this.currentValue,
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length
    };
  }

  dispose(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.currentValue = '';
    this.contextKey = undefined;
  }
}

export interface TextEditHistoryReconciliation {
  contextKey: string;
  value: string;
  canonical: boolean;
  deferExternalChange?: boolean;
}

export function reconcileTextEditHistory(
  history: TextEditHistory,
  reconciliation: TextEditHistoryReconciliation
): boolean {
  let changed = history.adoptContext(reconciliation.contextKey, reconciliation.value);
  if (
    reconciliation.canonical
    && !reconciliation.deferExternalChange
    && history.current() !== reconciliation.value
  ) {
    changed = history.record(reconciliation.value) || changed;
  }
  return changed;
}
