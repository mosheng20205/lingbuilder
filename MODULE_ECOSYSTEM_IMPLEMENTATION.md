# LingBuilder 模块生态实现说明

> 2026-07-30 补充：仓库新增清单驱动的全模块演示生成器 `electron/scripts/generate-module-demos.ts`。它按实际 `BUILTIN_MODULES` 与已安装外置模块生成 68 个独立演示项目，逐条覆盖 contribution/binding 中的 2357 条命令；命令较多时最多使用 12 个 TabControl 页面分组，并通过“允许实际执行”开关避免网络、文件、进程、驱动等调用被误触发。演示源码位于 `examples/module-demos/`，可分享包统一以中文模块名称导出到 `exports/`。新增或删除模块、命令后应运行 `cd electron && npm run module:demos`，并以 `npm run module:demos:verify:deep` 对全部源码包做解压、哈希、模块引用和启动项目校验。

> 2026-07-30 补充：LCPP 源码包对只读原生资产的自动携带范围包含 CEF3、FBro 与密码学 SDK。启用 `lingbuilder.crypto.hash/password/symmetric/asymmetric` 中任一模块时，导出服务必须自动携带 `lingbuilder.crypto.sdk`，与 CEF3/FBro 消费模块使用同一隔离打包逻辑，避免源码包在作者机器可构建、导入后因缺少 Botan/BLAKE3 资产失败。

> 2026-07-30 补充：默认启用的 `lingbuilder.win32.basic` 新增占位符命令 `格式化文本(格式模板, 参数...)`。命令按从左到右顺序以文本、整数、长整数、小数和逻辑值替换 `{}`，`{{` / `}}` 输出字面量花括号；参数不足时保留剩余 `{}`，多余参数忽略。该命令的 contribution、v2 binding、新手/Monaco 补全、普通 Win32 运行时、new_emoji 运行时与后端命令契约必须保持同源，不能只在编辑器中模拟格式化结果。

> 2026-07-30 补充：`lingbuilder.win32.common-controls` 的 ListView 已形成普通模式与 `LVS_OWNERDATA` 虚拟模式的同源命令闭环。普通模式支持添加/插入/删除行、单元格读写、行数、批量 TSV、重绘事务和排序；虚拟模式必须由设计器 `virtualMode` 创建期属性开启，再使用 `列表视图_设置虚拟行数/设置虚拟行` 管理内存数据，并由 `LVN_GETDISPINFOW` 按需显示。`contributes.commands`、`bindings.commands`、控件成员补全和 C++ 运行时必须继续同步，禁止只增加补全或在 React 预览中模拟数据方法。

> 2026-07-30 补充：ListView 公开面现为 85 条高层命令。14 条数据/虚拟命令继续保留在内置模块；新增 71 条 Win32 高级命令必须统一由 `electron/src/services/modules/listViewApiCatalog.ts` 产生 contribution 与 binding，语言服务和 C++ 生成测试按目录全量枚举，不再手工复制多份命令表。原始指针/回调型 `LVM_*` 能力必须通过原生模块提供类型安全包装，不得在 DSL binding 中暴露任意地址或通用 `SendMessage`。

> 2026-07-30 补充：LCPP 源码包清单版本 2 会按实际 `.lcpp` 调用记录生成器能力。使用 71 条 ListView 高级命令的包写入 `win32.listview.advanced-api.v1` 和最低生成器版本；导入时若当前 IDE 不具备该能力，必须在编译前给出明确升级诊断，不得继续生成 C++ 后再暴露 `C3861`。

> 2026-07-30 DataGrid 对齐补充：结构化列模型的 `alignment` 只允许 `left/center/right` 且默认 `center`；设计器、预览、`表格_设置列对齐` binding 和 Win32 C++ 运行时必须消费同一字段，不能只在 React 预览中模拟。

> 2026-07-30 补充：新版 IDE 对 v1 `.lcpppkg` 保留兼容导入路径；旧包缺少能力字段时，必须从包内 `.lcpp` 重新计算所需能力并规范化为 v2 内存清单，不能因为清单旧就误拒绝可迁移的项目。

> 2026-07-28 补充：New_Emoji 92 个设计器控件必须用模块命名空间 `designerType: lingbuilder.new_emoji.ui/<Control>` 判断后端支持能力，不能只看为设计器兼容而使用的 `TabControl`、`ListView`、`TreeView` 等基础类型。模块命名空间控件已由 `runtime.createFunction` / Setter 映射生成真实 `EU_*` 调用时，不得再输出“不会生成”的矛盾诊断。设计器读取模块贡献应使用紧凑的项目设计器上下文，避免加载与画布无关的 1500+ binding 和二进制依赖元数据；模块服务暂时不可用时采用有界重试，不能永久回退到只有 Win32 基础控件。

> 2026-07-28 补充：`lingbuilder.new_emoji.ui/ListBox` 的创建期“简单项目”和可选状态 Setter 必须按原生破坏性语义生成。`EU_CreateListBox` / `EU_SetListBoxItems` 负责静态简单项目；只有 `listBoxItemsEx` 存在非空项目时才调用 `EU_SetListBoxItemsEx`。空 `selectedKeys` 不得覆盖 `selectedIndex`，`virtualItemCount <= 0` 不得调用 `EU_SetListBoxVirtualItemCount`，因为上游这两个 Setter 会分别重置选择和清空普通项目。高级项目用于确实需要 key、父级、分组、描述等 TSV 字段的项目，不能把空默认值作为一次运行时清空操作无条件发出。

> 2026-07-28 补充：`lingbuilder.new_emoji.ui/Tabs` 已按真实分页容器接入。模块清单必须使用 `previewType: TabControl`、`isContainer: true` 和 `layout.mode: slots`；设计器以稳定页面 ID 保存槽位，同时兼容旧项目中 `type: Grid + designerType: .../Tabs + items[]` 的模型。Tabs 属于分页容器，画布渲染必须优先走 `TabControlDesignerPreview` 并读取真实 `tabs/items`、选中页、`headerAlign` 和页面槽位，不能被 New_Emoji 通用控件预览截获后显示写死的示意标签。`headerAlign` 的上游语义是每个统一宽度标签内部的文字对齐，不是整组标签在标签栏中的位置；水平标签宽度应复用原生规则：4 项以内为 `max(72, 可用宽度/数量)`，更多项目为 `max(72, min(152, 可用宽度/数量))`，超出后从左排列并裁切/滚动。模块属性行的“恢复默认”操作不得覆盖下拉框、输入框或文件选择按钮的交互区域；透明状态必须停止鼠标命中。原生生成器固定开启 Tabs 内容区，为每个标签生成与 Tabs 同级、覆盖内容矩形的独立 `Panel` 元素，并把页面内控件挂到对应 Panel，最后通过 `EU_SetTabsPageElements` 绑定切换显隐。页面 Panel 不得作为 Tabs 子元素创建，因为上游 Tabs 自绘不会遍历绘制子元素；页面 Panel 还必须显式使用无边框、0 圆角样式。绑定外部页面时，`ItemsEx` 的内置内容字段必须为空白，避免高 DPI 下页面起点差异露出 Tabs 自绘内容。也不得仅把控件高度交给关闭内容区的 Tabs，否则整个高度会被当成标签头。

> 2026-07-28 补充：Win32 基础模块新增可确定性生成的 `到文本(值)`，覆盖整数、长整数、小数、逻辑值和文本，并由普通 Win32 与 new_emoji 后端共同实现。`lingbuilder.std.encoding` 扩展为 30 条命令，覆盖 UTF-8、UTF-16LE/BE、UTF-32LE/BE、ANSI、GBK、GB2312、GB18030 双向转换、通用编码转换、BOM 处理及保守检测。由于当前 LingCpp 没有公开字节数组类型，编码后的原始字节统一以无空格大写十六进制文本跨越命令边界，禁止把任意字节伪装成 Unicode 文本。

> 2026-07-28 补充：FBro 同时支持内嵌 Alloy Runtime 和谷歌原生 Chrome Runtime。内嵌实例继续遵守“一控件一个宿主 `HWND`”；`FBro_打开谷歌原生UI浏览器` 则通过 C ABI `LB_FBro_CreateChromeUi` 只接收所属浏览器的整数句柄与 URL，不接收 LingBuilder `HWND`。桥接层固定设置空 `parent_window/window`、`WS_EX_APPWINDOW`、`WS_OVERLAPPEDWINDOW` 和 `CEF_RUNTIME_STYLE_CHROME`，让 FBro/CEF 自行创建桌面顶层窗口；这里的无句柄指调用契约不提供宿主句柄，不代表 Chrome 创建后不存在系统 HWND。Chrome UI 实例必须单独跟踪错误/关闭事件，不能覆盖内嵌实例状态，所属窗口销毁时必须统一关闭。

> 2026-07-28 补充：FBro 浏览器创建必须统一投递到 CEF UI 线程。`LB_FBro_CreateEx` 只登记 C ABI 句柄和宿主 `HWND`，CEF 已就绪时使用 `CefPostTask(TID_UI, ...)` 创建；初始化尚未完成时由 `OnContextInitialized` 在同一线程启动待创建实例，禁止根据启动时序随机在 Win32 主线程直接调用 `FBroHsCreate`。每实例 `CefRequestContext` 的 profile 必须是全局 `.fbro-global-cache` 的直接子目录；旧相对路径、嵌套路径和根目录外绝对路径由桥接层稳定映射到隔离子目录，避免 Chromium 拒绝 profile 后静默降级。原生测试必须同时验证窗口响应、页面加载以及日志中不存在 `cache_path`、`root_cache_path`、`Cannot create profile`。`OnBeforePopup` 必须同步取消新窗口，并以 `BeforePopup` 事件把目标 URL 投递给当前控件的 LCPP 处理器，支持单窗口接管导航。

> 2026-07-28 补充：FBro 尺寸同步位于 Win32 主消息循环，不得阻塞等待正在 `FBroHsCreate` 的 CEF UI 线程。桥接层必须使用非阻塞锁并在竞争时跳过本次调整；只移动宿主的直接子 `HWND`，禁止通过 `EnumChildWindows` 递归缩放 Chromium 内部窗口。

> 2026-07-28 补充：包含导航栏的 FBro 示例必须将后退、前进、刷新、地址栏、导航按钮和浏览器宿主作为一个 DPI 自适应布局。所有坐标、尺寸、最小客户区和工具栏高度统一按 `窗口_取事件DPI()` 换算，避免初始缩放坐标与 `WM_SIZE` 的未缩放坐标混用。

> 2026-07-28 补充：Win32 基础模块新增确定性命令 `控件_设置位置大小`，使用客户区像素坐标移动并调整真实控件 `HWND`；FBro/CEF/Edge 浏览器宿主改变后还必须刷新内部浏览器子窗口。new_emoji 后端通过 `EU_SetElementBounds` 提供等价实现，并继续纳入后端命令契约与符号回归测试。

> 2026-07-28 补充：FBro VIP Key 属于 IDE 用户凭据，不属于项目或模块配置。“设置 → 浏览器凭据”通过 Electron `safeStorage` 保存到当前 Windows 用户目录，renderer 只接收配置状态而不接收已保存明文；本地服务收到 Key 后立即从自身全局环境移除，只在启动 FBro 生成程序时构造专用子进程环境。AI Bridge 由主进程在新启动时注入，已运行实例需停止后重启。环境变量仅保留为无人值守和导出工程兼容入口。桥接层会保存并脱敏 FBro SDK 的授权失败信息；正常退出必须执行 `FBroShutdown(FALSE)` 并等待 `OnBeforeClose`，自动测试禁止直接强杀进程。

> 2026-07-27 补充：新增内置 `lingbuilder.fbro.browser` 与只读二进制资产模块 `lingbuilder.fbro.sdk`。启用浏览器模块后，工具箱“媒体”分类显示 `FBro指纹浏览器 (FBroBrowser)`，可像 CEF3 一样拖入任意可视化窗口；每个实例生成独立宿主 `HWND`、profile/cache 目录及事件投递。生成程序只链接预编译 `LingBuilderFbroBridge.dll` 的稳定 C ABI，不跨 DLL 暴露 STL、`CefRefPtr` 或 FBro 对象。该模块只支持 `windows-msvc-x64`，并通过 manifest `compatibility.conflicts` 与 `lingbuilder.cef3.browser` 双向互斥；生成前还会拒绝其它 `libcef.dll`。F5、原生构建、AI Bridge 和 Visual Studio 导出复用 `nativeDependencyService.ts` 的同一 SHA-256 物化链路，首次复制 CEF 135.0.21 的 78 项运行时，后续只修复缺失或损坏项并保留 `locales/` 等相对目录。

> 2026-07-27 补充：原生 UI 模块的后端命令能力统一通过 `electron/src/services/windowDesigner/uiBackendCommandContract.ts` 中的 `NativeUiBackendCommandContract` 注册。契约按模块 v2 `bindings.commands` 判断支持范围；普通 Win32 与 new_emoji 是首批实现，后续 Qt、wxWidgets 或其它 UI 库必须注册独立后端 ID 和命令契约，并补齐原生布局生成器后才能开放构建。后端不兼容命令、未知契约和缺失布局生成器必须在生成 C++ 前阻断，禁止静默回退为 Win32 或等到编译器报告未定义标识符。后端无关模块运行时可复用；依赖 `LingWindowBase`、专属 HWND/消息上下文的模块必须显式标为不支持或提供该后端适配层。

> 2026-07-27 补充：new_emoji 设计器生成程序必须在控件创建和窗口“创建完毕”处理器执行完成后、进入 `NE_运行消息循环` 前调用 `NE_显示并激活窗口`。该桥接负责恢复、刷新、临时提升层级后立即取消置顶，并请求前台、激活与焦点；受 Windows 前台锁限制时临时用 `AttachThreadInput` 连接当前线程与原前台线程，完成后必须立即分离。该流程解决 IDE/F5 后台启动时只有任务栏按钮而窗口被压在 IDE 后方的问题；不得通过修改用户 `.lcpp` 或让窗口永久置顶规避。

> 2026-07-27 补充：`contributes.designerControls[].events[]` 与 `runtime.eventBindings[]` 可用 `aliases` 声明历史或预览事件键。生成器必须先匹配规范 `eventName`，再按别名兼容旧项目；设计器新建绑定仍保存规范事件名。new_emoji 使用该机制兼容通用按钮的 `Click` 与原生目录的 `Clicked`，不得因键名差异静默省略回调注册。

> 2026-07-27 补充：`contributes.designerControls[].runtime` 支持结构化 `createParameters`、`propertySetters`、`propertyCommands` 与 `eventBindings`。new_emoji 生成器必须从上游设计器目录和导出签名生成这些映射，属性面板只公开存在确定性运行时落地的项；组合 Setter 参数可声明固定 `literal`，共享鼠标/焦点回调可用 `eventCode` 聚合到一个原生回调，禁止同一 Setter 被后注册的事件静默覆盖。

> 2026-07-27 补充：外部模块同时声明 `windows-msvc-win32` 与 `windows-msvc-x64` 时，生成到 `main.cpp` 的 `#pragma comment(lib, ...)` 必须使用 `_WIN64` 条件分支选择对应 target；Visual Studio 工程和原生依赖物化仍按当前构建架构精确选择。禁止 x64 工程因默认 `targets[0]` 再引用 Win32 `.lib`，双架构模块生成测试必须覆盖两个库路径。

> 2026-07-24 补充：内置 `lingbuilder.win32.common-controls` 已注册 `VideoPlayer` /“视频播放器”控件。该控件的 Media Foundation 依赖声明为 `mfplat.lib`、`mfplay.lib`、`mfuuid.lib`，中文播放命令同时存在于 `contributes.commands` 与 `bindings.commands`；设计器、语言服务和 C++ 生成器必须继续从同一模块清单消费这些定义。

> 2026-07-25 补充：新增内置 `lingbuilder.cef3.browser`（CEF3浏览器模块），按 v2 `contributes.designerControls` 注册 `CefBrowser` /“CEF3浏览器”可视控件（`nativeAdapter: cef3-browser`，依赖 `libcef.lib`、`libcef_dll_wrapper.lib`）。控件支持多实例、属性面板 `url`/`cacheDir`/`userAgent`/JavaScript/图片/WebGL/代理配置；当前 21 条 `CEF3_*` 中文命令同时存在于 `contributes.commands` 与 `bindings.commands`。CEF3 SDK 由 `nativeDependencyService.ts` 受控发现复制；CEF3 为单进程框架，同 exe 全部控件共享缓存，需要会话隔离时使用 `lingbuilder.edgeview`。

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
- 窗口事件处理器保持无参数；模块 binding 返回的文本指针指向窗口对象持有的事件快照，只能读取，不能在模块侧长期缓存。
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

- `electron/scripts/generate-new-emoji-module.cjs` 可从 `T:\github\new_emoji` 或 `NEW_EMOJI_ROOT` 指向的源码目录生成 `lingbuilder.new_emoji.ui` 模块。
- 生成命令：`cd electron && npm run module:new-emoji -- --install`。该命令会生成 `.lingbuilder/module-packages/new_emoji.lbmod`，并安装到 `.lingbuilder/modules/lingbuilder.new_emoji.ui`。
- 模块包复制 Win32/x64 的 `new_emoji.dll` 和 `new_emoji.lib`，但当前 F5 预览默认使用 Win32 产物。
- `new_emoji.lib` 是 MSVC 导入库；如果只检测到 g++/clang++，F5 会返回“new_emoji 模块需要 MSVC/Visual Studio Build Tools”的中文诊断。
- `.lcpp` 用户优先使用 `NE_创建窗口`、`NE_创建按钮`、`NE_创建文本` 等桥接命令；自动生成的 `NE_EU_*` 命令属于底层高级入口，参数仍按 new_emoji 的 UTF-8 字节指针和长度规则处理。
- `NE_` 桥接层把 `wchar_t*` 转 UTF-8 时必须为 `WideCharToMultiByte` 的结尾 `\0` 预留空间，再传递不含结尾 `\0` 的字节长度；传给 new_emoji 控件的 UTF-8 字符串还必须存入桥接层持久池，不能把函数内临时缓冲区指针交给 DLL，否则 VS Debug CRT 可能读到 `0xDDDDDDDD` 已释放内存并触发访问冲突。
- new_emoji 独立演示或 AI 自动生成示例必须保留事件块末尾的结构标记 `结束`，但不能额外调用显式退出命令 `结束()`；后者会销毁 LingBuilder 默认窗口，消息循环收到退出后表现为 exe 闪退。
- 纯 new_emoji 示例应由 new_emoji 自己负责生命周期：创建窗口和控件后调用 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。如果继续复用 LingBuilder 默认 Win32 生成窗口，必须保证默认窗口不会立即销毁，也不能让空设计器窗口关闭后触发 `PostQuitMessage(0)`。
- 报告 new_emoji exe 可运行前，必须确认 `new_emoji.dll` 已复制到 exe 同目录，并实际启动验证至少 3 秒仍在运行。
- 项目启用 `lingbuilder.new_emoji.ui` 后，设计器和原生生成器会把基础 `Button`、`TextBox`、`Label`、`CheckBox`、`RadioButton`、`ListBox`、`Image`、`ProgressBar` 模型映射为 new_emoji 控件；旧项目中的 `Grid` 模型仍可兼容映射为 new_emoji 容器，但不再提供新增入口。普通 Win32 工具箱已移除固定外观的 `Upload` / `DragUpload`，改由 `lingbuilder.win32.common-controls` 贡献非可视 `FileDialog`，绑定现有按钮和窗口/控件拖放目标。旧上传控件与 new_emoji `NE_` 上传桥接仅作已有项目兼容，不再作为新增设计器控件入口。
- new_emoji 后端不支持的控件必须在工具箱显示禁用原因，并在生成结果中产生中文诊断；不得为了“看起来可用”而回退生成 Win32 控件。上传事件已接入 callback API；继续新增其它控件事件时仍必须同时补设计器事件、桥接回调生命周期和生成器分发测试。

## WebSocket 客户端内置网络模块

- `lingbuilder.websocket.client` 是内置 v2 网络模块，项目启用后提供 `WS_连接`、`WS_发送文本`、`WS_接收到调试输出`、`WS_接收文本` 和 `WS_关闭`。
- 该模块的补全、诊断和生成器 binding 均来自 `electron/src/services/modules/builtinModules.ts`，不要在 Monaco 或 React 组件里另写一份命令清单。
- Win32 C++ 生成器在 `LingWindowBase` 内置基于 WinHTTP 的单连接 WebSocket 运行时，并链接 `winhttp.lib`；当前稳定目标仍是 Windows/MSVC。
- AI 或示例代码使用该模块时，应先确认项目已启用模块；地址使用 `ws://` 或 `wss://`，运行时会规范化为 WinHTTP 握手使用的 HTTP/HTTPS URL。

## HTTP / WebSocket 服务端内置网络模块

- `lingbuilder.http.server` 和 `lingbuilder.websocket.server` 是内置 v2 网络服务端模块，项目启用后分别提供本地 HTTP 服务端和 WebSocket 服务端能力。
- HTTP 服务端命令包括 `HTTP_启动服务`、`HTTP_等待请求`、`HTTP_等待请求到调试输出`、`HTTP_回复文本` 和 `HTTP_关闭服务`。
- WebSocket 服务端命令包括 `WSS_启动服务`、`WSS_等待连接`、`WSS_接收文本`、`WSS_接收到调试输出`、`WSS_发送文本` 和 `WSS_关闭服务`。
- 两个服务端模块当前都是 Windows/MSVC 原型闭环，Win32 C++ 生成器在 `LingWindowBase` 内置基于 Winsock 的单连接同步服务端运行时；HTTP 链接 `ws2_32.lib`，WebSocket 服务端链接 `ws2_32.lib` 和 `advapi32.lib`。
- 服务端监听默认绑定 `127.0.0.1`，适合作为本地调试、AI 示例和模块能力验证入口；后续如开放局域网监听、路由、多客户端或异步事件循环，必须先抽象受控服务层和清晰的权限提示。

## EdgeView 设计器控件（2026-07）

- `lingbuilder.edgeview` 通过 v2 `contributes.designerControls` 贡献 `EdgeBrowser`，注册表、模块清单、设计器工具箱和生成器使用同一份控件定义。
- 每个设计器控件生成独立 STATIC 宿主和 WebView2 Controller；`parentId` 由通用 Win32 控件层级解析为窗口、容器或选项卡页面 HWND，不在 React 中模拟浏览器运行。
- 控件内部实例编号使用稳定生成 control ID，用户代码优先通过中文控件名调用 EdgeView 控件命令；旧数字实例和区域 API 保持兼容。空缓存目录必须确定性生成独立 `.edgeview/<controlId>`，避免多控件默认共享会话目录。
- WebView2 SDK/Loader 仍由 `nativeDependencyService` 受控发现和复制；设计器只保存模型，不直接读取 NuGet 或启动原生浏览器。
- EdgeView 事件目录集中维护在 `electron/src/services/modules/edgeViewBrowserEvents.ts`，以稳定 SDK `Microsoft.Web.WebView2 1.0.3537.50` 的 64 个 `add_*` 入口为审计依据。窗口化 HWND 控件接入其中可达的 62 项；`CompositionController` 独占的 `CursorChanged` / `NonClientRegionChanged` 明确不适用。注册表、模块补全、设计器事件面板、中文事件映射和生成器覆盖测试必须消费同一目录，新增 SDK 版本时不得只补 UI 或只补 C++。
- 事件运行时通过 `QueryInterface` 逐级启用 WebView2 版本接口，并级联保存 Download、Frame、Notification、Find、Profile、DevTools receiver 等事件源。事件数据统一为 UTF-16 JSON；等待事件按事件名计数，避免高频资源/下载事件覆盖最近值后造成漏判。

## 分类内置模块库（2026-07）

- 参考精易模块的程序、窗口句柄、键盘鼠标、进程线程、配置、图片、网页、文本字节、文件目录、系统、杂类和组件分类，新增 51 个内置 v2 模块、287 条中文命令。
- 当前 `BUILTIN_MODULES` 合计 63 个模块、746 条命令；正式清单位于根目录 `MODULE_ENCAPSULATION_CHECKLIST.md`。
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
- 模块市场远程下载、签名校验和回滚可以继续增强，但必须复用 preview/install 流程。

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

- `new_emoji` 的唯一设计器来源为上游 `docs/ai/lingbuilder_designer_catalog.json`。模块生成脚本强制校验 92 个组件、1566 个导出、精确参数和目录 SHA-256；目录与 `.def` / `exports.h` 漂移时直接失败。
- 模块控件使用 `lingbuilder.new_emoji.ui/<Control>` 命名空间 ID，窗口通过 `designerBackend: win32 | new-emoji` 固定后端；非空窗口禁止切换，项目内可同时保存两类窗口。
- 设计器重新挂载必须以磁盘加载完成的项目模型为准，不得用全局 localStorage 覆盖模块控件。自动保存缓存按 `projectId` 隔离；旧窗口只要包含 `lingbuilder.new_emoji.ui/*` 命名空间控件，规范化时就补齐并在下次保存持久化 `designerBackend: new-emoji`。
- 属性与事件面板消费模块目录，支持搜索、分组、基础/高级切换、默认值恢复和事件处理器模板。底层 `NE_EU_*` 默认为 advanced，不进入普通补全；用户显式开启“显示底层高级 API”后才显示。
- `runtimeCommand` 是属性或事件可编辑的硬门槛。当前 new_emoji 目录的 703 个专属属性中，219 个由 `EU_Create*` 创建签名直接消费；其余 484 个属性保持只读诊断。目录中的 74 个事件尚未取得通用 callback 映射，不能在事件页生成假绑定；旧 Upload/DragUpload 的历史回调继续按兼容链路工作。
- new_emoji 设计画布必须使用上游原生主题令牌预览，不得再用 React 专属渐变或阴影伪装运行效果。深色主题的核心默认值为窗口 `#1E1E2E`、标题栏 `#181825`、按钮 `#45475A`、编辑框 `#313244`、边框 `#585B70`；浅色主题使用对应上游令牌。点阵只属于设计辅助，不进入原生运行时。
- 92 个命名空间控件的设计时形态由独立 `NewEmojiDesignerControlPreview` 负责，并以 `designerType` 末段选择预览；不能再只按兼容 `previewType` 渲染为普通文字或空容器。弹窗、抽屉、图表、浮层等内部遮罩和阴影必须裁切在控件边界内，禁止污染相邻控件；预览组件继续消费 `NewEmojiThemePreview`，不得另建与原生主题无关的基础按钮/编辑框配色。
- new_emoji 控件创建完成后，生成器默认调用安全桥接 `NE_设置元素焦点` 聚焦首个可见且启用的 Input/EditBox，保证启动即可键盘输入并显示光标；该调用位于窗口“创建完毕”处理器之前，因此用户事件代码仍可设置其它焦点。隐藏或禁用输入框不能获得默认焦点。
- new_emoji 窗口的默认 `lingbuilder` 图标来自根目录 `image/lingbuilder-ide-icon-v2.ico`。模块生成脚本将其打包为 `assets/lingbuilder-newemoji-window.ico`，Win32/x64 target 都声明为运行时文件，F5 和 VS 工程构建后复制到 exe 同目录并由生成代码加载；`system`、`custom`、`none` 三种显式设置优先于默认图标。
- 完整封装仍需把上游 `EmojiCodeGenerator` / `exports.h` 中的 setter、callback 和事件上下文关系导出为正式目录映射，并完成混合后端多窗口生成；在此之前不得把“目录已收录”写成“运行时已支持”。
- 收费状态不来自 manifest。云端以 `moduleId` 管理商品、报价、订单、权益和限免；本地只接受 Ed25519 签名的短期 Permit。模块安装、启用、设计器编辑、构建、预览、导出和 AI Bridge 均必须经过同一授权守卫。
- 已购买 Permit 最长离线 72 小时；限免 Permit 不得越过活动结束时间。退出账号只撤销使用能力，不删除项目引用、控件或属性数据。

## 菜单和容器布局贡献

v2 manifest 可在 `contributes.menus[]` 和 `contributes.submenus[]` 中向稳定 `MenuId` 贡献声明式菜单。每个菜单项必须且只能声明 `command` 或 `submenu`，可附带 `when`、`group`、`order` 和最多 32KB 的 JSON `arguments`。模块菜单只能调用 IDE 已注册的受控命令，不能执行 renderer 脚本。

容器型 `contributes.designerControls[]` 可声明 `layout`，其 `mode` 为 `absolute | flow | stack | grid | dock | slots | single | custom`，并可声明坐标空间、方向、插槽、容量和子控件类型限制。旧 `isContainer: true` 控件缺少 `layout` 时临时按窗口绝对坐标兼容并输出迁移诊断；新容器必须显式声明布局，否则不得作为可跨容器粘贴的正式控件发布。
> 2026-07-28 补充：FBro SDK 查找必须从任意深度的 `.lingbuilder-build/<project>/<arch>/<mode>` 向上定位工作区，不能用固定两级父目录推导。缺少 SDK、桥接文件、清单或运行时校验失败属于 `blockingDiagnostics`，F5、原生构建和 AI Bridge 必须在编译前停止，禁止依靠 `__has_include` 编译空白占位浏览器后仍报告成功。F5 中间 VS 工程从已校验的 `bin` 增量物化运行时；`generated/cpp` 可复制工程必须携带 78 项完整 runtime、清单和脚本。生成的 C++ 必须用 `L"\\\\/"` 同时识别 Windows 反斜杠和正斜杠，否则缓存根目录会被错误拼到 exe 文件名之后并导致 CEF 子进程失败。

## DataGrid v1 实现约束（2026-07-30）

- 内置模块 `lingbuilder.win32.common-controls` 注册 `DataGrid`；每个实例创建独立 `LingBuilderDataGrid` 主 HWND，即使设计器初始状态为隐藏也不省略创建。
- 单元格采用双缓冲、可见区域绘制。选择框、Switch、图片、进度和按钮不创建逐单元格 HWND；仅编辑文本/数字、组合框、日期时创建临时 EDIT、COMBOBOX、DateTimePicker 子 HWND。
- Switch 与进度由 DataGrid 主 HWND 使用 GDI+ 抗锯齿圆角绘制并保持设计器同系配色；组合框静态绘制中文标签和箭头，单击后展开深色自绘的真实临时 COMBOBOX，未悬停项也必须使用可读前景色，选择提交时同时发送编辑提交和组合框改变事件。
- 图片运行时路径相对 EXE 目录解析，F5/导出必须通过 `DesignerAssetService` 保持 `assets/<项目ID>/` 结构复制资源；原生测试禁止额外手工复制图片来掩盖资源物化缺失。
- 图片列和单元格覆盖共用 `tile/contain/cover/center/stretch` 显示方式，原生路径图片与 ImageList 都必须真正执行平铺、等比缩放、铺满裁剪、原始居中或拉伸，不能只保存属性后仍统一 StretchBlt。
- `dataGridSchemaVersion` 当前为 1。列、行和单元格覆盖先经过 `dataGridModel.ts` 规范化，再由设计器预览和 Win32 生成器共同消费。
- `dataGridApiCatalog.ts` 是 contribution、binding、Monaco 补全和真实 C++ 符号的一致性来源。新增命令必须同时实现运行时行为和测试，不能只增加补全。
- DataGrid 当前共有 92 条目录命令；进度状态和行选择状态均有成对读写接口。`.xlsx` 导入/导出通过标准 SpreadsheetML 与 Windows ZIP Shell 实现，不启动或依赖 Excel；只处理首个工作表、仅允许静态模式，并把图片单元格作为路径文本往返。
- Win32 支持本地排序筛选及虚拟缓存；虚拟模式只更新状态并异步触发 `VirtualDataRequested`，不得在绘制回调中调用数据提供者。
- 旧 new_emoji Table 不自动转成 Win32 DataGrid；迁移服务只添加统一结构化编辑字段，保留原模块类型、后端和生成适配器。new_emoji 不声明支持 Win32 `表格_` 命令。
