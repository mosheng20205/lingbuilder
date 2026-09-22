import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import type { CommandService } from '../services/commands/commandService';
import type { ResolvedMenuCommandItem } from '../services/menus/types';
import { TERMINAL_CONTEXT_MENU } from '../services/menus/types';
import { getMenuService } from '../services/menus/menuService';
import WorkbenchContextMenu from './WorkbenchContextMenu';
import type { TerminalEvent, TerminalSessionSnapshot } from '../services/terminal/ptyTerminalService';

interface TerminalPanelProps {
  isDarkMode: boolean;
  commandService?: CommandService;
}

interface TerminalServerMessage {
  type: 'snapshot' | 'event' | 'error';
  session?: TerminalSessionSnapshot;
  event?: TerminalEvent;
  error?: string;
}

type TerminalClientMessage = { type: 'input'; id: string; data: string } | { type: 'resize'; id: string; cols: number; rows: number };

export default function TerminalPanel({ isDarkMode, commandService }: TerminalPanelProps) {
  const hostRef = useRef<HTMLDivElement>(null); const terminalRef = useRef<Terminal | undefined>(undefined); const fitRef = useRef<FitAddon | undefined>(undefined);
  const activeRef = useRef(''); const socketRef = useRef<WebSocket | null>(null); const connectedRef = useRef(false);
  const pendingRef = useRef<string[]>([]); const snapshotsRef = useRef(new Map<string, TerminalSessionSnapshot>()); const sequencesRef = useRef(new Map<string, number>());
  const [sessions, setSessions] = useState<TerminalSessionSnapshot[]>([]); const [activeId, setActiveId] = useState('');
  const [error, setError] = useState(''); const [creating, setCreating] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  activeRef.current = activeId;

  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error || '终端操作失败。'); return result;
  };

  // 通道未就绪时把输入/尺寸消息排队，重连成功后按序补发，保证按键不丢不乱序
  const sendClient = useCallback((message: TerminalClientMessage) => {
    const socket = socketRef.current;
    const text = JSON.stringify(message);
    if (connectedRef.current && socket?.readyState === WebSocket.OPEN) {
      socket.send(text);
      return;
    }
    pendingRef.current.push(text);
    if (pendingRef.current.length > 400) pendingRef.current.shift();
  }, []);

  // 以服务端快照为权威状态重置回放：重连、切换页签、主题重建都经它修复任何分叉
  const replayInto = useCallback((sessionId: string) => {
    const terminal = terminalRef.current;
    if (!terminal || !sessionId || activeRef.current !== sessionId) return;
    const snapshot = snapshotsRef.current.get(sessionId);
    terminal.reset();
    if (snapshot) terminal.write(snapshot.buffer);
    try { fitRef.current?.fit(); } catch { /* 面板隐藏 */ }
    if (snapshot) sendClient({ type: 'resize', id: sessionId, cols: terminal.cols, rows: terminal.rows });
  }, [sendClient]);

  const handleServerMessage = useCallback((message: TerminalServerMessage) => {
    if (message.type === 'snapshot' && message.session) {
      const session = message.session;
      snapshotsRef.current.set(session.id, session);
      sequencesRef.current.set(session.id, session.sequence);
      setSessions(current => [...current.filter(item => item.id !== session.id), session].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      replayInto(session.id);
      return;
    }
    if (message.type === 'event' && message.event) {
      const event = message.event; const session = event.session;
      if (event.kind === 'closed') {
        snapshotsRef.current.delete(session.id); sequencesRef.current.delete(session.id);
        setSessions(current => current.filter(item => item.id !== session.id));
        setActiveId(current => (current === session.id ? '' : current));
        return;
      }
      snapshotsRef.current.set(session.id, session);
      const previous = sequencesRef.current.get(session.id) ?? -1;
      if (session.sequence <= previous) return;
      sequencesRef.current.set(session.id, session.sequence);
      // data 事件只走 ref，不触发面板重渲染；created/resized/exited 才更新标签列表
      if (event.kind !== 'data') {
        setSessions(current => [...current.filter(item => item.id !== session.id), session].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      }
      if (event.kind === 'data' && session.id === activeRef.current && event.data) terminalRef.current?.write(event.data);
      if (event.kind === 'exited' && session.id === activeRef.current) terminalRef.current?.write(`\r\n\x1b[33m[进程已退出，代码 ${session.exitCode ?? 0}]\x1b[0m\r\n`);
      return;
    }
    if (message.type === 'error' && message.error) setError(message.error);
  }, [replayInto]);

  const pasteClipboard = useCallback(async (terminal?: Terminal) => {
    if (!terminal) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) terminal.paste(text);
    } catch {
      setError('无法读取剪贴板内容，请重试一次。');
    }
  }, []);

  const copySelection = useCallback(async (terminal?: Terminal) => {
    if (!terminal?.hasSelection()) return;
    try { await navigator.clipboard.writeText(terminal.getSelection()); } catch { setError('复制所选内容失败，请重试一次。'); }
  }, []);

  // 单条 WebSocket 双向通道：上行按键/尺寸，下行快照与输出，断线自动重连并以快照回放自愈
  useEffect(() => {
    let disposed = false;
    let retryTimer: number | undefined;
    let retryCount = 0;
    let connecting = false;
    const connect = async () => {
      if (disposed || connecting) return;
      connecting = true;
      try {
        // WS 握手无法复用主进程注入的会话请求头，改用一次性票据（30 秒有效、防重放）
        const ticketResult = await request('/api/terminal/ws-ticket', { method: 'POST' });
        if (disposed) { connecting = false; return; }
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/api/terminal/ws?ticket=${encodeURIComponent(String(ticketResult.ticket))}`);
        socketRef.current = socket;
        socket.onopen = () => {
          connecting = false;
          if (disposed) { socket.close(); return; }
          connectedRef.current = true; retryCount = 0; setError('');
          const pending = pendingRef.current; pendingRef.current = [];
          pending.forEach(text => socket.send(text));
        };
        socket.onmessage = event => {
          try { handleServerMessage(JSON.parse(String(event.data)) as TerminalServerMessage); } catch { /* 忽略无法解析的消息 */ }
        };
        socket.onclose = () => {
          connecting = false;
          connectedRef.current = false;
          if (socketRef.current === socket) socketRef.current = null;
          if (disposed) return;
          retryCount += 1;
          setError('终端通道已断开，正在自动重连…');
          retryTimer = window.setTimeout(() => { void connect(); }, Math.min(400 * retryCount, 4000));
        };
      } catch (reason) {
        connecting = false;
        if (disposed) return;
        retryCount += 1;
        setError(reason instanceof Error ? reason.message : '终端通道连接失败。');
        retryTimer = window.setTimeout(() => { void connect(); }, Math.min(400 * retryCount, 4000));
      }
    };
    void connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      connectedRef.current = false;
      const socket = socketRef.current; socketRef.current = null;
      socket?.close();
    };
  }, [handleServerMessage]);

  const createSession = async (profile: 'powershell' | 'cmd' = 'powershell') => {
    if (creating) return; setCreating(true); setError('');
    try {
      const result = await request('/api/terminal/sessions', { method: 'POST', body: JSON.stringify({ profile, cols: 80, rows: 24 }) });
      const session = result.session as TerminalSessionSnapshot;
      snapshotsRef.current.set(session.id, session);
      sequencesRef.current.set(session.id, session.sequence);
      setSessions(current => [...current.filter(item => item.id !== session.id), session].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      setActiveId(session.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setCreating(false); }
  };

  useEffect(() => {
    let disposed = false;
    void request('/api/terminal/sessions').then(result => {
      if (disposed) return; const loaded = result.sessions as TerminalSessionSnapshot[];
      loaded.forEach(item => { snapshotsRef.current.set(item.id, item); sequencesRef.current.set(item.id, item.sequence); });
      setSessions(loaded.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      if (loaded.length) setActiveId(current => current || loaded[0].id); else void createSession();
    }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason)));
    return () => { disposed = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hostRef.current) return;
    const terminal = new Terminal({ cursorBlink: true, convertEol: false, fontFamily: 'Cascadia Mono, Consolas, monospace', fontSize: 13,
      theme: isDarkMode ? { background: '#0d0d10', foreground: '#d4d4d4', cursor: '#ffffff' } : { background: '#ffffff', foreground: '#1f2937', cursor: '#111827' } });
    const fit = new FitAddon(); terminal.loadAddon(fit); terminal.open(hostRef.current); terminalRef.current = terminal; fitRef.current = fit;

    // xterm 默认吞掉 Ctrl+V/Ctrl+Shift+V，这里接管成真正的剪贴板粘贴；Ctrl+C 保留「有选区复制、无选区中断」的终端惯例
    terminal.attachCustomKeyEventHandler(event => {
      if (event.type !== 'keydown') return true;
      const control = event.ctrlKey && !event.altKey && !event.metaKey;
      if (control && !event.shiftKey && (event.key === 'v' || event.key === 'V')) {
        event.preventDefault(); void pasteClipboard(terminal); return false;
      }
      if (event.shiftKey && event.key === 'Insert') {
        event.preventDefault(); void pasteClipboard(terminal); return false;
      }
      if (control && !event.shiftKey && (event.key === 'c' || event.key === 'C') && terminal.hasSelection()) {
        event.preventDefault(); void copySelection(terminal); return false;
      }
      if (control && event.key === 'Insert' && terminal.hasSelection()) {
        event.preventDefault(); void copySelection(terminal); return false;
      }
      return true;
    });

    const input = terminal.onData(data => { const id = activeRef.current; if (id) sendClient({ type: 'input', id, data }); });
    const observer = new ResizeObserver(() => {
      try { fit.fit(); } catch { return; }
      const id = activeRef.current; if (id) sendClient({ type: 'resize', id, cols: terminal.cols, rows: terminal.rows });
    });
    observer.observe(hostRef.current); queueMicrotask(() => fit.fit());
    // 主题切换会重建 Terminal 实例，立即回放当前会话，避免内容与光标状态被清空
    const active = activeRef.current; const snapshot = active ? snapshotsRef.current.get(active) : undefined;
    if (active && snapshot) terminal.write(snapshot.buffer);
    return () => { observer.disconnect(); input.dispose(); terminal.dispose(); terminalRef.current = undefined; fitRef.current = undefined; };
  }, [isDarkMode, sendClient, pasteClipboard, copySelection]);

  useEffect(() => {
    const terminal = terminalRef.current; if (!terminal || !activeId) return;
    const snapshot = snapshotsRef.current.get(activeId);
    terminal.reset();
    if (snapshot) terminal.write(snapshot.buffer);
    terminal.focus();
    try { fitRef.current?.fit(); } catch { /* 面板隐藏 */ }
  }, [activeId]);

  useEffect(() => {
    if (activeId || !sessions.length) return; setActiveId(sessions[0].id);
  }, [activeId, sessions]);

  // 终端右键菜单：命令注册进 CommandService、菜单项注册进 MenuService，与工作台其余菜单同一套模型
  useEffect(() => {
    if (!commandService) return;
    const registrations = commandService.registerCommands([
      { id: 'workbench.action.terminal.paste', title: '终端：粘贴', category: '终端', description: '把剪贴板文本粘贴到当前集成终端。',
        enabled: () => Boolean(terminalRef.current),
        handler: async () => { await pasteClipboard(terminalRef.current); } },
      { id: 'workbench.action.terminal.copySelection', title: '终端：复制所选内容', category: '终端', description: '复制终端里选中的文本。',
        enabled: () => Boolean(terminalRef.current?.hasSelection()),
        handler: async () => { await copySelection(terminalRef.current); } },
      { id: 'workbench.action.terminal.selectAll', title: '终端：全选', category: '终端', description: '选中当前终端缓冲区全部文本。',
        enabled: () => Boolean(terminalRef.current),
        handler: () => { terminalRef.current?.selectAll(); } },
      { id: 'workbench.action.terminal.clear', title: '终端：清屏', category: '终端', description: '清空当前终端的显示缓冲。',
        enabled: () => Boolean(terminalRef.current),
        handler: () => { terminalRef.current?.clear(); } }
    ]);
    const menus = getMenuService(commandService).registerMenuItems([
      { menu: TERMINAL_CONTEXT_MENU, command: 'workbench.action.terminal.paste', group: 'clipboard', order: 1 },
      { menu: TERMINAL_CONTEXT_MENU, command: 'workbench.action.terminal.copySelection', group: 'clipboard', order: 2 },
      { menu: TERMINAL_CONTEXT_MENU, command: 'workbench.action.terminal.selectAll', group: 'selection', order: 1 },
      { menu: TERMINAL_CONTEXT_MENU, command: 'workbench.action.terminal.clear', group: 'state', order: 1 }
    ]);
    return () => { menus.dispose(); registrations.dispose(); };
  }, [commandService, pasteClipboard, copySelection]);

  const executeMenuItem = async (item: ResolvedMenuCommandItem) => {
    setMenuPosition(null);
    if (!commandService) return;
    try { await commandService.executeCommand(item.command.id, {}, ...item.arguments); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

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
    <div ref={hostRef} className="min-h-0 flex-1 overflow-hidden p-1" aria-label="集成终端"
      onContextMenu={event => { event.preventDefault(); setMenuPosition({ x: event.clientX, y: event.clientY }); }} />
    {menuPosition && commandService && <WorkbenchContextMenu
      x={menuPosition.x} y={menuPosition.y}
      items={getMenuService(commandService).resolveMenu(TERMINAL_CONTEXT_MENU, {}, { includeDisabled: true })}
      isDarkMode={isDarkMode}
      ariaLabel="终端菜单"
      onExecute={item => executeMenuItem(item)}
      onClose={() => setMenuPosition(null)}
    />}
  </div>;
}
