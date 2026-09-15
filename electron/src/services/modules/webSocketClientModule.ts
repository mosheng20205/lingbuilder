import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType
} from './types';

type WebSocketClientCategory = '连接' | '配置' | '安全' | '事件' | '消息' | '状态' | '兼容';

interface WebSocketClientCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: WebSocketClientCategory;
  insertText?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description: string
): ModuleCommandBindingParameter => ({ name, type, description });

// 以下说明按 webSocketClientRuntime.ts 的实际校验逻辑核实，重复语义提取为共享常量。
const wsConnectionArg = 'WS_创建连接 返回的受管连接 ID；ID 无效或已销毁时命令返回假。';
const wsStoppedArg = 'WS_创建连接 返回的受管连接 ID；连接必须处于停止状态，运行中修改配置会被拒绝。';
const wsHandlerArg = '必须使用 &处理器名；处理器必须无参数，事件内容用 WS_取当前事件类型 等系列命令读取。';
const wsCloseCodeArg = 'RFC 6455 关闭状态码，取 1000 到 4999；保留码 1004、1005、1006、1015 和 1016 到 2999 不允许，常用值是 1000 正常关闭和 1001 离开。';
const wsCloseReasonArg = '关闭原因文本，UTF-8 编码后不得超过 123 字节；空文本表示不带原因。';
const wsTextArg = '要发送的文本，按 UTF-8 编码为一条完整消息；含未配对代理项或超过单次发送上限时返回假。';

const specs: WebSocketClientCommandSpec[] = [
  {
    name: 'WS_创建连接', signature: 'WS_创建连接()', description: '创建尚未启动的受管 WebSocket 客户端并返回稳定连接 ID。',
    parameters: [], returnType: 'WebSocket连接', returnLabel: 'WebSocket连接', category: '连接'
  },
  {
    name: 'WS_配置连接', signature: 'WS_配置连接(连接, 地址)', description: '配置 ws:// 或 wss:// 地址；只能在连接停止时修改。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('地址', 'wideString', 'WebSocket 服务地址，必须以 ws:// 或 wss:// 开头且不能含换行；wss:// 由系统 TLS 完成证书校验。')], returnType: 'bool', returnLabel: '逻辑型', category: '配置',
    insertText: 'WS_配置连接($1, "wss://example.com/ws")'
  },
  {
    name: 'WS_设置资源限制', signature: 'WS_设置资源限制(连接, 连接超时毫秒, 接收超时毫秒, 消息上限MB, 单次发送上限MB)', description: '设置连接/接收超时和消息硬限制，防止无限阻塞或超大消息耗尽内存。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('连接超时毫秒', 'int', '握手连接超时毫秒数，1000 到 300000。'), parameter('接收超时毫秒', 'int', '单次接收等待上限毫秒数，1000 到 3600000。'), parameter('消息上限MB', 'int', '单条消息重组后的字节上限，单位 MB，1 到 1024；超限按协议错误断开。'), parameter('单次发送上限MB', 'int', '单条消息允许发送的字节上限，单位 MB，1 到 1024；超限拒绝发送。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WS_设置资源限制($1, 15000, 60000, 16, 8)'
  },
  {
    name: 'WS_设置UserAgent', signature: 'WS_设置UserAgent(连接, UserAgent)', description: '设置握手使用的 User-Agent；只能在连接停止时修改。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('UserAgent', 'wideString', '握手使用的 User-Agent 文本，不能含换行；空文本时使用 LingBuilder WebSocket Client/2.0。')], returnType: 'bool', returnLabel: '逻辑型', category: '配置'
  },
  {
    name: 'WS_设置请求头', signature: 'WS_设置请求头(连接, 请求头)', description: '设置 UTF-16 原始请求头，每行一个“名称: 值”；禁止覆盖 WebSocket 升级关键头。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('请求头', 'wideString', '每行一条“名称: 值”的原始请求头文本；不得覆盖 Upgrade、Connection、Host、Sec-WebSocket-Key、Sec-WebSocket-Version、Sec-WebSocket-Extensions、Sec-WebSocket-Protocol 和 Origin。')], returnType: 'bool', returnLabel: '逻辑型', category: '配置',
    insertText: 'WS_设置请求头($1, "Authorization: Bearer token")'
  },
  {
    name: 'WS_设置Origin', signature: 'WS_设置Origin(连接, 来源)', description: '设置 WebSocket 握手 Origin；空文本表示不发送。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('来源', 'wideString', '握手 Origin 文本，例如 https://example.com；不能含换行，空文本表示不发送该头。')], returnType: 'bool', returnLabel: '逻辑型', category: '配置'
  },
  {
    name: 'WS_设置子协议', signature: 'WS_设置子协议(连接, 子协议列表)', description: '设置逗号分隔的客户端子协议优先表，并校验服务端选择结果。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('子协议列表', 'wideString', '逗号分隔的子协议 token 优先级列表，越靠前越优先；含非法 token 会被拒绝，服务端返回未请求的子协议时握手失败。')], returnType: 'bool', returnLabel: '逻辑型', category: '配置',
    insertText: 'WS_设置子协议($1, "chat.v2, chat.v1")'
  },
  {
    name: 'WS_设置代理', signature: 'WS_设置代理(连接, 模式, 代理地址, 绕过列表)', description: '设置代理模式：0=系统自动，1=直连，2=固定代理；固定代理格式遵循 WinHTTP。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('模式', 'int', '代理模式：0 跟随系统设置，1 直连不使用代理，2 固定代理地址。'), parameter('代理地址', 'wideString', '固定代理地址，格式遵循 WinHTTP，例如 127.0.0.1:8888；模式为 2 时不能为空，且不能含换行。'), parameter('绕过列表', 'wideString', '不走代理的主机列表，分号分隔，可为空文本但不能含换行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '配置', insertText: 'WS_设置代理($1, 0, "", "")'
  },
  {
    name: 'WS_设置服务器凭据', signature: 'WS_设置服务器凭据(连接, 用户名, 密码)', description: '设置握手服务器 HTTP Basic 身份验证凭据；仅保存在连接对象内存中。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('用户名', 'wideString', '目标服务器 Basic 验证的用户名，不能含换行。'), parameter('密码', 'wideString', 'Basic 验证密码，只保存在连接对象内存中，不能含换行。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'WS_设置代理凭据', signature: 'WS_设置代理凭据(连接, 用户名, 密码)', description: '设置代理 HTTP Basic 身份验证凭据；仅保存在连接对象内存中。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('用户名', 'wideString', '代理服务器 Basic 验证的用户名，不能含换行。'), parameter('密码', 'wideString', '代理 Basic 验证密码，只保存在连接对象内存中，不能含换行。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'WS_设置TLS验证', signature: 'WS_设置TLS验证(连接, 验证证书, 允许自签名, 证书SHA256)', description: '配置 wss:// 证书验证和可选 SHA-256 证书固定；关闭验证属于高风险调试能力。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('验证证书', 'bool', '传真执行完整的证书链与域名校验；传假关闭校验，属于高风险调试能力。'), parameter('允许自签名', 'bool', '传真时额外接受自签名证书，其余校验保持不变。'), parameter('证书SHA256', 'wideString', '要固定的服务端证书 SHA-256 指纹，64 位十六进制文本，可含冒号或空格；空文本表示不做指纹固定。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '安全', visibility: 'advanced', insertText: 'WS_设置TLS验证($1, 真, 假, "")'
  },
  {
    name: 'WS_设置自动重连', signature: 'WS_设置自动重连(连接, 启用, 最大次数, 初始延迟毫秒, 最大延迟毫秒)', description: '设置意外断开后的指数退避重连；主动关闭不会触发重连。',
    parameters: [parameter('连接', 'WebSocket连接', wsStoppedArg), parameter('启用', 'bool', '传真在意外断开后按指数退避自动重连；主动 WS_关闭连接 不会触发重连。'), parameter('最大次数', 'int', '单个启动周期内允许的最大重连次数，1 到 1000，仅在启用时校验。'), parameter('初始延迟毫秒', 'int', '首次重连前的等待毫秒数，100 到 300000。'), parameter('最大延迟毫秒', 'int', '退避延迟上限毫秒数，不得小于初始延迟且不超过 3600000。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '配置', insertText: 'WS_设置自动重连($1, 真, 8, 500, 30000)'
  },
  ...([
    ['WS_绑定已连接处理器', '已连接'],
    ['WS_绑定消息处理器', '消息'],
    ['WS_绑定已断开处理器', '已断开'],
    ['WS_绑定错误处理器', '错误'],
    ['WS_绑定重连处理器', '重连']
  ] as const).map(([name, event]) => ({
    name,
    signature: `${name}(连接, &处理器)`,
    description: `绑定${event}事件处理器；处理器通过窗口消息在创建连接的 UI 线程执行，并使用 WS_取当前事件系列命令读取快照。`,
    parameters: [
      parameter('连接', 'WebSocket连接', wsConnectionArg),
      { ...parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。'), handlerSignature: { parameterTypes: [], returnType: '空' } }
    ],
    returnType: 'bool' as const,
    returnLabel: '逻辑型',
    category: '事件' as const,
    insertText: `${name}($1, &$2)`
  })),
  {
    name: 'WS_开始连接', signature: 'WS_开始连接(连接)', description: '在后台启动连接、握手和接收循环，不阻塞 UI 线程。',
    parameters: [parameter('连接', 'WebSocket连接', `${wsConnectionArg}必须已配置地址且尚未启动，重复启动返回假。`)], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  {
    name: 'WS_等待连接', signature: 'WS_等待连接(连接, 超时毫秒)', description: '等待连接进入“已连接”或失败状态；主要用于命令行和测试，UI 代码应使用已连接处理器。',
    parameters: [parameter('连接', 'WebSocket连接', wsConnectionArg), parameter('超时毫秒', 'int', '等待进入已连接或失败状态的毫秒数，0 到 3600000；在界面事件里等待会卡住界面。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  {
    name: 'WS_关闭连接', signature: 'WS_关闭连接(连接, 状态码, 原因)', description: '发送关闭帧并停止后台接收；状态码和 UTF-8 原因按 RFC 6455 校验。',
    parameters: [parameter('连接', 'WebSocket连接', wsConnectionArg), parameter('状态码', 'int', wsCloseCodeArg), parameter('原因', 'wideString', wsCloseReasonArg)], returnType: 'bool', returnLabel: '逻辑型', category: '连接',
    insertText: 'WS_关闭连接($1, 1000, "正常关闭")'
  },
  {
    name: 'WS_强制断开', signature: 'WS_强制断开(连接)', description: '立即关闭底层 WinHTTP 句柄并停止自动重连，仅用于超时或故障恢复。',
    parameters: [parameter('连接', 'WebSocket连接', `${wsConnectionArg}强制断开后不会再自动重连。`)], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  {
    name: 'WS_销毁连接', signature: 'WS_销毁连接(连接)', description: '停止并释放受管连接；重复销毁返回假。',
    parameters: [parameter('连接', 'WebSocket连接', 'WS_创建连接 返回的连接 ID；销毁会先停止后台线程，重复销毁返回假。')], returnType: 'bool', returnLabel: '逻辑型', category: '连接'
  },
  ...([
    ['WS_是否已连接', 'bool', '逻辑型', '判断连接是否已完成握手且未进入关闭状态。'],
    ['WS_取连接状态', 'wideString', '文本型', '返回连接状态：未配置、已停止、连接中、已连接、重连等待、关闭中或错误。'],
    ['WS_取连接地址', 'wideString', '文本型', '返回当前配置的 ws:// 或 wss:// 地址。'],
    ['WS_取协商子协议', 'wideString', '文本型', '返回服务端握手选择的子协议。'],
    ['WS_取握手响应头', 'wideString', '文本型', '返回最近一次 WebSocket 握手的完整响应头。'],
    ['WS_取握手状态码', 'int', '整数型', '返回最近一次握手 HTTP 状态码。'],
    ['WS_取连接错误', 'wideString', '文本型', '返回连接最近一次中文错误信息。'],
    ['WS_取连接时长', 'longLong', '长整数型', '返回当前连接完成握手后的在线毫秒数。'],
    ['WS_取发送字节数', 'longLong', '长整数型', '返回累计成功发送的应用负载字节数。'],
    ['WS_取接收字节数', 'longLong', '长整数型', '返回累计接收的应用负载字节数。'],
    ['WS_取发送消息数', 'longLong', '长整数型', '返回累计成功发送的文本和二进制消息数。'],
    ['WS_取接收消息数', 'longLong', '长整数型', '返回累计接收的完整文本和二进制消息数。'],
    ['WS_取重连次数', 'int', '整数型', '返回当前启动周期已经执行的自动重连次数。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}(连接)`, description,
    parameters: [parameter('连接', 'WebSocket连接', wsConnectionArg)], returnType, returnLabel, category: '状态' as const
  })),
  {
    name: 'WS_发送文本到连接', signature: 'WS_发送文本到连接(连接, 内容)', description: '向指定已连接客户端发送一条完整 UTF-8 文本消息，并执行 UTF-8 与发送大小校验。',
    parameters: [parameter('连接', 'WebSocket连接', wsConnectionArg), parameter('内容', 'wideString', wsTextArg)], returnType: 'bool', returnLabel: '逻辑型', category: '消息',
    insertText: 'WS_发送文本到连接($1, "$2")'
  },
  {
    name: 'WS_发送二进制到连接', signature: 'WS_发送二进制到连接(连接, 数据)', description: '向指定已连接客户端发送一条完整二进制消息。',
    parameters: [parameter('连接', 'WebSocket连接', wsConnectionArg), parameter('数据', 'bytes', '要发送的字节集，作为一条完整二进制消息；超过单次发送上限时返回假。')], returnType: 'bool', returnLabel: '逻辑型', category: '消息'
  },
  ...([
    ['WS_取当前事件类型', 'wideString', '文本型', '返回当前回调事件类型：已连接、文本、二进制、已断开、错误或重连。'],
    ['WS_取当前连接', 'WebSocket连接', 'WebSocket连接', '返回当前事件对应的受管连接 ID。'],
    ['WS_取当前消息类型', 'wideString', '文本型', '返回当前消息类型：文本或二进制；其它事件返回空文本。'],
    ['WS_取当前文本', 'wideString', '文本型', '返回当前文本消息的不可变快照。'],
    ['WS_取当前二进制', 'bytes', '字节集', '返回当前二进制消息的独立字节集副本。'],
    ['WS_取当前关闭代码', 'int', '整数型', '返回当前断开事件的 WebSocket 关闭状态码。'],
    ['WS_取当前关闭原因', 'wideString', '文本型', '返回当前断开事件的 UTF-8 关闭原因。'],
    ['WS_取当前错误', 'wideString', '文本型', '返回当前错误事件的中文说明。'],
    ['WS_取当前重连次数', 'int', '整数型', '返回当前重连事件对应的重试序号。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}()`, description, parameters: [], returnType, returnLabel, category: '事件' as const
  })),
  {
    name: 'WS_连接', signature: 'WS_连接(地址)', description: '旧版单连接兼容入口；同步等待最多 30 秒，新代码应使用受管连接和事件处理器。',
    parameters: [parameter('地址', 'wideString', '旧版默认连接的 ws:// 或 wss:// 地址；同步等待最多 30 秒。')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WS_发送文本', signature: 'WS_发送文本(内容)', description: '旧版兼容入口；向默认受管连接发送文本。',
    parameters: [parameter('内容', 'wideString', wsTextArg)], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WS_接收到调试输出', signature: 'WS_接收到调试输出()', description: '旧版阻塞兼容入口；等待一条默认连接文本消息并写入调试输出。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WS_接收文本', signature: 'WS_接收文本()', description: '旧版阻塞兼容入口；等待并返回默认连接的下一条文本消息。',
    parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WS_关闭', signature: 'WS_关闭()', description: '旧版兼容入口；关闭并销毁默认受管连接。',
    parameters: [], returnType: 'void', returnLabel: '空', category: '兼容', visibility: 'advanced'
  }
];

function contribution(spec: WebSocketClientCommandSpec): ModuleCommandContribution {
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || `${spec.name}(${spec.parameters.map((item, index) => item.type === 'handler' ? `&$${index + 1}` : `$${index + 1}`).join(', ')})`,
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: spec.category === '兼容' ? 'secureReplacement' : 'managed',
    visibility: spec.visibility
  };
}

function binding(spec: WebSocketClientCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: spec.parameters.some(item => item.type === 'wideString' || item.type === 'handler') ? 'wide' : 'raw',
    example: spec.example || spec.insertText?.replace(/\$\d+/gu, '示例值') || `${spec.name}()`,
    description: spec.description
  };
}

export const WEBSOCKET_CLIENT_COMMAND_SPECS = specs;

export const WEBSOCKET_CLIENT_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: 'lingbuilder.websocket.client',
  name: 'WebSocket 客户端模块',
  version: '2.0.0',
  minLingBuilderVersion: '0.2.8',
  category: '网络',
  description: '提供受管 WinHTTP WebSocket 客户端、多连接、后台接收、文本与二进制消息、wss://、代理、身份验证、证书固定、自动重连、资源限制和运行统计。',
  author: 'LingBuilder',
  license: 'LingBuilder Built-in Module License',
  tags: ['内置', '网络', 'WebSocket', '客户端', 'WinHTTP', 'wss', 'TLS', '自动重连', '受管连接'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'WebSocket连接', description: '进程内不复用的受管 WebSocket 客户端 ID，不暴露原生 HINTERNET。', cppType: 'long long' }
    ],
    snippets: [
      {
        label: 'WebSocket 受管客户端',
        insertText: 'WebSocket连接 连接 = WS_创建连接()\nWS_配置连接(连接, "wss://example.com/ws")\nWS_设置资源限制(连接, 15000, 60000, 16, 8)\nWS_设置子协议(连接, "chat.v2, chat.v1")\nWS_设置自动重连(连接, 真, 8, 500, 30000)\nWS_绑定已连接处理器(连接, &连接成功)\nWS_绑定消息处理器(连接, &收到消息)\nWS_绑定已断开处理器(连接, &连接断开)\nWS_绑定错误处理器(连接, &连接错误)\nWS_开始连接(连接)',
        description: '创建具有资源限制、子协议、自动重连和 UI 线程事件的受管客户端。'
      },
      {
        label: 'WebSocket 客户端消息处理器',
        insertText: '空 收到消息()\n    如果 (WS_取当前消息类型() == "文本")\n        调试输出(WS_取当前文本())\n    如果结束\n结束',
        description: '在消息处理器中读取不可变事件快照。'
      }
    ],
    docs: [{ title: 'WebSocket 客户端模块 2.0 使用说明', path: 'docs/modules/websocket-client/README.md' }]
  },
  targets: [
    {
      id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_WEBSOCKET_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    },
    {
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_WEBSOCKET_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    }
  ],
  bindings: { commands: specs.map(binding) }
};
