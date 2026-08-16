import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Bot,
  Cable,
  Check,
  CheckCircle2,
  Clipboard,
  ExternalLink,
  KeyRound,
  Link2,
  LoaderCircle,
  Play,
  Radio,
  RefreshCw,
  ScrollText,
  Settings2,
  ShieldCheck,
  Square,
  TerminalSquare,
  Users,
  X,
  XCircle
} from 'lucide-react';

type CenterTab = 'connect' | 'activity' | 'cli' | 'advanced';
type BridgePermission = 'readonly' | 'preview' | 'yolo';
type BridgeLifecycle = 'workspace' | 'ide';
type BridgeState = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';
type ClientId = 'codex' | 'claude' | 'gemini' | 'generic';
type CodexDesktopState = 'not-installed' | 'not-configured' | 'configured' | 'restart-required' | 'repair-required' | 'conflict' | 'error';

interface BridgeSnapshot {
  state: BridgeState;
  workspaceRoot: string;
  permission: BridgePermission;
  lifecycle: BridgeLifecycle;
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
}

interface ExternalClient {
  id: ClientId;
  label: string;
  installed: boolean;
  executable: string;
  detail: string;
}

interface CodexDesktopStatus {
  state: CodexDesktopState;
  installed: boolean;
  running: boolean;
  label: string;
  detail: string;
  configured: boolean;
  configPath: string;
  workspaceRoot: string;
  permission: BridgePermission;
  restartRequired: boolean;
  managed: boolean;
}

interface CliIntegrationStatus {
  state: 'ready' | 'path-missing' | 'launcher-missing' | 'check-failed' | 'development';
  launcherPath: string;
  launcherExists: boolean;
  pathConfigured: boolean;
  version: string | null;
  detail: string;
}

interface CliGuideDialogProps {
  open: boolean;
  isDarkMode: boolean;
  onClose: () => void;
  onOpenTerminal: () => void;
}

const EMPTY_BRIDGE: BridgeSnapshot = {
  state: 'stopped', workspaceRoot: '', permission: 'preview', lifecycle: 'workspace', port: 17860,
  httpUrl: '', mcpUrl: '', startedAt: null, pid: null, tokenMasked: '', tokenAvailable: false,
  activeClients: 0, clients: [], recentActivity: [], logs: [], error: ''
};

const QUICK_COMMANDS = [
  ['查看帮助', 'lingbuilder --help', '列出所有 CLI 子命令与参数。'],
  ['检查环境', 'lingbuilder doctor --json', '检查运行时、编译器和工作区状态。'],
  ['登录系统 AI', 'lingbuilder auth login', '通过浏览器完成设备登录。'],
  ['检查工作区', 'lingbuilder workspace inspect --workspace . --json', '输出当前工作区文件树。'],
  ['构建项目', 'lingbuilder project build --workspace . --request build-request.json --yes', '使用受控请求生成并构建项目。']
] as const;

export default function CliGuideDialog({ open, isDarkMode, onClose, onOpenTerminal }: CliGuideDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<CenterTab>('connect');
  const [bridge, setBridge] = useState<BridgeSnapshot>(EMPTY_BRIDGE);
  const [clients, setClients] = useState<ExternalClient[]>([]);
  const [codexDesktop, setCodexDesktop] = useState<CodexDesktopStatus | null>(null);
  const [cliStatus, setCliStatus] = useState<CliIntegrationStatus | null>(null);
  const [port, setPort] = useState(17860);
  const [permission, setPermission] = useState<BridgePermission>('preview');
  const [lifecycle, setLifecycle] = useState<BridgeLifecycle>('workspace');
  const [customToken, setCustomToken] = useState('');
  const [approvedYolo, setApprovedYolo] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const desktopApi = window.lingBuilder?.aiBridge;
  const running = bridge.state === 'running';
  const transitioning = bridge.state === 'starting' || bridge.state === 'stopping';

  const refreshStatus = useCallback(async () => {
    if (!desktopApi) throw new Error('AI Bridge 连接中心仅在 LingBuilder 桌面版中可用。');
    const result = await desktopApi.status() as BridgeSnapshot;
    setBridge(result);
    if (result.state !== 'stopped' && result.state !== 'error') {
      setPort(result.port); setPermission(result.permission); setLifecycle(result.lifecycle);
    }
    return result;
  }, [desktopApi]);

  const refreshClients = useCallback(async () => {
    if (!desktopApi) return;
    setClients(await desktopApi.clients() as ExternalClient[]);
  }, [desktopApi]);

  const refreshCodexDesktop = useCallback(async () => {
    if (!desktopApi?.codexDesktopStatus) return;
    setCodexDesktop(await desktopApi.codexDesktopStatus(permission) as CodexDesktopStatus);
  }, [desktopApi, permission]);

  const inspectCli = useCallback(async () => {
    const inspector = window.lingBuilder?.cli?.inspect;
    if (!inspector) return;
    setCliStatus(await inspector() as CliIntegrationStatus);
  }, []);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    setError('');
    void Promise.all([refreshStatus(), refreshClients(), refreshCodexDesktop(), inspectCli()]).catch(reason => setError(errorMessage(reason)));
    const unsubscribe = desktopApi?.onStatusChanged(snapshot => setBridge(snapshot as BridgeSnapshot));
    return () => {
      cancelAnimationFrame(frame); unsubscribe?.();
      previousFocusRef.current?.focus(); previousFocusRef.current = null;
    };
  }, [desktopApi, inspectCli, open, refreshClients, refreshCodexDesktop, refreshStatus]);

  useEffect(() => {
    if (!open || !running) return undefined;
    const timer = window.setInterval(() => { void refreshStatus(); }, 2_000);
    return () => window.clearInterval(timer);
  }, [open, refreshStatus, running]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(''), 3_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const mcpConfig = useMemo(() => JSON.stringify({
    mcpServers: {
      lingbuilder: {
        type: 'http',
        url: bridge.mcpUrl || `http://127.0.0.1:${port}/api/ai-bridge/mcp`,
        headers: { Authorization: 'Bearer ${LINGBUILDER_AI_BRIDGE_TOKEN}' }
      }
    }
  }, null, 2), [bridge.mcpUrl, port]);

  if (!open) return null;

  const runAction = async <T,>(name: string, action: () => Promise<T>): Promise<T | undefined> => {
    setBusyAction(name); setError('');
    try { return await action(); }
    catch (reason) { setError(errorMessage(reason)); return undefined; }
    finally { setBusyAction(''); }
  };

  const startBridge = async (): Promise<BridgeSnapshot | undefined> => await runAction('start', async () => {
    if (!desktopApi) throw new Error('当前环境无法启动 AI Bridge。');
    if (permission === 'yolo' && !approvedYolo) throw new Error('请选择确认框后才能启用 yolo。');
    const result = await desktopApi.start({ port, permission, lifecycle, token: customToken || undefined, approvedYolo }) as BridgeSnapshot;
    setBridge(result); setCustomToken(''); setNotice('AI Bridge 已启动，可以连接外部 AI。');
    return result;
  });

  const stopBridge = async () => { await runAction('stop', async () => {
    if (!desktopApi) throw new Error('当前环境无法停止 AI Bridge。');
    const result = await desktopApi.stop() as BridgeSnapshot; setBridge(result); setNotice('AI Bridge 已停止，所有客户端连接已断开。');
  }); };

  const connectClient = async (client: ExternalClient) => { await runAction(`client:${client.id}`, async () => {
    if (!desktopApi) throw new Error('当前环境无法连接外部 AI。');
    if (!client.installed) throw new Error(`${client.label} 未安装或无法启动。`);
    if (!running) {
      const started = await startBridge();
      if (!started) return;
    }
    const result = await desktopApi.launchClient(client.id);
    setNotice(result.detail || `${client.label} 已连接。`);
    onOpenTerminal();
  }); };

  const configureCodexDesktop = async () => { await runAction('codex-desktop:configure', async () => {
    if (!desktopApi?.configureCodexDesktop) throw new Error('当前版本未提供 ChatGPT/Codex 桌面集成。');
    if (permission === 'yolo' && !approvedYolo) throw new Error('请先在高级设置中确认 yolo 权限。');
    const replaceExisting = codexDesktop?.state === 'conflict';
    if (replaceExisting && !await requestWorkbenchConfirm({ title: '替换同名配置', description: '当前工作区已有同名 MCP 配置。是否备份保留其他配置，并由 LingBuilder 替换这个同名配置？', confirmLabel: '替换', cancelLabel: '取消' })) return;
    const result = await desktopApi.configureCodexDesktop({ permission, approvedYolo, replaceExisting, openApp: true }) as CodexDesktopStatus;
    setCodexDesktop(result);
    setNotice(result.restartRequired
      ? '配置已写入。请完全退出并重新打开 ChatGPT/Codex 桌面客户端。'
      : 'ChatGPT/Codex 桌面版已配置并打开。请在当前工作区新建任务。');
  }); };

  const openCodexDesktop = async () => { await runAction('codex-desktop:open', async () => {
    if (!desktopApi?.openCodexDesktop) throw new Error('当前版本未提供 ChatGPT/Codex 桌面集成。');
    setCodexDesktop(await desktopApi.openCodexDesktop() as CodexDesktopStatus);
    setNotice('已打开 ChatGPT/Codex 桌面客户端。');
  }); };

  const removeCodexDesktop = async () => { await runAction('codex-desktop:remove', async () => {
    if (!desktopApi?.removeCodexDesktop) throw new Error('当前版本未提供 ChatGPT/Codex 桌面集成。');
    if (!await requestWorkbenchConfirm({ title: '移除 MCP 配置', description: '确定移除当前工作区的 LingBuilder 桌面 MCP 配置吗？其他 Codex 配置不会受到影响。', confirmLabel: '移除', cancelLabel: '取消' })) return;
    setCodexDesktop(await desktopApi.removeCodexDesktop() as CodexDesktopStatus);
    setNotice('已移除当前工作区的 LingBuilder 桌面 MCP 配置。');
  }); };

  const copyText = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); setNotice(`已复制：${label}`); }
    catch { setError('复制失败，请选中文本后手动复制。'); }
  };

  const copyToken = async () => { await runAction('token', async () => {
    if (!desktopApi) throw new Error('当前环境无法读取 Token。');
    await navigator.clipboard.writeText(await desktopApi.revealToken());
    setNotice('临时 Token 已复制，请只交给可信的本机客户端。');
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

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-2 sm:p-5">
      <section
        ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`flex max-h-[calc(100dvh-1rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border shadow-2xl sm:max-h-[92vh] ${surface}`}
        onKeyDown={event => { if (event.key === 'Escape') onClose(); if (event.key === 'Tab') trapFocus(event, dialogRef.current); }}
      >
        <header className={`flex items-start justify-between gap-4 border-b px-4 py-3 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Cable className="h-4 w-4 shrink-0 text-cyan-500" aria-hidden="true" />
              <h2 id={titleId} className="text-sm font-semibold">AI Bridge 连接中心</h2>
              <BridgeStateBadge state={bridge.state} />
            </div>
            <p className={`mt-1 text-[11px] leading-5 ${muted}`}>一键适配 ChatGPT/Codex 桌面版，或让 Codex CLI、Claude Code、Gemini CLI 和自研客户端安全使用当前工作区。</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded hover:bg-slate-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="关闭 AI Bridge 连接中心"><X className="h-4 w-4" /></button>
        </header>

        <nav className={`flex shrink-0 overflow-x-auto border-b px-2 ${isDarkMode ? 'border-[#35353d]' : 'border-slate-200'}`} aria-label="AI Bridge 功能分类" role="tablist">
          {([['connect', '连接'], ['activity', `客户端与活动${bridge.activeClients ? ` (${bridge.activeClients})` : ''}`], ['cli', 'CLI 与自动化'], ['advanced', '高级设置']] as Array<[CenterTab, string]>).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={activeTab === id} onClick={() => setActiveTab(id)} className={`min-h-11 shrink-0 border-b-2 px-4 text-[11px] font-medium focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500 ${activeTab === id ? 'border-cyan-500 text-cyan-500' : `border-transparent ${muted} hover:text-cyan-500`}`}>{label}</button>
          ))}
        </nav>

        {(error || bridge.error) && <div role="alert" className="mx-4 mt-3 flex items-start gap-2 rounded border border-rose-500/40 bg-rose-500/10 p-2.5 text-[11px] leading-5 text-rose-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error || bridge.error}</span></div>}

        <main className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4" role="tabpanel">
          {activeTab === 'connect' && <div className="space-y-4">
            <section className={`rounded-lg border p-4 ${card}`} aria-labelledby="bridge-control-title">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2"><Radio className={`h-5 w-5 ${running ? 'text-emerald-500' : 'text-slate-500'}`} /><h3 id="bridge-control-title" className="text-sm font-semibold">{running ? 'Bridge 正在运行' : transitioning ? 'Bridge 正在切换状态' : '启动当前工作区 Bridge'}</h3></div>
                  <p className={`mt-1 break-all text-[11px] leading-5 ${muted}`}>{running ? bridge.workspaceRoot : '默认使用 preview 权限，只监听 127.0.0.1，关闭工作区时自动停止。'}</p>
                </div>
                {running ? <button type="button" onClick={() => void stopBridge()} disabled={Boolean(busyAction)} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded border border-rose-500/50 px-4 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 focus:outline-none focus:ring-2 focus:ring-rose-500 disabled:opacity-50"><Square className="h-4 w-4" />停止 Bridge</button>
                  : <button type="button" onClick={() => void startBridge()} disabled={Boolean(busyAction) || transitioning} className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded bg-cyan-600 px-5 text-xs font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{busyAction === 'start' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}启动 AI Bridge</button>}
              </div>
              {running && <div className="mt-4 grid gap-2 border-t border-current/10 pt-4 sm:grid-cols-2">
                <EndpointRow icon={<Link2 className="h-4 w-4" />} label="MCP（推荐）" value={bridge.mcpUrl} onCopy={() => void copyText(bridge.mcpUrl, 'MCP 地址')} />
                <EndpointRow icon={<Cable className="h-4 w-4" />} label="HTTP API" value={bridge.httpUrl} onCopy={() => void copyText(bridge.httpUrl, 'HTTP 地址')} />
                <EndpointRow icon={<KeyRound className="h-4 w-4" />} label="临时 Token" value={bridge.tokenMasked} onCopy={() => void copyToken()} />
                <div className="flex min-h-12 items-center gap-3 rounded border border-current/10 px-3"><Users className="h-4 w-4 text-cyan-500" /><div><div className={`text-[9px] ${muted}`}>已连接客户端</div><div className="text-xs font-semibold tabular-nums">{bridge.activeClients}</div></div></div>
              </div>}
            </section>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">ChatGPT / Codex 桌面客户端</h3><p className={`mt-1 text-[11px] ${muted}`}>为当前工作区安装项目级 MCP；桌面客户端直接启动本地工具服务，无需 Codex CLI、端口或 Token。</p></div><button type="button" onClick={() => void refreshCodexDesktop()} className="flex min-h-9 shrink-0 items-center gap-1 rounded px-2 text-[10px] text-cyan-500 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><RefreshCw className="h-3.5 w-3.5" />重新检测</button></div>
              <CodexDesktopCard
                status={codexDesktop}
                busy={busyAction.startsWith('codex-desktop:')}
                disabled={Boolean(busyAction)}
                isDarkMode={isDarkMode}
                onConfigure={() => void configureCodexDesktop()}
                onOpen={() => void openCodexDesktop()}
                onRemove={() => void removeCodexDesktop()}
                onRefresh={() => void refreshCodexDesktop()}
              />
            </section>

            <section>
              <div className="mb-2 flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">连接外部 AI CLI</h3><p className={`mt-1 text-[11px] ${muted}`}>点击一次即可启动 Bridge、注入临时凭据并在 IDE 终端打开客户端。</p></div><button type="button" onClick={() => void refreshClients()} className="flex min-h-9 items-center gap-1 rounded px-2 text-[10px] text-cyan-500 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><RefreshCw className="h-3.5 w-3.5" />重新检测</button></div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {clients.map(client => <ClientCard key={client.id} client={client} busy={busyAction === `client:${client.id}`} disabled={Boolean(busyAction) || transitioning} isDarkMode={isDarkMode} onConnect={() => void connectClient(client)} />)}
                {!clients.length && <div role="status" className={`col-span-full rounded border p-4 text-[11px] ${card}`}><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />正在检测外部 AI CLI…</div>}
              </div>
            </section>

            <div className="flex items-start gap-2 rounded border border-cyan-500/30 bg-cyan-500/10 p-3 text-[11px] leading-5"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-500" /><span>桌面客户端使用当前项目的 STDIO MCP，不保存 Token、不监听网络端口；CLI 客户端的 Token 只注入新建终端环境。两种方式都受 LingBuilder 工作区边界和权限模式限制。</span></div>
          </div>}

          {activeTab === 'activity' && <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="已连接客户端" description="共享 MCP HTTP 允许多个客户端同时连接。" cardClass={card}>
              {bridge.clients.length ? <div className="space-y-2">{bridge.clients.map(client => <div key={client.id} className="rounded border border-current/10 p-3"><div className="flex items-center gap-2 text-xs font-medium"><CheckCircle2 className="h-4 w-4 text-emerald-500" />{client.userAgent}</div><div className={`mt-1 break-all font-mono text-[9px] ${muted}`}>{client.id}</div><div className={`mt-1 text-[9px] ${muted}`}>最后活动：{formatTime(client.lastActiveAt)}</div></div>)}</div> : <EmptyState icon={<Users className="h-5 w-5" />} text={running ? '尚无客户端连接。点击“连接”页中的客户端即可开始。' : '启动 Bridge 后，这里会显示连接的客户端。'} />}
            </SectionCard>
            <SectionCard title="工具调用活动" description="只记录工具名、结果和耗时，不记录文件正文或提示词。" cardClass={card}>
              {bridge.recentActivity.length ? <div className="space-y-2">{bridge.recentActivity.slice(0, 30).map(item => <div key={item.id} className="flex items-start gap-2 rounded border border-current/10 p-2.5">{item.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />}<div className="min-w-0 flex-1"><div className="truncate text-[11px] font-medium">{item.tool || item.message}</div><div className={`mt-0.5 text-[9px] ${muted}`}>{formatTime(item.timestamp)}{item.durationMs !== undefined ? ` · ${item.durationMs} ms` : ''}</div></div></div>)}</div> : <EmptyState icon={<Activity className="h-5 w-5" />} text="还没有工具调用记录。" />}
            </SectionCard>
            <SectionCard title="运行日志" description="Token 会在进入日志前自动隐藏。" cardClass={`${card} lg:col-span-2`}>
              <pre className={`max-h-56 overflow-auto rounded border p-3 text-[10px] leading-5 ${code}`}><code>{bridge.logs.length ? bridge.logs.join('\n') : '尚无运行日志。'}</code></pre>
            </SectionCard>
          </div>}

          {activeTab === 'cli' && <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
            <SectionCard title="CLI 安装状态" description="CLI 继续服务脚本、CI 和高级自动化。" cardClass={card}>
              {cliStatus ? <div className="space-y-2">
                <StatusRow label="CLI 启动器" ready={cliStatus.launcherExists} detail={cliStatus.launcherExists ? '已找到' : '缺失'} />
                <StatusRow label="当前用户 PATH" ready={cliStatus.pathConfigured} detail={cliStatus.pathConfigured ? '已配置' : '未配置'} />
                <StatusRow label="版本自检" ready={Boolean(cliStatus.version)} detail={cliStatus.version || '未通过'} />
                <p className={`pt-2 text-[10px] leading-4 ${muted}`}>{cliStatus.detail}</p>
              </div> : <LoaderCircle className="h-4 w-4 animate-spin" />}
              <div className="mt-3 grid gap-2"><button type="button" onClick={() => void inspectCli()} className="min-h-10 rounded border border-current/20 text-[11px] hover:bg-slate-500/10">重新检查 CLI</button><button type="button" onClick={() => void openManual()} className="flex min-h-10 items-center justify-center gap-2 rounded border border-current/20 text-[11px] hover:bg-slate-500/10"><BookOpen className="h-4 w-4" />打开完整手册<ExternalLink className="h-3 w-3" /></button></div>
            </SectionCard>
            <SectionCard title="常用 CLI 命令" description="Bridge 连接不替代 CLI；这些命令适合终端、脚本和 CI。" cardClass={card}>
              <div className="space-y-2">{QUICK_COMMANDS.map(([label, command, description]) => <CommandRow key={command} label={label} command={command} description={description} codeClass={code} onCopy={copyText} />)}</div>
            </SectionCard>
          </div>}

          {activeTab === 'advanced' && <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title="Bridge 启动设置" description={running ? 'Bridge 运行时设置已锁定；停止后可以修改。' : '这些设置只应用于下一次启动。'} cardClass={card}>
              <fieldset disabled={running || transitioning || Boolean(busyAction)} className="space-y-4 disabled:opacity-60">
                <label className="block text-[11px] font-medium">监听端口<input type="number" min={1024} max={65535} value={port} onChange={event => setPort(Number(event.target.value))} className={`mt-1 min-h-11 w-full rounded border px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${field}`} /><span className={`mt-1 block text-[9px] font-normal ${muted}`}>仅监听 127.0.0.1；端口冲突时会明确报错。</span></label>
                <div><div className="text-[11px] font-medium">权限模式</div><div className="mt-2 grid gap-2 sm:grid-cols-3">{(['readonly', 'preview', 'yolo'] as BridgePermission[]).map(value => <label key={value} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-[10px] ${permission === value ? 'border-cyan-500 bg-cyan-500/10' : 'border-current/15'}`}><input type="radio" name="bridge-permission" value={value} checked={permission === value} onChange={() => { setPermission(value); if (value !== 'yolo') setApprovedYolo(false); }} />{value}{value === 'preview' && <span className="text-cyan-500">推荐</span>}</label>)}</div></div>
                {permission === 'yolo' && <label className="flex cursor-pointer items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-[10px] leading-5 text-amber-400"><input type="checkbox" checked={approvedYolo} onChange={event => setApprovedYolo(event.target.checked)} className="mt-1" /><span>我确认：可信的本机 AI 可以自动写入文件、导出并执行 LingBuilder 受控构建；仍不开放任意 shell。</span></label>}
                <label className="block text-[11px] font-medium">生命周期<select value={lifecycle} onChange={event => setLifecycle(event.target.value as BridgeLifecycle)} className={`mt-1 min-h-11 w-full rounded border px-3 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${field}`}><option value="workspace">关闭或切换工作区时停止（推荐）</option><option value="ide">IDE 退出时停止</option></select></label>
                <label className="block text-[11px] font-medium">自定义 Token（可选）<input type="password" autoComplete="off" value={customToken} onChange={event => setCustomToken(event.target.value)} placeholder="留空则生成高强度临时 Token" className={`mt-1 min-h-11 w-full rounded border px-3 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${field}`} /><span className={`mt-1 block text-[9px] font-normal ${muted}`}>不会持久化；要求 24–256 个不含空白的字符。</span></label>
              </fieldset>
            </SectionCard>
            <SectionCard title="连接配置" description="供不在快捷客户端列表中的 MCP 或 HTTP 客户端使用。" cardClass={card}>
              <div className={`relative rounded border ${code}`}><pre className="max-h-72 overflow-auto p-3 pr-12 text-[10px] leading-5"><code>{mcpConfig}</code></pre><button type="button" onClick={() => void copyText(mcpConfig, '通用 MCP 配置')} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded border border-cyan-400/30 bg-black/20 hover:bg-cyan-500/15 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label="复制通用 MCP 配置"><Clipboard className="h-4 w-4" /></button></div>
              {running && <div className="mt-3 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => void copyToken()} className="min-h-11 rounded border border-current/20 text-[10px] hover:bg-slate-500/10"><KeyRound className="mr-1 inline h-3.5 w-3.5" />复制临时 Token</button><button type="button" onClick={() => void runAction('rotate', async () => { if (!desktopApi) return; setBridge(await desktopApi.rotateToken() as BridgeSnapshot); setNotice('Token 已重新生成，旧客户端连接已失效。'); })} className="min-h-11 rounded border border-amber-500/40 text-[10px] text-amber-400 hover:bg-amber-500/10"><RefreshCw className="mr-1 inline h-3.5 w-3.5" />重新生成 Token</button></div>}
              <div className={`mt-3 text-[10px] leading-5 ${muted}`}>HTTP API 保留用于自研客户端、脚本和 CI；外部 AI CLI 优先使用共享 MCP Streamable HTTP。完整接口和 curl 示例仍见 CLI 手册。</div>
            </SectionCard>
            <SectionCard title="权限边界" description="所有传输方式复用相同的服务和审计规则。" cardClass={`${card} lg:col-span-2`}>
              <div className="grid gap-2 sm:grid-cols-3"><PermissionCard name="readonly" text="读取、搜索、诊断和生成预览；禁止写入与执行。" /><PermissionCard name="preview" text="默认模式；写入、导出和构建必须得到明确批准。" recommended /><PermissionCard name="yolo" text="可信自动化可执行受控能力；仍禁止任意 shell 和工作区逃逸。" /></div>
            </SectionCard>
          </div>}
        </main>

        <footer className={`flex flex-wrap items-center gap-3 border-t px-4 py-3 ${isDarkMode ? 'border-[#35353d] bg-[#19191f]' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`min-h-5 min-w-0 flex-1 text-[11px] ${notice ? 'text-emerald-500' : muted}`} aria-live="polite">{notice && <><Check className="mr-1 inline h-3.5 w-3.5" />{notice}</>}</div>
          <button type="button" onClick={() => void openManual()} className="flex min-h-10 items-center gap-2 rounded px-3 text-[11px] hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><ScrollText className="h-4 w-4" />完整手册</button>
          <button type="button" onClick={onClose} className="min-h-10 rounded border border-current/20 px-4 text-[11px] font-medium hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500">关闭</button>
        </footer>
      </section>
    </div>
  );
}

function CodexDesktopCard({ status, busy, disabled, isDarkMode, onConfigure, onOpen, onRemove, onRefresh }: {
  status: CodexDesktopStatus | null;
  busy: boolean;
  disabled: boolean;
  isDarkMode: boolean;
  onConfigure: () => void;
  onOpen: () => void;
  onRemove: () => void;
  onRefresh: () => void;
}) {
  if (!status) return <div role="status" className={`rounded-lg border p-4 text-[11px] ${isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50'}`}><LoaderCircle className="mr-2 inline h-4 w-4 animate-spin" />正在检测 ChatGPT/Codex 桌面客户端…</div>;
  const needsConfiguration = status.state === 'not-configured' || status.state === 'repair-required' || status.state === 'conflict';
  const actionLabel = status.state === 'conflict' ? '接管配置并打开' : status.state === 'repair-required' ? '更新配置并打开' : '配置并打开桌面版';
  return <article className={`rounded-lg border p-4 ${isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500"><Bot className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-semibold">{status.label}</h4><CodexDesktopBadge status={status} /></div>
          <p className="mt-1 text-[10px] leading-5 text-slate-500">{status.detail}</p>
          {status.configPath && <p className="mt-1 truncate font-mono text-[9px] text-slate-500" title={status.configPath}>{status.configPath}</p>}
        </div>
      </div>
      <div className="grid shrink-0 gap-2 sm:grid-cols-2 lg:w-[360px]">
        {needsConfiguration && <button type="button" onClick={onConfigure} disabled={disabled || !status.installed} className="flex min-h-11 items-center justify-center gap-2 rounded bg-cyan-600 px-4 text-[10px] font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Cable className="h-4 w-4" />}{actionLabel}</button>}
        {!needsConfiguration && <button type="button" onClick={onOpen} disabled={disabled || !status.installed} className="flex min-h-11 items-center justify-center gap-2 rounded bg-cyan-600 px-4 text-[10px] font-semibold text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}打开桌面客户端</button>}
        <button type="button" onClick={onRefresh} disabled={disabled} className="flex min-h-11 items-center justify-center gap-2 rounded border border-current/20 px-3 text-[10px] hover:bg-slate-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"><RefreshCw className="h-4 w-4" />重新检测</button>
        {status.managed && <button type="button" onClick={onRemove} disabled={disabled} className="flex min-h-10 items-center justify-center rounded px-3 text-[10px] text-slate-500 hover:bg-rose-500/10 hover:text-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-500 sm:col-span-2">移除当前工作区 MCP 配置</button>}
      </div>
    </div>
    <div className="mt-4 grid gap-2 border-t border-current/10 pt-4 sm:grid-cols-3">
      <StatusRow label="桌面客户端" ready={status.installed} detail={status.installed ? (status.running ? '运行中' : '已安装') : '未安装'} />
      <StatusRow label="项目 MCP" ready={status.configured} detail={status.configured ? '已配置' : status.state === 'conflict' ? '存在冲突' : '未配置'} />
      <StatusRow label="配置加载" ready={status.configured && !status.restartRequired} detail={status.restartRequired ? '需要重启' : status.configured ? '可用' : '等待配置'} />
    </div>
    {status.restartRequired && <div className="mt-3 flex items-start gap-2 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-[10px] leading-5 text-amber-400"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>桌面客户端启动时间早于配置写入时间。请先完全退出 ChatGPT/Codex（包括后台进程），重新打开后在当前工作区新建任务，再点击“重新检测”。</span></div>}
  </article>;
}

function CodexDesktopBadge({ status }: { status: CodexDesktopStatus }) {
  const config = status.state === 'configured'
    ? ['已适配', 'bg-emerald-500/15 text-emerald-500']
    : status.state === 'restart-required'
      ? ['等待重启', 'bg-amber-500/15 text-amber-500']
      : status.state === 'repair-required' || status.state === 'conflict'
        ? ['需要处理', 'bg-amber-500/15 text-amber-500']
        : status.state === 'not-installed'
          ? ['未安装', 'bg-slate-500/15 text-slate-500']
          : ['未配置', 'bg-slate-500/15 text-slate-500'];
  return <span className={`rounded px-2 py-0.5 text-[9px] font-medium ${config[1]}`}>{config[0]}</span>;
}

function ClientCard({ client, busy, disabled, isDarkMode, onConnect }: { client: ExternalClient; busy: boolean; disabled: boolean; isDarkMode: boolean; onConnect: () => void }) {
  return <article className={`flex min-h-44 flex-col rounded-lg border p-3 ${isDarkMode ? 'border-[#35353d] bg-[#24242b]' : 'border-slate-200 bg-slate-50'}`}>
    <div className="flex items-start justify-between gap-2"><div className="flex h-9 w-9 items-center justify-center rounded bg-cyan-500/10 text-cyan-500">{client.id === 'generic' ? <TerminalSquare className="h-5 w-5" /> : <Bot className="h-5 w-5" />}</div>{client.installed ? <span className="flex items-center gap-1 text-[9px] text-emerald-500"><CheckCircle2 className="h-3 w-3" />可用</span> : <span className="flex items-center gap-1 text-[9px] text-amber-500"><AlertTriangle className="h-3 w-3" />未安装</span>}</div>
    <h4 className="mt-3 text-xs font-semibold">{client.label}</h4><p className="mt-1 flex-1 text-[10px] leading-4 text-slate-500">{client.detail}</p>
    <button type="button" onClick={onConnect} disabled={disabled || !client.installed} className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded border border-cyan-500/40 text-[10px] font-semibold text-cyan-500 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:cursor-not-allowed disabled:border-current/10 disabled:text-slate-500 disabled:opacity-60">{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{client.id === 'generic' ? '打开 Bridge 终端' : '连接并打开'}</button>
  </article>;
}

function SectionCard({ title, description, cardClass, children }: { title: string; description: string; cardClass: string; children: React.ReactNode }) {
  return <section className={`rounded-lg border p-4 ${cardClass}`}><h3 className="text-sm font-semibold">{title}</h3><p className="mb-3 mt-1 text-[10px] leading-5 text-slate-500">{description}</p>{children}</section>;
}

function EndpointRow({ icon, label, value, onCopy }: { icon: React.ReactNode; label: string; value: string; onCopy: () => void }) {
  return <div className="flex min-h-12 min-w-0 items-center gap-3 rounded border border-current/10 px-3"><span className="shrink-0 text-cyan-500">{icon}</span><div className="min-w-0 flex-1"><div className="text-[9px] text-slate-500">{label}</div><div className="truncate font-mono text-[10px]" title={value}>{value}</div></div><button type="button" onClick={onCopy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500" aria-label={`复制${label}`}><Clipboard className="h-3.5 w-3.5" /></button></div>;
}

function CommandRow({ label, command, description, codeClass, onCopy }: { label: string; command: string; description: string; codeClass: string; onCopy: (value: string, label: string) => Promise<void> }) {
  return <article className="rounded border border-current/10 p-3"><div className="flex items-start justify-between gap-3"><div><h4 className="text-xs font-medium">{label}</h4><p className="mt-0.5 text-[10px] text-slate-500">{description}</p></div><button type="button" onClick={() => void onCopy(command, label)} className="flex min-h-10 shrink-0 items-center gap-1 rounded px-2 text-[10px] hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-cyan-500"><Clipboard className="h-3.5 w-3.5" />复制</button></div><pre className={`mt-2 overflow-x-auto rounded border px-3 py-2 text-[10px] ${codeClass}`}><code>{command}</code></pre></article>;
}

function PermissionCard({ name, text, recommended = false }: { name: BridgePermission; text: string; recommended?: boolean }) {
  return <div className={`rounded border p-3 ${recommended ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-current/10'}`}><div className="font-mono text-xs font-semibold">{name}{recommended && <span className="ml-2 font-sans text-[9px] text-cyan-500">推荐</span>}</div><p className="mt-1 text-[10px] leading-5 text-slate-500">{text}</p></div>;
}

function StatusRow({ label, ready, detail }: { label: string; ready: boolean; detail: string }) {
  return <div className="flex items-center gap-2 text-[10px]">{ready ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> : <XCircle className="h-3.5 w-3.5 text-amber-500" />}<span className="flex-1">{label}</span><span className={ready ? 'text-emerald-500' : 'text-amber-500'}>{detail}</span></div>;
}

function BridgeStateBadge({ state }: { state: BridgeState }) {
  const config = state === 'running' ? ['运行中', 'bg-emerald-500/15 text-emerald-500'] : state === 'error' ? ['异常', 'bg-rose-500/15 text-rose-500'] : state === 'starting' || state === 'stopping' ? ['处理中', 'bg-amber-500/15 text-amber-500'] : ['未启动', 'bg-slate-500/15 text-slate-500'];
  return <span className={`rounded px-2 py-0.5 text-[9px] font-medium ${config[1]}`}>{config[0]}</span>;
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div className="flex min-h-32 flex-col items-center justify-center gap-2 rounded border border-dashed border-current/15 p-5 text-center text-[10px] leading-5 text-slate-500">{icon}<span>{text}</span></div>;
}

function formatTime(value: string): string { try { return new Date(value).toLocaleString('zh-CN', { hour12: false }); } catch { return value; } }
function errorMessage(reason: unknown): string { return reason instanceof Error ? reason.message : String(reason || '操作失败。'); }

function trapFocus(event: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0]; const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
