import {
  LingBuilderModuleCategory,
  LingBuilderModuleManifest,
  ModuleBindingValueType
} from './types';

export interface StandardCommandSpec {
  name: string;
  signature: string;
  description: string;
  insertText: string;
  parameters?: Array<{ name: string; type: ModuleBindingValueType; description?: string }>;
  returnType: ModuleBindingValueType;
  example?: string;
}

export interface StandardModuleSpec {
  id: string;
  name: string;
  category: LingBuilderModuleCategory;
  description: string;
  tags: string[];
  commands: StandardCommandSpec[];
}

const RETURN_TYPE_LABELS: Record<ModuleBindingValueType, string> = {
  void: '空',
  int: '整数型',
  longLong: '长整数型',
  double: '双精度小数型',
  bool: '逻辑型',
  wideString: '文本型',
  utf8String: '文本型',
  handler: '处理器',
  handle: '长整数型',
  raw: '原生类型'
};

export function createStandardModule(spec: StandardModuleSpec): LingBuilderModuleManifest {
  return {
    schemaVersion: 2,
    id: spec.id,
    name: spec.name,
    version: '1.0.0',
    category: spec.category,
    description: spec.description,
    author: 'LingBuilder',
    license: 'MIT',
    tags: ['内置', '标准库', ...spec.tags],
    contributes: {
      commands: spec.commands.map(command => ({
        name: command.name,
        signature: command.signature,
        description: command.description,
        insertText: command.insertText,
        returnType: RETURN_TYPE_LABELS[command.returnType]
      })),
      snippets: [{
        label: `${spec.name}快速示例`,
        insertText: spec.commands.slice(0, 2).map(command => command.example || command.insertText.replace(/\$\d+/g, '')).join('\n'),
        description: `插入${spec.name}的基础调用示例。`
      }]
    },
    targets: [
      { id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc' },
      { id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc' }
    ],
    bindings: {
      commands: spec.commands.map(command => ({
        command: command.name,
        runtimeName: command.name,
        parameters: command.parameters || [],
        returnType: command.returnType,
        encoding: command.parameters?.some(parameter => parameter.type === 'wideString') || command.returnType === 'wideString'
          ? 'wide'
          : undefined,
        example: command.example
      }))
    }
  };
}

const textModule = createStandardModule({
  id: 'lingbuilder.std.text',
  name: '文本处理模块',
  category: '其他',
  description: '提供 Unicode 文本查找、截取、替换、修剪和大小写转换能力。索引统一从 0 开始。',
  tags: ['文本', 'Unicode'],
  commands: [
    { name: '文本_取长度', signature: '文本_取长度(文本)', description: '返回 Unicode 文本的字符数量。', insertText: '文本_取长度("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'int', example: '文本_取长度("LingBuilder")' },
    { name: '文本_寻找', signature: '文本_寻找(文本, 目标)', description: '返回目标文本首次出现的从 0 开始索引，未找到返回 -1。', insertText: '文本_寻找("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '目标', type: 'wideString' }], returnType: 'int', example: '文本_寻找("中文编程", "编程")' },
    { name: '文本_是否包含', signature: '文本_是否包含(文本, 目标)', description: '判断文本是否包含目标内容。', insertText: '文本_是否包含("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '目标', type: 'wideString' }], returnType: 'bool' },
    { name: '文本_开头为', signature: '文本_开头为(文本, 前缀)', description: '判断文本是否以指定前缀开头。', insertText: '文本_开头为("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '前缀', type: 'wideString' }], returnType: 'bool' },
    { name: '文本_结尾为', signature: '文本_结尾为(文本, 后缀)', description: '判断文本是否以指定后缀结尾。', insertText: '文本_结尾为("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '后缀', type: 'wideString' }], returnType: 'bool' },
    { name: '文本_取中间', signature: '文本_取中间(文本, 起始位置, 长度)', description: '按从 0 开始的索引截取文本，超出范围时安全截断。', insertText: '文本_取中间("$1", 0, 1)', parameters: [{ name: '文本', type: 'wideString' }, { name: '起始位置', type: 'int' }, { name: '长度', type: 'int' }], returnType: 'wideString' },
    { name: '文本_替换', signature: '文本_替换(文本, 查找内容, 替换内容)', description: '替换文本中的全部匹配内容。', insertText: '文本_替换("$1", "$2", "$3")', parameters: [{ name: '文本', type: 'wideString' }, { name: '查找内容', type: 'wideString' }, { name: '替换内容', type: 'wideString' }], returnType: 'wideString' },
    { name: '文本_删首尾空白', signature: '文本_删首尾空白(文本)', description: '删除文本首尾的 Unicode 空白字符。', insertText: '文本_删首尾空白("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '文本_转大写', signature: '文本_转大写(文本)', description: '把文本转换为大写。', insertText: '文本_转大写("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '文本_转小写', signature: '文本_转小写(文本)', description: '把文本转换为小写。', insertText: '文本_转小写("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' }
  ]
});

const bytesModule = createStandardModule({
  id: 'lingbuilder.std.bytes',
  name: '字节与十六进制模块',
  category: '其他',
  description: '通过安全文本接口提供 UTF-8 字节长度与十六进制编解码，不暴露裸内存指针。',
  tags: ['字节', '十六进制'],
  commands: [
    { name: '字节_UTF8长度', signature: '字节_UTF8长度(文本)', description: '返回文本编码为 UTF-8 后的字节数。', insertText: '字节_UTF8长度("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'int', example: '字节_UTF8长度("中文")' },
    { name: '字节_文本转十六进制', signature: '字节_文本转十六进制(文本)', description: '把文本的 UTF-8 字节转换为大写十六进制文本。', insertText: '字节_文本转十六进制("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString', example: '字节_文本转十六进制("Ling")' },
    { name: '字节_十六进制转文本', signature: '字节_十六进制转文本(十六进制)', description: '把十六进制字节文本按 UTF-8 解码，格式错误返回空文本。', insertText: '字节_十六进制转文本("$1")', parameters: [{ name: '十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '字节_十六进制是否有效', signature: '字节_十六进制是否有效(十六进制)', description: '判断文本是否由偶数个十六进制字符组成。', insertText: '字节_十六进制是否有效("$1")', parameters: [{ name: '十六进制', type: 'wideString' }], returnType: 'bool' }
  ]
});

const encodingModule = createStandardModule({
  id: 'lingbuilder.std.encoding',
  name: '编码转换模块',
  category: '其他',
  description: '通过十六进制字节文本安全提供 UTF-8、UTF-16、UTF-32、ANSI、GBK、GB2312、GB18030、BOM、Base64、URL 与 HTML 编解码。',
  tags: ['编码', 'Unicode', 'UTF-8', 'GBK', 'Base64', 'URL'],
  commands: [
    { name: '编码_文本转UTF8', signature: '编码_文本转UTF8(文本)', description: '把 Unicode 文本编码为 UTF-8 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF8("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString', example: '编码_文本转UTF8("你好")' },
    { name: '编码_UTF8转文本', signature: '编码_UTF8转文本(UTF8十六进制)', description: '把十六进制表示的 UTF-8 字节解码为 Unicode 文本；无效输入返回空文本。', insertText: '编码_UTF8转文本("$1")', parameters: [{ name: 'UTF8十六进制', type: 'wideString' }], returnType: 'wideString', example: '编码_UTF8转文本("E4BDA0E5A5BD")' },
    { name: '编码_文本转UTF16LE', signature: '编码_文本转UTF16LE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-16 LE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF16LE("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_UTF16LE转文本', signature: '编码_UTF16LE转文本(UTF16LE十六进制)', description: '把十六进制表示的 UTF-16 LE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。', insertText: '编码_UTF16LE转文本("$1")', parameters: [{ name: 'UTF16LE十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转UTF16BE', signature: '编码_文本转UTF16BE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-16 BE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF16BE("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_UTF16BE转文本', signature: '编码_UTF16BE转文本(UTF16BE十六进制)', description: '把十六进制表示的 UTF-16 BE 字节解码为 Unicode 文本；会识别并移除匹配的 BOM。', insertText: '编码_UTF16BE转文本("$1")', parameters: [{ name: 'UTF16BE十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转UTF32LE', signature: '编码_文本转UTF32LE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-32 LE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF32LE("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_UTF32LE转文本', signature: '编码_UTF32LE转文本(UTF32LE十六进制)', description: '把十六进制表示的 UTF-32 LE 字节解码为 Unicode 文本；无效码点返回空文本。', insertText: '编码_UTF32LE转文本("$1")', parameters: [{ name: 'UTF32LE十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转UTF32BE', signature: '编码_文本转UTF32BE(文本)', description: '把 Unicode 文本编码为不带 BOM 的 UTF-32 BE 字节，返回大写十六进制文本。', insertText: '编码_文本转UTF32BE("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_UTF32BE转文本', signature: '编码_UTF32BE转文本(UTF32BE十六进制)', description: '把十六进制表示的 UTF-32 BE 字节解码为 Unicode 文本；无效码点返回空文本。', insertText: '编码_UTF32BE转文本("$1")', parameters: [{ name: 'UTF32BE十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转ANSI', signature: '编码_文本转ANSI(文本)', description: '按当前 Windows 系统 ANSI 代码页编码文本，返回大写十六进制字节；无法无损表示时返回空文本。', insertText: '编码_文本转ANSI("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_ANSI转文本', signature: '编码_ANSI转文本(ANSI十六进制)', description: '按当前 Windows 系统 ANSI 代码页解码十六进制字节。', insertText: '编码_ANSI转文本("$1")', parameters: [{ name: 'ANSI十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转GBK', signature: '编码_文本转GBK(文本)', description: '按 Windows CP936 把文本编码为 GBK 字节，返回大写十六进制文本；无法无损表示时返回空文本。', insertText: '编码_文本转GBK("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_GBK转文本', signature: '编码_GBK转文本(GBK十六进制)', description: '按 Windows CP936 解码十六进制表示的 GBK 字节。', insertText: '编码_GBK转文本("$1")', parameters: [{ name: 'GBK十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转GB2312', signature: '编码_文本转GB2312(文本)', description: '把文本编码为严格 GB2312 双字节范围，返回大写十六进制文本；GBK 扩展字符或无法表示的字符返回空文本。', insertText: '编码_文本转GB2312("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_GB2312转文本', signature: '编码_GB2312转文本(GB2312十六进制)', description: '校验 GB2312 字节范围后按 Windows CP936 解码为 Unicode 文本。', insertText: '编码_GB2312转文本("$1")', parameters: [{ name: 'GB2312十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_文本转GB18030', signature: '编码_文本转GB18030(文本)', description: '按 Windows CP54936 把文本编码为 GB18030 字节，返回大写十六进制文本。', insertText: '编码_文本转GB18030("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_GB18030转文本', signature: '编码_GB18030转文本(GB18030十六进制)', description: '按 Windows CP54936 解码十六进制表示的 GB18030 字节。', insertText: '编码_GB18030转文本("$1")', parameters: [{ name: 'GB18030十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_转换', signature: '编码_转换(字节十六进制, 来源编码, 目标编码)', description: '在支持的字符编码间转换十六进制字节；编码名支持 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030。输出不自动添加 BOM。', insertText: '编码_转换("$1", "UTF-8", "UTF-16LE")', parameters: [{ name: '字节十六进制', type: 'wideString' }, { name: '来源编码', type: 'wideString' }, { name: '目标编码', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_添加BOM', signature: '编码_添加BOM(字节十六进制, 编码名称)', description: '为 UTF-8、UTF-16LE/BE 或 UTF-32LE/BE 十六进制字节添加匹配 BOM；已有 BOM 不重复添加。', insertText: '编码_添加BOM("$1", "UTF-8")', parameters: [{ name: '字节十六进制', type: 'wideString' }, { name: '编码名称', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_删除BOM', signature: '编码_删除BOM(字节十六进制)', description: '识别并删除 UTF-8、UTF-16 或 UTF-32 BOM，返回剩余大写十六进制字节。', insertText: '编码_删除BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_是否有BOM', signature: '编码_是否有BOM(字节十六进制)', description: '判断十六进制字节是否以受支持的 BOM 开头。', insertText: '编码_是否有BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString' }], returnType: 'bool' },
    { name: '编码_检测BOM', signature: '编码_检测BOM(字节十六进制)', description: '根据 BOM 返回 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE 或 UTF-32BE；没有 BOM 返回空文本。', insertText: '编码_检测BOM("$1")', parameters: [{ name: '字节十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_检测', signature: '编码_检测(字节十六进制)', description: '先检测 BOM；无 BOM 时仅在字节是严格 UTF-8 时返回 UTF-8，否则返回“未知”，不猜测 ANSI 或中文代码页。', insertText: '编码_检测("$1")', parameters: [{ name: '字节十六进制', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_Base64编码', signature: '编码_Base64编码(文本)', description: '将 Unicode 文本按 UTF-8 编码为 Base64。', insertText: '编码_Base64编码("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString', example: '编码_Base64编码("你好")' },
    { name: '编码_Base64解码', signature: '编码_Base64解码(Base64文本)', description: '将 Base64 解码为 UTF-8 文本，格式错误返回空文本。', insertText: '编码_Base64解码("$1")', parameters: [{ name: 'Base64文本', type: 'wideString' }], returnType: 'wideString', example: '编码_Base64解码("5L2g5aW9")' },
    { name: '编码_URL编码', signature: '编码_URL编码(文本)', description: '按 UTF-8 对 URL 参数内容进行百分号编码。', insertText: '编码_URL编码("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_URL解码', signature: '编码_URL解码(文本)', description: '解码 URL 百分号编码和加号空格。', insertText: '编码_URL解码("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_HTML转义', signature: '编码_HTML转义(文本)', description: '转义 HTML 中的与号、尖括号、引号和单引号。', insertText: '编码_HTML转义("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: '编码_HTML反转义', signature: '编码_HTML反转义(文本)', description: '还原本模块支持的常用 HTML 实体。', insertText: '编码_HTML反转义("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' }
  ]
});

const mathModule = createStandardModule({
  id: 'lingbuilder.std.math',
  name: '数学与随机模块',
  category: '其他',
  description: '提供常用数学函数、范围限制和线程安全随机整数。',
  tags: ['数学', '随机'],
  commands: [
    { name: '数学_绝对值', signature: '数学_绝对值(数值)', description: '返回数值的绝对值。', insertText: '数学_绝对值(0)', parameters: [{ name: '数值', type: 'double' }], returnType: 'double', example: '数学_绝对值(-3.14)' },
    { name: '数学_最小值', signature: '数学_最小值(数值一, 数值二)', description: '返回两个数值中的较小值。', insertText: '数学_最小值(0, 1)', parameters: [{ name: '数值一', type: 'double' }, { name: '数值二', type: 'double' }], returnType: 'double' },
    { name: '数学_最大值', signature: '数学_最大值(数值一, 数值二)', description: '返回两个数值中的较大值。', insertText: '数学_最大值(0, 1)', parameters: [{ name: '数值一', type: 'double' }, { name: '数值二', type: 'double' }], returnType: 'double' },
    { name: '数学_限制范围', signature: '数学_限制范围(数值, 最小值, 最大值)', description: '将数值限制在指定闭区间内。', insertText: '数学_限制范围(0, 0, 100)', parameters: [{ name: '数值', type: 'double' }, { name: '最小值', type: 'double' }, { name: '最大值', type: 'double' }], returnType: 'double' },
    { name: '数学_平方根', signature: '数学_平方根(数值)', description: '返回非负数值的平方根，负数返回 0。', insertText: '数学_平方根(0)', parameters: [{ name: '数值', type: 'double' }], returnType: 'double' },
    { name: '数学_乘方', signature: '数学_乘方(底数, 指数)', description: '返回底数的指定次方。', insertText: '数学_乘方(2, 8)', parameters: [{ name: '底数', type: 'double' }, { name: '指数', type: 'double' }], returnType: 'double' },
    { name: '数学_随机整数', signature: '数学_随机整数(最小值, 最大值)', description: '返回指定闭区间内的随机整数，参数顺序可交换。', insertText: '数学_随机整数(1, 100)', parameters: [{ name: '最小值', type: 'int' }, { name: '最大值', type: 'int' }], returnType: 'int', example: '数学_随机整数(1, 100)' }
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
    { name: '时间_格式化当前', signature: '时间_格式化当前(格式)', description: '使用 wcsftime 格式格式化当前本地时间。', insertText: '时间_格式化当前("%Y-%m-%d %H:%M:%S")', parameters: [{ name: '格式', type: 'wideString' }], returnType: 'wideString' },
    { name: '时间_格式化时间戳', signature: '时间_格式化时间戳(时间戳, 格式)', description: '格式化指定 Unix 秒级时间戳。', insertText: '时间_格式化时间戳(0, "%Y-%m-%d %H:%M:%S")', parameters: [{ name: '时间戳', type: 'longLong' }, { name: '格式', type: 'wideString' }], returnType: 'wideString' }
  ]
});

const regexModule = createStandardModule({
  id: 'lingbuilder.std.regex',
  name: '正则表达式模块',
  category: '其他',
  description: '基于 C++ ECMAScript 正则语法提供匹配、查找和替换；非法表达式安全返回失败。',
  tags: ['正则', '文本'],
  commands: [
    { name: '正则_完全匹配', signature: '正则_完全匹配(文本, 表达式)', description: '判断整个文本是否匹配表达式。', insertText: '正则_完全匹配("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '表达式', type: 'wideString' }], returnType: 'bool', example: '正则_完全匹配("123", "[0-9]+")' },
    { name: '正则_是否包含', signature: '正则_是否包含(文本, 表达式)', description: '判断文本中是否存在匹配内容。', insertText: '正则_是否包含("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '表达式', type: 'wideString' }], returnType: 'bool' },
    { name: '正则_取首个', signature: '正则_取首个(文本, 表达式)', description: '返回首个匹配文本，没有匹配或表达式非法时返回空文本。', insertText: '正则_取首个("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '表达式', type: 'wideString' }], returnType: 'wideString' },
    { name: '正则_替换', signature: '正则_替换(文本, 表达式, 替换内容)', description: '替换全部正则匹配。', insertText: '正则_替换("$1", "$2", "$3")', parameters: [{ name: '文本', type: 'wideString' }, { name: '表达式', type: 'wideString' }, { name: '替换内容', type: 'wideString' }], returnType: 'wideString' },
    { name: '正则_匹配数量', signature: '正则_匹配数量(文本, 表达式)', description: '返回不重叠匹配数量。', insertText: '正则_匹配数量("$1", "$2")', parameters: [{ name: '文本', type: 'wideString' }, { name: '表达式', type: 'wideString' }], returnType: 'int' }
  ]
});

const jsonModule = createStandardModule({
  id: 'lingbuilder.data.json',
  name: 'JSON 数据模块',
  category: '其他',
  description: '提供无第三方依赖的 JSON 合法性检查、字符串转义和顶层对象字段读取。',
  tags: ['数据', 'JSON'],
  commands: [
    { name: 'JSON_是否有效', signature: 'JSON_是否有效(JSON文本)', description: '严格检查 JSON 文本语法是否完整有效。', insertText: 'JSON_是否有效("$1")', parameters: [{ name: 'JSON文本', type: 'wideString' }], returnType: 'bool', example: 'JSON_是否有效("{\\"name\\":\\"LingBuilder\\"}")' },
    { name: 'JSON_转义文本', signature: 'JSON_转义文本(文本)', description: '把普通文本转义为可放入 JSON 字符串的内容，不包含外层引号。', insertText: 'JSON_转义文本("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: 'JSON_取文本', signature: 'JSON_取文本(JSON文本, 字段名)', description: '读取顶层对象中的字符串字段，缺失或类型不符返回空文本。', insertText: 'JSON_取文本("$1", "$2")', parameters: [{ name: 'JSON文本', type: 'wideString' }, { name: '字段名', type: 'wideString' }], returnType: 'wideString' },
    { name: 'JSON_取整数', signature: 'JSON_取整数(JSON文本, 字段名, 默认值)', description: '读取顶层对象中的整数，缺失或类型不符返回默认值。', insertText: 'JSON_取整数("$1", "$2", 0)', parameters: [{ name: 'JSON文本', type: 'wideString' }, { name: '字段名', type: 'wideString' }, { name: '默认值', type: 'int' }], returnType: 'int' },
    { name: 'JSON_取逻辑', signature: 'JSON_取逻辑(JSON文本, 字段名, 默认值)', description: '读取顶层对象中的逻辑值，缺失或类型不符返回默认值。', insertText: 'JSON_取逻辑("$1", "$2", 假)', parameters: [{ name: 'JSON文本', type: 'wideString' }, { name: '字段名', type: 'wideString' }, { name: '默认值', type: 'bool' }], returnType: 'bool' }
  ]
});

const xmlModule = createStandardModule({
  id: 'lingbuilder.data.xml',
  name: 'XML 文本模块',
  category: '其他',
  description: '提供 XML 文本转义、节点生成和简单节点内容读取，不执行外部实体。',
  tags: ['数据', 'XML'],
  commands: [
    { name: 'XML_转义文本', signature: 'XML_转义文本(文本)', description: '转义 XML 文本节点中的特殊字符。', insertText: 'XML_转义文本("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString', example: 'XML_转义文本("<中文>")' },
    { name: 'XML_反转义文本', signature: 'XML_反转义文本(文本)', description: '还原本模块支持的五种预定义 XML 实体。', insertText: 'XML_反转义文本("$1")', parameters: [{ name: '文本', type: 'wideString' }], returnType: 'wideString' },
    { name: 'XML_生成节点', signature: 'XML_生成节点(节点名, 内容)', description: '生成包含安全转义文本的简单 XML 节点；非法节点名返回空文本。', insertText: 'XML_生成节点("$1", "$2")', parameters: [{ name: '节点名', type: 'wideString' }, { name: '内容', type: 'wideString' }], returnType: 'wideString' },
    { name: 'XML_是否包含节点', signature: 'XML_是否包含节点(XML文本, 节点名)', description: '判断 XML 文本是否包含指定简单节点。', insertText: 'XML_是否包含节点("$1", "$2")', parameters: [{ name: 'XML文本', type: 'wideString' }, { name: '节点名', type: 'wideString' }], returnType: 'bool' },
    { name: 'XML_取节点文本', signature: 'XML_取节点文本(XML文本, 节点名)', description: '读取第一个指定简单节点的文本内容并反转义。', insertText: 'XML_取节点文本("$1", "$2")', parameters: [{ name: 'XML文本', type: 'wideString' }, { name: '节点名', type: 'wideString' }], returnType: 'wideString' }
  ]
});

export const STANDARD_LIBRARY_MODULES: LingBuilderModuleManifest[] = [
  textModule,
  bytesModule,
  encodingModule,
  mathModule,
  datetimeModule,
  regexModule,
  jsonModule,
  xmlModule
];

export const STANDARD_LIBRARY_MODULE_IDS = new Set(STANDARD_LIBRARY_MODULES.map(module => module.id));
