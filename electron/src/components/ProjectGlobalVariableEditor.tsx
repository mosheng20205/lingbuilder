import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import { applyWorkspaceEditToFiles } from '../services/lingCpp/aiEditService';
import { buildBeginnerTypeCompletionCatalog, resolveBeginnerTypeAlias } from '../services/lingCpp/beginnerTypeCompletion';
import { LING_CPP_TYPES, parseLingCpp } from '../services/lingCpp/parser';
import { getLingCppCommentTokenColor } from '../services/lingCpp/semanticTheme';
import { PROJECT_CONSTANT_TYPES, getProjectGlobalDiagnostics } from '../services/lingCpp/projectGlobalService';
import {
  createProjectConstantRenameProposal,
  findProjectConstantReferences,
  type ProjectConstantReference
} from '../services/lingCpp/projectConstantReferenceService';
import type {
  LingCppAstEdit,
  LingCppConstant,
  LingCppGlobalVariable,
  LingCppProjectTypeContext,
  LingCppWorkspaceFile
} from '../services/lingCpp/types';
import { executeProjectGlobalVariableCommand, ProjectGlobalVariableCommandId } from '../services/lingCpp/projectGlobalCommandService';
import {
  BEGINNER_TABLE_MIN_COLUMN_WIDTH,
  readBeginnerTableColumnWidthOverrides,
  resolveProjectTableRenderWidths,
  writeBeginnerTableColumnWidths,
  type BeginnerTableColumnWidthOverrides,
  type BeginnerTableKey
} from '../services/editor/beginnerTableColumnWidths';
import { LingCppModuleContext } from '../services/modules/types';
import SearchableTypeSelect from './SearchableTypeSelect';

interface ProjectGlobalVariableEditorProps {
  sourceCode: string;
  filePath?: string;
  moduleContext?: LingCppModuleContext;
  projectSources?: LingCppWorkspaceFile[];
  projectTypes?: LingCppProjectTypeContext;
  isDarkMode: boolean;
  readOnly?: boolean;
  onChange: (sourceCode: string) => void;
  onProjectSourcesChange?: (sources: Array<{ filePath: string; sourceCode: string }>) => void;
  focusConstantName?: string;
}

interface NewGlobalDraft { name: string; type: string; initialValue: string; isArray: boolean; note: string }
interface NewConstantDraft { name: string; type: string; initialValue: string; note: string }

const EMPTY_GLOBAL_DRAFT: NewGlobalDraft = { name: '', type: '文本型', initialValue: '', isArray: false, note: '' };
const EMPTY_CONSTANT_DRAFT: NewConstantDraft = { name: '', type: '整数型', initialValue: '', note: '' };

export default function ProjectGlobalVariableEditor({
  sourceCode,
  filePath,
  moduleContext,
  projectSources = [],
  projectTypes,
  isDarkMode,
  readOnly,
  onChange,
  onProjectSourcesChange,
  focusConstantName
}: ProjectGlobalVariableEditorProps) {
  const [activeTab, setActiveTab] = useState<'globals' | 'constants'>(focusConstantName ? 'constants' : 'globals');
  const [globalDraft, setGlobalDraft] = useState<NewGlobalDraft>(EMPTY_GLOBAL_DRAFT);
  const [constantDraft, setConstantDraft] = useState<NewConstantDraft>(EMPTY_CONSTANT_DRAFT);
  const [feedback, setFeedback] = useState('');
  const [references, setReferences] = useState<ProjectConstantReference[]>([]);
  const [tableColumnWidthOverrides, setTableColumnWidthOverrides] = useState<BeginnerTableColumnWidthOverrides>(
    () => readBeginnerTableColumnWidthOverrides()
  );
  const tableColumnWidthOverridesRef = useRef(tableColumnWidthOverrides);
  tableColumnWidthOverridesRef.current = tableColumnWidthOverrides;

  const setTableColumnWidthOverride = useCallback((tableKey: BeginnerTableKey, columnIndex: number, width: number | null) => {
    const current = tableColumnWidthOverridesRef.current;
    const columns = [...(current[tableKey] || [])];
    if (width === null) {
      if (columnIndex >= columns.length) return;
      columns[columnIndex] = 0;
    } else {
      columns[columnIndex] = Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round(width));
    }
    const next: BeginnerTableColumnWidthOverrides = { ...current, [tableKey]: columns };
    tableColumnWidthOverridesRef.current = next;
    setTableColumnWidthOverrides(next);
  }, []);

  const persistTableColumnWidthOverrides = useCallback(() => {
    writeBeginnerTableColumnWidths(tableColumnWidthOverridesRef.current);
  }, []);

  const beginTableColumnResize = useCallback((event: ReactPointerEvent<HTMLSpanElement>, tableKey: BeginnerTableKey, columnIndex: number, startWidth: number) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const previousBodyCursor = document.body.style.cursor;
    const previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const handleMove = (moveEvent: PointerEvent) => {
      setTableColumnWidthOverride(tableKey, columnIndex, startWidth + moveEvent.clientX - startX);
    };
    const stop = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = previousBodyCursor;
      document.body.style.userSelect = previousBodyUserSelect;
      persistTableColumnWidthOverrides();
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }, [persistTableColumnWidthOverrides, setTableColumnWidthOverride]);

  const resetTableColumnWidth = useCallback((tableKey: BeginnerTableKey, columnIndex: number) => {
    setTableColumnWidthOverride(tableKey, columnIndex, null);
    persistTableColumnWidthOverrides();
  }, [persistTableColumnWidthOverrides, setTableColumnWidthOverride]);

  // 表格滚动容器的实时内容宽度：弹性列按它分摊宽度，固定列（数组/操作）永不参与拉伸。
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [tableContainerWidth, setTableContainerWidth] = useState(0);
  useEffect(() => {
    const node = tableScrollRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[entries.length - 1];
      if (entry) setTableContainerWidth(Math.max(0, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // 渲染列宽：固定列（数组/操作）恒为默认宽度；弹性列按持久化权重 + 容器宽度分摊。
  const globalTableWidths = resolveProjectTableRenderWidths(
    PROJECT_GLOBAL_TABLE_DEFAULT_WIDTHS,
    PROJECT_GLOBAL_FIXED_COLUMN_INDEXES,
    PROJECT_GLOBAL_FLEX_COLUMN_INDEXES,
    tableColumnWidthOverrides['project-globals'],
    tableContainerWidth
  );
  const constantTableWidths = resolveProjectTableRenderWidths(
    PROJECT_CONSTANT_TABLE_DEFAULT_WIDTHS,
    PROJECT_CONSTANT_FIXED_COLUMN_INDEXES,
    PROJECT_CONSTANT_FLEX_COLUMN_INDEXES,
    tableColumnWidthOverrides['project-constants'],
    tableContainerWidth
  );
  useEffect(() => {
    if (focusConstantName) setActiveTab('constants');
  }, [focusConstantName]);
  useEffect(() => {
    const handleCommand = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (!action) return;
      setActiveTab('constants');
      setReferences([]);
      const guidance: Record<string, string> = {
        add: '请填写末尾新增行的名称、类型和常量值。',
        update: '请直接编辑目标常量所在行，失焦后会校验并写回。',
        delete: '请使用目标常量行的删除按钮；存在引用时会阻止删除。',
        rename: '请修改目标常量名称，确认预览后会原子更新全部引用。',
        findReferences: '请使用目标常量行的“引用”按钮查看引用位置。'
      };
      setFeedback(guidance[action] || '已打开项目常量。');
      if (action === 'add') window.requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-project-constant-add-name]')?.focus());
    };
    window.addEventListener('lingcpp-project-constant-command', handleCommand);
    return () => window.removeEventListener('lingcpp-project-constant-command', handleCommand);
  }, []);
  const parsed = useMemo(() => parseLingCpp(sourceCode), [sourceCode]);
  const diagnostics = useMemo(() => getProjectGlobalDiagnostics(sourceCode, filePath, moduleContext, projectTypes?.dataTypes.map(dataType => dataType.name)), [filePath, moduleContext, projectTypes, sourceCode]);
  const globalTypeCatalog = useMemo(() => buildBeginnerTypeCompletionCatalog([
    ...LING_CPP_TYPES,
    ...(projectTypes?.dataTypes || []).map(dataType => dataType.name),
    ...(moduleContext?.enabledModules || []).flatMap(module => (module.manifest.contributes?.types || []).map(type => type.name))
  ]).filter(item => item.label !== '空'), [moduleContext, projectTypes]);
  const constantTypeCatalog = useMemo(() => buildBeginnerTypeCompletionCatalog([...PROJECT_CONSTANT_TYPES]), []);
  const effectiveWorkspaceFiles = useMemo(() => {
    const normalizedPath = filePath?.replace(/\\/gu, '/');
    const files = projectSources.filter(file => file.language === 'lingcpp' || file.filePath.toLocaleLowerCase().endsWith('.lcpp'));
    if (!normalizedPath) return files;
    return files.some(file => file.filePath.replace(/\\/gu, '/') === normalizedPath)
      ? files.map(file => file.filePath.replace(/\\/gu, '/') === normalizedPath ? { ...file, sourceCode } : file)
      : [...files, { filePath: normalizedPath, sourceCode, language: 'lingcpp' }];
  }, [filePath, projectSources, sourceCode]);

  const runEdit = (edit: LingCppAstEdit) => {
    if (readOnly) return false;
    const commandId = commandForEdit(edit);
    const result = executeProjectGlobalVariableCommand(commandId, sourceCode, edit);
    if (!result.success) {
      setFeedback(result.error || result.diagnostics[0]?.message || '项目符号修改失败，源码未改变。');
      return false;
    }
    const blockingDiagnostic = getProjectGlobalDiagnostics(result.sourceCode, filePath, moduleContext, projectTypes?.dataTypes.map(dataType => dataType.name)).find(diagnostic => diagnostic.level === 'error');
    if (blockingDiagnostic) {
      setFeedback(blockingDiagnostic.message);
      return false;
    }
    setFeedback('修改已写入当前源码草稿。');
    setReferences([]);
    onChange(result.sourceCode);
    return true;
  };

  const updateGlobal = (global: LingCppGlobalVariable, values: Partial<NewGlobalDraft>) => {
    const nextName = (values.name ?? global.name).trim();
    const nextType = resolveBeginnerTypeAlias(globalTypeCatalog, values.type ?? global.type);
    if (!nextName) { setFeedback('全局变量名不能为空。'); return; }
    runEdit({
      kind: 'update-global', globalName: global.name, newName: nextName, type: nextType,
      initialValue: values.initialValue ?? global.initialValue ?? '', isArray: values.isArray ?? global.isArray,
      note: values.note ?? getSymbolNote(sourceCode, global.line)
    });
  };

  const addGlobal = () => {
    const name = globalDraft.name.trim();
    if (!name) { setFeedback('请先填写全局变量名。'); return; }
    const type = resolveBeginnerTypeAlias(globalTypeCatalog, globalDraft.type);
    if (runEdit({ kind: 'add-global', global: { ...globalDraft, name, type } })) setGlobalDraft(EMPTY_GLOBAL_DRAFT);
  };

  const updateConstant = (constant: LingCppConstant, values: Partial<NewConstantDraft>) => {
    const nextName = (values.name ?? constant.name).trim();
    if (!nextName) { setFeedback('项目常量名不能为空。'); return; }
    if (nextName !== constant.name) {
      void renameConstant(constant, nextName);
      return;
    }
    const type = resolveBeginnerTypeAlias(constantTypeCatalog, values.type ?? constant.type);
    runEdit({
      kind: 'update-constant', constantName: constant.name, type,
      initialValue: values.initialValue ?? constant.initialValue,
      note: values.note ?? getSymbolNote(sourceCode, constant.line)
    });
  };

  const addConstant = () => {
    const name = constantDraft.name.trim();
    const initialValue = constantDraft.initialValue.trim();
    const type = resolveBeginnerTypeAlias(constantTypeCatalog, constantDraft.type);
    if (!name) { setFeedback('请先填写项目常量名。'); return; }
    if (!initialValue) { setFeedback('项目常量必须填写常量值。'); return; }
    if (!PROJECT_CONSTANT_TYPES.includes(type as typeof PROJECT_CONSTANT_TYPES[number])) { setFeedback('项目常量只支持基础标量类型。'); return; }
    if (runEdit({ kind: 'add-constant', constant: { ...constantDraft, name, type, initialValue } })) setConstantDraft(EMPTY_CONSTANT_DRAFT);
  };

  const showReferences = (constant: LingCppConstant) => {
    const next = findProjectConstantReferences(effectiveWorkspaceFiles, constant.name);
    setReferences(next);
    setFeedback(next.length > 1 ? `找到 ${next.length - 1} 处代码引用。` : '该常量目前没有代码引用。');
  };

  const deleteConstant = (constant: LingCppConstant) => {
    const used = findProjectConstantReferences(effectiveWorkspaceFiles, constant.name).filter(reference => !reference.isDeclaration);
    if (used.length > 0) {
      setReferences(used);
      setFeedback(`项目常量 ${constant.name} 仍有 ${used.length} 处引用，请先处理引用。`);
      return;
    }
    runEdit({ kind: 'delete-constant', constantName: constant.name });
  };

  const renameConstant = async (constant: LingCppConstant, newName: string) => {
    try {
      if (!filePath || !onProjectSourcesChange) throw new Error('当前工作台尚未提供多文件重命名能力。');
      const proposal = createProjectConstantRenameProposal(effectiveWorkspaceFiles, filePath, constant.name, newName);
      if (!await requestWorkbenchConfirm({ title: '重命名项目常量', description: `${proposal.summary}\n\n确认应用这些修改吗？`, confirmLabel: '应用', cancelLabel: '取消' })) return;
      const appliedFiles = applyWorkspaceEditToFiles(effectiveWorkspaceFiles, proposal);
      onProjectSourcesChange(appliedFiles);
      setFeedback(proposal.summary);
      setReferences([]);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '项目常量重命名失败。');
    }
  };

  const inputClass = `w-full rounded border px-2 py-1 text-xs outline-none focus:border-blue-500 ${isDarkMode ? 'border-[#393943] bg-[#202028] text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`;
  const rowBorder = isDarkMode ? 'border-[#303038]' : 'border-slate-200';
  const tabClass = (selected: boolean) => `rounded px-3 py-1.5 text-xs font-semibold ${selected ? 'bg-blue-600 text-white' : isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'}`;

  return (
    <div
      className={`flex h-full min-h-0 flex-col ${isDarkMode ? 'bg-[#18181e] text-slate-200' : 'bg-white text-slate-800'}`}
      style={{ '--lingcpp-comment-color': getLingCppCommentTokenColor(isDarkMode) } as React.CSSProperties}
    >
      <div className={`border-b px-4 py-3 ${rowBorder}`}>
        <div className="text-sm font-semibold">项目变量与常量</div>
        <div className="mt-1 text-[11px] text-slate-500">当前项目全部 .lcpp 源码均可访问；项目常量创建后只读。</div>
        <div className="mt-3 flex gap-1" role="tablist" aria-label="项目变量与常量">
          <button type="button" role="tab" aria-selected={activeTab === 'globals'} className={tabClass(activeTab === 'globals')} onClick={() => { setActiveTab('globals'); setReferences([]); }}>项目变量</button>
          <button type="button" role="tab" aria-selected={activeTab === 'constants'} className={tabClass(activeTab === 'constants')} onClick={() => { setActiveTab('constants'); setReferences([]); }}>项目常量</button>
        </div>
      </div>
      {(feedback || diagnostics.length > 0) && <div className={`mx-4 mt-3 rounded border px-3 py-2 text-xs ${isDarkMode ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{feedback || diagnostics[0]?.message}</div>}
      <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto p-4">
        {activeTab === 'globals' ? (
          <GlobalTable parsed={parsed.program.globals} sourceCode={sourceCode} draft={globalDraft} setDraft={setGlobalDraft} updateGlobal={updateGlobal} addGlobal={addGlobal} runEdit={runEdit} inputClass={inputClass} rowBorder={rowBorder} typeCatalog={globalTypeCatalog} readOnly={readOnly} isDarkMode={isDarkMode} widths={globalTableWidths} beginResize={beginTableColumnResize} resetWidth={resetTableColumnWidth} />
        ) : (
          <ConstantTable parsed={parsed.program.constants} sourceCode={sourceCode} draft={constantDraft} setDraft={setConstantDraft} updateConstant={updateConstant} addConstant={addConstant} deleteConstant={deleteConstant} showReferences={showReferences} inputClass={inputClass} rowBorder={rowBorder} typeCatalog={constantTypeCatalog} readOnly={readOnly} isDarkMode={isDarkMode} widths={constantTableWidths} beginResize={beginTableColumnResize} resetWidth={resetTableColumnWidth} />
        )}
        {references.length > 0 && <div className={`mt-4 rounded border p-3 text-xs ${rowBorder}`}><div className="mb-2 font-semibold">常量引用</div>{references.slice(0, 20).map(reference => <div key={`${reference.filePath}:${reference.line}:${reference.column}`} className="truncate py-0.5" title={reference.text}>{reference.filePath} 第 {reference.line} 行：{reference.text.trim()}</div>)}</div>}
      </div>
    </div>
  );
}

const PROJECT_GLOBAL_TABLE_LABELS = ['全局变量名', '类型', '初始值', '数组', '备注', '操作'];
const PROJECT_GLOBAL_TABLE_DEFAULT_WIDTHS = [150, 130, 190, 56, 250, 74];
// 「数组」内容只有勾选框、「操作」只有删除按钮：两列宽度固定，永不参与拉伸，无拖拽手柄。
const PROJECT_GLOBAL_FIXED_COLUMN_INDEXES: ReadonlySet<number> = new Set([3, 5]);
// 其余四列（名称/类型/初始值/备注）是弹性列：按持久化权重分摊容器宽度，全部可拖拽。
const PROJECT_GLOBAL_FLEX_COLUMN_INDEXES: ReadonlySet<number> = new Set([0, 1, 2, 4]);
const PROJECT_CONSTANT_TABLE_LABELS = ['常量名', '类型', '常量值', '备注', '操作'];
const PROJECT_CONSTANT_TABLE_DEFAULT_WIDTHS = [150, 130, 170, 250, 96];
// 「操作」只有按钮：固定宽度；其余四列可拖拽。
const PROJECT_CONSTANT_FIXED_COLUMN_INDEXES: ReadonlySet<number> = new Set([4]);
const PROJECT_CONSTANT_FLEX_COLUMN_INDEXES: ReadonlySet<number> = new Set([0, 1, 2, 3]);
// 备注列文字与新手模式注释同色：消费 --lingcpp-comment-color 令牌（由组件根节点注入）。
const NOTE_INPUT_STYLE: React.CSSProperties = { color: 'var(--lingcpp-comment-color)' };

function GlobalTable({ parsed, sourceCode, draft, setDraft, updateGlobal, addGlobal, runEdit, inputClass, rowBorder, typeCatalog, readOnly, isDarkMode, widths, beginResize, resetWidth }: any) {
  const tableKey: BeginnerTableKey = 'project-globals';
  const tableWidth = PROJECT_GLOBAL_TABLE_DEFAULT_WIDTHS.reduce((sum: number, width: number) => sum + width, 0);
  return <><table className="w-full table-fixed border-collapse text-left text-xs" style={{ minWidth: `${tableWidth}px` }}><thead><tr className={`border-b ${rowBorder} text-slate-500`}>{PROJECT_GLOBAL_TABLE_LABELS.map((label, index) => <th key={label} className="relative select-none px-2 py-2 font-semibold" style={{ width: widths[index] }}>{label}{PROJECT_GLOBAL_FLEX_COLUMN_INDEXES.has(index) ? <span role="separator" aria-orientation="vertical" aria-label={`调整「${label}」列宽`} title="拖动调整列宽，双击恢复默认" onPointerDown={(event: ReactPointerEvent<HTMLSpanElement>) => beginResize(event, tableKey, index, widths[index])} onDoubleClick={() => resetWidth(tableKey, index)} className="absolute inset-y-0 right-0 z-10 w-[7px] cursor-col-resize touch-none after:absolute after:inset-y-[3px] after:right-0 after:w-[2px] after:rounded-full after:bg-transparent hover:after:bg-cyan-500/70" /> : null}</th>)}</tr></thead><tbody>
    {parsed.map((global: LingCppGlobalVariable) => <tr key={`${global.line}:${global.name}`} className={`border-b ${rowBorder}`}>
      <td className="px-2 py-2"><input className={inputClass} defaultValue={global.name} onBlur={event => event.target.value !== global.name && updateGlobal(global, { name: event.target.value })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><SearchableTypeSelect value={global.type} items={typeCatalog} inputClassName={inputClass} rootClassName="relative w-full min-w-0" isDarkMode={isDarkMode} disabled={readOnly} ariaLabel={`${global.name} 的类型`} onCommit={value => value !== global.type && updateGlobal(global, { type: value })} /></td>
      <td className="px-2 py-2"><input className={inputClass} defaultValue={global.initialValue || ''} placeholder={global.isArray ? '数组首版仅支持空值' : '可选'} onBlur={event => event.target.value !== (global.initialValue || '') && updateGlobal(global, { initialValue: event.target.value })} disabled={readOnly || global.isArray} /></td>
      <td className="px-2 py-2 text-center"><input type="checkbox" checked={global.isArray} onChange={event => updateGlobal(global, { isArray: event.target.checked, initialValue: event.target.checked ? '' : global.initialValue || '' })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><input className={inputClass} style={NOTE_INPUT_STYLE} defaultValue={getSymbolNote(sourceCode, global.line)} placeholder="可选" onBlur={event => event.target.value !== getSymbolNote(sourceCode, global.line) && updateGlobal(global, { note: event.target.value })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><button type="button" className="rounded p-1.5 text-rose-500 hover:bg-rose-500/10 disabled:opacity-40" title="删除全局变量" onClick={() => runEdit({ kind: 'delete-global', globalName: global.name })} disabled={readOnly}><Trash2 className="h-4 w-4" /></button></td>
    </tr>)}
    <tr className={parsed.length === 0 ? '' : `border-t ${rowBorder}`}><td className="px-2 py-3"><input className={inputClass} value={draft.name} onChange={(event: any) => setDraft((current: any) => ({ ...current, name: event.target.value }))} placeholder="新变量名" disabled={readOnly} /></td><td className="px-2 py-3"><SearchableTypeSelect value={draft.type} items={typeCatalog} inputClassName={inputClass} rootClassName="relative w-full min-w-0" isDarkMode={isDarkMode} disabled={readOnly} ariaLabel="新项目变量类型" onValueChange={value => setDraft((current: any) => ({ ...current, type: value }))} /></td><td className="px-2 py-3"><input className={inputClass} value={draft.initialValue} onChange={(event: any) => setDraft((current: any) => ({ ...current, initialValue: event.target.value }))} placeholder={draft.isArray ? '数组首版仅支持空值' : '可选'} disabled={readOnly || draft.isArray} /></td><td className="px-2 py-3 text-center"><input type="checkbox" checked={draft.isArray} onChange={(event: any) => setDraft((current: any) => ({ ...current, isArray: event.target.checked, initialValue: event.target.checked ? '' : current.initialValue }))} disabled={readOnly} /></td><td className="px-2 py-3"><input className={inputClass} style={NOTE_INPUT_STYLE} value={draft.note} onChange={(event: any) => setDraft((current: any) => ({ ...current, note: event.target.value }))} placeholder="可选" disabled={readOnly} /></td><td className="px-2 py-3"><button type="button" className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-40" onClick={addGlobal} disabled={readOnly}><Plus className="h-3.5 w-3.5" />新增</button></td></tr>
  </tbody></table>{parsed.length === 0 && !draft.name && <div className="mt-5 text-center text-xs text-slate-500">暂无项目变量。请在末尾新增一行。</div>}</>;
}

function ConstantTable({ parsed, sourceCode, draft, setDraft, updateConstant, addConstant, deleteConstant, showReferences, inputClass, rowBorder, typeCatalog, readOnly, isDarkMode, widths, beginResize, resetWidth }: any) {
  const tableKey: BeginnerTableKey = 'project-constants';
  const tableWidth = PROJECT_CONSTANT_TABLE_DEFAULT_WIDTHS.reduce((sum: number, width: number) => sum + width, 0);
  return <><table className="w-full table-fixed border-collapse text-left text-xs" style={{ minWidth: `${tableWidth}px` }}><thead><tr className={`border-b ${rowBorder} text-slate-500`}>{PROJECT_CONSTANT_TABLE_LABELS.map((label, index) => <th key={label} className="relative select-none px-2 py-2 font-semibold" style={{ width: widths[index] }}>{label}{PROJECT_CONSTANT_FLEX_COLUMN_INDEXES.has(index) ? <span role="separator" aria-orientation="vertical" aria-label={`调整「${label}」列宽`} title="拖动调整列宽，双击恢复默认" onPointerDown={(event: ReactPointerEvent<HTMLSpanElement>) => beginResize(event, tableKey, index, widths[index])} onDoubleClick={() => resetWidth(tableKey, index)} className="absolute inset-y-0 right-0 z-10 w-[7px] cursor-col-resize touch-none after:absolute after:inset-y-[3px] after:right-0 after:w-[2px] after:rounded-full after:bg-transparent hover:after:bg-cyan-500/70" /> : null}</th>)}</tr></thead><tbody>
    {parsed.map((constant: LingCppConstant) => <tr key={`${constant.line}:${constant.name}`} className={`border-b ${rowBorder}`}>
      <td className="px-2 py-2"><input className={inputClass} defaultValue={constant.name} onBlur={event => event.target.value !== constant.name && updateConstant(constant, { name: event.target.value })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><SearchableTypeSelect value={constant.type} items={typeCatalog} inputClassName={inputClass} rootClassName="relative w-full min-w-0" isDarkMode={isDarkMode} disabled={readOnly} ariaLabel={`${constant.name} 的类型`} onCommit={value => value !== constant.type && updateConstant(constant, { type: value })} /></td>
      <td className="px-2 py-2"><input className={inputClass} defaultValue={constant.initialValue} placeholder="必填" onBlur={event => event.target.value !== constant.initialValue && updateConstant(constant, { initialValue: event.target.value })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><input className={inputClass} style={NOTE_INPUT_STYLE} defaultValue={getSymbolNote(sourceCode, constant.line)} placeholder="可选" onBlur={event => event.target.value !== getSymbolNote(sourceCode, constant.line) && updateConstant(constant, { note: event.target.value })} disabled={readOnly} /></td>
      <td className="px-2 py-2"><div className="flex gap-1"><button type="button" className="rounded p-1.5 text-sky-500 hover:bg-sky-500/10" title="查找引用" onClick={() => showReferences(constant)}><Search className="h-4 w-4" /></button><button type="button" className="rounded p-1.5 text-rose-500 hover:bg-rose-500/10 disabled:opacity-40" title="删除项目常量" onClick={() => deleteConstant(constant)} disabled={readOnly}><Trash2 className="h-4 w-4" /></button></div></td>
    </tr>)}
    <tr className={parsed.length === 0 ? '' : `border-t ${rowBorder}`}><td className="px-2 py-3"><input data-project-constant-add-name className={inputClass} value={draft.name} onChange={(event: any) => setDraft((current: any) => ({ ...current, name: event.target.value }))} placeholder="新常量名" disabled={readOnly} /></td><td className="px-2 py-3"><SearchableTypeSelect value={draft.type} items={typeCatalog} inputClassName={inputClass} rootClassName="relative w-full min-w-0" isDarkMode={isDarkMode} disabled={readOnly} ariaLabel="新项目常量类型" onValueChange={value => setDraft((current: any) => ({ ...current, type: value }))} /></td><td className="px-2 py-3"><input className={inputClass} value={draft.initialValue} onChange={(event: any) => setDraft((current: any) => ({ ...current, initialValue: event.target.value }))} placeholder="必填" disabled={readOnly} /></td><td className="px-2 py-3"><input className={inputClass} style={NOTE_INPUT_STYLE} value={draft.note} onChange={(event: any) => setDraft((current: any) => ({ ...current, note: event.target.value }))} placeholder="可选" disabled={readOnly} /></td><td className="px-2 py-3"><button type="button" className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-40" onClick={addConstant} disabled={readOnly}><Plus className="h-3.5 w-3.5" />新增</button></td></tr>
  </tbody></table>{parsed.length === 0 && !draft.name && <div className="mt-5 text-center text-xs text-slate-500">暂无项目常量。请填写名称、类型和常量值。</div>}</>;
}

function commandForEdit(edit: LingCppAstEdit): ProjectGlobalVariableCommandId {
  if (edit.kind === 'add-global') return 'lingcpp.global.add';
  if (edit.kind === 'update-global') return 'lingcpp.global.update';
  if (edit.kind === 'delete-global') return 'lingcpp.global.delete';
  if (edit.kind === 'add-constant') return 'lingcpp.constant.add';
  if (edit.kind === 'update-constant') return 'lingcpp.constant.update';
  return 'lingcpp.constant.delete';
}

function getSymbolNote(sourceCode: string, line: number): string {
  const previousLine = sourceCode.split(/\r?\n/u)[Math.max(0, line - 2)]?.trim() || '';
  return previousLine.match(/^\/\/\s*(.*)$/u)?.[1]?.trim() || '';
}
