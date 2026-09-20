# CEF3 官方无头浏览器（OSR / windowless）设计

日期：2026-09-19
状态：待实现
关联模块：`lingbuilder.cef3.browser`、新增 `lingbuilder.cef3.osr`
关联原生组件：`electron/native/cef3-bridge/`（LingBuilderCefBridge，bridgeAbi 4.0.0 / CEF 150.0.14）

## 目标

用 CEF 官方的 windowless（OSR / `CefRenderHandler`）渲染路径，让 LingBuilder 用户在**不创建任何可见浏览器窗口**的前提下拥有可寻址的浏览器实例：

- 控制台项目（`windows-console`）可以在 `.lcpp` 代码里创建无头浏览器，加载页面、执行 JS、取文本/源码、填表点击、按实例编号管理生命周期。
- 窗口项目可以在可视化设计器里放置「CEF3无头浏览器」非可视组件，属性填好后运行时自动创建，代码按实例编号操作。
- 两条入口共用同一套进程级运行时登记表与同一批中文命令，行为完全一致。

## 非目标（红线）

- **禁止用「创建真实窗口再隐藏/移出桌面」冒充无头**。无头实例必须走 `CefWindowInfo::SetAsWindowless`，全进程不得为无头实例创建任何 HWND。
- 一期**不做页面截图/像素帧交付**。真 OSR 的画面只存在于 `OnPaint` 帧缓冲里，而帧到用户层的链路当前是断的（见缺口 4）；本设计不伪造截图能力，也不改用 DevTools 截图兜底（OSR 下 CDP 截图不可靠）。截图列为二期首批。
- 一期**不把 CEF 事件派发成中文事件处理器**。控制台项目没有窗口类，窗口项目的资源派发也依赖窗口实例；一期只给等待与轮询取事件命令。
- 不做 EdgeView / FBro 的无头对齐，不在本设计范围内。
- 不改 CEF 官方签名目录：`CEF3_API_COVERAGE` 的 `COMPLETE_TARGET.implemented = 1384`（`electron/scripts/generate-cef3-api-coverage.cjs:8`）与 `Cef3OperationCatalog.generated.inc` 的 operation_id 必须保持不变。

## 现状缺口（已核实）

| # | 缺口 | 证据 |
|---|---|---|
| 1 | 生成端从不点亮 OSR 标志，四条创建路径 flags 只组合 JS/图片/WebGL/DevTools/CHROME_RUNTIME | `electron/src/services/windowDesigner/lingCppWin32Project.ts:15607`、`:15716`、`:15787`、`:15840`；`LB_CEF3_BROWSER_WINDOWLESS` 在该文件出现 0 次 |
| 2 | OSR 创建仍强制非零 parent HWND；视口尺寸只能从 parent 客户端区推导，parent 无效时塌成 1×1 | `electron/native/cef3-bridge/LingBuilderCefBridge.cpp:11661`（`内嵌浏览器必须提供独立宿主HWND`）、`:9030-9045`（`GetViewRect` 回落 `std::max<int>(1,…)`）；`osr_view_width/height/osr_paint_count`（`:986-988`）只写不读，无 setter 导出 |
| 3 | 控制台项目跑 CEF 会自爆：`wmain` 入口没有子进程守卫（只在 `wWinMain` 有）；CEF 事件在 `hwnd_ == 0` 时被整条丢弃；无消息泵 | 子进程守卫仅 `lingCppWin32Project.ts:26952`；事件丢弃 `:20260`、`:20271`；控制台段 `generateConsoleEntrySection :9593-9658` 确认无泵、无窗口类注册 |
| 4 | 像素帧交付断链：桥 OnPaint 走 V4 `subject`，生成端把 V4 降形回 V3 时丢掉 subject | `LingBuilderCefBridge.cpp:9189-9223`；`lingCppWin32Project.ts:15173-15215`（降形）、`:15190`（仅 `资源响应已接收` 置上下文） |
| 5 | 54 项 OSR 官方接口在覆盖目录里全部 `implemented`，但从未成为 `.lcpp` 用户命令，也没有 `lingbuilder.cef3.osr` 模块 manifest | `Cef3OperationCatalog.generated.inc`（如 `:574` 的 `CEF3离屏_订阅像素帧`）、`electron/docs/modules/cef3/osr.md:4`；`cef3Modules.ts:724-734` 注册的 9 个子模块不含 osr；`builtinModules.ts` 里 `CEF3离屏_` / `CEF3OSR_` 前缀命中 0 |
| 6 | 全部 CEF3 内容命令形参是 `controlRef`（控件名），无头实例无控件即无法寻址 | `builtinModules.ts:982`（`CEF3_执行JS(控件名, 脚本)`）、`cef3Modules.ts:553`（`CEF3框架_取主框架(控件名)`）、`:595`（`CEF3开发工具_执行协议方法(控件名, …)`） |

已具备、可直接依赖的事实：

- 桥进程级预置 `settings.multi_threaded_message_loop = true`（`:21619`）与 `windowless_rendering_enabled = true`（`:21623`），CEF 自跑 UI 线程，**无头与控制台都不需要宿主消息泵**；`LB_CEF3_RunMessageLoop`/`QuitMessageLoop` 显式 `NOT_SUPPORTED`（`:21655-21671`），符合官方约束。
- `BridgeClient::GetRenderHandler()` 仅在 `state_->windowless` 时返回自身（`:8212-8215`），OSR 输入/几何回调已实现；`CEF3_是否禁用窗口渲染`（`builtinModules.ts:1014`）可作无头自检回读。
- 「实例编号 → 桥句柄」寻址先例现成：弹窗实例登记进 `cefBrowsers_` 用合成 ID `1000000 + 实例编号`（`lingCppWin32Project.ts:15760-15766`），`CEF3会话_取上下文实例(实例编号)`（`:16627-16632`）已证明该表可按实例编号取 `bridgeHandle`。
- 拿到 `框架句柄` 之后的能力全现成：`CEF3框架_执行JS`、`CEF3框架_取源码异步`/`取文本异步`、`CEF3填表_点击元素/赋值/置选择项/触发事件`、`CEF3DOM_*`（`cef3Modules.ts:553-589`）。

## 架构分层

```
.lcpp 中文命令（CEF3_创建无头浏览器 / CEF3无头_*）
        │
运行时：LingWindowBase 内的 cefBrowsers_ 实例表（新增无头编号偏移 2000000）
        │            ↖ 设计器资源 g_cefHeadless[] 在创建完毕后自动调 创建命令
        │
原生桥：LB_CEF3_BrowserCreateWindowless(LB_CEF3_BROWSER_CONFIG_V4)
        │
CEF：SetAsWindowless + Alloy + CefRenderHandler（无任何 HWND）
```

运行时侧不新建单例：控制台应用的常驻对象本身就是 `LingWindowBase` 派生的生成类实例（`lingCppWin32Project.ts:9634-9639` 的 `new 程序(g_windows[0])`），`cefBrowsers_`、`CEF3_查找实例`、`CEF3_创建弹窗浏览器` 在控制台里已经可达，只是 `hwnd_` 恒为 0。无头实例沿用这套表，语义与弹窗实例完全同构。

## 1. 原生桥契约（唯一原生改动，全部新增）

改动文件：`electron/native/cef3-bridge/LingBuilderCefBridge.h`、`.cpp`、`LingBuilderCefBridgeTests.cpp`。

1. **新结构体** `LB_CEF3_BROWSER_CONFIG_V4`（.h，紧跟 `:285` 的 V3）：V3 全字段 + 尾部追加 `uint32_t osr_width; uint32_t osr_height;`。V3 结构体本身**不得原地追加字段**（`struct_size` 判长机制就是为此存在的，改 V3 会让旧头文件与新 DLL 组合越界读）。
2. **默认视口常量**：`LB_CEF3_DEFAULT_OSR_WIDTH 1280` / `LB_CEF3_DEFAULT_OSR_HEIGHT 720`。
3. **新导出**：

   ```c
   LB_CEF3_API LB_CEF3_HANDLE LB_CEF3_CALL LB_CEF3_BrowserCreateWindowless(
       const LB_CEF3_BROWSER_CONFIG_V4* config);
   LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserSetOsrViewport(
       LB_CEF3_HANDLE browser, uint32_t width, uint32_t height);
   LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrViewport(
       LB_CEF3_HANDLE browser, uint32_t* width, uint32_t* height);
   LB_CEF3_API int LB_CEF3_CALL LB_CEF3_BrowserGetOsrPaintCount(
       LB_CEF3_HANDLE browser, uint64_t* paint_count);
   ```

   `BrowserCreateWindowless` 内部复用 `CreateBrowserHandle(config, /*chrome_runtime=*/false)`，但强制要求 `flags & LB_CEF3_BROWSER_WINDOWLESS`，缺失即 `Fail(LB_CEF3_ERROR_INVALID_ARGUMENT, L"无头浏览器创建必须指定 WINDOWLESS 标志")` 并返回 0——**不得静默退化成窗口浏览器**。既有 `LB_CEF3_BrowserCreate` / `LB_CEF3_BrowserCreateChrome` 签名与行为零改动。
4. **校验放宽（`cpp:11653-11663`）**：`CreateBrowserHandle` 接受 `abi_version ∈ {V3, V4}`，按 `struct_size` 判定能否读视口尾部字段；parent 判定改为
   - `chrome_runtime && windowless` → 保持 `NOT_SUPPORTED`「Chrome Runtime 浏览器不支持无窗口/OSR 创建」（`:11658`）；
   - `!chrome_runtime && !windowless && parent_window == 0` → 保持「内嵌浏览器必须提供独立宿主HWND」；
   - `windowless && parent_window == 0` → **放行**（真无头）；`windowless && parent_window != 0` 仍合法，parent 只用于 DPI/屏幕坐标/对话框归属，符合 .h:236 既有注释。
5. **视口权威化（`GetViewRect :9030`）**：优先级为 已存储的 `osr_view_width/height` → parent 客户端区 → 默认常量；不再出现 1×1 塌缩。`ApplyManagedRect` 的订阅覆盖路径（`:9046-9057`）保持。
6. **SetOsrViewport 语义**：写存储视口后调用 `host->NotifyScreenInfoChanged()` 与 `host->Invalidate(PET_VIEW)`，让 CEF 重查 `GetViewRect`；参数非正数返回 `INVALID_ARGUMENT`。
7. **诊断口径**：所有新增失败路径必须经既有 `Fail(...)` 输出中文消息，不得只回错误码。
8. **不新增 CEF 官方签名映射**，因此 coverage/catalog 生成物内容不变（脚本会重跑并确认零漂移）。

发布链（改桥必做，缺一不可）：

```
cd electron
npm run module:cef3-bridge      # 重编 DLL/.lib/.h，回写 VERSION.json 三文件 SHA-256
npm run module:cef3-sdk         # 同步进 .lingbuilder/modules/lingbuilder.cef3.sdk/
npm run module:cef3-coverage && npm run module:cef3-catalog && npm run module:cef3-coverage:check
npm run module:cef3-docs && npm run module:cef3-docs:check
npm run verify:cef3-release     # 打包前门禁（解包后另有 verify:cef3-installer）
```

已知现状：仓库 `cpp/.h`（09-19）新于 SDK 目录内 DLL（09-12），本次一并重编掉该差量。**旧 `.lcpppkg` 导出包不含新桥**，涉及无头能力的教程包需重导（记入 FUTURE_OPTIMIZATIONS）。

## 2. 生成器运行时：无头实例登记（复用 `cefBrowsers_`）

改动文件：`electron/src/services/windowDesigner/lingCppWin32Project.ts`。

1. 不新建登记表：无头实例直接登记进 `LingWindowBase` 已有的 `cefBrowsers_`（`:11937`），键用新偏移 `CEF3_运行时无头编号偏移 = 2000000`（与弹窗 `1000000+` 同法错开设计器 controlId 空间），条目复用 `CefBrowserInstance`（`:11895`）并新增 `headlessEvents` 队列。控制台与窗口共用该类的运行时函数（控制台常驻对象即 `LingWindowBase` 派生实例，见架构分层说明），因此所有成员函数一律挂在 `LingWindowBase` 上，不产出文件级自由函数。新增成员：

   ```cpp
   static const int CEF3_运行时无头编号偏移 = 2000000;
   CefBrowserInstance* CEF3_查找无头实例(int instanceId);
   int CEF3_创建无头浏览器(int instanceId, const wchar_t* address, const wchar_t* cacheDirectory,
                           const wchar_t* proxyServer, int viewWidth, int viewHeight);
   void LingBuilder_CEF3_自动创建无头实例();   // 读 g_cefHeadless[] 逐个创建
   void LingBuilder_CEF3_关闭全部无头实例();
   void LingBuilder_CEF3_退出回收();            // 关闭全部无头实例 + LB_CEF3_Shutdown
   ```

2. **创建即真无头**：`CEF3_创建无头浏览器` 内先确保 CEF 已初始化（与弹窗路径同法调 `CEF3_初始化`），再填 `LB_CEF3_BROWSER_CONFIG_V4{ abi_version = LB_CEF3_ABI_VERSION_V4, flags = LB_CEF3_BROWSER_JAVASCRIPT | LB_CEF3_BROWSER_IMAGES | LB_CEF3_BROWSER_WINDOWLESS, parent_window = 0, initial_url, profile_key, proxy_mode/proxy_server, osr_width, osr_height }` 调 `LB_CEF3_BrowserCreateWindowless`。**全程不出现 `CreateWindowExW`/`RegisterClassExW`/`ShowWindow`**。
3. **事件入队**：既有桥事件回调入口（`CEF3_Bridge事件回调`，按 `user_token` 路由，`:15413-15431` 区）命中无头键段时，把事件名 + 关键字段序列化成 JSON 入队，**不**走 `CEF3_发送事件/投递事件`（`:20260/:20271` 的 `hwnd_` 判空路径继续留给窗口实例，无头不依赖它）。
4. **等待语义**：`CEF3无头_等待加载完成` 与「取文本/取源码」内部一律 50ms 轮询（CEF 侧无 `LB_CEF3_TaskWait`，只有 FBro 有），超时按参数返回失败并在调试输出给中文提示；禁止无界等待。
5. **控制台入口补齐**：`generateConsoleEntrySection`（`:9593-9658`）在 `wmain` 最前面、`LingBuilder_EnsureConsoleRuntimeInitialized()` 之前插入与 `wWinMain:26951-26953` 同形的守卫：

   ```cpp
   #if LINGBUILDER_CEF3_BRIDGE_AVAILABLE
       int cefExitCode = LB_CEF3_ExecuteSubProcess(reinterpret_cast<uint64_t>(GetModuleHandleW(nullptr)));
       if (cefExitCode >= 0) return cefExitCode;
   #endif
   ```

   没有这段，CEF 一启子进程就会把用户控制台程序体再执行一遍（当前确定缺陷）。
6. **退出回收**：控制台把 `return consoleApp.启动();` 改为先取退出码 → `consoleApp.LingBuilder_CEF3_退出回收();` → 返回退出码（回收成员函数内部做「关闭全部无头实例 + `LB_CEF3_Shutdown()`」，对齐窗口版 `:27024-27026`）；「空 启动()」形态同样在调用后插入回收再 `return 0;`，保持 `tests/consoleProject.test.ts:56`、`:70` 既有入口形状断言不破。窗口项目在窗口销毁路径上同样并入既有 `CEF3_关闭全部实例()`。
7. **泄漏封堵**：桥的 `g_default_browser_state` 每次创建覆盖（`:11703`）属常驻强引用，本次不动桥该行为，但 `CEF3无头_关闭` / `LingBuilder_CEF3_关闭全部无头实例` 必须 `BrowserClose(handle, 1) + HandleRelease`（对齐 `:20307-20333`），并在测试里断言无头实例不会绕过释放。

## 3. 中文命令面

### 3.1 无头实例命令（`lingbuilder.cef3.browser`，`builtinModules.ts` 与 `CEF3_创建弹窗浏览器` 同节 `:973-994`）

全部用 `实例编号`（正整数）寻址，与设计器组件属性里的「实例编号」一一对应；`contributes.commands` 与 `bindings.commands[]` 必须同时补（AGENTS.md 模块生态规则）。

| 命令 | 签名 | 返回 |
|---|---|---|
| 创建 | `CEF3_创建无头浏览器(实例编号, 地址, 独立缓存目录, 代理地址, 视口宽, 视口高)` | 整数型 |
| 存在性 | `CEF3无头_是否已创建(实例编号)` | 整数型 |
| 视口 | `CEF3无头_设置视口(实例编号, 宽, 高)` / `CEF3无头_取视口JSON(实例编号)` | 整数型 / 文本型 |
| 出帧自检 | `CEF3无头_取渲染帧数(实例编号)` | 长整数型 |
| 导航 | `CEF3无头_导航(实例编号, 地址)` / `CEF3无头_是否加载中(实例编号)` | 整数型 |
| 等待 | `CEF3无头_等待加载完成(实例编号, 超时毫秒)` | 整数型（1 成功 / 0 超时） |
| 元信息 | `CEF3无头_取标题(实例编号)` / `CEF3无头_取地址(实例编号)` | 文本型 |
| **寻址适配** | `CEF3无头_取主框架(实例编号)` | 长整数型（框架句柄） |
| **寻址适配** | `CEF3无头_取浏览器句柄(实例编号)` | 长整数型（受管浏览器句柄） |
| 脚本 | `CEF3无头_执行JS(实例编号, 脚本)` | 文本型 |
| 内容 | `CEF3无头_取页面文本(实例编号, 超时毫秒)` / `CEF3无头_取页面源码(实例编号, 超时毫秒)` | 文本型 |
| 事件轮询 | `CEF3无头_取事件JSON(实例编号)` | 文本型 |
| 关闭 | `CEF3无头_关闭(实例编号)` | 整数型 |

`CEF3_设置实例用户代理` / `CEF3_取实例用户代理` / `CEF3会话_取上下文实例` / `CEF3_枚举实例JSON` / `CEF3_关闭全部实例` 必须同时覆盖无头实例（`CEF3_枚举实例JSON` 每项加 `mode: "windowless"` 字段区分弹窗/区域/控件）。

两个寻址出口的分工固定，不得互相顶替：`CEF3无头_取主框架` 是页面内容/填表/DOM 类命令的句柄来源（`CEF3框架_*`、`CEF3填表_*`、`CEF3DOM_*` 全链零改动可用）；`CEF3无头_取浏览器句柄` 是浏览器级命令的句柄来源（`CEF3OSR_*`、`CEF3离屏_*`、`CEF3_设置窗口外帧率` 等）。两个句柄都由运行时托管，用户侧不得释放，实例关闭后一律失效并返回中文诊断。

关键设计：**页面内容/交互一律通过 `CEF3无头_取主框架` 返回的框架句柄复用现成命令链**（`CEF3框架_*`、`CEF3填表_*`、`CEF3DOM_*` 零改动可用），禁止为每条下游命令再复制一份 `CEF3无头_*` 变体（会形成第二套并行 API 面）；`CEF3无头_*` 只保留创建、状态、等待、事件轮询、句柄获取与关闭这几条实例级命令。

`CEF3_创建无头浏览器` 的 `参数说明`（`BUILTIN_PARAM_DOCS`，`builtinModules.ts:434-444` 加载期有抛错门禁）必须写明：地址传空为 `about:blank`、缓存目录传空用默认 profile、代理地址非空即独立出口 IP、视口默认 1280×720。

### 3.2 OSR 官方接口模块（新建 `lingbuilder.cef3.osr`，`cef3Modules.ts`）

一期只登记与无头直接相关的官方接口为用户命令（其余 `implemented` 目录项保持不暴露，二期按批收口）：

- `CEF3OSR_请求重绘(浏览器句柄, 元素类型)`（invalidate）、`CEF3OSR_设置窗口外帧率` / `CEF3OSR_取窗口外帧率`
- `CEF3离屏_订阅像素帧` / `CEF3离屏_订阅视图矩形`（订阅位，为二期帧交付预留；一期调用只点亮订阅，不承诺帧内容可达用户层，描述必须如实写明）
- 既有已暴露的 OSR 输入/几何高级命令（`CEF3_发送鼠标单击事件` 等，`builtinModules.ts:1042-1046`）参数从 `controlRef` 扩为「控件名或浏览器句柄」二选一形态——**这是二期**，一期无头自动化一律走 `CEF3填表_*` + `CEF3框架_执行JS`，不使用坐标输入。

新模块 `module()` 声明（`cef3Modules.ts:58-70`）：`category: '系统'`、`CORE_DEPENDENCY`、`targets = windows-msvc-x64`、`contributes.docs[]` 指向已存在的 `electron/docs/modules/cef3/osr.md:1065`。版本必须与主模块对齐为 `3.0.0-alpha.4`（顺带修正 `CEF3_ALPHA_VERSION` 仍停在 `3.0.0-alpha.3`、而 `builtinModules.ts:960` 已是 `alpha.4` 的既有不一致）。

## 4. 可视化设计器

1. **类型与模型**：`electron/src/services/windowDesigner/types.ts` 的 `LingControlType` 联合（`:7-12`）加 `CefHeadlessBrowser`；新增 `LingCefHeadlessResource` 接口并入 `LingDesignerResource` 联合（`:250`）。资源存在**项目级** `project.resources[]`（`:265-273`）。
2. **注册表**：`win32ControlRegistry.ts` 用 `nonVisual({...})`（`:228`）登记，`moduleId: 'lingbuilder.cef3.browser'`、`category: '非可视'`、`nativeClass: 'cef-windowless'`、`nativeAdapter: 'cef-headless-resource'`、属性 `instanceNumber(实例编号)`、`url(初始地址)`、`cacheDir(独立缓存目录)`、`proxy(代理地址)`、`viewWidth(视口宽)`、`viewHeight(视口高)`、`autoCreate(启动时自动创建)`；**一期不声明 events**（避免走窗口类派发）。注册条目由 `createControlContributions('lingbuilder.cef3.browser')`（`builtinModules.ts:25-45`，挂载点 `:973`）自动复制进 `contributes.designerControls`，与同模块可视控件 `CefBrowser`（注册表 `:335`）同源，禁止另写第二份清单。禁止声明 `runtimeControl`（`manifest.ts:265` 对 `isVisual:false` 硬拒）。属性键必须与实际持久化字段完全一致，否则 `tests/windowControlCompleteness.test.ts:67-76` 逐类型硬编码断言会红。
3. **模型 JSON 形状**：

   ```json
   { "id": "cefheadless-main", "type": "CefHeadlessBrowser", "name": "CEF3无头浏览器1",
     "designerX": 60, "designerY": 660, "ownerWindowId": "main-window",
     "instanceId": 1, "url": "https://www.example.com", "cacheDir": ".cef3/headless-a",
     "proxyServer": "", "viewWidth": 1280, "viewHeight": 720, "autoStart": true }
   ```

4. **工具箱与画布**：`WpfDesigner.tsx` 的 `CREATABLE_DESIGNER_CONTROL_TYPES`（`:301-306`）追加 `CefHeadlessBrowser`，组件落在**「浏览器控件」**组（`controlToolboxModel.ts:33-40` 已有 `lingbuilder.cef3.browser → browser` 映射，不新建分组）；`onAddControl` 新分支（`:2090` 同法）写入 `project.resources`；画布设计期占位卡复用资源占位路径（`:3449-3500`），文案 `CEF3无头浏览器 · 非可视（不创建窗口）`；专用 `CefHeadlessProperties` 面板 + inspector 接线（`:3615`），面板必须显式提示「无头实例不产生窗口，也不会有画面或截图；取内容请用 `CEF3无头_取页面文本` / `CEF3无头_执行JS`」。图标复用注册表 `icon: 'Globe'`（`CefBrowser` 已用），仅当 `TYPE_ICONS`（`:324-346`）缺该键时补映射；新面板控件需带 `aria-label`（`tests/designerProfessionalUi.test.tsx` 断言）。
5. **C++ 生成**：新增 `struct CefHeadlessSpec`（对齐 `FileDialogSpec:10224`）与 `generateCefHeadlessSpecs()`（对齐 `:29001`）→ `g_cefHeadlessBrowsers` + `g_cefHeadlessBrowserCount`（空表出哨兵行，与 `g_fileDialogs` 同法）。自动创建是 `LingWindowBase` 成员 `LingBuilder_CEF3_创建无头资源()`，**必须按 `spec.ownerWindowIndex == spec_.index` 过滤**（Task 9 落地时修正本节的「项目级不过滤」草案：无头实例登记在所属窗口对象的 `cefBrowsers_` 里，不过滤会让别的窗口按编号取到不存在的实例，也无法在多窗口项目里区分归属），再加 `autoStart` 判定与「该编号已存在即跳过」。调用点：窗口项目在 `OnWindowCreated` 链上（与 EdgeView/FBro 无头资源同处），控制台项目在 `wmain` 守卫与无头泵窗口之后、`启动()` 主体之前。`validateCefHeadlessResources`（进 `blockingDiagnostics`，不放 warnings）负责：所属窗口存在、组件名唯一、实例编号正整数且在 CEF3 无头族内项目级唯一（跨引擎各自独立编号，与已提交的 EdgeView 口径一致）、视口宽高为正整数、缓存目录仅工作区内相对路径。
6. **controlRef 与门禁**：一期无头命令不接 `controlRef`（全 `实例编号`），因此不参与控件引用门禁；但 `controlReferenceService.ts` 的 `resourceToSymbols`（`:692-715`）要能解析出该资源符号（`kind:'resource'`、`nonVisual`），供 Ctrl+单击导航与「组件表」视图使用；`aiBridgeService.ts:2052` `nonVisualResources` 自动包含。若后续把 `CEF3无头_*` 改成接受组件名，必须同时补 `builtinModules.ts:448-466` 的前缀→资源类型映射，否则门禁报缺 `controlKinds`。
7. **外部 AI 可见性**：`MCP_INSTRUCTIONS` 与 `lingbuilder.module.info` 描述必须新增无头口径（含「OSR 无画面、无 HWND、截图未开放、控制台项目用等待/轮询」），并同步 `LingBuilder AI 规则手册.md`；否则外部 AI 会退化成「创建弹窗再隐藏」这种被禁止的写法。

## 5. 数据流（控制台项目一次抓取）

```
wmain
 ├─ LB_CEF3_ExecuteSubProcess(...) >= 0 → return      （子进程直接退出，不重跑程序体）
 ├─ EnsureConsoleRuntimeInitialized / 常驻单例 / RegisterHeadlessThreadOwner
 ├─ 启动()
 │    ├─ CEF3_创建无头浏览器(1, "https://...", ".cef3/a", "", 1280, 720)
 │    │     └─ CEF3_初始化 → LB_CEF3_BrowserCreateWindowless(V4, WINDOWLESS, parent=0)
 │    │           └─ CEF UI 线程 SetAsWindowless + Alloy + CefRenderHandler
 │    ├─ CEF3无头_等待加载完成(1, 8000)                （50ms 轮询 IsLoading）
 │    ├─ CEF3无头_取标题(1) / CEF3无头_执行JS(1, "document.title")
 │    ├─ 框架 = CEF3无头_取主框架(1) → CEF3框架_取源码异步(框架) → 轮询任务 → 文本
 │    └─ CEF3无头_关闭(1)
 └─ consoleApp.LingBuilder_CEF3_退出回收()（关闭全部无头实例 + LB_CEF3_Shutdown）→ return
```

## 6. 错误处理

| 场景 | 行为 |
|---|---|
| `CEF3_创建无头浏览器` 实例编号 ≤ 0 / 视口 ≤ 0 | 中文 `调试输出` + 返回 0，不创建 |
| 同实例编号重复创建 | 先关旧再建新（与弹窗/区域实例同口径，`:15761`/`:15821`） |
| 未启用 `lingbuilder.cef3.browser` 就调用 | 生成前中文诊断，指明模块 ID 与启用路径（复用 `getUnknownDeclaredTypeDiagnostics`） |
| 架构非 x64 | 走既有 `buildConfigurationService.ts:24-26` CEF3→x64 强制切换与中文提示 |
| CEF 初始化失败 | 「CEF3 Bridge初始化失败…」原有中文诊断，`CEF3无头_是否已创建` 保持 0 |
| `CEF3无头_*` 作用于不存在/已关闭实例 | 返回 0 或空文本 + 中文 `该实例编号不存在或浏览器尚未创建`（对齐 `:16632`） |
| 等待/取内容超时 | 返回失败值 + 中文提示，禁止无界阻塞 |
| 对无头实例调用坐标型 OSR 输入命令 | `controlReferenceService` 解析到目标是 `CefHeadlessBrowser` 资源时，中文诊断必须点名替代方案（`CEF3填表_*` / `CEF3无头_执行JS`），不得只报「找不到控件」，也不得静默无效果 |
| 用户要求「无头截图」 | 明确不支持并指向二期，不得用隐藏窗口或 DevTools 兜底伪造 |

## 7. 测试与验收

1. **桥单测**（`LingBuilderCefBridgeTests.cpp`，已有 OSR 用例 `:2188`、`:9937`）扩：`parent_window = 0` + `WINDOWLESS` 创建成功；`GetViewRect` 返回 V4 指定尺寸而非 1×1；`SetOsrViewport` 后帧数递增且视口更新；缺 `WINDOWLESS` 标志调 `BrowserCreateWindowless` 被拒；`CHROME_RUNTIME | WINDOWLESS` 仍被拒；V3 config 走旧导出行为不变（回归）。
2. **清单与语言服务**：`tests/modules.test.ts` 新命令的 contributes/binding 成对、参数计数、常量与文档门禁；计数与 digest 基线（`:285` 的 `modules:98 / commands:3701 / parameters:6463 / controlReferences:1307` 与 `:800` 全量基线）按实算重算并更新注释；`tests/cef3BridgeEventNames.test.ts` 覆盖订阅位映射。
3. **设计器与生成**：`tests/windowDesigner.test.ts` 新增「无头资源注册表 + 属性键 + 生成 C++ 正则」用例（仿 `:2665-2721` FileDialog 写法）；`tests/windowControlCompleteness.test.ts` 补该类型 propertyKeys；`tests/lingcpp.test.ts` 覆盖补全/诊断/示例可解析；`tests/designerProfessionalUi.test.tsx` 覆盖面板渲染与 `aria-label`。
4. **生成器静态断言**：控制台与窗口两种 `outputKind` 的产物都必须含 `LB_CEF3_BROWSER_WINDOWLESS`，且断言无头路径里**不存在** `CreateWindowExW` / `ShowWindow` / `SetWindowPos` 关联到无头实例（防止回归成隐藏窗口方案）。
5. **真机端到端（硬验收，不接受只过单测）**：
   - `electron/scripts/smoke-cef3-headless-native.ts`（新增，接入 `test:lingcpp` 与 package.json 脚本）：AI Bridge CLI `project.create(templateId:'windows-console')` → 写 `.lcpp`（创建/等待/取标题/执行JS/取源码/关闭）→ `build.run`（x64）→ `run.wait` 退出码 0 → `run.log` 断言含真实标题与源码片段 → 断言进程无 `LingBuilder*cef*` 子进程残留、任务管理器无新增窗口。
   - 窗口项目同一命令集 + 设计器放置组件（`autoCreate: true`）各跑一遍。无头证据必须用实例编号命令（`CEF3无头_是否已创建` 返回 1、`CEF3无头_取渲染帧数` ≥ 1、`CEF3无头_取视口JSON` 回读设计器视口）；`CEF3_是否禁用窗口渲染` / `CEF3_取运行时样式` 是 `controlRef` 命令，无头实例没有控件名，不得用作断言口径。
   - 反例验收：仓库内不存在任何为无头实例创建 HWND 的代码路径。
6. **打包验收**：`verify:cef3-release` / `verify:cef3-installer` 绿；解包确认 SDK 内 DLL 与头文件含 `BrowserCreateWindowless` 导出（用 `dumpbin` 级别 ASCII 断言，禁止用中文串 grep bundle）。

## 8. 交付批次

**批次一（能力可用）**：桥（§1）+ 桥测试 + 重编发布链 → 运行时段与控制台守卫（§2）→ 无头命令（§3.1）→ 控制台真机端到端 + 窗口项目命令式验收 + 清单基线重算。

**批次二（界面可放 + AI 可用）**：设计器非可视资源全链（§4）+ 窗口项目真机放置验收 + `lingbuilder.cef3.osr` 模块（§3.2）+ 外部 AI 可见性与文档同步 + 演示项目 `examples/cef3-headless-demo/`。

每批次结束必须：跑 `cd electron && npm run lint && npm run test:lingcpp && npm run build`；写当天 `更新记录/2026-09-XX.md`；把未完成项写回 `docs/FUTURE_OPTIMIZATIONS.md`。

## 9. 文档同步清单

`LingBuilder AI 规则手册.md`（`.lcpp` 命令规范 + 外部 AI 节）、`docs/模块开发手册.md`（新模块 + OSR 命令）、`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`docs/CEF3_API_COVERAGE.md` 与 `docs/CEF3浏览器150内核封装.md`、`electron/docs/modules/cef3/{README,osr,browser}.md`（生成物）、`docs/FUTURE_OPTIMIZATIONS.md`（截图/帧交付、OSR 输入句柄形态、其余 OSR 接口收口、旧 `.lcpppkg` 重导）、`electron/README.md`、`根 AGENTS.md` 模块生态与 AI Bridge 节、当天 `更新记录/`。

## 10. 已知边界与后续

- **无头截图**：二期首批，必须打通 V4 `subject` → 运行时克隆缓冲（桥 OnPaint 回调返回即 `BufferRelease`，`:9222`）→ `CEF3图像_添加位图` + `取PNG缓冲`（`cef3Modules.ts:407/421`）→ 落盘命令；同时补 `LB_CEF3_TaskGetBuffer` 类出口，避免用户层手动管句柄。
- **OSR 输入句柄形态**：把 `CEF3_发送鼠标/键盘事件` 从 `controlRef` 扩为「控件名或浏览器句柄」，无头才可能做真实交互回放。
- **事件处理器派发**：需要进程级派发队列 + 线程安全入口（不能像窗口版那样 `PostMessage` 到宿主窗口），届时再设计，一期不承诺。
- `examples/` 不随 IDE 安装包分发（既有边界），无头演示项目在打包版工作区取不到语料。
