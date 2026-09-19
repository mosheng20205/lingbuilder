import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { CloudAccountRechargeResult } from '../services/workbench/cloudAccountRechargeService';
import { applyCloudAccountBalance, applyCloudAccountSignedOut } from '../services/workbench/cloudAccountSessionStore';

export interface CloudAccountRechargeDialogProps {
  open: boolean;
  isDarkMode: boolean;
  onResult: (result: CloudAccountRechargeResult) => void;
}

interface RechargePackage {
  id: string;
  name: string;
  points: string;
  amountMinor: string;
  currency: string;
}

interface PendingOrder {
  orderId: string;
  points: string;
  packageName: string;
  dataUrl: string;
  expiresAt: string;
  status: string;
  mode: 'qr' | 'browser';
}

/**
 * 点数充值对话框：套餐列表 → 支付宝下单 → 二维码/收银台 → 轮询到账。
 *
 * paymentForm 非空表示云端要求走系统浏览器收银台（本机无法内嵌二维码），此时只轮询。
 * 未登录时下单会被云端拒绝，这里把会话清成未登录并提示重新登录，避免标题栏继续显示旧点数。
 */
export default function CloudAccountRechargeDialog({ open, isDarkMode, onResult }: CloudAccountRechargeDialogProps) {
  const [packages, setPackages] = useState<RechargePackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [order, setOrder] = useState<PendingOrder | null>(null);
  const [message, setMessage] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOrder(null);
    setMessage('');
    setIsBusy(false);
    const cloudAccount = window.lingBuilder?.cloudAccount;
    if (!cloudAccount?.rechargePackages) {
      setMessage('当前运行环境不支持在线充值，请使用 LingBuilder 桌面版。');
      return;
    }
    let active = true;
    setIsLoadingPackages(true);
    void cloudAccount.rechargePackages().then(result => {
      if (active) setPackages(result?.packages || []);
    }).catch(error => {
      if (active) setMessage(error instanceof Error ? error.message : String(error));
    }).finally(() => {
      if (active) setIsLoadingPackages(false);
    });
    return () => { active = false; };
  }, [open]);

  // 订单待付款期间每 3 秒轮询一次；瞬时网络错误留给下一轮，不打断付款。
  useEffect(() => {
    if (!open || !order || order.status !== 'pending') return undefined;
    const orderId = order.orderId;
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const result = await window.lingBuilder?.cloudAccount?.rechargeOrder(orderId);
        if (!active || !result?.order) return;
        if (result.order.status === 'paid') {
          setOrder(current => (current && current.orderId === orderId ? { ...current, status: 'paid' } : current));
          const balance = await window.lingBuilder?.cloudAccount?.balance();
          if (balance?.balance) applyCloudAccountBalance(balance.balance);
        } else if (['expired', 'cancelled', 'refunded'].includes(result.order.status)) {
          setOrder(current => (current && current.orderId === orderId ? { ...current, status: result.order.status } : current));
        }
      } catch { /* 轮询期间的瞬时错误忽略 */ }
    }, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, [open, order]);

  if (!open) return null;

  const close = () => onResult({ paid: order?.status === 'paid', cancelled: order?.status !== 'paid' });

  const startRecharge = async (packageId: string) => {
    const cloudAccount = window.lingBuilder?.cloudAccount;
    if (!cloudAccount?.createRechargeOrder) {
      setMessage('当前客户端版本不支持在线充值。');
      return;
    }
    setIsBusy(true);
    setMessage('');
    try {
      const result = await cloudAccount.createRechargeOrder({ packageId, provider: 'alipay', idempotencyKey: crypto.randomUUID() });
      if (!result?.order?.paymentUrl) throw new Error('支付渠道未返回付款地址。');
      if (result.order.paymentForm) {
        const openError = await window.lingBuilder?.payments?.openPage(result.order.paymentUrl);
        if (openError) throw new Error(openError);
        setOrder({ orderId: result.order.id, points: result.order.points, packageName: result.order.packageName, dataUrl: '', expiresAt: result.order.expiresAt, status: 'pending', mode: 'browser' });
      } else {
        const dataUrl = await QRCode.toDataURL(result.order.paymentUrl, { width: 320, margin: 2, errorCorrectionLevel: 'M' });
        setOrder({ orderId: result.order.id, points: result.order.points, packageName: result.order.packageName, dataUrl, expiresAt: result.order.expiresAt, status: 'pending', mode: 'qr' });
      }
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      setMessage(text);
      if (/unauthorized|token|未登录|登录/iu.test(text)) applyCloudAccountSignedOut();
    } finally {
      setIsBusy(false);
    }
  };

  const mutedText = isDarkMode ? 'text-slate-400' : 'text-slate-500';

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/55 p-4 font-sans"
      role="dialog"
      aria-modal="true"
      aria-label="LingBuilder 点数充值"
    >
      <div className={`w-full max-w-md rounded-lg border shadow-2xl ${isDarkMode ? 'border-[#3d3d44] bg-[#1e1e24] text-slate-200' : 'border-slate-200 bg-white text-slate-800'}`}>
        <div className={`flex items-center justify-between border-b px-4 py-3 ${isDarkMode ? 'border-[#35353c]' : 'border-slate-200'}`}>
          <h2 className="text-sm font-semibold">{order ? `支付宝充值 · ${order.packageName}` : '充值 LingBuilder 点数'}</h2>
          <button type="button" aria-label="关闭充值窗口" onClick={close} className={`rounded p-1 ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {order ? (
          <div className="px-4 py-4">
            {order.status === 'paid' ? (
              <div className="py-6 text-center text-sm text-emerald-400">充值成功！{Number(order.points).toLocaleString('zh-CN')} 点数已到账。</div>
            ) : order.status === 'pending' ? (
              order.mode === 'browser' ? (
                <p className={`text-xs leading-5 ${mutedText}`}>
                  已在系统浏览器中打开支付宝收银台，请在浏览器内完成付款；支付成功后此窗口会自动刷新点数。订单有效至 {new Date(order.expiresAt).toLocaleTimeString()}。
                </p>
              ) : (
                <>
                  <img src={order.dataUrl} alt="支付宝充值二维码" className="mx-auto w-72 max-w-full rounded bg-white p-2" />
                  <p className={`mt-3 text-xs leading-5 ${mutedText}`}>
                    请使用支付宝扫描二维码完成充值，支付成功后此窗口会自动刷新点数。订单有效至 {new Date(order.expiresAt).toLocaleTimeString()}。
                  </p>
                </>
              )
            ) : (
              <div className="py-6 text-center text-sm text-amber-400">订单已结束（{order.status}），请关闭后重新发起充值。</div>
            )}
            <div className="mt-4 flex items-center justify-between gap-2">
              <button type="button" onClick={() => setOrder(null)} className={`text-[11px] underline-offset-2 hover:underline ${isDarkMode ? 'text-sky-300' : 'text-sky-700'}`}>
                换个套餐
              </button>
              <button type="button" onClick={close} className="rounded bg-blue-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-500">完成</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-4 py-4">
            {isLoadingPackages && (
              <div className={`flex items-center gap-2 text-[11px] ${mutedText}`}><Loader2 size={12} className="animate-spin" aria-hidden="true" />正在加载充值套餐…</div>
            )}
            {!isLoadingPackages && packages.length === 0 && !message && (
              <div className={`text-[11px] ${mutedText}`}>当前没有可购买的充值套餐，请稍后再试。</div>
            )}
            {packages.map(pack => (
              <div key={pack.id} className={`flex items-center gap-2 rounded border px-3 py-2 text-xs ${isDarkMode ? 'border-[#3a3a42] bg-[#25252c]' : 'border-slate-200 bg-slate-50'}`}>
                <span className="flex-1 truncate">{pack.name} · {Number(pack.points).toLocaleString('zh-CN')} 点数</span>
                <span className="font-semibold text-amber-500">¥{(Number(pack.amountMinor) / 100).toFixed(2)}</span>
                <button type="button" disabled={isBusy} onClick={() => void startRecharge(pack.id)} className="cursor-pointer rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50">
                  支付宝
                </button>
              </div>
            ))}
            {message && <p role="alert" className={`text-[11px] leading-4 ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>{message}</p>}
            <p className={`text-[10px] leading-4 ${mutedText}`}>点数按实际用量结算，失败请求会自动释放冻结点数。</p>
          </div>
        )}
      </div>
    </div>
  );
}
