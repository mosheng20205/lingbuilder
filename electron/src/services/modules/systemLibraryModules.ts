import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';
import { DISK_COMMANDS, DISK_PUBLIC_TYPES } from './diskApiCatalog';
import { KEYBOARD_COMMANDS } from './keyboardApiCatalog';
import { MOUSE_COMMANDS } from './mouseApiCatalog';

type Parameter = {
  name: string;
  type: ModuleBindingValueType;
  description: string;
  optional?: boolean;
  defaultValue?: string | number | boolean | null;
  variadic?: boolean;
  byRef?: boolean;
};

// 以下说明按 src/services/windowDesigner/systemLibraryRuntime.ts 的实际边界行为核实，
// 重复语义（文件路径、写入内容、覆盖开关、注册表子键、窗口句柄、命令行）提取为共享常量。
const filePathArg = '文件或目录的 Unicode 路径，允许相对路径，运行时按当前工作目录解析。';
const writePathArg = '要写入的文件路径；所在目录必须已存在，打不开文件时返回假。';
const utf8ContentArg = '要写入的文本，按 UTF-8 编码落盘且不附加 BOM；空文本写入空内容。';
const overwriteArg = '传真时已存在的目标会被覆盖，传假时目标已存在则操作失败返回假。';
const iniFileArg = 'INI 文件路径；相对路径会先转成绝对路径再读写，文件不存在时读取返回默认值。';
const iniSectionArg = '中括号里的节名，不含方括号，必须与文件中的节名一致。';
const iniKeyArg = '节内的键名，等号左侧的部分。';
const regSubkeyArg = 'HKEY_CURRENT_USER 下的子键路径，不带根键名前缀；写入时子键不存在会自动创建。';
const regValueNameArg = '子键下的值名称；读文本只接受 REG_SZ 与 REG_EXPAND_SZ，读整数只接受 REG_DWORD。';
const hwndArg = '目标窗口的原生窗口句柄，可来自 窗口_按标题查找 或控件的窗口句柄；句柄已失效时命令返回假。';
const commandLineArg = '完整的命令行文本，含可执行文件和参数，不能为空；路径中有空格时必须用双引号包住该段。';
const workDirArg = '新进程的当前工作目录；空文本表示沿用本进程的工作目录。';
const fileHandleArg = '文件_打开 返回的文件号；句柄无效或文件已关闭时命令按说明返回失败值。';
const fileTextLengthArg = '要读取的字节数；小于 0 表示读取到文件末尾，实际读到的内容可能少于请求数量。';

function command(
  name: string,
  parameters: Parameter[],
  returnType: ModuleBindingValueType,
  description: string,
  example?: string,
  options?: { insertText?: string; returnLabel?: string }
): StandardCommandSpec {
  const placeholders = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? index === 0 ? '真' : '假' : '0');
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: options?.insertText || `${name}(${placeholders.join(', ')})`,
    parameters,
    returnType,
    returnLabel: options?.returnLabel,
    example
  };
}

const fsCore = createStandardModule({
  id: 'lingbuilder.fs.core', name: '文件目录模块', version: '1.1.0', category: '系统',
  description: '提供 UTF-8 文本文件、常用文件目录操作、句柄式文件流读写和文件目录枚举，所有路径均使用 Unicode。',
  tags: ['文件', '目录'],
  types: [{
    name: '文件号',
    description: '文件_打开 返回的文件流句柄（64 位、进程内不复用），0 表示打开失败；用 文件_关闭 或 文件_关闭全部 释放。',
    cppType: 'long long'
  }],
  commands: [
    command('文件_是否存在', [{ name: '路径', type: 'wideString', description: '要判断的 Unicode 路径；只有普通文件返回真，目录、不存在或非法路径都返回假。'}], 'bool', '判断指定路径是否为普通文件。', '文件_是否存在("配置.json")'),
    command('目录_是否存在', [{ name: '路径', type: 'wideString', description: '要判断的 Unicode 路径；只有真实目录返回真，文件和不存在路径返回假。'}], 'bool', '判断指定路径是否为目录。'),
    command('文件_读取文本', [{ name: '路径', type: 'wideString', description: '要读取的文件路径；打不开时返回空文本。整文件按 UTF-8 严格解码，开头的 UTF-8 BOM 自动剥离，不做其它编码猜测。'}], 'wideString', '按 UTF-8 读取完整文本；失败返回空文本。'),
    command('文件_写入文本', [{ name: '路径', type: 'wideString', description: writePathArg}, { name: '内容', type: 'wideString', description: utf8ContentArg}], 'bool', '按 UTF-8 覆盖写入文本文件。'),
    command('文件_追加文本', [{ name: '路径', type: 'wideString', description: '要追加的文件路径；所在目录必须已存在，文件不存在时会自动新建。'}, { name: '内容', type: 'wideString', description: '追加到文件末尾的文本，按 UTF-8 编码且不附加 BOM。'}], 'bool', '按 UTF-8 向文件末尾追加文本。'),
    command('文件_复制', [{ name: '来源', type: 'wideString', description: '要复制的源文件路径，必须是已存在的普通文件。'}, { name: '目标', type: 'wideString', description: '复制得到的目标路径。'}, { name: '允许覆盖', type: 'bool', description: overwriteArg}], 'bool', '复制文件并可选择是否覆盖。'),
    command('文件_移动', [{ name: '来源', type: 'wideString', description: '要移动或重命名的源路径，文件和目录都可以。'}, { name: '目标', type: 'wideString', description: '移动后的目标路径；跨卷移动可能失败返回假。'}, { name: '允许覆盖', type: 'bool', description: overwriteArg}], 'bool', '移动或重命名文件。'),
    command('文件_删除', [{ name: '路径', type: 'wideString', description: '要删除的文件路径；只有普通文件会被删除，目录返回假。'}], 'bool', '删除一个普通文件。'),
    command('文件_取大小', [{ name: '路径', type: 'wideString', description: '要统计的文件路径；路径不存在或不是文件时返回 -1。'}], 'longLong', '返回文件字节数，失败返回 -1。'),
    command('目录_创建', [{ name: '路径', type: 'wideString', description: '要创建的目录路径；缺失的父目录会逐级一起创建，目录已存在也算成功返回真。'}], 'bool', '递归创建目录；目录已经存在也返回真。'),
    command('目录_删除空目录', [{ name: '路径', type: 'wideString', description: '要删除的目录路径；目录内仍有条目时返回假，不会递归删除内容。'}], 'bool', '只删除空目录，不执行递归删除。')
,
    command('文件_打开', [
      { name: '路径', type: 'wideString', description: '要打开的文件路径；路径为空或打不开时返回 0。'},
      { name: '打开方式', type: 'int', optional: true, defaultValue: 3, description: '对文件的操作方式，对齐易语言编号：1 读入（不存在则失败）、2 写出（不存在则失败）、3 读写（不存在则失败）、4 重写（清空后写入，不存在则新建）、5 改写（不存在则新建，保留已有内容）、6 改读（读写，不存在则新建）；省略默认 3。'},
      { name: '共享方式', type: 'int', optional: true, defaultValue: 1, description: '限制其它进程操作此文件的方式：1 无限制、2 禁止其它进程写、3 禁止其它进程读、4 禁止其它进程读写；省略默认 1。'}
    ], 'longLong', '打开一个普通文件供句柄式读写，成功返回文件号，失败返回 0。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_关闭(号)', { returnLabel: '文件号' }),
    command('文件_关闭', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'void', '关闭被打开的文件并释放文件号；句柄无效时不产生任何效果。', '局部 文件号 号\n号 = 文件_打开("data.txt", 3, 1)\n文件_关闭(号)', { insertText: '文件_关闭($1)' }),
    command('文件_关闭全部', [], 'void', '关闭当前进程内所有被打开的文件。程序退出前调用可以确保数据落盘。', '文件_关闭全部()', { insertText: '文件_关闭全部()' }),
    command('文件_移动读写位置', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '移动距离', type: 'longLong', description: '相对于起始位置的移动字节数，可为负表示向文件首方向移动。'},
      { name: '起始位置', type: 'int', optional: true, defaultValue: 1, description: '移动的基准位置：1 文件首、2 文件尾、3 现行位置；省略默认 1。'}
    ], 'bool', '在打开的文件中设置下一次读写的位置；成功返回真，文件号无效或基准位置非法返回假。', '局部 文件号 号\n号 = 文件_打开("data.txt", 3, 1)\n文件_移动读写位置(号, 0, 2)', { insertText: '文件_移动读写位置($1, 0, 1)' }),
    command('文件_移到文件首', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'bool', '把读写位置移到文件首；成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 3, 1)\n文件_移到文件首(号)', { insertText: '文件_移到文件首($1)' }),
    command('文件_移到文件尾', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'bool', '把读写位置移到文件尾；成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_移到文件尾(号)', { insertText: '文件_移到文件尾($1)' }),
    command('文件_读入字节集', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '长度', type: 'int', description: '要读取的字节数；剩余内容不足时只返回剩余部分，到文件尾后返回空字节集。'}
    ], 'bytes', '从文件当前读写位置读取字节集；失败或已到文件尾返回空字节集。', '局部 文件号 号\n号 = 文件_打开("data.bin", 1, 1)', { insertText: '文件_读入字节集($1, 4)' }),
    command('文件_写出字节集', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '数据', type: 'bytes', description: '要写出的字节集，在当前读写位置写入，空字节集不写任何内容。'}
    ], 'bool', '把字节集写到文件当前读写位置；成功返回真，以只读方式打开的文件返回假。', '局部 文件号 号\n号 = 文件_打开("data.bin", 6, 1)\n文件_移到文件尾(号)', { insertText: '文件_写出字节集($1, $2)' }),
    command('文件_读入文本', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '长度', type: 'longLong', optional: true, defaultValue: -1, description: fileTextLengthArg + '省略或小于 0 表示读取到文件末尾。'}
    ], 'wideString', '从文件当前读写位置读取文本（内容按 UTF-8 解码）；失败返回空文本。', '局部 文件号 号\n号 = 文件_打开("data.txt", 1, 1)\n文件_移到文件首(号)', { insertText: '文件_读入文本($1, -1)' }),
    command('文件_写出文本', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '文本', type: 'wideString', description: '要写出的文本，按 UTF-8 编码写入当前读写位置，不自动追加换行。'}
    ], 'bool', '把文本写到文件当前读写位置；成功返回真，以只读方式打开的文件返回假。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_移到文件尾(号)', { insertText: '文件_写出文本($1, "$2")' }),
    command('文件_读入一行', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'wideString', '从文件当前读写位置读取一行文本，行尾回车换行符被抛弃（按 UTF-8 解码）；已到文件尾返回空文本。', '局部 文件号 号\n号 = 文件_打开("data.txt", 1, 1)\n文件_移到文件首(号)', { insertText: '文件_读入一行($1)' }),
    command('文件_写文本行', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '文本', type: 'wideString', description: '要写出的整行文本，行尾自动补回车换行符（CRLF）。'}
    ], 'bool', '把一行文本写到文件当前读写位置并自动换行；成功返回真。', '局部 文件号 号\n号 = 文件_打开("log.txt", 6, 1)\n文件_移到文件尾(号)', { insertText: '文件_写文本行($1, "$2")' }),
    command('文件_读入数据', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '变量', type: 'lingValue', variadic: true, byRef: true, description: '一个或多个接收数据的变量，按书写顺序依次读取；支持整数型、长整数型、小数型、逻辑型、文本型（UTF-8 加 0 结尾）和字节集（4 字节长度前缀）格式，必须与 文件_写出数据 的写出顺序一致。'}
    ], 'bool', '从文件当前读写位置按 文件_写出数据 的格式依次读出多个值到变量；成功返回真，数据不足或类型不匹配返回假。', '局部 文件号 号\n号 = 文件_打开("data.bin", 1, 1)', { insertText: '文件_读入数据($1, $0)' }),
    command('文件_写出数据', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '数据', type: 'lingValue', variadic: true, description: '一个或多个要写出的值：整数 4 字节、长整数 8 字节、小数 8 字节、逻辑值 1 字节（均小端），文本按 UTF-8 加 0 结尾，字节集为 4 字节长度前缀加数据，数组按元素顺序展开。'}
    ], 'bool', '把多个值按固定二进制格式写到文件当前读写位置，供 文件_读入数据 读回；成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.bin", 6, 1)', { insertText: '文件_写出数据($1, $0)' }),
    command('文件_是否在文件尾', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'bool', '判断文件当前读写位置是否已处于数据尾部；是返回真，无效文件号也返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 1, 1)\n文件_移到文件尾(号)', { insertText: '文件_是否在文件尾($1)' }),
    command('文件_取读写位置', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'longLong', '返回文件当前读写位置（从 0 起）；文件号无效返回 -1。', '局部 文件号 号\n号 = 文件_打开("data.txt", 3, 1)', { insertText: '文件_取读写位置($1)' }),
    command('文件_取长度', [{ name: '文件号', type: 'longLong', description: fileHandleArg}], 'longLong', '返回打开文件的字节长度；文件号无效返回 -1。与按路径取大小的 文件_取大小 不同，本命令作用于已打开的文件。', '局部 文件号 号\n号 = 文件_打开("data.txt", 3, 1)', { insertText: '文件_取长度($1)' }),
    command('文件_插入字节集', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '数据', type: 'bytes', description: '要插入的字节集，插入点之后的原有内容整体后移。'}
    ], 'bool', '在文件当前读写位置插入字节集（要求以可写方式打开）；插入后读写位置回到插入内容首部，成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.bin", 6, 1)\n文件_移到文件首(号)', { insertText: '文件_插入字节集($1, $2)' }),
    command('文件_插入文本', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '文本', type: 'wideString', description: '要插入的文本，按 UTF-8 编码插入，插入点之后的原有内容整体后移。'}
    ], 'bool', '在文件当前读写位置插入文本（要求以可写方式打开）；插入后读写位置回到插入内容首部，成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_移到文件首(号)', { insertText: '文件_插入文本($1, "$2")' }),
    command('文件_插入文本行', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '文本', type: 'wideString', description: '要插入的整行文本，行尾自动补回车换行符，插入点之后的原有内容整体后移。'}
    ], 'bool', '在文件当前读写位置插入一行文本（要求以可写方式打开）；插入后读写位置回到插入内容首部，成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_移到文件首(号)', { insertText: '文件_插入文本行($1, "$2")' }),
    command('文件_删除数据', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '字节数', type: 'longLong', description: '从当前读写位置起删除的字节数；超出文件剩余内容时删除到文件尾，不能为负。'}
    ], 'bool', '在文件当前读写位置删除一段数据，后续内容顺序前移（要求以可写方式打开）；成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)\n文件_移到文件首(号)', { insertText: '文件_删除数据($1, 4)' }),
    command('文件_锁定', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '位置', type: 'longLong', description: '加锁区域的起始字节位置，从 0 起；不能为负。'},
      { name: '长度', type: 'longLong', description: '加锁区域的字节长度；不能为负。'},
      { name: '重试毫秒', type: 'int', optional: true, defaultValue: 0, description: '加锁失败后的重试毫秒数；0 表示失败立即返回（省略时同为 0），-1 表示一直重试直到成功，其它正值在时限内每 10 毫秒重试一次。'}
    ], 'bool', '拒绝其它进程读写文件指定区域，用于多进程共享文件；成功返回真。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)', { insertText: '文件_锁定($1, 0, 16, 0)' }),
    command('文件_解锁', [
      { name: '文件号', type: 'longLong', description: fileHandleArg},
      { name: '位置', type: 'longLong', description: '解锁区域的起始字节位置；必须与 文件_锁定 时完全一致。'},
      { name: '长度', type: 'longLong', description: '解锁区域的字节长度；必须与 文件_锁定 时完全一致。'}
    ], 'bool', '解除 文件_锁定 加上的区域锁；参数必须与加锁时完全一致才会成功。', '局部 文件号 号\n号 = 文件_打开("data.txt", 6, 1)', { insertText: '文件_解锁($1, 0, 16)' }),
    command('文件_枚举', [
      { name: '目录', type: 'wideString', description: '要枚举的目录路径；目录不存在时返回 0。'},
      { name: '通配符', type: 'wideString', description: '文件名匹配模式，支持 * 和 ? 通配符，例如 "*.txt"；空文本匹配全部文件。只按文件名匹配，不含目录前缀。'},
      { name: '含子目录', type: 'bool', description: '传真时递归枚举全部子目录下的匹配文件，传假只枚举当前一层。'},
      { name: '结果数组', type: 'array', description: '接收匹配文件完整路径的文本数组变量，调用前会先清空原有内容；结果不保证排序。'}
    ], 'int', '枚举目录下的文件（含隐藏、系统文件），返回命中数量。', '局部 文本型 名单[]\n文件_枚举("日志目录", "*.txt", 真, 名单)', { insertText: '文件_枚举("$1", "*.txt", 真, $4)' }),
    command('目录_枚举', [
      { name: '目录', type: 'wideString', description: '要枚举的目录路径；目录不存在时返回 0。'},
      { name: '含子目录', type: 'bool', description: '传真时递归枚举全部下级子目录，传假只枚举当前一层的直接子目录。'},
      { name: '结果数组', type: 'array', description: '接收子目录完整路径的文本数组变量，调用前会先清空原有内容；结果不保证排序。'}
    ], 'int', '枚举目录下的子目录，返回命中数量。', '局部 文本型 名单[]\n目录_枚举("工作目录", 假, 名单)', { insertText: '目录_枚举("$1", 假, $3)' })
  ]
});

const fsPath = createStandardModule({
  id: 'lingbuilder.fs.path', name: '路径处理模块', category: '系统',
  description: '提供不访问或少量访问文件系统的路径组合、规范化和组成部分读取。', tags: ['文件', '路径'],
  commands: [
    command('路径_合并', [{ name: '基础路径', type: 'wideString', description: '路径的前半段。'}, { name: '子路径', type: 'wideString', description: '接在后面的子路径；为绝对路径时会直接替换前半段，结果已做词法规范化。'}], 'wideString', '组合两个路径并进行词法规范化。', '路径_合并("数据", "配置.json")'),
    command('路径_取文件名', [{ name: '路径', type: 'wideString', description: '要取末段的路径；以分隔符结尾时返回空文本。'}], 'wideString', '返回路径中的文件名。'),
    command('路径_取目录', [{ name: '路径', type: 'wideString', description: '要取父目录的路径；只有一段时返回空文本。'}], 'wideString', '返回路径中的父目录。'),
    command('路径_取扩展名', [{ name: '路径', type: 'wideString', description: '要取后缀的路径；返回值含前导点号，没有后缀时返回空文本。'}], 'wideString', '返回包含点号的文件扩展名。'),
    command('路径_改扩展名', [{ name: '路径', type: 'wideString', description: '待改后缀的路径，纯词法处理，不校验文件是否存在。'}, { name: '新扩展名', type: 'wideString', description: '新的扩展名，含前导点号例如 .txt；空文本表示去掉原有扩展名。'}], 'wideString', '替换文件扩展名。'),
    command('路径_转绝对路径', [{ name: '路径', type: 'wideString', description: '要转换的路径；相对路径以当前工作目录为基准，无法解析时返回空文本。'}], 'wideString', '以当前工作目录为基准生成绝对路径。'),
    command('路径_规范化', [{ name: '路径', type: 'wideString', description: '要规范化的路径；只做词法整理，去掉点段和冗余分隔符，不访问文件系统。'}], 'wideString', '移除路径中的点段并规范分隔结构。')
  ]
});

const ini = createStandardModule({
  id: 'lingbuilder.config.ini', name: 'INI 配置模块', category: '系统',
  description: '使用 Windows Unicode 配置 API 读取和写入 INI 文件。', tags: ['配置', 'INI'],
  commands: [
    command('INI_读文本', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: iniSectionArg}, { name: '键', type: 'wideString', description: iniKeyArg}, { name: '默认值', type: 'wideString', description: '键或文件不存在时返回的兜底文本，可以传空文本；读取缓冲区上限 32768 字符。'}], 'wideString', '读取 INI 文本值。'),
    command('INI_读整数', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: iniSectionArg}, { name: '键', type: 'wideString', description: iniKeyArg}, { name: '默认值', type: 'int', description: '取不到值或值不是十进制整数时返回的兜底整数。'}], 'int', '读取 INI 整数值。'),
    command('INI_写文本', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: iniSectionArg}, { name: '键', type: 'wideString', description: iniKeyArg}, { name: '值', type: 'wideString', description: '写入的文本值，落在等号右边；含换行会破坏 INI 结构，应避免。'}], 'bool', '写入 INI 文本值。'),
    command('INI_写整数', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: iniSectionArg}, { name: '键', type: 'wideString', description: iniKeyArg}, { name: '值', type: 'int', description: '写入的整数值，以十进制文本形式保存。'}], 'bool', '写入 INI 整数值。'),
    command('INI_删除键', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: iniSectionArg}, { name: '键', type: 'wideString', description: '要删除的键名；底层用写空值的方式删除该键。'}], 'bool', '删除指定 INI 键。'),
    command('INI_删除节', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: '要整节删除的节名；底层以空键名方式删除整节。'}], 'bool', '删除整个 INI 节。'),
    command('INI_枚举节', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '结果数组', type: 'array', description: '接收全部节名的文本型数组变量，调用前会先清空原有内容。'}], 'int', '把 INI 文件中的全部节名写入文本数组，返回节的数量。'),
    command('INI_枚举键', [{ name: '文件', type: 'wideString', description: iniFileArg}, { name: '节', type: 'wideString', description: '要枚举键名的节名。'}, { name: '结果数组', type: 'array', description: '接收该节全部键名的文本型数组变量，调用前会先清空原有内容。'}], 'int', '把指定节中的全部键名写入文本数组，返回键的数量。')
  ]
});

const registry = createStandardModule({
  id: 'lingbuilder.config.registry', name: '用户注册表模块', category: '系统',
  description: '只访问当前用户 HKEY_CURRENT_USER 下的注册表键值，避免默认要求管理员权限。', tags: ['配置', '注册表'],
  commands: [
    command('注册表_读文本', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: regValueNameArg}, { name: '默认值', type: 'wideString', description: '值不存在、类型不符或内容为空时返回的兜底文本。'}], 'wideString', '读取当前用户注册表字符串值。'),
    command('注册表_读整数', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: regValueNameArg}, { name: '默认值', type: 'int', description: '值不存在或不是 REG_DWORD 时返回的兜底整数。'}], 'int', '读取当前用户注册表 DWORD 值。'),
    command('注册表_写文本', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: '要写入的值名称。'}, { name: '值', type: 'wideString', description: '保存的字符串，以 REG_SZ 类型写入，读取时不做环境变量展开。'}], 'bool', '写入当前用户注册表字符串值。'),
    command('注册表_写整数', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: '要写入的值名称。'}, { name: '值', type: 'int', description: '保存的整数，以 REG_DWORD 类型写入。'}], 'bool', '写入当前用户注册表 DWORD 值。'),
    command('注册表_删除值', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: '要删除的值名称；子键本身保留。'}], 'bool', '删除当前用户注册表值。'),
    command('注册表_值是否存在', [{ name: '子键', type: 'wideString', description: regSubkeyArg}, { name: '值名', type: 'wideString', description: '要检查的值名称，任意数据类型都算存在。'}], 'bool', '判断当前用户注册表值是否存在。')
  ]
});

const systemInfo = createStandardModule({
  id: 'lingbuilder.system.info', name: '系统信息模块', category: '系统',
  description: '读取当前 Windows、计算机、用户、处理器和内存信息。', tags: ['系统信息'],
  commands: [
    command('系统_取用户名', [], 'wideString', '返回当前登录用户名。', '系统_取用户名()'),
    command('系统_取计算机名', [], 'wideString', '返回本机计算机名。'),
    command('系统_取Windows版本', [], 'wideString', '返回真实 Windows 主版本、次版本和内部版本号。'),
    command('系统_取处理器数量', [], 'int', '返回系统逻辑处理器数量。'),
    command('系统_取内存总量MB', [], 'longLong', '返回物理内存总量，单位 MB。'),
    command('系统_取内存可用MB', [], 'longLong', '返回当前可用物理内存，单位 MB。'),
    command('系统_取环境变量', [{ name: '名称', type: 'wideString', description: '环境变量名称，Windows 下不区分大小写；变量不存在时返回空文本。'}], 'wideString', '读取当前进程可见的环境变量。')
  ]
});

const disk = createStandardModule({
  id: 'lingbuilder.system.disk', name: '磁盘信息模块', category: '系统',
  version: '1.1.0',
  description: '完整读取逻辑驱动器、卷、容量、文件系统、物理磁盘、SSD/TRIM、扇区和分区信息。',
  tags: ['磁盘', '卷', '分区', '存储', '系统信息'],
  types: DISK_PUBLIC_TYPES,
  commands: DISK_COMMANDS
});

const clipboard = createStandardModule({
  id: 'lingbuilder.system.clipboard', name: '剪贴板模块', category: '系统',
  version: '1.1.0',
  description: '提供 Unicode 文本、Windows DIB/BMP 图片和保留动画帧的 GIF 字节集剪贴板读写与格式查询。', tags: ['剪贴板', '文本', '图片', 'GIF', '字节集'],
  docs: [{ title: '剪贴板模块 1.1 使用说明', path: 'docs/modules/clipboard/README.md' }],
  commands: [
    command('剪贴板_置文本', [{ name: '文本', type: 'wideString', description: '要写入剪贴板的 Unicode 文本，会替换原有内容；剪贴板被其它进程占用时返回假。'}], 'bool', '把 Unicode 文本写入系统剪贴板。', '剪贴板_置文本("来自 LingBuilder")'),
    command('剪贴板_取文本', [], 'wideString', '读取系统剪贴板中的 Unicode 文本。'),
    command('剪贴板_是否有文本', [], 'bool', '判断剪贴板是否包含 Unicode 文本。'),
    command('剪贴板_置图片字节集', [{ name: '图片数据', type: 'bytes', description: '图片字节集，必须是 GIF87a/GIF89a、裸 DIB、DIBV5 或带 BMP 文件头的数据之一；无法识别时返回假。'}], 'bool', '自动识别 GIF87a/GIF89a、Windows DIB/DIBV5 或带 BMP 文件头的图片字节集；GIF 会保留全部动画帧。', '剪贴板_置图片字节集(图片数据)'),
    command('剪贴板_取图片字节集', [], 'bytes', '优先读取原始 GIF 动图字节集，否则读取 DIB/DIBV5 图片字节集；没有可读图片时返回空字节集。'),
    command('剪贴板_是否有图片', [], 'bool', '判断系统剪贴板是否包含 GIF、DIB、DIBV5 或位图图片。'),
    command('剪贴板_取图片格式', [], 'wideString', '返回当前图片格式名：GIF、CF_DIBV5、CF_DIB 或 CF_BITMAP；没有图片时返回空文本。'),
    command('剪贴板_置GIF字节集', [{ name: 'GIF数据', type: 'bytes', description: '完整的 GIF 字节集，必须以 GIF87a 或 GIF89a 开头，动图全部帧一并写入；不满足时返回假。'}], 'bool', '把原始 GIF87a/GIF89a 字节集以 GIF、image/gif 和 HTML Format 格式写入剪贴板，保留动图帧。', '剪贴板_置GIF字节集(GIF数据)'),
    command('剪贴板_取GIF字节集', [], 'bytes', '读取剪贴板 GIF 注册格式中的原始 GIF 字节集；没有 GIF 时返回空字节集。'),
    command('剪贴板_清空', [], 'bool', '清空系统剪贴板。')
  ]
});

const shell = createStandardModule({
  id: 'lingbuilder.system.shell', name: '系统外壳模块', category: '系统',
  description: '提供打开文件或网址、资源管理器定位和常用系统目录读取。', tags: ['Shell', '系统'],
  docs: [{ title: '系统外壳模块使用说明', path: 'docs/modules/shell/README.md' }],
  commands: [
    command('系统_打开', [{ name: '目标', type: 'wideString', description: '要打开的文件、目录或网址文本，交给系统默认程序处理；返回假表示 ShellExecute 未成功启动。'}], 'bool', '使用系统默认程序打开文件、目录或网址。', '系统_打开("https://example.com")'),
    command('系统_定位文件', [{ name: '路径', type: 'wideString', description: '要在资源管理器窗口中选中并显示的文件路径。'}], 'bool', '在资源管理器中选中指定文件。'),
    command('系统_取运行目录', [], 'wideString', '返回当前运行 exe 所在目录，不带尾部反斜杠。', '系统_取运行目录()'),
    command('系统_取临时目录', [], 'wideString', '返回当前用户临时目录。'),
    command('系统_取桌面目录', [], 'wideString', '返回当前用户桌面目录。'),
    command('系统_取文档目录', [], 'wideString', '返回当前用户文档目录。'),
    command('系统_创建桌面快捷方式', [{ name: '快捷方式名称', type: 'wideString', description: '快捷方式文件名，不带路径；不带 .lnk 后缀时自动补上。'}, { name: '目标路径', type: 'wideString', description: '快捷方式指向的文件或目录，不能为空。'}, { name: '参数', type: 'wideString', optional: true, defaultValue: '', description: '传给目标的命令行参数，可省略。'}, { name: '图标路径', type: 'wideString', optional: true, defaultValue: '', description: '快捷方式图标来源文件；省略时使用目标路径自身图标。'}], 'bool', '在当前用户桌面创建快捷方式；COM 初始化失败或目标无效返回假。'),
    command('系统_关机', [], 'bool', '关闭计算机（先取得关机权限，失败返回假）。'),
    command('系统_重启', [], 'bool', '重启计算机（先取得关机权限，失败返回假）。'),
    command('系统_注销', [], 'bool', '注销当前登录用户。'),
    command('系统_清空回收站', [], 'bool', '清空回收站，不弹确认框、不播放声音；回收站已为空同样返回真。')
  ]
});

const process = createStandardModule({
  id: 'lingbuilder.process', name: '进程管理模块', category: '系统',
  description: '提供受控的程序启动、等待、进程状态和显式进程终止能力。', tags: ['进程', '程序'],
  commands: [
    command('程序_启动', [{ name: '命令行', type: 'wideString', description: commandLineArg}, { name: '工作目录', type: 'wideString', description: workDirArg}], 'int', '启动程序并返回进程 ID，失败返回 0。'),
    command('程序_启动并等待', [{ name: '命令行', type: 'wideString', description: commandLineArg}, { name: '工作目录', type: 'wideString', description: workDirArg}, { name: '超时毫秒', type: 'int', description: '等待进程退出的最长毫秒数；小于 0 表示一直等待。超时或启动失败返回 -1；在界面事件里等待会卡住界面。'}], 'int', '启动程序并等待，返回退出码；超时或失败返回 -1。'),
    command('进程_取当前ID', [], 'int', '返回当前进程 ID。'),
    command('进程_是否运行', [{ name: '进程ID', type: 'int', description: '要检查的进程 ID，必须大于 0；进程已退出或无权打开时返回假。'}], 'bool', '判断指定进程是否仍在运行。'),
    command('进程_终止', [{ name: '进程ID', type: 'int', description: '要终止的进程 ID，必须大于 0 且不能等于当前进程自身。'}, { name: '退出码', type: 'int', description: '强制写入被终止进程的退出码。'}], 'bool', '显式终止指定进程；不能用于当前进程。'),
    command('程序_执行并取输出', [{ name: '命令行', type: 'wideString', description: '要执行的完整命令行，例如 cmd /c ping 127.0.0.1；输出与错误回显合并读回，中文按系统 OEM 代码页解码。'}, { name: '超时毫秒', type: 'int', optional: true, defaultValue: 30000, description: '最长等待毫秒数，超时强制结束子进程并返回已捕获的输出；小于 0 表示无限等待，省略默认 30000。'}], 'wideString', '执行命令行并等待结束，把标准输出与错误输出合并读回为文本；命令无法启动返回空文本，用 程序_上次执行退出码 查询退出码。', '程序_执行并取输出("cmd /c echo 你好")'),
    command('程序_上次执行退出码', [], 'int', '返回本线程上一次 程序_执行并取输出 的子进程退出码；尚未执行过或命令无法启动返回 -1。')
  ]
});

const keyboard = createStandardModule({
  id: 'lingbuilder.input.keyboard', name: '键盘输入模块', category: '系统',
  version: '2.1.0',
  description: '分类提供全局状态、前台 SendInput 注入、指定 HWND 后台消息和键码转换能力。',
  tags: ['键盘', '输入', '全局', '前台', '后台', 'Win32'],
  commands: KEYBOARD_COMMANDS,
  snippets: [
    { label: '前台 Unicode 文本输入', insertText: '键盘_前台_输入文本("你好 LingBuilder")', description: '向当前前台焦点注入 Unicode 文本，不会锁定实体键盘。' },
    { label: '前台多修饰键组合', insertText: '键盘_前台_组合按键(83, 17, 16, 0)', description: '示例为 Ctrl+Shift+S，未使用的修饰键传 0。' },
    { label: '后台窗口文本消息', insertText: '句柄 目标 = 键盘_窗口_取焦点控件(顶层窗口)\n键盘_窗口_输入文本(目标, "后台文本")', description: '不抢焦点地向指定 HWND 投递 WM_CHAR；目标可以忽略。' }
  ],
  docs: [{ title: '键盘输入模块 2.0 使用说明', path: 'docs/modules/keyboard/README.md' }]
});

const mouse = createStandardModule({
  id: 'lingbuilder.input.mouse', name: '鼠标输入模块', category: '系统',
  version: '2.0.0',
  description: '按三类封装鼠标输入：全局真实输入（前台）、指定 HWND 的窗口消息输入（后台）和 UI Automation 语义操作（后台）。',
  tags: ['鼠标', '输入', '全局', '前台', '后台', '窗口消息', 'UI Automation', 'Win32'],
  commands: MOUSE_COMMANDS,
  snippets: [
    { label: '后台窗口消息点击', insertText: '鼠标_窗口消息左键单击(目标窗口, 20, 20)', description: '按客户区坐标向指定 HWND 投递后台消息，不移动真实光标。' },
    { label: '后台 UI Automation 调用', insertText: '局部 句柄 确定按钮 = 鼠标_UIA_按名称查找(目标窗口, "确定")\n鼠标_UIA_调用(确定按钮)', description: '按控件语义查找并调用元素，不模拟鼠标。' }
  ],
  docs: [{ title: '鼠标输入模块 2.0 使用说明', path: 'docs/modules/mouse/README.md' }]
});

const windowUtils = createStandardModule({
  id: 'lingbuilder.win32.window-utils', name: 'Win32窗口操作模块', category: '界面',
  description: '通过 HWND 安全封装常用窗口查找、标题、显示和位置操作，并提供无边框窗口的拖拽与边缘缩放入口。', tags: ['窗口', 'Win32', '无边框'],
  docs: [{ title: 'Win32窗口操作模块使用说明', path: 'docs/modules/win32-window-utils/README.md' }],
  commands: [
    command('窗口_按标题查找', [{ name: '标题', type: 'wideString', description: '要精确匹配的完整窗口标题，区分大小写且不是子串匹配；找不到时返回 0。'}], 'handle', '按完整窗口标题查找顶层窗口。'),
    command('窗口_句柄是否有效', [{ name: '窗口句柄', type: 'handle', description: '待校验的窗口句柄；0 或已销毁的窗口返回假。'}], 'bool', '判断 HWND 是否仍然有效。'),
    command('窗口_取标题', [{ name: '窗口句柄', type: 'handle', description: '要读取标题的窗口句柄；标题为空或读取失败返回空文本。'}], 'wideString', '读取窗口标题。'),
    command('窗口_设置标题', [{ name: '窗口句柄', type: 'handle', description: hwndArg}, { name: '标题', type: 'wideString', description: '新的标题文本，直接替换原标题；空文本清空标题栏文字。'}], 'bool', '设置窗口标题。'),
    command('窗口_显示', [{ name: '窗口句柄', type: 'handle', description: '目标窗口句柄；句柄无效时返回假，合法句柄即使显示编号不认识也会返回真。'}, { name: '显示方式', type: 'int', description: 'Win32 SW_* 显示编号，例如 0 隐藏、1 正常显示、2 最小化、3 最大化；运行时不校验取值范围。'}], 'bool', '按 Win32 SW_* 编号显示、隐藏、最小化或最大化窗口。'),
    command('窗口_移动', [{ name: '窗口句柄', type: 'handle', description: hwndArg}, { name: '横坐标', type: 'int', description: '窗口左上角的屏幕横坐标，按物理像素计。'}, { name: '纵坐标', type: 'int', description: '窗口左上角的屏幕纵坐标，按物理像素计。'}, { name: '宽度', type: 'int', description: '窗口新的外框宽度；小于 1 时按 1 处理。'}, { name: '高度', type: 'int', description: '窗口新的外框高度；小于 1 时按 1 处理。'}], 'bool', '移动窗口并设置尺寸。'),
    command('窗口_置前台', [{ name: '窗口句柄', type: 'handle', description: '要提到前台的窗口句柄；系统前台锁定策略可能拒绝，此时返回假。'}], 'bool', '请求将窗口切换到前台。'),
    command('窗口_是否最大化', [{ name: '窗口句柄', type: 'handle', description: '要判断的窗口句柄；只有当前处于最大化状态才返回真。'}], 'bool', '判断窗口当前是否处于最大化（IsZoomed）状态。', '窗口_是否最大化(窗口句柄)'),
    command('窗口_取边界JSON', [{ name: '窗口句柄', type: 'handle', description: '要读取边界的窗口句柄；句柄无效时返回空对象文本 {}。'}], 'wideString', '以 JSON 返回窗口屏幕边界（物理像素）：{"x":0,"y":0,"width":0,"height":0}；窗口无效时返回 {}。', '窗口_取边界JSON(窗口句柄)'),
    command('窗口_开始拖拽', [{ name: '窗口句柄', type: 'handle', description: '要拖动的无边框窗口句柄；调用会进入系统标题栏移动循环，直到用户松开鼠标才返回。'}], 'bool', '对无边框窗口启动系统标题栏拖拽：向窗口发送 WM_NCLBUTTONDOWN(HTCAPTION)，进入系统移动循环，直到用户松开鼠标。适合在网页自绘标题栏的 mousedown 处理器里经浏览器桥调用；调用量较大的界面建议节流。', '窗口_开始拖拽(窗口句柄)'),
    command('窗口_开始边缘缩放', [{ name: '窗口句柄', type: 'handle', description: '要缩放的无边框窗口句柄。'}, { name: '边缘代码', type: 'int', description: '缩放方向命中代码：10 左、11 右、12 上、13 左上、14 右上、15 下、16 左下、17 右下；其它值返回假。'}], 'bool', '对无边框窗口启动系统边缘缩放：向窗口发送 WM_NCLBUTTONDOWN 并携带 Win32 命中代码。边缘代码：10 左、11 右、12 上、13 左上、14 右上、15 下、16 左下、17 右下；其它值返回假。', '窗口_开始边缘缩放(窗口句柄, 17)')
  ]
});

const monitor = createStandardModule({
  id: 'lingbuilder.win32.monitor', name: '显示器与DPI模块', category: '界面',
  description: '读取显示器数量、主屏尺寸、工作区尺寸和系统 DPI。', tags: ['显示器', 'DPI'],
  commands: [
    command('显示器_数量', [], 'int', '返回当前桌面连接的显示器数量。'),
    command('显示器_主屏宽度', [], 'int', '返回主显示器像素宽度。'),
    command('显示器_主屏高度', [], 'int', '返回主显示器像素高度。'),
    command('显示器_工作区宽度', [], 'int', '返回主显示器排除任务栏后的工作区宽度。'),
    command('显示器_工作区高度', [], 'int', '返回主显示器排除任务栏后的工作区高度。'),
    command('显示器_系统DPI', [], 'int', '返回系统 DPI，无法读取时返回 96。')
  ]
});

const consoleModule = createStandardModule({
  id: 'lingbuilder.console', name: '控制台模块', category: '系统',
  version: '1.0.0',
  description: '为控制台程序提供标准输入输出、光标与文本颜色控制；命令只能在控制台程序（含「整数型 启动()」入口）中使用，窗口应用中会给出阻断诊断。',
  tags: ['控制台', '输入输出', '控制台程序'],
  docs: [{ title: '控制台模块使用说明', path: 'docs/modules/console/README.md' }],
  commands: [
    command('控制台_输出', [{ name: '内容', type: 'wideString', description: '要写入控制台的文本；不附加换行，输出后光标停在文本末尾。'}], 'void', '向控制台标准输出写入文本（不换行）。'),
    command('控制台_输出行', [{ name: '内容', type: 'wideString', description: '要写入控制台的文本；写入后光标移动到下一行行首。'}], 'void', '向控制台标准输出写入一行文本并换行。'),
    command('控制台_读行', [], 'wideString', '从控制台读取一行输入，遇到回车返回（结果不含回车）；流被重定向或读取失败返回空文本。', '控制台_读行()'),
    command('控制台_清屏', [], 'void', '清空控制台屏幕并把光标移回左上角。'),
    command('控制台_置光标位置', [{ name: '列', type: 'int', description: '目标列号，从 0 起；超出屏幕宽度时取边界值。'}, { name: '行', type: 'int', description: '目标行号，从 0 起；超出屏幕高度时取边界值。'}], 'void', '把控制台光标移动到指定字符位置（后续输出从该位置开始）。'),
    command('控制台_取光标列', [], 'int', '返回控制台光标当前列号（从 0 起）。'),
    command('控制台_取光标行', [], 'int', '返回控制台光标当前行号（从 0 起）。'),
    command('控制台_取宽度', [], 'int', '返回控制台屏幕缓冲区的字符宽度。'),
    command('控制台_取高度', [], 'int', '返回控制台屏幕窗口的字符高度。'),
    command('控制台_显示光标', [{ name: '可见', type: 'bool', description: '真显示光标，假隐藏光标。'}], 'void', '设置控制台光标是否可见。'),
    command('控制台_置颜色', [{ name: '前景色', type: 'int', description: '前景色编号 0～15：0 黑、1 深蓝、2 深绿、3 青灰、4 深红、5 紫、6 橄榄、7 灰白、8 深灰、9 蓝、10 绿、11 浅青、12 红、13 粉、14 黄、15 白。'}, { name: '背景色', type: 'int', description: '背景色编号 0～15，取值同前景色。'}], 'void', '设置控制台后续输出的前景色与背景色（0～15 编号组合）。'),
    command('控制台_恢复颜色', [], 'void', '把控制台颜色恢复为默认（灰字黑底）。')
  ]
});

export const SYSTEM_LIBRARY_MODULES: LingBuilderModuleManifest[] = [
  fsCore, fsPath, ini, registry, systemInfo, disk, clipboard, shell, process, keyboard, mouse, windowUtils, monitor, consoleModule
];

export const SYSTEM_LIBRARY_MODULE_IDS = new Set(SYSTEM_LIBRARY_MODULES.map(module => module.id));
