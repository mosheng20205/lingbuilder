import { compileCommandWhenClause, CommandWhenSyntaxError } from './whenClause';
import type {
  CommandChangeListener,
  CommandContext,
  CommandDefinition,
  CommandDiagnostic,
  CommandEnabledState,
  CommandErrorCode,
  CommandPresentation,
  CommandQueryOptions,
  CommandRegistration,
  CommandWhenPredicate,
  RegisteredCommand
} from './types';

interface CommandRecord extends RegisteredCommand {
  handler: CommandDefinition['handler'];
  when: CommandWhenPredicate;
  enabledState: CommandEnabledState;
}

const EMPTY_CONTEXT: CommandContext = Object.freeze({});
const MODIFIER_ORDER = ['Mod', 'Ctrl', 'Meta', 'Alt', 'Shift'] as const;
const commandCollator = new Intl.Collator('zh-CN', {
  numeric: true,
  sensitivity: 'base'
});

export class CommandServiceError extends Error {
  readonly code: CommandErrorCode;
  readonly commandId?: string;
  readonly keybinding?: string;

  constructor(
    code: CommandErrorCode,
    message: string,
    options: { commandId?: string; keybinding?: string; cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'CommandServiceError';
    this.code = code;
    this.commandId = options.commandId;
    this.keybinding = options.keybinding;
  }
}

export class CommandRegistrationError extends CommandServiceError {
  readonly diagnostic: CommandDiagnostic;

  constructor(diagnostic: CommandDiagnostic, cause?: unknown) {
    super('registration-failed', diagnostic.message, {
      commandId: diagnostic.commandId,
      keybinding: diagnostic.keybinding,
      cause
    });
    this.name = 'CommandRegistrationError';
    this.diagnostic = diagnostic;
  }
}

export class CommandService {
  private readonly commands = new Map<string, CommandRecord>();
  private readonly aliases = new Map<string, string>();
  private readonly diagnostics: CommandDiagnostic[] = [];
  private readonly listeners = new Set<CommandChangeListener>();

  registerCommand(definition: CommandDefinition): CommandRegistration {
    let prepared: CommandRecord;
    try {
      prepared = this.prepareDefinition(definition);
    } catch (error) {
      if (error instanceof CommandRegistrationError) this.addDiagnostic(error.diagnostic);
      throw error;
    }
    this.commands.set(prepared.id, prepared);
    prepared.aliases.forEach(alias => this.aliases.set(normalizeSearchText(alias), prepared.id));
    this.reportKeybindingConflicts(prepared);
    this.emitChange('registered', prepared.id);

    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        if (this.commands.get(prepared.id) === prepared) this.unregisterCommand(prepared.id);
      }
    };
  }

  registerCommands(definitions: readonly CommandDefinition[]): CommandRegistration {
    const registrations: CommandRegistration[] = [];
    try {
      definitions.forEach(definition => registrations.push(this.registerCommand(definition)));
    } catch (error) {
      [...registrations].reverse().forEach(registration => registration.dispose());
      throw error;
    }
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        [...registrations].reverse().forEach(registration => registration.dispose());
      }
    };
  }

  unregisterCommand(commandId: string): boolean {
    const record = this.commands.get(commandId);
    if (!record) return false;
    this.commands.delete(commandId);
    record.aliases.forEach(alias => {
      const normalized = normalizeSearchText(alias);
      if (this.aliases.get(normalized) === commandId) this.aliases.delete(normalized);
    });
    this.emitChange('unregistered', commandId);
    return true;
  }

  hasCommand(commandIdOrAlias: string): boolean {
    return this.resolveRecord(commandIdOrAlias) !== undefined;
  }

  getCommand(commandIdOrAlias: string): RegisteredCommand | undefined {
    const record = this.resolveRecord(commandIdOrAlias);
    return record ? toRegisteredCommand(record) : undefined;
  }

  getCommandState(
    commandIdOrAlias: string,
    context: CommandContext = EMPTY_CONTEXT
  ): CommandPresentation {
    const record = this.requireRecord(commandIdOrAlias);
    return this.toPresentation(record, context, false);
  }

  listCommands(
    context: CommandContext = EMPTY_CONTEXT,
    options: CommandQueryOptions = {}
  ): CommandPresentation[] {
    const limit = validateLimit(options.limit);
    const rows = [...this.commands.values()]
      .map(record => this.toPresentation(record, context, true))
      .filter(row => options.includeUnavailable || row.whenMatched)
      .filter(row => options.includeDisabled !== false || row.enabled)
      .sort(comparePresentation);
    return limit === undefined ? rows : rows.slice(0, limit);
  }

  searchCommands(
    query: string,
    context: CommandContext = EMPTY_CONTEXT,
    options: CommandQueryOptions = {}
  ): CommandPresentation[] {
    const normalizedQuery = normalizeSearchText(query);
    const tokens = normalizedQuery.split(/\s+/u).filter(Boolean);
    const limit = validateLimit(options.limit);

    const rows = [...this.commands.values()]
      .map(record => ({
        presentation: this.toPresentation(record, context, true),
        score: scoreCommand(record, normalizedQuery, tokens)
      }))
      .filter(row => options.includeUnavailable || row.presentation.whenMatched)
      .filter(row => options.includeDisabled !== false || row.presentation.enabled)
      .filter(row => tokens.length === 0 || row.score >= 0)
      .sort((left, right) => right.score - left.score || comparePresentation(left.presentation, right.presentation))
      .map(row => row.presentation);
    return limit === undefined ? rows : rows.slice(0, limit);
  }

  resolveKeybinding(
    keybinding: string,
    context: CommandContext = EMPTY_CONTEXT
  ): CommandPresentation[] {
    const normalized = normalizeKeybindingOrThrow(keybinding);
    return [...this.commands.values()]
      .filter(record => record.keybindings.includes(normalized))
      .map(record => this.toPresentation(record, context, true))
      .filter(row => row.whenMatched && row.enabled)
      .sort((left, right) => (
        right.keybindingPriority - left.keybindingPriority
        || comparePresentation(left, right)
      ));
  }

  async executeCommand<TResult = unknown>(
    commandIdOrAlias: string,
    context: CommandContext = EMPTY_CONTEXT,
    ...args: unknown[]
  ): Promise<TResult> {
    const record = this.requireRecord(commandIdOrAlias);
    const state = this.toPresentation(record, context, false);
    const displayName = formatCommandName(record);
    if (!state.whenMatched) {
      throw new CommandServiceError(
        'command-unavailable',
        `命令${displayName}在当前上下文中不可用。`,
        { commandId: record.id }
      );
    }
    if (!state.enabled) {
      throw new CommandServiceError(
        'command-disabled',
        `命令${displayName}当前已禁用。`,
        { commandId: record.id }
      );
    }

    try {
      return await record.handler(context, ...args) as TResult;
    } catch (error) {
      if (error instanceof CommandServiceError) throw error;
      const detail = error instanceof Error && error.message ? `：${error.message}` : '。';
      throw new CommandServiceError(
        'command-execution-failed',
        `执行命令${displayName}失败${detail}`,
        { commandId: record.id, cause: error }
      );
    }
  }

  async executeKeybinding<TResult = unknown>(
    keybinding: string,
    context: CommandContext = EMPTY_CONTEXT,
    ...args: unknown[]
  ): Promise<TResult> {
    const normalized = normalizeKeybindingOrThrow(keybinding);
    const matches = this.resolveKeybinding(normalized, context);
    if (matches.length === 0) {
      throw new CommandServiceError(
        'keybinding-not-found',
        `快捷键“${normalized}”在当前上下文中没有可执行的命令。`,
        { keybinding: normalized }
      );
    }
    return this.executeCommand<TResult>(matches[0].id, context, ...args);
  }

  getDiagnostics(): readonly CommandDiagnostic[] {
    return this.diagnostics.map(diagnostic => ({ ...diagnostic }));
  }

  clearDiagnostics(): void {
    this.diagnostics.length = 0;
  }

  onDidChange(listener: CommandChangeListener): CommandRegistration {
    this.listeners.add(listener);
    let disposed = false;
    return {
      dispose: () => {
        if (disposed) return;
        disposed = true;
        this.listeners.delete(listener);
      }
    };
  }

  private prepareDefinition(definition: CommandDefinition): CommandRecord {
    if (!definition || typeof definition !== 'object') {
      throw this.failRegistration({
        code: 'invalid-command',
        severity: 'error',
        message: '命令定义必须是对象。'
      });
    }

    const id = requireText(definition.id, '命令 ID', definition.id);
    if (/\s/u.test(id)) {
      throw this.failRegistration({
        code: 'invalid-command',
        severity: 'error',
        message: `命令 ID“${id}”不能包含空白字符。`,
        commandId: id
      });
    }
    if (this.commands.has(id)) {
      throw this.failRegistration({
        code: 'duplicate-command-id',
        severity: 'error',
        message: `命令 ID“${id}”已注册，不能重复注册。`,
        commandId: id,
        relatedCommandId: id
      });
    }

    const conflictingAliasOwner = this.aliases.get(normalizeSearchText(id));
    if (conflictingAliasOwner) {
      throw this.failRegistration({
        code: 'alias-conflict',
        severity: 'error',
        message: `命令 ID“${id}”与已注册命令“${conflictingAliasOwner}”的 alias 冲突。`,
        commandId: id,
        relatedCommandId: conflictingAliasOwner
      });
    }

    const title = requireText(definition.title, '中文命令标题', id);
    if (typeof definition.handler !== 'function') {
      throw this.failRegistration({
        code: 'invalid-command',
        severity: 'error',
        message: `命令“${id}”缺少可执行的 handler。`,
        commandId: id
      });
    }

    const aliases = normalizeAliases(definition.aliases, id);
    const localAliases = new Set<string>();
    aliases.forEach(alias => {
      const normalized = normalizeSearchText(alias);
      if (localAliases.has(normalized)) {
        throw this.failRegistration({
          code: 'alias-conflict',
          severity: 'error',
          message: `命令“${id}”重复声明了 alias“${alias}”。`,
          commandId: id
        });
      }
      localAliases.add(normalized);
      const owner = this.findAliasOrIdOwner(normalized);
      if (owner) {
        throw this.failRegistration({
          code: 'alias-conflict',
          severity: 'error',
          message: `命令“${id}”的 alias“${alias}”与命令“${owner}”冲突。`,
          commandId: id,
          relatedCommandId: owner
        });
      }
    });

    let when: CommandWhenPredicate;
    try {
      when = compileCommandWhenClause(definition.when);
    } catch (error) {
      const detail = error instanceof CommandWhenSyntaxError ? error.message : '未知语法错误';
      throw this.failRegistration({
        code: 'invalid-when-clause',
        severity: 'error',
        message: `命令“${id}”的 when 条件无效：${detail}。`,
        commandId: id
      }, error);
    }

    if (definition.keybindings !== undefined && !Array.isArray(definition.keybindings)) {
      throw this.failRegistration({
        code: 'invalid-keybinding',
        severity: 'error',
        message: `命令“${id}”的 keybindings 必须是字符串数组。`,
        commandId: id
      });
    }

    const keybindings: string[] = [];
    const localKeybindings = new Set<string>();
    for (const source of definition.keybindings ?? []) {
      let normalized: string;
      try {
        normalized = normalizeKeybinding(source);
      } catch (error) {
        const detail = error instanceof Error ? error.message : '未知错误';
        throw this.failRegistration({
          code: 'invalid-keybinding',
          severity: 'error',
          message: `命令“${id}”的快捷键无效：${detail}`,
          commandId: id,
          keybinding: String(source)
        }, error);
      }
      if (localKeybindings.has(normalized)) {
        this.addDiagnostic({
          code: 'duplicate-command-keybinding',
          severity: 'warning',
          message: `命令“${id}”重复声明了快捷键“${normalized}”，已自动去重。`,
          commandId: id,
          keybinding: normalized
        });
        continue;
      }
      localKeybindings.add(normalized);
      keybindings.push(normalized);
    }

    const order = this.requireFiniteNumber(definition.order ?? 0, `命令“${id}”的 order`, id);
    const keybindingPriority = this.requireFiniteNumber(
      definition.keybindingPriority ?? 0,
      `命令“${id}”的 keybindingPriority`,
      id
    );

    if (
      definition.enabled !== undefined
      && typeof definition.enabled !== 'boolean'
      && typeof definition.enabled !== 'function'
    ) {
      throw this.failRegistration({
        code: 'invalid-command',
        severity: 'error',
        message: `命令“${id}”的 enabled 必须是布尔值或函数。`,
        commandId: id
      });
    }

    return {
      id,
      title,
      aliases: Object.freeze([...aliases]),
      category: optionalText(definition.category),
      description: optionalText(definition.description),
      keybindings: Object.freeze(keybindings),
      keybindingPriority,
      order,
      handler: definition.handler,
      when,
      enabledState: definition.enabled ?? true
    };
  }

  private reportKeybindingConflicts(record: CommandRecord): void {
    record.keybindings.forEach(keybinding => {
      this.commands.forEach(other => {
        if (other === record || !other.keybindings.includes(keybinding)) return;
        this.addDiagnostic({
          code: 'keybinding-conflict',
          severity: 'warning',
          message: `快捷键“${keybinding}”同时绑定了命令“${other.id}”和“${record.id}”；将按上下文、优先级和稳定顺序解析。`,
          commandId: record.id,
          relatedCommandId: other.id,
          keybinding
        });
      });
    });
  }

  private requireFiniteNumber(value: unknown, label: string, commandId: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw this.failRegistration({
        code: 'invalid-command',
        severity: 'error',
        message: `${label}必须是有限数字。`,
        commandId
      });
    }
    return value;
  }

  private findAliasOrIdOwner(normalized: string): string | undefined {
    const aliasOwner = this.aliases.get(normalized);
    if (aliasOwner) return aliasOwner;
    return [...this.commands.keys()].find(id => normalizeSearchText(id) === normalized);
  }

  private resolveRecord(commandIdOrAlias: string): CommandRecord | undefined {
    if (typeof commandIdOrAlias !== 'string') return undefined;
    const source = commandIdOrAlias.trim();
    if (!source) return undefined;
    return this.commands.get(source)
      ?? this.commands.get(this.aliases.get(normalizeSearchText(source)) ?? '');
  }

  private requireRecord(commandIdOrAlias: string): CommandRecord {
    const record = this.resolveRecord(commandIdOrAlias);
    if (record) return record;
    const source = typeof commandIdOrAlias === 'string' && commandIdOrAlias.trim()
      ? commandIdOrAlias.trim()
      : '空命令';
    throw new CommandServiceError(
      'command-not-found',
      `找不到命令“${source}”，请检查命令 ID 或英文 alias。`
    );
  }

  private toPresentation(
    record: CommandRecord,
    context: CommandContext,
    safe: boolean
  ): CommandPresentation {
    let whenMatched = false;
    try {
      whenMatched = Boolean(record.when(context));
    } catch (error) {
      if (!safe) throw contextEvaluationError(record, 'when', error);
      this.addRuntimeDiagnosticOnce({
        code: 'when-evaluation-failed',
        severity: 'warning',
        message: `命令“${record.id}”的 when 条件计算失败，命令已在本次查询中隐藏。`,
        commandId: record.id
      });
    }

    let enabled = false;
    if (whenMatched) {
      try {
        enabled = typeof record.enabledState === 'function'
          ? Boolean(record.enabledState(context))
          : record.enabledState;
      } catch (error) {
        if (!safe) throw contextEvaluationError(record, 'enabled', error);
        this.addRuntimeDiagnosticOnce({
          code: 'enabled-evaluation-failed',
          severity: 'warning',
          message: `命令“${record.id}”的 enabled 状态计算失败，命令已在本次查询中禁用。`,
          commandId: record.id
        });
      }
    }

    return {
      ...toRegisteredCommand(record),
      whenMatched,
      enabled
    };
  }

  private failRegistration(diagnostic: CommandDiagnostic, cause?: unknown): CommandRegistrationError {
    return new CommandRegistrationError(diagnostic, cause);
  }

  private addDiagnostic(diagnostic: CommandDiagnostic): void {
    this.diagnostics.push({ ...diagnostic });
  }

  private addRuntimeDiagnosticOnce(diagnostic: CommandDiagnostic): void {
    if (this.diagnostics.some(item => item.code === diagnostic.code && item.commandId === diagnostic.commandId)) return;
    this.addDiagnostic(diagnostic);
  }

  private emitChange(reason: 'registered' | 'unregistered', commandId: string): void {
    this.listeners.forEach(listener => {
      try {
        listener({ reason, commandId });
      } catch {
        // 监听器错误不应破坏命令注册表的一致性。
      }
    });
  }
}

export function createCommandService(): CommandService {
  return new CommandService();
}

export function normalizeKeybinding(keybinding: string): string {
  if (typeof keybinding !== 'string' || !keybinding.trim()) {
    throw new Error('快捷键不能为空。');
  }

  const compact = keybinding.trim().replace(/\s*\+\s*/gu, '+');
  const strokes = compact.split(/\s+/u);
  return strokes.map(normalizeKeybindingStroke).join(' ');
}

function normalizeKeybindingOrThrow(keybinding: string): string {
  try {
    return normalizeKeybinding(keybinding);
  } catch (error) {
    throw new CommandServiceError(
      'invalid-keybinding',
      `快捷键无效：${error instanceof Error ? error.message : '未知错误'}`,
      { keybinding: String(keybinding), cause: error }
    );
  }
}

function normalizeKeybindingStroke(stroke: string): string {
  const parts = stroke.split('+');
  if (parts.some(part => !part)) throw new Error(`“${stroke}”包含空的按键段。`);

  const modifiers = new Set<string>();
  let key: string | undefined;
  parts.forEach(part => {
    const modifier = normalizeModifier(part);
    if (modifier) {
      modifiers.add(modifier);
      return;
    }
    if (key) throw new Error(`“${stroke}”每一段只能包含一个普通按键。`);
    key = normalizeKey(part);
  });

  if (!key) throw new Error(`“${stroke}”缺少普通按键。`);
  if (modifiers.has('Mod') && (modifiers.has('Ctrl') || modifiers.has('Meta'))) {
    throw new Error(`“${stroke}”不能同时使用 Mod 和 Ctrl/Meta。`);
  }
  return [
    ...MODIFIER_ORDER.filter(modifier => modifiers.has(modifier)),
    key
  ].join('+');
}

function normalizeModifier(source: string): string | undefined {
  switch (source.trim().toLowerCase()) {
    case 'mod':
    case 'cmdorctrl':
    case 'commandorcontrol':
      return 'Mod';
    case 'ctrl':
    case 'control':
      return 'Ctrl';
    case 'cmd':
    case 'command':
    case 'meta':
    case 'win':
    case 'super':
      return 'Meta';
    case 'alt':
    case 'option':
      return 'Alt';
    case 'shift':
      return 'Shift';
    default:
      return undefined;
  }
}

function normalizeKey(source: string): string {
  const value = source.trim();
  const lower = value.toLowerCase();
  const aliases: Record<string, string> = {
    esc: 'Escape',
    escape: 'Escape',
    return: 'Enter',
    enter: 'Enter',
    space: 'Space',
    spacebar: 'Space',
    tab: 'Tab',
    backspace: 'Backspace',
    delete: 'Delete',
    del: 'Delete',
    insert: 'Insert',
    home: 'Home',
    end: 'End',
    pageup: 'PageUp',
    pgup: 'PageUp',
    pagedown: 'PageDown',
    pgdn: 'PageDown',
    up: 'ArrowUp',
    arrowup: 'ArrowUp',
    down: 'ArrowDown',
    arrowdown: 'ArrowDown',
    left: 'ArrowLeft',
    arrowleft: 'ArrowLeft',
    right: 'ArrowRight',
    arrowright: 'ArrowRight'
  };
  if (aliases[lower]) return aliases[lower];
  if (/^f(?:[1-9]|1\d|2[0-4])$/iu.test(value)) return value.toUpperCase();
  if (/^[a-z]$/iu.test(value)) return value.toUpperCase();
  if (/^[0-9]$/u.test(value)) return value;
  if (/^[^\s+]+$/u.test(value)) return value.length === 1 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;
  throw new Error(`无法识别按键“${source}”。`);
}

function normalizeAliases(aliases: readonly string[] | undefined, commandId: string): string[] {
  if (aliases === undefined) return [];
  if (!Array.isArray(aliases)) {
    throw new CommandRegistrationError({
      code: 'invalid-command',
      severity: 'error',
      message: `命令“${commandId}”的 aliases 必须是字符串数组。`,
      commandId
    });
  }
  return aliases.map((alias, index) => requireText(alias, `aliases[${index}]`, commandId));
}

function requireText(value: unknown, label: string, commandId?: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new CommandRegistrationError({
      code: 'invalid-command',
      severity: 'error',
      message: `${label}不能为空。`,
      commandId
    });
  }
  return value.trim();
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function validateLimit(limit: number | undefined): number | undefined {
  if (limit === undefined) return undefined;
  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error('命令查询的 limit 必须是大于或等于 0 的整数。');
  }
  return limit;
}

function toRegisteredCommand(record: CommandRecord): RegisteredCommand {
  return {
    id: record.id,
    title: record.title,
    aliases: [...record.aliases],
    category: record.category,
    description: record.description,
    keybindings: [...record.keybindings],
    keybindingPriority: record.keybindingPriority,
    order: record.order
  };
}

function comparePresentation(left: CommandPresentation, right: CommandPresentation): number {
  return left.order - right.order
    || commandCollator.compare(left.category ?? '', right.category ?? '')
    || commandCollator.compare(left.title, right.title)
    || commandCollator.compare(left.id, right.id);
}

function scoreCommand(record: CommandRecord, query: string, tokens: readonly string[]): number {
  if (!query) return 0;
  const id = normalizeSearchText(record.id);
  const title = normalizeSearchText(record.title);
  const aliases = record.aliases.map(normalizeSearchText);
  const category = normalizeSearchText(record.category ?? '');
  const description = normalizeSearchText(record.description ?? '');
  let total = 0;

  for (const token of tokens) {
    const scores = [
      exactOrPartialScore(title, token, 1100, 850, 500),
      exactOrPartialScore(id, token, 1050, 760, 460),
      ...aliases.map(alias => exactOrPartialScore(alias, token, 1080, 820, 480)),
      exactOrPartialScore(category, token, 700, 560, 320),
      exactOrPartialScore(description, token, 400, 300, 180)
    ];
    const best = Math.max(...scores);
    if (best < 0) return -1;
    total += best;
  }

  if (title === query || id === query || aliases.includes(query)) total += 1500;
  return total;
}

function exactOrPartialScore(
  value: string,
  token: string,
  exact: number,
  prefix: number,
  contains: number
): number {
  if (!value) return -1;
  if (value === token) return exact;
  if (value.startsWith(token)) return prefix;
  if (value.includes(token)) return contains;
  return -1;
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function contextEvaluationError(
  record: CommandRecord,
  target: 'when' | 'enabled',
  cause: unknown
): CommandServiceError {
  const label = target === 'when' ? 'when 条件' : 'enabled 状态';
  const detail = cause instanceof Error && cause.message ? `：${cause.message}` : '。';
  return new CommandServiceError(
    'context-evaluation-failed',
    `命令“${record.id}”的 ${label}计算失败${detail}`,
    { commandId: record.id, cause }
  );
}

function formatCommandName(record: CommandRecord): string {
  return `“${record.title}”（${record.id}）`;
}
