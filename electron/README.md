# LingBuilder Electron

> 2026-08-03：修复 new_emoji Table 结构化编辑器把对象行直接传给 Ex setter 后在原生窗口显示 JSON 的问题。`dataGridColumns/dataGridRows` 现在统一通过 `EU_SetTableData` 的基础列/行 ABI 生成；明确为字符串列表的旧 `tableColumnsEx/tableRowsEx` 仍保持兼容调用。回归测试位于 `tests/dataGrid.test.ts`。

> 2026-08-03：`lingbuilder.net.http-client@2.0.0` 已完成 74 条受管 API 的原生闭环。WinHTTP runtime 统一提供客户端/请求生命周期、异步 UI 回调、请求头、文本/JSON/字节集/文件上传下载、代理/凭据、TLS 验证与 SHA-256 pin、Cookie、自动解压、重定向、超时、资源上限和响应快照；普通 Win32 使用 `WM_LINGBUILDER_HTTP_CLIENT_EVENT`，new_emoji 使用独立消息窗口，旧 `HTTP客户端_请求/GET/POST` 等入口保持兼容。正式说明见 `docs/modules/http-client/README.md`，生成回归为 `tests/httpClientRuntime.test.ts`，真实原生验证为 `npm run smoke:http-client-native`，模块示例可用 `npm run module:demos -- --module lingbuilder.net.http-client --skip-export` 重新生成。

> 2026-08-03：`lingbuilder.websocket.client@2.0.0` 已从 5 条窗口级同步原型升级为 51 条受管 API 和稳定 `WebSocket连接` 类型，支持多连接、后台握手/接收、`ws://`/`wss://`、文本/二进制、Origin、子协议、自定义请求头、代理、HTTP Basic、系统证书验证、SHA-256 证书固定、资源限制、自动重连、事件快照和统计。普通 Win32 与 New_Emoji 复用同一 WinHTTP 运行时；Win32/x64 和 New_Emoji x64 已通过真实 MSVC 编译及本地断线重连 smoke。正式说明见 `docs/modules/websocket-client/README.md`，验证命令为 `npm run smoke:websocket-client-native`。

> 2026-08-03：`lingbuilder.http.server@2.0.0` 已从 5 条同步单连接原型升级为 48 条受管 API 和 `HTTP服务端`、`HTTP请求` 两个公开类型，支持后台接受线程、1–64 工作线程、有界连接队列、路由、HTTP/1.0/1.1、keep-alive、Content-Length/chunked、完整请求读取、文本/JSON/二进制/文件/Cookie/重定向响应、资源限制和统计。默认监听门禁校验解析后的实际 IPv4/IPv6 回环地址，请求目标拒绝非法百分号编码和非法 UTF-8 解码结果；请求通过窗口消息回到普通 Win32 或 New_Emoji UI 线程；Win32/x64 和 New_Emoji x64 已通过真实 MSVC 编译及协议 smoke。正式说明见 `docs/modules/http-server/README.md`，验证命令为 `npm run smoke:http-server-native`。模块是嵌入式 HTTP/1.1 服务端，公网 TLS/HTTP2 应由反向代理或网关提供。

> 2026-08-03：`lingbuilder.websocket.server@2.0.0` 已从 6 条同步单连接原型升级为 50 条受管 API 和 2 个公开类型，支持后台多客户端 `WSAPoll`、文本/二进制、分片、UTF-8、Ping/Pong、关闭握手、Origin/路径/子协议、资源限制、有界发送队列、客户端状态与统计。事件通过窗口消息回到普通 Win32 或 New_Emoji UI 线程；Win32/x64 和 New_Emoji x64 已通过真实 MSVC 编译及 RFC 6455 协议 smoke。正式说明见 `docs/modules/websocket-server/README.md`，验证命令为 `npm run smoke:websocket-server-native`。模块当前提供 `ws://`，公网 `wss://` 由反向代理或网关终止 TLS。

> 2026-08-02：`lingbuilder.system.clipboard@1.1.0` 已从 4 条文本/状态命令扩展为 10 条剪贴板 API，新增图片字节集、DIB/BMP 读写、图片格式查询和 GIF 原始字节读写。GIF 写入同时登记 `GIF`、标准 MIME `image/gif` 与 `HTML Format`，不解码、不重编码，通用图片写入也会自动保留动画帧；单个图片/GIF 上限为 256 MB。详见 `docs/modules/clipboard/README.md`，回归测试位于 `tests/modules.test.ts`。

> 2026-08-02：修复 New_Emoji 原生 C++ 生成程序跨显示器拖动时只继承系统 DPI 的问题。`wWinMain` 现在在 COM、窗口和控件创建前动态启用 `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2`，仅在旧系统或 API 不可用时回退 `SetProcessDPIAware`；new_emoji DLL 随后可以收到 `WM_DPICHANGED` 并按目标显示器重新布局。生成结果和 `new-emoji-92-tabs-validation` 示例同步更新，避免 100%/150% 屏幕之间出现 1.5 倍窗口和控件错位。

> 2026-08-01：`lingbuilder.input.mouse@2.0.0` 已封装为 29 条三分类 API：全局真实输入（前台）15 条、指定 HWND 窗口消息输入（后台）6 条、UI Automation（后台）8 条。模块详情、文档和演示逐条标注前台/后台及是否移动或占用系统鼠标；窗口消息使用 `PostMessageW` 不移动光标，UIA 使用受管元素句柄按控件语义操作。Win32/new_emoji 生成代码在 `CoUninitialize` 前清理 UIA 引用；`鼠标_相对移动` 按 Windows 输入增量说明，实际位移受速度/加速度设置影响。详见 `docs/modules/mouse/README.md`。

> 2026-08-01：`lingbuilder.input.keyboard@2.0.0` 已从 5 条基础命令扩展为 31 条分类 API，覆盖全局状态、键码/扫描码转换、前台 `SendInput` 虚拟键/扫描码/Unicode 输入、指定 HWND 的后台 `PostMessageW` 按键与文本消息。模块详情按作用域分类，每条命令标明焦点和实体键盘影响；不提供 `BlockInput` 或低级记录钩子。详见 `docs/modules/keyboard/README.md`，Win32/x64 原生验收为 `npm run smoke:keyboard-native`。

> 2026-08-01：`lingbuilder.threading@2.0.0` 已提供 54 条项目级受管并发命令和 7 个公开类型，覆盖任意多参数深拷贝、类型化结果、进度/完成 UI 回调、协作取消、默认/自定义有界线程池、互斥锁、64 位原子整数、事件和信号量。旧 9 条演示命令不兼容删除并提供迁移诊断。普通 Win32 生成使用 C++17 项目运行时和仅负责通知的 `PostMessageW` adapter；`npm run smoke:threading-native` 对 Win32/x64 执行真实 MSVC 编译运行及并发边界验证。

> 2026-08-01：磁盘信息模块升级为 `lingbuilder.system.disk@1.1.0`，公开 28 条只读命令和 8 个 `record/array` 类型，覆盖容量、卷与挂载点、文件系统能力、物理磁盘、SSD/TRIM、扇区和分区布局；原 5 条命令保持兼容。结构化命令 binding 只在生成工程内部使用 `struct/std::vector`，带原生 DLL 的 target 会被清单门禁拒绝。`npm run smoke:disk-native` 对 Win32/x64 执行真实 MSVC 编译运行。

> 2026-08-01：模块公开类型支持 manifest v2 向后兼容的 `opaque`、`record`、`array`。旧类型仍按不透明类型处理；公开记录声明字段、嵌套和字段数组，公开数组声明元素类型。模块清单校验、模块公开信息和搜索、AI 上下文、Monaco/新手补全与诊断、项目数据类型嵌套及普通 Win32/new_emoji 生成共用 `modulePublicTypeService`；记录生成 C++ `struct`，数组映射为 `std::vector<T>`。该映射只属于生成工程内部值语义，预编译 DLL 仍必须使用稳定 POD、缓冲区或受管句柄 ABI，不能直接跨边界传递 STL/C++ 对象。

> 2026-07-31：CEF3 `3.0.0-alpha.2` 的覆盖 v2 当前登记 1577 项能力：265 `implemented`、8 `internal`、185 `notApplicable`、1119 `planned`。应用只包含/链接 `LingBuilderCefBridge`。objects 的 183 条命令与 session 的 19 条命令已清零各自 planned，真实覆盖 Value/Dictionary/List/Binary、Image、NavigationEntry、完整 MenuModel、X509Certificate/Principal/SSLStatus、导航历史、独立 RequestContext、Preference、Cookie、缓存和认证/连接清理。原生 x64 测试验证真实 HTTPS 证书、菜单快捷键/颜色/字体、导航历史 JSON、对象深复制与双会话隔离。Bridge 当前真实接通 27 个上游事件签名，仍有 86 个事件签名和其它网络/传输、自动化、OSR、Views、平台能力待实现，不能把 alpha 描述成 CEF 全功能完成。

> 2026-08-01：FBro VIP 指纹子模块保持官方覆盖 188/188、planned=0。`lingbuilder.fbro.vip` 将 188 项官方能力逐项公开为 179 条单项安全命令、6 条 Bridge 自动管理能力和 3 条凭据中心/安全入口替代能力，并保留 10 条批量与通用高级入口。普通 Win32 与 New_Emoji 共用同一 Bridge；文件路径限制在生成程序目录，二进制只接受受管缓冲，授权信息脱敏且不回传 Key。全 FBro 普通 API 目录仍为 397 implemented、678 个非事件高级签名 planned、3 internal notApplicable、1 advanced notApplicable，因此不能把 VIP 或事件完成描述成 1079 项全功能完成。

> 2026-08-01：FBro 模块族与 Bridge 升级为 2.1.0，主事件协议为兼容 C ABI v3，同时保留 v1/v2。v3 提供稳定事件 ID、结构化 UTF-16 JSON 响应、按事件订阅、受管对象和延续句柄、完成/取消 API；普通通知异步投递，即时决策默认 2 秒，延迟决策按安全、查询、文件类别使用 5/30/120 秒。事件目录现有 174 个“类+方法”槽位、158 个唯一签名，零 `planned/needsReview`；`module:fbro-events:complete` 会校验目录、真实 override/schema/测试以及已安装头、LIB、DLL。普通 Win32 与 New_Emoji 共用 v3 协议，原生 smoke 均通过。延续由 Bridge 受管计时线程超时；正常关闭会取消延续、隐藏最后窗口并保留 HWND/消息泵等待 Closed，5 秒后才 fallback。无交互压力测试覆盖事件风暴、完成/取消/重复完成、30 秒超时、关闭清理和 100 次生命周期。FBro 5.38.49 可视 Basic Auth UI 未经过预期 BroEvent override，属于已知 SDK 边界，不再运行会弹登录框的测试。

> 2026-07-30：新增完整通用密码学模块：哈希、密码哈希/派生、对称加密和非对称密码。运行时使用固定版本 Botan 3.12.0 与官方 BLAKE3 C 1.8.5；运行 `npm run module:crypto-sdk -- --install` 可生成并安装 Win32/x64 SDK 和 `.lbmod`，文件由 SHA-256 清单校验。启用任一通用加密模块后，F5、AI Bridge 构建和 VS 导出会自动物化头文件、BLAKE3 C 源、对应架构 `botan-3.lib`/DLL，并强制 MSVC、动态 CRT 与 C++20。`npm run smoke:crypto-native` 同时编译 Win32/x64，运行标准哈希向量、密码哈希、全部对称算法和 RSA/ECC/SM2/ElGamal 闭环。

> 2026-07-28：修复 FBro 初始化/拖动窗口时的“未响应”。`LB_FBro_Resize` 不再阻塞等待 CEF 创建锁，且只调整宿主直接子窗口，避免递归移动 Chromium 内部 HWND。实际 `fbro` Debug exe 运行 12 秒保持响应，百度页面脚本成功执行。

> 2026-07-28：修复 FBro 窗口改变大小后后退、前进、刷新与地址栏错位。示例的六个导航/浏览器控件现在统一按 `窗口_取事件DPI()` 换算位置和尺寸，避免 150% 等系统缩放下混用物理像素。

> 2026-07-28：FBro 单窗口浏览器示例增加完整导航栏和随窗口变化的自适应布局；新增 `控件_设置位置大小` 确定性命令。FBro `OnBeforePopup` 现在同步取消新窗口并投递 `BeforePopup` 目标 URL，LCPP 可在当前实例中接管导航。

> 2026-07-28：修复 FBro F5 偶发白屏和窗口未响应。桥接层现在将所有 `FBroHsCreate` 统一投递到 CEF UI 线程，消除初始化完成顺序导致的跨线程创建竞态；每控件 profile 使用 `.fbro-global-cache` 的直接隔离子目录，旧相对/嵌套路径由桥接层稳定映射，根目录外绝对路径安全回退。`npm run test:fbro-invalid-vip` 现在也会拒绝任何 `cache_path` 或 `Cannot create profile` 日志。当前 `fbro` Debug 程序实测连续 8 秒响应、5 个子进程稳定、百度页面脚本成功执行并正常关闭。

> 2026-07-28：FBro VIP Key 改为由每位 IDE 用户自行配置。“设置 → 浏览器凭据”提供保存、替换、清除与状态显示，使用 Electron `safeStorage` 写入当前 Windows 用户的加密凭据目录；renderer 只能读取“是否配置/来源”，不能取回现有明文。Key 仅在 F5、原生运行和新启动的 AI Bridge 子进程中通过临时环境注入，不进入项目、设计器模型、源码、日志、AI 上下文或设置同步包。`LINGBUILDER_FBRO_VIP_KEY` 继续作为无人值守和脱离 IDE 运行导出工程时的兼容后备。可运行 `npm run test:fbro-invalid-vip` 自动编译并启动真实 MSVC x64 程序；测试用假 Key 只存在于子进程环境，必须看到“FBro VIP 授权码校验失败”且不得输出 Key。退出使用 C++ SDK 的 `FBroShutdown(FALSE)` 并等待浏览器关闭回调，不能强制结束测试进程。

> 2026-07-27：新增内置 `lingbuilder.fbro.browser`。启用后工具箱“媒体”分类显示 `FBro指纹浏览器 (FBroBrowser)`，可像 CEF3 控件一样拖入可视化窗口并绑定事件；每实例生成独立宿主 `HWND` 与 profile。用户工程只链接 `LingBuilderFbroBridge` C ABI，模块固定 MSVC x64 并与 CEF3/其它 `libcef.dll` 互斥。开发机运行 `npm run module:fbro-sdk -- --install` 可从官方 FBro 目录生成 `lingbuilder.fbro.sdk`；首次 F5 按 SHA-256 清单物化 CEF 135.0.21 的 78 项运行时（389,770,453 字节），后续只更新新增、缺失或损坏文件，VS 导出携带完整运行时和同一增量脚本。发布命令通过 `verify:fbro-release` / `verify:fbro-installer` 校验源 SDK、解包目录和安装包。正式随 IDE 分发前仍须确认官方重新打包许可。

> 2026-07-27：new_emoji 模块完成 92 控件属性/事件全量运行时封装。生成清单现含 698/698 属性与 902/902 事件映射；C++ 生成器应用结构化 Setter、表格复合配置、按钮经过/按下颜色和聚合鼠标/焦点/值变化回调。Upload 使用 `FilesSelected` / `UploadAction`。修改上游控件目录或导出后必须运行 `npm run module:new-emoji -- --install` 并保持模块完整性测试通过。

> 2026-07-24：IDE 与 AI Bridge 的受控 C++ 构建统一按原始字节读取编译器输出，优先严格 UTF-8、失败时回退 GB18030，避免中文 MSVC 诊断和路径出现 `��`。LingCpp `调试输出` 支持英文逗号分隔的任意数量参数。

> 2026-07-27：`.lcpp` 支持项目功能库。使用 `功能库 名称 ... 结束功能库` 声明一个文件一个、无状态的复用单元，并以 `功能库名.功能名(...)` 跨文件调用。项目树可新建、复制和跨项目粘贴功能库；粘贴会递归收集间接功能库、嵌套项目数据类型、项目常量/全局变量初始化链和模块引用。目标相同定义会复用，间接功能库重名会自动生成唯一副本名并改写调用，不同项目级定义会在确认前阻止覆盖；新增源码、项目资源与模块引用在同一可回滚事务中落盘。F5、原生预览/导出和 AI Bridge 诊断继续消费同一 `lingCppSources` 集合与功能库项目上下文。

## LingBuilder 解决方案文件

- 工作区根目录的 `<解决方案名称>.lbsln` 是用户可见的解决方案入口，可双击、拖入或通过“打开项目”选择。
- `.lbsln` 保存解决方案 ID、名称、启动项目、项目摘要及内部状态路径；完整状态继续保存在 `.lingbuilder/solution.json`。
- 新工作区和旧工作区首次读取解决方案时都会自动生成 `.lbsln`，新增/删除项目、项目引用和启动项变化会同步更新。
- `generated/cpp/<项目>/<项目>.sln` 是导给 Visual Studio 的标准解决方案，不是 LingBuilder 入口。

## LCPP 源码包

- `.lcpppkg` 是可直接分享的单文件源码包。文件菜单、命令面板和项目右键菜单均提供“一键导出 LCPP 源码包”。
- 导出前工作台会提交并保存当前草稿；包内包含目标项目的完整依赖闭包、源码、配置、设计器、项目资源、模块引用及已启用第三方模块。无命令、无 target 的 SDK/资产载体模块也会随包携带。
- 源工作区存在 `.lingbuilder/build-configuration.json` 时会随包保留 Debug/Release 与 Win32/x64 设置；切换到导入工作区后，工作台会重新读取该配置。若旧包缺少配置，CEF3、FBro、OpenCV 等 x64-only 模块会在首次构建前自动选择并持久化 x64。
- 每个包包含 `lingbuilder-source-package.json` 和独立 `workspace/`，清单记录全部文件大小及 SHA-256。导入拒绝路径越界、符号链接、额外文件、哈希不一致、超过 1GB 的包和超过 2GB 的解压内容。
- 源码包清单版本 2 还记录最低生成器版本和 `requiredCapabilities`。导出项目使用 ListView 高级 API 时会记录 `win32.listview.advanced-api.v1`，使用类型化行构造器时会记录 `win32.listview.structured-rows.v1`（最低生成器 0.2.7）；导入会在生成 C++ 前检查能力，避免旧版 IDE 先生成源码、最后才在 MSVC 阶段集中报 `C3861`。
- 旧版 v1 `.lcpppkg` 仍可由新版 IDE 安全迁移；导入时会重新扫描包内 `.lcpp`，补齐能力清单后再执行生成器能力校验。
- 双击、拖入或选择 `.lcpppkg` 后，桌面宿主会把它导入“文档/LingBuilder/已导入源码”的唯一新目录并直接打开；不会覆盖已有工作区，第三方模块也只在新工作区内生效。
- `.env`、PEM/PFX/P12/KEY、常见私钥文件以及 credentials/secrets/tokens JSON 默认排除，并在导出及导入提示中列明。

## 集成终端

- 底部“终端”页使用 xterm 渲染，服务端通过 `node-pty` 提供真实 PTY；Windows 使用随包输出的 ConPTY，支持 PowerShell 与 CMD 多会话。
- 终端工作目录限制在当前工作区 realpath 内，支持输入、输出、环境变量、尺寸同步、会话关闭以及切换面板后的缓冲恢复。
- 终端接口仅供带桌面 renderer 会话凭据的可见交互界面使用，不属于 AI Bridge 工具能力；服务关闭时会回收全部 PTY。
- 原生预编译文件通过 `asarUnpack` 随安装包输出，并使用 `npmRebuild: false` 避免在用户机器或打包机重复编译；升级 Electron 或 `node-pty` 后必须重新执行 `npx electron-builder --dir` 和 `npm run smoke:packaged`。

## 原生调试

- 原生调试使用开源 LLVM `lldb-dap`，通过标准 DAP 完成启动、普通/条件断点、继续、逐过程、逐语句、跳出和停止。可将 `lldb-dap` 加入 PATH，安装到常见 LLVM 目录，或显式设置 `LINGBUILDER_DEBUG_ADAPTER`。
- 不复用或打包仅许可 Microsoft VS Code/Visual Studio 的 cppvsdbg；找不到合法适配器时返回中文环境诊断。
- 调试目标、cwd、断点源文件都限制在当前工作区 realpath 内；`.lcpp` 断点必须由生成器 source map 映射到真实 C++ 行，不能猜测行号。
- 真实后端回归入口为 `npm run test:debug-real`，需要 MSVC 与 `lldb-dap`；普通测试使用协议和服务替身，不依赖本机调试器。
- 程序暂停后，“局部变量 / 监视 / 调用栈”面板通过 DAP 读取线程、栈帧、作用域和变量；有 `variablesReference` 的值可继续展开，Watch 使用当前选中栈帧执行 `evaluate`。程序运行时这些读取会被拒绝，避免显示过期变量。

这个目录是独立的 Electron 桌面端项目，包含当前 Vite + React + TypeScript 原型的完整渲染端副本，以及 Electron 主进程壳。

> 2026-07-28：`src/fbro-ui` 新增 FBro 内嵌/谷歌原生 UI 双模式示例。`FBro_打开谷歌原生UI浏览器` 通过新 C ABI `LB_FBro_CreateChromeUi` 创建 Chrome Runtime 顶层窗口，API 不接收 LingBuilder `HWND`，桥接层使用空父窗口/预置窗口字段与 `CEF_RUNTIME_STYLE_CHROME`；内嵌浏览器仍使用独立子宿主和 Alloy Runtime。网页新窗口目标可在 `BeforePopup` 事件中显式转为受管 Chrome UI。MSVC x64 实测同时出现 LingBuilder 主窗口与 `Chrome_WidgetWin_1`，主进程保持响应。

## 目录结构

```text
electron/
  electron/
    lcppSourcePackageService.ts
    main.ts
    preload.ts
    tsconfig.json
  scripts/
    rename-electron-output.cjs
  src/
  index.html
  server.ts
  vite.config.ts
  tsconfig.json
  package.json
```

## 开发启动

第一次进入本目录安装依赖：

```bash
npm install
```

启动 Electron 桌面端：

```bash
npm run dev
```

开发模式会先构建桌面主进程与可按工作区启动的服务入口，再启动当前 Vite/React/TypeScript 原型服务并打开 Electron 窗口：

```text
http://127.0.0.1:3001/
```

开发脚本显式传入工作区、规则手册、回环 host/port，并显式启用仅限 `development + loopback` 的无会话鉴权模式。生产/安装版不能关闭会话鉴权。
开发模式从“打开工作区”“打开 LCPP 源码包”“关闭当前解决方案”或新窗口切换工作区时，Electron 会自动为目标工作区启动随机回环端口的受管 Vite 服务并切换窗口；失败会恢复原服务和工作区，不需要手工停止或重新执行 `npm run dev`。

## AI Bridge 连接中心

- “帮助 → AI Bridge 连接中心”是外部 AI 接入的默认入口。Electron 主进程通过 `AiBridgeManagerService` 启动、健康检查、停止并回收独立 CLI 子进程；renderer 只接收脱敏状态，完整 Token 仅在用户主动复制或启动受控终端时短暂取得。主进程通过 `LINGBUILDER_AI_BRIDGE_TOKEN` 子进程环境传递 Token，不把它放入进程命令行。
- Bridge 默认在 `/api/ai-bridge/mcp` 提供带 Bearer 鉴权的 Streamable HTTP MCP，并在 `/api/ai-bridge/*` 保留自动化 REST API；`--mcp` 额外启用 stdio MCP。三种入口必须复用同一 `AiBridgeService`、权限校验、工作区边界、模块上下文和审计日志。
- ChatGPT/Codex Windows 桌面客户端是独立接入面，不按 `codex` PATH 判断。`CodexDesktopIntegrationService` 检测 `OpenAI.Codex` MSIX 包和 `ChatGPT` 进程，在当前工作区 `.codex/config.toml` 管理 `mcp_servers.lingbuilder_desktop` 段，并通过 `--mcp --stdio-only` 让 Codex 直接拉起当前安装包内的 CLI。该模式不监听端口、不使用或持久化 Token；配置晚于桌面进程启动时必须显示重启提示。
- 桌面 MCP 配置必须保留用户其他 TOML 内容；遇到非 LingBuilder 托管的同名服务必须先显示冲突并获得替换确认。安装路径或权限变化时显示“需要更新”，移除操作只能删除 LingBuilder 托管段。
- 连接中心检测 Codex CLI、Claude Code、Gemini CLI，并由主进程创建带临时环境变量的 IDE PTY。Codex 使用会话级配置覆盖；Claude Code 与 Gemini CLI 的托管 JSON 只包含环境变量占位符，不保存 Token，也不修改客户端全局配置。
- 状态页展示当前端口、权限、生命周期、MCP/HTTP 地址、已连接客户端、最近工具调用和脱敏进程日志。`readonly`、`preview`、`yolo` 权限语义不变，启用 `yolo` 必须二次确认。
- Bridge 只能监听回环地址。切换工作区或退出 IDE 必须停止受管 Bridge，不能让旧工作区服务残留；关闭连接中心本身不会停止 Bridge。

## Windows 打包与安装版冒烟

```bash
npm run package:dir
npm run smoke:packaged:cli
npm run smoke:packaged
npm run package:win
```

- `package:dir` 生成 `release/win-unpacked/LingBuilder.exe` 和 `lingbuilder.cmd`；`smoke:packaged:cli` 只验证安装版 CLI 启动器与版本；`smoke:packaged` 先通过安装版自带的 Electron/Node 运行时验证 CLI 版本，再启动桌面程序并验证 renderer、普通 API、模块 API、退出码和服务进程回收；`package:win` 生成 Windows x64 NSIS 安装包。
- 联网发布必须设置 HTTPS `LINGBUILDER_CLOUD_API_URL`。备案或云端未就绪时，在 PowerShell 中设置 `$env:LINGBUILDER_CLOUD_RELEASE_MODE='offline'` 后执行打包；离线安装版保留本地 IDE 和自定义 API，但不连接系统 AI、账号和收费模块云端。两种模式不得同时设置。
- 两条打包命令都把 CEF3 SDK 完整性作为硬门禁：打包前校验模块/版本/关键文件/x64 架构并计算全部文件的大小和 CRC32，Electron Builder 的 `beforePack` / `afterPack` 对源目录和 `win-unpacked` 再校验；`package:win` 还会从最终 NSIS 安装包归档中逐文件比对。缺少或损坏 SDK、`extraResources` 漏复制、内核版本混用时命令直接失败。可单独运行 `npm run verify:cef3-release`、`npm run verify:cef3-installer` 和 `npm run test:cef3-release` 排查。
- NSIS 安装向导默认勾选“将 LingBuilder CLI 添加到当前用户 PATH”，也允许用户取消；重复安装去重，卸载时只移除当前 LingBuilder 安装目录。CLI 由根目录 `lingbuilder.cmd` 调用 `resources/app.asar/dist/cli.cjs`，不要要求最终用户另外安装 Node.js。
- `package:win` 会先校验并复用 `build/vendor/MicrosoftEdgeWebview2Setup.exe`中已有的 Microsoft 签名 WebView2 Evergreen Bootstrapper；文件不存在时才从微软官方地址下载并冻结到 NSIS 资源。安装阶段仅在注册表未检测到 WebView2 Runtime 时补装，失败不会阻止 LingBuilder 本体安装，可稍后从“工具 → 环境修复中心”重试。
- 安装版主进程先启动不可见的独立本地服务，显式传入工作区、renderer 静态目录、规则手册、`127.0.0.1` 随机端口和随机会话 token，收到 ready 信息后才加载窗口。
- renderer 仍使用相对 `/api/*`，Electron 会自动注入本地会话 token；普通 IDE 服务拒绝 `0.0.0.0`，默认不挂载 `/api/ai-bridge/*`。
- 首次运行会在“文档/LingBuilder/起始工作区”创建干净的“未命名解决方案 / 新建项目”，只复制安装包内置模块等必要资源，不会携带开发仓库项目；以后从安装版专用的 `userData/workspace-state.packaged.json` 恢复最近工作区，开发版继续使用独立的 `workspace-state.json`。文件菜单、命令面板、解决方案根节点右键菜单和载入失败页均可“关闭当前解决方案”，该操作保留原磁盘文件并切换到新的空白工作区。工具栏“打开”使用原生选择器并由主进程自动切换受管本地服务，开发版与安装版行为一致。
- 规则手册、模块手册、renderer、server 和默认工作区模板均作为打包资源携带，不依赖安装目录或启动时的 `cwd`。

## 设计约定

- `src/` 保留现有 Web IDE 原型代码，作为 Electron 的渲染端。
- `server.ts` 继续提供本地 API 和 Vite middleware。
- `electron/main.ts` 负责窗口、生命周期和桌面宿主能力。
- `electron/preload.ts` 负责向渲染端暴露安全的桌面 API。
- 后续文件系统、终端、进程、菜单、工作区等 VS Code 式原生能力都应优先进入 Electron 主进程或 preload 桥接层。

## Win32 标准控件

- 控件唯一目录位于 `src/services/windowDesigner/win32ControlRegistry.ts`，不得再在 React、模块清单和 C++ 生成器分别维护名称/事件清单。
- 新建项目默认启用 `lingbuilder.win32.basic`；ListView、TreeView、Tab、日期、工具栏、状态栏、RichEdit 和系统通用对话框来自可选 `lingbuilder.win32.common-controls`。
- ListView 共公开 87 条确定性高层命令；其中 71 条高级命令集中在 `src/services/modules/listViewApiCatalog.ts`。数据面公开 `列表视图行`、`列表视图行集合` 命名数组和 `列表视图_创建行/创建行集合`，添加、插入、批量添加及虚拟行设置优先传结构化数组，旧 TSV 文本仅作兼容。模块 contribution、binding、成员补全和 C++ 生成回归测试必须保持同源；`src/listview-api-demo` 是全量调用和 `LVS_OWNERDATA` 15000 行虚拟列表的可分享示例。
- 设计器项目保存为 `schemaVersion: 2`，控件专属数据位于 `properties`，旧无版本项目在读取时安全迁移。
- 图片框“图片源”右侧按钮调用 Electron 原生文件对话框；选中的本地图片由 `src/services/windowDesigner/designerAssetService.ts` 复制到项目 `assets/`，模型只保存相对路径。受控预览 API、F5、原生导出及 AI Bridge 共用该服务；生成的 Visual Studio 工程会在构建后把图片复制到 exe 输出目录。
- 解决方案资源管理器中右键项目并选择“添加资源…”也可导入图片；工作台命令会按所选项目自动复制到 `assets/`（默认项目）或 `assets/<projectId>/`（多项目）。项目树的“图片资源 (assets)”组会列出全部图片：单击图片可预览真实资源和尺寸，右键图片并选择“复制相对路径”即可获得可直接用于 `.lcpp` 的路径。
- 普通 Win32 图片框可在 `.lcpp` 中调用 `图片框1.设置图片("assets/示例.png")` 动态换图，等价命令为 `控件_设置图片(图片框1, "assets/示例.png")`；也可传入 `文件对话框_取文件(...)` 返回的完整路径，传入空文本会清空图片。运行时继续使用设计器配置的填充方式。
- 图片框即使初始没有配置图片源，也会以 Win32 `SS_BITMAP` 静态控件创建；因此可以在文件已选择或文件被拖入事件中直接调用 `.设置图片(...)`，不需要先在设计器中放置一张占位图片。
- 高级模块未启用时，工具箱显示依赖状态但不能新增高级控件；项目已有高级控件不得被删除或静默替换。
- 内置 `lingbuilder.edgeview` 当前版本 `1.2.0`、最低生成器 `0.2.7`。窗口、分组框或选项卡内每个控件都有独立 HWND、Environment、Controller、WebView、Profile 和默认 `.edgeview/<controlId>` UDF；属性面板包含稳定运行期属性和 v2 创建期选项，并明确提示修改创建期属性后重建。`designer.edgeview.previewControl` 继续使用独立原生窗口，不向 React 画布嵌入 HWND。
- EdgeView 共提供 271 条中文命令：36 条兼容命令和 235 条目录化安全 API。v2 新增受管 Frame/Worker/Extension/Notification/Certificate/SharedBuffer/FileSystemHandle、完整 Options、资源响应正文、PDF 流、另存为和证书决策等。新处理器统一写 `&处理器名`；任务使用五态、`shared_ptr + generation` 和迟到回调拒绝，Loader 保持到进程退出。
- `edgeViewApiCoverage.generated.json` 固定 SDK `1.0.3537.50` / Runtime 141 与 SDK `1.0.4078.44` / Runtime 150。新基线 995 个方法的结果为 public 330、internal 565、excluded 100、pending 0。运行 `npm run module:edgeview-coverage:complete` 检查双 SDK 哈希、目录、符号、测试和漂移；`npm run smoke:edgeview-native` 执行 Win32/x64 MSVC 原生冒烟。CompositionController、PointerInfo、AutomationProvider、实验 API、Host Object、裸 COM/指针继续排除。
- 内置 `lingbuilder.cef3.browser` 模块按 v2 `contributes.designerControls` 贡献 `CEF3浏览器 (CefBrowser)` 设计器控件：项目启用后工具箱自动新增该控件，可在任意窗口添加多个实例，属性面板可设置打开地址、缓存目录、User-Agent、JavaScript/图片/WebGL 开关与代理；22 条 `CEF3_*` 中文命令和 92 项 CEF 150 浏览器回调同时进入补全、binding、设计器事件面板和确定性 C++ 运行时。事件通过 `WM_LINGBUILDER_CEF_EVENT` 回到所属窗口线程，同步决策支持默认/允许/拒绝/已处理，高频音频和进度回调限流。原生构建从 `CEF3_SDK_ROOT`、工作区 `.lingbuilder/cef3-sdk`、已安装 SDK 载体模块 `.lingbuilder/modules/lingbuilder.cef3.sdk/sdk` 或 `C:\cef3-sdk` 受控发现 CEF3 SDK，支持 CEF 官方二进制发行包布局（`include/` + `Release/` + `Resources/`，已验证 150.0.14 x64）；推荐安装离线 SDK 模块包 `cef3-sdk-x64.lbmod`。CEF3 原生依赖计划固定要求 C++20 与 `/MD`，F5、AI Bridge 和生成的 Visual Studio 四组配置会共同应用，普通项目仍使用 C++17。CEF3 同 exe 全部控件共享缓存，需要会话隔离时使用 `lingbuilder.edgeview`。
- CEF3 `OnBeforePopup` 返回允许时可创建独立原生 popup 浏览器。`CEF3_打开原生UI浏览器` 使用 `CEF_RUNTIME_STYLE_CHROME`、空父句柄与 `WS_EX_APPWINDOW` 主动创建拥有独立根 HWND、原生地址栏和完整浏览器界面的桌面顶层窗口，不复用 LingBuilder 主窗口句柄，也不依赖可能被弹窗策略拦截的网页脚本。生成运行时分别保存内嵌主浏览器与其 popup 集合，popup 创建不会覆盖主控件句柄，popup 的加载/地址/标题事件不会污染主窗口工具栏；关闭控件或主窗口时会一并关闭全部 popup。`src/cef3-2` 提供“内嵌打开 / 谷歌原生UI”双入口示例。
- CEF3 双形态宿主是固定契约：内嵌浏览器只能 `SetAsChild(控件宿主HWND, CefRect)`；谷歌原生 UI 必须 `SetAsPopup(nullptr, ...)`，并保持 `parent_window=nullptr`、`WS_EX_APPWINDOW`、非 `WS_CHILD` 和 `CEF_RUNTIME_STYLE_CHROME`。曾验证 `SetAsPopup(hwnd_, ...)` 会让 Chrome 原生界面覆盖进 LingBuilder 主窗口。2026-07-28 实机回归已确认修复后主窗口与 Chrome UI 窗口同时存在，均可独立移动和缩放。
- 当前随附 CEF 150 SDK 仅支持 x64。新项目启用 CEF3 时会自动把工作区从默认 Win32 切换到 x64，并在 F5/解决方案构建前再次校正；模块面板与任务日志会显示该自动变更。
- IDE 构建目录中的 Visual Studio 工程把 exe 输出到 `$(Platform)/$(Configuration)/bin/`，与 F5 复制的 CEF DLL、snapshot 和资源保持同目录，可从 VS 直接编译启动。`generated/cpp` 的对外可移植 SDK/资源完整性需单独验收。

## IDE 基础服务闭环

- 工作台命令统一注册在 `src/services/commands/`：支持中文标题、英文 alias、上下文 `when`、独立禁用状态、冲突诊断和可覆盖快捷键。工具菜单、常驻图标、`Ctrl+Shift+P` / `F1` 命令面板及 `Ctrl+,` 设置入口共用同一执行链路；命令面板具备键盘导航、焦点恢复、禁用态和中文空/失败状态。
- 用户/工作区配置统一由 `src/services/configuration/` 管理，优先级为“工作区 > 用户 > 默认值”。工作区文件固定为 `.lingbuilder/settings.json`；开发期用户文件默认位于 `%USERPROFILE%/.lingbuilder/settings.json`（可通过 `LINGBUILDER_USER_SETTINGS_PATH` 注入），安装版位于 Electron `userData/settings.json`。`/api/configuration` 的读取、更新与重置接口复用 schema 校验、原子持久化、旧 JSON/localStorage 迁移和损坏文件诊断；设置页可真实修改字号、编辑体验、主题、三个面板可见性和快捷键。编辑体验切换/重置会先提交未失焦草稿；快捷键拒绝裸输入键、格式错误和默认/自定义冲突，未保存草稿在关闭或切换作用域前会确认。
- 文件树重命名与删除使用 `/api/window-designer/files/rename`、`/api/window-designer/files/delete`，由 `ProjectFileMutationService` 校验工作区、项目根目录、符号链接和目标冲突；操作前会提交编辑器草稿并与保存/F5 互斥。
- 文本模型统一由 `src/services/textModel/` 管理：工作区/项目/文件映射为稳定且不泄露绝对路径的 Monaco URI，每个文件持有独立历史和按专业/新手/原生表面隔离的光标、滚动、正反向选区；重命名迁移模型，删除同步释放原生预览子模型。`.lcpp` 新手正文和专业 Monaco 共用一条规范撤销时间线，Monaco 输入、分组撤销与重做事件同步到相同快照序列；非 `.lcpp` 文件使用 Monaco 原生历史。项目权威文件加载完成前所有源码变更与落盘入口保持关闭，超时或错误可中文重试，空响应不会复用旧项目文件；保存、重建、翻译、提取、AI 应用及工作区替换以项目 ID 和载入代次拒绝旧异步响应。
- `.lcpp` 子程序局部变量使用 `局部 类型 名称 [= 初始值]`，声明必须位于当前方法、事件或构造块内，但可按用途出现在正文任意位置；变量只属于当前子程序，代码应在声明行之后使用。新手正文内按 `Ctrl+L` 会在光标行之前插入默认局部变量、把原光标行代码向下移动并选中变量名，相邻局部声明显示为可折叠变量组；新增和已有局部变量的类型输入框共用类型补全目录，支持 `wb` → `文本型`、`zs` → `整数型`及 `string` / `int` 等别名，可用方向键选择并以 Enter/Tab 确认。在完整的未声明赋值语句行末按回车，会在该语句上方自动声明同名局部变量并继续下一行；字面量、已知变量、子程序与已启用模块命令使用确定性类型推断，不确定时显示类型选择。新手正文关闭软换行，长代码通过横向滚动查看，语法高亮层与输入层同步滚动，避免覆盖下一逻辑行；结构跳转使用瞬时滚动。解析器、AST 结构编辑、按子程序隔离的补全、未声明/类型诊断、新手模式局部变量表和 Win32 C++ 生成共用同一模型；模块贡献的返回类型与 `cppType` 会用于类型检查和声明生成，例如 `局部 字节集 ret` 可接收 `网页_访问_对象(...)` 并生成 `std::vector<unsigned char>`。
- 固定文件 `项目全局变量.lcpp` 同时承载项目变量与项目常量，新手模式以两个页签编辑，资源管理器显示为“项目变量与常量”但磁盘文件名保持不变。常量使用 `常量 类型 名称 = 常量值`，首版限文本、整数、长整数、小数、双精度小数和逻辑六种基础标量；初始化只接受安全的字面量、运算和前置常量引用。常量进入新手/Monaco 补全、悬停、定义、引用和多文件安全重命名，并禁止重新赋值或被成员、参数、局部变量遮蔽。F5、原生预览、Visual Studio 导出及 AI Bridge 共用项目符号上下文与 C++ 生成结果：数值/逻辑生成 `inline constexpr`，文本生成 `inline const std::wstring`，且始终位于可变全局变量之前。
- 新手正文的 `Ctrl+鼠标左键单击` 和右键“转到定义”同时识别普通项目子程序调用与 `&处理器名`；自动高度正文的流程引导列固定在零纵向偏移，`如果／否则／如果结束` 括号只显示在实际结构行，不会漂移到前面的赋值或调用语句。
- Monaco 运行时、核心 worker 与 C++/INI 基础语言包直接从本地 `monaco-editor` 打包，不再依赖 CDN；`npm run build` 会执行 `scripts/verify-local-monaco-build.cjs`，缺少 worker/语言分块或入口引用外链时直接失败。当前 `.h` 使用 C++、`.rc` 使用 INI 近似高亮；完整 C/C++ 语义补全和诊断仍等待 clangd/LSP 阶段。
- 项目文本文件通过 `src/services/files/textFileService.ts` 按字节读取和保存。`/api/window-designer/files` 同时返回 `files` 与 `fileFormats`，支持 UTF-8、UTF-8 BOM、UTF-16 LE/BE 及 LF/CRLF；`.e` 和大小写扩展使用同一读写白名单，拒绝类型、越界或符号链接路径会返回中文 400，格式/路径校验完成前不会写入任何请求文件。编辑器内部统一使用 LF，状态栏切换编码或换行后会标记文件待保存。Diff 的“编辑 / 并排对比 / 内联对比”可通过命令面板切换，CRLF/LF 不会产生伪差异，清空文件会显示为删除。
- `Ctrl+Shift+F` / `Ctrl+Shift+H` 打开工作区搜索与替换。`WorkspaceSearchService` 支持纯文本/正则、大小写和文件/项目/工作区范围；搜索只读取磁盘快照并跳过构建目录、依赖目录、链接、过大或非文本文件。替换必须勾选结果、生成预览并明确确认，应用和撤销都重新校验文件哈希；中途写入或落盘后校验失败会恢复到完整的替换前/替换后状态，并保留 UTF BOM、UTF-16 与 LF/CRLF。服务保守拒绝灾难性回溯、反向引用和指数可选量词链，并以 32 MiB/256 匹配文件查询快照、16 MiB 预览、128 MiB 总缓存和 5 个可撤销事务为默认硬边界。四个 `/api/workspace-search/*` 路由复用本地会话鉴权；成功应用/撤销后，编辑器直接采用已确认事务的 before/after 快照，异常情况下才从磁盘重新读取，避免旧模型再次覆盖结果。
- F5 原生程序由 `ManagedProcessService` 按项目管理。`/api/window-designer/run-status` 返回受控进程与在途生成状态，`/api/window-designer/stop` 可取消生成代次并停止受控进程；重新生成会先停止旧 exe 再写入/链接固定输出，避免 Windows 文件锁。同项目任务串行，IDE 内嵌 AI Bridge 与 F5 共享租约，停止后不会迟到启动 exe。Shift+F5 停止全部受控任务，服务关闭时执行最终回收。
- `/api/environment/check` 执行真实只读环境探测，覆盖 Node.js、MSVC、Windows SDK、CMake、g++、clang++、WebView2 和平台信息；`ready` / `msvcBuildReady` 只在 MSVC 与 Windows SDK 满足默认 Win32 原生构建时为真，`cppCompilerAvailable` 单独表示存在任意 C++ 编译器，避免仅安装 g++/clang++ 时误报默认构建就绪。工具栏环境检查显示检测结果和中文修复提示，不再使用固定成功文本。工具菜单与命令面板可打开“环境修复中心”，通过固定微软下载地址和固定参数安装 C++ Build Tools 工作负载或 WebView2；API 不接受任意 URL、命令或参数。离线部署见根目录 `LINGBUILDER_OFFLINE_ENVIRONMENT_PACKAGE.md`。
- 自动回归包含命令注册/面板模型/快捷键路由/可访问对话框、配置优先级/持久化/迁移/API、项目文件、工作区搜索事务、受控进程、构建协调和环境检查测试，并在 renderer server / AI Bridge 集成测试中验证鉴权、跨入口互斥、停止代次、关服回收和 API 契约。
- Windows 原生按钮与复选框视觉/交互 smoke 可在完成 F5 编译后运行：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-owner-draw-button-states.ps1 -ExecutablePath ../.lingbuilder-build/lingbuilder-ui-project/Win32/Debug/bin/LingBuilderPreview.exe -OutputDirectory ../.lingbuilder-build/button-visual-smoke`。脚本会确认 `BS_OWNERDRAW`，使用真实鼠标、Tab 和空格验证按钮五态、复选框勾选/取消、禁用不响应 hover、控件几何不变及焦点绘制不越过左侧勾选框，并输出逐态 PNG 与 `metrics.json`；发送真实输入前会校验前台窗口和命中 HWND。

## AI Bridge CLI

工作台“帮助 → CLI 与 AI Bridge 使用指南”和命令面板命令“帮助：打开 CLI 与 AI Bridge 使用指南”会打开内置指南。指南通过 Electron 主进程受控检查安装目录 `lingbuilder.cmd`、当前用户 PATH 和 `LingBuilder CLI x.y.z` 版本输出；可复制常用命令/MCP 配置、打开 IDE 终端或打开随包的 `AI_BRIDGE_CLI_USAGE.md`。检查只运行固定 `--version` 参数，不接受 renderer 传入的任意命令。

安装版用户重新打开终端后可直接运行：

```powershell
lingbuilder --help
lingbuilder ai-server --workspace "D:\项目\我的工程" --permission preview
```

开发期可以从 `electron/` 目录启动本地 AI Bridge：

```bash
npm run ai-server -- --workspace .. --port 17860
```

默认行为：

- HTTP 地址：`http://127.0.0.1:17860/api/ai-bridge`
- 默认权限：`preview`
- token 未传入时会自动生成并打印到终端。
- AI Bridge 强制只监听回环地址，不支持公网或局域网监听；远程 AI 使用独立云端账号 API。

常用参数：

```bash
npm run ai-server -- --workspace .. --permission readonly
npm run ai-server -- --workspace .. --permission preview --token local-token
npm run ai-server -- --workspace .. --permission yolo --mcp
npm run ai-server -- --workspace .. --permission preview --mcp --stdio-only
```

产品 CLI 的 `project diagnose` 会读取解决方案中同项目的全部 `.lcpp` 上下文，因此在 `项目全局变量.lcpp` 使用 `项目数据类型.lcpp` 的记录类型不会产生脱离项目上下文的误报。`project build --yes` 编译完成后直接返回；`project run --yes` 保持前台附着直到生成的 exe 自然退出并等待运行日志落盘，按 Ctrl+C 会先停止该受管进程再退出。空设计器窗口同样可以生成并编译，不要求为了绕过占位数组而添加无意义控件；项目没有 `CefBrowser` 时不会初始化 CEF3 或输出缺少 SDK 的运行日志。

HTTP 请求示例：

```bash
curl -H "Authorization: Bearer local-token" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

MCP 模式使用 stdio JSON-RPC，暴露工具包括：

- `lingbuilder.workspace.list`
- `lingbuilder.file.read`
- `lingbuilder.file.search`
- `lingbuilder.lingcpp.diagnostics`
- `lingbuilder.edit.propose`
- `lingbuilder.edit.apply`
- `lingbuilder.build.run`
- `lingbuilder.modules.list`
- `lingbuilder.native.preview`
- `lingbuilder.native.export`

`lingbuilder.build.run` 启动的 exe 同样由 `ManagedProcessService` 管理，不使用 detached/unref；同项目重跑会在编译前回收旧进程和日志流。AI Bridge HTTP/MCP 构建使用项目租约，CLI 收到 `SIGINT` / `SIGTERM` 时会拒绝新构建、等待在途租约结束，再停止全部受控运行进程；启动失败会以 `run-start` 阶段返回失败，不能报告假成功。

原生导出与 `lingbuilder.build.run` 会生成可复制 C++ 源码和 Visual Studio Win32 工程文件：`<projectId>.sln`、`<projectId>.vcxproj`、`<projectId>.vcxproj.filters`。启用外部 C++ 模块时，工程文件会写入模块源码、include 路径、`.lib` 依赖和运行时 DLL 的 post-build 复制命令。

new_emoji YOLO 示例约束：

- 生成 `lingbuilder.new_emoji.ui` 演示时，窗口“创建完毕”事件仍用独立一行 `结束` 作为结构收尾；不要额外写显式退出命令 `结束()`，否则 exe 会创建后立即退出。
- 纯 new_emoji 示例应创建窗口和控件后进入 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。
- 返回 exe 路径前，必须确认 `new_emoji.dll` 位于 exe 同目录，并启动 exe 等待至少 3 秒确认仍在运行。

安全约束：

- Electron IDE 内嵌 AI Bridge 默认关闭；外部客户端必须显式运行 `lingbuilder ai-server`。
- HTTP 鉴权只接受 `Authorization: Bearer <token>`，不接受 query/body token。
- 文件访问按真实工作区路径校验，文件树/搜索不跟随符号链接或 Windows junction，新文件写入拒绝链接路径链。
- `lingbuilder.file.read` 返回规范化内容及 `{ encoding, eol }`；`lingbuilder.edit.apply` 对已有文件必须保留原编码、BOM 和换行风格，新文件默认使用 UTF-8/LF。遇到非法 UTF 字节时应明确失败，不能用替换字符继续写回。
- `readonly` 禁止写入和执行。
- `preview` 写文件、导出和构建运行必须传入 `approved=true`。
- `yolo` 允许带 token 的客户端自动执行受控 LingBuilder 命令，但仍不开放任意 shell。
- 敏感操作记录在 `.lingbuilder/ai-bridge-log.jsonl`。

## 模块 SDK CLI

LingBuilder 模块标准为 `schemaVersion: 2`。旧 `.lbmod` v1 不再兼容，C++ 依赖写入 `targets[]`，中文命令到 C++ 的确定性映射写入 `bindings.commands[]`。根目录 `模块开发手册.md` 是面向外部模块作者的正式说明。

`contributes.types[]` 可声明不透明类型、公开记录和命名数组。`record` 使用 `fields[]`，字段数组使用 `isArray: true`；`array` 使用 `elementType`。结构化类型进入语言服务和生成器，但不会自动成为 DLL ABI；原生模块仍需通过 `bindings.commands[]` 和稳定桥接函数交换复杂数据。

binding 处理器参数可声明为 `handler`，`.lcpp` 用 `&处理器名` 引用当前类的无参数事件或方法。`lingbuilder.web.http` 1.1.1 使用该语义提供 `网页_异步访问`：请求在受控后台线程执行，完成处理器通过 Win32 消息回到 UI 主线程，结果按请求编号隔离读取。命令提示通过 `returnDescription` 解释返回值语义，并优先显示 binding 为每个参数声明的独立说明。

Win32 高级模块还提供结构化集合编辑、ImageList 项目资源管理和完整系统对话框状态读取。文件筛选器采用 `名称|模式` 成对格式；`系统对话框_状态()` 返回 1/0/-1，查找替换和工具栏通过专用读取命令返回最近动作，`打印文本` 会向所选打印机提交真实文档。

Win32 高级工具箱包含可视“颜色选择器”。它显示当前色块和可选 `#RRGGBB` 文本，点击后打开 LingBuilder 自绘暗色弹窗，提供 HSV 色谱、色相条、HEX/RGB、常用预设和确认/取消，不再显示旧式系统颜色窗口；弹窗采用整窗双缓冲和 HSV 色谱缓存，拖动选色不闪烁，HEX 值在输入区域垂直居中。将设计器“可见性”设为隐藏后，运行时仍保留该组件，可在按钮、菜单或其他事件中调用 `颜色选择器_打开(颜色选择器1)`。`颜色选择器_置颜色/取颜色` 使用 COLORREF 整数，选择过程可绑定颜色改变、窗口打开、确认、取消和关闭事件。

非可视 ToolTip 和 PropertySheet 位于设计器“项目 / 行为与属性页”资源区：ToolTip 绑定目标控件并拥有独立延迟；PropertySheet 编辑顶层页面、应用事件处理器，并由中文命令 `属性页_显示(属性页资源)` 打开。

窗口设计器工具箱还提供非可视“上下文菜单”和“弹出菜单”。上下文菜单绑定窗口或控件并响应原生右键消息；弹出菜单通过 `弹出菜单_显示` 或 `弹出菜单_在坐标显示` 主动打开。Win32 基础模块全局提供初级命令 `取鼠标水平位置()` 和 `取鼠标垂直位置()`，可直接作为弹出菜单的屏幕像素坐标参数。两类菜单共用结构化菜单项模型，F5 和原生导出使用真实 Win32 `HMENU`，菜单项事件按稳定 ID 绑定；`菜单_取最后项目` 可读取最近选择项。

PropertySheet 页面可以选择任意设计器窗口作为“控件模板”，模板中的完整控件树会以真实子 HWND 创建到属性页中；建议为属性页建立专用模板窗口，避免把普通顶层窗口布局与页面布局混用。

常用命令：

```bash
node dist/cli.cjs module init --template cpp-source --out ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module validate ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module pack ../.lingbuilder/module-build/com.example.native --out ../.lingbuilder/module-packages/native.lbmod
node dist/cli.cjs module inspect ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module validate ../.lingbuilder/module-packages/native.lbmod
node dist/cli.cjs module inspect ../.lingbuilder/module-packages/native.lbmod
node dist/cli.cjs module migrate-cpp --config ../migrate.json --out ../.lingbuilder/module-build/com.example.native
node dist/cli.cjs module market index --packages ../.lingbuilder/module-packages --out ../.lingbuilder/module-market.json
```

开发期可用 `tsx src/cli.ts module ...` 直接调试。模块页中的“模块开发者中心”复用同一套服务能力。

`new_emoji` v2 模块仍使用：

```bash
npm run module:new-emoji -- --install
```

生成结果必须包含 Win32/x64 targets、`NE_` 中文桥接命令 bindings、桥接源码、文档和示例。验证可运行 exe 时仍需确认 exe 同目录存在 `new_emoji.dll`，并等待至少 3 秒确认进程仍在运行。

项目启用 `lingbuilder.new_emoji.ui` 后，窗口设计器自动使用 new_emoji 原生后端。当前新增设计器入口闭环为 9 类基础控件；旧项目中的上传、拖拽上传仍保留桥接兼容，但不再出现在普通 Win32 工具箱。普通 Win32 文件选择使用高级控件模块的非可视 `FileDialog` 资源，绑定现有按钮及窗口/控件拖放目标。画布保留现有布局/属性编辑体验，F5 与原生导出生成真实 `NE_创建*` 调用。不支持的 Win32 高级控件会禁用并给出中文诊断，不会静默混入 Win32 控件。

New_Emoji Tabs 属性面板中的“显示标签页表头”对应 `headerVisible`，默认值为 `true`，生成器会调用 `EU_SetTabsHeaderVisible`；关闭后设计器预览与原生生成结果都不绘制标签页表头，页面内容区使用整个 Tabs 区域。`contentVisible` 仍固定开启，仅表示页面内容承载，不是表头开关。修改上游目录或 DLL 后重新运行上述模块生成命令，并检查 `tests/windowDesigner.test.ts` 与 `tests/modules.test.ts`。
# 高级原生调试

底部“局部变量 / 监视 / 调用栈”的高级调试区支持按 PID 附加、打开工作区内 core/minidump、连接 gdb-remote，以及暂停态寄存器、内存和反汇编读取。需要安装 LLVM `lldb-dap`；远程目标需自行启动兼容的 gdb-server/lldb-server。
# Git 源代码管理

解决方案资源管理器顶部可展开当前 Git 分支和改动列表，选择文件后可暂存或取消暂存，填写中文提交说明后提交已暂存改动。分支页支持创建、切换和删除已合并的本地分支；历史页显示最近提交，Blame 可查看指定文件行的作者与提交来源。所有路径均限制在当前工作区。
# Git 远程、冲突与 PR

源代码管理的远程页支持获取、快进拉取、推送、merge/rebase 和创建 GitHub PR。冲突页显示 base/当前/传入三方内容，可选择一侧或编辑最终合并文本，再继续或中止 merge/rebase。创建 PR 依赖 GitHub CLI `gh` 登录状态，使用显式标题、说明、head/base 和仓库参数。
# 性能分析

# 发布、签名和远程目标

# AI 凭据、工作区索引和设置同步

桌面版 AI API Key 使用 Electron `safeStorage` 加密保存，不写入 localStorage、工作区索引或设置同步包。旧版 localStorage 中的 `apiKey` 字段会在加载时删除；系统无法提供安全存储时，密钥只在当前 Web 会话中使用。

解决方案侧栏可重建和搜索 AI 工作区索引。索引文件位于 `.lingbuilder/ai-index.json`，仅包含受支持文本源码的相对路径、哈希、短预览和有界词项；不会遍历依赖、生成目录或符号链接。构建可以取消。

“设置同步”可导出用户设置、工作区设置和扩展启用状态。导入前必须预览确认，文件变化会触发冲突，批量写入失败会回滚；API Key、token、secret、password 和 credential 字段始终被剔除。

## 系统内置 AI 账号模式

AI 面板现在提供“系统 AI”和“自定义 API”两个独立模式。系统 AI 从 `LINGBUILDER_CLOUD_API_URL`（默认 `http://127.0.0.1:17900`）读取账号、AI 点数和逻辑模型；BYOK 继续使用用户自己的 API Key/Base URL。

- 系统账号 Refresh Token 由 Electron 主进程 safeStorage 保存到独立凭据文件；renderer 只获得账号摘要和流式事件。
- 系统 AI 使用主进程网络客户端消费 SSE，可端到端取消；完成后刷新点数余额并显示输入/输出 Token 与扣点。
- 云端编辑返回完整文件草稿后，renderer 必须调用本地 `/api/lingcpp/edit/from-system-draft`，经过允许路径、模块上下文和 LingCpp 结构校验才能形成 Diff 提案。
- 系统 AI 与 BYOK 共享根规则手册，但凭据和账本完全隔离。
- 云端默认零保留；本地工作区、API Key、Refresh Token 和源码不得进入设置同步包。
- 系统 AI 支持 OpenAI-compatible `reasoning_content` 流式增量；编辑草稿不会混入推理文本。幂等冲突会在 SSE 建连前返回 409，取消后的估算用量包含云端注入的规则手册上下文。

云端开发和后台部署参见根目录 README。

在工作区创建 `.lingbuilder/publish.json` 后，可从解决方案侧栏读取配置并发布。示例：

```json
{
  "name": "demo",
  "version": "1.0.0",
  "files": ["generated/cpp/demo/demo.exe"],
  "outputDirectory": "release/demo",
  "target": { "kind": "local" },
  "signing": { "enabled": false }
}
```

本地发布会生成 `lingbuilder-publish-manifest.json`，记录每个产物的大小和 SHA-256；失败时保留旧发布目录。签名使用 Windows `signtool.exe` 并在签名后立即验证。远程目标可设为 `wsl`、`container` 或 `ssh`，对端必须预装 `lingbuilder-agent` 并具备已同步的工作区。

测试页的“CPU / 内存 / I/O 性能分析”可启动工作区内的可执行文件并按周期采集 CPU 时间、峰值工作集、磁盘读取和写入量。采集支持主动取消和自动超时，IDE 关闭时会回收目标进程；也可导入 Chrome `.cpuprofile` 查看按自身耗时排序的热点函数。

# 设计器专业操作与 RC 资源编辑

窗口设计器支持 Shift/Ctrl 多选、对齐、等宽等高、水平/垂直分布、方向键微调以及撤销/重做。方向键每次移动 1 像素，按住 Shift 时移动 10 像素；删除会作用于当前全部选中控件。

解决方案侧栏的“RC 资源”页可载入工作区内 `.rc` 文件，并编辑菜单项、对话框标题、控件文本和字符串表文本。保存会保留文件原有 UTF-8/UTF-16 编码、BOM、换行风格和未识别语句；文件被外部程序修改后会拒绝覆盖并要求重新载入。

# 测试资源管理器

底部“测试”页签自动发现 Node `*.test/spec.ts/js` 和 CMake/CTest 测试，支持类型/名称筛选、单项或筛选结果运行、结构化通过/失败/跳过状态和输出。Node 调试使用 Inspector 在入口暂停；C++/CTest 调试复用 LLDB DAP。Visual Studio 内置 CMake/CTest 会在没有全局命令时自动探测。
# 代码质量

测试页右侧提供“Node 覆盖率”和“导入报告”。支持真实 V8 覆盖执行、LCOV、Istanbul、SARIF、ASan 与 UBSan；点击覆盖率文件会在已打开的 Monaco 源码中以绿色/红色标记覆盖/未覆盖行，静态分析和 Sanitizer 诊断同时进入错误列表。
# Extension Host

工作区扩展放在 `.lingbuilder/extensions/<目录>/`，入口清单为 `package.json`，与 C++ `.lbmod` 模块分离。支持 `onCommand`、`onLanguage`、`workspaceContains`、`*` 激活和 commands、menus、views、languages、themes 贡献。扩展在独立受限进程运行；工作区读写必须声明 `workspace.read/workspace.write`，默认不能加载 Node 模块或直接访问文件系统。解决方案侧栏扩展面板可刷新、启用/禁用并执行贡献命令。

# 局部常量

事件、方法、构造和功能库函数可以在子程序顶层声明运行时局部常量：

```lcpp
局部常量 整数型 最大次数 = 取最大次数()
局部常量 文本型 标题 = "ready"
```

局部常量初始化一次后只读，C++ 统一生成 `T const`，不使用 `constexpr`。初始值必填，禁止显式数组；首版不能声明在如果、循环、选择、尝试等控制块内。初始化表达式可以使用参数、成员、项目符号、前置局部声明、子程序和已启用模块命令，禁止自身引用、未知名称和后置局部名称。对常量本身、字段或索引重新赋值会产生阻断诊断；句柄常量只冻结句柄绑定，不深度冻结外部对象。

新手结构编辑器把变量和常量统一显示在“局部声明”表中，并提供“类别”列。右键菜单和命令面板的“新建局部常量”执行 `lingcpp.beginner.addLocalConstant`；`Ctrl+L` 继续只插入普通局部变量。变量转常量前必须已有初始值且不是数组。普通 Win32、new_emoji、F5、原生预览、Visual Studio 导出和 AI Bridge 共用同一生成与 source map 链路。独立原生验收命令：

```bash
npm run smoke:local-constant-native
```

程序集常量仍未支持。

# 项目全局变量

Visual C++ 项目在源码根目录使用固定的 `项目全局变量.lcpp`。解决方案资源管理器中的“项目全局变量”入口会在新手模式打开表格，在专业模式打开同一文件的 Monaco 文本；旧项目缺少文件时，首次打开只创建待保存的内存模型。

```lcpp
全局 文本型 当前用户 = "访客"
全局 整数型 访问次数 = 0
全局 文本型 标签列表[]
```

全局变量只在当前项目有效，生命周期覆盖整个进程。初始值只能使用字面量、纯算术/逻辑表达式和前面已经声明的全局变量；数组首版仅支持默认空数组。F5、解决方案构建、原生预览、原生导出和 AI Bridge 会聚合项目源码目录内全部 `.lcpp`，活动窗口仅决定启动窗口。旧的 `lingCppSourceCode` / `lingCppSourceFilePath` 仍可用，新调用应优先传 `lingCppSources: Array<{ filePath, sourceCode }>`。

AI Bridge 会校验每个源码路径均位于当前项目 `sourceRoot`，显式集合总量限制为 8 MB；未传集合时自动读取磁盘。生成的 C++ 使用 `LingBuilderProjectGlobals` 命名空间，并把全部原始 `.lcpp` 作为 Visual Studio 非编译源码项保留。

# 项目自定义数据类型

Visual C++ 项目使用固定的 `<sourceRoot>/项目数据类型.lcpp` 保存项目级记录类型。解决方案资源管理器、命令“项目：打开自定义数据类型”和新手模式工具栏可打开类型卡片/字段表格；专业模式编辑同一份文本。新项目创建空文件，旧项目在首次使用前显示“未创建”。类型或字段改名先生成逐文件 Diff，应用时再次校验全部源文件版本，取消、冲突或过期都不会产生部分修改。

```lcpp
数据类型 地址信息
    文本型 城市 = ""
结束数据类型

数据类型 用户信息
    文本型 姓名 = ""
    整数型 年龄 = 0
    地址信息 地址
    文本型 标签[]
结束数据类型
```

字段支持安全基础类型、嵌套项目类型和数组，禁止循环嵌套。类型可用于局部、程序集、项目全局、参数、返回值及数组，并采用同类型值复制。语言服务提供类型/字段链补全、中文诊断和跨文件定义跳转；普通 Win32 与 new_emoji 生成器按依赖顺序在全局变量和窗口类之前输出 C++ `struct`，AI Bridge、F5、原生预览和 Visual Studio 导出共用同一多源码聚合结果。
# C++ 依赖管理

解决方案侧栏“依赖管理”识别 vcpkg、Conan 2 和 NuGet 标准清单，显示包和版本冲突，并提供恢复或仅离线缓存。缓存与安装树位于 `.lingbuilder/package-cache` 和 `.lingbuilder/packages`；恢复参数由 IDE 固定生成，不执行用户提供的任意命令。

# new_emoji 与收费模块

`npm run module:new-emoji -- --install` 会读取上游 LingBuilder Designer Catalog，校验 92 个组件和 1566 个导出后生成/安装 v2 `.lbmod`。窗口后端在窗口属性顶部选择；已有控件的窗口不能直接切换后端。模块属性和事件由目录动态产生，底层 `NE_EU_*` 默认隐藏。

目录完整性与运行时完整性分别验收：当前 92 个 `EU_Create*` 创建入口已经数据驱动接入，703 个专属属性中 219 个创建期属性可编辑；其余属性因缺少正式 setter 参数映射而锁定。目录中的 74 个事件也暂不显示为可绑定事件，直到上游导出 callback setter、签名和事件上下文映射。混合后端多窗口生成仍列为后续闭环项。

收费模块需要桌面主进程登录云端并取得签名 Permit。本地服务在安装、启用、F5、原生预览和导出前复验；受管 AI Bridge 通过子进程环境只接收 Permit/公钥状态，不接收云端访问令牌。退出登录会清空 Permit 并停止仍持有旧授权的 Bridge。开发环境未配置支付商户网关时只能使用管理员手工授权，不能伪造支付成功。

# 可扩展设计器右键菜单与剪贴板

设计器右键菜单通过 `MenuService` 解析，菜单项只调用 `CommandService` 命令。内置、已启用 `.lbmod` 和 Extension Host 插件可向 `designer/control/context`、`designer/canvas/context` 或 `designer/resource/context` 贡献菜单和子菜单。插件访问设计器需声明 `designer.read`；返回声明式编辑时还需 `designer.write`，并经过修订号、字段白名单、引用、数量和大小校验后作为一次原子撤销事务应用。

复制、剪切、粘贴使用带 `LINGBUILDER_DESIGNER_CONTROLS:` 前缀的版本化 JSON 剪贴板。`DesignerContainerLayoutRegistry` 为窗口、GroupBox、Grid、Pager、TabControl 和 ReBar 注册内置适配，并向模块开放 absolute/flow/stack/grid/dock/slots/single/custom 布局描述。粘贴时只重新适配复制子树的顶层节点，内部父子关系、相对位置、插槽和引用保持不变。
> 2026-07-28：修复 FBro F5 空白窗口。SDK 查找现在从任意深度构建目录向上识别 `.lingbuilder-build`，缺失/损坏依赖会在编译前阻断，不再启动空白占位程序；同时修正生成 C++ 的 Windows 路径分隔符转义，避免 CEF 缓存目录落到 `程序.exe` 下。F5 中间 VS 工程复用已校验 `bin`，便携 VS 导出携带完整 78 项 runtime 和增量脚本。真实 MSVC x64 冒烟测试已确认创建事件、网页加载完成事件、错误 VIP 中文诊断及无 Key 泄漏。

# 云端系统 AI 供应商

管理后台 `/admin` 的“系统 AI 供应商”用于配置 IDE“AI 智能编程助手 → 系统 AI”的云端模型通道。DeepSeek V4 预设会发布 `deepseek-v4-flash`、`deepseek-v4-pro`；自定义模式支持公开 HTTPS Base URL、Model Name、API Key，以及 OpenAI 兼容或 Anthropic Messages 协议。桌面端仍只读取云端 `/v1/ai/models` 暴露的逻辑模型别名并通过云端 AI 接口调用，不接收供应商 Base URL 或明文密钥。

# Win32 DataGrid

0.2.5 在“高级控件”提供独立 `DataGrid / 数据表格`。设计器使用结构化三页编辑器配置列、初始数据和单元格覆盖，支持文本、整数、小数、日期、选择框、Switch、图片、进度、组合框和多按钮列。原生生成使用独立 `LingBuilderDataGrid` HWND、双缓冲可见区域绘制和按需临时编辑器；不会为每个单元格创建 HWND。

原生特殊单元格与设计器保持同一视觉语义：Switch 使用 GDI+ 抗锯齿圆角轨道和白色滑块，进度条使用抗锯齿圆角轨道、状态色填充和居中文字；进度轨道尺寸随窗口 DPI 缩放，文字使用完整单元格文本区域垂直居中，避免在高 DPI 下被窄轨道裁切。按钮列按当前 GDI 字体测量完整文字宽度，内边距、间距和命中区域随 DPI 缩放，绘制与交互复用同一布局；仅在整组按钮无法放入单元格时显示“更多”。所有按钮状态和“更多”入口统一采用随 DPI 缩放的 4 逻辑像素 GDI+ 抗锯齿圆角填充与描边，保持紧凑而不生硬。组合框静态显示中文标签及下拉箭头，单击后创建并展开深色自绘的真实 `COMBOBOX`。项目图片路径相对 EXE 目录解析，F5 和 Visual Studio 导出会把非默认项目资源复制到 `assets/<项目ID>/`；图片显示方式支持 `tile/contain/cover/center/stretch`。

接口目录现有 92 条命令，包括 `表格_取进度状态`、`表格_取行是否选中`，以及直接读写 `.xlsx` 的 `表格_导入Excel`、`表格_导出Excel`。XLSX 使用标准 SpreadsheetML 和 Windows 自带 ZIP Shell，无需安装 Excel；首版仅处理静态表格的第一个工作表，图片值按路径文本导入导出。CSV/TSV 接口继续使用可往返文本，便于配合文件模块自行持久化。

命令目录位于 `src/services/modules/dataGridApiCatalog.ts`，模型规范化位于 `src/services/windowDesigner/dataGridModel.ts`，嵌入式 C++ 运行时位于 `src/services/windowDesigner/dataGridNativeRuntime.ts`。真实 x64 冒烟运行：

```bash
npm run smoke:datagrid-native
```

源码包会为 DataGrid 控件和 `表格_` 命令写入 `win32.datagrid.v1`，最低生成器版本为 0.2.5。旧 new_emoji Table 不自动转换后端。

完整示例项目位于 `src/datagrid-api-demo/`，设计器模型位于 `.lingbuilder/projects/datagrid-api-demo/window-designer.json`，已加入当前解决方案。它覆盖全部 92 条 `表格_` 命令、16 个专属事件、10 种列类型和 100 万行虚拟数据。界面采用 9 个选项卡，86 个可直接调用接口各自拥有独立按钮且每个按钮处理器只调用一条 DataGrid 命令；事件上下文和校验拒绝放在对应生命周期事件中，避免用无效按钮误导新手。真实原生验收可运行：

```bash
npm run smoke:datagrid-demo
```

可直接分享的新手完整包位于根目录 `exports/LingBuilder-DataGrid-All-APIs.lcpppkg`。导出和项目构建会识别源码根目录中误创建的嵌套 LingBuilder 工作区，不会再把其中的第二份 `MainWindow.lcpp` 打入包或参与 F5 构建。

# OpenCV 4.14.0 x64 模块

OpenCV 全命令演示使用 `assets/module-demo-lingbuilder.opencv/OpenCV缺口背景.png` 作为真实缺口输入：左侧显示独立拼图块，右侧显示边界明确的缺口。`OpenCV_分析缺口` 按钮只调用一次分析命令并限制在右侧 ROI；`npm run smoke:opencv-native` 会用同一 PNG 做 MSVC x64 原生检测，断言候选接近 `(330,108,100,110)`，再通过 Bridge 生成 `OpenCV缺口验证标注.png`。

资源管理器的图片预览通过受保护的图片 API 读取 Blob，再交给浏览器解码；不再把会话鉴权、资源路径或服务端响应错误统一显示为“文件损坏”。预览关闭或切换图片时会撤销临时 Blob URL。资源和模块缓存同时绑定工作区路径，多个导入副本即使项目 ID 相同，切换后也不会继续显示上一个工作区的条目。

内置用户模块 `lingbuilder.opencv@1.0.0` 提供 33 条中文命令，覆盖图像加载保存、克隆与信息读取、灰度/缩放/裁剪/模糊/二值/边缘/形态学、模板匹配、轮廓和单/双缺口候选分析。`cv::Mat` 不进入 LingCpp；生成代码通过 `opencvRuntime.ts` 调用 `LingBuilderOpenCvBridge` 的 `LB_OCV_*` C ABI，并使用受管 64 位句柄。

只读资产模块 `lingbuilder.opencv.sdk@4.14.0+bridge.1` 默认隐藏。生成并安装：

```bash
npm run module:opencv-sdk -- --install
```

脚本固定校验 OpenCV 4.14.0 源码 SHA-256，只构建 `core`、`imgproc`、`imgcodecs` 的 Release x64 `/MD` 资产，并输出 Bridge 头/LIB/DLL、三个 OpenCV DLL、Apache-2.0 许可证和逐文件运行时清单。SDK、源码和中间产物位于根目录 `.lingbuilder/`、`.lingbuilder-build/`，不会提交 Git。

启用模块后只允许 `windows-msvc-x64`，构建配置服务会在启用模块或首次 F5 时自动选择并持久化 x64，Visual Studio 导出只生成 Debug/Release x64。F5、AI Bridge `build.run/native.export`、原生导出与源码包恢复都复用 `nativeDependencyService` 的版本/ABI/架构/CRT/SHA-256 校验。原生验收：

```bash
npm run smoke:opencv-native
```

中文说明、命令表和完整 `.lcpp` 示例位于 `docs/modules/opencv/`。缺口分析只处理用户自有或已授权图像，不包含浏览器控制、自动拖动或验证提交。

# LingCpp 控件引用语义

模块 binding 中的设计器对象参数统一使用 `controlRef`。`.lcpp` 必须写裸名称，例如 `控件_设置文本(操作结果, "完成")`；生成器解析稳定项目/窗口/控件 ID 后，再按后端契约转换为 `L"操作结果"`、稳定 ID 或原生句柄。

新手编辑器与 Monaco 共用 `controlReferenceService`，提供兼容对象补全、缺失/歧义/类型/种类/作用域/引号诊断、安全移除引号、悬停、引用和重命名。控件引用使用独立语义令牌颜色；Ctrl+单击、右键和命令面板的“跳转到控件”共用 CommandService/MenuService/设计器导航服务，设计器未挂载时请求不会丢失。

维护和迁移：

```bash
npm run module:control-ref-audit
npm run module:control-ref-migration-check
npm run module:control-ref-migrate
npm run module:control-ref-source-audit
```

审计会遍历全部模块方法/参数、已安装第三方清单和模块 TypeScript 源字面量；迁移检查为只读门禁，写入迁移只改写已解析且兼容的引用，同时覆盖 `.lcpp`、便携工作区、嵌套源码包及 smoke `build-request.json` 中的嵌入源码。

## 受控构建生成链

`src/services/build/` 内的 `BuildPipelineService`、`BuildStepProviderRegistry` 和 `BuildGraph` 是 F5、原生导出、AI Bridge、CLI 以及解决方案构建共用的生成基础设施。构建步骤包含 Provider 版本、阶段、依赖、输入、输出和结构化选项，并统一执行拓扑排序、路径安全、取消、进度、结构化日志、原子回滚和增量指纹。

模块 v2 只可声明 `build.codeGenerators[]`。Provider 由 IDE 内置注册，模块不能注入 JavaScript、Shell、PowerShell 或任意可执行命令；未知 Provider、版本不匹配、路径越界、输出覆盖源码和不支持 target 会在规划阶段阻断。通用 `buildSteps` 仍未公开。

## Protobuf 与字节集

`lingbuilder.data.protobuf` 使用受控 `lingbuilder.protobuf.protoc`，固定 SDK 版本 27.3.0。开发机或安装包必须离线提供 `.lingbuilder/toolchains/protobuf/runtime-manifest.json`、头文件、导入库、`libprotobuf.dll` 和 `bin/protoc.exe`；物化服务逐文件校验清单中的大小和 SHA-256，并在缺失、篡改、版本、架构或 CRT 不符时阻断 F5、AI Bridge、CLI 和 VS 导出。不会联网下载，也不会调用 PATH 中的系统 protoc。完整 `.pb.h`、`.pb.cc`、descriptor set、`.proto` 输入和运行时依赖会进入可复制导出目录。

Provider 会递归解析 `.proto` 的本地 import 并将其纳入构建指纹；代码生成在临时 staging 目录完成，成功后才原子提交，失败或取消会恢复旧产物并清理 staging。

LingCpp 的用户类型名为“字节集”，模块/ABI 名为 `bytes`。跨 DLL 仅允许调用方拥有的 `const unsigned char* + size_t` 输入和调用方缓冲区输出；禁止传递或释放 STL。旧 `raw` 字节 binding 会产生迁移诊断，真正 opaque 原生类型仍可保留 `raw`。

验证：

```bash
npm run lint
npm run test:lingcpp
npm run build
```

无固定 Protobuf SDK 时，构建应以中文阻断诊断结束；测试中的离线 fixture 只用于验证清单、物化和安全边界，不代表可替代发布 SDK。

原生生成 smoke：

```bash
npm run smoke:protobuf-native
```

该命令在没有固定 SDK 时只报告可解释的跳过状态；发布验收使用 `npm run smoke:protobuf-native -- --require-sdk`，会执行 import、嵌套/repeated/map/bytes 生成和 build/export 运行时物化检查。

## new_emoji Tabs 页面布局运行时约束

Tabs 页面绑定必须在所有页面子控件创建完成后执行；生成器会延后 `EU_SetTabsPageElements`，避免隐藏页未参加 new_emoji 布局后在切换时产生错位。Container 会显式设置 `EU_SetPanelLayout(..., 0, 0)`，保持设计器的固定宽高。

Tabs 的 `headerVisible=false` 必须在创建 Tabs 后通过 `EU_SetTabsHeaderVisible(hwnd, tabs_id, 0)` 应用；缺省或 `true` 使用 `1`。表头隐藏后，设计器内容偏移和原生页面矩形都从 0 开始，不能继续预留标题栏高度。

修改上述生成链路后，建议运行 `node --import tsx --test tests/windowDesigner.test.ts`，再用 `new-emoji-92-tabs-validation` 的 x64 Release exe 实际切换 17–24 页确认布局。
