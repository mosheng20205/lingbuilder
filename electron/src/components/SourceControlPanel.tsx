import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Columns2,
  FileDiff,
  FileText,
  GitBranch,
  GitMerge,
  History,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Tag as TagIcon,
  Trash2
} from 'lucide-react';
import { DiffEditor } from '@monaco-editor/react';
import type { SourceControlStatus } from '../types';
import { sourceControlService, type SourceControlMutation } from '../services/lingCpp/sourceControlService';

interface Branch { name: string; current: boolean; commit: string; subject: string }
interface Commit { hash: string; shortHash: string; authorName: string; authoredAt: string; subject: string; refs: string[] }
interface Remote { name: string; fetchUrl: string; pushUrl: string }
interface ConflictDetail { path: string; base: string; ours: string; theirs: string; working: string }
interface FileStatus { path: string; indexStatus: string; workingTreeStatus: string; originalPath?: string }
interface GitDiffResult { path: string; staged: boolean; patch: string; truncated: boolean; binary: boolean; original: string; modified: string; language: string }
interface StashEntry { index: number; message: string; createdAt: string }
interface TagEntry { name: string; commit: string; subject: string }
interface GitDialogField { name: string; label: string; value: string; required?: boolean; multiline?: boolean; options?: Array<{ value: string; label: string }> }
interface GitDialogConfig {
  title: string;
  description?: string;
  submitLabel: string;
  danger?: boolean;
  refresh?: boolean;
  fields: GitDialogField[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
}

interface SourceControlPanelProps {
  initialStatus: SourceControlStatus | null;
  isDarkMode: boolean;
  activeFilePath?: string;
  onChanged?: () => void;
  onExecuteCommand?: (operation: SourceControlMutation, payload?: Record<string, unknown>) => Promise<unknown>;
  variant?: 'compact' | 'full';
}

type DetailView = 'changes' | 'branches' | 'history' | 'remote' | 'conflicts' | 'diff' | 'stashes';

export default function SourceControlPanel({
  initialStatus,
  isDarkMode,
  activeFilePath,
  onChanged,
  onExecuteCommand,
  variant = 'compact'
}: SourceControlPanelProps) {
  const [status, setStatus] = useState(initialStatus);
  const [open, setOpen] = useState(variant === 'full');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [history, setHistory] = useState<Commit[]>([]);
  const [remotes, setRemotes] = useState<Remote[]>([]);
  const [stashes, setStashes] = useState<StashEntry[]>([]);
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [historyExhausted, setHistoryExhausted] = useState(false);
  const [diffMode, setDiffMode] = useState<'side-by-side' | 'patch'>('side-by-side');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<FileStatus[]>([]);
  const [conflictDetails, setConflictDetails] = useState<Record<string, ConflictDetail>>({});
  const [diff, setDiff] = useState<GitDiffResult | null>(null);
  const [detail, setDetail] = useState<DetailView>('changes');
  const [dialog, setDialog] = useState<GitDialogConfig | null>(null);
  const [dialogValues, setDialogValues] = useState<Record<string, string>>({});
  const [dialogError, setDialogError] = useState('');
  const [messageDialog, setMessageDialog] = useState<{ title: string; content: string } | null>(null);
  const busyRef = useRef(false);

  useEffect(() => setStatus(initialStatus), [initialStatus]);
  useEffect(() => { if (variant === 'full') setOpen(true); }, [variant]);

  const request = useCallback(async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.ok === false) throw new Error(body.error || 'Git 操作失败。');
    return (body.result ?? body) as T;
  }, []);

  const refresh = useCallback(async (notifyParent = true) => {
    const next = await request<SourceControlStatus>('/api/source-control/status');
    setStatus(next);
    if (notifyParent) onChanged?.();
    return next;
  }, [onChanged, request]);

  const mutate = useCallback(async (operation: SourceControlMutation, payload: Record<string, unknown> = {}) => (
    onExecuteCommand
      ? await onExecuteCommand(operation, payload)
      : await sourceControlService.execute(operation, payload)
  ), [onExecuteCommand]);

  const perform = useCallback(async (action: () => Promise<void>, options: { refresh?: boolean } = {}) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
      if (options.refresh !== false) await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh(false).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    const handleFocus = () => { if (!busyRef.current) void refresh(false).catch(() => undefined); };
    const handleVisibility = () => { if (document.visibilityState === 'visible') handleFocus(); };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refresh]);

  useEffect(() => {
    if (!dialog && !messageDialog) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || busy) return;
      event.preventDefault();
      if (messageDialog) setMessageDialog(null);
      else setDialog(null);
    };
    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [busy, dialog, messageDialog]);

  const files = (status?.files || []) as FileStatus[];
  const stagedPaths = useMemo(() => files.filter(file => Boolean(file.indexStatus) && file.indexStatus !== '?').map(file => file.path), [files]);
  const workingPaths = useMemo(() => files.filter(file => Boolean(file.workingTreeStatus)).map(file => file.path), [files]);

  const loadBranches = () => void perform(async () => {
    const [branchList, tagList] = await Promise.all([
      request<Branch[]>('/api/source-control/branches'),
      request<TagEntry[]>('/api/source-control/tags')
    ]);
    setBranches(branchList);
    setTags(tagList);
    setDetail('branches');
  });
  const loadHistory = (append = false) => void perform(async () => {
    const limit = 50;
    const skip = append ? history.length : 0;
    const next = await request<Commit[]>(`/api/source-control/history?limit=${limit}&skip=${skip}`);
    setHistory(append ? [...history, ...next] : next);
    setHistoryExhausted(next.length < limit);
    setDetail('history');
  });
  const loadStashes = () => void perform(async () => {
    setStashes(await request<StashEntry[]>('/api/source-control/stashes'));
    setDetail('stashes');
  });
  const loadRemote = () => void perform(async () => {
    setRemotes(await request<Remote[]>('/api/source-control/remotes'));
    setDetail('remote');
  });
  const readConflicts = useCallback(async () => {
    const nextFiles = await request<FileStatus[]>('/api/source-control/conflicts');
    const details = await Promise.all(nextFiles.map(file => request<ConflictDetail>(`/api/source-control/conflicts/file?path=${encodeURIComponent(file.path)}`)));
    setConflicts(nextFiles);
    setConflictDetails(Object.fromEntries(details.map(item => [item.path, item])));
  }, [request]);
  const loadConflicts = () => void perform(async () => {
    await readConflicts();
    setDetail('conflicts');
  });
  const loadDiff = (filePath: string, staged: boolean) => void perform(async () => {
    setDiff(await request<GitDiffResult>(`/api/source-control/diff?path=${encodeURIComponent(filePath)}&staged=${staged}`));
    setDetail('diff');
  }, { refresh: false });

  const openDialog = (config: GitDialogConfig) => {
    setDialog(config);
    setDialogValues(Object.fromEntries(config.fields.map(field => [field.name, field.value])));
    setDialogError('');
  };

  const submitDialog = async () => {
    if (!dialog || busyRef.current) return;
    const missing = dialog.fields.find(field => field.required && !dialogValues[field.name]?.trim());
    if (missing) { setDialogError(`${missing.label}不能为空。`); return; }
    busyRef.current = true;
    setBusy(true);
    setDialogError('');
    try {
      await dialog.onSubmit(dialogValues);
      if (dialog.refresh !== false) await refresh();
      setDialog(null);
    } catch (reason) {
      setDialogError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const initializeRepository = () => {
    openDialog({ title: '初始化 Git 仓库', description: '在当前工作区创建本地 Git 仓库。', submitLabel: '初始化', fields: [{ name: 'defaultBranch', label: '默认分支', value: 'main', required: true }], onSubmit: async values => { await mutate('init', { defaultBranch: values.defaultBranch.trim() }); } });
  };
  const createBranch = () => {
    openDialog({ title: '新建 Git 分支', submitLabel: '创建并切换', fields: [{ name: 'name', label: '分支名称', value: '', required: true }], onSubmit: async values => { setBranches(await mutate('branch.create', { name: values.name.trim(), checkout: true }) as Branch[]); } });
  };
  const addRemote = () => {
    openDialog({ title: '添加远程仓库', submitLabel: '添加', fields: [{ name: 'name', label: '远程名称', value: 'origin', required: true }, { name: 'url', label: '仓库地址', value: '', required: true }], onSubmit: async values => { setRemotes(await mutate('remote.add', { name: values.name.trim(), url: values.url.trim() }) as Remote[]); } });
  };
  const blame = () => {
    openDialog({ title: '查看文件 Blame', submitLabel: '查看', refresh: false, fields: [{ name: 'filePath', label: '工作区文件路径', value: activeFilePath || '', required: true }, { name: 'line', label: '起始行', value: '1', required: true }], onSubmit: async values => {
      const line = Number(values.line);
      if (!Number.isInteger(line) || line < 1) throw new Error('起始行必须是大于 0 的整数。');
      const lines = await request<Array<{ line: number; author: string; hash: string; text: string }>>(`/api/source-control/blame?path=${encodeURIComponent(values.filePath.trim())}&startLine=${line}&endLine=${line + 19}`);
      setMessageDialog({ title: `Blame：${values.filePath.trim()}`, content: lines.map(item => `${item.line} ${item.author} ${item.hash.slice(0, 8)} · ${item.text}`).join('\n') || '没有可显示的 Blame 记录。' });
    } });
  };

  const confirmDiscard = (file: FileStatus) => openDialog({
    title: file.workingTreeStatus === '?' ? '删除未跟踪文件' : '放弃未暂存更改',
    description: file.workingTreeStatus === '?'
      ? `“${file.path}”尚未被 Git 跟踪，将从磁盘永久删除且无法撤销。`
      : `“${file.path}”的未暂存修改将恢复为索引中的版本，且无法撤销。`,
    submitLabel: file.workingTreeStatus === '?' ? '永久删除' : '放弃更改',
    danger: true,
    fields: [],
    onSubmit: async () => { await mutate('discard', { paths: [file.path] }); }
  });

  const confirmDeleteBranch = (branch: Branch) => openDialog({
    title: '删除本地分支', description: `仅当“${branch.name}”已经合并时才会删除。`, submitLabel: '删除分支', danger: true, fields: [],
    onSubmit: async () => { setBranches(await mutate('branch.delete', { name: branch.name }) as Branch[]); }
  });

  const editRemote = (remote: Remote) => openDialog({
    title: `修改远程仓库 ${remote.name}`, submitLabel: '保存', fields: [{ name: 'url', label: '仓库地址', value: remote.fetchUrl, required: true }],
    onSubmit: async values => { setRemotes(await mutate('remote.update', { name: remote.name, url: values.url.trim() }) as Remote[]); }
  });

  const confirmDeleteRemote = (remote: Remote) => openDialog({
    title: '删除远程仓库', description: `删除“${remote.name}”的本地远程配置，不会删除服务器上的仓库。`, submitLabel: '删除远程', danger: true, fields: [],
    onSubmit: async () => { setRemotes(await mutate('remote.remove', { name: remote.name }) as Remote[]); }
  });

  const createPullRequest = (remote: Remote) => openDialog({
    title: '创建 Pull Request', description: `通过 GitHub CLI 在远程仓库“${remote.name}”创建 PR。`, submitLabel: '创建 PR', refresh: false,
    fields: [
      { name: 'head', label: '源分支', value: status.branch, required: true },
      { name: 'base', label: '目标分支', value: 'main', required: true },
      { name: 'title', label: 'PR 标题', value: '', required: true },
      { name: 'body', label: 'PR 说明', value: '', multiline: true }
    ],
    onSubmit: async values => {
      const pr = await mutate('pull-request.create', { remote: remote.name, head: values.head.trim(), base: values.base.trim(), title: values.title.trim(), body: values.body }) as { url: string };
      setMessageDialog({ title: 'Pull Request 已创建', content: pr.url });
    }
  });

  const openIntegrationDialog = (operation: 'merge' | 'rebase') => openDialog({
    title: operation === 'merge' ? '合并分支' : '变基分支',
    description: operation === 'merge' ? `把指定分支合并到当前分支“${status.branch}”。` : `把当前分支“${status.branch}”变基到指定分支。`,
    submitLabel: operation === 'merge' ? '开始合并' : '开始变基',
    fields: [{ name: 'branch', label: '目标分支', value: '', required: true }],
    onSubmit: async values => { await mutate(operation, { branch: values.branch.trim() }); }
  });

  const openIntegrationLifecycleDialog = (operation: 'integration.continue' | 'integration.abort') => openDialog({
    title: operation === 'integration.continue' ? '继续集成操作' : '中止集成操作',
    description: operation === 'integration.continue' ? '确认冲突已经全部解决并暂存。' : '工作区将恢复到合并或变基开始前的状态。',
    submitLabel: operation === 'integration.continue' ? '继续' : '中止',
    danger: operation === 'integration.abort',
    fields: [{ name: 'kind', label: '操作类型', value: 'merge', required: true, options: [{ value: 'merge', label: 'merge（合并）' }, { value: 'rebase', label: 'rebase（变基）' }] }],
    onSubmit: async values => { await mutate(operation, { kind: values.kind }); await readConflicts(); }
  });

  const stashChanges = () => {
    openDialog({
      title: '贮藏当前更改',
      description: '把工作区和已暂存的更改保存到贮藏栈，工作区恢复干净；未跟踪文件默认不包含。',
      submitLabel: '贮藏',
      fields: [
        { name: 'message', label: '贮藏说明（可选）', value: '' },
        { name: 'includeUntracked', label: '包含未跟踪文件', value: 'no', options: [{ value: 'no', label: '不包含' }, { value: 'yes', label: '包含' }] }
      ],
      onSubmit: async values => { setStashes(await mutate('stash.save', { message: values.message.trim(), includeUntracked: values.includeUntracked === 'yes' }) as StashEntry[]); }
    });
  };
  const applyStash = (stash: StashEntry, pop: boolean) => openDialog({
    title: pop ? '弹出贮藏' : '应用贮藏',
    description: pop
      ? `把贮藏 ${stash.index} 的更改应用到工作区并从贮藏栈删除；如产生冲突会保留该贮藏。`
      : `把贮藏 ${stash.index} 的更改应用到工作区，贮藏栈保留该条目。`,
    submitLabel: pop ? '弹出' : '应用',
    fields: [],
    onSubmit: async () => { await mutate('stash.apply', { index: stash.index, pop }); }
  });
  const dropStash = (stash: StashEntry) => openDialog({
    title: '删除贮藏',
    description: `“stash@{${stash.index}} ${stash.message}”将被永久删除且无法撤销。`,
    submitLabel: '删除贮藏',
    danger: true,
    fields: [],
    onSubmit: async () => { setStashes(await mutate('stash.drop', { index: stash.index }) as StashEntry[]); }
  });
  const createTagDialog = () => openDialog({
    title: '新建 Git 标签',
    description: '在当前提交上创建标签；填写说明会创建附注标签，留空创建轻量标签。',
    submitLabel: '创建标签',
    fields: [
      { name: 'name', label: '标签名称', value: '', required: true },
      { name: 'message', label: '标签说明（可选）', value: '', multiline: true }
    ],
    onSubmit: async values => { setTags(await mutate('tag.create', { name: values.name.trim(), message: values.message }) as TagEntry[]); }
  });
  const deleteTagConfirm = (tag: TagEntry) => openDialog({
    title: '删除标签',
    description: `本地标签“${tag.name}”将被删除，不会影响远程标签。`,
    submitLabel: '删除标签',
    danger: true,
    fields: [],
    onSubmit: async () => { setTags(await mutate('tag.delete', { name: tag.name }) as TagEntry[]); }
  });

  const toggleCollapsedGroup = (key: string) => {
    setCollapsedGroups(current => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const groupByDirectory = (fileList: FileStatus[]): Array<[string, FileStatus[]]> => {
    const groups = new Map<string, FileStatus[]>();
    for (const file of fileList) {
      const separator = file.path.lastIndexOf('/');
      const directory = separator === -1 ? '' : file.path.slice(0, separator);
      const current = groups.get(directory);
      if (current) current.push(file); else groups.set(directory, [file]);
    }
    return [...groups.entries()];
  };
  const renderFileRow = (file: FileStatus, rowKind: 'working' | 'staged') => {
    const isWorking = rowKind === 'working';
    const statusCode = isWorking ? file.workingTreeStatus : file.indexStatus;
    const separator = file.path.lastIndexOf('/');
    const displayName = separator === -1 ? file.path : file.path.slice(separator + 1);
    const diffTitle = isWorking ? `查看工作区差异：${file.path}` : `查看已暂存差异：${file.path}`;
    return <div key={`${rowKind}:${file.path}`} className="group flex min-h-7 items-center gap-1 rounded px-1 pl-2 hover:bg-black/10">
      <span className={`w-4 text-center font-mono font-bold ${isWorking ? 'text-amber-500' : 'text-emerald-500'}`} title={gitStatusLabel(statusCode)}>{statusCode}</span>
      <button type="button" disabled={busy} onClick={() => loadDiff(file.path, !isWorking)} className="min-w-0 flex-1 truncate text-left" title={diffTitle}>{displayName}</button>
      {isWorking
        ? <button type="button" disabled={busy} onClick={() => void perform(async () => { await mutate('stage', { paths: [file.path] }); })} aria-label={`暂存此文件 ${file.path}`} title="暂存此文件" className="rounded p-1 text-emerald-500 opacity-0 hover:bg-black/10 group-hover:opacity-100 focus-visible:opacity-100"><Plus className="h-3 w-3" /></button>
        : <button type="button" disabled={busy} onClick={() => void perform(async () => { await mutate('unstage', { paths: [file.path] }); })} aria-label={`取消暂存此文件 ${file.path}`} title="取消暂存此文件" className="rounded p-1 opacity-0 hover:bg-black/10 group-hover:opacity-100 focus-visible:opacity-100"><Minus className="h-3 w-3" /></button>}
      <button type="button" disabled={busy} onClick={() => loadDiff(file.path, !isWorking)} aria-label={`${isWorking ? '查看差异' : '查看已暂存差异'} ${file.path}`} title={isWorking ? '查看差异' : '查看已暂存差异'} className="rounded p-1 opacity-70 hover:bg-black/10 group-hover:opacity-100"><FileDiff className="h-3 w-3" /></button>
      {isWorking && <button type="button" disabled={busy} onClick={() => confirmDiscard(file)} aria-label={`放弃更改 ${file.path}`} title="放弃未暂存更改" className="rounded p-1 text-rose-500 opacity-70 hover:bg-black/10 group-hover:opacity-100"><RotateCcw className="h-3 w-3" /></button>}
    </div>;
  };
  const renderGroupedRows = (fileList: FileStatus[], rowKind: 'working' | 'staged') => groupByDirectory(fileList).map(([directory, groupFiles]) => {
    const key = `${rowKind}:${directory}`;
    const collapsed = collapsedGroups.has(key);
    return <div key={key}>
      {directory !== '' && <button type="button" aria-expanded={!collapsed} onClick={() => toggleCollapsedGroup(key)} className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-black/10" title={directory}>
        {collapsed ? <ChevronRight className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        <span className="min-w-0 flex-1 truncate opacity-75">{directory}</span>
        <span className="rounded-full bg-black/10 px-1 text-center text-[9px] font-semibold opacity-80">{groupFiles.length}</span>
      </button>}
      {!collapsed && groupFiles.map(file => renderFileRow(file, rowKind))}
    </div>;
  });

  const surface = isDarkMode ? 'border-[#2d2d34] bg-[#1e1e1e]' : 'border-slate-200 bg-white';
  const buttonClass = 'rounded border border-inherit px-1.5 py-1 hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] disabled:cursor-not-allowed disabled:opacity-40';
  const dialogs = <>
    {dialog && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setDialog(null); }}>
      <form className={`w-full max-w-md rounded-lg border p-4 shadow-2xl ${surface}`} role="dialog" aria-modal="true" aria-labelledby="git-dialog-title" onSubmit={event => { event.preventDefault(); void submitDialog(); }}>
        <h2 id="git-dialog-title" className="text-sm font-semibold">{dialog.title}</h2>
        {dialog.description && <p className="mt-2 whitespace-pre-wrap text-[11px] opacity-75">{dialog.description}</p>}
        <div className="mt-3 space-y-3">
          {dialog.fields.map((field, index) => <label key={field.name} className="block text-[11px] font-medium">
            <span>{field.label}{field.required ? ' *' : ''}</span>
            {field.options
              ? <select autoFocus={index === 0} value={dialogValues[field.name] || ''} onChange={event => setDialogValues(current => ({ ...current, [field.name]: event.target.value }))} className={`mt-1 w-full rounded border border-inherit px-2 py-1.5 ${isDarkMode ? 'bg-[#252526]' : 'bg-white'}`}>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : field.multiline
                ? <textarea autoFocus={index === 0} rows={5} value={dialogValues[field.name] || ''} onChange={event => setDialogValues(current => ({ ...current, [field.name]: event.target.value }))} className={`mt-1 w-full resize-y rounded border border-inherit px-2 py-1.5 ${isDarkMode ? 'bg-[#252526]' : 'bg-white'}`} />
                : <input autoFocus={index === 0} value={dialogValues[field.name] || ''} onChange={event => setDialogValues(current => ({ ...current, [field.name]: event.target.value }))} className={`mt-1 w-full rounded border border-inherit px-2 py-1.5 ${isDarkMode ? 'bg-[#252526]' : 'bg-white'}`} />}
          </label>)}
        </div>
        {dialogError && <div role="alert" className="mt-3 rounded bg-rose-500/10 p-2 text-[11px] text-rose-500">{dialogError}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={() => setDialog(null)} className={buttonClass}>取消</button>
          <button type="submit" disabled={busy} className={`rounded px-3 py-1.5 font-semibold text-white disabled:opacity-40 ${dialog.danger ? 'bg-rose-600 hover:bg-rose-500' : 'bg-[#007ACC] hover:bg-[#1687cf]'}`}>{busy ? '正在执行…' : dialog.submitLabel}</button>
        </div>
      </form>
    </div>}
    {messageDialog && <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/55 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setMessageDialog(null); }}>
      <div className={`w-full max-w-lg rounded-lg border p-4 shadow-2xl ${surface}`} role="dialog" aria-modal="true" aria-labelledby="git-message-title">
        <h2 id="git-message-title" className="text-sm font-semibold">{messageDialog.title}</h2>
        <pre className={`mt-3 max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded border border-inherit p-2 text-[11px] ${isDarkMode ? 'bg-black/20' : 'bg-slate-50'}`}>{messageDialog.content}</pre>
        <div className="mt-4 flex justify-end"><button type="button" autoFocus onClick={() => setMessageDialog(null)} className={buttonClass}>关闭</button></div>
      </div>
    </div>}
  </>;

  if (!status) {
    return <><div className={`h-full p-3 text-[11px] ${surface}`} role="status">正在读取 Git 状态…</div>{dialogs}</>;
  }

  if (!status.isRepository) {
    return <><div className={`${variant === 'full' ? 'h-full p-3' : 'rounded border px-2 py-1.5'} text-[10px] ${surface}`}>
      <div className="flex items-center gap-1.5 text-[12px] font-semibold"><GitBranch className="h-4 w-4 text-[#007ACC]" /><span>Git 更改</span></div>
      <div className="mt-4 text-center text-[11px] opacity-70">当前工作区不是 Git 仓库</div>
      {status.error && <div role="alert" className="mt-2 whitespace-pre-wrap text-center text-rose-500">{status.error}</div>}
      {error && <div role="alert" className="mt-2 whitespace-pre-wrap text-center text-rose-500">{error}</div>}
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" disabled={busy} onClick={initializeRepository} className={buttonClass}><Plus className="mr-1 inline h-3 w-3" />初始化仓库</button>
        <button type="button" disabled={busy} onClick={() => void perform(async () => undefined)} className={buttonClass}><RefreshCw className={`mr-1 inline h-3 w-3 ${busy ? 'animate-spin' : ''}`} />重新检测</button>
      </div>
    </div>{dialogs}</>;
  }

  return <><div className={`${variant === 'full' ? 'flex h-full flex-col border-y-0 border-l-0' : 'rounded'} border text-[10px] ${surface}`} aria-label="Git 源代码管理">
    <button type="button" aria-expanded={open} className={`${variant === 'full' ? 'min-h-10 text-[12px] font-semibold' : ''} flex w-full items-center gap-1 px-2 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#007ACC]`} onClick={() => variant === 'compact' && setOpen(value => !value)}>
      {variant === 'compact' && (open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />)}
      <GitBranch className={`${variant === 'full' ? 'h-4 w-4 text-[#007ACC]' : 'h-3 w-3'}`} />
      <span className="min-w-0 flex-1 truncate">{variant === 'full' ? 'Git 更改' : status.branch || 'detached'}</span>
      {variant === 'full' && <span className="max-w-[45%] truncate text-[10px] font-normal opacity-70" title={status.branch || 'detached'}>{status.branch || 'detached'}{status.ahead ? ` ↑${status.ahead}` : ''}{status.behind ? ` ↓${status.behind}` : ''}</span>}
      <span className="min-w-4 rounded-full bg-amber-500/15 px-1 text-center font-semibold text-amber-500">{files.length}</span>
    </button>

    {open && <div className={`${variant === 'full' ? 'min-h-0 flex-1 overflow-y-auto' : ''} border-t border-inherit p-2`}>
      <div className="mb-2 flex gap-1">
        <button type="button" disabled={busy} aria-label="显示 Git 更改" title="改动" onClick={() => setDetail('changes')} className={buttonClass}><Check className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="显示 Git 分支" title="分支" onClick={loadBranches} className={buttonClass}><GitBranch className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="显示远程同步" title="远程仓库（推送/拉取地址设置）" onClick={loadRemote} className={buttonClass}><Cloud className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="显示 Git 冲突" title="冲突" onClick={loadConflicts} className={buttonClass}><GitMerge className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="显示提交历史" title="历史" onClick={() => loadHistory(false)} className={buttonClass}><History className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="显示 Git 贮藏" title="贮藏" onClick={loadStashes} className={buttonClass}><Archive className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="查看文件 Blame" title="Blame" onClick={blame} className={buttonClass}><Search className="h-3 w-3" /></button>
        <button type="button" disabled={busy} aria-label="刷新 Git 状态" title="刷新" onClick={() => void perform(async () => undefined)} className={`${buttonClass} ml-auto`}><RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /></button>
      </div>

      {error && <div role="alert" className="mb-2 whitespace-pre-wrap rounded bg-rose-500/10 p-2 text-rose-500">{error}</div>}

      {detail === 'changes' && <>
        <div className="mb-2 flex min-h-6 items-center gap-1.5 border-b border-inherit pb-1.5 text-[10px]">
          <GitBranch className="h-3 w-3 shrink-0 text-[#007ACC]" />
          <span className="shrink-0 font-semibold" title={status.branch || 'detached'}>{status.branch || 'detached'}</span>
          {status.upstream ? (<>
            <span className="min-w-0 flex-1 truncate opacity-70" title={`跟踪远程分支 ${status.upstream}`}>→ {status.upstream}</span>
            {status.ahead > 0 && <span className="shrink-0 font-semibold text-emerald-500" title={`领先远程 ${status.ahead} 个提交`}>↑{status.ahead}</span>}
            {status.behind > 0 && <span className="shrink-0 font-semibold text-amber-500" title={`落后远程 ${status.behind} 个提交`}>↓{status.behind}</span>}
            <button type="button" disabled={busy} onClick={loadRemote} className="ml-auto shrink-0 rounded px-1 py-0.5 text-[#007ACC] hover:bg-black/10" title="打开远程同步视图：获取、拉取、推送、修改远程地址">远程同步</button>
          </>) : (<>
            <span className="min-w-0 flex-1 truncate opacity-60">本地分支，未跟踪远程</span>
            <button type="button" disabled={busy} onClick={loadRemote} className="ml-auto shrink-0 rounded px-1 py-0.5 text-amber-500 underline decoration-dotted underline-offset-2 hover:bg-black/10" title="打开远程同步视图，添加或修改远程仓库推送地址">未设置推送地址，点击配置 →</button>
          </>)}
        </div>
        <label htmlFor="git-commit-message" className="mb-1 block font-semibold">提交说明</label>
        <textarea id="git-commit-message" value={message} onChange={event => setMessage(event.target.value)} placeholder="输入提交说明（必填）" rows={3} maxLength={4000} className={`mb-1 w-full resize-y rounded border border-inherit px-2 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007ACC] ${isDarkMode ? 'bg-black/20' : 'bg-white'}`} />
        <button disabled={busy || !message.trim() || (stagedPaths.length === 0 && workingPaths.length === 0)} onClick={() => void perform(async () => { if (stagedPaths.length === 0 && workingPaths.length > 0) await mutate('stage.all', {}); await mutate('commit', { message }); setMessage(''); })} title={stagedPaths.length === 0 && workingPaths.length > 0 ? '当前没有已暂存文件，将先把全部修改加入暂存区再提交' : '提交暂存区中的全部更改'} className="mb-3 w-full rounded bg-[#007ACC] px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-[#1687cf] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40">{stagedPaths.length === 0 && workingPaths.length > 0 ? '暂存全部并提交' : '提交已暂存更改'}</button>

        <section aria-labelledby="git-working-changes-title" className="mb-3">
          <div className="mb-1 flex min-h-7 items-center gap-1 border-b border-inherit">
            <h3 id="git-working-changes-title" className="min-w-0 flex-1 truncate text-[11px] font-semibold">更改 <span className="opacity-60">({workingPaths.length})</span></h3>
            <button type="button" disabled={busy || workingPaths.length === 0} title="把全部未暂存修改加入暂存区（悬停单个文件行可只暂存该文件）" aria-label="全部暂存" onClick={() => void perform(async () => { await mutate('stage.all', {}); })} className={buttonClass}>全部暂存</button>
          </div>
          {workingPaths.length === 0 ? <div className="py-2 text-center opacity-55">没有未暂存的更改</div> : renderGroupedRows(files.filter(file => Boolean(file.workingTreeStatus)), 'working')}
        </section>

        <section aria-labelledby="git-staged-changes-title">
          <div className="mb-1 flex min-h-7 items-center gap-1 border-b border-inherit">
            <h3 id="git-staged-changes-title" className="min-w-0 flex-1 truncate text-[11px] font-semibold">已暂存的更改 <span className="opacity-60">({stagedPaths.length})</span></h3>
            <button type="button" disabled={busy || stagedPaths.length === 0} title="取消全部暂存（文件修改仍保留在工作区，不会丢失）" aria-label="全部取消暂存" onClick={() => void perform(async () => { await mutate('unstage.all', {}); })} className={buttonClass}>全部取消暂存</button>
          </div>
          {stagedPaths.length === 0 ? <div className="py-2 text-center opacity-55">暂存更改后即可提交</div> : renderGroupedRows(files.filter(file => Boolean(file.indexStatus) && file.indexStatus !== '?'), 'staged')}
        </section>

        {files.length === 0 && <div className="mt-6 text-center text-[11px] opacity-65"><Check className="mx-auto mb-1 h-5 w-5 text-emerald-500" /><div>工作树是干净的</div><div className="mt-0.5 text-[9px]">没有需要提交的更改</div></div>}
      </>}

      {detail === 'diff' && <div>
        <div className="mb-2 flex items-center gap-1">
          <button type="button" disabled={busy} onClick={() => setDetail('changes')} className={buttonClass}><ChevronLeft className="mr-1 inline h-3 w-3" />返回更改</button>
          {diff && !diff.binary && <div className="ml-auto flex gap-1">
            <button type="button" disabled={busy} aria-pressed={diffMode === 'side-by-side'} title="并排差异视图" onClick={() => setDiffMode('side-by-side')} className={diffMode === 'side-by-side' ? `${buttonClass} border-[#007ACC] text-[#007ACC]` : buttonClass}><Columns2 className="h-3 w-3" /></button>
            <button type="button" disabled={busy} aria-pressed={diffMode === 'patch'} title="补丁文本视图" onClick={() => setDiffMode('patch')} className={diffMode === 'patch' ? `${buttonClass} border-[#007ACC] text-[#007ACC]` : buttonClass}><FileText className="h-3 w-3" /></button>
          </div>}
        </div>
        {diff && <>
          <div className="mb-1 flex items-center gap-1 font-semibold"><FileDiff className="h-3.5 w-3.5 text-[#007ACC]" /><span className="min-w-0 flex-1 truncate" title={diff.path}>{diff.path}</span><span className="opacity-60">{diff.staged ? '已暂存' : '工作区'}</span></div>
          {diff.truncated && <div role="status" className="mb-1 rounded bg-amber-500/10 p-1 text-amber-500">差异超过 2 MB，当前只显示前 2 MB。</div>}
          {diff.binary
            ? <pre className={`max-h-[65vh] overflow-auto whitespace-pre font-mono text-[10px] leading-4 ${isDarkMode ? 'bg-black/20' : 'bg-slate-50'} rounded border border-inherit p-2`}>{diff.patch}</pre>
            : diffMode === 'side-by-side'
              ? <div className="h-[60vh] overflow-hidden rounded border border-inherit">
                <DiffEditor
                  height="100%"
                  original={diff.original}
                  modified={diff.modified}
                  language={diff.language}
                  theme={isDarkMode ? 'epl-dark' : 'epl-light'}
                  options={{
                    readOnly: true,
                    renderSideBySide: true,
                    renderOverviewRuler: false,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    fontSize: 11,
                    automaticLayout: true,
                    lineNumbersMinChars: 3,
                    folding: false,
                    renderLineHighlight: 'none',
                    diffWordWrap: 'off'
                  }}
                  loading={<div className={`p-3 text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>正在加载差异视图…</div>}
                />
              </div>
              : <pre className={`max-h-[65vh] overflow-auto whitespace-pre font-mono text-[10px] leading-4 ${isDarkMode ? 'bg-black/20' : 'bg-slate-50'} rounded border border-inherit p-2`}>{diff.patch}</pre>}
        </>}
      </div>}

      {detail === 'branches' && <div>
        <button type="button" disabled={busy} onClick={createBranch} className={`${buttonClass} mb-1`}><Plus className="inline h-3 w-3" /> 新建分支</button>
        {branches.length === 0 && <div className="py-2 text-center opacity-60">没有本地分支。</div>}
        {branches.map(branch => <div key={branch.name} className="flex items-center border-t border-inherit">
          <button disabled={busy || branch.current} onClick={() => void perform(async () => { setBranches(await mutate('branch.checkout', { name: branch.name }) as Branch[]); })} className={`min-w-0 flex-1 truncate py-1 text-left disabled:opacity-60 ${branch.current ? 'text-blue-500' : ''}`} title={branch.subject}>{branch.current ? '● ' : ''}{branch.name}</button>
          {!branch.current && <button disabled={busy} title={`删除分支 ${branch.name}`} onClick={() => confirmDeleteBranch(branch)} className="px-1 text-rose-500 disabled:opacity-40"><Trash2 className="h-3 w-3" /></button>}
        </div>)}
        <div className="mt-3 mb-1 flex items-center border-t border-inherit pt-2">
          <span className="flex-1 text-[11px] font-semibold">标签 <span className="opacity-60">({tags.length})</span></span>
          <button type="button" disabled={busy} onClick={createTagDialog} className={buttonClass}><Plus className="mr-1 inline h-3 w-3" />新建标签</button>
        </div>
        {tags.length === 0 && <div className="py-2 text-center opacity-60">没有本地标签。</div>}
        {tags.map(tag => <div key={tag.name} className="flex items-center border-t border-inherit">
          <div className="min-w-0 flex-1 truncate py-1" title={tag.subject}><TagIcon className="mr-1 inline h-3 w-3 text-[#007ACC]" />{tag.name}<span className="ml-1 opacity-60">{tag.subject}</span></div>
          <button disabled={busy} title={`删除标签 ${tag.name}`} onClick={() => deleteTagConfirm(tag)} className="px-1 text-rose-500 disabled:opacity-40"><Trash2 className="h-3 w-3" /></button>
        </div>)}
      </div>}

      {detail === 'stashes' && <div>
        <div className="mb-1 flex items-center">
          <span className="flex-1 font-semibold">贮藏栈 <span className="opacity-60">({stashes.length})</span></span>
          <button type="button" disabled={busy} onClick={stashChanges} className={buttonClass}><Plus className="mr-1 inline h-3 w-3" />贮藏更改</button>
        </div>
        {stashes.length === 0 && <div className="py-2 text-center opacity-60">当前没有贮藏条目。</div>}
        {stashes.map(stash => <div key={stash.index} className="border-t border-inherit py-1">
          <div className="truncate font-medium" title={stash.message}>{`stash@{${stash.index}}`} · {stash.message || '（无说明）'}</div>
          <div className="truncate text-[9px] opacity-60">{stash.createdAt}</div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button disabled={busy} onClick={() => applyStash(stash, false)} className={buttonClass}>应用</button>
            <button disabled={busy} onClick={() => applyStash(stash, true)} className={buttonClass}>弹出</button>
            <button disabled={busy} onClick={() => dropStash(stash)} className={`${buttonClass} text-rose-500`}>删除</button>
          </div>
        </div>)}
      </div>}

      {detail === 'history' && <div className="max-h-[65vh] overflow-auto">
        {history.length === 0 && <div className="py-2 text-center opacity-60">当前没有提交历史。</div>}
        {history.map(commit => <div key={commit.hash} className="border-t border-inherit py-1"><div className="truncate font-medium">{commit.subject}</div><div className="truncate opacity-60">{commit.shortHash} · {commit.authorName} · {new Date(commit.authoredAt).toLocaleString()}</div></div>)}
        {history.length > 0 && (historyExhausted
          ? <div className="py-2 text-center opacity-55">已加载全部提交（{history.length} 条）</div>
          : <button type="button" disabled={busy} onClick={() => loadHistory(true)} className={`${buttonClass} my-1 w-full`}>加载更多（已显示 {history.length} 条）</button>)}
      </div>}

      {detail === 'remote' && <div>
        <div className="mb-1 flex items-center"><span className="flex-1 font-semibold">远程同步</span><button type="button" disabled={busy} onClick={addRemote} className={buttonClass}><Plus className="mr-1 inline h-3 w-3" />添加远程</button></div>
        {remotes.length === 0 && <div className="py-2 text-center opacity-60">没有已配置的远程仓库。</div>}
        {remotes.map(remote => <div key={remote.name} className="border-t border-inherit py-1">
          <div className="flex items-center gap-1"><div className="min-w-0 flex-1 truncate" title={remote.fetchUrl}>{remote.name} · {remote.fetchUrl}</div><button type="button" disabled={busy} title="修改远程地址" onClick={() => editRemote(remote)} className="rounded p-1"><Pencil className="h-3 w-3" /></button><button type="button" disabled={busy} title="删除远程仓库" onClick={() => confirmDeleteRemote(remote)} className="rounded p-1 text-rose-500"><Trash2 className="h-3 w-3" /></button></div>
          <div className="mt-1 flex flex-wrap gap-1">
            <button disabled={busy} onClick={() => void perform(async () => { await mutate('fetch', { remote: remote.name }); })} className={buttonClass}>获取</button>
            <button disabled={busy || !status.branch} onClick={() => void perform(async () => { await mutate('pull', { remote: remote.name, branch: status.branch, strategy: 'ff-only' }); })} className={buttonClass}>快进拉取</button>
            <button disabled={busy || !status.branch} onClick={() => void perform(async () => { await mutate('push', { remote: remote.name, branch: status.branch, setUpstream: !status.upstream }); })} className={buttonClass}>推送</button>
            <button disabled={busy || !status.branch} onClick={() => createPullRequest(remote)} className={buttonClass}>创建 PR</button>
          </div>
        </div>)}
        <div className="mt-2 flex gap-1">
          <button disabled={busy} onClick={() => openIntegrationDialog('merge')} className={buttonClass}>合并…</button>
          <button disabled={busy} onClick={() => openIntegrationDialog('rebase')} className={buttonClass}>变基…</button>
        </div>
      </div>}

      {detail === 'conflicts' && <div>
        <div className="mb-1 font-semibold">三方冲突编辑</div>
        {conflicts.length === 0 && <div className="py-2 text-center opacity-60">当前没有未解决冲突。</div>}
        {conflicts.map(file => {
          const item = conflictDetails[file.path];
          return <div key={file.path} className="border-t border-inherit py-1">
            <div className="truncate">{file.indexStatus}{file.workingTreeStatus} · {file.path}</div>
            {item && <>
              <div className="mt-1 grid grid-cols-1 gap-1 xl:grid-cols-3"><pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-black/10 p-1" title="共同基础">基础\n{item.base}</pre><pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-black/10 p-1" title="当前分支">当前\n{item.ours}</pre><pre className="max-h-28 overflow-auto whitespace-pre-wrap rounded bg-black/10 p-1" title="传入分支">传入\n{item.theirs}</pre></div>
              <textarea aria-label={`合并内容 ${file.path}`} value={item.working} onChange={event => setConflictDetails(current => ({ ...current, [file.path]: { ...item, working: event.target.value } }))} rows={7} className={`mt-1 w-full resize-y rounded border border-inherit p-1 font-mono ${isDarkMode ? 'bg-black/20' : 'bg-white'}`} />
            </>}
            <div className="mt-1 flex flex-wrap gap-1">
              <button disabled={busy} onClick={() => void perform(async () => { await mutate('conflict.resolve', { path: file.path, resolution: 'ours' }); await readConflicts(); })} className={buttonClass}>采用当前</button>
              <button disabled={busy} onClick={() => void perform(async () => { await mutate('conflict.resolve', { path: file.path, resolution: 'theirs' }); await readConflicts(); })} className={buttonClass}>采用传入</button>
              <button disabled={busy || !item} onClick={() => void perform(async () => { await mutate('conflict.resolve', { path: file.path, resolution: 'manual', content: item?.working }); await readConflicts(); })} className={buttonClass}>保存合并结果</button>
            </div>
          </div>;
        })}
        <div className="mt-2 flex flex-wrap gap-1">
          <button disabled={busy} onClick={() => openIntegrationLifecycleDialog('integration.continue')} className={buttonClass}>继续</button>
          <button disabled={busy} onClick={() => openIntegrationLifecycleDialog('integration.abort')} className={`${buttonClass} text-rose-500`}>中止</button>
        </div>
      </div>}
    </div>}
  </div>{dialogs}</>;
}

function gitStatusLabel(status: string): string {
  return ({ M: '已修改', A: '已添加', D: '已删除', R: '已重命名', C: '已复制', U: '存在冲突', '?': '未跟踪' } as Record<string, string>)[status] || status || '无更改';
}
