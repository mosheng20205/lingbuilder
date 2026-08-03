import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType
} from './types';

type WebSocketServerCategory = '服务' | '安全' | '事件' | '客户端' | '消息' | '状态' | '兼容';

interface WebSocketServerCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: WebSocketServerCategory;
  insertText?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description?: string
): ModuleCommandBindingParameter => ({ name, type, description });

const specs: WebSocketServerCommandSpec[] = [
  {
    name: 'WSS_创建服务', signature: 'WSS_创建服务()', description: '创建尚未启动的受管 WebSocket 服务端并返回稳定句柄。',
    parameters: [], returnType: 'WebSocket服务端', returnLabel: 'WebSocket服务端', category: '服务'
  },
  {
    name: 'WSS_配置服务', signature: 'WSS_配置服务(服务端, 监听地址, 端口, 最大客户端数)', description: '配置监听地址、端口和最大并发客户端数；只能在停止状态修改。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('监听地址', 'wideString'), parameter('端口', 'int'), parameter('最大客户端数', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'WSS_配置服务($1, "127.0.0.1", 18080, 512)'
  },
  {
    name: 'WSS_设置资源限制', signature: 'WSS_设置资源限制(服务端, 握手头上限KB, 消息上限MB, 单客户端发送队列上限MB, 超时毫秒)', description: '设置握手、消息、发送背压和空闲连接硬限制，防止慢连接或大消息耗尽资源。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('握手头上限KB', 'int'), parameter('消息上限MB', 'int'), parameter('单客户端发送队列上限MB', 'int'), parameter('超时毫秒', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WSS_设置资源限制($1, 64, 16, 8, 30000)'
  },
  {
    name: 'WSS_设置心跳', signature: 'WSS_设置心跳(服务端, 间隔毫秒, Pong超时毫秒)', description: '设置自动 Ping/Pong 心跳；间隔为 0 时关闭自动心跳。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('间隔毫秒', 'int'), parameter('Pong超时毫秒', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WSS_设置心跳($1, 30000, 10000)'
  },
  {
    name: 'WSS_允许外部监听', signature: 'WSS_允许外部监听(服务端, 允许)', description: '显式允许非回环地址监听；默认关闭，避免开发服务意外暴露到局域网。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('允许', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'WSS_设置访问路径', signature: 'WSS_设置访问路径(服务端, 路径)', description: '限制握手请求路径；空文本接受任意路径，非空路径必须以 / 开头。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('路径', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WSS_设置访问路径($1, "/ws")'
  },
  {
    name: 'WSS_设置允许来源', signature: 'WSS_设置允许来源(服务端, 来源列表)', description: '设置逗号分隔的 Origin 白名单；空文本不限制来源，条目按完整值匹配。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('来源列表', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WSS_设置允许来源($1, "https://example.com")'
  },
  {
    name: 'WSS_设置子协议', signature: 'WSS_设置子协议(服务端, 子协议列表)', description: '设置逗号分隔的服务端子协议优先表；握手时选择客户端同时支持的第一项。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('子协议列表', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全', insertText: 'WSS_设置子协议($1, "chat.v2, chat.v1")'
  },
  ...([
    ['WSS_绑定连接处理器', '连接'],
    ['WSS_绑定消息处理器', '消息'],
    ['WSS_绑定断开处理器', '断开'],
    ['WSS_绑定错误处理器', '错误']
  ] as const).map(([name, event]) => ({
    name,
    signature: `${name}(服务端, &处理器)`,
    description: `绑定${event}事件处理器；运行时通过窗口消息回到创建服务的 UI 线程，处理器内使用 WSS_取当前事件系列命令读取快照。`,
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。')],
    returnType: 'bool' as const,
    returnLabel: '逻辑型',
    category: '事件' as const,
    insertText: `${name}($1, &$2)`
  })),
  {
    name: 'WSS_启动', signature: 'WSS_启动(服务端)', description: '启动后台非阻塞监听和多客户端 WebSocket reactor；成功返回真。',
    parameters: [parameter('服务端', 'WebSocket服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'WSS_停止', signature: 'WSS_停止(服务端)', description: '停止监听，向在线客户端发送 1001 关闭帧并回收后台线程。',
    parameters: [parameter('服务端', 'WebSocket服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'WSS_销毁服务', signature: 'WSS_销毁服务(服务端)', description: '停止并释放受管服务端句柄；重复销毁返回假。',
    parameters: [parameter('服务端', 'WebSocket服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  ...([
    ['WSS_是否运行', 'bool', '逻辑型', '判断服务端是否正在接受连接。'],
    ['WSS_取监听地址', 'wideString', '文本型', '返回服务端当前配置的监听地址。'],
    ['WSS_取监听端口', 'int', '整数型', '返回实际监听端口；配置端口为 0 时可取得系统分配端口。'],
    ['WSS_取在线客户端数', 'int', '整数型', '返回当前已完成握手且在线的客户端数量。'],
    ['WSS_取累计连接数', 'longLong', '长整数型', '返回成功完成握手的累计连接数量。'],
    ['WSS_取累计消息数', 'longLong', '长整数型', '返回收到的完整文本和二进制消息总数。'],
    ['WSS_取服务错误', 'wideString', '文本型', '返回服务端最近一次中文错误；句柄无效时返回管理器错误。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}(服务端)`, description,
    parameters: [parameter('服务端', 'WebSocket服务端')], returnType, returnLabel, category: '状态' as const
  })),
  ...([
    ['WSS_取当前事件类型', 'wideString', '文本型', '返回当前回调事件类型：连接、文本、二进制、断开或错误。'],
    ['WSS_取当前客户端', 'WebSocket客户端', 'WebSocket客户端', '返回当前事件对应的受管客户端句柄。'],
    ['WSS_取当前消息类型', 'wideString', '文本型', '返回当前消息类型：文本或二进制；其它事件返回空文本。'],
    ['WSS_取当前文本', 'wideString', '文本型', '返回当前文本消息或错误说明快照。'],
    ['WSS_取当前二进制', 'bytes', '字节集', '返回当前二进制消息的独立字节集副本。'],
    ['WSS_取当前关闭代码', 'int', '整数型', '返回当前断开事件的 WebSocket 关闭状态码。'],
    ['WSS_取当前关闭原因', 'wideString', '文本型', '返回当前断开事件的 UTF-8 关闭原因。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}()`, description, parameters: [], returnType, returnLabel, category: '事件' as const
  })),
  ...([
    ['WSS_客户端是否在线', 'bool', '逻辑型', '判断客户端是否仍在线且未进入关闭状态。'],
    ['WSS_取客户端地址', 'wideString', '文本型', '返回客户端数字 IP 地址。'],
    ['WSS_取客户端端口', 'int', '整数型', '返回客户端 TCP 端口。'],
    ['WSS_取客户端路径', 'wideString', '文本型', '返回客户端握手请求路径。'],
    ['WSS_取客户端来源', 'wideString', '文本型', '返回客户端握手 Origin。'],
    ['WSS_取客户端子协议', 'wideString', '文本型', '返回握手协商出的子协议。'],
    ['WSS_取客户端连接时长', 'longLong', '长整数型', '返回客户端完成握手后的在线毫秒数。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: `${name}(客户端)`, description,
    parameters: [parameter('客户端', 'WebSocket客户端')], returnType, returnLabel, category: '客户端' as const
  })),
  {
    name: 'WSS_取客户端列表JSON', signature: 'WSS_取客户端列表JSON(服务端)', description: '返回在线客户端的 UTF-16 JSON 数组，包含句柄、地址、端口、路径、来源和子协议。',
    parameters: [parameter('服务端', 'WebSocket服务端')], returnType: 'wideString', returnLabel: '文本型', category: '客户端'
  },
  {
    name: 'WSS_发送文本给客户端', signature: 'WSS_发送文本给客户端(客户端, 内容)', description: '把一条完整 UTF-8 文本消息加入指定客户端的有界发送队列。',
    parameters: [parameter('客户端', 'WebSocket客户端'), parameter('内容', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '消息', insertText: 'WSS_发送文本给客户端($1, "$2")'
  },
  {
    name: 'WSS_发送二进制给客户端', signature: 'WSS_发送二进制给客户端(客户端, 数据)', description: '把字节集作为一条完整二进制消息加入指定客户端的有界发送队列。',
    parameters: [parameter('客户端', 'WebSocket客户端'), parameter('数据', 'bytes')], returnType: 'bool', returnLabel: '逻辑型', category: '消息'
  },
  {
    name: 'WSS_广播文本', signature: 'WSS_广播文本(服务端, 内容)', description: '向服务端全部在线客户端广播文本，返回成功入队的客户端数量。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('内容', 'wideString')], returnType: 'int', returnLabel: '整数型', category: '消息', insertText: 'WSS_广播文本($1, "$2")'
  },
  {
    name: 'WSS_广播二进制', signature: 'WSS_广播二进制(服务端, 数据)', description: '向服务端全部在线客户端广播二进制消息，返回成功入队的客户端数量。',
    parameters: [parameter('服务端', 'WebSocket服务端'), parameter('数据', 'bytes')], returnType: 'int', returnLabel: '整数型', category: '消息'
  },
  {
    name: 'WSS_发送Ping', signature: 'WSS_发送Ping(客户端, 数据)', description: '发送最多 125 字节的 Ping 控制帧；数据使用 UTF-8 编码。',
    parameters: [parameter('客户端', 'WebSocket客户端'), parameter('数据', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '消息', insertText: 'WSS_发送Ping($1, "health")'
  },
  {
    name: 'WSS_关闭客户端', signature: 'WSS_关闭客户端(客户端, 状态码, 原因)', description: '执行 WebSocket 优雅关闭握手；状态码和 UTF-8 原因会经过 RFC 6455 校验。',
    parameters: [parameter('客户端', 'WebSocket客户端'), parameter('状态码', 'int'), parameter('原因', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端', insertText: 'WSS_关闭客户端($1, 1000, "正常关闭")'
  },
  {
    name: 'WSS_强制断开客户端', signature: 'WSS_强制断开客户端(客户端)', description: '立即关闭客户端 TCP 连接，仅用于协议错误、超时或管理操作。',
    parameters: [parameter('客户端', 'WebSocket客户端')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'WSS_启动服务', signature: 'WSS_启动服务(端口)', description: '旧版默认服务兼容入口；启动回环服务，新代码应使用受管服务 API。',
    parameters: [parameter('端口', 'int')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WSS_等待连接', signature: 'WSS_等待连接()', description: '旧版阻塞兼容入口；最多等待 30 秒，新代码应使用连接处理器。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WSS_接收文本', signature: 'WSS_接收文本()', description: '旧版阻塞兼容入口；最多等待 30 秒返回下一条文本消息。',
    parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WSS_接收到调试输出', signature: 'WSS_接收到调试输出()', description: '旧版兼容入口；接收一条文本消息并写入调试输出。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WSS_发送文本', signature: 'WSS_发送文本(内容)', description: '旧版兼容入口；向默认服务最近连接的客户端发送文本。',
    parameters: [parameter('内容', 'wideString')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'WSS_关闭服务', signature: 'WSS_关闭服务()', description: '旧版兼容入口；停止并销毁默认受管服务。',
    parameters: [], returnType: 'void', returnLabel: '空', category: '兼容', visibility: 'advanced'
  }
];

function contribution(spec: WebSocketServerCommandSpec): ModuleCommandContribution {
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

function binding(spec: WebSocketServerCommandSpec): ModuleCommandBinding {
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

export const WEBSOCKET_SERVER_COMMAND_SPECS = specs;

export const WEBSOCKET_SERVER_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: 'lingbuilder.websocket.server',
  name: 'WebSocket 服务端模块',
  version: '2.0.0',
  minLingBuilderVersion: '0.2.7',
  category: '网络',
  description: '提供受管 RFC 6455 WebSocket 服务端、后台多客户端处理、文本与二进制消息、心跳、关闭握手、访问控制、资源限制和运行统计。',
  author: 'LingBuilder',
  license: 'LingBuilder Built-in Module License',
  tags: ['内置', '网络', 'WebSocket', '服务端', 'RFC 6455', '多客户端', '受管并发'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'WebSocket服务端', description: '进程内不复用的受管 WebSocket 服务端 ID，不暴露原生 SOCKET。', cppType: 'long long' },
      { name: 'WebSocket客户端', description: '由服务端分配的受管客户端 ID，断开后保留为不可用句柄。', cppType: 'long long' }
    ],
    snippets: [
      {
        label: 'WebSocket 受管消息服务',
        insertText: 'WebSocket服务端 服务 = WSS_创建服务()\nWSS_配置服务(服务, "127.0.0.1", 18080, 512)\nWSS_设置资源限制(服务, 64, 16, 8, 30000)\nWSS_设置心跳(服务, 30000, 10000)\nWSS_设置访问路径(服务, "/ws")\nWSS_绑定连接处理器(服务, &客户端已连接)\nWSS_绑定消息处理器(服务, &收到客户端消息)\nWSS_绑定断开处理器(服务, &客户端已断开)\nWSS_绑定错误处理器(服务, &服务端发生错误)\nWSS_启动(服务)',
        description: '创建带访问控制、资源上限、心跳和 UI 线程事件的多客户端服务。'
      },
      {
        label: 'WebSocket 文本回显处理器',
        insertText: '空 收到客户端消息()\n    如果 (WSS_取当前消息类型() == "文本")\n        WSS_发送文本给客户端(WSS_取当前客户端(), WSS_取当前文本())\n    如果结束\n结束',
        description: '在消息处理器中读取不可变事件快照并把文本回复给当前客户端。'
      }
    ],
    docs: [{ title: 'WebSocket 服务端模块 2.0 使用说明', path: 'docs/modules/websocket-server/README.md' }]
  },
  targets: [
    {
      id: 'windows-msvc-win32',
      platform: 'windows',
      arch: 'win32',
      toolchain: 'msvc',
      libs: ['ws2_32.lib', 'advapi32.lib'],
      defines: ['LINGBUILDER_WEBSOCKET_SERVER_MODULE'],
      compileOptions: ['/std:c++17']
    },
    {
      id: 'windows-msvc-x64',
      platform: 'windows',
      arch: 'x64',
      toolchain: 'msvc',
      libs: ['ws2_32.lib', 'advapi32.lib'],
      defines: ['LINGBUILDER_WEBSOCKET_SERVER_MODULE'],
      compileOptions: ['/std:c++17']
    }
  ],
  bindings: { commands: specs.map(binding) }
};
