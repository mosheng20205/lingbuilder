import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';
import { getCloudAccountSessionState, subscribeCloudAccountSession } from '../services/workbench/cloudAccountSessionStore';
import { requestCloudAccountLogin } from '../services/workbench/cloudAccountLoginService';

/**
 * 标题栏账号入口：未登录显示「登录 / 注册」，点击经 cloudAccountLoginService 打开唯一的
 * 登录 / 注册 / 找回密码对话框；已登录显示账号邮箱，点击直达 设置 → 账号 管理账号与退出登录。
 * 登录态来自全局账号会话源（cloudAccountSessionStore），不另建副本。
 */
export default function AccountTitleBarEntry({ onOpenAccountSettings, isDarkMode }: { onOpenAccountSettings: () => void; isDarkMode: boolean }) {
  const [session, setSession] = useState(getCloudAccountSessionState());

  useEffect(() => subscribeCloudAccountSession(() => setSession(getCloudAccountSessionState())), []);

  const pillClass = `window-no-drag flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ring-1 transition-colors ${
    isDarkMode
      ? 'bg-slate-400/10 text-slate-300 ring-slate-400/30 hover:bg-slate-400/25'
      : 'bg-slate-500/10 text-slate-600 ring-slate-500/30 hover:bg-slate-500/20'
  }`;

  if (!session.authenticated) {
    return (
      <button
        type="button"
        onClick={event => { event.stopPropagation(); void requestCloudAccountLogin({ initialMode: 'login' }); }}
        onDoubleClick={event => event.stopPropagation()}
        aria-label="登录或注册 LingBuilder 账号"
        title="登录 / 注册 LingBuilder 账号"
        className={pillClass}
      >
        <UserRound className="h-3 w-3" aria-hidden="true" />
        登录 / 注册
      </button>
    );
  }

  const email = session.email?.trim() || '已登录';
  return (
    <button
      type="button"
      onClick={event => { event.stopPropagation(); onOpenAccountSettings(); }}
      onDoubleClick={event => event.stopPropagation()}
      aria-label={`已登录 ${email}，点击打开账号设置`}
      title={`已登录：${email}\n点击打开 设置 → 账号 管理账号与退出登录`}
      className={pillClass}
    >
      <UserRound className="h-3 w-3" aria-hidden="true" />
      <span className="max-w-[180px] truncate">{email}</span>
    </button>
  );
}
