import { normalizeKeybinding } from './commandService';

export interface ShortcutOverrideValidation {
  normalized: Record<string, string>;
  errors: Record<string, string>;
}

export interface ShortcutCommandBinding {
  id: string;
  keybindings: readonly string[];
}

export function validateShortcutOverrides(
  drafts: Record<string, string>,
  commandDefaults: readonly ShortcutCommandBinding[] = []
): ShortcutOverrideValidation {
  const normalized: Record<string, string> = {};
  const errors: Record<string, string> = {};
  const owners = new Map<string, string>();
  for (const [commandId, source] of Object.entries(drafts)) {
    if (!source.trim()) continue;
    try {
      const keybinding = normalizeKeybinding(source);
      if (keybinding.includes(' ')) {
        errors[commandId] = '当前版本只支持单段快捷键，不支持组合键序列。';
        continue;
      }
      if (!isSafeGlobalKeybinding(keybinding)) {
        errors[commandId] = '全局快捷键必须包含 Ctrl、Meta 或 Alt；也可以单独使用 F1-F24，避免打断文字输入和焦点导航。';
        continue;
      }
      const owner = owners.get(keybinding);
      if (owner) {
        errors[commandId] = `与命令 ${owner} 冲突。`;
        errors[owner] = `与命令 ${commandId} 冲突。`;
        continue;
      }
      owners.set(keybinding, commandId);
      normalized[commandId] = keybinding;
    } catch (error) {
      errors[commandId] = error instanceof Error ? error.message : '快捷键格式无效。';
    }
  }

  if (commandDefaults.length > 0) {
    const effectiveOwners = new Map<string, string>();
    const knownCommandIds = new Set(commandDefaults.map(command => command.id));
    const effectiveCommands: ShortcutCommandBinding[] = [
      ...commandDefaults,
      ...Object.entries(normalized)
        .filter(([commandId]) => !knownCommandIds.has(commandId))
        .map(([id, keybinding]) => ({ id, keybindings: [keybinding] }))
    ];
    for (const command of effectiveCommands) {
      const effectiveBindings = normalized[command.id]
        ? [normalized[command.id]]
        : command.keybindings;
      for (const binding of effectiveBindings) {
        let keybinding: string;
        try {
          keybinding = normalizeKeybinding(binding);
        } catch {
          continue;
        }
        const owner = effectiveOwners.get(keybinding);
        if (!owner || owner === command.id) {
          effectiveOwners.set(keybinding, command.id);
          continue;
        }
        // Existing defaults are service-owned. A new override must not collide with them,
        // while two unchanged defaults are diagnosed by CommandService itself.
        if (!normalized[owner] && !normalized[command.id]) continue;
        errors[owner] = `快捷键“${keybinding}”与命令 ${command.id} 冲突。`;
        errors[command.id] = `快捷键“${keybinding}”与命令 ${owner} 冲突。`;
      }
    }
  }
  return { normalized, errors };
}

export function isSafeGlobalKeybinding(keybinding: string): boolean {
  const normalized = normalizeKeybinding(keybinding);
  const parts = normalized.split('+');
  const key = parts[parts.length - 1];
  return parts.some(part => part === 'Ctrl' || part === 'Meta' || part === 'Alt')
    || /^F(?:[1-9]|1\d|2[0-4])$/u.test(key);
}

export function areShortcutOverridesEqual(
  left: Record<string, string>,
  right: Record<string, string>
): boolean {
  const leftEntries = Object.entries(left).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const rightEntries = Object.entries(right).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => (
      rightEntries[index]?.[0] === key && rightEntries[index]?.[1] === value
    ));
}

export function hasUnsavedShortcutChanges(
  drafts: Record<string, string>,
  persisted: Record<string, string>
): boolean {
  return !areShortcutOverridesEqual(drafts, persisted);
}

export type ShortcutDraftSynchronization = 'none' | 'replace' | 'preserve';

export function decideShortcutDraftSynchronization(
  previousScope: string,
  nextScope: string,
  dirty: boolean
): ShortcutDraftSynchronization {
  if (previousScope === nextScope) return 'none';
  const previousTarget = previousScope.split(':', 1)[0];
  const nextTarget = nextScope.split(':', 1)[0];
  if (!previousScope || previousTarget !== nextTarget || !dirty) return 'replace';
  return 'preserve';
}
