import { LingBuilderModuleManifest, ModuleBindingValueType } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';

type Parameter = { name: string; type: ModuleBindingValueType; description?: string };
function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string): StandardCommandSpec {
  const args = parameters.map((parameter, index) => parameter.type === 'wideString' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${args.join(', ')})`, parameters, returnType };
}

const archive = createStandardModule({ id: 'lingbuilder.archive', name: 'ZIP压缩模块', category: '系统', description: '通过 Windows 自带 tar.exe 的受控参数封装创建、解压和列出 ZIP，不开放任意命令行。', tags: ['压缩', 'ZIP'], commands: [
  command('压缩_ZIP创建', [{ name: '来源路径', type: 'wideString' }, { name: 'ZIP路径', type: 'wideString' }], 'bool', '把文件或目录创建为 ZIP。'),
  command('压缩_ZIP解压', [{ name: 'ZIP路径', type: 'wideString' }, { name: '目标目录', type: 'wideString' }], 'bool', '解压 ZIP 到目标目录。'),
  command('压缩_ZIP列出', [{ name: 'ZIP路径', type: 'wideString' }], 'wideString', '返回 ZIP 内文件列表。'),
  command('压缩_取错误', [], 'wideString', '返回最近压缩错误。')
] });

const mail = createStandardModule({ id: 'lingbuilder.net.mail', name: 'SMTP邮件模块', category: '网络', description: '提供普通 SMTP 或局域网调试服务发送；当前版本不支持 TLS，遇到要求 STARTTLS 的服务会明确失败。', tags: ['邮件', 'SMTP'], commands: [
  command('SMTP_发送普通邮件', [{ name: '主机', type: 'wideString' }, { name: '端口', type: 'int' }, { name: '用户名', type: 'wideString' }, { name: '密码', type: 'wideString' }, { name: '发件人', type: 'wideString' }, { name: '收件人', type: 'wideString' }, { name: '主题', type: 'wideString' }, { name: '正文', type: 'wideString' }], 'bool', '通过不加密 SMTP 发送 UTF-8 文本邮件。'),
  command('SMTP_取错误', [], 'wideString', '返回最近 SMTP 错误或服务端响应。')
] });

const ipc = createStandardModule({ id: 'lingbuilder.ipc', name: '进程通信模块', category: '系统', description: '提供单连接命名管道 UTF-8 文本通信和命名互斥体单实例判断。', tags: ['IPC', '命名管道'], commands: [
  command('IPC_创建管道服务端', [{ name: '名称', type: 'wideString' }], 'bool', '创建本机命名管道服务端。'),
  command('IPC_等待管道客户端', [], 'bool', '等待一个管道客户端连接。'),
  command('IPC_连接管道', [{ name: '名称', type: 'wideString' }, { name: '超时毫秒', type: 'int' }], 'bool', '连接本机命名管道。'),
  command('IPC_发送文本', [{ name: '文本', type: 'wideString' }], 'bool', '发送一条长度前缀 UTF-8 文本。'),
  command('IPC_接收文本', [], 'wideString', '接收一条长度前缀 UTF-8 文本。'),
  command('IPC_创建单实例锁', [{ name: '名称', type: 'wideString' }], 'bool', '创建命名互斥体；首次创建返回真。'),
  command('IPC_取错误', [], 'wideString', '返回最近 IPC 错误。'),
  command('IPC_关闭', [], 'void', '关闭管道和单实例锁。')
] });

const menu = createStandardModule({ id: 'lingbuilder.win32.menu', name: 'Win32菜单模块', category: '界面', description: '封装 HMENU 创建、菜单项、窗口菜单和弹出菜单返回命令。', tags: ['菜单', 'Win32'], commands: [
  command('菜单_创建', [], 'handle', '创建菜单栏。'), command('菜单_创建弹出菜单', [], 'handle', '创建弹出菜单。'),
  command('菜单_添加项目', [{ name: '菜单句柄', type: 'handle' }, { name: '命令ID', type: 'int' }, { name: '标题', type: 'wideString' }], 'bool', '添加普通菜单项。'),
  command('菜单_添加子菜单', [{ name: '菜单句柄', type: 'handle' }, { name: '子菜单句柄', type: 'handle' }, { name: '标题', type: 'wideString' }], 'bool', '添加子菜单。'),
  command('菜单_添加分隔线', [{ name: '菜单句柄', type: 'handle' }], 'bool', '添加分隔线。'),
  command('菜单_设置到窗口', [{ name: '窗口句柄', type: 'handle' }, { name: '菜单句柄', type: 'handle' }], 'bool', '把菜单设置为窗口菜单栏。'),
  command('菜单_弹出并取命令', [{ name: '菜单句柄', type: 'handle' }, { name: '窗口句柄', type: 'handle' }, { name: '横坐标', type: 'int' }, { name: '纵坐标', type: 'int' }], 'int', '显示弹出菜单并返回选择的命令 ID。'),
  command('菜单_销毁', [{ name: '菜单句柄', type: 'handle' }], 'bool', '销毁未附加或不再使用的菜单。')
] });

const tray = createStandardModule({ id: 'lingbuilder.win32.tray', name: '托盘图标模块', category: '界面', description: '向通知区域添加、修改、显示气泡和删除托盘图标。', tags: ['托盘', '通知'], commands: [
  command('托盘_添加', [{ name: '窗口句柄', type: 'handle' }, { name: '编号', type: 'int' }, { name: '提示文本', type: 'wideString' }], 'bool', '使用应用默认图标添加托盘图标。'),
  command('托盘_修改提示', [{ name: '窗口句柄', type: 'handle' }, { name: '编号', type: 'int' }, { name: '提示文本', type: 'wideString' }], 'bool', '修改托盘提示文本。'),
  command('托盘_显示通知', [{ name: '窗口句柄', type: 'handle' }, { name: '编号', type: 'int' }, { name: '标题', type: 'wideString' }, { name: '内容', type: 'wideString' }], 'bool', '显示托盘气泡通知。'),
  command('托盘_删除', [{ name: '窗口句柄', type: 'handle' }, { name: '编号', type: 'int' }], 'bool', '删除托盘图标。'),
  command('托盘_取回调消息号', [], 'int', '返回固定回调消息 WM_APP+77。')
] });

const accessibility = createStandardModule({ id: 'lingbuilder.win32.accessibility', name: '辅助功能模块', category: '界面', description: '通过 Microsoft Active Accessibility 读取窗口对象名称、值、角色和状态。', tags: ['无障碍', 'Accessibility'], commands: [
  command('辅助_取名称', [{ name: '窗口句柄', type: 'handle' }], 'wideString', '读取窗口可访问对象名称。'),
  command('辅助_取值', [{ name: '窗口句柄', type: 'handle' }], 'wideString', '读取窗口可访问对象值。'),
  command('辅助_取角色', [{ name: '窗口句柄', type: 'handle' }], 'wideString', '返回本地化角色文本。'),
  command('辅助_取状态值', [{ name: '窗口句柄', type: 'handle' }], 'longLong', '返回 MSAA 状态位。')
] });

const memory = createStandardModule({ id: 'lingbuilder.advanced.memory', name: '受控内存模块', category: '系统', description: '只允许访问本模块登记的本进程内存块，拒绝任意裸地址。', tags: ['高级', '内存', '风险'], commands: [
  command('内存_申请', [{ name: '字节数', type: 'int' }], 'handle', '申请清零内存并返回受控句柄。'),
  command('内存_写整数', [{ name: '内存句柄', type: 'handle' }, { name: '偏移', type: 'int' }, { name: '数值', type: 'int' }], 'bool', '在边界内写入 32 位整数。'),
  command('内存_读整数', [{ name: '内存句柄', type: 'handle' }, { name: '偏移', type: 'int' }], 'int', '在边界内读取 32 位整数。'),
  command('内存_写UTF8文本', [{ name: '内存句柄', type: 'handle' }, { name: '偏移', type: 'int' }, { name: '文本', type: 'wideString' }], 'bool', '在边界内写入带零结尾 UTF-8 文本。'),
  command('内存_读UTF8文本', [{ name: '内存句柄', type: 'handle' }, { name: '偏移', type: 'int' }, { name: '最大字节数', type: 'int' }], 'wideString', '在边界内读取 UTF-8 文本。'),
  command('内存_释放', [{ name: '内存句柄', type: 'handle' }], 'bool', '释放受控内存块。')
] });

const hook = createStandardModule({ id: 'lingbuilder.advanced.hook', name: '键盘Hook模块', category: '系统', description: '提供当前桌面低级键盘 Hook 状态读取；不支持注入或修改其他进程。', tags: ['高级', 'Hook', '风险'], commands: [
  command('键盘钩子_启动', [], 'bool', '启动 WH_KEYBOARD_LL 钩子。'), command('键盘钩子_取最后键码', [], 'int', '读取最近键盘消息虚拟键码。'),
  command('键盘钩子_取消息数量', [], 'longLong', '读取钩子收到的消息数量。'), command('键盘钩子_停止', [], 'void', '卸载键盘钩子。')
] });

const processMemory = createStandardModule({ id: 'lingbuilder.advanced.process-memory', name: '进程内存模块', category: '系统', description: '显式打开目标进程并读写 32 位整数；属于高风险模块，不默认启用。', tags: ['高级', '进程内存', '风险'], commands: [
  command('进程内存_打开', [{ name: '进程ID', type: 'int' }, { name: '允许写入', type: 'bool' }], 'handle', '打开目标进程句柄。'),
  command('进程内存_读整数', [{ name: '进程句柄', type: 'handle' }, { name: '地址', type: 'longLong' }, { name: '默认值', type: 'int' }], 'int', '读取目标地址 32 位整数。'),
  command('进程内存_写整数', [{ name: '进程句柄', type: 'handle' }, { name: '地址', type: 'longLong' }, { name: '数值', type: 'int' }], 'bool', '写入目标地址 32 位整数。'),
  command('进程内存_关闭', [{ name: '进程句柄', type: 'handle' }], 'bool', '关闭目标进程句柄。')
] });

const com = createStandardModule({ id: 'lingbuilder.advanced.com', name: 'COM自动化模块', category: '系统', description: '通过 ProgID 创建 IDispatch 自动化对象，支持文本属性和无参方法。', tags: ['高级', 'COM'], commands: [
  command('COM_创建对象', [{ name: 'ProgID', type: 'wideString' }], 'bool', '创建一个 COM 自动化对象。'),
  command('COM_取文本属性', [{ name: '属性名', type: 'wideString' }], 'wideString', '读取文本或可转文本属性。'),
  command('COM_置文本属性', [{ name: '属性名', type: 'wideString' }, { name: '值', type: 'wideString' }], 'bool', '设置 BSTR 文本属性。'),
  command('COM_调用无参方法', [{ name: '方法名', type: 'wideString' }], 'bool', '调用无参数方法。'),
  command('COM_取错误', [], 'wideString', '返回最近 COM 错误。'), command('COM_关闭', [], 'void', '释放当前自动化对象。')
] });

const assembly = createStandardModule({ id: 'lingbuilder.advanced.assembly', name: 'CPU指令能力模块', category: '系统', description: '提供 CPUID 和位运算封装，不执行用户提供的机器码。', tags: ['高级', 'CPU', '汇编'], commands: [
  command('CPU_取厂商', [], 'wideString', '返回 CPUID 厂商标识。'), command('CPU_是否支持SSE2', [], 'bool', '检查 SSE2。'),
  command('CPU_是否支持AVX', [], 'bool', '检查 CPU 和操作系统是否启用 AVX。'), command('位运算_统计一位数量', [{ name: '数值', type: 'longLong' }], 'int', '统计 64 位数值中的 1 位数量。'),
  command('位运算_循环左移', [{ name: '数值', type: 'longLong' }, { name: '位数', type: 'int' }], 'longLong', '执行 64 位循环左移。')
] });

const driver = createStandardModule({ id: 'lingbuilder.advanced.driver', name: '设备驱动通信模块', category: '系统', description: '打开显式设备路径并执行无缓冲区 IOCTL；需要相应驱动权限，不负责安装或提权。', tags: ['高级', '驱动', '风险'], commands: [
  command('设备_打开', [{ name: '设备路径', type: 'wideString' }, { name: '允许写入', type: 'bool' }], 'handle', '打开 \\.\\DeviceName 形式设备。'),
  command('设备_无参数控制', [{ name: '设备句柄', type: 'handle' }, { name: '控制码', type: 'int' }], 'bool', '执行无输入输出缓冲区 DeviceIoControl。'),
  command('设备_关闭', [{ name: '设备句柄', type: 'handle' }], 'bool', '关闭设备句柄。'),
  command('设备_取错误码', [], 'int', '返回最近设备操作 Win32 错误码。')
] });

export const PLATFORM_ADVANCED_MODULES: LingBuilderModuleManifest[] = [archive, mail, ipc, menu, tray, accessibility, memory, hook, processMemory, com, assembly, driver];
