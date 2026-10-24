import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type WordParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };
type WordCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function wordCommand(
  name: string,
  parameters: WordParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: WordCommandOptions = {}
): StandardCommandSpec {
  const snippetArg = (parameter: WordParameter, index: number): string => {
    if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
    if (parameter.type === 'bool') return '假';
    return '0';
  };
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${parameters.map(snippetArg).join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const doc = (description = '由 Word_创建文档 或 Word_打开文档 返回的受管文档。'): WordParameter => ({
  name: '文档',
  type: 'Word文档',
  description
});

export const WORD_MODULE_ID = 'lingbuilder.data.word';

/** 随附运行桥（third_party/word，OOXML 直读直写 + CID PDF 导出）的 SHA-256 基线；详见 third_party/word/NOTICE.md。 */
export const WORD_BUNDLED_RUNTIME_SHA256 = {
  x86: 'fe076536066792d85efe0b1bac09c9c317aede12628ca082715fef9d0724a66b',
  x64: 'f32b047709c09b0715412fa9a5f4642c2c5e2535b870b5ad82a14362c8e8b577'
} as const;

const wordStandardModule = createStandardModule({
  id: WORD_MODULE_ID,
  name: 'Word文档模块',
  version: '1.0.0',
  category: '数据库',
  description: '读写 .docx 文档：标题/段落/表格/图片追加、{{占位符}} 模板批量替换、一键生成报告、导出 PDF（本模块子集）与表格 Excel 互转，无需安装 Microsoft Word。',
  tags: ['数据', 'Word', '文档', 'docx', '报告', '模板'],
  types: [
    { name: 'Word文档', description: '进程内不复用的受管 .docx 文档 ID；不暴露内部文档指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'Word 文档模块 1.0 使用说明', path: 'docs/modules/word/README.md' }],
  snippets: [
    {
      label: 'Word 模板填充生成报告',
      description: '打开模板、批量替换占位符、导出 PDF 的完整骨架；占位符跨 run 分裂（IME/拼写检查拆分）也能正确替换。',
      insertText: [
        '局部 Word文档 报告 = Word_打开文档("$1")',
        '如果 报告 != 0',
        '    Word_替换占位符(报告, "客户名称", "$2")',
        '    Word_替换占位符(报告, "金额", "998.50")',
        '    Word_保存文档(报告, "输出/报告.docx")',
        '    Word_导出PDF(报告, "输出/报告.pdf")',
        '    Word_关闭文档(报告)',
        '否则',
        '    调试输出(Word_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: 'Word 创建文档并写表格',
      description: '新建文档、添加标题段落表格、保存的骨架；生成的文档可用 Word/WPS 正常打开。',
      insertText: [
        '局部 Word文档 文档 = Word_创建文档()',
        'Word_添加标题(文档, "月度销售报告", 1)',
        'Word_添加段落(文档, "本报告由程序自动生成。", "正文")',
        'Word_添加表格(文档, 3, 2)',
        'Word_设置单元格文本(文档, 1, 1, 1, "区域")',
        'Word_设置单元格文本(文档, 1, 1, 2, "销量")',
        '如果 Word_保存文档(文档, "$1")',
        '    调试输出("已保存")',
        '否则',
        '    调试输出(Word_取错误())',
        '结束',
        'Word_关闭文档(文档)'
      ].join('\n')
    }
  ],
  commands: [
    // ---------- 文档生命周期 ----------
    wordCommand('Word_创建文档', [], 'Word文档', '新建一个仅存在于内存的 .docx 文档；调用 Word_保存文档 才写出文件。', {
      category: '文档', example: '局部 Word文档 文档 = Word_创建文档()', returnDescription: '成功返回非 0 的 Word文档，失败返回 0。'
    }),
    wordCommand('Word_打开文档', [
      { name: '文件路径', type: 'wideString', description: '既有 .docx 文件路径；旧版 .doc 二进制格式会被明确拒绝，请先另存为 .docx。' }
    ], 'Word文档', '打开既有 .docx 文档：可读段落表格、替换占位符、追加内容后另存。', {
      category: '文档', returnDescription: '成功返回非 0 的 Word文档，失败返回 0。'
    }),
    wordCommand('Word_保存文档', [doc(), { name: '文件路径', type: 'wideString', description: '要写出的 .docx 文件路径；目录必须已存在。' }], 'bool', '把文档写出到指定路径（创建与打开模式通用；打开模式会保留原文档其余部分原样改写）。'),
    wordCommand('Word_关闭文档', [doc()], 'bool', '关闭并释放文档；未保存的修改会丢失。失效句柄返回假。'),
    wordCommand('Word_释放全部', [], 'void', '释放当前进程内全部文档句柄。', { category: '文档' }),

    // ---------- 读取 ----------
    wordCommand('Word_取全文本', [doc()], 'wideString', '返回全部段落与表格单元格文本：段落之间换行分隔，单元格之间制表符分隔。'),
    wordCommand('Word_取段落数', [doc()], 'int', '返回文档段落数（表格内段落不计入）。'),
    wordCommand('Word_取段落文本', [doc(), { name: '索引', type: 'int', description: '从 1 开始的段落序号。' }], 'wideString', '返回指定段落的文本；越界返回空文本并记录错误。'),
    wordCommand('Word_取段落样式', [doc(), { name: '索引', type: 'int', description: '从 1 开始的段落序号。' }], 'wideString', '返回段落样式：标题1～标题6 或 正文。'),
    wordCommand('Word_取表格数', [doc()], 'int', '返回文档表格数量（含未保存的新建表格）。'),
    wordCommand('Word_取表格行数', [doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号。' }], 'int', '返回表格行数；越界返回 0 并记录错误。'),
    wordCommand('Word_取表格列数', [doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号。' }], 'int', '返回表格列数（按最大行宽计）。'),
    wordCommand('Word_取单元格文本', [
      doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号。' },
      { name: '行', type: 'int', description: '从 1 开始的行号。' },
      { name: '列', type: 'int', description: '从 1 开始的列号。' }
    ], 'wideString', '返回表格单元格文本；越界返回空文本并记录错误。'),

    // ---------- 写入（追加到文档末尾） ----------
    wordCommand('Word_添加标题', [doc(), { name: '文本', type: 'wideString', description: '标题内容。' }, { name: '级别', type: 'int', description: '1～6 级标题。' }], 'bool', '在文档末尾追加一个标题段落。', { category: '写入' }),
    wordCommand('Word_添加段落', [doc(), { name: '文本', type: 'wideString', description: '段落内容，可含换行（写成多行）。' }, { name: '样式', type: 'wideString', description: '标题1～标题6 或 正文；留空按正文。' }], 'bool', '在文档末尾追加一个文本段落。', { category: '写入' }),
    wordCommand('Word_添加表格', [doc(), { name: '行数', type: 'int', description: '1～1000。' }, { name: '列数', type: 'int', description: '1～100。' }], 'bool', '在文档末尾追加一个带边框的空表格，之后用 Word_设置单元格文本 填内容。', { category: '写入' }),
    wordCommand('Word_设置单元格文本', [
      doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号（新建表格在前）。' },
      { name: '行', type: 'int', description: '从 1 开始的行号。' },
      { name: '列', type: 'int', description: '从 1 开始的列号。' },
      { name: '文本', type: 'wideString', description: '单元格内容，可含换行。' }
    ], 'bool', '覆写表格单元格文本。', { category: '写入' }),
    wordCommand('Word_添加图片', [
      doc(), { name: '图片路径', type: 'wideString', description: '本地 PNG 或 JPEG 图片路径。' },
      { name: '宽度', type: 'int', description: '显示宽度像素（96dpi）；传 0 按图片原始尺寸。' },
      { name: '高度', type: 'int', description: '显示高度像素；传 0 按图片原始尺寸。' }
    ], 'bool', '在文档末尾插入一张内联图片。', { category: '写入' }),

    // ---------- 模板与报告 ----------
    wordCommand('Word_替换占位符', [
      doc(), { name: '占位名', type: 'wideString', description: '占位符名称，对应模板中的 {{占位名}} 或 {{ 占位名 }}。' },
      { name: '替换值', type: 'wideString', description: '替换后的内容。' }
    ], 'int', '全文替换一处占位符，返回替换次数（0 表示模板中没有该占位符）。段落级合并 run 后替换，IME/拼写检查把 {{名称}} 拆进多个文本片段也能正确命中；表格单元格内同样生效。', {
      category: '模板', returnDescription: '替换次数；模板未包含该占位符时为 0。'
    }),
    wordCommand('Word_批量替换占位符', [
      doc(), { name: '替换JSON', type: 'wideString', description: '形如 {"客户名称":"张三","金额":"998.50"} 的 JSON 对象。' }
    ], 'int', '按 JSON 对象批量替换全部占位符，返回总替换次数。', {
      category: '模板', returnDescription: '总替换次数。'
    }),
    wordCommand('Word_从JSON生成报告', [
      { name: '模板路径', type: 'wideString', description: '.docx 模板文件路径，内含 {{占位符}}。' },
      { name: '数据JSON', type: 'wideString', description: '形如 {"占位名":"值"} 的 JSON 对象。' },
      { name: '输出路径', type: 'wideString', description: '生成报告的 .docx 写出路径。' }
    ], 'bool', '一步完成「打开模板 → 批量替换 → 保存输出」，批量报告生成的主入口。', { category: '模板' }),

    // ---------- 转换与互转 ----------
    wordCommand('Word_导出PDF', [
      doc(), { name: '输出路径', type: 'wideString', description: '生成的 .pdf 写出路径。' }
    ], 'bool', '把文档导出为 PDF：中文走 CID 字体方案（查看器字体替换，Chrome/Edge/WPS 可直接显示），表格自动分页并重复表头，图片按比例嵌入。仅支持本模块内容子集（段落/表格/图片）；文档含文本框、浮动图形等未支持元素时明确报错并指出元素类型，不会静默丢内容。', { category: '转换' }),
    wordCommand('Word_表格另存Excel', [
      doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号。' },
      { name: '输出路径', type: 'wideString', description: '生成的 .xlsx 写出路径。' }
    ], 'bool', '把文档中的表格导出为 .xlsx 工作表（Excel/WPS 可直接打开）。', { category: '转换' }),
    wordCommand('Word_从Excel填充表格', [
      doc(), { name: '表格索引', type: 'int', description: '从 1 开始的表格序号（被填充的目标表）。' },
      { name: 'Excel路径', type: 'wideString', description: '数据来源 .xlsx 路径，读取第一个工作表。' }
    ], 'bool', '把 Excel 第一个工作表的数据按单元格坐标覆写到文档表格：Excel 第 1 行第 1 列写入表格 (1,1)。要求表格行列不小于数据区域，超出会明确报错。批量报告「Excel 数据 → Word 模板表格」的主链路。', { category: '转换' }),

    // ---------- 诊断 ----------
    wordCommand('Word_取错误', [], 'wideString', '返回当前线程最近一次 Word 模块错误的中文说明。', { category: '诊断' }),
    wordCommand('Word_取版本', [], 'wideString', '返回随附运行桥版本与内置组件信息。', { category: '诊断' }),
    wordCommand('Word_是否可用', [], 'bool', '检查随附运行桥 LingBuilderWord.dll 是否可以加载且全部导出可用。', { category: '诊断' })
  ]
});

/** 随附 LingBuilderWord.dll 按架构登记进 targets：VS 工程各平台配置会平铺复制到 exe 同目录。 */
export const WORD_MODULE: LingBuilderModuleManifest = {
  ...wordStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc', runtimeFiles: ['x86/LingBuilderWord.dll'] },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc', runtimeFiles: ['x64/LingBuilderWord.dll'] }
  ]
};
