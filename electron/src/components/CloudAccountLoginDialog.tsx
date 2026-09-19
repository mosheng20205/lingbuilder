import React, { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { CloudAccountLoginResult } from '../services/workbench/cloudAccountLoginService';
import { applyCloudAccountSignedIn } from '../services/workbench/cloudAccountSessionStore';

export interface CloudAccountLoginDialogProps {
  open: boolean;
  title?: string;
  description?: string;
  /** 打开形态：默认登录；'register' 直接注册；'reset' 直接进入「忘记密码」重置流程。 */
  initialMode?: 'login' | 'register' | 'reset';
  isDarkMode: boolean;
  onResult: (result: CloudAccountLoginResult) => void;
}

type DialogMode = 'login' | 'register' | 'reset-email' | 'reset-token';

const PASSWORD_RULE = '密码需要 10 至 128 位，并同时包含字母和数字。';

function validateNewPassword(value: string): string {
  if (value.length < 10 || value.length > 128 || !/[A-Za-z]/u.test(value) || !/\d/u.test(value)) return PASSWORD_RULE;
  return '';
}

function initialDialogMode(initialMode: CloudAccountLoginDialogProps['initialMode']): DialogMode {
  if (initialMode === 'reset') return 'reset-email';
  if (initialMode === 'register') return 'register';
  return 'login';
}

/**
 * 工作台顶层的 LingBuilder 账号登录 / 注册 / 找回密码对话框。
 *
 * 由 cloudAccountLoginService 驱动，是全 IDE 唯一的账号表单：标题栏、欢迎页、设置页、
 * 收费模块门禁与 AI 面板都通过它完成登录注册，登录成功后写入 cloudAccountSessionStore。
 * 「忘记密码」走两步重置（与云端契约一致）：先发邮箱令牌（30 分钟有效），
 * 再粘贴令牌 + 新密码；重置成功后回到登录态，不结算弹窗。
 * 注册成功后不自动登录（云端要求邮箱验证），只带着邮箱回到登录表单。
 */
export default function CloudAccountLoginDialog({
  open,
  title,
  description,
  initialMode = 'login',
  isDarkMode,
  onResult
}: CloudAccountLoginDialogProps) {
  const [mode, setMode] = useState<DialogMode>(() => initialDialogMode(initialMode));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialDialogMode(initialMode));
    setEmail('');
    setPassword('');
    setResetToken('');
    setNewPassword('');
    setError('');
    setInfo('');
    setIsBusy(false);
    const frame = window.requestAnimationFrame(() => firstFieldRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open, initialMode]);

  if (!open) return null;

  const switchMode = (next: DialogMode) => {
    setMode(next);
    setError('');
    setInfo('');
    window.requestAnimationFrame(() => firstFieldRef.current?.focus());
  };

  const submitLogin = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !password) {
      setError('请输入账号邮箱和密码。');
      return;
    }
    if (!window.lingBuilder?.cloudAccount?.login) {
      setError('当前运行环境不支持 LingBuilder 账号登录，请使用 LingBuilder 桌面版。');
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      const session = await window.lingBuilder.cloudAccount.login({ email: normalizedEmail, password });
      if (!session?.authenticated) throw new Error('登录失败，请确认邮箱和密码后重试。');
      setPassword('');
      applyCloudAccountSignedIn(session.email, session.balance);
      onResult({ authenticated: true, email: session.email });
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : String(loginError));
      setIsBusy(false);
    }
  };

  const submitRegister = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('请输入用于注册的邮箱。');
      return;
    }
    const passwordError = validateNewPassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!window.lingBuilder?.cloudAccount?.register) {
      setError('当前运行环境不支持 LingBuilder 账号注册，请使用 LingBuilder 桌面版。');
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      await window.lingBuilder.cloudAccount.register({ email: normalizedEmail, password });
      setPassword('');
      setMode('login');
      setInfo('注册成功，请先到邮箱完成验证，再用该邮箱登录。');
    } catch (registerError) {
      setError(registerError instanceof Error ? registerError.message : String(registerError));
    } finally {
      setIsBusy(false);
    }
  };

  const submitForgotSend = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError('请输入注册时使用的账号邮箱。');
      return;
    }
    if (!window.lingBuilder?.cloudAccount?.forgotPassword) {
      setError('当前运行环境不支持找回密码，请在 LingBuilder 桌面版中重试。');
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      await window.lingBuilder.cloudAccount.forgotPassword({ email: normalizedEmail });
      setMode('reset-token');
      setError('');
      setInfo('如果该邮箱已注册，重置令牌邮件已发送（30 分钟内有效）。请打开邮箱复制令牌填入下方。');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : String(sendError));
    } finally {
      setIsBusy(false);
    }
  };

  const submitReset = async () => {
    const token = resetToken.trim();
    if (!token) {
      setError('请粘贴邮件中的重置令牌。');
      return;
    }
    const passwordError = validateNewPassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (!window.lingBuilder?.cloudAccount?.resetPassword) {
      setError('当前运行环境不支持找回密码，请在 LingBuilder 桌面版中重试。');
      return;
    }
    setIsBusy(true);
    setError('');
    try {
      await window.lingBuilder.cloudAccount.resetPassword({ token, password: newPassword });
      setPassword('');
      setResetToken('');
      setNewPassword('');
      setMode('login');
      setInfo('密码已重置，其他设备与本机的登录状态均已注销，请用新密码登录。');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : String(resetError));
    } finally {
      setIsBusy(false);
    }
  };

  const cancel = () => {
    if (isBusy) return;
    onResult({ authenticated: false, cancelled: true });
  };

  const submitCurrent = () => {
    if (isBusy) return;
    if (mode === 'login') void submitLogin();
    else if (mode === 'register') void submitRegister();
    else if (mode === 'reset-email') void submitForgotSend();
    else void submitReset();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.stopPropagation();
      submitCurrent();
    }
  };

  const inputClass = `w-full rounded border px-3 py-2 text-xs outline-none focus:border-blue-500 ${
    isDarkMode
      ? 'border-[#414149] bg-[#25252c] text-slate-100'
      : 'border-slate-300 bg-white text-slate-900'
  }`;
  const linkClass = `cursor-pointer underline-offset-2 hover:underline ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`;
  const isResetMode = mode === 'reset-email' || mode === 'reset-token';
  const heading = mode === 'login'
    ? (title || '登录 LingBuilder 账号')
    : mode === 'register'
      ? '注册 LingBuilder 账号'
      : '重置 LingBuilder 密码';

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cloud-account-login-dialog-title"
      onKeyDown={handleKeyDown}
    >
      <div
        className={`w-full max-w-sm rounded-lg border shadow-2xl ${
          isDarkMode
            ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <div className={`border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 id="cloud-account-login-dialog-title" className="text-sm font-semibold">{heading}</h2>
          {description && !isResetMode && (
            <p className={`mt-1 text-[11px] leading-5 whitespace-pre-line ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {description}
            </p>
          )}
          {isResetMode && (
            <p className={`mt-1 text-[11px] leading-5 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              {mode === 'reset-email' ? '第 1 步 / 共 2 步：向注册邮箱发送重置令牌。' : '第 2 步 / 共 2 步：粘贴邮件中的令牌并设置新密码。'}
            </p>
          )}
        </div>
        <div className="space-y-3 px-4 pt-3">
          {(mode === 'login' || mode === 'register' || mode === 'reset-email') && (
            <div>
              <label htmlFor="cloud-account-login-email" className="mb-1.5 block text-xs font-medium">账号邮箱</label>
              <input
                ref={firstFieldRef}
                id="cloud-account-login-email"
                type="email"
                autoComplete={mode === 'register' ? 'new-password' : 'username'}
                value={email}
                onChange={event => setEmail(event.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
          )}
          {(mode === 'login' || mode === 'register') && (
            <div>
              <label htmlFor="cloud-account-login-password" className="mb-1.5 block text-xs font-medium">密码</label>
              <input
                id="cloud-account-login-password"
                type="password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                value={password}
                onChange={event => setPassword(event.target.value)}
                className={inputClass}
                placeholder={mode === 'register' ? '10 至 128 位，包含字母和数字' : '登录密码'}
              />
            </div>
          )}
          {mode === 'reset-token' && (
            <>
              <div>
                <label htmlFor="cloud-account-reset-token" className="mb-1.5 block text-xs font-medium">重置令牌</label>
                <input
                  ref={firstFieldRef}
                  id="cloud-account-reset-token"
                  value={resetToken}
                  onChange={event => setResetToken(event.target.value)}
                  className={inputClass}
                  placeholder="粘贴邮件中的重置令牌"
                  spellCheck={false}
                />
              </div>
              <div>
                <label htmlFor="cloud-account-new-password" className="mb-1.5 block text-xs font-medium">新密码</label>
                <input
                  id="cloud-account-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={event => setNewPassword(event.target.value)}
                  className={inputClass}
                  placeholder="10 至 128 位，包含字母和数字"
                />
              </div>
            </>
          )}
          {info && (
            <p role="status" className={`text-[11px] leading-4 ${isDarkMode ? 'text-emerald-300' : 'text-emerald-700'}`}>{info}</p>
          )}
          {error && (
            <p role="alert" className={`text-[11px] leading-4 ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
          )}
          <p className={`text-[10px] leading-4 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
            {mode === 'login'
              ? '注册后需在邮箱中完成验证；点数与收费模块权益均绑定该账号。'
              : mode === 'register'
                ? '注册后需在邮箱中完成验证，验证通过才能登录。'
                : '重置成功后该账号在所有设备上的登录状态都会被注销。'}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-3 text-[11px]">
            {mode === 'login' && (
              <>
                <button type="button" onClick={() => switchMode('register')} className={linkClass}>注册新账号</button>
                <button type="button" onClick={() => switchMode('reset-email')} className={linkClass}>忘记密码？</button>
              </>
            )}
            {mode !== 'login' && (
              <button type="button" onClick={() => switchMode('login')} className={linkClass}>返回登录</button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancel}
              disabled={isBusy}
              className={`cursor-pointer rounded border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                isDarkMode
                  ? 'border-[#484850] text-slate-300 hover:bg-[#303038] hover:text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              取消
            </button>
            <button
              type="button"
              onClick={submitCurrent}
              disabled={isBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
              {mode === 'login'
                ? (isBusy ? '登录中…' : '登录')
                : mode === 'register'
                  ? (isBusy ? '注册中…' : '注册')
                  : mode === 'reset-email'
                    ? (isBusy ? '发送中…' : '发送重置邮件')
                    : (isBusy ? '重置中…' : '重置密码')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
