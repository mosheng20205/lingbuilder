import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import {
  Activity,
  AlertTriangle,
  Cable,
  Check,
  CheckCircle2,
  Clipboard,
  KeyRound,
  Link2,
  LoaderCircle,
  MonitorSmartphone,
  Play,
  Radio,
  RefreshCw,
  ScrollText,
  Settings2,
  Square,
  Users,
  X,
  XCircle
} from 'lucide-react';

type CenterTab = 'connect' | 'activity';
type BridgePermission = 'readonly' | 'preview' | 'yolo';
type BridgeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
type ProbePhase = 'loading' | 'ready' | 'error';
interface ProbeState { phase: ProbePhase; message?: string; }

/** 本机授权代理状态（主进程 LocalAuthorizationService.snapshot 的渲染端镜像）。 */
interface LocalAuthSnapshot {
  enabled: boolean;
  running: boolean;
  port: number;
  discoveryPath: string;
  exchanges: number;
  lastError: string;
}

/** 灵码 Skill 正文取物状态（主进程 SkillKitService 的渲染端镜像）。 */
interface SkillKitStatus {
  ok: boolean;
  source: 'remote' | 'cache' | 'bundled';
  id: string;
  version: string;
  sequence: number;
  minIdeVersion: string;
  entrypointPath: string;
  installPrompt: string;
  fileCount: number;
  checkedAt: string;
  problem: string;
}

const SKILL_KIT_SOURCE_LABELS: Record<SkillKitStatus['source'], string> = {
  remote: '官网最新版', cache: '本机已缓存', bundled: '安装包内置'
};

interface BridgeSnapshot {
  state: BridgeState;
  workspaceRoot: string;
  permission: BridgePermission;
  port: number;
  httpUrl: string;
  mcpUrl: string;
  startedAt: string | null;
  pid: number | null;
  tokenMasked: string;
  tokenAvailable: boolean;
  activeClients: number;
  clients: Array<{ id: string; connectedAt: string; lastActiveAt: string; userAgent: string }>;
  recentActivity: Array<{ id: string; timestamp: string; clientId: string; kind: 'connected' | 'disconnected' | 'tool'; tool?: string; ok: boolean; durationMs?: number; message: string }>;
  logs: string[];
  error: string;
  /** 仅启动返回：启动成功但设置未能持久化时的中文原因。 */
  settingsError?: string;
}

interface CliGuideDialogProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
}

const EMPTY_BRIDGE: BridgeSnapshot = {
  state: 'stopped', workspaceRoot: '', permission: 'preview', port: 17860,
  httpUrl: '', mcpUrl: '', startedAt: null, pid: null, tokenMasked: '', tokenAvailable: false,
  activeClients: 0, clients: [], recentActivity: [], logs: [], error: ''
};

const PERMISSION_LABELS: Record<BridgePermission, string> = {
  readonly: '只读',
  preview: '预览确认',
  yolo: '全自动'
};

export default function CliGuideDialog({ open, isDarkMode, onClose }: CliGuideDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<CenterTab>('connect');
  const [bridge, setBridge] = useState<BridgeSnapshot>(EMPTY_BRIDGE);
  const [statusProbe, setStatusProbe] = useState<ProbeState>({ phase: 'loading' });
  const [port, setPort] = useState(17860);
  const [permission, setPermission] = useState<BridgePermission>('preview');
  const [customToken, setCustomToken] = useState('');
  const [approvedYolo, setApprovedYolo] = useState(false);
  const [externalModuleAccess, setExternalModuleAccess] = useState(false);
  const [localAuth, setLocalAuth] = useState<LocalAuthSnapshot | null>(null);
  const [skillKit, setSkillKit] = useState<SkillKitStatus | null>(null);
  const [skillKitBusy, setSkillKitBusy] = useState(false);
  const [tokenIsCustom, setTokenIsCustom] = useState(false);
  const [savedToken, setSavedToken] = useState('');
  const [runtimeToken, setRuntimeToken] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ text: string; duration: number } | null>(null);
  const [configCopied, setConfigCopied] = useState(false);
  const [logsCopied, setLogsCopied] = useState(false);
  const [installPromptCopied, setInstallPromptCopied] = useState(false);
  const [settingsSaveState, setSettingsSaveState] = useState<'idle' | 'pending' | 'saved'>('idle');
  const logsRef = useRef<HTMLPreElement>(null);
  const bridgeRef = useRef<BridgeSnapshot>(EMPTY_BRIDGE);
  const settingsReadyRef = useRef(false);
  const lastSavedSettingsRef = useRef<{ port: number; permission: BridgePermission; token: string; externalModuleAccess: boolean; yoloConfirmed: boolean } | null>(null);

  const desktopApi = window.lingBuilder?.aiBridge;
  const skillKitApi = window.lingBuilder?.skillKit;
  const running = bridge.state === 'running';
  const transitioning = bridge.state === 'starting' || bridge.state === 'stopping';

  const refreshStatus = useCallback(async () => {
    if (!desktopApi) throw new Error('AI Bridge 连接中心仅在 LingBuilder 桌面版中可用。');
    const result = await desktopApi.status() as BridgeSnapshot;
    setBridge(result);
    bridgeRef.current = result;
    if (result.state !== 'stopped' && result.state !== 'error') {
      setPort(result.port); setPermission(result.permission);
    }
    return result;
  }, [desktopApi]);

  const loadBridgeStatus = useCallback(async () => {
    if (!desktopApi) return;
    setStatusProbe({ phase: 'loading' });
    try {
      await withProbeTimeout(refreshStatus(), '获取 Bridge 状态');
      setStatusProbe({ phase: 'ready' });
    }
    catch (reason) {
      setStatusProbe({ phase: 'error', message: errorMessage(reason) });
    }
  }, [desktopApi, refreshStatus]);

  const loadSkillKit = useCallback(async (checkUpdate: boolean) => {
    if (!skillKitApi) { setSkillKit(null); return; }
    setSkillKitBusy(true);
    try {
      const value = checkUpdate ? await skillKitApi.checkUpdate() : await skillKitApi.status();
      setSkillKit(value as SkillKitStatus | null);
      if (value?.ok) {
        setNotice(checkUpdate ? { text: `灵码 Skill 正文已更新到 ${value.version}（${SKILL_KIT_SOURCE_LABELS[value.source]}）。`, duration: 2_600 } : null);
      } else if (value?.problem) {
        setError(`灵码 Skill 正文：${value.problem}`);
      }
    } catch (reason) {
      setError(`灵码 Skill 正文检查失败：${errorMessage(reason)}`);
    } finally { setSkillKitBusy(false); }
  }, [skillKitApi]);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    setError('');
    settingsReadyRef.current = false;
    const unsubscribe = desktopApi?.onStatusChanged(snapshot => {
      setBridge(snapshot as BridgeSnapshot);
      bridgeRef.current = snapshot as BridgeSnapshot;
      setStatusProbe(current => current.phase === 'loading' ? { phase: 'ready' } : current);
    });
    if (desktopApi) {
      void loadBridgeStatus(); void loadSkillKit(false);
      void desktopApi.loadStartSettings?.().then(result => {
        settingsReadyRef.current = true;
        setLocalAuth(result?.localAuthorization ?? null);
        const saved = result?.settings;
        if (!saved) return;
        setExternalModuleAccess(saved.externalModuleAccess === true);
        setSavedToken(saved.token || '');
        setApprovedYolo(saved.yoloConfirmed === true);
        // 运行中的 Bridge 以快照为准；仅停止态回填上次保存的端口/权限/Token。
        if (bridgeRef.current.state === 'running') return;
        setPort(saved.port);
        setPermission(saved.permission);
        setCustomToken(saved.token || '');
        lastSavedSettingsRef.current = {
          port: saved.port, permission: saved.permission, token: saved.token || '',
          externalModuleAccess: saved.externalModuleAccess === true, yoloConfirmed: saved.yoloConfirmed === true
        };
      }).catch(() => { settingsReadyRef.current = true; });
    }
    return () => {
      cancelAnimationFrame(frame); unsubscribe?.();
      previousFocusRef.current?.focus(); previousFocusRef.current = null;
    };
  }, [desktopApi, loadBridgeStatus, loadSkillKit, open]);

  // 停止态编辑即防抖持久化；无效端口/Token 不落盘，由字段内联提示引导修正。
  // 保存状态直接以 Token 字段旁的内联徽标呈现（pending=保存中/saved=已保存），不再依赖底部一闪而过的提示。
  useEffect(() => {
    if (!open || !desktopApi?.saveStartSettings) return undefined;
    if (running || transitioning || !settingsReadyRef.current) return undefined;
    const token = customToken.trim();
    if (!isPortValid(port) || (token && !isTokenValid(token))) { setSettingsSaveState('idle'); return undefined; }
    const pending = { port, permission, token, externalModuleAccess, yoloConfirmed: approvedYolo };
    const saved = lastSavedSettingsRef.current;
    const matches = !!saved && saved.port === pending.port && saved.permission === pending.permission
      && saved.token === pending.token && saved.externalModuleAccess === pending.externalModuleAccess
      && saved.yoloConfirmed === pending.yoloConfirmed;
    setSettingsSaveState(matches ? 'saved' : 'pending');
    if (matches) return undefined;
    const timer = window.setTimeout(() => {
      void desktopApi.saveStartSettings!({ ...pending, lifecycle: 'workspace' }).then(result => {
        setLocalAuth(result.localAuthorization ?? null);
        if (result.ok) {
          lastSavedSettingsRef.current = pending;
          setSettingsSaveState('saved');
        } else {
          setSettingsSaveState('idle');
          setError(`启动设置保存失败：${result.error || '未知原因'}`);
        }
      }).catch(() => { setSettingsSaveState('idle'); });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [approvedYolo, customToken, desktopApi, externalModuleAccess, open, permission, port, running, transitioning]);

  useEffect(() => {
    if (!open || !running) return undefined;
    const timer = window.setInterval(() => { void refreshStatus().catch(() => undefined); }, 2_000);
    return () => window.clearInterval(timer);
  }, [open, refreshStatus, running]);

  // 运行中的 Bridge 用真实 Token 生成通用配置；停止时回落到持久化 Token。
  useEffect(() => {
    if (!open || !desktopApi || bridge.state !== 'running') { setRuntimeToken(''); return undefined; }
    let cancelled = false;
    void desktopApi.revealToken().then(token => { if (!cancelled) setRuntimeToken(token); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [bridge.state, desktopApi, open]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), notice.duration);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    const element = logsRef.current;
    if (!element) return;
    // 用户向上翻阅时不打断；仅接近底部才跟随新日志滚动。
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 48) element.scrollTop = element.scrollHeight;
  }, [bridge.logs]);

  const connectionToken = runtimeToken || savedToken;
  const mcpConfig = useMemo(() => JSON.stringify({
    mcpServers: {
      lingbuilder: {
        type: 'http',
        url: bridge.mcpUrl || `http://127.0.0.1:${port}/api/ai-bridge/mcp`,
        headers: { Authorization: `Bearer ${connectionToken || '${LINGBUILDER_AI_BRIDGE_TOKEN}'}` }
      }
    }
  }, null, 2), [bridge.mcpUrl, connectionToken, port]);

  if (!open) return null;

  const runAction = async <T,>(name: string, action: () => Promise<T>): Promise<T | undefined> => {
    setBusyAction(name); setError('');
    try { return await action(); }
    catch (reason) { setError(errorMessage(reason)); return undefined; }
    finally { setBusyAction(''); }
  };

  const showNotice = (text: string, duration = 3_000) => setNotice({ text, duration });

  const handleTabKeyDown = (event: React.KeyboardEvent, id: CenterTab) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const ids: CenterTab[] = ['connect', 'activity'];
    const index = ids.indexOf(id);
    const next = event.key === 'ArrowRight' ? (index + 1) % ids.length : (index - 1 + ids.length) % ids.length;
    setActiveTab(ids[next]);
    window.requestAnimationFrame(() => document.getElementById(`${titleId}-tab-${ids[next]}`)?.focus());
  };

  const startBridge = async (): Promise<BridgeSnapshot | undefined> => await runAction('start', async () => {
    if (!desktopApi) throw new Error('当前环境无法启动 AI Bridge。');
    if (permission === 'yolo' && !approvedYolo) throw new Error('请先勾选 yolo 确认框后再启动。');
    const token = customToken.trim();
    const result = await desktopApi.start({ port, permission, lifecycle: 'workspace', token: token || undefined, approvedYolo }) as BridgeSnapshot;
    setBridge(result); setTokenIsCustom(Boolean(token));
    if (result.settingsError) setError(`AI Bridge 已启动，但设置未能保存到本机加密存储：${result.settingsError}`);
    showNotice('AI Bridge 已启动，可以连接外部 AI。');
    return result;
  });

  const restartBridge = async () => { await runAction('restart', async () => {
    if (!desktopApi) throw new Error('当前环境无法重启 AI Bridge。');
    if (bridge.activeClients > 0 && !await requestWorkbenchConfirm({
      title: '重启 AI Bridge',
      description: `当前有 ${bridge.activeClients} 个客户端正在使用 Bridge，重启会断开全部连接并需要重新连接。确定重启吗？`,
      confirmLabel: '重启 Bridge',
      cancelLabel: '取消'
    })) return;
    setBridge(await desktopApi.stop() as BridgeSnapshot);
    const started = await startBridge();
    if (started) showNotice('AI Bridge 已按当前设置重启。');
  }); };

  const stopBridge = async () => { await runAction('stop', async () => {
    if (!desktopApi) throw new Error('当前环境无法停止 AI Bridge。');
    if (bridge.activeClients > 0 && !await requestWorkbenchConfirm({
      title: '停止 AI Bridge',
      description: `当前有 ${bridge.activeClients} 个客户端正在使用 Bridge，停止后会断开全部连接并中断进行中的 AI 操作。确定停止吗？`,
      confirmLabel: '停止 Bridge',
      cancelLabel: '取消'
    })) return;
    const result = await desktopApi.stop() as BridgeSnapshot; setBridge(result); setTokenIsCustom(false); showNotice('AI Bridge 已停止，所有客户端连接已断开。', 6_000);
  }); };

  const copyText = async (value: string): Promise<void> => {
    try { await navigator.clipboard.writeText(value); }
    catch { setError('复制失败，请选中文本后手动复制。'); }
  };

  const copyConfig = async () => {
    await copyText(mcpConfig);
    setConfigCopied(true);
    window.setTimeout(() => setConfigCopied(false), 1500);
  };

  const copyLogs = async () => {
    if (!bridge.logs.length) return;
    await copyText(bridge.logs.join('\n'));
    setLogsCopied(true);
    window.setTimeout(() => setLogsCopied(false), 1500);
  };

  const copyInstallPrompt = async () => {
    if (!skillKit?.installPrompt) return;
    await copyText(skillKit.installPrompt);
    setInstallPromptCopied(true);
    window.setTimeout(() => setInstallPromptCopied(false), 1500);
  };

  const rotateToken = async () => { await runAction('rotate', async () => {
    if (!desktopApi) throw new Error('当前环境无法重新生成 Token。');
    if (!await requestWorkbenchConfirm({ title: '重新生成 Token', description: '重新生成后旧 Token 立即失效，已连接的客户端会全部断开并需要重新连接。确定继续吗？', confirmLabel: '重新生成', cancelLabel: '取消' })) return;
    const result = await desktopApi.rotateToken() as BridgeSnapshot;
    setBridge(result);
    setTokenIsCustom(false);
    try { setRuntimeToken(await desktopApi.revealToken()); } catch { setRuntimeToken(''); }
    showNotice('Token 已重新生成，旧客户端连接已失效。下次启动将自动生成并保存新的持久 Token。', 6_000);
  }); };

  const copyToken = async () => { await runAction('token', async () => {
    if (!desktopApi) throw new Error('当前环境无法读取 Token。');
    await navigator.clipboard.writeText(await desktopApi.revealToken());
    showNotice('Token 已复制，请只交给可信的本机客户端。', 6_000);
  }); };

  const openManual = async () => {
    const result = await window.lingBuilder?.docs?.openCliManual?.();
    if (result) setError(`打开 CLI 手册失败：${result}`);
  };

  const surface = isDarkMode ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200' : 'border-slate-300 bg-white text-slate-900';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const card = isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50';
  const field = isDarkMode ? 'border-[#454550] bg-[#18181e] text-slate-100' : 'border-slate-300 bg-white text-slate-900';
  const code = isDarkMode ? 'border-[#35353d] bg-[#111116] text-cyan-200' : 'border-slate-300 bg-slate-950 text-cyan-100';

  if (!desktopApi) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-2 sm:p-5">
        <section
          ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
          className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[92vh] ${surface}`}
          onKeyDown={event => { if (event.key === 'Escape') onClose(); if (event.key === 'Tab') trapFocus(event, dialogRef.current); }}
        >
          <header className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Cable className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden="true" />
                <h2 id={titleId} className="text-sm font-semibold">AI Bridge 连接中心</h2>
                <span className={`rounded bg-slate-500/15 px-2 py-0.5 text-[10px] font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>需要桌面版</span>
              </div>
              <p className={`mt-1 text-[11px] leading-5 ${muted}`}>复制一段通用 MCP 配置到任意 AI 客户端即可使用当前工作区。</p>
            </div>
            <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-slate-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="关闭 AI Bridge 连接中心"><X className="h-4 w-4" /></button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto p-4">
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <MonitorSmartphone className="h-10 w-10 text-cyan-500" aria-hidden="true" />
              <h3 className="text-sm font-semibold">AI Bridge 连接中心仅在 LingBuilder 桌面版中可用</h3>
              <p className={`max-w-md text-[11px] leading-6 ${muted}`}>当前是 Web 预览环境，无法启动 Bridge 或生成本机连接配置。请在 LingBuilder 桌面版的「帮助 → AI Bridge 连接中心」中打开本功能。</p>
            </div>
          </main>
          <footer className={`flex flex-wrap items-center justify-end gap-3 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353d] bg-[#19191f]' : 'border-slate-200 bg-slate-50'}`}>
            <button type="button" onClick={() => void openManual()} className="flex min-h-11 items-center gap-2 rounded px-3 text-[11px] hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><ScrollText className="h-4 w-4" />完整手册</button>
            <button type="button" onClick={onClose} className="min-h-11 rounded border border-current/20 px-4 text-[11px] font-medium hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500">关闭</button>
          </footer>
        </section>
      </div>
    );
  }

  const portInvalid = !isPortValid(port);
  const trimmedToken = customToken.trim();
  const tokenInvalid = trimmedToken !== '' && !isTokenValid(trimmedToken);
  const bridgeTitle = statusProbe.phase === 'loading' ? '正在获取 Bridge 状态…'
    : statusProbe.phase === 'error' ? '无法获取 Bridge 状态'
    : running ? 'Bridge 正在运行'
    : transitioning ? 'Bridge 正在切换状态'
    : 'AI Bridge 未在运行';
  const bridgeDescription = statusProbe.phase === 'loading' ? '正在与 LingBuilder 桌面服务通信…'
    : statusProbe.phase === 'error' ? (statusProbe.message || '获取 Bridge 状态失败，请重试。')
    : running ? bridge.workspaceRoot
    : `正常情况下 Bridge 会随 LingBuilder 启动自动运行；当前配置：${PERMISSION_LABELS[permission]}（${permission}）权限 · 端口 ${port}。`;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-2 sm:p-5">
      <section
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[92vh] ${surface}`}
        onKeyDown={event => { if (event.key === 'Escape' && !busyAction) onClose(); if (event.key === 'Tab') trapFocus(event, dialogRef.current); }}
      >
        <header className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Cable className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden="true" />
              <h2 id={titleId} className="text-sm font-semibold">AI Bridge 连接中心</h2>
              <BridgeStateBadge state={bridge.state} isDarkMode={isDarkMode} />
            </div>
            <p className={`mt-1 text-[11px] leading-5 ${muted}`}>把下方连接配置粘贴到任意 AI 客户端即可使用当前工作区；Bridge 随 LingBuilder 自动启动，配置一次长期有效。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-slate-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="关闭 AI Bridge 连接中心"><X className="h-4 w-4" /></button>
        </header>

        <nav className={`flex shrink-0 overflow-x-auto border-b px-2 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`} aria-label="AI Bridge 功能分类" role="tablist">
          {([['connect', '连接'], ['activity', '客户端与活动']] as Array<[CenterTab, string]>).map(([id, label]) => (
            <button key={id} type="button" role="tab" id={`${titleId}-tab-${id}`} aria-controls={`${titleId}-panel`} aria-selected={activeTab === id} onClick={() => setActiveTab(id)} onKeyDown={event => handleTabKeyDown(event, id)} className={`min-h-11 shrink-0 border-b-2 px-4 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 ${activeTab === id ? 'border-cyan-500 text-cyan-500' : `border-transparent ${muted} hover:text-cyan-500`}`}>{label}{id === 'activity' && bridge.activeClients > 0 && <span className="ml-1.5 inline-flex min-w-4 items-center justify-center rounded bg-cyan-500/15 px-1 text-[10px] font-medium tabular-nums text-cyan-500">{bridge.activeClients}</span>}</button>
          ))}
        </nav>

        {(error || bridge.error) && <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] leading-5 text-rose-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error || bridge.error}</span></div>}

        <main id={`${titleId}-panel`} aria-labelledby={`${titleId}-tab-${activeTab}`} className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" role="tabpanel">
          {activeTab === 'connect' && <div className="space-y-4">
            <section className={`rounded-lg border p-4 ${card}`} aria-labelledby="bridge-control-title">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Radio className={`h-5 w-5 ${running ? 'text-emerald-500' : 'text-slate-500'}`} /><h3 id="bridge-control-title" className="text-sm font-semibold">{bridgeTitle}</h3></div>
                  <p className={`mt-1 break-all text-[11px] leading-5 ${muted}`}>{bridgeDescription}</p>
                </div>
                {statusProbe.phase === 'loading' ? <button type="button" disabled className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-cyan-600 px-5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><LoaderCircle className="h-4 w-4 animate-spin" />获取状态中…</button>
                  : statusProbe.phase === 'error' ? <button type="button" onClick={() => void loadBridgeStatus()} disabled={Boolean(busyAction)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-current/20 px-4 text-xs font-semibold hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"><RefreshCw className="h-4 w-4" />重试获取状态</button>
                  : running ? <div className="flex shrink-0 gap-2"><button type="button" onClick={() => void restartBridge()} disabled={Boolean(busyAction) || transitioning} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-current/20 px-4 text-xs font-semibold hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"><RefreshCw className="h-4 w-4" />重启 Bridge</button><button type="button" onClick={() => void stopBridge()} disabled={Boolean(busyAction) || transitioning} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-rose-500/50 px-4 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"><Square className="h-4 w-4" />停止 Bridge</button></div>
                  : <button type="button" onClick={() => void startBridge()} disabled={Boolean(busyAction) || transitioning || portInvalid || tokenInvalid} title={portInvalid ? '请先修正监听端口' : tokenInvalid ? '请先修正自定义 Token（24–256 个不含空白的可见 ASCII 字符）' : undefined} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-cyan-600 px-5 text-xs font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{busyAction === 'start' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}启动 AI Bridge</button>}
              </div>
              {running && <div className="mt-4 grid gap-2 border-t border-current/10 pt-4 sm:grid-cols-2">
                <EndpointRow icon={<Link2 className="h-4 w-4" />} label="MCP 地址" value={bridge.mcpUrl} onCopy={() => copyText(bridge.mcpUrl)} isDarkMode={isDarkMode} />
                <EndpointRow icon={<Cable className="h-4 w-4" />} label="HTTP API" value={bridge.httpUrl} onCopy={() => copyText(bridge.httpUrl)} isDarkMode={isDarkMode} />
                <EndpointRow icon={<KeyRound className="h-4 w-4" />} label={tokenIsCustom ? '自定义 Token' : '本机 Token'} value={bridge.tokenMasked} onCopy={() => void copyToken()} isDarkMode={isDarkMode} />
                <div className="flex min-h-12 items-center gap-3 rounded border border-current/10 px-3"><Users className="h-4 w-4 text-cyan-500" /><div><div className={`text-[10px] ${muted}`}>已连接客户端</div><div className="text-xs font-semibold tabular-nums">{bridge.activeClients}</div></div></div>
              </div>}
            </section>

            <section className={`rounded-lg border p-4 ${card}`} aria-labelledby="universal-config-title">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 id="universal-config-title" className="text-sm font-semibold">连接配置（通用 MCP）</h3>
                  <p className={`mt-1 text-[11px] leading-5 ${muted}`}>复制后粘贴到 AI 客户端的 MCP 服务器设置里即可。配置已内嵌本机 Token，只监听本机 127.0.0.1，换工作区、重启 LingBuilder 都不用改。</p>
                </div>
                <button type="button" onClick={() => void copyConfig()} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-cyan-600 px-5 text-xs font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400">{configCopied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}{configCopied ? '已复制' : '复制连接配置'}</button>
              </div>
              <div className={`mt-3 rounded border ${code}`}><pre className="max-h-64 overflow-auto p-3 text-[10px] leading-5"><code>{mcpConfig}</code></pre></div>
              {!connectionToken && <p className="mt-2 text-[11px] leading-5 text-amber-400">还没有本机 Token：点一次「启动 AI Bridge」即可自动生成并永久保存，之后无需再改配置。</p>}
            </section>

            <details className={`rounded-lg border p-4 ${card}`}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 [&::-webkit-details-marker]:hidden"><Settings2 className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden="true" />高级设置<span className={`ml-auto text-right text-[11px] font-normal ${muted}`}>端口 · 权限 · Token · 灵码 Skill</span></summary>
              <div className="mt-3 space-y-5">
                {!running && statusProbe.phase === 'ready' && <fieldset disabled={transitioning || Boolean(busyAction)} className="space-y-4 disabled:opacity-60">
                  <div><h4 className="text-xs font-semibold">Bridge 启动设置</h4><p className={`mt-1 text-[11px] leading-5 ${muted}`}>停止态修改后自动保存到本机加密存储（safeStorage 加密），下次启动自动生效。</p></div>
                  <label className="block text-[11px] font-medium">监听端口<input type="number" min={1024} max={65535} value={Number.isInteger(port) ? port : ''} onChange={event => setPort(event.target.value === '' ? Number.NaN : Number(event.target.value))} aria-invalid={portInvalid} className={`mt-1 min-h-11 w-full rounded border px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${field} ${portInvalid ? 'border-rose-500/60' : ''}`} /><span className={`mt-1 block text-[10px] font-normal ${portInvalid ? 'text-rose-400' : muted}`}>{portInvalid ? '端口必须是 1024–65535 之间的整数。' : '仅监听 127.0.0.1；端口冲突时会明确报错。'}</span></label>
                  <div><div className="text-[11px] font-medium">权限模式</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['readonly', 'preview', 'yolo'] as BridgePermission[]).map(value => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-[11px] ${permission === value ? 'border-cyan-500 bg-cyan-500/10' : 'border-current/15'}`}><input type="radio" name="bridge-permission" value={value} checked={permission === value} onChange={() => { setPermission(value); if (value !== 'yolo') setApprovedYolo(false); }} className="accent-cyan-500" /><span className="font-semibold">{PERMISSION_LABELS[value]}</span><span className={`font-mono text-[10px] ${muted}`}>{value}</span>{value === 'preview' && <span className="text-cyan-500">推荐</span>}</label>)}</div></div>
                  {permission === 'yolo' && <label className="flex cursor-pointer items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-[11px] leading-5 text-amber-400"><input type="checkbox" checked={approvedYolo} onChange={event => setApprovedYolo(event.target.checked)} className="mt-1 accent-amber-500" /><span>我确认：可信的本机 AI 可以自动写入文件、导出并执行 LingBuilder 受控构建；仍不开放任意 shell。确认会随设置保存，之后 Bridge 随 IDE 自动启动时按 yolo 运行。</span></label>}
                  <label className={`flex items-start gap-2 rounded border p-3 text-[11px] leading-5 ${externalModuleAccess ? 'border-cyan-500/40 bg-cyan-500/10' : 'border-current/15'}`}>
                    <input type="checkbox" checked={externalModuleAccess} disabled={running || transitioning} onChange={event => setExternalModuleAccess(event.target.checked)} className="mt-1 accent-cyan-500" />
                    <span>
                      <span className="font-semibold">允许外部 AI 客户端使用本机授权</span>
                      <span className={`mt-1 block ${muted}`}>开启后，外部 AI 客户端拉起的 AI Bridge 宿主可向本机 LingBuilder 换取模块授权与浏览器凭据；只监听回环、凭据不落盘不进日志，IDE 退出即撤销。关闭时外部 AI 只能使用免费模块。</span>
                      <span className="mt-1 block font-mono text-[10px] text-cyan-500">{externalModuleAccess ? (localAuth?.running ? `代理监听 127.0.0.1:${localAuth.port}，已完成 ${localAuth.exchanges} 次换取。` : '保存后自动启动代理（运行中的 Bridge 需先停止）。') : (running || transitioning ? '需先停止 AI Bridge 才能修改本开关。' : '未开启。')}</span>
                    </span>
                  </label>
                </fieldset>}
                <fieldset disabled={running || transitioning || Boolean(busyAction)} className="space-y-3 disabled:opacity-60">
                  <label className="block text-[11px] font-medium"><span className="flex items-center justify-between gap-2"><span>自定义 Token（可选）</span>{settingsSaveState !== 'idle' && <span aria-live="polite" className={`flex shrink-0 items-center gap-1 text-[10px] font-normal ${settingsSaveState === 'saved' ? 'text-emerald-500' : muted}`}>{settingsSaveState === 'saved' ? <><Check className="h-3 w-3" />已保存到本机加密存储</> : <><LoaderCircle className="h-3 w-3 animate-spin" />正在保存…</>}</span>}</span><input type="password" autoComplete="off" value={customToken} onChange={event => setCustomToken(event.target.value)} aria-invalid={tokenInvalid} placeholder="留空则自动生成持久 Token（推荐）" className={`mt-1 min-h-11 w-full rounded border px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${field} ${tokenInvalid ? 'border-rose-500/60' : ''}`} /><span className={`mt-1 block text-[10px] font-normal ${tokenInvalid ? 'text-rose-400' : muted}`}>{tokenInvalid ? '自定义 Token 必须是 24–256 个不含空白的可见 ASCII 字符（不能含中文或空格）。' : 'Token 持久保存后，AI 客户端里的连接配置一次长期有效；清空则下次启动自动生成新的持久 Token。'}</span></label>
                  {running && <div className="grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void copyToken()} className="min-h-11 rounded border border-current/20 text-[11px] hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><KeyRound className="mr-1 inline h-3.5 w-3.5" />{tokenIsCustom ? '复制 Token' : '复制本机 Token'}</button><button type="button" onClick={() => void rotateToken()} disabled={Boolean(busyAction) || tokenIsCustom} title={tokenIsCustom ? '当前运行使用自定义 Token；如需更换请先停止 Bridge，在本区修改后重新启动。' : undefined} className="min-h-11 rounded border border-amber-500/40 text-[11px] text-amber-400 hover:bg-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />重新生成 Token</button></div>}
                </fieldset>
                {skillKitApi && <section>
                  <h4 className="text-xs font-semibold">灵码 Skill 正文</h4><p className={`mb-2 mt-1 text-[11px] leading-5 ${muted}`}>给外部 AI 客户端阅读的接入指引。安装包内置一份离线快照；联网时以官网后台发布的最新版为准，取不到会自动回退，不阻断使用。</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className={`rounded border px-2 py-1 ${skillKit?.source === 'bundled' ? 'border-current/20' : 'border-cyan-500/40 text-cyan-500'}`}>{skillKit ? SKILL_KIT_SOURCE_LABELS[skillKit.source] : '读取中'}</span>
                    <span className={`font-mono ${muted}`}>{skillKit ? `v${skillKit.version || '—'} · sequence ${skillKit.sequence} · ${skillKit.fileCount} 个文件` : '—'}</span>
                    <button type="button" className="min-h-11 rounded border border-current/15 px-3 hover:border-cyan-500/40" disabled={skillKitBusy} onClick={() => void loadSkillKit(false)}>刷新状态</button>
                    <button type="button" className="min-h-11 rounded border border-cyan-500/40 px-3 text-cyan-500 hover:bg-cyan-500/10" disabled={skillKitBusy} onClick={() => void loadSkillKit(true)}>{skillKitBusy ? '正在检查…' : '检查更新'}</button>
                    <button type="button" className="flex min-h-11 items-center gap-1 rounded border border-current/15 px-3 hover:border-cyan-500/40" disabled={!skillKit?.installPrompt} onClick={() => void copyInstallPrompt()} aria-live="polite">{installPromptCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : null}{installPromptCopied ? '已复制' : '复制安装指令'}</button>
                  </div>
                  {skillKit?.entrypointPath && <p className={`mt-2 break-all font-mono text-[10px] ${muted}`}>{skillKit.entrypointPath}</p>}
                  {skillKit?.problem && <p className="mt-2 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] leading-5 text-amber-400">{skillKit.problem}</p>}
                </section>}
              </div>
            </details>
          </div>}

          {activeTab === 'activity' && <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="已连接客户端" description="共享 MCP HTTP 允许多个客户端同时连接。" cardClass={card} isDarkMode={isDarkMode}>
              {bridge.clients.length ? <div className="space-y-2">{bridge.clients.map(client => <div key={client.id} className="rounded border border-current/10 p-3"><div className="flex items-center gap-2 text-xs font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{client.userAgent}</div><div className={`mt-1 break-all font-mono text-[10px] ${muted}`}>{client.id}</div><div className={`mt-1 text-[10px] ${muted}`}>最后活动：{formatTime(client.lastActiveAt)}</div></div>)}</div> : <EmptyState icon={<Users className="h-5 w-5" />} isDarkMode={isDarkMode} text={running ? '尚无客户端连接。把连接配置粘贴到 AI 客户端后即可开始。' : 'Bridge 运行后，这里会显示连接的客户端。'} />}
            </SectionCard>
            <SectionCard title="工具调用活动" description="只记录工具名、结果和耗时，不记录文件正文或提示词。" cardClass={card} isDarkMode={isDarkMode}>
              {bridge.recentActivity.length ? <div className="space-y-2">{bridge.recentActivity.slice(0, 30).map(item => <div key={item.id} className="flex items-start gap-2 rounded border border-current/10 p-2.5">{item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}<div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium">{item.tool || item.message}</div><div className={`mt-0.5 text-[10px] ${muted}`}>{formatTime(item.timestamp)}{item.durationMs !== undefined ? ` · ${item.durationMs} ms` : ''}</div></div></div>)}{bridge.recentActivity.length > 30 && <p className={`pt-1 text-[10px] ${muted}`}>仅显示最近 30 条活动。</p>}</div> : <EmptyState icon={<Activity className="h-5 w-5" />} isDarkMode={isDarkMode} text="还没有工具调用记录。" />}
            </SectionCard>
            <SectionCard title="运行日志" description="Token 会在进入日志前自动隐藏。" cardClass={`${card} lg:col-span-2`} isDarkMode={isDarkMode}>
              <div className="mb-2 flex items-center justify-end">
                <button type="button" onClick={() => void copyLogs()} disabled={!bridge.logs.length} className="flex min-h-11 items-center gap-1 rounded px-2 text-[11px] hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-40" aria-live="polite">{logsCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}{logsCopied ? '已复制' : '复制日志'}</button>
              </div>
              <pre ref={logsRef} className={`max-h-56 overflow-auto rounded border p-3 text-[10px] leading-5 ${code}`}><code>{bridge.logs.length ? bridge.logs.join('\n') : '尚无运行日志。'}</code></pre>
            </SectionCard>
          </div>}
        </main>

        <footer className={`flex flex-wrap items-center gap-3 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353d] bg-[#19191f]' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`min-h-5 min-w-0 flex-1 text-[11px] ${notice ? 'text-emerald-500' : muted}`} aria-live="polite">{notice && <><Check className="mr-1 inline h-3.5 w-3.5" />{notice.text}</>}</div>
          <button type="button" onClick={() => void openManual()} className="flex min-h-11 items-center gap-2 rounded px-3 text-[11px] hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><ScrollText className="h-4 w-4" />完整手册</button>
          <button type="button" onClick={onClose} className="min-h-11 rounded border border-current/20 px-4 text-[11px] font-medium hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500">关闭</button>
        </footer>
      </section>
    </div>
  );
}

function SectionCard({ title, description, cardClass, isDarkMode, children }: { title: string; description: string; cardClass: string; isDarkMode: boolean; children: React.ReactNode }) {
  return <section className={`rounded-lg border p-4 ${cardClass}`}><h3 className="text-sm font-semibold">{title}</h3><p className={`mb-3 mt-1 text-[11px] leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>{children}</section>;
}

function EndpointRow({ icon, label, value, onCopy, isDarkMode }: { icon: React.ReactNode; label: string; value: string; onCopy: () => void | Promise<void>; isDarkMode: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <div className="flex min-h-12 min-w-0 items-center gap-3 rounded border border-current/10 px-3"><span className="shrink-0 text-cyan-500">{icon}</span><div className="min-w-0 flex-1"><div className={`text-[10px] ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{label}</div><div className="truncate font-mono text-[10px]" title={value}>{value}</div></div><button type="button" onClick={() => void handleCopy()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label={copied ? `已复制${label}` : `复制${label}`}>{copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Clipboard className="h-3.5 w-3.5" />}</button></div>;
}

function BridgeStateBadge({ state, isDarkMode }: { state: BridgeState; isDarkMode: boolean }) {
  const neutral = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const config = state === 'running' ? ['运行中', 'bg-emerald-500/15 text-emerald-500'] : state === 'error' ? ['异常', 'bg-rose-500/15 text-rose-500'] : state === 'starting' || state === 'stopping' ? ['处理中', 'bg-amber-500/15 text-amber-500'] : ['未启动', `bg-slate-500/15 ${neutral}`];
  return <span className={`rounded px-2 py-0.5 text-[10px] font-medium ${config[1]}`}>{config[0]}</span>;
}

function EmptyState({ icon, text, isDarkMode }: { icon: React.ReactNode; text: string; isDarkMode: boolean }) {
  return <div className={`flex min-h-32 flex-col items-center justify-center gap-2 rounded border border-dashed border-current/15 p-5 text-center text-[11px] leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>{icon}<span>{text}</span></div>;
}

function formatTime(value: string): string { try { return new Date(value).toLocaleString('zh-CN', { hour12: false }); } catch { return value; } }
function errorMessage(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason || '操作失败。'); }

// 与主进程 validatePort / normalizeAiBridgeStartSettings 同一口径，避免「能启动但记不住」或反之。
function isPortValid(value: number): boolean { return Number.isInteger(value) && value >= 1024 && value <= 65535; }
function isTokenValid(value: string): boolean { return value.length >= 24 && value.length <= 256 && !/[^\x21-\x7e]/u.test(value); }

const PROBE_TIMEOUT_MS = 15_000;
async function withProbeTimeout<T>(task: Promise<T>, label: string): Promise<T> {
  return await new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label}超时，请重试。`)), PROBE_TIMEOUT_MS);
    task.then(
      value => { window.clearTimeout(timer); resolve(value); },
      reason => { window.clearTimeout(timer); reject(reason); }
    );
  });
}

function trapFocus(event: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
