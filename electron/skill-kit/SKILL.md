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

## 第 0.5 步：可行性前置检查（动手创建项目之前必须逐项过一遍）

这一步回答「这个任务在本机当前能不能一次跑通」。逐项确认，有任何一项不满足就先告诉用户怎么补，
不要先创建项目再撞报错：

1. **目标模块是否收费、要不要本机授权**：`lingbuilder.new_emoji.ui`（new_emoji 界面模块）及其外壳
   `lingbuilder.new_emoji.fbro-shell` 是收费模块。外部 AI 客户端要用它们，必须请用户在
   LingBuilder「帮助(H) → AI Bridge 连接中心 → Bridge 启动设置」勾选**「允许外部 AI 客户端使用本机授权」**
   并保持 IDE 运行。门禁若报「宿主启动时未取得授权」，说明你的 MCP 宿主先于该开关启动：请用户勾选后
   **重启 AI 客户端或重连 MCP** 再试——这是时序问题，不是未购买，不要建议用户购买模块，也不要反复重试。
2. **目标构建架构**：含浏览器内核（CEF3/FBro）或 new_emoji 的项目通常需要 x64；
   纯 Win32 基础控件示例用默认 Win32 即可。架构写在工作区 `.lingbuilder/build-configuration.json`
   的**顶层** `mode`（Debug/Release）与 `architecture`（Win32/x64）两个字段，只认顶层字段；
   创建带浏览器内核的项目前先确认该文件存在且架构正确，构建输出目录按它命名（如 `Win32\Debug`、`x64\Debug`）。
   `new-emoji-fbro-browser-shell` 是唯一带 new_emoji 浏览器外壳的项目模板，需要 x64。
3. **本次是全局安装还是工作区安装**：默认写**工作区级**配置（当前目录下的 `.codex/config.toml`、
   `.mcp.json`、`.gemini/settings.json`）。用户明确要「全局/所有项目可用」时才写用户级文件：
   Codex 为 `%USERPROFILE%\.codex\config.toml`，Claude Code 用 `claude mcp add --scope user`（或
   `%USERPROFILE%\.claude.json` 的 `mcpServers`），Gemini CLI 为 `%USERPROFILE%\.gemini\settings.json`；
   用户级文件里只保留 LingBuilder 托管段，改动前向用户复述要写入的路径。
4. **失败时先看哪条诊断**：构建/链接失败 → `lingbuilder.build.run` 返回的中文日志原样带给用户；
   报「项目尚未启用 xxx 模块」→ 用 `lingbuilder.modules.list` 与 `project-modules.json` 对照；
   报「宿主启动时未取得授权」→ 回到本步第 1 条；文件 ENOENT 或「工作区中不存在」→ 回到第 2 步核对工作区根。

## 第 1 步：写你自己的 MCP 配置

宿主必须是 `LingBuilder.exe` 并带环境变量 `ELECTRON_RUN_AS_NODE=1`。
**禁止指向 `lingbuilder.cmd` 等启动器脚本**：那会复活 IDE 图形进程并挡住后续安装更新。

stdio 模式不监听端口、不需要 Token，工作区取客户端当前目录，所以 `--workspace` 固定写 `.`。
因此**你启动 MCP 时的当前目录就是后续所有工作的工作区**——先 `cd` 到用户项目目录再启动，
不要在错误目录拉起宿主。

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

## 第 2 步：确认连通，并先确认工作区

重连或重启你的 MCP 会话后列工具，应当恰好看到 23 个 `lingbuilder.*` 工具，其中必有：
`lingbuilder.project.templates`、`lingbuilder.project.create`、`lingbuilder.edit.propose`、
`lingbuilder.edit.apply`、`lingbuilder.lingcpp.diagnostics`、`lingbuilder.build.run`、
`lingbuilder.run.wait`、`lingbuilder.run.log`、`lingbuilder.build.stop`、`lingbuilder.module.info`。

然后**第一时间调一次 `lingbuilder.workspace.list`**：返回数组首项是 `type="workspace"` 的合成根条目，
其 `workspaceRoot` 字段是当前 Bridge 工作区根绝对路径。拿它与用户项目目录比对：
一致才开始干活；不一致（`--workspace .` 落错目录）就停止，请用户把客户端切到正确目录后重启 MCP 宿主，
不要在错误工作区里继续生成任何提案。

拿不到工具清单时先检查：exe 路径、`ELECTRON_RUN_AS_NODE` 是否生效、`cli.cjs` 是否在 asar 内该路径、
你的客户端是否真的重启了 MCP 宿主。不要用 HTTP 端口去猜——stdio 模式没有端口。

## 第 3 步：按这个顺序做窗口应用

1. `project.templates` 看模板；`hello-window` 起步最稳，`sqlite-crud-window` 是「表单 + 列表 + 增删改查」完整起点，
   `new-emoji-fbro-browser-shell` 是 new_emoji 浏览器外壳（收费模块 + 需要 x64，见第 0.5 步）。
2. `project.create`：先不带 `approved` 拿预览，用户确认后再带 `approved=true` 落盘；记住返回的 `project.id`，
   窗口项目还会返回 `designerProject`。新建项目默认落在 `src/<id>`、`config/<id>`，与默认项目嵌套是常态。
   注意：MCP 的 `project.create` 会做收费模块权益门禁（启用收费模块时必须有第 0.5 步的本机授权），
   而 CLI 的 `lingbuilder project build/run` 路径**不挂**该门禁——两条入口权限不一致是产品现状，
   遇到「创建被拒但构建放行」不要当成自己的配置错误。
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
真实调用示例和界面配方，全部用 `module.info`（`query` 过滤，`control` 取单控件契约——唯一命中时会内联
组件卡正文与人工红线，`example` 取配方正文）。不要把整表命令清单塞进上下文。

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

## 第 5 步：交付口径

- 任何写入与构建都限定在当前工作区内；改前给预览、改后可撤销，不静默批量改写。
- 报告改动时给：改了哪些文件、提案 ID、构建产物 exe 路径、运行退出码或 `run.log` 摘要。
- 生成结果必须可阅读、可复制、可迁移：用户要能把导出的 C++ / Visual Studio 工程拿出去编译运行。
- 构建失败时把中文日志原样带给用户，再给修法，不要只说"编译失败"。
- **接入过程会产生这些工作区文件，它们是项目工件，不是垃圾，收尾时不要清理**：
  `.lingbuilder/solution.json`（解决方案与项目登记）、`.lingbuilder/build-configuration.json`（构建配置）、
  `.lingbuilder/project-modules.json`（默认项目启用模块）、`.lingbuilder/modules/<moduleId>/`（已安装模块）、
  `.lingbuilder/projects/<projectId>/window-designer.json`（设计器模型）、`src/<id>` 与 `config/<id>`（项目源码）。
  你的客户端配置文件（`.codex/config.toml`、`.mcp.json`、`.gemini/settings.json` 中的 LingBuilder 段）
  是长期接入配置，同样不要删；只有用户明确要求断开时才移除 LingBuilder 托管段。
