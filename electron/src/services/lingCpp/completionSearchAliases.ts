import { pinyin } from 'pinyin-pro';

const IDENTIFIER_SEPARATOR = /([_.-]+)/u;
const CHINESE_CHARACTER = /[\u3400-\u9fff]/u;

/**
 * 为中文命令生成全拼、首字母和中英混合检索键。
 * 保留 `_` 等标识符分隔符，因此 `控件_sz` 可以匹配
 * `控件_设置选择项`，而 `kj` 也可以匹配其首字母索引。
 */
export function buildChineseCompletionSearchAliases(label: string): string[] {
  const normalized = label.trim();
  if (!normalized || !CHINESE_CHARACTER.test(normalized)) return [];

  const parts = normalized.split(IDENTIFIER_SEPARATOR).filter(Boolean);
  const choices = parts.map(part => {
    if (IDENTIFIER_SEPARATOR.test(part)) return [part];
    if (!CHINESE_CHARACTER.test(part)) return [part.toLowerCase()];
    const full = pinyin(part, { toneType: 'none', type: 'array' }).join('').toLowerCase();
    const initials = pinyin(part, { pattern: 'first', toneType: 'none', type: 'array' }).join('').toLowerCase();
    return Array.from(new Set([part, full, initials].filter(Boolean)));
  });

  let combinations = [''];
  for (const alternatives of choices) {
    combinations = combinations.flatMap(prefix => alternatives.map(value => `${prefix}${value}`));
  }

  return Array.from(new Set(combinations.filter(value => value && value !== normalized)));
}

/**
 * 为补全控件挑选最贴近当前输入的过滤文本。
 * Monaco 会再次按 filterText 过滤服务层返回的候选；若只传中文 label，
 * 即使服务层已经用 `bj` 找到“本机”，候选仍可能被 Monaco 隐藏。
 */
export function selectCompletionFilterText(
  label: string,
  aliases: readonly string[],
  triggerText: string
): string {
  const query = triggerText.trim().toLowerCase();
  if (!query) return label;

  const candidates = Array.from(new Set([label, ...aliases].filter(Boolean)));
  return candidates.find(value => value.toLowerCase() === query)
    || candidates.find(value => value.toLowerCase().startsWith(query))
    || candidates.find(value => value.toLowerCase().includes(query))
    || label;
}
