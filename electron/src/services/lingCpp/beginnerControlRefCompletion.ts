import type { LingCppControlReferenceCompletion } from './controlReferenceService';
import { buildChineseCompletionSearchAliases } from './completionSearchAliases';

/**
 * 新手模式 controlRef 参数位置补全条目：结构兼容 DiffViewer 的 BeginnerCodeCompletion。
 * 与 Monaco `getLingCppCompletionItems` 的控件引用分支消费同一份
 * `getLingCppControlReferenceCompletion` 契约：参数位置只出当前作用域内兼容的
 * 设计器控件/非可视组件/设计器资源与运行时控件变量，上屏一律插裸控件名。
 */
export interface BeginnerControlReferenceCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '变量' | '窗口';
}

function describeControlSymbolKind(kind: string): string {
  if (kind === 'resource') return '设计器资源';
  if (kind === 'nonVisual') return '非可视组件';
  return '设计器控件';
}

export function createBeginnerControlReferenceCompletions(
  completion: LingCppControlReferenceCompletion
): BeginnerControlReferenceCompletion[] {
  const items: BeginnerControlReferenceCompletion[] = completion.symbols.map(symbol => {
    const kindLabel = describeControlSymbolKind(symbol.kind);
    return {
      label: symbol.name,
      detail: `${kindLabel} · ${symbol.controlType} · ${symbol.windowName}`,
      insertText: symbol.name,
      aliases: Array.from(new Set([
        symbol.name,
        symbol.controlType,
        symbol.windowName,
        kindLabel,
        '控件', '组件',
        completion.parameter.name,
        ...buildChineseCompletionSearchAliases(symbol.name)
      ])),
      kind: '变量' as const
    };
  });
  completion.runtimeVariables.forEach(variable => {
    items.push({
      label: variable.name,
      detail: `${variable.kind === 'local' ? '局部控件变量' : '控件参数'} · ${variable.type}`,
      insertText: variable.name,
      aliases: Array.from(new Set([
        variable.name,
        variable.type,
        '控件变量', '运行时控件',
        completion.parameter.name,
        ...buildChineseCompletionSearchAliases(variable.name)
      ])),
      kind: '变量'
    });
  });
  if (completion.acceptsCurrentWindow) {
    items.push({
      label: '当前窗口',
      detail: '只读控件容器 · 当前窗口',
      insertText: '当前窗口',
      aliases: ['窗口', '父级', '容器', '当前窗口'],
      kind: '窗口'
    });
  }
  return items;
}
