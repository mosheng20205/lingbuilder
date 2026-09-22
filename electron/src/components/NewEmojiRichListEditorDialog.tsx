import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Copy, LayoutList, Plus, Rows3, Trash2, X } from 'lucide-react';
import type { Win32ControlPropertyValue } from '../services/windowDesigner/win32ControlRegistry';
import type { LingControl } from '../services/windowDesigner/types';
import {
  RICH_LIST_NODE_TYPES,
  deriveRichListDataColumns,
  parseRichListItems,
  parseRichListSelectedKeys,
  parseRichListTemplate,
  serializeRichListItems,
  serializeRichListSelectedKeys,
  serializeRichListTemplate,
  type RichListItemDraft,
  type RichListNodeDraft,
  type RichListTemplateDraft
} from '../services/windowDesigner/newEmojiDataFormats';

type RichListEditorTab = 'template' | 'items' | 'selection';

function clampRowHeight(value: number): number {
  if (!Number.isFinite(value)) return 88;
  return Math.min(4096, Math.max(24, Math.trunc(value)));
}

export default function NewEmojiRichListEditorDialog({
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
  const initial = useMemo(() => {
    const template = parseRichListTemplate(properties.templateJson);
    const items = parseRichListItems(properties.itemsJson);
    const selected = parseRichListSelectedKeys(properties.selectedKeys);
    return { template: template.template, items: items.items, selected: selected.keys };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [tab, setTab] = useState<RichListEditorTab>('template');
  const [template, setTemplate] = useState<RichListTemplateDraft>(initial.template);
  const [items, setItems] = useState<RichListItemDraft[]>(initial.items);
  const [selectedKeys, setSelectedKeys] = useState<string[]>(initial.selected);
  const [activeNodeId, setActiveNodeId] = useState(initial.template.nodes[0]?.id ?? '');
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

  const dataColumns = deriveRichListDataColumns(template.nodes);
  const activeNode = template.nodes.find(node => node.id === activeNodeId) ?? template.nodes[0];

  const errors: string[] = [];
  const nodeIds = new Set<string>();
  template.nodes.forEach((node, index) => {
    const label = `节点 ${index + 1}`;
    if (!node.id.trim()) errors.push(`${label}：标识 ID 不能为空。`);
    else if (nodeIds.has(node.id.trim())) errors.push(`${label}：标识 ID「${node.id.trim()}」重复。`);
    else nodeIds.add(node.id.trim());
    if (!RICH_LIST_NODE_TYPES.some(type => type.value === node.type)) errors.push(`${label}：节点类型无效。`);
    if (node.w < 0 || node.h < 0) errors.push(`${label}：宽高不能为负数。`);
  });
  const itemKeys = new Set<string>();
  items.forEach((item, index) => {
    if (!item.key.trim()) errors.push(`项目 ${index + 1}：键不能为空。`);
    else if (itemKeys.has(item.key.trim())) errors.push(`项目 ${index + 1}：键「${item.key.trim()}」重复。`);
    else itemKeys.add(item.key.trim());
  });
  const invalidSelection = selectedKeys.filter(key => !itemKeys.has(key));
  if (invalidSelection.length > 0) errors.push(`默认选中引用了不存在的项目键：${invalidSelection.join('、')}。`);
  const canSave = errors.length === 0;

  const updateNode = (id: string, fields: Partial<RichListNodeDraft>) => {
    setTemplate(current => ({ ...current, nodes: current.nodes.map(node => node.id === id ? { ...node, ...fields } : node) }));
  };
  const updateNodeById = (oldId: string, nextId: string) => {
    const normalized = nextId.trim();
    if (!normalized) return;
    if (normalized !== oldId && template.nodes.some(node => node.id.trim() === normalized)) {
      setNotice(`标识 ID「${normalized}」已被占用。`);
      return;
    }
    updateNode(oldId, { id: normalized });
    if (activeNodeId === oldId) setActiveNodeId(normalized);
  };
  const addNode = () => {
    const type = 'text';
    const base = blankNodeLabelled(template.nodes);
    const node: RichListNodeDraft = { ...emptyRichListNode(type), id: base };
    setTemplate(current => ({ ...current, nodes: [...current.nodes, node] }));
    setActiveNodeId(base);
    setNotice(`已添加节点「${base}」，在下方表单里设置位置与绑定字段。`);
  };
  const moveNode = (index: number, target: number) => {
    setTemplate(current => {
      const nodes = [...current.nodes];
      const [moved] = nodes.splice(index, 1);
      if (!moved) return current;
      nodes.splice(Math.max(0, Math.min(nodes.length, target)), 0, moved);
      return { ...current, nodes };
    });
  };
  const deleteNode = (id: string) => {
    setTemplate(current => ({ ...current, nodes: current.nodes.filter(node => node.id !== id) }));
    if (activeNodeId === id) setActiveNodeId('');
  };
  const updateItem = (index: number, fields: Partial<RichListItemDraft>) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...fields } : item));
  };
  const updateItemData = (index: number, column: string, value: string) => {
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, data: { ...item.data, [column]: value } } : item));
  };
  const renameItemKey = (index: number, nextKey: string) => {
    const normalized = nextKey.trim();
    if (!normalized || (normalized !== items[index]?.key && items.some(item => item.key === normalized))) return;
    const oldKey = items[index]?.key ?? '';
    setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, key: normalized } : item));
    setSelectedKeys(current => current.map(key => key === oldKey ? normalized : key));
  };
  const addItem = () => {
    const key = uniqueItemKey(items);
    const data: Record<string, string> = {};
    dataColumns.forEach(column => { data[column] = ''; });
    setItems(current => [...current, { key, data, disabled: false, selected: false }]);
    setNotice(`已添加项目「${key}」。`);
  };
  const moveItem = (index: number, target: number) => {
    setItems(current => {
      const next = [...current];
      const [moved] = next.splice(index, 1);
      if (!moved) return current;
      next.splice(Math.max(0, Math.min(next.length, target)), 0, moved);
      return next;
    });
  };
  const duplicateItem = (index: number) => {
    const source = items[index];
    if (!source) return;
    const key = uniqueItemKey(items, source.key);
    setItems(current => {
      const next = [...current];
      next.splice(index + 1, 0, { ...source, key, data: { ...source.data } });
      return next;
    });
  };
  const toggleSelected = (key: string, checked: boolean) => {
    setSelectedKeys(current => checked ? (current.includes(key) ? current : [...current, key]) : current.filter(item => item !== key));
  };

  const selectionModeLabel = String(properties.selectionMode ?? '0') === '0' ? '单选' : String(properties.selectionMode ?? '0') === '1' ? '多选' : '扩展多选';

  const handleSave = () => {
    if (!canSave) return;
    const saved: Record<string, Win32ControlPropertyValue> = {
      templateJson: serializeRichListTemplate(template),
      itemsJson: serializeRichListItems(items),
      selectedKeys: serializeRichListSelectedKeys(selectedKeys),
      // 行模板里的行高与外观设置保持一致，避免两处行高互相覆盖。
      rowHeight: clampRowHeight(template.rowHeight)
    };
    onSave(saved);
  };

  const typeHint = activeNode ? RICH_LIST_NODE_TYPES.find(type => type.value === activeNode.type)?.hint ?? '' : '';

  return (
    <div className="fixed inset-0 z-[10000] flex select-text items-center justify-center overflow-hidden bg-black/65 p-2 sm:p-5" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`编辑 new_emoji 富列表 ${control.name}`} className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl min-w-0 flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] ${isDarkMode ? 'border-[#4b4b55] bg-[#18181d] text-slate-100' : 'border-slate-300 bg-slate-50 text-slate-900'}`}>
        <header className={`flex shrink-0 items-start gap-3 border-b px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3d3d46] bg-[#232329]' : 'border-slate-200 bg-white'}`}>
          <LayoutList className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
          <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold sm:text-base">编辑富列表 · {control.name}</h2><p className={`mt-1 text-[11px] leading-4 sm:text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>「行模板」决定每一行长什么样，「项目数据」填每一行的内容；两页都不用写 JSON，保存时自动生成。</p></div>
          <button type="button" onClick={onClose} aria-label="关闭富列表编辑器" className={iconButton}><X className="h-4 w-4" /></button>
        </header>

        <div className={`flex shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-5 ${isDarkMode ? 'border-[#35353e]' : 'border-slate-200'}`}>
          <div className={`flex rounded border p-0.5 ${isDarkMode ? 'border-[#454550] bg-[#24242b]' : 'border-slate-300 bg-slate-100'}`} role="tablist" aria-label="富列表编辑区域">
            <button type="button" role="tab" aria-selected={tab === 'template'} onClick={() => setTab('template')} className={`${buttonClass} border-0 ${tab === 'template' ? 'bg-cyan-600 text-white' : 'bg-transparent'}`}>行模板 <span className="font-mono text-[10px] opacity-75">{template.nodes.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'items'} onClick={() => setTab('items')} className={`${buttonClass} border-0 ${tab === 'items' ? 'bg-cyan-600 text-white' : 'bg-transparent'}`}><Rows3 className="h-3.5 w-3.5" />项目数据 <span className="font-mono text-[10px] opacity-75">{items.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === 'selection'} onClick={() => setTab('selection')} className={`${buttonClass} border-0 ${tab === 'selection' ? 'bg-cyan-600 text-white' : 'bg-transparent'}`}>默认选中 <span className="font-mono text-[10px] opacity-75">{selectedKeys.length}</span></button>
          </div>
          {tab === 'template' && <button type="button" onClick={addNode} className={buttonClass}><Plus className="h-3.5 w-3.5" />添加节点</button>}
          {tab === 'items' && <button type="button" onClick={addItem} disabled={dataColumns.length === 0} className={buttonClass}><Plus className="h-3.5 w-3.5" />添加项目</button>}
          {tab === 'template' && <label className="ml-auto flex items-center gap-2 text-[11px]"><span className={isDarkMode ? 'text-slate-400' : 'text-slate-600'}>行高（像素，24~4096）</span><input aria-label="行高" type="number" min={24} max={4096} value={template.rowHeight} onChange={event => setTemplate(current => ({ ...current, rowHeight: clampRowHeight(Number(event.target.value)) }))} className={`${inputClass} w-24`} /></label>}
          {tab === 'items' && <span className={`ml-auto text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>内容列来自行模板的「绑定字段」</span>}
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto p-3 sm:p-5">
          {tab === 'template' && (
            <>
              {template.nodes.length === 0 ? (
                <div className={`flex min-h-40 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><LayoutList className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有行模板节点</p><p className="mt-1 text-xs">一个节点就是行里的一块内容：图标、标题、描述或按钮。</p><button type="button" onClick={addNode} className={`${buttonClass} mt-3`}><Plus className="h-3.5 w-3.5" />添加第一个节点</button></div>
              ) : (
                <div className="overflow-x-auto rounded border"><table className="w-full min-w-[860px] border-separate border-spacing-0 text-left text-xs"><thead className={isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}><tr><th className="w-24 border-b p-2">类型</th><th className="w-28 border-b p-2">标识 ID</th><th className="min-w-28 border-b p-2">绑定字段</th><th className="min-w-32 border-b p-2">固定文本</th><th className="w-16 border-b p-2">X</th><th className="w-16 border-b p-2">Y</th><th className="w-16 border-b p-2">宽</th><th className="w-16 border-b p-2">高</th><th className="w-28 border-b p-2 text-right">操作</th></tr></thead><tbody>
                  {template.nodes.map((node, index) => (
                    <tr key={node.id} className={`${activeNode?.id === node.id ? (isDarkMode ? 'bg-cyan-500/10' : 'bg-cyan-50') : ''} ${isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}`}>
                      <td className="border-b p-1"><select aria-label={`第 ${index + 1} 个节点类型`} value={node.type} onChange={event => updateNode(node.id, { type: event.target.value })} className={inputClass}>{RICH_LIST_NODE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></td>
                      <td className="border-b p-1"><input aria-label={`第 ${index + 1} 个节点 ID`} defaultValue={node.id} onBlur={event => updateNodeById(node.id, event.target.value)} title="节点在本行内的唯一标识" className={inputClass} /></td>
                      <td className="border-b p-1"><input aria-label={`第 ${index + 1} 个节点绑定字段`} value={node.field} onChange={event => updateNode(node.id, { field: event.target.value })} placeholder="如 title" title="填写「项目数据」里的列名；留空表示只显示固定文本" className={inputClass} /></td>
                      <td className="border-b p-1"><input aria-label={`第 ${index + 1} 个节点固定文本`} value={node.text} onChange={event => updateNode(node.id, { text: event.target.value })} placeholder={node.type === 'button' ? '按钮文字' : '可选'} className={inputClass} /></td>
                      {(['x', 'y', 'w', 'h'] as const).map(field => <td key={field} className="border-b p-1"><input aria-label={`第 ${index + 1} 个节点 ${field}`} type="number" value={node[field]} onChange={event => updateNode(node.id, { [field]: Math.max(0, Math.trunc(Number(event.target.value) || 0)) } as Partial<RichListNodeDraft>)} className={inputClass} /></td>)}
                      <td className="border-b p-1"><div className="flex justify-end gap-0.5"><button type="button" aria-label={`选中第 ${index + 1} 个节点`} title="编辑详情" onClick={() => setActiveNodeId(node.id)} className={`${iconButton} ${activeNode?.id === node.id ? 'text-cyan-500' : ''}`}><LayoutList className="h-3.5 w-3.5" /></button><button type="button" aria-label={`上移第 ${index + 1} 个节点`} title="上移" disabled={index === 0} onClick={() => moveNode(index, index - 1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label={`下移第 ${index + 1} 个节点`} title="下移" disabled={index === template.nodes.length - 1} onClick={() => moveNode(index, index + 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${index + 1} 个节点`} title="删除节点" onClick={() => deleteNode(node.id)} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                    </tr>
                  ))}
                </tbody></table></div>
              )}
              {activeNode && <section aria-label="当前节点详细设置" className={`mt-4 rounded border p-3 ${surfaceClass}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-xs">节点详情 · {activeNode.id || '（未命名）'}</strong>
                  <span className={`text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{typeHint}</span>
                  <label className="ml-auto flex min-w-0 items-center gap-2 text-xs">
                    <span className="shrink-0 text-slate-500">当前节点</span>
                    <select aria-label="选择要配置的节点" value={activeNode.id} onChange={event => setActiveNodeId(event.target.value)} className={`${inputClass} w-auto min-w-40`}>
                      {template.nodes.map(node => <option key={node.id} value={node.id}>{node.id || '（未命名）'}（{RICH_LIST_NODE_TYPES.find(type => type.value === node.type)?.label ?? node.type}）</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {(activeNode.type === 'text' || activeNode.type === 'icon') && <>
                    <label className="text-[11px] text-slate-500">字号<input aria-label="节点字号" type="number" min={8} max={72} value={activeNode.size} onChange={event => updateNode(activeNode.id, { size: Math.min(72, Math.max(8, Math.trunc(Number(event.target.value) || 14))) })} className={`${inputClass} mt-1`} /></label>
                    <label className="text-[11px] text-slate-500">字重<select aria-label="节点字重" value={String(activeNode.weight)} onChange={event => updateNode(activeNode.id, { weight: Number(event.target.value) })} className={`${inputClass} mt-1`}><option value="400">常规</option><option value="600">加粗</option><option value="700">特粗</option></select></label>
                    <label className="text-[11px] text-slate-500">颜色角色<select aria-label="节点颜色角色" value={activeNode.role} onChange={event => updateNode(activeNode.id, { role: event.target.value })} className={`${inputClass} mt-1`}><option value="">默认颜色</option><option value="primary">主要文字（亮）</option><option value="secondary">次要文字（暗）</option></select></label>
                    <label className="text-[11px] text-slate-500">水平对齐<select aria-label="节点水平对齐" value={String(activeNode.align)} onChange={event => updateNode(activeNode.id, { align: Number(event.target.value) })} className={`${inputClass} mt-1`}><option value="0">居左</option><option value="1">居中</option><option value="2">居右</option></select></label>
                    <label className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={activeNode.ellipsis} onChange={event => updateNode(activeNode.id, { ellipsis: event.target.checked })} className="accent-cyan-500" />过长时显示省略号</label>
                    <label className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={activeNode.wrap} onChange={event => updateNode(activeNode.id, { wrap: event.target.checked })} className="accent-cyan-500" />自动换行</label>
                  </>}
                  {activeNode.type === 'button' && <>
                    <label className="text-[11px] text-slate-500">动作 ID<input aria-label="按钮动作 ID" value={activeNode.actionId} onChange={event => updateNode(activeNode.id, { actionId: event.target.value })} placeholder="open" title="项目点击事件里用动作 ID 区分是哪个按钮" className={`${inputClass} mt-1`} /></label>
                    <label className="text-[11px] text-slate-500">按钮样式<select aria-label="按钮样式" value={String(activeNode.variant)} onChange={event => updateNode(activeNode.id, { variant: Number(event.target.value) })} className={`${inputClass} mt-1`}><option value="0">普通</option><option value="1">主要按钮</option></select></label>
                  </>}
                  {activeNode.type === 'countdown' && <label className="text-[11px] text-slate-500">倒计时格式<input aria-label="倒计时格式" value={activeNode.format} onChange={event => updateNode(activeNode.id, { format: event.target.value })} placeholder="HH:mm:ss" className={`${inputClass} mt-1`} /></label>}
                  {activeNode.type === 'badge' && <>
                    <label className="text-[11px] text-slate-500">徽标类型序号<input aria-label="徽标类型序号" type="number" min={0} value={activeNode.badgeType} onChange={event => updateNode(activeNode.id, { badgeType: Math.max(0, Math.trunc(Number(event.target.value) || 0)) })} className={`${inputClass} mt-1`} /></label>
                    <label className="text-[11px] text-slate-500">数字最大值<input aria-label="徽标数字最大值" type="number" min={1} value={activeNode.badgeMax} onChange={event => updateNode(activeNode.id, { badgeMax: Math.max(1, Math.trunc(Number(event.target.value) || 99)) })} className={`${inputClass} mt-1`} /></label>
                    <label className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={activeNode.dot} onChange={event => updateNode(activeNode.id, { dot: event.target.checked })} className="accent-cyan-500" />只显示小红点</label>
                  </>}
                </div>
                <p className={`mt-3 text-[10px] leading-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>坐标是相对每一行左上角的像素位置；行内容超出窗口宽度时会被裁剪，请留意节点的 X + 宽 不要超过列表宽度。</p>
              </section>}
            </>
          )}

          {tab === 'items' && (
            dataColumns.length === 0 ? (
              <div role="alert" className={`rounded border border-amber-500/40 bg-amber-500/10 p-5 text-center text-sm ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>行模板里还没有绑定字段的节点。先到「行模板」页给图标、标题等节点填写「绑定字段」（例如 icon、title、desc），这里就会出现对应的内容列。</div>
            ) : items.length === 0 ? (
              <div className={`flex min-h-40 flex-col items-center justify-center rounded border border-dashed p-6 text-center ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}><Rows3 className="mb-2 h-7 w-7" /><p className="text-sm font-semibold">还没有项目数据</p><p className="mt-1 text-xs">每一行项目就是列表里的一条记录。</p><button type="button" onClick={addItem} className={`${buttonClass} mt-3`}><Plus className="h-3.5 w-3.5" />添加第一个项目</button></div>
            ) : (
              <div className="overflow-x-auto rounded border"><table className="w-full min-w-[640px] border-separate border-spacing-0 text-left text-xs"><thead className={`sticky top-0 z-10 ${isDarkMode ? 'bg-[#28282f] text-slate-300' : 'bg-slate-100 text-slate-700'}`}><tr><th className="w-32 border-b p-2">键（稳定 ID）</th>{dataColumns.map(column => <th key={column} className="min-w-36 border-b p-2">{column}</th>)}<th className="w-14 border-b p-2 text-center">禁用</th><th className="w-32 border-b p-2 text-right">操作</th></tr></thead><tbody>
                {items.map((item, index) => (
                  <tr key={index} className={isDarkMode ? 'hover:bg-white/[0.025]' : 'hover:bg-slate-50'}>
                    <td className="border-b p-1"><input aria-label={`第 ${index + 1} 项键`} defaultValue={item.key} onBlur={event => renameItemKey(index, event.target.value)} title="代码与选中状态用键识别项目；改键会同步更新默认选中" className={inputClass} /></td>
                    {dataColumns.map(column => <td key={column} className="border-b p-1"><input aria-label={`第 ${index + 1} 项 ${column}`} value={item.data[column] ?? ''} onChange={event => updateItemData(index, column, event.target.value)} className={inputClass} /></td>)}
                    <td className="border-b p-2 text-center"><input type="checkbox" checked={item.disabled} onChange={event => updateItem(index, { disabled: event.target.checked })} aria-label={`禁用第 ${index + 1} 项`} className="h-4 w-4 accent-cyan-500" /></td>
                    <td className="border-b p-1"><div className="flex justify-end gap-0.5"><button type="button" aria-label={`复制第 ${index + 1} 项`} title="复制项目" onClick={() => duplicateItem(index)} className={iconButton}><Copy className="h-3.5 w-3.5" /></button><button type="button" aria-label={`上移第 ${index + 1} 项`} title="上移" disabled={index === 0} onClick={() => moveItem(index, index - 1)} className={iconButton}><ArrowUp className="h-3.5 w-3.5" /></button><button type="button" aria-label={`下移第 ${index + 1} 项`} title="下移" disabled={index === items.length - 1} onClick={() => moveItem(index, index + 1)} className={iconButton}><ArrowDown className="h-3.5 w-3.5" /></button><button type="button" aria-label={`删除第 ${index + 1} 项`} title="删除项目" onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className={`${iconButton} text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button></div></td>
                  </tr>
                ))}
              </tbody></table></div>
            )
          )}

          {tab === 'selection' && (
            items.length === 0 ? (
              <div role="status" className={`rounded border border-dashed p-6 text-center text-sm ${isDarkMode ? 'border-slate-700 text-slate-500' : 'border-slate-300 text-slate-500'}`}>先在「项目数据」页添加项目，再回到这里勾选默认选中的项。</div>
            ) : (
              <div className={`max-w-md rounded border p-3 ${surfaceClass}`} role="group" aria-label="默认选中项目">
                <p className={`mb-2 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>当前选择模式：{selectionModeLabel}。勾选的项目在程序启动时处于选中状态。</p>
                {items.map(item => <label key={item.key} className="flex items-center gap-2 py-1 text-xs"><input type="checkbox" checked={selectedKeys.includes(item.key)} onChange={event => toggleSelected(item.key, event.target.checked)} className="h-4 w-4 accent-cyan-500" /><span className="min-w-0 flex-1 truncate" title={item.key}>{item.data['title'] || item.key}</span><span className="font-mono text-[10px] text-slate-500">{item.key}</span></label>)}
              </div>
            )
          )}
        </main>

        {(notice || errors.length > 0) && <div role={errors.length > 0 ? 'alert' : 'status'} className={`shrink-0 border-t px-3 py-2 text-[10px] leading-4 ${errors.length > 0 ? (isDarkMode ? 'border-[#35353e] bg-rose-500/10 text-rose-300' : 'border-slate-200 bg-rose-50 text-rose-800') : (isDarkMode ? 'border-[#35353e] bg-amber-500/5 text-amber-300' : 'border-slate-200 bg-amber-50 text-amber-800')}`}>
          {errors.length > 0 ? <ul className="space-y-0.5">{errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : notice}
        </div>}
        <footer className={`flex shrink-0 justify-end gap-2 border-t px-3 py-3 sm:px-5 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}><button type="button" className={buttonClass} onClick={onClose}>取消</button><button type="button" disabled={!canSave} className={`${buttonClass} border-cyan-500 bg-cyan-600 text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40`} onClick={handleSave}>保存列表数据</button></footer>
      </div>
    </div>
  );
}

function emptyRichListNode(type: string): RichListNodeDraft {
  return {
    id: '',
    type,
    field: '',
    text: '',
    actionId: '',
    x: 14,
    y: 20,
    w: type === 'button' ? 86 : 160,
    h: type === 'button' ? 28 : 24,
    size: 14,
    weight: 400,
    role: '',
    color: '',
    align: 0,
    ellipsis: false,
    wrap: false,
    format: 'HH:mm:ss',
    variant: 0,
    badgeType: 0,
    badgeMax: 99,
    dot: false
  };
}

function blankNodeLabelled(nodes: RichListNodeDraft[]): string {
  let index = nodes.length + 1;
  while (nodes.some(node => node.id === `node-${index}`)) index += 1;
  return `node-${index}`;
}

function uniqueItemKey(items: RichListItemDraft[], base = 'item'): string {
  let index = items.length + 1;
  while (items.some(item => item.key === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
