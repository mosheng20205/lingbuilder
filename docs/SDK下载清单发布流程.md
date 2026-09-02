# SDK 下载清单发布流程（维护者向）

本文是 LingBuilder 维护者的 SDK 下载清单（云端 B 档方案）发布与启用操作手册。设计背景见 `docs/SDK按需下载直链云端配置设计.md`；用户向文档（下载失败排查 / 代理 / 手动部署）见官网文档中心「SDK 按需下载与离线安装」。

## 当前状态

- IDE 端信任锚 `electron/src/services/sdkDependencies/catalogTrustAnchors.ts` **已钉入生产公钥**（keyId `450c46062258e2d4`，2026-09-01 固化并跑通 electron 测试）：含该锚点的 IDE 版本发布后即启用远端清单；此前已发布的旧版 IDE 仍走内置清单，行为不变。该文件禁止任何环境变量/配置覆盖——锚点必须随二进制分发。
- 云端已完成：`SdkCatalogRelease` 表已建、`SDK_CATALOG_*` 密钥已配置（keyId `450c46062258e2d4`）、sequence 2 清单已发布且门禁通过（sequence 1 因导入损坏已被 2 取代）。

## 一次性启用 checklist

1. **建表**：在云端 API 执行 Prisma schema 同步（db push），创建 `SdkCatalogRelease` 表。
2. **生成密钥**：`node -e "const {generateKeyPairSync}=require('crypto');const {publicKey,privateKey}=generateKeyPairSync('ed25519');console.log(publicKey.export({type:'spki',format:'pem'}));console.log(privateKey.export({type:'pkcs8',format:'pem'}))"`。
3. **配置云端**：把私钥、公钥分别写入云端环境变量 `SDK_CATALOG_PRIVATE_KEY_PEM`、`SDK_CATALOG_PUBLIC_KEY_PEM`（两者必须配对，不匹配时发布接口直接报错；缺钥时接口返回 503，绝不下发未签名清单）。与模块 Permit 签名密钥分开保管，可独立轮换。
4. **固化信任锚**（✅ 已完成，2026-09-01）：keyId `450c46062258e2d4` 与公钥已写入 `catalogTrustAnchors.ts` 并通过 electron 测试；密钥轮换时才需重复本步——由新公钥计算 keyId = SHA-256(SPKI DER) 前 16 hex，把 `{ keyId, publicKeyPem }` 追加进锚点数组，跑 electron 测试后发 IDE 版本。该文件禁止任何环境变量/配置覆盖——锚点必须随二进制分发；未发带新锚的 IDE 前不得切换云端签发密钥。
5. **发布首个清单**：管理后台「SDK 下载源」页，导入 `sdkDependencyCatalog.ts` 内置资源数组（首次发布用 JSON 导入），核对后发布。
6. **跑门禁**：`cd electron && npm run sdk-catalog:check`（或设 `LINGBUILDER_SDK_CATALOG_URL`），确认「锚定字段与 IDE 内置清单逐字一致」。云端 503/未建表时该脚本会中文提示并退出 1，属预期。
7. **端到端确认**：新版 IDE 打开 SDK 面板，对话框显示「清单来源：云端清单（已验签）」与当前 sequence。

## 日常换直链 / 换版本

1. 上传新包到 R2（管理后台「版本与下载」的直链上传可复用，流式 SHA-256 回填）。
2. 管理后台「SDK 下载源」→ 对应资源修改 `version` / `archiveName` / `downloadUrl` / `archiveBytes` / `sha256` / `fileCount` / `expandedBytes` →「发布确认」检查 diff → 发布（sequence 自动 +1，写入管理员审计）。
3. 跑 `npm run sdk-catalog:check` 确认锚定字段无漂移。
4. 已安装的 IDE 在下次打开 SDK 面板时拉取生效（10 分钟内存缓存），无需发版。R2 对象内容变化必须换新版本化文件名 + URL，禁止原 URL 静默替换。

## 锚定字段与回滚语义（发布前必读）

- **锚定字段**（`id` / `moduleId` / `name` / `platform` / `requiredModuleIds` / `criticalFiles`）远端必须与 IDE 内置清单逐字一致；IDE 校验失败会**整条拒绝**并回退内置清单（不部分应用）。它们保护 `requireForModules` 门禁（防止远端清单让所有 F5 构建卡死）与解压后校验强度（内置 `minimumBytes` 随锚定保留）。
- **可更新字段**（`version` / `sdkVersion` / `archiveName` / `downloadUrl` / `archiveBytes` / `sha256` / `fileCount` / `expandedBytes`）是发布清单的目的所在；IDE 校验 https、64 位小写 sha256、正整数。
- **sequence 单调递增**并持久化于用户目录；IDE 拒绝低于已接受值的清单（防回滚/重放）。发布操作不可回退到旧清单，只能发布更高 sequence 的新清单。
- 任何校验失败（验签 / 锚定 / sequence / 字段）IDE 均回退内置清单，下载功能不受损；SDK 面板会显示「IDE 内置清单」来源便于诊断。

## 门禁与诊断

- `npm run sdk-catalog:check`：CI / 发布前必跑；锚定漂移时逐行列出（如「资源 fbro 锚定漂移：模块 ID … != 内置 …」）。
- 云端被攻陷场景：攻击者最多让清单失效（IDE 回退内置），不能改下载地址——验签与锚定保证这一点。
- 清单 URL 允许 `LINGBUILDER_SDK_CATALOG_URL` 覆盖（仅测试/开发）；`LINGBUILDER_CLOUD_RELEASE_MODE=online` 时默认 `https://api.lingbuilder.com/v1/site/sdk-catalog`。

## 实现位置

- 内置清单与信任锚：`electron/src/services/sdkDependencies/sdkDependencyCatalog.ts` / `catalogTrustAnchors.ts`
- 拉取验签合并：`electron/src/services/sdkDependencies/sdkCatalogRemote.ts`
- 门禁脚本：`electron/scripts/check-sdk-catalog-anchors.ts`；测试 `electron/tests/sdkCatalogRemote.test.ts`
- 云端：`cloud/api/src/website/sdk-catalog-{signing,service,controller}.ts`；管理后台 `cloud/admin/src/SdkCatalogAdmin.tsx`
