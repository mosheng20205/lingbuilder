import type { LingBuilderModuleManifest } from './types';
import { JSON_MODULE } from './jsonModule';
import { createStandardModule } from './standardLibraryModuleFactory';

export { createStandardModule } from './standardLibraryModuleFactory';
export type { StandardCommandSpec, StandardModuleSpec } from './standardLibraryModuleFactory';

// 以下说明按 src/services/windowDesigner/standardLibraryRuntime.ts 的实际边界行为核实，
// 重复语义（源文本、子文本、替换文本、十六进制字节、编码名称、缓冲区句柄）提取为共享常量。
const srcText = '要处理的源文本，字符位置一律从 0 开始计数。';
const srcTextRanged = '要处理的源文本，按 UTF-16 字符计数，位置与长度均从 0 起算。';
const searchTarget = '要查找的子文本，区分大小写。';
const replaceText = '替换后写入的文本；空文本表示删除匹配内容。';
const hexBytes = '十六进制字节文本，长度必须为偶数且每个字符只允许 0-9、a-f、A-F；格式非法按命令说明返回失败值。';
const encodingName = '编码名称，忽略大小写以及空格、连字符和下划线；支持 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE、ANSI、GBK、GB2312、GB18030。';
const bytesArg = '要操作的字节集；位置与长度均按字节计，索引从 0 起。';
const bufferHandle = '缓冲区_创建、缓冲区_从字节集 或 缓冲区_从文件 返回的缓冲区句柄；句柄无效时命令按说明返回失败值。';
const bufferLength = '要读取的字节数；小于 0 表示读取到缓冲区末尾，超出剩余时只取剩余部分，读取后游标前进。';
const bufferWidth = '整数的字节宽度，只允许 1、2、4、8；其它值不写入也不读取。';
const bufferEndian = '传真表示高位字节在前（大端），传假表示低位字节在前（小端）。';
const bytesSearchTarget = '要查找的目标字节集；为空时按命令说明返回 -1 或原样处理。';
const bytesStartIndex = '开始查找的字节索引，从 0 起；为负或剩余长度不足时返回 -1。';
const hexDecodeArg = `${hexBytes}；解码或转码失败时返回空文本。`;
const hexEncodeTextArg = '要编码的源文本；出现未配对的 UTF-16 代理时返回空文本。';
const arrayArg = '要操作的目标数组变量，元素类型不限；位置参数一律按成员索引从 0 计数。';
const arrayIndexArg = '成员索引，从 0 起；越界时命令按说明安全返回而不崩溃。';
const arrayValueArg = '要写入或比较的成员值，类型必须与数组元素类型一致。';
const bytesPositionArg = '按字节计的位置索引，从 0 起。';
const xmlNameArg = 'XML 元素名，首字符只能是字母、下划线或冒号，其余可含字母数字、下划线、冒号、点和短横；非法时命令返回空文本或假。';
const xmlSourceArg = '要搜索的 XML 文本，按 <节点名> 开始标签做字符串匹配，不做完整 XML 解析。';
const regexTextArg = '要匹配或替换的源文本，位置按 UTF-16 字符从 0 计。';
const regexPatternArg = 'ECMAScript 语法的宽字符正则表达式；表达式非法时命令按说明返回失败值，不抛异常。';
const regexSeparatorArg = '拼接各匹配结果之间插入的文本，允许空文本；分隔符本身不参与匹配。';

const textModule = createStandardModule({
  id: 'lingbuilder.std.text',
  name: '文本处理模块',
  category: '其他',
  description: '提供 Unicode 文本查找、截取、替换、修剪和大小写转换能力。索引统一从 0 开始。',
  tags: ['文本', 'Unicode'],
  commands: [
    { name: '文本_取长度', signature: '文本_取长度(文本)', description: '返回 Unicode 文本的字符数量。', insertText: '文本_取长度("$1")', parameters: [{ name: '文本', type: 'wideString', description: srcText}], returnType: 'int', example: '文本_取长度("LingBuilder")' },
    { name: '文本_寻找', signature: '文本_寻找(文本, 目标)', description: '返回目标文本首次出现的从 0 开始索引，未找到返回 -1。', insertText: '文本_寻找("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcText}, { name: '目标', type: 'wideString', description: `${searchTarget}空文本时返回 0。`}], returnType: 'int', example: '文本_寻找("中文编程", "编程")' },
    { name: '文本_是否包含', signature: '文本_是否包含(文本, 目标)', description: '判断文本是否包含目标内容。', insertText: '文本_是否包含("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcText}, { name: '目标', type: 'wideString', description: `${searchTarget}空文本时恒判为包含。`}], returnType: 'bool' },
    { name: '文本_开头为', signature: '文本_开头为(文本, 前缀)', description: '判断文本是否以指定前缀开头。', insertText: '文本_开头为("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcText}, { name: '前缀', type: 'wideString', description: '要比较的开头内容，区分大小写；空文本时恒判为真。'}], returnType: 'bool' },
    { name: '文本_结尾为', signature: '文本_结尾为(文本, 后缀)', description: '判断文本是否以指定后缀结尾。', insertText: '文本_结尾为("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcText}, { name: '后缀', type: 'wideString', description: '要比较的结尾内容，区分大小写；空文本时恒判为真。'}], returnType: 'bool' },
    { name: '文本_取中间', signature: '文本_取中间(文本, 起始位置, 长度)', description: '按从 0 开始的索引截取文本，超出范围时安全截断。', insertText: '文本_取中间("$1", 0, 1)', parameters: [{ name: '文本', type: 'wideString', description: srcTextRanged}, { name: '起始位置', type: 'int', description: '截取起始索引，从 0 起；为负或已到达文本末尾时返回空文本。'}, { name: '长度', type: 'int', description: '要截取的字符数；小于等于 0 返回空文本，越过末尾时只取到末尾。'}], returnType: 'wideString' },
    { name: '文本_替换', signature: '文本_替换(文本, 查找内容, 替换内容)', description: '替换文本中的全部匹配内容。', insertText: '文本_替换("$1", "$2", "$3")', parameters: [{ name: '文本', type: 'wideString', description: srcText}, { name: '查找内容', type: 'wideString', description: '要被替换掉的子文本，区分大小写；空文本时不替换，原样返回。'}, { name: '替换内容', type: 'wideString', description: replaceText}], returnType: 'wideString' },
    { name: '文本_删首尾空白', signature: '文本_删首尾空白(文本)', description: '删除文本首尾的 Unicode 空白字符。', insertText: '文本_删首尾空白("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要修剪的源文本；空白判定采用 C 运行库 iswspace，含空格、制表符和换行。'}], returnType: 'wideString' },
    { name: '文本_转大写', signature: '文本_转大写(文本)', description: '把文本转换为大写。', insertText: '文本_转大写("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转换的源文本；仅对有大写形式的字符生效，其余字符原样保留。'}], returnType: 'wideString' },
    { name: '文本_转小写', signature: '文本_转小写(文本)', description: '把文本转换为小写。', insertText: '文本_转小写("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转换的源文本；仅对有小写形式的字符生效，其余字符原样保留。'}], returnType: 'wideString' }
,
    { name: '文本_分割', signature: '文本_分割(文本, 分隔符, 结果数组)', description: '把文本按分隔符拆分写入文本数组，返回分段数量；分隔符为空时整段作为一条返回。', insertText: '文本_分割($1, "$2", $3)', parameters: [{ name: '文本', type: 'wideString', description: srcTextRanged},{ name: '分隔符', type: 'wideString', description: '分段依据，按完整子文本匹配；连续分隔符会产生空分段，空分隔符时整段作为唯一分段返回。'},{ name: '结果数组', type: 'array', description: '接收分段结果的文本型数组变量，调用前会先清空原有内容。'}], returnType: 'int' },
    { name: '文本_倒找', signature: '文本_倒找(文本, 目标)', description: '从末尾向开头查找目标文本首次出现的位置（从 0 起）；未找到返回 -1。', insertText: '文本_倒找("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcTextRanged},{ name: '目标', type: 'wideString', description: '要查找的子文本，区分大小写；空文本时返回文本末尾位置。'}], returnType: 'int' },
    { name: '文本_替换子文本', signature: '文本_替换子文本(文本, 查找内容, 替换内容, 起始位置, 次数)', description: '从起始位置（从 0 起）开始替换查找内容；次数小于等于 0 表示全部替换；起始位置越界或查找内容为空时原样返回。', insertText: '文本_替换子文本("$1", "$2", "$3", 0, 0)', parameters: [{ name: '文本', type: 'wideString', description: srcTextRanged},{ name: '查找内容', type: 'wideString', description: '要被替换掉的子文本，区分大小写；空文本时原样返回。'},{ name: '替换内容', type: 'wideString', description: replaceText},{ name: '起始位置', type: 'int', description: '开始替换的字符索引，从 0 起；为负或不小于文本长度时原样返回。'},{ name: '次数', type: 'int', description: '最多替换的匹配个数；小于等于 0 表示从起始位置起全部替换。'}], returnType: 'wideString' },
    { name: '文本_删全部空白', signature: '文本_删全部空白(文本)', description: '删除文本中全部空白字符（含首尾与中间）。', insertText: '文本_删全部空白("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要去空白的源文本；首尾与中间符合 iswspace 判定的空白字符全部删除。'}], returnType: 'wideString' },
    { name: '文本_到全角', signature: '文本_到全角(文本)', description: '把半角空格与 ASCII 可见字符转换为对应全角字符。', insertText: '文本_到全角("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转换的源文本；仅空格和感叹号到波浪号区间的 ASCII 可见字符有全角形式，其余字符不变。'}], returnType: 'wideString' },
    { name: '文本_到半角', signature: '文本_到半角(文本)', description: '把全角空格与全角 ASCII 字符转换为对应半角字符。', insertText: '文本_到半角("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转换的源文本；仅全角空格和 U+FF01 到 U+FF5E 区间的字符会转回半角，其余字符不变。'}], returnType: 'wideString' },
    { name: '文本_重复', signature: '文本_重复(文本, 次数)', description: '把文本重复拼接指定次数；次数小于等于 0 或总长超过 16777216 字符时返回空文本。', insertText: '文本_重复("$1", 3)', parameters: [{ name: '文本', type: 'wideString', description: '要重复拼接的源文本；空文本直接返回空文本。'},{ name: '次数', type: 'int', description: '重复次数；小于等于 0，或重复后总字符数超过 16777216 时返回空文本。'}], returnType: 'wideString' },
    { name: '文本_插入', signature: '文本_插入(文本, 位置, 插入内容)', description: '在指定位置（从 0 起）插入内容；位置为负或超过长度时原样返回。', insertText: '文本_插入("$1", 0, "$2")', parameters: [{ name: '文本', type: 'wideString', description: srcTextRanged},{ name: '位置', type: 'int', description: '插入点字符索引，从 0 起，等于文本长度时追加到末尾；为负或更大时原样返回。'},{ name: '插入内容', type: 'wideString', description: '要插入的文本；空文本时结果与源文本相同。'}], returnType: 'wideString' }  ]
});

const bytesModule = createStandardModule({
  id: 'lingbuilder.std.bytes',
  name: '字节与十六进制模块',
  category: '其他',
  description: '通过安全文本接口提供 UTF-8 字节长度与十六进制编解码，不暴露裸内存指针。',
  tags: ['字节', '十六进制'],
  commands: [
    { name: '字节_UTF8长度', signature: '字节_UTF8长度(文本)', description: '返回文本编码为 UTF-8 后的字节数。', insertText: '字节_UTF8长度("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要统计的文本；返回其 UTF-8 编码后的字节数，编码失败返回 0。'}], returnType: 'int', example: '字节_UTF8长度("中文")' },
    { name: '字节_文本转十六进制', signature: '字节_文本转十六进制(文本)', description: '把文本的 UTF-8 字节转换为大写十六进制文本。', insertText: '字节_文本转十六进制("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转换的文本；输出大写十六进制文本，编码失败时返回空文本。'}], returnType: 'wideString', example: '字节_文本转十六进制("Ling")' },
    { name: '字节_十六进制转文本', signature: '字节_十六进制转文本(十六进制)', description: '把十六进制字节文本按 UTF-8 解码，格式错误返回空文本。', insertText: '字节_十六进制转文本("$1")', parameters: [{ name: '十六进制', type: 'wideString', description: hexDecodeArg}], returnType: 'wideString' },
    { name: '字节_十六进制是否有效', signature: '字节_十六进制是否有效(十六进制)', description: '判断文本是否由偶数个十六进制字符组成。', insertText: '字节_十六进制是否有效("$1")', parameters: [{ name: '十六进制', type: 'wideString', description: '待校验的文本；要求长度为偶数且每个字符都是 0-9、a-f、A-F。'}], returnType: 'bool' }
  ]
});

const byteArrayOperationsModule = createStandardModule({
  id: 'lingbuilder.std.bytes',
  name: '字节与十六进制模块',
  category: '其他',
  description: '提供正式字节集值语义和边界安全的二进制操作。',
  tags: ['字节集'],
  commands: [
    { name: '字节集_长度', signature: '字节集_长度(数据)', description: '返回字节集长度。', insertText: '字节集_长度($1)', parameters: [{ name: '数据', type: 'bytes', description: '要统计的字节集；字节数超过整数上限时返回 2147483647。'}], returnType: 'int' },
    { name: '字节集_截取', signature: '字节集_截取(数据, 起始位置, 长度)', description: '按 0 起始位置安全截取字节集。', insertText: '字节集_截取($1, 0, 1)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '起始位置', type: 'int', description: '截取起始字节索引，从 0 起；为负或已到达末尾时返回空字节集。'}, { name: '长度', type: 'int', description: '要截取的字节数；小于等于 0 返回空字节集，越过末尾时只取到末尾。'}], returnType: 'bytes' },
    { name: '字节集_拼接', signature: '字节集_拼接(前段, 后段)', description: '拼接两个字节集，溢出时返回空字节集。', insertText: '字节集_拼接($1, $2)', parameters: [{ name: '前段', type: 'bytes', description: '作为前半部分的字节集，字节顺序保持不变。'}, { name: '后段', type: 'bytes', description: '追加到前段之后的字节集；两段总长度溢出时返回空字节集。'}], returnType: 'bytes' },
    { name: '字节集_取字节', signature: '字节集_取字节(数据, 位置)', description: '读取指定位置的 0～255 字节，越界返回 -1。', insertText: '字节集_取字节($1, 0)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '位置', type: 'int', description: '要读取的字节位置，从 0 起；越界返回 -1。'}], returnType: 'int' },
    { name: '字节集_置字节', signature: '字节集_置字节(数据, 位置, 数值)', description: '写入一个字节，位置或数值无效时返回假。', insertText: '字节集_置字节($1, 0, 0)', parameters: [{ name: '数据', type: 'bytes', description: '要修改的字节集；只改动指定位置，长度不变。'}, { name: '位置', type: 'int', description: '要写入的字节位置，从 0 起；越界返回假且不改动数据。'}, { name: '数值', type: 'int', description: '写入的字节值，必须在 0 到 255 之间；超范围返回假。'}], returnType: 'bool' },
    { name: '字节集_Base64编码', signature: '字节集_Base64编码(数据)', description: '把字节集编码为 Base64 文本。', insertText: '字节集_Base64编码($1)', parameters: [{ name: '数据', type: 'bytes', description: '要编码的原始字节集；输出标准 Base64 字母表并以等号补齐。'}], returnType: 'wideString' },
    { name: '字节集_Base64解码', signature: '字节集_Base64解码(Base64文本)', description: '把 Base64 文本解码为字节集，格式错误返回空字节集。', insertText: '字节集_Base64解码("$1")', parameters: [{ name: 'Base64文本', type: 'wideString', description: '标准 Base64 文本，长度必须是 4 的倍数，只含字母表字符和末尾补齐等号；格式错误返回空字节集。'}], returnType: 'bytes' },
    { name: '字节集_十六进制编码', signature: '字节集_十六进制编码(数据)', description: '把字节集编码为 ASCII 十六进制字节集。', insertText: '字节集_十六进制编码($1)', parameters: [{ name: '数据', type: 'bytes', description: '要编码的字节集；输出由大写十六进制字符组成的 ASCII 字节集。'}], returnType: 'bytes' },
    { name: '字节集_十六进制解码', signature: '字节集_十六进制解码(十六进制)', description: '把十六进制文本解码为字节集。', insertText: '字节集_十六进制解码("$1")', parameters: [{ name: '十六进制', type: 'wideString', description: '十六进制字节文本；长度必须为偶数且逐字符合法，否则返回空字节集。'}], returnType: 'bytes' }
,
    { name: '字节集_寻找', signature: '字节集_寻找(数据, 欲寻找, 起始位置)', description: '从起始位置（从 0 起）向后查找字节集首次出现的位置；未找到、欲寻找为空或起始位置越界返回 -1。', insertText: '字节集_寻找($1, $2, 0)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '欲寻找', type: 'bytes', description: bytesSearchTarget}, { name: '起始位置', type: 'int', description: bytesStartIndex}], returnType: 'int' },
    { name: '字节集_倒找', signature: '字节集_倒找(数据, 欲寻找, 起始位置)', description: '从起始位置（含）向左查找字节集最后一次出现的位置；起始位置小于 0 或越界时按末尾处理；未找到返回 -1。', insertText: '字节集_倒找($1, $2, 0)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '欲寻找', type: 'bytes', description: '要查找的目标字节集；为空时返回 -1。'}, { name: '起始位置', type: 'int', description: '查找窗口的右端字节索引，含该位置，从 0 起；小于 0 或不小于字节集长度时按整个字节集查找。'}], returnType: 'int' },
    { name: '字节集_替换', signature: '字节集_替换(数据, 欲寻找, 替换内容, 次数)', description: '把字节集中的欲替换内容替换为替换内容；次数小于等于 0 表示全部替换；欲替换为空时原样返回。', insertText: '字节集_替换($1, $2, $3, 0)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '欲寻找', type: 'bytes', description: '要被替换掉的目标字节集；为空时原样返回。'}, { name: '替换内容', type: 'bytes', description: '替换写入的字节集，长度可以和目标不同，空字节集表示删除匹配。'}, { name: '次数', type: 'int', description: '最多替换次数；小于等于 0 表示全部替换。'}], returnType: 'bytes' },
    { name: '字节集_插入', signature: '字节集_插入(数据, 位置, 插入内容)', description: '在指定位置（从 0 起）插入字节集；位置小于 0 原样返回，超过长度时追加到末尾。', insertText: '字节集_插入($1, 0, $2)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '位置', type: 'int', description: '插入点字节索引，从 0 起；小于 0 原样返回，大于长度时追加到末尾。'}, { name: '插入内容', type: 'bytes', description: '要插入的字节集；空字节集时结果与源字节集相同。'}], returnType: 'bytes' },
    { name: '字节集_删除', signature: '字节集_删除(数据, 位置, 长度)', description: '从指定位置（从 0 起）删除指定长度的字节；长度小于 0 表示删除到末尾；位置越界时原样返回。', insertText: '字节集_删除($1, 0, 1)', parameters: [{ name: '数据', type: 'bytes', description: bytesArg}, { name: '位置', type: 'int', description: '起始删除的字节索引，从 0 起；为负或不小于长度时原样返回。'}, { name: '长度', type: 'int', description: '要删除的字节数；小于 0 表示删除到末尾，超出剩余时删除到末尾。'}], returnType: 'bytes' }  ]
});

const bytesModuleWithBinary: LingBuilderModuleManifest = {
  ...bytesModule,
  contributes: {
    ...bytesModule.contributes,
    commands: [...(bytesModule.contributes?.commands || []), ...(byteArrayOperationsModule.contributes?.commands || [])],
    snippets: [...(bytesModule.contributes?.snippets || []), ...(byteArrayOperationsModule.contributes?.snippets || [])]
  },
  bindings: {
    ...bytesModule.bindings,
    commands: [...(bytesModule.bindings?.commands || []), ...(byteArrayOperationsModule.bindings?.commands || [])]
  }
};

const arrayModule = createStandardModule({
  id: 'lingbuilder.std.array',
  name: '数组操作模块',
  category: '其他',
  description: '为 LingCpp 数组提供成员数、增删改查、排序和重定义能力。命令对元素类型透明，索引统一从 0 开始，越界一律安全返回而不崩溃。',
  tags: ['数组', '集合'],
  commands: [
    { name: '数组_取成员数', signature: '数组_取成员数(数组)', description: '返回数组当前成员数量。', insertText: '数组_取成员数($1)', parameters: [{ name: '数组', type: 'array', description: arrayArg}], returnType: 'int', example: '数组_取成员数(名单)' },
    { name: '数组_是否为空', signature: '数组_是否为空(数组)', description: '判断数组是否没有任何成员。', insertText: '数组_是否为空($1)', parameters: [{ name: '数组', type: 'array', description: arrayArg}], returnType: 'bool' },
    { name: '数组_取成员', signature: '数组_取成员(数组, 索引)', description: '按从 0 开始的索引读取成员；索引越界时返回元素类型的默认值。', insertText: '数组_取成员($1, 0)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '索引', type: 'int', description: '要读取的成员索引，从 0 起；越界返回元素类型的默认值，文本为空文本、数值为 0。'}], returnType: 'arrayElement', returnDescription: '与数组元素类型一致的值。', example: '数组_取成员(名单, 0)' },
    { name: '数组_置成员', signature: '数组_置成员(数组, 索引, 值)', description: '覆盖指定索引的成员；索引越界时返回假且不修改数组。', insertText: '数组_置成员($1, 0, $2)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '索引', type: 'int', description: '要覆盖的成员索引，从 0 起；越界返回假且不改动数组。'}, { name: '值', type: 'arrayElement', description: arrayValueArg}], returnType: 'bool' },
    { name: '数组_加入成员', signature: '数组_加入成员(数组, 值)', description: '在数组末尾追加一个成员，返回追加后的成员数。', insertText: '数组_加入成员($1, $2)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '值', type: 'arrayElement', description: arrayValueArg}], returnType: 'int', returnDescription: '追加后的成员数量。', example: '数组_加入成员(名单, "张三")' },
    { name: '数组_插入成员', signature: '数组_插入成员(数组, 索引, 值)', description: '在指定索引前插入成员；索引等于成员数时等价于追加，越界时返回假。', insertText: '数组_插入成员($1, 0, $2)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '索引', type: 'int', description: '插入位置的成员索引，从 0 起，等于成员数时等价于追加；为负或更大时返回假。'}, { name: '值', type: 'arrayElement', description: arrayValueArg}], returnType: 'bool' },
    { name: '数组_删除成员', signature: '数组_删除成员(数组, 索引)', description: '删除指定索引的成员，后续成员依次前移；索引越界时返回假。', insertText: '数组_删除成员($1, 0)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '索引', type: 'int', description: '要删除的成员索引，从 0 起；越界返回假。'}], returnType: 'bool' },
    { name: '数组_清空', signature: '数组_清空(数组)', description: '删除数组全部成员。', insertText: '数组_清空($1)', parameters: [{ name: '数组', type: 'array', description: arrayArg}], returnType: 'bool' },
    { name: '数组_查找', signature: '数组_查找(数组, 值)', description: '返回首个相等成员的从 0 开始索引；未找到或元素类型不支持相等比较时返回 -1。', insertText: '数组_查找($1, $2)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '值', type: 'arrayElement', description: '要比较的成员值；元素类型不支持相等比较时返回 -1。'}], returnType: 'int', example: '数组_查找(名单, "张三")' },
    { name: '数组_是否包含', signature: '数组_是否包含(数组, 值)', description: '判断数组是否包含相等成员；元素类型不支持相等比较时返回假。', insertText: '数组_是否包含($1, $2)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '值', type: 'arrayElement', description: '要比较的成员值；元素类型不支持相等比较时返回假。'}], returnType: 'bool' },
    { name: '数组_排序', signature: '数组_排序(数组, 升序)', description: '按元素自身顺序稳定排序；元素类型不支持大小比较时返回假且不改动数组。', insertText: '数组_排序($1, 真)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '升序', type: 'bool', description: '传真按从小到大排序，传假按从大到小；采用稳定排序，元素类型不支持大小比较时返回假且不改动数组。'}], returnType: 'bool', example: '数组_排序(名单, 真)' },
    { name: '数组_倒序', signature: '数组_倒序(数组)', description: '把数组成员按当前顺序整体反转。', insertText: '数组_倒序($1)', parameters: [{ name: '数组', type: 'array', description: arrayArg}], returnType: 'bool' },
    { name: '数组_重定义', signature: '数组_重定义(数组, 新成员数)', description: '调整数组成员数：变小时截断，变大时用元素类型默认值补齐；新成员数为负时返回假。', insertText: '数组_重定义($1, 0)', parameters: [{ name: '数组', type: 'array', description: arrayArg}, { name: '新成员数', type: 'int', description: '调整后的成员数量，不能为负；变小时截断，变大时用元素类型默认值补齐。'}], returnType: 'bool' }
  ],
  snippets: [{
    label: '数组增删遍历',
    insertText: '数组_加入成员(名单, "张三")\n数组_加入成员(名单, "李四")\n枚举循环首 (名单, 当前项)\n    调试输出(当前项)\n枚举循环尾 ()\n调试输出("成员数", 数组_取成员数(名单))',
    description: '追加成员、遍历数组并输出成员数；名单需要先声明为文本型数组。'
  }],
  docs: [{ title: '数组操作模块', path: 'docs/modules/array/README.md' }]
});

const encodingModule = createStandardModule({
  id: 'lingbuilder.std.encoding',
  name: '编码转换模块',
  category: '其他',
  description: '通过十六进制字节文本安全提供 UTF-8、UTF-16、UTF-32、ANSI、GBK、GB2312、GB18030、BOM、Base64、URL 与 HTML 编解码。',
  tags: ['编码', 'Unicode', 'UTF-8', 'GBK', 'Base64', 'URL'],
  commands: [
    { name: '编码_文本转UTF8', signature: '编码_文本转UTF8(文本)', description: '把 Unicode 文本编码为 UTF-8 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF8("$1")', parameters: [{ name: '文本', type: 'wideString', description: hexEncodeTextArg}], returnType: 'wideString', example: '编码_文本转UTF8("你好")' },
    { name: '编码_UTF8转文本', signature: '编码_UTF8转文本(UTF8十六进制)', description: '把十六进制表示的 UTF-8 字节解码为 Unicode 文本；无效输入返回空文本。', insertText: '编码_UTF8转文本("$1")', parameters: [{ name: 'UTF8十六进制', type: 'wideString', description: hexDecodeArg}], returnType: 'wideString', example: '编码_UTF8转文本("E4BDA0E5A5BD")' },
    { name: '编码_文本转UTF16LE', signature: '编码_文本转UTF16LE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-16 LE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF16LE("$1")', parameters: [{ name: '文本', type: 'wideString', description: hexEncodeTextArg}], returnType: 'wideString' },
    { name: '编码_UTF16LE转文本', signature: '编码_UTF16LE转文本(UTF16LE十六进制)', description: '把十六进制表示的 UTF-16 LE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。', insertText: '编码_UTF16LE转文本("$1")', parameters: [{ name: 'UTF16LE十六进制', type: 'wideString', description: '待解码的十六进制文本，长度必须为偶数且字节数是 2 的倍数；代理对不完整或格式非法时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转UTF16BE', signature: '编码_文本转UTF16BE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-16 BE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF16BE("$1")', parameters: [{ name: '文本', type: 'wideString', description: hexEncodeTextArg}], returnType: 'wideString' },
    { name: '编码_UTF16BE转文本', signature: '编码_UTF16BE转文本(UTF16BE十六进制)', description: '把十六进制表示的 UTF-16 BE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。', insertText: '编码_UTF16BE转文本("$1")', parameters: [{ name: 'UTF16BE十六进制', type: 'wideString', description: '待解码的十六进制文本，长度必须为偶数且字节数是 2 的倍数；代理对不完整或格式非法时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转UTF32LE', signature: '编码_文本转UTF32LE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-32 LE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF32LE("$1")', parameters: [{ name: '文本', type: 'wideString', description: hexEncodeTextArg}], returnType: 'wideString' },
    { name: '编码_UTF32LE转文本', signature: '编码_UTF32LE转文本(UTF32LE十六进制)', description: '把十六进制表示的 UTF-32 LE 字节解码为 Unicode 文本；无效码点返回空文本。', insertText: '编码_UTF32LE转文本("$1")', parameters: [{ name: 'UTF32LE十六进制', type: 'wideString', description: '待解码的十六进制文本，字节数必须是 4 的倍数；出现代理区码点或超过 U+10FFFF 时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转UTF32BE', signature: '编码_文本转UTF32BE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-32 BE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF32BE("$1")', parameters: [{ name: '文本', type: 'wideString', description: hexEncodeTextArg}], returnType: 'wideString' },
    { name: '编码_UTF32BE转文本', signature: '编码_UTF32BE转文本(UTF32BE十六进制)', description: '把十六进制表示的 UTF-32 BE 字节解码为 Unicode 文本；无效码点返回空文本。', insertText: '编码_UTF32BE转文本("$1")', parameters: [{ name: 'UTF32BE十六进制', type: 'wideString', description: '待解码的十六进制文本，字节数必须是 4 的倍数；出现代理区码点或超过 U+10FFFF 时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转ANSI', signature: '编码_文本转ANSI(文本)', description: '按当前 Windows 系统 ANSI 代码页编码文本，返回大写十六进制字节；无法无损表示时返回空文本。', insertText: '编码_文本转ANSI("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本；当前系统 ANSI 代码页无法无损表示的字符会导致返回空文本。'}], returnType: 'wideString' },
    { name: '编码_ANSI转文本', signature: '编码_ANSI转文本(ANSI十六进制)', description: '按当前 Windows 系统 ANSI 代码页解码十六进制字节。', insertText: '编码_ANSI转文本("$1")', parameters: [{ name: 'ANSI十六进制', type: 'wideString', description: '待解码的十六进制字节文本，长度必须为偶数；按当前系统 ANSI 代码页解码，失败返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转GBK', signature: '编码_文本转GBK(文本)', description: '按 Windows CP936 把文本编码为 GBK 字节，返回大写十六进制文本；无法无损表示时返回空文本。', insertText: '编码_文本转GBK("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本；Windows CP936 无法无损表示的字符会导致返回空文本。'}], returnType: 'wideString' },
    { name: '编码_GBK转文本', signature: '编码_GBK转文本(GBK十六进制)', description: '按 Windows CP936 解码十六进制表示的 GBK 字节。', insertText: '编码_GBK转文本("$1")', parameters: [{ name: 'GBK十六进制', type: 'wideString', description: '待解码的十六进制字节文本，长度必须为偶数；按 Windows CP936 解码，失败返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转GB2312', signature: '编码_文本转GB2312(文本)', description: '把文本编码为严格 GB2312 双字节范围，返回大写十六进制文本；GBK 扩展字符或无法表示的字符返回空文本。', insertText: '编码_文本转GB2312("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本；只能表示 GB2312 双字节范围，含 GBK 扩展字符或不可表示字符时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_GB2312转文本', signature: '编码_GB2312转文本(GB2312十六进制)', description: '校验 GB2312 字节范围后按 Windows CP936 解码为 Unicode 文本。', insertText: '编码_GB2312转文本("$1")', parameters: [{ name: 'GB2312十六进制', type: 'wideString', description: '待解码的十六进制字节文本，长度必须为偶数；先校验每个双字节落在 GB2312 范围，再按 Windows CP936 解码，超范围返回空文本。'}], returnType: 'wideString' },
    { name: '编码_文本转GB18030', signature: '编码_文本转GB18030(文本)', description: '按 Windows CP54936 把文本编码为 GB18030 字节，返回大写十六进制文本。', insertText: '编码_文本转GB18030("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本；按 Windows CP54936 严格编码，编码失败返回空文本。'}], returnType: 'wideString' },
    { name: '编码_GB18030转文本', signature: '编码_GB18030转文本(GB18030十六进制)', description: '按 Windows CP54936 解码十六进制表示的 GB18030 字节。', insertText: '编码_GB18030转文本("$1")', parameters: [{ name: 'GB18030十六进制', type: 'wideString', description: '待解码的十六进制字节文本，长度必须为偶数；按 Windows CP54936 严格解码，失败返回空文本。'}], returnType: 'wideString' },
    { name: '编码_转换', signature: '编码_转换(字节十六进制, 来源编码, 目标编码)', description: '在支持的字符编码间转换十六进制字节；编码名支持 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030。输出不自动添加 BOM。', insertText: '编码_转换("$1", "UTF-8", "UTF-16LE")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待转换的十六进制字节文本，长度必须为偶数且只含合法十六进制字符。'}, { name: '来源编码', type: 'wideString', description: '这些字节当前的编码名称，忽略大小写和空格、连字符、下划线；支持 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE、ANSI、GBK、GB2312、GB18030，无法识别时返回空文本。'}, { name: '目标编码', type: 'wideString', description: '要转换到的编码名称，取值范围同来源编码；无法识别时返回空文本，输出不自动附加 BOM。'}], returnType: 'wideString' },
    { name: '编码_添加BOM', signature: '编码_添加BOM(字节十六进制, 编码名称)', description: '为 UTF-8、UTF-16LE/BE 或 UTF-32LE/BE 十六进制字节添加匹配 BOM；已有 BOM 不重复添加。', insertText: '编码_添加BOM("$1", "UTF-8")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待补 BOM 的十六进制字节文本，长度必须为偶数。'}, { name: '编码名称', type: 'wideString', description: '要补加 BOM 的编码名称，仅支持 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE；名称无法识别或字节已带不同 BOM 时返回空文本，已带相同 BOM 时原样返回。'}], returnType: 'wideString' },
    { name: '编码_删除BOM', signature: '编码_删除BOM(字节十六进制)', description: '识别并删除 UTF-8、UTF-16 或 UTF-32 BOM，返回剩余大写十六进制字节。', insertText: '编码_删除BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待处理的十六进制字节文本，长度必须为偶数；没有 BOM 时原样返回。'}], returnType: 'wideString' },
    { name: '编码_是否有BOM', signature: '编码_是否有BOM(字节十六进制)', description: '判断十六进制字节是否以受支持的 BOM 开头。', insertText: '编码_是否有BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待检测的十六进制字节文本，长度必须为偶数；格式非法时返回假。'}], returnType: 'bool' },
    { name: '编码_检测BOM', signature: '编码_检测BOM(字节十六进制)', description: '根据 BOM 返回 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE 或 UTF-32BE；没有 BOM 返回空文本。', insertText: '编码_检测BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待检测的十六进制字节文本，长度必须为偶数；无 BOM 或格式非法时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_检测', signature: '编码_检测(字节十六进制)', description: '先检测 BOM；无 BOM 时仅在字节是严格 UTF-8 时返回 UTF-8，否则返回“未知”，不猜测 ANSI 或中文代码页。', insertText: '编码_检测("$1")', parameters: [{ name: '字节十六进制', type: 'wideString', description: '待检测的十六进制字节文本，长度必须为偶数；优先看 BOM，无 BOM 时只有严格合法的 UTF-8 才返回 UTF-8，其余返回未知。'}], returnType: 'wideString' },
    { name: '编码_Base64编码', signature: '编码_Base64编码(文本)', description: '将 Unicode 文本按 UTF-8 编码为 Base64。', insertText: '编码_Base64编码("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本，先按 UTF-8 转字节再编码，输出可含补齐等号。'}], returnType: 'wideString', example: '编码_Base64编码("你好")' },
    { name: '编码_Base64解码', signature: '编码_Base64解码(Base64文本)', description: '将 Base64 解码为 UTF-8 文本，格式错误返回空文本。', insertText: '编码_Base64解码("$1")', parameters: [{ name: 'Base64文本', type: 'wideString', description: '标准 Base64 文本，长度必须是 4 的倍数；含非法字符或等号位置错误时返回空文本，结果按 UTF-8 解码为文本。'}], returnType: 'wideString', example: '编码_Base64解码("5L2g5aW9")' },
    { name: '编码_URL编码', signature: '编码_URL编码(文本)', description: '按 UTF-8 对 URL 参数内容进行百分号编码。', insertText: '编码_URL编码("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要编码的源文本；字母、数字和 - _ . ~ 保持不变，其余字节按 UTF-8 做百分号编码。'}], returnType: 'wideString' },
    { name: '编码_URL解码', signature: '编码_URL解码(文本)', description: '解码 URL 百分号编码和加号空格。', insertText: '编码_URL解码("$1")', parameters: [{ name: '文本', type: 'wideString', description: '已百分号编码的文本；加号会还原为空格，百分号之后不是两位合法十六进制时返回空文本。'}], returnType: 'wideString' },
    { name: '编码_HTML转义', signature: '编码_HTML转义(文本)', description: '转义 HTML 中的与号、尖括号、引号和单引号。', insertText: '编码_HTML转义("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要转义的源文本；与号、尖括号、双引号和单引号替换为对应实体。'}], returnType: 'wideString' },
    { name: '编码_HTML反转义', signature: '编码_HTML反转义(文本)', description: '还原本模块支持的常用 HTML 实体。', insertText: '编码_HTML反转义("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要还原的文本，仅处理与号、lt、gt、quot、#39 五种实体。'}], returnType: 'wideString' }
  ]
});

const mathModule = createStandardModule({
  id: 'lingbuilder.std.math',
  name: '数学与随机模块',
  category: '其他',
  description: '提供常用数学函数、范围限制和线程安全随机整数。',
  tags: ['数学', '随机'],
  commands: [
    { name: '数学_绝对值', signature: '数学_绝对值(数值)', description: '返回数值的绝对值。', insertText: '数学_绝对值(0)', parameters: [{ name: '数值', type: 'double', description: '参与计算的双精度数值，正负不限。'}], returnType: 'double', example: '数学_绝对值(-3.14)' },
    { name: '数学_最小值', signature: '数学_最小值(数值一, 数值二)', description: '返回两个数值中的较小值。', insertText: '数学_最小值(0, 1)', parameters: [{ name: '数值一', type: 'double', description: '参与比较的第一个双精度数值。'}, { name: '数值二', type: 'double', description: '参与比较的第二个双精度数值。'}], returnType: 'double' },
    { name: '数学_最大值', signature: '数学_最大值(数值一, 数值二)', description: '返回两个数值中的较大值。', insertText: '数学_最大值(0, 1)', parameters: [{ name: '数值一', type: 'double', description: '参与比较的第一个双精度数值。'}, { name: '数值二', type: 'double', description: '参与比较的第二个双精度数值。'}], returnType: 'double' },
    { name: '数学_限制范围', signature: '数学_限制范围(数值, 最小值, 最大值)', description: '将数值限制在指定闭区间内。', insertText: '数学_限制范围(0, 0, 100)', parameters: [{ name: '数值', type: 'double', description: '要限制到区间内的双精度数值。'}, { name: '最小值', type: 'double', description: '闭区间下界；大于上界时运行时自动交换两个界限。'}, { name: '最大值', type: 'double', description: '闭区间上界；小于下界时与下界自动交换。'}], returnType: 'double' },
    { name: '数学_平方根', signature: '数学_平方根(数值)', description: '返回非负数值的平方根，负数返回 0。', insertText: '数学_平方根(0)', parameters: [{ name: '数值', type: 'double', description: '被开方数；为负时返回 0 而不是报错。'}], returnType: 'double' },
    { name: '数学_乘方', signature: '数学_乘方(底数, 指数)', description: '返回底数的指定次方。', insertText: '数学_乘方(2, 8)', parameters: [{ name: '底数', type: 'double', description: '乘方的底数。'}, { name: '指数', type: 'double', description: '乘方的指数，允许小数和负数。'}], returnType: 'double' },
    { name: '数学_随机整数', signature: '数学_随机整数(最小值, 最大值)', description: '返回指定闭区间内的随机整数，参数顺序可交换。', insertText: '数学_随机整数(1, 100)', parameters: [{ name: '最小值', type: 'int', description: '随机闭区间的下界；大于上界时两者自动交换。'}, { name: '最大值', type: 'int', description: '随机闭区间的上界，可以等于下界。'}], returnType: 'int', example: '数学_随机整数(1, 100)' }
  ]
});

const datetimeModule = createStandardModule({
  id: 'lingbuilder.std.datetime',
  name: '日期时间模块',
  category: '其他',
  description: '提供本地时间格式化、Unix 时间戳和高精度单调计时。',
  tags: ['日期', '时间'],
  commands: [
    { name: '时间_当前时间戳', signature: '时间_当前时间戳()', description: '返回当前 Unix 秒级时间戳。', insertText: '时间_当前时间戳()', returnType: 'longLong', example: '时间_当前时间戳()' },
    { name: '时间_当前毫秒', signature: '时间_当前毫秒()', description: '返回当前 Unix 毫秒级时间戳。', insertText: '时间_当前毫秒()', returnType: 'longLong', example: '时间_当前毫秒()' },
    { name: '时间_单调毫秒', signature: '时间_单调毫秒()', description: '返回适合计算耗时的单调时钟毫秒值。', insertText: '时间_单调毫秒()', returnType: 'longLong' },
    { name: '时间_格式化当前', signature: '时间_格式化当前(格式)', description: '使用 wcsftime 格式格式化当前本地时间。', insertText: '时间_格式化当前("%Y-%m-%d %H:%M:%S")', parameters: [{ name: '格式', type: 'wideString', description: 'wcsftime 格式串，例如 %Y-%m-%d %H:%M:%S；输出上限 256 个字符，格式化失败返回空文本。'}], returnType: 'wideString' },
    { name: '时间_格式化时间戳', signature: '时间_格式化时间戳(时间戳, 格式)', description: '格式化指定 Unix 秒级时间戳。', insertText: '时间_格式化时间戳(0, "%Y-%m-%d %H:%M:%S")', parameters: [{ name: '时间戳', type: 'longLong', description: '要格式化的 Unix 秒级时间戳，按系统本地时区换算。'}, { name: '格式', type: 'wideString', description: 'wcsftime 格式串，例如 %Y-%m-%d %H:%M:%S；空文本时使用 %Y-%m-%d %H:%M:%S。'}], returnType: 'wideString' }
  ]
});

const regexModule = createStandardModule({
  id: 'lingbuilder.std.regex',
  name: '正则表达式模块',
  category: '其他',
  description: '基于 C++ ECMAScript 正则语法提供匹配、查找和替换；非法表达式安全返回失败。',
  tags: ['正则', '文本'],
  commands: [
    { name: '正则_完全匹配', signature: '正则_完全匹配(文本, 表达式)', description: '判断整个文本是否匹配表达式。', insertText: '正则_完全匹配("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '要求整段匹配的 ECMAScript 宽字符正则表达式；表达式非法时返回假。'}], returnType: 'bool', example: '正则_完全匹配("123", "[0-9]+")' },
    { name: '正则_是否包含', signature: '正则_是否包含(文本, 表达式)', description: '判断文本中是否存在匹配内容。', insertText: '正则_是否包含("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '在文本中搜索的 ECMAScript 宽字符正则表达式，存在一处匹配即为真；表达式非法时返回假。'}], returnType: 'bool' },
    { name: '正则_取首个', signature: '正则_取首个(文本, 表达式)', description: '返回首个匹配文本，没有匹配或表达式非法时返回空文本。', insertText: '正则_取首个("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: 'ECMAScript 宽字符正则表达式；表达式非法或没有匹配时返回空文本。'}], returnType: 'wideString' },
    { name: '正则_替换', signature: '正则_替换(文本, 表达式, 替换内容)', description: '替换全部正则匹配。', insertText: '正则_替换("$1", "$2", "$3")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '要匹配的正则表达式；表达式非法时原样返回源文本。'}, { name: '替换内容', type: 'wideString', description: '替换文本，支持 $1 形式的分组引用；需要输出美元号本身时写成两个美元号。'}], returnType: 'wideString' },
    { name: '正则_匹配数量', signature: '正则_匹配数量(文本, 表达式)', description: '返回不重叠匹配数量。', insertText: '正则_匹配数量("$1", "$2")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '统计出现次数的正则表达式；表达式非法时返回 0，计数按不重叠匹配。'}], returnType: 'int' },
    { name: '正则_取所有匹配', signature: '正则_取所有匹配(文本, 表达式, 分隔符)', description: '返回全部匹配文本并按分隔符依次拼接；无匹配或表达式非法时返回空文本。', insertText: '正则_取所有匹配("$1", "$2", "$3")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '要匹配的正则表达式；表达式非法或无匹配时返回空文本。'}, { name: '分隔符', type: 'wideString', description: regexSeparatorArg}], returnType: 'wideString', example: '正则_取所有匹配("a1b22c333", "[0-9]+", ",")' },
    { name: '正则_取第N个匹配', signature: '正则_取第N个匹配(文本, 表达式, 序号)', description: '返回第 N 个匹配文本（序号从 0 起）；越界、无匹配或表达式非法时返回空文本。', insertText: '正则_取第N个匹配("$1", "$2", 0)', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '要匹配的正则表达式；表达式非法时返回空文本。'}, { name: '序号', type: 'int', description: '要取第几个匹配，从 0 起；为负或超过匹配总数时返回空文本。'}], returnType: 'wideString', example: '正则_取第N个匹配("a1b22c333", "[0-9]+", 1)' },
    { name: '正则_取分组', signature: '正则_取分组(文本, 表达式, 组序号)', description: '返回首个匹配中第 N 个分组的文本（0 表示整个匹配）；分组未参与匹配、越界或表达式非法时返回空文本。', insertText: '正则_取分组("$1", "$2", 1)', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '带捕获分组的正则表达式；表达式非法或无匹配时返回空文本。'}, { name: '组序号', type: 'int', description: '捕获分组编号，0 表示整个匹配；为负、超出分组数量或该分组未参与匹配时返回空文本。'}], returnType: 'wideString', example: '正则_取分组("2026-09-13", "([0-9]+)-([0-9]+)-([0-9]+)", 2)' },
    { name: '正则_取所有分组', signature: '正则_取所有分组(文本, 表达式, 组序号, 分隔符)', description: '把每个匹配中第 N 个分组的文本（0 表示整个匹配）按分隔符依次拼接；无匹配或表达式非法时返回空文本。', insertText: '正则_取所有分组("$1", "$2", 1, "$4")', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '带捕获分组的正则表达式；表达式非法时返回空文本。'}, { name: '组序号', type: 'int', description: '捕获分组编号，0 表示整个匹配；未参与匹配的分组会被跳过。'}, { name: '分隔符', type: 'wideString', description: regexSeparatorArg}], returnType: 'wideString', example: '正则_取所有分组("a1b22c333", "([0-9]+)", 1, ",")' },
    { name: '正则_取匹配位置', signature: '正则_取匹配位置(文本, 表达式, 序号)', description: '返回第 N 个匹配的起始位置（从 0 起，按字符计）；无匹配、越界或表达式非法时返回 -1。', insertText: '正则_取匹配位置("$1", "$2", 0)', parameters: [{ name: '文本', type: 'wideString', description: regexTextArg}, { name: '表达式', type: 'wideString', description: '要定位的正则表达式；表达式非法时返回 -1。'}, { name: '序号', type: 'int', description: '要定位第几个匹配，从 0 起；为负或超过匹配总数时返回 -1。'}], returnType: 'int', example: '正则_取匹配位置("a1b22c333", "[0-9]+", 1)' }
  ]
});


const bufferModule = createStandardModule({
  id: 'lingbuilder.std.buffer',
  name: '缓冲区模块',
  category: '其他',
  description: '提供句柄制可增长二进制缓冲区：顺序读写游标、字节集/文本/整数编解码与文件互转；单缓冲区上限 256 MiB，跨线程传递请先转为字节集。',
  tags: ['字节集', '缓冲区', '二进制'],
  commands: [
    { name: '缓冲区_创建', signature: '缓冲区_创建(初始容量)', description: '创建可增长二进制缓冲区；初始容量 0～268435456，返回缓冲区句柄（0 表示失败）。', insertText: '缓冲区_创建(1024)', parameters: [{ name: '初始容量', type: 'int', description: '预分配的字节容量，0 到 268435456；负数表示创建失败并返回句柄 0。'}], returnType: 'longLong', example: '缓冲区_创建(1024)' },
    { name: '缓冲区_销毁', signature: '缓冲区_销毁(缓冲区)', description: '销毁缓冲区并回收句柄；销毁后句柄不可再用。', insertText: '缓冲区_销毁($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: '缓冲区_创建等命令返回的缓冲区句柄；句柄不存在或已销毁时返回假。'}], returnType: 'bool' },
    { name: '缓冲区_取长度', signature: '缓冲区_取长度(缓冲区)', description: '返回缓冲区当前总字节数；句柄无效返回 -1。', insertText: '缓冲区_取长度($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: '缓冲区_创建等命令返回的缓冲区句柄；句柄无效时返回 -1。'}], returnType: 'longLong' },
    { name: '缓冲区_写字节集', signature: '缓冲区_写字节集(缓冲区, 字节集)', description: '把字节集追加到缓冲区末尾；单个缓冲区上限 268435456 字节。', insertText: '缓冲区_写字节集($1, $2)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '字节集', type: 'bytes', description: '要追加到缓冲区末尾的字节集；与已有内容合计超过 268435456 字节时返回假且不写入。'}], returnType: 'bool' },
    { name: '缓冲区_写文本', signature: '缓冲区_写文本(缓冲区, 文本)', description: '把文本按 UTF-8 编码追加到缓冲区末尾。', insertText: '缓冲区_写文本($1, "$2")', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '文本', type: 'wideString', description: '要按 UTF-8 追加写入的文本；受单缓冲区 268435456 字节上限约束。'}], returnType: 'bool' },
    { name: '缓冲区_写整数', signature: '缓冲区_写整数(缓冲区, 整数, 字节数, 大端)', description: '把整数按指定字节数（1/2/4/8）写入缓冲区末尾；超出范围的字节数返回假。', insertText: '缓冲区_写整数($1, $2, 4, 假)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '整数', type: 'longLong', description: '要写入的整数值，只取指定位宽对应的低位字节。'}, { name: '字节数', type: 'int', description: bufferWidth}, { name: '大端', type: 'bool', description: bufferEndian}], returnType: 'bool' },
    { name: '缓冲区_读字节集', signature: '缓冲区_读字节集(缓冲区, 长度)', description: '从读取游标处取出字节集并前进游标；长度小于 0 表示读取全部剩余字节。', insertText: '缓冲区_读字节集($1, 4)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '长度', type: 'int', description: bufferLength}], returnType: 'bytes' },
    { name: '缓冲区_读文本', signature: '缓冲区_读文本(缓冲区, 长度)', description: '从读取游标处按 UTF-8 解码文本并前进游标；长度小于 0 表示读取全部剩余字节。', insertText: '缓冲区_读文本($1, -1)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '长度', type: 'int', description: '要读取的字节数，读出的字节按 UTF-8 解码为文本；小于 0 表示读取全部剩余字节。'}], returnType: 'wideString' },
    { name: '缓冲区_读整数', signature: '缓冲区_读整数(缓冲区, 字节数, 大端)', description: '从读取游标处按指定字节数（1/2/4/8）读取整数并前进游标；数据不足返回 0。', insertText: '缓冲区_读整数($1, 4, 假)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '字节数', type: 'int', description: '整数的字节宽度，只允许 1、2、4、8；其它值返回 0。'}, { name: '大端', type: 'bool', description: bufferEndian}], returnType: 'longLong' },
    { name: '缓冲区_取剩余', signature: '缓冲区_取剩余(缓冲区)', description: '返回读取游标到缓冲区末尾的剩余字节数；句柄无效返回 -1。', insertText: '缓冲区_取剩余($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: '缓冲区_创建等命令返回的缓冲区句柄；句柄无效时返回 -1。'}], returnType: 'longLong' },
    { name: '缓冲区_重置读取', signature: '缓冲区_重置读取(缓冲区)', description: '把读取游标移回缓冲区开头。', insertText: '缓冲区_重置读取($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}], returnType: 'bool' },
    { name: '缓冲区_到字节集', signature: '缓冲区_到字节集(缓冲区)', description: '把缓冲区全部内容复制为字节集。', insertText: '缓冲区_到字节集($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: '缓冲区_创建等命令返回的缓冲区句柄；句柄无效时返回空字节集。'}], returnType: 'bytes' },
    { name: '缓冲区_从字节集', signature: '缓冲区_从字节集(字节集)', description: '用字节集内容创建新缓冲区并返回句柄。', insertText: '缓冲区_从字节集($1)', parameters: [{ name: '字节集', type: 'bytes', description: '用作缓冲区初始内容的字节集；超过 268435456 字节时返回句柄 0。'}], returnType: 'longLong' },
    { name: '缓冲区_清空', signature: '缓冲区_清空(缓冲区)', description: '清空缓冲区内容并把读取游标归零。', insertText: '缓冲区_清空($1)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}], returnType: 'bool' },
    { name: '缓冲区_保存文件', signature: '缓冲区_保存文件(缓冲区, 路径)', description: '把缓冲区全部内容写入目标文件（覆盖写入）。', insertText: '缓冲区_保存文件($1, "$2")', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '路径', type: 'wideString', description: '目标文件路径，不能为空文本；以二进制方式整文件覆盖写入。'}], returnType: 'bool' },
    { name: '缓冲区_从文件', signature: '缓冲区_从文件(路径)', description: '读取文件内容创建新缓冲区；失败或超过 268435456 字节返回 0。', insertText: '缓冲区_从文件("$1")', parameters: [{ name: '路径', type: 'wideString', description: '要读取的文件路径，不能为空文本；打不开或文件超过 268435456 字节时返回句柄 0。'}], returnType: 'longLong' }
,
    { name: '缓冲区_寻找', signature: '缓冲区_寻找(缓冲区, 欲寻找, 起始位置)', description: '在缓冲区全部内容中从起始位置（从 0 起）查找字节集，返回内容中的位置；读取游标不动；未找到或句柄无效返回 -1。', insertText: '缓冲区_寻找($1, $2, 0)', parameters: [{ name: '缓冲区', type: 'longLong', description: bufferHandle}, { name: '欲寻找', type: 'bytes', description: bytesSearchTarget}, { name: '起始位置', type: 'int', description: '查找起始的字节索引，从 0 起；不影响读取游标。'}], returnType: 'int' }  ]
});

const xmlModule = createStandardModule({
  id: 'lingbuilder.data.xml',
  name: 'XML 文本模块',
  category: '其他',
  description: '提供 XML 文本转义、节点生成和简单节点内容读取，不执行外部实体。',
  tags: ['数据', 'XML'],
  commands: [
    { name: 'XML_转义文本', signature: 'XML_转义文本(文本)', description: '转义 XML 文本节点中的特殊字符。', insertText: 'XML_转义文本("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要写入 XML 文本节点的原始内容；与号、尖括号、双引号和单引号会被替换为实体。'}], returnType: 'wideString', example: 'XML_转义文本("<中文>")' },
    { name: 'XML_反转义文本', signature: 'XML_反转义文本(文本)', description: '还原本模块支持的五种预定义 XML 实体。', insertText: 'XML_反转义文本("$1")', parameters: [{ name: '文本', type: 'wideString', description: '要还原的文本，仅处理与号、lt、gt、quot、apos 五种预定义实体。'}], returnType: 'wideString' },
    { name: 'XML_生成节点', signature: 'XML_生成节点(节点名, 内容)', description: '生成包含安全转义文本的简单 XML 节点；非法节点名返回空文本。', insertText: 'XML_生成节点("$1", "$2")', parameters: [{ name: '节点名', type: 'wideString', description: xmlNameArg}, { name: '内容', type: 'wideString', description: '节点内的文本内容，运行时自动做 XML 转义，可以传空文本生成空节点。'}], returnType: 'wideString' },
    { name: 'XML_是否包含节点', signature: 'XML_是否包含节点(XML文本, 节点名)', description: '判断 XML 文本是否包含指定简单节点。', insertText: 'XML_是否包含节点("$1", "$2")', parameters: [{ name: 'XML文本', type: 'wideString', description: xmlSourceArg}, { name: '节点名', type: 'wideString', description: xmlNameArg}], returnType: 'bool' },
    { name: 'XML_取节点文本', signature: 'XML_取节点文本(XML文本, 节点名)', description: '读取第一个指定简单节点的文本内容并反转义。', insertText: 'XML_取节点文本("$1", "$2")', parameters: [{ name: 'XML文本', type: 'wideString', description: xmlSourceArg}, { name: '节点名', type: 'wideString', description: '要读取的元素名，命名规则同生成节点；只返回首个匹配节点的内容并自动反转义。'}], returnType: 'wideString' }
  ]
});

export const STANDARD_LIBRARY_MODULES: LingBuilderModuleManifest[] = [
  textModule,
  arrayModule,
  bytesModuleWithBinary,
  encodingModule,
  mathModule,
  datetimeModule,
  regexModule,
  bufferModule,

  JSON_MODULE,
  xmlModule
];

export const STANDARD_LIBRARY_MODULE_IDS = new Set(STANDARD_LIBRARY_MODULES.map(module => module.id));
