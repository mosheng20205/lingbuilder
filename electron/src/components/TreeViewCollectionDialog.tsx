import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Copy, GitBranch, Plus, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import {
  appendTreeViewNode,
  deleteTreeViewNode,
  duplicateTreeViewNode,
  flattenTreeViewNodes,
  isTreeViewNodeIdAvailable,
  moveTreeViewNode,
  normalizeTreeViewNodes,
  reparentTreeViewNode,
  updateTreeViewNode,
  type TreeViewEditableNode
} from '../services/windowDesigner/treeViewCollectionModel';

interface TreeViewCollectionDialogProps {
  controlName: string;
  value: Win32ControlPropertyValue | undefined;
  showImages: boolean;
  isDarkMode: boolean;
  onChange: (nodes: TreeViewEditableNode[]) => void;
  onClose: () => void;
}

export default function TreeViewCollectionDialog({ controlName, value, showImages, isDarkMode, onChange, onClose }: TreeViewCollectionDialogProps) {
  const nodes = useMemo(() => normalizeTreeViewNodes(value), [value]);
  const flatNodes = useMemo(() => flattenTreeViewNodes(nodes), [nodes]);
  const [selectedId, setSelectedId] = useState<string | null>(() => flatNodes[0]?.node.id ?? null);
  const [notice, setNotice] = useState('');
  const [idDraft, setIdDraft] = useState('');
  const firstButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const selected = flatNodes.find(item => item.node.id === selectedId);
  const selectedDescendantIds = new Set(selected ? flattenTreeViewNodes(selected.node.children).map(item => item.node.id) : []);
  const nodeCount = flatNodes.length;
  const rootCount = nodes.length;

  useEffect(() => {
    firstButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (selected) return;
    setSelectedId(flatNodes[0]?.node.id ?? null);
  }, [flatNodes, selected]);

  useEffect(() => setIdDraft(selected?.node.id ?? ''), [selected?.node.id]);

  const inputClass = `h-8 w-full rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode ? 'border-[#484852] bg-[#19191e] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
  }`;
  const secondaryButton = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 ${
    isDarkMode ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-8 w-8 items-center justify-center rounded border outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'border-[#45454f] text-slate-300 hover:bg-white/10' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
  }`;

  const commit = (next: TreeViewEditableNode[], nextSelectedId = selectedId) => {
    onChange(next);
    setSelectedId(nextSelectedId);
  };

  const addRoot = () => {
    const result = appendTreeViewNode(nodes);
    commit(result.nodes, result.nodeId);
    setNotice('已新增根节点。');
  };

  const addChild = () => {
    if (!selectedId) return addRoot();
    const result = appendTreeViewNode(nodes, selectedId);
    commit(result.nodes, result.nodeId);
    setNotice(`已在“${selected?.node.title}”下新增子节点。`);
  };

  const duplicateSelected = () => {
    if (!selectedId) return;
    const result = duplicateTreeViewNode(nodes, selectedId);
    commit(result.nodes, result.nodeId);
    setNotice('已复制所选节点及其全部子节点。');
  };

  const deleteSelected = () => {
    if (!selectedId || !selected) return;
    const next = deleteTreeViewNode(nodes, selectedId);
    const remaining = flattenTreeViewNodes(next);
    commit(next, remaining[0]?.node.id ?? null);
    setNotice(`已删除“${selected.node.title}”及其全部子节点。`);
  };

  const commitNodeId = () => {
    if (!selected) return;
    const nextId = idDraft.trim();
    if (!isTreeViewNodeIdAvailable(nodes, nextId, selected.node.id)) {
      setNotice(nextId ? '节点 ID 已存在，请使用唯一 ID。' : '节点 ID 不能为空。');
      setIdDraft(selected.node.id);
      return;
    }
    if (nextId === selected.node.id) return;
    const replaceParentId = (items: TreeViewEditableNode[]): TreeViewEditableNode[] => items.map(node => ({
      ...node,
      id: node.id === selected.node.id ? nextId : node.id,
      children: replaceParentId(node.children)
    }));
    commit(replaceParentId(nodes), nextId);
    setNotice(`节点 ID 已修改为 ${nextId}。`);
  };

  const renderTree = (items: TreeViewEditableNode[], depth = 0): React.ReactNode => items.map(node => (
    <React.Fragment key={node.id}>
      <button
        type="button"
        onClick={() => setSelectedId(node.id)}
        aria-current={selectedId === node.id ? 'true' : undefined}
        className={`flex h-8 w-full min-w-0 items-center gap-1.5 rounded px-2 text-left text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
          selectedId === node.id
            ? isDarkMode ? 'bg-cyan-500/20 text-cyan-100' : 'bg-cyan-100 text-cyan-950'
            : isDarkMode ? 'text-slate-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-100'
        }`}
        style={{ paddingLeft: `${8 + depth * 18}px` }}
      >
        {node.children.length > 0 ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <span className="w-3.5 shrink-0" />}
        <GitBranch className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
        <span className="min-w-0 flex-1 truncate">{node.title || '未命名节点'}</span>
        <span className="shrink-0 font-mono text-[9px] text-slate-500">{node.id}</span>
      </button>
      {renderTree(node.children, depth + 1)}
    </React.Fragment>
  ));

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/70 p-3 sm:p-6" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="tree-view-editor-title"
        className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border shadow-2xl ${
          isDarkMode ? 'border-[#454550] bg-[#202026] text-slate-100' : 'border-slate-300 bg-white text-slate-900'
        }`}
      >
        <header className={`flex shrink-0 items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#383840]' : 'border-slate-200'}`}>
          <div>
            <h2 id="tree-view-editor-title" className="text-sm font-semibold">编辑 TreeView 节点</h2>
            <p className="mt-1 text-[11px] text-slate-500">{controlName} · {rootCount} 个根节点，{nodeCount} 个节点。修改会立即同步到设计画布与原生生成结果。</p>
          </div>
          <button type="button" aria-label="关闭节点编辑器" onClick={onClose} className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap gap-2 border-b px-4 py-2.5 ${isDarkMode ? 'border-[#383840]' : 'border-slate-200'}`}>
          <button ref={firstButtonRef} type="button" onClick={addRoot} className={secondaryButton}><Plus className="h-3.5 w-3.5" />添加根节点</button>
          <button type="button" onClick={addChild} disabled={!selected} className={secondaryButton}><GitBranch className="h-3.5 w-3.5" />添加子节点</button>
          <button type="button" onClick={duplicateSelected} disabled={!selected} className={secondaryButton}><Copy className="h-3.5 w-3.5" />复制节点</button>
          <button type="button" onClick={deleteSelected} disabled={!selected} className={`${secondaryButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" />删除节点</button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto md:grid-cols-[minmax(280px,0.9fr)_minmax(320px,1.1fr)] md:overflow-hidden">
          <div className={`min-h-[260px] overflow-auto border-b p-3 md:border-b-0 md:border-r ${isDarkMode ? 'border-[#383840] bg-[#18181d]' : 'border-slate-200 bg-slate-50'}`} aria-label="节点层级">
            {nodes.length > 0 ? renderTree(nodes) : (
              <div className="flex h-full min-h-48 flex-col items-center justify-center text-center text-xs text-slate-500">
                <GitBranch className="mb-2 h-7 w-7" />
                <span>尚未添加节点</span>
                <button type="button" onClick={addRoot} className="mt-3 text-cyan-500 hover:underline">添加第一个根节点</button>
              </div>
            )}
          </div>

          <div className="min-h-[300px] overflow-auto p-4">
            {selected ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold">节点属性</h3>
                  <p className="mt-1 text-[10px] text-slate-500">当前层级：第 {selected.depth + 1} 级；包含 {flattenTreeViewNodes(selected.node.children).length} 个后代节点。</p>
                </div>
                <label className="block space-y-1 text-[11px] text-slate-500">
                  <span>节点 ID</span>
                  <input value={idDraft} onChange={event => setIdDraft(event.target.value)} onBlur={commitNodeId} onKeyDown={event => event.key === 'Enter' && commitNodeId()} className={inputClass} />
                </label>
                <label className="block space-y-1 text-[11px] text-slate-500">
                  <span>显示标题</span>
                  <input value={selected.node.title} onChange={event => commit(updateTreeViewNode(nodes, selected.node.id, { title: event.target.value }))} className={inputClass} autoFocus />
                </label>
                {showImages && (
                  <label className="block space-y-1 text-[11px] text-slate-500">
                    <span>图像索引（-1 表示无图像）</span>
                    <input type="number" min={-1} value={selected.node.image} onChange={event => commit(updateTreeViewNode(nodes, selected.node.id, { image: Math.max(-1, Math.trunc(Number(event.target.value) || 0)) }))} className={inputClass} />
                  </label>
                )}
                <label className="block space-y-1 text-[11px] text-slate-500">
                  <span>父节点</span>
                  <select value={selected.parentId ?? ''} onChange={event => commit(reparentTreeViewNode(nodes, selected.node.id, event.target.value || undefined), selected.node.id)} className={inputClass}>
                    <option value="">窗口根级</option>
                    {flatNodes.filter(item => item.node.id !== selected.node.id && !selectedDescendantIds.has(item.node.id)).map(item => (
                      <option key={item.node.id} value={item.node.id}>{'　'.repeat(item.depth)}{item.node.title}（{item.node.id}）</option>
                    ))}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2 border-t pt-4 border-slate-500/20">
                  <button type="button" title="在同级中上移" disabled={selected.siblingIndex === 0} onClick={() => commit(moveTreeViewNode(nodes, selected.node.id, -1))} className={secondaryButton}><ArrowUp className="h-3.5 w-3.5" />上移</button>
                  <button type="button" title="在同级中下移" disabled={selected.siblingIndex === selected.siblingCount - 1} onClick={() => commit(moveTreeViewNode(nodes, selected.node.id, 1))} className={secondaryButton}><ArrowDown className="h-3.5 w-3.5" />下移</button>
                  <button type="button" onClick={addChild} className={secondaryButton}><Plus className="h-3.5 w-3.5" />在此节点下添加</button>
                </div>
              </div>
            ) : <div className="flex h-full items-center justify-center text-xs text-slate-500">请从左侧选择一个节点。</div>}
          </div>
        </div>

        <footer className={`flex min-h-11 shrink-0 items-center justify-between gap-3 border-t px-4 py-2 ${isDarkMode ? 'border-[#383840]' : 'border-slate-200'}`}>
          <div role="status" className="min-w-0 truncate text-[10px] text-cyan-500">{notice || '可通过“父节点”快速调整层级；删除父节点会同时删除其子树。'}</div>
          <button type="button" onClick={onClose} className={secondaryButton}>完成</button>
        </footer>
      </section>
    </div>
  );
}
