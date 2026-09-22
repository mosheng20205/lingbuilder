import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Indent, ListTree, Outdent, Plus, Redo2, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import type { LingControl } from '../services/windowDesigner/types';
import {
  parseTreeDataJson,
  parseTreeSimpleItems,
  serializeTreeDataJson,
  serializeTreeSimpleItems,
  type TreeNodeDraft
} from '../services/windowDesigner/newEmojiDataFormats';

/** 层级上限与 new_emoji parse_tree_items 的 12 级上限一致。 */
const MAX_LEVEL = 12;

export default function NewEmojiTreeDataEditorDialog({
  control,
  isDarkMode,
  onSave,
  onClose
}: {
  control: LingControl;
  isDarkMode: boolean;
  onSave: (properties: Record<string, Win32ControlPropertyValue>) => void;
  onClose: () => void;
}) {
  const properties = control.properties || {};
  const initialNodes = useMemo<TreeNodeDraft[]>(() => {
    const fromJson = parseTreeDataJson(properties.treeDataJson);
    if (fromJson.ok && fromJson.nodes.length > 0) return fromJson.nodes;
    return parseTreeSimpleItems(properties.items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [nodes, setNodes] = useState<TreeNodeDraft[]>(initialNodes);
  const [notice, setNotice] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialogRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const inputClass = `h-8 w-full min-w-0 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
    isDarkMode ? 'border-[#484852] bg-[#19191e] text-slate-100 placeholder:text-slate-600' : 'border-slate-300 bg-white text-slate-900 placeholder:text-slate-400'
  }`;
  const buttonClass = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-35 ${
    isDarkMode ? 'border-[#4a4a54] bg-[#292930] text-slate-200 hover:bg-[#34343d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
  }`;
  const iconButton = `inline-flex h-7 w-7 items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-25 ${
    isDarkMode ? 'text-slate-300 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-200'
  }`;
  const surfaceClass = isDarkMode ? 'border-[#3b3b44] bg-[#202026]' : 'border-slate-200 bg-white';

  const errors: string[] = [];
  const keys = new Set<string>();
  nodes.forEach((node, index) => {
    if (node.key.trim() && keys.has(node.key.trim())) errors.push(`节点 ${index + 1}：键「${node.key.trim()}」重复。`);
    else if (node.key.trim()) keys.add(node.key.trim());
  });

  const updateNode = (index: number, fields: Partial<TreeNodeDraft>) => {
    setNodes(current => current.map((node, nodeIndex) => nodeIndex === index ? { ...node, ...fields } : node));
  };
  const addRoot = () => {
    setNodes(current => [...current, { key: '', label: `节点${current.length + 1}`, icon: '', expanded: true, checked: false, disabled: false, level: 0 }]);
  };
  const addChild = (index: number) => {
    const parent = nodes[index];
    if (!parent) return;
    if (parent.level >= MAX_LEVEL) {
      setNotice('已到最大层级（12 级），不能再加深。');
      return;
    }
    setNodes(current => {
      const next = [...current];
      next.splice(index + 1, 0, { key: '', label: `子节点${current.length + 1}`, icon: '', expanded: true, checked: false, disabled: false, level: parent.level + 1 });
      return next;
    });
  };
  const moveNode = (index: number, target: number) => {
    setNodes(current => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(Math.max(0, Math.min(next.length, target)), 0, moved);
      return next;
    });
  };
  const indentNode = (index: number) => {
    const previous = nodes[index - 1];
    const node = nodes[index];
    if (!node || !previous) {
      setNotice('第一行不能降级，先在上方放一个父节点。');
      return;
    }
    if (node.level > previous.level) {
      setNotice('只能逐级降级：上一行是同级节点时才能继续降级。');
      return;
    }
    updateNode(index, { level: node.level + 1 });
  };
  const outdentNode = (index: number) => {
    const node = nodes[index];
    if (!node) return;
    if (node.level === 0) {
      setNotice('已经是顶级节点。');
      return;
    }
    updateNode(index, { level: node.level - 1 });
  };
  const deleteNode = (index: number) => {
    setNodes(current => current.filter((_, nodeIndex) => nodeIndex !== index));
  };

  const handleSave = () => {
    if (errors.length > 0) return;
    // 键为空时自动补稳定键；树数据 JSON 与简单树节点行同步写出，
    // 画布预览与基础运行时路径保持一致。
    const finalized = nodes.map((node, index) => ({ ...node, key: node.key.trim() || `node-${index + 1}`, label: node.label.trim() || '节点' }));
    onSave({
      treeDataJson: serializeTreeDataJson(finalized),
      items: serializeTreeSimpleItems(finalized)
    });
  };

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`编辑 new_emoji 树数据 ${control.name}`} className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <ListTree className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold sm:text-base">编辑树数据 · {control.name}</h2><p className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>用「添加子级」和「降级 / 升级」整理层级，保存时自动生成树结构，不用手写 JSON。</p></div>
          <button type="button" onClick={onClose} aria-label="关闭树数据编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <button type="button" onClick={addRoot} className={buttonClass}><Plus className="h-3.5 w-3.5" />添加根节点</button>
          <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{nodes.length} 个节点</span>
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {nodes.length === 0 ? (
            <div className={`flex min-h-40 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><ListTree className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有树节点</p><p className="mt-1 text-xs">先添加根节点，再用「添加子级」建立层级。</p><button type="button" onClick={addRoot} className={`${buttonClass} mt-3`}><Plus className="h-3.5 w-3.5" />添加第一个根节点</button></div>
          ) : (
            <div className="space-y-1">
              {nodes.map((node, index) => (
                <div key={index} className={`flex flex-wrap items-center gap-1 rounded border p-1.5 ${surfaceClass}`} style={{ marginLeft: node.level * 20 }}>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] text-slate-500">{node.level > 0 ? `L${node.level}` : '根'}</span>
                  <input aria-label={`第 ${index + 1} 个节点名称`} value={node.label} onChange={event => updateNode(index, { label: event.target.value })} placeholder="节点名称" className={`${inputClass} min-w-32 flex-1`} />
                  <input aria-label={`第 ${index + 1} 个节点键`} defaultValue={node.key} onBlur={event => updateNode(index, { key: event.target.value.trim() })} placeholder="键（可选）" title="代码与选中状态用键识别节点；留空时保存会自动生成" className={`${inputClass} w-28 shrink-0 font-mono`} />
                  <input aria-label={`第 ${index + 1} 个节点图标`} defaultValue={node.icon} onBlur={event => updateNode(index, { icon: event.target.value.trim() })} placeholder="图标" title="显示在节点名称前的 emoji 或字符" className={`${inputClass} w-16 shrink-0`} />
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500" title="节点默认展开"><input type="checkbox" checked={node.expanded} onChange={event => updateNode(index, { expanded: event.target.checked })} className="h-3.5 w-3.5 accent-cyan-500" />展开</label>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500" title="显示为已勾选（开启选择框时）"><input type="checkbox" checked={node.checked} onChange={event => updateNode(index, { checked: event.target.checked })} className="h-3.5 w-3.5 accent-cyan-500" />勾选</label>
                  <label className="flex shrink-0 items-center gap-1 text-[11px] text-slate-500" title="禁止用户点击"><input type="checkbox" checked={node.disabled} onChange={event => updateNode(index, { disabled: event.target.checked })} className="h-3.5 w-3.5 accent-cyan-500" />禁用</label>
                  <div className="flex shrink-0 gap-0.5">
                    <button type="button" aria-label={`在第 ${index + 1} 个节点下添加子级`} title="添加子级" onClick={() => addChild(index)} className={iconButton}><Plus className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`降级第 ${index + 1} 个节点`} title="降级（变成上一行的子级）" onClick={() => indentNode(index)} className={iconButton}><Indent className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`升级第 ${index + 1} 个节点`} title="升级（提高一级）" onClick={() => outdentNode(index)} className={iconButton}><Outdent className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`上移第 ${index + 1} 个节点`} title="上移" disabled={index === 0} onClick={() => moveNode(index, index - 1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`下移第 ${index + 1} 个节点`} title="下移" disabled={index === nodes.length - 1} onClick={() => moveNode(index, index + 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button type="button" aria-label={`删除第 ${index + 1} 个节点`} title="删除节点" onClick={() => deleteNode(index)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              ))}
              <p className={`flex items-center gap-1 pt-1 text-[10px] text-slate-500`}><Redo2 className="h-3 w-3" />降级会把节点挂到它的上一行下面；调整顺序与层级后，保存时自动重排树结构。</p>
            </div>
          )}
        </main>

        {(notice || errors.length > 0) && <div role={errors.length > 0 ? 'alert' : 'status'} className={`shrink-0 border-t px-3 py-2 text-[10px] leading-4 ${errors.length > 0 ? (isDarkMode ? 'border-[#35353e] bg-rose-500/10 text-rose-300' : 'border-slate-200 bg-rose-50 text-rose-800') : (isDarkMode ? 'border-[#35353e] bg-amber-500/5 text-amber-300' : 'border-slate-200 bg-amber-50 text-amber-800')}`}>
          {errors.length > 0 ? <ul className="space-y-0.5">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : notice}
        </div>}
        <footer className={`flex shrink-0 justify-end gap-2 border-t px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}>
          <span className={`mr-auto self-center text-[10px] ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>保存会同时更新「树数据 JSON」和「树节点」两份属性，二者保持一致。</span>
          <button type="button" className={buttonClass} onClick={onClose}>取消</button>
          <button type="button" disabled={errors.length > 0} className={`${buttonClass} border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`} onClick={handleSave}>保存树数据</button>
        </footer>
      </div>
    </div>
  );
}
