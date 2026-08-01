import type { ModuleBindingValueType, ModuleCommandBinding, ModuleCommandBindingParameter, ModuleCommandContribution } from './types';
import { createModuleBindingSnippetArgument } from './bindingValueType';

type UiReturnType = '整数型' | '长整数型' | '小数型' | '逻辑型' | '文本型';
type Parameter = ModuleCommandBindingParameter;

export interface DataGridApiDefinition {
  name: string;
  signature: string;
  description: string;
  insertText: string;
  returnType: UiReturnType;
  parameters: Parameter[];
  bindingReturnType: ModuleBindingValueType;
  memberName: string;
  memberArgs: string;
}

const p = (name: string, type: ModuleBindingValueType): Parameter => ({ name, type });
const control: Parameter = { name: '控件名', type: 'controlRef', controlTypes: ['DataGrid'] };
const rowKey = p('行键', 'wideString');
const columnId = p('列ID', 'wideString');
const text = p('文本', 'wideString');
const imageList: Parameter = { name: '图像列表', type: 'controlRef', controlTypes: ['ImageList'], controlKinds: ['resource'], scope: 'project' };
const index = p('索引', 'int');
const bool = (name: string) => p(name, 'bool');
const integer = (name: string) => p(name, 'int');
const decimal = (name: string) => p(name, 'double');
const string = (name: string) => p(name, 'wideString');

const returnTypeMap: Record<ModuleBindingValueType, UiReturnType> = {
  int: '整数型', longLong: '长整数型', double: '小数型', bool: '逻辑型', wideString: '文本型',
  void: '逻辑型', utf8String: '文本型', controlRef: '长整数型', handler: '长整数型', handle: '长整数型', raw: '长整数型'
};
const sample = (parameter: Parameter, placeholder: number) => {
  if (parameter.type === 'bool') return '真';
  if (parameter.type === 'double') return '0.0';
  if (parameter.type === 'int' || parameter.type === 'longLong' || parameter.type === 'handle') return '0';
  return createModuleBindingSnippetArgument(parameter, placeholder - 1);
};
const api = (
  suffix: string,
  bindingReturnType: ModuleBindingValueType,
  parameters: Parameter[],
  description: string
): DataGridApiDefinition => {
  const name = `表格_${suffix}`;
  const allParameters = [control, ...parameters];
  const argumentSamples = allParameters.map((parameter, index) => sample(parameter, index + 1));
  return {
    name,
    signature: `${name}(${allParameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${argumentSamples.join(', ')})`,
    returnType: returnTypeMap[bindingReturnType],
    parameters: allParameters,
    bindingReturnType,
    memberName: suffix,
    memberArgs: parameters.map((parameter, index) => sample(parameter, index + 1)).join(', ')
  };
};

export const DATA_GRID_API: DataGridApiDefinition[] = [
  api('添加列', 'bool', [columnId, string('标题'), string('类型'), integer('宽度')], '追加具有稳定列 ID 的强类型列。'),
  api('插入列', 'bool', [index, columnId, string('标题'), string('类型'), integer('宽度')], '在指定位置插入强类型列。'),
  api('删除列', 'bool', [columnId], '删除列并同步删除全部行中的对应单元格。'),
  api('设置列标题', 'bool', [columnId, string('标题')], '设置列标题。'),
  api('设置列宽度', 'bool', [columnId, integer('宽度')], '设置列宽度。'),
  api('设置列对齐', 'bool', [columnId, string('对齐方式')], '设置列为 left/center/right（居左/居中/居右）。'),
  api('设置列只读', 'bool', [columnId, bool('只读')], '设置列只读状态。'),
  api('设置列显示', 'bool', [columnId, bool('显示')], '设置列显示状态。'),
  api('设置列冻结', 'bool', [columnId, bool('冻结')], '设置列冻结状态。'),
  api('设置列格式', 'bool', [columnId, string('格式')], '设置日期、数字等列的显示格式。'),
  api('取列数', 'int', [], '返回当前列数。'),

  api('添加列选项', 'bool', [columnId, string('值'), string('显示文字')], '向组合框列追加稳定值与中文显示文字。'),
  api('清空列选项', 'bool', [columnId], '清空组合框列选项。'),
  api('设置单元格组合框选项', 'bool', [rowKey, columnId, string('选项TSV')], '用 TSV 覆盖单元格组合框选项。'),
  api('设置选择框三态', 'bool', [columnId, bool('启用三态')], '允许选择框使用 null 作为第三态。'),
  api('设置开关文字', 'bool', [columnId, string('开启文字'), string('关闭文字')], '设置 Switch 的开启和关闭文字。'),
  api('设置图片显示方式', 'bool', [columnId, string('显示方式')], '设置 tile/contain/cover/center/stretch（平铺/等比完整/等比铺满/原始居中/拉伸）图片显示方式。'),
  api('设置进度范围', 'bool', [columnId, decimal('最小值'), decimal('最大值'), bool('显示文字')], '设置进度列范围及文字显示。'),
  api('添加列按钮', 'bool', [columnId, string('按钮ID'), string('文字'), string('样式')], '向按钮列追加稳定按钮 ID。'),
  api('清空列按钮', 'bool', [columnId], '清空按钮列定义。'),

  api('添加行', 'bool', [rowKey, string('单元格TSV')], '追加稳定行键的数据行。'),
  api('插入行', 'bool', [index, rowKey, string('单元格TSV')], '在指定位置插入数据行。'),
  api('删除行', 'bool', [rowKey], '按稳定行键删除行。'),
  api('清空行', 'bool', [], '清空全部静态数据行。'),
  api('取行数', 'int', [], '返回数据行数或虚拟总行数。'),
  api('取显示行键', 'wideString', [index], '返回排序筛选后指定显示索引的稳定行键。'),

  api('开始批量更新', 'bool', [], '进入可嵌套批量更新并暂停重绘。'),
  api('结束批量更新', 'bool', [], '结束一层批量更新，最外层恢复重绘。'),
  api('加载TSV', 'bool', [string('TSV文本'), bool('首行为标题')], '按明确的引号和换行规则加载 TSV。'),
  api('导出TSV', 'wideString', [bool('包含标题')], '导出可往返的 TSV。'),
  api('导入CSV', 'bool', [string('CSV文本'), bool('首行为标题')], '按 RFC 4180 风格引号规则导入 CSV。'),
  api('导出CSV', 'wideString', [bool('包含标题')], '导出可往返的 CSV。'),
  api('导入Excel', 'bool', [string('文件路径'), bool('首行为标题')], '从 .xlsx 文件的第一个工作表导入数据，无需安装 Microsoft Excel。'),
  api('导出Excel', 'bool', [string('文件路径'), bool('包含标题')], '将静态数据导出为标准 .xlsx 文件，无需安装 Microsoft Excel。'),

  api('置文本', 'bool', [rowKey, columnId, text], '写入文本单元格。'),
  api('取文本', 'wideString', [rowKey, columnId], '读取单元格显示文本。'),
  api('置整数', 'bool', [rowKey, columnId, integer('数值')], '写入整数单元格。'),
  api('取整数', 'int', [rowKey, columnId], '读取整数单元格。'),
  api('置小数', 'bool', [rowKey, columnId, decimal('数值')], '写入小数单元格。'),
  api('取小数', 'double', [rowKey, columnId], '读取小数单元格。'),
  api('置逻辑', 'bool', [rowKey, columnId, bool('数值')], '写入选择框或 Switch 单元格。'),
  api('取逻辑', 'bool', [rowKey, columnId], '读取逻辑单元格。'),
  api('置日期', 'bool', [rowKey, columnId, string('日期')], '写入 ISO 日期文本。'),
  api('取日期', 'wideString', [rowKey, columnId], '读取日期文本。'),

  api('置图片', 'bool', [rowKey, columnId, string('项目路径')], '设置项目资源或运行时文件路径图片。'),
  api('置图像列表图片', 'bool', [rowKey, columnId, imageList, integer('图片索引')], '设置 ImageList 图片引用。'),
  api('清除图片', 'bool', [rowKey, columnId], '清除图片单元格。'),
  api('置进度', 'bool', [rowKey, columnId, decimal('进度')], '设置进度值并限制到列范围。'),
  api('取进度', 'double', [rowKey, columnId], '读取进度值。'),
  api('设置进度状态', 'bool', [rowKey, columnId, string('状态')], '设置 normal/success/warning/error/paused/indeterminate 状态。'),
  api('取进度状态', 'wideString', [rowKey, columnId], '读取进度单元格状态；未覆盖时返回 normal。'),
  api('置组合框值', 'bool', [rowKey, columnId, string('值')], '按稳定值设置组合框单元格。'),
  api('取组合框值', 'wideString', [rowKey, columnId], '读取组合框稳定值。'),
  api('取组合框文字', 'wideString', [rowKey, columnId], '读取组合框中文显示文字。'),
  api('设置按钮显示', 'bool', [rowKey, columnId, string('按钮ID'), bool('显示')], '覆盖指定单元格按钮显示状态。'),
  api('设置按钮启用', 'bool', [rowKey, columnId, string('按钮ID'), bool('启用')], '覆盖指定单元格按钮启用状态。'),
  api('设置按钮文字', 'bool', [rowKey, columnId, string('按钮ID'), string('文字')], '覆盖指定单元格按钮文字。'),
  api('设置按钮样式', 'bool', [rowKey, columnId, string('按钮ID'), string('样式')], '覆盖指定单元格按钮样式。'),

  api('开始编辑', 'bool', [rowKey, columnId], '开始单元格原地编辑。'),
  api('提交编辑', 'bool', [], '提交当前临时编辑器。'),
  api('取消编辑', 'bool', [], '取消当前临时编辑器。'),
  api('设置当前单元格', 'bool', [rowKey, columnId], '设置键盘当前单元格。'),
  api('取当前行键', 'wideString', [], '读取当前单元格行键。'),
  api('取当前列ID', 'wideString', [], '读取当前单元格列 ID。'),
  api('设置行选中', 'bool', [rowKey, bool('选中')], '设置行选择状态。'),
  api('取行是否选中', 'bool', [rowKey], '按稳定行键读取该行是否处于选中状态。'),
  api('取选中行数', 'int', [], '读取选中行数量。'),
  api('取选中行键', 'wideString', [index], '读取第 N 个选中行键。'),
  api('撤销', 'bool', [], '撤销最近一次数据事务。'),
  api('重做', 'bool', [], '重做最近一次数据事务。'),

  api('设置排序', 'bool', [columnId, bool('升序')], '替换为单列强类型排序。'),
  api('添加排序', 'bool', [columnId, bool('升序')], '追加多列强类型排序。'),
  api('清除排序', 'bool', [], '清除排序状态。'),
  api('设置列筛选', 'bool', [columnId, string('规则'), string('值')], '设置列筛选。'),
  api('清除列筛选', 'bool', [columnId], '清除指定列筛选。'),
  api('清除全部筛选', 'bool', [], '清除全部列筛选。'),
  api('设置搜索文字', 'bool', [string('搜索文字')], '设置跨列搜索文字。'),

  api('设置列必填', 'bool', [columnId, bool('必填')], '设置列必填校验。'),
  api('设置列数值范围', 'bool', [columnId, decimal('最小值'), decimal('最大值')], '设置整数、小数或进度列数值范围。'),
  api('设置列文本规则', 'bool', [columnId, string('正则表达式')], '设置文本校验规则。'),
  api('拒绝本次编辑', 'bool', [string('原因')], '在正在验证事件中拒绝本次编辑。'),

  api('设置虚拟行数', 'bool', [integer('行数')], '设置虚拟数据总行数并清空过期缓存。'),
  api('取请求起始行', 'int', [], '读取当前异步虚拟数据请求起始行。'),
  api('取请求数量', 'int', [], '读取当前异步虚拟数据请求数量。'),
  api('提交虚拟行', 'bool', [index, rowKey, string('单元格TSV')], '提交一条虚拟缓存行。'),
  api('清除虚拟缓存', 'bool', [], '清除虚拟数据缓存。'),

  api('取事件行键', 'wideString', [], '从同步事件上下文栈读取行键。'),
  api('取事件列ID', 'wideString', [], '从同步事件上下文栈读取列 ID。'),
  api('取事件按钮ID', 'wideString', [], '从同步事件上下文栈读取按钮 ID。'),
  api('取事件旧值', 'wideString', [], '从同步事件上下文栈读取旧值。'),
  api('取事件新值', 'wideString', [], '从同步事件上下文栈读取新值。'),
  api('取最后错误', 'wideString', [], '读取最近一次失败的中文错误。')
];

export const DATA_GRID_COMMANDS: ModuleCommandContribution[] = DATA_GRID_API.map(item => ({
  name: item.name,
  signature: item.signature,
  description: item.description,
  insertText: item.insertText,
  returnType: item.returnType
}));

export const DATA_GRID_BINDINGS: ModuleCommandBinding[] = DATA_GRID_API.map(item => ({
  command: item.name,
  runtimeName: item.name,
  parameters: item.parameters,
  returnType: item.bindingReturnType,
  encoding: 'wide'
}));

export const DATA_GRID_COMMAND_NAMES = new Set(DATA_GRID_API.map(item => item.name));
