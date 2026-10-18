import { ChevronRight } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent } from 'react';

/**
 * 在捕获段吞掉紧随拖拽 mouseup 之后由浏览器合成的那一次 click。
 *
 * 拖拽期间 sash 会跟随光标移动，mouseup 落点极可能仍压在 mousedown 的同一元素上，
 * 浏览器因此照常合成 click（与移动距离无关）。历史上 sash 中央的折叠按钮就是这样被
 * 拖拽结束误触发的（2026-10-18 实锤）。供 startResizeLeft 在发生过实际拖拽后调用。
 */
export function suppressNextSyntheticClick(target: EventTarget = window): void {
  let settled = false;
  const swallow = (event: Event) => {
    event.stopImmediatePropagation();
    if (settled) return;
    settled = true;
    // 注意必须用 { capture: true } 对象形式解绑：Node EventTarget 不认布尔第三参（浏览器两者都认）。
    target.removeEventListener('click', swallow, { capture: true });
  };
  target.addEventListener('click', swallow, { capture: true });
  // 合成 click 在 mouseup 的同一事件循环内同步派发；兜底解绑防止悬挂。
  setTimeout(() => {
    if (!settled) {
      settled = true;
      target.removeEventListener('click', swallow, { capture: true });
    }
  }, 1000);
}

interface SidebarResizeSashProps {
  /** 侧栏是否处于展开态：展开时是纯拖拽条，折叠时是点击展开入口。 */
  visible: boolean;
  onResizeStart: (event: ReactMouseEvent) => void;
  onResetWidth: () => void;
  onToggleVisibility: () => void;
}

/**
 * 左侧解决方案资源管理器的宽度拖拽条。
 *
 * 展开态是纯拖拽条（拖拽调宽 + 双击重置），不承载任何点击折叠入口：sash 中中央
 * 叠放折叠按钮时，拖拽全程按钮跟随光标，松手必然误触发折叠。折叠入口收敛为
 * 活动栏已激活图标点击（VS Code 式）、标题栏「切换解决方案管理器」与命令面板。
 * 折叠态没有拖拽冲突（onResizeStart 不挂载），保留条带点击与展开箭头按钮作恢复入口。
 */
export default function SidebarResizeSash({ visible, onResizeStart, onResetWidth, onToggleVisibility }: SidebarResizeSashProps) {
  return (
    <div
      className={`w-[6px] relative flex items-center justify-center select-none transition-all duration-150 z-20 shrink-0 border-r border-[#2d2d34] group ${
        visible
          ? 'bg-[#1c1c22] cursor-col-resize hover:bg-blue-500/20'
          : 'bg-[#16161c] cursor-pointer hover:bg-amber-500/10'
      }`}
      onMouseDown={visible ? onResizeStart : undefined}
      title={visible ? '拖拽调整宽度 / 双击重置' : '点击展开左侧解决方案资源管理器'}
      onDoubleClick={visible ? onResetWidth : undefined}
      onClick={visible ? undefined : onToggleVisibility}
    >
      {/* Thin line indicator */}
      <div className={`w-[1px] rounded-full transition-all ${
        visible
          ? 'h-8 bg-slate-700/50 group-hover:bg-blue-400 group-hover:h-12'
          : 'h-12 bg-amber-500/20 group-hover:bg-amber-500/50'
      }`}></div>

      {!visible && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onToggleVisibility();
          }}
          className="absolute left-1/2 -translate-x-1/2 w-[16px] h-12 bg-[#2d2d36] hover:bg-[#3a3a45] active:bg-[#4a4a58] border border-[#444] hover:border-blue-500/60 rounded shadow-lg flex items-center justify-center cursor-pointer transition-all hover:scale-105 z-30 group-hover:opacity-100 opacity-60"
          title="展开左侧面板"
        >
          <ChevronRight className="w-3 h-3 text-amber-500 group-hover:text-amber-400 transition-transform group-hover:scale-110" />
        </button>
      )}
    </div>
  );
}
