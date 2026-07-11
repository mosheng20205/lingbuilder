# LingBuilder IDE 功能完成度

本文档跟踪“对照 Visual Studio 后确认仍缺失或未闭环的功能”。已经稳定存在的 LingCpp 编辑、Win32 设计器、C++ 生成、模块 v2 和 AI Bridge 不重复计入本轮缺口分母。

## 计分规则

- 总权重固定为 100%。
- 只有“真实服务/实现 + 用户入口 + 中文成功与失败状态 + 对应自动测试通过”的条目才能标记为“完成”并计分。
- “进行中”、只有界面、固定日志、模拟数据、仅有设计文档或只通过人工验证均计 0 分。
- 每次完成功能后必须记录自动测试命令和覆盖范围；全量 `npm run lint`、`npm run test:lingcpp`、`npm run build` 是合并前总门禁。
- 当前进度 = 所有“完成”条目的权重之和。

## 验收矩阵

| 编号 | 功能闭环 | 权重 | 状态 | 自动验收要求 |
| --- | --- | ---: | --- | --- |
| F01 | 命令注册、上下文条件与命令面板 | 4% | 完成 | 命令注册/执行/冲突/禁用测试及命令面板 UI 测试 |
| F02 | 用户/工作区配置、设置页与快捷键编辑 | 3% | 完成 | 配置优先级、持久化、迁移、快捷键冲突测试 |
| F03 | 项目文件可靠重命名与删除 | 2% | 完成 | 磁盘移动/删除、越界、冲突、符号链接、UI/API 测试 |
| F04 | 文件监听、外部冲突、自动保存与热退出 | 3% | 完成 | 外部修改、冲突策略、恢复及失败回滚测试 |
| F05 | TextModel、每文件撤销/光标/滚动/选择状态 | 3% | 完成 | 多文件隔离、撤销栈、视图状态恢复测试 |
| F06 | 最近工作区、多窗口、文件关联与拖放 | 2% | 完成 | 最近列表、窗口恢复、文件关联/拖放路由测试 |
| F07 | 结构化 TaskService 与统一任务日志 | 4% | 完成 | 队列、阶段、进度、取消、互斥、日志流测试 |
| F08 | 受控运行进程生命周期与可靠停止 | 2% | 完成 | 启动、替换、停止、超时强杀、退出清理测试 |
| F09 | 真实开发环境检测 | 1% | 完成 | 工具存在/缺失/版本/超时及 UI/API 测试 |
| E01 | 全工作区内容搜索与替换 | 3% | 完成 | 文本/正则/大小写/范围/替换预览与回滚测试 |
| E02 | clangd/LSP 进程、协议与生命周期 | 5% | 完成 | 初始化、文档同步、重启、取消、降级测试 |
| E03 | C++ 补全、悬停、签名与导航 | 4% | 完成 | 完成项、参数、定义/实现、符号索引测试 |
| E04 | 引用、重命名、重构与 Code Action | 4% | 完成 | 跨文件引用、安全重命名、预览/应用测试 |
| E05 | 多编辑器组、拆分、停靠布局与恢复 | 3% | 完成 | 分组、移动、关闭、布局持久化测试 |
| E06 | 可达 Diff、编码与 EOL 管理 | 2% | 完成 | split/unified 入口、UTF 编码、CRLF/LF 往返测试 |
| B01 | Debug/Release 与 Win32/x64 项目配置 | 4% | 完成 | 配置选择实际改变编译/输出的测试 |
| B02 | 项目引用、依赖图、构建顺序与多启动项 | 3% | 完成 | 图排序、循环诊断、引用持久化测试 |
| B03 | MSBuild/CMake/现有工程导入与属性页 | 4% | 完成 | 导入、属性往返、生成与真实构建测试 |
| B04 | 编译诊断解析、源码映射和问题跳转 | 3% | 完成 | MSVC/GCC/Clang 错误解析及 `.lcpp` 映射测试 |
| B05 | 增量、并行、批量与可取消构建 | 2% | 完成 | 缓存失效、并行依赖、取消清理测试 |
| D01 | 真实 PTY 终端及多会话 | 5% | 完成 | 输入输出、resize、cwd/env、关闭与恢复测试 |
| D02 | 原生调试适配器：断点与单步 | 7% | 完成 | 启动、断点、条件、继续、步进、停止测试 |
| D03 | Locals/Watch/Call Stack/Threads | 4% | 完成 | 真实调试会话变量、表达式、栈和线程测试 |
| D04 | Attach、远程、Dump、内存/寄存器/反汇编 | 3% | 完成 | 各能力的适配器集成和失败诊断测试 |
| G01 | Git 暂存、提交、分支、历史与 blame | 4% | 完成 | 临时仓库端到端测试 |
| G02 | Git 远程同步、合并/rebase、冲突与 PR | 3% | 完成 | 本地 bare remote、冲突编辑和连接器契约测试 |
| T01 | Test Explorer、测试发现/运行/调试适配器 | 4% | 完成 | C++/Node 测试发现、筛选、运行和结果测试 |
| T02 | 覆盖率、静态分析与 Sanitizer | 2% | 完成 | 报告解析、源码着色和诊断聚合测试 |
| X01 | 独立 Extension Host 与通用贡献点 | 2% | 完成 | 隔离、激活、权限、崩溃恢复和贡献测试 |
| X02 | vcpkg/Conan/NuGet 等依赖管理 | 1% | 完成 | 清单、恢复、版本冲突和离线缓存测试 |
| X03 | 设计器专业操作与 C++ 资源编辑器 | 1% | 完成 | 多选/对齐/撤销及 `.rc` 资源往返测试 |
| X04 | CPU/内存/I/O 等性能分析 | 1% | 完成 | 采集、取消、报告解析和空状态测试 |
| X05 | 发布、签名、远程/WSL/容器目标 | 1% | 完成 | 发布配置、产物、失败回滚和远程契约测试 |
| X06 | AI 索引/凭据安全及无障碍/同步收尾 | 1% | 完成 | 密钥存储、索引、取消、键盘/ARIA、同步测试 |

## 当前进度

- 已完成权重：**100%**
- 进行中权重：**0%**（不计入已完成进度）
- 未完成权重：**0%**
- 最后更新：2026-07-11

X03 完成证据：窗口设计器新增 Shift/Ctrl 多选、边缘与中心对齐、等宽等高、水平/垂直分布、方向键 1/10 像素微调、批量删除及有界撤销/重做历史。新增 `RcResourceService` 与侧栏 RC 编辑入口，对菜单、对话框、控件和字符串资源执行最小文本替换；UTF-8/UTF-16、BOM、LF/CRLF 和未知语句均保持不变，并以原始字节 SHA-256 令牌拒绝外部修改覆盖。专项测试 **6/6 通过**，预门禁累计 **70/70 通过（0 失败、0 跳过）**；严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 完整门禁全部通过。

X04 完成证据：新增独立 `PerformanceService`，对工作区内真实可执行文件采集 CPU 时间、峰值工作集和 I/O 读写字节，限制参数、周期、时长与样本数，并支持主动取消、超时和关服回收；Windows 使用只读 `Win32_Process` 计数器，其他受支持平台读取 `/proc`。支持导入 Chrome `.cpuprofile` 并聚合有界热点函数；测试页提供开始、取消、导入、运行、错误和空状态。专项测试 **3/3 通过**，预门禁累计 **73/73 通过（0 失败、0 跳过）**；严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 完整门禁全部通过。

X05 完成证据：新增 `PublishingService` 和 `.lingbuilder/publish.json` 配置契约，本地发布以临时目录生成文件、SHA-256 产物清单和 manifest，成功后原子替换，签名或复制失败会恢复旧输出。Authenticode 仅调用固定 `signtool sign/verify` 参数；证书受工作区边界约束，时间戳强制 HTTPS。WSL、Docker 与 SSH 统一使用受校验的 `lingbuilder-agent build --request <base64url>` 协议，不开放任意 shell，远程响应执行有界契约校验；侧栏提供配置读取、发布和签名验证入口。专项测试 **4/4 通过**，预门禁累计 **77/77 通过（0 失败、0 跳过）**；严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 完整门禁全部通过。

X06 完成证据：Electron AI API Key 使用主进程 `safeStorage` 加密文件和最小 preload IPC，renderer 不再把密钥写入 localStorage 并清理旧明文字段。新增有界、可取消、原子持久化的工作区 AI 词项索引和搜索入口；AI 对话支持 `AbortController` 取消，索引与聊天补齐键盘焦点、可访问名称、live status 和 alert。新增不含敏感字段的用户/工作区/扩展状态同步包，导入经过预览、SHA-256 复检和多文件失败回滚。专项测试 **7/7 通过**，包含确定性故障注入回滚；预门禁累计 **84/84 通过（0 失败、0 跳过）**。最终严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 完整门禁全部通过。

B04 完成证据：新增统一 `CompilerDiagnosticService`，解析 MSVC、GCC、Clang 的文件/行/列/严重级别/错误码以及 MSVC 链接器诊断；F5 和解决方案受控构建均返回结构化诊断。生成 C++ 诊断会按最窄生成区间映射回对应 `.lcpp` 源文件和源码行，同时保留生成文件位置；无法映射时安全回退到编译器原始位置。工作台将构建诊断合并进入问题面板，显示来源、错误码和行列，点击可切换已载入源文件并精确跳转。专项测试覆盖三类编译器、链接器、最窄区间映射及无关输出降级；本轮完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` **279/279 通过（0 失败）**、`npm run build` 通过、`git diff --check` 通过。

B05 完成证据：新增持久化 `IncrementalBuildService`，以稳定 SHA-256 输入指纹覆盖设计器模型、中文源码、生成文件、启用模块和 Debug/Release、Win32/x64 配置，只有指纹一致且所有输出仍存在时才跳过编译；重新生成会清除对应配置缓存。解决方案批量生成按项目依赖拆分为阶段，同一阶段的独立项目使用 `Promise.all` 并行，后续阶段只在依赖阶段全部成功后启动。项目构建租约新增 `AbortSignal`，取消、删除和关服会中止正在运行的 MSVC/GCC/Clang、CMake/MSBuild 子进程，并在返回前完成取消清理，避免迟到启动 exe。专项测试覆盖缓存持久化、输入变化、输出缺失、越界输出、定向失效、稳定指纹、并行批次、循环拒绝、租约中止及外部构建信号传播；完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` **279/279 通过（0 失败）**、`npm run build` 通过、`git diff --check` 通过。

D01 完成证据：新增基于 `node-pty` 的真实 PTY 服务，Windows 固定使用 ConPTY，支持 PowerShell/CMD（非 Windows 使用系统 shell）、工作区内 cwd、受校验 env、输入、输出、终端 resize、多会话、退出状态、关闭和关服回收；会话在切换面板或 renderer 重挂载时由服务端保留，并通过有界缓冲与 SSE 序列恢复。工作台新增 xterm 终端页签、会话标签、新建/关闭入口、状态提示、键盘输入和 `ResizeObserver + FitAddon` 尺寸同步。API 受 renderer 会话鉴权保护，cwd realpath 防止链接越界，未向 AI Bridge 暴露任意 shell。专项测试覆盖双会话、输入输出、resize、cwd/env、缓冲恢复、退出、关闭、越界和真实 PTY 隔离 smoke；真实 renderer API 测试验证鉴权和中文环境回显。安装目录打包成功，安装版连续两次 smoke 均真实执行 CMD 命令、捕获 PTY 输出、resize/关闭并确认无残留进程。完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` **279/279 通过（0 失败）**、`npm run build` 通过、`electron-builder --dir` 通过、`npm run smoke:packaged` 通过。

D02 完成证据：新增标准 `Content-Length` DAP 连接和 `NativeDebugService`，使用开源 `lldb-dap` 启动原生 C++ 调试；实现 initialize/launch/configurationDone、普通与条件 source breakpoint、continue、next、stepIn、stepOut、disconnect/terminate、事件/输出流、超时和适配器进程回收。明确拒绝复用只许可 Microsoft VS Code/Visual Studio 的 cppvsdbg，不伪装客户端；缺少 LLVM 时显示中文安装/配置诊断。Debug 构建补齐 MSVC `/MDd`、链接 `/DEBUG /INCREMENTAL:NO` 和 PDB，修复 `_DEBUG` 与发行 CRT 混链；`.lcpp` 断点通过最窄 source-map 区间确定性映射到生成 `main.cpp`，无法映射时拒绝启动。工作台 Monaco glyph margin 单击切换普通断点、Shift+单击输入条件，顶部提供开始原生调试及继续/单步/进入/跳出，Shift+F5 同时停止调试与受控运行。专项协议/服务/映射/UI 测试全通过；隔离 LLVM 环境中的真实 MSVC 程序测试 **1/1 通过**，验证普通断点、单步、条件断点、继续和退出；真实 renderer API 测试验证 Debug 门禁、启动、暂停、单步与停止。完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` **279/279 通过（0 失败、0 跳过）**、`npm run build` 通过、`git diff --check` 通过。

D03 完成证据：`NativeDebugService` 在暂停态通过 DAP `threads`、`stackTrace`、`scopes`、`variables` 和 `evaluate` 返回有界结构化数据，支持线程/栈帧选择、局部变量与嵌套子变量展开、Watch 表达式及类型/内存引用；运行态、无效引用、超长/多行表达式会返回中文错误。底部“局部变量 / 监视 / 调用栈”已替换原有 WPF 假数据和“端口 3000”模拟状态，真实显示线程列表、栈帧源码位置、作用域变量树，并支持添加/删除 Watch；暂停事件自动打开检查器，继续运行后明确提示等待下次暂停。隔离 LLVM 的真实 MSVC 会话测试 **1/1 通过**，验证至少一个线程、`main` 调用栈、作用域、局部变量 `value=0`、Watch `value+10=10`，以及单步后 `value=1`；真实 renderer API 验证 inspection/evaluate/variables 鉴权与返回。临时 LLVM、Python、卸载登记及进程均已清理。完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` **279/279 通过（0 失败、0 跳过）**、`npm run build` 通过、`git diff --check` 通过。

D04 完成证据：基于 LLDB 官方 `lldb-dap` attach 配置实现按 PID 附加、core/minidump 打开及 `gdb-remote-host/port` 远程连接；路径限制在工作区，PID、主机、端口和读取上限均受校验，适配器不支持能力时返回中文失败诊断。暂停态通过标准 DAP `readMemory`、`disassemble` 以及 registers scope 返回有界内存字节、符号化指令和寄存器；高级调试区提供“附加进程 / 远程连接 / 打开 Dump / 寄存器 / 内存 / 反汇编”入口。协议专项测试 **6/6 通过**，覆盖六类能力、参数映射、无效路径/条件和运行态拒绝；隔离官方 LLVM 的真实 MSVC 会话 **1/1 通过**，验证真实寄存器、内存、反汇编、断点、单步和条件断点。完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` 通过、`npm run build` 通过、`git diff --check` 通过；临时 LLVM、Python、卸载登记及适配器进程均已清理。

G01 完成证据：新增独立 `GitService`，通过固定参数数组执行真实 Git，支持 porcelain 状态、选择暂存/取消暂存、只提交已暂存改动、本地分支创建/切换/安全删除、分页提交历史和逐行 blame；文件操作限制在工作区，非法分支名、空提交、越界路径和无效行范围返回中文诊断。解决方案侧栏由只读改动计数升级为真实源代码管理面板，具备文件选择、提交说明、分支、历史、Blame、加载和错误状态。临时真实仓库专项测试 **4/4 通过**，覆盖初始化后的改动、未跟踪文件、暂存/取消暂存、中文提交、分支生命周期、两笔历史、三行 blame 及安全拒绝；预门禁累计 **45/45 通过**。完整门禁为 `npm run lint` 通过、`npm run test:lingcpp` 通过、`npm run build` 通过、`git diff --check` 通过。

G02 完成证据：Git 服务增加远程列表、fetch/prune、ff-only/merge/rebase pull、push/upstream、merge/rebase 继续/中止和结构化冲突状态；所有 remote、branch、strategy、resolution 参数使用白名单校验。冲突编辑读取 Git index 的 base/ours/theirs 三方版本并展示工作副本，支持采用当前、采用传入或手工合并，手工内容仍含冲突标记时拒绝暂存。PR 通过可替换提供器接入官方 `gh pr create` 固定参数，校验 GitHub remote、head/base、标题和说明，缺少 CLI/登录时返回中文错误。专项测试 **6/6 通过**；真实 bare remote 双克隆完成 fetch、behind、ff-only pull、push，真实制造 merge 冲突并手工三方解决/继续，制造 rebase 冲突并中止；PR 假提供器验证完整参数契约和非 GitHub 拒绝。预门禁累计 **47/47 通过**，完整 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 全部通过。

T01 完成证据：新增 `TestExplorerService`，有界发现 Node `*.test/spec.ts/js` 和 CMake/CTest JSON v1 测试，稳定测试 ID 支持按类型/名称筛选；Node 通过正式运行时依赖的本地 tsx loader 按名称执行，CTest 直接执行结构化命令，统一返回通过/失败/跳过、耗时、退出码和有界输出。底部“测试”页签提供刷新、筛选、单项/批量运行、结果输出和调试入口。Node 使用真实 Inspector WebSocket 在入口暂停并可继续/停止，进程树在退出/关服时回收；C++ 测试调试配置复用 LLDB DAP。专项测试 **6/6 通过**，真实覆盖 TypeScript 测试通过/断言失败/skip、临时 C++ 工程由 Visual Studio CMake 编译后 CTest JSON 发现及 exe 通过/失败、Node Inspector 暂停/继续/退出和 UI 契约；预门禁累计 **53/53 通过（0 失败、0 跳过）**。修复 CJS 安装版 loader 定位并将 tsx 移入正式依赖后，使用“每一步失败即退出”的 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 完整门禁全部通过。

T02 完成证据：新增 `QualityService`，真实使用 Node V8 原始覆盖率生成工作区逐行 hits，并支持 LCOV、Istanbul coverage-final.json、SARIF、AddressSanitizer 与 UndefinedBehaviorSanitizer 解析；统一报告聚合行覆盖率、错误/警告、规则码和源码位置。测试页质量区域提供运行 Node 覆盖率和导入报告入口；点击覆盖文件向 Monaco 发布逐行数据，已覆盖/未覆盖使用绿色/红色整行背景、装订线与 hover 次数，SARIF/ASan/UBSan 同时合并进工作台问题面板。路径限制在工作区，V8 临时目录自动清理，输出有界。专项测试 **4/4 通过**，覆盖 LCOV/Istanbul 百分比、SARIF 位置、ASan/UBSan 聚合、真实 TypeScript V8 覆盖执行、越界拒绝、UI、Monaco 着色和问题聚合契约；预门禁累计 **57/57 通过（0 失败、0 跳过）**。严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 门禁全部通过。

X01 完成证据：新增与 `.lbmod` 明确分离的 `.lingbuilder/extensions` 扩展体系和独立 `dist/extension-host.cjs` 子进程。清单支持 `*`、`onCommand`、`onLanguage`、`workspaceContains` 激活，`workspace.read/write` 权限及 commands/menus/views/languages/themes 通用贡献；扩展脚本在 VM 上下文运行并拒绝 Node `require`，Node permission model 在 OS 层仅允许读取宿主产物和扩展目录，默认禁止直接工作区文件写入、网络与子进程，工作区访问只能经父进程 realpath/权限/大小校验 API。支持命令、消息、UTF-8 读写、启用/禁用持久化、主题安全读取、无效清单、日志、超时强杀、关服回收和最多三次异常恢复；侧栏显示宿主 PID、状态、恢复次数和贡献入口。专项真实临时扩展测试 **4/4 通过**，验证独立 PID、workspaceContains/命令激活、受控读写、权限拒绝、`require('node:fs')` 拒绝、主题、禁用落盘及 SIGKILL 后换 PID 恢复；预门禁累计 **61/61 通过（0 失败、0 跳过）**。严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`（含独立宿主产物）、`git diff --check` 全部通过。

X02 完成证据：新增 `DependencyService` 自动发现 vcpkg.json、Conan conanfile.txt/.py、NuGet packages.config 和 csproj/vcxproj PackageReference，统一包名、版本、provider 与清单来源；同 provider/包的多个具体版本形成冲突并阻止恢复。恢复仅使用 IDE 固定参数：vcpkg manifest 独立 install root、triplet 和 files binary cache，Conan 独立 CONAN_HOME/output folder，NuGet 独立 PackagesDirectory；离线模式分别使用 `--only-binarycaching` 只读文件缓存、`--no-remote --build=never`、本地 `-Source`。侧栏显示清单、包、冲突、恢复/仅离线入口和缓存统计，缺工具及 CLI 失败中文反馈。专项测试 **3/3 通过**，覆盖三类真实清单、固定在线/离线参数、版本冲突、非法 triplet、缺失清单和缓存文件/字节；预门禁累计 **64/64 通过（0 失败、0 跳过）**。严格 `npm run lint`、`npm run test:lingcpp`、`npm run build`、`git diff --check` 全部通过。

B03 完成证据：新增 `ExternalProjectService`，在工作区 realpath 边界内识别目录/CMakeLists.txt、`.vcxproj` 和 `.sln`，读取 CMake `project()` 或 MSBuild `RootNamespace` 作为项目元数据，并以 `external-cmake/external-msbuild` 真实项目类型写入解决方案。文件菜单提供导入入口，外部项目右键菜单提供构建属性，Debug/Release、Win32/x64 和受校验附加参数在解决方案中往返。拓扑构建遇到外部项目时，CMake 执行受控 `cmake -S/-B/-A` 配置后 `cmake --build --config`，MSBuild 执行固定 `/m` 及 Configuration/Platform，输出到独立 `.lingbuilder-build/<project>/<arch>/<configuration>`；不开放任意 shell。专项测试覆盖两类识别/元数据、路径越界、属性往返、参数安全、CMake 两阶段和 MSBuild 命令/输出路径；真实 server API 测试验证导入与属性持久化。

B02 完成证据：解决方案模型升级为 schemaVersion 2，每项目持久化 `references[]`，解决方案持久化 `startupProjectIds[]`，并自动迁移 v1 单启动项。`projectDependencyGraph` 验证自引用/缺失引用，返回带完整路径的循环中文诊断，并为全解决方案或单项目计算包含传递依赖的拓扑构建顺序。构建链现在先构建依赖再构建引用方，启动时按多启动集合运行目标项目。删除项目会原子清理所有悬空引用和启动项；解决方案管理器右键菜单提供“配置项目引用”和“添加/移除多启动项”。专项测试覆盖持久化、传递去重、拓扑顺序、循环路径、v1 迁移、多启动和删除清理；真实 server 集成测试验证引用/启动项落盘与循环 400 拒绝。

B01 完成证据：新增工作区 `.lingbuilder/build-configuration.json` 与原子持久化服务，状态栏可直接选择 Debug/Release 和 Win32/x64。F5、项目/解决方案生成读取同一配置：Debug 使用无优化、调试符号和 `_DEBUG`，Release 使用优化、NDEBUG 和 MSVC 全程序优化；Win32/x64 切换 vcvars32/vcvars64、`-m32/-m64`、模块 `windows-msvc-win32/windows-msvc-x64` target 和独立输出目录。导出的 `.sln/.vcxproj` 同时包含四种配置，按平台选择对应 include/lib/runtime，可携带两种架构的模块依赖。专项测试覆盖四组持久化、无效值、编译参数、输出路径和 target ID；模块/导出测试验证 Win32/x64 库分流，真实 server 集成测试验证 API 与工作区文件。

E05 完成证据：新增 schemaVersion 1 的 `EditorGroupLayout` 模型，最多两个组，支持左右/上下拆分、组内活动标签、标签双向移动、关闭标签、关闭/空组折叠和活动组规范化。工作台提供中文拆分/移动/关闭入口，第二组渲染真实 Monaco 编辑器，与主组共用每文件 TextModel、独立 surface 视图状态和文件保存链路。布局写入 localStorage，项目权威文件载入后会过滤缺失路径、重复标签、超额组和损坏状态再恢复。专项测试覆盖拆分、选择、移动、关闭、折叠及持久化恢复边界。

E04 完成证据：Monaco C++ 注册 references、prepareRename/rename 和 Code Action provider，但不盲目应用 clangd 编辑。新增 `LspWorkspaceEditService` 解析 changes/documentChanges，限制所有 file URI 在工作区 realpath 内并拒绝链接、资源创建/删除、越界位置和重叠范围。重命名和代码操作要求活动文档已保存，显示中文跨文件/修改数预览，确认后使用磁盘 SHA-256 基准、原子批量替换和失败回滚落盘，再重载工作台；外部修改会返回冲突而不覆盖。专项测试覆盖跨文件 UTF-16 范围、预览/原子应用、重叠拒绝、URI 越界和过期预览冲突；真实 server 测试覆盖方法白名单和空重构拒绝。

E03 完成证据：在 E02 同一 clangd 会话上开放受控白名单请求，支持 completion、hover、signatureHelp、definition、implementation、documentSymbol 和 workspace/symbol；HTTP 请求断开会转换为 `$/cancelRequest`。Monaco C++ provider 实际注册补全触发字符、悬停内容、签名帮助、定义/实现跳转、文档大纲和工作区符号，适配 LSP 0 基位置、Range、Location/LocationLink、CompletionList 和 MarkupContent。专项测试验证位置/范围、补全列表、悬停文本与跳转链接；真实 server 测试验证会话鉴权和拒绝任意 `workspace/executeCommand`。

E02 完成证据：新增标准 `Content-Length` 分帧的 JSON-RPC 2.0 连接和 `ClangdService`，支持 initialize/initialized/shutdown/exit、请求关联、`$/cancelRequest`、didOpen/didChange/didClose 版本同步、publishDiagnostics、意外退出有界重启并重开文档。clangd 缺失或连续失败时显式降级到本地高亮，不影响 LingCpp 离线能力。受会话鉴权的 `/api/lsp/*` 限制在工作区真实路径内，服务退出会回收 clangd。工作台仅向 clangd 同步 C/C++ 文件，合并快速输入，通过 SSE 显示诊断和就绪/重启/降级状态。专项测试覆盖碎片分帧、响应关联、取消、初始化、文档版本、诊断、关闭、崩溃重启/重开和 ENOENT 降级；真实 server 集成测试验证鉴权、状态与文档类型边界。

F07 完成证据：新增服务端 `TaskService`，提供排队/运行/成功/失败/取消状态、单调进度、分级时间日志、同组串行与跨组并行、AbortSignal 取消和日志上限。解决方案生成/清理/重建和 F5 进入统一任务记录；受会话鉴权的 `/api/tasks` 与 SSE 将日志送入输出面板，状态栏显示排队/进度并可取消。专项测试覆盖队列、并行、进度、日志、取消和失败；真实 server 集成测试验证清理任务落入成功状态。

F06 完成证据：桌面工作区状态升级为可迁移 v2，持久化最近 10 个工作区和窗口位置/尺寸/最大化状态。文件菜单提供新窗口与最近工作区；新窗口以独立 Electron 进程及 `--workspace` 参数启动。目录和受支持工程/源文件可通过启动参数或拖放路由，Shift+拖放进入新窗口；安装包注册 `.lingbuilder/.lbworkspace/.lcpp` 关联。测试覆盖 v1 迁移、去重/上限/删除、窗口恢复、拖放路由和多窗口启动契约。

## 已完成证据

- **F04（3%）**：项目文本使用 SHA-256 磁盘版本令牌和 `fs.watch` SSE 主动监听；保存通过临时文件校验、原子替换和全批次回滚落盘，过期版本返回 409 和最新快照。工作台支持重载磁盘或保留本地、配置化延迟自动保存、`.lingbuilder/recovery` 热退出恢复/丢弃；Electron 系统关闭与标题栏关闭统一走 renderer 确认握手。专项测试覆盖冲突不落盘、批量原子写入、中途失败回滚及恢复文件安全。

- **F01（4%）**：新增 `CommandService`、`KeybindingService` 与命令面板，覆盖中文标题/英文 alias、注册/注销、`when` 上下文、独立禁用态、冲突诊断、IME/连发保护和显式失败/取消结果。F5、Shift+F5、保存、工作区、解决方案、环境检查、视图与设置等真实工作台操作进入同一命令链路；命令面板具备搜索、键盘导航、焦点陷阱/恢复、禁用/空/失败状态，打开时按“面板关闭后的目标上下文”查询和执行。真实浏览器验证 F1、英文 alias、从面板打开设置和长列表 `End` 滚入可视区；375px 下入口保持可见。
- **F02（3%）**：新增 schema 驱动的用户/工作区 `ConfigurationService`、原子 JSON 存储和设置页，优先级为“工作区 > 用户 > 默认值”，支持变更事件、失败回滚、旧 JSON 与 renderer localStorage 迁移、损坏诊断和真实 `/api/configuration` 读写/重置。字号、编辑体验、主题、三类面板和快捷键均连接工作台；编辑体验修改/重置先提交草稿，快捷键拒绝裸输入键、格式错误及默认/自定义冲突，未保存草稿不会被普通 snapshot 刷新覆盖，关闭/切作用域/重置前确认。设置对话框通过暗/亮色、键盘、ARIA、焦点和 375px 无横向溢出检查。
- **F03（2%）**：`ProjectFileMutationService` 执行真实磁盘重命名/删除，限制在项目源码/配置根和工作区 realpath 内，拒绝越界、符号链接、目录及冲突；App 在操作前提交编辑器草稿并可靠迁移/关闭标签状态。服务单测、状态单测和真实 renderer API 鉴权集成测试均通过。
- **F05（3%）**：新增 renderer 会话级 `TextModelService`，以工作区/项目/文件生成不泄露本机路径的稳定 URI，持有 Monaco 模型、每文件 `TextEditHistory`、按编辑表面隔离的光标/滚动/正反向选区，并在重命名时迁移、删除/项目清理时释放源码及原生预览子模型。`.lcpp` 专业 Monaco 与新手结构正文接入同一条每文件规范撤销时间线；Monaco 普通输入、外部权威改写及分组撤销/重做同步到相同快照，跨语言重命名会重建基线并清除旧原生栈，规范替换后恢复光标、滚动和反向选择。首次专业挂载和专业 A→B、新手 B→C 后的连续撤销/重做都不会跨越两套竞争历史，非 `.lcpp` 文件继续使用 Monaco 原生历史。项目权威文件载入期间统一禁止保存、F5、文件变更、AI 应用和工作区替换，15 秒超时进入可重试错误态，空文件响应不再挂载旧项目内容；保存、重建、翻译、提取、AI 应用、设计器待确认编辑及工作区搜索/替换以“项目 ID + 载入代次”忽略项目切换或同项目重载后的旧响应。本地 Monaco、worker、C++/INI 语言包随安装产物输出并进入构建硬校验，`.h/.rc` 别名不会退化为纯文本。真实浏览器验证新手/专业双向模式切换、混合时间线双向遍历、A/B 文件撤销隔离、视图恢复、普通输入框快捷键隔离、原生预览选择隔离及源码全局行列；模型、历史、加载门禁、异步所有权与位置映射均有自动测试。
- **F08（2%）**：`ManagedProcessService`、`ProjectBuildCoordinator` 与 `ProjectBuildSessionService` 覆盖编译前回收旧 exe、同项目/跨入口互斥、admission 停止代次、启动失败、正常/强制停止、进程 close、日志 flush、关服二次回收。F5、解决方案构建、IDE 内嵌 AI Bridge 与外部 CLI/MCP 均接入受控链路；Shift+F5 不会在停止后迟到启动。专项测试 27/27 通过。
- **F09（1%）**：环境检查真实探测 Node.js、MSVC、Windows SDK、CMake、g++、clang++、WebView2 和平台；具备 30 秒整体超时、固定命令参数、API 鉴权、编译器组合语义、UI 单请求门禁/卸载取消和可测试中文输出。环境服务、UI 展示/门禁和真实 API 集成测试均通过。
- **E01（3%）**：新增 `WorkspaceSearchService`、四个受会话鉴权保护的 `/api/workspace-search/*` 路由和工作区搜索/替换对话框；`Ctrl+Shift+F` / `Ctrl+Shift+H`、编辑菜单、命令面板与常驻图标进入同一命令链路。覆盖纯文本/正则、大小写、当前文件/项目/工作区范围、全部命中、Unicode 行列、结果分组勾选、跨项目归属和精确范围跳转。替换严格执行“保存脏编辑 -> 重新查询 -> 预览 -> 明确确认 -> 哈希复检 -> 原子应用 -> LIFO 撤销”，应用/回滚中途失败及落盘后校验失败均恢复一致字节，UTF BOM/UTF-16/LF/CRLF 保持不变。服务拒绝灾难性回溯、反向引用和指数可选量词链，并限制查询快照、预览、总缓存和撤销事务；长单行 1,000 个零宽命中的行列/预览保持线性有界。真实浏览器验证快捷键、大小写、正则捕获替换、磁盘应用/撤销、脏态门槛、危险正则中文诊断、结果跳转及 375px 无对话框横向溢出；无 HMR 模式控制台 0 错误/警告。
- **E06（2%）**：新增统一文本格式服务，按字节支持 UTF-8、UTF-8 BOM、UTF-16 LE/BE 和 LF/CRLF 检测、显式转换、中文/emoji/BOM/末尾换行往返；`.e` 与大小写扩展共享同一读写白名单，非法格式、越界、非项目类型及符号链接路径返回中文 400，格式校验完成前不落盘。状态栏可切换活动文件编码/EOL并显示“格式待保存”，保存竞态不会清除后续编辑；AI Bridge 读取与应用编辑保留原编码/EOL。Diff 的编辑、并排、内联入口与命令面板均可达，修复 CRLF 伪差异、中间插入/删除、清空文件和末尾换行；12,000 行局部修改通过公共前后缀 fast path 降至毫秒级。真实浏览器验证三模式、命令执行和格式脏状态恢复。
- **总门禁（2026-07-10）**：`cd electron && npm run lint` 通过；`npm run test:lingcpp` 为 **272/272 通过，0 失败、0 跳过**；`npm run build` 通过且 Monaco 本地资源校验通过（仅保留既有 Vite chunk-size 警告）；`git diff --check` 通过（仅 Git 的既有 LF/CRLF 提示）；构建后的 `node dist/cli.cjs ai-server ...` Bearer-token preview health smoke 返回 `ok=true`。
