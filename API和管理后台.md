# LingBuilder API 和管理后台

本文档固定记录 LingBuilder 云端 API、收费模块商业系统、管理后台的位置、启动方式和发布边界，避免后续开发时遗忘。最后核对日期：2026-07-27。

## 1. 工程位置

| 能力 | 位置 |
| --- | --- |
| 云端 API 工程 | `cloud/api/` |
| 收费模块用户接口 | `cloud/api/src/modules/module-commerce.controller.ts` |
| 商品、订单、权益、限免和 Permit 服务 | `cloud/api/src/modules/module-commerce.service.ts` |
| 支付适配器 | `cloud/api/src/modules/payment-provider.service.ts` |
| 收费模块管理员接口 | `cloud/api/src/modules/module-admin.controller.ts` |
| Prisma 数据模型 | `cloud/api/prisma/schema.prisma` |
| 收费模块数据库迁移 | `cloud/api/prisma/migrations/202607270001_module_commerce/migration.sql` |
| 管理后台工程 | `cloud/admin/` |
| 收费模块管理页面 | `cloud/admin/src/main.tsx` 中的 `ModuleCommerceAdmin` |
| IDE、CLI、API、后台共享协议 | `packages/contracts/src/index.ts` |
| Electron 云端账号客户端 | `electron/electron/cloudAccountService.ts` |
| Electron 收费模块 IPC | `electron/electron/main.ts` 中的 `cloud-modules:*` |
| IDE 本地 Permit 校验 | `electron/src/services/modules/moduleAccessService.ts` |

## 2. 默认开发地址

- 云端 API：`http://127.0.0.1:17900`
- API 健康检查：`http://127.0.0.1:17900/health`
- Swagger 接口文档：`http://127.0.0.1:17900/docs`
- 管理后台：`http://127.0.0.1:17901`
- Mailpit 测试邮箱：`http://127.0.0.1:8029`
- PostgreSQL 开发端口：`54329`
- Redis 开发端口：`6389`

Electron 默认读取环境变量 `LINGBUILDER_CLOUD_API_URL`；未配置时连接 `http://127.0.0.1:17900`。管理后台读取 `VITE_CLOUD_API_URL`；未配置时同样连接本机 `17900`。

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
3. 创建管理员并登录 `http://127.0.0.1:17901`。
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

当前不能把安装包直接交给其他用户并宣称收费模块可正常使用，存在以下发布阻断项：

1. `cloud/api/` 和 `cloud/admin/` 不会被 Electron Builder 打进安装包。它们本来就应部署在你的服务器，而不是在每位用户电脑上运行。
2. 安装版目前仍默认连接 `http://127.0.0.1:17900`。其他用户电脑通常没有本地 LingBuilder 云端，因此登录、购买、限免和 Permit 获取都会失败。
3. 发布前必须部署一个公网 HTTPS 云端 API，并在构建或部署配置中把 `LINGBUILDER_CLOUD_API_URL` 指向正式地址。不能要求普通用户自行配置环境变量。
4. 管理后台也要独立部署，并用 `VITE_CLOUD_API_URL` 指向正式 API；管理后台不能公开给普通用户，必须保留管理员角色和 MFA。
5. 当前 Electron Builder 的 `extraResources` 会把整个 `.lingbuilder/modules` 复制到安装包的默认工作区，其中包含收费模块二进制。这与“收费模块取得权益后才能下载”的发布要求不一致。正式发布前必须从公开安装包排除 new_emoji 二进制，改为登录并授权后从受保护下载接口安装。
6. Permit 正式环境必须配置稳定的 `MODULE_PERMIT_PRIVATE_KEY_PEM` 和 `MODULE_PERMIT_PUBLIC_KEY_PEM`。当前未配置时会在 API 进程启动时临时生成密钥，服务重启后旧 Permit 会全部失效。
7. `.env.example` 当前还没有列出 Permit、微信支付、支付宝和正式云端地址配置；正式部署前必须补齐部署模板和 Secret 管理。
8. 微信支付和支付宝当前是带签名的外部支付网关适配器，并非已经完成两家官方商户 SDK 的生产直连。缺少真实网关和 Webhook 密钥时，系统会拒绝模拟支付成功；开发期可使用管理员手工授权或限免测试。
9. 必须在正式域名、正式数据库、Redis、SMTP、支付沙箱和 HTTPS 环境中完成端到端测试，不能只以本机单元测试作为上线依据。

因此当前结论是：

- 本地开发：配置依赖和环境变量后可以运行。
- 普通 Electron 安装包：基础 IDE 可以运行。
- 给其他用户使用账号、收费和 new_emoji：当前尚不能直接发布，必须先完成正式云端部署、安装包 API 地址配置、收费模块受保护下载和稳定 Permit 密钥。

## 7. 正式发布前检查清单

- [ ] 部署 PostgreSQL、Redis、SMTP 和云端 API。
- [ ] 为 API 和管理后台配置 HTTPS 域名。
- [ ] 固定生产 `LINGBUILDER_CLOUD_API_URL`，安装版不再回退用户本机 `17900`。
- [ ] 固定管理后台 `VITE_CLOUD_API_URL`。
- [ ] 配置稳定 Ed25519 Permit 公私钥。
- [ ] 配置 JWT、Token Hash、Secret Vault 等生产密钥。
- [ ] 接入并验证微信支付、支付宝商户网关和 Webhook。
- [ ] 从公开安装包排除收费模块二进制。
- [ ] 实现授权后的模块下载、签名校验、安装和更新。
- [ ] 验证匿名、未验证邮箱、未购买、已购买、限免、退款、封禁、离线 72 小时和时钟回拨。
- [ ] 验证 Renderer、Local API 和 AI Bridge 均不能绕过授权。
- [ ] 完成 NSIS 安装包、升级、卸载和不同 Windows 账号的真实机器测试。
