export type ExtensionPermission = 'workspace.read' | 'workspace.write' | 'designer.read' | 'designer.write';
export interface ExtensionCommandContribution { command: string; title: string; category?: string }
export interface ExtensionMenuContribution { menu: string; command?: string; submenu?: string; when?: string; group?: string; order?: number; arguments?: unknown[] }
export interface ExtensionSubmenuContribution { id: string; title: string }
export interface ExtensionViewContribution { id: string; name: string; location?: string }
export interface ExtensionLanguageContribution { id: string; extensions?: string[]; aliases?: string[] }
export interface ExtensionThemeContribution { id: string; label: string; path: string; uiTheme?: 'vs' | 'vs-dark' }
export interface ExtensionManifest { name: string; publisher: string; version: string; displayName?: string; description?: string; main: string; activationEvents?: string[]; permissions?: ExtensionPermission[]; contributes?: { commands?: ExtensionCommandContribution[]; menus?: ExtensionMenuContribution[]; submenus?: ExtensionSubmenuContribution[]; views?: ExtensionViewContribution[]; languages?: ExtensionLanguageContribution[]; themes?: ExtensionThemeContribution[] } }
export interface ExtensionDescriptor { id: string; root: string; manifest: ExtensionManifest; enabled: boolean; state: 'disabled' | 'inactive' | 'active' | 'error'; error?: string; activationCount: number }
export interface ExtensionHostSnapshot { state: 'stopped' | 'starting' | 'ready' | 'crashed'; pid?: number; restartCount: number; extensions: ExtensionDescriptor[]; logs: string[] }
