# LingBuilder Electron

## LingBuilder 解决方案文件

- 工作区根目录的 `<解决方案名称>.lbsln` 是用户可见的解决方案入口，可双击、拖入或通过“打开项目”选择。
- `.lbsln` 保存解决方案 ID、名称、启动项目、项目摘要及内部状态路径；完整状态继续保存在 `.lingbuilder/solution.json`。
- 新工作区和旧工作区首次读取解决方案时都会自动生成 `.lbsln`，新增/删除项目、项目引用和启动项变化会同步更新。
- `generated/cpp/<项目>/<项目>.sln` 是导给 Visual Studio 的标准解决方案，不是 LingBuilder 入口。

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

## 目录结构

```text
electron/
  electron/
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

## Windows 打包与安装版冒烟

```bash
npm run package:dir
npm run smoke:packaged
npm run package:win
```

- `package:dir` 生成 `release/win-unpacked/LingBuilder.exe`；`smoke:packaged` 启动该程序并验证 renderer、普通 API、模块 API、退出码和服务进程回收；`package:win` 生成 Windows x64 NSIS 安装包。
- `package:win` 会先从微软官方地址下载并校验 WebView2 Evergreen Bootstrapper，再冻结到 NSIS 资源；安装阶段仅在注册表未检测到 WebView2 Runtime 时补装，失败不会阻止 LingBuilder 本体安装，可稍后从“工具 → 环境修复中心”重试。
- 安装版主进程先启动不可见的独立本地服务，显式传入工作区、renderer 静态目录、规则手册、`127.0.0.1` 随机端口和随机会话 token，收到 ready 信息后才加载窗口。
- renderer 仍使用相对 `/api/*`，Electron 会自动注入本地会话 token；普通 IDE 服务拒绝 `0.0.0.0`，默认不挂载 `/api/ai-bridge/*`。
- 首次运行会把版本化示例的缺失文件复制到“文档/LingBuilder/示例工作区”，不会覆盖已有文件；以后从 `userData/workspace-state.json` 恢复最近工作区。工具栏“打开”使用原生目录选择器并重启本地服务。
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
- 高级模块未启用时，工具箱显示依赖状态但不能新增高级控件；项目已有高级控件不得被删除或静默替换。
- 内置 `lingbuilder.edgeview` 模块支持多个 WebView2 实例、独立缓存目录、HWND/区域嵌入、JavaScript JSON 返回值和 `.lcpp` 事件回调。原生构建从 NuGet 缓存复制 WebView2 SDK 头文件与目标架构 Loader，不依赖 React 组件硬编码路径。

## IDE 基础服务闭环

- 工作台命令统一注册在 `src/services/commands/`：支持中文标题、英文 alias、上下文 `when`、独立禁用状态、冲突诊断和可覆盖快捷键。工具菜单、常驻图标、`Ctrl+Shift+P` / `F1` 命令面板及 `Ctrl+,` 设置入口共用同一执行链路；命令面板具备键盘导航、焦点恢复、禁用态和中文空/失败状态。
- 用户/工作区配置统一由 `src/services/configuration/` 管理，优先级为“工作区 > 用户 > 默认值”。工作区文件固定为 `.lingbuilder/settings.json`；开发期用户文件默认位于 `%USERPROFILE%/.lingbuilder/settings.json`（可通过 `LINGBUILDER_USER_SETTINGS_PATH` 注入），安装版位于 Electron `userData/settings.json`。`/api/configuration` 的读取、更新与重置接口复用 schema 校验、原子持久化、旧 JSON/localStorage 迁移和损坏文件诊断；设置页可真实修改字号、编辑体验、主题、三个面板可见性和快捷键。编辑体验切换/重置会先提交未失焦草稿；快捷键拒绝裸输入键、格式错误和默认/自定义冲突，未保存草稿在关闭或切换作用域前会确认。
- 文件树重命名与删除使用 `/api/window-designer/files/rename`、`/api/window-designer/files/delete`，由 `ProjectFileMutationService` 校验工作区、项目根目录、符号链接和目标冲突；操作前会提交编辑器草稿并与保存/F5 互斥。
- 文本模型统一由 `src/services/textModel/` 管理：工作区/项目/文件映射为稳定且不泄露绝对路径的 Monaco URI，每个文件持有独立历史和按专业/新手/原生表面隔离的光标、滚动、正反向选区；重命名迁移模型，删除同步释放原生预览子模型。`.lcpp` 新手正文和专业 Monaco 共用一条规范撤销时间线，Monaco 输入、分组撤销与重做事件同步到相同快照序列；非 `.lcpp` 文件使用 Monaco 原生历史。项目权威文件加载完成前所有源码变更与落盘入口保持关闭，超时或错误可中文重试，空响应不会复用旧项目文件；保存、重建、翻译、提取、AI 应用及工作区替换以项目 ID 和载入代次拒绝旧异步响应。
- Monaco 运行时、核心 worker 与 C++/INI 基础语言包直接从本地 `monaco-editor` 打包，不再依赖 CDN；`npm run build` 会执行 `scripts/verify-local-monaco-build.cjs`，缺少 worker/语言分块或入口引用外链时直接失败。当前 `.h` 使用 C++、`.rc` 使用 INI 近似高亮；完整 C/C++ 语义补全和诊断仍等待 clangd/LSP 阶段。
- 项目文本文件通过 `src/services/files/textFileService.ts` 按字节读取和保存。`/api/window-designer/files` 同时返回 `files` 与 `fileFormats`，支持 UTF-8、UTF-8 BOM、UTF-16 LE/BE 及 LF/CRLF；`.e` 和大小写扩展使用同一读写白名单，拒绝类型、越界或符号链接路径会返回中文 400，格式/路径校验完成前不会写入任何请求文件。编辑器内部统一使用 LF，状态栏切换编码或换行后会标记文件待保存。Diff 的“编辑 / 并排对比 / 内联对比”入口与命令面板共用工作台命令，CRLF/LF 不会产生伪差异，清空文件会显示为删除。
- `Ctrl+Shift+F` / `Ctrl+Shift+H` 打开工作区搜索与替换。`WorkspaceSearchService` 支持纯文本/正则、大小写和文件/项目/工作区范围；搜索只读取磁盘快照并跳过构建目录、依赖目录、链接、过大或非文本文件。替换必须勾选结果、生成预览并明确确认，应用和撤销都重新校验文件哈希；中途写入或落盘后校验失败会恢复到完整的替换前/替换后状态，并保留 UTF BOM、UTF-16 与 LF/CRLF。服务保守拒绝灾难性回溯、反向引用和指数可选量词链，并以 32 MiB/256 匹配文件查询快照、16 MiB 预览、128 MiB 总缓存和 5 个可撤销事务为默认硬边界。四个 `/api/workspace-search/*` 路由复用本地会话鉴权；成功应用/撤销后，编辑器直接采用已确认事务的 before/after 快照，异常情况下才从磁盘重新读取，避免旧模型再次覆盖结果。
- F5 原生程序由 `ManagedProcessService` 按项目管理。`/api/window-designer/run-status` 返回受控进程与在途生成状态，`/api/window-designer/stop` 可取消生成代次并停止受控进程；重新生成会先停止旧 exe 再写入/链接固定输出，避免 Windows 文件锁。同项目任务串行，IDE 内嵌 AI Bridge 与 F5 共享租约，停止后不会迟到启动 exe。Shift+F5 停止全部受控任务，服务关闭时执行最终回收。
- `/api/environment/check` 执行真实只读环境探测，覆盖 Node.js、MSVC、Windows SDK、CMake、g++、clang++、WebView2 和平台信息；工具栏环境检查显示检测结果和中文修复提示，不再使用固定成功文本。工具菜单与命令面板可打开“环境修复中心”，通过固定微软下载地址和固定参数安装 C++ Build Tools 工作负载或 WebView2；API 不接受任意 URL、命令或参数。离线部署见根目录 `LINGBUILDER_OFFLINE_ENVIRONMENT_PACKAGE.md`。
- 自动回归包含命令注册/面板模型/快捷键路由/可访问对话框、配置优先级/持久化/迁移/API、项目文件、工作区搜索事务、受控进程、构建协调和环境检查测试，并在 renderer server / AI Bridge 集成测试中验证鉴权、跨入口互斥、停止代次、关服回收和 API 契约。
- Windows 原生按钮与复选框视觉/交互 smoke 可在完成 F5 编译后运行：`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-owner-draw-button-states.ps1 -ExecutablePath ../.lingbuilder-build/lingbuilder-ui-project/Win32/Debug/bin/LingBuilderPreview.exe -OutputDirectory ../.lingbuilder-build/button-visual-smoke`。脚本会确认 `BS_OWNERDRAW`，使用真实鼠标、Tab 和空格验证按钮五态、复选框勾选/取消、禁用不响应 hover、控件几何不变及焦点绘制不越过左侧勾选框，并输出逐态 PNG 与 `metrics.json`；发送真实输入前会校验前台窗口和命中 HWND。

## AI Bridge CLI

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
```

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

Win32 高级模块还提供结构化集合编辑、ImageList 项目资源管理和完整系统对话框状态读取。文件筛选器采用 `名称|模式` 成对格式；`系统对话框_状态()` 返回 1/0/-1，查找替换和工具栏通过专用读取命令返回最近动作，`打印文本` 会向所选打印机提交真实文档。

非可视 ToolTip 和 PropertySheet 位于设计器“项目 / 行为与属性页”资源区：ToolTip 绑定目标控件并拥有独立延迟；PropertySheet 编辑顶层页面、应用事件处理器，并由中文命令 `属性页_显示("资源ID")` 打开。

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

项目启用 `lingbuilder.new_emoji.ui` 后，窗口设计器自动使用 new_emoji 原生后端。当前闭环控件为按钮、编辑框、文本、复选框、单选框、列表框、图片框、进度条和容器；列表框会传递项目集合和默认选中项，图片框会传递图片源与填充方式。画布保留现有布局/属性编辑体验，F5 与原生导出生成真实 `NE_创建*` 调用。不支持的 Win32 高级控件会禁用并给出中文诊断，不会静默混入 Win32 控件。
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
# C++ 依赖管理

解决方案侧栏“依赖管理”识别 vcpkg、Conan 2 和 NuGet 标准清单，显示包和版本冲突，并提供恢复或仅离线缓存。缓存与安装树位于 `.lingbuilder/package-cache` 和 `.lingbuilder/packages`；恢复参数由 IDE 固定生成，不执行用户提供的任意命令。
