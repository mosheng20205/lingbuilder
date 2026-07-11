import type { ShortcutCommandBinding } from './shortcutOverrides';

export const WORKBENCH_DEFAULT_KEYBINDINGS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'workbench.action.showCommands': ['Ctrl+Shift+P', 'Meta+Shift+P', 'F1'],
  'workbench.action.openSettings': ['Ctrl+,', 'Meta+,'],
  'workbench.action.files.openWorkspace': ['Ctrl+O', 'Meta+O'],
  'workbench.action.files.save': ['Ctrl+S', 'Meta+S'],
  'workbench.action.editor.undo': ['Ctrl+Z', 'Meta+Z'],
  'workbench.action.editor.redo': ['Ctrl+Y', 'Ctrl+Shift+Z', 'Meta+Shift+Z'],
  'workbench.action.findInFiles': ['Ctrl+Shift+F', 'Meta+Shift+F'],
  'workbench.action.replaceInFiles': ['Ctrl+Shift+H', 'Meta+Shift+H'],
  'workbench.action.build.run': ['F5'],
  'workbench.action.build.stop': ['Shift+F5']
});

export const WORKBENCH_DEFAULT_COMMAND_BINDINGS: readonly ShortcutCommandBinding[] = Object.freeze(
  Object.entries(WORKBENCH_DEFAULT_KEYBINDINGS).map(([id, keybindings]) => ({ id, keybindings }))
);
