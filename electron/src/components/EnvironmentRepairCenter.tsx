import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Download,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  Wrench,
  X
} from 'lucide-react';

import type {
  EnvironmentRepairSnapshot,
  EnvironmentRepairTarget
} from '../services/tasks/environmentRepairService';

interface EnvironmentCheckItem {
  id: string;
  label: string;
  available: boolean;
  required: boolean;
  version?: string | null;
  path?: string | null;
  detail?: string | null;
}

interface EnvironmentCheckResponse {
  ok: boolean;
  ready: boolean;
  cppCompilerAvailable: boolean;
  msvcBuildReady: boolean;
  checks: EnvironmentCheckItem[];
  warnings: string[];
  error?: string;
}

interface EnvironmentRepairCenterProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onEvent?: (message: string) => void;
}

const IDLE_REPAIR: EnvironmentRepairSnapshot = {
  id: null,
  target: null,
  state: 'idle',
  active: false,
  progress: null,
  message: '当前没有环境修复任务。',
  startedAt: null,
  finishedAt: null,
  exitCode: null,
  requiresRestart: false
};

export default function EnvironmentRepairCenter({
  open,
  isDarkMode,
  onClose,
  onEvent
}: EnvironmentRepairCenterProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const lastCompletedJobRef = useRef<string | null>(null);
  const [check, setCheck] = useState<EnvironmentCheckResponse | null>(null);
  const [repair, setRepair] = useState<EnvironmentRepairSnapshot>(IDLE_REPAIR);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<EnvironmentRepairTarget | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const loadCheck = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/environment/check');
      const result = await response.json().catch(() => ({})) as EnvironmentCheckResponse;
      if (!response.ok || result.ok === false) throw new Error(result.error || '读取开发环境状态失败。');
      setCheck(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '读取开发环境状态失败。');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRepair = useCallback(async (): Promise<EnvironmentRepairSnapshot> => {
    const response = await fetch('/api/environment/repair/status');
    const result = await response.json().catch(() => ({})) as { ok?: boolean; repair?: EnvironmentRepairSnapshot; error?: string };
    if (!response.ok || !result.ok || !result.repair) throw new Error(result.error || '读取环境修复进度失败。');
    setRepair(result.repair);
    return result.repair;
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    void Promise.all([loadCheck(), loadRepair()]).catch(reason => {
      setError(reason instanceof Error ? reason.message : '环境修复中心加载失败。');
    });
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [loadCheck, loadRepair, open]);

  useEffect(() => {
    if (!open || !repair.active) return;
    const timer = window.setInterval(() => {
      void loadRepair().catch(reason => {
        setError(reason instanceof Error ? reason.message : '读取环境修复进度失败。');
      });
    }, 1_000);
    return () => window.clearInterval(timer);
  }, [loadRepair, open, repair.active]);

  useEffect(() => {
    if (!open || repair.active || !repair.id || repair.id === lastCompletedJobRef.current) return;
    if (repair.state !== 'succeeded' && repair.state !== 'failed') return;
    lastCompletedJobRef.current = repair.id;
    onEvent?.(repair.message);
    if (repair.state === 'succeeded') void loadCheck();
  }, [loadCheck, onEvent, open, repair]);

  const checksById = useMemo(() => new Map((check?.checks || []).map(item => [item.id, item])), [check]);
  const msvc = checksById.get('msvc');
  const windowsSdk = checksById.get('windowsSdk');
  const cmake = checksById.get('cmake');
  const webView2 = checksById.get('webView2');
  const gpp = checksById.get('gpp');
  const clangpp = checksById.get('clangpp');
  const nativeBuildReady = check?.msvcBuildReady
    ?? Boolean(msvc?.available && windowsSdk?.available);
  const alternativeCompilerAvailable = Boolean(gpp?.available || clangpp?.available);

  if (!open) return null;

  const startRepair = async (target: EnvironmentRepairTarget) => {
    setError('');
    setConfirmTarget(null);
    try {
      const response = await fetch('/api/environment/repair/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ target })
      });
      const result = await response.json().catch(() => ({})) as { ok?: boolean; repair?: EnvironmentRepairSnapshot; error?: string };
      if (!response.ok || !result.ok || !result.repair) throw new Error(result.error || '启动环境修复失败。');
      setRepair(result.repair);
      onEvent?.(target === 'cppBuildTools'
        ? '已启动微软 C++ 构建环境安装。'
        : '已启动 WebView2 Runtime 安装。');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '启动环境修复失败。');
    }
  };

  const surface = isDarkMode
    ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200'
    : 'border-slate-200 bg-white text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const card = isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50';

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <section className={`flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border shadow-2xl ${surface}`}>
        <header className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-500" aria-hidden="true" />
              <h2 id={titleId} className="text-sm font-semibold">环境修复中心</h2>
            </div>
            <p className={`mt-1 text-[11px] leading-5 ${muted}`}>
              检测、安装并复检 LingBuilder 所需环境。安装程序只从微软官方 HTTPS 地址获取。
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded hover:bg-slate-500/15 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="关闭环境修复中心"
            title={repair.active ? '关闭窗口（安装任务将在后台继续）' : '关闭'}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {error && (
            <div role="alert" className="mb-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {repair.state !== 'idle' && (
            <div className={`mb-3 rounded border p-3 ${repair.state === 'failed' ? 'border-rose-500/40 bg-rose-500/10' : 'border-blue-500/40 bg-blue-500/10'}`} aria-live="polite">
              <div className="flex items-center gap-2 text-xs font-medium">
                {repair.active
                  ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  : repair.state === 'succeeded'
                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                    : <AlertTriangle className="h-4 w-4 text-rose-500" aria-hidden="true" />}
                <span>{repair.message}</span>
              </div>
              {repair.state === 'downloading' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/15" role="progressbar" aria-label="安装程序下载进度" aria-valuenow={repair.progress ?? undefined}>
                  <div className="h-full rounded bg-blue-500 transition-[width] duration-200" style={{ width: `${repair.progress ?? 15}%` }} />
                </div>
              )}
              {repair.requiresRestart && <p className="mt-2 text-[11px] text-amber-500">安装程序要求重启 Windows 后生效。</p>}
            </div>
          )}

          {!nativeBuildReady && alternativeCompilerAvailable && (
            <div className="mb-3 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-600" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>已检测到 g++ 或 clang++，但它们不能替代 LingBuilder 默认 Win32 构建所需的 MSVC 与 Windows SDK。</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <CapabilityCard
              title="LingBuilder 原生 MSVC 构建环境"
              description="MSVC 与 Windows SDK 为默认 Win32 构建必需项；CMake 用于部分高级项目。"
              ready={nativeBuildReady}
              isDarkMode={isDarkMode}
              cardClass={card}
              items={[msvc, windowsSdk, cmake]}
              actionLabel={nativeBuildReady ? '原生构建已就绪' : '一键安装核心构建环境'}
              disabled={repair.active || loading || nativeBuildReady}
              onAction={() => setConfirmTarget('cppBuildTools')}
            />
            <CapabilityCard
              title="WebView2 Runtime"
              description="用于 EdgeView 模块生成的原生浏览器界面。"
              ready={Boolean(webView2?.available)}
              isDarkMode={isDarkMode}
              cardClass={card}
              items={[webView2]}
              actionLabel={webView2?.available ? '已就绪' : '安装 WebView2 Runtime'}
              disabled={repair.active || loading || Boolean(webView2?.available)}
              onAction={() => setConfirmTarget('webView2')}
            />
          </div>

          <div className={`mt-3 rounded border ${card}`}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded={advancedOpen}
              onClick={() => setAdvancedOpen(value => !value)}
            >
              <span>
                <span className="font-medium">高级替代工具链</span>
                <span className={`ml-2 ${muted}`}>g++ 与 clang++ 均为可选项，不影响默认 MSVC 构建。</span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {advancedOpen && (
              <div className={`grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
                <StatusRow item={gpp} />
                <StatusRow item={clangpp} />
              </div>
            )}
          </div>

          {confirmTarget && (
            <div className="mt-3 rounded border border-amber-500/45 bg-amber-500/10 p-3" role="alertdialog" aria-label="确认安装环境依赖">
              <div className="flex items-start gap-2">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
                <div className="min-w-0 text-xs leading-5">
                  <p className="font-semibold">确认启动微软官方安装程序？</p>
                  <p className={muted}>
                    {confirmTarget === 'cppBuildTools'
                      ? '将安装 Visual Studio C++ Build Tools 工作负载及推荐组件，下载量较大，并可能请求管理员权限。'
                      : '将下载 Evergreen Bootstrapper，并安装与当前电脑架构匹配的 WebView2 Runtime。'}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setConfirmTarget(null)} className="min-h-9 rounded border border-current/20 px-3 text-xs hover:bg-slate-500/10">取消</button>
                <button type="button" onClick={() => void startRepair(confirmTarget)} className="min-h-9 rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400">确认安装</button>
              </div>
            </div>
          )}
        </div>

        <footer className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <span className={`text-[11px] ${muted}`}>{repair.active ? '关闭窗口不会中断微软安装程序。' : '安装完成后会自动重新检测环境。'}</span>
          <div className="flex gap-2">
            <button type="button" disabled={loading || repair.active} onClick={() => void loadCheck()} className="inline-flex min-h-9 items-center gap-1.5 rounded border border-current/20 px-3 text-xs hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-50">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              重新检测
            </button>
            <button type="button" onClick={onClose} className="min-h-9 rounded bg-blue-600 px-4 text-xs font-medium text-white hover:bg-blue-500">关闭</button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function CapabilityCard({
  title,
  description,
  ready,
  items,
  actionLabel,
  disabled,
  onAction,
  cardClass
}: {
  title: string;
  description: string;
  ready: boolean;
  isDarkMode: boolean;
  items: Array<EnvironmentCheckItem | undefined>;
  actionLabel: string;
  disabled: boolean;
  onAction: () => void;
  cardClass: string;
}) {
  return (
    <section className={`flex min-h-52 flex-col rounded border p-3 ${cardClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-semibold">{title}</h3>
          <p className="mt-1 text-[11px] leading-5 opacity-65">{description}</p>
        </div>
        {ready
          ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-label="已就绪" />
          : <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-label="需要处理" />}
      </div>
      <div className="mt-3 flex-1 space-y-2">
        {items.filter(Boolean).map(item => <StatusRow key={item!.id} item={item} />)}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={onAction}
        className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:bg-slate-500/30 disabled:text-current disabled:opacity-60"
      >
        <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
        {actionLabel}
      </button>
    </section>
  );
}

function StatusRow({ item }: { item: EnvironmentCheckItem | undefined }) {
  if (!item) return <div className="text-[11px] opacity-60">正在读取状态…</div>;
  return (
    <div className="flex min-w-0 items-start gap-2 text-[11px]">
      <span className={`mt-0.5 shrink-0 font-bold ${item.available ? 'text-emerald-500' : 'text-slate-500'}`} aria-hidden="true">{item.available ? '✓' : '○'}</span>
      <div className="min-w-0">
        <div className="font-medium">{item.label} · {item.required ? '必需' : '可选'}{item.version ? ` · ${item.version}` : ''}</div>
        <div className="truncate opacity-60" title={item.path || item.detail || undefined}>{item.path || item.detail || '未检测到'}</div>
      </div>
    </div>
  );
}
