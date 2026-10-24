import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type PdfParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };
type PdfCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function pdfCommand(
  name: string,
  parameters: PdfParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: PdfCommandOptions = {}
): StandardCommandSpec {
  const snippetArg = (parameter: PdfParameter, index: number): string => {
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

const pdf = (description = '由 PDF_打开 或 PDF_打开字节集 返回的受管文档。'): PdfParameter => ({
  name: '文档',
  type: 'PDF文档',
  description
});

const page = (description = '从 1 开始的页号。'): PdfParameter => ({ name: '页号', type: 'int', description });

export const PDF_MODULE_ID = 'lingbuilder.data.pdf';
export const PDF_SDK_MODULE_ID = 'lingbuilder.pdf.sdk';
export const PDFIUM_VERSION = '158.0.8111';
export const PDF_BRIDGE_VERSION = '1.0.0';

const pdfStandardModule = createStandardModule({
  id: PDF_MODULE_ID,
  name: 'PDF文档模块',
  version: '1.0.0',
  category: '数据库',
  description: '读取与加工 PDF：逐页/全文文本提取（行序重建）、无文本层判断（扫描件分流 OCR）、页面渲染 PNG、内嵌图片提取、拆分与合并、转 Word 文本流，以及经本机 Office/WPS 的外部文档转 PDF（docx/xlsx 高保真）。',
  tags: ['数据', 'PDF', '文档', '提取', '转换', 'PDFium'],
  types: [
    { name: 'PDF文档', description: '进程内不复用的受管 PDF 文档 ID；不暴露内部文档指针。', cppType: 'long long' }
  ],
  docs: [{ title: 'PDF 文档模块 1.0 使用说明', path: 'docs/modules/pdf/README.md' }],
  snippets: [
    {
      label: 'PDF 提取全文文本',
      description: '打开 PDF、判断文本层、提取全文的骨架；扫描件自动提示转 OCR 模块。',
      insertText: [
        '局部 PDF文档 文档 = PDF_打开("$1")',
        '如果 文档 != 0',
        '    如果 PDF_是否有文本层(文档, 1)',
        '        调试输出(PDF_取全部文本(文档))',
        '    否则',
        '        调试输出("扫描件：无文本层，请配合 OCR 模块识别")',
        '    结束',
        '    PDF_关闭(文档)',
        '否则',
        '    调试输出(PDF_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: '外部文档转 PDF（Office/WPS 自动检测）',
      description: '把 docx/xlsx 高保真转成 PDF；自动检测 Word → WPS（docx）/ Excel → WPS 表格（xlsx）引擎链。',
      insertText: [
        '如果 PDF_外部文档转PDF("$1", "输出/报告.pdf")',
        '    调试输出("转换引擎：" + PDF_取Office转换引擎())',
        '否则',
        '    调试输出(PDF_取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    // ---------- 文档生命周期 ----------
    pdfCommand('PDF_打开', [
      { name: '文件路径', type: 'wideString', description: '本地 PDF 文件路径。' }
    ], 'PDF文档', '打开本地 PDF 文档；加密 PDF（需要密码）会被明确拒绝。', {
      category: '文档', returnDescription: '成功返回非 0 的 PDF文档，失败返回 0。'
    }),
    pdfCommand('PDF_打开字节集', [
      { name: '数据', type: 'bytes', description: 'PDF 文件内容字节集（网络下载、内存中的 PDF 免落盘直读）。' }
    ], 'PDF文档', '从内存字节集打开 PDF；字节集必须以 %PDF- 开头。', {
      category: '文档', returnDescription: '成功返回非 0 的 PDF文档，失败返回 0。'
    }),
    pdfCommand('PDF_关闭', [pdf()], 'bool', '关闭并释放文档；失效句柄返回假。', { category: '文档' }),
    pdfCommand('PDF_释放全部', [], 'void', '释放当前进程内全部 PDF 文档句柄。', { category: '文档' }),

    // ---------- 页面信息与文本 ----------
    pdfCommand('PDF_取页数', [pdf()], 'int', '返回文档总页数。'),
    pdfCommand('PDF_取页面宽度', [pdf(), page()], 'double', '返回页面宽度（pt 坐标）；页号越界返回 0。'),
    pdfCommand('PDF_取页面高度', [pdf(), page()], 'double', '返回页面高度（pt 坐标）；页号越界返回 0。'),
    pdfCommand('PDF_取页面文本', [pdf(), page('从 1 开始的页号。')], 'wideString', '提取一页文本：按字符坐标 y 聚类成行、行内按 x 排序重建阅读顺序（双栏 PDF 也能得到正确行序），CJK 不乱码。'),
    pdfCommand('PDF_取全部文本', [pdf()], 'wideString', '提取全部页文本，页与页之间换行分隔。'),
    pdfCommand('PDF_是否有文本层', [pdf(), page('从 1 开始的页号。')], 'bool', '判断页面是否含可选择文本：扫描件返回假，应配合 OCR 模块（lingbuilder.ocr）识别后再提取。'),

    // ---------- 渲染与图片 ----------
    pdfCommand('PDF_渲染页面PNG', [
      pdf(), page(),
      { name: '缩放倍率', type: 'double', description: '0.1～8；1 约为 72dpi，2 约为 144dpi。' },
      { name: '输出路径', type: 'wideString', description: '生成的 PNG 写出路径。' }
    ], 'bool', '把页面渲染为 PNG 图片（白底、RGB）；渲染上限 6400 万像素。', { category: '渲染' }),
    pdfCommand('PDF_取图片数', [pdf(), page()], 'int', '返回页面内嵌图片数量。', { category: '渲染' }),
    pdfCommand('PDF_提取图片', [
      pdf(), page(),
      { name: '图片索引', type: 'int', description: '从 1 开始，按页面对象顺序编号。' },
      { name: '输出路径', type: 'wideString', description: '生成的 PNG 写出路径。' }
    ], 'bool', '把页面内嵌图片提取保存为 PNG。', { category: '渲染' }),

    // ---------- 拆分与合并 ----------
    pdfCommand('PDF_拆分页面', [
      pdf(),
      { name: '起始页', type: 'int', description: '从 1 开始。' },
      { name: '结束页', type: 'int', description: '含该页；必须不小于起始页。' },
      { name: '输出路径', type: 'wideString', description: '生成的 PDF 写出路径。' }
    ], 'bool', '把指定页码区间拆分为一个新 PDF。', { category: '页面' }),
    pdfCommand('PDF_合并文档', [
      pdf('第一个文档（句柄 A）。'),
      { name: '文档乙', type: 'PDF文档', description: '第二个文档（句柄 B），内容追加在甲之后。' },
      { name: '输出路径', type: 'wideString', description: '合并结果 PDF 写出路径。' }
    ], 'bool', '合并两个已打开的 PDF：文档甲在前、文档乙在后。', { category: '页面' }),

    // ---------- 转换 ----------
    pdfCommand('PDF_转Word文本流', [
      pdf(),
      { name: '输出路径', type: 'wideString', description: '生成的 .docx 写出路径。' }
    ], 'bool', '内容级转换：PDF 文本按行聚类成段落写成可编辑 .docx（每页前插入「— 第 N 页 —」分隔）。描述定位是内容可编辑、版面近似不保真，复杂排版请在 Word 中调整；图片与表格结构不迁移。无文本层的扫描件会明确报错并提示改走 OCR。', { category: '转换' }),
    pdfCommand('PDF_外部文档转PDF', [
      { name: '输入路径', type: 'wideString', description: '本机 .docx 或 .xlsx 文件路径。' },
      { name: '输出路径', type: 'wideString', description: '生成的 PDF 写出路径。' }
    ], 'bool', '经本机 Office/WPS 把 docx/xlsx 高保真转成 PDF：引擎自动检测链 Word → WPS（docx）/ Excel → WPS 表格（xlsx），转换在独立脚本进程执行、引擎崩溃不拖垮主程序、单文件 180 秒超时。未安装 Office/WPS 时给出明确中文提示。', { category: '转换' }),
    pdfCommand('PDF_取Office转换引擎', [], 'wideString', '返回外部转换可用引擎：Word、Excel、WPS；空文本表示本机不可用。', { category: '转换' }),

    // ---------- 诊断 ----------
    pdfCommand('PDF_取错误', [], 'wideString', '返回当前线程最近一次 PDF 模块错误的中文说明。', { category: '诊断' }),
    pdfCommand('PDF_取版本', [], 'wideString', '返回运行桥与 PDFium 内核版本信息。', { category: '诊断' }),
    pdfCommand('PDF_是否可用', [], 'bool', '检查 pdfium.dll 与 LingBuilderPdf.dll 是否可加载（lingbuilder.pdf.sdk 模块资产是否就位）。', { category: '诊断' })
  ]
});

/** PDF 模块 x64-only：运行时资产由 lingbuilder.pdf.sdk 模块提供（nativeDependencyService 物化）。 */
export const PDF_MODULE: LingBuilderModuleManifest = {
  ...pdfStandardModule,
  targets: [
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }
  ]
};
