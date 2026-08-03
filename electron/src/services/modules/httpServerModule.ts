import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType
} from './types';

interface HttpServerCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: '服务' | '路由' | '请求' | '响应' | '状态' | '兼容';
  insertText?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description?: string
): ModuleCommandBindingParameter => ({
  name,
  type,
  description,
  ...(type === 'handler' ? { handlerSignature: { parameterTypes: [], returnType: '空' } } : {})
});

const specs: HttpServerCommandSpec[] = [
  {
    name: 'HTTP_创建服务', signature: 'HTTP_创建服务()', description: '创建尚未启动的受管 HTTP/1.1 服务端并返回稳定句柄。',
    parameters: [], returnType: 'HTTP服务端', returnLabel: 'HTTP服务端', category: '服务'
  },
  {
    name: 'HTTP_配置服务', signature: 'HTTP_配置服务(服务端, 监听地址, 端口, 工作线程数, 等待队列上限)', description: '配置监听地址、端口、有界工作线程和连接等待队列；只能在停止状态修改。',
    parameters: [parameter('服务端', 'HTTP服务端'), parameter('监听地址', 'wideString'), parameter('端口', 'int'), parameter('工作线程数', 'int'), parameter('等待队列上限', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'HTTP_配置服务($1, "127.0.0.1", 8080, 4, 256)'
  },
  {
    name: 'HTTP_设置请求限制', signature: 'HTTP_设置请求限制(服务端, 请求头上限KB, 请求体上限MB, 请求超时毫秒)', description: '在停止状态设置请求头、请求体和单次读写超时，阻止无限请求与慢速连接耗尽资源。',
    parameters: [parameter('服务端', 'HTTP服务端'), parameter('请求头上限KB', 'int'), parameter('请求体上限MB', 'int'), parameter('请求超时毫秒', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'HTTP_设置请求限制($1, 64, 16, 30000)'
  },
  {
    name: 'HTTP_允许外部监听', signature: 'HTTP_允许外部监听(服务端, 允许)', description: '显式允许非回环地址监听；默认关闭，避免无意把开发服务暴露到局域网。',
    parameters: [parameter('服务端', 'HTTP服务端'), parameter('允许', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_绑定请求处理器', signature: 'HTTP_绑定请求处理器(服务端, &处理器)', description: '绑定未命中路由时在窗口 UI 线程执行的无参数处理器；处理器用 HTTP_取当前请求() 取得请求。',
    parameters: [parameter('服务端', 'HTTP服务端'), parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_绑定请求处理器($1, &$2)'
  },
  {
    name: 'HTTP_添加路由', signature: 'HTTP_添加路由(服务端, 方法, 路径模式, &处理器)', description: '添加方法和路径路由；支持精确路径、末尾 /* 前缀匹配及方法 *。',
    parameters: [parameter('服务端', 'HTTP服务端'), parameter('方法', 'wideString'), parameter('路径模式', 'wideString'), parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_添加路由($1, "GET", "/api/health", &$2)'
  },
  {
    name: 'HTTP_清空路由', signature: 'HTTP_清空路由(服务端)', description: '清空服务端的全部显式路由，不影响默认请求处理器。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '路由'
  },
  {
    name: 'HTTP_启动', signature: 'HTTP_启动(服务端)', description: '启动后台监听、连接队列和工作线程；成功返回真。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_停止', signature: 'HTTP_停止(服务端)', description: '停止监听、取消等待请求并回收全部连接和工作线程。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_销毁服务', signature: 'HTTP_销毁服务(服务端)', description: '停止并释放服务端句柄；重复销毁会返回假。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_是否运行', signature: 'HTTP_是否运行(服务端)', description: '判断服务端是否正在接受连接。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'bool', returnLabel: '逻辑型', category: '状态'
  },
  {
    name: 'HTTP_取监听地址', signature: 'HTTP_取监听地址(服务端)', description: '返回服务端当前配置的监听地址。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'wideString', returnLabel: '文本型', category: '状态'
  },
  {
    name: 'HTTP_取监听端口', signature: 'HTTP_取监听端口(服务端)', description: '返回实际监听端口；配置端口为 0 时可取得系统分配的临时端口。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'int', returnLabel: '整数型', category: '状态'
  },
  {
    name: 'HTTP_取活动连接数', signature: 'HTTP_取活动连接数(服务端)', description: '返回当前正在处理的客户端连接数量。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'int', returnLabel: '整数型', category: '状态'
  },
  {
    name: 'HTTP_取累计请求数', signature: 'HTTP_取累计请求数(服务端)', description: '返回服务端成功解析并分发的累计请求数量。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'longLong', returnLabel: '长整数型', category: '状态'
  },
  {
    name: 'HTTP_取服务错误', signature: 'HTTP_取服务错误(服务端)', description: '返回该服务端最近一次中文错误；句柄无效时返回管理器错误。',
    parameters: [parameter('服务端', 'HTTP服务端')], returnType: 'wideString', returnLabel: '文本型', category: '状态'
  },
  {
    name: 'HTTP_取当前请求', signature: 'HTTP_取当前请求()', description: '在请求处理器内取得当前受管请求句柄；其它上下文返回 0。',
    parameters: [], returnType: 'HTTP请求', returnLabel: 'HTTP请求', category: '请求'
  },
  {
    name: 'HTTP_取请求服务', signature: 'HTTP_取请求服务(请求)', description: '返回接收该请求的服务端句柄。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'HTTP服务端', returnLabel: 'HTTP服务端', category: '请求'
  },
  {
    name: 'HTTP_取请求方法', signature: 'HTTP_取请求方法(请求)', description: '返回大写 HTTP 方法，例如 GET、POST。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求目标', signature: 'HTTP_取请求目标(请求)', description: '返回请求行中的原始目标，包含原始查询字符串。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求路径', signature: 'HTTP_取请求路径(请求)', description: '返回经过安全百分号解码的 URL 路径。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取查询字符串', signature: 'HTTP_取查询字符串(请求)', description: '返回未解码的查询字符串，不含问号。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取查询参数', signature: 'HTTP_取查询参数(请求, 名称)', description: '按 UTF-8 URL 编码读取首个查询参数值；不存在时返回空文本。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('名称', 'wideString')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求头', signature: 'HTTP_取请求头(请求, 名称)', description: '不区分大小写读取首个请求头值。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('名称', 'wideString')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取全部请求头', signature: 'HTTP_取全部请求头(请求)', description: '以 UTF-16 JSON 对象返回全部请求头；重复头以逗号合并。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文', signature: 'HTTP_取请求正文(请求)', description: '把 UTF-8 请求正文转换为文本；二进制数据请使用十六进制接口。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文十六进制', signature: 'HTTP_取请求正文十六进制(请求)', description: '以小写十六进制返回原始请求正文字节，适用于二进制上传。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文大小', signature: 'HTTP_取请求正文大小(请求)', description: '返回原始请求正文的字节数。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'longLong', returnLabel: '长整数型', category: '请求'
  },
  {
    name: 'HTTP_取客户端地址', signature: 'HTTP_取客户端地址(请求)', description: '返回 TCP 对端的数字 IP 地址。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取客户端端口', signature: 'HTTP_取客户端端口(请求)', description: '返回 TCP 对端端口。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'int', returnLabel: '整数型', category: '请求'
  },
  {
    name: 'HTTP_取协议版本', signature: 'HTTP_取协议版本(请求)', description: '返回 HTTP/1.0 或 HTTP/1.1。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_设置状态码', signature: 'HTTP_设置状态码(请求, 状态码)', description: '设置响应状态码，范围为 100 到 599。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('状态码', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_设置响应头', signature: 'HTTP_设置响应头(请求, 名称, 值)', description: '设置或替换响应头；拒绝非法名称和 CR/LF 注入。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_添加响应头', signature: 'HTTP_添加响应头(请求, 名称, 值)', description: '追加响应头，适用于多个 Set-Cookie；拒绝 CR/LF 注入。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_设置Cookie', signature: 'HTTP_设置Cookie(请求, 名称, 值, 路径, 最大秒数, HttpOnly, Secure, SameSite)', description: '追加安全编码的 Set-Cookie；SameSite 支持 Lax、Strict、None，None 必须同时启用 Secure。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('名称', 'wideString'), parameter('值', 'wideString'), parameter('路径', 'wideString'), parameter('最大秒数', 'int'), parameter('HttpOnly', 'bool'), parameter('Secure', 'bool'), parameter('SameSite', 'wideString')],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送文本', signature: 'HTTP_发送文本(请求, 内容, 内容类型, 状态码)', description: '发送 UTF-8 文本并完成响应；内容类型为空时使用 text/plain。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('内容', 'wideString'), parameter('内容类型', 'wideString'), parameter('状态码', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应', insertText: 'HTTP_发送文本($1, "$2", "text/plain; charset=utf-8", 200)'
  },
  {
    name: 'HTTP_发送JSON', signature: 'HTTP_发送JSON(请求, JSON, 状态码)', description: '发送 application/json; charset=utf-8 响应并完成请求。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('JSON', 'wideString'), parameter('状态码', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '响应', insertText: 'HTTP_发送JSON($1, "{\\"ok\\":true}", 200)'
  },
  {
    name: 'HTTP_发送十六进制', signature: 'HTTP_发送十六进制(请求, 十六进制, 内容类型, 状态码)', description: '校验并解码偶数长度十六进制文本，发送原始二进制响应。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('十六进制', 'wideString'), parameter('内容类型', 'wideString'), parameter('状态码', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送文件', signature: 'HTTP_发送文件(请求, 文件路径, 下载名称, 内容类型, 状态码)', description: '以分块读取方式发送文件，不把整个文件载入内存；自动设置长度和可选下载名称。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('文件路径', 'wideString'), parameter('下载名称', 'wideString'), parameter('内容类型', 'wideString'), parameter('状态码', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_重定向', signature: 'HTTP_重定向(请求, 地址, 状态码)', description: '发送 301、302、303、307 或 308 重定向响应。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('地址', 'wideString'), parameter('状态码', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送空响应', signature: 'HTTP_发送空响应(请求, 状态码)', description: '发送无正文响应并完成请求，适用于 204、304 等状态。',
    parameters: [parameter('请求', 'HTTP请求'), parameter('状态码', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_是否已响应', signature: 'HTTP_是否已响应(请求)', description: '判断请求是否已经提交响应或被中止。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'bool', returnLabel: '逻辑型', category: '状态'
  },
  {
    name: 'HTTP_中止请求', signature: 'HTTP_中止请求(请求)', description: '中止请求并关闭对应连接，不发送应用层响应。',
    parameters: [parameter('请求', 'HTTP请求')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_启动服务', signature: 'HTTP_启动服务(端口)', description: '旧版单服务兼容入口；在 127.0.0.1 启动后台服务，建议新代码使用受管服务 API。',
    parameters: [parameter('端口', 'int')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP_等待请求', signature: 'HTTP_等待请求()', description: '旧版阻塞兼容入口；等待一个请求并返回原始请求文本，新代码应使用请求处理器。',
    parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP_等待请求到调试输出', signature: 'HTTP_等待请求到调试输出()', description: '旧版阻塞兼容入口；等待请求并输出原始内容。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP_回复文本', signature: 'HTTP_回复文本(内容)', description: '旧版兼容入口；向最近等待或当前回调请求发送 200 文本响应。',
    parameters: [parameter('内容', 'wideString')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP_关闭服务', signature: 'HTTP_关闭服务()', description: '旧版兼容入口；停止并销毁旧版默认服务。',
    parameters: [], returnType: 'void', returnLabel: '空', category: '兼容', visibility: 'advanced'
  }
];

function contribution(spec: HttpServerCommandSpec): ModuleCommandContribution {
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

function binding(spec: HttpServerCommandSpec): ModuleCommandBinding {
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

export const HTTP_SERVER_COMMAND_SPECS = specs;

export const HTTP_SERVER_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: 'lingbuilder.http.server',
  name: 'HTTP 服务端模块',
  version: '2.0.0',
  category: '网络',
  description: '提供受管 HTTP/1.1 服务端、后台多连接处理、路由、完整请求读取、可配置响应、资源限制和运行状态。',
  author: 'LingBuilder',
  tags: ['内置', '网络', 'HTTP', '服务端', 'HTTP/1.1', '路由', '受管并发'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'HTTP服务端', description: '进程内不复用的受管 HTTP 服务端 ID，不暴露原生 SOCKET。', cppType: 'long long' },
      { name: 'HTTP请求', description: '仅在请求生命周期内有效的受管 HTTP 请求 ID。', cppType: 'long long' }
    ],
    snippets: [
      {
        label: 'HTTP 受管 JSON 服务',
        insertText: 'HTTP服务端 服务 = HTTP_创建服务()\nHTTP_配置服务(服务, "127.0.0.1", 8080, 4, 256)\nHTTP_设置请求限制(服务, 64, 16, 30000)\nHTTP_添加路由(服务, "GET", "/api/health", &处理健康检查)\nHTTP_绑定请求处理器(服务, &处理未匹配请求)\nHTTP_启动(服务)',
        description: '创建带资源限制、路由和回调的本地 HTTP/1.1 服务。'
      },
      {
        label: 'HTTP 请求处理器',
        insertText: '空 处理健康检查()\n    HTTP请求 请求 = HTTP_取当前请求()\n    HTTP_设置响应头(请求, "Cache-Control", "no-store")\n    HTTP_发送JSON(请求, "{\\"ok\\":true}", 200)',
        description: '在 UI 线程读取当前请求并发送 JSON 响应。'
      }
    ],
    docs: [{ title: 'HTTP 服务端模块 2.0 使用说明', path: 'docs/modules/http-server/README.md' }]
  },
  targets: [{
    id: 'windows-msvc-win32',
    platform: 'windows',
    arch: 'win32',
    toolchain: 'msvc',
    libs: ['ws2_32.lib'],
    defines: ['LINGBUILDER_HTTP_SERVER_MODULE'],
    compileOptions: ['/std:c++17']
  }],
  bindings: { commands: specs.map(binding) }
};
