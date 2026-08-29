export interface BeginnerTypeCompletionItem {
  label: string;
  detail: string;
  aliases: string[];
}

export const BEGINNER_TYPE_ALIASES: Record<string, string[]> = {
  空: ['void', 'none', 'null', 'kong', 'wu', '无返回值', '无'],
  文本型: ['string', 'text', 'str', 'wstring', 'wenben', 'wb', '字符', '字符串'],
  整数型: ['int', 'integer', 'number', 'zhengshu', 'zs', '数字'],
  长整数型: ['long', 'long long', 'int64', 'longint', 'changzhengshu', 'czs'],
  逻辑型: ['bool', 'boolean', 'logic', 'luoji', 'lj', '布尔'],
  小数型: ['float', 'decimal', 'number', 'xiaoshu', 'xs'],
  双精度小数型: ['double', 'shuangjingdu', 'sjd'],
  字节型: ['byte', 'uint8', 'zijie', 'zj'],
  对象: ['object', 'obj', 'any', 'duixiang', 'dx'],
  窗体: ['window', 'form', 'wnd', 'chuangti', 'ct'],
  按钮: ['button', 'btn', 'anniu', 'an'],
  标签: ['label', 'biaoqian', 'bq'],
  编辑框: ['edit', 'textbox', 'input', 'bianjikuang', 'bjk'],
  复选框: ['checkbox', 'check', 'fuxuankuang', 'fxk'],
  单选框: ['radio', 'danxuankuang', 'dxk'],
  下拉框: ['combo', 'select', 'dropdown', 'xialakuang', 'xlk'],
  进度条: ['progress', 'progressbar', 'jindutiao', 'jdt']
};

export function buildBeginnerTypeCompletionCatalog(types: string[]): BeginnerTypeCompletionItem[] {
  const normalizedTypes = Array.from(new Set(['空', ...types].map(type => type.trim()).filter(Boolean)));
  return normalizedTypes.map(label => {
    const aliases = Array.from(new Set([label, ...(BEGINNER_TYPE_ALIASES[label] || [])].filter(Boolean)));
    const aliasPreview = aliases.filter(alias => alias !== label).slice(0, 3).join(' / ');
    return {
      label,
      aliases,
      detail: aliasPreview ? `类型 · ${aliasPreview}` : '类型'
    };
  });
}

export function filterBeginnerTypeCompletions(
  items: BeginnerTypeCompletionItem[],
  token: string,
  includeAll = false
): BeginnerTypeCompletionItem[] {
  const normalizedToken = token.trim().toLowerCase();
  if (!normalizedToken && !includeAll) return [];
  if (!normalizedToken) return items;

  return items
    .map(item => {
      const values = item.aliases.map(alias => alias.toLowerCase());
      const label = item.label.toLowerCase();
      const exactMatch = values.some(value => value === normalizedToken);
      const labelStartsWith = label.startsWith(normalizedToken);
      const aliasStartsWith = values.some(value => value.startsWith(normalizedToken));
      const includesMatch = values.some(value => value.includes(normalizedToken));
      return {
        item,
        rank: exactMatch ? 0 : labelStartsWith ? 1 : aliasStartsWith ? 2 : includesMatch ? 3 : 9
      };
    })
    .filter(result => result.rank < 9)
    .sort((left, right) => left.rank - right.rank || left.item.label.localeCompare(right.item.label, 'zh-Hans-CN'))
    .map(result => result.item);
}

export function resolveBeginnerTypeAlias(
  items: BeginnerTypeCompletionItem[],
  rawValue: string
): string {
  const normalizedValue = rawValue.trim().toLowerCase();
  const exactAlias = items.find(item =>
    item.aliases.some(alias => alias.toLowerCase() === normalizedValue)
  );
  return exactAlias?.label || rawValue.trim();
}

/** 新手模式常见类型的默认初始值字面量；没有简单字面量的类型（日期时间型、字节集、自定义类型等）不在表中。 */
export const BEGINNER_TYPE_DEFAULT_INITIAL_VALUES: Record<string, string> = {
  文本型: '""',
  整数型: '0',
  长整数型: '0',
  字节型: '0',
  小数型: '0',
  双精度小数型: '0',
  逻辑型: '假'
};

/**
 * 新手模式修改局部变量/局部常量类型时，计算应写回的初始值：
 * - 类型未变化 → undefined（保持现有初始值）；
 * - 新类型有默认初始值字面量 → 返回该字面量，保证类型与初始值一致、可直接编译；
 * - 新类型没有简单字面量 → 变量清空初始值；局部常量必须有初始值，保留原值交由既有诊断引导。
 */
export function adaptBeginnerInitialValueForType(params: {
  previousType: string;
  nextType: string;
  isConstant?: boolean;
}): string | undefined {
  const previousType = params.previousType?.trim() || '';
  const nextType = params.nextType?.trim() || '';
  if (!nextType || nextType === previousType) return undefined;
  const defaultValue = BEGINNER_TYPE_DEFAULT_INITIAL_VALUES[nextType];
  if (defaultValue !== undefined) return defaultValue;
  return params.isConstant ? undefined : '';
}
