import { CommandService, CommandServiceError, normalizeKeybinding } from './commandService';
import type { CommandContext } from './types';

export interface KeyboardEventLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  repeat?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  defaultPrevented?: boolean;
  target?: unknown;
  preventDefault(): void;
  stopPropagation(): void;
}

export interface KeybindingDispatchResult {
  handled: boolean;
  keybinding?: string;
  commandId?: string;
  error?: CommandServiceError;
}

export type CommandContextProvider = () => CommandContext;

/** 将浏览器键盘事件可靠路由到 CommandService；输入法组合态和按键连发不会被拦截。 */
export class KeybindingService {
  constructor(
    private readonly commands: CommandService,
    private readonly getContext: CommandContextProvider
  ) {}

  async dispatch(event: KeyboardEventLike): Promise<KeybindingDispatchResult> {
    const keybinding = keyboardEventToKeybinding(event);
    if (!keybinding) return { handled: false };
    const context = this.getContext();
    const matches = this.commands.resolveKeybinding(keybinding, context);
    if (matches.length === 0) return { handled: false, keybinding };

    const command = matches[0];
    if (isNativeEditableTarget(event.target)
      && isEditorHistoryCommand(command.id)
      && !isWorkbenchEditorCommandTarget(event.target)) {
      return { handled: false, keybinding };
    }
    event.preventDefault();
    event.stopPropagation();
    try {
      await this.commands.executeCommand(command.id, context);
      return { handled: true, keybinding, commandId: command.id };
    } catch (error) {
      const normalizedError = error instanceof CommandServiceError
        ? error
        : new CommandServiceError(
            'command-execution-failed',
            `执行快捷键“${keybinding}”失败：${error instanceof Error ? error.message : String(error)}`,
            { commandId: command.id, keybinding, cause: error }
          );
      return { handled: true, keybinding, commandId: command.id, error: normalizedError };
    }
  }
}

function isEditorHistoryCommand(commandId: string): boolean {
  return commandId === 'workbench.action.editor.undo' || commandId === 'workbench.action.editor.redo';
}

function isNativeEditableTarget(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const target = value as { tagName?: unknown; isContentEditable?: unknown };
  const tagName = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : '';
  return tagName === 'input' || tagName === 'textarea' || target.isContentEditable === true;
}

function isWorkbenchEditorCommandTarget(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const closest = (value as { closest?: unknown }).closest;
  if (typeof closest !== 'function') return false;
  try {
    return Boolean(closest.call(value, '[data-lingbuilder-editor-command-owner="true"]'));
  } catch {
    return false;
  }
}

export function createKeybindingService(
  commands: CommandService,
  getContext: CommandContextProvider
): KeybindingService {
  return new KeybindingService(commands, getContext);
}

export function keyboardEventToKeybinding(event: KeyboardEventLike): string | null {
  if (
    event.defaultPrevented
    || event.repeat
    || event.isComposing
    || event.keyCode === 229
    || !event.key
    || event.key === 'Process'
    || isModifierOnly(event.key)
  ) {
    return null;
  }

  const key = normalizeEventKey(event.key);
  const parts = [
    event.ctrlKey ? 'Ctrl' : '',
    event.metaKey ? 'Meta' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    key
  ].filter(Boolean);
  try {
    return normalizeKeybinding(parts.join('+'));
  } catch {
    return null;
  }
}

function normalizeEventKey(key: string): string {
  if (key === ' ') return 'Space';
  if (key === 'Esc') return 'Escape';
  if (key.length === 1 && /[a-z]/iu.test(key)) return key.toUpperCase();
  return key;
}

function isModifierOnly(key: string): boolean {
  return ['Control', 'Meta', 'Alt', 'Shift', 'AltGraph'].includes(key);
}
