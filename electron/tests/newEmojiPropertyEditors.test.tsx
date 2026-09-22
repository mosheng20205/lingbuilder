import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  RICH_LIST_NODE_TYPES,
  deriveRichListDataColumns,
  getNewEmojiDialogSpec,
  getNewEmojiLinesSpec,
  getRichListEditorSummary,
  getTreeEditorSummary,
  parseNewEmojiLines,
  parseRichListItems,
  parseRichListSelectedKeys,
  parseRichListTemplate,
  parseTreeDataJson,
  parseTreeSimpleItems,
  serializeNewEmojiLines,
  serializeRichListItems,
  serializeRichListSelectedKeys,
  serializeRichListTemplate,
  serializeTreeDataJson,
  serializeTreeSimpleItems
} from '../src/services/windowDesigner/newEmojiDataFormats';
import NewEmojiLinesPropertyEditor from '../src/components/NewEmojiLinesPropertyEditor';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const manifestPath = path.join(repoRoot, '.lingbuilder', 'modules', 'lingbuilder.new_emoji.ui', 'lingbuilder.module.json');

function manifestDesignerControls(): Array<{ type: string; properties: Array<{ key: string }> }> {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    contributes: { designerControls: Array<{ type: string; properties: Array<{ key: string }> }> };
  };
  return manifest.contributes.designerControls;
}

test('富列表行模板按真实工程数据往返一致，并保留运行时必填的 rowHeight', () => {
  const stored = ['{"template":{"rowHeight":88,"nodes":[{"id":"icon","type":"text","x":14,"y":30,"w":36,"h":30,"field":"icon","size":22},{"id":"title","type":"text","x":62,"y":20,"w":380,"h":26,"field":"title","size":16,"weight":600,"role":"primary","ellipsis":true},{"id":"open","type":"button","x":300,"y":48,"w":86,"h":28,"text":"打开","actionId":"open","variant":1}]}}'];
  const parsed = parseRichListTemplate(stored);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.template.rowHeight, 88);
  assert.equal(parsed.template.nodes.length, 3);
  assert.equal(parsed.template.nodes[1]?.weight, 600);
  assert.equal(parsed.template.nodes[2]?.actionId, 'open');

  const serialized = serializeRichListTemplate(parsed.template);
  const reparsed = parseRichListTemplate(serialized);
  assert.equal(reparsed.ok, true);
  assert.deepEqual(reparsed.template, parsed.template);
  const written = JSON.parse(serialized[0] ?? '{}') as { template: { rowHeight?: number } };
  assert.equal(typeof written.template.rowHeight, 'number');

  // 运行时红线：rowHeight 缺失会被 EU_SetRichListTemplate 拒绝（解析必须报 not ok）
  assert.equal(parseRichListTemplate(['{"template":{"nodes":[]}}']).ok, false);
  assert.equal(parseRichListTemplate(['not-json']).ok, false);
});

test('富列表项目数据往返一致，内容列按模板绑定字段推导', () => {
  const stored = ['{"items":[{"key":"waves","data":{"icon":"🌊","title":"Waves清理"}},{"key":"plugin-leftover","data":{"title":"插件残留清理"},"disabled":true}]}'];
  const parsed = parseRichListItems(stored);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0]?.data['icon'], '🌊');
  assert.equal(parsed.items[1]?.disabled, true);
  assert.deepEqual(serializeRichListItems(parsed.items), stored);

  const template = parseRichListTemplate(['{"template":{"rowHeight":88,"nodes":[{"id":"i","type":"icon","x":0,"y":0,"w":1,"h":1,"field":"icon"},{"id":"t","type":"text","x":0,"y":0,"w":1,"h":1,"field":"title"},{"id":"t2","type":"text","x":0,"y":0,"w":1,"h":1,"field":"title"}]}}']).template;
  assert.deepEqual(deriveRichListDataColumns(template.nodes), ['icon', 'title']);
});

test('富列表默认选中存 JSON 数组并兼容对象形态；汇总吃透三份属性', () => {
  assert.deepEqual(parseRichListSelectedKeys(['["waves","host-scan"]']), { ok: true, keys: ['waves', 'host-scan'] });
  assert.deepEqual(parseRichListSelectedKeys(['{"selectedKeys":["waves"]}']).keys, ['waves']);
  assert.deepEqual(parseRichListSelectedKeys([]), { ok: true, keys: [] });
  assert.equal(parseRichListSelectedKeys(['oops']).ok, false);
  assert.deepEqual(serializeRichListSelectedKeys(['waves']), ['["waves"]']);

  const summary = getRichListEditorSummary({
    templateJson: ['{"template":{"rowHeight":88,"nodes":[{"id":"t","type":"text","x":0,"y":0,"w":1,"h":1,"field":"title"}]}}'],
    itemsJson: ['{"items":[{"key":"a","data":{"title":"甲"}},{"key":"b","data":{"title":"乙"}}]}'],
    selectedKeys: ['["b"]']
  });
  assert.deepEqual(summary, { parseOk: true, nodes: 1, items: 2, selected: 1 });
  assert.equal(getRichListEditorSummary({ templateJson: ['broken'] }).parseOk, false);
});

test('树数据 JSON 往返一致，层级跳级被规整避免上游丢节点', () => {
  const nodes = parseTreeDataJson(['{"data":[{"key":"root","label":"根节点","children":[{"key":"child","label":"子节点"}]}]}']);
  assert.equal(nodes.ok, true);
  assert.deepEqual(nodes.nodes.map(node => [node.label, node.level]), [['根节点', 0], ['子节点', 1]]);

  const roundTrip = parseTreeDataJson(serializeTreeDataJson(nodes.nodes));
  assert.equal(roundTrip.ok, true);
  assert.deepEqual(roundTrip.nodes, nodes.nodes);

  // 跳级（0 → 2）必须被规整成 0 → 1，运行时 serialize_node 会丢弃跳级节点
  const gapped = serializeTreeDataJson([
    { key: 'a', label: '甲', icon: '', expanded: true, checked: false, disabled: false, level: 0 },
    { key: 'b', label: '乙', icon: '', expanded: true, checked: false, disabled: false, level: 2 }
  ]);
  const reparsed = parseTreeDataJson(gapped);
  assert.deepEqual(reparsed.nodes.map(node => [node.key, node.level]), [['a', 0], ['b', 1]]);
});

test('简单树节点行兼容 `>` 前缀与 TAB 层级，序列化字段位与 parse_tree_items 对齐', () => {
  const legacy = ['根节点', '> 子节点 A', '>> 孙节点', '叶子节点\t0\t1\t1'];
  const nodes = parseTreeSimpleItems(legacy);
  assert.deepEqual(nodes.map(node => [node.label, node.level]), [['根节点', 0], ['子节点 A', 1], ['孙节点', 2], ['叶子节点', 0]]);
  assert.equal(nodes[3]?.checked, true);

  const withKeyAndIcon = [{ key: 'k1', label: '带键节点', icon: '📁', expanded: true, checked: false, disabled: false, level: 0 }];
  const lines = serializeTreeSimpleItems(withKeyAndIcon);
  const fields = (lines[0] ?? '').split('\t');
  assert.equal(fields[0], '带键节点');
  assert.equal(fields[1], '0');
  assert.equal(fields[5], 'k1');
  assert.equal(fields[8], '📁');
  assert.equal(parseTreeSimpleItems(lines)[0]?.key, 'k1');

  // getTreeEditorSummary：JSON 优先，其次简单行
  const gapJson = serializeTreeDataJson([
    { key: 'a', label: '甲', icon: '', expanded: true, checked: false, disabled: false, level: 0 },
    { key: 'b', label: '乙', icon: '', expanded: true, checked: false, disabled: false, level: 2 }
  ]);
  assert.equal(getTreeEditorSummary({ treeDataJson: gapJson }).nodes, 2);
  assert.equal(getTreeEditorSummary({ items: legacy }).nodes, 4);
  assert.equal(getTreeEditorSummary({ treeDataJson: ['bad'] }).parseOk, false);
});

test('行分隔多列属性：解析容错、写出净化、空行跳过', () => {
  // Descriptions：运行时按冒号拆分，解析需兼容 TAB 历史/半角/全角/等号
  const descSpec = getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/Descriptions', 'items');
  assert.ok(descSpec);
  const rows = parseNewEmojiLines(['姓名\t张三', '状态：正常', '角色=管理员'], descSpec!);
  assert.deepEqual(rows.map(row => row.fields[0]), ['姓名', '状态', '角色']);
  const written = serializeNewEmojiLines([['姓|名', '张:三'], [], ['状态', '正常']], descSpec!);
  assert.deepEqual(written, ['姓 名：张:三', '状态：正常']);

  // TAB 规格：字段与条目分隔符都要净化
  const collapseSpec = getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/Collapse', 'items');
  assert.ok(collapseSpec);
  const collapseWritten = serializeNewEmojiLines([['标题', '正文\t第二段', 'a|b']], collapseSpec!);
  assert.deepEqual(collapseWritten, ['标题\t正文 第二段\ta b']);
  assert.equal(parseNewEmojiLines(['基础信息\t这里是基础信息\t\t\t1'], collapseSpec!).length, 1);

  // 超出已知字段数标记 overflow（面板回退原始编辑器）
  const listSpec = getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/ListBox', 'listBoxItemsEx');
  assert.ok(listSpec);
  const overflow = parseNewEmojiLines(['k\tp\tg\t文本\t值\t图标\t描述\t多余\t9'], listSpec!);
  assert.equal(overflow[0]?.overflow, true);
});

test('行分隔规格与对话框规格按 designerType 后缀匹配，控件名不能误命中', () => {
  assert.ok(getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/LineChart', 'points'));
  assert.ok(!getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/BarChart', 'points'), 'BarChart 的数据属性是 bars，points 不应命中');
  assert.ok(getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/BarChart', 'bars'));
  assert.ok(!getNewEmojiLinesSpec('lingbuilder.win32.common-controls/ListBox', 'listBoxItemsEx'), '非 new_emoji 控件不走该编辑器');
  assert.ok(!getNewEmojiLinesSpec(undefined, 'items'));

  assert.deepEqual(getNewEmojiDialogSpec('lingbuilder.new_emoji.ui/RichList'), {
    kind: 'richList',
    propertyKeys: ['templateJson', 'itemsJson', 'selectedKeys'],
    buttonLabel: '编辑列表数据'
  });
  assert.equal(getNewEmojiDialogSpec('lingbuilder.new_emoji.ui/Tree')?.kind, 'treeData');
  assert.equal(getNewEmojiDialogSpec('lingbuilder.new_emoji.ui/TreeSelect')?.kind, 'treeData');
  assert.ok(!getNewEmojiDialogSpec('lingbuilder.new_emoji.ui/Table'));
  assert.ok(!getNewEmojiDialogSpec(undefined));
  assert.ok(RICH_LIST_NODE_TYPES.some(type => type.value === 'button'));
});

test('模块清单与编辑器规格保持一致：规格键都真实存在于清单属性', () => {
  const controls = manifestDesignerControls();
  const propertiesOf = (type: string): string[] => controls.find(control => control.type === type)?.properties.map(property => property.key) ?? [];

  for (const [type, keys] of [
    ['RichList', ['templateJson', 'itemsJson', 'selectedKeys']],
    ['Tree', ['items', 'treeDataJson']],
    ['TreeSelect', ['items', 'treeDataJson']]
  ] as const) {
    const properties = propertiesOf(type);
    for (const key of keys) assert.ok(properties.includes(key), `${type} 缺少属性 ${key}`);
  }

  const linesEntries: Array<[string, string]> = [
    ['Descriptions', 'items'], ['Collapse', 'items'], ['Timeline', 'items'], ['Tour', 'steps'],
    ['LineChart', 'points'], ['BarChart', 'bars'], ['DonutChart', 'slices'], ['ListBox', 'listBoxItemsEx']
  ];
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { id: string };
  for (const [type, key] of linesEntries) {
    assert.ok(propertiesOf(type).includes(key), `${type} 缺少属性 ${key}`);
    assert.ok(getNewEmojiLinesSpec(`${manifest.id}/${type}`, key), `${type}.${key} 应命中多列编辑器规格`);
  }
});

test('多列编辑器渲染列头与提示，溢出旧数据回退原始文本框', () => {
  const spec = getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/LineChart', 'points');
  assert.ok(spec);
  const normal = renderToStaticMarkup(
    <NewEmojiLinesPropertyEditor value={['周一\t12', '周二\t18']} spec={spec!} isDarkMode onChange={() => {}} />
  );
  assert.match(normal, /名称/u);
  assert.match(normal, /数值/u);
  assert.match(normal, /每行一个数据点/u);
  assert.doesNotMatch(normal, /超出.*结构化|原始文本编辑/u);

  const overflowSpec = getNewEmojiLinesSpec('lingbuilder.new_emoji.ui/ListBox', 'listBoxItemsEx');
  assert.ok(overflowSpec);
  const fallback = renderToStaticMarkup(
    <NewEmojiLinesPropertyEditor value={['k\tp\tg\t文本\t值\t图标\t描述\t额外']} spec={overflowSpec!} isDarkMode onChange={() => {}} />
  );
  assert.match(fallback, /原始文本编辑/u);
});

test('富列表与树数据编辑器用真实工程控件渲染出三页签与层级行', async () => {
  const { default: NewEmojiRichListEditorDialog } = await import('../src/components/NewEmojiRichListEditorDialog');
  const { default: NewEmojiTreeDataEditorDialog } = await import('../src/components/NewEmojiTreeDataEditorDialog');
  const control = {
    id: 'ne_rich_list_clean',
    type: 'ListView',
    designerType: 'lingbuilder.new_emoji.ui/RichList',
    name: '清理列表',
    properties: {
      templateJson: ['{"template":{"rowHeight":88,"nodes":[{"id":"icon","type":"text","x":14,"y":30,"w":36,"h":30,"field":"icon","size":22},{"id":"title","type":"text","x":62,"y":20,"w":380,"h":26,"field":"title","size":16,"weight":600,"role":"primary","ellipsis":true},{"id":"desc","type":"text","x":62,"y":48,"w":480,"h":20,"field":"desc","size":12,"role":"secondary","ellipsis":true}]}}'],
      itemsJson: ['{"items":[{"key":"waves","data":{"icon":"🌊","title":"Waves清理","desc":"清理 Waves 残留"}}]}'],
      selectedKeys: ['[]']
    }
  } as never as Parameters<typeof NewEmojiRichListEditorDialog>[0]['control'];

  const richList = renderToStaticMarkup(
    <NewEmojiRichListEditorDialog control={control} isDarkMode onSave={() => {}} onClose={() => {}} />
  );
  assert.match(richList, /行模板/u);
  assert.match(richList, /项目数据/u);
  assert.match(richList, /默认选中/u);
  assert.match(richList, /清理列表/u);

  const treeControl = {
    id: 'tree1',
    type: 'TreeView',
    designerType: 'lingbuilder.new_emoji.ui/Tree',
    name: '目录树',
    properties: { items: ['根节点', '> 子节点 A'], treeDataJson: [] }
  } as never as Parameters<typeof NewEmojiTreeDataEditorDialog>[0]['control'];
  const tree = renderToStaticMarkup(
    <NewEmojiTreeDataEditorDialog control={treeControl} isDarkMode onSave={() => {}} onClose={() => {}} />
  );
  assert.match(tree, /编辑树数据/u);
  assert.match(tree, /2 个节点/u);
});

