import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, KeyRound, Keyboard, RefreshCw, RotateCcw, Search, Settings, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { requestWorkbenchConfirm } from '../services/workbench/workbenchConfirmService';
import { requestCloudAccountLogin } from '../services/workbench/cloudAccountLoginService';
import { requestCloudAccountRecharge } from '../services/workbench/cloudAccountRechargeService';
import {
  getCloudAccountSessionState,
  refreshCloudAccountSession,
  signOutCloudAccount,
  subscribeCloudAccountSession
} from '../services/workbench/cloudAccountSessionStore';

import type { RegisteredCommand } from '../services/commands';
import {
  decideShortcutDraftSynchronization,
  hasUnsavedShortcutChanges,
  validateShortcutOverrides
} from '../services/commands';
import type {
  ConfigurationTarget,
  ConfigurationValue,
  WorkbenchConfigurationKey,
  WorkbenchConfigurationSnapshot,
  WorkbenchConfigurationSnapshotItem
} from '../services/configuration';

interface SettingsDialogProps {
  open: boolean;
  snapshot: WorkbenchConfigurationSnapshot | null;
  commands: RegisteredCommand[];
  isDarkMode: boolean;
  loading: boolean;
  error?: string;
  onUpdate: (key: WorkbenchConfigurationKey, value: ConfigurationValue, target: ConfigurationTarget) => Promise<boolean>;
  onReset: (key: WorkbenchConfigurationKey, target: ConfigurationTarget) => Promise<boolean>;
  onClose: () => void;
  onReload: () => Promise<void>;
}

const CATEGORIES = ['编辑器', '工作台', '账号', '更新', '浏览器凭据', '键盘快捷键'] as const;
type SettingsCategory = typeof CATEGORIES[number];

export default function SettingsDialog({
  open,
  snapshot,
  commands,
  isDarkMode,
  loading,
  error,
  onUpdate,
  onReset,
  onClose,
  onReload
}: SettingsDialogProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [category, setCategory] = useState<SettingsCategory>('编辑器');
  const [target, setTarget] = useState<ConfigurationTarget>('user');
  const [query, setQuery] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [shortcutDrafts, setShortcutDrafts] = useState<Record<string, string>>({});
  const [shortcutBaseline, setShortcutBaseline] = useState<Record<string, string>>({});
  const [shortcutErrors, setShortcutErrors] = useState<Record<string, string>>({});
  const syncedShortcutScopeRef = useRef('');

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(frame);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [open]);

  const shortcutSetting = snapshot?.settings.find(item => item.metadata.key === 'keyboard.shortcuts');
  const scopedShortcutValue = target === 'user'
    ? shortcutSetting?.inspection.userValue
    : shortcutSetting?.inspection.workspaceValue;
  const scopedShortcuts = isStringRecord(scopedShortcutValue) ? scopedShortcutValue : {};
  const scopedShortcutSignature = JSON.stringify(
    Object.entries(scopedShortcuts).sort(([left], [right]) => left.localeCompare(right))
  );
  const shortcutsDirty = hasUnsavedShortcutChanges(shortcutDrafts, shortcutBaseline);

  useEffect(() => {
    if (!open) {
      syncedShortcutScopeRef.current = '';
      return;
    }
    const nextScope = `${target}:${scopedShortcutSignature}`;
    const synchronization = decideShortcutDraftSynchronization(
      syncedShortcutScopeRef.current,
      nextScope,
      shortcutsDirty
    );
    if (synchronization === 'none') return;
    if (synchronization === 'replace') {
      setShortcutDrafts(scopedShortcuts);
    } else {
      setLiveMessage('设置文件中的快捷键已变化，已保留当前未保存草稿。');
    }
    setShortcutBaseline(scopedShortcuts);
    setShortcutErrors({});
    syncedShortcutScopeRef.current = nextScope;
  }, [open, scopedShortcutSignature, shortcutsDirty, target]);

  const normalizedQuery = query.trim().toLocaleLowerCase('zh-CN');
  const visibleSettings = useMemo(() => (snapshot?.settings || []).filter(item => {
    if (item.metadata.category !== category || item.metadata.key === 'keyboard.shortcuts') return false;
    if (!normalizedQuery) return true;
    return [item.metadata.title, item.metadata.description, item.metadata.key]
      .some(value => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  }), [category, normalizedQuery, snapshot]);

  const visibleCommands = useMemo(() => commands.filter(command => {
    if (!normalizedQuery) return true;
    return [command.title, command.id, command.category || '', ...command.aliases]
      .some(value => value.toLocaleLowerCase('zh-CN').includes(normalizedQuery));
  }), [commands, normalizedQuery]);

  if (!open) return null;

  const saveSetting = async (key: WorkbenchConfigurationKey, value: ConfigurationValue): Promise<boolean> => {
    setBusyKey(key);
    setLiveMessage(`正在保存“${key}”…`);
    const ok = await onUpdate(key, value, target);
    setLiveMessage(ok ? `已保存到${target === 'workspace' ? '工作区' : '用户'}设置。` : `保存“${key}”失败。`);
    setBusyKey(null);
    return ok;
  };

  const resetSetting = async (key: WorkbenchConfigurationKey): Promise<boolean> => {
    setBusyKey(key);
    const ok = await onReset(key, target);
    setLiveMessage(ok ? '已移除当前作用域覆盖，恢复较低优先级或默认值。' : '恢复默认值失败。');
    setBusyKey(null);
    return ok;
  };

  const saveShortcuts = async () => {
    const validation = validateShortcutOverrides(shortcutDrafts, commands);
    setShortcutErrors(validation.errors);
    if (Object.keys(validation.errors).length > 0) {
      setLiveMessage('快捷键存在错误或冲突，请修正后再保存。');
      return;
    }
    const ok = await saveSetting('keyboard.shortcuts', validation.normalized);
    if (ok) {
      setShortcutDrafts(validation.normalized);
      setShortcutBaseline(validation.normalized);
    }
  };

  const confirmDiscardShortcutChanges = async (): Promise<boolean> => {
    if (!shortcutsDirty) return true;
    const confirmed = await requestWorkbenchConfirm({ title: '放弃未保存的修改？', description: '键盘快捷键还有未保存的修改。确定放弃这些修改吗？', confirmLabel: '放弃修改', cancelLabel: '继续编辑' });
    if (!confirmed) setLiveMessage('快捷键修改尚未保存。');
    return confirmed;
  };

  const requestClose = () => {
    void (async () => {
      if (await confirmDiscardShortcutChanges()) onClose();
    })();
  };

  const changeTarget = (nextTarget: ConfigurationTarget) => {
    if (nextTarget === target) return;
    void (async () => {
      if (!await confirmDiscardShortcutChanges()) return;
      setTarget(nextTarget);
    })();
  };

  const resetShortcutSetting = async () => {
    if (!await confirmDiscardShortcutChanges()) return;
    setShortcutDrafts(shortcutBaseline);
    setShortcutErrors({});
    await resetSetting('keyboard.shortcuts');
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      requestClose();
    } else if (event.key === 'Tab') {
      trapSettingsFocus(event, dialogRef.current);
    }
  };

  const surface = isDarkMode ? 'bg-[#252526] text-slate-100 border-[#454545]' : 'bg-white text-slate-900 border-slate-300';
  const secondarySurface = isDarkMode ? 'bg-[#1e1e1e] border-[#3c3c3c]' : 'bg-slate-50 border-slate-200';
  const muted = isDarkMode ? 'text-slate-400' : 'text-slate-600';
  const field = isDarkMode
    ? 'border-[#555] bg-[#1e1e1e] text-slate-100 focus:border-sky-500'
    : 'border-slate-300 bg-white text-slate-900 focus:border-sky-600';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handleKeyDown}
        className={`flex h-[min(720px,calc(100vh-32px))] w-[min(900px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border shadow-2xl ${surface}`}
      >
        <header className={`flex items-center gap-3 border-b px-4 py-3 ${secondarySurface}`}>
          <Settings className="h-5 w-5 text-sky-500" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-sm font-semibold">设置</h2>
            <p className={`text-[11px] ${muted}`}>用户设置适用于所有工作区；工作区设置优先级更高。</p>
          </div>
          {category === '浏览器凭据' ? (
            <span className={`inline-flex h-8 items-center gap-1.5 rounded border px-2 text-[11px] ${field}`}><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />当前 Windows 用户</span>
          ) : category === '账号' ? (
            <span className={`inline-flex h-8 items-center gap-1.5 rounded border px-2 text-[11px] ${field}`}><UserRound className="h-3.5 w-3.5 text-violet-400" />账号状态保存在登录凭据中</span>
          ) : category === '更新' ? (
            <span className={`inline-flex h-8 items-center gap-1.5 rounded border px-2 text-[11px] ${field}`}>本机用户设置</span>
          ) : (
            <>
              <label htmlFor="settings-target" className={`text-[11px] ${muted}`}>保存到</label>
              <select
                id="settings-target"
                value={target}
                onChange={event => changeTarget(event.target.value as ConfigurationTarget)}
                disabled={busyKey !== null}
                className={`h-8 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${field}`}
              >
                <option value="user">用户</option>
                <option value="workspace">当前工作区</option>
              </select>
            </>
          )}
          <button type="button" onClick={requestClose} aria-label="关闭设置" className={`rounded p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${isDarkMode ? 'hover:bg-[#3a3a3a]' : 'hover:bg-slate-200'}`}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className={`flex items-center gap-2 border-b px-4 py-2 ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
          <Search className={`h-4 w-4 ${muted}`} aria-hidden="true" />
          <label htmlFor="settings-search" className="sr-only">搜索设置</label>
          <input
            ref={searchRef}
            id="settings-search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索设置、命令或快捷键、浏览器凭据"
            className={`h-9 min-w-0 flex-1 rounded border px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${field}`}
          />
          <select
            aria-label="设置分类"
            value={category}
            onChange={event => setCategory(event.target.value as SettingsCategory)}
            className={`h-9 rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 sm:hidden ${field}`}
          >
            {CATEGORIES.map(item => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="flex min-h-0 flex-1">
          <nav aria-label="设置分类" className={`hidden w-44 shrink-0 border-r p-2 sm:block ${secondarySurface}`}>
            {CATEGORIES.map(item => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                aria-current={category === item ? 'page' : undefined}
                className={`mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${category === item ? isDarkMode ? 'bg-[#094771] text-white' : 'bg-sky-100 text-sky-950' : isDarkMode ? 'hover:bg-[#303030]' : 'hover:bg-slate-200'}`}
              >
                {item === '键盘快捷键' ? <Keyboard className="h-4 w-4" aria-hidden="true" /> : item === '浏览器凭据' ? <KeyRound className="h-4 w-4" aria-hidden="true" /> : item === '更新' ? <RefreshCw className="h-4 w-4" aria-hidden="true" /> : item === '账号' ? <UserRound className="h-4 w-4" aria-hidden="true" /> : <Settings className="h-4 w-4" aria-hidden="true" />}
                {item}
              </button>
            ))}
          </nav>

          <section aria-label="设置内容" className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
            {loading && <div role="status" className={`py-12 text-center text-xs ${muted}`}>正在读取用户与工作区设置…</div>}
            {!loading && error && (
              <div role="alert" className={`mb-4 rounded border border-rose-500/50 bg-rose-500/10 p-3 text-xs ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>
                <p>{error}</p>
                <button type="button" onClick={() => void onReload()} className="mt-2 rounded bg-rose-600 px-3 py-1.5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300">重试</button>
              </div>
            )}
            {snapshot?.diagnostics.map((diagnostic, index) => (
              <div key={`${diagnostic.code}-${index}`} className={`mb-3 rounded border border-amber-500/40 bg-amber-500/10 p-3 text-xs ${isDarkMode ? 'text-amber-300' : 'text-amber-800'}`}>
                {diagnostic.message}
              </div>
            ))}

            {!loading && category !== '键盘快捷键' && category !== '浏览器凭据' && category !== '更新' && category !== '账号' && (
              <div className="space-y-3">
                {visibleSettings.length === 0 ? (
                  <div className={`py-12 text-center text-xs ${muted}`}>没有匹配的设置。</div>
                ) : visibleSettings.map(item => (
                  <React.Fragment key={item.metadata.key}>
                    <SettingRow
                      item={item}
                      target={target}
                      busy={busyKey === item.metadata.key}
                      isDarkMode={isDarkMode}
                      fieldClass={field}
                      mutedClass={muted}
                      onSave={value => void saveSetting(item.metadata.key, value)}
                      onReset={() => void resetSetting(item.metadata.key)}
                    />
                  </React.Fragment>
                ))}
              </div>
            )}

            {!loading && category === '浏览器凭据' && (
              <FbroVipCredentialSetting isDarkMode={isDarkMode} fieldClass={field} mutedClass={muted} />
            )}

            {!loading && category === '更新' && (
              <UpdatesSetting
                snapshot={snapshot}
                isDarkMode={isDarkMode}
                fieldClass={field}
                mutedClass={muted}
                onUpdate={onUpdate}
                onReset={onReset}
              />
            )}

            {!loading && category === '账号' && (
              <AccountSettings isDarkMode={isDarkMode} fieldClass={field} mutedClass={muted} />
            )}

            {!loading && category === '键盘快捷键' && (
              <section aria-labelledby="shortcut-heading">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 id="shortcut-heading" className="text-sm font-semibold">键盘快捷键</h3>
                    <p className={`mt-1 text-[11px] ${muted}`}>输入单段快捷键，例如 Ctrl+Shift+P。空值表示使用命令默认绑定。</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void resetShortcutSetting()} disabled={busyKey !== null} className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50 ${field}`}>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />恢复当前作用域默认
                    </button>
                    <button type="button" onClick={() => void saveShortcuts()} disabled={busyKey !== null} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:opacity-50">保存快捷键</button>
                  </div>
                </div>
                <div className={`overflow-hidden rounded border ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
                  {visibleCommands.map(command => (
                    <div key={command.id} className={`grid gap-2 border-b p-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_220px] ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
                      <div className="min-w-0">
                        <label htmlFor={`shortcut-${safeId(command.id)}`} className="block truncate text-xs font-medium">{command.title}</label>
                        <div className={`truncate font-mono text-[10px] ${muted}`}>{command.id}</div>
                        <div className={`text-[10px] ${muted}`}>默认：{command.keybindings[0] || '未绑定'}</div>
                      </div>
                      <div>
                        <input
                          id={`shortcut-${safeId(command.id)}`}
                          value={shortcutDrafts[command.id] || ''}
                          onChange={event => {
                            setShortcutDrafts(previous => ({ ...previous, [command.id]: event.target.value }));
                            setShortcutErrors({});
                          }}
                          aria-invalid={Boolean(shortcutErrors[command.id])}
                          aria-describedby={shortcutErrors[command.id] ? `shortcut-error-${safeId(command.id)}` : undefined}
                          placeholder={command.keybindings[0] || '未绑定'}
                          className={`h-9 w-full rounded border px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${field}`}
                        />
                        {shortcutErrors[command.id] && <p id={`shortcut-error-${safeId(command.id)}`} role="alert" className={`mt-1 text-[10px] ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>{shortcutErrors[command.id]}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </section>
        </div>

        <footer className={`flex min-h-10 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-[11px] ${secondarySurface}`}>
          <span className="min-w-0 flex-1" aria-live="polite" aria-atomic="true">{liveMessage}</span>
          <span className={shortcutsDirty ? (isDarkMode ? 'text-amber-300' : 'text-amber-800') : ''}>{shortcutsDirty ? '快捷键有未保存修改' : ''}</span>
          <button type="button" onClick={requestClose} className="rounded bg-sky-700 px-4 py-1.5 font-medium text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">关闭</button>
        </footer>
      </div>
    </div>
  );
}

interface UpdatesEntitlement {
  ok: boolean;
  authenticated?: boolean;
  enrolled: boolean;
  status?: string | null;
  validUntil?: string | null;
  previewSuspended: boolean;
  application: { status: string; rejectReason: string; updatedAt?: string } | null;
}

/** 「更新」设置分区：自动检查开关、体验计划资格卡片与预览渠道开关。 */
function UpdatesSetting({
  snapshot,
  isDarkMode,
  fieldClass,
  mutedClass,
  onUpdate,
  onReset
}: {
  snapshot: WorkbenchConfigurationSnapshot | null;
  isDarkMode: boolean;
  fieldClass: string;
  mutedClass: string;
  onUpdate: (key: WorkbenchConfigurationKey, value: ConfigurationValue, target: ConfigurationTarget) => Promise<boolean>;
  onReset: (key: WorkbenchConfigurationKey, target: ConfigurationTarget) => Promise<boolean>;
}) {
  const readValue = (key: WorkbenchConfigurationKey): ConfigurationValue | undefined =>
    snapshot?.settings.find(item => item.metadata.key === key)?.inspection.value;
  const autoCheck = typeof readValue('updates.autoCheck') === 'boolean' ? Boolean(readValue('updates.autoCheck')) : true;
  const experienceChannel = Boolean(readValue('updates.experienceChannel'));
  const skippedVersion = typeof readValue('updates.skippedVersion') === 'string' ? String(readValue('updates.skippedVersion')) : '';
  const betaApi = window.lingBuilder?.betaProgram;
  const [entitlement, setEntitlement] = useState<UpdatesEntitlement | null>(null);
  const [betaMessage, setBetaMessage] = useState('正在读取体验计划状态…');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    if (!betaApi?.status) { setBetaMessage('当前运行方式不支持体验计划状态查询；请在 Electron 桌面版中使用。'); return; }
    try {
      const value = await betaApi.status();
      setEntitlement(value);
      setBetaMessage(value.authenticated === false ? '尚未登录 LingBuilder 账号；登录后可申请加入体验计划。' : '');
    } catch (error) {
      setBetaMessage(`读取体验计划状态失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const applyForBetaProgram = async () => {
    setBusy(true);
    try {
      await betaApi?.apply?.('');
      setBetaMessage('报名申请已提交，等待管理员审核。');
      await refresh();
    } catch (error) {
      setBetaMessage(`提交申请失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  };

  const cancelBetaApplication = async () => {
    if (!await requestWorkbenchConfirm({ title: '撤回报名申请？', description: '确定撤回体验计划的报名申请吗？撤回后可重新申请。', confirmLabel: '撤回申请', cancelLabel: '继续等待' })) return;
    setBusy(true);
    try {
      await betaApi?.cancelApplication?.();
      setBetaMessage('已撤回报名申请。');
      await refresh();
    } catch (error) {
      setBetaMessage(`撤回申请失败：${error instanceof Error ? error.message : String(error)}`);
    } finally { setBusy(false); }
  };

  const applicationStatus = entitlement?.application?.status;
  const applicationLabel = applicationStatus === 'PENDING' ? '审核中'
    : applicationStatus === 'REJECTED' ? '未通过'
    : applicationStatus === 'CANCELLED' ? '已撤回'
    : applicationStatus === 'APPROVED' ? '已通过' : '';

  return (
    <div className="space-y-3">
      <section className={`rounded border p-4 ${isDarkMode ? 'border-[#3c3c3c] bg-[#202020]' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">自动检查更新</p>
            <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>启动及运行期间自动联网检查稳定版更新；关闭后可在「帮助 → 检查更新」手动检查。</p>
          </div>
          <button type="button" onClick={() => void onReset('updates.autoCheck', 'user')} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] ${isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-slate-100'}`}>
            <RotateCcw className="h-3 w-3" aria-hidden="true" />恢复默认
          </button>
        </div>
        <label className="mt-3 inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs">
          <input type="checkbox" checked={autoCheck} onChange={event => void onUpdate('updates.autoCheck', event.target.checked, 'user')} className="h-4 w-4 accent-sky-600" />
          {autoCheck ? '已开启（推荐）' : '已关闭'}
        </label>
      </section>

      <section className={`rounded border p-4 ${isDarkMode ? 'border-[#3c3c3c] bg-[#202020]' : 'border-slate-200 bg-white'}`}>
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDarkMode ? 'bg-sky-500/10 text-sky-400' : 'bg-sky-100 text-sky-700'}`}><RefreshCw className="h-4.5 w-4.5" aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold">体验计划（预览渠道）</p>
              {entitlement && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${entitlement.enrolled ? (isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700') : (isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-800')}`}>{entitlement.enrolled ? '已加入' : applicationStatus === 'PENDING' ? '审核中' : '未加入'}</span>}
              {entitlement?.previewSuspended && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>云端已暂停预览推送</span>}
            </div>
            <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>
              预览版发布频繁、可第一时间体验新功能，但可能不稳定；建议先备份项目数据。
              {entitlement?.validUntil && <>资格有效期至 {new Date(entitlement.validUntil).toLocaleDateString('zh-CN')}。</>}
              {applicationStatus === 'REJECTED' && entitlement?.application?.rejectReason && <>（未通过原因：{entitlement.application.rejectReason}）</>}
            </p>
            {betaMessage && <p role="status" className={`mt-2 text-[11px] leading-5 ${betaMessage.includes('失败') ? isDarkMode ? 'text-rose-300' : 'text-rose-700' : mutedClass}`}>{betaMessage}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {entitlement?.authenticated === false && (
                <button type="button" onClick={() => void requestCloudAccountLogin({ description: '登录后可申请加入体验计划并接收预览版更新。' })} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600">登录 LingBuilder 账号</button>
              )}
              {entitlement && !entitlement.enrolled && entitlement.authenticated !== false && applicationStatus !== 'PENDING' && (
                <button type="button" disabled={busy} onClick={() => void applyForBetaProgram()} className="rounded bg-sky-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-600 disabled:opacity-50">{applicationStatus === 'REJECTED' || applicationStatus === 'CANCELLED' ? '重新申请' : '申请加入体验计划'}</button>
              )}
              {applicationStatus === 'PENDING' && (
                <button type="button" disabled={busy} onClick={() => void cancelBetaApplication()} className={`rounded border px-3 py-1.5 text-xs disabled:opacity-50 ${fieldClass}`}>撤回报名申请</button>
              )}
            </div>
          </div>
        </div>
        <div className={`mt-3 border-t pt-3 ${isDarkMode ? 'border-[#3c3c3c]' : 'border-slate-200'}`}>
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={experienceChannel}
              onChange={event => void onUpdate('updates.experienceChannel', event.target.checked, 'user')}
              disabled={busy}
              className="h-4 w-4 accent-sky-600"
            />
            接收预览版更新（抢先体验）
          </label>
          <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>
            开关只作用于本机：需已加入体验计划并保持登录，云端会校验资格，无资格时自动回落稳定渠道。
          </p>
        </div>
      </section>

      <section className={`rounded border p-4 ${isDarkMode ? 'border-[#3c3c3c] bg-[#202020]' : 'border-slate-200 bg-white'}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold">已跳过的稳定版</p>
            <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>{skippedVersion ? `当前跳过 ${skippedVersion}：该版本不再弹窗，仅保留标题栏徽标；更新到更新版本后自动恢复提示。` : '尚未跳过任何版本。在稳定版更新提示中选择「跳过此版本」时记录。'}</p>
          </div>
          {skippedVersion && (
            <button type="button" onClick={() => void onReset('updates.skippedVersion', 'user')} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] ${isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-slate-100'}`}>
              <RotateCcw className="h-3 w-3" aria-hidden="true" />取消跳过
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

/**
 * 设置 → 账号：登录态、点数与登录/注册/充值/退出入口。
 *
 * 表单一律走顶层 cloudAccountLoginService / cloudAccountRechargeService，本页只呈现状态，
 * 不再复制一份邮箱密码输入，避免与标题栏、AI 面板的登录态漂移。
 */
function AccountSettings({ isDarkMode, fieldClass, mutedClass }: { isDarkMode: boolean; fieldClass: string; mutedClass: string }) {
  const [session, setSession] = useState(getCloudAccountSessionState);
  useEffect(() => subscribeCloudAccountSession(() => setSession(getCloudAccountSessionState())), []);
  useEffect(() => { void refreshCloudAccountSession(); }, []);

  const actionClass = `rounded border px-3 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${fieldClass}`;

  return (
    <section aria-label="LingBuilder 账号" className={`rounded border p-4 ${isDarkMode ? 'border-[#3c3c3c] bg-[#202020]' : 'border-slate-200 bg-white'}`}>
      <h3 className="text-sm font-semibold">LingBuilder 账号</h3>
      <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>
        同一账号用于系统 AI 点数、收费模块权益与体验计划；本地编辑、构建与 Visual Studio 工程导出无需登录。
      </p>

      {session.authenticated ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5" title={session.email}>
              <UserRound className="h-3.5 w-3.5 text-violet-400" aria-hidden="true" />
              <span className="max-w-[22rem] truncate">{session.email}</span>
            </span>
            <span>可用点数 <strong className="tabular-nums">{session.balance?.available || '0'}</strong></span>
            {session.balance?.reserved && session.balance.reserved !== '0' && (
              <span className={mutedClass}>冻结 <strong className="tabular-nums">{session.balance.reserved}</strong></span>
            )}
          </div>
          {session.error && <p role="alert" className={`mt-2 text-[11px] ${isDarkMode ? 'text-rose-300' : 'text-rose-700'}`}>{session.error}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void requestCloudAccountRecharge()} className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-500">充值点数</button>
            <button type="button" onClick={() => void signOutCloudAccount()} className={actionClass}>退出登录</button>
          </div>
        </>
      ) : (
        <>
          <p className={`mt-3 text-xs ${mutedClass}`}>{session.error || '当前未登录 LingBuilder 账号。'}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void requestCloudAccountLogin({ initialMode: 'login' })} className="rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500">登录</button>
            <button type="button" onClick={() => void requestCloudAccountLogin({ initialMode: 'register' })} className={actionClass}>注册账号</button>
            <button type="button" onClick={() => void requestCloudAccountLogin({ initialMode: 'reset' })} className={actionClass}>忘记密码</button>
          </div>
        </>
      )}
    </section>
  );
}

function FbroVipCredentialSetting({ isDarkMode, fieldClass, mutedClass }: { isDarkMode: boolean; fieldClass: string; mutedClass: string }) {
  const [status, setStatus] = useState<{ configured: boolean; source: 'secure-storage' | 'environment' | 'none' } | null>(null);
  const [draft, setDraft] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('正在读取 FBro VIP Key 状态…');
  const credentials = window.lingBuilder?.credentials;

  const refresh = async () => {
    if (!credentials?.getFbroVipKeyStatus) {
      setStatus({ configured: false, source: 'none' });
      setMessage('当前运行方式不支持系统安全凭据；请在 Electron 桌面版中设置。');
      return;
    }
    try {
      const next = await credentials.getFbroVipKeyStatus();
      setStatus(next);
      setMessage(next.configured
        ? next.source === 'secure-storage' ? '已为当前 Windows 用户配置安全凭据。' : '当前使用启动环境提供的 VIP Key。'
        : '尚未配置；基础浏览器仍可使用，VIP 指纹命令会返回明确诊断。');
    } catch (error) {
      setMessage(`读取凭据状态失败：${error instanceof Error ? error.message : String(error)}`);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const save = async () => {
    const value = draft.trim();
    if (!value || !credentials?.setFbroVipKey) return;
    setBusy(true);
    try {
      const next = await credentials.setFbroVipKey(value);
      setStatus(next);
      setDraft('');
      setShowValue(false);
      setMessage('FBro VIP Key 已加密保存；下一次 F5/运行立即使用，已经运行的 AI Bridge 需停止后重新启动。');
    } catch (error) {
      setMessage(`保存 FBro VIP Key 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!credentials?.deleteFbroVipKey || !await requestWorkbenchConfirm({ title: '清除 FBro VIP Key', description: '确定清除当前用户保存的 FBro VIP Key 吗？项目文件不会受到影响。', confirmLabel: '清除', cancelLabel: '取消' })) return;
    setBusy(true);
    try {
      const next = await credentials.deleteFbroVipKey();
      setStatus(next);
      setDraft('');
      setMessage(next.configured ? '用户凭据已清除，已恢复使用启动环境中的 VIP Key。' : '当前用户的 FBro VIP Key 已清除。');
    } catch (error) {
      setMessage(`清除 FBro VIP Key 失败：${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="fbro-vip-key-heading" className={`overflow-hidden rounded-lg border ${isDarkMode ? 'border-[#3c3c3c] bg-[#1e1e1e]' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-start gap-3 border-b border-inherit p-4">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'}`}><KeyRound className="h-4.5 w-4.5" /></span>
        <div className="min-w-0 flex-1">
          <h3 id="fbro-vip-key-heading" className="text-sm font-semibold">FBro VIP Key</h3>
          <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>由使用本 IDE 的开发者自行设置。Key 使用系统安全凭据加密，只在启动 FBro 程序时临时注入，不写入项目、源码、日志、AI 上下文或设置同步包。</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ${status?.configured ? isDarkMode ? 'bg-emerald-500/10 text-emerald-300' : 'bg-emerald-100 text-emerald-700' : isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-100 text-amber-800'}`}>{status?.configured ? '已配置' : '未配置'}</span>
      </div>
      <div className="space-y-3 p-4">
        <label htmlFor="fbro-vip-key-input" className="block text-xs font-medium">设置新的 VIP Key</label>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <input id="fbro-vip-key-input" type={showValue ? 'text' : 'password'} autoComplete="new-password" maxLength={4096} value={draft} onChange={event => setDraft(event.target.value)} placeholder="输入 Key；已保存的值不会明文回显" className={`h-9 w-full rounded border px-3 pr-9 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${fieldClass}`} />
            <button type="button" onClick={() => setShowValue(value => !value)} aria-label={showValue ? '隐藏正在输入的 VIP Key' : '显示正在输入的 VIP Key'} className="absolute right-1 top-1 rounded p-1.5 text-slate-500 hover:text-sky-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
          </div>
          <button type="button" disabled={busy || !draft.trim()} onClick={() => void save()} className="rounded bg-sky-700 px-4 text-xs font-medium text-white hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 disabled:cursor-not-allowed disabled:opacity-50">保存</button>
          <button type="button" disabled={busy || status?.source !== 'secure-storage'} onClick={() => void remove()} className={`inline-flex items-center gap-1.5 rounded border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40 ${fieldClass}`}><Trash2 className="h-3.5 w-3.5" />清除</button>
        </div>
        <p role="status" aria-live="polite" className={`text-[11px] ${message.includes('失败') || message.includes('不支持') ? isDarkMode ? 'text-rose-300' : 'text-rose-700' : mutedClass}`}>{message}</p>
      </div>
    </section>
  );
}

function SettingRow({
  item,
  target,
  busy,
  isDarkMode,
  fieldClass,
  mutedClass,
  onSave,
  onReset
}: {
  item: WorkbenchConfigurationSnapshotItem;
  target: ConfigurationTarget;
  busy: boolean;
  isDarkMode: boolean;
  fieldClass: string;
  mutedClass: string;
  onSave: (value: ConfigurationValue) => void;
  onReset: () => void;
}) {
  const scopedValue = target === 'user' ? item.inspection.userValue : item.inspection.workspaceValue;
  const inherited = scopedValue === undefined;
  const value = inherited ? item.inspection.value : scopedValue;
  const inputId = `setting-${safeId(item.metadata.key)}-${target}`;
  const sourceLabel = inherited
    ? `继承自${item.inspection.source === 'workspace' ? '工作区' : item.inspection.source === 'user' ? '用户' : '默认值'}`
    : target === 'workspace' ? '工作区覆盖' : '用户覆盖';

  return (
    <section className={`rounded border p-4 ${isDarkMode ? 'border-[#3c3c3c] bg-[#202020]' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="text-xs font-semibold">{item.metadata.title}</label>
          <p className={`mt-1 text-[11px] leading-5 ${mutedClass}`}>{item.metadata.description}</p>
          <p className={`mt-1 font-mono text-[10px] ${mutedClass}`}>{item.metadata.key} · {sourceLabel}</p>
        </div>
        <button type="button" onClick={onReset} disabled={busy || inherited} className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-40 ${isDarkMode ? 'hover:bg-[#333]' : 'hover:bg-slate-100'}`}>
          <RotateCcw className="h-3 w-3" aria-hidden="true" />恢复默认
        </button>
      </div>
      <div className="mt-3 max-w-sm">
        {typeof item.inspection.defaultValue === 'boolean' ? (
          <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-xs">
            <input id={inputId} type="checkbox" checked={Boolean(value)} disabled={busy} onChange={event => onSave(event.target.checked)} className="h-4 w-4 accent-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500" />
            {Boolean(value) ? '显示' : '隐藏'}
          </label>
        ) : item.metadata.enumOptions ? (
          <select id={inputId} value={String(value)} disabled={busy} onChange={event => onSave(event.target.value)} className={`h-9 w-full rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${fieldClass}`}>
            {item.metadata.enumOptions.map(option => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}
          </select>
        ) : (
          <input id={inputId} type="number" min={item.metadata.minimum} max={item.metadata.maximum} value={Number(value)} disabled={busy} onChange={event => { const next = Number.parseInt(event.target.value, 10); if (Number.isFinite(next)) onSave(next); }} className={`h-9 w-full rounded border px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${fieldClass}`} />
        )}
      </div>
    </section>
  );
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.values(value as Record<string, unknown>).every(item => typeof item === 'string');
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/gu, '-');
}

function trapSettingsFocus(event: React.KeyboardEvent, container: HTMLElement | null): void {
  if (!container) return;
  const focusable = [...container.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
  if (focusable.length === 0) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}
