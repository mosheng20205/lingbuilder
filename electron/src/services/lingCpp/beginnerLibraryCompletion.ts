import type { LingCppFunctionLibrary, LingCppParameter } from './types';
import { buildChineseCompletionSearchAliases } from './completionSearchAliases';
import { normalizeIdentifier } from './parser';

/**
 * 新手模式跨文件功能库补全条目：结构兼容 DiffViewer 的 BeginnerCodeCompletion（kind 恒为 '子程序'）。
 */
export interface BeginnerLibraryFunctionCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '子程序';
}

/** 与当前文件 codeTargets 子程序条目同一套默认实参口径，保证同一功能两种来源的 insertText 完全一致。 */
export function getBeginnerDefaultArgument(parameter: LingCppParameter): string {
  const defaultValue = parameter.defaultValue?.trim();
  if (defaultValue) return defaultValue;
  if (/文本/u.test(parameter.type)) return '"文本"';
  if (/逻辑/u.test(parameter.type)) return '真';
  if (/小数|双精度/u.test(parameter.type)) return '0.0';
  if (/整数|长整数/u.test(parameter.type)) return '0';
  return parameter.name || parameter.type || '参数';
}

/**
 * 把项目功能库（独立 .lcpp 功能代码文件）的公开功能折叠成 `库名.功能名(默认实参)` 形态的新手补全条目。
 * 只出公开功能：跨文件调用私有功能会被诊断阻断；当前文件自己的功能库由 codeTargets 既有目录提供
 * （含私有功能，库内调用允许），调用方通过 excludeLibraryNames 传入当前文件库名避免重复条目。
 * 条目 label 天然以 `库名.` 开头，与补全 token 字符集里的 `.` 配合即可命中限定名前缀过滤。
 */
export function createBeginnerLibraryFunctionCompletions(
  libraries: LingCppFunctionLibrary[] | undefined,
  excludeLibraryNames: ReadonlyArray<string> = []
): BeginnerLibraryFunctionCompletion[] {
  if (!libraries?.length) return [];
  const excluded = new Set(excludeLibraryNames.map(name => normalizeIdentifier(name)));
  const items: BeginnerLibraryFunctionCompletion[] = [];
  libraries.forEach(library => {
    if (excluded.has(normalizeIdentifier(library.name))) return;
    library.methods.forEach(method => {
      if (method.kind !== 'method' || method.access !== '公开') return;
      const qualifiedName = `${library.name}.${method.name}`;
      items.push({
        label: qualifiedName,
        detail: `${method.returnType || '空'} 子程序调用`,
        insertText: `${qualifiedName}(${method.parameters.map(parameter => getBeginnerDefaultArgument(parameter)).join(', ')})`,
        aliases: Array.from(new Set([
          method.name,
          library.name,
          '功能库', '子程序', '功能', '调用',
          ...buildChineseCompletionSearchAliases(qualifiedName),
          ...buildChineseCompletionSearchAliases(method.name)
        ])),
        kind: '子程序'
      });
    });
  });
  return items;
}
