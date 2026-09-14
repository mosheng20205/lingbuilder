import { useEffect, useId, useRef, useState } from 'react';
import { AlertTriangle, LoaderCircle } from 'lucide-react';

const OFFICIAL_SITE_URL = 'https://lingbuilder.com';

export interface UpdateDialogInfo {
  status: 'checking' | 'latest' | 'update' | 'error';
  latestVersion?: string;
  releaseTitle?: string;
  error?: string;
  silent?: boolean;
  websiteUrl?: string;
  downloadUrl?: string | null;
  sha256?: string | null;
  fileSize?: string | null;
  releaseNotes?: string | null;
  channel?: string | null;
}

interface UpdateProgressSnapshot {
  state: 'idle' | 'downloading' | 'verifying' | 'ready' | 'launching' | 'error';
  version?: string;
  downloadedBytes: number;
  totalBytes: number | null;
  bytesPerSecond: number | null;
  engine: 'aria2c' | 'fetch' | null;
  message?: string;
  error?: string;
  installerPath?: string;
}

interface UpdateDialogProps {
  open: boolean;
  info: UpdateDialogInfo | null;
  currentVersionLabel: string;
  isDarkMode: boolean;
  /** 稳定版更新专用「跳过此版本」：记录版本号后不再自动弹窗，仅保留标题栏徽标。 */
  onSkipVersion?: (version: string) => void;
  /** 体验反馈入口（预览版更新展示）：由宿主传入，通常指向交流群。 */
  feedbackUrl?: string;
  onClose: () => void;
}

export default function UpdateDialog({ open, info, currentVersionLabel, isDarkMode, onSkipVersion, feedbackUrl, onClose }: UpdateDialogProps) {
  const titleId = useId();
  const [progress, setProgress] = useState<UpdateProgressSnapshot | null>(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const sawActiveDownloadRef = useRef(false);
  const wasDownloadingRef = useRef(false);
  const autoInstallFiredRef = useRef(false);
  const readyBeforeErrorRef = useRef(false);

  useEffect(() => {
    if (!open) {
      sawActiveDownloadRef.current = false;
      autoInstallFiredRef.current = false;
      readyBeforeErrorRef.current = false;
      setNotice('');
      setActionError('');
      return;
    }
    setNotice('');
    setActionError('');
    let disposed = false;
    const updates = window.lingBuilder?.updates;
    void updates?.status?.().then(snapshot => {
      if (!disposed && snapshot) setProgress(snapshot as UpdateProgressSnapshot);
    }).catch(() => undefined);
    const unsubscribe = updates?.onProgress?.(snapshot => setProgress(snapshot as UpdateProgressSnapshot));
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [open]);

  const activeDownload = progress?.state === 'downloading' || progress?.state === 'verifying';
  useEffect(() => {
    if (!open) return;
    if (activeDownload) sawActiveDownloadRef.current = true;
    if (progress?.state === 'downloading') wasDownloadingRef.current = true;
    if (progress?.state === 'ready') readyBeforeErrorRef.current = true;
    if (progress?.state === 'idle' && wasDownloadingRef.current) {
      wasDownloadingRef.current = false;
      setNotice(progress.message || '已取消下载。');
    }
  }, [open, activeDownload, progress?.state, progress?.message]);

  const installUpdate = async (): Promise<void> => {
    const updates = window.lingBuilder?.updates;
    if (!updates?.install) return;
    const result = await updates.install().catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    if (!result.ok && result.error) setActionError(result.error);
  };

  useEffect(() => {
    if (!open || progress?.state !== 'ready' || !sawActiveDownloadRef.current || autoInstallFiredRef.current) return;
    autoInstallFiredRef.current = true;
    void installUpdate();
  }, [open, progress?.state]);

  if (!open || !info) return null;

  const inAppAvailable = Boolean(info.downloadUrl && info.sha256) || progress?.state === 'ready';
  const phase = info.status === 'update' && progress && progress.state !== 'idle' ? progress.state : info.status;
  const surface = isDarkMode ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-500';
  const primaryButton = 'min-h-8 rounded bg-[#4f46e5] px-3 text-xs font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-50';
  const secondaryButton = 'min-h-8 rounded border border-current/20 px-3 text-xs hover:bg-slate-500/10 disabled:cursor-not-allowed disabled:opacity-40';
  const openOfficialSite = () => window.open(info.websiteUrl || OFFICIAL_SITE_URL, '_blank', 'noopener,noreferrer');
  const startDownload = async (): Promise<void> => {
    setNotice('');
    setActionError('');
    const updates = window.lingBuilder?.updates;
    if (!updates?.download) { setActionError('当前环境不支持应用内下载更新。'); return; }
    const result = await updates.download().catch((error: unknown) => ({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    if (!result.ok && result.error) setActionError(result.error);
  };
  const cancelDownload = async (): Promise<void> => {
    await window.lingBuilder?.updates?.cancel?.().catch(() => undefined);
  };
  const versionLabel = info.latestVersion ? `v${info.latestVersion}` : '';
  const percent = progress?.totalBytes ? Math.min(100, Math.round(progress.downloadedBytes / progress.totalBytes * 100)) : null;
  // 预览渠道文案突出「抢先体验」，并明确预览版的稳定性预期；稳定渠道维持原有提示。
  const isPreview = info.channel === 'preview';

  const title = phase === 'checking' ? '正在检查更新…'
    : phase === 'latest' ? '已是最新版本'
    : phase === 'downloading' ? `正在下载更新 ${versionLabel}`
    : phase === 'verifying' ? '正在校验安装包完整性'
    : phase === 'ready' ? `${versionLabel || '更新包'}已通过完整性校验`
    : phase === 'launching' ? '正在启动安装程序'
    : phase === 'error' ? (progress?.error ? '更新失败' : '检查更新失败')
    : phase === 'update' ? (isPreview ? `抢先体验 ${versionLabel}（预览版）` : '发现新版本')
    : '检查更新失败';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className={`w-[26rem] max-w-full rounded-lg border p-5 shadow-2xl ${surface}`}>
        <h2 id={titleId} className="text-sm font-semibold">{title}</h2>

        {phase === 'checking' && <p className="mt-3 text-xs leading-5 text-slate-400">正在连接 LingBuilder 云端查询最新版本。</p>}
        {phase === 'latest' && <p className="mt-3 text-xs leading-5 text-slate-400">当前 {currentVersionLabel} 已是最新版本。</p>}

        {phase === 'update' && (
          <>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {isPreview
                ? `预览版 ${versionLabel || '未知'}（当前 ${currentVersionLabel}）。预览版发布频率高、包含未经长期验证的新功能，建议先备份项目数据。`
                : inAppAvailable
                  ? `最新版本 ${versionLabel || '未知'}（当前 ${currentVersionLabel}）。可直接在 IDE 内下载更新。`
                  : `最新版本 ${versionLabel || '未知'}（当前 ${currentVersionLabel}）。该版本未提供应用内下载渠道，请前往官网手动下载。`}
            </p>
            {inAppAvailable && info.fileSize && <p className={`mt-2 text-[11px] ${muted}`}>安装包大小：{info.fileSize}</p>}
            {info.releaseTitle && <p className={`mt-2 text-[11px] leading-5 ${muted}`}>{info.releaseTitle}</p>}
            {info.releaseNotes && <p className={`mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap text-[11px] leading-5 ${muted}`}>{info.releaseNotes}</p>}
            {notice && <p className={`mt-2 text-[11px] ${muted}`} role="status">{notice}</p>}
            {actionError && <p className="mt-2 text-[11px] leading-5 text-rose-500" role="alert">{actionError}</p>}
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {inAppAvailable && <button type="button" onClick={() => void startDownload()} className={primaryButton}>{isPreview ? '立即体验' : '立即更新'}</button>}
              <button type="button" onClick={openOfficialSite} className={inAppAvailable ? secondaryButton : primaryButton}>前往官网下载</button>
              {!isPreview && onSkipVersion && info.latestVersion && <button type="button" onClick={() => onSkipVersion(info.latestVersion!)} className={secondaryButton}>跳过此版本</button>}
              {isPreview && feedbackUrl && <button type="button" onClick={() => window.open(feedbackUrl, '_blank', 'noopener,noreferrer')} className={secondaryButton}>反馈问题</button>}
              <button type="button" onClick={onClose} className={secondaryButton}>稍后再说</button>
            </div>
          </>
        )}

        {(phase === 'downloading' || phase === 'verifying') && (
          <>
            <div className="mt-3 rounded border border-blue-500/35 bg-blue-500/10 p-3" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">{phase === 'verifying' ? '正在校验安装包完整性…' : progress?.message || '正在下载更新包…'}</span>
                {phase === 'downloading' && percent !== null && <span className="shrink-0 tabular-nums">{percent}%</span>}
              </div>
              {phase === 'downloading' && (
                <div className="mt-2 h-1.5 overflow-hidden rounded bg-black/15" role="progressbar" aria-label={`更新包 ${versionLabel} 下载进度`} aria-valuenow={percent ?? undefined}>
                  <div className={`h-full rounded bg-blue-500 ${percent === null ? 'animate-pulse' : 'transition-[width] duration-200'}`} style={{ width: percent === null ? '100%' : `${percent}%` }} />
                </div>
              )}
              {phase === 'downloading' && (
                <div className={`mt-2 flex flex-wrap justify-between gap-2 text-[10px] ${muted}`}>
                  <span className="tabular-nums">{formatBytes(progress?.downloadedBytes ?? 0)}{progress?.totalBytes ? ` / ${formatBytes(progress.totalBytes)}` : ''}</span>
                  <span className="tabular-nums">{progress?.bytesPerSecond ? `${formatBytes(progress.bytesPerSecond)}/秒` : ''}</span>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={onClose} className={secondaryButton}>后台下载</button>
              <button type="button" disabled={phase === 'verifying'} onClick={() => void cancelDownload()} className={secondaryButton}>取消下载</button>
            </div>
          </>
        )}

        {phase === 'ready' && (
          <>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {sawActiveDownloadRef.current
                ? '校验通过，安装向导即将打开，LingBuilder 会自动退出。'
                : `更新包已下载并通过完整性校验。安装向导将引导你完成更新，LingBuilder 会自动退出。`}
            </p>
            {actionError && <p className="mt-2 text-[11px] leading-5 text-rose-500" role="alert">{actionError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => void installUpdate()} className={primaryButton}>立即安装并重启</button>
              <button type="button" onClick={onClose} className={secondaryButton}>稍后安装</button>
            </div>
          </>
        )}

        {phase === 'launching' && (
          <p className="mt-3 flex items-center gap-2 text-xs leading-5 text-slate-400">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            正在启动安装程序，LingBuilder 即将退出…
          </p>
        )}

        {phase === 'error' && progress?.error && (
          <>
            <div className="mt-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-500" role="alert">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{progress.error}</span>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              {readyBeforeErrorRef.current
                ? <button type="button" onClick={() => void installUpdate()} className={primaryButton}>重试安装</button>
                : inAppAvailable && <button type="button" onClick={() => void startDownload()} className={primaryButton}>重试下载</button>}
              <button type="button" onClick={openOfficialSite} className={secondaryButton}>前往官网下载</button>
              <button type="button" onClick={onClose} className={secondaryButton}>关闭</button>
            </div>
          </>
        )}

        {(phase === 'checking' || phase === 'latest' || (phase === 'error' && !progress?.error)) && (
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className={secondaryButton}>关闭</button>
          </div>
        )}
      </div>
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
