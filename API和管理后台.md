# LingBuilder API 和管理后台

本文档固定记录 LingBuilder 云端 API、收费模块商业系统、官网内容系统、管理后台的位置、启动方式和发布边界，避免后续开发时遗忘。最后核对日期：2026-07-31。

## 1. 工程位置

| 能力 | 位置 |
| --- | --- |
| 云端 API 工程 | `cloud/api/` |
| 收费模块用户接口 | `cloud/api/src/modules/module-commerce.controller.ts` |
| 商品、订单、权益、限免和 Permit 服务 | `cloud/api/src/modules/module-commerce.service.ts` |
| 支付适配器 | `cloud/api/src/modules/payment-provider.service.ts` |
| 收费模块制品服务 | `cloud/api/src/modules/module-artifact.service.ts` |
| 收费模块管理员接口 | `cloud/api/src/modules/module-admin.controller.ts` |
| Prisma 数据模型 | `cloud/api/prisma/schema.prisma` |
| 收费模块数据库迁移 | `cloud/api/prisma/migrations/202607270001_module_commerce/`、`202607310002_module_artifacts/` |
| 管理后台工程 | `cloud/admin/` |
| 软件信息首页 | `cloud/admin/src/HomePage.tsx`，公开路径 `/` |
| 官网文档与资源页面 | `cloud/admin/src/WebsitePortal.tsx`，公开路径 `/commands`、`/downloads`、`/docs/*`、`/demos`、`/community` |
| 官网内容管理页面 | `cloud/admin/src/WebsiteContentAdmin.tsx`，管理后台“官网内容” |
| 官网内容 API | `cloud/api/src/website/website-content.controller.ts` |
| 官网内容服务 | `cloud/api/src/website/website-content.service.ts` |
| 官网内容数据库迁移 | `cloud/api/prisma/migrations/202607310001_website_content/migration.sql` |
| 系统 AI 供应商配置页 | `cloud/admin/src/SystemAiProviderAdmin.tsx` |
| 系统 AI 供应商服务 | `cloud/api/src/ai/system-ai-provider.service.ts` |
| 收费模块管理页面 | `cloud/admin/src/ModuleCommerceAdmin.tsx` |
| IDE、CLI、API、后台共享协议 | `packages/contracts/src/index.ts` |
| Electron 云端账号客户端 | `electron/electron/cloudAccountService.ts` |
| Electron 收费模块 IPC | `electron/electron/main.ts` 中的 `cloud-modules:*` |
| IDE 本地 Permit 校验 | `electron/src/services/modules/moduleAccessService.ts` |

## 2. 默认开发地址

- 云端 API：`http://127.0.0.1:17900`
- API 健康检查：`http://127.0.0.1:17900/health`
- Swagger 接口文档：`http://127.0.0.1:17900/docs`
- 软件信息首页：`http://127.0.0.1:17901/`
- 管理后台：`http://127.0.0.1:17901/admin`
- Mailpit 测试邮箱：`http://127.0.0.1:8029`
- PostgreSQL 开发端口：`54329`
- Redis 开发端口：`6389`

Electron 开发版读取环境变量 `LINGBUILDER_CLOUD_API_URL`，未配置时连接 `http://127.0.0.1:17900`；安装版读取打包时生成的 `cloud-release.json`。联网发布只接受 HTTPS；域名或服务器尚未就绪时，可用 `LINGBUILDER_CLOUD_RELEASE_MODE=offline` 生成明确不连接云端的离线版，不得填入虚假公网地址。管理后台读取 `VITE_CLOUD_API_URL`；未配置时连接本机 `17900`。

门户备案边界：公开首页和 `/commands`、`/downloads`、`/docs/*`、`/demos`、`/community` 不展示 NewEmoji 商品详情、价格、购买、订单或普通用户注册登录。商品和订单只在 IDE 登录态与 `/admin` 管理后台中出现；匿名模块商品目录接口已删除。

管理后台“系统 AI 供应商”支持 DeepSeek V4 预设和自定义供应商。DeepSeek 预设会同时建立 `deepseek-v4-flash`、`deepseek-v4-pro` 两条模型路由；自定义供应商可填写 Base URL、Model Name 和 API Key，并选择 OpenAI 兼容协议或 Anthropic Messages 协议。API Key 使用云端 Secret Vault 加密保存，列表和编辑接口只返回“已配置”状态，不回传明文。

### 官网内容接口

- `GET /v1/site/bootstrap`：公开读取已发布的下载版本、教程、Demo 和已启用交流群。
- `GET /v1/site/commands`：公开查询命令资料，支持关键词、类型、分类、模块和生命周期筛选。
- `GET /v1/site/guides/:slug`：公开读取单篇已发布教程。
- `GET /v1/admin/site`：管理员读取官网全部草稿和已发布内容。
- `POST /v1/admin/site/downloads`、`download-mirrors`、`community-groups`、`guides`、`demos`、`commands`：管理员新增或更新对应内容。
- `POST /v1/admin/site/commands/sync-manifest`：从 `.lbmod` v2 manifest 的 `contributes.commands` 和 `bindings.commands` 同步命令资料。

官网公开接口不要求登录；所有管理员写入接口继续使用现有管理员角色、MFA 和审计日志。公开页面只显示 `PUBLISHED` 内容，下载镜像和 QQ 群还会检查各自的启用状态。

内置模块命令清单可在 `electron/` 下运行 `npm run module:web-docs`，默认生成 `.lingbuilder/website-command-manifests.json`；在后台“官网内容 → 命令资料”导入该文件即可批量同步。模块 ID 与命令名组成稳定键，重新导入会更新原词条，当前清单中已删除的旧命令会标记为 `DEPRECATED`。

## 3. 本地开发启动

要求：Node.js 20+、Docker Desktop、可用的 PostgreSQL 和 Redis。

首次启动在项目根目录执行：

```powershell
docker compose up -d postgres redis mailpit
Copy-Item .env.example .env
npm install
npm run db:generate
npm run db:migrate
npm run dev:cloud
```

`cloud/api/package.json` 的开发、启动、Prisma 和管理员初始化命令会自动读取根目录 `.env` 与 `.env.local`。已经存在 `.env` 时不要用 `Copy-Item` 覆盖。

启动全部 IDE、API 和后台：

```powershell
npm run dev
```

只启动 API 和管理后台：

```powershell
npm run dev:cloud
```

首次创建管理员：

```powershell
npm run admin:bootstrap -w @lingbuilder/cloud-api -- admin@example.com StrongPassword123
```

首次管理员登录必须绑定 TOTP MFA。测试用户必须先注册、完成邮箱验证并登录，才能使用收费模块的购买权益或限时免费权益。

## 4. new_emoji 收费模块配置流程

1. 启动 PostgreSQL、Redis、云端 API 和管理后台。
2. 执行数据库迁移，确保 `ModuleProduct`、`ModuleOffer`、`ModuleOrder`、`ModuleEntitlement`、`ModuleFreeWindow` 等表存在。
3. 创建管理员并登录 `http://127.0.0.1:17901/admin`。
4. 在“收费模块”页面确认商品 `lingbuilder.new_emoji.ui` 已上架。
5. 配置永久买断或固定期限报价，或者建立未来开始的 24 小时免费窗口。
6. 注册普通用户、验证邮箱，并在 LingBuilder IDE 中登录该用户。
7. 用户拥有购买权益、管理员赠送权益或正处于限免窗口时，IDE 才能取得签名 Permit 并启用模块。

未登录、API 未启动、没有权益、限免结束或 Permit 无效时，IDE 必须显示中文原因，不能显示 Electron 的 `Error invoking remote method` 或 Node.js 的 `TypeError: fetch failed`。

## 5. 当前开发环境是否可以运行

### 代码状态

可以构建和测试。当前已经通过：

- Electron TypeScript lint。
- Electron 生产构建。
- 云端 API lint、测试和构建。
- 管理后台 lint 和构建。
- Prisma Client 生成。
- 收费模块 Permit、模块接口和授权错误中文化测试。

### 当前这台电脑的实际运行状态

截至 2026-07-27，本机开发云端已经启动并完成真实授权验证：

- 根目录已有被 Git 忽略的本机开发 `.env`；其中密钥只能用于开发，不能带到生产环境。
- Docker Desktop Linux 引擎正常，`postgres`、`redis`、`mailpit` 三个容器均为健康状态。
- Prisma Client 已生成，数据库迁移 `202607270001_module_commerce` 已应用。
- 云端 API 正在监听 `127.0.0.1:17900`，`/health` 已同时通过数据库与 Redis 检查。
- 管理后台正在监听 `127.0.0.1:17901`，HTTP 状态为 200。
- `lingbuilder.new_emoji.ui` 已建立本机开发 24 小时限免窗口，区间为 2026-07-27 16:45 至 2026-07-28 16:45（Asia/Shanghai）。
- 已使用本机测试账号 `local-dev-newemoji@lingbuilder.test` 完成注册、邮箱验证、登录、模块目录查询、限免授权判断和签名 Permit 签发。
- 为避免 24 小时限免结束后阻断本机开发，该测试账号还拥有永久的开发环境管理员授权；最终访问来源为 `admin_grant`，并保持“收费模块必须绑定已登录账号”的约束。

### 本机 new_emoji 测试账号

> 下面的账号和密码只用于当前电脑的本地开发数据库，禁止复制到生产环境或作为正式用户凭据。

```text
邮箱：local-dev-newemoji@lingbuilder.test
密码：LingBuilderDev2026!
```

该账号已经完成邮箱验证，并绑定了 `lingbuilder.new_emoji.ui` 的永久开发授权。最终端到端检查结果：

- 云端健康检查：通过。
- new_emoji 访问判断：允许。
- 用户绑定授权来源：`admin_grant`。
- Ed25519 签名 Permit：签发成功。
- 验证时签发的 Permit 到期时间：2026-07-30 16:49（Asia/Shanghai）；以后重新签发的 Permit 按签发时间顺延，单次最长离线 72 小时。

### 在 IDE 中启用 new_emoji

1. 重启一次 LingBuilder，确保主进程加载最新的中文错误处理和云端连接代码。
2. 打开“AI 助手 → 系统 AI”。
3. 使用上面的本机测试账号登录。
4. 打开“模块”页面并点击“刷新”。
5. 点击 new_emoji 模块的“启用”。

永久开发授权只存在于当前本机数据库，24 小时限免结束后该测试账号仍可使用 new_emoji。Permit 到期时保持联网并重新点击一次“启用”，即可取得新的 72 小时 Permit。如果 API 进程重启，由于开发环境当前使用临时 Permit 密钥，也需要重新点击一次“启用”。

开发启动日志保存在 `.lingbuilder/cloud-dev/stdout.log` 和 `.lingbuilder/cloud-dev/stderr.log`。本次还修正了两项会让“端口已启动但实际不可用”的问题：管理后台显式绑定 `127.0.0.1`；Nest 服务使用显式依赖注入，使 `tsx` 开发启动方式下认证、商品和授权接口能够正常工作。

## 6. 打包为安装包后能否给其他用户运行

### 基础 IDE

基础 IDE、本地编辑器、普通 Win32 模块、项目管理、构建和不依赖云端的功能可以随 Electron 安装包运行。Electron 打包入口为：

```powershell
cd electron
npm run package:win
```

### 账号、收费和 new_emoji 授权

代码链路已经完成：

1. 管理后台可查询订单、按邮箱赠送权益、填写原因撤销权益，并查看微信/支付宝生产配置就绪状态。
2. 微信使用 API v3 Native 下单、RSA-SHA256 请求签名、平台公钥响应/回调验签和 API v3 AES-GCM 回调解密；支付宝使用 `alipay.trade.precreate`、RSA2 请求/同步响应/异步通知验签。IDE 在本地生成付款二维码，不把支付地址发送给第三方二维码服务。
3. 管理后台可上传 `.lbmod`。云端校验 ZIP 路径和 v2 manifest 的模块 ID/版本，计算 SHA-256，并使用稳定 Ed25519 Permit 密钥签署制品元数据；制品存放在非公开持久化目录。
4. IDE 只有登录且拥有权益时才能取得制品元数据和下载流；下载前校验签名密钥标识和元数据签名，下载后校验文件大小与 SHA-256，再进入既有的安装预览、升级快照和确认安装流程。
5. Electron Builder 明确排除 `lingbuilder.new_emoji.ui`；联网打包命令要求 `LINGBUILDER_CLOUD_API_URL` 为 HTTPS，并把地址写入安装包 `cloud-release.json`。备案或云端未就绪时可显式选择 `offline`，此时系统 AI、账号和收费模块暂不可用，也不会回退连接用户本机。
6. 生产 API 缺少稳定 Permit 密钥、持久化制品目录、公网 HTTPS 地址或任一官方支付配置时会启动失败，不会带着临时密钥或模拟网关上线。

仍需部署方提供的外部条件：真实域名和 HTTPS 证书、PostgreSQL/Redis/SMTP、微信与支付宝商户凭据、稳定 Ed25519 密钥、持久化制品磁盘，以及正式商户沙箱/小额支付与退款验收。仓库不能代替商户平台开通、ICP备案变更或服务器部署。

## 7. 正式发布前检查清单

- [ ] 部署 PostgreSQL、Redis、SMTP 和云端 API。
- [ ] 为 API 和管理后台配置 HTTPS 域名。
- [x] 联网打包强制固定 HTTPS `LINGBUILDER_CLOUD_API_URL`；离线打包必须显式设置 `LINGBUILDER_CLOUD_RELEASE_MODE=offline`，两种安装版都不回退用户本机 `17900`。
- [ ] 固定管理后台 `VITE_CLOUD_API_URL`。
- [ ] 配置稳定 Ed25519 Permit 公私钥。
- [ ] 配置 JWT、Token Hash、Secret Vault 等生产密钥。
- [x] 代码接入微信支付 API v3 Native、支付宝当面付和官方签名/Webhook 验证；待真实商户验收。
- [x] 从公开安装包排除 NewEmoji 收费模块二进制。
- [x] 实现授权后的模块下载、签名校验、安装和更新预览。
- [ ] 验证匿名、未验证邮箱、未购买、已购买、限免、退款、封禁、离线 72 小时和时钟回拨。
- [ ] 验证 Renderer、Local API 和 AI Bridge 均不能绕过授权。
- [ ] 完成 NSIS 安装包、升级、卸载和不同 Windows 账号的真实机器测试。
