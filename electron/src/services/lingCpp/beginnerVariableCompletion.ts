import { buildChineseCompletionSearchAliases } from './completionSearchAliases';

export interface BeginnerVariableCompletionInput {
  name: string;
  type?: string;
  scope: '局部变量' | '局部常量' | '程序集变量' | '项目全局变量' | '项目常量';
  ownerName?: string;
  aliases?: string[];
}

export interface BeginnerVariableCompletionItem {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '变量';
}

/**
 * 新手正文编辑器的常量候选：统一以 #name 规范形态上屏（含 # 前缀）。
 * 项目常量与模块常量共用同一检索规则；# 触发场景由调用方剥掉前缀。
 */
export interface BeginnerConstantCompletionInput {
  name: string;
  type?: string;
  origin: '项目常量' | '模块常量';
  value?: string;
  moduleName?: string;
  aliases?: string[];
}

export interface BeginnerConstantCompletionItem {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '常量';
}

export function createBeginnerConstantCompletion(
  input: BeginnerConstantCompletionInput
): BeginnerConstantCompletionItem {
  const name = input.name.trim();
  const type = input.type?.trim() || '整数型';
  return {
    label: `#${name}`,
    detail: `${type} ${input.origin}${input.moduleName ? ` · ${input.moduleName}` : ''}`,
    insertText: `#${name}`,
    aliases: Array.from(new Set([
      name,
      `#${name}`,
      type,
      input.origin,
      input.value || '',
      ...(input.aliases || []),
      ...buildChineseCompletionSearchAliases(name)
    ].filter(Boolean))),
    kind: '常量'
  };
}

/**
 * 新手正文编辑器的变量候选。变量名在这里统一生成全拼和拼音首字母，
 * 保证局部变量、局部常量、程序集变量与项目全局变量使用相同的检索规则。
 */
export function createBeginnerVariableCompletion(
  input: BeginnerVariableCompletionInput
): BeginnerVariableCompletionItem {
  const name = input.name.trim();
  const type = input.type?.trim() || '对象';
  const owner = input.ownerName?.trim();
  return {
    label: name,
    detail: `${type} ${input.scope}${owner ? ` · ${owner}` : ''}`,
    insertText: name,
    aliases: Array.from(new Set([
      name,
      type,
      input.scope,
      ...(input.aliases || []),
      ...buildChineseCompletionSearchAliases(name)
    ].filter(Boolean))),
    kind: '变量'
  };
}
