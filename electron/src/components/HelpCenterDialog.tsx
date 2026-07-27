import { useEffect } from 'react';
import { BookOpen, CalendarDays, Sparkles, X } from 'lucide-react';
import {
  LINGBUILDER_DISPLAY_VERSION,
  LINGBUILDER_RELEASE_NOTES
} from '../services/product/productInfo';

interface HelpCenterDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function HelpCenterDialog({ open, onClose }: HelpCenterDialogProps) {
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
        aria-labelledby="lingbuilder-help-center-title"
        className="flex max-h-[78vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-[#2d2d34] bg-[#1e1e24] text-slate-200 shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-[#2d2d34] bg-[#18181c] px-4 py-3">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-cyan-400" />
            <span id="lingbuilder-help-center-title" className="text-xs font-bold">LingBuilder 帮助中心</span>
            <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-[9px] text-cyan-300">
              {LINGBUILDER_DISPLAY_VERSION}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            title="关闭"
            aria-label="关闭帮助中心"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
            <div className="rounded-md bg-cyan-500/15 p-2 text-cyan-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">更新日志</h2>
              <p className="mt-1 text-[10.5px] leading-5 text-slate-400">
                查看当前版本的新功能与体验改进。更新日志随 LingBuilder 一同安装，可离线阅读。
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {LINGBUILDER_RELEASE_NOTES.map((release, releaseIndex) => (
              <article key={`${release.version}-${release.date}`} className="overflow-hidden rounded-lg border border-[#303039] bg-[#17171c]">
                <div className="flex items-start justify-between gap-3 border-b border-[#2d2d34] bg-[#1b1b21] px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-slate-100">{release.title}</h3>
                      {releaseIndex === 0 && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">当前版本</span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 font-mono text-[9.5px] text-slate-500">
                      <span>v{release.version}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {release.date}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
                  {release.sections.map(section => (
                    <section key={section.title}>
                      <h4 className="mb-2 text-[10.5px] font-semibold text-cyan-300">{section.title}</h4>
                      <ul className="space-y-1.5 text-[10.5px] leading-5 text-slate-400">
                        {section.items.map(item => (
                          <li key={item} className="flex items-start gap-2">
                            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-slate-600" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>

        <footer className="flex items-center justify-between border-t border-[#2d2d34] bg-[#18181c] px-4 py-2.5">
          <span className="text-[9.5px] text-slate-500">当前安装版本：{LINGBUILDER_DISPLAY_VERSION}</span>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="cursor-pointer rounded bg-blue-600 px-4 py-1 text-[11px] font-semibold text-white shadow transition-colors hover:bg-blue-500"
          >
            关闭
          </button>
        </footer>
      </section>
    </div>
  );
}
