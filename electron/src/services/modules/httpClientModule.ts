import {
  LingBuilderModuleManifest,
  ModuleBindingValueType,
  ModuleCommandBinding,
  ModuleCommandBindingParameter,
  ModuleCommandContribution,
  ModuleCommandValueType
} from './types';

interface HttpClientCommandSpec {
  name: string;
  signature: string;
  description: string;
  parameters: ModuleCommandBindingParameter[];
  returnType: ModuleCommandValueType;
  returnLabel: string;
  category: '客户端' | '安全' | '请求' | '响应' | '状态' | '事件' | '兼容';
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

const client = [parameter('客户端', 'HTTP客户端')];
const request = [parameter('请求', 'HTTP客户端请求')];

const specs: HttpClientCommandSpec[] = [
  {
    name: 'HTTP客户端_创建客户端', signature: 'HTTP客户端_创建客户端()', description: '创建独立的受管 WinHTTP 客户端并返回稳定 ID。',
    parameters: [], returnType: 'HTTP客户端', returnLabel: 'HTTP客户端', category: '客户端'
  },
  {
    name: 'HTTP客户端_销毁客户端', signature: 'HTTP客户端_销毁客户端(客户端)', description: '取消并回收该客户端的全部请求、Cookie 会话和 WinHTTP 资源。',
    parameters: client, returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_设置UserAgent', signature: 'HTTP客户端_设置UserAgent(客户端, UserAgent)', description: '设置该客户端后续请求使用的 User-Agent；仅在无活动请求时修改。',
    parameters: [...client, parameter('UserAgent', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端',
    insertText: 'HTTP客户端_设置UserAgent($1, "LingBuilderApp/1.0")'
  },
  {
    name: 'HTTP客户端_设置超时', signature: 'HTTP客户端_设置超时(客户端, 解析毫秒, 连接毫秒, 发送毫秒, 接收毫秒)', description: '分别设置 DNS 解析、连接、发送和接收超时，范围 100-3600000 毫秒。',
    parameters: [...client, parameter('解析毫秒', 'int'), parameter('连接毫秒', 'int'), parameter('发送毫秒', 'int'), parameter('接收毫秒', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '客户端', insertText: 'HTTP客户端_设置超时($1, 10000, 15000, 30000, 30000)'
  },
  {
    name: 'HTTP客户端_设置资源限制', signature: 'HTTP客户端_设置资源限制(客户端, 响应头上限KB, 响应体上限MB, 上传上限MB, 最大重定向次数)', description: '限制响应头、内存或文件响应、上传和自动重定向，阻止不受控资源占用。',
    parameters: [...client, parameter('响应头上限KB', 'int'), parameter('响应体上限MB', 'int'), parameter('上传上限MB', 'int'), parameter('最大重定向次数', 'int')],
    returnType: 'bool', returnLabel: '逻辑型', category: '客户端', insertText: 'HTTP客户端_设置资源限制($1, 64, 64, 64, 10)'
  },
  {
    name: 'HTTP客户端_设置重定向策略', signature: 'HTTP客户端_设置重定向策略(客户端, 允许重定向, 允许HTTPS降级HTTP)', description: '设置自动重定向；默认允许同等或更安全协议，禁止 HTTPS 降级到 HTTP。',
    parameters: [...client, parameter('允许重定向', 'bool'), parameter('允许HTTPS降级HTTP', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置代理', signature: 'HTTP客户端_设置代理(客户端, 模式, 代理地址, 绕过列表)', description: '配置代理模式：0 系统默认、1 直连、2 固定代理；固定代理必须提供地址。',
    parameters: [...client, parameter('模式', 'int'), parameter('代理地址', 'wideString'), parameter('绕过列表', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端',
    insertText: 'HTTP客户端_设置代理($1, 0, "", "")'
  },
  {
    name: 'HTTP客户端_设置服务器凭据', signature: 'HTTP客户端_设置服务器凭据(客户端, 用户名, 密码)', description: '设置内存中的 HTTP Basic 服务器凭据；不会写入模块日志或持久化配置。',
    parameters: [...client, parameter('用户名', 'wideString'), parameter('密码', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置代理凭据', signature: 'HTTP客户端_设置代理凭据(客户端, 用户名, 密码)', description: '设置内存中的 HTTP Basic 代理凭据。',
    parameters: [...client, parameter('用户名', 'wideString'), parameter('密码', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置TLS策略', signature: 'HTTP客户端_设置TLS策略(客户端, 验证证书, 允许自签名)', description: '设置 HTTPS 证书策略；默认完整验证系统信任链、主机名、用途和有效期。',
    parameters: [...client, parameter('验证证书', 'bool'), parameter('允许自签名', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置证书固定', signature: 'HTTP客户端_设置证书固定(客户端, SHA256指纹)', description: '设置最终 HTTPS 服务端证书的 SHA-256 指纹；空文本清除固定，可包含冒号或空格。',
    parameters: [...client, parameter('SHA256指纹', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置自动解压', signature: 'HTTP客户端_设置自动解压(客户端, 启用)', description: '启用或关闭 WinHTTP gzip/deflate 自动解压；默认启用。',
    parameters: [...client, parameter('启用', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_设置Cookie', signature: 'HTTP客户端_设置Cookie(客户端, 启用)', description: '启用或关闭该受管客户端会话内的 Cookie 接收和回送；默认启用且不与浏览器共享。',
    parameters: [...client, parameter('启用', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_设置默认请求头', signature: 'HTTP客户端_设置默认请求头(客户端, 名称, 值)', description: '设置或替换客户端默认请求头，拒绝非法名称、CR/LF 注入和受运行时管理的头。',
    parameters: [...client, parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_添加默认请求头', signature: 'HTTP客户端_添加默认请求头(客户端, 名称, 值)', description: '追加客户端默认请求头；适合 Accept、Cache-Control 等可重复头。',
    parameters: [...client, parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_删除默认请求头', signature: 'HTTP客户端_删除默认请求头(客户端, 名称)', description: '删除客户端中全部同名默认请求头。',
    parameters: [...client, parameter('名称', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_清空默认请求头', signature: 'HTTP客户端_清空默认请求头(客户端)', description: '清空客户端默认请求头。',
    parameters: client, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_取消全部请求', signature: 'HTTP客户端_取消全部请求(客户端)', description: '取消客户端全部运行中请求并关闭对应 WinHTTP 请求句柄。',
    parameters: client, returnType: 'int', returnLabel: '整数型', category: '客户端'
  },
  {
    name: 'HTTP客户端_取活动请求数', signature: 'HTTP客户端_取活动请求数(客户端)', description: '返回当前正在发送或接收的请求数量。',
    parameters: client, returnType: 'int', returnLabel: '整数型', category: '状态'
  },
  {
    name: 'HTTP客户端_取累计请求数', signature: 'HTTP客户端_取累计请求数(客户端)', description: '返回客户端已开始执行的累计请求数量。',
    parameters: client, returnType: 'longLong', returnLabel: '长整数型', category: '状态'
  },
  {
    name: 'HTTP客户端_取客户端错误', signature: 'HTTP客户端_取客户端错误(客户端)', description: '返回客户端配置、会话创建或句柄操作的最近中文错误。',
    parameters: client, returnType: 'wideString', returnLabel: '文本型', category: '状态'
  },
  {
    name: 'HTTP客户端_创建请求', signature: 'HTTP客户端_创建请求(客户端, 方法, 地址)', description: '创建尚未执行的受管请求；仅接受 http:// 或 https:// 和合法 HTTP 方法。',
    parameters: [...client, parameter('方法', 'wideString'), parameter('地址', 'wideString')], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_创建请求($1, "GET", "https://example.com/api")'
  },
  {
    name: 'HTTP客户端_设置请求头', signature: 'HTTP客户端_设置请求头(请求, 名称, 值)', description: '在请求启动前设置或替换请求头。',
    parameters: [...request, parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_添加请求头', signature: 'HTTP客户端_添加请求头(请求, 名称, 值)', description: '在请求启动前追加请求头。',
    parameters: [...request, parameter('名称', 'wideString'), parameter('值', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_删除请求头', signature: 'HTTP客户端_删除请求头(请求, 名称)', description: '在请求启动前删除全部同名请求头。',
    parameters: [...request, parameter('名称', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_清空请求头', signature: 'HTTP客户端_清空请求头(请求)', description: '在请求启动前清空请求级请求头，不影响客户端默认头。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置文本正文', signature: 'HTTP客户端_设置文本正文(请求, 正文, 内容类型)', description: '把文本编码为 UTF-8 请求正文并设置 Content-Type。',
    parameters: [...request, parameter('正文', 'wideString'), parameter('内容类型', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求',
    insertText: 'HTTP客户端_设置文本正文($1, "$2", "text/plain; charset=utf-8")'
  },
  {
    name: 'HTTP客户端_设置JSON正文', signature: 'HTTP客户端_设置JSON正文(请求, JSON)', description: '把 UTF-8 JSON 文本设为请求正文并使用 application/json。',
    parameters: [...request, parameter('JSON', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置二进制正文', signature: 'HTTP客户端_设置二进制正文(请求, 数据, 内容类型)', description: '设置独立复制的字节集请求正文。',
    parameters: [...request, parameter('数据', 'bytes'), parameter('内容类型', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置十六进制正文', signature: 'HTTP客户端_设置十六进制正文(请求, 十六进制, 内容类型)', description: '校验并解码偶数长度十六进制文本作为请求正文。',
    parameters: [...request, parameter('十六进制', 'wideString'), parameter('内容类型', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置文件正文', signature: 'HTTP客户端_设置文件正文(请求, 文件路径, 内容类型)', description: '以 64KB 分块上传本机文件，不把整个文件载入内存。',
    parameters: [...request, parameter('文件路径', 'wideString'), parameter('内容类型', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置响应文件', signature: 'HTTP客户端_设置响应文件(请求, 文件路径, 允许覆盖)', description: '把响应流式写入临时文件并原子替换目标文件，避免大响应驻留内存。',
    parameters: [...request, parameter('文件路径', 'wideString'), parameter('允许覆盖', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP客户端_绑定完成处理器', signature: 'HTTP客户端_绑定完成处理器(请求, &处理器)', description: '绑定请求完成后在创建窗口 UI 线程调用的无参数处理器。',
    parameters: [...request, parameter('处理器', 'handler', '必须使用 &处理器名；处理器必须无参数并返回空。')], returnType: 'bool', returnLabel: '逻辑型', category: '事件',
    insertText: 'HTTP客户端_绑定完成处理器($1, &$2)'
  },
  {
    name: 'HTTP客户端_开始请求', signature: 'HTTP客户端_开始请求(请求)', description: '在独立后台线程执行请求，完成后投递 UI 线程处理器。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_执行同步', signature: 'HTTP客户端_执行同步(请求)', description: '在当前线程同步执行请求；主要用于命令行、测试或受控后台任务，UI 代码应使用异步。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_等待请求', signature: 'HTTP客户端_等待请求(请求, 超时毫秒)', description: '等待异步请求完成；主要用于测试和后台任务，UI 线程不应长时间等待。',
    parameters: [...request, parameter('超时毫秒', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '请求', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_取消请求', signature: 'HTTP客户端_取消请求(请求)', description: '请求取消并关闭活动 WinHTTP 句柄；已完成请求返回假。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_销毁请求', signature: 'HTTP客户端_销毁请求(请求)', description: '取消、等待后台线程结束并永久释放请求 ID。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  ...([
    ['HTTP客户端_取请求客户端', 'HTTP客户端', 'HTTP客户端', '返回请求所属的受管客户端 ID。'],
    ['HTTP客户端_取请求方法', 'wideString', '文本型', '返回请求的大写 HTTP 方法。'],
    ['HTTP客户端_取请求地址', 'wideString', '文本型', '返回请求创建时的原始 URL。'],
    ['HTTP客户端_取请求状态', 'wideString', '文本型', '返回未开始、运行中、已完成、已取消或错误。'],
    ['HTTP客户端_请求是否完成', 'bool', '逻辑型', '判断请求是否已结束，包括成功、HTTP 非 2xx、错误或取消。'],
    ['HTTP客户端_请求是否成功', 'bool', '逻辑型', '判断传输成功且 HTTP 状态码位于 200-299。'],
    ['HTTP客户端_取请求错误', 'wideString', '文本型', '返回请求最近中文错误，不包含凭据或请求正文。'],
    ['HTTP客户端_取系统错误码', 'int', '整数型', '返回最近 WinHTTP 或 Win32 错误码；协议状态失败通常为 0。'],
    ['HTTP客户端_取请求耗时', 'longLong', '长整数型', '返回请求开始到结束的毫秒数。'],
    ['HTTP客户端_取上传字节数', 'longLong', '长整数型', '返回已经成功写入 WinHTTP 的请求正文字节数。'],
    ['HTTP客户端_取下载字节数', 'longLong', '长整数型', '返回已经读取并校验的响应正文字节数。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: name + '(请求)', description, parameters: request, returnType, returnLabel, category: '状态' as const
  })),
  ...([
    ['HTTP客户端_取响应状态码', 'int', '整数型', '返回 HTTP 响应状态码；传输失败且无响应时为 0。'],
    ['HTTP客户端_取响应状态文本', 'wideString', '文本型', '返回服务端状态文本，例如 OK 或 Not Found。'],
    ['HTTP客户端_取响应协议', 'wideString', '文本型', '返回响应协议版本，例如 HTTP/1.1 或 HTTP/2。'],
    ['HTTP客户端_取最终地址', 'wideString', '文本型', '返回自动重定向后的最终 URL。'],
    ['HTTP客户端_取全部响应头', 'wideString', '文本型', '返回 WinHTTP 提供的完整 CRLF 响应头文本。'],
    ['HTTP客户端_取响应头JSON', 'wideString', '文本型', '以 UTF-16 JSON 对象返回响应头；重复头合并为逗号分隔文本。'],
    ['HTTP客户端_取响应十六进制', 'wideString', '文本型', '以小写十六进制返回内存响应正文。'],
    ['HTTP客户端_取响应大小', 'longLong', '长整数型', '返回响应正文总字节数，包括流式写入文件的响应。'],
    ['HTTP客户端_取响应文件', 'wideString', '文本型', '返回成功流式保存后的目标文件路径。'],
    ['HTTP客户端_取内容类型', 'wideString', '文本型', '返回响应 Content-Type。'],
    ['HTTP客户端_取服务器证书SHA256', 'wideString', '文本型', '返回最终 HTTPS 服务端证书 SHA-256 指纹；HTTP 请求为空。']
  ] as const).map(([name, returnType, returnLabel, description]) => ({
    name, signature: name + '(请求)', description, parameters: request, returnType, returnLabel, category: '响应' as const
  })),
  {
    name: 'HTTP客户端_取响应头', signature: 'HTTP客户端_取响应头(请求, 名称)', description: '不区分大小写返回合并后的指定响应头。',
    parameters: [...request, parameter('名称', 'wideString')], returnType: 'wideString', returnLabel: '文本型', category: '响应'
  },
  {
    name: 'HTTP客户端_取响应字节集', signature: 'HTTP客户端_取响应字节集(请求)', description: '返回内存响应正文的独立字节集副本；流式文件响应返回空字节集。',
    parameters: request, returnType: 'bytes', returnLabel: '字节集', category: '响应'
  },
  {
    name: 'HTTP客户端_取响应文本编码', signature: 'HTTP客户端_取响应文本编码(请求, 编码)', description: '按 auto、UTF-8、UTF-16LE、UTF-16BE、GBK、GB18030 或 ANSI 解码内存响应。',
    parameters: [...request, parameter('编码', 'wideString')], returnType: 'wideString', returnLabel: '文本型', category: '响应',
    insertText: 'HTTP客户端_取响应文本编码($1, "auto")'
  },
  {
    name: 'HTTP客户端_保存响应文件', signature: 'HTTP客户端_保存响应文件(请求, 文件路径, 允许覆盖)', description: '把已缓冲的响应正文原子保存为文件；流式响应应使用设置响应文件。',
    parameters: [...request, parameter('文件路径', 'wideString'), parameter('允许覆盖', 'bool')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP客户端_取当前请求', signature: 'HTTP客户端_取当前请求()', description: '在完成处理器中返回当前请求 ID；其它上下文返回 0。',
    parameters: [], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '事件'
  },
  {
    name: 'HTTP客户端_GET异步', signature: 'HTTP客户端_GET异步(客户端, 地址, &处理器)', description: '创建并开始 GET 请求，返回请求 ID；完成后在 UI 线程调用处理器。',
    parameters: [...client, parameter('地址', 'wideString'), parameter('处理器', 'handler')], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_GET异步($1, "https://example.com", &$2)'
  },
  {
    name: 'HTTP客户端_POSTJSON异步', signature: 'HTTP客户端_POSTJSON异步(客户端, 地址, JSON, &处理器)', description: '创建带 UTF-8 JSON 正文的 POST 请求并异步开始。',
    parameters: [...client, parameter('地址', 'wideString'), parameter('JSON', 'wideString'), parameter('处理器', 'handler')], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_POSTJSON异步($1, "https://example.com/api", "{\\"ok\\":true}", &$2)'
  },
  {
    name: 'HTTP客户端_请求', signature: 'HTTP客户端_请求(方法, 地址, 正文, 超时毫秒)', description: '旧版同步兼容入口；使用默认客户端发送 UTF-8 请求，新代码应使用受管客户端和请求。',
    parameters: [parameter('方法', 'wideString'), parameter('地址', 'wideString'), parameter('正文', 'wideString'), parameter('超时毫秒', 'int')], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_GET', signature: 'HTTP客户端_GET(地址)', description: '旧版同步 GET 兼容入口。',
    parameters: [parameter('地址', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_POST', signature: 'HTTP客户端_POST(地址, 正文)', description: '旧版同步 UTF-8 JSON POST 兼容入口。',
    parameters: [parameter('地址', 'wideString'), parameter('正文', 'wideString')], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_取状态码', signature: 'HTTP客户端_取状态码()', description: '旧版兼容入口；返回最近默认请求状态码。',
    parameters: [], returnType: 'int', returnLabel: '整数型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_取响应文本', signature: 'HTTP客户端_取响应文本()', description: '旧版兼容入口；按 UTF-8 返回最近默认请求正文。',
    parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_取错误', signature: 'HTTP客户端_取错误()', description: '旧版兼容入口；返回最近默认请求中文错误。',
    parameters: [], returnType: 'wideString', returnLabel: '文本型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_清空状态', signature: 'HTTP客户端_清空状态()', description: '旧版兼容入口；清空最近默认请求状态。',
    parameters: [], returnType: 'void', returnLabel: '空', category: '兼容', visibility: 'advanced'
  }
];

function contribution(spec: HttpClientCommandSpec): ModuleCommandContribution {
  const placeholders = spec.parameters.map((item, index) => item.type === 'handler' ? '&$' + (index + 1) : '$' + (index + 1));
  return {
    name: spec.name,
    signature: spec.signature,
    description: spec.description,
    insertText: spec.insertText || spec.name + '(' + placeholders.join(', ') + ')',
    returnType: spec.returnLabel,
    category: spec.category,
    capabilityKind: spec.category === '兼容' ? 'secureReplacement' : 'managed',
    visibility: spec.visibility
  };
}

function binding(spec: HttpClientCommandSpec): ModuleCommandBinding {
  return {
    command: spec.name,
    runtimeName: spec.name,
    parameters: spec.parameters,
    returnType: spec.returnType,
    encoding: spec.parameters.some(item => item.type === 'wideString' || item.type === 'handler') || spec.returnType === 'wideString' ? 'wide' : 'raw',
    example: spec.example || spec.insertText?.replace(/\$\d+/gu, '示例值') || spec.name + '()',
    description: spec.description
  };
}

export const HTTP_CLIENT_COMMAND_SPECS = specs;

export const HTTP_CLIENT_MODULE: LingBuilderModuleManifest = {
  schemaVersion: 2,
  id: 'lingbuilder.net.http-client',
  name: 'HTTP 客户端模块',
  version: '2.0.0',
  minLingBuilderVersion: '0.2.7',
  category: '网络',
  description: '提供受管 WinHTTP HTTP/HTTPS 客户端、多请求并发、后台完成事件、代理与身份验证、TLS 证书策略、重定向、Cookie、压缩、文本/二进制/文件上传下载、资源限制和运行统计。',
  author: 'LingBuilder',
  license: 'LingBuilder Built-in Module License',
  tags: ['内置', '网络', 'HTTP', 'HTTPS', '客户端', 'WinHTTP', 'TLS', '代理', '异步', '文件传输'],
  contributes: {
    commands: specs.map(contribution),
    types: [
      { name: 'HTTP客户端', description: '受管 WinHTTP 会话 ID，隔离配置、Cookie、请求和统计，不暴露原生 HINTERNET。', cppType: 'long long' },
      { name: 'HTTP客户端请求', description: '受管 HTTP 请求或响应 ID，可异步取消、等待、读取结果和显式销毁。', cppType: 'long long' }
    ],
    snippets: [
      {
        label: 'HTTP 受管异步客户端',
        insertText: 'HTTP客户端 客户端 = HTTP客户端_创建客户端()\nHTTP客户端_设置超时(客户端, 10000, 15000, 30000, 30000)\nHTTP客户端_设置资源限制(客户端, 64, 64, 64, 10)\nHTTP客户端请求 请求 = HTTP客户端_GET异步(客户端, "https://example.com/api", &请求完成)',
        description: '创建具有超时、资源限制和 UI 线程完成处理器的受管客户端。'
      },
      {
        label: 'HTTP 客户端完成处理器',
        insertText: '空 请求完成()\n    HTTP客户端请求 请求 = HTTP客户端_取当前请求()\n    如果 (HTTP客户端_请求是否成功(请求))\n        调试输出(HTTP客户端_取响应文本编码(请求, "auto"))\n    否则\n        调试输出(HTTP客户端_取请求错误(请求))\n    如果结束\n结束',
        description: '在 UI 线程读取不可变响应快照并处理错误。'
      }
    ],
    docs: [{ title: 'HTTP 客户端模块 2.0 使用说明', path: 'docs/modules/http-client/README.md' }]
  },
  targets: [
    {
      id: 'windows-msvc-win32', platform: 'windows', arch: 'win32', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_HTTP_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    },
    {
      id: 'windows-msvc-x64', platform: 'windows', arch: 'x64', toolchain: 'msvc',
      libs: ['winhttp.lib', 'crypt32.lib'], defines: ['LINGBUILDER_HTTP_CLIENT_MODULE'], compileOptions: ['/std:c++17']
    }
  ],
  bindings: { commands: specs.map(binding) }
};
