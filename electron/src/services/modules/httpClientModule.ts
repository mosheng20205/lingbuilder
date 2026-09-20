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
  description: string
): ModuleCommandBindingParameter => ({
  name,
  type,
  description,
  ...(type === 'handler' ? { handlerSignature: { parameterTypes: [], returnType: '空' } } : {})
});

// 以下说明按 src/services/windowDesigner/httpClientRuntime.ts 的实际校验逻辑核实，重复语义提取为共享常量。
const clientArg = 'HTTP客户端_创建客户端 返回的受管客户端 ID；ID 无效时命令返回失败值，配置类命令还要求该客户端当前没有活动请求。';
const requestArg = 'HTTP客户端_创建请求 或 GET异步 等命令返回的受管请求 ID；请求销毁后失效，配置与正文类命令要求请求尚未开始。';
const headerNameArg = '请求头名称，长度 1 到 256 的合法 token 且不含控制字符；Host、Content-Length、Connection、Transfer-Encoding、Cookie 和 Set-Cookie 由运行时管理，不能手工设置；提交 Cookie 必须改用 HTTP客户端_置Cookie 或 HTTP客户端_请求置Cookie。';
const headerValueArg = '请求头值，不得包含 CR、LF 或其它控制字符。';
const requestUrlArg = '完整请求地址，必须以 http:// 或 https:// 开头，且不含控制字符。';
const bodyContentTypeArg = '请求正文的 Content-Type 文本；文本正文留空时按 text/plain; charset=utf-8 发送。';
const completionHandlerArg = '必须使用 &处理器名；处理器必须无参数，在创建请求的窗口 UI 线程执行，内部用 HTTP客户端_取当前请求 取回请求。';

const client = [parameter('客户端', 'HTTP客户端', clientArg)];
const request = [parameter('请求', 'HTTP客户端请求', requestArg)];

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
    parameters: [...client, parameter('UserAgent', 'wideString', '该客户端后续请求使用的 User-Agent 文本，不能为空且不得含控制字符。')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端',
    insertText: 'HTTP客户端_设置UserAgent($1, "LingBuilderApp/1.0")'
  },
  {
    name: 'HTTP客户端_设置超时', signature: 'HTTP客户端_设置超时(客户端, 解析毫秒, 连接毫秒, 发送毫秒, 接收毫秒)', description: '分别设置 DNS 解析、连接、发送和接收超时，范围 100-3600000 毫秒。',
    parameters: [...client, parameter('解析毫秒', 'int', 'DNS 解析阶段超时毫秒数，100 到 3600000。'), parameter('连接毫秒', 'int', '建立 TCP 连接阶段超时毫秒数，100 到 3600000。'), parameter('发送毫秒', 'int', '发送请求头与正文阶段超时毫秒数，100 到 3600000。'), parameter('接收毫秒', 'int', '接收响应阶段单次读取超时毫秒数，100 到 3600000。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '客户端', insertText: 'HTTP客户端_设置超时($1, 10000, 15000, 30000, 30000)'
  },
  {
    name: 'HTTP客户端_设置资源限制', signature: 'HTTP客户端_设置资源限制(客户端, 响应头上限KB, 响应体上限MB, 上传上限MB, 最大重定向次数)', description: '限制响应头、内存或文件响应、上传和自动重定向，阻止不受控资源占用。',
    parameters: [...client, parameter('响应头上限KB', 'int', '响应头总大小上限，单位 KB，1 到 1024。'), parameter('响应体上限MB', 'int', '内存中响应正文的大小上限，单位 MB，1 到 4096。'), parameter('上传上限MB', 'int', '上传正文或文件的大小上限，单位 MB，1 到 4096。'), parameter('最大重定向次数', 'int', '自动跟随重定向的最大次数，0 到 100。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '客户端', insertText: 'HTTP客户端_设置资源限制($1, 64, 64, 64, 10)'
  },
  {
    name: 'HTTP客户端_设置重定向策略', signature: 'HTTP客户端_设置重定向策略(客户端, 允许重定向, 允许HTTPS降级HTTP)', description: '设置自动重定向；默认允许同等或更安全协议，禁止 HTTPS 降级到 HTTP。',
    parameters: [...client, parameter('允许重定向', 'bool', '传真自动跟随 3xx 重定向，传假把 3xx 原样交给调用方。'), parameter('允许HTTPS降级HTTP', 'bool', '传真才允许 HTTPS 请求被重定向到 HTTP；默认假，防止协议降级。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置代理', signature: 'HTTP客户端_设置代理(客户端, 模式, 代理地址, 绕过列表)', description: '配置代理模式：0 系统默认、1 直连、2 固定代理；固定代理必须提供地址。',
    parameters: [...client, parameter('模式', 'int', '代理模式：0 使用系统默认配置，1 直连不经代理，2 固定代理地址。'), parameter('代理地址', 'wideString', '固定代理地址，模式为 2 时必须提供且不能含换行。'), parameter('绕过列表', 'wideString', '不走代理的域名或 IP 列表，格式遵循 WinHTTP；不需要时传空文本。')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端',
    insertText: 'HTTP客户端_设置代理($1, 0, "", "")'
  },
  {
    name: 'HTTP客户端_设置服务器凭据', signature: 'HTTP客户端_设置服务器凭据(客户端, 用户名, 密码)', description: '设置内存中的 HTTP Basic 服务器凭据；不会写入模块日志或持久化配置。',
    parameters: [...client, parameter('用户名', 'wideString', 'HTTP Basic 服务器验证用户名，不得含控制字符。'), parameter('密码', 'wideString', 'HTTP Basic 服务器验证密码，不得含控制字符；只保存在内存中，不写入日志。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置代理凭据', signature: 'HTTP客户端_设置代理凭据(客户端, 用户名, 密码)', description: '设置内存中的 HTTP Basic 代理凭据。',
    parameters: [...client, parameter('用户名', 'wideString', '代理 Basic 验证用户名，不得含控制字符。'), parameter('密码', 'wideString', '代理 Basic 验证密码，不得含控制字符；只保存在内存中。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置TLS策略', signature: 'HTTP客户端_设置TLS策略(客户端, 验证证书, 允许自签名)', description: '设置 HTTPS 证书策略；默认完整验证系统信任链、主机名、用途和有效期。',
    parameters: [...client, parameter('验证证书', 'bool', '传真校验证书链、主机名、用途和有效期；传假属于高风险调试能力。'), parameter('允许自签名', 'bool', '传真额外接受自签名证书，其余校验保持不变。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置证书固定', signature: 'HTTP客户端_设置证书固定(客户端, SHA256指纹)', description: '设置最终 HTTPS 服务端证书的 SHA-256 指纹；空文本清除固定，可包含冒号或空格。',
    parameters: [...client, parameter('SHA256指纹', 'wideString', '要固定的服务端证书 SHA-256 指纹，64 位十六进制，可含冒号或空格；空文本清除固定。')], returnType: 'bool', returnLabel: '逻辑型', category: '安全'
  },
  {
    name: 'HTTP客户端_设置自动解压', signature: 'HTTP客户端_设置自动解压(客户端, 启用)', description: '启用或关闭 WinHTTP gzip/deflate 自动解压；默认启用。',
    parameters: [...client, parameter('启用', 'bool', '传真由 WinHTTP 自动解压 gzip 与 deflate 响应，默认启用。')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_设置Cookie', signature: 'HTTP客户端_设置Cookie(客户端, 启用)', description: '启用或关闭 WinHTTP 自动 Cookie 罐（接收 Set-Cookie 并对后续请求自动回送）；默认启用且不与浏览器共享。注意这只是自动罐开关，手工注入已有 Cookie 用 HTTP客户端_置Cookie 或 HTTP客户端_请求置Cookie。',
    parameters: [...client, parameter('启用', 'bool', '传真启用自动接收和回送 Cookie 的会话罐，默认启用，不与浏览器共享；传假整体关闭自动 Cookie 行为。')], returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_置Cookie', signature: 'HTTP客户端_置Cookie(客户端, 名称, 值, 域, 路径)', description: '向客户端手工注入一条 Cookie，随后续匹配的请求提交；同名同域同路径覆盖旧值；与 WinHTTP 自动罐独立保存。',
    parameters: [...client,
      parameter('名称', 'wideString', 'Cookie 名称，不能为空，不能包含等号或控制字符。'),
      parameter('值', 'wideString', 'Cookie 值，不得包含 CR、LF 等控制字符；允许空值。'),
      parameter('域', 'wideString', '生效域名；空文本匹配任意主机，前导点（如 .example.com）匹配该域及其子域，否则匹配精确主机或其子域。'),
      parameter('路径', 'wideString', '生效路径前缀；空文本按 /，仅当请求路径与该前缀按 Cookie 路径规则匹配时回送。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '客户端',
    insertText: 'HTTP客户端_置Cookie($1, "PASS_ID", "$2", ".example.com", "/")',
    example: 'HTTP客户端_置Cookie(客户端, "PASS_ID", "windows_1-abc", ".example.com", "/")'
  },
  {
    name: 'HTTP客户端_取CookieJSON', signature: 'HTTP客户端_取CookieJSON(客户端)', description: '以 JSON 数组返回该客户端手工注入的 Cookie 列表（每项含 name、value、domain、path）；不包含 WinHTTP 自动罐内容。',
    parameters: client, returnType: 'wideString', returnLabel: '文本型', category: '客户端'
  },
  {
    name: 'HTTP客户端_删除全部Cookie', signature: 'HTTP客户端_删除全部Cookie(客户端)', description: '清空该客户端全部手工注入的 Cookie；不影响 WinHTTP 自动罐，销毁客户端时两者都会清除。',
    parameters: client, returnType: 'bool', returnLabel: '逻辑型', category: '客户端'
  },
  {
    name: 'HTTP客户端_设置默认请求头', signature: 'HTTP客户端_设置默认请求头(客户端, 名称, 值)', description: '设置或替换客户端默认请求头，拒绝非法名称、CR/LF 注入和受运行时管理的头。',
    parameters: [...client, parameter('名称', 'wideString', headerNameArg), parameter('值', 'wideString', `${headerValueArg}同名头会被替换。`)], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_添加默认请求头', signature: 'HTTP客户端_添加默认请求头(客户端, 名称, 值)', description: '追加客户端默认请求头；适合 Accept、Cache-Control 等可重复头。',
    parameters: [...client, parameter('名称', 'wideString', headerNameArg), parameter('值', 'wideString', `${headerValueArg}追加到已有同名头之后，适合 Accept 等可重复头。`)], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_删除默认请求头', signature: 'HTTP客户端_删除默认请求头(客户端, 名称)', description: '删除客户端中全部同名默认请求头。',
    parameters: [...client, parameter('名称', 'wideString', '要删除的客户端默认请求头名称，大小写不敏感，同名全部删除。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
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
    parameters: [...client, parameter('方法', 'wideString', 'HTTP 方法文本，只接受合法方法名，内部按大写比较，例如 GET、POST。'), parameter('地址', 'wideString', requestUrlArg)], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_创建请求($1, "GET", "https://example.com/api")'
  },
  {
    name: 'HTTP客户端_设置请求头', signature: 'HTTP客户端_设置请求头(请求, 名称, 值)', description: '在请求启动前设置或替换请求头。',
    parameters: [...request, parameter('名称', 'wideString', headerNameArg), parameter('值', 'wideString', `${headerValueArg}同名头会被替换。`)], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_添加请求头', signature: 'HTTP客户端_添加请求头(请求, 名称, 值)', description: '在请求启动前追加请求头。',
    parameters: [...request, parameter('名称', 'wideString', headerNameArg), parameter('值', 'wideString', `${headerValueArg}追加到已有同名头之后。`)], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_删除请求头', signature: 'HTTP客户端_删除请求头(请求, 名称)', description: '在请求启动前删除全部同名请求头。',
    parameters: [...request, parameter('名称', 'wideString', '要删除的请求头名称，大小写不敏感，同名全部删除。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_清空请求头', signature: 'HTTP客户端_清空请求头(请求)', description: '在请求启动前清空请求级请求头，不影响客户端默认头。',
    parameters: request, returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_请求置Cookie', signature: 'HTTP客户端_请求置Cookie(请求, Cookie)', description: '为单个请求指定完整 Cookie 请求头内容（如 name1=value1; name2=value2），用于把外部取得的已有 Cookie 原样提交；设置后该请求（含重定向）关闭自动罐回送，只发这份手工 Cookie；空文本恢复默认行为。',
    parameters: [...request, parameter('Cookie', 'wideString', '完整 Cookie 头内容，形如 name1=value1; name2=value2，不得包含 CR、LF 等控制字符；空文本清除并恢复默认 Cookie 行为。')],
    returnType: 'bool', returnLabel: '逻辑型', category: '请求',
    insertText: 'HTTP客户端_请求置Cookie($1, "$2")',
    example: 'HTTP客户端_请求置Cookie(请求, "PASS_ID=windows_1-abc; user-extend-session=abc")'
  },
  {
    name: 'HTTP客户端_设置文本正文', signature: 'HTTP客户端_设置文本正文(请求, 正文, 内容类型)', description: '把文本编码为 UTF-8 请求正文并设置 Content-Type。',
    parameters: [...request, parameter('正文', 'wideString', '作为请求正文的文本，按 UTF-8 编码，会清除之前的文件或二进制正文。'), parameter('内容类型', 'wideString', bodyContentTypeArg)], returnType: 'bool', returnLabel: '逻辑型', category: '请求',
    insertText: 'HTTP客户端_设置文本正文($1, "$2", "text/plain; charset=utf-8")'
  },
  {
    name: 'HTTP客户端_设置JSON正文', signature: 'HTTP客户端_设置JSON正文(请求, JSON)', description: '把 UTF-8 JSON 文本设为请求正文并使用 application/json。',
    parameters: [...request, parameter('JSON', 'wideString', '完整的 JSON 文本，按 UTF-8 作为请求正文，运行时不校验语法。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置二进制正文', signature: 'HTTP客户端_设置二进制正文(请求, 数据, 内容类型)', description: '设置独立复制的字节集请求正文。',
    parameters: [...request, parameter('数据', 'bytes', '作为请求正文的字节集，运行时独立复制一份，受上传上限约束。'), parameter('内容类型', 'wideString', '请求正文的 Content-Type 文本，例如 application/octet-stream。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置十六进制正文', signature: 'HTTP客户端_设置十六进制正文(请求, 十六进制, 内容类型)', description: '校验并解码偶数长度十六进制文本作为请求正文。',
    parameters: [...request, parameter('十六进制', 'wideString', '偶数长度的十六进制文本，只允许 0-9、a-f、A-F；解码后作为二进制正文，格式非法返回假。'), parameter('内容类型', 'wideString', '请求正文的 Content-Type 文本，例如 application/octet-stream。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置文件正文', signature: 'HTTP客户端_设置文件正文(请求, 文件路径, 内容类型)', description: '以 64KB 分块上传本机文件，不把整个文件载入内存。',
    parameters: [...request, parameter('文件路径', 'wideString', '要上传的本机文件路径，不能为空；按 64KB 分块读取，不把整个文件载入内存。'), parameter('内容类型', 'wideString', '上传时的 Content-Type 文本，例如 application/octet-stream。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求'
  },
  {
    name: 'HTTP客户端_设置响应文件', signature: 'HTTP客户端_设置响应文件(请求, 文件路径, 允许覆盖)', description: '把响应流式写入临时文件并原子替换目标文件，避免大响应驻留内存。',
    parameters: [...request, parameter('文件路径', 'wideString', '保存响应的本机文件路径，不能为空；先写临时文件再原子替换到该路径。'), parameter('允许覆盖', 'bool', '传真时覆盖已存在的目标文件，传假时目标已存在会失败。')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
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
    parameters: [...request, parameter('超时毫秒', 'int', '等待请求完成的超时毫秒数，0 到 3600000。')], returnType: 'bool', returnLabel: '逻辑型', category: '请求', visibility: 'advanced'
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
    parameters: [...request, parameter('名称', 'wideString', '要读取的响应头名称，大小写不敏感；重复头合并为逗号分隔文本。')], returnType: 'wideString', returnLabel: '文本型', category: '响应'
  },
  {
    name: 'HTTP客户端_取响应字节集', signature: 'HTTP客户端_取响应字节集(请求)', description: '返回内存响应正文的独立字节集副本；流式文件响应返回空字节集。',
    parameters: request, returnType: 'bytes', returnLabel: '字节集', category: '响应'
  },
  {
    name: 'HTTP客户端_取响应文本编码', signature: 'HTTP客户端_取响应文本编码(请求, 编码)', description: '按 auto、UTF-8、UTF-16LE、UTF-16BE、GBK、GB18030 或 ANSI 解码内存响应。',
    parameters: [...request, parameter('编码', 'wideString', '解码字符集名称，支持 auto、UTF-8、UTF-16LE、UTF-16BE、GBK、GB18030 和 ANSI。')], returnType: 'wideString', returnLabel: '文本型', category: '响应',
    insertText: 'HTTP客户端_取响应文本编码($1, "auto")'
  },
  {
    name: 'HTTP客户端_保存响应文件', signature: 'HTTP客户端_保存响应文件(请求, 文件路径, 允许覆盖)', description: '把已缓冲的响应正文原子保存为文件；流式响应应使用设置响应文件。',
    parameters: [...request, parameter('文件路径', 'wideString', '保存响应正文的本机文件路径，不能为空。'), parameter('允许覆盖', 'bool', '传真时覆盖已存在的目标文件，传假时目标已存在会失败。')], returnType: 'bool', returnLabel: '逻辑型', category: '响应'
  },
  {
    name: 'HTTP客户端_取当前请求', signature: 'HTTP客户端_取当前请求()', description: '在完成处理器中返回当前请求 ID；其它上下文返回 0。',
    parameters: [], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '事件'
  },
  {
    name: 'HTTP客户端_GET异步', signature: 'HTTP客户端_GET异步(客户端, 地址, &处理器)', description: '创建并开始 GET 请求，返回请求 ID；完成后在 UI 线程调用处理器。',
    parameters: [...client, parameter('地址', 'wideString', requestUrlArg), parameter('处理器', 'handler', completionHandlerArg)], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_GET异步($1, "https://example.com", &$2)'
  },
  {
    name: 'HTTP客户端_POSTJSON异步', signature: 'HTTP客户端_POSTJSON异步(客户端, 地址, JSON, &处理器)', description: '创建带 UTF-8 JSON 正文的 POST 请求并异步开始。',
    parameters: [...client, parameter('地址', 'wideString', requestUrlArg), parameter('JSON', 'wideString', '作为请求正文提交的完整 JSON 文本，按 UTF-8 编码。'), parameter('处理器', 'handler', completionHandlerArg)], returnType: 'HTTP客户端请求', returnLabel: 'HTTP客户端请求', category: '请求',
    insertText: 'HTTP客户端_POSTJSON异步($1, "https://example.com/api", "{\\"ok\\":true}", &$2)'
  },
  {
    name: 'HTTP客户端_请求', signature: 'HTTP客户端_请求(方法, 地址, 正文, 超时毫秒)', description: '旧版同步兼容入口；使用默认客户端发送 UTF-8 请求，新代码应使用受管客户端和请求。',
    parameters: [parameter('方法', 'wideString', 'HTTP 方法文本，例如 GET 或 POST。'), parameter('地址', 'wideString', requestUrlArg), parameter('正文', 'wideString', 'UTF-8 请求正文文本，GET 等无正文请求传空文本。'), parameter('超时毫秒', 'int', '同步等待完成的最长毫秒数。')], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_GET', signature: 'HTTP客户端_GET(地址)', description: '旧版同步 GET 兼容入口。',
    parameters: [parameter('地址', 'wideString', requestUrlArg)], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
  },
  {
    name: 'HTTP客户端_POST', signature: 'HTTP客户端_POST(地址, 正文)', description: '旧版同步 UTF-8 JSON POST 兼容入口。',
    parameters: [parameter('地址', 'wideString', requestUrlArg), parameter('正文', 'wideString', '作为 JSON 正文提交的文本，按 UTF-8 编码。')], returnType: 'bool', returnLabel: '逻辑型', category: '兼容', visibility: 'advanced'
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
  version: '2.1.0',
  minLingBuilderVersion: '0.2.8',
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
      },
      {
        label: 'HTTP 客户端 Cookie 注入（2.1）',
        insertText: 'HTTP客户端 客户端 = HTTP客户端_创建客户端()\nHTTP客户端请求 请求 = HTTP客户端_创建请求(客户端, "GET", "https://example.com/api")\nHTTP客户端_请求置Cookie(请求, "PASS_ID=windows_1-abc; user-extend-session=xyz")\nHTTP客户端_绑定完成处理器(请求, &请求完成)\nHTTP客户端_开始请求(请求)',
        description: '把外部取得的已有 Cookie 原样提交：按请求整体注入用 请求置Cookie（该请求含重定向只发这份手工 Cookie，自动罐回送同时关闭）；按域/路径长期回送改用 HTTP客户端_置Cookie(客户端, 名称, 值, 域, 路径)。设置请求头 拒绝 Cookie 头，不得用请求头方式提交。'
      }
    ],
    docs: [{ title: 'HTTP 客户端模块 2.1 使用说明', path: 'docs/modules/http-client/README.md' }]
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
