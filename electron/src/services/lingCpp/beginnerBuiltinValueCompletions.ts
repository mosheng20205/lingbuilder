export interface BeginnerBuiltinValueCompletion {
  label: string;
  detail: string;
  insertText: string;
  aliases: string[];
  kind: '代码';
}

/** 新手正文编辑器中的基础字面量。短别名必须可直接精确命中。 */
export const BEGINNER_BUILTIN_VALUE_COMPLETIONS: BeginnerBuiltinValueCompletion[] = [
  {
    label: '真',
    detail: '逻辑值 · 条件成立或开启',
    insertText: '真',
    aliases: ['z', 'zhen', 'true', '布尔真', '开启', '是'],
    kind: '代码'
  },
  {
    label: '假',
    detail: '逻辑值 · 条件不成立或关闭',
    insertText: '假',
    aliases: ['j', 'jia', 'false', '布尔假', '关闭', '否'],
    kind: '代码'
  }
];

export function getBeginnerBuiltinValueCompletions(token: string): BeginnerBuiltinValueCompletion[] {
  const query = token.trim().toLowerCase();
  if (!query) return BEGINNER_BUILTIN_VALUE_COMPLETIONS;
  return BEGINNER_BUILTIN_VALUE_COMPLETIONS
    .map(item => {
      const values = [item.label, ...item.aliases].map(value => value.toLowerCase());
      const rank = values.some(value => value === query)
        ? 0
        : values.some(value => value.startsWith(query))
          ? 1
          : values.some(value => value.includes(query))
            ? 2
            : 9;
      return { item, rank };
    })
    .filter(result => result.rank < 9)
    .sort((left, right) => left.rank - right.rank)
    .map(result => result.item);
}
