import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { LingBuilderModuleManifest, ModuleCommandBindingParameter, ModuleCommandValueType } from './types';

type BarcodeParameter = ModuleCommandBindingParameter & { type: ModuleCommandValueType; description: string };
type BarcodeCommandOptions = Pick<StandardCommandSpec, 'category' | 'example' | 'returnDescription' | 'visibility'>;

function barcodeCommand(
  name: string,
  parameters: BarcodeParameter[],
  returnType: ModuleCommandValueType,
  description: string,
  options: BarcodeCommandOptions = {}
): StandardCommandSpec {
  const snippetArg = (parameter: BarcodeParameter, index: number): string => {
    if (parameter.type === 'controlRef' || parameter.type === 'handler') {
      return index === 0 ? '条码1' : '0';
    }
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

const barcodeArg = (description = '条码_生成* 命令返回的受管条码句柄。'): BarcodeParameter => ({
  name: '条码', type: '条码句柄', description
});
const resultArg = (description = '条码_识别* 命令返回的受管识别结果。'): BarcodeParameter => ({
  name: '结果', type: '条码识别结果', description
});

export const BARCODE_MODULE_ID = 'lingbuilder.barcode';

const barcodeStandardModule = createStandardModule({
  id: BARCODE_MODULE_ID,
  name: '条码模块',
  version: '1.0.0',
  category: '图像',
  description: '纯本地一维条码生成与识别：EAN-13/EAN-8/UPC-A/Code128/Code39。生成输出位图与 BMP 文件；识别支持像素字节集、HBITMAP、屏幕区域与 BMP 文件四入口，横向+纵向扫描覆盖 90° 旋转，校验位不符明确报错不静默通过。',
  tags: ['图像', '条码', '一维码', 'EAN', 'Code128', 'Code39', '识别'],
  types: [
    { name: '条码句柄', description: '条码_生成* 返回的受管条码对象；必须用 条码_释放 显式释放。', cppType: 'long long' },
    { name: '条码识别结果', description: '条码_识别* 返回的受管结果；必须用 条码_识别释放 显式释放。', cppType: 'long long' }
  ],
  docs: [{ title: '条码模块 1.0 使用说明', path: 'docs/modules/barcode/README.md' }],
  snippets: [
    {
      label: '生成 EAN-13 并保存 BMP',
      description: '生成商品条码并保存为 BMP 图片的骨架；输入可带或不带校验位（自动补全/校验）。',
      insertText: [
        '局部 条码句柄 条码 = 条码_生成EAN13("$1")',
        '如果 条码 != 0',
        '    条码_保存BMP(条码, "条码.bmp", 3)',
        '    条码_释放(条码)',
        '否则',
        '    调试输出(条码_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: '识别屏幕区域条码',
      description: '抓取屏幕指定区域并识别其中一维条码；横纵双向扫描，自动判定码制。',
      insertText: [
        '局部 条码识别结果 结果 = 条码_识别屏幕(0, 0, 800, 600)',
        '如果 结果 != 0',
        '    调试输出(条码_识别取码制(结果) + "：" + 条码_识别取文本(结果))',
        '    条码_识别释放(结果)',
        '否则',
        '    调试输出(条码_识别取错误())',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    // ---------- 生成 ----------
    barcodeCommand('条码_生成EAN13', [
      { name: '内容', type: 'wideString', description: '12 位数字（自动补校验位）或 13 位含校验位（校验不符会拒绝）。' }
    ], '条码句柄', '生成 EAN-13 商品条码。', { category: '生成', example: '局部 条码句柄 条码 = 条码_生成EAN13("590123412345")' }),
    barcodeCommand('条码_生成EAN8', [
      { name: '内容', type: 'wideString', description: '7 位数字（自动补校验位）或 8 位含校验位。' }
    ], '条码句柄', '生成 EAN-8 短版商品条码。', { category: '生成' }),
    barcodeCommand('条码_生成UPCA', [
      { name: '内容', type: 'wideString', description: '11 位数字（自动补校验位）或 12 位含校验位。' }
    ], '条码句柄', '生成 UPC-A 条码（北美商品码，EAN-13 前置 0 同构）。', { category: '生成' }),
    barcodeCommand('条码_生成Code128', [
      { name: '内容', type: 'wideString', description: 'ASCII 可见字符（32~126）；纯数字自动选 C 子集更紧凑。' }
    ], '条码句柄', '生成 Code128 条码（A/B/C 子集自动择优，含模 103 校验）。', { category: '生成' }),
    barcodeCommand('条码_生成Code39', [
      { name: '内容', type: 'wideString', description: '0-9、A-Z、空格与 - . $ / + %（小写自动转大写）。' }
    ], '条码句柄', '生成 Code39 条码（星号为起始/终止保留符，内容中不允许）。', { category: '生成' }),
    barcodeCommand('条码_取模块数', [barcodeArg()], 'int', '返回条码总模块数（含静区）。'),
    barcodeCommand('条码_取内容', [barcodeArg()], 'wideString', '返回条码完整内容（EAN/UPC 含补全后的校验位）。'),
    barcodeCommand('条码_取位图', [
      barcodeArg(),
      { name: '每模块像素', type: 'int', description: '1～20；建议 3。条高自动取宽度的 1/3（至少 24 像素）。' }
    ], 'longLong', '渲染条码为黑白 HBITMAP（长整数句柄），可直接交给图片框显示或位图类命令处理。', {
      category: '生成', returnDescription: 'HBITMAP 句柄；用后调用系统的 DeleteObject 或图像模块释放。'
    }),
    barcodeCommand('条码_保存BMP', [
      barcodeArg(),
      { name: '路径', type: 'wideString', description: '输出 .bmp 文件路径（24 位未压缩，支持中文路径）。' },
      { name: '每模块像素', type: 'int', description: '1～20；建议 3。' }
    ], 'bool', '把条码保存为 BMP 图片文件。', { category: '生成' }),
    barcodeCommand('条码_释放', [barcodeArg()], 'bool', '释放一个受管条码句柄。'),
    barcodeCommand('条码_释放全部', [], 'void', '释放当前进程内全部条码句柄。'),

    // ---------- 识别 ----------
    barcodeCommand('条码_识别像素', [
      { name: '数据', type: 'bytes', description: '像素字节集：1 通道灰度，3 通道 BGR，4 通道 BGRX。' },
      { name: '宽度', type: 'int', description: '图像宽度像素。' },
      { name: '高度', type: 'int', description: '图像高度像素。' },
      { name: '通道数', type: 'int', description: '1、3 或 4。' }
    ], '条码识别结果', '识别像素字节集中的一维条码（免落盘直解，截图/投屏帧直传）。', { category: '识别' }),
    barcodeCommand('条码_识别位图', [
      { name: '位图句柄', type: 'longLong', description: 'HBITMAP 句柄（如 条码_取位图 的产物或截图模块的位图）。' }
    ], '条码识别结果', '识别 Windows 位图中的一维条码。', { category: '识别' }),
    barcodeCommand('条码_识别屏幕', [
      { name: '横', type: 'int', description: '区域左上角横坐标（屏幕坐标）。' },
      { name: '纵', type: 'int', description: '区域左上角纵坐标。' },
      { name: '宽', type: 'int', description: '区域宽度（1~10000 像素）。' },
      { name: '高', type: 'int', description: '区域高度（1~10000 像素）。' }
    ], '条码识别结果', '抓取屏幕区域并识别其中的一维条码。', { category: '识别' }),
    barcodeCommand('条码_识别BMP', [
      { name: '路径', type: 'wideString', description: '24/32 位未压缩 BMP 文件路径。' }
    ], '条码识别结果', '识别 BMP 文件中的一维条码（PNG 请先经图像模块转 BMP/像素）。', { category: '识别' }),
    barcodeCommand('条码_识别取文本', [resultArg()], 'wideString', '返回解码文本（EAN/UPC 含校验位；UPC-A 为 12 位形态）。'),
    barcodeCommand('条码_识别取码制', [resultArg()], 'wideString', '返回识别出的码制：EAN-13、EAN-8、UPC-A、Code128 或 Code39。'),
    barcodeCommand('条码_识别取校验通过', [resultArg()], 'bool', '返回校验位是否通过（识别成功即通过；提供显式查询便于展示）。'),
    barcodeCommand('条码_识别释放', [resultArg()], 'bool', '释放一个受管识别结果句柄。'),
    barcodeCommand('条码_识别释放全部', [], 'void', '释放当前进程内全部识别结果句柄。'),

    // ---------- 诊断 ----------
    barcodeCommand('条码_自检', [], 'bool', '闭环自检：五码制生成→渲染→识别逐字节比对 + 校验位异常样本拒绝。返回假时读 条码_取错误。', { category: '诊断' }),
    barcodeCommand('条码_取错误', [], 'wideString', '返回当前线程最近一次生成侧错误的中文说明。', { category: '诊断' }),
    barcodeCommand('条码_识别取错误', [], 'wideString', '返回当前线程最近一次识别侧错误的中文说明。', { category: '诊断' }),
    barcodeCommand('条码_取版本', [], 'wideString', '返回模块版本与支持的码制信息。', { category: '诊断' }),
    barcodeCommand('条码_是否可用', [], 'bool', '纯本地实现，恒返回真。', { category: '诊断', visibility: 'advanced' })
  ]
});

export const BARCODE_MODULE: LingBuilderModuleManifest = {
  ...barcodeStandardModule,
  targets: [
    { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc' },
    { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }
  ]
};
