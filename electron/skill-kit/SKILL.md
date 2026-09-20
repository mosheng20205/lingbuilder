# 灵码 Skill：让 AI 客户端连上本机 LingBuilder

这份文档是给 AI 客户端读的自安装指引。你的读者已经装好 LingBuilder 中文 IDE，你要做的是：
先找到本机 IDE，把 LingBuilder 的 AI Bridge 以 stdio MCP 方式接进你自己的配置，
验证连通，然后按本文的工作流替用户编写、构建、运行和修改中文 `.lcpp` 工程。

本文件是 LingBuilder 安装包内的离线快照。若 IDE 的「灵码 Skill」窗口提示官网已发布更新版，
应以更新版为准；本快照的 `sequence` 见同目录 `manifest.json`。

## 第 0 步：定位本机 LingBuilder

按顺序尝试，第一个存在即用：

1. `where lingbuilder`（PATH 里的 `lingbuilder.cmd`）取其所在目录作为安装目录 `<IDE>`；
2. `%LOCALAPPDATA%\Programs\LingBuilder`；
3. 注册表卸载项 `DisplayName` 以 `LingBuilder` 开头的 `InstallLocation`。

需要的两个路径：

- 宿主程序：`<IDE>\LingBuilder.exe`
- 入口脚本：`<IDE>\resources\app.asar\dist\cli.cjs`

两者任一不存在就说明 IDE 未装好，直接告诉用户，不要猜路径、不要用 Node 直接执行 asar 内脚本。

## 第 1 步：写你自己的 MCP 配置

宿主必须是 `LingBuilder.exe` 并带环境变量 `ELECTRON_RUN_AS_NODE=1`。
**禁止指向 `lingbuilder.cmd` 等启动器脚本**：那会复活 IDE 图形进程并挡住后续安装更新。

stdio 模式不监听端口、不需要 Token，工作区取客户端当前目录，所以 `--workspace` 固定写 `.`。

### Codex / ChatGPT 桌面版

写入当前工作区 `.codex/config.toml`，保留文件里其它内容；已存在同名 `[mcp_servers.lingbuilder_desktop]`
时先报告冲突、取得用户确认再替换，且只删除 LingBuilder 托管段。

```toml
# lingbuilder:managed-block:begin
[mcp_servers.lingbuilder_desktop]
command = "<IDE>\\LingBuilder.exe"
args = ["<IDE>\\resources\\app.asar\\dist\\cli.cjs", "ai-server", "--workspace", ".", "--permission", "preview", "--mcp", "--stdio-only"]
env = { ELECTRON_RUN_AS_NODE = "1" }
enabled = true
required = false
default_tools_approval_mode = "writes"
# lingbuilder:managed-block:end
```

### Claude Code

写入当前工作区 `.mcp.json`（项目级），不要把 Token 或配置写进用户全局文件。

```json
{
  "mcpServers": {
    "lingbuilder": {
      "command": "<IDE>\\LingBuilder.exe",
      "args": [
        "<IDE>\\resources\\app.asar\\dist\\cli.cjs",
        "ai-server",
        "--workspace",
        ".",
        "--permission",
        "preview",
        "--mcp",
        "--stdio-only"
      ],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

### Gemini CLI

写入当前工作区 `.gemini/settings.json`，字段形状同上：`command` 指主程序 exe，
`args` 与上列完全一致，`env` 只放 `ELECTRON_RUN_AS_NODE`。

### 其它支持 stdio MCP 的客户端

用同一组 `command` / `args` / `env`。参数集合不得增删改序；要换权限只改 `--permission` 一个值。

## 第 2 步：确认连通

重连或重启你的 MCP 会话后列工具，应当恰好看到 23 个 `lingbuilder.*` 工具，其中必有：
`lingbuilder.project.templates`、`lingbuilder.project.create`、`lingbuilder.edit.propose`、
`lingbuilder.edit.apply`、`lingbuilder.lingcpp.diagnostics`、`lingbuilder.build.run`、
`lingbuilder.run.wait`、`lingbuilder.run.log`、`lingbuilder.build.stop`、`lingbuilder.module.info`。

再调一次 `lingbuilder.workspace.list`，返回内容必须落在用户的工作区内。
拿不到工具清单时先检查：exe 路径、`ELECTRON_RUN_AS_NODE` 是否生效、`cli.cjs` 是否在 asar 内该路径、
你的客户端是否真的重启了 MCP 宿主。不要用 HTTP 端口去猜——stdio 模式没有端口。

## 第 3 步：按这个顺序做窗口应用

1. `project.templates` 看模板；`hello-window` 起步最稳，`sqlite-crud-window` 是「表单 + 列表 + 增删改查」完整起点。
2. `project.create`：先不带 `approved` 拿预览，用户确认后再带 `approved=true` 落盘；记住返回的 `project.id`，
   窗口项目还会返回 `designerProject`。新建项目默认落在 `src/<id>`、`config/<id>`，与默认项目嵌套是常态。
3. 改代码用 `edit.propose` → `edit.apply`。`files[]` 三选一：优先 `updatedLines`（按行数组，换行不必转义）
   或 `edits`（行级增量），只有小文件才用 `updatedSource`。`workspaceFiles` 可以省略，服务端自己读盘。
4. 改窗口布局必须在同一个提案里传 `updatedDesignerProject`（完整设计器模型对象）。
   **只写 `.lcpp` 不会产生界面**：画布空白、exe 里没有控件，就是因为控件从未进入设计器模型。
5. 每轮改完跑 `lingcpp.diagnostics`（传 `projectId` 即可）。它的 `designerInventory` 是组件表唯一权威入口，
   `codeOrganization` 给拆分处方；出现 `lingcpp-designer-controls-empty` 就是零控件，先补控件再构建。
6. 构建运行用 `build.run`，只传 `projectId` + `run`，不要重发整份模型。`preview` 权限下写盘与构建必须显式
   `approved=true`，一次调用只做一次批准，不要把 `approved` 常开。
7. 运行观测：`run.wait` 等退出拿退出码，`run.log` 读输出，`build.stop` 停掉本 Bridge 启动的进程。
   图形界面程序按 `run.wait` 会超时返回 `running=true`，属正常，别当失败。

模块相关的查法：`modules.list` 只给摘要；某个模块的完整命令签名、参数说明、公开常量、设计器控件表、
真实调用示例和界面配方，全部用 `module.info`（`query` 过滤，`control` 取单控件契约，`example` 取配方正文）。
不要把整表命令清单塞进上下文。

## 第 4 步：中文源码红线

`.lcpp` 是中文源码，运行前先确定性生成真实 C++。以下语法没有例外：

- 控件引用参数写**裸控件名，不带引号**：`控件_设置文本(操作结果, "完成")`。写成 `"操作结果"` 会被诊断拦下。
- 事件、回调、完成等处理器参数必须 `&处理器名`，前缀 `&` 不可省，也不要用引号包住。
- 模块公开常量与项目常量用 `#常量名` 引用（裸名不带引号）。
- 行首 `@` 是内嵌 C++ 行；多行文本块用 `变量 = """` 开始、单独一行 `"""` 结束。
- 独立一行的 `结束` 是块结束标记，不是退出命令；要退出窗口或程序写 `结束()`。
  生成独立演示窗口时不要把 `结束()` 当收尾，否则表现为启动后闪退。
- 不认识的中文命令一律先查 `module.info`，**禁止编造命令名或参数顺序**；模块未启用就按诊断提示启用，
  不要改成"等价写法"绕门禁。
- 高频刷新界面不属于工作线程：界面更新排到界面线程，工作线程只推进计数或进度，禁止逐条刷 UI。

收费模块与浏览器（FBro）授权需要用户在「AI Bridge 连接中心 → Bridge 启动设置」里勾选
「允许外部 AI 客户端使用本机授权」，你才能拿到本机授权；未勾选时相关命令会被权益门禁拒绝，
这不是你可以绕过的问题，如实告诉用户去哪里打开。

## 第 5 步：交付口径

- 任何写入与构建都限定在当前工作区内；改前给预览、改后可撤销，不静默批量改写。
- 报告改动时给：改了哪些文件、提案 ID、构建产物 exe 路径、运行退出码或 `run.log` 摘要。
- 生成结果必须可阅读、可复制、可迁移：用户要能把导出的 C++ / Visual Studio 工程拿出去编译运行。
- 构建失败时把中文日志原样带给用户，再给修法，不要只说"编译失败"。
