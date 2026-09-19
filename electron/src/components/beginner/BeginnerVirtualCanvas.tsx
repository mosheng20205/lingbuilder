import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/**
 * 新手结构化编辑器的块级窗口化容器。
 *
 * 背景（2026-09-17 定位）：`组件总览六标签页.lcpp` 在结构化中文编辑下会展开 260 个块、
 * 5.4 万个 DOM 节点 / 285 张表格，整棵树一次性挂载的后遗症是：
 *   - 打开要 3.8s 一次性同步任务；
 *   - 之后任何交互（鼠标划过换行、点击行、敲一个字）都会重渲整棵树，实测 1.3s/次，
 *     连续划过时事件排队，表现就是「点不动、滚不动」。
 * 这里按 VS Code `ListView` / Monaco `viewLines` 的思路，只把视口附近的块放进 DOM，
 * 其余块用高度占位（`getTotalSize`）撑起滚动条；高度由 `measureElement` 实测纠正。
 *
 * 保留的既有能力：
 *   - DOM 顺序与块顺序一致，滚动位置、`data-beginner-structure-scroll` 契约不变；
 *   - `scrollToSourceLine` 供「跳转到行 / 结构定位」先把目标块滚入视口再定位；
 *   - 小文件（块数不超过阈值）走原样全量渲染，行为与改动前一致。
 */
export interface BeginnerCanvasItem {
  /** 稳定 key，跨重渲必须保持不变，否则会整块重建 DOM。 */
  key: string;
  /**
   * 该块渲染所依赖状态的指纹。父组件（DiffViewer / App）因为无关状态重渲时，
   * 指纹不变就不会重新执行 `render()`，从而避免几十毫秒级的整树重建。
   */
  revision: string;
  /** 该项覆盖的源码行区间（含端点），用于跳转到行时定位目标块。 */
  sourceFrom: number;
  sourceTo: number;
  /** 首帧高度估算；真实高度由 measureElement 纠正。 */
  estimateSize: number;
  /** 真正的块渲染，只在进入视口窗口时调用。 */
  render: () => React.ReactNode;
}

/** 块内容的记忆化外壳：只有 key 或 revision 变化时才重新执行块的渲染函数。 */
const CanvasItemSurface = React.memo(
  function CanvasItemSurface({ item }: { item: BeginnerCanvasItem }) {
    return <>{item.render()}</>;
  },
  (previous, next) => previous.item.key === next.item.key && previous.item.revision === next.item.revision
);

export interface BeginnerVirtualCanvasHandle {
  /** 把包含指定源码行的块滚入视口并返回该块索引；找不到时返回 -1。 */
  scrollToSourceLine: (line: number) => number;
  /** 当前是否处于窗口化渲染（用于提示与测试断言）。 */
  isVirtualized: () => boolean;
}

interface BeginnerVirtualCanvasProps {
  items: BeginnerCanvasItem[];
  /** 低于该块数时保持全量渲染，避免小文件行为变化。 */
  virtualizeThreshold?: number;
  overscan?: number;
  className: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  handleRef?: React.MutableRefObject<BeginnerVirtualCanvasHandle | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onFocusCapture?: React.FocusEventHandler<HTMLDivElement>;
  onPointerDownCapture?: React.PointerEventHandler<HTMLDivElement>;
  /** 固定渲染在块列表之前的内容（datalist、右键菜单等）。 */
  children?: React.ReactNode;
  /** 固定渲染在块列表之后的内容（滚动尾部留白等）。 */
  footer?: React.ReactNode;
  /**
   * 渲染在画布内容层之上的浮层（补全面板等）。
   * 必须放在内容坐标系定位的 `data-beginner-canvas-content` 容器内且 z-index 高于块：
   * 虚拟化块包装器带 transform（独立层叠上下文），块内浮层会被后续块盖住，
   * 同时块内浮层还要求把自身状态写进 blockRevision，导致每键全块重渲。
   */
  overlay?: React.ReactNode;
}

export default function BeginnerVirtualCanvas({
  items,
  virtualizeThreshold = 30,
  overscan = 6,
  className,
  scrollRef,
  handleRef,
  onScroll,
  onKeyDown,
  onContextMenu,
  onFocusCapture,
  onPointerDownCapture,
  children,
  footer,
  overlay
}: BeginnerVirtualCanvasProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualize = items.length > virtualizeThreshold;

  const setScrollElement = useCallback((node: HTMLDivElement | null) => {
    parentRef.current = node;
    if (scrollRef) (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [scrollRef]);

  const estimateSize = useCallback((index: number) => items[index]?.estimateSize ?? 32, [items]);
  const getItemKey = useCallback((index: number) => items[index]?.key ?? String(index), [items]);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    getItemKey,
    overscan
  });

  const sourceRanges = useMemo(() => items
    .map((item, index) => ({ index, from: item.sourceFrom, to: item.sourceTo }))
    .filter(range => Number.isFinite(range.from) && range.from > 0)
    .sort((left, right) => left.from - right.from || left.to - right.to), [items]);

  useEffect(() => {
    if (!handleRef) return;
    handleRef.current = {
      isVirtualized: () => virtualize,
      scrollToSourceLine: (line: number) => {
        if (sourceRanges.length === 0) return -1;
        const exact = sourceRanges.find(range => line >= range.from && line <= range.to);
        // 落在块与块之间的空隙时，退回「最后一个起点不超过目标行」的块。
        let fallback: { index: number } | undefined;
        for (const range of sourceRanges) {
          if (range.from <= line) fallback = range;
          else break;
        }
        const target = exact || fallback || sourceRanges[0];
        if (!target) return -1;
        virtualizer.scrollToIndex(target.index, { align: 'start' });
        return target.index;
      }
    };
    return () => { if (handleRef) handleRef.current = null; };
  }, [handleRef, sourceRanges, virtualize, virtualizer]);

  const containerProps = {
    ref: setScrollElement,
    'data-beginner-structure-scroll': true,
    className,
    onScroll,
    onKeyDown,
    onContextMenu,
    onFocusCapture,
    onPointerDownCapture
  } as const;

  if (!virtualize) {
    return (
      <div {...containerProps}>
        {children}
        <div className="relative min-w-0" data-beginner-canvas-content>
          <div className="min-w-0">
            {items.map(item => (
              <div key={item.key} data-beginner-canvas-item={item.key}>
                <CanvasItemSurface item={item} />
              </div>
            ))}
          </div>
          {overlay}
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div {...containerProps}>
      {children}
      <div
        data-beginner-virtualized="true"
        data-beginner-canvas-content
        style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}
      >
        {virtualizer.getVirtualItems().map(virtualItem => {
          const item = items[virtualItem.index];
          if (!item) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              data-beginner-canvas-item={item.key}
              ref={virtualizer.measureElement}
              className="min-w-0"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`
              }}
            >
              <CanvasItemSurface item={item} />
            </div>
          );
        })}
        {overlay}
      </div>
      {footer}
    </div>
  );
}
