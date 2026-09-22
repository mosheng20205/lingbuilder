/**
 * new_emoji 设计器控件「数据类」属性的格式契约与结构化编辑器规格。
 *
 * 背景：RichList 模板/项目、Tree 树数据等属性在设计器模型中存储为 stringList
 * （字符串数组，单条 JSON 串或每行一条分隔文本），与 new_emoji 原生运行时
 * （EU_SetRichListTemplate / EU_SetTreeDataJson 等）的消费格式一一对应。
 * 属性面板的结构化编辑器必须读写同一存储格式，保证设计器模型、
 * .lcpp 代码生成（serializeNewEmojiUtf8Property）与画布预览三条链路零迁移。
 *
 * 行分隔文本的运行时口径（new_emoji exports.cpp）：条目按任意 `|`、`\n`、`\r`
 * 拆分，字段按 `\t` 拆分；Descriptions 基础格式按首个 `：`/`:`/`=` 拆分标签与内容。
 * 因此任何字段值中的 `|`（以及 TAB 规格下的 `\t`）都必须视为非法字符。
 */
import type { Win32ControlPropertyValue } from './win32ControlRegistry';

export function readStringListValue(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item ?? ''));
  if (value === undefined || value === null) return [];
  return [String(value)];
}

function parseJsonObject(text: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : undefined;
  } catch {
    return undefined;
  }
}

function stringifyCompact(value: unknown): string {
  return JSON.stringify(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function textOf(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  return String(value);
}

function intOf(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function boolOf(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

// ---------------------------------------------------------------------------
// RichList 富列表：行模板 + 项目数据 + 默认选中
// 运行时契约（element_richlist.cpp）：template.rowHeight 必填（24~4096），
// 节点 id 唯一且非空，type 取固定枚举，x/y/w/h 必填；项目 key 唯一且非空。
// ---------------------------------------------------------------------------

export const RICH_LIST_NODE_TYPES: Array<{ value: string; label: string; hint: string }> = [
  { value: 'text', label: '文本', hint: '显示项目数据中的某个字段或固定文本' },
  { value: 'icon', label: '图标字符', hint: '显示 emoji 等字符图标' },
  { value: 'image', label: '图片', hint: '显示项目数据给出的图片' },
  { value: 'countdown', label: '倒计时', hint: '按格式显示项目数据中的倒计时' },
  { value: 'badge', label: '徽标', hint: '显示数字或圆点徽标' },
  { value: 'button', label: '按钮', hint: '行内按钮，点击事件按动作 ID 区分按钮' }
];

export interface RichListNodeDraft {
  id: string;
  type: string;
  field: string;
  text: string;
  actionId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  weight: number;
  role: string;
  color: string;
  align: number;
  ellipsis: boolean;
  wrap: boolean;
  format: string;
  variant: number;
  badgeType: number;
  badgeMax: number;
  dot: boolean;
}

function blankRichListNode(type: string): RichListNodeDraft {
  return {
    id: '',
    type,
    field: '',
    text: '',
    actionId: '',
    x: 0,
    y: 0,
    w: type === 'button' ? 86 : 120,
    h: type === 'button' ? 28 : 24,
    size: 14,
    weight: 400,
    role: '',
    color: '',
    align: 0,
    ellipsis: false,
    wrap: false,
    format: 'HH:mm:ss',
    variant: 0,
    badgeType: 0,
    badgeMax: 99,
    dot: false
  };
}

export interface RichListTemplateDraft {
  rowHeight: number;
  nodes: RichListNodeDraft[];
}

export function parseRichListTemplate(value: unknown): { ok: boolean; template: RichListTemplateDraft } {
  const raw = readStringListValue(value).join('\n').trim();
  if (!raw) return { ok: true, template: { rowHeight: 88, nodes: [] } };
  const root = parseJsonObject(raw);
  if (!root) return { ok: false, template: { rowHeight: 88, nodes: [] } };
  const source = asRecord(root.template && typeof root.template === 'object' ? root.template : root);
  if (source.rowHeight === undefined) return { ok: false, template: { rowHeight: 88, nodes: [] } };
  const nodeValues = Array.isArray(source.nodes) ? source.nodes : [];
  const nodes = nodeValues.map(item => {
    const record = asRecord(item);
    const node = blankRichListNode(textOf(record.type, 'text'));
    node.id = textOf(record.id);
    node.field = textOf(record.field);
    node.text = textOf(record.text, textOf(record.value));
    node.actionId = textOf(record.actionId, textOf(record.action));
    node.x = intOf(record.x, 0);
    node.y = intOf(record.y, 0);
    node.w = intOf(record.w, 0);
    node.h = intOf(record.h, 0);
    node.size = intOf(record.size, 14);
    node.weight = intOf(record.weight, 400);
    node.role = textOf(record.role);
    node.color = textOf(record.color);
    node.align = intOf(record.align, 0);
    node.ellipsis = boolOf(record.ellipsis);
    node.wrap = boolOf(record.wrap);
    node.format = textOf(record.format, 'HH:mm:ss');
    node.variant = intOf(record.variant, 0);
    node.badgeType = intOf(record.badgeType, 0);
    node.badgeMax = intOf(record.max, 99);
    node.dot = boolOf(record.dot);
    return node;
  });
  return { ok: true, template: { rowHeight: intOf(source.rowHeight, 88), nodes } };
}

export function serializeRichListTemplate(template: RichListTemplateDraft): string[] {
  const nodes = template.nodes.map(node => {
    const record: Record<string, unknown> = {
      id: node.id,
      type: node.type,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h
    };
    if (node.field) record.field = node.field;
    if (node.text) record.text = node.text;
    if (node.type === 'text' || node.type === 'icon') {
      if (node.size !== 14) record.size = node.size;
      if (node.weight !== 400) record.weight = node.weight;
      if (node.role) record.role = node.role;
      if (node.color) record.color = node.color;
      if (node.align) record.align = node.align;
      if (node.ellipsis) record.ellipsis = true;
      if (node.wrap) record.wrap = true;
    }
    if (node.type === 'button') {
      if (node.actionId) record.actionId = node.actionId;
      if (node.variant) record.variant = node.variant;
      if (node.size !== 14) record.size = node.size;
    }
    if (node.type === 'countdown' && node.format && node.format !== 'HH:mm:ss') record.format = node.format;
    if (node.type === 'badge') {
      if (node.badgeType) record.badgeType = node.badgeType;
      if (node.badgeMax !== 99) record.max = node.badgeMax;
      if (node.dot) record.dot = true;
    }
    return record;
  });
  return [stringifyCompact({ template: { rowHeight: template.rowHeight, nodes } })];
}

export interface RichListItemDraft {
  key: string;
  data: Record<string, string>;
  disabled: boolean;
  selected: boolean;
}

export function parseRichListItems(value: unknown): { ok: boolean; items: RichListItemDraft[] } {
  const raw = readStringListValue(value).join('\n').trim();
  if (!raw) return { ok: true, items: [] };
  const root = parseJsonObject(raw);
  let list: unknown[] | undefined;
  if (root) {
    list = Array.isArray(root.items) ? root.items : undefined;
  } else {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = undefined;
    }
  }
  if (!list) return { ok: false, items: [] };
  const items = list.map(entry => {
    const record = asRecord(entry);
    const data: Record<string, string> = {};
    for (const [field, fieldValue] of Object.entries(asRecord(record.data))) {
      data[field] = fieldValue === null || fieldValue === undefined ? '' : String(fieldValue);
    }
    return {
      key: textOf(record.key),
      data,
      disabled: boolOf(record.disabled),
      selected: boolOf(record.selected)
    };
  });
  return { ok: true, items };
}

export function serializeRichListItems(items: RichListItemDraft[]): string[] {
  return [stringifyCompact({
    items: items.map(item => {
      const record: Record<string, unknown> = { key: item.key, data: item.data };
      if (item.disabled) record.disabled = true;
      if (item.selected) record.selected = true;
      return record;
    })
  })];
}

/** 从行模板推导项目数据列：按节点顺序取非空且未重复的「绑定字段」。 */
export function deriveRichListDataColumns(nodes: RichListNodeDraft[]): string[] {
  const columns: string[] = [];
  for (const node of nodes) {
    const field = node.field.trim();
    if (!field || columns.includes(field)) continue;
    columns.push(field);
  }
  return columns;
}

/** 选中键存储口径：JSON 字符串数组（如 ["waves"]），与 EU_SetRichListSelectedKeys 一致。 */
export function parseRichListSelectedKeys(value: unknown): { ok: boolean; keys: string[] } {
  const raw = readStringListValue(value).join('\n').trim();
  if (!raw) return { ok: true, keys: [] };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { ok: true, keys: parsed.map(item => String(item ?? '')) };
    const record = asRecord(parsed);
    if (Array.isArray(record.selectedKeys)) return { ok: true, keys: record.selectedKeys.map(item => String(item ?? '')) };
    if (typeof record.key === 'string' && record.key) return { ok: true, keys: [record.key] };
    return { ok: true, keys: [] };
  } catch {
    return { ok: false, keys: [] };
  }
}

export function serializeRichListSelectedKeys(keys: string[]): string[] {
  return [stringifyCompact(keys)];
}

export interface RichListEditorSummary {
  parseOk: boolean;
  nodes: number;
  items: number;
  selected: number;
}

export function getRichListEditorSummary(properties: Readonly<Record<string, Win32ControlPropertyValue>> | undefined): RichListEditorSummary {
  const props = properties ?? {};
  const template = parseRichListTemplate(props.templateJson);
  const items = parseRichListItems(props.itemsJson);
  const selected = parseRichListSelectedKeys(props.selectedKeys);
  return {
    parseOk: template.ok && items.ok && selected.ok,
    nodes: template.template.nodes.length,
    items: items.items.length,
    selected: selected.keys.length
  };
}

// ---------------------------------------------------------------------------
// Tree / TreeSelect：树数据 JSON + 简单树节点行
// treeDataJson 运行时契约（element_treeview.cpp parse_tree_json_items /
// serialize_tree_json_items）：{"data":[{key,label,icon,children:[...]},...]}。
// 简单 items 行口径（parse_tree_items）：`文本\t层级\t展开\t勾选\t懒加载\t键\t禁用\t叶子\t图标…`；
// 设计器历史默认值还用 `> ` 前缀表示下一级。
// ---------------------------------------------------------------------------

export interface TreeNodeDraft {
  key: string;
  label: string;
  icon: string;
  expanded: boolean;
  checked: boolean;
  disabled: boolean;
  /** 展开层级，根为 0；编辑器使用扁平层级列表，序列化时再嵌套。 */
  level: number;
}

export function parseTreeDataJson(value: unknown): { ok: boolean; nodes: TreeNodeDraft[] } {
  const raw = readStringListValue(value).join('\n').trim();
  if (!raw) return { ok: true, nodes: [] };
  const root = parseJsonObject(raw);
  let list: unknown[] | undefined;
  if (root) {
    for (const field of ['data', 'nodes', 'children'] as const) {
      if (Array.isArray(root[field])) {
        list = root[field] as unknown[];
        break;
      }
    }
  } else {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = undefined;
    }
  }
  if (!list) return { ok: false, nodes: [] };
  const entries = list.map(item => asRecord(item));

  const draftOf = (record: Record<string, unknown>, level: number): TreeNodeDraft => ({
    key: textOf(record.key),
    label: textOf(record.label, textOf(record.text, textOf(record.name, '节点'))),
    icon: textOf(record.icon),
    expanded: record.expanded === undefined && record.open === undefined ? true : boolOf(record.expanded ?? record.open),
    checked: boolOf(record.checked),
    disabled: boolOf(record.disabled),
    level
  });

  const nodes: TreeNodeDraft[] = [];
  if (entries.some(entry => entry.children !== undefined)) {
    const walk = (records: Record<string, unknown>[], level: number): void => {
      for (const record of records) {
        nodes.push(draftOf(record, level));
        if (Array.isArray(record.children)) {
          walk(record.children.map(item => asRecord(item)), level + 1);
        }
      }
    };
    walk(entries, 0);
    return { ok: true, nodes };
  }
  // 扁平层级形态（节点带 level 数字）：直接按 level 展平。
  for (const record of entries) {
    nodes.push(draftOf(record, Math.max(0, intOf(record.level, 0))));
  }
  return { ok: true, nodes };
}

export function serializeTreeDataJson(nodes: TreeNodeDraft[]): string[] {
  // 规整层级：首个节点为根；任何节点的层级最多比前一个深 1，
  // 避免上游 serialize_node 跳级丢节点。
  const safeLevels: number[] = [];
  for (const node of nodes) {
    const previous = safeLevels[safeLevels.length - 1];
    const level = previous === undefined ? 0 : Math.max(0, Math.min(node.level, previous + 1));
    safeLevels.push(level);
  }
  const buildChildren = (level: number, start: number): { tree: unknown[]; next: number } => {
    const tree: unknown[] = [];
    let index = start;
    while (index < nodes.length) {
      const current = safeLevels[index];
      if (current < level) break;
      if (current > level) {
        const children = buildChildren(current, index);
        const parent = tree[tree.length - 1] as Record<string, unknown> | undefined;
        if (parent) parent.children = children.tree;
        index = children.next;
        continue;
      }
      const node = nodes[index];
      const record: Record<string, unknown> = { key: node.key, label: node.label };
      if (node.icon) record.icon = node.icon;
      if (!node.expanded) record.expanded = false;
      if (node.checked) record.checked = true;
      if (node.disabled) record.disabled = true;
      tree.push(record);
      index += 1;
    }
    return { tree, next: index };
  };
  return [stringifyCompact({ data: buildChildren(0, 0).tree })];
}

/** 把简单树节点行（`文本\t层级…` 与 `> ` 前缀约定）解析为编辑器节点。 */
export function parseTreeSimpleItems(value: unknown): TreeNodeDraft[] {
  const lines = readStringListValue(value).join('\n').split(/\r?\n/);
  const nodes: TreeNodeDraft[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const fields = line.split('\t');
    let label = (fields[0] ?? '').trim();
    let level = Math.max(0, Number.parseInt(fields[1] ?? '', 10) || 0);
    while (label.startsWith('>')) {
      level += 1;
      label = label.replace(/^>\s*/u, '');
    }
    nodes.push({
      key: (fields[5] ?? '').trim(),
      label: label || '节点',
      icon: (fields[8] ?? '').trim(),
      expanded: (fields[2] ?? '').trim() === '' ? true : (fields[2] ?? '').trim() !== '0',
      checked: (fields[3] ?? '').trim() === '1',
      disabled: (fields[6] ?? '').trim() === '1',
      level
    });
  }
  return nodes;
}

/** 序列化为简单树节点行，供画布预览与 EU_SetTreeItems 基础路径使用。
 *  字段位置与 parse_tree_items 对齐：0 文本 / 1 层级 / 2 展开 / 3 勾选 /
 *  4 懒加载 / 5 键 / 6 禁用 / 7 叶子 / 8 图标。 */
export function serializeTreeSimpleItems(nodes: TreeNodeDraft[]): string[] {
  const sanitize = (text: string): string => text.replace(/[\t|]/gu, ' ');
  return nodes.map(node => {
    const fields: string[] = [sanitize(node.label) || '节点', String(node.level), node.expanded ? '1' : '0', node.checked ? '1' : '0'];
    if (node.key || node.icon || node.disabled) {
      while (fields.length < 9) fields.push('');
      fields[4] = '';
      fields[5] = sanitize(node.key);
      fields[6] = node.disabled ? '1' : '0';
      fields[7] = '';
      fields[8] = sanitize(node.icon);
    }
    return fields.join('\t');
  });
}

export interface TreeEditorSummary {
  parseOk: boolean;
  nodes: number;
}

export function getTreeEditorSummary(properties: Readonly<Record<string, Win32ControlPropertyValue>> | undefined): TreeEditorSummary {
  const props = properties ?? {};
  const fromJson = parseTreeDataJson(props.treeDataJson);
  if (fromJson.ok && fromJson.nodes.length > 0) return { parseOk: true, nodes: fromJson.nodes.length };
  return { parseOk: fromJson.ok, nodes: parseTreeSimpleItems(props.items).length };
}

// ---------------------------------------------------------------------------
// 行分隔多列文本（stringList）：Collapse / Timeline / Tour / 图表 / Descriptions /
// ListBox 高级项目等。分隔符与列语义以 new_emoji 运行时解析为准。
// ---------------------------------------------------------------------------

export interface NewEmojiLinesColumn {
  key: string;
  label: string;
  placeholder?: string;
  numeric?: boolean;
}

export interface NewEmojiLinesSpec {
  columns: NewEmojiLinesColumn[];
  /** 写出与容错读取使用的字段分隔符。 */
  separator: '\t' | '：';
  /** 面板提示文案。 */
  hint: string;
  /** 已知格式的最大字段数；旧数据超出时回退原始文本编辑器，避免丢字段。 */
  maxFields: number;
}

const LINES_SPECS: Array<{ designerSuffix: string; key: string; spec: NewEmojiLinesSpec }> = [
  {
    designerSuffix: '/Descriptions',
    key: 'items',
    spec: {
      columns: [
        { key: 'label', label: '标签', placeholder: '姓名' },
        { key: 'content', label: '内容', placeholder: '张三' }
      ],
      separator: '：',
      hint: '每行一条「标签：内容」。运行时按冒号拆分，用本编辑器写入可保证正确显示。',
      maxFields: 2
    }
  },
  {
    designerSuffix: '/Collapse',
    key: 'items',
    spec: {
      columns: [
        { key: 'title', label: '标题', placeholder: '基础信息' },
        { key: 'body', label: '内容', placeholder: '面板正文' },
        { key: 'icon', label: '图标', placeholder: '可选' },
        { key: 'suffix', label: '附加文字', placeholder: '可选' },
        { key: 'disabled', label: '禁用(0/1)', placeholder: '0' }
      ],
      separator: '\t',
      hint: '每行一个折叠面板：标题、内容必填，其余可留空。',
      maxFields: 5
    }
  },
  {
    designerSuffix: '/Timeline',
    key: 'items',
    spec: {
      columns: [
        { key: 'time', label: '时间', placeholder: '09:00' },
        { key: 'content', label: '内容', placeholder: '创建任务' },
        { key: 'type', label: '样式序号', placeholder: '0', numeric: true },
        { key: 'icon', label: '图标', placeholder: '可选' }
      ],
      separator: '\t',
      hint: '每行一个时间线节点：时间、内容必填，样式序号与图标可选。',
      maxFields: 4
    }
  },
  {
    designerSuffix: '/Tour',
    key: 'steps',
    spec: {
      columns: [
        { key: 'title', label: '标题', placeholder: '第一步' },
        { key: 'body', label: '描述', placeholder: '选择组件' }
      ],
      separator: '\t',
      hint: '每行一个引导步骤：标题、描述。',
      maxFields: 2
    }
  },
  {
    designerSuffix: '/LineChart',
    key: 'points',
    spec: {
      columns: [
        { key: 'label', label: '名称', placeholder: '周一' },
        { key: 'value', label: '数值', placeholder: '12', numeric: true }
      ],
      separator: '\t',
      hint: '每行一个数据点：名称、数值。',
      maxFields: 2
    }
  },
  {
    designerSuffix: '/BarChart',
    key: 'bars',
    spec: {
      columns: [
        { key: 'label', label: '名称', placeholder: '产品A' },
        { key: 'value', label: '数值', placeholder: '42', numeric: true }
      ],
      separator: '\t',
      hint: '每行一根柱子：名称、数值。',
      maxFields: 2
    }
  },
  {
    designerSuffix: '/DonutChart',
    key: 'slices',
    spec: {
      columns: [
        { key: 'label', label: '名称', placeholder: '官网' },
        { key: 'value', label: '数值', placeholder: '45', numeric: true }
      ],
      separator: '\t',
      hint: '每行一个扇区：名称、数值。',
      maxFields: 2
    }
  },
  {
    designerSuffix: '/ListBox',
    key: 'listBoxItemsEx',
    spec: {
      columns: [
        { key: 'key', label: '键', placeholder: 'item-1' },
        { key: 'parentKey', label: '父键', placeholder: '可选' },
        { key: 'groupKey', label: '分组', placeholder: '可选' },
        { key: 'text', label: '文本', placeholder: '显示文字' },
        { key: 'value', label: '值', placeholder: '默认同文本' },
        { key: 'icon', label: '图标', placeholder: '可选' },
        { key: 'desc', label: '描述', placeholder: '可选' }
      ],
      separator: '\t',
      hint: '每行一个高级项目：键与文本必填，其余可留空。',
      maxFields: 7
    }
  }
];

const NEW_EMOJI_DESIGNER_PREFIX = 'lingbuilder.new_emoji.ui/';

export function getNewEmojiLinesSpec(designerType: string | undefined, propertyKey: string): NewEmojiLinesSpec | undefined {
  if (!designerType || !designerType.startsWith(NEW_EMOJI_DESIGNER_PREFIX)) return undefined;
  return LINES_SPECS.find(entry => entry.key === propertyKey && designerType.endsWith(entry.designerSuffix))?.spec;
}

export interface NewEmojiLinesRow {
  fields: string[];
  overflow: boolean;
}

/** 容错读取：主分隔符优先；Descriptions 兼容历史 TAB、半角/全角冒号与等号。 */
export function parseNewEmojiLines(value: unknown, spec: NewEmojiLinesSpec): NewEmojiLinesRow[] {
  const lines = readStringListValue(value).join('\n').split(/\r?\n/);
  const rows: NewEmojiLinesRow[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const tabFields = line.split('\t');
    let fields: string[];
    if (spec.separator === '：') {
      fields = line.split('：');
      if (fields.length < 2) fields = line.split(':');
      if (fields.length < 2) fields = line.split('=');
      if (fields.length < 2 && tabFields.length >= 2) fields = tabFields;
    } else {
      fields = tabFields;
    }
    rows.push({ fields, overflow: fields.length > spec.maxFields });
  }
  return rows;
}

/** 写出：跳过整行皆空的行；非法分隔字符替换为空格（Descriptions 标签列另净化冒号/等号）。 */
export function serializeNewEmojiLines(rows: Array<Array<string>>, spec: NewEmojiLinesSpec): string[] {
  const minFields = Math.min(2, spec.columns.length);
  const lines: string[] = [];
  for (const fields of rows) {
    if (!fields.some(field => (field ?? '').trim().length > 0)) continue;
    const safe = fields.map((field, index) => {
      let cleaned = String(field ?? '').replace(/\|/gu, ' ');
      if (spec.separator === '\t') cleaned = cleaned.replace(/\t/gu, ' ');
      else if (index === 0) cleaned = cleaned.replace(/[\t：:=]/gu, ' ');
      return cleaned;
    });
    let last = minFields - 1;
    for (let index = 0; index < safe.length; index += 1) {
      if (safe[index] !== '') last = index;
    }
    const output: string[] = [];
    for (let index = 0; index <= last; index += 1) output.push(safe[index] ?? '');
    lines.push(output.join(spec.separator));
  }
  return lines;
}

// ---------------------------------------------------------------------------
// 结构化对话框规格：哪些控件隐藏原始 JSON 属性、换成「编辑数据」按钮
// ---------------------------------------------------------------------------

export type NewEmojiDialogKind = 'richList' | 'treeData';

export interface NewEmojiDialogSpec {
  kind: NewEmojiDialogKind;
  /** 被结构化编辑器接管后隐藏的原始属性键（按清单声明顺序锚定入口按钮）。 */
  propertyKeys: string[];
  buttonLabel: string;
}

export function getNewEmojiDialogSpec(designerType: string | undefined): NewEmojiDialogSpec | undefined {
  if (!designerType || !designerType.startsWith(NEW_EMOJI_DESIGNER_PREFIX)) return undefined;
  if (designerType.endsWith('/RichList')) {
    return { kind: 'richList', propertyKeys: ['templateJson', 'itemsJson', 'selectedKeys'], buttonLabel: '编辑列表数据' };
  }
  if (designerType.endsWith('/Tree') || designerType.endsWith('/TreeSelect')) {
    return { kind: 'treeData', propertyKeys: ['items', 'treeDataJson'], buttonLabel: '编辑树数据' };
  }
  return undefined;
}
