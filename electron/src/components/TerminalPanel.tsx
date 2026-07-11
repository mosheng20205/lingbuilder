import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { TerminalSessionSnapshot } from '../services/terminal/ptyTerminalService';

export default function TerminalPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null); const terminalRef = useRef<Terminal>(); const fitRef = useRef<FitAddon>();
  const activeRef = useRef(''); const sequencesRef = useRef(new Map<string, number>());
  const [sessions, setSessions] = useState<TerminalSessionSnapshot[]>([]); const [activeId, setActiveId] = useState('');
  const [error, setError] = useState(''); const [creating, setCreating] = useState(false);
  activeRef.current = activeId;

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || '终端操作失败。'); return result;
  };

  const createSession = async (profile: 'powershell' | 'cmd' = 'powershell') => {
    if (creating) return; setCreating(true); setError('');
    try {
      const result = await request('/api/terminal/sessions', { method: 'POST', body: JSON.stringify({ profile, cols: 80, rows: 24 }) });
      setSessions(current => [...current.filter(item => item.id !== result.session.id), result.session]); setActiveId(result.session.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setCreating(false); }
  };

  useEffect(() => {
    let disposed = false;
    void request('/api/terminal/sessions').then(result => {
      if (disposed) return; const loaded = result.sessions as TerminalSessionSnapshot[]; setSessions(loaded);
      loaded.forEach(item => sequencesRef.current.set(item.id, item.sequence));
      if (loaded.length) setActiveId(current => current || loaded[0].id); else void createSession();
    }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    const events = new EventSource('/api/terminal/events');
    events.addEventListener('terminal', raw => {
      const event = JSON.parse((raw as MessageEvent).data) as { kind: string; session: TerminalSessionSnapshot; data?: string };
      if (event.kind === 'closed') {
        sequencesRef.current.delete(event.session.id); setSessions(current => current.filter(item => item.id !== event.session.id));
        setActiveId(current => current === event.session.id ? '' : current); return;
      }
      setSessions(current => [...current.filter(item => item.id !== event.session.id), event.session].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      const previous = sequencesRef.current.get(event.session.id) ?? -1;
      if (event.session.sequence <= previous) return;
      sequencesRef.current.set(event.session.id, event.session.sequence);
      if (event.kind === 'data' && event.session.id === activeRef.current && event.data) terminalRef.current?.write(event.data);
      if (event.kind === 'exited' && event.session.id === activeRef.current) terminalRef.current?.write(`\r\n\x1b[33m[进程已退出，代码 ${event.session.exitCode ?? 0}]\x1b[0m\r\n`);
    });
    events.onerror = () => setError('终端事件流已断开，正在自动重连。');
    return () => { disposed = true; events.close(); };
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    const terminal = new Terminal({ cursorBlink: true, convertEol: false, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13,
      theme: isDarkMode ? { background: '#0d0d10', foreground: '#d4d4d4', cursor: '#ffffff' } : { background: '#ffffff', foreground: '#1f2937', cursor: '#111827' } });
    const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(hostRef.current); terminalRef.current = terminal; fitRef.current = fit;
    const input = terminal.onData(data => { const id = activeRef.current; if (id) void request(`/api/terminal/sessions/${encodeURIComponent(id)}/input`, { method: 'POST', body: JSON.stringify({ data }) }).catch(reason => setError(reason.message)); });
    const observer = new ResizeObserver(() => {
      try { fit.fit(); } catch { return; }
      const id = activeRef.current; if (id) void request(`/api/terminal/sessions/${encodeURIComponent(id)}/resize`, { method: 'POST', body: JSON.stringify({ cols: terminal.cols, rows: terminal.rows }) }).catch(() => undefined);
    });
    observer.observe(hostRef.current); queueMicrotask(() => fit.fit());
    return () => { observer.disconnect(); input.dispose(); terminal.dispose(); terminalRef.current = undefined; };
  }, [isDarkMode]);

  useEffect(() => {
    const terminal = terminalRef.current; if (!terminal || !activeId) return;
    const session = sessions.find(item => item.id === activeId); if (!session) return;
    terminal.reset(); terminal.write(session.buffer); terminal.focus();
    try { fitRef.current?.fit(); } catch { /* hidden panel */ }
  }, [activeId]);

  useEffect(() => {
    if (activeId || !sessions.length) return; setActiveId(sessions[0].id);
  }, [activeId, sessions]);

  const closeSession = async (id: string) => {
    try { await request(`/api/terminal/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <div className={`flex h-full min-h-0 flex-col ${isDarkMode ? 'bg-[#0d0d10] text-slate-200' : 'bg-white text-slate-800'}`}>
    <div className={`flex h-8 shrink-0 items-center border-b ${isDarkMode ? 'border-slate-800 bg-[#18181c]' : 'border-slate-200 bg-slate-100'}`}>
      <div className="flex min-w-0 flex-1 overflow-x-auto">
        {sessions.map(session => <button key={session.id} type="button" onClick={() => setActiveId(session.id)} className={`flex shrink-0 items-center gap-2 border-r px-3 text-[11px] ${activeId === session.id ? 'bg-[#007acc] text-white' : isDarkMode ? 'border-slate-800 text-slate-400 hover:text-white' : 'border-slate-200 hover:bg-white'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${session.status === 'running' ? 'bg-emerald-400' : 'bg-slate-500'}`} />{session.title}
          <span onClick={event => { event.stopPropagation(); void closeSession(session.id); }} role="button" aria-label={`关闭 ${session.title}`}><Trash2 className="h-3 w-3" /></span>
        </button>)}
      </div>
      <button type="button" disabled={creating} onClick={() => void createSession('powershell')} title="新建 PowerShell 终端" aria-label="新建终端" className="px-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
      {typeof navigator !== 'undefined' && navigator.userAgent.includes('Windows') && <button type="button" disabled={creating} onClick={() => void createSession('cmd')} className="border-l border-slate-700 px-2 text-[10px] text-slate-400 hover:text-white">CMD</button>}
    </div>
    {error && <div role="alert" className="shrink-0 bg-rose-950/80 px-3 py-1 text-[10px] text-rose-200">{error}</div>}
    <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden p-1" aria-label="集成终端" />
  </div>;
}
