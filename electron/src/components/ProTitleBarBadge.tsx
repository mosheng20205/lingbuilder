import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { getCloudAccountSessionState, subscribeCloudAccountSession, type CloudProStatus } from '../services/workbench/cloudAccountSessionStore';

function formatProExpiry(endsAt?: string | null): string {
  if (!endsAt) return '';
  const date = new Date(endsAt);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN') : '';
}

/**
 * 标题栏 Pro 会员徽标：登录且 Pro 生效时常驻显示，点击直达 设置 → 账号 查看权益详情。
 * 未登录或非 Pro 不渲染；状态来自全局账号会话源（cloudAccountSessionStore），不另建副本。
 */
export default function ProTitleBarBadge({ onOpen, isDarkMode }: { onOpen: () => void; isDarkMode: boolean }) {
  const [pro, setPro] = useState<CloudProStatus | null | undefined>(getCloudAccountSessionState().pro);

  useEffect(() => subscribeCloudAccountSession(() => setPro(getCloudAccountSessionState().pro)), []);

  if (!pro) return null;
  const perpetual = pro.tier === 'perpetual';
  const expiry = formatProExpiry(pro.endsAt);
  return (
    <button
      type="button"
      onClick={event => { event.stopPropagation(); onOpen(); }}
      onDoubleClick={event => event.stopPropagation()}
      aria-label={perpetual ? 'Pro 会员（永久买断），点击打开账号设置查看权益' : `Pro 会员，${expiry}到期，点击打开账号设置查看权益`}
      title={perpetual
        ? 'Pro 会员 · 永久买断\n生效期内可使用全部收费模块，点击查看账号与权益'
        : `Pro 会员 · ${expiry}到期\n生效期内可使用全部收费模块，点击查看账号与权益`}
      className={`window-no-drag flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ring-1 transition-colors ${
        isDarkMode
          ? 'bg-amber-400/15 text-amber-300 ring-amber-400/40 hover:bg-amber-400/30'
          : 'bg-amber-500/15 text-amber-600 ring-amber-500/40 hover:bg-amber-500/30'
      }`}
    >
      <Crown className="h-3 w-3" aria-hidden="true" />
      {perpetual ? 'Pro' : `Pro·${expiry}`}
    </button>
  );
}
