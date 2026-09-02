import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, LoaderCircle, PackageOpen, X } from 'lucide-react';

import {
  sdkDependencyPromptCoordinator,
  type SdkDependencyPromptSnapshot
} from '../services/sdkDependencies/sdkDependencyClient';

const CLOSED: SdkDependencyPromptSnapshot = {
  open: false,
  dependencies: [],
  job: null,
  installing: false,
  error: '',
  catalogSource: 'builtin',
  catalogSequence: null
};

export default function SdkDependencyInstallerDialog({ isDarkMode }: { isDarkMode: boolean }) {
  const titleId = useId();
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const [snapshot, setSnapshot] = useState<SdkDependencyPromptSnapshot>(CLOSED);

  useEffect(() => sdkDependencyPromptCoordinator.subscribe(setSnapshot), []);
  useEffect(() => {
    if (!snapshot.open) return;
    const frame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [snapshot.open]);

  if (!snapshot.open) return null;

  const current = snapshot.dependencies.find(item => item.id === snapshot.job?.dependencyId);
  const totalBytes = snapshot.dependencies.reduce((sum, item) => sum + item.archiveBytes, 0);
  const surface = isDarkMode
    ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';
  const card = isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/60 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <section className={`w-full max-w-xl overflow-hidden rounded-lg border shadow-2xl ${surface}`}>
        <header className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <PackageOpen className="h-4 w-4 text-blue-500" aria-hidden="true" />
              <h2 id={titleId} className="text-sm font-semibold">安装项目所需 SDK</h2>
            </div>
            <p className={`mt-1 text-[11px] leading-5 ${muted}`}>当前操作需要额外环境。SDK 只下载一次，并由所有 LingBuilder 工作区共享。</p>
          </div>
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={snapshot.installing && snapshot.job?.state === 'installing'}
            onClick={() => void sdkDependencyPromptCoordinator.cancel()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-slate-500/15 disabled:opacity-40"
            aria-label={snapshot.installing ? '取消 SDK 下载' : '关闭'}
            title={snapshot.installing ? '取消 SDK 下载' : '关闭'}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-3 p-4">
          <div className={`flex flex-wrap items-center justify-between gap-2 rounded border px-3 py-2 text-[11px] ${card}`}>
            <span className={muted}>清单来源：{snapshot.catalogSource === 'remote' ? '云端清单（已验签）' : 'IDE 内置清单'}</span>
            <span className={`tabular-nums ${muted}`}>sequence：{snapshot.catalogSequence ?? '—'}</span>
          </div>
          <div className="space-y-2">
            {snapshot.dependencies.map(dependency => {
              const active = dependency.id === snapshot.job?.dependencyId;
              const succeeded = snapshot.installing && snapshot.job?.state === 'succeeded' && active;
              return (
                <div key={dependency.id} className={`flex min-h-16 items-center gap-3 rounded border p-3 ${card}`}>
                  {active && snapshot.job?.active
                    ? <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-blue-500" aria-hidden="true" />
                    : succeeded
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
                      : <Download className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                      <span className="font-medium">{dependency.name}</span>
                      <span className={muted}>{formatBytes(dependency.archiveBytes)}</span>
                    </div>
                    <div className={`mt-1 truncate text-[11px] ${muted}`} title={dependency.version}>版本 {dependency.version} · Windows x64</div>
                  </div>
                </div>
              );
            })}
          </div>

          {snapshot.installing && snapshot.job && (
            <div className="rounded border border-blue-500/35 bg-blue-500/10 p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{snapshot.job.message}</span>
                <span className="shrink-0 tabular-nums">进度 {snapshot.job.progress ?? 0}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/15" role="progressbar" aria-label={`${current?.name || 'SDK'} 下载进度`} aria-valuenow={snapshot.job.progress ?? undefined}>
                <div className="h-full rounded bg-blue-500 transition-[width] duration-200" style={{ width: `${snapshot.job.progress ?? 0}%` }} />
              </div>
              <div className={`mt-2 flex flex-wrap justify-between gap-2 text-[10px] ${muted}`}>
                <span>已下载 {formatBytes(snapshot.job.downloadedBytes)} / {formatBytes(snapshot.job.totalBytes)}</span>
                <span>{snapshot.job.bytesPerSecond !== null ? `速度 ${formatBytes(snapshot.job.bytesPerSecond)}/秒` : formatJobState(snapshot.job.state)}</span>
              </div>
            </div>
          )}

          {snapshot.error && (
            <div className="flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{snapshot.error}</span>
            </div>
          )}

          {!snapshot.installing && !snapshot.error && (
            <p className={`text-[11px] leading-5 ${muted}`}>将下载 {snapshot.dependencies.length} 项资源，共 {formatBytes(totalBytes)}。下载完成后会校验 SHA-256、安全解压，并自动继续刚才的操作。</p>
          )}
        </div>

        <footer className={`flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <button
            type="button"
            disabled={snapshot.installing && snapshot.job?.state === 'installing'}
            onClick={() => void sdkDependencyPromptCoordinator.cancel()}
            className="min-h-9 rounded border border-current/20 px-3 text-xs hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {snapshot.installing ? '取消下载' : '暂不安装'}
          </button>
          <button
            type="button"
            disabled={snapshot.installing}
            onClick={() => void sdkDependencyPromptCoordinator.install()}
            className="inline-flex min-h-9 items-center gap-1.5 rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {snapshot.installing ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
            {snapshot.error ? '重试安装' : snapshot.installing ? '正在安装' : '下载并安装'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0 B';
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GiB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(2)} MiB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${value} B`;
}

function formatJobState(state: SdkDependencyPromptSnapshot['job'] extends infer T
  ? T extends { state: infer S } ? S : never
  : never): string {
  const labels: Record<string, string> = {
    checking: '正在检查',
    downloading: '正在下载',
    verifying: '正在校验',
    extracting: '正在解压',
    installing: '正在安装',
    succeeded: '安装完成',
    failed: '安装失败',
    cancelled: '已取消',
    idle: '等待开始'
  };
  return labels[String(state)] || String(state);
}
