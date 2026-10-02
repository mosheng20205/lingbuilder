import { createStandardModule } from './standardLibraryModules';
import { LingBuilderModuleManifest } from './types';

/** 二维码模块 ID：生成与识别双能力，ISO/IEC 18004 纯本地实现。 */
export const QRCODE_MODULE_ID = 'lingbuilder.qrcode';

type QrParameter = { name: string; type: string; description: string };

function qrCommand(
  name: string,
  parameters: QrParameter[],
  returnType: string,
  description: string,
  options: { returnLabel?: string; returnDescription?: string; example?: string; category?: string } = {}
) {
  const placeholders = parameters.map((parameter, index) => {
    if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
    if (parameter.type === 'bool') return '假';
    if (parameter.type === 'bytes') return `$${index + 1}`;
    return '0';
  });
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${placeholders.join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const handleArg = (description: string): QrParameter => ({ name: '码', type: '二维码句柄', description });
const recArg = (description: string): QrParameter => ({ name: '结果', type: '二维码识别结果', description });
const levelText = '纠错级别，L、M、Q 或 H（不区分大小写）。';
const argbText = 'ARGB 颜色值，高位到低位依次为 Alpha、红、绿、蓝，如 0xFF000000 为不透明黑。';

const QRCODE_BASE = createStandardModule({
  id: QRCODE_MODULE_ID,
  name: '二维码模块',
  version: '1.0.0',
  category: '图像',
  description: '纯本地实现的 QR Code 生成与识别模块（ISO/IEC 18004）：数字/字母数字/字节(UTF-8) 自动择短、版本 1-40 自动选最小、L/M/Q/H 纠错、GF(256) RS 真纠错；识别侧自带定位图形定位与透视重采样，PNG/JPEG 编解码全部内置，零第三方运行时与在线 API。生成与识别可闭环自校验（二维码_自检）。',
  tags: ['二维码', 'QR', '图像', '识别', '编码', 'ISO18004'],
  types: [
    { name: '二维码句柄', description: '二维码_生成 返回的受管二维码对象；持矩阵、版本、掩码、级别与位图缓存，必须用 二维码_释放 显式释放。', cppType: 'long long' },
    { name: '二维码识别结果', description: '二维码_识别PNG 等识别命令返回的受管结果；持文本、字节、版本、掩码、修复码字数与外接四边形，必须用 二维码_识别释放 显式释放。', cppType: 'long long' }
  ],
  docs: [{ title: '二维码模块使用说明', path: 'docs/modules/qrcode/README.md' }],
  snippets: [
    {
      label: '二维码 生成并保存 PNG',
      description: '生成二维码、保存为 PNG（前景黑底白）并释放句柄的安全骨架。',
      insertText: [
        '局部 二维码句柄 码 = 二维码_生成("$1", "M", 8, 4)',
        '如果 码 != 0',
        '    二维码_保存PNG(码, "$2", 4278190080, 4294967295)',
        '    调试输出("版本=" + 到文本(二维码_取版本号(码)) + " 模块数=" + 到文本(二维码_取模块数(码)))',
        '    二维码_释放(码)',
        '否则',
        '    调试输出(二维码_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: '二维码 识别 PNG 并取文本',
      description: '识别本地 PNG/JPEG 图片中的二维码并取回文本；失败时读 二维码_识别取错误()。',
      insertText: [
        '局部 二维码识别结果 结果 = 二维码_识别PNG("$1")',
        '如果 结果 != 0',
        '    调试输出(二维码_识别取文本(结果))',
        '    二维码_识别释放(结果)',
        '否则',
        '    调试输出(二维码_识别取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    // ---- 生成侧 ----
    qrCommand('二维码_取版本', [], 'wideString', '返回二维码模块版本与实现口径描述。', { example: '二维码_取版本()' }),
    qrCommand('二维码_生成', [
      { name: '内容', type: 'wideString', description: '要编码的文本；数字、字母数字字符自动用对应模式，其余按字节(UTF-8) 编码。' },
      { name: '纠错级别', type: 'wideString', description: levelText },
      { name: '边长像素', type: 'int', description: '每个模块的边长像素，1～64（推荐 8）。' },
      { name: '空白边模块数', type: 'int', description: '四周留白的模块数，0～32（标准推荐 4）。' }
    ], '二维码句柄', '生成二维码并返回受管句柄；内容超出 40-H 容量或输出边长超过 4096 像素时返回 0，失败原因读 二维码_取错误()。', {
      returnDescription: '成功返回非 0 的 二维码句柄，失败返回 0。',
      example: '二维码_生成("https://lingbuilder.com", "M", 8, 4)', category: '生成'
    }),
    qrCommand('二维码_取错误', [], 'wideString', '读取当前线程最近一次生成侧操作的中文错误。', { category: '生成' }),
    qrCommand('二维码_取模块数', [handleArg('二维码_生成 返回的受管句柄。')], 'int', '返回单边模块数（21～177）；句柄无效返回 0。', { example: '二维码_取模块数(码)', category: '生成' }),
    qrCommand('二维码_取版本号', [handleArg('二维码_生成 返回的受管句柄。')], 'int', '返回自动选出的 QR 版本号（1～40）；句柄无效返回 0。', { example: '二维码_取版本号(码)', category: '生成' }),
    qrCommand('二维码_取掩码', [handleArg('二维码_生成 返回的受管句柄。')], 'int', '返回掩码号（0～7，罚分最低者）；句柄无效返回 -1。', { example: '二维码_取掩码(码)', category: '生成' }),
    qrCommand('二维码_取纠错级别', [handleArg('二维码_生成 返回的受管句柄。')], 'wideString', '返回该码的纠错级别 L/M/Q/H；句柄无效返回空文本。', { example: '二维码_取纠错级别(码)', category: '生成' }),
    qrCommand('二维码_取深色', [
      handleArg('二维码_生成 返回的受管句柄。'),
      { name: '行', type: 'int', description: '模块行号，从 0 起。' },
      { name: '列', type: 'int', description: '模块列号，从 0 起。' }
    ], 'bool', '读取原始矩阵中指定模块是否为深色；越界或句柄无效返回假。', { example: '二维码_取深色(码, 0, 0)', category: '生成' }),
    qrCommand('二维码_保存PNG', [
      handleArg('二维码_生成 返回的受管句柄。'),
      { name: '路径', type: 'wideString', description: '输出 PNG 路径，支持中文；父目录必须已存在。' },
      { name: '前景色', type: 'longLong', description: argbText },
      { name: '背景色', type: 'longLong', description: argbText }
    ], 'bool', '把二维码渲染为 PNG（GDI+ 可直接打开；灰度 8bit 或 RGB 8bit，deflate 内置）。中文路径安全。', {
      example: '二维码_保存PNG(码, "输出/二维码.png", 4278190080, 4294967295)', category: '生成'
    }),
    qrCommand('二维码_取位图', [
      handleArg('二维码_生成 返回的受管句柄。'),
      { name: '前景色', type: 'longLong', description: argbText },
      { name: '背景色', type: 'longLong', description: argbText }
    ], 'longLong', '渲染为 32 位 HBITMAP（可直接 SendMessage STM_SETIMAGE 到静态控件）；同句柄同色重复调用返回缓存，位图随 二维码_释放 一起销毁。', {
      returnLabel: '长整数型',
      returnDescription: '成功返回 HBITMAP 句柄，失败返回 0。',
      example: '二维码_取位图(码, 4278190080, 4294967295)', category: '生成'
    }),
    qrCommand('二维码_自检', [], 'bool', '闭环自检：format 已知答案、M 级 v1-20 数据码字表核对、全部 160 组（版本×级别）RS 伴随式、多组「生成→渲染→识别」逐字节闭环与带损伤纠错。返回假时读 二维码_取错误()。', {
      example: '二维码_自检()', category: '生成'
    }),
    qrCommand('二维码_释放', [handleArg('要释放的受管句柄。')], 'bool', '释放一个二维码句柄及其位图缓存；句柄无效返回假。', { example: '二维码_释放(码)', category: '生成' }),
    qrCommand('二维码_释放全部', [], 'void', '释放当前进程内全部二维码句柄。', { category: '生成' }),
    // ---- 识别侧 ----
    qrCommand('二维码_识别PNG', [
      { name: '路径', type: 'wideString', description: 'PNG 或 JPEG（基线）图片路径，支持中文；自动按文件头识别格式。' }
    ], '二维码识别结果', '识别图片中的二维码；找不到定位图形或纠错失败返回 0，原因读 二维码_识别取错误()。', {
      returnDescription: '成功返回非 0 的 二维码识别结果，失败返回 0。',
      example: '二维码_识别PNG("截图.png")', category: '识别'
    }),
    qrCommand('二维码_识别位图', [
      { name: '位图句柄', type: 'longLong', description: 'HBITMAP 句柄（如 二维码_取位图 或屏幕截图模块的产物）。' }
    ], '二维码识别结果', '识别 Windows 位图中的二维码。', {
      example: '二维码_识别位图(位图)', category: '识别'
    }),
    qrCommand('二维码_识别字节集', [
      { name: '数据', type: 'bytes', description: '像素字节集：1 通道为灰度，3/4 通道按 BGR/BGRX（与 DIB 一致）。' },
      { name: '宽度', type: 'int', description: '图像宽度像素。' },
      { name: '高度', type: 'int', description: '图像高度像素。' },
      { name: '通道数', type: 'int', description: '1、3 或 4。' }
    ], '二维码识别结果', '免落盘直解：把像素字节集当图像识别，长度必须等于 宽×高×通道数。', {
      example: '二维码_识别字节集(灰度, 宽, 高, 1)', category: '识别'
    }),
    qrCommand('二维码_识别屏幕', [
      { name: '横', type: 'int', description: '截图区域左上角横坐标（屏幕坐标）。' },
      { name: '纵', type: 'int', description: '截图区域左上角纵坐标。' },
      { name: '宽', type: 'int', description: '区域宽度像素。' },
      { name: '高', type: 'int', description: '区域高度像素。' }
    ], '二维码识别结果', '抓取屏幕指定区域并识别其中的二维码；坐标按当前进程 DPI 意识解释。', {
      example: '二维码_识别屏幕(0, 0, 800, 600)', category: '识别'
    }),
    qrCommand('二维码_识别取文本', [recArg('识别命令返回的受管结果。')], 'wideString', '返回解码文本（字节模式按 UTF-8、汉字模式转 Unicode）；失败返回空文本。', { example: '二维码_识别取文本(结果)', category: '识别' }),
    qrCommand('二维码_识别取字节', [recArg('识别命令返回的受管结果。')], 'bytes', '返回负载原始字节（字节模式原样、数字/字母数字为 ASCII、汉字模式为 Shift_JIS 编码）。', { example: '二维码_识别取字节(结果)', category: '识别' }),
    qrCommand('二维码_识别取版本', [recArg('识别命令返回的受管结果。')], 'int', '返回识别出的 QR 版本号（1～40）。', { example: '二维码_识别取版本(结果)', category: '识别' }),
    qrCommand('二维码_识别取掩码', [recArg('识别命令返回的受管结果。')], 'int', '返回 format 区恢复出的掩码号（0～7）。', { example: '二维码_识别取掩码(结果)', category: '识别' }),
    qrCommand('二维码_识别取纠错级别', [recArg('识别命令返回的受管结果。')], 'wideString', '返回纠错级别 L/M/Q/H。', { example: '二维码_识别取纠错级别(结果)', category: '识别' }),
    qrCommand('二维码_识别取模式', [recArg('识别命令返回的受管结果。')], 'wideString', '返回首个数据段的编码模式：数字、字母数字、字节或汉字。', { example: '二维码_识别取模式(结果)', category: '识别' }),
    qrCommand('二维码_识别取修复码字数', [recArg('识别命令返回的受管结果。')], 'int', '返回 RS 纠错实际修正的错误码字总数（0 表示无损伤）；如实上报，不做美化。', { example: '二维码_识别取修复码字数(结果)', category: '识别' }),
    qrCommand('二维码_识别取定位点数', [recArg('识别命令返回的受管结果。')], 'int', '返回图像中找到并通过交叉校验的定位图形个数（通常为 3）。', { example: '二维码_识别取定位点数(结果)', category: '识别' }),
    qrCommand('二维码_识别取角点横坐标', [
      recArg('识别命令返回的受管结果。'),
      { name: '索引', type: 'int', description: '解码候选序号，当前为 0。' },
      { name: '角点', type: 'int', description: '0 左上、1 右上、2 右下、3 左下。' }
    ], 'int', '返回符号外接四边形某角点的横坐标（像素）；越界返回 -1。供调用方画框标注。', { example: '二维码_识别取角点横坐标(结果, 0, 0)', category: '识别' }),
    qrCommand('二维码_识别取角点纵坐标', [
      recArg('识别命令返回的受管结果。'),
      { name: '索引', type: 'int', description: '解码候选序号，当前为 0。' },
      { name: '角点', type: 'int', description: '0 左上、1 右上、2 右下、3 左下。' }
    ], 'int', '返回符号外接四边形某角点的纵坐标（像素）；越界返回 -1。', { example: '二维码_识别取角点纵坐标(结果, 0, 0)', category: '识别' }),
    qrCommand('二维码_识别取外接四边形', [
      recArg('识别命令返回的受管结果。'),
      { name: '索引', type: 'int', description: '解码候选序号，当前为 0。' }
    ], 'bytes', '一次性取回外接四边形：32 字节小端，4 角点依 左上/右上/右下/左下，每角点 2 个 int32（先 x 后 y）。', { example: '二维码_识别取外接四边形(结果, 0)', category: '识别' }),
    qrCommand('二维码_识别取错误', [], 'wideString', '读取当前线程最近一次识别侧操作的中文错误。', { category: '识别' }),
    qrCommand('二维码_识别释放', [recArg('要释放的受管结果。')], 'bool', '释放一个识别结果句柄；句柄无效返回假。', { example: '二维码_识别释放(结果)', category: '识别' }),
    qrCommand('二维码_识别释放全部', [], 'void', '释放当前进程内全部识别结果句柄。', { category: '识别' })
  ]
});

/** 内置注册清单：在标准工厂之上追加 contributes.examples（uiExamples 数据源）。 */
export const QRCODE_MODULE: LingBuilderModuleManifest = {
  ...QRCODE_BASE,
  contributes: {
    ...QRCODE_BASE.contributes,
    examples: [
      {
        title: '生成二维码并保存 PNG',
        path: 'docs/modules/qrcode/examples/生成二维码并保存PNG.lcpp'
      },
      {
        title: '识别图片中的二维码',
        path: 'docs/modules/qrcode/examples/识别图片中的二维码.lcpp'
      }
    ]
  }
};
