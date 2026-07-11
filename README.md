# LingBuilder 中文集成开发环境

LingBuilder 是面向中文用户的中文 C++ / `.lcpp` 集成开发环境。仓库同时包含 Electron IDE、本地 AI Bridge、系统 AI 云端 API、AI 点数计费服务和独立管理后台。

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

```powershell
lingbuilder doctor --json
lingbuilder auth login
lingbuilder ai models
lingbuilder ai balance
lingbuilder ai chat --model standard --prompt "解释当前错误"
lingbuilder workspace inspect --workspace . --json
lingbuilder project export --request project-request.json
lingbuilder project build --request project-request.json --yes
lingbuilder ai-server --workspace . --permission preview --mcp
```

CLI 刷新令牌使用 Windows DPAPI 保护，不以明文保存。AI Bridge 强制只监听回环地址；远程 AI 使用云端账号 API。

## 质量门禁

```powershell
npm run lint
npm run test
npm run build
```
