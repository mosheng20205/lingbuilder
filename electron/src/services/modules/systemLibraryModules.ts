import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';
import { DISK_COMMANDS, DISK_PUBLIC_TYPES } from './diskApiCatalog';
import { KEYBOARD_COMMANDS } from './keyboardApiCatalog';
import { MOUSE_COMMANDS } from './mouseApiCatalog';

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };

function command(
  name: string,
  parameters: Parameter[],
  returnType: ModuleBindingValueType,
  description: string,
  example?: string
): StandardCommandSpec {
  const placeholders = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' || parameter.type === 'utf8String' ? `"$${index + 1}"` : parameter.type === 'bool' ? index === 0 ? '真' : '假' : '0');
  return {
    name,
    signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`,
    description,
    insertText: `${name}(${placeholders.join(', ')})`,
    parameters,
    returnType,
    example
  };
}

const fsCore = createStandardModule({
  id: 'lingbuilder.fs.core', name: '文件目录模块', category: '系统',
  description: '提供 UTF-8 文本文件和常用文件目录操作，所有路径均使用 Unicode。', tags: ['文件', '目录'],
  commands: [
    command('文件_是否存在', [{ name: '路径', type: 'wideString' }], 'bool', '判断指定路径是否为普通文件。', '文件_是否存在("配置.json")'),
    command('目录_是否存在', [{ name: '路径', type: 'wideString' }], 'bool', '判断指定路径是否为目录。'),
    command('文件_读取文本', [{ name: '路径', type: 'wideString' }], 'wideString', '按 UTF-8 读取完整文本；失败返回空文本。'),
    command('文件_写入文本', [{ name: '路径', type: 'wideString' }, { name: '内容', type: 'wideString' }], 'bool', '按 UTF-8 覆盖写入文本文件。'),
    command('文件_追加文本', [{ name: '路径', type: 'wideString' }, { name: '内容', type: 'wideString' }], 'bool', '按 UTF-8 向文件末尾追加文本。'),
    command('文件_复制', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '允许覆盖', type: 'bool' }], 'bool', '复制文件并可选择是否覆盖。'),
    command('文件_移动', [{ name: '来源', type: 'wideString' }, { name: '目标', type: 'wideString' }, { name: '允许覆盖', type: 'bool' }], 'bool', '移动或重命名文件。'),
    command('文件_删除', [{ name: '路径', type: 'wideString' }], 'bool', '删除一个普通文件。'),
    command('文件_取大小', [{ name: '路径', type: 'wideString' }], 'longLong', '返回文件字节数，失败返回 -1。'),
    command('目录_创建', [{ name: '路径', type: 'wideString' }], 'bool', '递归创建目录；目录已经存在也返回真。'),
    command('目录_删除空目录', [{ name: '路径', type: 'wideString' }], 'bool', '只删除空目录，不执行递归删除。')
  ]
});

const fsPath = createStandardModule({
  id: 'lingbuilder.fs.path', name: '路径处理模块', category: '系统',
  description: '提供不访问或少量访问文件系统的路径组合、规范化和组成部分读取。', tags: ['文件', '路径'],
  commands: [
    command('路径_合并', [{ name: '基础路径', type: 'wideString' }, { name: '子路径', type: 'wideString' }], 'wideString', '组合两个路径并进行词法规范化。', '路径_合并("数据", "配置.json")'),
    command('路径_取文件名', [{ name: '路径', type: 'wideString' }], 'wideString', '返回路径中的文件名。'),
    command('路径_取目录', [{ name: '路径', type: 'wideString' }], 'wideString', '返回路径中的父目录。'),
    command('路径_取扩展名', [{ name: '路径', type: 'wideString' }], 'wideString', '返回包含点号的文件扩展名。'),
    command('路径_改扩展名', [{ name: '路径', type: 'wideString' }, { name: '新扩展名', type: 'wideString' }], 'wideString', '替换文件扩展名。'),
    command('路径_转绝对路径', [{ name: '路径', type: 'wideString' }], 'wideString', '以当前工作目录为基准生成绝对路径。'),
    command('路径_规范化', [{ name: '路径', type: 'wideString' }], 'wideString', '移除路径中的点段并规范分隔结构。')
  ]
});

const ini = createStandardModule({
  id: 'lingbuilder.config.ini', name: 'INI 配置模块', category: '系统',
  description: '使用 Windows Unicode 配置 API 读取和写入 INI 文件。', tags: ['配置', 'INI'],
  commands: [
    command('INI_读文本', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }, { name: '键', type: 'wideString' }, { name: '默认值', type: 'wideString' }], 'wideString', '读取 INI 文本值。'),
    command('INI_读整数', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }, { name: '键', type: 'wideString' }, { name: '默认值', type: 'int' }], 'int', '读取 INI 整数值。'),
    command('INI_写文本', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }, { name: '键', type: 'wideString' }, { name: '值', type: 'wideString' }], 'bool', '写入 INI 文本值。'),
    command('INI_写整数', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }, { name: '键', type: 'wideString' }, { name: '值', type: 'int' }], 'bool', '写入 INI 整数值。'),
    command('INI_删除键', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }, { name: '键', type: 'wideString' }], 'bool', '删除指定 INI 键。'),
    command('INI_删除节', [{ name: '文件', type: 'wideString' }, { name: '节', type: 'wideString' }], 'bool', '删除整个 INI 节。')
  ]
});

const registry = createStandardModule({
  id: 'lingbuilder.config.registry', name: '用户注册表模块', category: '系统',
  description: '只访问当前用户 HKEY_CURRENT_USER 下的注册表键值，避免默认要求管理员权限。', tags: ['配置', '注册表'],
  commands: [
    command('注册表_读文本', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }, { name: '默认值', type: 'wideString' }], 'wideString', '读取当前用户注册表字符串值。'),
    command('注册表_读整数', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }, { name: '默认值', type: 'int' }], 'int', '读取当前用户注册表 DWORD 值。'),
    command('注册表_写文本', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }, { name: '值', type: 'wideString' }], 'bool', '写入当前用户注册表字符串值。'),
    command('注册表_写整数', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }, { name: '值', type: 'int' }], 'bool', '写入当前用户注册表 DWORD 值。'),
    command('注册表_删除值', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }], 'bool', '删除当前用户注册表值。'),
    command('注册表_值是否存在', [{ name: '子键', type: 'wideString' }, { name: '值名', type: 'wideString' }], 'bool', '判断当前用户注册表值是否存在。')
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
    command('系统_取环境变量', [{ name: '名称', type: 'wideString' }], 'wideString', '读取当前进程可见的环境变量。')
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
    command('剪贴板_置文本', [{ name: '文本', type: 'wideString' }], 'bool', '把 Unicode 文本写入系统剪贴板。', '剪贴板_置文本("来自 LingBuilder")'),
    command('剪贴板_取文本', [], 'wideString', '读取系统剪贴板中的 Unicode 文本。'),
    command('剪贴板_是否有文本', [], 'bool', '判断剪贴板是否包含 Unicode 文本。'),
    command('剪贴板_置图片字节集', [{ name: '图片数据', type: 'bytes' }], 'bool', '自动识别 GIF87a/GIF89a、Windows DIB/DIBV5 或带 BMP 文件头的图片字节集；GIF 会保留全部动画帧。', '剪贴板_置图片字节集(图片数据)'),
    command('剪贴板_取图片字节集', [], 'bytes', '优先读取原始 GIF 动图字节集，否则读取 DIB/DIBV5 图片字节集；没有可读图片时返回空字节集。'),
    command('剪贴板_是否有图片', [], 'bool', '判断系统剪贴板是否包含 GIF、DIB、DIBV5 或位图图片。'),
    command('剪贴板_取图片格式', [], 'wideString', '返回当前图片格式名：GIF、CF_DIBV5、CF_DIB 或 CF_BITMAP；没有图片时返回空文本。'),
    command('剪贴板_置GIF字节集', [{ name: 'GIF数据', type: 'bytes' }], 'bool', '把原始 GIF87a/GIF89a 字节集以 GIF、image/gif 和 HTML Format 格式写入剪贴板，保留动图帧。', '剪贴板_置GIF字节集(GIF数据)'),
    command('剪贴板_取GIF字节集', [], 'bytes', '读取剪贴板 GIF 注册格式中的原始 GIF 字节集；没有 GIF 时返回空字节集。'),
    command('剪贴板_清空', [], 'bool', '清空系统剪贴板。')
  ]
});

const shell = createStandardModule({
  id: 'lingbuilder.system.shell', name: '系统外壳模块', category: '系统',
  description: '提供打开文件或网址、资源管理器定位和常用系统目录读取。', tags: ['Shell', '系统'],
  commands: [
    command('系统_打开', [{ name: '目标', type: 'wideString' }], 'bool', '使用系统默认程序打开文件、目录或网址。', '系统_打开("https://example.com")'),
    command('系统_定位文件', [{ name: '路径', type: 'wideString' }], 'bool', '在资源管理器中选中指定文件。'),
    command('系统_取临时目录', [], 'wideString', '返回当前用户临时目录。'),
    command('系统_取桌面目录', [], 'wideString', '返回当前用户桌面目录。'),
    command('系统_取文档目录', [], 'wideString', '返回当前用户文档目录。')
  ]
});

const process = createStandardModule({
  id: 'lingbuilder.process', name: '进程管理模块', category: '系统',
  description: '提供受控的程序启动、等待、进程状态和显式进程终止能力。', tags: ['进程', '程序'],
  commands: [
    command('程序_启动', [{ name: '命令行', type: 'wideString' }, { name: '工作目录', type: 'wideString' }], 'int', '启动程序并返回进程 ID，失败返回 0。'),
    command('程序_启动并等待', [{ name: '命令行', type: 'wideString' }, { name: '工作目录', type: 'wideString' }, { name: '超时毫秒', type: 'int' }], 'int', '启动程序并等待，返回退出码；超时或失败返回 -1。'),
    command('进程_取当前ID', [], 'int', '返回当前进程 ID。'),
    command('进程_是否运行', [{ name: '进程ID', type: 'int' }], 'bool', '判断指定进程是否仍在运行。'),
    command('进程_终止', [{ name: '进程ID', type: 'int' }, { name: '退出码', type: 'int' }], 'bool', '显式终止指定进程；不能用于当前进程。')
  ]
});

const keyboard = createStandardModule({
  id: 'lingbuilder.input.keyboard', name: '键盘输入模块', category: '系统',
  version: '2.0.0',
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
  description: '通过 HWND 安全封装常用窗口查找、标题、显示和位置操作。', tags: ['窗口', 'Win32'],
  commands: [
    command('窗口_按标题查找', [{ name: '标题', type: 'wideString' }], 'handle', '按完整窗口标题查找顶层窗口。'),
    command('窗口_句柄是否有效', [{ name: '窗口句柄', type: 'handle' }], 'bool', '判断 HWND 是否仍然有效。'),
    command('窗口_取标题', [{ name: '窗口句柄', type: 'handle' }], 'wideString', '读取窗口标题。'),
    command('窗口_设置标题', [{ name: '窗口句柄', type: 'handle' }, { name: '标题', type: 'wideString' }], 'bool', '设置窗口标题。'),
    command('窗口_显示', [{ name: '窗口句柄', type: 'handle' }, { name: '显示方式', type: 'int' }], 'bool', '按 Win32 SW_* 编号显示、隐藏、最小化或最大化窗口。'),
    command('窗口_移动', [{ name: '窗口句柄', type: 'handle' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }, { name: '宽度', type: 'int' }, { name: '高度', type: 'int' }], 'bool', '移动窗口并设置尺寸。'),
    command('窗口_置前台', [{ name: '窗口句柄', type: 'handle' }], 'bool', '请求将窗口切换到前台。')
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

export const SYSTEM_LIBRARY_MODULES: LingBuilderModuleManifest[] = [
  fsCore, fsPath, ini, registry, systemInfo, disk, clipboard, shell, process, keyboard, mouse, windowUtils, monitor
];

export const SYSTEM_LIBRARY_MODULE_IDS = new Set(SYSTEM_LIBRARY_MODULES.map(module => module.id));
