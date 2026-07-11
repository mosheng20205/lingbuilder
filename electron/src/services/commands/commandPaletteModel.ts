import type { CommandContext } from './types';

export type CommandPaletteMove = 'next' | 'previous' | 'first' | 'last';

/**
 * 命令面板用于选择下一条操作，本身不应让普通工作台命令因 modal 条件失效。
 * 其他阻塞对话框仍保留 modal 状态，避免绕过真实上下文约束。
 */
export function createCommandPaletteContext(context: CommandContext): CommandContext {
  return {
    ...context,
    'workbench.commandPaletteOpen': false,
    'workbench.modalOpen': Boolean(
      context['workbench.settingsOpen']
      || context['workbench.blockingDialogOpen']
    )
  };
}

/** App 命令约定：显式 false 表示操作失败或用户取消，其余返回值表示命令已完成。 */
export function isSuccessfulCommandResult(result: unknown): boolean {
  return result !== false;
}

export interface CommandPaletteScrollContainer {
  querySelector(selector: string): { scrollIntoView(options?: ScrollIntoViewOptions): void } | null;
}

export function scrollCommandPaletteOptionIntoView(
  container: CommandPaletteScrollContainer | null,
  selectedIndex: number
): boolean {
  if (!container || selectedIndex < 0) return false;
  const option = container.querySelector(`[data-command-index="${selectedIndex}"]`);
  if (!option) return false;
  option.scrollIntoView({ block: 'nearest' });
  return true;
}

export function moveCommandPaletteSelection(
  currentIndex: number,
  itemCount: number,
  move: CommandPaletteMove
): number {
  if (itemCount <= 0) return -1;
  if (move === 'first') return 0;
  if (move === 'last') return itemCount - 1;
  if (currentIndex < 0 || currentIndex >= itemCount) return move === 'previous' ? itemCount - 1 : 0;
  return move === 'next'
    ? (currentIndex + 1) % itemCount
    : (currentIndex - 1 + itemCount) % itemCount;
}

export function clampCommandPaletteSelection(currentIndex: number, itemCount: number): number {
  if (itemCount <= 0) return -1;
  return Math.max(0, Math.min(currentIndex, itemCount - 1));
}
