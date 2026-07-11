export type CommandContext = Readonly<Record<string, unknown>>;

export type CommandWhenPredicate = (context: CommandContext) => boolean;

/**
 * 命令的上下文条件。字符串语法支持 `!`、`&&`、`||`、括号和相等/不等比较。
 * 例如：`editor.languageId == lingcpp && workspace.trusted`。
 */
export type CommandWhenClause = boolean | string | CommandWhenPredicate;

export type CommandEnabledState = boolean | CommandWhenPredicate;

export type CommandHandler = (
  context: CommandContext,
  ...args: unknown[]
) => unknown | Promise<unknown>;

export interface CommandDefinition {
  /** 稳定且唯一的命令 ID，例如 `workbench.action.files.save`。 */
  id: string;
  /** 面向中文用户的命令标题。 */
  title: string;
  /** 可用于英文搜索和调用的 alias。 */
  aliases?: readonly string[];
  category?: string;
  description?: string;
  keybindings?: readonly string[];
  keybindingPriority?: number;
  when?: CommandWhenClause;
  enabled?: CommandEnabledState;
  order?: number;
  handler: CommandHandler;
}

export interface RegisteredCommand {
  id: string;
  title: string;
  aliases: readonly string[];
  category?: string;
  description?: string;
  keybindings: readonly string[];
  keybindingPriority: number;
  order: number;
}

export interface CommandPresentation extends RegisteredCommand {
  whenMatched: boolean;
  enabled: boolean;
}

export interface CommandQueryOptions {
  /** 默认不返回 when 条件不成立的命令。 */
  includeUnavailable?: boolean;
  /** 默认保留已禁用命令，便于命令面板显示禁用态。 */
  includeDisabled?: boolean;
  limit?: number;
}

export type CommandDiagnosticSeverity = 'error' | 'warning';

export type CommandDiagnosticCode =
  | 'invalid-command'
  | 'duplicate-command-id'
  | 'alias-conflict'
  | 'invalid-when-clause'
  | 'invalid-keybinding'
  | 'duplicate-command-keybinding'
  | 'keybinding-conflict'
  | 'when-evaluation-failed'
  | 'enabled-evaluation-failed';

export interface CommandDiagnostic {
  code: CommandDiagnosticCode;
  severity: CommandDiagnosticSeverity;
  message: string;
  commandId?: string;
  relatedCommandId?: string;
  keybinding?: string;
}

export type CommandErrorCode =
  | 'command-not-found'
  | 'command-unavailable'
  | 'command-disabled'
  | 'command-execution-failed'
  | 'keybinding-not-found'
  | 'invalid-keybinding'
  | 'context-evaluation-failed'
  | 'registration-failed';

export interface CommandRegistration {
  dispose(): void;
}

export type CommandChangeReason = 'registered' | 'unregistered';

export interface CommandChangeEvent {
  reason: CommandChangeReason;
  commandId: string;
}

export type CommandChangeListener = (event: CommandChangeEvent) => void;

