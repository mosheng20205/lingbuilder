import { useEffect } from 'react';
import { X } from 'lucide-react';
import sponsorQRCode from '../../../image/赞助二维码.png';

interface SponsorDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function SponsorDialog({ open, onClose }: SponsorDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-xs animate-fade-in select-none"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="lingbuilder-sponsor-title"
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[#2d2d34] bg-[#1e1e24] text-slate-200 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#2d2d34] bg-[#18181c] px-4 py-3">
          <span id="lingbuilder-sponsor-title" className="text-xs font-bold text-slate-200">赞助 LingBuilder</span>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white" title="关闭" aria-label="关闭赞助窗口">
            <X className="h-3.5 w-3.5" />
          </button>
        </header>
        <div className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-xs leading-relaxed text-slate-400">感谢你对 LingBuilder 的支持！可使用支付宝或微信扫描下方二维码。</p>
          <img src={sponsorQRCode} alt="支付宝和微信赞助二维码" draggable={false} className="max-h-[min(60vh,420px)] w-full max-w-[440px] rounded border border-slate-200/20 bg-white object-contain" />
        </div>
        <footer className="flex justify-end border-t border-[#2d2d34] bg-[#18181c] px-4 py-2.5">
          <button type="button" onClick={onClose} autoFocus className="cursor-pointer rounded bg-blue-600 px-4 py-1 text-[11px] font-semibold text-white shadow transition-colors hover:bg-blue-500">关闭</button>
        </footer>
      </section>
    </div>
  );
}
