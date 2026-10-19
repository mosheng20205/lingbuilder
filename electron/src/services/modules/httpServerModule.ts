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
  category: '服务' | '路由' | '请求' | '响应' | '推送' | '状态' | '文档' | '兼容';
  insertText?: string;
  example?: string;
  visibility?: 'default' | 'advanced' | 'internal';
}

const parameter = (
  name: string,
  type: ModuleBindingValueType | (string & {}),
  description: string
): ModuleCommandBindingParameter => ({
  name,
  type,
  description,
  ...(type === 'handler' ? { handlerSignature: { parameterTypes: [], returnType: '空' } } : {})
});

const serverHandle = 'HTTP_创建服务 返回的服务端句柄。';
const serverStopped = 'HTTP_创建服务 返回的服务端句柄；服务必须处于停止状态。';
const requestHandle = '请求处理器内 HTTP_取当前请求() 返回的请求句柄，仅在本次请求处理期间有效。';
const responseStatus = '响应状态码，100 到 599。';
const responseHeaderName = '响应头名称，必须是合法 token；Content-Length、Connection、Transfer-Encoding 由运行时统一管理，不能手工设置。';
const responseHeaderValue = '响应头内容，不得包含 CR 或 LF 字符。';
const octetStreamType = '响应 Content-Type；空文本时使用 application/octet-stream。';
const sseRequest = 'HTTP_SSE_开始 成功返回的请求句柄；会话被 HTTP_SSE_结束 关闭或客户端断开后句柄失效。';

const specs: HttpServerCommandSpec[] = [
  {
    name: 'HTTP_创建服务', signature: 'HTTP_创建服务()', description: '创建尚未启动的受管 HTTP/1.1 服务端并返回稳定句柄。',
    parameters: [], returnType: 'HTTP服务端', returnLabel: 'HTTP服务端', category: '服务'
  },
  {
    name: 'HTTP_配置服务', signature: 'HTTP_配置服务(服务端, 监听地址, 端口, 工作线程数, 等待队列上限)', description: '配置监听地址、端口、有界工作线程和连接等待队列；只能在停止状态修改。',
    parameters: [parameter('服务端', 'HTTP服务端', serverStopped), parameter('监听地址', 'wideString', '要监听的 IPv4/IPv6 地址文本，如 "127.0.0.1"；空文本按 127.0.0.1 处理；非回环地址必须先调用 HTTP_允许外部监听。'), parameter('端口', 'int', '监听端口，0 到 65535；0 表示由系统分配临时端口，启动后用 HTTP_取监听端口 读取实际端口。'), parameter('工作线程数', 'int', '后台工作线程数量，≥ 1 不设固定上限（过大值受系统线程资源约束，建议按 CPU 核数的 1～4 倍设置），决定可同时处理的请求连接数；资源不足导致线程创建失败时 HTTP_启动 返回假。'), parameter('等待队列上限', 'int', '等待被工作线程取走的连接队列上限，1 到 65535；队列满时新连接会被直接关闭。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'HTTP_配置服务($1, "127.0.0.1", 8080, 4, 256)'
  },
  {
    name: 'HTTP_设置请求限制', signature: 'HTTP_设置请求限制(服务端, 请求头上限KB, 请求体上限MB, 请求超时毫秒)', description: '在停止状态设置请求头、请求体和单次读写超时，阻止无限请求与慢速连接耗尽资源。',
    parameters: [parameter('服务端', 'HTTP服务端', serverStopped), parameter('请求头上限KB', 'int', '请求头部总大小上限，单位 KB，4 到 1024；超限请求会被拒绝。'), parameter('请求体上限MB', 'int', '请求正文大小上限，单位 MB，0 到 1024；0 表示不接收任何请求正文。'), parameter('请求超时毫秒', 'int', '单次读写超时，单位毫秒，100 到 3600000；慢速连接超过该时限会被断开，用于防御慢速攻击。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'HTTP_设置请求限制($1, 64, 16, 30000)'
  },
  {
    name: 'HTTP_允许外部监听', signature: 'HTTP_允许外部监听(服务端, 允许)', description: '显式允许非回环地址监听；默认关闭，避免无意把开发服务暴露到局域网。',
    parameters: [parameter('服务端', 'HTTP服务端', serverStopped), parameter('允许', 'bool', '传真允许监听非回环地址；默认假，只允许解析为回环地址的监听目标。')], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_绑定请求处理器', signature: 'HTTP_绑定请求处理器(服务端, &处理器)', description: '绑定未命中路由时在窗口 UI 线程执行的无参数处理器；处理器用 HTTP_取当前请求() 取得请求。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_绑定请求处理器($1, &$2)'
  },
  {
    name: 'HTTP_添加路由', signature: 'HTTP_添加路由(服务端, 方法, 路径模式, &处理器)', description: '添加方法和路径路由；支持精确路径、末尾 /* 前缀匹配及方法 *；HEAD 请求未显式登记 HEAD 路由时自动回落匹配 GET 路由并返回无正文响应。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', 'HTTP 方法文本，大小写不敏感（自动转大写），如 GET、POST；* 表示匹配任意方法。'), parameter('路径模式', 'wideString', '必须以 / 开头的路径，如 /api/health；支持精确匹配和末尾 /* 前缀通配（/api/* 匹配 /api/users，不匹配 /api）。'), parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_添加路由($1, "GET", "/api/health", &$2)'
  },
  {
    name: 'HTTP_添加静态路由', signature: 'HTTP_添加静态路由(服务端, 方法, 路径模式, 响应内容, 内容类型)', description: '注册工作线程直接回应的固定内容路由（JSON/文本/HTML）；命中后不进入请求处理器、不占用 UI 线程，是高吞吐固定响应的首选；与 HTTP_添加路由 同方法同路径时后注册者整体覆盖。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', 'HTTP 方法文本，大小写不敏感（自动转大写），如 GET、HEAD；* 表示匹配任意方法。'), parameter('路径模式', 'wideString', '必须以 / 开头的路径，如 /api/data；支持精确匹配和末尾 /* 前缀通配（/static/* 匹配 /static/a.css）。'), parameter('响应内容', 'wideString', '固定响应正文文本，注册时确定并按 UTF-8 发送；需要变更时重新注册同方法同路径即可覆盖。'), parameter('内容类型', 'wideString', '响应 Content-Type，如 "application/json; charset=utf-8"；空文本时按 text/plain; charset=utf-8 处理。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_添加静态路由($1, "GET", "/api/data", "{\\"ok\\":true}", "application/json; charset=utf-8")'
  },
  {
    name: 'HTTP_添加静态文件路由', signature: 'HTTP_添加静态文件路由(服务端, 方法, 路径模式, 文件路径, 下载名称, 内容类型)', description: '注册工作线程直接分块发送磁盘文件的路由（页面、图片、附件下载）；不占用 UI 线程；每次请求读取当前文件内容，文件不存在时该请求返回 404；自动响应 Range 断点续传请求（206 Partial Content），配合 HTTP客户端_设置续传文件 可实现局域网大文件断点续传。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', 'HTTP 方法文本，大小写不敏感（自动转大写），通常 GET；* 表示匹配任意方法。'), parameter('路径模式', 'wideString', '必须以 / 开头的路径，如 /index.html 或 /static/*；支持精确匹配和末尾 /* 前缀通配。'), parameter('文件路径', 'wideString', '要发送的本机文件绝对路径（文本型）；前缀通配路由下所有命中路径都返回该文件。'), parameter('下载名称', 'wideString', '非空时附带 Content-Disposition 附件下载名（支持中文，自动按 RFC 5987 编码）；空文本表示内联展示不触发下载。'), parameter('内容类型', 'wideString', '响应 Content-Type，如 "text/html; charset=utf-8"；空文本时按 application/octet-stream 处理。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '路由', insertText: 'HTTP_添加静态文件路由($1, "GET", "/page", "C:\\\\site\\\\index.html", "", "text/html; charset=utf-8")'
  },
  {
    name: 'HTTP_设置连接轮转', signature: 'HTTP_设置连接轮转(服务端, 请求数)', description: '设置单个 Keep-Alive 连接被强制关闭前最多处理的请求数，默认 100；运行中可修改，对后续请求立即生效。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('请求数', 'int', '每个连接的轮转请求数，1 到 1000000；调大可减少持续负载下的重连开销，调小可提升大量并发连接间的处理公平性；1 表示每个请求后立即关闭连接。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '服务', insertText: 'HTTP_设置连接轮转($1, 500)'
  },
  {
    name: 'HTTP_清空路由', signature: 'HTTP_清空路由(服务端)', description: '清空服务端的全部显式路由，不影响默认请求处理器。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '路由'
  },
  {
    name: 'HTTP_启动', signature: 'HTTP_启动(服务端)', description: '启动后台监听、连接队列和工作线程；成功返回真。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_停止', signature: 'HTTP_停止(服务端)', description: '停止监听、取消等待请求并回收全部连接和工作线程。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_销毁服务', signature: 'HTTP_销毁服务(服务端)', description: '停止并释放服务端句柄；重复销毁会返回假。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '服务'
  },
  {
    name: 'HTTP_是否运行', signature: 'HTTP_是否运行(服务端)', description: '判断服务端是否正在接受连接。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '状态'
  },
  {
    name: 'HTTP_取监听地址', signature: 'HTTP_取监听地址(服务端)', description: '返回服务端当前配置的监听地址。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'wideString', returnLabel: '文本型', category: '状态'
  },
  {
    name: 'HTTP_取监听端口', signature: 'HTTP_取监听端口(服务端)', description: '返回实际监听端口；配置端口为 0 时可取得系统分配的临时端口。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'int', returnLabel: '整数型', category: '状态'
  },
  {
    name: 'HTTP_取活动连接数', signature: 'HTTP_取活动连接数(服务端)', description: '返回当前正在处理的客户端连接数量。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'int', returnLabel: '整数型', category: '状态'
  },
  {
    name: 'HTTP_取累计请求数', signature: 'HTTP_取累计请求数(服务端)', description: '返回服务端成功解析并分发的累计请求数量。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'longLong', returnLabel: '长整数型', category: '状态'
  },
  {
    name: 'HTTP_取服务错误', signature: 'HTTP_取服务错误(服务端)', description: '返回该服务端最近一次中文错误；句柄无效时返回管理器错误。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)], returnType: 'wideString', returnLabel: '文本型', category: '状态'
  },
  {
    name: 'HTTP_取当前请求', signature: 'HTTP_取当前请求()', description: '在请求处理器内取得当前受管请求句柄；其它上下文返回 0。',
    parameters: [], returnType: 'HTTP请求', returnLabel: 'HTTP请求', category: '请求'
  },
  {
    name: 'HTTP_取请求服务', signature: 'HTTP_取请求服务(请求)', description: '返回接收该请求的服务端句柄。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'HTTP服务端', returnLabel: 'HTTP服务端', category: '请求'
  },
  {
    name: 'HTTP_取请求方法', signature: 'HTTP_取请求方法(请求)', description: '返回大写 HTTP 方法，例如 GET、POST。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求目标', signature: 'HTTP_取请求目标(请求)', description: '返回请求行中的原始目标，包含原始查询字符串。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求路径', signature: 'HTTP_取请求路径(请求)', description: '返回经过安全百分号解码的 URL 路径。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取查询字符串', signature: 'HTTP_取查询字符串(请求)', description: '返回未解码的查询字符串，不含问号。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取查询参数', signature: 'HTTP_取查询参数(请求, 名称)', description: '按 UTF-8 URL 编码读取首个查询参数值；不存在时返回空文本。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('名称', 'wideString', '查询参数名，按 UTF-8 百分号解码后比较；存在多个同名参数时取第一个。')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求头', signature: 'HTTP_取请求头(请求, 名称)', description: '不区分大小写读取首个请求头值。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('名称', 'wideString', '请求头名称，大小写不敏感；存在多个同名头时返回第一个值。')], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取全部请求头', signature: 'HTTP_取全部请求头(请求)', description: '以 UTF-16 JSON 对象返回全部请求头；重复头以逗号合并。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文', signature: 'HTTP_取请求正文(请求)', description: '把 UTF-8 请求正文转换为文本；二进制数据请使用十六进制接口。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文十六进制', signature: 'HTTP_取请求正文十六进制(请求)', description: '以小写十六进制返回原始请求正文字节，适用于二进制上传。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取请求正文大小', signature: 'HTTP_取请求正文大小(请求)', description: '返回原始请求正文的字节数。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'longLong', returnLabel: '长整数型', category: '请求'
  },
  {
    name: 'HTTP_取客户端地址', signature: 'HTTP_取客户端地址(请求)', description: '返回 TCP 对端的数字 IP 地址。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_取客户端端口', signature: 'HTTP_取客户端端口(请求)', description: '返回 TCP 对端端口。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'int', returnLabel: '整数型', category: '请求'
  },
  {
    name: 'HTTP_取协议版本', signature: 'HTTP_取协议版本(请求)', description: '返回 HTTP/1.0 或 HTTP/1.1。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'wideString', returnLabel: '文本型', category: '请求'
  },
  {
    name: 'HTTP_设置状态码', signature: 'HTTP_设置状态码(请求, 状态码)', description: '设置响应状态码，范围为 100 到 599。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('状态码', 'int', '响应状态码，100 到 599；须在发送响应前设置。')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_设置响应头', signature: 'HTTP_设置响应头(请求, 名称, 值)', description: '设置或替换响应头；拒绝非法名称和 CR/LF 注入。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('名称', 'wideString', responseHeaderName), parameter('值', 'wideString', `${responseHeaderValue}同名头存在时替换原值。`)], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_添加响应头', signature: 'HTTP_添加响应头(请求, 名称, 值)', description: '追加响应头，适用于多个 Set-Cookie；拒绝 CR/LF 注入。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('名称', 'wideString', responseHeaderName), parameter('值', 'wideString', `${responseHeaderValue}追加到现有同名头之后，不覆盖。`)], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_设置Cookie', signature: 'HTTP_设置Cookie(请求, 名称, 值, 路径, 最大秒数, HttpOnly, Secure, SameSite)', description: '追加安全编码的 Set-Cookie；SameSite 支持 Lax、Strict、None，None 必须同时启用 Secure。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('名称', 'wideString', 'Cookie 名称，不得包含分号、CR 或 LF 等非法字符。'), parameter('值', 'wideString', 'Cookie 值，发送前按 UTF-8 百分号编码；不得包含分号、CR 或 LF。'), parameter('路径', 'wideString', 'Cookie 的 Path 属性；空文本时使用 /；不得包含分号、CR 或 LF。'), parameter('最大秒数', 'int', 'Max-Age 秒数；负数表示不写 Max-Age，即会话 Cookie。'), parameter('HttpOnly', 'bool', '真时附加 HttpOnly 属性，禁止浏览器脚本读取该 Cookie。'), parameter('Secure', 'bool', '真时附加 Secure 属性，仅 HTTPS 连接发送；SameSite 为 None 时必须启用。'), parameter('SameSite', 'wideString', 'SameSite 属性，支持 Lax、Strict 或 None（大小写不敏感）；空文本表示不写该属性。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送文本', signature: 'HTTP_发送文本(请求, 内容, 内容类型, 状态码)', description: '发送 UTF-8 文本并完成响应；内容类型为空时使用 text/plain。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('内容', 'wideString', '响应正文文本，按 UTF-8 编码发送。'), parameter('内容类型', 'wideString', '响应 Content-Type；空文本时使用 text/plain; charset=utf-8。'), parameter('状态码', 'int', `${responseStatus}通常填 200。`)],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应', insertText: 'HTTP_发送文本($1, "$2", "text/plain; charset=utf-8", 200)'
  },
  {
    name: 'HTTP_发送JSON', signature: 'HTTP_发送JSON(请求, JSON, 状态码)', description: '发送 application/json; charset=utf-8 响应并完成请求。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('JSON', 'wideString', '完整的 JSON 文本，按 UTF-8 发送；运行时不校验语法，请确保是合法 JSON。'), parameter('状态码', 'int', `${responseStatus}通常填 200。`)], returnType: 'bool', returnLabel: '逻辑型', category: '响应', insertText: 'HTTP_发送JSON($1, "{\\"ok\\":true}", 200)'
  },
  {
    name: 'HTTP_发送十六进制', signature: 'HTTP_发送十六进制(请求, 十六进制, 内容类型, 状态码)', description: '校验并解码偶数长度十六进制文本，发送原始二进制响应。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('十六进制', 'wideString', '偶数长度的十六进制文本（如 48656C6C6F），只允许 0-9、a-f、A-F，解码后作为二进制正文发送。'), parameter('内容类型', 'wideString', octetStreamType), parameter('状态码', 'int', responseStatus)], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送文件', signature: 'HTTP_发送文件(请求, 文件路径, 下载名称, 内容类型, 状态码)', description: '以分块读取方式发送文件，不把整个文件载入内存；自动设置长度和可选下载名称；请求带 Range 头时自动按 206 断点续传响应。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('文件路径', 'wideString', '要发送的本机文件路径，不能为空；分块读取不整体载入内存。不得把未验证的 URL 参数直接拼进路径。'), parameter('下载名称', 'wideString', '非空时附加 Content-Disposition: attachment 触发浏览器下载，自动剔除换行和引号；空文本表示内联展示。'), parameter('内容类型', 'wideString', octetStreamType), parameter('状态码', 'int', `${responseStatus}通常填 200。`)],
    returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_重定向', signature: 'HTTP_重定向(请求, 地址, 状态码)', description: '发送 301、302、303、307 或 308 重定向响应。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('地址', 'wideString', '重定向目标地址，写入 Location 响应头，不能为空。'), parameter('状态码', 'int', '只支持 301、302、303、307 或 308。')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_发送空响应', signature: 'HTTP_发送空响应(请求, 状态码)', description: '发送无正文响应并完成请求，适用于 204、304 等状态。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle), parameter('状态码', 'int', '无正文状态码，100 到 599，适用于 204、304 等。')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_是否已响应', signature: 'HTTP_是否已响应(请求)', description: '判断请求是否已经提交响应或被中止。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '状态'
  },
  {
    name: 'HTTP_中止请求', signature: 'HTTP_中止请求(请求)', description: '中止请求并关闭对应连接，不发送应用层响应。',
    parameters: [parameter('请求', 'HTTP请求', requestHandle)], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP_SSE_开始', signature: 'HTTP_SSE_开始(请求)', description: '把当前请求升级为 SSE（Server-Sent Events）单向推送通道：立即发送 200 与 text/event-stream 响应头并保持连接，请求处理器返回后连接不断开；之后用 HTTP_SSE_推送/推送事件 随时向该客户端单向下发数据，HTTP_SSE_结束 或客户端断开时关闭。必须在发送任何普通响应之前调用；同一请求只能开始一次；开始前用 HTTP_设置响应头 追加的头（如跨域 Allow-Origin）会随响应发出，Content-Type 由运行时强制为 text/event-stream。',
    parameters: [parameter('请求', 'HTTP请求', `${requestHandle}必须是尚未发送响应的当前请求。`)],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送', insertText: 'HTTP_SSE_开始($1)'
  },
  {
    name: 'HTTP_SSE_推送', signature: 'HTTP_SSE_推送(请求, 数据)', description: '向已开始 SSE 的客户端推送一条匿名事件（客户端 message 事件或默认监听接收）；数据按 UTF-8 发送，包含换行时自动拆分为多条 data: 行；客户端已断开时返回假，可用 HTTP_SSE_是否连接 提前探测。',
    parameters: [parameter('请求', 'HTTP请求', sseRequest), parameter('数据', 'wideString', '事件数据文本，按 UTF-8 编码；可包含换行，运行时按 SSE 规范拆分为多条 data: 行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送', insertText: 'HTTP_SSE_推送($1, "$2")'
  },
  {
    name: 'HTTP_SSE_推送事件', signature: 'HTTP_SSE_推送事件(请求, 事件名, 数据)', description: '向已开始 SSE 的客户端推送一条具名事件（写入 event: 字段），浏览器端用 EventSource 的 addEventListener(事件名) 定点接收；事件名中的换行会被剔除，数据规则与 HTTP_SSE_推送 相同。',
    parameters: [parameter('请求', 'HTTP请求', sseRequest), parameter('事件名', 'wideString', 'SSE event 字段名，如 "tick"、"notice"；空文本等同匿名事件；换行字符会被剔除。'), parameter('数据', 'wideString', '事件数据文本，按 UTF-8 编码；可包含换行，运行时按 SSE 规范拆分为多条 data: 行。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送', insertText: 'HTTP_SSE_推送事件($1, "tick", "$3")'
  },
  {
    name: 'HTTP_SSE_推送心跳', signature: 'HTTP_SSE_推送心跳(请求)', description: '向已开始 SSE 的客户端发送一条注释行（: ping），不产生任何客户端事件；用于保活：长时间无数据的连接可能被浏览器、代理或中间设备超时断开，建议每 15～30 秒推送一次心跳。',
    parameters: [parameter('请求', 'HTTP请求', sseRequest)],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送'
  },
  {
    name: 'HTTP_SSE_结束', signature: 'HTTP_SSE_结束(请求)', description: '主动关闭该 SSE 连接并结束会话；浏览器端 EventSource 会按自身重连策略自动重连（重新触发请求处理器）。重复结束返回假。',
    parameters: [parameter('请求', 'HTTP请求', sseRequest)],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送'
  },
  {
    name: 'HTTP_SSE_是否连接', signature: 'HTTP_SSE_是否连接(请求)', description: '探测 SSE 会话是否仍然在线（对端未关闭连接）；检测到客户端断开时会自动结算并关闭该会话，此后该请求句柄失效。适用于推送前检查，避免向已断开的连接写入。',
    parameters: [parameter('请求', 'HTTP请求', sseRequest)],
    returnType: 'bool', returnLabel: '逻辑型', category: '推送'
  },
  {
    name: 'HTTP_SSE_取连接数', signature: 'HTTP_SSE_取连接数(服务端)', description: '返回该服务端当前存活的 SSE 推送会话数量；配合把请求句柄存入项目变量/数组，可实现「连接时登记、断开时清理」的广播模型。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)],
    returnType: 'int', returnLabel: '整数型', category: '推送'
  },
  {
    name: 'HTTP_启用接口文档', signature: 'HTTP_启用接口文档(服务端, 路径前缀, 标题)', description: '在路径前缀（如 "/docs"）挂一套离线接口文档：浏览器打开 前缀 即得可交互 Swagger UI 页面，前缀+/openapi.json 是 OpenAPI 3.0.3 规范，Try it out 直接调用真实接口；标题显示在文档页与规范 info.title，空文本用「接口文档」。页面与脚本资源全部内嵌随包分发、无任何 CDN 依赖；文档路由由工作线程直接回应、不占 UI 线程。红线：路径前缀必须以 / 开头且不支持 /* 通配；前缀及 前缀/openapi.json、前缀/swagger-ui-bundle.js、前缀/swagger-ui.css 与已有显式路由冲突时返回假且不覆盖用户路由；重复启用同前缀整体覆盖文档路由；资源地址按 前缀 绝对路径写入页面，页面地址不要带尾斜杠。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('路径前缀', 'wideString', '文档页挂载路径，必须以 / 开头的精确路径，如 "/docs"；不支持 /* 通配；末尾多余斜杠会被剔除。'), parameter('标题', 'wideString', '文档页标题与 OpenAPI info.title；空文本用「接口文档」。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '文档', insertText: 'HTTP_启用接口文档($1, "/docs", "我的接口文档")'
  },
  {
    name: 'HTTP_登记接口', signature: 'HTTP_登记接口(服务端, 方法, 路径, 名称, 说明)', description: '把一条真实接口登记进接口文档：方法与路径必须和 HTTP_添加路由/HTTP_添加静态路由 登记的真实路由一字不差，名称显示为接口标题（summary），说明显示为接口描述（description）。路径支持 {参数} 占位（如 /user/{id}，配合 HTTP_登记接口参数 登记路径参数）；/* 前缀通配路由请登记一个代表性具体路径并写进说明。红线：方法必须写具体值（GET、POST 等），不支持 *；必须先 HTTP_启用接口文档；重复登记同方法同路径时名称与说明覆盖、已登记的参数与示例保留。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', 'HTTP 方法文本，大小写不敏感（自动转大写），如 GET、POST；不支持 * 通配。'), parameter('路径', 'wideString', '接口路径，必须以 / 开头，与真实路由一字不差；支持 {参数} 占位（OpenAPI 路径参数形态）；不支持 /* 通配。'), parameter('名称', 'wideString', '接口名称（summary），如「查询用户」；空文本时用「方法 路径」代替。'), parameter('说明', 'wideString', '接口说明（description），可写请求/响应约定与红线；空文本不写该字段。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '文档', insertText: 'HTTP_登记接口($1, "GET", "/api/health", "健康检查", "返回服务运行状态")'
  },
  {
    name: 'HTTP_登记接口参数', signature: 'HTTP_登记接口参数(服务端, 方法, 路径, 参数位置, 参数名, 说明, 示例值, 必填)', description: '给已登记的接口追加一个参数说明，让 Try it out 可以预填示例值直接调试；参数位置用模块常量：#接口参数_路径（路径里 {名称} 占位）、#接口参数_查询（URL 查询参数）、#接口参数_请求头。红线：必须先用 HTTP_登记接口 登记同方法同路径的接口；路径参数强制必填（OpenAPI 规范要求）；同名同位置参数重复登记时覆盖。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', '接口方法，与 HTTP_登记接口 保持一致，大小写不敏感。'), parameter('路径', 'wideString', '接口路径，与 HTTP_登记接口 保持一致。'), parameter('参数位置', 'int', '参数位置常量：#接口参数_路径 / #接口参数_查询 / #接口参数_请求头。'), parameter('参数名', 'wideString', '参数名称；路径参数必须与路径里的 {名称} 占位一致。'), parameter('说明', 'wideString', '参数说明，显示在文档与调试面板；空文本用参数名代替。'), parameter('示例值', 'wideString', '示例值，Try it out 预填；空文本表示无示例。'), parameter('必填', 'bool', '是否必填；路径参数强制必填，本参数只对查询参数与请求头生效。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '文档', insertText: 'HTTP_登记接口参数($1, "GET", "/user/{id}", #接口参数_路径, "id", "用户编号", "42", 真)'
  },
  {
    name: 'HTTP_登记接口示例', signature: 'HTTP_登记接口示例(服务端, 方法, 路径, 请求体示例, 响应示例, 响应内容类型)', description: '给已登记的接口补请求体与响应示例：请求体示例进入 OpenAPI requestBody（Try it out 预填），响应示例进入 200 响应；请求体示例必须是合法 JSON 文本（运行时不校验语法，原样嵌入规范）。红线：必须先用 HTTP_登记接口 登记同方法同路径的接口；请求体示例与响应示例不能同时为空；响应内容类型空文本按 application/json 处理。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle), parameter('方法', 'wideString', '接口方法，与 HTTP_登记接口 保持一致，大小写不敏感。'), parameter('路径', 'wideString', '接口路径，与 HTTP_登记接口 保持一致。'), parameter('请求体示例', 'wideString', 'JSON 文本示例，Try it out 预填；空文本表示该接口无请求体示例。'), parameter('响应示例', 'wideString', '响应正文示例文本；空文本表示不登记响应示例。'), parameter('响应内容类型', 'wideString', '响应 Content-Type，如 "application/json"；空文本按 application/json 处理。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '文档', insertText: 'HTTP_登记接口示例($1, "POST", "/api/user", "{\\"姓名\\":\\"张三\\"}", "{\\"ok\\":true}", "")'
  },
  {
    name: 'HTTP_取接口文档JSON', signature: 'HTTP_取接口文档JSON(服务端)', description: '按当前登记生成 OpenAPI 3.0.3 规范 JSON 文本并返回；servers 为 "/"（页面同源，与监听地址端口解耦）。可配合文件写入命令把规范存盘，交付前端团队或导入接口管理平台；未启用接口文档时返回空文本。',
    parameters: [parameter('服务端', 'HTTP服务端', serverHandle)],
    returnType: 'wideString', returnLabel: '文本型', category: '文档'
  },
  {
    name: 'HTTP_启动服务', signature: 'HTTP_启动服务(端口)', description: '旧版单服务兼容入口；在 127.0.0.1 启动后台服务，建议新代码使用受管服务 API。',
    parameters: [parameter('端口', 'int', '在 127.0.0.1 上监听的端口，0 到 65535。')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
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
    parameters: [parameter('内容', 'wideString', '回复的文本内容，以 UTF-8 编码、状态码 200 发送。')], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
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
  version: '2.3.0',
  category: '网络',
  description: '提供受管 HTTP/1.1 服务端、后台多连接处理、路由（含工作线程直回的静态路由）、完整请求读取、可配置响应、SSE 单向推送（服务端 → 客户端持续下发事件流）、离线接口文档（OpenAPI 3.0.3 规范 + Swagger UI 可交互调试页）、资源限制、连接轮转和运行状态。',
  author: 'LingBuilder',
  tags: ['内置', '网络', 'HTTP', '服务端', 'HTTP/1.1', '路由', '静态路由', 'SSE', '单向推送', '接口文档', 'OpenAPI', 'Swagger UI', '受管并发'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'HTTP服务端', description: '进程内不复用的受管 HTTP 服务端 ID，不暴露原生 SOCKET。', cppType: 'long long' },
      { name: 'HTTP请求', description: '仅在请求生命周期内有效的受管 HTTP 请求 ID。', cppType: 'long long' }
    ],
    constants: [
      { name: '接口参数_路径', type: '整数型', value: 1, description: 'HTTP_登记接口参数 的参数位置：路径占位参数（路径里的 {名称}），OpenAPI in=path，强制必填。' },
      { name: '接口参数_查询', type: '整数型', value: 2, description: 'HTTP_登记接口参数 的参数位置：URL 查询参数（?名称=值），OpenAPI in=query。' },
      { name: '接口参数_请求头', type: '整数型', value: 3, description: 'HTTP_登记接口参数 的参数位置：请求头，OpenAPI in=header。' }
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
      },
      {
        label: 'HTTP 静态路由高吞吐服务',
        insertText: 'HTTP服务端 服务 = HTTP_创建服务()\nHTTP_配置服务(服务, "127.0.0.1", 8080, 8, 256)\nHTTP_设置连接轮转(服务, 1000)\nHTTP_添加静态路由(服务, "GET", "/api/data", "{\\"ok\\":true}", "application/json; charset=utf-8")\nHTTP_添加静态文件路由(服务, "GET", "/page", "C:\\\\site\\\\index.html", "", "text/html; charset=utf-8")\nHTTP_添加路由(服务, "GET", "/api/time", &处理时间)\nHTTP_启动(服务)',
        description: '固定内容走静态路由由工作线程直回（不占 UI 线程），仅按请求计算的内容用动态处理器。'
      },
      {
        label: 'HTTP SSE 单向推送（服务端 → 客户端）',
        insertText: 'HTTP服务端 服务 = HTTP_创建服务()\nHTTP_配置服务(服务, "127.0.0.1", 8080, 4, 256)\nHTTP_添加路由(服务, "GET", "/events", &处理订阅)\nHTTP_启动(服务)\n\n空 处理订阅()\n    HTTP请求 请求 = HTTP_取当前请求()\n    HTTP_设置响应头(请求, "Access-Control-Allow-Origin", "*")\n    HTTP_SSE_开始(请求)\n    HTTP_SSE_推送事件(请求, "hello", "连接成功")',
        description: '浏览器 EventSource 订阅 /events 后连接保持；把请求句柄存入变量或数组，之后在时钟、按钮或任意线程里随时 HTTP_SSE_推送/推送事件 下发，HTTP_SSE_结束 关闭。'
      },
      {
        label: 'HTTP 接口文档一站托管（OpenAPI + Swagger UI）',
        insertText: 'HTTP服务端 服务 = HTTP_创建服务()\nHTTP_配置服务(服务, "127.0.0.1", 8080, 4, 256)\nHTTP_启用接口文档(服务, "/docs", "演示服务")\nHTTP_添加静态路由(服务, "GET", "/api/health", "{\\"ok\\":true}", "application/json; charset=utf-8")\nHTTP_添加路由(服务, "POST", "/api/user", &处理创建用户)\nHTTP_登记接口(服务, "GET", "/api/health", "健康检查", "返回服务运行状态")\nHTTP_登记接口(服务, "POST", "/api/user", "创建用户", "提交 JSON 建档，返回创建结果")\nHTTP_登记接口示例(服务, "POST", "/api/user", "{\\"姓名\\":\\"张三\\"}", "{\\"ok\\":true}", "")\nHTTP_启动(服务)',
        description: '启用接口文档后浏览器打开 /docs 即得可交互文档页（离线 Swagger UI，无 CDN），Try it out 直接调用真实接口；登记接口的方法路径必须与真实路由一字不差，HTTP_取接口文档JSON 可把规范存盘交付前端。'
      }
    ],
    docs: [{ title: 'HTTP 服务端模块使用说明', path: 'docs/modules/http-server/README.md' }]
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
