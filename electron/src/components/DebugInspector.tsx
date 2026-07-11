import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';

interface Variable { name: string; value: string; type?: string; variablesReference: number }
interface Thread { id: number; name: string }
interface Frame { id: number; name: string; line: number; column: number; sourcePath?: string; sourceName?: string }
interface Scope { name: string; variablesReference: number; expensive: boolean; variables: Variable[] }
interface Inspection { threadId: number; frameId: number; threads: Thread[]; stackFrames: Frame[]; scopes: Scope[] }
interface Watch { expression: string; result?: string; type?: string; error?: string }

export default function DebugInspector({ isDarkMode }: { isDarkMode: boolean }) {
  const [inspection, setInspection] = useState<Inspection | null>(null); const [state, setState] = useState('未启动');
  const [loading, setLoading] = useState(false); const [error, setError] = useState('');
  const [children, setChildren] = useState<Record<number, Variable[]>>({}); const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [watchInput, setWatchInput] = useState(''); const [watches, setWatches] = useState<Watch[]>([]);
  const [advancedOutput, setAdvancedOutput] = useState(''); const [memoryReference, setMemoryReference] = useState('');
  const watchesRef = useRef<Watch[]>([]); watchesRef.current = watches;

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || '调试请求失败。'); return result;
  };
  const evaluateWatches = useCallback(async (frameId: number, current: Watch[]) => {
    const values = await Promise.all(current.map(async watch => {
      try { const result = await request('/api/debug/evaluate', { method: 'POST', body: JSON.stringify({ expression: watch.expression, frameId }) }); return { expression: watch.expression, result: result.evaluation.result, type: result.evaluation.type }; }
      catch (reason) { return { expression: watch.expression, error: reason instanceof Error ? reason.message : String(reason) }; }
    })); setWatches(values);
  }, []);
  const loadInspection = useCallback(async (threadId?: number, frameId?: number) => {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams(); if (threadId) query.set('threadId', String(threadId)); if (frameId) query.set('frameId', String(frameId));
      const result = await request(`/api/debug/inspection${query.size ? `?${query}` : ''}`); setInspection(result.inspection); setChildren({}); setExpanded(new Set());
      void evaluateWatches(result.inspection.frameId, watchesRef.current);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [evaluateWatches]);

  useEffect(() => {
    void request('/api/debug/session').then(result => { const session = result.session; setState(session?.state || '未启动'); if (session?.state === 'stopped') void loadInspection(); }).catch(() => undefined);
    const events = new EventSource('/api/debug/events');
    events.addEventListener('debug', raw => { const session = JSON.parse((raw as MessageEvent).data); setState(session.state); if (session.state === 'stopped') void loadInspection(); else if (session.state === 'running') setError('程序正在运行；暂停后可读取变量。'); });
    return () => events.close();
  }, [loadInspection]);

  const toggleChildren = async (variable: Variable) => {
    if (!variable.variablesReference) return;
    if (expanded.has(variable.variablesReference)) { setExpanded(current => { const next = new Set(current); next.delete(variable.variablesReference); return next; }); return; }
    try {
      if (!children[variable.variablesReference]) { const result = await request(`/api/debug/variables/${variable.variablesReference}`); setChildren(current => ({ ...current, [variable.variablesReference]: result.variables })); }
      setExpanded(current => new Set(current).add(variable.variablesReference));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const addWatch = () => { const expression = watchInput.trim(); if (!expression || watches.some(item => item.expression === expression)) return; const next = [...watches, { expression }]; setWatches(next); setWatchInput(''); if (inspection) void evaluateWatches(inspection.frameId, next); };
  const runAdvanced = async (kind: 'attach' | 'dump' | 'remote') => {
    const program = window.prompt('输入工作区内可执行文件路径（按 PID 附加可留空）', '') ?? ''; let body: Record<string, unknown>;
    if (kind === 'attach') body = { pid: Number(window.prompt('输入进程 PID', '')) , ...(program ? { program } : {}) };
    else if (kind === 'dump') body = { program, coreFile: window.prompt('输入工作区内 .dmp/core 路径', '') || '' };
    else body = { program, host: window.prompt('远程主机', 'localhost') || 'localhost', port: Number(window.prompt('gdb-remote 端口', '1234')) };
    setError(''); try { const result = await request(`/api/debug/${kind}`, { method: 'POST', body: JSON.stringify(body) }); setState(result.session.state); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const inspectAdvanced = async (kind: 'registers' | 'memory' | 'disassembly') => {
    if (!inspection) return; setError('');
    try {
      const url = kind === 'registers' ? `/api/debug/registers?frameId=${inspection.frameId}` : `/api/debug/${kind}?reference=${encodeURIComponent(memoryReference)}&count=${kind === 'memory' ? 256 : 64}`;
      const result = await request(url); const value = kind === 'registers' ? result.registers : kind === 'memory' ? result.memory : result.instructions;
      setAdvancedOutput(JSON.stringify(value, null, 2));
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  const panel = isDarkMode ? 'border-slate-800 bg-[#18181d]' : 'border-slate-200 bg-slate-50';
  return <div className={`grid h-full min-h-0 grid-cols-[180px_260px_minmax(300px,1fr)] overflow-hidden text-[11px] ${isDarkMode ? 'text-slate-300' : 'text-slate-700'}`}>
    <section className={`overflow-auto border-r ${panel}`} aria-label="线程列表">
      <h3 className="sticky top-0 border-b border-inherit px-3 py-2 font-semibold">线程 · {state}</h3>
      {inspection?.threads.map(thread => <button key={thread.id} onClick={() => void loadInspection(thread.id)} className={`block w-full px-3 py-2 text-left ${thread.id === inspection.threadId ? 'bg-blue-600 text-white' : 'hover:bg-blue-500/10'}`}>{thread.name}<span className="ml-1 opacity-60">#{thread.id}</span></button>)}
    </section>
    <section className={`overflow-auto border-r ${panel}`} aria-label="调用堆栈">
      <h3 className="sticky top-0 border-b border-inherit px-3 py-2 font-semibold">调用堆栈</h3>
      {inspection?.stackFrames.map(frame => <button key={frame.id} onClick={() => void loadInspection(inspection.threadId, frame.id)} className={`block w-full border-b border-inherit px-3 py-2 text-left ${frame.id === inspection.frameId ? 'bg-violet-600/30' : 'hover:bg-violet-500/10'}`}>
        <div className="truncate font-mono text-cyan-500">{frame.name}</div><div className="truncate opacity-60">{frame.sourceName || frame.sourcePath || '无源码'}:{frame.line}:{frame.column}</div>
      </button>)}
    </section>
    <section className="min-w-0 overflow-auto" aria-label="局部变量和监视">
      <div className={`sticky top-0 z-10 flex items-center gap-2 border-b px-3 py-2 ${panel}`}><strong>局部变量 / Watch</strong>{loading && <span className="text-amber-500">正在读取…</span>}{error && <span role="alert" className="truncate text-rose-500">{error}</span>}</div>
      {inspection?.scopes.map(scope => <div key={scope.variablesReference} className="border-b border-slate-700/40"><div className="bg-slate-500/10 px-3 py-1.5 font-semibold">{scope.name}</div>{scope.variables.map(variable => <VariableRow key={`${scope.variablesReference}:${variable.name}`} variable={variable} depth={0} expanded={expanded} children={children} onToggle={toggleChildren} />)}</div>)}
      <div className="border-t border-slate-700/60 p-3">
        <div className="mb-2 flex gap-2"><input value={watchInput} onChange={event => setWatchInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') addWatch(); }} placeholder="输入监视表达式" className={`min-w-0 flex-1 rounded border px-2 py-1 ${isDarkMode ? 'border-slate-700 bg-black/20' : 'border-slate-300 bg-white'}`} /><button onClick={addWatch} aria-label="添加监视表达式"><Plus className="h-4 w-4" /></button></div>
        {watches.map(watch => <div key={watch.expression} className="grid grid-cols-[minmax(80px,1fr)_minmax(80px,1fr)_20px] border-b border-slate-700/30 py-1 font-mono"><span className="truncate text-amber-500">{watch.expression}</span><span className={watch.error ? 'text-rose-500' : 'truncate'}>{watch.error || `${watch.result ?? '…'}${watch.type ? ` (${watch.type})` : ''}`}</span><button onClick={() => setWatches(current => current.filter(item => item.expression !== watch.expression))} aria-label={`删除监视 ${watch.expression}`}><Trash2 className="h-3 w-3" /></button></div>)}
      </div>
      <div className="border-t border-slate-700/60 p-3" aria-label="高级原生调试">
        <div className="mb-2 font-semibold">高级原生调试</div>
        <div className="mb-2 flex flex-wrap gap-2"><button onClick={() => void runAdvanced('attach')} className="rounded border border-slate-600 px-2 py-1">附加进程</button><button onClick={() => void runAdvanced('remote')} className="rounded border border-slate-600 px-2 py-1">远程连接</button><button onClick={() => void runAdvanced('dump')} className="rounded border border-slate-600 px-2 py-1">打开 Dump</button><button disabled={!inspection} onClick={() => void inspectAdvanced('registers')} className="rounded border border-slate-600 px-2 py-1 disabled:opacity-40">寄存器</button></div>
        <div className="flex gap-2"><input value={memoryReference} onChange={event => setMemoryReference(event.target.value)} placeholder="内存引用，如 0x7ff..." className={`min-w-0 flex-1 rounded border px-2 py-1 ${isDarkMode ? 'border-slate-700 bg-black/20' : 'border-slate-300 bg-white'}`} /><button disabled={!inspection || !memoryReference} onClick={() => void inspectAdvanced('memory')}>内存</button><button disabled={!inspection || !memoryReference} onClick={() => void inspectAdvanced('disassembly')}>反汇编</button></div>
        {advancedOutput && <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/20 p-2 font-mono">{advancedOutput}</pre>}
      </div>
    </section>
  </div>;
}

function VariableRow({ variable, depth, expanded, children, onToggle }: { key?: React.Key; variable: Variable; depth: number; expanded: Set<number>; children: Record<number, Variable[]>; onToggle: (variable: Variable) => void }) {
  const open = expanded.has(variable.variablesReference);
  return <><button type="button" onClick={() => void onToggle(variable)} className="grid w-full grid-cols-[minmax(120px,1fr)_minmax(120px,1fr)_100px] border-b border-slate-700/20 py-1 text-left font-mono hover:bg-sky-500/5" style={{ paddingLeft: 12 + depth * 16 }}>
    <span className="flex min-w-0 items-center truncate text-sky-500">{variable.variablesReference ? open ? <ChevronDown className="mr-1 h-3 w-3" /> : <ChevronRight className="mr-1 h-3 w-3" /> : <span className="mr-4" />}{variable.name}</span><span className="truncate">{variable.value}</span><span className="truncate opacity-60">{variable.type || ''}</span>
  </button>{open && (children[variable.variablesReference] || []).map(child => <VariableRow key={`${variable.variablesReference}:${child.name}`} variable={child} depth={depth + 1} expanded={expanded} children={children} onToggle={onToggle} />)}</>;
}
