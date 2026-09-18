import type { ModuleBindingValueType, ModuleCommandBinding, ModuleCommandBindingParameter, ModuleCommandContribution } from './types';
import { createModuleBindingSnippetArgument } from './bindingValueType';

type UiReturnType = '整数型' | '长整数型' | '小数型' | '逻辑型' | '文本型' | '字节集';
type Parameter = ModuleCommandBindingParameter;
/** DataGrid 的原生 ABI 只承载标量与文本，不承载 LingCpp 数组值。 */
type DataGridBindingReturnType = Exclude<ModuleBindingValueType, 'array' | 'arrayElement'>;

export interface DataGridApiDefinition {
  name: string;
  signature: string;
  description: string;
  insertText: string;
  returnType: UiReturnType;
  parameters: Parameter[];
  bindingReturnType: DataGridBindingReturnType;
  memberName: string;
  memberArgs: string;
}

// 说明按 dataGridNativeRuntime.ts 的实际校验核实：行键与列ID 找不到时会返回“未知行键/未知列ID”失败。
const p = (name: string, type: ModuleBindingValueType, description: string): Parameter => ({ name, type, description });
const control: Parameter = { name: '控件名', type: 'controlRef', controlTypes: ['DataGrid'], description: '当前窗口中的数据表格控件裸名（不加引号）。' };
const rowKey = p('行键', 'wideString', '行数据里作为主键使用的列值，必须已存在于当前数据快照；未知行键会被拒绝并返回中文错误。');
const columnId = p('列ID', 'wideString', '已添加列的标识文本，区分大小写；未知列ID会被拒绝并返回中文错误。');
const text = p('文本', 'wideString', '要写入单元格或用于比较的文本内容。');
const imageList: Parameter = { name: '图像列表', type: 'controlRef', controlTypes: ['ImageList'], controlKinds: ['resource'], scope: 'project', description: '项目内的图像列表资源裸名（不加引号），按项目作用域解析。' };
const index = p('索引', 'int', '行索引，从 0 开始；越界时命令返回失败值。');
const bool = (name: string, description: string) => p(name, 'bool', description);
const integer = (name: string, description: string) => p(name, 'int', description);
const decimal = (name: string, description: string) => p(name, 'double', description);
const string = (name: string, description: string) => p(name, 'wideString', description);

const returnTypeMap: Record<DataGridBindingReturnType, UiReturnType> = {
  int: '整数型', longLong: '长整数型', double: '小数型', float: '小数型', bool: '逻辑型', wideString: '文本型',
  void: '逻辑型', utf8String: '文本型', controlRef: '长整数型', handler: '长整数型', lingValue: '长整数型', handle: '长整数型', bytes: '字节集', raw: '长整数型'
};
const sample = (parameter: Parameter, placeholder: number) => {
  if (parameter.type === 'bool') return '真';
  if (parameter.type === 'double') return '0.0';
  if (parameter.type === 'int' || parameter.type === 'longLong' || parameter.type === 'handle') return '0';
  return createModuleBindingSnippetArgument(parameter, placeholder - 1);
};
const api = (
  suffix: string,
  bindingReturnType: DataGridBindingReturnType,
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
  api('添加列', 'bool', [columnId, string('标题', '列标题文本，用于表头显示和必填错误提示；空文本表示无标题。'), string('类型', '列数据类型文本，支持 text、integer、decimal、date、checkbox、switch、progress、image 等；空文本按 text 处理，写入与校验按该类型解释。'), integer('宽度', '列宽，像素；创建时小于 32 会被抬到 32。')], '追加具有稳定列 ID 的强类型列。'),
  api('插入列', 'bool', [index, columnId, string('标题', '列标题文本，用于表头显示和必填错误提示；空文本表示无标题。'), string('类型', '列数据类型文本，支持 text、integer、decimal、date、checkbox、switch、progress、image 等；空文本按 text 处理，写入与校验按该类型解释。'), integer('宽度', '列宽，像素；创建时小于 32 会被抬到 32。')], '在指定位置插入强类型列。'),
  api('删除列', 'bool', [columnId], '删除列并同步删除全部行中的对应单元格。'),
  api('设置列标题', 'bool', [columnId, string('标题', '列标题文本，用于表头显示和必填错误提示；空文本表示无标题。')], '设置列标题。'),
  api('设置列宽度', 'bool', [columnId, integer('宽度', '列宽，像素；创建时小于 32 会被抬到 32。')], '设置列宽度。'),
  api('设置列对齐', 'bool', [columnId, string('对齐方式', '列对齐方式，只允许 left、center 或 right，其它文本返回失败并记录中文错误。')], '设置列为 left/center/right（居左/居中/居右）。'),
  api('设置列只读', 'bool', [columnId, bool('只读', '传真把该列设为只读，只读单元格的写入会被拒绝。')], '设置列只读状态。'),
  api('设置列显示', 'bool', [columnId, bool('显示', '传真显示该列，传假隐藏；隐藏列仍参与数据与校验。')], '设置列显示状态。'),
  api('设置列冻结', 'bool', [columnId, bool('冻结', '传真把列固定在表头左侧，不随水平滚动移动。')], '设置列冻结状态。'),
  api('设置列格式', 'bool', [columnId, string('格式', '列显示格式文本，例如日期或数字格式；空文本清除格式，不影响存储值。')], '设置日期、数字等列的显示格式。'),
  api('取列数', 'int', [], '返回当前列数。'),

  api('添加列选项', 'bool', [columnId, string('值', '选项或单元格的稳定值，用于比较和读写，显示文字由对应的文字参数决定。'), string('显示文字', '选项在下拉列表中显示的中文文字，与稳定值成对保存。')], '向组合框列追加稳定值与中文显示文字。'),
  api('清空列选项', 'bool', [columnId], '清空组合框列选项。'),
  api('设置单元格组合框选项', 'bool', [rowKey, columnId, string('选项TSV', '制表符分隔的选项文本，每行一个选项；空行会被跳过。')], '用 TSV 覆盖单元格组合框选项。'),
  api('设置选择框三态', 'bool', [columnId, bool('启用三态', '传真允许选择框使用未确定（null）第三态。')], '允许选择框使用 null 作为第三态。'),
  api('设置开关文字', 'bool', [columnId, string('开启文字', 'Switch 处于开启状态时显示的文字；空文本清除。'), string('关闭文字', 'Switch 处于关闭状态时显示的文字；空文本清除。')], '设置 Switch 的开启和关闭文字。'),
  api('设置图片显示方式', 'bool', [columnId, string('显示方式', '图片显示方式，只允许 tile、contain、cover、center 或 stretch，其它值返回失败并记录中文错误。')], '设置 tile/contain/cover/center/stretch（平铺/等比完整/等比铺满/原始居中/拉伸）图片显示方式。'),
  api('设置进度范围', 'bool', [columnId, decimal('最小值', '数值下限，必须不大于最大值，否则返回数值范围无效。'), decimal('最大值', '数值上限，必须不小于最小值，否则返回数值范围无效。'), bool('显示文字', '选项在下拉列表中显示的中文文字，与稳定值成对保存。')], '设置进度列范围及文字显示。'),
  api('添加列按钮', 'bool', [columnId, string('按钮ID', '按钮列内稳定的按钮标识，不能为空且同一列内不得重复；重复时返回失败。'), string('文字', '按钮或单元格显示的文字内容。'), string('样式', '按钮样式标识文本，由界面样式表解释。')], '向按钮列追加稳定按钮 ID。'),
  api('清空列按钮', 'bool', [columnId], '清空按钮列定义。'),

  api('添加行', 'bool', [rowKey, string('单元格TSV', '按列顺序用制表符分隔的单元格文本，缺少的列按空文本补齐。')], '追加稳定行键的数据行。'),
  api('插入行', 'bool', [index, rowKey, string('单元格TSV', '按列顺序用制表符分隔的单元格文本，缺少的列按空文本补齐。')], '在指定位置插入数据行。'),
  api('删除行', 'bool', [rowKey], '按稳定行键删除行。'),
  api('清空行', 'bool', [], '清空全部静态数据行。'),
  api('取行数', 'int', [], '返回数据行数或虚拟总行数。'),
  api('取显示行键', 'wideString', [index], '返回排序筛选后指定显示索引的稳定行键。'),

  api('开始批量更新', 'bool', [], '进入可嵌套批量更新并暂停重绘。'),
  api('结束批量更新', 'bool', [], '结束一层批量更新，最外层恢复重绘。'),
  api('加载TSV', 'bool', [string('TSV文本', '制表符分隔的表格文本，按行拆分后再按列取值。'), bool('首行为标题', '传真时把第一行当作列标题消费掉，传假时第一行作为数据行。')], '按明确的引号和换行规则加载 TSV。'),
  api('导出TSV', 'wideString', [bool('包含标题', '传真导出的文本或文件里带上列标题行，传假只导出数据行。')], '导出可往返的 TSV。'),
  api('导入CSV', 'bool', [string('CSV文本', '逗号分隔的表格文本，按 RFC 4180 引号规则解析双引号与转义。'), bool('首行为标题', '传真时把第一行当作列标题消费掉，传假时第一行作为数据行。')], '按 RFC 4180 风格引号规则导入 CSV。'),
  api('导出CSV', 'wideString', [bool('包含标题', '传真导出的文本或文件里带上列标题行，传假只导出数据行。')], '导出可往返的 CSV。'),
  api('导入Excel', 'bool', [string('文件路径', '本机 xlsx 文件路径；目录必须已存在。'), bool('首行为标题', '传真时把第一行当作列标题消费掉，传假时第一行作为数据行。')], '从 .xlsx 文件的第一个工作表导入数据，无需安装 Microsoft Excel。'),
  api('导出Excel', 'bool', [string('文件路径', '本机 xlsx 文件路径；目录必须已存在。'), bool('包含标题', '传真导出的文本或文件里带上列标题行，传假只导出数据行。')], '将静态数据导出为标准 .xlsx 文件，无需安装 Microsoft Excel。'),

  api('置文本', 'bool', [rowKey, columnId, text], '写入文本单元格。'),
  api('取文本', 'wideString', [rowKey, columnId], '读取单元格显示文本。'),
  api('置整数', 'bool', [rowKey, columnId, integer('数值', '写入单元格的数值，会按列类型做范围与格式校验。')], '写入整数单元格。'),
  api('取整数', 'int', [rowKey, columnId], '读取整数单元格。'),
  api('置小数', 'bool', [rowKey, columnId, decimal('数值', '写入单元格的数值，会按列类型做范围与格式校验。')], '写入小数单元格。'),
  api('取小数', 'double', [rowKey, columnId], '读取小数单元格。'),
  api('置逻辑', 'bool', [rowKey, columnId, bool('数值', '写入单元格的数值，会按列类型做范围与格式校验。')], '写入选择框或 Switch 单元格。'),
  api('取逻辑', 'bool', [rowKey, columnId], '读取逻辑单元格。'),
  api('置日期', 'bool', [rowKey, columnId, string('日期', '写入单元格的日期文本，按列的日期格式解析显示。')], '写入 ISO 日期文本。'),
  api('取日期', 'wideString', [rowKey, columnId], '读取日期文本。'),

  api('置图片', 'bool', [rowKey, columnId, string('项目路径', '项目 assets 相对路径或本机完整路径，空文本清除图片。')], '设置项目资源或运行时文件路径图片。'),
  api('置图像列表图片', 'bool', [rowKey, columnId, imageList, integer('图片索引', '图像列表中的图片序号，从 0 开始，必须小于图像列表的图片数量。')], '设置 ImageList 图片引用。'),
  api('清除图片', 'bool', [rowKey, columnId], '清除图片单元格。'),
  api('置进度', 'bool', [rowKey, columnId, decimal('进度', '进度值，写入时会被限制到该列设置的数值范围内。')], '设置进度值并限制到列范围。'),
  api('取进度', 'double', [rowKey, columnId], '读取进度值。'),
  api('设置进度状态', 'bool', [rowKey, columnId, string('状态', '进度条状态，只允许 normal、success、warning、error、paused 或 indeterminate，其它值返回失败。')], '设置 normal/success/warning/error/paused/indeterminate 状态。'),
  api('取进度状态', 'wideString', [rowKey, columnId], '读取进度单元格状态；未覆盖时返回 normal。'),
  api('置组合框值', 'bool', [rowKey, columnId, string('值', '选项或单元格的稳定值，用于比较和读写，显示文字由对应的文字参数决定。')], '按稳定值设置组合框单元格。'),
  api('取组合框值', 'wideString', [rowKey, columnId], '读取组合框稳定值。'),
  api('取组合框文字', 'wideString', [rowKey, columnId], '读取组合框中文显示文字。'),
  api('设置按钮显示', 'bool', [rowKey, columnId, string('按钮ID', '按钮列内稳定的按钮标识，不能为空且同一列内不得重复；重复时返回失败。'), bool('显示', '传真显示该列，传假隐藏；隐藏列仍参与数据与校验。')], '覆盖指定单元格按钮显示状态。'),
  api('设置按钮启用', 'bool', [rowKey, columnId, string('按钮ID', '按钮列内稳定的按钮标识，不能为空且同一列内不得重复；重复时返回失败。'), bool('启用', '传真启用该单元格按钮，传假禁用，禁用后不再响应点击。')], '覆盖指定单元格按钮启用状态。'),
  api('设置按钮文字', 'bool', [rowKey, columnId, string('按钮ID', '按钮列内稳定的按钮标识，不能为空且同一列内不得重复；重复时返回失败。'), string('文字', '按钮或单元格显示的文字内容。')], '覆盖指定单元格按钮文字。'),
  api('设置按钮样式', 'bool', [rowKey, columnId, string('按钮ID', '按钮列内稳定的按钮标识，不能为空且同一列内不得重复；重复时返回失败。'), string('样式', '按钮样式标识文本，由界面样式表解释。')], '覆盖指定单元格按钮样式。'),

  api('开始编辑', 'bool', [rowKey, columnId], '开始单元格原地编辑。'),
  api('提交编辑', 'bool', [], '提交当前临时编辑器。'),
  api('取消编辑', 'bool', [], '取消当前临时编辑器。'),
  api('设置当前单元格', 'bool', [rowKey, columnId], '设置键盘当前单元格。'),
  api('取当前行键', 'wideString', [], '读取当前单元格行键。'),
  api('取当前列ID', 'wideString', [], '读取当前单元格列 ID。'),
  api('设置行选中', 'bool', [rowKey, bool('选中', '传真选中该行，传假取消选中。')], '设置行选择状态。'),
  api('取行是否选中', 'bool', [rowKey], '按稳定行键读取该行是否处于选中状态。'),
  api('取选中行数', 'int', [], '读取选中行数量。'),
  api('取选中行键', 'wideString', [index], '读取第 N 个选中行键。'),
  api('撤销', 'bool', [], '撤销最近一次数据事务。'),
  api('重做', 'bool', [], '重做最近一次数据事务。'),

  api('设置排序', 'bool', [columnId, bool('升序', '传真按升序排序，传假按降序排序。')], '替换为单列强类型排序。'),
  api('添加排序', 'bool', [columnId, bool('升序', '传真按升序排序，传假按降序排序。')], '追加多列强类型排序。'),
  api('清除排序', 'bool', [], '清除排序状态。'),
  api('设置列筛选', 'bool', [columnId, string('规则', '筛选或校验规则标识文本；筛选规则留空按 contains 处理。'), string('值', '选项或单元格的稳定值，用于比较和读写，显示文字由对应的文字参数决定。')], '设置列筛选。'),
  api('清除列筛选', 'bool', [columnId], '清除指定列筛选。'),
  api('清除全部筛选', 'bool', [], '清除全部列筛选。'),
  api('设置搜索文字', 'bool', [string('搜索文字', '跨列模糊搜索的关键词文本，空文本清除搜索条件。')], '设置跨列搜索文字。'),

  api('设置列必填', 'bool', [columnId, bool('必填', '传真把该列设为必填，必填单元格写入空值会被拒绝并给出中文提示。')], '设置列必填校验。'),
  api('设置列数值范围', 'bool', [columnId, decimal('最小值', '数值下限，必须不大于最大值，否则返回数值范围无效。'), decimal('最大值', '数值上限，必须不小于最小值，否则返回数值范围无效。')], '设置整数、小数或进度列数值范围。'),
  api('设置列文本规则', 'bool', [columnId, string('正则表达式', '文本列的校验正则文本，空文本清除校验规则。')], '设置文本校验规则。'),
  api('拒绝本次编辑', 'bool', [string('原因', '拒绝本次编辑时反馈给用户的中文原因文本，会随验证结果一起显示。')], '在正在验证事件中拒绝本次编辑。'),

  api('设置虚拟行数', 'bool', [integer('行数', '虚拟数据总行数，0 到 100000000；越界返回虚拟行数越界并清空过期缓存。')], '设置虚拟数据总行数并清空过期缓存。'),
  api('取请求起始行', 'int', [], '读取当前异步虚拟数据请求起始行。'),
  api('取请求数量', 'int', [], '读取当前异步虚拟数据请求数量。'),
  api('提交虚拟行', 'bool', [index, rowKey, string('单元格TSV', '按列顺序用制表符分隔的单元格文本，缺少的列按空文本补齐。')], '提交一条虚拟缓存行。'),
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
