# LingBuilder Electron

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
- 每个包包含 `lingbuilder-source-package.json` 和独立 `workspace/`，清单记录全部文件大小及 SHA-256。导入拒绝路径越界、符号链接、额外文件、哈希不一致、超过 1GB 的包和超过 2GB 的解压内容。
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

开发模式会先启动当前 Vite/React/TypeScript 原型服务，再打开 Electron 窗口加载：

```text
http://127.0.0.1:3001/
```

开发脚本显式传入工作区、规则手册、回环 host/port，并显式启用仅限 `development + loopback` 的无会话鉴权模式。生产/安装版不能关闭会话鉴权。

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
- 两条打包命令都把 CEF3 SDK 完整性作为硬门禁：打包前校验模块/版本/关键文件/x64 架构并计算全部文件的大小和 CRC32，Electron Builder 的 `beforePack` / `afterPack` 对源目录和 `win-unpacked` 再校验；`package:win` 还会从最终 NSIS 安装包归档中逐文件比对。缺少或损坏 SDK、`extraResources` 漏复制、内核版本混用时命令直接失败。可单独运行 `npm run verify:cef3-release`、`npm run verify:cef3-installer` 和 `npm run test:cef3-release` 排查。
- NSIS 安装向导默认勾选“将 LingBuilder CLI 添加到当前用户 PATH”，也允许用户取消；重复安装去重，卸载时只移除当前 LingBuilder 安装目录。CLI 由根目录 `lingbuilder.cmd` 调用 `resources/app.asar/dist/cli.cjs`，不要要求最终用户另外安装 Node.js。
- `package:win` 会先从微软官方地址下载并校验 WebView2 Evergreen Bootstrapper，再冻结到 NSIS 资源；安装阶段仅在注册表未检测到 WebView2 Runtime 时补装，失败不会阻止 LingBuilder 本体安装，可稍后从“工具 → 环境修复中心”重试。
- 安装版主进程先启动不可见的独立本地服务，显式传入工作区、renderer 静态目录、规则手册、`127.0.0.1` 随机端口和随机会话 token，收到 ready 信息后才加载窗口。
- renderer 仍使用相对 `/api/*`，Electron 会自动注入本地会话 token；普通 IDE 服务拒绝 `0.0.0.0`，默认不挂载 `/api/ai-bridge/*`。
- 首次运行会在“文档/LingBuilder/起始工作区”创建干净的“未命名解决方案 / 新建项目”，只复制安装包内置模块等必要资源，不会携带开发仓库项目；以后从安装版专用的 `userData/workspace-state.packaged.json` 恢复最近工作区，开发版继续使用独立的 `workspace-state.json`。文件菜单、命令面板、解决方案根节点右键菜单和载入失败页均可“关闭当前解决方案”，该操作保留原磁盘文件并切换到新的空白工作区。工具栏“打开”使用原生目录选择器并重启本地服务。
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
- 设计器项目保存为 `schemaVersion: 2`，控件专属数据位于 `properties`，旧无版本项目在读取时安全迁移。
- 图片框“图片源”右侧按钮调用 Electron 原生文件对话框；选中的本地图片由 `src/services/windowDesigner/designerAssetService.ts` 复制到项目 `assets/`，模型只保存相对路径。受控预览 API、F5、原生导出及 AI Bridge 共用该服务；生成的 Visual Studio 工程会在构建后把图片复制到 exe 输出目录。
- 解决方案资源管理器中右键项目并选择“添加资源…”也可导入图片；工作台命令会按所选项目自动复制到 `assets/`（默认项目）或 `assets/<projectId>/`（多项目）。项目树的“图片资源 (assets)”组会列出全部图片：单击图片可预览真实资源和尺寸，右键图片并选择“复制相对路径”即可获得可直接用于 `.lcpp` 的路径。
- 普通 Win32 图片框可在 `.lcpp` 中调用 `图片框1.设置图片("assets/示例.png")` 动态换图，等价命令为 `控件_设置图片("图片框1", "assets/示例.png")`；也可传入 `文件对话框_取文件(...)` 返回的完整路径，传入空文本会清空图片。运行时继续使用设计器配置的填充方式。
- 图片框即使初始没有配置图片源，也会以 Win32 `SS_BITMAP` 静态控件创建；因此可以在文件已选择或文件被拖入事件中直接调用 `.设置图片(...)`，不需要先在设计器中放置一张占位图片。
- 高级模块未启用时，工具箱显示依赖状态但不能新增高级控件；项目已有高级控件不得被删除或静默替换。
- 内置 `lingbuilder.edgeview` 模块按 v2 `contributes.designerControls` 贡献 `Edge浏览器 (EdgeBrowser)`：项目启用后工具箱可添加多个可拖动、可调整尺寸的 WebView2 占位，设计器父子层级会生成窗口、容器或选项卡页的真实父 HWND。每个控件拥有独立宿主、Controller 和默认 `.edgeview/<controlId>` User Data Folder，并可在属性面板设置地址、缓存目录和代理；按控件名的创建、导航、JS、事件读取、前进后退、刷新和关闭命令与原数字实例/区域 API 并存。事件目录以稳定 SDK `Microsoft.Web.WebView2 1.0.3537.50` 为边界，接入普通 HWND 控件可达的 62 项 WebView、Controller、Environment、Download、Find、Frame、Notification、Profile、DevTools 和自定义菜单事件，数据统一返回 UTF-16 JSON；仅 CompositionController 专属的 2 项合成事件不适用于真实 HWND 控件。原生构建从 NuGet 缓存复制 WebView2 SDK 头文件与目标架构 Loader，不依赖 React 组件硬编码路径。
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

binding 处理器参数可声明为 `handler`，`.lcpp` 用 `&处理器名` 引用当前类的无参数事件或方法。`lingbuilder.web.http` 1.1.1 使用该语义提供 `网页_异步访问`：请求在受控后台线程执行，完成处理器通过 Win32 消息回到 UI 主线程，结果按请求编号隔离读取。命令提示通过 `returnDescription` 解释返回值语义，并优先显示 binding 为每个参数声明的独立说明。

Win32 高级模块还提供结构化集合编辑、ImageList 项目资源管理和完整系统对话框状态读取。文件筛选器采用 `名称|模式` 成对格式；`系统对话框_状态()` 返回 1/0/-1，查找替换和工具栏通过专用读取命令返回最近动作，`打印文本` 会向所选打印机提交真实文档。

Win32 高级工具箱包含可视“颜色选择器”。它显示当前色块和可选 `#RRGGBB` 文本，点击后打开 LingBuilder 自绘暗色弹窗，提供 HSV 色谱、色相条、HEX/RGB、常用预设和确认/取消，不再显示旧式系统颜色窗口；弹窗采用整窗双缓冲和 HSV 色谱缓存，拖动选色不闪烁，HEX 值在输入区域垂直居中。将设计器“可见性”设为隐藏后，运行时仍保留该组件，可在按钮、菜单或其他事件中调用 `颜色选择器_打开("颜色选择器1")`。`颜色选择器_置颜色/取颜色` 使用 COLORREF 整数，选择过程可绑定颜色改变、窗口打开、确认、取消和关闭事件。

非可视 ToolTip 和 PropertySheet 位于设计器“项目 / 行为与属性页”资源区：ToolTip 绑定目标控件并拥有独立延迟；PropertySheet 编辑顶层页面、应用事件处理器，并由中文命令 `属性页_显示("资源ID")` 打开。

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
