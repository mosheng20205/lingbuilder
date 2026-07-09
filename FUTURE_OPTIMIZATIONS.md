# LingBuilder 后期优化事项

## 2026-07 状态记录

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
- 后续建议：继续增强模块 v2 跨平台 target 的真实构建能力，包括 CMake、Linux/macOS、x64 F5 选择、签名校验和远程市场上传审核服务。
- 后续建议：继续把 AI 编辑扩展到语义级 range 规划、跨模块依赖分析和更细粒度的审查提示。
- 后续建议：AI Bridge 的 `build.run` 已复用受控生成、编译和运行链路，但仍未开放任意 shell；后续应接入正式 `TaskService`，提供结构化构建、问题面板跳转和运行日志流。
- 后续建议：继续扩展 LingCpp Parser/IR 覆盖面，把变量赋值、控件属性读写、字符串拼接、窗口打开/关闭等中文语法纳入生成器。
- 后续建议：为 `new_emoji` 增加 x64 构建目标选择、设计器控件深度映射、全量 EU_ API 参数类型增强和可视化示例模板。
- 后续建议：把“纯 new_emoji 独立演示入口”沉淀成正式模板或生成器选项。该模板必须避免在创建完毕事件中调用 `结束`，并在创建 new_emoji 窗口后进入 `NE_运行消息循环` / `EU_RunMessageLoop()`；构建验收需启动 exe 并确认 3 秒后仍在运行，防止再次生成闪退示例。

本文档记录当前原型阶段为了快速闭环而采用的临时方案，以及后续必须工程化完善的方向。后续 Agent 开始大改动前应先阅读本文件，避免把原型实现误判为最终架构。

## 1. 窗口设计器持久化

### 当前状态

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
- 编译错误应进入问题面板，并能跳转到中文源码或生成文件。
## 2026-07 解决方案与构建任务更新
- 已完成：Electron 原型新增 `.lingbuilder/solution.json` 解决方案层，支持多个 Visual C++ 项目、启动项目、项目级资源根目录和兼容旧默认项目路径。
- 已完成：解决方案资源管理器支持解决方案/项目节点右键入口，可新建项目、设为启动项目、生成/清理/重新生成项目或解决方案，并支持从解决方案移除项目或删除非默认项目文件。
- 已完成：新增受控 `/api/solution/*` 接口；清理默认只删除 `.lingbuilder-build/<projectId>` 临时构建目录，保留 `generated/cpp/<projectId>` 可复制 Visual Studio 工程。
- 后续建议：把 `/api/solution/build`、`/api/solution/rebuild` 与现有 F5 构建进一步沉淀为正式 `TaskService`，统一结构化任务、问题面板跳转和日志流。
