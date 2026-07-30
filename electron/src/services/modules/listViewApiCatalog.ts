import type { ModuleBindingValueType, ModuleCommandBinding, ModuleCommandContribution } from './types';

export interface ListViewAdvancedApiDefinition {
  name: string;
  signature: string;
  description: string;
  insertText: string;
  returnType: '整数型' | '长整数型' | '逻辑型' | '文本型';
  parameters: Array<{ name: string; type: ModuleBindingValueType }>;
  bindingReturnType: ModuleBindingValueType;
  memberName: string;
  memberArgs: string;
}

const api = (name: string, signature: string, description: string, insertText: string,
  returnType: ListViewAdvancedApiDefinition['returnType'], parameters: ListViewAdvancedApiDefinition['parameters'],
  bindingReturnType: ModuleBindingValueType, memberName: string, memberArgs: string): ListViewAdvancedApiDefinition => ({
  name, signature, description, insertText, returnType, parameters, bindingReturnType, memberName, memberArgs
});

export const LIST_VIEW_ADVANCED_API: ListViewAdvancedApiDefinition[] = [
  api('列表视图_添加列', '列表视图_添加列(控件名, 标题, 宽度, 对齐)', '在末尾添加详细信息视图列。对齐为 left/center/right。', '列表视图_添加列("$1", "$2", 120, "left")', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '标题', type: 'wideString' }, { name: '宽度', type: 'int' }, { name: '对齐', type: 'wideString' }], 'int', '添加列', '"$1", 120, "left"'),
  api('列表视图_插入列', '列表视图_插入列(控件名, 列索引, 标题, 宽度, 对齐)', '在指定零基索引插入列。', '列表视图_插入列("$1", 0, "$2", 120, "left")', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }, { name: '标题', type: 'wideString' }, { name: '宽度', type: 'int' }, { name: '对齐', type: 'wideString' }], 'int', '插入列', '0, "$1", 120, "left"'),
  api('列表视图_删除列', '列表视图_删除列(控件名, 列索引)', '删除指定列并同步虚拟行数据。', '列表视图_删除列("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }], 'bool', '删除列', '0'),
  api('列表视图_设置列标题', '列表视图_设置列标题(控件名, 列索引, 标题)', '修改列标题。', '列表视图_设置列标题("$1", 0, "$2")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }, { name: '标题', type: 'wideString' }], 'bool', '设置列标题', '0, "$1"'),
  api('列表视图_取列标题', '列表视图_取列标题(控件名, 列索引)', '读取列标题。', '列表视图_取列标题("$1", 0)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }], 'wideString', '取列标题', '0'),
  api('列表视图_设置列宽', '列表视图_设置列宽(控件名, 列索引, 宽度)', '设置列宽；-1/-2 对应自动宽度。', '列表视图_设置列宽("$1", 0, 120)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }, { name: '宽度', type: 'int' }], 'bool', '设置列宽', '0, 120'),
  api('列表视图_取列宽', '列表视图_取列宽(控件名, 列索引)', '读取列宽。', '列表视图_取列宽("$1", 0)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '列索引', type: 'int' }], 'int', '取列宽', '0'),
  api('列表视图_取列数', '列表视图_取列数(控件名)', '读取表头列数。', '列表视图_取列数("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取列数', ''),
  api('列表视图_设置行选中', '列表视图_设置行选中(控件名, 行索引, 选中)', '设置行选择状态和焦点。', '列表视图_设置行选中("$1", 0, 真)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '选中', type: 'bool' }], 'bool', '设置行选中', '0, 真'),
  api('列表视图_取选中行数', '列表视图_取选中行数(控件名)', '读取当前选中行数量。', '列表视图_取选中行数("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取选中行数', ''),
  api('列表视图_取下一个选中行', '列表视图_取下一个选中行(控件名, 起始行)', '从起始行之后查找下一个选中行。', '列表视图_取下一个选中行("$1", -1)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '起始行', type: 'int' }], 'int', '取下一个选中行', '-1'),
  api('列表视图_设置行勾选', '列表视图_设置行勾选(控件名, 行索引, 勾选)', '启用复选框后设置行勾选状态。', '列表视图_设置行勾选("$1", 0, 真)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '勾选', type: 'bool' }], 'bool', '设置行勾选', '0, 真'),
  api('列表视图_取行勾选', '列表视图_取行勾选(控件名, 行索引)', '读取行勾选状态。', '列表视图_取行勾选("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'bool', '取行勾选', '0'),
  api('列表视图_设置焦点行', '列表视图_设置焦点行(控件名, 行索引)', '设置键盘焦点行。', '列表视图_设置焦点行("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'bool', '设置焦点行', '0'),
  api('列表视图_取焦点行', '列表视图_取焦点行(控件名)', '读取键盘焦点行。', '列表视图_取焦点行("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取焦点行', ''),
  api('列表视图_设置行图像', '列表视图_设置行图像(控件名, 行索引, 图像索引)', '设置普通行的小图标索引。', '列表视图_设置行图像("$1", 0, 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '图像索引', type: 'int' }], 'bool', '设置行图像', '0, 0'),
  api('列表视图_取行图像', '列表视图_取行图像(控件名, 行索引)', '读取行图像索引。', '列表视图_取行图像("$1", 0)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'int', '取行图像', '0'),
  api('列表视图_设置行数据', '列表视图_设置行数据(控件名, 行索引, 数据)', '设置 LVITEM lParam 应用数据。', '列表视图_设置行数据("$1", 0, 1001)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '数据', type: 'longLong' }], 'bool', '设置行数据', '0, 1001'),
  api('列表视图_取行数据', '列表视图_取行数据(控件名, 行索引)', '读取 LVITEM lParam 应用数据。', '列表视图_取行数据("$1", 0)', '长整数型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'longLong', '取行数据', '0'),
  api('列表视图_查找文本', '列表视图_查找文本(控件名, 文本, 起始行, 部分匹配)', '使用 LVM_FINDITEM 查找行。', '列表视图_查找文本("$1", "$2", -1, 假)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '文本', type: 'wideString' }, { name: '起始行', type: 'int' }, { name: '部分匹配', type: 'bool' }], 'int', '查找文本', '"$1", -1, 假'),
  api('列表视图_命中测试行', '列表视图_命中测试行(控件名, 横坐标, 纵坐标)', '返回客户区坐标处的行索引。', '列表视图_命中测试行("$1", 20, 40)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], 'int', '命中测试行', '20, 40'),
  api('列表视图_命中测试列', '列表视图_命中测试列(控件名, 横坐标, 纵坐标)', '返回客户区坐标处的子项列索引。', '列表视图_命中测试列("$1", 20, 40)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], 'int', '命中测试列', '20, 40'),
  api('列表视图_取行矩形', '列表视图_取行矩形(控件名, 行索引, 部位)', '返回 left,top,width,height；部位为 bounds/icon/label/select。', '列表视图_取行矩形("$1", 0, "bounds")', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '部位', type: 'wideString' }], 'wideString', '取行矩形', '0, "bounds"'),
  api('列表视图_取单元格矩形', '列表视图_取单元格矩形(控件名, 行索引, 列索引)', '返回子项矩形 left,top,width,height。', '列表视图_取单元格矩形("$1", 0, 0)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '列索引', type: 'int' }], 'wideString', '取单元格矩形', '0, 0'),
  api('列表视图_保证可见', '列表视图_保证可见(控件名, 行索引, 允许部分可见)', '滚动到指定行。', '列表视图_保证可见("$1", 0, 假)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '允许部分可见', type: 'bool' }], 'bool', '保证可见', '0, 假'),
  api('列表视图_是否可见', '列表视图_是否可见(控件名, 行索引)', '判断行是否在可见区域。', '列表视图_是否可见("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'bool', '是否可见', '0'),
  api('列表视图_滚动', '列表视图_滚动(控件名, 横向像素, 纵向像素)', '滚动列表内容。', '列表视图_滚动("$1", 0, 28)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '横向像素', type: 'int' }, { name: '纵向像素', type: 'int' }], 'bool', '滚动', '0, 28'),
  api('列表视图_取顶部行', '列表视图_取顶部行(控件名)', '读取首个可见行。', '列表视图_取顶部行("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取顶部行', ''),
  api('列表视图_取每页行数', '列表视图_取每页行数(控件名)', '读取一页完整可见行数。', '列表视图_取每页行数("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取每页行数', ''),
  api('列表视图_重绘行', '列表视图_重绘行(控件名, 起始行, 结束行)', '重绘指定行范围。', '列表视图_重绘行("$1", 0, 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '起始行', type: 'int' }, { name: '结束行', type: 'int' }], 'bool', '重绘行', '0, 0'),
  api('列表视图_更新行', '列表视图_更新行(控件名, 行索引)', '发送 LVM_UPDATE 更新行。', '列表视图_更新行("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'bool', '更新行', '0'),
  api('列表视图_设置视图', '列表视图_设置视图(控件名, 视图)', '运行时切换 details/list/icon/smallIcon/tile。', '列表视图_设置视图("$1", "details")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '视图', type: 'wideString' }], 'bool', '设置视图', '"details"'),
  api('列表视图_取视图', '列表视图_取视图(控件名)', '读取当前视图名称。', '列表视图_取视图("$1")', '文本型', [{ name: '控件名', type: 'wideString' }], 'wideString', '取视图', ''),
  api('列表视图_设置扩展样式', '列表视图_设置扩展样式(控件名, 样式名, 启用)', '设置 gridLines/checkBoxes/fullRowSelect/doubleBuffer/headerDragDrop/infoTip/labelTip/trackSelect/borderSelect。', '列表视图_设置扩展样式("$1", "checkBoxes", 真)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '样式名', type: 'wideString' }, { name: '启用', type: 'bool' }], 'bool', '设置扩展样式', '"checkBoxes", 真'),
  api('列表视图_取扩展样式', '列表视图_取扩展样式(控件名, 样式名)', '读取指定扩展样式状态。', '列表视图_取扩展样式("$1", "gridLines")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '样式名', type: 'wideString' }], 'bool', '取扩展样式', '"gridLines"'),
  ...['背景', '文字', '文字背景'].flatMap((label, index) => {
    const key = index === 0 ? '背景' : index === 1 ? '文字' : '文字背景';
    return [
      api(`列表视图_设置${key}色`, `列表视图_设置${key}色(控件名, 红, 绿, 蓝)`, `设置${label} COLORREF。`, `列表视图_设置${key}色("$1", 15, 23, 42)`, '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '红', type: 'int' }, { name: '绿', type: 'int' }, { name: '蓝', type: 'int' }], 'bool', `设置${key}色`, '15, 23, 42'),
      api(`列表视图_取${key}色`, `列表视图_取${key}色(控件名)`, `读取${label} COLORREF 整数。`, `列表视图_取${key}色("$1")`, '整数型', [{ name: '控件名', type: 'wideString' }], 'int', `取${key}色`, '')
    ];
  }),
  api('列表视图_启用分组', '列表视图_启用分组(控件名, 启用)', '启用或关闭分组视图。', '列表视图_启用分组("$1", 真)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '启用', type: 'bool' }], 'bool', '启用分组', '真'),
  api('列表视图_取分组启用', '列表视图_取分组启用(控件名)', '读取分组视图状态。', '列表视图_取分组启用("$1")', '逻辑型', [{ name: '控件名', type: 'wideString' }], 'bool', '取分组启用', ''),
  api('列表视图_添加组', '列表视图_添加组(控件名, 组ID, 标题)', '添加 LVGROUP。', '列表视图_添加组("$1", 1, "$2")', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '组ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'int', '添加组', '1, "$1"'),
  api('列表视图_删除组', '列表视图_删除组(控件名, 组ID)', '删除指定组。', '列表视图_删除组("$1", 1)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '组ID', type: 'int' }], 'bool', '删除组', '1'),
  api('列表视图_清空组', '列表视图_清空组(控件名)', '删除全部组。', '列表视图_清空组("$1")', '逻辑型', [{ name: '控件名', type: 'wideString' }], 'bool', '清空组', ''),
  api('列表视图_取组数', '列表视图_取组数(控件名)', '读取组数量。', '列表视图_取组数("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取组数', ''),
  api('列表视图_是否有组', '列表视图_是否有组(控件名, 组ID)', '判断组是否存在。', '列表视图_是否有组("$1", 1)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '组ID', type: 'int' }], 'bool', '是否有组', '1'),
  api('列表视图_设置组标题', '列表视图_设置组标题(控件名, 组ID, 标题)', '修改组标题。', '列表视图_设置组标题("$1", 1, "$2")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '组ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'bool', '设置组标题', '1, "$1"'),
  api('列表视图_取组标题', '列表视图_取组标题(控件名, 组ID)', '读取组标题。', '列表视图_取组标题("$1", 1)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '组ID', type: 'int' }], 'wideString', '取组标题', '1'),
  api('列表视图_设置行组', '列表视图_设置行组(控件名, 行索引, 组ID)', '把普通行分配到组。', '列表视图_设置行组("$1", 0, 1)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '组ID', type: 'int' }], 'bool', '设置行组', '0, 1'),
  api('列表视图_取行组', '列表视图_取行组(控件名, 行索引)', '读取普通行组 ID。', '列表视图_取行组("$1", 0)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'int', '取行组', '0'),
  api('列表视图_设置标签可编辑', '列表视图_设置标签可编辑(控件名, 可编辑)', '切换 LVS_EDITLABELS。', '列表视图_设置标签可编辑("$1", 真)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '可编辑', type: 'bool' }], 'bool', '设置标签可编辑', '真'),
  api('列表视图_开始标签编辑', '列表视图_开始标签编辑(控件名, 行索引)', '开始原地编辑行标签。', '列表视图_开始标签编辑("$1", 0)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'bool', '开始标签编辑', '0'),
  api('列表视图_取消标签编辑', '列表视图_取消标签编辑(控件名)', '取消当前标签编辑。', '列表视图_取消标签编辑("$1")', '逻辑型', [{ name: '控件名', type: 'wideString' }], 'bool', '取消标签编辑', ''),
  api('列表视图_设置选择标记', '列表视图_设置选择标记(控件名, 行索引)', '设置 selection mark。', '列表视图_设置选择标记("$1", 0)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'int', '设置选择标记', '0'),
  api('列表视图_取选择标记', '列表视图_取选择标记(控件名)', '读取 selection mark。', '列表视图_取选择标记("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取选择标记', ''),
  api('列表视图_设置热项', '列表视图_设置热项(控件名, 行索引)', '设置 hot item。', '列表视图_设置热项("$1", 0)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'int', '设置热项', '0'),
  api('列表视图_取热项', '列表视图_取热项(控件名)', '读取 hot item。', '列表视图_取热项("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取热项', ''),
  api('列表视图_设置悬停时间', '列表视图_设置悬停时间(控件名, 毫秒)', '设置热跟踪悬停时间。', '列表视图_设置悬停时间("$1", 400)', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '毫秒', type: 'int' }], 'int', '设置悬停时间', '400'),
  api('列表视图_取悬停时间', '列表视图_取悬停时间(控件名)', '读取悬停时间。', '列表视图_取悬停时间("$1")', '整数型', [{ name: '控件名', type: 'wideString' }], 'int', '取悬停时间', ''),
  api('列表视图_设置图像列表', '列表视图_设置图像列表(控件名, 图像列表ID, 类型)', '绑定设计器 ImageList；类型为 normal/small/state/group。', '列表视图_设置图像列表("$1", "$2", "small")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '图像列表ID', type: 'wideString' }, { name: '类型', type: 'wideString' }], 'bool', '设置图像列表', '"$1", "small"'),
  api('列表视图_取表头句柄', '列表视图_取表头句柄(控件名)', '读取 Header HWND 数值。', '列表视图_取表头句柄("$1")', '长整数型', [{ name: '控件名', type: 'wideString' }], 'longLong', '取表头句柄', ''),
  api('列表视图_取字符串宽度', '列表视图_取字符串宽度(控件名, 文本)', '按当前字体测量文本宽度。', '列表视图_取字符串宽度("$1", "$2")', '整数型', [{ name: '控件名', type: 'wideString' }, { name: '文本', type: 'wideString' }], 'int', '取字符串宽度', '"$1"'),
  api('列表视图_设置插入标记', '列表视图_设置插入标记(控件名, 行索引, 在后方)', '设置插入标记。', '列表视图_设置插入标记("$1", 0, 假)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '在后方', type: 'bool' }], 'bool', '设置插入标记', '0, 假'),
  api('列表视图_取插入标记', '列表视图_取插入标记(控件名)', '返回“行索引,在后方”。', '列表视图_取插入标记("$1")', '文本型', [{ name: '控件名', type: 'wideString' }], 'wideString', '取插入标记', ''),
  api('列表视图_设置项目位置', '列表视图_设置项目位置(控件名, 行索引, 横坐标, 纵坐标)', '在图标视图移动项目。', '列表视图_设置项目位置("$1", 0, 20, 20)', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], 'bool', '设置项目位置', '0, 20, 20'),
  api('列表视图_取项目位置', '列表视图_取项目位置(控件名, 行索引)', '返回“横坐标,纵坐标”。', '列表视图_取项目位置("$1", 0)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '行索引', type: 'int' }], 'wideString', '取项目位置', '0'),
  api('列表视图_排列图标', '列表视图_排列图标(控件名, 排列)', '排列图标：default/left/top/snap。', '列表视图_排列图标("$1", "default")', '逻辑型', [{ name: '控件名', type: 'wideString' }, { name: '排列', type: 'wideString' }], 'bool', '排列图标', '"default"'),
  api('列表视图_设置图标间距', '列表视图_设置图标间距(控件名, 水平, 垂直)', '设置图标视图间距。', '列表视图_设置图标间距("$1", 100, 80)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '水平', type: 'int' }, { name: '垂直', type: 'int' }], 'wideString', '设置图标间距', '100, 80'),
  api('列表视图_取近似尺寸', '列表视图_取近似尺寸(控件名, 行数, 宽度, 高度)', '返回容纳项目的近似“宽度,高度”。', '列表视图_取近似尺寸("$1", 10, 400, 300)', '文本型', [{ name: '控件名', type: 'wideString' }, { name: '行数', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], 'wideString', '取近似尺寸', '10, 400, 300')
];

export const LIST_VIEW_ADVANCED_COMMANDS: ModuleCommandContribution[] = LIST_VIEW_ADVANCED_API.map(item => ({
  name: item.name, signature: item.signature, description: item.description, insertText: item.insertText, returnType: item.returnType
}));

export const LIST_VIEW_ADVANCED_BINDINGS: ModuleCommandBinding[] = LIST_VIEW_ADVANCED_API.map(item => ({
  command: item.name, runtimeName: item.name, parameters: item.parameters, returnType: item.bindingReturnType, encoding: 'wide'
}));
