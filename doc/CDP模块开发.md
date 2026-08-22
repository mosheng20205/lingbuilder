# CDP 模块开发

## 模块定位

本文中的 CDP 指 **Chrome DevTools Protocol**。CDP 模块用于让 LingBuilder 生成的程序通过 WebSocket 连接 Chrome/Edge 调试端口，并调用浏览器调试、自动化和监听页面事件的能力。

CDP 模块应当是一个 `.lbmod` v2 原生模块，而不是只在 IDE 中演示的功能。整体调用链如下：

```text
.lcpp 中文命令
  -> 模块 bindings.commands
  -> 生成的 C++ 调用模块运行时
  -> WebSocket / JSON-RPC
  -> Chrome / Edge 的 CDP 调试端口
```

**当前状态（2026-08-22）**：阶段 1（会话内核 + 基础自动化）与阶段 2（商业增量）均已实现并通过真实 Edge headless 端到端验证。模块为内置 v2 网络模块 `lingbuilder.cdp.client@2.0.0`（清单 `electron/src/services/modules/cdpClientModule.ts`，97 条命令、4 个受管类型），运行时 `electron/src/services/windowDesigner/cdpClientRuntime.ts` 内嵌 C++ 注入生成工程，多开连接（多调试端口并存）是第一设计约束。阶段 2 新增命令超时看门狗、Fetch 请求拦截/改写/mock/认证、对话框应答、下载管理、文件上传、生命周期等待、设备与网络仿真、元素截图、浏览器窗口边界、新页面通知、鼠标拖拽和元素函数调用。验证入口：`npm run smoke:cdp-native`（真实 Edge/Chrome headless，Win32/x64）与 `tests/cdpClientRuntime.test.ts`。阶段 3 未开始；未达阶段 3 门禁前不得宣称调试器、性能/OOPIF/录制回放能力已支持。

**跨会话进度交接**：各阶段的完成明细、关键文件地图、实现决策、已知坑与剩余工作清单见同目录 `CDP模块开发进度.md`；续作实现前必须先读该文档。

中文命令统一使用 `CDP_` 前缀；所有异步完成一律使用 `.lcpp` 的 `&处理器名` 引用语法（无参回调 + `CDP_取当前事件*` 快照读取）。后续新命令必须继续遵循本文语义。

## 商业可用能力全景

商业可用的 CDP 模块必须覆盖以下能力面。清单按 CDP 协议域组织，对标 Puppeteer/Playwright 级别的自动化基线。任何域缺失时，必须在模块文档与 IDE 模块详情中显式标注"不支持"或"阶段 N 提供"，不得静默留空或降级为无诊断的空操作。

### A. 会话与连接工程（横切，全部阶段的地基）

- WebSocket 客户端连接 `ws://` 调试端点；通过 HTTP `/json/version`、`/json/list` 端点发现可用 Target。
- 递增 CDP `id` 与 `id -> 请求回调` 映射；每条命令必须支持超时与取消，超时不得悬挂回调。
- 事件分发：`method -> 订阅者` 的注册/注销；事件风暴下的背压或丢弃策略必须显式声明并文档化。
- flatten 模式 `sessionId` 路由：同一 WebSocket 连接上多 Target 会话的命令与事件按 `sessionId` 正确分发，禁止串会话。
- 断线检测（WebSocket close/error）与中文诊断；可选自动重连策略；`Target.targetDestroyed` 时释放该 Target 的引用并让未完成回调收到明确失败。
- CDP 错误码与错误消息必须映射为明确中文诊断，同时保留原始 CDP 错误信息供排查。
- 远程对象生命周期：`Runtime.releaseObject` / `releaseObjectGroup`、DOM 节点句柄释放，防止长期自动化任务内存膨胀。
- 大响应分块：响应体超过阈值时使用 `IO.read` 流式读取，不得一次性读入内存。
- 并发安全：多线程访问同一会话时的互斥边界必须明确；回调投递到 UI 时复用项目既有的线程安全 UI 更新模式（`PostMessage` 队列），禁止高频事件直接刷 UI。
- 连接、页面会话、元素引用、远程对象均作为模块公开类型（受管句柄）管理，禁止裸整数句柄绕过生命周期。

### B. 连接与目标管理（Target / Browser 域）

- 连接或断开 CDP 服务，例如 `http://127.0.0.1:9222`；连接前健康检查与版本协商（`Browser.getVersion`）。
- 获取可调试页面/Target 列表（类型、标题、URL、Target ID）。
- 附加到指定标签页或 Target（`Target.attachToTarget`，flatten 模式）。
- 新建、关闭、激活标签页/Target。
- 浏览器级命令：版本查询、关闭浏览器、窗口边界读取与调整（阶段 2）。
- 弹出窗口 Target 处理：`Target.targetCreated` 事件接入与附加（阶段 2）。
- `Target.setAutoAttach` 自动附加 iframe / OOPIF / Worker（阶段 3）。
- 浏览器连接与页面会话生命周期由模块运行时统一管理。

### C. 页面导航与生命周期（Page 域）

- 打开网址、刷新、前进、后退、停止加载。
- 导航生命周期等待原语：等待 `loadEventFired`、`DOMContentLoaded`、`Page.lifecycleEvent`（阶段 2，自动化时序正确性的基础）。
- `Page.frameNavigated` 事件与 frame 树维护；导航后失效的 DOM 节点与远程对象引用必须被释放（阶段 2）。
- 获取标题、URL、HTML。
- 页面弹窗策略：接管或允许 `window.open`（阶段 2）。

### D. JavaScript 执行（Runtime 域）

- `Runtime.evaluate`：支持 `awaitPromise`、`returnByValue`；执行异常详情（`exceptionDetails`）透传为中文诊断。
- `Runtime.callFunctionOn`：对指定远程对象调用函数（阶段 2）。
- 远程对象表示：对象引用、预览与释放（见会话工程）。
- `Runtime.addBinding` + `Runtime.bindingCalled`：页面内 JS 主动调用宿主回调（阶段 3）。
- 控制台 API 事件（`Runtime.consoleAPICalled`）与未捕获异常（`Runtime.exceptionThrown`）订阅。

### E. DOM 操作（DOM 域）

- `DOM.getDocument`（深度控制、影子 DOM 穿透）。
- `DOM.querySelector` / `querySelectorAll`。
- 元素属性读写、outerHTML/innerHTML 读写、元素文本读取。
- 点击、输入、滚动（由 `DOM.getBoxModel` 坐标与 Input 域组合实现）。
- `DOM.resolveNode`：DOM 节点与远程对象互转（阶段 2）。
- `DOM.setFileInputFiles` 文件上传（阶段 2）。
- 节点高亮 `Overlay.highlightNode`（阶段 3，IDE 调试场景）。
- "按元素点击/输入"便捷命令与坐标级 Input 命令必须共用同一套语义，不得出现两套行为。

### F. 输入模拟（Input 域）

- 鼠标：移动、按下/释放、单击/双击/右键、拖拽、滚轮。
- 键盘：按键事件、修饰键组合、`Input.insertText`（支持中文/IME 文本）。
- 触摸事件（阶段 3，移动仿真场景）。

### G. 网络与拦截（Network / Fetch 域）

- 请求/响应事件监听：`requestWillBeSent`、`responseReceived`、`loadingFinished`、`loadingFailed`。
- 请求体读取；响应体读取（文本与 base64；大响应走 IO 流）。
- Cookie：获取、设置、删除、按域列举。
- 缓存：禁用请求缓存、`clearBrowserCache`、`clearBrowserCookies`。
- 网络仿真：离线、限速、连接类型（`Network.emulateNetworkConditions`）（阶段 2）。
- 认证应答：`Network.requestPaused` `authRequired` → `continueWithAuth`（阶段 2）。
- Fetch 域拦截（阶段 2，商业自动化核心）：请求暂停、继续、终止、改写 URL/头/体、mock 响应；请求重放基于"拦截 + 改写"组合实现。

### H. 截图 / PDF / 投屏

- `Page.captureScreenshot`：视口截图、全页、元素区域 clip、格式与质量。
- `Page.printToPDF`：纸张、横向、页眉页脚、缩放、页边距。
- screencast 帧流（阶段 3，IDE 远程预览场景）。

### I. 对话框 / 下载 / 文件

- `Page.javascriptDialogOpening` + `handleJavaScriptDialog`：alert/confirm/prompt/beforeunload 应答（阶段 2）。
- 下载行为：`Browser.setDownloadBehavior`、`downloadWillBegin`、`downloadProgress` 事件（阶段 2）。
- 文件上传：`DOM.setFileInputFiles`（阶段 2）。

### J. 设备与网络仿真（Emulation 域，阶段 2）

- 视口与设备度量（`setDeviceMetricsOverride`）。
- User-Agent 覆盖、触摸仿真。
- 地理位置、时区、语言、色彩方案（暗色模式）覆盖。
- CPU 节流（`setCPUThrottlingRate`）。
- 媒体特性与视力缺陷仿真（阶段 3）。

### K. 调试器（Debugger 域，阶段 3）

- 断点：行断点、DOM 断点、事件断点、XHR 断点。
- 暂停/恢复、单步进入/跳过/跳出。
- 调用栈、作用域变量、`Debugger.evaluateOnCallFrame`。

### L. 性能 / 内存 / 覆盖率（阶段 3）

- `Performance.enable/metrics`：FCP/LCP 等时间指标。
- `Tracing` 开始/停止与 trace 数据落盘。
- `Profiler` CPU 采样与精确覆盖率（`startPreciseCoverage`）。
- `HeapProfiler` 堆快照。

### M. 存储 / ServiceWorker / 安全（阶段 3）

- `Storage.clearDataForOrigin` 站点数据清理。
- ServiceWorker/SharedWorker 目标枚举与附加。
- `Security.certificateError` 证书错误 override；混合内容提示。

### N. 生态协同与边界

- CDP 模块是**通用协议客户端**：既可驱动外部 Chrome/Edge（`--remote-debugging-port` 启动），也可通过 `FBro_取调试端口` / `浏览器外壳_取当前调试端口` 取得地址后连接 LingBuilder 内嵌 FBro 浏览器。
- 与 FBro 命令的边界：FBro 命令面向内嵌浏览器的进程、窗口、HWND 与 Host 生命周期控制；CDP 模块面向协议级页面自动化与监听。两者不得复制对方实现；CDP 模块不得声明对 `lingbuilder.fbro.*` 的依赖，FBro 提供的调试地址只作为普通 CDP 端点消费。
- 传输层优先复用 WebSocket 客户端模块的运行时经验；JSON 编解码复用 JSON 模块能力；`/json` 端点发现复用 HTTP 客户端能力。若因依赖最小化而内嵌实现，必须在模块文档中说明理由，并保持与既有模块一致的错误处理与中文诊断风格。

## 分阶段落地计划

### 阶段 1：会话内核 + 基础自动化（MVP）

范围：

- A 全部横切能力（自动重连可为可选项）。
- B 基础：连接、断开、健康检查、Target 列表、附加、新建/关闭/激活标签页、版本查询。
- C 基础导航：打开网址、刷新、前进、后退、停止加载、标题/URL/HTML。
- D：`Runtime.evaluate`（awaitPromise、returnByValue、异常中文诊断）、控制台事件、页面异常事件。
- E：DOM 查询、属性读写、文本读取、点击、输入、滚动。
- F：鼠标移动/按下/释放/单击/双击/右键/滚轮；键盘按键/组合键/`insertText` 中文输入。
- G：网络事件监听、请求体、响应体、Cookie 读写删列、清缓存/清 Cookie。
- H：视口截图、全页截图、打印 PDF。
- 异步事件回调统一 `&处理器名` 语法。

验收门禁：

- `.lbmod` v2 清单（`contributes.commands` + `bindings.commands` + `targets[windows-msvc-win32]` + 至少一份 `contributes.docs` 真实中文文档）通过校验并完成安装。
- 会话内核测试：id 映射、事件分发、命令超时、错误中文映射、远程对象释放、sessionId 路由、Target 销毁清理。
- MSVC x64 真实编译通过；连接真实 Chrome/Edge headless 的端到端 smoke：连接 → 列表 → 打开页面 → 执行 JS → 点击/输入 → 截图 → 断开，全链路成功且无句柄泄漏。
- Monaco 补全、悬停、诊断接入 `ModuleService -> LingCppModuleContext -> lingCpp/languageService -> MonacoCodeEditor` 链路；设计器非可视组件"CDP 浏览器"可配置调试地址。

### 阶段 2：商业增量

范围：

- B：浏览器级命令、窗口边界、弹窗 Target 事件与附加。
- C：导航生命周期等待原语、frame 树维护、导航后引用失效、弹窗策略。
- D：`callFunctionOn`。
- E：`resolveNode`、`setFileInputFiles` 文件上传。
- F：拖拽与完整鼠标键盘面。
- G：Fetch 域拦截全量（暂停、继续、终止、改写、mock、认证应答、重放）、网络仿真（离线/限速/连接类型）、禁用缓存。
- H：元素区域截图。
- I：对话框应答、下载行为与进度事件、文件上传。
- J：Emulation 仿真全量（视口、UA、触摸、地理位置、时区、语言、暗色模式、CPU 节流）。

验收门禁：每类新增能力至少一个连接真实浏览器的 smoke（拦截并改写请求后页面正常、应答 alert/confirm、完成一次下载、上传文件、暗色模式截图等）；拦截开启期间的正常导航回归；模块文档、示例与补全同步更新；`&处理器名` 回调覆盖全部新增异步事件。

### 阶段 3：高阶与调试生态

范围：

- B：`setAutoAttach`、OOPIF、Worker 目标。
- C：页面弹窗接管策略增强。
- D：`addBinding` 双向调用。
- E：节点高亮。
- F：触摸事件。
- H：screencast。
- K：Debugger 全量（断点、单步、调用栈、作用域、evaluateOnCallFrame）。
- L：性能指标、Tracing、CPU 采样、精确覆盖率、堆快照。
- M：站点存储清理、Worker 目标管理、证书错误 override。
- 录制/回放：基于事件流的确定性任务回放。

验收门禁：断点/单步/调用栈真实调试 smoke；性能追踪产物落盘且校验非空；OOPIF 测试页面自动附加并按 sessionId 正确路由；回放与录制行为一致性测试。

## 中文 DSL 示例

阶段 1 实际命令形态（全部异步命令提交即返回，结果经 `&处理器名` 在 UI 线程回调）：

```lcpp
CDP连接 浏览器 ＝ CDP_连接("http://127.0.0.1:9222", &连接就绪)
CDP连接 备用 ＝ CDP_连接("http://127.0.0.1:9333", &连接就绪)   // 多开：不同端口并存

空 连接就绪()
    如果 (CDP_取当前事件类型() == "已就绪")
        CDP_新建页面(CDP_取当前连接(), "https://example.com", &页面就绪)
    否则
        调试输出(CDP_取当前错误())
    如果结束
结束

空 页面就绪()
    CDP_执行脚本(CDP_取当前页面(), "document.title", &脚本完成)
    CDP元素 按钮 = CDP_查询元素(CDP_取当前页面(), "#submit")
    CDP_点击元素(按钮, &点击完成)
结束

空 脚本完成()
    调试输出(CDP_取当前事件文本())
结束

空 点击完成()
    CDP_截图(CDP_取当前页面(), "result.png", 真, &截图完成)
结束
```

阶段 2 形态示例（命令名以最终清单为准）：

```lcpp
CDP_拦截开始(页面, "*://api.example.com/*", &请求被拦截)
CDP_拦截改写(拦截, "https://mock.example.com/data", 假)
CDP_应答对话框(页面, 真, "")
CDP_等待加载(页面, "load", 10)
```

## 运行时设计

CDP 的核心难点不是发送单个命令，而是长期维护协议会话：

- 管理递增的 CDP `id`。
- 维护 `id -> 请求回调` 的映射，含超时与取消。
- 接收浏览器主动推送的事件并按 `method`/`sessionId` 分发给订阅者。
- 处理 Target 会话切换、Target 销毁与页面导航造成的引用失效。
- 将 JSON 结果稳定映射成 LingBuilder 可用的数据类型（文本、整数、逻辑、字节集、结构化结果）。
- 远程对象与 DOM 节点句柄的受管生命周期与释放。
- 大响应 `IO.read` 分块与背压策略。
- 多线程访问同一会话的互斥；异步完成向 UI 的投递复用项目既有线程安全 UI 更新模式。

C++ 运行时需要 WebSocket 和 JSON 支持，并将 CDP 会话对象作为非可视组件或对象引用管理。连接、请求、事件订阅、错误和释放流程应由模块运行时统一负责，不能散落在 React 组件或 C++ 生成器中。

## 模块生态接入

模块清单应采用 `.lbmod` v2 格式，并至少包括：

- `contributes.commands`：中文命令补全、提示、文档和诊断。
- `bindings.commands`：中文命令到 C++ 运行时的确定性映射。
- 公开类型：浏览器连接、页面会话、元素引用、远程对象、事件结果、网络请求/响应快照、Cookie、拦截句柄等。
- `contributes.docs`：真实存在、非空且随模块包分发的中文 Markdown 文档；未实现的协议域必须在文档中显式标注阶段或"不支持"。
- `targets[]`：当前优先支持 `windows-msvc-win32`，并为后续平台适配预留边界。

工程接入要求：

- 提供模块打包脚本（参照 `npm run module:new-emoji` 的模式），支持 `--install` 安装并进入 `.lingbuilder/modules/`。
- CDP 命令属于后端无关能力，不依赖 `LingWindowBase`、`HWND` 或任何 UI 后端；不得把 CDP 对象注册为可视控件。
- 新增命令必须同时更新清单、补全、诊断、binding、C++ 运行时、文档与测试（四端一致）。
- CDP 相关命令、公开类型、示例和运行时行为发生变化时，必须同步更新模块文档、补全、诊断、C++ 生成和测试，并按仓库规则同步 `模块开发手册.md`、`MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`LingBuilder AI 规则手册.md`、`FUTURE_OPTIMIZATIONS.md`、`electron/README.md`。

## 安全边界

- 模块只控制用户显式开放调试端口的浏览器，不绕过浏览器安全机制。
- 默认只允许连接本机 `127.0.0.1`、`localhost` 或 `::1`。
- 远程 CDP 地址必须显式配置，并显示安全提示。
- 不允许通过 CDP 模块开放任意 Shell、任意文件系统访问或公网工作区控制能力。
- 连接失败、Target 不存在、协议错误和权限错误必须返回明确的中文诊断，同时保留原始 CDP 错误信息供排查。
- 拦截/mock 能力仅作用于所连接浏览器会话的网络流量，不得用于伪装其他进程或系统级流量。
- Cookie 与凭据类命令的结果不得写入日志或分享包。

## 设计器与 IDE 集成

设计器中可将"CDP 浏览器"建模为非可视组件，用于配置调试地址、默认页面和连接选项；浏览器页面、DOM 元素等运行时对象不应伪装成可视控件，也不应占用 `HWND`。

IDE 内的模块详情、中文补全、悬停提示、诊断和示例应通过 `ModuleService -> LingCppModuleContext -> lingCpp/languageService -> MonacoCodeEditor` 链路提供。运行时生成器必须消费同一份模块 binding 和类型信息，确保编辑器中的命令语义与导出的 C++ 工程一致。

IDE 侧验收：模块详情可打开并读取文档；Monaco 中 `CDP_` 命令有补全、参数提示与悬停文档；错误用法（如把会话当文本传参）产生中文诊断；示例项目可通过 F5 或导出构建运行。

## 验收门禁（全阶段通用）

- `cd electron && npm run lint`、相关 `npm run test:*`、`npm run build` 通过。
- 模块打包脚本产出 `.lbmod` 并通过 `/api/modules/package/preview` 预览确认后安装。
- 端到端构建测试使用真实 Chrome/Edge（headless 可）验证，不得只测 mock 传输层。
- 生成工程在 Visual Studio 中可打开、编译、运行，IDE 内行为与导出工程行为一致。
- 阶段完成情况必须同步回 `FUTURE_OPTIMIZATIONS.md` 与当日更新记录。

## 备注

如果"CDP"在具体需求中不是 Chrome DevTools Protocol，而是其他协议或业务缩写，应先明确全称和目标运行环境，再确定模块 API 与运行时实现。
