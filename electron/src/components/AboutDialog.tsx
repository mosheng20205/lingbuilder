import { useEffect } from 'react';
import { X } from 'lucide-react';
import lingBuilderIcon from '../../../image/lingbuilder-ide-icon-v1.png';
import {
  LINGBUILDER_DISPLAY_VERSION,
  LINGBUILDER_PRODUCT_NAME
} from '../services/product/productInfo';

interface AboutDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AboutDialog({ open, onClose }: AboutDialogProps) {
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
        aria-labelledby="lingbuilder-about-title"
        className="flex w-full max-w-sm flex-col overflow-hidden rounded-lg border border-[#2d2d34] bg-[#1e1e24] text-slate-200 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#2d2d34] bg-[#18181c] px-4 py-3">
          <span id="lingbuilder-about-title" className="text-xs font-bold text-slate-200">
            关于 LingBuilder IDE
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="关闭"
            aria-label="关闭关于窗口"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="flex flex-col items-center space-y-4 p-5 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-[#007ACC]/30 bg-[#007ACC]/10 shadow-inner">
            <img src={lingBuilderIcon} alt="" draggable={false} className="h-10 w-10 object-contain" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-100">{LINGBUILDER_PRODUCT_NAME}</h3>
            <p className="font-mono text-[11px] font-semibold text-cyan-300">
              软件版本 {LINGBUILDER_DISPLAY_VERSION}
            </p>
            <p className="text-[9px] text-slate-500">Release</p>
          </div>

          <div className="w-full space-y-2 rounded border border-[#2d2d34]/60 bg-[#141418] p-3 text-left text-[11px] leading-relaxed text-slate-400">
            <p className="font-semibold text-slate-200">中文优先的本地 C++ 集成开发环境</p>
            <p>提供中文代码编辑、窗口设计、确定性 C++ 生成、构建调试、模块扩展与可审查的 AI 辅助能力。</p>
          </div>

          <div className="flex w-full justify-between text-[9.5px] text-slate-500">
            <span>© 2026 LingBuilder Dev Group</span>
            <span>All Rights Reserved</span>
          </div>
        </div>

        <footer className="flex justify-end border-t border-[#2d2d34] bg-[#18181c] px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="cursor-pointer rounded bg-blue-600 px-4 py-1 text-[11px] font-semibold text-white shadow transition-colors hover:bg-blue-500"
          >
            确定
          </button>
        </footer>
      </section>
    </div>
  );
}
