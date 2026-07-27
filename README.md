# LingBuilder 中文集成开发环境

LingBuilder 是面向中文用户的中文 C++ / `.lcpp` 集成开发环境。仓库同时包含 Electron IDE、本地 AI Bridge、系统 AI 云端 API、AI 点数计费服务和独立管理后台。

LingBuilder 解决方案使用工作区根目录下的 `.lbsln` 文件作为可见入口。双击、拖入或在 IDE 中选择该文件即可打开解决方案；`.lingbuilder/solution.json` 保存内部完整状态，二者由解决方案服务自动同步。导出目录中的 `.sln` 仍是供 Visual Studio 使用的标准 C++ 解决方案，不能与 `.lbsln` 混用。

## LCPP 源码分享

- 文件菜单、命令面板或解决方案资源管理器项目右键菜单可执行“一键导出 LCPP 源码包”，生成单文件 `.lcpppkg`。
- 源码包会携带所选项目及其项目引用、`.lcpp`、配置、窗口设计器模型、`assets` 资源、模块锁定信息、已启用第三方模块和离线资产模块。
- 接收者可双击、拖入或通过“打开 LCPP 源码包”选择该文件。LingBuilder 会校验 SHA-256 完整性并导入到“文档/LingBuilder/已导入源码”的独立工作区，然后直接打开。
- `.env`、私钥、证书和常见凭据 JSON 默认不会进入源码包；导出结果会给出排除提示。导入不会覆盖当前项目，也不会把第三方模块安装到其他工作区。

## 工程目录

- `electron/`：桌面 IDE、本地工作区服务、CLI 和 AI Bridge。
- `cloud/api/`：NestJS 云端账号、计费、促销、模型路由和系统 AI Gateway。
- `cloud/admin/`：React/Vite AI 运营管理后台。
- `packages/contracts/`：IDE、CLI、云端和后台共享的公开协议。

云端服务不会替代本地确定性规则。系统 AI 只能返回文本或完整文件编辑草稿，最终诊断、Diff、确认和写入仍由本地 IDE 完成。

## 本地开发

要求 Node.js 20+、PostgreSQL 17 和 Redis 7。安装 Docker 后可直接启动依赖：

```powershell
docker compose up -d postgres redis mailpit
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev
```

默认地址：

- 云端 API：`http://127.0.0.1:17900`
- Swagger：`http://127.0.0.1:17900/docs`
- 管理后台：`http://127.0.0.1:17901`
- Mailpit：`http://127.0.0.1:8029`

首次管理员：

```powershell
npm run admin:bootstrap -w @lingbuilder/cloud-api -- admin@example.com StrongPassword123
```

首次登录必须绑定 TOTP MFA。生产环境必须替换 `.env.example` 中全部密钥，并通过部署 Secret 注入。

## 系统 AI 与 BYOK

IDE 的 AI 面板提供两种互相隔离的模式：

- 系统 AI：登录 LingBuilder 账号，使用管理员发布的逻辑模型和 AI 点数。
- 自定义 API：继续使用用户自己的 API Key、Base URL 和模型。

系统 AI 默认零保留：源码和提示词只在请求内存中处理，不进入数据库、用量表或日志。云端只记录模型别名、Token、点数、成本、状态和错误码。

OpenAI-compatible 思考模型会分别解析推理增量和最终回答；聊天可流式显示推理内容，编辑草稿只解析最终回答。重复幂等键在 SSE 建连前返回 HTTP 409；取消请求按包含规则手册的完整上下文估算 Token、点数和供应商成本，中文/CJK 与 ASCII 使用不同的保守估算比例。

## CLI

Windows 安装向导默认将 LingBuilder 安装目录加入当前用户 PATH；安装后重新打开终端即可使用，无需另外安装 Node.js。安装时可取消该选项，卸载时会清理 LingBuilder 的 PATH 项。

安装版 IDE 可从“帮助 → AI Bridge 连接中心”直接启动本机 Bridge。连接中心提供 Bridge 状态、权限与生命周期设置、共享 MCP/HTTP 地址、客户端与工具调用活动，并检测 Codex CLI、Claude Code、Gemini CLI；点击“连接并打开”即可在 IDE 集成终端接入当前工作区。临时 Token 只注入该终端进程，不写入用户或项目配置。CLI 自检、命令示例和完整手册也保留在连接中心的“CLI 工具”页。

```powershell
lingbuilder doctor --json
lingbuilder auth login
lingbuilder ai models
lingbuilder ai balance
lingbuilder ai chat --model standard --prompt "解释当前错误"
lingbuilder workspace inspect --workspace . --json
lingbuilder project export --request project-request.json
lingbuilder project build --request project-request.json --yes
lingbuilder ai-server --workspace . --permission preview
```

CLI 刷新令牌使用 Windows DPAPI 保护，不以明文保存。AI Bridge 默认同时开放 REST API 与共享 Streamable HTTP MCP；`--mcp` 仅用于额外启用传统 stdio MCP。Bridge 强制只监听回环地址，外部 AI 通过 Bearer Token 接入，远程 AI 使用云端账号 API。

## 质量门禁

```powershell
npm run lint
npm run test
npm run build
```
