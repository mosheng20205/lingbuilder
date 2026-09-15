import type { StandardCommandSpec } from './standardLibraryModules';
import type { ModuleCommandBindingParameter, ModuleTypeContribution } from './types';

// 参数说明按 src/services/windowDesigner/systemLibraryRuntime.ts 的 DISK_RUNTIME 实现核实；
// 重复语义（定位所属卷的路径、物理磁盘编号）提取为共享常量。
const volumePathArg = '用于定位所属卷的路径，可以是文件、目录或盘符根，空文本按当前目录处理；解析失败时命令按说明返回失败值。';
const diskNumberArg = 'PhysicalDrive 编号，从 0 开始，与 磁盘_枚举物理磁盘 返回的磁盘编号一致；查询只申请只读权限。';

const text = (name: string, description: string) => ({ name, type: 'wideString' as const, description });
const integer = (name: string, description: string) => ({ name, type: 'int' as const, description });

function command(
  name: string,
  parameters: Array<ModuleCommandBindingParameter & { description: string }>,
  returnType: string,
  description: string,
  category: string,
  example?: string
): StandardCommandSpec {
  const placeholders = parameters.map((parameter, index) => parameter.type === 'wideString' ? `"$${index + 1}"` : '0');
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${placeholders.join(', ')})`,
    parameters,
    returnType,
    category,
    example
  };
}

export const DISK_PUBLIC_TYPES: ModuleTypeContribution[] = [
  {
    name: '磁盘容量信息',
    kind: 'record',
    description: '路径所在卷的精确字节容量及使用率。',
    fields: [
      { name: '查询成功', type: '逻辑型', initialValue: '假', description: '容量查询是否成功。' },
      { name: '错误代码', type: '整数型', initialValue: '0', description: '失败时的 Win32 错误代码。' },
      { name: '总容量字节', type: '长整数型', initialValue: '0', description: '卷总容量。' },
      { name: '用户可用字节', type: '长整数型', initialValue: '0', description: '当前用户配额下可用的容量。' },
      { name: '总空闲字节', type: '长整数型', initialValue: '0', description: '卷上所有用户合计可见的空闲容量。' },
      { name: '已用容量字节', type: '长整数型', initialValue: '0', description: '总容量减去总空闲容量。' },
      { name: '使用率', type: '双精度小数型', initialValue: '0.0', description: '按总空闲容量计算的百分比，范围 0 到 100。' }
    ]
  },
  {
    name: '磁盘卷信息',
    kind: 'record',
    description: '一个逻辑驱动器或 Windows 卷的完整只读快照。',
    fields: [
      { name: '查询成功', type: '逻辑型', initialValue: '假' },
      { name: '错误代码', type: '整数型', initialValue: '0' },
      { name: '根路径', type: '文本型', initialValue: '""' },
      { name: '卷GUID路径', type: '文本型', initialValue: '""' },
      { name: '卷标', type: '文本型', initialValue: '""' },
      { name: '文件系统', type: '文本型', initialValue: '""' },
      { name: '卷序列号', type: '长整数型', initialValue: '0' },
      { name: '最大文件名长度', type: '整数型', initialValue: '0' },
      { name: '文件系统标志', type: '长整数型', initialValue: '0' },
      { name: '驱动器类型', type: '整数型', initialValue: '0' },
      { name: '驱动器类型名称', type: '文本型', initialValue: '""' },
      { name: '是否就绪', type: '逻辑型', initialValue: '假' },
      { name: '容量', type: '磁盘容量信息' },
      { name: '挂载点', type: '文本型', isArray: true }
    ]
  },
  { name: '磁盘卷信息列表', kind: 'array', elementType: '磁盘卷信息', description: '磁盘卷信息数组。' },
  { name: '磁盘路径列表', kind: 'array', elementType: '文本型', description: 'Unicode 路径数组。' },
  {
    name: '物理磁盘信息',
    kind: 'record',
    description: '通过只读 Storage/IOCTL 查询得到的物理磁盘快照。',
    fields: [
      { name: '查询成功', type: '逻辑型', initialValue: '假' },
      { name: '错误代码', type: '整数型', initialValue: '0' },
      { name: '磁盘编号', type: '整数型', initialValue: '-1' },
      { name: '设备路径', type: '文本型', initialValue: '""' },
      { name: '厂商', type: '文本型', initialValue: '""' },
      { name: '产品', type: '文本型', initialValue: '""' },
      { name: '修订版本', type: '文本型', initialValue: '""' },
      { name: '序列号', type: '文本型', initialValue: '""' },
      { name: '设备类型', type: '整数型', initialValue: '0' },
      { name: '总线类型', type: '整数型', initialValue: '0' },
      { name: '总线类型名称', type: '文本型', initialValue: '""' },
      { name: '可移动介质', type: '逻辑型', initialValue: '假' },
      { name: '支持命令队列', type: '逻辑型', initialValue: '假' },
      { name: '容量字节', type: '长整数型', initialValue: '0' },
      { name: '逻辑扇区字节', type: '整数型', initialValue: '0' },
      { name: '物理扇区字节', type: '整数型', initialValue: '0' },
      { name: '分区样式', type: '整数型', initialValue: '2' },
      { name: '分区样式名称', type: '文本型', initialValue: '"RAW"' },
      { name: '分区数量', type: '整数型', initialValue: '0' },
      { name: '固态判断有效', type: '逻辑型', initialValue: '假' },
      { name: '是否固态', type: '逻辑型', initialValue: '假' },
      { name: 'TRIM判断有效', type: '逻辑型', initialValue: '假' },
      { name: '是否支持TRIM', type: '逻辑型', initialValue: '假' }
    ]
  },
  { name: '物理磁盘信息列表', kind: 'array', elementType: '物理磁盘信息', description: '物理磁盘信息数组。' },
  {
    name: '磁盘分区信息',
    kind: 'record',
    description: '物理磁盘上的 MBR、GPT 或 RAW 分区条目。',
    fields: [
      { name: '磁盘编号', type: '整数型', initialValue: '-1' },
      { name: '分区编号', type: '整数型', initialValue: '0' },
      { name: '分区样式', type: '整数型', initialValue: '2' },
      { name: '分区样式名称', type: '文本型', initialValue: '"RAW"' },
      { name: '起始偏移字节', type: '长整数型', initialValue: '0' },
      { name: '长度字节', type: '长整数型', initialValue: '0' },
      { name: '类型标识', type: '文本型', initialValue: '""' },
      { name: '名称', type: '文本型', initialValue: '""' },
      { name: '属性', type: '长整数型', initialValue: '0' },
      { name: '是否活动分区', type: '逻辑型', initialValue: '假' },
      { name: '是否可识别', type: '逻辑型', initialValue: '假' }
    ]
  },
  { name: '磁盘分区信息列表', kind: 'array', elementType: '磁盘分区信息', description: '物理磁盘分区数组。' }
];

export const DISK_COMMANDS: StandardCommandSpec[] = [
  command('磁盘_总容量MB', [text('路径', volumePathArg)], 'longLong', '返回路径所在卷的总容量 MB，失败返回 -1；兼容旧源码。', '容量', '磁盘_总容量MB("C:\\")'),
  command('磁盘_可用容量MB', [text('路径', volumePathArg)], 'longLong', '返回当前用户配额下可用容量 MB，失败返回 -1；兼容旧源码。', '容量'),
  command('磁盘_取卷标', [text('根路径', volumePathArg)], 'wideString', '返回卷标，失败返回空文本。', '卷'),
  command('磁盘_取文件系统', [text('根路径', volumePathArg)], 'wideString', '返回 NTFS、ReFS、FAT32 等文件系统名称。', '卷'),
  command('磁盘_取驱动器类型', [text('根路径', volumePathArg)], 'int', '返回 Win32 DRIVE_* 类型编号。', '卷'),
  command('磁盘_取总容量字节', [text('路径', volumePathArg)], 'longLong', '返回路径所在卷的精确总容量字节数，失败返回 -1。', '容量'),
  command('磁盘_取用户可用字节', [text('路径', volumePathArg)], 'longLong', '返回当前用户配额下可用的精确字节数，失败返回 -1。', '容量'),
  command('磁盘_取总空闲字节', [text('路径', volumePathArg)], 'longLong', '返回卷上所有用户合计可见的空闲字节数，失败返回 -1。', '容量'),
  command('磁盘_取已用容量字节', [text('路径', volumePathArg)], 'longLong', '返回总容量减去总空闲容量的字节数，失败返回 -1。', '容量'),
  command('磁盘_取使用率', [text('路径', volumePathArg)], 'double', '返回卷使用率百分比，失败返回 -1。', '容量'),
  command('磁盘_取容量信息', [text('路径', volumePathArg)], '磁盘容量信息', '一次返回精确容量、空闲容量、已用容量和使用率。', '容量'),
  command('磁盘_取卷信息', [text('路径', volumePathArg)], '磁盘卷信息', '返回路径所在卷的容量、标识、文件系统、类型和挂载点快照。', '卷'),
  command('磁盘_枚举逻辑驱动器', [], '磁盘卷信息列表', '枚举当前会话可见的盘符和网络映射驱动器；未就绪设备也会保留并携带错误代码。', '枚举'),
  command('磁盘_枚举全部卷', [], '磁盘卷信息列表', '使用 Windows 卷枚举 API 返回包含无盘符卷在内的全部卷。', '枚举'),
  command('磁盘_取挂载点列表', [text('卷GUID路径', '\?\Volume{GUID}\ 形式的卷路径；传入普通路径时运行时会先解析为所属卷的 GUID 路径。')], '磁盘路径列表', '返回卷对应的全部盘符和目录挂载点。', '卷'),
  command('磁盘_取路径卷根', [text('路径', volumePathArg)], 'wideString', '把任意本地路径解析为所属卷根路径。', '卷'),
  command('磁盘_取卷GUID路径', [text('路径', volumePathArg)], 'wideString', '返回路径所属卷的稳定 \\\\?\\Volume{GUID}\\ 名称。', '卷'),
  command('磁盘_取驱动器类型名称', [text('根路径', volumePathArg)], 'wideString', '返回未知、无效根路径、可移动、固定、网络、光盘或内存盘。', '卷'),
  command('磁盘_取卷序列号', [text('根路径', volumePathArg)], 'longLong', '返回文件系统卷序列号，失败返回 -1。', '文件系统'),
  command('磁盘_取文件系统标志', [text('根路径', volumePathArg)], 'longLong', '返回 GetVolumeInformationW 的 FILE_* 能力标志位，失败返回 -1。', '文件系统'),
  command('磁盘_取最大文件名长度', [text('根路径', volumePathArg)], 'int', '返回文件系统支持的单个名称最大字符数，失败返回 -1。', '文件系统'),
  command('磁盘_卷是否就绪', [text('根路径', volumePathArg)], 'bool', '判断卷是否存在且介质可读取。', '卷'),
  command('磁盘_文件系统是否支持', [text('根路径', volumePathArg), text('能力名称', '要查询的 FILE_* 能力名称，支持中文名或英文名，例如 压缩、稀疏文件、重解析点、命名流、加密、ACL、硬链接、事务、USN、DAX；无法识别时返回假并记录未知能力错误。')], 'bool', '按中文或英文能力名查询压缩、稀疏文件、重解析点、命名流、加密、ACL、硬链接、事务、USN、DAX 等 FILE_* 标志。', '文件系统'),
  command('磁盘_枚举物理磁盘', [], '物理磁盘信息列表', '枚举 Windows PhysicalDrive 设备并返回只读存储描述、容量、扇区、分区、SSD 和 TRIM 信息。', '物理磁盘'),
  command('磁盘_取物理磁盘信息', [integer('磁盘编号', diskNumberArg)], '物理磁盘信息', '按 PhysicalDrive 编号查询物理磁盘；不请求写权限。', '物理磁盘'),
  command('磁盘_取分区列表', [integer('磁盘编号', diskNumberArg)], '磁盘分区信息列表', '读取物理磁盘的 MBR/GPT/RAW 分区布局，失败返回空数组并记录错误。', '分区'),
  command('磁盘_取最近错误码', [], 'int', '返回当前线程最近一次磁盘模块失败的 Win32 错误代码；成功调用会清零。', '诊断'),
  command('磁盘_取最近错误', [], 'wideString', '返回当前线程最近一次磁盘模块失败的中文上下文和系统错误文本。', '诊断')
];

export const DISK_COMMAND_NAMES = DISK_COMMANDS.map(item => item.name);
