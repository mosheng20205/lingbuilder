# LingBuilder AI Bridge 使用手册

本手册面向已安装 LingBuilder 桌面版的用户，说明如何让 Cursor、ChatGPT/Codex 桌面版、Codex CLI、Claude Code、Gemini CLI 以及其它支持 MCP 的 AI 客户端安全地使用你的 LingBuilder 项目。

AI Bridge 让外部 AI 可以：

- 浏览、读取和搜索你的项目文件
- 获取 `.lcpp` 中文源码的诊断信息
- 生成可预览、可确认的代码修改提案并应用
- 预览和导出 C++ / Visual Studio 工程
- 执行受控的构建和运行

所有能力都只开放给本机（127.0.0.1）连接，并受你选择的权限模式约束。

## 1. 三种接入方式

| 方式 | 适合谁 | 需要手动配置吗 |
| --- | --- | --- |
| IDE 一键连接 | ChatGPT/Codex 桌面版、Codex CLI、Claude Code、Gemini CLI | 否，点一下即可 |
| 手动配置 MCP | Cursor 等其它 AI 客户端 | 是，见第 4 节 |
| 把本手册交给 AI 代配置 | 不熟悉配置文件的用户 | 让 AI 按第 6 节的提示词完成 |

## 2. 准备：启动 Bridge 并获取地址与 Token

1. 打开 LingBuilder，进入菜单 **帮助 → AI Bridge 连接中心**。
2. 在"连接"页确认权限模式（默认 `preview`，推荐保持），点击 **启动 AI Bridge**。
3. 启动成功后，卡片下方会出现三行信息，每行右侧都有复制按钮：
   - **MCP（推荐）**：形如 `http://127.0.0.1:17860/api/ai-bridge/mcp`，这是给 AI 客户端用的 MCP 地址
   - **HTTP API**：形如 `http://127.0.0.1:17860/api/ai-bridge`，这是给脚本或自研程序用的接口地址
   - **临时 Token**：一串掩码，点击复制按钮会把完整 Token 复制到剪贴板
4. 需要调整端口、权限、生命周期或自定义 Token 时，点击卡片中的 **调整启动设置** 链接，或切换到"高级设置"页。

注意：

- 关闭连接中心窗口不会停止 Bridge；在连接中心点"停止 Bridge"才会。
- "重新生成 Token"会让旧 Token 立即失效，所有已连接客户端需要更新配置后重连。
- Bridge 只监听本机回环地址，其它电脑无法连接你本机的 Bridge。

## 3. IDE 一键连接（内置客户端）

在连接中心"连接"页：

- **ChatGPT/Codex 桌面版**：点击"配置并打开桌面版"，LingBuilder 会向当前工作区写入项目级 MCP 配置并启动桌面客户端。首次配置后如果桌面客户端已经在运行，需要完全退出（包括后台进程）再重新打开才能生效。
- **Codex CLI / Claude Code / Gemini CLI**：点击对应卡片上的"连接并打开"，LingBuilder 会在 IDE 集成终端中启动该客户端，并自动注入连接所需的地址和临时 Token。Token 只存在于该终端进程，不会写入任何配置文件。
- **通用终端**：点击"打开 Bridge 终端"可获得一个已注入地址和 Token 环境变量的 PowerShell，供其它命令行工具使用。

这些方式都无需手动拼接命令或复制 Token。

## 4. 在 Cursor 等其它 AI 客户端中手动配置

以下以 Cursor 为例。其它支持 MCP 的客户端配置方法相同（见第 5 节）。

### 4.1 方式一：HTTP MCP（推荐，先启动 Bridge）

先按第 2 节启动 Bridge 并复制 **MCP 地址** 和 **临时 Token**。

编辑 Cursor 的 MCP 配置文件（全局配置对所有项目生效）：

```text
C:\Users\<你的用户名>\.cursor\mcp.json
```

写入以下内容（把地址端口和 Token 替换为你自己的）：

```json
{
  "mcpServers": {
    "lingbuilder": {
      "url": "http://127.0.0.1:17860/api/ai-bridge/mcp",
      "headers": {
        "Authorization": "Bearer 把这里替换成你复制的完整Token"
      }
    }
  }
}
```

保存后重新打开 Cursor（或在 Cursor 的 MCP 设置面板中确认 `lingbuilder` 已连接）。之后在对话中就能看到 `lingbuilder.workspace.list`、`lingbuilder.file.read` 等工具。

注意事项：

- Token 写入的是本机配置文件，请确认该文件不会被同步或分享到外部。
- 在 LingBuilder 连接中心"重新生成 Token"后，记得同步更新这里的 Token。
- 每次使用前 Bridge 必须处于运行状态（连接中心可查看）。

### 4.2 方式二：stdio MCP（客户端自动拉起，无需 Token）

如果不想管理 Token，可以让 Cursor 在需要时自动启动 LingBuilder 的本地 MCP 服务。此方式要求 `lingbuilder` 命令可用（安装 LingBuilder 时默认会添加到 PATH；若安装时取消了该选项，见第 11 节常见问题）。

编辑 `C:\Users\<你的用户名>\.cursor\mcp.json`：

```json
{
  "mcpServers": {
    "lingbuilder": {
      "command": "lingbuilder",
      "args": [
        "ai-server",
        "--workspace",
        "D:\\你的项目路径",
        "--permission",
        "preview",
        "--mcp",
        "--stdio-only"
      ]
    }
  }
}
```

说明：

- `--workspace` 填你的 LingBuilder 工作区绝对路径，注意 JSON 中反斜杠要写成 `\\`。
- 此方式不监听网络端口、不需要 Token，由 Cursor 按需启动和停止本地服务。
- 若 `lingbuilder` 不在 PATH，把 `"command": "lingbuilder"` 换成完整路径，例如 `"command": "C:\\Program Files\\LingBuilder\\lingbuilder.cmd"`。

两种方式选其一即可。HTTP 方式适合多个客户端共享同一个运行中的 Bridge；stdio 方式适合单一客户端、零 Token 管理。

## 5. 其它 MCP 客户端的通用配置

大多数支持 MCP 的客户端都使用 `mcpServers` 结构，二选一：

HTTP 形式（先启动 Bridge，需要 Token）：

```json
{
  "mcpServers": {
    "lingbuilder": {
      "url": "http://127.0.0.1:17860/api/ai-bridge/mcp",
      "headers": {
        "Authorization": "Bearer 你的完整Token"
      }
    }
  }
}
```

stdio 形式（客户端自动拉起，无需 Token）：

```json
{
  "mcpServers": {
    "lingbuilder": {
      "command": "lingbuilder",
      "args": ["ai-server", "--workspace", "D:\\你的项目路径", "--permission", "preview", "--mcp", "--stdio-only"]
    }
  }
}
```

常见客户端的 MCP 配置入口：

| 客户端 | 配置位置 |
| --- | --- |
| Cursor | `C:\Users\<用户名>\.cursor\mcp.json`（或项目内 `.cursor\mcp.json`） |
| VS Code（Cline、Roo Code 等扩展） | 扩展的 MCP 设置（`mcpServers` JSON） |
| 其它支持 MCP 的客户端 | 查看该客户端文档中"远程 MCP / Streamable HTTP"或"本地命令 MCP"的配置说明，按上面两种格式套用 |

## 6. 让 AI 帮你配置（可复制提示词）

把下面这段话复制到 Cursor 等客户端的对话里，替换尖括号中的内容，AI 就会按本手册帮你完成配置：

```text
请帮我配置 LingBuilder AI Bridge 的 MCP 连接，并按以下信息操作：

1. 我使用的 AI 客户端是：<例如 Cursor>
2. 我的 LingBuilder 工作区绝对路径是：<例如 D:\Projects\我的项目>
3. 我希望的权限模式是：preview（推荐；只读选 readonly，全自动选 yolo）

配置要求：
- 方式一（HTTP MCP）：我会在 LingBuilder 的"帮助 → AI Bridge 连接中心"启动 Bridge，
  并把 MCP 地址（形如 http://127.0.0.1:17860/api/ai-bridge/mcp）和临时 Token 发给你。
  请把它写入本客户端的 MCP 配置文件，格式为：
  {"mcpServers":{"lingbuilder":{"url":"<MCP地址>","headers":{"Authorization":"Bearer <Token>"}}}}
- 方式二（stdio MCP，无需 Token）：若我未提供 Token，请改用命令方式：
  {"mcpServers":{"lingbuilder":{"command":"lingbuilder","args":["ai-server","--workspace","<工作区路径>","--permission","preview","--mcp","--stdio-only"]}}}
  如果 lingbuilder 命令不存在，改用完整路径 C:\Program Files\LingBuilder\lingbuilder.cmd。

配置完成后：
- 告诉我需要重启客户端还是刷新 MCP 连接。
- 列出可用的 lingbuilder.* 工具确认连接成功。
- 之后帮我开发 LingBuilder 项目时，优先使用这些 MCP 工具读写文件和执行诊断，
  而不是直接猜测文件内容。

安全注意：Token 是本机私密凭据，只能写入本机的客户端配置文件，禁止发送到任何远程服务或聊天内容里。
```

提示词中提到的 MCP 工具清单见第 8 节。

## 7. 权限模式

| 模式 | 读取/搜索/诊断 | 生成修改提案 | 写文件/导出/构建运行 |
| --- | --- | --- | --- |
| `readonly` 只读 | 允许 | 允许 | 禁止 |
| `preview` 预览确认（推荐） | 允许 | 允许 | 每次写入前需要确认 |
| `yolo` 全自动 | 允许 | 允许 | 自动执行受控操作 |

- 推荐日常使用 `preview`：AI 只能先给出修改预览，你确认后才真正写入。
- `yolo` 适合你完全信任的本机自动化场景；即使如此，AI Bridge 也不会开放任意命令行，只开放 LingBuilder 封装的受控能力。
- 权限在连接中心"高级设置"或启动参数 `--permission` 中指定。

## 8. MCP 工具清单

连接成功后，AI 客户端可以使用以下工具：

| 工具名 | 说明 |
| --- | --- |
| `lingbuilder.workspace.list` | 列出工作区文件树；首项是合成的 workspace 根条目，带 `workspaceRoot`（工作区根绝对路径）与 `ideVersion`（LingBuilder IDE 版本），AI 动手前先读它自省工作区。 |
| `lingbuilder.file.read` | 读取工作区文本文件。 |
| `lingbuilder.file.search` | 搜索工作区文本。 |
| `lingbuilder.lingcpp.diagnostics` | 获取 `.lcpp` 诊断；传 `projectId` 自动加载工作区设计器模型校验控件引用，响应带 `designerContext` 说明校验覆盖范围。 |
| `lingbuilder.edit.propose` | 生成编辑提案；`workspaceFiles` 可省略（服务端自动读取工作区当前内容，磁盘不存在的路径按新建文件处理）。 |
| `lingbuilder.edit.apply` | 应用编辑提案。 |
| `lingbuilder.project.templates` | 列出项目模板。 |
| `lingbuilder.project.create` | 预览或创建项目，并初始化设计器模型和项目级模块引用；`sqlite-crud-window` 模板可直接创建「表单+列表视图+SQLite 增删改查」完整示例。 |
| `lingbuilder.project.create.undo` | 撤销尚未被修改的 AI 创建项目。 |
| `lingbuilder.build.run` | 执行受控构建/运行。构建目录与生成源码目录跟随项目/工作区自定义模板（见 `buildPathService.ts`），缺省 `.lingbuilder-build/<项目>/<平台>/<配置>` 与 `generated/cpp/<项目>`。 |
| `lingbuilder.modules.list` | 按摘要列出模块与项目启用模块（只含命令数、文档路径等概要，避免超长响应）。 |
| `lingbuilder.module.info` | 查询单个模块的完整命令签名、逐参数中文说明、返回值、示例和文档路径；`query` 过滤、`includeAdvanced` 展开高级命令。 |
| `lingbuilder.build.stop` | 停止指定项目的受控运行进程（只影响 AI Bridge 自己启动的进程）。 |
| `lingbuilder.run.wait` | 等待受控运行进程退出并返回退出码；超时默认 30 秒、上限 600 秒。 |
| `lingbuilder.run.log` | 读取最近一次受控运行的控制台输出，`tailLines` 只取末尾 N 行；进程退出后仍可读。 |
| `lingbuilder.native.preview` | 预览 C++ 工程。 |
| `lingbuilder.native.export` | 导出 C++ 工程。 |
| `lingbuilder.module.scaffold` | 在 `.lingbuilder/module-build` 下创建模块骨架（manifest v2 + C++ 模板），受权限模式控制。 |
| `lingbuilder.module.writeFiles` | 把完整模块文件写入 `.lingbuilder/module-build`（必须含根目录 `lingbuilder.module.json`），复用导入校验与限额。 |
| `lingbuilder.module.validate` | 校验模块目录（清单、binding、文档与示例），返回中文诊断。 |
| `lingbuilder.module.pack` | 把校验通过的模块目录打包为 `.lingbuilder/module-packages/*.lbmod`，受权限模式控制。 |
| `lingbuilder.module.installPreview` | 预览模块包（解压校验，不安装），返回 `previewId` 与诊断。 |
| `lingbuilder.module.install` | 安装已预览的模块包并可启用到项目；必须传 `previewId`，受权限模式控制。 |

模块端到端推荐链路：`module.scaffold`（可选，骨架参考）→ `module.writeFiles`（完整文件）→ `module.validate` → `module.pack` → `module.installPreview` → `module.install`（`preview` 权限下写操作需 `approved=true`；安装必须先预览）。

## 9. HTTP API 参考（进阶）

供脚本、自研客户端或不想用 MCP 的用户使用。基础地址在连接中心"HTTP API"一行复制。

所有请求必须携带 `Authorization: Bearer <Token>` 请求头。PowerShell 示例：

```powershell
$token = "你的完整Token"
$base = "http://127.0.0.1:17860/api/ai-bridge"
Invoke-RestMethod -Uri "$base/health" -Headers @{ Authorization = "Bearer $token" }
```

接口一览：

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/health` | GET | 健康检查；响应带 `ideVersion`（当前 LingBuilder IDE 版本）。 |
| `/workspace/tree` | GET | 列出工作区文件树。 |
| `/files/read` | POST | 读取文件，请求体 `{"filePath":"src/游戏主窗体.lcpp"}`。 |
| `/files/search` | POST | 搜索文本，请求体 `{"query":"信息框","include":["src"],"maxResults":50}`。 |
| `/diagnostics/lingcpp` | POST | 获取 `.lcpp` 诊断，可传 `filePath` 加 `sourceCode` 诊断未保存内容。 |
| `/edit/propose` | POST | 生成编辑提案，请求体含 `filePath` 和 `instruction`。 |
| `/edit/apply` | POST | 应用提案，`preview` 模式必须传 `{"proposalId":"...","approved":true}`。 |
| `/modules` | GET | 查看模块上下文。 |
| `/project/templates` | GET | 列出项目模板。 |
| `/project/create` | POST | 预览或创建项目，写入需 `approved: true`。 |
| `/project/create/undo` | POST | 撤销未修改的创建事务，需 `receiptId` 和 `approved: true`。 |
| `/native/preview` | POST | 预览 C++ 工程，传入完整设计器项目模型。 |
| `/native/export` | POST | 导出 C++ 工程，`preview` 模式需 `approved: true`。 |
| `/build/run` | POST | 构建并可选运行，`preview` 模式需 `approved: true`。 |

读取文件示例：

```powershell
Invoke-RestMethod `
  -Uri "$base/files/read" `
  -Method Post `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body '{"filePath":"src/游戏主窗体.lcpp"}'
```

导出的 C++ 工程位于工作区的 `generated/cpp/<项目ID>/` 目录，包含 `.sln`、`.vcxproj` 和全部源码，可直接用 Visual Studio 打开。启用 `new_emoji` 等原生模块时建议使用 Visual Studio 2022 或 Visual Studio Build Tools 编译。

## 10. 命令行进阶（可选）

安装 LingBuilder 后，若安装时保留了"将 LingBuilder CLI 添加到 PATH"选项，可在终端直接使用 `lingbuilder` 命令（无需安装 Node.js）：

```powershell
lingbuilder --version
lingbuilder doctor
lingbuilder ai-server --workspace "D:\项目\我的LingBuilder工程" --port 17860
```

`ai-server` 常用参数：

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `--workspace` | 当前目录 | 暴露给 AI 客户端的 LingBuilder 工作区根目录。 |
| `--host` | `127.0.0.1` | 监听地址，只允许 `127.0.0.1`、`localhost` 或 `::1`。 |
| `--port` | `17860` | HTTP 服务端口。 |
| `--permission` | `preview` | 权限模式：`readonly`、`preview`、`yolo`。 |
| `--token` | 自动生成 | 访问 HTTP API 与共享 MCP 的 Bearer Token。 |
| `--mcp` | 关闭 | 额外启用传统 MCP stdio 服务。 |
| `--stdio-only` | 关闭 | 必须与 `--mcp` 同用；只运行 STDIO MCP，不监听端口、不需要 Token。 |

启动成功后终端会显示 MCP/HTTP 地址和 Token。其它常用子命令：

```text
lingbuilder doctor                       检查运行环境
lingbuilder auth login                   登录 LingBuilder 系统账号
lingbuilder workspace inspect            输出工作区文件树
lingbuilder project templates            列出项目模板
lingbuilder project build --request <文件> --yes   按请求文件构建项目
```

## 11. 安全须知

- Bridge 只监听本机回环地址，无法被局域网或公网访问；这是设计行为，请勿尝试用端口转发绕过。
- Token 等同于本机项目的访问钥匙：只写入本机配置文件，不要粘贴到网页、聊天记录或发给不可信的客户端。
- 建议保持 `preview` 权限，让 AI 的每次写入都经过你确认。
- 敏感操作会记录在工作区 `.lingbuilder/ai-bridge-log.jsonl` 审计日志中。
- 其它电脑上的 AI 客户端无法连接你本机的 Bridge；需要云端 AI 时请使用 LingBuilder 系统账号内置的系统 AI。

## 12. 常见问题

### 12.1 Cursor 里看不到 lingbuilder 工具

依次检查：

1. LingBuilder 连接中心里 Bridge 是否处于"运行中"（HTTP 方式）。
2. `mcp.json` 中的地址、端口与连接中心显示的是否一致。
3. Token 是否最新——"重新生成 Token"后旧 Token 全部失效，需更新配置。
4. 保存配置后是否重启了 Cursor 或刷新了 MCP 连接。

### 12.2 提示 Token 无效或缺失

确认请求头格式为 `Authorization: Bearer <Token>`（注意 Bearer 后有一个空格），且 Token 与连接中心当前显示的一致。重新复制一次完整 Token 通常可以解决。

### 12.3 端口被占用

在连接中心"高级设置"中换一个端口（如 17861），停止后重新启动 Bridge；同时更新客户端配置中的端口号。

### 12.4 提示无法写入文件

这是 `preview` 权限的正常保护：AI 必须先生成提案，经你确认（调用时传 `approved=true`）后才会写入。需要全自动时切换到 `yolo` 权限并自行承担相应风险。

### 12.5 提示 `lingbuilder` 不是内部或外部命令

说明安装时未勾选 PATH 选项。可重新运行安装程序勾选，或直接使用完整路径：`"C:\Program Files\LingBuilder\lingbuilder.cmd"`。

### 12.6 ChatGPT/Codex 桌面版配置后没有生效

桌面客户端在配置写入前已启动时不会自动加载新配置。请完全退出 ChatGPT/Codex（包括后台进程），重新打开，再回到 LingBuilder 连接中心点"重新检测"。

### 12.7 构建失败

构建 C++ 工程需要本机安装了编译器（推荐 Visual Studio 2022 或 Visual Studio Build Tools；也支持 MinGW g++、LLVM clang++）。启用了原生模块的项目通常需要 MSVC。

### 12.8 其它电脑或远程 AI 连不上

本机 Bridge 只允许本机连接。远程场景请使用 LingBuilder 系统账号的云端系统 AI，或将项目文件复制到对方环境。
