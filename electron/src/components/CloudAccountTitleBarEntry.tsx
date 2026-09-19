import React, { useEffect, useRef, useState } from 'react';
import { Coins, LogOut, UserRound, Wallet } from 'lucide-react';
import { requestCloudAccountLogin } from '../services/workbench/cloudAccountLoginService';
import { requestCloudAccountRecharge } from '../services/workbench/cloudAccountRechargeService';
import {
  getCloudAccountSessionState,
  refreshCloudAccountSession,
  signOutCloudAccount,
  subscribeCloudAccountSession
} from '../services/workbench/cloudAccountSessionStore';

/**
 * 标题栏常驻账号入口：未登录显示「登录」，已登录显示点数，点击展开账号菜单。
 *
 * 登录/注册一律走 cloudAccountLoginService（全 IDE 唯一表单），本组件不再内联任何表单，
 * 否则又会退回「注册只藏在 AI 面板二级折叠里」的老问题。
 * 非桌面版（无 cloudAccount IPC）不渲染。
 */
export default function CloudAccountTitleBarEntry({ isDarkMode }: { isDarkMode: boolean }) {
  const [session, setSession] = useState(getCloudAccountSessionState);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const api = window.lingBuilder?.cloudAccount;

  useEffect(() => subscribeCloudAccountSession(() => setSession(getCloudAccountSessionState())), []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  if (!api) return null;

  const shellClass = 'window-no-drag relative flex shrink-0 items-center';
  const buttonClass = `flex items-center gap-1 rounded-full px-1.5 py-px text-[10px] font-semibold leading-4 ring-1 transition-colors ${
    isDarkMode
      ? 'bg-violet-500/15 text-violet-300 ring-violet-500/40 hover:bg-violet-500/30'
      : 'bg-violet-500/10 text-violet-700 ring-violet-500/40 hover:bg-violet-500/20'
  }`;
  const menuItemClass = `block w-full cursor-pointer px-3 py-1.5 text-left text-[11px] transition-colors ${
    isDarkMode ? 'hover:bg-[#37373d]' : 'hover:bg-slate-100'
  }`;

  if (!session.authenticated) {
    return (
      <div className={shellClass}>
        <button
          type="button"
          aria-label="登录 LingBuilder 账号"
          title="登录 LingBuilder 账号：系统 AI 点数、收费模块权益与体验计划都绑定该账号"
          onClick={event => {
            event.stopPropagation();
            void requestCloudAccountLogin({ description: '登录后可使用系统 AI、购买或启用收费模块；还没有账号可点「注册新账号」。' });
          }}
          onDoubleClick={event => event.stopPropagation()}
          className={buttonClass}
        >
          <UserRound className="h-3 w-3" aria-hidden="true" />
          登录
        </button>
      </div>
    );
  }

  const available = session.balance?.available || '0';
  return (
    <div ref={containerRef} className={shellClass}>
      <button
        type="button"
        aria-label={`已登录 ${session.email || ''}，可用点数 ${available}，点击打开账号菜单`}
        aria-expanded={menuOpen}
        title={`已登录 ${session.email || ''}`}
        onClick={event => {
          event.stopPropagation();
          setMenuOpen(value => !value);
          void refreshCloudAccountSession();
        }}
        onDoubleClick={event => event.stopPropagation()}
        className={buttonClass}
      >
        <Coins className="h-3 w-3" aria-hidden="true" />
        {Number(available).toLocaleString('zh-CN')}
      </button>
      {menuOpen && (
        <div className={`absolute right-0 top-full z-[90] mt-1.5 w-60 rounded-md border py-1 text-left shadow-2xl ${
          isDarkMode ? 'border-[#3b3b43] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800'
        }`}>
          <div className={`px-3 py-1.5 text-[11px] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
            <div className="truncate" title={session.email}>{session.email || '已登录'}</div>
            <div className="mt-0.5 flex items-baseline gap-1">
              <span>可用点数</span>
              <strong className={`text-xs tabular-nums ${isDarkMode ? 'text-amber-300' : 'text-amber-600'}`}>{available}</strong>
              {session.balance?.reserved && session.balance.reserved !== '0' && (
                <span>· 冻结 {Number(session.balance.reserved).toLocaleString('zh-CN')}</span>
              )}
            </div>
          </div>
          <div className={`h-px my-1 ${isDarkMode ? 'bg-slate-700' : 'bg-slate-200'}`}></div>
          <button type="button" className={menuItemClass} onClick={() => { setMenuOpen(false); void requestCloudAccountRecharge(); }}>
            <span className="inline-flex items-center gap-1.5"><Wallet className="h-3 w-3" aria-hidden="true" />充值点数…</span>
          </button>
          <button type="button" className={menuItemClass} onClick={() => { setMenuOpen(false); void signOutCloudAccount(); }}>
            <span className="inline-flex items-center gap-1.5"><LogOut className="h-3 w-3" aria-hidden="true" />退出登录</span>
          </button>
        </div>
      )}
    </div>
  );
}
