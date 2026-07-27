import type { CommandContext, CommandPresentation, CommandRegistration, CommandWhenClause } from '../commands/types';

export const DESIGNER_CONTROL_CONTEXT_MENU = 'designer/control/context';
export const DESIGNER_CANVAS_CONTEXT_MENU = 'designer/canvas/context';
export const DESIGNER_RESOURCE_CONTEXT_MENU = 'designer/resource/context';

export type MenuContributionSource = 'builtin' | 'module' | 'extension';

export interface SubmenuContribution {
  id: string;
  title: string;
  source?: MenuContributionSource;
  sourceId?: string;
}

export interface MenuContribution {
  menu: string;
  command?: string;
  submenu?: string;
  when?: CommandWhenClause;
  group?: string;
  order?: number;
  arguments?: readonly unknown[];
  source?: MenuContributionSource;
  sourceId?: string;
}

export interface ResolvedMenuCommandItem {
  kind: 'command';
  id: string;
  command: CommandPresentation;
  arguments: readonly unknown[];
  group: string;
  order: number;
  source: MenuContributionSource;
  sourceId?: string;
}

export interface ResolvedSubmenuItem {
  kind: 'submenu';
  id: string;
  title: string;
  items: ResolvedMenuItem[];
  group: string;
  order: number;
  source: MenuContributionSource;
  sourceId?: string;
}

export interface ResolvedMenuSeparator {
  kind: 'separator';
  id: string;
}

export type ResolvedMenuItem = ResolvedMenuCommandItem | ResolvedSubmenuItem | ResolvedMenuSeparator;

export interface MenuDiagnostic {
  severity: 'warning' | 'error';
  code: 'invalid-contribution' | 'invalid-when' | 'missing-command' | 'missing-submenu' | 'submenu-cycle' | 'submenu-depth';
  message: string;
  sourceId?: string;
}

export interface MenuRegistration extends CommandRegistration {}

export interface MenuResolveOptions {
  maxDepth?: number;
  includeDisabled?: boolean;
}

export type MenuContext = CommandContext;
