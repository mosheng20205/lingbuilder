import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  Replace,
  RotateCcw,
  Save,
  Search,
  X
} from 'lucide-react';

import type {
  WorkspaceReplaceApplyRequest,
  WorkspaceReplaceApplyResponse,
  WorkspaceReplacePreviewRequest,
  WorkspaceReplacePreviewResponse,
  WorkspaceReplaceRollbackRequest,
  WorkspaceReplaceRollbackResponse,
  WorkspaceSearchMatch,
  WorkspaceSearchQueryRequest,
  WorkspaceSearchQueryResponse,
  WorkspaceSearchScope
} from '../services/workspace/workspaceSearchTypes';

export interface WorkspaceSearchDialogProps {
  open: boolean;
  initialMode: 'search' | 'replace';
  isDarkMode: boolean;
  activeFilePath?: string;
  activeProjectId?: string;
  contextVersion?: number;
  hasUnsavedFiles: boolean;
  onClose: () => void;
  onQuery: (query: WorkspaceSearchQueryRequest) => Promise<WorkspaceSearchQueryResponse>;
  onPreview: (request: WorkspaceReplacePreviewRequest) => Promise<WorkspaceReplacePreviewResponse>;
  onApply: (request: WorkspaceReplaceApplyRequest) => Promise<WorkspaceReplaceApplyResponse>;
  onRollback: (request: WorkspaceReplaceRollbackRequest) => Promise<WorkspaceReplaceRollbackResponse>;
  onReveal: (match: WorkspaceSearchMatch) => void;
  onSaveBeforeReplace: () => Promise<boolean>;
  initialResult?: WorkspaceSearchQueryResponse | null;
  initialPreview?: WorkspaceReplacePreviewResponse | null;
  initialError?: string;
  initialTransactionId?: string;
}

export type WorkspaceSearchBusyOperation = 'query' | 'save' | 'preview' | 'apply' | 'rollback' | null;

export interface WorkspaceSearchContextIdentity {
  activeFilePath?: string;
  activeProjectId?: string;
  contextVersion?: number;
}

export interface WorkspaceSearchInteractionState {
  isBusy: boolean;
  replacementBlocked: boolean;
}

/**
 * Keep the two safety gates independent: an in-flight request freezes every
 * control that could make its response stale, while any dirty editor keeps
 * replacement blocked even after a save request reports success.
 */
export function getWorkspaceSearchInteractionState(
  busy: WorkspaceSearchBusyOperation,
  hasUnsavedFiles: boolean
): WorkspaceSearchInteractionState {
  return {
    isBusy: busy !== null,
    replacementBlocked: hasUnsavedFiles
  };
}

/** A file/project-scoped query cannot be reused after its owning context moves. */
export function shouldInvalidateWorkspaceSearchContext(
  scope: WorkspaceSearchScope,
  previous: WorkspaceSearchContextIdentity,
  next: WorkspaceSearchContextIdentity
): boolean {
  if (previous.contextVersion !== next.contextVersion) return true;
  if (scope === 'file') {
    return normalizeContextPath(previous.activeFilePath) !== normalizeContextPath(next.activeFilePath);
  }
  if (scope === 'project') {
    return (previous.activeProjectId || '') !== (next.activeProjectId || '');
  }
  return false;
}

export function isWorkspaceSearchRequestCurrent(
  requestGeneration: number,
  currentGeneration: number
): boolean {
  return requestGeneration === currentGeneration;
}

/** Preserve every successful server transaction; the service owns capacity checks. */
export function pushWorkspaceReplaceTransaction(
  transactionIds: readonly string[],
  transactionId: string
): string[] {
  const normalizedId = transactionId.trim();
  if (!normalizedId || transactionIds.includes(normalizedId)) return [...transactionIds];
  return [...transactionIds, normalizedId];
}

/** Rollback is LIFO so every older transaction remains reachable afterwards. */
export function popWorkspaceReplaceTransaction(
  transactionIds: readonly string[],
  rolledBackTransactionId: string
): string[] {
  if (transactionIds[transactionIds.length - 1] !== rolledBackTransactionId) return [...transactionIds];
  return transactionIds.slice(0, -1);
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export default function WorkspaceSearchDialog({
  open,
  initialMode,
  isDarkMode,
  activeFilePath,
  activeProjectId,
  contextVersion,
  hasUnsavedFiles,
  onClose,
  onQuery,
  onPreview,
  onApply,
  onRollback,
  onReveal,
  onSaveBeforeReplace,
  initialResult = null,
  initialPreview = null,
  initialError,
  initialTransactionId
}: WorkspaceSearchDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const queryId = useId();
  const replacementId = useId();
  const confirmId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const queryInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const searchContextRef = useRef<WorkspaceSearchContextIdentity>({ activeFilePath, activeProjectId, contextVersion });
  const requestGenerationRef = useRef(0);
  const [mode, setMode] = useState<'search' | 'replace'>(initialMode);
  const [query, setQuery] = useState('');
  const [patternMode, setPatternMode] = useState<'text' | 'regex'>('text');
  const [matchCase, setMatchCase] = useState(false);
  const [scope, setScope] = useState<WorkspaceSearchScope>(activeProjectId ? 'project' : 'workspace');
  const [replacement, setReplacement] = useState('');
  const [result, setResult] = useState<WorkspaceSearchQueryResponse | null>(initialResult);
  const [preview, setPreview] = useState<WorkspaceReplacePreviewResponse | null>(initialPreview);
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(
    () => new Set(initialResult?.matches.map(match => match.id) || [])
  );
  const [confirmedPreview, setConfirmedPreview] = useState(false);
  const [busy, setBusy] = useState<WorkspaceSearchBusyOperation>(null);
  const [error, setError] = useState(initialError || '');
  const [liveMessage, setLiveMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [transactionIds, setTransactionIds] = useState<string[]>(
    () => initialTransactionId ? [initialTransactionId] : []
  );

  const { isBusy, replacementBlocked } = getWorkspaceSearchInteractionState(busy, hasUnsavedFiles);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => queryInputRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [initialMode, open]);

  useEffect(() => {
    if (scope === 'file' && !activeFilePath) {
      setScope(activeProjectId ? 'project' : 'workspace');
    } else if (scope === 'project' && !activeProjectId) {
      setScope('workspace');
    }
  }, [activeFilePath, activeProjectId, scope]);

  useEffect(() => {
    const previous = searchContextRef.current;
    const next = { activeFilePath, activeProjectId, contextVersion };
    searchContextRef.current = next;
    if (!shouldInvalidateWorkspaceSearchContext(scope, previous, next)) return;

    requestGenerationRef.current += 1;
    setBusy(null);
    setResult(null);
    setSelectedMatchIds(new Set());
    setPreview(null);
    setConfirmedPreview(false);
    setTransactionIds([]);
    setError('');
    setSuccessMessage('');
    if (open) setLiveMessage('搜索上下文已变化，请按当前文件或项目重新搜索。');
  }, [activeFilePath, activeProjectId, contextVersion, open, scope]);

  useEffect(() => {
    if (!open) requestGenerationRef.current += 1;
  }, [open]);

  const groupedMatches = useMemo(() => {
    const groups = new Map<string, WorkspaceSearchMatch[]>();
    for (const match of result?.matches || []) {
      const matches = groups.get(match.filePath) || [];
      matches.push(match);
      groups.set(match.filePath, matches);
    }
    return [...groups.entries()];
  }, [result]);

  if (!open) return null;

  const clearPreview = () => {
    setPreview(null);
    setConfirmedPreview(false);
  };

  const invalidateQueryResult = () => {
    setResult(null);
    setSelectedMatchIds(new Set());
    clearPreview();
  };

  const resetFeedback = () => {
    setError('');
    setSuccessMessage('');
  };

  const requestClose = () => {
    if (isBusy) {
      setLiveMessage('操作正在进行，完成后才能关闭工作区搜索。');
      return;
    }
    onClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    } else if (event.key === 'Tab') {
      trapDialogFocus(event, dialogRef.current);
    }
  };

  const runQuery = async (
    requestGeneration = ++requestGenerationRef.current
  ): Promise<boolean> => {
    if (query.length === 0) {
      setError('请输入要搜索的文本或正则表达式。');
      setLiveMessage('搜索条件为空。');
      queryInputRef.current?.focus();
      return false;
    }

    resetFeedback();
    clearPreview();
    setBusy('query');
    setLiveMessage('正在搜索已保存到磁盘的工作区文件…');
    try {
      const nextResult = await onQuery(createWorkspaceSearchQueryRequest(
        query,
        scope,
        patternMode,
        matchCase,
        activeFilePath,
        activeProjectId
      ));
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return false;
      setResult(nextResult);
      setSelectedMatchIds(new Set(nextResult.matches.map(match => match.id)));
      const message = nextResult.matches.length > 0
        ? `搜索完成，找到 ${nextResult.matches.length} 处匹配。`
        : '搜索完成，没有找到匹配内容。';
      setLiveMessage(message);
      setSuccessMessage(message);
      return true;
    } catch (nextError) {
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return false;
      const message = getErrorMessage(nextError, '搜索失败，请检查条件后重试。');
      setError(message);
      setLiveMessage(message);
      setResult(null);
      setSelectedMatchIds(new Set());
      return false;
    } finally {
      if (isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) setBusy(null);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isBusy) void runQuery();
  };

  const toggleMatch = (matchId: string, checked: boolean) => {
    setSelectedMatchIds(current => {
      const next = new Set(current);
      if (checked) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
    clearPreview();
  };

  const toggleFile = (matches: WorkspaceSearchMatch[], checked: boolean) => {
    setSelectedMatchIds(current => {
      const next = new Set(current);
      for (const match of matches) {
        if (checked) next.add(match.id);
        else next.delete(match.id);
      }
      return next;
    });
    clearPreview();
  };

  const toggleAll = (checked: boolean) => {
    setSelectedMatchIds(new Set(checked ? (result?.matches || []).map(match => match.id) : []));
    clearPreview();
  };

  const saveBeforeReplace = async () => {
    const requestGeneration = ++requestGenerationRef.current;
    resetFeedback();
    setBusy('save');
    setLiveMessage('正在保存未保存的文件…');
    try {
      const saved = await onSaveBeforeReplace();
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      if (!saved) {
        const message = '未能保存全部文件，替换预览仍保持禁用。';
        setError(message);
        setLiveMessage(message);
        return;
      }
      if (query.length > 0) {
        const refreshed = await runQuery(requestGeneration);
        if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
        if (refreshed) {
          setSuccessMessage('保存请求已完成，搜索结果已按最新磁盘内容刷新。');
          setLiveMessage('文件保存完成并已重新搜索；只有编辑器确认无未保存修改后才能继续替换。');
        }
      } else {
        setSuccessMessage('保存请求已完成，可以按最新磁盘内容开始搜索。');
        setLiveMessage('文件保存完成；只有编辑器确认无未保存修改后才能继续替换。');
      }
    } catch (nextError) {
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      const message = getErrorMessage(nextError, '保存失败，尚未执行任何替换。');
      setError(message);
      setLiveMessage(message);
    } finally {
      if (isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) setBusy(null);
    }
  };

  const createPreview = async () => {
    if (!result?.queryId || selectedMatchIds.size === 0 || replacementBlocked) return;
    const requestGeneration = ++requestGenerationRef.current;
    resetFeedback();
    setBusy('preview');
    setLiveMessage('正在生成替换预览…');
    try {
      const nextPreview = await onPreview({
        queryId: result.queryId,
        replacement,
        matchIds: [...selectedMatchIds]
      });
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      setPreview(nextPreview);
      setConfirmedPreview(false);
      setSuccessMessage(`预览已生成，将在 ${nextPreview.files.length} 个文件中替换 ${nextPreview.replacementCount} 处。`);
      setLiveMessage('替换预览已生成，请检查并明确确认。');
    } catch (nextError) {
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      const message = getErrorMessage(nextError, '生成替换预览失败，文件尚未修改。');
      setError(message);
      setLiveMessage(message);
      clearPreview();
    } finally {
      if (isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) setBusy(null);
    }
  };

  const applyPreview = async () => {
    if (!preview || !confirmedPreview || replacementBlocked) return;
    const requestGeneration = ++requestGenerationRef.current;
    resetFeedback();
    setBusy('apply');
    setLiveMessage('正在应用已确认的替换预览…');
    try {
      const applied = await onApply({ previewId: preview.previewId });
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      setTransactionIds(current => pushWorkspaceReplaceTransaction(current, applied.transactionId));
      setResult(null);
      setSelectedMatchIds(new Set());
      setPreview(null);
      setConfirmedPreview(false);
      setSuccessMessage(`已更新 ${applied.updatedFiles.length} 个文件，共替换 ${applied.replacementCount} 处。`);
      setLiveMessage('替换已应用，可按后进先出顺序逐次撤销。');
    } catch (nextError) {
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      const message = getErrorMessage(nextError, '应用替换失败，服务已阻止不一致写入。');
      setError(message);
      setLiveMessage(message);
    } finally {
      if (isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) setBusy(null);
    }
  };

  const rollbackReplace = async () => {
    const transactionId = transactionIds[transactionIds.length - 1];
    if (!transactionId) return;
    const requestGeneration = ++requestGenerationRef.current;
    resetFeedback();
    setBusy('rollback');
    setLiveMessage('正在撤销本次替换…');
    try {
      const rolledBack = await onRollback({ transactionId });
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      setTransactionIds(current => popWorkspaceReplaceTransaction(current, transactionId));
      clearPreview();
      const remainingCount = Math.max(0, transactionIds.length - 1);
      setSuccessMessage(`已撤销最近一次替换并恢复 ${rolledBack.restoredFiles.length} 个文件。${remainingCount > 0 ? `仍有 ${remainingCount} 个替换事务可继续撤销。` : ''}`);
      setLiveMessage(remainingCount > 0 ? `最近一次替换已撤销，仍有 ${remainingCount} 个事务可撤销。` : '全部工作区替换事务均已撤销。');
    } catch (nextError) {
      if (!isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) return;
      const message = getErrorMessage(nextError, '撤销失败，请检查文件是否又被外部修改。');
      setError(message);
      setLiveMessage(message);
    } finally {
      if (isWorkspaceSearchRequestCurrent(requestGeneration, requestGenerationRef.current)) setBusy(null);
    }
  };

  const inputClass = `min-h-11 w-full min-w-0 rounded-md border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 sm:min-h-9 ${
    isDarkMode
      ? 'border-slate-600 bg-[#1f1f24] text-slate-100 placeholder:text-slate-500'
      : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-500'
  }`;
  const secondaryButton = `min-h-11 rounded-md border px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-9 ${
    isDarkMode
      ? 'border-slate-600 bg-[#292930] text-slate-100 hover:bg-[#35353d]'
      : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
  }`;
  const primaryButton = 'min-h-11 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 sm:min-h-9';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center overflow-hidden bg-black/55 p-2 sm:p-6" role="presentation">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isBusy}
        onKeyDown={handleKeyDown}
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-3rem)] ${
          isDarkMode ? 'border-slate-700 bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'
        }`}
      >
        <header className={`flex shrink-0 items-start justify-between gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-bold sm:text-lg">工作区搜索与替换</h2>
            <p id={descriptionId} className={`mt-1 text-xs leading-5 sm:text-sm ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
              搜索读取已保存到磁盘的文件；替换必须先预览、确认，应用后可以撤销。
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={isBusy}
            aria-label={isBusy ? '操作进行中，暂不能关闭' : '关闭工作区搜索'}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
              isDarkMode ? 'hover:bg-slate-700' : 'hover:bg-slate-200'
            }`}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <form onSubmit={handleSubmit} className={`shrink-0 border-b p-3 sm:p-5 ${isDarkMode ? 'border-slate-700' : 'border-slate-200'}`}>
            <fieldset
              disabled={isBusy}
              data-workspace-search-control-scope="query"
              className="min-w-0 space-y-3 border-0 p-0"
            >
            <div className="grid min-w-0 grid-cols-2 gap-2" role="group" aria-label="搜索模式">
              <button
                type="button"
                aria-pressed={mode === 'search'}
                onClick={() => setMode('search')}
                className={`${secondaryButton} flex items-center justify-center gap-2 ${mode === 'search' ? 'border-blue-500 text-blue-500' : ''}`}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                搜索
              </button>
              <button
                type="button"
                aria-pressed={mode === 'replace'}
                onClick={() => setMode('replace')}
                className={`${secondaryButton} flex items-center justify-center gap-2 ${mode === 'replace' ? 'border-blue-500 text-blue-500' : ''}`}
              >
                <Replace className="h-4 w-4" aria-hidden="true" />
                替换
              </button>
            </div>

            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_auto] lg:items-end">
              <label htmlFor={queryId} className="min-w-0 text-sm font-semibold">
                搜索内容
                <input
                  ref={queryInputRef}
                  id={queryId}
                  value={query}
                  onChange={event => {
                    setQuery(event.target.value);
                    invalidateQueryResult();
                  }}
                  className={`${inputClass} mt-1 font-mono`}
                  placeholder={patternMode === 'regex' ? '例如：信息框\\s*\\(' : '输入要查找的文本'}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label className="min-w-0 text-sm font-semibold">
                搜索范围
                <select
                  value={scope}
                  onChange={event => {
                    setScope(event.target.value as WorkspaceSearchScope);
                    invalidateQueryResult();
                  }}
                  className={`${inputClass} mt-1`}
                >
                  <option value="file" disabled={!activeFilePath}>当前文件</option>
                  <option value="project" disabled={!activeProjectId}>当前项目</option>
                  <option value="workspace">整个工作区</option>
                </select>
              </label>
              <button type="submit" disabled={isBusy} className={`${primaryButton} flex items-center justify-center gap-2 lg:mb-0`}>
                {busy === 'query' ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                {busy === 'query' ? '搜索中…' : '开始搜索'}
              </button>
            </div>

            <fieldset className="flex min-w-0 flex-wrap gap-x-5 gap-y-2">
              <legend className="sr-only">搜索选项</legend>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${queryId}-pattern-mode`}
                  value="text"
                  checked={patternMode === 'text'}
                  onChange={() => {
                    setPatternMode('text');
                    invalidateQueryResult();
                  }}
                />
                纯文本
              </label>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`${queryId}-pattern-mode`}
                  value="regex"
                  checked={patternMode === 'regex'}
                  onChange={() => {
                    setPatternMode('regex');
                    invalidateQueryResult();
                  }}
                />
                正则表达式
              </label>
              <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={matchCase}
                  onChange={event => {
                    setMatchCase(event.target.checked);
                    invalidateQueryResult();
                  }}
                />
                区分大小写
              </label>
            </fieldset>

            {mode === 'replace' && (
              <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                <label htmlFor={replacementId} className="min-w-0 text-sm font-semibold">
                  替换为
                  <input
                    id={replacementId}
                    value={replacement}
                    onChange={event => {
                      setReplacement(event.target.value);
                      clearPreview();
                    }}
                    className={`${inputClass} mt-1 font-mono`}
                    placeholder="留空表示删除匹配内容"
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void createPreview()}
                  disabled={isBusy || replacementBlocked || !result?.queryId || selectedMatchIds.size === 0}
                  className={`${primaryButton} flex items-center justify-center gap-2`}
                  title={replacementBlocked ? '请先保存未保存的文件' : undefined}
                >
                  {busy === 'preview' && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                  生成替换预览
                </button>
              </div>
            )}

            {hasUnsavedFiles && (
              <div role="status" className={`flex min-w-0 flex-col gap-3 rounded-md border p-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
                isDarkMode ? 'border-amber-600/70 bg-amber-950/30 text-amber-100' : 'border-amber-400 bg-amber-50 text-amber-950'
              }`}>
                <span className="flex min-w-0 items-start gap-2 leading-5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  当前有未保存修改。搜索仍可运行，但只搜索已保存到磁盘的内容；替换预览与应用已禁用。
                </span>
                <button type="button" onClick={() => void saveBeforeReplace()} disabled={isBusy} className={`${secondaryButton} flex shrink-0 items-center justify-center gap-2`}>
                  {busy === 'save' ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
                  保存后继续
                </button>
              </div>
            )}
            </fieldset>
          </form>

          <div className="min-h-0 min-w-0 flex-1 p-3 sm:p-5">
            <fieldset
              disabled={isBusy}
              data-workspace-search-control-scope="results"
              className="min-w-0 border-0 p-0"
            >
            {error && (
              <div role="alert" className={`mb-3 flex items-start gap-2 rounded-md border p-3 text-sm leading-5 ${
                isDarkMode ? 'border-red-700 bg-red-950/40 text-red-100' : 'border-red-300 bg-red-50 text-red-950'
              }`}>
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}
            {successMessage && !error && (
              <div role="status" className={`mb-3 flex items-start gap-2 rounded-md border p-3 text-sm leading-5 ${
                isDarkMode ? 'border-emerald-700 bg-emerald-950/35 text-emerald-100' : 'border-emerald-300 bg-emerald-50 text-emerald-950'
              }`}>
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{successMessage}</span>
              </div>
            )}

            {busy === 'query' && !result ? (
              <div role="status" className="flex min-h-40 flex-col items-center justify-center gap-3 text-sm">
                <LoaderCircle className="h-7 w-7 animate-spin text-blue-500 motion-reduce:animate-none" aria-hidden="true" />
                正在搜索已保存到磁盘的文件…
              </div>
            ) : !result ? (
              <div className={`flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed px-4 text-center ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                <Search className="h-7 w-7" aria-hidden="true" />
                <p className="text-sm font-semibold">输入条件后开始搜索</p>
                <p className="text-xs leading-5">可搜索当前文件、当前项目或整个工作区。</p>
              </div>
            ) : (
              <section aria-labelledby={`${titleId}-results`} className="min-w-0 space-y-3">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 id={`${titleId}-results`} className="text-sm font-bold">搜索结果</h3>
                    <p className={`mt-0.5 text-xs ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                      {result.matches.length} 处匹配 · {groupedMatches.length} 个文件 · 已扫描 {result.scannedFiles} 个文件
                      {result.skippedFiles > 0 ? ` · 跳过 ${result.skippedFiles} 个文件` : ''}
                    </p>
                  </div>
                  {result.matches.length > 0 && (
                    <label className="flex min-h-9 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
                      <input
                        type="checkbox"
                        checked={selectedMatchIds.size === result.matches.length}
                        aria-label="选择全部搜索结果"
                        onChange={event => toggleAll(event.target.checked)}
                      />
                      全选（{selectedMatchIds.size}/{result.matches.length}）
                    </label>
                  )}
                </div>

                {result.truncated && (
                  <div role="status" className={`rounded-md border p-3 text-sm leading-5 ${
                    isDarkMode ? 'border-amber-600/70 bg-amber-950/30 text-amber-100' : 'border-amber-400 bg-amber-50 text-amber-950'
                  }`}>
                    结果已达到上限并被截断。替换只会处理当前明确勾选的匹配项。
                  </div>
                )}

                {result.diagnostics.length > 0 && (
                  <ul aria-label="搜索诊断" className={`space-y-1 rounded-md border p-3 text-xs leading-5 ${isDarkMode ? 'border-slate-700 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
                    {result.diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.code}-${diagnostic.filePath || ''}-${index}`} className="break-words">
                        <span className="font-semibold">{diagnostic.level === 'error' ? '错误' : diagnostic.level === 'warning' ? '警告' : '提示'}：</span>
                        {diagnostic.message}{diagnostic.filePath ? `（${diagnostic.filePath}）` : ''}
                      </li>
                    ))}
                  </ul>
                )}

                {result.matches.length === 0 ? (
                  <div role="status" className={`rounded-md border border-dashed p-6 text-center text-sm ${isDarkMode ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-600'}`}>
                    没有找到匹配内容。请调整搜索文本、范围或大小写选项。
                  </div>
                ) : (
                  <div className="min-w-0 space-y-3">
                    {groupedMatches.map(([filePath, matches]) => {
                      const selectedCount = matches.filter(match => selectedMatchIds.has(match.id)).length;
                      return (
                        <section key={filePath} className={`min-w-0 overflow-hidden rounded-md border ${isDarkMode ? 'border-slate-700 bg-[#202027]' : 'border-slate-200 bg-white'}`}>
                          <div className={`flex min-w-0 items-center gap-3 border-b px-3 py-2 ${isDarkMode ? 'border-slate-700 bg-[#292930]' : 'border-slate-200 bg-slate-100'}`}>
                            <input
                              type="checkbox"
                              checked={selectedCount === matches.length}
                              aria-checked={selectedCount > 0 && selectedCount < matches.length ? 'mixed' : selectedCount === matches.length}
                              aria-label={`选择文件 ${filePath} 的全部匹配`}
                              onChange={event => toggleFile(matches, event.target.checked)}
                            />
                            <FileText className="h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                            <h4 className="min-w-0 flex-1 break-all text-xs font-bold">{filePath}</h4>
                            <span className="shrink-0 text-xs tabular-nums">{selectedCount}/{matches.length}</span>
                          </div>
                          <ul className="divide-y divide-slate-500/20">
                            {matches.map(match => (
                              <li key={match.id} className="flex min-w-0 items-start gap-3 px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={selectedMatchIds.has(match.id)}
                                  aria-label={`选择 ${filePath} 第 ${match.line} 行第 ${match.column} 列的匹配`}
                                  onChange={event => toggleMatch(match.id, event.target.checked)}
                                  className="mt-1 shrink-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => onReveal(match)}
                                  className={`min-w-0 flex-1 rounded px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                                    isDarkMode ? 'hover:bg-slate-700/70' : 'hover:bg-blue-50'
                                  }`}
                                  aria-label={`打开 ${filePath} 第 ${match.line} 行第 ${match.column} 列`}
                                >
                                  <span className="block text-xs font-semibold tabular-nums text-blue-500">第 {match.line} 行，第 {match.column} 列</span>
                                  <span className="mt-0.5 block break-words font-mono text-xs leading-5">{match.preview}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {mode === 'replace' && preview && (
              <section aria-labelledby={`${titleId}-preview`} className={`mt-5 min-w-0 rounded-md border p-3 sm:p-4 ${isDarkMode ? 'border-blue-700/70 bg-blue-950/15' : 'border-blue-300 bg-blue-50/60'}`}>
                <h3 id={`${titleId}-preview`} className="text-sm font-bold">替换预览</h3>
                <p className={`mt-1 text-xs leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                  将在 {preview.files.length} 个文件中替换 {preview.replacementCount} 处。文件尚未修改。
                </p>
                <div className="mt-3 min-w-0 space-y-3">
                  {preview.files.map(file => (
                    <details key={file.filePath} open className={`min-w-0 overflow-hidden rounded border ${isDarkMode ? 'border-slate-700 bg-[#202027]' : 'border-slate-200 bg-white'}`}>
                      <summary className="cursor-pointer break-all px-3 py-2 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                        {file.filePath} · {file.replacements} 处
                      </summary>
                      <div className="grid min-w-0 gap-2 border-t border-slate-500/25 p-2 md:grid-cols-2">
                        <PreviewCode label="替换前" content={file.before} tone="before" isDarkMode={isDarkMode} />
                        <PreviewCode label="替换后" content={file.after} tone="after" isDarkMode={isDarkMode} />
                      </div>
                    </details>
                  ))}
                </div>
                {preview.diagnostics.length > 0 && (
                  <ul aria-label="替换预览诊断" className="mt-3 space-y-1 text-xs leading-5">
                    {preview.diagnostics.map((diagnostic, index) => (
                      <li key={`${diagnostic.code}-${index}`}>{diagnostic.message}</li>
                    ))}
                  </ul>
                )}
                <label htmlFor={confirmId} className={`mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-sm font-semibold leading-5 ${
                  isDarkMode ? 'border-slate-600 bg-[#292930]' : 'border-slate-300 bg-white'
                }`}>
                  <input
                    id={confirmId}
                    type="checkbox"
                    checked={confirmedPreview}
                    onChange={event => setConfirmedPreview(event.target.checked)}
                    className="mt-0.5 shrink-0"
                  />
                  我已检查以上替换预览，并确认应用到所选文件。
                </label>
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => void createPreview()}
                    disabled={isBusy || replacementBlocked}
                    className={secondaryButton}
                  >
                    重新生成预览
                  </button>
                  <button
                    type="button"
                    onClick={() => void applyPreview()}
                    disabled={isBusy || replacementBlocked || !confirmedPreview}
                    className={`${primaryButton} flex items-center justify-center gap-2`}
                  >
                    {busy === 'apply' && <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    确认并应用替换
                  </button>
                </div>
              </section>
            )}
            </fieldset>
          </div>
        </div>

        <footer className={`flex shrink-0 flex-col gap-2 border-t px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${isDarkMode ? 'border-slate-700 bg-[#202027]' : 'border-slate-200 bg-white'}`}>
          <div className={`min-w-0 text-xs leading-5 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            {busy ? getBusyLabel(busy) : result ? `已选择 ${selectedMatchIds.size} 处匹配` : '等待搜索'}
            {transactionIds.length > 0 ? ` · ${transactionIds.length} 个替换事务可撤销` : ''}
          </div>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
            {transactionIds.length > 0 && (
              <button
                type="button"
                onClick={() => void rollbackReplace()}
                disabled={isBusy}
                className={`${secondaryButton} flex items-center justify-center gap-2 border-amber-500 text-amber-500`}
              >
                {busy === 'rollback' ? <LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
                撤销最近一次替换
              </button>
            )}
            <button type="button" onClick={requestClose} disabled={isBusy} className={secondaryButton}>关闭</button>
          </div>
        </footer>

        <div className="sr-only" aria-live="polite" aria-atomic="true">{liveMessage}</div>
      </div>
    </div>
  );
}

function PreviewCode({
  label,
  content,
  tone,
  isDarkMode
}: {
  label: string;
  content: string;
  tone: 'before' | 'after';
  isDarkMode: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className={`mb-1 text-xs font-bold ${tone === 'before' ? 'text-red-500' : 'text-emerald-500'}`}>{label}</div>
      <pre className={`max-h-44 min-w-0 overflow-y-auto whitespace-pre-wrap break-all rounded p-2 text-xs leading-5 ${
        isDarkMode ? 'bg-black/35 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}>{content}</pre>
    </div>
  );
}

function trapDialogFocus(event: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

function getBusyLabel(operation: Exclude<WorkspaceSearchBusyOperation, null>): string {
  switch (operation) {
    case 'query': return '正在搜索已保存文件…';
    case 'save': return '正在保存文件…';
    case 'preview': return '正在生成替换预览…';
    case 'apply': return '正在应用替换…';
    case 'rollback': return '正在撤销本次替换…';
  }
}

function normalizeContextPath(value: string | undefined): string {
  return (value || '').replace(/\\/gu, '/').replace(/^\.\//u, '').replace(/\/{2,}/gu, '/');
}

export function createWorkspaceSearchQueryRequest(
  query: string,
  scope: WorkspaceSearchScope,
  patternMode: 'text' | 'regex',
  matchCase: boolean,
  activeFilePath?: string,
  activeProjectId?: string
): WorkspaceSearchQueryRequest {
  return {
    query,
    scope,
    isRegex: patternMode === 'regex',
    matchCase,
    filePath: scope === 'file' ? activeFilePath : undefined,
    projectId: scope === 'project' ? activeProjectId : undefined
  };
}
