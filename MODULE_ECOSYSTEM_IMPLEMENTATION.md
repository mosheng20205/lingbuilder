# LingBuilder 模块生态实现说明

> 2026-08-09 CEF3 Textfield color compatibility group: seven signatures guarded upstream by `CEF_API_REMOVED(15000)` now have explicit C ABI and official V4 coverage without dereferencing the removed C API slots. Text and selected-text setters execute the supported `CefTextfield::ApplyTextColor` method on the CEF UI thread, while all four legacy color categories are retained in the existing managed View sidecar for deterministic direct/V4 readback. Selection-background and placeholder colors are documented as compatibility state because CEF 150 has no native replacement; the Bridge does not claim a visual mutation that CEF cannot perform. V4 enforces unsigned 32-bit colors, and native tests cover real Textfield objects, getters/setters, range/type errors, and release invalidation. Current public coverage is `1266/1384` (91.47%), `planned=118`, and `needsReview=118`.

> 2026-08-09 CEF3 Custom Scheme / SchemeHandlerFactory group: five adjacent APIs now have real C ABI exports and official V4 signature dispatch: app/registrar custom-scheme registration, global and RequestContext factory registration, and the scheme factory `create` callback. Scheme declarations are validated and frozen before `ExecuteSubProcess` in every process, then copied by `BridgeApp::OnRegisterCustomSchemes` into real `CefSchemeRegistrar::AddCustomScheme` calls. The new `SCHEME_HANDLER_FACTORY` typed handle stores only Bridge-managed ResourceHandler configuration, has explicit registration/GetState/type/release behavior, and never exposes a `CefRefPtr`, CEF pointer, request pointer, or address. CEF owns each registered factory snapshot and invokes `Create` on the IO thread to construct an independent `BridgeResourceHandler`; releasing the public configuration handle does not revoke registrations already retained by CEF. Global and isolated RequestContext registration preserve the official nullable factory removal and boolean result semantics. Native tests cover direct/V4 validation and release behavior plus real `lingbuilder://` and `lingbuilderv4://` navigation with managed Frame source readback. Current public coverage is `1259/1384` (90.97%), `planned=125`, and `needsReview=125`.

> 2026-08-09 CEF3 DOM group: all 14 `cef_domdocument_t` operations, all 26 `cef_domnode_t` operations, `cef_domvisitor_t.visit`, and `cef_frame_t.visit_dom` now have real C ABI exports and all 42 official V4 signature hashes. `VisitDOM` executes only in the renderer; the visitor copies the bounded DOM tree, relationships, attributes, selection, and geometry during the callback and transfers a CEF structured process message to Bridge-owned `DOM_DOCUMENT` / `DOM_NODE` snapshot handles. No `CefRefPtr`, DOM pointer, or address crosses the ABI. Mutations return managed Tasks and revisit the renderer DOM by a copied child path before calling the real CEF setter; Browser close fails pending work while detached snapshots remain readable. Attributes and V4 bounds use managed Dictionaries, and text uses the UTF-16 two-stage contract. Native tests cover every direct/V4 path and actual DOM mutation readback; generation, Bridge, generated checks, coverage tests, lint, and build pass. Current public coverage is `1254/1384` (90.61%), `planned=130`, `needsReview=130`; the complete gate reports only those remaining public signatures.

> 2026-08-09 CEF3 RenderProcessHandler and ResourceBundleHandler group: four remaining render-process operations and all three resource-bundle-handler operations now have real C ABI exports and official V4 signature hashes. `BridgeApp` installs the actual `CefLoadHandler` and `CefResourceBundleHandler`; renderer-only DOM/V8 values are copied during their callback scope and transferred as structured process-message snapshots, while WebKit initialization is retained only as a boolean state for safe browser subscription replay. Resource text and managedBuffer bytes are copied before initialization into Bridge-owned immutable storage; configuration freezes as initialization begins, and CEF receives no caller-owned or ABI-visible pointer. Native tests cover direct/V4 configuration, real global ResourceBundle reads, focused DOM changes, uncaught exceptions and WebKit initialization. Current public coverage is `1212/1384` (87.57%), `planned=172`, `needsReview=172`.

> 2026-08-09 CEF3 control delegates and MenuButton group: both TextfieldDelegate callbacks, both ButtonDelegate callbacks, MenuButtonDelegate pressed, and MenuButton create/show/trigger now have real managed `VIEW_DELEGATE` configurations, independent C ABI exports, and all eight official V4 signature hashes. The delegates are passed into actual CEF control creation and emit only callback-scoped retainable managed View subjects with copied fields. Menu display is accepted only on the CEF UI thread for the exact currently pressed MenuButton while its CEF pressed lock remains alive on the synchronous callback stack; the lock never crosses the ABI. Native tests exercise direct/V4 validation and a real top-level Window `TriggerMenu -> OnMenuButtonPressed -> ShowMenu` flow. Current public coverage is `1205/1384` (87.07%), `planned=179`, `needsReview=179`.

> 2026-08-09 CEF3 BrowserViewDelegate group: all nine `cef_browser_view_delegate_t` operations now have a real managed `VIEW_DELEGATE` configuration, a `BridgeBrowserViewDelegate` passed into `CefBrowserView::CreateBrowserView`, independent C ABI exports, and the nine official V4 signature hashes. Browser-created/destroyed, popup-created, and gesture-command events expose only callback-scoped managed BrowserView/Browser subjects plus copied structured fields. Runtime style, Chrome toolbar type, and the three picture-in-picture policies are strict typed configuration. The final delegate CEF reference is released on the CEF UI thread. Native tests exercise direct/V4 validation and a real BrowserView create/destroy lifecycle. Current public coverage is `1197/1384` (86.49%), `planned=187`, `needsReview=187`.

> 2026-08-09 CEF3 PrintHandler group: both remaining Download/Print `cef_client_t` getters, all six `cef_print_handler_t` callbacks, both `cef_print_dialog_callback_t` operations, and `cef_print_job_callback_t.cont` now have real `BridgeClient` overrides, independent C ABI exports, and all 11 official V4 signature hashes. PrintSettings callback subjects use the existing managed typed handle but are forcibly invalidated when CEF returns from the callback, even if the registry handle was retained. Dialog and job callbacks use dedicated registered one-shot typed handles with GetState type checks, explicit `HandleRelease`, Browser-close invalidation, exactly-once completion, and UI-thread final-reference release. Event responses are parsed with CEF's structured JSON parser; PDF size accepts only positive int32 width/height. No CEF pointer, printer object, callback address, or native handle crosses the ABI. Current public coverage is `1188/1384` (85.84%), `planned=196`, `needsReview=196`.

> 2026-08-09 FBro 多实例插件状态修正：本条优先于本文早期任何 `load-extension` 说明。独立 Host 的命令行只启用 Chrome Runtime；启用 FBro VIP 高级扩展能力后，每个独立 RequestContext 必须在创建完成后、浏览器创建前调用 FBro VIP `LoadExtension`，顺序与 FBro C# 独立浏览器示例保持一致。`GetExtensionPath` 与部署路径匹配只表示扩展已注册，页面级“已生效”必须由受控 DOM 探针确认。嵌入 Alloy 模式无法提供 Chromium 原生 `chrome://extensions/`，因此必须在当前浏览器输出只读受管诊断页并保留逻辑地址。浏览器管理器的地址栏以当前实例和 `AddressChanged` 事件的原生 HWND 为准；主窗口尺寸与 DPI 变化必须先运行 LCPP 布局，再调整 FBro 子窗口。
扩展注册事件到达而当前 URL 已匹配时，运行时最多刷新一次首个页面，再开始页面探针；禁止用无限刷新掩盖 content script 注入失败。

> 2026-08-09 FBro 下载进度闭环：`lingbuilder.fbro.browser@2.4.0` 新增兼容下载事件码 16/17，并把 FBro `OnBeforeDownload` / `OnDownloadUpdated` 的真实字段经独立 Host 协议传给普通 Win32 浏览器管理器。未订阅 v3 高级事件时，开始事件继续默认下载，更新事件只观察，不暂停或取消。`浏览器管理器_绑定下载视图` 的详情和进度参数分别使用 `TextBox|Label` 与 `ProgressBar` 的 `controlRef(nativeHandle)`，生成运行时按稳定实例保存进度、字节数、文件与目录；模块 contribution、binding、生成项目、文档和原生下载 smoke 已同步。

> 2026-08-09 CEF3 Render/Accessibility/Frame handler group: all 17 `cef_render_handler_t` callbacks, both `cef_accessibility_handler_t` callbacks, all five `cef_frame_handler_t` callbacks, and the two related `cef_client_t` getters now have real `BridgeClient` overrides, independent C ABI subscriptions/queries, and all 26 official V4 signature hashes. Render geometry and screen responses use structured JSON parsed by CEF; OSR BGRA frames are copied only into callback-scoped, explicitly retainable managedBuffer subjects with a 64 MiB bound. Accelerated-paint events expose format and geometry metadata but never a shared-texture/native handle. Accessibility values are copied into managed Value snapshots. Frame lifecycle events use the managed Browser as subject and copy identifiers/state into structured snapshots so Chromium Frame references are not extended during attach/detach transitions. Query callbacks and real OSR paint delivery are exercised in the native bridge; every direct/V4 entry also has strict target, count, type, range, and disable-path coverage. Current public coverage is `1177/1384` (85.04%), `planned=207`, `needsReview=207`.

> 2026-08-09 CEF3 ResourceHandler group: `get_resource_handler`, all seven `cef_resource_handler_t` methods, and both read/skip continuation callbacks now use a bridge-owned `RESOURCE_HANDLER` typed configuration, real per-request CEF handlers, safe C ABI exports, and all ten official V4 hashes. URL interception is constrained by `CefParseURL` scheme/host/port/path-prefix comparison; source bodies are retained as managedBuffer state and response headers use the existing validated header-list parser. Each request snapshots its configuration. Modern and deprecated Open/ProcessRequest and Read/ReadResponse paths are supported. Asynchronous Read/Skip use one-shot managed continuations and the thread-safe official resource callbacks without querying `CefTaskRunner::GetForCurrentThread` on CEF 150's Chromium network sequence; completion copies only bounded source bytes into CEF-owned output memory and preserves legal negative CEF error values. MIME types are validated as parameter-free `type/subtype` tokens so invalid values cannot silently downgrade HTML to plain text. Cancel invalidates an outstanding continuation without exposing its data pointer. Browser close detaches the source, while external source handles retain normal `HandleRelease` semantics. Native tests cover direct/V4 configuration, strict URL/type/range/MIME validation, truly deferred async and legacy page loads, Range Skip, and cancellation of a held read. Current public coverage is `1151/1384` (83.16%), `planned=233`, `needsReview=233`.

> 2026-08-09 CEF3 ResponseFilter group: `cef_resource_request_handler_t.get_resource_response_filter`, `cef_response_filter_t.init_filter`, and `filter` now use a bridge-owned `RESPONSE_FILTER` typed configuration handle, real per-response CEF filter instances, safe C ABI exports, and official V4 hashes. Callers configure find/replacement bytes only through managedBuffer handles and attach or detach the configuration from a managed Browser; no CEF buffer address crosses the ABI. Each response snapshots the configuration into an independent IO-thread filter that preserves match suffixes across chunks, honors CEF input/output backpressure, enforces a 64 MiB queue bound, and exposes callback input only as an auto-released managedBuffer event subject. Browser close detaches its reference while external configuration handles retain normal `HandleRelease` semantics. Native tests validate direct/V4 creation, attachment, type errors, release invalidation, and a real loopback HTML response whose `bridge-original` bytes become `bridge-filtered` and are read back through the page console. Current public coverage is `1141/1384` (82.44%), `planned=243`, `needsReview=243`.

> 2026-08-09 CEF3 CookieAccessFilter group: `cef_resource_request_handler_t.get_cookie_access_filter`, `cef_cookie_access_filter_t.can_send_cookie`, and `can_save_cookie` now use real `BridgeClient` IO-thread overrides, per-browser C ABI subscriptions, and official V4 hashes. The internal CEF filter is returned only while one of the cookie-policy subscriptions is active; callback Requests remain auto-released managed `REQUEST` subjects, while each `CefCookie` is copied immediately into structured JSON containing its text, flags, times, SameSite, and priority fields. Synchronous policy responses are parsed with `CefParseJSON`, default to CEF's allow behavior, and can deny via action 2 or structured `allow=false`. Native tests use the managed loopback HTTP server to send an existing cookie and receive a `Set-Cookie` response, proving all three real callbacks in addition to direct/V4 registration and strict boolean validation. Current public coverage is `1138/1384` (82.23%), `planned=246`, `needsReview=246`.

> 2026-08-08 CEF3 ResourceRequestHandler lifecycle group: `on_before_resource_load`, `on_protocol_execution`, `on_resource_load_complete`, `on_resource_redirect`, and `on_resource_response` now have real IO-thread overrides, per-browser C ABI subscriptions, and official V4 hashes. `BridgeClient::GetResourceRequestHandler` returns the managed handler only while at least one lifecycle subscription is enabled. Before-load uses a 30-second default-continue managed continuation returned to the originating CEF IO thread; synchronous protocol/redirect/response decisions consume structured CEF-parsed JSON. Callback Request objects appear only as auto-released managed subjects and may be retained explicitly. No OS protocol execution is allowed unless the response explicitly sets `allow=true`. Native tests drive real data-URL before/response/complete callbacks and cover all five direct/V4 switches and strict validation. Current public coverage is `1135/1384` (82.01%), `planned=249`, `needsReview=249`.

> 2026-08-08 CEF3 client certificate selection group: `cef_request_handler_t.on_select_client_certificate` and `cef_select_client_certificate_callback_t.select` now use a real `BridgeClient` override, C ABI subscription/select exports, and official V4 hashes. Candidate arrays are copied into a managed `CERTIFICATE_COLLECTION`; indexed access returns only typed Certificate handles. The continuation privately retains the original CEF candidates, accepts only a nullable Certificate from that exact request, executes `Select` on the originating CEF UI thread, and defaults to `Select(nullptr)` after 30 seconds. The event subject is automatically released after dispatch unless retained. Native tests cover direct/V4 subscription, nullable handle codecs, collection/continuation type rejection, and wrong-lifecycle semantics; the test environment has no mutual-TLS endpoint and therefore does not claim a live certificate challenge. Current public coverage is `1130/1384` (81.65%), `planned=254`, `needsReview=254`.

> 2026-08-08 CEF3 RequestHandler navigation/render group: `on_before_browse`, `on_open_urlfrom_tab`, `on_render_view_ready`, `on_render_process_terminated`, and `on_document_available_in_main_frame` now have real `BridgeClient` overrides, stable C ABI subscription exports, and official V4 operation IDs. Per-browser subscription bits are cleared on close. Before-browse exposes the callback Request only as a managed `REQUEST` subject that is automatically released after dispatch unless explicitly retained; browser/frame/request metadata otherwise remains structured JSON without handle or address encoding. Synchronous V3/V4 decisions preserve CEF cancel semantics, and all callbacks execute on the CEF UI thread selected by CEF. Native tests cover every direct/V4 subscription, strict boolean/target/count validation, managed Request subject typing, and real navigation/document callbacks. Current public coverage is `1128/1384` (81.50%), `planned=256`, `needsReview=256`.

> 2026-08-08 补充：普通 Win32 `win32-fbro-multi-browser-manager` 的界面模块固定为 `lingbuilder.win32.basic` 和 `lingbuilder.win32.common-controls`；`lingbuilder.fbro.browser` 只提供非界面浏览器运行时，`lingbuilder.browser.doubao-downloader@2.0.4` 只携带插件资源。隐藏表头 TabControl 的每个运行时页面、FBro Host、浏览器 HWND、稳定 ID 和 Profile 必须一一对应，ListBox 是唯一用户导航。插件目录固定为真实 exe 同级 `doubao-downloader`，每个 Host 在 CEF 初始化命令行加入 `load-extension`，并在 `OnContextInitialized` 后完成 VIP 授权与 ExtensionPlus 初始化。列表只有在按 UTF-16LE 路径摘要计算的扩展 ID 经 FBro VIP `GetExtensionPath` 回读到同一规范化路径时才能显示“插件已加载”；授权、清单、加载或回读失败必须显示中文原因，但普通浏览器继续运行。新窗口请求由 Bridge 在 `OnBeforePopup` 中对当前 Frame 调用 `LoadURL(target_url)` 并返回取消 popup，不得创建额外 Host 或共享 Profile。

> 2026-08-08 CEF3 URLRequest group: `cef_urlrequest_create`, `cef_frame_t.create_urlrequest`, all seven `cef_urlrequest_t` methods, and all five `cef_urlrequest_client_t` callbacks now have stable C ABI exports and official V4 dispatch. A dedicated managed `URL_REQUEST_CLIENT` handle owns bounded callback Tasks; URLRequest creation and object methods run on CEF UI, while authentication completion returns asynchronously to the originating CEF IO thread through a 30-second, default-cancel, exactly-once managed continuation. Download callback bytes are copied before return into a managedBuffer and can be taken exactly once. Credential JSON is parsed with CEF's structured JSON parser, request errors preserve negative CEF values, and URLRequest handles cancel on UI-thread final release. Native tests use real loopback HTTP download, 256 KiB upload progress, Basic authentication retry, and cancellation. Current public coverage is `1123/1384` (81.14%), `planned=261`, `needsReview=261`.

> 2026-08-08 CEF3 MediaRouter Sink/Route group: all 17 remaining `CefMediaSink`, `CefMediaRoute`, route creation/device information callbacks, and route state/message observer signatures now have stable C ABI and official V4 dispatch. `MEDIA_SINK` and `MEDIA_ROUTE` handles retain CEF references and release their final reference on CEF UI. Device queries and route creation are managed Tasks; route creation preserves CEF's numeric result and error text, with an optional resulting Route extracted exactly once. Observer route events retain a typed Route, copy transient message bytes immediately into a managedBuffer, cap queued events, and fail pending Tasks when the Observer is released. Sending accepts only managedBuffer; no CEF pointer, callback object, address, or transient byte pointer crosses the ABI. Current public coverage is `1109/1384` (80.13%), `planned=275`, `needsReview=275`.

> 2026-08-08 补充：FBro 多浏览器工作台使用 `lingbuilder.browser.doubao-downloader@2.0.4` 携带只读 Manifest V3 插件资源。模块运行时文件必须由现有模块/Visual Studio 导出链路部署为 `<exe所在目录>\\doubao-downloader\\*`，应用再从真实 exe 目录解析并在每个独立 RequestContext 创建浏览器前加载；不得引用开发机插件绝对路径。`.lcpppkg` 可以携带插件模块、源码、设计器与 `profiles/<稳定ID>` 形式的结构配置，但必须排除 Cookie、Profile、缓存、localStorage、sessionStorage、IndexedDB、凭据和其它浏览器用户数据；接收方导入后为每个稳定 ID 创建新的本机数据目录。

> 2026-08-08 CEF3 navigation/SSL group: added real typed-handle C ABI and official V4 dispatch for `cef_navigation_entry_t.get_sslstatus`, `cef_sslinfo_t.get_cert_status`, and `cef_sslinfo_t.get_x509_certificate`; corrected all `cef_sslstatus_t` bindings to SSLStatus handles. Native tests cover nullable SSL snapshots, X509 extraction, SSLInfo helpers, wrong-type calls, and released-handle invalidation. Current public coverage is `982/1384` (70.95%), `planned=402`, `needsReview=402`.

> 2026-08-08 补充：`lingbuilder.new_emoji.fbro-shell@1.2.0` 支持以 RichList 运行时动作管理动态独立 FBro 会话。会话身份只能使用新建时生成的稳定 ID；RichList 的 `itemKey`、排序位置和数组下标均不是身份。每个稳定 ID 必须唯一映射到 Host PID、伴随宿主 HWND、WebSocket、Profile 和生命周期。关闭保留表项与 Profile，重开复用原配置，删除先关闭再移除绑定且默认保留 Profile；上移、下移、置顶和沉底只能重排稳定 ID 显示顺序，不能交换或复用浏览器资源。

> 2026-08-08 补充：动态 FBro 会话的 Cookie 写入必须经 `浏览器外壳_设置实例Cookie` / `浏览器外壳_打开Cookie对话框` 路由到指定稳定 ID 的 Host。Bridge 只有在 RequestContext `SetCookie` 和 `FlushStore` 完成回调完成、目标 Cookie 精确读回且其它会话快照不变后才能报告成功；禁止网页脚本绕过 Cookie API，也禁止在调试输出、测试错误或文档示例中记录 Cookie 明文。

> 2026-08-08 补充：FBro 独立进程嵌入模式的浏览器子窗口在 Host 内部保持可见，最终显隐由主进程拥有的伴随父 `HWND` 决定。跨进程 `show`、`hide`、`resize` 必须使用不等待响应的 WebSocket 通知，禁止在主窗口 UI 线程同步等待 Host 调用 `SetWindowPos`，避免父子窗口线程互相等待并造成首次启动死锁。普通 Win32 与 new_emoji 两套生成包装必须复用同一 `LingFbroProcessController::Notify` 契约；首次启动 smoke 必须验证主窗口 `Responding`，不能只验证 Host PID 和 Chromium HWND 存在。

> 2026-08-08 补充：`lingbuilder.new_emoji.fbro-shell@1.2.0` 的动态独立实例集合由原生运行时持有，RichList、隐藏表头 Tabs、稳定 ID、Host PID、WebSocket 和 Profile 使用同一映射。多浏览器项目不得再预创建固定数量的 FBro 控件；添加实例必须真实创建新的 `LingBuilderFbroHost.exe`，关闭或主宿主退出必须通过控制器和 Job Object 回收。

> 2026-08-08 补充：`lingbuilder.database.sqlite@2.0.0` 已从 7 条单连接动态桥接升级为 67 条商用级接口，并保留全部旧命令。模块通过 `sqliteModule.ts` 单一目录生成 contribution/binding，通过 `sqliteRuntime.ts` 提供多连接和预编译语句受管 ID、FULLMUTEX、强类型参数/列、事务/保存点、WAL、Online Backup、完整性检查、中断及线程本地完整错误状态；连接关闭会兜底释放所属语句，活动资源存在时禁止切换或卸载 DLL。项目必须提供与 Win32/x64 目标一致、固定来源/版本/SHA-256 的官方 `sqlite3.dll`，不得自动下载或把单架构 DLL 复制到全部输出。`smoke:sqlite-native` 已完成双架构 MSVC Release 编译和 x64 真实数据库闭环。

> 2026-08-08 补充：CEF3 面向用户的统一事件与接口参考由实际事件目录、安全覆盖目录和模块 manifest 生成 92 项事件名称、113 条官方事件签名与中文用户接口。当前覆盖为 979 implemented、8 internal、185 notApplicable、405 planned，即公开接口完成 979 / 1384（70.74%）。进程消息、PostData、Request/Response、RequestContext 身份/共享/站点设置/内容设置/Chrome 配色、PrintSettings、Browser/Frame、BrowserHost 新增 21 个安全入口及图片下载/PDF 打印的 4 个主方法与回调接口、BrowserView 全部 6 个接口、基础 View、Panel/Layout/BoxLayout、ScrollView、LabelButton/Button 全部 18 个当前安全入口、Window 42 项安全入口、OverlayController 全部 19 个接口、CEF API 15000 当前存在的 25 个 Textfield 接口、Display 全部 16 个接口、DragData 全部 28 个接口、XmlReader 全部 30 个接口、ZipReader 全部 13 个接口以及 ResourceBundle 全部 4 个接口，均已进入 C ABI、固定 V4 operation ID、原生测试和自动生成文档闭环；MenuButton 和 `show_as_browser_modal_dialog` 在真实受管委托链路落地前继续保持 planned，Textfield 的 7 个 `removed=15000` 旧颜色接口也不能以缓存或近似替代伪装为 implemented。
>
> CEF Views 统一使用受管 `View`、`Window`、`ViewDelegate`、`Layout`、`Display` 和 `DisplayCollection` typed handle，并调度到 CEF UI 线程。BrowserView 使用受管 View 句柄并内部持有对应 Bridge Browser；Browser、反查 View 与 Chrome 工具栏都以可空受管别名返回，释放时按引用计数归还 Browser owner，不暴露 Client、Delegate、CEF 指针或原生地址。V4 创建保持官方 6 个参数位置，当前 Client/Delegate 仅允许空句柄，BrowserSettings 必须是只含 `javascript`、`images`、`webgl` 逻辑字段的受管 Dictionary。Display 全量枚举由独立集合句柄持有 `CefRefPtr<CefDisplay>`，通过计数和按索引取项访问，禁止把 64 位句柄写入 JSON 或 Double；点、矩形、DPI、ID 与旋转使用带版本结构或独立输出值，V4 只接受严格范围参数并由 Bridge 生成 JSON。Layout 保留所属 Panel，ScrollView 校验内容父级，Textfield 校验委托子类型、命令、样式、范围和逻辑值；`read_only` 保留 CEF 用户输入策略而非误判为对象不可变。
>
> DragData 统一使用受管 typed handle，并保留 CEF 允许任意线程调用的真实契约。UTF-16 读取必须走两阶段缓冲；文件名和路径必须返回受管 List，文件内容只能写入受管 StreamWriter，图像只能返回受管 Image，热点使用带 ABI 版本的点结构。全部写入在调用 CEF 前检查只读状态，V4 使用官方签名哈希前 16 位并严格校验目标、参数数量、codec 和空值；HandleRelease 后对象立即失效。
>
> XmlReader 只消费受管 StreamReader，并通过专用 typed handle 固定创建线程；全部读取、游标移动、关闭和最终 HandleRelease 都必须在创建线程执行。显式关闭后禁止继续访问，未关闭对象在创建线程最终释放时自动关闭；文本结果统一 UTF-16 两阶段输出，节点类型、深度、行号和属性数量使用独立输出值，V4 严格校验编码枚举、属性索引、限定名和命名空间空值。
>
> ZipReader 复用创建线程生命周期类别并只消费受管 StreamReader；文件内容必须返回 managedBuffer，C ABI 的独立 `read_result` 与 V4 结果的 `integer_value` 保留 CEF 原始有符号读取结果，EOF `0` 和负错误值不得映射为 Bridge 状态码。文件名两阶段读取，修改时间以 Windows epoch 微秒整数返回，最终释放同样必须在创建线程完成。

> ResourceBundle 必须通过 `managedResourceBundleHandle` 注册、类型校验和 `HandleRelease` 管理；字符串读取使用 UTF-16 两阶段缓冲，`CefBinaryValue` 在 Bridge 内复制到 managedBuffer 后才可返回。未知资源保留成功且空缓冲的 CEF 语义，缩放因子严格限制在 CEF 150 正式枚举范围，禁止把 CEF 二进制值或内部地址直接交给调用方。

> RequestContext 的全局与共享实例、身份/存储关系、网站/内容设置、Chrome 配色和 Scheme 工厂清理统一使用受管上下文句柄。UI 限定设置 API 必须调度到 CEF UI 线程；`CefValue` 输入必须复制、输出必须注册为 managed value，枚举与颜色范围必须在调用 CEF 前验证。观察器、MediaRouter、MediaSource、ResolveHost 与自定义 Scheme 工厂使用各自的受管句柄或任务生命周期，不得以空回调占位计数；MediaSource 的 URN/ID 必须保持 UTF-16，两阶段读取后才能跨 ABI 返回。MediaObserver 的 Sink/Route 向量必须保存在受管 typed collection 中，经 Task 一次性提取；JSON 只能携带 kind/count，禁止把句柄数值嵌入文本。

> Window 与 OverlayController 必须注册为独立 typed handle 并在 `HandleRelease` 管理生命周期，所有公开调用统一调度到 CEF UI 线程。平台 `cef_window_handle_t` 不得跨 ABI 暴露；Bridge 仅在确认原生窗口存在后返回一个受管 Window 别名。拖拽区域的 C ABI 使用带 `struct_size` / `abi_version` 的数组，V4 使用受管 List 中只含 `x`、`y`、`width`、`height`、`draggable` 的字典，禁止透传原始结构指针或脆弱文本解析。Overlay 销毁后 `IsValid` 返回 false，其它需有效对象的操作失败，句柄仍须显式释放。

> LabelButton/Button 继续复用 `managedViewHandle` 和统一 View 失效语义。创建必须提供真实 `CefButtonDelegate`；Bridge 当前使用受控内部 delegate 满足对象创建，不把其空事件面伪装成公开 ButtonDelegate 覆盖。状态和对齐枚举、逻辑值、颜色范围、尺寸及 Image 句柄必须先验证，文本统一使用 UTF-16 两阶段读取，全部方法在 CEF UI 线程执行。
>
> BrowserHost 的 Browser、Client 和平台窗口结果必须转换为受管 typed handle；平台窗口只返回受管 Browser 别名，禁止泄露 `HWND`。Client 使用独立类别、所属 Browser 弱引用、类型校验、关闭失效和 `HandleRelease` 生命周期。DevTools 原始消息只接受 managedBuffer，IME 下划线 V4 只接受严格 List/Dictionary，拖放数据只接受 managed DragData；所有宿主操作统一调度到 CEF UI 线程，异步文件对话框、图片下载和 PDF 打印只通过受管任务完成。图片任务不得把 `CefImage` 或句柄编码进 JSON，只能经一次性提取接口注册 managed Image handle；PDF 路径必须经过允许根目录校验并由 Bridge 安全创建父目录。
>
> Frame 句柄显式保留所属浏览器，浏览器关闭时定向失效；空查询保留“成功 + 空句柄”，文本使用 UTF-16 两阶段缓冲，异步源码/显示文本使用受管任务。Request/Response 头映射、打印页范围和几何数据使用受控结构，拒绝非法范围、字段、句柄类型和释放后访问；负错误码及合法负枚举原样保留。不得暴露 `CefRefPtr`、CEF 指针、原始内存地址或未受控对象；受管流仍受项目允许根目录与 64 MiB 内存上限约束。

> 0.2.9 发布基线：`lingbuilder.wxhook.manager@1.1.1` 最低要求 LingBuilder `0.2.9`，因为该模块依赖源码型 `controlRef(nativeHandle)` 在派生窗口事件中的可访问性和第三方模块随 `.lcpppkg` 离线分发能力。0.2.8 网络模块及 0.2.7 EdgeView、ListView、OpenCV 的既有最低版本契约不变。

> 2026-08-05 补充：`lingbuilder.new_emoji.ui/RichList` 已作为第 93 个 new_emoji 设计器控件接入。当前生成模块包含 1618 个底层导出、718 个属性和 918 个事件映射。RichList 的模板、项目和选中键使用上游 JSON ABI，选择变化回调返回选中 key JSON；项目点击、双击、按钮、徽标、倒计时结束和右键菜单共用 `EU_SetRichListEventCallback`，生成器必须按载荷中的稳定 `event` 字段分流到对应 `.lcpp` 处理器，不能把一次原生通知广播给所有语义事件。上游提交的设计器目录落后于源码时，模块生成脚本只允许在临时目录调用官方 Catalog Exporter 重建，不得修改上游仓库或凭名称猜测 API。

> 2026-08-04 补充：外置模块 `lingbuilder.wxhook.manager@1.1.1` 在 `1.0.1` 多开监控基础上增加版本专属防撤回桥接。顶部总开关默认提交 `enabled=true, showTip=true`，新登录实例自动继承；总开关 Button 的标准 `Click` 事件读取切换后的勾选状态并调用 `微信多开_设置总防撤回`，模块不抢先消费按钮 `WM_COMMAND`。Win32 ListView 头像地址右侧增加自绘 Switch，可异步按实例调用 Host 的 `/api/v1/instances/{id}/anti-revoke`，账号上下文变化时丢弃旧请求。模块继续通过本机 `WxHook.Manager.Host` 与 `WxHook.Agent.dll` 管理微信 `4.1.10.27` 多实例，以 500ms 后台快照投递头像、PID、登录状态、wxid、昵称、头像 URL 和防撤回状态，并过滤 `stopped` 历史记录。模块包同时携带 x64 Host/Agent/SQLite 运行时，令牌只从当前用户 DPAPI 文件读取。项目源码包导出会把已启用第三方模块及运行时复制到 `.lcpppkg` 内的 `.lingbuilder/modules`，接收方可离线导入，不需要官方模块市场；不得退回 `程序_启动` 加伪造登录文本的占位实现。

> 2026-08-04 补充：普通 Win32 生成器的 `controlRef` `stableId/nativeHandle` 转换辅助函数必须对派生窗口事件保持 `protected` 可访问，不能生成到私有区后等待 MSVC C2248。源码型模块的 `wideString` 参数可能来自 `控件_取文本` 等 `std::wstring` 表达式，模块公开 C++ 签名必须兼容动态宽字符串，不得只对字面量可编译。生成窗口继续在首次显示和 `WM_DPICHANGED` 时按真实窗口 DPI 重算外框与控件布局。

> 0.2.8 发布基线：`lingbuilder.net.http-client@2.0.0`、`lingbuilder.websocket.client@2.0.0` 和 `lingbuilder.websocket.server@2.0.0` 的最低 LingBuilder 版本统一为 `0.2.8`。已随 0.2.7 发布的 EdgeView、ListView 和 OpenCV 契约继续保持最低版本 `0.2.7`。

> 2026-08-03 补充：NewEmoji 回调中的 `.lcpp` `调试输出`必须同时进入 `OutputDebugStringW` 和 F5 受控进程的 UTF-8 标准输出；后者由 IDE 的 `run.log` 轮询展示。模块事件回调已注册但控制台无文本时，应先验证生成程序的日志桥接，不能把问题误判为原生回调未触发，也不能在每个控件事件里复制日志代码。

> 2026-08-03 补充：模块设计器事件支持 `parameters[]` 与 `starterStatements[]` 契约。设计器绑定在跳转代码前同步提交到权威项目模型；Monaco、新手编辑器、旧签名迁移、语言诊断和 C++ 回调桥接共用 `moduleDesignerEventService`。NewEmoji Table 的 CellClicked、CellAction、CellEdit、ContextMenu、VirtualRow 以及鼠标事件现传递真实原生参数；VirtualRow 通过 `NE_设置表格虚拟行数据` 和回调内 UTF-8 缓存完成上游两阶段 buffer ABI。旧零参数处理器保持兼容，新建处理器直接生成强类型签名。

> 2026-08-03 补充：NewEmoji ListBox 的 SelectionChanged、ItemClicked、ItemDoubleClicked、Edit、Reorder、ContextMenu 已登记真实回调参数，并由生成器把 ElementText/Value、ListBoxEdit、ElementReorder ABI 映射到 `.lcpp` 变量；进入/离开、焦点事件保持无参，鼠标事件保留坐标、按钮和滚轮参数。模块清单、补全、诊断和 C++ 生成不得为这些有参回调退回空签名。

> 2026-08-03 补充：NewEmoji Tabs 的 `SelectionChanged` 使用 `ElementValueCallback(int element_id, int value, int range_start, int range_end)`，模块清单必须声明 `选中索引`、`项目数量`、`动作` 三个整数参数。生成器按 `EU_SetTabsChangeCallback` 精确映射这三个值，并保留动作编号 1/2/3/4/5/6 的代码设置、鼠标、键盘、关闭、新增、滚动语义；同名的其它控件 `SelectionChanged` 不得复用 Tabs 参数表。带 FBro 子控件的 Tabs 也必须在处理器正文前生成同一组参数声明。

> 2026-08-03 补充：`lingbuilder.new_emoji.ui/Tabs` 的 `headerVisible` 是独立的布尔设计器属性，默认 `true`，由上游 `EU_SetTabsHeaderVisible` Setter 驱动；它不能与固定开启的 `contentVisible` 混用。设计器预览、模块属性面板、F5/原生预览和 Visual Studio 导出必须共同消费该字段，关闭时隐藏表头并让页面内容区占满，旧项目缺少字段时按显示兼容。

> 2026-08-03 补充：`lingbuilder.net.http-client@2.0.0` 已完成 74 条受管命令的原生闭环。共享 `httpClientRuntime.ts` 使用 WinHTTP 管理客户端/请求生命周期、超时、代理、凭据、TLS 证书固定、Cookie、自动解压、重定向、响应/上传资源上限、文本/JSON/二进制/文件传输和响应快照；普通 Win32 通过 `WM_LINGBUILDER_HTTP_CLIENT_EVENT`，new_emoji 通过独立消息窗口投递同一完成处理器协议。所有 `.lcpp` 处理器继续使用 `&处理器名`，旧 `HTTP客户端_请求/GET/POST/取状态码/取响应文本/取错误/清空状态` 入口委托到受管默认客户端，不破坏旧源码。模块演示与 `electron/docs/modules/http-client/README.md` 已同步，生成回归覆盖 Win32、new_emoji、无模块隔离和贡献/binding 一致性；`npm run smoke:http-client-native` 已用本地 HTTP fixture 真实编译 Win32/x64 与 new_emoji x64 并验证 200/UTF-8 响应。

> 2026-08-02 补充：`lingbuilder.system.clipboard@1.1.0` 已从文本读写的 4 条基础命令扩展为 10 条完整剪贴板命令。图片字节集使用生成工程内部的 `std::vector<unsigned char>`，静态图片支持 DIB/DIBV5 与 BMP 文件字节；GIF87a/GIF89a 通过注册的 `GIF`、标准 MIME `image/gif` 和 `HTML Format` 原样写入，`剪贴板_取GIF字节集` 和通用图片读取均优先保留原始动图，避免动画帧被转换为静态 DIB。每个图片/GIF 输入限制 256 MB，Win32/x64 生成测试覆盖 GIF 注册、MIME GIF、CF_HTML 偏移、DIB 和 `CF_BITMAP` 转换。

> 2026-08-01 补充：`lingbuilder.input.mouse@2.0.0` 由 `mouseApiCatalog.ts` 统一维护 29 条命令，固定分为“全局真实输入（前台）”（15 条）、“窗口消息输入（后台）”（6 条）和“UI Automation（后台）”（8 条）。每条 contribution/binding 描述都以范围标签和“是否占用系统鼠标”说明开头：`GetCursorPos` 查询不移动光标，`SetCursorPos`/`SendInput` 会改变真实光标或进入系统鼠标输入流；指定 HWND 的 `PostMessageW` 只投递 `WM_MOUSE*` 消息，不移动光标、不抢前台；UI Automation 通过 `IUIAutomation` 的 Name/AutomationId 查找和 Invoke/Value/Toggle/Focus Pattern 按控件语义操作，不模拟鼠标。UIA 元素以模块内受管整数句柄保存，生成的 Win32/new_emoji 工程在 `CoUninitialize` 前统一清理 COM 引用；Win32/x64 生成测试覆盖 `UIAutomation.h`、`uiautomationcore.lib`、`PostMessageW` 和三类绑定。模块不公开 `BlockInput` 或裸 COM 指针，窗口消息和 UIA 目标仍可忽略、过滤或因权限隔离失败。

> 2026-08-01 补充：`lingbuilder.input.keyboard@2.0.0` 现由 `keyboardApiCatalog.ts` 统一维护 31 条命令，按全局状态、键码转换、前台 `SendInput`、指定 HWND 后台 `PostMessageW` 和 1.x 兼容入口分类。每条 contribution 均明确标注前台/后台、焦点语义和实体键盘影响。前台组合键使用批量输入并在失败时尝试释放修饰键；后台命令只投递消息，不抢焦点、不改变物理键状态且允许目标忽略。模块不公开 `BlockInput`、低级键盘钩子或隐藏按键记录。Win32/x64 原生验收使用 `npm run smoke:keyboard-native`，不会向用户桌面注入按键。

> 2026-08-01 补充：`lingbuilder.threading@2.0.0` 已升级为项目级受管并发模块，由 `threadingModule.ts` 单一目录生成 54 条命令和 7 个公开类型。manifest v2 新增受校验的 `lingValue` 末尾可变参数与 `managedTask` invocation 元数据；语言服务校验任意多参数深拷贝、工作/进度/完成签名和线程安全边界，生成器输出类型化 C++17 lambda。项目运行时统一管理默认/自定义有界线程池、十万任务上限、窗口 owner、协作取消、80ms 进度合并、互斥锁、原子整数、事件和信号量；Win32 `PostMessageW` 只承担 UI dispatcher 通知。旧 9 条演示命令不兼容删除并提供阻断迁移诊断，禁止裸线程、裸句柄、强杀、挂起/恢复、DLL 注入和跨线程 `controlRef`。

> 2026-08-01 补充：模块公开信息中的 `contributes.docs[]` 已接通 IDE 内文档阅读器。选中文档后通过 `/api/modules/document` 读取并渲染 Markdown，普通 UTF-8 文本以源码形式预览；读取服务只接受当前模块清单已声明的相对路径，并以真实路径校验阻止目录越界和符号链接逃逸。单份文档上限为 1 MB，原始 HTML、未声明相对链接和远程图片不会直接执行或加载；内置模块文档从受控工作区资产或打包资源根解析。`lingbuilder.threading` 已登记随包中文说明，作为内置资源文档参考实现。

> 2026-08-01 补充：`lingbuilder.system.disk@1.1.0` 已从 5 条基础命令扩展为 28 条只读命令和 8 个公开记录/数组类型。模块统一覆盖精确容量、逻辑驱动器、全部卷、卷 GUID/挂载点、文件系统标志、物理磁盘描述、总线、SSD/TRIM、逻辑/物理扇区及 MBR/GPT/RAW 分区布局；原 5 条命令继续兼容。结构化命令 binding 可以引用本模块 `contributes.types[]`，生成工程内部映射为 `struct/std::vector`；带原生 DLL runtime 的 target 仍被清单门禁禁止直接传递结构化类型。Win32/x64 均通过真实 MSVC 编译运行。

> 2026-08-01 补充：`lingbuilder.win32.common-controls` 已用公开命名数组承接 ListView 行数据：`列表视图行` 映射 `std::vector<std::wstring>`，`列表视图行集合` 映射嵌套 vector；`列表视图_创建行/创建行集合` 负责从标量构造值，添加、插入、批量添加和虚拟行设置直接消费结构化数组。旧 Tab/TSV 文本重载继续兼容，但新手/Monaco 与 AI 默认生成结构化写法。该能力属于生成工程内部 C++ 值语义，不允许据此跨 DLL 传递 STL；源码包必须声明 `win32.listview.structured-rows.v1` 和最低生成器 0.2.7。

> 2026-08-01 补充：manifest v2 的 `contributes.types[]` 已向后兼容扩展为 `opaque`、`record`、`array` 三类。旧类型省略 `kind` 时继续按不透明类型处理；`record` 使用结构化 `fields[]` 公开 LingCpp 值语义字段，`array` 使用 `elementType` 公开命名数组。启用模块后，语言服务、Monaco/新手补全、模块公开信息、项目数据类型嵌套和普通 Win32/new_emoji C++ 生成消费同一公开类型服务；记录生成真实 `struct`，数组确定性映射为 `std::vector<T>`。结构化类型禁止填写 `cppType` 绕过契约，原生 DLL 仍不得直接跨边界传递 STL 或未固定布局的 C++ 对象，复杂原生数据必须继续使用 POD、缓冲区、任务或受管句柄适配。

> 2026-07-31 最新补充：CEF3 模块管理与解决方案资源管理器改为“用户侧单入口、内部多清单”。用户侧只显示 `lingbuilder.cef3.browser`，`events/session/transfer/objects` 与核心组成标准功能集合并可原子启用；`automation/network/devtools/views/platform` 在模块详情中作为高级功能按需启停；`lingbuilder.cef3.sdk` 与内部子模块不再平级展示。详情页按基础、事件、会话、下载与传输、对象、自动化、网络、开发者工具、视图、平台十个功能域聚合全部公开能力，模块搜索和解决方案搜索仍会命中子模块名称、中文命令、官方别名、类型与设计器控件。内部 v2 manifest、依赖解析、补全、诊断、binding、原生 Bridge 与 C++ 生成继续使用原始模块 ID，不合并清单或运行时。

> 2026-07-31 最新补充：`lingbuilder.fbro.vip` 已完成官方 VIP 覆盖目录 188/188，模块内 `planned=0`。188 项官方能力已逐项生成 contribution 与 binding，包括 179 条单项安全命令、6 条 Bridge 自动管理能力和 3 条凭据中心/安全入口替代能力；原 10 条聚合命令继续保留为“批量与通用高级入口”，因此模块清单共 198 条记录。普通 Win32 与 New_Emoji 会生成同一套 188 项运行时包装器，两种真实生成工程均已通过 MSVC x64 编译，New_Emoji 工程还完成了 10 秒运行烟雾测试。模块详情搜索会忽略空格、下划线与常见连接符，`DOM取文档`、`安装CRX`、`GPU厂商` 可直接定位单项命令。资源二进制只接受受管缓冲句柄，扩展/替换文件限制在生成程序目录，回调结果复制为 UTF-16 JSON。全 FBro 目录最新为 397 `implemented`、678 `planned`、3 个内部 `notApplicable` 和 1 个高级替代 `notApplicable`，所以只能宣称 VIP 子模块完成，不能宣称 FBro 全功能完成。

> 2026-07-31 补充：FBro 模块管理改为“用户侧单入口、内部多清单”。模块管理器与解决方案资源管理器只显示 `lingbuilder.fbro.browser` 一个 FBro 入口，`events/session/transfer/objects` 作为标准功能集合原子启用，`automation/network/vip` 在详情页中以高级功能开关显式启停；`lingbuilder.fbro.sdk` 和内部子模块不再作为平级用户模块展示。详情页按基础、事件、会话、下载与传输、对象、自动化、高级网络、VIP 指纹聚合浏览全部公开能力；接口树以功能域为直接父节点，命令不再经过额外“命令接口”层，分类计数只统计命令，类型、控件和构建信息作为分类内辅助信息展示。内部 v2 manifest、依赖解析、补全、诊断、binding 和 C++ 生成仍使用原始模块 ID，不引入第二套命令定义或合并运行时。

> 2026-08-06 补充：CEF 150 安全全覆盖工程处于 `3.0.0-alpha.3`。覆盖 v2 扫描 287 个 SDK 头并登记 1577 项能力记录；当前为 505 `implemented`、8 `internal`、185 `notApplicable`、879 `planned`，64 个内部/测试头和 185 项公开测试脚手架等不适用记录按理由保留。objects、session 和 CommandLine 已清零各自 `planned`；浏览器状态、窗口渲染、网页全屏查询与退出、CefBrowserView 承载状态查询、打开者浏览器 ID 查询、关闭准备与优雅关闭、渲染进程响应、运行时样式、当前与默认缩放级别读写、缩放命令可用性查询与执行、窗口移动/调整大小通知、屏幕信息变化通知、捕获丢失输入通知、输入法组合取消与提交、自定义拼写词典写入、当前拼写错误替换、系统拖放源结束通知、拖放目标离开通知、OSR 宿主隐藏状态通知、键鼠输入、焦点、查找、JSDialog、ContextMenu、音频、权限、文件对话框和跟踪回调均通过 Bridge、中文命令/事件和固定目录接入。ContextMenu 批次真实右键触发显示前、运行、命令和关闭回调，并一次性复制 20 项临时参数字段；Run/QuickMenu callback 只接收结构化命令 ID 与事件标志，不跨 ABI 暴露 CEF 对象。用户事件目录为 92 项名称，对应 113 / 113 个官方事件签名已实现；其它 network/transfer/automation/OSR/Views/platform 能力保持 `planned`。生成应用只包含/链接 `LingBuilderCefBridge`，`planned` 或 `needsReview` 未清零前禁止发布 3.0.0。

> 2026-08-01 补充：FBro 模块族统一升级为 `2.1.0`。核心与 `events/session/transfer/automation/objects/network/vip` 七个子模块继续使用递归依赖、CEF3 冲突检查和原子级联启停；英文别名、中文主名和旧事件别名共同参与补全、诊断、稳定事件 ID 解析和 C++ binding。旧项目中的 `Created`、`LoadEnd`、`BeforePopup` 等处理器键会迁移到同一规范事件，不丢失现有处理器。

> 2026-08-01 补充：`LingBuilderFbroBridge` 主事件协议升级到兼容 C ABI v3，同时保留全部 v1/v2 导出。v3 增加 `LB_FBRO_EVENT_PACKET_V3`、`LB_FBRO_EVENT_RESPONSE_V3`、`LB_FBro_SetEventCallbackV3`、按浏览器与事件订阅、受管延续完成/取消和不限于 v2 固定返回缓冲的 UTF-16 JSON 响应。普通通知异步投递，即时决策默认 2 秒；安全/认证/权限、查询/消息路由、文件/对话框/下载延续默认分别为 5、30、120 秒。延续超时由 Bridge 单一受管计时线程执行，浏览器关闭和 Shutdown 会取消未完成句柄。

> 2026-08-01 补充：事件目录按“所属类 + 方法名 + 完整签名”登记 174 个类方法槽位、158 个唯一签名，覆盖 `FBroHsBroEvent` 90 项、`FBroHsInitEvent` 31 项和其余适配器 53 项；当前事件目录 `planned=0`、`needsReview=0`。每个槽位都有真实 override 或明确的 `managed/internal/notApplicable` 分类、字段/响应 schema、线程/所有权和测试。普通 Win32 与 New_Emoji 共用同一目录与 v3 协议，高频事件按订阅和采样率限流。`module:fbro-events:complete` 同时检查目录、override/schema/测试以及已安装 SDK 的头、导入库和 Bridge DLL，防止源码与安装模块 ABI 漂移。

> 2026-08-05 补充：CEF3 与 FBro 已新增面向用户的统一“事件与接口参考”，分别位于 `electron/docs/modules/cef3/README.md` 和 `electron/docs/modules/fbro/README.md`，并登记到核心模块详情。`electron/scripts/generate-cef3-fbro-event-docs.ts` 直接消费事件目录、安全覆盖目录和 `BUILTIN_MODULES`：CEF3 当前生成 92 项事件名称、113 条官方事件签名与 346 条用户接口；FBro 生成 89 项公开事件、85 项托管/内部分类和 417 条用户接口，并排除 9 条内部命令。修改对应事件源或 manifest 后必须运行 `npm run module:cef3-docs` / `module:fbro-docs`，提交前再运行各自 `:check` 命令；禁止手工维护第二份名称或接口清单。

> 2026-08-01 补充：FBro 覆盖目录继续以 wrapperSymbol、稳定 overloadId、参数/返回 codec、线程、同步方式和所有权为确定性规范。事件安全全覆盖完成不等于整个 1079 项 API 全功能完成：当前全目录仍为 397 `implemented`、678 个非事件高级签名 `planned`、3 个内部 `notApplicable` 和 1 个高级替代 `notApplicable`。Frame visitor、完整公开 V8、正式 OSR 设计器和其余高级网络/对象 API 保持独立工作流。FBro 5.38.49 的阻塞文件对话框辅助导出继续由独立 STA `IFileDialog` 安全替代；可视 Basic Auth 登录 UI 未经过预期 `GetAuthCredentials` override，测试改用无交互资源请求延续验证 30 秒超时，不得伪造认证账号或声称真实登录弹窗回调已通过。

> 2026-07-31 补充：官网命令资料支持从模块 v2 manifest 同步。`electron/scripts/export-website-command-manifests.ts` 会从实际 `BUILTIN_MODULES` 导出 `.lingbuilder/website-command-manifests.json`，命令为 `cd electron && npm run module:web-docs`。官网后台按 `模块 ID + 命令名` 稳定更新 contribution/binding 资料；重新同步时，清单中不再存在的旧模块命令标记为 `DEPRECATED`，不静默删除历史资料。该导出只读取模块清单，不建立第二套命令定义来源。

> 2026-07-31 补充：官方收费模块发布改为云端受保护制品链路。管理后台上传 `.lbmod` 后，API 校验安全 ZIP 路径及 v2 manifest 的模块 ID/版本，计算 SHA-256，并使用与 Permit 相同的稳定 Ed25519 信任根签名制品元数据；IDE 必须先验权、再验签和下载哈希，最后复用 `ModuleService.previewPackageInstall -> installPackage` 完成可确认、可回滚的安装或更新。公开安装包明确排除 `lingbuilder.new_emoji.ui`，匿名商品目录已取消。新增官方收费模块时必须同步发布过滤规则，不能把二进制放回默认工作区。

> 2026-08-05 补充：仓库的清单驱动全模块演示生成器 `electron/scripts/generate-module-demos.ts` 已按当前 `BUILTIN_MODULES` 与已安装外置模块重新生成 86 个独立演示项目，覆盖 4233 条命令。命令较多时最多使用 12 个 TabControl 页面分组，并通过“允许实际执行”开关避免网络、文件、进程、驱动等调用被误触发。演示源码位于 `examples/module-demos/`，可分享包统一以中文模块名称导出到 `exports/`。新增或删除模块、命令后应运行 `cd electron && npm run module:demos`；只更新一个模块可使用 `npm run module:demos -- --module <模块ID>`，并以 `npm run module:demos:verify:deep` 对全部源码包做解压、哈希、模块引用和启动项目校验。

> 2026-07-30 补充：LCPP 源码包对只读原生资产的自动携带范围包含 CEF3、FBro 与密码学 SDK。启用 `lingbuilder.crypto.hash/password/symmetric/asymmetric` 中任一模块时，导出服务必须自动携带 `lingbuilder.crypto.sdk`，与 CEF3/FBro 消费模块使用同一隔离打包逻辑，避免源码包在作者机器可构建、导入后因缺少 Botan/BLAKE3 资产失败。

> 2026-07-30 补充：默认启用的 `lingbuilder.win32.basic` 新增占位符命令 `格式化文本(格式模板, 参数...)`。命令按从左到右顺序以文本、整数、长整数、小数和逻辑值替换 `{}`，`{{` / `}}` 输出字面量花括号；参数不足时保留剩余 `{}`，多余参数忽略。该命令的 contribution、v2 binding、新手/Monaco 补全、普通 Win32 运行时、new_emoji 运行时与后端命令契约必须保持同源，不能只在编辑器中模拟格式化结果。

> 2026-07-30 补充：`lingbuilder.win32.common-controls` 的 ListView 已形成普通模式与 `LVS_OWNERDATA` 虚拟模式的同源命令闭环。普通模式支持添加/插入/删除行、单元格读写、行数、批量 TSV、重绘事务和排序；虚拟模式必须由设计器 `virtualMode` 创建期属性开启，再使用 `列表视图_设置虚拟行数/设置虚拟行` 管理内存数据，并由 `LVN_GETDISPINFOW` 按需显示。`contributes.commands`、`bindings.commands`、控件成员补全和 C++ 运行时必须继续同步，禁止只增加补全或在 React 预览中模拟数据方法。

> 2026-07-30 补充（2026-08-01 扩展）：ListView 公开面现为 87 条高层命令。16 条数据/虚拟/类型化行命令保留在内置模块；71 条 Win32 高级命令必须统一由 `electron/src/services/modules/listViewApiCatalog.ts` 产生 contribution 与 binding，语言服务和 C++ 生成测试按目录全量枚举，不再手工复制多份命令表。原始指针/回调型 `LVM_*` 能力必须通过原生模块提供类型安全包装，不得在 DSL binding 中暴露任意地址或通用 `SendMessage`。

> 2026-07-30 补充（2026-08-01 扩展）：LCPP 源码包清单版本 2 会按实际 `.lcpp` 调用记录生成器能力。使用 71 条 ListView 高级命令的包写入 `win32.listview.advanced-api.v1`；使用类型化行构造器的包写入 `win32.listview.structured-rows.v1` 并要求最低生成器 0.2.7。导入时若当前 IDE 不具备对应能力，必须在编译前给出明确升级诊断，不得继续生成 C++ 后再暴露 `C3861`。

> 2026-07-30 DataGrid 对齐补充：结构化列模型的 `alignment` 只允许 `left/center/right` 且默认 `center`；设计器、预览、`表格_设置列对齐` binding 和 Win32 C++ 运行时必须消费同一字段，不能只在 React 预览中模拟。

> 2026-07-30 补充：新版 IDE 对 v1 `.lcpppkg` 保留兼容导入路径；旧包缺少能力字段时，必须从包内 `.lcpp` 重新计算所需能力并规范化为 v2 内存清单，不能因为清单旧就误拒绝可迁移的项目。

> 2026-07-28 补充：New_Emoji 92 个设计器控件必须用模块命名空间 `designerType: lingbuilder.new_emoji.ui/<Control>` 判断后端支持能力，不能只看为设计器兼容而使用的 `TabControl`、`ListView`、`TreeView` 等基础类型。模块命名空间控件已由 `runtime.createFunction` / Setter 映射生成真实 `EU_*` 调用时，不得再输出“不会生成”的矛盾诊断。设计器读取模块贡献应使用紧凑的项目设计器上下文，避免加载与画布无关的 1500+ binding 和二进制依赖元数据；模块服务暂时不可用时采用有界重试，不能永久回退到只有 Win32 基础控件。

> 2026-07-28 补充：`lingbuilder.new_emoji.ui/ListBox` 的创建期“简单项目”和可选状态 Setter 必须按原生破坏性语义生成。`EU_CreateListBox` / `EU_SetListBoxItems` 负责静态简单项目；只有 `listBoxItemsEx` 存在非空项目时才调用 `EU_SetListBoxItemsEx`。空 `selectedKeys` 不得覆盖 `selectedIndex`，`virtualItemCount <= 0` 不得调用 `EU_SetListBoxVirtualItemCount`，因为上游这两个 Setter 会分别重置选择和清空普通项目。高级项目用于确实需要 key、父级、分组、描述等 TSV 字段的项目，不能把空默认值作为一次运行时清空操作无条件发出。

> 2026-07-28 补充：`lingbuilder.new_emoji.ui/Tabs` 已按真实分页容器接入。模块清单必须使用 `previewType: TabControl`、`isContainer: true` 和 `layout.mode: slots`；设计器以稳定页面 ID 保存槽位，同时兼容旧项目中 `type: Grid + designerType: .../Tabs + items[]` 的模型。Tabs 属于分页容器，画布渲染必须优先走 `TabControlDesignerPreview` 并读取真实 `tabs/items`、选中页、`headerAlign` 和页面槽位，不能被 New_Emoji 通用控件预览截获后显示写死的示意标签。`headerAlign` 的上游语义是每个统一宽度标签内部的文字对齐，不是整组标签在标签栏中的位置；水平标签宽度应复用原生规则：4 项以内为 `max(72, 可用宽度/数量)`，更多项目为 `max(72, min(152, 可用宽度/数量))`，超出后从左排列并裁切/滚动。模块属性行的“恢复默认”操作不得覆盖下拉框、输入框或文件选择按钮的交互区域；透明状态必须停止鼠标命中。原生生成器固定开启 Tabs 内容区，为每个标签生成与 Tabs 同级、覆盖内容矩形的独立 `Panel` 元素，并把页面内控件挂到对应 Panel，最后通过 `EU_SetTabsPageElements` 绑定切换显隐。页面 Panel 不得作为 Tabs 子元素创建，因为上游 Tabs 自绘不会遍历绘制子元素；页面 Panel 还必须显式使用无边框、0 圆角样式。绑定外部页面时，`ItemsEx` 的内置内容字段必须为空白，避免高 DPI 下页面起点差异露出 Tabs 自绘内容。也不得仅把控件高度交给关闭内容区的 Tabs，否则整个高度会被当成标签头。

> 2026-07-28 补充：Win32 基础模块新增可确定性生成的 `到文本(值)`，覆盖整数、长整数、小数、逻辑值和文本，并由普通 Win32 与 new_emoji 后端共同实现。`lingbuilder.std.encoding` 扩展为 30 条命令，覆盖 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030 双向转换、通用编码转换、BOM 处理及保守检测。由于当前 LingCpp 没有公开字节数组类型，编码后的原始字节统一以无空格大写十六进制文本跨越命令边界，禁止把任意字节伪装成 Unicode 文本。

> 2026-08-07 补充：`lingbuilder.fbro.browser@2.2.0` 新增 `in-process`、`independent-embedded`、`independent-window` 三种 `processMode`。两种独立模式都实行“一浏览器一 Host 进程”，由 `LingBuilderFbroProcessRuntime.hpp` 在随机回环端口建立 WebSocket 控制通道，使用仅经环境变量注入的一次性 256 位 Token 鉴权，并维护实例 ID、PID、连接、CDP 端口和进程代次映射。核心远程命令覆盖导航、JS、缩放、静音、代理、指纹、显隐、大小、截图、关闭、状态查询和受限重启；主进程退出由 Job Object 回收 Host，崩溃重启按 1/2/4 秒退避且十分钟最多三次。每个 Host 必须使用独立 CEF 根缓存和日志目录，new_emoji 后端必须非阻塞启动 Host，并在真实 `Created` 事件到达后按保存的 Tabs 索引同步 HWND 显隐，禁止在主消息循环前串行等待或只用 PID 作为显示成功依据。普通 Win32 与 new_emoji 生成器、F5、AI Bridge 和 VS 导出必须复用该运行时，禁止另建未鉴权的浏览器控制通道。

> 2026-08-07 兼容补充：CEF3 的 CEF 150 只与 FBro `in-process` 的 CEF 135 冲突。项目同时启用二者时，生成器只在仍存在进程内 FBro 控件时阻断；全部 FBro 控件为独立模式则允许共存。原生依赖服务和 VS post-build 必须启用 FBro `HostOnly` 物化：主 exe 目录保留 CEF3 Bridge/CEF 150，`fbro-host/` 独占 FBro Bridge/CEF 135 及其资源，不能让任一 `libcef.dll` 覆盖另一版本。独立模式尚未远程化的 Frame、Cookie、受管对象和 VIP 高级入口必须继续标明进程内边界。

> 2026-07-28 补充：FBro 同时支持内嵌 Alloy Runtime 和谷歌原生 Chrome Runtime。内嵌实例继续遵守“一控件一个宿主 `HWND`”；`FBro_打开谷歌原生UI浏览器` 则通过 C ABI `LB_FBro_CreateChromeUi` 只接收所属浏览器的整数句柄与 URL，不接收 LingBuilder `HWND`。桥接层固定设置空 `parent_window/window`、`WS_EX_APPWINDOW`、`WS_OVERLAPPEDWINDOW` 和 `CEF_RUNTIME_STYLE_CHROME`，让 FBro/CEF 自行创建桌面顶层窗口；这里的无句柄指调用契约不提供宿主句柄，不代表 Chrome 创建后不存在系统 HWND。Chrome UI 实例必须单独跟踪错误/关闭事件，不能覆盖内嵌实例状态，所属窗口销毁时必须统一关闭。

> 2026-07-28 补充：FBro 浏览器创建必须统一投递到 CEF UI 线程。`LB_FBro_CreateEx` 只登记 C ABI 句柄和宿主 `HWND`，CEF 已就绪时使用 `CefPostTask(TID_UI, ...)` 创建；初始化尚未完成时由 `OnContextInitialized` 在同一线程启动待创建实例，禁止根据启动时序随机在 Win32 主线程直接调用 `FBroHsCreate`。每实例 `CefRequestContext` 的 profile 必须是全局 `.fbro-global-cache` 的直接子目录；旧相对路径、嵌套路径和根目录外绝对路径由桥接层稳定映射到隔离子目录，避免 Chromium 拒绝 profile 后静默降级。原生测试必须同时验证窗口响应、页面加载以及日志中不存在 `cache_path`、`root_cache_path`、`Cannot create profile`。`OnBeforePopup` 必须同步取消新窗口，并以 `BeforePopup` 事件把目标 URL 投递给当前控件的 LCPP 处理器，支持单窗口接管导航。

> 2026-07-28 补充：FBro 尺寸同步位于 Win32 主消息循环，不得阻塞等待正在 `FBroHsCreate` 的 CEF UI 线程。桥接层必须使用非阻塞锁并在竞争时跳过本次调整；只移动宿主的直接子 `HWND`，禁止通过 `EnumChildWindows` 递归缩放 Chromium 内部窗口。

> 2026-07-28 补充：包含导航栏的 FBro 示例必须将后退、前进、刷新、地址栏、导航按钮和浏览器宿主作为一个 DPI 自适应布局。所有坐标、尺寸、最小客户区和工具栏高度统一按 `窗口_取事件DPI()` 换算，避免初始缩放坐标与 `WM_SIZE` 的未缩放坐标混用。

> 2026-07-28 补充：Win32 基础模块新增确定性命令 `控件_设置位置大小`，使用客户区像素坐标移动并调整真实控件 `HWND`；FBro/CEF/Edge 浏览器宿主改变后还必须刷新内部浏览器子窗口。new_emoji 后端通过 `EU_SetElementBounds` 提供等价实现，并继续纳入后端命令契约与符号回归测试。

> 2026-07-28 补充：FBro VIP Key 属于 IDE 用户凭据，不属于项目或模块配置。“设置 → 浏览器凭据”通过 Electron `safeStorage` 保存到当前 Windows 用户目录，renderer 只接收配置状态而不接收已保存明文；本地服务收到 Key 后立即从自身全局环境移除，只在启动 FBro 生成程序时构造专用子进程环境。AI Bridge 由主进程在新启动时注入，已运行实例需停止后重启。环境变量仅保留为无人值守和导出工程兼容入口。桥接层会保存并脱敏 FBro SDK 的授权失败信息；正常退出必须执行 `FBroShutdown(FALSE)` 并等待 `OnBeforeClose`，自动测试禁止直接强杀进程。

> 2026-07-27 补充（2026-08-07 更新）：新增内置 `lingbuilder.fbro.browser` 与只读二进制资产模块 `lingbuilder.fbro.sdk`。启用浏览器模块后，工具箱“媒体”分类显示 `FBro指纹浏览器 (FBroBrowser)`，可像 CEF3 一样拖入任意可视化窗口；每个实例生成独立宿主 `HWND`、profile/cache 目录及事件投递。生成程序只链接预编译 `LingBuilderFbroBridge.dll` 的稳定 C ABI，不跨 DLL 暴露 STL、`CefRefPtr` 或 FBro 对象。该模块只支持 `windows-msvc-x64`；进程内模式仍拒绝其它版本 `libcef.dll`，两种独立 Host 模式则按上述 `HostOnly` 规则允许与 CEF3 共存。F5、原生构建、AI Bridge 和 Visual Studio 导出复用 `nativeDependencyService.ts` 的同一 SHA-256 物化链路，首次复制 CEF 135.0.21 的 78 项运行时，后续只修复缺失或损坏项并保留 `locales/` 等相对目录。

> 2026-07-27 补充：原生 UI 模块的后端命令能力统一通过 `electron/src/services/windowDesigner/uiBackendCommandContract.ts` 中的 `NativeUiBackendCommandContract` 注册。契约按模块 v2 `bindings.commands` 判断支持范围；普通 Win32 与 new_emoji 是首批实现，后续 Qt、wxWidgets 或其它 UI 库必须注册独立后端 ID 和命令契约，并补齐原生布局生成器后才能开放构建。后端不兼容命令、未知契约和缺失布局生成器必须在生成 C++ 前阻断，禁止静默回退为 Win32 或等到编译器报告未定义标识符。后端无关模块运行时可复用；依赖 `LingWindowBase`、专属 HWND/消息上下文的模块必须显式标为不支持或提供该后端适配层。

> 2026-07-27 补充：new_emoji 设计器生成程序必须在控件创建和窗口“创建完毕”处理器执行完成后、进入 `NE_运行消息循环` 前调用 `NE_显示并激活窗口`。该桥接负责恢复、刷新、临时提升层级后立即取消置顶，并请求前台、激活与焦点；受 Windows 前台锁限制时临时用 `AttachThreadInput` 连接当前线程与原前台线程，完成后必须立即分离。该流程解决 IDE/F5 后台启动时只有任务栏按钮而窗口被压在 IDE 后方的问题；不得通过修改用户 `.lcpp` 或让窗口永久置顶规避。

> 2026-07-27 补充：`contributes.designerControls[].events[]` 与 `runtime.eventBindings[]` 可用 `aliases` 声明历史或预览事件键。生成器必须先匹配规范 `eventName`，再按别名兼容旧项目；设计器新建绑定仍保存规范事件名。new_emoji 使用该机制兼容通用按钮的 `Click` 与原生目录的 `Clicked`，不得因键名差异静默省略回调注册。

> 2026-07-27 补充：`contributes.designerControls[].runtime` 支持结构化 `createParameters`、`propertySetters`、`propertyCommands` 与 `eventBindings`。new_emoji 生成器必须从上游设计器目录和导出签名生成这些映射，属性面板只公开存在确定性运行时落地的项；组合 Setter 参数可声明固定 `literal`，共享鼠标/焦点回调可用 `eventCode` 聚合到一个原生回调，禁止同一 Setter 被后注册的事件静默覆盖。

> 2026-07-27 补充：外部模块同时声明 `windows-msvc-win32` 与 `windows-msvc-x64` 时，生成到 `main.cpp` 的 `#pragma comment(lib, ...)` 必须使用 `_WIN64` 条件分支选择对应 target；Visual Studio 工程和原生依赖物化仍按当前构建架构精确选择。禁止 x64 工程因默认 `targets[0]` 再引用 Win32 `.lib`，双架构模块生成测试必须覆盖两个库路径。

> 2026-07-24 补充：内置 `lingbuilder.win32.common-controls` 已注册 `VideoPlayer` /“视频播放器”控件。该控件的 Media Foundation 依赖声明为 `mfplat.lib`、`mfplay.lib`、`mfuuid.lib`，中文播放命令同时存在于 `contributes.commands` 与 `bindings.commands`；设计器、语言服务和 C++ 生成器必须继续从同一模块清单消费这些定义。

> 2026-07-25 补充（2026-07-31 已由 3.0 alpha 取代部分约束）：新增内置 `lingbuilder.cef3.browser`（CEF3浏览器模块），按 v2 `contributes.designerControls` 注册 `CefBrowser` /“CEF3浏览器”可视控件（`nativeAdapter: cef3-browser`，依赖 `libcef.lib`、`libcef_dll_wrapper.lib`）。控件支持多实例、属性面板 `url`/`cacheDir`/`userAgent`/JavaScript/图片/WebGL/代理配置；兼容核心现为 22 条命令。CEF3 SDK 由 `nativeDependencyService.ts` 受控发现复制；同 exe 共享 Chromium 进程，但缓存和 RequestContext 已改为每控件隔离。

> 2026-07-26 补充：新增 CEF3 内核 SDK 离线载体模块 `lingbuilder.cef3.sdk`（x64），这是首个“纯二进制资产模块”参考实现：v2 manifest 只有基础字段（无 commands/designerControls/targets），安装到 `.lingbuilder/modules/lingbuilder.cef3.sdk/` 即生效，无需为项目启用；`findCef3SdkRoot` 新增该路径候选。打包脚本为 `electron/scripts/generate-cef3-sdk-module.cjs`（`npm run module:cef3-sdk -- --install`），把 CEF 官方包 `include/Release/Resources` 与预编译 /MD `libcef_dll_wrapper.lib` 打成 `cef3-sdk-x64.lbmod`（实测 184MB，版本自动读 `cef_version.h`）；为此 `moduleService.ts` 的 `.lbmod` 包上限从 100MB 放宽到 1GB。用户安装该模块后构建 CEF3 项目免下载 SDK、免 CMake 编译。

> 2026-07-26 补充：CEF3 SDK 已纳入 Windows 发布强制门禁。`electron/scripts/verify-cef3-release-sdk.cjs` 以源 SDK 的完整路径/大小/CRC32 清单为基准；Electron Builder 的 `beforePack`、`afterPack` 和 NSIS 后置校验分别验证源目录、`win-unpacked` 与最终安装包。任何缺失、损坏、版本不一致、非 x64 产物或归档漏项都会让 `package:dir` / `package:win` 非零退出。修改默认模块复制位置、`extraResources`、CEF SDK 结构或发布脚本时必须同步更新校验器和测试，禁止绕过门禁发布。

> 2026-07-26 补充：`lingbuilder.cef3.browser` 事件模型升级为集中式 92 项 CEF 150 浏览器回调目录，定义在 `electron/src/services/modules/cef3BrowserEvents.ts`。`win32ControlRegistry`、内置模块 manifest、设计器事件面板与 C++ 生成器必须消费同一目录；不得重新维护局部事件列表。普通通知、同步决策和高频事件必须区分：同步决策通过窗口线程桥返回 `默认/允许/拒绝/已处理`，高频音频与进度回调必须限流。离屏渲染 `CefRenderHandler`/无障碍像素事件只属于未来独立 OSR 控件，不属于当前 windowed `CefBrowser`。

> 2026-07-26 补充：原生依赖计划可以声明最低 C++ 标准和动态 CRT 要求。CEF3 固定要求 C++20 与 `/MD`，该要求必须同时进入 F5、AI Bridge 和 Visual Studio 工程导出；不得再以“需要动态 CRT”间接猜测语言标准，也不得让 `.vcxproj` 回退为 `stdcpp17`。使用预编译 `/MD` wrapper 的 Debug 配置保留优化关闭、PDB 和链接调试信息，但必须用 `NDEBUG` 而非 `_DEBUG`，避免主程序产生 Debug CRT 外部符号。

> 2026-07-26 补充：当前随附 CEF 150 SDK 只提供经验证的 x64 产物。启用/安装并启用 `lingbuilder.cef3.browser` 时，`BuildConfigurationService` 必须把工作区架构切换为 x64；F5 和受控解决方案构建前必须再按项目已启用模块校正。这个构建兼容策略属于服务层，不得只在 React 控件中修改状态栏文字。

> 2026-07-26 补充：Visual Studio 工程生成器的 `OutDir` 固定为 `$(ProjectDir)$(Platform)\$(Configuration)\bin\`，与 IDE 构建目录内原生依赖物化的 `binDir` 一致。CEF/WebView2/new_emoji 等需要运行时文件的模块不得把 VS exe 输出到运行时资源目录之外；`generated/cpp` 对外导出还必须另行验证其 SDK/资源复制完整性。

> 2026-07-26 补充：模块管理页每个本地模块的“接口”入口改为视口级“模块公开信息”弹窗，不再把详情插入模块长列表。弹窗直接消费当前 `InstalledModule.manifest`，统一展示类型、命令、设计器控件、代码片段、C++ 目标依赖和随包文档，支持搜索、分类树、单项详情/复制、Esc 与背景关闭，并对超大命令清单限制首屏渲染数量。

本文记录当前仓库已经落地的模块系统实现，供后续开发者和 Agent 继续扩展时参考。模块系统的目标不是做展示页，而是让“项目引用模块 -> Monaco 中文代码能力 -> 设计器控件 -> C++ 生成/构建”形成同一套数据闭环。

## 2026-07 v2 模块 SDK 重构状态

### Win32 标准控件注册表（2026-07）

- 新增统一 `electron/src/services/windowDesigner/win32ControlRegistry.ts`，基础/高级模块清单、设计器工具箱、专属属性、事件和原生适配器均从该注册表读取。
- 基础/高级 Win32 可视控件把原生子类运行时支持的 `MouseDown`、`MouseEnter`、`MouseLeave`、`GotFocus`、`LostFocus` 作为通用事件从注册表同步到模块 manifest 和设计器事件面板；`Label`、`Image`、`AnimatedImage` 同时公开 `Click`。由自身交互链完整接管的 `ColorPicker` 与 `VideoPlayer` 只公开经验证的专用事件，不能为了表面统一生成不可靠回调。
- Win32 基础模块注册 `AnimatedImage`“动态图像控件”，以项目内 `properties.gifSource` 为唯一 GIF 资源来源；设计器预览与 LingCpp Win32 生成器共同消费自动播放、循环、填充方式和播放完毕事件。它不复用仅支持 AVI 的 `SysAnimate32` 控件。
- 默认 `lingbuilder.win32.basic` 覆盖基础输入、列表、组合、分组框、滚动、图片和进度；可选 `lingbuilder.win32.common-controls` 覆盖 ListView、TreeView、Tab、日期、滑块、工具栏、状态栏、RichEdit 等系统标准控件。旧 `Grid` 网格容器、`Pager` 分页容器和窗口级 `MenuBar` 仅保留项目读取与原生生成兼容，不再进入工具箱或新增入口；普通父级容器统一使用分组框，常规窗口操作入口统一使用 `ToolBar`。
- `ModuleDesignerControlContribution` 可声明 `category`、`icon`、`properties`、`isContainer`、`isVisual`、`nativeAdapter` 和 `requiredLibraries`；字段保持 manifest v2 向后兼容。
- 非可视 ToolTip、ImageList、FileDialog、ContextMenu、PopupMenu、PropertySheet 不进入普通可视控件工具箱，但必须在非可视资源区可选择、可编辑。注册表属性键必须与实际持久化模型完全一致：ToolTip 使用 `text/targetControlId/initialDelay`，FileDialog 使用 `ownerWindowId/triggerControlId/dropTargetId/title/filter/multiple/allowDrop`，ContextMenu 使用 `ownerWindowId/targetControlId/items`，PopupMenu 使用 `ownerWindowId/items`，PropertySheet 使用 `title/pages`。菜单选择事件按菜单项绑定，PropertySheet 的 `Applied` 使用统一事件卡片创建/导航。
- 高级模块的文件对话框会实际应用 `名称|模式` 筛选器，并通过 `系统对话框_状态` 区分成功、取消与错误；查找替换提供动作/文本读取命令，工具栏和状态栏提供最后命令 ID/分区索引，打印文本会创建真实打印文档。这些命令与 C++ runtime 必须继续由同一份 `contributes.commands`/`bindings.commands` 声明驱动。
- `lingbuilder.win32.common-controls` 贡献可拖放的 `ColorPicker`“颜色选择器”。可视时它以 owner-draw 按钮显示当前色块和可选十六进制文本，点击后打开 LingBuilder 自绘暗色弹窗；设置为不可视时仍必须进入生成运行时控件表，可由任意事件调用 `颜色选择器_打开(控件名)`。弹窗提供 HSV 色谱、色相条、HEX/RGB、预设色与确认/取消，不再使用旧式 `ChooseColorW`。当前颜色使用 COLORREF，通过 `颜色选择器_置颜色/取颜色` 确定性读写，并统一分发打开、改变、确认、取消和关闭事件。
- `lingbuilder.win32.common-controls` 为 TabControl 提供 `选项卡_设置隐藏表头/取隐藏表头`，用于运行时切换表头并重排页面承载区；补全、binding 与生成运行时必须保持同源。设计器注册表中的结构/创建期属性不自动等同于运行时命令，只有具备确定性 C++ 实现的属性能力才能进入 `.lcpp` 控件命令补全。
- `lingbuilder.win32.common-controls` 的独立 Header 列模型支持逐列 `alignment`（`left/center/right`）；设计器列编辑、预览和 C++ `HDF_LEFT/HDF_CENTER/HDF_RIGHT` 必须保持同源，旧列数据默认左对齐。
- `lingbuilder.win32.basic` 同源贡献窗口事件上下文命令：关闭取消、宽高/位置、激活/可见/窗口状态、按键与修饰键、按键处理、DPI 和拖入文件读取。Monaco 补全与 C++ runtime 不得维护两份命令清单。
- 窗口事件处理器签名以 `windowEventRegistry.ts` 为唯一契约：`KeyDown`/`KeyUp` 传入键码及 Ctrl/Shift/Alt 状态，`TextInput` 传入 Unicode 字符文本，`DpiChanged` 传入新 DPI，`FileDropped` 传入完整路径数组；其它事件当前保持无参数。旧无参数处理器继续兼容并可使用窗口事件上下文命令，模块和 AI 不得自行扩展或改写事件 ABI。
- 事件上下文命令仍是兼容与补充接口；其 binding 返回的文本指针指向窗口对象持有的事件快照，只能读取，不能在模块侧长期缓存。
- 模块 manifest 校验会拒绝未知属性类型、重复控件、重复属性、重复事件、不含 `{controlName}` 的事件模板和不安全文件默认路径。

- 模块清单已升级为 `schemaVersion: 2`；旧 `.lbmod` v1 不再作为兼容目标，安装预览会提示使用模块迁移工具重新打包。
- C++ 依赖从旧 `contributes.cpp` 迁移到顶层 `targets[]`，当前默认构建目标为 `windows-msvc-win32`，并预留 `windows-msvc-x64`、CMake、Linux、macOS 等后续目标。
- 中文命令到 C++ 的确定性映射从旧 `cppRuntimeName` 迁移到 `bindings.commands[]`。`contributes.commands` 只负责补全、诊断和文档；生成 C++ 必须优先使用 binding。
- 新增模块 SDK 能力：`lingbuilder module init`、`module validate`、`module pack`、`module inspect`、`module migrate-cpp`、`module market index`。
- `module validate` / `module inspect` 可直接检查模块目录、manifest 或 `.lbmod`；包检查使用临时工作区预览并在结束后清理，不改变项目启用状态。
- 模块页新增“模块开发者中心”，支持创建模板、校验模块、C++ 迁移和本地市场索引生成；这些入口复用服务层，不把模块逻辑写入 React 组件。
- 根目录 `模块开发手册.md` 是对外模块作者手册；修改 v2 manifest、binding、target、迁移流程或发布流程时必须同步更新。
- `new_emoji` 模块需要用 `electron/scripts/generate-new-emoji-module.cjs` 重新生成 v2 包，输出仍为 `.lingbuilder/module-packages/new_emoji.lbmod`，安装目录仍为 `.lingbuilder/modules/lingbuilder.new_emoji.ui`。
- 新建普通 Win32 项目默认只引用 `lingbuilder.win32.basic`。`new_emoji`、网页访问、HTTP 服务端、WebSocket 客户端/服务端等模块即使已安装或属于内置网络模块，也必须由模板、用户或明确的一键启用动作加入项目引用。
- 模块管理 UI 的 `projectId` 为必填，始终跟随解决方案中的活动项目；切换项目会清空旧请求状态并重新读取，安装后启用、启用/禁用、刷新和变更事件均携带项目 ID，服务端拒绝不存在的项目。
- 窗口设计器监听 `lingbuilder-modules-changed`；当前项目启用或禁用模块后会立即重新读取项目模块上下文，高级控件工具箱无需重载即可更新可用状态。
- HTTP 模块开发入口只接受工作区相对路径：模板/迁移输出位于 `.lingbuilder/module-build`，包位于 `.lingbuilder/module-packages`，市场索引位于 `.lingbuilder`；CLI 仍可显式使用本机路径。
- 当前 F5 目标只接受精确 `windows-msvc-win32`。缺少该 target 时跳过原生依赖并返回中文诊断，不会回退到 `targets[0]`。
- manifest 预览、目录校验、安装与打包会确认 `docs`、`examples`、`headers`、`sources`、`libs`、`runtimeFiles` 和 include 目录实际存在。
- 命令 `insertText` 必须由签名参数生成并与 binding 参数数量一致；零参数命令生成 `命令()`，多参数按顺序生成 `$1` 到 `$N`。
- 有返回值的命令通过 `contributes.commands[].returnDescription` 解释返回值语义；命令提示参数表优先读取 `bindings.commands[].parameters[].description`，不得把命令简介重复显示成每个参数的说明。
- binding 的处理器参数使用 `type: "handler"`；语言服务把 `.lcpp` 中的 `&处理器名` 识别为当前类无参数事件/方法引用，生成器确定性转换为运行时处理器名。只从当前项目已启用模块上下文读取，不把模块回调误判为缺少设计器控件；字符串处理器名仅作旧清单兼容。

## 当前实现范围

- 模块核心类型、内置模块、清单校验和 Node 端服务位于 `electron/src/services/modules/`。
- 模块管理 UI 位于 `electron/src/components/ModuleInspector.tsx`，通过 `/api/modules/*` 访问服务，不再使用组件内硬编码模拟安装状态。
- 解决方案资源管理器已经在项目节点 `GameClient (Visual C++)` 下显示“模块”组，并提供“配置项目所使用模块”入口。
- Monaco 中文代码编辑器通过 `LingCppModuleContext` 消费模块贡献，支持模块命令/类型/片段补全，以及“使用了未启用模块命令”的中文诊断。
- Win32 C++ 生成器支持读取启用模块，输出 `module-dependencies.txt`，并在 `main.cpp` 中写入外部模块依赖注释、`#pragma comment(lib, ...)` 和 define。
- Win32 F5 构建链路支持把外部模块的 `headers`、`sources`、`libs` 和 `runtimeFiles` 复制到临时构建目录与 `generated/cpp/` 导出目录，并把运行时 DLL 复制到 exe 同目录；同步生成的 Visual Studio 工程会引用模块源码、include 路径、`.lib` 和 DLL post-build 复制命令。
- `.lbmod` 模块包采用“zip 包 + 根目录 `lingbuilder.module.json`”格式；安装前必须预览确认。
- 模块市场第一阶段支持本地/远程索引读取，安装仍走同一套 preview/install 流程。

## 关键文件

- `electron/src/services/modules/types.ts`
  - 定义 `LingBuilderModuleManifest`、模块贡献类型、安装预览、市场模块、历史记录等公共结构。
- `electron/src/services/modules/builtinModules.ts`
  - 定义内置基础模块 `lingbuilder.win32.basic`，包含 `信息框`、`调试输出`、`结束`、基础类型和基础设计器控件贡献。
- `electron/src/services/modules/manifest.ts`
  - 校验模块清单、模块 ID、贡献项和 C++ 相对路径安全。
- `electron/src/services/modules/moduleService.ts`
  - 负责扫描、项目启用/禁用、`.lbmod` 预览、安装、卸载、市场索引、导出模块包和操作历史。
- `electron/src/services/modules/nativeDependencyService.ts`
  - 负责把已启用模块的 C++ 头文件、源码、库文件和运行时 DLL 安全复制到构建/导出目录，并向编译器提供 include/source/lib 路径。
- `electron/server.ts`
  - 暴露 `/api/modules/*` 路由，并在窗口设计器构建时把启用模块传给 C++ 生成器。
- `electron/src/services/lingCpp/languageService.ts`
  - 将启用模块贡献合并进补全和诊断。
- `electron/src/components/MonacoCodeEditor.tsx`
  - 拉取项目模块上下文，并传给 LingCpp 语言服务。
- `electron/src/components/Sidebar.tsx`
  - 在项目树中显示当前项目启用模块；模块 API 暂不可用时 fallback 显示内置基础模块，避免开发服务未重启时出现 JSON 解析错误。
- `electron/src/services/windowDesigner/lingCppWin32Project.ts`
  - 生成模块依赖报告和 C++ 模块依赖前导内容。
- `electron/tests/modules.test.ts`
  - 覆盖 manifest 校验、模块补全/诊断、生成器模块依赖输出。

## 模块清单格式

模块目录或 `.lbmod` 包根目录必须包含 `lingbuilder.module.json`：

```json
{
  "schemaVersion": 1,
  "id": "com.example.sqlite",
  "name": "SQLite数据库模块",
  "version": "1.0.0",
  "category": "数据库",
  "description": "提供 SQLite 数据库访问能力。",
  "author": "Example",
  "tags": ["数据库", "SQLite"],
  "contributes": {
    "commands": [
      {
        "name": "执行SQL",
        "signature": "执行SQL(语句)",
        "description": "执行一条 SQL 语句。",
        "insertText": "执行SQL(\"$1\")",
        "returnType": "整数型",
        "cppRuntimeName": "ExecuteSql"
      }
    ],
    "types": [
      {
        "name": "数据库连接",
        "description": "数据库连接句柄。",
        "cppType": "SqliteConnection"
      }
    ],
    "snippets": [
      {
        "label": "打开数据库模板",
        "insertText": "打开数据库(\"$1\")",
        "description": "插入打开数据库的中文代码模板。"
      }
    ],
    "designerControls": [
      {
        "type": "SqlTableView",
        "label": "数据表视图",
        "defaultProps": {
          "content": "数据表",
          "width": 320,
          "height": 180
        },
        "events": [
          {
            "name": "Select",
            "label": "被选择",
            "handlerPattern": "_{controlName}_被选择"
          }
        ]
      }
    ],
    "cpp": {
      "includeDirs": ["include"],
      "headers": ["include/sqlite_bridge.h"],
      "sources": ["src/sqlite_bridge.cpp"],
      "libs": ["lib/sqlite3.lib"],
      "defines": ["LINGBUILDER_SQLITE_MODULE"],
      "runtimeFiles": ["bin/sqlite3.dll"]
    }
  }
}
```

模块 ID 必须稳定、全小写，并只使用字母、数字、点、横线或下划线。所有 C++ 文件路径必须是模块包内的安全相对路径，不允许绝对路径、空段或 `..`。

## 文件与持久化约定

- 已安装模块：`.lingbuilder/modules/<moduleId>/`
- 默认项目启用模块：`.lingbuilder/project-modules.json`
- 非默认项目启用模块：`.lingbuilder/projects/<projectId>/project-modules.json`
- 跨项目粘贴 `.lcpp` 功能库时，`ModuleService.planEnableModulesForProject` 只生成经过安装与清单校验的模块引用计划，不直接写盘；复制服务把该计划与功能库、项目数据类型、项目常量/全局变量合并到同一个 `ProjectFilePersistenceService.writeAll` 事务，成功后再记录模块历史。禁止在源码事务之前逐个调用 `enableModuleForProject`，否则失败时会留下半完成项目引用。
- AI 创建项目时同样必须复用 `ModuleService.planEnableModulesForNewProject` 解析请求模块、递归依赖、安装状态和 Permit；省略 `enabledModuleIds` 时先读取默认项目清单作为请求，显式空数组才表示仅基础模块。创建服务只能把返回的项目级 `project-modules.json` 写入计划交给统一项目文件事务，禁止由 AI Bridge、MCP、CLI 或 React 组件直接拼接/修改模块 JSON。创建预览阶段不得写盘，确认落盘后才记录模块历史；失败时必须回滚源码、设计器模型、配置和模块引用，不能留下半完成项目。已加入解决方案但缺少旧项目级清单的项目可暂时继承默认清单，后续以项目级文件为准。
- 模块市场源：`.lingbuilder/module-sources.json`
- 模块操作历史：`.lingbuilder/module-history.json`
- 卸载/升级快照：`.lingbuilder/module-snapshots/`
- 安装预览临时目录：系统临时目录 `lingbuilder-module-previews`
- 生成输出：`generated/cpp/<projectId>/module-dependencies.txt`、`generated/cpp/<projectId>/<projectId>.sln`、`generated/cpp/<projectId>/<projectId>.vcxproj`
- LCPP 源码分享包：`.lcpppkg` 会保存每个项目的 `project-modules.json`，并把已启用第三方模块及无命令/无 target 的 SDK 资产模块隔离复制到包内工作区 `.lingbuilder/modules/`；导入不会修改接收者其他工作区的模块安装状态。

所有模块 JSON 必须使用 UTF-8 读写。遇到旧文件乱码时，只报告诊断，不要凭终端乱码重写中文文案。

## API 路由

前端统一通过 Express API 访问模块能力：

- `GET /api/modules/installed?projectId=...`
- `GET /api/modules/project?projectId=...`
- `POST /api/modules/project/enable`
- `POST /api/modules/project/disable`
- `POST /api/modules/package/preview`
- `POST /api/modules/package/install`
- `POST /api/modules/package/export`
- `POST /api/modules/uninstall`
- `GET /api/modules/market`
- `GET /api/modules/history`

注意：开发期如果前端热更新了但 Express server 没重启，新增 API 可能暂时返回 Vite HTML。资源管理器已有 fallback，但模块管理页和后端真实安装能力仍需要重启 `npm run dev` 或对应 server。

## UI 入口

- 左侧活动栏“模块”页：进入完整模块管理器。
- 解决方案资源管理器项目节点下“模块”组：显示当前项目启用模块，并提供“配置项目所使用模块”按钮。
- `.lbmod` 可拖入模块页，也可手动填写工作区相对路径后点击“预览安装”。桌面版拖入工作区外模块包时，主进程会校验 `.lbmod`、普通文件和 100MB 上限，复制到 `.lingbuilder/module-packages` 后再走同一预览确认流程；网页版仍只接受工作区内路径。
- 安装预览必须显示模块名、版本、SHA256、文件数量、升级状态和安全检查结果；用户确认后才安装。

## 与 Monaco 和生成器的关系

模块不直接操作 Monaco。正确链路是：

```text
lingbuilder.module.json
  -> ModuleService
  -> LingCppModuleContext
  -> lingCpp/languageService
  -> MonacoCodeEditor
```

生成器也必须消费同一份启用模块上下文。不要在 Monaco 里支持一个模块命令，却让 C++ 生成器完全不知道它；也不要在生成器里硬编码新中文命令而不让语言服务知道。

## new_emoji 原生界面库模块

- `electron/scripts/generate-new-emoji-module.cjs` 可从 `T:\github\new_emoji` 或 `NEW_EMOJI_ROOT` 指向的源码目录生成 `lingbuilder.new_emoji.ui` 模块。唯一上游事实来源是 `src/new_emoji.def`、`src/exports.h`、`src/element_types.h` 与设计器目录；禁止手写平行 API 清单。
- 生成命令：`cd electron && npm run module:new-emoji -- --install`。该命令会验证后原子替换 `.lingbuilder/module-build/lingbuilder.new_emoji.ui`、`.lingbuilder/modules/lingbuilder.new_emoji.ui` 和 `.lingbuilder/module-packages/new_emoji.lbmod`。只读门禁 `npm run module:new-emoji:check` 会在临时目录重建并比较 manifest、文档和全部文件哈希。
- 当前模块版本为 `2.0.0`，最低 LingBuilder 版本为 `0.3.0`，清单固定包含 Win32/x64 的 `new_emoji.dll` 和 `new_emoji.lib` targets；构建按项目架构选择对应资产。
- `new_emoji.lib` 是 MSVC 导入库；如果只检测到 g++/clang++，F5 会返回“new_emoji 模块需要 MSVC/Visual Studio Build Tools”的中文诊断。
- `.lcpp` 用户优先使用 `NE_创建窗口`、`NE_创建按钮`、`NE_创建文本` 等桥接命令；自动生成的 `NE_EU_*` 命令属于底层高级入口，参数仍按 new_emoji 的 UTF-8 字节指针和长度规则处理。
- `NE_` 桥接层把 `wchar_t*` 转 UTF-8 时必须为 `WideCharToMultiByte` 的结尾 `\0` 预留空间，再传递不含结尾 `\0` 的字节长度；传给 new_emoji 控件的 UTF-8 字符串还必须存入桥接层持久池，不能把函数内临时缓冲区指针交给 DLL，否则 VS Debug CRT 可能读到 `0xDDDDDDDD` 已释放内存并触发访问冲突。
- new_emoji 独立演示或 AI 自动生成示例必须保留事件块末尾的结构标记 `结束`，但不能额外调用显式退出命令 `结束()`；后者会销毁 LingBuilder 默认窗口，消息循环收到退出后表现为 exe 闪退。
- 纯 new_emoji 示例应由 new_emoji 自己负责生命周期：创建窗口和控件后调用 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。如果继续复用 LingBuilder 默认 Win32 生成窗口，必须保证默认窗口不会立即销毁，也不能让空设计器窗口关闭后触发 `PostQuitMessage(0)`。
- 报告 new_emoji exe 可运行前，必须确认 `new_emoji.dll` 已复制到 exe 同目录，并实际启动验证至少 3 秒仍在运行。
- 当前模块目录包含 93 个控件、1618 个底层导出、718 个属性和 918 个事件映射。`RichList / 富列表` 使用 `lingbuilder.new_emoji.ui/RichList`，设计器可配置模板 JSON、项目 JSON、选中 key、选择模式、样式、滚动位置和虚拟项目数；F5、原生预览和 Visual Studio 导出统一生成 `EU_CreateRichList` 及对应 Setter。
- RichList 的 `SelectionChanged` 处理器接收 `文本型 选中键列表`；`ItemClicked`、`ItemDoubleClicked`、`ButtonClicked`、`BadgeClicked`、`CountdownEnd`、`ContextMenu` 处理器接收 `文本型 事件数据`。后六类事件复用一个原生 JSON 回调，并由 `payloadEvent` 按 `item_click`、`item_double_click`、`button_click`、`badge_click`、`countdown_end`、`context_menu` 确定性分发。
- 项目启用 `lingbuilder.new_emoji.ui` 后，设计器和原生生成器会把基础 `Button`、`TextBox`、`Label`、`CheckBox`、`RadioButton`、`ListBox`、`Image`、`ProgressBar` 模型映射为 new_emoji 控件；旧项目中的 `Grid` 模型仍可兼容映射为 new_emoji 容器，但不再提供新增入口。普通 Win32 工具箱已移除固定外观的 `Upload` / `DragUpload`，改由 `lingbuilder.win32.common-controls` 贡献非可视 `FileDialog`，绑定现有按钮和窗口/控件拖放目标。旧上传控件与 new_emoji `NE_` 上传桥接仅作已有项目兼容，不再作为新增设计器控件入口。
- new_emoji 后端不支持的控件必须在工具箱显示禁用原因，并在生成结果中产生中文诊断；不得为了“看起来可用”而回退生成 Win32 控件。上传事件已接入 callback API；继续新增其它控件事件时仍必须同时补设计器事件、桥接回调生命周期和生成器分发测试。

## WebSocket 客户端内置网络模块

- `lingbuilder.websocket.client@2.0.0` 是内置 v2 网络模块，从 `electron/src/services/modules/webSocketClientModule.ts` 的单一目录生成 51 条 contribution/binding，并公开 `WebSocket连接` 受管类型；旧 5 条同步命令只保留为 `advanced` 迁移入口。
- 新代码使用创建/配置/安全限制/处理器绑定/后台启动、指定连接文本与二进制发送、事件快照、握手状态和统计 API。五类处理器参数必须声明为 `handler`，源码必须写 `&处理器名`，不能退回字符串回调。
- 共享运行时位于 `electron/src/services/windowDesigner/webSocketClientRuntime.ts`。每个连接使用独立 WinHTTP 后台接收循环，支持 `ws://`/`wss://`、多连接、Origin、子协议、自定义请求头、系统/直连/固定代理、HTTP Basic 凭据、默认系统证书验证、可选自签名策略、SHA-256 证书固定、严格 UTF-8、消息限额、接收超时、指数退避重连和统计。
- 普通 Win32 与 New_Emoji 复用同一运行时，通过各自窗口消息回到所属 UI 线程。Windows/MSVC Win32/x64 target 链接 `winhttp.lib`、`crypt32.lib`；WinHTTP 自动处理 Ping/Pong，但不提供主动 Ping API，模块不得用普通文本伪装 RFC 6455 Ping。
- 正式文档位于 `electron/docs/modules/websocket-client/README.md`。模块变更必须运行 `npm run smoke:websocket-client-native`，真实编译普通 Win32 的 Win32/x64 与 New_Emoji x64，并验证 Origin、子协议、文本/二进制、Close、自动重连和统计。

## HTTP / WebSocket 服务端内置网络模块

- `lingbuilder.http.server` 和 `lingbuilder.websocket.server` 是内置 v2 网络服务端模块，项目启用后分别提供本地 HTTP 服务端和 WebSocket 服务端能力。
- HTTP 服务端 `2.0.0` 从 `electron/src/services/modules/httpServerModule.ts` 的单一目录生成 48 条 contribution/binding，并公开 `HTTP服务端`、`HTTP请求` 两个受管类型。新代码使用创建/配置/资源限制/路由/处理器/启动停止、完整请求读取、文本/JSON/二进制/文件/Cookie/重定向响应和统计 API；旧 5 条阻塞命令仅作为 `advanced` 迁移入口。
- HTTP 运行时位于 `electron/src/services/windowDesigner/httpServerRuntime.ts`，使用后台 accept、1–64 工作线程和有界连接队列，支持 IPv4/IPv6、动态端口、HTTP/1.0/1.1、keep-alive、Content-Length/chunked、HEAD、请求限制、响应头注入防护和确定性停止回收。请求通过窗口消息回到所属 UI 线程；普通 Win32 与 New_Emoji 复用同一运行时和 binding。
- HTTP 的处理器 binding 必须声明 `type: handler` 和 `handlerSignature`；当前请求/路由处理器契约为 `parameterTypes: []`、`returnType: 空`。语言服务必须阻断字符串处理器、缺失处理器和签名不匹配，生成器继续把 `&处理器名` 确定性转换为后端回调名称。
- HTTP 模块按监听目标解析后的实际 IPv4/IPv6 地址默认禁止非回环绑定，必须显式调用 `HTTP_允许外部监听`；请求目标的百分号编码及其 UTF-8 解码结果必须严格校验。模块定位是商业可用的嵌入式 HTTP/1.1 服务端，不内置 TLS/HTTP2/身份认证；公网 HTTPS 由反向代理或网关提供。正式文档位于 `electron/docs/modules/http-server/README.md`，变更必须运行 `npm run smoke:http-server-native`，真实编译普通 Win32 的 Win32/x64 与 New_Emoji x64 并完成协议检查。
- WebSocket 服务端 `2.0.0` 从单一目录生成 50 条 contribution/binding，并公开 `WebSocket服务端`、`WebSocket客户端` 两个受管类型。新代码使用创建/配置/安全限制/事件绑定/启动停止、客户端查询、定向发送、广播、心跳、关闭和统计 API；旧 6 条阻塞命令仅作为 `advanced` 迁移入口。
- WebSocket 运行时是后台非阻塞 `WSAPoll` reactor，支持多客户端、文本/二进制、分片与跨帧 UTF-8、Ping/Pong、Close、掩码/RSV/opcode/长度校验、Origin/路径/子协议、握手/消息/发送队列上限和超时。事件通过窗口消息回到所属 UI 线程；普通 Win32 与 New_Emoji 复用同一运行时和 binding。
- WebSocket 服务端声明 Windows/MSVC Win32 与 x64 target，链接 `ws2_32.lib` 和 `advapi32.lib`。模块只提供 `ws://`，公网 TLS 应由反向代理或网关终止。默认禁止非回环监听，必须显式调用 `WSS_允许外部监听`。
- 正式文档位于 `electron/docs/modules/websocket-server/README.md`。模块变更必须运行 `npm run smoke:websocket-server-native`，真实编译普通 Win32 的 Win32/x64 与 New_Emoji x64，并验证握手、Origin、子协议、多客户端、分片、二进制、Ping/Pong、掩码和关闭握手。

## EdgeView 设计器控件（2026-07）

- `lingbuilder.edgeview` 通过 v2 `contributes.designerControls` 贡献 `EdgeBrowser`，注册表、模块清单、设计器工具箱和生成器使用同一份控件定义。
- 每个设计器控件生成独立 STATIC 宿主和 WebView2 Controller；`parentId` 由通用 Win32 控件层级解析为窗口、容器或选项卡页面 HWND，不在 React 中模拟浏览器运行。
- 控件内部实例编号使用稳定生成 control ID，用户代码优先通过中文控件名调用 EdgeView 控件命令；旧数字实例和区域 API 保持兼容。空缓存目录必须确定性生成独立 `.edgeview/<controlId>`，避免多控件默认共享会话目录。
- WebView2 SDK/Loader 仍由 `nativeDependencyService` 受控发现和复制；设计器只保存模型，不直接读取 NuGet 或启动原生浏览器。
- EdgeView 事件目录集中维护在 `electron/src/services/modules/edgeViewBrowserEvents.ts`，按 `1.0.3537.50` 与 `1.0.4078.44` 双基线审计。普通 HWND 控件接入 71 项可达事件；`CompositionController` 独占的 2 项事件明确排除。注册表、模块补全、设计器事件面板、中文事件映射和生成器覆盖测试必须消费同一目录，新增 SDK 版本时不得只补 UI 或只补 C++。
- EdgeView 面向用户的事件参考文档登记在 manifest 的 `contributes.docs[]`，路径为 `electron/docs/modules/edgeview/README.md`，由 `electron/scripts/generate-edgeview-event-doc.ts` 从上述目录生成。文档必须列出全部中文事件名、WebView2 标识、设计器 ID、来源、说明、关键字段、调用示例和 CompositionController 排除项；修改事件目录后运行 `npm run module:edgeview-docs`，发布/测试前运行 `npm run module:edgeview-docs:check`。
- 事件运行时通过 `QueryInterface` 逐级启用 WebView2 版本接口，并级联保存 Download、Frame、Notification、Find、Profile、DevTools receiver 等事件源。事件数据统一为 UTF-16 JSON；等待事件按事件名计数，避免高频资源/下载事件覆盖最近值后造成漏判。
- 2026-07-31 起模块升级到 `1.2.0` / 最低 LingBuilder `0.2.7`：`edgeViewApiCatalog.ts` 集中生成 235 条安全 API contribution 与 binding，连同 36 条兼容命令共 271 条。覆盖清单固定审计 SDK `1.0.3537.50`（Runtime 141）和 `1.0.4078.44`（Runtime 150）：新基线 995 个稳定方法已归为 330 个公开实现、565 个内部适配和 100 个批准排除，`pending=0`。`module:edgeview-coverage:complete` 同时验证双头文件哈希、中文名、binding、运行时符号和测试 ID。
- v2 创建期选项包括独占 UDF、崩溃报告、环境跟踪保护、扩展开关、通道搜索、发布通道、滚动条样式、脚本区域、背景色和宿主输入处理。属性修改后必须显式重建；运行期以 `QueryInterface` 检测接口，使用 v2 命令时生成物要求 Runtime 150。CompositionController、PointerInfo、AutomationProvider、实验 API、裸 COM/指针、Host Object 注入继续排除。
- 新增 API 只接受文本、数字、JSON、明确文件路径和受管任务/下载 ID；CompositionController、PointerInfo、AutomationProvider、任意 Host Object 注入、裸 COM/指针和内存地址继续明确排除。异步操作统一返回任务 ID，并通过 `&处理器名` 在所属窗口线程完成；实例关闭或重建会增加 generation、取消任务并拒绝迟到回调。
- 设计器继续只绘制安全占位。统一命令 `designer.edgeview.previewControl` 会生成只含当前 Edge 控件、不执行项目用户代码的独立 Win32 临时项目，通过 MSVC 和受管进程启动；再次预览、停止或切换项目会回收旧进程。

## 分类内置模块库（2026-07）

- 参考精易模块的程序、窗口句柄、键盘鼠标、进程线程、配置、图片、网页、文本字节、文件目录、系统、杂类和组件分类，新增 51 个内置 v2 模块、336 条中文命令。
- 当前 `BUILTIN_MODULES` 合计 81 个模块、1782 条命令；正式清单位于根目录 `MODULE_ENCAPSULATION_CHECKLIST.md`。
- 模块定义按领域拆到 `standardLibraryModules.ts`、`systemLibraryModules.ts`、`networkLibraryModules.ts`、`dataMediaModules.ts` 和 `platformAdvancedModules.ts`，不继续扩张单个 `builtinModules.ts`。
- 对应 C++ 实现按领域拆到 `standardLibraryRuntime.ts`、`systemLibraryRuntime.ts`、`networkLibraryRuntime.ts`、`dataMediaRuntime.ts` 和 `platformAdvancedRuntime.ts`，生成器只注入当前项目已启用模块的运行时片段。
- 新增表达式翻译支持嵌套模块调用，例如 `调试输出(文本_转大写("LingBuilder"))` 会把内层文本参数和 binding 一并确定性翻译为宽字符串 C++。
- 内置纯系统模块统一补齐 `windows-msvc-win32` 与 `windows-msvc-x64` target；外部 `.lbmod` 仍必须显式提供各架构产物，不允许自动假设二进制兼容。
- 高风险模块使用 `lingbuilder.advanced.*` 独立 ID，默认不启用；受控内存模块只访问自身登记内存，CPU 指令模块不执行用户机器码，驱动模块不负责安装或提权。
- 双架构 smoke 工程位于 `.lingbuilder-build/standard-library-smoke-20260723/`，用于同时启用除 EdgeView 外的内置模块并执行 Visual Studio Release 编译。

## New_Emoji Tabs 外部 HWND 子宿主（2026-07-29）

- `lingbuilder.fbro.browser` 是 New_Emoji 后端当前唯一正式登记的外部 `HWND` 可视控件适配。FBro 不伪装为 New_Emoji 元素；每个实例仍创建独立 `STATIC` 子宿主 `HWND` 和独立 FBro/CEF profile。
- FBro 可作为 `lingbuilder.new_emoji.ui/Tabs` 的页面子控件，使用 `parentId` 指向 Tabs、`containerSlot` 指向稳定页 ID。生成器注册 `EU_SetTabsChangeCallback`，只显示当前页对应的浏览器子宿主。
- New_Emoji 后端的 FBro 中文命令继续复用 `lingbuilder.fbro.browser` v2 bindings 和 `LingBuilderFbroBridge` C ABI；不得在 React 中模拟切页或为每页共用同一浏览器句柄。
- 此适配不放开任意 Win32 控件混用。其它外部 HWND 控件需先提供独立寿命周期、坐标、页面可见性、命令契约和生成回归测试，才能加入支持矩阵。
- Visual Studio 可移植导出必须复制模块已发布的全部 Windows/MSVC target；工程既然同时声明 Win32/x64，不得只复制当前机器的首选 `.lib`/DLL。
- New_Emoji 元素坐标是以自绘标题栏之后为原点的逻辑像素；外部子 `HWND` 必须补入默认 30 逻辑像素标题栏偏移，并用 `GetDpiForWindow` / `MulDiv` 转成客户区实际坐标，禁止直接把设计器坐标传给 `CreateWindowExW` 后覆盖 Tabs 标签头。
- 生成模块可用性宏时必须汇总已启用模块全部 target 的 `defines`，并置于 `__has_include`/桥接头探测之前；不能因默认选择 Win32 target 而遗漏仅提供 x64 target 的 FBro。运行验收必须确认 exe 保持响应且至少三个 FBro renderer 子进程已建立，不能把白色 `STATIC` 宿主视为浏览器成功。

## 通用密码学模块（2026-07-30）

- 内置逻辑模块拆分为 `lingbuilder.crypto.hash`、`lingbuilder.crypto.password`、`lingbuilder.crypto.symmetric` 和 `lingbuilder.crypto.asymmetric`；每条中文命令同时具备 contribution、binding 和真实 C++ 符号，不能只提供补全。
- 哈希覆盖 MD5、SHA-1、SHA-256、SHA3-256、SM3、BLAKE2b-512 和 BLAKE3 的文本/文件入口；密码哈希覆盖 Argon2id、scrypt、bcrypt、PBKDF2-HMAC-SHA256，并保存带算法、参数和随机盐的自描述格式。
- 对称模块覆盖 AES-256-GCM、ChaCha20-Poly1305、SM4-GCM、Camellia-256-GCM、Twofish-GCM、Serpent-GCM，以及仅作兼容的 AES-CBC、Blowfish、RC2、RC4、DES 和 3DES。AEAD 命令必须校验附加数据和认证标签；旧式算法保持高级可见性并明确不提供完整性保证。
- 非对称模块覆盖 RSA-OAEP/PSS、ECDSA P-256、SM2 加密与签名、ECDH P-256、X25519 和兼容用 ElGamal；私钥统一导出 PKCS#8 PEM，公钥统一导出 X.509 PEM。
- `lingbuilder.crypto.sdk` 是只读原生资产载体，固定 Botan 3.12.0 与官方 BLAKE3 C 1.8.5。`npm run module:crypto-sdk -- --install` 校验上游版本/提交后生成 Win32 与 x64 MSVC 资产、逐文件 SHA-256 清单及 `.lbmod`；F5、AI Bridge、原生预览和 Visual Studio 导出必须复用 `nativeDependencyService` 校验与物化，禁止绕过摘要检查或从 renderer 直接复制 DLL。
- SDK 使用动态 CRT 和 C++20 工程设置。缺少 SDK、架构、清单或文件摘要不一致均为生成前阻断诊断，不得退化成不可用占位函数。
- 原生回归入口为 `npm run smoke:crypto-native`：同时构建 Release Win32/x64，并在 x64 真实运行标准摘要向量、密码验证、全部对称算法往返/AEAD 篡改拒绝，以及 RSA、ECDSA、SM2、ECDH、X25519、ElGamal 闭环。

## 后续扩展规则

- 新增模块能力时，先扩展 `electron/src/services/modules/types.ts` 和校验器，再接 UI。
- React 组件只负责展示、触发和局部状态；安装、扫描、启用、禁用、导出、市场读取必须在 `ModuleService` 或 API 层完成。
- 内置基础能力也按模块模型表达，不要另写一套“特殊基础命令列表”。
- 模块控件接入设计器时，应由 `designerControls` 贡献生成工具箱项，并在项目禁用模块时显示“依赖模块未启用”，不要静默删除已有控件。new_emoji 已按此规则接入 7 类基础控件。
- 外部模块的 C++ 依赖第一阶段只生成报告和明确注释；真正复制 include/src/lib/runtime 文件到构建目录时，必须补测试并保证路径安全。
- 官方收费模块的远程下载、Ed25519 签名校验、SHA-256 校验和安装/更新回滚已复用 preview/install 流程；第三方公开市场的审核和签名信任链仍可继续扩展。

## 验证命令

模块相关改动至少运行：

```bash
cd electron
npm run lint
npm run test:lingcpp
npm run build
```

涉及 UI 时还应打开 `http://127.0.0.1:3000/` 或当前开发端口，确认项目树下“模块”组和模块管理页不重叠、不报错。

## new_emoji 设计器目录与收费模块（2026-07-27）

- `new_emoji` 的唯一生成来源为上游 `new_emoji.def`、`exports.h`、`element_types.h` 和设计器目录。模块生成脚本强制校验 93 个组件、1618 个导出、精确参数和目录 SHA-256；提交目录仍为旧 92 控件时只允许在系统临时目录运行上游 Catalog Exporter，目录与导出定义无法收敛时直接失败。
- 模块控件使用 `lingbuilder.new_emoji.ui/<Control>` 命名空间 ID，窗口通过 `designerBackend: win32 | new-emoji` 固定后端；非空窗口禁止切换，项目内可同时保存两类窗口。
- 设计器重新挂载必须以磁盘加载完成的项目模型为准，不得用全局 localStorage 覆盖模块控件。自动保存缓存按 `projectId` 隔离；旧窗口只要包含 `lingbuilder.new_emoji.ui/*` 命名空间控件，规范化时就补齐并在下次保存持久化 `designerBackend: new-emoji`。
- 属性与事件面板消费模块目录，支持搜索、分组、基础/高级切换、默认值恢复和事件处理器模板。底层 `NE_EU_*` 默认为 advanced，不进入普通补全；用户显式开启“显示底层高级 API”后才显示。
- `runtimeCommand` 是属性或事件可编辑的硬门槛。当前模块生成 3784 条 contribution/binding、718 个属性和 918 个事件映射；函数指针 typedef 必须生成 `handler + handlerSignature`，清单校验发现上游函数指针仍被映射为 `int` 时拒绝打包。旧 Upload/DragUpload 的历史回调继续按兼容链路工作。
- new_emoji 设计画布必须使用上游原生主题令牌预览，不得再用 React 专属渐变或阴影伪装运行效果。深色主题的核心默认值为窗口 `#1E1E2E`、标题栏 `#181825`、按钮 `#45475A`、编辑框 `#313244`、边框 `#585B70`；浅色主题使用对应上游令牌。点阵只属于设计辅助，不进入原生运行时。
- 93 个命名空间控件的设计时形态由独立 `NewEmojiDesignerControlPreview` 负责，并以 `designerType` 末段选择预览；不能再只按兼容 `previewType` 渲染为普通文字或空容器。弹窗、抽屉、图表、浮层等内部遮罩和阴影必须裁切在控件边界内，禁止污染相邻控件；预览组件继续消费 `NewEmojiThemePreview`，不得另建与原生主题无关的基础按钮/编辑框配色。
- new_emoji 控件创建完成后，生成器默认调用安全桥接 `NE_设置元素焦点` 聚焦首个可见且启用的 Input/EditBox，保证启动即可键盘输入并显示光标；该调用位于窗口“创建完毕”处理器之前，因此用户事件代码仍可设置其它焦点。隐藏或禁用输入框不能获得默认焦点。
- new_emoji 窗口的默认 `lingbuilder` 图标来自根目录 `image/lingbuilder-ide-icon-v2.ico`。模块生成脚本将其打包为 `assets/lingbuilder-newemoji-window.ico`，Win32/x64 target 都声明为运行时文件，F5 和 VS 工程构建后复制到 exe 同目录并由生成代码加载；`system`、`custom`、`none` 三种显式设置优先于默认图标。
- Tabs、Menu、Omnibox 等结构化集合通过 manifest `recordList` 字段 schema 交给通用集合编辑器；dropdown、anchor、popup、submenu、target、container 等关系通过带类型约束和 `runtimeRepresentation: stableId` 的 `controlRef` 保存。原生生成必须先创建全部控件，再统一解析关系并调用 setter；不能退回数字索引或名称字符串猜测。
- 收费状态不来自 manifest。云端以 `moduleId` 管理商品、报价、订单、权益和限免；本地只接受 Ed25519 签名的短期 Permit。模块安装、启用、设计器编辑、构建、预览、导出和 AI Bridge 均必须经过同一授权守卫。
- 已购买 Permit 最长离线 72 小时；限免 Permit 不得越过活动结束时间。退出账号只撤销使用能力，不删除项目引用、控件或属性数据。
- Electron 启动恢复 Permit 时必须先等待本地 renderer `/api/health`，对开发服务启动竞态做有界重试并输出中文日志；禁止再用一次请求加空 `catch` 静默丢失授权。签名正确但已过期的 Permit 应保留 `MODULE_ENTITLEMENT_EXPIRED` 状态，不能退化为“未购买”；已恢复云端账号时应通过正式 `/v1/modules/permit` 自动换发并原子更新 `safeStorage` 缓存。

## new_emoji + FBro 浏览器外壳（2026-08-06）

- `LingWindowModel.windowFrame` 保存 `system | browserShell | custom` 预设、精确 flags、四边缩放边框与圆角。`browserShell` 固定为 new_emoji 上游 `0x3F` 六项组合；高级 flags 一经修改即进入 `custom`。旧 `resizable`、`cornerStyle` 由规范化服务迁移，旧项目缺省为 `system`。
- 官方集成模块 `lingbuilder.new_emoji.fbro-shell@1.0.0` 依赖 `lingbuilder.new_emoji.ui >= 2.0.0`、`lingbuilder.fbro.browser >= 2.1.0` 和 `lingbuilder.fbro.sdk >= 2.1.0`，仅支持 `windows-msvc-x64`。每个标签稳定 ID 对应独立 FBro 句柄和宿主 `HWND`；关闭、选择、重排与销毁按稳定 ID 管理生命周期。
- `BrowserViewport` 只提供设计器边界和加载/错误占位，不承担网页渲染。浏览器外壳中的真实网页由 `WS_EX_TOOLWINDOW + WS_POPUP` 非分层伴随宿主显示，不再把 Chromium 子 HWND 嵌入 new_emoji 的 `WS_EX_LAYERED` 主窗口；伴随宿主按占位区屏幕坐标同步移动、尺寸、DPI、显隐、层级和销毁。F5、原生预览、AI Bridge 和 Visual Studio 导出复用同一 C++ 生成与依赖物化链。
- 外壳模块公开创建/销毁、标签增删选排、导航、前进后退、刷新停止、地址标题和地址栏聚焦命令。状态处理器必须声明 `handlerSignature` 为 `(整数型, 文本型, 文本型, 逻辑型) -> 空`，源码引用使用 `&处理器名`。
- 模板 `new-emoji-fbro-browser-shell` 固定 1180 x 760、new-emoji 后端、`browserShell` 预设和 x64，自动启用依赖模块。浏览器根 `Container` 使用 `flowEnabled: false` 保留绝对坐标；Menu/Popover/Dropdown 打开时受控隐藏当前伴随宿主，避免弹层被 Chromium 覆盖。完整模板复刻 Chrome 式 Tabs、独立新建标签按钮、Omnibox、菜单/右键菜单、弹层与自绘窗口按钮；`SizeChanged` / `DpiChanged` 统一重排 new_emoji 控件、FBro HWND、弹层锚点及命中区域。
- 缺少 MSVC x64、SDK、Bridge、CEF 运行时或资产哈希异常时必须在生成前给出中文阻断诊断。验证入口为 `npm run smoke:new-emoji-fbro-tabs` 和 `npm run smoke:new-emoji-fbro-browser-shell`；后者使用本地 HTTP fixture，验证多标签独立导航、重排、伴随 HWND 的 owner/style/矩形、顶部外壳与网页像素、运行时哈希、10 秒存活与无残留进程。
- `npm run demo:new-emoji-fbro-shell:export` 必须用临时工作区生成并回读验证 `exports/new_emoji-FBro浏览器外壳完整复刻.lcpppkg`。源码包需要包含完整 `.lcpp`、设计器模型、x64 构建配置、项目模块引用和 required SDK 模块；禁止打包 IDE 内模拟页面或仅有截图的演示工程。

## 菜单和容器布局贡献

v2 manifest 可在 `contributes.menus[]` 和 `contributes.submenus[]` 中向稳定 `MenuId` 贡献声明式菜单。每个菜单项必须且只能声明 `command` 或 `submenu`，可附带 `when`、`group`、`order` 和最多 32KB 的 JSON `arguments`。模块菜单只能调用 IDE 已注册的受控命令，不能执行 renderer 脚本。

容器型 `contributes.designerControls[]` 可声明 `layout`，其 `mode` 为 `absolute | flow | stack | grid | dock | slots | single | custom`，并可声明坐标空间、方向、插槽、容量和子控件类型限制。旧 `isContainer: true` 控件缺少 `layout` 时临时按窗口绝对坐标兼容并输出迁移诊断；新容器必须显式声明布局，否则不得作为可跨容器粘贴的正式控件发布。

内置 Win32 容器也必须登记正式布局：`lingbuilder.win32.basic/GroupBox` 使用 `absolute` + `win32.groupbox.absolute`，`lingbuilder.win32.common-controls/TabControl` 使用 `slots` + `win32.tab.slots`。这些声明与 `DesignerContainerLayoutRegistry` 的适配器 ID 必须一致，设计器不得再为它们输出“未声明 layout”的兼容警告。
> 2026-07-28 补充：FBro SDK 查找必须从任意深度的 `.lingbuilder-build/<project>/<arch>/<mode>` 向上定位工作区，不能用固定两级父目录推导。缺少 SDK、桥接文件、清单或运行时校验失败属于 `blockingDiagnostics`，F5、原生构建和 AI Bridge 必须在编译前停止，禁止依靠 `__has_include` 编译空白占位浏览器后仍报告成功。F5 中间 VS 工程从已校验的 `bin` 增量物化运行时；`generated/cpp` 可复制工程必须携带 78 项完整 runtime、清单和脚本。生成的 C++ 必须用 `L"\\\\/"` 同时识别 Windows 反斜杠和正斜杠，否则缓存根目录会被错误拼到 exe 文件名之后并导致 CEF 子进程失败。

## DataGrid v1 实现约束（2026-07-30）

- 内置模块 `lingbuilder.win32.common-controls` 注册 `DataGrid`；每个实例创建独立 `LingBuilderDataGrid` 主 HWND，即使设计器初始状态为隐藏也不省略创建。
- 单元格采用双缓冲、可见区域绘制。选择框、Switch、图片、进度和按钮不创建逐单元格 HWND；仅编辑文本/数字、组合框、日期时创建临时 EDIT、COMBOBOX、DateTimePicker 子 HWND。
- Switch 与进度由 DataGrid 主 HWND 使用 GDI+ 抗锯齿圆角绘制并保持设计器同系配色；进度轨道高度和圆角必须按窗口 DPI 缩放，进度文字使用完整单元格文本区域垂直居中，不能裁剪在较窄的轨道矩形内。按钮列必须用当前 GDI 字体测量文字宽度，并对内边距、间距和命中矩形做 DPI 缩放；绘制、悬停和点击必须复用同一布局结果，只有整组按钮放不下时才显示“更多”。所有按钮状态和“更多”入口统一使用随 DPI 缩放的 4 逻辑像素 GDI+ 抗锯齿圆角填充与描边，不得回退成直角 `FillRect` / `FrameRect`。组合框静态绘制中文标签和箭头，单击后展开深色自绘的真实临时 COMBOBOX，未悬停项也必须使用可读前景色，选择提交时同时发送编辑提交和组合框改变事件。
- 冻结列在表头和数据行绘制时必须先填充对应的不透明背景，再绘制列内容和分隔线，确保横向滚动列位于冻结列后方时不可见；冻结列背景必须与当前行的条纹色及表头色一致。
- 图片运行时路径相对 EXE 目录解析，F5/导出必须通过 `DesignerAssetService` 保持 `assets/<项目ID>/` 结构复制资源；原生测试禁止额外手工复制图片来掩盖资源物化缺失。
- 图片列和单元格覆盖共用 `tile/contain/cover/center/stretch` 显示方式，原生路径图片与 ImageList 都必须真正执行平铺、等比缩放、铺满裁剪、原始居中或拉伸，不能只保存属性后仍统一 StretchBlt。

## OpenCV 4.14.0 x64 图像模块（2026-08-01）

- 用户模块为 `lingbuilder.opencv@1.0.0`；只读资产模块为 `lingbuilder.opencv.sdk@4.14.0+bridge.1`。模块管理器只显示用户模块，并通过 OpenCV 模块家族展示 SDK 已安装或缺失状态。
- 首版固定 Windows、MSVC、x64、动态 CRT `/MD`、C++17、CPU 模式，只构建 OpenCV `core`、`imgproc`、`imgcodecs`。由于 OpenCV dispatch 生成器在中文绝对路径下会写出窄编码 include，SDK 构建固定使用 SSE2 baseline 并关闭 `CPU_DISPATCH`，避免生成损坏路径；这不改变公开 ABI。
- `.lcpp` 只接触 `OpenCV图像句柄`、`OpenCV结果句柄` 两类受管 64 位句柄。确定性运行时位于 `electron/src/services/windowDesigner/opencvRuntime.ts`，统一调用 `LB_OCV_*` ASCII C ABI；文本返回使用两次长度查询和调用方缓冲区，再交给 `LB_ReturnText`。
- 原生 Bridge 位于 `electron/native/opencv-bridge/`，使用宽字符 Win32 文件读写配合 `imdecode/imencode` 支持中文路径；所有 OpenCV/C++ 异常在 DLL 边界转换为中文错误。单图上限 100MP，图像与结果合计最多 256 个对象，分析内部候选最多 100 个。
- `OpenCV_分析缺口` 只分析用户提供或已授权图像。无滑块时使用边缘、形态学和轮廓；有滑块时融合滑块边缘模板与背景轮廓评分。结果按置信度降序、横坐标升序稳定排列，执行间距和 IoU 抑制；不提供浏览器控制、自动拖动或验证提交。
- SDK 由 `npm run module:opencv-sdk -- --install` 生成，固定校验 OpenCV 4.14.0 源码 SHA-256，并发布 Bridge 头/LIB/DLL、三个 OpenCV DLL、许可证和逐文件运行时清单。二进制、上游源码与中间构建只保存在 `.lingbuilder/`、`.lingbuilder-build/`，不提交仓库。
- `nativeDependencyService.materializeOpenCvSdk` 是 F5、AI Bridge、原生导出和 Visual Studio 导出的统一依赖入口；版本、ABI、工具集、CRT、架构、必要文件或 SHA-256 任一不符都必须在编译前阻断。DLL 复制到 EXE 同目录，`.lcpppkg` 自动携带隐藏 SDK。
- 启用 OpenCV 后 Visual Studio 工程只生成 Debug/Release x64；Win32 目标必须在生成前返回中文阻断诊断。公开说明和完整示例位于 `electron/docs/modules/opencv/`。
- 原生验收入口为 `npm run smoke:opencv-native`，覆盖中文路径、主要图像操作、模板与单/双缺口、空候选、严格 JSON、并发读、重复释放、对象上限、标注图、模块物化、VS x64 编译及 DLL 同目录。

## 控件引用语义 `controlRef`（2026-08-01）

- `bindings.commands[].parameters[]` 是控件参数语义的唯一确定性来源。凡指向可视控件、非可视组件或设计器资源的参数必须使用 `type: "controlRef"`，并显式声明 `controlKinds`、`scope`、`runtimeRepresentation`；需要限制类型时同时声明 `controlTypes`。
- 清单校验会拒绝名称语义明显属于控件但仍声明为 `wideString` / `utf8String` 的参数，也会拒绝 controlRef 缺元数据、`insertText` / `example` 给控件占位符加引号。模块 SDK 的 C++ 迁移入口执行同一门禁。
- `ModuleService -> LingCppModuleContext -> controlReferenceService` 同时服务新手编辑器、Monaco、诊断、悬停、补全、引用、重命名、快速修复和 C++ 生成。编辑器源码保持裸控件名，后端契约再转换为宽名称、稳定 ID 或原生句柄。
- “跳转到控件”统一使用 `lingcpp.action.revealControl`，右键菜单经 `MenuService` 注册、动作经 `CommandService` 执行、定位经 `designerNavigationService` 按稳定项目/窗口/对象 ID 完成；未挂载设计器保存待处理请求。
- 全量门禁命令 `npm run module:control-ref-audit` 当前审计 88 个模块、4169 个方法、12168 个参数和 1203 个 controlRef 参数，并额外扫描 42 个模块 TypeScript 源文件中的原始 `insertText`、`example` 和 snippet 字面量；方法/参数摘要防止未来只抽样覆盖或只靠运行时归一化掩盖旧写法。
- `npm run module:control-ref-migration-check` 对主解决方案、模块演示、便携工作区、嵌套源码包和 smoke `build-request.json` 做只读迁移门禁；`npm run module:control-ref-migrate` 只改写唯一解析且兼容的引用。发布目录、构建目录和生成目录不作为可编辑源码，无法解析的真实源码会使门禁失败。
- `dataGridSchemaVersion` 当前为 1。列、行和单元格覆盖先经过 `dataGridModel.ts` 规范化，再由设计器预览和 Win32 生成器共同消费。
- `dataGridApiCatalog.ts` 是 contribution、binding、Monaco 补全和真实 C++ 符号的一致性来源。新增命令必须同时实现运行时行为和测试，不能只增加补全。
- DataGrid 当前共有 92 条目录命令；进度状态和行选择状态均有成对读写接口。`.xlsx` 导入/导出通过标准 SpreadsheetML 与 Windows ZIP Shell 实现，不启动或依赖 Excel；只处理首个工作表、仅允许静态模式，并把图片单元格作为路径文本往返。
- Win32 支持本地排序筛选及虚拟缓存；虚拟模式只更新状态并异步触发 `VirtualDataRequested`，不得在绘制回调中调用数据提供者。
- 旧 new_emoji Table 不自动转成 Win32 DataGrid；迁移服务只添加统一结构化编辑字段，保留原模块类型、后端和生成适配器。new_emoji 不声明支持 Win32 `表格_` 命令。结构化编辑字段在 new_emoji 原生生成时必须先转换为基础列/行 ABI；在上游没有明确 JSON 契约前，不得把 `tableColumnsEx/tableRowsEx` 对象数组直接传给 Ex setter。

## 受控构建生成与 Protobuf（2026-08-01）

- `electron/src/services/build/` 提供统一构建图、`BuildStepProvider` 注册表和 Pipeline。步骤固定包含 ID、Provider/版本、阶段、依赖、输入、输出和结构化选项；执行统一做拓扑排序、循环/路径越界诊断、取消、进度、结构化日志、原子输出回滚和增量指纹。
- v2 模块只允许声明 `build.codeGenerators[]`，不能声明 `buildSteps`、Shell、PowerShell、任意可执行文件或注入 JavaScript。Provider 必须由 IDE 内置注册，未知 Provider、版本不匹配、重复 ID、路径越界、输出覆盖源码和不支持的 target 必须在规划阶段阻断。通用公开 `buildSteps` 延后到第二套独立生成器通过同一安全验收后再发布。
- `bytes` 是 LingCpp 的正式字节集类型，模块 ABI 使用调用方拥有的 `const unsigned char* + size_t` 输入和“查询长度后写入调用方缓冲区”输出；DLL 边界不得传递或释放 STL。真实字节序列从旧 `raw` 迁移，opaque 原生值仍可保留 `raw`。
- 内置 `lingbuilder.data.protobuf` 使用固定 `lingbuilder.protobuf.protoc` Provider。`.proto`、import、`.pb.h`、`.pb.cc`、descriptor set、运行时和工具随 F5、AI Bridge、CLI 与 Visual Studio 导出进入同一 Pipeline。SDK 必须离线放置于 `.lingbuilder/toolchains/protobuf`，固定版本为 27.3.0，并由 `runtime-manifest.json` 对所有文件执行大小/SHA-256 校验；缺失、篡改、版本或架构不符直接阻断，禁止联网下载或回退系统 `protoc`。
- Protobuf Provider 会解析本地 `import` 依赖并把依赖文件纳入增量指纹；构建步骤在临时 staging 目录中执行，声明产物成功后才原子提交到构建/导出目录，失败或取消会清理 staging 并恢复旧产物。

## new_emoji Tabs 页面创建顺序与 Container 尺寸（2026-08-02）

- `lingbuilder.new_emoji.ui/Tabs` 的页面 Panel 必须在所有页面子控件创建后再调用 `EU_SetTabsPageElements`；不要在页面仍隐藏或未完成布局时提前绑定后再只切换 `visible`。
- 页面切换必须继续使用稳定页面 ID 和同级 Panel，不得用 React 状态或手工坐标修正运行时布局。新增外部 HWND 子宿主时也必须遵守相同的创建顺序。
- `lingbuilder.new_emoji.ui/Container` 的设计器宽高是显式尺寸，模块 runtime mapping 必须生成 `EU_SetPanelLayout(hwnd, element_id, 0, 0)`，禁止让 ABI 默认 `fill_parent=1` 覆盖设计器模型。
- 模块清单或生成器修改 Tabs/Container 时，至少验证 `17–24` 页面子控件创建顺序、Container 布局 setter、x64 Release 编译和实际页切换；不能只检查设计器静态预览。

## 三界面模块类型化运行时控件（2026-08-05）

- `win32ControlRegistry.ts` 和 new_emoji `designerControls[].runtime` 是单一能力目录。目录生成具体 LingCpp 类型、创建器、文本/整数标记查找器、可用操作和事件绑定；React、语言服务和 C++ 生成器不得复制 12/20/93 控件清单。旧兼容 Grid、ReBar、Pager 与非可视对象排除。
- 设计器模型使用可选 `tagText`/`tagInteger`，不升级旧项目 schema。`controlTagService` 统一执行 trim、int32、当前窗口+具体类型+标记类别非空唯一性；复制粘贴遇到冲突时只清空冲突标记并返回提示，撤销重做与持久化保存原值。
- `ModuleRuntimeControlContribution` 声明具体 LingCpp 类型、父级角色、尾部可选参数及默认值。新手模式、Monaco、AI Bridge 诊断和生成器共同消费 `runtimeControlTypeService` 与模块 binding；控件引用仅支持局部变量、参数和返回值，禁止常量、数组、成员、项目全局及工作线程。
- 普通 Win32 的 32 个可视控件进入窗口级注册表，静态/动态实例共用查找、操作、事件与失效语义，并保持“一实例一独立主 HWND”。new_emoji 的 93 个控件使用窗口级元素记录，保存元素 ID、具体类型、父级、标记、动态处理器、容器能力和存活状态。
- new_emoji 旧专属 API 中，真实单一输入元素 ID 在生成清单时转换为 `controlRef(stableId)`；专属主元素参数尽量附具体 `controlTypes`。输出指针、请求 ID、索引、数量和 ID 数组保持原 ABI 类型，禁止依靠语言服务参数名称猜测补救。
- 动态事件 binding/解绑从实际事件目录生成。Win32 代码绑定优先于设计器处理器，解绑后回退设计器绑定；new_emoji 当前 918 项事件按 20 种原生回调 ABI 分组分发，同一底层通道只有在最后一个事件解绑后才卸载回调。
- 验收入口 `npm run smoke:runtime-controls-native` 必须同时链接 new_emoji 93 项目录工程和 Win32 基础/高级动态控件工程的 Win32、x64 目标。F5、原生预览、AI Bridge `build.run/native.export` 与 Visual Studio 导出必须得到一致生成结果。
> 2026-08-08 CEF3 message-loop/browser lookup group: added real typed-handle C ABI and official V4 dispatch for `cef_run_message_loop`, `cef_quit_message_loop`, and `cef_browser_host_get_browser_by_identifier`. Because the Bridge initializes CEF with `multi_threaded_message_loop`, run/quit return an explicit `NOT_SUPPORTED` status rather than calling single-thread-only CEF APIs; browser lookup is UI-thread dispatched and returns a managed Browser alias. Current public coverage is `985/1384` (71.17%), `planned=399`, `needsReview=399`.
> 2026-08-08 CEF3 ViewDelegate group: all 11 public `cef_view_delegate_t` entries now have real stable C ABI exports, official signature-hash V4 dispatch, managed `ViewDelegate`/`View` validation, CEF UI-thread execution, V3 size/rect structures, and native lifecycle tests. V4 size outputs use the existing controlled `cef3.views.size.v1` JSON schema; callback booleans and int32 bounds are range-checked. Current public coverage is `996/1384` (71.97%), `planned=388`, `needsReview=388`.
> 2026-08-08 CEF3 WindowDelegate group: all 23 public `cef_window_delegate_t` methods now use stable C ABI exports and official signature-hash V4 dispatch. Default top-level windows receive an internal no-op `CefWindowDelegate`, returned parents are managed Window aliases, key/rect data use versioned V3 structures, and compound Linux/titlebar outputs use UTF-16 two-stage controlled JSON. Current public coverage is `1019/1384` (73.63%), `planned=365`, `needsReview=365`.
> 2026-08-08 CEF3 DownloadItem group: all 20 public `cef_download_item_t` methods now use stable C ABI exports and official signature-hash V4 dispatch. Download callbacks copy official CEF values into immutable managed snapshots and never retain the callback-scoped `CefDownloadItem`; `HandleRelease` is the explicit snapshot invalidation boundary, including after browser close. UTF-16 outputs use two-stage buffers, signed CEF values such as unknown percent/total remain legal values, and callback-selected file paths pass the existing allowed-root validator. Current public coverage is `1039/1384` (75.07%), `planned=345`, `needsReview=345`.
> 2026-08-08 CEF3 DownloadHandler group: the three public `cef_download_handler_t` callbacks are implemented by the managed Browser client with explicit per-browser subscriptions, official signature-hash V4 dispatch, and real native downloads. `CanDownload` preserves CEF's synchronous boolean decision, `OnBeforeDownload` completes through a managed continuation on its originating CEF thread, and update events carry only controlled snapshot fields. Returned paths are parsed through CEF's structured dictionary parser and pass the existing allowed-root validator. Current public coverage is `1042/1384` (75.29%), `planned=342`, `needsReview=342`; the full group verification sequence passes.
> 2026-08-08 CEF3 download callback group: `cef_before_download_callback_t.cont` and all three `cef_download_item_callback_t` control methods now have stable C ABI exports, official signature-hash V4 dispatch, and native CEF 150 tests. Before-download completion is an exactly-once managed continuation with UTF-16 allowed-root validation. Download control callbacks use a dedicated managed typed handle with explicit registration, type validation, `HandleRelease`, weak Browser ownership, CEF UI-thread dispatch, notification-scope auto-release, retained-handle support, and deterministic Browser-close invalidation. Current public coverage is `1046/1384` (75.58%), `planned=338`, `needsReview=338`.
> 2026-08-08 CEF3 base lifecycle group: all five public `cef_base_ref_counted_t` / `cef_base_scoped_t` methods now project CEF ownership onto the managed handle registry through stable C ABI exports and official V4 hashes. No CEF `self` pointer or address crosses the ABI. Retain, last-release detection, one-reference queries, scoped deletion, overflow rejection, released-handle errors, and XmlReader/ZipReader final-release thread affinity share one checked implementation. Current public coverage is `1051/1384` (75.94%), `planned=333`, `needsReview=333`.
> 2026-08-08 CEF3 RequestContext host resolution group: `cef_request_context_t.resolve_host` and `cef_resolve_callback_t.on_resolve_completed` now use stable C ABI exports and official signature-hash V4 dispatch. A managed Task owns completion state; the CEF UI callback immediately copies the result code and IP strings into controlled `cef3.resolveHostResult.v1` JSON, exposed only through UTF-16 two-stage reads. Negative CEF DNS errors are preserved inside a successfully completed callback result. Current public coverage is `1053/1384` (76.08%), `planned=331`, `needsReview=331`.
> 2026-08-08 CEF3 RequestContext handler group: `cef_request_context_t.get_handler` and `cef_request_context_handler_t.on_request_context_initialized` now have stable C ABI exports, official V4 hashes, a registered `REQUEST_CONTEXT_HANDLER` typed handle, type checks, explicit `HandleRelease`, and nullable initialization semantics. The actual Bridge handler captures the Context supplied by CEF; public reads create managed Context aliases and never expose the handler or context pointer. Handler-to-state ownership is weak to prevent cycles. Current public coverage is `1055/1384` (76.23%), `planned=329`, `needsReview=329`.
> 2026-08-08 CEF3 preference/setting observer group: all four public observer registration/callback methods now use stable C ABI exports and official V4 hashes. The shared `OBSERVER_REGISTRATION` typed handle stores an explicit observer kind and UI-thread-released `CefRegistration`; callbacks deliver copied `cef3.preferenceChanged.v1` or `cef3.settingChanged.v1` JSON through per-call managed Tasks. Event queues are bounded, wrong observer kinds fail type validation, and final `HandleRelease` fails pending Tasks before releasing CEF registration. Current public coverage is `1059/1384` (76.52%), `planned=325`, `needsReview=325`.
> 2026-08-08 CEF3 MediaRouter acquisition group: `cef_request_context_t.get_media_router` and the global `cef_media_router_get_global` now have stable C ABI exports and official V4 dispatch. Router objects are registered as `MEDIA_ROUTER` typed handles, never exposed as CEF pointers, and their final `CefRefPtr` is released on the CEF UI thread. An internal weak-state completion callback tracks Router readiness without changing the official immediate nullable handle return or exposing callback ownership through the ABI. Current public coverage is `1061/1384` (76.66%), `planned=323`, `needsReview=323`.
> 2026-08-08 CEF3 MediaSource group: `cef_media_router_t.get_source`, `cef_media_source_t.get_id`, `is_cast_source`, and `is_dial_source` now have stable C ABI exports and official V4 dispatch. A dedicated `MEDIA_SOURCE` typed handle provides registration, GetState type validation, explicit release invalidation, and CEF UI-thread final-reference release. URN input is non-null UTF-16, ID output uses two-stage UTF-16 buffers, and nullable source results never expose CEF pointers. Current public coverage is `1065/1384` (76.95%), `planned=319`, `needsReview=319`.
> 2026-08-08 CEF3 MediaRouter refresh group: `cef_media_router_t.notify_current_routes` and `notify_current_sinks` now use stable C ABI exports, official V4 hashes, strict zero-argument validation, managed Router type checks, release invalidation, and CEF UI-thread dispatch. Pre-readiness refreshes are coalesced in managed state and run only after CEF's internal readiness callback; handle release cancels pending flags before UI-thread final-reference release. The operations expose no callback vectors or temporary CEF objects; observer delivery remains a separate managed Task/typed-handle group. Current public coverage is `1067/1384` (77.10%), `planned=317`, `needsReview=317`.
> 2026-08-08 CEF3 MediaObserver collection group: `cef_media_router_t.add_observer`, `cef_media_observer_t.on_sinks`, and `on_routes` now use stable C ABI exports and official V4 hashes. The `MEDIA_OBSERVER` handle owns `CefRegistration`, bounded per-kind queues, and pending managed Tasks. Callback vectors remain in `MEDIA_SINK_COLLECTION` / `MEDIA_ROUTE_COLLECTION` state and are taken from a completed Task exactly once; indexed access creates typed Sink/Route handles, while task JSON contains no handle values. Releasing the observer fails pending Tasks and releases registration on CEF UI. The CEF 150 MSVC test gate isolates real MediaRouter notification assertions because libcef fast-fails in process shutdown after that subsystem is activated; a separate full regression process still verifies the ordinary `CefShutdown` path. Current public coverage is `1070/1384` (77.31%), `planned=314`, `needsReview=314`.
> 2026-08-08 CEF3 local HTTP Server group: `cef_server_create`, `on_server_created`, `on_server_destroyed`, both client connection callbacks, `on_http_request`, and all 12 non-WebSocket `cef_server_t` methods now have stable C ABI exports and official V4 hashes. A `SERVER` typed handle owns only managed state and a `CefServer` reference; final handle release requests shutdown and the official destroyed callback invalidates the object. Creation/events use bounded managed Tasks, callback Request values are taken exactly once as typed handles, and no connection or handle address is embedded as an ABI pointer. Server-thread-only queries post through `GetTaskRunner`; HTTP bodies use managed buffers and extra headers use a validated UTF-16 string Dictionary. The Bridge accepts only loopback listeners. Current public coverage is `1088/1384` (78.61%), `planned=296`, `needsReview=296`.
> 2026-08-08 CEF3 Server WebSocket group: `on_web_socket_request`, `on_web_socket_connected`, `on_web_socket_message`, and `send_web_socket_message` now have stable C ABI and official V4 dispatch. Handshake callbacks expose an exactly-once managed continuation with deadline/default rejection and a typed Request result; message callback memory is copied before return into a managedBuffer task result. Unobserved handshakes are rejected immediately, oversized callback payloads close the connection, and no byte pointer crosses the ABI. Current public coverage is `1092/1384` (78.90%), `planned=292`, `needsReview=292`.
> 2026-08-09 CEF3 public coverage closure: the CEF 150.0.14 Windows MSVC x64 bridge now implements all `1384/1384` public entries (`100.00%`, `planned=0`, `needsReview=0`). Generated catalog and docs, C ABI symbols, official V4 dispatch IDs, and native test references are enforced together by `npm run module:cef3-coverage:complete`; all object results remain registered typed handles and all bytes remain managed buffers.
