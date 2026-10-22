import { createStandardModule } from './standardLibraryModuleFactory';
import { LingBuilderModuleManifest } from './types';

/** 微信OCR识别模块 ID：借用本机微信 4.x OCR 组件的离线识别能力。 */
export const OCR_MODULE_ID = 'lingbuilder.ocr';

type OcrParameter = { name: string; type: string; description: string };

function ocrCommand(
  name: string,
  parameters: OcrParameter[],
  returnType: string,
  description: string,
  options: { returnLabel?: string; returnDescription?: string; example?: string; category?: string } = {}
) {
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${parameters.map((parameter, index) => {
      if (parameter.type === 'wideString' || parameter.type === 'utf8String') return `"$${index + 1}"`;
      if (parameter.type === 'bool') return '真';
      return `$${index + 1}`;
    }).join(', ')})`,
    parameters,
    returnType,
    ...options
  };
}

const resultArg = (description: string): OcrParameter => ({ name: '结果', type: 'OCR结果句柄', description });
const indexArg = (description: string): OcrParameter => ({ name: '索引', type: 'int', description });
const pathText = '本地图片绝对或相对路径，支持中文；PNG/JPG/BMP 等微信可解码格式。';

const OCR_BASE = createStandardModule({
  id: OCR_MODULE_ID,
  name: '微信OCR识别模块',
  version: '1.0.0',
  category: '图像',
  description: '借用本机微信 4.x 自带 OCR 组件的离线文字识别：首次识别自动探测微信安装并拉起其 OCR 组件进程（Weixin.exe --type=wxocr），返回行级文本、坐标与置信度，JSON 另含字符级坐标。不随包分发任何腾讯文件，需要用户已安装 Windows 版微信并完成过一次截图文字识别（触发组件下载）；仅支持 64 位构建（x64），32 位下命令返回中文错误。',
  tags: ['OCR', '文字识别', '图像', '微信', '离线'],
  types: [
    { name: 'OCR结果句柄', description: 'OCR_识别 返回的受管识别结果；持原图尺寸与全部识别行（文本、坐标、置信度、字符级框），必须用 OCR结果_释放 显式释放。', cppType: 'long long' }
  ],
  docs: [{ title: '微信OCR识别模块使用说明', path: 'docs/modules/wechat-ocr/README.md' }],
  snippets: [
    {
      label: '微信OCR 识别图片取全部文本',
      description: '探测并借用本机微信 OCR 组件识别一张图片，输出全部识别文本的安全骨架。',
      insertText: [
        '局部 OCR结果句柄 结果 = OCR_识别("$1")',
        '如果 结果 != 0',
        '    调试输出(OCR结果_取全部文本(结果, 真))',
        '    调试输出("行数=" + 到文本(OCR结果_取行数(结果)))',
        '    OCR结果_释放(结果)',
        '否则',
        '    调试输出(OCR_取错误())',
        '结束'
      ].join('\n')
    },
    {
      label: '微信OCR 逐行取文本与坐标',
      description: '逐行读取识别文本、置信度与坐标（左/上/右/下，像素）。',
      insertText: [
        '局部 OCR结果句柄 结果 = OCR_识别("$1")',
        '如果 结果 != 0',
        '    计次循环 首尾 = 1 到 OCR结果_取行数(结果)',
        '        调试输出(OCR结果_取文本(结果, 首尾 - 1) + " @ " + 到文本(OCR结果_取左坐标(结果, 首尾 - 1)))',
        '    循环尾',
        '    OCR结果_释放(结果)',
        '结束'
      ].join('\n')
    }
  ],
  commands: [
    ocrCommand('OCR_取版本', [], 'wideString', '返回模块版本与实现口径（借用本机微信 4.x OCR 组件，仅 64 位）。', { example: 'OCR_取版本()' }),
    ocrCommand('OCR_取微信状态', [], 'wideString', '探测本机微信与 OCR 组件（不启动进程），返回 JSON：found、versionDir、pluginVersion、wxocrDll 或 error。微信未下载 OCR 组件时错误里带触发下载的操作指引。', {
      returnDescription: 'JSON 文本，始终可解析。',
      example: 'OCR_取微信状态()'
    }),
    ocrCommand('OCR_取错误', [], 'wideString', '读取当前线程最近一次 OCR 操作的中文错误。', {}),
    ocrCommand('OCR_停止', [], 'bool', '停止 OCR 组件进程并复位会话；下次识别自动重新探测启动。组件长时间不用或识别失败后可用。', {
      example: 'OCR_停止()'
    }),
    ocrCommand('OCR_识别', [
      { name: '图片路径', type: 'wideString', description: pathText }
    ], 'OCR结果句柄', '识别图片中的全部文字并返回受管结果句柄；首次调用自动探测微信并启动其 OCR 组件（握手 15 秒、单图识别 120 秒超时）。失败返回 0，原因读 OCR_取错误()。', {
      returnDescription: '成功返回非 0 的 OCR结果句柄，失败返回 0。',
      example: 'OCR_识别("截图.png")'
    }),
    ocrCommand('OCR_识别字节集', [
      { name: '图片数据', type: 'bytes', description: '图片文件内容字节集（PNG/JPG/BMP 等），内存入口无需先落盘；组件直传不可用时内部经临时文件识别并即时删除。' }
    ], 'OCR结果句柄', '识别字节集图片中的全部文字并返回受管结果句柄；前置与超时同 OCR_识别，结果读取/释放命令共用。失败返回 0，原因读 OCR_取错误()。', {
      returnDescription: '成功返回非 0 的 OCR结果句柄，失败返回 0。',
      example: 'OCR_识别字节集(图片字节)'
    }),
    ocrCommand('OCR结果_取行数', [resultArg('OCR_识别 返回的受管结果。')], 'int', '返回识别行数；句柄无效返回 0。', { example: 'OCR结果_取行数(结果)' }),
    ocrCommand('OCR结果_取文本', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'wideString', '返回指定行的识别文本；越界返回空文本。', { example: 'OCR结果_取文本(结果, 0)' }),
    ocrCommand('OCR结果_取全部文本', [
      resultArg('OCR_识别 返回的受管结果。'),
      { name: '换行分隔', type: 'bool', description: '真=行间用回车换行分隔，假=用空格分隔。' }
    ], 'wideString', '一次性取回全部识别文本；句柄无效返回空文本。', { example: 'OCR结果_取全部文本(结果, 真)' }),
    ocrCommand('OCR结果_取置信度', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'double', '返回指定行识别置信度（0～1）；越界返回 0。', { example: 'OCR结果_取置信度(结果, 0)' }),
    ocrCommand('OCR结果_取左坐标', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'int', '返回指定行包围盒左边界横坐标（像素）；越界返回 -1。', { example: 'OCR结果_取左坐标(结果, 0)' }),
    ocrCommand('OCR结果_取上坐标', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'int', '返回指定行包围盒上边界纵坐标（像素）；越界返回 -1。', { example: 'OCR结果_取上坐标(结果, 0)' }),
    ocrCommand('OCR结果_取右坐标', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'int', '返回指定行包围盒右边界横坐标（像素）；越界返回 -1。', { example: 'OCR结果_取右坐标(结果, 0)' }),
    ocrCommand('OCR结果_取下坐标', [resultArg('OCR_识别 返回的受管结果。'), indexArg('行索引，从 0 起。')], 'int', '返回指定行包围盒下边界纵坐标（像素）；越界返回 -1。', { example: 'OCR结果_取下坐标(结果, 0)' }),
    ocrCommand('OCR结果_取宽度', [resultArg('OCR_识别 返回的受管结果。')], 'int', '返回原图宽度像素；句柄无效返回 0。', { example: 'OCR结果_取宽度(结果)' }),
    ocrCommand('OCR结果_取高度', [resultArg('OCR_识别 返回的受管结果。')], 'int', '返回原图高度像素；句柄无效返回 0。', { example: 'OCR结果_取高度(结果)' }),
    ocrCommand('OCR结果_取JSON', [resultArg('OCR_识别 返回的受管结果。')], 'wideString', '返回完整识别结果 JSON：errcode、width、height、lines[]（text、rate、left/top/right/bottom、chars[] 字符级坐标）。', { example: 'OCR结果_取JSON(结果)' }),
    ocrCommand('OCR结果_释放', [resultArg('要释放的受管结果。')], 'bool', '释放一个识别结果句柄；句柄无效返回假。', { example: 'OCR结果_释放(结果)' }),
    ocrCommand('OCR结果_释放全部', [], 'void', '释放当前进程内全部识别结果句柄。', {})
  ]
});

/** 内置注册清单：在标准工厂之上追加 contributes.examples（uiExamples 数据源）。 */
export const OCR_MODULE: LingBuilderModuleManifest = {
  ...OCR_BASE,
  contributes: {
    ...OCR_BASE.contributes,
    examples: [
      {
        title: '微信OCR识别图片并逐行输出',
        path: 'docs/modules/wechat-ocr/examples/微信OCR识别图片并逐行输出.lcpp'
      }
    ]
  }
};
