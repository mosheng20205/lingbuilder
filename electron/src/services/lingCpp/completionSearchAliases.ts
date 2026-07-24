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
