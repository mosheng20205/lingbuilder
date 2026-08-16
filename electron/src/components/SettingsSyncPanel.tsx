import React, { useState } from 'react';
import { Download, RefreshCw, ShieldCheck, Upload } from 'lucide-react';
import { requestWorkbenchConfirm, requestWorkbenchPrompt } from '../services/workbench/workbenchConfirmService';

export default function SettingsSyncPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('不会包含 API Key、令牌或密码'); const [error, setError] = useState('');
  const call = async (url: string, body: unknown) => { const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; };
  const run = async (action: () => Promise<void>) => { setBusy(true); setError(''); try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const exportBundle = () => run(async () => { const value = await call('/api/settings-sync/export', {}); setMessage(`已导出 ${value.result.bundle.entries.length} 个设置作用域`); });
  const importBundle = () => { void (async () => { const filePath = await requestWorkbenchPrompt({ title: '导入设置同步包', description: '输入工作区内设置同步包路径', inputLabel: '同步包路径', inputValue: '.lingbuilder/settings-sync.json' }); if (!filePath) return; await run(async () => { const preview = (await call('/api/settings-sync/preview', { filePath })).preview; if (!await requestWorkbenchConfirm({ title: '导入设置', description: `将导入 ${preview.scopes.join('、')} 设置，是否继续？`, confirmLabel: '导入', cancelLabel: '取消' })) return; const value = await call('/api/settings-sync/import', { filePath, token: preview.token }); setMessage(`已同步：${value.result.scopes.join('、')}`); }); })(); };
  const surface = isDarkMode ? 'border-slate-800 bg-[#1b1b1d] shadow-black/10' : 'border-slate-200 bg-white shadow-slate-200/50';
  const iconButton = `flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
  return (
    <section className={`rounded-lg border p-3 text-xs shadow-sm ${surface}`} aria-labelledby="settings-sync-title">
      <div className="flex min-w-0 items-center gap-2.5"><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} /></span><div className="min-w-0 flex-1"><strong id="settings-sync-title" className={isDarkMode ? 'text-slate-100' : 'text-slate-800'}>设置同步</strong><div role="status" aria-live="polite" className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-slate-500"><ShieldCheck className="h-3 w-3 shrink-0 text-emerald-500" />{busy ? '正在同步设置…' : message}</div></div><button aria-label="导出设置同步包" title="导出设置" disabled={busy} onClick={exportBundle} className={iconButton}><Download className="h-3.5 w-3.5" /></button><button aria-label="导入设置同步包" title="导入设置" disabled={busy} onClick={importBundle} className={iconButton}><Upload className="h-3.5 w-3.5" /></button></div>
      {error && <div role="alert" className={`mt-2 rounded-md border px-2.5 py-2 text-[10px] ${isDarkMode ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{error}</div>}
    </section>
  );
}
