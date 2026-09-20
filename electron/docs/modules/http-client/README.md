# HTTP 客户端模块 2.1

模块 ID：`lingbuilder.net.http-client`
当前版本：`2.1.0`
最低 LingBuilder：`0.2.8`
平台：Windows、MSVC、Win32 或 x64

本模块基于 WinHTTP 提供受管 HTTP/HTTPS 客户端。客户端、请求和原生 `HINTERNET` 句柄由运行时管理，`.lcpp` 只使用稳定的整数 ID。普通 Win32 和 `new_emoji` 后端共享同一份请求实现，异步完成处理器都在 UI 消息线程执行。

## 快速开始

```lcpp
HTTP客户端 客户端 = HTTP客户端_创建客户端()
HTTP客户端_设置超时(客户端, 10000, 15000, 30000, 30000)
HTTP客户端_设置资源限制(客户端, 64, 64, 64, 10)
HTTP客户端_设置默认请求头(客户端, "Accept", "application/json")
HTTP客户端请求 请求 = HTTP客户端_GET异步(客户端, "https://example.com/api", &请求完成)

空 请求完成()
    HTTP客户端请求 当前请求 = HTTP客户端_取当前请求()
    如果 (HTTP客户端_请求是否成功(当前请求))
        调试输出(HTTP客户端_取响应文本编码(当前请求, "auto"))
    否则
        调试输出(HTTP客户端_取请求错误(当前请求))
    如果结束
    HTTP客户端_销毁请求(当前请求)
结束
```

完成处理器必须是无参数、返回空的中文处理器，并使用 `&处理器名` 引用。处理器中通过 `HTTP客户端_取当前请求()` 取得当前请求 ID；响应快照在处理器执行期间保持可读。

## 受管请求流程

需要设置请求头、正文或流式文件时，使用显式请求对象：

```lcpp
HTTP客户端 客户端 = HTTP客户端_创建客户端()
HTTP客户端请求 请求 = HTTP客户端_创建请求(客户端, "POST", "https://example.com/upload")
HTTP客户端_设置JSON正文(请求, "{\"name\":\"LingBuilder\"}")
HTTP客户端_设置请求头(请求, "Accept", "application/json")
HTTP客户端_绑定完成处理器(请求, &请求完成)
HTTP客户端_开始请求(请求)
```

大文件上传使用 `HTTP客户端_设置文件正文`，大响应使用 `HTTP客户端_设置响应文件`。流式响应成功后，`HTTP客户端_取响应文件` 返回最终路径，`HTTP客户端_取响应字节集` 对流式响应返回空字节集。

## 安全与资源限制

- 地址只接受 `http://` 和 `https://`；请求头名称、值和凭据拒绝 CR/LF 注入。
- `Host`、`Content-Length`、`Connection`、`Transfer-Encoding`、`Cookie` 和 `Set-Cookie` 由运行时管理，不能通过普通请求头覆盖；提交已有 Cookie 必须使用下面的专用注入命令，而不是 `设置请求头`。
- 默认校验证书链、主机名、有效期和用途；只有显式调用 TLS 策略时才允许放宽验证。证书固定使用 SHA-256 指纹。
- 客户端可独立设置代理、服务器/代理凭据、自动 Cookie 罐开关、手工注入 Cookie、自动解压、重定向、响应/上传上限和超时；上传上限同时约束内存正文与文件正文，`HTTP客户端_取上传字节数` 会报告已经写入 WinHTTP 的字节数。密码和手工 Cookie 只驻留在进程内存，销毁客户端时清除。
- `HTTP客户端_执行同步` 和 `HTTP客户端_等待请求` 适合后台任务或测试；窗口事件中优先使用异步入口，避免阻塞消息循环。

## Cookie 注入（2.1 新增）

模块的 Cookie 能力分两层，注意区分：

- **自动罐（回送已收过的）**：`HTTP客户端_设置Cookie(客户端, 启用)` 只是 WinHTTP 会话罐的开关，负责自动接收 `Set-Cookie` 并对后续请求自动回送，不提供注入口。
- **手工注入（把已有 Cookie 发出去）**：用于把从浏览器、内存或文件取得的现成 Cookie 原样提交。

```lcpp
// 方式一：按请求注入完整 Cookie 头（优先级最高，该请求含重定向只发这份，自动罐回送被关闭）
HTTP客户端请求 请求 = HTTP客户端_创建请求(客户端, "GET", "https://mms.example.com/api/check")
HTTP客户端_请求置Cookie(请求, "PASS_ID=windows_1-abc; user-extend-session=xyz")
HTTP客户端_开始请求(请求)

// 方式二：注入客户端 Cookie 罐，按域和路径匹配后随后续请求提交
HTTP客户端_置Cookie(客户端, "PASS_ID", "windows_1-abc", ".example.com", "/")
文本型 清单 = HTTP客户端_取CookieJSON(客户端)   // 只返回手工注入项
HTTP客户端_删除全部Cookie(客户端)
```

`置Cookie` 的域匹配规则：空域匹配任意主机；前导点（`.example.com`）匹配该域及其子域；否则匹配精确主机或其子域。路径按 Cookie 前缀规则匹配（`/api` 匹配 `/api`、`/api/list`，不匹配 `/apiv2`）。同名同域同路径重复设置为覆盖。手工 Cookie 与自动罐不在同一请求混发：任一注入生效时该请求关闭自动罐回送，避免服务器收到双 `Cookie` 头。

## 响应读取

`HTTP客户端_取响应状态码`、`HTTP客户端_请求是否成功` 分别读取协议状态和 2xx 成功判定。`HTTP客户端_取全部响应头` 返回原始 CRLF 文本，`HTTP客户端_取响应头JSON` 返回合并重复头后的 JSON 对象。正文可按 `auto`、`UTF-8`、`UTF-16LE`、`UTF-16BE`、`GBK`、`GB18030` 或 `ANSI` 解码。

## 旧版兼容入口

以下命令继续保留，行为委托到默认受管客户端，旧项目无需迁移：

```lcpp
HTTP客户端_GET("https://example.com")
调试输出(HTTP客户端_取状态码())
调试输出(HTTP客户端_取响应文本())
```

旧入口不支持并发、独立 Cookie 或流式文件配置；新代码应使用受管客户端和请求对象。旧 `.lcpp` 中的命令名、参数顺序和返回类型保持不变。

## 平台限制

当前稳定 target 为 `windows-msvc-win32` 和 `windows-msvc-x64`，链接 `winhttp.lib` 与 `crypt32.lib`。模块不暴露原生句柄，也不允许通过 HTTP 客户端接口执行任意 shell 或写入未指定的工作区文件。
