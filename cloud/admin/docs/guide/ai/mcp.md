---
title: MCP 工具协议
---

# MCP 工具协议

> [🕒 预计 20 分钟] | 难度：进阶

**MCP（Model Context Protocol，模型上下文协议）** 是连接 AI 模型与外部工具的标准协议。在 LingBuilder 中，**本地 AI Bridge 就是一个 MCP 服务器**：外部 AI 客户端（如 Claude Code、Codex CLI、Gemini CLI）可以连接它，直接读取你的工作区、提出代码修改提案、创建项目并执行受控构建。

## 1. MCP 在 LingBuilder 中的角色

| 组件 | 说明 |
|---|---|
| **MCP 服务器（AI Bridge）** | LingBuilder 内置的本地服务，对外暴露工作区工具，仅监听 `127.0.0.1` |
| **MCP 客户端（外部 AI）** | Claude Code、Codex CLI、Gemini CLI 等支持 MCP 的客户端 |
| **MCP 工具** | AI 可调用的操作单元，如读取文件、搜索代码、应用编辑提案 |

也就是说，LingBuilder 不去连接别人的 MCP 服务器，而是把**自己的工作区能力以 MCP 标准开放出去**，让专业编码客户端在你的项目上干活。

## 2. 传输方式与端点

AI Bridge 支持两种 MCP 传输方式，两者复用同一套工具与权限体系：

| 传输方式 | 说明 | 默认状态 |
|---|---|---|
| **Streamable HTTP** | 端点 `http://127.0.0.1:<端口>/api/ai-bridge/mcp`（默认端口 `17860`），使用 `initialize` 握手后通过 `Mcp-Session-Id` 头保持会话 | 默认启用 |
| **STDIO** | 通过标准输入/输出发送 MCP 消息，适合 CLI 客户端直接托管 Bridge 进程 | 启动时加 `--mcp` 参数启用 |

补充说明：

- 使用 `--no-mcp-http` 参数可关闭 Streamable HTTP，仅保留 STDIO。
- 所有请求必须携带 `Authorization: Bearer <token>`。Token 由 IDE 或启动命令生成，只保存在内存中，不会写入磁盘。

## 3. 已暴露的 MCP 工具

| 工具名 | 说明 |
|---|---|
| `lingbuilder.workspace.list` | 列出 LingBuilder 工作区文件树 |
| `lingbuilder.file.read` | 读取工作区内允许类型的文本文件 |
| `lingbuilder.file.search` | 在工作区内执行受控文本搜索 |
| `lingbuilder.lingcpp.diagnostics` | 返回 `.lcpp` 解析与语义诊断；传入完整设计器模型时可校验控件引用与事件绑定 |
| `lingbuilder.edit.propose` | 根据外部 AI 提供的**完整文件草稿**生成可预览修改提案；多文件编辑需传入全部目标文件的当前内容 |
| `lingbuilder.edit.apply` | 应用已有的 WorkspaceEdit 提案，受权限模式控制 |
| `lingbuilder.project.templates` | 列出可用于 AI 新建项目的受控中文项目模板 |
| `lingbuilder.project.create` | 预览或创建项目；不传 `approved=true` 时只返回预览不落盘 |
| `lingbuilder.project.create.undo` | 撤销尚未被用户修改的 AI 项目创建事务 |
| `lingbuilder.build.run` | 执行受控构建/运行请求，需传入完整设计器模型 |
| `lingbuilder.modules.list` | 列出模块与指定项目的模块上下文 |
| `lingbuilder.native.preview` | 预览生成的 C++ 工程文件（写入受控临时目录） |
| `lingbuilder.native.export` | 导出 C++ 工程，受权限模式控制 |
| `lingbuilder.module.scaffold` | 在 `.lingbuilder/module-build` 下创建 `.lbmod` 模块项目骨架（manifest v2 + C++ 源码模板） |
| `lingbuilder.module.writeFiles` | 把模块完整文件（含 manifest v2 清单）写入 `.lingbuilder/module-build`；每项是完整新内容而非片段 |
| `lingbuilder.module.validate` | 校验模块目录（manifest v2、binding、模块文档与示例完整性），返回中文诊断；只读操作 |
| `lingbuilder.module.pack` | 把校验通过的模块目录打包为 `.lingbuilder/module-packages/<目录名>.lbmod`，打包前强制完整校验 |
| `lingbuilder.module.installPreview` | 解压并校验 `.lbmod` 模块包（清单/路径/平台依赖），返回 `previewId` 与中文诊断，不安装 |
| `lingbuilder.module.install` | 按 `previewId` 安装模块包并可启用到指定项目；收费模块仍受权益门禁 |

> [!NOTE]
> 编辑类工具接收的是**完整文件草稿**而不是 diff 片段；构建、预览与导出类工具需要传入 `project.create` 返回的完整设计器模型，不能只传项目 ID。

### 模块生成工具链

上表最后 6 个模块工具让外部 AI 端到端生成并安装 `.lbmod` 模块，按固定顺序调用：

```text
scaffold → writeFiles → validate → pack → installPreview → install
```

- `scaffold` / `writeFiles` / `validate` 作用于工作区 `.lingbuilder/module-build` 目录；`pack` 的输出与 `installPreview` / `install` 的输入位于 `.lingbuilder/module-packages` 目录，路径越界会被拒绝。
- 写操作与编辑工具同一权限语义：readonly 模式全部拒绝，preview 模式必须显式传 `approved=true`，所有调用都会写入审计日志。
- `module.install` 必须传入 `installPreview` 返回的 `previewId`，不能跳过预览直接安装；安装后默认启用到指定项目并同步构建配置。

## 4. 权限控制

MCP 工具调用遵循 AI Bridge 的 **权限模式** 设定（详见 [AI Bridge 连接配置](/guide/ai/bridge-config)）：

| 模式 | 文件工具 | 编辑/构建/导出 |
|---|---|---|
| **只读模式（readonly）** | 仅可读 | 全部不可用 |
| **预览模式（preview）** | 可读；写操作仅生成预览提案 | 必须显式传 `approved=true` 并经确认 |
| **yolo 模式（yolo）** | 可读写项目文件 | 直接执行受控工具，仍不能运行任意命令 |

> [!WARNING]
> yolo 模式下 AI 的写操作会直接作用于项目文件。请仅在受信任的项目中开启，并关注每次变更请求。

## 5. 连接示例

外部客户端连接信息可在 **帮助** > **AI Bridge 连接中心** 中一键查看或生成配置。以 Streamable HTTP 为例，一次最小会话如下：

```bash
# 1. 握手
curl -X POST http://127.0.0.1:17860/api/ai-bridge/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"demo","version":"1.0"}}}'
# 响应头会返回 Mcp-Session-Id，后续请求需携带

# 2. 列出工具
curl -X POST http://127.0.0.1:17860/api/ai-bridge/mcp \
  -H "Authorization: Bearer <token>" \
  -H "Mcp-Session-Id: <会话ID>" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Claude Code、Codex CLI 与 Gemini CLI 的免手写配置，可直接在 AI Bridge 连接中心生成。

## 6. 常见问题

### 连接被拒绝（401）

- Token 不匹配。请从 AI Bridge 连接中心复制当前会话的最新 Token。
- Bridge 未启动或端口不一致。

### 返回 406 Not Acceptable

- Streamable HTTP 要求请求头包含 `Accept: application/json, text/event-stream`。

### 工具调用被拒绝

- 当前权限模式不允许该操作（如只读模式下调用写入类工具）。
- 预览模式下忘记传 `approved=true`。
- 将需求描述得更明确，例如“请先读取 src/MainWindow.lcpp，再提出修改提案”。

## 下一步

- 编译并运行项目详解：[AI 构建与运行](/guide/ai/build-run)
- 配置连接与权限：[AI Bridge 连接配置](/guide/ai/bridge-config)
- 让外部 AI 直接改代码：[AI 对话式改代码](/guide/ai/chat)