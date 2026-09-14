// 新手模式结构编辑器与「项目变量与常量」面板的表格列宽偏好：按表型 key + 列序号
// 记录用户拖拽后的固定列宽（像素）。未记录的列回落到各表的默认宽度逻辑。
export type BeginnerTableKey =
  | 'declaration'
  | 'process'
  | 'member'
  | 'parameters'
  | 'locals'
  | 'project-globals'
  | 'project-constants';

export const BEGINNER_TABLE_MIN_COLUMN_WIDTH = 48;
const BEGINNER_TABLE_MAX_COLUMN_WIDTH = 4000;
// v2：项目变量/常量表列宽语义升级为"拖过即钉住"，旧的 v1 偏好一次性作废，避免沿用误拖的陈旧宽度。
const STORAGE_KEY = 'lingbuilder-beginner-table-column-widths-v2';

export type BeginnerTableColumnWidthOverrides = Partial<Record<BeginnerTableKey, number[]>>;

export function readBeginnerTableColumnWidthOverrides(): BeginnerTableColumnWidthOverrides {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const result: BeginnerTableColumnWidthOverrides = {};
    for (const [tableKey, widths] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(widths)) continue;
      const cleaned = widths.map(width =>
        typeof width === 'number' && Number.isFinite(width)
          ? Math.min(BEGINNER_TABLE_MAX_COLUMN_WIDTH, Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round(width)))
          : 0
      );
      if (cleaned.some(width => width > 0)) result[tableKey as BeginnerTableKey] = cleaned;
    }
    return result;
  } catch {
    return {};
  }
}

export function writeBeginnerTableColumnWidths(overrides: BeginnerTableColumnWidthOverrides): void {
  try {
    const hasAny = Object.values(overrides).some(widths => (widths || []).some(width => width > 0));
    if (!hasAny) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
  } catch {
    // 列宽偏好持久化失败不影响编辑器本身。
  }
}

/** 「项目变量与常量」面板表格的渲染列宽（像素）。
 * 固定列（如「数组」「操作」，内容只有勾选框/按钮）永远取默认宽度，不允许被拉伸；
 * 弹性列按"持久化权重"（用户拖拽后的像素，未拖拽时为默认宽度）分摊容器剩余宽度：
 * 拖宽某一列时其余弹性列按比例让位，固定列纹丝不动；
 * containerWidth 未知（0，如服务端渲染）时按默认总宽（即 minWidth）布局。
 * 这解决了 w-full + table-fixed 把剩余宽度按比例摊给所有列、导致固定列被撑大的问题。 */
export function resolveProjectTableRenderWidths(
  defaults: readonly number[],
  fixedIndexes: ReadonlySet<number>,
  flexIndexes: ReadonlySet<number>,
  overrides: readonly number[] | undefined,
  containerWidth: number
): number[] {
  const minWidth = defaults.reduce((sum, width) => sum + width, 0);
  const target = containerWidth > 0 ? Math.max(containerWidth, minWidth) : minWidth;
  const flexPx = target - defaults.reduce((sum, width, index) => sum + (fixedIndexes.has(index) ? width : 0), 0);
  const resolved = defaults.map((width, index) => {
    if (fixedIndexes.has(index)) return width;
    const override = overrides?.[index] || 0;
    return override > 0 ? Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round(override)) : width;
  });
  // 弹性序：以最后一列（如"备注"）为吸收列。
  const flexOrder = [...flexIndexes].filter(index => !fixedIndexes.has(index)).sort((a, b) => a - b);
  if (flexOrder.length === 0 || flexPx <= 0) return resolved;
  const absorberIndex = flexOrder[flexOrder.length - 1]!;
  const absorberOverride = overrides?.[absorberIndex] || 0;
  const absorberWidth = absorberOverride > 0 ? Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round(absorberOverride)) : 0;
  const isPinned = (index: number) => (overrides?.[index] || 0) > 0;
  // 拖拽过的列 = 钉住（精确取拖拽像素，保证 1:1 跟手）；未拖拽的弹性列按默认权重分摊剩余空间。
  const pinnedOthersPx = flexOrder.reduce((sum, index) => {
    if (index === absorberIndex) return sum;
    return sum + (isPinned(index) ? resolved[index]! : 0);
  }, 0);
  const freeColumns = flexOrder.filter(index => index !== absorberIndex && !isPinned(index));
  const denominator = freeColumns.reduce((sum, index) => sum + (defaults[index] || 0), 0)
    + (absorberWidth > 0 ? 0 : defaults[absorberIndex] || 0);
  if (denominator <= 0) {
    // 所有弹性列都被拖拽钉住：吸收列改为填充剩余宽度，保证表格仍占满容器。
    resolved[absorberIndex] = Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, flexPx - pinnedOthersPx);
    return resolved;
  }
  const pool = flexPx - pinnedOthersPx - absorberWidth;
  if (pool <= 0) {
    // 容器太窄放不下全部钉住列：保留钉住列，未钉住列保持默认宽度，交给横向滚动。
    return resolved;
  }
  let used = 0;
  freeColumns.forEach((index, order) => {
    if (order === freeColumns.length - 1 && absorberWidth > 0) {
      // 吸收列被钉住时，最后一个自由列吸收取整余数，保证总宽正好填满容器；
      // 吸收列未钉住时余数归吸收列，这里用比例公式。
      resolved[index] = Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, pool - used);
      return;
    }
    const share = Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, Math.round((pool * (defaults[index] || 0)) / denominator));
    resolved[index] = share;
    used += share;
  });
  resolved[absorberIndex] = absorberWidth > 0
    ? absorberWidth
    : Math.max(BEGINNER_TABLE_MIN_COLUMN_WIDTH, flexPx - used - pinnedOthersPx);
  return resolved;
}
