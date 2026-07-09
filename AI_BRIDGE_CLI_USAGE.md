# LingBuilder AI Bridge CLI 使用手册

本文档说明如何启动 LingBuilder 内置的 AI Bridge CLI，并让其它 AI 客户端通过 HTTP 或 MCP 连接 LingBuilder 工作区。

AI Bridge 的目标是让外部 AI 客户端安全地使用 LingBuilder 的本地能力：读取项目、搜索文件、获取 `.lcpp` 诊断、生成可预览的代码修改、应用修改、查看模块上下文、生成/导出 C++ 与 Visual Studio 工程，以及执行受控构建运行。

## 1. 启动方式

开发期从 `electron/` 目录启动：

```bash
cd electron
npm run ai-server -- --workspace .. --port 17860
```

打包构建后可以直接运行 CLI：

```bash
cd electron
node dist/cli.cjs ai-server --workspace .. --port 17860
```

如果后续通过 npm bin 暴露 `lingbuilder`，等价命令为：

```bash
lingbuilder ai-server --workspace "D:\项目\我的LingBuilder工程" --port 17860
```

启动成功后终端会显示：

```text
LingBuilder AI Bridge listening on http://127.0.0.1:17860/api/ai-bridge
Workspace: ...
Permission: preview
Token: ...
```

如果没有传入 `--token`，CLI 会自动生成一次性 token。外部客户端调用 HTTP API 时必须带上 token。

## 2. 常用参数

```bash
npm run ai-server -- --workspace .. --port 17860 --permission preview
npm run ai-server -- --workspace .. --permission readonly
npm run ai-server -- --workspace .. --permission yolo --token local-token
npm run ai-server -- --workspace .. --permission yolo --mcp
```

参数说明：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--workspace` | 当前目录 | 要暴露给 AI 客户端的 LingBuilder 工作区根目录。 |
| `--host` | `127.0.0.1` | 监听地址。默认只允许本机访问。 |
| `--port` | `17860` | HTTP 服务端口。 |
| `--permission` | `preview` | 权限模式：`readonly`、`preview`、`yolo`。 |
| `--token` | 自动生成 | 访问 HTTP API 的鉴权 token。 |
| `--mcp` | 关闭 | 启用 MCP stdio 工具服务。 |
| `--allow-remote` | 关闭 | 允许非本机监听。只有明确需要远程连接时使用。 |

默认禁止公网监听。如果要监听所有网卡，必须显式传入：

```bash
npm run ai-server -- --workspace .. --host 0.0.0.0 --allow-remote --token local-token
```

## 3. 权限模式

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

## 4. HTTP API

HTTP 基础地址：

```text
http://127.0.0.1:17860/api/ai-bridge
```

请求必须携带 token：

```bash
curl -H "Authorization: Bearer local-token" ^
  http://127.0.0.1:17860/api/ai-bridge/health
```

也可以用 `token` 查询参数或请求体字段，但推荐使用 `Authorization: Bearer <token>`。

### 4.1 健康检查

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
  "mcp": false
}
```

### 4.2 列出工作区文件树

```http
GET /api/ai-bridge/workspace/tree
```

会自动排除 `.git`、`node_modules`、`dist`、`dist-electron`、`.lingbuilder-build` 等目录。

### 4.3 读取文件

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

### 4.4 搜索文件

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

### 4.5 获取 `.lcpp` 诊断

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

### 4.6 生成 AI 编辑提案

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

### 4.7 应用编辑提案

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

### 4.8 查看模块上下文

```http
GET /api/ai-bridge/modules?projectId=lingbuilder-ui-project
```

返回已安装模块、项目启用模块、模块历史和给 AI 使用的模块摘要。

### 4.9 预览 C++ 工程

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

### 4.10 导出 C++ 工程

```http
POST /api/ai-bridge/native/export
```

`preview` 模式必须传入 `approved=true`。导出目录为：

```text
generated/cpp/<projectId>/
```

导出目录会包含可复制的 C++ 源码、模块原生依赖、`<projectId>.sln`、`<projectId>.vcxproj` 和 `<projectId>.vcxproj.filters`。当前 Visual Studio 工程默认生成 Win32 / MSVC 配置；启用 `new_emoji` 等 `.lib` 模块时，应使用 Visual Studio 2022 或 Visual Studio Build Tools 打开和编译。

### 4.11 构建运行

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

## 5. MCP 使用

启用 MCP：

```bash
cd electron
npm run ai-server -- --workspace .. --permission preview --mcp --token local-token
```

MCP 使用 stdio JSON-RPC。服务同时启动 HTTP API，但 MCP 消息走标准输入/输出。

暴露工具：

| 工具名 | 说明 |
| --- | --- |
| `lingbuilder.workspace.list` | 列出工作区文件树。 |
| `lingbuilder.file.read` | 读取工作区文本文件。 |
| `lingbuilder.file.search` | 搜索工作区文本。 |
| `lingbuilder.lingcpp.diagnostics` | 获取 `.lcpp` 诊断。 |
| `lingbuilder.edit.propose` | 生成编辑提案。 |
| `lingbuilder.edit.apply` | 应用编辑提案。 |
| `lingbuilder.build.run` | 执行受控构建/运行。 |
| `lingbuilder.modules.list` | 查看模块上下文。 |
| `lingbuilder.native.preview` | 预览 C++ 工程。 |
| `lingbuilder.native.export` | 导出 C++ 工程。 |

MCP 工具和 HTTP API 复用同一套 `AiBridgeService`，权限、路径校验和模块上下文保持一致。

## 5.1 new_emoji YOLO 构建注意事项

使用 `yolo` 模式自动生成 `lingbuilder.new_emoji.ui` 示例时，必须避免生成“创建完毕后立刻结束”的代码：

- 不要在 new_emoji 演示窗口的“创建完毕”事件末尾写 `结束` 或 `结束()`，否则 exe 会创建窗口后马上销毁并表现为闪退。
- 纯 new_emoji 示例应在创建窗口、文本、按钮等控件后进入 `NE_运行消息循环` 或底层 `EU_RunMessageLoop()`。
- 如果示例混用了 LingBuilder 默认 Win32 窗口和 new_emoji 自建窗口，必须明确主消息循环归属；不能让默认空窗口关闭后触发 `PostQuitMessage(0)`。
- 返回 exe 路径前，必须确认 exe 同目录存在 `new_emoji.dll`，并实际启动 exe，等待至少 3 秒确认进程仍在运行。

## 6. 安全规则

- 不要把 AI Bridge 暴露到公网，除非你明确知道风险。
- 不要把 token 发给不可信客户端。
- `preview` 是推荐默认模式，外部 AI 只能先生成提案，写入前需要确认。
- `yolo` 模式适合本机可信自动化，不适合陌生模型或远程客户端。
- 所有路径必须在 `--workspace` 内，`../` 路径逃逸会被拒绝。
- 敏感操作会写入审计日志：

```text
.lingbuilder/ai-bridge-log.jsonl
```

## 7. 验证命令

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

## 8. 常见问题

### 8.1 提示 token 无效或缺失

确认请求头是否包含：

```text
Authorization: Bearer <启动时显示的 token>
```

### 8.2 端口被占用

换一个端口：

```bash
npm run ai-server -- --workspace .. --port 17861
```

### 8.3 `preview` 模式无法写入

写入、导出和构建运行请求需要传入：

```json
{
  "approved": true
}
```

### 8.4 远程客户端无法连接

默认只监听本机。确需远程连接时使用：

```bash
npm run ai-server -- --workspace .. --host 0.0.0.0 --allow-remote --token local-token
```

请同时确认防火墙和网络安全策略。

### 8.5 构建失败

确认本机安装了可用 C++ 编译器：

- Visual Studio Build Tools / MSVC
- MinGW g++
- LLVM clang++

如果项目启用了需要 `.lib` 的原生模块，通常需要 MSVC。
