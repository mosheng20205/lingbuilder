import React, { useEffect, useState } from 'react';
import { Box, ChevronDown, ChevronRight, Play, RefreshCw } from 'lucide-react';

interface Extension { id: string; enabled: boolean; state: string; error?: string; activationCount: number; manifest: any }
interface Host { state: string; pid?: number; restartCount: number; extensions: Extension[]; logs: string[] }

export default function ExtensionHostPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const [host, setHost] = useState<Host | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) } });
    const body = await response.json();
    if (!response.ok || !body.ok) throw new Error(body.error || '扩展请求失败。');
    return body;
  };
  const perform = async (action: () => Promise<any>, notifyChange = false) => {
    setBusy(true); setError('');
    try {
      const body = await action();
      if (body.host) setHost(body.host);
      if (notifyChange) window.dispatchEvent(new CustomEvent('lingbuilder-extensions-changed'));
      return body;
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setBusy(false); }
  };
  const refresh = () => perform(() => request('/api/extensions/refresh', { method: 'POST' }), true);
  useEffect(() => { void perform(() => request('/api/extensions')); }, []);
  const execute = (command?: string) => {
    if (!command) return;
    void perform(async () => {
      const body = await request(`/api/extensions/commands/${encodeURIComponent(command)}`, { method: 'POST', body: JSON.stringify({ args: [] }) });
      setResult(`${command} → ${JSON.stringify(body.result)}`);
      return body;
    });
  };
  const toggle = (extension: Extension, enabled: boolean) => {
    const permissions = extension.manifest.permissions || [];
    if (enabled && permissions.includes('designer.write')) {
      const accepted = window.confirm(`扩展“${extension.manifest.displayName || extension.id}”请求设计器写入权限。\n\n它可提交受控、可撤销的控件修改，但不能直接替换项目模型或执行 Shell。\n\n是否启用？`);
      if (!accepted) return;
    }
    void perform(() => request(`/api/extensions/${encodeURIComponent(extension.id)}/enabled`, {
      method: 'PUT', body: JSON.stringify({ enabled })
    }), true);
  };
  const surface = isDarkMode ? 'border-[#2d2d34] bg-[#1e1e1e]' : 'border-slate-200 bg-white';
  return (
    <div className={`rounded border text-[10px] ${surface}`} aria-label="扩展管理">
      <button className="flex w-full items-center gap-1 px-2 py-1.5 text-left" onClick={() => setOpen(value => !value)}>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <Box className="h-3 w-3 text-violet-500" /><span className="min-w-0 flex-1">Extension Host · {host?.state || '启动中'}</span><span>{host?.extensions.length || 0}</span>
      </button>
      {open && <div className="border-t border-inherit p-2">
        <div className="mb-2 flex items-center gap-2"><span>PID {host?.pid || '—'} · 恢复 {host?.restartCount || 0}</span><button title="刷新扩展" disabled={busy} onClick={() => void refresh()} className="ml-auto"><RefreshCw className={`h-3 w-3 ${busy ? 'animate-spin' : ''}`} /></button></div>
        {error && <div role="alert" className="mb-2 text-rose-500">{error}</div>}
        {result && <div role="status" className="mb-2 break-all text-emerald-500">{result}</div>}
        {host?.extensions.map(extension => <div key={extension.id} className="border-t border-inherit py-1.5">
          <div className="flex items-center gap-1"><span className="min-w-0 flex-1 truncate font-semibold" title={extension.id}>{extension.manifest.displayName || extension.id}</span><span className={extension.state === 'error' ? 'text-rose-500' : extension.state === 'active' ? 'text-emerald-500' : 'opacity-60'}>{extension.state}</span><input aria-label={`启用扩展 ${extension.id}`} type="checkbox" checked={extension.enabled} disabled={busy || extension.state === 'error'} onChange={event => toggle(extension, event.target.checked)} /></div>
          {extension.error && <div className="text-rose-500">{extension.error}</div>}
          {extension.enabled && <>
            <div className="mt-1 flex flex-wrap gap-1">{(extension.manifest.contributes?.commands || []).map((command: any) => <button key={command.command} onClick={() => execute(command.command)} className="rounded border border-inherit px-1 py-0.5"><Play className="inline h-2.5 w-2.5" /> {command.title}</button>)}</div>
            {(extension.manifest.contributes?.menus || []).map((menu: any, index: number) => <button key={`${menu.menu}:${index}`} disabled={!menu.command} onClick={() => execute(menu.command)} className="mt-1 block w-full truncate text-left text-blue-500 disabled:opacity-50">菜单 {menu.menu}：{menu.command || menu.submenu}</button>)}
            {(extension.manifest.contributes?.views || []).map((view: any) => <div key={view.id} className="mt-1 rounded border border-inherit px-1 py-0.5">视图 · {view.name}</div>)}
            {(extension.manifest.contributes?.languages || []).map((language: any) => <button key={language.id} onClick={() => void perform(() => request(`/api/extensions/languages/${encodeURIComponent(language.id)}/activate`, { method: 'POST' }))} className="mt-1 mr-1 text-cyan-500">语言 · {language.id}</button>)}
            {(extension.manifest.contributes?.themes || []).map((theme: any) => <span key={theme.id} className="mt-1 mr-1 inline-block text-violet-500">主题 · {theme.label}</span>)}
          </>}
        </div>)}
      </div>}
    </div>
  );
}
