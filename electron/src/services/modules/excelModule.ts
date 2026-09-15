import { createModuleBindingSnippetArgument } from './bindingValueType';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type ExcelParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };
type ExcelCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function snippetArgument(parameter: ExcelParameter, index: number): string {
  if (parameter.type === 'controlRef' || parameter.type === 'handler') {
    return createModuleBindingSnippetArgument(parameter, index);
  }
  if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
  if (parameter.type === 'bool') return '假';
  return '0';
}

function excelCommand(
  name: string,
  parameters: ExcelParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: ExcelCommandOptions = {}
): StandardCommandSpec {
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${parameters.map(snippetArgument).join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const workbook = (description = '由 Excel_创建工作簿 或 Excel_打开工作簿 返回的受管工作簿。'): ExcelParameter => ({
  name: '工作簿',
  type: 'Excel工作簿',
  description
});

const workbookCell: ExcelParameter = { name: '单元格', type: 'wideString', description: '单元格地址，例如 "A1" 或 "AB12"。' };

export const EXCEL_MODULE_ID = 'lingbuilder.data.excel';

/** 随附运行桥（third_party/excel，libxlsxwriter 1.2.3 + OpenXLSX 0.5.1）的 SHA-256 基线；详见 third_party/excel/NOTICE.md。 */
export const EXCEL_BUNDLED_RUNTIME_SHA256 = {
  x86: '0c47813145d6fef7014656f020b3c44be23c82ea73729e67eb1ab4cffe749ee5',
  x64: '1bd7f9f08cac876c1aff6208d1d036c2bdb8a0eb2465166ea320fceb7c458832'
} as const;

const excelStandardModule = createStandardModule({
  id: EXCEL_MODULE_ID,
  name: 'Excel 表格模块',
  version: '1.0.0',
  category: '数据库',
  description: '读写 .xlsx 工作簿：多工作表、按单元格坐标读写、公式、日期、追加行、常用格式和插入删除行列，无需安装 Microsoft Excel。创建模式支持全部格式能力，打开模式可保真修改既有报表数值。',
  tags: ['数据', 'Excel', '表格', 'xlsx', '工作簿', '报表'],
  types: [
    { name: 'Excel工作簿', description: '进程内不复用的受管 .xlsx 工作簿 ID；不暴露内部文档指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'Excel 表格模块 1.0 使用说明', path: 'docs/modules/excel/README.md' }],
  snippets: [
    {
      label: 'Excel 导出数据报表',
      description: '创建工作簿、写入表头与数据行、设置格式并保存的完整骨架。',
      insertText: [
        '局部 Excel工作簿 报表 = Excel_创建工作簿("$1")',
        '如果 报表 != 0',
        '    Excel_写一行(报表, "A1", "姓名\\t销量\\t金额", "\\t")',
        '    Excel_置加粗(报表, "A1", 真)',
        '    Excel_追加行(报表, "张三\\t12\\t980.5", "\\t")',
        '    Excel_追加行(报表, "李四\\t8\\t640", "\\t")',
        '    如果 Excel_保存(报表)',
        '        调试输出("已保存")',
        '    否则',
        '        调试输出(Excel_取错误())',
        '    结束',
        '    Excel_关闭(报表)',
        '否则',
        '    调试输出(Excel_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: 'Excel 修改既有报表',
      description: '打开已有 .xlsx，改写单元格并另存的骨架；打开模式保真保留原有格式。',
      insertText: [
        '局部 Excel工作簿 报表 = Excel_打开工作簿("$1")',
        '如果 报表 != 0',
        '    Excel_置当前工作表(报表, "Sheet1")',
        '    Excel_写文本(报表, "B2", "$2")',
        '    如果 Excel_保存(报表)',
        '        调试输出("已更新")',
        '    结束',
        '    Excel_关闭(报表)',
        '否则',
        '    调试输出(Excel_取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    // ---------- 工作簿生命周期 ----------
    excelCommand('Excel_创建工作簿', [
      { name: '文件路径', type: 'wideString', description: '要生成的 .xlsx 文件路径；保存时写出。' }
    ], 'Excel工作簿', '新建一个仅存在于内存的 .xlsx 工作簿（默认含 Sheet1），全部格式能力可用；调用 Excel_保存 才写出文件。', {
      category: '工作簿', example: 'Excel_创建工作簿("报表/月度报表.xlsx")', returnDescription: '成功返回非 0 的 Excel工作簿，失败返回 0。'
    }),
    excelCommand('Excel_打开工作簿', [
      { name: '文件路径', type: 'wideString', description: '既有 .xlsx 文件路径。' }
    ], 'Excel工作簿', '打开既有 .xlsx 工作簿；修改后保存会保真保留原有样式、列宽和公式结构。打开模式不支持格式与结构类命令。', {
      category: '工作簿', example: 'Excel_打开工作簿("报表/月度报表.xlsx")', returnDescription: '成功返回非 0 的 Excel工作簿，失败返回 0。'
    }),
    excelCommand('Excel_保存', [workbook()], 'bool', '把工作簿写出当前文件；创建模式可反复修改后再次保存，打开模式原地写回。'),
    excelCommand('Excel_另存为', [workbook(), { name: '文件路径', type: 'wideString', description: '新的 .xlsx 文件路径；保存目标随之切换。' }], 'bool', '把工作簿写出到新路径，之后的 Excel_保存 也会写向新路径。'),
    excelCommand('Excel_关闭', [workbook()], 'bool', '关闭并释放工作簿；未保存的修改会丢失。失效句柄返回假。'),

    // ---------- 工作表 ----------
    excelCommand('Excel_取工作表数量', [workbook()], 'int', '返回工作簿内工作表数量。'),
    excelCommand('Excel_取工作表名', [workbook(), { name: '序号', type: 'int', description: '从 1 开始的工作表序号。' }], 'wideString', '返回指定序号的工作表名称；越界返回空文本并记录错误。'),
    excelCommand('Excel_取当前工作表', [workbook()], 'wideString', '返回当前读写操作所用的工作表名称。'),
    excelCommand('Excel_置当前工作表', [workbook(), { name: '名称', type: 'wideString', description: '工作表名称。' }], 'bool', '切换当前读写操作所用的工作表；找不到同名工作表返回假。'),
    excelCommand('Excel_添加工作表', [workbook(), { name: '名称', type: 'wideString', description: '新工作表名称，不能与现有名称重复。' }], 'bool', '在工作簿末尾追加一个空工作表。'),
    excelCommand('Excel_删除工作表', [workbook(), { name: '名称', type: 'wideString', description: '要删除的工作表名称，必须与表签完全一致；不能删除最后一个可见工作表。'}], 'bool', '删除指定工作表；工作簿至少保留一个工作表。'),

    // ---------- 单元格写入 ----------
    excelCommand('Excel_写文本', [workbook(), workbookCell, { name: '内容', type: 'wideString', description: '写入单元格的文本内容，按字符串类型保存。'}], 'bool', '把文本写入单元格。'),
    excelCommand('Excel_写数值', [workbook(), workbookCell, { name: '数值', type: 'double', description: '写入单元格的数值，按数字类型保存。'}], 'bool', '把数值写入单元格。'),
    excelCommand('Excel_写布尔', [workbook(), workbookCell, { name: '值', type: 'bool', description: '写入单元格的逻辑值，Excel 中显示为 TRUE 或 FALSE。'}], 'bool', '把布尔值写入单元格。'),
    excelCommand('Excel_写公式', [workbook(), workbookCell, { name: '公式', type: 'wideString', description: '可带或不带等号，例如 "SUM(B1:B9)"。' }], 'bool', '写入公式；Excel/WPS 打开文件时自动计算。创建模式公式没有缓存值。'),
    excelCommand('Excel_写日期', [workbook(), workbookCell, { name: '日期时间', type: 'wideString', description: '形如 "2026-01-31" 或 "2026-01-31 08:30:00"。' }], 'bool', '把日期时间写入单元格：自动换算为日期序列值；创建模式会同时套用日期显示格式，打开模式只写序列值。'),
    excelCommand('Excel_清除单元格', [workbook(), workbookCell], 'bool', '清空单元格内容和格式。'),

    // ---------- 单元格读取 ----------
    excelCommand('Excel_读单元格文本', [workbook(), workbookCell], 'wideString', '读取单元格文本表示；数值、布尔与公式缓存值都会转成文本，空单元格返回空文本。'),
    excelCommand('Excel_读单元格数值', [workbook(), workbookCell], 'double', '读取单元格数值；内容不是数值时返回 0 并记录错误。'),
    excelCommand('Excel_读单元格公式', [workbook(), workbookCell], 'wideString', '读取公式内容（不带等号）；不是公式单元格时返回空文本并记录错误。'),
    excelCommand('Excel_取单元格类型', [workbook(), workbookCell], 'int', '返回单元格类型：0=空，1=文本，2=数值，3=布尔，4=公式。'),
    excelCommand('Excel_是否为空单元格', [workbook(), workbookCell], 'bool', '判断单元格是否为空。'),

    // ---------- 行列批量 ----------
    excelCommand('Excel_写一行', [
      workbook(),
      { name: '起始单元格', type: 'wideString', description: '本行第一个值写入的位置。' },
      { name: '行内容', type: 'wideString', description: '用分隔符拼接的一行数据，例如 "张三\\t25\\t北京"。' },
      { name: '分隔符', type: 'wideString', description: '值之间的分隔文本；空文本按制表符处理。' }
    ], 'bool', '从起始单元格开始横向写入一整行；纯数字片段自动写成数值，空片段跳过不写。'),
    excelCommand('Excel_追加行', [
      workbook(),
      { name: '行内容', type: 'wideString', description: '用分隔符拼接的一行数据。' },
      { name: '分隔符', type: 'wideString', description: '值之间的分隔文本；空文本按制表符处理。' }
    ], 'int', '在当前工作表最后一个非空行的下一行追加数据；返回写入的行号（从 1 开始），失败返回 -1。', {
      returnDescription: '写入的 1 起始行号，失败返回 -1。'
    }),
    excelCommand('Excel_读区域', [
      workbook(),
      { name: '范围', type: 'wideString', description: '区域地址，例如 "A1:C10"。' },
      { name: '分隔符', type: 'wideString', description: '同行单元格之间的拼接文本；空文本按制表符处理。' }
    ], 'wideString', '读取一个矩形区域：行之间用换行分隔、单元格之间用指定分隔符拼接；可直接逐行解析或配合 CSV/JSON 模块加工。'),
    excelCommand('Excel_取已用范围', [workbook()], 'wideString', '返回当前工作表已使用区域，例如 "A1:F20"；空表返回空文本。'),

    // ---------- 结构与格式（创建模式） ----------
    excelCommand('Excel_置列宽', [workbook(), { name: '列标', type: 'wideString', description: '列字母，例如 "A" 或 "AB"。' }, { name: '宽度', type: 'double', description: '以字符数为单位的列宽，0～255。' }], 'bool', '设置当前工作表列宽。'),
    excelCommand('Excel_置行高', [workbook(), { name: '行号', type: 'int', description: '从 1 开始的行号。' }, { name: '高度', type: 'double', description: '以磅为单位的行高，0～409。' }], 'bool', '设置当前工作表行高。'),
    excelCommand('Excel_合并单元格', [workbook(), { name: '范围', type: 'wideString', description: '矩形区域，例如 "A1:C3"。' }], 'bool', '合并一个矩形区域；左上角单元格的值作为合并后内容。'),
    excelCommand('Excel_冻结窗格', [workbook(), { name: '行数', type: 'int', description: '冻结的首部行数。' }, { name: '列数', type: 'int', description: '冻结的左侧列数。' }], 'bool', '冻结当前工作表首部行与左侧列，滚动时保持表头可见。'),
    excelCommand('Excel_置数字格式', [workbook(), workbookCell, { name: '格式索引', type: 'int', description: '0=文本，1=整数，2=两位小数，3=百分比，4=日期时间。' }], 'bool', '设置单元格数字显示格式。'),
    excelCommand('Excel_置加粗', [workbook(), workbookCell, { name: '启用', type: 'bool', description: '传真把该单元格字体设为加粗，传假取消加粗。'}], 'bool', '设置单元格字体加粗。'),
    excelCommand('Excel_置字号', [workbook(), workbookCell, { name: '字号', type: 'double', description: '1～409 的字号。' }], 'bool', '设置单元格字号。'),
    excelCommand('Excel_置字体颜色', [workbook(), workbookCell, { name: '颜色值', type: 'int', description: '0xRRGGBB 颜色值，例如 0xFF0000 表示红色；十进制 16711680 等价。' }], 'bool', '设置单元格字体颜色。'),
    excelCommand('Excel_置背景色', [workbook(), workbookCell, { name: '颜色值', type: 'int', description: '0xRRGGBB 颜色值。' }], 'bool', '设置单元格背景填充色。'),
    excelCommand('Excel_置水平对齐', [workbook(), workbookCell, { name: '对齐方式', type: 'int', description: '0=左对齐，1=居中，2=右对齐。' }], 'bool', '设置单元格水平对齐方式。'),

    // ---------- 插入/删除行列（创建模式） ----------
    excelCommand('Excel_插入行', [workbook(), { name: '行号', type: 'int', description: '从该行（1 起始）开始下移。' }, { name: '数量', type: 'int', description: '要在该行之前插入的行数量，必须大于 0。'}], 'bool', '在指定行前插入空行，已有内容整体下移。'),
    excelCommand('Excel_删除行', [workbook(), { name: '行号', type: 'int', description: '从 1 开始的起始行号。' }, { name: '数量', type: 'int', description: '要从该行开始删除的行数量，必须大于 0。'}], 'bool', '删除指定起点的若干行，后续内容上移补位。'),
    excelCommand('Excel_插入列', [workbook(), { name: '列号', type: 'int', description: '从该列（1 起始，A=1）开始右移。' }, { name: '数量', type: 'int', description: '要在该列之前插入的列数量，必须大于 0。'}], 'bool', '在指定列前插入空列，已有内容整体右移。'),
    excelCommand('Excel_删除列', [workbook(), { name: '列号', type: 'int', description: '从 1 开始的起始列号（A=1）。' }, { name: '数量', type: 'int', description: '要从该列开始删除的列数量，必须大于 0。'}], 'bool', '删除指定起点的若干列，后续内容左移补位。'),

    // ---------- 日期换算 ----------
    excelCommand('Excel_日期转序列', [
      { name: '日期时间', type: 'wideString', description: '形如 "2026-01-31" 或 "2026-01-31 08:30:00"。' }
    ], 'double', '把日期时间换算为 Excel 序列值；格式无效返回 -1。1900-03-01 之前的日期与 Excel 相差 1（Excel 1900 年闰年历史缺陷）。'),
    excelCommand('Excel_序列转日期', [
      { name: '序列值', type: 'double', description: 'Excel 日期序列值，0～2958465。' }
    ], 'wideString', '把 Excel 序列值换算为 "YYYY-MM-DD[ HH:MM:SS]" 文本；超出范围返回空文本。'),

    // ---------- 诊断 ----------
    excelCommand('Excel_取错误', [], 'wideString', '返回当前线程最近一次 Excel 模块错误的中文说明。', { category: '诊断' }),
    excelCommand('Excel_取版本', [], 'wideString', '返回随附运行桥版本与内置库信息。', { category: '诊断' }),
    excelCommand('Excel_是否可用', [], 'bool', '检查随附运行桥 LingBuilderExcel.dll 是否可以加载且全部导出可用。', { category: '诊断' })
  ]
});

/** 随附 LingBuilderExcel.dll 按架构登记进 targets：VS 工程各平台配置会平铺复制到 exe 同目录。 */
export const EXCEL_MODULE: LingBuilderModuleManifest = {
  ...excelStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', runtimeFiles: ['x86/LingBuilderExcel.dll'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', runtimeFiles: ['x64/LingBuilderExcel.dll'] }
  ]
};
