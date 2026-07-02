import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import {
  tokenizeEplStatement,
  EPL_TOKEN_COLORS_DARK,
  EPL_TOKEN_COLORS_LIGHT,
  type EplToken,
  type EplTokenColorTheme
} from '../services/eplTokenizer';
import {
  EPL_FLOW_GUIDE_COLORS,
  EplHeaderEntry,
  EplHeaderLine,
  EplStatementEntry,
  EplStructuredDocument,
  EplSubprogramBlock,
  EplSubprogramEntry,
  EplVariableBlock,
  EplVariableRow,
  buildEplStatementGuides,
  cloneEplStructuredDocument,
  createBlankEplStatement,
  createBlankEplVariable,
  createBlankEplVariableBlock,
  getEplSubprogramStatements,
  getEplSubprogramVariables,
  getEplTypeSuggestions,
  parseEplStructuredDocument,
  serializeEplStructuredDocument
} from '../services/eplStructuredEditor';

interface EplStructuredEditorProps {
  sourceCode: string;
  isDarkMode: boolean;
  readOnly: boolean;
  onChange: (value: string) => void;
  focusHandlerName?: string | null;
  onFocusHandled?: () => void;
  editorFontSize?: number;
  onFontSizeChange?: (size: number) => void;
}

type VariableField = 'name' | 'type' | 'isStatic' | 'isArray' | 'remark';
type SubprogramField = 'name' | 'returnType' | 'isPublic' | 'isEasyPackage' | 'remark' | 'returnRemark';

interface EplContextMenuState {
  x: number;
  y: number;
  subprogramIndex?: number;
  bodyIndex?: number;
}

interface ActiveEditorPosition {
  subprogramIndex: number;
  bodyIndex?: number;
  kind: 'subprogram' | 'statement' | 'variableBlock';
}

export default function EplStructuredEditor({
  sourceCode,
  isDarkMode,
  readOnly,
  onChange,
  focusHandlerName,
  onFocusHandled,
  editorFontSize,
  onFontSizeChange
}: EplStructuredEditorProps) {
  const documentModel = useMemo(() => parseEplStructuredDocument(sourceCode), [sourceCode]);
  useEffect(() => {
    const el = editorRootRef.current;
    if (!el) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY < 0) {
          onFontSizeChange?.(Math.min(40, (editorFontSize || 14) + 1));
        } else {
          onFontSizeChange?.(Math.max(10, (editorFontSize || 14) - 1));
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [editorFontSize, onFontSizeChange]);

  useEffect(() => {
    const handleInsertSnippet = (event: Event) => {
      const customEvent = event as CustomEvent<{ text: string }>;
      const text = customEvent.detail.text;
      
      const focusedEl = document.activeElement as HTMLInputElement;
      if (focusedEl && focusedEl.getAttribute('data-epl-focus')?.startsWith('stmt-')) {
        const start = focusedEl.selectionStart ?? focusedEl.value.length;
        const end = focusedEl.selectionEnd ?? focusedEl.value.length;
        const val = focusedEl.value;
        const newVal = val.slice(0, start) + text + val.slice(end);
        
        const match = focusedEl.getAttribute('data-epl-focus')?.match(/^stmt-(\d+)-(\d+)$/);
        if (match) {
          const subIdx = parseInt(match[1], 10);
          const bodyIdx = parseInt(match[2], 10);
          
          if (text.includes('\n')) {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            commitDocument(draft => {
              const body = draft.subprograms[subIdx].body;
              const isCurrentEmpty = body[bodyIdx].kind === 'statement' && !(body[bodyIdx] as any).text.trim();
              
              const insertLines: EplStatementEntry[] = lines.map((l, i) => {
                let indent = (body[bodyIdx] as any).indent || '';
                if (i > 0 && !l.startsWith('.')) {
                  indent = indent + '    ';
                }
                return {
                  id: `stmt-insert-${Date.now()}-${i}`,
                  kind: 'statement',
                  text: l,
                  indent,
                  sourceLine: 0
                };
              });
              
              if (isCurrentEmpty) {
                body.splice(bodyIdx, 1, ...insertLines);
              } else {
                body.splice(bodyIdx + 1, 0, ...insertLines);
              }
            });
          } else {
            commitDocument(draft => {
              const statement = draft.subprograms[subIdx].body[bodyIdx];
              if (statement.kind === 'statement') {
                statement.text = newVal;
              }
            });
            window.requestAnimationFrame(() => {
              focusedEl.focus();
              const newPos = start + text.length;
              focusedEl.setSelectionRange(newPos, newPos);
            });
          }
        }
      }
    };
    
    window.addEventListener('insert-epl-snippet', handleInsertSnippet);
    return () => {
      window.removeEventListener('insert-epl-snippet', handleInsertSnippet);
    };
  }, [documentModel]);
  const editorRootRef = useRef<HTMLDivElement | null>(null);
  const subprogramRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [pendingFocusTarget, setPendingFocusTarget] = useState<string | null>(null);
  const [collapsedSubprogramIds, setCollapsedSubprogramIds] = useState<Set<string>>(() => new Set());
  const [collapsedVariableBlockIds, setCollapsedVariableBlockIds] = useState<Set<string>>(() => new Set());
  const [contextMenu, setContextMenu] = useState<EplContextMenuState | null>(null);
  const [activePosition, setActivePosition] = useState<ActiveEditorPosition | null>(null);

  // Undo/Redo stack
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const MAX_UNDO_STEPS = 100;

  // Focused statement tracking for current-line highlight
  const [focusedStatement, setFocusedStatement] = useState<{ subprogramIndex: number; bodyIndex: number } | null>(null);

  const commitDocument = (mutator: (draft: EplStructuredDocument) => void) => {
    if (readOnly) return;
    // Push current state to undo stack before mutation
    undoStackRef.current.push(sourceCode);
    if (undoStackRef.current.length > MAX_UNDO_STEPS) {
      undoStackRef.current.shift();
    }
    // Clear redo stack on new edit
    redoStackRef.current = [];
    const draft = cloneEplStructuredDocument(documentModel);
    mutator(draft);
    onChange(serializeEplStructuredDocument(draft));
  };

  useEffect(() => {
    if (!focusHandlerName) return;

    const target = documentModel.subprograms.find(subprogram => subprogram.name === focusHandlerName);
    if (!target) return;

    window.requestAnimationFrame(() => {
      subprogramRefs.current[target.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setPendingFocusTarget(`sub-name-${target.id}`);
      onFocusHandled?.();
    });
  }, [documentModel.subprograms, focusHandlerName, onFocusHandled]);

  useEffect(() => {
    if (!pendingFocusTarget) return;

    window.requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-epl-focus="${pendingFocusTarget}"]`);
      if (!target) return;
      target.focus();
      if (target instanceof HTMLInputElement) {
        target.select();
      }
      setPendingFocusTarget(null);
    });
  }, [pendingFocusTarget, sourceCode]);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('blur', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('blur', closeMenu);
    };
  }, []);

  useEffect(() => {
    const validIds = new Set(documentModel.subprograms.map(subprogram => subprogram.id));
    setCollapsedSubprogramIds(previous => new Set([...previous].filter(id => validIds.has(id))));
  }, [documentModel.subprograms]);

  useEffect(() => {
    const validIds = new Set(
      documentModel.subprograms.flatMap(subprogram => (
        subprogram.body
          .filter((entry): entry is EplVariableBlock => entry.kind === 'variables')
          .map(entry => entry.id)
      ))
    );
    setCollapsedVariableBlockIds(previous => new Set([...previous].filter(id => validIds.has(id))));
  }, [documentModel.subprograms]);

  const rememberPosition = (position: ActiveEditorPosition) => {
    setActivePosition(position);
  };

  const openContextMenu = (event: MouseEvent, subprogramIndex?: number, bodyIndex?: number) => {
    event.preventDefault();

    if (subprogramIndex !== undefined) {
      const bodyEntry = bodyIndex === undefined ? undefined : documentModel.subprograms[subprogramIndex]?.body[bodyIndex];
      rememberPosition({
        subprogramIndex,
        bodyIndex,
        kind: bodyEntry?.kind === 'variables'
          ? 'variableBlock'
          : bodyEntry?.kind === 'statement'
            ? 'statement'
            : 'subprogram'
      });
    }

    setContextMenu({ x: event.clientX, y: event.clientY, subprogramIndex, bodyIndex });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const toggleSubprogramCollapse = (subprogramId: string) => {
    setCollapsedSubprogramIds(previous => {
      const next = new Set(previous);
      if (next.has(subprogramId)) {
        next.delete(subprogramId);
      } else {
        next.add(subprogramId);
      }
      return next;
    });
  };

  const toggleVariableBlockCollapse = (variableBlockId: string) => {
    setCollapsedVariableBlockIds(previous => {
      const next = new Set(previous);
      if (next.has(variableBlockId)) {
        next.delete(variableBlockId);
      } else {
        next.add(variableBlockId);
      }
      return next;
    });
  };

  const setAllSubprogramsCollapsed = (collapsed: boolean) => {
    setCollapsedSubprogramIds(collapsed ? new Set(documentModel.subprograms.map(subprogram => subprogram.id)) : new Set());
    closeContextMenu();
  };

  const getCurrentSubprogramIndex = (preferredIndex?: number) => {
    if (preferredIndex !== undefined) return preferredIndex;
    if (activePosition?.subprogramIndex !== undefined) return activePosition.subprogramIndex;
    return documentModel.subprograms.length > 0 ? documentModel.subprograms.length - 1 : undefined;
  };

  const updateHeaderLine = (entryIndex: number, value: string) => {
    commitDocument(draft => {
      const entry = draft.header[entryIndex];
      if (entry?.kind === 'line') {
        entry.text = value;
      }
    });
  };

  const updateProgramVariable = (entryIndex: number, field: VariableField, value: string | boolean) => {
    commitDocument(draft => {
      const entry = draft.header[entryIndex];
      if (entry?.kind === 'programVariable') {
        (entry.variable[field] as string | boolean) = value;
      }
    });
  };

  const insertProgramVariable = (entryIndex: number) => {
    const nextIndex = Math.max(0, entryIndex + 1);
    setPendingFocusTarget(`program-var-name-${nextIndex}`);
    commitDocument(draft => {
      draft.header.splice(nextIndex, 0, {
        kind: 'programVariable',
        id: `program-var-new-${nextIndex}`,
        sourceLine: 0,
        variable: createBlankEplVariable('program', `program-var-new-${nextIndex}`)
      });
    });
  };

  const updateSubprogram = (subprogramIndex: number, field: SubprogramField, value: string | boolean) => {
    commitDocument(draft => {
      const subprogram = draft.subprograms[subprogramIndex];
      if (subprogram) {
        (subprogram[field] as string | boolean) = value;
      }
    });
  };

  const updateLocalVariable = (
    subprogramIndex: number,
    bodyIndex: number,
    variableIndex: number,
    field: VariableField,
    value: string | boolean
  ) => {
    commitDocument(draft => {
      const entry = draft.subprograms[subprogramIndex]?.body[bodyIndex];
      if (entry?.kind !== 'variables') return;
      const variable = entry.variables[variableIndex];
      if (variable) {
        (variable[field] as string | boolean) = value;
      }
    });
  };

  const insertLocalVariable = (subprogramIndex: number, bodyIndex: number, variableIndex: number) => {
    const nextIndex = variableIndex + 1;
    setPendingFocusTarget(`local-var-name-${subprogramIndex}-${bodyIndex}-${nextIndex}`);
    rememberPosition({ subprogramIndex, bodyIndex, kind: 'variableBlock' });
    commitDocument(draft => {
      const entry = draft.subprograms[subprogramIndex]?.body[bodyIndex];
      if (entry?.kind !== 'variables') return;
      entry.variables.splice(nextIndex, 0, createBlankEplVariable('local', `${entry.id}-var-new-${nextIndex}`));
    });
  };

  const appendLocalVariable = (subprogramIndex: number, bodyIndex: number) => {
    const entry = documentModel.subprograms[subprogramIndex]?.body[bodyIndex];
    if (entry?.kind !== 'variables') return;

    const nextIndex = entry.variables.length;
    setPendingFocusTarget(`local-var-name-${subprogramIndex}-${bodyIndex}-${nextIndex}`);
    rememberPosition({ subprogramIndex, bodyIndex, kind: 'variableBlock' });
    commitDocument(draft => {
      const target = draft.subprograms[subprogramIndex]?.body[bodyIndex];
      if (target?.kind !== 'variables') return;
      target.variables.push(createBlankEplVariable('local', `${target.id}-var-new-${nextIndex}`));
    });
  };

  const getVariableBlockInsertIndex = (subprogramIndex: number, preferredBodyIndex?: number) => {
    const subprogram = documentModel.subprograms[subprogramIndex];
    if (!subprogram) return 0;
    const cursorBodyIndex = preferredBodyIndex ?? (
      activePosition?.subprogramIndex === subprogramIndex ? activePosition.bodyIndex : undefined
    );

    if (cursorBodyIndex === undefined) {
      return subprogram.body.length;
    }

    const entry = subprogram.body[cursorBodyIndex];
    if (entry?.kind === 'variables') {
      return Math.min(subprogram.body.length, cursorBodyIndex + 1);
    }
    return Math.max(0, Math.min(subprogram.body.length, cursorBodyIndex));
  };

  const getIndentNearBodyIndex = (subprogram: EplSubprogramBlock, bodyIndex: number) => {
    const currentEntry = subprogram.body[bodyIndex];
    if (currentEntry) return currentEntry.indent;
    const previousEntry = subprogram.body[bodyIndex - 1];
    return previousEntry?.indent ?? '    ';
  };

  const insertLocalVariableBlockAtCursor = (preferredSubprogramIndex?: number, preferredBodyIndex?: number) => {
    const subprogramIndex = getCurrentSubprogramIndex(preferredSubprogramIndex);
    if (subprogramIndex === undefined) return;

    const subprogram = documentModel.subprograms[subprogramIndex];
    if (!subprogram) return;

    const insertIndex = getVariableBlockInsertIndex(subprogramIndex, preferredBodyIndex);
    const indent = getIndentNearBodyIndex(subprogram, insertIndex);
    setPendingFocusTarget(`local-var-name-${subprogramIndex}-${insertIndex}-0`);
    rememberPosition({ subprogramIndex, bodyIndex: insertIndex, kind: 'variableBlock' });
    setCollapsedSubprogramIds(previous => {
      const next = new Set(previous);
      next.delete(subprogram.id);
      return next;
    });

    commitDocument(draft => {
      const target = draft.subprograms[subprogramIndex];
      if (!target) return;
      target.body.splice(insertIndex, 0, createBlankEplVariableBlock(`${target.id}-vars-new-${insertIndex}`, indent));
    });
  };

  const appendStatement = (subprogramIndex: number, preferredBodyIndex?: number) => {
    const subprogram = documentModel.subprograms[subprogramIndex];
    if (!subprogram) return;

    const insertIndex = preferredBodyIndex === undefined
      ? subprogram.body.length
      : Math.min(subprogram.body.length, preferredBodyIndex + 1);
    const indent = getIndentNearBodyIndex(subprogram, insertIndex);
    setPendingFocusTarget(`stmt-${subprogramIndex}-${insertIndex}`);
    rememberPosition({ subprogramIndex, bodyIndex: insertIndex, kind: 'statement' });
    commitDocument(draft => {
      const target = draft.subprograms[subprogramIndex];
      if (!target) return;
      target.body.splice(insertIndex, 0, createBlankEplStatement(`${target.id}-stmt-new-${insertIndex}`, indent));
    });
  };

  const updateStatement = (subprogramIndex: number, bodyIndex: number, value: string) => {
    commitDocument(draft => {
      const entry = draft.subprograms[subprogramIndex]?.body[bodyIndex];
      if (entry?.kind === 'statement') {
        entry.text = value;
      }
    });
  };

  const deleteEmptyStatement = (subprogramIndex: number, bodyIndex: number) => {
    const subprogram = documentModel.subprograms[subprogramIndex];
    const entry = subprogram?.body[bodyIndex];
    if (!subprogram || readOnly || entry?.kind !== 'statement' || entry.text.trim()) return;

    setPendingFocusTarget(getStatementFocusAfterRemoval(subprogram, subprogramIndex, bodyIndex));
    rememberPosition({ subprogramIndex, bodyIndex: Math.max(0, bodyIndex - 1), kind: 'statement' });
    commitDocument(draft => {
      const target = draft.subprograms[subprogramIndex];
      if (!target) return;
      const targetEntry = target.body[bodyIndex];
      if (targetEntry?.kind === 'statement' && !targetEntry.text.trim()) {
        target.body.splice(bodyIndex, 1);
      }
    });
  };

  const insertStatement = (subprogramIndex: number, bodyIndex: number, indent: string) => {
    const nextIndex = bodyIndex + 1;
    setPendingFocusTarget(`stmt-${subprogramIndex}-${nextIndex}`);
    rememberPosition({ subprogramIndex, bodyIndex: nextIndex, kind: 'statement' });
    commitDocument(draft => {
      const subprogram = draft.subprograms[subprogramIndex];
      if (!subprogram) return;
      subprogram.body.splice(nextIndex, 0, createBlankEplStatement(`${subprogram.id}-stmt-new-${nextIndex}`, indent));
    });
  };

  const changeStatementIndent = (subprogramIndex: number, bodyIndex: number, direction: 1 | -1) => {
    commitDocument(draft => {
      const entry = draft.subprograms[subprogramIndex]?.body[bodyIndex];
      if (entry?.kind !== 'statement') return;
      if (direction > 0) {
        entry.indent += '    ';
        return;
      }
      entry.indent = entry.indent.slice(0, Math.max(0, entry.indent.length - 4));
    });
  };

  const insertSubprogramAfter = (preferredIndex?: number) => {
    if (readOnly) return;

    const currentIndex = getCurrentSubprogramIndex(preferredIndex);
    const insertIndex = currentIndex === undefined
      ? documentModel.subprograms.length
      : Math.min(documentModel.subprograms.length, currentIndex + 1);
    const displayIndex = documentModel.subprograms.length + 1;

    setPendingFocusTarget(`sub-name-subprogram-${insertIndex}`);
    rememberPosition({ subprogramIndex: insertIndex, kind: 'subprogram' });
    commitDocument(draft => {
      draft.subprograms.splice(insertIndex, 0, {
        id: `subprogram-${insertIndex}`,
        sourceLine: 0,
        name: `_子程序${displayIndex}`,
        returnType: '无',
        isPublic: false,
        isEasyPackage: false,
        remark: '',
        returnRemark: '',
        body: [createBlankEplStatement(`subprogram-${insertIndex}-stmt-0`)]
      });
    });
  };

  const deleteSubprogram = (subprogramIndex: number) => {
    const subprogram = documentModel.subprograms[subprogramIndex];
    if (!subprogram || readOnly) return;

    const confirmed = window.confirm(`确定删除子程序 ${subprogram.name || '未命名子程序'} 吗？`);
    if (!confirmed) return;

    commitDocument(draft => {
      draft.subprograms.splice(subprogramIndex, 1);
    });
    closeContextMenu();
  };

  const handleUndo = () => {
    if (readOnly || undoStackRef.current.length === 0) return;
    const previous = undoStackRef.current.pop()!;
    redoStackRef.current.push(sourceCode);
    onChange(previous);
  };

  const handleRedo = () => {
    if (readOnly || redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(sourceCode);
    onChange(next);
  };

  const handleCopyLine = () => {
    if (readOnly || !focusedStatement) return;
    const { subprogramIndex, bodyIndex } = focusedStatement;
    commitDocument(draft => {
      const subprogram = draft.subprograms[subprogramIndex];
      if (!subprogram) return;
      const entry = subprogram.body[bodyIndex];
      if (entry?.kind === 'statement') {
        const clone: EplStatementEntry = {
          id: `${entry.id}-dup-${Date.now()}`,
          kind: 'statement',
          text: entry.text,
          indent: entry.indent,
          sourceLine: 0
        };
        subprogram.body.splice(bodyIndex + 1, 0, clone);
      }
    });
  };

  const handleMoveLineUp = () => {
    if (readOnly || !focusedStatement) return;
    const { subprogramIndex, bodyIndex } = focusedStatement;
    if (bodyIndex <= 0) return;
    commitDocument(draft => {
      const body = draft.subprograms[subprogramIndex]?.body;
      if (!body || bodyIndex >= body.length) return;
      const [moved] = body.splice(bodyIndex, 1);
      body.splice(bodyIndex - 1, 0, moved);
    });
    setFocusedStatement({ subprogramIndex, bodyIndex: bodyIndex - 1 });
  };

  const handleMoveLineDown = () => {
    if (readOnly || !focusedStatement) return;
    const { subprogramIndex, bodyIndex } = focusedStatement;
    const subprogram = documentModel.subprograms[subprogramIndex];
    if (!subprogram || bodyIndex >= subprogram.body.length - 1) return;
    commitDocument(draft => {
      const body = draft.subprograms[subprogramIndex]?.body;
      if (!body || bodyIndex >= body.length - 1) return;
      const [moved] = body.splice(bodyIndex, 1);
      body.splice(bodyIndex + 1, 0, moved);
    });
    setFocusedStatement({ subprogramIndex, bodyIndex: bodyIndex + 1 });
  };

  const handleDeleteLine = () => {
    if (readOnly || !focusedStatement) return;
    const { subprogramIndex, bodyIndex } = focusedStatement;
    commitDocument(draft => {
      const subprogram = draft.subprograms[subprogramIndex];
      if (!subprogram) return;
      if (subprogram.body.length > 1) {
        subprogram.body.splice(bodyIndex, 1);
      } else if (subprogram.body[bodyIndex]?.kind === 'statement') {
        (subprogram.body[bodyIndex] as EplStatementEntry).text = '';
      }
    });
  };

  const handleEditorKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Alt+Arrow: move line
    if (event.altKey && !event.ctrlKey && !event.metaKey) {
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        handleMoveLineUp();
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        handleMoveLineDown();
        return;
      }
    }

    if (!event.ctrlKey || event.altKey || event.metaKey) return;

    const key = event.key.toLowerCase();

    // Ctrl+Z: Undo
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      handleUndo();
      return;
    }

    // Ctrl+Y or Ctrl+Shift+Z: Redo
    if (key === 'y' || (key === 'z' && event.shiftKey)) {
      event.preventDefault();
      handleRedo();
      return;
    }

    // Ctrl+D: Duplicate line
    if (key === 'd') {
      event.preventDefault();
      handleCopyLine();
      return;
    }

    // Ctrl+Shift+K: Delete line
    if (key === 'k' && event.shiftKey) {
      event.preventDefault();
      handleDeleteLine();
      return;
    }

    if (key === 'n') {
      event.preventDefault();
      insertSubprogramAfter();
      closeContextMenu();
      return;
    }

    if (key === 'l') {
      event.preventDefault();
      insertLocalVariableBlockAtCursor();
      closeContextMenu();
    }
  };

  return (
    <div
      ref={editorRootRef}
      tabIndex={0}
      onKeyDown={handleEditorKeyDown}
      onContextMenu={event => openContextMenu(event)}
      style={{
        fontSize: `${editorFontSize || 14}px`,
        '--editor-font-size': `${editorFontSize || 14}px`
      } as CSSProperties}
      className={`h-full overflow-auto px-4 py-3 text-[0.8em] font-mono tabular-nums outline-none ${
      isDarkMode ? 'bg-[#1e1e1e] text-[#d4d4d4]' : 'bg-white text-slate-850'
    }`}
    >
      <div className="min-w-[880px] pb-10">
        <div className="mb-4 space-y-3">
          <VolcanoHeaderTable
            header={documentModel.header}
            isDarkMode={isDarkMode}
            readOnly={readOnly}
            updateHeaderLine={updateHeaderLine}
          />
          {documentModel.header.map((entry, entryIndex) => renderHeaderEntry(entry, entryIndex, {
            isDarkMode,
            readOnly,
            updateHeaderLine,
            updateProgramVariable,
            insertProgramVariable
          }))}
        </div>

        <div className="space-y-5">
          {documentModel.subprograms.map((subprogram, subprogramIndex) => {
            const isSubprogramCollapsed = collapsedSubprogramIds.has(subprogram.id);

            return (
              <div
                key={subprogram.id}
                ref={node => {
                  subprogramRefs.current[subprogram.id] = node;
                }}
                onFocusCapture={() => rememberPosition({ subprogramIndex, kind: 'subprogram' })}
                onMouseDownCapture={() => rememberPosition({ subprogramIndex, kind: 'subprogram' })}
                onContextMenu={event => {
                  event.stopPropagation();
                  openContextMenu(event, subprogramIndex);
                }}
                className={`relative rounded-[3px] border ${
                  isDarkMode ? 'border-[#34343c] bg-[#202024]' : 'border-slate-300 bg-slate-50'
                }`}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${
                  isDarkMode ? 'bg-[#0bbdff]' : 'bg-blue-600'
                }`} />
                <FoldMarker
                  isCollapsed={isSubprogramCollapsed}
                  isDarkMode={isDarkMode}
                  label={isSubprogramCollapsed ? '展开子程序' : '收缩子程序'}
                  className="absolute left-4 top-3"
                  onToggle={() => toggleSubprogramCollapse(subprogram.id)}
                />
                <div className="pl-12 pr-3 py-2">
                  <div className="flex items-start gap-2">
                    <SubprogramHeader
                      subprogram={subprogram}
                      subprogramIndex={subprogramIndex}
                      isDarkMode={isDarkMode}
                      readOnly={readOnly}
                      compact={isSubprogramCollapsed}
                      onUpdate={updateSubprogram}
                    />
                    <button
                      type="button"
                      onClick={() => deleteSubprogram(subprogramIndex)}
                      disabled={readOnly}
                      title="删除子程序"
                      aria-label="删除子程序"
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isDarkMode
                          ? 'border-[#4a2f35] bg-[#2a1f22] text-rose-300 hover:bg-[#3a2429]'
                          : 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {!isSubprogramCollapsed && (
                    <SubprogramBody
                      subprogram={subprogram}
                      subprogramIndex={subprogramIndex}
                      isDarkMode={isDarkMode}
                      readOnly={readOnly}
                      collapsedVariableBlockIds={collapsedVariableBlockIds}
                      programVariables={documentModel.header
                        .filter(entry => entry.kind === 'programVariable')
                        .map(entry => entry.variable.name)
                        .filter(Boolean)}
                      subprogramNames={documentModel.subprograms
                        .map(sub => sub.name)
                        .filter(Boolean)}
                      onRememberPosition={rememberPosition}
                      onOpenContextMenu={openContextMenu}
                      onToggleVariableBlock={toggleVariableBlockCollapse}
                      onUpdateLocalVariable={updateLocalVariable}
                      onInsertLocalVariable={insertLocalVariable}
                      onAppendLocalVariable={appendLocalVariable}
                      onUpdateStatement={updateStatement}
                      onInsertStatement={insertStatement}
                      onDeleteEmptyStatement={deleteEmptyStatement}
                      onIndentStatement={changeStatementIndent}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => insertSubprogramAfter(documentModel.subprograms.length - 1)}
          disabled={readOnly}
          className={`mt-4 inline-flex h-8 items-center gap-2 rounded-[3px] border px-3 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isDarkMode
              ? 'border-[#343442] bg-[#25252b] text-slate-300 hover:bg-[#30303a] hover:text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Plus className="h-3.5 w-3.5" />
          新建子程序
        </button>
      </div>

      {contextMenu && (
        <EplContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isDarkMode={isDarkMode}
          readOnly={readOnly}
          subprogram={contextMenu.subprogramIndex === undefined ? undefined : documentModel.subprograms[contextMenu.subprogramIndex]}
          isSubprogramCollapsed={Boolean(
            contextMenu.subprogramIndex !== undefined
              && documentModel.subprograms[contextMenu.subprogramIndex]
              && collapsedSubprogramIds.has(documentModel.subprograms[contextMenu.subprogramIndex].id)
          )}
          onAddSubprogram={() => {
            insertSubprogramAfter(contextMenu.subprogramIndex);
            closeContextMenu();
          }}
          onCollapseAll={() => setAllSubprogramsCollapsed(true)}
          onExpandAll={() => setAllSubprogramsCollapsed(false)}
          onToggleSubprogram={() => {
            const subprogram = contextMenu.subprogramIndex === undefined ? undefined : documentModel.subprograms[contextMenu.subprogramIndex];
            if (subprogram) toggleSubprogramCollapse(subprogram.id);
            closeContextMenu();
          }}
          onAddVariable={() => {
            insertLocalVariableBlockAtCursor(contextMenu.subprogramIndex, contextMenu.bodyIndex);
            closeContextMenu();
          }}
          onAddStatement={() => {
            if (contextMenu.subprogramIndex !== undefined) appendStatement(contextMenu.subprogramIndex, contextMenu.bodyIndex);
            closeContextMenu();
          }}
          onDeleteSubprogram={() => {
            if (contextMenu.subprogramIndex !== undefined) deleteSubprogram(contextMenu.subprogramIndex);
          }}
        />
      )}
    </div>
  );
}

type VolcanoHeaderKind = 'version' | 'package' | 'library' | 'program';

interface VolcanoHeaderRow {
  kind: VolcanoHeaderKind;
  entry: EplHeaderLine;
  entryIndex: number;
  label: string;
  value: string;
  valueTone: string;
  typeLabel: string;
  propertyName: string;
  propertyValue: string;
  remark: string;
}

function VolcanoHeaderTable({
  header,
  isDarkMode,
  readOnly,
  updateHeaderLine,
  editorFontSize
}: {
  header: EplHeaderEntry[];
  isDarkMode: boolean;
  readOnly: boolean;
  updateHeaderLine: (entryIndex: number, value: string) => void;
  editorFontSize?: number;
}) {
  const rows = buildVolcanoHeaderRows(header);
  const packageRow = rows.find(row => row.kind === 'package');
  const programRow = rows.find(row => row.kind === 'program');
  const borderClass = isDarkMode ? 'border-[#4a4a4a]' : 'border-slate-300';
  const headerClass = isDarkMode ? 'bg-[#242424] text-[#d8d8d8]' : 'bg-slate-100 text-slate-600';
  const labelClass = isDarkMode ? 'bg-[#242424] text-[#9df59c]' : 'bg-emerald-50 text-emerald-700';
  const valueClass = isDarkMode ? 'bg-[#242424] text-[#d7d7d7]' : 'bg-white text-slate-850';
  const mutedClass = isDarkMode ? 'bg-[#242424] text-slate-500' : 'bg-white text-slate-400';
  const suggestedPackageName = inferPackageName(programRow?.value);
  const rowsWithPreview = rows.length > 0 ? rows : [];
  const [isCollapsed, setIsCollapsed] = useState(false);

  const getTextWidth = (text: string) => {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      width += text.charCodeAt(i) > 127 ? 15 : 9;
    }
    return width;
  };
  const maxHeaderValWidth = useMemo(() => {
    let maxWidth = 180;
    rowsWithPreview.forEach(row => {
      const w = getTextWidth(row.value) + 24;
      if (w > maxWidth) maxWidth = w;
    });
    return maxWidth;
  }, [rowsWithPreview]);

  const maxPropertyValWidth = useMemo(() => {
    let maxWidth = 230;
    rowsWithPreview.forEach(row => {
      const w = getTextWidth(row.propertyValue) + 24;
      if (w > maxWidth) maxWidth = w;
    });
    return maxWidth;
  }, [rowsWithPreview]);

  if (rowsWithPreview.length === 0) return null;

  return (
    <div className="flex items-start">
      <FoldMarker
        isCollapsed={isCollapsed}
        isDarkMode={isDarkMode}
        label={isCollapsed ? '展开源码声明' : '收缩源码声明'}
        className="mt-1"
        onToggle={() => setIsCollapsed(value => !value)}
      />
      <div
        className={`inline-grid overflow-visible rounded-[2px] border border-b-0 border-r-0 ${borderClass}`}
        style={{ gridTemplateColumns: `178px ${maxHeaderValWidth}px 116px 150px ${maxPropertyValWidth}px 260px` }}
      >
        <MethodTableLabel className={`${labelClass} text-[1.15em]`} marker="variable">声明名</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>名称 / 值</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>类型</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>属性名</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>属性值</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>备注</MethodTableLabel>

        {isCollapsed ? (
          <>
            <ReadOnlyTableCell className={`${labelClass} text-[1.0em]`}>源码声明</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>{rowsWithPreview.length} 项已收缩</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>文档/库/类</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>C++ 对应</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>{programRow ? `class ${toCppIdentifier(programRow.value)}` : '待声明'}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.8em]`}>点击左侧 + 展开声明表</ReadOnlyTableCell>
          </>
        ) : (
          <>
            {rowsWithPreview.map(row => (
              <Fragment key={`${row.kind}-${row.entry.id}`}>
                <VolcanoHeaderEditableRow
                  row={row}
                  isDarkMode={isDarkMode}
                  readOnly={readOnly}
                  valueClass={valueClass}
                  mutedClass={mutedClass}
                  updateHeaderLine={updateHeaderLine}
                />
              </Fragment>
            ))}

            {!packageRow && (
              <>
                <ReadOnlyTableCell className={`${labelClass} text-[1.15em]`}>包名预览</ReadOnlyTableCell>
                <ReadOnlyTableCell className={`${mutedClass} text-[1.0em]`}>未声明 .包</ReadOnlyTableCell>
                <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>命名空间</ReadOnlyTableCell>
                <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>建议声明</ReadOnlyTableCell>
                <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>.包 {suggestedPackageName}</ReadOnlyTableCell>
                <ReadOnlyTableCell className={`${mutedClass} text-[0.8em]`}>仅提示源码缺少包名，不参与 C++ 生成</ReadOnlyTableCell>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VolcanoHeaderEditableRow({
  row,
  isDarkMode,
  readOnly,
  valueClass,
  mutedClass,
  updateHeaderLine
}: {
  row: VolcanoHeaderRow;
  isDarkMode: boolean;
  readOnly: boolean;
  valueClass: string;
  mutedClass: string;
  updateHeaderLine: (entryIndex: number, value: string) => void;
}) {
  const labelClass = isDarkMode ? 'bg-[#242424] text-[#9df59c]' : 'bg-emerald-50 text-emerald-700';

  return (
    <>
      <ReadOnlyTableCell className={`${labelClass} text-[1.15em]`}>{row.label}</ReadOnlyTableCell>
      <TextCellInput
        value={row.value}
        onChange={value => updateHeaderLine(row.entryIndex, serializeVolcanoHeaderLine(row.kind, value))}
        readOnly={readOnly}
        className={`${valueClass} min-h-10 text-[1.0em] ${row.valueTone}`}
      />
      <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>{row.typeLabel}</ReadOnlyTableCell>
      <ReadOnlyTableCell className={`${valueClass} text-[0.9em]`}>{row.propertyName}</ReadOnlyTableCell>
      <ReadOnlyTableCell className={`${valueClass} text-[0.9em]`}>{row.propertyValue}</ReadOnlyTableCell>
      <ReadOnlyTableCell className={`${valueClass} text-[0.8em]`}>{row.remark}</ReadOnlyTableCell>
    </>
  );
}

function buildVolcanoHeaderRows(header: EplHeaderEntry[]): VolcanoHeaderRow[] {
  return header.flatMap((entry, entryIndex) => {
    if (entry.kind !== 'line') return [];
    const parsed = parseVolcanoHeaderLine(entry.text);
    if (!parsed) return [];

    return [{
      ...parsed,
      entry,
      entryIndex
    }];
  });
}

function parseVolcanoHeaderLine(text: string): Omit<VolcanoHeaderRow, 'entry' | 'entryIndex'> | null {
  const body = text.trim();

  if (body.startsWith('.版本')) {
    const value = body.slice('.版本'.length).trim();
    return {
      kind: 'version',
      label: '文档版本',
      value,
      valueTone: 'text-[#8f8f8f]',
      typeLabel: '整数',
      propertyName: '目标语言',
      propertyValue: '中文源码 -> C++',
      remark: '源码格式版本声明'
    };
  }

  if (body.startsWith('.包')) {
    const value = body.slice('.包'.length).trim();
    return {
      kind: 'package',
      label: '包名',
      value,
      valueTone: 'text-[#aeb8ff]',
      typeLabel: '命名空间',
      propertyName: 'C++ 对应',
      propertyValue: toCppNamespace(value),
      remark: '类似 C++ namespace，用于组织类全名称'
    };
  }

  if (body.startsWith('.支持库')) {
    const value = body.slice('.支持库'.length).trim();
    return {
      kind: 'library',
      label: '支持库',
      value,
      valueTone: 'text-[#d7d7d7]',
      typeLabel: '库引用',
      propertyName: '链接/适配',
      propertyValue: '本地 C++ 支持库',
      remark: '编译为 C++ 前加载的能力模块'
    };
  }

  if (body.startsWith('.程序集')) {
    const value = body.slice('.程序集'.length).trim();
    return {
      kind: 'program',
      label: '类名',
      value,
      valueTone: 'text-[#aeb8ff]',
      typeLabel: '窗口程序集',
      propertyName: 'C++ 对应',
      propertyValue: `class ${toCppIdentifier(value || '窗口程序集')}`,
      remark: '窗口事件和成员的主类/模块'
    };
  }

  return null;
}

function serializeVolcanoHeaderLine(kind: VolcanoHeaderKind, value: string): string {
  const commandMap: Record<VolcanoHeaderKind, string> = {
    version: '.版本',
    package: '.包',
    library: '.支持库',
    program: '.程序集'
  };
  return `${commandMap[kind]} ${value.trim()}`;
}

function inferPackageName(programName?: string): string {
  const normalizedProgram = programName?.replace(/^窗口程序集_?/, '').trim();
  return normalizedProgram ? `LingBuilder.${normalizedProgram}` : 'LingBuilder.窗口程序';
}

function toCppNamespace(packageName: string): string {
  const parts = packageName
    .split('.')
    .map(part => toCppIdentifier(part))
    .filter(Boolean);
  return parts.length > 0 ? `namespace ${parts.join('::')}` : 'namespace LingBuilder';
}

function toCppIdentifier(value: string): string {
  const normalized = value.trim().replace(/[^\w\u4e00-\u9fa5]/g, '_');
  return normalized || '未命名';
}

function getCppTypeForEplType(typeName: string): string {
  const normalizedType = typeName.trim();
  const typeMap: Record<string, string> = {
    文本型: 'std::wstring',
    整数型: 'int',
    长整数型: 'long long',
    小数型: 'float',
    双精度小数型: 'double',
    逻辑型: 'bool',
    字节集: 'std::vector<unsigned char>',
    日期时间型: 'SYSTEMTIME'
  };
  return typeMap[normalizedType] || toCppIdentifier(normalizedType || 'auto');
}

function EplContextMenu({
  x,
  y,
  isDarkMode,
  readOnly,
  subprogram,
  isSubprogramCollapsed,
  onAddSubprogram,
  onCollapseAll,
  onExpandAll,
  onToggleSubprogram,
  onAddVariable,
  onAddStatement,
  onDeleteSubprogram
}: {
  x: number;
  y: number;
  isDarkMode: boolean;
  readOnly: boolean;
  subprogram?: EplSubprogramBlock;
  isSubprogramCollapsed: boolean;
  onAddSubprogram: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  onToggleSubprogram: () => void;
  onAddVariable: () => void;
  onAddStatement: () => void;
  onDeleteSubprogram: () => void;
}) {
  const menuClass = isDarkMode
    ? 'border-[#3a3a43] bg-[#25252b] text-slate-200 shadow-black/40'
    : 'border-slate-300 bg-white text-slate-800 shadow-slate-400/30';
  const dividerClass = isDarkMode ? 'border-[#3a3a43]' : 'border-slate-200';

  return (
    <div
      role="menu"
      onClick={event => event.stopPropagation()}
      onContextMenu={event => event.preventDefault()}
      className={`fixed z-[120] min-w-56 rounded-[3px] border py-1 text-[12px] shadow-xl ${menuClass}`}
      style={{ left: x, top: y }}
    >
      <ContextMenuButton disabled={readOnly} shortcut="Ctrl+N" onClick={onAddSubprogram}>在当前下方新建子程序</ContextMenuButton>
      <ContextMenuButton onClick={onExpandAll}>展开全部子程序</ContextMenuButton>
      <ContextMenuButton onClick={onCollapseAll}>收缩全部子程序</ContextMenuButton>

      {subprogram && (
        <>
          <div className={`my-1 border-t ${dividerClass}`} />
          <div className={`px-3 py-1 text-[11px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
            {subprogram.name || '未命名子程序'}
          </div>
          <ContextMenuButton onClick={onToggleSubprogram}>
            {isSubprogramCollapsed ? '展开当前子程序' : '收缩当前子程序'}
          </ContextMenuButton>
          <ContextMenuButton disabled={readOnly} shortcut="Ctrl+L" onClick={onAddVariable}>插入局部变量</ContextMenuButton>
          <ContextMenuButton disabled={readOnly} onClick={onAddStatement}>添加语句行</ContextMenuButton>
          <ContextMenuButton danger disabled={readOnly} onClick={onDeleteSubprogram}>删除子程序</ContextMenuButton>
        </>
      )}
    </div>
  );
}

function ContextMenuButton({
  children,
  shortcut,
  disabled = false,
  danger = false,
  onClick
}: {
  children: ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-full items-center justify-between gap-8 px-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
        danger ? 'text-rose-500 hover:bg-rose-500/10' : 'hover:bg-blue-500/15'
      }`}
    >
      <span>{children}</span>
      {shortcut && <span className="text-[10px] opacity-55">{shortcut}</span>}
    </button>
  );
}

function renderHeaderEntry(
  entry: EplHeaderEntry,
  entryIndex: number,
  actions: {
    isDarkMode: boolean;
    readOnly: boolean;
    updateHeaderLine: (entryIndex: number, value: string) => void;
    updateProgramVariable: (entryIndex: number, field: VariableField, value: string | boolean) => void;
    insertProgramVariable: (entryIndex: number) => void;
  }
) {
  if (entry.kind === 'programVariable') {
    return (
      <div key={entry.id}>
        <ProgramVariableTable
          variable={entry.variable}
          focusName={`program-var-name-${entryIndex}`}
          isDarkMode={actions.isDarkMode}
          readOnly={actions.readOnly}
          onUpdate={(field, value) => actions.updateProgramVariable(entryIndex, field, value)}
          onEnterName={() => actions.insertProgramVariable(entryIndex)}
        />
      </div>
    );
  }

  if (parseVolcanoHeaderLine(entry.text)) {
    return null;
  }

  const textTone = getHeaderTone(entry.text);
  return (
    <div key={entry.id} className="flex min-h-6 items-center gap-3">
      <span className={`w-10 shrink-0 text-right text-[11px] ${
        actions.isDarkMode ? 'text-slate-600' : 'text-slate-400'
      }`}>{entry.sourceLine}</span>
      <input
        value={entry.text}
        onChange={event => actions.updateHeaderLine(entryIndex, event.target.value)}
        readOnly={actions.readOnly}
        className={`h-6 min-w-[420px] border-0 bg-transparent px-0 outline-none ${textTone}`}
      />
    </div>
  );
}

function ProgramVariableTable({
  variable,
  focusName,
  isDarkMode,
  readOnly,
  onUpdate,
  onEnterName
}: {
  variable: EplVariableRow;
  focusName: string;
  isDarkMode: boolean;
  readOnly: boolean;
  onUpdate: (field: VariableField, value: string | boolean) => void;
  onEnterName: () => void;
}) {
  const borderClass = isDarkMode ? 'border-[#4a4a4a]' : 'border-slate-300';
  const headerClass = isDarkMode ? 'bg-[#242424] text-[#d8d8d8]' : 'bg-slate-100 text-slate-600';
  const nameHeaderClass = isDarkMode ? 'bg-[#242424] text-[#9df59c]' : 'bg-emerald-50 text-emerald-700';
  const valueClass = isDarkMode ? 'bg-[#242424] text-[#d7e6e4]' : 'bg-white text-slate-850';
  const mutedClass = isDarkMode ? 'bg-[#242424] text-slate-500' : 'bg-white text-slate-500';
  const cppType = getCppTypeForEplType(variable.type);
  const cppMember = `${variable.isStatic ? 'static ' : ''}${cppType} ${toCppIdentifier(variable.name || '未命名变量')}`;
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex items-start">
      <FoldMarker
        isCollapsed={isCollapsed}
        isDarkMode={isDarkMode}
        label={isCollapsed ? '展开程序集变量' : '收缩程序集变量'}
        className="mt-1"
        onToggle={() => setIsCollapsed(value => !value)}
      />
      <div
        className={`inline-grid border border-b-0 border-r-0 ${borderClass}`}
        style={{ gridTemplateColumns: '180px 128px 66px 66px 180px 150px 260px 340px' }}
      >
        <MethodTableLabel className={`${nameHeaderClass} text-[1.0em]`} marker="variable">程序集变量名</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>类型</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>静态</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>参考</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>初始值</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>C++ 类型</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>C++ 成员</MethodTableLabel>
        <MethodTableLabel className={`${headerClass} text-[1.0em]`}>说明</MethodTableLabel>

        {isCollapsed ? (
          <>
            <ReadOnlyTableCell className={`${nameHeaderClass} text-[1.0em]`}>{variable.name || '未命名变量'}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${valueClass} text-[0.9em]`}>{variable.type || '未指定'}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>{variable.isStatic ? '真' : ''}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>{variable.isArray ? '真' : ''}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.9em]`}>已收缩</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${valueClass} text-[0.9em]`}>{cppType}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${valueClass} text-[0.85em]`}>{cppMember};</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.8em]`}>点击左侧 + 展开变量表</ReadOnlyTableCell>
          </>
        ) : (
          <>
            <TextCellInput
              value={variable.name}
              onChange={value => onUpdate('name', value)}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  onEnterName();
                }
              }}
              readOnly={readOnly}
              className={`${valueClass} min-h-10 text-[1.15em] text-[#aeb8ff]`}
              focusName={focusName}
            />
            <EplTypeInput
              value={variable.type}
              onChange={value => onUpdate('type', value)}
              isDarkMode={isDarkMode}
              readOnly={readOnly}
              className={`${valueClass} min-h-10 text-[1.0em]`}
              focusName={`${focusName}-type`}
            />
            <CheckCell
              checked={variable.isStatic}
              isDarkMode={isDarkMode}
              readOnly={readOnly}
              title="静态"
              focusName={`${focusName}-static`}
              onToggle={() => onUpdate('isStatic', !variable.isStatic)}
            />
            <CheckCell
              checked={variable.isArray}
              isDarkMode={isDarkMode}
              readOnly={readOnly}
              title="参考"
              focusName={`${focusName}-array`}
              onToggle={() => onUpdate('isArray', !variable.isArray)}
            />
            <TextCellInput
              value={variable.remark}
              onChange={value => onUpdate('remark', value)}
              readOnly={readOnly}
              className={`${valueClass} min-h-10 text-[1.0em] text-[#6fbf73]`}
              focusName={`${focusName}-initial`}
            />
            <ReadOnlyTableCell className={`${valueClass} text-[0.9em]`}>{cppType}</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${valueClass} text-[0.85em]`}>{cppMember};</ReadOnlyTableCell>
            <ReadOnlyTableCell className={`${mutedClass} text-[0.8em]`}>
              C++ 上可作为窗口程序集类成员；当前生成器只保证事件代码优先解析，通用成员变量生成仍需规则扩展
            </ReadOnlyTableCell>
          </>
        )}
      </div>
    </div>
  );
}

function SubprogramHeader({
  subprogram,
  subprogramIndex,
  isDarkMode,
  readOnly,
  compact = false,
  onUpdate
}: {
  subprogram: EplSubprogramBlock;
  subprogramIndex: number;
  isDarkMode: boolean;
  readOnly: boolean;
  compact?: boolean;
  onUpdate: (subprogramIndex: number, field: SubprogramField, value: string | boolean) => void;
}) {
  const borderClass = isDarkMode ? 'border-[#4a4a4a]' : 'border-slate-300';
  const headerLabelClass = isDarkMode ? 'bg-[#242424] text-[#d8d8d8]' : 'bg-slate-100 text-slate-600';
  const methodLabelClass = isDarkMode ? 'bg-[#242424] text-[#9df59c]' : 'bg-emerald-50 text-emerald-700';
  const valueClass = isDarkMode ? 'bg-[#242424] text-[#d7d7d7]' : 'bg-white text-slate-850';
  const remarkValueClass = isDarkMode ? 'bg-[#242424]' : 'bg-white';
  const mutedValueClass = isDarkMode ? 'bg-[#242424] text-[#35d8d0]' : 'bg-white text-teal-700';

  const getTextWidth = (text: string) => {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      width += text.charCodeAt(i) > 127 ? 15 : 9;
    }
    return width;
  };
  const col1Width = Math.max(180, getTextWidth(subprogram.name) + 24);

  return (
    <div
      className={`inline-grid overflow-visible rounded-[2px] border border-b-0 border-r-0 ${borderClass}`}
      style={{ gridTemplateColumns: `${col1Width}px 64px 136px 120px 136px 136px 240px` }}
    >
      <MethodTableLabel className={`${methodLabelClass} text-[1.15em]`} marker="method">方法名</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>公开</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>类别</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>静态</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>属性名</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>属性值</MethodTableLabel>
      <MethodTableLabel className={headerLabelClass}>备注</MethodTableLabel>

      <MethodNameCellInput
        value={subprogram.name}
        onChange={value => onUpdate(subprogramIndex, 'name', value)}
        readOnly={readOnly}
        className={`${valueClass} min-h-7 text-[1.0em] text-[#aeb8ff]`}
        focusName={`sub-name-${subprogram.id}`}
      />
      <CheckCell
        checked={subprogram.isPublic}
        isDarkMode={isDarkMode}
        readOnly={readOnly}
        title="公开"
        focusName={`sub-public-${subprogram.id}`}
        onToggle={() => onUpdate(subprogramIndex, 'isPublic', !subprogram.isPublic)}
      />
      <ReadOnlyTableCell className={`${mutedValueClass} text-[1.0em]`}>通常</ReadOnlyTableCell>
      <CheckCell
        checked={subprogram.isEasyPackage}
        isDarkMode={isDarkMode}
        readOnly={readOnly}
        title="静态"
        focusName={`sub-easy-${subprogram.id}`}
        onToggle={() => onUpdate(subprogramIndex, 'isEasyPackage', !subprogram.isEasyPackage)}
      />
      <ReadOnlyTableCell className={valueClass} />
      <ReadOnlyTableCell className={valueClass} />
      <TextAreaCellInput
        value={subprogram.remark}
        onChange={value => onUpdate(subprogramIndex, 'remark', value)}
        readOnly={readOnly}
        className={`${remarkValueClass} min-h-11 text-[#6fbf73]`}
        rows={1}
      />

      {!compact && (
        <>
          <ReadOnlyTableCell className={`${methodLabelClass} text-[1.05em]`}>返回值类型：</ReadOnlyTableCell>
          <EplTypeInput
            value={subprogram.returnType}
            onChange={value => onUpdate(subprogramIndex, 'returnType', value || '无')}
            isDarkMode={isDarkMode}
            readOnly={readOnly}
            className={`${mutedValueClass} h-9 text-[1.05em] col-span-2`}
            focusName={`sub-return-${subprogram.id}`}
          />
          <ReadOnlyTableCell className={valueClass} />
          <ReadOnlyTableCell className={`${methodLabelClass} whitespace-nowrap text-[1.05em] col-span-2`}>返回值备注：</ReadOnlyTableCell>
          <TextCellInput
            value={subprogram.returnRemark || ''}
            onChange={value => onUpdate(subprogramIndex, 'returnRemark', value)}
            readOnly={readOnly}
            className={`${valueClass} h-9 text-[1.05em] text-[#6fbf73]`}
            focusName={`sub-return-remark-${subprogram.id}`}
          />
        </>
      )}
    </div>
  );
}

function SubprogramBody({
  subprogram,
  subprogramIndex,
  isDarkMode,
  readOnly,
  collapsedVariableBlockIds,
  programVariables,
  subprogramNames,
  onRememberPosition,
  onOpenContextMenu,
  onToggleVariableBlock,
  onUpdateLocalVariable,
  onInsertLocalVariable,
  onAppendLocalVariable,
  onUpdateStatement,
  onInsertStatement,
  onDeleteEmptyStatement,
  onIndentStatement
}: {
  subprogram: EplSubprogramBlock;
  subprogramIndex: number;
  isDarkMode: boolean;
  readOnly: boolean;
  collapsedVariableBlockIds: Set<string>;
  programVariables: string[];
  subprogramNames: string[];
  onRememberPosition: (position: ActiveEditorPosition) => void;
  onOpenContextMenu: (event: MouseEvent, subprogramIndex?: number, bodyIndex?: number) => void;
  onToggleVariableBlock: (variableBlockId: string) => void;
  onUpdateLocalVariable: (subprogramIndex: number, bodyIndex: number, variableIndex: number, field: VariableField, value: string | boolean) => void;
  onInsertLocalVariable: (subprogramIndex: number, bodyIndex: number, variableIndex: number) => void;
  onAppendLocalVariable: (subprogramIndex: number, bodyIndex: number) => void;
  onUpdateStatement: (subprogramIndex: number, bodyIndex: number, value: string) => void;
  onInsertStatement: (subprogramIndex: number, bodyIndex: number, indent: string) => void;
  onDeleteEmptyStatement: (subprogramIndex: number, bodyIndex: number) => void;
  onIndentStatement: (subprogramIndex: number, bodyIndex: number, direction: 1 | -1) => void;
}) {
  const guideLookup = useMemo(() => buildStatementGuideLookup(subprogram.body), [subprogram.body]);

  const localVars = useMemo(() => {
    return subprogram.body
      .filter((entry) => entry.kind === 'variables')
      .flatMap(entry => entry.variables.map(v => v.name))
      .filter(Boolean);
  }, [subprogram.body]);

  return (
    <div className={`mt-2 rounded-[2px] border p-1 space-y-0.5 ${
      isDarkMode ? 'border-[#2e2e36] bg-[#16161a]' : 'border-slate-300 bg-[#fbfbfb]'
    }`}>
      {subprogram.body.map((entry, bodyIndex) => {
        if (entry.kind === 'variables') {
          return (
            <div
              key={`${entry.id}-${bodyIndex}`}
              className="py-1"
            >
              <VariableTable
                variableBlock={entry}
                subprogramIndex={subprogramIndex}
                bodyIndex={bodyIndex}
                isDarkMode={isDarkMode}
                readOnly={readOnly}
                isCollapsed={collapsedVariableBlockIds.has(entry.id)}
                onFocusBlock={() => onRememberPosition({ subprogramIndex, bodyIndex, kind: 'variableBlock' })}
                onOpenContextMenu={event => onOpenContextMenu(event, subprogramIndex, bodyIndex)}
                onToggle={() => onToggleVariableBlock(entry.id)}
                onUpdate={onUpdateLocalVariable}
                onEnterName={onInsertLocalVariable}
                onAppend={() => onAppendLocalVariable(subprogramIndex, bodyIndex)}
              />
            </div>
          );
        }

        return (
          <div
            key={`${entry.id}-${bodyIndex}`}
            onContextMenu={event => {
              event.stopPropagation();
              onOpenContextMenu(event, subprogramIndex, bodyIndex);
            }}
            className="group py-0.5 hover:bg-blue-500/5 transition-colors"
          >
            <StatementRow
              statement={entry}
              bodyIndex={bodyIndex}
              subprogramIndex={subprogramIndex}
              guides={guideLookup.get(entry.id) || []}
              isDarkMode={isDarkMode}
              readOnly={readOnly}
              localVariables={localVars}
              programVariables={programVariables}
              subprogramNames={subprogramNames}
              onFocus={() => onRememberPosition({ subprogramIndex, bodyIndex, kind: 'statement' })}
              onUpdate={onUpdateStatement}
              onInsert={onInsertStatement}
              onDeleteEmpty={onDeleteEmptyStatement}
              onIndent={onIndentStatement}
            />
          </div>
        );
      })}
    </div>
  );
}

function VariableTable({
  variableBlock,
  subprogramIndex,
  bodyIndex,
  isDarkMode,
  readOnly,
  isCollapsed,
  onFocusBlock,
  onOpenContextMenu,
  onToggle,
  onUpdate,
  onEnterName,
  onAppend
}: {
  variableBlock: EplVariableBlock;
  subprogramIndex: number;
  bodyIndex: number;
  isDarkMode: boolean;
  readOnly: boolean;
  isCollapsed: boolean;
  onFocusBlock: () => void;
  onOpenContextMenu: (event: MouseEvent) => void;
  onToggle: () => void;
  onUpdate: (subprogramIndex: number, bodyIndex: number, variableIndex: number, field: VariableField, value: string | boolean) => void;
  onEnterName: (subprogramIndex: number, bodyIndex: number, variableIndex: number) => void;
  onAppend: () => void;
}) {
  const borderClass = isDarkMode ? 'border-[#4a4a4a]' : 'border-slate-300';
  const headerClass = isDarkMode ? 'bg-[#242424] text-[#d8d8d8]' : 'bg-slate-100 text-slate-600';
  const nameHeaderClass = isDarkMode ? 'bg-[#242424] text-[#9df59c]' : 'bg-emerald-50 text-emerald-700';
  const blockIndentWidth = getVariableBlockIndentWidth(variableBlock.indent);
  const foldGutterWidth = 28;

  return (
    <div
      onFocusCapture={onFocusBlock}
      onMouseDownCapture={onFocusBlock}
      onContextMenu={onOpenContextMenu}
      className="mt-2 flex items-start"
      style={{ marginLeft: Math.max(0, blockIndentWidth - foldGutterWidth) }}
    >
      <FoldMarker
        isCollapsed={isCollapsed}
        isDarkMode={isDarkMode}
        label={isCollapsed ? '展开局部变量块' : '收缩局部变量块'}
        className="mt-1"
        onToggle={onToggle}
      />
      <div>
        {isCollapsed ? (
          <div
            className={`inline-grid border border-b-0 border-r-0 ${borderClass} ${headerClass}`}
            style={{ gridTemplateColumns: '162px 118px 66px 66px 92px 92px 92px 150px' }}
          >
            <MethodTableLabel className={`${nameHeaderClass} text-[1.0em]`} marker="variable">局部变量名</MethodTableLabel>
            <ReadOnlyTableCell className={`${headerClass} text-[11px]`}>{variableBlock.variables.length} 个变量已收缩</ReadOnlyTableCell>
            <ReadOnlyTableCell className={headerClass} />
            <ReadOnlyTableCell className={headerClass} />
            <ReadOnlyTableCell className={headerClass} />
            <ReadOnlyTableCell className={headerClass} />
            <ReadOnlyTableCell className={headerClass} />
            <ReadOnlyTableCell className={headerClass} />
          </div>
        ) : (
        <>
          <div
            className={`inline-grid border border-b-0 border-r-0 ${borderClass} ${headerClass}`}
            style={{ gridTemplateColumns: '162px 118px 66px 66px 92px 92px 92px 150px' }}
          >
            <MethodTableLabel className={`${nameHeaderClass} text-[1.0em]`} marker="variable">局部变量名</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>类型</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>静态</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>参考</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>初始值</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>属性名</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>属性值</MethodTableLabel>
            <MethodTableLabel className={`${headerClass} text-[1.0em]`}>备注</MethodTableLabel>
          </div>
          <div className="space-y-0">
            {variableBlock.variables.map((variable, variableIndex) => (
              <div key={`${variable.id}-${variableIndex}`}>
                <VariableRow
                  variable={variable}
                  focusName={`local-var-name-${subprogramIndex}-${bodyIndex}-${variableIndex}`}
                  isDarkMode={isDarkMode}
                  readOnly={readOnly}
                  onUpdate={(field, value) => onUpdate(subprogramIndex, bodyIndex, variableIndex, field, value)}
                  onEnterName={() => onEnterName(subprogramIndex, bodyIndex, variableIndex)}
                />
              </div>
            ))}
          </div>
        </>
        )}
      </div>
    </div>
  );
}

function VariableRow({
  variable,
  focusName,
  isDarkMode,
  readOnly,
  showScope = false,
  onUpdate,
  onEnterName
}: {
  variable: EplVariableRow;
  focusName: string;
  isDarkMode: boolean;
  readOnly: boolean;
  showScope?: boolean;
  onUpdate: (field: VariableField, value: string | boolean) => void;
  onEnterName: () => void;
}) {
  const borderClass = isDarkMode ? 'border-[#4a4a4a]' : 'border-slate-300';
  const emptyClass = isDarkMode ? 'bg-[#242424] text-slate-500' : 'bg-white text-slate-400';
  const valueClass = isDarkMode ? 'bg-[#242424] text-[#d7e6e4]' : 'bg-white text-slate-850';
  const remarkValueClass = isDarkMode ? 'bg-[#242424]' : 'bg-white';
  const rowFocusName = showScope ? focusName : `${focusName}`;

  return (
    <div
      className={`inline-grid border border-r-0 border-t-0 ${borderClass}`}
      style={{ gridTemplateColumns: '162px 118px 66px 66px 92px 92px 92px 150px' }}
    >
      <TextCellInput
        value={variable.name}
        onChange={value => onUpdate('name', value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnterName();
          }
        }}
        readOnly={readOnly}
        className={`${valueClass} min-h-10 text-[1.15em] text-[#aeb8ff]`}
        focusName={rowFocusName}
      />
      <EplTypeInput
        value={variable.type}
        onChange={value => onUpdate('type', value)}
        isDarkMode={isDarkMode}
        readOnly={readOnly}
        className={`${valueClass} min-h-10 text-[1.0em]`}
        focusName={`${rowFocusName}-type`}
      />
      <CheckCell
        checked={variable.isStatic}
        isDarkMode={isDarkMode}
        readOnly={readOnly}
        title="静态"
        focusName={`${rowFocusName}-static`}
        onToggle={() => onUpdate('isStatic', !variable.isStatic)}
      />
      <CheckCell
        checked={variable.isArray}
        isDarkMode={isDarkMode}
        readOnly={readOnly}
        title="参考"
        focusName={`${rowFocusName}-array`}
        onToggle={() => onUpdate('isArray', !variable.isArray)}
      />
      <ReadOnlyTableCell className={emptyClass} />
      <ReadOnlyTableCell className={emptyClass} />
      <ReadOnlyTableCell className={emptyClass} />
      <TextAreaCellInput
        value={variable.remark}
        onChange={value => onUpdate('remark', value)}
        readOnly={readOnly}
        className={`${remarkValueClass} min-h-10 text-[#6fbf73]`}
      />
    </div>
  );
}

function StatementRow({
  statement,
  bodyIndex,
  subprogramIndex,
  guides,
  isDarkMode,
  readOnly,
  localVariables,
  programVariables,
  subprogramNames,
  onFocus,
  onUpdate,
  onInsert,
  onDeleteEmpty,
  onIndent
}: {
  statement: EplStatementEntry;
  bodyIndex: number;
  subprogramIndex: number;
  guides: number[];
  isDarkMode: boolean;
  readOnly: boolean;
  localVariables: string[];
  programVariables: string[];
  subprogramNames: string[];
  onFocus: () => void;
  onUpdate: (subprogramIndex: number, bodyIndex: number, value: string) => void;
  onInsert: (subprogramIndex: number, bodyIndex: number, indent: string) => void;
  onDeleteEmpty: (subprogramIndex: number, bodyIndex: number) => void;
  onIndent: (subprogramIndex: number, bodyIndex: number, direction: 1 | -1) => void;
}) {
  const tone = getStatementTone(statement.text, isDarkMode);
  const indentWidth = getBodyIndentWidth(statement.indent);

  return (
    <div className="relative flex h-7 items-center">
      <div className="relative h-full w-16 shrink-0">
        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-[11px] ${
          isDarkMode ? 'text-slate-600' : 'text-slate-400'
        }`}>{statement.sourceLine || ''}</span>
      </div>
      <div style={{ width: indentWidth }} className="relative h-full shrink-0">
        {guides.map((colorIndex, depth) => {
          const color = EPL_FLOW_GUIDE_COLORS[colorIndex % EPL_FLOW_GUIDE_COLORS.length];
          const maxDepth = Math.floor(indentWidth / 22);
          const isParent = depth === maxDepth - 1;
          const kind = getFlowControlKind(statement.text);

          if (isParent) {
            return (
              <Fragment key={`${statement.id}-${depth}`}>
                <span
                  className="absolute"
                  style={{
                    left: `${depth * 22 + 10}px`,
                    top: 0,
                    bottom: kind === 'end' ? '50%' : 0,
                    width: '2px',
                    backgroundColor: color,
                    boxShadow: `0 0 5px ${color}44`
                  }}
                />
                <span
                  className="absolute"
                  style={{
                    left: `${depth * 22 + 10}px`,
                    right: 0,
                    top: '50%',
                    height: '2px',
                    backgroundColor: color,
                    transform: 'translateY(-50%)',
                    boxShadow: `0 0 5px ${color}44`
                  }}
                />
                <span
                  className="absolute rounded-full"
                  style={{
                    left: `${depth * 22 + 8}px`,
                    top: '50%',
                    width: '6px',
                    height: '6px',
                    transform: 'translateY(-50%)',
                    backgroundColor: color,
                    boxShadow: `0 0 7px ${color}`
                  }}
                />
              </Fragment>
            );
          } else if (depth < maxDepth) {
            return (
              <span
                key={`${statement.id}-${depth}`}
                className="absolute top-0 bottom-0"
                style={{
                  left: `${depth * 22 + 10}px`,
                  width: '2px',
                  backgroundColor: color,
                  boxShadow: `0 0 5px ${color}44`
                }}
              />
            );
          }
          return null;
        })}
      </div>
      <StatementAutocompleteInput
        value={statement.text}
        onChange={value => onUpdate(subprogramIndex, bodyIndex, value)}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onInsert(subprogramIndex, bodyIndex, statement.indent);
          }
          if ((event.key === 'Delete' || event.key === 'Backspace') && !statement.text.trim()) {
            event.preventDefault();
            onDeleteEmpty(subprogramIndex, bodyIndex);
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            onIndent(subprogramIndex, bodyIndex, event.shiftKey ? -1 : 1);
          }
        }}
        readOnly={readOnly}
        focusName={`stmt-${subprogramIndex}-${bodyIndex}`}
        className={`h-7 min-w-[640px] flex-1 border-0 bg-transparent px-1 outline-none ${tone}`}
        localVariables={localVariables}
        programVariables={programVariables}
        subprogramNames={subprogramNames}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}

const EPL_AUTOCOMPLETE_KEYWORDS = [
  { label: '如果', category: '流程控制', desc: '如果 (条件) ... 否则 ... 如果结束', aliases: ['rg', 'ruguo', 'if'] },
  { label: '如果真', category: '流程控制', desc: '如果真 (条件) ... 如果真结束', aliases: ['rgz', 'ruguozhen', 'iftrue'] },
  { label: '否则', category: '流程控制', desc: '如果/判断结构中的否则分支', aliases: ['fz', 'fouze', 'else'] },
  { label: '否则如果', category: '流程控制', desc: '否则如果 (条件)', aliases: ['fzrg', 'fouzeruguo', 'elseif'] },
  { label: '如果结束', category: '流程控制', desc: '结束如果/如果真块', aliases: ['rgjs', 'ruguojieshu', 'endif'] },
  { label: '判断', category: '流程控制', desc: '多路分支判断结构', aliases: ['pd', 'panduan', 'switch'] },
  { label: '判断结束', category: '流程控制', desc: '结束判断块', aliases: ['pdjs', 'panduanjieshu', 'endswitch'] },
  { label: '判断循环首', category: '流程控制', desc: '判断循环首 (条件) ... 判断循环尾 ()', aliases: ['pdxhs', 'panduanxunhuanshou', 'while'] },
  { label: '判断循环尾', category: '流程控制', desc: '判断循环的尾部', aliases: ['pdxhw', 'panduanxunhuanwei', 'endwhile'] },
  { label: '循环判断首', category: '流程控制', desc: '循环判断首 () ... 循环判断尾 (条件)', aliases: ['xhpds', 'xunhuanpanduanshou', 'do'] },
  { label: '循环判断尾', category: '流程控制', desc: '循环判断的尾部', aliases: ['xhpdw', 'xunhuanpanduanwei', 'loop'] },
  { label: '计次循环首', category: '流程控制', desc: '计次循环首 (循环次数, [已循环次数变量])', aliases: ['jcxhs', 'jicixunhuanshou', 'for'] },
  { label: '计次循环尾', category: '流程控制', desc: '计次循环的尾部', aliases: ['jcxhw', 'jicixunhuanwei', 'endfor'] },
  { label: '变量循环首', category: '流程控制', desc: '变量循环首 (起始值, 目标值, 递增值, 循环变量)', aliases: ['blxhs', 'bianliangxunhuanshou'] },
  { label: '变量循环尾', category: '流程控制', desc: '变量循环的尾部', aliases: ['blxhw', 'bianliangxunhuanwei'] },
  { label: '返回', category: '基本命令', desc: '从子程序返回一个值', aliases: ['fh', 'fanhui', 'return'] },
  { label: '结束', category: '基本命令', desc: '结束程序运行', aliases: ['js', 'jieshu', 'exit', 'end'] },
  { label: '跳出循环', category: '流程控制', desc: '跳出当前循环体 (break)', aliases: ['tc', 'tiaochu', 'break'] },
  { label: '到循环尾', category: '流程控制', desc: '跳转到当前循环的尾部 (continue)', aliases: ['dxhw', 'daoxunhuanwei', 'continue'] },
  { label: '尝试', category: '流程控制', desc: '尝试捕获错误 (try)', aliases: ['cs', 'changshi', 'try'] },
  { label: '捕获', category: '流程控制', desc: '捕获并处理错误 (catch)', aliases: ['bh', 'buhuo', 'catch'] },
  { label: '信息框', category: '系统命令', desc: '信息框 (提示信息, 按钮及图标类型, [窗口标题])', aliases: ['xxk', 'xinxikuang', 'msgbox', 'messagebox'] },
  { label: '调试输出', category: '系统命令', desc: '在调试窗口输出一行为文本', aliases: ['tssc', 'tiaoshishuchu', 'trace', 'print'] },
  { label: '输出调试文本', category: '系统命令', desc: '输出调试文本 (内容)', aliases: ['sctswb', 'shuchutiaoshiwenben', 'log'] },
  { label: '载入可视化设计', category: '系统命令', desc: '载入可视化设计 (关联设计文件)', aliases: ['zrkshsj', 'zairukeshihuasheji', 'loadlayout'] },
  { label: '读取配置项', category: '文件命令', desc: '读取配置项 (配置文件名, 节点名, 项名)', aliases: ['dqpzx', 'duqupeizhixiang', 'getconfig'] },
  { label: '取运行目录', category: '系统命令', desc: '获取当前程序运行的目录路径', aliases: ['qyxml', 'quyunxingmulu', 'getapppath'] }
];

function getAutocompleteQuery(text: string, cursorPosition: number): string {
  const sub = text.slice(0, cursorPosition);
  const match = sub.match(/[\u4e00-\u9fa5\w\d_.]+$/);
  return match ? match[0] : '';
}

function getFlowControlKind(text: string): 'start' | 'end' | 'middle' | 'none' {
  const body = text.trim();
  if (/^\.?(如果真|如果|判断循环首|循环判断首|计次循环首|变量循环首|判断)(?:\s|$|[（(])/.test(body)) {
    return 'start';
  }
  if (/^\.?(如果结束|判断结束|判断循环尾|循环判断尾|计次循环尾|变量循环尾)(?:\s|$|[（(])/.test(body)) {
    return 'end';
  }
  if (/^\.?(否则如果|否则)(?:\s|$|[（(])/.test(body)) {
    return 'middle';
  }
  return 'none';
}

function StatementAutocompleteInput({
  value,
  onChange,
  onKeyDown,
  readOnly,
  focusName,
  className,
  localVariables,
  programVariables,
  subprogramNames,
  isDarkMode
}: {
  value: string;
  onChange: (value: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  readOnly: boolean;
  focusName?: string;
  className?: string;
  localVariables: string[];
  programVariables: string[];
  subprogramNames: string[];
  isDarkMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const query = useMemo(() => {
    return getAutocompleteQuery(value, cursorPos);
  }, [value, cursorPos]);

  const suggestions = useMemo(() => {
    if (!open || !query) return [];

    const list = [];

    localVariables.forEach(name => {
      list.push({ label: name, category: '局部变量' });
    });

    programVariables.forEach(name => {
      list.push({ label: name, category: '程序集变量' });
    });

    subprogramNames.forEach(name => {
      list.push({ label: name, category: '子程序' });
    });

    EPL_AUTOCOMPLETE_KEYWORDS.forEach(kw => {
      list.push(kw);
    });

    const normQuery = query.toLowerCase();
    return list
      .filter(item => {
        const label = item.label.toLowerCase();
        const aliases = item.aliases || [];
        return label.includes(normQuery) || aliases.some(alias => alias.toLowerCase().includes(normQuery));
      })
      .slice(0, 10);
  }, [open, query, localVariables, programVariables, subprogramNames]);

  const handleSelectSuggestion = (suggestion) => {
    const input = inputRef.current;
    if (!input) return;

    const cursor = input.selectionStart ?? value.length;
    const sub = value.slice(0, cursor);
    const match = sub.match(/[\u4e00-\u9fa5\w\d_.]+$/);
    
    const needsParens = ['信息框', '调试输出', '输出调试文本', '如果', '如果真', '判断', '判断循环首', '循环判断首', '计次循环首', '变量循环首', '读取配置项'].includes(suggestion);
    const insertText = needsParens ? suggestion + ' ()' : suggestion;

    let newValue = value;
    let newCursor = cursor;

    if (match) {
      const startPos = cursor - match[0].length;
      newValue = value.slice(0, startPos) + insertText + value.slice(cursor);
      newCursor = startPos + suggestion.length + (needsParens ? 2 : 0);
    } else {
      newValue = value.slice(0, cursor) + insertText + value.slice(cursor);
      newCursor = cursor + suggestion.length + (needsParens ? 2 : 0);
    }

    onChange(newValue);
    setOpen(false);

    window.requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(newCursor, newCursor);
    });
  };

  const handleInputKeyDown = (event) => {
    if (open && suggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(index => Math.max(index - 1, 0));
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex].label);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setOpen(false);
        return;
      }
    }

    onKeyDown(event);
  };

  const updateCursor = () => {
    if (inputRef.current) {
      setCursorPos(inputRef.current.selectionStart ?? 0);
    }
  };

  return (
    <div className="relative flex min-w-0 flex-1 items-stretch">
      <input
        ref={inputRef}
        value={value}
        onChange={event => {
          onChange(event.target.value);
          setOpen(true);
          setActiveIndex(0);
          window.requestAnimationFrame(updateCursor);
        }}
        onFocus={() => {
          setOpen(true);
          window.requestAnimationFrame(updateCursor);
        }}
        onBlur={() => {
          window.setTimeout(() => setOpen(false), 150);
        }}
        onClick={updateCursor}
        onKeyUp={updateCursor}
        onKeyDown={(event) => {
          if (event.ctrlKey && event.key === '/') {
            event.preventDefault();
            const currentText = value.trim();
            let nextValue = value;
            if (currentText.startsWith('//')) {
              nextValue = value.replace(/^\s*\/\/\s*/, '');
            } else if (currentText.startsWith("'")) {
              nextValue = value.replace(/^\s*'\s*/, '');
            } else {
              const match = value.match(/^\s*/);
              const indent = match ? match[0] : '';
              nextValue = `${indent}// ${value.trim()}`;
            }
            onChange(nextValue);
            return;
          }
          handleInputKeyDown(event);
        }}
        readOnly={readOnly}
        data-epl-focus={focusName}
        style={{ fontSize: 'var(--editor-font-size)' }}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className={`absolute left-2 top-full z-50 w-80 rounded-[2px] border py-1 shadow-xl max-h-60 overflow-y-auto ${
          isDarkMode ? 'border-[#3a3a43] bg-[#24242b] text-slate-200' : 'border-slate-300 bg-white text-slate-800'
        }`}>
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.category}-${suggestion.label}`}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                handleSelectSuggestion(suggestion.label);
              }}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] border-b border-dashed border-slate-700/10 last:border-b-0 ${
                index === activeIndex 
                  ? (isDarkMode ? 'bg-[#3b3b4a] text-blue-400' : 'bg-blue-50 text-blue-700') 
                  : (isDarkMode ? 'hover:bg-[#2b2b33]' : 'hover:bg-slate-550')
              }`}
            >
              <span className={`px-1 rounded-[2px] text-[10px] font-semibold tracking-wide shrink-0 ${
                suggestion.category === '流程控制'
                  ? 'bg-blue-500/20 text-blue-400'
                  : suggestion.category === '系统命令' || suggestion.category === '基本命令'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : suggestion.category === '局部变量'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-amber-500/20 text-amber-400'
              }`}>
                {suggestion.category}
              </span>
              <span className="font-semibold">{suggestion.label}</span>
              {suggestion.desc && (
                <span className="ml-auto text-[10px] text-slate-500 truncate max-w-[140px]">
                  {suggestion.desc}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MethodNameCellInput({
  value,
  onChange,
  readOnly,
  className,
  focusName,
  onKeyDown
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  className: string;
  focusName?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`flex min-w-0 items-stretch border-b border-r border-inherit ${className}`}>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        readOnly={readOnly}
        data-epl-focus={focusName}
        style={{ fontSize: 'var(--editor-font-size)' }}
        className="h-full w-full border-0 bg-transparent px-2 text-inherit outline-none focus:bg-blue-500/10"
      />
    </div>
  );
}

function TextCellInput({
  value,
  onChange,
  readOnly,
  className,
  focusName,
  onKeyDown
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  className: string;
  focusName?: string;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`flex min-w-0 items-stretch border-b border-r border-inherit ${className}`}>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        readOnly={readOnly}
        onKeyDown={onKeyDown}
        data-epl-focus={focusName}
        style={{ fontSize: 'var(--editor-font-size)' }}
        className="min-h-7 w-full border-0 bg-transparent px-2 text-inherit outline-none focus:bg-blue-500/10"
      />
    </div>
  );
}

function TextAreaCellInput({
  value,
  onChange,
  readOnly,
  className,
  focusName,
  rows = 2
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  className: string;
  focusName?: string;
  rows?: number;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <div className={`flex min-w-0 items-stretch border-b border-r border-inherit ${className}`}>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={event => onChange(event.target.value)}
        readOnly={readOnly}
        data-epl-focus={focusName}
        rows={rows}
        style={{ fontSize: 'var(--editor-font-size)' }}
        className="min-h-12 w-full resize-none overflow-hidden border-0 bg-transparent px-2 py-1 text-inherit leading-5 outline-none focus:bg-blue-500/10"
      />
    </div>
  );
}

function EplTypeInput({
  value,
  onChange,
  isDarkMode,
  readOnly,
  className,
  focusName
}: {
  value: string;
  onChange: (value: string) => void;
  isDarkMode: boolean;
  readOnly: boolean;
  className: string;
  focusName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [localValue, setLocalValue] = useState(value);
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalValue(value);
    }
  }, [value]);

  const suggestions = useMemo(() => getEplTypeSuggestions(localValue), [localValue]);

  const choose = (nextValue: string) => {
    setLocalValue(nextValue);
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <div className={`relative flex min-w-0 items-stretch border-b border-r border-inherit ${className}`}>
      <input
        value={localValue}
        onChange={event => {
          const val = event.target.value;
          setLocalValue(val);
          onChange(val);
          setOpen(true);
          setActiveIndex(0);
        }}
        onFocus={() => {
          isFocused.current = true;
          setOpen(true);
        }}
        onBlur={() => {
          isFocused.current = false;
          window.setTimeout(() => {
            setOpen(false);
            setLocalValue(value);
          }, 120);
        }}
        onKeyDown={event => {
          if (!open || suggestions.length === 0) return;
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            setActiveIndex(index => Math.min(index + 1, suggestions.length - 1));
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActiveIndex(index => Math.max(index - 1, 0));
          } else if (event.key === 'Enter') {
            event.preventDefault();
            choose(suggestions[activeIndex]?.label || localValue);
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        readOnly={readOnly}
        data-epl-focus={focusName}
        style={{ fontSize: 'var(--editor-font-size)' }}
        className="min-h-7 w-full border-0 bg-transparent px-2 font-semibold text-inherit outline-none focus:bg-blue-500/10"
      />
      {open && !readOnly && suggestions.length > 0 && (
        <div className={`absolute left-0 top-full z-50 w-64 rounded-[2px] border py-1 shadow-xl ${
          isDarkMode ? 'border-[#3a3a43] bg-[#f8f8f8] text-slate-900' : 'border-slate-300 bg-white text-slate-900'
        }`}>
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.category}-${suggestion.label}`}
              type="button"
              onMouseDown={event => {
                event.preventDefault();
                choose(suggestion.label);
              }}
              className={`flex h-7 w-full items-center gap-2 px-2 text-left text-[0.8em] ${
                index === activeIndex ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100'
              }`}
            >
              <span className={`h-4 w-1 rounded-sm ${
                suggestion.category === '基础类型'
                  ? 'bg-emerald-500'
                  : suggestion.category === '窗口组件'
                    ? 'bg-blue-500'
                    : 'bg-fuchsia-500'
              }`} />
              <span className="font-semibold">{suggestion.label}</span>
              <span className="ml-auto text-[11px] text-slate-500">{suggestion.category}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LabelCell({ children, className }: { children: string; className: string }) {
  return (
    <div className={`flex h-7 items-center border-r border-inherit px-2 text-[11px] font-semibold ${className}`}>
      {children}
    </div>
  );
}

function FoldMarker({
  isCollapsed,
  isDarkMode,
  label,
  className = '',
  onToggle
}: {
  isCollapsed: boolean;
  isDarkMode: boolean;
  label: string;
  className?: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-expanded={!isCollapsed}
      onClick={event => {
        event.stopPropagation();
        onToggle();
      }}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[2px] text-[1.0em] leading-none transition-colors ${
        isDarkMode
          ? 'text-slate-300 hover:bg-[#30303a] hover:text-white'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
      } ${className}`}
    >
      {isCollapsed ? '+' : '-'}
    </button>
  );
}

function MethodTableLabel({
  children,
  className,
  marker
}: {
  children: string;
  className: string;
  marker?: 'method' | 'variable';
}) {
  return (
    <div className={`flex min-h-9 items-center gap-1 border-b border-r border-inherit px-2 ${className}`}>
      {marker && (
        <span
          className={`h-2 w-2 shrink-0 rotate-45 rounded-[1px] ${
            marker === 'method' ? 'bg-[#d6a2ff]' : 'bg-[#6db8ff]'
          }`}
        />
      )}
      <span>{children}</span>
    </div>
  );
}

function ReadOnlyTableCell({
  children = '',
  className
}: {
  children?: ReactNode;
  className: string;
}) {
  return (
    <div className={`flex min-h-9 items-center border-b border-r border-inherit px-2 ${className}`}>
      {children}
    </div>
  );
}

function CheckCell({
  checked,
  isDarkMode,
  readOnly,
  title,
  focusName,
  onToggle
}: {
  checked: boolean;
  isDarkMode: boolean;
  readOnly: boolean;
  title: string;
  focusName?: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-stretch border-b border-r border-inherit">
      <button
        type="button"
        onClick={onToggle}
        disabled={readOnly}
        title={title}
        aria-label={title}
        aria-pressed={checked}
        data-epl-focus={focusName}
        className={`flex h-full min-h-7 w-full items-center justify-center transition-colors disabled:cursor-not-allowed ${
          isDarkMode ? 'bg-[#1e1e22] hover:bg-[#292933]' : 'bg-white hover:bg-slate-100'
        }`}
      >
        {checked && <Check className="h-4 w-4 text-[#d7d7d7]" />}
      </button>
    </div>
  );
}

function buildStatementGuideLookup(body: EplSubprogramEntry[]): Map<string, number[]> {
  const statements = body.filter((entry): entry is EplStatementEntry => entry.kind === 'statement');
  const guides = buildEplStatementGuides(statements);
  return new Map(statements.map((statement, index) => [statement.id, guides[index] || []]));
}

function getBodyIndentWidth(indent: string): number {
  return Math.min(160, Math.floor(indent.length / 4) * 22);
}

function getVariableBlockIndentWidth(indent: string): number {
  return 64 + getBodyIndentWidth(indent || '    ');
}

function getStatementFocusAfterRemoval(
  subprogram: EplSubprogramBlock,
  subprogramIndex: number,
  removedBodyIndex: number
): string {
  for (let index = removedBodyIndex + 1; index < subprogram.body.length; index += 1) {
    if (subprogram.body[index]?.kind === 'statement') {
      return `stmt-${subprogramIndex}-${index - 1}`;
    }
  }

  for (let index = removedBodyIndex - 1; index >= 0; index -= 1) {
    if (subprogram.body[index]?.kind === 'statement') {
      return `stmt-${subprogramIndex}-${index}`;
    }
  }

  return `sub-name-${subprogram.id}`;
}

function getSubprogramSummary(subprogram: EplSubprogramBlock): {
  variableCount: number;
  variableBlockCount: number;
  statementCount: number;
} {
  return {
    variableCount: getEplSubprogramVariables(subprogram).length,
    variableBlockCount: subprogram.body.filter(entry => entry.kind === 'variables').length,
    statementCount: getEplSubprogramStatements(subprogram).filter(statement => statement.text.trim()).length
  };
}

function getHeaderTone(text: string): string {
  const body = text.trim();
  if (body.startsWith('.程序集')) return 'text-[#ff4fda] font-semibold';
  if (body.startsWith('.支持库')) return 'text-[#d7d7d7]';
  if (body.startsWith('.版本')) return 'text-[#8f8f8f]';
  if (body.startsWith("'")) return 'text-[#4aa34a]';
  return 'text-[#d7d7d7]';
}

function getStatementTone(text: string, isDarkMode: boolean): string {
  const body = text.trim();
  if (!body) return isDarkMode ? 'text-slate-500' : 'text-slate-400';
  if (body.startsWith("'")) return 'text-[#4aa34a]';
  if (/^\.?(如果|如果真|如果结束|判断|判断结束|循环判断首|循环判断尾|判断循环首|判断循环尾)/.test(body)) return 'text-[#4ea5ff] font-semibold';
  if (/^(信息框|调试输出|输出调试文本|载入可视化设计|读取配置项|取运行目录|结束|返回)/.test(body)) return 'text-[#e9dfaa]';
  return isDarkMode ? 'text-[#d7d7d7]' : 'text-slate-800';
}
