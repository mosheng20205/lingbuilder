# LingBuilder 后期优化事项

## 2026-07 状态记录

- 已修复：设计器暗色按钮、复选框、单选框和进度条的颜色属性进入 LingCpp Win32 原生绘制链路；未配置菜单的窗口不再注入演示菜单；进度条显示值与结构化值保持同步。F5/生成运行窗口会覆盖 IDE 完成回调的短时间保持前置，随后自动恢复普通层级；编译输出与设计器日志在连续追加后于布局完成时自动滚动到最新记录。

- 已完成：新增真正的 `CommandService`、上下文 `when`/禁用状态、中文标题与英文 alias、快捷键冲突诊断和全局键盘路由；工作台命令面板支持搜索、键盘导航、焦点恢复、空状态和执行失败状态，工具菜单及常驻按钮均可打开。
- 已完成：新增用户/工作区 `ConfigurationService` 与设置页，落实“工作区 > 用户 > 默认值”优先级、schema 校验、旧 JSON/localStorage 迁移、损坏文件诊断和作用域独立持久化；字号、体验模式、主题、面板可见性及快捷键覆盖均连接真实工作台状态。编辑体验切换/重置受草稿提交守卫保护，快捷键拒绝裸输入键和默认/自定义冲突，未保存快捷键在关闭或切换作用域前确认。
- 已完成：项目文本读写统一接入 `TextFileService`，支持 UTF-8、UTF-8 BOM、UTF-16 LE/BE 和 LF/CRLF 检测、显式转换及字节往返；状态栏可修改活动文件格式并进入脏状态，保存、F5 前保存与 AI Bridge `edit.apply` 均保留所选格式。Diff 的编辑/并排/内联三种模式已有可见入口和命令面板命令，中间插入/删除、CRLF/LF 与末尾换行已纳入回归测试。
- 已完成：新增全工作区内容搜索与替换服务、工作台对话框和 `Ctrl+Shift+F` / `Ctrl+Shift+H` 命令，覆盖纯文本/正则、大小写、文件/项目/工作区范围、结果分组勾选和精确行列跳转。替换以“磁盘查询快照 -> 预览 -> 哈希复检 -> 原子应用 -> LIFO 可撤销事务”执行，脏编辑器必须先保存并重新搜索；应用/回滚中途失败或落盘后校验失败都会恢复一致状态，并保留原编码、BOM、换行和最终字节。正则安全拒绝灾难性回溯/反向引用/指数可选链；查询、预览、全缓存和事务数量均有硬上限，公共长行预览与行列换算保持线性有界。
- 已完成：新增会话级 `TextModelService`、本地 Monaco 模型适配器和每文件结构编辑历史，稳定隔离工作区/项目/文件及专业/新手/原生表面的光标、滚动和正反向选区；重命名保留模型关联，删除同时释放原生预览子模型。`.lcpp` 的新手正文与专业 Monaco 共用一条每文件规范撤销时间线，Monaco 普通输入及分组撤销/重做事件同步到同一快照序列，首次进入专业和跨模式连续撤销/重做均不依赖第二套回退栈；非 `.lcpp` 文件保留 Monaco 原生历史。项目文件权威载入前统一禁止保存、F5、文件变更、AI 应用和工作区替换；请求具备超时、取消、中文错误与重试，空响应不会把旧文件挂到新项目，异步写回以“项目 ID + 载入代次”拒绝切换或重载后的旧响应。Monaco 核心、worker 和 C++/INI 基础语言包完全本地化并加入构建产物校验。
- 已完成：F04 使用 SHA-256 磁盘版本令牌、`fs.watch` SSE 监听、冲突保留/重载策略、配置化自动保存、`.lingbuilder/recovery` 热退出恢复和临时文件原子替换/批量回滚完成外部文件同步闭环。
- 后续建议：E01 的搜索哈希只保护一次查询/替换事务，不替代 F04 的持续磁盘监听；后续仍需在外部修改发生时主动提示、对比或重载，而不是等到用户应用替换时才发现冲突。
- 后续建议：F05 只保证当前 renderer 会话内的模型与历史；跨重启未保存恢复、磁盘外部冲突、自动保存和热退出仍归 F04，必须基于版本令牌与恢复文件实现，不能复用内存撤销栈冒充持久化恢复。
- 后续建议：复制/粘贴和设计器专用操作仍需逐步注册为带编辑器上下文的命令贡献；撤销/重做已经进入工作台命令，结构字段保留浏览器原生撤销，只有代码正文/Monaco 才由文件模型接管快捷键。
- 已完成：项目文件重命名/删除改为真实服务端磁盘操作，统一限制在当前项目 `sourceRoot` / `configRoot` 和工作区真实路径内，拒绝越界、符号链接、目录、目标冲突；工作台会串行提交新手草稿并同步标签页/活动文件状态，不再只改 React 内存。
- 已完成：F5 和 AI Bridge `build.run` 启动的原生 exe 改由 `ManagedProcessService` 按 `projectId` 持有进程句柄；重新生成会在写入/编译固定 exe 前等待旧进程与日志流收尾，避免 Windows 文件锁导致链接失败。IDE 内嵌 AI Bridge 与 F5 共享项目构建租约，外部 CLI 使用独立租约；同项目并发会被拒绝。Shift+F5 可取消在途生成并停止全部受控进程，服务/CLI/MCP 退出会等待在途租约并最终回收登记进程，不再遗留 detached 预览进程或发生“停止后迟到启动”。
- 已完成：“环境检查”改为真实只读探测 Node.js、MSVC/vswhere/vcvars、Windows SDK `rc.exe`、CMake、g++、clang++、WebView2 和 Windows 平台，并通过 `/api/environment/check` 返回中文明细与缺失警告，不再输出固定成功日志。
- 已完成：上述三项新增独立服务测试和 renderer server API 集成测试，并纳入 `npm run test:lingcpp` 全量门禁；完成度与验收证据统一记录在根目录 `IDE_FEATURE_COMPLETION.md`。

- 已完成：建立统一 Win32 控件注册表，窗口设计器项目升级到 schemaVersion 2 并兼容迁移旧 `content` 数据；基础与高级控件模块、工具箱、专属属性、事件和 C++ 原生适配器共享同一份定义。
- 已完成：新增 `lingbuilder.win32.common-controls`，覆盖微软标准 Common Controls、RichEdit、非可视 ImageList/ToolTip/PropertySheet 贡献和系统文件、目录、颜色、字体、查找替换、打印、页面设置、任务对话框 bindings。
- 已完成：LingCpp Win32 生成运行时支持多事件表、WM_COMMAND/WM_NOTIFY/滚动通知、真实父子 HWND、集合数据、范围/选中/样式属性，并通过全控件 MSVC Win32 编译及 3 秒存活冒烟。
- 已完成：窗口设计器接入项目模块变更事件，启用或禁用 Win32 高级控件模块后工具箱会实时解除或恢复灰色状态，无需重新加载 IDE。
- 已完成：属性面板已为列、ListView 行、树节点、标签页、工具栏按钮、状态栏分区、Rebar 带区提供结构化增删、排序和嵌套编辑；ImageList 提供项目资源编辑器、控件引用下拉框与安全相对路径诊断，不再要求手写数组 JSON。
- 已完成：ToolTip 作为独立附加行为资源绑定目标控件，每个资源使用独立原生 tooltip HWND 和显示延迟；PropertySheet 作为非画布顶层资源提供页面编辑、`属性页_显示` 命令和 Applied 中文事件派发，并完成真实 `#32770` 窗口创建/确定运行测试。
- 已完成：`.lcpp` 通过基础/高级模块 bindings 提供通用控件文本、启用、可见、勾选、数值、选择和集合操作，以及 ListView 行、TreeView 节点、Tab 页面操作；MSVC 运行测试会直接读取 HWND 状态验证中文代码产生真实变化。
- 已完成：PropertySheet 页面可引用普通设计器窗口作为控件模板，复用该窗口的全部标准控件、专属属性、父子 HWND 和事件类；真实运行测试已在 `#32770` 页面中确认 Label、CheckBox、ListView 及列表数据创建成功。
- 已完成：逐控件运行时消息、PropertySheet 20 轮重复创建销毁资源泄漏和桌面/窄屏设计器布局验收；1440×900 与 768×900 均无页面级横向溢出，工具箱和属性区不重叠，Win32 基础控件与高级控件全量闭环。
- 后续建议：补充自动化 UI 截图基线与 HWND 句柄泄漏压力测试；当前验证覆盖注册一致性、v1→v2 迁移、生成文本、MSVC 编译和进程存活。

- 已完成：`.lcpp` 成为默认中文源码格式，Electron 原型默认主文件为 `src/游戏主窗体.lcpp`。
- 已完成：Monaco 识别 `lingcpp`，窗口设计器与构建链路默认读取 `.lcpp` 作为主源码输入。
- 已完成：设计器项目持久化落到 `.lingbuilder/window-designer.json`，可复制生成结果输出到 `generated/cpp/`，`.lingbuilder-build/` 继续只作为临时构建目录。
- 已完成：新增本地 Git 状态读取接口 `/api/source-control/status`，并新增预览优先的 AI 编辑提案接口 `/api/lingcpp/edit/*`。
- 已完成：`.lcpp` AI 编辑提案改为模型驱动的完整文件重写 + 本地最小 WorkspaceEdit diff 计算；Gemini 不可用时自动降级到本地安全提案。
- 已完成：补充 `electron/tests/lingcpp.test.ts`，覆盖 parser、generator 和 WorkspaceEdit diff 回归验证，并提供 `npm run test:lingcpp`。
- 已完成：AI 编辑提案扩展为多文件工作区提案，支持同时预览/应用 `.lcpp`、配置文件等多个真实工作区文件。
- 已完成：生成器回归测试扩展到复选框、单选框、进度条、下拉框、窗体创建事件、暂不支持语法安全注释和多文件 WorkspaceEdit。
- 已完成：模块构建链路开始支持外部 C++ 模块依赖复制，`new_emoji` 可通过 `.lbmod` 安装并在 F5 Win32 预览中复制 DLL/lib/header/source。
- 已完成：新增 AI Bridge CLI 与本地 `/api/ai-bridge/*` 接口，支持 token 鉴权、`readonly` / `preview` / `yolo` 权限模式、受控文件读取搜索、LingCpp 诊断、编辑提案应用、模块上下文、C++ 预览/导出和 MCP stdio 工具映射。
- 已完成：原生导出和 F5/AI Bridge 构建运行会同步生成 Visual Studio Win32 工程文件（`.sln`、`.vcxproj`、`.vcxproj.filters`），并把模块 include/lib/source/runtime 依赖写入 VS 工程。
- 已完成：修复 `new_emoji` 桥接层 UTF-8 转换缓冲区少分配 1 字节，以及临时 UTF-8 指针被 DLL 后续读取的问题，避免 Visual Studio Debug 运行时报 `HEAP CORRUPTION DETECTED` 或读取 `0xDDDDDDDD` 访问冲突。
- 已完成：修复 `.lcpp` 解析器把事件/方法块结尾 `结束` 误翻译为运行时 `结束();` 的问题；显式退出命令应写作 `结束()`。
- 已完成：模块生态升级到 schemaVersion 2，C++ 依赖改为 `targets[]`，中文命令到 C++ 的生成改为 `bindings.commands[]`，并新增模块 SDK/CLI、模块开发者中心 API、根目录 `模块开发手册.md`。
- 已完成：`new_emoji` 模块生成脚本升级为 v2 manifest，包含 Win32/x64 targets、`NE_` 桥接命令 binding、底层 API 文档和重新打包安装入口。
- 已完成：新增内置 `WebSocket 客户端模块`（`lingbuilder.websocket.client`），提供 `WS_连接`、`WS_发送文本`、`WS_接收到调试输出`、`WS_接收文本`、`WS_关闭`，Win32 生成器内置 WinHTTP WebSocket 运行时和 `winhttp.lib` 链接。
- 已完成：新增内置 `HTTP 服务端模块`（`lingbuilder.http.server`）和 `WebSocket 服务端模块`（`lingbuilder.websocket.server`），提供本地 `127.0.0.1` 单连接同步服务端命令；Win32 生成器内置 Winsock HTTP/WebSocket 服务端运行时，并链接 `ws2_32.lib` / `advapi32.lib`。
- 已完成：Electron 安装版改为由主进程管理独立本地服务进程，服务只监听 `127.0.0.1` 随机端口，renderer 请求由桌面宿主注入随机会话 token；安装版不再直接 `loadFile`，退出和工作区切换会终止旧服务。
- 已完成：IDE 内嵌 AI Bridge 默认关闭，外部 AI 继续通过 `lingbuilder ai-server` 显式启动；HTTP 只接受独立 Bearer token，工作区访问统一使用 realpath/符号链接策略并补齐拒绝审计。
- 已完成：安装版首次运行只补充复制“文档/LingBuilder/示例工作区”的缺失文件，保留用户修改，并在 `userData/workspace-state.json` 恢复最近工作区。
- 已完成：新手编辑器建立 flush/save/build 事务；`Ctrl+S`、F5、保存并退出及文件/项目/模式切换都会先提交未失焦草稿，保存失败不会构建或关闭，保存与构建互斥。
- 已完成：模块页按当前活动 `projectId` 隔离状态；Win32 原生依赖不再回退到 `targets[0]`，模块包预览/校验/打包会验证所有声明文件存在，`new_emoji` 高层命令补全与 binding 参数数量一致。
- 已完成：窗口设计器新增“布局内容”组件层级树，窗口、菜单栏、菜单项和普通控件可展开查看；控件模型支持可持久化 `parentId`，可通过网格容器组织父子组件，并对无效父级和循环层级安全降级。
- 后续建议：继续增强模块 v2 跨平台 target 的真实构建能力，包括 CMake、Linux/macOS、x64 F5 选择、签名校验和远程市场上传审核服务。
- 后续建议：继续把 AI 编辑扩展到语义级 range 规划、跨模块依赖分析和更细粒度的审查提示。
- 后续建议：AI Bridge 的 `build.run` 已复用受控生成、编译和 `ManagedProcessService` 运行链路，但仍未开放任意 shell；后续应接入正式 `TaskService`，进一步提供编译子进程即时取消、结构化问题面板跳转和实时日志流。
- 后续建议：继续扩展 LingCpp Parser/IR 覆盖面，把变量赋值、控件属性读写、字符串拼接、窗口打开/关闭等中文语法纳入生成器。
- 后续建议：为 `new_emoji` 增加 x64 构建目标选择、设计器控件深度映射、全量 EU_ API 参数类型增强和可视化示例模板。
- 后续建议：把“纯 new_emoji 独立演示入口”沉淀成正式模板或生成器选项。该模板必须避免在创建完毕事件中调用 `结束`，并在创建 new_emoji 窗口后进入 `NE_运行消息循环` / `EU_RunMessageLoop()`；构建验收需启动 exe 并确认 3 秒后仍在运行，防止再次生成闪退示例。

本文档记录当前原型阶段为了快速闭环而采用的临时方案，以及后续必须工程化完善的方向。后续 Agent 开始大改动前应先阅读本文件，避免把原型实现误判为最终架构。

## 1. 窗口设计器持久化

### 当前状态

- 已完成 B01：Debug/Release 与 Win32/x64 使用工作区配置统一驱动 F5/解决方案编译参数、模块 target、分配编译环境和输出目录，不再使用状态栏固定文字模拟。
- 已完成 B02：解决方案 v2 持久化项目引用和多启动项，构建通过依赖图拓扑排序，循环/缺失引用明确失败，删除项目会清理悬空关系。

- `WpfDesigner` 的窗口项目模型当前会自动保存到 `localStorage`。
- 保存内容包括窗口集合、当前窗口、选中控件和控件属性。
- 这个方案只适合 Web/Electron 原型阶段，用于避免切换“窗口设计器 / 中文代码映射”时丢失临时编辑状态。

### 风险

- `localStorage` 不是项目文件，不适合团队协作、版本管理、跨机器迁移和真实工程构建。
- 用户清理浏览器/Electron 数据后，设计器状态会丢失。
- 多工作区、多项目、多窗口同时打开时，单一 key 容易造成状态覆盖。
- 设计器模型、`.e` 中文源码、生成的 XML/C++ 运行时代码还没有形成完整的项目文件闭环。

### 后期目标

- 将窗口设计器模型保存为工作区内的项目文件，例如 `.lingbuilder/window-designer.json` 或等价工程配置。
- 通过 `FileService` / Electron 原生文件系统桥接读写，不让 React 组件直接依赖存储细节。
- 设计器模型、中文 `.e` 源码、布局 XML、生成 C++ 都应有明确的同步关系和脏状态。
- 支持保存、另存为、打开项目、最近项目、自动恢复和冲突提示。
- 支持模型版本号和迁移函数，避免旧项目无法打开。

### 建议落地步骤

1. 新增 `WindowDesignerProjectService`，封装加载、保存、脏状态、迁移和事件通知。
2. 新增项目文件格式，至少包含 `schemaVersion`、窗口模型、活动窗口、选中控件、关联 `.e` 文件路径。
3. Electron 模式下通过文件系统保存到工作区；Web 原型可保留 `localStorage` 作为无工作区时的 fallback。
4. 将 `WpfDesigner` 改为消费服务状态，避免组件卸载导致项目模型重置。
5. 在 F5 / 生成并运行前确保设计器模型和中文源码都是最新内容。

## 2. 中文代码转 C++ 规则继续扩展

### 当前状态

- 中文代码转 C++ 规则集中在 `src/services/windowDesigner/eplToCppRules.ts`。
- 当前优先支持事件子程序中的 `信息框`、`调试输出`、确认退出等最小闭环。

### 后期目标

- 扩展变量、条件、循环、字符串拼接、控件属性读写、窗口打开/关闭等规则。
- 输出中间表示 IR，再由 Win32 / Qt / wxWidgets 等后端生成不同 C++ UI 代码。
- 为每条中文语法规则补充单元测试，保证中文编辑器内容和运行 exe 行为一致。

## 3. 构建日志与任务系统

### 当前状态

- F5 和“生成并运行”已经走同一构建入口。
- 设计器底部有“编译日志”页签显示生成、编译和运行结果。

### 后期目标

- 抽象为 `TaskService`，区分构建、运行、调试和环境检查。
- 输出结构化日志，包括阶段、耗时、生成目录、编译器、错误位置和中文解释。
- 已完成（B04）：MSVC/GCC/Clang 与链接器输出已结构化解析；生成 C++ 位置按 source map 映射回 `.lcpp`，问题面板可显示错误码、行列并跳转，无法映射时保留原始生成文件位置。
- 已修复：错误列表跳转同时覆盖专业 Monaco 与中文结构编辑器；点击映射到 `.lcpp` 的构建诊断会打开对应文件，并在新手模式滚动到结构化源码行，路径分隔符差异不会再导致跳转失效。
- 已修复：设计器已绑定但源码尚缺失的事件不再错误归位到 `.lcpp` 类声明行，也不再用原始文本行号冒充新手结构编辑器的可视行号；问题面板明确标注“待生成事件（类末尾）”，避免给尚不存在的事件显示虚假源码位置。
- 已修复：LingCpp 问题聚合不再重复追加已经包含在语义诊断中的块结构诊断，错误列表不会把同一事件位置重复显示两遍。
- 已修复：新手中文结构编辑器的行号槽不再显示压缩布局产生的视觉序号；类、成员、子程序和代码正文统一显示真实 `.lcpp` 源码行号，合成的分隔空白不显示伪行号，因此错误列表第 34 行跳转后界面也明确显示第 34 行。
- 已修复：中文结构编辑器末尾增加受限滚动余量，靠近文件尾部的诊断目标也能完整滚动到编辑区中央，不再只露出目标行顶部而让用户误以为没有跳转。
- 已完成：右侧结构编辑器“待生成事件”列表为每个缺失处理器提供“快速生成”按钮，复用 LingCpp AST 编辑服务写入真实事件函数；错误列表原有生成入口和结构面板入口共享同一确定性编辑链路。
- 已修复：Win32 菜单运行时模板的空白字符集合改为双重转义，生成的 `find_first_not_of(L" \\t\\r\\n,")` 不再被 TypeScript 模板提前展开成跨行 C++ 字符串；新增生成文本回归断言。
- 已修复：Win32 普通按钮 owner-draw 使用 `RoundRect` 绘制圆角填充和边框；确定进度条在原生子类 `WM_PAINT` 后按范围与当前位置叠加居中百分比文字，使 F5 窗口外观与设计器预览一致。
- 已修复：Win32 编辑框移除 `WS_EX_CLIENTEDGE` 系统立体边框，使用圆角窗口区域、暗色背景、普通/聚焦细边框和 DPI 缩放水平内边距，缩小设计器与 exe 的输入框视觉差异并保留原生 EDIT 行为。
- 已完成：编辑框属性面板新增 `verticalAlign`（顶部/居中/底部，默认居中）；设计器使用 flex 对齐预览，Win32 运行时根据真实字体度量调整内层单行 EDIT 的几何位置，多行编辑框铺满内容区。
- 已修复：放弃在原生 EDIT 本体上使用 `WM_NCCALCSIZE` / `WM_NCPAINT` 修改客户区和重绘边框；TextBox 现在由独立圆角 frame 唯一绘制暗色背景、普通边框和聚焦边框，内层无边框原生 EDIT 只负责输入、输入法、选择和剪贴板。
- 已修复：普通态与聚焦态共用完全相同的圆角和 1px 四边几何，只切换语义颜色；焦点变化只失效外层 frame，不再触发系统非客户区重算，因此不会出现顶部/底部白边、左右阴影、缺边或焦点切换残影。
## 2026-07 解决方案与构建任务更新
- 已完成：Electron 原型新增 `.lingbuilder/solution.json` 解决方案层，支持多个 Visual C++ 项目、启动项目、项目级资源根目录和兼容旧默认项目路径。
- 已完成：解决方案资源管理器支持解决方案/项目节点右键入口，可新建项目、设为启动项目、生成/清理/重新生成项目或解决方案，并支持从解决方案移除项目或删除非默认项目文件。
- 已完成：新增受控 `/api/solution/*` 接口；清理默认只删除 `.lingbuilder-build/<projectId>` 临时构建目录，保留 `generated/cpp/<projectId>` 可复制 Visual Studio 工程。
- 已完成：`/api/solution/build`、`clean`、`rebuild` 与 F5 构建接入正式 `TaskService`，统一队列、阶段/进度、取消、结构化日志和 SSE 工作台状态流；B04 已完成编译诊断映射与问题跳转。
- 已完成（B05）：解决方案批量构建按依赖阶段并行，原生项目使用持久化输入指纹进行增量编译判定，重新生成主动失效缓存；项目租约取消信号已传入 MSVC/GCC/Clang、CMake/MSBuild 子进程，停止操作可终止编译并阻止迟到运行。
- 已完成（D01）：底部面板接入 xterm 与真实 PTY/Windows ConPTY，多会话支持输入输出、cwd/env、resize、退出/关闭和缓冲恢复；服务端 API/SSE 受 renderer 会话鉴权，关服统一回收。安装版 smoke 已验证真实 CMD 回显和无残留进程。
- 已完成（D02）：接入开源 `lldb-dap` DAP 会话，支持 Debug 原生目标启动、普通/条件断点、继续、逐过程、逐语句、跳出和停止；`.lcpp` 断点按生成 source map 映射到 C++。MSVC Debug 构建补齐 `/MDd` 和 PDB 链接参数，服务退出会回收调试适配器。Locals/Watch/Call Stack/Threads 仍归 D03。
- 已完成（D03）：暂停态通过 DAP 返回真实 Threads、Call Stack、Scopes、Locals 和可展开变量，支持选择线程/栈帧与 Watch evaluate；底部面板已删除 WPF/端口模拟数据并替换为真实调试检查器。Attach、Dump、内存/寄存器/反汇编仍归 D04。
# 2026-07-11：高级原生调试闭环

- 已完成：`NativeDebugService` 复用同一 DAP 生命周期支持 PID attach、LLDB core/minidump 和 gdb-remote；内存、寄存器及反汇编只允许暂停态读取并设置数量上限。
- 已完成：高级调试 UI 和受 renderer 会话鉴权 API 已接通，失败不会回退成模拟数据或开放任意调试器命令。
- 后续优化：增加图形化进程选择器、十六进制内存编辑器、反汇编/源码混排和远程目标配置持久化；当前提示框是可用的首版入口。
# 2026-07-11：本地 Git 源代码管理闭环

- 已完成：独立 `GitService` 提供真实状态、选择暂存/取消暂存、提交、本地分支创建/切换/安全删除、提交历史和逐行 blame；所有文件参数限制在当前工作区，未开放任意 Git 参数或 shell。
- 已完成：解决方案侧栏的只读状态徽章升级为可操作源代码管理面板，具备中文忙碌、失败和空状态反馈。
- 后续优化：远程 fetch/pull/push、merge/rebase、冲突解决与 PR 归入 G02，不在 G01 本地提交闭环内混入隐藏网络操作。
# 2026-07-11：Git 远程同步、冲突与 PR 闭环

- 已完成：Git 服务支持 remotes、fetch/prune、ff-only/merge/rebase pull、push/upstream、本地 merge/rebase 继续与中止，并将冲突状态结构化返回。
- 已完成：冲突面板读取 Git index 的 base/ours/theirs 三方内容，用户可采用一侧或编辑合并文本；手工结果残留冲突标记时拒绝暂存。
- 已完成：PR 使用可替换 `PullRequestProvider`，默认以固定参数调用官方 `gh pr create`；非 GitHub remote、缺少 gh、未登录和提供器错误均显式反馈，不静默发起网络操作。
- 后续优化：增加凭据管理、远程进度流、force-with-lease 明确确认、PR 列表/评审与多托管平台提供器。
# 2026-07-11：设计器专业操作与 RC 资源往返编辑

# 2026-07-11：CPU、内存与 I/O 性能分析

# 2026-07-11：发布、签名与远程构建目标

# 2026-07-11：AI 索引、凭据安全、无障碍与设置同步

- 已完成：Electron AI API Key 改由主进程 `safeStorage` 加密保存，preload 只暴露最小 get/set/delete IPC；renderer 本地配置不再写入密钥，并会清除旧 localStorage 明文字段。Web 模式只保留当前会话输入，不降级为明文持久化。
- 已完成：新增 `WorkspaceIndexService`，有界索引工作区文本源码、保存 SHA-256/预览/术语并原子写入 `.lingbuilder/ai-index.json`；排除生成目录、依赖目录、符号链接和超大文件，支持搜索、请求取消和关服取消。
- 已完成：AI 对话请求使用 `AbortController`，聊天输入、发送、取消、索引构建/搜索结果补齐可访问名称、键盘焦点、`role=status/alert` 和 `aria-live`。
- 已完成：新增不含凭据的设置同步包，覆盖用户设置、工作区设置和扩展启用状态；导入必须先预览并以 SHA-256 令牌复检，批量替换失败会恢复所有先前文件。
- 验证：专项测试 7/7 通过，覆盖密钥不落 localStorage、safeStorage IPC、索引持久化/搜索/取消、ARIA/键盘入口、敏感字段递归剔除、同步冲突和确定性中途失败回滚。
- 后续建议：当前索引为确定性的词项索引；后续可选接入本地 embedding、增量文件监听和分块语义召回，但仍需保持离线降级、取消和敏感文件排除。

- 已完成：新增 `PublishingService`，读取 `.lingbuilder/publish.json`，校验语义版本、发布文件、输出目录、目标和签名配置；本地发布在临时目录复制文件并生成 SHA-256 清单，成功后原子替换输出目录。
- 已完成：发布失败会删除临时目录并恢复旧输出；Authenticode 仅通过固定 `signtool sign/verify` 参数执行，时间戳必须使用 HTTPS，证书文件必须位于工作区内。
- 已完成：WSL、Docker 容器和 SSH 统一调用 `lingbuilder-agent build --request <base64url>`，发行版、容器和主机参数均受白名单校验，不拼接或开放任意 shell；远程响应必须满足有界产物清单契约。
- 已完成：解决方案侧栏提供发布配置读取、生成发布产物和签名验证入口，并显示加载、运行、成功和失败状态。
- 验证：发布专项测试 4/4 通过，覆盖真实本地产物、哈希清单、原子替换、签名失败回滚、固定签名参数、WSL/容器/SSH 契约及 UI 状态。
- 后续建议：当前远程目标要求对端预装兼容版本 `lingbuilder-agent` 且工作区已由用户同步；后续可增加协议版本协商、增量文件传输、远程缓存证明和企业证书提供器。

- 已完成：新增独立 `PerformanceService`，只允许启动工作区内的可执行文件，以固定采样周期收集 CPU 时间、工作集内存、磁盘读取和写入字节，并限制参数、采样数和最长采集时间。
- 已完成：Windows 使用 `Win32_Process` 只读计数器，其他受支持平台使用 `/proc`；采集可主动取消，目标进程退出、超时、取消或 IDE 关服时均会回收。
- 已完成：支持导入 Chrome `.cpuprofile`，按采样时间聚合热点函数并限制报告规模；质量/测试页提供开始、取消、导入、错误、运行中和空报告状态。
- 验证：性能服务与 UI 专项测试 3/3 通过，覆盖报告解析、CPU/内存/I/O 汇总、越界拒绝、真实子进程采样、取消和空状态。
- 后续建议：当前是进程级采样和 CPU Profile 热点聚合；以后可接入 ETW/Windows Performance Recorder，提供调用树、火焰图、线程切换、分配栈和时间轴关联。

- 已完成：窗口设计器支持 Shift/Ctrl 多选控件、九种边缘/中心对齐与等宽等高、水平/垂直分布、方向键微调（Shift 为 10 像素）和批量删除。
- 已完成：设计器使用有界历史记录提供撤销/重做；新编辑会清空重做分支，项目更新仍经现有持久化链路提交。
- 已完成：新增 `RcResourceService` 和侧栏 RC 资源编辑器，可读取并修改菜单、对话框、控件和字符串资源文本；保存保留 UTF-8/UTF-16、BOM、LF/CRLF 及未识别语法。
- 已完成：RC 写入采用原始字节 SHA-256 冲突令牌和临时文件原子替换，外部修改、缺失条目或越界路径会明确拒绝，不会覆盖未知资源内容。
- 验证：设计器与 RC 专项测试 6/6 通过，并纳入 `npm run test:lingcpp` 完整门禁。
- 后续建议：可继续扩展可视化菜单层级编辑、对话框尺寸拖拽和完整 RC 语法 AST；当前实现只对已识别资源的引号文本做最小替换，未知语句保持原样。

# 2026-07-11：测试资源管理器闭环

- 已完成：`TestExplorerService` 发现 `*.test/spec.ts/js` 的 Node 测试，以及 CMake 生成的 CTest JSON v1 测试；测试 ID 稳定、有界扫描并跳过依赖/输出目录。
- 已完成：Node 测试按名称通过本地 tsx loader 运行，CTest 直接执行其结构化命令；结果统一为通过/失败/跳过、耗时、退出码和有界输出。
- 已完成：Node 测试使用真实 Inspector WebSocket 在入口暂停并支持继续/停止；C++ 测试调试配置复用现有 LLDB DAP。关服会回收 Node 测试调试进程树。
- 后续优化：增加测试发现文件监听、树形 suite 嵌套、参数化测试子节点、并行队列/取消进度和测试结果持久化。
# 2026-07-11：覆盖率、静态分析与 Sanitizer 闭环

- 已完成：质量服务可真实运行 Node V8 覆盖率，并解析 LCOV、Istanbul coverage-final.json、SARIF、AddressSanitizer 和 UndefinedBehaviorSanitizer 日志。
- 已完成：统一报告聚合行覆盖率、错误/警告和源码位置；质量面板可将覆盖行发布给 Monaco，已覆盖/未覆盖使用独立行背景和装订线标记，静态/Sanitizer 诊断合并进入问题面板。
- 已完成：报告和测试路径限制在工作区，V8 临时覆盖目录在返回前删除，输出和文件数量有界。
- 后续优化：增加 clang-tidy/MSVC `/analyze` 一键任务、C++ llvm-cov 自动采集、覆盖率阈值门禁、分支/函数覆盖视图和 HTML 报告导出。
# 2026-07-11：独立 Extension Host 闭环

- 已完成：`.lingbuilder/extensions/<extension>/package.json` 扩展体系与 `.lbmod` 模块体系分离；清单支持激活事件、权限及 commands/menus/views/languages/themes 贡献。
- 已完成：扩展代码在独立 Node 子进程和 VM 上下文执行，Node permission model 在 OS 层只允许读取宿主产物与扩展目录，默认禁止文件写入、网络和子进程；扩展脚本的 `require` 被拒绝，工作区访问只能走父进程受控 API。
- 已完成：onCommand、onLanguage、workspaceContains 与 `*` 激活，命令执行、工作区 UTF-8 读写、消息、启用/禁用、错误清单、主题读取、日志、超时强杀和最多三次崩溃恢复。
- 已完成：构建输出独立 `dist/extension-host.cjs`；关服回收宿主，扩展面板显示 PID、状态、恢复次数和通用贡献点。
- 后续优化：扩展签名/来源信任、安装预览、API 版本协商、真正 TreeDataProvider/Webview、主题全工作台令牌映射和扩展性能分析。
# 2026-07-11：C++ 依赖管理闭环

- 已完成：自动发现并解析标准 vcpkg.json、Conan conanfile.txt/.py、NuGet packages.config 与 PackageReference；统一显示直接依赖、版本和清单来源。
- 已完成：跨清单同 provider/包名的多个具体版本会阻止恢复并给出中文冲突；恢复命令使用固定参数，不接受任意 CLI 参数。
- 已完成：vcpkg 使用独立 install root 和 files binary cache；Conan 使用工作区缓存 HOME；NuGet 使用独立 packages 目录。离线模式分别使用 only-binarycaching/read、no-remote/build=never、本地 Source。
- 已完成：依赖面板提供在线恢复、仅离线缓存、缓存文件/字节统计和工具缺失诊断。
- 后续优化：增加包搜索/版本选择、锁文件图形化、许可证/SBOM、安全公告和依赖升级预览。
# 2026-07-11：窗口自身事件面板

- 已完成：窗口选中后事件页不再显示控件空状态；窗口模型持久化 `events.Loaded`，并由 Win32 C++ 生成器按绑定调用创建完毕处理器。

## 系统 AI 云端、账号计费与管理后台（2026-07-12）

- 已完成：建立根 npm workspaces，新增 `cloud/api` NestJS 服务、`cloud/admin` React/Vite 管理后台和 `packages/contracts` 共享协议；PostgreSQL/Redis/Mailpit 开发依赖由根 `docker-compose.yml` 描述。
- 已完成：账号服务覆盖邮箱注册验证、登录、刷新令牌轮换/重复使用撤销、找回密码、设备码授权和管理员 TOTP MFA；Refresh Token 只保存哈希，Electron 使用 safeStorage，CLI 使用 Windows DPAPI。
- 已完成：AI 点数使用 bigint 账户和不可变流水，提供赠送、管理员调账、冻结、结算和失败释放；注册送点在邮箱验证后唯一发放，免费窗口支持时区、模型范围、请求数和点数上限。
- 已完成：模型网关按逻辑别名路由 OpenAI-compatible、Anthropic 和 Gemini 流式接口；Provider 地址执行 HTTPS/私网/DNS 校验，密钥使用 AES-256-GCM SecretVault 保存。
- 已完成：管理后台提供用户、点数、活动、供应商、模型、用量和审计页面，包含响应式布局、键盘焦点、错误/加载/空状态；管理员路由要求角色与 MFA。
- 已完成：Electron AI 面板新增系统 AI/BYOK 双模式、账号登录、点数、云端模型、SSE、取消和云端编辑草稿的本地二次校验；系统账号刷新令牌不进入 renderer、localStorage 或工作区。
- 已完成：CLI 新增版本、帮助、doctor、账号设备登录、模型、余额、聊天、工作区检查和受控项目诊断/导出/构建/运行入口；AI Bridge 改为回环限定、官方 MCP SDK 严格 schema、UUID/TTL 提案、文件冲突拒绝、多文件失败回滚、搜索资源上限和编译 AbortSignal。
- 后续建议：生产发布前在真实 PostgreSQL/Redis 上执行迁移和并发账本压力测试，接入部署平台 KMS、OpenTelemetry/Prometheus、备份恢复演练和真实供应商沙箱；当前开发机未安装 Docker，无法在本轮完成容器集成 smoke。
- 后续建议：系统 AI 的供应商成本预算、熔断健康任务、管理后台图表导出、跨平台 CLI Keychain 和在线支付仍按首版范围之外单独推进。
- 已修复：OpenAI-compatible 思考模型现在独立解析 `reasoning_content`，聊天不会再出现消耗 Token 但空白完成；编辑草稿仍只消费最终 `content`。
- 已修复：AI 幂等检查提前到 SSE 响应头提交之前，重复请求返回结构化 HTTP 409，不再以连接 `terminated` 结束。
- 已修复：取消结算复用包含规则手册的实际消息集合估算输入 Token，中文/CJK 字符按约一字符一 Token、ASCII 按约四字符一 Token估算，并按最终选中的路由价格记录估算供应商成本。
- 后续建议：在生成器具备确定性分发后，再扩展关闭请求、尺寸改变、激活和失去焦点等窗口事件；未支持事件不提前暴露为无效配置。
# 2026-07-11：EdgeView 浏览器模块

- 已完成：`lingbuilder.edgeview` 支持 HWND 嵌入、区域承载、多实例、独立 User Data Folder、导航、前进后退、刷新关闭、分实例 JavaScript JSON 返回值，以及导航/标题/网页消息到 `.lcpp` 无参数处理器的直接回调。
- 已完成：构建链路从 NuGet 缓存受控发现 WebView2 SDK，复制头文件和 Win32/x64 Loader 到临时构建与可复制 VS 工程；AI Bridge CLI 多实例项目已真实编译运行，并验证两个独立 WebView2 进程组、两个缓存目录、JS 标题返回值和事件日志。
- 已完成：修复 WebView2 已加载且 JS/事件正常但画面被父窗口背景覆盖的问题；主窗口和承载 HWND 使用裁剪样式，控制器显式可见、通知父窗口位置变化并提升承载窗口 Z 序。
- 已完成：通过 WebView2 `ContextMenuRequested` 给每个 EdgeView 实例的原生右键菜单追加中文“刷新”，菜单选择回调只调用当前实例的 `Reload()`。
- 已完成：增加 EdgeView 全局默认代理与单实例覆盖代理，使用受校验的 `--proxy-server` Environment 参数，支持 HTTP、HTTPS、SOCKS5，并明确现有实例需重建后生效。
- 后续优化：增加非阻塞 Promise/取消令牌、设计器可视控件适配器、权限/下载/新窗口/进程失败等更多 WebView2 事件，以及缓存清理和运行时版本策略；当前同步 JS/等待事件封装会泵送消息并有超时。
# 2026-07-11：内置多线程模块基础闭环

- 已完成：新增 `lingbuilder.threading` 内置 v2 模块，统一贡献补全、中文诊断、代码片段和确定性 C++ binding。
- 已完成：生成器提供受控后台延时输出任务、活动数量、硬件并发数、线程休眠和全部任务回收；窗口析构前自动 join，避免后台线程悬空访问窗口对象。
- 后续优化：在 `.lcpp` AST 支持可验证的方法引用后，再增加通用任务回调、线程池、取消令牌、结果/异常传递和向 UI 线程安全派发；不得通过字符串或任意函数地址绕过生成器。
