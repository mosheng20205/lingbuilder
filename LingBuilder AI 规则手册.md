# LingBuilder AI 规则手册

> 2026-08-09：`lingbuilder.fbro.browser@2.4.0` 的普通 Win32 多实例管理器已接通真实下载事件。AI 生成 `win32-fbro-multi-browser-manager` 时必须调用 `浏览器管理器_绑定下载视图(详情控件, 进度条)`，其中详情控件只能是裸 `TextBox/Label controlRef(nativeHandle)`，进度控件只能是裸 `ProgressBar controlRef(nativeHandle)`；界面必须显示当前实例的下载状态、百分比、已接收/总字节、文件名和完整目录，并提供 `浏览器管理器_打开当前下载目录()`。每个稳定实例单独保存下载 ID 与进度，切换实例时同步对应视图；未订阅 v3 高级事件时 `OnBeforeDownload` 必须继续默认下载，`OnDownloadUpdated` 只能观察，不能擅自暂停或取消。

> 2026-08-08：AI 生成或修改普通 Win32 `win32-fbro-multi-browser-manager` 时，目标程序的窗口和全部可视控件只能使用 `lingbuilder.win32.basic` 与 `lingbuilder.win32.common-controls`。浏览器承载必须是隐藏表头的 Win32 TabControl 页面，每个稳定实例分别拥有页面 HWND、FBro Host PID、浏览器 HWND 和 Profile；左侧 ListBox 是唯一切换入口。不得加入或建议任何 `new_emoji`、Qt、Duilib、wxWidgets、WebView UI、React/HTML renderer 界面依赖，也不得预放固定 `FBroBrowser` 控件或让实例共享页面、Host 或 Profile。

> 豆包视频下载器浏览器插件是项目私有资源，不是 LingBuilder 模块。必须从 `assets/<项目ID>/doubao-downloader/` 随项目分发，禁止写入 `.lingbuilder/modules`、项目模块引用、`.lbmod` 或 AI 生成的模块清单。每个独立 Host 的 CEF 命令行初始化只启用 Chrome Runtime；启用 FBro VIP 高级扩展能力后，必须先创建独立 RequestContext，立即调用 FBro VIP `LoadExtension`，最后创建浏览器，保持与 FBro C# 独立浏览器示例相同的顺序。VIP 授权只能在受控运行时内使用并在使用后清零；授权码不得写入源码、命令行、项目配置、`.lcppkg`、日志或 AI 上下文。扩展 ID 与 `GetExtensionPath` 回读只能证明注册，当前页面还必须用受控 DOM 探针确认扩展注入；不得把“已注册”或“路径匹配”显示为“插件已生效”。FBro Alloy 嵌入模式没有 Chromium 原生 `chrome://extensions/` 页面：该地址必须在当前实例显示受管插件诊断页，同时保持地址栏的逻辑地址。新窗口请求必须在 `OnBeforePopup` 中用当前 Frame 加载目标 URL 并取消 popup，不能创建新的 Host、窗口或 Profile。地址改变或当前实例切换必须同步原生地址栏 HWND。`浏览器管理器_导航` 不得限制为 HTTP(S)，应把 `chrome://`、`about:`、`file://`、`view-source:` 等非空 Chromium 地址原样传给 Host；仅 `chrome://extensions/` 使用受管诊断映射，其他地址仅拒绝空值和换行控制字符。大小和 DPI 事件必须先运行 LCPP 布局、再调整 FBro 子窗口。
扩展注册后若当前 URL 匹配豆包页面，最多执行一次受控刷新以覆盖首屏竞态，随后按有限次数 DOM 探针验证；AI 不得生成无限 reload 或把刷新次数当作插件生效证据。

> 最终分享包固定为 `exports/独立浏览器管理器.lcpppkg`，使用现有 `LcppSourcePackageService` 导出、复制后重新检查并导入，再从导入项目二次生成 C++。清单只允许两个 Win32 UI 模块和 FBro 非界面运行时；插件只作为项目 `assets` 文件分发，不得出现在模块清单或模块包中。必须排除 `new_emoji`、Cookie、Profile、缓存、localStorage、IndexedDB、插件私有存储、凭据、授权码、构建缓存和开发机绝对路径。大型 SDK 临时目录在 Windows 清理时可以有界重试 `EBUSY`，但不得因此忽略包校验或导入失败。

> 2026-08-08：AI 生成或修改 `new-emoji-fbro-multi-browser-manager` 时，必须保留 `electron/src/services/browserWorkbench/` 的实例、持久化、Cookie、扩展、命令和菜单边界。新增、删除、重命名、切换、Cookie 导入导出和分享包导出必须注册到 CommandService；实例右键菜单必须由 MenuService 贡献生成。原生 `.lcpp` 入口只能调用同一稳定 ID 语义的 `浏览器外壳_*` 命令，禁止在 React、菜单 JSX、索引分支或临时文件操作中复制业务逻辑。

> 每个实例必须使用独立 Host、RequestContext、伴随 HWND、浏览器 HWND 和 `%LocalAppData%` Profile。持久化只保存稳定 ID、名称、顺序、`profiles/<稳定ID>` 相对结构、最后地址、创建时间、恢复状态和插件状态，使用临时文件、`.bak` 与原子替换；分享包不得包含 Cookie、Profile、缓存、localStorage、IndexedDB、插件私有存储、凭据或开发机绝对路径。插件从 exe 同级 `assets` 下的项目资源加载，必须在创建浏览器前加载到每个 RequestContext；只有 `phase: "extension"` 的 VIP lifecycle 可以改变插件状态。

> Cookie 导入导出必须访问选中 FBro Host 的真实 CookieManager，结构保留 `name/value/domain/path/expires/httpOnly/secure/sameSite/priority/session`。导入前必须统计有效、无效、过期、冲突和域名，默认跳过无效与过期并明确处理冲突；日志和 AI 上下文禁止包含 Cookie value 或完整导出文件。清除数据和删除 Profile 必须二次确认并验证目标位于当前工作台受管 `profiles` 根目录。

> 2026-08-08：`new-emoji-fbro-richlist` 是 `new-emoji-fbro-listbox` 之外的独立 RichList 动态会话示例。AI 创建或修改此类项目时，必须使用 `lingbuilder.new_emoji.fbro-shell@1.2.0` 的 `浏览器外壳_新建独立实例`，并为每个新会话生成不依赖 RichList 索引的稳定 ID 和唯一 Profile。RichList 只保存/传递稳定 `itemKey`；排序仅调整 stable ID 显示顺序。禁止在设计器预放固定数量 `FBroBrowser` 控件，禁止多个稳定 ID 共享 Host、HWND、缓存或 Cookie。

> 2026-08-08：RichList 浏览器会话的关闭、重开、删除、选择和 Cookie 操作必须调用 fbro-shell 的稳定 ID 命令。选择只能隐藏当前宿主并显示目标宿主，不能销毁其它已打开会话；关闭只释放该会话的 Host/HWND，重开复用原稳定 ID 与 Profile，删除先关闭再移除绑定并默认保留缓存。Cookie 必须通过 `浏览器外壳_打开Cookie对话框` 或 `浏览器外壳_设置实例Cookie` 使用 FBro Cookie API；成功必须等待 `SetCookie`/`FlushStore` 完成并在目标会话读回，禁止网页脚本注入和任何 Cookie 明文日志。所有控件参数继续使用裸标识符，所有回调处理器继续使用 `&处理器名`。

> 2026-08-08：`lingbuilder.new_emoji.fbro-shell@1.2.0` 支持无固定软件数量上限的动态独立实例。AI 生成多浏览器管理器时不得预创建 6 个或其它固定数量的 `FBroBrowser` 控件，不得用增大常量冒充移除上限；应使用 `浏览器外壳_新建独立实例` 为每个稳定 ID 创建独立 Host/WebSocket/Profile/HWND，用 `浏览器外壳_绑定实例列表` 和 `浏览器外壳_选择列表键` 同步 RichList 与隐藏表头的 Tabs。实际资源耗尽必须报告中文失败，不得共享 Profile 或静默复用进程。

> 2026-08-07 CEF3 状态：固定基线仍为 `150.0.14 / Chromium 150.0.7871.129 / Windows MSVC x64`，开发版本仍为 `3.0.0-alpha.3`；当前为 540 implemented、8 internal、185 notApplicable、844 planned，公开接口完成 `540 / 1384（39.02%）`。AI 只能生成已进入 contribution、binding、Bridge、测试和文档闭环的接口；`planned` 能力仍不可调用。`CEF3传输_从文件创建读取流`、`CEF3传输_从文件创建写入流`、`CEF3传输_从缓冲创建读取处理器` 和 `CEF3传输_创建写入处理器` 只能使用受管句柄：文件路径必须在项目允许根目录内，写入必须传受管缓冲、起始偏移和字节数，内存写入上限为 64 MiB；禁止生成绕过路径或内存校验的调用。

> 0.2.9 版本约束：生成或修改使用 `lingbuilder.wxhook.manager@1.1.1` 的项目时，最低 LingBuilder 版本必须为 `0.2.9`。该模块的四个界面参数必须保持裸 `controlRef(nativeHandle)`，不得改写为字符串控件名；第四个参数是顶部切换样式 Button，总开关默认开启防撤回和撤回灰条提示，并必须绑定 `Click` 事件，在事件中调用 `微信多开_设置总防撤回(控件_取勾选(防撤回总开关))`；导出源码包时必须携带模块及 Host/Agent/SQLite 运行时。

> 版本约束：生成或修改使用 HTTP 客户端 2.0、WebSocket 客户端 2.0 或 WebSocket 服务端 2.0 的项目时，最低 LingBuilder 版本必须为 `0.2.8`。不要把 EdgeView、ListView 或 OpenCV 既有项目的最低版本从 `0.2.7` 无差别提升。

## Windows EXE 图标资源规则

- 窗口使用 `lingbuilder` 默认图标或项目自定义 ICO 时，原生生成必须同时输出 `lingbuilder-app.rc`，并把当前入口窗口图标物化到可移植的 `resources/lingbuilder-app.ico`；只调用 `WM_SETICON` 不能满足文件资源管理器、快捷方式和安装器读取 EXE 图标的要求。
- F5、受控 CLI、AI Bridge 和 Visual Studio 导出必须编译并链接同一份 `.rc`，最终 PE 必须包含 `ICON` 与 `GROUP_ICON`。资源编译器缺失、ICO 不存在或 ICO 目录结构损坏时必须用中文阻断构建，禁止静默生成通用空白图标。
- 自定义图标只能来自当前项目 `assets/` 内的相对 `.ico` 路径。生成资源使用固定 ASCII 路径承载实际字节，避免中文文件名和不同构建目录破坏 `rc.exe`；图标内容摘要必须进入增量构建指纹。
- `system` 保持 Windows 通用程序图标，`none` 不嵌入项目图标；这两种显式选择不得被默认 LingBuilder 图标覆盖。多窗口项目当前以本次原生生成的入口窗口作为 EXE 图标来源。

## 动态库（DLL）输出与模块调用规则

- 第三方或自制的 C++ DLL 接入 LingBuilder 的正式路径是封装成 v2 模块（`.lbmod`）：`bindings.commands[].runtimeName` 指向 DLL 导出函数（薄封装直连）或桥接函数（需参数/句柄适配时），`targets[]` 必须按架构各自声明真实 `headers`/`libs`/`runtimeFiles`（`lib/{Win32,x64}`、`bin/{Win32,x64}`），构建期自动复制 DLL 到 exe 同目录。跨 DLL 边界只允许 POD 与文本签名（空/整数型/长整数型/小数型/单精度小数型/逻辑型/字节型/文本型）；**文本参数必须是 `const wchar_t*`、文本返回必须返回 `const wchar_t*`（DLL 侧稳定存储，调用方在下次调用前取走）——`std::wstring` 按值或引用跨界，在 Debug(/MDd) 调用方 + Release(/MD) DLL 组合下会被按错误布局读取（实测 13 字符串返回 2）甚至跨 CRT 堆释放（0xC0000374 堆损坏）；生成器对 wideString 实参发 `LingCppWideArg(...)`=c_str() 或 `L"..."` 字面量，与该 ABI 天然匹配**；DLL 输出强制 /MD 动态 CRT。操作步骤见 `docs/DLL封装成模块操作手册.md`。
- 中文项目可以把「公开」子程序导出为 DLL：解决方案项目 `buildProperties.outputType: "dll"`（缺省 `exe`）。导出口径是确定性的——仅「公开」节的子程序（方法）导出，事件处理器、构造/析构、私有/保护成员一律不导出；AI 不得生成「全导出」或「按名称挑选导出」的错误描述。DLL 模式不生成 `wWinMain` 与消息循环，生成 `DllMain` + 首次导出调用时的惰性运行时初始化，动态库定位为纯逻辑库（不自动创建设计器窗口）；调用约定 `__cdecl`、`extern "C"`。
- AI Bridge 构建（CLI `project build`、MCP `build.run`、`nativePreview`）与 IDE 内「生成解决方案 / 生成项目」（server.ts `runControlledWindowDesignerBuild`）都读取并尊重 `outputType`；**F5「生成并运行」对 DLL 项目自动禁用**（工具栏按钮/命令 enabled 上下文 `project.dllOutput`，服务端 build-run 路由对 DLL + run 返回 run-unsupported 中文引导）。DLL 产物为 `<产物名>.dll` + 同名导入库 `.lib`，任何 run 请求对 DLL 产物都不启动进程。
- 导出签名违规（控件/数组/记录/未知类型）必须给中文阻断诊断，禁止静默跳过或降级生成；new_emoji 后端窗口不能请求 DLL 输出。
- 项目级 DLL 命令声明语法（`src/项目DLL命令.lcpp`，与 项目全局变量.lcpp 同构的专用声明文件）：

  ```
  DLL命令库 AdvancedMathDll
    Win32 = "dll/Win32/AdvancedMathDll.dll"
    x64 = "dll/x64/AdvancedMathDll.dll"
    整数型 加法计算(整数型 被加数 // 第一个加数, 整数型 加数)
    备注: 调用 DLL 计算两个整数之和。
    空 内部填充(整数型 输出值 传址)
    公开 = 假
  结束DLL命令库
  ```

  命令名即 DLL 导出函数名（extern "C"），`= 导出名` 指定不同导出名（缺省与命令名一致）；类型仅限 空/整数型/长整数型/小数型/单精度小数型/逻辑型/字节型/文本型（文本参数 const wchar_t*、文本返回经 DLL 侧缓冲）；缺架构 DLL 或导出名不存在时构建阻断。命令下一行 `备注: 文本` 是命令备注（进补全描述）；参数段内 `// 文本` 是参数备注（进补全参数说明），写在 `传址` 之后（如 `整数型 输出值 传址 // 回填结果`）；命令下一行 `公开 = 假` 把命令标记为非公开（缺省公开，序列化只在非公开时输出该标记）。AI 生成或修改该文件时必须保持命令名与导出函数完全一致，不得引入模块生态概念（无需 manifest/bindings/pack）。
- **DLL命令库 声明必须写在独立的 `src/项目DLL命令.lcpp`，不得写进窗口/控制台程序的主源码文件**：生成器聚合源码时会把含 `DLL命令库` 的源文件的类整体排除（声明文件专用语义），主源文件里内嵌声明会导致该文件全部事件处理器降级为「未找到中文 C++ 事件实现」的空壳（可编译可运行但点击无效果，仅留一条「未定义设计器窗口类」提示）。遇到「事件处理器是空壳 stub」的构建产物时先检查主源文件是否内嵌了 DLL命令库。
- 结构化编辑器（项目 DLL 命令声明卡片编辑器）支持「复制全部声明」（整文件/整库片段，含 `DLL命令库` 包裹与架构路径）、「复制此命令」（只输出该命令自身的声明行，连带 `备注:` 与 `公开 = 假`，不带库信息）与「粘贴声明」（两种格式都能识别：整库片段按库名合并，裸命令声明行并入当前库；均按命令名去重，重名跳过并在反馈区提示）。跨项目迁移单条命令用「复制此命令」，迁移整个库用「复制全部声明」，不要手工重抄。
- **命令名不得为空**：空名声明序列化出来是解析器不认的死行（如 `整数型 ()`），写回文件时整条命令会被静默丢弃，表现为「加了不存在、删了又回来」。编辑器入口已收紧：「添加命令」自动生成全文件不冲突的占位名 `新命令N`；清空「Dll命令名」会被拒绝并在反馈区提示改用「删除此命令」；序列化端跳过无名字命令作为兜底。手写源码里的空名声明行由解析器报「无法识别的 DLL 命令声明行」。AI 生成或修改该文件时同样不得产出没有命令名的声明行。
- **英文导出名自动登记为补全别名**：`整数型 提示音(整数型 类型) = MessageBeep` 合成项目虚拟模块时，`MessageBeep` 会作为 `提示音` 的 `aliases` 进入补全与诊断（非中文别名按补全目录规则只作检索键、不单独成条）——敲英文能筛出中文命令，上屏仍是中文主名，生成 C++ 恒为真实导出名。别名与模块内其它命令名或其它别名冲突时不登记，命令名本身优先。
- **结构体参数（2026-09-18 已落地）**：在 `DLL命令库` 内可用结构体块声明结构体，命令参数直接写结构体类型（按指针传给 DLL）。字段类型仅支持 整数型/长整数型/小数型/单精度小数型/逻辑型/字节型/指针整数（= uintptr_t，随位数，承接 SDK 的 ULONG_PTR/HANDLE 尺寸字段）/文本型[定长]（定长宽字符数组，必须给长度）。两种写法：
  1. 定义写法（自有 DLL）：`结构体 名称` + 字段列表 + `结束结构体`，生成器按字段生成同名 C 结构体定义；
  2. 别名写法（系统 DLL 必须用）：`结构体 名称 = 真实SDK类型名`（例如 `结构体 进程信息 = PROCESSENTRY32W`），不生成定义、直接使用 SDK 真实类型；需配合 `头文件 = tlhelp32.h` 一类的「头文件 =」行引入 SDK 头文件。系统 DLL 命令的结构体参数必须用别名写法（SDK 原型真实类型名不可知时无法安全匹配）。

  结构体会自动生成配套中文命令并进入补全/诊断：`名称_创建()`（零初始化，返回长整数型句柄）、`名称_销毁(句柄)`、`名称_取大小()`（sizeof，用于 dwSize 类自描述字段）、每字段一对 `名称_取字段(句柄)` / `名称_置字段(句柄, 值)`。**调用端约定**：以长整数型句柄持有结构体（`局部 长整数型 句柄 = 名称_创建()`），调用 DLL 命令时直接传句柄，生成器自动强转为结构体指针，不得手工拼指针或用传址。边界与约束：返回类型不能是结构体；结构体参数不需要也不能勾选传址；字段类型仅限上表且文本型必须定长；结构体名在整个声明文件内唯一；系统 DLL 命令带结构体参数或指针整数参数/返回时自动走「按导出名 GetProcAddress 解析」的内联包装（函数指针签名以声明为准，无需 SDK 原型）。完整可运行示例见 `AI 视频自主生产/进阶方案/进程枚举演示`（kernel32 进程快照枚举，实机验证 403 个进程）。 **系统 DLL 的句柄类形参/返回值必须声明为 `指针整数`，不得用 `长整数型`**：`长整数型` 固定 8 字节，Win32 下与 4 字节 HANDLE 经 `__stdcall` 函数指针调用会栈不平衡（Debug /RTC1 构建报 Run-Time Check Failure #0，Release 静默破坏栈）；返回 `指针整数` 的命令赋给调用端 `长整数型` 变量是合法转换。
- **`加载方式 = 内存`（内存加载 DLL，2026-09-17 已落地）**：在 `DLL命令库` 内加一行 `加载方式 = 内存`，该库的 DLL 会以 RCDATA 资源内嵌进 EXE（资源号 2201 起，按声明顺序，最多 8 个、单个 ≤32MB），运行期手工 PE 映射到内存（映射节区 → 基址重定位 → 填充导入表 → 分配并登记 TLS 槽位 → 调用 DllMain），**exe 同目录不再出现该 DLL、也不生成导入库**；命令名/参数/返回值与同目录加载完全一致，首次调用时按导出名惰性解析。前置条件：项目必须启用「内存加载DLL模块」（`lingbuilder.advanced.memorydll`），否则构建给中文阻断诊断（不得静默降级）；同一库同时写 `系统 = 真` 与 `加载方式 = 内存` 属阻断错误；DLL 必须与目标位数一致（构建期按 PE Machine 字段阻断）且未加壳（`过文件校验 = 真` 时识别 UPX/ASPack/Themida/VMProtect 等段名）。**AI 生成内存加载相关代码时必须遵守的边界**：① 不得在内存加载的 DLL 里使用 MSVC C++ 异常（`throw/catch` 不会被派发，x64 会以未处理异常终止进程），`__try/__except` 仅 x64 可用；② 内存模块不在系统模块链表中，`GetModuleHandleW(库文件名)` 取不到它；③ `内存DLL_卸载` 只注销不释放映像（静态 CRT 登记的线程局部存储回调仍指向它），声明内嵌加载的模块禁止手工卸载；④ `内存DLL_取函数地址` 返回裸地址，中文代码不能直接调用它，必须走声明机制或把地址传给接收函数指针的原生命令。
- 「内存加载DLL模块」命令族（`lingbuilder.advanced.memorydll`，7 条）：`内存DLL_加载(数据, 虚拟名, [虚拟目录], [过文件校验], [不执行入口])`、`内存DLL_取函数地址`、`内存DLL_取函数序号地址`、`内存DLL_取模块大小`、`内存DLL_已加载`、`内存DLL_卸载`、`内存DLL_取错误信息`。字节来源三条：项目内嵌资源（`资源_取字节集("dll/x.dll")`，见内嵌资源模块）、声明内嵌（`加载方式 = 内存`，机制自动完成）或 `缓冲区_从文件` + `缓冲区_到字节集`；同一虚拟名重复加载直接返回已加载地址。完整限制与完整示例见 `electron/docs/modules/memorydll/README.md`。

## 控制台程序项目规则（2026-09-14）

- 新建项目对话框第三种可用类型是「Windows 控制台程序」（模板 ID `windows-console`，解决方案项目 `type: "windows-console"`）。控制台程序不使用窗口设计器布局：设计器模型只保留一个无控件的宿主窗口（类名固定 `程序`），工作台导航直接打开 `程序.lcpp`。
- 控制台程序入口是唯一契约：某个类「公开」节中的 `整数型 启动()`（或 `空 启动()`）子程序即程序主体；生成器生成 `wmain`（`_WIN32` 下）调用该子程序，「整数型」返回值成为进程退出码。缺失、多类重复定义或返回值类型不是「整数型/空」时必须给中文阻断诊断（`控制台程序缺少入口` / `控制台程序入口不唯一` / `返回值类型必须是…`），AI 不得生成其它入口名（如 `main`、`开始`）或绕过该契约的代码。
- 控制台模式生成物：`wmain` + `SetConsoleOutputCP(CP_UTF8)` + 惰性运行时初始化（COM/GDI+/通用控件，不含窗口类注册与消息循环）；`调试输出` 走既有运行时（OutputDebugStringW + UTF-8 标准输出），IDE 运行时输出经 run.log 进输出面板，不弹独立控制台窗口。控件类模块命令在控制台程序中无意义（无窗口、控件句柄为空），第一版不做模块门禁，AI 生成控制台示例时应只使用非 UI 命令（文件、线程、网络、数据库、正则、队列、缓冲区等）。
- F5 对控制台项目是「生成并运行」：走 `handleSolutionBuildCommand('build', projectId, run=true)`，服务端 `runControlledWindowDesignerBuild` 按 `type === "windows-console"` 选择 `outputKind: "console-application"`（生成入口）与 `projectKind: "console-application"`（vcxproj `<SubSystem>Console</SubSystem>`），运行时 `windowsHide: true`。VS 导出工程为 Application + Console 子系统，`wmain` 决定子系统，无需额外链接参数。
- 控制台线程边界：生成器在控制台入口自动注册无通知 owner（`LingThreadRegisterHeadlessOwner`），任务族/线程池族命令可用；但完成处理器与进度处理器靠窗口消息循环排空，控制台永远不会派发，AI 必须用「线程_提交 + 线程_等待 + 队列_出队」模式取结果，不得生成 `线程_提交完成` / `线程_提交进度`。队列/任务等句柄不能按值传给工作处理器（语言服务阻断诊断），句柄存类成员、工作处理器直读成员。控制台应用单例常驻到进程结束、不参与静态析构（与窗口应用口径一致，规避无窗口收尾崩溃）。
- Mac 兼容预留：控制台入口模板使用 `#ifdef _WIN32`（`wmain`）/`#else`（`main`）分隔，控制台运行时只依赖 CRT 与已启用模块；后续 macOS 适配复用同一入口形态与 `platform` 维度（对话框已保留「Mac 控制台程序（规划中）」占位）。

## 外部工程导入与混合解决方案规则（2026-09-14 已落地）

- IDE 支持导入既有 C++ 工程：文件菜单「导入 MSBuild/CMake 工程…」（桌面版原生文件对话框选 `CMakeLists.txt/.vcxproj/.sln`，Web 版输入工作区相对路径）。工作区外工程优先「切换到工程所在目录作为工作区并导入」，用户拒绝时可「复制进当前工作区」（复制到 `external/<目录名>`，自动跳过 Debug/Release/obj/.vs 等产物目录，上限 1GB/2 万文件）。AI 帮用户导入时应说明这两条通道，不要建议手工改 `solution.json`。
- `.sln` 默认**展开为多个项目**导入：每个 `.vcxproj` 生成一个 `external-msbuild` 解决方案项目，sln 内 `ProjectDependencies` 翻译为 `references`（构建顺序由既有依赖拓扑直接保证）；只有 x64 平台的项目构建属性自动默认 x64；工作区外或非 Visual C++ 项目跳过并给出中文告警。导入确认框里用户也可选择「整 sln 单目标导入」（`mode:'single'`，旧行为）。AI 生成导入指令时应默认展开模式，仅在 sln 解析失败或用户明确要求整体构建时用单目标。
- 外部工程构建产物目录是确定性的：MSBuild 钉定 `/p:OutDir=<构建目录>\`、CMake 传 `-DCMAKE_RUNTIME_OUTPUT_DIRECTORY`，产物按构建配置（Debug/Release × Win32/x64）落在统一构建目录。外部工程作为启动项目时 F5「生成并运行」会定位并托管启动 exe（可用构建属性 `executableName` 帮助定位）；windows-dll 工程没有可运行产物，AI 不得为 DLL 项目生成运行预期。
- 外部工程的构建输出会解析为结构化诊断进「问题」面板：常见 `Cxxxx`/`LNKxxxx`/`MSBxxxx` 错误码附中文解释。AI 解释外部构建失败时，应优先引用问题面板中已解析的「文件(行,列)+代码+中文解释」，而不是让用户重读原始日志。
- 打开一个含 C++ 内容的文件夹时，IDE 会在默认解决方案工作区自动检测既有工程（浅层扫描 `CMakeLists.txt/.sln/.vcxproj`）或「含源码无工程文件」的目录并提示一次；后者可「扫描源码生成 CMakeLists.txt（生成物，显式源码列表+C++17）并导入」。AI 替用户新建工程时，若目标是已有源码目录，应使用该导入通道而不是让用户手工从零新建。
- 资源管理器中 `.cpp/.cc/.cxx/.c` 右键「适配为中文工程…」：读取源码经原生 C++ 适配服务翻译为**新的**中文工程（窗口/控件/方法转中文代码与设计器模型，未识别语句保留为 `@` 原生块），原 C++ 文件不会被修改。AI 描述该能力时必须说明「生成新工程、不改原文件、未识别语句会降级为 @ 原生块」三个边界。
- 混合解决方案：中文项目 `references` 引用外部工程时，IDE 构建会自动把被引用工程的 include 目录（源码根 + `include/`）与导入库 `.lib` 合并进编译链接计划——中文主程序可以直接 `#include` 外部头文件并链接外部库（构建顺序先外部后中文）。注意：VS 导出工程暂不自动注入这些 include/lib（见 `docs/FUTURE_OPTIMIZATIONS.md`），AI 在解释「IDE 内能编译、导出 VS 工程缺头文件/链接错误」时应指出这一差异。外部工程本身没有窗口设计器与 `.lcpp` 源码，`controlRef`、中文命令、事件绑定等规则不适用于外部工程的源码文件。

## 模块设计器事件参数规则

- NewEmoji 原生窗口中的 `调试输出`必须同时保留 Windows `OutputDebugStringW` 和 IDE 受控运行日志的 UTF-8 标准输出；只写调试器通道会导致 F5 已触发事件但“调试控制台”没有任何输出。标准输出固定使用 `[调试输出] `前缀并立即刷新，不能依赖进程退出才落盘。
- 模块控件事件的 `.lcpp` 参数必须以启用模块 `contributes.designerControls[].events[].parameters` 为唯一契约。设计器“生成并打开”、Monaco、新手编辑器、语言诊断和 C++ 回调桥接必须消费同一份参数名称与类型；AI 不得把有原生参数的事件生成成空参数，也不得自行猜测回调参数。
- `lingbuilder.new_emoji.ui/Table` 的 `CellClicked` 使用 `(整数型 行号, 整数型 列号)`，`CellAction` 使用 `(整数型 行号, 整数型 列号, 整数型 动作, 整数型 值)`，`CellEdit` 使用 `(整数型 行号, 整数型 列号, 整数型 动作, 文本型 文本)`，`ContextMenu` 使用 `(整数型 行号, 整数型 列号, 整数型 区域, 整数型 横坐标, 整数型 纵坐标)`，`VirtualRow` 使用 `(整数型 行号)`；鼠标按下/抬起/双击传坐标和按钮，移动传坐标，滚轮传坐标和增量。
- `lingbuilder.new_emoji.ui/ListBox` 的 `SelectionChanged` 使用 `(文本型 选中键列表)`，`ItemClicked` 使用 `(整数型 项目索引, 整数型 起始位置, 整数型 结束位置)`，`ItemDoubleClicked` 使用 `(整数型 项目索引, 整数型 触发方式, 整数型 附加值)`，`Edit` 使用 `(整数型 项目索引, 整数型 编辑字段, 整数型 动作, 文本型 文本)`，`Reorder` 使用 `(整数型 原索引, 整数型 新索引, 整数型 数量)`，`ContextMenu` 使用 `(整数型 项目索引, 整数型 横坐标, 整数型 纵坐标)`；鼠标进入/离开和获得/失去焦点没有额外参数。
- `lingbuilder.new_emoji.ui/RichList` 使用上游 JSON ABI。`templateJson`、`itemsJson`、`selectedKeys` 必须保持合法 JSON；`SelectionChanged` 使用 `(文本型 选中键列表)`，值是选中 key 的 JSON 数组。`ItemClicked`、`ItemDoubleClicked`、`ButtonClicked`、`BadgeClicked`、`CountdownEnd`、`ContextMenu` 均使用 `(文本型 事件数据)`，内容包含稳定 `event` 字段以及可用的 `itemKey`、`itemIndex`、`nodeId`、`actionId`、`x`、`y`。AI 不得自行拆出清单未声明的强类型参数，也不得把共享原生回调生成成同时调用全部事件处理器。
- `lingbuilder.new_emoji.ui/Tabs` 的 `SelectionChanged` 必须生成 `(整数型 选中索引, 整数型 项目数量, 整数型 动作)`。三个值对应 `EU_SetTabsChangeCallback` 的 `value`、`range_start`、`range_end`；动作编号 `1/2/3/4/5/6` 分别表示代码设置、鼠标、键盘、关闭、新增、滚动。AI 不得把该事件生成为零参数，也不得把其它控件同名 `SelectionChanged` 的参数套到 Tabs；带 FBro 页面时仍必须保留同一参数声明。
- `VirtualRow` 是同步数据提供事件。处理器必须调用 `NE_设置表格虚拟行数据("高级行协议")` 设置本次行数据；生成器负责转为 UTF-8，并按 new_emoji 的长度查询/缓冲区复制两阶段 ABI 返回。不得固定返回 0、重复执行处理器或把返回文本保存在跨事件共享的普通全局字符串中。
- 已有零参数模块事件处理器继续兼容；从设计器重新打开时只允许把确认为零参数的旧签名安全升级为当前契约，不得覆盖用户已经自定义的非空参数。新建事件和补全必须直接生成当前强类型签名，参数数量或类型错误时提供中文阻断诊断。
- 2026-09-12/13 新增 new_emoji 数据桥接命令（宽字符版，含 Post 投递族、JSON 读取族、提问框/通知/加载遮罩、窗口图标字节集、Excel 导入导出，以及按控件属性表自动生成的 `NE<类型>_设置<属性>` 属性命令，总命令 3807→3986），AI 写 new_emoji 界面时必须优先使用它们，禁止改调参数相同的 `NE_EU_*` 底层命令——底层命令的字节指针参数接收字符串时生成 `L"..."` 宽指针，与 `const unsigned char*` ABI 不匹配，语言服务会给出行内阻断诊断且 MSVC 编译必然 C2664 失败：表格数据 `NE表格_设置列` / `NE表格_设置行数据` / `NE表格_添加行` / `NE表格_插入行`（列与行为 new_emoji 高阶 kv 协议文本，不是 JSON：列每行一条 `title=标题	key=标识	width=宽度	align=对齐(left/center/right)`，行每行一条 `key=行键	c0=第1列	c1=第2列`，字段用制表符分隔、记录用换行分隔）；富列表数据 `NE富列表_设置模板` / `NE富列表_设置条目` / `NE富列表_添加条目` / `NE富列表_设置选中键` / `NE富列表_设置倒计时` / `NE富列表_设置倒计时状态`；菜单项目 `NE菜单_设置项目`（换行分隔项目、`>` 前缀表示子菜单层级）/ `NE菜单_设置项目图标` / `NE菜单_设置项目快捷键` / `NE菜单_设置项目元数据`；徽标 `NE徽标_设置文本`；窗口级 `NE_设置窗口图标`（.ico 路径）、`NE_设置主题令牌`（令牌名 + 0xAARRGGBB）。
- `NE_显示消息框` / `NE_显示确认框` / `NE_显示扩展消息框` 是 new_emoji 过程式消息框的高层入口（底层 `NE_EU_ShowMessageBox*` 同样不可直调）。处理器参数必须写 `&处理器名`：结果回调签名为 `(整数型 结果编号, 整数型 结果值)`，扩展消息框为 `(整数型 结果编号, 整数型 动作, 文本型 输入文本)`；结果值 1 确认、2 取消/关闭。这三个命令与 `NE_设置窗口图标`、`NE_设置主题令牌` 的窗口句柄参数可写 `当前窗口`，生成 C++ 使用模块主窗口句柄。
- 2026-09-13 第二批：Post 投递族（`NE菜单_投递*`、`NE富列表_投递*`、`NE表格_投递*`、`NE徽标_投递设置文本`）供工作线程安全刷新界面，处理器内仍只读快照；输出指针型原生 getter 一律不要直调，用 JSON 返回封装（`NE菜单_取状态/取颜色/取项目元数据`、`NE表格_取单元格值/取双击编辑状态`、`NE富列表_取选项/取样式/取倒计时状态` 等）。Tabs 新增 `关闭标签页` 事件（`NE标签页_绑定关闭标签页`）、Menu 新增 `右键菜单` 事件（`NE菜单_绑定右键菜单`）。
- RichList 的 `VirtualRow`（虚拟数据源）与 Table 的 `VirtualRow` 同范式：`NE富列表_绑定虚拟数据源(富列表, &处理器)` 绑定，处理器签名 `(整数型 行号)`，处理器内调用 `NE富列表_设置虚拟行数据("条目 JSON")` 回填本次数据；生成器负责 UTF-8 转换与两阶段缓冲区协议。两者数据槽相互独立，不得混用。
- 2026-09-15 第三批：Tabs 样式与运行时全量补齐。① 逐项「禁用/图标/可关闭」必须随 `EU_SetTabsItemsEx` 六字段高阶协议（`标题\tID\t内容\t图标\t禁用\t可关闭`）传入原生——库没有 `EU_SetTabsItemDisabled`，省略该协议会让设计器勾选的禁用态在 F5 后无效；② 新增 `新增标签页`（`NE标签页_绑定新增标签页`，处理器收新项目索引）与 `拖拽重排`（`NE标签页_绑定拖拽重排`，处理器收原索引/新索引/项目总数）两个事件；③ 新增标签页运行时命令族 `NE标签页_设置激活索引` / `取激活索引` / `取激活标题` / `取项目数量` / `添加项目` / `关闭项目` / `设置滚动偏移` / `滚动` 与运行时样式族 `设置标签样式`（0 线条、1 卡片、2 边框卡片）/ `设置标签位置`（0 顶部、1 右侧、2 底部、3 左侧）/ `设置表头对齐` / `设置表头可见` / `设置可编辑` / `设置内容可见` / `启用浏览器模式` / `设置浏览器度量` / `设置项目图标` / `设置项目可关闭` / `设置项目状态` / `设置新建按钮可见` / `设置拖拽选项`，AI 优先用它们而非 `NE_EU_*` 底层命令；设计器画布预览（`TabControlDesignerPreview`）同步渲染卡片/边框卡片样式、四向表头、逐项状态徽标、×/+ 按钮与浏览器模式。

## HTTP 客户端 2.0 生成规则

- `lingbuilder.net.http-client` 的正式入口是受管客户端/请求 ID；AI 生成新代码时应优先使用 `HTTP客户端_创建客户端`、`HTTP客户端_创建请求`、`HTTP客户端_开始请求` 和完成处理器，不得生成裸 `HINTERNET`、WinHTTP 句柄或任意网络线程。
- 完成处理器参数必须使用 `&处理器名`，处理器必须无参数并返回空；处理器中用 `HTTP客户端_取当前请求()` 读取不可变响应快照。普通 Win32 与 new_emoji 共用同一 WinHTTP runtime 和请求语义，不能为后端复制另一套解析或权限逻辑。
- 地址只允许 `http://` / `https://`；请求头、代理地址、凭据和处理器文本拒绝 CR/LF。证书默认验证系统链、主机名、有效期和用途；放宽 TLS、允许自签名或证书固定都必须由用户明确写入 `.lcpp`。密码只在进程内存中保存并在客户端销毁时清除。
- 大正文/大响应使用 `HTTP客户端_设置文件正文`、`HTTP客户端_设置响应文件` 和显式资源上限；不要把文件内容转成无限大小字符串或把响应写入工作区外路径。同步执行/等待只用于后台任务或测试，窗口事件中不得阻塞 UI 消息循环。
- 旧 `HTTP客户端_请求`、`HTTP客户端_GET`、`HTTP客户端_POST`、`HTTP客户端_取状态码`、`HTTP客户端_取响应文本`、`HTTP客户端_取错误`、`HTTP客户端_清空状态` 必须保留原参数顺序和返回类型，作为兼容入口委托到默认受管客户端；不得把旧调用静默改写成新的异步处理器。
- AI 生成模块示例、补全或文档时，响应文本必须使用 `HTTP客户端_取响应文本编码(请求, "auto")` 等带编码参数的命令，处理器引用不得加引号。生成前后都必须让模块 binding、语言服务和 C++ 生成消费同一份命令定义。

## CEF3 3.0 安全封装生成规则

- CEF3 固定基线为 `150.0.14 / Chromium 150.0.7871.129 / Windows MSVC x64`。当前开发版本为 `3.0.0-alpha.3`；覆盖 v2 目录共有 1577 项记录，其中 505 implemented、8 internal、185 notApplicable、879 planned。objects、session 与 `cef_command_line_capi.h` 已清零各自 planned；CommandLine 的 23 个官方目录项通过类型化受管句柄、受管文本数组和 C ABI v4 固定操作 ID 接入。Image、Menu 和 RequestContext 的调用由 Bridge 自动调度，跨边界只传类型化句柄、任务、UTF-16 JSON 和受管缓冲；AI 不得生成裸地址、`CefRefPtr` 或 STL 跨 ABI。
- 浏览器有效性、popup、实例比较、窗口渲染模式、网页全屏状态、关闭准备状态、渲染进程响应状态、运行时样式、当前与默认缩放级别读写、缩放命令可用性和实际执行、忽略缓存刷新、类型化键鼠输入、焦点和页内查找必须使用现有中文命令，不得用 JavaScript 或 DOM 轮询替代。`CEF3_是否网页全屏` 只表示网页通过 Fullscreen API 进入全屏，不表示宿主窗口最大化；`CEF3_是否已准备关闭` 返回真表示强制关闭流程必须完成，应尽快销毁宿主窗口或视图层级，不能把它当作可取消关闭的许可判断；`CEF3_是否渲染进程无响应` 由 Bridge 在 CEF UI 线程读取，表示渲染进程至少 15 秒未处理输入；`CEF3_取运行时样式` 返回 `0=默认、1=Chrome、2=Alloy`，无窗口/OSR 浏览器固定为 Alloy；`CEF3_取缩放级别` 返回当前 CEF 小数级别，`CEF3_取默认缩放级别` 返回宿主默认值，`CEF3_设置缩放级别` 接受有限小数并以 `0.0` 恢复默认缩放，`CEF3_执行缩放` 接受缩小、重置或放大的整数命令。Display、Find、Focus、Keyboard、LifeSpan、Load、JSDialog 与 ContextMenu 的 getter/override 已由 Bridge 托管；上下文菜单事件会复制坐标、URL、媒体/编辑状态、拼写建议和菜单摘要，禁止保留或泄露临时 `CefContextMenuParams`、`CefMenuModel` 或 callback 指针。
- `CEF3_尝试关闭` 必须保留 CEF 官方返回语义：返回 `1` 表示宿主窗口可立即销毁，返回 `0` 表示关闭已启动或延迟并应等待关闭回调；不得把 `0` 描述为调用失败，也不得用强制关闭替代常规关闭流程。
- `CEF3_通知窗口移动或调整大小` 仅用于 Windows/Linux 宿主窗口即将移动或调整大小时通知 CEF；必须传裸 `controlRef`，不得用字符串控件名、JavaScript 或 DOM 事件替代宿主通知。
- `CEF3_通知屏幕信息已改变` 用于 OSR 或客户端提供外部根窗口的浏览器，向渲染进程同步屏幕尺寸、坐标与缩放变化；普通页面脚本不能替代宿主级屏幕信息通知。
- `CEF3_发送捕获丢失事件` 只在 OSR/禁用窗口渲染的宿主失去鼠标捕获时调用，必须传裸 `controlRef`；不得把它描述成用户可绑定的浏览器回调。
- `CEF3_取消输入法组合文本` 仅用于 OSR/禁用窗口渲染浏览器，丢弃当前未提交 IME 组合内容；它不是清空普通输入框文本的页面命令。
- `CEF3_完成输入法组合文本` 仅用于 OSR/禁用窗口渲染浏览器，将当前 IME 组合文本提交给页面；第二参数决定是否保留现有选区，不得省略或用普通整数冒充逻辑值。
- `CEF3_添加单词到词典` 把非空 UTF-16 单词加入指定浏览器配置的自定义拼写词典；控件名必须是裸 `controlRef`，单词必须是带引号的真实文本，不得颠倒两类参数。
- `CEF3_替换拼写错误` 用非空 UTF-16 单词替换页面中当前选中的拼写错误文本，不会把单词加入自定义词典；没有有效拼写选区时由 CEF 安全忽略。
- `CEF3_通知系统拖放结束(浏览器控件)` 只能接收裸 `controlRef`；系统拖放循环完成后调用，用于让 CEF 清理拖放源状态，不得把控件名写成字符串。
- `CEF3_通知拖放目标离开(浏览器控件)` 只能接收裸 `controlRef`；拖动对象离开浏览器目标区域时调用，用于清理 CEF 目标端状态，不得附加拖放数据或坐标。
- `CEF3_通知隐藏状态(浏览器控件, 是否隐藏)` 的首参必须是裸 `controlRef`，第二个参数必须是逻辑型；仅用于无窗口渲染宿主隐藏或显示时通知 CEF 暂停或恢复绘制。
- `CEF3_退出网页全屏(浏览器控件, 是否调整大小)` 的首参必须是裸 `controlRef`，第二个参数必须是逻辑型；退出网页 Fullscreen API 状态后会改变视图尺寸时传真，否则传假，不得用它代替宿主窗口最大化或还原。
- `CEF3_是否使用浏览器视图(浏览器控件)` 只接收裸 `controlRef`，返回 1 表示浏览器由 CEF Views 的 `CefBrowserView` 包装，否则返回 0；不得据此生成、保存或传递原生 View 指针。
- `CEF3_取打开者浏览器ID(浏览器控件)` 只接收裸 `controlRef`，非弹出浏览器返回 0，弹出浏览器返回创建者浏览器唯一 ID；不得把该整数当作 CEF 指针或跨进程地址。
- `CEF3_是否可缩放(浏览器控件, 缩放命令)` 与 `CEF3_执行缩放(浏览器控件, 缩放命令)` 的首参必须是裸 `controlRef`，第二参数只能是 `0=缩小`、`1=重置` 或 `2=放大`；前者返回 1 才允许调用后者，不能用当前缩放级别推测可用性。执行命令不会返回新的缩放数值，需要时再调用 `CEF3_取缩放级别`。
- 事件目录当前提供 92 项用户事件名称，对应 113 / 113 个官方事件签名已由 Bridge 接通；全目录仍有 879 项 planned。音频数据包、文件对话框、权限、认证、证书错误、进程无响应和跟踪完成回调使用受管 continuation 与明确默认动作。AI 不得把 `planned`、自动中文名或模块 contribution 描述成已经可运行，也不得在 `planned/needsReview` 清零前宣称全覆盖或 3.0.0 已发布。
- `CEF3_取资源地址(相对路径)` 是 `.lcpp` 加载本地测试页与本地资源的**唯一可移植入口**：把相对路径解析为随程序一起部署在 exe 同级 `assets/` 目录下的文件，返回已按 UTF-8 百分号转义的 `file:///` 地址；传入盘符绝对路径、UNC 路径或已带协议的完整地址时原样返回，因此可对同一结果重复套用；它不依赖浏览器控件实例，可在控件创建前调用。**用法必须先把结果赋给文本型局部变量，再传给 `CEF3_导航`**：`局部 文本型 地址 = CEF3_取资源地址("index.html")` 然后 `CEF3_导航(浏览器1, 地址)`。地址形参在 C++ 侧是 `const wchar_t*`，写成 `CEF3_导航(浏览器1, CEF3_取资源地址("index.html"))` 这种内联嵌套会生成 `std::wstring` 传 `const wchar_t*` 而编译失败（MSVC C2664），AI 不得生成该形态。**AI 生成示例、项目模板、教程代码或修复建议时同样禁止写死 `file:///` 绝对路径、工作区路径或任何机器特定目录**——那会把本机路径烧进随仓库分发的示例，违反「源码可复制给别人使用」；需要加载本地页面时一律改用本命令，且只引用确实随 `assets/` 一起部署的文件。
- **事件名一致性（2026-09-06 补）**：`cef3BrowserEvents.ts` 里的中文名就是运行时 `CEF3_绑定事件` 存处理器的键，所以桥接层 `Emit*` 发出的名字必须与它**完全一致**，否则处理器查不到；`kind === 'decision'` 的同步可取消事件尤其危险——处理器不执行时 `response->action` 恒为 0，取消静默失效且没有任何报错。桥接存在 `EmitEvent` / `EmitNotificationEventV4` / `EmitAsyncEvent` / `EmitDownloadHandlerNotification` 多种发射点，逐个肉眼核对不可靠。约束由生成器 `lingCppWin32Project.ts` 的 `CEF3_归一化Bridge事件名()` 别名表 + 回归测试 `electron/tests/cef3BridgeEventNames.test.ts` 共同保证：新增或改名 CEF3 事件时必须同步复核该表，并跑该测试。不得把「113/113 签名已接通」读成事件名层也已核对一致——2026-09-06 之前正是这个空白让 `导航请求前`（桥接发「浏览前请求」）等 18 处名字不一致长期存在，并导致 CEF3 教程第 05 集误判为「运行态乱码」而丢掉实机演示镜头。
- **订阅位一致性（2026-09-06 补，与上一条同族缺陷的另一半）**：事件名对上不代表订阅位对上。Bridge 用「处理器族订阅位掩码」决定两件事——是否向 CEF 安装 `CefResourceRequestHandler` / `CefFrameHandler` / `CefPrintHandler` / `CefDownloadHandler` 等处理器（订阅位为 0 时 `GetResourceRequestHandler` 直接返回 `nullptr`，CEF 根本不会调用回调），以及回调体是否向宿主投递事件。`CEF3_绑定事件` 现在在登记处理器的同时点亮该事件所属订阅位，并在浏览器创建完成后回放一次，因此**绑定即订阅，不存在也不需要「先调用某条订阅命令」的前置步骤**：`CEF3网络_订阅*` / `CEF3传输_订阅*` / `CEF3离屏_订阅*` 这类名字只存在于生成的接口清单与模块文档表格中，**不是可调用命令**，AI 不得把它们写进 `.lcpp`，也不得在示例或修复建议里要求用户先调用它们。映射表是 `cef3BrowserEvents.ts` 的 `CEF3_EVENT_BRIDGE_SUBSCRIPTIONS`，由 `electron/tests/cef3BridgeEventNames.test.ts` 与桥接源码逐条比对；新增受订阅门控的 CEF3 事件必须同时补表，否则测试会报「绑定后仍不会触发」。反向约束：**已有 legacy 数字事件通道的事件（如「导航请求前」「下载开始」「主文档可用」等 63 个）不得进订阅表**，否则点亮订阅位后同一事件会经 legacy 与受管两条通道各投递一次、处理器被调用两遍。受管通道的事件只走 V4 事件包，生成的运行时在创建浏览器时注册 `CEF3_Bridge事件回调V4` 并降形复用同一个中文事件入口；删除该注册会让资源/框架/打印/Cookie 族整族静默失效。
- **浏览器创建时序（2026-09-06 补）**：`CEF3_创建` 底层 `LB_CEF3_BrowserCreate` 只把 `CefBrowserHost::CreateBrowser` 投递到 CEF UI 线程，句柄**立刻**返回，但此刻 CEF 浏览器对象还不存在（桥接层要等 `OnAfterCreated` 才写入 `state->browser`）。因此 `CEF3_导航` 在「创建完毕」事件里调用现在**自动可用**：运行时把地址排队，等桥接层发出「浏览器创建完成」（该事件发出前 `state->browser` 已写入）时无条件补发，返回 1 表示请求已接受。**但只有导航有这套排队**：其余依赖活动浏览器对象的 CEF3 命令（异步/同步执行 JS、页内查找、截图、缩放、静音、DevTools、Cookie 与请求上下文操作等，桥接侧约 44 个入口）在创建完成前调用仍会以「CEF3浏览器尚未创建完成或已经关闭」失败。AI 生成代码时必须把这些调用放在用户动作（按钮单击等）或「加载完成」之后，**不得用 `线程_休眠`、轮询或重试循环绕过时序**，也不得宣称「创建完毕里可以调用任意浏览器命令」。
- CEF3 生成工程只能包含 `LingBuilderCefBridge.h` 并链接 `LingBuilderCefBridge.lib`；不得生成 CEF 头、`CefRefPtr`、`CefClient`、Handler override，也不得让应用直接链接 `libcef.lib` 或 `libcef_dll_wrapper.lib`。CEF C++20 API、wrapper、UI/IO 线程投递与对象生命周期只允许存在于 Bridge DLL 内。
- `.lcpp` 边界只允许 UTF-16、POD、版本化事件包、带类型和代际的 64 位句柄、任务 ID 与受管缓冲。事件处理器必须使用 `&处理器名`；不得生成裸指针、STL、任意地址或字符串处理器。
- 每个浏览器实例使用独立 RequestContext 和全局 root cache 的直接子目录。核心已支持初始化/关闭、多实例、Chrome Runtime、导航、异步 JavaScript、下载、打印与 DevTools 基础操作；objects 已支持 Value/Dictionary/List/Binary 深复制受管句柄，session 已支持 RequestContext、HTTP 缓存清理和 Cookie 遍历/设置/删除/落盘异步任务。AI 必须保存并释放对象、上下文和任务句柄，Cookie 结果只作为 UTF-16 JSON 使用，不得生成 CEF 指针。当前 113 个官方事件签名均有真实 Bridge override/受管回调入口；其余 Preference/扩展、Scheme/Filter、PDF、DOM/V8、DevTools 订阅、OSR、Views 等尚未实现的能力不得伪造命令或用 JavaScript 模拟。
- CEF3 的 CEF 150 只与 FBro 进程内模式的 CEF 135 互斥；全部 FBro 控件使用独立进程模式时允许同项目启用，但两个版本的 `libcef.dll` 必须分别留在主 exe 目录和 `fbro-host/`。不得建议用户绕过进程模式诊断或手工混放运行时。
- **资源响应正文读取与替换（2026-09-08 补）**：`CEF3_读资源响应正文(控件名, 最大字节数, 完成处理器)` 只能在「资源响应到达」处理器内调用，为当前请求安装有界正文捕获，完成后触发「资源响应正文到达」，通过 `CEF3_取事件字段` 读取 `bodyText`、`bodyBase64`、`receivedBytes`、`truncated`、`error`；它不会重新发起网络请求。`CEF3_替换资源响应内容(控件名, 查找内容, 替换内容)` 为指定浏览器配置响应正文查找替换：查找按 UTF-8 字节匹配、二进制安全，查找内容不能为空，替换内容为空表示删除；只改响应正文，不改响应头和状态码；配置对该浏览器之后加载的全部资源生效，重复调用以最后一次为准。浏览器尚未创建时命令自动排队，并在桥接句柄就绪的同一同步点附加，因此「创建完毕」里先替换再导航，首个页面的响应就已经被改写——AI 可以放心生成这种顺序，但不得宣称对已加载页面立即生效（需要重新导航）。`CEF3_清除资源响应替换(控件名)` 移除替换配置并取消排队配置，已加载页面不受影响。三个命令的查找/替换语义不得用 JavaScript 注入、DOM 改写或重新请求来模拟；涉及正文捕获与替换的示例必须能通过 F5 构建运行并在界面上可见效果。
- **JS 交互（cefQuery）通道（2026-09-12 补）**：页面调用原生使用 CEF 官方 MessageRouter（cefQuery 风格）。**注册时机是硬约束**：查询通道必须在 `LB_CEF3_Initialize` 之前注册（渲染进程在 `OnWebKitInitialized` 时按 `CefMessageRouterConfig` 把查询函数注入 `window`，初始化完成后再注册的通道对新浏览器不生效），因此标准用法是 **CEF3 浏览器控件属性 `jsQueryFunctions`**（格式 `查询函数名,取消函数名`，如 `cefQuery,cefQueryCancel`，留空不启用），生成器把它烘焙进 `CEF3_初始化` 并在 `LB_CEF3_Initialize` 前逐条发 `LB_CEF3_EnableJsQuery`；设计器属性面板对 CEF3Browser 提供**固定单通道**结构化弹窗（`FbroJsQueryEditorDialog` mode=cef3：仅一行通道、不可增删/排序，实时预览烘焙 `LB_CEF3_EnableJsQuery` 与页面调用写法，取消函数名留空时预览按桥默认 `cefQueryCancel` 展示），保存回写控件属性字符串，项目保存时才落盘 `window-designer.json`（属性编辑只更新内存+localStorage）。`.lcpp` 命令 `CEF3_启用JS扩展(控件名, 查询函数名, 取消函数名)` 只在初始化前调用有效，在「创建完毕」等事件里调用必然失败（返回 0）——AI 不得生成这种调用，也不得宣称运行期可注册通道。CEF3 每个程序只支持**一条**查询通道（与 FBro 的多通道不同），同名重复注册幂等成功、异名注册失败；页面要区分业务请在 request 载荷里自带标记。应答链：`CEF3_绑定事件(浏览器1, "查询请求", &处理器)` → 处理器内 `CEF3_取事件字段(浏览器1, "queryId")` 取数字文本 → `CEF3_查询应答(浏览器1, 查询ID, 结果文本)` 或 `CEF3_查询应答失败(浏览器1, 查询ID, 错误码, 错误文本)`；每条查询只能应答一次，未应答的查询 120 秒后由桥对页面自动回错误码 -4（页面 `onFailure` 收到）。「查询已取消」（OnQueryCanceled，页面取消/导航离开/浏览器关闭/渲染进程终止）会通知 `.lcpp`，收到后无需再应答；CEF 150 中页面主动 `cefQueryCancel` 只触发宿主侧取消通知，不再回调页面自身的 `onCanceled`，这是 CEF 内建语义，AI 不得虚构页面端取消回调行为。事件字段只有 `queryId`、`request`、`persistent`，**没有通道名字段**。处理器运行在宿主事件链路上，应答可在处理器内同步完成，也可延后（例如等 `CEF3_读资源响应正文` 完成后再应答）。

## FBro 浏览器生成规则

- FBro 2.4 核心及 2.1 兼容子模块固定为 `lingbuilder.fbro.events/session/transfer/automation/objects/network/vip`，子模块均依赖 `lingbuilder.fbro.browser >= 2.1.0`。AI 请求启用能力模块时必须使用模块服务的递归计划，不得手工只写子模块 ID；禁用核心前必须展示依赖它的模块并取得级联确认。
- FBro 中文命令可以有官方英文 `aliases`，两者必须解析到同一个 binding。专业模式 API 只在 `showAdvancedApi=true` 时进入补全；字符串和注释里的别名不得被当作真实调用。
- FBro 主事件协议为兼容 C ABI v3，并保留 v1/v2 导出。v3 使用 `LB_FBRO_EVENT_PACKET_V3`、`LB_FBRO_EVENT_RESPONSE_V3`、稳定事件 ID、类型化对象句柄和受管延续句柄；跨边界只允许版本化 POD、UTF-16 字符串/JSON、任务 ID 和受管缓冲。AI 不得生成裸内存地址、`void*`、`CefRefPtr`、STL 跨 DLL 参数或让 `.lcpp` 释放 SDK 对象。任务、对象、缓冲和延续句柄必须按所属 API 完成、取消或释放。
- `lingbuilder.fbro.vip` 的官方 VIP 目录已为 188/188 implemented、planned=0。188 项官方能力逐项公开为 179 条单项命令、6 条 Bridge 自动管理能力和 3 条凭据中心/安全入口替代能力，另保留 10 条“批量与通用高级入口”，模块清单共 198 条。AI 应优先生成固定官方动作的单项命令，例如 `FBroVIP_DOM_取文档(控件名, 参数JSON)`，不得让用户再传“命令名称”字符串；只有批量或通用高级场景才使用 `FBroVIP_DOM异步命令`、`FBroVIP_扩展异步命令`、`FBroVIP_资源规则异步命令`、`FBroVIP_开发者工具异步命令`。异步调用必须保存任务 ID，并按“等待 → 取结果/错误 → 释放”使用。自动管理与安全替代项为 `internal`，可在模块详情说明，但不得进入 Monaco 普通补全。不得因为 VIP 子模块完成而宣称整个 FBro 1079 项目录完成；全目录仍有其它模块的 `planned`。
- VIP 资源替换的二进制只能传受管缓冲句柄，不能生成地址、裸字节指针或 Base64 冒充内存。扩展目录、CRX 和资源文件必须位于生成程序目录内；路径越界时必须保留 Bridge 阻断诊断。DevTools 观察器事件已经复制为 UTF-16 JSON，AI 不得生成 SDK observer、callback、触摸点指针或 `CefDictionaryValue`。
- `FBroVIP_设置启动代理` 仅在首个 FBro 运行时初始化前有效。可视化窗口通常会在窗口创建代码执行前初始化 FBro，因此 AI 不得把该命令机械插入“创建完毕”事件后声称生效；需要启动代理时应使用宿主启动配置或受控子进程环境。代理密码和 VIP Key 都不得进入日志、AI 上下文或模块清单，VIP Key 更不得进入 `.lcpp` 明文。
- 动态事件统一使用 `FBro_绑定事件(控件名, 事件名, &处理器名)`；处理器参数必须带 `&`。事件名可以使用中文名、官方 `On...` 名或兼容别名，保存时使用稳定官方事件 ID。事件字段从 UTF-16 JSON 读取；同步事件通过 `FBro_设置事件结果`、`FBro_设置事件返回文本` 或 `FBro_设置事件响应JSON` 决策，普通即时决策默认 2 秒。带官方 callback 的延迟决策必须通过 `FBro_取事件延续` 后调用 `FBro事件_完成延续` 或 `FBro事件_取消延续`，安全/认证/权限、查询/路由、文件/对话框/下载默认分别为 5、30、120 秒，超时采用目录中的安全默认动作。
- FBro 事件目录按“所属类 + 方法名 + 完整签名”登记 174 个类方法槽位和 158 个唯一签名，当前 `planned=0`、`needsReview=0`；每个槽位必须具有确定分类、真实 override 或明确的 `managed/internal/notApplicable` 理由、字段/响应 schema 和测试。普通 Win32 与 New_Emoji 消费同一 v3 目录和协议，高频事件只有绑定后才订阅并按目录限流。不得把事件目录完成误写成全部 1079 个普通 API 完成：全目录仍有 678 个非事件高级签名处于 `planned`，Frame visitor、完整公开 V8 和正式 OSR 设计器是独立工作流。
- **FBro 资源响应事件字段与正文捕获（2026-09-08 落地）**：`lingbuilder.fbro.events` 新增 `FBro_读资源响应正文(控件名, 最大字节数, 完成处理器)`，只能在「资源响应到达」处理器内调用，为当前请求安装有界正文捕获；完成后触发合成事件「资源响应正文到达」，通过 `FBro_取事件字段` 读取 `url`、`status_code`、`mime_type`、`received_bytes`、`truncated`、`error`、`body_text`（UTF-8 预览）和 `body_base64`。它不会重新发起请求。资源响应事件（`OnResourceResponse` / `OnResourceLoadComplete` / `GetResourceResponseFilter`）为手写覆盖，Bridge 直接读 `CefRequest` / `CefResponse` 投递字段：`request_id`、`request_url`、`method`、`status_code`、`mime_type`、`charset`、`headers`（响应头对象）+ 原 `status`、`received_content_length`。FBro 资源事件在多个 IO 线程上交错、`GetResourceResponseFilter` 与 `OnResourceResponse` 可能乱序，因此必须按 `request_id` 精确配对，不得用单一“当前请求”槽位或单例捕获状态。正文捕获实现走官方唯一受支持路径（`FBroHsResponseFilter` 子类 + `FBroHsResponseFilter_Create` 包装 + 官方 `End` 回调派发），不得用自定义 `CefResponseFilter` 直接安装——那样会静默失效且造成堆损坏。
- **FBro 资源响应替换高层命令（2026-09-09 落地）**：`lingbuilder.fbro.browser` 新增 `FBro_替换资源响应内容(控件名, 地址, 内容)`（整响应替换为 UTF-8 文本，类型 text/html）、`FBro_替换资源响应文件(控件名, 地址, 文件路径)`（整响应替换为本地文件，MIME 按扩展名推断）、`FBro_清除资源响应替换(控件名, 地址)` 与 `FBro_清空资源响应替换(控件名)`。宿主侧包装经 `LB_FBro_VipResourceCommandAsync` 同步等待（30 秒）后释放任务；地址按 find_type 0 精确匹配官方语义（火山 VIP高级功能测试 实例同款用法）。本族命令走 FBro VIP 授权门禁：无有效 FBro VIP Key 时返回 0 并中文提示，不得放行。窗口 `创建完毕` 内不得调用 `FBro_导航`（浏览器未就绪）；需要导航时先绑定 `浏览器创建完成` 事件、在完成处理器内配置替换并导航。
- **FBro 非 VIP 响应正文查找替换（2026-09-09 落地）**：`FBro_替换资源响应文本(控件名, 查找内容, 替换内容)` 与 `FBro_清除资源响应文本替换(控件名)` 走非 VIP 通道（桥接导出 `LB_FBro_ResourceReplaceSet/Clear`，继承官方 `FBroHsResponseFilter` 并经 `FBroHsResponseFilter_Create` 安装，与火山「资源篡改实例」同款路径），不需要任何 FBro VIP 授权。语义：对配置之后开始加载的全部资源正文按 UTF-8 字节流式查找替换（二进制安全、跨块匹配、查找内容不能为空、替换内容为空表示删除、上限 64MiB），只改正文不改响应头和状态码；重复调用以最后一次为准，正在传输中的资源沿用其安装时的配置。与 `FBro_读资源响应正文` 同请求并存时，正文捕获记录的是服务器原始正文。AI 生成示例时：`创建完毕` 内先绑定 `浏览器创建完成`、下发替换配置，并在创建完成处理器内再导航；不得在 `创建完毕` 内直接 `FBro_导航`（浏览器未就绪会静默失败）。
- **FBro 四火山工程缺口封装（2026-09-09 落地，bridge 2.7.0 / 模块 `135.0.21.2.7.0`）**：对照火山「VIP指纹测试 / VIPWebsocket拦截测试 / 同步辅助类及填表测试 / DOM填表实例」四工程补齐 32 条命令与 13 个事件。①WS 拦截闭环：`FBro_绑定事件` 可绑定「初始化WebSocket客户端创建/连接/关闭/消息/发送」五事件（回调载荷 `websocket` 为受管 wssClient 句柄、`data` 为受管缓冲；消息/发送/连接为同步事件，响应 JSON 可写回篡改——`url`/`protocols`（Base64 编码的 UTF-8）/`data`（Base64）+`size`，缺省不写回即原样放行，与火山示例语义一致）；开关走 `FBroVIP_浏览器指纹_设置启用WebSocket客户端钩子(控件名, "1")`；`FBro页面_发送文本/发送缓冲/客户端发送文本/客户端发送缓冲(控件名, 通道名, …)`（底层 `FBroHsSocketServer/Client_SendByBrowser`，UTF-8 传输）把数据按通道名回传页面；`FBroWS客户端_是否空/取地址/取协议/取扩展/发送文本/发送缓冲` 操作拦截事件下发的 wssClient 句柄。②本地服务器全部 8 个回调转公开（本地服务器服务器已创建/已销毁/客户端已连接/客户端已断开/WebSocket已连接/WebSocket消息到达/WebSocket握手请求/HTTP请求到达），经 `FBro服务器_创建(控件名, 监听地址, 端口, 最大连接数)` 派发给创建者浏览器实例，`握手请求` 默认放行、处理器返回取消动作时改 Cancel；事件中的 server/request 句柄与数据缓冲须用 `FBro对象_释放`/`FBro缓冲_释放` 释放。③DOM 遍历快照：`FBro框架_遍历DOM(框架句柄, 最大深度, 最大节点数)`（0 用默认 16/4000）返回受管快照句柄，`FBro遍历_取标题/取基础地址/取节点数/取节点类型/取节点路径/取节点名称/取节点值/取节点内部文本/取节点属性数/取节点属性名/取节点属性值/取节点属性/取焦点节点路径/按路径取序号` 读取，`FBro遍历_按路径设属性/按路径赋值` 按路径 JSON（如 `[0,2]`，从 Body 起子序号）写回；另有 `FBro右键参数_取类型标志`。官方 `VisitDOM` 回调在浏览器进程宿主不派发（CEF 语义仅渲染进程可调），实现为页面内 JS 序列化（桥内保留官方 visitor 参考实现；`FBroHsDOMNode_GetElementAttribute` 由受管快照查找等价）。注意：`ExecuteJavaScriptToHasReturn` 的结果投递在复杂页面有约 60 秒量级延迟且偶发超时，遍历等待上限已放宽到 150 秒，AI 不得宣称重页面遍历即时返回。④运行时独立上下文：`FBro会话_创建上下文(设置JSON)`（cachePath/persistSessionCookies/acceptLanguageList/cookieableSchemesList/cookieableSchemesExcludeDefaults）返回任务，结果含 context 句柄；`FBro会话_使用上下文重建(控件名, 上下文句柄)` 先 TryCloseBrowser 再原地换上下文重启（指纹多 profile 场景）；`FBro_取主浏览器(控件名)` 返回弹出窗口所属主浏览器实例句柄。`FBroHsDOMNode_GetLastChild` 仍为 planned（快照模型无存活节点，按路径定位等价）。新命令仅进程内模式可用。本批同时修复既有 wrapper 的运行时比较错误：`LB_FBro_TaskWait` 成功返回 `LB_FBRO_OK(0)` 而非 `LB_FBRO_TASK_COMPLETED(2)`，全部任务等待比较已改为 `== LB_FBRO_OK`（此前批次 3/7 的填表取值/取坐标/取源码/取文本/服务器创建等 wrapper 会在运行时把成功误判为失败）。
- **FBro 环境 SDK 已升级到火山版正式版 5.39.53（2026-09-09）**：chromium 与 CEF 版本不变（135.0.7049.115 / 135.0.21），`SDK_VERSION` 保持 `135.0.21`；官方头 77→73（删 FBroClientBase/FBroExtension/FBroExtensionHandler/FBroRenderHandler），覆盖目录签名族 1079→1071（已实现 397 不变，事件目录不变）；bridgeVersion 2.5.0，模块版本 `135.0.21.2.5.0`，归档 `lingbuilder-fbro-sdk-135.0.21.2.5.0-windows-x64.zip`（473 文件）。生成/覆盖脚本 `DEFAULT_SOURCE` 已指向工作区稳定源树 `.lingbuilder-build/fbro-official-5.39.53/FBrowser`（junction）；禁止再把 `T:\编程工具\...` 漂移目录当权威源。
- Bridge 延续超时由单一受管计时线程维护，到期后移除句柄并投递回 CEF UI 线程；不得在 FBro 多线程模式下依赖不会执行的 UI delayed task。正常关闭必须先取消所属浏览器的未完成延续、隐藏最后窗口并保留宿主 HWND/消息泵等待 `OnBeforeClose`，5 秒后才允许安全 fallback。FBro 5.38.49 的可视 Basic Auth 登录 UI 未按预期经过 `FBroHsBroEvent::GetAuthCredentials` override；AI 不得声称该弹窗已有真实回调 smoke，也不得生成或索要不存在的测试账号密码。
- Chrome UI 创建返回的实例 ID 与内嵌控件状态隔离；导航、查询事件、绑定和关闭必须针对相应实例，不能用最后一个 popup 覆盖所属内嵌实例状态。普通 Win32 和 New_Emoji 必须共用同一事件协议。
- FBro 2.4 核心现有 86 条高层命令。浏览器状态、缩放、静音、焦点、页内查找和 DevTools 状态/关闭必须使用对应 `FBro_` 命令；忽略缓存刷新、浏览器标识、实例比较、popup/文档/视图状态、关闭协商和自动尺寸也已有 `FBro_强制刷新`、`FBro_取浏览器标识`、`FBro_是否同一实例`、`FBro_是否弹出窗口/是否有文档/是否有视图`、`FBro_尝试关闭` 与 `FBro_设置自动调整大小`。独立进程状态、PID、CDP 调试端口、重启、显隐、大小、截图和下载视图使用对应 `FBro_` / `浏览器管理器_` 命令；不要用 JavaScript 模拟这些已存在的宿主 API。尚为 `planned` 的覆盖目录项不得生成伪命令或宣称可运行。
- CDP 调试端口两种宿主模式都可用且都受 `enableDevTools` 控制：独立进程由 Host 按 `enableDevTools` 预留；进程内模式在生成程序初始化 FBro 运行时时，按项目内进程内控件的 `enableDevTools` 属性（缺省启用）决定是否预留回环端口并经 `LB_FBro_InitializeEx` 的 `remote_debugging_port` 启用——任一进程内控件启用即开启，全部关闭则不预留。CEF 调试端口只在初始化时生效、无法事后补设或关闭，因此没有也不允许出现运行时设置/关闭端口的命令。`FBro_取调试端口` 对两种模式都返回真实端口，返回 0 表示尚未初始化、未启用开发者工具或端口预留失败；新代码不得再假设「进程内模式没有可连接的调试端口」。端口只在本机回环使用。
- **FBro JS 交互（cefQuery）与 data: URI 本地建页（2026-09-12 落地）**：页内脚本经 `window.查询函数名({request,persistent,onSuccess,onFailure})` 调原生、`window.取消函数名(id)` 取消（CEF cefQuery 消息路由，火山 `FBrowser_JS交互_注册` 同款）。注册必须在 FBro 运行时初始化之前——CEF 多线程消息循环下 `OnContextInitialized` 远早于「创建完毕」事件，`.lcpp` 运行期调 `FBro_启用JS扩展` 必然返回 -5，因此窗口程序一律使用 **FBroBrowser 控件属性 `jsQueryFunctions`**（格式 `查询名,取消名`，分号分隔注册多条通道，如 `cefQuery,cefQueryCancel;cefQuerytest,cefQueryCanceltest`），生成器在 `LB_FBro_InitializeEx` 前逐条调 `LB_FBro_EnableJsQuery`；设计器属性面板提供同名「JS 交互函数」结构化弹窗（`FbroJsQueryEditorDialog`，多通道增删改/上下移/标识符合法性与唯一性校验/生成期注册与页面调用实时预览），保存回写控件属性字符串，项目保存时才落盘 `window-designer.json`（属性编辑只更新内存+localStorage）；桥内按查询函数名去重、同名幂等，全部通道共用同一个 `BridgeQueryHandler`（CEF OnQuery 不携带函数名、FBro 把先注册的处理器放在分发链首，处理器无法区分来源通道，火山「即将查询」同样没有通道参数，AI 不得虚构 channel 字段）。`.lcpp` 侧用 `FBro_绑定事件(控件名, "OnQuery", &处理器)` 绑定，处理器内 `FBro_取事件字段(控件名, "request")` 读请求、`FBro_取事件延续` + `FBro事件_完成延续(句柄, "{\"success\":true,\"result\":\"...\"}")` 应答（120 秒超时自动 Failure(-4)）；`OnQueryCanceled`（火山「即将取消查询」）当前未 override、不派发给 .lcpp。本地 HTML 免服务器建页：`FBro工具_创建数据URI("text/html", 页面文本)` 生成 data: URI 后交给控件 url 属性或「浏览器创建完成」处理器内 `FBro_导航`（火山 `FBrowser_Parser_取数据URI` 等价）；生成结果缓冲上限 64K 宽字符，超大 HTML 必须改走本地文件。`.lcpp` 字符串内嵌 HTML/JS 时，含半角双引号的内容必须写成中文引号字符串 `“...”`（内容原样保留），ASCII 串内的 `\"` 会被当成字面反斜杠+引号输出。
- **FBro JS 交互延后应答 + 线程_提交完成 组合（2026-09-12 实测，进阶方案示例 `AI 视频自主生产/进阶方案/JS交互不阻塞/示例项目/fbro-async-jsquery/`）**：OnQuery 是延后决策事件，等价火山 C# 非阻塞方案（`IFBroSharpQueryCallback` 存引用异步 Success/Failure）——处理器内只做「`FBro_取事件字段` 读请求、`FBro_取事件延续` 取句柄存全局、发起异步、立即返回」，**绝不在处理器内做 `FBro任务_等待`、`线程_协作等待` 等任何同步等待**（OnQuery 跑在 UI 线程，同步等待会冻结界面和 CEF UI 线程，即 C# 文档的错误示例）。耗时应答组合：`线程_提交完成(&工作处理器, &完成处理器, 参数…)` 把等待放工作处理器（如 `线程_协作等待(3000)` 模拟耗时计算），完成处理器回到发起窗口 UI 线程后用存好的句柄 `FBro事件_完成延续` 应答；工作处理器返回 `文本型` 时完成处理器签名为 `(线程任务 任务, 文本型 结果)`。原生执行页面 JS 并回传（对应 C# 方案1 ExecuteJavaScriptToHasReturn）：OnQuery 内当场发起 `FBro自动化_执行JS异步`（必须在 UI 线程发起，发完立即返回；桥实测工作线程提交结果不派发），工作处理器里 `FBro任务_等待` + `FBro任务_取结果` + `FBro任务_释放`，完成处理器完成延续。三条硬边界：① `FBro任务_等待` 返回**等待操作结果码**——完成是 `1`（`LB_FBRO_OK`），失败/取消/超时是负数错误码，不得与任务状态枚举（`LB_FBRO_TASK_COMPLETED=2`）比较，否则任务成功也被判空；② `ExecuteJavaScriptToHasReturn` 类命令在复杂页面结果投递有约 60 秒量级延迟，工作处理器等待上限应覆盖它（示例用 90 秒，仍在 120 秒延续窗口内），极简 data: URI 页实测毫秒级返回；③ 延后句柄是单槽位全局变量，同时第二条耗时查询会覆盖槽位、被覆盖的延续 120 秒后自动 Failure(-4)，要支持并发须改数组/池按请求分槽。涉及时序的延续句柄必须「局部声明置零 + 原位赋值」分离书写（带初始化的局部变量声明会被提升到方法最前）；注入页面 JS 含逗号等复杂内容时用 `eval(atob('…'))` 且载荷只用 ASCII（atob 注入中文必乱码）。
- **FBro 全幅网页 UI 无边框窗口（cefQuery 应答拆包语义 + 窗口外壳操作，2026-09-13 实测，进阶方案示例 `AI 视频自主生产/进阶方案/高颜值应用商店/`）**：浏览器控件铺满 `borderStyle:none` 窗口，标题栏/窗口控制全部由网页绘制。① **应答拆包**：桥把 `FBro事件_完成延续(句柄, 响应JSON)` 的响应拆包后才交给页面——响应含 `"success":true` 时页面 `onSuccess` 只收到 **`result` 字段的文本**（没有该字段就是空串！），含 `"success":false` 时走 `onFailure(errorCode, error)`；因此载荷必须包成 `{"success":true,"result":"<转义载荷>"}`（用 `JSON_转义文本` 转义内层 JSON），页面拿到 `result` 后自行 `JSON.parse`。② **窗口外壳**：用 Win32窗口操作模块（2026-09-13 新增 `窗口_开始拖拽`/`窗口_开始边缘缩放(10..17)`/`窗口_是否最大化`/`窗口_取边界JSON`）进入系统移动/缩放循环，主窗句柄用 `窗口_按标题查找(窗口标题)` 取（`FBro_取父窗口句柄` 在部分场景返回无效句柄，勿单独依赖）；关闭必须**延迟**（工作线程 `线程_协作等待(200)` 后再 `结束()`），在查询回调栈里同步 `结束()` 会让进程在 CEF 关停时挂死。③ 页面 8 向拉伸热区/标题栏的 `mousedown` 经 cefQuery 发 `win.drag`/`win.resize`，最大化状态以每次 `窗口_是否最大化` 的返回为准。
- `lingbuilder.fbro.objects` 已提供 132 条高级命令，覆盖任务、缓冲、Value、Dictionary、List、Binary、StringList、Stream、Image、X509Certificate、X509CertPrincipal 与 DragData。AI 只能保存返回的长整数句柄；线程绑定对象必须在所属线程使用，Image/Certificate/Principal/DragData 是 Bridge 持有的不可变跨线程安全句柄。嵌套对象由父句柄管理，父对象释放后其借用/交付的子句柄会返回 `-7`，不得继续访问。二进制、PNG/JPEG、DER/PEM 通过 `FBro缓冲_*` 传递，JSON 结果保持 UTF-16；不得猜测句柄、转换成地址或生成裸指针/STL/CefRefPtr。错误类型句柄返回 `-8`，重复释放返回 `-7`。图像使用 `FBro图像_异步下载` → `FBro任务_等待` → `FBro任务_取对象` 生产，当前页面证书使用 `FBro证书_异步取当前` 生产；事件中的 Certificate/DragData 使用 `FBro_取事件对象` 读取。任务、对象和缓冲均须在用完后调用对应释放命令。
- FBro WS 拦截五事件（初始化WebSocket客户端创建/连接/关闭/消息/发送，2026-09-11 已落地）：官方在渲染进程触发这五钩子，因此生成 exe 兼任 CEF 子进程（火山同款架构）——`browser_subprocess_path` 指向生成 exe 自身（`LB_FBro_InitializeEx` 的 `use_self_subprocess` 选项），wWinMain 最先调用 `LB_FBro_RunCefSubprocessIfRequested`，`--type=` 子进程由桥进入 FBroHsInitPro 子进程流程并注册 BridgeInitEvent；渲染侧五钩子事件经命名管道中继回浏览器进程派发 .lcpp 处理器，篡改响应原路带回渲染进程写回。AI 编写示例/口播时须知：事件 fields 附带 `text`（消息载荷可 UTF-8 解码时）与 `websocket`（渲染侧句柄，位 30 偏见标记，只能传回给 `FBroWS客户端_取地址/取协议/取扩展/是否空` 做远程查询，句柄文本超 32 位必须用字段原文，禁止 `到整数` 截断）；连接事件的地址直接读 `url` 字段；篡改写回用 `FBro_设置事件响应JSON(控件名, "{\"text\":\"新内容\"}")`（服务端换算 data+size），消息/发送返回真=拦截、连接改写 `url`/`protocols` 后原地址不再访问。不得在钩子事件处理器里调用 `FBroWS客户端_发送文本/发送缓冲`（远程句柄不支持且可能死循环）。事件通道是每请求短连接严格锁步；诊断冻结/不触发时看 `.lingbuilder-build/fbro-cb-debug.log`（HookProbe pid+role+stage 时间线），实验开关 `LINGBUILDER_FBRO_RELAY_DISABLE`（直通）、`LINGBUILDER_FBRO_HOOK_DISABLE`（不启用钩子）、`LINGBUILDER_FBRO_PLAIN_RENDERER`（渲染裸事件类）。独立进程（Host）模式五事件转发未接通，勿在口播/示例中演示。**官方 SDK 升级核对清单**：只依赖 FBroHsInitPro/五虚函数/EnableWebsocketClientHook/FBroHsWSSClient_* 公开契约与三条行为假设（五钩子渲染进程触发、FBroHsInitPro 子进程自循环、缺省不写回放行），升级后重跑 ep15 冒烟甄别；禁止 proxy DLL/patch 官方二进制。
- `lingbuilder.fbro.automation` 已提供 25 条命令。Frame 必须先通过 `FBro框架_取主框架/取焦点框架/按标识取框架/按名称取框架` 取得类型 16 的受管句柄，再读取属性或执行编辑、载入、脚本操作；标识和名称列表是 UTF-16 JSON。不得把框架句柄当地址，不得生成 `CefFrame`/`CefRefPtr`，使用结束后调用 `FBro对象_释放`。`取源代码/取文本/VisitDOM/V8` 尚未接通时不得伪造命令。
- `lingbuilder.fbro.session` 已提供官方 CookieManager 的异步遍历、设置、删除、持久化刷新和实例/全局缓存清理。AI 必须保存任务 ID，先调用 `FBro任务_等待`，再单独调用 `FBro任务_取结果` 或 `FBro任务_取错误`，最后释放任务；不要在同一个函数实参列表中同时等待并取结果，因为 C++ 实参求值次序不保证符合源码书写顺序。Cookie 遍历结果为 UTF-16 JSON 数组，不得生成 RequestContext、CookieManager、Cookie 指针或直接调用 CEF API。全局缓存清理只在用户明确要求且启用专业模式时使用。

- FBro 的“即将打开新窗口”事件必须由桥接层同步取消原生 popup，并把目标 URL 作为事件数据投递给 `.lcpp`。需要单窗口浏览时调用 `FBro_导航(控件名, FBro_取最近事件(控件名))`；需要谷歌原生 UI 时调用 `FBro_打开谷歌原生UI浏览器(控件名, FBro_取最近事件(控件名))`。不得依赖脚本 `window.open` 绕过受管生命周期。
- `FBro_打开谷歌原生UI浏览器` 必须通过 `LingBuilderFbroBridge` 在 CEF UI 线程创建 `CEF_RUNTIME_STYLE_CHROME` 顶层窗口，调用方不传入或复用 LingBuilder 的 `HWND`：`parent_window` 与预置 `window` 均为空，使用 `WS_EX_APPWINDOW` 和 `WS_OVERLAPPEDWINDOW`。这里的“无窗口句柄”是指 API 不接收宿主句柄；Chrome Runtime 创建后仍会拥有由其自行管理的系统顶层 `HWND`。原生 UI 句柄必须与所属内嵌实例分开登记，并在主窗口关闭时一并关闭。
- 浏览器式窗口的自适应布局应在窗口“大小被改变”事件中读取 `窗口_取事件宽度/高度`，再调用 `控件_设置位置大小(控件名, 横坐标, 纵坐标, 宽度, 高度)` 调整地址栏、导航按钮和浏览器宿主。浏览器宿主变化后必须同步刷新其内部浏览器子窗口大小。

- FBro 模块 ID 固定为 `lingbuilder.fbro.browser`，设计器控件类型为 `FBroBrowser`。AI 可以把它放入可视化窗口，但必须让每个实例保留独立宿主 `HWND`、控件 ID 和 profile/cache 目录。
- 固定数量的 new_emoji ListBox 多浏览器界面必须用 `listBoxItemsEx` 的稳定 key 建立显式映射，并在 `SelectionChanged(文本型 选中键列表)` 中调用 `FBro_隐藏` / `FBro_显示` 切换裸 `controlRef`；每次选择后只能有一个浏览器宿主可见，切换不得销毁实例或共享缓存目录。三个固定实例的完整示例位于 `src/new-emoji-fbro-listbox`。需要动态增删或数量不固定时，必须改用 `lingbuilder.new_emoji.fbro-shell` 的稳定 ID 集合，不得无限堆叠固定 `FBroBrowser` 控件。
- `FBroBrowser.properties.processMode` 只允许 `in-process`、`independent-embedded`、`independent-window`。缺省值为 `in-process`；独立嵌入模式由每个控件自己的 Host 进程创建浏览器并把顶层内容窗口嵌入设计器宿主，独立窗口模式由 Host 创建可移动的桌面顶层窗口。AI 不得用这三个值以外的字符串，也不得把“谷歌原生 UI”命令与独立进程窗口属性混为同一个生命周期。`independent-window` 宿主顶层窗口是否显示只跟随该控件在设计器里的可见性，控件隐藏时绝不弹出桌面窗口；独立进程握手在 `WM_CREATE` 内同步等待 `就绪`，每个实例最多阻塞界面线程 15 秒，因此生成的演示代码必须在控件的「创建完毕」事件里再读状态或导航，不得假设窗口一启动就在屏上。
- FBro 只支持 Windows、MSVC、x64；启用它时应切换并锁定 x64。`in-process` 会把 CEF 135 加载到应用进程，因此与 `lingbuilder.cef3.browser` 的 CEF 150 互斥；只有项目中全部 FBro 控件均为两种独立进程模式时才允许二者共存。共存时主程序目录保留 CEF3 运行时，FBro CEF 135、Bridge 和资源只能物化到 `fbro-host/`，不得复制或重命名到主 exe 目录。
- FBro 独立进程控制面只能监听随机本机回环端口，使用一次性 256 位 Token 鉴权；Token 只通过 Host 子进程环境传递，不得进入命令行、设计器模型、日志、AI 上下文或固定配置。控制器必须维护浏览器实例 ID、Host PID、WebSocket 连接和进程代次映射，拒绝旧代次连接/事件；不得固定端口或开放外部监听。
- 独立模式当前覆盖创建、导航、前进后退、刷新、执行 JS、缩放、静音、代理、指纹、显隐、调整大小、截图、关闭和进程状态。高级 Frame、Cookie、受管对象、任务及 VIP 单项 API 仍以进程内 Bridge 为主，AI 不得在独立模式下宣称它们已经全部远程化；需要这些接口时应改用进程内模式，或明确说明尚需扩展 WebSocket 协议。
- 独立 Host 异常退出后只能按 1/2/4 秒退避，并限制十分钟最多自动重启三次；主程序关闭时必须通过 Job Object 和正常关闭协议回收全部 Host。不得生成无限重启循环、遗留浏览器进程或复用其它实例的 profile/CDP 端口。
- 生成程序只能调用 `LingBuilderFbroBridge` C ABI；不得让用户项目直接持有 `CefRefPtr`、FBro C++ 对象、STL ABI 或桥接层分配的裸指针。
- 指纹配置使用结构化 JSON。每位 IDE 用户在“设置 → 浏览器凭据”中自行保存 VIP Key，主进程必须用 Electron `safeStorage` 加密；renderer 只能读取配置状态，不得回读现有明文。F5、原生运行和新启动的 AI Bridge 仅通过受控子进程环境临时注入，`LINGBUILDER_FBRO_VIP_KEY` 只作为无人值守/导出工程的兼容后备。不得保存到 `.lcpp`、设计器模型、项目文件、模块包、日志、AI 上下文、同步包或安装包。无 Key 时允许基础浏览器运行；错误 Key 必须返回脱敏的中文授权失败诊断，不得回显 Key。
- FBro 生成程序正常退出时必须先请求关闭各浏览器，调用 C++ SDK 的 `FBroShutdown(FALSE)`，等待 `OnBeforeClose` 后再释放桥接对象；不得用强制结束进程替代关闭协议。
- FBro 的 SDK/运行时由统一原生依赖服务物化；桌面 IDE 遇到 `SDK_DEPENDENCY_REQUIRED` 时可由用户确认后按需下载到共享缓存，AI Bridge/CLI 不得静默下载。AI Bridge 构建与导出不得另写复制旁路，也不得压平 `locales/` 等目录。
- SDK、桥接 DLL、导入库、运行时清单或哈希校验失败时必须在生成/编译前阻断，不能把缺少 `LingBuilderFbroBridge.h` 的 `__has_include` 降级结果当作可运行浏览器。工作区根目录必须从 `.lingbuilder-build` 标记目录定位，不能假定构建配置只有固定层级；可复制 VS 导出必须包含完整 FBro runtime 与增量脚本。
- FBro 浏览器只能由桥接层在 CEF UI 线程创建，已就绪实例必须通过 `CefPostTask(TID_UI, ...)` 投递，不能从生成窗口的 Win32 主线程直接调用 `FBroHsCreate`。每控件 profile 必须映射为 `.fbro-global-cache` 的直接子目录；不得生成会触发 `cache_path`、`root_cache_path` 或 `Cannot create profile` 的兄弟目录/多层目录后接受内存模式降级。
- FBro 宿主窗口的 `WM_SIZE` 处理不得阻塞等待 CEF 创建锁；锁被占用时应跳过本次内部调整。调整浏览器尺寸只能移动宿主的直接子 `HWND`，禁止用 `EnumChildWindows` 递归移动 Chromium 内部后代窗口。
- FBro 导航栏随窗口缩放时，后退、前进、刷新、地址栏、导航按钮和浏览器宿主必须在同一个大小改变事件内统一使用 `窗口_取事件DPI()` 换算坐标与尺寸，不得混用初始 DPI 缩放坐标和未缩放的固定像素。
- FBro 传输功能必须使用 `FBro传输_异步生成PDF`、`FBro传输_异步打开文件对话框`、`FBro传输_异步截图` 返回任务 ID；任务通过 `FBro任务_取结果` 读取 UTF-16 JSON，截图通过 `FBro任务_取缓冲` 取得受管缓冲并显式释放。FBro 5.38.49 的官方文件对话框辅助导出已确认会阻塞 CEF UI，高层命令固定使用独立 STA Windows `IFileDialog`，不得重新切回该 SDK 辅助入口。不得向 `.lcpp` 返回文件列表、图像字节或 SDK 回调对象的裸指针。截图属于 VIP 能力，未配置或错误 Key 时应显示脱敏任务错误，不得伪造成功或记录 Key。

## new_emoji 控件属性与事件规则

- AI 配置 `lingbuilder.new_emoji.ui/ListBox` 时，普通逐行文本只写入 `properties.items`；只有需要 key、parent_key、group_key、text、value、icon、desc、tag 等 TSV 高级字段时才写 `properties.listBoxItemsEx`，不得把简单项目机械复制到高级项目。空高级项目、空 `selectedKeys` 和 `virtualItemCount=0` 表示不启用对应覆盖模式，生成器不得调用会重置项目或选择状态的 Setter。只有真实虚拟数据源场景才设置正数 `virtualItemCount`。
- AI 使用 `lingbuilder.new_emoji.ui/Tabs` 时，必须把它视为带独立页面槽位的分页容器，不是可任意拉高的标签导航条。标签页由稳定页面 ID 和标题组成，页面内控件必须保存对应 `containerSlot`；不得把全部子控件直接放到 Tabs 根级，也不得生成 `contentVisible=false`。原生生成由 LingBuilder 创建每页无边框、0 圆角的独立 Panel、把 `ItemsEx` 内置内容字段设为空白并调用 `EU_SetTabsPageElements`；AI 不应手写字符串形式的页面元素 ID、保留 Tabs 自绘内容或绕过设计器页面模型。
- AI 生成 new_emoji 窗口时，可以使用模块目录公开的全部属性和事件；当前 92 个控件共 698 个属性、902 个事件均具有确定性运行时映射。
- 设计器「显示内容」（通用 `content`）对目录控件的落地分两类：创建导出带文本参数的控件（如 Button 的 `text_bytes`）在创建时写入；创建导出不带文本参数的控件（如 `EU_CreateEditBox`）由模块清单 `contributes.designerControls[].runtime.applyContentCommand` 声明创建后的文本应用命令（ABI 固定 `hwnd, element_id, bytes, len`，EditBox 声明为 `EU_SetElementText`）。生成器在创建行之后发射 `LB_NE_ToUtf8` + 该命令；`content` 为空或未声明时不生成。2026-09-15 起旧的「编辑框显示内容运行后为空」即此缺口，已修复并实测。新增目录控件若创建函数不携带文本参数，必须同步在其 runtime 声明 `applyContentCommand`，不得让设计器填写的显示内容静默丢失。
- 按钮可设置鼠标经过背景/边框/文字色和按下背景/边框/文字色。通用事件包括 `MouseEnter`、`MouseLeave`、`MouseDown`、`MouseUp`、`MouseDoubleClick`、`MouseMove`、`MouseWheel`、`GotFocus`、`LostFocus`。
- Upload 事件名固定为 `FilesSelected` 与 `UploadAction`，不得生成旧的 `FileSelected` / `Action`。
- new_emoji 新事件绑定必须保存模块目录的规范事件名；读取旧项目时允许通过模块清单 `aliases` 把通用预览事件键映射到规范事件，例如 `Click` 映射为 `Clicked`。只要设计器已有处理器名，F5/导出就必须生成对应原生回调注册，不能因事件键差异静默丢弃 `_按钮1_被单击` 等处理器。
- 属性和事件必须由模块清单的结构化 runtime 映射进入生成器；不得在 React 组件中模拟效果，也不得调用没有真实 DLL 导出或确定性生成规则的伪命令。

## AI 凭据、索引与同步安全

- AI API Key 只能通过 Electron 主进程 `safeStorage` 保存；不得写入 localStorage、工作区文件、AI 索引、日志、提示词或设置同步包。
- 管理后台配置的“系统 AI”供应商密钥必须由云端 `SecretVaultService` 加密保存，管理端只允许读取 `secretConfigured` 状态，不能回显、记录或下发明文 API Key；管理员更新供应商时留空密钥表示保留已有密钥。
- DeepSeek V4 云端预设固定建立 `deepseek-v4-flash` 与 `deepseek-v4-pro` 两条系统模型路由，使用 OpenAI 兼容协议，并将官方文档规定的同名模型 ID 直接作为上游 `model` 参数；当前版本别名与上游 ID 必须保持一致。自定义系统 AI 供应商必须明确选择 OpenAI 兼容或 Anthropic Messages 协议，并提供公开 HTTPS Base URL 与真实 Model Name；不得绕过现有 URL 安全校验、模型路由、计费、审计和熔断链路。
- 工作区 AI 索引只允许包含工作区内受支持文本源码的相对路径、内容哈希、短预览和有界词项；必须跳过符号链接、依赖目录、生成目录、构建目录和超大文件。
- 索引构建和 AI 请求必须可取消；取消后不得发布部分索引或迟到应用编辑结果。
- 设置同步必须递归剔除 API Key、token、secret、password、credential 等敏感字段；导入必须先预览并复检文件令牌，批量失败必须回滚。

本文档用于约束 LingBuilder AI 智能编程助手。无论后端接入 DeepSeek、ChatGPT、Claude、Gemini、Kimi 或其他模型，AI 都必须优先遵守本文档规则，再结合当前文件、工作区文件、模块上下文和本地诊断生成建议。

## 1. 产品定位

LingBuilder 是面向中文用户的中文集成开发环境。它不是简单的代码翻译器，而是以中文界面、中文命令、中文模块、中文诊断和中文代码体验为核心的 IDE。

AI 的职责是增强开发体验，包括编写代码、修改代码、解释报错、新建或补全项目结构、辅助模块调用和生成可审查的修改方案。AI 不能替代本地确定性规则，不能绕过 IDE 的解析、诊断、模块和生成链路。

## 2. .lcpp 中文代码基本规则

`.lcpp` 是 LingBuilder 的中文 C++ / 类易语言 DSL 源文件。AI 修改 `.lcpp` 时必须保持现有语法风格，优先保留用户已有结构和命名。

常见结构包括：

```text
包 示例项目
使用 Win32窗口基础模块
使用 网页访问模块

类 主窗口 : 窗口
公开:
  文本型 标题 = "示例窗口"

  构造()
    调试输出("窗口初始化")
  结束

  事件 按钮1_被单击()
    局部 文本型 url = "https://example.com"
    局部 字节集 ret
    ret = 网页_访问_对象(url, 0)
  结束
结束类
```

大型项目中的重复逻辑可拆为独立功能库文件：

```text
功能库 文本工具
公开:
  文本型 合并(文本型 前缀, 文本型 内容)
    返回(前缀 + 内容)
  结束
私有:
  空 内部记录()
    调试输出("仅库内使用")
  结束
结束功能库
```

窗口或其他功能库必须使用限定名称调用：`文本工具.合并("前缀", "内容")`。一个 `.lcpp` 文件只能声明一个功能库，默认文件名与功能库名一致；**把大批量创建代码按分类搬进功能库时还要注意生成器的局部变量提升**：带初始化的「局部 X = 表达式」会被提升到方法最前，若该表达式依赖功能库调用创建的控件（例如 `通过标记文本获取NE面板("页_…")`），查找会早于创建执行、引用退化为 0，随后的 `NE_EU_SetElementVisible(当前窗口, 该引用, 0)` 等价于隐藏元素 0，会把整个窗口内容隐藏（实测整窗全黑）。此类初始化一律「先声明后赋值」：先写 `局部 NE面板 IN00`，再单独一行 `IN00 = 通过标记文本获取NE面板("页_…")`。功能库函数的参数可以直接声明为 `NE容器`/`NE面板` 等运行时控件类型并作为 `控件_创建NE*` 的父级实参（生成器按运行时控件引用处理），`当前窗口` 在功能库内同样可用；但功能库内**不能出现 `&处理器名`**，页面内控件的事件绑定必须在窗口类里用 `通过标记文本获取NE按钮/NE链接(...)` 找回控件再绑定。功能库首版无成员状态、事件、构造、析构、重载和默认参数，不接受 `&处理器名` 回调。功能库可以使用当前项目常量、全局变量、自定义数据类型和已启用模块命令，但不能依赖某个设计器窗口的控件名。公开功能可被项目其他文件调用，私有功能只能在同一功能库中调用，内部和递归调用也必须写完整限定名称。行首 `@` 的内嵌 C++ 行不参与功能库调用扫描：`@` 行里的 `X.y(...)`（如原生变量 `提示.c_str()`）是 C++ 成员调用而不是「功能库.功能」限定调用，功能库补全、诊断和 C++ 生成都不得把 `@` 行内容误判为功能库引用，也不能要求用户给原生标识符改名。**同理，`@` 行里的 `&&`、`||`、`&buf[0]`（取地址）、`auto& x`、`x & MASK`（位与）等一律按原生 C++ 处理，不得被判成 `&处理器名` 而报「首版功能库不能把窗口事件处理器作为 &处理器参数传递」**：该阻断只针对中文调用里真正的 `&处理器` 实参。禁止把这类误判转嫁成用户的改写要求（改成 `and`/`or` 替代记号、`std::addressof(变量)`、`(x % 32) >= 16` 之类的“等价写法”都是绕过缺陷的权宜，不得写进示例、文档或 AI 建议；复合掩码的位与更没有可靠等价式，遇到位运算需求就让 `@` 行原样生成，或改走模块命令）。

功能库实测口径（外部工程 505 行拆分复验，2026-09-18）：① 库名与文件名的一致性比较按**磁盘真实大小写**（只统一 `/` 与 `\`），`Cookie导出.lcpp` / `PASSID内存.lcpp` 这类「ASCII 段 + 中文」文件名不得因路径小写化被误报「与文件名不一致」，返回给 AI 的功能库 `filePath` 同样保留真实大小写；② `@ { ... }` 块内声明的 C++ 变量**出块即失效**，需要在多个 `@` 块或 `.lcpp` 循环体之间共享的值，必须在函数作用域用单独一行 `@` 先声明；③ 在循环里复用一大段 C++ 的正规做法是**函数作用域 lambda**（`@ auto 工具 = [](std::wstring 值) { ... };`，多行大括号可以），之后在循环体内用 `@ 变量 = 工具(参数);` 调用，不需要为此新建功能库或内联复制；④ 生成器只为 `.lcpp` **实际调用过**的模块命令生成运行时代码，所以若某命令只在 `@` 里手写调用，必须先让 `.lcpp` 正常调用一次（哪怕在不会执行到的分支），否则链接期找不到符号。

普通窗口子程序和功能库功能都可以声明类型化参数，例如 `整数型 相加(整数型 左值, 整数型 右值)`；数组参数使用类型后缀语法，例如 `空 批量处理(整数型[] 编号集合)`，不要写成普通标量或字符串模拟数组。调用时必须按签名传入实参，例如 `相加(2, 3)` 或 `文本工具.合并("前缀", "内容")`。新手模式新增功能/自定义事件时应先填写参数，再点击“新增”；右键新增的默认子程序展开后也必须通过参数表的“新增”行补充参数，参数表“数组”开关负责为类型写入或移除 `[]`。子程序补全会按参数签名生成实参。事件处理器参数仍必须符合对应设计器事件契约。

跨项目复制功能库必须通过项目树“复制功能库 / 粘贴功能库”执行，不要让用户手工逐个猜测依赖。粘贴预览会递归解析间接功能库、嵌套项目数据类型、项目常量/全局变量初始化链和模块依赖；相同定义复用，间接功能库重名时创建唯一副本并同步重写限定调用，不同的同名项目类型或项目符号必须阻止覆盖。确认后，功能库源码、项目资源文件与目标项目模块引用必须进入同一文件事务，不能先写主库再留下半完成依赖。

AI 必须遵守：

- 不要把 `.lcpp` 改成纯 C++、JavaScript、Python 或其他语言。
- 不要删除 `包`、`使用`、`类`、`结束类` 等关键结构，除非用户明确要求。
- `功能库 ... 结束功能库` 与窗口类是两种不同顶层结构，不要用普通 `类` 假装功能库，也不要给功能库添加状态字段。
- 新增方法、事件或成员时，放在合适的访问域内，例如 `公开`、`私有`、`保护`。
- 子程序局部变量使用 `局部 类型 变量名`，可写初始化值和数组标记，例如 `局部 文本型 url = "https://example.com"`、`局部 字节集 ret`、`局部 整数型 结果[]`。局部变量必须位于方法、事件或构造块内，可以按用途写在子程序正文任意位置，并且只属于当前子程序；代码应在声明行之后使用该变量。新手模式在代码光标处按 `Ctrl+L` 可快速插入局部变量，相邻声明显示为一个可折叠组。在完整的未声明赋值语句行末按回车时，新手编辑器会在该语句上方自动声明同名局部变量：字面量、已知变量、子程序和已启用模块命令必须优先用确定性返回类型推断，无法推断时必须让用户选择类型，不得默认猜测。已声明变量、成员属性、注释、原生 C++ 行和不完整表达式不得触发自动声明。不要把临时值误建为程序集变量。
- 子程序内运行时初始化一次、之后只读的值使用 `局部常量 类型 名称 = 表达式`，例如 `局部常量 整数型 最大次数 = 取最大次数()`。初始值必填，禁止显式数组；首版只允许声明在事件、方法、构造或功能库函数的子程序顶层，不能放入如果、循环、选择、尝试等控制块。初始化表达式可以引用参数、成员、项目符号、前面已经声明的局部值、子程序和已启用模块命令，但不能引用自身、未知名称或后置局部声明。局部常量及其字段、索引禁止重新赋值；不透明句柄只保证句柄变量不能重新绑定，不表示冻结外部对象。C++ 必须生成 `T const`，不得生成 `constexpr`。新手“局部声明”表可在变量/常量间转换；转为常量前必须已有初始值且不是数组。`Ctrl+L` 仍只插入普通局部变量，局部常量使用右键菜单或命令面板“新建局部常量”。程序集常量仍未支持。
- 项目常量统一声明在固定文件 `项目全局变量.lcpp` 中，并且必须写在全部项目全局变量之前，语法为 `常量 类型 名称 = 常量值`。首版只支持 `文本型`、`整数型`、`长整数型`、`小数型`、`单精度小数型`、`双精度小数型`、`逻辑型`；不支持数组、控件、对象或模块自定义类型。常量值必须由字面量、纯运算或前面已经声明的项目常量组成，文本常量只使用字符串字面量或前面的文本常量。项目常量在当前项目全部 `.lcpp` 文件中可用，声明后禁止再次赋值，也不能被程序集变量、参数或局部变量遮蔽。需要运行时变化的值必须改用局部变量或项目全局变量。

- 窗口类里的普通子程序和成员变量支持 `静态` 修饰：`静态 整数型 调用计数 = 0` 生成 C++ `inline static`（全程序只有一份，适合跨实例共享计数），`静态 文本型 组装行(文本型 演示点, 文本型 结果)` 生成 C++ static 成员函数。静态子程序不属于任何窗口实例：只能访问静态成员和自己的参数，不能访问设计器控件和非静态成员，也不能调用 `格式化文本`、`调试输出` 等内置命令（它们是窗口基类的非静态成员）。这些误用语言服务不拦、MSVC 编译期报 C2597/C2352；AI 生成静态子程序时应只用运算符和参数做纯计算，需要格式化文本或操作控件时改用非静态子程序。事件处理器不支持静态；功能库功能天生无状态，不支持也不需要 `静态`（写了会得到中文诊断）。
- 基础类型与 C++ 对应关系：`整数型`=int、`长整数型`=long long、`小数型`/`双精度小数型`=double（同一双精度类型的两种写法，**`小数型` 不是单精度**）、`单精度小数型`=float（32 位单精度，英文别名 `float`）、`逻辑型`=bool、`字节型`=unsigned char、`文本型`=std::wstring、`字节集`=std::vector<unsigned char>。注意与易语言的差异：易语言 `小数型` 是单精度 float，本项目 `小数型` 一直是双精度 double；需要单精度（例如第三方 DLL 导出的 float 参数/返回值）必须显式写 `单精度小数型`，float 声明的实数字面量会自动补 `f` 后缀。
- 对变量赋值前必须先声明，赋值表达式的类型必须兼容变量类型。模块命令的 `contributes.commands[].returnType` 与模块类型的 `cppType` 是诊断和 C++ 生成的权威来源；`returnDescription` 用于解释返回值的业务语义。例如 `网页_访问_对象` 返回 `字节集`，应保存到 `字节集` 变量，不能保存到 `整数型`；`网页_异步访问` 返回的是请求编号而不是 HTTP 状态码，`0` 表示异步任务未成功启动。
- 事件处理器名称要与窗口设计器绑定保持一致，例如 `按钮1_被单击`。
- 模块命令中的 `&处理器名` 是当前类无参数事件／方法的可导航引用；新手模式支持 `Ctrl+鼠标左键单击` 和正文右键“转到定义”。字符串中的同名文字不是处理器引用。
- 独立一行的 `结束` 是方法、事件或构造块的结构结束；条件、选择、循环和异常结构使用各自的结束命令。需要退出窗口/程序时使用明确命令 `结束()`，不要把块结束误当成退出命令。
- `.lcpp` 整行注释使用 `// 注释内容` 或 `注释 注释内容`。注释可由结构编辑器保留和显示，但绝不能参与信息框、调试输出、模块命令或控制流的 C++ 生成；临时停用 `// 信息框(...)` 后，F5、原生预览、导出工程和 AI Bridge 构建都不得继续执行该调用。AI 不得通过删除注释前缀或改写成可执行语句来恢复用户已停用的代码。
- 编辑器显示注释时必须使用统一注释色 `LINGCPP_COMMENT_TOKEN_COLORS`（`electron/src/services/lingCpp/semanticTheme.ts`，深色 `#3f8f3f` / 浅色 `#166534`）。新手结构编辑器、专业 Monaco 编辑器、Diff 视图和旧 EPL 编辑器必须共用该令牌，不得再各自硬编码绿色；同一行注释在切换新手/专业模式时不得变色。新手编辑器拆分代码与注释统一走 `splitLingCppLineComment()`（`electron/src/services/lingCpp/beginnerSyntaxPresentation.ts`），它识别整行 `'` 与字符串外的 `//`，并跳过双引号、中文引号和 `\` 转义内的 `//`。注意：**显示**层面已把整行 `'` 当注释，但解析器 `isLingCppCommentLine` 仍只认 `//` 与 `注释`；带 `'` 注释的源码目前会在生成 C++ 时降级为 `// 暂不支持的中文 C++ 语句：'`，AI 不得声称该写法已被生成链路完整支持。
- 内嵌 HTML、JSON、模板等大段文本时使用多行文本块：开始行必须形如 `变量 = """`（行尾恰好是三引号），内容行**原样输出**（引号、反斜杠、`\n` 都不解释、不转义），结束标记是单独一行的 `"""` 且其后不得有内容。一期只支持赋值右部：不能作类型声明初值（`局部 文本型 X = """` 报中文诊断）、不能进命令实参或 `返回`；正确写法是先 `局部 文本型 X` 声明，再单独一行 `X = """` 开始文本块赋值（与局部变量提升口径一致）。文本块内容不透明：块内出现的 `结束`、`如果`、命令名、控件名、功能库调用一律不参与控制流配对、补全、悬停、重命名和后端命令契约扫描；AI 不得把块内文本当可执行代码解释，也不得在重构、格式化或重命名时改写块内内容。生成期确定性折叠为单个 C++ 宽字符串字面量（真实换行转 `\n`）。
- 不支持或不确定的语法要保守处理，可以在说明中提示需要人工复核，不能编造不可执行的新语法。多行文本块（三引号）已被解析、生成与语言服务链路完整支持（见上条与「2026-09-14 多行文本块生成规则补充」），AI 可以直接生成，不属于需保守处理的未支持语法。

## 3. 中文关键字与命令习惯

AI 应优先使用项目已有关键字和命令。常见关键字和命令包括但不限于：

- 结构：`包`、`使用`、`类`、`功能库`、`公开`、`私有`、`保护`、`局部`、`局部常量`、`构造`、`析构`、`事件`、`结束`、`结束类`、`结束功能库`
- 控制流：条件使用 `如果` / `如果真`、`否则如果`、`否则`、`如果结束` / `如果真结束`；多路选择使用 `选择`、`分支`、`默认`、`选择结束`；循环使用 `循环`、`判断循环首/判断循环尾`、`循环判断首/循环判断尾`、`计次循环首/计次循环尾`、`变量循环首/变量循环尾`、`枚举循环首/枚举循环尾`，循环内可用 `跳出循环`、`到循环尾` / `继续循环`；异常处理使用 `尝试`、`捕获`、`最终`、`尝试结束`、`抛出`；子程序提前结束继续使用 `返回`。这些命令均由本地规则确定性生成 C++，新手编辑器会显示与 `如果/否则` 相同的括号流程控制线。AI 不得用原生 C++ `if` / `for` / `try`、`L""` 或删除结构结束标记来规避类型问题。
- 常用命令：`信息框`、`调试输出`、`打开窗口`、`取鼠标水平位置()`、`取鼠标垂直位置()`、显式退出命令 `结束()`。两个鼠标位置命令是默认 Win32 基础模块提供的全局初级命令，返回相对屏幕左边和顶边的像素坐标。
- 已启用 new_emoji 原生界面库模块时，可使用 `NE_创建窗口`、`NE_创建深色窗口`、`NE_创建文本`、`NE_创建按钮`、`NE_创建编辑框`、`NE_创建复选框`、`NE_创建单选框`、`NE_创建列表框`、`NE_创建图片`、`NE_创建进度条`、`NE_运行消息循环` 等桥接命令。
- 普通 Win32 工具箱不再提供固定外观的 `Upload` / `DragUpload` 控件。文件选择统一使用内置 `lingbuilder.win32.common-controls` 的 `FileDialog` 设计控件：绑定所属窗口、打开触发控件和拖放目标，使用 `IFileOpenDialog` 与 `WM_DROPFILES`，不生成运行时视觉控件；设计期必须像普通控件一样在窗口画布内显示可拖拽占位，单击后独立显示属性，选中普通控件时必须解除它的选中状态。事件页显示 `FilesSelected`、`FilesDropped`、`Cancelled`，不得把它放入“项目 / 非可视组件”集合。同一对话框可同时使用按钮打开触发器和图片框拖放目标；选择拖放目标后自动启用拖放，拖入或对话框选择图片后将第一张有效图片刷新到绑定图片框。中文代码通过 `文件对话框_打开`、`文件对话框_清空`、`文件对话框_取文件数量`、`文件对话框_取文件` 读取同一份选择/拖入结果。旧项目中的 `Upload` / `DragUpload` 只保留兼容生成与迁移诊断，AI 不得继续新建。
- 旧项目中可能仍有 `上传_打开("控件名")`。该命令只作为兼容别名，生成器确定性映射为运行时命令 `上传_打开文件选择(L"控件名")`；AI 新代码必须使用非可视 `FileDialog` 与 `文件对话框_*` 命令，不得重新创建 `Upload` / `DragUpload` 或生成不存在的 `上传_打开` C++ 符号。
- 文件对话框的普通属性面板必须优先显示“文件类型”预设（所有、图片、文档、音频、视频、压缩包）。自定义时使用类型名称和逗号分隔的扩展名；`label|*.ext;*.ext` 原始规则只放在折叠高级项，AI 不得要求普通用户手写该格式。
- `ContextMenu`（界面名称“上下文菜单”）和 `PopupMenu`（界面名称“弹出菜单”）都是非可视设计控件，运行时不得生成隐藏窗口或可见占位。上下文菜单通过 `targetControlId` 绑定所属窗口或具体控件，真实响应 `WM_CONTEXTMENU`；也可调用 `上下文菜单_显示(组件名)` 主动显示。弹出菜单默认不绑定目标，使用 `弹出菜单_显示(组件名)` 或 `弹出菜单_在坐标显示(组件名, 横坐标, 纵坐标)`；需要在当前鼠标屏幕位置弹出时，优先写 `弹出菜单_在坐标显示(弹出菜单1, 取鼠标水平位置(), 取鼠标垂直位置())`，不要生成固定坐标。菜单项事件绑定依赖稳定项目 ID，不得把显示文字当作持久化事件键；`菜单_取最后项目(组件名)` 返回最近选择的菜单项 ID。当前只支持单层项目、分隔线、启用和勾选状态，AI 不得承诺尚未实现的层级子菜单、菜单图标或运行时动态增删。
- Win32 高级模块提供可拖到画布的 `ColorPicker`“颜色选择器”。可视时点击控件自身打开 LingBuilder 暗色原生选色窗口，窗口由导出 C++ 自绘 HSV 色谱、色相条、HEX/RGB、常用预设和确认/取消，不得回退为旧式 `ChooseColorW`；设为不可视后仍是可按名称调用的运行时逻辑组件，按钮、菜单或其他事件可调用 `颜色选择器_打开(颜色选择器1)`。使用 `颜色选择器_置颜色/取颜色` 读写 COLORREF，并在 `ColorChanged`、`Opened`、`Confirmed`、`Cancelled`、`Closed` 对应中文事件中处理结果。AI 不得因为控件不可视就把它从生成结果删除，也不得把它错误改造成 `FileDialog` 一样的纯资源模型。
- 常见类型：`整数型`、`文本型`、`逻辑型`、`空`

AI 不能因为自己熟悉英文 C++ 就强行替换中文 DSL。需要原生 C++ 时，应使用项目已有的“原生 C++”嵌入规则或说明需要进入 C++ 文件修改。

### 3.1 控制流参数与闭合规则

- 条件支持 `并且`、`或者`、`非`，例如 `如果真 (已登录 并且 非已过期)`；每个条件结构必须用对应的 `如果结束` 或 `如果真结束` 闭合。
- `选择 (整数表达式)` 内使用一个或多个 `分支 (值1, 值2)`，可选一个 `默认`，最后写 `选择结束`。每个分支由生成器自动隔离，不需要额外写跳出命令。
- `循环` 是无限循环；`循环 (条件)` 与 `判断循环首 (条件)` 是前置条件循环；`循环判断首 () ... 循环判断尾 (条件)` 是后置条件循环。
- `计次循环首 (次数, 计次变量)` 从 1 计数，计次变量可省略；`变量循环首 (起始值, 目标值, 递增值, 循环变量)` 支持正向或反向步进；`枚举循环首 (集合, 当前项)` 遍历数组。显式填写的计次变量、循环变量和当前项必须先用 `局部` 或程序集变量声明。数组的成员数、增删改查、排序和重定义由 `lingbuilder.std.array` 提供，语言本身只负责声明、传参、下标访问和遍历。
- `跳出循环` 只允许写在循环内；`到循环尾` 与 `继续循环` 等价，只允许写在循环内。
- `尝试` 至少包含一个 `捕获 (错误信息)` 或 `最终`，并以 `尝试结束` 闭合；`抛出("错误信息")` 抛出文本异常。`最终` 在正常完成、`返回` 或抛出异常时都会执行。
- 普通条件会确定性翻译比较、算术、嵌套命令和宽字符串文本，例如 `如果 (文件对话框_取文件(文件对话框1, 0)!="")`。

## 4. 窗口设计器绑定规则

窗口设计器模型提供控件布局、控件属性和事件绑定名；`.lcpp` 文件提供事件代码逻辑。生成和运行行为应以 `.lcpp` 中的事件代码为准，设计器只提供布局和绑定关系。

- Rebar 已从工具箱和新建入口移除，只保留旧项目兼容。AI 不得在新项目或新布局中创建 Rebar，应直接使用 ToolBar；读取旧项目时仍须保留其模型和生成行为，不能静默删除。
- 窗口菜单栏 `MenuBar` 已从工具箱和新建入口移除，只保留旧项目兼容。AI 不得在新项目或新布局中创建 `MenuBar` 或写入新的 `menuItems`，应使用 `ToolBar` 承载常规窗口操作；读取旧项目时仍须保留已有菜单模型、事件和 Win32 生成行为，不能静默删除。
- 兼容旧 Rebar 时，其直接子控件在 `properties.autoBindChildren` 未关闭时必须自动形成带区，孙级控件不能误绑定。带区顺序与 `properties.bands` 一致；每个带区可保存 `width`、`minWidth`、`height`、`breakLine`、`resizable`，容器可保存 `locked`、`showGrippers`、`fixedHeight`、`showBandBorders`。事件名固定为 `BandDragStarted`、`BandDragEnded`、`HeightChanged`、`LayoutChanged`。

- 设计器中的控件背景色、前景色、字体名称、字号、粗体、斜体、下划线、尺寸和状态也是确定性原生生成输入；AI 不得建议依靠仅在 React 预览中生效的样式模拟运行结果。字体名称必须从设计器安全下拉列表选择，旧项目缺失字体字段时使用 `Microsoft YaHei UI` 常规字体。普通 Win32 F5/导出必须完整消费字体字段；new_emoji 当前通用 DLL API 只保证字体名称和字号，粗体、斜体、下划线必须保留模型并输出明确诊断，不能静默宣称已在运行时生效。
- `parentId` 表示真实容器层级，控件坐标以窗口绝对坐标持久化但移动父容器时全部后代必须同步平移以保持相对位置；父级不可见或禁用时，所有后代分别继承不可见或禁用的有效状态。设计器、Win32 与 new_emoji 生成链路必须共用该语义，不能把隐藏父级的子控件降级成窗口根控件。普通 Win32 可视控件即使初始隐藏也必须进入生成数组并创建独立主 `HWND`，只移除初始 `WS_VISIBLE`；不得因自身或父级隐藏而跳过创建，否则运行时按名称显示、启用和事件绑定都会失效。
- 窗口未配置 `menuItems` 时生成器必须保持无菜单，不能注入演示菜单；进度条的可视“进度值”和结构化 `properties.value` 必须同步，AI 修改其中一个时要同时更新另一个。

### AI 源码与设计器原子编辑（2026-08-19）

- 内置 AI 修改 `.lcpp` 时，必须把当前完整 `designerProject` 一起作为上下文；用户需求涉及窗口、控件或布局时，模型必须返回修改后的完整设计器对象，不能只返回源码片段或只返回 CSS/预览层修改。
- 源码文件和设计器模型必须进入同一份可预览 `WorkspaceEditProposal`。用户确认前不得写入文件或设计器状态；确认后源码文件、`window-designer.json`、编辑器状态和设计器画布必须一起更新，失败时不得只应用其中一部分。
- 设计器提案应用前必须重新读取磁盘上的 `window-designer.json`，并与提案生成时快照及调用方观察快照逐一比较；发现外部修改、项目 ID 不一致、窗口/控件引用错误或非法尺寸时必须阻断并要求重新生成提案。
- 设计器模型校验必须保持窗口/控件/资源 ID 唯一、控件名称唯一、`parentId` 可解析，并禁止未明确要求时删除已有窗口或控件。进度条 `content` 与 `properties.value` 必须是同一个有效范围内的数字。
- 系统 AI、BYOK、AI Bridge 和 MCP 必须遵守同一对象契约：系统 AI/BYOK planner 草稿的文件项使用完整 `updatedSource`；外部 AI 自带草稿（独立 MCP/无 planner REST）的 `files[]` 每项在 `updatedSource`（全量）、`updatedLines`（按行数组，服务端以 \n 拼接）与 `edits`（行级增量替换）中三选一（2026-09-18 起，同传或全缺直接报错），单文件内联全量上限 256 KB；布局项使用完整 `designerProject`；不允许让任一通道退化为源码-only 的静默修改。应用操作仍受本地预览、权限模式和撤销/拒绝流程约束。
- BYOK 的结构化输出 schema 与系统 AI 的编辑提示必须按同一布局判断动态约束字段：当需求命中窗口、控件或布局（包括“美化界面”）且上下文存在 `designerProject` 时，`designerProject` 必须出现在返回 JSON 中；大型模型必须使用足够输出预算返回完整对象，不能因截断退化成源码-only 提案。
- 对“美化界面”“界面太乱”“优化布局”等宽泛视觉请求，AI 必须在完整 `designerProject` 中至少改变三项真实可见属性（例如窗口/标题栏颜色、控件颜色、字体、圆角、间距、位置或尺寸），不能只复制模型或重新排序 JSON 字段。若模型原样返回，客户端会自动发起一次纠正请求；仍无变化时仅对这类宽泛美化请求使用保守的本地视觉回退，并继续经过同一预览、确认、ID/事件校验和保存事务。
- 宽泛美化请求即使未配置 API Key、系统 AI 草稿缺少 `designerProject` 或模型连续返回原样，也必须生成上述本地视觉回退提案；源码保持原样，布局变化仍须先预览确认，不能因此显示“未返回完整设计器模型”并阻断用户。
- 系统 AI 云端编辑解析层也必须执行同一回退：在 SSE `edit_draft` 事件发出前处理缺失或原样 `designerProject`，不能让云端解析错误提前终止宽泛美化请求；普通明确布局请求仍必须因缺少实际模型变化而阻断。
- 渲染端不能依赖云端 `edit_draft.instruction` 字段来判断回退类型；发送系统 AI 编辑请求时必须按请求 ID 保存原始用户提示词，云端缺少该字段或仍返回旧格式时使用本地提示词继续执行同一美化回退，完成/失败后清理该会话记录。
- AI 编辑分流不能只看当前活动文件是否为 `.lcpp`：当工作区存在完整 `designerProject` 且用户提示同时表达窗口/控件/界面目标与布局变更意图时，即使当前打开的是 `config.ini`、`.cpp` 或其它文件，也必须进入源码与设计器同步编辑提案；系统 AI 的有限源码上下文必须优先携带当前活动文件和项目内 `.lcpp` 文件。
- 设计器校验必须允许已启用模块贡献的控件类型，以及当前模型中原样保留的旧控件类型；旧项目的 `Upload` / `DragUpload` 只能被保留或修改布局，不能借兼容放行新增未知控件。提案校验失败必须返回中文错误响应，不能让 Electron 本地服务进程退出。
- **设计器控件 `type` 合法标识清单（AI 必须逐字使用，区分大小写，2026-09-18 起）**：内置 Win32 工具箱共 44 个注册标识——`Button`(按钮)、`TextBox`(编辑框)、`Label`(标签/静态控件)、`CheckBox`(复选框)、`RadioButton`(单选框)、`ListBox`(列表框)、`ComboBox`(组合框)、`GroupBox`(分组框)、`ScrollBar`(滚动条)、`Image`(图片框)、`AnimatedImage`(动态图像控件)、`ProgressBar`(进度条)、`Grid`(网格容器)、`ListView`(列表视图)、`DataGrid`(数据表格)、`TreeView`(树形视图)、`TabControl`(选项卡)、`Header`(表头)、`ComboBoxEx`(增强组合框)、`SysLink`(超链接)、`DateTimePicker`(日期时间选择器)、`MonthCalendar`(月历)、`ColorPicker`(颜色选择器)、`TrackBar`(滑块)、`UpDown`(数值调节器)、`HotKey`(热键输入框)、`IPAddress`(IP 地址框)、`ToolBar`(工具栏)、`StatusBar`(状态栏)、`ToolTip`(工具提示)、`FileDialog`(文件对话框)、`ContextMenu`(上下文菜单)、`PopupMenu`(弹出菜单)、`ImageList`(图像列表资源)、`ReBar`(Rebar 容器)、`Pager`(分页容器)、`RichEdit`(富文本框)、`Animation`(动画控件)、`VideoPlayer`(视频播放器)、`FlatScrollBar`(平面滚动条)、`PropertySheet`(属性页窗口)、`EdgeBrowser`(Edge浏览器)、`CefBrowser`(CEF3浏览器)、`FBroBrowser`(FBro指纹浏览器)；模块贡献类型以启用模块 `contributes.designerControls[].type`（含 `previewType`/`namespacedType`）为准。**编辑框的规范标识是 `TextBox`，不是 `Edit`**——`EDIT` 只是它的 Win32 原生类名，AI 禁止写 `Edit`、`Input`、`输入框` 等同义词。本地提案管线（BYOK、系统 AI 草稿、AI Bridge/MCP 共用 `proposeLingCppEdit`）会在校验前对常见别名做一次保守归一化（`Edit`→`TextBox` 等，仅当目标类型在当前允许集合内才生效）；BYOK 生成侧还会在类型校验失败时携带中文错误自动纠正重试一次；归一化与重试后仍无法识别的未知类型会被中文阻断诊断拒绝。提案对象携带生成时的 `designerAllowedControlTypes` 快照，apply 侧复用同一集合，模块贡献控件不会在应用阶段被默认集合误拒。
- F5、AI Bridge 和源码包读取只聚合当前项目源码根目录中的真实 `.lcpp` 文件；`.lingbuilder-build`、`generated/cpp`、`dist`、`node_modules` 等生成或工具目录中的源码副本不是项目输入，不能因其中重复的 `MainWindow` 等类名阻断构建，也不能要求用户手工删除这些产物。
- 构建输出目录允许用户自定义（2026-09-11 起）：项目级 `buildProperties.buildDirectory/generatedSourceDirectory` 覆盖工作区默认（`.lingbuilder/build-configuration.json`），缺省为 `.lingbuilder-build/$(ProjectId)/$(Platform)/$(Configuration)` 与 `generated/cpp/$(ProjectId)`，支持宏 `$(ProjectId)/$(ProjectName)/$(Platform)/$(Configuration)`，只接受工作区相对路径。AI 不得假定构建产物固定在 `.lingbuilder-build` 下；生成代码、构建或清理建议中的路径应来自用户当前配置，且不得把自定义输出目录中的生成源码当项目输入。

AI 修改窗口相关逻辑时必须：

- 保留已有窗口类名、控件名和事件处理器名。
- 不要只重命名设计器绑定窗口对应的 `.lcpp` 文件或其中的窗口类。当前工作台会阻止这种单边重命名；如用户确需改名，应新建／迁移窗口，或在未来具备原子重构能力后同时更新文件名、类声明、设计器窗口、事件绑定和恢复状态。
- 不要凭空发明未出现在当前设计器或当前文件中的控件。
- 如果用户要求操作一个不存在的控件，应在说明中指出需要先创建控件，或生成最小的安全占位逻辑。
- 新增事件处理器时，应使用设计器期望的命名风格，例如 `按钮4_被单击`。
- 不要把设计器布局逻辑写死到普通业务事件里，除非用户明确要求。
- 窗口设计器项目当前为 `schemaVersion: 2`；控件通用布局仍使用明确字段，项目集合、范围、选中状态、日期、图片源、列、树节点和标签页等专属数据写入 `properties`，不能再把结构化数据拼成临时分隔字符串。
- `TreeView` 节点使用 `properties.nodes[]`，每个节点的 `expanded` 是“默认展开节点”布尔字段，默认 `false`。设计器预览、F5 和导出 C++ 必须共用该字段；生成原生 TreeView 时应在所有父子节点插入后再恢复展开状态，不能只在 React 预览中模拟。
- 图片框本地图片必须先通过设计器“图片源”选择器或解决方案项目右键“添加资源…”导入链路复制到项目 `assets/`（多项目使用 `assets/<projectId>/`）；项目树“图片资源 (assets)”组可枚举图片，右键图片可复制 `assets/...` 相对路径。`properties.imageSource` 只保存工作区相对路径，不能写入开发机绝对路径。F5、原生导出和 AI Bridge 导出/构建必须携带这些资源，并由 Visual Studio post-build 复制到 exe 输出目录；`http/https` 地址目前只允许设计器预览，AI 不得承诺原生 exe 会联网加载。
- 普通 Win32 图片框支持运行时 `图片框1.设置图片("assets/示例.png")`，确定性映射为 `控件_设置图片(图片框1, "assets/示例.png")`。项目固定资源优先使用设计器导入后得到的 `assets/...` 相对路径；文件对话框返回的本地完整路径可直接作为动态图片路径。传入空文本会清空图片。不得使用 `.内容` 或 `控件_设置文本` 伪装图片加载，也不得为网络 URL 承诺原生运行时加载。
- 图片框无需预设占位图片即可在运行时调用 `.设置图片(...)`；生成器会为初始为空的 Image 控件保留 `SS_BITMAP` 类型。AI 不得建议用户为了动态换图而先在设计器中硬编码一张初始图片。
- GIF 动画应使用 Win32 基础工具箱的“动态图像控件”（类型 `AnimatedImage`），资源路径写入 `properties.gifSource`，并通过属性选择器复制到项目 `assets/`。`properties.stretch` 控制填充方式，`autoPlay` 与 `loop` 控制自动播放和循环；非循环播放结束后分发 `Finished` /“播放完毕”事件。普通 `Image` 图片框只负责静态图片，不得把 GIF 首帧静态显示冒充动画；`Animation` 控件只用于 AVI，原生 F5/导出使用 Media Foundation 播放系统可解码的 AVI，而不是受老式编码限制的 `SysAnimate32`，继续消费 `properties.aviSource`、`autoPlay`、`loop` 并分发 `Finished` 事件。
- 生成器写入 C++ 字符串常量的诊断或调试文本时，换行必须保留为 C++ `\\n` 转义序列，不能把模板中的真实换行写入引号内部；动画控件播放失败日志同样遵守该规则，避免生成工程触发 MSVC C2001/C1075。
- `TabControl` 的每个 `properties.tabs[].id` 都是稳定页面槽位；直接子控件必须用 `parentId` 指向选项卡，并用 `containerSlot` 指向所属标签页 ID。未写 `containerSlot` 的旧子控件只归入第一页。`properties.hideHeader` 是“隐藏表头”布尔字段，默认 `false`；为 `true` 时设计器和 Win32 F5/导出必须共同隐藏标签栏，并让当前页占满选项卡客户区。生成 Win32 时每页拥有独立页面 HWND，页面 HWND 必须把命令、通知、颜色及 owner-draw 绘制消息转发到主窗口；表头宽度必须使用实际字体、图像列表和 DPI 内边距测量，150% 等高 DPI 下不能因自绘区域与原生项目宽度不一致而提前省略完整标题；禁止把不同页面的子控件同时显示或改回仅靠 React 隐藏的模拟实现。
- 普通项目默认只启用 `lingbuilder.win32.basic`。生成 ListView、TreeView、Tab、日期、滑块、工具栏、状态栏、RichEdit 等控件或系统通用对话框命令前，必须确认项目启用了 `lingbuilder.win32.common-controls`。
- 工具栏背景色使用公共控件正式支持的 `CCM_SETBKCOLOR`，文字色和交互状态通过 `NM_CUSTOMDRAW` / `NMTBCUSTOMDRAW` 消费设计器模型；不得生成 Windows SDK 中不存在的 `TB_SETBKCOLOR` 或 `TB_SETTEXTCOLOR`，也不得为绕过编译错误直接丢弃工具栏配色。
- 所有 LingCpp 中文补全项（含已启用模块贡献的命令、类型和代码片段）必须由统一补全目录自动生成全拼、拼音首字母及保留 `_` 分段的中拼混合检索键；例如 `控件_设置选择项` 必须能由 `kj`、`kongjian`、`控件_sz` 命中，`到整数` 必须能由 `dzs` 命中。新手编辑器与 Monaco 必须消费同一组检索别名，不得在 React 组件内为单个命令硬编码拼音。
- 新手正文中的逻辑字面量必须支持短检索：`z` / `zhen` / `true` 补全为 `真`，`j` / `jia` / `false` 补全为 `假`；该规则来自可测试的 LingCpp 字面量补全目录，适用于控件布尔参数和普通逻辑表达式。
- 新手编辑器必须允许在函数和控件方法的参数表达式中继续触发统一命令补全，例如输入 `选项卡1.设置选择项(dzs` 时应提示 `到整数`；字符串和注释内部仍不得弹出普通命令候选。补全上下文判断应由可测试的 LingCpp service/helper 维护，不能散落为 React 组件中的特殊命令判断。
- `.lcpp` 新手编辑器输入稳定设计器控件名和 `.` 时，候选必须来自统一控件注册表：列出该控件类型的全部注册事件（未绑定事件须明确标注），并只列出能由现有模块 binding 确定性生成 C++ 的适用命令。通用命令以及勾选、数值、选择、集合、ListView、TreeView、TabControl 专属命令应按类型过滤；非可视文件对话框使用模块级 `文件对话框_*` 命令，不伪装成画布控件点语法。不得只为单个控件硬编码候选，也不得展示没有生成链路的假命令。
- 选项卡表头可在运行时使用 `选项卡_设置隐藏表头(选项卡1, 真/假)` 切换，并用 `选项卡_取隐藏表头(选项卡1)` 读取；新手模式从 `选项卡1.` 选择相应候选时插入同一确定性命令。切换必须同步重排标签页承载区。列集合、节点集合、创建样式等仅设计期属性在尚无安全运行时实现前不得伪装成可调用属性命令。
- ToolTip、ImageList、PropertySheet 属于非普通画布控件/资源，不能当作普通静态文本控件生成。
- ToolTip 通过项目行为资源绑定目标控件；PropertySheet 通过项目顶层资源定义页面并使用 `属性页_显示(属性页资源)` 打开，应用动作由资源声明的中文处理器接收。属性页需要复合控件时，为页面选择一个设计器窗口模板，生成器会把模板的完整控件树创建为页面子 HWND；不要把 PropertySheet 拖成 STATIC 子控件。
- Win32 高级模块的系统对话框结果必须通过确定性命令读取：文件/目录选择后可用 `系统对话框_状态()` 区分成功、取消和错误；工具栏事件可用 `工具栏_最后命令()` 读取按钮 ID，状态栏双击事件可用 `状态栏_最后分区()` 读取分区索引；查找替换回调可读取动作、查找内容和替换内容；需要实际输出文档时使用 `打印文本(文档名, 文本)`。
- 中文代码运行时修改设计器控件必须使用稳定控件中文名称：通用操作使用 `控件_设置文本/取文本/设置启用/设置可见/设置勾选/取勾选/设置数值/取数值/设置选择项/取选择项/添加项目/清空项目`；图片框使用 `控件_设置图片`；结构化集合使用 `列表视图_添加行`、`树形框_添加节点`、`选项卡_添加页`。这些命令通过模块 binding 确定性生成，不得在 React 中拼 C++。
- ListView 普通模式除 `列表视图_添加行` 外，还可使用 `列表视图_插入行/删除行/设置单元格/取单元格/取行数/批量添加行/开始批量更新/结束批量更新/排序/取最后单击列`。行、列索引均从 0 开始。新代码必须优先用 `列表视图_创建行(单元格...)` 创建 `列表视图行`，例如 `列表视图_添加行(结果列表, 列表视图_创建行("任务", "完成", 3, 真))`；批量数据用 `列表视图_创建行集合(行...)`。构造器会按现有 `到文本` 规则转换文本、整数、小数和逻辑值，不要再为新代码手工拼接 `\t` / `\n`。旧式 Tab/TSV 文本仅用于兼容已有源码。
- 需要数万行数据时，AI 应把 ListView 的设计器创建期属性 `virtualMode` 设为真，再调用 `列表视图_设置虚拟行数` 和 `列表视图_设置虚拟行(控件, 索引, 列表视图_创建行(...))`；不得对普通 ListView 循环插入数万真实项目。虚拟模式由生成器使用 `LVS_OWNERDATA` 与 `LVN_GETDISPINFOW` 实现，不得在 React 中模拟。普通模式大批量修改必须用开始/结束批量更新成对包围，或直接传入 `列表视图行集合` 调用批量添加行。
- ListView 已公开 87 条确定性高层命令：16 条数据/虚拟/类型化行命令，以及 71 条列管理、行状态、查找/命中/几何、滚动/重绘、视图/样式/颜色、分组、标签编辑、热项、ImageList、插入标记和图标布局命令。AI 应优先使用已启用模块提供的类型化 `列表视图_*` binding；不得生成通用 `SendMessage`、伪造指针整数或把 Win32 回调/结构体强行塞入文本参数。必须使用自定义绘制、回调排序、工作区数组或 Tile/Footer 复合 ABI 时，应创建 v2 原生 C++ 模块并补齐 contribution、binding 与真实运行时符号。
- 需要用信息框显示 ListView 选中行、计数或单元格等动态值时，先用 `到文本` 分别转换数值并保存到文本变量，再组合完整提示文本传给 `信息框`。Win32 运行时同时支持 `const wchar_t*` 和 `std::wstring` 提示文本；不要为规避类型错误丢弃已读取的动态内容。
- 设计器控件的稳定中文名称同时是 LingCpp 控件符号，可直接使用 `.内容`（兼容别名 `.文字`）读取或赋值文本：`编辑框_表头.内容` 等价于 `控件_取文本(编辑框_表头)`，`编辑框_表头.内容 = "1"` 等价于 `控件_设置文本(编辑框_表头, "1")`。该属性语法必须在生成器中确定性翻译并支持嵌套表达式，例如 `到整数(编辑框_表头.内容)`；不能仅做编辑器展示，也不能脱离当前设计器窗口虚构控件名称。普通 Win32 后端按控件名查找独立 `HWND`；new_emoji 后端按同一稳定中文名称查找元素 ID，并通过 `EU_GetElementText` / `EU_SetElementText` 完成真实 UTF-8 文本读写，不得把普通 Win32 成员函数原样遗留到 new_emoji 独立窗口中。
- 所有原生 UI 后端命令必须通过 `NativeUiBackendCommandContract` 注册并与模块 `bindings.commands` 同源校验。new_emoji 可直接使用已适配的通用基础命令（信息框、调试输出、结束、`到整数`、`到文本`、`格式化文本`、鼠标位置、窗口活动/可见/状态，以及控件文本、图片、启用、可见、勾选、数值、选择项、添加/清空项目）和后端无关的标准库、文件、网络、数据媒体、平台命令。依赖普通 Win32 `LingWindowBase`、专属 `HWND` 或窗口事件上下文的命令不得由 AI 强行用于 new_emoji；应改用该 UI 模块对应命令或切换后端。未注册契约、未注册布局生成器或不兼容命令必须保留中文阻断诊断，不能让生成结果进入 C3861/LNK2019 后才失败。
- 支持按控件符号调用类型匹配的方法：选项卡、列表框、组合框和列表视图设置当前项时，优先写 `选项卡1.设置选择项(索引)`；该语法确定性映射为底层 `控件_设置选择项(选项卡1, 索引)`。编辑器只能为当前设计器窗口中类型兼容的真实控件提供方法补全，不能给任意控件虚构方法。
- 图片框类型匹配方法为 `图片框1.设置图片(图片路径)`，确定性映射到底层 `控件_设置图片`；编辑器不得为非 Image 控件提供该方法。
- 文本转整数使用基础命令 `到整数(文本)`；例如从编辑框读取页索引优先写 `选项卡1.设置选择项(到整数(编辑框1.内容))`，兼容命令式写法为 `控件_设置选择项(选项卡1, 到整数(编辑框1.内容))`，底层属性兼容写法为 `到整数(控件_取文本(编辑框1))`。该命令转换失败时返回 0，并通过基础模块 binding 确定性生成本地 C++，不能只作为编辑器高亮关键字存在。
- 整数、长整数、小数、逻辑值和文本统一转文本使用基础命令 `到文本(值)`；逻辑值稳定返回 `真` 或 `假`，文本原样返回。例如 `控件_设置文本(标签1, 到文本(123))`。该命令由基础模块 binding 在普通 Win32 和 new_emoji 后端确定性生成，不能只作为编辑器关键字或补全项存在。
- 需要把多个值填入一段提示文本时，优先使用基础命令 `格式化文本(格式模板, 参数...)`，例如 `格式化文本("姓名：{}，年龄：{}，启用：{}", "小林", 18, 真)`。`{}` 按从左到右顺序消费参数；`{{` 和 `}}` 分别输出字面量 `{` 和 `}`；参数不足时保留剩余 `{}`，多余参数忽略。不得生成 `%s`、`printf` 或依赖 AI 的运行时替换来模拟该命令；普通 Win32 与 new_emoji 必须通过同一基础模块 binding 生成真实 C++ 调用。
- 字符编码转换必须先启用 `lingbuilder.std.encoding`。LingCpp `文本型` 表示 Unicode 文本；任意编码的原始字节统一用不带空格的偶数长度大写十六进制文本传递，不能把 UTF-8、GBK 等任意字节冒充 `文本型`。模块支持 UTF-8、UTF-16LE、UTF-16BE、UTF-32LE、UTF-32BE、ANSI（当前 Windows 系统代码页）、GBK、GB2312 和 GB18030 的文本互转，支持 `编码_转换(十六进制字节, 源编码, 目标编码)`、BOM 添加/删除/判断/检测及保守编码检测。`编码_检测` 只在存在 BOM 或字节严格符合 UTF-8 时返回确定编码，否则返回 `未知`，不得猜测 ANSI、GBK 或 GB18030。

## 5. 模块命令调用规则

LingBuilder 模块系统用于扩展中文命令、类型、补全、诊断和 C++ 生成依赖。AI 必须根据当前项目“已启用模块上下文”决定能否使用模块能力。

当前模块标准为 `schemaVersion: 2`。旧 `.lbmod` v1、旧 `contributes.cpp` 和旧 `cppRuntimeName` 不再作为兼容目标；C++ 依赖应写入 `targets[]`，中文命令到 C++ 的确定性映射应写入 `bindings.commands[]`。

- 模块公开类型使用 `contributes.types[]`：省略 `kind` 的旧条目是 `opaque`；结构化记录必须声明 `kind: "record"` 和 `fields[]`；命名数组必须声明 `kind: "array"` 和 `elementType`。记录字段的数组维度使用 `isArray: true`，不要把 `[]` 拼进字段 `type`。
- 模块公开常量使用 `contributes.constants[]`（manifest v2）：每项声明 `name`（中文/字母/数字/下划线，不得带 `#`）、`type`（只允许 整数型/长整数型/字节型/小数型/双精度小数型/文本型/逻辑型）、`value`（纯字面量：数值类型填 JSON number，文本型填 string，逻辑型填 true/false）、`description`（非空中文说明）和可选 `level: "basic"|"advanced"`。`.lcpp` 源码中引用常量（项目常量与模块常量统一）的规范形态是 `#常量名`（裸标识符、不带引号，如 `调试输出("模块名：" + #模块名)`、`键盘_按下(#键盘1)`）；`#` 前缀强制按常量解析，未知常量立即报中文诊断。裸名引用继续兼容旧源码（项目常量），但 AI 新代码、示例、补全文档和模块文档一律使用 `#` 形态。生成期把启用模块常量与项目常量确定性物化为 `inline constexpr`/`inline const std::wstring` 编译期常量；项目常量同名遮蔽模块常量（只物化一份），两个启用模块间同名常量构建前中文阻断。`@` 内嵌 C++ 行与字符串、注释、多行文本块内的 `#` 不是常量引用。
- AI 可以在启用模块后使用其公开记录和数组：记录字段采用公开值语义，支持字段访问、嵌套和字段数组；命名数组等价于对应元素类型数组。AI 不得猜测未公开字段、给结构化类型补写 `cppType`，也不得把记录或数组降级成 JSON、文本或整数句柄来掩盖类型不一致。
- 已启用 `lingbuilder.std.array@1.0.0` 时，AI 必须使用 `数组_取成员数`、`数组_取成员`、`数组_置成员`、`数组_加入成员`、`数组_插入成员`、`数组_删除成员`、`数组_清空`、`数组_查找`、`数组_是否包含`、`数组_排序`、`数组_倒序`、`数组_重定义` 操作语言原生数组，不得再用分隔符文本、控件列表或 `JSON值` 模拟动态数组。命令对元素类型透明，索引从 0 开始，越界一律安全返回失败值。数组参数只接受数组变量名或记录字段路径，不能传命令结果、下标或其它表达式；成员参数必须与元素类型一致。`数组_查找`、`数组_是否包含` 需要元素类型支持相等比较，`数组_排序` 需要支持大小比较，记录型数组调用这三条命令会稳定返回 -1 或假，AI 不得声称它们能按字段查找或排序。未启用该模块时数组仍然只能声明、传参、下标访问和用 `枚举循环首` 遍历。
- 已启用 `lingbuilder.data.json@2.0.0` 时，AI 必须使用模块公开的 `JSON值` 和 `JSON_` 命令处理 JSON：`JSON_解析` 或 `JSON_创建*` 创建值，`JSON_对象_设置` / `JSON_数组_添加` 修改，`JSON_指针_取` / `JSON_指针_设置` 处理嵌套路径，完成后对长期持有值调用 `JSON_释放`。不得把 JSON 字符串用手工拼接、正则或 `文本_取中间` 伪解析；解析、Patch 或 Schema 校验失败时必须读取并保留 `JSON_取最后错误()` 的中文诊断。模块支持 RFC 8259、RFC 6901、RFC 6902、RFC 7396 与文档列出的 JSON Schema 核心约束；JSON5、JSONC、BSON、MessagePack、CBOR、远程 `$ref` 和网络 schema 加载不属于该模块，不能声称已经支持或静默降级。
- `record` 和 `array` 是 LingCpp 语义契约，不是 DLL ABI。生成工程内部可输出 C++ `struct` 和 `std::vector<T>`，但预编译 DLL 边界禁止直接传递 STL 或未固定布局的 C++ 对象。需要原生交换复杂数据时必须使用模块明确提供的 POD、数据指针加数量、调用方缓冲区、任务或受管句柄命令；没有经过 binding 和生成器验证时，AI 不得声称结构化值可直接跨 DLL 传递。
- 模块命令的 `bindings.commands[].parameters[].type` 和 `returnType` 可以引用本模块公开的 `record/array` 名称，但仅适用于由 LingBuilder 生成在同一工程内的值语义运行时。只要 target 携带原生 DLL，清单校验就会拒绝结构化类型直接跨 ABI；AI 不得通过改成 `raw`、裸指针或伪造 `cppType` 绕过门禁。
- 使用 `lingbuilder.system.disk@1.1.0` 时，应优先采用 `磁盘_取容量信息`、`磁盘_取卷信息`、`磁盘_枚举逻辑驱动器`、`磁盘_枚举全部卷`、`磁盘_枚举物理磁盘` 和 `磁盘_取分区列表` 返回的公开记录/数组。原 5 条标量命令只用于旧源码兼容；模块是只读信息模块，不得生成格式化、分区修改、写扇区或绕过权限的调用。
- 使用 `lingbuilder.system.shell@1.0.0` 时，`系统_取运行目录()` 返回当前运行 exe 所在目录（不带尾部反斜杠），是易语言「取运行目录」的对应物；需要读取 exe 旁边的配置或数据文件时必须用它拼接路径，不得改用相对路径，也不得把进程当前工作目录当成运行目录（快捷方式或外部程序设置的工作目录会让两者不一致）。`取运行目录()` 是 `系统_取运行目录` 的稳定别名（易语言同名写法），两种写法等价，生成代码与文档统一使用规范名。`系统_取临时目录()` 返回值带尾部反斜杠，`系统_取桌面目录()`、`系统_取文档目录()` 不带；拼接子路径一律使用 `路径_合并`（`lingbuilder.fs.path`），不要手工补斜杠。

同时提供 `windows-msvc-win32` 与 `windows-msvc-x64` 的外部模块，其生成源码中的库指令必须按 `_WIN64` 确定性选择对应 target；不得在 x64 工程中残留 Win32 `.lib` 的 `#pragma comment`，也不得用 `targets[0]` 代替当前架构。

AI 必须遵守：

- 只能直接使用当前项目已启用模块提供的命令、类型和片段。
- 普通 Win32 项目默认只应假设已启用 `lingbuilder.win32.basic`。`new_emoji`、网页访问、HTTP 服务端、WebSocket 客户端/服务端等模块必须在当前项目上下文中明确启用后才能直接生成调用代码。
- 不要编造未启用模块的命令。
- 通用密码学按用途分别启用 `lingbuilder.crypto.hash`、`lingbuilder.crypto.password`、`lingbuilder.crypto.symmetric`、`lingbuilder.crypto.asymmetric`。密码保存必须优先使用 Argon2id（兼容场景才选择 scrypt、bcrypt 或 PBKDF2），不能用 MD5/SHA 系列直接保存密码；加密新数据优先使用 AES-256-GCM 或 ChaCha20-Poly1305，RC2/RC4/DES/3DES/Blowfish/CBC 与 ElGamal 只用于显式旧数据兼容。
- 加密命令的密钥参数是严格十六进制文本，必须通过 `对称_生成密钥` 或同等密码学安全随机源产生，禁止把用户口令直接当密钥。RSA 加密使用 OAEP-SHA256，RSA 签名使用 PSS-SHA256；SM2 签名必须保留协议约定的用户标识；ECDH/X25519 只产生共享密钥，不等同于加密或身份认证。
- 通用加密生成依赖只读 `lingbuilder.crypto.sdk`（Botan 3.12.0 + BLAKE3 1.8.5）。缺少 SDK、MSVC、Win32/x64 资产或 SHA-256 清单不一致时，应报告生成前阻断诊断，不能改写成 AI 自行实现的临时密码算法。
- 如果用户要求使用未启用模块，先在说明中提示需要启用该模块，再给出不破坏当前代码的最小建议。
- 新增模块命令调用时，要确认该命令在模块上下文中存在 binding；缺少 binding 的命令不能声称可生成 C++。
- 分享或导入 `.lcpppkg` 时必须尊重清单中的 `minimumGeneratorVersion` 与 `requiredCapabilities`；v1 旧包由新版 IDE 先从 `.lcpp` 补齐能力清单。ListView 高级接口使用 `win32.listview.advanced-api.v1`；类型化 `列表视图_创建行/创建行集合` 使用 `win32.listview.structured-rows.v1` 并要求生成器 0.2.7。缺少任一能力时不得继续生成调用，必须先提示升级。
- 已启用模块 binding 中，处理器参数应使用 `type: "handler"`，`.lcpp` 以 `&处理器名` 传入当前类已有的无参数事件或方法。处理器引用属于模块回调，不得因为它没有对应设计器控件而自动重命名或报“控件不存在”；旧的处理器名字符串仅作兼容输入，新代码不再生成字符串回调。
- 不要把模块扫描、安装、启用、禁用或市场读取逻辑写进 React 组件。
- 生成或迁移模块时应优先使用 `lingbuilder module init`、`module migrate-cpp`、`module validate`、`module pack` 等 SDK/CLI 流程，并参考 `docs/模块开发手册.md`。
- 使用 `new_emoji 原生界面库` 时，优先生成 `NE_` 中文桥接命令；不要默认生成 `NE_EU_*` 底层命令，除非用户明确要求高级 DLL 参数调用。
- 已启用 `WebSocket 客户端模块`（模块 ID：`lingbuilder.websocket.client`，版本 `2.0.0`）时，新代码必须使用 `WS_创建连接`、`WS_配置连接`、`WS_绑定*处理器`、`WS_开始连接`、指定连接发送和显式销毁流程；处理器使用 `&处理器名` 并在 UI 线程读取 `WS_取当前事件*` 快照。模块支持 Windows/MSVC Win32/x64、普通 Win32/New_Emoji、`ws://`/`wss://`、文本/二进制、代理、HTTP Basic 凭据、系统证书验证、SHA-256 证书固定、资源限制、指数退避重连和统计。生产 `wss://` 不得关闭证书验证；秘密不得写入源码或日志。旧 `WS_连接`、`WS_发送文本`、`WS_接收到调试输出`、`WS_接收文本`、`WS_关闭` 仅为 `advanced` 同步迁移入口，不应进入新示例。
- 已启用 `CDP 客户端模块`（模块 ID：`lingbuilder.cdp.client`，版本 `3.0.0`，阶段 3 实施中）时，新代码必须使用 `CDP_` 前缀命令驱动 Chrome/Edge 调试端口：`CDP_连接(调试地址, &就绪处理器)` 支持多连接多端口；页面自动化继续使用 `CDP页面`。OOPIF/Worker 必须用 `CDP_设置自动附加`、`CDP目标`/`CDP会话` 与 `CDP_会话执行脚本`，不得伪装为页面。Debugger 可使用已登记的启用/断点/暂停/恢复/单步/调用帧/作用域命令；恢复后旧 `CDP调用帧` 立即失效。所有异步命令必须使用 `&处理器名`，在 UI 线程读取 `CDP_取当前事件*` 快照。Fetch 拦截和对话框必须立即一次性裁决。Storage 清理必须使用 exact origin、allowlist 类型和显式确认。证书接管只能用 advanced 的 exact-origin 白名单、1–600 秒期限，并对每个 `CDP证书错误` 逐次裁决；禁止通配符、无限期限或忽略全部。Cookie、请求体、认证凭据、证书信息和 `${SECRET:*}` 值不得写日志/分享包。`CDP_连接` 默认只允许回环，远程必须显式 `CDP_连接远程`。当前 screencast、Tracing/CPU/Coverage/Heap 完整任务输出、录制自动采集和确定性回放执行器尚未完成，AI 不得生成假命令或宣称这些能力已可用；`CDP_加载回放` 当前只建立状态。
- `多线程模块`（模块 ID：`lingbuilder.threading`）当前固定为 `2.1.0`，公开项目级受管任务、默认/自定义有界线程池、进度/完成回调、互斥锁、64 位原子整数、自动/手动重置事件、计数信号量和线程安全队列族。任务使用 `线程_提交(&工作处理器, 参数...)`、`线程_提交完成` 或 `线程_提交进度`；指定线程池时使用对应的 `线程池_提交*` 命令。
- 多线程工作、进度和完成处理器必须使用 `&处理器名`。工作处理器形参必须与提交的任意多个参数逐项匹配，参数在提交时按值深拷贝；允许基础类型、文本、字节集、数组、项目/模块公开记录及多线程模块自己的受管同步句柄，禁止 `controlRef`、普通模块 `opaque`、原生句柄、裸指针、引用和不可复制对象。
- 工作处理器返回 `T` 时，完成处理器必须为 `空 完成处理器(线程任务 任务, T 结果)`；返回空时只接收任务。进度处理器固定为 `空 进度处理器(线程任务 任务, 整数型 百分比, 文本型 说明)`。进度与完成处理器在发起窗口 UI 线程执行，工作处理器不得调用任何 UI/controlRef 命令；UI 更新必须放到进度或完成处理器。
- 多线程取消和关闭只允许协作完成。工作处理器应使用 `线程_是否请求取消(0)` 或 `线程_协作等待` 响应取消；禁止生成裸线程地址、裸 `HANDLE`、强制终止、挂起/恢复、DLL 注入或跨线程控件引用。旧的 `线程_启动延时输出`、`线程_等待全部`、`线程_活动数量`、`线程_硬件并发数`、`线程_休眠`、三条延时 UI 命令和 `线程_批量启动` 已删除，新代码不得继续生成。
- 队列族（2.1.0 新增，共 12 条，生成端为 threadingRuntime 队列族自由函数）：`队列_创建(容量上限)`（0 表示无界，1～100000 为有界队列）、`队列_入队(队列, 文本, 超时毫秒)`（-1 无限等待、0 立即返回，有界队列已满时阻塞等待形成背压，已销毁返回假）、`队列_入队整数(队列, 整数, 超时毫秒)`、`队列_入队字节集(队列, 字节集, 超时毫秒)`（三个入队同语义）、`队列_出队(队列, 超时毫秒)`、`队列_出队整数(队列, 超时毫秒)`、`队列_出队字节集(队列, 超时毫秒)`（出队为空时阻塞等待；类型转换规则：出队→整数转十进制文本、字节集按 UTF-8 解码；出队整数→文本完整十进制解析失败返回 0、字节集取前 8 字节小端；出队字节集→文本按 UTF-8 编码、整数转 8 字节小端）、`队列_上次出队是否成功()`（记录当前线程最近一次出队结果，用于区分空值与超时空返回，三个出队共用）、`队列_取长度(队列)`（无效句柄返回 -1）、`队列_是否为空/清空/销毁`。队列句柄为项目级受管 ID（`(seq<<8)|8`），内部互斥锁+条件变量、跨线程安全：工作线程 `队列_入队`、界面事件 `队列_出队` 后用控件命令刷新，不需要互斥锁；销毁唤醒全部等待者且句柄不复用。不提供易语言队列类的指针/缓冲区出口（到指针/取指针/收缩缓冲区/增量缓冲区/置缓冲区大小），与不暴露裸指针的模块红线一致。
- `lingbuilder.std.text`（文本处理模块，共 18 条）在 10 条基础上补齐：`文本_分割(文本, 分隔符, 结果数组)`（写入文本数组、返回分段数量，分隔符为空整段一条；数组出参走 数组_加入成员 同款引用路径，调用方声明 `局部 文本型 分片[]`）、`文本_倒找(文本, 目标)`（从末尾向开头的首个出现，0 起，未找到 -1）、`文本_替换子文本(文本, 查找内容, 替换内容, 起始位置, 次数)`（次数≤0 全部替换）、`文本_删全部空白(文本)`、`文本_到全角/到半角(文本)`（半角空格与 ASCII 可见字符 ↔ 全角）、`文本_重复(文本, 次数)`（总长超 16777216 字符返回空）、`文本_插入(文本, 位置, 插入内容)`（位置为负或超长原样返回）。
- `lingbuilder.std.bytes`（字节与十六进制模块，共 18 条）补齐二进制内容操作：`字节集_寻找(数据, 欲寻找, 起始位置)`、`字节集_倒找(数据, 欲寻找, 起始位置)`（起始含本位向左，越界按末尾）、`字节集_替换(数据, 欲替换, 替换内容, 次数)`（≤0 全部）、`字节集_插入(数据, 位置, 插入内容)`（位置<0 原样、超长追加末尾）、`字节集_删除(数据, 位置, 长度)`（长度<0 删到末尾、位置越界原样）；寻找族未找到一律 -1。缓冲区侧配套 `缓冲区_寻找(句柄, 欲寻找, 起始位置)`（全内容查找、游标不动、无效句柄 -1）。
- `lingbuilder.std.regex`（正则表达式模块，共 10 条）在原 5 条基础上补齐分组与迭代：新增 `正则_取所有匹配(文本, 表达式, 分隔符)`（全部匹配按分隔符拼接）、`正则_取第N个匹配(文本, 表达式, 序号)`（序号从 0 起）、`正则_取分组(文本, 表达式, 组序号)`（0 表示整个匹配，未参与匹配的分组返回空文本）、`正则_取所有分组(文本, 表达式, 组序号, 分隔符)`、`正则_取匹配位置(文本, 表达式, 序号)`（从 0 起，无匹配返回 -1）。非法表达式一律安全返回空文本/0/-1，不抛异常。生成端在 standardLibraryRuntime REGEX_RUNTIME（std::wregex + wsregex_iterator）。
- `lingbuilder.std.buffer`（缓冲区模块，2026-09-13 新增，共 16 条）：句柄制可增长二进制缓冲区。`缓冲区_创建(初始容量)` 返回句柄（0 为失败），写入族 `缓冲区_写字节集/写文本(UTF-8)/写整数`（写整数按 1/2/4/8 字节、可选大端），读取族 `缓冲区_读字节集/读文本/读整数`（顺序读游标，长度小于 0 表示读取全部剩余），状态与转换 `缓冲区_取长度/取剩余/重置读取/到字节集/从字节集/清空/保存文件/从文件/销毁`。单缓冲区上限 256 MiB；越界读取安全返回空字节集/空文本/0；`从文件/保存文件` 覆盖写目标文件。缓冲区句柄允许跨线程共享读写（内部每块互斥锁），但推荐把字节集值经队列或事件传递；与多线程队列族配合即可覆盖生产者-消费者字节流。生成端在 standardLibraryRuntime BUFFER_RUNTIME（每块 mutex + vector<unsigned char> + 游标）。
- `lingbuilder.fs.core@1.1.0`（文件目录模块，2026-09-16 起共 36 条）新增句柄式文件流族与枚举族，语义对齐易语言系统核心支持库：`文件_打开(路径, [打开方式=3], [共享方式=1])` 返回名义类型 `文件号`（0 为失败），打开方式沿用易语言编号（1 读入、2 写出、3 读写、4 重写清空、5 改写保留、6 改读读写），共享方式（1 无限制、2 禁止其它进程写、3 禁止读、4 禁止读写）；配套 `文件_关闭/关闭全部/移动读写位置(文件号, 距离, [基准=1])/移到文件首/移到文件尾`（基准 1 文件首、2 文件尾、3 现行位置）、读写族 `文件_读入字节集/写出字节集/读入文本([长度=-1 读到尾])/写出文本/读入一行/写文本行(自动补 CRLF)`、插入删除族 `文件_插入字节集/插入文本/插入文本行`（插入后读写位置回到插入内容首部）与 `文件_删除数据`（删除后位置停在删除点）、状态族 `文件_是否在文件尾/取读写位置/取长度`（无效句柄 -1）、锁族 `文件_锁定(文件号, 位置, 长度, [重试毫秒=0；-1 无限重试])/解锁`（解锁参数必须与加锁一致）。`文件_枚举(目录, 通配符, 含子目录, 结果数组)` / `目录_枚举(目录, 含子目录, 结果数组)` 返回完整路径（含隐藏/系统条目、不保证排序，通配符支持 `*` `?` 且只按文件名匹配）。红线：文件流文本一律 UTF-8（与易语言 ANSI 不同，AI 不得按 ANSI 口径生成）；`文件号` 不得写入文件或跨进程传递，句柄族示例必须「先声明、后赋值」两段式；读入/写出数据打包格式为整数 4 字节、长整数 8 字节、小数 8 字节、逻辑 1 字节（均小端）、文本 UTF-8+0、字节集 4 字节长度前缀，读写顺序必须严格对称，`文件_读入数据` 额外实参自动传址（数组须先按元素数重定义）。生成端在 systemLibraryRuntime FILE_STREAM_RUNTIME（CreateFileW 句柄注册表 + LockFile/UnlockFile）。
- `lingbuilder.std.datetime@1.1.0`（日期时间模块，共 22 条）新增日期时间族：名义类型 `日期时间` 是 64 位打包的本地年月日时分秒（0 表示无效时间，比易语言 100年1月1日 哨兵更早）。`时间_取现行/置现行(需系统权限，失败返回假)/从文本(支持"2026-09-16 12:30:25"“2026年9月16日12时30分25秒”"20260916123025" 等 8/14 位与分隔格式，失败返回 0)/到文本([0 全部|1 日期|2 时间]，输出"2026年09月16日08时30分05秒"风格)/指定(年,[月=1],[日=1],[时=0],[分=0],[秒=0]，超范围自动靠拢)/取年份/取月份/取日/取星期几(星期日=1)/取小时/取分钟/取秒/增减(单位 1 年份 2 季度 3 月份 4 周 5 日 6 小时 7 分钟 8 秒；月溢出自动靠拢如 1月31日+1月=2月28日)/取间隔(时间一−时间二，年季月取完整单位数)/取某月天数/取日期(时分秒归零)/取时间(年月日固定 2000-01-01)`。全部按本地时区，年份范围 1～9999；`时间_格式化时间戳` 等 5 条旧命令继续走 Unix 时间戳，两套表示不得混用。
- 2026-09-16 易语言迁移批次其余补齐：`lingbuilder.std.text@1.1.0`（共 24 条）新增 `文本_取左边/取右边(文本, 长度)`、`文本_码点转字符(码点 0～0x10FFFF，代理区与超界返回空，>0xFFFF 自动代理对)`、`文本_取码点(文本, [位置=0]，0 基、越界 0、代理对合成完整码点)`、`文本_删首空白/删尾空白`；`lingbuilder.std.math@1.1.0`（共 18 条）新增 `数学_取整(floor，-7.8=-8)/绝对取整(trunc，-7.8=-7)/四舍五入(数值,[位置=0]，四舍五入远离零)/取符号/正弦/余弦/正切/反正切(弧度)/自然对数(≤0 返回 0)/反对数(e^x，溢出 0)/置随机种子([种子=-1 取系统时钟]，与 数学_随机整数 共用线程本地引擎)`；`lingbuilder.std.bytes@1.1.0`（共 25 条）新增 `字节集_从文本(UTF-8)/字节集_重复(次数, 数据，结果超 256MiB 返回空)/字节集_分割(数据, 分隔, 结果数组, [数目=0 全部]，分隔为空按单字节 0，调用方声明 局部 字节集 分段[])` 与进制转换 `数值_到十六进制文本(负数输出 8 位 32 位补码)/到八进制文本/十六进制解析(容忍 0x 前缀)/八进制解析`（解析失败返回 0，超 8 位取低 32 位按补码）。
- LingBuilder 内置分类模块及命令事实来源为 `electron/src/services/modules/*LibraryModules.ts`，人类可读总表为 `docs/MODULE_ENCAPSULATION_CHECKLIST.md`。AI 只能根据当前项目实际启用模块使用文本、文件、系统、网络、数据库、图像等命令，不能因为模块是“内置”就假设项目已经启用。
- `lingbuilder.system.clipboard@1.1.0` 提供 10 条剪贴板命令。图片参数和返回值必须使用 `字节集`/`bytes`；不得把图片原始数据伪装成文本或 `raw`。`剪贴板_置图片字节集` 接受 DIB/DIBV5、BMP 文件字节和 GIF87a/GIF89a，检测到 GIF 时必须走原始 GIF 动画路径；需要明确 GIF 语义时使用 `剪贴板_置GIF字节集` / `剪贴板_取GIF字节集`。生成 C++ 可以出现 `std::vector<unsigned char>`、`CF_DIB(V5)`、注册的 `GIF`、`image/gif` MIME 和 `HTML Format`，但 `.lcpp` 不得要求用户把图片字节写成字符串。单个图片/GIF 上限为 256 MB，目标程序只请求静态 DIB 时不能承诺它会保留动画。
- `lingbuilder.database.sqlite@2.2.0` 提供 72 条 SQLite 接口和 `SQLite连接` / `SQLite语句` 受管类型。未成功取得非 0 连接前，不得宣称数据库可用，也不得隐藏 DLL 缺失、架构不符或导出不完整错误。新代码优先使用 `SQLite_打开连接`、`SQLite_准备`、强类型 `SQLite_绑定*` / `SQLite_取列*` 和显式释放；外部输入禁止拼接 SQL。批量写入应使用事务，活动数据库备份必须使用 `SQLite_备份到文件`，不能直接复制文件。2.1 起随附 SQLCipher 兼容运行库（SQLite3MultipleCiphers 2.5.1，来源与 SHA-256 见 `electron/third_party/sqlite/NOTICE.md`），F5 构建、AI Bridge 构建和 VS 工程导出会按目标架构自动复制到 exe 同目录；2.2 起加密算法可选：`SQLite_设置加密算法(算法)` 设置下一次加密打开使用的算法（进程级，支持 `sqlcipher` 默认、`sqlcipher3`、`rc4`、`aes128`、`aes256`、`chacha20`，传空恢复默认），`SQLite_探测加密算法(路径, 密码)` 只读依次尝试全部档位并返回命中的算法名（可直接交给 `SQLite_设置加密算法`），`SQLite_打开加密库(路径, 密码)` / `SQLite_打开加密连接(路径, 密码, 模式, 忙等待毫秒)` 按当前算法打开或创建加密库，`SQLite_运行库是否支持加密()` 判断运行库能力。打开存量加密库时会立即做一次真实读取校验密码，密码错误报“文件不是数据库”类中文诊断，不是静默失败；SQLCipher 3 兼容参数选 `sqlcipher3`，老版 wxSQLite3/RC4 格式（部分旧系统常见，如新点 Epoint 工程库）选 `rc4` 即可直接打开。密码是用户机密：不得写进 SQL、日志、源码、示例或文档，不得让 AI 编造或自动下载未知 DLL；明文库继续用 `SQLite_打开连接`，不得对明文库执行加密打开。原 7 条默认连接命令只用于旧源码兼容。`SQLite_取列名称` / `SQLite_取列数量` 属结果集元数据，`SQLite_准备` 成功后即可读取，不要求先步进；其余 `SQLite_取列*` 读值仍必须先步进到行。
- `lingbuilder.database.mysql@1.0.0`（MySQL 数据库模块，2026-09-11 起）为原生协议直连 MySQL/MariaDB 服务器的 43 条命令，含 `MySQL连接` / `MySQL语句` 两个受管类型：`MySQL_连接(主机, 端口, 用户名, 密码, 数据库)` 与 `MySQL_连接扩展`（+超时秒、启用SSL，TLS 走 Schannel）返回受管连接，连接成功自动协商 utf8mb4。新代码必须用 `MySQL_准备` + `?` 占位 + `MySQL_绑定整数/长整数/小数/文本/字节集/空值` 参数化执行，禁止把外部输入拼进 SQL；逐行读取用 `MySQL_语句步进`（1=得到一行，0=完成，-1=失败；首次步进自动执行语句）+ 强类型 `MySQL_取列*`，列索引从 0 起、参数索引从 1 起；事务用 `MySQL_开始事务/提交/回滚/设置自动提交`。连接失败（还没有连接句柄）用线程级 `MySQL_取错误()` / `MySQL_取错误码()` 读取中文定位与服务器原始错误；连接返回 0 后不得继续在该连接上调用其它命令，需要原始服务器错误文本时用 `MySQL_取连接错误(连接)`。随附运行库为 MariaDB Connector/C 3.4.10（`libmariadb.dll`，Schannel 构建，Win32/x64 双架构，来源、构建口径与 SHA-256 见 `electron/third_party/mariadb/NOTICE.md`），F5、AI Bridge 构建和 VS 工程导出按目标架构自动复制到 exe 同目录并强校验摘要；缺失或导出不完整时报中文阻断诊断，AI 不得编造或自动下载 DLL。密码与 SQLite 同规：不得写入 SQL、日志、源码、示例或文档。所有 MySQL 命令是阻塞调用，不得在界面事件里执行长查询或高频轮询；一个连接句柄只归创建线程使用，多线程用多线程模块配合每线程独立连接。与 `lingbuilder.database.odbc` 并存分工：ODBC 面向任意驱动，MySQL 模块提供原生协议、参数化预编译与结果集遍历。正式文档 `electron/docs/modules/mysql/README.md`，端到端验收 `npm run smoke:mysql-native`（需本机可达的 MySQL/MariaDB 服务，连接参数经 `LINGBUILDER_MYSQL_SMOKE_*` 环境变量注入）。
- `lingbuilder.data.excel@1.0.0`（Excel 表格模块，2026-09-12 起）提供 45 条 `Excel_` 中文命令和受管句柄 `Excel工作簿`，随附运行桥为 `LingBuilderExcel.dll`（libxlsxwriter 1.2.3 + OpenXLSX 0.5.1 等静态链接、MSVC /MT、Win32/x64 双架构，来源与 SHA-256 见 `electron/third_party/excel/NOTICE.md`），F5、AI Bridge 构建与 VS 工程导出按目标架构自动复制到 exe 同目录并强校验摘要；无需安装 Microsoft Excel，仅支持 `.xlsx`（`.xls` 给中文诊断）。两种模式必须区分：`Excel_创建工作簿` 是内存文档模型（`Excel_保存` 才写文件，保存后可继续修改再保存），全部格式与结构命令（`Excel_置列宽/置行高/合并单元格/冻结窗格/置数字格式/置加粗/置字号/置字体颜色/置背景色/置水平对齐/插入行/删除行/插入列/删除列`）仅创建模式可用；`Excel_打开工作簿` 经 OpenXLSX 保真修改既有文件（保留原样式与公式结构），格式与结构命令在打开模式**返回假并给中文诊断**，不得静默忽略或宣称可用。单元格坐标一律用裸地址文本（`"A1"`、区域 `"A1:C10"`）；批量行用分隔符文本（`Excel_写一行` / `Excel_追加行`，纯数字片段自动写数值，分隔符空文本按制表符），数组参数不能过 DLL ABI，不得改成数组接口。`Excel_写日期` 接受 `"2026-01-31"` / `"2026-01-31 08:30:00"`；创建模式套日期显示格式，打开模式只写序列值；1900-03-01 之前的序列与 Excel 相差 1（Excel 1900 闰年缺陷）。失败约定：句柄命令失败返回 0、布尔命令返回假、`Excel_追加行` 返回 -1，统一用线程级 `Excel_取错误()` 读取中文错误；`Excel_是否可用()` 判断随附运行桥可加载且导出完整，AI 不得编造或自动下载 DLL。与 DataGrid 的 `表格_导入Excel` / `表格_导出Excel` 并存分工：表格命令面向控件整表导入导出，本模块面向单元格级任意读写。正式文档 `electron/docs/modules/excel/README.md`，端到端验收 `npm run smoke:excel-native`。
- `lingbuilder.net.mail` 当前只支持不加密 SMTP，不支持 STARTTLS。AI 不得建议把真实邮箱密码交给该模块；生产邮件应等待 TLS 能力或使用经过审核的外部模块。
- `lingbuilder.archive` 只允许 ZIP 创建、解压和列出三个固定 tar 流程，不得借此拼接任意 shell 参数。
- `lingbuilder.advanced.memory`、`lingbuilder.advanced.hook`、`lingbuilder.advanced.process-memory`、`lingbuilder.advanced.com`、`lingbuilder.advanced.assembly`、`lingbuilder.advanced.driver` 均为高风险模块。AI 必须说明风险并取得用户明确意图后才能建议启用；不得将其加入普通项目模板或用它们绕过 AI Bridge 的执行权限。
- `lingbuilder.advanced.com@2.0.0`（COM自动化模块，2026-09-09 起）为句柄制 COM 自动化，共 27 条命令：`COM_创建对象`（返回 COM 句柄，0 为失败）、`COM_创建对象免注册(CLSID, 组件DLL路径)`、`COM_创建OCX组件(父窗口, 类标识, …)` + `COM_取OCX对象`、`COM_取文本/数值/逻辑/对象属性`、`COM_置文本属性`、`COM_调用方法/调用文本方法/调用数值方法/调用逻辑方法/调用对象方法`（可变参数）、`COM_挂接事件` / `COM_映射事件(对象, 事件ID, &处理器, [用户数据])` / `COM_取消挂接事件`、`COM_取事件对象参数`、`COM_启用/移除OCX消息转发`、`COM_取接口信息`、`COM_关闭(对象)` / `COM_关闭全部`、`COM_注册组件` / `COM_注销组件`（动态注册/注销随程序携带的 OCX，绿色免安装）、`COM_取组件路径(文件名)`（exe 目录定位）、`COM_取错误`。AI 必须遵守：COM 对象一律用句柄，旧 1.0「全局单对象、无参方法」签名不兼容删除，不得按旧签名生成代码；事件处理器必须写 `&处理器名`，签名固定为 `空 处理器(整数型 用户数据, 文本型 参数文本)`，事件参数按制表符拼接、对象参数为 `[COM对象]` 占位并在处理器内用 `COM_取事件对象参数(序号)`（从 0 起）取回新句柄；DISPID 先用 `COM_取接口信息` 查询再映射（输出含每个成员的返回类型、参数名与参数类型、出参/可省略/默认值标志；部分组件类型库只声明新增成员，继承成员不列出属组件自身行为）；免注册/OCX 组件位数必须与程序位数一致（32 位程序只能加载 32 位组件），不匹配会给中文诊断，AI 不得在位数不符时假装可用；`COM_取对象属性`/`COM_调用对象方法`/`COM_取事件对象参数` 返回的新句柄用完必须 `COM_关闭`；未注册控件会被 AtlAxWin 静默回退成 WebBrowser（表现为「无法访问此页」），命令现已用 `IPersist::GetClassID` 核对并给中文诊断，AI 不得把这种回退当成功；VB6 系控件（如 CCRP FolderTreeview）在 Advise 时按事件接口 DIID 校验接收器，模块已支持（24 条命令时代曾因此挂接失败，已修复）；若挂接仍失败，`COM_取错误()` 会给出 Advise 的 HRESULT 与事件接口 GUID；32 位 OCX 示例必须用 `--arch win32` 构建（进程内组件位数必须与 exe 一致）。运行时为纯 C++（`electron/src/services/windowDesigner/comRuntime.ts`），32/64 位双 target 同源编译；事件经 `WM_LINGBUILDER_COM_EVENT` 队列在窗口线程回调，处理器内可安全更新控件。对外文档见 `electron/docs/modules/advanced/com.md`。
- 已启用 `EdgeView 浏览器模块`（模块 ID：`lingbuilder.edgeview`，模块 `1.5.0`，安全能力 `edgeview.safe-api.v1/v2`）时，设计器工具箱会新增 `Edge浏览器 (EdgeBrowser)`；同窗多个实例、分组框和选项卡中的实例均拥有独立 HWND、Environment、Controller、WebView、Profile 和默认 UDF。地址、缓存、代理、User-Agent、脚本/消息/DevTools、缩放、静音、背景、Profile、隐私、语言、跟踪保护、自动填充及 v2 创建期选项由属性面板配置。AI 应优先使用中文控件名和目录化命令；旧数字实例 API只用于兼容纯代码布局。
- EdgeView 新异步命令返回受管任务 ID，完成处理器必须写 `&处理器名`，处理器内用 `EdgeView任务_取当前任务ID/取状态/取结果/取错误` 读取结果并在不需要时释放。旧的 `"处理器名"` 仅为迁移兼容，会产生警告；AI 不得继续生成字符串处理器。二进制结果必须写入明确文件路径，AI 不得请求或编造裸 COM、IStream、IUnknown、内存地址、任意 Host Object 注入、CompositionController、PointerInfo 或 AutomationProvider API。
- EdgeView 导出类命令（`EdgeView打印_PDF异步`、`EdgeView打印_PDF流到文件异步`、`EdgeView媒体_截图异步`、`EdgeView媒体_取Favicon异步`）的文件路径可以先写裸文件名或相对路径，运行期会按当前工作目录解析成绝对路径再交给 WebView2，任务结果回报的是解析后的绝对落盘路径；`设置JSON` 只接受 JSON 对象文本，键名使用 WebView2 驼峰写法（`orientation`、`scaleFactor`、`pageWidth`、`marginTop`、`shouldPrintBackgrounds`、`headerTitle`、`pageRanges`、`printerName` 等），未出现的键保持原设置，`{}` 表示不改设置。AI 生成导出代码时不得把 `设置JSON` 写成任意自由文本，也不得在同一个按钮里并发发起多个 `PrintToPdf`——WebView2 会把后发的判为失败；需要多个产物时一个按钮一个导出。
- EdgeView 同步执行接口 `EdgeView_执行JS` / `EdgeView_执行JS实例` / `EdgeView_执行JS控件` **不能写在 WebView2 事件处理器里**（`导航完成`、`标题改变`、`Web资源响应收到` 等）。这类调用现在会立即返回空文本并输出中文诊断，而不是等满 15 秒；需要浏览器事件之后的返回值时，改用 `EdgeView脚本_执行详情异步(控件, 脚本, &完成处理器)` 在完成处理器里 `EdgeView任务_取结果`。要在「创建完毕」里等页面就绪后再用同步接口，使用 `EdgeView_等待事件控件(控件名, "导航完成", 超时毫秒)`，控件名同样是裸 `controlRef`；该命令本身也不得写在其它浏览器事件处理器内。
- `EdgeView资源_读响应正文异步` 必须在 `Web资源响应收到` 处理器执行期间把 `responseHandle` 直接交给任务。把句柄存进成员变量、按钮点击或其它事件里再读会失败（`0x80004005`），这与响应来自真实网络还是 `EdgeView资源_设置事件响应文本` 的合成应答无关。AI 不得再生成「保存 responseHandle 稍后读取」的写法。
- EdgeView 最低兼容基线是 SDK `1.0.3537.50` / Runtime 141，完整编译基线固定为 SDK `1.0.4078.44` / Runtime 150；不得按本机“最新目录”漂移。普通 HWND 提供 71 项事件。同步决策未设置时必须保持 WebView2 默认行为；创建期属性变更后必须重建。设计画布只显示占位，AI 可建议执行“运行此 Edge 控件预览”，不得声称网页实时嵌入 React 画布。
- `edgeview.safe-api.v2` 覆盖受管对象、Frame/Worker、扩展、权限、通知、共享缓冲、附加文件对象、资源响应、证书、PDF 流和创建期 Options。AI 不得生成 CompositionController、PointerInfo、AutomationProvider、实验 API、裸 COM/指针、任意 Host Object 或未经用户明确选择的路径访问。
- EdgeView 全局代理使用 `EdgeView_设置全局代理`，只影响之后创建的实例；单实例代理使用 `EdgeView_创建实例代理` 或 `EdgeView_创建区域代理` 并覆盖全局设置。代理切换必须重建实例，AI 不得声称能在不重建 WebView2 Environment 的情况下热切换代理。
- **EdgeView Cookie 注入与导出回环（1.3.0，2026-09-18 落地）**：写入 Cookie 有三个层次——旧 `EdgeView会话_置Cookie(控件名, 名称, 值, 域, 路径)` 仅四要素保持兼容；需要元数据时必须用 `EdgeView会话_置Cookie带属性(控件名, 名称, 值, 域, 路径, 过期时间, 安全, 仅HTTP, 同源策略)`（过期时间为 UTC 秒双精度、-1 表示会话 Cookie；同源策略按 WebView2 枚举 0 None、1 Lax、2 Strict，None 必须同时启用安全）；整段 Cookie 列表注入一律用 `EdgeView会话_批量置Cookie(控件名, Cookie列表JSON)`（顶层必须是 JSON 数组，每项对象键名为 WebView2 驼峰 `name/value/domain/path` + 可选 `expires/secure/httpOnly/sameSite`，返回成功注入条数，非法 JSON 或顶层非数组返回 0 并给中文诊断），AI 不得再手工拆解 JSON 循环调单条命令。`EdgeView会话_取Cookie异步` 任务结果 JSON 每条附带 `expires/secure/httpOnly/isSession/sameSite`，与批量注入格式互为兼容，「导出→换 Profile/缓存目录→回灌」是官方多账号切换范式：不同登录态必须落在不同 `cacheDir`（独立 UDF）或不同 `profileName` 上，AI 不得把多账号 Cookie 回灌到同一 Profile。Cookie 值是敏感凭据：AI 不得把真实 Cookie 值写入示例、日志或 `.lcpp` 字面量，演示必须用占位值；过期时间过去值会被 WebView2 拒绝写入，生成脚本前先算好有效期。
- **EdgeView 多店铺独立弹窗与实例编号寻址（1.4.0，2026-09-19 落地）**：需要「浏览器是独立顶层弹窗、不内嵌程序窗口」的多店铺验证场景，必须走**实例编号 API**、不引用设计器控件名，用 `EdgeView_创建弹窗浏览器(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理)` 凭空建顶层窗口（`WS_OVERLAPPEDWINDOW | WS_VISIBLE` + `WS_EX_APPWINDOW`、无 `WS_CHILD`、任务栏可见、可独立拖动缩放，页面随 `WM_SIZE` 自适应，关闭主窗口经 `EdgeView_关闭()` 连带销毁全部弹窗、不留 `msedgewebview2.exe` 残留）。`独立缓存目录` 必填且逐店不同（店铺间 Cookie/存储隔离的唯一手段）；`用户代理` 必须在此命令传入以在首次导航前生效，运行时用 `EdgeView设置_置用户代理实例(实例编号, 用户代理)` 再改首个请求已带旧 UA。**每店铺独立出口 IP（1.5.0）**：弹窗各自走专属代理用 `EdgeView_创建弹窗浏览器代理(实例编号, 窗口标题, 宽, 高, 地址, 独立缓存目录, 用户代理, 代理地址)`——代理地址非空即该弹窗的 HTTP/HTTPS/SOCKS5 代理，且必须配合**不同 `独立缓存目录`**（不同 WebView2 环境=独立浏览器进程）才能真正换出口 IP；同一缓存目录共享浏览器进程时代理无法独立。基础 `创建弹窗浏览器` 的代理沿用 `EdgeView_设置全局代理`（全局未设=直连）。AI 生成多店铺独立 IP 场景时，禁止给多个弹窗传相同缓存目录却期望不同 IP。实例版会话/Cookie 命令按 `实例编号`（正整数）寻址、与 `导航实例/关闭实例/绑定事件/等待事件/执行JS实例` 复用同一编号：`EdgeView会话_批量置Cookie实例(实例编号, Cookie列表JSON)`、`置Cookie带属性实例`、`删除全部Cookie实例`、`取Cookie实例异步(实例编号, 地址, &完成处理器)`、`清理全部浏览数据实例异步(实例编号, &完成处理器)`。注入 `HttpOnly` Cookie 只能用这些 CookieManager 命令，**禁止 `EdgeView_执行JS` 写 `document.cookie`**（HttpOnly 写不进、且服务端取最后一个导致登录态不稳）。生命周期辅助：`EdgeView_关闭全部实例()`（返回关闭数量）、`EdgeView_枚举实例JSON()`（`[{实例编号,窗口标题,地址,缓存目录,代理,是否弹窗,是否有效}]`，用于「已开店铺不重复开、只切前后台」的自省）、`EdgeView_置实例可见/置实例大小/取实例大小JSON/置实例标题`。这些实例命令首参一律是整数 `实例编号`、不是 `controlRef`，不参与设计器控件存在性门禁；控件版 `EdgeView会话_*`/`EdgeView设置_*` 保持原样不变。改这些命令语义或 UA/Cookie 生效时机时同步本节、`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`、`electron/docs/modules/edgeview/API.md`（脚本 `npm run module:edgeview-api-docs` 重生成）与当天更新记录，并覆盖 `electron/tests/modules.test.ts`「EdgeView 1.4.0 多店铺弹窗」用例。
- **CEF3 / FBro 多店铺能力对齐（2026-09-19，与 EdgeView 同口径）**：CEF3 新增**设计器无关**的 `CEF3_创建弹窗浏览器(实例编号, 地址, 独立缓存目录, 代理地址)`（走已出货 `LB_CEF3_BrowserCreateChrome` Chrome Runtime 建独立顶层窗，不同 `独立缓存目录`=独立 profile、代理非空=独立出口 IP）与 `CEF3_创建区域(实例编号, 左,顶,宽,高, 地址, 独立缓存目录, 代理地址)`（运行时自建 WS_CHILD 承载内嵌多实例）；实例登记进 `cefBrowsers_`（合成 controlId=1000000+实例编号，与设计器控件空间隔离），`CEF3_枚举实例JSON()` 与 `CEF3_关闭全部实例()`（公开化）自动覆盖。CEF3 内嵌固定数量多缓存（每控件独立 RequestContext）本已具备；**CEF3 per-browser User-Agent（实例级 UA）已落地（纯运行时，无需重编桥）**：新增 `CEF3_设置用户代理(控件名, 用户代理)`（设计器控件）与 `CEF3_设置实例用户代理(实例编号, 用户代理)`（弹窗/区域），置非空 UA 时点亮桥 `LB_CEF3_ResourceRequestHandlerSubscribeBeforeResourceLoad` 订阅位，运行时在「资源加载前」事件里对 `packet->subject`（桥 `RegisterRequest` 出的活请求句柄）调 `LB_CEF3_RequestSetHeaderByName(..,"User-Agent",..,1)` 逐实例改写请求头，置空清除覆盖；`CEF3_取用户代理`/`CEF3_取实例用户代理` 回读。CEF 本身无 per-browser settings，请求头改写即官方范式，AI 需要多店铺各异 UA 时用这些命令（在首次导航前设置）。FBro 侧：`浏览器外壳_设置实例Cookie(稳定ID,地址,Cookie文本)` 现透传 `HttpOnly/Secure/Domain/Path`（host 本就支持），新增 `浏览器外壳_新建独立实例代理(稳定ID, 地址, 标题, 缓存目录, 代理地址, 用户代理)` 提供每店铺独立代理/UA（独立进程天然隔离出口 IP）；动态多实例/枚举/关闭全部复用既有 `浏览器外壳_新建独立实例 / 取运行快照JSON / 浏览器外壳_销毁`。三内核「每店铺独立代理 IP」共同前提不变：底层代理提供不同出口 + 同引擎各实例彼此隔离。
- **EdgeView postMessage 桥（reqId 回显协议，2026-09-13 实测）**：WebView2 的 `window.chrome.webview.postMessage` 是单向通道（页面→原生），没有 cefQuery 的内建应答关联与「延续」概念。需要应答时页面在载荷里带 `reqId` 并维护 pending 表，原生在「网页消息」处理器里 `EdgeView事件_取字段(控件,"message")` 取 JSON 分派后，用 `EdgeView脚本_发送JSON消息(控件, 应答JSON)` 回 `{reqId,ok,...载荷}`；页面按 reqId 派发回调。进度/状态推送走同一通道（`{kind:"dl",id,pct}`）。实测语义：页面 postMessage 发**字符串**时原生 `message` 字段收到的就是该 JSON 文本；原生 `发送JSON消息` 回发到页面 `message` 事件的是**解析好的对象**。`EdgeView脚本_发送JSON消息` 要求严格合法 JSON，非法时 `PostWebMessageAsJson` 静默失败返回 0——`JSON_转义文本` 返回的是**不带引号**的转义内容，JSON 字符串值的引号必须写在调用方自己的字面量里。异步工作（如卡密验证）用 `线程_提交完成(&工作,&完成,参数)` 把延后应答放工作线程，reqId 存成员变量，完成处理器（UI 线程）回发，处理器绝不同步等待。参考实现见 `AI 视频自主生产/进阶方案/高颜值应用商店-EdgeView/`。
- **项目级内嵌资源 + 内嵌资源模块（`lingbuilder.resource.embed`，2026-09-17 落地）**：项目模型顶层 `embeddedResources: [{name 逻辑名, file 源文件, extract? 启动释放}]`（工作区相对路径，跨窗口共享，条目 ≤4096、单文件 ≤256MB）。构建把源文件复制成 ASCII 归档名后随 `lingbuilder-app.rc` 编译为 RCDATA（资源号 **2301 起**按清单顺序，物化为构建/导出目录 `resources/res-NNNN.<ext>`），因此**中文路径/中文文件名都能安全内嵌**。运行期 8 条命令按逻辑名读取：`资源_取字节集` / `资源_取文本` / `资源_是否存在` / `资源_取大小` / `资源_列表` / `资源_保存到文件` / `资源_释放到临时目录` / `资源_取错误信息`（逻辑名大小写与斜杠方向不敏感，读失败返回空值并写中文原因）。`extract: 真` 的条目在 `wWinMain` 经 `LB_EmbeddedResourceReleaseExtracted()` **启动释放**到 `%TEMP%\lingbuilder-embedded\<工程ID>\<逻辑名>`（保持子目录结构，覆盖写）；未声明 extract 的资源全程不落盘。AI 生成相关代码时的边界：① 命令依赖模块启用，未启用时构建给中文阻断诊断；② 逻辑名必须与清单逐字对应（可用 `资源_列表()` 自检），不得凭猜测生成；③ 资源数据随 EXE 体积线性增长，不要内嵌 `.exe` 等可执行文件；④ 要内嵌 DLL 并调用其导出函数，用 `内存DLL_加载(资源_取字节集("dll/x.dll"), "x.dll")` 或项目 DLL 命令声明的 `加载方式 = 内存`。设计器侧入口：窗口属性 →「项目 / 内嵌资源（跨窗口共享）」面板，含「选择文件…」（多选自动复制进 `<项目源码根>/resources/` 并回填逻辑名）、「选择文件夹…」（递归展开、逻辑名保留相对路径）、「扫描目录」（引用工作区内已有文件、不复制）与一键启用模块。清单校验收敛在 `embeddedResourceService.ts`（面板与生成器共用同一份中文诊断）。解决方案资源管理器项目节点下同时提供**「内嵌资源」组**（按「逻辑名 + 启动释放」列出条目 + 「配置项目内嵌资源」入口）：入口执行命令 `workbench.action.project.configureEmbeddedResources` 打开**独立配置对话框**（不切换编辑器视图，保存走 `saveWindowDesignerState` 设计器状态通道），文本类源文件行点击直接在主编辑器打开；已声明为内嵌资源的源文件不再在 src 列表里重复出现。资源条目右键菜单（菜单区域 `solution/embeddedResource/context`）提供「打开源文件 / 复制逻辑名 / 复制源文件路径 / 配置项目内嵌资源」，菜单项经 MenuService 贡献、动作经 CommandService 执行。
- **旧「窗口内嵌文件」`embeddedFiles` 已弃用并自动迁移（2026-09-17）**：窗口模型 `embeddedFiles: [{file, extractName?}]`（旧 RCDATA 段 2001 起、≤8 个、释放名仅限字母数字点下划线连字符）在读取与生成时自动迁移成 `extract: 真` 的项目级内嵌资源（释放路径不变，仍是 `%TEMP%\lingbuilder-embedded\<工程ID>\<释放名>`），迁移后窗口上的旧字段被移除并给出中文弃用诊断（不阻断构建）；同名不同文件的冲突会阻断并要求改名。AI 不得再生成/推荐 `embeddedFiles` 写法，也不得声称「内嵌文件依赖窗口图标显示」——该耦合缺陷（图标选「不显示」时整批内嵌文件被静默丢弃）已修复：内嵌资源的 rc 行与图标开关完全解耦。旧释放函数 `LingBuilder_释放内嵌资源文件()` 已下线，改为统一调用 `LB_EmbeddedResourceReleaseExtracted()`。
- **进程内存扫描族 + 进程枚举 + 管理员自检（2026-09-18 落地）**：`lingbuilder.advanced.process-memory@1.1.0`（高风险模块，**默认随新项目启用**，可按项目禁用，依赖 `lingbuilder.std.buffer` 自动带上）新增 7 条命令：`进程内存_读字节集(句柄, 地址, 长度)`（单次上限 64MB，地址必须落在用户态 0～0x00007FFFFFFFFFFF，部分可读返回前缀并报 299）、`进程内存_读到缓冲区(句柄, 地址, 长度)`（返回缓冲区句柄）、`进程内存_枚举区域JSON(句柄, 只列已提交可读区域)`（VirtualQueryEx，JSON 含 baseAddress/regionSize/state/protect/type 十进制值）、`进程内存_扫描字节集(句柄, 特征, 最大命中数, 结果数组)`（返回命中数，结果数组为**长整数型数组**，内部 32MB 整读 + 8MB 分块 + max(1KB, 特征长-1) 重叠，命中升序去重，跨块不截断，AI 不得在中文代码里手搓分块）、`进程内存_扫描字节集JSON(句柄, 特征, 最大命中数)`、`进程内存_取错误码()` / `进程内存_取错误()`。`lingbuilder.process` 新增 `进程_按名称取ID列表(进程名, 结果数组)`（Toolhelp 枚举，exe 名不区分大小写、完整名匹配，结果为十进制 PID **文本数组**，用 `到整数` 转回）与 `进程_按名称取ID列表JSON(进程名)`；`lingbuilder.system.info` 新增 `系统_是否管理员()`（AllocateAndInitializeSid + CheckTokenMembership）。AI 生成硬边界：① 句柄只能来自 `进程内存_打开`，传 0 或裸值一律失败；② 打开失败错误码 5 = 拒绝访问（需管理员），必须先 `系统_是否管理员` 自检并把「没权限」与「没有数据」区分开，不得静默当空结果；③ 受保护进程（csrss/services 等 PPL）即使管理员也打不开，属正常失败；④ `允许写入=假` 打开的句柄不得生成写内存调用；⑤ 模块描述已改为「默认随新项目启用」，旧文档中「不默认启用」说法作废。
- **生成 exe 请求管理员权限（UAC，2026-09-18 落地）**：解决方案项目 `buildProperties.requireAdministrator: true` 时，IDE 内 F5/AI Bridge `build.run`/`native.export` 的直编链接参数追加 `/MANIFESTUAC:level='requireAdministrator'`（共享常量 `REQUIRE_ADMINISTRATOR_LINK_ARGS`），Visual Studio 导出工程在 vcxproj 四个配置写入 `<EnableUAC>true</EnableUAC><UACExecutionLevel>RequireAdministrator</UACExecutionLevel>`，两条链路行为一致；缺省不设置＝asInvoker，与历史项目完全一致。**该能力不能放在生成的 main.cpp 里**：`#pragma comment(linker, "/manifestuac:...")` 经实测不生效（MSVC 仅为 manifestdependency 提供 pragma 通道），必须在编译/链接调用点显式传参；`/MANIFESTUAC:level='requireAdministrator'` 不带外层双引号即可通过 `cl` 正确链接。翻转 `requireAdministrator` 后必须重新构建：增量构建指纹已纳入该字段（2026-09-18 修复，此前翻转命中增量缓存会跳过重链接，产物维持旧清单）。AI 不得为 DLL 项目声称 requireAdministrator 有提权效果（DLL 清单对启动提权无效）。

- **窗口内嵌站点（embeddedSite，零释放内存服务，2026-09-15 落地）**：窗口模型 `embeddedSite: { files: string[], entry?, host? }` 声明后，构建把网页静态文件（Vite/React dist 等，≤64 个、单个 ≤32MB，全部必须位于 entry 所在目录内）随 `lingbuilder-app.rc` 编译为 RCDATA 资源（ID 从 2101 起，物化为 `resources/lbsite-N.bin`），生成的 EdgeView 运行时注册 `WebResourceRequested` 拦截，对 `https://<host>/*`（缺省 `embedded.local`）的请求**直接从 EXE 内存资源应答**（按扩展名给出 Content-Type，未命中回 404）。运行期不向磁盘（含 %TEMP%）释放任何 HTML/JS/CSS 文件，配合静态链接即可单 exe 分发。使用前提：窗口必须含 EdgeBrowser 控件且项目启用 `lingbuilder.edgeview`（否则中文阻断诊断）；EdgeBrowser 的 `url` 属性直接填 `https://<host>/index.html` 即可自动导航；`files` 清单是显式模型数据，dist 重新构建后哈希文件名会变，必须同步更新清单再构建。无内嵌站点的项目不生成任何内嵌站点代码；`embeddedFiles`（%TEMP% 释放）与 `embeddedSite`（内存服务）相互独立。内嵌站点当前支持两种浏览器后端：**EdgeView**（WebResourceRequested 内存服务）与 **FBro**（进程内 FBroBrowser：生成运行时在 OnWindowCreated 创建浏览器后、导航前，把站点表逐条注册为 FBroHsVIPControl_AddResourceHandlerChangeData 整响应替换规则再导航入口，控件 url 填 about:blank 即可；整响应替换需要 FBro VIP 授权，无授权时逐条失败并给中文诊断；独立进程模式给出阻断诊断）。**CEF3 暂不支持**（CEF3 3.x 工程只消费桥 ABI、禁止 CEF 头文件进生成代码，需扩展 LingBuilderCefBridge 后另行支持，仅有 CEF3 模块时给阻断诊断）。设计器属性面板（选中窗口、未选控件时）提供「当前窗口 / 内嵌站点」编辑组：启用开关、主机名、入口文件与文件清单（每行一个工作区相对路径），「扫描目录」按钮递归回填清单；面板校验与生成器门禁同口径（`embeddedSiteModel.ts`）。参考实现见 `AI 视频自主生产/进阶方案/AI智能助手-EdgeView/`、`Cat小助手-EdgeView/`、`抖音助手-EdgeView/`。
- **EdgeView 单文件交付（WebView2Loader 静态链接，2026-09-15 落地）**：`lingbuilder.edgeview` 两个 MSVC target 的 libs 增加 `lib/<arch>/WebView2LoaderStatic.lib`，不再声明 `runtimeFiles`（WebView2Loader.dll）；构建时从 NuGet 固定版本包物化静态库并进链接行，生成运行时改为直接调用 `CreateCoreWebView2EnvironmentWithOptions` / `GetAvailableCoreWebView2BrowserVersionString`（WebView2.h 以 STDAPI 声明、无 dllimport），F5/CLI 链接统一 `/MANIFEST:EMBED`（清单内嵌 RT_MANIFEST，不再落外置 `.exe.manifest`）。EXE 不再依赖同目录 WebView2Loader.dll，可单文件复制运行；目标机仍需系统 WebView2 Runtime（Win10/11 自带 Edge 即满足）。WebView2 运行期会在 exe 旁（或 cacheDir 指定处）创建 `.edgeview/<app>` 用户数据目录，这是 WebView2 缓存而非释放的网页文件。

- **生成模板 WM_SIZE 拉伸全幅 EdgeBrowser（2026-09-13 落地）**：生成模板新增 `EdgeView_随窗口调整设计器控件`，在主窗口 WM_SIZE 中先于 `EdgeView_调整全部大小()` 调用，把「设计器 x/y=0 且宽高≥窗口」的全幅 EdgeBrowser 控件宿主拉伸到当前客户区——此前窗口最大化/缩放后 WebView2 子窗口保持创建尺寸、页面缩在角落（FBro 进程内浏览器不受影响，桥自己撑满窗口）。局部布局的 EdgeBrowser 控件保持设计器矩形不参与拉伸；需要随窗口重排的局部控件仍走窗口「大小被改变」事件 + `控件_设置位置大小` 的应用层布局。
- 已启用 `CEF3浏览器模块`（模块 ID：`lingbuilder.cef3.browser`）时，设计器工具箱会新增 `CEF3浏览器 (CefBrowser)` 控件；可在任意窗口添加多个实例，属性面板可设置打开地址 `url`、缓存目录 `cacheDir`、User-Agent、JavaScript/图片/WebGL 开关和代理。除原有导航、JS、前进后退、状态和事件绑定命令外，可用 `CEF3_是否有效(控件名)` 判断原生浏览器对象是否仍有效、用 `CEF3_是否弹出窗口(控件名)` 判断对象是否由 popup 流程创建、用 `CEF3_是否有文档(控件名)` 判断文档是否已加载、用 `CEF3_是否禁用窗口渲染(控件名)` 判断是否使用无窗口/OSR 渲染、用 `CEF3_是否网页全屏(控件名)` 判断网页是否通过 Fullscreen API 进入全屏、用 `CEF3_是否已准备关闭(控件名)` 判断是否进入必须完成的关闭阶段、用 `CEF3_是否渲染进程无响应(控件名)` 查询至少 15 秒未处理输入的渲染进程状态、用 `CEF3_强制刷新(控件名)` 忽略缓存刷新、用 `CEF3_页内查找(控件名, 文本, 向前, 区分大小写, 查找下一个)` 发起查找、用 `CEF3_停止页内查找(控件名, 清除选择)` 停止查找、用 `CEF3_是否静音(控件名)` 读取浏览器音频静音状态、用 `CEF3_取事件字段` 读取复杂事件字段，并用 `CEF3_设置事件结果` 和 `CEF3_设置事件返回文本` 响应同步决策事件。
- CEF3 同一 exe 内共享 Chromium 进程，但每个设计器控件必须创建独立 `CefRequestContext`；全局只设置 `root_cache_path`，实例 `cache_path` 必须映射为它的直接子目录，因此 Cookie/缓存可按实例隔离。代理必须在 RequestContext 初始化回调中通过 preference 应用；系统模式恢复默认 preference，直连使用 `direct`，固定代理使用 `fixed_servers`。`CEF3_设置缓存目录`/`CEF3_设置代理` 仍需在创建前调用，创建后调用无效。AI 不得继续使用“所有控件共享同一缓存”的旧说明。
- CEF3 高级对象按 `CEF3值_*`、`CEF3字典_*`、`CEF3列表_*` 使用长整数句柄；容器写入和读取都返回独立深复制，调用方仍须分别释放原值、返回值和容器。会话流程为 `CEF3会话_取上下文` → Cookie/缓存异步命令 → `CEF3任务_取状态/取结果/取错误` → `CEF3任务_释放` → `CEF3会话_释放上下文`。不要在同一实参列表中同时查询任务状态和结果，也不要把负错误码当成“假”。同步事件只能通过 `CEF3_设置事件结果` 和 `CEF3_设置事件返回文本` 返回；普通通知不得假设会阻塞 CEF 线程。
- CEF3 当前集中式目录包含 92 项用户事件名称和 113 条官方事件签名，事件域已完成；这不代表 CEF 150 全部 1577 个上游目录项已经封装。完整覆盖状态以 `docs/CEF3_API_COVERAGE.md` 和机器 JSON 为准；当前 alpha 仍存在 879 项 `planned` / 879 项 `needsReview`，AI 必须明确说明尚未全覆盖，不得把只有名称或目录项的能力描述为可运行。
- `LingBuilderCefBridge` 保留 v3 稳定 C ABI 导出，并用兼容式 v4 固定操作 ID、结构化结果和类型化句柄扩展新能力；`.lcpp` 和生成代码不得取得裸指针、`CefRefPtr` 或跨 DLL STL。文件读写只允许 Bridge 配置的根目录；必须释放返回的缓冲、列表和对象句柄，并把错误类型、只读、无效或重复释放作为稳定错误处理。其它尚未跨 Bridge 验证的 CEF 能力仍按 `mapped/planned` 报告，不得因 DLL 已存在就标为完整实现。
- `CEF3_绑定事件` 及所有 CEF3 回调型命令的处理器参数必须使用 `&处理器名`；引号字符串只允许迁移诊断读取，不得由 AI 继续生成。事件响应必须按专用 schema/默认动作扩展，不能把 `0/1/2/3` 套到证书、菜单、尺寸等全部回调。
- `CEF3_执行JS` 使用 DevTools `Runtime.evaluate` 返回真实 JSON，最长兼容等待 5 秒；应在主框架加载完成（例如加载状态变为非加载）后调用。新代码优先使用 `CEF3自动化_执行JS异步` 并通过 CEF3任务命令读取、取消和释放，不能声称旧命令仍然固定返回空文本。
- CEF3 的“新窗口打开前”事件返回 `1` 或保持默认时，允许 CEF 创建独立原生 popup 浏览器；返回 `2` 时拒绝，返回 `3` 时表示 LCPP 已自行接管。允许 popup 时，生成运行时必须把主内嵌浏览器与 popup 分开跟踪：popup 的创建、地址变化和关闭不得覆盖主浏览器句柄、地址栏状态或前进后退目标，关闭主窗口/控件时必须同时关闭其全部 popup。需要主动创建带 Chrome 地址栏和完整浏览器界面的顶层窗口时，必须调用 `CEF3_打开原生UI浏览器(控件名, 地址)`；该命令显式使用 `CEF_RUNTIME_STYLE_CHROME`、空父句柄和独立桌面顶层 HWND，不能把 LingBuilder 主窗口 `HWND` 传给 Chrome Runtime，否则原生 UI 会覆盖进内嵌宿主。不能用可能被拦截的脚本 `window.open`，也不得另造不受管理的裸 `CefBrowser`。
- CEF3 双形态实现不得混用宿主参数：内嵌控件固定使用 `SetAsChild(控件宿主HWND, CefRect)`；谷歌原生 UI 固定使用 `SetAsPopup(nullptr, ...)`、`parent_window=nullptr`、`WS_EX_APPWINDOW`、移除 `WS_CHILD` 和 `CEF_RUNTIME_STYLE_CHROME`。后续修改生成器时必须保留覆盖这些参数以及 popup/主浏览器隔离的回归测试。2026-07-28 已实机确认正确结果是两个可独立移动和缩放的桌面窗口，而不是 Chrome UI 覆盖在 LingBuilder 主窗口客户区。
- 构建 CEF3 项目提示 `SDK_DEPENDENCY_REQUIRED` 时，桌面 IDE 应显示 CEF3 环境 SDK 的名称、版本和下载体积，由用户确认后下载、校验并安装到共享缓存，再自动重试原操作一次；AI Bridge 与独立 CLI 不得静默下载，应要求用户先在桌面 IDE 触发安装。显式 `CEF3_SDK_ROOT`、工作区 `.lingbuilder/modules/lingbuilder.cef3.sdk/sdk`、旧 `.lingbuilder/cef3-sdk` 或 `C:\cef3-sdk` 仍可作为受控兼容来源。AI 不得声称只复制 `libcef.dll` 就能升级或修复 CEF3 内核：头文件、`.lib`、DLL 与资源必须同版本整体替换。
- CEF 150 原生工程必须使用 C++20 和动态 CRT `/MD`；F5、AI Bridge 与导出的 Visual Studio 四组配置必须消费同一原生依赖计划。使用预编译 `/MD` wrapper 的 Debug 项目仍生成调试信息，但必须使用 `NDEBUG`，不能同时定义 `_DEBUG` 造成 Debug/Release CRT 混链。遇到 `<concepts>` STL4038 或 `convertible_to` C2061 时应重新生成工程以刷新 `stdcpp20`，不得修改 CEF SDK 头文件规避。
- 当前按需下载的 CEF 150 SDK 仅支持 x64。项目启用 CEF3 时 IDE 应自动切换为 x64，构建前必须再次校正，不得用 Win32 尝试链接 x64 CEF；如用户明确需要 32 位，应说明当前需要另行制作并验证完整的 32 位 SDK 包。
- IDE 构建目录内 CEF3 生成的 Visual Studio exe 必须输出到对应 `$(Platform)/$(Configuration)/bin/` 运行目录，与 `libcef.dll`、`v8_context_snapshot.bin` 和 Resources 同目录；不得把“MSBuild 成功但运行时资源缺失”报告为可正常运行。对 `generated/cpp` 可移植导出必须单独检查 SDK/资源是否随工程输出。
- 生成严格精简 Windows 安装包必须通过 CEF3/FBro 发布门禁：源 SDK 先完成制作来源校验；`win-unpacked` 与最终 NSIS 归档不得出现 `lingbuilder.cef3.sdk` 或 `lingbuilder.fbro.sdk` 的任何路径、清单、README、SDK、运行时或桥接二进制。需要浏览器能力时必须先安装独立模块包或受控完整模块目录。AI 不得建议跳过 Electron Builder 前后钩子、`verify:cef3-installer` 或 `verify:fbro-installer`，也不得声称严格精简安装包自带或可自动下载 CEF3/FBro。
- `new_emoji` 底层 `EU_` API 使用 UTF-8 字节指针和长度，AI 不应把普通中文字符串直接塞给底层 API。
- 生成 new_emoji 独立演示窗口时，事件块仍必须用独立一行 `结束` 收尾；不要额外写显式退出命令 `结束()`，否则 exe 会创建窗口后马上退出，表现为闪退。
- 纯 new_emoji 示例应在创建窗口、文本、按钮等控件后进入 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。设计器生成链路会在控件和“创建完毕”处理器执行完成后、消息循环之前调用 `NE_显示并激活窗口`，确保 F5 后台启动的窗口恢复、刷新并出现在 IDE 前方；该桥接只短暂提升窗口层级并立即取消置顶。AI 不得通过修改用户 `.lcpp` 或增加永久置顶逻辑修复启动显示问题。
- 如果混用 LingBuilder 默认 Win32 窗口和 new_emoji 自建窗口，必须明确主消息循环和生命周期归属，不能让默认空窗口关闭后触发 `PostQuitMessage(0)`。
- 「用 AI 生成模块（不需要会 C++）」当前共有三条入口，全部落到同一导入管线：`aiModuleImportParser` 拆文件，走 `/api/modules/developer/import-ai-files` 写入 `.lingbuilder/module-build/<manifest.id>`，再在校验、导出 `.lbmod`、`/api/modules/package/preview` + `/install` 后由项目启用并 F5。(1) 一键生成（推荐）：模块页「AI 生成模块 → 一键生成」把规范全文和需求交给内置 AI——系统 AI 通道由 renderer 编排 `cloudAi.start('chat')` 按「清单 → 其余文件 → 缺失补全」三阶段流式生成（每阶段解析失败自动纠正重试一次；请求带 `maxOutputTokens: 16384` 与 `thinking: 'disabled'`，云端 ProviderService 据此对上游禁用思考——模型输出上限与思考流入正文曾使单轮生成必然截断，见 2026-09-09 验收记录），本地解析导入；自定义 API 通道走 `POST /api/modules/ai-generate`（server.ts，`aiModuleGeneration.ts` 组装提示词）由服务端生成、解析、导入一步完成；规范文档路径由 `LINGBUILDER_AI_MODULE_SPEC_PATH` 注入，缺省从规则手册目录推导。(2) AI Bridge MCP：外部 AI 通过 `lingbuilder.module.scaffold/writeFiles/validate/pack/installPreview/install` 六个受控工具端到端生成、校验、打包、预览并安装模块（安装必须先 installPreview 拿 previewId，再显式 `approved=true`）。(3) 手动复制粘贴（降级）：「复制 AI 开发规范」按钮读入剪贴板，用户粘贴给任意外部 AI 后把回复粘回 IDE。一键生成与 BYOK 通道依赖对应的账号或 Key 配置；手动链路不依赖云端账号、BYOK 或 AI Bridge 写入权限，AI 不得声称手动链路需要联网授权或额外服务端才能导入模块。
- AI 生成的模块包必须让每条中文命令同时出现在 `contributes.commands` 和 `bindings.commands`：前者只负责补全、提示和文档，后者才是确定性 C++ 映射。IDE 在「导入到 module-build」和「③ 校验模块」两处强制比对，缺失时给出阻断诊断「命令 X 缺少 bindings.commands 映射：编辑器能补全，但无法生成 C++ 调用；请让 AI 补上同名 binding。」，只补 contributes 而无 binding 的结果不得报告为可用模块。
- AI 生成模块导入前的 manifest 和模块内容校验使用 `requireCommandBindings: true` 严格模式；清单结构、命令 binding、非空文档、非空示例和声明文件必须全部通过后，才允许把同盘临时目录原子替换到目标目录，失败不得留下部分写入。目标目录已有同名文件时导入结果必须带 `overwrittenExisting` 并在界面给出覆盖提示，且不得删除旧目录中本次未包含的文件。导入上限固定为 200 个文件、单文件 1 MB、合计 10 MB，路径只允许包内相对路径，禁止绝对路径、盘符、`..` 和大小写冲突别名；AI 不得绕过这些限制或把模块写到 `.lingbuilder/module-build/` 之外。
- AI 生成模块导入或校验失败时，必须保留 IDE 展示的完整中文错误标题和逐行诊断；用户可使用“复制错误详情”把完整文本粘贴回 AI。AI 收到这段诊断后应逐条修正原始模块清单或源码，不能删掉诊断行、用普通文本型伪装 `controlRef`，也不能把校验失败描述成模块已可用。
- AI 生成模块的示例命令、参数与返回值必须与提交到 `bindings.commands` 的签名逐项一致，并至少附带一份真实存在、非空、UTF-8 的中文文档；不得编造模块内不存在的命令、受管类型或平台 target。当前实测闭环只覆盖 `windows-msvc-win32`，AI 不得承诺未验证的 x64/macOS 或第三方 `.lbmod` 兼容性。

## 6. C++ 生成边界

LingBuilder 的目标是把中文源码和设计器模型确定性生成真实 C++ 代码，再编译运行。AI 不能替代确定性生成器。

- TypeScript 模板生成 C++ 字符串字面量时必须保留 C++ 所需的反斜杠转义；例如要输出 `\t`、`\r`、`\n` 时，TypeScript 模板内必须使用双重转义，禁止把真实换行写进 C++ 字符串字面量。
- 多个可选内置模块运行时共同调用的 C++ 辅助函数必须放入公共运行时片段，不能只由其中一个可选模块提供；编码、JSON 等模块在未启用字节模块时也必须能够独立生成和编译，公共 helper 必须先于模块片段输出且只定义一次。
- 设计器与 Win32 运行时的基础控件外观必须保持一致：普通按钮使用同一个原生 owner-draw HWND 圆角绘制普通、悬停、按下、键盘焦点和禁用状态，悬停/按下色必须从设计器配置颜色确定性推导；状态切换只能失效重绘，不得移动、缩放或重建控件区域，禁用按钮不得响应悬停视觉状态。按钮等可交互控件必须通过 `WS_TABSTOP` 和窗口消息循环支持真实 Tab 导航，不能只靠鼠标或测试代码强制聚焦。确定进度条根据最小值、最大值和当前位置在原生控件中央显示百分比文字。不允许只在 React 设计器预览中模拟这些效果。
- owner-draw 复选框和单选框必须维护独立运行时勾选状态，并继续响应 `BM_GETCHECK` / `BM_SETCHECK`；鼠标点击、键盘空格、`控件_设置勾选` 和单选组互斥必须读取同一状态源、立即重绘并发送状态变化通知，不能假定 `BS_OWNERDRAW` 会像 `BS_AUTOCHECKBOX` 一样自动保存勾选状态。三态复选框必须循环未选中、选中和中间态，并为中间态绘制明确横杠。
- owner-draw 复选框和单选框的 `background: "transparent"` 必须在绘制整行背景时解析实际父容器颜色；位于选项卡页面、分组框或嵌套透明容器中时应逐级继承，不能把生成数据中的窗口回退色当作控件实色填充。显式背景色仍使用控件自身颜色。
- 复选框和单选框的焦点提示只能强化左侧方框/圆点，不得复用普通按钮的整块圆角焦点环包围整行文字；勾选状态本身也不得产生横跨控件全文的额外边框。
- 普通单行编辑框不得回退到 `WS_EX_CLIENTEDGE` 亮色立体边框，也不得在 EDIT 本体上用 `WM_NCCALCSIZE` / `WM_NCPAINT` 修改客户区或绘制外框。Win32 运行时必须由独立圆角 frame 唯一绘制暗色背景、普通/聚焦细边框，内层无边框原生 EDIT 只负责输入，从而保留输入法、选择、剪贴板和密码行为。
- 编辑框支持 `verticalAlign` 专属属性：`top`、`center`、`bottom`，默认 `center`。设计器预览和 Win32 单行 EDIT 必须消费同一属性；Win32 应根据真实字体度量布置内层 EDIT，多行编辑框继续铺满内容区，不得强制套用单行几何。
- 非编辑组合框的 `height` 只定义收起状态的可见高度，`properties.dropDownHeight` 独立定义展开列表高度。Win32 运行时可以保留完整下拉窗口区域，但收起态的背景、边框、文字和箭头只能按 `height` 裁剪绘制，不能让隐藏下拉区域的边框穿出分组框或覆盖相邻控件。
- 增强组合框（`ComboBoxEx`）同样使用 `properties.dropDownHeight`（40–600，默认 160）定义展开列表高度；其收起项、下拉项目和下拉空白区必须确定性消费设计器的 `background`、`foreground` 与图像列表，不能回退成系统白底黑字，也不能把控件自身 `height` 当作展开高度。
- 分组框的 Win32 宿主使用可承载子控件的自绘 `STATIC` 容器并启用 `WS_EX_CONTROLPARENT`，边框和标题只由 LingBuilder 绘制；不得重新叠加 `BUTTON + BS_GROUPBOX` 的系统主题绘制，否则后续重绘可能留下穿出分组框的单像素边框残影。分组框仍必须转发子控件命令、通知、颜色和 owner-draw 消息。
- 列表框的项目必须写入设计器模型 `properties.items`，属性面板按每行一个项目编辑；表项高度写入 `properties.itemHeight`（默认 28，范围 16–96），项目区域相对边框的统一内边距写入 `properties.contentPadding`（默认 4，范围 0–24）。滚动条外观写入 `properties.scrollBarVisibility`（`auto`、`visible`、`hidden`）、`scrollBarWidth`、`scrollBarTrackColor`、`scrollBarThumbColor`；隐藏只隐藏视觉滚动条，溢出内容仍须支持鼠标滚轮和键盘滚动。边框和选中外观分别写入 `properties.borderWidth`、`borderColor`、`selectionStartColor`、`selectionEndColor`、`selectionBorderColor`、`selectionCornerRadius`。原生 Win32 列表框必须消费同一组模型字段，通过 `LB_SETITEMHEIGHT`、独立边框承载层、`LBS_OWNERDRAWFIXED` 和 GDI+ 渐变圆角绘制保持 F5/导出与设计器一致，不能回退为系统 `WS_VSCROLL`、系统行高、白底、立体边框或系统蓝色矩形选中条；自绘滚动条必须自行处理 `WM_MOUSEWHEEL`，并避免在顶部索引未变化时重复布局或重绘选中项。
- `.lcpp` 允许使用注册表中的窗口事件短名，例如 `事件 创建完毕()`；语言服务必须把这种写法识别为当前类的窗口事件，不能按控件事件报告“控件不存在”。生成 C++ 模板里的窄字符和宽字符空字符必须分别保留为可见转义 `'\\0'` 与 `L'\\0'`，不得向源码写入真实 NUL 字节。

AI 必须遵守：

- 不要声称 IDE 内隐藏逻辑可以替代导出的 C++ 工程行为。
- 修改 `.lcpp` 时，应让生成器能够读取并转换结果。
- 涉及 Win32、窗口、消息框、调试输出、打开窗口等行为时，优先使用已有中文 DSL 命令。
- 导出或构建原生项目时，应把生成的 C++ 源码、模块依赖和 Visual Studio 工程文件视为同一个确定性产物；不要只报告 IDE 内部 exe 而忽略 `.sln/.vcxproj`。
- 不确定生成器是否支持的新语法，不要直接写入核心业务逻辑；应在说明中提示需要扩展规则模块。
- 不要在 AI 回复里要求用户手工复制大段文件；应返回可应用的工作区编辑提案。
- Win32 控件类型、属性、事件和原生适配器以 `win32ControlRegistry.ts` 为唯一实现目录；新增控件必须同步模块贡献、设计器、语言服务、生成器和测试，不能只增加工具箱按钮。
- 基础/高级普通 Win32 可视控件统一提供 `MouseDown`、`MouseEnter`、`MouseLeave`；只有当前原生样式可可靠取得焦点的控件才提供 `GotFocus`、`LostFocus`。标签、图片框、动态图像另有 `Click`；标签、图片框、动态图像、分组框、进度条、状态栏、动画控件和平面滚动条不提供焦点事件。颜色选择器和视频播放器使用各自专用事件，AI 不得为任何控件编造注册表中不存在或运行时不可达的通用回调。
- 非可视资源属性必须使用设计器真实字段：ToolTip 为 `text/targetControlId/initialDelay`，FileDialog 为 `ownerWindowId/triggerControlId/dropTargetId/title/filter/multiple/allowDrop`，ContextMenu 为 `ownerWindowId/targetControlId/items`，PopupMenu 为 `ownerWindowId/items`，PropertySheet 为 `title/pages`。菜单项选择逐项绑定；属性页应用使用 `Applied` 事件卡片，AI 修改时必须同时维护资源绑定和 `.lcpp` 处理器。
- 系统通用对话框使用高级控件模块已绑定的 `打开文件`、`保存文件`、`选择文件夹`、`选择颜色`、`选择字体`、`查找文本`、`替换文本`、`打印`、`页面设置`、`任务对话框`；上传控件使用同模块的 `上传_*` 命令，不得让 AI 拼接任意 shell 或隐藏宿主调用。

## Visual Studio 工程导出工具集与生成事件规则（2026-09-11）

- 生成的 `.vcxproj` 平台工具集不得写死 `v143`。导出、F5 中间工程和 windows-dll 模板统一消费 `electron/src/services/windowDesigner/msvcPlatformToolset.ts` 的探测结果：`vswhere` 找最新 C++ 安装 → 枚举 `MSBuild\Microsoft\VC\<版本>\Platforms\{Win32,x64}\PlatformToolsets` 中两平台共有的最新 `v<数字>` 工具集；非 Windows、无 vswhere 或无工具集目录时回退 `v143`。`exportVisualStudioProject` 未显式传 `platformToolset` 时自动探测；新增任何生成 vcxproj 的链路必须复用同一探测器，禁止再硬编码工具集（否则用户在本机拿到 MSB8020 无法编译的工程）。
- 生成的 `<PostBuildEvent><Command>` 里多条命令必须以真实 CRLF 分隔，且写入 XML 时 CR 必须转成字符引用 `&#xD;`（`xmlEscapeMultilineText`）。原因：XML 解析会把文本节点中的 CRLF 规范化为 LF，而 cmd 执行 LF-only 多行批处理会按字节偏移错位解析后续行，表现为 MSB3073 退出码 3 +「文件名、目录名或卷标语法不正确」「系统找不到指定的路径」，且只有第一条命令能成功。首行保留 `if not exist "$(OutDir)" mkdir "$(OutDir)"` 兜底。手工改 vcxproj 模板时不得把换行改回裸 CRLF/LF 文本。

## 7. AI 编辑安全规则

AI 生成代码修改时必须遵守：

- 只修改本次请求中允许编辑的工作区文件。
- 返回发生变化文件的完整内容，不能只返回片段。
- 不要静默批量改写大量文件；批量改动必须可预览、可确认、可撤销。
- 不要删除用户已有代码、注释、缩进或结构，除非用户明确要求。
- 不要重命名类、事件、控件、文件和配置键，除非用户明确要求。
- 如果无法确定，应生成保守修改，并在说明中写清楚风险。
- AI 输出必须为有效 JSON 时，只返回 JSON，不要包 Markdown 代码块。

## 8. 常见修复模板

### 8.1 事件不存在

如果设计器绑定了事件但 `.lcpp` 中缺少处理器，AI 应补全类似结构：

```text
事件 按钮1_被单击()
  调试输出("按钮1 被单击")
结束
```

### 8.2 打开窗口

如果用户要求点击按钮打开另一个窗口，AI 应优先使用项目已有窗口类和 DSL 命令：

```text
事件 按钮1_被单击()
  打开窗口(登录窗体)
结束
```

### 8.3 退出确认

```text
事件 按钮退出_被单击()
  信息框("确定要退出吗？", 64, "确认")
  结束()
结束
```

### 8.4 调试输出

```text
调试输出("当前步骤已执行")
调试输出("当前选择项", 控件_取选择项(列表框1), 真)
```

`调试输出` 支持使用英文逗号分隔任意数量参数，参数可以是文本、整数、逻辑值或其他可输出的确定性表达式；生成的原生 C++ 会按 `, ` 连接各参数。不要为了输出整数而插入原生 `std::to_wstring` 临时代码。

控件数值可以直接参与确定性算术表达式，例如 `控件_设置数值(进度条1, 控件_取数值(进度条1)+10)`；文本参数会在嵌套调用中保持 Win32 宽字符串语义，AI 不应为规避 C++ 类型问题插入原生字符串前缀或改写中文源码。

## controlRef 控件引用生成规则

- 任何参数只要语义是设计器可视控件、非可视组件或设计器资源，就必须使用模块 binding 的 `controlRef`，并显式声明 `controlKinds`、`scope`、`runtimeRepresentation`；需要限制具体类型时同时声明 `controlTypes`。
- `.lcpp` 只能生成裸控件名，例如 `控件_设置文本(操作结果, "完成")`。禁止生成 `控件_设置文本("操作结果", "完成")`，也禁止把 controlRef 当作普通文本变量、路径或 JSON 字段。
- AI 修改旧源码时，只有语言服务确认参数是 `controlRef`、目标唯一、类型兼容且作用域正确，才可移除引号；未知名称、同名歧义、跨窗口或类型不匹配必须保留源码并解释诊断。
- C++ 中可以按后端契约转换为 `L"控件名"`、稳定 ID 或原生句柄，但这种 ABI 表示不得反向污染 `.lcpp`。普通 Win32、new_emoji 和未来后端必须复用同一 binding、设计器符号和生成诊断。
- 普通 Win32 的 `stableId` / `nativeHandle` 只能由窗口实例解析；生成器必须让对应转换辅助函数可被派生窗口事件调用。源码型模块若把 `wideString` 用于用户可编辑文本，其 C++ 入口必须兼容 `控件_取文本` 产生的动态 `std::wstring`，不能只接受恰好能编译宽字符串字面量的签名。
- 微信 `4.1.10.27` 多开项目必须使用 `微信4.1.10.27多开管理模块`：窗口创建时调用 `微信多开_绑定监控界面(微信实例列表, 状态栏, 运行日志, 防撤回总开关)`，启动按钮调用 `微信多开_启动微信(控件_取文本(微信路径输入))`。总开关必须绑定明确的 `Click` 处理器，并把 `控件_取勾选(防撤回总开关)` 传给 `微信多开_设置总防撤回`；不得仅切换按钮颜色或依赖模块抢先消费 `WM_COMMAND`。总开关默认开启防撤回与撤回灰条提示，列表“防撤回”列允许单独控制已登录实例；不得改回 `程序_启动`、窗口标题扫描或“等待外部消息”的伪资料；wxid、昵称和头像只能显示 Host/Agent 的真实快照。Host 中状态为 `stopped` 的历史实例必须在发布到界面前过滤，不得进入列表、计数或头像下载。

## 9. AI Bridge 外部客户端规则

LingBuilder 可以通过本地 AI Bridge 让外部 AI 客户端连接工作区。外部客户端必须遵守以下规则：

- IDE 的“AI Bridge 连接中心”是默认接入入口：由主进程托管独立 CLI 子进程，并向 Codex CLI、Claude Code、Gemini CLI 或通用终端提供当前工作区的临时连接环境。切换工作区或退出 IDE 时必须停止该 Bridge。
- ChatGPT/Codex Windows 桌面客户端必须作为独立客户端检测，不得用 Codex CLI 的 PATH 状态代替。桌面端使用当前工作区 `.codex/config.toml` 中由 LingBuilder 标记管理的 `mcp_servers.lingbuilder_desktop`，通过 `--mcp --stdio-only` 直接拉起同一 `AiBridgeService`；该模式不监听网络端口、不需要 Token，且只能暴露当前 Codex 项目工作区。
- 写入 Codex 项目配置时必须保留用户其他 TOML 设置；非托管同名配置必须先报告冲突并取得明确替换确认。配置写入晚于桌面客户端启动时间时必须提示完全重启桌面端，不能声称已经热加载。移除配置只能删除 LingBuilder 托管段。
- 默认 MCP 传输为带 Bearer 鉴权的 Streamable HTTP，地址固定为 `/api/ai-bridge/mcp`；`--mcp` 仅用于额外启用传统 stdio。MCP HTTP、MCP stdio 与 REST API 必须复用同一 `AiBridgeService`，不得复制工具实现或绕开审计。
- 当前 MCP 工具清单必须与 `mcpServer.ts` 同步，共 23 项：`lingbuilder.workspace.list`、`lingbuilder.file.read`、`lingbuilder.file.search`、`lingbuilder.lingcpp.diagnostics`、`lingbuilder.edit.propose`、`lingbuilder.edit.apply`、`lingbuilder.project.templates`、`lingbuilder.project.create`、`lingbuilder.project.create.undo`、`lingbuilder.build.run`、`lingbuilder.modules.list`、`lingbuilder.module.info`、`lingbuilder.build.stop`、`lingbuilder.run.wait`、`lingbuilder.run.log`、`lingbuilder.native.preview`、`lingbuilder.native.export`、`lingbuilder.module.scaffold`、`lingbuilder.module.writeFiles`、`lingbuilder.module.validate`、`lingbuilder.module.pack`、`lingbuilder.module.installPreview`、`lingbuilder.module.install`。新增或删除工具时必须同步更新 CLI、桌面连接中心、使用手册和测试。`modules.list` 只返回模块摘要（含命令数与文档路径），完整命令签名、参数说明和示例必须用 `module.info` 按 moduleId 查询（`query` 过滤、`includeAdvanced` 展开高级命令、超 500 条自动截断）。
- 模块 MCP 工具的路径边界固定为：`module.scaffold`/`module.writeFiles`/`module.validate` 只接受 `.lingbuilder/module-build` 下的路径，`module.pack`/`module.installPreview`/`module.install` 的包路径只接受 `.lingbuilder/module-packages`；写入与打包受权限模式控制（`preview` 模式必须显式 `approved=true`），全部写操作进 `.lingbuilder/ai-bridge-log.jsonl` 审计；`module.install` 必须传 `installPreview` 返回的 `previewId` 且不能绕过收费模块的权益门禁，不得静默安装。
- 默认只连接 `127.0.0.1` 本地端口，并使用 token 鉴权。
- HTTP Bridge Token 只允许保存在 Bridge 主进程内存并通过 `LINGBUILDER_AI_BRIDGE_TOKEN` 注入 Bridge/受控终端子进程环境；不得把实际值放入子进程命令行。HTTP 客户端托管配置只能保存环境变量占位符，不得把 Token 写入用户全局配置、工作区、日志或命令文本。ChatGPT/Codex 桌面端的纯 STDIO 模式不得生成或要求 HTTP Token。
- 默认权限模式为 `preview`：读取、搜索、诊断和生成修改提案可以直接执行；写文件、导出工程、构建运行必须显式确认。
- `readonly` 模式禁止写文件、导出工程和构建运行。
- `yolo` 模式只允许用户明确开启；开启后仍只能执行 LingBuilder 暴露的受控工具，不能开放任意 shell。
- 外部 AI 新建项目必须先读取规则、模块和示例上下文，再按 `lingbuilder.project.templates` → `lingbuilder.project.create` 预览 → 用户一次批准 `approved=true` → 使用返回的 `result.project.id` 调用 `lingbuilder.modules.list` → 读取真实源码/设计器 → `lingbuilder.edit.propose/apply` → `lingbuilder.lingcpp.diagnostics` → `lingbuilder.native.preview` → `lingbuilder.build.run` → 需要观测运行时再依次使用 `lingbuilder.run.wait`（等退出拿退出码）、`lingbuilder.run.log`（读控制台输出）、`lingbuilder.build.stop`（停受控进程）的顺序工作。`edit.propose` 的 `workspaceFiles` 可省略（服务端自动读盘，磁盘不存在的路径按新建文件处理）；显式传入时未提供基准的草稿文件会被拒绝而不是静默丢弃。同一方案在用户批准后不应重复询问；只有需求、模块或目标发生变化时才重新确认。`project.create` 支持 `blank-window`、`hello-window`、`sqlite-crud-window`（表单+列表视图+SQLite 增删改查完整示例，默认启用基础控件与 SQLite 模块）等受控模板，统一生成解决方案项目、中文源码、设计器模型、固定全局/类型文件、配置和项目级模块引用；不得直接在工作区外拼接项目或把设计器状态留在模型上下文中。
- `project.create` 的预览不得写入新项目；`preview` 权限写入必须显式 `approved=true`。成功结果中的 `receipt.receiptId` 只允许在创建文件 SHA-256 未变化时通过 `lingbuilder.project.create.undo` 或 `lingbuilder project undo-create --yes` 撤销；检测到用户/AI 修改、新文件、项目引用或路径异常时必须阻断，不能覆盖代码。
- `project.create` 的 `enabledModuleIds` 必须通过模块服务解析依赖、检查清单和 Permit；省略该字段时继承根目录 `.lingbuilder/project-modules.json` 的已启用模块，预览会标记 `modules.selection=global-default` 并展示 `modules.projectModuleFile`；显式传空数组才表示仅使用 `lingbuilder.win32.basic`。创建后必须把完整清单写入 `.lingbuilder/projects/<projectId>/project-modules.json`。`modules.list`、诊断和编辑请求使用 `projectId`；原生预览、导出和构建请求支持 `project`（完整 `designerProject`）与 `projectId` 二选一（2026-09-18 起，推荐只传 `projectId`，服务端自动读取该已注册项目的磁盘设计器模型；两者全缺或项目未注册会被中文错误拒绝）。普通未知项目仍默认只有基础模块，AI 不得把未明确启用的网络、浏览器或高风险模块写入模板。
- `openInWorkbench=true` 时，创建服务写入受控工作台导航请求。IDE 收到事件后必须先保存当前编辑，再刷新解决方案、切换项目、打开主 `.lcpp` 并确认导航请求；不得用 DOM 查询、隐藏 localStorage 或静默丢弃脏编辑模拟项目切换。导航请求包含稳定项目 ID、主文件路径和窗口 ID，只能在当前工作区内解析。
- 不启动 IDE 时可使用 `tools/codex-configurator/` 的独立 C++ 配置器选择 `readonly`、`preview` 或 `yolo`，但配置器只能写当前工作区的 `.codex/config.toml` 托管段，必须保留其它 TOML、拒绝未确认的同名 MCP 接管、不写入 Token，并继续使用 `--mcp --stdio-only` 启动同一受控 `AiBridgeService`。YOLO 仍只允许 LingBuilder 已暴露的受控工具，不能被解释为任意 Shell 权限。
- 外部 AI 修改代码必须优先调用 `edit.propose` 生成 `WorkspaceEditProposal`，在用户对整体方案的一次批准后应用，或由明确开启的 `yolo` 模式应用。独立 MCP 没有内部 AI planner，`files[]` 每项在 `updatedSource` / `updatedLines` / `edits` 三选一（推荐 `updatedLines` 或 `edits`，避免整文件高转义全量重发；内联全量超 256 KB 会被拒绝并引导改用增量形态）；`workspaceFiles[]` 可省略，缺省时服务端按文件清单自动读盘。`designerProject`/`updatedDesignerProject` 必须是 JSON object（禁止二次 `JSON.stringify` 成字符串传入，入口会返回「必须是 JSON object」级中文错误）；服务端所有设计器模型一致性比较均为键顺序不敏感的深比较，调用方重排字段不会被判为漂移。源码和设计器 JSON 必须作为同一提案同步更新，不能只改 `.lcpp` 后把控件留在模型上下文中。IDE 内嵌 `/api/ai-bridge` 路由与独立 ai-server 一样不注入 planner（2026-09-18 起），外部 AI 的 `files[]` 草稿在两种宿主下行为一致；IDE AI 面板的编辑提案与应用也已收口到同一 `AiBridgeService` 实现（统一校验、深比较、控件门禁、审计），AI 不得再假定存在独立的第二套面板编辑事务。
- 控件引用门禁（2026-09-18 起）：`edit.apply` 与 `build.run`/`native.preview`/`native.export` 会对窗口项目的最终源码按有效设计器模型（提案 `updatedDesignerProject` 优先，否则磁盘持久化快照）校验控件引用；源码引用了模型中不存在的控件（含 `_控件名_被单击` 事件绑定）时直接中文阻断并列出缺失控件与修复路径。外部 AI 新增控件的唯一正确顺序是：propose 携带 `updatedDesignerProject` → apply 同步磁盘 → 再写引用该控件的源码/构建。`edit.propose` 本身保持宽松（允许纯源码草稿），DLL/控制台/未注册项目不做此门禁。
- 外部 AI 代码组织要求（2026-09-18 起，`MCP_INSTRUCTIONS` 第 7 条同步）：窗口主 `.lcpp` 只放事件处理器与程序主体；可复用逻辑与大批量 `@` 内嵌 C++ 按分类下沉到独立功能库文件（`功能库 名称 … 结束功能库`，一个文件一个功能库，跨文件用 `库名.功能(...)` 限定调用）；禁止把整个项目的逻辑堆进单个 `MainWindow.lcpp`。项目文件归属由解决方案按项目根自动隔离（`src/<id>` 嵌套在默认项目 `src` 内属正常形态），外部 AI 不得把别家项目的文件当本项目的源码修改。
- 大能力模块的界面开发视图（2026-09-19 起，`lingbuilder.module.info`）：命令数千条、控件数十个的模块（`lingbuilder.new_emoji.ui` 为典型）不要整表翻页找写法，三个只读视图就是权威事实来源。① `designerControls` 是该模块贡献到设计器的控件清单（`type`/`namespacedType`/中文 `label`/是否容器/`lingCppType`/代码创建命令/允许的父级/属性与事件数量）；要知道某个控件的完整属性表（含枚举 `options` 与默认值）、事件与处理器命名（`handlerPattern`）、`defaultProps`、布局协议和代码创建参数，就传 `control`（如 `control: "按钮"` 或 `control: "Button"`）取 `designerControlDetails`。控件类型、属性名和事件处理器名一律以该视图为准，禁止凭记忆编造（编造的控件引用会被控件门禁阻断）。② `demoExample` 是演示语料里该命令的**真实调用行**（参数顺序、是否带引号、处理器写法均可直接照抄），仅在按 `query` 收窄结果集时附带；某条命令没有 `demoExample` 只表示语料未覆盖（`demoProject.stale` 为 `true` 时更要注意），不代表命令不可用。③ `uiExamples` 是按场景组织的可复制界面配方索引（模块 `contributes.examples` 与工作区 `examples/ui-recipes/<moduleId>/recipes.json`），传 `example`（标题、路径或序号）直接取回一条配方正文。
- new_emoji 界面的两条合法落地路径（配方已固化在 `examples/ui-recipes/lingbuilder.new_emoji.ui/`）：① **模型零控件 + 代码创建**——设计器模型里窗口写 `designerBackend: "new-emoji"`、`controls: []`、`events: {"Loaded": "创建完毕"}`，控件全部在 `创建完毕` 里用 `控件_创建NE*` 创建并给「标记文本」，跨事件用 `通过标记文本获取NE*` 重新解析引用（局部变量不跨事件存活）；② **设计器模型控件 + 成员语法**——控件经 `updatedDesignerProject` 进入模型（`designerType` 用 `lingbuilder.new_emoji.ui/Input` 这类命名空间形态），源码用 `控件名.内容` 读写文本、事件处理器写 `_控件名_事件中文名`（按钮是 `_按钮名_被点击`，输入框是 `_输入框名_文本变化`）。两条路径都由生成器负责显示与消息循环，源码里不得写 `NE_运行消息循环`，也不得把独立一行的块结束 `结束` 写成显式退出命令 `结束()`。
- 组件表与代码组织视图（2026-09-18 起）：`lingbuilder.lingcpp.diagnostics` 的响应在窗口项目下额外返回两个只读视图，外部 AI 必须把它们当作权威事实来源：`designerInventory` 是设计器组件表（每窗口 `controls[]` 的名称、类型、内容、位置尺寸、`visible`、`enabled`、`eventBindings`、父控件，加 `hiddenControlCount`、源码事件处理器 `sourceEventHandlers` 与非可视资源），回答「窗口里有哪些组件、为什么 IDE 画布或 exe 里没显示」必须先看它，`hiddenControlCount > 0` 即说明控件被设为 `Collapsed`，禁止再去猜 `window-designer.json` 路径或凭记忆编造控件名写进源码（会被控件门禁阻断）；`codeOrganization` 给出项目各 `.lcpp` 的行数与角色（`window-main` / `function-library`）、现有功能库清单和中文处方，出现 `lingcpp-code-organization-split-suggestion`（`info`/`warning` 级，永不阻断构建）时应按处方新建功能库文件并迁移逻辑，而不是继续往主文件追加。设计器上下文缺失（未传 `designerProject` 且 `projectId` 不在解决方案中）时两个视图都不再给组件事实：`designerInventory` 不返回、`codeOrganization.windowProject` 为 `false` 且不给拆分建议，AI 不得据此虚构组件清单。
- 「看不到任何组件」的根因口径（2026-09-18 起）：设计器模型有窗口但控件总数为 0 时，诊断必须给出 `lingcpp-designer-controls-empty`（`warning`，不阻断），明确说明这不是显示 bug，而是控件从未进入设计器模型——只写 `.lcpp` 源码不会产生任何界面，IDE 画布空白、生成的 exe 里也没有组件；修复路径唯一：`edit.propose` 携带 `updatedDesignerProject`（`windows[].controls` 补齐控件，`type` 用规范英文标识、每项带 `content`）→ `edit.apply` 落盘 → 再构建，并要求需要可见的控件 `visibility` 不为 `Collapsed`。AI 收到用户「为啥软件在 IDE 内看不到组件」这类提问时，必须先跑一次带 `projectId` 的诊断读这条根因，不得回答成「刷新一下界面」或回头改源码里的命令。
- 「功能代码」术语映射（2026-09-18 起）：用户与外部 AI 说的「功能代码 / 功能性代码 / 公共代码」在本产品里一律指**功能库**——一个独立的 `.lcpp` 文件，内容是 `功能库 名称 … 结束功能库` 块（文件名即功能库名，`公开:` 段可被其他文件用 `库名.功能(...)` 限定调用），**不是**在原有单个文件里多写几个本地函数或类内私有方法。拆分处方必须内嵌可直接粘贴的功能库骨架，并把新文件路径落在当前项目源码目录内；`MCP_INSTRUCTIONS` 与 `edit.propose` 工具描述必须保留这层同义映射，避免外部 AI 把「优化单文件、封装功能代码」执行成原地加函数。
- `lingbuilder.lingcpp.diagnostics`（及 `edit.propose` 的编辑上下文）的设计器模型按三级解析：调用方显式传入的 `designerProject` 优先；缺省时按 `projectId` 自动加载解决方案中该项目的磁盘设计器模型（`.lingbuilder/projects/<id>/window-designer.json`）；两者都缺省或项目未注册时跳过依赖设计器符号的控件引用校验。诊断响应必须携带 `designerContext` 元数据（`source`=`caller|workspace|none`、`persisted`、`controlReferencesChecked` 和中文 summary），外部 AI 必须先读它再判断控件校验覆盖范围：`source=none` 时不会也不得出现「找不到控件」族误报，服务会返回 `lingcpp-designer-context-missing` warning 说明原因；项目已注册但磁盘设计器文件缺失时返回 `lingcpp-designer-model-missing` warning，控件引用错误照常如实报告。
- 设计器模型与项目数据只允许写入解决方案中已注册的项目：`edit.apply` 拒绝 `.lingbuilder/projects/<未注册项目>/` 下的任何写入，也拒绝把已注册项目的 `designerPath` 当普通文件草稿改写（必须走 `updatedDesignerProject` 布局校验通道）；`native.preview`、`native.export` 和 `build.run` 在传入模型与磁盘设计器版本不一致时会在日志中给出中文告警，AI 收到后应重新读取最新设计器模型或先经 `edit.apply` 同步磁盘，不得忽略脱节继续生成。
- 文件路径必须限制在当前工作区内，不允许访问 `..`、绝对路径逃逸、系统目录或隐藏凭据。
- AI Bridge 读取项目文本时会返回规范化内容和真实 `{ encoding, eol }`。对已有文件应用 `edit.apply` 必须保留 UTF-8 BOM、UTF-16 LE/BE 与 LF/CRLF 格式；新文件默认使用 UTF-8/LF。遇到非法 UTF 字节或不支持的编码必须停止并报告中文诊断，不能用替换字符静默覆盖原文件。
- 生成 C++、模块上下文、`.lcpp` 诊断和窗口设计器能力必须复用 LingBuilder 本地服务，不能绕过规则手册自行拼接隐藏逻辑。
- `native.export` 和 `build.run` 生成的原生项目应包含 Visual Studio Win32 工程文件；启用 `new_emoji` 等 `.lib` 模块时，AI 应提示使用 MSVC / Visual Studio Build Tools 编译。
- `build.run` 启动的 exe 必须交给 LingBuilder `ManagedProcessService` 按项目登记，不得使用 detached/unref 脱离宿主；同项目重跑必须在写入或链接固定 exe 前回收旧进程和日志流。HTTP/MCP 构建必须持有项目租约，IDE 内嵌 Bridge 与 F5 共用租约；停止或 CLI 退出要拒绝新任务、等待在途租约结束并最终回收进程，不能迟到启动。启动失败必须返回 `run-start` 失败。
- 一次性产品命令 `lingbuilder project run` 必须保持前台附着，等待受管 exe 自然退出和 `run.log` 完成落盘后再返回最终 JSON；收到 Ctrl+C 或 SIGTERM 时先停止已登记进程再退出，不能在报告 `stage=run` 后立刻执行关服而杀掉刚启动的 exe。`project build` 仍应在编译完成后直接返回。
- AI 修改普通 Win32 运行窗口启动逻辑时，必须保留一次标准 `ShowWindow + UpdateWindow` 语义，并在显示前完成 DPI、控件和最终窗口尺寸准备。不得用 `HWND_TOPMOST/HWND_NOTOPMOST` 往返、延迟定时器、重复 `SetForegroundWindow`、`BringWindowToTop` 或 `SetFocus` 强制把运行窗口压到 IDE 前方；这些操作会与 Electron 工作台争夺激活、Z 序和重绘。需要特殊前置行为时必须使用对应 UI 后端的受控激活契约，不得把 `new_emoji` 专用激活实现复制到普通 Win32 生成器。
- 所有敏感操作应写入 `.lingbuilder/ai-bridge-log.jsonl`，便于用户审计。
- AI Bridge / YOLO 生成 new_emoji 可运行 exe 后，必须确认 exe 同目录存在 `new_emoji.dll`，并实际启动 exe 等待至少 3 秒确认进程仍在运行，再向用户报告“可运行 exe 路径”。
- 普通 Win32 窗口只有在设计器模型实际包含目标 `CefBrowser` 控件时才允许尝试 CEF3 初始化；没有 CEF 控件的项目不得输出“CEF3 不可用”或缺少 SDK 诊断。实际存在 CEF 控件但 SDK/运行时缺失时仍必须保留明确中文错误。

## 10. 回答风格

### 视频播放器控件

- `VideoPlayer` 的界面名称为“视频播放器”，属于 `lingbuilder.win32.common-controls`，原生实现使用 Windows Media Foundation `IMFPMediaPlayer`，支持 MP4、WMV 等系统可解码媒体格式。
- 视频文件路径写入设计器模型 `properties.videoSource`；项目文件应优先导入到 `assets/`，不要把开发机绝对路径硬编码到生成的 `main.cpp`。
- 可用属性为 `autoPlay`、`loop`、`volume`（0～100）；可绑定事件为 `MediaOpened`、`PlaybackEnded`、`Error`。
- 运行时使用 `视频播放器_设置文件`、`视频播放器_播放`、`视频播放器_暂停`、`视频播放器_停止`、`视频播放器_设置音量`、`视频播放器_取状态`。AI 不得用 React `<video>` 或隐藏宿主逻辑代替导出 exe 中的 Media Foundation 播放行为。

AI 面向中文 IDE 用户，默认使用简洁中文回答。解释代码时应说明“改了什么、为什么、影响什么”。涉及模型限制、语法不确定或生成器尚不支持的能力时，要直接说明，不要假装已经支持。

## 11. 网页访问模块规则

`lingbuilder.web.http` 网页访问模块（1.1.1，12 条命令）自 2026-09-13 起为内置模块：无需安装，项目在「配置项目所使用模块」中启用后即可使用。非界面同步流程可使用 `网页_访问_对象`；窗口事件中的 HTTP/HTTPS 访问应优先使用 `网页_异步访问(网址, 访问方式, &完成处理器)`，避免阻塞 Win32 消息循环。不要临时发明其他网络访问命令。

常用最小示例：

```text
网页_访问_对象("https://example.com", 0)
调试输出(网页_取返回状态代码())
调试输出(网页_取返回文本())
```

`网页_访问_对象` 参考易语言参数顺序，访问方式为 `0=GET, 1=POST, 2=HEAD, 3=PUT, 4=OPTIONS, 5=DELETE, 6=TRACE, 7=CONNECT, 8=PATCH`。当前 `.lcpp` 生成器尚未完整支持“参考参数”回写，AI 需要读取响应文本、Cookie、协议头、状态码或错误信息时，应使用 `网页_取返回文本()`、`网页_取返回Cookies()`、`网页_取返回协议头()`、`网页_取返回状态代码()`、`网页_取错误信息()` 读取最近一次访问结果。

`网页_异步访问` 立即返回独立请求编号，完成处理器必须是无参数事件或方法，并会在所属窗口 UI 主线程执行。回调内先用 `网页_异步取当前请求编号()` 取得本次编号，再用 `网页_异步取返回文本(编号)`、`网页_异步取状态代码(编号)` 和 `网页_异步取错误信息(编号)` 读取隔离结果。不得在回调之前用“最近一次结果”函数猜测并发请求归属。

## 12. 内置网络服务端模块规则

项目启用 `lingbuilder.http.server` 时，AI 必须优先生成 2.0 受管 API：`HTTP_创建服务`、停止状态下的监听/资源配置、`HTTP_添加路由` 或 `HTTP_绑定请求处理器`、`HTTP_启动` 以及明确的停止/销毁。请求处理器必须是返回空的无参数事件或方法，并以 `&处理器名` 引用；处理器内先用 `HTTP_取当前请求()` 取得只在本次处理期间有效的 `HTTP请求`，再读取请求并发送一次响应或中止请求。

最小示例：

```text
类 MainWindow
    HTTP服务端 服务
    事件 _MainWindow_创建完毕()
        服务 = HTTP_创建服务()
        HTTP_配置服务(服务, "127.0.0.1", 8080, 4, 256)
        HTTP_设置请求限制(服务, 64, 16, 30000)
        HTTP_添加路由(服务, "GET", "/api/health", &处理健康检查)
        HTTP_绑定请求处理器(服务, &处理未匹配请求)
        HTTP_启动(服务)
    结束
    事件 处理健康检查()
        HTTP_发送JSON(HTTP_取当前请求(), "{\"ok\":true}", 200)
    结束
    事件 处理未匹配请求()
        HTTP_发送JSON(HTTP_取当前请求(), "{\"error\":\"not_found\"}", 404)
    结束
结束类
```

HTTP 2.0 支持 HTTP/1.0/1.1、keep-alive、Content-Length/chunked 请求体、精确/末尾 `/*` 路由、查询/头/正文/客户端信息读取、文本/JSON/二进制/文件/Cookie/重定向响应、资源限制和统计，普通 Win32 与 New_Emoji 使用同一运行时。默认按监听目标解析后的实际 IPv4/IPv6 地址只允许回环绑定，并严格拒绝非法百分号编码或非法 UTF-8 解码结果；生成外部监听前必须显式调用 `HTTP_允许外部监听` 并提醒用户配置鉴权、限流和日志脱敏。模块不内置 TLS、HTTP/2 或身份认证，公网 HTTPS 必须由反向代理或网关提供。`HTTP_启动服务/等待请求/回复文本/关闭服务` 等 1.x 命令只用于迁移，不得作为新项目默认方案。

项目启用 `lingbuilder.websocket.server` 时，AI 必须优先生成 2.0 受管 API：`WSS_创建服务`、配置/安全限制、`WSS_绑定...处理器`、`WSS_启动`、定向发送或广播、`WSS_停止/销毁服务`。连接、消息、断开和错误处理器必须是无参数事件或方法，并以 `&处理器名` 引用；处理器内通过 `WSS_取当前...` 读取 UI 线程事件快照。旧 `WSS_启动服务/等待连接/接收文本/发送文本/关闭服务` 只用于迁移，不得作为新项目默认方案。

最小示例：

```text
局部 WebSocket服务端 服务 = WSS_创建服务()
WSS_配置服务(服务, "127.0.0.1", 18080, 512)
WSS_设置资源限制(服务, 64, 16, 8, 30000)
WSS_设置心跳(服务, 30000, 10000)
WSS_设置访问路径(服务, "/ws")
WSS_设置允许来源(服务, "https://app.example.com")
WSS_绑定消息处理器(服务, &收到WebSocket消息)
WSS_启动(服务)
```

WebSocket 2.0 支持多客户端、文本/二进制、分片、Ping/Pong、关闭握手、Origin/路径/子协议、资源限制、有界发送队列和统计，普通 Win32 与 New_Emoji 使用同一运行时。AI 生成外部监听前必须显式调用 `WSS_允许外部监听`，并提醒用户配置应用层鉴权；当前模块只提供 `ws://`，公网 `wss://` 必须由反向代理或网关终止 TLS，不能声称模块内置证书/TLS。AI 生成网络服务端示例前还应确认项目已启用对应模块。

## 13. IDE 本地服务与 AI Bridge 安全边界

- Electron IDE 的普通本地服务只能监听回环地址，并使用每次启动随机生成的独立会话 token；renderer 由桌面宿主自动注入该 token，AI 不得要求用户关闭安装版鉴权。
- IDE 普通本地服务不挂载 `/api/ai-bridge/*`。用户在连接中心点击启动后，主进程会显式启动独立的 `lingbuilder ai-server` 子进程；手动 CLI 启动仍受支持。两者都使用与普通 IDE 会话分离的 Bearer token。
- Bridge 默认在 `/api/ai-bridge/mcp` 提供共享 Streamable HTTP MCP；传统 stdio MCP 只由 `--mcp` 显式追加。所有传输必须共用相同工具注册、权限、路径边界、模块上下文和敏感操作审计。
- AI Bridge HTTP 鉴权只接受 `Authorization: Bearer <token>`；不得把 token 写入查询参数、请求体、示例源码或项目配置。
- 连接中心启动外部 AI 时，只能把 token 注入对应 IDE PTY 的进程环境；客户端配置文件只能引用 `LINGBUILDER_AI_BRIDGE_TOKEN` 等环境变量，不得保存实际值。renderer 常规状态不得包含完整 token。
- 工作区文件访问以真实路径为准；读取不得越过工作区，文件树与搜索不得跟随符号链接或 Windows junction，写入新文件时也必须拒绝链接路径链。
- `readonly`、`preview`、`yolo` 的含义不变；`preview` 的写入、导出和构建必须显式批准，`yolo` 仍只允许 LingBuilder 的受控工具，不得生成或要求开放任意 shell。
- 路径越界、链接绕过、权限拒绝和失败写入必须进入 `.lingbuilder/ai-bridge-log.jsonl` 审计记录。
# 原生调试与源码映射

- AI 可以建议用户在 `.lcpp` 源码行设置断点，但不能臆造生成 C++ 行号；断点位置必须由当前生成结果的 source map 确定性映射。
- 无法映射的中文源码行应提示调整到可执行语句，不能静默把断点放到相邻或无关 C++ 代码。
- 原生调试只允许使用 LingBuilder 受控 DAP 接口，不向 AI Bridge 开放任意调试器命令、shell 或适配器反向执行请求。
# 窗口事件绑定补充（2026-07-16）

- 窗口自身事件保存在窗口模型 `events` 中，事件键统一为：`Loaded`、`Closing`、`Closed`、`SizeChanged`、`Moved`、`Activated`、`Deactivated`、`VisibilityChanged`、`GotFocus`、`LostFocus`、`KeyDown`、`KeyUp`、`TextInput`、`DpiChanged`、`Minimized`、`Maximized`、`Restored`、`FileDropped`。
- 窗口事件参数必须以统一注册表为准：`按键被按下`/`按键被放开` 使用 `(整数型 键码，逻辑型 Ctrl键按下，逻辑型 Shift键按下，逻辑型 Alt键按下)`，`字符被输入` 使用 `(文本型 字符)`，`DPI 被改变` 使用 `(整数型 新DPI)`，`文件被拖入` 使用 `(文本型[] 文件集合)`。参数由 Win32 消息分发直接传入处理器。
- 上述参数化事件仍兼容旧的无参数处理器；旧处理器可继续用 `窗口_取事件...` 系列上下文命令读取数据。从设计器再次打开已绑定的旧无参参数化事件时，IDE 会只把空签名升级为注册表强类型签名，使新手编辑器直接显示参数行；已有非空参数和事件正文不得被自动覆盖。新增或自动生成的处理器必须使用注册表给出的强类型签名，参数数量或类型不匹配必须由语言服务阻断诊断，不能自行编造事件 ABI。
- `events.Loaded` 未显式配置时继续识别 `_<窗口类名>_创建完毕`，保证旧项目兼容。其它事件只有在设计器模型明确绑定后才会触发。
- `Closing` 中调用 `窗口_取消关闭()` 可以取消本次关闭；不要在其它事件中声称该命令有效。键盘事件中调用 `窗口_标记按键已处理()` 才会阻止消息继续交给子控件。
- `窗口_取当前状态()` 返回 `0=正常、1=最小化、2=最大化`；`窗口_取拖入文件(索引)` 使用从 0 开始的索引，越界返回空文本。拖入路径只作为事件数据返回，不会自动读取文件。
- AI 修改窗口事件时必须同时更新设计器绑定和 `.lcpp` 同名处理器；新增事件键必须先进入统一窗口事件注册表、语言服务和确定性 Win32 生成器。

# 设计器事件创建与导航（2026-07-24）

- 控件事件与窗口事件在设计器中使用事件卡片作为统一入口：已有绑定时打开对应 `.lcpp` 事件处理器；没有绑定时使用统一事件命名规则生成名称、写回设计器模型、补全处理器并跳转。
- 自动创建事件时必须保留已有的自定义处理器名，不得用建议名称覆盖非空绑定；控件默认名称由 `getEplEventHandlerName` 生成，窗口事件名称由 `getWindowEventHandlerName` 生成。
- 自动生成的 `.lcpp` 事件处理器必须包含独立一行 `结束` 作为块结束标记，再接 `结束类`；不得生成缺少结构结束标记的事件块。
- AI 修改或重命名事件处理器时，必须把设计器模型绑定与 `.lcpp` AST 视为一个原子修改；不得让用户靠自由文本输入维持两边一致，也不得只改其中一处。
- PropertySheet 的 `Applied` 同样走上述事件卡片流程；已有绑定直接打开，未绑定则写回资源模型、生成无参数处理器并跳转，禁止恢复自由文本处理器输入框。

# 超链接控件原生导航（2026-07-24）

- Win32 `SysLink` 控件的“链接地址”保存在设计器模型 `properties.url`，F5 和导出工程必须把该地址写入原生链接标记；不得只在 React 设计器预览中模拟链接。
- 用户鼠标单击链接或聚焦后按回车时，原生运行时应使用 Windows 默认关联程序打开链接，并继续分发控件的 `Click` 中文事件；没有绑定 `Click` 事件也不影响默认导航。
- AI 修改超链接目标时只修改设计器模型中的链接地址，不得把 `ShellExecuteW` 调用或具体 URL 硬编码到生成后的 `main.cpp`。
- 超链接背景设为 `transparent`（界面中的窗口颜色跟随）时，设计器预览和 Win32 原生控件必须显示实际父级背景：根级跟随当前主/副窗口，普通容器跟随最近的不透明父容器，选项卡页跟随对应页面背景。原生生成必须启用 `LWS_TRANSPARENT`、复用统一父级背景解析，并在 Windows 主题仍擦除白底时由统一 `SysLink` 绘制路径明确填充父级画刷后绘制链接文字；不能创建黑色或白色占位背景覆盖父级。

# 按钮圆角属性（2026-07-12）

- 设计器按钮的圆角属性键为 `cornerRadius`，界面名称为“圆角大小”，合法范围 0～100，默认值 6；0 表示直角。
- AI 修改按钮外观时应写入设计器模型的 `properties.cornerRadius`，不能在生成的 `main.cpp` 中硬编码圆角；F5 和导出的 Win32 工程会确定性读取该属性。
- 有效圆角不会超过按钮短边的一半，普通、悬停、按下、焦点和禁用状态共享同一轮廓。切换、分割和命令链接样式仍由 Windows 原生主题绘制，不应承诺自定义圆角。
- 普通按钮的 Win32 圆角由生成器使用 GDI+ 抗锯齿路径绘制；AI 不得退回直接使用 GDI `RoundRect` 作为正常绘制路径，否则大圆角会产生明显锯齿。

# 窗口原生外观映射（2026-07-23）

- 窗口模型的原生外观字段为 `titleBarBackground`、`titleBarForeground`、`cornerStyle`、`iconStyle` 和 `iconPath`；AI 修改窗口外观时必须修改设计器模型，不能只改设计器 CSS 或生成后的 `main.cpp`。
- `cornerStyle` 只允许 `system`、`rounded`、`small-rounded`、`square`；`iconStyle` 只允许 `lingbuilder`、`system`、`custom`、`none`。`custom` 必须同时设置工作区内项目 `assets/` 下的相对 `.ico` 路径 `iconPath`，禁止保存开发机绝对路径。旧项目缺失字段时迁移为暗色标题栏、圆角和 LingBuilder 内置图标。
- F5 和导出的 Win32 工程通过动态 DWM 属性设置标题栏背景、标题文字和圆角；旧版 Windows 不支持对应 DWM 属性时保持系统标题栏和系统边框，不能承诺完全一致的非客户区颜色。禁止使用 `SetWindowRgn` 模拟窗口圆角，因为整数区域裁剪会产生明显锯齿；不支持 DWM 抗锯齿圆角时必须干净回退为系统边框。
- LingBuilder 内置窗口图标由生成的 C++ 资源数据确定性创建并同时设置大、小窗口图标，不依赖本机临时文件；自定义 ICO 通过统一设计器资源导入链路复制并随 F5、导出、Visual Studio post-build 和 AI Bridge 构建携带，运行时分别按系统大、小图标尺寸加载；`none` 表示不主动设置图标。
- new_emoji 后端窗口的标题栏由 new_emoji 自绘，其图标状态只能由 `EU_SetWindowIcon`（中文命令 `NE_设置窗口图标`）填充——该函数同时完成 `WM_SETICON`、内部 WindowState 记录和标题栏重绘；直接 `SendMessageW(WM_SETICON)` 只会更新任务栏，自绘标题栏不绘制图标。生成器（2026-09-15 起）与 AI 生成代码都必须经 `EU_SetWindowIcon` 设置 new_emoji 窗口图标，不得回退为手工 `LoadImageW` + `WM_SETICON`。
- 窗口是否允许拖拽调整大小和是否允许最大化是两个独立设计器字段，旧项目均默认允许。生成 Win32 C++ 时，禁止调整大小必须移除 `WS_THICKFRAME`，禁止最大化必须移除 `WS_MAXIMIZEBOX`；窗口尺寸计算与实际创建必须使用同一份最终窗口样式，不能只在 React 预览中隐藏按钮或拦截鼠标。
- ListView 的 `background: "transparent"` 在原生 Win32 中安全解析为与设计器一致的深色不透明表面 `#0F172A`，因为系统 ListView 不支持设计器 CSS 式透明混合。生成器必须同时设置列表背景、文字背景、文字颜色并绘制表头，包括最后一个真实列头之后的空白表头区域；不能只在 React 预览中改色。
- 独立 Header（表头）控件的 `background`、`foreground` 和字体必须由 Win32 `NM_CUSTOMDRAW` 确定性绘制，背景使用设计器选择的精确颜色，并覆盖最后一列后的空白区域；自绘必须保留悬停和按下视觉状态。位于选项卡页面或其他容器中时必须通过父级通知转发保持同样效果，不能退回系统白底黑字。表头点击只负责产生 `ColumnClick` /“列被单击”事件，没有事件绑定时不得虚构业务动作。
- Header 的 `properties.columns[]` 每列支持 `alignment: "left" | "center" | "right"`，分别表示居左、居中、居右；未配置时默认为 `left`。设计器预览与 Win32 生成必须共同消费该字段，原生映射为 `HDF_LEFT/HDF_CENTER/HDF_RIGHT`，不能只在属性面板保存。
- 状态栏的 `background`、`foreground`、字体和 `properties.textAlign` 必须由设计器预览与 Win32 F5/导出共同消费。`textAlign` 只允许 `left`（居左，旧项目默认）、`center`（居中）、`right`（居右），并统一应用于全部状态栏分区；原生分区通过 owner-draw 绘制文字和分隔线，背景通过 `SB_SETBKCOLOR` 同步。`background: "transparent"` 表示跟随实际窗口、选项卡页或最近不透明父容器背景，不得回退到设计器蓝色占位底或系统白底黑字。AI 应修改状态栏设计器模型，不能要求用户手改生成后的 `main.cpp`。
- 富文本框的 `foreground` 与 `background` 必须进入设计器预览和 Win32 F5/导出。原生 RichEdit 的文字颜色使用 `EM_SETCHARFORMAT`，背景使用 `EM_SETBKGNDCOLOR`；`background: "transparent"` 表示解析并跟随实际父容器背景，不代表 RichEdit 支持 CSS 式半透明，也不能退回系统白底。AI 应修改富文本框设计器模型，不能要求用户手改生成后的 `main.cpp`。
- 日期时间选择器和月历的 `background`、`foreground` 与字体必须进入 Win32 F5/导出结果。月历需在关闭控件视觉主题后用 `MCM_SETCOLOR` 同步月面、标题及相邻月份文字；日期时间选择器主体使用保留原生选择、键盘和下拉交互的确定性绘制，下拉月历在 `DTN_DROPDOWN` 时应用同一颜色。AI 只应修改设计器模型字段，不得建议用户手改生成后的 `main.cpp`。
- ListView 外观字段统一写入设计器模型：`properties.borderColor` 默认 `#64748B`，`borderWidth` 默认 1、范围 0–8，`headerHeight` 默认 28、范围 16–96，`itemHeight` 默认 28、范围 16–96。设计器预览和 Win32 F5/导出必须共同消费这些字段；原生生成需保留自定义边框、表头高度和表项高度，不能回退到 `WS_EX_CLIENTEDGE`、系统固定表头或系统固定行高。

# 系统内置 AI、账号与点数边界（2026-07-12）

- 系统 AI 通过独立 LingBuilder 云端 API 调用；IDE 只提交管理员发布的逻辑模型别名，不能指定系统供应商 Base URL、真实模型名或密钥。
- 系统 AI 和用户自带 Key（BYOK）是两种明确模式。BYOK 请求不消耗系统 AI 点数，也不得进入系统计费账本。
- 系统 AI 请求必须带唯一幂等键，服务端先冻结 AI 点数，结束后按实际输入、缓存输入和输出 Token 结算；失败释放冻结额度。
- 系统 AI 支持时段计费：逻辑模型可配置高峰费率与高峰时段（默认北京时间 9:00-12:00、14:00-18:00，未配置高峰时段时使用该默认窗口）；计费档在预扣阶段按请求发生时刻锁定，结算与取消估算必须沿用同一计费档；未配置高峰费率时按单一价格计费，且高峰价与空闲价都必须是管理员在后台显式配置的真实数值，不得使用占位价。
- 免费活动只免除用户点数，不免除用量记录。AI 不得把“免费”解释为不受速率、请求数或单用户上限约束。
- 云端默认零保留：提示词、源码和完整回复不得写入数据库、日志、审计或错误追踪。模型供应商的保留政策必须在通道启用前由管理员确认。
- 云端编辑只返回允许文件的完整重写草稿；本地 IDE 必须再次执行路径、文件版本、LingCpp 结构、模块上下文和诊断校验，并让用户预览确认。
- 系统 AI 不得要求用户关闭本地会话鉴权、Bridge Bearer 鉴权、MFA、点数校验或编辑预览。
- 管理后台无法查看用户源码和对话正文。管理员只能查看脱敏的请求 ID、模型、Token、点数、成本、状态和错误码。
- 系统 AI 对思考模型必须区分推理增量与最终回答；聊天可展示推理文本，但云端编辑只能把最终回答解析为完整文件草稿。幂等冲突必须在 SSE 建连前明确拒绝。取消请求的 Token 与成本估算必须包含本规则手册等已注入系统上下文，并标记为估算值。
- 思考过程的可见性是硬性要求（2026-09-11 修复并部署）：渲染层消息映射与会话持久化必须携带 `reasoningText`，思考内容只在正文为空时于流结束后提升为正文（超长按 70K 截断）；任何把 `reasoningText` 从会话 store 往返中剥掉的改动都会复现「扣了点数却看到空气泡」。
- 思考模型把输出预算全部耗在推理上时（`finish_reason=length` 且正文为空），云端必须在按实际用量结算后给客户端可见的中文结果（截断提示 delta 或 `error` 事件），不得静默 `completed`。模型输出预算已开到 DeepSeek 上限 393216，点数预冻结按 16384 有界估算、结算补收实际用量；AI 生成调用与文档不得再引用 4096/16384/8192 作为模型或编辑输出上限（模块一键生成的请求级 16384 除外）。

# 键盘输入模块 2.0（2026-08-01）

- AI 生成键盘操作代码时必须显式选择作用域：只读系统键状态使用 `键盘_全局_*`，向当前焦点注入真实系统输入流使用 `键盘_前台_*`，向指定 HWND 投递后台消息使用 `键盘_窗口_*`。不得把“全局”解释为向所有窗口广播。
- `键盘_前台_*` 使用 `SendInput`：不锁定或独占实体键盘，但会影响当前前台焦点并可与用户按键交错。生成单击、组合键或文本输入前应让用户确认目标，不得声称它能突破 UIPI 或向更高权限程序保证注入成功。
- `键盘_窗口_*` 使用 `PostMessageW`：不抢焦点、不占用实体键盘、不改变全局键状态。返回真只代表消息已入队，目标可以忽略。向文本框发送 `WM_CHAR` 时应优先传入真正的焦点子控件 HWND，不能假定顶层窗口必然转发。
- 键名、虚拟键码和扫描码应使用 `键盘_键名取键代码`、`键盘_键代码取键名`、`键盘_键代码取扫描码` 和 `键盘_扫描码取键代码` 转换，避免散落无说明的魔法数字。前台文本输入优先使用 Unicode 命令 `键盘_前台_输入文本`。
- AI 不得生成 `BlockInput`、隐藏低级键盘钩子、按键窃取或绕过目标权限/授权的原生代码来“补齐”键盘模块。

# 鼠标输入模块 2.0（2026-08-01）

- AI 生成鼠标操作时必须先选择三类之一：全局真实输入（前台）、指定 HWND 的窗口消息输入（后台）或 UI Automation 语义操作（后台）。不得把“全局”解释为向所有窗口广播，也不得把后台消息说成真实鼠标已经点击。
- 全局查询 `鼠标_取横坐标` / `鼠标_取纵坐标` 只读取真实光标；`鼠标_移动`、`鼠标_相对移动`、按键和滚轮命令使用 `SetCursorPos`/`SendInput`，会改变光标或进入当前系统鼠标输入流，可能与用户操作交错。生成这类代码前应明确提醒用户，不得声称后台执行或完全不占用鼠标。
- `鼠标_相对移动` 的参数是相对输入增量，实际位移受 Windows 鼠标速度和加速度设置影响，不保证严格等于像素数。
- `鼠标_窗口消息*` 必须接收真实 `HWND` 句柄并使用客户区/屏幕坐标的正确语义；它通过 `PostMessageW` 投递消息，不移动真实光标、不抢前台、不占用系统鼠标。返回真只代表消息入队，Raw Input、DirectInput、自绘控件、权限隔离或目标过滤都可能使目标忽略。
- `鼠标_UIA_*` 必须先用窗口 `HWND` 按 Name 或 AutomationId 查找，再使用模块返回的受管元素整数句柄调用 Invoke/Value/Toggle/SetFocus；不模拟鼠标、不移动光标、不占用系统鼠标，但 SetFocus 可能改变键盘焦点。元素句柄不是 HWND，也不是裸 COM 指针，使用后调用 `鼠标_UIA_释放`。
- AI 不得生成 `BlockInput`、全局鼠标钩子、隐藏输入记录、裸 `SendMessage`/`PostMessage` 任意消息发送器或绕过目标权限的原生代码来“补齐”鼠标模块。

# 项目全局变量（2026-07-27）

- 每个 Visual C++ 项目的固定全局变量文件为 `<sourceRoot>/项目全局变量.lcpp`。其作用域仅限当前项目，生命周期为整个进程；外部 MSBuild/CMake 项目和跨项目访问不支持，也不承诺线程安全。
- 声明语法固定为 `全局 <类型> <名称>[] [= 初始值]`，例如 `全局 文本型 当前用户 = "访客"`。数组首版只能使用默认空数组，不得指定初始值。
- 初始值只能包含字面量、纯算术/逻辑表达式和前面已经声明的项目全局变量。禁止窗口、控件、模块命令、成员访问和任何函数调用；AI 不得通过原生代码片段绕过该限制。
- 全局变量名在同一项目中必须唯一。局部变量、参数和程序集变量可以遮蔽全局变量，但会产生警告；解析优先级为“局部变量 → 参数 → 程序集变量 → 项目全局变量”。
- AI 新建或修改项目全局变量时必须编辑固定 `.lcpp` 文件，不能把 `全局` 声明写入普通窗口源码，也不能直接修改生成后的 `main.cpp`。类型只能使用内置类型、当前项目已启用模块贡献的类型或 `项目数据类型.lcpp` 中声明的项目自定义类型。
- AI Bridge 诊断固定 `项目全局变量.lcpp` 时必须同时加载同项目 `项目数据类型.lcpp`；不能因为当前被诊断文件本身是固定符号文件就跳过项目类型上下文并误报自定义类型。
- F5、解决方案构建、原生预览、原生导出和 AI Bridge 必须消费项目源码目录内的全部 `.lcpp`。活动窗口只决定启动/预览窗口，不能再把活动文件当作唯一生成输入。
- C++ 生成结果统一在窗口类之前创建 `LingBuilderProjectGlobals` 命名空间，并让全部窗口源码直接访问同一变量；导出工程必须保留全部原始 `.lcpp` 非编译源码项及逐文件源映射。

# 项目自定义数据类型（2026-07-27）

- 每个 Visual C++ 项目的记录型数据类型统一声明在 `<sourceRoot>/项目数据类型.lcpp`，语法为 `数据类型 名称`、字段声明、`结束数据类型`。定义不能散落到窗口源码、全局变量文件或生成后的 C++。
- 字段只允许安全基础类型或同项目自定义类型；支持字段数组和嵌套，但禁止直接或间接循环嵌套，数组依赖同样参与循环检查。数组、字节集和嵌套对象只能默认空初始化。
- 自定义类型采用公开字段和值语义，可用于局部变量、程序集变量、项目全局变量、参数、返回值及数组。同类型可整体复制；不同记录类型不得隐式转换。首版不支持方法、继承、指针、控件、模块对象、泛型、联合体、对象字面量或原生 ABI 布局。
- 类型改名必须更新字段类型及全部声明位置；字段改名只能更新基类型明确匹配的成员访问。字符串、注释和 `@` 原生 C++ 不参与替换；仍有引用时不得删除，跨文件更新必须作为一个可预览且版本一致的整体应用。
- F5、原生预览、Visual Studio 导出、new_emoji 与 AI Bridge 必须聚合同一份项目类型上下文，按依赖顺序在项目全局变量和窗口类之前生成可读 C++ `struct`，并保留原始类型文件及 `data-type` / `data-field` source map。

# new_emoji 目录与收费授权（2026-07-27）

- AI 生成 new_emoji 界面时只能使用当前安装模块目录中存在的 93 个命名空间控件及其已声明属性和事件，不得猜测控件名、导出签名或回调参数。`lingbuilder.new_emoji.ui@2.0.0` 当前由上游元数据生成 3784 条 contribution/binding；生成结果与 module-build、已安装模块和 `.lbmod` 必须通过 `npm run module:new-emoji:check` 保持逐文件一致。
- 目录收录不等于运行时闭环。AI 只能编辑带 `runtimeCommand` 的 new_emoji 专属属性，也只能绑定带真实 callback runtime mapping 的事件；面板显示为锁定的属性或未出现的事件不得通过直接改 JSON 绕过。上游函数指针参数统一生成为带精确 `handlerSignature` 的 `handler`，`.lcpp` 必须写 `&处理器名`；不得把 callback 生成成整数、普通字符串或无参数处理器。
- 默认优先生成安全 `NE_` 中文桥接命令。`NE_EU_*` 属于 advanced；除非用户明确开启底层 API 并要求底层调用，否则不要主动生成。
- new_emoji 窗口必须保存 `designerBackend: new-emoji`，Win32 窗口保存 `designerBackend: win32`；同一窗口不得任意混用两类控件。唯一现行例外是已注册的 FBro 外部 `HWND` 子宿主：项目同时启用 `lingbuilder.new_emoji.ui` 和 `lingbuilder.fbro.browser` 时，`FBroBrowser` 可用 `parentId` + `containerSlot` 放入 New_Emoji Tabs 稳定页面；每页必须是独立浏览器实例和独立 profile，不能共用句柄或在 React 中模拟切换。其它 Win32 控件仍不允许混入。事件绑定继续保存处理器名，生成调用时使用 `&处理器名` 语义。
- `windowFrame.preset` 只允许 `system`、`browserShell`、`custom`。浏览器外壳预设固定生成上游 `0x3F` 六项窗口 flags，并保存四边缩放边框和圆角；手工修改 flags 后必须切换为 `custom`。旧项目缺少该字段时按 `system` 迁移，不得把设计器自绘标题栏当作运行逻辑。
- new_emoji 的 Tabs、Menu、Omnibox 等集合属性使用 manifest `recordList` 字段 schema；跨控件关系使用带允许类型、对象种类、作用域和 `stableId` 运行时表示的 `controlRef`。源码中的控件引用必须是裸标识符，设计器关系必须保存稳定对象 ID；生成器先创建全部控件，再统一解析关系和调用 setter。旧值 `0` 表示未绑定，无法唯一恢复的旧数字关系必须阻断并要求人工选择。
- 真浏览器外壳使用 `lingbuilder.new_emoji.fbro-shell@1.0.0` 和模板 `new-emoji-fbro-browser-shell`。`BrowserViewport` 只表示布局边界及加载/错误占位，真实网页由“标签稳定 ID -> FBro 句柄 -> 非分层伴随宿主 HWND”映射渲染；伴随宿主必须使用顶层工具窗口并按占位区屏幕坐标同步移动、尺寸、DPI、显隐、层级和销毁，不能把 Chromium 子 HWND 放入 new_emoji 的 `WS_EX_LAYERED` 主窗口。切换页面只显示当前宿主，不得把网页像素画进 React 或占位控件。
- 浏览器外壳状态处理器固定为 `(整数型 标签索引, 文本型 地址, 文本型 标题, 逻辑型 加载中)`，调用必须写 `浏览器外壳_创建(浏览器标签页, 浏览器页面占位, &浏览器状态改变)`。响应式布局在 `SizeChanged` 和 `DpiChanged` 中复用 `控件_设置位置大小`，同时调整 new_emoji 控件、FBro HWND、弹层锚点和命中区域。
- 浏览器外壳正式目标仅为 Windows/MSVC x64。缺少 x64 SDK、FBro Bridge、CEF 运行时或哈希不一致时必须在生成前阻断；基础浏览不要求 VIP Key。F5、原生预览和 Visual Studio 导出必须消费同一项目模型、模块上下文、生成器与依赖计划，不能提供 IDE 内隐藏模拟或其它平台静默降级。
- 完整复刻模板固定为 1180 x 760，必须保留 Chrome 式 Tabs、独立新建标签按钮、Omnibox、下载/扩展/更多菜单、右键菜单、弹层和窗口控制。分享该模板时只能使用 `npm run demo:new-emoji-fbro-shell:export` 生成并回读验证 `exports/new_emoji-FBro浏览器外壳完整复刻.lcpppkg`；包内必须是实际 `.lcpp`、设计器模型、x64 配置和 SDK 资产，不能替换成截图、Python 启动器或 IDE 模拟项目。
- 浏览器外壳 Tabs 控件宽度必须按实际标签总宽度计算，独立新建按钮紧跟最后一个标签，窗口按钮之前必须保留可拖拽标题栏空白；新增、关闭或重排标签后必须在当前控件事件结束后刷新拖拽/非拖拽命中区。模板首个标签和运行时新标签默认打开 `https://www.baidu.com`，原生 smoke 的 `127.0.0.1` fixture 只能存在于测试生成目录，不能写入模板或 `.lcpppkg`。
- AI 不得通过手工调整生成后的 FBro `HWND` 坐标修复 New_Emoji Tabs。确定性生成器会把设计器逻辑坐标按窗口 DPI 换算，并补入 New_Emoji 默认 30 逻辑像素标题栏偏移；浏览器外壳的根 `Container` 必须设置 `flowEnabled=false`，Menu/Popover/Dropdown 打开时由运行时受控隐藏伴随宿主，不能绕过弹层层级。模块宏必须在桥接头探测前生成，FBro 成功验收需要真实 renderer 子进程以及 HWND/像素门禁，不能只看到白色宿主。
- New_Emoji Tabs 的 `headerVisible` 是独立的布尔属性，默认显示；AI 修改设计器模型时应使用 `headerVisible=false` 隐藏表头，不能把固定开启的 `contentVisible` 当作表头开关。生成器必须通过 `EU_SetTabsHeaderVisible` 写入 `0/1`，隐藏后页面内容区占满 Tabs 区域，旧项目缺少该字段时按显示兼容。
- 设计器项目以工作区 `.lingbuilder/projects/<projectId>/window-designer.json` 为权威持久化数据；localStorage 只能保存按 `projectId` 隔离的临时界面状态，不能覆盖磁盘布局。发现 `lingbuilder.new_emoji.ui/*` 命名空间控件而窗口缺少后端时，应迁移并保存为 `designerBackend: new-emoji`，不得重新建立空窗口替换原控件。
- new_emoji 设计器预览必须服从原生库深色/浅色主题令牌，不能用只存在于 React 的渐变、阴影或圆角承诺运行效果。原生生成器会默认聚焦首个可见且启用的 Input/EditBox；如用户要求其它启动焦点，应在窗口“创建完毕”处理器中使用真实焦点接口覆盖，不要用前端假光标模拟。
- new_emoji 窗口未显式改图标时使用模块随包携带的 LingBuilder v2 ICO；AI 不要生成本机绝对图标路径。用户选择自定义图标时仍只能使用项目 `assets/` 下的相对 ICO 路径，选择“无图标”时不得强行恢复默认图标。
- New_Emoji 生成的 `wWinMain` 必须在 COM、`NE_创建窗口` 和任何控件创建前动态启用 `DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2`，调用 `SetProcessDpiAwarenessContext` 不得静态链接以保持旧 Windows 启动兼容；API 不可用时才回退 `SetProcessDPIAware`。不得把启动显示器的系统 DPI 当作跨屏方案，也不得在生成后的 `main.cpp` 中手工补缩放。上游 DLL 会通过 `WM_DPICHANGED`、`GetDpiForWindow` 和元素树重排处理窗口拖到不同缩放屏幕的尺寸、字体和布局。
- 收费模块没有有效 Permit 时，AI Bridge 不得把其启用上下文用于诊断、修改、构建或导出，也不得通过直接调用本地接口绕过登录、购买、限免结束或离线到期限制。
- Permit 恢复失败时应区分未购买、离线 Permit 过期和本地授权服务未就绪；不得建议关闭收费守卫或伪造签名。开发环境应先确认 Docker 基础服务与 `127.0.0.1:17900` 云端 API 都已启动，再使用已授权开发账号经正式接口换发 Permit。

## 数据表格代码生成规则

- 普通 Win32 高级表格使用 `DataGrid / 数据表格`，通过稳定“行键 + 列 ID”调用 `表格_` 命令；不要用可变化的显示索引代替行键或列 ID。
- 列类型仅生成 `text/integer/decimal/date/checkbox/switch/image/progress/combo/buttons`。选择框三态的第三值为 `null`；Switch 仍是独立二态逻辑列。
- DataGrid 列对齐只允许 `left/center/right`，分别对应居左、居中、居右；未填写时默认 `center`。运行期需要改变时使用 `表格_设置列对齐(控件名, 列ID, 对齐方式)`，不得直接修改生成后的 GDI 绘制代码。
- DataGrid 原生进度条的轨道尺寸必须随窗口 DPI 缩放，进度文字必须在完整单元格文本区域中垂直居中；不要生成把文字裁剪到窄轨道矩形或使用未缩放固定像素高度的绘制分支。
- DataGrid 原生按钮列必须按当前字体测量文字宽度并随 DPI 缩放内边距、间距和命中区域；绘制、悬停与点击必须使用同一布局结果。只有单元格确实放不下整组按钮时才生成“更多”入口，不得用固定物理像素宽度裁掉中文按钮文字。普通、主操作、危险、禁用、悬停和“更多”状态统一使用随 DPI 缩放的 4 逻辑像素 GDI+ 抗锯齿圆角填充与描边，不得生成直角按钮或胶囊形按钮。
- 组合框必须把稳定值与中文显示文字分开；多按钮列必须声明稳定按钮 ID，事件中用 `表格_取事件按钮ID` 判断，不按按钮文字判断。
- DataGrid 组合框单元格在非编辑状态显示选项中文文字和下拉箭头，单击时展开临时原生 `COMBOBOX`；选择后保存稳定值并触发“编辑已提交”和“组合框被改变”，不得把显示文字写回稳定值字段。
- DataGrid 图片必须使用项目 `assets/` 下的相对路径。生成运行时从 EXE 所在目录解析，非默认项目路径形如 `assets/<项目ID>/<文件名>`；不要生成本机绝对路径或依赖 IDE 当前工作目录。
- DataGrid 图片显示方式只使用 `tile/contain/cover/center/stretch`，对应平铺、等比完整显示、等比铺满裁剪、原始大小居中、拉伸填充；默认 `contain`。需要运行时改变时调用 `表格_设置图片显示方式`，不要生成多个互相冲突的布尔属性。
- 大数据优先使用 `表格_设置虚拟行数` 与“请求虚拟数据”事件，在事件中读取请求区间并提交缓存行。禁止在绘制回调语义中生成网络请求。
- 读取特殊状态时，Switch/选择框使用 `表格_取逻辑`，进度值和状态分别使用 `表格_取进度`、`表格_取进度状态`，行选择使用 `表格_取行是否选中`；不要通过屏幕颜色、显示文字或当前索引反推状态。
- CSV/TSV 命令传递文本；直接读写工作簿使用 `表格_导入Excel`、`表格_导出Excel` 和 `.xlsx` 路径。Excel 接口不依赖 Office，只支持静态表格的第一个工作表，图片单元格按项目路径文本处理，不要生成 Excel COM 自动化代码。
- new_emoji 窗口不得调用 Win32 `表格_` 命令。已有 `lingbuilder.new_emoji.ui/Table` 保持原后端和生成行为，不要自动改写成 DataGrid；其图片单元格当前仍是不支持的生成边界。
- new_emoji Table 的结构化编辑器数据保存在 `dataGridColumns/dataGridRows`，设计器可以消费对象模型，但生成器不得把对象数组直接 `JSON.stringify` 后传给 `EU_SetTableColumnsEx` / `EU_SetTableRowsEx`。这些 Ex 接口当前只有 UTF-8 字节集/字符串列表契约；结构化数据必须降级为 `EU_SetTableData` 的列标题与制表符行数据，只有旧字符串型 Ex 数据才可原样调用，否则运行时会把 JSON 当作单元格文字显示。
- `表格_` 命令的宽字符串参数允许传入局部文本变量；生成器必须通过受控 `LingCppWideArg` 适配为调用期间有效的 `const wchar_t*`，不得要求用户在 `.lcpp` 中书写 `.c_str()`。完整示例位于 `src/datagrid-api-demo/MainWindow.lcpp`。

## OpenCV 图像处理代码生成规则

- OpenCV 高级图像能力来自 `lingbuilder.opencv`。需要这些命令时应先提示用户启用模块和 x64 构建目标；不要把现有 GDI+ 图像命令静默替换成 OpenCV。
- 句柄变量使用 `OpenCV图像句柄`、`OpenCV结果句柄` 或兼容的 `长整数型`。禁止在 `.lcpp` 中生成 `cv::Mat`、OpenCV C++ 类、STL 容器、裸指针、DLL 导出符号或手工 `LoadLibrary`。
- 图像处理命令都返回新句柄，不会原地修改输入图像。生成代码必须保存返回值，并在所有正常/失败路径释放图像和结果；批量退出可调用 `OpenCV_释放全部`。
- 调用失败时读取 `OpenCV_取错误()` 并向用户显示中文原因。分析结果数量为 0 表示没有候选，不是 Bridge 执行失败，不应伪造坐标。
- `OpenCV_分析缺口(背景图像, 滑块图像, 候选数量, 配置JSON)` 的候选数只能是 1～8；无滑块轮廓分析传 `0`，单候选传 1，双候选传 2。坐标始终相对原始背景图。
- 配置 JSON 只允许 `mode`、ROI、模糊/Canny/形态学、宽高范围、最低分数、候选间距和 NMS IoU 固定字段，大小不得超过 16KB。不得生成未知字段、偶数卷积核、越界 ROI 或把 JSON 当作可执行脚本。
- 缺口分析仅用于用户自有或已获授权的图像。AI 不得扩展为浏览器验证码控制、自动拖动、轨迹生成、验证提交或绕过第三方访问控制。
- OpenCV 首版固定 Windows MSVC x64、OpenCV 4.14.0、CPU、C++17、动态 CRT `/MD`。不得声称支持 Win32、CUDA、DNN、OCR、视频、摄像头、Python 或 Java；需要这些能力时应明确标注尚未支持。
- F5、`build.run`、`native.export`、Visual Studio 导出和 `.lcpppkg` 恢复必须使用已校验的 `lingbuilder.opencv.sdk`。SDK 缺失、版本/ABI/架构/CRT 不符或 SHA-256 损坏时应保留阻断诊断，不要生成占位函数或绕过依赖服务。

## 控件引用 `controlRef` 代码生成规则

- 任何参数只要语义是设计器可视控件、非可视组件或资源，就必须使用模块 binding 中的 `controlRef`，并在 `.lcpp` 生成裸控件名：`控件_设置文本(操作结果, "完成")`。禁止生成 `控件_设置文本("操作结果", "完成")`，也不得把控件参数退化为 `wideString`、`utf8String` 或普通文本变量。
- 必须遵守 binding 声明的 `controlTypes`、`controlKinds`、`scope` 和 `runtimeRepresentation`。目标不存在、同名歧义、类型/对象种类不兼容或跨出当前窗口/项目作用域时，应保留中文诊断并要求用户选择，不得猜测。
- C++ ABI 需要 `L"控件名"`、稳定 ID 或原生句柄时，由生成器在解析设计器符号后内部转换；AI 不得为了迎合 C++ 表示而给 `.lcpp` 控件名添加引号、`.c_str()`、指针强转或手写 HWND。
- 旧源码只有在参数已确认是 `controlRef` 且目标唯一、兼容、作用域正确时才可移除引号。不得用正则全局删除字符串引号；真正的文本参数必须保持引号。
- 控件重命名必须通过统一引用服务同步设计器稳定对象与所有已解析源码引用。跳转使用“跳转到控件”命令和设计器导航服务，不生成 DOM 查询或按显示文字猜控件。
- 模块清单源码中的 `insertText`、`example` 和 snippet 也必须直接使用裸 controlRef；不得依赖模块加载时的兼容归一化。生成或修改模块后必须通过逐方法/逐参数审计、模块源字面量审计和只读 `.lcpp` 迁移门禁。

- Win32 内置 `GroupBox` 和 `TabControl` 的设计器容器贡献必须带正式 `layout`：分别使用 `win32.groupbox.absolute` 的窗口绝对布局和 `win32.tab.slots` 的稳定页面槽位布局。AI 修改模块贡献或容器模型时不得删除这些声明，否则设计器会回退到兼容布局并产生阻断迁移提示。

### new_emoji Tabs 页面布局生成

- 生成或修改 `lingbuilder.new_emoji.ui/Tabs` 项目时，AI 必须保留稳定页面槽位，并让原生生成器在页面子控件全部创建后再绑定 `EU_SetTabsPageElements`；不得通过手工修改生成后的 `main.cpp`、强制激活某一页或改坐标来掩盖布局错误。
- `Container` 的设计器宽高必须保持 `EU_SetPanelLayout(..., 0, 0)` 语义，不能依赖默认 `fill_parent`。`flowEnabled` 默认保持 `true` 兼容旧项目；需要绝对坐标的浏览器外壳等布局必须显式设为 `false`，由 `EU_SetContainerLayout(..., 0, ...)` 禁用流式重排。

## 构建生成、字节集与 Protobuf

- 模块只能在 manifest v2 中声明受控 `build.codeGenerators[]`。Provider、版本、输入 glob、输出目录和结构化选项必须经过宿主校验；不得生成或建议 `buildSteps`、Shell/PowerShell、任意 exe、脚本注入或系统 `protoc` 回退。通用 `buildSteps` 尚未公开。
- 构建入口统一经过 Build Pipeline：解析项目/模块、执行 codeGenerators、生成 LingCpp C++、物化依赖、写入临时和可复制目录、导出 VS 工程、编译/运行。取消或失败时不得启动旧 exe，也不得保留半成品。
- 二进制数据统一使用 `字节集`（binding/ABI 名称 `bytes`）。真实字节序列不得新声明为 `raw`；opaque 原生类型才可使用 `raw`。跨 DLL 输入是 `const unsigned char* data + size_t size`，输出由调用方查询长度并提供缓冲区，禁止跨 DLL 传递或释放 STL。生成空数据、零长度、长度溢出和所有权代码前必须确认对应测试。
- Protobuf 模块 ID 为 `lingbuilder.data.protobuf`，Provider 为 `lingbuilder.protobuf.protoc@1.0.0`，只使用官方反射 API 和 opaque 句柄。SDK 固定版本为 27.3.0（2026-09-12 起随安装包附带，布局按架构拆分：`bin/protoc.exe` + `bin/<arch>/libprotobuf.dll`、`bin/<arch>/abseil_dll.dll` + `lib/<arch>/libprotobuf.lib`、`lib/<arch>/abseil_dll.lib` + `include/**`），IDE 打开工作区时自动铺设到 `<工作区>/.lingbuilder/toolchains/protobuf`（只补缺失文件，不覆盖用户自备 SDK；新建工作区随 default-workspace 模板自带）。`runtime-manifest.json`（821 项，`npm run protobuf:manifest` 生成）校验所有头文件、导入库、DLL 和 `bin/protoc.exe` 的大小/SHA-256。清单缺失、篡改、版本或目标架构不符时应中文阻断；IDE 自身不联网下载、不调用 PATH 中的 protoc。SDK 二进制不入库，打包机/开发机用 `npm run protobuf:prepare` 重建。
- Protobuf 消费约定（构建管线自动注入，改动生成/编译链路时不得遗漏）：全部编译单元（含 protoc 生成的 `.pb.cc`）必须定义 `PROTOBUF_USE_DLLS` 和 `ABSL_CONSUME_DLL`——前者缺失会运行期虚表错位（实测 0xC0000005），后者缺失时 map 等用到 absl 哈希内部的代码 LNK2019；必须同时链接 `libprotobuf.lib` 与 `abseil_dll.lib`；abseil 以单体 DLL（`abseil_dll.dll`，文件名由导入表钉死不可改）随附；消费端最低 `/std:c++17` 且必须与 SDK 一致使用动态 CRT（`/MD`，物化置 `requiresDynamicCrt`），DLL 侧按 C++14 构建会因 `absl::string_view` 类型分叉直接链接失败。
- Protobuf 的本地 import 必须进入构建输入和增量指纹，并随生成结果复制到构建/导出目录；Provider 只在 staging 目录写入，生成失败或取消时不得保留半成品。
- 生成或改写 Protobuf 示例/教程代码时的 `.lcpp` 红线：`PB_` 命令返回的具名句柄类型为 `Proto描述集` / `Proto消息`（模块 contributes.types，contributes.commands 与 bindings 的参数/返回类型必须同步用具名类型，不得写回 `句柄`/`handle`）；依赖时序的 `PB_` 调用一律「先声明、用时赋值」——带初始化的局部变量声明会被生成器提升到方法最前，既会让 `PB_序列化为字节集` 抢在 JSON 填充之前执行（编码恒为空），也会让下一条 `PB_创建消息` 的 `g_lbProtoLastError.clear()` 清掉上一条的中文错误（`PB_取最后错误` 返回空）；opaque 句柄不得作为 `格式化文本` 实参（`到文本` 重载歧义 C2668）；protoc 在 Windows 按 ANSI 码页解析 argv，Provider 已固定以输入根为 cwd、全部相对路径调用，不得改回绝对路径。

## 二进制密文与 Cookie 导出规则（2026-09-18 已落地）

- DPAPI 二进制必须走 `lingbuilder.crypto.windows` 的 `数据保护_加密字节集(数据)` / `数据保护_解密字节集(密文)`：两条命令字节集进、字节集出，内部不调用 Base64 也不做 UTF-8 解释。`数据保护_解密字节集` 会自动剥离开头的 ASCII `DPAPI` 5 字节前缀（Chromium `Local State` 里 `os_crypt.encrypted_key` 去掉 Base64 后的形态），调用方不需要自己 `字节集_删除`。**禁止**用 `数据保护_解密文本` 解二进制密钥：它把明文按 UTF-8 解释，32 字节随机 AES 密钥会被静默破坏。失败返回空字节集，原因用 `数据保护_取错误` 读取。
- 裸 AEAD 走 `lingbuilder.crypto.symmetric` 的 `对称_AES256GCM加密裸/解密裸` 与 `对称_AES128GCM加密裸/解密裸`（运行时由 Botan 实现）：密钥、随机数、明文/密文、附加数据四个参数**全部是字节集**；随机数固定 12 字节且必须由调用方提供，命令不会自动生成、也不写任何自描述头；加密返回值就是 `密文 || 标签(16 字节)`，解密入参就是同样的裸切片。AES-256 密钥必须 32 字节、AES-128 必须 16 字节，长度不符或标签校验失败一律返回空字节集并用 `对称_取错误` 读中文原因。
- 裸命令与自描述命令不得混用：`对称_AES256GCM加密/解密`（十六进制密钥 + `$lbce$` 封装 + 自动随机数）只能解自己产出的密文；解外部格式（浏览器内核、第三方存储）必须用 `...裸` 变体，反之用 `...裸` 去解自描述密文会把封装头当密文。
- Chromium cookie 行解密范式：`encrypted_value = "v10"(3 字节) || nonce(12) || 密文 || 标签(16)`，先 `字节集_截取` 拆出随机数与 `密文||标签` 两段，再用 `对称_AES256GCM解密裸(主密钥, 随机数, 密文与标签, 空附加数据)`；主密钥来自 `数据保护_解密字节集(字节集_Base64解码(encrypted_key 文本))`。
- Cookie 导出走 `lingbuilder.net.cookie`：`Cookie_导出Netscape(Cookie数组JSON)` 与 `Cookie_导出EditThisCookieJSON(Cookie数组JSON)` 接收**扁平 Cookie 对象组成的 JSON 数组文本**（也接受单个对象），值只能是字符串/数字/逻辑/null，出现嵌套对象或数组即判格式错误、返回空文本并用 `Cookie_取错误` 给中文原因。字段别名双套自动识别：`domain / host_key / host`、`secure / is_secure`、`httpOnly / is_httponly`、`path`（缺省 `/`）、过期时间优先 `expirationDate`（Unix 秒，原样保留小数）否则 `expires_utc`（Chromium 自 1601-01-01 起的微秒，按整数换算，不经过双精度）；`samesite` 数字按 `-1→null / 0→no_restriction / 1→lax / 2→strict` 映射，字符串原样透传。
- 导出口径固定：无过期或换算结果不晚于 1601 年判为会话 Cookie（Netscape 过期列写 `0`，EditThisCookie 省略 `expirationDate` 并置 `session: true`）；`hostOnly` 未显式给出时按域名是否以 `.` 开头推导，Netscape 的 includeSubDomains 列同源；`storeId` 是 Firefox 专有字段恒为 `null`；Netscape 的 HttpOnly 位用 `#HttpOnly_` 前缀写在域名前（curl 与 Python `MozillaCookieJar` 都识别）。
- 真机验收：`cd electron && npm run smoke:crypto-native` 与 `npm run smoke:cookie-native`，两条都必须 Win32 与 x64 双架构编译通过并让生成的 exe 写出 `OK` 报告；裸 AES-128/256-GCM 已用 NIST GCM Test Case 1/2 已知答案并与 OpenSSL 输出逐字节比对，DPAPI 字节集覆盖前缀剥离与垃圾密文拒绝。

## CSV 表格导入与编码读取规则（2026-09-18 已落地）

- 读 CSV **必须**走 `lingbuilder.data.csv` 的 `CSV_打开文件(文件路径, [编码名称], [分隔符], [含表头])` 或 `CSV_解析文本(CSV文本, [分隔符], [含表头])`，返回 `表格数据` 句柄后用 `数据表_行数 / 列数 / 列名 / 取文本 / 单元格类型 / 取整数 / 取小数 / 取布尔 / 单元格为空 / 关闭 / 取错误` 消费。**禁止**用 `文件_读取文本` 再自行按换行拆行或按逗号 split：引号内的换行属于字段内容，拆行会把一条记录读成两条、列全部错位。行级 `CSV_字段数量` / `CSV_取字段` 只处理单行，不得用于整表。
- 行列号统一**从 1 起**，`数据表_行数` 不含表头行；取数值前先 `数据表_单元格类型`（`0` 空、`1` 整数、`2` 小数、`3` 布尔、`4` 文本）决定用哪条取值命令；快照用完必须 `数据表_关闭`；失败原因只从 `数据表_取错误()` 读，不得凭返回空值猜。
- 编码选择：来源不确定时传 `"AUTO"`（固定按 BOM → 严格 UTF-8 → GB18030 判定）；确知是 Excel 导出的中文 CSV 时显式传 `"GBK"`。不得把 GBK 原始字节当作文本传递或写回 `文本型`，也不得因为终端显示乱码就改中文文案——显式指定编码解码失败时命令返回 `0` 并给中文原因，不会静默换编码。
- 需要按编码读整个文本文件用 `文件_读取文本(路径, 编码名称)`（第二参可省，缺省保持历史 UTF-8 严格解码）；字节集与文本互转用 `编码_字节集转文本(数据, 编码名称)` / `编码_文本转字节集(文本, 编码名称)`，不要再经“字节→十六进制文本→文本”的三跳中介。
- **把 CSV 入库首选 SQLite 的 `csv` 虚拟表**（随 `lingbuilder.database.sqlite` 2.3.0 内置，无需加载扩展、无额外 DLL），不要手写逐行循环插库：

  ```text
  CREATE VIRTUAL TABLE 导入_员工 USING csv(filename='员工.csv', schema='(工号 INTEGER, 姓名 TEXT, 备注 TEXT)', header=1, encoding='AUTO')
  INSERT INTO 员工(工号, 姓名, 备注) SELECT 工号, 姓名, 备注 FROM 导入_员工
  DROP TABLE 导入_员工
  ```

  边界：表头行不会作为数据行返回；虚拟表**只读**，写库必须 `INSERT INTO 目标表 SELECT`；单元格按文本投递，落库形态由 `schema` 声明的列亲和决定；空单元格是空文本，需要 NULL 用 `NULLIF(列,'')`；虚拟表定义会持久化在库里，文件改名后 `DROP` 重建；构建前用 `SQLite_取虚拟表支持(连接)` 自查（返回 `csv` 即可用，空文本说明运行库缺少虚拟表导出，此时普通 SQL 仍可用）。参数写错（漏 `filename`、未知键）会直接返回中文诊断，照诊断改参数即可，不要转去手工逐行导入。
- 模块命令的可选参数在 `.lcpp` 里可以省略不写，前提是运行时 C++ 形参带默认实参；新增或修改这类命令时**必须**同时给运行时默认值，并让默认值与清单 `defaultValue` 逐字一致（生成器不会替省略的实参补值，缺默认实参会编译期报 C2660）。
- 生成示例与骨架时遵守既有 `.lcpp` 红线：`如果` 条件必须加括号，`如果/否则` 结构以 `如果结束` 收尾（不是 `结束`），否则会被结构检查阻断。
- 真机验收：`cd electron && npm run smoke:csv-sqlite-native`（Win32/x64 双架构编译 + exe 逐项自检）。

## new_emoji 运行时 DLL 单文件内嵌规则（2026-09-13 已落地）

- 启用 `lingbuilder.new_emoji.ui` 的 MSVC 构建会把按目标架构解析出的 `new_emoji.dll` 以 RCDATA 资源追加进 `src/lingbuilder-app.rc`，配合 main.cpp 模板的 `LB_NE_LoadEmbeddedRuntimeDll` + `LB_NE_DelayLoadHook`（delayimp 延迟加载钩子）生成单文件 EXE：首次 NE_*/EU_* 调用触发延迟加载，把资源解压到 EXE 目录（不可写时回退 `%LOCALAPPDATA%\LingBuilder
untime`）后 LoadLibrary；资源缺失时钩子返回空指针，自动回退「EXE 同目录加载」旧行为。
- 内嵌 DLL 的架构必须跟随编译器实际位数（`preferredTargetId`，即 `compiler.arch`），禁止按 buildDir 目录名猜架构：CLI 默认编译器是 x64 而目录名可能仍是 Win32，按目录名会把 32 位 DLL 内嵌进 64 位 EXE，运行期 LoadLibrary 直接失败。
- rc 行资源名必须写成不带引号的裸标识符：`NEW_EMOJI_DLL RCDATA "modules\lingbuilder.new_emoji.ui\bin\<架构>\new_emoji.dll"`。实测 VS18 工具链的 rc.exe 会把裸未定义标识符编译为字符串资源名，与 `FindResourceW(exeModule, L"NEW_EMOJI_DLL", RT_RCDATA)` 对齐；若给名字加引号，引号会原样保留在资源名里（15 字符），运行期反而查不到资源。rc 字符串内反斜杠必须双写。构建管线写 rc 行采用「先剥离全部历史 NEW_EMOJI_DLL 行、再追加规范行」的幂等自愈写法，旧产物里的坏行会被自动替换。
- `/DELAYLOAD:new_emoji.dll` 是纯链接器选项，经 `cl` 调起链接时必须放在 `/link` 之后（`delayimp.lib /link /DELAYLOAD:new_emoji.dll`）；否则 cl 会静默丢弃该选项（连 D9002 都不报），new_emoji.dll 退回静态导入，EXE 离开同目录 DLL 直接以 0xC0000135 无法启动，内嵌资源与延迟钩子全部失效。`#pragma comment(linker, "/DELAYLOAD:...")` 在 VS18 链接器同样不可用（LNK4229），不要改回 pragma 形式。
- 解压写文件必须用 `CREATE_ALWAYS`：`OPEN_ALWAYS` 不截断已有文件，覆盖更大的旧 DLL 会残留脏尾字节导致 LoadLibrary 失败。
- Visual Studio 独立导出工程不注入 RCDATA 行与 /DELAYLOAD，运行回退为「new_emoji.dll 与 EXE 同目录」（runtimeFiles 复制链路照旧）；单文件是 F5 / AI Bridge 构建管线的分发形态，两者程序行为一致。
- 验收口径：删除 EXE 同目录 `new_emoji.dll` 后启动，进程 5 秒后仍存活且可响应、窗口正常、DLL 由内嵌资源自动解压还原；x64 与 Win32 两个架构都必须分别验证。

## 三界面模块运行时控件生成规则（2026-08-05）

- Win32 基础模块只允许为当前目录中的 12 个可视控件生成代码创建接口；Win32 高级模块只允许为当前目录中的 20 个可视控件生成；`lingbuilder.new_emoji.ui` 只允许为当前 93 个公开可视控件生成。非可视组件以及旧兼容 Grid、ReBar、Pager 不得生成创建、标记查找或动态事件接口。
- 必须从模块实际 `runtimeControl`/binding 目录选择真实存在的具体类型命令，不得臆造名称。创建签名是“父级、位置尺寸、文本或该类型必要参数、可选标记文本、可选标记整数”；父级使用 `当前窗口`、兼容容器变量或标签页容器。只传整数标记时，文本标记位置必须传 `""`。
- `tagText` 和 `tagInteger` 始终可空。文本标记先 trim，空值表示未设置，按区分大小写的 UTF-16 精确匹配；整数标记为有符号 32 位，`0` 与负数有效。非空标记只在“当前窗口 + 具体控件类型 + 标记类别”范围唯一，不得把同窗口不同控件类型的相同标记误报为冲突。
- 查找必须使用具体类型命令，例如 `通过标记文本获取按钮("确认")` 或 `通过标记整数获取编辑框(1001)`，结果保存到相同具体控件类型的局部变量。操作查找结果前优先生成 `控件_是否有效`；找不到、重复标记、错误父级、类型不兼容或窗口已销毁时必须安全失败并保留中文诊断。
- 控件变量只允许局部变量、方法参数和返回值。禁止控件常量、数组、程序集成员、项目全局变量和工作线程传递。设计器裸控件名、控件变量、创建结果和查找结果可以进入兼容的通用/专属命令与成员语法；动态事件处理器必须使用 `&处理器名`。
- 代码创建控件只属于当前运行时，不得写回设计器或暗示重启后仍存在。Win32 每实例必须创建独立主 `HWND`；new_emoji 使用窗口级元素记录和稳定 ID。AI 不得手写注册表、元素 ID 或生成后端专属转换，必须交给统一 binding 和 C++ 生成器。

## Windows DLL 项目规则（2026-08-18）

- 创建或修改 Windows DLL 时必须使用 `windows-dll` 项目类型和 `lingbuilder.dll.json` 清单，不得把 DLL 伪装成窗口设计器项目，也不得生成只在 IDE 内模拟的运行结果。
- DLL 模板可以使用新手模式 `.lcpp`；默认编辑入口是 `DllApi.lcpp`，其中 `获取接口版本()` 的整数 `返回` 会确定性生成到示例导出函数。AI 必须把这条规则描述为当前模板示例映射，不得声称任意中文过程已自动获得 DLL 导出 ABI。
- DLL 项目没有 `designerProject`，AI/CLI 创建预览和导航必须指向 `.lcpp` 源码；遇到窗口控件、窗口事件或 `controlRef` 时应报告缺少设计器上下文，不得伪造控件或窗口模型。
- AI 生成的公开接口默认采用稳定 C ABI、POD/标量、调用方拥有的缓冲区或不透明受管句柄，并明确 `cdecl`、字符串编码、缓冲区长度和释放责任。禁止跨 DLL 传递 STL、C++ 异常、编译器私有类、未约定所有权的裸指针或函数内部静态缓冲区。
- 新增导出必须同步修改 `include/DllExports.h`、`exports.def`、manifest、实现源码、模块文档和测试；不得只修改 `.lcpp` 补全、React 组件或 AI 文案。生成的 Visual Studio 工程必须保持 `DynamicLibrary`、动态 CRT `/MD` 和正确的架构配置。
- 构建、导出和 AI Bridge 必须走受控 MSBuild。MSBuild 返回成功但没有同时生成 `.dll` 与 `.lib` 时，必须报告中文阻断诊断；不得静默改用任意 shell、用户 PATH 中不受控的编译脚本或公网下载工具链。
- 生成/修改多文件前先展示完整草稿和文件范围。DLL ABI、依赖、架构或所有权不明确时，AI 只能提出澄清或保守的 C ABI 示例，不能直接批量写入可能破坏调用方的接口。

## Aria2 下载模块规则

- `lingbuilder.net.aria2` 是 Windows x64 内置模块；AI 生成下载代码时必须优先使用 `Aria2_下载`、`Aria2_等待`、状态/字节数/速度查询、`Aria2_取保存目录`、`Aria2_停止` 和 `Aria2_释放`，不得拼接任意 `aria2c` 命令行或调用系统 PATH 中的下载器。
- 地址只能使用模块声明的 HTTP、HTTPS、FTP、FTPS 或 magnet 协议；连接数和最小分段大小必须在 binding 声明的范围内。下载目录和文件名由用户明确提供，不能把不可信文本转成额外参数。
- 需要实时面板时，优先为 `Aria2_下载` 的可选末尾参数传入 `&下载进度`；处理器必须精确声明为 `空 下载进度(Aria2任务 任务, 整数型 进度, 长整数型 已下载字节, 长整数型 总字节, 长整数型 速度字节每秒, 文本型 状态)`。回调在窗口线程执行，可直接更新控件；不得传字符串处理器名、裸函数地址，也不得从后台线程操作 UI。
- 轮询场景按固定间隔调用 `Aria2_取状态`、`Aria2_取进度`、`Aria2_取已下载字节`、`Aria2_取下载速度` 与 `Aria2_取保存目录`；速度优先来自 aria2 `DL:` 输出。下载完成后显示任务返回的实际目录。只可用 `Aria2_打开目录(任务)` 打开该任务目录，不能生成接受任意路径、任意命令或 Shell 参数的“打开目录”接口。
- 首版只生成 Windows MSVC x64 项目。F5、原生预览和 Visual Studio 导出必须同时携带 `aria2c.exe`、`COPYING` 和 `NOTICE.md`；缺少或哈希不一致时应阻断构建，不得静默降级。

## 窗口边框样式规则（2026-08-16）

- 窗口设计器项目支持 `borderStyle` 字段，7 个合法值：`none`（无边框，无标题栏）、`normal-resizable`（普通可调边框，默认）、`normal-fixed`（普通固定边框）、`thin-title-resizable`（窄标题可调边框）、`thin-title-fixed`（窄标题固定边框）、`frame-resizable`（镜框式可调边框）、`frame-fixed`（镜框式固定边框）。缺失时由迁移规则确定（旧项目 resizable=false → normal-fixed，否则 normal-resizable）。
- `borderlessDraggable` 仅 `borderStyle` 为 `none` 时有效，默认 `false`；为 `true` 时生成的 C++ 在窗口 WM_LBUTTONDOWN 注入 `SendMessageW(hwnd, WM_NCLBUTTONDOWN, HTCAPTION, 0)` 实现按住客户区拖动移动，命中子控件时不拦截。
- `resizable` 字段由 `borderStyle` 派生（固定类与无边框为 false，可调类为 true），AI 生成设计器项目 JSON 时不得独立设置与 borderStyle 矛盾的 resizable 值。
- `borderStyle` 的 Win32 样式映射由 `windowBorderStyle.ts` 的 `resolveLingWindowBorder` 统一维护：none → WS_POPUP|WS_SYSMENU|WS_MINIMIZEBOX；可调类 → WS_OVERLAPPEDWINDOW；固定类 → WS_OVERLAPPEDWINDOW & ~WS_THICKFRAME；窄标题加 WS_EX_TOOLWINDOW；镜框式加 WS_EX_DLGMODALFRAME。C++ 端 `LB_WindowBorderStyleToDwStyle`/`LB_WindowBorderStyleToDwExStyle` 辅助函数运行时按编号 0-6 计算。生成器、画布、测试三端共享同一映射，不得在别处复刻 Win32 样式逻辑。
# 2026-08-16 生成规则补充

- `.lcpp` 条件中的单个 `=` 表示相等判断（例如 `如果 (文本变量 = "完成")`），C++ 生成器必须确定性转换为 `==`；文本比较双方必须保持宽字符串语义，不能生成窄字符串或 C++ 赋值表达式。
# 2026-08-16 编辑器颜色规则补充

- `.lcpp` 中局部变量引用（包括 `如果 (局部变量 = "值")` 条件）必须使用独立的 `variable` 语义 token，并与局部变量声明表的绿色主题令牌保持一致；不得退化为普通标识符或关键字颜色。

# 2026-08-16 FBro 生成规则补充

- 未启用 `lingbuilder.fbro.browser` 的项目不得生成 FBro 控件、SDK 依赖或业务调用；窗口基类保留的浏览器管理器回退接口只能安全返回，目的是隔离发行 SDK 头文件可见性与项目模块上下文意外不一致，禁止用这些回退接口模拟浏览器功能。启用模块时必须继续使用完整 FBro 运行时和模块 binding。
# 2026-08-19 诊断规则补充

- 窗口控件方法的 `controlRef` 参数使用裸控件名时，局部变量初始化表达式中的控件引用（例如 `控件_取数值(进度条1)`）必须按当前窗口设计器符号解析，不能被普通变量名称检查误报为未知名称。
- 控件不存在、作用域不匹配或类型不兼容仍由统一 `controlRef` 诊断阻断构建；此规则只豁免已经存在于当前窗口模型中的控件符号。

# 2026-08-20 诊断规则补充

- AI 生成的 `.lcpp` 控件属性赋值（例如 `编辑框1.内容 = "结果"`）必须按当前窗口设计器符号解析；真实存在的控件不得被普通变量字段检查误报为“变量尚未声明”。
- 普通变量、项目类型字段和不存在的控件仍必须执行原有声明、字段、作用域和类型诊断。
- AI 生成剪贴板命令时必须同时启用 `lingbuilder.system.clipboard` 模块；未启用模块的命令不得直接落入 C++ 生成结果，应在 F5 前报告缺少模块诊断。
- AI 布局提案必须携带当前项目 `projectId`，且 `designerProject.id` 必须与之完全一致；禁止把外层解决方案或嵌套项目的模型应用到当前源码项目。
- 布局请求返回与当前模型完全相同的 `designerProject` 时必须阻断提案并明确提示未产生变化；确认应用后必须同时刷新画布并显式保存源码和 `window-designer.json`，不能只修改 renderer 内存。

# 2026-08-22 AI 会话服务规则

- AI 对话必须按当前项目 ID 隔离并由本地服务持久化到工作区 `.lingbuilder/ai/`；不得用 renderer `localStorage` 作为会话记忆的权威来源，也不得在项目之间复用消息、摘要、代码片段或检索上下文。
- 会话文件只允许保存会话标题、时间、用户/助手消息及非敏感模型标识。API Key、云端访问令牌、系统账号凭据和服务器登录凭据必须继续保存在受控内存或 Electron `safeStorage`，不得进入会话、日志、项目文件、提示词或命令行。
- 对话中的源码、设计器和项目修改仍必须走现有草稿预览、确认、原子应用和撤销链路；持久化会话不能绕过 AI Bridge 的权限模式、路径校验、模块上下文或 `.lcpp` 诊断。
# AI 编辑点数规则（2026-08-22）

云端 AI 编辑请求的默认输出预算为 8192 token，避免以过大的预扣预算误报点数不足；请求显式输出上限时不得超过模型上限，实际扣点以最终用量为准。
# 2026-08-22 AI 对话意图与可读性规则
- 用户未明确要求修改、修复、重构、生成或删除代码时，必须按普通问答处理，不得主动生成编辑草案或要求审阅批准。
- 只有明确编辑意图才允许进入编辑提案流程；编辑提案必须继续遵守预览、确认、原子应用和可撤销规则。
- 开发者消息标签和正文必须使用足够的颜色对比度，不能用低透明度文字造成肉眼难以阅读。
- AI 助手和开发者消息都必须支持文本选择与右键复制；复制不得触发编辑提案或改变源码。
- “清除当前上下文”只清空当前项目会话的消息并保留会话 ID；“新建会话”创建新的项目会话。两者必须可通过命令面板执行，历史会话必须按项目隔离。

## SDK 直链云端配置规则（2026-09 已落地）

- SDK 按需下载清单支持云端远端替换（B 档）：管理后台「SDK 下载源」页可整条发布清单（Ed25519 整条签名 + sequence 防回滚），IDE 无需发版即可跟随换直链。设计文档 `docs/SDK按需下载直链云端配置设计.md`，发布流程 `docs/SDK下载清单发布流程.md`。
- 字段分两类：**锚定字段**（`id`/`moduleId`/`name`/`platform`/`requiredModuleIds`/`criticalFiles`）远端必须与 IDE 内置清单逐字一致，IDE 深度比对失败会整条拒绝并回退内置清单（保护 `requireForModules` 门禁与解压校验强度）；**可更新字段**（`version`/`sdkVersion`/`archiveName`/`downloadUrl`/`archiveBytes`/`sha256`/`fileCount`/`expandedBytes`）才允许远端修改。任何 AI 生成或修改清单时不得触碰锚定字段。
- IDE 侧信任锚硬编码在 `electron/src/services/sdkDependencies/catalogTrustAnchors.ts`（当前为空 = 远端禁用，IDE 用内置清单）；禁止用环境变量、配置文件或云端下发覆盖公钥。清单 URL 允许 `LINGBUILDER_SDK_CATALOG_URL` 覆盖（仅测试/开发）。
- Ed25519 验签用 Node `crypto.sign/verify(null, data, key, sig)`——第一参数必须是 `null`，传 `'ed25519'` 会抛 `ERR_CRYPTO_INVALID_DIGEST`。清单 `sha256` 只接受 64 位小写十六进制。sequence 单调递增并持久化于用户目录，低于已接受值整条拒绝。
- 云端签名密钥为配对环境变量 `SDK_CATALOG_PRIVATE_KEY_PEM` + `SDK_CATALOG_PUBLIC_KEY_PEM`（缺一或公钥不匹配即抛错；生产缺钥发布接口 503，绝不下发未签名清单）。
- 发布门禁：`cd electron && npm run sdk-catalog:check` 拉线上清单与内置清单逐字比对锚定字段，漂移/不可用输出中文诊断退出 1；CI 或换直链后必跑。
- 修改 SDK 清单校验、admin「SDK 下载源」页、`sdkCatalogRemote.ts` 或门禁脚本时，必须同步 `docs/SDK按需下载直链云端配置设计.md`、`docs/SDK下载清单发布流程.md`、`electron/README.md`、AGENTS.md 与当天更新记录；用户向说明在官网文档中心 `cloud/admin/docs/guide/user/advanced/sdk-download.md`。

## 模块 Permit 信任根规则（2026-09 已落地）

- IDE 对模块 Permit 的验签只信任 `electron/src/services/modules/modulePermitTrustAnchors.ts` 内置锚点（keyId = SHA-256(SPKI DER) 前 16 位小写 hex；当前钉生产签发密钥 `0e2853e87a4250d3`）。禁止任何环境变量、配置或云端下发覆盖锚点，换锚必须走 IDE 发版；服务端 `/v1/modules/permit-key` 返回的 PEM 永不进入信任集，`keyId` 仅作轮换元数据。
- keyId 不在锚内时同步端点返回 `MODULE_PERMIT_ANCHOR_UNKNOWN` 中文诊断（云端已轮换时提示升级 IDE）；伪造/未锚定 Permit 一律拒绝。
- 云端 `MODULE_PERMIT_ACCEPTED_KEY_IDS` 维护轮换列表并经 `/v1/modules/permit-key` 的 `acceptedKeyIds` 下发，必须包含当前签发密钥；轮换顺序：云端加新 keyId → 发带新锚的 IDE → 再切签发密钥。

## 动态图像控件运行时规则（2026-09-04）

- Win32 动态图像控件使用持久化双缓冲 DIB 在控件自身 WM_PAINT 中绘制 GIF 当前帧；不得在定时器中逐帧调用 STM_SETIMAGE 或创建未回收的位图句柄。
- 动画定时器只推进帧索引并触发无擦除重绘；控件销毁、DPI 重建必须释放双缓冲 DC、DIB 与 GDI+ Image。

### EdgeView 下载路径与下载状态读取时序（2026-09-06）

- `EdgeView事件_设置下载路径(控件, 文件路径)` 只能在「下载开始」**同步处理器执行期间**调用，
  与 `EdgeView资源_设置事件响应文本` 同属事件决策窗口接口；离开该窗口调用返回 0。
- 模块会把相对路径按当前工作目录补全成绝对路径，并逐级创建父目录
  （WebView2 的 `put_ResultFilePath` 只收绝对路径且要求目录已存在）。
  生成 C++ 时该值走独立槽 `eventDownloadPath`，不再与 `eventResultText` 共用。
- **`EdgeView下载_取状态JSON` 的 `path` 在「下载开始」处理器内是决策前的默认落点快照。**
  要确认改路径是否生效，必须在事件结束后再读一次（推荐单独一个按钮）。
  返回 JSON 含 `resultFilePathError`（非零即 `put_ResultFilePath` 失败，同时输出中文诊断）
  与 `pendingResultFilePath`（本次请求的落点）。事件内读到的 `path` 是决策前快照，对比 `pendingResultFilePath` 即可自证。
- 示例：`下载开始` 里记下 `downloadId` 并改路径 → 另一个事件处理器里用
  `EdgeView下载_取状态JSON(控件, 最近下载ID)` 展示最终落点。控件参数一律裸引用。


## FBro 浏览器模块全量能力面（2026-09-09 批次 0-7 落地）

- 火山三工程对比发现的 75 条功能缺口已全部封装：新增 57 条中文命令分布在 browser/session/objects/automation/network 子模块（宿主信息与实例注册表、受管请求/提交数据/进程消息构造、URL 请求、填表 TianBiao、取源码/取文本、后台创建、启动命令行开关、右键菜单句柄、页面调原生 JS 扩展、CEF 内嵌服务器）。桥 bridgeVersion 2.6.0，`lingbuilder.fbro.browser` 2.6.0。
- 命令族要点：请求/提交数据/进程消息为受管句柄对象（`FBro请求_*`/`FBro提交数据_*`/`FBro消息_*`）；填表 Set 族同步发后即忘，取值/取坐标内联等待并返回 JSON；`FBro框架_取源码/取文本` 返回 UTF-8 受管缓冲（配合 `FBro缓冲_转文本/保存文件`），避免大页面截断；启动开关（禁GPU/媒体流/语音输入/自动播放等 6 项设计器属性）由生成器烘焙 `LB_FBro_SetStartupSwitches` 在 CEF 初始化前应用，`FBro_取启动命令行` 查询生效结果。
- 填表补齐（2026-09-10 批次 2 落地）：`FBro填表_*` 家族扩至 22 条，与易语言填表框架公开命令一一对应；新增 `置选择框/置选择项/置内文本/置外文本/置内代码/置外代码/置属性/触发事件`（同步）与 `取选择框/取选择项/取内文本/取外文本/取内代码/取外代码/取属性/元素是否存在`（内联等待返回 JSON）。桥接层对全部填表命令的选择器与文本参数做半角双引号转义（对齐易语言「内置引号处理」，只转义引号不动反斜杠），AI 生成示例时不得手工转义，也不得把带引号文本当作不可用场景。
- 同步取数阻塞变体（2026-09-10 批次 3 落地）：`FBro传输_生成PDF(控件名, 输出路径, 设置JSON)` 返回 1 表示文件已生成（60 秒超时，设置 JSON 传空文本用默认）；`FBro图像_下载(控件名, 地址, 作为图标, 最大尺寸, 绕过缓存)` 直接返回图像句柄、失败返回 0，用完调用 `FBro对象_释放`。至此高频取数链路（填表读取族、取源码/取文本、取Cookie、截图到文件、生成PDF、图像下载）全部可一句式调用；仍返回任务句柄的异步命令保持不变，需要并发或流式时优先用异步族。
- 右键菜单模型（2026-09-10 批次 4 落地）：`FBro菜单_*` 31 条 + `FBro右键参数_*` 新增 16 条（合计 19 条），在「上下文菜单显示前」事件内经 `FBro_取事件对象` 取 menu/params 句柄后调用（句柄仅事件处理期内有效）。`FBro菜单_取子菜单` 返回受管子菜单句柄；`FBro菜单_取加速键/按序取加速键/按序取颜色` 返回 JSON。官方 `IsPepperMenu` 在 SDK 头中被注释，无对应命令，AI 不得生成。点击回调仍走「上下文菜单命令」事件按命令ID分发。
- 下载项快照（2026-09-10 批次 5 落地）：「下载开始/下载进度更新」事件的字段 JSON 新增 `downloadItem` 受管句柄；`FBro下载_*` 16 条命令（是否进行中/完成/已取消、取百分比/下载ID/速度/总长度/已接收字节/开始结束时间/完整路径/地址/原始地址/建议文件名/MIME类型/内容处置）在该句柄上读取快照，事件结束后句柄失效。下载落盘仍通过「下载开始」事件应答 `path` 改写，读取命令不改变下载行为。
- 响应对象（2026-09-10 批次 6 落地）：「资源响应到达/资源加载完成」事件字段 JSON 新增 `response` 受管句柄；`FBro响应_*` 19 条命令（创建/是否只读/错误、状态码与状态文本、MIME/字符集/地址、协议头单条与映射 JSON 读写、删除协议头）读写响应。只读响应不得改写；改写正文走 `FBro_替换资源响应内容/文本` 族，响应对象适合读取元数据和自定义资源处理器构造响应。官方 `SetHeaderMap`（PTELIB 结构）不封装，等价走 `FBro响应_设置协议头映射JSON`。
- 输入注入（2026-09-10 批次 1 落地）：`FBro_发送鼠标单击事件/发送鼠标移动事件/发送鼠标滚轮事件/发送按键事件/发送触摸事件(控件名, …)` 走内核输入管线，页面收到的事件带 `isTrusted`，与 `FBro_执行JS` 内 `dispatchEvent` 的合成事件有本质区别；反自动化页面和主流前端框架只信任前者，模拟点击/键盘必须用这组命令而不是 JS 模拟。按钮类型 0=左键 1=中键 2=右键（双击传单击次数 2）；按键事件类型 0=原始按下 1=按下 2=释放 3=字符输入，`字符编码`/`未修改字符编码` 低 8 位为低字节、高 8 位为高字节（ASCII 同值）；触摸压力 0~1、旋转角度为弧度。三种进程模式都可用，独立进程模式经受管通道转发 Host 内执行。
- 右键菜单定制：`OnBeforeContextMenu` 事件升级为同步应答——事件包携带 menuHandle/paramsHandle/x/y（仅事件处理期内有效，回调结束即回收），宿主以 JSON 操作数组应答（addItem/addCheckItem/addSeparator/addSubMenu/remove/clear/setChecked/setEnabled/setLabel/setAccelerator）。
- 页面调原生：`FBro_启用JS扩展(查询函数名, 取消函数名)` 必须在首个浏览器创建前调用；页面执行 `lingQuery("...")` 触发“JS扩展调用”事件（OnQuery），处理器用 `FBro事件_继续` 回传 `{"success":true,"result":"..."}` 或 `{"success":false,"error":"...","errorCode":n}`，120 秒超时自动按 Failure 应答。
- 后台创建：`FBro_后台创建(地址, 缓存目录, 附加信息JSON)` 创建无窗口实例（FBroHsCreateBackground），事件照常分发；附加信息 JSON 键不覆盖内置 flag。
- 有意不暴露：`FBroHsOnlineLicenseControl_SetKey`/`SetLicenceKey`（Key 走环境变量）、`CreateSync/CreateBackgroundSync`（阻塞冲突）、`UseExtraData` 族（字典直传等价）、`FBroHsRequest_Set`（PTELIB 结构）；实例列表族用桥自有注册表等价实现。火山内部管线（结构转换器/SynEventDis/迭代器）确认不封装。
- 待办：R2 上传 2.6.0 归档（sha256 eeb1494c…f12）+ 管理后台 SDK 下载源发布（sequence+1）；各命令端到端 exe 冒烟（当前为导出探针+门禁绿）。

# 2026-09-14 多行文本块生成规则补充

- `.lcpp` 新增多行文本块语法（三引号），用于内嵌 HTML/JSON/模板等大段文本：开始行 `变量 = """`（行尾三引号、目标为标识符或成员链），内容行原样保留（不解释 `\n`/`\t`/反斜杠/引号，行尾统一按 `\n`），结束标记单独一行 `"""` 且其后不得有内容。词法与收敛实现在 `electron/src/services/lingCpp/textBlock.ts`（共享扫描器）与 `parser.ts`（块收敛为单条语句、`LingCppStatement.endLine`）。
- 一期边界：只允许赋值右部。`局部 文本型 X = """`、常量/全局/成员/字段声明初值、命令实参、`返回` 都出中文诊断；两步写法（先声明、后 `X = """` 赋值）是唯一合法形态，与局部变量提升口径一致。未闭合块吞到文件末尾并在开始行报「多行文本块缺少结束标记」，孤立结束标记报「多余的文本块结束标记」。
- C++ 生成：`lingCppWin32Project.ts` 的 `translateStatement` 文本块分支把内容经 `escapeWideString` 折叠为单行 `目标 = L"…\n…";` 宽字面量（真实换行→`\n`、引号→`\"`、反斜杠→`\`），Win32 与 new_emoji 后端共用；误用兜底降级为 `L""` 注释，绝不把三引号原文吐进 C++。
- 豁免面（AI 生成或重构时必须保持）：块内文本对控制流配对、新手缩进/注释切换/自动声明/命令展开/补全、Monaco 与新手着色、功能库与控件引用扫描、后端命令契约、全局/常量/数据类型重命名、`formatLingCpp` 全部不透明；重命名与格式化改写器必须跳过块行。
- 编辑器口径：新手画布把块行渲染为不透明字符串行（不参与命令参数面板与流程导轨）；专业 Monaco 用 `textBlock` tokenizer 状态跨行着色。生成↔回读往返（importNativeCpp）与命令实参位文本块属二期，见 `docs/FUTURE_OPTIMIZATIONS.md`。

# 2026-09-16 中优先级命令族（哈希表/栈/大数/拼音/农历/控制台/全局热键/打印机）

- 哈希表与栈模块（lingbuilder.std.map）：句柄制，`哈希表_创建`/`栈_创建` 返回句柄（0 失败），值分文本/整数/逻辑/字节集四组置取命令（写入类型必须与读取命令配对，跨类型读取返回默认值并置 `哈希表_上次操作是否成功` 假）；`哈希表_取全部键` 输出文本数组，键序不保证与插入一致。示例必须「先声明后赋值」两段式（防生成器局部变量提升重排）。
- 大数运算模块（lingbuilder.std.bigint）：任意长度**整数**（十进制文本互转），`大数_除` 向零取整、`大数_求余` 余数符号同被除数、除数为 0 返回句柄 0；运算不修改操作数，每次返回新句柄，长循环注意 `大数_销毁` 回收。不支持小数。
- 拼音处理模块（lingbuilder.std.pinyin）：`拼音_取全拼(文本, 分隔符)` 分隔符可省略；多音字取最常用读音（`重` 首选 zhòng），全部读音用 `拼音_取所有发音`；`拼音_首字母匹配(文本, 序列)` 用于中文首字母检索（不区分大小写）；非汉字字符在转换命令中原样保留。
- 农历日期模块（lingbuilder.std.lunar）：农历月负数表示闰月（闰六月=-6），与易语言惯例一致；`农历_取节气(年, 序号1~24)` 返回北京时间精确到分钟的日期时间（序号 1 小寒…24 冬至）；`农历_取四柱` 年柱月柱严格按节气分界，仅支持 1901–2100；年历表 1900–3000。日期时间值与日期时间模块同一编码可直接互传。
- 控制台模块（lingbuilder.console）：**只能在控制台程序（含「整数型 启动()」入口）中使用**；窗口项目中调用会得到阻断诊断「控制台命令只能在控制台程序中使用」。颜色编号 0～15（7 灰白/黑底为默认）。
- 全局热键（键盘输入模块 2.1）：`键盘_注册全局热键(修饰键组合, 虚拟键码)` 返回热键 ID（0 失败，组合被占用）；修饰键位掩码 1 Shift、2 Ctrl、4 Alt、8 Win 可相加。触发走窗口「全局热键被按下」事件（参数：热键ID/键码/修饰键），需在窗口创建完成后注册；控制台程序无窗口不支持。
- 打印机族（Win32 高级控件模块）：`打印机_取列表(结果数组)`/`打印机_取默认()`/`打印机_置默认(名称)`/`打印机_是否在线(名称)`；已有 `打印/打印文本/页面设置` 不变。
- 示例红线：字符串拼接用 `格式化文本("K={}", 值)`，禁止「字面量 + 命令调用」直接实参拼接（生成端 C2110/C2660）。
