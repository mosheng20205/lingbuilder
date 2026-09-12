import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react';

export interface FbroJsQueryChannel {
  query: string;
  cancel: string;
}

const JS_IDENTIFIER_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/u;

/** 解析控件属性 jsQueryFunctions（“查询名,取消名” 分号分隔）为通道列表。 */
export function parseFbroJsQueryChannels(raw: unknown): FbroJsQueryChannel[] {
  const text = typeof raw === 'string' ? raw : '';
  return text.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const [query = '', cancel = ''] = part.split(',').map(item => item.trim());
    return { query, cancel };
  });
}

/** 通道列表序列化回属性字符串；取消函数名留空时省略逗号（桥会回退默认取消函数）。 */
export function serializeFbroJsQueryChannels(channels: FbroJsQueryChannel[]): string {
  return channels
    .map(channel => ({ query: channel.query.trim(), cancel: channel.cancel.trim() }))
    .filter(channel => channel.query)
    .map(channel => channel.cancel ? `${channel.query},${channel.cancel}` : channel.query)
    .join(';');
}

function validateChannels(channels: FbroJsQueryChannel[]): string[] {
  const errors: string[] = [];
  const queryNames = new Set<string>();
  const cancelNames = new Set<string>();
  channels.forEach((channel, index) => {
    const row = index + 1;
    if (!channel.query) errors.push(`第 ${row} 条：查询函数名不能为空。`);
    else if (!JS_IDENTIFIER_RE.test(channel.query)) errors.push(`第 ${row} 条：查询函数名“${channel.query}”不是合法的 JavaScript 标识符。`);
    else if (queryNames.has(channel.query)) errors.push(`第 ${row} 条：查询函数名“${channel.query}”重复。`);
    else queryNames.add(channel.query);
    if (channel.cancel) {
      if (!JS_IDENTIFIER_RE.test(channel.cancel)) errors.push(`第 ${row} 条：取消函数名“${channel.cancel}”不是合法的 JavaScript 标识符。`);
      else if (cancelNames.has(channel.cancel)) errors.push(`第 ${row} 条：取消函数名“${channel.cancel}”重复。`);
      else cancelNames.add(channel.cancel);
    }
  });
  return errors;
}

export default function FbroJsQueryEditorDialog({ control, isDarkMode, mode = 'fbro', onSave, onClose }: {
  control: { name: string; properties?: Record<string, unknown> };
  isDarkMode: boolean;
  /** fbro：多通道编辑；cef3：严格单通道（CEF3 桥每程序只支持一条查询通道）。 */
  mode?: 'fbro' | 'cef3';
  onSave: (properties: { jsQueryFunctions: string }) => void;
  onClose: () => void;
}) {
  const single = mode === 'cef3';
  const [channels, setChannels] = useState<FbroJsQueryChannel[]>(() => {
    const parsed = parseFbroJsQueryChannels(control.properties?.jsQueryFunctions);
    if (parsed.length) return (single ? parsed.slice(0, 1) : parsed).map(channel => ({ ...channel }));
    return [{ query: 'cefQuery', cancel: 'cefQueryCancel' }];
  });
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    dialogRef.current?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  const errors = useMemo(() => validateChannels(channels), [channels]);
  const inputClass = `h-8 min-w-0 rounded border px-2 text-xs outline-none focus:ring-2 focus:ring-cyan-500 ${isDarkMode ? 'border-[#44444d] bg-[#17171c] text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`;
  const buttonClass = `inline-flex h-8 items-center justify-center gap-1 rounded border px-2 text-xs ${isDarkMode ? 'border-[#484852] bg-[#292930] text-slate-200 hover:bg-[#35353d]' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'}`;

  const updateChannel = (index: number, fields: Partial<FbroJsQueryChannel>) => setChannels(current => current.map((channel, row) => row === index ? { ...channel, ...fields } : channel));
  const moveChannel = (index: number, target: number) => setChannels(current => {
    if (target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-3" role="presentation">
    <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={`配置 JS 交互函数 ${control.name}`} className={`flex max-h-[94vh] w-[min(1020px,96vw)] flex-col overflow-hidden rounded-xl border shadow-2xl ${isDarkMode ? 'border-[#44444d] bg-[#202027] text-slate-100' : 'border-slate-300 bg-white text-slate-900'}`}>
      <header className={`flex items-center gap-3 border-b px-4 py-3 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}>
        <div>
          <h2 className="text-sm font-semibold">JS 交互通道配置</h2>
          <p className="text-[10px] text-slate-500">{control.name} · cefQuery 查询通道 · 保存到控件属性 jsQueryFunctions</p>
        </div>
        <button type="button" aria-label="关闭 JS 交互通道配置" onClick={onClose} className="ml-auto rounded p-1 hover:bg-white/10"><X className="h-4 w-4" /></button>
      </header>
      <main className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-3 overflow-auto p-4">
          <div className={`rounded-lg border px-3 py-2 text-[11px] leading-5 ${isDarkMode ? 'border-cyan-900/60 bg-cyan-950/20 text-slate-300' : 'border-cyan-200 bg-cyan-50 text-slate-600'}`}>
            <strong className={isDarkMode ? 'text-cyan-300' : 'text-cyan-700'}>填写说明：</strong>
            {single ? <>
              查询函数名是页面里 <code className="font-mono">window.函数名({'{'}request, onSuccess, onFailure{'}'})</code> 调用原生的入口；取消函数名对应 <code className="font-mono">window.函数名(查询ID)</code>，留空时桥使用默认 <code className="font-mono">cefQueryCancel</code>。
              通道在生成程序时于 <code className="font-mono">CEF3_初始化</code> 前置自动注册（运行期注册无效）。<strong>CEF3 桥每个程序只支持一条查询通道</strong>，页面要区分业务请在 request 载荷里自带标记；多个 CEF3 浏览器控件共享该通道，事件按控件绑定分发。
            </> : <>
              查询函数名是页面里 <code className="font-mono">window.函数名({'{'}request, onSuccess, onFailure{'}'})</code> 调用原生的入口；取消函数名对应 <code className="font-mono">window.函数名(查询ID)</code>，留空时桥使用默认 <code className="font-mono">lingQueryCancel</code>。
              通道在生成程序时于浏览器初始化前自动注册（运行期注册无效）；全部通道共用同一个 OnQuery 处理器，处理器无法区分来源通道。
            </>}
          </div>
          <div className={`sticky top-0 z-10 hidden grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-lg border px-3 py-2 text-[10px] font-medium sm:grid ${isDarkMode ? 'border-[#3b3b44] bg-[#292930] text-slate-300' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
            <span>序号</span>
            <span title="页面通过 window.该函数名({...}) 调用原生，必须是有唯一合法的 JavaScript 标识符。">查询函数名</span>
            <span title="页面通过 window.该函数名(查询ID) 取消持久查询；留空使用桥默认取消函数。">取消函数名（可留空）</span>
            {!single && <span className="text-right">顺序 / 删除</span>}
          </div>
          {channels.map((channel, index) => <div key={index} className={`rounded-lg border p-3 ${isDarkMode ? 'border-[#3b3b44]' : 'border-slate-200'}`}>
            <div className={`grid grid-cols-1 gap-2 ${single ? 'sm:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)]' : 'sm:grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_auto]'}`}>
              <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">序号</span><span className="block h-8 leading-8 text-center font-mono text-xs text-slate-500">{index + 1}</span></label>
              <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">查询函数名</span><input aria-label={`第 ${index + 1} 条查询函数名`} title="页面通过 window.该函数名({request, onSuccess, onFailure}) 调用原生；必须唯一且为合法 JavaScript 标识符。" value={channel.query} placeholder="如 cefQuery" onChange={event => updateChannel(index, { query: event.target.value })} className={`${inputClass} w-full font-mono`} /></label>
              <label className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">取消函数名（可留空）</span><input aria-label={`第 ${index + 1} 条取消函数名`} title="页面通过 window.该函数名(查询ID) 取消持久查询；留空使用桥默认取消函数。" value={channel.cancel} placeholder="如 cefQueryCancel" onChange={event => updateChannel(index, { cancel: event.target.value })} className={`${inputClass} w-full font-mono`} /></label>
              {!single && <div className="min-w-0"><span className="mb-1 block text-[10px] text-slate-500 sm:hidden">顺序 / 删除</span><div className="flex gap-1"><button type="button" aria-label={`上移第 ${index + 1} 条通道`} className={buttonClass} disabled={index === 0} onClick={() => moveChannel(index, index - 1)}><ArrowUp className="h-3 w-3" /></button><button type="button" aria-label={`下移第 ${index + 1} 条通道`} className={buttonClass} disabled={index === channels.length - 1} onClick={() => moveChannel(index, index + 1)}><ArrowDown className="h-3 w-3" /></button><button type="button" aria-label={`删除第 ${index + 1} 条通道`} className={`${buttonClass} text-red-400`} onClick={() => setChannels(current => current.filter((_, row) => row !== index))}><Trash2 className="h-3 w-3" /></button></div></div>}
            </div>
          </div>)}
          {!single && <button type="button" className={`${buttonClass} border-emerald-500/40 text-emerald-500`} onClick={() => setChannels(current => [...current, { query: '', cancel: '' }])}><Plus className="h-3 w-3" />新增通道</button>}
        </section>
        <aside className={`border-t p-4 lg:border-l lg:border-t-0 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}>
          <div className="mb-2 text-xs font-semibold">实时预览</div>
          <div className="mb-3 text-[10px] font-semibold text-slate-500">生成期注册（自动烘焙进生成程序）</div>
          {single ? <pre className={`overflow-auto rounded border p-2 font-mono text-[10px] leading-5 ${isDarkMode ? 'border-[#3b3b44] bg-[#17171c] text-emerald-300' : 'border-slate-200 bg-slate-50 text-emerald-700'}`}>{channels.filter(channel => channel.query.trim()).map(channel => `CEF3_初始化 前置自动执行： LB_CEF3_EnableJsQuery(L"${channel.query.trim()}", L"${channel.cancel.trim()}")`).join('\n') || '（未配置通道）'}</pre>
            : <pre className={`overflow-auto rounded border p-2 font-mono text-[10px] leading-5 ${isDarkMode ? 'border-[#3b3b44] bg-[#17171c] text-emerald-300' : 'border-slate-200 bg-slate-50 text-emerald-700'}`}>{channels.filter(channel => channel.query.trim()).map(channel => `LB_FBro_EnableJsQuery("${channel.query.trim()}", "${channel.cancel.trim()}")`).join('\n') || '（未配置通道）'}</pre>}
          <div className="mb-2 mt-3 text-[10px] font-semibold text-slate-500">页面调用（写进你的 HTML/JS）</div>
          <pre className={`overflow-auto rounded border p-2 font-mono text-[10px] leading-5 ${isDarkMode ? 'border-[#3b3b44] bg-[#17171c] text-sky-300' : 'border-slate-200 bg-slate-50 text-sky-700'}`}>{channels.filter(channel => channel.query.trim()).map(channel => {
            const cancel = channel.cancel.trim() || (single ? 'cefQueryCancel（默认）' : 'lingQueryCancel（默认）');
            return `window.${channel.query.trim()}({ request: "文本", persistent: false,\n  onSuccess: 应答 => {...}, onFailure: (代码, 错误) => {...} })\nwindow.${cancel}(查询ID)`;
          }).join('\n\n') || '（未配置通道）'}</pre>
          {single
            ? <p className="mt-3 text-[10px] leading-4 text-slate-500">原生侧在「查询请求」事件处理器里用 CEF3_取事件字段 读取 queryId / request，再用 CEF3_查询应答 或 CEF3_查询应答失败 应答；结果回传到对应查询的 onSuccess / onFailure。每条查询只能应答一次，120 秒未应答自动回 -4。</p>
            : <p className="mt-3 text-[10px] leading-4 text-slate-500">原生侧在 OnQuery 事件处理器里用 FBro_取事件字段 读取 request，再用 FBro事件_完成延续 应答；结果回传到对应查询的 onSuccess / onFailure。</p>}
        </aside>
      </main>
      {errors.length > 0 && <div role="alert" className={`border-t px-4 py-2 text-[11px] leading-5 text-red-400 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}>{errors.join(' ')}</div>}
      <footer className={`flex justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#3a3a42]' : 'border-slate-200'}`}>
        <button className={buttonClass} onClick={onClose}>取消</button>
        <button
          type="button"
          className={`${buttonClass} border-cyan-500 bg-cyan-600 text-white`}
          disabled={errors.length > 0}
          title={errors.length > 0 ? '请先修正校验错误' : undefined}
          onClick={() => onSave({ jsQueryFunctions: serializeFbroJsQueryChannels(channels) })}
        >保存通道</button>
      </footer>
    </div>
  </div>;
}
