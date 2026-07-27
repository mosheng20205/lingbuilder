import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, Trash2 } from 'lucide-react';
import { applyWorkspaceEditToFiles, createWorkspaceEditChangeFromRewrite } from '../services/lingCpp/aiEditService';
import { buildBeginnerTypeCompletionCatalog, resolveBeginnerTypeAlias } from '../services/lingCpp/beginnerTypeCompletion';
import { executeProjectDataTypeCommand, ProjectDataTypeCommandId } from '../services/lingCpp/projectDataTypeCommandService';
import {
  SAFE_DATA_FIELD_TYPES,
  createProjectTypeContext,
  findProjectDataTypeReferences,
  getProjectDataTypeDiagnostics,
  renameProjectDataFieldAcrossSources,
  renameProjectDataTypeAcrossSources
} from '../services/lingCpp/projectDataTypeService';
import { LingCppAstEdit, LingCppDataField, LingCppDataType, LingCppWorkspaceFile, WorkspaceEditProposal } from '../services/lingCpp/types';
import { LingCppModuleContext } from '../services/modules/types';
import SearchableTypeSelect from './SearchableTypeSelect';

interface ProjectDataTypeEditorProps {
  sourceCode: string;
  filePath: string;
  moduleContext?: LingCppModuleContext;
  projectSources?: LingCppWorkspaceFile[];
  projectClassNames?: string[];
  isDarkMode: boolean;
  readOnly?: boolean;
  onChange: (sourceCode: string) => void;
  onProjectSourcesChange?: (sources: Array<{ filePath: string; sourceCode: string }>) => void;
}

interface FieldDraft { name: string; type: string; initialValue: string; isArray: boolean; note: string }
interface PendingRefactor { proposal: WorkspaceEditProposal; successMessage: string }
const EMPTY_FIELD: FieldDraft = { name: '', type: '文本型', initialValue: '', isArray: false, note: '' };

export default function ProjectDataTypeEditor(props: ProjectDataTypeEditorProps) {
  const { sourceCode, filePath, moduleContext, projectSources = [], projectClassNames = [], isDarkMode, readOnly, onChange, onProjectSourcesChange } = props;
  const context = useMemo(() => createProjectTypeContext(filePath, sourceCode), [filePath, sourceCode]);
  const diagnostics = useMemo(() => getProjectDataTypeDiagnostics(sourceCode, filePath, moduleContext, projectClassNames), [sourceCode, filePath, moduleContext, projectClassNames]);
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeNote, setNewTypeNote] = useState('');
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, FieldDraft>>({});
  const [feedback, setFeedback] = useState('');
  const [pendingRefactor, setPendingRefactor] = useState<PendingRefactor | null>(null);
  const typeNames = context.dataTypes.map(item => item.name);
  const typeCatalog = buildBeginnerTypeCompletionCatalog([...SAFE_DATA_FIELD_TYPES, ...typeNames])
    .filter(item => item.label !== '空');
  const surface = isDarkMode ? 'border-[#34343e] bg-[#17181d] text-slate-200' : 'border-slate-200 bg-white text-slate-800';
  const input = `h-7 rounded border px-2 text-xs outline-none ${isDarkMode ? 'border-[#3b3d46] bg-[#101116] text-slate-100' : 'border-slate-300 bg-white'}`;
  const button = `inline-flex h-7 items-center gap-1 rounded border px-2 text-xs ${isDarkMode ? 'border-[#41434d] bg-[#24262d] hover:bg-[#30323a]' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`;

  const applyEdit = (commandId: ProjectDataTypeCommandId, edit: LingCppAstEdit) => {
    const result = executeProjectDataTypeCommand(commandId, sourceCode, edit);
    if (!result.success) { setFeedback(result.error || '修改失败。'); return; }
    const blocking = getProjectDataTypeDiagnostics(result.sourceCode, filePath, moduleContext, projectClassNames).find(item => item.level === 'error');
    if (blocking) { setFeedback(blocking.message); return; }
    onChange(result.sourceCode);
    setFeedback('已更新项目数据类型。');
  };

  const renameType = (dataType: LingCppDataType, nextName: string) => {
    if (!nextName.trim() || nextName.trim() === dataType.name) return;
    try {
      const sources = ensureTypeSource(projectSources, filePath, sourceCode);
      const updated = renameProjectDataTypeAcrossSources(sources, context, dataType.name, nextName.trim());
      const proposal = createAtomicRewriteProposal(sources, updated, `重命名数据类型 ${dataType.name}`);
      setPendingRefactor({ proposal, successMessage: `已把数据类型 ${dataType.name} 重命名为 ${nextName.trim()}。` });
      setFeedback('请检查跨文件 Diff，确认后再应用。');
    } catch (error) { setFeedback(error instanceof Error ? error.message : '数据类型重命名失败。'); }
  };

  const renameField = (dataType: LingCppDataType, field: LingCppDataField, nextName: string) => {
    if (!nextName.trim() || nextName.trim() === field.name) return;
    const declaration = executeProjectDataTypeCommand('lingcpp.dataField.update', sourceCode, { kind: 'update-data-field', dataTypeName: dataType.name, fieldName: field.name, newName: nextName.trim() });
    if (!declaration.success) { setFeedback(declaration.error || '字段重命名失败。'); return; }
    try {
      const sources = ensureTypeSource(projectSources, filePath, sourceCode).map(file => normalizePath(file.filePath) === normalizePath(filePath) ? { ...file, sourceCode: declaration.sourceCode } : file);
      const updated = renameProjectDataFieldAcrossSources(sources, context, dataType.name, field.name, nextName.trim());
      const proposal = createAtomicRewriteProposal(ensureTypeSource(projectSources, filePath, sourceCode), updated, `重命名字段 ${dataType.name}.${field.name}`);
      setPendingRefactor({ proposal, successMessage: `字段已重命名为 ${nextName.trim()}。` });
      setFeedback('请检查跨文件 Diff，确认后再应用。');
    } catch (error) { setFeedback(error instanceof Error ? error.message : '字段重命名失败。'); }
  };

  const applyPendingRefactor = () => {
    if (!pendingRefactor) return;
    try {
      const currentSources = ensureTypeSource(projectSources, filePath, sourceCode);
      const applied = applyWorkspaceEditToFiles(currentSources, pendingRefactor.proposal);
      if (!onProjectSourcesChange && applied.some(file => normalizePath(file.filePath) !== normalizePath(filePath))) {
        throw new Error('当前编辑器不能提交跨文件改名，请在完整项目工作台中重试。');
      }
      onProjectSourcesChange?.(mergeAppliedSources(currentSources, applied));
      const current = applied.find(file => normalizePath(file.filePath) === normalizePath(filePath));
      if (!onProjectSourcesChange && current) onChange(current.sourceCode);
      setFeedback(pendingRefactor.successMessage);
      setPendingRefactor(null);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : '重构文件版本已过期，未修改任何文件。');
    }
  };

  const deleteType = (dataType: LingCppDataType) => {
    const refs = findProjectDataTypeReferences(ensureTypeSource(projectSources, filePath, sourceCode), context, dataType.name)
      .filter(ref => !(normalizePath(ref.filePath) === normalizePath(filePath) && ref.line === dataType.line));
    if (refs.length) { setFeedback(`不能删除：数据类型 ${dataType.name} 仍有 ${refs.length} 处引用，首处位于 ${refs[0].filePath}:${refs[0].line}。`); return; }
    applyEdit('lingcpp.dataType.delete', { kind: 'delete-data-type', dataTypeName: dataType.name });
  };

  const deleteField = (dataType: LingCppDataType, field: LingCppDataField) => {
    const refs = findProjectDataTypeReferences(ensureTypeSource(projectSources, filePath, sourceCode), context, dataType.name, field.name);
    if (refs.length) { setFeedback(`不能删除：字段 ${dataType.name}.${field.name} 仍有 ${refs.length} 处引用，首处位于 ${refs[0].filePath}:${refs[0].line}。`); return; }
    applyEdit('lingcpp.dataField.delete', { kind: 'delete-data-field', dataTypeName: dataType.name, fieldName: field.name });
  };

  return <div className={`h-full overflow-auto p-4 ${isDarkMode ? 'bg-[#111217]' : 'bg-slate-50'}`}>
    <div className="mx-auto max-w-6xl space-y-3">
      <div className={`rounded border p-3 ${surface}`}>
        <div className="text-sm font-semibold">项目自定义数据类型</div>
        <div className="mt-1 text-xs opacity-70">值类型会生成标准 C++ struct，可用于局部、程序集、全局、参数、返回值和数组。</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`${input} w-44`} value={newTypeName} onChange={event => setNewTypeName(event.target.value)} placeholder="新数据类型名称" disabled={readOnly} />
          <input className={`${input} min-w-56 flex-1`} value={newTypeNote} onChange={event => setNewTypeNote(event.target.value)} placeholder="说明（可选）" disabled={readOnly} />
          <button className={button} disabled={readOnly || !newTypeName.trim()} onClick={() => { applyEdit('lingcpp.dataType.add', { kind: 'add-data-type', dataType: { name: newTypeName.trim(), note: newTypeNote.trim() || undefined } }); setNewTypeName(''); setNewTypeNote(''); }}><Plus className="h-3.5 w-3.5" />新增类型</button>
        </div>
      </div>

      {feedback && <div role="status" className={`rounded border px-3 py-2 text-xs ${surface}`}>{feedback}</div>}
      {pendingRefactor && <section aria-label="跨文件重构 Diff" className={`rounded border p-3 ${surface}`}>
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-sm font-semibold">跨文件 Diff：{pendingRefactor.proposal.title}</div>
          <span className="text-[11px] opacity-60">{pendingRefactor.proposal.changes.length} 个文件</span>
          <div className="ml-auto flex gap-2">
            <button className={button} onClick={() => { setPendingRefactor(null); setFeedback('已取消重构预览，未修改任何文件。'); }}>取消</button>
            <button className={`${button} border-emerald-500/60 bg-emerald-500/10`} onClick={applyPendingRefactor}>应用全部修改</button>
          </div>
        </div>
        <div className="mt-3 max-h-80 space-y-3 overflow-auto">
          {pendingRefactor.proposal.changes.map(change => <article key={change.filePath} className="overflow-hidden rounded border border-current/15">
            <div className="border-b border-current/10 px-2 py-1 text-[11px] opacity-70">{change.filePath} · 第 {change.range.startLine} 行</div>
            <div className="grid min-w-[640px] grid-cols-2 text-[11px]">
              <pre className="overflow-auto bg-rose-500/10 p-2 whitespace-pre-wrap"><span className="text-rose-400">- </span>{change.originalText || '（空）'}</pre>
              <pre className="overflow-auto bg-emerald-500/10 p-2 whitespace-pre-wrap"><span className="text-emerald-400">+ </span>{change.newText || '（空）'}</pre>
            </div>
          </article>)}
        </div>
      </section>}
      {diagnostics.length > 0 && <div role="alert" className="rounded border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{diagnostics.map(item => `第 ${item.line} 行：${item.message}`).join('\n')}</div>}
      {context.dataTypes.length === 0 && <div className={`rounded border p-8 text-center text-sm opacity-70 ${surface}`}>暂无自定义数据类型。填写名称后点击“新增类型”。</div>}

      {context.dataTypes.map((dataType, typeIndex) => {
        const draft = fieldDrafts[dataType.name] || EMPTY_FIELD;
        return <section key={`${dataType.name}-${dataType.line}`} className={`rounded border ${surface}`}>
          <header className="flex flex-wrap items-center gap-2 border-b border-current/10 p-3">
            <input className={`${input} w-48 font-semibold`} defaultValue={dataType.name} onBlur={event => renameType(dataType, event.target.value)} disabled={readOnly} aria-label={`数据类型 ${dataType.name} 名称`} />
            <span className="text-[11px] opacity-60">{dataType.fields.length} 个字段</span>
            <div className="ml-auto flex gap-1">
              <button className={button} disabled={readOnly || typeIndex === 0} onClick={() => applyEdit('lingcpp.dataType.move', { kind: 'move-data-type', dataTypeName: dataType.name, direction: 'up' })}><ArrowUp className="h-3.5 w-3.5" /></button>
              <button className={button} disabled={readOnly || typeIndex === context.dataTypes.length - 1} onClick={() => applyEdit('lingcpp.dataType.move', { kind: 'move-data-type', dataTypeName: dataType.name, direction: 'down' })}><ArrowDown className="h-3.5 w-3.5" /></button>
              <button className={button} disabled={readOnly} onClick={() => deleteType(dataType)}><Trash2 className="h-3.5 w-3.5" />删除类型</button>
            </div>
          </header>
          <div className="overflow-x-auto p-3">
            <table className="w-full min-w-[780px] border-collapse text-xs">
              <thead><tr className="text-left opacity-65"><th className="pb-2">字段名</th><th>类型</th><th>数组</th><th>默认值</th><th>说明</th><th className="w-28">操作</th></tr></thead>
              <tbody>
                {dataType.fields.map((field, fieldIndex) => <tr key={`${field.name}-${field.line}`} className="border-t border-current/10">
                  <td className="py-1.5 pr-2"><input className={`${input} w-full`} defaultValue={field.name} onBlur={event => renameField(dataType, field, event.target.value)} disabled={readOnly} /></td>
                  <td className="pr-2"><SearchableTypeSelect value={field.type} items={typeCatalog} inputClassName={`${input} w-full`} isDarkMode={isDarkMode} disabled={readOnly} ariaLabel={`${dataType.name}.${field.name} 字段类型`} onCommit={value => value !== field.type && applyEdit('lingcpp.dataField.update', { kind: 'update-data-field', dataTypeName: dataType.name, fieldName: field.name, type: value })} /></td>
                  <td className="pr-2 text-center"><input type="checkbox" checked={Boolean(field.isArray)} onChange={event => applyEdit('lingcpp.dataField.update', { kind: 'update-data-field', dataTypeName: dataType.name, fieldName: field.name, isArray: event.target.checked, initialValue: event.target.checked ? '' : field.initialValue })} disabled={readOnly} /></td>
                  <td className="pr-2"><input className={`${input} w-full`} defaultValue={field.initialValue || ''} onBlur={event => applyEdit('lingcpp.dataField.update', { kind: 'update-data-field', dataTypeName: dataType.name, fieldName: field.name, initialValue: event.target.value })} disabled={readOnly || field.isArray} /></td>
                  <td className="pr-2"><input className={`${input} w-full`} defaultValue={field.note || ''} onBlur={event => applyEdit('lingcpp.dataField.update', { kind: 'update-data-field', dataTypeName: dataType.name, fieldName: field.name, note: event.target.value })} disabled={readOnly} /></td>
                  <td><div className="flex gap-1"><button className={button} disabled={readOnly || fieldIndex === 0} onClick={() => applyEdit('lingcpp.dataField.move', { kind: 'move-data-field', dataTypeName: dataType.name, fieldName: field.name, direction: 'up' })}><ArrowUp className="h-3 w-3" /></button><button className={button} disabled={readOnly || fieldIndex === dataType.fields.length - 1} onClick={() => applyEdit('lingcpp.dataField.move', { kind: 'move-data-field', dataTypeName: dataType.name, fieldName: field.name, direction: 'down' })}><ArrowDown className="h-3 w-3" /></button><button className={button} disabled={readOnly} onClick={() => deleteField(dataType, field)}><Trash2 className="h-3 w-3" /></button></div></td>
                </tr>)}
                <tr className="border-t border-current/10">
                  <td className="pt-2 pr-2"><input className={`${input} w-full`} value={draft.name} onChange={event => setFieldDrafts(current => ({ ...current, [dataType.name]: { ...draft, name: event.target.value } }))} placeholder="新字段" disabled={readOnly} /></td>
                  <td className="pt-2 pr-2"><SearchableTypeSelect value={draft.type} items={typeCatalog} inputClassName={`${input} w-full`} isDarkMode={isDarkMode} disabled={readOnly} ariaLabel={`${dataType.name} 新字段类型`} onValueChange={value => setFieldDrafts(current => ({ ...current, [dataType.name]: { ...draft, type: value } }))} /></td>
                  <td className="pt-2 pr-2 text-center"><input type="checkbox" checked={draft.isArray} onChange={event => setFieldDrafts(current => ({ ...current, [dataType.name]: { ...draft, isArray: event.target.checked, initialValue: event.target.checked ? '' : draft.initialValue } }))} disabled={readOnly} /></td>
                  <td className="pt-2 pr-2"><input className={`${input} w-full`} value={draft.initialValue} onChange={event => setFieldDrafts(current => ({ ...current, [dataType.name]: { ...draft, initialValue: event.target.value } }))} disabled={readOnly || draft.isArray} /></td>
                  <td className="pt-2 pr-2"><input className={`${input} w-full`} value={draft.note} onChange={event => setFieldDrafts(current => ({ ...current, [dataType.name]: { ...draft, note: event.target.value } }))} disabled={readOnly} /></td>
                  <td className="pt-2"><button className={button} disabled={readOnly || !draft.name.trim()} onClick={() => { applyEdit('lingcpp.dataField.add', { kind: 'add-data-field', dataTypeName: dataType.name, field: { ...draft, type: resolveBeginnerTypeAlias(typeCatalog, draft.type), note: draft.note || undefined } }); setFieldDrafts(current => ({ ...current, [dataType.name]: EMPTY_FIELD })); }}><Plus className="h-3.5 w-3.5" />添加</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>;
      })}
      <div className="flex items-center gap-2 text-[11px] opacity-60"><Search className="h-3.5 w-3.5" />改名会先确认跨文件更新；仍被引用的类型或字段不能删除。</div>
    </div>
  </div>;
}

function ensureTypeSource(files: LingCppWorkspaceFile[], filePath: string, sourceCode: string): LingCppWorkspaceFile[] {
  const normalized = normalizePath(filePath);
  const found = files.some(file => normalizePath(file.filePath) === normalized);
  return found ? files.map(file => normalizePath(file.filePath) === normalized ? { ...file, sourceCode } : file) : [...files, { filePath, sourceCode, language: 'lingcpp' }];
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/gu, '/').toLocaleLowerCase();
}

function createAtomicRewriteProposal(original: LingCppWorkspaceFile[], updated: LingCppWorkspaceFile[], title: string): WorkspaceEditProposal {
  const changes = updated.flatMap((file, index) => file.sourceCode === original[index]?.sourceCode
    ? []
    : [createWorkspaceEditChangeFromRewrite(file.filePath, original[index]?.sourceCode || '', file.sourceCode)]);
  const proposal: WorkspaceEditProposal = { id: `project-data-type-${Date.now()}`, title, summary: title, createdAt: new Date().toISOString(), changes, explanation: '项目数据类型安全重构；所有文件版本一致时才整体应用。' };
  applyWorkspaceEditToFiles(original, proposal);
  return proposal;
}

function mergeAppliedSources(original: LingCppWorkspaceFile[], applied: Array<{ filePath: string; sourceCode: string }>): LingCppWorkspaceFile[] {
  const updates = new Map(applied.map(file => [normalizePath(file.filePath), file.sourceCode]));
  return original.map(file => ({ ...file, sourceCode: updates.get(normalizePath(file.filePath)) ?? file.sourceCode }));
}
