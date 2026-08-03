# LingBuilder AI Bridge CLI 使用手册

本文档说明如何启动 LingBuilder 内置的 AI Bridge CLI，并让其它 AI 客户端通过 HTTP 或 MCP 连接 LingBuilder 工作区。

AI Bridge 的目标是让外部 AI 客户端安全地使用 LingBuilder 的本地能力：读取项目、搜索文件、获取 `.lcpp` 诊断、预览或创建项目、生成可预览的代码修改、应用修改、查看模块上下文、生成/导出 C++ 与 Visual Studio 工程，以及执行受控构建运行。

## 1. 推荐：从 IDE 一键连接

在 LingBuilder 中打开“帮助 → AI Bridge 连接中心”，或在命令面板搜索“AI Bridge”。连接中心会直接完成以下工作，无需用户手工拼接命令或复制 Token：

- 以当前工作区、回环地址和默认 `preview` 权限启动/停止独立 Bridge 进程。
- 展示 REST API 与共享 Streamable HTTP MCP 地址、连接状态、客户端数量、最近工具调用和脱敏日志。
- 独立检测 Windows 的 ChatGPT/Codex 桌面客户端；“配置并打开桌面版”会向当前工作区的 `.codex/config.toml` 写入 LingBuilder 托管段，并启动桌面应用。
- 桌面版由 Codex 为当前项目直接拉起纯 STDIO MCP，不依赖 Codex CLI、不监听端口、不需要或持久化 Bridge Token；首次写入后若桌面应用已经运行，必须完全退出并重新打开，再在当前工作区新建任务。
- 检测 Codex CLI、Claude Code、Gemini CLI；点击“连接并打开”会在 IDE 集成终端启动对应客户端。
- Token 只注入该终端进程的环境变量，不写入客户端全局配置、项目配置或命令文本。
- Claude Code 与 Gemini CLI 所需的托管配置只保存环境变量占位符；Codex 使用本次会话覆盖参数，不修改全局配置。
- 可按需切换 `readonly`、`preview`、`yolo`，设置端口与生命周期；`yolo` 必须再次显式确认。

### 1.1 ChatGPT/Codex 桌面版

桌面版和 Codex CLI 是两个独立客户端。连接中心会检测 MSIX 包 `OpenAI.Codex` 和 `ChatGPT` 桌面进程，不再以 PATH 中是否存在 `codex` 命令判断桌面版是否安装。

一键配置使用项目级 Codex 配置，服务名为 `mcp_servers.lingbuilder_desktop`。LingBuilder 只更新带有托管标记的配置段，并保留文件中其他 Codex 设置；若用户已经手写同名服务，界面会显示冲突并要求确认后才接管。配置中的命令指向当前 LingBuilder 安装包自带运行时和 CLI，使用：

```text
ai-server --workspace . --permission preview --mcp --stdio-only
```

`--stdio-only` 不创建 HTTP 服务器，不开放端口，也不读取或生成 HTTP Bearer Token。它与 HTTP Bridge 复用同一个 `AiBridgeService`、工具清单、工作区路径校验、权限和审计实现。移动或升级 LingBuilder 后，如果安装路径变化，连接中心会提示“需要更新”，再次点击即可修复。

关闭连接中心不会自动停止 Bridge；可在连接中心手动停止。切换工作区或退出 IDE 时，Bridge 会被回收，避免旧工作区继续暴露。

### 1.2 不启动 IDE 的 C++ 一键配置器

`tools/codex-configurator/` 提供独立的 Windows Win32 配置器，面向不熟悉命令行的用户。它不启动 LingBuilder IDE，只为选定工作区写入项目级 `.codex/config.toml`，自动探测开发版 Electron 运行时或安装版 `LingBuilder.exe`，并保留其它 TOML 配置。

在 Visual Studio 开发者 PowerShell 中运行：

```powershell
cd tools/codex-configurator
.\build.ps1
```

双击 `tools/codex-configurator/build/LingBuilderCodexConfigurator.exe` 后，选择工作区和 `readonly`、`preview`（默认）或 `yolo` 权限，点击“一键配置”。遇到已有非 LingBuilder 同名 MCP 配置时，工具会先要求确认；配置完成后可选自动打开 Codex 桌面端。工具不会写入 Token，也不会修改用户全局 Codex 配置。

无界面脚本可使用：

```powershell
.\LingBuilderCodexConfigurator.exe --headless --workspace "D:\项目\我的工作区" --permission preview
```

`--force` 才会接管同名非托管服务，`--remove` 只移除 LingBuilder 托管段。该工具与 IDE 连接中心、AI Bridge CLI 和 MCP 使用同一 `--mcp --stdio-only` 配置契约。

## 2. 手动启动方式

开发期从 `electron/` 目录启动：

```bash
cd electron
npm run ai-server -- --workspace .. --port 17860
```

安装 Windows 正式版时，安装向导默认勾选“将 LingBuilder CLI 添加到当前用户 PATH”。安装完成后需重新打开终端，然后可直接运行：

```bash
lingbuilder --version
lingbuilder ai-server --workspace "D:\项目\我的LingBuilder工程" --port 17860
```

用户在安装时可以取消 PATH 选项。此时仍可从安装目录显式调用启动器：

```powershell
& "C:\Program Files\LingBuilder\lingbuilder.cmd" --help
```

CLI 启动器复用安装包自带的 Electron/Node 运行时，最终用户无需另外安装 Node.js。重复安装会去重 PATH 项，卸载会移除 LingBuilder 安装目录。

IDE 的连接中心也保留“CLI 工具”页，可检查启动器、当前用户 PATH 和 CLI 版本，并提供复制命令、打开终端及完整手册入口。

启动成功后终端会显示：

```text
LingBuilder AI Bridge listening on http://127.0.0.1:17860/api/ai-bridge
LingBuilder MCP listening on http://127.0.0.1:17860/api/ai-bridge/mcp
Workspace: ...
Permission: preview
Token: ...
```

如果没有传入 `--token`，CLI 会自动生成一次性 token。外部客户端调用 HTTP API 时必须带上 token。

## 3. 常用参数

```bash
npm run ai-server -- --workspace .. --port 17860 --permission preview
npm run ai-server -- --workspace .. --permission readonly
npm run ai-server -- --workspace .. --permission yolo --token local-token-with-at-least-24-chars
npm run ai-server -- --workspace .. --permission yolo --mcp
```

参数说明：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--workspace` | 当前目录 | 要暴露给 AI 客户端的 LingBuilder 工作区根目录。 |
| `--host` | `127.0.0.1` | 监听地址。默认只允许本机访问。 |
| `--port` | `17860` | HTTP 服务端口。 |
| `--permission` | `preview` | 权限模式：`readonly`、`preview`、`yolo`。 |
| `--token` | 自动生成 | 访问 REST API 与共享 MCP 的 Bearer token。 |
| `--no-mcp-http` | 关闭 | 关闭默认启用的 Streamable HTTP MCP。 |
| `--mcp` | 关闭 | 在共享 MCP 之外额外启用传统 MCP stdio 服务。 |
| `--stdio-only` | 关闭 | 必须与 `--mcp` 同用；只运行 STDIO MCP，不监听 HTTP 端口且不需要 Token，供 ChatGPT/Codex 桌面版直接拉起。 |

AI Bridge 强制只监听回环地址。`--host` 只接受 `127.0.0.1`、`localhost` 或 `::1`。

手动自动化也可通过 `LINGBUILDER_AI_BRIDGE_TOKEN` 环境变量提供 Token；显式 `--token` 优先。IDE 托管模式只使用环境变量传给子进程，避免 Token 出现在进程命令行。

## 4. 权限模式

AI Bridge 支持三种权限模式。

| 模式 | 读取/搜索/诊断 | 生成修改提案 | 写文件/导出/构建运行 |
| --- | --- | --- | --- |
| `readonly` | 允许 | 允许 | 禁止 |
| `preview` | 允许 | 允许 | 必须传入 `approved=true` |
| `yolo` | 允许 | 允许 | 允许执行受控 LingBuilder 命令 |

推荐默认使用 `preview`：

```bash
npm run ai-server -- --workspace .. --permission preview
```

`yolo` 适合高度信任的本机自动化场景。即使在 `yolo` 模式下，AI Bridge 也不开放任意 shell，只开放 LingBuilder 已封装的受控能力。

## 5. HTTP API

### 5.0 AI 创建项目

外部 AI 可以先预览，再批准创建一个真实 LingBuilder 项目。创建服务统一落盘解决方案项目、中文 `.lcpp` 源码、项目全局变量、项目数据类型、配置文件、设计器模型和项目模块引用；不会把设计器 JSON 或模块引用藏在 AI 客户端的临时状态中。

列出模板：

```http
GET /api/ai-bridge/project/templates
```

预览项目（默认不写入）：

```http
POST /api/ai-bridge/project/create
```

```json
{
  "name": "库存管理工具",
  "projectId": "inventory-tool",
  "templateId": "hello-window",
  "windowTitle": "库存管理",
  "enabledModuleIds": ["lingbuilder.win32.common-controls"],
  "openInWorkbench": true
}
```

预览返回完整设计器模型、初始文件内容、模块依赖和工作台导航目标；只有再次传入 `approved: true` 才会写入。`preview` 权限仍要求该字段，`readonly` 始终拒绝写入。

```json
{
  "name": "库存管理工具",
  "templateId": "blank-window",
  "approved": true
}
```

创建成功后，IDE 会通过工作区事件刷新解决方案；若 `openInWorkbench` 为 true，IDE 会先保存当前编辑，再切换到新项目并打开主 `.lcpp` 文件。创建结果包含 `receipt.receiptId`，可在生成文件未被修改时撤销：

```http
POST /api/ai-bridge/project/create/undo
```

```json
{
  "receiptId": "<创建结果中的 receiptId>",
  "approved": true
}
```

撤销会检查创建时的文件 SHA-256；用户或 AI 已修改、新增文件时会阻断撤销，不覆盖代码。

HTTP 基础地址：

```text
http://127.0.0.1:17860/api/ai-bridge
```

请求必须携带 token：

```bash
curl -H "Authorization: Bearer local-token-with-at-least-24-chars" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

只接受 `Authorization: Bearer <token>`。查询参数和请求体中的 `token` 不再用于鉴权，避免 token 出现在 URL、访问日志或普通业务载荷中。

Electron IDE 的普通本地服务使用独立桌面会话，不挂载 `/api/ai-bridge/*`。连接中心启动的是另一个受管 `lingbuilder ai-server` 进程，使用独立 Bridge Bearer token；普通 IDE 会话 token 不能代替它。

### 5.1 健康检查

```http
GET /api/ai-bridge/health
```

示例：

```bash
curl -H "Authorization: Bearer local-token" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

返回示例：

```json
{
  "ok": true,
  "service": "LingBuilder AI Bridge",
  "version": 1,
  "workspaceRoot": "C:\\path\\to\\workspace",
  "permission": "preview",
  "mcp": true
}
```

### 5.2 列出工作区文件树

```http
GET /api/ai-bridge/workspace/tree
```

会自动排除 `.git`、`node_modules`、`dist`、`dist-electron`、`.lingbuilder-build` 等目录。

### 5.3 读取文件

```http
POST /api/ai-bridge/files/read
```

请求：

```json
{
  "filePath": "src/游戏主窗体.lcpp"
}
```

只允许读取工作区内的白名单文本文件，例如 `.lcpp`、`.cpp`、`.h`、`.json`、`.ini`、`.md`、`.ts`、`.tsx` 等。

### 5.4 搜索文件

```http
POST /api/ai-bridge/files/search
```

请求：

```json
{
  "query": "信息框",
  "include": ["src", "config", ".lingbuilder"],
  "maxResults": 50
}
```

搜索在 Node 进程内受控执行，不暴露任意 shell。

### 5.5 获取 `.lcpp` 诊断

```http
POST /api/ai-bridge/diagnostics/lingcpp
```

请求：

```json
{
  "filePath": "src/游戏主窗体.lcpp",
  "projectId": "lingbuilder-ui-project"
}
```

也可以直接传入 `sourceCode`，用于诊断尚未保存的编辑器内容：

```json
{
  "filePath": "src/游戏主窗体.lcpp",
  "sourceCode": "类 Main\n结束类\n"
}
```

诊断会消费当前项目模块上下文。

### 5.6 生成 AI 编辑提案

```http
POST /api/ai-bridge/edit/propose
```

请求：

```json
{
  "filePath": "src/游戏主窗体.lcpp",
  "instruction": "给按钮点击事件增加调试输出",
  "projectId": "lingbuilder-ui-project"
}
```

返回 `WorkspaceEditProposal`，外部 AI 客户端应先展示 diff 或摘要，再决定是否应用。

### 5.7 应用编辑提案

```http
POST /api/ai-bridge/edit/apply
```

`preview` 模式必须传入 `approved=true`：

```json
{
  "proposalId": "lingcpp-edit-...",
  "approved": true
}
```

`readonly` 模式会拒绝该请求。

### 5.8 查看模块上下文

```http
GET /api/ai-bridge/modules?projectId=lingbuilder-ui-project
```

返回已安装模块、项目启用模块、模块历史和给 AI 使用的模块摘要。

### 5.9 预览 C++ 工程

```http
POST /api/ai-bridge/native/preview
```

请求需要传入窗口设计器项目模型：

```json
{
  "project": {
    "id": "lingbuilder-ui-project",
    "name": "示例项目",
    "windows": []
  },
  "activeWindowId": "main-window",
  "lingCppSourceCode": "..."
}
```

该接口只返回生成文件内容，不写入导出目录。

### 5.10 导出 C++ 工程

```http
POST /api/ai-bridge/native/export
```

`preview` 模式必须传入 `approved=true`。导出目录为：

```text
generated/cpp/<projectId>/
```

导出目录会包含可复制的 C++ 源码、模块原生依赖、`<projectId>.sln`、`<projectId>.vcxproj` 和 `<projectId>.vcxproj.filters`。当前 Visual Studio 工程默认生成 Win32 / MSVC 配置；启用 `new_emoji` 等 `.lib` 模块时，应使用 Visual Studio 2022 或 Visual Studio Build Tools 打开和编译。

### 5.11 构建运行

```http
POST /api/ai-bridge/build/run
```

`preview` 模式必须传入 `approved=true`。

该接口复用 LingBuilder 受控 Win32 生成、编译、可选运行链路，并复制模块原生依赖。它不会开放任意终端 shell。
同时会在 `.lingbuilder-build/<projectId>/` 和 `generated/cpp/<projectId>/` 写入 Visual Studio 解决方案文件，便于直接用 Visual Studio 打开当前构建产物或可复制导出产物。

请求：

```json
{
  "project": {
    "id": "lingbuilder-ui-project",
    "name": "示例项目",
    "windows": []
  },
  "activeWindowId": "main-window",
  "lingCppSourceCode": "...",
  "lingCppSourceFilePath": "src/游戏主窗体.lcpp",
  "run": true,
  "approved": true
}
```

## 6. MCP 使用

### 6.1 Streamable HTTP MCP（推荐）

AI Bridge 启动后默认提供一个可被多个外部 AI 客户端共享的 MCP 地址：

```text
http://127.0.0.1:17860/api/ai-bridge/mcp
```

客户端使用 `Authorization: Bearer <token>` 请求该地址。连接中心会自动检测并启动 Codex CLI、Claude Code 或 Gemini CLI，同时将地址与 Token 注入专属终端；无需修改用户全局配置。共享端点支持会话建立、断开、客户端统计和工具调用活动记录，连接中心的“连接活动”页会实时显示这些信息。

若客户端不在内置列表中，可点击“打开 Bridge 终端”，读取以下环境变量后按该客户端的 Streamable HTTP MCP 格式配置：

```text
LINGBUILDER_AI_BRIDGE_MCP_URL
LINGBUILDER_AI_BRIDGE_HTTP_URL
LINGBUILDER_AI_BRIDGE_TOKEN
```

### 6.2 stdio MCP 与 ChatGPT/Codex 桌面版

只有明确需要由客户端直接拉起 LingBuilder 子进程时，才使用 `--mcp`：

```bash
cd electron
npm run ai-server -- --workspace .. --permission preview --mcp --token local-token-with-at-least-24-chars
```

此时 stdio MCP 与默认 Streamable HTTP MCP 同时可用。可用 `--no-mcp-http` 仅保留 stdio。两种传输及 REST API 都复用同一个 `AiBridgeService`，不会出现权限、路径校验或模块上下文分叉。

ChatGPT/Codex 桌面版使用更严格的纯 STDIO 模式：

```bash
lingbuilder ai-server --workspace . --permission preview --mcp --stdio-only
```

通常不需要手工运行该命令；连接中心会写入当前项目的 `.codex/config.toml`，由桌面客户端按任务启动和回收子进程。桌面配置使用 `default_tools_approval_mode = "writes"`，写工具同时受 Codex 工具批准和 LingBuilder `readonly` / `preview` / `yolo` 权限双重约束。桌面端已在运行时，新配置不会热加载，必须重启桌面客户端。

暴露工具：

| 工具名 | 说明 |
| --- | --- |
| `lingbuilder.workspace.list` | 列出工作区文件树。 |
| `lingbuilder.file.read` | 读取工作区文本文件。 |
| `lingbuilder.file.search` | 搜索工作区文本。 |
| `lingbuilder.lingcpp.diagnostics` | 获取 `.lcpp` 诊断。 |
| `lingbuilder.edit.propose` | 生成编辑提案。 |
| `lingbuilder.edit.apply` | 应用编辑提案。 |
| `lingbuilder.project.templates` | 列出受控项目模板。 |
| `lingbuilder.project.create` | 预览或创建项目，并初始化设计器模型和模块引用。 |
| `lingbuilder.project.create.undo` | 撤销未被修改的 AI 创建事务。 |
| `lingbuilder.build.run` | 执行受控构建/运行。 |
| `lingbuilder.modules.list` | 查看模块上下文。 |
| `lingbuilder.native.preview` | 预览 C++ 工程。 |
| `lingbuilder.native.export` | 导出 C++ 工程。 |

MCP 工具和 HTTP API 复用同一套 `AiBridgeService`，权限、路径校验和模块上下文保持一致。

### 6.3 EdgeView CLI 测试项目

仓库内 `edgeview-cli-test` 项目用于验证 `lingbuilder.edgeview`。通过 `native.export` / `build.run` 请求传入项目 ID、`.lcpp` 源码和窗口模型后，CLI 会自动读取项目模块上下文、从 NuGet 缓存准备 WebView2 SDK、复制对应架构的 `WebView2Loader.dll` 并生成 Visual Studio 工程。

验收时应同时确认：预览 exe 持续运行；两个 `msedgewebview2.exe` 主进程的 `--user-data-dir` 分别指向不同缓存目录；`run.log` 包含两个实例的 JS 返回值，以及导航完成和网页消息处理器日志。示例源码位于 `examples/edgeview-cli-test/src/EdgeView测试窗体.lcpp`。

### 6.4 CEF3 多浏览器 CLI 测试项目

仓库内 `cef3-cli-test` 项目用于验证 `lingbuilder.cef3.browser`。与 EdgeView 纯代码创建不同，CEF3 浏览器是设计器控件：通过 `native.export` / `build.run` 请求传入含多个 `CefBrowser` 控件的窗口模型、`.lcpp` 源码和项目 ID 后，CLI 会自动读取项目模块上下文、从 `CEF3_SDK_ROOT`、工作区 `.lingbuilder/cef3-sdk` 或 `C:\cef3-sdk` 受控发现 CEF3 SDK（支持官方二进制发行包布局，首次构建自动用 CMake 以 `/MD` 编译 `libcef_dll_wrapper.lib`）、复制匹配架构的 `libcef.dll`/`chrome_elf.dll`/`v8_context_snapshot.bin`/GPU DLL/资源并生成 Visual Studio 工程。

验收时应同时确认：预览 exe 持续运行；exe 同目录存在 `libcef.dll`、`v8_context_snapshot.bin` 与 CEF 资源文件（`v8_context_snapshot.bin` 缺失会导致渲染进程无法启动、浏览器白屏）；启动后出现多个同名子进程（Chromium 多进程架构）；两个浏览器控件分别加载不同地址（2026-07-26 已用 CEF 150.0.14 x64 真实验证百度/必应渲染）；`run.log` 包含 `加载完成` 与 `标题被改变` 事件回调日志。CEF3 为单实例框架，同一 exe 全部控件共享缓存（以第一个控件 `cacheDir` 作为全局 `cache_path`）；需要每实例会话隔离时改用 `lingbuilder.edgeview`。缺少 CEF3 SDK 时构建给出中文诊断并优雅降级（exe 可运行但浏览器区域为空白占位）。示例源码位于 `examples/cef3-cli-test/src/CEF3测试窗体.lcpp`。

### 6.5 new_emoji YOLO 构建注意事项

使用 `yolo` 模式自动生成 `lingbuilder.new_emoji.ui` 示例时，必须避免生成“创建完毕后立刻结束”的代码：

- “创建完毕”事件仍要用独立一行 `结束` 作为结构收尾；不要额外写显式退出命令 `结束()`，否则 exe 会创建窗口后马上销毁并表现为闪退。
- 纯 new_emoji 示例应在创建窗口、文本、按钮等控件后进入 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。
- 如果示例混用了 LingBuilder 默认 Win32 窗口和 new_emoji 自建窗口，必须明确主消息循环归属；不能让默认空窗口关闭后触发 `PostQuitMessage(0)`。
- 返回 exe 路径前，必须确认 exe 同目录存在 `new_emoji.dll`，并实际启动 exe，等待至少 3 秒确认进程仍在运行。

## 7. 安全规则

- AI Bridge 不能暴露到公网，也不能用端口转发绕过回环限制。
- AI Bridge 强制只监听回环地址；远程 AI 统一使用独立云端账号 API。
- HTTP 鉴权只接受 Bearer token；不要把 token 放入查询字符串或请求 JSON。
- 文件读取会按真实路径确认仍位于工作区内；文件树和搜索不跟随符号链接或 Windows junction，新文件写入也会拒绝链接路径链。
- 不要把 token 发给不可信客户端。
- `preview` 是推荐默认模式，外部 AI 只能先生成提案，写入前需要确认。
- `yolo` 模式适合本机可信自动化，不适合陌生模型或远程客户端。
- 所有路径必须在 `--workspace` 内，`../` 路径逃逸会被拒绝。
- 敏感操作会写入审计日志：

```text
.lingbuilder/ai-bridge-log.jsonl
```

## 8. 验证命令

修改 AI Bridge 后至少运行：

```bash
cd electron
npm run lint
npm run test:lingcpp
npm run build
```

CLI smoke test：

```bash
cd electron
node dist/cli.cjs ai-server --workspace .. --port 17860 --token smoke-token
```

另开终端请求：

```bash
curl -H "Authorization: Bearer smoke-token" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

应返回：

```json
{
  "ok": true,
  "service": "LingBuilder AI Bridge",
  "version": 1
}
```

## 9. 常见问题

### 9.1 提示 token 无效或缺失

确认请求头是否包含：

```text
Authorization: Bearer <启动时显示的 token>
```

### 9.2 端口被占用

换一个端口：

```bash
npm run ai-server -- --workspace .. --port 17861
```

### 9.3 `preview` 模式无法写入

写入、导出和构建运行请求需要传入：

```json
{
  "approved": true
}
```

### 9.4 远程客户端无法连接

AI Bridge 只允许本机回环连接，不再支持 `--allow-remote`。远程客户端应登录 LingBuilder 系统 AI 云端 API，不能把本地工作区 Bridge 直接暴露到网络。

### 9.5 0.2 安全与 CLI 变更

- AI Bridge 现在强制只监听 `127.0.0.1`、`localhost` 或 `::1`；`--allow-remote` 已移除。需要远程 AI 时使用带账号、TLS、点数和限流的 LingBuilder 云端 API。
- MCP stdio 已切换到官方 `@modelcontextprotocol/sdk`，十个工具均使用严格 JSON Schema，不再接受任意额外字段。
- 独立 Bridge 不再把普通 instruction 降级成“追加 AI 编辑建议”假提案。外部 AI 必须在 `files[]` 中提供允许路径的完整 `updatedSource`；IDE 内嵌 planner 或系统 AI 才能根据自然语言生成草稿。
- 编辑提案使用 UUID，30 分钟过期，最多保留 100 份；应用时核对原始文本，多文件写入失败会恢复已替换文件。
- 搜索限制单文件 2 MiB、总扫描 64 MiB、20,000 文件、500 条结果和 10 秒；文件树限制节点数与深度。
- 构建编译接受项目租约 `AbortSignal`，停止和关闭会中断编译器，而不再只等待固定超时。

新增产品 CLI：

```text
lingbuilder doctor [--workspace <path>] [--json]
lingbuilder auth login|logout|status [--server <url>]
lingbuilder ai models|balance
lingbuilder ai chat --model <alias> --prompt <text> [--json]
lingbuilder workspace inspect [--workspace <path>] [--json]
lingbuilder project templates [--workspace <path>] [--json]
lingbuilder project create --request <create-request.json> [--workspace <path>] [--yes] [--json]
lingbuilder project undo-create --request <undo-request.json> --workspace <path> --yes [--json]
lingbuilder project diagnose|export|build|run|stop --request <file.json> [--yes] [--json]
```

`project create` 不带 `--yes` 时只返回创建预览；带 `--yes` 才写入真实解决方案、设计器模型和项目模块引用。请求文件可以包含 `name`、`projectId`、`templateId`（`blank-window` 或 `hello-window`）、`windowTitle`、`enabledModuleIds` 和 `openInWorkbench`。创建结果的 `receipt.receiptId` 可写入 `undo-request.json`，通过 `project undo-create --yes` 在文件未变更时撤销。

`project diagnose` 会按请求中的 `projectId` 聚合同项目源码上下文，包括固定的 `项目全局变量.lcpp` 与 `项目数据类型.lcpp`。`project build --yes` 在编译结束后返回；`project run --yes` 会一直附着到生成的 exe，待程序自然退出且 `run.log` 写入完成后输出最终结果。需要中止时按 Ctrl+C，CLI 会先回收当前受管运行进程再退出。无控件空窗口也是合法构建输入，不需要额外放置占位控件。

CLI 设备登录通过浏览器确认，刷新令牌使用 Windows DPAPI 保护文件保存；它与 AI Bridge 本地 Bearer Token 完全不同。

系统 AI 云端的 SSE 在提交响应头前校验幂等键；重复键返回 HTTP 409。OpenAI-compatible 思考模型的推理增量与最终正文分离，取消结算按包含规则手册的完整云端消息上下文估算，以上行为不改变本地 AI Bridge Bearer Token 或 MCP 协议。

请同时确认防火墙和网络安全策略。

### 9.6 构建失败

确认本机安装了可用 C++ 编译器：

- Visual Studio Build Tools / MSVC
- MinGW g++
- LLVM clang++

如果项目启用了需要 `.lib` 的原生模块，通常需要 MSVC。
