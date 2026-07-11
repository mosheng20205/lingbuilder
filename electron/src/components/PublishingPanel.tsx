import React, { useState } from 'react';
import { CheckCircle2, FileJson, PackageCheck, RefreshCw, ShieldCheck } from 'lucide-react';

export default function PublishingPanel({ isDarkMode }: { isDarkMode: boolean }) {
  const [configuration, setConfiguration] = useState<any>();
  const [configurationChecked, setConfigurationChecked] = useState(false);
  const [result, setResult] = useState<any>();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const request = async (url: string, options?: RequestInit) => { const response = await fetch(url, options); const value = await response.json(); if (!response.ok || !value.ok) throw new Error(value.error || '发布操作失败。'); return value; };
  const load = async () => { setBusy(true); setError(''); try { const value = await request('/api/publishing/configuration'); setConfiguration(value.configuration || undefined); setConfigurationChecked(true); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const publish = async () => { setBusy(true); setError(''); try { setResult((await request('/api/publishing/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ configuration }) })).result); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } finally { setBusy(false); } };
  const verify = async () => { const filePath = window.prompt('输入工作区内需要验证签名的 EXE/DLL 路径'); if (!filePath) return; try { const value = await request('/api/publishing/verify-signature', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath }) }); window.alert(value.valid ? 'Authenticode 签名有效。' : '签名无效或未签名。'); } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); } };
  const surface = isDarkMode ? 'border-slate-800 bg-[#1b1b1d] shadow-black/10' : 'border-slate-200 bg-white shadow-slate-200/50';
  const iconButton = `flex h-7 w-7 items-center justify-center rounded-md border transition-colors focus:outline-none focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'border-slate-700 bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;
  return (
    <section className={`rounded-lg border p-3 text-xs shadow-sm ${surface}`} aria-labelledby="publishing-title">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isDarkMode ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-50 text-sky-600'}`}><PackageCheck className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1"><strong id="publishing-title" className={isDarkMode ? 'text-slate-100' : 'text-slate-800'}>发布 / 签名 / 远程目标</strong><div className="mt-0.5 truncate text-[10px] text-slate-500">本地、WSL、容器与 SSH 目标</div></div>
        <button aria-label="刷新发布配置" title="刷新发布配置" onClick={() => void load()} disabled={busy} className={iconButton}><RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} /></button>
      </div>
      {error && <div role="alert" className={`mt-2 rounded-md border px-2.5 py-2 text-[10px] ${isDarkMode ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>{error}</div>}
      {!configuration && !busy && <div role="status" className={`mt-2 flex items-center gap-2 rounded-md px-2.5 py-2 text-[10px] ${isDarkMode ? 'bg-slate-800/45 text-slate-400' : 'bg-slate-50 text-slate-600'}`}><FileJson className="h-3.5 w-3.5 shrink-0 text-slate-500" /><span>{configurationChecked ? <>尚未创建发布配置 <code className="text-sky-400">.lingbuilder/publish.json</code></> : <>刷新以读取发布配置</>}</span></div>}
      {configuration && <div className="mt-2"><div className={`flex items-center justify-between rounded-md px-2.5 py-2 ${isDarkMode ? 'bg-slate-800/45' : 'bg-slate-50'}`}><span className="truncate font-medium">{configuration.name} <span className="text-slate-500">v{configuration.version}</span></span><span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium text-sky-400">{configuration.target.kind}</span></div><div className="mt-2 flex gap-2"><button onClick={() => void publish()} disabled={busy} className="h-7 flex-1 rounded-md bg-sky-600 px-2 text-[10px] font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50">生成发布产物</button><button onClick={() => void verify()} disabled={busy} className={iconButton} title="验证签名" aria-label="验证签名"><ShieldCheck className="h-3.5 w-3.5" /></button></div></div>}
      {busy && <div role="status" className="mt-2 text-[10px] text-sky-400">正在读取发布配置…</div>}
      {result && <div className={`mt-2 flex items-start gap-2 rounded-md px-2.5 py-2 text-[10px] ${isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>已生成 {result.artifacts.length} 个产物，输出到 {result.outputDirectory}</span></div>}
    </section>
  );
}
