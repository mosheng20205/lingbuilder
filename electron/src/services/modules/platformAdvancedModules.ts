import { LingBuilderModuleManifest, ModuleBindingValueType, ModuleCommandBindingParameter } from './types';
import { createStandardModule, StandardCommandSpec } from './standardLibraryModules';
import { createModuleBindingSnippetArgument } from './bindingValueType';

type Parameter = { name: string; type: ModuleBindingValueType; description: string };

// 以下说明按 src/services/windowDesigner/platformAdvancedRuntime.ts 的实际实现核实，
// 重复语义（菜单句柄、窗口句柄、托盘编号、受控内存句柄与偏移、COM 对象与名称、ZIP 与管道名）提取为共享常量。
const menuHandleArg = '菜单_创建 或 菜单_创建弹出菜单 返回的菜单句柄；已销毁或仍挂在窗口上的菜单不要重复使用。';
const popupMenuHandleArg = '菜单_创建弹出菜单 返回的弹出菜单句柄。';
const windowHandleArg = '接收菜单命令或托盘回调消息的窗口句柄。';
const trayIdArg = '托盘图标编号，同一窗口内用于区分多个图标；必须与添加时使用的编号一致。';
const trayTipArg = '鼠标悬停提示文本，空文本时使用 LingBuilder；超出系统长度上限会被截断。';
const memHandleArg = '内存_申请 返回的受控内存句柄；本模块只登记自己分配的内存块，裸地址一律拒绝访问。';
const memOffsetArg = '块内字节偏移，从 0 起；读写范围越过块尾时按说明返回假或零值。';
const procHandleArg = '进程内存_打开 返回的进程句柄；为 0 表示打开失败，读写不会生效。';
const comObjectArg = 'COM_创建对象、COM_取OCX对象、COM_取对象属性 或 COM_调用对象方法 返回的 COM 对象句柄；用满后交给 COM_关闭 释放。';
const comNameArg = '组件暴露的属性或方法名称，按 IDispatch 名称匹配；不确定的名称先用 COM_取接口信息 查看。';
const zipPathArg = 'ZIP 文件路径，不能包含双引号、回车或换行，否则直接判为非法参数。';
const pipeNameArg = '自定义管道或互斥体名称，不要包含反斜杠；运行时会自动加上 LingBuilder 前缀。';
function command(name: string, parameters: Parameter[], returnType: ModuleBindingValueType, description: string): StandardCommandSpec {
  const args = parameters.map((parameter, index) => parameter.type === 'controlRef' || parameter.type === 'handler'
    ? createModuleBindingSnippetArgument(parameter, index)
    : parameter.type === 'wideString' ? `"$${index + 1}"` : parameter.type === 'bool' ? '假' : '0');
  return { name, signature: `${name}(${parameters.map(parameter => parameter.name).join(', ')})`, description, insertText: `${name}(${args.join(', ')})`, parameters, returnType };
}

const archive = createStandardModule({ id: 'lingbuilder.archive', name: 'ZIP压缩模块', category: '系统', description: '通过 Windows 自带 tar.exe 的受控参数封装创建、解压和列出 ZIP，不开放任意命令行。', tags: ['压缩', 'ZIP'], commands: [
  command('压缩_ZIP创建', [{ name: '来源路径', type: 'wideString', description: '要打包的文件或目录路径；以它的父目录为工作目录、文件名作为条目写入 ZIP。路径不能含双引号、回车或换行。'}, { name: 'ZIP路径', type: 'wideString', description: `${zipPathArg}目标已存在时会被覆盖。`}], 'bool', '把文件或目录创建为 ZIP。'),
  command('压缩_ZIP解压', [{ name: 'ZIP路径', type: 'wideString', description: zipPathArg}, { name: '目标目录', type: 'wideString', description: '解压目标目录；目录不存在时会递归创建，路径不能含双引号、回车或换行。'}], 'bool', '解压 ZIP 到目标目录。'),
  command('压缩_ZIP列出', [{ name: 'ZIP路径', type: 'wideString', description: `${zipPathArg}返回的条目按行分隔，失败返回空文本。`}], 'wideString', '返回 ZIP 内文件列表。'),
  command('压缩_取错误', [], 'wideString', '返回最近压缩错误。')
] });

const mail = createStandardModule({ id: 'lingbuilder.net.mail', name: 'SMTP邮件模块', category: '网络', description: '提供普通 SMTP 或局域网调试服务发送；当前版本不支持 TLS，遇到要求 STARTTLS 的服务会明确失败。', tags: ['邮件', 'SMTP'], commands: [
  command('SMTP_发送普通邮件', [{ name: '主机', type: 'wideString', description: 'SMTP 服务器主机名或 IP，同时尝试 IPv4 与 IPv6。'}, { name: '端口', type: 'int', description: 'SMTP 端口，1 到 65535；本模块不启用 TLS，服务端强制 STARTTLS 时会失败。'}, { name: '用户名', type: 'wideString', description: '登录账号；空文本表示跳过 AUTH LOGIN 匿名发送。'}, { name: '密码', type: 'wideString', description: '登录密码，随 AUTH LOGIN 以 Base64 明文传输，仅在可信内网或回环服务上使用。'}, { name: '发件人', type: 'wideString', description: 'MAIL FROM 使用的发件地址，不写尖括号。'}, { name: '收件人', type: 'wideString', description: 'RCPT TO 使用的单个收件地址；需要多个收件人时自行循环发送。'}, { name: '主题', type: 'wideString', description: '邮件主题，按 UTF-8 Base64 编码为编码字形式写入标题头。'}, { name: '正文', type: 'wideString', description: '纯文本正文，按 UTF-8 以 8bit 传输；每步服务响应等待超时固定 30 秒。'}], 'bool', '通过不加密 SMTP 发送 UTF-8 文本邮件。'),
  command('SMTP_取错误', [], 'wideString', '返回最近 SMTP 错误或服务端响应。')
] });

const ipc = createStandardModule({ id: 'lingbuilder.ipc', name: '进程通信模块', category: '系统', description: '提供单连接命名管道 UTF-8 文本通信和命名互斥体单实例判断。', tags: ['IPC', '命名管道'], commands: [
  command('IPC_创建管道服务端', [{ name: '名称', type: 'wideString', description: `${pipeNameArg}重复创建会先关闭上一个管道实例。`}], 'bool', '创建本机命名管道服务端。'),
  command('IPC_等待管道客户端', [], 'bool', '等待一个管道客户端连接。'),
  command('IPC_连接管道', [{ name: '名称', type: 'wideString', description: pipeNameArg}, { name: '超时毫秒', type: 'int', description: '等待管道出现的超时毫秒数；小于 0 时按 0 处理，即不等待直接尝试。'}], 'bool', '连接本机命名管道。'),
  command('IPC_发送文本', [{ name: '文本', type: 'wideString', description: '要发送的文本，按 UTF-8 编码并附带 4 字节长度前缀；未建立连接时返回假。'}], 'bool', '发送一条长度前缀 UTF-8 文本。'),
  command('IPC_接收文本', [], 'wideString', '接收一条长度前缀 UTF-8 文本。'),
  command('IPC_创建单实例锁', [{ name: '名称', type: 'wideString', description: `${pipeNameArg}同名互斥体已被其它实例占用时返回假。`}], 'bool', '创建命名互斥体；首次创建返回真。'),
  command('IPC_取错误', [], 'wideString', '返回最近 IPC 错误。'),
  command('IPC_关闭', [], 'void', '关闭管道和单实例锁。')
] });

const menu = createStandardModule({ id: 'lingbuilder.win32.menu', name: 'Win32菜单模块', category: '界面', description: '封装 HMENU 创建、菜单项、窗口菜单和弹出菜单返回命令。', tags: ['菜单', 'Win32'], commands: [
  command('菜单_创建', [], 'handle', '创建菜单栏。'), command('菜单_创建弹出菜单', [], 'handle', '创建弹出菜单。'),
  command('菜单_添加项目', [{ name: '菜单句柄', type: 'handle', description: menuHandleArg}, { name: '命令ID', type: 'int', description: '菜单项被点击时由 WM_COMMAND 收到的命令 ID，同一菜单内应唯一。'}, { name: '标题', type: 'wideString', description: '菜单项显示的文本。'}], 'bool', '添加普通菜单项。'),
  command('菜单_添加子菜单', [{ name: '菜单句柄', type: 'handle', description: menuHandleArg}, { name: '子菜单句柄', type: 'handle', description: '作为子菜单挂载的弹出菜单句柄；挂载后不要单独销毁它。'}, { name: '标题', type: 'wideString', description: '父菜单上显示的子菜单标题。'}], 'bool', '添加子菜单。'),
  command('菜单_添加分隔线', [{ name: '菜单句柄', type: 'handle', description: menuHandleArg}], 'bool', '添加分隔线。'),
  command('菜单_设置到窗口', [{ name: '窗口句柄', type: 'handle', description: windowHandleArg}, { name: '菜单句柄', type: 'handle', description: `${popupMenuHandleArg}传 0 表示移除窗口现有菜单。`}], 'bool', '把菜单设置为窗口菜单栏。'),
  command('菜单_弹出并取命令', [{ name: '菜单句柄', type: 'handle', description: popupMenuHandleArg}, { name: '窗口句柄', type: 'handle', description: `${windowHandleArg}用于确定菜单所属线程。`}, { name: '横坐标', type: 'int', description: '菜单左上角的屏幕横坐标，物理像素。'}, { name: '纵坐标', type: 'int', description: '菜单左上角的屏幕纵坐标，物理像素。'}], 'int', '显示弹出菜单并返回选择的命令 ID。'),
  command('菜单_销毁', [{ name: '菜单句柄', type: 'handle', description: `${menuHandleArg}仍挂在窗口上的菜单不能销毁。`}], 'bool', '销毁未附加或不再使用的菜单。')
] });

const tray = createStandardModule({ id: 'lingbuilder.win32.tray', name: '托盘图标模块', category: '界面', description: '向通知区域添加、修改、显示气泡和删除托盘图标。', tags: ['托盘', '通知'], commands: [
  command('托盘_添加', [{ name: '窗口句柄', type: 'handle', description: windowHandleArg}, { name: '编号', type: 'int', description: '托盘图标编号，同一窗口内用于区分多个图标，建议从 1 开始。'}, { name: '提示文本', type: 'wideString', description: trayTipArg}], 'bool', '使用应用默认图标添加托盘图标。'),
  command('托盘_修改提示', [{ name: '窗口句柄', type: 'handle', description: windowHandleArg}, { name: '编号', type: 'int', description: trayIdArg}, { name: '提示文本', type: 'wideString', description: '新的悬停提示文本；空文本会清空提示内容。'}], 'bool', '修改托盘提示文本。'),
  command('托盘_显示通知', [{ name: '窗口句柄', type: 'handle', description: windowHandleArg}, { name: '编号', type: 'int', description: trayIdArg}, { name: '标题', type: 'wideString', description: '气泡通知标题，空文本时使用 LingBuilder。'}, { name: '内容', type: 'wideString', description: '气泡正文，空文本时只显示标题；超出系统长度上限会被截断。'}], 'bool', '显示托盘气泡通知。'),
  command('托盘_删除', [{ name: '窗口句柄', type: 'handle', description: windowHandleArg}, { name: '编号', type: 'int', description: trayIdArg}], 'bool', '删除托盘图标。'),
  command('托盘_取回调消息号', [], 'int', '返回固定回调消息 WM_APP+77。')
] });

const accessibility = createStandardModule({ id: 'lingbuilder.win32.accessibility', name: '辅助功能模块', category: '界面', description: '通过 Microsoft Active Accessibility 读取窗口对象名称、值、角色和状态。', tags: ['无障碍', 'Accessibility'], commands: [
  command('辅助_取名称', [{ name: '窗口句柄', type: 'handle', description: '要读取的窗口句柄；无法取得可访问对象时返回空文本。'}], 'wideString', '读取窗口可访问对象名称。'),
  command('辅助_取值', [{ name: '窗口句柄', type: 'handle', description: '要读取的窗口句柄；对象没有值或无法访问时返回空文本。'}], 'wideString', '读取窗口可访问对象值。'),
  command('辅助_取角色', [{ name: '窗口句柄', type: 'handle', description: '要读取的窗口句柄；返回系统本地化的角色文本，无法访问时返回空文本。'}], 'wideString', '返回本地化角色文本。'),
  command('辅助_取状态值', [{ name: '窗口句柄', type: 'handle', description: '要读取的窗口句柄；返回 MSAA 状态位按位或的结果，无法访问时返回 0。'}], 'longLong', '返回 MSAA 状态位。')
] });

const memory = createStandardModule({ id: 'lingbuilder.advanced.memory', name: '受控内存模块', category: '系统', description: '只允许访问本模块登记的本进程内存块，拒绝任意裸地址。', tags: ['高级', '内存', '风险'], commands: [
  command('内存_申请', [{ name: '字节数', type: 'int', description: '要申请的字节数，1 到 268435456；超范围返回句柄 0，成功时内容全部清零。'}], 'handle', '申请清零内存并返回受控句柄。'),
  command('内存_写整数', [{ name: '内存句柄', type: 'handle', description: memHandleArg}, { name: '偏移', type: 'int', description: `${memOffsetArg}越过块尾放不下 4 个字节时返回假。`}, { name: '数值', type: 'int', description: '要写入的 32 位整数值，占 4 个字节。'}], 'bool', '在边界内写入 32 位整数。'),
  command('内存_读整数', [{ name: '内存句柄', type: 'handle', description: memHandleArg}, { name: '偏移', type: 'int', description: `${memOffsetArg}越界时返回 0。`}], 'int', '在边界内读取 32 位整数。'),
  command('内存_写UTF8文本', [{ name: '内存句柄', type: 'handle', description: memHandleArg}, { name: '偏移', type: 'int', description: memOffsetArg}, { name: '文本', type: 'wideString', description: '要写入的文本，按 UTF-8 编码并自动补一个零结尾；连同结尾零必须完整落在块内。'}], 'bool', '在边界内写入带零结尾 UTF-8 文本。'),
  command('内存_读UTF8文本', [{ name: '内存句柄', type: 'handle', description: memHandleArg}, { name: '偏移', type: 'int', description: memOffsetArg}, { name: '最大字节数', type: 'int', description: '最多读取的字节数；小于等于 0 或偏移越界返回空文本，遇到零字节提前结束。'}], 'wideString', '在边界内读取 UTF-8 文本。'),
  command('内存_释放', [{ name: '内存句柄', type: 'handle', description: memHandleArg}], 'bool', '释放受控内存块。')
] });

const hook = createStandardModule({ id: 'lingbuilder.advanced.hook', name: '键盘Hook模块', category: '系统', description: '提供当前桌面低级键盘 Hook 状态读取；不支持注入或修改其他进程。', tags: ['高级', 'Hook', '风险'], commands: [
  command('键盘钩子_启动', [], 'bool', '启动 WH_KEYBOARD_LL 钩子。'), command('键盘钩子_取最后键码', [], 'int', '读取最近键盘消息虚拟键码。'),
  command('键盘钩子_取消息数量', [], 'longLong', '读取钩子收到的消息数量。'), command('键盘钩子_停止', [], 'void', '卸载键盘钩子。')
] });

const processMemory = createStandardModule({ id: 'lingbuilder.advanced.process-memory', name: '进程内存模块', category: '系统', description: '显式打开目标进程并读写 32 位整数；属于高风险模块，不默认启用。', tags: ['高级', '进程内存', '风险'], commands: [
  command('进程内存_打开', [{ name: '进程ID', type: 'int', description: '目标进程 ID；句柄按需申请查询、读取和写入权限，受保护进程通常打开失败。'}, { name: '允许写入', type: 'bool', description: '传真时额外申请写入权限，是 进程内存_写整数 生效的前提。'}], 'handle', '打开目标进程句柄。'),
  command('进程内存_读整数', [{ name: '进程句柄', type: 'handle', description: procHandleArg}, { name: '地址', type: 'longLong', description: '目标进程内的字节地址，该处必须存在可读的 4 个字节。'}, { name: '默认值', type: 'int', description: '读取失败时返回的兜底整数。'}], 'int', '读取目标地址 32 位整数。'),
  command('进程内存_写整数', [{ name: '进程句柄', type: 'handle', description: `${procHandleArg}打开时未允许写入则必定失败。`}, { name: '地址', type: 'longLong', description: '目标进程内的字节地址，该处必须可写满 4 个字节。'}, { name: '数值', type: 'int', description: '要写入的 32 位整数值。'}], 'bool', '写入目标地址 32 位整数。'),
  command('进程内存_关闭', [{ name: '进程句柄', type: 'handle', description: '进程内存_打开 返回的进程句柄；传 0 直接返回假。'}], 'bool', '关闭目标进程句柄。')
] });

const comHandlerParameter: ModuleCommandBindingParameter & { description: string } = {
  name: '处理器',
  type: 'handler',
  description: '必须使用 &处理器名；事件到达窗口线程时回调，签名：空 处理器(整数型 用户数据, 文本型 参数文本)。',
  handlerSignature: { parameterTypes: ['整数型', '文本型'], returnType: '空' }
};
const comVariadicParameter: ModuleCommandBindingParameter & { description: string } = { name: '参数', type: 'lingValue', variadic: true, description: '按值传入 COM 方法；支持整数、长整数、小数、逻辑值和文本。' };

const com = createStandardModule({
  id: 'lingbuilder.advanced.com',
  name: 'COM自动化模块',
  version: '2.0.0',
  category: '系统',
  description: '句柄制 COM 自动化：注册或免注册创建 IDispatch 对象、OCX 控件窗口宿主、事件挂接与映射、类型化属性和带参方法调用、接口信息查看。纯 C++ 运行时，同时支持 32 位和 64 位目标。',
  tags: ['高级', 'COM'],
  docs: [{ title: 'COM自动化模块使用说明', path: 'docs/modules/advanced/com.md' }],
  commands: [
    { name: 'COM_创建对象', signature: 'COM_创建对象(ProgID)', description: '通过 ProgID 创建 COM 自动化对象，返回 COM 对象句柄，0 表示失败。', insertText: 'COM_创建对象("$1")', parameters: [{ name: 'ProgID', type: 'wideString', description: '如 "WScript.Shell" 或 "Shell.Application"。' }], returnType: 'longLong', example: 'COM_创建对象("Shell.Application")' },
    { name: 'COM_创建对象免注册', signature: 'COM_创建对象免注册(CLSID, 组件DLL路径)', description: '加载组件 DLL 并通过 DllGetClassObject 免注册创建 COM 对象；组件位数必须与程序位数一致。', insertText: 'COM_创建对象免注册("$1", "$2")', parameters: [{ name: 'CLSID', type: 'wideString', description: '"{XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX}" 形式。' }, { name: '组件DLL路径', type: 'wideString', description: '组件 DLL 完整路径。' }], returnType: 'longLong', example: 'COM_创建对象免注册("{0D43FE01-F093-11CF-8940-00A0C9054228}", "C:\\Windows\\System32\\scrrun.dll")' },
    { name: 'COM_注册组件', signature: 'COM_注册组件(组件DLL路径)', description: '加载组件 DLL 并调用 DllRegisterServer 把 OCX/DLL 注册到系统（需要管理员权限时由系统返回失败）。', insertText: 'COM_注册组件("$1")', parameters: [{ name: '组件DLL路径', type: 'wideString', description: '组件完整路径。' }], returnType: 'bool', example: 'COM_注册组件(COM_取组件路径("FoxitReader_AX_Pro.ocx"))' },
    { name: 'COM_注销组件', signature: 'COM_注销组件(组件DLL路径)', description: '加载组件 DLL 并调用 DllUnregisterServer 从系统注销；程序退出前注销随程序携带的组件即可实现绿色免安装。', insertText: 'COM_注销组件("$1")', parameters: [{ name: '组件DLL路径', type: 'wideString', description: '组件完整路径。' }], returnType: 'bool', example: 'COM_注销组件(COM_取组件路径("FoxitReader_AX_Pro.ocx"))' },
    { name: 'COM_取组件路径', signature: 'COM_取组件路径(文件名)', description: '返回当前 exe 所在目录与文件名拼接的完整路径，用于随程序携带的组件定位。', insertText: 'COM_取组件路径("$1")', parameters: [{ name: '文件名', type: 'wideString', description: '如 "FoxitReader_AX_Pro.ocx"。' }], returnType: 'wideString', example: '文本型 组件 = COM_取组件路径("FoxitReader_AX_Pro.ocx")' },
    { name: 'COM_创建OCX组件', signature: 'COM_创建OCX组件(父窗口, 类标识, 左边, 顶边, 宽度, 高度, [边框])', description: '在父窗口内以 AtlAxWin 宿主一个 ActiveX/OCX 控件，返回 OCX 宿主窗口句柄；对象用 COM_取OCX对象 取回。边框：0 无边框，1 凹入式，2 凸出式，3 浅凹入式，4 镜框式，5 单线边框。', insertText: 'COM_创建OCX组件($1, "$2", 12, 64, 620, 380, 1)', parameters: [{ name: '父窗口', type: 'controlRef', description: '裸控件名或 当前窗口。', controlKinds: ['visual'], scope: 'currentWindow', runtimeRepresentation: 'nativeHandle' }, { name: '类标识', type: 'wideString', description: '控件 CLSID（带花括号）或 ProgID。' }, { name: '左边', type: 'int', description: '控件在父窗口客户区内的左边位置，物理像素。'}, { name: '顶边', type: 'int', description: '控件在父窗口客户区内的上边位置，物理像素。'}, { name: '宽度', type: 'int', description: '控件初始宽度，物理像素。'}, { name: '高度', type: 'int', description: '控件初始高度，物理像素。'}, { name: '边框', type: 'int', optional: true, defaultValue: 0, description: '缺省 0 表示无边框。' }], returnType: 'longLong', example: 'COM_创建OCX组件(当前窗口, "{8856F961-340A-11D0-A96B-00C04FD705A2}", 12, 64, 620, 380, 1)' },
    { name: 'COM_取OCX对象', signature: 'COM_取OCX对象(OCX窗口句柄)', description: '取 OCX 宿主窗口内的 COM 对象句柄。', insertText: 'COM_取OCX对象($1)', parameters: [{ name: 'OCX窗口句柄', type: 'longLong', description: 'COM_创建OCX组件 返回的宿主窗口句柄；宿主窗口被销毁后失效。'}], returnType: 'longLong', example: '浏览器 = COM_取OCX对象(浏览器窗口)' },
    { name: 'COM_取文本属性', signature: 'COM_取文本属性(对象, 属性名)', description: '读取文本或可转文本属性。', insertText: 'COM_取文本属性($1, "$2")', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '属性名', type: 'wideString', description: `${comNameArg}返回的属性会尽量转成文本。`}], returnType: 'wideString', example: 'COM_取文本属性(浏览器, "LocationName")' },
    { name: 'COM_取数值属性', signature: 'COM_取数值属性(对象, 属性名)', description: '读取数值属性，返回双精度小数。', insertText: 'COM_取数值属性($1, "$2")', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '属性名', type: 'wideString', description: `${comNameArg}属性不是数值类型时转换失败返回 0。`}], returnType: 'double', example: 'COM_取数值属性(浏览器, "Top")' },
    { name: 'COM_取逻辑属性', signature: 'COM_取逻辑属性(对象, 属性名)', description: '读取逻辑属性。', insertText: 'COM_取逻辑属性($1, "$2")', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '属性名', type: 'wideString', description: comNameArg}], returnType: 'bool', example: 'COM_取逻辑属性(浏览器, "Busy")' },
    { name: 'COM_取对象属性', signature: 'COM_取对象属性(对象, 属性名)', description: '读取对象类型属性并返回新的 COM 对象句柄，用 COM_关闭 释放。', insertText: 'COM_取对象属性($1, "$2")', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '属性名', type: 'wideString', description: '要读取的子对象属性名；返回的新句柄需要单独 COM_关闭。'}], returnType: 'longLong', example: '文档 = COM_取对象属性(浏览器, "Document")' },
    { name: 'COM_置文本属性', signature: 'COM_置文本属性(对象, 属性名, 值)', description: '写入属性；值按文本传入（VT_BSTR），目标属性为数值或逻辑时由组件自动转换类型，只读属性写入失败。', insertText: 'COM_置文本属性($1, "$2", "$3")', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '属性名', type: 'wideString', description: '要写入的属性名；只读属性写入失败。'}, { name: '值', type: 'wideString', description: '以文本形式提交的属性值，目标属性为数值或逻辑类型时由组件自行转换。'}], returnType: 'bool', example: 'COM_置文本属性(对象, "Language", "VBScript")' },
    { name: 'COM_调用方法', signature: 'COM_调用方法(对象, 方法名, 参数...)', description: '调用 COM 方法，参数按值传入；成功返回真。', insertText: 'COM_调用方法($1, "$2", $0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '方法名', type: 'wideString', description: `${comNameArg}返回值被丢弃，只判断是否成功。`}, comVariadicParameter], returnType: 'bool', example: 'COM_调用方法(浏览器, "Navigate2", "https://www.lingbuilder.com")' },
    { name: 'COM_调用文本方法', signature: 'COM_调用文本方法(对象, 方法名, 参数...)', description: '调用 COM 方法并把返回值转为文本。', insertText: 'COM_调用文本方法($1, "$2", $0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '方法名', type: 'wideString', description: `${comNameArg}返回值按组件转换规则转成文本。`}, comVariadicParameter], returnType: 'wideString', example: 'COM_调用文本方法(对象, "BuildPath", "C:", "a.txt")' },
    { name: 'COM_调用数值方法', signature: 'COM_调用数值方法(对象, 方法名, 参数...)', description: '调用 COM 方法并把返回值转为双精度小数。', insertText: 'COM_调用数值方法($1, "$2", $0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '方法名', type: 'wideString', description: `${comNameArg}返回值转成双精度小数，不可转换时返回 0。`}, comVariadicParameter], returnType: 'double', example: 'COM_调用数值方法(对象, "GetSpecialFolderSize", 0)' },
    { name: 'COM_调用逻辑方法', signature: 'COM_调用逻辑方法(对象, 方法名, 参数...)', description: '调用 COM 方法并把返回值转为逻辑值。', insertText: 'COM_调用逻辑方法($1, "$2", $0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '方法名', type: 'wideString', description: `${comNameArg}返回值转成逻辑值。`}, comVariadicParameter], returnType: 'bool', example: 'COM_调用逻辑方法(对象, "FolderExists", "C:\\Windows")' },
    { name: 'COM_调用对象方法', signature: 'COM_调用对象方法(对象, 方法名, 参数...)', description: '调用返回对象的 COM 方法，返回新的 COM 对象句柄。', insertText: 'COM_调用对象方法($1, "$2", $0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '方法名', type: 'wideString', description: '要调用的方法名；返回对象类型的方法才适用，取到的新句柄需要单独 COM_关闭。'}, comVariadicParameter], returnType: 'longLong', example: '文件夹 = COM_调用对象方法(文件系统, "GetFolder", "C:\\Windows")' },
    { name: 'COM_挂接事件', signature: 'COM_挂接事件(对象)', description: '挂接对象的全部事件连接点，返回事件句柄（非 0）；失败返回 0 并可用 COM_取错误 查看原因。', insertText: 'COM_挂接事件($1)', parameters: [{ name: '对象', type: 'longLong', description: `${comObjectArg}对象必须支持 IConnectionPointContainer。`}], returnType: 'int', example: '事件句柄 = COM_挂接事件(浏览器)' },
    { name: 'COM_映射事件', signature: 'COM_映射事件(对象, 事件ID, &处理器, [用户数据])', description: '把 COM 事件 ID 映射到当前类的处理器；处理器签名：空 处理器(整数型 用户数据, 文本型 参数文本)，事件参数按制表符拼接，对象参数为 [COM对象] 占位。', insertText: 'COM_映射事件($1, 102, &$3, 0)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '事件ID', type: 'int', description: 'DISPID，可用 COM_取接口信息 查看。' }, comHandlerParameter, { name: '用户数据', type: 'int', optional: true, defaultValue: 0 , description: '原样传给处理器的自定义整数，用于在一个对象的多个映射之间区分来源。'}], returnType: 'bool', example: 'COM_映射事件(浏览器, 102, &网页_状态文本改变, 0)' },
    { name: 'COM_取消挂接事件', signature: 'COM_取消挂接事件(对象, 事件句柄)', description: '取消事件挂接并清除该对象的全部事件映射。', insertText: 'COM_取消挂接事件($1, $2)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}, { name: '事件句柄', type: 'int', description: 'COM_挂接事件 返回的事件句柄；关闭对象时也会自动取消。'}], returnType: 'bool', example: 'COM_取消挂接事件(浏览器, 事件句柄)' },
    { name: 'COM_取事件对象参数', signature: 'COM_取事件对象参数(序号)', description: '仅在事件处理器内有效：把第 N 个（从 0 开始）对象类型事件参数包装为新的 COM 对象句柄。', insertText: 'COM_取事件对象参数($1)', parameters: [{ name: '序号', type: 'int', description: '要包装的事件参数序号，从 0 起，只在事件处理器执行期间有效。'}], returnType: 'longLong', example: '发件对象 = COM_取事件对象参数(0)' },
    { name: 'COM_启用OCX消息转发', signature: 'COM_启用OCX消息转发()', description: '安装当前线程消息钩子，把键盘和鼠标消息转发给 OCX 宿主窗口（WM_FORWARDMSG）。', insertText: 'COM_启用OCX消息转发()', parameters: [], returnType: 'bool', example: 'COM_启用OCX消息转发()' },
    { name: 'COM_移除OCX消息转发', signature: 'COM_移除OCX消息转发()', description: '移除 OCX 消息转发钩子。', insertText: 'COM_移除OCX消息转发()', parameters: [], returnType: 'bool', example: 'COM_移除OCX消息转发()' },
    { name: 'COM_取接口信息', signature: 'COM_取接口信息(对象)', description: '通过 ITypeInfo 返回接口摘要文本：类型名、GUID 和属性、方法（含 DISPID）、事件清单，用于确定映射事件的事件 ID。', insertText: 'COM_取接口信息($1)', parameters: [{ name: '对象', type: 'longLong', description: comObjectArg}], returnType: 'wideString', example: '调试输出(COM_取接口信息(浏览器))' },
    { name: 'COM_关闭', signature: 'COM_关闭(对象)', description: '释放一个 COM 对象（含其 OCX 宿主窗口与事件挂接）。', insertText: 'COM_关闭($1)', parameters: [{ name: '对象', type: 'longLong', description: `${comObjectArg}同时释放其 OCX 宿主窗口与事件挂接。`}], returnType: 'bool', example: 'COM_关闭(浏览器)' },
    { name: 'COM_关闭全部', signature: 'COM_关闭全部()', description: '释放当前程序创建的全部 COM 对象；窗口销毁时自动调用。', insertText: 'COM_关闭全部()', parameters: [], returnType: 'bool', example: 'COM_关闭全部()' },
    { name: 'COM_取错误', signature: 'COM_取错误()', description: '返回最近一次 COM 操作的中文错误文本。', insertText: 'COM_取错误()', parameters: [], returnType: 'wideString', example: '调试输出(COM_取错误())' }
  ]
});

const assembly = createStandardModule({ id: 'lingbuilder.advanced.assembly', name: 'CPU指令能力模块', category: '系统', description: '提供 CPUID 和位运算封装，不执行用户提供的机器码。', tags: ['高级', 'CPU', '汇编'], commands: [
  command('CPU_取厂商', [], 'wideString', '返回 CPUID 厂商标识。'), command('CPU_是否支持SSE2', [], 'bool', '检查 SSE2。'),
  command('CPU_是否支持AVX', [], 'bool', '检查 CPU 和操作系统是否启用 AVX。'), command('位运算_统计一位数量', [{ name: '数值', type: 'longLong', description: '要统计的 64 位数值；负数按补码的置位数量统计。'}], 'int', '统计 64 位数值中的 1 位数量。'),
  command('位运算_循环左移', [{ name: '数值', type: 'longLong', description: '要移位的 64 位数值。'}, { name: '位数', type: 'int', description: '循环左移的位数；实际位移取该值与 63 按位与的结果，负数同样按补码取模。'}], 'longLong', '执行 64 位循环左移。')
] });

const driver = createStandardModule({ id: 'lingbuilder.advanced.driver', name: '设备驱动通信模块', category: '系统', description: '打开显式设备路径并执行无缓冲区 IOCTL；需要相应驱动权限，不负责安装或提权。', tags: ['高级', '驱动', '风险'], commands: [
  command('设备_打开', [{ name: '设备路径', type: 'wideString', description: '系统给出的设备接口路径，不是普通文件名；打不开时返回 0 并可用 设备_取错误码 查看原因。'}, { name: '允许写入', type: 'bool', description: '传真时以读写方式打开，执行会改变设备状态的 IOCTL 才需要。'}], 'handle', '打开 \\.\\DeviceName 形式设备。'),
  command('设备_无参数控制', [{ name: '设备句柄', type: 'handle', description: '设备_打开 返回的设备句柄。'}, { name: '控制码', type: 'int', description: 'IOCTL 控制码；本命令不带任何输入输出缓冲区。'}], 'bool', '执行无输入输出缓冲区 DeviceIoControl。'),
  command('设备_关闭', [{ name: '设备句柄', type: 'handle', description: '设备_打开 返回的设备句柄；传 0 直接返回假。'}], 'bool', '关闭设备句柄。'),
  command('设备_取错误码', [], 'int', '返回最近设备操作 Win32 错误码。')
] });

export const PLATFORM_ADVANCED_MODULES: LingBuilderModuleManifest[] = [archive, mail, ipc, menu, tray, accessibility, memory, hook, processMemory, com, assembly, driver];
