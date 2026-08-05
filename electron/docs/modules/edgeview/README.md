<!-- 此文件由 electron/scripts/generate-edgeview-event-doc.ts 生成。请修改 edgeViewBrowserEvents.ts 后运行 npm run module:edgeview-docs。 -->
# EdgeView 浏览器模块事件参考

EdgeView 模块当前通过统一事件目录公开 71 项普通 HWND 可达事件。事件名称、稳定 WebView2 标识、分类和简要说明均从 `electron/src/services/modules/edgeViewBrowserEvents.ts` 生成；不要在示例或 UI 中另行维护事件名单。

## 快速使用

事件处理器是在当前窗口中执行的无参数中文事件或方法。新代码使用 `&处理器名` 引用：

```text
绑定结果 = EdgeView_绑定控件事件(演示浏览器, "Web资源请求", &收到资源请求)
结束

事件 收到资源请求()
    地址 = EdgeView事件_取字段(演示浏览器, "uri")
    调试输出(地址)
结束
```

- 设计器控件使用 `EdgeView_绑定控件事件(控件名, 事件名, &处理器名)`；控件名是裸 `controlRef`，不要加引号。
- 纯代码实例使用 `EdgeView_绑定事件(实例编号, 事件名, &处理器名)`。
- `EdgeView_取事件数据控件` / `EdgeView_取事件数据` 返回当前事件的 UTF-16 JSON 文本。
- 需要读取单个字段时使用 `EdgeView事件_取字段(控件名, "字段名")`；字段值以文本形式返回，数字字段再转换为整数或长整数。
- 同步决策事件只在处理器执行期间允许调用对应的 `EdgeView事件_*` 或 `EdgeView资源_*` 决策接口；未设置动作时保留 WebView2 默认行为。

## 统一事件目录

| # | 中文事件名 | WebView2 事件标识 | 设计器事件 ID | 事件来源 | 说明 |
|---:|---|---|---|---|---|
| 1 | 导航开始 | `NavigationStarting` | `NavigationStarting` | WebView | 顶层页面开始导航。 |
| 2 | 内容加载 | `ContentLoading` | `ContentLoading` | WebView | 顶层页面开始加载内容。 |
| 3 | 地址改变 | `SourceChanged` | `SourceChanged` | WebView | 浏览器当前地址改变。 |
| 4 | 历史记录改变 | `HistoryChanged` | `HistoryChanged` | WebView | 前进、后退历史记录状态改变。 |
| 5 | 导航完成 | `NavigationCompleted` | `NavigationCompleted` | WebView | 顶层页面导航完成或失败。 |
| 6 | 框架导航开始 | `FrameNavigationStarting` | `FrameNavigationStarting` | WebView | 任意框架开始导航。 |
| 7 | 框架导航完成 | `FrameNavigationCompleted` | `FrameNavigationCompleted` | WebView | 任意框架导航完成或失败。 |
| 8 | DOM加载完成 | `DOMContentLoaded` | `DOMContentLoaded` | WebView | 顶层页面 DOMContentLoaded。 |
| 9 | 标题改变 | `DocumentTitleChanged` | `TitleChanged` | WebView | 网页标题改变。 |
| 10 | 全屏元素状态改变 | `ContainsFullScreenElementChanged` | `ContainsFullScreenElementChanged` | WebView | 网页进入或退出全屏元素状态。 |
| 11 | 窗口关闭请求 | `WindowCloseRequested` | `WindowCloseRequested` | WebView | 网页脚本请求关闭当前窗口。 |
| 12 | 脚本对话框打开 | `ScriptDialogOpening` | `ScriptDialogOpening` | WebView | 网页请求 alert、confirm、prompt 或 beforeunload 对话框。 |
| 13 | 网页消息 | `WebMessageReceived` | `WebMessageReceived` | WebView | 收到网页通过 chrome.webview.postMessage 发送的消息。 |
| 14 | 新窗口请求 | `NewWindowRequested` | `NewWindowRequested` | WebView | 网页请求打开新窗口。 |
| 15 | 外部URI方案启动 | `LaunchingExternalUriScheme` | `LaunchingExternalUriScheme` | WebView | 网页请求启动系统外部 URI 方案。 |
| 16 | 权限请求 | `PermissionRequested` | `PermissionRequested` | WebView | 网页请求摄像头、麦克风、定位等权限。 |
| 17 | Web资源请求 | `WebResourceRequested` | `WebResourceRequested` | WebView | 匹配过滤器的网络资源请求即将发送。 |
| 18 | Web资源响应收到 | `WebResourceResponseReceived` | `WebResourceResponseReceived` | WebView | 网络资源响应已收到。 |
| 19 | 客户端证书请求 | `ClientCertificateRequested` | `ClientCertificateRequested` | WebView | 服务器请求客户端证书。 |
| 20 | 基本身份验证请求 | `BasicAuthenticationRequested` | `BasicAuthenticationRequested` | WebView | 服务器请求 HTTP 基本身份验证。 |
| 21 | 服务器证书错误 | `ServerCertificateErrorDetected` | `ServerCertificateErrorDetected` | WebView | 检测到服务器 TLS 证书错误。 |
| 22 | 保存文件安全检查开始 | `SaveFileSecurityCheckStarting` | `SaveFileSecurityCheckStarting` | WebView | 保存文件前执行安全检查。 |
| 23 | 屏幕捕获开始 | `ScreenCaptureStarting` | `ScreenCaptureStarting` | WebView | 网页内容即将被屏幕捕获。 |
| 24 | 进程失败 | `ProcessFailed` | `ProcessFailed` | WebView | 浏览器或渲染进程失败。 |
| 25 | 框架创建 | `FrameCreated` | `FrameCreated` | WebView | 顶层 WebView 创建了子框架。 |
| 26 | 下载开始 | `DownloadStarting` | `DownloadStarting` | WebView | 网页下载任务开始。 |
| 27 | 静音状态改变 | `IsMutedChanged` | `IsMutedChanged` | WebView | 浏览器静音状态改变。 |
| 28 | 音频播放状态改变 | `IsDocumentPlayingAudioChanged` | `IsDocumentPlayingAudioChanged` | WebView | 文档是否播放音频的状态改变。 |
| 29 | 下载对话框状态改变 | `IsDefaultDownloadDialogOpenChanged` | `IsDefaultDownloadDialogOpenChanged` | WebView | 默认下载对话框打开状态改变。 |
| 30 | 右键菜单请求 | `ContextMenuRequested` | `ContextMenuRequested` | WebView | 网页请求显示上下文菜单。 |
| 31 | 状态栏文本改变 | `StatusBarTextChanged` | `StatusBarTextChanged` | WebView | 浏览器状态栏文本改变。 |
| 32 | 网站图标改变 | `FaviconChanged` | `FaviconChanged` | WebView | 当前网页 Favicon 地址改变。 |
| 33 | 网页通知收到 | `NotificationReceived` | `NotificationReceived` | WebView | 收到网页通知。 |
| 34 | 另存为界面显示 | `SaveAsUIShowing` | `SaveAsUIShowing` | WebView | 浏览器将显示另存为界面。 |
| 35 | 缩放比例改变 | `Controller.ZoomFactorChanged` | `Controller.ZoomFactorChanged` | 浏览器控制器 | 浏览器控制器缩放比例改变。 |
| 36 | 移动焦点请求 | `Controller.MoveFocusRequested` | `Controller.MoveFocusRequested` | 浏览器控制器 | 浏览器请求把焦点移入或移出控件。 |
| 37 | 浏览器获得焦点 | `Controller.GotFocus` | `Controller.GotFocus` | 浏览器控制器 | 浏览器控制器获得焦点。 |
| 38 | 浏览器失去焦点 | `Controller.LostFocus` | `Controller.LostFocus` | 浏览器控制器 | 浏览器控制器失去焦点。 |
| 39 | 浏览器快捷键按下 | `Controller.AcceleratorKeyPressed` | `Controller.AcceleratorKeyPressed` | 浏览器控制器 | 浏览器控制器收到加速键。 |
| 40 | 光栅化缩放改变 | `Controller.RasterizationScaleChanged` | `Controller.RasterizationScaleChanged` | 浏览器控制器 | 控制器光栅化缩放比例改变。 |
| 41 | 新浏览器版本可用 | `Environment.NewBrowserVersionAvailable` | `Environment.NewBrowserVersionAvailable` | 浏览器环境 | WebView2 Runtime 新版本可用于后续进程。 |
| 42 | 浏览器进程退出 | `Environment.BrowserProcessExited` | `Environment.BrowserProcessExited` | 浏览器环境 | WebView2 浏览器进程退出。 |
| 43 | 进程信息改变 | `Environment.ProcessInfosChanged` | `Environment.ProcessInfosChanged` | 浏览器环境 | WebView2 进程信息集合改变。 |
| 44 | 下载字节数改变 | `Download.BytesReceivedChanged` | `Download.BytesReceivedChanged` | 下载任务 | 下载任务已接收字节数改变。 |
| 45 | 下载预计结束时间改变 | `Download.EstimatedEndTimeChanged` | `Download.EstimatedEndTimeChanged` | 下载任务 | 下载任务预计结束时间改变。 |
| 46 | 下载状态改变 | `Download.StateChanged` | `Download.StateChanged` | 下载任务 | 下载任务状态改变。 |
| 47 | 查找当前匹配改变 | `Find.ActiveMatchIndexChanged` | `Find.ActiveMatchIndexChanged` | 页内查找 | 页内查找当前匹配序号改变。 |
| 48 | 查找匹配数改变 | `Find.MatchCountChanged` | `Find.MatchCountChanged` | 页内查找 | 页内查找匹配总数改变。 |
| 49 | 子框架名称改变 | `Frame.NameChanged` | `Frame.NameChanged` | 子框架 | 子框架名称改变。 |
| 50 | 子框架销毁 | `Frame.Destroyed` | `Frame.Destroyed` | 子框架 | 子框架对象销毁。 |
| 51 | 子框架导航开始 | `Frame.NavigationStarting` | `Frame.NavigationStarting` | 子框架 | 指定子框架开始导航。 |
| 52 | 子框架内容加载 | `Frame.ContentLoading` | `Frame.ContentLoading` | 子框架 | 指定子框架开始加载内容。 |
| 53 | 子框架导航完成 | `Frame.NavigationCompleted` | `Frame.NavigationCompleted` | 子框架 | 指定子框架导航完成或失败。 |
| 54 | 子框架DOM加载完成 | `Frame.DOMContentLoaded` | `Frame.DOMContentLoaded` | 子框架 | 指定子框架 DOMContentLoaded。 |
| 55 | 子框架网页消息 | `Frame.WebMessageReceived` | `Frame.WebMessageReceived` | 子框架 | 收到指定子框架发送的网页消息。 |
| 56 | 子框架权限请求 | `Frame.PermissionRequested` | `Frame.PermissionRequested` | 子框架 | 指定子框架请求网页权限。 |
| 57 | 子框架屏幕捕获开始 | `Frame.ScreenCaptureStarting` | `Frame.ScreenCaptureStarting` | 子框架 | 指定子框架即将被屏幕捕获。 |
| 58 | 嵌套子框架创建 | `Frame.FrameCreated` | `Frame.FrameCreated` | 子框架 | 指定子框架创建了嵌套子框架。 |
| 59 | 框架专用工作线程创建 | `Frame.DedicatedWorkerCreated` | `Frame.DedicatedWorkerCreated` | 子框架 | 指定子框架创建了 Dedicated Worker。 |
| 60 | 网页通知关闭请求 | `Notification.CloseRequested` | `Notification.CloseRequested` | 网页通知 | 网页通知对象请求关闭。 |
| 61 | 浏览器配置删除 | `Profile.Deleted` | `Profile.Deleted` | 浏览器配置 | 当前 WebView2 Profile 已删除。 |
| 62 | 专用工作线程创建 | `DedicatedWorkerCreated` | `DedicatedWorkerCreated` | 工作线程 | 当前 WebView 创建了 Dedicated Worker。 |
| 63 | 专用工作线程销毁 | `DedicatedWorker.Destroying` | `DedicatedWorker.Destroying` | 工作线程 | Dedicated Worker 即将销毁。 |
| 64 | 专用工作线程消息 | `DedicatedWorker.WebMessageReceived` | `DedicatedWorker.WebMessageReceived` | 工作线程 | 收到 Dedicated Worker 网页消息。 |
| 65 | 服务工作线程注册 | `ServiceWorker.ServiceWorkerRegistered` | `ServiceWorker.ServiceWorkerRegistered` | 工作线程 | Service Worker 注册可用。 |
| 66 | 服务工作线程激活 | `ServiceWorker.ServiceWorkerActivated` | `ServiceWorker.ServiceWorkerActivated` | 工作线程 | Service Worker 已激活。 |
| 67 | 服务工作线程注销 | `ServiceWorker.Unregistering` | `ServiceWorker.Unregistering` | 工作线程 | Service Worker 注册即将注销。 |
| 68 | 共享工作线程创建 | `SharedWorker.SharedWorkerCreated` | `SharedWorker.SharedWorkerCreated` | 工作线程 | Shared Worker 已创建。 |
| 69 | 共享工作线程销毁 | `SharedWorker.Destroying` | `SharedWorker.Destroying` | 工作线程 | Shared Worker 即将销毁。 |
| 70 | 开发者工具协议事件 | `DevToolsProtocolEventReceived` | `DevToolsProtocolEventReceived` | 开发者工具 | 收到已监听的 Chromium DevTools Protocol 事件。 |
| 71 | 自定义右键菜单项选择 | `ContextMenuItem.CustomItemSelected` | `ContextMenuItem.CustomItemSelected` | 右键菜单项 | 用户选择 LingBuilder 注入的 WebView2 菜单项。 |

## 重点事件字段

所有事件都通过统一 JSON/字段接口读取。下面列出当前 EdgeView 原生运行时明确生成的资源事件字段；其它事件请先读取 `EdgeView_取事件数据控件`，再按实际 JSON 字段读取。

### Web资源请求

| 字段 | 类型/含义 |
|---|---|
| `requestHandle` | 受管请求句柄；不再使用时调用 `EdgeView对象_释放`。 |
| `uri` | 请求地址。 |
| `method` | HTTP 方法，例如 `GET`、`POST`。 |
| `context` | `COREWEBVIEW2_WEB_RESOURCE_CONTEXT` 数值。 |
| `sourceKind` | `COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS` 数值；旧 Runtime 不支持时可能为 0。 |

这是同步资源决策事件。需要替换响应时，在处理器内调用：

```text
EdgeView资源_设置事件响应文本(演示浏览器, 200, "OK", "Content-Type: text/html; charset=utf-8", 页面正文)
```

### Web资源响应收到

| 字段 | 类型/含义 |
|---|---|
| `requestHandle` | 受管请求句柄。 |
| `responseHandle` | 受管响应视图句柄；可交给 `EdgeView资源_读响应正文异步`。 |
| `uri` | 响应对应的请求地址。 |
| `statusCode` | HTTP 状态码。 |
| `reason` | HTTP 原因短语。 |

## 运行时边界

- 普通 HWND 事件目录包含上述 71 项；`CompositionController.CursorChanged` 和 `CompositionController.NonClientRegionChanged` 属于合成控制器专属事件，当前 EdgeView 不支持。
- 事件目录中的名称表示 LingBuilder 中文事件入口；底层 COM 事件对象、`IStream`、裸指针和 `GetDeferral` 不直接暴露给 `.lcpp`。
- 可用事件取决于 WebView2 Runtime 版本。基础事件最低基线为 SDK `1.0.3537.50` / Runtime 141；使用 v2 资源、对象或创建选项接口时按模块诊断要求使用 Runtime 150。

## 不适用事件

| WebView2 事件标识 | 中文名称 | 原因 |
|---|---|---|
| `CompositionController.CursorChanged` | 合成控制器鼠标指针改变 | 仅适用于 CompositionController；LingBuilder EdgeView 使用普通 HWND Controller。 |
| `CompositionController.NonClientRegionChanged` | 合成控制器非客户区改变 | 仅适用于 CompositionController；LingBuilder EdgeView 使用普通 HWND Controller。 |

## 相关来源

- 统一目录：`electron/src/services/modules/edgeViewBrowserEvents.ts`
- API 与 binding：`electron/src/services/modules/edgeViewApiCatalog.ts`、`electron/src/services/modules/builtinModules.ts`
- WebView2 原生字段桥接：`electron/src/services/windowDesigner/lingCppWin32Project.ts`
- 资源请求示例：`examples/edgeview-response-demos/replace-response/` 和 `examples/edgeview-response-demos/read-response/`

目录项数：71；CompositionController 排除项：2。

