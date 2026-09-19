<!-- 此文件由 electron/scripts/generate-cef3-fbro-event-docs.ts 生成。请修改 CEF3 事件目录或模块 manifest 后运行 npm run module:cef3-docs。 -->
# CEF3 模块事件与接口参考

本参考从 LingBuilder 的统一事件目录和实际模块 manifest 自动生成。CEF3 模块族当前包含 10 个模块、98 项可绑定事件名称和 411 条面向用户的中文接口。

> 事件进入统一目录表示名称、分类和绑定契约已经确定，不代表对应 CEF 原生回调已经接通。`planned` 回调不能视为可调用能力；运行状态以当前版本的模块覆盖门禁和构建诊断为准。

## 快速使用

控件参数是裸 `controlRef`，处理器参数使用 `&处理器名`：

```text
绑定结果 = CEF3_绑定事件(浏览器1, "新窗口打开前", &处理新窗口)
结束

事件 处理新窗口()
    目标地址 = CEF3_取事件字段(浏览器1, "url")
    CEF3_设置事件结果(浏览器1, 2)
    调试输出(目标地址)
结束
```

- `CEF3_取事件数据` 返回当前或最近事件的主要文本；复杂事件用 `CEF3_取事件字段` 按字段名读取。
- 同步决策处理器内可调用 `CEF3_设置事件结果`：`0=默认`、`1=允许/继续`、`2=拒绝/取消`、`3=已处理`。
- 需要返回下载路径、修改后的 URL、对话框输入或认证文本时，在处理器返回前调用 `CEF3_设置事件返回文本`。
- 高频事件由 Bridge 受控采样，回调不保证运行在 Win32 窗口线程；不要在事件处理器中执行长时间阻塞操作。

## 统一事件目录

目录统计：通知 47 项，同步决策 47 项，高频通知 4 项。

| # | 中文事件名 | CEF 回调 | 旧设计器事件 ID | 分类 | 类型 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | 浏览器创建完成 | `OnAfterCreated` | - | 生命周期 | 通知 | 浏览器对象创建完成。 |
| 2 | 浏览器即将关闭 | `OnBeforeClose` | - | 生命周期 | 通知 | 浏览器销毁前通知。 |
| 3 | 新窗口打开已中止 | `OnBeforePopupAborted` | - | 生命周期 | 通知 | 新窗口创建流程被中止。 |
| 4 | 开发者工具窗口打开前 | `OnBeforeDevToolsPopup` | - | 生命周期 | 通知 | 开发者工具弹窗创建前通知。 |
| 5 | 浏览器请求关闭 | `DoClose` | - | 生命周期 | 同步决策 | 浏览器请求关闭，可接管。 |
| 6 | 新窗口打开前 | `OnBeforePopup` | - | 生命周期 | 同步决策 | 网页请求打开新窗口，可允许、拒绝或接管。 |
| 7 | 开发工具代理已附加 | `OnDevToolsAgentAttached` | - | 开发者工具协议 | 通知 | 启用“CEF3开发工具_订阅代理附加”后，在 DevTools Protocol 代理附加时触发。 |
| 8 | 开发工具代理已分离 | `OnDevToolsAgentDetached` | - | 开发者工具协议 | 通知 | 启用“CEF3开发工具_订阅代理分离”后，在 DevTools Protocol 代理分离时触发。 |
| 9 | 开发工具协议事件 | `OnDevToolsEvent` | - | 开发者工具协议 | 通知 | 启用“CEF3开发工具_订阅协议事件”后触发。字段包括 method、paramsJson、byteCount、truncated 与 utf8Valid。 |
| 10 | 开发工具协议消息 | `OnDevToolsMessage` | - | 开发者工具协议 | 通知 | 启用“CEF3开发工具_订阅协议消息”后触发。字段 message 保存复制后的完整协议 JSON 或其 1MiB 截断前缀。 |
| 11 | 加载状态改变 | `OnLoadingStateChange` | - | 加载与显示 | 通知 | 加载、前进和后退状态改变。 |
| 12 | 开始加载 | `OnLoadStart` | `LoadStart` | 加载与显示 | 通知 | 主框架或子框架开始加载。 |
| 13 | 加载完成 | `OnLoadEnd` | `LoadEnd` | 加载与显示 | 通知 | 主框架或子框架加载完成。 |
| 14 | 加载失败 | `OnLoadError` | `LoadError` | 加载与显示 | 通知 | 主框架或子框架加载失败。 |
| 15 | 地址被改变 | `OnAddressChange` | `AddressChanged` | 加载与显示 | 通知 | 框架地址改变。 |
| 16 | 标题被改变 | `OnTitleChange` | `TitleChanged` | 加载与显示 | 通知 | 网页标题改变。 |
| 17 | 网页图标地址改变 | `OnFaviconURLChange` | - | 加载与显示 | 通知 | 网页图标候选地址改变。 |
| 18 | 全屏状态改变 | `OnFullscreenModeChange` | - | 加载与显示 | 通知 | 网页进入或退出全屏。 |
| 19 | 状态消息改变 | `OnStatusMessage` | - | 加载与显示 | 通知 | 网页状态消息改变。 |
| 20 | 媒体访问状态改变 | `OnMediaAccessChange` | - | 加载与显示 | 通知 | 摄像头或麦克风使用状态改变。 |
| 21 | 加载进度改变 | `OnLoadingProgressChange` | - | 加载与显示 | 高频通知 | 页面加载进度改变。 |
| 22 | 工具提示显示 | `OnTooltip` | - | 加载与显示 | 同步决策 | 工具提示显示前，可修改文本或接管。 |
| 23 | 控制台消息 | `OnConsoleMessage` | - | 加载与显示 | 同步决策 | JavaScript 控制台消息，可标记已处理。 |
| 24 | 自动调整大小 | `OnAutoResize` | - | 加载与显示 | 同步决策 | 浏览器请求自动调整大小。 |
| 25 | 鼠标指针改变 | `OnCursorChange` | - | 加载与显示 | 同步决策 | 网页请求改变鼠标指针。 |
| 26 | 内容边界改变 | `OnContentsBoundsChange` | - | 加载与显示 | 同步决策 | 网页请求改变内容边界。 |
| 27 | 根窗口屏幕区域查询 | `GetRootWindowScreenRect` | - | 加载与显示 | 同步决策 | 查询外部根窗口屏幕区域。 |
| 28 | 上下文菜单显示前 | `OnBeforeContextMenu` | - | 菜单与对话框 | 通知 | 网页上下文菜单显示前。 |
| 29 | 上下文菜单已关闭 | `OnContextMenuDismissed` | - | 菜单与对话框 | 通知 | 上下文菜单关闭。 |
| 30 | 快速菜单已关闭 | `OnQuickMenuDismissed` | - | 菜单与对话框 | 通知 | 快速菜单关闭。 |
| 31 | 脚本对话框状态重置 | `OnResetDialogState` | - | 菜单与对话框 | 通知 | 脚本对话框状态重置。 |
| 32 | 脚本对话框已关闭 | `OnDialogClosed` | - | 菜单与对话框 | 通知 | 脚本对话框关闭。 |
| 33 | 运行上下文菜单 | `RunContextMenu` | - | 菜单与对话框 | 同步决策 | 可接管网页上下文菜单。 |
| 34 | 上下文菜单命令 | `OnContextMenuCommand` | - | 菜单与对话框 | 同步决策 | 上下文菜单命令触发。 |
| 35 | 运行快速菜单 | `RunQuickMenu` | - | 菜单与对话框 | 同步决策 | 可接管快速菜单。 |
| 36 | 快速菜单命令 | `OnQuickMenuCommand` | - | 菜单与对话框 | 同步决策 | 快速菜单命令触发。 |
| 37 | 文件对话框请求 | `OnFileDialog` | - | 菜单与对话框 | 同步决策 | 网页请求文件或目录对话框。 |
| 38 | 脚本对话框请求 | `OnJSDialog` | - | 菜单与对话框 | 同步决策 | 网页请求 alert、confirm 或 prompt。 |
| 39 | 离开页面确认请求 | `OnBeforeUnloadDialog` | - | 菜单与对话框 | 同步决策 | 网页请求离开页面确认。 |
| 40 | 焦点即将移出 | `OnTakeFocus` | - | 输入与焦点 | 通知 | 焦点即将移出浏览器。 |
| 41 | 浏览器获得焦点 | `OnGotFocus` | - | 输入与焦点 | 通知 | 浏览器获得焦点。 |
| 42 | 网页可拖动区域改变 | `OnDraggableRegionsChanged` | - | 输入与焦点 | 通知 | 网页可拖动区域改变。 |
| 43 | 页内查找结果 | `OnFindResult` | - | 输入与焦点 | 通知 | 页内查找结果更新。停止查找、导航或没有匹配项时，终止通知的 count 可以为 0。 |
| 44 | 浏览器请求焦点 | `OnSetFocus` | - | 输入与焦点 | 同步决策 | 浏览器请求获得焦点。 |
| 45 | 键盘事件预处理 | `OnPreKeyEvent` | - | 输入与焦点 | 同步决策 | Chromium 处理键盘事件前。 |
| 46 | 键盘事件 | `OnKeyEvent` | - | 输入与焦点 | 同步决策 | Chromium 未处理的键盘事件。 |
| 47 | 拖入浏览器 | `OnDragEnter` | - | 输入与焦点 | 同步决策 | 拖放数据进入浏览器。 |
| 48 | Chrome命令 | `OnChromeCommand` | - | 输入与焦点 | 同步决策 | Chrome 命令触发。 |
| 49 | 应用菜单项可见性查询 | `IsChromeAppMenuItemVisible` | - | 输入与焦点 | 同步决策 | 查询应用菜单项可见性。 |
| 50 | 应用菜单项启用查询 | `IsChromeAppMenuItemEnabled` | - | 输入与焦点 | 同步决策 | 查询应用菜单项启用状态。 |
| 51 | 页面动作图标可见性查询 | `IsChromePageActionIconVisible` | - | 输入与焦点 | 同步决策 | 查询页面动作图标可见性。 |
| 52 | 工具栏按钮可见性查询 | `IsChromeToolbarButtonVisible` | - | 输入与焦点 | 同步决策 | 查询工具栏按钮可见性。 |
| 53 | 下载许可查询 | `CanDownload` | - | 下载 | 同步决策 | 下载开始前查询是否允许。 |
| 54 | 下载开始 | `OnBeforeDownload` | - | 下载 | 同步决策 | 下载目标确认前，可指定保存路径或取消。 |
| 55 | 下载进度更新 | `OnDownloadUpdated` | - | 下载 | 高频通知 | 下载进度和状态更新。 |
| 56 | 网站权限提示关闭 | `OnDismissPermissionPrompt` | - | 权限与安全 | 通知 | 网站权限提示关闭。 |
| 57 | 媒体权限请求 | `OnRequestMediaAccessPermission` | - | 权限与安全 | 同步决策 | 网页请求摄像头或麦克风权限。 |
| 58 | 网站权限请求 | `OnShowPermissionPrompt` | - | 权限与安全 | 同步决策 | 网页请求网站权限。 |
| 59 | 身份验证请求 | `GetAuthCredentials` | - | 权限与安全 | 同步决策 | 服务器或代理请求凭据。 |
| 60 | 证书错误 | `OnCertificateError` | - | 权限与安全 | 同步决策 | HTTPS 证书验证失败。 |
| 61 | 客户端证书选择 | `OnSelectClientCertificate` | - | 权限与安全 | 同步决策 | 服务器请求客户端证书。 |
| 62 | 导航请求前 | `OnBeforeBrowse` | - | 网络与资源 | 同步决策 | 导航提交前，可取消。 |
| 63 | 标签页打开地址请求 | `OnOpenURLFromTab` | - | 网络与资源 | 同步决策 | 标签页打开地址前，可取消。 |
| 64 | 资源加载前 | `OnBeforeResourceLoad` | - | 网络与资源 | 同步决策 | 资源请求发送前，可修改或取消。 |
| 65 | 资源响应到达 | `OnResourceResponse` | - | 网络与资源 | 同步决策 | 资源响应头到达。 |
| 66 | 外部协议执行请求 | `OnProtocolExecution` | - | 网络与资源 | 同步决策 | 外部协议执行前，可允许或拒绝。 |
| 67 | 发送Cookie查询 | `CanSendCookie` | - | 网络与资源 | 同步决策 | Cookie 发送前，可拒绝。 |
| 68 | 保存Cookie查询 | `CanSaveCookie` | - | 网络与资源 | 同步决策 | Cookie 保存前，可拒绝。 |
| 69 | 资源请求处理器查询 | `GetResourceRequestHandler` | - | 网络与资源 | 同步决策 | 查询资源请求处理器与默认处理策略。 |
| 70 | Cookie过滤器查询 | `GetCookieAccessFilter` | - | 网络与资源 | 同步决策 | 查询资源请求的 Cookie 过滤器。 |
| 71 | 自定义资源处理器查询 | `GetResourceHandler` | - | 网络与资源 | 同步决策 | 查询自定义资源内容处理器。 |
| 72 | 资源响应过滤器查询 | `GetResourceResponseFilter` | - | 网络与资源 | 同步决策 | 查询资源响应内容过滤器。 |
| 73 | 资源重定向 | `OnResourceRedirect` | - | 网络与资源 | 通知 | 资源请求重定向，可修改新地址。 |
| 74 | 资源加载完成 | `OnResourceLoadComplete` | - | 网络与资源 | 高频通知 | 资源加载完成、失败或取消。 |
| 75 | 音频参数请求 | `GetAudioParameters` | - | 音频与打印 | 同步决策 | 音频流开始前请求音频参数。 |
| 76 | 打印对话框请求 | `OnPrintDialog` | - | 音频与打印 | 同步决策 | 打印对话框请求。 |
| 77 | 打印任务提交 | `OnPrintJob` | - | 音频与打印 | 同步决策 | 打印任务提交。 |
| 78 | PDF纸张大小查询 | `GetPdfPaperSize` | - | 音频与打印 | 同步决策 | 查询 PDF 输出纸张大小。 |
| 79 | 音频流开始 | `OnAudioStreamStarted` | - | 音频与打印 | 通知 | 浏览器音频流开始。 |
| 80 | 音频流停止 | `OnAudioStreamStopped` | - | 音频与打印 | 通知 | 浏览器音频流停止。 |
| 81 | 音频流错误 | `OnAudioStreamError` | - | 音频与打印 | 通知 | 浏览器音频流错误。 |
| 82 | 打印开始 | `OnPrintStart` | - | 音频与打印 | 通知 | 打印任务开始。 |
| 83 | 打印设置请求 | `OnPrintSettings` | - | 音频与打印 | 通知 | 打印设置即将应用。 |
| 84 | 打印状态重置 | `OnPrintReset` | - | 音频与打印 | 通知 | 打印状态重置。 |
| 85 | 音频数据包 | `OnAudioStreamPacket` | - | 音频与打印 | 高频通知 | 浏览器 PCM 音频数据包到达。 |
| 86 | 框架创建 | `OnFrameCreated` | - | 框架与进程 | 通知 | 主框架或子框架创建。 |
| 87 | 框架销毁 | `OnFrameDestroyed` | - | 框架与进程 | 通知 | 主框架或子框架销毁。 |
| 88 | 框架附加 | `OnFrameAttached` | - | 框架与进程 | 通知 | 框架连接到渲染进程。 |
| 89 | 框架分离 | `OnFrameDetached` | - | 框架与进程 | 通知 | 框架与渲染进程分离。 |
| 90 | 主框架改变 | `OnMainFrameChanged` | - | 框架与进程 | 通知 | 主框架对象改变。 |
| 91 | 渲染视图就绪 | `OnRenderViewReady` | - | 框架与进程 | 通知 | 渲染视图可接收消息。 |
| 92 | 渲染进程恢复响应 | `OnRenderProcessResponsive` | - | 框架与进程 | 通知 | 渲染进程恢复响应。 |
| 93 | 渲染进程终止 | `OnRenderProcessTerminated` | - | 框架与进程 | 通知 | 渲染进程终止。 |
| 94 | 主文档可用 | `OnDocumentAvailableInMainFrame` | - | 框架与进程 | 通知 | 主框架 document 已创建。 |
| 95 | 进程消息收到 | `OnProcessMessageReceived` | - | 框架与进程 | 通知 | 收到渲染进程消息。 |
| 96 | 渲染进程无响应 | `OnRenderProcessUnresponsive` | - | 框架与进程 | 同步决策 | 渲染进程无响应，可等待或终止。 |
| 97 | 查询请求 | `OnQuery` | - | JS交互 | 通知 | 页面通过查询函数（window.cefQuery）发起的查询。字段：queryId（数字文本，应答时原样传回）、request（页面请求数据）、persistent。处理器内用 CEF3_查询应答 或 CEF3_查询应答失败 应答，每条查询只能应答一次；未应答的查询 120 秒后自动对页面回错误码 -4。 |
| 98 | 查询已取消 | `OnQueryCanceled` | - | JS交互 | 通知 | 查询被取消（页面取消、导航离开、浏览器关闭或渲染进程终止）。字段：queryId。收到后无需再应答。 |

## 事件数据与决策约定

- 事件正文和字段均由 Bridge 复制为 UTF-16 文本，不向 `.lcpp` 暴露 `CefRefPtr`、裸指针、STL 或 CEF 对象地址。
- 常见字段包括 `url`、`frameId`、`statusCode`、`progress`、`commandId`；具体字段取决于已接通回调，未知字段返回空文本。
- 普通通知异步投递到所属窗口；必须立即返回的决策事件同步投递。未设置结果时沿用该回调的 CEF 默认行为。
- 事件目录以 CEF 150 windowed `CefBrowser` 为基线；当前随附 SDK、Bridge 和运行时仅支持 Windows x64。

## 模块与接口总览

| 模块 | 模块 ID | 用户接口数 |
|---|---|---:|
| CEF3浏览器模块 | `lingbuilder.cef3.browser` | 80 |
| CEF3事件模块 | `lingbuilder.cef3.events` | 6 |
| CEF3受管对象模块 | `lingbuilder.cef3.objects` | 183 |
| CEF3会话模块 | `lingbuilder.cef3.session` | 19 |
| CEF3网络模块 | `lingbuilder.cef3.network` | 2 |
| CEF3传输模块 | `lingbuilder.cef3.transfer` | 34 |
| CEF3自动化模块 | `lingbuilder.cef3.automation` | 6 |
| CEF3开发者工具模块 | `lingbuilder.cef3.devtools` | 8 |
| CEF3视图模块 | `lingbuilder.cef3.views` | 1 |
| CEF3平台工具模块 | `lingbuilder.cef3.platform` | 72 |

以下 411 条接口来自当前模块 manifest。模块详情、补全、诊断和 C++ binding 使用同一份清单。


### 1. CEF3浏览器模块

基于 Chromium Embedded Framework 3，提供设计器浏览器控件、中文命令和集中式浏览器事件目录。 模块 ID：`lingbuilder.cef3.browser`；本节共 80 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3_是否启用崩溃报告` | `CEF3_是否启用崩溃报告()` | 整数型 | 高级 | `cef_crash_reporting_enabled` | 返回当前 CEF 崩溃报告配置是否启用。 |
| 2 | `CEF3_设置崩溃键值` | `CEF3_设置崩溃键值(键, 值)` | 整数型 | 高级 | `cef_set_crash_key_value` | 设置或清除发送到 CEF 崩溃报告的键值元数据；值为空文本时清除该键。 |
| 3 | `CEF3_取命令资源ID` | `CEF3_取命令资源ID(名称)` | 整数型 | 高级 | `cef_id_for_command_id_name` | 按当前 CEF/Chromium 版本把 IDC 命令名称转换为数值 ID；未知名称返回 -1。 |
| 4 | `CEF3_导航` | `CEF3_导航(控件名, 地址)` | 整数型 | 常用 | - | 让指定 CEF3 浏览器控件导航到 HTTP/HTTPS 地址或本地文件地址。 |
| 5 | `CEF3_打开原生UI浏览器` | `CEF3_打开原生UI浏览器(控件名, 地址)` | 整数型 | 常用 | - | 使用 CEF Chrome Runtime 创建带原生地址栏和浏览器界面的独立顶层窗口，并纳入指定内嵌控件的 popup 生命周期管理。 |
| 6 | `CEF3_创建弹窗浏览器` | `CEF3_创建弹窗浏览器(实例编号, 地址, 独立缓存目录, 代理地址)` | 整数型 | 常用 | - | 不依赖设计器控件，用 CEF Chrome Runtime 凭空创建独立顶层浏览器弹窗：不同 实例编号 + 不同 独立缓存目录（独立 profile）实现店铺间 Cookie/缓存隔离，代理地址非空即该弹窗独立出口 IP。实例登记进运行时表，可被 CEF3_枚举实例JSON 列出、由 CEF3_关闭全部实例 统一关闭；实例级 UA 用 CEF3_设置实例用户代理 设置。 |
| 7 | `CEF3_创建区域` | `CEF3_创建区域(实例编号, 左, 顶, 宽, 高, 地址, 独立缓存目录, 代理地址)` | 整数型 | 常用 | - | 不依赖设计器控件，在当前窗口指定矩形区域创建独立 CEF3 浏览器实例（运行时自建承载子窗口 + 独立 profile 缓存目录 + 可选独立代理），用于动态数量的内嵌多浏览器；实例登记进运行时表，可被 CEF3_枚举实例JSON 列出、由 CEF3_关闭全部实例 统一关闭。 |
| 8 | `CEF3会话_取上下文实例` | `CEF3会话_取上下文实例(实例编号)` | 长整数型 | 常用 | - | 取得设计器无关实例（CEF3_创建弹窗浏览器 / CEF3_创建区域 的实例编号）的 RequestContext 受管句柄，随后即可用全部句柄版 CEF3会话_* 命令（Cookie 设置/遍历/删除、清缓存、首选项）对该弹窗/区域实例操作；实例不存在或未创建返回 0，用完用 CEF3会话_释放上下文 释放。 |
| 9 | `CEF3_设置用户代理` | `CEF3_设置用户代理(控件名, 用户代理)` | 整数型 | 常用 | - | 为指定 CEF3 浏览器控件实例设置独立用户代理（UA）。CEF 无 per-browser settings，本命令在「资源加载前」事件里改写请求头 User-Agent，逐实例隔离；用户代理置空则清除覆盖。 |
| 10 | `CEF3_设置实例用户代理` | `CEF3_设置实例用户代理(实例编号, 用户代理)` | 整数型 | 常用 | - | 为设计器无关实例（CEF3_创建弹窗浏览器 / CEF3_创建区域 的实例编号）设置独立用户代理，实现多店铺弹窗/区域各自不同 UA；置空清除覆盖，实例不存在返回 0。 |
| 11 | `CEF3_取用户代理` | `CEF3_取用户代理(控件名)` | 文本型 | 常用 | - | 读取指定 CEF3 浏览器控件实例当前设置的独立用户代理，未设置返回空文本。 |
| 12 | `CEF3_取实例用户代理` | `CEF3_取实例用户代理(实例编号)` | 文本型 | 常用 | - | 读取设计器无关实例（弹窗/区域实例编号）当前设置的独立用户代理，未设置或实例不存在返回空文本。 |
| 13 | `CEF3_关闭全部实例` | `CEF3_关闭全部实例()` | 整数型 | 常用 | - | 关闭当前全部 CEF3 浏览器实例（含内嵌控件与独立顶层弹窗）并释放受管句柄，返回关闭数量。 |
| 14 | `CEF3_枚举实例JSON` | `CEF3_枚举实例JSON()` | 文本型 | 常用 | - | 返回当前全部 CEF3 实例的 JSON 数组，每项含 controlId/地址/标题/缓存目录/代理，供调用方自省与多实例列表展示。 |
| 15 | `CEF3_执行JS` | `CEF3_执行JS(控件名, 脚本)` | 文本型 | 常用 | `Runtime.evaluate` | 通过 DevTools Runtime.evaluate 执行 JavaScript，最多等待 5 秒并返回 JSON 结果；新代码优先使用异步任务接口。 |
| 16 | `CEF3_后退` | `CEF3_后退(控件名)` | 整数型 | 常用 | - | 指定 CEF3 浏览器控件可以后退时返回上一页，成功返回 1。 |
| 17 | `CEF3_前进` | `CEF3_前进(控件名)` | 整数型 | 常用 | - | 指定 CEF3 浏览器控件可以前进时进入下一页，成功返回 1。 |
| 18 | `CEF3_刷新` | `CEF3_刷新(控件名)` | 空 | 常用 | - | 刷新指定 CEF3 浏览器控件的当前网页。 |
| 19 | `CEF3_停止` | `CEF3_停止(控件名)` | 空 | 常用 | - | 停止指定 CEF3 浏览器控件的当前导航。 |
| 20 | `CEF3_取标题` | `CEF3_取标题(控件名)` | 文本型 | 常用 | - | 返回指定 CEF3 浏览器控件当前网页标题。 |
| 21 | `CEF3_取地址` | `CEF3_取地址(控件名)` | 文本型 | 常用 | - | 返回指定 CEF3 浏览器控件当前网页地址。 |
| 22 | `CEF3_取资源地址` | `CEF3_取资源地址(相对路径)` | 文本型 | 常用 | - | 把相对路径解析为随程序一起部署在 exe 同级 assets 目录下的文件地址，返回已按 UTF-8 转义的 file:/// URL，用于加载本地测试页，避免在源码里写死机器特定绝对路径。传入盘符绝对路径、UNC 路径或已带协议的完整地址时原样返回，可重复套用。地址形参是宽字符串指针，因此结果必须先赋给文本型局部变量再传给 CEF3_导航，不能直接内联嵌套。 |
| 23 | `CEF3_设置缓存目录` | `CEF3_设置缓存目录(控件名, 目录)` | 整数型 | 常用 | `CefRequestContext::CreateContext` | 设置实例独立 RequestContext 的缓存目录标识；实际目录被安全映射到全局 root_cache_path 的直接子目录。需在创建前设置。 |
| 24 | `CEF3_设置代理` | `CEF3_设置代理(控件名, 代理地址)` | 整数型 | 常用 | `CefPreferenceManager::SetPreference` | 为实例独立 RequestContext 设置 HTTP/HTTPS/SOCKS5 代理；空文本使用直连。需在创建前设置。 |
| 25 | `CEF3_创建` | `CEF3_创建(控件名)` | 整数型 | 常用 | - | 使用属性面板配置的地址、缓存目录和代理参数初始化指定 CEF3 浏览器控件；传空控件名时初始化当前窗口全部 CEF3 控件。成功返回 1。 |
| 26 | `CEF3_执行消息循环工作` | `CEF3_执行消息循环工作()` | 空 | 高级 | `cef_do_message_loop_work` | 在 CEF 消息循环模式下执行一次非阻塞消息循环工作；Bridge 会安全调度到 CEF UI 线程。 |
| 27 | `CEF3_关闭` | `CEF3_关闭(控件名)` | 空 | 常用 | - | 关闭指定 CEF3 浏览器控件并释放 Chromium 资源。 |
| 28 | `CEF3_取最近事件` | `CEF3_取最近事件(控件名)` | 文本型 | 常用 | - | 返回最近 CEF3 事件名；当前事件清单共 99 个浏览器回调。 |
| 29 | `CEF3_取事件数据` | `CEF3_取事件数据(控件名)` | 文本型 | 常用 | - | 返回最近事件的主要文本数据。 |
| 30 | `CEF3_取事件字段` | `CEF3_取事件字段(控件名, 字段名)` | 文本型 | 常用 | - | 读取最近事件的命名字段，例如 url、frameId、statusCode、progress、commandId。 |
| 31 | `CEF3_读资源响应正文` | `CEF3_读资源响应正文(控件名, 最大字节数, 完成处理器)` | 整数型 | 常用 | - | 在“资源响应到达”处理器执行期间，为当前资源安装有界正文捕获；完成后触发“资源响应正文到达”，通过 CEF3_取事件字段读取 bodyText、bodyBase64、receivedBytes、truncated 和 error。不会重新发起请求。 |
| 32 | `CEF3_替换资源响应内容` | `CEF3_替换资源响应内容(控件名, 查找内容, 替换内容)` | 整数型 | 常用 | - | 为指定 CEF3 浏览器配置响应正文查找替换：之后加载的资源正文中的“查找内容”（按 UTF-8 字节匹配）会被“替换内容”改写，替换内容为空表示删除。二进制安全、流式处理，对整只浏览器全部资源生效；重复调用以最后一次为准。浏览器未就绪时自动排队，导航前配置可覆盖首个页面。只修改响应正文，不改变响应头和状态码。 |
| 33 | `CEF3_清除资源响应替换` | `CEF3_清除资源响应替换(控件名)` | 整数型 | 常用 | - | 移除指定 CEF3 浏览器当前的响应替换配置，之后加载的资源恢复原始正文；已加载页面不受影响。同时取消尚未生效的排队配置。 |
| 34 | `CEF3_设置事件结果` | `CEF3_设置事件结果(控件名, 结果)` | 整数型 | 常用 | - | 设置当前同步事件结果：0=默认、1=允许/继续、2=拒绝/取消、3=已处理。 |
| 35 | `CEF3_设置事件返回文本` | `CEF3_设置事件返回文本(控件名, 文本)` | 整数型 | 常用 | - | 设置当前事件的返回文本，例如修改后的 URL、下载路径、对话框输入或身份验证信息。 |
| 36 | `CEF3_绑定事件` | `CEF3_绑定事件(控件名, 事件名, 处理器)` | 整数型 | 常用 | - | 绑定 CEF3 浏览器事件清单（99 项）到当前窗口无参数中文事件或方法；处理器必须使用 &处理器名。 |
| 37 | `CEF3_启用JS扩展` | `CEF3_启用JS扩展(控件名, 查询函数名, 取消函数名)` | 整数型 | 常用 | - | 启用页面调用原生的 JS 交互（cefQuery）通道：页面通过 window.查询函数名({request, onSuccess, onFailure}) 发起查询，原生通过「查询请求」事件接收并用 CEF3_查询应答 / CEF3_查询应答失败 应答。通道必须在 CEF 初始化之前配置——请优先使用 CEF3 浏览器控件的 jsQueryFunctions 属性（格式“查询函数名,取消函数名”），本命令仅在初始化前调用有效，初始化后调用返回 0。CEF3 每个程序只支持一条查询通道，同名重复调用按幂等成功处理。 |
| 38 | `CEF3_查询应答` | `CEF3_查询应答(控件名, 查询ID, 结果文本)` | 整数型 | 常用 | - | 应答「查询请求」事件：查询ID 从事件字段 queryId 读取（数字文本，原样传回），结果文本回传给页面 onSuccess。每条查询只能应答一次；未应答的查询 120 秒后自动对页面回错误码 -4。 |
| 39 | `CEF3_查询应答失败` | `CEF3_查询应答失败(控件名, 查询ID, 错误码, 错误文本)` | 整数型 | 常用 | - | 以失败结果应答「查询请求」事件：错误码与错误文本回传给页面 onFailure（错误码 0 视为 -1）。每条查询只能应答一次。 |
| 40 | `CEF3_是否可后退` | `CEF3_是否可后退(控件名)` | 整数型 | 常用 | - | 指定 CEF3 浏览器控件可以后退时返回 1。 |
| 41 | `CEF3_是否可前进` | `CEF3_是否可前进(控件名)` | 整数型 | 常用 | - | 指定 CEF3 浏览器控件可以前进时返回 1。 |
| 42 | `CEF3_是否加载中` | `CEF3_是否加载中(控件名)` | 整数型 | 常用 | - | 指定 CEF3 浏览器控件正在加载网页时返回 1。 |
| 43 | `CEF3_是否有效` | `CEF3_是否有效(控件名)` | 整数型 | 常用 | `is_valid` | 指定 CEF3 浏览器控件的原生浏览器对象仍有效时返回 1。 |
| 44 | `CEF3_是否弹出窗口` | `CEF3_是否弹出窗口(控件名)` | 整数型 | 常用 | `is_popup` | 指定 CEF3 浏览器对象由弹出窗口流程创建时返回 1。 |
| 45 | `CEF3_是否同一实例` | `CEF3_是否同一实例(控件名, 另一控件名)` | 整数型 | 常用 | `is_same` | 两个 CEF3 浏览器控件引用同一原生浏览器对象时返回 1。 |
| 46 | `CEF3_是否有文档` | `CEF3_是否有文档(控件名)` | 整数型 | 常用 | `has_document` | 指定 CEF3 浏览器控件已经加载文档时返回 1。 |
| 47 | `CEF3_是否禁用窗口渲染` | `CEF3_是否禁用窗口渲染(控件名)` | 整数型 | 高级 | `is_window_rendering_disabled` | 指定 CEF3 浏览器使用无窗口/OSR 渲染时返回 1；普通窗口浏览器返回 0。 |
| 48 | `CEF3_是否网页全屏` | `CEF3_是否网页全屏(控件名)` | 整数型 | 高级 | `is_fullscreen` | 指定 CEF3 浏览器的网页通过 JavaScript Fullscreen API 进入全屏时返回 1，不表示宿主窗口是否最大化。 |
| 49 | `CEF3_是否使用浏览器视图` | `CEF3_是否使用浏览器视图(控件名)` | 整数型 | 高级 | `has_view` | 指定浏览器由 CEF Views 框架的 CefBrowserView 包装时返回 1，否则返回 0。 |
| 50 | `CEF3_取打开者浏览器ID` | `CEF3_取打开者浏览器ID(控件名)` | 整数型 | 高级 | `get_opener_identifier` | 返回创建当前弹出浏览器的浏览器唯一 ID；当前浏览器不是弹出浏览器时返回 0。 |
| 51 | `CEF3_是否已准备关闭` | `CEF3_是否已准备关闭(控件名)` | 整数型 | 高级 | `is_ready_to_be_closed` | 浏览器进入必须完成的关闭阶段时返回 1；返回 1 后应尽快销毁对应宿主窗口或视图层级。 |
| 52 | `CEF3_是否渲染进程无响应` | `CEF3_是否渲染进程无响应(控件名)` | 整数型 | 高级 | `is_render_process_unresponsive` | 关联渲染进程至少 15 秒未处理输入事件时返回 1；状态变化也可通过“渲染进程无响应/恢复响应”事件接收。 |
| 53 | `CEF3_取运行时样式` | `CEF3_取运行时样式(控件名)` | 整数型 | 高级 | `get_runtime_style` | 返回浏览器运行时样式：0 默认、1 Chrome、2 Alloy；无窗口/OSR 浏览器固定为 Alloy。 |
| 54 | `CEF3_取缩放级别` | `CEF3_取缩放级别(控件名)` | 小数型 | 常用 | `get_zoom_level` | 读取浏览器当前缩放级别；0.0 表示默认缩放，正数放大，负数缩小。 |
| 55 | `CEF3_取默认缩放级别` | `CEF3_取默认缩放级别(控件名)` | 小数型 | 常用 | `get_default_zoom_level` | 读取浏览器宿主的默认缩放级别；未配置默认缩放时返回 0.0。 |
| 56 | `CEF3_设置缩放级别` | `CEF3_设置缩放级别(控件名, 级别)` | 整数型 | 常用 | `set_zoom_level` | 设置浏览器当前缩放级别；传入 0.0 可恢复宿主默认缩放。 |
| 57 | `CEF3_是否可缩放` | `CEF3_是否可缩放(控件名, 缩放命令)` | 整数型 | 高级 | `can_zoom` | 判断浏览器是否可执行指定缩放命令：0 缩小、1 重置、2 放大；可执行时返回 1。 |
| 58 | `CEF3_执行缩放` | `CEF3_执行缩放(控件名, 缩放命令)` | 整数型 | 高级 | `zoom` | 执行浏览器缩放动作：0 缩小、1 重置、2 放大；调用前可用 CEF3_是否可缩放 查询，当前命令不可执行时返回失败状态。 |
| 59 | `CEF3_尝试关闭` | `CEF3_尝试关闭(控件名)` | 整数型 | 常用 | `try_close_browser` | 按 CEF 生命周期协议请求关闭；返回 1 时宿主窗口可立即销毁，返回 0 时应等待关闭回调。 |
| 60 | `CEF3_通知窗口移动或调整大小` | `CEF3_通知窗口移动或调整大小(控件名)` | 整数型 | 高级 | `notify_move_or_resize_started` | 通知 CEF 浏览器宿主其顶层窗口已经开始移动或调整大小，使屏幕坐标、弹出层和渲染位置及时刷新。 |
| 61 | `CEF3_通知屏幕信息已改变` | `CEF3_通知屏幕信息已改变(控件名)` | 整数型 | 高级 | `notify_screen_info_changed` | 通知 CEF 屏幕尺寸、位置或缩放信息已经改变；用于 OSR 或客户端提供外部根窗口的浏览器。 |
| 62 | `CEF3_发送捕获丢失事件` | `CEF3_发送捕获丢失事件(控件名)` | 整数型 | 高级 | `send_capture_lost_event` | 在宿主失去鼠标捕获时通知指定 CEF 浏览器；主要用于禁用窗口渲染的 OSR 输入链路。 |
| 63 | `CEF3_取消输入法组合文本` | `CEF3_取消输入法组合文本(控件名)` | 整数型 | 高级 | `ime_cancel_composition` | 取消并丢弃指定 OSR 浏览器当前的输入法组合文本，不把组合节点内容提交到页面。 |
| 64 | `CEF3_完成输入法组合文本` | `CEF3_完成输入法组合文本(控件名, 保留选择)` | 整数型 | 高级 | `ime_finish_composing_text` | 提交指定 OSR 浏览器当前的输入法组合文本，并选择是否保留现有选区。 |
| 65 | `CEF3_添加单词到词典` | `CEF3_添加单词到词典(控件名, 单词)` | 整数型 | 高级 | `add_word_to_dictionary` | 把非空单词加入指定浏览器配置使用的自定义拼写检查词典。 |
| 66 | `CEF3_替换拼写错误` | `CEF3_替换拼写错误(控件名, 单词)` | 整数型 | 高级 | `replace_misspelling` | 用非空单词替换指定浏览器页面中当前选中的拼写错误文本。 |
| 67 | `CEF3_通知系统拖放结束` | `CEF3_通知系统拖放结束(控件名)` | 整数型 | 高级 | `drag_source_system_drag_ended` | 在系统拖放循环结束后通知指定浏览器，使 CEF 清理拖放源状态。 |
| 68 | `CEF3_通知拖放目标离开` | `CEF3_通知拖放目标离开(控件名)` | 整数型 | 高级 | `drag_target_drag_leave` | 在拖动对象离开浏览器目标区域时通知 CEF 清理目标端拖放状态。 |
| 69 | `CEF3_通知隐藏状态` | `CEF3_通知隐藏状态(控件名, 是否隐藏)` | 整数型 | 高级 | `was_hidden` | 通知无窗口渲染浏览器的宿主已经隐藏或重新显示，使 CEF 暂停或恢复绘制。 |
| 70 | `CEF3_退出网页全屏` | `CEF3_退出网页全屏(控件名, 是否调整大小)` | 整数型 | 高级 | `exit_fullscreen` | 退出网页 Fullscreen API 状态；退出后将引起浏览器视图尺寸变化时，第二个参数传真。 |
| 71 | `CEF3_强制刷新` | `CEF3_强制刷新(控件名)` | 空 | 常用 | `reload_ignore_cache` | 忽略 HTTP 缓存重新加载指定 CEF3 浏览器控件的当前页面。 |
| 72 | `CEF3_页内查找` | `CEF3_页内查找(控件名, 文本, 向前, 区分大小写, 查找下一个)` | 整数型 | 常用 | `find` | 在指定 CEF3 浏览器的当前页面查找文本；查找进度和最终结果通过“页内查找结果”事件返回。 |
| 73 | `CEF3_停止页内查找` | `CEF3_停止页内查找(控件名, 清除选择)` | 整数型 | 常用 | `stop_finding` | 停止指定 CEF3 浏览器的页内查找，并可选择清除当前选区。 |
| 74 | `CEF3_设置焦点` | `CEF3_设置焦点(控件名, 是否聚焦)` | 整数型 | 常用 | `set_focus` | 设置指定 CEF3 浏览器宿主的焦点状态。 |
| 75 | `CEF3_发送鼠标单击事件` | `CEF3_发送鼠标单击事件(控件名, X, Y, 修饰键, 按钮类型, 是否抬起, 单击次数)` | 整数型 | 高级 | `send_mouse_click_event` | 向指定 CEF3 浏览器发送类型化鼠标按下或抬起事件；按钮类型为 0 左键、1 中键、2 右键。 |
| 76 | `CEF3_发送鼠标移动事件` | `CEF3_发送鼠标移动事件(控件名, X, Y, 修饰键, 是否离开)` | 整数型 | 高级 | `send_mouse_move_event` | 向指定 CEF3 浏览器发送类型化鼠标移动事件；坐标相对浏览器视图左上角，离开时最后一个参数传真。 |
| 77 | `CEF3_发送鼠标滚轮事件` | `CEF3_发送鼠标滚轮事件(控件名, X, Y, 修饰键, 横向增量, 纵向增量)` | 整数型 | 高级 | `send_mouse_wheel_event` | 向指定 CEF3 浏览器发送类型化鼠标滚轮事件；坐标相对浏览器视图左上角，增量可为负数。 |
| 78 | `CEF3_发送触摸事件` | `CEF3_发送触摸事件(控件名, 触点ID, X, Y, 半径X, 半径Y, 旋转角度, 压力, 事件类型, 修饰键, 指针类型)` | 整数型 | 高级 | `send_touch_event` | 向无窗口/OSR CEF3 浏览器发送类型化触摸事件；事件类型为 0 松开、1 按下、2 移动、3 取消，指针类型为 0 触摸、1 鼠标、2 笔、3 橡皮擦、4 未知，压力范围为 0.0 到 1.0。 |
| 79 | `CEF3_发送按键事件` | `CEF3_发送按键事件(控件名, 类型, 修饰键, Windows键码, 原生键码, 是否系统键, 字符编码, 未修改字符编码, 焦点在可编辑字段)` | 整数型 | 高级 | `send_key_event` | 向指定 CEF3 浏览器发送类型化按键事件；类型取 0 原始按下、1 按下、2 松开或 3 字符，字符使用 UTF-16 代码单元。 |
| 80 | `CEF3_是否静音` | `CEF3_是否静音(控件名)` | 整数型 | 常用 | `is_audio_muted` | 指定 CEF3 浏览器控件的音频已静音时返回 1。 |

### 2. CEF3事件模块

提供浏览器事件数据、同步决策和处理器引用绑定。 模块 ID：`lingbuilder.cef3.events`；本节共 6 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3事件_取最近事件` | `CEF3事件_取最近事件(控件名)` | 文本型 | 常用 | `LB_CEF3_GetLastEvent` | 取得指定浏览器最近事件名。 |
| 2 | `CEF3事件_取数据` | `CEF3事件_取数据(控件名)` | 文本型 | 常用 | `LB_CEF3_GetEventData` | 取得当前或最近事件的主要文本。 |
| 3 | `CEF3事件_取字段` | `CEF3事件_取字段(控件名, 字段名)` | 文本型 | 常用 | `LB_CEF3_GetEventField` | 读取当前事件的结构化字段。 |
| 4 | `CEF3事件_设置结果` | `CEF3事件_设置结果(控件名, 动作)` | 整数型 | 常用 | `LB_CEF3_SetEventAction` | 设置当前同步事件动作。 |
| 5 | `CEF3事件_设置返回文本` | `CEF3事件_设置返回文本(控件名, 文本)` | 整数型 | 常用 | `LB_CEF3_SetEventResultText` | 设置当前同步事件返回文本。 |
| 6 | `CEF3事件_绑定` | `CEF3事件_绑定(控件名, 事件名, 处理器)` | 整数型 | 常用 | `LB_CEF3_BindEvent` | 把浏览器事件绑定到当前类的无参数处理器。 |

### 3. CEF3受管对象模块

提供任务、缓冲、Value、Dictionary、List、Image、NavigationEntry和证书类型化对象的安全生命周期接口。 模块 ID：`lingbuilder.cef3.objects`；本节共 183 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3任务_取状态` | `CEF3任务_取状态(任务ID)` | 整数型 | 高级 | `LB_CEF3_TaskGetStatus` | 取得异步任务状态。 |
| 2 | `CEF3任务_取结果` | `CEF3任务_取结果(任务ID)` | 文本型 | 高级 | `LB_CEF3_TaskGetResult` | 取得异步任务UTF-16结果。 |
| 3 | `CEF3任务_取错误` | `CEF3任务_取错误(任务ID)` | 文本型 | 高级 | `LB_CEF3_TaskGetError` | 取得异步任务中文错误。 |
| 4 | `CEF3任务_取消` | `CEF3任务_取消(任务ID)` | 整数型 | 高级 | `LB_CEF3_TaskCancel` | 取消尚未完成的任务。 |
| 5 | `CEF3任务_释放` | `CEF3任务_释放(任务ID)` | 整数型 | 高级 | `LB_CEF3_TaskRelease` | 释放异步任务及其结果。 |
| 6 | `CEF3缓冲_从十六进制` | `CEF3缓冲_从十六进制(十六进制)` | 长整数型 | 高级 | `LB_CEF3_BufferCreate` | 从偶数长度十六进制文本创建 Bridge 受管缓冲并返回类型化句柄。 |
| 7 | `CEF3缓冲_复制` | `CEF3缓冲_复制(缓冲句柄)` | 长整数型 | 高级 | `CefBinaryValue::Copy` | 复制受管二进制缓冲并返回独立句柄。 |
| 8 | `CEF3缓冲_是否有效` | `CEF3缓冲_是否有效(缓冲句柄)` | 整数型 | 高级 | `CefBinaryValue::IsValid` | 判断受管缓冲句柄是否有效。 |
| 9 | `CEF3缓冲_是否被拥有` | `CEF3缓冲_是否被拥有(缓冲句柄)` | 整数型 | 高级 | `CefBinaryValue::IsOwned` | Bridge缓冲始终独立拥有，合法句柄返回0。 |
| 10 | `CEF3缓冲_是否同一对象` | `CEF3缓冲_是否同一对象(缓冲句柄, 另一缓冲句柄)` | 整数型 | 高级 | `CefBinaryValue::IsSame` | 判断两个受管句柄是否引用同一缓冲。 |
| 11 | `CEF3缓冲_是否相等` | `CEF3缓冲_是否相等(缓冲句柄, 另一缓冲句柄)` | 整数型 | 高级 | `CefBinaryValue::IsEqual` | 逐字节比较两个受管缓冲。 |
| 12 | `CEF3缓冲_从文件` | `CEF3缓冲_从文件(路径)` | 长整数型 | 高级 | `LB_CEF3_BufferLoadFile` | 从允许文件根目录内读取文件并创建受管缓冲；越界路径返回0。 |
| 13 | `CEF3缓冲_取大小` | `CEF3缓冲_取大小(缓冲句柄)` | 长整数型 | 高级 | `LB_CEF3_BufferGetSize` | 返回受管缓冲字节数，无效或类型错误返回-1。 |
| 14 | `CEF3缓冲_到十六进制` | `CEF3缓冲_到十六进制(缓冲句柄)` | 文本型 | 高级 | `LB_CEF3_BufferToHex` | 把受管缓冲转换为小写十六进制文本。 |
| 15 | `CEF3缓冲_保存文件` | `CEF3缓冲_保存文件(缓冲句柄, 路径)` | 整数型 | 高级 | `LB_CEF3_BufferSaveFile` | 把受管缓冲写入允许文件根目录；拒绝目录穿越和任意路径写入。 |
| 16 | `CEF3缓冲_释放` | `CEF3缓冲_释放(缓冲句柄)` | 整数型 | 高级 | `LB_CEF3_BufferRelease` | 释放受管缓冲；重复释放返回稳定错误码。 |
| 17 | `CEF3值_创建` | `CEF3值_创建()` | 长整数型 | 高级 | `CefValue::Create` | 创建独立拥有的CEF值对象并返回类型化受管句柄。 |
| 18 | `CEF3值_复制` | `CEF3值_复制(值句柄)` | 长整数型 | 高级 | `CefValue::Copy` | 深复制CEF值并返回独立受管句柄。 |
| 19 | `CEF3值_是否有效` | `CEF3值_是否有效(值句柄)` | 整数型 | 高级 | `CefValue::IsValid` | 判断CEF值当前是否有效。 |
| 20 | `CEF3值_是否被拥有` | `CEF3值_是否被拥有(值句柄)` | 整数型 | 高级 | `CefValue::IsOwned` | 判断CEF值是否被其它CEF对象拥有。 |
| 21 | `CEF3值_是否只读` | `CEF3值_是否只读(值句柄)` | 整数型 | 高级 | `CefValue::IsReadOnly` | 判断CEF值是否只读。 |
| 22 | `CEF3值_是否同一对象` | `CEF3值_是否同一对象(值句柄, 另一值句柄)` | 整数型 | 高级 | `CefValue::IsSame` | 判断两个句柄是否引用同一CEF值对象。 |
| 23 | `CEF3值_是否相等` | `CEF3值_是否相等(值句柄, 另一值句柄)` | 整数型 | 高级 | `CefValue::IsEqual` | 深度比较两个CEF值的内容。 |
| 24 | `CEF3值_取类型` | `CEF3值_取类型(值句柄)` | 整数型 | 高级 | `CefValue::GetType` | 取得CEF值类型枚举。 |
| 25 | `CEF3值_设为空` | `CEF3值_设为空(值句柄)` | 整数型 | 高级 | `CefValue::SetNull` | 把CEF值设为空。 |
| 26 | `CEF3值_设逻辑` | `CEF3值_设逻辑(值句柄, 值)` | 整数型 | 高级 | `CefValue::SetBool` | 设置CEF逻辑值。 |
| 27 | `CEF3值_设整数` | `CEF3值_设整数(值句柄, 值)` | 整数型 | 高级 | `CefValue::SetInt` | 设置CEF整数值。 |
| 28 | `CEF3值_设小数` | `CEF3值_设小数(值句柄, 值)` | 整数型 | 高级 | `CefValue::SetDouble` | 设置CEF双精度值。 |
| 29 | `CEF3值_设文本` | `CEF3值_设文本(值句柄, 值)` | 整数型 | 高级 | `CefValue::SetString` | 设置UTF-16文本值。 |
| 30 | `CEF3值_设缓冲` | `CEF3值_设缓冲(值句柄, 缓冲句柄)` | 整数型 | 高级 | `CefValue::SetBinary` | 复制受管缓冲并设置为CEF二进制值。 |
| 31 | `CEF3值_设字典` | `CEF3值_设字典(值句柄, 字典句柄)` | 整数型 | 高级 | `CefValue::SetDictionary` | 深复制字典并设置为CEF字典值。 |
| 32 | `CEF3值_设列表` | `CEF3值_设列表(值句柄, 列表句柄)` | 整数型 | 高级 | `CefValue::SetList` | 深复制列表并设置为CEF列表值。 |
| 33 | `CEF3值_取逻辑` | `CEF3值_取逻辑(值句柄)` | 整数型 | 高级 | `CefValue::GetBool` | 取得CEF逻辑值，类型不匹配时返回稳定负错误码。 |
| 34 | `CEF3值_取整数` | `CEF3值_取整数(值句柄)` | 整数型 | 高级 | `CefValue::GetInt` | 取得CEF整数值。 |
| 35 | `CEF3值_取小数` | `CEF3值_取小数(值句柄)` | 双精度小数型 | 高级 | `CefValue::GetDouble` | 取得CEF双精度值。 |
| 36 | `CEF3值_取文本` | `CEF3值_取文本(值句柄)` | 文本型 | 高级 | `CefValue::GetString` | 取得CEF UTF-16文本值。 |
| 37 | `CEF3值_取缓冲` | `CEF3值_取缓冲(值句柄)` | 长整数型 | 高级 | `CefValue::GetBinary` | 复制CEF二进制值并返回独立受管缓冲句柄。 |
| 38 | `CEF3值_取字典` | `CEF3值_取字典(值句柄)` | 长整数型 | 高级 | `CefValue::GetDictionary` | 深复制CEF字典值并返回独立受管字典句柄。 |
| 39 | `CEF3值_取列表` | `CEF3值_取列表(值句柄)` | 长整数型 | 高级 | `CefValue::GetList` | 深复制CEF列表值并返回独立受管列表句柄。 |
| 40 | `CEF3值_到JSON` | `CEF3值_到JSON(值句柄)` | 文本型 | 高级 | `LB_CEF3_ValueToJson` | 把CEF值安全序列化为JSON。 |
| 41 | `CEF3值_释放` | `CEF3值_释放(值句柄)` | 整数型 | 高级 | `LB_CEF3_ValueRelease` | 释放CEF值受管句柄。 |
| 42 | `CEF3字典_创建` | `CEF3字典_创建()` | 长整数型 | 高级 | `CefDictionaryValue::Create` | 创建CEF字典受管句柄。 |
| 43 | `CEF3字典_复制` | `CEF3字典_复制(字典句柄, 排除空子项)` | 长整数型 | 高级 | `CefDictionaryValue::Copy` | 深复制CEF字典，可选择排除空子对象。 |
| 44 | `CEF3字典_是否有效` | `CEF3字典_是否有效(字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::IsValid` | 判断CEF字典当前是否有效。 |
| 45 | `CEF3字典_是否被拥有` | `CEF3字典_是否被拥有(字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::IsOwned` | 判断CEF字典是否被其它CEF对象拥有。 |
| 46 | `CEF3字典_是否只读` | `CEF3字典_是否只读(字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::IsReadOnly` | 判断CEF字典是否只读。 |
| 47 | `CEF3字典_是否同一对象` | `CEF3字典_是否同一对象(字典句柄, 另一字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::IsSame` | 判断两个句柄是否引用同一CEF字典。 |
| 48 | `CEF3字典_是否相等` | `CEF3字典_是否相等(字典句柄, 另一字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::IsEqual` | 深度比较两个CEF字典的内容。 |
| 49 | `CEF3字典_取数量` | `CEF3字典_取数量(字典句柄)` | 长整数型 | 高级 | `CefDictionaryValue::GetSize` | 取得字典键数量。 |
| 50 | `CEF3字典_是否存在` | `CEF3字典_是否存在(字典句柄, 键)` | 整数型 | 高级 | `CefDictionaryValue::HasKey` | 判断字典键是否存在。 |
| 51 | `CEF3字典_取键列表` | `CEF3字典_取键列表(字典句柄)` | 文本型 | 高级 | `CefDictionaryValue::GetKeys` | 以JSON数组返回全部字典键。 |
| 52 | `CEF3字典_取类型` | `CEF3字典_取类型(字典句柄, 键)` | 整数型 | 高级 | `CefDictionaryValue::GetType` | 取得指定键的CEF值类型。 |
| 53 | `CEF3字典_设值` | `CEF3字典_设值(字典句柄, 键, 值句柄)` | 整数型 | 高级 | `CefDictionaryValue::SetValue` | 深复制值并写入字典，避免跨所有权边界悬空。 |
| 54 | `CEF3字典_取值` | `CEF3字典_取值(字典句柄, 键)` | 长整数型 | 高级 | `CefDictionaryValue::GetValue` | 返回字典值的独立深复制受管句柄。 |
| 55 | `CEF3字典_删除` | `CEF3字典_删除(字典句柄, 键)` | 整数型 | 高级 | `CefDictionaryValue::Remove` | 删除指定字典键。 |
| 56 | `CEF3字典_清空` | `CEF3字典_清空(字典句柄)` | 整数型 | 高级 | `CefDictionaryValue::Clear` | 清空CEF字典。 |
| 57 | `CEF3字典_到JSON` | `CEF3字典_到JSON(字典句柄)` | 文本型 | 高级 | `LB_CEF3_DictionaryToJson` | 把CEF字典深复制并序列化为JSON。 |
| 58 | `CEF3字典_释放` | `CEF3字典_释放(字典句柄)` | 整数型 | 高级 | `LB_CEF3_DictionaryRelease` | 释放CEF字典受管句柄。 |
| 59 | `CEF3列表_创建` | `CEF3列表_创建()` | 长整数型 | 高级 | `CefListValue::Create` | 创建CEF列表受管句柄。 |
| 60 | `CEF3列表_复制` | `CEF3列表_复制(列表句柄)` | 长整数型 | 高级 | `CefListValue::Copy` | 深复制CEF列表并返回独立受管句柄。 |
| 61 | `CEF3列表_是否有效` | `CEF3列表_是否有效(列表句柄)` | 整数型 | 高级 | `CefListValue::IsValid` | 判断CEF列表当前是否有效。 |
| 62 | `CEF3列表_是否被拥有` | `CEF3列表_是否被拥有(列表句柄)` | 整数型 | 高级 | `CefListValue::IsOwned` | 判断CEF列表是否被其它CEF对象拥有。 |
| 63 | `CEF3列表_是否只读` | `CEF3列表_是否只读(列表句柄)` | 整数型 | 高级 | `CefListValue::IsReadOnly` | 判断CEF列表是否只读。 |
| 64 | `CEF3列表_是否同一对象` | `CEF3列表_是否同一对象(列表句柄, 另一列表句柄)` | 整数型 | 高级 | `CefListValue::IsSame` | 判断两个句柄是否引用同一CEF列表。 |
| 65 | `CEF3列表_是否相等` | `CEF3列表_是否相等(列表句柄, 另一列表句柄)` | 整数型 | 高级 | `CefListValue::IsEqual` | 深度比较两个CEF列表的内容。 |
| 66 | `CEF3列表_取数量` | `CEF3列表_取数量(列表句柄)` | 长整数型 | 高级 | `CefListValue::GetSize` | 取得列表元素数量。 |
| 67 | `CEF3列表_设数量` | `CEF3列表_设数量(列表句柄, 数量)` | 整数型 | 高级 | `CefListValue::SetSize` | 调整CEF列表大小。 |
| 68 | `CEF3列表_取类型` | `CEF3列表_取类型(列表句柄, 索引)` | 整数型 | 高级 | `CefListValue::GetType` | 取得指定索引的CEF值类型。 |
| 69 | `CEF3列表_设值` | `CEF3列表_设值(列表句柄, 索引, 值句柄)` | 整数型 | 高级 | `CefListValue::SetValue` | 深复制值并写入列表。 |
| 70 | `CEF3列表_取值` | `CEF3列表_取值(列表句柄, 索引)` | 长整数型 | 高级 | `CefListValue::GetValue` | 返回列表值的独立深复制受管句柄。 |
| 71 | `CEF3列表_删除` | `CEF3列表_删除(列表句柄, 索引)` | 整数型 | 高级 | `CefListValue::Remove` | 删除指定索引。 |
| 72 | `CEF3列表_清空` | `CEF3列表_清空(列表句柄)` | 整数型 | 高级 | `CefListValue::Clear` | 清空CEF列表。 |
| 73 | `CEF3列表_到JSON` | `CEF3列表_到JSON(列表句柄)` | 文本型 | 高级 | `LB_CEF3_ListToJson` | 把CEF列表深复制并序列化为JSON。 |
| 74 | `CEF3列表_释放` | `CEF3列表_释放(列表句柄)` | 整数型 | 高级 | `LB_CEF3_ListRelease` | 释放CEF列表受管句柄。 |
| 75 | `CEF3菜单_创建` | `CEF3菜单_创建()` | 长整数型 | 高级 | `CefMenuModel::CreateMenuModel` | 在CEF UI线程创建菜单模型并返回受管句柄。 |
| 76 | `CEF3菜单_是否子菜单` | `CEF3菜单_是否子菜单(菜单句柄)` | 整数型 | 高级 | `CefMenuModel::IsSubMenu` | 判断菜单是否为子菜单。 |
| 77 | `CEF3菜单_清空` | `CEF3菜单_清空(菜单句柄)` | 整数型 | 高级 | `CefMenuModel::Clear` | 清空菜单项目。 |
| 78 | `CEF3菜单_取数量` | `CEF3菜单_取数量(菜单句柄)` | 长整数型 | 高级 | `CefMenuModel::GetCount` | 取得菜单项目数量。 |
| 79 | `CEF3菜单_添加分隔线` | `CEF3菜单_添加分隔线(菜单句柄)` | 整数型 | 高级 | `CefMenuModel::AddSeparator` | 在菜单末尾添加分隔线。 |
| 80 | `CEF3菜单_添加项目` | `CEF3菜单_添加项目(菜单句柄, 命令ID, 标题)` | 整数型 | 高级 | `CefMenuModel::AddItem` | 添加普通菜单项目。 |
| 81 | `CEF3菜单_添加勾选项目` | `CEF3菜单_添加勾选项目(菜单句柄, 命令ID, 标题)` | 整数型 | 高级 | `CefMenuModel::AddCheckItem` | 添加勾选菜单项目。 |
| 82 | `CEF3菜单_添加单选项目` | `CEF3菜单_添加单选项目(菜单句柄, 命令ID, 标题, 组ID)` | 整数型 | 高级 | `CefMenuModel::AddRadioItem` | 添加单选菜单项目。 |
| 83 | `CEF3菜单_添加子菜单` | `CEF3菜单_添加子菜单(菜单句柄, 命令ID, 标题)` | 长整数型 | 高级 | `CefMenuModel::AddSubMenu` | 添加子菜单并返回独立受管句柄。 |
| 84 | `CEF3菜单_按索引插入分隔线` | `CEF3菜单_按索引插入分隔线(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::InsertSeparatorAt` | 在指定索引插入分隔线。 |
| 85 | `CEF3菜单_按索引插入项目` | `CEF3菜单_按索引插入项目(菜单句柄, 索引, 命令ID, 标题)` | 整数型 | 高级 | `CefMenuModel::InsertItemAt` | 在指定索引插入普通项目。 |
| 86 | `CEF3菜单_按索引插入勾选项目` | `CEF3菜单_按索引插入勾选项目(菜单句柄, 索引, 命令ID, 标题)` | 整数型 | 高级 | `CefMenuModel::InsertCheckItemAt` | 在指定索引插入勾选项目。 |
| 87 | `CEF3菜单_按索引插入单选项目` | `CEF3菜单_按索引插入单选项目(菜单句柄, 索引, 命令ID, 标题, 组ID)` | 整数型 | 高级 | `CefMenuModel::InsertRadioItemAt` | 在指定索引插入单选项目。 |
| 88 | `CEF3菜单_按索引插入子菜单` | `CEF3菜单_按索引插入子菜单(菜单句柄, 索引, 命令ID, 标题)` | 长整数型 | 高级 | `CefMenuModel::InsertSubMenuAt` | 在指定索引插入子菜单并返回受管句柄。 |
| 89 | `CEF3菜单_删除项目` | `CEF3菜单_删除项目(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::Remove` | 按命令ID删除菜单项目。 |
| 90 | `CEF3菜单_按索引删除` | `CEF3菜单_按索引删除(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::RemoveAt` | 按索引删除菜单项目。 |
| 91 | `CEF3菜单_取索引` | `CEF3菜单_取索引(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::GetIndexOf` | 取得命令ID对应索引。 |
| 92 | `CEF3菜单_按索引取命令ID` | `CEF3菜单_按索引取命令ID(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::GetCommandIdAt` | 取得指定索引的命令ID。 |
| 93 | `CEF3菜单_按索引设命令ID` | `CEF3菜单_按索引设命令ID(菜单句柄, 索引, 命令ID)` | 整数型 | 高级 | `CefMenuModel::SetCommandIdAt` | 修改指定索引的命令ID。 |
| 94 | `CEF3菜单_取标题` | `CEF3菜单_取标题(菜单句柄, 命令ID)` | 文本型 | 高级 | `CefMenuModel::GetLabel` | 按命令ID取得菜单标题。 |
| 95 | `CEF3菜单_按索引取标题` | `CEF3菜单_按索引取标题(菜单句柄, 索引)` | 文本型 | 高级 | `CefMenuModel::GetLabelAt` | 按索引取得菜单标题。 |
| 96 | `CEF3菜单_设标题` | `CEF3菜单_设标题(菜单句柄, 命令ID, 标题)` | 整数型 | 高级 | `CefMenuModel::SetLabel` | 按命令ID修改菜单标题。 |
| 97 | `CEF3菜单_按索引设标题` | `CEF3菜单_按索引设标题(菜单句柄, 索引, 标题)` | 整数型 | 高级 | `CefMenuModel::SetLabelAt` | 按索引修改菜单标题。 |
| 98 | `CEF3菜单_取类型` | `CEF3菜单_取类型(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::GetType` | 取得菜单项目类型枚举。 |
| 99 | `CEF3菜单_按索引取类型` | `CEF3菜单_按索引取类型(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::GetTypeAt` | 按索引取得菜单项目类型。 |
| 100 | `CEF3菜单_取组ID` | `CEF3菜单_取组ID(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::GetGroupId` | 取得单选项目组ID。 |
| 101 | `CEF3菜单_按索引取组ID` | `CEF3菜单_按索引取组ID(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::GetGroupIdAt` | 按索引取得单选项目组ID。 |
| 102 | `CEF3菜单_设组ID` | `CEF3菜单_设组ID(菜单句柄, 命令ID, 组ID)` | 整数型 | 高级 | `CefMenuModel::SetGroupId` | 修改单选项目组ID。 |
| 103 | `CEF3菜单_按索引设组ID` | `CEF3菜单_按索引设组ID(菜单句柄, 索引, 组ID)` | 整数型 | 高级 | `CefMenuModel::SetGroupIdAt` | 按索引修改单选项目组ID。 |
| 104 | `CEF3菜单_取子菜单` | `CEF3菜单_取子菜单(菜单句柄, 命令ID)` | 长整数型 | 高级 | `CefMenuModel::GetSubMenu` | 按命令ID取得子菜单受管句柄。 |
| 105 | `CEF3菜单_按索引取子菜单` | `CEF3菜单_按索引取子菜单(菜单句柄, 索引)` | 长整数型 | 高级 | `CefMenuModel::GetSubMenuAt` | 按索引取得子菜单受管句柄。 |
| 106 | `CEF3菜单_是否可见` | `CEF3菜单_是否可见(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::IsVisible` | 判断菜单项目是否可见。 |
| 107 | `CEF3菜单_按索引是否可见` | `CEF3菜单_按索引是否可见(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::IsVisibleAt` | 按索引判断菜单项目是否可见。 |
| 108 | `CEF3菜单_设置可见` | `CEF3菜单_设置可见(菜单句柄, 命令ID, 可见)` | 整数型 | 高级 | `CefMenuModel::SetVisible` | 设置菜单项目可见状态。 |
| 109 | `CEF3菜单_按索引设置可见` | `CEF3菜单_按索引设置可见(菜单句柄, 索引, 可见)` | 整数型 | 高级 | `CefMenuModel::SetVisibleAt` | 按索引设置菜单项目可见状态。 |
| 110 | `CEF3菜单_是否启用` | `CEF3菜单_是否启用(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::IsEnabled` | 判断菜单项目是否启用。 |
| 111 | `CEF3菜单_按索引是否启用` | `CEF3菜单_按索引是否启用(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::IsEnabledAt` | 按索引判断菜单项目是否启用。 |
| 112 | `CEF3菜单_设置启用` | `CEF3菜单_设置启用(菜单句柄, 命令ID, 启用)` | 整数型 | 高级 | `CefMenuModel::SetEnabled` | 设置菜单项目启用状态。 |
| 113 | `CEF3菜单_按索引设置启用` | `CEF3菜单_按索引设置启用(菜单句柄, 索引, 启用)` | 整数型 | 高级 | `CefMenuModel::SetEnabledAt` | 按索引设置菜单项目启用状态。 |
| 114 | `CEF3菜单_是否勾选` | `CEF3菜单_是否勾选(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::IsChecked` | 判断勾选或单选项目是否选中。 |
| 115 | `CEF3菜单_按索引是否勾选` | `CEF3菜单_按索引是否勾选(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::IsCheckedAt` | 按索引判断项目是否勾选。 |
| 116 | `CEF3菜单_设置勾选` | `CEF3菜单_设置勾选(菜单句柄, 命令ID, 勾选)` | 整数型 | 高级 | `CefMenuModel::SetChecked` | 设置勾选或单选项目状态。 |
| 117 | `CEF3菜单_按索引设置勾选` | `CEF3菜单_按索引设置勾选(菜单句柄, 索引, 勾选)` | 整数型 | 高级 | `CefMenuModel::SetCheckedAt` | 按索引设置项目勾选状态。 |
| 118 | `CEF3菜单_是否有快捷键` | `CEF3菜单_是否有快捷键(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::HasAccelerator` | 判断项目是否有键盘快捷键。 |
| 119 | `CEF3菜单_按索引是否有快捷键` | `CEF3菜单_按索引是否有快捷键(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::HasAcceleratorAt` | 按索引判断项目是否有键盘快捷键。 |
| 120 | `CEF3菜单_设置快捷键` | `CEF3菜单_设置快捷键(菜单句柄, 命令ID, 键码, Shift, Ctrl, Alt)` | 整数型 | 高级 | `CefMenuModel::SetAccelerator` | 设置项目键盘快捷键。 |
| 121 | `CEF3菜单_按索引设置快捷键` | `CEF3菜单_按索引设置快捷键(菜单句柄, 索引, 键码, Shift, Ctrl, Alt)` | 整数型 | 高级 | `CefMenuModel::SetAcceleratorAt` | 按索引设置项目键盘快捷键。 |
| 122 | `CEF3菜单_删除快捷键` | `CEF3菜单_删除快捷键(菜单句柄, 命令ID)` | 整数型 | 高级 | `CefMenuModel::RemoveAccelerator` | 删除项目键盘快捷键。 |
| 123 | `CEF3菜单_按索引删除快捷键` | `CEF3菜单_按索引删除快捷键(菜单句柄, 索引)` | 整数型 | 高级 | `CefMenuModel::RemoveAcceleratorAt` | 按索引删除项目键盘快捷键。 |
| 124 | `CEF3菜单_取快捷键JSON` | `CEF3菜单_取快捷键JSON(菜单句柄, 命令ID)` | 文本型 | 高级 | `CefMenuModel::GetAccelerator` | 以JSON返回键码及Shift/Ctrl/Alt状态。 |
| 125 | `CEF3菜单_按索引取快捷键JSON` | `CEF3菜单_按索引取快捷键JSON(菜单句柄, 索引)` | 文本型 | 高级 | `CefMenuModel::GetAcceleratorAt` | 按索引以JSON返回快捷键。 |
| 126 | `CEF3菜单_设置颜色` | `CEF3菜单_设置颜色(菜单句柄, 命令ID, 颜色类型, 颜色)` | 整数型 | 高级 | `CefMenuModel::SetColor` | 设置项目显式CEF颜色值。 |
| 127 | `CEF3菜单_按索引设置颜色` | `CEF3菜单_按索引设置颜色(菜单句柄, 索引, 颜色类型, 颜色)` | 整数型 | 高级 | `CefMenuModel::SetColorAt` | 按索引设置显式CEF颜色值；索引-1表示默认颜色。 |
| 128 | `CEF3菜单_取颜色` | `CEF3菜单_取颜色(菜单句柄, 命令ID, 颜色类型)` | 长整数型 | 高级 | `CefMenuModel::GetColor` | 取得项目显式CEF颜色值。 |
| 129 | `CEF3菜单_按索引取颜色` | `CEF3菜单_按索引取颜色(菜单句柄, 索引, 颜色类型)` | 长整数型 | 高级 | `CefMenuModel::GetColorAt` | 按索引取得显式CEF颜色值。 |
| 130 | `CEF3菜单_设置字体` | `CEF3菜单_设置字体(菜单句柄, 命令ID, 字体描述)` | 整数型 | 高级 | `CefMenuModel::SetFontList` | 设置项目CEF字体描述。 |
| 131 | `CEF3菜单_按索引设置字体` | `CEF3菜单_按索引设置字体(菜单句柄, 索引, 字体描述)` | 整数型 | 高级 | `CefMenuModel::SetFontListAt` | 按索引设置CEF字体描述；索引-1表示默认字体。 |
| 132 | `CEF3菜单_释放` | `CEF3菜单_释放(菜单句柄)` | 整数型 | 高级 | `LB_CEF3_MenuRelease` | 在CEF UI线程释放菜单受管句柄。 |
| 133 | `CEF3图像_创建` | `CEF3图像_创建()` | 长整数型 | 高级 | `CefImage::CreateImage` | 在CEF UI线程创建空图像并返回类型化受管句柄。 |
| 134 | `CEF3图像_是否为空` | `CEF3图像_是否为空(图像句柄)` | 整数型 | 高级 | `CefImage::IsEmpty` | 判断图像是否不含任何缩放表示。 |
| 135 | `CEF3图像_是否相同` | `CEF3图像_是否相同(图像句柄, 另一图像句柄)` | 整数型 | 高级 | `CefImage::IsSame` | 比较两个CEF图像对象。 |
| 136 | `CEF3图像_添加位图` | `CEF3图像_添加位图(图像句柄, 缩放, 像素宽度, 像素高度, 颜色类型, 透明类型, 像素缓冲)` | 整数型 | 高级 | `CefImage::AddBitmap` | 从受管BGRA/RGBA像素缓冲添加缩放表示，缓冲大小必须为宽×高×4。 |
| 137 | `CEF3图像_添加PNG` | `CEF3图像_添加PNG(图像句柄, 缩放, PNG缓冲)` | 整数型 | 高级 | `CefImage::AddPNG` | 从受管PNG缓冲添加缩放表示。 |
| 138 | `CEF3图像_添加JPEG` | `CEF3图像_添加JPEG(图像句柄, 缩放, JPEG缓冲)` | 整数型 | 高级 | `CefImage::AddJPEG` | 从受管JPEG缓冲添加缩放表示。 |
| 139 | `CEF3图像_取宽度` | `CEF3图像_取宽度(图像句柄)` | 长整数型 | 高级 | `CefImage::GetWidth` | 取得图像的设备无关宽度。 |
| 140 | `CEF3图像_取高度` | `CEF3图像_取高度(图像句柄)` | 长整数型 | 高级 | `CefImage::GetHeight` | 取得图像的设备无关高度。 |
| 141 | `CEF3图像_是否有表示` | `CEF3图像_是否有表示(图像句柄, 缩放)` | 整数型 | 高级 | `CefImage::HasRepresentation` | 判断指定缩放表示是否存在。 |
| 142 | `CEF3图像_删除表示` | `CEF3图像_删除表示(图像句柄, 缩放)` | 整数型 | 高级 | `CefImage::RemoveRepresentation` | 删除指定缩放表示。 |
| 143 | `CEF3图像_取表示信息` | `CEF3图像_取表示信息(图像句柄, 缩放)` | 文本型 | 高级 | `CefImage::GetRepresentationInfo` | 以JSON返回最接近缩放表示的实际缩放、像素宽度和高度。 |
| 144 | `CEF3图像_取位图缓冲` | `CEF3图像_取位图缓冲(图像句柄, 缩放, 颜色类型, 透明类型)` | 长整数型 | 高级 | `CefImage::GetAsBitmap` | 导出指定缩放表示为受管位图缓冲。 |
| 145 | `CEF3图像_取PNG缓冲` | `CEF3图像_取PNG缓冲(图像句柄, 缩放, 保留透明)` | 长整数型 | 高级 | `CefImage::GetAsPNG` | 导出指定缩放表示为受管PNG缓冲。 |
| 146 | `CEF3图像_取JPEG缓冲` | `CEF3图像_取JPEG缓冲(图像句柄, 缩放, 质量)` | 长整数型 | 高级 | `CefImage::GetAsJPEG` | 导出指定缩放表示为受管JPEG缓冲，质量范围0到100。 |
| 147 | `CEF3图像_释放` | `CEF3图像_释放(图像句柄)` | 整数型 | 高级 | `LB_CEF3_ImageRelease` | 在CEF UI线程释放图像对象受管句柄。 |
| 148 | `CEF3导航项_取当前可见` | `CEF3导航项_取当前可见(控件名)` | 长整数型 | 高级 | `CefBrowserHost::GetVisibleNavigationEntry` | 在CEF UI线程快照当前可见导航项并返回类型化受管句柄。 |
| 149 | `CEF3导航项_读取历史` | `CEF3导航项_读取历史(控件名, 仅当前项)` | 长整数型 | 高级 | `CefBrowserHost::GetNavigationEntries` | 异步读取导航历史并返回结果为JSON数组的任务ID。 |
| 150 | `CEF3导航项_是否有效` | `CEF3导航项_是否有效(导航项句柄)` | 整数型 | 高级 | `CefNavigationEntry::IsValid` | 判断导航项快照是否有效。 |
| 151 | `CEF3导航项_取地址` | `CEF3导航项_取地址(导航项句柄)` | 文本型 | 高级 | `CefNavigationEntry::GetURL` | 取得导航项实际URL。 |
| 152 | `CEF3导航项_取显示地址` | `CEF3导航项_取显示地址(导航项句柄)` | 文本型 | 高级 | `CefNavigationEntry::GetDisplayURL` | 取得适合显示的URL。 |
| 153 | `CEF3导航项_取原始地址` | `CEF3导航项_取原始地址(导航项句柄)` | 文本型 | 高级 | `CefNavigationEntry::GetOriginalURL` | 取得重定向前的原始URL。 |
| 154 | `CEF3导航项_取标题` | `CEF3导航项_取标题(导航项句柄)` | 文本型 | 高级 | `CefNavigationEntry::GetTitle` | 取得导航项页面标题。 |
| 155 | `CEF3导航项_取跳转类型` | `CEF3导航项_取跳转类型(导航项句柄)` | 整数型 | 高级 | `CefNavigationEntry::GetTransitionType` | 取得导航跳转类型枚举。 |
| 156 | `CEF3导航项_是否含提交数据` | `CEF3导航项_是否含提交数据(导航项句柄)` | 整数型 | 高级 | `CefNavigationEntry::HasPostData` | 判断本次导航是否包含POST数据。 |
| 157 | `CEF3导航项_取完成时间` | `CEF3导航项_取完成时间(导航项句柄)` | 双精度小数型 | 高级 | `CefNavigationEntry::GetCompletionTime` | 取得最后成功完成导航的Unix秒时间，未完成时为0。 |
| 158 | `CEF3导航项_取HTTP状态码` | `CEF3导航项_取HTTP状态码(导航项句柄)` | 整数型 | 高级 | `CefNavigationEntry::GetHttpStatusCode` | 取得最后成功导航响应的HTTP状态码。 |
| 159 | `CEF3导航项_释放` | `CEF3导航项_释放(导航项句柄)` | 整数型 | 高级 | `LB_CEF3_NavigationEntryRelease` | 释放导航项快照受管句柄。 |
| 160 | `CEF3证书_取当前` | `CEF3证书_取当前(控件名)` | 长整数型 | 高级 | `CefSSLStatus::GetX509Certificate` | 在CEF UI线程读取当前可见导航项的TLS证书并返回不可变受管快照。 |
| 161 | `CEF3证书_是否安全连接` | `CEF3证书_是否安全连接(证书句柄)` | 整数型 | 高级 | `CefSSLStatus::IsSecureConnection` | 判断证书快照对应导航是否为安全TLS连接。 |
| 162 | `CEF3证书_取证书状态` | `CEF3证书_取证书状态(证书句柄)` | 长整数型 | 高级 | `CefSSLStatus::GetCertStatus` | 取得证书验证问题位掩码。 |
| 163 | `CEF3证书_取SSL版本` | `CEF3证书_取SSL版本(证书句柄)` | 整数型 | 高级 | `CefSSLStatus::GetSSLVersion` | 取得TLS连接版本枚举。 |
| 164 | `CEF3证书_取内容状态` | `CEF3证书_取内容状态(证书句柄)` | 长整数型 | 高级 | `CefSSLStatus::GetContentStatus` | 取得页面安全内容状态位掩码。 |
| 165 | `CEF3证书_取主体` | `CEF3证书_取主体(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetSubject` | 取得证书主体受管快照句柄。 |
| 166 | `CEF3证书_取颁发者` | `CEF3证书_取颁发者(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetIssuer` | 取得证书颁发者受管快照句柄。 |
| 167 | `CEF3证书_取序列号缓冲` | `CEF3证书_取序列号缓冲(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetSerialNumber` | 复制证书DER序列号并返回受管缓冲。 |
| 168 | `CEF3证书_取DER缓冲` | `CEF3证书_取DER缓冲(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetDEREncoded` | 复制DER编码证书并返回受管缓冲。 |
| 169 | `CEF3证书_取PEM缓冲` | `CEF3证书_取PEM缓冲(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetPEMEncoded` | 复制PEM编码证书并返回受管缓冲。 |
| 170 | `CEF3证书_取生效时间` | `CEF3证书_取生效时间(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetValidStart` | 取得证书生效Unix秒时间。 |
| 171 | `CEF3证书_取失效时间` | `CEF3证书_取失效时间(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetValidExpiry` | 取得证书失效Unix秒时间。 |
| 172 | `CEF3证书_取颁发链数量` | `CEF3证书_取颁发链数量(证书句柄)` | 长整数型 | 高级 | `CefX509Certificate::GetIssuerChainSize` | 取得证书颁发链项目数量。 |
| 173 | `CEF3证书_取DER颁发链项` | `CEF3证书_取DER颁发链项(证书句柄, 索引)` | 长整数型 | 高级 | `CefX509Certificate::GetDEREncodedIssuerChain` | 复制指定DER颁发链项并返回受管缓冲。 |
| 174 | `CEF3证书_取PEM颁发链项` | `CEF3证书_取PEM颁发链项(证书句柄, 索引)` | 长整数型 | 高级 | `CefX509Certificate::GetPEMEncodedIssuerChain` | 复制指定PEM颁发链项并返回受管缓冲。 |
| 175 | `CEF3证书_释放` | `CEF3证书_释放(证书句柄)` | 整数型 | 高级 | `LB_CEF3_CertificateRelease` | 释放证书受管快照。 |
| 176 | `CEF3证书主体_取显示名` | `CEF3证书主体_取显示名(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetDisplayName` | 取得证书主体显示名。 |
| 177 | `CEF3证书主体_取通用名` | `CEF3证书主体_取通用名(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetCommonName` | 取得证书主体通用名。 |
| 178 | `CEF3证书主体_取地区名` | `CEF3证书主体_取地区名(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetLocalityName` | 取得证书主体地区名。 |
| 179 | `CEF3证书主体_取省州名` | `CEF3证书主体_取省州名(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetStateOrProvinceName` | 取得证书主体省或州名。 |
| 180 | `CEF3证书主体_取国家名` | `CEF3证书主体_取国家名(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetCountryName` | 取得证书主体国家名。 |
| 181 | `CEF3证书主体_取组织JSON` | `CEF3证书主体_取组织JSON(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetOrganizationNames` | 取得组织名称UTF-16 JSON数组。 |
| 182 | `CEF3证书主体_取组织单位JSON` | `CEF3证书主体_取组织单位JSON(主体句柄)` | 文本型 | 高级 | `CefX509CertPrincipal::GetOrganizationUnitNames` | 取得组织单位名称UTF-16 JSON数组。 |
| 183 | `CEF3证书主体_释放` | `CEF3证书主体_释放(主体句柄)` | 整数型 | 高级 | `LB_CEF3_CertificatePrincipalRelease` | 释放证书主体受管快照。 |

### 4. CEF3会话模块

提供每实例RequestContext、缓存和Cookie隔离会话能力。 模块 ID：`lingbuilder.cef3.session`；本节共 19 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3会话_取缓存目录` | `CEF3会话_取缓存目录(控件名)` | 文本型 | 常用 | `LB_CEF3_GetProfilePath` | 取得实例实际使用的独立缓存目录。 |
| 2 | `CEF3会话_取代理` | `CEF3会话_取代理(控件名)` | 文本型 | 常用 | `LB_CEF3_GetProxy` | 取得实例创建时应用的代理地址。 |
| 3 | `CEF3会话_取上下文` | `CEF3会话_取上下文(控件名)` | 长整数型 | 高级 | `CefBrowserHost::GetRequestContext` | 取得浏览器独立RequestContext的类型化受管句柄。 |
| 4 | `CEF3会话_上下文取缓存目录` | `CEF3会话_上下文取缓存目录(上下文句柄)` | 文本型 | 高级 | `CefRequestContext::GetCachePath` | 从RequestContext读取实际缓存目录。 |
| 5 | `CEF3会话_是否有首选项` | `CEF3会话_是否有首选项(上下文句柄, 名称)` | 整数型 | 高级 | `CefPreferenceManager::HasPreference` | 在CEF UI线程判断当前隔离会话是否存在指定Preference。 |
| 6 | `CEF3会话_首选项是否可写` | `CEF3会话_首选项是否可写(上下文句柄, 名称)` | 整数型 | 高级 | `CefPreferenceManager::CanSetPreference` | 判断指定Preference能否在运行时修改。 |
| 7 | `CEF3会话_取首选项` | `CEF3会话_取首选项(上下文句柄, 名称)` | 长整数型 | 高级 | `CefPreferenceManager::GetPreference` | 读取Preference副本并返回CEF值受管句柄。 |
| 8 | `CEF3会话_取全部首选项` | `CEF3会话_取全部首选项(上下文句柄, 包含默认值)` | 长整数型 | 高级 | `CefPreferenceManager::GetAllPreferences` | 读取全部Preference副本并返回CEF字典受管句柄。 |
| 9 | `CEF3会话_设置首选项` | `CEF3会话_设置首选项(上下文句柄, 名称, 值句柄)` | 整数型 | 高级 | `CefPreferenceManager::SetPreference` | 设置隔离会话Preference；值句柄为0时恢复默认。 |
| 10 | `CEF3会话_清理HTTP缓存` | `CEF3会话_清理HTTP缓存(上下文句柄)` | 长整数型 | 高级 | `CefRequestContext::ClearHttpCache` | 异步清理当前隔离会话的HTTP缓存并返回任务ID。 |
| 11 | `CEF3会话_清理证书例外` | `CEF3会话_清理证书例外(上下文句柄)` | 长整数型 | 高级 | `CefRequestContext::ClearCertificateExceptions` | 异步清理当前隔离会话的证书例外并返回任务ID。 |
| 12 | `CEF3会话_清理HTTP认证` | `CEF3会话_清理HTTP认证(上下文句柄)` | 长整数型 | 高级 | `CefRequestContext::ClearHttpAuthCredentials` | 异步清理当前隔离会话保存的HTTP认证凭据。 |
| 13 | `CEF3会话_关闭全部连接` | `CEF3会话_关闭全部连接(上下文句柄)` | 长整数型 | 高级 | `CefRequestContext::CloseAllConnections` | 异步关闭当前隔离会话的活动与空闲连接。 |
| 14 | `CEF3会话_Cookie读取全部` | `CEF3会话_Cookie读取全部(上下文句柄)` | 长整数型 | 高级 | `CefCookieManager::VisitAllCookies` | 异步读取当前隔离会话全部Cookie，任务结果为UTF-16 JSON数组。 |
| 15 | `CEF3会话_Cookie按地址读取` | `CEF3会话_Cookie按地址读取(上下文句柄, 地址, 包含HttpOnly)` | 长整数型 | 高级 | `CefCookieManager::VisitUrlCookies` | 异步读取指定地址Cookie。 |
| 16 | `CEF3会话_Cookie设置` | `CEF3会话_Cookie设置(上下文句柄, 地址, 名称, 值, 域, 路径, 安全, HttpOnly, 过期Unix秒)` | 长整数型 | 高级 | `CefCookieManager::SetCookie` | 异步写入Cookie；过期时间小于等于0时创建会话Cookie。 |
| 17 | `CEF3会话_Cookie删除` | `CEF3会话_Cookie删除(上下文句柄, 地址, 名称)` | 长整数型 | 高级 | `CefCookieManager::DeleteCookies` | 异步删除匹配Cookie，任务结果包含删除数量。 |
| 18 | `CEF3会话_Cookie落盘` | `CEF3会话_Cookie落盘(上下文句柄)` | 长整数型 | 高级 | `CefCookieManager::FlushStore` | 异步把当前会话Cookie写入独立存储。 |
| 19 | `CEF3会话_释放上下文` | `CEF3会话_释放上下文(上下文句柄)` | 整数型 | 高级 | `LB_CEF3_RequestContextRelease` | 释放RequestContext受管句柄。 |

### 5. CEF3网络模块

提供实例级代理及后续请求/响应扩展入口。 模块 ID：`lingbuilder.cef3.network`；本节共 2 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3网络_设置代理` | `CEF3网络_设置代理(控件名, 代理地址)` | 整数型 | 高级 | `LB_CEF3_SetProxy` | 在浏览器创建前设置实例RequestContext代理；空文本表示直连。 |
| 2 | `CEF3网络_证书状态是否错误` | `CEF3网络_证书状态是否错误(证书状态)` | 整数型 | 高级 | `cef_is_cert_status_error` | 判断CEF证书状态位掩码是否包含错误；0表示CERT_STATUS_NONE。 |

### 6. CEF3传输模块

提供下载、打印、受管二进制流和读写处理器能力。 模块 ID：`lingbuilder.cef3.transfer`；本节共 34 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3传输_开始下载` | `CEF3传输_开始下载(控件名, 地址)` | 整数型 | 常用 | `CefBrowserHost::StartDownload` | 使用当前实例会话开始下载。 |
| 2 | `CEF3传输_打印` | `CEF3传输_打印(控件名)` | 整数型 | 常用 | `CefBrowserHost::Print` | 打开当前页面的原生打印流程。 |
| 3 | `CEF3传输_从缓冲创建读取流` | `CEF3传输_从缓冲创建读取流(缓冲句柄)` | CEF3读取流句柄 | 高级 | `CefStreamReader::CreateForData` | 从Bridge受管缓冲创建可跨线程使用的CEF读取流。读取流会保留源缓冲，即使源缓冲句柄已释放也能继续读取。 |
| 4 | `CEF3传输_从文件创建读取流` | `CEF3传输_从文件创建读取流(路径)` | CEF3读取流句柄 | 高级 | `CefStreamReader::CreateForFile` | 在当前项目允许的文件根目录内打开文件并创建受管CEF读取流；越界、空路径或无法打开的文件返回0。 |
| 5 | `CEF3传输_从缓冲创建读取处理器` | `CEF3传输_从缓冲创建读取处理器(缓冲句柄, 可能阻塞)` | CEF3读取处理器句柄 | 高级 | `CefReadHandler` | 从受管缓冲创建可供CEF异步读取的线程安全读取处理器；处理器保留源缓冲，可能阻塞仅作为CEF线程调度提示。 |
| 6 | `CEF3传输_读取处理器读取` | `CEF3传输_读取处理器读取(读取处理器句柄, 最大字节数)` | 长整数型 | 高级 | `CefReadHandler::Read` | 从读取处理器读取至多64MiB并返回新的受管缓冲句柄；通过CEF3缓冲_释放释放结果。 |
| 7 | `CEF3传输_定位读取处理器` | `CEF3传输_定位读取处理器(读取处理器句柄, 偏移量, 基准)` | 整数型 | 高级 | `CefReadHandler::Seek` | 按官方Seek语义定位读取处理器：基准0为开头、1为当前位置、2为结尾；无法定位返回负错误码。 |
| 8 | `CEF3传输_取读取处理器位置` | `CEF3传输_取读取处理器位置(读取处理器句柄)` | 长整数型 | 高级 | `CefReadHandler::Tell` | 返回读取处理器当前字节偏移。 |
| 9 | `CEF3传输_读取处理器是否结束` | `CEF3传输_读取处理器是否结束(读取处理器句柄)` | 整数型 | 高级 | `CefReadHandler::Eof` | 返回读取处理器是否已到达受管缓冲结尾。 |
| 10 | `CEF3传输_读取处理器是否可能阻塞` | `CEF3传输_读取处理器是否可能阻塞(读取处理器句柄)` | 整数型 | 高级 | `CefReadHandler::MayBlock` | 返回创建读取处理器时声明的可能阻塞提示。 |
| 11 | `CEF3传输_从读取处理器创建流` | `CEF3传输_从读取处理器创建流(读取处理器句柄)` | CEF3读取流句柄 | 高级 | `CefStreamReader::CreateForHandler` | 将受管读取处理器接入真实CefStreamReader；流与处理器共享位置，并在任一端释放后由CEF引用计数保持安全生命周期。 |
| 12 | `CEF3传输_释放读取处理器` | `CEF3传输_释放读取处理器(读取处理器句柄)` | 整数型 | 高级 | `CefReadHandler::Release` | 释放受管读取处理器句柄；已创建的读取流会继续保持CEF对处理器的引用。 |
| 13 | `CEF3传输_从文件创建写入流` | `CEF3传输_从文件创建写入流(路径)` | CEF3写入流句柄 | 高级 | `CefStreamWriter::CreateForFile` | 在当前项目允许的文件根目录内创建或截断文件并返回受管CEF写入流；越界、空路径或无法创建的文件返回0。 |
| 14 | `CEF3传输_创建写入处理器` | `CEF3传输_创建写入处理器(可能阻塞)` | CEF3写入处理器句柄 | 高级 | `CefWriteHandler` | 创建线程安全的内存写入处理器；总容量限制为64MiB，可能阻塞仅作为CEF线程调度提示。 |
| 15 | `CEF3传输_写入处理器写入` | `CEF3传输_写入处理器写入(写入处理器句柄, 缓冲句柄, 起始偏移, 写入字节数)` | 长整数型 | 高级 | `CefWriteHandler::Write` | 从受管缓冲的指定范围写入内存处理器；单次和总容量均不超过64MiB，返回实际写入字节数。 |
| 16 | `CEF3传输_定位写入处理器` | `CEF3传输_定位写入处理器(写入处理器句柄, 偏移量, 基准)` | 整数型 | 高级 | `CefWriteHandler::Seek` | 按官方Seek语义定位写入处理器：基准0为开头、1为当前位置、2为当前内存结尾；越界返回负错误码。 |
| 17 | `CEF3传输_取写入处理器位置` | `CEF3传输_取写入处理器位置(写入处理器句柄)` | 长整数型 | 高级 | `CefWriteHandler::Tell` | 返回写入处理器当前字节偏移。 |
| 18 | `CEF3传输_刷新写入处理器` | `CEF3传输_刷新写入处理器(写入处理器句柄)` | 整数型 | 高级 | `CefWriteHandler::Flush` | 刷新写入处理器；内存处理器不落盘，成功返回0。 |
| 19 | `CEF3传输_写入处理器是否可能阻塞` | `CEF3传输_写入处理器是否可能阻塞(写入处理器句柄)` | 整数型 | 高级 | `CefWriteHandler::MayBlock` | 返回创建写入处理器时声明的可能阻塞提示。 |
| 20 | `CEF3传输_取写入处理器缓冲` | `CEF3传输_取写入处理器缓冲(写入处理器句柄)` | 长整数型 | 高级 | `CefWriteHandler::Snapshot` | 复制写入处理器当前内存内容为新的受管缓冲句柄；通过CEF3缓冲_释放释放结果。 |
| 21 | `CEF3传输_从写入处理器创建流` | `CEF3传输_从写入处理器创建流(写入处理器句柄)` | CEF3写入流句柄 | 高级 | `CefStreamWriter::CreateForHandler` | 将受管写入处理器接入真实CefStreamWriter；流与处理器共享位置，适合供CEF回调写入受管内存。 |
| 22 | `CEF3传输_释放写入处理器` | `CEF3传输_释放写入处理器(写入处理器句柄)` | 整数型 | 高级 | `CefWriteHandler::Release` | 释放受管写入处理器句柄；已创建的写入流会继续保持CEF对处理器的引用。 |
| 23 | `CEF3传输_写入流` | `CEF3传输_写入流(写入流句柄, 缓冲句柄, 起始偏移, 写入字节数)` | 长整数型 | 高级 | `CefStreamWriter::Write` | 从受管缓冲的指定范围写入至多64MiB，返回实际写入字节数；越界或句柄错误返回负错误码。 |
| 24 | `CEF3传输_定位写入流` | `CEF3传输_定位写入流(写入流句柄, 偏移量, 基准)` | 整数型 | 高级 | `CefStreamWriter::Seek` | 按官方Seek语义定位写入流：基准0为开头、1为当前位置、2为结尾；返回0表示成功。 |
| 25 | `CEF3传输_取写入流位置` | `CEF3传输_取写入流位置(写入流句柄)` | 长整数型 | 高级 | `CefStreamWriter::Tell` | 返回写入流当前字节偏移。 |
| 26 | `CEF3传输_刷新写入流` | `CEF3传输_刷新写入流(写入流句柄)` | 整数型 | 高级 | `CefStreamWriter::Flush` | 将写入流的待写数据刷新到文件；返回0表示成功。 |
| 27 | `CEF3传输_写入流是否可能阻塞` | `CEF3传输_写入流是否可能阻塞(写入流句柄)` | 整数型 | 高级 | `CefStreamWriter::MayBlock` | 返回CEF对当前写入流可能执行阻塞文件操作的提示；文件写入流通常返回真。 |
| 28 | `CEF3传输_释放写入流` | `CEF3传输_释放写入流(写入流句柄)` | 整数型 | 高级 | `CefStreamWriter::Release` | 释放受管写入流句柄；释放前应先刷新写入流，重复释放返回稳定错误码。 |
| 29 | `CEF3传输_读取流` | `CEF3传输_读取流(读取流句柄, 最大字节数)` | 长整数型 | 高级 | `CefStreamReader::Read` | 读取至多64MiB数据并返回新的受管缓冲句柄；返回的缓冲需通过CEF3缓冲_释放释放。 |
| 30 | `CEF3传输_定位读取流` | `CEF3传输_定位读取流(读取流句柄, 偏移量, 基准)` | 整数型 | 高级 | `CefStreamReader::Seek` | 按官方Seek语义定位读取流：基准0为开头、1为当前位置、2为结尾；返回0表示成功。 |
| 31 | `CEF3传输_取读取流位置` | `CEF3传输_取读取流位置(读取流句柄)` | 长整数型 | 高级 | `CefStreamReader::Tell` | 返回读取流当前字节偏移。 |
| 32 | `CEF3传输_读取流是否结束` | `CEF3传输_读取流是否结束(读取流句柄)` | 整数型 | 高级 | `CefStreamReader::Eof` | 返回当前读取位置是否已到流末尾。 |
| 33 | `CEF3传输_读取流是否可能阻塞` | `CEF3传输_读取流是否可能阻塞(读取流句柄)` | 整数型 | 高级 | `CefStreamReader::MayBlock` | 返回CEF对当前读取流可能执行阻塞文件操作的提示；内存缓冲读取流通常返回假。 |
| 34 | `CEF3传输_释放读取流` | `CEF3传输_释放读取流(读取流句柄)` | 整数型 | 高级 | `CefStreamReader::Release` | 释放受管读取流句柄和其保留的源缓冲引用；重复释放返回稳定错误码。 |

### 7. CEF3自动化模块

提供异步JavaScript任务及后续DOM/V8能力。 模块 ID：`lingbuilder.cef3.automation`；本节共 6 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3自动化_执行JS异步` | `CEF3自动化_执行JS异步(控件名, 脚本)` | 长整数型 | 高级 | `Runtime.evaluate` | 通过DevTools Runtime.evaluate异步执行JavaScript，返回受管任务ID。 |
| 2 | `CEF3Hook_注册脚本` | `CEF3Hook_注册脚本(控件名, 名称, 脚本, 地址匹配, 全部框架, 立即执行当前上下文)` | 长整数型 | 高级 | `CefRenderProcessHandler::OnContextCreated` | 注册持久JSHook；它会在匹配Frame的V8上下文创建时执行，并在导航后自动重建。 |
| 3 | `CEF3Hook_移除脚本` | `CEF3Hook_移除脚本(Hook句柄)` | 整数型 | 高级 | `LB_CEF3_JsHookRemove` | 移除指定JSHook并释放受管句柄。 |
| 4 | `CEF3Hook_清空脚本` | `CEF3Hook_清空脚本(控件名)` | 整数型 | 高级 | `LB_CEF3_JsHookClear` | 清空指定浏览器的全部已注册JSHook。 |
| 5 | `CEF3Hook_取脚本列表` | `CEF3Hook_取脚本列表(控件名)` | 文本型 | 高级 | `LB_CEF3_JsHookList` | 返回JSHook句柄、名称、地址匹配和Frame范围JSON。 |
| 6 | `CEF3Hook_回复页面消息` | `CEF3Hook_回复页面消息(控件名, 请求ID, 是否成功, 返回文本)` | 整数型 | 高级 | `LB_CEF3_JsHookReply` | 回复页面 LingBuilder调用宿主(name, payload) 产生的Promise请求。 |

### 8. CEF3开发者工具模块

提供受设计器策略控制的DevTools入口。 模块 ID：`lingbuilder.cef3.devtools`；本节共 8 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3开发工具_打开` | `CEF3开发工具_打开(控件名)` | 整数型 | 常用 | `CefBrowserHost::ShowDevTools` | 打开指定实例的开发者工具；设计器禁止开发者工具时返回0。 |
| 2 | `CEF3开发工具_关闭` | `CEF3开发工具_关闭(控件名)` | 整数型 | 常用 | `CefBrowserHost::CloseDevTools` | 关闭指定实例的开发者工具。 |
| 3 | `CEF3开发工具_是否打开` | `CEF3开发工具_是否打开(控件名)` | 整数型 | 常用 | `CefBrowserHost::HasDevTools` | 返回指定实例是否已打开开发者工具。 |
| 4 | `CEF3开发工具_执行协议方法` | `CEF3开发工具_执行协议方法(控件名, 方法名, 参数JSON)` | 长整数型 | 高级 | `CefBrowserHost::ExecuteDevToolsMethod` | 执行 DevTools Protocol 方法并返回受管任务句柄；参数必须是 JSON 对象，结果使用 CEF3任务_取结果读取。 |
| 5 | `CEF3开发工具_订阅代理附加` | `CEF3开发工具_订阅代理附加(控件名, 启用)` | 整数型 | 高级 | `CefDevToolsMessageObserver::OnDevToolsAgentAttached` | 启用后将 DevTools 代理附加通知投递为“开发工具代理已附加”浏览器事件。 |
| 6 | `CEF3开发工具_订阅代理分离` | `CEF3开发工具_订阅代理分离(控件名, 启用)` | 整数型 | 高级 | `CefDevToolsMessageObserver::OnDevToolsAgentDetached` | 启用后将 DevTools 代理分离通知投递为“开发工具代理已分离”浏览器事件。 |
| 7 | `CEF3开发工具_订阅协议事件` | `CEF3开发工具_订阅协议事件(控件名, 启用)` | 整数型 | 高级 | `CefDevToolsMessageObserver::OnDevToolsEvent` | 启用后将 DevTools Protocol 事件投递为“开发工具协议事件”；参数 JSON 会复制到 paramsJson 字段。 |
| 8 | `CEF3开发工具_订阅协议消息` | `CEF3开发工具_订阅协议消息(控件名, 启用)` | 整数型 | 高级 | `CefDevToolsMessageObserver::OnDevToolsMessage` | 启用后将原始 DevTools Protocol 消息投递为“开发工具协议消息”；观察器始终返回未处理，不会拦截 CEF 后续回调。 |

### 9. CEF3视图模块

提供Chrome Runtime独立窗口入口。 模块 ID：`lingbuilder.cef3.views`；本节共 1 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3视图_打开Chrome窗口` | `CEF3视图_打开Chrome窗口(控件名, 地址)` | 整数型 | 常用 | `CefBrowserHost::CreateBrowser` | 使用实例会话创建Chrome Runtime独立顶层窗口。 |

### 10. CEF3平台工具模块

提供CEF版本与平台工具能力。 模块 ID：`lingbuilder.cef3.platform`；本节共 72 条用户接口。

| # | 接口 | 调用签名 | 返回值 | 级别 | 官方别名 | 说明 |
|---:|---|---|---|---|---|---|
| 1 | `CEF3平台_执行任务` | `CEF3平台_执行任务(任务句柄)` | 整数型 | 高级 | `CefTask::Execute` | 执行受管任务回调并将任务标记为成功；CEF任务运行器内部也通过同一回调完成任务。 |
| 2 | `CEF3平台_任务运行器延迟投递` | `CEF3平台_任务运行器延迟投递(任务运行器句柄, 任务句柄, 延迟毫秒数)` | 整数型 | 高级 | `CefTaskRunner::PostDelayedTask` | 向指定CEF任务运行器投递受管任务；任务在目标线程延迟执行，返回值表示是否成功受理。 |
| 3 | `CEF3平台_任务运行器投递` | `CEF3平台_任务运行器投递(任务运行器句柄, 任务句柄)` | 整数型 | 高级 | `CefTaskRunner::PostTask` | 向指定CEF任务运行器立即异步投递受管任务；任务在目标线程执行，返回值表示是否成功受理。 |
| 4 | `CEF3平台_全局任务投递` | `CEF3平台_全局任务投递(CEF线程ID, 任务句柄)` | 整数型 | 高级 | `cef_post_task` | 向指定公开CEF线程立即异步投递受管任务；任务在目标线程执行，返回值表示是否成功受理。 |
| 5 | `CEF3平台_全局延迟任务投递` | `CEF3平台_全局延迟任务投递(CEF线程ID, 任务句柄, 延迟毫秒数)` | 整数型 | 高级 | `cef_post_delayed_task` | 向指定公开CEF线程投递受管任务；任务在目标线程延迟执行，返回值表示是否成功受理。 |
| 6 | `CEF3平台_取版本` | `CEF3平台_取版本()` | 文本型 | 常用 | `cef_version_info` | 返回编译时CEF与Chromium版本。 |
| 7 | `CEF3平台_取退出代码` | `CEF3平台_取退出代码()` | 整数型 | 高级 | `cef_get_exit_code` | 返回CEF最近一次子进程或进程入口处理使用的退出代码；正常浏览器进程通常为0。 |
| 8 | `CEF3平台_是否从右到左` | `CEF3平台_是否从右到左()` | 整数型 | 高级 | `cef_is_rtl` | 判断当前CEF应用文本方向是否为从右到左；结果来自CEF当前区域设置。 |
| 9 | `CEF3平台_取系统跟踪时间` | `CEF3平台_取系统跟踪时间()` | 长整数型 | 高级 | `cef_now_from_system_trace_time` | 返回CEF系统跟踪时钟值，用于与Trace事件时间戳进行同步比较。 |
| 10 | `CEF3平台_开始跟踪` | `CEF3平台_开始跟踪(类别)` | 长整数型 | 高级 | `cef_begin_tracing` | 在CEF UI线程异步启动指定类别的性能跟踪并返回受管任务句柄；任务成功结果为 {"started":true}。同一时刻只能存在一个跟踪会话。 |
| 11 | `CEF3平台_结束跟踪` | `CEF3平台_结束跟踪(输出文件)` | 长整数型 | 高级 | `cef_end_tracing` | 在CEF UI线程异步结束当前性能跟踪并返回受管任务句柄；空文本由CEF创建临时跟踪文件，任务成功结果为 {"tracingFile":"..."}，调用方负责删除该文件。 |
| 12 | `CEF3平台_取MIME扩展名` | `CEF3平台_取MIME扩展名(MIME类型)` | 文本型 | 高级 | `CefGetExtensionsForMimeType` | 以JSON数组返回指定小写MIME类型关联的扩展名。 |
| 13 | `CEF3平台_取MIME类型` | `CEF3平台_取MIME类型(扩展名)` | 文本型 | 高级 | `CefGetMimeType` | 返回扩展名对应的MIME类型；扩展名前的点号可省略。 |
| 14 | `CEF3平台_设置可嵌套任务` | `CEF3平台_设置可嵌套任务(允许)` | 整数型 | 高级 | `CefSetNestableTasksAllowed` | 在CEF UI线程进入确定可重入的原生消息循环前启用，退出后必须立即关闭；打印等不可重入流程禁止启用。 |
| 15 | `CEF3平台_取任务管理器` | `CEF3平台_取任务管理器()` | 长整数型 | 高级 | `cef_task_manager_get` | 取得CEF全局任务管理器的类型化受管句柄；调用会自动调度到CEF UI线程。 |
| 16 | `CEF3平台_任务管理器取任务数量` | `CEF3平台_任务管理器取任务数量(任务管理器句柄)` | 长整数型 | 高级 | `CefTaskManager::GetTasksCount` | 取得当前由CEF任务管理器跟踪的任务数量。 |
| 17 | `CEF3平台_任务管理器取任务ID数组` | `CEF3平台_任务管理器取任务ID数组(任务管理器句柄)` | 文本型 | 高级 | `CefTaskManager::GetTaskIdsList` | 返回当前任务ID的JSON整数数组；不暴露CEF原生数组指针。 |
| 18 | `CEF3平台_任务管理器按浏览器取任务ID` | `CEF3平台_任务管理器按浏览器取任务ID(任务管理器句柄, 浏览器ID)` | 长整数型 | 高级 | `CefTaskManager::GetTaskIdForBrowserId` | 按CEF浏览器ID取得其主任务ID；无效或不存在时返回-1。 |
| 19 | `CEF3平台_任务管理器终止任务` | `CEF3平台_任务管理器终止任务(任务管理器句柄, 任务ID)` | 整数型 | 高级 | `CefTaskManager::KillTask` | 尝试终止指定任务；任务不存在、不可终止或线程不正确时返回假。 |
| 20 | `CEF3平台_任务管理器取任务信息` | `CEF3平台_任务管理器取任务信息(任务管理器句柄, 任务ID)` | 文本型 | 高级 | `CefTaskManager::GetTaskInfo` | 返回任务固定字段JSON：类型、标题、可终止、CPU、内存和GPU占用。 |
| 21 | `CEF3平台_取当前线程任务运行器` | `CEF3平台_取当前线程任务运行器()` | 长整数型 | 高级 | `CefTaskRunner::GetForCurrentThread` | 取得当前CEF线程的任务运行器；非CEF线程返回0并设置错误。 |
| 22 | `CEF3平台_取指定线程任务运行器` | `CEF3平台_取指定线程任务运行器(CEF线程ID)` | 长整数型 | 高级 | `CefTaskRunner::GetForThread` | 取得指定CEF线程的任务运行器；线程ID必须是公开的CEF线程枚举值。 |
| 23 | `CEF3平台_任务运行器是否属于当前线程` | `CEF3平台_任务运行器是否属于当前线程(任务运行器句柄)` | 整数型 | 高级 | `CefTaskRunner::BelongsToCurrentThread` | 判断受管任务运行器是否属于当前调用线程。 |
| 24 | `CEF3平台_任务运行器是否属于指定线程` | `CEF3平台_任务运行器是否属于指定线程(任务运行器句柄, CEF线程ID)` | 整数型 | 高级 | `CefTaskRunner::BelongsToThread` | 判断受管任务运行器是否属于指定的公开CEF线程。 |
| 25 | `CEF3平台_任务运行器是否同一对象` | `CEF3平台_任务运行器是否同一对象(任务运行器句柄, 另一任务运行器句柄)` | 整数型 | 高级 | `CefTaskRunner::IsSame` | 判断两个受管任务运行器句柄是否指向同一CEF任务运行器。 |
| 26 | `CEF3平台_创建专用线程` | `CEF3平台_创建专用线程(显示名称, 优先级, 消息循环类型, 可停止, COM初始化模式)` | 长整数型 | 高级 | `CefThread::CreateThread` | 在CEF UI线程创建受管专用线程。优先级为0到3，消息循环为0默认、1 UI、2 IO，COM模式为0无、1 STA、2 MTA；STA必须使用UI消息循环。 |
| 27 | `CEF3平台_线程取系统ID` | `CEF3平台_线程取系统ID(线程句柄)` | 长整数型 | 高级 | `CefThread::GetPlatformThreadId` | 取得专用线程的Windows线程ID；停止后仍返回同一个ID。 |
| 28 | `CEF3平台_线程取任务运行器` | `CEF3平台_线程取任务运行器(线程句柄)` | 长整数型 | 高级 | `CefThread::GetTaskRunner` | 取得专用线程的受管任务运行器句柄，可用于立即或延迟投递任务。 |
| 29 | `CEF3平台_线程是否运行` | `CEF3平台_线程是否运行(线程句柄)` | 整数型 | 高级 | `CefThread::IsRunning` | 在创建该线程的CEF UI线程查询专用线程是否仍在运行。 |
| 30 | `CEF3平台_停止专用线程` | `CEF3平台_停止专用线程(线程句柄)` | 整数型 | 高级 | `CefThread::Stop` | 在创建该线程的CEF UI线程停止并等待专用线程退出；不可停止线程会返回明确的不支持错误。 |
| 31 | `CEF3平台_释放专用线程` | `CEF3平台_释放专用线程(线程句柄)` | 整数型 | 高级 | `LB_CEF3_HandleRelease` | 释放受管线程句柄；可停止线程尚未停止时由Bridge在创建线程上安全停止后释放。 |
| 32 | `CEF3平台_组件取ID` | `CEF3平台_组件取ID(组件句柄)` | 文本型 | 高级 | `CefComponent::GetID` | 读取组件快照的唯一标识；组件对象可由组件更新器查询接口产生。 |
| 33 | `CEF3平台_组件取名称` | `CEF3平台_组件取名称(组件句柄)` | 文本型 | 高级 | `CefComponent::GetName` | 读取组件快照的人类可读名称；组件尚未安装时返回空文本。 |
| 34 | `CEF3平台_组件取状态` | `CEF3平台_组件取状态(组件句柄)` | 整数型 | 高级 | `CefComponent::GetState` | 读取组件快照的CEF状态枚举值；组件状态定义见CEF组件状态说明。 |
| 35 | `CEF3平台_组件取版本` | `CEF3平台_组件取版本(组件句柄)` | 文本型 | 高级 | `CefComponent::GetVersion` | 读取组件快照的版本文本；组件尚未安装时返回空文本。 |
| 36 | `CEF3平台_组件更新器按ID取组件` | `CEF3平台_组件更新器按ID取组件(组件更新器句柄, 组件ID)` | 长整数型 | 高级 | `CefComponentUpdater::GetComponentByID` | 按组件ID取得组件快照受管句柄；不存在或服务不可用时返回0并设置错误。 |
| 37 | `CEF3平台_组件更新器取数量` | `CEF3平台_组件更新器取数量(组件更新器句柄)` | 长整数型 | 高级 | `CefComponentUpdater::GetComponentCount` | 取得组件更新器当前注册组件数量；服务不可用时返回0。 |
| 38 | `CEF3平台_组件更新器取组件数组` | `CEF3平台_组件更新器取组件数组(组件更新器句柄)` | CEF3组件数组 | 高级 | `CefComponentUpdater::GetComponents` | 返回组件快照数组JSON；每项包含ID、名称、版本和状态，不暴露CEF原生指针。 |
| 39 | `CEF3平台_组件更新器更新` | `CEF3平台_组件更新器更新(组件更新器句柄, 组件ID, 优先级)` | 长整数型 | 高级 | `CefComponentUpdater::Update` | 异步触发组件按需更新；优先级0为后台，1为前台，返回受管任务句柄。 |
| 40 | `CEF3平台_设置启动命令开关` | `CEF3平台_设置启动命令开关(进程类型, 开关名, 开关值)` | 整数型 | 高级 | `CefApp::OnBeforeCommandLineProcessing` | 在CEF初始化前登记启动命令开关；进程类型为空时应用到浏览器及全部子进程，初始化时由OnBeforeCommandLineProcessing安全写入。 |
| 41 | `CEF3平台_创建可等待事件` | `CEF3平台_创建可等待事件(自动重置, 初始已触发)` | 长整数型 | 高级 | `cef_waitable_event_create` | 创建线程同步用的受管等待事件；等待操作不得在CEF UI或IO线程阻塞。 |
| 42 | `CEF3平台_可等待事件重置` | `CEF3平台_可等待事件重置(事件句柄)` | 整数型 | 高级 | `CefWaitableEvent::Reset` | 将受管等待事件置为未触发状态。 |
| 43 | `CEF3平台_可等待事件触发` | `CEF3平台_可等待事件触发(事件句柄)` | 整数型 | 高级 | `CefWaitableEvent::Signal` | 将受管等待事件置为已触发状态，并唤醒等待线程。 |
| 44 | `CEF3平台_可等待事件是否已触发` | `CEF3平台_可等待事件是否已触发(事件句柄)` | 整数型 | 高级 | `CefWaitableEvent::IsSignaled` | 查询受管等待事件是否已触发；自动重置事件查询后会恢复未触发状态。 |
| 45 | `CEF3平台_可等待事件限时等待` | `CEF3平台_可等待事件限时等待(事件句柄, 最大毫秒)` | 整数型 | 高级 | `CefWaitableEvent::TimedWait` | 等待事件最多指定毫秒；UI和IO线程禁止阻塞调用。 |
| 46 | `CEF3平台_可等待事件等待` | `CEF3平台_可等待事件等待(事件句柄)` | 整数型 | 高级 | `CefWaitableEvent::Wait` | 等待事件直到被触发；UI和IO线程禁止阻塞调用。 |
| 47 | `CEF3命令行_创建` | `CEF3命令行_创建()` | 长整数型 | 高级 | `CefCommandLine::CreateCommandLine` | 创建可写的CEF命令行对象并返回类型化受管句柄；可在CEF初始化前调用。 |
| 48 | `CEF3命令行_是否有效` | `CEF3命令行_是否有效(命令行句柄)` | 整数型 | 高级 | `CefCommandLine::IsValid` | 判断类型化命令行句柄及底层CEF对象是否有效。 |
| 49 | `CEF3命令行_是否只读` | `CEF3命令行_是否只读(命令行句柄)` | 整数型 | 高级 | `CefCommandLine::IsReadOnly` | 判断CEF命令行对象是否只读；全局命令行对象为只读。 |
| 50 | `CEF3命令行_复制` | `CEF3命令行_复制(命令行句柄)` | 长整数型 | 高级 | `CefCommandLine::Copy` | 复制命令行内容并返回新的独立可写受管句柄。 |
| 51 | `CEF3命令行_从参数数组初始化` | `CEF3命令行_从参数数组初始化(命令行句柄, 参数数组)` | 整数型 | 高级 | `CefCommandLine::InitFromArgv` | 以参数数组初始化可写命令行；首项必须是程序名。Windows Bridge会按系统argv引用规则构造命令行文本，等价适配官方仅在非Windows支持的InitFromArgv。 |
| 52 | `CEF3命令行_从文本初始化` | `CEF3命令行_从文本初始化(命令行句柄, 命令行文本)` | 整数型 | 高级 | `CefCommandLine::InitFromString` | 在Windows上解析GetCommandLineW格式的UTF-16命令行文本。 |
| 53 | `CEF3命令行_取完整文本` | `CEF3命令行_取完整文本(命令行句柄)` | 文本型 | 高级 | `CefCommandLine::GetCommandLineString` | 返回CEF命令行对象表示的完整命令行文本。 |
| 54 | `CEF3命令行_取程序` | `CEF3命令行_取程序(命令行句柄)` | 文本型 | 高级 | `CefCommandLine::GetProgram` | 返回命令行的程序部分。 |
| 55 | `CEF3命令行_设置程序` | `CEF3命令行_设置程序(命令行句柄, 程序)` | 整数型 | 高级 | `CefCommandLine::SetProgram` | 设置可写命令行对象的程序部分。 |
| 56 | `CEF3命令行_是否有开关` | `CEF3命令行_是否有开关(命令行句柄)` | 整数型 | 高级 | `CefCommandLine::HasSwitches` | 判断命令行是否包含任意开关。 |
| 57 | `CEF3命令行_是否有指定开关` | `CEF3命令行_是否有指定开关(命令行句柄, 开关名)` | 整数型 | 高级 | `CefCommandLine::HasSwitch` | 按不带前缀的ASCII名称判断命令行是否包含指定开关。 |
| 58 | `CEF3命令行_添加开关` | `CEF3命令行_添加开关(命令行句柄, 开关名)` | 整数型 | 高级 | `CefCommandLine::AppendSwitch` | 向可写命令行末尾添加无值开关；名称由CEF规范化为小写。 |
| 59 | `CEF3命令行_添加带值开关` | `CEF3命令行_添加带值开关(命令行句柄, 开关名, 开关值)` | 整数型 | 高级 | `CefCommandLine::AppendSwitchWithValue` | 向可写命令行末尾添加带值开关；名称由CEF规范化为小写，开关值允许为空文本。 |
| 60 | `CEF3命令行_取开关值` | `CEF3命令行_取开关值(命令行句柄, 开关名)` | 文本型 | 高级 | `CefCommandLine::GetSwitchValue` | 读取指定开关的UTF-16值；开关不存在或没有值时返回空文本。 |
| 61 | `CEF3命令行_移除开关` | `CEF3命令行_移除开关(命令行句柄, 开关名)` | 整数型 | 高级 | `CefCommandLine::RemoveSwitch` | 从可写命令行中移除指定开关；不存在时保持成功。 |
| 62 | `CEF3命令行_是否有参数` | `CEF3命令行_是否有参数(命令行句柄)` | 整数型 | 高级 | `CefCommandLine::HasArguments` | 判断命令行中是否存在非开关参数。 |
| 63 | `CEF3命令行_添加参数` | `CEF3命令行_添加参数(命令行句柄, 参数)` | 整数型 | 高级 | `CefCommandLine::AppendArgument` | 向可写命令行末尾添加一个UTF-16参数；允许显式添加空参数。 |
| 64 | `CEF3命令行_重置` | `CEF3命令行_重置(命令行句柄)` | 整数型 | 高级 | `CefCommandLine::Reset` | 清空可写命令行的全部开关和参数，但保留程序部分。 |
| 65 | `CEF3命令行_取参数向量` | `CEF3命令行_取参数向量(命令行句柄)` | CEF3文本数组 | 高级 | `CefCommandLine::GetArgv` | 返回原始命令行向量，依次包含程序、开关、分隔符和普通参数。 |
| 66 | `CEF3命令行_取参数列表` | `CEF3命令行_取参数列表(命令行句柄)` | CEF3文本数组 | 高级 | `CefCommandLine::GetArguments` | 返回全部非开关参数，不包含程序和开关。 |
| 67 | `CEF3命令行_取开关列表` | `CEF3命令行_取开关列表(命令行句柄)` | CEF3命令行开关数组 | 高级 | `CefCommandLine::GetSwitches` | 返回名称已规范化为小写的开关记录数组；无值开关的值为空文本。 |
| 68 | `CEF3命令行_前置包装器` | `CEF3命令行_前置包装器(命令行句柄, 包装器)` | 整数型 | 高级 | `CefCommandLine::PrependWrapper` | 在可写命令行前插入调试器等包装命令，例如“gdb --args”。 |
| 69 | `CEF3命令行_取全局` | `CEF3命令行_取全局()` | 长整数型 | 高级 | `CefCommandLine::GetGlobalCommandLine` | 取得CEF进程全局命令行的只读受管句柄；修改操作会返回只读错误。 |
| 70 | `CEF3命令行_释放` | `CEF3命令行_释放(命令行句柄)` | 整数型 | 高级 | `LB_CEF3_CommandLineRelease` | 释放CEF命令行受管句柄；释放后继续使用会返回明确错误。 |
| 71 | `CEF3平台_取Chrome实验开关` | `CEF3平台_取Chrome实验开关()` | 文本型 | 高级 | `CefPreferenceManager::GetChromeVariationsAsSwitches` | 以JSON数组返回当前Chrome Variations命令行开关。 |
| 72 | `CEF3平台_取Chrome实验说明` | `CEF3平台_取Chrome实验说明()` | 文本型 | 高级 | `CefPreferenceManager::GetChromeVariationsAsStrings` | 以JSON数组返回当前Chrome Variations可读说明。 |

## 受管读写流处理器

传输模块提供基于受管缓冲的 `CefReadHandler`、`CefWriteHandler`、`CefStreamReader` 和 `CefStreamWriter`。完整生命周期、限制和 `.lcpp` 示例见 [受管读写流处理器专题](stream-handlers.md)。
CEF3 DevTools Observer 的四个官方回调、订阅生命周期和动态协议 JSON 说明见 [DevTools Observer 用户指南](devtools-observer.md)。

## 运行与安全边界

- CEF3 模块族基于 CEF 150、C++20、MSVC 动态 CRT，并固定为 `windows-msvc-x64`。
- 应用工程只包含 `LingBuilderCefBridge.h` 并链接 Bridge 导入库；应用层不得直接管理 CEF 生命周期或跨 DLL 释放对象。
- 受管对象、任务和缓冲句柄必须用对应释放接口关闭；过期、类型错误或重复释放会返回稳定错误。
- CEF3 的 CEF 150 与 FBro 进程内模式的 CEF 135 ABI 不兼容；只有全部 FBro 控件使用独立进程嵌入或独立进程窗口时才允许同项目启用。此时 FBro 运行时只物化到 `fbro-host/`，不得覆盖主程序目录中的 CEF3 运行时。

## 相关来源

- 事件目录：`electron/src/services/modules/cef3BrowserEvents.ts`
- 模块清单：`electron/src/services/modules/builtinModules.ts`、`electron/src/services/modules/cef3Modules.ts`
- 覆盖目录：`electron/src/services/modules/cef3ApiCoverage.generated.json`
- 原生 Bridge：`electron/native/cef3-bridge/`

## CEF 150 官方覆盖索引

冻结基线：`150.0.14+g7c1aa68+chromium-150.0.7871.129` / `windows-msvc-x64`。全部 1577 项官方签名已按功能域生成独立参考；每项保留真实实现状态，`planned` 不会被描述为可调用。

| 功能域 | 模块 ID | 官方签名数 | 参考文档 |
|---|---|---:|---|
| 基础浏览器 | `lingbuilder.cef3.browser` | 94 | `browser.md` |
| 事件与回调 | `lingbuilder.cef3.events` | 113 | `events.md` |
| 会话与请求上下文 | `lingbuilder.cef3.session` | 18 | `session.md` |
| 下载、打印与传输 | `lingbuilder.cef3.transfer` | 100 | `transfer.md` |
| 受管对象 | `lingbuilder.cef3.objects` | 190 | `objects.md` |
| 自动化、DOM、V8 与 JSHook | `lingbuilder.cef3.automation` | 219 | `automation.md` |
| 网络、请求与资源 | `lingbuilder.cef3.network` | 199 | `network.md` |
| 开发者工具 | `lingbuilder.cef3.devtools` | 5 | `devtools.md` |
| CEF Views | `lingbuilder.cef3.views` | 261 | `views.md` |
| 离屏渲染 OSR | `lingbuilder.cef3.osr` | 54 | `osr.md` |
| 平台与工具 | `lingbuilder.cef3.platform` | 324 | `platform.md` |

目录项数：98；模块数：10；用户接口数：411。

