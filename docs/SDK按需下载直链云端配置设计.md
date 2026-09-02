# SDK 按需下载直链云端配置设计（B 档：整条清单可远端替换，Ed25519 签名）

状态：P0–P5 已实施完成（2026-09-01）；P6 模块 Permit 信任根修复经单独审批后已于 2026-09-01 落地并部署生产（锚点钉入生产密钥 `0e2853e87a4250d3`）。SDK 清单信任锚已钉入生产公钥 keyId `450c46062258e2d4`（2026-09-01，线上 sequence 2 清单已通过门禁与 IDE 端到端验签），随下次 IDE 发版启用远端清单。
定稿日期：2026-09-01
关联文档：`docs/FBro与CEF3_SDK按需下载资源.md`（现有直链与下载约束，维护者向）、`docs/SDK下载清单发布流程.md`（维护者向发布流程）、`docs/MODULE_ECOSYSTEM_IMPLEMENTATION.md`（模块签名现状）

## 1. 背景与现状

- SDK 按需下载清单（下载 URL、字节数、SHA-256、criticalFiles 等）硬编码在 `electron/src/services/sdkDependencies/sdkDependencyCatalog.ts`（CEF3 直链 :31、FBro 直链 :55），每次换直链都必须发 IDE 版本。
- 服务层已预留注入缝：`SdkDependencyService` 构造参数 `options.resources`（`electron/src/services/sdkDependencies/sdkDependencyService.ts:150`），`electron/server.ts:226-231` 当前未传，仍用内置清单。
- 下载链路已有完整纵深防御：强制 HTTPS、无重定向 HEAD 预检、aria2c 多连接、下载完成整包 SHA-256、解压后 criticalFiles 校验、临时目录原子切换。本方案只替换「清单数据来源」，不改动这些校验代码路径。
- 下载域名 `msimgimg.xyz` 本就是自有 R2 自定义域名（桶 `462030`），上传通道为 Worker `https://upload.msimgimg.xyz`，管理后台「直链上传」已打通；不存在「从第三方图床迁移」的问题。
- 管理后台目前不能修改 SDK 直链：无页面、无接口、云端不知晓清单内容。

## 2. P0 复核结论（2026-09-01，已完成）

对两条生产直链按 `docs/FBro与CEF3_SDK按需下载资源.md` 的同一口径复核（HEAD 200 / Range 206 / 首尾 1 MiB 逐字节哈希）：

| 检查项 | CEF3 | FBro |
| --- | --- | --- |
| 本地源包 SHA-256 与文档一致 | `b984477a…dc55` ✓ | `99ed17b2…361f` ✓ |
| HEAD 200 / Content-Length 精确一致 | 186,457,476 ✓ | 245,575,922 ✓ |
| `Accept-Ranges` / Range 206 + `Content-Range` | ✓ | ✓ |
| 首 1 MiB 哈希与本地一致 | `ac8519e6…` ✓ | `66ed55d7…` ✓ |
| 尾 1 MiB 哈希与本地一致 | `5f9e3d27…` ✓ | `ff6fffe9…` ✓ |
| Last-Modified 未变 | 2026-08-13 15:15:47 GMT | 2026-08-13 15:25:19 GMT |

- 结论：直链、字节流、哈希链与清单完全一致，**无需重传、无需迁移**，P0 完成。
- 与 2026-08-13 原始验证口径一致（该线路整包下载吞吐过低，整包校验由 IDE 下载后 SHA-256 兜底）；本次新增 Last-Modified 未变的旁证。
- 线路备注：本机直连 `msimgimg.xyz` 仍会间歇性连接超时（curl 28），`--retry` 后成功，与文档「代理与失败诊断」一节相符——进一步支撑 P4 诊断与发布门禁的价值。

## 3. 目标与非目标

目标：

1. 管理后台可发布新版 SDK 下载清单（换 URL / 大小 / SHA-256 / 版本号），IDE 无需发版即可跟随。
2. 清单整条 Ed25519 签名，信任锚固化在 IDE 二进制内；云端被攻陷也无法伪造清单、削弱校验或把下载指到任意地址。
3. 回滚防护（sequence 单调递增）与整条接受（whole-or-nothing，绝不部分应用）。
4. 任何校验失败自动回退内置清单，F5 构建与 SDK 安装永不因清单问题被卡死。

非目标：

- 不做按字段灰度、不做多渠道清单（v1 只有「最新一条」）。
- 不改动下载器本体（aria2、整包 SHA-256、criticalFiles 校验逻辑均保持不变）。
- 不允许远端修改锚定字段（见 §5.2）。

## 4. 信任模型与安全边界

### 4.1 信任锚固化在 IDE 二进制

- Ed25519 公钥与 keyId 硬编码在 `electron/src/services/sdkDependencies/catalogTrustAnchors.ts`（新增）；云端只持有私钥，**永不下发任何公钥**。
- 测试需要换密钥时走服务构造参数注入，不走环境变量、不走配置文件——生产进程没有任何换根通道。
- 这条是硬边界，原因：现有模块 Permit 的信任根由服务端下发 PEM（`electron/electron/cloudAccountService.ts:33` → `electron/src/services/modules/moduleAccessService.ts:39-40` 只校验算法与 keyId 格式），服务端可整体换根。该缺陷已单列 P6（需单独审批），本方案绝不复制该模式。

### 4.2 其他边界

- 签名覆盖整条 payload 字节（含 sequence），不做字段级签名，避免 JSON 规范化歧义。
- sequence 单调递增并持久化于 IDE 本地（`userData/sdk-catalog-state.json`），低于已接受值的清单整条拒绝（防回滚/重放）。
- IDE 侧 https-only、无重定向 HEAD 预检、整包 SHA-256、criticalFiles 校验全部保留——清单只是数据来源变化，不放松任何既有校验。
- 清单托管在云端 API（`https://api.lingbuilder.com`，自有服务器），不依赖 Cloudflare 路由；SDK 包本体仍走 R2 + aria2。

## 5. 清单格式与字段边界

### 5.1 信封

```json
{
  "payload": "<单行 JSON 字符串>",
  "keyId": "<SHA-256(SPKI DER) 前 16 hex>",
  "signature": "<base64 Ed25519>",
  "publishedAt": "<ISO-8601>"
}
```

- `payload` 是整段 JSON 字符串；签名输入 = `"lingbuilder-sdk-catalog-v1\n"` + payload 的 UTF-8 字节（与模块签名的域分隔惯例一致）。验签直接对字节串进行，不重新序列化。
- `payload` 内部结构：

```json
{
  "schemaVersion": 1,
  "sequence": 12,
  "resources": ["…资源数组，结构同 SdkDependencyResource…"]
}
```

- IDE 以 payload 内的 `sequence` 为准；信封字段仅作展示。

### 5.2 字段边界（每条资源）

| 字段 | 类别 | 说明 |
| --- | --- | --- |
| `id` / `moduleId` / `name` / `platform` / `requiredModuleIds` / `criticalFiles` | 锚定 | 远端必须逐字回显，与内置清单深度相等，否则整条拒绝。保护 `requireForModules`（防止远端清单让所有 F5 构建卡死）与解压后校验强度 |
| `version` / `sdkVersion` / `archiveName` / `downloadUrl` / `archiveBytes` / `sha256` / `fileCount` / `expandedBytes` | 远端可更新 | 管理后台可改；IDE 校验 `downloadUrl` 必须 https、`sha256` 为 64 位 hex、`archiveBytes` 为正整数 |

- 合并语义：锚定字段取内置值，可更新字段取远端值；id 集合必须与内置完全一致（缺失、多余、重复均整条拒绝）。

## 6. 云端设计（cloud/api）

### 6.1 数据模型（Prisma，只追加不修改）

```prisma
model SdkCatalogRelease {
  id         String   @id @default(cuid())
  sequence   Int      @unique
  payload    String
  keyId      String
  signature  String
  note       String?
  createdBy  String
  createdAt  DateTime @default(now())
}
```

### 6.2 签名

- 独立 Ed25519 密钥，环境变量 `SDK_CATALOG_PRIVATE_KEY_PEM` + `SDK_CATALOG_PUBLIC_KEY_PEM`（实施偏差：原设计为单变量 `SDK_CATALOG_SIGNING_KEY_PEM`，实际实现为**配对变量**——两者都设置才生效，公钥与私钥不匹配直接抛错；生产缺钥返回 503 `SDK_CATALOG_SIGNING_UNAVAILABLE`；开发环境未配置时回退临时 `generateKeyPairSync('ed25519')`，缓存按 persistent/`ephemeral:${NODE_ENV}` 分桶防测试串钥），与模块签名密钥分开，可独立轮换。
- keyId 沿用现有推导：SHA-256(SPKI DER) 前 16 hex（与 `cloud/api/src/modules/module-signing-key.ts` 同款）。
- 生产环境缺私钥时：`GET /v1/site/sdk-catalog` 与 `POST` 均返回 503、中文错误；**绝不下发未签名清单**。

### 6.3 端点

| 方法 | 路径 | 权限 | 行为 |
| --- | --- | --- | --- |
| GET | `/v1/site/sdk-catalog` | `@Public()` | 返回最新 release（payload / keyId / signature / sequence / publishedAt），`Cache-Control: no-store` |
| POST | `/v1/admin/site/sdk-catalog` | `super_admin` / `operator` | body `{ resources, note }`；服务端校验 schema、https、sha256 格式；sequence = max+1；签名、落库、`this.audit(...)` |
| GET | `/v1/admin/site/sdk-catalog/history` | `super_admin` / `operator` | 当前版本 + 最近 20 条历史 |

- 云端不校验锚定字段内容（云端不知道 IDE 内置值），锚定的唯一仲裁在 IDE；管理后台从上一版 payload 复制锚定字段，UI 标注「锚定字段，必须与最新 IDE 内置清单逐字一致」。
- `packages/contracts` 新增 `SdkCatalogManifest` / `SdkCatalogResource` 类型，云端与 admin 共用。

## 7. IDE 端设计（electron）

### 7.1 新增 `sdkCatalogRemote.ts`（`electron/src/services/sdkDependencies/`）

- `fetchRemoteCatalog(url, signal)`：GET 清单，10s 超时；非 online 云模式或 URL 未配置时直接返回 null（用内置）。
- `verifyAndMergeCatalog(builtin, manifest, anchors, state)`：依次执行 §4/§5 全部校验；任一步失败抛中文错误并由调用方回退内置。
- 验签用 Node 内置 `crypto.verify(null, data, key, signature)`（**实施纠偏：Ed25519 的 sign/verify 第一参数必须是 `null`**，传 `'ed25519'` 会抛 `ERR_CRYPTO_INVALID_DIGEST`；与 `moduleAccessService` 同一套底层用法，不引入新依赖）。
- 锚定字段比对口径（实施确定）：云端契约的 `criticalFiles` 为相对路径字符串列表（`string[]`），IDE 侧锚定比对按 `criticalFiles.map(f => f.relativePath)` 列表逐字比对，内置 `minimumBytes` 校验强度随锚定字段取内置值保留，不受远端影响。
- sequence 状态读写 `userData/sdk-catalog-state.json`（实施：位于用户配置目录，路径由 server.ts 传入，测试用临时目录）；损坏视为「无已接受 sequence」按首次安装处理。
- 发布门禁脚本：`electron/scripts/check-sdk-catalog-anchors.ts`（`npm run sdk-catalog:check`）拉线上清单与内置清单逐字比对锚定字段，漂移或不可用输出中文诊断退出 1（P4）。
- 拉取时机：首次 `overview` / `install` 调用时同步拉取（10s 上限），之后内存缓存 10 分钟；拉取失败立即用缓存或内置，不重试阻塞。

### 7.2 接入点

- `electron/server.ts` 实例化 `SdkDependencyService` 时注入解析后的 resources。
- `/api/sdk-dependencies/status` 响应增加 `catalogSource: 'remote' | 'builtin'` 与 `catalogSequence`，SDK 面板展示。
- 信任锚常量文件不允许任何环境变量覆盖公钥；清单 URL 允许 `LINGBUILDER_SDK_CATALOG_URL` 覆盖（仅测试/开发用途）。

## 8. 管理后台设计（cloud/admin）

- NAV 新增「SDK 下载源」页：当前版本卡片（sequence、发布时间、发布人、每资源字段表，锚定字段只读灰显）、编辑表单（仅可更新字段可改）、发布确认（diff 预览弹窗）、历史列表（含每条 note）。
- 与既有「直链上传」联动：上传完成后一键回填 `downloadUrl` / `archiveBytes` / `sha256`（流式 SHA-256 已在 `r2UploadClient.ts` 内置）。
- 发布后展示「IDE 生效说明」：已装 IDE 在下次打开 SDK 面板时拉取生效。

## 9. 分阶段实施

| 阶段 | 内容 | 验收 | 状态 |
| --- | --- | --- | --- |
| P0 | 两条生产直链复核（HEAD/Range/首尾 1 MiB 哈希），无需重传 | 见 §2 | ✅ 2026-09-01 |
| P1 | contracts 类型、Prisma 模型、签名服务、3 个端点、cloud tests（`node --import tsx --test`） | POST 拒绝 http URL / 非法 sha256 / 缺字段；sequence 自增；审计落库；生产缺钥 503 | ✅ 2026-09-01（签名密钥为配对变量，见 §6.2） |
| P2 | admin「SDK 下载源」页 + 直链上传回填 | 发布 → GET 可取到；diff 预览正确；support/auditor 只读 | ✅ 2026-09-01 |
| P3 | IDE `catalogTrustAnchors.ts` + `sdkCatalogRemote.ts` + server.ts 注入 + status 字段 | electron tests：验签通过 / 篡改失败 / 锚定不一致拒绝 / sequence 回滚拒绝 / 拉取失败回退内置 | ✅ 2026-09-01（锚点已钉入生产密钥 `450c46062258e2d4`，随下次 IDE 发版启用远端清单） |
| P4 | 发布门禁脚本 + 诊断 UX | `electron/scripts` 门禁脚本比对锚定字段；SDK 面板显示来源与 sequence；失败有中文诊断 | ✅ 2026-09-01 |
| P5 | 文档拆分与上线 | 用户向 → 官网文档中心 `/guide/user/advanced/sdk-download`；维护者向 → `docs/SDK下载清单发布流程.md`；同步 §12 文档 | ✅ 2026-09-01（文档中心部署待执行） |
| P6 | 单独审批后执行（2026-09-01） | 修复模块 Permit 信任根由服务端下发的既有缺陷（`cloudAccountService.ts` / `moduleAccessService.ts`）：IDE 内置锚点 `modulePermitTrustAnchors.ts`（钉生产密钥 `0e2853e87a4250d3`）+ 云端轮换列表 `MODULE_PERMIT_ACCEPTED_KEY_IDS`；服务端 PEM 永不进入信任集 | ✅ 2026-09-01（云端已部署，容器内验证 `acceptedKeyIds=["0e2853e87a4250d3"]`） |

**启用远端清单前置条件**（当前 IDE 生产行为为内置清单）：① 云端执行 Prisma db push 创建 `SdkCatalogRelease` 表；② 生成 Ed25519 配对密钥并配置到云端环境变量；③ 公钥 + keyId 固化进 `electron/src/services/sdkDependencies/catalogTrustAnchors.ts` 并发 IDE 版本；④ 按 `docs/SDK下载清单发布流程.md` 发布首个清单并跑门禁。

## 10. 端到端验收（P3 完成后）

1. 后台发布一条把 FBro `version` 改为测试值的清单 → IDE SDK 面板显示 `catalogSource: remote`、sequence 递增。
2. 后台发布一条 `criticalFiles` 被改动的清单 → IDE 整条拒绝、回退内置、状态显示 builtin。
3. 断网 / 503 → IDE 正常显示内置清单，下载不受影响。
4. 用正式流程换一条真实新直链 → IDE 无需发版完成下载并通过整包 SHA-256。

## 11. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 云端被攻陷 | 清单签名 + IDE 内置锚点，攻击者最多让清单失效（IDE 回退内置），不能改下载地址 |
| 清单与 IDE 版本锚定字段漂移 | P4 发布门禁脚本；漂移时 IDE 整条拒绝并回退内置，功能不受损 |
| R2 直链线路抖动 | 清单走 api.lingbuilder.com（自有服务器）；下载保留 aria2 重试、代理与中文诊断 |
| sequence 状态文件损坏 | 视为「无已接受 sequence」，按首次安装处理（签名仍是边界） |
| 管理员误发布错误 sha256 | 下载后整包 SHA-256 必然失败并给出中文诊断，不会安装坏包 |

## 12. 文档同步义务

- P5 阶段：`LingBuilder AI 规则手册.md`、`docs/FUTURE_OPTIMIZATIONS.md`、`electron/README.md`、AGENTS.md（新增「SDK 直链云端配置规则」小节）、官网文档中心（用户向拆分部分）。
- 各阶段落地时按 AGENTS.md 要求写 `更新记录/YYYY-MM-DD.md`。
